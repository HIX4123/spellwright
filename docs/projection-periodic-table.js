import { geometryForSolid, viewFrame } from './projection-core.js?v=ponytail-20260928-1';
import {
  analyzeProjectionStructure,
  convexHullIndices
} from './projection-geometry-analysis.js?v=ponytail-20260928-1';

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

      const structure = analyzeProjectionStructure(
        geometry.vertices,
        geometry.edges,
        viewFrame(view.viewDirection, view.rollDegrees)
      );
      const hullVertices = vertexHullCount(structure);
      const rotationalOrder = Math.max(1, structure.rotationalOrder);
      const sectorSize = hullVertices / rotationalOrder;
      const roundedSectorSize = Math.round(sectorSize);

      if (Math.abs(sectorSize - roundedSectorSize) > 1e-6) {
        throw new Error('Non-integral fundamental sector for ' + solid.name + ' class ' + projection.id);
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
        attribute: attributeBySolid.get(solid.name) || solid.name,
        period: structure.convexHullLayers.length,
        group: Math.max(1, roundedSectorSize),
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
      'P' + entry.period + ' / G' + entry.group,
      'Hull ' + entry.hullVertices + ' ÷ C' + entry.rotationalOrder
    ].join(' · ');

    return '<figure class="projection-periodic-item' + eulerClass + circuitClass + '" data-solid="' + escapeHtml(entry.solidId) + '" title="' + escapeHtml(title) + '">' +
      '<div class="projection-periodic-thumb">' +
        '<img src="' + escapeHtml(entry.image) + '" alt="' + escapeHtml(entry.attribute + ' ' + entry.classId + ' 사영도') + '" loading="lazy" />' +
        eulerBadge +
      '</div>' +
    '</figure>';
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
  const maxGroup = Math.max(...sorted.map(entry => entry.group));
  const periods = Array.from({ length: maxPeriod }, (_, index) => index + 1);
  const groups = Array.from({ length: maxGroup }, (_, index) => index + 1);
  const cells = new Map();

  sorted.forEach(entry => {
    const key = entry.period + ':' + entry.group;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(entry);
  });

  const groupHeaders = groups.map(group =>
    '<div class="projection-periodic-axis projection-periodic-group">' +
      '<span>GROUP</span><strong>G' + group + '</strong>' +
      '<small>sector ' + group + '</small>' +
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
        '<span><strong>G</strong> Hull vertices ÷ rotational order</span>' +
        '<span class="projection-periodic-euler-legend"><i></i> Euler trail/circuit · ' + eulerCount + '</span>' +
      '</div>' +
      '<div class="projection-periodic-scroll">' +
        '<div class="projection-periodic-grid" style="--projection-periodic-groups:' + groups.length + ';--projection-periodic-min-width:' + (82 + groups.length * 150) + 'px">' +
          '<div class="projection-periodic-corner"><span>PERIOD</span><b>×</b><span>GROUP</span></div>' +
          groupHeaders +
          rows +
        '</div>' +
      '</div>' +
      '<p class="projection-periodic-note">같은 칸의 사영도는 동일한 Convex Hull 층수와 Fundamental Sector Size를 공유한다. EC = Euler circuit, ET = Euler trail.</p>' +
    '</div>';
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
