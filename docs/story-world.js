import { escapeHtml, section } from './html.js';

export function isNarrativeData(n) {
  if (n === undefined) return true;
  if (!n || !['story', 'worldbuilding'].every(key => typeof n[key] === 'string')) return false;
  for (const [key, fields] of [
    ['acts', ['title', 'question', 'knowledge']],
    ['principles', ['title', 'description']],
    ['pairs', ['divine', 'mythical', 'diagram', 'description']],
    ...['eras', 'plot', 'characters', 'origins'].map(key => [key, ['title', 'description', 'status']]),
    ...['loop', 'harvest'].map(key => [key, ['title', 'description']])
  ]) {
    if (n[key] !== undefined && (!Array.isArray(n[key])
      || !n[key].every(item => fields.every(field => typeof item?.[field] === 'string')))) return false;
  }
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
    <figure class="card world-loop"><svg viewBox="0 0 440 300" role="img" aria-label="회로 전달, 미래 재회, 전지와 희생 제안, 히로인의 과거행으로 이어지는 인과 고리. 과거행의 세부 동기는 미정.">
      <defs><marker id="story-loop-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>
      <g class="world-loop-arrows" marker-end="url(#story-loop-arrow)"><path d="M192 52H242"/><path d="M335 88V189"/><path d="M247 232H197"/><path d="M105 196V95"/></g>
      ${items.map((item, i) => { const [x, y] = positions[i]; return `<g><rect x="${x - 86}" y="${y - 34}" width="172" height="68" rx="12"/>
        <text x="${x}" y="${y - 8}">${i + 1}</text><text x="${x}" y="${y + 15}">${escapeHtml(item.title)}</text></g>`; }).join('')}
      <text class="world-loop-center" x="220" y="146">단일 역사 · 인과 연결</text>
      <text class="world-loop-center" x="220" y="168">역사 전체의 반복 여부는 미정</text>
    </svg><figcaption class="muted">인과 고리와 시대 전체를 닫힌 시간선으로 만드는 시도는 구분해요. 과거행의 목적과 실행 경위는 아직 다듬고 있어요.</figcaption></figure>
    ${steps(items, '고리의 각 사건')}`;
}

export function renderStoryWorld(n = {}) {
  const textCard = (text, empty) => `<article class="card"><p class="narrative-text${text ? '' : ' muted'}">${escapeHtml(text || empty)}</p></article>`;
  return `${section('Story & World', '게임의 스토리와 전반적인 세계관')}
    ${section('스토리의 방향', '구상 단계')}
    ${textCard(n.story, '아직 정리된 스토리 내용이 없어요.')}
    ${n.acts?.length ? `<div class="world-act-grid">${n.acts.map(act => `
      <article class="card world-act"><span class="world-kicker">${escapeHtml(act.title)}</span>
        <h3>${escapeHtml(act.question)}</h3><p class="muted">${escapeHtml(act.knowledge)}</p></article>`).join('')}</div>` : ''}
    ${cards(n.eras, '두 시대의 생활', '현재 설정')}
    ${steps(n.plot, '스토리 진행', '현재 플롯 · 미정인 연결은 별도 표시')}
    ${causalLoop(n.loop)}
    ${cards(n.characters, '두 사람의 기억과 마력회로')}
    ${steps(n.harvest, '엘로이 문명: 배양판의 구조', '거대한 손의 주인이 의도한 계획 · 구동과 수집 원리는 미정')}
    ${section('세계의 구조')}
    ${n.principles?.length ? `<div class="world-principle-grid">${n.principles.map(p => `
      <article class="card world-principle"><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description)}</p></article>`).join('')}</div>`
      : textCard(n.worldbuilding, '아직 정리된 세계관 내용이 없어요.')}
    ${n.pairs?.length ? `${section('삼신수 ↔ 삼환수', '개념 대응 · 현재안')}
      <div class="world-pair-grid">${n.pairs.map(pair => `
        <article class="card world-pair">
          <div class="world-pair-heading"><div><span class="world-kicker">삼신수</span><h3>${escapeHtml(pair.divine)}</h3></div>
            <span class="muted" aria-hidden="true">↔</span><div><span class="world-kicker">삼환수</span><h3>${escapeHtml(pair.mythical)}</h3></div></div>
          ${pairDiagram(pair)}<p class="world-pair-description">${escapeHtml(pair.description)}</p>
        </article>`).join('')}</div><p class="world-figure-note muted">도형은 개념의 대응을 나타내는 모식도예요. 세부 능력과 작동 규칙은 아직 정하지 않았어요.</p>` : ''}
    ${cards(n.origins, '기원과 권능: 열어둔 안', '대안과 능력 예시 · 확정 설정과 구분')}
    ${n.unresolved?.length ? `${section('열어둔 질문')}<ul class="card world-questions">${n.unresolved.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul>` : ''}`;
}
