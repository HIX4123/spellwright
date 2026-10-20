import { escapeHtml, section } from './html.js';

const ROOT = '#attributes';
const WIKI = '#attributes/wiki/';
const LABELS = [
  ['symbol', '상징'],
  ['motifs', '모티프'],
  ['mechanics', '조작 영역'],
  ['examples', '공격·방어'],
  ['limits', '설계 쟁점']
];

const safe = value => escapeHtml(String(value ?? ''));
const href = id => WIKI + encodeURIComponent(id);

export function attributeLocation(hash = '') {
  try {
    const path = decodeURIComponent(String(hash).replace(/^#/, ''));
    const match = /^attributes\/wiki\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/.exec(path);
    return match ? { kind: 'article', id: match[1], target: match[2] || null }
      : { kind: 'index', id: null, target: null };
  } catch {
    return { kind: 'index', id: null, target: null };
  }
}

function linkAttributeNames(value, elements, currentId) {
  const names = elements.map(item => item.name).sort((a, b) => b.length - a.length);
  const pattern = new RegExp('(' + names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  return String(value).split(pattern).map(fragment => {
    const element = elements.find(item => item.name === fragment);
    return element && element.id !== currentId
      ? '<a href="' + href(element.id) + '">' + safe(fragment) + '</a>'
      : safe(fragment);
  }).join('');
}

function termNavigation(elements, currentId) {
  const links = elements.map(item =>
    '<a href="' + href(item.id) + '"' + (item.id === currentId ? ' aria-current="page"' : '') +
    '>' + safe(item.name) + '</a>').join('');
  return '<nav class="attribute-term-nav" aria-label="관련 속성 표제어">' + links +
    '<a href="' + href('rules') + '"' + (currentId === 'rules' ? ' aria-current="page"' : '') +
    '>개시 규칙</a></nav>';
}

function index(elements) {
  return `${section('5대속성', '표제어 색인 · 필요한 개념을 선택하면 상세 문서로 이동')}
    <p class="attribute-index-intro">각 속성은 세계를 조작하는 대상을 달리합니다. 상징과 능력을 비교한 뒤 표제어를 선택해 모티프·공방·미정 사항을 함께 확인하세요.</p>
    <div class="attribute-index-labels" aria-hidden="true">
      <span>속성 · 정다면체</span><span>세계관 · 모토</span><span>주요 조작 영역</span>
    </div>
    <ul class="attribute-index-list">${elements.map(element => `
      <li><a class="attribute-index-entry" href="${href(element.id)}">
        <span class="attribute-index-title"><strong>${safe(element.name)}</strong>
          <small>${safe(element.solid)} · 사영도 ${element.projectionClasses}종</small></span>
        <span class="attribute-index-motto">${safe(element.motto)} <small>상실 · ${safe(element.loss)}</small></span>
        <span class="attribute-index-summary">${safe(element.summary)}<span aria-hidden="true" class="attribute-index-arrow">↗</span></span>
      </a></li>`).join('')}</ul>
    ${section('공통 규칙', '속성 자체의 선택과 연속 개시 효과')}
    <a class="attribute-rule-entry" href="${href('rules')}"><strong>개시 규칙</strong>
      <span>자유 선택 · 별도 선택 비용 없음 · 동일/인접 속성 궁극기 메리트</span><span aria-hidden="true">↗</span></a>
    <p class="muted attribute-index-footer">개별 사영도의 역할 배정은 <a href="#projections">Projections</a>, 시스템 간 의존 관계는 <a href="#systems">Systems</a>에서 확인할 수 있습니다.</p>`;
}

function toc(id, labels) {
  return '<nav class="attribute-article-toc" aria-label="이 문서의 목차">' +
    labels.map(([anchor, title]) => `<a href="${href(id)}/${anchor}">${safe(title)}</a>`).join('') +
    '</nav>';
}

function articleShell(title, subtitle, id, elements, body, labels) {
  return `${section('5대속성', '속성별 단일 원본 문서 · 다른 표제어는 링크로 이동')}
    <div class="attribute-breadcrumb"><a href="${ROOT}">전체 표제어</a> <span aria-hidden="true">/</span> ${safe(title)}</div>
    ${termNavigation(elements, id)}
    <article class="attribute-article" aria-labelledby="attribute-document-title">
      <header class="attribute-article-head">
        <h2 id="attribute-document-title" tabindex="-1">${safe(title)}</h2>
        <p class="muted">${safe(subtitle)}</p>
      </header>
      ${toc(id, labels)}
      ${body}
    </article>`;
}

function attributeArticle(element, elements) {
  const rich = value => linkAttributeNames(value, elements, element.id);
  const body = `
    <section id="symbol" class="attribute-article-section" tabindex="-1">
      <h3>세계관의 상징 <small>확정</small></h3>
      <dl class="attribute-facts">
        <div><dt>근본 모토</dt><dd>${safe(element.motto)}</dd></div>
        <div><dt>상실</dt><dd>${safe(element.loss)}</dd></div>
      </dl>
      <p>${rich(element.meaning)}</p>
    </section>
    <section id="motifs" class="attribute-article-section" tabindex="-1">
      <h3>수학·시각 모티프 <small>검토</small></h3>
      <ul class="attribute-compact-list">${element.motifIdeas.map(value => `<li>${rich(value)}</li>`).join('')}</ul>
    </section>
    <section id="mechanics" class="attribute-article-section" tabindex="-1">
      <h3>게임 내 조작 영역 <small>정립</small></h3>
      <p>${rich(element.gameplay.identity)}</p>
    </section>
    <section id="examples" class="attribute-article-section" tabindex="-1">
      <h3>기본 공방 <small>구현 예시 · 검토</small></h3>
      <div class="attribute-action-pair">
        <div><strong>공격</strong><p>${rich(element.gameplay.attack)}</p></div>
        <div><strong>방어</strong><p>${rich(element.gameplay.defense)}</p></div>
      </div>
    </section>
    <section id="limits" class="attribute-article-section" tabindex="-1">
      <h3>설계 경계와 미정 사항 <small>검토·미정</small></h3>
      <p>${rich(element.gameplay.limits)}</p>
      <p class="attribute-see-also">공통 개시 규칙: <a href="${href('rules')}">개시 규칙</a>
        · 사영도별 기능: <a href="#projections">Projections</a></p>
    </section>`;
  return articleShell(element.name, `${element.solid} · ${element.projectionClasses}개 사영 클래스 · ${element.summary}`, element.id, elements, body, LABELS);
}

function rulesArticle(elements, rules) {
  const body = `
    <section id="choice" class="attribute-article-section" tabindex="-1">
      <h3>속성의 자유 선택 <small>확정</small></h3>
      <p>${safe(rules.initiation)}</p>
    </section>
    <section id="adjacency" class="attribute-article-section" tabindex="-1">
      <h3>연속 개시의 인접성 <small>원칙 확정 · 수치 미정</small></h3>
      <ol class="attribute-order">${rules.sequence.map(name => {
        const element = elements.find(e => e.name === name);
        return `<li>${element ? `<a href="${href(element.id)}">${safe(name)}</a>` : safe(name)}</li>`;
      }).join('')}</ol>
      <p>${safe(rules.adjacency)}</p>
      <p class="muted">${safe(rules.interpretation)}</p>
    </section>
    <section id="unresolved" class="attribute-article-section" tabindex="-1">
      <h3>남은 설계 과제 <small>미정</small></h3>
      <ul class="attribute-compact-list">${rules.open.map(value => `<li>${safe(value)}</li>`).join('')}</ul>
    </section>`;
  return articleShell('개시 규칙', '5속성의 자유 선택과 선형 인접 보상', 'rules', elements, body,
    [['choice', '자유 선택'], ['adjacency', '인접성'], ['unresolved', '남은 과제']]);
}

export function renderAttributeReference(project, hash = ROOT) {
  const elements = project?.elements;
  const rules = project?.attributeRules;
  if (!Array.isArray(elements) || !rules) return '<div class="card">속성 데이터를 불러올 수 없습니다.</div>';
  const route = attributeLocation(hash);
  if (route.kind !== 'article') return index(elements);
  if (route.id === 'rules') return rulesArticle(elements, rules);
  const element = elements.find(item => item.id === route.id);
  return element ? attributeArticle(element, elements)
    : `${section('5대속성')}<div class="card"><p>해당 표제어가 없습니다.</p><a href="${ROOT}">전체 표제어로 돌아가기</a></div>`;
}
