export const CHART_PALETTE = [
  '#2a6f97', '#2e7d4f', '#e1b84b', '#b0443c', '#7a6bb5',
  '#3d8b8b', '#c47a3a', '#5a7d9a', '#8b5a6b', '#4a6b4a'
];

export function sumBy(records, group) {
  return records.reduce((map, record) => {
    const key = group(record);
    map[key] = (map[key] || 0) + Number(record.amount || 0);
    return map;
  }, {});
}

export function sortedTotals(totals, limit = 8) {
  return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthKey(key, delta) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return monthKey(date);
}

export function formatMonthLabel(key) {
  const [year, month] = String(key).split('-').map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' })
    .format(new Date(year, month - 1, 1));
}

export function smoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const cx = (current.x + next.x) / 2;
    path += ` C ${cx} ${current.y}, ${cx} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

export function donutArc(cx, cy, radius, startAngle, endAngle) {
  const polar = (angle) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };
  const start = polar(startAngle);
  const end = polar(endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
}
