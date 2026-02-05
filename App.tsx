import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BubbleEditor } from './components/BubbleEditor';
import { SettingsModal } from './components/SettingsModal';
import { ManualJsonModal } from './components/ManualJsonModal';
import { HelpModal } from './components/HelpModal';
import { Gallery } from './components/Gallery';
import { Bubble, ImageState, AIConfig, MaskRegion, DetectedBubble } from './types';
import { Upload, Download, Plus, Maximize, Loader2, Settings, FileJson, Archive, Play, Layers, Image as ImageIcon, Undo2, Redo2, FileStack, Minus, Type, MessageSquareDashed, CircleHelp, Square, Crop, X, MousePointer2, Scan, ScanFace, FilePlus, ChevronUp, ChevronDown, Palette, Sparkles, ScanText, Zap } from 'lucide-react';
import { detectAndTypesetComic, DEFAULT_SYSTEM_PROMPT, fetchRawDetectedRegions } from './services/geminiService';
import { downloadSingleImage, downloadAllAsZip, compositeImage, generateMaskedImage, detectBubbleColor } from './services/exportService';
import { t } from './services/i18n';

// Storage Key for localStorage
const STORAGE_KEY = 'mangatype_live_settings_v1';

// Default Configuration
const DEFAULT_CONFIG: AIConfig = {
  provider: 'gemini',
  apiKey: '', 
  baseUrl: '',
  model: 'gemini-3-flash-preview',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  defaultFontSize: 1.0,
  useTextDetectionApi: false,
  textDetectionApiUrl: 'http://localhost:5000',
  language: 'zh', // Default to Chinese
  customMessages: [
    { role: 'user', content: '翻译' }
  ],
  autoDetectBackground: false, // Default to false
  enableDialogSnap: true, // Default to true
  forceSnapSize: false, // Default to false
  enableMaskedImageMode: false, // Default false
  useMasksAsHints: false, // Default false
  // Defaults for masks
  defaultMaskShape: 'ellipse',
  defaultMaskCornerRadius: 20, // Only for rounded
  defaultMaskFeather: 12, // Intensity
};

// Updated createBubble to accept a default font size
const createBubble = (x: number, y: number, defaultFontSize: number, width = 15, height = 25, isVertical = true): Bubble => ({
  id: crypto.randomUUID(),
  x,
  y,
  width,
  height,
  text: '...',
  isVertical,
  fontFamily: 'zhimang', // Default to cursive style as requested
  fontSize: defaultFontSize,
  color: '#0f172a',
  backgroundColor: '#ffffff',
  rotation: 0,
});

// Create Mask Region for Mode 2
const createMaskRegion = (x: number, y: number): MaskRegion => ({
    id: crypto.randomUUID(),
    x, y, width: 0, height: 0
});

// Helper to clamp values between min and max
const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

// --- Handle Helpers ---
type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const handleStyle = (cursor: string): React.CSSProperties => ({
    position: 'absolute',
    width: '10px',
    height: '10px',
    backgroundColor: '#ffffff',
    border: '2px solid #3b82f6', // blue-500
    borderRadius: '50%',
    zIndex: 30,
    cursor: cursor,
    pointerEvents: 'auto',
    boxShadow: '0 0 4px rgba(0,0,0,0.4)',
});

const HANDLE_OFFSET = '-6px'; 

// --- Bubble Component (Mode 1) ---

interface BubbleLayerProps {
  bubble: Bubble;
  isSelected: boolean;
  config: AIConfig; // Need config for defaults
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: HandleType) => void;
  onUpdate: (id: string, updates: Partial<Bubble>) => void;
  onDelete: () => void;
  onTriggerAutoColor: (id: string) => void; // New prop for wheel events
}

const BubbleLayer: React.FC<BubbleLayerProps> = React.memo(({ bubble, isSelected, config, onMouseDown, onResizeStart, onUpdate, onDelete, onTriggerAutoColor }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef(bubble);
  bubbleRef.current = bubble;

  // Determine Effective Mask Style (Bubble Prop > Global Config)
  const shape = bubble.maskShape || config.defaultMaskShape || 'ellipse';
  const radiusVal = bubble.maskCornerRadius !== undefined ? bubble.maskCornerRadius : (config.defaultMaskCornerRadius || 15);
  const featherVal = bubble.maskFeather !== undefined ? bubble.maskFeather : (config.defaultMaskFeather || 10);

  let borderRadius = '0%';
  if (shape === 'ellipse') borderRadius = '50%';
  else if (shape === 'rounded') borderRadius = `${radiusVal}%`;
  
  // Calculate dynamic blur relative to size, but scaled by feather factor
  const blur = `calc(${featherVal * 0.15}cqw)`;
  const spread = `calc(${featherVal * 0.08}cqw)`;
  const boxShadow = (bubble.backgroundColor !== 'transparent' && featherVal > 0)
    ? `0 0 ${blur} ${spread} ${bubble.backgroundColor}` 
    : 'none';

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!isSelected) return;

      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault(); 
        e.stopPropagation(); 

        const currentBubble = bubbleRef.current;
        const delta = e.deltaY > 0 ? -1 : 1;

        if (e.ctrlKey || e.metaKey) {
            // Ctrl + Wheel: Font Size
            const step = 0.1;
            const newSize = Math.max(0.5, Math.min(10, currentBubble.fontSize + (delta * step)));
            onUpdate(currentBubble.id, { fontSize: parseFloat(newSize.toFixed(1)) });
        } else if (e.altKey) {
            // Alt + Wheel: Mask Size
            const scale = delta > 0 ? 1.05 : 0.95;
            let newWidth = currentBubble.width * scale;
            let newHeight = currentBubble.height * scale;
            newWidth = clamp(newWidth, 2, 100);
            newHeight = clamp(newHeight, 2, 100);
            onUpdate(currentBubble.id, {
                width: parseFloat(newWidth.toFixed(1)),
                height: parseFloat(newHeight.toFixed(1))
            });
            // Trigger auto color detection on resize (debounced by parent)
            onTriggerAutoColor(currentBubble.id);
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [isSelected, onUpdate, onTriggerAutoColor]);

  return (
    <div
      ref={divRef}
      onMouseDown={onMouseDown}
      className={`absolute cursor-move select-none z-10 group`}
      style={{
        top: `${bubble.y}%`,
        left: `${bubble.x}%`,
        width: `${bubble.width}%`,
        height: `${bubble.height}%`,
        transform: `translate(-50%, -50%) rotate(${bubble.rotation}deg)`,
      }}
    >
      {/* Mask Layer */}
      <div 
        className="absolute inset-0 transition-colors duration-200"
        style={{ 
          backgroundColor: bubble.backgroundColor,
          borderRadius: borderRadius,
          boxShadow: boxShadow
        }}
      />

      {/* Selection Indicator & Handles */}
      {isSelected && (
        <>
            <div 
                className="absolute inset-0 border-2 border-blue-500 pointer-events-none z-20 opacity-80 shadow-sm"
                style={{ borderRadius: borderRadius }}
            ></div>
            <div 
              className="absolute -top-8 left-1/2 -translate-x-1/2 cursor-pointer z-40 transform hover:scale-110 transition-transform"
              onMouseDown={(e) => { e.stopPropagation(); onDelete(); }}
            >
               <div className="bg-red-500 text-white rounded-full p-1.5 shadow-md border-2 border-white hover:bg-red-600">
                 <X size={14} strokeWidth={3} />
               </div>
            </div>
            <div style={{ ...handleStyle('nw-resize'), top: HANDLE_OFFSET, left: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'nw')} />
            <div style={{ ...handleStyle('ne-resize'), top: HANDLE_OFFSET, right: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'ne')} />
            <div style={{ ...handleStyle('se-resize'), bottom: HANDLE_OFFSET, right: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'se')} />
            <div style={{ ...handleStyle('sw-resize'), bottom: HANDLE_OFFSET, left: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'sw')} />
            <div style={{ ...handleStyle('n-resize'), top: HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'n')} />
            <div style={{ ...handleStyle('e-resize'), top: '50%', right: HANDLE_OFFSET, transform: 'translateY(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'e')} />
            <div style={{ ...handleStyle('s-resize'), bottom: HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => onResizeStart(e, 's')} />
            <div style={{ ...handleStyle('w-resize'), top: '50%', left: HANDLE_OFFSET, transform: 'translateY(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'w')} />
        </>
      )}
      
      {/* Text Layer */}
      <div 
        className={`absolute inset-0 flex items-center justify-center ${
          bubble.fontFamily === 'zhimang' ? 'font-zhimang' : 
          bubble.fontFamily === 'mashan' ? 'font-mashan' : 'font-noto'
        } leading-[1.2] overflow-visible text-center`}
        style={{
          fontSize: `${bubble.fontSize * 2}cqw`,
          color: bubble.color,
          writingMode: bubble.isVertical ? 'vertical-rl' : 'horizontal-tb',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.5',
          textAlign: bubble.isVertical ? 'left' : 'center',
          WebkitTextStroke: '3px #ffffff',
          paintOrder: 'stroke fill',
        }}
      >
        {bubble.text}
      </div>
    </div>
  );
}, (prev, next) => {
    return (
        prev.isSelected === next.isSelected && 
        prev.bubble === next.bubble &&
        prev.config.defaultMaskShape === next.config.defaultMaskShape &&
        prev.config.defaultMaskCornerRadius === next.config.defaultMaskCornerRadius &&
        prev.config.defaultMaskFeather === next.config.defaultMaskFeather
    );
});

// --- Region Component (Mode 2) ---

interface RegionLayerProps {
  region: MaskRegion;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: HandleType) => void;
  onDelete: () => void;
}

const RegionLayer: React.FC<RegionLayerProps> = React.memo(({ region, isSelected, onMouseDown, onResizeStart, onDelete }) => {
    const regionHandleStyle = (cursor: string): React.CSSProperties => ({
        ...handleStyle(cursor),
        borderColor: '#ef4444', 
    });

    return (
        <div
            onMouseDown={onMouseDown}
            className={`absolute cursor-move select-none z-30 group`} 
            style={{
                top: `${region.y}%`,
                left: `${region.x}%`,
                width: `${region.width}%`,
                height: `${region.height}%`,
                transform: `translate(-50%, -50%)`, 
            }}
        >
            <div className={`absolute inset-0 border-2 border-dashed border-red-500 bg-red-500/10 pointer-events-none transition-opacity ${isSelected ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}></div>

            {isSelected && (
                <>
                    <div 
                        className="absolute -top-8 left-1/2 -translate-x-1/2 cursor-pointer z-40 transform hover:scale-110 transition-transform"
                        onMouseDown={(e) => { e.stopPropagation(); onDelete(); }}
                    >
                        <div className="bg-red-500 text-white rounded-full p-1.5 shadow-md border-2 border-white hover:bg-red-600">
                            <X size={14} strokeWidth={3} />
                        </div>
                    </div>
                    <div style={{ ...regionHandleStyle('nw-resize'), top: HANDLE_OFFSET, left: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'nw')} />
                    <div style={{ ...regionHandleStyle('ne-resize'), top: HANDLE_OFFSET, right: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'ne')} />
                    <div style={{ ...regionHandleStyle('se-resize'), bottom: HANDLE_OFFSET, right: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'se')} />
                    <div style={{ ...regionHandleStyle('sw-resize'), bottom: HANDLE_OFFSET, left: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'sw')} />
                    <div style={{ ...regionHandleStyle('n-resize'), top: HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'n')} />
                    <div style={{ ...regionHandleStyle('e-resize'), top: '50%', right: HANDLE_OFFSET, transform: 'translateY(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'e')} />
                    <div style={{ ...regionHandleStyle('s-resize'), bottom: HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => onResizeStart(e, 's')} />
                    <div style={{ ...regionHandleStyle('w-resize'), top: '50%', left: HANDLE_OFFSET, transform: 'translateY(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'w')} />
                </>
            )}
        </div>
    );
}, (prev, next) => {
    return prev.isSelected === next.isSelected && prev.region === next.region;
});


const App: React.FC = () => {
  const [history, setHistory] = useState<{
    past: ImageState[][];
    present: ImageState[];
    future: ImageState[][];
  }>({
    past: [],
    present: [],
    future: []
  });

  const historyRef = useRef(history);
  historyRef.current = history;

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null); 
  
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showManualJson, setShowManualJson] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [concurrency, setConcurrency] = useState(1);
  const [isMerging, setIsMerging] = useState(false);
  const [showGlobalStyles, setShowGlobalStyles] = useState(false); 
  const [drawTool, setDrawTool] = useState<'none' | 'bubble' | 'mask'>('none'); 
  
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

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(aiConfig)); } catch (e) { console.warn("Failed to save settings", e); }
  }, [aiConfig]);

  const aiConfigRef = useRef(aiConfig);
  aiConfigRef.current = aiConfig;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const detectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dragRef = useRef<{ 
    mode: 'move' | 'resize' | 'drawing';
    targetType: 'bubble' | 'mask';
    id: string;
    handle?: HandleType; 
    startX: number; 
    startY: number; 
    startBx: number; 
    startBy: number;
    startBw: number;
    startBh: number;
    rotation: number;
    initialSnapshot: ImageState[]; 
    hasMoved: boolean;
  } | null>(null);

  const images = history.present;
  const currentImage = images.find(img => img.id === currentId);
  const bubbles = currentImage?.bubbles || [];
  const maskRegions = currentImage?.maskRegions || []; 
  const selectedBubble = selectedBubbleId ? bubbles.find(b => b.id === selectedBubbleId) : undefined;
  
  const lang = aiConfig.language; 

  const setImages = (
    newImagesOrUpdater: ImageState[] | ((prev: ImageState[]) => ImageState[]), 
    skipHistory: boolean = false
  ) => {
    setHistory(curr => {
      const newPresent = typeof newImagesOrUpdater === 'function' ? newImagesOrUpdater(curr.present) : newImagesOrUpdater;
      if (newPresent === curr.present) return curr;
      if (skipHistory) return { ...curr, present: newPresent };
      return {
        past: [...curr.past, curr.present].slice(-20),
        present: newPresent,
        future: []
      };
    });
  };

  const handleUndo = useCallback(() => {
    setHistory(curr => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, curr.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [curr.present, ...curr.future]
      };
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistory(curr => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const newFuture = curr.future.slice(1);
      return {
        past: [...curr.past, curr.present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      if (!isInput && (e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? handleRedo() : handleUndo();
      } else if (!isInput && (e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }

      if (!isInput && currentId) {
          const currentIndex = images.findIndex(img => img.id === currentId);
          if (e.key === 'ArrowLeft' && currentIndex > 0) {
              e.preventDefault();
              setCurrentId(images[currentIndex - 1].id);
              setSelectedBubbleId(null);
              setSelectedMaskId(null);
          } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
              e.preventDefault();
              setCurrentId(images[currentIndex + 1].id);
              setSelectedBubbleId(null);
              setSelectedMaskId(null);
          }
      }

      if (!isInput && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedBubbleId && currentId) {
             e.preventDefault();
             setImages(prev => prev.map(img => img.id === currentId ? { ...img, bubbles: img.bubbles.filter(b => b.id !== selectedBubbleId) } : img));
             setSelectedBubbleId(null);
        } else if (selectedMaskId && currentId) {
             e.preventDefault();
             setImages(prev => prev.map(img => img.id === currentId ? { ...img, maskRegions: (img.maskRegions || []).filter(m => m.id !== selectedMaskId) } : img));
             setSelectedMaskId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedBubbleId, selectedMaskId, currentId, images]);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const processFiles = async (inputFiles: FileList | File[]) => {
    const files = Array.from(inputFiles);
    const newImages: ImageState[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      
      try {
        const url = URL.createObjectURL(file);
        const base64 = await blobToBase64(file);
        
        const loadedImgState = await new Promise<ImageState | null>((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve({
              id: crypto.randomUUID(), name: file.name, url, base64,
              width: img.width, height: img.height, bubbles: [], maskRegions: [], status: 'idle', skipped: false
            });
          };
          img.onerror = () => {
            console.warn(`Skipping invalid image: ${file.name}`);
            resolve(null);
          };
          img.src = url;
        });

        if (loadedImgState) newImages.push(loadedImgState);
      } catch (e) { console.error("Failed to read file", file.name, e); }
    }

    if (newImages.length > 0) {
      setImages(prev => {
        const combined = [...prev, ...newImages];
        return combined.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      });
      if (!currentId) setCurrentId(newImages[0].id);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => { if (e.clipboardData?.files?.length) processFiles(e.clipboardData.files); };
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files); };
    window.addEventListener('paste', handlePaste);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const updateImageBubbles = (imgId: string, newBubbles: Bubble[]) => {
    setImages(prev => prev.map(img => img.id === imgId ? { ...img, bubbles: newBubbles } : img));
  };

  const triggerAutoColorDetection = useCallback((bubbleId: string) => {
      if (!currentId) return;
      if (detectionTimerRef.current) clearTimeout(detectionTimerRef.current);
      detectionTimerRef.current = setTimeout(async () => {
          const imagesSnapshot = historyRef.current.present;
          const imgState = imagesSnapshot.find(i => i.id === currentId);
          if (imgState) {
              const bubble = imgState.bubbles.find(b => b.id === bubbleId);
              if (bubble && bubble.width >= 1 && bubble.height >= 1) {
                  const globalSetting = aiConfigRef.current.autoDetectBackground;
                  const bubbleSetting = bubble.autoDetectBackground;
                  const shouldDetect = bubbleSetting !== undefined ? bubbleSetting : globalSetting;
                  if (shouldDetect === false) return; 
                  const detectedColor = await detectBubbleColor(
                      imgState.url || `data:image/png;base64,${imgState.base64}`,
                      bubble.x, bubble.y, bubble.width, bubble.height
                  );
                  setImages(prev => prev.map(img => 
                      img.id === currentId ? {
                          ...img,
                          bubbles: img.bubbles.map(b => b.id === bubbleId ? { ...b, backgroundColor: detectedColor } : b)
                      } : img
                  ));
              }
          }
      }, 300);
  }, [currentId]); 

  const handleBubbleUpdate = useCallback((bubbleId: string, updates: Partial<Bubble>) => {
    if (!currentId) return;
    const finalUpdates = { ...updates };
    if (finalUpdates.autoDetectBackground === false && !finalUpdates.backgroundColor) {
        finalUpdates.backgroundColor = '#ffffff';
    }
    setImages(prev => prev.map(img => 
        img.id === currentId ? {
            ...img,
            bubbles: img.bubbles.map(b => b.id === bubbleId ? { ...b, ...finalUpdates } : b)
        } : img
    ));
    if (finalUpdates.autoDetectBackground === true) {
        triggerAutoColorDetection(bubbleId);
    }
  }, [currentId, triggerAutoColorDetection]);

  const handleToggleSkip = useCallback((imgId: string) => {
    setImages(prev => prev.map(img => img.id === imgId ? { ...img, skipped: !img.skipped } : img));
  }, []);

  const handleGlobalColorReset = () => {
    setImages(prev => prev.map(img => ({
        ...img,
        bubbles: img.bubbles.map(b => ({ ...b, backgroundColor: '#ffffff' }))
    })));
  };

  const handleGlobalColorDetection = async () => {
    if (isProcessingBatch) return;
    setIsProcessingBatch(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
        const imagesSnapshot = history.present;
        for (const img of imagesSnapshot) {
            if (controller.signal.aborted) break;
            if (img.bubbles.length === 0) continue;
            setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'processing' } : p));
            const updatedBubbles = await Promise.all(img.bubbles.map(async (b) => {
                const color = await detectBubbleColor(
                    img.url || `data:image/png;base64,${img.base64}`,
                    b.x, b.y, b.width, b.height
                );
                return { ...b, backgroundColor: color };
            }));
            setImages(prev => prev.map(p => p.id === img.id ? { ...p, bubbles: updatedBubbles, status: 'done' } : p));
        }
    } catch (e) {
        console.error("Global detection error", e);
    } finally {
        setIsProcessingBatch(false);
        abortControllerRef.current = null;
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!currentId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startXPct = clamp((e.clientX - rect.left) / rect.width * 100, 0, 100);
    const startYPct = clamp((e.clientY - rect.top) / rect.height * 100, 0, 100);

    if (drawTool === 'bubble') {
        const newBubble = createBubble(startXPct, startYPct, aiConfig.defaultFontSize, 0, 0);
        updateImageBubbles(currentId, [...bubbles, newBubble]);
        setSelectedBubbleId(newBubble.id);
        setSelectedMaskId(null);
        dragRef.current = {
            mode: 'drawing', targetType: 'bubble', id: newBubble.id,
            startX: e.clientX, startY: e.clientY, startBx: startXPct, startBy: startYPct, startBw: 0, startBh: 0, rotation: 0,
            initialSnapshot: history.present, hasMoved: false
        };
    } else if (drawTool === 'mask') {
        const newMask = createMaskRegion(startXPct, startYPct);
        setImages(prev => prev.map(img => img.id === currentId ? { ...img, maskRegions: [...(img.maskRegions || []), newMask] } : img));
        setSelectedMaskId(newMask.id);
        setSelectedBubbleId(null);
        dragRef.current = {
            mode: 'drawing', targetType: 'mask', id: newMask.id,
            startX: e.clientX, startY: e.clientY, startBx: startXPct, startBy: startYPct, startBw: 0, startBh: 0, rotation: 0,
            initialSnapshot: history.present, hasMoved: false
        };
    } else {
        if (selectedBubbleId) setSelectedBubbleId(null);
        if (selectedMaskId) setSelectedMaskId(null);
    }
  };

  const handleAddManualBubble = () => {
    if (!currentId) return;
    const newBubble = createBubble(50, 50, aiConfig.defaultFontSize);
    updateImageBubbles(currentId, [...bubbles, newBubble]);
    setSelectedBubbleId(newBubble.id);
    setSelectedMaskId(null);
  };

  const handleGlobalFontScale = (scaleFactor: number) => {
    if (!currentImage) return;
    const newBubbles = currentImage.bubbles.map(b => ({
        ...b,
        fontSize: Math.max(0.5, Math.min(5.0, parseFloat((b.fontSize * scaleFactor).toFixed(2))))
    }));
    updateImageBubbles(currentImage.id, newBubbles);
  };

  const handleGlobalMaskScale = (scaleFactor: number) => {
    if (!currentImage) return;
    const newBubbles = currentImage.bubbles.map(b => ({
        ...b,
        width: Math.max(2, Math.min(100, parseFloat((b.width * scaleFactor).toFixed(1)))),
        height: Math.max(2, Math.min(100, parseFloat((b.height * scaleFactor).toFixed(1))))
    }));
    updateImageBubbles(currentImage.id, newBubbles);
  };

  const handleGlobalFontFamily = (fontFamily: Bubble['fontFamily']) => {
      if (!currentImage) return;
      const newBubbles = currentImage.bubbles.map(b => ({ ...b, fontFamily }));
      updateImageBubbles(currentImage.id, newBubbles);
  };

  const handleMergeLayers = async () => {
    if (!currentImage || currentImage.bubbles.length === 0) return;
    setIsMerging(true);
    try {
        const blob = await compositeImage(currentImage);
        if (blob) {
            const newUrl = URL.createObjectURL(blob);
            const newBase64 = await blobToBase64(blob);
            setImages(prev => prev.map(img => 
                img.id === currentImage.id 
                ? { ...img, url: newUrl, base64: newBase64, bubbles: [] } 
                : img
            ));
            setSelectedBubbleId(null);
        }
    } catch (e) { console.error("Merge failed", e); alert("Failed to merge layers."); } finally { setIsMerging(false); }
  };

  const handleMouseDown = (e: React.MouseEvent, id: string, type: 'bubble' | 'mask') => {
    e.stopPropagation();
    e.preventDefault(); 
    if (type === 'bubble') {
        setSelectedBubbleId(id); setSelectedMaskId(null);
        const bubble = bubbles.find(b => b.id === id);
        if (!bubble) return;
        dragRef.current = { 
          mode: 'move', targetType: 'bubble', id, startX: e.clientX, startY: e.clientY, 
          startBx: bubble.x, startBy: bubble.y, startBw: bubble.width, startBh: bubble.height, rotation: bubble.rotation,
          initialSnapshot: history.present, hasMoved: false
        };
    } else {
        setSelectedMaskId(id); setSelectedBubbleId(null);
        const mask = maskRegions.find(m => m.id === id);
        if (!mask) return;
        dragRef.current = { 
          mode: 'move', targetType: 'mask', id, startX: e.clientX, startY: e.clientY, 
          startBx: mask.x, startBy: mask.y, startBw: mask.width, startBh: mask.height, rotation: 0,
          initialSnapshot: history.present, hasMoved: false
        };
    }
  };

  const handleResizeStart = (e: React.MouseEvent, id: string, type: 'bubble' | 'mask', handle: HandleType) => {
    e.stopPropagation(); e.preventDefault();
    if (type === 'bubble') {
        const bubble = bubbles.find(b => b.id === id);
        if(!bubble) return;
        dragRef.current = {
          mode: 'resize', targetType: 'bubble', id: bubble.id, handle,
          startX: e.clientX, startY: e.clientY, startBx: bubble.x, startBy: bubble.y, 
          startBw: bubble.width, startBh: bubble.height, rotation: bubble.rotation,
          initialSnapshot: history.present, hasMoved: false
        };
    } else {
        const mask = maskRegions.find(m => m.id === id);
        if(!mask) return;
        dragRef.current = {
          mode: 'resize', targetType: 'mask', id: mask.id, handle,
          startX: e.clientX, startY: e.clientY, startBx: mask.x, startBy: mask.y, 
          startBw: mask.width, startBh: mask.height, rotation: 0,
          initialSnapshot: history.present, hasMoved: false
        };
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current || !containerRef.current || !currentId) return;
    const { mode, handle, startX, startY, startBx, startBy, startBw, startBh, targetType, id } = dragRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const dxPx = e.clientX - startX;
    const dyPx = e.clientY - startY;
    if (Math.abs(dxPx) > 1 || Math.abs(dyPx) > 1) dragRef.current.hasMoved = true;

    if (mode === 'drawing') {
        const currentXPct = clamp((e.clientX - rect.left) / rect.width * 100, 0, 100);
        const currentYPct = clamp((e.clientY - rect.top) / rect.height * 100, 0, 100);
        const left = Math.min(startBx, currentXPct);
        const top = Math.min(startBy, currentYPct);
        const w = Math.abs(currentXPct - startBx);
        const h = Math.abs(currentYPct - startBy);
        const centerX = left + w / 2;
        const centerY = top + h / 2;
        setImages(prev => {
            const img = prev.find(i => i.id === currentId);
            if(!img) return prev;
            if (targetType === 'bubble') {
                const newBubbles = img.bubbles.map(b => b.id === id ? { ...b, x: centerX, y: centerY, width: Math.max(1, w), height: Math.max(1, h) } : b);
                return prev.map(p => p.id === currentId ? { ...p, bubbles: newBubbles } : p);
            } else {
                const newMasks = (img.maskRegions || []).map(m => m.id === id ? { ...m, x: centerX, y: centerY, width: Math.max(1, w), height: Math.max(1, h) } : m);
                return prev.map(p => p.id === currentId ? { ...p, maskRegions: newMasks } : p);
            }
        }, true);
        return;
    }

    if (mode === 'move') {
        const dxPct = (dxPx / rect.width) * 100;
        const dyPct = (dyPx / rect.height) * 100;
        let newX = clamp(startBx + dxPct, startBw/2, 100 - startBw/2);
        let newY = clamp(startBy + dyPct, startBh/2, 100 - startBh/2);
        setImages(prev => {
            const img = prev.find(i => i.id === currentId);
            if(!img) return prev;
            if (targetType === 'bubble') {
                const newBubbles = img.bubbles.map(b => b.id === id ? { ...b, x: newX, y: newY } : b);
                return prev.map(p => p.id === currentId ? { ...p, bubbles: newBubbles } : p);
            } else {
                const newMasks = (img.maskRegions || []).map(m => m.id === id ? { ...m, x: newX, y: newY } : m);
                return prev.map(p => p.id === currentId ? { ...p, maskRegions: newMasks } : p);
            }
        }, true);
    } else if (mode === 'resize' && handle) {
        const startLeft = startBx - startBw / 2;
        const startTop = startBy - startBh / 2;
        const startRight = startBx + startBw / 2;
        const startBottom = startBy + startBh / 2;
        const deltaXPct = (dxPx / rect.width) * 100;
        const deltaYPct = (dyPx / rect.height) * 100;
        let newLeft = startLeft, newRight = startRight, newTop = startTop, newBottom = startBottom;
        if (handle.includes('e')) newRight = clamp(startRight + deltaXPct, newLeft + 2, 100);
        if (handle.includes('w')) newLeft = clamp(startLeft + deltaXPct, 0, newRight - 2);
        if (handle.includes('s')) newBottom = clamp(startBottom + deltaYPct, newTop + 2, 100);
        if (handle.includes('n')) newTop = clamp(startTop + deltaYPct, 0, newBottom - 2);
        const newW = newRight - newLeft;
        const newH = newBottom - newTop;
        const newX = newLeft + newW / 2;
        const newY = newTop + newH / 2;
        setImages(prev => {
            const img = prev.find(i => i.id === currentId);
            if(!img) return prev;
             if (targetType === 'bubble') {
                const newBubbles = img.bubbles.map(b => b.id === id ? { ...b, x: newX, y: newY, width: newW, height: newH } : b);
                return prev.map(p => p.id === currentId ? { ...p, bubbles: newBubbles } : p);
            } else {
                const newMasks = (img.maskRegions || []).map(m => m.id === id ? { ...m, x: newX, y: newY, width: newW, height: newH } : m);
                return prev.map(p => p.id === currentId ? { ...p, maskRegions: newMasks } : p);
            }
        }, true);
    }
  }, [currentId]);

  const handleMouseUp = useCallback(() => { 
    const dragData = dragRef.current;
    if (!dragData) return;
    dragRef.current = null; 
    const { id, mode, targetType, initialSnapshot, hasMoved } = dragData;
    if (mode === 'drawing') {
        setImages(prev => {
            const img = prev.find(i => i.id === currentId);
            if (!img) return prev;
            if (targetType === 'bubble') {
                const bubble = img.bubbles.find(b => b.id === id);
                if (bubble && (bubble.width < 1 || bubble.height < 1)) {
                        return prev.map(p => p.id === currentId ? { ...p, bubbles: p.bubbles.filter(b => b.id !== id) } : p);
                }
            } else {
                const mask = img.maskRegions?.find(m => m.id === id);
                if (mask && (mask.width < 1 || mask.height < 1)) {
                        return prev.map(p => p.id === currentId ? { ...p, maskRegions: (p.maskRegions || []).filter(m => m.id !== id) } : p);
                }
            }
            return prev;
        });
    }
    if (hasMoved || mode === 'drawing') {
        setHistory(curr => ({
            past: [...curr.past, initialSnapshot].slice(-20),
            present: curr.present,
            future: []
        }));
    }
    if (targetType === 'bubble' && currentId && (mode === 'drawing' || mode === 'move' || mode === 'resize')) {
        triggerAutoColorDetection(id);
    }
  }, [currentId, triggerAutoColorDetection]); 

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const runDetectionForImage = async (img: ImageState, signal?: AbortSignal) => {
     setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'processing', errorMessage: undefined } : p));
     try {
       let sourceBase64 = img.base64;
       const useMaskedImage = aiConfig.enableMaskedImageMode && img.maskRegions && img.maskRegions.length > 0;
       if (useMaskedImage) {
           sourceBase64 = await generateMaskedImage(img);
       }
       const detected = await detectAndTypesetComic(sourceBase64, aiConfig, signal, img.maskRegions);
       let finalDetected = detected;
       if (aiConfig.enableDialogSnap) {
           finalDetected = detected.map(b => {
                if (!img.maskRegions || img.maskRegions.length === 0) return b;
                let nearestMask: MaskRegion | null = null;
                let minDistance = Infinity;
                img.maskRegions.forEach(mask => {
                    const dist = Math.sqrt(Math.pow(b.x - mask.x, 2) + Math.pow(b.y - mask.y, 2));
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestMask = mask;
                    }
                });
                if (nearestMask && minDistance < 15) {
                    const updates: any = { x: (nearestMask as MaskRegion).x, y: (nearestMask as MaskRegion).y };
                    if (aiConfig.forceSnapSize) {
                        updates.width = (nearestMask as MaskRegion).width;
                        updates.height = (nearestMask as MaskRegion).height;
                    }
                    return { ...b, ...updates };
                }
                return b;
           });
       }
       const processedBubbles = await Promise.all(finalDetected.map(async (d) => {
           let color = '#ffffff';
           if (aiConfig.autoDetectBackground !== false) {
               color = await detectBubbleColor(
                   img.url || `data:image/png;base64,${img.base64}`,
                   d.x, d.y, d.width, d.height
               );
           }
           return {
                id: crypto.randomUUID(),
                x: d.x, y: d.y, width: d.width, height: d.height,
                text: d.text, isVertical: d.isVertical,
                fontFamily: (d.text.includes('JSON') ? 'zhimang' : 'noto') as 'noto' | 'zhimang' | 'mashan',
                fontSize: aiConfig.defaultFontSize,
                color: '#0f172a', 
                backgroundColor: color, 
                rotation: d.rotation || 0,
                maskShape: aiConfig.defaultMaskShape,
                maskCornerRadius: aiConfig.defaultMaskCornerRadius,
                maskFeather: aiConfig.defaultMaskFeather
           };
       }));
      
      setImages(prev => prev.map(p => p.id === img.id ? { 
          ...p, 
          bubbles: useMaskedImage ? [...p.bubbles, ...processedBubbles] : processedBubbles,
          status: 'done' 
      } : p));
     } catch (e: any) {
       if (e.message && e.message.includes('Aborted')) {
          setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'idle', errorMessage: undefined } : p));
          return;
       }
       console.error("AI Error for " + img.name, e);
       setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'error', errorMessage: e.message || 'Unknown error occurred' } : p));
     }
  };

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsProcessingBatch(false);
    }
  };

  // Smart Batch Logic: Tries to resume unprocessed items; if none, processes all (re-run)
  const handleBatchProcess = async (onlyCurrent: boolean) => {
    if (isProcessingBatch) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;
    setIsProcessingBatch(true);

    try {
        if (onlyCurrent && currentImage) {
          await runDetectionForImage(currentImage, signal);
        } else {
          // 1. Try to find 'idle' or 'error' images (Resume mode)
          let queue = images.filter(img => !img.skipped && (img.status === 'idle' || img.status === 'error'));
          
          // 2. If no pending items, fallback to all non-skipped (Reprocess mode)
          if (queue.length === 0) {
             queue = images.filter(img => !img.skipped);
          }

          if (queue.length === 0) {
              alert("No images to process.");
              return;
          }

          // Use concurrency strictly (ensure it's a number)
          const batchSize = Math.max(1, concurrency);

          for (let i = 0; i < queue.length; i += batchSize) {
            if (signal.aborted) break;
            const chunk = queue.slice(i, i + batchSize);
            await Promise.all(chunk.map(img => runDetectionForImage(img, signal)));
          }
        }
    } catch (e) { console.error(e); } finally {
        setIsProcessingBatch(false);
        abortControllerRef.current = null;
    }
  };

  const handleLocalDetectionScan = async (batch: boolean) => {
    if (!aiConfig.useTextDetectionApi || !aiConfig.textDetectionApiUrl) {
        alert("Please enable 'Local Text Detection' in Settings first.");
        return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsProcessingBatch(true);

    try {
        const targets = batch 
            ? images.filter(img => !img.skipped) 
            : (currentImage ? [currentImage] : []);

        if (targets.length === 0) return;

        // Use concurrency for Local Scan too
        const batchSize = Math.max(1, concurrency);

        for (let i = 0; i < targets.length; i += batchSize) {
             if (controller.signal.aborted) break;
             const chunk = targets.slice(i, i + batchSize);
             
             await Promise.all(chunk.map(async (img) => {
                 setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'processing' } : p));
                 try {
                     const regions = await fetchRawDetectedRegions(img.base64, aiConfig.textDetectionApiUrl!);
                     const maskRegions: MaskRegion[] = regions.map(r => ({
                         id: crypto.randomUUID(),
                         x: r.x, y: r.y, width: r.width, height: r.height
                     }));
                     
                     setImages(prev => prev.map(p => p.id === img.id ? { 
                         ...p, 
                         maskRegions: [...(p.maskRegions || []), ...maskRegions], // Append
                         status: 'done' 
                     } : p));
                 } catch (e) {
                     console.error(e);
                     setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'error' } : p));
                 }
             }));
        }
    } finally {
        setIsProcessingBatch(false);
        abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col z-20 shadow-2xl shrink-0">
        <div className="p-3 border-b border-gray-800 flex justify-between items-center shrink-0">
          <div><h1 className="text-lg font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">{t('appName', lang)}</h1></div>
          <div className="flex items-center gap-1">
            <button onClick={handleUndo} disabled={history.past.length === 0} className="text-gray-500 hover:text-white disabled:opacity-30 p-1" title={t('undo', lang)}><Undo2 size={16} /></button>
            <button onClick={handleRedo} disabled={history.future.length === 0} className="text-gray-500 hover:text-white disabled:opacity-30 p-1" title={t('redo', lang)}><Redo2 size={16} /></button>
            <div className="w-px h-4 bg-gray-700 mx-1"></div>
            <button onClick={() => setShowHelp(true)} className="text-gray-500 hover:text-white p-1" title={t('help', lang)}><CircleHelp size={16} /></button>
            <button onClick={() => setShowSettings(true)} className="text-gray-500 hover:text-white p-1" title={t('settings', lang)}><Settings size={16} /></button>
          </div>
        </div>
        
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
        <input type="file" ref={folderInputRef} onChange={handleFolderChange} className="hidden" {...({ webkitdirectory: "", directory: "" } as any)} />

        <div className="flex-1 overflow-hidden bg-gray-900/50">
            <Gallery 
                images={images} 
                currentId={currentId} 
                config={aiConfig}
                onSelect={(id) => { setCurrentId(id); setSelectedBubbleId(null); setSelectedMaskId(null); }} 
                onDelete={(id) => { setImages(prev => prev.filter(i => i.id !== id)); if (currentId === id) setCurrentId(null); }} 
                onClearAll={() => { setImages([]); setCurrentId(null); }} 
                onToggleSkip={handleToggleSkip}
                onAddFile={() => fileInputRef.current?.click()}
                onAddFolder={() => folderInputRef.current?.click()}
            />
        </div>

        {images.length > 0 && (
            <div className="bg-gray-900 border-t border-gray-800 shrink-0 flex flex-col relative z-20">
                {showGlobalStyles && (
                     <div className="bg-gray-800/95 border-t border-gray-700 p-3 space-y-2 animate-slide-up-fade shadow-xl absolute bottom-full w-full z-10">
                        <div className="flex justify-between items-center mb-1">
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1"><Type size={10} /> {t('globalStyles', lang)}</div>
                            <button onClick={() => setShowGlobalStyles(false)} className="text-gray-500 hover:text-white"><ChevronDown size={14}/></button>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="w-6 shrink-0 flex justify-center text-gray-400" title="Font Size"><Type size={14}/></div>
                             <div className="flex flex-1 gap-1">
                                <button onClick={() => handleGlobalFontScale(0.9)} disabled={!currentImage || currentImage.bubbles.length === 0} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 flex items-center justify-center gap-1"><Minus size={12}/></button>
                                <button onClick={() => handleGlobalFontScale(1.1)} disabled={!currentImage || currentImage.bubbles.length === 0} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 flex items-center justify-center gap-1"><Plus size={12}/></button>
                             </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="w-6 shrink-0 flex justify-center text-gray-400" title="Mask Size"><Maximize size={14}/></div>
                             <div className="flex flex-1 gap-1">
                                <button onClick={() => handleGlobalMaskScale(0.9)} disabled={!currentImage || currentImage.bubbles.length === 0} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 flex items-center justify-center gap-1"><Minus size={12}/></button>
                                <button onClick={() => handleGlobalMaskScale(1.1)} disabled={!currentImage || currentImage.bubbles.length === 0} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 flex items-center justify-center gap-1"><Plus size={12}/></button>
                             </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1 mt-1">
                            <button onClick={() => handleGlobalFontFamily('noto')} className="text-[10px] py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300">Noto</button>
                            <button onClick={() => handleGlobalFontFamily('zhimang')} className="text-[10px] py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300 font-zhimang">Zhi</button>
                            <button onClick={() => handleGlobalFontFamily('mashan')} className="text-[10px] py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300 font-mashan">Ma</button>
                        </div>
                    </div>
                )}

                <div className="p-3 space-y-3">
                    <div className="flex p-1 bg-gray-800 rounded-lg">
                        <button 
                            onClick={() => { setDrawTool('none'); setSelectedBubbleId(null); setSelectedMaskId(null); }}
                            className={`flex-1 py-1 text-xs rounded-md transition-all flex items-center justify-center gap-1 ${drawTool === 'none' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            <MousePointer2 size={12}/> View
                        </button>
                         <button 
                            onClick={() => { setDrawTool('bubble'); setSelectedBubbleId(null); setSelectedMaskId(null); }}
                            className={`flex-1 py-1 text-xs rounded-md transition-all flex items-center justify-center gap-1 ${drawTool === 'bubble' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            <MessageSquareDashed size={12}/> Bubble
                        </button>
                         <button 
                            onClick={() => { setDrawTool('mask'); setSelectedBubbleId(null); setSelectedMaskId(null); }}
                            className={`flex-1 py-1 text-xs rounded-md transition-all flex items-center justify-center gap-1 ${drawTool === 'mask' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            <Scan size={12}/> Mask
                        </button>
                    </div>

                    <div className="h-10 relative"> 
                        {isProcessingBatch ? (
                            <button 
                                onClick={handleStopProcessing}
                                className="w-full h-full bg-red-900/50 hover:bg-red-800 border border-red-700 rounded text-xs text-red-200 flex items-center justify-center gap-2 animate-pulse"
                            >
                                <Square size={12} fill="currentColor" /> {t('stop', lang)}
                            </button>
                        ) : (
                            <>
                                {drawTool === 'none' && (
                                    <div className="grid grid-cols-5 gap-1 h-full">
                                        <button 
                                            onClick={() => handleBatchProcess(true)} 
                                            disabled={!currentImage}
                                            className="col-span-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50 shadow-sm"
                                            title={t('current', lang)}
                                        >
                                            <Sparkles size={14}/> {t('current', lang)}
                                        </button>
                                        <button 
                                            onClick={() => handleBatchProcess(false)}
                                            className="col-span-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-xs flex items-center justify-center gap-1"
                                            title={t('processAll', lang)}
                                        >
                                            <Layers size={14}/> {t('processAll', lang)}
                                        </button>
                                        <button 
                                            onClick={() => setShowManualJson(true)} 
                                            disabled={!currentImage} 
                                            className="col-span-1 bg-teal-900/40 hover:bg-teal-800/60 border border-teal-800 text-teal-200 rounded text-xs flex items-center justify-center" 
                                            title={t('importJson', lang)}
                                        >
                                            <FileJson size={16}/>
                                        </button>
                                    </div>
                                )}

                                {drawTool === 'mask' && (
                                    <div className="grid grid-cols-4 gap-1 h-full">
                                        <button 
                                            onClick={() => handleBatchProcess(true)} 
                                            disabled={!currentImage}
                                            className="bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50 shadow-sm"
                                            title={t('current', lang)}
                                        >
                                            <Sparkles size={14}/> Trans.
                                        </button>
                                        <button 
                                            onClick={() => handleBatchProcess(false)}
                                            className="bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-xs flex items-center justify-center gap-1"
                                            title={t('processAll', lang)}
                                        >
                                            <Layers size={14}/> Batch
                                        </button>
                                        <button 
                                            onClick={() => handleLocalDetectionScan(false)}
                                            className="bg-orange-900/40 hover:bg-orange-800/60 border border-orange-800 text-orange-200 rounded text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                                            title="Scan Current (Local Detect)"
                                        >
                                            <ScanText size={14}/> Scan
                                        </button>
                                        <button 
                                            onClick={() => handleLocalDetectionScan(true)}
                                            className="bg-orange-900/40 hover:bg-orange-800/60 border border-orange-800 text-orange-200 rounded text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                                            title="Scan All (Local Detect)"
                                        >
                                            <Layers size={14}/> All
                                        </button>
                                    </div>
                                )}

                                {drawTool === 'bubble' && (
                                    <button 
                                        onClick={handleAddManualBubble} 
                                        disabled={!currentImage} 
                                        className="w-full h-full bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <Plus size={16}/> {t('manualAdd', lang)}
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div className="h-px bg-gray-800"></div>

                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setShowGlobalStyles(!showGlobalStyles)} 
                                className={`p-2 rounded hover:bg-gray-700 transition-colors ${showGlobalStyles ? 'text-blue-400 bg-gray-800' : 'text-gray-400'}`}
                                title={t('globalStyles', lang)}
                            >
                                <Palette size={16}/>
                            </button>
                            <div className="flex items-center gap-1 bg-gray-800 rounded px-1.5 py-1 border border-gray-700" title={t('concurrency', lang)}>
                                <Zap size={10} className="text-yellow-500" />
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="10" 
                                    value={concurrency} 
                                    onChange={(e) => setConcurrency(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                                    className="w-6 bg-transparent text-[10px] text-center text-gray-300 outline-none appearance-none"
                                />
                            </div>
                        </div>
                        
                        <div className="flex gap-1">
                             <button onClick={handleMergeLayers} disabled={!currentImage || isMerging || currentImage.bubbles.length === 0} className="p-2 text-orange-400 hover:bg-gray-800 rounded disabled:opacity-30 transition-colors" title={t('merge', lang)}>
                                {isMerging ? <Loader2 className="animate-spin" size={16}/> : <FileStack size={16}/>}
                            </button>
                            <button onClick={() => currentImage && downloadSingleImage(currentImage)} disabled={!currentImage} className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30 transition-colors" title={t('saveImage', lang)}>
                                <ImageIcon size={16}/>
                            </button>
                            <button onClick={() => downloadAllAsZip(images)} className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors" title={t('zipAll', lang)}>
                                <Archive size={16}/>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        )}
      </aside>

      <main className="flex-1 relative bg-[#1a1a1a] overflow-hidden flex flex-col">
        {!currentImage ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 select-none"><Maximize size={64} className="mx-auto mb-4"/><h2 className="text-2xl font-bold">{t('noImageSelected', lang)}</h2><p className="mt-2 text-sm">{t('dragDrop', lang)}</p></div>
        ) : (
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 relative">
            <div className="relative shadow-2xl inline-block" ref={containerRef} style={{ maxWidth: '100%' }}>
              <img src={currentImage.url} alt="Workspace" className="max-h-[90vh] max-w-full block select-none pointer-events-none" />
              <div className="absolute inset-0" style={{ containerType: 'inline-size' } as React.CSSProperties}>
                  <div 
                    className={`absolute inset-0 z-0 ${drawTool !== 'none' ? 'cursor-crosshair' : 'cursor-default'}`} 
                    onMouseDown={handleCanvasMouseDown}
                  />
                  
                  {drawTool === 'mask' && maskRegions.map(region => (
                      <RegionLayer
                          key={region.id}
                          region={region}
                          isSelected={selectedMaskId === region.id}
                          onMouseDown={(e) => handleMouseDown(e, region.id, 'mask')}
                          onResizeStart={(e, handle) => handleResizeStart(e, region.id, 'mask', handle)}
                          onDelete={() => {
                               setImages(prev => prev.map(img => img.id === currentId ? { ...img, maskRegions: (img.maskRegions || []).filter(m => m.id !== region.id) } : img));
                               setSelectedMaskId(null);
                          }}
                      />
                  ))}

                  {bubbles.map(bubble => (
                    <BubbleLayer
                      key={bubble.id}
                      bubble={bubble}
                      config={aiConfig}
                      isSelected={selectedBubbleId === bubble.id}
                      onMouseDown={(e) => handleMouseDown(e, bubble.id, 'bubble')}
                      onResizeStart={(e, handle) => handleResizeStart(e, bubble.id, 'bubble', handle)}
                      onUpdate={handleBubbleUpdate}
                      onDelete={() => {
                           setImages(prev => prev.map(img => img.id === currentId ? { ...img, bubbles: img.bubbles.filter(b => b.id !== bubble.id) } : img));
                           setSelectedBubbleId(null);
                      }}
                      onTriggerAutoColor={triggerAutoColorDetection}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <aside className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col z-20 shadow-2xl shrink-0">
         {selectedBubble && currentId ? (
             <BubbleEditor 
                bubble={selectedBubble}
                config={aiConfig}
                onUpdate={(id, updates) => handleBubbleUpdate(id, updates)}
                onDelete={(id) => {
                    setImages(prev => prev.map(img => img.id === currentId ? { ...img, bubbles: img.bubbles.filter(b => b.id !== id) } : img));
                    setSelectedBubbleId(null);
                }}
              />
         ) : selectedMaskId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 select-none p-6 text-center">
                   <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
                        <Scan size={32} className="text-red-500"/>
                   </div>
                   <h3 className="text-sm font-semibold text-gray-300">{t('toolMask', lang)}</h3>
                   <p className="text-xs mt-2 text-gray-500 leading-relaxed">
                       {t('translateRegionsDesc', lang)}
                       <br/>
                       <br/>
                       {t('clickBubbleHint', lang)}
                   </p>
              </div>
         ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-600 select-none p-6 text-center"><div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4"><MessageSquareDashed size={32} className="opacity-50"/></div><h3 className="text-sm font-semibold text-gray-500">{t('noBubbleSelected', lang)}</h3><p className="text-xs mt-2 max-w-[200px]">{t('clickBubbleHint', lang)}</p></div>
         )}
      </aside>

      {showSettings && (
        <SettingsModal 
            config={aiConfig} 
            onSave={(newConfig) => { 
                const oldAutoDetect = aiConfig.autoDetectBackground;
                setAiConfig(newConfig); 
                setShowSettings(false); 
                if (newConfig.autoDetectBackground !== oldAutoDetect) {
                    if (newConfig.autoDetectBackground) {
                        handleGlobalColorDetection();
                    } else {
                        handleGlobalColorReset();
                    }
                }
            }} 
            onClose={() => setShowSettings(false)} 
        />
      )}
      {showHelp && <HelpModal lang={lang} onClose={() => setShowHelp(false)} />}
      {showManualJson && currentId && <ManualJsonModal config={aiConfig} onApply={(detected) => { const newBubbles: Bubble[] = detected.map(d => ({ id: crypto.randomUUID(), x: d.x, y: d.y, width: d.width, height: d.height, text: d.text, isVertical: d.isVertical, fontFamily: 'noto', fontSize: aiConfig.defaultFontSize, color: '#0f172a', backgroundColor: '#ffffff', rotation: 0 })); updateImageBubbles(currentId, newBubbles); setShowManualJson(false); }} onClose={() => setShowManualJson(false)} />}
    </div>
  );
};

export default App;