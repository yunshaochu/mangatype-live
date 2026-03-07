import assert from 'node:assert/strict';
import { detectAndTypesetComic } from './geminiService';
import type { AIConfig } from '../types';

const originalFetch = globalThis.fetch;

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

const createBubblePayload = () => ({
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
});

const runCase = async ({
  label,
  config,
  responseMessage,
  assertBody,
}: {
  label: string;
  config: AIConfig;
  responseMessage: Record<string, unknown>;
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

  assert.equal(result.length, 1, `${label}: should parse one bubble`);
  assert.equal(result[0].text, 'hello', `${label}: should keep parsed bubble text`);
  assertBody(capturedBody);
};

const main = async () => {
  await runCase({
    label: 'fc+json',
    config: createConfig(),
    responseMessage: {
      tool_calls: [
        {
          function: {
            arguments: JSON.stringify(createBubblePayload()),
          },
        },
      ],
    },
    assertBody: body => {
      assert.ok(Array.isArray(body.tools), 'fc+json: tools should be present');
      assert.equal(body.tool_choice, 'auto', 'fc+json: tool_choice should be auto');
      assert.deepEqual(body.response_format, { type: 'json_object' }, 'fc+json: response_format should be json_object');
    },
  });

  await runCase({
    label: 'fc-only',
    config: createConfig({ modelSupportsJsonMode: false }),
    responseMessage: {
      tool_calls: [
        {
          function: {
            arguments: JSON.stringify(createBubblePayload()),
          },
        },
      ],
    },
    assertBody: body => {
      assert.ok(Array.isArray(body.tools), 'fc-only: tools should be present');
      assert.equal(body.tool_choice, 'auto', 'fc-only: tool_choice should be auto');
      assert.equal('response_format' in body, false, 'fc-only: response_format should be absent');
    },
  });

  await runCase({
    label: 'json-only',
    config: createConfig({ modelSupportsFunctionCalling: false }),
    responseMessage: {
      content: JSON.stringify(createBubblePayload()),
    },
    assertBody: body => {
      assert.equal('tools' in body, false, 'json-only: tools should be absent');
      assert.equal('tool_choice' in body, false, 'json-only: tool_choice should be absent');
      assert.deepEqual(body.response_format, { type: 'json_object' }, 'json-only: response_format should be json_object');
    },
  });

  await runCase({
    label: 'text-fallback',
    config: createConfig({ modelSupportsFunctionCalling: false, modelSupportsJsonMode: false }),
    responseMessage: {
      content: JSON.stringify(createBubblePayload()),
    },
    assertBody: body => {
      assert.equal('tools' in body, false, 'text-fallback: tools should be absent');
      assert.equal('tool_choice' in body, false, 'text-fallback: tool_choice should be absent');
      assert.equal('response_format' in body, false, 'text-fallback: response_format should be absent');
      const userMessage = body.messages[body.messages.length - 1];
      assert.match(userMessage.content[0].text, /Respond with a JSON object containing the bubbles\./, 'text-fallback: prompt should keep plain-text JSON fallback instruction');
    },
  });
};

main()
  .then(() => {
    console.log('geminiServiceOpenAIRequestModes tests passed');
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
