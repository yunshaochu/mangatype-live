
import React, { useRef, useEffect, useState } from 'react';
import { BubbleEditor } from './components/BubbleEditor';
import { SettingsModal } from './components/SettingsModal';
import { ManualJsonModal } from './components/ManualJsonModal';
import { HelpModal } from './components/HelpModal';
import { Gallery } from './components/Gallery';
import { ControlPanel } from './components/ControlPanel';
import { Workspace } from './components/Workspace';
import { Bubble } from './types';
import { Settings, Undo2, Redo2, CircleHelp, Scan, MessageSquareDashed, Eraser, Loader2, RotateCcw, PaintBucket, Pipette, Palette, Hash, Square, Layers, Sparkles, ChevronRight, Check } from 'lucide-react';
import { t } from './services/i18n';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useProjectContext } from './contexts/ProjectContext';

const PRESET_FILL_COLORS = ['#ffffff', '#000000', '#f3f4f6', '#d1d5db', '#e5e7eb', '#9ca3af'];

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
    processFiles, updateImageBubbles, updateMaskRegion, triggerAutoColorDetection,
    handleGlobalColorDetection,
    
    // UI State
    showSettings, setShowSettings,
    showHelp, setShowHelp,
    showManualJson, setShowManualJson,
    setAiConfig,
    drawTool, setDrawTool, paintMode, setPaintMode,

    // Inpainting
    handleInpaint,
    isInpainting,
    handleRestoreRegion,
    handleBoxFill,
    handleBatchBoxFill,
    handleBatchInpaint,
    brushColor, setBrushColor
  } = useProjectContext();

  const bubbles = currentImage?.bubbles || [];
  const selectedBubble = selectedBubbleId ? bubbles.find(b => b.id === selectedBubbleId) : undefined;
  const lang = aiConfig.language;
  const concurrency = 1;

  // Selected Mask Logic
  const maskRegions = currentImage?.maskRegions || [];
  const selectedMask = selectedMaskId ? maskRegions.find(m => m.id === selectedMaskId) : undefined;
  
  // Is current selected mask in Inpaint Mode?
  const isSelectedMaskErase = selectedMask?.method === 'inpaint';

  // Batch Scope State
  const [batchScope, setBatchScope] = useState<'current' | 'all'>('all');

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
      drawTool,
      paintMode
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
  
  const handleEyedropper = async () => {
      if (!window.EyeDropper) {
        alert("Browser doesn't support EyeDropper API.");
        return;
      }
      const eyeDropper = new window.EyeDropper();
      try {
        const result = await eyeDropper.open();
        setBrushColor(result.sRGBHex);
      } catch (e) {
        // ignore
      }
  };

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
            containerRef={containerRef}
            onCanvasMouseDown={handleCanvasMouseDown} 
            onMaskMouseDown={(e, id) => handleLayerMouseDown(e, id, 'mask')} 
            onBubbleMouseDown={(e, id) => handleLayerMouseDown(e, id, 'bubble')}
            onResizeStart={handleResizeStart} 
          />
      </main>

      <aside className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col z-20 shadow-2xl shrink-0 overflow-y-auto custom-scrollbar">
         {selectedBubble && currentId ? (
             <BubbleEditor />
         ) : selectedMaskId && currentId ? (
             drawTool === 'brush' && paintMode === 'box' ? (
                 // --- REDESIGNED 3-SECTION MASK PANEL ---
                 <div className="flex-1 flex flex-col text-gray-300 select-none p-4 space-y-6 animate-fade-in-right">
                     
                     {/* Header */}
                     <div className="text-center pb-4 border-b border-gray-800">
                          <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                              <Square size={16} className={isSelectedMaskErase ? "text-purple-500" : "text-red-500"}/> 
                              {t('cleanBoxTitle', lang)}
                          </h3>
                          <p className="text-xs mt-1 text-gray-500">{t('cleanBoxDesc', lang)}</p>
                     </div>
                     
                     {/* --- SECTION 1: ATTRIBUTE TOGGLE --- */}
                     <div className="space-y-2">
                         <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('maskTypeLabel', lang)}</label>
                         <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700">
                             <button
                                 onClick={() => selectedMaskId && updateMaskRegion(selectedMaskId, { method: 'fill' })}
                                 className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                     !isSelectedMaskErase 
                                     ? 'bg-red-600 text-white shadow' 
                                     : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                 }`}
                             >
                                 <PaintBucket size={14}/> {t('maskTypeFill', lang)}
                             </button>
                             <button
                                 onClick={() => selectedMaskId && updateMaskRegion(selectedMaskId, { method: 'inpaint' })}
                                 className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                     isSelectedMaskErase 
                                     ? 'bg-purple-600 text-white shadow' 
                                     : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                 }`}
                             >
                                 <Eraser size={14}/> {t('maskTypeErase', lang)}
                             </button>
                         </div>
                     </div>

                     <div className="h-px bg-gray-800"></div>

                     {/* --- SECTION 2: SINGLE ACTION (Context Aware) --- */}
                     <div className="space-y-4">
                         
                         {isSelectedMaskErase ? (
                             // PURPLE STATE: API ERASE
                             <div className="space-y-3 animate-fade-in">
                                 <div className="flex justify-between items-center">
                                     <label className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                                         <Eraser size={10} /> {t('inpaintSelected', lang)}
                                     </label>
                                     <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                                         Model: {aiConfig.inpaintingModel || 'lama'}
                                     </span>
                                 </div>
                                 {aiConfig.enableInpainting ? (
                                     <button 
                                         onClick={() => handleInpaint(currentId, selectedMaskId)}
                                         disabled={isInpainting}
                                         className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                     >
                                         {isInpainting ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />}
                                         {t('inpaintSelectedHint', lang)}
                                     </button>
                                 ) : (
                                     <div className="p-3 bg-gray-800/50 rounded-lg text-[10px] text-gray-500 text-center border border-dashed border-gray-700">
                                         {t('enableInpaintHint', lang)}
                                     </div>
                                 )}
                             </div>
                         ) : (
                             // RED STATE: MANUAL FILL
                             <div className="space-y-3 animate-fade-in">
                                 <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                                        <PaintBucket size={10} /> {t('fillSelected', lang)}
                                    </label>
                                 </div>
                                 
                                 <div className="bg-gray-800/30 p-3 rounded-xl border border-gray-800 space-y-3">
                                     {/* Color Tools */}
                                     <div className="flex gap-2 items-center">
                                         <div className="flex-1 relative group">
                                             <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"><Hash size={12}/></div>
                                             <input 
                                                 type="text" 
                                                 value={brushColor.replace('#', '')}
                                                 onChange={(e) => setBrushColor(`#${e.target.value}`)}
                                                 className="w-full bg-gray-900 border border-gray-700 rounded-md h-8 pl-7 text-xs text-white uppercase font-mono focus:border-red-500 outline-none transition-colors"
                                             />
                                         </div>
                                         <div className="relative w-8 h-8 rounded-md border border-gray-600 overflow-hidden shrink-0 cursor-pointer hover:border-white transition-colors">
                                             <input 
                                                 type="color"
                                                 value={brushColor}
                                                 onChange={(e) => setBrushColor(e.target.value)}
                                                 className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer"
                                             />
                                         </div>
                                         <button 
                                            onClick={handleEyedropper} 
                                            className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-md text-gray-300 transition-colors"
                                            title={t('pickColor', lang)}
                                         >
                                             <Pipette size={14}/>
                                         </button>
                                     </div>
                                     
                                     {/* Presets Grid */}
                                     <div className="grid grid-cols-6 gap-1.5">
                                          {PRESET_FILL_COLORS.map(c => (
                                              <button
                                                  key={c}
                                                  onClick={() => setBrushColor(c)}
                                                  className={`aspect-square rounded border transition-all hover:scale-110 ${brushColor.toLowerCase() === c ? 'border-red-500 ring-1 ring-red-500/50 z-10' : 'border-gray-600 hover:border-gray-400'}`}
                                                  style={{ backgroundColor: c }}
                                                  title={c}
                                              />
                                          ))}
                                     </div>

                                     <button 
                                         onClick={() => handleBoxFill(currentId, selectedMaskId, brushColor)}
                                         className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all"
                                     >
                                         <PaintBucket size={14} /> {t('fillSelectedHint', lang)}
                                     </button>
                                 </div>
                             </div>
                         )}

                         {/* Restore Button (Common) */}
                         <button
                             onClick={() => handleRestoreRegion(currentId, selectedMaskId)}
                             className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium rounded-lg border border-gray-700 transition-all flex items-center justify-center gap-2"
                         >
                             <RotateCcw size={14} />
                             {t('restoreArea', lang)}
                         </button>
                     </div>

                     <div className="h-px bg-gray-800"></div>

                     {/* --- SECTION 3: SPLIT BATCH ACTIONS --- */}
                     <div className="space-y-3">
                         <div className="flex justify-between items-baseline mb-1">
                             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                 <Layers size={10} /> {t('batchOperations', lang)}
                             </label>
                             
                             <label className="flex items-center gap-1.5 cursor-pointer group select-none">
                                <input 
                                    type="checkbox" 
                                    checked={batchScope === 'all'} 
                                    onChange={(e) => setBatchScope(e.target.checked ? 'all' : 'current')}
                                    className="rounded-sm bg-gray-800 border-gray-600 text-blue-500 w-3 h-3 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className={`text-[9px] transition-colors ${batchScope === 'all' ? 'text-blue-400 font-bold' : 'text-gray-500 group-hover:text-gray-400'}`}>
                                    {t('applyToAll', lang)}
                                </span>
                             </label>
                         </div>
                         
                         {/* Button A: Fill Red */}
                         <button 
                             onClick={() => handleBatchBoxFill(batchScope, brushColor)}
                             disabled={isInpainting}
                             className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-red-500/50 text-gray-300 text-xs font-medium rounded-xl transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 group"
                         >
                             <div className="flex items-center gap-2">
                                <PaintBucket size={14} className="text-red-500"/> 
                                <span className="font-bold">{t('batchFillRed', lang)}</span>
                             </div>
                             <span className="text-[9px] text-gray-500 group-hover:text-gray-400">{t('batchFillRedHint', lang)}</span>
                         </button>

                         {/* Button B: Erase Purple */}
                         <button 
                             onClick={() => handleBatchInpaint(currentImage, batchScope === 'current', concurrency)}
                             disabled={isInpainting}
                             className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-purple-500/50 text-gray-300 text-xs font-medium rounded-xl transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-50 group"
                         >
                             <div className="flex items-center gap-2">
                                <Eraser size={14} className="text-purple-500"/> 
                                <span className="font-bold">{t('batchErasePurple', lang)}</span>
                             </div>
                             <span className="text-[9px] text-gray-500 group-hover:text-gray-400">{t('batchErasePurpleHint', lang)}</span>
                         </button>
                     </div>
                 </div>
             ) : (
                // --- OLD MASK PANEL (For standard Mask Tool) ---
                <div className="flex-1 flex flex-col text-gray-600 select-none p-4">
                     <div className="flex flex-col items-center justify-center p-6 text-center border-b border-gray-800">
                          <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
                              <Scan size={32} className="text-red-500"/>
                          </div>
                          <h3 className="text-sm font-semibold text-gray-300">{t('toolMask', lang)}</h3>
                          <p className="text-xs mt-2 text-gray-500 leading-relaxed">{t('translateRegionsDesc', lang)}</p>
                     </div>
                     <div className="p-6 text-center space-y-4">
                         <p className="text-xs text-gray-500 leading-relaxed">{t('boxCleanerDesc', lang)}</p>
                         <button 
                             onClick={() => {
                                 setDrawTool('brush');
                                 setPaintMode('box');
                             }}
                             className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20"
                         >
                             {t('goBoxCleaner', lang)} <ChevronRight size={14}/>
                         </button>
                     </div>
                </div>
             )
         ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-600 select-none p-6 text-center"><div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4"><MessageSquareDashed size={32} className="opacity-50"/></div><h3 className="text-sm font-semibold text-gray-500">{t('noBubbleSelected', lang)}</h3><p className="text-xs mt-2 max-w-[200px]">{t('clickBubbleHint', lang)}</p></div>
         )}
      </aside>

      {showSettings && <SettingsModal config={aiConfig} onSave={(newConfig) => { const old = aiConfig.autoDetectBackground; setAiConfig(newConfig); setShowSettings(false); if (newConfig.autoDetectBackground !== old) { if (newConfig.autoDetectBackground) handleGlobalColorDetection(concurrency); else handleGlobalColorReset(); } }} onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpModal lang={lang} onClose={() => setShowHelp(false)} />}
      {showManualJson && currentId && <ManualJsonModal config={aiConfig} maskRegions={currentImage?.maskRegions} onApply={(detected) => { const newBubbles: Bubble[] = detected.map(d => ({ id: crypto.randomUUID(), x: d.x, y: d.y, width: d.width, height: d.height, text: d.text, isVertical: d.isVertical, fontFamily: 'noto', fontSize: aiConfig.defaultFontSize, color: '#000000', strokeColor: '#ffffff', backgroundColor: '#ffffff', rotation: 0 })); updateImageBubbles(currentId, newBubbles); setShowManualJson(false); }} onClose={() => setShowManualJson(false)} />}
    </div>
  );
};

export default App;
