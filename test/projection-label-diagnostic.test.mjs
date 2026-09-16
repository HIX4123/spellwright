import test from 'node:test';
import { readFile } from 'node:fs/promises';
const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
test('print projection labels', () => {
  console.log('PROJECTION_LABELS');
  console.log(JSON.stringify(projections.solids.map(solid => ({
    name: solid.name,
    classes: solid.classes.map(item => ({ id: item.id, label: item.label, role: item.role.name }))
  }))));
});
