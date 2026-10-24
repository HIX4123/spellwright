import { escapeHtml, section } from './html.js';
import { formatProjectionSerial, globalProjectionSerialLayout } from './projection-selector.js?v=solid-origins-20261020-1';

const ROOT = '#attributes';
const WIKI = '#attributes/wiki/';
const LABELS = [
  ['symbol', '상징'],
  ['motifs', '모티프'],
  ['mechanics', '조작 영역'],
  ['operators', '4대 연산'],
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
    <p class="attribute-index-intro"><strong>삶이란 상실의 연속이다.</strong> 속성명은 상실의 정신적 반응에서 착안한 상징이며 임상적 진단이나 우열을 뜻하지 않습니다. 각 속성의 조작 영역은 정립된 방향이고, 공격·방어 예시는 검토 중입니다.</p>
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

function quadrantCell(item, serialsByKey) {
  if (!item) return '<td>미배정</td>';
  const role = item.role;
  const serial = serialsByKey.get('tetrahedron:' + item.id);
  const id = Number.isInteger(serial) ? formatProjectionSerial(serial) : 'ID 미정';
  return `<td>
    <strong>${safe(id)} · ${safe(role.name)}</strong>
    <small>${safe(role.imageMotif)}</small>
    <p>${safe(role.description)}</p>
  </td>`;
}

function quadrantView(element, projectionReference) {
  if (!element.quadrantFramework) return '';
  const frame = element.quadrantFramework;
  const solids = projectionReference?.projectionData?.solids;
  const views = projectionReference?.viewData?.solids;
  if (!Array.isArray(solids) || !Array.isArray(views)) {
    return '<section id="operators" class="attribute-article-section" tabindex="-1"><h3>해리의 4대 연산</h3><p>사영도 데이터를 확인하려면 <a href="#projections">Projections</a>를 참조하세요.</p></section>';
  }
  const tetra = solids.find(solid => solid.id === 'tetrahedron');
  if (!tetra) return '';
  const serials = globalProjectionSerialLayout(solids, views).serialsByKey;
  const byAxis = (domain, action) => tetra.classes.find(item =>
    item.role?.axisDomain === domain && item.role?.axisAction === action);
  return `<section id="operators" class="attribute-article-section" tabindex="-1">
    <h3>${safe(frame.title)} <small>개시 연산 · 확정</small></h3>
    <p>${safe(frame.premise)}</p>
    <p class="muted">${safe(frame.model)} · ${safe(frame.domainAxis.meaning)} ${safe(frame.actionAxis.meaning)}</p>
    <div class="attribute-quadrant-scroll"><table class="attribute-quadrant">
      <thead><tr><th scope="col">내재성 / 배타성</th><th scope="col">성립 (+)</th><th scope="col">배제 (−)</th></tr></thead>
      <tbody><tr><th scope="row">내재</th>${quadrantCell(byAxis('내재', '성립'), serials)}${quadrantCell(byAxis('내재', '배제'), serials)}</tr>
      <tr><th scope="row">외재</th>${quadrantCell(byAxis('외재', '성립'), serials)}${quadrantCell(byAxis('외재', '배제'), serials)}</tr></tbody>
    </table></div>
    <p class="muted attribute-quadrant-note">전역 번호는 공유된 기하학적 좌표를 바탕으로 속성별 기준 사영을 원점 삼아 매깁니다. 연산별 상세 자료는 <a href="#projections">Projections</a>에서 확인하세요.</p>
    <p class="muted attribute-quadrant-note">${safe(frame.followUp)}</p>
  </section>`;
}


function rootCell(item, serialsByKey, solidId) {
  if (!item) return '<td>미배정</td>';
  const role = item.role;
  const serial = serialsByKey.get(solidId + ':' + item.id);
  return `<td>
    <strong>${safe(Number.isInteger(serial) ? formatProjectionSerial(serial) : 'ID 미정')} · ${safe(role.name)}</strong>
    <small>${safe(role.abilityName)} · ${safe(role.imageMotif)}</small>
    <p>${safe(role.description)}</p>
  </td>`;
}

function rootView(element, projectionReference) {
  const frame = element.rootFramework;
  if (!frame) return '';
  const solids = projectionReference?.projectionData?.solids;
  const views = projectionReference?.viewData?.solids;
  if (!Array.isArray(solids) || !Array.isArray(views)) {
    return '<section id="operators" class="attribute-article-section" tabindex="-1"><h3>${safe(element.name)}의 6대 연산</h3><p>사영도 데이터를 확인하려면 <a href="#projections">Projections</a>를 참조하세요.</p></section>';
  }
  const solidId = element.id === 'chojo' ? 'octahedron' : 'cube';
  const solid = solids.find(item => item.id === solidId);
  if (!solid) return '';
  const serials = globalProjectionSerialLayout(solids, views).serialsByKey;
  const byRoot = (root, direction) => solid.classes.find(item =>
    item.role?.root === root && item.role?.direction === direction);
  return `<section id="operators" class="attribute-article-section" tabindex="-1">
    <h3>${safe(frame.title)} <small>개시 연산 · 확정</small></h3>
    <p>${safe(frame.premise)}</p>
    <p class="muted">${safe(frame.model)}</p>
    <div class="attribute-quadrant-scroll"><table class="attribute-quadrant attribute-root-table">
      <thead><tr><th scope="col">${safe(element.id === 'chojo' ? '변화의 축' : '자리의 기준')}</th><th scope="col">양의 근 (+)</th><th scope="col">대립 근 (−)</th></tr></thead>
      <tbody>${frame.pairs.map(pair => `<tr>
        <th scope="row">${safe(pair.label)}<small>${safe(pair.explanation)}</small></th>
        ${rootCell(byRoot(pair.root, 'positive'), serials, solidId)}
        ${rootCell(byRoot(pair.root, 'negative'), serials, solidId)}
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="muted attribute-quadrant-note">${safe(frame.interpretation)}</p>
    <p class="muted attribute-quadrant-note">${safe(frame.followUp)}
      상세 형상과 역할은 <a href="#projections">Projections</a>에서 확인할 수 있습니다.</p>
  </section>`;
}


function relationStudyView(element) {
  const study = element.relationStudy;
  if (!study) return '';
  const research = study.rmt;
  const researchGroups = research.principles.map(group => `
    <details class="attribute-research-group">
      <summary><strong>${safe(group.name)} (${safe(group.code)})</strong> · 작용 후보 ${group.candidates.length}종</summary>
      <p class="muted">${safe(group.rule)}</p>
      <div class="attribute-quadrant-scroll"><table class="attribute-quadrant attribute-root-table">
        <thead><tr><th scope="col">이름</th><th scope="col">하는 역할</th><th scope="col">용례</th></tr></thead>
        <tbody>${group.candidates.map(candidate => `<tr>
          <th scope="row">${safe(candidate.name)}</th>
          <td>${safe(candidate.role)}</td>
          <td>${safe(candidate.example)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </details>`).join('');
  return `
    <section id="relations" class="attribute-article-section" tabindex="-1">
      <h3>관계의 정의와 작용 <small>설계 방향 · 검토</small></h3>
      <dl class="attribute-facts">
        <div><dt>정의의 질문</dt><dd>${safe(study.philosophy.definitionQuestion)}</dd></div>
        <div><dt>작용의 질문</dt><dd>${safe(study.philosophy.actionQuestion)}</dd></div>
      </dl>
      <p>${safe(study.philosophy.interpretation)}</p>
      <p class="muted">${safe(study.philosophy.note)}</p>
      <h4>하이퍼그래프와 집합 표현식 <small>검토</small></h4>
      <p>${safe(study.representation.headline)}</p>
      <ul class="attribute-compact-list">${study.representation.details.map(value => `<li>${safe(value)}</li>`).join('')}</ul>
      <h4>원시 연산 계열 <small>최소성 미검증</small></h4>
      <div class="attribute-quadrant-scroll"><table class="attribute-quadrant attribute-root-table">
        <thead><tr><th scope="col">계열</th><th scope="col">역할</th></tr></thead>
        <tbody>${study.representation.primitives.map(entry => `<tr><th scope="row">${safe(entry.name)}</th><td>${safe(entry.role)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="muted">${safe(study.representation.primitiveNote)}</p>
    </section>
    <section id="rmt" class="attribute-article-section" tabindex="-1">
      <h3>${safe(research.title)} <small>이론 참고 · 후보 미확정</small></h3>
      <p>${safe(research.theoryNote)}</p>
      ${researchGroups}
      <p class="muted">${safe(research.caution)}</p>
      <h4>기존 후보의 검토 경과</h4>
      <p><strong>주요 작용·정의 후보:</strong> ${safe(study.candidateHistory.core.join(' · '))}</p>
      <p><strong>재검토할 파생 후보:</strong> ${safe(study.candidateHistory.composite.join(' · '))}</p>
      <ul class="attribute-compact-list">${study.candidateHistory.decisions.map(value => `<li>${safe(value)}</li>`).join('')}</ul>
      <h4>남은 질문 <small>미정</small></h4>
      <ul class="attribute-compact-list">${study.openQuestions.map(value => `<li>${safe(value)}</li>`).join('')}</ul>
    </section>`;
}

function attributeArticle(element, elements, projectionReference) {
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
      <h3>수학·시각 모티프 <small>${element.quadrantFramework || element.rootFramework ? '원리 확정 · 해석 참고' : '검토'}</small></h3>
      <ul class="attribute-compact-list">${element.motifIdeas.map(value => `<li>${rich(value)}</li>`).join('')}</ul>
    </section>
    <section id="mechanics" class="attribute-article-section" tabindex="-1">
      <h3>게임 내 조작 영역 <small>정립</small></h3>
      <p>${rich(element.gameplay.identity)}</p>
    </section>
    ${quadrantView(element, projectionReference)}
    ${rootView(element, projectionReference)}
    ${relationStudyView(element)}
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
  const labels = element.rootFramework ? LABELS.map(([id, title]) => id === 'operators' ? [id, '6대 연산'] : [id, title])
    : element.quadrantFramework ? LABELS : LABELS.filter(([id]) => id !== 'operators');
  if (element.relationStudy) {
    labels.splice(3, 0, ['relations', '관계 모델'], ['rmt', 'RMT 작용 후보']);
  }
  return articleShell(element.name, `${element.solid} · ${element.projectionClasses}개 사영 클래스 · ${element.summary}`, element.id, elements, body, labels);
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

export function renderAttributeReference(project, hash = ROOT, projectionReference = null) {
  const elements = project?.elements;
  const rules = project?.attributeRules;
  if (!Array.isArray(elements) || !rules) return '<div class="card">속성 데이터를 불러올 수 없습니다.</div>';
  const route = attributeLocation(hash);
  if (route.kind !== 'article') return index(elements);
  if (route.id === 'rules') return rulesArticle(elements, rules);
  const element = elements.find(item => item.id === route.id);
  return element ? attributeArticle(element, elements, projectionReference)
    : `${section('5대속성')}<div class="card"><p>해당 표제어가 없습니다.</p><a href="${ROOT}">전체 표제어로 돌아가기</a></div>`;
}
