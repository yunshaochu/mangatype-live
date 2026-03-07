import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { ImageState, Bubble, AIConfig, APIEndpoint, ViewLayer, MaskRegion, normalizeEndpointProtectionState } from '../types';
import { useProjectState } from '../hooks/useProjectState';
import { useProcessor } from '../hooks/useProcessor';
import { DEFAULT_SYSTEM_PROMPT } from '../services/geminiService';
import { getFillOverlayMode, isBubbleInsideMask, isMaskCleaned } from '../utils/editorUtils';
import { detectBubbleColor, generateInpaintMask, restoreImageRegion, compositeRegionIntoImage, initScreenshotContainer, destroyScreenshotContainer, computeContourRects, dilateMaskImage, applyContourPreFill, bakeContourFillsIntoImage } from '../services/exportService';
import { inpaintImage } from '../services/inpaintingService';
import { loadAiConfigFromStorage, saveAiConfigToStorage } from '../services/aiConfigStorage';

// --- Runtime Configuration Injection ---
declare global {
  interface Window {
    APP_CONFIG?: {
      TEXT_DETECTION_API_URL?: string;
      IOPAINT_API_URL?: string;
    };
  }
}

const getRuntimeConfig = () => {
  if (typeof window !== 'undefined' && window.APP_CONFIG) {
    return window.APP_CONFIG;
  }
  return {};
};

const runtimeConfig = getRuntimeConfig();
// ----------------------------------------

const buildContourIntersectionMasks = (image: ImageState, targetMasks: MaskRegion[]) => {
  const perMask = new Map<string, MaskRegion[]>();
  const contours = image.contours || [];
  if (contours.length === 0 || targetMasks.length === 0) {
    return { perMask, all: [] as MaskRegion[] };
  }

  const preparedContours = contours
    .map((contour) => {
      if (!contour.base64) return null;
      const contourX = contour.anchor?.x;
      const contourY = contour.anchor?.y;
      const contourW = contour.size?.w;
      const contourH = contour.size?.h;
      if (
        typeof contourX !== 'number' || typeof contourY !== 'number' ||
        typeof contourW !== 'number' || typeof contourH !== 'number' ||
        contourW <= 0 || contourH <= 0
      ) {
        return null;
      }
      const left = contourX - contourW / 2;
      const top = contourY - contourH / 2;
      return {
        id: contour.id,
        sourceMaskId: contour.sourceMaskId,
        base64: contour.base64,
        contourX,
        contourY,
        contourW,
        contourH,
        left,
        top,
        right: left + contourW,
        bottom: top + contourH,
      };
    })
    .filter((contour): contour is {
      id: string;
      sourceMaskId?: string;
      base64: string;
      contourX: number;
      contourY: number;
      contourW: number;
      contourH: number;
      left: number;
      top: number;
      right: number;
      bottom: number;
    } => contour !== null);
  if (preparedContours.length === 0) {
    return { perMask, all: [] as MaskRegion[] };
  }

  for (const mask of targetMasks) {
    const maskLeft = mask.x - mask.width / 2;
    const maskTop = mask.y - mask.height / 2;
    const maskRight = maskLeft + mask.width;
    const maskBottom = maskTop + mask.height;
    const intersections: MaskRegion[] = [];

    for (const contour of preparedContours) {
      if (contour.sourceMaskId && contour.sourceMaskId !== mask.id) continue;
      const contourX = contour.contourX;
      const contourY = contour.contourY;
      const contourW = contour.contourW;
      const contourH = contour.contourH;
      const contourLeft = contour.left;
      const contourTop = contour.top;
      const contourRight = contour.right;
      const contourBottom = contour.bottom;
      const intersects = contourRight > maskLeft && contourBottom > maskTop && contourLeft < maskRight && contourTop < maskBottom;
      if (!intersects) continue;

      intersections.push({
        id: `${mask.id}::${contour.id}`,
        x: mask.x,
        y: mask.y,
        width: mask.width,
        height: mask.height,
        method: 'fill',
        maskContourBase64: contour.base64,
        maskContourX: contourX,
        maskContourY: contourY,
        maskContourW: contourW,
        maskContourH: contourH,
      });
    }

    if (intersections.length > 0) {
      perMask.set(mask.id, intersections);
    }
  }

  return { perMask, all: Array.from(perMask.values()).flat() };
};

const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  endpoints: [normalizeEndpointProtectionState({
    id: 'default-openai',
    name: 'Openai',
    enabled: true,
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
  })],
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  defaultFontSize: 1.0,
  useTextDetectionApi: false,
  textDetectionApiUrl: runtimeConfig.TEXT_DETECTION_API_URL || 'http://localhost:5000',
  language: 'zh',
  customMessages: [{ role: 'user', content: '翻译' }],
  autoDetectBackground: false,
  enableDialogSnap: false,
  forceSnapSize: false,
  enableMaskedImageMode: false,
  useMasksAsHints: true,
  drawMasksOnImage: true,
  allowAiFontSelection: true,
  allowAiFontSize: true,
  fontSizeMode: 'scale',
  fontScaleEntries: [
    { label: 'tiny', value: 0.7 },
    { label: 'small', value: 1.0 },
    { label: 'normal', value: 1.3 },
    { label: 'large', value: 1.6 },
    { label: 'huge', value: 2.1 },
    { label: 'extreme', value: 2.8 },
  ],
  defaultMaskShape: 'rectangle',
  defaultMaskCornerRadius: 20,
  defaultMaskFeather: 0,
  defaultFontFamily: 'noto',
  defaultTextColor: '#000000',
  defaultStrokeColor: '#ffffff',
  defaultBackgroundColor: '#ffffff',
  defaultLetterSpacing: 0.15,
  defaultLineHeight: 1.1,
  defaultIsVertical: true,
  // Model Capabilities (undefined = enabled by default)
  // modelSupportsFunctionCalling: undefined, // Set to false to skip Function Calling tier
  // modelSupportsJsonMode: undefined, // Set to false to skip JSON Mode tier
  // Inpainting defaults
  enableInpainting: false,
  inpaintingUrl: runtimeConfig.IOPAINT_API_URL || 'http://localhost:8080',
  inpaintingModel: 'lama',
  // API Protection defaults
  apiProtectionEnabled: true,
  apiProtectionStateMachineV2: false,
  apiProtectionDurations: [30, 60, 120, 300, 600],
  apiProtectionDisableThreshold: 5,
  exportSkippedAsOriginal: true,
  freehandPerfPhase1Enabled: true,
  freehandPerfPhase2Enabled: false,
  freehandLowResThresholdMp: 4,
  freehandPreviewTargetPixels: 1500000,
  freehandReplayBatchSize: 120,
};

interface ProjectContextType {
  // Project State (from useProjectState)
  history: { past: ImageState[][]; present: ImageState[]; future: ImageState[][]; };
  images: ImageState[];
  currentId: string | null;
  currentImage?: ImageState;
  selectedBubbleId: string | null;
  selectedMaskId: string | null;
  setImages: (newImagesOrUpdater: ImageState[] | ((prev: ImageState[]) => ImageState[]), skipHistory?: boolean) => void;
  setCurrentId: (id: string | null) => void;
  setSelectedBubbleId: (id: string | null) => void;
  setSelectedMaskId: (id: string | null) => void;
  processFiles: (files: FileList | File[]) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  deleteCurrentSelection: () => void;
  navigateImage: (direction: 'prev' | 'next') => void;
  setHistory: React.Dispatch<React.SetStateAction<{ past: ImageState[][]; present: ImageState[]; future: ImageState[][]; }>>;

  // AI & Processor State
  aiConfig: AIConfig;
  setAiConfig: (config: AIConfig) => void;
  isProcessingBatch: boolean;
  processingType: 'translate' | 'scan' | 'inpaint' | null;
  handleBatchProcess: (currentImage: ImageState | undefined, onlyCurrent: boolean, concurrency: number) => void;
  handleResetStatus: () => void;
  handleLocalDetectionScan: (currentImage: ImageState | undefined, batch: boolean, concurrency: number) => void;
  handleBatchInpaint: (currentImage: ImageState | undefined, onlyCurrent: boolean, concurrency: number) => void;
  stopProcessing: () => void;
  handleGlobalColorDetection: (concurrency: number) => void;

  // Inpainting Actions (Single specific mask)
  handleInpaint: (imageId: string, specificMaskId?: string) => Promise<void>;
  handleApplyWorkshopResult: (imageId: string, maskId: string, regionDataUrl: string) => Promise<void>;
  isInpainting: boolean;
  handleRestoreRegion: (imageId: string, regionId: string) => Promise<void>;
  handlePaintSave: (imageId: string, newBase64: string) => void;
  registerPaintFlushHandler: (imageId: string, handler: (() => Promise<void>) | null) => void;
  flushPendingCommands: (imageId?: string) => Promise<void>;
  handleBoxFill: (imageId: string, maskId: string, color: string) => Promise<void>;
  handleBatchBoxFill: (scope: 'current' | 'all', color: string) => Promise<void>;

  // UI State
  drawTool: 'none' | 'bubble' | 'mask' | 'brush';
  setDrawTool: (tool: 'none' | 'bubble' | 'mask' | 'brush') => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showManualJson: boolean;
  setShowManualJson: (show: boolean) => void;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  isDetectionGuideMode: boolean;
  setIsDetectionGuideMode: (enabled: boolean) => void;
  concurrency: number;
  setConcurrency: (n: number) => void;
  isMerging: boolean;
  setIsMerging: (v: boolean) => void;
  isZipping: boolean;
  setIsZipping: (v: boolean) => void;
  zipProgress: { current: number; total: number };
  setZipProgress: (p: { current: number; total: number }) => void;
  zipCancelRequested: boolean;
  requestZipCancel: () => void;
  resetZipCancel: () => void;
  showGlobalStyles: boolean;
  setShowGlobalStyles: (v: boolean) => void;
  activeLayer: ViewLayer;
  setActiveLayer: (layer: ViewLayer) => void;
  
  // Brush Settings
  brushColor: string;
  setBrushColor: (c: string) => void;
  brushSize: number;
  setBrushSize: (s: number) => void;
  paintMode: 'brush' | 'box';
  setPaintMode: (mode: 'brush' | 'box') => void;
  brushType: 'paint' | 'restore'; // New brush type
  setBrushType: (t: 'paint' | 'restore') => void;

  // Actions
  updateBubble: (bubbleId: string, updates: Partial<Bubble>, skipHistory?: boolean) => void;
  updateImageBubbles: (imgId: string, newBubbles: Bubble[]) => void;
  updateMaskRegion: (maskId: string, updates: Partial<MaskRegion>) => void; // New helper
  triggerAutoColorDetection: (bubbleId: string) => void;
  reorderBubble: (bubbleId: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;
  
  // Refs (for direct access if needed, though mostly internal)
  historyRef: React.MutableRefObject<{ past: ImageState[][]; present: ImageState[]; future: ImageState[][]; }>;
  aiConfigRef: React.MutableRefObject<AIConfig>;
  screenshotReady: boolean;
}

// 1. Create Context
const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// 2. Export Hook
export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
};

// 3. Export Provider
export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Core Project State
  const projectState = useProjectState();
  const { 
    images, setImages, currentId, historyRef 
  } = projectState;

  // 2. AI Config State
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    try {
      return loadAiConfigFromStorage(localStorage, {
        defaultConfig: DEFAULT_CONFIG,
        runtimeConfig: getRuntimeConfig(),
      });
    } catch (e) { console.warn("Failed to load settings", e); }
    return DEFAULT_CONFIG;
  });

  const aiConfigRef = useRef(aiConfig);
  useEffect(() => {
    aiConfigRef.current = aiConfig;
    try { saveAiConfigToStorage(localStorage, aiConfig); } catch (e) { console.warn("Failed to save settings", e); }
  }, [aiConfig]);

  // Destroy screenshot container when switching away from screenshot mode
  // Init is triggered only manually via AdvancedTab (not on every config save)
  const [screenshotReady, setScreenshotReady] = useState(false);
  useEffect(() => {
    if (aiConfig.exportMethod !== 'screenshot') {
      destroyScreenshotContainer();
      setScreenshotReady(false);
    }
  }, [aiConfig.exportMethod]);

  // MOVED UP: UI State (so setActiveLayer is available for handlers below)
  const [drawTool, setDrawTool] = useState<'none' | 'bubble' | 'mask' | 'brush'>('none');
  const [showSettings, setShowSettings] = useState(false);
  const [showManualJson, setShowManualJson] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDetectionGuideMode, setIsDetectionGuideMode] = useState(false);
  const [concurrency, setConcurrency] = useState(aiConfig.concurrency || 1);

  // Sync concurrency to aiConfig for persistence
  const handleSetConcurrency = (n: number) => {
    setConcurrency(n);
    setAiConfig({ ...aiConfig, concurrency: n });
  };
  const [isMerging, setIsMerging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 });
  const [zipCancelRequested, setZipCancelRequested] = useState(false);
  const [showGlobalStyles, setShowGlobalStyles] = useState(false);
  const [activeLayer, setActiveLayer] = useState<ViewLayer>('final');
  
  // Brush State
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(20);
  const [paintMode, setPaintMode] = useState<'brush' | 'box'>('brush');
  const [brushType, setBrushType] = useState<'paint' | 'restore'>('paint');
  const paintFlushHandlersRef = useRef<Map<string, () => Promise<void>>>(new Map());

  const registerPaintFlushHandler = useCallback((imageId: string, handler: (() => Promise<void>) | null) => {
      if (!imageId) return;
      if (handler) {
          paintFlushHandlersRef.current.set(imageId, handler);
      } else {
          paintFlushHandlersRef.current.delete(imageId);
      }
  }, []);

  const flushPendingCommands = useCallback(async (imageId?: string) => {
      if (imageId) {
          const handler = paintFlushHandlersRef.current.get(imageId);
          if (handler) await handler();
          return;
      }
      for (const handler of paintFlushHandlersRef.current.values()) {
          await handler();
      }
  }, []);

  // Update endpoint helper for API protection
  const updateEndpoint = useCallback((endpointId: string, updates: Partial<APIEndpoint>) => {
    setAiConfig(prev => ({
      ...prev,
      endpoints: prev.endpoints.map(ep =>
        ep.id === endpointId ? normalizeEndpointProtectionState({ ...ep, ...updates }) : ep
      )
    }));
  }, []);

  // 3. Processor Logic
  const processor = useProcessor({ images, setImages, aiConfig, updateEndpoint });

  // 4. Inpainting Logic
  const [isInpainting, setIsInpainting] = useState(false);

  // Single Mask Inpaint (triggered from Sidebar)
  const handleInpaint = useCallback(async (imageId: string, specificMaskId?: string) => {
    const img = historyRef.current.present.find(i => i.id === imageId);
    if (!img) return;

    if (!aiConfig.enableInpainting || !aiConfig.inpaintingUrl) {
        alert(aiConfig.language === 'zh' ? '请先在设置中启用“文字去除”并配置 API URL。' : 'Please enable "Inpainting" in settings and configure API URL.');
        return;
    }

    if (!img.maskRegions || img.maskRegions.length === 0) {
        alert(aiConfig.language === 'zh' ? '没有红框可用于消除。' : 'No mask regions to inpaint.');
        return;
    }

    setIsInpainting(true);
    try {
        // Generate mask (if specific ID is passed, only that one is used; otherwise ALL for batch)
        // NOTE: For single box click, we respect the specific ID.
        const maskBase64 = await generateInpaintMask(img, { specificMaskId, useRefinedMask: false });
        let sourceBase64 = img.inpaintedBase64 || img.originalBase64 || img.base64;

        // Pre-fill text contour onto source image before inpainting (if enabled)
        if (aiConfig.preInpaintContour) {
            const targetMasks = specificMaskId
                ? (img.maskRegions || []).filter(m => m.id === specificMaskId)
                : (img.maskRegions || []);
            const contourMasks = buildContourIntersectionMasks(img, targetMasks).all;
            if (contourMasks.length > 0) {
                sourceBase64 = await applyContourPreFill(sourceBase64, contourMasks, img.width, img.height);
            }
        }

        const cleanedBase64Raw = await inpaintImage(
            aiConfig.inpaintingUrl,
            sourceBase64,
            maskBase64,
            aiConfig.inpaintingModel
        );

        const cleanedBase64 = cleanedBase64Raw.startsWith('data:') 
            ? cleanedBase64Raw 
            : `data:image/png;base64,${cleanedBase64Raw}`;

        setImages(prev => prev.map(p => {
            if (p.id !== imageId) return p;
            
            // Mark mask as cleaned
            const newMasks = (p.maskRegions || []).map(m => m.id === specificMaskId ? { ...m, isCleaned: true, method: 'inpaint' as const } : m);
            
            // Check bubbles intersection
            const targetMask = (p.maskRegions || []).find(m => m.id === specificMaskId);
            let newBubbles = p.bubbles;
            if (targetMask) {
                newBubbles = p.bubbles.map(b => {
                    const xDiff = Math.abs(b.x - targetMask.x);
                    const yDiff = Math.abs(b.y - targetMask.y);
                    const halfW = targetMask.width / 2;
                    const halfH = targetMask.height / 2;
                    const overlaps = xDiff <= halfW && yDiff <= halfH;
                    if (overlaps) {
                        return { ...b, backgroundColor: 'transparent', autoDetectBackground: false };
                    }
                    return b;
                });
            }

            return {
                ...p,
                base64: cleanedBase64.replace(/^data:image\/\w+;base64,/, ""),
                url: cleanedBase64, 
                inpaintedUrl: cleanedBase64,
                inpaintedBase64: cleanedBase64.replace(/^data:image\/\w+;base64,/, ""),
                inpaintingStatus: 'done',
                maskRegions: newMasks,
                bubbles: newBubbles
            };
        }));
        
        setActiveLayer('clean');

    } catch (e: any) {
        console.error("Inpainting failed", e);
        alert(aiConfig.language === 'zh' ? `去除文字失败: ${e.message}` : `Inpainting failed: ${e.message}`);
    } finally {
        setIsInpainting(false);
    }
  }, [aiConfig, setImages, historyRef, setActiveLayer]);

  // Apply Workshop Result (manual paste or external edit)
  const handleApplyWorkshopResult = useCallback(async (imageId: string, maskId: string, regionDataUrl: string) => {
    const img = historyRef.current.present.find(i => i.id === imageId);
    if (!img) return;
    const mask = img.maskRegions?.find(m => m.id === maskId);
    if (!mask) return;
    try {
        const sourceUrl = img.inpaintedUrl || img.url || `data:image/png;base64,${img.base64}`;
        const composited = await compositeRegionIntoImage(sourceUrl, regionDataUrl, mask, img.width, img.height);
        setImages(prev => prev.map(p => {
            if (p.id !== imageId) return p;
            const newMasks = (p.maskRegions || []).map(m =>
                m.id === maskId ? { ...m, isCleaned: true, method: 'inpaint' as const } : m
            );
            const targetMask = (p.maskRegions || []).find(m => m.id === maskId);
            let newBubbles = p.bubbles;
            if (targetMask) {
                newBubbles = p.bubbles.map(b => {
                    const overlaps = Math.abs(b.x - targetMask.x) <= targetMask.width / 2 && Math.abs(b.y - targetMask.y) <= targetMask.height / 2;
                    return overlaps ? { ...b, backgroundColor: 'transparent', autoDetectBackground: false } : b;
                });
            }
            return {
                ...p,
                base64: composited.replace(/^data:image\/\w+;base64,/, ""),
                url: composited,
                inpaintedUrl: composited,
                inpaintedBase64: composited.replace(/^data:image\/\w+;base64,/, ""),
                inpaintingStatus: 'done' as const,
                maskRegions: newMasks,
                bubbles: newBubbles
            };
        }));
        setActiveLayer('clean');
    } catch (e: any) {
        console.error("Apply workshop result failed", e);
    }
  }, [setImages, historyRef, setActiveLayer]);

  // Handle Box Fill
  const handleBoxFill = useCallback(async (imageId: string, maskId: string, color: string) => {
    const targetImg = historyRef.current.present.find(i => i.id === imageId);
    const targetMask = targetImg?.maskRegions?.find(m => m.id === maskId);
    const contourMasks = targetImg && targetMask
        ? (buildContourIntersectionMasks(targetImg, [targetMask]).perMask.get(targetMask.id) || [])
        : [];

    if (aiConfig.usePreciseFill && contourMasks.length > 0) {
        // --- PRECISE MODE: compute contour data, bake pixels into image ---
        const masksWithData = await Promise.all(contourMasks.map(async (m) => {
            if (aiConfig.useCharRects !== false) {
                const contourRects = await computeContourRects(m.maskContourBase64!);
                return { ...m, maskContourRects: contourRects };
            }
            const dilatedBase64 = await dilateMaskImage(m.maskContourBase64!);
            return { ...m, maskContourDilatedBase64: dilatedBase64 };
        }));

        // Bake into pixels
        const srcBase64 = targetImg!.inpaintedBase64 || targetImg!.originalBase64 || targetImg!.base64;
        const newBase64 = await bakeContourFillsIntoImage(
            srcBase64, masksWithData, targetImg!.width, targetImg!.height,
            color, aiConfig.useCharRects !== false
        );
        const newUrl = `data:image/png;base64,${newBase64}`;

        setImages(prev => prev.map(img => {
            if (img.id !== imageId) return img;
            const mask = (img.maskRegions || []).find(m => m.id === maskId);
            if (!mask) return img;
            const newMasks = (img.maskRegions || []).map(m => m.id === maskId ? {
                ...m, isCleaned: true, method: 'fill' as const, fillColor: color,
                fillMode: 'baked' as const, // pixels already written to inpaintedUrl
            } : m);
            const newBubbles = img.bubbles.map(b => {
                const overlaps = Math.abs(b.x - mask.x) <= mask.width / 2 && Math.abs(b.y - mask.y) <= mask.height / 2;
                return overlaps ? { ...b, backgroundColor: 'transparent', autoDetectBackground: false } : b;
            });
            return {
                ...img,
                base64: newBase64,
                url: newUrl,
                inpaintedUrl: newUrl,
                inpaintedBase64: newBase64,
                inpaintingStatus: 'done' as const,
                maskRegions: newMasks,
                bubbles: newBubbles,
            };
        }));
    } else {
        // --- RECT MODE: metadata-only, fast CSS overlay ---
        setImages(prev => prev.map(img => {
            if (img.id !== imageId) return img;
            const mask = (img.maskRegions || []).find(m => m.id === maskId);
            if (!mask) return img;
            const newMasks = (img.maskRegions || []).map(m => m.id === maskId ? {
                ...m, isCleaned: true, method: 'fill' as const, fillColor: color,
                fillMode: 'rect' as const,
            } : m);
            const newBubbles = img.bubbles.map(b => {
                const overlaps = Math.abs(b.x - mask.x) <= mask.width / 2 && Math.abs(b.y - mask.y) <= mask.height / 2;
                return overlaps ? { ...b, backgroundColor: 'transparent', autoDetectBackground: false } : b;
            });
            return { ...img, inpaintingStatus: 'done' as const, maskRegions: newMasks, bubbles: newBubbles };
        }));
    }
    setActiveLayer('clean');
  }, [setImages, setActiveLayer, aiConfig, historyRef]);

  // Handle Batch Box Fill
  const handleBatchBoxFill = useCallback(async (scope: 'current' | 'all', color: string) => {
    const targetIds = new Set(
        scope === 'current'
        ? (currentId ? [currentId] : [])
        : historyRef.current.present.filter(i => !i.skipped).map(i => i.id)
    );

    if (targetIds.size === 0) return;

    if (aiConfig.usePreciseFill) {
        // --- PRECISE MODE: per-image pixel bake ---
        const contourRectsByBase64 = new Map<string, MaskRegion['maskContourRects']>();
        const dilatedByBase64 = new Map<string, string>();
        const bakedMaskIdsByImage = new Map<string, Set<string>>();
        const bakedImages = new Map<string, { base64: string; url: string }>();
        for (const img of historyRef.current.present) {
            if (!targetIds.has(img.id)) continue;
            const masksToFill = (img.maskRegions || []).filter(m => m.method !== 'inpaint' && !m.isCleaned);
            if (masksToFill.length === 0) continue;
            const intersections = buildContourIntersectionMasks(img, masksToFill);
            if (intersections.all.length === 0) continue;

            const masksWithData: MaskRegion[] = [];
            for (const contourMask of intersections.all) {
                const contourBase64 = contourMask.maskContourBase64;
                if (!contourBase64) continue;
                if (aiConfig.useCharRects !== false) {
                    let rects = contourRectsByBase64.get(contourBase64);
                    if (!rects) {
                        rects = await computeContourRects(contourBase64);
                        contourRectsByBase64.set(contourBase64, rects);
                    }
                    masksWithData.push({ ...contourMask, maskContourRects: rects });
                } else {
                    let dilated = dilatedByBase64.get(contourBase64);
                    if (!dilated) {
                        dilated = await dilateMaskImage(contourBase64);
                        dilatedByBase64.set(contourBase64, dilated);
                    }
                    masksWithData.push({ ...contourMask, maskContourDilatedBase64: dilated });
                }
            }
            if (masksWithData.length === 0) continue;

            const srcBase64 = img.inpaintedBase64 || img.originalBase64 || img.base64;
            const newBase64 = await bakeContourFillsIntoImage(
                srcBase64, masksWithData, img.width, img.height, color, aiConfig.useCharRects !== false
            );
            bakedImages.set(img.id, { base64: newBase64, url: `data:image/png;base64,${newBase64}` });
            bakedMaskIdsByImage.set(img.id, new Set(intersections.perMask.keys()));
        }

        setImages(prev => prev.map(img => {
            if (!targetIds.has(img.id)) return img;
            const baked = bakedImages.get(img.id);
            const masksToFill = (img.maskRegions || []).filter(m => m.method !== 'inpaint' && !m.isCleaned);
            if (masksToFill.length === 0) return img;
            const bakedMaskIds = bakedMaskIdsByImage.get(img.id) || new Set<string>();
            const overlayMaskIds = new Set(masksToFill.filter(m => !bakedMaskIds.has(m.id)).map(m => m.id));
            const newMasks = (img.maskRegions || []).map(m => {
                if (bakedMaskIds.has(m.id)) {
                    return { ...m, isCleaned: true, method: 'fill' as const, fillColor: color, fillMode: 'baked' as const };
                }
                if (overlayMaskIds.has(m.id)) {
                    return { ...m, isCleaned: true, method: 'fill' as const, fillColor: color, fillMode: 'rect' as const };
                }
                return m;
            });
            const newBubbles = img.bubbles.map(b => {
                const overlaps = masksToFill.some(mask => isBubbleInsideMask(b.x, b.y, mask.x, mask.y, mask.width, mask.height));
                return overlaps ? { ...b, backgroundColor: 'transparent', autoDetectBackground: false } : b;
            });
            return {
                ...img,
                ...(baked ? { base64: baked.base64, url: baked.url, inpaintedUrl: baked.url, inpaintedBase64: baked.base64 } : {}),
                inpaintingStatus: 'done' as const,
                maskRegions: newMasks,
                bubbles: newBubbles,
            };
        }));
    } else {
        // --- RECT MODE: metadata-only, fast CSS overlay ---
        setImages(prev => prev.map(img => {
            if (!targetIds.has(img.id)) return img;
            const masksToFill = (img.maskRegions || []).filter(m => m.method !== 'inpaint' && !m.isCleaned);
            if (masksToFill.length === 0) return img;
            const filledIds = new Set(masksToFill.map(m => m.id));
            const newMasks = (img.maskRegions || []).map(m =>
                filledIds.has(m.id) ? { ...m, isCleaned: true, method: 'fill' as const, fillColor: color, fillMode: 'rect' as const } : m
            );
            const newBubbles = img.bubbles.map(b => {
                const overlaps = masksToFill.some(mask => isBubbleInsideMask(b.x, b.y, mask.x, mask.y, mask.width, mask.height));
                return overlaps ? { ...b, backgroundColor: 'transparent', autoDetectBackground: false } : b;
            });
            return { ...img, inpaintingStatus: 'done' as const, maskRegions: newMasks, bubbles: newBubbles };
        }));
    }

    if (scope === 'current' || (currentId && targetIds.has(currentId))) {
        setActiveLayer('clean');
    }
  }, [currentId, historyRef, setImages, setActiveLayer, aiConfig]);

  // Restore Region
  const handleRestoreRegion = useCallback(async (imageId: string, regionId: string) => {
      const img = historyRef.current.present.find(i => i.id === imageId);
      if (!img) return;

      const region = img.maskRegions?.find(m => m.id === regionId);
      if (!region) return;

      // If it was a 'fill' region...
      if (region.method === 'fill') {
          if (region.fillMode === 'baked') {
              // Precise fill: pixels were baked into the image, must restore from original
              try {
                  const restoredBase64 = await restoreImageRegion(img, regionId);
                  if (restoredBase64) {
                      setImages(prev => prev.map(p => p.id === imageId ? {
                          ...p,
                          base64: restoredBase64.replace(/^data:image\/\w+;base64,/, ""),
                          url: restoredBase64,
                          inpaintedUrl: restoredBase64,
                          inpaintedBase64: restoredBase64.replace(/^data:image\/\w+;base64,/, ""),
                          maskRegions: (p.maskRegions || []).map(m => m.id === regionId ? { ...m, isCleaned: false, fillColor: undefined, fillMode: undefined } : m)
                      } : p));
                      setActiveLayer('clean');
                  }
              } catch (e) {
                  console.error("Restore baked fill failed", e);
              }
          } else {
              // Metadata-only fill (rect/legacy contour): clear semantic and overlay fields.
              setImages(prev => prev.map(p => p.id === imageId ? {
                  ...p,
                  maskRegions: (p.maskRegions || []).map(m => m.id === regionId ? { ...m, isCleaned: false, fillColor: undefined, fillMode: undefined } : m)
              } : p));
          }
          return;
      }

      // If it was 'inpaint', we must restore pixels (Slower, but necessary)
      try {
          const restoredBase64 = await restoreImageRegion(img, regionId);
          if (restoredBase64) {
              setImages(prev => prev.map(p => p.id === imageId ? {
                  ...p,
                  base64: restoredBase64.replace(/^data:image\/\w+;base64,/, ""),
                  url: restoredBase64,
                  inpaintedUrl: restoredBase64,
                  inpaintedBase64: restoredBase64.replace(/^data:image\/\w+;base64,/, ""),
                  maskRegions: (p.maskRegions || []).map(m => m.id === regionId ? { ...m, isCleaned: false } : m)
              } : p));
              setActiveLayer('clean');
          }
      } catch (e) {
          console.error("Restore failed", e);
      }
  }, [setImages, historyRef, setActiveLayer]);

  const phase1Enabled = aiConfig.freehandPerfPhase1Enabled !== false;
  const PAINT_HISTORY_MERGE_WINDOW_MS = 700;
  const paintHistoryMergeRef = useRef<{ imageId: string | null; lastCommitAt: number }>({
      imageId: null,
      lastCommitAt: 0,
  });

  // Save manual paint result
  const handlePaintSave = useCallback((imageId: string, newBase64: string) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const shouldMergeHistory =
          phase1Enabled &&
          paintHistoryMergeRef.current.imageId === imageId &&
          (now - paintHistoryMergeRef.current.lastCommitAt) <= PAINT_HISTORY_MERGE_WINDOW_MS;

      setImages(prev => prev.map(p => {
          if (p.id !== imageId) return p;

          // Paint-save only bakes overlays that are actually composited into brush canvas (rect mode).
          // Keep isCleaned semantic state for transparency.
          const newMasks = (p.maskRegions || []).map(m => {
              if (getFillOverlayMode(m) === 'rect') {
                  return { ...m, fillMode: 'baked' as const };
              }
              return m;
          });

          return {
              ...p,
              base64: newBase64.replace(/^data:image\/\w+;base64,/, ""),
              url: newBase64,
              inpaintedUrl: newBase64,
              inpaintedBase64: newBase64.replace(/^data:image\/\w+;base64,/, ""),
              inpaintingStatus: 'done',
              maskRegions: newMasks
          };
      }), shouldMergeHistory);

      paintHistoryMergeRef.current = {
          imageId,
          lastCommitAt: now,
      };
  }, [phase1Enabled, setImages]);

  // 6. Shared Actions
  const detectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAutoColorDetection = useCallback((bubbleId: string) => {
      if (!currentId) return;
      if (detectionTimerRef.current) clearTimeout(detectionTimerRef.current);
      detectionTimerRef.current = setTimeout(async () => {
          const imagesSnapshot = historyRef.current.present;
          const imgState = imagesSnapshot.find(i => i.id === currentId);
          if (imgState) {
              const bubble = imgState.bubbles.find(b => b.id === bubbleId);
              if (bubble && bubble.width >= 1 && bubble.height >= 1) {
                  // Check if bubble center is inside any cleaned mask region — if so, force transparent
                  const cleanedMasks = (imgState.maskRegions || []).filter(isMaskCleaned);
                  const insideCleanedMask = cleanedMasks.some(m => {
                      const xDiff = Math.abs(bubble.x - m.x);
                      const yDiff = Math.abs(bubble.y - m.y);
                      return xDiff <= m.width / 2 && yDiff <= m.height / 2;
                  });
                  if (insideCleanedMask) {
                      setImages(prev => prev.map(img => img.id === currentId ? { ...img, bubbles: img.bubbles.map(b => b.id === bubbleId ? { ...b, backgroundColor: 'transparent', autoDetectBackground: false } : b) } : img));
                      return;
                  }

                  const shouldDetect = bubble.autoDetectBackground !== undefined ? bubble.autoDetectBackground : aiConfigRef.current.autoDetectBackground;
                  if (shouldDetect === false) return;
                  const detectedColor = await detectBubbleColor(imgState.url || `data:image/png;base64,${imgState.base64}`, bubble.x, bubble.y, bubble.width, bubble.height);
                  setImages(prev => prev.map(img => {
                      if (img.id !== currentId) return img;
                      const latestCleanedMasks = (img.maskRegions || []).filter(isMaskCleaned);
                      return {
                          ...img,
                          bubbles: img.bubbles.map(b => {
                              if (b.id !== bubbleId) return b;
                              const stillInsideCleanedMask = latestCleanedMasks.some(m => isBubbleInsideMask(b.x, b.y, m.x, m.y, m.width, m.height));
                              if (stillInsideCleanedMask) {
                                  return { ...b, backgroundColor: 'transparent', autoDetectBackground: false };
                              }
                              const stillShouldDetect = b.autoDetectBackground !== undefined ? b.autoDetectBackground : aiConfigRef.current.autoDetectBackground;
                              if (stillShouldDetect === false) return b;
                              return { ...b, backgroundColor: detectedColor };
                          })
                      };
                  }));
              }
          }
      }, 300);
  }, [currentId, setImages, historyRef]);

  const updateBubble = useCallback((bubbleId: string, updates: Partial<Bubble>, skipHistory: boolean = false) => {
    if (!currentId) return;
    const currentImg = historyRef.current.present.find(i => i.id === currentId);
    if (!currentImg) return;

    let finalUpdates = { ...updates };
    
    // Default background color handling
    if (finalUpdates.autoDetectBackground === false && !finalUpdates.backgroundColor) {
        // If unsetting auto-detect and no color provided, only set to white if current is not transparent or color
        const existing = currentImg.bubbles.find(b => b.id === bubbleId);
        if (existing && !existing.backgroundColor) finalUpdates.backgroundColor = '#ffffff';
    }

    // CHECK FOR CLEANED MASK INTERSECTION
    // If we are moving or resizing, check if we overlap with a cleaned mask
    // If so, force transparent.
    if (finalUpdates.x !== undefined || finalUpdates.y !== undefined || finalUpdates.width !== undefined || finalUpdates.height !== undefined) {
        const bubble = currentImg.bubbles.find(b => b.id === bubbleId);
        if (bubble) {
            const tempBubble = { ...bubble, ...finalUpdates };
            const cleanedMasks = (currentImg.maskRegions || []).filter(isMaskCleaned);
            
            // Overlap logic: Check if bubble center is inside mask region
            const overlaps = cleanedMasks.some(m => isBubbleInsideMask(tempBubble.x, tempBubble.y, m.x, m.y, m.width, m.height));

            if (overlaps) {
                finalUpdates.backgroundColor = 'transparent';
                finalUpdates.autoDetectBackground = false; 
            }
        }
    }
    
    setImages(prev => prev.map(img => img.id === currentId ? {
        ...img,
        bubbles: img.bubbles.map(b => b.id === bubbleId ? { ...b, ...finalUpdates } : b)
    } : img), skipHistory);

    if (finalUpdates.autoDetectBackground === true) triggerAutoColorDetection(bubbleId);
  }, [currentId, setImages, triggerAutoColorDetection, historyRef]);

  const updateMaskRegion = useCallback((maskId: string, updates: Partial<MaskRegion>) => {
      if (!currentId) return;
      const normalizedUpdates: Partial<MaskRegion> = { ...updates };
      // Avoid accidental anchor wipe when callers pass explicit undefined fields.
      if (normalizedUpdates.maskContourX === undefined) delete normalizedUpdates.maskContourX;
      if (normalizedUpdates.maskContourY === undefined) delete normalizedUpdates.maskContourY;
      setImages(prev => prev.map(img => img.id === currentId ? {
          ...img,
          maskRegions: (img.maskRegions || []).map(m => m.id === maskId ? { ...m, ...normalizedUpdates } : m)
      } : img));
  }, [currentId, setImages]);

  const updateImageBubbles = useCallback((imgId: string, newBubbles: Bubble[]) => {
      setImages(prev => prev.map(img => img.id === imgId ? { ...img, bubbles: newBubbles } : img));
  }, [setImages]);

  const reorderBubble = useCallback((bubbleId: string, direction: 'front' | 'back' | 'forward' | 'backward') => {
    if (!currentId) return;
    
    setImages(prev => prev.map(img => {
        if (img.id !== currentId) return img;
        
        const idx = img.bubbles.findIndex(b => b.id === bubbleId);
        if (idx === -1) return img;
        
        const newBubbles = [...img.bubbles];
        const [item] = newBubbles.splice(idx, 1);
        
        if (direction === 'front') {
            newBubbles.push(item);
        } else if (direction === 'back') {
            newBubbles.unshift(item);
        } else if (direction === 'forward') {
            const newIndex = Math.min(idx + 1, newBubbles.length);
            newBubbles.splice(newIndex, 0, item);
        } else if (direction === 'backward') {
            const newIndex = Math.max(idx - 1, 0);
            newBubbles.splice(newIndex, 0, item);
        }
        
        return { ...img, bubbles: newBubbles };
    }));
  }, [currentId, setImages]);

  // Combined Context Value
  const value: ProjectContextType = {
    ...projectState,
    ...processor,
    aiConfig,
    setAiConfig,
    drawTool,
    setDrawTool,
    showSettings, setShowSettings,
    showManualJson, setShowManualJson,
    showHelp, setShowHelp,
    isDetectionGuideMode, setIsDetectionGuideMode,
    concurrency, setConcurrency: handleSetConcurrency,
    isMerging, setIsMerging,
    isZipping, setIsZipping,
    zipProgress, setZipProgress,
    zipCancelRequested,
    requestZipCancel: () => setZipCancelRequested(true),
    resetZipCancel: () => setZipCancelRequested(false),
    showGlobalStyles, setShowGlobalStyles,
    activeLayer, setActiveLayer,
    updateBubble,
    updateImageBubbles,
    updateMaskRegion,
    triggerAutoColorDetection,
    reorderBubble,
    aiConfigRef,
    // processor actions wrappers
    handleBatchProcess: processor.handleBatchProcess,
    handleResetStatus: processor.handleResetStatus,
    handleLocalDetectionScan: processor.handleLocalDetectionScan,
    handleGlobalColorDetection: processor.handleGlobalColorDetection,
    handleBatchInpaint: processor.handleBatchInpaint,
    // inpainting & fill
    handleInpaint,
    handleApplyWorkshopResult,
    isInpainting,
    handleRestoreRegion,
    handlePaintSave,
    registerPaintFlushHandler,
    flushPendingCommands,
    handleBoxFill,
    handleBatchBoxFill,
    // Brush
    brushColor, setBrushColor,
    brushSize, setBrushSize,
    paintMode, setPaintMode,
    brushType, setBrushType,
    screenshotReady
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};
