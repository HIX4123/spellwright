import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

function pathSegments(path) {
  const tokens = path.match(/[MHV]|-?\d+(?:\.\d+)?/g);
  const segments = [];
  let index = 0;
  let x;
  let y;
  while (index < tokens.length) {
    const command = tokens[index++];
    if (command === 'M') {
      x = Number(tokens[index++]);
      y = Number(tokens[index++]);
    } else if (command === 'H') {
      const next = Number(tokens[index++]);
      segments.push({ axis: 'H', fixed: y, start: Math.min(x, next), end: Math.max(x, next) });
      x = next;
    } else {
      const next = Number(tokens[index++]);
      segments.push({ axis: 'V', fixed: x, start: Math.min(y, next), end: Math.max(y, next) });
      y = next;
    }
  }
  return segments;
}

test('uses subtree space and routes the current graph without ambiguous crossings', () => {
  const project = JSON.parse(readFileSync(new URL('../docs/data/project.json', import.meta.url)));
  const graphRelationships = JSON.parse(readFileSync(new URL('../docs/data/relationships.json', import.meta.url)));
  const active = project.systems.filter(system => system.category !== 'legacy' && system.status !== 'rejected');
  const model = buildGraphModel(active, graphRelationships);
  const layout = layoutGraph(model);
  const center = id => layout.nodes.get(id).x + layout.nodes.get(id).w / 2;

  assert.equal(center('circle'), (center('engraving') + center('karma')) / 2);
  assert.equal(center('engraving'), (center('initiation') + center('completion')) / 2);
  const bottomGaps = layout.layers.get(3).slice(1)
    .map((id, index) => center(id) - center(layout.layers.get(3)[index]));
  assert.ok(new Set(bottomGaps).size > 1);

  const routed = model.edges.map((edge, index) => ({
    edge,
    segments: pathSegments(edgePath(edge, layout, index))
  }));
  routed.forEach((left, leftIndex) => routed.slice(leftIndex + 1).forEach(right => {
    const sharesNode = [left.edge.from, left.edge.to]
      .some(id => id === right.edge.from || id === right.edge.to);
    left.segments.forEach(a => right.segments.forEach(b => {
      if (a.axis === b.axis) {
        const overlap = a.fixed === b.fixed && Math.min(a.end, b.end) > Math.max(a.start, b.start);
        assert.ok(sharesNode || !overlap, `${left.edge.from}->${left.edge.to} overlaps ${right.edge.from}->${right.edge.to}`);
        return;
      }
      const horizontal = a.axis === 'H' ? a : b;
      const vertical = a.axis === 'V' ? a : b;
      const crossing = vertical.fixed > horizontal.start && vertical.fixed < horizontal.end
        && horizontal.fixed > vertical.start && horizontal.fixed < vertical.end;
      assert.equal(crossing, false, `${left.edge.from}->${left.edge.to} crosses ${right.edge.from}->${right.edge.to}`);
    }));
  }));
});
