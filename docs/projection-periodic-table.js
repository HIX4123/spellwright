import { escapeHtml } from './html.js';
import {
  geometryForSolid,
  projectVertices,
  projectionEvents,
  projectionScreenTransform,
  viewFrame
} from './projection-core.js?v=ponytail-20260928-1';
import {
  analyzeProjectionStructure,
  convexHullIndices
} from './projection-geometry-analysis.js?v=ponytail-20260928-1';
import {
  formatProjectionSerial,
  globalProjectionSerialLayout,
  selectProjectionTarget
} from './projection-selector.js?v=solid-origins-20261020-1';

const VERTEX_HULL_TOLERANCE_FACTOR = 4e-5;

function vertexHullCount(structure) {
  const nodes = structure.nodes.filter(node => node.vertexMultiplicity > 0);
  const scale = Math.max(1, ...nodes.map(node => Math.hypot(node.xy[0], node.xy[1])));
  const tolerance = scale * scale * VERTEX_HULL_TOLERANCE_FACTOR;
  return convexHullIndices(nodes, nodes.map((_, index) => index), tolerance).length;
}

export function projectionThumbnailSvg(geometry, frame) {
  const width = 96;
  const height = 72;
  const points = projectVertices(geometry.vertices, frame);
  const events = projectionEvents(points, geometry.edges);
  const vertexEvents = events.filter(event => event.vertexIds.size > 0);
  const crossingEvents = events.filter(event => event.vertexIds.size === 0 && event.edgeIds.size >= 2);
  const { point: screenPoint } = projectionScreenTransform(points, width, height);

  const edges = geometry.edges.map(([a, b]) => {
    const start = screenPoint(points[a]);
    const end = screenPoint(points[b]);
    return '<line x1="' + start[0].toFixed(3) + '" y1="' + start[1].toFixed(3) +
      '" x2="' + end[0].toFixed(3) + '" y2="' + end[1].toFixed(3) + '" />';
  }).join('');

  const crossings = crossingEvents.map(event => {
    const point = screenPoint(event.xy);
    return '<circle class="projection-periodic-crossing" cx="' + point[0].toFixed(3) +
      '" cy="' + point[1].toFixed(3) + '" r="2.3" />';
  }).join('');

  const vertices = vertexEvents.map(event => {
    const point = screenPoint(event.xy);
    const overlap = event.vertexIds.size > 1
      ? '<text x="' + (point[0] + 3.8).toFixed(3) + '" y="' + (point[1] - 3.2).toFixed(3) +
        '">×' + event.vertexIds.size + '</text>'
      : '';
    return '<circle class="projection-periodic-vertex" cx="' + point[0].toFixed(3) +
      '" cy="' + point[1].toFixed(3) + '" r="2.5" />' + overlap;
  }).join('');

  return '<svg class="projection-periodic-live-svg" viewBox="0 0 ' + width + ' ' + height +
    '" role="img" aria-hidden="true">' +
    '<g class="projection-periodic-edges">' + edges + '</g>' +
    '<g class="projection-periodic-crossings">' + crossings + '</g>' +
    '<g class="projection-periodic-vertices">' + vertices + '</g>' +
    '</svg>';
}

export function buildProjectionPeriodicEntries(projectionData, viewData, elements = []) {
  const attributeBySolid = new Map(elements.map(element => [element.solid, element.name]));
  const viewsBySolid = new Map(viewData.solids.map(solid => [solid.name, solid]));
  const globalSerials = globalProjectionSerialLayout(
    projectionData.solids,
    viewData.solids
  ).serialsByKey;

  return projectionData.solids.flatMap((solid, solidOrder) => {
    const viewSolid = viewsBySolid.get(solid.name);
    if (!viewSolid) return [];
    const viewsByClass = new Map(viewSolid.views.map(view => [view.classId, view]));
    const geometry = geometryForSolid(solid.name);

    return solid.classes.map((projection, classOrder) => {
      const view = viewsByClass.get(projection.id);
      if (!view) throw new Error('Missing representative view for ' + solid.name + ' class ' + projection.id);

      const frame = viewFrame(view.viewDirection, view.rollDegrees);
      const structure = analyzeProjectionStructure(
        geometry.vertices,
        geometry.edges,
        frame
      );
      const hullVertices = vertexHullCount(structure);
      const rotationalOrder = Math.max(1, structure.rotationalOrder);
      const serialNumber = globalSerials.get(solid.id + ':' + projection.id);
      if (!Number.isInteger(serialNumber)) {
        throw new Error('Missing global projection serial for ' + solid.name + ' class ' + projection.id);
      }

      return {
        key: solid.id + '-' + String(projection.id).padStart(2, '0'),
        solidId: solid.id,
        solidName: solid.name,
        solidOrder,
        classOrder,
        classId: projection.id,
        label: projection.role?.name || projection.label,
        image: projection.image,
        thumbnailSvg: projectionThumbnailSvg(geometry, frame),
        attribute: attributeBySolid.get(solid.name) || solid.name,
        period: structure.convexHullLayers.length,
        hullVertices,
        rotationalOrder,
        serialNumber,
        eulerTrail: structure.eulerTrail,
        eulerCircuit: structure.eulerCircuit
      };
    });
  });
}

const PERIODIC_MIN_SERIAL_GAP = 54;
export const PERIODIC_GROUPING_MODES = Object.freeze([
  { id: 'hull', label: 'H', heading: '최외곽 정점 수' },
  { id: 'period', label: 'P', heading: 'Convex Hull 층수' },
  { id: 'attribute', label: '속성', heading: '5대속성' }
]);
export const DEFAULT_PERIODIC_GROUPING = 'hull';
let activePeriodicGrouping = DEFAULT_PERIODIC_GROUPING;

// Only the row grouping and visual packing change when the mode changes.
// Geometry, source-class IDs and the global serial map remain untouched.
export function buildProjectionPeriodicRows(entries, mode = DEFAULT_PERIODIC_GROUPING) {
  if (!PERIODIC_GROUPING_MODES.some(option => option.id === mode)) {
    throw new Error('Unknown projection grouping mode: ' + mode);
  }
  const rows = new Map();
  for (const entry of entries) {
    const value = mode === 'hull' ? entry.hullVertices
      : mode === 'period' ? entry.period : entry.solidId;
    const key = mode === 'hull' ? 'H' + value
      : mode === 'period' ? 'P' + value : String(value);
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        label: mode === 'hull' ? 'H' + value
          : mode === 'period' ? 'P' + value : entry.attribute,
        order: mode === 'attribute' ? entry.solidOrder : Number(value),
        entries: []
      });
    }
    rows.get(key).entries.push(entry);
  }
  return [...rows.values()]
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
    .map(row => ({ ...row, ...layoutProjectionSubrow(row.entries) }));
}


function isotonicRegression(values) {
  const blocks = [];

  values.forEach((value, index) => {
    blocks.push({
      start: index,
      end: index,
      weight: 1,
      mean: value
    });

    while (blocks.length >= 2) {
      const right = blocks[blocks.length - 1];
      const left = blocks[blocks.length - 2];
      if (left.mean <= right.mean) break;

      blocks.pop();
      blocks.pop();
      const weight = left.weight + right.weight;
      blocks.push({
        start: left.start,
        end: right.end,
        weight,
        mean: (left.mean * left.weight + right.mean * right.weight) / weight
      });
    }
  });

  const result = Array(values.length);
  blocks.forEach(block => {
    for (let index = block.start; index <= block.end; index += 1) {
      result[index] = block.mean;
    }
  });
  return result;
}

export function layoutProjectionSubrow(entries, minimumGap = PERIODIC_MIN_SERIAL_GAP) {
  const ordered = entries.slice().sort((first, second) =>
    first.serialNumber - second.serialNumber
    || first.solidOrder - second.solidOrder
    || first.classOrder - second.classOrder
  );
  if (!ordered.length) return { entries: [], minimumGap };

  const effectiveGap = Math.min(
    minimumGap,
    ordered.length > 1 ? 999 / (ordered.length - 1) : minimumGap
  );
  const adjustedTargets = ordered.map((entry, index) =>
    entry.serialNumber - index * effectiveGap
  );
  const upperBound = 999 - (ordered.length - 1) * effectiveGap;
  const fitted = isotonicRegression(adjustedTargets).map(value =>
    Math.max(0, Math.min(upperBound, value))
  );

  return {
    entries: ordered.map((entry, index) => ({
      ...entry,
      packedSerial: fitted[index] + index * effectiveGap
    })),
    minimumGap: effectiveGap
  };
}

function periodicItem(entry, mode) {
  const eulerClass = entry.eulerTrail ? ' is-euler' : '';
  const circuitClass = entry.eulerCircuit ? ' is-circuit' : '';
  const eulerBadge = entry.eulerTrail
    ? '<span class="projection-periodic-euler-badge">' + (entry.eulerCircuit ? 'EC' : 'ET') + '</span>'
    : '';
  const title = [
    entry.attribute + ' · ' + entry.solidName + ' · ' + formatProjectionSerial(entry.serialNumber),
    entry.label,
    'P' + entry.period + ' / H' + entry.hullVertices,
    'Outer hull ' + entry.hullVertices + ' · C' + entry.rotationalOrder
  ].join(' · ');
  const position = (entry.packedSerial / 999 * 100).toFixed(4) + '%';
  const secondary = mode === 'period' ? 'H' + entry.hullVertices
    : mode === 'hull' ? 'P' + entry.period
      : 'H' + entry.hullVertices + ' · P' + entry.period;

  return '<button class="projection-periodic-item' + eulerClass + circuitClass +
    '" type="button" data-solid="' + escapeHtml(entry.solidId) +
    '" data-class-id="' + entry.classId +
    '" data-serial="' + entry.serialNumber +
    '" data-packed-serial="' + entry.packedSerial.toFixed(3) +
    '" style="--projection-position:' + position +
    '" title="' + escapeHtml(title) +
    '" aria-label="' + escapeHtml(
      entry.attribute + ' ' + entry.solidName + ' P' + entry.period + ' H' +
      entry.hullVertices + ' 사영 번호 ' + formatProjectionSerial(entry.serialNumber) +
      ' 사영도 열기'
    ) + '">' +
      '<div class="projection-periodic-thumb">' +
        entry.thumbnailSvg +
        '<span class="projection-periodic-metric">' + escapeHtml(secondary) + '</span>' +
        eulerBadge +
      '</div>' +
    '</button>';
}

function phaseAxisMarkup() {
  const ticks = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 999];
  return '<div class="projection-periodic-phase-axis">' +
    '<div class="projection-periodic-phase-field">' +
      ticks.map((serial, index) => {
        const position = (serial / 999 * 100).toFixed(4) + '%';
        const edgeClass = index === 0
          ? ' is-start'
          : index === ticks.length - 1
            ? ' is-end'
            : '';
        return '<span class="projection-periodic-tick' + edgeClass +
          '" style="--projection-position:' + position + '">' +
          '<i></i><b>' + formatProjectionSerial(serial) + '</b></span>';
      }).join('') +
    '</div>' +
  '</div>';
}

export function renderProjectionPeriodicTable(root, entries, mode = activePeriodicGrouping) {
  const grouping = PERIODIC_GROUPING_MODES.find(option => option.id === mode)
    || PERIODIC_GROUPING_MODES[0];
  activePeriodicGrouping = grouping.id;
  const rows = buildProjectionPeriodicRows(entries, grouping.id);
  const eulerCount = entries.filter(entry => entry.eulerTrail).length;
  const modeExplanations = {
    hull: 'H(최외곽 Convex Hull 정점 수)가 같은 사영도를 한 행에 모은다. P(층수)는 사영도에 보조 표시한다.',
    period: 'P(Convex Hull 층수)가 같은 사영도를 한 행에 모은다. H(최외곽 정점 수)는 사영도에 보조 표시한다.',
    attribute: '각 속성의 정다면체 사영도를 한 행으로 모은다. H와 P는 사영도에 보조 표시한다.'
  };

  const controls = PERIODIC_GROUPING_MODES.map(option =>
    '<button type="button" class="projection-periodic-grouping-button' +
    (option.id === grouping.id ? ' is-active' : '') +
    '" data-periodic-group="' + option.id +
    '" aria-pressed="' + String(option.id === grouping.id) +
    '" title="' + escapeHtml(option.heading) + '">' +
      escapeHtml(option.label) +
    '</button>'
  ).join('');

  const rowMarkup = rows.map(row => {
    const axisText = grouping.id === 'hull' ? row.label + ' · 외곽 정점'
      : grouping.id === 'period' ? row.label + ' · 층수'
        : row.label + ' · 속성';
    return '<div class="projection-periodic-axis projection-periodic-group" ' +
        'data-periodic-row="' + escapeHtml(row.key) + '"' +
        ' title="' + escapeHtml(axisText) + '">' +
          '<strong>' + escapeHtml(row.label) + '</strong>' +
          '<small>' + row.entries.length + '종</small>' +
        '</div>' +
        '<div class="projection-periodic-track">' +
          '<div class="projection-periodic-phase-field">' +
            row.entries.map(entry => periodicItem(entry, grouping.id)).join('') +
          '</div>' +
        '</div>';
  }).join('');

  root.innerHTML =
    '<div class="card projection-periodic-card">' +
      '<div class="projection-periodic-toolbar">' +
        '<span class="projection-periodic-toolbar-label">행 분류</span>' +
        '<div class="projection-periodic-grouping" role="group" aria-label="주기율표 행 분류">' +
          controls +
        '</div>' +
        '<span class="projection-periodic-row-summary" aria-live="polite">' +
          escapeHtml(grouping.heading) + ' · ' + rows.length + '행 / ' + entries.length + '종' +
        '</span>' +
      '</div>' +
      '<div class="projection-periodic-legend">' +
        '<span><strong>H</strong> Outer Convex Hull vertex count</span>' +
        '<span><strong>P</strong> Convex Hull depth</span>' +
        '<span><strong>#</strong> Projection serial · solid-local MDS phase</span>' +
        '<span class="projection-periodic-euler-legend"><i></i> Euler trail/circuit · ' +
          eulerCount + '</span>' +
      '</div>' +
      '<div class="projection-periodic-scroll">' +
        '<div class="projection-periodic-grid">' +
          '<div class="projection-periodic-header projection-periodic-header-group">' +
            escapeHtml(grouping.label) +
          '</div>' +
          phaseAxisMarkup() +
          rowMarkup +
        '</div>' +
      '</div>' +
      '<p class="projection-periodic-note">' +
        escapeHtml(modeExplanations[grouping.id]) +
        ' 가로축 #000–#999는 대칭 보정 회전거리의 1차원 MDS 좌표에 정다면체별 독립 모듈러 기준점(#000–#004)을 적용한 일련번호다. ' +
        '각 행에서는 번호 순서를 보존하며 최소 간격을 확보하되, 원래 위치로부터 제곱 이동량을 최소화한다. ' +
        '숫자 간격을 서로 다른 정다면체의 실제 회전각 차이로 해석하지는 않는다. EC = Euler circuit, ET = Euler trail.' +
      '</p>' +
    '</div>';

  root.querySelectorAll('.projection-periodic-grouping-button[data-periodic-group]').forEach(button => {
    button.addEventListener('click', () => {
      const nextMode = button.dataset.periodicGroup;
      if (nextMode === activePeriodicGrouping) return;
      renderProjectionPeriodicTable(root, entries, nextMode);
      root.querySelector('[data-periodic-group="' + nextMode + '"]')?.focus();
    });
  });

  root.querySelectorAll('.projection-periodic-item[data-solid][data-class-id]').forEach(item => {
    item.addEventListener('click', async () => {
      const selected = await selectProjectionTarget(item.dataset.solid, Number(item.dataset.classId));
      if (!selected) return;
      document.getElementById('projectionSimulation')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  });
}

export async function mountProjectionPeriodicTable(elements = []) {
  const root = document.querySelector('#projectionPeriodicTable');
  if (!root) return;

  root.innerHTML = '<div class="card projection-periodic-loading">Projection periodic table 계산 중…</div>';

  try {
    const [projectionResponse, viewResponse] = await Promise.all([
      fetch('./data/projections.json', { cache: 'no-store' }),
      fetch('./data/projection-views.json', { cache: 'no-store' })
    ]);
    if (!projectionResponse.ok || !viewResponse.ok) throw new Error('Failed to load projection periodic table data');

    const projectionData = await projectionResponse.json();
    const viewData = await viewResponse.json();
    const entries = buildProjectionPeriodicEntries(projectionData, viewData, elements);
    renderProjectionPeriodicTable(root, entries);
  } catch (error) {
    console.error(error);
    root.innerHTML = '<div class="card projection-periodic-loading is-error">Projection periodic table을 불러오지 못했습니다.</div>';
  }
}
