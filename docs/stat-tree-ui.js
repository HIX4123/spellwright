document.addEventListener('click', event => {
  const circleStat = event.target.closest?.('.compact-node[data-id="circle-count"]');
  if (!circleStat) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const statsButton = document.querySelector('#nav .nav-btn[data-view="stats"]');
  statsButton?.click();
}, true);
