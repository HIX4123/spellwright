(() => {
  const THEORY_SYSTEMS = [
    {
      id: 'projection-operator',
      name: '사영 연산자',
      category: 'attribute',
      status: 'review',
      definition: '각 사영도를 속성 영역에 적용되는 기본 연산자로 해석하는 설계 모델.',
      details: '사영도는 완성된 주문명이 아니라 해당 속성이 세계를 어떻게 조작하는지를 정하는 기본 연산자로 본다. 해리는 경계와 동일성, 소외는 위치와 거리, 초조는 운동과 변화량, 고착은 관계와 참조, 반추는 가능성과 결과를 조작 영역으로 삼는다.\n\n43개 사영도 각각의 구체 연산은 아직 역할 가설 단계다. 도형의 구조적 차이는 역할을 구별하는 근거로 사용하되, 최종 판정 기준은 실제 전투에서 서로 다른 실행 동사를 제공하는가에 둔다.',
      introduced: 'v0.2',
      lastModified: 'v0.2',
      dependencies: ['projection-system', 'five-elements']
    },
    {
      id: 'spell-grammar',
      name: '마법 문법',
      category: 'magic',
      status: 'review',
      definition: '유한한 각인 문법을 조합해 많은 마법 구조를 만드는 규칙 체계.',
      details: '무한한 완성 주문을 개별 구현하지 않고 제한된 문법을 조립한다. 개시에서 속성과 사영 연산자를 정하고, 전개에서 대상·형태·변환·조건·보강·제약을 붙이며, 완결에서 즉발·스톡·영속 같은 시전 형식을 정한다.\n\n각 각인은 입력과 출력의 타입을 가진 함수처럼 취급할 수 있다. 문법과 타입이 맞지 않는 조합은 구성 단계에서 거부하고, 유효한 조합만 실행 구조로 변환한다.',
      introduced: 'v0.2',
      lastModified: 'v0.2',
      dependencies: ['engraving', 'projection-operator', 'initiation', 'development', 'completion']
    },
    {
      id: 'effect-graph',
      name: '효과 그래프',
      category: 'magic',
      status: 'review',
      definition: '완성된 서클을 유한한 런타임 객체와 연산의 그래프로 변환하는 구현 모델.',
      details: '서클 조합 결과를 새로운 주문 코드로 생성하는 대신 Entity, Field, Relation, Boundary, SpatialState, Motion, PossibilityState 같은 소수의 공통 런타임 객체로 컴파일한다. 각인은 이 객체를 생성하거나 변형하는 연산이 된다.\n\n예를 들어 유도 화염구는 별도 스킬 코드가 아니라 열을 가진 Projectile에 Motion, 추적 Relation, 충돌 Trigger가 결합된 효과 그래프로 표현한다. 조합 수는 매우 커도 엔진이 구현해야 하는 기본 객체와 연산은 유한하게 유지하는 것이 목표다.',
      introduced: 'v0.2',
      lastModified: 'v0.2',
      dependencies: ['spell-grammar']
    },
    {
      id: 'structural-counterplay',
      name: '구조적 상성',
      category: 'combat',
      status: 'review',
      definition: '고정 속성표가 아니라 서로 같은 상태를 건드리는 연산 충돌에서 발생하는 상성.',
      details: '해리 > 고착 같은 절대적인 오행식 상성표를 두기보다 상대 서클이 만든 구조를 어떤 연산으로 깨거나 우회하는지가 상성을 만든다. 고착의 관계는 해리로 끊을 수 있고, 초조 투사체는 해리로 차단하거나 소외로 회피하거나 초조로 반전하거나 고착으로 정지시키거나 반추로 다른 결과를 선택할 수 있다.\n\n동일한 현상에도 여러 속성이 서로 다른 원리의 대응책을 갖도록 하며, 전투의 핵심을 화력 비교가 아니라 구조 판독과 카운터 서클 작성에 둔다.',
      introduced: 'v0.2',
      lastModified: 'v0.2',
      dependencies: ['effect-graph', 'projection-operator', 'integrity']
    },
    {
      id: 'spell-naming',
      name: '마법 명명 체계',
      category: 'magic',
      status: 'review',
      definition: '자유 조합 결과를 기억하고 공유할 수 있도록 구조명·마법군·변형명·개인명을 겹쳐 쓰는 체계.',
      details: '모든 유효 서클에는 구조를 설명하는 자동 구조명을 붙일 수 있다. 익숙한 결과 패턴은 화염구·방벽 같은 마법군으로 분류하고, 유도·광역·잔류 같은 변형명을 더한다. 플레이어는 저장한 서클에 별도의 개인명을 붙일 수 있다.\n\n겉으로 같은 화염구라도 초조로 열운동을 집속한 구조와 소외로 다른 위치의 화염을 전이한 구조는 내부 원리와 카운터가 다를 수 있다. 따라서 현상적 이름과 구조적 이름을 분리한다.',
      introduced: 'v0.2',
      lastModified: 'v0.2',
      dependencies: ['effect-graph', 'spell-grammar']
    }
  ];

  const THEORY_HIERARCHY = [
    { parent: 'projection-system', child: 'projection-operator', type: 'subtype', note: '사영도는 속성 영역에 적용되는 기본 연산자로 해석한다.' },
    { parent: 'projection-operator', child: 'spell-grammar', type: 'dependency', note: '사영 연산자는 마법 문법의 개시 연산을 제공한다.' },
    { parent: 'engraving', child: 'spell-grammar', type: 'subtype', note: '마법 문법은 개시·전개·완결 각인의 조립 규칙을 정의한다.' },
    { parent: 'spell-grammar', child: 'effect-graph', type: 'dependency', note: '유효한 서클 문법은 실행 가능한 효과 그래프로 변환된다.' },
    { parent: 'effect-graph', child: 'structural-counterplay', type: 'dependency', note: '효과 그래프의 연산 충돌이 구조적 상성을 만든다.' },
    { parent: 'effect-graph', child: 'spell-naming', type: 'dependency', note: '효과 그래프의 결과 특징을 기준으로 마법군과 구조명을 분류한다.' }
  ];

  const PROJECTION_ROLES = {
    '정사면체': {
      3: ['압축·임계', '분절', '하나의 연속된 대상이나 영역 안에 새로운 경계의 발생점을 만들어 둘 이상의 계로 나누는 방향의 역할 가설.', '절단 · 효과 분리'],
      4: ['경계·연결', '차단', '지정한 경계를 사이에 두고 물질·운동·마법 효과의 통과나 전달을 제한하는 방향의 역할 가설.', '방벽 · 절연'],
      1: ['방사·중심', '격리', '한 대상을 중심으로 외부와의 상호작용 경계를 둘러 독립된 계로 취급하는 방향의 역할 가설.', '보호막 · 봉인'],
      2: ['대칭·교차', '상호분리', '맞물린 두 계의 접촉·전달 지점을 분리해 서로의 영향이 넘어가지 못하게 하는 방향의 역할 가설.', '관계 해제 · 상쇄']
    },
    '정육면체': {
      1: ['압축·중첩', '중첩', '서로 다른 두 위치를 한 위치로 취급하거나 공간적 겹침을 허용하는 방향의 역할 가설.', '공간 중첩 · 침투'],
      2: ['축·중첩', '치환', '두 대상이나 두 지점의 위치를 서로 교환하는 방향의 역할 가설.', '순간 치환 · 자리바꿈'],
      3: ['방사·중심', '기준점', '하나의 위치를 공간 계산의 중심·기준점으로 지정하고 다른 위치를 그 기준에 상대화하는 방향의 역할 가설.', '귀환점 · 위치 고정점'],
      5: ['경계·중첩', '인접화', '멀리 떨어진 두 위치 사이의 거리를 접어 서로 바로 맞닿은 위치처럼 취급하는 방향의 역할 가설.', '거리 압축 · 단축 통로'],
      6: ['경계·연결', '전이', '분리된 두 위치를 경로로 연결해 이동 과정 없이 한쪽에서 다른 쪽으로 위치를 넘기는 방향의 역할 가설.', '포탈 · 블링크'],
      4: ['교차망', '재배치', '여러 대상의 위치 관계를 동시에 다시 대응시켜 배치를 섞거나 순환시키는 방향의 역할 가설.', '다중 치환 · 진형 붕괴']
    },
    '정팔면체': {
      1: ['축·중첩', '정렬', '여러 운동 벡터를 하나의 축이나 방향으로 모아 같은 방향으로 움직이게 하는 역할 가설.', '투사 · 돌진'],
      2: ['방사·중심', '방출', '중심에 모인 운동을 바깥 모든 방향으로 퍼뜨리는 역할 가설.', '폭발 · 넉백'],
      5: ['경계·연결', '전달', '한 대상·영역의 운동을 인접한 다음 대상이나 경로로 넘기는 역할 가설.', '충격파 · 연쇄 충격'],
      6: ['경계·교차', '전환', '운동이 경계나 교차점에 도달했을 때 방향·성분을 다른 운동으로 바꾸는 역할 가설.', '반사 · 궤도 변경'],
      4: ['교차망', '분배', '하나의 운동을 여러 경로와 벡터로 나누어 동시에 전개하는 역할 가설.', '산탄 · 다중 투사'],
      3: ['대칭 교차망', '등방화', '운동을 특정 방향에 치우치지 않고 모든 방향에 균등하게 배치하는 역할 가설.', '구형 충격파 · 전방위 방출']
    },
    '정십이면체': {
      1: ['축·중첩', '결속', '두 대상 사이에 직접적이고 지속적인 참조 관계를 만들어 서로를 하나의 관계쌍으로 묶는 역할 가설.', '속박 · 추적 표식'],
      4: ['압축·임계', '고정', '대상과 특정 위치·상태·기준 사이의 관계를 임계 상태로 고정하여 쉽게 바뀌지 않게 하는 역할 가설.', '위치 고정 · 상태 잠금'],
      6: ['경계·연결', '연결', '서로 떨어진 두 대상 사이에 관계 경로를 만들고 한쪽의 정보나 효과가 다른 쪽을 참조하게 하는 역할 가설.', '원격 연결 · 효과 전달'],
      5: ['임계·접합', '접합', '기존에 관계가 없던 두 대상을 새 관계의 접합점에서 직접 연결하는 역할 가설.', '강제 링크 · 계약'],
      7: ['경계·중첩', '중첩 결속', '같은 대상이나 관계쌍 위에 여러 관계를 겹쳐 하나의 연결을 중층화하는 역할 가설.', '다중 속박 · 중첩 표식'],
      8: ['경계·교차', '재배선', '서로 교차하는 관계의 연결 대상을 바꾸어 관계의 끝점을 다시 연결하는 역할 가설.', '표식 전가 · 연결 교환'],
      2: ['방사·대칭망', '귀속', '여러 대상을 하나의 중심 대상·소유자·기준에 묶어 같은 관계망에 편입하는 역할 가설.', '소환 귀속 · 중심 추적'],
      10: ['교차망', '교환', '두 관계가 교차할 때 서로가 참조하는 대상이나 효과를 교환하는 방향의 역할 가설.', '피해 대상 교환 · 표식 교환'],
      11: ['교차망', '연쇄', '한 관계에서 발생한 효과가 연결된 다음 관계로 순차 전파되는 방향의 역할 가설.', '연쇄 저주 · 연쇄 회복'],
      9: ['대칭 경계망', '상호결속', '관계의 양쪽이 서로를 동시에 제약하거나 보강하도록 대칭적인 결속을 만드는 역할 가설.', '동반 속박 · 상호 보호'],
      12: ['경계 교차망', '관계 전달', '관계 자체를 연결망의 다른 대상에게 넘기거나 이어 붙이는 방향의 역할 가설.', '저주 전염 · 표식 전달'],
      13: ['고밀도 교차망', '다중 종속', '하나의 대상이 여러 관계 조건과 동시에 연결되어 복수의 참조를 따르게 하는 역할 가설.', '다중 조건 저주 · 복합 귀속'],
      14: ['고밀도 교차망', '관계망', '다수의 대상을 서로 다른 쌍으로 연결해 복잡한 관계 네트워크를 유지하는 역할 가설.', '연결망 · 군집 제어'],
      3: ['대칭 교차망', '공유', '관계망 안의 여러 대상이 하나의 상태·손실·이득을 균등하게 나누도록 하는 역할 가설.', '피해 공유 · 생명 연결']
    },
    '정이십면체': {
      1: ['축·중첩', '보존', '현재 존재하는 가능 상태 하나를 폐기되지 않도록 붙잡아 이후 선택지로 남기는 역할 가설.', '결과 저장 · 안전 상태 보존'],
      4: ['경계·중첩', '유예', '결과가 확정되는 경계에서 한 가능성을 잠시 미확정 상태로 유지하는 역할 가설.', '판정 유예 · 지연 확정'],
      2: ['대칭 교차망', '병존', '서로 다른 여러 결과를 동시에 유효한 가능성으로 유지하는 역할 가설.', '가능성 분신 · 다중 예측'],
      5: ['임계·중첩', '분기', '하나의 현재 상태에서 서로 다른 후속 결과를 새 가지로 만들어 보존하는 역할 가설.', '행동 분기 · 재굴림 기반'],
      7: ['경계 교차망', '선택 유보', '여러 결과가 교차하는 동안 어느 하나를 현실로 확정하는 시점을 늦추는 역할 가설.', '회피 유보 · 선택 지연'],
      6: ['교차망', '치환', '이미 실현된 결과를 아직 남아 있는 다른 가능 결과와 맞바꾸는 방향의 역할 가설.', '재굴림 · 결과 교환'],
      8: ['임계 교차망', '재분기', '한 차례 선택이나 판정이 일어난 뒤 그 결과에서 다시 새로운 가능성을 갈라내는 역할 가설.', '연속 재시도 · 후속 분기'],
      9: ['대칭 경계망', '회귀', '이전에 보존한 가능 상태로 현재 결과를 되돌리는 방향의 역할 가설.', '되감기 · 상태 복귀'],
      3: ['방사·대칭망', '확산', '하나의 현재 상태에서 다수의 가능한 후속 상태를 넓게 펼쳐 관측하거나 활용하는 역할 가설.', '미래 탐색 · 다중 예측'],
      10: ['경계 교차망', '재선택', '결과 확정 직전 또는 직후 남은 가능성 중 다른 가지를 다시 고르는 방향의 역할 가설.', '판정 재선택 · 회피 보정'],
      11: ['교차망', '재합류', '서로 다른 가능 경로가 같은 결과로 귀결되도록 가지들을 다시 합치는 역할 가설.', '결과 수렴 · 예정된 귀결'],
      12: ['고밀도 경계망', '선별', '많은 가능성 중 조건에 맞지 않는 가지를 제거해 원하는 결과군만 남기는 역할 가설.', '확률 편향 · 조건부 미래'],
      13: ['최고밀도 교차망', '확정', '복잡한 가능성 공간을 하나의 선택 결과로 강하게 수렴시키는 고비용 역할 가설.', '운명 고정 · 결과 확정']
    }
  };

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

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    if (!response.ok) return response;

    const rawUrl = typeof input === 'string' ? input : input?.url;
    const url = new URL(rawUrl, location.href);

    if (url.pathname.endsWith('/data/project.json')) {
      const project = JSON.parse(await response.text());
      const existing = new Set(project.systems.map(system => system.id));
      THEORY_SYSTEMS.forEach(system => {
        if (!existing.has(system.id)) project.systems.push(system);
      });
      project.project.updatedAt = '2026-09-03';
      return new Response(JSON.stringify(project), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (url.pathname.endsWith('/data/relationships.json')) {
      const relationships = await response.json();
      const key = edge => `${edge.parent}>${edge.child}`;
      const existing = new Set(relationships.hierarchy.map(key));
      THEORY_HIERARCHY.forEach(edge => {
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
      .projection-role { min-width:160px; }
      .projection-role strong { display:block; margin-bottom:4px; font-size:12px; }
      .projection-role span { color:var(--muted); font-size:10px; }
      .projection-description { min-width:300px; white-space:normal; line-height:1.55; color:var(--secondary); }
      .projection-example { min-width:150px; white-space:normal; color:var(--muted); line-height:1.5; }
      .projection-theory-note { margin:0 0 10px; padding:10px 12px; border:1px solid var(--line); border-radius:12px; color:var(--secondary); font-size:10px; line-height:1.55; background:var(--surface); }
      @media (max-width:900px) { .theory-grid { grid-template-columns:1fr; } .projection-table { min-width:900px; } }
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
    const tables = document.querySelector('.projection-tables');
    if (!tables || tables.dataset.theoryEnhanced === 'true') return;
    tables.dataset.theoryEnhanced = 'true';

    injectStyles();

    const tableHeading = tables.previousElementSibling;
    if (tableHeading?.classList.contains('section-head')) {
      tableHeading.querySelector('h2').textContent = 'Projection roles';
      const subtitle = tableHeading.querySelector('p');
      if (subtitle) subtitle.textContent = '점 → 선 → 면 순서 · Class ID 유지 · 구체 역할은 현재 가설 단계';
    }

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
    tableHeading.before(theoryHead, theoryGrid);

    const note = document.createElement('p');
    note.className = 'projection-theory-note';
    note.textContent = '아래의 역할은 사영도의 구조적 차이를 실제 마법 연산으로 번역한 1차 가설이다. 교차 수·정점군·최대 중첩·안정자 등 연구용 지표는 UI에서 제외하며, 최종 능력은 실제 전투 프로토타입에서 검증한 뒤 확정한다.';
    tables.before(note);

    document.querySelectorAll('.projection-table-card').forEach(card => {
      const solidTitle = card.querySelector('.projection-group-head h3')?.textContent || '';
      const solid = Object.keys(PROJECTION_ROLES).find(name => solidTitle.includes(name));
      if (!solid) return;

      const table = card.querySelector('.projection-table');
      const head = table?.querySelector('thead tr');
      if (!table || !head) return;
      head.innerHTML = '<th>사영도</th><th>Class ID</th><th>역할 가설</th><th>마법적 해석</th><th>예시</th>';

      table.querySelectorAll('tbody tr').forEach(row => {
        const cells = [...row.children];
        const id = Number(cells[1]?.textContent.replace('#', ''));
        const role = PROJECTION_ROLES[solid][id];
        if (!role) return;
        const image = cells[0].innerHTML;
        const classId = cells[1].textContent;
        row.innerHTML = `
          <td>${image}</td>
          <td>${classId}</td>
          <td class="projection-role"><strong>${role[1]}</strong><span>${role[0]}</span></td>
          <td class="projection-description">${role[2]}</td>
          <td class="projection-example">${role[3]}</td>
        `;
      });
    });
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
