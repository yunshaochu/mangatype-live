import type { AIConfig, APIEndpoint } from '../types.ts';
import {
  DEFAULT_TRANSLATION_PROMPT_PRESET,
  normalizeEndpointProtectionState,
  normalizeTranslationPromptPreset,
} from '../types.ts';

export const AI_CONFIG_STORAGE_KEY = 'mangatype_live_settings_v1';

type RuntimeConfig = {
  TEXT_DETECTION_API_URL?: string;
  IOPAINT_API_URL?: string;
};

type LoadAiConfigOptions = {
  defaultConfig: AIConfig;
  runtimeConfig: RuntimeConfig;
  createEndpointId?: () => string;
};

const AI_CONFIG_STORAGE_FIELDS = [
  'provider',
  'apiKey',
  'baseUrl',
  'model',
  'endpoints',
  'systemPrompt',
  'translationPromptPreset',
  'defaultFontSize',
  'enableMaskedImageMode',
  'useMasksAsHints',
  'drawMasksOnImage',
  'appendMasksToManualJson',
  'useTextDetectionApi',
  'textDetectionApiUrl',
  'detectionExpansionRatio',
  'usePreciseFill',
  'showContourPreview',
  'useCharRects',
  'preInpaintContour',
  'enableDialogSnap',
  'forceSnapSize',
  'enableInpainting',
  'inpaintingUrl',
  'inpaintingModel',
  'language',
  'allowAiRotation',
  'allowAiFontSelection',
  'fontSelectionPrompt',
  'allowAiColorSelection',
  'colorSelectionPrompt',
  'allowAiFontSize',
  'fontSizeMode',
  'fontScaleEntries',
  'fontSizeScalePrompt',
  'fontSizePrompt',
  'customMessages',
  'autoDetectBackground',
  'modelSupportsFunctionCalling',
  'modelSupportsJsonMode',
  'defaultMaskShape',
  'defaultMaskCornerRadius',
  'defaultMaskFeather',
  'defaultFontFamily',
  'defaultTextColor',
  'defaultStrokeColor',
  'defaultBackgroundColor',
  'defaultLetterSpacing',
  'defaultLineHeight',
  'defaultIsVertical',
  'concurrency',
  'maxRetries',
  'apiProtectionEnabled',
  'apiProtectionStateMachineV2',
  'apiProtectionDurations',
  'apiProtectionDisableThreshold',
  'exportMethod',
  'exportSkippedAsOriginal',
  'freehandPerfPhase1Enabled',
  'freehandPerfPhase2Enabled',
  'freehandLowResThresholdMp',
  'freehandPreviewTargetPixels',
  'freehandReplayBatchSize',
] as const satisfies ReadonlyArray<keyof AIConfig>;

const cloneSerializable = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

type PickStoredAiConfigOptions = {
  stripEffectiveConcurrency?: boolean;
};

const pickStoredAiConfig = (
  input: Partial<AIConfig>,
  { stripEffectiveConcurrency = true }: PickStoredAiConfigOptions = {},
): Partial<AIConfig> => {
  const snapshot: Partial<AIConfig> = {};

  for (const key of AI_CONFIG_STORAGE_FIELDS) {
    const value = input[key];
    if (value !== undefined) {
      snapshot[key] = cloneSerializable(value);
    }
  }

  if (stripEffectiveConcurrency && Array.isArray(snapshot.endpoints)) {
    snapshot.endpoints = snapshot.endpoints.map((endpoint: APIEndpoint) => {
      const { effectiveConcurrency, ...rest } = endpoint;
      return rest;
    });
  }

  return snapshot;
};

export const isImportableAiConfig = (input: unknown): input is Partial<AIConfig> => (
  typeof input === 'object'
  && input !== null
  && ('provider' in input || 'language' in input || 'endpoints' in input)
);

export const exportAiConfigJson = (config: AIConfig): string => JSON.stringify(pickStoredAiConfig(config));

export const saveAiConfigToStorage = (storage: Storage, config: Partial<AIConfig>): void => {
  storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(pickStoredAiConfig(config)));
};

export const clearAiConfigStorage = (storage: Storage): void => {
  storage.removeItem(AI_CONFIG_STORAGE_KEY);
};

export const loadAiConfigFromStorage = (
  storage: Storage,
  { defaultConfig, runtimeConfig, createEndpointId = () => crypto.randomUUID() }: LoadAiConfigOptions,
): AIConfig => {
  const saved = storage.getItem(AI_CONFIG_STORAGE_KEY);
  if (!saved) {
    return defaultConfig;
  }

  const parsed = JSON.parse(saved) as Partial<AIConfig>;
  const sanitized = pickStoredAiConfig(parsed, { stripEffectiveConcurrency: false });
  const merged: AIConfig = { ...defaultConfig, ...sanitized };

  merged.translationPromptPreset = normalizeTranslationPromptPreset(
    sanitized.translationPromptPreset,
    defaultConfig.translationPromptPreset ?? DEFAULT_TRANSLATION_PROMPT_PRESET,
  );

  merged.exportSkippedAsOriginal = true;

  if (!sanitized.customMessages) {
    merged.customMessages = defaultConfig.customMessages;
  }

  if (runtimeConfig.TEXT_DETECTION_API_URL && sanitized.textDetectionApiUrl === 'http://localhost:5000') {
    merged.textDetectionApiUrl = runtimeConfig.TEXT_DETECTION_API_URL;
  }

  if (runtimeConfig.IOPAINT_API_URL && sanitized.inpaintingUrl === 'http://localhost:8080') {
    merged.inpaintingUrl = runtimeConfig.IOPAINT_API_URL;
  }

  if (!Array.isArray(sanitized.endpoints) || sanitized.endpoints.length === 0) {
    merged.endpoints = [normalizeEndpointProtectionState({
      id: createEndpointId(),
      name: sanitized.provider === 'openai' ? 'OpenAI (Migrated)' : 'Gemini (Migrated)',
      enabled: true,
      provider: sanitized.provider || 'openai',
      apiKey: sanitized.apiKey || '',
      baseUrl: sanitized.baseUrl || '',
      model: sanitized.model || 'gemini-3-flash-preview',
      modelSupportsFunctionCalling: sanitized.modelSupportsFunctionCalling,
      modelSupportsJsonMode: sanitized.modelSupportsJsonMode,
    })];
  } else {
    merged.endpoints = sanitized.endpoints.map((endpoint: APIEndpoint) => normalizeEndpointProtectionState(endpoint));
  }

  return merged;
};
