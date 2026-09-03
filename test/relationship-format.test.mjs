import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildGraphModel, edgePath, layoutGraph } from '../docs/graph-model.mjs';

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const project = readJson('../docs/data/project.json');
const relationships = readJson('../docs/data/relationships.json');
const theory = readJson('../docs/data/theory.json');

const HIERARCHY_TYPES = new Set(['subtype', 'crosscutting', 'stage', 'stat']);
const effectiveSystems = [...project.systems, ...theory.systems];
const effectiveRelationships = {
  ...relationships,
  hierarchy: [...relationships.hierarchy, ...theory.hierarchy]
};

function uniqueKeys(edges, makeKey, label) {
  const seen = new Set();
  edges.forEach(edge => {
    const key = makeKey(edge);
    assert.equal(seen.has(key), false, `${label} contains duplicate edge ${key}`);
    seen.add(key);
  });
}

function assertAcyclic(edges, label) {
  const adjacency = new Map();
  edges.forEach(({ from, to }) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(to);
  });
  const visiting = new Set();
  const visited = new Set();

  const visit = id => {
    if (visited.has(id)) return;
    assert.equal(visiting.has(id), false, `${label} contains cycle through ${id}`);
    visiting.add(id);
    (adjacency.get(id) || []).forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };

  [...adjacency.keys()].forEach(visit);
}

function pathSegments(path) {
  const tokens = path.match(/[MHV]|-?\d+(?:\.\d+)?/g) || [];
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
    } else if (command === 'V') {
      const next = Number(tokens[index++]);
      segments.push({ axis: 'V', fixed: x, start: Math.min(y, next), end: Math.max(y, next) });
      y = next;
    }
  }
  return segments;
}

test('relationship data keeps each visual edge kind in its canonical container', () => {
  effectiveRelationships.hierarchy.forEach(edge => {
    assert.ok(HIERARCHY_TYPES.has(edge.type), `hierarchy edge ${edge.parent}->${edge.child} uses invalid type ${edge.type}`);
    assert.notEqual(edge.type, 'dependency', 'functional dependency must not be stored in hierarchy');
  });

  relationships.sequence.forEach(edge => {
    assert.equal(edge.type, 'stage-flow', `sequence edge ${edge.from}->${edge.to} must be stage-flow`);
  });

  uniqueKeys(effectiveRelationships.hierarchy, edge => `${edge.parent}->${edge.child}`, 'hierarchy');
  uniqueKeys(relationships.sequence, edge => `${edge.from}->${edge.to}`, 'sequence');
  uniqueKeys(relationships.crossLinks || [], edge => `${edge.from}->${edge.to}`, 'crossLinks');
  uniqueKeys(relationships.suppressedDependencies || [], edge => `${edge.from}->${edge.to}`, 'suppressedDependencies');
});

test('hierarchy is a directed acyclic parent-child structure', () => {
  assertAcyclic(
    effectiveRelationships.hierarchy.map(edge => ({ from: edge.parent, to: edge.child })),
    'hierarchy'
  );
});

test('all graph endpoints and functional dependencies resolve', () => {
  const ids = new Set([
    ...effectiveSystems.map(system => system.id),
    ...(relationships.virtualSystems || []).map(system => system.id)
  ]);

  effectiveRelationships.hierarchy.forEach(edge => {
    assert.ok(ids.has(edge.parent), `unknown hierarchy parent ${edge.parent}`);
    assert.ok(ids.has(edge.child), `unknown hierarchy child ${edge.child}`);
  });
  relationships.sequence.forEach(edge => {
    assert.ok(ids.has(edge.from), `unknown sequence source ${edge.from}`);
    assert.ok(ids.has(edge.to), `unknown sequence target ${edge.to}`);
  });
  (relationships.crossLinks || []).forEach(edge => {
    assert.ok(ids.has(edge.from), `unknown crossLink source ${edge.from}`);
    assert.ok(ids.has(edge.to), `unknown crossLink target ${edge.to}`);
  });
  effectiveSystems.forEach(system => (system.dependencies || []).forEach(parent => {
    assert.ok(ids.has(parent), `${system.id} depends on unknown system ${parent}`);
  }));
});

test('review-stage theory nodes follow the minimal relationship chain', () => {
  assert.equal(theory.schemaVersion, 1);
  assert.equal(theory.status, 'review');
  assert.deepEqual(theory.hierarchy, [
    {
      parent: 'projection-system',
      child: 'projection-operator',
      type: 'subtype',
      note: '사영 연산자는 사영도의 세부 역할을 정의하는 하위 설계 모델이다.'
    }
  ]);

  const byId = new Map(theory.systems.map(system => [system.id, system]));
  assert.deepEqual(byId.get('spell-grammar').dependencies, ['engraving', 'projection-operator']);
  assert.deepEqual(byId.get('effect-graph').dependencies, ['spell-grammar']);
  assert.deepEqual(byId.get('structural-counterplay').dependencies, ['effect-graph']);
  assert.deepEqual(byId.get('spell-naming').dependencies, ['effect-graph']);
});

test('effective graph renders theory relationships with the intended line kinds', () => {
  const active = effectiveSystems.filter(system => system.category !== 'legacy' && system.status !== 'rejected');
  const model = buildGraphModel(active, effectiveRelationships);
  const edge = (from, to) => model.edges.find(item => item.from === from && item.to === to);

  assert.equal(edge('projection-system', 'projection-operator')?.kind, 'hierarchy');
  assert.equal(edge('projection-operator', 'spell-grammar')?.kind, 'dependency');
  assert.equal(edge('spell-grammar', 'effect-graph')?.kind, 'dependency');
  assert.equal(edge('effect-graph', 'structural-counterplay')?.kind, 'dependency');
  assert.equal(edge('effect-graph', 'spell-naming')?.kind, 'dependency');

  ['spell-grammar', 'effect-graph', 'structural-counterplay', 'spell-naming'].forEach(id => {
    assert.equal(model.hierarchy.some(item => item.to === id), false, `${id} must not be rendered as hierarchy`);
  });
});

test('effective graph keeps routed structural edges free of ambiguous crossings and overlaps', () => {
  const active = effectiveSystems.filter(system => system.category !== 'legacy' && system.status !== 'rejected');
  const model = buildGraphModel(active, effectiveRelationships);
  const layout = layoutGraph(model);
  const routed = model.edges
    .filter(edge => !edge.layoutNeutral)
    .map((edge, index) => ({ edge, segments: pathSegments(edgePath(edge, layout, index)) }));

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
