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
      <p>속성별 정다면체에서 사영 클래스를 좌우 드래그로 전환하는 인터랙션 실험</p>
    </div>
    <div class="card">
      <p class="core-statement" style="font-size:15px">정다면체 선택 → 좌우 드래그 → 다음 사영도로 스냅</p>
      <p class="muted" style="margin:10px 0 0">현재 단계에서는 선택 감각과 전환 연출만 검증한다. 실제 3D 회전과 게임 상태 저장은 이후 단계에서 연결한다.</p>
    </div>
    <div class="section-head ${SIMULATION_ANCHOR_CLASS}" style="display:none" aria-hidden="true">
      <h2>Projection class tables</h2>
      <p>simulation mount anchor</p>
    </div>
    <div class="projection-tables" data-theory-enhanced="true" data-simulation-anchor="true" style="display:none" aria-hidden="true"></div>
  `;
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
