import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapIndex, swipeDirection } from '../docs/projection-selector.js';

test('wrapIndex cycles projection classes in both directions', () => {
  assert.equal(wrapIndex(6, 6), 0);
  assert.equal(wrapIndex(-1, 6), 5);
  assert.equal(wrapIndex(2, 6), 2);
});

test('swipeDirection maps left drag to next and right drag to previous', () => {
  assert.equal(swipeDirection(-120, 600, 500), 1);
  assert.equal(swipeDirection(120, 600, 500), -1);
});

test('swipeDirection ignores a short slow drag but accepts a quick flick', () => {
  assert.equal(swipeDirection(-15, 600, 500), 0);
  assert.equal(swipeDirection(-70, 600, 80), 1);
});
