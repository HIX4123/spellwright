import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
const featureJs = await readFile(new URL('../docs/projection-features.js', import.meta.url), 'utf8');
const guideJs = await readFile(new URL('../docs/projection-feature-guides.js', import.meta.url), 'utf8');

test('loads refreshed projection feature, guide, and geometry bundles', () => {
  assert.match(indexHtml, /projection-features\.js\?v=projection-tags-20260916-1/);
  assert.match(indexHtml, /projection-feature-guides\.js\?v=projection-guides-20260916-1/);
  assert.match(featureJs, /projection-geometry-analysis\.js\?v=radial-bands-20260916-1/);
  assert.match(guideJs, /projection-geometry-analysis\.js\?v=radial-bands-20260916-1/);
});
