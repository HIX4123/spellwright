(() => {
  let relationships = null;
  let scheduled = false;

  const numberStyle = (node, key) => Number.parseFloat(node.style[key]) || 0;
  const geometry = node => ({
    x: numberStyle(node, 'left'),
    y: numberStyle(node, 'top'),
    w: numberStyle(node, 'width') || node.offsetWidth || 148,
    h: numberStyle(node, 'height') || node.offsetHeight || 58
  });

  function stageGroups() {
    const groups = new Map();
    (relationships?.hierarchy || [])
      .filter(edge => edge.type === 'stage')
      .forEach(edge => {
        if (!groups.has(edge.parent)) groups.set(edge.parent, []);
        groups.get(edge.parent).push(edge);
      });
    groups.forEach(edges => edges.sort((a, b) => (a.order || 0) - (b.order || 0)));
    return groups;
  }

  function rerouteIncidentEdges(root, moved) {
    root.querySelectorAll('.compact-edge[data-from][data-to]').forEach(path => {
      if (!moved.has(path.dataset.from) && !moved.has(path.dataset.to)) return;
      const from = root.querySelector(`.compact-node[data-id="${CSS.escape(path.dataset.from)}"]`);
      const to = root.querySelector(`.compact-node[data-id="${CSS.escape(path.dataset.to)}"]`);
      if (!from || !to) return;

      const a = geometry(from);
      const b = geometry(to);
      const sameRow = Math.abs(a.y - b.y) < 4;
      let d;

      if (sameRow) {
        const leftToRight = a.x <= b.x;
        const sx = leftToRight ? a.x + a.w : a.x;
        const ex = leftToRight ? b.x : b.x + b.w;
        const y = Math.round((a.y + a.h / 2 + b.y + b.h / 2) / 2);
        d = `M ${sx} ${y} H ${ex}`;
      } else {
        const sourceAbove = a.y < b.y;
        const sx = a.x + a.w / 2;
        const sy = sourceAbove ? a.y + a.h : a.y;
        const ex = b.x + b.w / 2;
        const ey = sourceAbove ? b.y : b.y + b.h;
        d = `M ${sx} ${sy} L ${ex} ${ey}`;
      }
      path.setAttribute('d', d);
    });
  }

  function uniqueSlots(values, count, mapWidth, nodeW) {
    const epsilon = 2;
    const slots = [];
    [...values].sort((a, b) => a - b).forEach(value => {
      if (!slots.some(existing => Math.abs(existing - value) < epsilon)) slots.push(value);
    });

    const step = nodeW + 26;
    while (slots.length < count) {
      const left = slots.length ? slots[0] - step : 26;
      const right = slots.length ? slots.at(-1) + step : 26;
      const canLeft = left >= 26;
      const canRight = right + nodeW <= mapWidth - 26;
      if (canRight) slots.push(right);
      else if (canLeft) slots.unshift(left);
      else slots.push(right);
    }
    return slots.sort((a, b) => a - b);
  }

  function clearStageMetadata(root) {
    root.querySelectorAll('.compact-node').forEach(node => {
      node.classList.remove('stage-node', 'stage-has-next', 'stage-sequence-focus', 'stage-sequence-dim');
      delete node.dataset.stageParent;
      delete node.dataset.stageOrder;
      delete node.dataset.sequenceNext;
      delete node.dataset.sequencePrev;
      node.style.removeProperty('--stage-sequence-gap');
    });
  }

  function alignGroup(root, parent, stages) {
    const orderedStages = stages
      .map(stage => ({ stage, node: root.querySelector(`.compact-node[data-id="${CSS.escape(stage.child)}"]`) }))
      .filter(item => item.node);
    if (orderedStages.length < 2) return;

    const stageIds = new Set(orderedStages.map(item => item.stage.child));
    const stageGeometry = orderedStages.map(item => geometry(item.node));
    const ys = stageGeometry.map(g => g.y).sort((a, b) => a - b);
    const targetY = ys[Math.floor(ys.length / 2)];
    const parentNode = root.querySelector(`.compact-node[data-id="${CSS.escape(parent)}"]`);
    const parentG = parentNode ? geometry(parentNode) : null;
    const map = root.querySelector('.compact-map');
    const mapWidth = Number.parseFloat(map?.style.width) || map?.clientWidth || 900;
    const nodeW = stageGeometry[0]?.w || 148;

    const targetRow = [...root.querySelectorAll('.compact-node')]
      .map(node => ({ node, g: geometry(node) }))
      .filter(item => Math.abs(item.g.y - targetY) < 6 || stageIds.has(item.node.dataset.id));

    const participants = new Map(targetRow.map(item => [item.node.dataset.id, item]));
    orderedStages.forEach(item => participants.set(item.node.dataset.id, { node: item.node, g: geometry(item.node) }));
    const items = [...participants.values()];
    const slots = uniqueSlots(items.map(item => item.g.x), items.length, mapWidth, nodeW);

    const parentCenter = parentG ? parentG.x + parentG.w / 2 : mapWidth / 2;
    let bestStart = 0;
    let bestCost = Infinity;
    for (let start = 0; start <= slots.length - orderedStages.length; start += 1) {
      const first = slots[start];
      const last = slots[start + orderedStages.length - 1] + nodeW;
      const groupCenter = (first + last) / 2;
      let cost = Math.abs(groupCenter - parentCenter) * 2;
      orderedStages.forEach((item, index) => {
        cost += Math.abs(geometry(item.node).x - slots[start + index]);
      });
      if (cost < bestCost) {
        bestCost = cost;
        bestStart = start;
      }
    }

    const stageSlots = slots.slice(bestStart, bestStart + orderedStages.length);
    const remainingSlots = slots.filter((_, index) => index < bestStart || index >= bestStart + orderedStages.length);
    const otherNodes = items
      .filter(item => !stageIds.has(item.node.dataset.id))
      .sort((a, b) => a.g.x - b.g.x);

    const moved = new Set();
    otherNodes.forEach((item, index) => {
      const nextX = remainingSlots[index];
      if (!Number.isFinite(nextX)) return;
      if (Math.abs(item.g.x - nextX) > .5) moved.add(item.node.dataset.id);
      item.node.style.left = `${nextX}px`;
    });

    orderedStages.forEach((item, index) => {
      const old = geometry(item.node);
      const nextX = stageSlots[index];
      if (Math.abs(old.x - nextX) > .5 || Math.abs(old.y - targetY) > .5) moved.add(item.node.dataset.id);
      item.node.style.left = `${nextX}px`;
      item.node.style.top = `${targetY}px`;
      item.node.classList.add('stage-node');
      item.node.dataset.stageParent = parent;
      item.node.dataset.stageOrder = String(item.stage.order || index + 1);
    });

    rerouteIncidentEdges(root, moved);

    const sequence = (relationships?.sequence || [])
      .filter(edge => stageIds.has(edge.from) && stageIds.has(edge.to))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    sequence.forEach(edge => {
      const from = root.querySelector(`.compact-node[data-id="${CSS.escape(edge.from)}"]`);
      const to = root.querySelector(`.compact-node[data-id="${CSS.escape(edge.to)}"]`);
      if (!from || !to) return;
      const a = geometry(from);
      const b = geometry(to);
      const gap = Math.max(0, b.x - (a.x + a.w));
      from.classList.add('stage-has-next');
      from.dataset.sequenceNext = edge.to;
      to.dataset.sequencePrev = edge.from;
      from.style.setProperty('--stage-sequence-gap', `${gap}px`);
    });
  }

  function patchRoot(root) {
    if (!relationships || root.dataset.stageLayoutRunning === '1') return;
    root.dataset.stageLayoutRunning = '1';
    try {
      root.querySelectorAll('.stage-sequence').forEach(path => path.remove());
      clearStageMetadata(root);
      stageGroups().forEach((stages, parent) => alignGroup(root, parent, stages));
      root.dataset.stageSequence = 'stable';
    } finally {
      delete root.dataset.stageLayoutRunning;
    }
  }

  function patchAll() {
    document.querySelectorAll('.compact-map-root').forEach(patchRoot);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      scheduled = false;
      patchAll();
    })));
  }

  async function init() {
    try {
      const response = await fetch('./data/relationships.json', { cache: 'no-store' });
      relationships = await response.json();
    } catch {
      return;
    }

    const view = document.getElementById('view');
    if (view) {
      new MutationObserver(mutations => {
        const structural = mutations.some(mutation => [...mutation.addedNodes, ...mutation.removedNodes]
          .some(node => node.nodeType === 1 && !node.classList?.contains('stage-sequence')));
        if (structural) schedule();
      }).observe(view, { childList: true, subtree: true });
    }
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
  else init();
})();
