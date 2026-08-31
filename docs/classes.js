const CLASSES_URL = './data/classes.json';

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
    button.classList.toggle('active', button.dataset.view === 'classes');
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

function placeClassesButton(button) {
  const statsButton = nav?.querySelector('[data-view="stats"]');
  const combatButton = nav?.querySelector('[data-view="combat"]');
  const anchor = statsButton || combatButton;

  if (!anchor) {
    nav?.appendChild(button);
    return;
  }

  if (anchor.nextSibling !== button) {
    nav.insertBefore(button, anchor.nextSibling);
  }
}

function ensureClassesNavButton() {
  if (!nav) return;

  let button = nav.querySelector('[data-view="classes"]');
  if (!button) {
    button = document.createElement('button');
    button.className = `nav-btn${classesViewActive ? ' active' : ''}`;
    button.dataset.view = 'classes';
    button.textContent = 'Classes';
    button.addEventListener('click', renderClasses);
  }

  placeClassesButton(button);
}

nav?.addEventListener('click', event => {
  const button = event.target.closest('.nav-btn');
  if (!button || button.dataset.view === 'classes') return;
  classesViewActive = false;
});

if (nav) {
  new MutationObserver(ensureClassesNavButton).observe(nav, { childList: true });
  ensureClassesNavButton();
}
