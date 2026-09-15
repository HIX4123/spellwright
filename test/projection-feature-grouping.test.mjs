import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../docs/projection-feature-guides.js', import.meta.url), 'utf8');

test('projection descriptors are split into the requested three groups', () => {
  assert.match(source, /\['중심 구조'\]/);
  assert.match(source, /\['대칭축', '회전대칭'\]/);
  assert.match(source, /\['방사층', '층별 점', '외곽 꼭짓점'\]/);
  assert.match(source, /dataset\.guide = 'symmetry'/);
  assert.match(source, /dataset\.guide = 'layers'/);
});
