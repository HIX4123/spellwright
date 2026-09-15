import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { geometryForSolid, viewFrame } from '../docs/projection-core.js';
import { analyzeProjectionStructure } from '../docs/projection-geometry-analysis.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));
const targets = new Map([
  ['정육면체', new Set(['재배치'])], ['정팔면체', new Set(['분배'])],
  ['정십이면체', new Set(['교환','연쇄','관계 전달','다중 종속','관계망'])],
  ['정이십면체', new Set(['치환','확정'])]
]);
const norm=a=>{a%=Math.PI;if(a<0)a+=Math.PI;return a};
const ad=(a,b)=>{const d=Math.abs(norm(a)-norm(b));return Math.min(d,Math.PI-d)};
const wrap=a=>{a%=Math.PI*2;if(a<0)a+=Math.PI*2;return a};
const circ=(a,b)=>{const d=Math.abs(wrap(a)-wrap(b));return Math.min(d,Math.PI*2-d)};

function axes(structure,tolDeg,byLayer){
  const tol=tolDeg*Math.PI/180;
  const layerOf=new Map(); structure.layers.forEach((layer,li)=>layer.forEach(i=>layerOf.set(i,li)));
  const nodes=structure.nodes; const cand=[]; const add=a=>{a=norm(a);if(!cand.some(x=>ad(x,a)<1e-5))cand.push(a)};
  const angles=nodes.map(n=>Math.atan2(n.xy[1],n.xy[0]));
  for(let i=0;i<nodes.length;i++){add(angles[i]);for(let j=i+1;j<nodes.length;j++){if(byLayer&&layerOf.get(i)!==layerOf.get(j))continue;let b=Math.atan2(Math.sin(angles[i]+angles[j]),Math.cos(angles[i]+angles[j]))/2;add(b);add(b+Math.PI/2)}}
  const good=cand.filter(axis=>{const used=new Set();for(let i=0;i<nodes.length;i++){const target=wrap(2*axis-angles[i]);let bi=-1,bd=Infinity;for(let j=0;j<nodes.length;j++){if(used.has(j)||(byLayer&&layerOf.get(i)!==layerOf.get(j)))continue;const d=circ(target,angles[j]);if(d<bd){bd=d;bi=j}}if(bi<0||bd>tol)return false;used.add(bi)}return true});
  const out=[];for(const a of good.sort((a,b)=>a-b))if(!out.some(x=>ad(x,a)<Math.PI/180))out.push(a);return out.map(a=>Number((a*180/Math.PI).toFixed(2)));
}

test('angular symmetry variants',()=>{for(const solid of projections.solids){const wanted=targets.get(solid.name);if(!wanted)continue;const vs=views.solids.find(v=>v.name===solid.name),g=geometryForSolid(solid.name);for(const item of solid.classes){if(!wanted.has(item.role.name))continue;const v=vs.views.find(x=>x.classId===item.id);const s=analyzeProjectionStructure(g.vertices,g.edges,viewFrame(v.viewDirection,v.rollDegrees));console.log(JSON.stringify({name:`${solid.name}-${item.role.name}`,layer1:axes(s,1,true),layer3:axes(s,3,true),all1:axes(s,1,false),all3:axes(s,3,false)}))}}});
