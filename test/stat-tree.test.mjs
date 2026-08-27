import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildGraphModel, layoutGraph } from '../docs/graph-model.mjs';

const project = JSON.parse(readFileSync(new URL('../docs/data/project.json', import.meta.url)));
const relationships = JSON.parse(readFileSync(new URL('../docs/data/relationships.json', import.meta.url)));
const active = project.systems.filter(system => system.category !== 'legacy' && system.status !== 'rejected');

const statIds = [
  'health',
  'mana',
  'circle-count',
  'engraving-capacity',
  'insight',
  'mental-strength',
  'potential'
];

test('renders character stats as a separate ordered tree', () => {
  const model = buildGraphModel(active, relationships);
  const layout = layoutGraph(model);
  const center = id => {
    const node = layout.nodes.get(id);
    return node.x + node.w / 2;
  };

  assert.equal(model.systems.some(system => system.id === 'engraving-speed'), false);
  assert.equal(model.systems.some(system => system.id === 'resonance'), false);

  const circleStat = model.systems.find(system => system.id === 'circle-count');
  assert.equal(circleStat?.name, '서클');
  assert.equal(circleStat?.category, 'character');
  assert.equal(circleStat?.status, 'confirmed');

  const children = model.hierarchy
    .filter(edge => edge.from === 'character-stats')
    .sort((a, b) => a.order - b.order)
    .map(edge => edge.to);
  assert.deepEqual(children, statIds);

  const ranks = statIds.map(id => layout.nodes.get(id)?.rank);
  assert.equal(new Set(ranks).size, 1);
  assert.equal(ranks[0], (layout.nodes.get('character-stats')?.rank ?? -1) + 1);
  assert.ok(center('character-stats') > center('circle'));
});

test('keeps only explicit stat cross-links layout-neutral', () => {
  const model = buildGraphModel(active, relationships);
  const crossLinks = model.dependency.filter(edge => edge.layoutNeutral);

  assert.deepEqual(crossLinks.map(edge => [edge.from, edge.to]), [
    ['circle', 'circle-count'],
    ['circle', 'mana'],
    ['engraving', 'engraving-capacity']
  ]);
  assert.equal(model.rankEdges.some(edge => edge.from === 'integrity' && edge.to === 'mental-strength'), false);
  assert.equal(model.edges.some(edge => edge.from === 'integrity' && edge.to === 'mental-strength'), false);
});
