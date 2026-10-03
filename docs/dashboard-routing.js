export const DASHBOARD_VIEW_IDS = Object.freeze([
  'overview',
  'story',
  'systems',
  'combat',
  'attributes',
  'mvp',
  'decisions',
  'graveyard',
  'questions'
]);

const DASHBOARD_VIEW_SET = new Set(DASHBOARD_VIEW_IDS);

export function dashboardViewFromHash(hash = '') {
  const raw = String(hash).replace(/^#/, '');
  if (!raw) return 'overview';

  try {
    const decoded = decodeURIComponent(raw);
    return DASHBOARD_VIEW_SET.has(decoded) ? decoded : 'overview';
  } catch {
    return 'overview';
  }
}

export function dashboardViewHref(viewId) {
  return viewId === 'overview' ? './' : `#${viewId}`;
}
