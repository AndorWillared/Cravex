import { METRICS, METRIC_BY_ID } from './config.js';
import { state, todayKey } from './store.js';
import { fromKey } from './dates.js';
import { metricValue, isGreat, streaks, greatRatio, monthlyGreat, cumulative, scoreColor } from './score.js';
import { openLayer, dateLabel } from './ui.js';

const $ = (id) => document.getElementById(id);
const GREAT_COLOR = scoreColor(1);
const BAD_COLOR = scoreColor(-1);

const pctCell = (r, label) => `<span class="kpi"><b>${r.pct === null ? '–' : r.pct + '%'}</b><small>${label} · ${r.great}/${r.total}</small></span>`;

function monthBars(rows) {
  const data = rows.slice(-12);
  const W = 320, H = 120, top = 14, bottom = 16, gap = 4;
  const bw = (W - gap * (data.length - 1)) / data.length;
  const h = H - top - bottom;
  const bars = data.map((r, i) => {
    const x = i * (bw + gap);
    const ratio = r.total ? r.great / r.total : 0;
    const gh = ratio * h;
    const name = fromKey(`${r.month}-01`).toLocaleDateString('en-GB', { month: 'short' });
    return `<rect x="${x}" y="${top}" width="${bw}" height="${h}" rx="3" fill="var(--panel-2)"/>
      <rect x="${x}" y="${top + h - gh}" width="${bw}" height="${gh}" rx="3" fill="${GREAT_COLOR}"/>
      <text x="${x + bw / 2}" y="${top - 4}" text-anchor="middle">${r.great}</text>
      <text x="${x + bw / 2}" y="${H - 3}" text-anchor="middle">${name}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Great days per month">${bars}</svg>`;
}

function lineChart(keys, series, lines) {
  const W = 320, H = 180, left = 26, right = 4, top = 6, bottom = 18;
  const n = keys.length;
  const max = Math.max(1, ...lines.flatMap((l) => series[l.id]));
  const x = (i) => left + (n === 1 ? (W - left - right) / 2 : (i / (n - 1)) * (W - left - right));
  const y = (v) => top + (1 - v / max) * (H - top - bottom);
  const paths = lines.map((l) => {
    const pts = series[l.id].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${l.color}" stroke-width="${l.width || 1.6}"
      ${l.dash ? 'stroke-dasharray="4 3"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  const fmt = (k) => fromKey(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative days">
    <line x1="${left}" y1="${y(0)}" x2="${W - right}" y2="${y(0)}" stroke="var(--line)"/>
    <line x1="${left}" y1="${y(max)}" x2="${W - right}" y2="${y(max)}" stroke="var(--line)" stroke-dasharray="2 3"/>
    <text x="${left - 4}" y="${y(max) + 3}" text-anchor="end">${max}</text>
    <text x="${left - 4}" y="${y(0) + 3}" text-anchor="end">0</text>
    ${paths}
    <text x="${left}" y="${H - 3}">${fmt(keys[0])}</text>
    <text x="${W - right}" y="${H - 3}" text-anchor="end">${fmt(keys[n - 1])}</text>
  </svg>`;
}

function render() {
  const el = $('stats-body');
  const today = todayKey(), ids = state.prefs.filter, days = state.days;
  if (!Object.keys(days).length) {
    el.innerHTML = '<p class="empty-note">No entries yet. Log a phase on the main screen and your stats will show up here.</p>';
    return;
  }
  const great = (d) => isGreat(d, ids);
  const month = greatRatio(days, ids, `${today.slice(0, 7)}-01`, today);
  const year = greatRatio(days, ids, `${today.slice(0, 4)}-01-01`, today);
  const all = greatRatio(days, ids, '0000-00-00', today);
  const gs = streaks(days, today, great);

  const streakRows = [
    `<tr><td><span class="dot" style="--c:${GREAT_COLOR}"></span>Great day</td><td>${gs.current}</td><td>${gs.longest}</td></tr>`,
    ...ids.map((id) => {
      const m = METRIC_BY_ID[id];
      const s = streaks(days, today, (d) => (metricValue(d, id) ?? 0) > 0);
      return `<tr><td><span class="dot" style="--c:${m.color}"></span>${m.label} ${m.options[2]}</td><td>${s.current}</td><td>${s.longest}</td></tr>`;
    }),
  ].join('');

  const { keys, series } = cumulative(days, ids, today);
  const lines = [
    { id: 'great', label: 'Great days', color: GREAT_COLOR, width: 3 },
    { id: 'bad', label: 'Bad days', color: BAD_COLOR, width: 2, dash: true },
    ...ids.map((id) => ({ id, label: `${METRIC_BY_ID[id].label} +`, color: METRIC_BY_ID[id].color })),
  ];
  const legend = lines.map((l) => `<span><span class="dot" style="--c:${l.color}"></span>${l.label}</span>`).join('');
  const basis = ids.length === METRICS.length ? 'all metrics' : ids.map((id) => METRIC_BY_ID[id].label).join(', ');

  el.innerHTML = `
    <p class="basis">Based on ${basis} · great day = average ≥ +0.5 and nothing red · tracking since ${dateLabel(keys[0])}</p>
    <div class="card"><h3>Great days</h3><div class="kpis">
      ${pctCell(month, 'month')}${pctCell(year, 'year')}${pctCell(all, 'total')}
    </div></div>
    <div class="card"><h3>Streaks (days in a row)</h3>
      <table class="streaks"><thead><tr><th></th><th>Current</th><th>Longest</th></tr></thead><tbody>${streakRows}</tbody></table>
    </div>
    <div class="card"><h3>Great days per month</h3>${monthBars(monthlyGreat(days, ids, today))}</div>
    <div class="card"><h3>Cumulative days</h3>${lineChart(keys, series, lines)}<div class="legend">${legend}</div></div>`;
}

export function openStats() {
  render();
  $('stats').scrollTop = 0;
  openLayer($('stats'), render);
}
