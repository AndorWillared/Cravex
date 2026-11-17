import { todayKey, exportJSON, importJSON } from './store.js';
import { refresh, toast } from './ui.js';
import { openStats } from './stats.js';

const $ = (id) => document.getElementById(id);

$('hud').addEventListener('click', openStats);
$('export').addEventListener('click', exportJSON);
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !confirm('Import replaces all current data. Continue?')) return;
  try {
    const n = await importJSON(file);
    refresh();
    toast(`Imported ${n} days`);
  } catch (err) {
    toast(`Import failed: ${err.message}`);
  }
});

// Re-render when the day or phase changes while the app stays open.
let shown = '';
const stamp = () => `${todayKey()}|${new Date().getHours()}`;
const check = () => { if (stamp() !== shown) { shown = stamp(); refresh(); } };
document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
setInterval(check, 60000);
check();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
