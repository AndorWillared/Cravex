import { STORAGE_KEY, CUTOFF_HOUR, METRICS, PHASES } from './config.js';
import { toKey } from './dates.js';

const fresh = () => ({ v: 1, days: {}, prefs: { filter: METRICS.map((m) => m.id) } });

function normalize(raw) {
  const s = fresh();
  if (raw && typeof raw === 'object') {
    if (raw.days && typeof raw.days === 'object') s.days = raw.days;
    if (Array.isArray(raw.prefs?.filter)) s.prefs.filter = raw.prefs.filter.filter((id) => METRICS.some((m) => m.id === id));
  }
  return s;
}

export const state = (() => {
  try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return fresh(); }
})();

export const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
navigator.storage?.persist?.();

const override = new URLSearchParams(location.search).get('day'); // test: ?day=2026-11-10

export function todayKey() {
  if (override) return override;
  return toKey(new Date(Date.now() - CUTOFF_HOUR * 3600e3));
}

export function currentPhase() {
  const h = new Date().getHours();
  let cur = PHASES[PHASES.length - 1].id; // before the first phase starts it's still "evening"
  for (const p of PHASES) if (h >= p.from) cur = p.id;
  return cur;
}

// section: a phase id or 'day'
export function getSection(k, section) {
  const d = state.days[k];
  if (!d) return {};
  return (section === 'day' ? d.day : d.phases?.[section]) || {};
}

export function setValue(k, section, metric, score) {
  const d = (state.days[k] ||= {});
  const bucket = section === 'day' ? (d.day ||= {}) : ((d.phases ||= {})[section] ||= {});
  if (score === null) delete bucket[metric];
  else bucket[metric] = score;
  // prune empty containers so "nothing logged" stays detectable
  if (section !== 'day' && !Object.keys(bucket).length) delete d.phases[section];
  if (d.phases && !Object.keys(d.phases).length) delete d.phases;
  if (d.day && !Object.keys(d.day).length) delete d.day;
  if (!Object.keys(d).length) delete state.days[k];
  save();
}

export function setFilter(ids) { state.prefs.filter = ids; save(); }

export function exportJSON() {
  const blob = new Blob([JSON.stringify({ app: 'spectrack', exportedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `spectrack-${todayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importJSON(file) {
  const parsed = JSON.parse(await file.text());
  const src = parsed?.state ?? parsed;
  if (!src?.days || typeof src.days !== 'object') throw new Error('No day data found');
  const next = normalize(src);
  state.days = next.days;
  state.prefs = next.prefs;
  save();
  return Object.keys(state.days).length;
}
