import React from 'react';
import { Globe } from 'lucide-react';
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
      </div>
    </div>
  );
};
