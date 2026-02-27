import React from 'react';
import { Square, Circle, Box, RotateCcw } from 'lucide-react';
import { t } from '../../services/i18n';
import { TabProps } from './types';
import { FONTS } from '../../types';

const COLOR_PRESETS = ['#000000', '#ffffff', '#dc2626', '#3b82f6', '#10b981', '#f59e0b'];

export const StyleTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  const handleResetStyleDefaults = () => {
    if (!confirm(t('resetStyleDefaultsConfirm', lang))) return;
    setConfig({
      ...config,
      defaultMaskShape: 'rectangle',
      defaultMaskCornerRadius: 20,
      defaultMaskFeather: 0,
      defaultFontFamily: 'noto',
      defaultTextColor: '#000000',
      defaultStrokeColor: '#ffffff',
      defaultBackgroundColor: '#ffffff',
      defaultLetterSpacing: 0.15,
      defaultLineHeight: 1.1,
      defaultIsVertical: true,
    });
  };

  return (
    <div className="space-y-8 animate-fade-in-right">
      {/* ===== Mask Style Section (existing) ===== */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">{t('maskStyle', lang)}</h3>
      </div>

      <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-800 space-y-6">
        {/* Shape Selection */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('shape', lang)}</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'rectangle', label: t('shapeRect', lang), icon: Square },
              { id: 'rounded', label: t('shapeRound', lang), icon: Box },
              { id: 'ellipse', label: t('shapeEllipse', lang), icon: Circle },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setConfig({ ...config, defaultMaskShape: opt.id as any })}
                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                  config.defaultMaskShape === opt.id
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-1 ring-blue-500/30'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-500'
                }`}
              >
                <opt.icon size={20} className={config.defaultMaskShape === opt.id ? "fill-current opacity-20" : ""} />
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Corner Radius Slider */}
        {config.defaultMaskShape === 'rounded' && (
          <div className="space-y-2 animate-fade-in-down">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('cornerRadius', lang)}</label>
              <span className="text-xs font-mono text-gray-300 bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{config.defaultMaskCornerRadius}%</span>
            </div>
            <input type="range" min="0" max="50" step="1" value={config.defaultMaskCornerRadius}
              onChange={(e) => setConfig({ ...config, defaultMaskCornerRadius: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
          </div>
        )}

        {/* Feathering Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('feathering', lang)}</label>
            <span className="text-xs font-mono text-gray-300 bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{config.defaultMaskFeather}</span>
          </div>
          <input type="range" min="0" max="50" step="1" value={config.defaultMaskFeather}
            onChange={(e) => setConfig({ ...config, defaultMaskFeather: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
        </div>
      </div>

      {/* ===== Text Style Defaults Section ===== */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">{t('textStyleDefaults', lang)}</h3>
        <p className="text-sm text-gray-500">{t('textStyleDefaultsDesc', lang)}</p>
      </div>

      <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-800 space-y-6">
        {/* Font Family */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('defaultFont', lang)}</label>
          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
            {FONTS.map(font => (
              <button key={font.id} onClick={() => setConfig({ ...config, defaultFontFamily: font.id })}
                className={`text-left px-3 py-2.5 rounded border transition-all flex justify-between items-center ${
                  (config.defaultFontFamily || 'noto') === font.id
                  ? 'border-blue-500 bg-blue-900/20 text-white'
                  : 'border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-400'
                }`}>
                <span className="text-xs opacity-70 font-sans">{font.name}</span>
                <span className="text-base leading-none" style={{ fontFamily: font.cssStack }}>{font.preview}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Direction Toggle */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('defaultDirection', lang)}</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: true, label: t('vertical', lang) },
              { id: false, label: t('horizontal', lang) },
            ].map((opt) => (
              <button key={String(opt.id)}
                onClick={() => setConfig({ ...config, defaultIsVertical: opt.id })}
                className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
                  (config.defaultIsVertical ?? true) === opt.id
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/20'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Letter Spacing */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('defaultLetterSpacing', lang)}</label>
            <span className="text-xs font-mono text-gray-300 bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{(config.defaultLetterSpacing ?? 0.15).toFixed(2)}em</span>
          </div>
          <input type="range" min="-0.1" max="0.5" step="0.01" value={config.defaultLetterSpacing ?? 0.15}
            onChange={(e) => setConfig({ ...config, defaultLetterSpacing: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
        </div>
        {/* Line Height */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('defaultLineHeight', lang)}</label>
            <span className="text-xs font-mono text-gray-300 bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{(config.defaultLineHeight ?? 1.1).toFixed(1)}</span>
          </div>
          <input type="range" min="0.8" max="3" step="0.1" value={config.defaultLineHeight ?? 1.1}
            onChange={(e) => setConfig({ ...config, defaultLineHeight: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
        </div>

        {/* Text Color */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('defaultTextColor', lang)}</label>
          <div className="flex gap-2 items-center">
            <div className="relative w-8 h-8 rounded border border-gray-600 overflow-hidden shrink-0 cursor-pointer">
              <input type="color" value={config.defaultTextColor || '#000000'}
                onChange={(e) => setConfig({ ...config, defaultTextColor: e.target.value })}
                className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer" />
            </div>
            <input type="text" value={(config.defaultTextColor || '#000000').replace('#', '')}
              onChange={(e) => setConfig({ ...config, defaultTextColor: `#${e.target.value}` })}
              placeholder="000000"
              className="flex-1 bg-gray-900 border border-gray-700 rounded h-8 px-2 text-xs text-white uppercase font-mono focus:border-blue-500 outline-none" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => setConfig({ ...config, defaultTextColor: c })}
                className={`w-6 h-6 rounded border transition-all ${(config.defaultTextColor || '#000000').toLowerCase() === c ? 'border-blue-500 ring-1 ring-blue-500/50 scale-110' : 'border-gray-600 hover:scale-105'}`}
                style={{ backgroundColor: c }} title={c} />
            ))}
          </div>
        </div>

        {/* Stroke Color */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('defaultStrokeColor', lang)}</label>
          <div className="flex gap-2 items-center">
            <div className="relative w-8 h-8 rounded border border-gray-600 overflow-hidden shrink-0 cursor-pointer">
              <input type="color" value={config.defaultStrokeColor || '#ffffff'}
                onChange={(e) => setConfig({ ...config, defaultStrokeColor: e.target.value })}
                className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer" />
            </div>
            <input type="text" value={(config.defaultStrokeColor || '#ffffff').replace('#', '')}
              onChange={(e) => setConfig({ ...config, defaultStrokeColor: `#${e.target.value}` })}
              placeholder="ffffff"
              className="flex-1 bg-gray-900 border border-gray-700 rounded h-8 px-2 text-xs text-white uppercase font-mono focus:border-blue-500 outline-none" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...COLOR_PRESETS, 'transparent'].map(c => (
              <button key={c} onClick={() => setConfig({ ...config, defaultStrokeColor: c })}
                className={`w-6 h-6 rounded border transition-all ${(config.defaultStrokeColor || '#ffffff').toLowerCase() === c ? 'border-blue-500 ring-1 ring-blue-500/50 scale-110' : 'border-gray-600 hover:scale-105'}`}
                style={{ backgroundColor: c === 'transparent' ? undefined : c, backgroundImage: c === 'transparent' ? 'linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%)' : undefined, backgroundSize: c === 'transparent' ? '6px 6px' : undefined, backgroundPosition: c === 'transparent' ? '0 0, 3px 3px' : undefined }}
                title={c} />
            ))}
          </div>
        </div>
        {/* Background Color */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('defaultBgColor', lang)}</label>
          <div className="flex gap-2 items-center">
            <div className="relative w-8 h-8 rounded border border-gray-600 overflow-hidden shrink-0 cursor-pointer">
              <input type="color" value={config.defaultBackgroundColor || '#ffffff'}
                onChange={(e) => setConfig({ ...config, defaultBackgroundColor: e.target.value })}
                className="absolute -top-2 -left-2 w-16 h-16 p-0 border-0 cursor-pointer" />
            </div>
            <input type="text" value={(config.defaultBackgroundColor || '#ffffff').replace('#', '')}
              onChange={(e) => setConfig({ ...config, defaultBackgroundColor: `#${e.target.value}` })}
              placeholder="ffffff"
              className="flex-1 bg-gray-900 border border-gray-700 rounded h-8 px-2 text-xs text-white uppercase font-mono focus:border-blue-500 outline-none" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => setConfig({ ...config, defaultBackgroundColor: c })}
                className={`w-6 h-6 rounded border transition-all ${(config.defaultBackgroundColor || '#ffffff').toLowerCase() === c ? 'border-blue-500 ring-1 ring-blue-500/50 scale-110' : 'border-gray-600 hover:scale-105'}`}
                style={{ backgroundColor: c }} title={c} />
            ))}
          </div>
        </div>
      </div>

      {/* Reset Style Defaults Button */}
      <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-800">
        <button onClick={handleResetStyleDefaults}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg text-sm font-medium border bg-gray-900 border-gray-700 text-gray-400 hover:border-amber-500/50 hover:text-amber-300 hover:bg-amber-600/10 transition-all">
          <RotateCcw size={16} /> {t('resetStyleDefaults', lang)}
        </button>
      </div>
    </div>
  );
};
