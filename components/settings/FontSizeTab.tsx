import React from 'react';
import { ALargeSmall, RotateCcw, Plus, X } from 'lucide-react';
import { t } from '../../services/i18n';
import { DEFAULT_FONT_SIZE_DIRECT_PROMPT, DEFAULT_FONT_SIZE_SCALE_PROMPT } from '../../services/geminiService';
import { TabProps } from './types';

const DEFAULT_SCALE_ENTRIES = [
  { label: 'tiny', value: 0.5 },
  { label: 'small', value: 0.7 },
  { label: 'normal', value: 1.0 },
  { label: 'large', value: 1.3 },
  { label: 'huge', value: 1.8 },
  { label: 'extreme', value: 2.5 },
];

export const FontSizeTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  const enabled = config.allowAiFontSize !== false;
  const mode = config.fontSizeMode || 'scale';
  const entries = config.fontScaleEntries || DEFAULT_SCALE_ENTRIES;

  return (
    <div className="space-y-8 animate-fade-in-right">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">{t('fontSizeTab', lang)}</h3>
        <p className="text-sm text-gray-500">{t('fontSizeTabDesc', lang)}</p>
      </div>

      <div className="grid gap-4">
        {/* Master Toggle */}
        <div className={`p-4 rounded-xl border transition-colors ${enabled ? 'bg-rose-900/10 border-rose-500/30' : 'bg-gray-800/30 border-gray-800 hover:border-rose-500/30'}`}>
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-rose-500/10 rounded text-rose-400"><ALargeSmall size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('allowAiFontSize', lang)}</h4>
                <p className="text-xs text-gray-500">{t('allowAiFontSizeHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={enabled}
                onChange={(e) => setConfig({...config, allowAiFontSize: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-rose-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {enabled && (
            <div className="mt-4 pt-4 border-t border-gray-700/50 animate-fade-in-down space-y-4">
              {/* Mode Selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfig({...config, fontSizeMode: 'scale'})}
                  className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
                    mode === 'scale'
                    ? 'bg-rose-600/20 border-rose-500/50 text-rose-300 ring-1 ring-rose-500/20'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  {t('fontSizeScaleMode', lang)}
                </button>
                <button
                  onClick={() => setConfig({...config, fontSizeMode: 'direct'})}
                  className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                    mode === 'direct'
                    ? 'bg-rose-600/20 border-rose-500/50 text-rose-300 ring-1 ring-rose-500/20'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  {t('fontSizeDirectMode', lang)}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">Beta</span>
                </button>
              </div>

              {/* Scale Mode Panel */}
              {mode === 'scale' && (
                <div className="space-y-3 animate-fade-in-down">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('fontSizeScaleEntries', lang)}</label>
                    <button
                      onClick={() => setConfig({...config, fontScaleEntries: DEFAULT_SCALE_ENTRIES})}
                      className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors"
                    >
                      <RotateCcw size={12}/> Reset
                    </button>
                  </div>
                  {entries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={entry.label}
                        onChange={(e) => {
                          const next = [...entries];
                          next[i] = { ...next[i], label: e.target.value };
                          setConfig({...config, fontScaleEntries: next});
                        }}
                        className="w-24 shrink-0 bg-gray-900/50 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 outline-none"
                        placeholder="label"
                      />
                      <input
                        type="range"
                        min="0.3" max="5.0" step="0.05"
                        value={entry.value}
                        onChange={(e) => {
                          const next = [...entries];
                          next[i] = { ...next[i], value: parseFloat(e.target.value) };
                          setConfig({...config, fontScaleEntries: next});
                        }}
                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                      />
                      <span className="text-xs font-mono bg-gray-900 px-2 py-1 rounded-md text-rose-300 border border-gray-700 w-16 text-center">
                        {entry.value.toFixed(2)}
                      </span>
                      {entries.length > 1 && (
                        <button
                          onClick={() => {
                            const next = entries.filter((_, j) => j !== i);
                            setConfig({...config, fontScaleEntries: next});
                          }}
                          className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <X size={14}/>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const last = entries[entries.length - 1];
                      const next = [...entries, { label: '', value: Math.min(5.0, (last?.value ?? 1.0) + 0.5) }];
                      setConfig({...config, fontScaleEntries: next});
                    }}
                    className="w-full py-2 border border-dashed border-gray-700 rounded-lg text-xs text-gray-500 hover:text-rose-400 hover:border-rose-500/50 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus size={14}/> {t('fontSizeAddScale', lang)}
                  </button>
                  {/* Scale Mode Prompt */}
                  <div className="pt-3 border-t border-gray-700/50 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('fontSizeScalePrompt', lang)}</label>
                      <button
                        onClick={() => setConfig({...config, fontSizeScalePrompt: DEFAULT_FONT_SIZE_SCALE_PROMPT})}
                        className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors"
                      >
                        <RotateCcw size={12}/> Reset
                      </button>
                    </div>
                    <textarea
                      value={config.fontSizeScalePrompt || DEFAULT_FONT_SIZE_SCALE_PROMPT}
                      onChange={(e) => setConfig({...config, fontSizeScalePrompt: e.target.value})}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 outline-none font-mono leading-relaxed resize-y min-h-[120px]"
                      spellCheck={false}
                    />
                    <p className="text-[10px] text-gray-500">{t('fontSizeScalePromptHint', lang)}</p>
                  </div>
                </div>
              )}

              {/* Direct Mode Panel */}
              {mode === 'direct' && (
                <div className="space-y-2 animate-fade-in-down">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('fontSizeDirectPrompt', lang)}</label>
                    <button
                      onClick={() => setConfig({...config, fontSizePrompt: DEFAULT_FONT_SIZE_DIRECT_PROMPT})}
                      className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors"
                    >
                      <RotateCcw size={12}/> Reset
                    </button>
                  </div>
                  <textarea
                    value={config.fontSizePrompt || DEFAULT_FONT_SIZE_DIRECT_PROMPT}
                    onChange={(e) => setConfig({...config, fontSizePrompt: e.target.value})}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 outline-none font-mono leading-relaxed resize-y min-h-[180px]"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-gray-500">{t('fontSizeDirectPromptHint', lang)}</p>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Fallback Font Size */}
        <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-800 space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <ALargeSmall size={16} className="text-gray-500" /> {t('fontSizeFallback', lang)}
            </label>
            <span className="text-xs font-mono bg-gray-900 px-2 py-1 rounded-md text-gray-400 border border-gray-700">
              {config.defaultFontSize.toFixed(2)}rem
            </span>
          </div>
          <input
            type="range"
            min="0.5" max="5.0" step="0.05"
            value={config.defaultFontSize}
            onChange={(e) => setConfig({...config, defaultFontSize: parseFloat(e.target.value)})}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-500 hover:accent-gray-400"
          />
          <p className="text-[10px] text-gray-500">{t('fontSizeFallbackHint', lang)}</p>
        </div>
      </div>
    </div>
  );
};
