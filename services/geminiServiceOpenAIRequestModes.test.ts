import assert from 'node:assert/strict';

import { detectAndTypesetComic } from './geminiService.ts';
import type { AIConfig, TranslationPromptPreset } from '../types.ts';

const originalFetch = globalThis.fetch;

type PresetCase = {
  key: 'contextual-default' | 'legacy';
  preset?: TranslationPromptPreset;
  expectedRequiredFields: string[];
  expectsContext: boolean;
  expectsSourceText: boolean;
};

const PRESET_CASES: PresetCase[] = [
  {
    key: 'contextual-default',
    expectedRequiredFields: ['sourceText', 'context', 'text', 'x', 'y', 'width', 'height', 'isVertical'],
    expectsContext: true,
    expectsSourceText: true,
  },
  {
    key: 'legacy',
    preset: 'legacy_loose_v0',
    expectedRequiredFields: ['text', 'x', 'y', 'width', 'height', 'isVertical'],
    expectsContext: false,
    expectsSourceText: false,
  },
];

const createConfig = (overrides: Partial<AIConfig> = {}): AIConfig => ({
  provider: 'openai',
  apiKey: 'test-key',
  baseUrl: 'https://example.com',
  model: 'gpt-4o-mini',
  endpoints: [],
  defaultFontSize: 16,
  language: 'en',
  ...overrides,
} as AIConfig);

const createBubblePayload = (preset: PresetCase) => {
  if (preset.expectsContext) {
    return {
      bubbles: [
        {
          sourceText: 'original line',
          context: {
            speaker: 'narrator',
            situation: 'explaining the scene',
            preText: '',
            postText: '',
            translationHint: 'keep it natural',
          },
          text: 'hello',
          x: 10,
          y: 20,
          width: 30,
          height: 40,
          isVertical: false,
        },
      ],
    };
  }

  return {
    bubbles: [
      {
        text: 'hello',
        x: 10,
        y: 20,
        width: 30,
        height: 40,
        isVertical: false,
      },
    ],
  };
};

const assertPresetPrompt = (body: any, preset: PresetCase, label: string) => {
  const userMessage = body.messages[body.messages.length - 1];
  const promptText = userMessage.content[0].text as string;

  if (preset.expectsContext) {
    assert.match(promptText, /sourceText/, `${label}: prompt should mention sourceText for contextual preset`);
    assert.match(promptText, /context/, `${label}: prompt should mention context for contextual preset`);
  } else {
    assert.doesNotMatch(promptText, /sourceText/, `${label}: prompt should not mention sourceText for legacy preset`);
    assert.doesNotMatch(promptText, /context/, `${label}: prompt should not mention context for legacy preset`);
  }
};

const assertPresetToolSchema = (body: any, preset: PresetCase, label: string) => {
  const bubbleSchema = body.tools[0].function.parameters.properties.bubbles.items;
  assert.deepEqual(bubbleSchema.required, preset.expectedRequiredFields, `${label}: required fields should follow preset contract`);
  assert.equal('sourceText' in bubbleSchema.properties, preset.expectsSourceText, `${label}: sourceText schema should follow preset contract`);
  assert.equal('context' in bubbleSchema.properties, preset.expectsContext, `${label}: context schema should follow preset contract`);
};

const assertParsedBubble = (
  result: { bubbles: any[]; rawPayload: { bubbles: any[] }; sourceKind: string },
  preset: PresetCase,
  label: string,
  expectedSourceKind: 'openai_tool' | 'openai_content',
) => {
  assert.equal(result.sourceKind, expectedSourceKind, `${label}: should expose the expected sourceKind`);
  assert.equal(result.bubbles.length, 1, `${label}: should parse one bubble`);
  assert.equal(result.rawPayload.bubbles.length, 1, `${label}: rawPayload should mirror the applied payload`);
  assert.equal(result.bubbles[0].text, 'hello', `${label}: should keep parsed bubble text`);
  assert.equal(result.rawPayload.bubbles[0].text, 'hello', `${label}: rawPayload should keep parsed bubble text`);

  if (preset.expectsContext) {
    assert.equal(result.bubbles[0].sourceText, 'original line', `${label}: should keep parsed source text`);
    assert.equal(result.bubbles[0].context?.speaker, 'narrator', `${label}: should keep parsed translation context`);
  } else {
    assert.equal(result.bubbles[0].sourceText, undefined, `${label}: legacy preset should not synthesize sourceText`);
    assert.equal(result.bubbles[0].context, undefined, `${label}: legacy preset should keep context optional`);
  }
};

const runCase = async ({
  label,
  config,
  preset,
  responseMessage,
  expectedSourceKind,
  assertBody,
}: {
  label: string;
  config: AIConfig;
  preset: PresetCase;
  responseMessage: Record<string, unknown>;
  expectedSourceKind: 'openai_tool' | 'openai_content';
  assertBody: (body: any) => void;
}) => {
  let capturedBody: any;

  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body ?? '{}'));
    return new Response(JSON.stringify({ choices: [{ message: responseMessage }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await detectAndTypesetComic('data:image/jpeg;base64,Zm9v', config);

  assertParsedBubble(result, preset, label, expectedSourceKind);
  assertPresetPrompt(capturedBody, preset, label);
  assertBody(capturedBody);
};

const main = async () => {
  for (const preset of PRESET_CASES) {
    const payload = createBubblePayload(preset);
    const config = createConfig(preset.preset ? { translationPromptPreset: preset.preset } : {});

    await runCase({
      label: `${preset.key}:fc+json`,
      preset,
      config,
      responseMessage: {
        tool_calls: [{ function: { arguments: JSON.stringify(payload) } }],
      },
      expectedSourceKind: 'openai_tool',
      assertBody: body => {
        assert.ok(Array.isArray(body.tools), `${preset.key}:fc+json tools should be present`);
        assert.equal(body.tool_choice, 'auto', `${preset.key}:fc+json tool_choice should be auto`);
        assert.deepEqual(body.response_format, { type: 'json_object' }, `${preset.key}:fc+json response_format should be json_object`);
        assertPresetToolSchema(body, preset, `${preset.key}:fc+json`);
      },
    });

    await runCase({
      label: `${preset.key}:fc-only`,
      preset,
      config: { ...config, modelSupportsJsonMode: false },
      responseMessage: {
        tool_calls: [{ function: { arguments: JSON.stringify(payload) } }],
      },
      expectedSourceKind: 'openai_tool',
      assertBody: body => {
        assert.ok(Array.isArray(body.tools), `${preset.key}:fc-only tools should be present`);
        assert.equal(body.tool_choice, 'auto', `${preset.key}:fc-only tool_choice should be auto`);
        assert.equal('response_format' in body, false, `${preset.key}:fc-only response_format should be absent`);
        assertPresetToolSchema(body, preset, `${preset.key}:fc-only`);
      },
    });

    await runCase({
      label: `${preset.key}:json-only`,
      preset,
      config: { ...config, modelSupportsFunctionCalling: false },
      responseMessage: { content: JSON.stringify(payload) },
      expectedSourceKind: 'openai_content',
      assertBody: body => {
        assert.equal('tools' in body, false, `${preset.key}:json-only tools should be absent`);
        assert.equal('tool_choice' in body, false, `${preset.key}:json-only tool_choice should be absent`);
        assert.deepEqual(body.response_format, { type: 'json_object' }, `${preset.key}:json-only response_format should be json_object`);
      },
    });

    await runCase({
      label: `${preset.key}:text-fallback`,
      preset,
      config: { ...config, modelSupportsFunctionCalling: false, modelSupportsJsonMode: false },
      responseMessage: { content: JSON.stringify(payload) },
      expectedSourceKind: 'openai_content',
      assertBody: body => {
        assert.equal('tools' in body, false, `${preset.key}:text-fallback tools should be absent`);
        assert.equal('tool_choice' in body, false, `${preset.key}:text-fallback tool_choice should be absent`);
        assert.equal('response_format' in body, false, `${preset.key}:text-fallback response_format should be absent`);
        const userMessage = body.messages[body.messages.length - 1];
        assert.match(userMessage.content[0].text, /Respond with a JSON object containing the bubbles\./, `${preset.key}:text-fallback should keep plain-text JSON fallback instruction`);
      },
    });
  }

  console.log('geminiServiceOpenAIRequestModes tests passed');
};

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
