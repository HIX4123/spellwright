const STAT_IDS = [
  'health',
  'mana',
  'circle-count',
  'engraving-capacity',
  'insight',
  'mental-strength',
  'potential'
];

function decorateStatPanel(map) {
  const root = map.querySelector('.compact-node[data-id="character-stats"]');
  if (!root) return;

  const rows = STAT_IDS
    .map(id => map.querySelector(`.compact-node[data-id="${id}"]`))
    .filter(Boolean);
  if (!rows.length) return;

  root.classList.add('stat-panel-title');
  rows.forEach(row => row.classList.add('stat-panel-row'));

  map.querySelector('.stat-panel-frame')?.remove();
  const last = rows.at(-1);
  const frame = document.createElement('div');
  frame.className = 'stat-panel-frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.left = root.style.left;
  frame.style.top = root.style.top;
  frame.style.width = root.style.width;
  frame.style.height = `${parseFloat(last.style.top) + parseFloat(last.style.height) - parseFloat(root.style.top)}px`;
  map.appendChild(frame);
}

function decorateAll() {
  document.querySelectorAll('.compact-map').forEach(decorateStatPanel);
}

document.addEventListener('click', event => {
  const circleStat = event.target.closest?.('.compact-node[data-id="circle-count"]');
  if (!circleStat) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const statsButton = document.querySelector('#nav .nav-btn[data-view="stats"]');
  statsButton?.click();
}, true);

const observer = new MutationObserver(() => queueMicrotask(decorateAll));
observer.observe(document.documentElement, { childList: true, subtree: true });
queueMicrotask(decorateAll);
