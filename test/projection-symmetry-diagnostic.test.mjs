import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { geometryForSolid, projectVertices, projectionEvents, viewFrame } from '../docs/projection-core.js';

const projections = JSON.parse(await readFile(new URL('../docs/data/projections.json', import.meta.url), 'utf8'));
const views = JSON.parse(await readFile(new URL('../docs/data/projection-views.json', import.meta.url), 'utf8'));
const targets = new Map([
  ['정육면체', new Set(['재배치'])],
  ['정팔면체', new Set(['분배'])],
  ['정십이면체', new Set(['교환','연쇄','관계 전달','다중 종속','관계망'])],
  ['정이십면체', new Set(['치환','확정'])]
]);

const edgeKey=(a,b)=>a<=b?`${a}:${b}`:`${b}:${a}`;
const norm=a=>{a%=Math.PI;if(a<0)a+=Math.PI;return a};
const adist=(a,b)=>{const d=Math.abs(norm(a)-norm(b));return Math.min(d,Math.PI-d)};

function arrangement(vertices, edges, frame) {
  const points=projectVertices(vertices,frame); const events=projectionEvents(points,edges);
  const nodes=events.map(e=>({xy:e.xy.slice(),vertexMultiplicity:e.vertexIds.size,edgeIds:[...e.edgeIds],degree:0}));
  const segments=new Set();
  edges.forEach(([a,b],ei)=>{
    const p=points[a], q=points[b], dx=q[0]-p[0],dy=q[1]-p[1],l=dx*dx+dy*dy;
    const list=[]; nodes.forEach((n,i)=>{if(n.edgeIds.includes(ei)){const t=((n.xy[0]-p[0])*dx+(n.xy[1]-p[1])*dy)/l;list.push([t,i])}});
    list.sort((x,y)=>x[0]-y[0]); for(let i=1;i<list.length;i++)segments.add(edgeKey(list[i-1][1],list[i][1]));
  });
  for(const k of segments){const [a,b]=k.split(':').map(Number);nodes[a].degree++;nodes[b].degree++}
  const scale=Math.max(1,...nodes.map(n=>Math.hypot(...n.xy))); return {nodes,segments,scale};
}

function transform(angle,[x,y]){const c=Math.cos(2*angle),s=Math.sin(2*angle);return [x*c+y*s,x*s-y*c]}
function sig(node,mode){if(mode==='strict')return `${node.vertexMultiplicity>0?'v':'x'}:${node.vertexMultiplicity}:${node.degree}`;if(mode==='degree')return `${node.degree}`;return '*'}
function mapping(nodes,angle,tol,mode){const map=new Array(nodes.length),used=new Set();for(let i=0;i<nodes.length;i++){const p=transform(angle,nodes[i].xy);let bi=-1,bd=Infinity;for(let j=0;j<nodes.length;j++){if(used.has(j)||sig(nodes[i],mode)!==sig(nodes[j],mode))continue;const d=Math.hypot(nodes[j].xy[0]-p[0],nodes[j].xy[1]-p[1]);if(d<bd){bd=d;bi=j}}if(bi<0||bd>tol)return null;map[i]=bi;used.add(bi)}return map}
function preserves(nodes,segments,angle,tol,mode,requireSegments=true){const map=mapping(nodes,angle,tol,mode);if(!map)return false;if(!requireSegments)return true;for(const k of segments){const[a,b]=k.split(':').map(Number);if(!segments.has(edgeKey(map[a],map[b])))return false}return true}
function axes(nodes,segments,scale,tolFactor,mode,requireSegments=true){const cand=[];const add=a=>{a=norm(a);if(!cand.some(x=>adist(x,a)<1e-5))cand.push(a)};for(let i=0;i<nodes.length;i++){const ai=Math.atan2(nodes[i].xy[1],nodes[i].xy[0]);add(ai);for(let j=i+1;j<nodes.length;j++){if(sig(nodes[i],mode)!==sig(nodes[j],mode))continue;const aj=Math.atan2(nodes[j].xy[1],nodes[j].xy[0]);const b=Math.atan2(Math.sin(ai+aj),Math.cos(ai+aj))/2;add(b);add(b+Math.PI/2)}}const pass=cand.filter(a=>preserves(nodes,segments,a,scale*tolFactor,mode,requireSegments)).sort((a,b)=>a-b);const out=[];for(const a of pass)if(!out.some(x=>adist(x,a)<Math.PI/180))out.push(a);return out.map(a=>Number((a*180/Math.PI).toFixed(2)))}

test('symmetry variants',()=>{for(const solid of projections.solids){const wanted=targets.get(solid.name);if(!wanted)continue;const vs=views.solids.find(v=>v.name===solid.name),g=geometryForSolid(solid.name);for(const item of solid.classes){if(!wanted.has(item.role.name))continue;const v=vs.views.find(x=>x.classId===item.id);const a=arrangement(g.vertices,g.edges,viewFrame(v.viewDirection,v.rollDegrees));const results={};for(const t of [0.003,0.006,0.01,0.02,0.04]){results[`line-strict-${t}`]=axes(a.nodes,a.segments,a.scale,t,'strict',true);results[`line-degree-${t}`]=axes(a.nodes,a.segments,a.scale,t,'degree',true);results[`line-none-${t}`]=axes(a.nodes,a.segments,a.scale,t,'none',true);results[`points-${t}`]=axes(a.nodes,a.segments,a.scale,t,'none',false)}console.log(JSON.stringify({name:`${solid.name}-${item.role.name}`,results}))}}});
