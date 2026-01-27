import React, { useState } from 'react';
import { Bubble, FONTS, AIConfig } from '../types';
import { Trash2, Type, AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter, Sparkles, RotateCw, Maximize2, Palette, Minus, Plus } from 'lucide-react';
import { polishDialogue } from '../services/geminiService';
import { t } from '../services/i18n';

interface BubbleEditorProps {
  bubble: Bubble;
  config: AIConfig;
  onUpdate: (id: string, updates: Partial<Bubble>) => void;
  onDelete: (id: string) => void;
}

export const BubbleEditor: React.FC<BubbleEditorProps> = ({ bubble, config, onUpdate, onDelete }) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const lang = config.language || 'zh';

  const handleAiPolish = async (style: 'dramatic' | 'casual' | 'english') => {
    if (!bubble.text.trim()) return;
    setIsAiLoading(true);
    try {
      const newText = await polishDialogue(bubble.text, style, config);
      onUpdate(bubble.id, { text: newText });
    } catch (e) {
      console.error("AI Request Failed", e);
      // Suppressed alert as requested
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center shrink-0 bg-gray-900">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
           {t('properties', lang)}
        </h3>
        <button 
          onClick={() => onDelete(bubble.id)}
          className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-900/30 transition-colors"
          title={t('deleteBubble', lang)}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Text Input */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('content', lang)}</label>
          <textarea
            value={bubble.text}
            onChange={(e) => onUpdate(bubble.id, { text: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-sm focus:border-blue-500 outline-none resize-none font-sans transition-colors"
            rows={5}
            placeholder={t('enterText', lang)}
          />
        </div>

        {/* AI Tools */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1">
            <Sparkles size={12} className="text-purple-400" /> {t('aiAssistant', lang)}
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button 
              disabled={isAiLoading}
              onClick={() => handleAiPolish('dramatic')}
              className="px-2 py-2 bg-purple-900/20 border border-purple-800/50 hover:bg-purple-800/40 text-xs rounded text-purple-200 transition-colors"
            >
              {t('dramatic', lang)}
            </button>
            <button 
               disabled={isAiLoading}
              onClick={() => handleAiPolish('casual')}
              className="px-2 py-2 bg-blue-900/20 border border-blue-800/50 hover:bg-blue-800/40 text-xs rounded text-blue-200 transition-colors"
            >
              {t('casual', lang)}
            </button>
            <button 
               disabled={isAiLoading}
              onClick={() => handleAiPolish('english')}
              className="px-2 py-2 bg-green-900/20 border border-green-800/50 hover:bg-green-800/40 text-xs rounded text-green-200 transition-colors"
            >
              {t('translate', lang)}
            </button>
          </div>
          {isAiLoading && <div className="text-xs text-center text-gray-500 animate-pulse mt-1">{t('aiThinking', lang)}</div>}
        </div>

        <div className="h-px bg-gray-800"></div>

        {/* Mask Dimensions */}
        <div className="space-y-3">
           <label className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1">
             <Maximize2 size={12}/> {t('maskGeometry', lang)}
           </label>
           
           <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>{t('width', lang)}</span>
                  <span>{bubble.width.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onUpdate(bubble.id, { width: Math.max(5, bubble.width - 0.5) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Minus size={12}/></button>
                    <input
                    type="range"
                    min="5"
                    max="50"
                    step="0.5"
                    value={bubble.width}
                    onChange={(e) => onUpdate(bubble.id, { width: parseFloat(e.target.value) })}
                    className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <button onClick={() => onUpdate(bubble.id, { width: Math.min(50, bubble.width + 0.5) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Plus size={12}/></button>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>{t('height', lang)}</span>
                  <span>{bubble.height.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onUpdate(bubble.id, { height: Math.max(5, bubble.height - 0.5) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Minus size={12}/></button>
                    <input
                    type="range"
                    min="5"
                    max="50"
                    step="0.5"
                    value={bubble.height}
                    onChange={(e) => onUpdate(bubble.id, { height: parseFloat(e.target.value) })}
                    className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <button onClick={() => onUpdate(bubble.id, { height: Math.min(50, bubble.height + 0.5) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Plus size={12}/></button>
                </div>
              </div>
           </div>
        </div>
        
        {/* Background Toggle */}
        <div className="flex items-center justify-between bg-gray-800/50 p-2 rounded border border-gray-700/50">
            <label className="text-xs text-gray-400 flex items-center gap-2">
              <Palette size={14}/> {t('whiteBg', lang)}
            </label>
            <button
              onClick={() => onUpdate(bubble.id, { backgroundColor: bubble.backgroundColor === 'transparent' ? '#ffffff' : 'transparent' })}
              className={`w-10 h-5 rounded-full relative transition-colors ${bubble.backgroundColor !== 'transparent' ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${bubble.backgroundColor !== 'transparent' ? 'left-6' : 'left-1'}`}></div>
            </button>
        </div>

        <div className="h-px bg-gray-800"></div>

        {/* Typography */}
        <div className="space-y-4">
           <label className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1">
             <Type size={12}/> {t('typography', lang)}
           </label>

          {/* Controls stacked vertically */}
          <div className="space-y-4">
            
            {/* Direction */}
            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 block mb-1">{t('direction', lang)}</span>
              <div className="flex bg-gray-800 rounded p-1 border border-gray-700">
                <button
                  onClick={() => onUpdate(bubble.id, { isVertical: false })}
                  className={`flex-1 flex justify-center py-1.5 rounded transition-all ${!bubble.isVertical ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                  title={t('horizontal', lang)}
                >
                  <AlignHorizontalJustifyCenter size={16} />
                </button>
                <button
                  onClick={() => onUpdate(bubble.id, { isVertical: true })}
                  className={`flex-1 flex justify-center py-1.5 rounded transition-all ${bubble.isVertical ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                  title={t('vertical', lang)}
                >
                  <AlignVerticalJustifyCenter size={16} />
                </button>
              </div>
            </div>

            {/* Font Size */}
            <div className="space-y-1">
               <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>{t('size', lang)}</span>
                  <span>{bubble.fontSize.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onUpdate(bubble.id, { fontSize: parseFloat(Math.max(0.5, bubble.fontSize - 0.1).toFixed(1)) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Minus size={12}/></button>
                    <input
                        type="range"
                        min="0.5"
                        max="10" 
                        step="0.1"
                        value={bubble.fontSize}
                        onChange={(e) => onUpdate(bubble.id, { fontSize: parseFloat(e.target.value) })}
                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <button onClick={() => onUpdate(bubble.id, { fontSize: parseFloat(Math.min(10, bubble.fontSize + 0.1).toFixed(1)) })} className="p-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-400 hover:text-white"><Plus size={12}/></button>
                </div>
            </div>

            {/* Rotation */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span className="flex items-center gap-1"><RotateCw size={10}/> {t('rotation', lang)}</span>
                  <span>{bubble.rotation}°</span>
              </div>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={bubble.rotation}
                onChange={(e) => onUpdate(bubble.id, { rotation: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Font Selection */}
        <div className="space-y-2">
          <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('fontFamily', lang)}</label>
          <div className="grid grid-cols-1 gap-2">
            {FONTS.map(font => (
              <button
                key={font.id}
                onClick={() => onUpdate(bubble.id, { fontFamily: font.id })}
                className={`text-left px-3 py-3 rounded border transition-all flex justify-between items-center ${bubble.fontFamily === font.id ? 'border-blue-500 bg-blue-900/20 text-white' : 'border-gray-700 bg-gray-800/50 hover:bg-gray-700 text-gray-400'}`}
              >
                <span className="text-xs opacity-70 font-sans">{font.name.split('(')[0]}</span>
                <span className={`text-lg leading-none ${
                  font.id === 'zhimang' ? 'font-zhimang' : 
                  font.id === 'mashan' ? 'font-mashan' : 'font-noto'
                }`}>
                  {font.preview}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
