(() => {
  const NODE_W = 148;
  const NODE_H = 58;
  const GAP_X = 26;
  const RANK_GAP = 78;
  const MARGIN_X = 26;
  const MARGIN_TOP = 24;
  const ISOLATED_GAP = 48;
  let scheduled = false;
  const observedHosts = new WeakSet();

  function edgeModel(root) {
    const edges = [...root.querySelectorAll('.compact-edge[data-from][data-to]')].map(path => ({
      path,
      from: path.dataset.from,
      to: path.dataset.to,
      type: path.classList.contains('hierarchy') ? 'hierarchy' : 'dependency',
      mutual: path.classList.contains('mutual')
    }));
    root.querySelectorAll('.family-trunk').forEach(path => { path.style.display = 'none'; });
    return edges;
  }

  function scc(ids, edges) {
    const adj = new Map(ids.map(id => [id, []]));
    edges.forEach(edge => {
      adj.get(edge.from)?.push(edge.to);
      if (edge.mutual) adj.get(edge.to)?.push(edge.from);
    });
    let nextIndex = 0;
    const indices = new Map(), low = new Map(), stack = [], onStack = new Set(), components = [];
    function visit(id) {
      indices.set(id, nextIndex); low.set(id, nextIndex++); stack.push(id); onStack.add(id);
      for (const next of adj.get(id) || []) {
        if (!indices.has(next)) { visit(next); low.set(id, Math.min(low.get(id), low.get(next))); }
        else if (onStack.has(next)) low.set(id, Math.min(low.get(id), indices.get(next)));
      }
      if (low.get(id) === indices.get(id)) {
        const component = [];
        while (stack.length) {
          const node = stack.pop(); onStack.delete(node); component.push(node);
          if (node === id) break;
        }
        components.push(component);
      }
    }
    ids.forEach(id => { if (!indices.has(id)) visit(id); });
    const componentOf = new Map();
    components.forEach((component, index) => component.forEach(id => componentOf.set(id, index)));
    return { components, componentOf };
  }

  function ranksFor(ids, edges) {
    const { components, componentOf } = scc(ids, edges);
    const children = new Map(components.map((_, i) => [i, new Set()]));
    const indegree = new Map(components.map((_, i) => [i, 0]));
    edges.forEach(edge => {
      const a = componentOf.get(edge.from), b = componentOf.get(edge.to);
      if (a === b || children.get(a)?.has(b)) return;
      children.get(a).add(b); indegree.set(b, indegree.get(b) + 1);
    });
    const queue = [...indegree].filter(([, d]) => d === 0).map(([id]) => id);
    const rank = new Map(components.map((_, i) => [i, 0]));
    while (queue.length) {
      const id = queue.shift();
      for (const child of children.get(id) || []) {
        rank.set(child, Math.max(rank.get(child), rank.get(id) + 1));
        indegree.set(child, indegree.get(child) - 1);
        if (indegree.get(child) === 0) queue.push(child);
      }
    }
    return new Map(ids.map(id => [id, rank.get(componentOf.get(id)) || 0]));
  }

  function positions(layers) {
    const pos = new Map(), norm = new Map();
    layers.forEach(ids => ids.forEach((id, index) => {
      pos.set(id, index); norm.set(id, ids.length <= 1 ? .5 : index / (ids.length - 1));
    }));
    return { pos, norm };
  }

  function score(layers, ranks, edges) {
    const { pos, norm } = positions(layers);
    let total = 0;
    const cross = edges.filter(e => ranks.get(e.from) !== ranks.get(e.to));
    for (let i = 0; i < cross.length; i += 1) for (let j = i + 1; j < cross.length; j += 1) {
      const a = cross[i], b = cross[j];
      if (ranks.get(a.from) !== ranks.get(b.from) || ranks.get(a.to) !== ranks.get(b.to)) continue;
      if ([a.from, a.to].some(id => id === b.from || id === b.to)) continue;
      if ((pos.get(a.from) - pos.get(b.from)) * (pos.get(a.to) - pos.get(b.to)) < 0)
        total += 10000 * ((a.type === 'hierarchy' ? 4 : 1) + (b.type === 'hierarchy' ? 4 : 1));
    }
    edges.forEach(edge => {
      if (ranks.get(edge.from) === ranks.get(edge.to)) {
        const span = Math.abs(pos.get(edge.from) - pos.get(edge.to));
        if (edge.type === 'dependency') total += span * 1200 + Math.max(0, span - 1) * 8000;
      } else {
        total += Math.abs((norm.get(edge.from) ?? .5) - (norm.get(edge.to) ?? .5)) * (edge.type === 'hierarchy' ? 18 : 5);
      }
    });
    const children = new Map();
    edges.filter(e => e.type === 'hierarchy').forEach(e => {
      if (!children.has(e.from)) children.set(e.from, []); children.get(e.from).push(e.to);
    });
    children.forEach((ids, parent) => {
      const same = ids.filter(id => ranks.get(id) === ranks.get(ids[0]));
      if (same.length > 1) {
        const ps = same.map(id => pos.get(id)).sort((a,b) => a-b);
        total += Math.max(0, ps.at(-1) - ps[0] - (ps.length - 1)) * 12000;
      }
      if (same.length) total += Math.abs((norm.get(parent) ?? .5) - same.reduce((s,id)=>s+(norm.get(id)??.5),0)/same.length) * 100;
    });
    return total;
  }

  function optimize(ids, ranks, edges, sourceOrder) {
    const layers = new Map();
    ids.forEach(id => { const r = ranks.get(id)||0; if (!layers.has(r)) layers.set(r, []); layers.get(r).push(id); });
    layers.forEach(list => list.sort((a,b)=>sourceOrder.get(a)-sourceOrder.get(b)));
    const neighbors = new Map(ids.map(id => [id, []]));
    edges.forEach(e => { if (ranks.get(e.from) !== ranks.get(e.to)) { neighbors.get(e.from)?.push(e.to); neighbors.get(e.to)?.push(e.from); } });
    for (let pass=0; pass<6; pass++) {
      for (const downward of [true,false]) {
        const order=[...layers.keys()].sort((a,b)=>downward?a-b:b-a); const {norm}=positions(layers);
        order.forEach(rank => layers.get(rank).sort((a,b) => {
          const bary = id => {
            const ns=(neighbors.get(id)||[]).filter(n=>downward?ranks.get(n)<rank:ranks.get(n)>rank).map(n=>norm.get(n));
            return ns.length?ns.reduce((x,y)=>x+y,0)/ns.length:Infinity;
          };
          return bary(a)-bary(b) || sourceOrder.get(a)-sourceOrder.get(b);
        }));
      }
    }
    let best=score(layers,ranks,edges);
    for(let pass=0;pass<12;pass++){
      let improved=false;
      for(const rank of [...layers.keys()].sort((a,b)=>a-b)){
        const list=layers.get(rank);
        for(let i=0;i<list.length-1;i++){
          [list[i],list[i+1]]=[list[i+1],list[i]]; const s=score(layers,ranks,edges);
          if(s<best-.001){best=s;improved=true;} else [list[i],list[i+1]]=[list[i+1],list[i]];
        }
      }
      if(!improved)break;
    }
    return layers;
  }

  function fitCenters(layers, ranks, edges, width) {
    const centers=new Map();
    layers.forEach(list=>{const rowW=list.length*NODE_W+Math.max(0,list.length-1)*GAP_X;let x=(width-rowW)/2+NODE_W/2;list.forEach(id=>{centers.set(id,x);x+=NODE_W+GAP_X;});});
    const neighbors=new Map();
    edges.filter(e=>ranks.get(e.from)!==ranks.get(e.to)).forEach(e=>{
      const w=e.type==='hierarchy'?5:2;
      if(!neighbors.has(e.from))neighbors.set(e.from,[]); if(!neighbors.has(e.to))neighbors.set(e.to,[]);
      neighbors.get(e.from).push([e.to,w]); neighbors.get(e.to).push([e.from,w]);
    });
    const min=MARGIN_X+NODE_W/2,max=width-MARGIN_X-NODE_W/2,sep=NODE_W+GAP_X;
    function fit(list,desired){
      const xs=list.map(id=>Math.max(min,Math.min(max,desired.get(id)??centers.get(id))));
      for(let i=1;i<xs.length;i++)xs[i]=Math.max(xs[i],xs[i-1]+sep);
      if(xs.at(-1)>max){xs[xs.length-1]=max;for(let i=xs.length-2;i>=0;i--)xs[i]=Math.min(xs[i],xs[i+1]-sep);}
      if(xs[0]<min){const d=min-xs[0];for(let i=0;i<xs.length;i++)xs[i]+=d;}
      list.forEach((id,i)=>centers.set(id,xs[i]));
    }
    const ranksList=[...layers.keys()].sort((a,b)=>a-b);
    for(let pass=0;pass<8;pass++) for(const order of [ranksList,[...ranksList].reverse()]) order.forEach(rank=>{
      const desired=new Map();
      layers.get(rank).forEach(id=>{let sum=centers.get(id),ws=1;(neighbors.get(id)||[]).forEach(([n,w])=>{sum+=centers.get(n)*w;ws+=w;});desired.set(id,sum/ws);});
      fit(layers.get(rank),desired);
    });
    return centers;
  }

  function crosses(a,b,geom,ranks){
    if(ranks.get(a.from)===ranks.get(a.to)||ranks.get(b.from)===ranks.get(b.to))return false;
    if(ranks.get(a.from)!==ranks.get(b.from)||ranks.get(a.to)!==ranks.get(b.to))return false;
    if([a.from,a.to].some(id=>id===b.from||id===b.to))return false;
    return (geom.get(a.from).cx-geom.get(b.from).cx)*(geom.get(a.to).cx-geom.get(b.to).cx)<0;
  }

  function patchMap(root) {
    const map=root.querySelector('.compact-map'), svg=root.querySelector('.compact-lines');
    if(!map||!svg)return;
    const nodes=[...root.querySelectorAll('.compact-node')]; if(!nodes.length)return;
    const nodeById=new Map(nodes.map((node,index)=>[node.dataset.id,{node,index}]));
    const edges=edgeModel(root).filter(e=>nodeById.has(e.from)&&nodeById.has(e.to));
    const incident=new Set(); edges.forEach(e=>{incident.add(e.from);incident.add(e.to);});
    const connected=nodes.map(n=>n.dataset.id).filter(id=>incident.has(id)); const isolated=nodes.map(n=>n.dataset.id).filter(id=>!incident.has(id));
    const sourceOrder=new Map(nodes.map((n,i)=>[n.dataset.id,i])); const ranks=ranksFor(connected,edges); const layers=optimize(connected,ranks,edges,sourceOrder);
    const maxCount=Math.max(1,...[...layers.values()].map(x=>x.length)); const host=root.parentElement?.clientWidth||900;
    const width=Math.max(620,host,MARGIN_X*2+maxCount*NODE_W+Math.max(0,maxCount-1)*GAP_X); const centers=fitCenters(layers,ranks,edges,width);
    const geom=new Map(); let y=MARGIN_TOP; const maxRank=connected.length?Math.max(...connected.map(id=>ranks.get(id)||0)):-1;
    for(let rank=0;rank<=maxRank;rank++){
      (layers.get(rank)||[]).forEach(id=>{const x=(centers.get(id)??width/2)-NODE_W/2;geom.set(id,{x,y,w:NODE_W,h:NODE_H,cx:x+NODE_W/2,rank});}); y+=NODE_H+RANK_GAP;
    }
    let isolatedTop=null;
    if(isolated.length){isolatedTop=y+ISOLATED_GAP; y=isolatedTop+28; const cols=Math.max(1,Math.floor((width-MARGIN_X*2+GAP_X)/(NODE_W+GAP_X)));
      isolated.forEach((id,index)=>{const row=Math.floor(index/cols),col=index%cols,count=Math.min(cols,isolated.length-row*cols),rowW=count*NODE_W+Math.max(0,count-1)*GAP_X,start=(width-rowW)/2,x=start+col*(NODE_W+GAP_X);geom.set(id,{x,y:y+row*(NODE_H+12),w:NODE_W,h:NODE_H,cx:x+NODE_W/2,rank:null});}); y+=Math.ceil(isolated.length/cols)*(NODE_H+12);
    }
    nodes.forEach(node=>{const g=geom.get(node.dataset.id);if(!g)return;Object.assign(node.style,{left:`${g.x}px`,top:`${g.y}px`,width:`${NODE_W}px`,height:`${NODE_H}px`});});
    map.style.width=`${width}px`; map.style.height=`${Math.max(230,y+22)}px`; svg.setAttribute('viewBox',`0 0 ${width} ${Math.max(230,y+22)}`);
    const label=root.querySelector('.isolated-label'); if(label){ if(isolatedTop===null)label.style.display='none'; else {label.style.display='';label.style.top=`${isolatedTop}px`;}}

    const layerIndex=new Map();layers.forEach(list=>list.forEach((id,i)=>layerIndex.set(id,i)));
    const visible=[...edges.filter(e=>e.type==='hierarchy')]; let longChannel=0; const trackCount=new Map();
    edges.forEach(edge=>{
      const a=geom.get(edge.from),b=geom.get(edge.to); if(!a||!b)return; edge.path.classList.remove('focus-only'); edge.path.style.display='';
      if(edge.type==='hierarchy'){
        const above=a.y<=b.y,sy=above?a.y+a.h:a.y,ey=above?b.y:b.y+b.h; edge.path.setAttribute('d',`M ${a.cx} ${sy} L ${b.cx} ${ey}`); return;
      }
      const same=a.rank!==null&&a.rank===b.rank; let focusOnly=false,d='';
      if(same){const adjacent=Math.abs((layerIndex.get(edge.from)??0)-(layerIndex.get(edge.to)??0))===1;focusOnly=!adjacent;
        if(adjacent){const left=a.x<=b.x?a:b,right=a.x<=b.x?b:a,cy=left.y+left.h/2;d=`M ${left.x+left.w} ${cy} H ${right.x}`;}
        else{const ch=trackCount.get(a.rank)||0;trackCount.set(a.rank,ch+1);const ty=a.y+a.h+18+ch*8;d=`M ${a.cx} ${a.y+a.h} V ${ty} H ${b.cx} V ${b.y+b.h}`;}
      }else{
        const span=Math.abs((a.rank??0)-(b.rank??0)); if(span===1){focusOnly=visible.some(other=>crosses(edge,other,geom,ranks));if(!focusOnly)visible.push(edge);const above=a.y<b.y,sy=above?a.y+a.h:a.y,ey=above?b.y:b.y+b.h;d=`M ${a.cx} ${sy} L ${b.cx} ${ey}`;}
        else{focusOnly=true;const above=a.y<b.y,sy=above?a.y+a.h:a.y,ey=above?b.y:b.y+b.h,y1=sy+(above?18:-18),y2=ey+(above?-18:18),cx=width-12-(longChannel++%5)*8;d=`M ${a.cx} ${sy} V ${y1} H ${cx} V ${y2} H ${b.cx} V ${ey}`;}
      }
      edge.path.setAttribute('d',d); if(focusOnly)edge.path.classList.add('focus-only');
    });
    const note=root.parentElement?.previousElementSibling;
    if(note?.classList.contains('map-note')) note.innerHTML='<span>위 → 아래 = 관계 흐름</span><span>교차 없는 관계선을 우선 표시 · 숨은 기능선은 노드 선택 시 표시</span>';
    root.dataset.clarityLayout='1';
  }

  const ro=new ResizeObserver(schedule);
  function patchAll(){document.querySelectorAll('.compact-map-root').forEach(root=>{const host=root.parentElement;if(host&&!observedHosts.has(host)){observedHosts.add(host);ro.observe(host);}patchMap(root);});}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patchAll();});}
  const view=document.getElementById('view'); if(view)new MutationObserver(schedule).observe(view,{childList:true,subtree:true});
  window.addEventListener('resize',schedule,{passive:true}); window.addEventListener('DOMContentLoaded',schedule); schedule();
})();