(() => {
  let scheduled = false;

  function edgeEndpoints(edge) {
    if (edge.classList.contains('stage-sequence')) {
      return [edge.dataset.sequenceFrom, edge.dataset.sequenceTo];
    }
    return [edge.dataset.from, edge.dataset.to];
  }

  function clear(root) {
    if (!root) return;
    root.classList.remove('relation-focus-active');
    root.querySelectorAll('.compact-node.focus, .compact-node.dim').forEach(node => {
      node.classList.remove('focus', 'dim');
    });
    root.querySelectorAll('.compact-edge.focus, .compact-edge.dim').forEach(edge => {
      edge.classList.remove('focus', 'dim');
    });
  }

  function focus(root, id) {
    if (!root || !id) return;
    const nodes = [...root.querySelectorAll('.compact-node[data-id]')];
    const edges = [...root.querySelectorAll('.compact-edge')]
      .map(edge => ({ edge, endpoints: edgeEndpoints(edge) }))
      .filter(item => item.endpoints[0] && item.endpoints[1]);

    const related = new Set([id]);
    edges.forEach(({ endpoints: [from, to] }) => {
      if (from === id) related.add(to);
      if (to === id) related.add(from);
    });

    root.classList.add('relation-focus-active');
    nodes.forEach(node => {
      const active = related.has(node.dataset.id);
      node.classList.toggle('focus', active);
      node.classList.toggle('dim', !active);
    });

    edges.forEach(({ edge, endpoints: [from, to] }) => {
      const direct = from === id || to === id;
      edge.classList.toggle('focus', direct);
      edge.classList.toggle('dim', !direct);
    });
  }

  function bindNode(node) {
    if (node.dataset.hoverEmphasis === '2') return;
    node.dataset.hoverEmphasis = '2';

    const root = () => node.closest('.compact-map-root');
    // These listeners are attached after graph-layout.js, so they run after the
    // older per-node handlers and restore the final emphasis state.
    node.addEventListener('mouseenter', () => focus(root(), node.dataset.id));
    node.addEventListener('mouseleave', () => clear(root()));
    node.addEventListener('focus', () => focus(root(), node.dataset.id));
    node.addEventListener('blur', event => {
      const currentRoot = root();
      const next = event.relatedTarget?.closest?.('.compact-node[data-id]');
      if (next && next.closest('.compact-map-root') === currentRoot) {
        focus(currentRoot, next.dataset.id);
      } else {
        clear(currentRoot);
      }
    });
  }

  function bindAll() {
    document.querySelectorAll('.compact-map-root .compact-node[data-id]').forEach(bindNode);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      bindAll();
    });
  }

  const view = document.getElementById('view');
  if (view) new MutationObserver(schedule).observe(view, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', schedule);
  schedule();
})();
