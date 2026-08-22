(() => {
  const CLEARANCE = 7;
  const HIT_PAD = 3;
  const BEND_PENALTY = 18;
  const HEADER_FLOOR = 30;

  let scheduled = false;
  const observed = new WeakSet();
  const resizeObserver = new ResizeObserver(() => schedule());

  const center = rect => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
  const expanded = (rect, pad = CLEARANCE) => ({
    left: rect.x - pad,
    right: rect.x + rect.w + pad,
    top: rect.y - pad,
    bottom: rect.y + rect.h + pad
  });

  function rectOf(element) {
    return {
      x: element.offsetLeft,
      y: element.offsetTop,
      w: element.offsetWidth,
      h: element.offsetHeight
    };
  }

  function pointInside(point, rect) {
    const e = 0.001;
    return point.x > rect.left + e && point.x < rect.right - e
      && point.y > rect.top + e && point.y < rect.bottom - e;
  }

  function segmentBlocked(a, b, obstacles) {
    const e = 0.001;
    if (Math.abs(a.x - b.x) < e) {
      const x = a.x;
      const y1 = Math.min(a.y, b.y);
      const y2 = Math.max(a.y, b.y);
      return obstacles.some(rect =>
        x > rect.left + e && x < rect.right - e
        && y2 > rect.top + e && y1 < rect.bottom - e
      );
    }
    if (Math.abs(a.y - b.y) < e) {
      const y = a.y;
      const x1 = Math.min(a.x, b.x);
      const x2 = Math.max(a.x, b.x);
      return obstacles.some(rect =>
        y > rect.top + e && y < rect.bottom - e
        && x2 > rect.left + e && x1 < rect.right - e
      );
    }
    return true;
  }

  function simplify(points) {
    const deduped = [];
    points.forEach(point => {
      const last = deduped[deduped.length - 1];
      if (!last || Math.abs(last.x - point.x) > 0.001 || Math.abs(last.y - point.y) > 0.001) {
        deduped.push(point);
      }
    });
    if (deduped.length < 3) return deduped;

    const result = [deduped[0]];
    for (let i = 1; i < deduped.length - 1; i += 1) {
      const prev = result[result.length - 1];
      const cur = deduped[i];
      const next = deduped[i + 1];
      const vertical = Math.abs(prev.x - cur.x) < 0.001 && Math.abs(cur.x - next.x) < 0.001;
      const horizontal = Math.abs(prev.y - cur.y) < 0.001 && Math.abs(cur.y - next.y) < 0.001;
      if (!vertical && !horizontal) result.push(cur);
    }
    result.push(deduped[deduped.length - 1]);
    return result;
  }

  function port(rect, side) {
    const c = center(rect);
    if (side === 'top') return { port: { x: c.x, y: rect.y }, gate: { x: c.x, y: rect.y - CLEARANCE } };
    if (side === 'bottom') return { port: { x: c.x, y: rect.y + rect.h }, gate: { x: c.x, y: rect.y + rect.h + CLEARANCE } };
    if (side === 'left') return { port: { x: rect.x, y: c.y }, gate: { x: rect.x - CLEARANCE, y: c.y } };
    return { port: { x: rect.x + rect.w, y: c.y }, gate: { x: rect.x + rect.w + CLEARANCE, y: c.y } };
  }

  function candidates(source, target, hierarchy) {
    const a = center(source);
    const b = center(target);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const list = [];
    const add = (fromSide, toSide, preference) => {
      const key = `${fromSide}:${toSide}`;
      if (list.some(item => item.key === key)) return;
      list.push({ key, preference, start: port(source, fromSide), end: port(target, toSide) });
    };

    if (hierarchy) {
      if (dy >= 0) add('bottom', 'top', 0);
      else add('top', 'bottom', 0);
      if (dx >= 0) add('right', 'left', 22);
      else add('left', 'right', 22);
      add('left', 'left', 36);
      add('right', 'right', 36);
      return list;
    }

    if (dx >= 0) add('right', 'left', 0);
    else add('left', 'right', 0);
    if (dy >= 0) add('bottom', 'top', 8);
    else add('top', 'bottom', 8);
    add('right', 'right', 22);
    add('left', 'left', 22);
    add('top', 'top', 28);
    add('bottom', 'bottom', 28);
    if (dx >= 0) add('left', 'right', 34);
    else add('right', 'left', 34);
    return list;
  }

  class Heap {
    constructor() { this.items = []; }
    push(item) {
      this.items.push(item);
      let i = this.items.length - 1;
      while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        if (this.items[p].priority <= item.priority) break;
        this.items[i] = this.items[p];
        i = p;
      }
      this.items[i] = item;
    }
    pop() {
      if (!this.items.length) return null;
      const root = this.items[0];
      const last = this.items.pop();
      if (!this.items.length) return root;
      let i = 0;
      while (true) {
        let child = i * 2 + 1;
        if (child >= this.items.length) break;
        if (child + 1 < this.items.length && this.items[child + 1].priority < this.items[child].priority) child += 1;
        if (this.items[child].priority >= last.priority) break;
        this.items[i] = this.items[child];
        i = child;
      }
      this.items[i] = last;
      return root;
    }
  }

  function visibilityRoute(start, end, obstacles, width, height) {
    const xs = new Set([start.x, end.x, 1, width - 1]);
    const ys = new Set([start.y, end.y, HEADER_FLOOR, height - 1]);
    obstacles.forEach(rect => {
      xs.add(Math.max(1, rect.left));
      xs.add(Math.min(width - 1, rect.right));
      ys.add(Math.max(HEADER_FLOOR, rect.top));
      ys.add(Math.min(height - 1, rect.bottom));
    });

    const xValues = [...xs].sort((a, b) => a - b);
    const yValues = [...ys].sort((a, b) => a - b);
    const points = [];
    const indexByPoint = new Map();
    const key = (x, y) => `${x.toFixed(3)}:${y.toFixed(3)}`;

    xValues.forEach(x => yValues.forEach(y => {
      const point = { x, y };
      if (obstacles.some(rect => pointInside(point, rect))) return;
      indexByPoint.set(key(x, y), points.length);
      points.push(point);
    }));

    const startIndex = indexByPoint.get(key(start.x, start.y));
    const endIndex = indexByPoint.get(key(end.x, end.y));
    if (startIndex == null || endIndex == null) return null;

    const adjacency = Array.from({ length: points.length }, () => []);
    const byX = new Map();
    const byY = new Map();
    points.forEach((point, index) => {
      const xKey = point.x.toFixed(3);
      const yKey = point.y.toFixed(3);
      if (!byX.has(xKey)) byX.set(xKey, []);
      if (!byY.has(yKey)) byY.set(yKey, []);
      byX.get(xKey).push(index);
      byY.get(yKey).push(index);
    });

    const connect = (groups, vertical) => groups.forEach(indices => {
      indices.sort((a, b) => vertical ? points[a].y - points[b].y : points[a].x - points[b].x);
      for (let i = 0; i < indices.length - 1; i += 1) {
        const aIndex = indices[i];
        const bIndex = indices[i + 1];
        const a = points[aIndex];
        const b = points[bIndex];
        if (segmentBlocked(a, b, obstacles)) continue;
        const length = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        const dir = vertical ? 'v' : 'h';
        adjacency[aIndex].push({ index: bIndex, length, dir });
        adjacency[bIndex].push({ index: aIndex, length, dir });
      }
    });
    connect(byX, true);
    connect(byY, false);

    const heap = new Heap();
    const best = new Map();
    const previous = new Map();
    const startState = `${startIndex}:n`;
    best.set(startState, 0);
    heap.push({ index: startIndex, dir: 'n', cost: 0, priority: 0 });
    let finalState = null;

    while (heap.items.length) {
      const current = heap.pop();
      const state = `${current.index}:${current.dir}`;
      if (current.cost !== best.get(state)) continue;
      if (current.index === endIndex) { finalState = state; break; }

      adjacency[current.index].forEach(next => {
        const bend = current.dir !== 'n' && current.dir !== next.dir ? BEND_PENALTY : 0;
        const nextCost = current.cost + next.length + bend;
        const nextState = `${next.index}:${next.dir}`;
        if (nextCost >= (best.get(nextState) ?? Infinity)) return;
        best.set(nextState, nextCost);
        previous.set(nextState, state);
        const point = points[next.index];
        const heuristic = Math.abs(point.x - end.x) + Math.abs(point.y - end.y);
        heap.push({ index: next.index, dir: next.dir, cost: nextCost, priority: nextCost + heuristic });
      });
    }

    if (!finalState) return null;
    const route = [];
    let state = finalState;
    while (state) {
      const [index] = state.split(':');
      route.push(points[Number(index)]);
      state = previous.get(state);
    }
    return simplify(route.reverse());
  }

  function routeCost(points) {
    let length = 0;
    let bends = 0;
    let previousDir = null;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      if (dx > 0.001 && dy > 0.001) return Infinity;
      length += dx + dy;
      const dir = dx > 0.001 ? 'h' : 'v';
      if (previousDir && previousDir !== dir) bends += 1;
      previousDir = dir;
    }
    return length + bends * 6;
  }

  function hitsNodes(points, nodeRects, from, to, pad = HIT_PAD) {
    const obstacles = [...nodeRects.entries()]
      .filter(([id]) => id !== from && id !== to)
      .map(([, rect]) => expanded(rect, pad));
    return points.slice(0, -1).some((point, index) => segmentBlocked(point, points[index + 1], obstacles));
  }

  function fallback(start, end, obstacles, width, height) {
    const candidates = [
      [start, { x: start.x, y: end.y }, end],
      [start, { x: end.x, y: start.y }, end],
      [start, { x: 1, y: start.y }, { x: 1, y: end.y }, end],
      [start, { x: width - 1, y: start.y }, { x: width - 1, y: end.y }, end],
      [start, { x: start.x, y: height - 1 }, { x: end.x, y: height - 1 }, end]
    ];
    return candidates.find(points => points.slice(0, -1).every((point, index) => !segmentBlocked(point, points[index + 1], obstacles))) || null;
  }

  function routeEdge(path, source, target, nodeRects, width, height, index) {
    const hierarchy = path.classList.contains('hierarchy');
    const obstacles = [...nodeRects.values()].map(rect => expanded(rect));
    let best = null;

    candidates(source, target, hierarchy).forEach(candidate => {
      const unrelated = [...nodeRects.entries()]
        .filter(([id]) => id !== path.dataset.from && id !== path.dataset.to)
        .map(([, rect]) => expanded(rect, HIT_PAD));
      if (unrelated.some(rect => pointInside(candidate.start.gate, rect) || pointInside(candidate.end.gate, rect))) return;

      let middle = visibilityRoute(candidate.start.gate, candidate.end.gate, obstacles, width, height);
      if (!middle) middle = fallback(candidate.start.gate, candidate.end.gate, obstacles, width, height);
      if (!middle) return;

      const points = simplify([
        candidate.start.port,
        candidate.start.gate,
        ...middle.slice(1, -1),
        candidate.end.gate,
        candidate.end.port
      ]);
      if (hitsNodes(points, nodeRects, path.dataset.from, path.dataset.to)) return;
      const cost = routeCost(points) + candidate.preference + index * 0.001;
      if (!Number.isFinite(cost)) return;
      if (!best || cost < best.cost) best = { points, cost };
    });

    return best?.points || null;
  }

  function pathData(points) {
    if (!points?.length) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      if (Math.abs(a.x - b.x) < 0.001) d += ` V ${b.y}`;
      else if (Math.abs(a.y - b.y) < 0.001) d += ` H ${b.x}`;
    }
    return d;
  }

  function routeMap(map) {
    const width = map.clientWidth;
    const height = map.clientHeight;
    if (!width || !height) return;

    const nodeRects = new Map();
    map.querySelectorAll('.compact-node').forEach(node => {
      nodeRects.set(node.dataset.id, rectOf(node));
      if (!observed.has(node)) {
        observed.add(node);
        resizeObserver.observe(node);
      }
    });
    if (!observed.has(map)) {
      observed.add(map);
      resizeObserver.observe(map);
    }

    [...map.querySelectorAll('.compact-edge')].forEach((path, index) => {
      const from = path.dataset.from;
      const to = path.dataset.to;
      if (!from || !to) {
        path.style.display = 'none';
        return;
      }
      const source = nodeRects.get(from);
      const target = nodeRects.get(to);
      if (!source || !target) {
        path.style.display = 'none';
        return;
      }

      const points = routeEdge(path, source, target, nodeRects, width, height, index);
      if (!points) {
        path.dataset.routeStatus = 'fallback';
        path.style.display = '';
        return;
      }
      path.setAttribute('d', pathData(points));
      path.dataset.routeStatus = 'ok';
      path.style.display = '';
    });
  }

  function routeAll() {
    document.querySelectorAll('.compact-map').forEach(routeMap);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      routeAll();
    });
  }

  const view = document.getElementById('view');
  if (view) {
    new MutationObserver(schedule).observe(view, { childList: true, subtree: true });
  }
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('DOMContentLoaded', schedule);
  schedule();
})();