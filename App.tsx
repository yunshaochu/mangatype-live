

import React, { useRef, useEffect } from 'react';
import { BubbleEditor } from './components/BubbleEditor';
import { SettingsModal } from './components/SettingsModal';
import { ManualJsonModal } from './components/ManualJsonModal';
import { HelpModal } from './components/HelpModal';
import { Gallery } from './components/Gallery';
import { ControlPanel } from './components/ControlPanel';
import { Workspace } from './components/Workspace';
import { Bubble } from './types';
import { Settings, Undo2, Redo2, CircleHelp, Scan, MessageSquareDashed, Eraser, Loader2, RotateCcw } from 'lucide-react';
import { t } from './services/i18n';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useProjectContext } from './contexts/ProjectContext';

const App: React.FC = () => {
  // 1. Consume Context
  const {
    // State
    history, images, setImages, setHistory, 
    currentId, currentImage, setCurrentId,
    selectedBubbleId, setSelectedBubbleId, selectedMaskId, setSelectedMaskId,
    aiConfig,
    
    // Actions
    handleUndo, handleRedo, deleteCurrentSelection, navigateImage,
    processFiles, updateImageBubbles, triggerAutoColorDetection,
    handleGlobalColorDetection,
    
    // UI State
    showSettings, setShowSettings,
    showHelp, setShowHelp,
    showManualJson, setShowManualJson,
    setAiConfig,
    drawTool, 

    // Inpainting
    handleInpaint,
    isInpainting,
    handleRestoreRegion
  } = useProjectContext();

  const bubbles = currentImage?.bubbles || [];
  const maskRegions = currentImage?.maskRegions || []; 
  const selectedBubble = selectedBubbleId ? bubbles.find(b => b.id === selectedBubbleId) : undefined;
  const lang = aiConfig.language;
  const concurrency = 1;

  // Refs for file inputs (still local to App as they are DOM elements)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // 2. Canvas Interaction Hook 
  const { 
      containerRef, 
      handleCanvasMouseDown, handleLayerMouseDown, handleResizeStart 
  } = useCanvasInteraction({
      currentId,
      images,
      setImages,
      setHistory,
      aiConfig,
      setSelectedBubbleId,
      setSelectedMaskId,
      triggerAutoColorDetection,
      drawTool
  });

  // 3. Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (!isInput && (e.ctrlKey || e.metaKey)) {
        if (e.key === 'z') { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); }
        else if (e.key === 'y') { e.preventDefault(); handleRedo(); }
      }
      if (!isInput) {
          if (e.key === 'ArrowLeft') { e.preventDefault(); navigateImage('prev'); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); navigateImage('next'); }
      }
      if (!isInput && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        deleteCurrentSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, navigateImage, deleteCurrentSelection]);

  // 4. File Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) processFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ''; };
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) processFiles(e.target.files); if (folderInputRef.current) folderInputRef.current.value = ''; };

  const handleGlobalColorReset = () => setImages(prev => prev.map(img => ({ ...img, bubbles: img.bubbles.map(b => ({ ...b, backgroundColor: '#ffffff' })) })));

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
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
                onAddFile={() => fileInputRef.current?.click()} 
                onAddFolder={() => folderInputRef.current?.click()}
            />
        </div>
        {images.length > 0 && (
            <ControlPanel />
        )}
      </aside>

      <main className="flex-1 relative bg-[#1a1a1a] overflow-hidden flex flex-col">
          <Workspace 
            // We only pass event handlers that come from the local useCanvasInteraction hook
            containerRef={containerRef}
            onCanvasMouseDown={handleCanvasMouseDown} 
            onMaskMouseDown={(e, id) => handleLayerMouseDown(e, id, 'mask')} 
            onBubbleMouseDown={(e, id) => handleLayerMouseDown(e, id, 'bubble')}
            onResizeStart={handleResizeStart} 
          />
      </main>

      <aside className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col z-20 shadow-2xl shrink-0">
         {selectedBubble && currentId ? (
             <BubbleEditor />
         ) : selectedMaskId && currentId ? (
              <div className="flex-1 flex flex-col text-gray-600 select-none p-4">
                   <div className="flex flex-col items-center justify-center p-6 text-center border-b border-gray-800">
                        <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
                            <Scan size={32} className="text-red-500"/>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-300">{t('toolMask', lang)}</h3>
                        <p className="text-xs mt-2 text-gray-500 leading-relaxed">{t('translateRegionsDesc', lang)}</p>
                   </div>
                   
                   <div className="p-6 space-y-4">
                       <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                           <Eraser size={12} /> {t('textRemoval', lang)}
                       </div>
                       
                       {/* Inpaint Button */}
                       {aiConfig.enableInpainting && (
                           <button 
                               onClick={() => handleInpaint(currentId, selectedMaskId)}
                               disabled={isInpainting}
                               className="w-full py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                               {isInpainting ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
                               {t('inpaintArea', lang)}
                           </button>
                       )}

                       {/* Restore Button */}
                       <button
                           onClick={() => handleRestoreRegion(currentId, selectedMaskId)}
                           className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-gray-900/20 flex items-center justify-center gap-2 transition-all"
                       >
                           <RotateCcw size={16} />
                           {t('restoreArea', lang)}
                       </button>

                       <p className="text-[10px] text-gray-500 text-center">
                           {t('inpaintDesc', lang)}
                       </p>
                   </div>
              </div>
         ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-600 select-none p-6 text-center"><div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4"><MessageSquareDashed size={32} className="opacity-50"/></div><h3 className="text-sm font-semibold text-gray-500">{t('noBubbleSelected', lang)}</h3><p className="text-xs mt-2 max-w-[200px]">{t('clickBubbleHint', lang)}</p></div>
         )}
      </aside>

      {showSettings && <SettingsModal config={aiConfig} onSave={(newConfig) => { const old = aiConfig.autoDetectBackground; setAiConfig(newConfig); setShowSettings(false); if (newConfig.autoDetectBackground !== old) { if (newConfig.autoDetectBackground) handleGlobalColorDetection(concurrency); else handleGlobalColorReset(); } }} onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpModal lang={lang} onClose={() => setShowHelp(false)} />}
      {showManualJson && currentId && <ManualJsonModal config={aiConfig} onApply={(detected) => { const newBubbles: Bubble[] = detected.map(d => ({ id: crypto.randomUUID(), x: d.x, y: d.y, width: d.width, height: d.height, text: d.text, isVertical: d.isVertical, fontFamily: 'noto', fontSize: aiConfig.defaultFontSize, color: '#0f172a', backgroundColor: '#ffffff', rotation: 0 })); updateImageBubbles(currentId, newBubbles); setShowManualJson(false); }} onClose={() => setShowManualJson(false)} />}
    </div>
  );
};

export default App;