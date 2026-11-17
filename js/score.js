// Pure scoring functions. A "day" is the stored object
// { phases?: { [phaseId]: { [metricId]: score } }, day?: { [metricId]: score } }.
import { METRICS, METRIC_BY_ID, PHASES, GREAT_THRESHOLD } from './config.js';
import { addDays, range } from './dates.js';

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function phaseAverage(day, metricId) {
  if (!day?.phases) return null;
  return avg(PHASES.map((p) => day.phases[p.id]?.[metricId]).filter((v) => v !== undefined));
}

// Day value overrides; otherwise the average of the phases that were logged.
export function metricValue(day, metricId) {
  const direct = day?.day?.[metricId];
  if (direct !== undefined) return direct;
  return METRIC_BY_ID[metricId]?.scope === 'phase' ? phaseAverage(day, metricId) : null;
}

export function metricValues(day, ids) {
  const out = {};
  for (const id of ids) {
    const v = metricValue(day, id);
    if (v !== null) out[id] = v;
  }
  return out;
}

export const dayScore = (day, ids) => avg(Object.values(metricValues(day, ids)));

export function isGreat(day, ids) {
  const vals = Object.values(metricValues(day, ids));
  return vals.length > 0 && avg(vals) >= GREAT_THRESHOLD && vals.every((v) => v >= 0);
}

export const sectionScore = (section) => avg(Object.values(section || {}));

// -1 -> red (hue 0), 0 -> yellow (~48), +1 -> green (~140). null -> empty.
export function scoreColor(score) {
  if (score === null || score === undefined) return 'var(--empty)';
  const t = (Math.max(-1, Math.min(1, score)) + 1) / 2;
  const hue = t < 0.5 ? t * 2 * 48 : 48 + (t - 0.5) * 2 * 92;
  return `hsl(${hue.toFixed(0)} 70% ${t < 0.5 ? 52 : 45}%)`;
}

export const firstKey = (days) => Object.keys(days).sort()[0] ?? null;

// Streak of days matching `pred`. Today counts if it already matches,
// but an unfinished today never breaks the current streak.
export function streaks(days, today, pred) {
  const first = firstKey(days);
  if (!first) return { current: 0, longest: 0 };
  let longest = 0, run = 0;
  for (const k of range(first, today)) {
    run = pred(days[k]) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  let k = pred(days[today]) ? today : addDays(today, -1);
  while (k >= first && pred(days[k])) { current++; k = addDays(k, -1); }
  return { current, longest };
}

// Great-day ratio within [from, today]. Today only counts once something is logged.
export function greatRatio(days, ids, from, today) {
  const first = firstKey(days);
  if (!first) return { great: 0, total: 0, pct: null };
  const start = from > first ? from : first;
  let great = 0, total = 0;
  for (const k of range(start, today)) {
    if (k === today && !days[k]) continue;
    total++;
    if (isGreat(days[k], ids)) great++;
  }
  return { great, total, pct: total ? Math.round((great / total) * 100) : null };
}

export function monthlyGreat(days, ids, today) {
  const first = firstKey(days);
  if (!first) return [];
  const out = new Map();
  for (const k of range(first, today)) {
    const m = k.slice(0, 7);
    if (!out.has(m)) out.set(m, { month: m, great: 0, total: 0 });
    if (k === today && !days[k]) continue;
    const row = out.get(m);
    row.total++;
    if (isGreat(days[k], ids)) row.great++;
  }
  return [...out.values()];
}

// Cumulative counts per day: good days per metric, great days, bad days.
export function cumulative(days, ids, today) {
  const first = firstKey(days);
  if (!first) return { keys: [], series: {} };
  const keys = [...range(first, today)];
  const series = { great: [], bad: [] };
  for (const id of ids) series[id] = [];
  const acc = Object.fromEntries(Object.keys(series).map((s) => [s, 0]));
  for (const k of keys) {
    const d = days[k];
    for (const id of ids) {
      const v = metricValue(d, id);
      if (v !== null && v > 0) acc[id]++;
    }
    if (isGreat(d, ids)) acc.great++;
    const s = dayScore(d, ids);
    if (s !== null && s < 0) acc.bad++;
    for (const s2 of Object.keys(series)) series[s2].push(acc[s2]);
  }
  return { keys, series };
}

export const allMetricIds = () => METRICS.map((m) => m.id);
