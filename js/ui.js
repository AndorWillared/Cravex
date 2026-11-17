import { PHASES, METRICS, PHASE_METRICS, DAY_METRICS, METRIC_BY_ID, SCORES, GRID_WEEKS } from './config.js';
import { state, todayKey, currentPhase, getSection, setValue, setFilter } from './store.js';
import { addDays, fromKey, weekday } from './dates.js';
import { metricValues, phaseAverage, dayScore, isGreat, sectionScore, scoreColor, streaks, greatRatio, firstKey } from './score.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const vib = (p) => { try { navigator.vibrate?.(p); } catch {} };
const filterIds = () => state.prefs.filter;
const optionLabel = (metricId, score) => METRIC_BY_ID[metricId].options[SCORES.indexOf(score)];
const sectionLabel = (s) => (s === 'day' ? 'Whole day' : PHASES.find((p) => p.id === s).label);
const fmtScore = (s) => (s > 0 ? '+' : '') + s.toFixed(1);

export function dateLabel(k, long = false) {
  const today = todayKey();
  if (k === today) return 'Today';
  if (k === addDays(today, -1)) return 'Yesterday';
  return fromKey(k).toLocaleDateString('en-GB', long
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ---------- Layers: overlays/pages integrated with the Android back button ---------- */
const stack = [];
export function openLayer(el, onRender) {
  el.hidden = false;
  stack.push({ el, onRender });
  history.pushState({ layer: stack.length }, '');
}
export const closeLayer = () => { if (stack.length) history.back(); };
addEventListener('popstate', () => {
  const top = stack.pop();
  if (top) { top.el.hidden = true; refresh(); }
});
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]') || e.target.classList.contains('overlay')) closeLayer();
});

export function refresh() {
  renderHud();
  renderFilters();
  renderGrid();
  renderPad();
  for (const l of stack) l.onRender?.();
}

/* ---------- Header ---------- */
function renderHud() {
  const today = todayKey(), ids = filterIds();
  const month = greatRatio(state.days, ids, `${today.slice(0, 7)}-01`, today);
  const total = greatRatio(state.days, ids, '0000-00-00', today);
  const { current } = streaks(state.days, today, (d) => isGreat(d, ids));
  $('k-month').textContent = month.pct === null ? '–' : `${month.pct}%`;
  $('k-month-label').textContent = `great in ${fromKey(today).toLocaleDateString('en-GB', { month: 'short' })}`;
  $('k-total').textContent = total.pct === null ? '–' : `${total.pct}%`;
  $('k-streak').textContent = current;
}

/* ---------- Filter chips ---------- */
function renderFilters() {
  const el = $('filters');
  if (!el.childElementCount) {
    for (const m of METRICS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.id = m.id; b.textContent = m.label;
      b.style.setProperty('--c', m.color);
      b.addEventListener('click', () => {
        const on = new Set(filterIds());
        if (on.has(m.id)) on.delete(m.id); else on.add(m.id);
        // keep at least one metric selected, otherwise the grid has nothing to show
        if (!on.size) return;
        setFilter(METRICS.map((x) => x.id).filter((id) => on.has(id)));
        refresh();
      });
      el.appendChild(b);
    }
  }
  const on = new Set(filterIds());
  for (const b of el.children) b.setAttribute('aria-pressed', on.has(b.dataset.id));
}

/* ---------- Day grid ---------- */
let gridScrolled = false;
function renderGrid() {
  const today = todayKey(), ids = filterIds();
  const first = firstKey(state.days) ?? today;
  const windowStart = addDays(today, -(GRID_WEEKS * 7 - 1));
  let start = first < windowStart ? first : windowStart;
  start = addDays(start, -weekday(start));
  const end = addDays(today, 6 - weekday(today));

  const frag = document.createDocumentFragment();
  for (let w = start; w <= end; w = addDays(w, 7)) {
    const label = document.createElement('span');
    label.className = 'month';
    for (let i = 0; i < 7; i++) {
      const k = addDays(w, i);
      if (k.endsWith('-01') || w === start) label.textContent = fromKey(k).toLocaleDateString('en-GB', { month: 'short' });
    }
    frag.appendChild(label);
    for (let i = 0; i < 7; i++) {
      const k = addDays(w, i);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell' + (k === today ? ' today' : '') + (k > today ? ' future' : '');
      cell.dataset.k = k;
      cell.setAttribute('aria-label', dateLabel(k, true));
      if (k <= today) {
        const s = dayScore(state.days[k], ids);
        if (s !== null) cell.style.setProperty('--c', scoreColor(s));
      }
      frag.appendChild(cell);
    }
  }
  const grid = $('grid');
  grid.replaceChildren(frag);
  fitRows();
  if (!gridScrolled) { $('grid-scroll').scrollTop = 1e9; gridScrolled = true; }
}
// Size rows so exactly GRID_WEEKS weeks fill the visible area; older weeks scroll.
function fitRows() {
  const h = $('grid-scroll').clientHeight - 6;
  const row = Math.max(16, Math.min(44, Math.floor((h - 4 * (GRID_WEEKS - 1)) / GRID_WEEKS)));
  $('grid').style.gridAutoRows = `${row}px`;
}
addEventListener('resize', () => { fitRows(); $('grid-scroll').scrollTop = 1e9; });
$('grid').addEventListener('click', (e) => {
  const k = e.target.closest('.cell')?.dataset.k;
  if (k) openDetail(k);
});

/* ---------- Input pad ---------- */
function slotHtml(label, metrics, section) {
  const dots = metrics.map((m) => {
    const v = section[m.id];
    return `<i style="--dc:${v === undefined ? 'transparent' : scoreColor(v)}"></i>`;
  }).join('');
  return `<span class="label">${label}</span><span class="dots">${dots}</span>`;
}
function renderPad() {
  const today = todayKey(), now = currentPhase(), el = $('pad');
  const slots = [...PHASES.map((p) => ({ id: p.id, label: p.label, metrics: PHASE_METRICS })),
    { id: 'day', label: 'Whole day', metrics: [...DAY_METRICS, ...PHASE_METRICS] }];
  el.replaceChildren(...slots.map((s) => {
    const sec = getSection(today, s.id);
    const score = sectionScore(sec);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot' + (s.id === 'day' ? ' wide' : '') + (s.id === now ? ' now' : '') + (score !== null ? ' filled' : '');
    if (score !== null) b.style.setProperty('--c', scoreColor(score));
    b.innerHTML = slotHtml(s.label, s.metrics, sec);
    b.addEventListener('click', () => openEditor(todayKey(), s.id));
    return b;
  }));
}

/* ---------- Editor modal ---------- */
let editing = null;
function optionRow(k, section, m, values, suggestion) {
  const cur = values[m.id];
  const btns = SCORES.map((s, i) => {
    const pressed = cur === s;
    const suggest = cur === undefined && suggestion === s;
    return `<button type="button" class="opt${suggest ? ' suggest' : ''}" style="--c:${scoreColor(s)}" aria-pressed="${pressed}"
      data-metric="${m.id}" data-score="${s}">${esc(m.options[i])}</button>`;
  }).join('');
  return `<div class="row"><span class="name">${esc(m.label)}</span>${btns}</div>`;
}
function renderEditor() {
  const { k, section } = editing;
  const values = getSection(k, section);
  $('editor-title').textContent = `${sectionLabel(section)} · ${dateLabel(k)}`;
  let html = '';
  if (section === 'day') {
    html += `<div class="section-title">Daily</div>`;
    html += DAY_METRICS.map((m) => optionRow(k, section, m, values)).join('');
    html += `<div class="section-title">Overall</div><p class="hint">Overrides the phase average. Dashed = what your phases say.</p>`;
    html += PHASE_METRICS.map((m) => {
      const avg = phaseAverage(state.days[k], m.id);
      return optionRow(k, section, m, values, avg === null ? undefined : Math.round(avg) + 0);
    }).join('');
  } else {
    html += PHASE_METRICS.map((m) => optionRow(k, section, m, values)).join('');
  }
  $('editor-body').innerHTML = html;
}
$('editor-body').addEventListener('click', (e) => {
  const b = e.target.closest('.opt');
  if (!b || !editing) return;
  const { k, section } = editing;
  const score = Number(b.dataset.score);
  const cur = getSection(k, section)[b.dataset.metric];
  setValue(k, section, b.dataset.metric, cur === score ? null : score);
  vib(10);
  refresh();
});
export function openEditor(k, section) {
  editing = { k, section };
  renderEditor();
  openLayer($('editor'), renderEditor);
}

/* ---------- Day detail ---------- */
let detailKey = null;
function renderDetail() {
  const k = detailKey, ids = filterIds(), day = state.days[k];
  $('detail-title').textContent = dateLabel(k, true);
  const s = dayScore(day, ids);
  const vals = metricValues(day, METRICS.map((m) => m.id));
  const result = METRICS.filter((m) => vals[m.id] !== undefined)
    .map((m) => `<span style="--c:${scoreColor(vals[m.id])}">${esc(m.label)} ${fmtScore(vals[m.id])}</span>`).join('');
  let html = `<div class="detail-score"><span class="swatch" style="--c:${scoreColor(s)}"></span><span>${
    s === null ? 'Nothing logged yet' : `Score ${fmtScore(s)}${isGreat(day, ids) ? ' · great day' : ''}`
  }${ids.length < METRICS.length && s !== null ? ' (filtered)' : ''}</span></div>`;
  if (result) html += `<div class="dsec" style="--c:${scoreColor(s)};pointer-events:none"><span class="sname">Result</span><span class="vals">${result}</span><span></span></div>`;
  html += `<div class="section-title">Entries</div>`;
  for (const sec of [...PHASES.map((p) => p.id), 'day']) {
    const v = getSection(k, sec);
    const entries = METRICS.filter((m) => v[m.id] !== undefined)
      .map((m) => `<span style="--c:${scoreColor(v[m.id])}">${esc(m.label)}: ${esc(optionLabel(m.id, v[m.id]))}</span>`).join('');
    html += `<button type="button" class="dsec" data-sec="${sec}" style="--c:${scoreColor(sectionScore(v))}">
      <span class="sname">${sectionLabel(sec)}</span><span class="vals">${entries || '<em>not logged</em>'}</span><span class="edit">›</span></button>`;
  }
  $('detail-body').innerHTML = html;
}
$('detail-body').addEventListener('click', (e) => {
  const sec = e.target.closest('.dsec[data-sec]')?.dataset.sec;
  if (sec) openEditor(detailKey, sec);
});
export function openDetail(k) {
  detailKey = k;
  renderDetail();
  openLayer($('detail'), renderDetail);
}

/* ---------- Toast ---------- */
let toastTimer;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
