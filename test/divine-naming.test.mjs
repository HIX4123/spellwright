import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const get = async file => JSON.parse(await readFile(new URL('../docs/data/wiki/' + file, import.meta.url), 'utf8'));
const names = [
  ['chronos','크로노스','Chronos',null],
  ['aion','아난타','Ananta','아이온'],
  ['topos','바하','Vaha','토포스'],
  ['zero','헨','Hen','제로'],
  ['ontos','스티','Sti','온토스'],
  ['phantasma','후르칼리아','Hūrqalyā','판타즈마']
];
test('six divine names, cultural origins and legacy wiki IDs',async()=>{
 const index=await get('index.json'), overview=await get('six-beasts.json');
 const ids=new Set(index.documents.map(d=>d.id));
 assert.equal(ids.size,index.documents.length);
 for(const [id,name,latin,former] of names){
  const entry=index.documents.find(d=>d.id===id), doc=await get(id+'.json');
  assert.equal(entry.title,name);
  assert.equal(doc.title,name);
  assert.equal(doc.id,id);
  assert.ok(entry.aliases.includes(latin));
  assert.ok(doc.aliases.includes(latin));
  if(former){assert.ok(entry.aliases.includes(former));assert.ok(doc.aliases.includes(former));}
  assert.equal(doc.sections[0].id,'naming-origin');
  assert.ok(doc.sections[0].items[0].description.length>40);
  assert.ok(JSON.stringify(overview).includes(name));
  for(const related of doc.related)assert.ok(ids.has(related));
 }
 assert.equal(overview.sections.find(s=>s.kind==='pairs').items.length,3);
 assert.ok(overview.sections.some(s=>s.id==='naming-overview'));
 for(const old of ['아이온','토포스','제로','온토스','판타즈마'])assert.equal(JSON.stringify(overview).includes(old),false);
});
