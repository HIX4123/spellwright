import { geometryForSolid, viewFrame } from './projection-core.js?v=ponytail-20260928-1';
import {
  analyzeProjectionStructure,
  convexHullIndices
} from './projection-geometry-analysis.js?v=ponytail-20260928-1';

const VERTEX_HULL_TOLERANCE_FACTOR = 4e-5;

export const CORE_BLOCKS = Object.freeze([
  { id: 'point', label: 'Point', description: 'core 1' },
  { id: 'pair', label: 'Pair', description: 'core 2' },
  { id: 'ring', label: 'Ring', description: 'core 3+' }
]);

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

export function projectionCoreBlock(coreSize) {
  if (coreSize === 1) return 'point';
  if (coreSize === 2) return 'pair';
  return 'ring';
}

export function buildProjectionPeriodicEntries(projectionData, viewData) {
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
      const coreSize = structure.convexHullLayerPointCounts.at(-1);

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
        period: structure.convexHullLayers.length,
        group: Math.max(1, roundedSectorSize),
        coreSize,
        coreBlock: projectionCoreBlock(coreSize),
        hullVertices,
        rotationalOrder,
        eulerTrail: structure.eulerTrail,
        eulerCircuit: structure.eulerCircuit
      };
    });
  });
}

function projectionItem(entry) {
  const eulerClass = entry.eulerTrail ? ' is-euler' : '';
  const circuitClass = entry.eulerCircuit ? ' is-circuit' : '';
  const eulerBadge = entry.eulerTrail
    ? '<span class="projection-periodic-euler-badge">' + (entry.eulerCircuit ? 'EC' : 'ET') + '</span>'
    : '';
  const title = [
    entry.solidName + ' #' + String(entry.classId).padStart(2, '0'),
    entry.label,
    'P' + entry.period + ' / G' + entry.group,
    'Core ' + entry.coreSize,
    'Hull ' + entry.hullVertices + ' ÷ C' + entry.rotationalOrder
  ].join(' · ');

  return '<figure class="projection-periodic-item' + eulerClass + circuitClass + '" title="' + escapeHtml(title) + '">' +
    '<div class="projection-periodic-thumb">' +
      '<img src="' + escapeHtml(entry.image) + '" alt="' + escapeHtml(entry.solidName + ' ' + entry.classId + ' 사영도') + '" loading="lazy" />' +
      eulerBadge +
    '</div>' +
  '</figure>';
}

function periodicCell(entries) {
  if (!entries.length) {
    return '<div class="projection-periodic-cell is-empty" aria-hidden="true"></div>';
  }

  const byBlock = new Map(CORE_BLOCKS.map(block => [block.id, []]));
  entries.forEach(entry => byBlock.get(entry.coreBlock)?.push(entry));

  const blockSections = CORE_BLOCKS
    .filter(block => byBlock.get(block.id).length)
    .map(block => {
      const blockEntries = byBlock.get(block.id);
      return '<section class="projection-periodic-core-block is-' + block.id + '">' +
        '<div class="projection-periodic-core-label">' +
          '<strong>' + block.label + '</strong>' +
          '<span>' + block.description + '</span>' +
        '</div>' +
        '<div class="projection-periodic-items">' + blockEntries.map(projectionItem).join('') + '</div>' +
      '</section>';
    }).join('');

  return '<div class="projection-periodic-cell">' +
    (entries.length > 1 ? '<span class="projection-periodic-count">' + entries.length + '</span>' : '') +
    blockSections +
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
        '<span><strong>Core</strong> Point 1 · Pair 2 · Ring 3+</span>' +
        '<span class="projection-periodic-euler-legend"><i></i> Euler trail/circuit · ' + eulerCount + '</span>' +
      '</div>' +
      '<div class="projection-periodic-scroll">' +
        '<div class="projection-periodic-grid" style="--projection-periodic-groups:' + groups.length + ';--projection-periodic-min-width:' + (82 + groups.length * 150) + 'px">' +
          '<div class="projection-periodic-corner"><span>PERIOD</span><b>×</b><span>GROUP</span></div>' +
          groupHeaders +
          rows +
        '</div>' +
      '</div>' +
      '<p class="projection-periodic-note">Period와 Group 좌표는 그대로 유지하고, 각 셀 내부에서 최내곽 Convex Hull의 크기에 따라 Point / Pair / Ring Core Block으로 묶는다. EC = Euler circuit, ET = Euler trail.</p>' +
    '</div>';
}

export async function mountProjectionPeriodicTable() {
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
    const entries = buildProjectionPeriodicEntries(projectionData, viewData);
    renderProjectionPeriodicTable(root, entries);
  } catch (error) {
    console.error(error);
    root.innerHTML = '<div class="card projection-periodic-loading is-error">Projection periodic table을 불러오지 못했습니다.</div>';
  }
}
