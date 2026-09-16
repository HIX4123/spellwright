import test from 'node:test';
import { readFile } from 'node:fs/promises';

const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));
const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));

function normalized(v) {
  const n = Math.hypot(...v);
  return v.map(x => x / n);
}
function projectiveAngleDegrees(a, b) {
  const x = normalized(a), y = normalized(b);
  const dot = Math.min(1, Math.max(-1, x.reduce((s, value, i) => s + value * y[i], 0)));
  return Math.acos(Math.abs(dot)) * 180 / Math.PI;
}

test('diagnose nearest representative view angles', () => {
  for (const solid of views.solids) {
    const meta = projections.solids.find(item => item.name === solid.name);
    const rows = solid.views.map(view => {
      const role = meta.classes.find(item => item.id === view.classId)?.role?.name ?? `#${view.classId}`;
      let nearest = { angle: Infinity, classId: null, role: null };
      for (const other of solid.views) {
        if (other.classId === view.classId) continue;
        const angle = projectiveAngleDegrees(view.viewDirection, other.viewDirection);
        if (angle < nearest.angle) {
          nearest = {
            angle,
            classId: other.classId,
            role: meta.classes.find(item => item.id === other.classId)?.role?.name ?? `#${other.classId}`
          };
        }
      }
      return { classId: view.classId, role, nearest: nearest.role, angle: Number(nearest.angle.toFixed(4)) };
    }).sort((a, b) => a.angle - b.angle);
    console.log(`VIEW-SEPARATION ${solid.name} ${JSON.stringify(rows)}`);
  }
});
