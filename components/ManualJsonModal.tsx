

import React, { useState } from 'react';
import { FileJson, X, CheckCircle, AlertCircle, Copy, Terminal, ClipboardCopy } from 'lucide-react';
import { AIConfig, DetectedBubble, MaskRegion } from '../types';
import { t } from '../services/i18n';
import { normalizeDetectedBubblesPayload } from '../services/geminiService';
import { getTranslationPromptPresetDefinition } from '../services/translationPromptPresets';

interface ManualJsonModalProps {
  onApply: (detected: DetectedBubble[]) => void;
  onClose: () => void;
  config: AIConfig;
  maskRegions?: MaskRegion[];
}

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
  const presetDefinition = getTranslationPromptPresetDefinition(config.translationPromptPreset);

  // Generate dynamic prompt with optional mask coordinates
  const generatePrompt = () => {
    let prompt = presetDefinition.manualJsonPrompt;

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

      console.log('[layout-variants]', 'manual-json-parsed', {
        bubbleCount: parsed.bubbles.length,
        firstBubbleKeys: parsed.bubbles[0] ? Object.keys(parsed.bubbles[0]) : [],
        firstBubbleLayoutVariantCount: parsed.bubbles[0]?.layoutVariants?.length ?? 0,
        firstBubbleLayoutVariants: parsed.bubbles[0]?.layoutVariants,
      });

      onApply(normalizeDetectedBubblesPayload(parsed));
    } catch (e: any) {
      setError(e.message || t('jsonError', lang));
    }
  };

  const loadTemplate = () => {
    setJsonText(presetDefinition.manualJsonSample);
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
              placeholder={presetDefinition.manualJsonPlaceholder}
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
