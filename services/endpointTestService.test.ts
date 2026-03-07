import assert from 'node:assert/strict';
import { DEFAULT_ENDPOINT_CAPABILITY_TEST_SETTINGS, runConfiguredEndpointCapabilityTests } from './endpointTestService';

const pass = (message: string) => ({ ok: true, message, latencyMs: 10, status: 'pass' as const });
const fail = (message: string) => ({ ok: false, message, latencyMs: 12, status: 'fail' as const });

const main = async () => {
const callOrder: string[] = [];
const resultDefault = await runConfiguredEndpointCapabilityTests(
  DEFAULT_ENDPOINT_CAPABILITY_TEST_SETTINGS,
  {
    runBasic: async () => {
      callOrder.push('basic');
      return pass('basic ok');
    },
    runFunctionCalling: async () => {
      callOrder.push('fc');
      return pass('fc ok');
    },
    runJsonMode: async () => {
      callOrder.push('json');
      return pass('json ok');
    },
  },
);
assert.deepEqual(callOrder, ['basic'], 'default settings should only run the basic request');
assert.equal(resultDefault.functionCalling.status, 'not_tested', 'FC should stay untested when not selected');
assert.equal(resultDefault.jsonMode.status, 'not_tested', 'JSON should stay untested when not selected');

const selectedOrder: string[] = [];
const resultSelected = await runConfiguredEndpointCapabilityTests(
  { testFunctionCalling: true, testJsonMode: true },
  {
    runBasic: async () => {
      selectedOrder.push('basic');
      return pass('basic ok');
    },
    runFunctionCalling: async () => {
      selectedOrder.push('fc');
      return pass('fc ok');
    },
    runJsonMode: async () => {
      selectedOrder.push('json');
      return fail('json failed');
    },
  },
);
assert.deepEqual(selectedOrder, ['basic', 'fc', 'json'], 'selected advanced tests should run serially after the basic request');
assert.equal(resultSelected.functionCalling.status, 'pass', 'selected FC should report actual execution result');
assert.equal(resultSelected.jsonMode.status, 'fail', 'selected JSON should report actual execution result');

let advancedCalls = 0;
const resultSkipped = await runConfiguredEndpointCapabilityTests(
  { testFunctionCalling: true, testJsonMode: true },
  {
    runBasic: async () => fail('basic failed'),
    runFunctionCalling: async () => {
      advancedCalls += 1;
      return pass('fc ok');
    },
    runJsonMode: async () => {
      advancedCalls += 1;
      return pass('json ok');
    },
  },
);
assert.equal(advancedCalls, 0, 'advanced requests should not run after a basic failure');
assert.equal(resultSkipped.functionCalling.status, 'skipped', 'selected FC should be marked skipped after a basic failure');
assert.equal(resultSkipped.jsonMode.status, 'skipped', 'selected JSON should be marked skipped after a basic failure');
};

main().then(() => {
  console.log('endpointTestService tests passed');
});
