import React from 'react';
import { Plus, Trash2, RotateCcw, Monitor, Camera } from 'lucide-react';
import { t } from '../../services/i18n';
import { TabProps } from './types';

const DEFAULT_SCREENSHOT_OFFSETS = [
  { char: '！', offset: -0.35 },
  { char: '？', offset: -0.25 },
  { char: '…', offset: 0.25 },
];

const DEFAULT_EDITOR_OFFSETS = [
  { char: '！', offset: -0.25 },
  { char: '？', offset: -0.25 },
];

const OffsetList: React.FC<{
  entries: { char: string; offset: number }[];
  onChange: (entries: { char: string; offset: number }[]) => void;
  defaults: { char: string; offset: number }[];
  color: string;
  lang: 'zh' | 'en';
}> = ({ entries, onChange, defaults, color, lang }) => (
  <div className="space-y-2">
    {entries.map((entry, idx) => (
      <div key={idx} className="flex items-center gap-2">
        <input
          type="text"
          maxLength={2}
          value={entry.char}
          onChange={(e) => {
            const updated = [...entries];
            updated[idx] = { ...entry, char: e.target.value };
            onChange(updated);
          }}
          className={`w-12 bg-gray-900/50 border border-gray-700 rounded px-2 py-1.5 text-sm text-center text-white focus:border-${color}-500 outline-none`}
          placeholder={t('punctuationChar', lang)}
        />
        <input
          type="number"
          step={0.05}
          value={entry.offset}
          onChange={(e) => {
            const updated = [...entries];
            updated[idx] = { ...entry, offset: parseFloat(e.target.value) || 0 };
            onChange(updated);
          }}
          className={`w-28 bg-gray-900/50 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:border-${color}-500 outline-none`}
        />
        <span className="text-[10px] text-gray-500 w-6">em</span>
        <button
          onClick={() => onChange(entries.filter((_, i) => i !== idx))}
          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    ))}
    {/* PLACEHOLDER_ACTIONS */}
  </div>
);

export const PunctuationTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  const editorOffsets = config.editorPunctuationOffsets ?? [];
  const screenshotOffsets = config.screenshotPunctuationOffsets ?? DEFAULT_SCREENSHOT_OFFSETS;

  return (
    <div className="space-y-8 animate-fade-in-right">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">{t('punctuationTab', lang)}</h3>
        <p className="text-sm text-gray-500">{t('punctuationTabHint', lang)}</p>
      </div>

      <div className="grid gap-6">
        {/* Editor Offsets */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-blue-500/10 rounded text-blue-400"><Monitor size={16} /></div>
            <div>
              <h4 className="text-sm font-medium text-white">{t('editorPunctuationOffset', lang)}</h4>
              <p className="text-xs text-gray-500">{t('editorPunctuationOffsetHint', lang)}</p>
            </div>
          </div>
          <OffsetList
            entries={editorOffsets}
            onChange={(v) => setConfig({ ...config, editorPunctuationOffsets: v })}
            defaults={[]}
            color="blue"
            lang={lang}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setConfig({ ...config, editorPunctuationOffsets: [...editorOffsets, { char: '', offset: 0 }] })}
              className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus size={12} /> {t('addPunctuation', lang)}
            </button>
            {editorOffsets.length > 0 && (
              <button
                onClick={() => setConfig({ ...config, editorPunctuationOffsets: [...DEFAULT_EDITOR_OFFSETS] })}
                className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors ml-auto"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Screenshot Offsets */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-green-500/10 rounded text-green-400"><Camera size={16} /></div>
            <div>
              <h4 className="text-sm font-medium text-white">{t('screenshotPunctuationOffset', lang)}</h4>
              <p className="text-xs text-gray-500">{t('screenshotPunctuationOffsetHint', lang)}</p>
            </div>
          </div>
          <OffsetList
            entries={screenshotOffsets}
            onChange={(v) => setConfig({ ...config, screenshotPunctuationOffsets: v })}
            defaults={DEFAULT_SCREENSHOT_OFFSETS}
            color="green"
            lang={lang}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setConfig({ ...config, screenshotPunctuationOffsets: [...screenshotOffsets, { char: '', offset: 0 }] })}
              className="text-xs flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors"
            >
              <Plus size={12} /> {t('addPunctuation', lang)}
            </button>
            <button
              onClick={() => setConfig({ ...config, screenshotPunctuationOffsets: [...DEFAULT_SCREENSHOT_OFFSETS] })}
              className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors ml-auto"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
