import {
  clamp,
  dragProgress,
  geometryForSolid,
  interpolateFrames,
  projectVertices,
  projectionEvents,
  swipeDirection,
  viewFrame,
  wrapIndex
} from './projection-core.js?v=projection-core-20260903-1';
import { analyzeProjectionStructure } from './projection-geometry-analysis.js?v=convex-hull-layers-20260927-1';
import { renderProjectionFeatureTags } from './projection-features.js?v=refactor-20260927-1';
import { mountProjectionFeatureGuides, updateProjectionFeatureGuides } from './projection-feature-guides.js?v=refactor-20260927-1';

const SELECTOR_ID = 'projectionSelectorPrototype';
const TAU = Math.PI * 2;
export const DEFAULT_TRANSITION_DURATION_MS = 2000;

export function filteredProjectionIndices(classes, classifications = new Map(), filters = {}, query = '') {
  const term = query.trim().toLocaleLowerCase();
  const expected = {
    radialLayers: filters.radialLayers === '' || filters.radialLayers == null ? null : Number(filters.radialLayers),
    convexHullLayers: filters.convexHullLayers === '' || filters.convexHullLayers == null ? null : Number(filters.convexHullLayers),
    symmetryAxes: filters.symmetryAxes === '' || filters.symmetryAxes == null ? null : Number(filters.symmetryAxes),
    rotationalOrder: filters.rotationalOrder === '' || filters.rotationalOrder == null ? null : Number(filters.rotationalOrder),
    eulerTrail: filters.eulerTrail === '' || filters.eulerTrail == null ? null : String(filters.eulerTrail) === 'true'
  };
  return classes.flatMap((item, index) => {
    const structure = classifications.get(item.id);
    const matchesStructure = Object.entries(expected).every(([key, value]) =>
      value === null || structure?.[key] === value);
    const haystack = [
      item.id,
      item.role.name,
      item.role.structure,
      item.role.description,
      item.role.example,
      structure ? `동심차수 ${structure.radialLayers}층 Convex Hull ${structure.convexHullLayers}층 대칭축 ${structure.symmetryAxes} 대칭차수 ${structure.rotationalOrder}차 Euler Trail ${structure.eulerTrail ? '가능' : '불가'}` : ''
    ].join(' ').toLocaleLowerCase();
    return matchesStructure && (!term || haystack.includes(term)) ? [index] : [];
  });
}

function compareClassificationValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

export function availableClassificationValues(
  classes,
  classifications = new Map(),
  filters = {},
  key,
  query = ''
) {
  const relaxedFilters = { ...filters, [key]: '' };
  return [...new Set(
    filteredProjectionIndices(classes, classifications, relaxedFilters, query)
      .map(index => classifications.get(classes[index].id)?.[key])
      .filter(value => value !== undefined && value !== null)
  )].sort(compareClassificationValues);
}

export function activeProjectionEntryIndices(entryCount, selectedIndices = []) {
  const selected = [...new Set(selectedIndices)]
    .filter(index => Number.isInteger(index) && index >= 0 && index < entryCount)
    .sort((a, b) => a - b);
  return selected.length ? selected : Array.from({ length: entryCount }, (_, index) => index);
}

export function filteredProjectionTargets(entries, entryIndices, filters = {}, query = '') {
  return entryIndices.flatMap(entryIndex => {
    const entry = entries[entryIndex];
    if (!entry) return [];
    return filteredProjectionIndices(
      entry.solid.classes,
      entry.classificationsByClass,
      filters,
      query
    ).map(classIndex => ({ entryIndex, classIndex }));
  });
}

export function availableClassificationValuesAcrossEntries(
  entries,
  entryIndices,
  filters = {},
  key,
  query = ''
) {
  return [...new Set(entryIndices.flatMap(entryIndex => {
    const entry = entries[entryIndex];
    if (!entry) return [];
    return availableClassificationValues(
      entry.solid.classes,
      entry.classificationsByClass,
      filters,
      key,
      query
    );
  }))].sort(compareClassificationValues);
}

function optionMarkup(values, suffix, labels = {}, emptyLabel = '전체') {
  return [`<option value="">${escapeHtml(emptyLabel)}</option>`, ...values.map(value => {
    const raw = String(value);
    const label = labels[raw] ?? `${raw}${suffix}`;
    return `<option value="${escapeHtml(raw)}">${escapeHtml(label)}</option>`;
  })].join('');
}

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
  const scale = Math.min(
    cssWidth / (maxX - minX + padding * 2),
    cssHeight / (maxY - minY + padding * 2)
  );
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

function isProjectionData(value) {
  return Boolean(value?.schemaVersion === 1
    && Array.isArray(value.solids)
    && value.solids.every(solid => typeof solid?.id === 'string'
      && typeof solid.name === 'string'
      && Array.isArray(solid.classes)
      && solid.classes.every(item => Number.isInteger(item?.id)
        && typeof item.label === 'string'
        && typeof item.image === 'string'
        && ['crossings', 'vertexClusters', 'maxVertexOverlap', 'stabilizer']
          .every(key => Number.isInteger(item[key]))
        && ['structure', 'name', 'description', 'example']
          .every(key => typeof item.role?.[key] === 'string'))));
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
        projectResponse.json(),
        projectionResponse.json(),
        viewResponse.json()
      ]);
      if (!isProjectionData(projectionData)) throw new Error('Invalid projection data');
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
    const geometry = geometryForSolid(solid.name);
    const classificationsByClass = new Map(solid.classes.map(item => {
      const view = viewsByClass.get(item.id);
      const structure = analyzeProjectionStructure(
        geometry.vertices,
        geometry.edges,
        viewFrame(view.viewDirection, view.rollDegrees)
      );
      return [item.id, {
        structure,
        radialLayers: structure.layers.length,
        convexHullLayers: structure.convexHullLayers.length,
        symmetryAxes: structure.symmetryAxisAngles.length,
        rotationalOrder: structure.rotationalOrder,
        eulerTrail: structure.eulerTrail
      }];
    }));
    return { element, solid, viewsByClass, geometry, classificationsByClass };
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
  root.className = 'projection-selector projection-selector-orthographic';
  root.innerHTML = `
    <aside class="card projection-selector-panel" aria-label="사영도 선택 및 필터">
      <span class="detail-kicker">PROJECTION LIBRARY</span>
      <h3>사영도 선택</h3>
      <div class="projection-selector-toolbar">
        <div class="projection-solid-tabs" role="group" aria-label="속성 필터 · 미선택 시 전체">
        ${entries.map((entry, index) => `
          <button class="projection-solid-tab" type="button"
            aria-pressed="false" data-solid-index="${index}">
            <strong>${escapeHtml(entry.element.name)}</strong>
            <span>${escapeHtml(entry.solid.name)}</span>
          </button>`).join('')}
      </div>
      </div>
      <div class="projection-category-heading">구조 카테고리</div>
      <div class="projection-filter-grid">
        <label>
          <span>동심차수</span>
          <select id="projectionRadialLayers" class="projection-filter-category">
            <option value="">전체</option>
          </select>
        </label>
        <label>
          <span>Convex Hull</span>
          <select id="projectionConvexHullLayers" class="projection-filter-category">
            <option value="">전체</option>
          </select>
        </label>
        <label>
          <span>대칭축 수</span>
          <select id="projectionSymmetryAxes" class="projection-filter-category">
            <option value="">전체</option>
          </select>
        </label>
        <label>
          <span>대칭차수</span>
          <select id="projectionRotationalOrder" class="projection-filter-category">
            <option value="">전체</option>
          </select>
        </label>
        <label>
          <span>Euler Trail</span>
          <select id="projectionEulerTrail" class="projection-filter-category">
            <option value="">미선택</option>
          </select>
        </label>
      </div>
      <label class="projection-filter-label" for="projectionSearch">이름·역할 검색</label>
      <input id="projectionSearch" class="projection-filter-search" type="search" placeholder="클래스 또는 역할 검색" />
      <div class="projection-filter-count" aria-live="polite"></div>
      <div class="projection-class-rail" role="group" aria-label="사영 클래스 바로 선택"></div>
    </aside>
    <div class="card projection-selector-content">
    <div class="projection-selector-instruction">ORTHOGRAPHIC · HORIZONTAL DRAG · ← →</div>

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

    <section class="projection-role-details" aria-label="선택한 사영도의 역할">
      <div class="projection-role-heading">
        <div>
          <span class="detail-kicker">역할 가설 · <span data-role="structure"></span></span>
          <h3 data-role="name"></h3>
        </div>
        <a data-projection-source target="_blank" rel="noopener">원본 사영도 ↗</a>
      </div>
      <dl class="projection-role-copy">
        <div><dt>마법적 해석</dt><dd data-role="description"></dd></div>
        <div><dt>예시</dt><dd data-role="example"></dd></div>
      </dl>
      <p class="muted">사영도의 구조적 차이를 마법 연산으로 번역한 1차 가설이며, 최종 능력은 전투 프로토타입 검증 후 확정한다.</p>
    </section>
    <p class="projection-selector-note">원근법 없는 정투영. 좌우 드래그·버튼·키보드는 인접 사영으로 이동하고, 클래스 번호를 직접 선택하면 중간 클래스를 거치지 않고 목표 사영으로 바로 회전한다.</p>
    <span class="projection-selector-live" aria-live="polite"></span>
    </div>
  `;

  const state = {
    solidIndex: 0,
    selectedSolidIndices: new Set(),
    selectedBySolid: new Map(entries.map((_, index) => [index, 0])),
    frame: null,
    progress: 0,
    previewDirection: 1,
    pointerId: null,
    startX: 0,
    startTime: 0,
    animationFrame: 0,
    locked: false
  };

  const stage = root.querySelector('.projection-stage');
  const canvas = root.querySelector('.projection-canvas');
  const rail = root.querySelector('.projection-class-rail');
  const radialLayers = root.querySelector('#projectionRadialLayers');
  const convexHullLayers = root.querySelector('#projectionConvexHullLayers');
  const symmetryAxes = root.querySelector('#projectionSymmetryAxes');
  const rotationalOrder = root.querySelector('#projectionRotationalOrder');
  const eulerTrail = root.querySelector('#projectionEulerTrail');
  const search = root.querySelector('.projection-filter-search');
  const count = root.querySelector('.projection-filter-count');
  const live = root.querySelector('.projection-selector-live');
  const kicker = root.querySelector('[data-projection-kicker]');
  const title = root.querySelector('[data-projection-title]');
  const position = root.querySelector('[data-projection-position]');

  const currentEntry = () => entries[state.solidIndex];
  const currentClasses = () => currentEntry().solid.classes;
  const currentIndex = () => state.selectedBySolid.get(state.solidIndex) || 0;
  const currentClassification = index => currentEntry().classificationsByClass.get(currentClasses()[index].id);
  const activeEntryIndices = () => activeProjectionEntryIndices(
    entries.length,
    [...state.selectedSolidIndices]
  );
  const targetEquals = (first, second) => Boolean(first && second
    && first.entryIndex === second.entryIndex
    && first.classIndex === second.classIndex);
  const currentTarget = () => ({ entryIndex: state.solidIndex, classIndex: currentIndex() });
  const targetEntry = target => entries[target.entryIndex];
  const targetItem = target => targetEntry(target).solid.classes[target.classIndex];
  const targetClassification = target => targetEntry(target).classificationsByClass.get(targetItem(target).id);
  const filterControls = {
    radialLayers: { element: radialLayers, suffix: '층' },
    convexHullLayers: { element: convexHullLayers, suffix: '층' },
    symmetryAxes: { element: symmetryAxes, suffix: '개' },
    rotationalOrder: { element: rotationalOrder, suffix: '차' },
    eulerTrail: {
      element: eulerTrail,
      suffix: '',
      labels: { true: '가능', false: '불가' },
      emptyLabel: '미선택'
    }
  };
  const currentFilters = () => Object.fromEntries(
    Object.entries(filterControls).map(([key, control]) => [key, control.element.value])
  );
  const visibleTargets = () => filteredProjectionTargets(
    entries,
    activeEntryIndices(),
    currentFilters(),
    search.value
  );
  const totalActiveClasses = () => activeEntryIndices()
    .reduce((sum, entryIndex) => sum + entries[entryIndex].solid.classes.length, 0);

  function syncFilterOptions(preferredKey = null) {
    const keys = Object.keys(filterControls);
    const order = preferredKey && keys.includes(preferredKey)
      ? [...keys.filter(key => key !== preferredKey), preferredKey]
      : keys;
    let changed = false;

    for (let pass = 0; pass < 2; pass += 1) {
      for (const key of order) {
        const control = filterControls[key];
        const previous = control.element.value;
        const values = availableClassificationValuesAcrossEntries(
          entries,
          activeEntryIndices(),
          currentFilters(),
          key,
          search.value
        );
        control.element.innerHTML = optionMarkup(
          values,
          control.suffix,
          control.labels,
          control.emptyLabel
        );
        if (previous && values.some(value => String(value) === previous)) control.element.value = previous;
        else if (previous) changed = true;
      }
    }
    return changed;
  }
  const targetAtDirection = direction => {
    const visible = visibleTargets();
    if (!visible.length) return currentTarget();
    const currentPosition = visible.findIndex(target => targetEquals(target, currentTarget()));
    const origin = currentPosition >= 0 ? currentPosition : 0;
    return visible[wrapIndex(origin + direction, visible.length)];
  };
  const frameForTarget = target => {
    const entry = targetEntry(target);
    const item = targetItem(target);
    const view = entry.viewsByClass.get(item.id);
    return viewFrame(view.viewDirection, view.rollDegrees);
  };
  const frameFor = index => frameForTarget({ entryIndex: state.solidIndex, classIndex: index });

  function draw() {
    renderProjection(canvas, currentEntry().geometry, state.frame);
  }

  function renderRail() {
    const visible = visibleTargets();
    count.textContent = `${visible.length} / ${totalActiveClasses()}개 사영도`;
    rail.innerHTML = visible.map(target => {
      const entry = targetEntry(target);
      const item = targetItem(target);
      const classification = targetClassification(target);
      const active = targetEquals(target, currentTarget());
      return `
      <button type="button" class="projection-class-chip${active ? ' active' : ''}"
        data-solid-index="${target.entryIndex}" data-class-index="${target.classIndex}"
        data-class-id="${item.id}" aria-pressed="${active}">
        <span>${escapeHtml(entry.element.name)} · #${String(item.id).padStart(2, '0')} · ${escapeHtml(item.role.name)}</span>
        <small>동심차수 ${classification.radialLayers}층 · Convex Hull ${classification.convexHullLayers}층 · 대칭축 ${classification.symmetryAxes}개 · ${classification.rotationalOrder}차 · Euler Trail ${classification.eulerTrail ? '가능' : '불가'}</small>
      </button>`;
    }).join('') || '<p class="projection-filter-empty">검색 결과가 없습니다.</p>';
  }

  function updateMetadata({ announce = false } = {}) {
    const entry = currentEntry();
    const classes = currentClasses();
    const item = classes[currentIndex()];
    const visible = visibleTargets();
    const currentPosition = visible.findIndex(target => targetEquals(target, currentTarget()));
    const hasFilters = state.selectedSolidIndices.size
      || radialLayers.value
      || convexHullLayers.value
      || symmetryAxes.value
      || rotationalOrder.value
      || eulerTrail.value
      || search.value.trim();

    kicker.textContent = `${entry.element.name} · ${entry.solid.name}`;
    title.textContent = `Class #${String(item.id).padStart(2, '0')} · ${item.role.name}`;
    position.textContent = currentPosition >= 0
      ? hasFilters
        ? `${currentPosition + 1} / ${visible.length} · 전체 ${totalActiveClasses()}`
        : `${currentPosition + 1} / ${visible.length}`
      : `필터 결과 ${visible.length}개`;
    root.querySelector('[data-metric="crossings"]').textContent = String(item.crossings);
    root.querySelector('[data-metric="vertexClusters"]').textContent = String(item.vertexClusters);
    root.querySelector('[data-metric="maxVertexOverlap"]').textContent = `×${item.maxVertexOverlap}`;
    root.querySelector('[data-metric="stabilizer"]').textContent = String(item.stabilizer);
    for (const field of ['structure', 'name', 'description', 'example']) {
      root.querySelector(`[data-role="${field}"]`).textContent = item.role[field];
    }
    root.querySelector('[data-projection-source]').href = item.image;

    stage.setAttribute('aria-valuemax', String(Math.max(1, visible.length)));
    stage.setAttribute('aria-valuenow', String(Math.max(1, currentPosition + 1)));
    const classification = currentClassification(currentIndex());
    stage.setAttribute(
      'aria-valuetext',
      `${entry.element.name}, Class ${item.id}, ${item.role.name}, 동심차수 ${classification.radialLayers}층, Convex Hull ${classification.convexHullLayers}층, 대칭축 ${classification.symmetryAxes}개, ${classification.rotationalOrder}차 대칭, Euler Trail ${classification.eulerTrail ? '가능' : '불가'}`
    );
    stage.setAttribute('aria-disabled', String(visible.length < 2));
    root.querySelector('.projection-step-prev').disabled = visible.length < 2;
    root.querySelector('.projection-step-next').disabled = visible.length < 2;

    root.querySelectorAll('.projection-solid-tab').forEach((button, index) => {
      const selected = state.selectedSolidIndices.has(index);
      const current = index === state.solidIndex;
      button.classList.toggle('active', selected);
      button.classList.toggle('is-current', current);
      button.setAttribute('aria-pressed', String(selected));
      button.tabIndex = 0;
    });

    renderRail();
    const frame = frameFor(currentIndex());
    renderProjectionFeatureTags(root, entry.geometry, frame, classification.structure);
    updateProjectionFeatureGuides(root, entry.geometry, frame, classification.structure);
    if (announce) {
      live.textContent = `${entry.element.name} ${entry.solid.name}, Class ${item.id} ${item.role.name}, 동심차수 ${classification.radialLayers}층, Convex Hull ${classification.convexHullLayers}층, 대칭축 ${classification.symmetryAxes}개, ${classification.rotationalOrder}차 대칭, Euler Trail ${classification.eulerTrail ? '가능' : '불가'}`;
    }
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

  function finishTransition(target, targetFrame) {
    state.solidIndex = target.entryIndex;
    state.selectedBySolid.set(target.entryIndex, target.classIndex);
    state.progress = 0;
    state.frame = targetFrame;
    state.locked = false;
    stage.classList.remove('is-dragging', 'is-grabbing');
    updateMetadata({ announce: true });
    draw();
    stage.focus({ preventScroll: true });
  }

  function commitTarget(target, duration = DEFAULT_TRANSITION_DURATION_MS) {
    if (state.locked || targetEquals(target, currentTarget())) return;

    if (target.entryIndex !== state.solidIndex) {
      cancelAnimationFrame(state.animationFrame);
      state.animationFrame = 0;
      state.solidIndex = target.entryIndex;
      state.selectedBySolid.set(target.entryIndex, target.classIndex);
      state.frame = frameForTarget(target);
      state.progress = 0;
      stage.classList.remove('is-dragging', 'is-grabbing');
      updateMetadata({ announce: true });
      draw();
      stage.focus({ preventScroll: true });
      return;
    }

    state.locked = true;
    const targetFrame = frameForTarget(target);
    stage.classList.add('is-dragging');
    animateToFrame(targetFrame, duration, () => finishTransition(target, targetFrame));
  }

  function commitNeighbor(direction, duration = DEFAULT_TRANSITION_DURATION_MS) {
    commitTarget(targetAtDirection(direction), duration);
  }

  function cancelDrag() {
    if (state.locked) return;
    stage.classList.remove('is-grabbing');
    const targetFrame = frameFor(currentIndex());
    animateToFrame(targetFrame, 165, () => {
      state.progress = 0;
      state.frame = targetFrame;
      stage.classList.remove('is-dragging');
      draw();
    });
  }

  stage.addEventListener('pointerdown', event => {
    if (state.locked || visibleTargets().length < 2 || event.button !== 0) return;
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
    const target = targetAtDirection(direction);
    state.previewDirection = direction;
    state.progress = progress;
    state.frame = target.entryIndex === state.solidIndex
      ? interpolateFrames(frameFor(currentIndex()), frameForTarget(target), Math.abs(progress))
      : frameFor(currentIndex());
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
      commitNeighbor(direction, DEFAULT_TRANSITION_DURATION_MS * remaining);
    } else {
      cancelDrag();
    }
  });

  stage.addEventListener('pointercancel', event => {
    if (event.pointerId !== state.pointerId) return;
    state.pointerId = null;
    cancelDrag();
  });

  stage.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      commitNeighbor(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      commitNeighbor(1);
    }
  });

  root.querySelector('.projection-step-prev').addEventListener('click', () => commitNeighbor(-1));
  root.querySelector('.projection-step-next').addEventListener('click', () => commitNeighbor(1));

  root.querySelector('.projection-solid-tabs').addEventListener('click', event => {
    const button = event.target.closest('.projection-solid-tab');
    if (!button || state.locked) return;
    const index = Number(button.dataset.solidIndex);
    if (!Number.isInteger(index)) return;

    if (state.selectedSolidIndices.has(index)) state.selectedSolidIndices.delete(index);
    else state.selectedSolidIndices.add(index);

    syncFilterOptions();
    const visible = visibleTargets();
    if (visible.length && !visible.some(target => targetEquals(target, currentTarget()))) {
      const first = visible[0];
      state.solidIndex = first.entryIndex;
      state.selectedBySolid.set(first.entryIndex, first.classIndex);
    }
    renderStatic({ announce: true });
  });

  function applyFilter(preferredKey = null) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = 0;
    state.locked = false;
    state.pointerId = null;
    stage.classList.remove('is-dragging', 'is-grabbing');
    syncFilterOptions(preferredKey);
    const visible = visibleTargets();
    if (visible.length && !visible.some(target => targetEquals(target, currentTarget()))) {
      const first = visible[0];
      state.solidIndex = first.entryIndex;
      state.selectedBySolid.set(first.entryIndex, first.classIndex);
    }
    renderStatic({ announce: true });
  }
  Object.entries(filterControls).forEach(([key, control]) =>
    control.element.addEventListener('change', () => applyFilter(key)));
  search.addEventListener('input', () => applyFilter());

  rail.addEventListener('click', event => {
    const button = event.target.closest('.projection-class-chip');
    if (!button || state.locked) return;
    const entryIndex = Number(button.dataset.solidIndex);
    const classIndex = Number(button.dataset.classIndex);
    if (!Number.isInteger(entryIndex) || !Number.isInteger(classIndex)) return;
    commitTarget({ entryIndex, classIndex });
  });

  if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(stage);
  }

  mountProjectionFeatureGuides(root);
  syncFilterOptions();
  renderStatic();
  return root;
}

export async function mountProjectionSelector() {
  const container = document.getElementById('projectionSimulation');
  if (!container) return false;
  if (container.querySelector(`#${SELECTOR_ID}`)) return true;

  try {
    const { elements, solids, viewSolids } = await loadSelectorData();
    if (!container.isConnected || container.querySelector(`#${SELECTOR_ID}`)) return false;
    const entries = selectorEntries(elements, solids, viewSolids);
    if (!entries.length) throw new Error('Projection simulation has no complete solid/view entries');
    container.appendChild(createSelector(entries));
    return true;
  } catch (error) {
    console.warn('[projection-selector] failed to mount simulation', error);
    if (container.isConnected) container.textContent = '사영도와 역할 설명을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';
    return false;
  }
}
