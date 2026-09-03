import { clamp, dragProgress, geometryForSolid, interpolateFrames, projectVertices, projectionEvents, swipeDirection, viewFrame, wrapIndex } from './projection-core.js?v=projection-core-20260903-1';

const SELECTOR_ID = 'projectionSelectorPrototype';
const TAU = Math.PI * 2;
export const DEFAULT_TRANSITION_DURATION_MS = 2000;

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, dpr };
}

function renderProjection(canvas, geometry, frame) {
  const { width, height, dpr } = resizeCanvas(canvas);
  const ctx = canvas.getContext('2d');
  const points = projectVertices(geometry.vertices, frame);
  const events = projectionEvents(points, geometry.edges);
  const vertexEvents = events.filter(event => event.vertexIds.size > 0);
  const crossingEvents = events.filter(event => event.vertexIds.size === 0 && event.edgeIds.size >= 2);

  const minX = Math.min(...points.map(point => point[0]));
  const maxX = Math.max(...points.map(point => point[0]));
  const minY = Math.min(...points.map(point => point[1]));
  const maxY = Math.max(...points.map(point => point[1]));
  const span = Math.max(maxX - minX, maxY - minY, 1e-9);
  const padding = span * 0.15;
  const cssWidth = width / dpr;
  const cssHeight = height / dpr;
  const scale = Math.min(cssWidth / (maxX - minX + padding * 2), cssHeight / (maxY - minY + padding * 2));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const screenPoint = point => [
    cssWidth / 2 + (point[0] - centerX) * scale,
    cssHeight / 2 - (point[1] - centerY) * scale
  ];

  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const ink = dark ? '#e8edf2' : '#101820';
  const background = dark ? '#111317' : '#fbfbfa';
  const blue = dark ? '#73a9ff' : '#0b57d0';
  const red = dark ? '#ff7d76' : '#c62828';

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.25;
  geometry.edges.forEach(([a, b]) => {
    const p0 = screenPoint(points[a]);
    const p1 = screenPoint(points[b]);
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.stroke();
  });

  crossingEvents.forEach(event => {
    const point = screenPoint(event.xy);
    ctx.beginPath();
    ctx.arc(point[0], point[1], 4.1, 0, TAU);
    ctx.fillStyle = background;
    ctx.fill();
    ctx.strokeStyle = red;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  });

  vertexEvents.forEach(event => {
    const point = screenPoint(event.xy);
    ctx.beginPath();
    ctx.arc(point[0], point[1], 4.4, 0, TAU);
    ctx.fillStyle = ink;
    ctx.fill();

    if (event.vertexIds.size > 1) {
      ctx.fillStyle = blue;
      ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`×${event.vertexIds.size}`, point[0] + 7, point[1] - 5);
    }
  });

  ctx.restore();
}

let selectorDataPromise;
async function loadSelectorData() {
  if (!selectorDataPromise) {
    selectorDataPromise = Promise.all([
      fetch('./data/project.json', { cache: 'no-store' }),
      fetch('./data/projections.json', { cache: 'no-store' }),
      fetch('./data/projection-views.json', { cache: 'no-store' })
    ]).then(async ([projectResponse, projectionResponse, viewResponse]) => {
      if (!projectResponse.ok || !projectionResponse.ok || !viewResponse.ok) {
        throw new Error('Failed to load projection simulation data');
      }
      const [project, projectionData, viewData] = await Promise.all([
        projectResponse.json(), projectionResponse.json(), viewResponse.json()
      ]);
      return {
        elements: project.elements || [],
        solids: projectionData.solids || [],
        viewSolids: viewData.solids || []
      };
    });
  }
  return selectorDataPromise;
}

function selectorEntries(elements, solids, viewSolids) {
  return elements.map(element => {
    const solid = solids.find(item => item.name === element.solid);
    const viewSolid = viewSolids.find(item => item.name === element.solid);
    if (!solid || !viewSolid) return null;
    const viewsByClass = new Map(viewSolid.views.map(view => [view.classId, view]));
    if (solid.classes.some(item => !viewsByClass.has(item.id))) return null;
    return { element, solid, viewsByClass, geometry: geometryForSolid(solid.name) };
  }).filter(Boolean);
}

function injectRuntimeStyles() {
  if (document.getElementById('projectionSimulationRuntimeStyles')) return;
  const style = document.createElement('style');
  style.id = 'projectionSimulationRuntimeStyles';
  style.textContent = `
    .projection-selector-orthographic .projection-stage{position:relative;isolation:isolate;touch-action:pan-y;user-select:none}
    .projection-selector-orthographic .projection-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:2}
    .projection-selector-orthographic .projection-stage-grid{z-index:0;opacity:.28}
    .projection-selector-orthographic .projection-stage-shadow{display:none}
    .projection-selector-orthographic .projection-drag-cue{z-index:3;pointer-events:none}
    .projection-projection-badge{position:absolute;left:12px;bottom:10px;z-index:3;padding:4px 7px;border:1px solid var(--line);border-radius:999px;background:color-mix(in srgb,var(--surface) 82%,transparent);color:var(--muted);font-size:8px;font-weight:700;letter-spacing:.1em;pointer-events:none}
  `;
  document.head.appendChild(style);
}

function createSelector(entries) {
  injectRuntimeStyles();
  const root = document.createElement('section');
  root.id = SELECTOR_ID;
  root.className = 'card projection-selector projection-selector-orthographic';
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
      <span class="projection-selector-instruction">ORTHOGRAPHIC · HORIZONTAL DRAG · ← →</span>
    </div>

    <div class="projection-selector-stage-row">
      <button class="projection-step projection-step-prev" type="button" aria-label="이전 사영도">‹</button>
      <div class="projection-stage" tabindex="0" role="slider" aria-label="정다면체 사영도 선택" aria-valuemin="1">
        <div class="projection-stage-grid" aria-hidden="true"></div>
        <canvas class="projection-canvas" aria-hidden="true"></canvas>
        <div class="projection-projection-badge" aria-hidden="true">3D → ORTHOGRAPHIC 2D</div>
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
    <p class="projection-selector-note">원근법 없는 정투영. 좌우 드래그는 이전·다음 사영만 선택하며, 회전 경로는 현재 class 순서에 고정된다. 각 정지점은 기존 사영 이미지와 같은 대표 시선·화면 방향을 사용한다.</p>
    <span class="projection-selector-live" aria-live="polite"></span>
  `;

  const state = {
    solidIndex: 0,
    selectedBySolid: new Map(entries.map((_, index) => [index, 0])),
    frame: null,
    progress: 0,
    previewDirection: 1,
    pointerId: null,
    startX: 0,
    startTime: 0,
    animationFrame: 0,
    locked: false,
    queue: [],
    stepDuration: null
  };

  const stage = root.querySelector('.projection-stage');
  const canvas = root.querySelector('.projection-canvas');
  const rail = root.querySelector('.projection-class-rail');
  const live = root.querySelector('.projection-selector-live');
  const kicker = root.querySelector('[data-projection-kicker]');
  const title = root.querySelector('[data-projection-title]');
  const position = root.querySelector('[data-projection-position]');

  const currentEntry = () => entries[state.solidIndex];
  const currentClasses = () => currentEntry().solid.classes;
  const currentIndex = () => state.selectedBySolid.get(state.solidIndex) || 0;
  const targetIndex = direction => wrapIndex(currentIndex() + direction, currentClasses().length);
  const frameFor = index => {
    const item = currentClasses()[index];
    const view = currentEntry().viewsByClass.get(item.id);
    return viewFrame(view.viewDirection, view.rollDegrees);
  };

  function draw() {
    renderProjection(canvas, currentEntry().geometry, state.frame);
  }

  function renderRail() {
    rail.innerHTML = currentClasses().map((item, index) => `
      <button type="button" class="projection-class-chip${index === currentIndex() ? ' active' : ''}"
        data-class-index="${index}" aria-pressed="${index === currentIndex()}">
        ${String(item.id).padStart(2, '0')}
      </button>`).join('');
  }

  function updateMetadata({ announce = false } = {}) {
    const entry = currentEntry();
    const classes = currentClasses();
    const item = classes[currentIndex()];

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

    renderRail();
    if (announce) live.textContent = `${entry.element.name} ${entry.solid.name}, Class ${item.id} ${item.label}`;
  }

  function renderStatic({ announce = false } = {}) {
    state.progress = 0;
    state.frame = frameFor(currentIndex());
    updateMetadata({ announce });
    draw();
  }

  function animateToFrame(targetFrame, duration, onDone) {
    cancelAnimationFrame(state.animationFrame);
    const sourceFrame = state.frame;
    const started = performance.now();
    const frame = now => {
      const t = clamp((now - started) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      state.frame = interpolateFrames(sourceFrame, targetFrame, eased);
      draw();
      if (t < 1) state.animationFrame = requestAnimationFrame(frame);
      else {
        state.animationFrame = 0;
        state.frame = targetFrame;
        draw();
        onDone?.();
      }
    };
    state.animationFrame = requestAnimationFrame(frame);
  }

  function finishOneStep(target, continueQueue) {
    state.selectedBySolid.set(state.solidIndex, target);
    state.progress = 0;
    state.frame = frameFor(target);
    updateMetadata({ announce: true });
    draw();
    continueQueue();
  }

  function runQueue() {
    if (!state.queue.length) {
      state.locked = false;
      state.stepDuration = null;
      stage.classList.remove('is-dragging', 'is-grabbing');
      stage.focus({ preventScroll: true });
      return;
    }

    const direction = state.queue.shift();
    const target = targetIndex(direction);
    const targetFrame = frameFor(target);
    stage.classList.add('is-dragging');
    const duration = state.stepDuration ?? DEFAULT_TRANSITION_DURATION_MS;
    animateToFrame(targetFrame, duration, () => finishOneStep(target, runQueue));
  }

  function commitSteps(directions, totalDuration = DEFAULT_TRANSITION_DURATION_MS) {
    if (state.locked || !directions.length) return;
    state.locked = true;
    state.stepDuration = totalDuration / directions.length;
    state.queue = directions.slice();
    runQueue();
  }

  function cancelDrag() {
    if (state.locked) return;
    stage.classList.remove('is-grabbing');
    const targetFrame = frameFor(currentIndex());
    animateToFrame(targetFrame, 165, () => {
      state.progress = 0;
      stage.classList.remove('is-dragging');
    });
  }

  function routeTo(target) {
    const classes = currentClasses();
    const current = currentIndex();
    const forward = wrapIndex(target - current, classes.length);
    const backward = wrapIndex(current - target, classes.length);
    const direction = forward <= backward ? 1 : -1;
    const steps = Math.min(forward, backward);
    commitSteps(Array.from({ length: steps }, () => direction));
  }

  stage.addEventListener('pointerdown', event => {
    if (state.locked || event.button !== 0) return;
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = 0;
    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startTime = performance.now();
    state.progress = 0;
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-dragging', 'is-grabbing');
  });

  stage.addEventListener('pointermove', event => {
    if (event.pointerId !== state.pointerId || state.locked) return;
    const dx = event.clientX - state.startX;
    if (Math.abs(dx) > 4) event.preventDefault();
    const progress = dragProgress(dx, stage.clientWidth);
    const direction = progress === 0 ? state.previewDirection : Math.sign(progress);
    state.previewDirection = direction;
    state.progress = progress;
    state.frame = interpolateFrames(frameFor(currentIndex()), frameFor(targetIndex(direction)), Math.abs(progress));
    draw();
  });

  stage.addEventListener('pointerup', event => {
    if (event.pointerId !== state.pointerId || state.locked) return;
    const dx = event.clientX - state.startX;
    const elapsed = performance.now() - state.startTime;
    const direction = swipeDirection(dx, stage.clientWidth, elapsed);
    state.pointerId = null;
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    stage.classList.remove('is-grabbing');
    if (direction) {
      const remaining = Math.max(0.08, 1 - Math.abs(state.progress));
      commitSteps([direction], DEFAULT_TRANSITION_DURATION_MS * remaining);
    } else cancelDrag();
  });

  stage.addEventListener('pointercancel', event => {
    if (event.pointerId !== state.pointerId) return;
    state.pointerId = null;
    cancelDrag();
  });

  stage.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      commitSteps([-1]);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      commitSteps([1]);
    }
  });

  root.querySelector('.projection-step-prev').addEventListener('click', () => commitSteps([-1]));
  root.querySelector('.projection-step-next').addEventListener('click', () => commitSteps([1]));

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
    routeTo(target);
  });

  if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(stage);
  }

  renderStatic();
  return root;
}

export async function mountProjectionSelector() {
  const view = document.querySelector('#view');
  if (!view) return false;
  if (view.querySelector(`#${SELECTOR_ID}`)) return true;

  const anchor = view.querySelector('.projection-tables[data-simulation-anchor="true"]');
  if (!anchor) return false;
  const heading = anchor.previousElementSibling;
  if (!heading?.classList.contains('section-head')) return false;

  try {
    const { elements, solids, viewSolids } = await loadSelectorData();
    if (!anchor.isConnected || view.querySelector(`#${SELECTOR_ID}`)) return false;
    const entries = selectorEntries(elements, solids, viewSolids);
    if (!entries.length) throw new Error('Projection simulation has no complete solid/view entries');
    heading.before(createSelector(entries));
    return true;
  } catch (error) {
    console.warn('[projection-selector] failed to mount simulation', error);
    return false;
  }
}
