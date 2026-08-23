(() => {
  let scheduled = false;

  function edgeEndpoints(edge) {
    return [edge.dataset.from, edge.dataset.to];
  }

  function sequenceLinks(root) {
    return [...root.querySelectorAll('.compact-node.stage-has-next[data-id][data-sequence-next]')]
      .map(node => ({ source: node, from: node.dataset.id, to: node.dataset.sequenceNext }))
      .filter(link => link.from && link.to);
  }

  function clear(root) {
    if (!root) return;
    root.classList.remove('relation-focus-active');
    root.querySelectorAll('.compact-node.focus, .compact-node.dim, .compact-node.stage-sequence-focus, .compact-node.stage-sequence-dim')
      .forEach(node => node.classList.remove('focus', 'dim', 'stage-sequence-focus', 'stage-sequence-dim'));
    root.querySelectorAll('.compact-edge.focus, .compact-edge.dim')
      .forEach(edge => edge.classList.remove('focus', 'dim'));
  }

  function focus(root, id) {
    if (!root || !id) return;
    const nodes = [...root.querySelectorAll('.compact-node[data-id]')];
    const edges = [...root.querySelectorAll('.compact-edge[data-from][data-to]')]
      .map(edge => ({ edge, endpoints: edgeEndpoints(edge) }))
      .filter(item => item.endpoints[0] && item.endpoints[1]);
    const sequences = sequenceLinks(root);

    const related = new Set([id]);
    edges.forEach(({ endpoints: [from, to] }) => {
      if (from === id) related.add(to);
      if (to === id) related.add(from);
    });
    sequences.forEach(({ from, to }) => {
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

    sequences.forEach(({ source, from, to }) => {
      const direct = from === id || to === id;
      source.classList.toggle('stage-sequence-focus', direct);
      source.classList.toggle('stage-sequence-dim', !direct);
    });
  }

  function bindNode(node) {
    if (node.dataset.hoverEmphasis === '3') return;
    node.dataset.hoverEmphasis = '3';

    const root = () => node.closest('.compact-map-root');
    // Loaded after the base map listeners so this becomes the final emphasis state.
    node.addEventListener('mouseenter', () => focus(root(), node.dataset.id));
    node.addEventListener('mouseleave', () => clear(root()));
    node.addEventListener('focus', () => focus(root(), node.dataset.id));
    node.addEventListener('blur', event => {
      const currentRoot = root();
      const next = event.relatedTarget?.closest?.('.compact-node[data-id]');
      if (next && next.closest('.compact-map-root') === currentRoot) focus(currentRoot, next.dataset.id);
      else clear(currentRoot);
    });
  }

  function bindAll() {
    document.querySelectorAll('.compact-map-root .compact-node[data-id]').forEach(bindNode);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scheduled = false;
      bindAll();
    }));
  }

  const view = document.getElementById('view');
  if (view) new MutationObserver(schedule).observe(view, { childList: true, subtree: true });
  window.addEventListener('DOMContentLoaded', schedule);
  schedule();
})();
