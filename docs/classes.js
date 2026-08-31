const CLASSES_URL = './data/classes.json';
const CLASSES_HASH = '#classes';
const CLASS_LINK_GAP = 16;
const CLASS_LINK_HEIGHT = 62;
const CLASS_LINK_BOTTOM_PADDING = 24;

let classData;
let classesViewActive = false;

const view = document.querySelector('#view');
const nav = document.querySelector('#nav');

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function section(title, subtitle = '') {
  return `<div class="section-head"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>`;
}

async function loadClasses() {
  if (classData) return classData;

  const response = await fetch(CLASSES_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to load class drafts');

  const loaded = await response.json();
  if (!Array.isArray(loaded?.classes) || loaded.classes.length !== 16) {
    throw new Error('Invalid class draft data');
  }

  classData = loaded;
  return classData;
}

function reviewBadge() {
  return '<span class="status review">🟡 검토 중</span>';
}

function classCard(item) {
  const stats = item.stats.join(' + ');
  return `<article class="card system-card">
    ${reviewBadge()}
    <h3>${escapeHtml(item.name)} <span class="muted">/ ${escapeHtml(item.englishName)}</span></h3>
    <div class="meta"><span>${escapeHtml(stats)}</span></div>
    <p><strong>${escapeHtml(item.mechanic)}</strong> · ${escapeHtml(item.mechanicDescription)}</p>
    <p class="muted">${escapeHtml(item.playstyle)}</p>
    ${item.assignmentCondition ? `<div class="meta"><span>판정 · ${escapeHtml(item.assignmentCondition)}</span></div>` : ''}
  </article>`;
}

async function renderClasses() {
  classesViewActive = true;

  document.querySelectorAll('#nav .nav-btn').forEach(button => {
    button.classList.remove('active');
  });

  view.innerHTML = `${section('Classes', '상위 스탯 2개 조합 15종 + 잠재력 특수 직업 1종')}
    <div class="card"><p class="muted">직업 초안을 불러오는 중…</p></div>`;

  try {
    const loaded = await loadClasses();
    if (!classesViewActive) return;

    const regular = loaded.classes.filter(item => item.id !== loaded.assignmentRule.potential.classId);
    const potential = loaded.classes.find(item => item.id === loaded.assignmentRule.potential.classId);

    view.innerHTML = `
      ${section('Classes', '현재 16개 직업안은 모두 검토 중')}
      <div class="card">
        <p class="core-statement" style="font-size:15px">${escapeHtml(loaded.assignmentRule.summary)}</p>
        <p class="muted" style="margin:12px 0 0">일반 직업 · 잠재력을 제외한 6개 스탯의 상위 2개 조합 = 15종</p>
        <p class="muted" style="margin:6px 0 0">잠재력 특수 직업 · ${escapeHtml(loaded.assignmentRule.potential.conditions.join(' · '))}</p>
        <p class="muted" style="margin:6px 0 0">마지막 정리 · ${escapeHtml(loaded.updatedAt || '-')}</p>
      </div>
      ${section('Two-stat classes', '직업명·고유 기믹·수치와 세부 규칙 모두 검토 중')}
      <div class="system-grid">${regular.map(classCard).join('')}</div>
      ${potential ? `
        ${section('Potential class', '초반을 포기하고 후반 복리 성장을 노리는 챌린지형 예외 직업')}
        <div class="system-grid">${classCard(potential)}</div>
        <div class="card"><p class="muted">${escapeHtml(loaded.assignmentRule.potential.note)}</p></div>
      ` : ''}
    `;
  } catch (error) {
    if (!classesViewActive) return;
    view.innerHTML = `${section('Classes')}
      <div class="card"><p>직업 초안을 불러오지 못했다.</p></div>`;
    console.error(error);
  }
}

function createClassesGraphLink(map) {
  const link = document.createElement('a');
  link.className = 'compact-node class-link-node';
  link.dataset.category = 'character';
  link.href = CLASSES_HASH;
  link.setAttribute('aria-label', '직업 초안 보기');
  link.style.height = `${CLASS_LINK_HEIGHT}px`;
  link.style.textDecoration = 'none';
  link.style.cursor = 'pointer';
  link.innerHTML = `
    <span class="compact-node-kicker">
      <span class="compact-category">Character</span>
      <span class="compact-status">↗</span>
    </span>
    <strong>직업 / Classes</strong>
    <small>스탯 조합 기반 직업안 보기</small>`;
  map.appendChild(link);
  return link;
}

function injectClassesGraphLink() {
  const map = document.querySelector('#systemMap .compact-map');
  if (!map) return;

  const statRoot = map.querySelector('.compact-node[data-id="character-stats"]');
  const potentialRow = map.querySelector('.compact-node[data-id="potential"]');
  if (!statRoot || !potentialRow) return;

  let link = map.querySelector('.class-link-node');
  if (!link) link = createClassesGraphLink(map);

  const left = parseFloat(statRoot.style.left) || 0;
  const width = parseFloat(statRoot.style.width) || 220;
  const top = (parseFloat(potentialRow.style.top) || 0)
    + (parseFloat(potentialRow.style.height) || 0)
    + CLASS_LINK_GAP;

  link.style.left = `${left}px`;
  link.style.top = `${top}px`;
  link.style.width = `${width}px`;

  if (!map.dataset.classLinkBaseHeight) {
    map.dataset.classLinkBaseHeight = String(parseFloat(map.style.height) || map.offsetHeight || 0);
  }
  const baseHeight = Number(map.dataset.classLinkBaseHeight) || 0;
  const requiredHeight = top + CLASS_LINK_HEIGHT + CLASS_LINK_BOTTOM_PADDING;
  map.style.height = `${Math.max(baseHeight, requiredHeight)}px`;
}

function syncClassRoute() {
  if (location.hash === CLASSES_HASH) {
    if (!classesViewActive && nav?.querySelector('.nav-btn')) renderClasses();
    return;
  }

  if (classesViewActive) {
    classesViewActive = false;
    nav?.querySelector('.nav-btn[data-view="systems"]')?.click();
  }
}

function refreshClassEntry() {
  injectClassesGraphLink();
  syncClassRoute();
}

nav?.addEventListener('click', event => {
  const button = event.target.closest('.nav-btn');
  if (!button) return;

  classesViewActive = false;
  if (location.hash === CLASSES_HASH) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
});

window.addEventListener('hashchange', syncClassRoute);

const observer = new MutationObserver(() => queueMicrotask(refreshClassEntry));
observer.observe(document.documentElement, { childList: true, subtree: true });
queueMicrotask(refreshClassEntry);
