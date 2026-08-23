import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGraphModel, edgePath, layoutGraph } from '../docs/graph-model.mjs';

const systems = [
  { id: 'circle', category: 'magic', dependencies: [] },
  { id: 'engraving', category: 'magic', dependencies: ['circle', 'capacity'] },
  { id: 'capacity', category: 'character', dependencies: ['engraving'] },
  { id: 'initiation', category: 'magic', dependencies: ['engraving'] },
  { id: 'development', category: 'magic', dependencies: ['engraving'] },
  { id: 'completion', category: 'magic', dependencies: ['engraving'] },
  { id: 'hidden', category: 'magic', dependencies: ['circle'] },
  { id: 'isolated', category: 'character', dependencies: [] }
];

const relationships = {
  hierarchy: [
    { parent: 'circle', child: 'engraving', type: 'subtype' },
    { parent: 'engraving', child: 'initiation', type: 'stage', order: 1 },
    { parent: 'engraving', child: 'development', type: 'stage', order: 2 },
    { parent: 'engraving', child: 'completion', type: 'stage', order: 3 }
  ],
  sequence: [
    { from: 'initiation', to: 'development', order: 1 },
    { from: 'development', to: 'completion', order: 2 }
  ],
  hiddenSystems: ['hidden']
};

test('builds one visible graph and collapses mutual dependencies', () => {
  const model = buildGraphModel(systems, relationships);
  assert.equal(model.systems.some(system => system.id === 'hidden'), false);
  assert.equal(model.dependency.filter(edge => edge.mutual).length, 1);
  assert.deepEqual(model.sequence.map(edge => [edge.from, edge.to]), [
    ['initiation', 'development'],
    ['development', 'completion']
  ]);
});

test('keeps stage order stable in a single deterministic layout pass', () => {
  const model = buildGraphModel(systems, relationships);
  const first = layoutGraph(model);
  const second = layoutGraph(model);
  const stages = ['initiation', 'development', 'completion'].map(id => first.nodes.get(id));

  assert.deepEqual([...first.nodes], [...second.nodes]);
  assert.equal(new Set(stages.map(node => node.y)).size, 1);
  assert.ok(stages[0].x < stages[1].x && stages[1].x < stages[2].x);
  model.edges.forEach((edge, index) => assert.match(edgePath(edge, first, index), /^M /));
  first.nodes.forEach(node => {
    assert.ok(Number.isFinite(node.x));
    assert.ok(Number.isFinite(node.y));
  });
});
