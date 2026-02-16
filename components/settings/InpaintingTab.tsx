import React from 'react';
import { Eraser } from 'lucide-react';
import { t } from '../../services/i18n';
import { TabProps } from './types';

export const InpaintingTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  return (
    <div className="space-y-8 animate-fade-in-right">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">{t('inpaintingTab', lang)}</h3>
        <p className="text-sm text-gray-500">{t('inpaintingTabDesc', lang)}</p>
      </div>

      <div className={`p-4 rounded-xl border transition-colors ${config.enableInpainting ? 'bg-cyan-900/10 border-cyan-500/30' : 'bg-gray-800/30 border-gray-800 hover:border-cyan-500/30'}`}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-3">
            <div className="mt-1 p-1.5 bg-cyan-500/10 rounded text-cyan-400"><Eraser size={18}/></div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">{t('enableInpainting', lang)}</h4>
              <p className="text-xs text-gray-500">{t('enableInpaintingHint', lang)}</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={config.enableInpainting}
              onChange={(e) => setConfig({...config, enableInpainting: e.target.checked})}
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
          </label>
        </div>

        {config.enableInpainting && (
          <div className="animate-fade-in-down pl-11 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">{t('inpaintingUrl', lang)}</label>
              <input
                type="text"
                value={config.inpaintingUrl}
                onChange={(e) => setConfig({ ...config, inpaintingUrl: e.target.value })}
                placeholder="http://localhost:8080"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs text-white focus:border-cyan-500 outline-none placeholder-gray-600 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">{t('inpaintingModel', lang)}</label>
              <input
                type="text"
                value={config.inpaintingModel || 'lama'}
                onChange={(e) => setConfig({ ...config, inpaintingModel: e.target.value })}
                placeholder="lama"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs text-white focus:border-cyan-500 outline-none placeholder-gray-600 font-mono"
              />
              <p className="text-[10px] text-gray-500">{t('inpaintingModelHint', lang)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
