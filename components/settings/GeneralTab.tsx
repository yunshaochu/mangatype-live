import React from 'react';
import { Globe, Type } from 'lucide-react';
import { t } from '../../services/i18n';
import { TabProps } from './types';

export const GeneralTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  return (
    <div className="space-y-8 animate-fade-in-right">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">General Settings</h3>
        <p className="text-sm text-gray-500">Configure language and interface preferences.</p>
      </div>

      <div className="grid gap-6">
        {/* Language */}
        <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-800 space-y-3">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Globe size={16} className="text-indigo-400"/> {t('language', lang)}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {['zh', 'en'].map((l) => (
              <button
                key={l}
                onClick={() => setConfig(prev => ({...prev, language: l as any}))}
                className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
                  config.language === l
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 ring-1 ring-indigo-500/20'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                }`}
              >
                {l === 'zh' ? '中文 (Chinese)' : 'English'}
              </button>
            ))}
          </div>
        </div>

        {/* Default Font Size */}
        <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-800 space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Type size={16} className="text-pink-400" /> {t('defaultFontSize', lang)}
            </label>
            <span className="text-xs font-mono bg-gray-900 px-2 py-1 rounded-md text-pink-300 border border-gray-700">
              {config.defaultFontSize.toFixed(2)}rem
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="5.0"
            step="0.05"
            value={config.defaultFontSize}
            onChange={(e) => setConfig({ ...config, defaultFontSize: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400"
          />
        </div>
      </div>
    </div>
  );
};
