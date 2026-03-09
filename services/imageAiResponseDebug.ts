import type { AIProvider, AiDetectionResult, DetectedBubble, ImageAiResponseDebug, ImageAiResponseSourceKind } from '../types.ts';

type BuildImageAiResponseDebugInput = {
  bubbles: DetectedBubble[];
  sourceKind: ImageAiResponseSourceKind;
  provider?: AIProvider;
  model?: string;
  capturedAt?: number;
};

export const buildImageAiResponseDebug = ({
  bubbles,
  sourceKind,
  provider,
  model,
  capturedAt = Date.now(),
}: BuildImageAiResponseDebugInput): ImageAiResponseDebug => ({
  prettyJson: JSON.stringify({ bubbles }, null, 2),
  sourceKind,
  provider,
  model: typeof model === 'string' && model.trim().length > 0 ? model.trim() : undefined,
  capturedAt,
  bubbleCount: bubbles.length,
});

const IMAGE_AI_RESPONSE_SOURCE_LABELS: Record<ImageAiResponseSourceKind, string> = {
  gemini_function: 'Gemini Function',
  gemini_json: 'Gemini JSON',
  gemini_text: 'Gemini Text',
  openai_tool: 'OpenAI Tool',
  openai_content: 'OpenAI Content',
  manual_import: 'Manual Import',
};

export const formatImageAiResponseSourceKind = (sourceKind: ImageAiResponseSourceKind): string => {
  return IMAGE_AI_RESPONSE_SOURCE_LABELS[sourceKind];
};

export const buildImageAiResponseDebugFromDetectionResult = (
  result: AiDetectionResult,
  meta: {
    provider: AIProvider;
    model?: string;
    capturedAt?: number;
  },
): ImageAiResponseDebug => buildImageAiResponseDebug({
  bubbles: result.rawPayload.bubbles,
  sourceKind: result.sourceKind,
  provider: meta.provider,
  model: meta.model,
  capturedAt: meta.capturedAt,
});
