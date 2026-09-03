const SIMULATION_NAV_ID = 'simulationNav';
const SIMULATION_ANCHOR_CLASS = 'simulation-projection-anchor';

async function renderSimulation() {
  const view = document.getElementById('view');
  if (!view) return;

  document.querySelectorAll('#nav .nav-btn').forEach(button => button.classList.remove('active'));
  document.getElementById(SIMULATION_NAV_ID)?.classList.add('active');

  view.innerHTML = `
    <div class="section-head">
      <h2>Projection simulation</h2>
      <p>정다면체의 실제 3D 자세를 정해진 사영 순서대로 회전시키고 정투영으로 확인한다.</p>
    </div>
    <div class="card">
      <p class="core-statement" style="font-size:15px">정다면체 선택 → 좌우 드래그 → 정해진 사영 순서로 회전 → 대표 사영에 스냅</p>
      <p class="muted" style="margin:10px 0 0">원근법은 사용하지 않는다. 세로 드래그는 무시하며, 각 정지점은 기존 사영 이미지의 대표 시선과 화면 방향을 재현한다.</p>
    </div>
    <div class="section-head ${SIMULATION_ANCHOR_CLASS}" style="display:none" aria-hidden="true">
      <h2>Projection simulation mount</h2>
      <p>simulation mount anchor</p>
    </div>
    <div class="projection-tables" data-theory-enhanced="true" data-simulation-anchor="true" style="display:none" aria-hidden="true"></div>
  `;

  try {
    const { mountProjectionSelector } = await import('./projection-selector.js?v=projection-selector-20260903-6');
    await mountProjectionSelector();
  } catch (error) {
    console.warn('[simulation] failed to mount projection selector', error);
  }
}

function ensureSimulationNav() {
  const nav = document.getElementById('nav');
  if (!nav || document.getElementById(SIMULATION_NAV_ID)) return;

  const attributes = nav.querySelector('[data-view="attributes"]');
  if (!attributes) return;

  const button = document.createElement('button');
  button.id = SIMULATION_NAV_ID;
  button.type = 'button';
  button.className = 'nav-btn';
  button.dataset.view = 'simulation';
  button.textContent = 'Simulation';
  button.addEventListener('click', renderSimulation);
  attributes.after(button);
}

function initSimulationTab() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  new MutationObserver(ensureSimulationNav).observe(nav, { childList: true });
  ensureSimulationNav();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSimulationTab, { once: true });
} else {
  initSimulationTab();
}
