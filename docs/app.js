let data;
let currentView = 'overview';
let dirty = false;

const $ = (q) => document.querySelector(q);
const view = $('#view');
const dialog = $('#editorDialog');

const navItems = [
  ['overview','Overview'], ['systems','Systems'], ['combat','Combat'], ['attributes','Attributes'],
  ['mvp','MVP'], ['decisions','Decisions'], ['graveyard','Graveyard'], ['questions','Open Questions']
];

const graphCategoryOrder = ['attribute', 'magic', 'character', 'combat', 'roguelite'];

async function load() {
  const res = await fetch('./data/project.json', { cache: 'no-store' });
  const remote = await res.json();
  const draft = localStorage.getItem('spellwright-project-draft');

  if (draft) {
    try {
      const parsed = JSON.parse(draft);
      data = parsed?.project?.schemaVersion === remote?.project?.schemaVersion ? parsed : remote;
      if (data === remote) localStorage.removeItem('spellwright-project-draft');
    } catch {
      data = remote;
    }
  } else {
    data = remote;
  }

  $('#projectName').textContent = data.project.name;
  $('#version').textContent = `${data.project.version} · ${data.project.phase}`;
  renderNav();
  render();

  if (!document.querySelector('#resetDraftBtn')) {
    const btn = document.createElement('button');
    btn.id = 'resetDraftBtn';
    btn.className = 'ghost';
    btn.textContent = 'Use repository data';
    btn.onclick = () => {
      localStorage.removeItem('spellwright-project-draft');
      location.reload();
    };
    document.querySelector('.sidebar-footer').prepend(btn);
  }
}

function renderNav() {
  $('#nav').innerHTML = navItems
    .map(([id,label]) => `<button class="nav-btn ${id===currentView?'active':''}" data-view="${id}">${label}</button>`)
    .join('');

  document.querySelectorAll('.nav-btn').forEach(btn => btn.onclick = () => {
    currentView = btn.dataset.view;
    renderNav();
    render();
  });
}

function statusMeta(id) {
  return data.statuses.find(s => s.id === id) || {icon:'?',label:id};
}

function statusBadge(id) {
  const s = statusMeta(id);
  return `<span class="status ${id}">${s.icon} ${s.label}</span>`;
}

function categoryLabel(id) {
  return ({
    magic:'Magic',
    combat:'Combat',
    character:'Character',
    attribute:'Attribute',
    roguelite:'Roguelite',
    legacy:'Legacy'
  })[id] || id;
}

function section(title, subtitle='') {
  return `<div class="section-head"><h2>${title}</h2><p>${subtitle}</p></div>`;
}

function escapeHtml(value='') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render() {
  const fn = ({
    overview:renderOverview,
    systems:renderSystems,
    combat:renderCombat,
    attributes:renderAttributes,
    mvp:renderMvp,
    decisions:renderDecisions,
    graveyard:renderGraveyard,
    questions:renderQuestions
  })[currentView];
  fn();
}

function renderOverview() {
  const counts = Object.fromEntries(
    data.statuses.map(s => [s.id, data.systems.filter(x => x.status===s.id).length])
  );

  view.innerHTML = `
    <div class="grid cols-4">
      <div class="card metric"><span>Confirmed systems</span><strong>${counts.confirmed}</strong></div>
      <div class="card metric"><span>Open / review</span><strong>${counts.undecided + counts.review}</strong></div>
      <div class="card metric"><span>Projection classes</span><strong>${data.elements.reduce((a,e)=>a+e.projectionClasses,0)}</strong></div>
      <div class="card metric"><span>Current priority</span><strong>P${data.priorities[0].rank}</strong></div>
    </div>
    ${section('Core identity', data.project.updatedAt)}
    <div class="card">
      <p class="core-statement">${data.project.coreStatement}</p>
      <p class="muted" style="margin:16px 0 0">MVP question · ${data.project.mvpQuestion}</p>
    </div>
    ${section('Current priorities','세부 시스템은 Systems 관계 맵에서 확인')}
    <div class="grid cols-2">${data.priorities.map(priorityCard).join('')}</div>
    ${section('Recent decisions')}
    <div class="card timeline">${data.decisions.slice(0,4).map(decisionRow).join('')}</div>
  `;
}

function priorityCard(p) {
  return `<div class="card priority"><div class="rank">${p.rank}</div><div><h3>${p.title}</h3><p>${p.description}</p></div>${statusBadge(p.status)}</div>`;
}

function decisionRow(d) {
  return `<div class="decision"><div class="date">${d.date}<br>${d.version}</div><div class="type">${d.type}</div><div><h3>${d.title}</h3><p>${d.reason}</p></div></div>`;
}

function activeSystems() {
  return data.systems.filter(x => x.category !== 'legacy' && x.status !== 'rejected');
}

function renderSystems() {
  view.innerHTML = `
    <div class="toolbar">
      <input id="search" placeholder="시스템 검색…" />
      <select id="statusFilter"><option value="">모든 상태</option>${data.statuses.filter(s=>s.id!=='rejected').map(s=>`<option value="${s.id}">${s.icon} ${s.label}</option>`).join('')}</select>
      <select id="categoryFilter"><option value="">모든 카테고리</option>${graphCategoryOrder.map(c=>`<option value="${c}">${categoryLabel(c)}</option>`).join('')}</select>
    </div>
    <div class="map-note"><span>선택한 개념과 직접 연결된 관계를 강조한다.</span><span>A → B : A가 B에 의존</span></div>
    <div id="systemMap"></div>`;

  const refresh = () => {
    const q = $('#search').value.trim().toLowerCase();
    const st = $('#statusFilter').value;
    const cat = $('#categoryFilter').value;
    const list = activeSystems().filter(x => {
      const haystack = `${x.name} ${x.definition || ''} ${x.details || ''}`.toLowerCase();
      return (!q || haystack.includes(q)) && (!st || x.status===st) && (!cat || x.category===cat);
    });
    renderSystemMap($('#systemMap'), list);
  };

  ['search','statusFilter','categoryFilter'].forEach(id => $(`#${id}`).oninput = refresh);
  refresh();
}

function graphLayout(systems) {
  const nodeW = 220;
  const nodeH = 76;
  const colGap = 72;
  const rowGap = 26;
  const marginX = 32;
  const marginY = 48;
  const categories = graphCategoryOrder.filter(c => systems.some(s => s.category === c));
  const byCategory = Object.fromEntries(categories.map(c => [c, systems.filter(s => s.category === c)]));
  const maxRows = Math.max(1, ...categories.map(c => byCategory[c].length));
  const width = Math.max(760, marginX * 2 + categories.length * nodeW + Math.max(0, categories.length - 1) * colGap);
  const height = Math.max(360, marginY * 2 + maxRows * nodeH + Math.max(0, maxRows - 1) * rowGap);
  const nodes = new Map();

  categories.forEach((category, col) => {
    const items = byCategory[category];
    const blockHeight = items.length * nodeH + Math.max(0, items.length - 1) * rowGap;
    const startY = Math.max(marginY, (height - blockHeight) / 2);
    items.forEach((item, row) => {
      nodes.set(item.id, {
        x: marginX + col * (nodeW + colGap),
        y: startY + row * (nodeH + rowGap),
        w: nodeW,
        h: nodeH
      });
    });
  });

  return { width, height, nodes, categories, nodeW, nodeH };
}

function renderSystemMap(container, systems) {
  if (!systems.length) {
    container.innerHTML = '<div class="map-empty">일치하는 시스템이 없다.</div>';
    return;
  }

  const layout = graphLayout(systems);
  const visibleIds = new Set(systems.map(s => s.id));
  const edges = [];

  systems.forEach(from => {
    (from.dependencies || []).forEach(toId => {
      if (visibleIds.has(toId) && layout.nodes.has(from.id) && layout.nodes.has(toId)) {
        edges.push({ from: from.id, to: toId });
      }
    });
  });

  const headers = layout.categories.map(category => {
    const first = [...layout.nodes.entries()].find(([id]) => systems.find(s => s.id === id)?.category === category);
    if (!first) return '';
    return `<div class="map-category" style="left:${first[1].x}px">${categoryLabel(category)}</div>`;
  }).join('');

  const edgeSvg = edges.map(edge => {
    const a = layout.nodes.get(edge.from);
    const b = layout.nodes.get(edge.to);
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const dx = bx - ax;
    const startX = dx >= 0 ? a.x + a.w : a.x;
    const endX = dx >= 0 ? b.x : b.x + b.w;
    const c1x = startX + dx * .38;
    const c2x = endX - dx * .38;
    return `<path class="map-edge" data-from="${edge.from}" data-to="${edge.to}" d="M ${startX} ${ay} C ${c1x} ${ay}, ${c2x} ${by}, ${endX} ${by}" marker-end="url(#mapArrow)" />`;
  }).join('');

  const nodeHtml = systems.map(system => {
    const p = layout.nodes.get(system.id);
    const status = statusMeta(system.status);
    return `<button class="map-node" data-id="${system.id}" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px">
      <span class="map-node-meta">${escapeHtml(status.icon)} ${escapeHtml(status.label)}</span>
      <strong>${escapeHtml(system.name)}</strong>
      <span class="map-node-preview">${escapeHtml(system.definition || '')}</span>
    </button>`;
  }).join('');

  container.innerHTML = `<div class="system-map-scroll">
    <div class="system-map" style="width:${layout.width}px;height:${layout.height}px">
      ${headers}
      <svg class="map-lines" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">
        <defs><marker id="mapArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L8,4 L0,8 Z" class="map-arrow" /></marker></defs>
        ${edgeSvg}
      </svg>
      ${nodeHtml}
    </div>
  </div>`;

  bindMapInteractions(container, systems, edges);
}

function bindMapInteractions(container, systems, edges) {
  const nodes = [...container.querySelectorAll('.map-node')];
  const edgeEls = [...container.querySelectorAll('.map-edge')];

  const clear = () => {
    nodes.forEach(n => n.classList.remove('focus', 'dim'));
    edgeEls.forEach(e => e.classList.remove('focus', 'dim'));
  };

  const focus = id => {
    const related = new Set([id]);
    edges.forEach(e => {
      if (e.from === id) related.add(e.to);
      if (e.to === id) related.add(e.from);
    });
    nodes.forEach(n => n.classList.toggle('dim', !related.has(n.dataset.id)));
    nodes.forEach(n => n.classList.toggle('focus', related.has(n.dataset.id)));
    edgeEls.forEach(e => {
      const direct = e.dataset.from === id || e.dataset.to === id;
      e.classList.toggle('focus', direct);
      e.classList.toggle('dim', !direct);
    });
  };

  nodes.forEach(node => {
    node.addEventListener('mouseenter', () => focus(node.dataset.id));
    node.addEventListener('mouseleave', clear);
    node.addEventListener('focus', () => focus(node.dataset.id));
    node.addEventListener('blur', clear);
    node.addEventListener('click', () => openEditor(node.dataset.id));
  });
}

function systemCard(s) {
  return `<article class="card system-card" data-id="${s.id}">
    ${statusBadge(s.status)}
    <h3>${s.name}</h3>
    <p>${s.definition}</p>
    <div class="meta">
      <span>${categoryLabel(s.category)}</span>
      <span>·</span>
      <span>${s.lastModified}</span>
      ${s.dependencies?.length ? `<span>· ${s.dependencies.length} deps</span>` : ''}
    </div>
  </article>`;
}

function bindSystemCards() {
  document.querySelectorAll('.system-card').forEach(card => {
    card.onclick = () => openEditor(card.dataset.id);
  });
}

function renderCombat() {
  const combatIds = new Set(['karma','engraving','circle','engraving-capacity']);
  const combat = activeSystems().filter(x => x.category === 'combat' || combatIds.has(x.id));

  view.innerHTML = `${section('Combat core','전투 핵심 개념과 직접 의존 관계')}
    <div class="map-note"><span>노드에 마우스를 올리면 직접 연결된 개념만 남는다.</span><span>클릭하면 세부 속성</span></div>
    <div id="combatMap"></div>
    ${section('Design order')}
    <div class="card"><p class="core-statement" style="font-size:15px">상황 파악 → 속성 선택 → 사영 선택 → 각인 구성 → 각인력 검사 → 카르마 확인 → 위험 판단 → 영창</p></div>`;

  renderSystemMap($('#combatMap'), combat);
}

function renderAttributes() {
  view.innerHTML = `${section('Five attributes','정다면체 → 사영도 → 각인')}
    <div class="card">
      <table class="table">
        <thead><tr><th>속성</th><th>정다면체</th><th>기본 성향</th><th>사영 클래스</th></tr></thead>
        <tbody>${data.elements.map(e=>`<tr><td>${e.name}</td><td>${e.solid}</td><td>${e.traits}</td><td>${e.projectionClasses}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    ${section('Related systems')}
    <div class="system-grid">${data.systems.filter(x=>x.category==='attribute').map(systemCard).join('')}</div>`;

  bindSystemCards();
}

function renderMvp() {
  view.innerHTML = `${section('MVP scope',data.project.mvpQuestion)}
    <div class="card"><table class="table"><tbody>${data.mvp.map(x=>`<tr><th>${x.item}</th><td>${x.value}</td></tr>`).join('')}</tbody></table></div>
    ${section('Priority stack')}
    <div class="grid cols-2">${data.priorities.map(priorityCard).join('')}</div>`;
}

function renderDecisions() {
  view.innerHTML = `${section('Decision log','결정을 삭제하지 않고 이유와 함께 축적')}
    <div class="card timeline">${data.decisions.map(decisionRow).join('')}</div>
    ${section('Add decision')}
    <form class="card" id="decisionForm">
      <div class="grid cols-2">
        <label>제목<input id="dTitle" required></label>
        <label>유형<input id="dType" value="rule"></label>
      </div>
      <label>이유<textarea id="dReason" rows="4" required></textarea></label>
      <button type="submit">Add decision</button>
    </form>`;

  $('#decisionForm').onsubmit = e => {
    e.preventDefault();
    data.decisions.unshift({
      date:new Date().toISOString().slice(0,10),
      version:data.project.version,
      title:$('#dTitle').value,
      type:$('#dType').value,
      reason:$('#dReason').value
    });
    markDirty();
    renderDecisions();
  };
}

function renderGraveyard() {
  const rejected = data.systems.filter(x=>x.status==='rejected');
  view.innerHTML = `${section('Graveyard','폐기한 아이디어도 기록은 유지')}
    <div class="system-grid">${rejected.map(systemCard).join('')}</div>`;
  bindSystemCards();
}

function renderQuestions() {
  view.innerHTML = `${section('Open questions','현재 확정되지 않은 설계 질문')}
    <div class="question-list">${data.openQuestions.map((q,i)=>`<div class="question"><span class="muted">${String(i+1).padStart(2,'0')}</span> &nbsp;${q}</div>`).join('')}</div>`;
}

function renderEditorExtra(item) {
  const dependencies = (item.dependencies || [])
    .map(id => data.systems.find(s => s.id === id))
    .filter(Boolean)
    .map(s => s.name);

  const dependents = data.systems
    .filter(s => (s.dependencies || []).includes(item.id) && s.category !== 'legacy')
    .map(s => s.name);

  const senses = item.senses?.length
    ? `<div class="detail-block">
        <h3>용례</h3>
        ${item.senses.map(s => `<div class="detail-sense"><strong>${escapeHtml(s.label)}</strong><p>${escapeHtml(s.definition)}</p></div>`).join('')}
      </div>`
    : '';

  const previousTerms = item.previousTerms?.length
    ? `<div class="detail-row"><span>이전 용어</span><strong>${item.previousTerms.map(escapeHtml).join(' · ')}</strong></div>`
    : '';

  return `
    <div class="detail-block">
      <h3>관계</h3>
      <div class="detail-row"><span>의존함</span><strong>${dependencies.length ? dependencies.map(escapeHtml).join(' · ') : '없음'}</strong></div>
      <div class="detail-row"><span>참조됨</span><strong>${dependents.length ? dependents.map(escapeHtml).join(' · ') : '없음'}</strong></div>
    </div>
    <div class="detail-block">
      <h3>속성</h3>
      <div class="detail-row"><span>도입</span><strong>${escapeHtml(item.introduced || '-')}</strong></div>
      ${previousTerms}
    </div>
    ${senses}
  `;
}

function openEditor(id) {
  const item = data.systems.find(x=>x.id===id);
  $('#editId').value = id;
  $('#editorTitle').textContent = item.name;
  $('#editStatus').innerHTML = data.statuses
    .map(s=>`<option value="${s.id}" ${s.id===item.status?'selected':''}>${s.icon} ${s.label}</option>`)
    .join('');
  $('#editDefinition').value = item.definition || '';
  $('#editDetails').value = item.details || item.definition || '';
  $('#editCategory').value = item.category;
  $('#editVersion').value = item.lastModified;
  $('#editorExtra').innerHTML = renderEditorExtra(item);
  dialog.showModal();
}

$('#editorForm').addEventListener('submit', e => {
  e.preventDefault();
  const item = data.systems.find(x=>x.id===$('#editId').value);
  item.status = $('#editStatus').value;
  item.definition = $('#editDefinition').value.trim();
  item.details = $('#editDetails').value.trim();
  item.category = $('#editCategory').value.trim();
  item.lastModified = $('#editVersion').value.trim() || data.project.version;
  markDirty();
  dialog.close();
  render();
});

function markDirty() {
  dirty = true;
  $('#saveBtn').textContent = 'Save local draft *';
}

function toast(message) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),1800);
}

$('#saveBtn').onclick = () => {
  localStorage.setItem('spellwright-project-draft', JSON.stringify(data));
  dirty = false;
  $('#saveBtn').textContent = 'Save local draft';
  toast('Saved as local draft');
};

$('#exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'project.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

$('#importInput').onchange = async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    data = JSON.parse(await file.text());
    markDirty();
    renderNav();
    render();
    toast('Imported — save as local draft or commit JSON');
  } catch {
    toast('Invalid JSON');
  }
};

window.addEventListener('beforeunload',e=>{
  if (dirty) {
    e.preventDefault();
    e.returnValue='';
  }
});

load();