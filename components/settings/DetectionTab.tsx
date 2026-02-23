import React from 'react';
import { Eye, Scan, ScanText, Magnet, MoveHorizontal } from 'lucide-react';
import { t } from '../../services/i18n';
import { TabProps } from './types';

export const DetectionTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  return (
    <div className="space-y-8 animate-fade-in-right">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">{t('detectionTab', lang)}</h3>
        <p className="text-sm text-gray-500">{t('detectionTabDesc', lang)}</p>
      </div>

      <div className="grid gap-4">
        {/* Masked Image Mode */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-pink-500/30 rounded-xl transition-colors group">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-pink-500/10 rounded text-pink-400"><Eye size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('enableMaskedImageMode', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{t('enableMaskedImageModeHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.enableMaskedImageMode || false}
                onChange={(e) => setConfig({...config, enableMaskedImageMode: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-pink-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
            </label>
          </div>
        </div>

        {/* Use Masks As Hints */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-red-500/30 rounded-xl transition-colors group flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-red-500/10 rounded text-red-400"><Scan size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('useMasksAsHints', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{t('useMasksAsHintsHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.useMasksAsHints || false}
                onChange={(e) => setConfig({...config, useMasksAsHints: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          {config.useMasksAsHints && (
            <div className="pl-11 pt-2 border-t border-gray-700/50 animate-fade-in-down space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h5 className="text-xs font-medium text-gray-300">{t('drawMasksOnImage', lang)}</h5>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t('drawMasksOnImageHint', lang)}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.drawMasksOnImage || false}
                    onChange={(e) => setConfig({...config, drawMasksOnImage: e.target.checked})}
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <h5 className="text-xs font-medium text-gray-300">{t('appendMasksToManualJson', lang)}</h5>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t('appendMasksToManualJsonHint', lang)}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.appendMasksToManualJson || false}
                    onChange={(e) => setConfig({...config, appendMasksToManualJson: e.target.checked})}
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Local Text Detection */}
        <div className={`p-4 rounded-xl border transition-colors ${config.useTextDetectionApi ? 'bg-orange-900/10 border-orange-500/30' : 'bg-gray-800/30 border-gray-800 hover:border-orange-500/30'}`}>
          <div className="flex justify-between items-start mb-3">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-orange-500/10 rounded text-orange-400"><ScanText size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1 flex items-center gap-2">{t('textDetection', lang)} <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">Beta</span></h4>
                <p className="text-xs text-gray-500">Requires local Python service.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.useTextDetectionApi}
                onChange={(e) => setConfig({...config, useTextDetectionApi: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {config.useTextDetectionApi && (
            <div className="animate-fade-in-down pl-11 space-y-4">
              <div>
                <input
                  type="text"
                  value={config.textDetectionApiUrl}
                  onChange={(e) => setConfig({ ...config, textDetectionApiUrl: e.target.value })}
                  placeholder="http://localhost:5000"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs text-white focus:border-orange-500 outline-none placeholder-gray-600 font-mono"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Target endpoint. The app will POST to <code>/detect</code>.
                </p>
              </div>

              <div className="pt-2 border-t border-gray-700/50">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1">
                    <MoveHorizontal size={12} className="text-orange-400" /> {t('detectionExpansion', lang)}
                  </label>
                  <span className="text-xs font-mono text-orange-300 bg-gray-900 px-2 py-0.5 rounded border border-gray-700">
                    {((config.detectionExpansionRatio || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.2"
                  max="0.5"
                  step="0.05"
                  value={config.detectionExpansionRatio || 0}
                  onChange={(e) => setConfig({...config, detectionExpansionRatio: parseFloat(e.target.value)})}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">{t('detectionExpansionHint', lang)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Dialog Snapping */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-yellow-500/30 rounded-xl transition-colors group flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-yellow-500/10 rounded text-yellow-400"><Magnet size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('enableDialogSnap', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed">{t('enableDialogSnapHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.enableDialogSnap !== false}
                onChange={(e) => setConfig({...config, enableDialogSnap: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
            </label>
          </div>

          {config.enableDialogSnap !== false && (
            <div className="pl-11 pt-2 border-t border-gray-700/50 animate-fade-in-down">
              <div className="flex justify-between items-center">
                <div>
                  <h5 className="text-xs font-medium text-gray-300">{t('forceSnapSize', lang)}</h5>
                  <p className="text-[10px] text-gray-500 mt-0.5">{t('forceSnapSizeHint', lang)}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.forceSnapSize || false}
                    onChange={(e) => setConfig({...config, forceSnapSize: e.target.checked})}
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-600"></div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
