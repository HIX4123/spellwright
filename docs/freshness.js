import { escapeHtml } from './html.js';

export function freshnessPageId(view, hash, storyRoute) {
  if (view === 'story' && storyRoute?.article) return 'story/wiki/' + storyRoute.article;
  if (view === 'attributes') {
    try {
      const match = /^#attributes\/wiki\/([a-z0-9-]+)/.exec(decodeURIComponent(hash));
      if (match) return 'attributes/wiki/' + match[1];
    } catch { /* malformed legacy URL uses the section timestamp */ }
  }
  return view;
}

export function freshnessMarkup(entry, localDraft = false) {
  const stamp = value => {
    if (!value || !Number.isFinite(Date.parse(value))) return '기록 없음';
    const label = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
    return `<time datetime="${escapeHtml(value)}">${escapeHtml(label)} KST</time>`;
  };
  if (!entry) return '<p class="page-freshness">갱신 기록을 불러오지 못했어요.</p>';
  return `<p class="page-freshness">페이지 갱신 ${stamp(entry.updatedAt)} · 연관 검토 ${stamp(entry.reviewedAt)}${localDraft ? ' · 로컬 초안에는 적용되지 않는 저장소 기준 기록' : ''}</p>`;
}
