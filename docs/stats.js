const STATS_URL = './data/stats.json';

let statsData;
let statsViewActive = false;

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

async function loadStats() {
  if (statsData) return statsData;

  const response = await fetch(STATS_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to load character stats');

  const loaded = await response.json();
  if (!Array.isArray(loaded?.stats)) throw new Error('Invalid character stat data');

  statsData = loaded;
  return statsData;
}

function statKindLabel(kind) {
  return kind === 'potential' ? '성장' : '기초';
}

async function renderStats() {
  statsViewActive = true;

  document.querySelectorAll('#nav .nav-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.view === 'stats');
  });

  view.innerHTML = `${section('Character stats', '체력 → 마력 → 서클 → 각인력 → 통찰력 → 정신력 → 잠재력')}
    <div class="card"><p class="muted">능력치 데이터를 불러오는 중…</p></div>`;

  try {
    const { stats, updatedAt } = await loadStats();
    if (!statsViewActive) return;

    const orderedStats = [...stats].sort((a, b) => a.order - b.order);
    const distributable = orderedStats.filter(stat => stat.kind === 'core');
    const potential = orderedStats.find(stat => stat.kind === 'potential');

    view.innerHTML = `
      ${section('Character stats', '체력 → 마력 → 서클 → 각인력 → 통찰력 → 정신력 → 잠재력')}
      <div class="card">
        <p class="core-statement" style="font-size:15px">런 시작 시 체력·마력·서클·각인력·통찰력·정신력에 포인트를 분배하고, 남은 포인트는 모두 잠재력으로 전환한다.</p>
        <p class="muted" style="margin:12px 0 0">마지막 정리 · ${escapeHtml(updatedAt || '-')}</p>
      </div>
      ${section('Stat order', '기초 생존과 자원 → 마법 운용 → 구성과 이해 → 한계 초과 → 성장')}
      <div class="card">
        <table class="table">
          <thead><tr><th>#</th><th>능력치</th><th>구분</th><th>역할</th><th>핵심 정의</th></tr></thead>
          <tbody>${orderedStats.map(stat => `
            <tr>
              <td>${escapeHtml(stat.order)}</td>
              <td><strong>${escapeHtml(stat.name)}</strong></td>
              <td>${escapeHtml(statKindLabel(stat.kind))}</td>
              <td>${escapeHtml(stat.role)}</td>
              <td>${escapeHtml(stat.definition)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
      ${section('Core stats', '직접 분배하는 여섯 능력치')}
      <div class="system-grid">${distributable.map(stat => `
        <article class="card system-card">
          <span class="status confirmed">✓ 확정</span>
          <h3>${escapeHtml(stat.name)}</h3>
          <p>${escapeHtml(stat.details)}</p>
          <div class="meta"><span>${escapeHtml(stat.role)}</span></div>
        </article>`).join('')}</div>
      ${potential ? `
        ${section('Potential', '분배하지 않은 능력치의 성장 가치')}
        <article class="card system-card">
          <span class="status confirmed">✓ 확정</span>
          <h3>${escapeHtml(potential.name)}</h3>
          <p>${escapeHtml(potential.details)}</p>
          <div class="meta"><span>${escapeHtml(potential.role)}</span></div>
        </article>` : ''}
    `;
  } catch (error) {
    if (!statsViewActive) return;
    view.innerHTML = `${section('Character stats')}
      <div class="card"><p>능력치 데이터를 불러오지 못했다.</p></div>`;
    console.error(error);
  }
}

function ensureStatsNavButton() {
  if (!nav || nav.querySelector('[data-view="stats"]')) return;

  const button = document.createElement('button');
  button.className = `nav-btn${statsViewActive ? ' active' : ''}`;
  button.dataset.view = 'stats';
  button.textContent = 'Stats';
  button.addEventListener('click', renderStats);

  const combatButton = nav.querySelector('[data-view="combat"]');
  if (combatButton?.nextSibling) nav.insertBefore(button, combatButton.nextSibling);
  else if (combatButton) nav.appendChild(button);
  else nav.appendChild(button);
}

nav?.addEventListener('click', event => {
  const button = event.target.closest('.nav-btn');
  if (!button || button.dataset.view === 'stats') return;
  statsViewActive = false;
});

if (nav) {
  new MutationObserver(ensureStatsNavButton).observe(nav, { childList: true });
  ensureStatsNavButton();
}
