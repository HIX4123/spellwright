import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { globalProjectionSerialLayout } from '../docs/projection-selector.js';
import { renderAttributeReference } from '../docs/attributes-view.js';

const load=name=>JSON.parse(readFileSync(new URL('../docs/data/'+name+'.json',import.meta.url)));
const project=load('project'), projections=load('projections'), views=load('projection-views');

test('Chojo 3A1 six distinct roots match the original six octahedron serials',()=>{
  const octa=projections.solids.find(s=>s.id==='octahedron');
  const serials=globalProjectionSerialLayout(projections.solids,views.solids).serialsByKey;
  const expected=[
    [1,2,'추진','alpha','positive'],
    [6,441,'제동','alpha','negative'],
    [3,361,'촉진','beta','positive'],
    [4,283,'억제','beta','negative'],
    [5,666,'발산','gamma','positive'],
    [2,461,'수렴','gamma','negative']
  ];
  assert.equal(octa.classes.length,6);
  for(const [classId,serial,name,root,direction] of expected){
    const c=octa.classes.find(x=>x.id===classId);
    assert.equal(serials.get('octahedron:'+classId),serial);
    assert.equal(c.role.name,name);
    assert.equal(c.role.root,root);
    assert.equal(c.role.direction,direction);
    assert.equal(c.role.status,'confirmed');
    assert.ok(c.role.description.length>25);
  }
  const frame=project.elements.find(x=>x.id==='chojo').rootFramework;
  assert.equal(frame.status,'confirmed');
  assert.deepEqual(frame.pairs.map(x=>x.root),['alpha','beta','gamma']);
  assert.match(frame.model,/3A₁/);
  const html=renderAttributeReference(project,'#attributes/wiki/chojo',{projectionData:projections,viewData:views});
  assert.ok(html.includes('href="#attributes/wiki/chojo/operators"'));
  assert.ok(html.includes('id="operators"'));
  assert.ok(html.includes('변화의 축'));
  assert.equal((html.match(/<td>/g)||[]).length,6);
  for(const [,serial,name] of expected)assert.ok(html.includes('#'+String(serial).padStart(3,'0')+' · '+name));
  assert.ok(!html.includes('소외의 6대 연산'));
});
