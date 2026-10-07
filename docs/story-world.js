import { escapeHtml, section } from './html.js';

export function isNarrativeData(n) {
  if (n === undefined) return true;
  if (!n || !['story', 'worldbuilding'].every(key => typeof n[key] === 'string')) return false;
  for (const [key, fields] of [
    ['acts', ['title', 'question', 'knowledge']],
    ['principles', ['title', 'description']],
    ['pairs', ['divine', 'mythical', 'diagram', 'description']],
    ...['eras', 'plot', 'characters', 'origins', 'cast', 'conflict', 'sacrifice', 'circuitOptions', 'meeting', 'bossPlan', 'restoration', 'bossRules', 'chronosKnowledge', 'foreshadowing', 'experimentLineage', 'circuitLoss'].map(key => [key, ['title', 'description', 'status']]),
    ...['loop', 'harvest'].map(key => [key, ['title', 'description']])
  ]) {
    if (n[key] !== undefined && (!Array.isArray(n[key])
      || !n[key].every(item => fields.every(field => typeof item?.[field] === 'string')))) return false;
  }
  if (n.timeline !== undefined && (!Array.isArray(n.timeline) || !n.timeline.every(e => e
    && ['id', 'era'].every(k => typeof e[k] === 'string') && /^[a-z0-9-]+$/.test(e.id)
    && (e.source ? ['plot', 'sacrifice'].includes(e.source) && Number.isInteger(e.index) && !!n[e.source]?.[e.index]
      : typeof e.title === 'string' && typeof e.description === 'string')
    && (e.note === undefined || typeof e.note === 'string')
    && ['links', 'details'].every(k => e[k] === undefined || Array.isArray(e[k]) && e[k].every(v => typeof v === 'string'))))) return false;
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
  const label = { time: '모든 시각 → 하나의 점', space: '공간의 선·면 → 점', existence: '존재의 점 → 선·면' }[pair.diagram];
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
    <figure class="card world-loop"><svg viewBox="0 0 440 300" role="img" aria-label="회로 전달, 미래 재회, 전지와 희생 제안, 히로인의 과거행으로 이어지는 인과 고리. 엘린은 배양 계획을 막으러 과거로 향한다.">
      <defs><marker id="story-loop-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>
      <g class="world-loop-arrows" marker-end="url(#story-loop-arrow)"><path d="M192 52H242"/><path d="M335 88V189"/><path d="M247 232H197"/><path d="M105 196V95"/></g>
      ${items.map((item, i) => { const [x, y] = positions[i]; return `<g><rect x="${x - 86}" y="${y - 34}" width="172" height="68" rx="12"/>
        <text x="${x}" y="${y - 8}">${i + 1}</text><text x="${x}" y="${y + 15}">${escapeHtml(item.title)}</text></g>`; }).join('')}
      <text class="world-loop-center" x="220" y="146">단일 역사 · 인과 연결</text>
      <text class="world-loop-center" x="220" y="168">역사 전체의 반복 여부는 미정</text>
    </svg><figcaption class="muted">인과 고리와 시대 전체를 닫힌 시간선으로 만드는 시도는 구분해요. 과거행의 목적은 배양 계획 저지이며, 사고의 구체적 형태는 아직 다듬고 있어요.</figcaption></figure>
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

const tabs = [['overview', '전체 개요'], ['world', '세계관'], ['cast', '등장인물'], ['plot', '사건과 플롯'], ['questions', '미정 사항']];
const destinations = {
  principles: ['world', '세계의 규칙'], eras: ['world', '두 시대'], harvest: ['world', '배양판의 구조'],
  chronos: ['world', '크로노스 · 인식과 진실'], conflict: ['cast', '세 친구의 갈등'], circuits: ['cast', '리오의 회로'],
  memories: ['cast', '기억과 마력회로'], causality: ['plot', '엘린의 인과 고리'], questions: ['questions', '열어둔 질문']
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
    return `<a href="#story/${tab}/${escapeHtml(id)}">${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`;
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
    meeting: () => steps(n.meeting, '삼파전 직전 · 대화에서 전투로')
  };
  return `${section('사건과 플롯', '플레이어가 경험하는 순서 · 정확한 연결이 미정인 곳은 따로 표시')}
    <ol class="story-timeline">${n.timeline.map((event, i) => {
      const item = event.source ? n[event.source]?.[event.index] : event;
      if (!item) return '';
      return `<li id="event-${escapeHtml(event.id)}" class="story-event" tabindex="-1">
        <span class="story-dot" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <article class="card"><span class="world-kicker">${escapeHtml(event.era)}</span>
        <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p>
        ${event.note ? `<p class="story-open">미정 · ${escapeHtml(event.note)}</p>` : ''}
        ${relatedLinks(event.links || [], n)}
        ${event.details?.length ? `<details class="story-details"><summary>사건의 세부 설정 펼치기</summary>${event.details.map(key => detailRenderers[key]?.() || '').join('')}</details>` : ''}
        </article></li>`;
    }).join('')}</ol>`;
}

export function renderStoryWorld(n = {}, activeTab = 'overview') {
  const textCard = (text, empty) => `<article class="card"><p class="narrative-text${text ? '' : ' muted'}">${escapeHtml(text || empty)}</p></article>`;
  const block = (id, content) => `<div id="${id}" class="story-block" tabindex="-1">${content}</div>`;
  const panels = {
    overview: `${section('상실에서 시작해, 미래를 아는 자의 선택으로')}
      ${textCard(n.story, '아직 정리된 스토리 내용이 없어요.')}
      ${n.acts?.length ? `<div class="world-act-grid">${n.acts.map(act => `<article class="card world-act"><span class="world-kicker">${escapeHtml(act.title)}</span><h3>${escapeHtml(act.question)}</h3><p class="muted">${escapeHtml(act.knowledge)}</p></article>`).join('')}</div>` : ''}
      <div class="story-overview-path"><a href="#story/plot/event-prologue">소꿉친구의 상실</a><a href="#story/plot/event-sacrifice">동료의 희생과 삼파전</a><a href="#story/plot/event-omniscience">전지와 운명의 인식</a><a href="#story/plot/event-departure">종말에 대한 저항과 과거행</a></div>
      <p class="muted">연대표의 점을 따라 사건을 읽고, 관련 링크로 인물과 세계의 규칙을 확인해요. 세부 기믹은 사건 안에서 펼쳐볼 수 있어요.</p>`,
    world: `${block('principles', `${section('세계의 규칙')}${n.principles?.length ? `<div class="world-principle-grid">${n.principles.map(p => `<article class="card world-principle"><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description)}</p></article>`).join('')}</div>` : textCard(n.worldbuilding, '아직 정리된 세계관 내용이 없어요.')}`)}
      ${block('eras', cards(n.eras, '두 시대의 생활'))}
      ${n.pairs?.length ? `${section('삼신수 ↔ 삼환수', '개념 대응 · 이름은 가명')}<div class="world-pair-grid">${n.pairs.map(pair => `<article class="card world-pair"><div class="world-pair-heading"><h3>${escapeHtml(pair.divine)}</h3><span aria-hidden="true">↔</span><h3>${escapeHtml(pair.mythical)}</h3></div>${pairDiagram(pair)}<p class="world-pair-description">${escapeHtml(pair.description)}</p></article>`).join('')}</div><p class="muted world-figure-note">도형은 개념의 대응을 나타내는 모식도예요. 세부 능력과 작동 규칙은 아직 정하지 않았어요.</p>` : ''}
      ${block('chronos', cards(n.chronosKnowledge, '크로노스 · 인식과 진실', '인물의 믿음과 세계의 실제 설정을 구분해요. 공개 시점은 미정.'))}
      ${block('harvest', steps(n.harvest, '엘로이 문명: 배양판의 구조', '계획의 작동 순서 · 실제 발동 대상과 수집 원리는 미정'))}`,
    cast: `${section('등장인물과 스탯', '이름은 모두 가명 · 개별 항목의 미정 사항은 본문에 표시')}
      <div class="world-act-grid">${(n.cast || []).map((item,i) => `<article id="cast-${i}" tabindex="-1" class="card world-principle"><span class="world-kicker">${escapeHtml(item.status)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></article>`).join('')}</div>
      ${block('conflict', conflictDiagram(n.conflict))}
      ${block('circuits', cards(n.circuitOptions, '리오의 연결성과 마법 제거 계획'))}
      ${block('dualization', steps(n.experimentLineage, '이원화 실험의 계보', '최초의 우발적 성공 → 부작용 발견 → 연구진 분화'))}
      ${block('circuit-loss', steps(n.circuitLoss, '회로 소실과 상실의 역순', '정이십면체의 가능에서 정사면체의 경계까지, 바깥층부터 붕괴한다'))}
      ${block('memories', cards(n.characters, '두 사람의 기억과 마력회로'))}`,
    plot: `${timeline(n)}${block('causality', causalLoop(n.loop))}`,
    questions: `${cards(n.origins, '기원과 권능: 열어둔 안', '대안과 능력 예시 · 아직 채택하지 않은 안')}
      ${block('questions', `${section('열어둔 질문')}${n.questionGroups?.length ? n.questionGroups.map(group => `<section class="card story-question-group"><h3>${escapeHtml(group.title)}</h3><ul>${group.indices.map(i => `<li>${escapeHtml(n.unresolved?.[i])}</li>`).join('')}</ul></section>`).join('') : `<ul class="card world-questions">${(n.unresolved || []).map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul>`}`)}`
  };
  return `${section('Story & World', '상실 · 세계와의 거래 · 하나의 역사')}
    <nav class="story-nav" aria-label="스토리와 세계관 분류">${tabs.map(([id,label]) => `<a href="#story/${id}"${id === activeTab ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    ${tabs.map(([id,label]) => `<section class="story-panel" aria-label="${label}"${id !== activeTab ? ' hidden' : ''}>${panels[id]}</section>`).join('')}`;
}
