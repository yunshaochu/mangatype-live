import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BubbleEditor } from './components/BubbleEditor';
import { SettingsModal } from './components/SettingsModal';
import { ManualJsonModal } from './components/ManualJsonModal';
import { HelpModal } from './components/HelpModal';
import { Gallery } from './components/Gallery';
import { Bubble, ImageState, AIConfig } from './types';
import { Upload, Download, Plus, Maximize, Loader2, Settings, FileJson, Archive, Play, Layers, Image as ImageIcon, Undo2, Redo2, FileStack, Minus, Type, MessageSquareDashed, CircleHelp } from 'lucide-react';
import { detectAndTypesetComic, DEFAULT_SYSTEM_PROMPT } from './services/geminiService';
import { downloadSingleImage, downloadAllAsZip, compositeImage } from './services/exportService';
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
  language: 'zh' // Default to Chinese
};

// Updated createBubble to accept a default font size
const createBubble = (x: number, y: number, defaultFontSize: number): Bubble => ({
  id: crypto.randomUUID(),
  x,
  y,
  width: 15,
  height: 25,
  text: '...',
  isVertical: true,
  fontFamily: 'noto',
  fontSize: defaultFontSize,
  color: '#0f172a',
  backgroundColor: '#ffffff',
  rotation: 0,
});

// --- Bubble Component with Native Event Listeners ---

// Define Handle Types
type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface BubbleLayerProps {
  bubble: Bubble;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: HandleType) => void;
  onUpdate: (id: string, updates: Partial<Bubble>) => void;
}

const BubbleLayer: React.FC<BubbleLayerProps> = ({ bubble, isSelected, onMouseDown, onResizeStart, onUpdate }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef(bubble);
  bubbleRef.current = bubble;

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
            const newWidth = Math.max(5, currentBubble.width * scale);
            const newHeight = Math.max(5, currentBubble.height * scale);
            onUpdate(currentBubble.id, {
                width: parseFloat(newWidth.toFixed(1)),
                height: parseFloat(newHeight.toFixed(1))
            });
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [isSelected, onUpdate]);

  // Handle Styles
  const handleStyle = (cursor: string): React.CSSProperties => ({
    position: 'absolute',
    width: '12px',
    height: '12px',
    backgroundColor: '#ffffff',
    border: '2px solid #3b82f6', // blue-500
    borderRadius: '50%',
    zIndex: 30,
    cursor: cursor,
    pointerEvents: 'auto',
    boxShadow: '0 0 4px rgba(0,0,0,0.3)', // Added shadow for better visibility
  });

  // Visual Alignment Constants
  const HANDLE_OFFSET = '-14px';

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
        className="absolute inset-0 rounded-[50%] transition-colors duration-200"
        style={{ 
          backgroundColor: bubble.backgroundColor,
          boxShadow: bubble.backgroundColor !== 'transparent' ? `0 0 10px 5px ${bubble.backgroundColor}` : 'none'
        }}
      />

      {/* Selection Indicator & Handles */}
      {isSelected && (
        <>
            {/* The Blue Frame: -inset-2 corresponds to roughly 8px padding */}
            <div className="absolute -inset-2 border-2 border-blue-500 rounded-lg pointer-events-none z-20 opacity-70"></div>
            
            {/* Corners (Proportional) */}
            <div style={{ ...handleStyle('nw-resize'), top: HANDLE_OFFSET, left: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'nw')} />
            <div style={{ ...handleStyle('ne-resize'), top: HANDLE_OFFSET, right: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'ne')} />
            <div style={{ ...handleStyle('se-resize'), bottom: HANDLE_OFFSET, right: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'se')} />
            <div style={{ ...handleStyle('sw-resize'), bottom: HANDLE_OFFSET, left: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'sw')} />
            
            {/* Edges (Directional) */}
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
        }}
      >
        {bubble.text}
      </div>
    </div>
  );
};


const App: React.FC = () => {
  // State
  const [history, setHistory] = useState<{
    past: ImageState[][];
    present: ImageState[];
    future: ImageState[][];
  }>({
    past: [],
    present: [],
    future: []
  });

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showManualJson, setShowManualJson] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [concurrency, setConcurrency] = useState(1);
  const [isMerging, setIsMerging] = useState(false);
  
  // AI Config
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (e) {
      console.warn("Failed to load settings", e);
    }
    return DEFAULT_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(aiConfig));
    } catch (e) {
      console.warn("Failed to save settings", e);
    }
  }, [aiConfig]);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Drag Logic Ref
  const dragRef = useRef<{ 
    mode: 'move' | 'resize';
    id: string;
    handle?: HandleType; // Only for resize
    startX: number; 
    startY: number; 
    // Initial Bubble State
    startBx: number; 
    startBy: number;
    startBw: number;
    startBh: number;
    rotation: number; // Stored to avoid lookups
    initialSnapshot: ImageState[]; 
    hasMoved: boolean;
  } | null>(null);

  // Derived State
  const images = history.present;
  const currentImage = images.find(img => img.id === currentId);
  const bubbles = currentImage?.bubbles || [];
  const selectedBubble = selectedBubbleId ? bubbles.find(b => b.id === selectedBubbleId) : undefined;
  
  const lang = aiConfig.language; // Current Language

  // --- History Logic ---
  const setImages = (
    newImagesOrUpdater: ImageState[] | ((prev: ImageState[]) => ImageState[]), 
    skipHistory: boolean = false
  ) => {
    setHistory(curr => {
      const newPresent = typeof newImagesOrUpdater === 'function' 
        ? newImagesOrUpdater(curr.present) 
        : newImagesOrUpdater;
      
      if (JSON.stringify(newPresent) === JSON.stringify(curr.present)) return curr;

      if (skipHistory) {
        return { ...curr, present: newPresent };
      }

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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);


  // --- Image Handling Logic ---
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const processFiles = async (files: FileList | File[]) => {
    const newImages: ImageState[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const url = URL.createObjectURL(file);
      try {
        const base64 = await blobToBase64(file);
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            newImages.push({
              id: crypto.randomUUID(), name: file.name, url, base64,
              width: img.width, height: img.height, bubbles: [], status: 'idle'
            });
            resolve();
          };
          img.src = url;
        });
      } catch (e) { console.error("Failed to load image", file.name); }
    }
    if (newImages.length > 0) {
      setImages(prev => {
        const updated = [...prev, ...newImages];
        if (!currentId) setCurrentId(newImages[0].id);
        return updated;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
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

  const handleBubbleUpdate = useCallback((bubbleId: string, updates: Partial<Bubble>) => {
    if (!currentId) return;
    setImages(prev => prev.map(img => 
        img.id === currentId ? {
            ...img,
            bubbles: img.bubbles.map(b => b.id === bubbleId ? { ...b, ...updates } : b)
        } : img
    ));
  }, [currentId]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (selectedBubbleId) setSelectedBubbleId(null);
  };

  const handleAddManualBubble = () => {
    if (!currentId) return;
    const newBubble = createBubble(50, 50, aiConfig.defaultFontSize);
    updateImageBubbles(currentId, [...bubbles, newBubble]);
    setSelectedBubbleId(newBubble.id);
  };

  const handleGlobalFontScale = (scaleFactor: number) => {
    if (!currentImage) return;
    const newBubbles = currentImage.bubbles.map(b => ({
        ...b,
        fontSize: Math.max(0.5, Math.min(5.0, parseFloat((b.fontSize * scaleFactor).toFixed(2))))
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

  // --- MOUSE HANDLERS (Move & Resize) ---

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection
    setSelectedBubbleId(id);
    const bubble = bubbles.find(b => b.id === id);
    if (!bubble) return;
    
    dragRef.current = { 
      mode: 'move',
      id, 
      startX: e.clientX, 
      startY: e.clientY, 
      startBx: bubble.x, 
      startBy: bubble.y,
      startBw: bubble.width,
      startBh: bubble.height,
      rotation: bubble.rotation,
      initialSnapshot: history.present,
      hasMoved: false
    };
  };

  const handleResizeStart = (e: React.MouseEvent, handle: HandleType) => {
    e.stopPropagation();
    e.preventDefault();
    if (!selectedBubbleId) return;

    const bubble = bubbles.find(b => b.id === selectedBubbleId);
    if(!bubble) return;

    dragRef.current = {
      mode: 'resize',
      id: bubble.id,
      handle,
      startX: e.clientX, 
      startY: e.clientY, 
      startBx: bubble.x, 
      startBy: bubble.y,
      startBw: bubble.width,
      startBh: bubble.height,
      rotation: bubble.rotation,
      initialSnapshot: history.present,
      hasMoved: false
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current || !containerRef.current || !currentId) return;
    
    const { mode, handle, startX, startY, startBx, startBy, startBw, startBh, rotation } = dragRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Global Delta (Pixel)
    const dxPx = e.clientX - startX;
    const dyPx = e.clientY - startY;

    // Movement Check
    if (Math.abs(dxPx) > 1 || Math.abs(dyPx) > 1) {
       dragRef.current.hasMoved = true;
    }

    if (mode === 'move') {
        const dxPct = (dxPx / rect.width) * 100;
        const dyPct = (dyPx / rect.height) * 100;

        setImages(prev => {
            const img = prev.find(i => i.id === currentId);
            if(!img) return prev;
            const newBubbles = img.bubbles.map(b => 
                b.id === dragRef.current?.id 
                ? { ...b, x: startBx + dxPct, y: startBy + dyPct } 
                : b
            );
            return prev.map(p => p.id === currentId ? { ...p, bubbles: newBubbles } : p);
        }, true);

    } else if (mode === 'resize' && handle) {
        const rad = rotation * (Math.PI / 180);
        // Project screen delta onto bubble local axis
        const localDxPx = dxPx * Math.cos(-rad) - dyPx * Math.sin(-rad);
        const localDyPx = dxPx * Math.sin(-rad) + dyPx * Math.cos(-rad);

        // Convert Local Pixel Delta to Percentage
        const localDxPct = (localDxPx / rect.width) * 100;
        const localDyPct = (localDyPx / rect.height) * 100;

        let newX = startBx;
        let newY = startBy;
        let newW = startBw;
        let newH = startBh;

        const isCorner = ['nw', 'ne', 'se', 'sw'].includes(handle);
        const aspectRatio = startBw / startBh;

        if (isCorner) {
            let deltaW = 0;
            if (handle === 'se') deltaW = localDxPct;
            if (handle === 'sw') deltaW = -localDxPct;
            if (handle === 'ne') deltaW = localDxPct;
            if (handle === 'nw') deltaW = -localDxPct;

            newW = Math.max(2, startBw + deltaW);
            newH = newW / aspectRatio;

            const dw = newW - startBw;
            const dh = newH - startBh;

            if (handle.includes('e')) newX += dw / 2;
            else newX -= dw / 2;
            if (handle.includes('s')) newY += dh / 2;
            else newY -= dh / 2;

        } else {
            if (handle === 'e') {
                newW = Math.max(2, startBw + localDxPct);
                newX = startBx + (newW - startBw) / 2;
            }
            if (handle === 'w') {
                newW = Math.max(2, startBw - localDxPct);
                newX = startBx - (newW - startBw) / 2;
            }
            if (handle === 's') {
                newH = Math.max(2, startBh + localDyPct);
                newY = startBy + (newH - startBh) / 2;
            }
            if (handle === 'n') {
                newH = Math.max(2, startBh - localDyPct);
                newY = startBy - (newH - startBh) / 2;
            }
        }

        setImages(prev => {
            const img = prev.find(i => i.id === currentId);
            if(!img) return prev;
            const newBubbles = img.bubbles.map(b => 
                b.id === dragRef.current?.id 
                ? { ...b, x: newX, y: newY, width: newW, height: newH } 
                : b
            );
            return prev.map(p => p.id === currentId ? { ...p, bubbles: newBubbles } : p);
        }, true);
    }
  }, [currentId]);

  const handleMouseUp = useCallback(() => { 
    if (dragRef.current && dragRef.current.hasMoved) {
      const snapshot = dragRef.current.initialSnapshot;
      setHistory(curr => ({
         past: [...curr.past, snapshot].slice(-20),
         present: curr.present,
         future: []
      }));
    }
    dragRef.current = null; 
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Batch / AI Logic
  const runDetectionForImage = async (img: ImageState) => {
     setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'processing' } : p));
     try {
       const detected = await detectAndTypesetComic(img.base64, aiConfig);
       const newBubbles: Bubble[] = detected.map(d => ({
        id: crypto.randomUUID(),
        x: d.x, y: d.y, width: d.width, height: d.height,
        text: d.text, isVertical: d.isVertical,
        fontFamily: d.text.includes('JSON') ? 'zhimang' : 'noto',
        fontSize: aiConfig.defaultFontSize,
        color: '#0f172a', backgroundColor: '#ffffff', 
        rotation: d.rotation || 0, // AI detected rotation or 0
      }));
      setImages(prev => prev.map(p => p.id === img.id ? { ...p, bubbles: newBubbles, status: 'done' } : p));
     } catch (e) {
       console.error("AI Error for " + img.name, e);
       setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'error' } : p));
     }
  };

  const handleBatchProcess = async (onlyCurrent: boolean) => {
    if (isProcessingBatch) return;
    setIsProcessingBatch(true);
    if (onlyCurrent && currentImage) {
      await runDetectionForImage(currentImage);
    } else {
      const queue = images.filter(img => img.status === 'idle' || img.status === 'error');
      for (let i = 0; i < queue.length; i += concurrency) {
        const chunk = queue.slice(i, i + concurrency);
        await Promise.all(chunk.map(img => runDetectionForImage(img)));
      }
    }
    setIsProcessingBatch(false);
  };

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col z-20 shadow-2xl shrink-0">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center shrink-0">
          <div><h1 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">{t('appName', lang)}</h1></div>
          <div className="flex items-center gap-1">
            <button onClick={handleUndo} disabled={history.past.length === 0} className="text-gray-500 hover:text-white disabled:opacity-30 p-1" title={t('undo', lang)}><Undo2 size={18} /></button>
            <button onClick={handleRedo} disabled={history.future.length === 0} className="text-gray-500 hover:text-white disabled:opacity-30 p-1" title={t('redo', lang)}><Redo2 size={18} /></button>
            <div className="w-px h-4 bg-gray-700 mx-1"></div>
            <button onClick={() => setShowHelp(true)} className="text-gray-500 hover:text-white p-1" title={t('help', lang)}><CircleHelp size={18} /></button>
            <button onClick={() => setShowSettings(true)} className="text-gray-500 hover:text-white p-1" title={t('settings', lang)}><Settings size={18} /></button>
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 grid grid-cols-2 gap-2 border-b border-gray-800 shrink-0">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" multiple />
                <input type="file" ref={folderInputRef} onChange={handleFolderChange} className="hidden" {...({ webkitdirectory: "", directory: "" } as any)} />
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center p-3 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-xs text-gray-300"><Upload size={16} className="mb-1"/>{t('addFiles', lang)}</button>
                <button onClick={() => folderInputRef.current?.click()} className="flex flex-col items-center justify-center p-3 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-xs text-gray-300"><Archive size={16} className="mb-1"/>{t('addFolder', lang)}</button>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-900/50">
               <Gallery 
                  images={images} 
                  currentId={currentId} 
                  config={aiConfig}
                  onSelect={(id) => { setCurrentId(id); setSelectedBubbleId(null); }} 
                  onDelete={(id) => { setImages(prev => prev.filter(i => i.id !== id)); if (currentId === id) setCurrentId(null); if (selectedBubbleId && currentImage?.id === id) setSelectedBubbleId(null); }} 
                  onClearAll={() => { setImages([]); setCurrentId(null); setSelectedBubbleId(null); }} 
                />
            </div>
            {images.length > 0 && (
                <div className="p-4 bg-gray-900 border-t border-gray-800 space-y-3 shrink-0">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        <button onClick={handleAddManualBubble} disabled={!currentImage} className="py-2 bg-green-900/40 hover:bg-green-800/60 border border-green-800 text-green-200 rounded text-xs flex items-center justify-center gap-1"><Plus size={14}/> {t('manualAdd', lang)}</button>
                        <button onClick={() => setShowManualJson(true)} disabled={!currentImage} className="py-2 bg-teal-900/40 hover:bg-teal-800/60 border border-teal-800 text-teal-200 rounded text-xs flex items-center justify-center gap-1"><FileJson size={14}/> {t('importJson', lang)}</button>
                        <button onClick={handleMergeLayers} disabled={!currentImage || isMerging || currentImage.bubbles.length === 0} className="py-2 bg-orange-900/40 hover:bg-orange-800/60 border border-orange-800 text-orange-200 rounded text-xs flex items-center justify-center gap-1 disabled:opacity-50">{isMerging ? <Loader2 className="animate-spin" size={14}/> : <FileStack size={14}/>} {t('merge', lang)}</button>
                    </div>
                    <div className="space-y-1 mb-2 bg-gray-800/50 p-2 rounded border border-gray-700/50">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Type size={10} /> {t('globalStyles', lang)}</div>
                        <div className="flex gap-1 mb-1">
                             <button onClick={() => handleGlobalFontScale(0.9)} disabled={!currentImage || currentImage.bubbles.length === 0} className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 flex items-center justify-center gap-1"><Minus size={12}/> {t('size', lang)}</button>
                             <button onClick={() => handleGlobalFontScale(1.1)} disabled={!currentImage || currentImage.bubbles.length === 0} className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 flex items-center justify-center gap-1"><Plus size={12}/> {t('size', lang)}</button>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            <button onClick={() => handleGlobalFontFamily('noto')} className="text-[10px] py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-gray-300">Noto</button>
                            <button onClick={() => handleGlobalFontFamily('zhimang')} className="text-[10px] py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-gray-300 font-zhimang">Zhi</button>
                            <button onClick={() => handleGlobalFontFamily('mashan')} className="text-[10px] py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-gray-300 font-mashan">Ma</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                         <div className="flex items-center justify-between text-xs text-gray-500">
                             <span>{t('concurrency', lang)}</span>
                             <input 
                                 type="number" 
                                 min="1" 
                                 max="10" 
                                 value={concurrency} 
                                 onChange={(e) => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))} 
                                 className="w-12 bg-gray-800 border border-gray-700 rounded px-1 text-center text-xs text-gray-200 focus:border-blue-500 outline-none"
                             />
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleBatchProcess(true)} disabled={isProcessingBatch || !currentImage} className="py-2 bg-purple-900/50 hover:bg-purple-800 border border-purple-700 rounded text-xs text-purple-200 flex items-center justify-center gap-1 disabled:opacity-50">{isProcessingBatch ? <Loader2 className="animate-spin" size={12}/> : <Play size={12}/>} {t('current', lang)}</button>
                            <button onClick={() => handleBatchProcess(false)} disabled={isProcessingBatch} className="py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">{isProcessingBatch ? <Loader2 className="animate-spin" size={12}/> : <Layers size={12}/>} {t('processAll', lang)}</button>
                         </div>
                    </div>
                    <div className="h-px bg-gray-800 my-2"></div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => currentImage && downloadSingleImage(currentImage)} disabled={!currentImage} className="py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 flex items-center justify-center gap-1"><ImageIcon size={12}/> {t('saveImage', lang)}</button>
                        <button onClick={() => downloadAllAsZip(images)} className="py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 flex items-center justify-center gap-1"><Download size={12}/> {t('zipAll', lang)}</button>
                    </div>
                </div>
            )}
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 relative bg-[#1a1a1a] overflow-hidden flex flex-col">
        {!currentImage ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 select-none"><Maximize size={64} className="mx-auto mb-4"/><h2 className="text-2xl font-bold">{t('noImageSelected', lang)}</h2><p className="mt-2 text-sm">{t('dragDrop', lang)}</p></div>
        ) : (
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 relative">
            <div className="relative shadow-2xl inline-block" ref={containerRef} style={{ maxWidth: '100%' }}>
              <img src={currentImage.url} alt="Workspace" className="max-h-[90vh] max-w-full block select-none pointer-events-none" />
              <div className="absolute inset-0" style={{ containerType: 'inline-size' } as React.CSSProperties}>
                  <div className="absolute inset-0 cursor-crosshair-text z-0" onClick={handleCanvasClick} />
                  {bubbles.map(bubble => (
                    <BubbleLayer
                      key={bubble.id}
                      bubble={bubble}
                      isSelected={selectedBubbleId === bubble.id}
                      onMouseDown={(e) => handleMouseDown(e, bubble.id)}
                      onResizeStart={handleResizeStart}
                      onUpdate={handleBubbleUpdate}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Right Sidebar */}
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
         ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-600 select-none p-6 text-center"><div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4"><MessageSquareDashed size={32} className="opacity-50"/></div><h3 className="text-sm font-semibold text-gray-500">{t('noBubbleSelected', lang)}</h3><p className="text-xs mt-2 max-w-[200px]">{t('clickBubbleHint', lang)}</p></div>
         )}
      </aside>

      {/* Modals */}
      {showSettings && <SettingsModal config={aiConfig} onSave={(newConfig) => { setAiConfig(newConfig); setShowSettings(false); }} onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpModal lang={lang} onClose={() => setShowHelp(false)} />}
      {showManualJson && currentId && <ManualJsonModal config={aiConfig} onApply={(detected) => { const newBubbles: Bubble[] = detected.map(d => ({ id: crypto.randomUUID(), x: d.x, y: d.y, width: d.width, height: d.height, text: d.text, isVertical: d.isVertical, fontFamily: 'noto', fontSize: aiConfig.defaultFontSize, color: '#0f172a', backgroundColor: '#ffffff', rotation: 0 })); updateImageBubbles(currentId, newBubbles); setShowManualJson(false); }} onClose={() => setShowManualJson(false)} />}
    </div>
  );
};

export default App;
