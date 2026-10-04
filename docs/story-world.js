import { escapeHtml, section } from './html.js';

export function isNarrativeData(n) {
  if (n === undefined) return true;
  if (!n || !['story', 'worldbuilding'].every(key => typeof n[key] === 'string')) return false;
  for (const [key, fields] of [
    ['acts', ['title', 'question', 'knowledge']],
    ['principles', ['title', 'description']],
    ['pairs', ['divine', 'mythical', 'diagram', 'description']]
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

export function renderStoryWorld(n = {}) {
  const textCard = (text, empty) => `<article class="card"><p class="narrative-text${text ? '' : ' muted'}">${escapeHtml(text || empty)}</p></article>`;
  return `${section('Story & World', '게임의 스토리와 전반적인 세계관')}
    ${section('스토리의 방향', '구상 단계')}
    ${textCard(n.story, '아직 정리된 스토리 내용이 없어요.')}
    ${n.acts?.length ? `<div class="world-act-grid">${n.acts.map(act => `
      <article class="card world-act"><span class="world-kicker">${escapeHtml(act.title)}</span>
        <h3>${escapeHtml(act.question)}</h3><p class="muted">${escapeHtml(act.knowledge)}</p></article>`).join('')}</div>` : ''}
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
    ${n.unresolved?.length ? `${section('열어둔 질문')}<ul class="card world-questions">${n.unresolved.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul>` : ''}`;
}
