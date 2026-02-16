import React from 'react';
import { RotateCcw, MessageSquarePlus, Trash2, Plus } from 'lucide-react';
import { t } from '../../services/i18n';
import { DEFAULT_SYSTEM_PROMPT } from '../../services/geminiService';
import { CustomMessage } from '../../types';
import { TabProps } from './types';

export const PromptTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  const resetPrompt = () => setConfig(prev => ({ ...prev, systemPrompt: DEFAULT_SYSTEM_PROMPT }));

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
        {/* System Prompt */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('systemPrompt', lang)}</label>
            <button onClick={resetPrompt} className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors">
              <RotateCcw size={12}/> Reset
            </button>
          </div>
          <textarea
            value={config.systemPrompt || DEFAULT_SYSTEM_PROMPT}
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
