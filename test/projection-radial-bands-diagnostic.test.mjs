import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { geometryForSolid, projectVertices, projectionEvents, viewFrame } from '../docs/projection-core.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));

function bandsFor(nodes, factor) {
  const scale = Math.max(1, ...nodes.map(node => Math.hypot(node.xy[0], node.xy[1])));
  const tolerance = scale * factor;
  const sorted = nodes.map((node, index) => ({ index, radius: Math.hypot(node.xy[0], node.xy[1]) }))
    .sort((a, b) => a.radius - b.radius);
  const bands = [];
  for (const item of sorted) {
    const current = bands.at(-1);
    if (!current || Math.abs(item.radius - current.mean) > tolerance) {
      bands.push({ mean: item.radius, radii: [item.radius] });
    } else {
      current.radii.push(item.radius);
      current.mean = current.radii.reduce((sum, value) => sum + value, 0) / current.radii.length;
    }
  }
  return bands.map(band => ({
    radius: Number(band.mean.toFixed(6)),
    count: band.radii.length,
    spread: Number((Math.max(...band.radii) - Math.min(...band.radii)).toFixed(6))
  }));
}

test('inspect radial bands from all visible points', () => {
  for (const solid of projections.solids) {
    const viewSolid = views.solids.find(item => item.name === solid.name);
    const geometry = geometryForSolid(solid.name);
    for (const item of solid.classes) {
      const view = viewSolid.views.find(candidate => candidate.classId === item.id);
      const frame = viewFrame(view.viewDirection, view.rollDegrees);
      const points = projectVertices(geometry.vertices, frame);
      const nodes = projectionEvents(points, geometry.edges).map(event => ({ xy: event.xy }));
      console.log(JSON.stringify({
        name: `${solid.name}-${item.role.name}`,
        visible: nodes.length,
        f0005: bandsFor(nodes, 0.0005),
        f001: bandsFor(nodes, 0.001),
        f002: bandsFor(nodes, 0.002),
        f005: bandsFor(nodes, 0.005)
      }));
    }
  }
});
