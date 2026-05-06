import assert from 'node:assert/strict';
import { shouldShowBubbleContextSection } from './bubbleEditorContext';

assert.equal(shouldShowBubbleContextSection('contextual_v1'), true, 'contextual preset should show context section');
assert.equal(shouldShowBubbleContextSection('legacy_loose_v0'), false, 'legacy preset should hide context section');
assert.equal(shouldShowBubbleContextSection(undefined), true, 'missing preset should fall back to contextual section visibility');

console.log('bubbleEditorContext tests passed');
