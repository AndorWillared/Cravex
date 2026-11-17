// Central configuration. Options are always ordered bad -> neutral -> good
// and map to scores -1, 0, +1.

export const STORAGE_KEY = 'spectrack.v1';
export const CUTOFF_HOUR = 4; // the day rolls over at 04:00
export const GREAT_THRESHOLD = 0.5;
export const GRID_WEEKS = 16;
export const SCORES = [-1, 0, 1];

// `from` is the start hour; a phase lasts until the next phase starts.
export const PHASES = [
  { id: 'morning', label: 'Morning', from: 4 },
  { id: 'midday', label: 'Midday', from: 11 },
  { id: 'afternoon', label: 'Afternoon', from: 14 },
  { id: 'evening', label: 'Evening', from: 18 },
];

// scope 'phase': loggable per phase AND as a day override.
// scope 'day': loggable only in the Day modal.
// color: only used to tell metrics apart (filter chips, stats chart).
export const METRICS = [
  { id: 'mood', label: 'Mood', scope: 'phase', color: '#f472b6', options: ['down', 'mixed', 'bright'] },
  { id: 'focus', label: 'Focus', scope: 'phase', color: '#60a5fa', options: ['scattered', 'normal', 'sharp'] },
  { id: 'energy', label: 'Energy', scope: 'phase', color: '#facc15', options: ['drained', 'ok', 'charged'] },
  { id: 'sport', label: 'Sport', scope: 'day', color: '#fb923c', options: ['couch', 'some moving', 'active'] },
  { id: 'food', label: 'Food', scope: 'day', color: '#a3e635', options: ['cheat', 'mixed', 'healthy'] },
  { id: 'sleep', label: 'Sleep', scope: 'day', color: '#a78bfa', options: ['bad', 'ok', 'good'] },
];

export const PHASE_METRICS = METRICS.filter((m) => m.scope === 'phase');
export const DAY_METRICS = METRICS.filter((m) => m.scope === 'day');
export const METRIC_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m]));
