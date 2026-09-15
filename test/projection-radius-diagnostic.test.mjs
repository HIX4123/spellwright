import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { geometryForSolid, projectVertices, projectionEvents, viewFrame } from '../docs/projection-core.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));
const prefixes = new Map([
  ['정사면체', '해리'], ['정육면체', '소외'], ['정팔면체', '초조'], ['정십이면체', '고착'], ['정이십면체', '반추']
]);
const focus = new Set([
  '해리-분절','해리-차단','초조-정렬','고착-고정','고착-연결','고착-중첩 결속','고착-재배선','고착-교환','고착-상호결속','고착-관계 전달','고착-관계망','고착-결속','반추-보존','반추-유예','반추-분기','반추-선택 유보','반추-재분기','반추-회귀','반추-재선택','반추-재합류','반추-선별'
]);

function cluster(values, tolerance) {
  const groups = [];
  for (const value of values.slice().sort((a,b)=>a-b)) {
    const current = groups.at(-1);
    if (!current || Math.abs(value-current.mean) > tolerance) groups.push({mean:value, values:[value]});
    else { current.values.push(value); current.mean = current.values.reduce((a,b)=>a+b,0)/current.values.length; }
  }
  return groups.map(g => [Number(g.mean.toFixed(6)), g.values.length]);
}

test('inspect all visible point radii', () => {
  for (const solid of projections.solids) {
    const viewSolid = views.solids.find(item => item.name === solid.name);
    const geometry = geometryForSolid(solid.name);
    for (const item of solid.classes) {
      const name = `${prefixes.get(solid.name)}-${item.role.name}`;
      if (!focus.has(name)) continue;
      const view = viewSolid.views.find(candidate => candidate.classId === item.id);
      const frame = viewFrame(view.viewDirection, view.rollDegrees);
      const points = projectVertices(geometry.vertices, frame);
      const events = projectionEvents(points, geometry.edges);
      const radii = events.map(e => Math.hypot(e.xy[0], e.xy[1]));
      const scale = Math.max(...radii, 1);
      console.log(JSON.stringify({name, events: events.length, crossings: item.crossings,
        t1e5: cluster(radii, scale*1e-5),
        t1e4: cluster(radii, scale*1e-4),
        t5e4: cluster(radii, scale*5e-4),
        t1e3: cluster(radii, scale*1e-3),
        t2e3: cluster(radii, scale*2e-3),
        t5e3: cluster(radii, scale*5e-3)
      }));
    }
  }
});
