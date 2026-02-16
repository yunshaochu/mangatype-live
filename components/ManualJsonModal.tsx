

import React, { useState } from 'react';
import { FileJson, X, CheckCircle, AlertCircle, Copy, Terminal, ClipboardCopy } from 'lucide-react';
import { AIConfig, MaskRegion } from '../types';
import { t } from '../services/i18n';

interface ManualJsonModalProps {
  onApply: (detected: any[]) => void;
  onClose: () => void;
  config: AIConfig;
  maskRegions?: MaskRegion[];
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

const AI_PROMPT = `你是一位专业的漫画嵌字师和翻译师。
你的任务是识别漫画中的对话气泡，翻译文本并提供布局坐标。

### 工作步骤：
1. **检测**：识别所有包含有意义对话的气泡。
   - **忽略**音效（SFX），除非用户明确要求翻译。
2. **翻译**：将文本翻译为**简体中文**。
   - 风格：自然、口语化的漫画风格。
   - **换行**：尽量在视觉上匹配原文的换行方式。**不要过度换行**，仅在语义需要或气泡形状必要时换行。
3. **字体选择**：根据对话的情绪和语境选择最合适的字体。
4. **遮罩定位**：计算覆盖原文的边界框（中心x、中心y、宽度、高度，单位为百分比）。
   - **要求**：遮罩必须**紧密贴合**，完全覆盖文字像素但尽可能小。

### 输出格式（仅JSON）：
返回严格有效的JSON对象。

示例：
{
  "bubbles": [
    {
      "text": "第一行\\n第二行",
      "x": 50.5,
      "y": 30.0,
      "width": 10.0,
      "height": 15.0,
      "isVertical": true,
      "fontFamily": "noto"
    }
  ]
}

### 重要约束：
- **isVertical**：如果气泡是竖排文字（漫画通常如此），'isVertical' 设为 true。
- **竖排排版**：即使 isVertical 为 true，也不要每2-3个字符就强制换行，应自然换行。
- **坐标系**：0-100 范围，相对于图片尺寸。
- **安全输出**：不要在JSON中输出字面的 "\\n" 字符串，使用实际的转义换行符。

### 预检测文本区域：
如果下方提供了坐标，表示这些是预先检测到的文本区域。
请将它们作为**参考锚点**——你可以微调坐标以获得更好的贴合效果，如果预检测遗漏或误识别了区域，也可以增加或删除气泡。
`;

// Duplicate utility to avoid complex export/import in client-side only mode
const repairJson = (jsonStr: string): string => {
  let inString = false;
  let escaped = false;
  let result = '';
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    
    if (inString) {
      if (escaped) {
        result += char;
        escaped = false;
      } else {
        if (char === '\\') {
          escaped = true;
          result += char;
        } else if (char === '"') {
          inString = false;
          result += char;
        } else if (char === '\n') {
          result += '\\n'; // Fix literal newlines inside strings
        } else if (char === '\r') {
          // Skip literal carriage return
        } else if (char === '\t') {
          result += '\\t';
        } else {
          result += char;
        }
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }
  return result;
};

export const ManualJsonModal: React.FC<ManualJsonModalProps> = ({ onApply, onClose, config, maskRegions }) => {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lang = config.language || 'zh';

  // Generate dynamic prompt with optional mask coordinates
  const generatePrompt = () => {
    let prompt = AI_PROMPT;

    if (config.appendMasksToManualJson && maskRegions && maskRegions.length > 0) {
      const maskCoords = maskRegions.map((m, idx) =>
        `区域 ${idx + 1}: x=${m.x.toFixed(1)}, y=${m.y.toFixed(1)}, width=${m.width.toFixed(1)}, height=${m.height.toFixed(1)}`
      ).join('\n');

      prompt += `\n\n### 当前图片的红框坐标：\n${maskCoords}`;
    }

    return prompt;
  };

  const handleApply = () => {
    try {
      setError(null);
      let content = jsonText.trim();
      
      // Basic extraction logic similar to the service
      if (content.includes('```')) {
        const match = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```([\s\S]*?)```/);
        if (match) content = match[1];
      }

      let parsed;
      try {
          parsed = JSON.parse(content);
      } catch (e) {
          // Fallback: Try repairing
          try {
              parsed = JSON.parse(repairJson(content));
          } catch (e2) {
              throw e; // Throw original error if repair fails
          }
      }

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
    navigator.clipboard.writeText(generatePrompt());
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
                title={t('copyPromptHint', lang)}
              >
                <ClipboardCopy size={10} /> {t('copyPrompt', lang)}
              </button>
              <button 
                onClick={loadTemplate}
                className="text-[10px] bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-blue-300 flex items-center gap-1 transition-colors"
                title={t('loadTemplateHint', lang)}
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