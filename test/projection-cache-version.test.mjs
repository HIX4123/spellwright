import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');

test('loads the corrected projection feature bundle with a fresh cache key', () => {
  assert.match(indexHtml, /projection-features\.js\?v=projection-tags-20260915-2/);
});
