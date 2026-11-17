// Pure date helpers on local 'YYYY-MM-DD' keys.
const pad2 = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); };
// Monday = 0 … Sunday = 6
export const weekday = (k) => (fromKey(k).getDay() + 6) % 7;

export function* range(fromK, toK) {
  for (let k = fromK; k <= toK; k = addDays(k, 1)) yield k;
}
