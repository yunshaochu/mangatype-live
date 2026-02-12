
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
        img.onerror = reject;
        img.src = url;
    });
};

/**
 * Detects the background color of a bubble region.
 * Uses canvas to sample pixels from the original image.
 */
export const detectBubbleColor = async (
    imageUrl: string, 
    x: number, y: number, width: number, height: number
): Promise<string> => {
    try {
        const img = await loadImage(imageUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '#ffffff';

        ctx.drawImage(img, 0, 0);

        // Convert percentages to pixels
        const bx = (x / 100) * img.width;
        const by = (y / 100) * img.height;
        const bw = (width / 100) * img.width;
        const bh = (height / 100) * img.height;

        // Sample a few points around the edges of the defined box to guess the background
        // We use inner edges to avoid picking up the border or outside content
        const samplePoints = [
            { x: bx - bw/2 + bw*0.1, y: by - bh/2 + bh*0.1 }, // Top Left
            { x: bx + bw/2 - bw*0.1, y: by - bh/2 + bh*0.1 }, // Top Right
            { x: bx - bw/2 + bw*0.1, y: by + bh/2 - bh*0.1 }, // Bottom Left
            { x: bx + bw/2 - bw*0.1, y: by + bh/2 - bh*0.1 }, // Bottom Right
        ];

        let r = 0, g = 0, b = 0, count = 0;

        samplePoints.forEach(p => {
            if (p.x >= 0 && p.x < img.width && p.y >= 0 && p.y < img.height) {
                const data = ctx.getImageData(p.x, p.y, 1, 1).data;
                r += data[0];
                g += data[1];
                b += data[2];
                count++;
            }
        });

        if (count === 0) return '#ffffff';

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Convert RGB to Hex
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch (e) {
        console.warn("Color detection failed, defaulting to white.", e);
        return '#ffffff';
    }
};

/**
 * Generates an image where only the content inside mask regions is visible.
 * Everything else is white. Used for "Masked Image Mode" in detection.
 */
export const generateMaskedImage = async (image: ImageState): Promise<string> => {
    const img = await loadImage(image.originalUrl || image.url);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context failed");

    // 1. Fill background with white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw ONLY the regions inside masks
    if (image.maskRegions && image.maskRegions.length > 0) {
        ctx.save();
        ctx.beginPath();
        image.maskRegions.forEach(m => {
             const x = (m.x / 100) * canvas.width;
             const y = (m.y / 100) * canvas.height;
             const w = (m.width / 100) * canvas.width;
             const h = (m.height / 100) * canvas.height;
             // Draw rect centered at x,y
             ctx.rect(x - w/2, y - h/2, w, h);
        });
        ctx.clip();
        ctx.drawImage(img, 0, 0);
        ctx.restore();
    } else {
        // Fallback: return original if no masks found (safer default)
        ctx.drawImage(img, 0, 0);
    }

    return canvas.toDataURL('image/jpeg', 0.9);
};

/**
 * Generates a black/white mask for inpainting.
 * White pixels = area to inpaint (erase).
 * Black pixels = area to keep.
 */
export const generateInpaintMask = async (image: ImageState, options?: { specificMaskId?: string, useRefinedMask?: boolean }): Promise<string> => {
    const w = image.width;
    const h = image.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Canvas context failed");

    const specificMaskId = options?.specificMaskId;
    const useRefinedMask = options?.useRefinedMask ?? false;

    // 1. Fill Black background (keep everything by default)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // 2. Prepare Refined Mask Image (if requested and available)
    let refinedMaskImg: HTMLImageElement | null = null;
    if (useRefinedMask && image.maskRefinedBase64) {
        try {
            const src = image.maskRefinedBase64.startsWith('data:') 
                ? image.maskRefinedBase64 
                : `data:image/png;base64,${image.maskRefinedBase64}`;
            refinedMaskImg = await loadImage(src);
        } catch(e) {
            console.warn("Failed to load refined mask for generation", e);
        }
    }

    // Determine which regions to process
    // If specificMaskId is provided, only process that one. Otherwise, all regions.
    const targetRegions = specificMaskId 
        ? (image.maskRegions || []).filter(m => m.id === specificMaskId)
        : (image.maskRegions || []);

    if (targetRegions.length === 0) {
        return canvas.toDataURL('image/png');
    }

    // 3. Draw Mask
    if (refinedMaskImg) {
        // NEW LOGIC: Only draw the refined mask INSIDE the red boxes.
        // If a pixel is white in the refined mask BUT outside any red box, it remains black (ignored).
        
        ctx.save();
        ctx.beginPath();
        targetRegions.forEach(m => {
            const mx = (m.x / 100) * w;
            const my = (m.y / 100) * h;
            const mw = (m.width / 100) * w;
            const mh = (m.height / 100) * h;
            ctx.rect(mx - mw/2, my - mh/2, mw, mh);
        });
        ctx.clip(); // Restrict drawing to the union of all target regions

        // Now draw the refined mask. It will only appear where we clipped.
        ctx.drawImage(refinedMaskImg, 0, 0, w, h);
        ctx.restore();

    } else {
        // Fallback: Erase the entire rectangles (Pure white boxes)
        ctx.fillStyle = '#ffffff';
        targetRegions.forEach(m => {
            const mx = (m.x / 100) * w;
            const my = (m.y / 100) * h;
            const mw = (m.width / 100) * w;
            const mh = (m.height / 100) * h;
            ctx.fillRect(mx - mw/2, my - mh/2, mw, mh);
        });
    }

    return canvas.toDataURL('image/png');
};

/**
 * Restores a specific region of the image from the original source.
 * Copies pixels from Original -> Inpainted Layer at the mask's coordinates.
 */
export const restoreImageRegion = async (image: ImageState, regionId: string): Promise<string | null> => {
    // Need both original and current inpainted version (or url if inpainted isn't made yet)
    // If inpainted doesn't exist, we just return original, but logic calls this when we want to revert part of inpainted
    const targetUrl = image.inpaintedUrl || image.originalUrl || image.url;
    const sourceUrl = image.originalUrl || image.url;
    const region = image.maskRegions?.find(m => m.id === regionId);

    if (!region) return null;

    const [imgTarget, imgSource] = await Promise.all([
        loadImage(targetUrl),
        loadImage(sourceUrl)
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = imgTarget.width;
    canvas.height = imgTarget.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Draw the current state (inpainted) as base
    ctx.drawImage(imgTarget, 0, 0);

    // 2. Calculate pixel coordinates of region
    const x = (region.x / 100) * canvas.width;
    const y = (region.y / 100) * canvas.height;
    const w = (region.width / 100) * canvas.width;
    const h = (region.height / 100) * canvas.height;
    const rx = x - w/2;
    const ry = y - h/2;

    // 3. Clip to the region
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, w, h);
    ctx.clip();

    // 4. Draw the original source image over the clipped area
    //    Since drawImage coords are absolute, drawing at 0,0 with clip works perfectly to overlay exact pixels
    ctx.drawImage(imgSource, 0, 0);
    ctx.restore();

    return canvas.toDataURL('image/png');
};

/**
 * Composites the image and bubbles into a single Blob.
 * Used for "Merge" and "Export".
 */
export const compositeImage = async (imageState: ImageState): Promise<Blob | null> => {
    const canvas = document.createElement('canvas');
    // Prefer clean (inpainted) image if available, else original
    const sourceUrl = imageState.inpaintedUrl || imageState.originalUrl || imageState.url;
    const img = await loadImage(sourceUrl);
    
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw base image
    ctx.drawImage(img, 0, 0);

    // Draw bubbles
    // Note: This is a canvas approximation of the CSS rendering. 
    // It may not be pixel-perfect identical to the HTML overlay but serves as a solid export.
    for (const bubble of imageState.bubbles) {
        const x = (bubble.x / 100) * canvas.width;
        const y = (bubble.y / 100) * canvas.height;
        const w = (bubble.width / 100) * canvas.width;
        const h = (bubble.height / 100) * canvas.height;

        ctx.save();
        
        // Translate to center for rotation
        ctx.translate(x, y);
        ctx.rotate((bubble.rotation * Math.PI) / 180);
        ctx.translate(-x, -y);

        // Draw Background
        if (bubble.backgroundColor && bubble.backgroundColor !== 'transparent') {
            ctx.fillStyle = bubble.backgroundColor;
            
            if (bubble.maskShape === 'rectangle') {
                ctx.fillRect(x - w/2, y - h/2, w, h);
            } else if (bubble.maskShape === 'rounded') {
                 // Simplified rounded rect
                 const r = Math.min(w, h) * ((bubble.maskCornerRadius || 20) / 100);
                 if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(x - w/2, y - h/2, w, h, r);
                    ctx.fill();
                 } else {
                    // Fallback for older browsers
                    ctx.fillRect(x - w/2, y - h/2, w, h);
                 }
            } else {
                // Ellipse (Default)
                ctx.beginPath();
                ctx.ellipse(x, y, w/2, h/2, 0, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
        
        // Draw Text
        ctx.fillStyle = bubble.color || '#000000';
        
        // Calculate font size in pixels based on "cqw" logic logic in BubbleLayer
        // 1cqw = 1% of container width. Container is bubble width 'w'.
        // fontSize = bubble.fontSize * 2 * (w / 100)
        const fs = (bubble.fontSize * 2) * (w / 100);
        
        // Select Font
        let fontName = "sans-serif";
        if (bubble.fontFamily === 'happy') fontName = '"ZCOOL KuaiLe", cursive';
        else if (bubble.fontFamily === 'zhimang') fontName = '"Zhi Mang Xing", cursive';
        else if (bubble.fontFamily === 'mashan') fontName = '"Ma Shan Zheng", cursive';
        else fontName = '"Noto Sans SC", sans-serif';

        ctx.font = `bold ${fs}px ${fontName}`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        
        // Apply Stroke
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.lineJoin = 'round';

        const text = bubble.text || '';
        
        if (bubble.isVertical) {
            // Vertical text simulation
            const chars = text.split('');
            const lineHeight = fs * 1.2;
            const totalHeight = chars.length * lineHeight;
            let startY = y - totalHeight / 2 + lineHeight / 2;
            
            chars.forEach((char, i) => {
                const charY = startY + i * lineHeight;
                ctx.strokeText(char, x, charY);
                ctx.fillText(char, x, charY);
            });
        } else {
            // Horizontal text: split by newlines
            const lines = text.split('\n');
            const lineHeight = fs * 1.3;
            const totalH = lines.length * lineHeight;
            let startY = y - totalH / 2 + lineHeight / 2;
             lines.forEach((line, i) => {
                const lineY = startY + i * lineHeight;
                ctx.strokeText(line, x, lineY);
                ctx.fillText(line, x, lineY);
            });
        }

        ctx.restore();
    }

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
};

/**
 * Downloads a single image with baked-in text.
 */
export const downloadSingleImage = async (image: ImageState) => {
    const blob = await compositeImage(image);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translated_${image.name.replace(/\.[^/.]+$/, "")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Downloads all images as a ZIP file.
 */
export const downloadAllAsZip = async (images: ImageState[], onProgress?: (current: number, total: number) => void) => {
    const zip = new JSZip();
    let count = 0;
    
    // Filter out skipped images? Or include them? Typically people want the results.
    // Let's include everything currently in the list.
    
    for (const img of images) {
        const blob = await compositeImage(img);
        if (blob) {
            const fileName = `translated_${img.name.replace(/\.[^/.]+$/, "")}.png`;
            zip.file(fileName, blob);
        }
        count++;
        if (onProgress) onProgress(count, images.length);
    }
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch_translated.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};