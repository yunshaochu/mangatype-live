import { ImageState, Bubble, MaskRegion, getFontStack } from '../types';
import JSZip from 'jszip';

// ─── Types ───

export interface HtmlExportOptions {
  mode: 'single' | 'folder';      // 单HTML or HTML+文件夹(ZIP)
  imageQuality: number;            // 0.0 ~ 1.0, JPEG quality for single HTML mode
  reduceImageSize: boolean;        // 是否缩小图片尺寸（单HTML模式）
  maxImageDimension: number;       // 最大图片边长（缩小用）
}

const DEFAULT_EXPORT_OPTIONS: HtmlExportOptions = {
  mode: 'folder',
  imageQuality: 0.8,
  reduceImageSize: false,
  maxImageDimension: 1600,
};

// ─── Helpers ───

const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeJs = (str: string) => str
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r');

/** Convert a data URL or blob URL to a Blob */
const urlToBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  return response.blob();
};

/** Convert data URL to base64 string (without prefix) */
const dataUrlToBase64 = (dataUrl: string): string => {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
};

/** Resize an image blob to fit within maxDim, returns data URL */
const resizeImage = async (blob: Blob, maxDim: number, quality: number): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w <= maxDim && h <= maxDim) {
        // No resize needed, just re-encode as JPEG
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', quality));
        return;
      }
      const scale = Math.min(maxDim / w, maxDim / h);
      const nw = Math.round(w * scale);
      const nh = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, nw, nh);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = URL.createObjectURL(blob);
  });
};

// ─── Project Data Serialization ───

interface SerializableImageState {
  id: string;
  name: string;
  width: number;
  height: number;
  bubbles: Bubble[];
  maskRegions?: MaskRegion[];
  contourSchemaVersion?: number;
  // Image sources will be handled separately (embedded or file path)
  originalImageIdx: number;   // index into the images array
  inpaintedImageIdx: number;  // -1 if no inpainted image
  currentImageIdx: number;    // index for the "url/base64" image
  skipped?: boolean;
  status: string;
  detectionStatus?: string;
  inpaintingStatus?: string;
  errorMessage?: string;
}

const serializeProjectData = (images: ImageState[]): { pages: SerializableImageState[] } => {
  const pages = images.map((img, idx) => ({
    id: img.id,
    name: img.name,
    width: img.width,
    height: img.height,
    bubbles: img.bubbles,
    maskRegions: img.maskRegions,
    contourSchemaVersion: img.contourSchemaVersion,
    originalImageIdx: idx,
    inpaintedImageIdx: img.inpaintedBase64 ? idx : -1,
    currentImageIdx: idx,
    skipped: img.skipped,
    status: img.status,
    detectionStatus: img.detectionStatus,
    inpaintingStatus: img.inpaintingStatus,
    errorMessage: img.errorMessage,
  }));
  return { pages };
};

// ─── Reader HTML Generator ───

const generateReaderHTML = (
  pagesData: { pages: SerializableImageState[] },
  imageSources: string[],  // data URLs or relative paths
  originalSources: string[],
  isSingleHTML: boolean
): string => {
  const pagesJson = JSON.stringify(pagesData);

  // Build image source mapping for the reader JS
  const imageSrcMap: Record<number, string> = {};
  const originalSrcMap: Record<number, string> = {};
  pagesData.pages.forEach((p, i) => {
    imageSrcMap[i] = imageSources[i];
    originalSrcMap[i] = originalSources[i] || imageSources[i];
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Manga Reader</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #111; color: #eee; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; }

/* ─── Top Bar ─── */
#topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  height: 44px; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: space-between; padding: 0 12px;
  transition: transform 0.3s; user-select: none;
}
#topbar.hidden { transform: translateY(-100%); }
#topbar .nav-btn {
  background: none; border: none; color: #aaa; font-size: 22px; cursor: pointer;
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; transition: all 0.2s;
}
#topbar .nav-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
#topbar .nav-btn:disabled { opacity: 0.3; cursor: default; }
#page-info { font-size: 13px; color: #ccc; min-width: 80px; text-align: center; }
#controls { display: flex; gap: 4px; align-items: center; }
.mode-btn {
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
  color: #aaa; font-size: 11px; padding: 4px 10px; border-radius: 4px; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
}
.mode-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
.mode-btn.active { background: rgba(100,140,255,0.3); border-color: rgba(100,140,255,0.6); color: #fff; }

/* ─── Main Viewport ─── */
#viewport {
  width: 100%; height: 100%; position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}

/* Page mode: single page display */
#page-container {
  position: relative; display: inline-block;
  max-width: 100%; max-height: 100%;
  transition: opacity 0.2s;
}
#page-container img {
  display: block; max-width: 100vw; max-height: 100vh;
  object-fit: contain;
}

/* Scroll mode: vertical scroll */
#viewport.scroll-mode {
  overflow-y: auto; align-items: flex-start; justify-content: center;
}
#viewport.scroll-mode #page-container {
  max-width: 100%; max-height: none;
}
#viewport.scroll-mode #page-container img {
  max-width: 100vw; max-height: none; width: 100%;
}

/* ─── Bubble Overlay ─── */
#bubble-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 10;
}
#bubble-overlay.visible .bubble-wrap {
  opacity: 1; pointer-events: auto;
}
.bubble-wrap {
  position: absolute; transform: translate(-50%, -50%) rotate(var(--rot, 0deg));
  opacity: 0; pointer-events: none; transition: opacity 0.25s;
}
.bubble-bg {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  border-radius: var(--radius, 0);
  background-color: var(--bg-color, #ffffff);
  box-shadow: var(--shadow, none);
}
.bubble-text {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold; white-space: pre; overflow: visible;
  writing-mode: var(--wm, horizontal-tb);
  text-orientation: var(--to, mixed);
  line-height: var(--lh, 1.1);
  letter-spacing: var(--ls, 0.15em);
  text-align: var(--ta, center);
  color: var(--color, #000);
  -webkit-text-stroke: var(--stroke, 2px #fff);
  paint-order: stroke fill;
  font-size: var(--fs, 16px);
  font-family: var(--ff, sans-serif);
}

/* ─── Click Zones (for page turning) ─── */
#click-zone-left, #click-zone-right {
  position: absolute; top: 0; width: 30%; height: 100%; z-index: 5; cursor: pointer;
}
#click-zone-left { left: 0; }
#click-zone-right { right: 0; }
#click-zone-center {
  position: absolute; top: 0; left: 30%; width: 40%; height: 100%; z-index: 5; cursor: pointer;
}

/* ─── Bottom Progress ─── */
#bottombar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
  height: 36px; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
  display: flex; align-items: center; padding: 0 12px; gap: 8px;
  transition: transform 0.3s; user-select: none;
}
#bottombar.hidden { transform: translateY(100%); }
#progress-bar {
  flex: 1; height: 4px; background: rgba(255,255,255,0.15); border-radius: 2px;
  cursor: pointer; position: relative;
}
#progress-fill {
  height: 100%; background: #6488ff; border-radius: 2px; transition: width 0.2s;
}
#progress-label { font-size: 11px; color: #888; min-width: 50px; text-align: right; }

/* ─── Scroll mode: individual pages ─── */
.scroll-page {
  position: relative; display: inline-block; width: 100%;
}
.scroll-page img { display: block; width: 100%; }
.scroll-page .scroll-bubble-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none;
}
.scroll-page .scroll-bubble-overlay.visible .bubble-wrap {
  opacity: 1;
}

/* ─── Loading ─── */
#loading {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: #111; display: flex; align-items: center; justify-content: center;
  z-index: 9999; font-size: 16px; color: #888;
}
#loading.hidden { display: none; }
.spinner {
  width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #6488ff; border-radius: 50%; animation: spin 0.8s linear infinite;
  margin-right: 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Hint Toast ─── */
#toast {
  position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.85); color: #eee; padding: 8px 16px; border-radius: 8px;
  font-size: 12px; z-index: 200; opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
#toast.show { opacity: 1; }
</style>
</head>
<body>

<div id="loading"><div class="spinner"></div>Loading...</div>

<div id="topbar">
  <div style="display:flex;gap:2px;">
    <button class="nav-btn" id="btn-prev" title="Previous">&#9664;</button>
    <button class="nav-btn" id="btn-next" title="Next">&#9654;</button>
  </div>
  <span id="page-info">1 / 1</span>
  <div id="controls">
    <button class="mode-btn active" data-mode="rtl">&#8592; RTL</button>
    <button class="mode-btn" data-mode="ltr">LTR &#8594;</button>
    <button class="mode-btn" data-mode="scroll">&#8593;&#8595; Scroll</button>
  </div>
</div>

<div id="viewport">
  <div id="page-container">
    <img id="page-img" src="" alt="">
    <div id="bubble-overlay"></div>
  </div>
  <div id="click-zone-left"></div>
  <div id="click-zone-center"></div>
  <div id="click-zone-right"></div>
</div>

<div id="bottombar">
  <div id="progress-bar"><div id="progress-fill" style="width:0%"></div></div>
  <span id="progress-label">0%</span>
</div>

<div id="toast"></div>

<script>
// ─── Project Data ───
const PAGES = ${pagesJson};
const IMAGE_SOURCES = ${JSON.stringify(imageSrcMap)};
const ORIGINAL_SOURCES = ${JSON.stringify(originalSrcMap)};

// ─── State ───
let currentPage = 0;
let readMode = 'rtl';  // 'rtl' | 'ltr' | 'scroll'
let showBubbles = false;
let uiVisible = true;
let scrollBubblesInjected = false;

// ─── DOM refs ───
const $loading = document.getElementById('loading');
const $topbar = document.getElementById('topbar');
const $bottombar = document.getElementById('bottombar');
const $viewport = document.getElementById('viewport');
const $pageContainer = document.getElementById('page-container');
const $pageImg = document.getElementById('page-img');
const $bubbleOverlay = document.getElementById('bubble-overlay');
const $pageInfo = document.getElementById('page-info');
const $progressFill = document.getElementById('progress-fill');
const $progressLabel = document.getElementById('progress-label');
const $toast = document.getElementById('toast');
const $btnPrev = document.getElementById('btn-prev');
const $btnNext = document.getElementById('btn-next');
const $zoneLeft = document.getElementById('click-zone-left');
const $zoneRight = document.getElementById('click-zone-right');
const $zoneCenter = document.getElementById('click-zone-center');

// ─── Toast ───
let toastTimer = null;
function showToast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 1500);
}

// ─── Render Bubbles into a container ───
function renderBubblesInto(container, page, imgWidth, imgHeight) {
  container.innerHTML = '';
  if (!page.bubbles || page.bubbles.length === 0) return;

  page.bubbles.forEach(b => {
    const xPct = b.x;
    const yPct = b.y;
    const wPct = b.width;
    const hPct = b.height;
    const fontSize = b.fontSize * 2;  // cqw-like percentage
    const fontStack = ${JSON.stringify(
      Object.fromEntries(
        ['noto','noto-bold','serif','happy','xiaowei','longcang','zhimang','liujian','mashan'].map(id => [
          id,
          getFontStack(id as any)
        ])
      )
    )}[b.fontFamily] || 'sans-serif';

    const shape = b.maskShape || 'rectangle';
    const radiusVal = b.maskCornerRadius !== undefined ? b.maskCornerRadius : 20;
    const featherVal = b.maskFeather !== undefined ? b.maskFeather : 0;
    const strokeColor = b.strokeColor && b.strokeColor !== 'transparent' ? b.strokeColor : '#ffffff';
    const bgColor = b.backgroundColor || 'transparent';

    let borderRadius = '0';
    if (shape === 'ellipse') borderRadius = '50%';
    else if (shape === 'rounded') borderRadius = radiusVal + '%';

    // Feather/shadow
    const blurPct = featherVal * 0.15;
    const spreadPct = featherVal * 0.08;
    const shadow = (bgColor !== 'transparent' && featherVal > 0)
      ? '0 0 ' + blurPct + 'vw ' + spreadPct + 'vw ' + bgColor
      : 'none';

    const wrap = document.createElement('div');
    wrap.className = 'bubble-wrap';
    wrap.style.cssText =
      'left:' + xPct + '%;top:' + yPct + '%;width:' + wPct + '%;height:' + hPct + '%;' +
      '--rot:' + b.rotation + 'deg;';

    // Background
    const bg = document.createElement('div');
    bg.className = 'bubble-bg';
    bg.style.cssText =
      '--radius:' + borderRadius + ';--bg-color:' + bgColor + ';--shadow:' + shadow + ';';
    wrap.appendChild(bg);

    // Text
    const txt = document.createElement('div');
    txt.className = 'bubble-text';
    const wm = b.isVertical ? 'vertical-rl' : 'horizontal-tb';
    const to = b.isVertical ? 'mixed' : 'mixed';
    const ta = b.isVertical ? 'start' : 'center';
    txt.style.cssText =
      '--wm:' + wm + ';--to:' + to + ';--ta:' + ta + ';' +
      '--lh:' + (b.lineHeight || 1.1) + ';--ls:' + (b.letterSpacing ?? 0.15) + 'em;' +
      '--color:' + b.color + ';--stroke:' + '2px ' + strokeColor + ';' +
      '--fs:' + fontSize + 'cqw;--ff:' + fontStack + ';';
    txt.textContent = b.text;
    wrap.appendChild(txt);

    container.appendChild(wrap);
  });
}

// ─── Page Navigation ───
function goToPage(idx, directionHint) {
  if (idx < 0 || idx >= PAGES.pages.length) return;
  currentPage = idx;
  const page = PAGES.pages[currentPage];

  // Update image
  $pageImg.src = showBubbles ? ORIGINAL_SOURCES[currentPage] : IMAGE_SOURCES[currentPage];
  $pageImg.alt = page.name;

  // Update bubbles
  renderBubblesInto($bubbleOverlay, page, page.width, page.height);
  if (showBubbles) $bubbleOverlay.classList.add('visible');
  else $bubbleOverlay.classList.remove('visible');

  // Update UI
  $pageInfo.textContent = (currentPage + 1) + ' / ' + PAGES.pages.length;
  const pct = PAGES.pages.length > 1 ? ((currentPage / (PAGES.pages.length - 1)) * 100) : 100;
  $progressFill.style.width = pct + '%';
  $progressLabel.textContent = Math.round(pct) + '%';
  $btnPrev.disabled = currentPage <= 0;
  $btnNext.disabled = currentPage >= PAGES.pages.length - 1;

  // Scroll mode: if we switch to scroll, rebuild
  if (readMode === 'scroll') buildScrollMode();
}

function nextPage() { goToPage(currentPage + 1); }
function prevPage() { goToPage(currentPage - 1); }

// ─── Click zone logic (depends on read mode) ───
function handleZoneClick(zone) {
  if (readMode === 'scroll') {
    toggleUI();
    return;
  }
  if (zone === 'center') {
    toggleBubbles();
  } else if (zone === 'left') {
    readMode === 'rtl' ? nextPage() : prevPage();
  } else {
    readMode === 'rtl' ? prevPage() : nextPage();
  }
}

$zoneLeft.addEventListener('click', () => handleZoneClick('left'));
$zoneCenter.addEventListener('click', () => handleZoneClick('center'));
$zoneRight.addEventListener('click', () => handleZoneClick('right'));

// ─── Toggle Bubbles ───
function toggleBubbles() {
  showBubbles = !showBubbles;
  if (readMode === 'scroll') {
    document.querySelectorAll('.scroll-bubble-overlay').forEach(el => {
      el.classList.toggle('visible', showBubbles);
    });
    // Switch all scroll images
    document.querySelectorAll('.scroll-page img').forEach((img, idx) => {
      img.src = showBubbles ? ORIGINAL_SOURCES[idx] : IMAGE_SOURCES[idx];
    });
  } else {
    $pageImg.src = showBubbles ? ORIGINAL_SOURCES[currentPage] : IMAGE_SOURCES[currentPage];
    $bubbleOverlay.classList.toggle('visible', showBubbles);
  }
  showToast(showBubbles ? 'Translation ON' : 'Translation OFF');
}

// ─── Toggle UI ───
function toggleUI() {
  uiVisible = !uiVisible;
  $topbar.classList.toggle('hidden', !uiVisible);
  $bottombar.classList.toggle('hidden', !uiVisible);
}

// ─── Scroll Mode ───
function buildScrollMode() {
  $viewport.classList.add('scroll-mode');
  $pageContainer.style.display = 'none';
  $zoneLeft.style.display = 'none';
  $zoneRight.style.display = 'none';
  $zoneCenter.style.display = 'none';

  // Remove old scroll pages
  $viewport.querySelectorAll('.scroll-page').forEach(el => el.remove());

  PAGES.pages.forEach((page, idx) => {
    const div = document.createElement('div');
    div.className = 'scroll-page';

    const img = document.createElement('img');
    img.src = showBubbles ? ORIGINAL_SOURCES[idx] : IMAGE_SOURCES[idx];
    img.alt = page.name;
    img.loading = 'lazy';
    div.appendChild(img);

    const overlay = document.createElement('div');
    overlay.className = 'scroll-bubble-overlay' + (showBubbles ? ' visible' : '');
    renderBubblesInto(overlay, page, page.width, page.height);
    div.appendChild(overlay);

    // Click to toggle bubbles on this page
    div.addEventListener('click', (e) => {
      if (e.target.tagName === 'IMG') toggleBubbles();
    });

    $viewport.appendChild(div);
  });

  // Scroll to current page
  const scrollPages = $viewport.querySelectorAll('.scroll-page');
  if (scrollPages[currentPage]) {
    scrollPages[currentPage].scrollIntoView({ behavior: 'auto' });
  }
}

function exitScrollMode() {
  $viewport.classList.remove('scroll-mode');
  $viewport.querySelectorAll('.scroll-page').forEach(el => el.remove());
  $pageContainer.style.display = '';
  $zoneLeft.style.display = '';
  $zoneRight.style.display = '';
  $zoneCenter.style.display = '';
}

// ─── Read Mode Switch ───
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (mode === readMode) return;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const prevMode = readMode;
    readMode = mode;

    if (mode === 'scroll') {
      buildScrollMode();
    } else {
      if (prevMode === 'scroll') exitScrollMode();
      goToPage(currentPage);
    }

    showToast(mode === 'rtl' ? 'Right to Left' : mode === 'ltr' ? 'Left to Right' : 'Scroll Mode');
  });
});

// ─── Nav Buttons ───
$btnPrev.addEventListener('click', prevPage);
$btnNext.addEventListener('click', nextPage);

// ─── Keyboard ───
document.addEventListener('keydown', (e) => {
  if (readMode === 'scroll') {
    if (e.key === ' ') { e.preventDefault(); toggleBubbles(); }
    return;
  }
  if (e.key === 'ArrowLeft') {
    readMode === 'rtl' ? nextPage() : prevPage();
  } else if (e.key === 'ArrowRight') {
    readMode === 'rtl' ? prevPage() : nextPage();
  } else if (e.key === ' ') {
    e.preventDefault();
    toggleBubbles();
  }
});

// ─── Progress Bar Click ───
document.getElementById('progress-bar').addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  const idx = Math.round(pct * (PAGES.pages.length - 1));
  goToPage(Math.max(0, Math.min(PAGES.pages.length - 1, idx)));
});

// ─── Touch swipe support ───
let touchStartX = 0;
let touchStartY = 0;
$viewport.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
$viewport.addEventListener('touchend', (e) => {
  if (readMode === 'scroll') return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < 30 || Math.abs(dy) > Math.abs(dx)) return;
  if (dx > 0) readMode === 'rtl' ? nextPage() : prevPage();
  else readMode === 'rtl' ? prevPage() : nextPage();
});

// ─── Image click for bubble toggle (non-scroll) ───
$pageImg.addEventListener('click', () => {
  toggleBubbles();
});

// ─── Init ───
function init() {
  goToPage(0);
  $loading.classList.add('hidden');
}
init();
</script>
</body>
</html>`;
};

// ─── Main Export Function ───

export const exportAsHtmlReader = async (
  images: ImageState[],
  options: HtmlExportOptions = DEFAULT_EXPORT_OPTIONS,
  onProgress?: (current: number, total: number) => void,
  shouldCancel?: () => boolean
): Promise<void> => {
  const total = images.length;
  if (total === 0) return;

  const isSingleHTML = options.mode === 'single';

  // Prepare image sources
  const imageSources: string[] = [];      // "current" image (clean/inpainted)
  const originalSources: string[] = [];   // original image

  for (let i = 0; i < total; i++) {
    if (shouldCancel && shouldCancel()) return;
    if (onProgress) onProgress(i + 1, total);

    const img = images[i];

    // Get the "current" display image (prioritize inpainted, then original, then base64)
    const currentSrc = img.inpaintedUrl || img.url || (img.base64 ? `data:image/png;base64,${img.base64}` : '');
    const originalSrc = img.originalUrl || img.url || (img.originalBase64 ? `data:image/png;base64,${img.originalBase64}` : currentSrc);

    if (isSingleHTML) {
      // Single HTML mode: embed as base64 data URLs, optionally resized
      let currentDataUrl = currentSrc;
      let originalDataUrl = originalSrc;

      if (options.reduceImageSize || !currentSrc.startsWith('data:')) {
        const currentBlob = await urlToBlob(currentSrc);
        if (options.reduceImageSize) {
          currentDataUrl = await resizeImage(currentBlob, options.maxImageDimension, options.imageQuality);
        } else if (!currentSrc.startsWith('data:')) {
          // Convert blob URL to data URL
          const tmpImg = new Image();
          await new Promise<void>((resolve) => {
            tmpImg.onload = () => resolve();
            tmpImg.src = currentSrc;
          });
          const c = document.createElement('canvas');
          c.width = tmpImg.naturalWidth;
          c.height = tmpImg.naturalHeight;
          c.getContext('2d')!.drawImage(tmpImg, 0, 0);
          currentDataUrl = c.toDataURL('image/jpeg', options.imageQuality);
        }
      }

      if (options.reduceImageSize || !originalSrc.startsWith('data:')) {
        const originalBlob = await urlToBlob(originalSrc);
        if (options.reduceImageSize) {
          originalDataUrl = await resizeImage(originalBlob, options.maxImageDimension, options.imageQuality);
        } else if (!originalSrc.startsWith('data:')) {
          const tmpImg = new Image();
          await new Promise<void>((resolve) => {
            tmpImg.onload = () => resolve();
            tmpImg.src = originalSrc;
          });
          const c = document.createElement('canvas');
          c.width = tmpImg.naturalWidth;
          c.height = tmpImg.naturalHeight;
          c.getContext('2d')!.drawImage(tmpImg, 0, 0);
          originalDataUrl = c.toDataURL('image/jpeg', options.imageQuality);
        }
      }

      imageSources.push(currentDataUrl);
      originalSources.push(originalDataUrl);
    } else {
      // Folder mode: use relative paths
      const ext = img.name.match(/\.(jpg|jpeg|png|webp)$/i)?.[1]?.toLowerCase() || 'jpg';
      const baseName = img.name.replace(/\.[^/.]+$/, '');
      imageSources.push(`images/${baseName}_clean.${ext}`);
      originalSources.push(`images/${baseName}_original.${ext}`);
    }
  }

  // Serialize project data (strip binary data to keep JSON small)
  const pagesData = serializeProjectData(images);

  // Generate HTML
  const html = generateReaderHTML(pagesData, imageSources, originalSources, isSingleHTML);

  if (isSingleHTML) {
    // Single file: download directly
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manga_reader.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    // ZIP mode: HTML + images folder
    const zip = new JSZip();
    zip.file('index.html', html);

    const imgFolder = zip.folder('images');
    for (let i = 0; i < total; i++) {
      if (shouldCancel && shouldCancel()) return;
      if (onProgress) onProgress(i + 1, total);

      const img = images[i];
      const ext = img.name.match(/\.(jpg|jpeg|png|webp)$/i)?.[1]?.toLowerCase() || 'jpg';
      const baseName = img.name.replace(/\.[^/.]+$/, '');
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      // Clean/inpainted image
      const currentSrc = img.inpaintedUrl || img.url || (img.base64 ? `data:image/png;base64,${img.base64}` : '');
      const currentBlob = await urlToBlob(currentSrc);
      imgFolder!.file(`${baseName}_clean.${ext}`, currentBlob);

      // Original image
      const originalSrc = img.originalUrl || img.url || (img.originalBase64 ? `data:image/png;base64,${img.originalBase64}` : currentSrc);
      const originalBlob = await urlToBlob(originalSrc);
      imgFolder!.file(`${baseName}_original.${ext}`, originalBlob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manga_reader.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// ─── Import Function ───

export interface ImportResult {
  images: ImageState[];
}

/** Parse a manga reader HTML file and extract project data */
export const importFromHtmlReader = async (file: File): Promise<ImportResult | null> => {
  try {
    // Check if it's an HTML file
    if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      return await importFromSingleHtml(file);
    }

    // Check if it's a ZIP file
    if (file.name.endsWith('.zip')) {
      return await importFromZip(file);
    }

    alert('Unsupported file format. Please use .html or .zip files exported by MangaType.');
    return null;
  } catch (e) {
    console.error('Import failed', e);
    alert('Import failed: ' + (e as Error).message);
    return null;
  }
};

const importFromSingleHtml = async (file: File): Promise<ImportResult | null> => {
  const text = await file.text();

  // Extract PAGES data
  const pagesMatch = text.match(/const PAGES\s*=\s*(\[[\s\S]*?\]);/);
  if (!pagesMatch) {
    alert('Invalid manga reader file: project data not found.');
    return null;
  }

  // Extract IMAGE_SOURCES mapping
  const imgSrcMatch = text.match(/const IMAGE_SOURCES\s*=\s*(\{[\s\S]*?\});/);
  const origSrcMatch = text.match(/const ORIGINAL_SOURCES\s*=\s*(\{[\s\S]*?\});/);

  let pagesData: { pages: SerializableImageState[] };
  try {
    pagesData = JSON.parse(pagesMatch[1]);
  } catch {
    alert('Failed to parse project data.');
    return null;
  }

  let imageSrcMap: Record<number, string> = {};
  let originalSrcMap: Record<number, string> = {};

  try {
    if (imgSrcMatch) imageSrcMap = JSON.parse(imgSrcMatch[1]);
    if (origSrcMatch) originalSrcMap = JSON.parse(origSrcMatch[1]);
  } catch {
    // Continue without mappings
  }

  // Reconstruct ImageState array
  const images: ImageState[] = pagesData.pages.map((page, idx) => {
    const imgSrc = imageSrcMap[idx] || '';
    const origSrc = originalSrcMap[idx] || imgSrc;

    // Extract base64 from data URLs
    const extractBase64 = (dataUrl: string) => {
      if (!dataUrl) return '';
      const commaIdx = dataUrl.indexOf(',');
      return commaIdx >= 0 ? dataUrl.substring(commaIdx + 1) : dataUrl;
    };

    const currentBase64 = extractBase64(imgSrc);
    const origBase64 = extractBase64(origSrc);
    const hasInpainted = imgSrc !== origSrc && imgSrc;

    return {
      id: page.id,
      name: page.name,
      width: page.width,
      height: page.height,
      base64: currentBase64,
      url: imgSrc,
      originalBase64: origBase64,
      originalUrl: origSrc,
      inpaintedUrl: hasInpainted ? imgSrc : undefined,
      inpaintedBase64: hasInpainted ? currentBase64 : undefined,
      bubbles: page.bubbles || [],
      maskRegions: page.maskRegions || [],
      contourSchemaVersion: page.contourSchemaVersion,
      status: page.status || 'idle',
      detectionStatus: page.detectionStatus || 'idle',
      inpaintingStatus: page.inpaintingStatus || 'idle',
      errorMessage: page.errorMessage,
      skipped: page.skipped,
    } as ImageState;
  });

  return { images };
};

const importFromZip = async (file: File): Promise<ImportResult | null> => {
  const zip = await JSZip.loadAsync(file);

  // Find index.html
  const htmlFile = zip.file('index.html');
  if (!htmlFile) {
    alert('Invalid ZIP: index.html not found.');
    return null;
  }

  const htmlText = await htmlFile.async('string');

  // Extract PAGES data
  const pagesMatch = htmlText.match(/const PAGES\s*=\s*(\[[\s\S]*?\]);/);
  if (!pagesMatch) {
    alert('Invalid manga reader file: project data not found.');
    return null;
  }

  let pagesData: { pages: SerializableImageState[] };
  try {
    pagesData = JSON.parse(pagesMatch[1]);
  } catch {
    alert('Failed to parse project data.');
    return null;
  }

  // Extract all images from ZIP's images/ folder
  const imageFiles: Record<string, Blob> = {};
  const imagePromises: Promise<void>[] = [];

  zip.folder('images')?.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      imagePromises.push(
        zipEntry.async('blob').then(blob => {
          imageFiles[relativePath] = blob;
        })
      );
    }
  });

  await Promise.all(imagePromises);

  // Reconstruct ImageState array
  const images: ImageState[] = await Promise.all(pagesData.pages.map(async (page, idx) => {
    const ext = page.name.match(/\.(jpg|jpeg|png|webp)$/i)?.[1]?.toLowerCase() || 'jpg';
    const baseName = page.name.replace(/\.[^/.]+$/, '');
    const cleanKey = `${baseName}_clean.${ext}`;
    const origKey = `${baseName}_original.${ext}`;

    const blobToDataUrl = (blob: Blob): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    };

    const dataUrlToBase64 = (dataUrl: string) => {
      const idx = dataUrl.indexOf(',');
      return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
    };

    let currentDataUrl = '';
    let origDataUrl = '';

    const cleanBlob = imageFiles[cleanKey];
    const origBlob = imageFiles[origKey];

    if (cleanBlob) {
      currentDataUrl = await blobToDataUrl(cleanBlob);
    }
    if (origBlob) {
      origDataUrl = await blobToDataUrl(origBlob);
    } else if (cleanBlob) {
      origDataUrl = currentDataUrl;
    }

    const currentBase64 = dataUrlToBase64(currentDataUrl);
    const origBase64 = dataUrlToBase64(origDataUrl);
    const hasInpainted = currentDataUrl && origDataUrl && currentDataUrl !== origDataUrl;

    // Get image dimensions from the blob
    let width = page.width;
    let height = page.height;
    if (cleanBlob && (!width || !height)) {
      const dimImg = new Image();
      const dimUrl = URL.createObjectURL(cleanBlob);
      await new Promise<void>((resolve) => {
        dimImg.onload = () => {
          width = dimImg.naturalWidth;
          height = dimImg.naturalHeight;
          resolve();
        };
        dimImg.onerror = () => resolve();
        dimImg.src = dimUrl;
      });
      URL.revokeObjectURL(dimUrl);
    }

    return {
      id: page.id,
      name: page.name,
      width,
      height,
      base64: currentBase64,
      url: currentDataUrl,
      originalBase64: origBase64,
      originalUrl: origDataUrl,
      inpaintedUrl: hasInpainted ? currentDataUrl : undefined,
      inpaintedBase64: hasInpainted ? currentBase64 : undefined,
      bubbles: page.bubbles || [],
      maskRegions: page.maskRegions || [],
      contourSchemaVersion: page.contourSchemaVersion,
      status: page.status || 'idle',
      detectionStatus: page.detectionStatus || 'idle',
      inpaintingStatus: page.inpaintingStatus || 'idle',
      errorMessage: page.errorMessage,
      skipped: page.skipped,
    } as ImageState;
  }));

  return { images };
};
