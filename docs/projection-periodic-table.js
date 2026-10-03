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
} from './projection-selector.js?v=global-projection-axis-20261003-1';

const VERTEX_HULL_TOLERANCE_FACTOR = 4e-5;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

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

export function layoutProjectionPeriod(entries, minimumGap = PERIODIC_MIN_SERIAL_GAP) {
  const laneEnds = [];
  const laidOut = entries.slice()
    .sort((first, second) =>
      first.serialNumber - second.serialNumber
      || first.solidOrder - second.solidOrder
      || first.classOrder - second.classOrder)
    .map(entry => {
      let lane = laneEnds.findIndex(lastSerial =>
        entry.serialNumber - lastSerial >= minimumGap);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = entry.serialNumber;
      return { ...entry, lane };
    });

  return {
    entries: laidOut,
    laneCount: Math.max(1, laneEnds.length)
  };
}

function periodicItem(entry) {
  const eulerClass = entry.eulerTrail ? ' is-euler' : '';
  const circuitClass = entry.eulerCircuit ? ' is-circuit' : '';
  const eulerBadge = entry.eulerTrail
    ? '<span class="projection-periodic-euler-badge">' + (entry.eulerCircuit ? 'EC' : 'ET') + '</span>'
    : '';
  const title = [
    entry.attribute + ' · ' + entry.solidName + ' · ' + formatProjectionSerial(entry.serialNumber),
    entry.label,
    'P' + entry.period,
    'Outer hull ' + entry.hullVertices + ' · C' + entry.rotationalOrder
  ].join(' · ');
  const position = (entry.serialNumber / 999 * 100).toFixed(4) + '%';

  return '<button class="projection-periodic-item' + eulerClass + circuitClass +
    '" type="button" data-solid="' + escapeHtml(entry.solidId) +
    '" data-class-id="' + entry.classId +
    '" data-serial="' + entry.serialNumber +
    '" style="--projection-position:' + position + ';--projection-lane:' + entry.lane +
    '" title="' + escapeHtml(title) +
    '" aria-label="' + escapeHtml(
      entry.attribute + ' ' + entry.solidName + ' 사영 번호 ' +
      formatProjectionSerial(entry.serialNumber) + ' 사영도 열기'
    ) + '">' +
      '<div class="projection-periodic-thumb">' +
        entry.thumbnailSvg +
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

export function renderProjectionPeriodicTable(root, entries) {
  const sorted = entries.slice().sort((first, second) =>
    first.period - second.period
    || first.serialNumber - second.serialNumber
    || first.solidOrder - second.solidOrder
    || first.classOrder - second.classOrder
  );
  const maxPeriod = Math.max(...sorted.map(entry => entry.period));
  const periods = Array.from({ length: maxPeriod }, (_, index) => index + 1);

  const rows = periods.map(period => {
    const periodEntries = sorted.filter(entry => entry.period === period);
    const layout = layoutProjectionPeriod(periodEntries);
    const label =
      '<div class="projection-periodic-axis projection-periodic-period">' +
        '<span>PERIOD</span><strong>P' + period + '</strong>' +
        '<small>' + period + ' hull layer' + (period === 1 ? '' : 's') + '</small>' +
      '</div>';
    const track =
      '<div class="projection-periodic-track" style="--projection-periodic-lanes:' +
        layout.laneCount + '">' +
        '<div class="projection-periodic-phase-field">' +
          layout.entries.map(periodicItem).join('') +
        '</div>' +
      '</div>';
    return label + track;
  }).join('');

  const eulerCount = sorted.filter(entry => entry.eulerTrail).length;
  root.innerHTML =
    '<div class="card projection-periodic-card">' +
      '<div class="projection-periodic-legend">' +
        '<span><strong>P</strong> Convex Hull depth</span>' +
        '<span><strong>#</strong> Global projection coordinate · 1D MDS</span>' +
        '<span class="projection-periodic-euler-legend"><i></i> Euler trail/circuit · ' +
          eulerCount + '</span>' +
      '</div>' +
      '<div class="projection-periodic-scroll">' +
        '<div class="projection-periodic-grid">' +
          '<div class="projection-periodic-corner"><span>PERIOD</span><b>×</b><span>#ID</span></div>' +
          phaseAxisMarkup() +
          rows +
        '</div>' +
      '</div>' +
      '<p class="projection-periodic-note">#000–#999는 43개 사영도의 대칭 보정 최소 회전거리 행렬을 1차원 MDS로 압축한 전역 좌표다. 번호 차이가 작을수록 대체로 가까운 사영이지만, 정확한 회전각 자체를 뜻하지는 않는다. EC = Euler circuit, ET = Euler trail.</p>' +
    '</div>';

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
