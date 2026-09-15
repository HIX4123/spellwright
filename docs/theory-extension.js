(() => {
  const THEORY_DATA_URL = './data/theory.json';
  const nativeFetch = window.fetch.bind(window);

  function isTheoryData(value) {
    return Boolean(value?.schemaVersion === 1
      && Array.isArray(value.systems)
      && Array.isArray(value.hierarchy)
      && value.systems.every(system => typeof system?.id === 'string'
        && typeof system.name === 'string'
        && typeof system.category === 'string'
        && typeof system.status === 'string'
        && Array.isArray(system.dependencies))
      && value.hierarchy.every(edge => typeof edge?.parent === 'string'
        && typeof edge.child === 'string'
        && typeof edge.type === 'string'));
  }

  const theoryDataPromise = nativeFetch(THEORY_DATA_URL, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Failed to load magic theory data');
      return response.json();
    })
    .then(theory => {
      if (!isTheoryData(theory)) throw new Error('Invalid magic theory data');
      return theory;
    });

  const THEORY_CARDS = [
    ['속성과 조작 영역', '속성은 원소 재료가 아니라 현실을 조작할 수 있는 영역을 정한다.', '해리 = 경계·동일성 · 소외 = 위치·거리 · 초조 = 운동·변화량 · 고착 = 관계·참조 · 반추 = 가능성·결과'],
    ['사영도 = 연산자', '사영도는 완성 주문이 아니라 해당 속성의 영역에 적용되는 기본 실행 동사다.', '예: 초조의 정렬·방출·전달·전환·분배·등방화. 43개 전체 매핑은 역할 가설 단계다.'],
    ['개시 → 전개 → 완결', '개시는 속성과 출발 연산을, 전개는 대상·형태·변환·조건·제약·보강을, 완결은 시전 형식을 정한다.', '강도·범위·마나·조건 같은 수치적 조정은 사영도보다 전개 각인의 책임으로 둔다.'],
    ['타입 있는 마법 문법', '각인은 입력과 출력 타입을 가진 함수처럼 취급한다. 문법적으로 연결되지 않는 조합은 구성 단계에서 거부한다.', '무한한 주문을 개별 구현하지 않고 유한한 문법이 큰 조합 공간을 만든다.'],
    ['효과 그래프', '유효한 서클은 Entity, Field, Relation, Boundary, SpatialState, Motion, PossibilityState 같은 공통 객체의 그래프로 변환한다.', '유도 화염구도 별도 스킬 코드가 아니라 열·운동·추적 관계·충돌 조건이 결합된 그래프로 실행한다.'],
    ['구조적 상성', '속성표의 고정 배율보다 같은 상태를 건드리는 연산끼리의 충돌과 우회가 상성을 만든다.', '고착의 관계는 해리로 끊고, 초조 투사체는 차단·회피·반전·고정·결과 선택 등 서로 다른 방식으로 대응할 수 있다.'],
    ['마법 이름', '현상적 이름과 내부 구조를 분리한다. 구조명 → 마법군 → 변형명 → 플레이어 개인명을 겹쳐 사용할 수 있다.', '겉으로 같은 화염구라도 초조 집속식과 소외 전이식은 내부 구조와 카운터가 다를 수 있다.'],
    ['화염구 예시', '초조 계통에서 가장 단순한 고전적 화염구를 조립한 예시.', '초조·집속 → 구형 구속 → 열화 → 전방 지향 → 충돌 시 해제 → 즉발 = 화염구 계열']
  ];

  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    if (!response.ok) return response;

    const rawUrl = typeof input === 'string' ? input : input?.url;
    const url = new URL(rawUrl, location.href);

    if (url.pathname.endsWith('/data/project.json')) {
      const [project, theory] = await Promise.all([response.json(), theoryDataPromise]);
      const existing = new Set(project.systems.map(system => system.id));
      theory.systems.forEach(system => {
        if (!existing.has(system.id)) project.systems.push(system);
      });
      project.project.updatedAt = '2026-09-03';
      return new Response(JSON.stringify(project), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (url.pathname.endsWith('/data/relationships.json')) {
      const [relationships, theory] = await Promise.all([response.json(), theoryDataPromise]);
      const key = edge => `${edge.parent}>${edge.child}`;
      const existing = new Set(relationships.hierarchy.map(key));
      theory.hierarchy.forEach(edge => {
        if (!existing.has(key(edge))) relationships.hierarchy.push(edge);
      });
      return new Response(JSON.stringify(relationships), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    return response;
  };

  function injectStyles() {
    if (document.getElementById('magicTheoryStyles')) return;
    const style = document.createElement('style');
    style.id = 'magicTheoryStyles';
    style.textContent = `
      .theory-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .theory-card { min-width:0; }
      .theory-card h3 { margin:0 0 7px; font-size:12px; }
      .theory-card p { margin:0; color:var(--secondary); font-size:11px; line-height:1.6; }
      .theory-card .theory-note { margin-top:7px; color:var(--muted); font-size:10px; }
      @media (max-width:900px) { .theory-grid { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function makeSectionHead(title, subtitle) {
    const head = document.createElement('div');
    head.className = 'section-head theory-section-head';
    head.innerHTML = `<h2>${title}</h2><p>${subtitle}</p>`;
    return head;
  }

  function enhanceAttributes() {
    const simulation = document.getElementById('projectionSimulation');
    if (!simulation || simulation.dataset.theoryEnhanced === 'true') return;
    simulation.dataset.theoryEnhanced = 'true';

    injectStyles();

    const theoryHead = makeSectionHead('Magic theory', '현재까지 정립된 마법 구현 원리와 전투 해석');
    const theoryGrid = document.createElement('div');
    theoryGrid.className = 'theory-grid';
    theoryGrid.innerHTML = THEORY_CARDS.map(([title, body, note]) => `
      <article class="card theory-card">
        <h3>${title}</h3>
        <p>${body}</p>
        <p class="theory-note">${note}</p>
      </article>
    `).join('');
    simulation.after(theoryHead, theoryGrid);
  }

  const observer = new MutationObserver(() => enhanceAttributes());
  const start = () => {
    injectStyles();
    const view = document.getElementById('view');
    if (view) {
      observer.observe(view, { childList: true, subtree: true });
      enhanceAttributes();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
