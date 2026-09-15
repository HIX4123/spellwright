import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { geometryForSolid, viewFrame } from '../docs/projection-core.js';
import { analyzeProjectionFeatures } from '../docs/projection-features.js';
import { analyzeProjectionGuides } from '../docs/projection-feature-guides.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));
const prefixes = new Map([
  ['정사면체', '해리'],
  ['정육면체', '소외'],
  ['정팔면체', '초조'],
  ['정십이면체', '고착'],
  ['정이십면체', '반추']
]);

test('diagnostic projection geometry', () => {
  for (const solid of projections.solids) {
    const viewSolid = views.solids.find(item => item.name === solid.name);
    const geometry = geometryForSolid(solid.name);
    for (const item of solid.classes) {
      const view = viewSolid.views.find(candidate => candidate.classId === item.id);
      const frame = viewFrame(view.viewDirection, view.rollDegrees);
      const features = analyzeProjectionFeatures(geometry.vertices, geometry.edges, frame);
      const guides = analyzeProjectionGuides(geometry.vertices, geometry.edges, frame);
      console.log(JSON.stringify({
        name: `${prefixes.get(solid.name)}-${item.role.name}`,
        solid: solid.name,
        classId: item.id,
        crossings: item.crossings,
        symmetryAxes: features.symmetryAxes,
        rotationalOrder: features.rotationalOrder,
        radialLayers: features.radialLayers,
        layerPointCounts: features.layerPointCounts,
        layerRadii: guides.layerRadii.map(value => Number(value.toFixed(6)))
      }));
    }
  }
});
