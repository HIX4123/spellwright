import { escapeHtml, section } from './html.js';

const ATTRIBUTE_SECTIONS = Object.freeze([
  ['overview', '속성 개요', '#attributes'],
  ['motifs', '모티프 · 상징', '#attributes/motifs'],
  ['gameplay', '게임적 역할', '#attributes/gameplay']
]);

export function attributeSectionFromHash(hash = '') {
  const value = String(hash).replace(/^#/, '');
  if (value === 'attributes/motifs') return 'motifs';
  if (value === 'attributes/gameplay') return 'gameplay';
  return 'overview';
}

function attributeNav(active) {
  return `<nav class="attribute-subnav" aria-label="5대속성 상세 보기">${ATTRIBUTE_SECTIONS
    .map(([id, label, href]) => `<a href="${href}"${id === active ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`)
    .join('')}</nav>`;
}

function safe(value) {
  return escapeHtml(String(value ?? ''));
}

function elementHeading(element, index) {
  return `<div class="attribute-card-heading">
    <span class="attribute-ordinal" aria-hidden="true">${index + 1}</span>
    <div><h3>${safe(element.name)}</h3><p class="muted">${safe(element.solid)} · ${element.projectionClasses}개 사영 클래스</p></div>
  </div>`;
}

function spectrum(elements) {
  return `<ol class="attribute-spectrum" aria-label="해리부터 반추까지의 속성 순서">${elements.map(element =>
    `<li><strong>${safe(element.name)}</strong><span>${safe(element.motto)}</span></li>`
  ).join('')}</ol>
  <p class="muted attribute-spectrum-caption">단순·직접적인 개체 작용에서 관계와 마법적 작용 이력의 복합 조작으로 이어지는 설계상의 경향입니다. 속성의 강약 순위가 아닙니다.</p>`;
}

function overview(elements, rules) {
  return `
    ${section('개시의 속성 선택', '확정된 기본 규칙')}
    <div class="grid cols-2 attribute-rule-grid">
      <article class="card"><span class="status confirmed">확정</span><h3>자유로운 선택</h3><p>${safe(rules.initiation)}</p></article>
      <article class="card"><span class="status confirmed">확정</span><h3>선형 인접 보상</h3><p>${safe(rules.adjacency)}</p><p class="muted">궁극기 보상의 구체 수치·형식은 아직 정해지지 않았습니다.</p></article>
    </div>
    ${section('속성별 조작 영역', '5속성의 상징과 기능을 함께 비교')}
    <div class="attribute-reference-grid">${elements.map((element, i) =>
      `<article class="card attribute-reference-card">
        ${elementHeading(element, i)}
        <p class="attribute-motto">모토 · ${safe(element.motto)} / 상실 · ${safe(element.loss)}</p>
        <p>${safe(element.gameplay.identity)}</p>
      </article>`
    ).join('')}</div>
    <p class="muted attribute-reference-note">세계관 모티프와 상실의 의미는 <a href="#attributes/motifs">모티프 · 상징</a>에서, 공격·방어 예시 및 한계는 <a href="#attributes/gameplay">게임적 역할</a>에서 볼 수 있습니다.</p>`;
}

function motifs(elements, rules) {
  return `
    ${section('상징의 출발점', '확정된 세계관 해석 · 탐색 중인 수학·시각 모티프')}
    <div class="card attribute-intro">
      <p><strong>삶이란 상실의 연속이다.</strong> 각각의 속성은 인간이 잃는 것과 상실 이후의 정신적 반응을 정다면체에 대응시킵니다.</p>
      <p class="muted">명칭은 심리학·정신의학에서 차용한 표현이지만 게임 내 진단명이나 우열의 척도가 아닙니다. 아래 모티프는 확정 세계관과 구분되는 시각적·수학적 구상 후보입니다.</p>
    </div>
    <div class="attribute-reference-grid">${elements.map((element, i) =>
      `<article class="card attribute-reference-card">
        ${elementHeading(element, i)}
        <span class="status confirmed">세계관 상징 · 확정</span>
        <p class="attribute-motto">${safe(element.motto)} · 잃어버린 ${safe(element.loss)}</p>
        <p>${safe(element.meaning)}</p>
        <div class="attribute-card-divider"></div>
        <span class="status review">모티프 아이디어 · 검토</span>
        <ul class="attribute-motif-list">${element.motifIdeas.map(motif => `<li>${safe(motif)}</li>`).join('')}</ul>
      </article>`
    ).join('')}</div>
    <p class="muted attribute-reference-note">${safe(rules.interpretation)}</p>`;
}

function gameplay(elements, rules) {
  return `
    ${section('속성별 공격과 방어', '조작 영역은 정립 · 전투 예시와 한계는 검토 중')}
    <div class="attribute-reference-grid">${elements.map((element, i) =>
      `<article class="card attribute-reference-card">
        ${elementHeading(element, i)}
        <span class="status confirmed">조작 영역 · 정립</span>
        <p>${safe(element.gameplay.identity)}</p>
        <div class="attribute-usage">
          <div><strong>공격 · 예시</strong><p>${safe(element.gameplay.attack)}</p></div>
          <div><strong>방어 · 예시</strong><p>${safe(element.gameplay.defense)}</p></div>
        </div>
        <details class="attribute-limits"><summary>규칙 경계 · 미정 사항</summary><p>${safe(element.gameplay.limits)}</p></details>
      </article>`
    ).join('')}</div>
    ${section('다음 설계 과제', '사영도 연산과 비용은 아직 개별 배정 전')}
    <div class="card"><ul class="attribute-motif-list">${rules.open.map(item => `<li>${safe(item)}</li>`).join('')}</ul>
    <p class="muted">세부 사영도 43종의 기하학적 구조와 기존 역할 가설은 <a href="#projections">Projections</a>에서 볼 수 있습니다.</p></div>`;
}

export function renderAttributeReference(project, hash = '#attributes') {
  const elements = project?.elements;
  const rules = project?.attributeRules;
  if (!Array.isArray(elements) || !rules) return '<div class="card">속성 데이터를 불러올 수 없습니다.</div>';
  const current = attributeSectionFromHash(hash);
  const body = current === 'motifs' ? motifs(elements, rules)
    : current === 'gameplay' ? gameplay(elements, rules)
    : overview(elements, rules);
  return `${section('Five attributes', '개시의 5속성 · 속성별 상징과 조작 영역')}
    ${spectrum(elements)}
    ${attributeNav(current)}
    ${body}`;
}
