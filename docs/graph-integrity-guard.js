(() => {
  let hiddenSystems = new Set();
  let scheduled = false;

  function expectedLegacyIds(host) {
    const legacy = host.querySelector(':scope > .compact-legacy .system-map-scroll')
      || host.querySelector(':scope > .system-map-scroll');
    if (!legacy) return [];
    return [...legacy.querySelectorAll('.map-node[data-id]')]
      .map(node => node.dataset.id)
      .filter(id => !hiddenSystems.has(id));
  }

  function compactIds(host) {
    const root = host.querySelector(':scope > .compact-map-root');
    if (!root) return [];
    return [...root.querySelectorAll('.compact-node[data-id]')].map(node => node.dataset.id);
  }

  function hasValidCoordinates(host) {
    const root = host.querySelector(':scope > .compact-map-root');
    if (!root) return false;
    return [...root.querySelectorAll('.compact-node[data-id]')].every(node => {
      const left = Number.parseFloat(node.style.left);
      const top = Number.parseFloat(node.style.top);
      return Number.isFinite(left) && Number.isFinite(top);
    });
  }

  function setFallback(host, enabled) {
    const root = host.querySelector(':scope > .compact-map-root');
    const legacy = host.querySelector(':scope > .compact-legacy');
    if (!root || !legacy) return;

    if (enabled) {
      root.style.setProperty('display', 'none', 'important');
      legacy.style.setProperty('display', 'block', 'important');
      host.dataset.graphFallback = '1';
    } else {
      root.style.removeProperty('display');
      legacy.style.removeProperty('display');
      delete host.dataset.graphFallback;
    }
  }

  function verifyHost(host) {
    const expected = expectedLegacyIds(host);
    const actual = compactIds(host);
    if (!expected.length || !actual.length) return;

    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    const sameIds = expectedSet.size === actualSet.size
      && [...expectedSet].every(id => actualSet.has(id));

    setFallback(host, !sameIds || !hasValidCoordinates(host));
  }

  function verifyAll() {
    ['systemMap', 'combatMap'].forEach(id => {
      const host = document.getElementById(id);
      if (host) verifyHost(host);
    });
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      verifyAll();
    });
  }

  async function init() {
    try {
      const response = await fetch('./data/relationships.json', { cache: 'no-store' });
      const data = await response.json();
      hiddenSystems = new Set(data.hiddenSystems || []);
    } catch {
      hiddenSystems = new Set();
    }

    const view = document.getElementById('view');
    if (view) new MutationObserver(schedule).observe(view, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
