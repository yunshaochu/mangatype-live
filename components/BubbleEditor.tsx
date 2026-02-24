

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FONTS } from '../types';
import { Trash2, Type, AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter, RotateCw, Maximize2, Palette, Minus, Plus, Pipette, Hash, Ban, Square, Circle, Box, BringToFront, SendToBack, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { t } from '../services/i18n';
import { useProjectContext } from '../contexts/ProjectContext';

const PRESET_BG_COLORS = [
  '#ffffff', // White
  '#000000', // Black
  '#f3f4f6', // Gray-100
  '#d1d5db', // Gray-300
  '#fecaca', // Red-200
  '#fde68a', // Amber-200
  '#bfdbfe', // Blue-200
];

// 文字颜色组合预设
const TEXT_COLOR_PRESETS = [
  { label: '黑字白边', color: '#000000', stroke: '#ffffff' },
  { label: '白字黑边', color: '#ffffff', stroke: '#000000' },
  { label: '红字白边', color: '#dc2626', stroke: '#ffffff' },
  { label: '蓝字白边', color: '#3b82f6', stroke: '#ffffff' },
];

const SHAPE_LABELS: Record<string, string> = {
  rectangle: '矩形',
  rounded: '圆角',
  ellipse: '椭圆',
};

// --- Collapsible Section Header ---
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  summary?: React.ReactNode;
}> = ({ icon, title, isOpen, onToggle, summary }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors group"
  >
    <ChevronRight
      size={14}
      className={`text-gray-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`}
    />
    <span className="text-gray-500 shrink-0">{icon}</span>
    <span className="text-xs font-medium text-gray-300 uppercase tracking-wide">{title}</span>
    {!isOpen && summary && (
      <span className="ml-auto flex items-center gap-1.5 text-[10px] text-gray-500 truncate">
        {summary}
      </span>
    )}
  </button>
);
export const BubbleEditor: React.FC = () => {
  const { currentImage, selectedBubbleId, updateBubble, deleteCurrentSelection, aiConfig, reorderBubble, setHistory, historyRef } = useProjectContext();
  const lang = aiConfig.language || 'zh';
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['layout']));

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Debounced history commit for text editing
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef<typeof historyRef.current.present | null>(null);

  const commitTextHistory = useCallback(() => {
    if (snapshotRef.current) {
      const snapshot = snapshotRef.current;
      snapshotRef.current = null;
      setHistory(curr => ({
        past: [...curr.past, snapshot].slice(-20),
        present: curr.present,
        future: []
      }));
    }
  }, [setHistory]);

  const handleTextChange = useCallback((bubbleId: string, text: string) => {
    if (!snapshotRef.current) {
      snapshotRef.current = historyRef.current.present;
    }
    updateBubble(bubbleId, { text }, true);
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(commitTextHistory, 500);
  }, [updateBubble, commitTextHistory, historyRef]);

  useEffect(() => {
    return () => {
      if (textTimerRef.current) {
        clearTimeout(textTimerRef.current);
        commitTextHistory();
      }
    };
  }, [selectedBubbleId, commitTextHistory]);

  const bubble = currentImage?.bubbles.find(b => b.id === selectedBubbleId);
  if (!bubble) return null;

  const isAutoDetectEnabled = bubble.autoDetectBackground ?? aiConfig.autoDetectBackground ?? false;
  const currentShape = bubble.maskShape || aiConfig.defaultMaskShape || 'ellipse';
  const currentRadius = bubble.maskCornerRadius !== undefined ? bubble.maskCornerRadius : (aiConfig.defaultMaskCornerRadius || 15);
  const currentFeather = bubble.maskFeather !== undefined ? bubble.maskFeather : (aiConfig.defaultMaskFeather || 0);

  const handleManualColorChange = (color: string) => {
    updateBubble(bubble.id, { backgroundColor: color, autoDetectBackground: false });
  };
  const handleEyedropper = async () => {
    if (!window.EyeDropper) { alert("Your browser does not support the EyeDropper API (try Chrome or Edge)."); return; }
    try { const result = await new window.EyeDropper().open(); handleManualColorChange(result.sRGBHex); } catch (e) {}
  };
  const handleTextColorEyedropper = async () => {
    if (!window.EyeDropper) { alert("Your browser does not support the EyeDropper API (try Chrome or Edge)."); return; }
    try { const result = await new window.EyeDropper().open(); updateBubble(bubble.id, { color: result.sRGBHex }); } catch (e) {}
  };
  const handleStrokeColorEyedropper = async () => {
    if (!window.EyeDropper) { alert("Your browser does not support the EyeDropper API (try Chrome or Edge)."); return; }
    try { const result = await new window.EyeDropper().open(); updateBubble(bubble.id, { strokeColor: result.sRGBHex }); } catch (e) {}
  };

  const currentFontName = FONTS.find(f => f.id === bubble.fontFamily)?.name?.split('(')[0] || bubble.fontFamily;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header with Layer Controls */}
      <div className="p-4 border-b border-gray-800 shrink-0 bg-gray-900 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            {t('properties', lang)}
          </h3>
          <button onClick={deleteCurrentSelection} className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-900/30 transition-colors" title={t('deleteBubble', lang)}>
            <Trash2 size={16} />
          </button>
        </div>
        <div className="flex justify-between gap-1 bg-gray-800 rounded p-1">
          <button onClick={() => reorderBubble(bubble.id, 'front')} className="flex-1 p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white flex justify-center" title={t('bringToFront', lang)}><BringToFront size={14}/></button>
          <button onClick={() => reorderBubble(bubble.id, 'forward')} className="flex-1 p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white flex justify-center" title={t('moveUp', lang)}><ChevronUp size={14}/></button>
          <button onClick={() => reorderBubble(bubble.id, 'backward')} className="flex-1 p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white flex justify-center" title={t('moveDown', lang)}><ChevronDown size={14}/></button>
          <button onClick={() => reorderBubble(bubble.id, 'back')} className="flex-1 p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white flex justify-center" title={t('sendToBack', lang)}><SendToBack size={14}/></button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 styled-scrollbar">

        {/* Text Input — always visible */}
        <div className="space-y-2 pb-3">
          <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('content', lang)}</label>
          <textarea
            value={bubble.text}
            onChange={(e) => handleTextChange(bubble.id, e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-sm focus:border-blue-500 outline-none resize-none font-sans transition-colors"
            rows={5}
            placeholder={t('enterText', lang)}
          />
        </div>
        {/* ===== Section 1: Mask Geometry ===== */}
        <div className="border-t border-gray-800 pt-1">
          <SectionHeader
            icon={<Maximize2 size={14}/>}
            title={t('maskGeometry', lang)}
            isOpen={openSections.has('mask')}
            onToggle={() => toggleSection('mask')}
            summary={<>{SHAPE_LABELS[currentShape] || currentShape} · {bubble.width.toFixed(1)}×{bubble.height.toFixed(1)}%</>}
          />
          {openSections.has('mask') && (
            <div className="px-3 pb-3 space-y-4 animate-fade-in-down">
              {/* Width / Height */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>{t('width', lang)}</span><span>{bubble.width.toFixed(1)}%</span></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateBubble(bubble.id, { width: Math.max(0, bubble.width - 0.5) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Minus size={12}/></button>
                    <input type="range" min="0" max="50" step="0.5" value={bubble.width} onChange={(e) => updateBubble(bubble.id, { width: parseFloat(e.target.value) })} className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                    <button onClick={() => updateBubble(bubble.id, { width: Math.min(50, bubble.width + 0.5) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Plus size={12}/></button>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>{t('height', lang)}</span><span>{bubble.height.toFixed(1)}%</span></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateBubble(bubble.id, { height: Math.max(0, bubble.height - 0.5) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Minus size={12}/></button>
                    <input type="range" min="0" max="50" step="0.5" value={bubble.height} onChange={(e) => updateBubble(bubble.id, { height: parseFloat(e.target.value) })} className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                    <button onClick={() => updateBubble(bubble.id, { height: Math.min(50, bubble.height + 0.5) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Plus size={12}/></button>
                  </div>
                </div>
              </div>
              {/* Shape */}
              <div className="space-y-3 pt-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase block">{t('shape', lang)}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'rectangle', icon: Square, title: t('shapeRect', lang) },
                    { id: 'rounded', icon: Box, title: t('shapeRound', lang) },
                    { id: 'ellipse', icon: Circle, title: t('shapeEllipse', lang) },
                  ].map((opt) => (
                    <button key={opt.id} onClick={() => updateBubble(bubble.id, { maskShape: opt.id as any })} title={opt.title}
                      className={`flex items-center justify-center p-2 rounded border transition-all ${currentShape === opt.id ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                      <opt.icon size={16} className={currentShape === opt.id ? "fill-current opacity-30" : ""}/>
                    </button>
                  ))}
                </div>
                {currentShape === 'rounded' && (
                  <div className="space-y-1 animate-fade-in-down">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>{t('cornerRadius', lang)}</span><span>{currentRadius}%</span></div>
                    <input type="range" min="0" max="50" step="1" value={currentRadius} onChange={(e) => updateBubble(bubble.id, { maskCornerRadius: parseInt(e.target.value) })} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>{t('feathering', lang)}</span><span>{currentFeather}</span></div>
                  <input type="range" min="0" max="50" step="1" value={currentFeather} onChange={(e) => updateBubble(bubble.id, { maskFeather: parseInt(e.target.value) })} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                </div>
              </div>
              {/* Background Color */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <label className="text-[10px] text-gray-500 font-bold uppercase block mt-2">Background Color</label>
                <div className="flex items-center justify-between bg-gray-800/30 p-2 rounded border border-gray-700/50">
                  <label className="text-xs text-gray-400 flex items-center gap-2" title={t('autoDetectBackgroundHint', lang)}>
                    <Pipette size={14} className={isAutoDetectEnabled ? 'text-cyan-400' : 'text-gray-500'}/> {t('autoDetect', lang)}
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={isAutoDetectEnabled} onChange={(e) => updateBubble(bubble.id, { autoDetectBackground: e.target.checked })}/>
                    <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-600"></div>
                  </label>
                </div>
                <div className={`space-y-2 transition-opacity ${isAutoDetectEnabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"><Hash size={12}/></div>
                      <input type="text" value={bubble.backgroundColor === 'transparent' ? '' : bubble.backgroundColor.replace('#', '')} onChange={(e) => handleManualColorChange(`#${e.target.value}`)} placeholder="FFFFFF" className="w-full bg-gray-800 border border-gray-700 rounded h-8 pl-6 text-xs text-white uppercase font-mono focus:border-blue-500 outline-none"/>
                    </div>
                    <div className="relative w-8 h-8 rounded border border-gray-600 overflow-hidden shrink-0 cursor-pointer group">
                      <input type="color" value={bubble.backgroundColor === 'transparent' ? '#ffffff' : bubble.backgroundColor} onChange={(e) => handleManualColorChange(e.target.value)} className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer"/>
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/10 group-hover:bg-transparent"><Palette size={14} className="text-white drop-shadow-md"/></div>
                    </div>
                    <button onClick={handleEyedropper} className="w-8 h-8 flex items-center justify-center bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 hover:text-white text-gray-400 transition-colors" title={t('pickColor', lang)}><Pipette size={14}/></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => handleManualColorChange('transparent')} className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${bubble.backgroundColor === 'transparent' ? 'border-red-500 ring-1 ring-red-500/50' : 'border-gray-700 hover:border-gray-500'}`} title={t('transparentColor', lang)}><Ban size={12} className="text-red-400"/></button>
                    {PRESET_BG_COLORS.map(c => (
                      <button key={c} onClick={() => handleManualColorChange(c)} className={`w-6 h-6 rounded border transition-all ${bubble.backgroundColor.toLowerCase() === c ? 'border-blue-500 ring-1 ring-blue-500/50 scale-110' : 'border-gray-600 hover:scale-105'}`} style={{ backgroundColor: c }} title={c}/>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* ===== Section 2: Text Style (Colors) ===== */}
        <div className="border-t border-gray-800 pt-1">
          <SectionHeader
            icon={<Palette size={14}/>}
            title={t('textStyle', lang)}
            isOpen={openSections.has('color')}
            onToggle={() => toggleSection('color')}
            summary={<>
              <div className="w-3.5 h-3.5 rounded-full border border-gray-600" style={{ backgroundColor: bubble.color }}/>
              <div className="w-3.5 h-3.5 rounded-full border border-gray-600" style={{ backgroundColor: bubble.strokeColor || '#ffffff' }}/>
            </>}
          />
          {openSections.has('color') && (
            <div className="px-3 pb-3 space-y-4 animate-fade-in-down">
              {/* Color Combination Presets */}
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase block">颜色组合 (Color Presets)</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEXT_COLOR_PRESETS.map(preset => (
                    <button key={preset.label} onClick={() => updateBubble(bubble.id, { color: preset.color, strokeColor: preset.stroke })}
                      className="px-3 py-2 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 transition-all text-xs flex items-center justify-center gap-2"
                      title={`${preset.label}: 文字${preset.color} 描边${preset.stroke}`}>
                      <span className="text-gray-300">{preset.label}</span>
                      <div className="flex gap-0.5">
                        <div className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: preset.color }}/>
                        <div className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: preset.stroke }}/>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Text Color */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <label className="text-[10px] text-gray-500 font-bold uppercase block">文字颜色 (Text Color)</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"><Hash size={12}/></div>
                      <input type="text" value={bubble.color.replace('#', '')} onChange={(e) => updateBubble(bubble.id, { color: `#${e.target.value}` })} placeholder="000000" className="w-full bg-gray-800 border border-gray-700 rounded h-8 pl-6 text-xs text-white uppercase font-mono focus:border-blue-500 outline-none"/>
                    </div>
                    <div className="relative w-8 h-8 rounded border border-gray-600 overflow-hidden shrink-0 cursor-pointer group">
                      <input type="color" value={bubble.color} onChange={(e) => updateBubble(bubble.id, { color: e.target.value })} className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer"/>
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/10 group-hover:bg-transparent"><Palette size={14} className="text-white drop-shadow-md"/></div>
                    </div>
                    <button onClick={handleTextColorEyedropper} className="w-8 h-8 flex items-center justify-center bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 hover:text-white text-gray-400 transition-colors" title="吸取文字颜色 (Pick Text Color)"><Pipette size={14}/></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['#000000', '#ffffff', '#dc2626', '#3b82f6', '#10b981', '#f59e0b'].map(c => (
                      <button key={c} onClick={() => updateBubble(bubble.id, { color: c })} className={`w-6 h-6 rounded border transition-all ${bubble.color.toLowerCase() === c ? 'border-blue-500 ring-1 ring-blue-500/50 scale-110' : 'border-gray-600 hover:scale-105'}`} style={{ backgroundColor: c }} title={c}/>
                    ))}
                  </div>
                </div>
              </div>
              {/* Stroke Color */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <label className="text-[10px] text-gray-500 font-bold uppercase block">描边颜色 (Stroke Color)</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"><Hash size={12}/></div>
                      <input type="text" value={(bubble.strokeColor || '#ffffff').replace('#', '')} onChange={(e) => updateBubble(bubble.id, { strokeColor: `#${e.target.value}` })} placeholder="FFFFFF" className="w-full bg-gray-800 border border-gray-700 rounded h-8 pl-6 text-xs text-white uppercase font-mono focus:border-blue-500 outline-none"/>
                    </div>
                    <div className="relative w-8 h-8 rounded border border-gray-600 overflow-hidden shrink-0 cursor-pointer group">
                      <input type="color" value={bubble.strokeColor || '#ffffff'} onChange={(e) => updateBubble(bubble.id, { strokeColor: e.target.value })} className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer"/>
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/10 group-hover:bg-transparent"><Palette size={14} className="text-white drop-shadow-md"/></div>
                    </div>
                    <button onClick={handleStrokeColorEyedropper} className="w-8 h-8 flex items-center justify-center bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 hover:text-white text-gray-400 transition-colors" title="吸取描边颜色 (Pick Stroke Color)"><Pipette size={14}/></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => updateBubble(bubble.id, { strokeColor: 'transparent' })} className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${(bubble.strokeColor || '#ffffff') === 'transparent' ? 'border-red-500 ring-1 ring-red-500/50' : 'border-gray-700 hover:border-gray-500'}`} title="无描边 (No Stroke)"><Ban size={12} className="text-red-400"/></button>
                    {['#ffffff', '#000000', '#dc2626', '#3b82f6', '#10b981', '#f59e0b'].map(c => (
                      <button key={c} onClick={() => updateBubble(bubble.id, { strokeColor: c })} className={`w-6 h-6 rounded border transition-all ${(bubble.strokeColor || '#ffffff').toLowerCase() === c ? 'border-blue-500 ring-1 ring-blue-500/50 scale-110' : 'border-gray-600 hover:scale-105'}`} style={{ backgroundColor: c }} title={c}/>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* ===== Section 3: Layout ===== */}
        <div className="border-t border-gray-800 pt-1">
          <SectionHeader
            icon={<Type size={14}/>}
            title={t('layout', lang)}
            isOpen={openSections.has('layout')}
            onToggle={() => toggleSection('layout')}
            summary={<>
              {bubble.isVertical ? <AlignVerticalJustifyCenter size={12}/> : <AlignHorizontalJustifyCenter size={12}/>}
              <span>{bubble.fontSize.toFixed(1)}</span>
              {bubble.rotation !== 0 && <span>{bubble.rotation}°</span>}
            </>}
          />
          {openSections.has('layout') && (
            <div className="px-3 pb-3 space-y-4 animate-fade-in-down">
              {/* Direction */}
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 block mb-1">{t('direction', lang)}</span>
                <div className="flex bg-gray-800 rounded p-1 border border-gray-700">
                  <button onClick={() => updateBubble(bubble.id, { isVertical: false })} className={`flex-1 flex justify-center py-1.5 rounded transition-all ${!bubble.isVertical ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`} title={t('horizontal', lang)}><AlignHorizontalJustifyCenter size={16}/></button>
                  <button onClick={() => updateBubble(bubble.id, { isVertical: true })} className={`flex-1 flex justify-center py-1.5 rounded transition-all ${bubble.isVertical ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`} title={t('vertical', lang)}><AlignVerticalJustifyCenter size={16}/></button>
                </div>
              </div>
              {/* Font Size */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>{t('size', lang)}</span><span>{bubble.fontSize.toFixed(1)}</span></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateBubble(bubble.id, { fontSize: parseFloat(Math.max(0.5, bubble.fontSize - 0.1).toFixed(1)) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Minus size={12}/></button>
                  <input type="range" min="0.5" max="10" step="0.1" value={bubble.fontSize} onChange={(e) => updateBubble(bubble.id, { fontSize: parseFloat(e.target.value) })} className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
                  <button onClick={() => updateBubble(bubble.id, { fontSize: parseFloat(Math.min(10, bubble.fontSize + 0.1).toFixed(1)) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Plus size={12}/></button>
                </div>
              </div>
              {/* Rotation */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span className="flex items-center gap-1"><RotateCw size={10}/> {t('rotation', lang)}</span>
                  <span>{bubble.rotation}°</span>
                </div>
                <input type="range" min="-45" max="45" step="1" value={bubble.rotation} onChange={(e) => updateBubble(bubble.id, { rotation: parseInt(e.target.value) })} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"/>
              </div>
            </div>
          )}
        </div>

        {/* ===== Section 4: Font ===== */}
        <div className="border-t border-gray-800 pt-1">
          <SectionHeader
            icon={<Type size={14}/>}
            title={t('fontFamily', lang)}
            isOpen={openSections.has('font')}
            onToggle={() => toggleSection('font')}
            summary={<span className="truncate">{currentFontName}</span>}
          />
          {openSections.has('font') && (
            <div className="px-3 pb-3 space-y-2 animate-fade-in-down">
              <div className="grid grid-cols-1 gap-2">
                {FONTS.map(font => (
                  <button key={font.id} onClick={() => updateBubble(bubble.id, { fontFamily: font.id })}
                    className={`text-left px-3 py-3 rounded border transition-all flex justify-between items-center ${bubble.fontFamily === font.id ? 'border-blue-500 bg-blue-900/20 text-white' : 'border-gray-700 bg-gray-800/50 hover:bg-gray-700 text-gray-400'}`}>
                    <span className="text-xs opacity-70 font-sans">{font.name.split('(')[0]}</span>
                    <span className={`text-lg leading-none font-${font.id}`}>{font.preview}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
