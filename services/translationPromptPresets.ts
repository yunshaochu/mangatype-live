import {
  DEFAULT_TRANSLATION_PROMPT_PRESET,
  normalizeTranslationPromptPreset,
  TranslationPromptPreset,
} from '../types';

type TranslationPromptContractDefinition = {
  supportsSourceText: boolean;
  supportsContext: boolean;
  requiresContext: boolean;
  requiredBubbleFields: readonly string[];
  contextFields: readonly string[];
};

export type TranslationPromptPresetDefinition = {
  id: TranslationPromptPreset;
  label: string;
  description: string;
  shortLabel?: string;
  shortDescription?: string;
  details?: string;
  defaultSystemPrompt: string;
  manualJsonPrompt: string;
  manualJsonSample: string;
  manualJsonPlaceholder: string;
  contract: TranslationPromptContractDefinition;
};

const SHARED_PROMPT_PREFIX = `你是一位专业的漫画嵌字师和翻译师。
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
返回严格有效的JSON对象。`;

const SHARED_PROMPT_SUFFIX = `### 预检测文本区域：
如果下方提供了坐标，表示这些是预先检测到的文本区域。
请将它们作为**参考锚点**——你可以微调坐标以获得更好的贴合效果，如果预检测遗漏或误识别了区域，也可以增加或删除气泡。`;

const SHARED_CONSTRAINT_LINES = [
  `- **isVertical**：如果气泡是竖排文字（漫画通常如此），'isVertical' 设为 true。`,
  `- **竖排排版**：即使 isVertical 为 true，也不要每2-3个字符就强制换行，应自然换行。`,
  `- **坐标系**：0-100 范围，相对于图片尺寸。`,
  `- **安全输出**：不要在JSON中输出字面的 "\\n" 字符串，使用实际的转义换行符。`,
] as const;

const buildPresetPrompt = (exampleJson: string, extraConstraintLines: readonly string[] = []): string => `
${SHARED_PROMPT_PREFIX}

示例：
${exampleJson}

### 重要约束：
${[...extraConstraintLines, ...SHARED_CONSTRAINT_LINES].join('\n')}

${SHARED_PROMPT_SUFFIX}`.trim();

const LEGACY_SAMPLE_JSON = `{
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

const CONTEXTUAL_SAMPLE_JSON = `{
  "bubbles": [
    {
      "sourceText": "原文第一行\\n原文第二行",
      "context": {
        "speaker": "角色名 / 旁白 / 独白 / 不明",
        "situation": "这一句的语境和语气",
        "preText": "前一句台词，没有就写空字符串",
        "postText": "后一句台词，没有就写空字符串",
        "translationHint": "翻译时需要注意的点，简短填写"
      },
      "text": "很好，增加 JSON 模式作为后备吧",
      "x": 50,
      "y": 45,
      "width": 25,
      "height": 20,
      "isVertical": true
    }
  ]
}`;

const LEGACY_PROMPT = buildPresetPrompt(LEGACY_SAMPLE_JSON);
const CONTEXTUAL_PROMPT = buildPresetPrompt(CONTEXTUAL_SAMPLE_JSON, [
  `- **sourceText**：填写日文原文，保留原始换行，不要翻译。`,
  `- **context**：先填写用于翻译的上下文对象；不确定时可写“\"不明\"”或空字符串。`,
  `- **text**：结合 sourceText 和 context 给出最终中文译文。`,
]);

export const TRANSLATION_PROMPT_PRESET_DEFINITIONS = {
  contextual_v1: {
    id: 'contextual_v1',
    label: 'With Context',
    shortLabel: '有上下文',
    description: '保留 sourceText + context + text 的上下文翻译契约。',
    shortDescription: '保留原文和上下文信息。',
    details: '适合需要保留 sourceText、说话者、语境、前后文和翻译提示的场景。',
    defaultSystemPrompt: CONTEXTUAL_PROMPT,
    manualJsonPrompt: CONTEXTUAL_PROMPT,
    manualJsonSample: CONTEXTUAL_SAMPLE_JSON,
    manualJsonPlaceholder: '{ "bubbles": [ { "sourceText": "...", "context": { ... }, "text": "...", "x": 50, ... } ] }',
    contract: {
      supportsSourceText: true,
      supportsContext: true,
      requiresContext: true,
      requiredBubbleFields: ['sourceText', 'context', 'text', 'x', 'y', 'width', 'height', 'isVertical'],
      contextFields: ['speaker', 'situation', 'preText', 'postText', 'translationHint'],
    },
  },
  legacy_loose_v0: {
    id: 'legacy_loose_v0',
    label: 'Without Context',
    shortLabel: '无上下文',
    description: '保留旧版宽松输出契约，不把 context 当作必填。',
    shortDescription: '只保留译文和定位字段。',
    details: '适合不想让模型额外补上下文对象，只关注最终译文、尺寸和坐标的场景。',
    defaultSystemPrompt: LEGACY_PROMPT,
    manualJsonPrompt: LEGACY_PROMPT,
    manualJsonSample: LEGACY_SAMPLE_JSON,
    manualJsonPlaceholder: '{ "bubbles": [ { "text": "...", "x": 50, ... } ] }',
    contract: {
      supportsSourceText: false,
      supportsContext: false,
      requiresContext: false,
      requiredBubbleFields: ['text', 'x', 'y', 'width', 'height', 'isVertical'],
      contextFields: [],
    },
  },
} as const satisfies Record<TranslationPromptPreset, TranslationPromptPresetDefinition>;

export const TRANSLATION_PROMPT_PRESET_OPTIONS = Object.values(TRANSLATION_PROMPT_PRESET_DEFINITIONS).map(({ id, label, shortLabel, description }) => ({
  id,
  label,
  shortLabel,
  description,
}));

export const getTranslationPromptPresetDefinition = (
  preset: TranslationPromptPreset | null | undefined,
): TranslationPromptPresetDefinition => {
  const normalizedPreset = normalizeTranslationPromptPreset(preset, DEFAULT_TRANSLATION_PROMPT_PRESET);
  return TRANSLATION_PROMPT_PRESET_DEFINITIONS[normalizedPreset];
};
