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

async function load() {
  const res = await fetch('./data/project.json', { cache: 'no-store' });
  const remote = await res.json();
  const draft = localStorage.getItem('spellwright-project-draft');
  if (draft) {
    try { data = JSON.parse(draft); } catch { data = remote; }
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
    btn.onclick = () => { localStorage.removeItem('spellwright-project-draft'); location.reload(); };
    document.querySelector('.sidebar-footer').prepend(btn);
  }
}

function renderNav() {
  $('#nav').innerHTML = navItems.map(([id,label]) => `<button class="nav-btn ${id===currentView?'active':''}" data-view="${id}">${label}</button>`).join('');
  document.querySelectorAll('.nav-btn').forEach(btn => btn.onclick = () => {
    currentView = btn.dataset.view;
    renderNav(); render();
  });
}

function statusMeta(id) { return data.statuses.find(s => s.id === id) || {icon:'?',label:id}; }
function statusBadge(id) { const s = statusMeta(id); return `<span class="status ${id}">${s.icon} ${s.label}</span>`; }
function categoryLabel(id) {
  return ({magic:'Magic',combat:'Combat',character:'Character',attribute:'Attribute',roguelite:'Roguelite',legacy:'Legacy'})[id] || id;
}
function section(title, subtitle='') { return `<div class="section-head"><h2>${title}</h2><p>${subtitle}</p></div>`; }

function render() {
  const fn = ({overview:renderOverview,systems:renderSystems,combat:renderCombat,attributes:renderAttributes,mvp:renderMvp,decisions:renderDecisions,graveyard:renderGraveyard,questions:renderQuestions})[currentView];
  fn();
}

function renderOverview() {
  const counts = Object.fromEntries(data.statuses.map(s => [s.id, data.systems.filter(x => x.status===s.id).length]));
  view.innerHTML = `
    <div class="grid cols-4">
      <div class="card metric"><span>Confirmed systems</span><strong>${counts.confirmed}</strong></div>
      <div class="card metric"><span>Open / review</span><strong>${counts.undecided + counts.review}</strong></div>
      <div class="card metric"><span>Projection classes</span><strong>${data.elements.reduce((a,e)=>a+e.projectionClasses,0)}</strong></div>
      <div class="card metric"><span>Current priority</span><strong>P${data.priorities[0].rank}</strong></div>
    </div>
    ${section('Core identity', data.project.updatedAt)}
    <div class="card"><p class="core-statement">${data.project.coreStatement}</p><p class="muted" style="margin:16px 0 0">MVP question · ${data.project.mvpQuestion}</p></div>
    ${section('Current priorities','클릭해서 상태를 바꾸려면 Systems에서 해당 항목을 편집')}
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

function renderSystems() {
  view.innerHTML = `
    <div class="toolbar">
      <input id="search" placeholder="시스템 검색…" />
      <select id="statusFilter"><option value="">모든 상태</option>${data.statuses.map(s=>`<option value="${s.id}">${s.icon} ${s.label}</option>`).join('')}</select>
      <select id="categoryFilter"><option value="">모든 카테고리</option>${[...new Set(data.systems.map(x=>x.category))].map(c=>`<option value="${c}">${categoryLabel(c)}</option>`).join('')}</select>
    </div>
    <div class="system-grid" id="systemGrid"></div>`;
  const refresh = () => {
    const q = $('#search').value.trim().toLowerCase();
    const st = $('#statusFilter').value;
    const cat = $('#categoryFilter').value;
    const list = data.systems.filter(x => (!q || `${x.name} ${x.definition}`.toLowerCase().includes(q)) && (!st || x.status===st) && (!cat || x.category===cat));
    $('#systemGrid').innerHTML = list.map(systemCard).join('') || '<div class="card muted">일치하는 항목이 없다.</div>';
    document.querySelectorAll('.system-card').forEach(card => card.onclick = () => openEditor(card.dataset.id));
  };
  ['search','statusFilter','categoryFilter'].forEach(id => $(`#${id}`).oninput = refresh);
  refresh();
}

function systemCard(s) {
  return `<article class="card system-card" data-id="${s.id}">${statusBadge(s.status)}<h3>${s.name}</h3><p>${s.definition}</p><div class="meta"><span>${categoryLabel(s.category)}</span><span>·</span><span>${s.lastModified}</span>${s.dependencies?.length?`<span>· ${s.dependencies.length} deps</span>`:''}</div></article>`;
}

function renderCombat() {
  const combat = data.systems.filter(x => x.category==='combat' || ['karma','engraving','circle-count','engraving-capacity'].includes(x.id));
  view.innerHTML = `${section('Combat core','전투와 직접 연결된 시스템')}
    <div class="system-grid">${combat.map(systemCard).join('')}</div>
    ${section('Design order')}
    <div class="card"><p class="core-statement" style="font-size:15px">상황 파악 → 속성 선택 → 사영 선택 → 각인 구성 → 각인력 검사 → 카르마 확인 → 위험 판단 → 영창</p></div>`;
  document.querySelectorAll('.system-card').forEach(card => card.onclick = () => openEditor(card.dataset.id));
}

function renderAttributes() {
  view.innerHTML = `${section('Five attributes','정다면체 → 사영도 → 각인')}
    <div class="card"><table class="table"><thead><tr><th>속성</th><th>정다면체</th><th>기본 성향</th><th>사영 클래스</th></tr></thead><tbody>${data.elements.map(e=>`<tr><td>${e.name}</td><td>${e.solid}</td><td>${e.traits}</td><td>${e.projectionClasses}</td></tr>`).join('')}</tbody></table></div>
    ${section('Related systems')}
    <div class="system-grid">${data.systems.filter(x=>x.category==='attribute').map(systemCard).join('')}</div>`;
  document.querySelectorAll('.system-card').forEach(card => card.onclick = () => openEditor(card.dataset.id));
}

function renderMvp() {
  view.innerHTML = `${section('MVP scope',data.project.mvpQuestion)}<div class="card"><table class="table"><tbody>${data.mvp.map(x=>`<tr><th>${x.item}</th><td>${x.value}</td></tr>`).join('')}</tbody></table></div>
  ${section('Priority stack')}<div class="grid cols-2">${data.priorities.map(priorityCard).join('')}</div>`;
}

function renderDecisions() {
  view.innerHTML = `${section('Decision log','결정을 삭제하지 않고 이유와 함께 축적')}
    <div class="card timeline">${data.decisions.map(decisionRow).join('')}</div>
    ${section('Add decision')}
    <form class="card" id="decisionForm">
      <div class="grid cols-2"><label>제목<input id="dTitle" required></label><label>유형<input id="dType" value="rule"></label></div>
      <label>이유<textarea id="dReason" rows="4" required></textarea></label>
      <button type="submit">Add decision</button>
    </form>`;
  $('#decisionForm').onsubmit = e => {
    e.preventDefault();
    data.decisions.unshift({date:new Date().toISOString().slice(0,10),version:data.project.version,title:$('#dTitle').value,type:$('#dType').value,reason:$('#dReason').value});
    markDirty(); renderDecisions();
  };
}

function renderGraveyard() {
  const rejected = data.systems.filter(x=>x.status==='rejected');
  view.innerHTML = `${section('Graveyard','폐기한 아이디어도 기록은 유지')}
    <div class="system-grid">${rejected.map(systemCard).join('')}</div>`;
  document.querySelectorAll('.system-card').forEach(card => card.onclick = () => openEditor(card.dataset.id));
}

function renderQuestions() {
  view.innerHTML = `${section('Open questions','현재 확정되지 않은 설계 질문')}
    <div class="question-list">${data.openQuestions.map((q,i)=>`<div class="question"><span class="muted">${String(i+1).padStart(2,'0')}</span> &nbsp;${q}</div>`).join('')}</div>`;
}

function openEditor(id) {
  const item = data.systems.find(x=>x.id===id);
  $('#editId').value = id;
  $('#editorTitle').textContent = item.name;
  $('#editStatus').innerHTML = data.statuses.map(s=>`<option value="${s.id}" ${s.id===item.status?'selected':''}>${s.icon} ${s.label}</option>`).join('');
  $('#editDefinition').value = item.definition;
  $('#editCategory').value = item.category;
  $('#editVersion').value = item.lastModified;
  dialog.showModal();
}

$('#editorForm').addEventListener('submit', e => {
  e.preventDefault();
  const item = data.systems.find(x=>x.id===$('#editId').value);
  item.status = $('#editStatus').value;
  item.definition = $('#editDefinition').value.trim();
  item.category = $('#editCategory').value.trim();
  item.lastModified = $('#editVersion').value.trim() || data.project.version;
  markDirty(); dialog.close(); render();
});

function markDirty() { dirty = true; $('#saveBtn').textContent = 'Save local draft *'; }
function toast(message) { const t=document.createElement('div');t.className='toast';t.textContent=message;document.body.appendChild(t);setTimeout(()=>t.remove(),1800); }

$('#saveBtn').onclick = () => {
  localStorage.setItem('spellwright-project-draft', JSON.stringify(data));
  dirty=false; $('#saveBtn').textContent='Save local draft'; toast('Saved as local draft');
};

$('#exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='project.json';a.click();URL.revokeObjectURL(a.href);
};

$('#importInput').onchange = async e => {
  const file=e.target.files?.[0]; if(!file) return;
  try { data=JSON.parse(await file.text()); markDirty(); renderNav(); render(); toast('Imported — save as local draft or commit JSON'); }
  catch { toast('Invalid JSON'); }
};

window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
load();
