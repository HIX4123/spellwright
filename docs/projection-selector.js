const SELECTOR_ID = 'projectionSelectorPrototype';
const SWIPE_THRESHOLD = 0.23;
const VELOCITY_THRESHOLD = 0.55;
const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

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

function normalizeVertices(vertices) {
  const radius = Math.max(...vertices.map(([x, y, z]) => Math.hypot(x, y, z)));
  return vertices.map(([x, y, z]) => [x / radius, y / radius, z / radius]);
}

function signedPermutations(values) {
  const out = [];
  const [a, b, c] = values;
  const perms = [
    [a, b, c], [a, c, b], [b, a, c],
    [b, c, a], [c, a, b], [c, b, a]
  ];
  const seen = new Set();
  for (const p of perms) {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const v = [p[0] * sx, p[1] * sy, p[2] * sz];
      const key = v.map(n => n.toFixed(8)).join(',');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(v);
      }
    }
  }
  return out;
}

function geometryForSolid(name) {
  const phi = (1 + Math.sqrt(5)) / 2;
  const inv = 1 / phi;
  let vertices;

  switch (name) {
    case '정사면체':
      vertices = [[1,1,1], [1,-1,-1], [-1,1,-1], [-1,-1,1]];
      break;
    case '정육면체':
      vertices = [];
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) vertices.push([x, y, z]);
      break;
    case '정팔면체':
      vertices = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
      break;
    case '정십이면체':
      vertices = [];
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) vertices.push([x, y, z]);
      for (const a of [-inv, inv]) for (const b of [-phi, phi]) {
        vertices.push([0, a, b], [a, b, 0], [b, 0, a]);
      }
      break;
    case '정이십면체':
      vertices = [];
      for (const a of [-1, 1]) for (const b of [-phi, phi]) {
        vertices.push([0, a, b], [a, b, 0], [b, 0, a]);
      }
      break;
    default:
      vertices = signedPermutations([1, 1, 1]);
  }

  vertices = normalizeVertices(vertices);
  let edgeLength = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const d = Math.hypot(
        vertices[i][0] - vertices[j][0],
        vertices[i][1] - vertices[j][1],
        vertices[i][2] - vertices[j][2]
      );
      if (d > 1e-6 && d < edgeLength) edgeLength = d;
    }
  }

  const edges = [];
  const tolerance = edgeLength * 0.035;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const d = Math.hypot(
        vertices[i][0] - vertices[j][0],
        vertices[i][1] - vertices[j][1],
        vertices[i][2] - vertices[j][2]
      );
      if (Math.abs(d - edgeLength) <= tolerance) edges.push([i, j]);
    }
  }
  return { vertices, edges };
}

const GEOMETRY_CACHE = new Map();
function getGeometry(name) {
  if (!GEOMETRY_CACHE.has(name)) GEOMETRY_CACHE.set(name, geometryForSolid(name));
  return GEOMETRY_CACHE.get(name);
}

function classOrientation(index, count, solidIndex) {
  const t = count <= 1 ? 0 : index / count;
  const yaw = t * TAU + solidIndex * 0.31;
  const pitch = 0.48 * Math.sin(t * TAU * 1.5 + solidIndex * 0.73);
  const roll = 0.18 * Math.sin(t * TAU * 2 + solidIndex * 0.41);
  return { yaw, pitch, roll };
}

function shortestAngleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function lerpOrientation(a, b, t) {
  return {
    yaw: a.yaw + shortestAngleDelta(a.yaw, b.yaw) * t,
    pitch: a.pitch + shortestAngleDelta(a.pitch, b.pitch) * t,
    roll: a.roll + shortestAngleDelta(a.roll, b.roll) * t
  };
}

function rotateVertex([x, y, z], o) {
  const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw);
  const cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
  const cr = Math.cos(o.roll), sr = Math.sin(o.roll);

  let x1 = x * cy + z * sy;
  let z1 = -x * sy + z * cy;
  let y1 = y;

  let y2 = y1 * cp - z1 * sp;
  let z2 = y1 * sp + z1 * cp;
  let x2 = x1;

  return [
    x2 * cr - y2 * sr,
    x2 * sr + y2 * cr,
    z2
  ];
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

function renderSolid(canvas, solidName, orientation, motion = 0) {
  const { width, height, dpr } = resizeCanvas(canvas);
  const ctx = canvas.getContext('2d');
  const geometry = getGeometry(solidName);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const cssW = width / dpr;
  const cssH = height / dpr;
  const scale = Math.min(cssW, cssH) * 0.31;
  const centerX = cssW * 0.5;
  const centerY = cssH * 0.48;
  const cameraDistance = 4.2;
  const darkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
  const ink = darkTheme ? '232, 236, 242' : '20, 26, 34';

  const points = geometry.vertices.map(vertex => {
    const [x, y, z] = rotateVertex(vertex, orientation);
    const perspective = cameraDistance / (cameraDistance - z * 0.7);
    return {
      x: centerX + x * scale * perspective,
      y: centerY - y * scale * perspective,
      z,
      p: perspective
    };
  });

  const edgeDepths = geometry.edges.map(([a, b]) => ({
    a, b,
    z: (points[a].z + points[b].z) * 0.5
  })).sort((u, v) => u.z - v.z);

  for (const edge of edgeDepths) {
    const a = points[edge.a];
    const b = points[edge.b];
    const depth = clamp((edge.z + 1) * 0.5, 0, 1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(${ink}, ${0.18 + depth * 0.68})`;
    ctx.lineWidth = 0.75 + depth * 1.65 + Math.abs(motion) * 0.25;
    ctx.stroke();
  }

  const sortedPoints = points.map((p, i) => ({ ...p, i })).sort((a, b) => a.z - b.z);
  for (const p of sortedPoints) {
    const depth = clamp((p.z + 1) * 0.5, 0, 1);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.6 + depth * 1.7, 0, TAU);
    ctx.fillStyle = `rgba(${ink}, ${0.25 + depth * 0.72})`;
    ctx.fill();
  }

  ctx.restore();
}

function inject3dStyles() {
  if (document.getElementById('projection3dRuntimeStyles')) return;
  const style = document.createElement('style');
  style.id = 'projection3dRuntimeStyles';
  style.textContent = `
    .projection-selector-3d .projection-stage-3d{position:relative;isolation:isolate}
    .projection-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:2;pointer-events:none}
    .projection-selector-3d .projection-stage-grid{z-index:0}
    .projection-selector-3d .projection-stage-shadow{z-index:1}
    .projection-axis-badge{position:absolute;left:12px;bottom:10px;z-index:3;padding:4px 7px;border:1px solid var(--line);border-radius:999px;background:color-mix(in srgb,var(--surface) 82%,transparent);color:var(--muted);font-size:8px;font-weight:700;letter-spacing:.12em;pointer-events:none;backdrop-filter:blur(8px)}
    .projection-selector-3d .projection-drag-cue{z-index:3}
    .projection-selector-3d .projection-stage.is-dragging .projection-axis-badge{opacity:.58}
    html[data-theme="dark"] .projection-selector-3d .projection-stage{background:#111317;border-color:rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 12px 36px rgba(0,0,0,.22)}
    html[data-theme="dark"] .projection-selector-3d .projection-stage-grid{background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)}
  `;
  document.head.appendChild(style);
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
  inject3dStyles();
  const root = document.createElement('section');
  root.id = SELECTOR_ID;
  root.className = 'card projection-selector projection-selector-3d';

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
      <span class="projection-selector-instruction">REAL 3D · DRAG · ← →</span>
    </div>

    <div class="projection-selector-stage-row">
      <button class="projection-step projection-step-prev" type="button" aria-label="이전 사영도">‹</button>
      <div class="projection-stage projection-stage-3d" tabindex="0" role="slider" aria-label="3D 정다면체 사영도 선택" aria-valuemin="1">
        <div class="projection-stage-grid" aria-hidden="true"></div>
        <div class="projection-stage-shadow" aria-hidden="true"></div>
        <canvas class="projection-canvas" aria-hidden="true"></canvas>
        <div class="projection-axis-badge" aria-hidden="true">3D → 2.5D</div>
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
    <p class="projection-selector-note">사진 모핑을 사용하지 않는다. 정다면체의 실제 정점·간선을 3D 회전한 뒤 원근을 약하게 적용해 2.5D wireframe으로 투영한다. 현재 class별 대표 orientation은 임시 배정값이다.</p>
    <span class="projection-selector-live" aria-live="polite"></span>
  `;

  const state = {
    solidIndex: 0,
    selectedBySolid: new Map(entries.map((_, index) => [index, 0])),
    orientation: { yaw: 0, pitch: 0, roll: 0 },
    pointerId: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    dragStartOrientation: null,
    previewDirection: 1,
    animationFrame: 0,
    locked: false
  };

  const stage = root.querySelector('.projection-stage');
  const canvas = root.querySelector('.projection-canvas');
  const shadow = root.querySelector('.projection-stage-shadow');
  const rail = root.querySelector('.projection-class-rail');
  const live = root.querySelector('.projection-selector-live');
  const kicker = root.querySelector('[data-projection-kicker]');
  const title = root.querySelector('[data-projection-title]');
  const position = root.querySelector('[data-projection-position]');

  const currentEntry = () => entries[state.solidIndex];
  const currentClasses = () => currentEntry().solid.classes;
  const currentIndex = () => state.selectedBySolid.get(state.solidIndex) || 0;

  function orientationFor(index = currentIndex()) {
    return classOrientation(index, currentClasses().length, state.solidIndex);
  }

  function targetIndex(direction) {
    return wrapIndex(currentIndex() + direction, currentClasses().length);
  }

  function draw(motion = 0) {
    renderSolid(canvas, currentEntry().solid.name, state.orientation, motion);
    const amount = Math.min(1, Math.abs(motion));
    shadow.style.transform = `translateX(calc(-50% + ${motion * 8}px)) scaleX(${1 - amount * 0.12})`;
    shadow.style.opacity = String(0.18 - amount * 0.05);
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
    state.orientation = orientationFor();
    updateMetadata({ announce });
    draw(0);
  }

  function animateOrientation(to, duration = 240, onDone) {
    cancelAnimationFrame(state.animationFrame);
    const from = { ...state.orientation };
    const started = performance.now();

    const frame = now => {
      const t = clamp((now - started) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      state.orientation = lerpOrientation(from, to, eased);
      draw(shortestAngleDelta(from.yaw, to.yaw) * (1 - eased));
      if (t < 1) state.animationFrame = requestAnimationFrame(frame);
      else {
        state.animationFrame = 0;
        state.orientation = { ...to };
        draw(0);
        onDone?.();
      }
    };
    state.animationFrame = requestAnimationFrame(frame);
  }

  function finishStep(target) {
    state.selectedBySolid.set(state.solidIndex, target);
    state.locked = false;
    stage.classList.remove('is-dragging', 'is-grabbing');
    state.orientation = orientationFor(target);
    updateMetadata({ announce: true });
    draw(0);
    stage.focus({ preventScroll: true });
  }

  function commitStep(direction, explicitTargetIndex = null) {
    if (state.locked || currentClasses().length < 2) return;
    state.locked = true;
    const normalized = direction >= 0 ? 1 : -1;
    const target = explicitTargetIndex ?? targetIndex(normalized);
    stage.classList.add('is-dragging');
    animateOrientation(orientationFor(target), 260, () => finishStep(target));
  }

  function cancelDrag() {
    if (state.locked) return;
    stage.classList.remove('is-grabbing');
    animateOrientation(orientationFor(), 180, () => {
      stage.classList.remove('is-dragging');
    });
  }

  stage.addEventListener('pointerdown', event => {
    if (state.locked || event.button !== 0) return;
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = 0;
    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.startTime = performance.now();
    state.dragStartOrientation = { ...state.orientation };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-dragging', 'is-grabbing');
  });

  stage.addEventListener('pointermove', event => {
    if (event.pointerId !== state.pointerId || state.locked) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (Math.abs(dx) > 4) event.preventDefault();

    const yawDelta = dx / Math.max(180, stage.clientWidth * 0.42) * Math.PI * 0.8;
    const pitchDelta = -dy / Math.max(160, stage.clientHeight * 0.55) * Math.PI * 0.35;
    state.orientation = {
      yaw: state.dragStartOrientation.yaw + yawDelta,
      pitch: clamp(state.dragStartOrientation.pitch + pitchDelta, -1.05, 1.05),
      roll: state.dragStartOrientation.roll + yawDelta * 0.12
    };
    draw(yawDelta);
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

  const resizeObserver = new ResizeObserver(() => draw(0));
  resizeObserver.observe(stage);

  renderStatic();
  return root;
}

export async function mountProjectionSelector() {
  const view = document.querySelector('#view');
  if (!view || view.querySelector(`#${SELECTOR_ID}`)) return false;

  const tables = view.querySelector('.projection-tables[data-simulation-anchor="true"]');
  if (!tables) return false;
  const tableHeading = tables.previousElementSibling;
  if (!tableHeading?.classList.contains('section-head')) return false;

  try {
    const { elements, solids } = await loadSelectorData();
    if (!tables.isConnected || view.querySelector(`#${SELECTOR_ID}`)) return false;
    const entries = selectorEntries(elements, solids);
    if (!entries.length) return false;
    const selector = createSelector(entries);
    tableHeading.before(selector);
    return true;
  } catch (error) {
    console.warn('[projection-selector] failed to mount', error);
    return false;
  }
}

const observer = new MutationObserver(() => mountProjectionSelector());
const start = () => {
  const view = document.getElementById('view');
  if (!view) return;
  observer.observe(view, { childList: true, subtree: false });
  mountProjectionSelector();
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
