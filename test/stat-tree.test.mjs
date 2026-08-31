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

test('renders character stats as one ordered compact panel', () => {
  const model = buildGraphModel(active, relationships);
  const layout = layoutGraph(model);
  const statSet = new Set(['character-stats', ...statIds]);

  assert.equal(model.systems.some(system => system.id === 'engraving-speed'), false);
  assert.equal(model.systems.some(system => system.id === 'resonance'), false);

  const circleStat = model.systems.find(system => system.id === 'circle-count');
  assert.equal(circleStat?.name, '서클');
  assert.equal(circleStat?.category, 'character');
  assert.equal(circleStat?.status, 'confirmed');

  assert.deepEqual(model.statGroup?.childIds, statIds);
  assert.equal(model.hierarchy.some(edge => edge.from === 'character-stats' && statIds.includes(edge.to)), false);
  assert.equal(model.edges.some(edge => edge.from === 'character-stats' && statIds.includes(edge.to)), false);

  const root = layout.nodes.get('character-stats');
  const statNodes = statIds.map(id => layout.nodes.get(id));
  assert.equal(layout.statGroup?.w, 220);
  assert.equal(root.x, layout.statGroup?.x);
  assert.equal(root.y, layout.statGroup?.y);
  assert.equal(root.w, layout.statGroup?.w);

  const statX = statNodes.map(node => node?.x);
  assert.equal(new Set(statX).size, 1);
  assert.equal(statX[0], root.x);
  assert.ok(statNodes.every((node, index) => index === 0 || node.y > statNodes[index - 1].y));
  assert.equal(statNodes[0].y, root.y + root.h);

  const nonStatRight = Math.max(...[...layout.nodes]
    .filter(([id]) => !statSet.has(id))
    .map(([, node]) => node.x + node.w));
  const panelRight = layout.statGroup.x + layout.statGroup.w;

  assert.ok(root.x > nonStatRight);
  assert.ok(panelRight - nonStatRight < 390);
  assert.ok(layout.width - nonStatRight < 440);
});

test('keeps only explicit external stat cross-links', () => {
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
