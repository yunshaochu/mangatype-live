import React from 'react';
import { RotateCcw, MessageSquarePlus, Trash2, Plus, ChevronDown } from 'lucide-react';
import { t } from '../../services/i18n';
import {
  getTranslationPromptPresetDefinition,
  TRANSLATION_PROMPT_PRESET_OPTIONS,
} from '../../services/translationPromptPresets';
import { CustomMessage } from '../../types';
import { TabProps } from './types';

export const PromptTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  const presetDefinition = getTranslationPromptPresetDefinition(config.translationPromptPreset);
  const applySelectedPreset = () => setConfig(prev => ({ ...prev, systemPrompt: presetDefinition.defaultSystemPrompt }));
  const restoreCurrentPresetDefault = () => setConfig(prev => ({ ...prev, systemPrompt: presetDefinition.defaultSystemPrompt }));
  const currentPromptValue = config.systemPrompt || presetDefinition.defaultSystemPrompt;
  const isUsingPresetDefault = currentPromptValue === presetDefinition.defaultSystemPrompt;
  const presetDisplayName = lang === 'zh'
    ? (presetDefinition.shortLabel || presetDefinition.label)
    : presetDefinition.label;
  const presetShortDescription = lang === 'zh'
    ? (presetDefinition.shortDescription || presetDefinition.description)
    : presetDefinition.description;
  const presetDetailsLabel = lang === 'zh' ? '查看说明' : 'Details';
  const applyPresetLabel = lang === 'zh' ? '应用预设' : 'Apply Preset';
  const restorePresetLabel = lang === 'zh' ? '恢复当前预设默认值' : 'Restore Preset Default';
  const selectionHint = lang === 'zh'
    ? '选择预设后，点击“应用预设”才会覆盖下方提示词。'
    : 'Selecting a preset does not change the textarea until you apply it.';

  const handleUpdateCustomMessage = (index: number, field: keyof CustomMessage, value: string) => {
    setConfig(prev => {
      const newMsgs = [...(prev.customMessages || [])];
      newMsgs[index] = { ...newMsgs[index], [field]: value };
      return { ...prev, customMessages: newMsgs };
    });
  };

  return (
    <div className="space-y-8 animate-fade-in-right">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">System Prompts</h3>
        <p className="text-sm text-gray-500">Customize how the AI behaves and translates.</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Translation Preset</label>
            <button
              onClick={applySelectedPreset}
              className="shrink-0 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-200 transition-colors hover:border-purple-400 hover:bg-purple-500/20"
            >
              {applyPresetLabel}
            </button>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <select
              value={presetDefinition.id}
              onChange={(e) => setConfig({ ...config, translationPromptPreset: e.target.value as typeof presetDefinition.id })}
              className="min-w-[220px] rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-purple-500"
            >
              {TRANSLATION_PROMPT_PRESET_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>{lang === 'zh' ? (option.shortLabel || option.label) : option.label}</option>
              ))}
            </select>

            <div className="min-w-0 flex-1 rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-100">{presetDisplayName}</div>
                  <div className="mt-0.5 truncate text-xs text-gray-400">{presetShortDescription}</div>
                </div>
                <span className="shrink-0 rounded-full border border-gray-700 px-2 py-0.5 text-[10px] text-gray-400">
                  {isUsingPresetDefault ? (lang === 'zh' ? '当前即默认' : 'Using Default') : (lang === 'zh' ? '已自定义' : 'Customized')}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-500">{selectionHint}</div>

          <details className="group rounded-lg border border-gray-800 bg-gray-950/30 px-3 py-2 text-xs text-gray-400">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-gray-300">
              <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
              <span>{presetDetailsLabel}</span>
            </summary>
            <div className="mt-2 leading-relaxed text-gray-400">{presetDefinition.details || presetDefinition.description}</div>
          </details>
        </div>

        {/* System Prompt */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('systemPrompt', lang)}</label>
              <p className="text-[11px] text-gray-500">
                {isUsingPresetDefault ? '当前文本与所选预设默认值一致。' : '当前文本已偏离所选预设默认值；切换预设不会自动覆盖这里的内容。'}
              </p>
            </div>
            <button onClick={restoreCurrentPresetDefault} className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors">
              <RotateCcw size={12}/> {restorePresetLabel}
            </button>
          </div>
          <textarea
            value={currentPromptValue}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none font-mono leading-relaxed resize-y min-h-[200px]"
            spellCheck={false}
          />
        </div>

        {/* Pre-request Messages */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquarePlus size={16} className="text-teal-400" />
            <label className="text-sm font-medium text-white">{t('preRequestMessages', lang)}</label>
          </div>
          <p className="text-xs text-gray-500">{t('preRequestHint', lang)}</p>

          <div className="space-y-2 bg-gray-800/20 p-4 rounded-xl border border-gray-800">
            {(config.customMessages || []).map((msg, idx) => (
              <div key={idx} className="flex items-start gap-2 group">
                <select
                  value={msg.role}
                  onChange={(e) => handleUpdateCustomMessage(idx, 'role', e.target.value as any)}
                  className="bg-gray-800 text-xs text-gray-300 p-2 rounded-lg border border-gray-700 outline-none focus:border-teal-500"
                >
                  <option value="user">User</option>
                  <option value="system">System</option>
                  <option value="assistant">Assistant</option>
                </select>
                <textarea
                  rows={1}
                  value={msg.content}
                  onChange={(e) => handleUpdateCustomMessage(idx, 'content', e.target.value)}
                  placeholder={t('msgContent', lang)}
                  className="flex-1 bg-gray-800 text-xs text-white p-2 rounded-lg border border-gray-700 outline-none focus:border-teal-500 resize-y min-h-[34px]"
                />
                <button
                  onClick={() => {
                    setConfig(prev => ({
                      ...prev,
                      customMessages: (prev.customMessages || []).filter((_, i) => i !== idx)
                    }));
                  }}
                  className="p-2 text-gray-600 hover:text-red-400 hover:bg-gray-700/50 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <button
              onClick={() => setConfig(prev => ({
                ...prev,
                customMessages: [...(prev.customMessages || []), { role: 'user', content: '' }]
              }))}
              className="w-full py-2 border border-dashed border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800 transition-all flex items-center justify-center gap-1"
            >
              <Plus size={14} /> {t('addMessage', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
