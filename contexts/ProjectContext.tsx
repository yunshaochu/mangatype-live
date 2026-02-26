import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { ImageState, Bubble, AIConfig, APIEndpoint, ViewLayer, MaskRegion } from '../types';
import { useProjectState } from '../hooks/useProjectState';
import { useProcessor } from '../hooks/useProcessor';
import { DEFAULT_SYSTEM_PROMPT } from '../services/geminiService';
import { isBubbleInsideMask } from '../utils/editorUtils';
import { detectBubbleColor, generateInpaintMask, restoreImageRegion, compositeRegionIntoImage } from '../services/exportService';
import { inpaintImage } from '../services/inpaintingService';

const STORAGE_KEY = 'mangatype_live_settings_v1';

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

const DEFAULT_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  endpoints: [{
    id: 'default-openai',
    name: 'Openai',
    enabled: true,
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
  }],
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
  // Model Capabilities (undefined = enabled by default)
  // modelSupportsFunctionCalling: undefined, // Set to false to skip Function Calling tier
  // modelSupportsJsonMode: undefined, // Set to false to skip JSON Mode tier
  // Inpainting defaults
  enableInpainting: false,
  inpaintingUrl: runtimeConfig.IOPAINT_API_URL || 'http://localhost:8080',
  inpaintingModel: 'lama',
  screenshotPunctuationOffsets: [
    { char: '！', offsetX: -0.25 },
    { char: '？', offsetX: -0.25 },
    { char: '…', offsetX: 0.25 },
  ],
  editorPunctuationOffsets: [
    { char: '！', offsetX: -0.25 },
    { char: '？', offsetX: -0.25 },
  ],
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
  concurrency: number;
  setConcurrency: (n: number) => void;
  isMerging: boolean;
  setIsMerging: (v: boolean) => void;
  isZipping: boolean;
  setIsZipping: (v: boolean) => void;
  zipProgress: { current: number; total: number };
  setZipProgress: (p: { current: number; total: number }) => void;
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
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.customMessages) parsed.customMessages = DEFAULT_CONFIG.customMessages;

        // Migrate old punctuation offset format { char, offset } → { char, offsetX }
        const migratePunctuation = (arr: any[]) => arr.map((o: any) =>
          'offset' in o && !('offsetX' in o) ? { char: o.char, offsetX: o.offset } : o
        );
        if (parsed.screenshotPunctuationOffsets) {
          parsed.screenshotPunctuationOffsets = migratePunctuation(parsed.screenshotPunctuationOffsets);
        }
        if (parsed.editorPunctuationOffsets) {
          parsed.editorPunctuationOffsets = migratePunctuation(parsed.editorPunctuationOffsets);
        }

        // Merge with defaults
        const merged = { ...DEFAULT_CONFIG, ...parsed };
        
        // --- Runtime Config Priority Logic ---
        const runtime = getRuntimeConfig();

        // 1. Text Detection API
        // If runtime URL exists AND user is still using the default localhost URL, upgrade it.
        // If user changed it manually, respect their choice.
        if (runtime.TEXT_DETECTION_API_URL) {
            if (parsed.textDetectionApiUrl === 'http://localhost:5000') {
                merged.textDetectionApiUrl = runtime.TEXT_DETECTION_API_URL;
            }
        }

        // 2. Inpainting API
        if (runtime.IOPAINT_API_URL) {
            if (parsed.inpaintingUrl === 'http://localhost:8080') {
                merged.inpaintingUrl = runtime.IOPAINT_API_URL;
            }
        }

        // 3. Migrate old flat config to endpoints array
        if (!parsed.endpoints || !Array.isArray(parsed.endpoints) || parsed.endpoints.length === 0) {
            merged.endpoints = [{
                id: crypto.randomUUID(),
                name: parsed.provider === 'openai' ? 'OpenAI (Migrated)' : 'Gemini (Migrated)',
                enabled: true,
                provider: parsed.provider || 'openai',
                apiKey: parsed.apiKey || '',
                baseUrl: parsed.baseUrl || '',
                model: parsed.model || 'gemini-3-flash-preview',
                modelSupportsFunctionCalling: parsed.modelSupportsFunctionCalling,
                modelSupportsJsonMode: parsed.modelSupportsJsonMode,
            }];
        }

        return merged;
      }
    } catch (e) { console.warn("Failed to load settings", e); }
    return DEFAULT_CONFIG;
  });

  const aiConfigRef = useRef(aiConfig);
  useEffect(() => {
    aiConfigRef.current = aiConfig;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(aiConfig)); } catch (e) { console.warn("Failed to save settings", e); }
  }, [aiConfig]);

  // MOVED UP: UI State (so setActiveLayer is available for handlers below)
  const [drawTool, setDrawTool] = useState<'none' | 'bubble' | 'mask' | 'brush'>('none');
  const [showSettings, setShowSettings] = useState(false);
  const [showManualJson, setShowManualJson] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [concurrency, setConcurrency] = useState(aiConfig.concurrency || 1);

  // Sync concurrency to aiConfig for persistence
  const handleSetConcurrency = (n: number) => {
    setConcurrency(n);
    setAiConfig({ ...aiConfig, concurrency: n });
  };
  const [isMerging, setIsMerging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 });
  const [showGlobalStyles, setShowGlobalStyles] = useState(false);
  const [activeLayer, setActiveLayer] = useState<ViewLayer>('final');
  
  // Brush State
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(20);
  const [paintMode, setPaintMode] = useState<'brush' | 'box'>('brush');
  const [brushType, setBrushType] = useState<'paint' | 'restore'>('paint');

  // 3. Processor Logic
  const processor = useProcessor({ images, setImages, aiConfig });

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
        const sourceBase64 = img.inpaintedBase64 || img.originalBase64 || img.base64;

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

  // Handle Box Fill (OPTIMIZED: Metadata Update Only)
  const handleBoxFill = useCallback(async (imageId: string, maskId: string, color: string) => {
    // Just update the metadata. Rendering happens in Workspace via CSS overlay.
    setImages(prev => prev.map(img => {
        if (img.id !== imageId) return img;
        
        const mask = (img.maskRegions || []).find(m => m.id === maskId);
        if (!mask) return img;

        // Update masks status
        const newMasks = (img.maskRegions || []).map(m => m.id === maskId ? { ...m, isCleaned: true, method: 'fill' as const, fillColor: color } : m);

        // Update overlapping bubbles to transparent
        const newBubbles = img.bubbles.map(b => {
            const xDiff = Math.abs(b.x - mask.x);
            const yDiff = Math.abs(b.y - mask.y);
            const halfW = mask.width / 2;
            const halfH = mask.height / 2;
            const overlaps = xDiff <= halfW && yDiff <= halfH;
            if (overlaps) {
                return { ...b, backgroundColor: 'transparent', autoDetectBackground: false };
            }
            return b;
        });

        return {
            ...img,
            inpaintingStatus: 'done', // Mark as "processed" so UI shows filled
            maskRegions: newMasks,
            bubbles: newBubbles
        };
    }));
    setActiveLayer('clean');
  }, [setImages, setActiveLayer]);

  // Handle Batch Box Fill (OPTIMIZED: Metadata Update Only)
  const handleBatchBoxFill = useCallback(async (scope: 'current' | 'all', color: string) => {
    const targetIds = new Set(
        scope === 'current'
        ? (currentId ? [currentId] : [])
        : historyRef.current.present.filter(i => !i.skipped).map(i => i.id)
    );

    if (targetIds.size === 0) return;

    setImages(prev => prev.map(img => {
        if (!targetIds.has(img.id)) return img;

        // Filter masks: Must NOT be 'inpaint' method AND must NOT be already cleaned
        // This prevents overwriting already filled or inpainted masks
        const masksToFill = (img.maskRegions || []).filter(m => m.method !== 'inpaint' && !m.isCleaned);
        
        if (masksToFill.length === 0) return img;

        // Update masks status
        const filledIds = new Set(masksToFill.map(m => m.id));
        const newMasks = (img.maskRegions || []).map(m => filledIds.has(m.id) ? { ...m, isCleaned: true, method: 'fill' as const, fillColor: color } : m);

        // Update bubbles overlapping with FILLED masks
        const newBubbles = img.bubbles.map(b => {
            const overlaps = masksToFill.some(mask => isBubbleInsideMask(b.x, b.y, mask.x, mask.y, mask.width, mask.height));
            if (overlaps) {
                return { ...b, backgroundColor: 'transparent', autoDetectBackground: false };
            }
            return b;
        });

        return {
            ...img,
            inpaintingStatus: 'done',
            maskRegions: newMasks,
            bubbles: newBubbles
        };
    }));

    if (scope === 'current' || (currentId && targetIds.has(currentId))) {
        setActiveLayer('clean');
    }
  }, [currentId, historyRef, setImages, setActiveLayer]);

  // Restore Region
  const handleRestoreRegion = useCallback(async (imageId: string, regionId: string) => {
      const img = historyRef.current.present.find(i => i.id === imageId);
      if (!img) return;

      const region = img.maskRegions?.find(m => m.id === regionId);
      if (!region) return;

      // If it was a 'fill' region, just metadata update (Instant)
      if (region.method === 'fill') {
          setImages(prev => prev.map(p => p.id === imageId ? {
              ...p,
              maskRegions: (p.maskRegions || []).map(m => m.id === regionId ? { ...m, isCleaned: false, fillColor: undefined } : m)
          } : p));
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

  // Save manual paint result
  const handlePaintSave = useCallback((imageId: string, newBase64: string) => {
      setImages(prev => prev.map(p => {
          if (p.id !== imageId) return p;

          // When we save the paint canvas, any 'filled' masks (Box Tool) that were visible 
          // are now baked into the pixels. We must disable their virtual DOM rendering 
          // to prevent them from appearing on top of the restored areas.
          const newMasks = (p.maskRegions || []).map(m => {
              if (m.method === 'fill' && m.isCleaned) {
                  return { ...m, isCleaned: false, fillColor: undefined };
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
      }));
  }, [setImages]);

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
                  const cleanedMasks = (imgState.maskRegions || []).filter(m => m.isCleaned);
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
                  setImages(prev => prev.map(img => img.id === currentId ? { ...img, bubbles: img.bubbles.map(b => b.id === bubbleId ? { ...b, backgroundColor: detectedColor } : b) } : img));
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
            const cleanedMasks = (currentImg.maskRegions || []).filter(m => m.isCleaned);
            
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
      setImages(prev => prev.map(img => img.id === currentId ? {
          ...img,
          maskRegions: (img.maskRegions || []).map(m => m.id === maskId ? { ...m, ...updates } : m)
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
    concurrency, setConcurrency: handleSetConcurrency,
    isMerging, setIsMerging,
    isZipping, setIsZipping,
    zipProgress, setZipProgress,
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
    handleBoxFill,
    handleBatchBoxFill,
    // Brush
    brushColor, setBrushColor,
    brushSize, setBrushSize,
    paintMode, setPaintMode,
    brushType, setBrushType
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};