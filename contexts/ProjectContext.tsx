import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { ImageState, Bubble, AIConfig, ViewLayer } from '../types';
import { useProjectState } from '../hooks/useProjectState';
import { useProcessor } from '../hooks/useProcessor';
import { DEFAULT_SYSTEM_PROMPT } from '../services/geminiService';
import { detectBubbleColor, generateInpaintMask, restoreImageRegion } from '../services/exportService';
import { inpaintImage } from '../services/inpaintingService';

const STORAGE_KEY = 'mangatype_live_settings_v1';

const DEFAULT_CONFIG: AIConfig = {
  provider: 'gemini',
  apiKey: '', 
  baseUrl: '',
  model: 'gemini-3-flash-preview',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  defaultFontSize: 1.0,
  useTextDetectionApi: false,
  textDetectionApiUrl: 'http://localhost:5000',
  language: 'zh',
  customMessages: [{ role: 'user', content: '翻译' }],
  autoDetectBackground: false,
  enableDialogSnap: true,
  forceSnapSize: false,
  enableMaskedImageMode: false,
  useMasksAsHints: false,
  allowAiFontSelection: true,
  defaultMaskShape: 'rectangle', 
  defaultMaskCornerRadius: 20,
  defaultMaskFeather: 0,
  // Inpainting defaults
  enableInpainting: false,
  inpaintingUrl: 'http://localhost:8080',
  inpaintingModel: 'lama',
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
  handleBatchProcess: (currentImage: ImageState | undefined, onlyCurrent: boolean, concurrency: number) => void;
  handleResetStatus: () => void;
  handleLocalDetectionScan: (currentImage: ImageState | undefined, batch: boolean, concurrency: number) => void;
  handleBatchInpaint: (currentImage: ImageState | undefined, onlyCurrent: boolean, concurrency: number) => void;
  stopProcessing: () => void;
  handleGlobalColorDetection: (concurrency: number) => void;

  // Inpainting Actions (Single specific mask)
  handleInpaint: (imageId: string, specificMaskId?: string) => Promise<void>;
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

  // Actions
  updateBubble: (bubbleId: string, updates: Partial<Bubble>) => void;
  updateImageBubbles: (imgId: string, newBubbles: Bubble[]) => void;
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
        return { ...DEFAULT_CONFIG, ...parsed };
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
  const [concurrency, setConcurrency] = useState(1);
  const [isMerging, setIsMerging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 });
  const [showGlobalStyles, setShowGlobalStyles] = useState(false);
  const [activeLayer, setActiveLayer] = useState<ViewLayer>('final');
  
  // Brush State
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(20);
  const [paintMode, setPaintMode] = useState<'brush' | 'box'>('brush');

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
            const newMasks = (p.maskRegions || []).map(m => m.id === specificMaskId ? { ...m, isCleaned: true } : m);
            
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

  // Handle Box Fill (Whitening or Coloring)
  const handleBoxFill = useCallback(async (imageId: string, maskId: string, color: string) => {
    const img = historyRef.current.present.find(i => i.id === imageId);
    if (!img) return;
    const mask = img.maskRegions?.find(m => m.id === maskId);
    if (!mask) return;

    try {
        // Load current clean layer (or original) into canvas
        const sourceUrl = img.inpaintedUrl || img.originalUrl || img.url;
        const image = new Image();
        image.crossOrigin = 'Anonymous';
        image.src = sourceUrl;
        
        await new Promise((resolve) => { image.onload = resolve; });
        
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(image, 0, 0);

        // Draw the fill
        const x = (mask.x / 100) * canvas.width;
        const y = (mask.y / 100) * canvas.height;
        const w = (mask.width / 100) * canvas.width;
        const h = (mask.height / 100) * canvas.height;

        ctx.fillStyle = color;
        ctx.fillRect(x - w/2, y - h/2, w, h);

        const newBase64 = canvas.toDataURL('image/png');
        
        setImages(prev => prev.map(p => {
            if (p.id !== imageId) return p;

            // Mark mask as cleaned/filled
            const newMasks = (p.maskRegions || []).map(m => m.id === maskId ? { ...m, isCleaned: true } : m);

            // Update overlapping bubbles
            const newBubbles = p.bubbles.map(b => {
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
                ...p,
                base64: newBase64.replace(/^data:image\/\w+;base64,/, ""),
                url: newBase64,
                inpaintedUrl: newBase64,
                inpaintedBase64: newBase64.replace(/^data:image\/\w+;base64,/, ""),
                inpaintingStatus: 'done',
                maskRegions: newMasks,
                bubbles: newBubbles
            };
        }));
        
        setActiveLayer('clean');

    } catch (e) {
        console.error("Box fill failed", e);
    }
  }, [setImages, historyRef, setActiveLayer]);

  // Handle Batch Box Fill
  const handleBatchBoxFill = useCallback(async (scope: 'current' | 'all', color: string) => {
    const targets = scope === 'current'
        ? (currentId ? historyRef.current.present.filter(i => i.id === currentId) : [])
        : historyRef.current.present.filter(i => !i.skipped);

    if (targets.length === 0) return;

    setIsInpainting(true); // Reuse loading state

    try {
        const updates = await Promise.all(targets.map(async (img) => {
            if (!img.maskRegions || img.maskRegions.length === 0) return null;

            const sourceUrl = img.inpaintedUrl || img.originalUrl || img.url;
            const image = new Image();
            image.crossOrigin = 'Anonymous';
            image.src = sourceUrl;
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = resolve; // Continue even if one fails
            });

            if (!image.width) return null;

            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            ctx.drawImage(image, 0, 0);
            ctx.fillStyle = color;

            // Draw all masks
            img.maskRegions.forEach(mask => {
                const x = (mask.x / 100) * canvas.width;
                const y = (mask.y / 100) * canvas.height;
                const w = (mask.width / 100) * canvas.width;
                const h = (mask.height / 100) * canvas.height;
                ctx.fillRect(x - w/2, y - h/2, w, h);
            });

            const newBase64 = canvas.toDataURL('image/png');
            const dataUrlContent = newBase64.replace(/^data:image\/\w+;base64,/, "");

            // Update masks status
            const newMasks = img.maskRegions.map(m => ({ ...m, isCleaned: true }));

            // Update bubbles overlapping
            const newBubbles = img.bubbles.map(b => {
                // Check overlap with ANY mask
                const overlaps = newMasks.some(mask => {
                    const xDiff = Math.abs(b.x - mask.x);
                    const yDiff = Math.abs(b.y - mask.y);
                    const halfW = mask.width / 2;
                    const halfH = mask.height / 2;
                    return xDiff <= halfW && yDiff <= halfH;
                });
                if (overlaps) {
                    return { ...b, backgroundColor: 'transparent', autoDetectBackground: false };
                }
                return b;
            });

            return {
                id: img.id,
                updates: {
                    base64: dataUrlContent,
                    url: newBase64,
                    inpaintedUrl: newBase64,
                    inpaintedBase64: dataUrlContent,
                    inpaintingStatus: 'done',
                    maskRegions: newMasks,
                    bubbles: newBubbles
                }
            };
        }));

        setImages(prev => prev.map(p => {
            const update = updates.find(u => u && u.id === p.id);
            if (update) {
                // Cast to any to merge properly or define partial
                return { ...p, ...(update.updates as any) };
            }
            return p;
        }));

        // Switch active layer to 'clean' if we modified the current image
        if (scope === 'current' || targets.some(t => t.id === currentId)) {
            setActiveLayer('clean');
        }

    } catch (e: any) {
        console.error("Batch box fill failed", e);
        alert("Batch fill failed: " + e.message);
    } finally {
        setIsInpainting(false);
    }
  }, [currentId, historyRef, setImages, setActiveLayer, setIsInpainting]);

  // Restore Region
  const handleRestoreRegion = useCallback(async (imageId: string, regionId: string) => {
      const img = historyRef.current.present.find(i => i.id === imageId);
      if (!img) return;

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
                  // Note: We don't necessarily need to turn transparent bubbles back to white here, 
                  // as they might just be transparent by user choice. But if strict reversal is needed, we could.
                  // For now, let's leave bubbles as is.
              } : p));
              setActiveLayer('clean');
          }
      } catch (e) {
          console.error("Restore failed", e);
      }
  }, [setImages, historyRef, setActiveLayer]);

  // Save manual paint result
  const handlePaintSave = useCallback((imageId: string, newBase64: string) => {
      setImages(prev => prev.map(p => p.id === imageId ? {
          ...p,
          base64: newBase64.replace(/^data:image\/\w+;base64,/, ""),
          url: newBase64,
          inpaintedUrl: newBase64,
          inpaintedBase64: newBase64.replace(/^data:image\/\w+;base64,/, ""),
          inpaintingStatus: 'done'
      } : p));
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
                  const shouldDetect = bubble.autoDetectBackground !== undefined ? bubble.autoDetectBackground : aiConfigRef.current.autoDetectBackground;
                  if (shouldDetect === false) return; 
                  const detectedColor = await detectBubbleColor(imgState.url || `data:image/png;base64,${imgState.base64}`, bubble.x, bubble.y, bubble.width, bubble.height);
                  setImages(prev => prev.map(img => img.id === currentId ? { ...img, bubbles: img.bubbles.map(b => b.id === bubbleId ? { ...b, backgroundColor: detectedColor } : b) } : img));
              }
          }
      }, 300);
  }, [currentId, setImages, historyRef]);

  const updateBubble = useCallback((bubbleId: string, updates: Partial<Bubble>) => {
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
            const overlaps = cleanedMasks.some(m => {
                 const xDiff = Math.abs(tempBubble.x - m.x);
                 const yDiff = Math.abs(tempBubble.y - m.y);
                 const halfW = m.width / 2;
                 const halfH = m.height / 2;
                 return xDiff <= halfW && yDiff <= halfH;
            });

            if (overlaps) {
                finalUpdates.backgroundColor = 'transparent';
                finalUpdates.autoDetectBackground = false; 
            }
        }
    }
    
    setImages(prev => prev.map(img => img.id === currentId ? { 
        ...img, 
        bubbles: img.bubbles.map(b => b.id === bubbleId ? { ...b, ...finalUpdates } : b) 
    } : img));

    if (finalUpdates.autoDetectBackground === true) triggerAutoColorDetection(bubbleId);
  }, [currentId, setImages, triggerAutoColorDetection, historyRef]);

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
    concurrency, setConcurrency,
    isMerging, setIsMerging,
    isZipping, setIsZipping,
    zipProgress, setZipProgress,
    showGlobalStyles, setShowGlobalStyles,
    activeLayer, setActiveLayer,
    updateBubble,
    updateImageBubbles,
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
    isInpainting,
    handleRestoreRegion,
    handlePaintSave,
    handleBoxFill,
    handleBatchBoxFill,
    // Brush
    brushColor, setBrushColor,
    brushSize, setBrushSize,
    paintMode, setPaintMode
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};