

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { ImageState, Bubble, AIConfig } from '../types';
import { useProjectState } from '../hooks/useProjectState';
import { useProcessor } from '../hooks/useProcessor';
import { DEFAULT_SYSTEM_PROMPT } from '../services/geminiService';
import { detectBubbleColor } from '../services/exportService';

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
  allowAiFontSelection: true, // Default enabled
  defaultMaskShape: 'rectangle', 
  defaultMaskCornerRadius: 20,
  defaultMaskFeather: 0,
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
  stopProcessing: () => void;
  handleGlobalColorDetection: (concurrency: number) => void;

  // UI State
  drawTool: 'none' | 'bubble' | 'mask';
  setDrawTool: (tool: 'none' | 'bubble' | 'mask') => void;
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

  // 3. Processor Logic
  const processor = useProcessor({ images, setImages, aiConfig });

  // 4. UI State
  const [drawTool, setDrawTool] = useState<'none' | 'bubble' | 'mask'>('none');
  const [showSettings, setShowSettings] = useState(false);
  const [showManualJson, setShowManualJson] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [concurrency, setConcurrency] = useState(1);
  const [isMerging, setIsMerging] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 });
  const [showGlobalStyles, setShowGlobalStyles] = useState(false);

  // 5. Shared Actions
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
    const finalUpdates = { ...updates };
    if (finalUpdates.autoDetectBackground === false && !finalUpdates.backgroundColor) finalUpdates.backgroundColor = '#ffffff';
    
    setImages(prev => prev.map(img => img.id === currentId ? { 
        ...img, 
        bubbles: img.bubbles.map(b => b.id === bubbleId ? { ...b, ...finalUpdates } : b) 
    } : img));

    if (finalUpdates.autoDetectBackground === true) triggerAutoColorDetection(bubbleId);
  }, [currentId, setImages, triggerAutoColorDetection]);

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
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};