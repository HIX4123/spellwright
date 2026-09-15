import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../docs/projection-feature-guides.css', import.meta.url), 'utf8');

test('projection guide overlay does not intercept stage interaction', () => {
  assert.match(css, /\.projection-feature-overlay[\s\S]*pointer-events:\s*none/);
});
