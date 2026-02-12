
import React from 'react';
import { MousePointer2, MessageSquareDashed, Scan, Square, Sparkles, Layers, RefreshCw, FileJson, ScanText, Palette, Zap, Loader2, FileStack, Image as ImageIcon, Archive, Type, Minus, Plus, ChevronDown, Plus as PlusIcon, Eraser, Brush, Pipette, Hash, PaintBucket, MousePointerClick } from 'lucide-react';
import { t } from '../services/i18n';
import { useProjectContext } from '../contexts/ProjectContext';
import { createBubble } from '../utils/editorUtils';
import { compositeImage, downloadAllAsZip, downloadSingleImage, ExportOptions } from '../services/exportService';

const PRESET_BRUSH_COLORS = ['#ffffff', '#000000', '#f3f4f6', '#d1d5db'];

export const ControlPanel: React.FC = () => {
  const {
    currentImage, images, setImages, 
    currentId, setSelectedBubbleId, setSelectedMaskId, updateImageBubbles,
    aiConfig,
    // Processing state
    isProcessingBatch, handleBatchProcess, handleResetStatus, stopProcessing, handleLocalDetectionScan, handleBatchInpaint,
    // UI state
    drawTool, setDrawTool, activeLayer,
    showGlobalStyles, setShowGlobalStyles,
    concurrency, setConcurrency,
    isMerging, setIsMerging,
    isZipping, setIsZipping,
    zipProgress, setZipProgress,
    setShowManualJson,
    // Brush
    brushColor, setBrushColor, brushSize, setBrushSize,
    paintMode, setPaintMode
  } = useProjectContext();

  const lang = aiConfig.language;
  const bubbles = currentImage?.bubbles || [];

  const handleToolChange = (tool: 'none' | 'bubble' | 'mask' | 'brush') => {
      setDrawTool(tool);
      setSelectedBubbleId(null);
      setSelectedMaskId(null);
  };

  const onAddManualBubble = () => {
    if (!currentId) return;
    const newBubble = createBubble(50, 50, aiConfig.defaultFontSize);
    updateImageBubbles(currentId, [...bubbles, newBubble]);
    setSelectedBubbleId(newBubble.id); setSelectedMaskId(null);
  };

  // --- Global Style Actions ---
  const onGlobalFontScale = (factor: number) => {
    if (!currentImage) return;
    const newBubbles = currentImage.bubbles.map(b => ({ ...b, fontSize: Math.max(0.5, Math.min(5.0, parseFloat((b.fontSize * factor).toFixed(2)))) }));
    updateImageBubbles(currentImage.id, newBubbles);
  };
  const onGlobalMaskScale = (factor: number) => {
    if (!currentImage) return;
    const newBubbles = currentImage.bubbles.map(b => ({ ...b, width: Math.max(2, Math.min(100, parseFloat((b.width * factor).toFixed(1)))), height: Math.max(2, Math.min(100, parseFloat((b.height * factor).toFixed(1)))) }));
    updateImageBubbles(currentImage.id, newBubbles);
  };
  const onGlobalFontFamily = (fontFamily: any) => {
      if (!currentImage) return;
      updateImageBubbles(currentImage.id, currentImage.bubbles.map(b => ({ ...b, fontFamily })));
  };

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

  // --- Export Actions ---
  const getExportOptions = (): ExportOptions => ({
      defaultMaskShape: aiConfig.defaultMaskShape,
      defaultMaskCornerRadius: aiConfig.defaultMaskCornerRadius,
      defaultMaskFeather: aiConfig.defaultMaskFeather
  });

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const onMergeLayers = async () => {
    if (!currentImage || currentImage.bubbles.length === 0) return;
    setIsMerging(true);
    try {
        const blob = await compositeImage(currentImage, getExportOptions());
        if (blob) {
            const newUrl = URL.createObjectURL(blob);
            const newBase64 = await blobToBase64(blob);
            setImages(prev => prev.map(img => img.id === currentImage.id ? { ...img, url: newUrl, base64: newBase64, bubbles: [] } : img));
            setSelectedBubbleId(null);
        }
    } catch (e) { console.error("Merge failed", e); alert("Failed to merge layers."); } finally { setIsMerging(false); }
  };

  const onZipDownload = async () => {
    if (images.length === 0 || isZipping) return;
    setIsZipping(true); setZipProgress({ current: 0, total: images.length });
    try { 
        await downloadAllAsZip(images, (curr, total) => { setZipProgress({ current: curr, total }); }, getExportOptions()); 
    } catch (e) { console.error(e); alert("Zip creation failed"); } finally { setIsZipping(false); setZipProgress({ current: 0, total: 0 }); }
  };

  return (
    <div className="bg-gray-900 border-t border-gray-800 shrink-0 flex flex-col relative z-20">
      {/* Global Styles Popup */}
      {showGlobalStyles && (
        <div className="bg-gray-800/95 border-t border-gray-700 p-3 space-y-2 animate-slide-up-fade shadow-xl absolute bottom-full w-full z-10">
          <div className="flex justify-between items-center mb-1">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Type size={10} /> {t('globalStyles', lang)}
            </div>
            <button onClick={() => setShowGlobalStyles(false)} className="text-gray-500 hover:text-white">
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 shrink-0 flex justify-center text-gray-400" title={t('fontSizeTooltip', lang)}><Type size={14} /></div>
            <div className="flex flex-1 gap-1">
              <button onClick={() => onGlobalFontScale(0.9)} disabled={!currentImage || currentImage.bubbles.length === 0} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 flex items-center justify-center gap-1"><Minus size={12} /></button>
              <button onClick={() => onGlobalFontScale(1.1)} disabled={!currentImage || currentImage.bubbles.length === 0} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 flex items-center justify-center gap-1"><Plus size={12} /></button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 shrink-0 flex justify-center text-gray-400" title={t('maskSizeTooltip', lang)}><Scan size={14} /></div>
            <div className="flex flex-1 gap-1">
              <button onClick={() => onGlobalMaskScale(0.9)} disabled={!currentImage || currentImage.bubbles.length === 0} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 flex items-center justify-center gap-1"><Minus size={12} /></button>
              <button onClick={() => onGlobalMaskScale(1.1)} disabled={!currentImage || currentImage.bubbles.length === 0} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 flex items-center justify-center gap-1"><Plus size={12} /></button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1 mt-1">
            <button onClick={() => onGlobalFontFamily('noto')} className="text-[10px] py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300">Noto</button>
            <button onClick={() => onGlobalFontFamily('happy')} className="text-[10px] py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300 font-happy">Cute</button>
            <button onClick={() => onGlobalFontFamily('zhimang')} className="text-[10px] py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300 font-zhimang">Zhi</button>
            <button onClick={() => onGlobalFontFamily('mashan')} className="text-[10px] py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300 font-mashan">Ma</button>
          </div>
        </div>
      )}

      <div className="p-3 space-y-3">
        {/* Tool Switcher */}
        <div className="flex p-1 bg-gray-800 rounded-lg overflow-x-auto no-scrollbar gap-1">
          <button
            onClick={() => handleToolChange('none')}
            className={`flex-1 py-1 px-2 text-xs rounded-md transition-all flex items-center justify-center gap-1 whitespace-nowrap ${drawTool === 'none' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
            title={t('toolNone', lang)}
          >
            <MousePointer2 size={12} /> View
          </button>
          
          {/* Conditional Slot: Paint (if clean layer) vs Bubble (if other layers) */}
          {activeLayer === 'clean' ? (
            <button
                onClick={() => handleToolChange('brush')}
                className={`flex-1 py-1 px-2 text-xs rounded-md transition-all flex items-center justify-center gap-1 whitespace-nowrap ${drawTool === 'brush' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                title={t('toolBrush', lang)}
            >
                <Brush size={12} /> Paint
            </button>
          ) : (
            <button
                onClick={() => handleToolChange('bubble')}
                className={`flex-1 py-1 px-2 text-xs rounded-md transition-all flex items-center justify-center gap-1 whitespace-nowrap ${drawTool === 'bubble' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                title={t('toolBubble', lang)}
            >
                <MessageSquareDashed size={12} /> Bubble
            </button>
          )}

          <button
            onClick={() => handleToolChange('mask')}
            className={`flex-1 py-1 px-2 text-xs rounded-md transition-all flex items-center justify-center gap-1 whitespace-nowrap ${drawTool === 'mask' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
            title={t('toolMask', lang)}
          >
            <Scan size={12} /> Mask
          </button>
        </div>

        {/* Action Buttons Area */}
        <div className="flex flex-col gap-1.5 relative">
          {isProcessingBatch ? (
            <button
              onClick={stopProcessing}
              className="w-full h-10 bg-red-900/50 hover:bg-red-800 border border-red-700 rounded text-xs text-red-200 flex items-center justify-center gap-2 animate-pulse"
            >
              <Square size={12} fill="currentColor" /> {t('stop', lang)}
            </button>
          ) : (
            <>
              {/* Row 1: Primary Actions */}
              {drawTool === 'none' && (
                <div className="flex gap-1 h-8">
                  <button
                    onClick={() => handleBatchProcess(currentImage, true, concurrency)}
                    disabled={!currentImage}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50 shadow-sm px-2"
                    title={t('translateCurrent', lang)}
                  >
                    <Sparkles size={14} /> {t('translateCurrent', lang)}
                  </button>
                  <button
                    onClick={() => handleBatchProcess(currentImage, false, concurrency)}
                    className="flex-[1.5] bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-xs flex items-center justify-center gap-1 px-2"
                    title={t('translateAll', lang)}
                  >
                    <Layers size={14} /> {t('translateAll', lang)}
                  </button>
                  <button
                    onClick={handleResetStatus}
                    className="w-8 bg-gray-700 hover:bg-gray-600 text-yellow-500 rounded text-xs flex items-center justify-center"
                    title={t('resetStatus', lang)}
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    onClick={() => setShowManualJson(true)}
                    disabled={!currentImage}
                    className="w-8 bg-teal-900/40 hover:bg-teal-800/60 border border-teal-800 text-teal-200 rounded text-xs flex items-center justify-center"
                    title={t('importJson', lang)}
                  >
                    <FileJson size={14} />
                  </button>
                </div>
              )}

              {drawTool === 'mask' && (
                <>
                    <div className="grid grid-cols-2 gap-1 h-8">
                        <button
                            onClick={() => handleLocalDetectionScan(currentImage, false, concurrency)}
                            className="bg-orange-900/40 hover:bg-orange-800/60 border border-orange-800 text-orange-200 rounded text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                            title={t('scanCurrent', lang)}
                        >
                            <ScanText size={14} /> {t('scanCurrent', lang)}
                        </button>
                        <button
                            onClick={() => handleLocalDetectionScan(currentImage, true, concurrency)}
                            className="bg-orange-900/40 hover:bg-orange-800/60 border border-orange-800 text-orange-200 rounded text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                            title={t('scanAll', lang)}
                        >
                            <Layers size={14} /> {t('scanAll', lang)}
                        </button>
                    </div>
                </>
              )}

              {drawTool === 'bubble' && (
                <div className="h-8">
                    <button
                        onClick={onAddManualBubble}
                        disabled={!currentImage}
                        className="w-full h-full bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                    >
                    <PlusIcon size={16} /> {t('manualAdd', lang)}
                    </button>
                </div>
              )}

              {drawTool === 'brush' && (
                  <div className="space-y-2 animate-fade-in-down">
                      {/* Sub-tool Selection (Brush vs Box) */}
                      <div className="flex bg-gray-800 p-0.5 rounded-lg border border-gray-700">
                           <button 
                                onClick={() => setPaintMode('brush')}
                                className={`flex-1 py-1 rounded-md text-xs flex items-center justify-center gap-1 transition-all ${paintMode === 'brush' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                title="Freehand Brush (Alt+Click on canvas to pick color)"
                           >
                               <Brush size={12}/> Freehand
                           </button>
                           <button 
                                onClick={() => setPaintMode('box')}
                                className={`flex-1 py-1 rounded-md text-xs flex items-center justify-center gap-1 transition-all ${paintMode === 'box' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                title="Box Tool (Drag to Create, Click to Edit)"
                           >
                               <Square size={12}/> Box Tool
                           </button>
                      </div>

                      {/* Brush Settings - Only show in Freehand Mode */}
                      {paintMode === 'brush' && (
                        <div className="space-y-2 animate-fade-in">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 w-12">{t('brushSize', lang)}</span>
                                <input 
                                    type="range" min="1" max="100" 
                                    value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))}
                                    className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                                <span className="text-[10px] w-6 text-right text-gray-400">{brushSize}</span>
                            </div>
                            
                            {/* Brush Color */}
                            <div className="flex gap-1 items-center">
                                <div className="relative flex-1">
                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"><Hash size={10}/></div>
                                    <input 
                                        type="text" 
                                        value={brushColor.replace('#', '')}
                                        onChange={(e) => setBrushColor(`#${e.target.value}`)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded h-6 pl-5 text-[10px] text-white uppercase font-mono focus:border-purple-500 outline-none"
                                    />
                                </div>
                                
                                {PRESET_BRUSH_COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setBrushColor(c)}
                                        className={`w-6 h-6 rounded border transition-all ${brushColor.toLowerCase() === c ? 'border-purple-500 ring-1 ring-purple-500/50' : 'border-gray-600 hover:scale-105'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                                
                                <div className="relative w-6 h-6 rounded border border-gray-600 overflow-hidden shrink-0 cursor-pointer group">
                                        <input 
                                            type="color"
                                            value={brushColor}
                                            onChange={(e) => setBrushColor(e.target.value)}
                                            className="absolute -top-2 -left-2 w-10 h-10 p-0 border-0 cursor-pointer"
                                        />
                                </div>
                                <button onClick={handleEyedropper} className="w-6 h-6 flex items-center justify-center bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 text-gray-400" title={t('pickScreenColor', lang)}>
                                    <Pipette size={12}/>
                                </button>
                            </div>
                        </div>
                      )}

                      {/* Box Mode Hint */}
                      {paintMode === 'box' && (
                          <div className="text-[10px] text-gray-400 text-center animate-fade-in p-1 bg-gray-800/50 rounded">
                              Select a red box to see fill/clean options.
                          </div>
                      )}
                  </div>
              )}
            </>
          )}
        </div>

        <div className="h-px bg-gray-800"></div>

        {/* Global Settings & Export */}
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGlobalStyles(!showGlobalStyles)}
              className={`p-2 rounded hover:bg-gray-700 transition-colors ${showGlobalStyles ? 'text-blue-400 bg-gray-800' : 'text-gray-400'}`}
              title={t('globalStyles', lang)}
            >
              <Palette size={16} />
            </button>
            <div className="flex items-center gap-1 bg-gray-800 rounded px-1.5 py-1 border border-gray-700" title={t('concurrency', lang)}>
              <Zap size={10} className="text-yellow-500" />
              <input
                type="number"
                min="1"
                value={concurrency}
                onChange={(e) => setConcurrency(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-8 bg-transparent text-[10px] text-center text-gray-300 outline-none appearance-none"
              />
            </div>
          </div>

          <div className="flex gap-1">
            <button
              onClick={onMergeLayers}
              disabled={!currentImage || isMerging || currentImage.bubbles.length === 0}
              className="p-2 text-orange-400 hover:bg-gray-800 rounded disabled:opacity-30 transition-colors"
              title={t('merge', lang)}
            >
              {isMerging ? <Loader2 className="animate-spin" size={16} /> : <FileStack size={16} />}
            </button>
            <button
              onClick={() => currentImage && downloadSingleImage(currentImage, getExportOptions())}
              disabled={!currentImage}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30 transition-colors"
              title={t('saveImage', lang)}
            >
              <ImageIcon size={16} />
            </button>
            <button
              onClick={onZipDownload}
              disabled={isZipping || images.length === 0}
              className={`p-2 rounded transition-colors relative ${isZipping ? 'text-blue-400 bg-gray-800 cursor-not-allowed' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}
              title={t('zipAll', lang)}
            >
              {isZipping ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin absolute" size={16} />
                  <span className="text-[8px] font-bold absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[1px]">{zipProgress.current}</span>
                </div>
              ) : (
                <Archive size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
