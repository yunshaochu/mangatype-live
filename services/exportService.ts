
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
// In-memory cache: already-fetched woff2 URLs → base64 data URLs
const _woff2DataUrlCache = new Map<string, string>();

// ── IndexedDB persistent font cache ──
const IDB_NAME = 'mangatype_font_cache';
const IDB_STORE = 'fonts';
const IDB_VERSION = 1;

const openFontDB = (): Promise<IDBDatabase | null> => {
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
};

const idbGet = async (key: string): Promise<string | null> => {
    const db = await openFontDB();
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
};

const idbPut = async (key: string, value: string): Promise<void> => {
    const db = await openFontDB();
    if (!db) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            store.put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
};

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
    const CHUNK = 32 * 1024; // 32KB per chunk
    const lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const parts: string[] = [];

    // Process in 3-byte aligned chunks for clean base64 boundaries
    const totalTriplets = Math.ceil(bytes.byteLength / 3);
    const tripletsPerChunk = Math.ceil(CHUNK / 3);

    for (let t = 0; t < totalTriplets; t += tripletsPerChunk) {
        let chunk = '';
        const endTriplet = Math.min(t + tripletsPerChunk, totalTriplets);
        for (let i = t; i < endTriplet; i++) {
            const idx = i * 3;
            const a = bytes[idx] || 0;
            const b = idx + 1 < bytes.byteLength ? bytes[idx + 1] : 0;
            const c = idx + 2 < bytes.byteLength ? bytes[idx + 2] : 0;
            const triplet = (a << 16) | (b << 8) | c;
            chunk += lookup[(triplet >> 18) & 0x3f];
            chunk += lookup[(triplet >> 12) & 0x3f];
            chunk += idx + 1 < bytes.byteLength ? lookup[(triplet >> 6) & 0x3f] : '=';
            chunk += idx + 2 < bytes.byteLength ? lookup[triplet & 0x3f] : '=';
        }
        parts.push(chunk);
        // Yield to main thread between chunks
        if (endTriplet < totalTriplets) {
            await new Promise(r => setTimeout(r, 0));
        }
    }
    return parts.join('');
};

/** Fetch a woff2 URL and return base64 data URL (with in-memory caching) */
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
    exportSkippedAsOriginal?: boolean;
}

const sourceToBlob = async (src: string, width: number, height: number): Promise<Blob | null> => {
    if (!src) return null;
    if (src.startsWith('data:') || src.startsWith('blob:')) {
        const response = await fetch(src);
        return response.blob();
    }

    const img = await loadImage(src);
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
};

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
 * Finds bounding rectangles for each connected text component in a mask image.
 * Used for precise fill: fills per-character bounding rects instead of raw mask pixels,
 * ensuring complete coverage even when the mask has small gaps inside strokes.
 *
 * @param maskBase64 - Base64-encoded grayscale mask image (white = text)
 * @param dilateRadius - Pixels to dilate before BFS, bridges gaps within one character (default 2)
 * @param padding - Pixels to expand each bounding rect on all sides (default 2)
 * @returns Array of rects as proportions (0–1) of the mask image dimensions
 */
export const computeContourRects = async (
    maskBase64: string,
    dilateRadius = 2,
    padding = 2
): Promise<Array<{x: number; y: number; w: number; h: number}>> => {
    try {
        const img = await loadImage(`data:image/png;base64,${maskBase64}`);
        const W = img.width, H = img.height;
        if (W === 0 || H === 0) return [];

        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const raw = ctx.getImageData(0, 0, W, H).data;

        // Binary mask: luminance > 128 → text pixel
        const mask = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) {
            mask[i] = (raw[i*4] + raw[i*4+1] + raw[i*4+2]) / 3 > 128 ? 1 : 0;
        }

        // Box dilation — bridges minor stroke gaps within the same character
        const dilated = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (!mask[y * W + x]) continue;
                const y0 = Math.max(0, y - dilateRadius);
                const y1 = Math.min(H - 1, y + dilateRadius);
                const x0 = Math.max(0, x - dilateRadius);
                const x1 = Math.min(W - 1, x + dilateRadius);
                for (let dy = y0; dy <= y1; dy++)
                    for (let dx = x0; dx <= x1; dx++)
                        dilated[dy * W + dx] = 1;
            }
        }

        // BFS connected components (8-connectivity)
        const visited = new Uint8Array(W * H);
        const rects: Array<{x: number; y: number; w: number; h: number}> = [];
        const DIRS = [-W-1,-W,-W+1,-1,1,W-1,W,W+1]; // 8-neighbours as flat index offsets
        const edgeCheck = [-1, -1, -1, -1, 1, 1, 1, 1]; // not used, kept for clarity

        for (let si = 0; si < W * H; si++) {
            if (!dilated[si] || visited[si]) continue;

            const queue = new Int32Array(W * H);
            let head = 0, tail = 0;
            queue[tail++] = si;
            visited[si] = 1;

            let minX = si % W, maxX = minX;
            let minY = (si / W) | 0, maxY = minY;

            while (head < tail) {
                const ci = queue[head++];
                const cx = ci % W, cy = (ci / W) | 0;

                // 8-connectivity manual (avoids edge wrapping from flat offsets)
                for (let dy = -1; dy <= 1; dy++) {
                    const ny = cy + dy;
                    if (ny < 0 || ny >= H) continue;
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = cx + dx;
                        if (nx < 0 || nx >= W) continue;
                        const ni = ny * W + nx;
                        if (!dilated[ni] || visited[ni]) continue;
                        visited[ni] = 1;
                        queue[tail++] = ni;
                        if (nx < minX) minX = nx;
                        if (nx > maxX) maxX = nx;
                        if (ny < minY) minY = ny;
                        if (ny > maxY) maxY = ny;
                    }
                }
            }

            // Expand bounding rect by padding, clamp to image
            const rx  = Math.max(0,     minX - padding);
            const ry  = Math.max(0,     minY - padding);
            const rx2 = Math.min(W - 1, maxX + padding);
            const ry2 = Math.min(H - 1, maxY + padding);
            const rw  = rx2 - rx + 1;
            const rh  = ry2 - ry + 1;

            // Filter tiny noise components
            if (rw >= 4 && rh >= 4) {
                rects.push({ x: rx / W, y: ry / H, w: rw / W, h: rh / H });
            }
        }

        return rects;
    } catch {
        return [];
    }
};

/** Convert a grayscale-RGB mask image to an RGBA image where luminance → alpha channel.
 *  This lets Canvas `source-in` work correctly with masks that have no alpha (alpha=255 everywhere).
 *  Returns an offscreen canvas whose pixels have R=G=B=255, A=luminance.
 */
const luminanceMaskToAlpha = (maskImg: HTMLImageElement, W: number, H: number): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(maskImg, 0, 0, W, H);
    const idata = ctx.getImageData(0, 0, W, H);
    const d = idata.data;
    for (let i = 0; i < d.length; i += 4) {
        const lum = Math.round((d[i] + d[i+1] + d[i+2]) / 3);
        d[i] = 255; d[i+1] = 255; d[i+2] = 255;
        d[i+3] = lum; // white pixel where text is, transparent where not
    }
    ctx.putImageData(idata, 0, 0);
    return c;
};

type ExportFillRenderMode = 'skip' | 'rect' | 'contour';

/** Shared export decision: normalize fill semantics across all export paths. */
const resolveExportFillRenderMode = (m: MaskRegion): ExportFillRenderMode => {
    if (!m.isCleaned || m.method !== 'fill') return 'skip';
    if (m.fillMode === 'baked') return 'skip';
    if (m.fillMode === 'contour' && m.maskContourW !== undefined && m.maskContourH !== undefined) {
        return 'contour';
    }
    return 'rect';
};

const drawFillMaskOnCanvas = async (
    ctx: CanvasRenderingContext2D,
    m: MaskRegion,
    width: number,
    height: number
): Promise<void> => {
    const fillMode = resolveExportFillRenderMode(m);
    if (fillMode === 'skip') return;

    const x = (m.x / 100) * width;
    const y = (m.y / 100) * height;
    const w = (m.width / 100) * width;
    const h = (m.height / 100) * height;

    if (fillMode === 'contour') {
        const maskW_px = (m.maskContourW! / 100) * width;
        const maskH_px = (m.maskContourH! / 100) * height;
        const maskOriginX = x - maskW_px / 2;
        const maskOriginY = y - maskH_px / 2;

        if (m.maskContourRects && m.maskContourRects.length > 0) {
            // useCharRects=true: per-character bounding rects
            ctx.fillStyle = m.fillColor || '#ffffff';
            for (const r of m.maskContourRects) {
                ctx.fillRect(
                    maskOriginX + r.x * maskW_px,
                    maskOriginY + r.y * maskH_px,
                    r.w * maskW_px,
                    r.h * maskH_px
                );
            }
            return;
        }

        // useCharRects=false: dilated contour mask via source-in
        const contourSrc = m.maskContourDilatedBase64 || m.maskContourBase64;
        if (contourSrc) {
            const offscreen = document.createElement('canvas');
            offscreen.width = Math.ceil(maskW_px);
            offscreen.height = Math.ceil(maskH_px);
            const offCtx = offscreen.getContext('2d')!;
            const contourImg = await loadImage(`data:image/png;base64,${contourSrc}`);
            const alphaCanvas = luminanceMaskToAlpha(contourImg, offscreen.width, offscreen.height);
            offCtx.drawImage(alphaCanvas, 0, 0);
            offCtx.globalCompositeOperation = 'source-in';
            offCtx.fillStyle = m.fillColor || '#ffffff';
            offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
            ctx.drawImage(offscreen, maskOriginX, maskOriginY);
            return;
        }
    }

    ctx.fillStyle = m.fillColor || '#ffffff';
    ctx.fillRect(x - w/2, y - h/2, w, h);
};

const appendFillMaskOverlayToDom = (overlay: HTMLDivElement, m: MaskRegion): void => {
    const fillMode = resolveExportFillRenderMode(m);
    if (fillMode === 'skip') return;

    if (fillMode === 'contour') {
        const maskLeft = m.x - m.maskContourW! / 2;
        const maskTop  = m.y - m.maskContourH! / 2;

        if (m.maskContourRects && m.maskContourRects.length > 0) {
            // useCharRects=true: per-character bounding rects
            for (const r of m.maskContourRects) {
                const rectDiv = document.createElement('div');
                rectDiv.style.cssText = `
                    position: absolute; z-index: 1;
                    left: ${maskLeft + r.x * m.maskContourW!}%;
                    top:  ${maskTop  + r.y * m.maskContourH!}%;
                    width: ${r.w * m.maskContourW!}%;
                    height: ${r.h * m.maskContourH!}%;
                    background-color: ${m.fillColor || '#ffffff'};
                `;
                overlay.appendChild(rectDiv);
            }
            return;
        }

        // useCharRects=false: dilated contour mask via CSS mask-image
        const contourSrc = m.maskContourDilatedBase64 || m.maskContourBase64;
        const maskDiv = document.createElement('div');
        if (contourSrc) {
            maskDiv.style.cssText = `
                position: absolute; z-index: 1;
                top: ${m.y}%; left: ${m.x}%;
                width: ${m.maskContourW}%; height: ${m.maskContourH}%;
                transform: translate(-50%, -50%);
                -webkit-mask-image: url(data:image/png;base64,${contourSrc});
                mask-image: url(data:image/png;base64,${contourSrc});
                -webkit-mask-size: 100% 100%; mask-size: 100% 100%;
                -webkit-mask-mode: luminance; mask-mode: luminance;
                background-color: ${m.fillColor || '#ffffff'};
            `;
        } else {
            maskDiv.style.cssText = `
                position: absolute; z-index: 1;
                top: ${m.y}%; left: ${m.x}%;
                width: ${m.width}%; height: ${m.height}%;
                transform: translate(-50%, -50%);
                background-color: ${m.fillColor || '#ffffff'};
            `;
        }
        overlay.appendChild(maskDiv);
        return;
    }

    const maskDiv = document.createElement('div');
    maskDiv.style.cssText = `
        position: absolute; z-index: 1;
        top: ${m.y}%; left: ${m.x}%;
        width: ${m.width}%; height: ${m.height}%;
        transform: translate(-50%, -50%);
        background-color: ${m.fillColor || '#ffffff'};
    `;
    overlay.appendChild(maskDiv);
};

/** Shared helper: box-dilation on a binary Uint8Array mask (in-place → new array). */
const _dilateBinary = (mask: Uint8Array, W: number, H: number, radius: number): Uint8Array => {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (!mask[y * W + x]) continue;
            const y0 = Math.max(0, y - radius), y1 = Math.min(H - 1, y + radius);
            const x0 = Math.max(0, x - radius), x1 = Math.min(W - 1, x + radius);
            for (let ny = y0; ny <= y1; ny++)
                for (let nx = x0; nx <= x1; nx++)
                    out[ny * W + nx] = 1;
        }
    }
    return out;
};

/**
 * Dilates a grayscale binary mask image and returns the result as a base64 PNG.
 * Used for "pure contour" fill mode — thickens text pixels by ~radius pixels.
 */
export const dilateMaskImage = async (maskBase64: string, radius = 3): Promise<string> => {
    const img = await loadImage(`data:image/png;base64,${maskBase64}`);
    const W = img.width, H = img.height;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const raw = ctx.getImageData(0, 0, W, H).data;

    const srcMask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
        srcMask[i] = (raw[i * 4] + raw[i * 4 + 1] + raw[i * 4 + 2]) / 3 > 128 ? 1 : 0;
    }

    const dilated = _dilateBinary(srcMask, W, H, radius);

    const out = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
        const v = dilated[i] ? 255 : 0;
        out.data[i * 4]     = v;
        out.data[i * 4 + 1] = v;
        out.data[i * 4 + 2] = v;
        out.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
};

/**
 * Pre-fills text contour pixels (white) onto the source image before inpainting.
 * Helps IOPaint API remove stroke pixels more thoroughly.
 */
export const applyContourPreFill = async (
    srcBase64: string,
    masks: MaskRegion[],
    W: number,
    H: number
): Promise<string> => {
    const srcUrl = srcBase64.startsWith('data:') ? srcBase64 : `data:image/png;base64,${srcBase64}`;
    const srcImg = await loadImage(srcUrl);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(srcImg, 0, 0, W, H);

    for (const m of masks) {
        if (!m.maskContourBase64) continue;
        // Use dilated contour (if available) for better coverage
        const contourBase64 = m.maskContourDilatedBase64 || m.maskContourBase64;
        const maskImg = await loadImage(`data:image/png;base64,${contourBase64}`);

        const mW = ((m.maskContourW ?? m.width) / 100) * W;
        const mH = ((m.maskContourH ?? m.height) / 100) * H;
        const mX = (m.x / 100) * W - mW / 2;
        const mY = (m.y / 100) * H - mH / 2;

        // offscreen: apply source-in to paint white only over text pixels
        const off = document.createElement('canvas');
        off.width = Math.ceil(mW); off.height = Math.ceil(mH);
        const offCtx = off.getContext('2d')!;
        const alphaCanvas = luminanceMaskToAlpha(maskImg, off.width, off.height);
        offCtx.drawImage(alphaCanvas, 0, 0);
        offCtx.globalCompositeOperation = 'source-in';
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, off.width, off.height);

        ctx.drawImage(off, mX, mY);
    }

    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
};

/**
 * Bakes precise contour fills directly into the image pixels for a set of masks.
 * Returns the new full-image base64 PNG (no data: prefix).
 * Used when usePreciseFill=true so the result is a real pixel-modified image,
 * not a CSS overlay — making it compatible with freehand brush and export.
 */
export const bakeContourFillsIntoImage = async (
    srcBase64: string,
    masks: MaskRegion[],
    W: number,
    H: number,
    color: string,
    useCharRects: boolean,
): Promise<string> => {
    const srcUrl = srcBase64.startsWith('data:') ? srcBase64 : `data:image/png;base64,${srcBase64}`;
    const srcImg = await loadImage(srcUrl);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(srcImg, 0, 0, W, H);

    for (const m of masks) {
        if (!m.maskContourBase64 || m.maskContourW === undefined || m.maskContourH === undefined) continue;
        const maskW_px = (m.maskContourW / 100) * W;
        const maskH_px = (m.maskContourH / 100) * H;
        const maskOriginX = (m.x / 100) * W - maskW_px / 2;
        const maskOriginY = (m.y / 100) * H - maskH_px / 2;

        if (useCharRects && m.maskContourRects && m.maskContourRects.length > 0) {
            ctx.fillStyle = color;
            for (const r of m.maskContourRects) {
                ctx.fillRect(
                    maskOriginX + r.x * maskW_px,
                    maskOriginY + r.y * maskH_px,
                    r.w * maskW_px,
                    r.h * maskH_px
                );
            }
        } else {
            const contourSrc = m.maskContourDilatedBase64 || m.maskContourBase64;
            const offscreen = document.createElement('canvas');
            offscreen.width = Math.ceil(maskW_px);
            offscreen.height = Math.ceil(maskH_px);
            const offCtx = offscreen.getContext('2d')!;
            const contourImg = await loadImage(`data:image/png;base64,${contourSrc}`);
            const alphaCanvas = luminanceMaskToAlpha(contourImg, offscreen.width, offscreen.height);
            offCtx.drawImage(alphaCanvas, 0, 0);
            offCtx.globalCompositeOperation = 'source-in';
            offCtx.fillStyle = color;
            offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
            ctx.drawImage(offscreen, maskOriginX, maskOriginY);
        }
    }

    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
};


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
 * When drawBoxes is true, also draws red box borders (expanding clip to include full stroke).
 */
export const generateMaskedImage = async (image: ImageState, drawBoxes: boolean = false): Promise<string> => {
    const img = await loadImage(image.originalUrl || image.url);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return image.base64;

    const strokeWidth = Math.max(2, Math.round(Math.min(img.width, img.height) / 200));
    // When drawing boxes, expand clip by half stroke width so the full border is visible
    const expand = drawBoxes ? Math.ceil(strokeWidth / 2) + 1 : 0;

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
             ctx.rect(x - w/2 - expand, y - h/2 - expand, w + expand * 2, h + expand * 2);
        });
        ctx.clip();
        ctx.drawImage(img, 0, 0);
        ctx.restore();

        if (drawBoxes) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = strokeWidth;
            image.maskRegions.forEach(m => {
                const x = (m.x / 100) * canvas.width;
                const y = (m.y / 100) * canvas.height;
                const w = (m.width / 100) * canvas.width;
                const h = (m.height / 100) * canvas.height;
                ctx.strokeRect(x - w/2, y - h/2, w, h);
            });
        }
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
        for (const m of imageState.maskRegions) {
            await drawFillMaskOnCanvas(ctx, m, width, height);
        }
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
                line-height: ${b.lineHeight ?? 1.1};
                letter-spacing: ${b.letterSpacing ?? 0.15}em;
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
                innerBlock.style.cssText = `white-space: pre; writing-mode: vertical-rl; text-orientation: mixed; line-height: ${b.lineHeight ?? 1.1}; letter-spacing: ${b.letterSpacing ?? 0.15}em;`;
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
                (ctx as any).letterSpacing = `${b.letterSpacing ?? 0.15}em`;
            }

            const lines = b.text.split('\n');
            const lineHeight = fontSize * (b.lineHeight ?? 1.1);

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
                line-height: ${b.lineHeight ?? 1.1};
                letter-spacing: ${b.letterSpacing ?? 0.15}em;
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
            for (const m of imageState.maskRegions) {
                const fillMode = resolveExportFillRenderMode(m);
                if (fillMode === 'skip') continue;
                    const x = (m.x / 100) * width;
                    const y = (m.y / 100) * height;
                    const w = (m.width / 100) * width;
                    const h = (m.height / 100) * height;
                    if (fillMode === 'contour' && m.maskContourRects && m.maskContourW !== undefined && m.maskContourH !== undefined) {
                        ctx.fillStyle = m.fillColor || '#ffffff';
                        const maskW_px = (m.maskContourW / 100) * width;
                        const maskH_px = (m.maskContourH / 100) * height;
                        const maskOriginX = x - maskW_px / 2;
                        const maskOriginY = y - maskH_px / 2;
                        for (const r of m.maskContourRects) {
                            ctx.fillRect(
                                maskOriginX + r.x * maskW_px,
                                maskOriginY + r.y * maskH_px,
                                r.w * maskW_px,
                                r.h * maskH_px
                            );
                        }
                    } else {
                        ctx.fillStyle = m.fillColor || '#ffffff';
                        ctx.fillRect(x - w/2, y - h/2, w, h);
                    }
            }
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
    options?: ExportOptions,
    shouldCancel?: () => boolean
) => {
  const zip = new JSZip();
  const folder = zip.folder("typeset_manga");
  let successCount = 0;
  const total = images.length;

  for (let i = 0; i < total; i++) {
    // Check for cancellation before processing each image
    if (shouldCancel && shouldCancel()) {
      console.log(`Zip export cancelled at ${i}/${total}`);
      return;
    }

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

/** Clear all cached font data (IndexedDB + in-memory) */
export const clearFontCache = async (): Promise<void> => {
    // Clear in-memory caches
    _woff2DataUrlCache.clear();
    _fontFaceBlocksCache = null;
    // Destroy persistent DOM container
    destroyScreenshotContainer();
    // Delete IndexedDB database
    return new Promise((resolve) => {
        try {
            const req = indexedDB.deleteDatabase(IDB_NAME);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        } catch {
            resolve();
        }
    });
};

/**
 * Initialize the persistent hidden DOM container for screenshot export.
 * Pre-fetches and inlines ALL font @font-face as base64.
 * Call this when user switches to screenshot export mode.
 */
const IDB_ALL_FONTS_KEY = 'all_fonts_css';

export const initScreenshotContainer = (): Promise<void> => {
    if (_screenshotWrapper) return Promise.resolve();
    if (_screenshotInitPromise) return _screenshotInitPromise;

    _screenshotInitPromise = (async () => {
        // Try to load pre-built CSS from IndexedDB first
        let fontCSS = await idbGet(IDB_ALL_FONTS_KEY);

        if (!fontCSS) {
            // No cache — fetch all fonts and build CSS
            const allFamilies = new Set(FONTS.map(f => f.googleFontName));
            fontCSS = await getInlinedFontCSS(allFamilies);
            // Persist to IndexedDB for next time
            if (fontCSS) {
                await idbPut(IDB_ALL_FONTS_KEY, fontCSS);
            }
        }

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `position: fixed; top: -99999px; left: -99999px; overflow: hidden;`;
        document.body.appendChild(wrapper);

        const container = document.createElement('div');
        container.style.cssText = `position: relative; overflow: hidden;`;
        wrapper.appendChild(container);

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
                appendFillMaskOverlayToDom(overlay, m);
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
                line-height: ${b.lineHeight ?? 1.1};
                letter-spacing: ${b.letterSpacing ?? 0.15}em;
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
    // Optional behavior: skipped images can be exported as untouched original.
    if (options?.exportSkippedAsOriginal && imageState.skipped) {
        const originalSrc = imageState.originalUrl
            || imageState.url
            || (imageState.originalBase64 ? imageState.originalBase64 : `data:image/png;base64,${imageState.base64}`);
        return sourceToBlob(originalSrc, imageState.width, imageState.height);
    }

    if (options?.exportMethod === 'screenshot') {
        return compositeImageWithScreenshot(imageState, options);
    }
    return compositeImageWithCanvas(imageState, options);
};
