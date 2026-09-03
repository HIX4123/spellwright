const SELECTOR_ID = 'projectionSelectorPrototype';
const SECTION_ID = 'projectionSelectorSection';
const SWIPE_THRESHOLD = 0.23;
const VELOCITY_THRESHOLD = 0.55;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function wrapIndex(index, length) {
  if (!length) return 0;
  return ((index % length) + length) % length;
}

export function swipeDirection(dx, width, elapsedMs = 1000) {
  const span = Math.max(140, width * 0.34);
  const progress = clamp(-dx / span, -1, 1);
  const velocity = Math.abs(dx) / Math.max(1, elapsedMs);
  if (Math.abs(progress) < SWIPE_THRESHOLD && velocity < VELOCITY_THRESHOLD) return 0;
  return progress > 0 ? 1 : -1;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

let selectorDataPromise;

async function loadSelectorData() {
  if (!selectorDataPromise) {
    selectorDataPromise = Promise.all([
      fetch('./data/project.json', { cache: 'no-store' }),
      fetch('./data/projections.json', { cache: 'no-store' })
    ]).then(async ([projectResponse, projectionResponse]) => {
      if (!projectResponse.ok || !projectionResponse.ok) throw new Error('Failed to load projection selector data');
      const project = await projectResponse.json();
      const projectionData = await projectionResponse.json();
      return { elements: project.elements || [], solids: projectionData.solids || [] };
    });
  }
  return selectorDataPromise;
}

function selectorEntries(elements, solids) {
  return elements
    .map(element => ({ element, solid: solids.find(solid => solid.name === element.solid) }))
    .filter(entry => entry.solid?.classes?.length);
}

function createSelector(entries) {
  const root = document.createElement('section');
  root.id = SELECTOR_ID;
  root.className = 'card projection-selector';

  root.innerHTML = `
    <div class="projection-selector-toolbar">
      <div class="projection-solid-tabs" role="tablist" aria-label="정다면체 선택">
        ${entries.map((entry, index) => `
          <button class="projection-solid-tab${index === 0 ? ' active' : ''}" type="button" role="tab"
            aria-selected="${index === 0}" data-solid-index="${index}">
            <strong>${escapeHtml(entry.element.name)}</strong>
            <span>${escapeHtml(entry.solid.name)}</span>
          </button>`).join('')}
      </div>
      <span class="projection-selector-instruction">DRAG · ← →</span>
    </div>

    <div class="projection-selector-stage-row">
      <button class="projection-step projection-step-prev" type="button" aria-label="이전 사영도">‹</button>
      <div class="projection-stage" tabindex="0" role="slider" aria-label="사영도 선택" aria-valuemin="1">
        <div class="projection-stage-grid" aria-hidden="true"></div>
        <div class="projection-stage-shadow" aria-hidden="true"></div>
        <div class="projection-visual" aria-hidden="true">
          <img class="projection-selector-image projection-selector-image-current" draggable="false" alt="" />
          <img class="projection-selector-image projection-selector-image-next" draggable="false" alt="" />
        </div>
        <span class="projection-drag-cue" aria-hidden="true">↔</span>
      </div>
      <button class="projection-step projection-step-next" type="button" aria-label="다음 사영도">›</button>
    </div>

    <div class="projection-selector-footer">
      <div class="projection-selector-copy">
        <span class="detail-kicker" data-projection-kicker></span>
        <strong data-projection-title></strong>
        <span data-projection-position></span>
      </div>
      <dl class="projection-selector-metrics">
        <div><dt>교차</dt><dd data-metric="crossings"></dd></div>
        <div><dt>정점군</dt><dd data-metric="vertexClusters"></dd></div>
        <div><dt>최대 중첩</dt><dd data-metric="maxVertexOverlap"></dd></div>
        <div><dt>안정자</dt><dd data-metric="stabilizer"></dd></div>
      </dl>
    </div>

    <div class="projection-class-rail" role="group" aria-label="사영 클래스 바로 선택"></div>
    <p class="projection-selector-note">현재는 선택 감각을 검증하는 interaction prototype이다. 선택 결과는 게임 상태에 저장하지 않는다.</p>
    <span class="projection-selector-live" aria-live="polite"></span>
  `;

  const state = {
    solidIndex: 0,
    selectedBySolid: new Map(entries.map((_, index) => [index, 0])),
    previewDirection: 1,
    progress: 0,
    pointerId: null,
    startX: 0,
    startTime: 0,
    animationFrame: 0,
    locked: false
  };

  const stage = root.querySelector('.projection-stage');
  const currentImage = root.querySelector('.projection-selector-image-current');
  const nextImage = root.querySelector('.projection-selector-image-next');
  const shadow = root.querySelector('.projection-stage-shadow');
  const rail = root.querySelector('.projection-class-rail');
  const live = root.querySelector('.projection-selector-live');
  const kicker = root.querySelector('[data-projection-kicker]');
  const title = root.querySelector('[data-projection-title]');
  const position = root.querySelector('[data-projection-position]');

  const currentEntry = () => entries[state.solidIndex];
  const currentClasses = () => currentEntry().solid.classes;
  const currentIndex = () => state.selectedBySolid.get(state.solidIndex) || 0;

  function targetIndex(direction) {
    return wrapIndex(currentIndex() + direction, currentClasses().length);
  }

  function prepareNext(direction, explicitTargetIndex = null) {
    const normalized = direction >= 0 ? 1 : -1;
    state.previewDirection = normalized;
    const index = explicitTargetIndex ?? targetIndex(normalized);
    const item = currentClasses()[index];
    nextImage.src = item.image;
    nextImage.alt = '';
  }

  function resetTransforms() {
    state.progress = 0;
    currentImage.style.opacity = '1';
    currentImage.style.transform = 'translate3d(0,0,0) rotate(0deg) rotateY(0deg) scale(1)';
    nextImage.style.opacity = '0';
    nextImage.style.transform = 'translate3d(42px,0,0) rotate(10deg) rotateY(-52deg) scale(.965)';
    shadow.style.transform = 'translateX(-50%) scaleX(1)';
    shadow.style.opacity = '.18';
  }

  function renderRail() {
    rail.innerHTML = currentClasses().map((item, index) => `
      <button type="button" class="projection-class-chip${index === currentIndex() ? ' active' : ''}"
        data-class-index="${index}" aria-pressed="${index === currentIndex()}">
        ${String(item.id).padStart(2, '0')}
      </button>`).join('');
  }

  function renderStatic({ announce = false } = {}) {
    const entry = currentEntry();
    const classes = currentClasses();
    const item = classes[currentIndex()];

    currentImage.src = item.image;
    currentImage.alt = `${entry.element.name} ${entry.solid.name} Class ${item.id} 사영도`;
    kicker.textContent = `${entry.element.name} · ${entry.solid.name}`;
    title.textContent = `Class #${String(item.id).padStart(2, '0')} · ${item.label}`;
    position.textContent = `${currentIndex() + 1} / ${classes.length}`;
    root.querySelector('[data-metric="crossings"]').textContent = String(item.crossings);
    root.querySelector('[data-metric="vertexClusters"]').textContent = String(item.vertexClusters);
    root.querySelector('[data-metric="maxVertexOverlap"]').textContent = `×${item.maxVertexOverlap}`;
    root.querySelector('[data-metric="stabilizer"]').textContent = String(item.stabilizer);

    stage.setAttribute('aria-valuemax', String(classes.length));
    stage.setAttribute('aria-valuenow', String(currentIndex() + 1));
    stage.setAttribute('aria-valuetext', `Class ${item.id}, ${item.label}`);

    root.querySelectorAll('.projection-solid-tab').forEach((button, index) => {
      const active = index === state.solidIndex;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });

    prepareNext(1);
    resetTransforms();
    renderRail();
    preloadAdjacent();

    if (announce) live.textContent = `${entry.element.name} ${entry.solid.name}, Class ${item.id} ${item.label}`;
  }

  function preloadAdjacent() {
    const classes = currentClasses();
    if (classes.length < 2) return;
    [-1, 1].forEach(direction => {
      const image = new Image();
      image.src = classes[targetIndex(direction)].image;
    });
  }

  function applyProgress(progress) {
    const nextProgress = clamp(progress, -1, 1);
    if (nextProgress !== 0) {
      const direction = nextProgress > 0 ? 1 : -1;
      if (direction !== state.previewDirection) prepareNext(direction);
    }

    state.progress = nextProgress;
    const amount = Math.abs(nextProgress);
    const direction = nextProgress === 0 ? state.previewDirection : Math.sign(nextProgress);
    const blend = 1 - Math.pow(1 - amount, 2);
    const arc = Math.sin(amount * Math.PI) * -8;
    const incoming = direction * (1 - amount);

    currentImage.style.opacity = String(1 - blend);
    currentImage.style.transform = `translate3d(${-nextProgress * 28}px, ${arc}px, 0) rotate(${-nextProgress * 9}deg) rotateY(${nextProgress * 48}deg) scale(${1 - amount * 0.035})`;
    nextImage.style.opacity = String(blend);
    nextImage.style.transform = `translate3d(${incoming * 42}px, ${arc * 0.55}px, 0) rotate(${incoming * 10}deg) rotateY(${incoming * -52}deg) scale(${0.965 + amount * 0.035})`;
    shadow.style.transform = `translateX(calc(-50% + ${nextProgress * 12}px)) scaleX(${1 - amount * 0.12})`;
    shadow.style.opacity = String(0.18 - amount * 0.06);
  }

  function animateProgress(to, duration, onDone) {
    cancelAnimationFrame(state.animationFrame);
    const from = state.progress;
    const started = performance.now();

    const frame = now => {
      const t = clamp((now - started) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      applyProgress(from + (to - from) * eased);
      if (t < 1) state.animationFrame = requestAnimationFrame(frame);
      else {
        state.animationFrame = 0;
        onDone?.();
      }
    };

    state.animationFrame = requestAnimationFrame(frame);
  }

  function finishStep(target) {
    state.selectedBySolid.set(state.solidIndex, target);
    state.locked = false;
    state.progress = 0;
    stage.classList.remove('is-dragging', 'is-grabbing');
    renderStatic({ announce: true });
    stage.focus({ preventScroll: true });
  }

  function commitStep(direction, explicitTargetIndex = null) {
    if (state.locked || currentClasses().length < 2) return;
    state.locked = true;
    const normalized = direction >= 0 ? 1 : -1;
    const target = explicitTargetIndex ?? targetIndex(normalized);
    prepareNext(normalized, target);
    stage.classList.add('is-dragging');
    animateProgress(normalized, 180, () => finishStep(target));
  }

  function cancelDrag() {
    if (state.locked) return;
    stage.classList.remove('is-grabbing');
    animateProgress(0, 145, () => {
      stage.classList.remove('is-dragging');
      resetTransforms();
    });
  }

  stage.addEventListener('pointerdown', event => {
    if (state.locked || event.button !== 0) return;
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = 0;
    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startTime = performance.now();
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-dragging', 'is-grabbing');
  });

  stage.addEventListener('pointermove', event => {
    if (event.pointerId !== state.pointerId || state.locked) return;
    const dx = event.clientX - state.startX;
    if (Math.abs(dx) > 4) event.preventDefault();
    const span = Math.max(140, stage.clientWidth * 0.34);
    applyProgress(-dx / span);
  });

  stage.addEventListener('pointerup', event => {
    if (event.pointerId !== state.pointerId || state.locked) return;
    const dx = event.clientX - state.startX;
    const elapsed = performance.now() - state.startTime;
    const direction = swipeDirection(dx, stage.clientWidth, elapsed);
    state.pointerId = null;
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    if (direction) commitStep(direction);
    else cancelDrag();
  });

  stage.addEventListener('pointercancel', event => {
    if (event.pointerId !== state.pointerId) return;
    state.pointerId = null;
    cancelDrag();
  });

  stage.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      commitStep(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      commitStep(1);
    }
  });

  root.querySelector('.projection-step-prev').addEventListener('click', () => commitStep(-1));
  root.querySelector('.projection-step-next').addEventListener('click', () => commitStep(1));

  root.querySelector('.projection-solid-tabs').addEventListener('click', event => {
    const button = event.target.closest('.projection-solid-tab');
    if (!button || state.locked) return;
    const index = Number(button.dataset.solidIndex);
    if (!Number.isInteger(index) || index === state.solidIndex) return;
    state.solidIndex = index;
    renderStatic({ announce: true });
  });

  rail.addEventListener('click', event => {
    const button = event.target.closest('.projection-class-chip');
    if (!button || state.locked) return;
    const target = Number(button.dataset.classIndex);
    if (!Number.isInteger(target) || target === currentIndex()) return;
    const classes = currentClasses();
    const forward = wrapIndex(target - currentIndex(), classes.length);
    const backward = wrapIndex(currentIndex() - target, classes.length);
    commitStep(forward <= backward ? 1 : -1, target);
  });

  renderStatic();
  return root;
}

async function mountProjectionSelector() {
  const view = document.querySelector('#view');
  if (!view || view.querySelector(`#${SELECTOR_ID}`)) return;
  const tables = view.querySelector('.projection-tables');
  if (!tables) return;
  const tableHeading = tables.previousElementSibling;
  if (!tableHeading?.classList.contains('section-head')) return;

  try {
    const { elements, solids } = await loadSelectorData();
    if (!tables.isConnected || view.querySelector('.projection-tables') !== tables || view.querySelector(`#${SELECTOR_ID}`)) return;
    const entries = selectorEntries(elements, solids);
    if (!entries.length) return;

    const heading = document.createElement('div');
    heading.id = SECTION_ID;
    heading.className = 'section-head projection-selector-section-head';
    heading.innerHTML = '<h2>Projection selector</h2><p>정다면체 선택 → 좌우 드래그 → 다음 사영도로 스냅</p>';

    tableHeading.before(heading, createSelector(entries));
  } catch (error) {
    console.warn('[projection-selector] mount failed', error);
  }
}

function initProjectionSelector() {
  const view = document.querySelector('#view');
  if (!view) return;
  const observer = new MutationObserver(() => mountProjectionSelector());
  observer.observe(view, { childList: true });
  mountProjectionSelector();
}

if (typeof document !== 'undefined') initProjectionSelector();
