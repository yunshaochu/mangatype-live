
import { ImageState, Bubble, MaskRegion } from '../types';
import JSZip from 'jszip';

// Helper to escape HTML characters to prevent breaking SVG XML
const escapeHtml = (unsafe: string) => {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

// Helper to load image object from URL
const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = url;
    });
};

// Helper to convert RGB to Hex
const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

export interface ExportOptions {
    defaultMaskShape?: 'rectangle' | 'rounded' | 'ellipse';
    defaultMaskCornerRadius?: number;
    defaultMaskFeather?: number;
}

/**
 * Detects the background color of a bubble region.
 * Uses 'doughnut' sampling (edges) to avoid picking text color.
 */
export const detectBubbleColor = async (
    imageUrl: string, 
    xPct: number, yPct: number, wPct: number, hPct: number
): Promise<string> => {
    try {
        const img = await loadImage(imageUrl);
        const canvas = document.createElement('canvas');
        // Limit size for performance
        const maxDim = 1024; 
        let scale = 1;
        if (img.width > maxDim || img.height > maxDim) {
            scale = Math.min(maxDim / img.width, maxDim / img.height);
        }
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return '#ffffff';

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Calculate geometry
        const innerCX = (xPct / 100) * canvas.width;
        const innerCY = (yPct / 100) * canvas.height;
        const innerW = Math.max(1, (wPct / 100) * canvas.width);
        const innerH = Math.max(1, (hPct / 100) * canvas.height);
        
        const innerLeft = Math.floor(innerCX - innerW / 2);
        const innerTop = Math.floor(innerCY - innerH / 2);
        const innerRight = innerLeft + innerW;
        const innerBottom = innerTop + innerH;

        // Expanded sampling box
        const expandX = Math.max(5, innerW * 0.2);
        const expandY = Math.max(5, innerH * 0.2);

        const outerLeft = Math.max(0, Math.floor(innerLeft - expandX));
        const outerTop = Math.max(0, Math.floor(innerTop - expandY));
        const outerRight = Math.min(canvas.width, Math.ceil(innerRight + expandX));
        const outerBottom = Math.min(canvas.height, Math.ceil(innerBottom + expandY));
        
        const outerW = outerRight - outerLeft;
        const outerH = outerBottom - outerTop;

        if (outerW <= 0 || outerH <= 0) return '#ffffff';

        const imageData = ctx.getImageData(outerLeft, outerTop, outerW, outerH);
        const data = imageData.data;
        const colorCounts: Record<string, number> = {};
        let maxCount = 0;
        let dominantColor = '#ffffff';
        const step = 4; 
        
        for (let y = 0; y < outerH; y += step) {
            for (let x = 0; x < outerW; x += step) {
                // Skip inner box (content)
                const absX = outerLeft + x;
                const absY = outerTop + y;
                if (absX > innerLeft && absX < innerRight && absY > innerTop && absY < innerBottom) continue;

                const i = (y * outerW + x) * 4;
                if (data[i + 3] < 128) continue; // Skip transparent

                // Quantize to group similar colors
                const r = Math.round(data[i] / 16) * 16;
                const g = Math.round(data[i + 1] / 16) * 16;
                const b = Math.round(data[i + 2] / 16) * 16;

                const key = `${r},${g},${b}`;
                colorCounts[key] = (colorCounts[key] || 0) + 1;

                if (colorCounts[key] > maxCount) {
                    maxCount = colorCounts[key];
                    dominantColor = rgbToHex(Math.min(255, r), Math.min(255, g), Math.min(255, b));
                }
            }
        }
        return dominantColor;
    } catch (e) {
        console.warn("Color detection failed", e);
        return '#ffffff';
    }
};

/**
 * Generates an image where only the content inside mask regions is visible.
 */
export const generateMaskedImage = async (image: ImageState): Promise<string> => {
    const img = await loadImage(image.originalUrl || image.url);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return image.base64;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (image.maskRegions && image.maskRegions.length > 0) {
        ctx.save();
        ctx.beginPath();
        image.maskRegions.forEach(m => {
             const x = (m.x / 100) * canvas.width;
             const y = (m.y / 100) * canvas.height;
             const w = (m.width / 100) * canvas.width;
             const h = (m.height / 100) * canvas.height;
             ctx.rect(x - w/2, y - h/2, w, h);
        });
        ctx.clip();
        ctx.drawImage(img, 0, 0);
        ctx.restore();
    } else {
        ctx.drawImage(img, 0, 0);
    }
    return canvas.toDataURL('image/jpeg', 0.9);
};

/**
 * Generates a black/white mask for inpainting.
 * 
 * Options:
 * - specificMaskId: Only include this mask ID.
 * - onlyInpaintMethod: If true, only include masks marked with method='inpaint'.
 */
export const generateInpaintMask = async (image: ImageState, options?: { specificMaskId?: string, useRefinedMask?: boolean, onlyInpaintMethod?: boolean }): Promise<string> => {
    const w = image.width;
    const h = image.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context failed");

    const specificMaskId = options?.specificMaskId;
    const onlyInpaintMethod = options?.onlyInpaintMethod;
    
    // Fill Black (Keep)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    let targetRegions = image.maskRegions || [];

    // Filter by ID
    if (specificMaskId) {
        targetRegions = targetRegions.filter(m => m.id === specificMaskId);
    } 
    // Filter by Method (e.g., only 'inpaint' type for batch AI tasks)
    else if (onlyInpaintMethod) {
        targetRegions = targetRegions.filter(m => m.method === 'inpaint');
    }

    if (targetRegions.length === 0) return canvas.toDataURL('image/png');

    // Draw White (Remove)
    ctx.fillStyle = '#ffffff';
    targetRegions.forEach(m => {
        const mx = (m.x / 100) * w;
        const my = (m.y / 100) * h;
        const mw = (m.width / 100) * w;
        const mh = (m.height / 100) * h;
        ctx.fillRect(mx - mw/2, my - mh/2, mw, mh);
    });

    return canvas.toDataURL('image/png');
};

/**
 * Restores a specific region from the original source.
 */
export const restoreImageRegion = async (image: ImageState, regionId: string): Promise<string | null> => {
    const targetUrl = image.inpaintedUrl || image.originalUrl || image.url;
    const sourceUrl = image.originalUrl || image.url;
    const region = image.maskRegions?.find(m => m.id === regionId);
    if (!region) return null;

    const [imgTarget, imgSource] = await Promise.all([loadImage(targetUrl), loadImage(sourceUrl)]);
    const canvas = document.createElement('canvas');
    canvas.width = imgTarget.width;
    canvas.height = imgTarget.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw current base
    ctx.drawImage(imgTarget, 0, 0);
    
    // Clip and draw original over region
    const x = (region.x / 100) * canvas.width;
    const y = (region.y / 100) * canvas.height;
    const w = (region.width / 100) * canvas.width;
    const h = (region.height / 100) * canvas.height;
    
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - w/2, y - h/2, w, h);
    ctx.clip();
    ctx.drawImage(imgSource, 0, 0);
    ctx.restore();

    return canvas.toDataURL('image/png');
};

/**
 * Composites the image and bubbles using SVG ForeignObject.
 * This ensures the exported image matches the HTML view (white-space: pre, exact layout).
 */
export const compositeImage = async (imageState: ImageState, options?: ExportOptions): Promise<Blob | null> => {
    const { width, height, bubbles } = imageState;
    
    const bubblesHtml = bubbles.map(b => {
       const left = width * (b.x / 100);
       const top = height * (b.y / 100);
       const w = width * (b.width / 100);
       const h = height * (b.height / 100);
       
       // Calculate font size (cqw relative to image width)
       const fontSize = width * (b.fontSize * 0.02); 
       
       const fontStack = b.fontFamily === 'zhimang' ? "'Zhi Mang Xing', cursive" 
                   : b.fontFamily === 'mashan' ? "'Ma Shan Zheng', cursive" 
                   : b.fontFamily === 'happy' ? "'ZCOOL KuaiLe', cursive"
                   : "'Noto Sans SC', sans-serif";
       
       // Resolve Shape with Defaults (Fixes the ellipse bug)
       const shape = b.maskShape || options?.defaultMaskShape || 'ellipse';
       const radiusVal = b.maskCornerRadius !== undefined ? b.maskCornerRadius : (options?.defaultMaskCornerRadius ?? 15);
       const featherVal = b.maskFeather !== undefined ? b.maskFeather : (options?.defaultMaskFeather ?? 10);

       let borderRadius = '0%';
       if (shape === 'ellipse') borderRadius = '50%';
       else if (shape === 'rounded') borderRadius = `${radiusVal}%`;

       // CSS Logic Approximation
       const blurPx = w * (featherVal * 0.0015) * 10;
       const spreadPx = w * (featherVal * 0.0008) * 10;

       const safeText = escapeHtml(b.text);
       // Vertical Text Fix
       const renderText = b.isVertical ? `\n${safeText}` : safeText;
       const verticalFixStyle = b.isVertical ? 'transform: translateX(0.75em);' : '';

       const strokeStyle = `
         -webkit-text-stroke: 4px #ffffff; 
         paint-order: stroke fill;
       `;

       return `
        <div style="
            position: absolute;
            top: ${top}px;
            left: ${left}px;
            width: ${w}px;
            height: ${h}px;
            transform: translate(-50%, -50%) rotate(${b.rotation}deg);
            z-index: 10;
        ">
            <!-- Mask (Background) -->
            <div style="
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background-color: ${b.backgroundColor};
                border-radius: ${borderRadius};
                box-shadow: ${(b.backgroundColor === 'transparent' || featherVal <= 0) ? 'none' : `0 0 ${blurPx}px ${spreadPx}px ${b.backgroundColor}`};
                z-index: 1;
            "></div>
            
            <!-- Text Content -->
            <div style="
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                writing-mode: ${b.isVertical ? 'vertical-rl' : 'horizontal-tb'};
                font-family: ${fontStack};
                font-size: ${fontSize}px;
                font-weight: bold;
                color: ${b.color};
                line-height: 1.5;
                text-align: ${b.isVertical ? 'left' : 'center'};
                white-space: pre; 
                z-index: 2;
                ${verticalFixStyle}
                ${strokeStyle}
            ">
                ${renderText}
            </div>
        </div>
       `;
    }).join('');

    const svgXml = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">
                ${bubblesHtml}
            </div>
        </foreignObject>
    </svg>
    `;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);
        const ctx = canvas.getContext('2d');
        if(!ctx) throw new Error("No Context");

        const bgSrc = imageState.inpaintedUrl || imageState.originalUrl || imageState.url || `data:image/png;base64,${imageState.base64}`;
        const imgBg = await loadImage(bgSrc);
        ctx.drawImage(imgBg, 0, 0, width, height);

        // --- NEW: DRAW FILLED MASKS (Manual Fill) ---
        // These are masks that are cleaned but NOT via inpainting (method='fill')
        // We must burn them into the exported image here because they exist only as metadata in the app.
        if (imageState.maskRegions) {
            imageState.maskRegions.forEach(m => {
                if (m.isCleaned && m.method === 'fill') {
                    const x = (m.x / 100) * width;
                    const y = (m.y / 100) * height;
                    const w = (m.width / 100) * width;
                    const h = (m.height / 100) * height;
                    ctx.fillStyle = m.fillColor || '#ffffff';
                    ctx.fillRect(x - w/2, y - h/2, w, h);
                }
            });
        }
        // --------------------------------------------

        const svgSrc = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgXml);
        const imgSvg = await loadImage(svgSrc);
        ctx.drawImage(imgSvg, 0, 0);

        return new Promise((resolve, reject) => {
            try {
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error("Canvas toBlob failed"));
                }, 'image/png');
            } catch (e) {
                reject(e);
            }
        });

    } catch (e) {
        console.error("Composite Error:", e);
        throw e;
    }
};

export const downloadSingleImage = async (imageState: ImageState, options?: ExportOptions) => {
  try {
      const blob = await compositeImage(imageState, options);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `typeset_${imageState.name.replace(/\.[^/.]+$/, "")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  } catch (e) {
      console.error("Download failed", e);
      alert("Failed to generate image. See console for details.");
  }
};

export const downloadAllAsZip = async (
    images: ImageState[], 
    onProgress?: (current: number, total: number) => void,
    options?: ExportOptions
) => {
  const zip = new JSZip();
  const folder = zip.folder("typeset_manga");
  let successCount = 0;
  const total = images.length;

  for (let i = 0; i < total; i++) {
    const img = images[i];
    if (onProgress) onProgress(i + 1, total);

    try {
        const blob = await compositeImage(img, options);
        if (blob && folder) {
            folder.file(`${img.name.replace(/\.[^/.]+$/, "")}.png`, blob);
            successCount++;
        }
    } catch (e) {
        console.warn(`Failed to process ${img.name}`, e);
    }
  }

  if (successCount === 0) {
      alert("No images processed successfully.");
      return;
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = "manga_typeset_result.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
