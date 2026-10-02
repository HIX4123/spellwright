import { escapeHtml, section } from './html.js';
import { CATEGORY_ORDER, buildGraphModel, edgePath, layoutGraph } from './graph-model.mjs?v=stat-panel-20260831-1';
import { mountProjectionSelector } from './projection-selector.js?v=projection-transition-1000ms-20261002-1';
import { mountProjectionPeriodicTable } from './projection-periodic-table.js?v=minimal-symmetry-rotation-20261002-2';
import { dashboardViewFromHash, dashboardViewHref } from './dashboard-routing.js?v=linked-dashboard-tabs-20261001-1';

let data;
let relationships;
let repositoryRevision;
let currentView = 'overview';
let dirty = false;

const $ = (q) => document.querySelector(q);
const view = $('#view');
const dialog = $('#editorDialog');

const navItems = [
  ['overview','Overview'], ['systems','Systems'], ['combat','Combat'], ['attributes','Attributes'],
  ['mvp','MVP'], ['decisions','Decisions'], ['graveyard','Graveyard'], ['questions','Open Questions']
];

const THEORY_CARDS = [
  ['속성과 조작 영역', '속성은 원소 재료가 아니라 현실을 조작할 수 있는 영역을 정한다.', '해리 = 경계·동일성 · 소외 = 위치·거리 · 초조 = 운동·변화량 · 고착 = 관계·참조 · 반추 = 가능성·결과'],
  ['사영도 = 연산자', '사영도는 완성 주문이 아니라 해당 속성의 영역에 적용되는 기본 실행 동사다.', '예: 초조의 정렬·방출·전달·전환·분배·등방화. 43개 전체 매핑은 역할 가설 단계다.'],
  ['개시 → 전개 → 완결', '개시는 속성과 출발 연산을, 전개는 대상·형태·변환·조건·제약·보강을, 완결은 시전 형식을 정한다.', '강도·범위·마나·조건 같은 수치적 조정은 사영도보다 전개 각인의 책임으로 둔다.'],
  ['타입 있는 마법 문법', '각인은 입력과 출력 타입을 가진 함수처럼 취급한다. 문법적으로 연결되지 않는 조합은 구성 단계에서 거부한다.', '무한한 주문을 개별 구현하지 않고 유한한 문법이 큰 조합 공간을 만든다.'],
  ['효과 그래프', '유효한 서클은 Entity, Field, Relation, Boundary, SpatialState, Motion, PossibilityState 같은 공통 객체의 그래프로 변환한다.', '유도 화염구도 별도 스킬 코드가 아니라 열·운동·추적 관계·충돌 조건이 결합된 그래프로 실행한다.'],
  ['구조적 상성', '속성표의 고정 배율보다 같은 상태를 건드리는 연산끼리의 충돌과 우회가 상성을 만든다.', '고착의 관계는 해리로 끊고, 초조 투사체는 차단·회피·반전·고정·결과 선택 등 서로 다른 방식으로 대응할 수 있다.'],
  ['마법 이름', '현상적 이름과 내부 구조를 분리한다. 구조명 → 마법군 → 변형명 → 플레이어 개인명을 겹쳐 사용할 수 있다.', '겉으로 같은 화염구라도 초조 집속식과 소외 전이식은 내부 구조와 카운터가 다를 수 있다.'],
  ['화염구 예시', '초조 계통에서 가장 단순한 고전적 화염구를 조립한 예시.', '초조·집속 → 구형 구속 → 열화 → 전방 지향 → 충돌 시 해제 → 즉발 = 화염구 계열']
];

const DRAFT_KEY = 'spellwright-project-draft';
const STALE_DRAFT_KEY = 'spellwright-project-draft-stale-backup';

async function contentRevision(content) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function isProjectData(value) {
  return Boolean(value?.project
    && ['statuses', 'systems', 'elements', 'priorities', 'openQuestions', 'mvp', 'decisions']
      .every(key => Array.isArray(value[key]))
    && value.systems.every(system => typeof system?.id === 'string'
      && typeof system.name === 'string'
      && Array.isArray(system.dependencies))
    && value.elements.every(element => ['name', 'solid', 'motto', 'loss', 'meaning']
      .every(key => typeof element?.[key] === 'string')
      && Number.isInteger(element.projectionClasses)));
}

function isRelationshipData(value) {
  return Boolean(value
    && ['hierarchy', 'sequence', 'hiddenSystems', 'suppressedDependencies']
      .every(key => Array.isArray(value[key]))
    && value.hierarchy.every(edge => typeof edge?.parent === 'string' && typeof edge.child === 'string')
    && value.sequence.every(edge => typeof edge?.from === 'string' && typeof edge.to === 'string'));
}

async function load() {
  const [projectResponse, relationshipResponse] = await Promise.all([
    fetch('./data/project.json', { cache: 'no-store' }),
    fetch('./data/relationships.json', { cache: 'no-store' })
  ]);
  if (!projectResponse.ok || !relationshipResponse.ok) {
    throw new Error('Failed to load dashboard data');
  }
  const projectSource = await projectResponse.text();
  const remote = JSON.parse(projectSource);
  relationships = await relationshipResponse.json();
  if (!isProjectData(remote) || !isRelationshipData(relationships)) {
    throw new Error('Invalid dashboard data');
  }
  repositoryRevision = await contentRevision(projectSource);
  const draft = localStorage.getItem(DRAFT_KEY);

  if (draft) {
    try {
      const parsed = JSON.parse(draft);
      data = parsed.revision === repositoryRevision && isProjectData(parsed.data) ? parsed.data : remote;
      if (data === remote) {
        localStorage.setItem(STALE_DRAFT_KEY, JSON.stringify(parsed.data || parsed));
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      data = remote;
      localStorage.removeItem(DRAFT_KEY);
    }
  } else {
    data = remote;
  }

  $('#projectName').textContent = data.project.name;
  $('#version').textContent = `${data.project.version} · ${data.project.phase}`;
  currentView = dashboardViewFromHash(location.hash);
  renderNav();
  render();

  if (!document.querySelector('#resetDraftBtn')) {
    const btn = document.createElement('button');
    btn.id = 'resetDraftBtn';
    btn.className = 'ghost';
    btn.textContent = 'Use repository data';
    btn.onclick = () => {
      localStorage.removeItem(DRAFT_KEY);
      location.reload();
    };
    document.querySelector('.sidebar-footer').prepend(btn);
  }
}

function renderNav() {
  $('#nav').innerHTML = navItems
    .map(([id,label]) => `<a class="nav-btn ${id===currentView?'active':''}" href="${dashboardViewHref(id)}" data-view="${id}"${id===currentView?' aria-current="page"':''}>${label}</a>`)
    .join('');
}

function statusMeta(id) {
  return data.statuses.find(s => s.id === id) || {icon:'?',label:id};
}

function statusBadge(id) {
  const s = statusMeta(id);
  return `<span class="status ${escapeHtml(id)}">${escapeHtml(s.icon)} ${escapeHtml(s.label)}</span>`;
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
      <p class="core-statement">${escapeHtml(data.project.coreStatement)}</p>
      <p class="muted" style="margin:16px 0 0">MVP question · ${escapeHtml(data.project.mvpQuestion)}</p>
    </div>
    ${section('Current priorities','세부 시스템은 Systems 관계 맵에서 확인')}
    <div class="grid cols-2">${data.priorities.map(priorityCard).join('')}</div>
    ${section('Recent decisions')}
    <div class="card timeline">${data.decisions.slice(0,4).map(decisionRow).join('')}</div>
  `;
}

function priorityCard(p) {
  return `<div class="card priority"><div class="rank">${escapeHtml(p.rank)}</div><div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description)}</p></div>${statusBadge(p.status)}</div>`;
}

function decisionRow(d) {
  return `<div class="decision"><div class="date">${escapeHtml(d.date)}<br>${escapeHtml(d.version)}</div><div class="type">${escapeHtml(d.type)}</div><div><h3>${escapeHtml(d.title)}</h3><p>${escapeHtml(d.reason)}</p></div></div>`;
}

function activeSystems() {
  return data.systems.filter(x => x.category !== 'legacy' && x.status !== 'rejected');
}

function renderSystems() {
  view.innerHTML = `
    <div class="toolbar">
      <input id="search" placeholder="시스템 검색…" />
      <select id="statusFilter"><option value="">모든 상태</option>${data.statuses.filter(s=>s.id!=='rejected').map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(s.icon)} ${escapeHtml(s.label)}</option>`).join('')}</select>
      <select id="categoryFilter"><option value="">모든 카테고리</option>${CATEGORY_ORDER.map(c=>`<option value="${c}">${categoryLabel(c)}</option>`).join('')}</select>
    </div>
    <div class="map-note"><span>위 → 아래 = 관계 흐름</span><span>실선 = 상하위 · 점선 = 기능 의존 · 파선 = 단계 순서</span></div>
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

function categoryLegend(systems) {
  const categories = new Set(systems.map(system => system.category));
  return CATEGORY_ORDER
    .filter(category => categories.has(category))
    .map(category => `<span class="category-legend ${category}"><i></i>${categoryLabel(category)}</span>`)
    .join('');
}

function renderSystemMap(container, systems) {
  const model = buildGraphModel(systems, relationships);
  if (!model.systems.length) {
    container.innerHTML = '<div class="map-empty">일치하는 시스템이 없다.</div>';
    return;
  }

  const layout = layoutGraph(model);
  const prefix = container.id || 'systemMap';
  const edgeHtml = model.edges.map((edge, index) => {
    const marker = edge.kind === 'hierarchy'
      ? `url(#${prefix}-hierarchy-arrow)`
      : edge.kind === 'sequence'
        ? `url(#${prefix}-sequence-arrow)`
        : `url(#${prefix}-dependency-arrow)`;
    const markerStart = edge.mutual ? ` marker-start="${marker}"` : '';
    return `<path class="compact-edge ${edge.kind}${edge.mutual ? ' mutual' : ''}"
      data-from="${escapeHtml(edge.from)}" data-to="${escapeHtml(edge.to)}"
      d="${edgePath(edge, layout, index)}"${markerStart} marker-end="${marker}" />`;
  }).join('');

  const nodeHtml = model.systems.map(system => {
    const position = layout.nodes.get(system.id);
    const status = statusMeta(system.status);
    return `<button class="compact-node" data-id="${escapeHtml(system.id)}"
      data-category="${escapeHtml(system.category)}"
      style="left:${position.x}px;top:${position.y}px;width:${position.w}px;height:${position.h}px">
      <span class="compact-node-kicker">
        <span class="compact-category">${escapeHtml(categoryLabel(system.category))}</span>
        <span class="compact-status">${escapeHtml(status.icon)} ${escapeHtml(status.label)}</span>
      </span>
      <strong>${escapeHtml(system.name)}</strong>
      <small>${escapeHtml(system.definition || '')}</small>
    </button>`;
  }).join('');

  container.innerHTML = `
    <div class="compact-map-root">
      <div class="compact-legend">
        <div class="relation-legend">
          <span class="solid-sample">상하위</span>
          <span class="dash-sample">기능 의존</span>
          <span class="sequence-sample">단계 순서</span>
        </div>
        <div class="category-legends">${categoryLegend(model.systems)}</div>
      </div>
      <div class="compact-map-scroll">
        <div class="compact-map" style="width:${layout.width}px;height:${layout.height}px">
          ${layout.isolatedTop === null ? '' : `<div class="isolated-label" style="top:${layout.isolatedTop}px">현재 관계선 없음</div>`}
          <svg class="compact-lines" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">
            <defs>
              <marker id="${prefix}-hierarchy-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M0,0 L10,5 L0,10 Z" class="hierarchy-arrow" />
              </marker>
              <marker id="${prefix}-dependency-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,1 L9,5 L0,9 Z" class="dependency-arrow" />
              </marker>
              <marker id="${prefix}-sequence-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,1 L9,5 L0,9 Z" class="sequence-arrow" />
              </marker>
            </defs>
            ${edgeHtml}
          </svg>
          ${nodeHtml}
        </div>
      </div>
    </div>`;

  bindMapInteractions(container.querySelector('.compact-map-root'), model.edges);
}

function bindMapInteractions(root, edges) {
  const nodes = [...root.querySelectorAll('.compact-node')];
  const edgeElements = [...root.querySelectorAll('.compact-edge')];

  const clear = () => {
    root.classList.remove('relation-focus-active');
    nodes.forEach(node => node.classList.remove('focus', 'dim'));
    edgeElements.forEach(edge => edge.classList.remove('focus', 'dim'));
  };

  const focus = id => {
    const related = new Set([id]);
    edges.forEach(edge => {
      if (edge.from === id) related.add(edge.to);
      if (edge.to === id) related.add(edge.from);
    });
    root.classList.add('relation-focus-active');
    nodes.forEach(node => {
      const active = related.has(node.dataset.id);
      node.classList.toggle('focus', active);
      node.classList.toggle('dim', !active);
    });
    edgeElements.forEach(edge => {
      const direct = edge.dataset.from === id || edge.dataset.to === id;
      edge.classList.toggle('focus', direct);
      edge.classList.toggle('dim', !direct);
    });
  };

  nodes.forEach(node => {
    node.addEventListener('mouseenter', () => focus(node.dataset.id));
    node.addEventListener('mouseleave', clear);
    node.addEventListener('focus', () => focus(node.dataset.id));
    node.addEventListener('blur', event => {
      const next = event.relatedTarget?.closest?.('.compact-node[data-id]');
      if (next && root.contains(next)) focus(next.dataset.id);
      else clear();
    });
    node.addEventListener('click', () => openEditor(node.dataset.id));
  });
}
function systemCard(s) {
  return `<article class="card system-card" data-id="${escapeHtml(s.id)}">
    ${statusBadge(s.status)}
    <h3>${escapeHtml(s.name)}</h3>
    <p>${escapeHtml(s.definition)}</p>
    <div class="meta">
      <span>${escapeHtml(categoryLabel(s.category))}</span>
      <span>·</span>
      <span>${escapeHtml(s.lastModified)}</span>
      ${s.dependencies?.length ? `<span>· ${escapeHtml(s.dependencies.length)} deps</span>` : ''}
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

  view.innerHTML = `${section('Combat core','계층과 기능 의존 관계')}
    <div class="map-note"><span>위 → 아래 = 관계 흐름</span><span>실선 = 상하위 · 점선 = 기능 의존</span></div>
    <div id="combatMap"></div>
    ${section('Design order')}
    <div class="card"><p class="core-statement" style="font-size:15px">상황 파악 → 속성 선택 → 사영 선택 → 각인 구성 → 각인력 검사 → 카르마 확인 → 위험 판단 → 영창</p></div>`;

  renderSystemMap($('#combatMap'), combat);
}

function renderAttributes() {
  const attributeSystem = data.systems.find(system => system.id === 'five-elements');
  const background = attributeSystem.details
    .split('\n\n')
    .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
    .join('');

  view.innerHTML = `${section('Five attributes','상실 → 정신의 반응 → 정다면체 → 사영도')}
    <div class="card attribute-background">
      <p class="core-statement">삶이란 상실의 연속이다.</p>
      ${background}
    </div>
    ${section('Projection periodic table','Period = Convex Hull 층수 · Group = 최외곽 Convex Hull 정점 수')}
    <div id="projectionPeriodicTable"></div>
    ${section('Projection simulation','정다면체 선택 → 좌우 드래그 · 방향키 · 클래스 번호로 사영 전환')}
    <div id="projectionSimulation"></div>
    ${section('Magic theory', '현재까지 정립된 마법 구현 원리와 전투 해석')}
    <div class="theory-grid">${THEORY_CARDS.map(([title, body, note]) => `
      <article class="card theory-card">
        <h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p><p class="theory-note">${escapeHtml(note)}</p>
      </article>`).join('')}</div>
    ${section('Related systems')}
    <div class="system-grid">${data.systems.filter(x=>x.category==='attribute').map(systemCard).join('')}</div>`;

  mountProjectionPeriodicTable(data.elements);
  mountProjectionSelector();
  bindSystemCards();
}

function renderMvp() {
  view.innerHTML = `${section('MVP scope',data.project.mvpQuestion)}
    <div class="card"><table class="table"><tbody>${data.mvp.map(x=>`<tr><th>${escapeHtml(x.item)}</th><td>${escapeHtml(x.value)}</td></tr>`).join('')}</tbody></table></div>
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
    <div class="question-list">${data.openQuestions.map((q,i)=>`<div class="question"><span class="muted">${String(i+1).padStart(2,'0')}</span> &nbsp;${escapeHtml(q)}</div>`).join('')}</div>`;
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
    .map(s=>`<option value="${escapeHtml(s.id)}" ${s.id===item.status?'selected':''}>${escapeHtml(s.icon)} ${escapeHtml(s.label)}</option>`)
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
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ revision: repositoryRevision, data }));
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
    const imported = JSON.parse(await file.text());
    if (!isProjectData(imported)) throw new Error('Invalid project data');
    data = imported;
    markDirty();
    renderNav();
    render();
    toast('Imported — save as local draft or commit JSON');
  } catch {
    toast('Invalid JSON');
  }
};

window.addEventListener('hashchange', () => {
  const nextView = dashboardViewFromHash(location.hash);
  if (nextView === currentView) return;
  currentView = nextView;
  renderNav();
  if (data) render();
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
});

window.addEventListener('beforeunload',e=>{
  if (dirty) {
    e.preventDefault();
    e.returnValue='';
  }
});

load();
