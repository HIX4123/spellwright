const SIMULATION_NAV_ID = 'simulationNav';
const SIMULATION_ANCHOR_CLASS = 'simulation-projection-anchor';

function renderSimulation() {
  const view = document.getElementById('view');
  if (!view) return;

  document.querySelectorAll('#nav .nav-btn').forEach(button => button.classList.remove('active'));
  document.getElementById(SIMULATION_NAV_ID)?.classList.add('active');

  view.innerHTML = `
    <div class="section-head">
      <h2>Projection simulation</h2>
      <p>실제 정다면체를 3D 회전한 뒤 2.5D wireframe으로 투영해 사영 클래스를 탐색하는 인터랙션 실험</p>
    </div>
    <div class="card">
      <p class="core-statement" style="font-size:15px">정다면체 선택 → 직접 회전 → 사영 방향으로 스냅</p>
      <p class="muted" style="margin:10px 0 0">드래그 중 모든 프레임은 실제 3D 정점·간선 계산 결과다. class별 대표 시선은 현재 임시 orientation이며, 원본 대표 시선 벡터를 복구하면 그대로 교체할 수 있다.</p>
    </div>
    <div class="section-head ${SIMULATION_ANCHOR_CLASS}" style="display:none" aria-hidden="true">
      <h2>Projection class tables</h2>
      <p>simulation mount anchor</p>
    </div>
    <div class="projection-tables" data-theory-enhanced="true" data-simulation-anchor="true" style="display:none" aria-hidden="true"></div>
  `;

  import('./projection-selector.js?v=projection-selector-20260903-4')
    .then(module => module.mountProjectionSelector())
    .catch(error => console.warn('[simulation] projection renderer failed', error));
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
