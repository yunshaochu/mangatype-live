
import { ImageState, Bubble, MaskRegion, FONTS, getFontStack } from '../types';
import JSZip from 'jszip';
import { domToPng } from 'modern-screenshot';

// Helper to escape HTML characters to prevent breaking SVG XML
const escapeHtml = (unsafe: string) => {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

// Google Fonts CSS URL (same as index.html)
const GOOGLE_FONTS_CSS_URL = 'https://fonts.googleapis.com/css2?family=Zhi+Mang+Xing&family=Ma+Shan+Zheng&family=Noto+Sans+SC:wght@400;700;900&family=Noto+Serif+SC:wght@400;700&family=ZCOOL+KuaiLe&family=ZCOOL+XiaoWei&family=Long+Cang&family=Liu+Jian+Mao+Cao&display=swap';

// Cache: parsed @font-face blocks keyed by font-family name
let _fontFaceBlocksCache: Map<string, string[]> | null = null;
// Cache: already-fetched woff2 URLs → base64 data URLs
const _woff2DataUrlCache = new Map<string, string>();

/** Parse Google Fonts CSS into a map of font-family → [@font-face blocks] */
const getFontFaceBlocks = async (): Promise<Map<string, string[]>> => {
    if (_fontFaceBlocksCache) return _fontFaceBlocksCache;

    const cssResponse = await fetch(GOOGLE_FONTS_CSS_URL).catch(() => null);
    if (!cssResponse || !cssResponse.ok) {
        console.warn('Failed to fetch Google Fonts CSS for inlining');
        return new Map();
    }

    const cssText = await cssResponse.text();
    const blockRegex = /@font-face\s*\{[^}]+\}/g;
    const familyRegex = /font-family:\s*'([^']+)'/;
    const map = new Map<string, string[]>();

    let m;
    while ((m = blockRegex.exec(cssText)) !== null) {
        const block = m[0];
        const familyMatch = familyRegex.exec(block);
        if (familyMatch) {
            const family = familyMatch[1];
            if (!map.has(family)) map.set(family, []);
            map.get(family)!.push(block);
        }
    }

    _fontFaceBlocksCache = map;
    return map;
};

/** Convert ArrayBuffer to base64 string in chunks, yielding to main thread between chunks */
const arrayBufferToBase64 = async (buffer: ArrayBuffer): Promise<string> => {
    const bytes = new Uint8Array(buffer);
    const CHUNK = 64 * 1024; // 64KB per chunk
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += CHUNK) {
        const end = Math.min(i + CHUNK, bytes.byteLength);
        for (let j = i; j < end; j++) {
            binary += String.fromCharCode(bytes[j]);
        }
        // Yield to main thread between chunks
        if (end < bytes.byteLength) {
            await new Promise(r => setTimeout(r, 0));
        }
    }
    return btoa(binary);
};

/** Fetch a woff2 URL and return base64 data URL (with caching) */
const fetchWoff2AsDataUrl = async (url: string): Promise<string | null> => {
    if (_woff2DataUrlCache.has(url)) return _woff2DataUrlCache.get(url)!;
    try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const buffer = await resp.arrayBuffer();
        const base64 = await arrayBufferToBase64(buffer);
        const dataUrl = `data:font/woff2;base64,${base64}`;
        _woff2DataUrlCache.set(url, dataUrl);
        return dataUrl;
    } catch {
        return null;
    }
};

/**
 * Build inlined @font-face CSS for only the given font families.
 * Fetches woff2 files and creates local blob URLs for them.
 */
const getInlinedFontCSS = async (usedFamilies: Set<string>): Promise<string> => {
    const blocks = await getFontFaceBlocks();
    if (blocks.size === 0) return '';

    const neededBlocks: string[] = [];
    for (const family of usedFamilies) {
        const familyBlocks = blocks.get(family);
        if (familyBlocks) neededBlocks.push(...familyBlocks);
    }
    if (neededBlocks.length === 0) return '';

    // Collect all woff2 URLs from needed blocks
    const urlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
    const urlsToFetch = new Set<string>();
    for (const block of neededBlocks) {
        let m;
        while ((m = urlRegex.exec(block)) !== null) {
            urlsToFetch.add(m[1]);
        }
    }

    // Fetch and convert woff2 files one by one to avoid blocking the main thread
    for (const url of urlsToFetch) {
        await fetchWoff2AsDataUrl(url);
    }

    // Replace URLs with cached data URLs
    let css = neededBlocks.join('\n');
    for (const url of urlsToFetch) {
        const dataUrl = _woff2DataUrlCache.get(url);
        if (dataUrl) {
            css = css.replaceAll(`url(${url})`, `url(${dataUrl})`);
        }
    }

    return css;
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
    exportMethod?: 'canvas' | 'screenshot';
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
 * Generates an image with red boxes drawn on it to visually indicate mask regions.
 */
export const generateAnnotatedImage = async (image: ImageState): Promise<string> => {
    const img = await loadImage(image.originalUrl || image.url);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return image.base64;

    ctx.drawImage(img, 0, 0);

    if (image.maskRegions && image.maskRegions.length > 0) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = Math.max(2, Math.round(Math.min(img.width, img.height) / 200));
        image.maskRegions.forEach(m => {
            const x = (m.x / 100) * canvas.width;
            const y = (m.y / 100) * canvas.height;
            const w = (m.width / 100) * canvas.width;
            const h = (m.height / 100) * canvas.height;
            ctx.strokeRect(x - w / 2, y - h / 2, w, h);
        });
    }
    return canvas.toDataURL('image/jpeg', 0.9);
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
 * Crops a rectangular region from a full image, returning a data URL of just that region.
 */
export const cropRegionFromImage = async (
    imageDataUrl: string,
    mask: { x: number; y: number; width: number; height: number },
    imgWidth: number,
    imgHeight: number
): Promise<string> => {
    const img = await loadImage(imageDataUrl);
    const px = (mask.x / 100) * imgWidth;
    const py = (mask.y / 100) * imgHeight;
    const pw = (mask.width / 100) * imgWidth;
    const ph = (mask.height / 100) * imgHeight;
    const left = Math.max(0, Math.floor(px - pw / 2));
    const top = Math.max(0, Math.floor(py - ph / 2));
    const cropW = Math.min(Math.ceil(pw), imgWidth - left);
    const cropH = Math.min(Math.ceil(ph), imgHeight - top);
    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context failed');
    ctx.drawImage(img, left, top, cropW, cropH, 0, 0, cropW, cropH);
    return canvas.toDataURL('image/png');
};

/**
 * Composites a cropped region result back into a full image at the correct position.
 */
export const compositeRegionIntoImage = async (
    fullImageDataUrl: string,
    regionDataUrl: string,
    mask: { x: number; y: number; width: number; height: number },
    imgWidth: number,
    imgHeight: number
): Promise<string> => {
    const [imgFull, imgRegion] = await Promise.all([
        loadImage(fullImageDataUrl),
        loadImage(regionDataUrl)
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = imgWidth;
    canvas.height = imgHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context failed');
    ctx.drawImage(imgFull, 0, 0, imgWidth, imgHeight);
    const px = (mask.x / 100) * imgWidth;
    const py = (mask.y / 100) * imgHeight;
    const pw = (mask.width / 100) * imgWidth;
    const ph = (mask.height / 100) * imgHeight;
    const left = Math.max(0, Math.floor(px - pw / 2));
    const top = Math.max(0, Math.floor(py - ph / 2));
    const cropW = Math.min(Math.ceil(pw), imgWidth - left);
    const cropH = Math.min(Math.ceil(ph), imgHeight - top);
    ctx.drawImage(imgRegion, 0, 0, imgRegion.width, imgRegion.height, left, top, cropW, cropH);
    return canvas.toDataURL('image/png');
};

/**
 * Composites the image and bubbles using pure Canvas API with DOM measurement.
 * Uses DOM to measure exact text positions for WYSIWYG accuracy.
 */
export const compositeImageWithCanvas = async (imageState: ImageState, options?: ExportOptions): Promise<Blob | null> => {
    const { width, height, bubbles } = imageState;

    // Ensure fonts are loaded before rendering
    await document.fonts.ready;
    // Preload all fonts from centralized config
    const uniqueFonts = [...new Set(FONTS.map(f => f.googleFontName))];
    await Promise.all(
        uniqueFonts.map(fontName =>
            document.fonts.load(`bold 48px '${fontName}'`).catch(() => {})
        )
    );

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("No Context");

    // 1. Draw background image
    const bgSrc = imageState.inpaintedUrl || imageState.originalUrl || imageState.url || `data:image/png;base64,${imageState.base64}`;
    const imgBg = await loadImage(bgSrc);
    ctx.drawImage(imgBg, 0, 0, width, height);

    // 2. Draw filled masks (manual fill regions)
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

    // 3. Create hidden DOM container for measuring text positions
    const measureContainer = document.createElement('div');
    measureContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: ${width}px;
        height: ${height}px;
        pointer-events: none;
        visibility: hidden;
    `;
    document.body.appendChild(measureContainer);

    try {
        // 4. Draw each bubble
        for (const b of bubbles) {
            const centerX = width * (b.x / 100);
            const centerY = height * (b.y / 100);
            const bubbleW = width * (b.width / 100);
            const bubbleH = height * (b.height / 100);
            const fontSize = width * (b.fontSize * 0.02);

            const fontStack = getFontStack(b.fontFamily);

            const shape = b.maskShape || options?.defaultMaskShape || 'ellipse';
            const radiusVal = b.maskCornerRadius !== undefined ? b.maskCornerRadius : (options?.defaultMaskCornerRadius ?? 15);
            const featherVal = b.maskFeather !== undefined ? b.maskFeather : (options?.defaultMaskFeather ?? 10);

            // Create DOM element to measure exact text position
            const textMeasureEl = document.createElement('div');
            textMeasureEl.style.cssText = `
                position: absolute;
                top: ${centerY - bubbleH / 2}px;
                left: ${centerX - bubbleW / 2}px;
                width: ${bubbleW}px;
                height: ${bubbleH}px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: ${fontStack};
                font-size: ${fontSize}px;
                font-weight: bold;
                color: ${b.color};
                writing-mode: ${b.isVertical ? 'vertical-rl' : 'horizontal-tb'};
                text-orientation: ${b.isVertical ? 'mixed' : 'auto'};
                white-space: pre;
                line-height: 1.5;
                text-align: ${b.isVertical ? 'left' : 'center'};
                -webkit-text-stroke: 3px ${b.strokeColor && b.strokeColor !== 'transparent' ? b.strokeColor : '#ffffff'};
                paint-order: stroke fill;
                transform: rotate(${b.rotation}deg);
            `;
            // For vertical text, wrap each char in a span for per-character measurement
            const charSpans: HTMLSpanElement[] = [];
            if (b.isVertical) {
                // Use an inner block container so that \n (with white-space:pre)
                // actually creates column breaks inside the flex parent
                const innerBlock = document.createElement('div');
                innerBlock.style.cssText = 'white-space: pre; writing-mode: vertical-rl; text-orientation: mixed; line-height: 1.5;';
                b.text.split('').forEach(char => {
                    if (char === '\n') {
                        innerBlock.appendChild(document.createTextNode('\n'));
                    } else {
                        const span = document.createElement('span');
                        span.textContent = char;
                        innerBlock.appendChild(span);
                        charSpans.push(span);
                    }
                });
                textMeasureEl.appendChild(innerBlock);
            } else {
                textMeasureEl.textContent = b.text;
            }
            measureContainer.appendChild(textMeasureEl);

            // Wait for layout
            await new Promise(r => setTimeout(r, 0));

            // Get the text content's bounding rect (relative to container)
            const textRect = textMeasureEl.getBoundingClientRect();
            const containerRect = measureContainer.getBoundingClientRect();

            // Text position relative to image coordinates
            const textCenterX = textRect.left - containerRect.left + textRect.width / 2;
            const textCenterY = textRect.top - containerRect.top + textRect.height / 2;

            ctx.save();

            // Draw mask background with shape (at bubble center, with rotation)
            ctx.translate(centerX, centerY);
            ctx.rotate((b.rotation * Math.PI) / 180);

            if (b.backgroundColor !== 'transparent') {
                const blurPx = bubbleW * (featherVal * 0.0015) * 10;
                const spreadPx = bubbleW * (featherVal * 0.0008) * 10;

                // Draw feathered shadow
                if (featherVal > 0) {
                    const halfW = bubbleW / 2;
                    const halfH = bubbleH / 2;
                    const passes = 8;
                    for (let i = passes; i >= 1; i--) {
                        const alpha = 0.15 / i;
                        const expand = (spreadPx + blurPx) * (i / passes);
                        ctx.fillStyle = b.backgroundColor;
                        ctx.globalAlpha = alpha;
                        ctx.beginPath();
                        if (shape === 'ellipse') {
                            ctx.ellipse(0, 0, halfW + expand, halfH + expand, 0, 0, Math.PI * 2);
                        } else if (shape === 'rounded') {
                            const r = Math.min(halfW, halfH) * (radiusVal / 100);
                            drawRoundedRect(ctx, -halfW - expand, -halfH - expand, bubbleW + expand * 2, bubbleH + expand * 2, r + expand);
                        } else {
                            ctx.rect(-halfW - expand, -halfH - expand, bubbleW + expand * 2, bubbleH + expand * 2);
                        }
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                }

                // Draw main background
                ctx.fillStyle = b.backgroundColor;
                ctx.beginPath();
                const halfW = bubbleW / 2;
                const halfH = bubbleH / 2;
                if (shape === 'ellipse') {
                    ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
                } else if (shape === 'rounded') {
                    const r = Math.min(halfW, halfH) * (radiusVal / 100);
                    drawRoundedRect(ctx, -halfW, -halfH, bubbleW, bubbleH, r);
                } else {
                    ctx.rect(-halfW, -halfH, bubbleW, bubbleH);
                }
                ctx.fill();
            }

            ctx.restore();

            // Draw text at measured position (no rotation for text, CSS handles it)
            ctx.font = `bold ${fontSize}px ${fontStack}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = b.strokeColor && b.strokeColor !== 'transparent' ? b.strokeColor : '#ffffff';
            ctx.lineWidth = Math.max(2, fontSize * 0.1);
            ctx.lineJoin = 'round';
            ctx.fillStyle = b.color;

            // Fix letter-spacing to match CSS rendering
            if ('letterSpacing' in ctx) {
                (ctx as any).letterSpacing = '0px';
            }

            const lines = b.text.split('\n');
            const lineHeight = fontSize * 1.5;

            if (b.isVertical) {
                // Vertical text: use DOM-measured character positions for pixel-perfect rendering
                // Each char's position was already laid out by CSS (writing-mode + text-orientation: mixed)

                charSpans.forEach(span => {
                    const char = span.textContent || '';
                    const rect = span.getBoundingClientRect();
                    // Character center in image coordinates
                    const charCX = rect.left - containerRect.left + rect.width / 2;
                    const charCY = rect.top - containerRect.top + rect.height / 2;

                    ctx.save();
                    ctx.translate(charCX, charCY);

                    // CSS text-orientation: mixed rotates horizontal scripts 90° CW.
                    // The DOM layout already positions chars correctly, but Canvas fillText
                    // always draws upright, so we must rotate for horizontal-script chars.
                    // CJK punctuation that has vertical variants (，。、：；！？) also needs
                    // special handling — CSS uses vertical glyph variants but Canvas doesn't.
                    const isHorizontalScript = /[A-Za-z0-9…—!?@#$%^&*()_+=\[\]{}<>\/\\|~`'";:,.\-]/.test(char);
                    const isCJKPunctuation = /[，。、：；「」『』（）【】〈〉《》〔〕｛｝～·]/.test(char);
                    if (isHorizontalScript || isCJKPunctuation) {
                        ctx.rotate(Math.PI / 2);
                    }

                    if (b.strokeColor && b.strokeColor !== 'transparent') {
                        ctx.strokeText(char, 0, 0);
                    }
                    ctx.fillText(char, 0, 0);
                    ctx.restore();
                });
            } else {
                // Horizontal text
                const totalHeight = (lines.length - 1) * lineHeight;

                ctx.save();
                ctx.translate(textCenterX, textCenterY);
                ctx.rotate((b.rotation * Math.PI) / 180);

                const startY = -totalHeight / 2;
                lines.forEach((line, idx) => {
                    const y = startY + idx * lineHeight;
                    if (b.strokeColor && b.strokeColor !== 'transparent') {
                        ctx.strokeText(line, 0, y);
                    }
                    ctx.fillText(line, 0, y);
                });
                ctx.restore();
            }

            // Clean up measure element
            measureContainer.removeChild(textMeasureEl);
        }
    } finally {
        document.body.removeChild(measureContainer);
    }

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
};

// Helper: Draw rounded rectangle path
const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
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
       
       const fontStack = getFontStack(b.fontFamily);
       
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
       // Vertical Text Fix: 牺牲行用于解决 Chrome ForeignObject 竖排第一行缩进 Bug
       const renderText = b.isVertical ? `\n${safeText}` : safeText;

       // 方案 C: 绝对定位手动居中，避免 Flexbox 在 SVG ForeignObject 中的渲染差异
       // 基础 transform: 将文字中心对齐到父容器中心
       // 竖排额外补偿: translateX(0.75em) 补偿牺牲行导致的宽度增加
       const centerTransform = b.isVertical
         ? 'translate(-50%, -50%) translateX(0.75em)'
         : 'translate(-50%, -50%)';

       const strokeStyle = `
         -webkit-text-stroke: 3px ${b.strokeColor && b.strokeColor !== 'transparent' ? b.strokeColor : '#ffffff'};
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

            <!-- Text Content - 绝对定位手动居中 -->
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: ${centerTransform};
                writing-mode: ${b.isVertical ? 'vertical-rl' : 'horizontal-tb'};
                font-family: ${fontStack};
                font-size: ${fontSize}px;
                font-weight: bold;
                color: ${b.color};
                line-height: 1.5;
                text-align: ${b.isVertical ? 'left' : 'center'};
                white-space: pre;
                z-index: 2;
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
      // Dispatch to canvas or screenshot method based on options
      const blob = await compositeDispatch(imageState, options);
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
        // Dispatch to canvas or screenshot method based on options
        const blob = await compositeDispatch(img, options);
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

// ── Persistent screenshot DOM container ──
let _screenshotWrapper: HTMLDivElement | null = null;
let _screenshotContainer: HTMLDivElement | null = null;
let _screenshotFontStyle: HTMLStyleElement | null = null;
let _screenshotInitPromise: Promise<void> | null = null;

/** Check if the persistent screenshot container is ready (fonts loaded) */
export const isScreenshotReady = (): boolean => _screenshotWrapper !== null && _screenshotInitPromise === null;

/**
 * Initialize the persistent hidden DOM container for screenshot export.
 * Pre-fetches and inlines ALL font @font-face as base64.
 * Call this when user switches to screenshot export mode.
 */
export const initScreenshotContainer = (): Promise<void> => {
    if (_screenshotWrapper) return Promise.resolve();
    if (_screenshotInitPromise) return _screenshotInitPromise;

    _screenshotInitPromise = (async () => {
        // Pre-fetch all fonts
        const allFamilies = new Set(FONTS.map(f => f.googleFontName));
        const fontCSS = await getInlinedFontCSS(allFamilies);

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `position: fixed; top: -99999px; left: -99999px; overflow: hidden;`;
        document.body.appendChild(wrapper);

        const container = document.createElement('div');
        container.style.cssText = `position: relative; overflow: hidden;`;
        wrapper.appendChild(container);

        // Inject font CSS once — persists across exports
        if (fontCSS) {
            const styleEl = document.createElement('style');
            styleEl.textContent = fontCSS;
            container.appendChild(styleEl);
            _screenshotFontStyle = styleEl;
        }

        _screenshotWrapper = wrapper;
        _screenshotContainer = container;
        _screenshotInitPromise = null;
    })();

    return _screenshotInitPromise;
};

/**
 * Destroy the persistent screenshot DOM container.
 * Call this when user switches away from screenshot export mode.
 */
export const destroyScreenshotContainer = () => {
    if (_screenshotWrapper) {
        document.body.removeChild(_screenshotWrapper);
        _screenshotWrapper = null;
        _screenshotContainer = null;
        _screenshotFontStyle = null;
    }
};

/**
 * Screenshot-based export: builds a hidden DOM at original image resolution,
 * replicates the exact same CSS rendering as BubbleLayer.tsx, then captures it.
 * Guarantees WYSIWYG output.
 */
export const compositeImageWithScreenshot = async (imageState: ImageState, options?: ExportOptions): Promise<Blob | null> => {
    const { width, height, bubbles } = imageState;

    // Ensure persistent container is ready (instant if already initialized)
    await initScreenshotContainer();
    const container = _screenshotContainer!;

    // Set container size for this image
    container.style.width = `${Math.floor(width)}px`;
    container.style.height = `${Math.floor(height)}px`;

    // Clear previous content (keep the <style> element)
    while (container.lastChild && container.lastChild !== _screenshotFontStyle) {
        container.removeChild(container.lastChild);
    }

    try {
        // Background image — convert to base64 data URL for modern-screenshot compatibility
        const bgSrc = imageState.inpaintedUrl || imageState.originalUrl || imageState.url || `data:image/png;base64,${imageState.base64}`;
        let bgDataUrl: string;
        if (bgSrc.startsWith('data:')) {
            bgDataUrl = bgSrc;
        } else {
            const tmpImg = await loadImage(bgSrc);
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = Math.floor(width);
            tmpCanvas.height = Math.floor(height);
            const tmpCtx = tmpCanvas.getContext('2d')!;
            tmpCtx.drawImage(tmpImg, 0, 0, tmpCanvas.width, tmpCanvas.height);
            bgDataUrl = tmpCanvas.toDataURL('image/png');
        }

        const bgDiv = document.createElement('div');
        bgDiv.style.cssText = `
            width: 100%; height: 100%;
            background-image: url("${bgDataUrl}");
            background-size: 100% 100%;
        `;
        container.appendChild(bgDiv);

        // 3. Overlay container with container-type for cqw units
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            pointer-events: none;
            container-type: inline-size;
        `;
        container.appendChild(overlay);

        // 4. Filled masks
        if (imageState.maskRegions) {
            imageState.maskRegions.forEach(m => {
                if (m.isCleaned && m.method === 'fill') {
                    const maskDiv = document.createElement('div');
                    maskDiv.style.cssText = `
                        position: absolute; z-index: 1;
                        top: ${m.y}%; left: ${m.x}%;
                        width: ${m.width}%; height: ${m.height}%;
                        transform: translate(-50%, -50%);
                        background-color: ${m.fillColor || '#ffffff'};
                    `;
                    overlay.appendChild(maskDiv);
                }
            });
        }

        // 5. Bubbles — replicate BubbleLayer.tsx CSS exactly
        // PLACEHOLDER_BUBBLE_RENDERING
        bubbles.forEach(b => {
            const shape = b.maskShape || options?.defaultMaskShape || 'ellipse';
            const radiusVal = b.maskCornerRadius !== undefined ? b.maskCornerRadius : (options?.defaultMaskCornerRadius || 15);
            const featherVal = b.maskFeather !== undefined ? b.maskFeather : (options?.defaultMaskFeather || 10);

            let borderRadius = '0%';
            if (shape === 'ellipse') borderRadius = '50%';
            else if (shape === 'rounded') borderRadius = `${radiusVal}%`;

            const blur = `calc(${featherVal * 0.15}cqw)`;
            const spread = `calc(${featherVal * 0.08}cqw)`;
            const boxShadow = (b.backgroundColor !== 'transparent' && featherVal > 0)
                ? `0 0 ${blur} ${spread} ${b.backgroundColor}`
                : 'none';

            const strokeColor = b.strokeColor && b.strokeColor !== 'transparent' ? b.strokeColor : '#ffffff';

            // Outer container
            const outer = document.createElement('div');
            outer.style.cssText = `
                position: absolute; z-index: 10;
                top: ${b.y}%; left: ${b.x}%;
                width: ${b.width}%; height: ${b.height}%;
                transform: translate(-50%, -50%) rotate(${b.rotation}deg);
            `;

            // Background div
            const bgDiv = document.createElement('div');
            bgDiv.style.cssText = `
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background-color: ${b.backgroundColor};
                border-radius: ${borderRadius};
                box-shadow: ${boxShadow};
            `;
            outer.appendChild(bgDiv);

            // Text div
            const textDiv = document.createElement('div');
            textDiv.style.cssText = `
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                display: flex; align-items: center; justify-content: center;
                font-size: ${b.fontSize * 2}cqw;
                font-weight: ${b.fontFamily === 'noto-bold' ? '900' : 'bold'};
                font-family: ${getFontStack(b.fontFamily)};
                color: ${b.color};
                writing-mode: ${b.isVertical ? 'vertical-rl' : 'horizontal-tb'};
                ${b.isVertical ? 'text-orientation: mixed;' : ''}
                white-space: pre;
                line-height: 1.5;
                text-align: ${b.isVertical ? 'start' : 'center'};
                -webkit-text-stroke: 3px ${strokeColor};
                paint-order: stroke fill;
                overflow: visible;
            `;
            textDiv.textContent = b.text;
            outer.appendChild(textDiv);

            overlay.appendChild(outer);
        });

        // 6. Capture with modern-screenshot
        const dataUrl = await domToPng(container, {
            width: Math.floor(width),
            height: Math.floor(height),
            scale: 1,
        });

        if (!dataUrl) return null;

        // 7. Convert data URL to Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        return blob;

    } finally {
        // 8. Clear content but keep the persistent container and font style
        while (container.lastChild && container.lastChild !== _screenshotFontStyle) {
            container.removeChild(container.lastChild);
        }
    }
};

/**
 * Dispatcher: routes to canvas or screenshot export based on options.
 */
export const compositeDispatch = async (imageState: ImageState, options?: ExportOptions): Promise<Blob | null> => {
    if (options?.exportMethod === 'screenshot') {
        return compositeImageWithScreenshot(imageState, options);
    }
    return compositeImageWithCanvas(imageState, options);
};
