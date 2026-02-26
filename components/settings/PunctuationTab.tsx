import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw, Monitor, Camera, ChevronRight, ChevronDown } from 'lucide-react';
import { t } from '../../services/i18n';
import { TabProps } from './types';
import { PunctuationOffset } from '../../types';

const DEFAULT_SCREENSHOT_OFFSETS: PunctuationOffset[] = [
  { char: '！', offsetX: -0.35 },
  { char: '？', offsetX: -0.25 },
  { char: '…', offsetX: 0.25, scale: 0.9 },
  { char: '—', offsetX: 0, scale: 0.7 },
];

const DEFAULT_EDITOR_OFFSETS: PunctuationOffset[] = [
  { char: '！', offsetX: -0.25 },
  { char: '？', offsetX: -0.25 },
  { char: '，', offsetX: -0.25, offsetY: 0.1 },
];

const OffsetList: React.FC<{
  entries: PunctuationOffset[];
  onChange: (entries: PunctuationOffset[]) => void;
  color: string;
  lang: 'zh' | 'en';
}> = ({ entries, onChange, color, lang }) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const update = (idx: number, patch: Partial<PunctuationOffset>) => {
    const updated = [...entries];
    updated[idx] = { ...entries[idx], ...patch };
    onChange(updated);
  };

  return (
    <div className="space-y-1.5">
      {entries.map((entry, idx) => (
        <div key={idx}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggle(idx)}
              className="p-0.5 text-gray-500 hover:text-white transition-colors"
            >
              {expanded.has(idx) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <input
              type="text"
              maxLength={2}
              value={entry.char}
              onChange={(e) => update(idx, { char: e.target.value })}
              className={`w-12 bg-gray-900/50 border border-gray-700 rounded px-2 py-1.5 text-sm text-center text-white focus:border-${color}-500 outline-none`}
              placeholder={t('punctuationChar', lang)}
            />
            <input
              type="number"
              step={0.05}
              value={entry.offsetX}
              onChange={(e) => update(idx, { offsetX: parseFloat(e.target.value) || 0 })}
              className={`w-24 bg-gray-900/50 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:border-${color}-500 outline-none`}
            />
            <span className="text-[10px] text-gray-500 w-6">em</span>
            <button
              onClick={() => onChange(entries.filter((_, i) => i !== idx))}
              className="p-1 text-gray-500 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
          {expanded.has(idx) && (
            <div className="ml-7 mt-1 flex items-center gap-2 flex-wrap">
              <label className="text-[10px] text-gray-500">{t('punctuationOffsetY', lang)}</label>
              <input
                type="number" step={0.05} value={entry.offsetY ?? 0}
                onChange={(e) => update(idx, { offsetY: parseFloat(e.target.value) || 0 })}
                className={`w-20 bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-${color}-500 outline-none`}
              />
              <label className="text-[10px] text-gray-500">{t('punctuationRotate', lang)}</label>
              <input
                type="number" step={1} value={entry.rotate ?? 0}
                onChange={(e) => update(idx, { rotate: parseFloat(e.target.value) || 0 })}
                className={`w-20 bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-${color}-500 outline-none`}
              />
              <label className="text-[10px] text-gray-500">{t('punctuationScale', lang)}</label>
              <input
                type="number" step={0.05} value={entry.scale ?? 1}
                onChange={(e) => update(idx, { scale: parseFloat(e.target.value) || 1 })}
                className={`w-20 bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-${color}-500 outline-none`}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

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
            color="blue"
            lang={lang}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setConfig({ ...config, editorPunctuationOffsets: [...editorOffsets, { char: '', offsetX: 0 }] })}
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
            color="green"
            lang={lang}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setConfig({ ...config, screenshotPunctuationOffsets: [...screenshotOffsets, { char: '', offsetX: 0 }] })}
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