import React, { useState } from 'react';
import { Pipette, RotateCw, PenTool, RotateCcw, Palette, Camera, Loader2, CheckCircle, Download } from 'lucide-react';
import { t } from '../../services/i18n';
import { DEFAULT_FONT_SELECTION_PROMPT, DEFAULT_COLOR_SELECTION_PROMPT } from '../../services/geminiService';
import { initScreenshotContainer, isScreenshotReady } from '../../services/exportService';
import { TabProps } from './types';

export const AdvancedTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  const isScreenshotMode = config.exportMethod === 'screenshot';
  const [fontStatus, setFontStatus] = useState<'idle' | 'loading' | 'ready'>(isScreenshotReady() ? 'ready' : 'idle');

  const handlePreloadFonts = async () => {
    if (fontStatus === 'loading' || fontStatus === 'ready') return;
    setFontStatus('loading');
    // Let the UI update before starting the blocking work
    await new Promise(r => setTimeout(r, 50));
    await initScreenshotContainer();
    setFontStatus('ready');
  };

  return (
    <div className="space-y-8 animate-fade-in-right">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">Advanced & Experimental</h3>
        <p className="text-sm text-gray-500">Power tools and beta features.</p>
      </div>

      <div className="grid gap-4">
        {/* Export Method */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-green-500/30 rounded-xl transition-colors group">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-green-500/10 rounded text-green-400"><Camera size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('exportMethod', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed">{t('exportMethodHint', lang)}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setConfig({...config, exportMethod: 'canvas'})}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                (config.exportMethod || 'canvas') === 'canvas'
                  ? 'bg-green-600 text-white shadow'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {t('exportMethodCanvas', lang)}
            </button>
            <button
              onClick={() => setConfig({...config, exportMethod: 'screenshot'})}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                config.exportMethod === 'screenshot'
                  ? 'bg-green-600 text-white shadow'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {t('exportMethodScreenshot', lang)}
            </button>
          </div>
          {isScreenshotMode && (
            <div className="mt-3">
              {fontStatus === 'ready' ? (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle size={12}/> {lang === 'zh' ? '字体已就绪，可以保存设置' : 'Fonts ready, you can save settings'}
                </div>
              ) : (
                <button
                  onClick={handlePreloadFonts}
                  disabled={fontStatus === 'loading'}
                  className={`w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    fontStatus === 'loading'
                      ? 'bg-yellow-600/20 text-yellow-400 cursor-wait'
                      : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                  }`}
                >
                  {fontStatus === 'loading'
                    ? <><Loader2 size={12} className="animate-spin"/> {lang === 'zh' ? '正在加载字体，请等待约10秒…' : 'Loading fonts, please wait ~10s…'}</>
                    : <><Download size={12}/> {lang === 'zh' ? '预加载字体（首次需要下载）' : 'Preload fonts (download required first time)'}</>
                  }
                </button>
              )}
            </div>
          )}
        </div>

        {/* Auto Detect Background */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-cyan-500/30 rounded-xl transition-colors group">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-cyan-500/10 rounded text-cyan-400"><Pipette size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('autoDetectBackground', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed">{t('autoDetectBackgroundHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.autoDetectBackground !== false}
                onChange={(e) => setConfig({...config, autoDetectBackground: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
            </label>
          </div>
        </div>

        {/* AI Rotation */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-purple-500/30 rounded-xl transition-colors group">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-purple-500/10 rounded text-purple-400"><RotateCw size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('allowAiRotation', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{t('allowAiRotationHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.allowAiRotation || false}
                onChange={(e) => setConfig({...config, allowAiRotation: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>

        {/* Allow AI Font Selection */}
        <div className={`p-4 rounded-xl border transition-colors ${config.allowAiFontSelection !== false ? 'bg-teal-900/10 border-teal-500/30' : 'bg-gray-800/30 border-gray-800 hover:border-teal-500/30'}`}>
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-teal-500/10 rounded text-teal-400"><PenTool size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('allowAiFontSelection', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{t('allowAiFontSelectionHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.allowAiFontSelection !== false}
                onChange={(e) => setConfig({...config, allowAiFontSelection: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>

          {config.allowAiFontSelection !== false && (
            <div className="mt-4 pt-4 border-t border-gray-700/50 animate-fade-in-down">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('fontSelectionPrompt', lang)}</label>
                <button
                  onClick={() => setConfig({...config, fontSelectionPrompt: DEFAULT_FONT_SELECTION_PROMPT})}
                  className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors"
                >
                  <RotateCcw size={12}/> Reset
                </button>
              </div>
              <textarea
                value={config.fontSelectionPrompt || DEFAULT_FONT_SELECTION_PROMPT}
                onChange={(e) => setConfig({...config, fontSelectionPrompt: e.target.value})}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 outline-none font-mono leading-relaxed resize-y min-h-[180px]"
                spellCheck={false}
              />
              <p className="text-[10px] text-gray-500 mt-1">{t('fontSelectionPromptHint', lang)}</p>
            </div>
          )}
        </div>

        {/* Allow AI Color Selection */}
        <div className={`p-4 rounded-xl border transition-colors ${config.allowAiColorSelection !== false ? 'bg-orange-900/10 border-orange-500/30' : 'bg-gray-800/30 border-gray-800 hover:border-orange-500/30'}`}>
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-orange-500/10 rounded text-orange-400"><Palette size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('allowAiColorSelection', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{t('allowAiColorSelectionHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.allowAiColorSelection !== false}
                onChange={(e) => setConfig({...config, allowAiColorSelection: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
          </div>

          {config.allowAiColorSelection !== false && (
            <div className="mt-4 pt-4 border-t border-gray-700/50 animate-fade-in-down">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('colorSelectionPrompt', lang)}</label>
                <button
                  onClick={() => setConfig({...config, colorSelectionPrompt: DEFAULT_COLOR_SELECTION_PROMPT})}
                  className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors"
                >
                  <RotateCcw size={12}/> Reset
                </button>
              </div>
              <textarea
                value={config.colorSelectionPrompt || DEFAULT_COLOR_SELECTION_PROMPT}
                onChange={(e) => setConfig({...config, colorSelectionPrompt: e.target.value})}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 outline-none font-mono leading-relaxed resize-y min-h-[180px]"
                spellCheck={false}
              />
              <p className="text-[10px] text-gray-500 mt-1">{t('colorSelectionPromptHint', lang)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
