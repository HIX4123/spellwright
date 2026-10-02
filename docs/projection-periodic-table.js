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
import { selectProjectionTarget } from './projection-selector.js?v=minimal-symmetry-rotation-20261002-2';

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
        group: hullVertices,
        hullVertices,
        rotationalOrder,
        eulerTrail: structure.eulerTrail,
        eulerCircuit: structure.eulerCircuit
      };
    });
  });
}

function periodicCell(entries) {
  if (!entries.length) {
    return '<div class="projection-periodic-cell is-empty" aria-hidden="true"></div>';
  }

  const items = entries.map(entry => {
    const eulerClass = entry.eulerTrail ? ' is-euler' : '';
    const circuitClass = entry.eulerCircuit ? ' is-circuit' : '';
    const eulerBadge = entry.eulerTrail
      ? '<span class="projection-periodic-euler-badge">' + (entry.eulerCircuit ? 'EC' : 'ET') + '</span>'
      : '';
    const title = [
      entry.attribute + ' · ' + entry.solidName + ' #' + String(entry.classId).padStart(2, '0'),
      entry.label,
      'P' + entry.period + ' / H' + entry.group,
      'Outer hull vertices ' + entry.hullVertices + ' · C' + entry.rotationalOrder
    ].join(' · ');

    return '<button class="projection-periodic-item' + eulerClass + circuitClass + '" type="button" data-solid="' + escapeHtml(entry.solidId) + '" data-class-id="' + entry.classId + '" title="' + escapeHtml(title) + '" aria-label="' + escapeHtml(entry.attribute + ' ' + entry.solidName + ' Class ' + entry.classId + ' 사영도 열기') + '">' +
      '<div class="projection-periodic-thumb">' +
        entry.thumbnailSvg +
        eulerBadge +
      '</div>' +
    '</button>';
  }).join('');

  return '<div class="projection-periodic-cell">' +
    (entries.length > 1 ? '<span class="projection-periodic-count">' + entries.length + '</span>' : '') +
    '<div class="projection-periodic-items">' + items + '</div>' +
  '</div>';
}

export function renderProjectionPeriodicTable(root, entries) {
  const sorted = entries.slice().sort((first, second) =>
    first.solidOrder - second.solidOrder || first.classOrder - second.classOrder
  );
  const maxPeriod = Math.max(...sorted.map(entry => entry.period));
  const periods = Array.from({ length: maxPeriod }, (_, index) => index + 1);
  const groups = [...new Set(sorted.map(entry => entry.group))].sort((first, second) => first - second);
  const cells = new Map();

  sorted.forEach(entry => {
    const key = entry.period + ':' + entry.group;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(entry);
  });

  const groupHeaders = groups.map(group =>
    '<div class="projection-periodic-axis projection-periodic-group">' +
      '<span>GROUP</span><strong>H' + group + '</strong>' +
      '<small>' + group + ' outer vertices</small>' +
    '</div>'
  ).join('');

  const rows = periods.map(period => {
    const label =
      '<div class="projection-periodic-axis projection-periodic-period">' +
        '<span>PERIOD</span><strong>P' + period + '</strong>' +
        '<small>' + period + ' hull layer' + (period === 1 ? '' : 's') + '</small>' +
      '</div>';
    return label + groups.map(group => periodicCell(cells.get(period + ':' + group) || [])).join('');
  }).join('');

  const eulerCount = sorted.filter(entry => entry.eulerTrail).length;
  root.innerHTML =
    '<div class="card projection-periodic-card">' +
      '<div class="projection-periodic-legend">' +
        '<span><strong>P</strong> Convex Hull depth</span>' +
        '<span><strong>H</strong> Outer Convex Hull vertex count</span>' +
        '<span class="projection-periodic-euler-legend"><i></i> Euler trail/circuit · ' + eulerCount + '</span>' +
      '</div>' +
      '<div class="projection-periodic-scroll">' +
        '<div class="projection-periodic-grid" style="--projection-periodic-groups:' + groups.length + ';--projection-periodic-min-width:' + (82 + groups.length * 150) + 'px">' +
          '<div class="projection-periodic-corner"><span>PERIOD</span><b>×</b><span>HULL</span></div>' +
          groupHeaders +
          rows +
        '</div>' +
      '</div>' +
      '<p class="projection-periodic-note">같은 칸의 사영도는 동일한 Convex Hull 층수와 최외곽 Convex Hull 정점 수를 공유한다. EC = Euler circuit, ET = Euler trail.</p>' +
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
