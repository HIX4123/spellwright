export const DASHBOARD_VIEW_IDS = Object.freeze([
  'overview',
  'story',
  'systems',
  'character',
  'projections',
  'questions',
  'archive'
]);

const DASHBOARD_VIEW_SET = new Set(DASHBOARD_VIEW_IDS);
const LEGACY_VIEW_ALIASES = Object.freeze({
  combat: 'systems',
  attributes: 'projections',
  mvp: 'overview',
  decisions: 'archive',
  graveyard: 'archive',
  stats: 'character',
  classes: 'character'
});

export function dashboardViewFromHash(hash = '') {
  const raw = String(hash).replace(/^#/, '');
  if (!raw) return 'overview';

  try {
    const decoded = decodeURIComponent(raw);
    if (decoded === 'story/questions' || decoded.startsWith('story/questions/')) return 'questions';
    if (decoded.startsWith('story/')) return 'story';
    return DASHBOARD_VIEW_SET.has(decoded) ? decoded : LEGACY_VIEW_ALIASES[decoded] || 'overview';
  } catch {
    return 'overview';
  }
}

export function dashboardViewHref(viewId) {
  return viewId === 'overview' ? './' : `#${viewId}`;
}
