
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

// Helper to load an image from a source (URL or Base64) with error handling
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error("Failed to load image"));
        img.src = src;
    });
};

/**
 * Generates a base64 image where only the content inside maskRegions is visible.
 * Everything else is painted white.
 */
export const generateMaskedImage = async (imageState: ImageState): Promise<string> => {
    if (!imageState.maskRegions || imageState.maskRegions.length === 0) {
        return imageState.base64;
    }

    const { width, height, maskRegions } = imageState;
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No Context");

    // 1. Fill entire canvas with white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 2. Load original image
    const bgSrc = imageState.url || `data:image/png;base64,${imageState.base64}`;
    const imgBg = await loadImage(bgSrc);

    // 3. Draw ONLY the regions specified by masks
    // Iterate through masks, and for each mask, copy that specific rectangle 
    // from the source image to the destination canvas.
    for (const region of maskRegions) {
        const rx = width * (region.x / 100);
        const ry = height * (region.y / 100);
        const rw = width * (region.width / 100);
        const rh = height * (region.height / 100);
        
        // Calculate Top-Left from Center-based coordinates
        const tlX = rx - rw / 2;
        const tlY = ry - rh / 2;

        ctx.drawImage(
            imgBg, 
            tlX, tlY, rw, rh, // Source rect
            tlX, tlY, rw, rh  // Dest rect (same position)
        );
    }

    // 4. Return as base64
    return new Promise((resolve, reject) => {
        // Use JPEG for smaller size sent to API
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        // Strip prefix if needed by the consumer, but usually it's stripped later
        resolve(dataUrl); 
    });
};

export const compositeImage = async (imageState: ImageState): Promise<Blob | null> => {
    const { width, height, bubbles } = imageState;
    
    // 1. Prepare HTML for bubbles
    const bubblesHtml = bubbles.map(b => {
       const left = width * (b.x / 100);
       const top = height * (b.y / 100);
       const w = width * (b.width / 100);
       const h = height * (b.height / 100);
       const fontSize = width * (b.fontSize * 0.02); 
       
       const fontStack = b.fontFamily === 'zhimang' ? "'Zhi Mang Xing', cursive" 
                   : b.fontFamily === 'mashan' ? "'Ma Shan Zheng', cursive" 
                   : "'Noto Sans SC', sans-serif";
       
       const blurRadius = width * 0.015;
       const spreadRadius = width * 0.008;
       const safeText = escapeHtml(b.text);

       // --- THE FIX (VERSION 3) ---
       // 1. Sacrificial Line: Prepend a newline '\n' if vertical. 
       //    The canvas/foreignObject bug mangles the first column (rightmost).
       //    We feed it an empty line to eat the bug.
       const renderText = b.isVertical ? `\n${safeText}` : safeText;

       // 2. Geometric Correction:
       //    - Line Height is 1.5.
       //    - Adding '\n' creates an empty column of width 1.5em on the RIGHT.
       //    - Flexbox centers the whole block: [Empty(1.5em)] + [Text].
       //    - This makes the [Text] appear shifted to the LEFT.
       //    - To center the [Text], we must shift the container RIGHT.
       //    - Shift amount = Half of the extra width = 1.5em / 2 = 0.75em.
       //    - We use 'transform' because margins are unreliable in foreignObject.
       const verticalFixStyle = b.isVertical ? 'transform: translateX(0.75em);' : '';

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
                border-radius: 50%;
                box-shadow: ${b.backgroundColor === 'transparent' ? 'none' : `0 0 ${blurRadius}px ${spreadRadius}px ${b.backgroundColor}`};
                z-index: 1;
            "></div>
            
            <!-- Text Content (Foreground) -->
            <!-- Flattened structure + TranslateX Fix -->
            <div style="
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                writing-mode: ${b.isVertical ? 'vertical-rl' : 'horizontal-tb'};
                font-family: ${fontStack};
                font-size: ${fontSize}px;
                color: ${b.color};
                line-height: 1.5;
                text-align: ${b.isVertical ? 'left' : 'center'};
                white-space: pre-wrap;
                z-index: 2;
                ${verticalFixStyle}
            ">
                ${renderText}
            </div>
        </div>
       `;
    }).join('');

    // 2. Construct SVG Overlay (Transparent background, only bubbles)
    // NOTE: We do NOT embed the background image here to avoid "Tainted Canvas" security errors.
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

        // 3. Draw Background Image
        // We use the blob URL (imageState.url) directly. It is faster and safer than embedding base64 in SVG.
        // We fallback to base64 if url is missing (though in this app structure it shouldn't be).
        const bgSrc = imageState.url || `data:image/png;base64,${imageState.base64}`;
        const imgBg = await loadImage(bgSrc);
        ctx.drawImage(imgBg, 0, 0, width, height);

        // 4. Draw SVG Overlay
        // Encode SVG as Data URI.
        const svgSrc = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgXml);
        const imgSvg = await loadImage(svgSrc);
        ctx.drawImage(imgSvg, 0, 0);

        // 5. Export
        return new Promise((resolve, reject) => {
            try {
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error("Canvas toBlob failed (likely tainted)"));
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

export const downloadSingleImage = async (imageState: ImageState) => {
  try {
      const blob = await compositeImage(imageState);
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

export const downloadAllAsZip = async (images: ImageState[]) => {
  const zip = new JSZip();
  const folder = zip.folder("typeset_manga");
  let successCount = 0;

  for (const img of images) {
    try {
        const blob = await compositeImage(img);
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
