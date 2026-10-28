import { escapeHtml, section } from './html.js';
import { storyFlow } from './story-flow.js?v=story-flow-original-20261028-1';

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
        || !/^#story\/(?:wiki|plot|world|cast|questions)\/[a-z0-9-]+$/.test(node.href)
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

// Wiki content is owned by individual JSON documents, not by the page renderer.
const idPattern = /^[a-z0-9-]+$/;
export function isWikiIndex(index) {
  return Boolean(index && Array.isArray(index.documents) && index.legacy
    && index.documents.every(d => d && idPattern.test(d.id)
      && ['title','category','summary'].every(k => typeof d[k] === 'string')
      && Array.isArray(d.aliases) && d.aliases.every(a => typeof a === 'string' && a.length > 0))
    && new Set(index.documents.map(d => d.id)).size === index.documents.length
    && Object.values(index.legacy).every(id => id === 'cast' || index.documents.some(d => d.id === id)));
}

export function isWikiDocument(doc, index) {
  const has = id => index.documents.some(d => d.id === id);
  return Boolean(doc && has(doc.id) && ['title','category','summary'].every(k => typeof doc[k] === 'string')
    && Array.isArray(doc.related) && doc.related.every(has)
    && Array.isArray(doc.sections) && doc.sections.every(s => s && idPattern.test(s.id)
      && typeof s.title === 'string'
      && (s.kind === undefined || ['pairs','causal','restoration','conflict','timeline'].includes(s.kind))
      && (Array.isArray(s.links) ? s.links.every(has) : Array.isArray(s.items) && s.items.every(item => item
        && typeof item.description === 'string'
        && (s.kind === 'pairs' ? ['time','space','existence'].includes(item.diagram)
          && typeof item.divine === 'string' && typeof item.mythical === 'string' : typeof item.title === 'string')
        && (item.status === undefined || typeof item.status === 'string'))))
    && new Set(doc.sections.map(s => s.id)).size === doc.sections.length
    && (!doc.flow || isNarrativeData({ story: '', storyFlow: doc.flow })
      && doc.flow.nodes.every(node => has(node.href.split('/').at(-1)))));
}

export function storyLocation(hash = '', index) {
  const [, tab = 'overview', value = '', target = ''] = hash.split('/');
  if (tab === 'wiki') return { tab: 'wiki', article: value, target };
  const legacy = index?.legacy[value];
  if (legacy) return legacy === 'cast' ? { tab: 'cast', article: '', target: '' }
    : { tab: 'wiki', article: legacy, target: '' };
  if (tab === 'plot' && !value) return { tab: 'wiki', article: 'chronology', target: '' };
  return { tab: ['overview','world','cast','guides'].includes(tab) ? tab : 'overview', article: '', target: '' };
}

const wikiHref = id => '#story/wiki/' + id;
export function linkText(value, index, currentId = '') {
  // Match plain text before escaping so imported text cannot inject markup or URLs.
  const terms = new Map();
  for (const doc of index.documents) {
    for (const term of [doc.title, ...doc.aliases]) if (term.length > 1 && !terms.has(term)) terms.set(term, doc.id);
  }
  const pattern = [...terms.keys()].sort((a,b) => b.length-a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!pattern) return escapeHtml(value);
  let result = '', start = 0;
  for (const match of String(value).matchAll(new RegExp('(?<![\\p{L}\\p{N}_])(?:' + pattern + ')', 'gu'))) {
    result += escapeHtml(String(value).slice(start, match.index));
    const id = terms.get(match[0]), label = escapeHtml(match[0]);
    result += id === currentId ? label : `<a class="wiki-term" href="${wikiHref(id)}">${label}</a>`;
    start = match.index + match[0].length;
  }
  return result + escapeHtml(String(value).slice(start));
}

function articleLinks(ids, index, list = false) {
  const links = ids.map(id => {
    const doc = index.documents.find(d => d.id === id);
    return `<a href="${wikiHref(id)}">${escapeHtml(doc.title)}</a>`;
  });
  return list ? `<ol class="wiki-event-index">${links.map(a => `<li>${a}</li>`).join('')}</ol>`
    : `<div class="story-related">${links.join('')}</div>`;
}

export function renderStoryWorld(n = {}, index = { documents: [], legacy: {} }, route = { tab: 'overview' }, doc) {
  const nav = `<nav class="story-nav" aria-label="위키 탐색">
    <a href="#story"${route.tab === 'overview' ? ' aria-current="page"' : ''}>전체 문서</a>
    <a href="#story/cast"${route.tab === 'cast' ? ' aria-current="page"' : ''}>인물</a>
    <a href="#story/world"${route.tab === 'world' ? ' aria-current="page"' : ''}>세계관</a>
    <a href="#story/plot"${route.article === 'chronology' ? ' aria-current="page"' : ''}>연대표·사건</a>
    <a href="#story/guides"${route.tab === 'guides' ? ' aria-current="page"' : ''}>서사·작법</a>
    <a href="#questions">미정 사항</a></nav>`;
  const header = section('Story & World', '표제어별 문서 · 본문 속 용어를 눌러 관련 설정으로 이동');
  if (route.tab === 'wiki') {
    if (!doc) return `${header}${nav}<div class="card"><h2>문서를 찾을 수 없어요</h2><a href="#story">전체 문서로 돌아가기</a></div>`;
    const rich = text => linkText(text, index, doc.id);
    const content = doc.sections.map(s => {
      let body;
      if (s.links && s.kind === 'timeline') body = '<ol class="wiki-episode-timeline">' + s.links.map((id,i) => { const d=index.documents.find(x=>x.id===id); return d ? '<li><a href="' + wikiHref(id) + '"><span class="wiki-episode-number">' + (i+1) + '</span><span><strong>' + escapeHtml(d.title) + '</strong><small>' + escapeHtml(d.summary) + '</small></span></a></li>' : ''; }).join('') + '</ol>';
      else if (s.links) body = articleLinks(s.links, index, true);
      else if (s.kind === 'pairs') body = `<div class="world-pair-grid">${s.items.map(pair => `<article class="card"><h3>${rich(pair.divine)} ↔ ${rich(pair.mythical)}</h3>${pairDiagram(pair)}<p>${rich(pair.description)}</p></article>`).join('')}</div><p class="muted">도형은 개념적 대칭을 나타내는 모식도이며 일대일 맞계약을 뜻하지 않아요.</p>`;
      else if (s.kind === 'causal') body = causalLoop(s.items);
      else if (s.kind === 'restoration') body = restorationCycle(s.items);
      else if (s.kind === 'conflict') body = conflictDiagram(s.items);
      else body = s.items.map(item => `<div class="wiki-entry">${item.status ? `<p class="wiki-status">${escapeHtml(item.status)}</p>` : ''}<h3>${escapeHtml(item.title)}</h3><p>${rich(item.description)}</p></div>`).join('');
      return `<section id="${s.id}" class="wiki-section" tabindex="-1"><h2>${escapeHtml(s.title)}</h2>${body}</section>`;
    }).join('');
    const toc = `<nav class="wiki-toc" aria-label="문서 목차"><strong>목차</strong><ol>${doc.sections.map(s => `<li><a href="${wikiHref(doc.id)}/${s.id}">${escapeHtml(s.title)}</a></li>`).join('')}</ol></nav>`;
    const flow = doc.flow ? storyFlow({ storyFlow: doc.flow }) : '';
    return `${header}${nav}<article class="wiki-article${doc.id === 'chronology' ? ' wiki-article--chronology' : ''}">
      <header class="wiki-heading"><p class="muted"><a href="#story">전체 문서</a> / ${escapeHtml(doc.category)}</p>
      <h2 id="wiki-title" tabindex="-1">${escapeHtml(doc.title)}</h2><p>${rich(doc.summary)}</p></header>
      ${toc}${flow}${content}
      ${doc.related.length ? `<footer class="wiki-section"><h2>관련 문서</h2>${articleLinks(doc.related, index)}</footer>` : ''}</article>`;
  }
  const allowed = route.tab === 'cast' ? ['인물'] : route.tab === 'world' ? ['종족·문명','조직','개념·규칙','신수·환수'] : route.tab === 'guides' ? ['서사·작법'] : null;
  const visible = index.documents.filter(d => !allowed || allowed.includes(d.category));
  const categories = [...new Set(visible.map(d => d.category))];
  const intro = route.tab === 'overview' ? `<details class="card wiki-intro"><summary>작품 전체 개요</summary><p>${linkText(n.story || '아직 정리된 스토리 내용이 없어요.', index)}</p>
    <div class="world-act-grid">${(n.acts || []).map(a => `<div><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.question)}</p><p class="muted">${escapeHtml(a.knowledge)}</p></div>`).join('')}</div></details>` : '';
  return `${header}${nav}${intro}<label class="wiki-search">문서 찾기<input id="wikiSearch" type="search" placeholder="표제어·이전 이름·주제 검색" autocomplete="off"></label>
    <p id="wikiSearchCount" class="muted" role="status">${visible.length}개 문서</p>
    <div class="wiki-index">${categories.map(category => `<section class="wiki-category"><h2>${escapeHtml(category)}</h2><div class="wiki-document-list">${visible.filter(d => d.category === category).map(d => `<a class="wiki-document" href="${wikiHref(d.id)}" data-search="${escapeHtml([d.title,d.summary,...d.aliases].join(' ').toLowerCase())}"><strong>${escapeHtml(d.title)}</strong><span>${escapeHtml(d.summary)}</span></a>`).join('')}</div></section>`).join('')}</div>
    <p id="wikiNoResults" hidden>일치하는 문서가 없어요. 다른 이름이나 주제로 찾아보세요.</p>`;
}
