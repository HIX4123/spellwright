import { escapeHtml, section } from './html.js';

const lanes = [
  { id: 'kai', label: '카이', subtitle: '현대 → 엘로이 → 3부 과거' },
  { id: 'ur', label: '우르 / 데미우르고스', subtitle: '인간 → 시간 신위 → 인과의 기원' },
  { id: 'heroine', label: '엘로이 히로인', subtitle: '엘로이 → 어린 카이의 시대' }
];
const regions = [
  { from: 48, to: 510, label: '3부의 과거', sub: '세계시간상 1부 이전' },
  { from: 510, to: 920, label: '신수전쟁 · 낙원 설계', sub: '1부 이전의 역사' },
  { from: 920, to: 1325, label: '1부 · 현대', sub: '카이의 유년기와 종장' },
  { from: 1325, to: 1870, label: '2부 · 엘로이 시대', sub: '문명 말기 · 신격화' }
];
const axisY = { kai: 228, ur: 444, heroine: 648 };
const widthFor = node => node.lane === 'ur' ? 142 : 160;
const text = value => escapeHtml(String(value ?? ''));
const coord = value => Number.isFinite(value) ? value : 0;
const safeLink = value => /^#story\/(?:plot|world|cast|questions)\/[a-z0-9-]+$/.test(value || '') ? value : '#story/plot';

function routePath(edge, nodes) {
  if (edge.path) return edge.path;
  const a = nodes.get(edge.from), b = nodes.get(edge.to);
  if (!a || !b) return '';
  const dir = Math.sign(b.x - a.x) || 1;
  return `M ${a.x + dir * widthFor(a) / 2} ${a.y} H ${b.x - dir * widthFor(b) / 2}`;
}

function svgNode(node) {
  const w = widthFor(node), x = coord(node.x) - w / 2, y = coord(node.y) - 34;
  const id = text(node.id), label = text(node.title), era = text(node.era), note = text(node.note || '');
  return `<a href="${safeLink(node.href)}" class="story-flow-node story-flow-node--${text(node.lane)}" aria-label="${label} · ${era} · 사건 상세로 이동">
    <title>${label} · ${era}${note ? ' · ' + note : ''}</title>
    <rect x="${x}" y="${y}" width="${w}" height="68" rx="12"/>
    <text class="story-flow-node-title" x="${node.x}" y="${node.y - 5}">${label}</text>
    <text class="story-flow-node-era" x="${node.x}" y="${node.y + 15}">${era}</text>
  </a>`;
}

export function storyFlow(n) {
  const model = n.storyFlow;
  if (!model?.nodes?.length || !model?.edges?.length) return '';
  const nodes = new Map(model.nodes.map(node => [node.id, node]));
  const edges = model.edges.filter(edge => (edge.path || (nodes.has(edge.from) && nodes.has(edge.to))));
  return `${section('교차 시간선 · 전체 사건도', '가로축은 세계시간, 색상별 경로는 각 인물의 경험 순서 · 노드를 누르면 해당 사건의 상세 기록으로 이동')}
    <div class="story-flow-order" aria-label="작품 공개 순서">
      <strong>작품 순서</strong><a href="#story/plot/event-prologue">1부 · 현대</a><span aria-hidden="true">→</span>
      <a href="#story/plot/event-reunion">2부 · 엘로이</a><span aria-hidden="true">→</span>
      <a href="#story/plot/event-third-act">3부 · 과거</a>
      <span class="story-flow-order-tip">아래 가로축과 다름</span>
    </div>
    <div id="time-map" class="story-flow-map story-block" tabindex="-1">
      <div class="story-flow-key" aria-label="경로 범례">
        <span class="story-flow-key-item kai">카이</span>
        <span class="story-flow-key-item ur">우르 → 데미우르고스</span>
        <span class="story-flow-key-item heroine">엘로이 히로인</span>
        <span class="story-flow-key-item jump">시간 이동</span>
        <span class="story-flow-key-item join">교차 인과</span>
      </div>
      <div class="story-flow-scroll" tabindex="0" role="region" aria-label="시간선 다이어그램. 화면이 좁으면 좌우로 스크롤하여 탐색">
        <svg xmlns="http://www.w3.org/2000/svg" class="story-flow-svg" viewBox="0 0 1910 835" role="img"
          aria-label="세계시간은 왼쪽에서 오른쪽. 카이는 현대에서 미래를 거쳐 3부 과거로, 엘로이 히로인은 미래에서 현대 과거로 이동한다. 우르는 3부 과거에서 시간 신위를 계승해 신수전쟁과 낙원 건설을 거친다. 굵은 연결선은 카이와 우르의 만남, 전투와 계승을 나타낸다.">
          <defs>
            ${lanes.map(lane => `<marker id="story-flow-arrow-${lane.id}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" viewBox="0 0 8 8"><path d="M0 0L8 4L0 8Z" class="story-flow-marker-${lane.id}"/></marker>`).join('')}
            <marker id="story-flow-arrow-join" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" viewBox="0 0 8 8"><path d="M0 0L8 4L0 8Z" class="story-flow-marker-join"/></marker>
          </defs>
          ${regions.map((r,i) => `<g class="story-flow-era"><rect x="${r.from}" y="58" width="${r.to-r.from}" height="678" class="${i%2 ? 'alternate' : ''}" rx="7"/><text x="${(r.from+r.to)/2}" y="86">${text(r.label)}</text><text class="story-flow-era-sub" x="${(r.from+r.to)/2}" y="106">${text(r.sub)}</text></g>`).join('')}
          ${lanes.map(lane => `<g class="story-flow-axis story-flow-axis--${lane.id}"><line x1="60" y1="${axisY[lane.id]}" x2="1870" y2="${axisY[lane.id]}"/><text x="72" y="${axisY[lane.id]-57}">${text(lane.label)}</text><text class="story-flow-lane-sub" x="72" y="${axisY[lane.id]-39}">${text(lane.subtitle)}</text></g>`).join('')}
          ${edges.map(edge => `<g class="story-flow-edge story-flow-edge--${text(edge.lane || 'join')} story-flow-edge--${text(edge.kind || 'normal')}">
            <path d="${text(routePath(edge,nodes))}" marker-end="url(#story-flow-arrow-${text(edge.lane || 'join')})"/>
            ${edge.label ? `<text x="${coord(edge.labelX)}" y="${coord(edge.labelY)}">${text(edge.label)}</text>` : ''}
          </g>`).join('')}
          ${model.nodes.map(svgNode).join('')}
          <text class="story-flow-axis-note" x="1848" y="32">세계시간 →</text>
          <text class="story-flow-axis-note" x="106" y="814">점선: 시간 이동·발신 시점 미정 / 가는 연결선: 인물 간 인과</text>
        </svg>
      </div>
      <p class="story-flow-disclaimer">카이·우르·히로인의 개인 경험은 화살표 방향을 따라가세요. 세계시간의 거리와 각 사건 간 간격은 축척이 아닙니다. 우르를 옮긴 미래 데미우르고스의 <strong>정확한 발신 세계시점은 미정</strong>이며, 연대표의 '토벌'은 3부 주인공의 구원 의도를 뜻하지 않습니다.</p>
    </div>`;
}
