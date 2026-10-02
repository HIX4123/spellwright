import { geometryForSolid, viewFrame } from './projection-core.js?v=ponytail-20260928-1';
import {
  analyzeProjectionStructure,
  convexHullIndices
} from './projection-geometry-analysis.js?v=ponytail-20260928-1';
import { selectProjectionTarget } from './projection-selector.js?v=periodic-navigation-20261002-1';

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

function flattenProjectionImage(image) {
  if (image.dataset.flatMaterialReady === 'true') return;
  image.dataset.flatMaterialReady = 'true';

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;

  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height);

  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const sourceAlpha = pixels.data[index + 3] / 255;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const ink = Math.max(0, Math.min(1, (238 - luminance) / 190));

    pixels.data[index] = 18;
    pixels.data[index + 1] = 18;
    pixels.data[index + 2] = 18;
    pixels.data[index + 3] = Math.round(255 * sourceAlpha * Math.pow(ink, 0.82));
  }

  context.putImageData(pixels, 0, 0);
  image.src = canvas.toDataURL('image/png');
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
        '<img src="' + escapeHtml(entry.image) + '" alt="' + escapeHtml(entry.attribute + ' ' + entry.classId + ' 사영도') + '" loading="lazy" data-projection-flat-material />' +
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

  root.querySelectorAll('img[data-projection-flat-material]').forEach(image => {
    if (image.complete) flattenProjectionImage(image);
    else image.addEventListener('load', () => flattenProjectionImage(image), { once: true });
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
