// Persistencia en localStorage. Todo va bajo un prefijo para exportar/borrar fácil.
const PREFIX = 'ccaf:';
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export const store = {
  get(key, fallback = null) {
    return safe(() => { const v = localStorage.getItem(PREFIX + key); return v == null ? fallback : JSON.parse(v); }, fallback);
  },
  set(key, value) { safe(() => localStorage.setItem(PREFIX + key, JSON.stringify(value))); },
  remove(key) { safe(() => localStorage.removeItem(PREFIX + key)); },
  keys() { return safe(() => Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length)), []); },
};

// --- práctica: historial por pregunta ---
export function recordPractice(questionId, correct) {
  const p = store.get('practice', {});
  const e = p[questionId] || { seen: 0, correct: 0, last: null, lastCorrect: null };
  e.seen++; if (correct) e.correct++;
  e.last = Date.now(); e.lastCorrect = !!correct;
  p[questionId] = e; store.set('practice', p);
}
export function practiceStats() { return store.get('practice', {}); }
export function failedIds() {
  return Object.entries(practiceStats()).filter(([, e]) => e.lastCorrect === false).map(([id]) => id);
}

// --- examen: intento en curso + historial ---
export function saveAttempt(attempt) { store.set('attempt', attempt); }
export function loadAttempt() { return store.get('attempt'); }
export function clearAttempt() { store.remove('attempt'); }

export function pushHistory(result) {
  const h = store.get('history', []);
  h.unshift(result); store.set('history', h.slice(0, 50));
}
export function history() { return store.get('history', []); }

export function exportAll() {
  const out = {};
  for (const k of store.keys()) out[k] = store.get(k);
  return { exportedAt: new Date().toISOString(), version: 1, data: out };
}
export function importAll(payload) {
  if (!payload || !payload.data) throw new Error('Formato inválido');
  for (const [k, v] of Object.entries(payload.data)) store.set(k, v);
}
export function resetAll() { for (const k of store.keys()) store.remove(k); }

// --- preferencias ---
export function getPref(key, fallback) { return store.get('pref:' + key, fallback); }
export function setPref(key, value) { store.set('pref:' + key, value); }
