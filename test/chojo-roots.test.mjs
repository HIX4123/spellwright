import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { globalProjectionSerialLayout } from '../docs/projection-selector.js';

test('Chojo selected serials correspond to its six octahedron classes', () => {
  const projections=JSON.parse(readFileSync(new URL('../docs/data/projections.json', import.meta.url)));
  const views=JSON.parse(readFileSync(new URL('../docs/data/projection-views.json', import.meta.url)));
  const serials=globalProjectionSerialLayout(projections.solids,views.solids).serialsByKey;
  const octa=projections.solids.find(s=>s.id==='octahedron');
  const mapping=octa.classes.map(c=>({classId:c.id,serial:serials.get('octahedron:'+c.id)})).sort((a,b)=>a.serial-b.serial);
  console.log('CHOJO_SERIAL_MAPPING',JSON.stringify(mapping));
  assert.deepEqual(mapping.map(v=>v.serial),[2,283,361,441,461,666]);
});
