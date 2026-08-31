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

test('renders character stats as a separate ordered compact tree', () => {
  const model = buildGraphModel(active, relationships);
  const layout = layoutGraph(model);
  const statSet = new Set(['character-stats', ...statIds]);

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

  const root = layout.nodes.get('character-stats');
  const statNodes = statIds.map(id => layout.nodes.get(id));
  const ranks = statNodes.map(node => node?.rank);
  assert.equal(new Set(ranks).size, 1);
  assert.equal(ranks[0], (root?.rank ?? -1) + 1);

  const statX = statNodes.map(node => node?.x);
  assert.equal(new Set(statX).size, 1);
  assert.ok(statNodes.every((node, index) => index === 0 || node.y > statNodes[index - 1].y));
  assert.equal(root.x, statX[0]);

  const nonStatRight = Math.max(...[...layout.nodes]
    .filter(([id]) => !statSet.has(id))
    .map(([, node]) => node.x + node.w));
  const statRight = Math.max(root.x + root.w, ...statNodes.map(node => node.x + node.w));

  assert.ok(root.x > nonStatRight);
  assert.ok(statRight - nonStatRight < 320);
  assert.ok(layout.width - nonStatRight < 380);
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
