import { escapeHtml } from './html.js';

const kinds = new Set(['possible', 'conditional', 'deferred', 'excluded']);

export function renderMagicTrials(trials) {
  if (!Array.isArray(trials) || trials.length === 0) {
    return '<div class="card"><p class="muted">등록된 검증 사례가 없습니다.</p></div>';
  }
  return '<div class="grid cols-2" aria-label="외부 기술 재현 검증 목록">' + trials.map(trial => {
    const kind = kinds.has(trial.kind) ? trial.kind : 'deferred';
    const lines = [['연산 구성', trial.mechanism], ['남은 문제', trial.unresolved]];
    return `<details class="card magic-trial-card" data-kind="${escapeHtml(kind)}">
      <summary><strong>${escapeHtml(trial.title)}</strong> <span class="muted">· ${escapeHtml(trial.source)}</span> <span class="muted">— ${escapeHtml(trial.verdict)}</span></summary>
      <p>${escapeHtml(trial.summary)}</p>
      ${lines.map(([label, value]) => `<p><strong>${escapeHtml(label)}</strong> · ${escapeHtml(value)}</p>`).join('')}
    </details>`;
  }).join('') + '</div>';
}
