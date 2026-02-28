import { APIEndpoint } from '../types';
import { handleEndpointError, handleEndpointSuccess } from './apiProtection';

/**
 * Test utility for API protection without burning tokens
 */

// Simulate different error types
export const createMockError = (type: '429' | '503' | '502' | 'rate_limit' | 'quota' | 'generic') => {
  const errors = {
    '429': {
      status: 429,
      statusCode: 429,
      message: 'Error 429: Too Many Requests',
    },
    '503': {
      status: 503,
      statusCode: 503,
      message: 'Error 503: Service Unavailable',
    },
    '502': {
      status: 502,
      statusCode: 502,
      message: 'Error 502: Bad Gateway',
    },
    'rate_limit': {
      message: 'Rate limit exceeded. Please try again later.',
    },
    'quota': {
      message: 'Quota exceeded for this API key',
    },
    'generic': {
      message: 'Network error occurred',
    },
  };

  return errors[type];
};

/**
 * Test API protection by simulating errors
 */
export const testEndpointProtection = (
  endpoint: APIEndpoint,
  scenario: 'single_error' | 'repeated_errors' | 'success_recovery' | 'auto_disable'
): {
  steps: Array<{ action: string; result: APIEndpoint; shouldDisable: boolean }>;
  summary: string;
} => {
  const steps: Array<{ action: string; result: APIEndpoint; shouldDisable: boolean }> = [];
  let currentEndpoint = { ...endpoint };

  switch (scenario) {
    case 'single_error': {
      // Simulate one 429 error
      const error = createMockError('429');
      const { updatedEndpoint, shouldDisable } = handleEndpointError(currentEndpoint, error);
      steps.push({
        action: '模拟 429 错误',
        result: updatedEndpoint,
        shouldDisable,
      });
      return {
        steps,
        summary: '单次错误：端点暂停 30 秒',
      };
    }

    case 'repeated_errors': {
      // Simulate 3 consecutive errors
      for (let i = 1; i <= 3; i++) {
        const error = createMockError(i === 1 ? '429' : i === 2 ? '503' : 'rate_limit');
        const { updatedEndpoint, shouldDisable } = handleEndpointError(currentEndpoint, error);
        currentEndpoint = updatedEndpoint;
        steps.push({
          action: `第 ${i} 次错误 (${i === 1 ? '429' : i === 2 ? '503' : 'rate_limit'})`,
          result: updatedEndpoint,
          shouldDisable,
        });
      }
      return {
        steps,
        summary: '连续错误：暂停时间逐步增加 (30s → 1m → 2m)',
      };
    }

    case 'success_recovery': {
      // Error → Error → Success → Error
      const error1 = createMockError('429');
      const { updatedEndpoint: ep1, shouldDisable: sd1 } = handleEndpointError(currentEndpoint, error1);
      steps.push({ action: '第 1 次错误 (429)', result: ep1, shouldDisable: sd1 });

      const error2 = createMockError('503');
      const { updatedEndpoint: ep2, shouldDisable: sd2 } = handleEndpointError(ep1, error2);
      steps.push({ action: '第 2 次错误 (503)', result: ep2, shouldDisable: sd2 });

      const ep3 = handleEndpointSuccess(ep2);
      steps.push({ action: '✓ 成功请求', result: ep3, shouldDisable: false });

      const error4 = createMockError('429');
      const { updatedEndpoint: ep4, shouldDisable: sd4 } = handleEndpointError(ep3, error4);
      steps.push({ action: '第 3 次错误 (429)', result: ep4, shouldDisable: sd4 });

      return {
        steps,
        summary: '恢复测试：成功请求后错误计数重置',
      };
    }

    case 'auto_disable': {
      // Simulate 5 consecutive errors to trigger auto-disable
      for (let i = 1; i <= 5; i++) {
        const errorTypes: Array<'429' | '503' | 'rate_limit'> = ['429', '503', 'rate_limit', '429', '503'];
        const error = createMockError(errorTypes[i - 1]);
        const { updatedEndpoint, shouldDisable } = handleEndpointError(currentEndpoint, error);
        currentEndpoint = updatedEndpoint;
        steps.push({
          action: `第 ${i} 次错误 (${errorTypes[i - 1]})`,
          result: updatedEndpoint,
          shouldDisable,
        });
      }
      return {
        steps,
        summary: '自动停用：5 次连续错误后端点被停用',
      };
    }

    default:
      return { steps: [], summary: '' };
  }
};

/**
 * Format test results for display
 */
export const formatTestResults = (
  steps: Array<{ action: string; result: APIEndpoint; shouldDisable: boolean }>,
  lang: 'zh' | 'en'
): string => {
  let output = '';

  steps.forEach((step, index) => {
    const ep = step.result;
    const pauseTime = ep.pausedUntil ? Math.ceil((ep.pausedUntil - Date.now()) / 1000) : 0;

    output += `\n${index + 1}. ${step.action}\n`;
    output += `   ${lang === 'zh' ? '连续错误' : 'Consecutive Errors'}: ${ep.consecutiveErrors || 0}\n`;

    if (pauseTime > 0) {
      const minutes = Math.floor(pauseTime / 60);
      const seconds = pauseTime % 60;
      const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      output += `   ${lang === 'zh' ? '暂停时间' : 'Pause Time'}: ${timeStr}\n`;
    }

    if (step.shouldDisable) {
      output += `   ⚠️ ${lang === 'zh' ? '端点已自动停用' : 'Endpoint Auto-Disabled'}\n`;
    }

    if (ep.lastError) {
      output += `   ${lang === 'zh' ? '错误信息' : 'Error'}: ${ep.lastError}\n`;
    }
  });

  return output;
};
