import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { geometryForSolid, viewFrame } from '../docs/projection-core.js';
import { analyzeProjectionFeatures } from '../docs/projection-features.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));

test('print general-cell features after representative separation', () => {
  const output = [];
  for (const solid of projections.solids) {
    const geometry = geometryForSolid(solid.name);
    const viewSolid = views.solids.find(item => item.name === solid.name);
    for (const item of solid.classes.filter(item => item.label === '일반 셀')) {
      const view = viewSolid.views.find(candidate => candidate.classId === item.id);
      const features = analyzeProjectionFeatures(
        geometry.vertices,
        geometry.edges,
        viewFrame(view.viewDirection, view.rollDegrees)
      );
      output.push({
        solid: solid.name,
        id: item.id,
        role: item.role.name,
        radialLayers: features.radialLayers,
        layerPointCounts: features.layerPointCounts,
        symmetryAxes: features.symmetryAxes,
        rotationalOrder: features.rotationalOrder,
        centerStructure: features.centerStructure
      });
    }
  }
  console.log('GENERAL_CELL_FEATURES');
  console.log(JSON.stringify(output));
});
