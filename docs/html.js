export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function section(title, subtitle = '') {
  return `<div class="section-head"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>`;
}
