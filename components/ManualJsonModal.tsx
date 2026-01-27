import React, { useState } from 'react';
import { FileJson, X, CheckCircle, AlertCircle, Copy, Terminal, ClipboardCopy } from 'lucide-react';
import { AIConfig } from '../types';
import { t } from '../services/i18n';

interface ManualJsonModalProps {
  onApply: (detected: any[]) => void;
  onClose: () => void;
  config: AIConfig;
}

const SAMPLE_JSON = `{
  "bubbles": [
    {
      "text": "很好，增加 JSON 模式作为后备吧",
      "x": 50,
      "y": 45,
      "width": 25,
      "height": 20,
      "isVertical": true
    }
  ]
}`;

const AI_PROMPT = `你是一个专业的漫画嵌字和翻译专家。请分析这张图片，执行以下步骤：

1. **识别气泡**：找出图片中所有的对话气泡。
2. **翻译内容**：读取气泡内的文字，并将其翻译成自然流畅的**简体中文**。
3. **计算遮罩坐标**：计算一个矩形框来覆盖原始文字。
   - \`x\` 和 \`y\` 是气泡的**中心点**坐标（0-100%）。
   - \`width\` 和 \`height\` 是相对于图片总宽高的百分比（0-100%）。
   - 确保框足够大以覆盖原文，但不要超出气泡边界。
4. **判断排版**：如果气泡是竖排文字（漫画通常如此），\`isVertical\` 设为 true。

**请务必只输出以下格式的 JSON 代码，不要包含markdown标记或其他废话：**

{
  "bubbles": [
    {
      "text": "这里是翻译后的中文内容...",
      "x": 50,
      "y": 45,
      "width": 15,
      "height": 20,
      "isVertical": true
    }
  ]
}`;

export const ManualJsonModal: React.FC<ManualJsonModalProps> = ({ onApply, onClose, config }) => {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lang = config.language || 'zh';

  const handleApply = () => {
    try {
      setError(null);
      let content = jsonText.trim();
      
      // Basic extraction logic similar to the service
      if (content.includes('```')) {
        const match = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```([\s\S]*?)```/);
        if (match) content = match[1];
      }

      const parsed = JSON.parse(content);
      if (!parsed.bubbles || !Array.isArray(parsed.bubbles)) {
        throw new Error('JSON must contain a "bubbles" array.');
      }

      onApply(parsed.bubbles);
    } catch (e: any) {
      setError(e.message || t('jsonError', lang));
    }
  };

  const loadTemplate = () => {
    setJsonText(SAMPLE_JSON);
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT);
    alert(t('promptCopied', lang));
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-xl">
          <h3 className="font-bold text-white flex items-center gap-2">
            <FileJson size={18} className="text-blue-400" /> {t('manualJsonImport', lang)}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-hidden flex flex-col flex-1">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-400">
              {t('pasteJson', lang)}
            </p>
            <div className="flex gap-2">
              <button 
                onClick={copyPrompt}
                className="text-[10px] bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 px-2 py-1 rounded text-purple-300 flex items-center gap-1 transition-colors"
                title="Copy the prompt to send to ChatGPT/Claude"
              >
                <ClipboardCopy size={10} /> {t('copyPrompt', lang)}
              </button>
              <button 
                onClick={loadTemplate}
                className="text-[10px] bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-blue-300 flex items-center gap-1 transition-colors"
                title="Load a sample JSON structure"
              >
                <Terminal size={10} /> {t('loadTemplate', lang)}
              </button>
            </div>
          </div>

          <div className="flex-1 relative">
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{ "bubbles": [ { "text": "...", "x": 50, ... } ] }'
              className="w-full h-full min-h-[300px] bg-gray-900 border border-gray-700 rounded p-4 text-xs text-green-400 focus:border-blue-500 outline-none font-mono leading-relaxed"
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-2 text-xs text-red-400 animate-shake">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-900/50 rounded-b-xl flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            {t('cancel', lang)}
          </button>
          <button 
            onClick={handleApply}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
          >
            <CheckCircle size={16} /> {t('applyBubbles', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};
