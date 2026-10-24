import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderMagicTrials } from '../docs/magic-trials-view.js';

const project = JSON.parse(readFileSync(new URL('../docs/data/project.json', import.meta.url), 'utf8'));
const trials = project.magicTrials;

test('nine uniquely keyed cross-media trials have separated verdicts and caveats', () => {
  assert.equal(trials.length, 9);
  assert.equal(new Set(trials.map(x => x.id)).size, 9);
  for (const item of trials) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.ok(['possible', 'conditional', 'deferred', 'excluded'].includes(item.kind));
    for (const key of ['title', 'source', 'verdict', 'summary', 'mechanism', 'unresolved']) {
      assert.ok(typeof item[key] === 'string' && item[key].length >= 3);
    }
  }
  assert.equal(trials.find(x => x.id === 'portal').kind, 'excluded');
  assert.equal(trials.find(x => x.id === 'kyoka-suigetsu').kind, 'deferred');
});

test('trials render as compact expandable items with escaped source text', () => {
  const html = renderMagicTrials(trials);
  assert.equal((html.match(/class="card magic-trial-card"/g) || []).length, 9);
  assert.ok(html.includes('나선환'));
  assert.ok(html.includes('경화수월'));
  assert.ok(html.includes('반추 설계 후 재검증'));
  const escaped = renderMagicTrials([{ title: '<img src=x onerror=alert(1)>', source:'test', verdict:'test', summary:'test', mechanism:'test', unresolved:'test', kind:'conditional' }]);
  assert.ok(!escaped.includes('<img'));
  assert.ok(escaped.includes('&lt;img'));
});
