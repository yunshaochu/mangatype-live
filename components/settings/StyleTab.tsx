import React from 'react';
import { Square, Circle, Box } from 'lucide-react';
import { t } from '../../services/i18n';
import { TabProps } from './types';

export const StyleTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  return (
    <div className="space-y-8 animate-fade-in-right">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">{t('maskStyle', lang)}</h3>
        <p className="text-sm text-gray-500">Set default visual appearance for all speech bubbles.</p>
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
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={config.defaultMaskCornerRadius}
              onChange={(e) => setConfig({ ...config, defaultMaskCornerRadius: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        )}

        {/* Feathering Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('feathering', lang)}</label>
            <span className="text-xs font-mono text-gray-300 bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{config.defaultMaskFeather}</span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={config.defaultMaskFeather}
            onChange={(e) => setConfig({ ...config, defaultMaskFeather: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <p className="text-[10px] text-gray-500">Controls the blur amount of the mask edges.</p>
        </div>
      </div>
    </div>
  );
};
