(() => {
  function edgeEndpoints(edge) {
    if (edge.classList.contains('stage-sequence')) {
      return [edge.dataset.sequenceFrom, edge.dataset.sequenceTo];
    }
    return [edge.dataset.from, edge.dataset.to];
  }

  function rootFor(node) {
    return node?.closest?.('.compact-map-root') || null;
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
      .filter(edge => {
        const [from, to] = edgeEndpoints(edge);
        return from && to;
      });

    const related = new Set([id]);
    edges.forEach(edge => {
      const [from, to] = edgeEndpoints(edge);
      if (from === id) related.add(to);
      if (to === id) related.add(from);
    });

    root.classList.add('relation-focus-active');
    nodes.forEach(node => {
      const active = related.has(node.dataset.id);
      node.classList.toggle('focus', active);
      node.classList.toggle('dim', !active);
    });

    edges.forEach(edge => {
      const [from, to] = edgeEndpoints(edge);
      const direct = from === id || to === id;
      edge.classList.toggle('focus', direct);
      edge.classList.toggle('dim', !direct);
    });
  }

  function nodeFromEvent(event) {
    const node = event.target.closest?.('.compact-node[data-id]');
    return node && rootFor(node) ? node : null;
  }

  document.addEventListener('pointerover', event => {
    const node = nodeFromEvent(event);
    if (!node) return;
    if (node.contains(event.relatedTarget)) return;
    focus(rootFor(node), node.dataset.id);
  });

  document.addEventListener('pointerout', event => {
    const node = nodeFromEvent(event);
    if (!node) return;
    if (node.contains(event.relatedTarget)) return;
    const root = rootFor(node);
    const nextNode = event.relatedTarget?.closest?.('.compact-node[data-id]');
    if (nextNode && rootFor(nextNode) === root) {
      focus(root, nextNode.dataset.id);
      return;
    }
    clear(root);
  });

  document.addEventListener('focusin', event => {
    const node = nodeFromEvent(event);
    if (node) focus(rootFor(node), node.dataset.id);
  });

  document.addEventListener('focusout', event => {
    const node = nodeFromEvent(event);
    if (!node) return;
    const root = rootFor(node);
    const nextNode = event.relatedTarget?.closest?.('.compact-node[data-id]');
    if (nextNode && rootFor(nextNode) === root) {
      focus(root, nextNode.dataset.id);
      return;
    }
    clear(root);
  });
})();
