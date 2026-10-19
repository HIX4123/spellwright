import { escapeHtml, section } from './html.js';
import { storyFlow } from './story-flow.js?v=ieumsae-kar-20261019-1';

export function isNarrativeData(n) {
  if (n === undefined) return true;
  if (!n || typeof n.story !== 'string' || (n.worldbuilding !== undefined && typeof n.worldbuilding !== 'string')) return false;
  for (const [key, fields] of [
    ['acts', ['title', 'question', 'knowledge']],
    ['principles', ['title', 'description']],
    ['pairs', ['divine', 'mythical', 'diagram', 'description']],
    ...['eras', 'plot', 'characters', 'origins', 'cast', 'conflict', 'sacrifice', 'circuitOptions', 'meeting', 'bossPlan', 'restoration', 'bossRules', 'chronosKnowledge', 'foreshadowing', 'experimentLineage', 'circuitLoss', 'beastForms', 'beastConstraintNetwork', 'beastEschatology', 'paradoxExperiment', 'beastWar', 'lossJinx', 'elinLastWords', 'thirdActPlan', 'worldChronology', 'demiurgeChronology', 'actOneArc', 'actOneEpisodes', 'fourthAnswer', 'eloiEcology', 'eloiAppearance', 'kaiDesignStages', 'kaiDesignNotes', 'circuitAscension', 'kaiPsychology', 'kaiJoining', 'kaiAftermath', 'kaiNarration', 'characterMotifs', 'groupFounding', 'creativeReferences', 'narrativeCraft'].map(key => [key, ['title', 'description', 'status']]),
    ...['loop', 'harvest'].map(key => [key, ['title', 'description']])
  ]) {
    if (n[key] !== undefined && (!Array.isArray(n[key])
      || !n[key].every(item => fields.every(field => typeof item?.[field] === 'string')))) return false;
  }
  if (n.timeline !== undefined && (!Array.isArray(n.timeline) || !n.timeline.every(e => e
    && ['id', 'era'].every(k => typeof e[k] === 'string') && /^[a-z0-9-]+$/.test(e.id)
    && (e.source ? ['plot', 'sacrifice', 'actOneArc'].includes(e.source) && Number.isInteger(e.index) && !!n[e.source]?.[e.index]
      : typeof e.title === 'string' && typeof e.description === 'string')
    && (e.note === undefined || typeof e.note === 'string')
    && ['links', 'details'].every(k => e[k] === undefined || Array.isArray(e[k]) && e[k].every(v => typeof v === 'string'))))) return false;
  if (n.storyFlow !== undefined) {
    const graph = n.storyFlow;
    const allowedLanes = ['kai', 'ur', 'heroine', 'join'];
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return false;
    const ids = new Set();
    for (const node of graph.nodes) {
      if (!node || !['id', 'title', 'era', 'lane', 'href'].every(k => typeof node[k] === 'string')
        || !/^[a-z0-9-]+$/.test(node.id) || !allowedLanes.slice(0, 3).includes(node.lane)
        || !/^#story\/(?:plot|world|cast|questions)\/[a-z0-9-]+$/.test(node.href)
        || !Number.isFinite(node.x) || !Number.isFinite(node.y) || ids.has(node.id)) return false;
      ids.add(node.id);
    }
    if (!graph.edges.every(edge => edge && ids.has(edge.from) && ids.has(edge.to)
      && allowedLanes.includes(edge.lane)
      && (edge.path === undefined || typeof edge.path === 'string')
      && (edge.label === undefined || typeof edge.label === 'string')
      && (edge.kind === undefined || ['normal', 'jump', 'join', 'uncertain'].includes(edge.kind))
      && (edge.label === undefined || Number.isFinite(edge.labelX) && Number.isFinite(edge.labelY)))) return false;
  }
  if (n.questionGroups !== undefined && (!Array.isArray(n.questionGroups) || !n.questionGroups.every(g => g
    && typeof g.title === 'string' && Array.isArray(g.indices) && g.indices.every(i => Number.isInteger(i) && typeof n.unresolved?.[i] === 'string')))) return false;
  return (n.pairs === undefined || n.pairs.every(pair => ['time', 'space', 'existence'].includes(pair.diagram)))
    && (n.unresolved === undefined || (Array.isArray(n.unresolved) && n.unresolved.every(item => typeof item === 'string')));
}

function pairDiagram(pair) {
  const shapes = {
    time: '<path d="M25 48H120 M35 38V58 M60 38V58 M85 38V58 M110 38V58"/><circle cx="255" cy="48" r="6" class="world-point"/>',
    space: '<path d="M25 20H115V76H25Z M55 20V76 M85 20V76 M25 48H115"/><circle cx="255" cy="48" r="6" class="world-point"/>',
    existence: '<circle cx="70" cy="48" r="6" class="world-point"/><path d="M215 28H295V70H215Z M215 28L235 14H315L295 28 M295 70L315 56V14 M235 14V56H315 M215 70L235 56"/>'
  };
  const label = { time: '역사와 지속의 대칭', space: 'brane의 재단 ↔ 무간의 현현', existence: '존재 ↔ 표상과 인지' }[pair.diagram];
  return `<svg class="world-pair-diagram" viewBox="0 0 340 96" role="img" aria-label="${escapeHtml(label)}">
    ${shapes[pair.diagram]}<path class="world-diagram-arrow" d="M145 48H185 M178 41L185 48L178 55"/>
    </svg><p class="world-diagram-label">${escapeHtml(label)}</p>`;
}

function cards(items, title, subtitle = '') {
  if (!items?.length) return '';
  return `${section(title, subtitle)}<div class="world-act-grid">${items.map(item => `
    <article class="card world-principle"><span class="world-kicker">${escapeHtml(item.status)}</span>
    <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></article>`).join('')}</div>`;
}

function steps(items, title, subtitle = '') {
  if (!items?.length) return '';
  return `${section(title, subtitle)}<ol class="world-steps">${items.map((item, i) => `
    <li class="card world-step"><span class="world-step-number" aria-hidden="true">${i + 1}</span>
    <div>${item.status ? `<span class="world-kicker">${escapeHtml(item.status)}</span>` : ''}
    <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div></li>`).join('')}</ol>`;
}

function causalLoop(items) {
  if (items?.length !== 4) return '';
  const positions = [[105, 52], [335, 52], [335, 232], [105, 232]];
  return `${section('히로인과 주인공의 인과 고리', '주인공과 히로인의 경험 순서가 다르다')}
    <figure class="card world-loop"><svg viewBox="0 0 440 300" role="img" aria-label="회로 전달, 미래 재회, 전지와 희생 제안, 히로인의 과거행으로 이어지는 인과 고리. 카르는 회로 합일 순간에 엘린을 살리고자 과거행을 선택한다.">
      <defs><marker id="story-loop-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>
      <g class="world-loop-arrows" marker-end="url(#story-loop-arrow)"><path d="M192 52H242"/><path d="M335 88V189"/><path d="M247 232H197"/><path d="M105 196V95"/></g>
      ${items.map((item, i) => { const [x, y] = positions[i]; return `<g><rect x="${x - 86}" y="${y - 34}" width="172" height="68" rx="12"/>
        <text x="${x}" y="${y - 8}">${i + 1}</text><text x="${x}" y="${y + 15}">${escapeHtml(item.title)}</text></g>`; }).join('')}
      <text class="world-loop-center" x="220" y="146">단일 역사 · 인과 연결</text>
      <text class="world-loop-center" x="220" y="168">역사 전체의 반복 여부는 미정</text>
    </svg><figcaption class="muted">인과 고리와 시대 전체를 닫힌 시간선으로 만드는 시도는 구분해요. 카르는 엘린이 과거에서 결국 사고로 죽을 것을 알면서도 합일 순간보다 더 오래 평온하게 살 기회를 주려 과거로 보냅니다. 엘린의 의사와 사고의 구체적 형태는 아직 미정입니다.</figcaption></figure>
    ${steps(items, '고리의 각 사건')}`;
}

function restorationCycle(items) {
  if (items?.length !== 4) return '';
  const positions = [[105, 52], [335, 52], [335, 232], [105, 232]];
  return `${section('중간 보스 · 복원 주기', '몸·기억·마법진이 함께 복원된다')}
    <figure class="card world-loop"><svg viewBox="0 0 440 300" role="img" aria-label="${escapeHtml(items.map(i => i.title).join(' → '))} → 전투와 대응. 복원 범위와 종료 조건은 미정.">
    <defs><marker id="restoration-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>
    <g class="world-loop-arrows" marker-end="url(#restoration-arrow)"><path d="M192 52H242"/><path d="M335 88V189"/><path d="M247 232H197"/><path d="M105 196V95"/></g>
    ${items.map((item,i) => { const [x,y] = positions[i]; return `<g><rect x="${x-86}" y="${y-34}" width="172" height="68" rx="12"/><text x="${x}" y="${y+5}">${escapeHtml(item.title)}</text></g>`; }).join('')}
    <text class="world-loop-center" x="220" y="143">경험은 지워지고</text><text class="world-loop-center" x="220" y="165">사전 설계는 복원된다</text></svg>
    <figcaption class="muted">${escapeHtml(items.map(i => i.description).join(' '))}</figcaption></figure>`;
}

function conflictDiagram(items) {
  if (items?.length !== 3) return '';
  const positions = [[220, 45], [370, 265], [70, 265]];
  return `${section('세 친구의 삼파전', '화살표는 막거나 노리는 방향 · 동기는 아래 카드 참조')}
    <figure class="card world-loop"><svg viewBox="0 0 440 340" role="img" aria-label="${escapeHtml(items.map(i => i.title).join(', '))}">
    <defs><marker id="story-conflict-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>
    <g class="world-loop-arrows" marker-end="url(#story-conflict-arrow)"><path d="M250 82L349 224"/><path d="M310 265H132"/><path d="M89 224L190 82"/></g>
    ${items.map((item, i) => { const [x,y] = positions[i]; return `<g><rect x="${x-58}" y="${y-28}" width="116" height="56" rx="12"/><text x="${x}" y="${y+5}">${escapeHtml(item.title.split(' → ')[0])}</text></g>`; }).join('')}
    <text class="world-loop-center" x="220" y="174">공통의 상실</text><text class="world-loop-center" x="220" y="195">갈라지는 해석</text></svg></figure>
    ${cards(items, '충돌의 이유')}`;
}

const tabs = [['overview', '전체 개요'], ['world', '세계관'], ['cast', '등장인물'], ['plot', '사건과 플롯']];
const destinations = {
  principles: ['world', '세계의 규칙'], eras: ['world', '세 시대'], harvest: ['world', '배양판의 구조'],
  chronos: ['world', '크로노스 · 인식과 진실'], constraints: ['world', '육환신수의 상호 제약'],
  'beast-war': ['world', '패러독스 실험과 신수전쟁'], conflict: ['cast', '세 친구의 갈등'],
  circuits: ['cast', '프레미아의 회로'], 'loss-jinx': ['cast', '상실의 징크스'],
  'elin-last-words': ['cast', '엘린의 유언 조건'], memories: ['cast', '기억과 마력회로'],
  'character-motifs': ['cast', '인물별 원전·디자인 모티프'], 'group-founding': ['cast', '창단 순서와 독립 동기'],
  'creative-references': ['plot', '탐색·보류한 창작 참고'], 'narrative-craft': ['plot', '서사·작법 원칙'],
  'kai-design': ['cast', '카르의 외형 4단계'], 'kai-psychology': ['cast', '카르의 심리와 일상'],
  'kai-joining': ['plot', '카르의 합류 경위'], 'kai-aftermath': ['plot', '집단 붕괴 뒤의 카르'],
  'kai-narration': ['plot', '카르와 독자의 서술 거리'], 'eloi-appearance': ['world', '엘로이족 외형과 수명'],
  causality: ['plot', '엘린의 인과 고리'], 'third-act-plan': ['plot', '3부 설계'],
  'time-map': ['plot', '세계시간 · 교차 사건도'], questions: ['questions', '열어둔 질문']
};

export function storyLocation(hash = '') {
  const [, tab, target] = hash.split('/');
  return { tab: tabs.some(([id]) => id === tab) ? tab : 'overview', target: target || '' };
}

function relatedLinks(ids, n) {
  return `<div class="story-related" aria-label="관련 사항">${ids.map(id => {
    const castIndex = /^cast-(\d+)$/.exec(id)?.[1];
    const [tab, label] = castIndex !== undefined ? ['cast', n.cast?.[castIndex]?.title || '등장인물']
      : id.startsWith('event-') ? ['plot', '프롤로그로 연결'] : destinations[id] || ['questions', '미정 사항'];
    return `<a href="${tab === 'questions' ? '#questions' : '#story/' + tab + '/' + escapeHtml(id)}">${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`;
  }).join('')}</div>`;
}

function timeline(n) {
  if (!n.timeline?.length) return steps(n.plot, '스토리 진행');
  const detailRenderers = {
    experimentLineage: () => steps(n.experimentLineage, '이원화 실험의 계보', '토마·테라의 우발적 사례에서 강경파·온건파 분화와 완성체까지'),
    circuitLoss: () => steps(n.circuitLoss, '마력회로 소실의 5단계', '사영도의 상실 범위를 역순으로 따라 가능 → 관계 → 운동 → 위치 → 경계가 무너진다'),
    bossPlan: () => steps(n.bossPlan, '구제 계획과 자기 적용'),
    restoration: () => restorationCycle(n.restoration),
    bossRules: () => cards(n.bossRules, '복원 마법의 규칙과 한계'),
    foreshadowing: () => cards(n.foreshadowing, '1부에서 2부로 이어지는 복선'),
    sacrifice: () => steps(n.sacrifice?.slice(1), '위기와 희생의 전개'),
    meeting: () => steps(n.meeting, '삼파전 직전 · 대화에서 전투로'),
    actOneEpisodes: () => cards(n.actOneEpisodes, '1부 초반 · 에피소드 구상'),
    kaiJoining: () => steps(n.kaiJoining, '카르 · 첫 만남부터 자발적 합류까지'),
    kaiAftermath: () => cards(n.kaiAftermath, '집단 붕괴 이후 카르의 일상'),
    fourthAnswer: () => cards(n.fourthAnswer, '삼파전의 제4의 답 · 비마법사 동료'),
    chronosKnowledge: () => cards(n.chronosKnowledge, '시간 신위 · 인식과 진실'),
    beastConstraintNetwork: () => cards(n.beastConstraintNetwork, '육환신수의 다자간 상호 제약'),
    beastEschatology: () => cards(n.beastEschatology, '섭리 거역 · 여섯 종말의 상징'),
    paradoxExperiment: () => steps(n.paradoxExperiment, '데미우르고스의 자기반증 실험'),
    beastWar: () => steps(n.beastWar, '패러독스 실험에서 신수전쟁까지'),
    thirdActPlan: () => cards(n.thirdActPlan, '3부 · 카르 토벌과 우르'),
    lossJinx: () => cards(n.lossJinx, '상실의 징크스', '테라의 회로 소실과 구별되는 삶의 조소'),
    elinLastWords: () => cards(n.elinLastWords, '엘린의 유언 · 문구 설계 조건'),
    worldChronology: () => steps(n.worldChronology, '세계 연대기'),
    demiurgeChronology: () => steps(n.demiurgeChronology, '우르 → 데미우르고스 · 개인 시간')
  };
  return `${section('사건 상세 · 작품 순서', '다이어그램의 노드를 클릭하면 해당 사건을 열람할 수 있어요. 모든 기록은 작품에서 읽는 순서대로 배치되어 있습니다.')}
    <ol class="story-timeline story-event-list">${n.timeline.map((event, i) => {
      const item = event.source ? n[event.source]?.[event.index] : event;
      if (!item) return '';
      return `<li id="event-${escapeHtml(event.id)}" class="story-event" tabindex="-1">
        <span class="story-dot" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <details class="story-event-expander">
          <summary><span class="world-kicker">${escapeHtml(event.era)}</span>
          <strong>${escapeHtml(item.title)}</strong><span class="story-event-hint">자세히 보기</span></summary>
          <div class="story-event-body"><p>${escapeHtml(item.description)}</p>
            ${event.note ? `<p class="story-open">미정 · ${escapeHtml(event.note)}</p>` : ''}
            ${relatedLinks(event.links || [], n)}
            ${event.details?.length ? `<details class="story-details"><summary>사건의 세부 설정 펼치기</summary>${event.details.map(key => detailRenderers[key]?.() || '').join('')}</details>` : ''}
          </div>
        </details>
      </li>`;
    }).join('')}</ol>`;
}

export function renderStoryWorld(n = {}, activeTab = 'overview') {
  const textCard = (text, empty) => `<article class="card"><p class="narrative-text${text ? '' : ' muted'}">${escapeHtml(text || empty)}</p></article>`;
  const block = (id, content) => `<div id="${id}" class="story-block" tabindex="-1">${content}</div>`;
  const panels = {
    overview: `${section('상실에서 시작해, 미래를 아는 자의 선택으로')}
      ${textCard(n.story, '아직 정리된 스토리 내용이 없어요.')}
      ${n.acts?.length ? `<div class="world-act-grid">${n.acts.map(act => `<article class="card world-act"><span class="world-kicker">${escapeHtml(act.title)}</span><h3>${escapeHtml(act.question)}</h3><p class="muted">${escapeHtml(act.knowledge)}</p></article>`).join('')}</div>` : ''}
      <div class="story-overview-path"><a href="#story/plot/event-prologue">소꿉친구의 상실</a><a href="#story/plot/event-sacrifice">동료의 희생과 삼파전</a><a href="#story/plot/event-omniscience">시간 신위와 운명의 인식</a><a href="#story/plot/event-collapse">엘로이 종말과 신격화</a><a href="#story/plot/event-third-act">과거 시대의 3부 · 카르 토벌</a></div>
      <p class="muted">사건과 플롯 탭의 교차 다이어그램에서는 세계 연대기, 카르·우르·히로인의 개인 시간을 한눈에 비교할 수 있어요. 아래 상세 기록만 플레이어가 경험하는 순서대로 정렬되어 있습니다.</p>`,
    world: `${block('principles', `${section('세계의 규칙')}${n.principles?.length ? `<div class="world-principle-grid">${n.principles.map(p => `<article class="card world-principle"><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description)}</p></article>`).join('')}</div>` : textCard(n.worldbuilding, '아직 정리된 세계관 내용이 없어요.')}`)}
      ${block('eras', cards(n.eras, '세 시대의 배치와 생활', '작품 순서와 세계 연대기는 일치하지 않아요.'))}
      ${n.pairs?.length ? `${section('삼신수 ↔ 삼환수', '개념적 대칭 · 실제 제약은 육자 전체의 다자간 네트워크')}<div class="world-pair-grid">${n.pairs.map(pair => `<article class="card world-pair"><div class="world-pair-heading"><h3>${escapeHtml(pair.divine)}</h3><span aria-hidden="true">↔</span><h3>${escapeHtml(pair.mythical)}</h3></div>${pairDiagram(pair)}<p class="world-pair-description">${escapeHtml(pair.description)}</p></article>`).join('')}</div><p class="muted world-figure-note">도형은 상징적 대응을 나타내는 모식도예요. 서로만을 제약하는 일대일 맞계약을 뜻하지 않아요.</p>` : ''}
      ${n.beastForms?.length ? block('beast-forms', `${cards(n.beastForms, '육환신수 · 본질 형상의 생물 모티브', '생물의 형태와 생태에서 출발한 디자인 기준 · 권능의 원리와 구분')}<p class="muted world-figure-note">여섯 생물은 신위의 본질 형상을 위한 시각적 원형이지, 권능의 생물학적 원인이나 모든 현현 형태를 규정하지 않아요. 우르처럼 인간 출신인 신위 보유자도 인간형 등 다른 모습으로 나타날 수 있으며, 정확한 진체 구조·크기·색채·변형 정도는 추후 결정합니다.</p>`) : ''}
      ${block('constraints', `${cards(n.beastConstraintNetwork, '육환신수의 상호 제약', '세계의 무결성을 보존하는 다자간 제약망')}${cards(n.beastEschatology, '섭리 거역 · 여섯 종말의 상징', '일부는 아직 상징안·검토 단계예요.')}`)}
      ${block('beast-war', `${steps(n.paradoxExperiment, '데미우르고스의 패러독스 실험', '미래를 일부러 틀리게 만들려는 자기반증에서 시작')}${steps(n.beastWar, '신수전쟁과 전후 질서', '상호 제약을 깨려는 시도 → 전쟁 → 이상낙원 제안')}`)}
      ${block('chronos', cards(n.chronosKnowledge, '크로노스 · 인식과 진실', '토마의 오해, 데미우르고스의 정체, 시간 신위의 인식 범위를 구분해요.'))}
      ${block('harvest', `${steps(n.harvest, '엘로이 문명: 이상낙원과 배양판', '약 200만 년의 실제 성공 문명과 숨은 통합 신위 계획')}${cards(n.eloiEcology, '엘로이족 · 생애와 사회', '수명 · 회로 계승 · 공동체 가족 · 감정과 인구')}${block('eloi-appearance', cards(n.eloiAppearance, '엘로이족 · 외형과 노년 색채', '공통 형질 · 머리끝 · 홍채 · 금속광'))}${steps(n.circuitAscension, '회로의 분화에서 신격화까지', '인간의 고정 계통 ↔ 순수 회로의 합일 · 그릇의 교정')}`)}
      ${cards(n.origins, '기원과 권능 · 추가 검토안', '중복된 낙원 설정은 수확 연대기에서만 관리합니다.')}
      ${block('world-chronology', steps(n.worldChronology, '세계 연대기', '작품의 읽는 순서와 구별되는 사건의 실제 발생 순서'))}`,
    cast: `${section('등장인물과 스탯', '확정된 이름과 임시 이름은 각 인물의 상태에 구분 · 개별 미정 사항은 본문에 표시')}
      <div class="world-act-grid">${(n.cast || []).map((item,i) => `<article id="cast-${i}" tabindex="-1" class="card world-principle"><span class="world-kicker">${escapeHtml(item.status)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p>${n.characterMotifs?.[i] ? `<p class="muted"><a href="#story/cast/motif-${i}">원전·모티프·인물상 자세히 보기 ↗</a></p>` : ''}</article>`).join('')}</div>
      ${block('character-motifs', `${section('인물별 모티프와 차용 범위', '원전에서 무엇을 차용하고 무엇을 배제했는지 · 실재 설정과 보류안을 구분')}${n.characterMotifs?.length ? `<div class="world-act-grid">${n.characterMotifs.map((item,i)=>`
        <article id="motif-${i}" tabindex="-1" class="card world-principle"><span class="world-kicker">${escapeHtml(item.status)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></article>`).join('')}</div>` : ''}`)}
      ${block('group-founding', steps(n.groupFounding, '모임의 결성과 관계 형성', '프레미아 → 라키르 → 니벨 → 카르 · 독립 동기와 가입 순서'))}
      ${block('kai-psychology', cards(n.kaiPsychology, '카르 · 일상과 상실에 대한 작가용 심리', '사교적인 평상시와 상실 후의 관성 · 실제 서술에서는 내면 설명을 점차 줄임'))}
      ${block('kai-design', `${steps(n.kaiDesignStages, '카르 · 외형 변화 4단계', '소년 → 청소년 → 성장한 청소년과 6익 → 회로 합일 이후 성년체')}${cards(n.kaiDesignNotes, '최종 형태 · 디자인 원칙', '회로 수렴 · 서브 컬러 · 회전 훈륜 · 케이프와 망토')}`)}
      ${block('conflict', conflictDiagram(n.conflict))}
      ${block('fourth-answer', cards(n.fourthAnswer, '제4의 답 · 비마법사 히로인 후보', '세 사람의 삼파전과 다른 해법 · 구체적인 답은 아직 미정'))}
      ${block('circuits', cards(n.circuitOptions, '프레미아의 연결성과 마법 제거 계획'))}
      ${block('dualization', steps(n.experimentLineage, '이원화 실험의 계보', '최초의 우발적 성공 → 부작용 발견 → 연구진 분화'))}
      ${block('circuit-loss', steps(n.circuitLoss, '테라의 회로 소실 · 병리적 역순', '실제 회로 강탈·편극으로 가능 → 관계 → 운동 → 위치 → 경계가 무너진다'))}
      ${block('loss-jinx', cards(n.lossJinx, '마법사들에게 전해진 상실의 징크스', '테라의 질환과는 별개인 삶의 조소 · 카르는 이를 서사적으로 핵심화한다'))}
      ${block('elin-last-words', cards(n.elinLastWords, '엘린의 유언 · 문구 설계 조건', '정확한 문구보다 사고 장면과 대화의 자연스러운 연결을 먼저 정한다'))}
      ${block('memories', cards(n.characters, '두 사람의 기억과 마력회로'))}`,
    plot: `${storyFlow(n)}
          ${block('act-one-arc', steps(n.actOneArc, '1부 · 도입부 구상', '카르 합류 → 독립 에피소드 → 새 동료 → 위기'))}
          ${block('kai-joining', steps(n.kaiJoining, '카르 · 경계에서 자발적 합류까지', '프레미아의 영입 포기 → 사적인 만남 → 카르가 역으로 가입 제안'))}
          ${block('kai-aftermath', cards(n.kaiAftermath, '카르 · 라키르와 니벨이 남긴 일상', '업무를 잇고 이전과 같은 자리에 결과물을 놓는 행동'))}
          ${block('kai-narration', cards(n.kaiNarration, '카르의 서술 거리 · B에서 A로', '독자와의 접근성 변화 · 심상은 작가용 참고'))}
          ${block('creative-references', cards(n.creativeReferences, '창작 참고와 보류한 모티프', '아포토시스·식물·꽃무릇·고요한 동세 · 확정 설정과 분리'))}
          ${block('narrative-craft', cards(n.narrativeCraft, '작법과 서사 운영 원칙', '앞서 논의한 서술 거리와 3부작 구조를 연결한 검토 기록'))}
          ${timeline(n)}
          ${block('third-act-plan', cards(n.thirdActPlan, '3부 · 카르 토벌과 우르', '작품상 후속편이면서 세계시간상 전일담'))}
          
          ${block('causality', causalLoop(n.loop))}`

  };
  return `${section('Story & World', '상실 · 세계와의 거래 · 하나의 역사')}
    <nav class="story-nav" aria-label="스토리와 세계관 분류">${tabs.map(([id,label]) => `<a href="#story/${id}"${id === activeTab ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    ${tabs.map(([id,label]) => `<section class="story-panel" aria-label="${label}"${id !== activeTab ? ' hidden' : ''}>${panels[id]}</section>`).join('')}`;
}
