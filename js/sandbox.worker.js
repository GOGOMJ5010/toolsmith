/*
 * Toolsmith sandbox worker.
 *
 * One worker is spawned per call and terminated afterwards, so forged code
 * never keeps state between invocations. Before any forged source is compiled
 * we remove the globals that could reach the network or persistent storage.
 *
 * This is defence in depth, not a security boundary: a Web Worker shares the
 * origin. It exists so that a tool the agent wrote thirty seconds ago cannot
 * quietly exfiltrate the workbench while the human is still reading the diff.
 */

const DENY = [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts',
  'indexedDB', 'caches', 'BroadcastChannel', 'Notification', 'SharedWorker',
  'Worker', 'navigator', 'localStorage', 'sessionStorage', 'open'
];

for (const key of DENY) {
  try {
    Object.defineProperty(self, key, {
      value: undefined, writable: false, configurable: false, enumerable: false
    });
  } catch (_) { /* some globals are non-configurable; the try is the point */ }
}

/* A deliberately small, pure standard library. Forged tools get no I/O, so
   anything they need has to arrive as `input`, `data`, or one of these. */
const helpers = {
  today: () => new Date().toISOString().slice(0, 10),
  parseDate: (v) => { const d = new Date(v); return isNaN(d) ? null : d; },
  daysUntil: (v) => {
    const d = new Date(v); if (isNaN(d)) return null;
    const t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  },
  num: (v) => {
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? null : n;
  },
  sum: (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0),
  groupBy: (rows, key) => rows.reduce((acc, r) => {
    const k = String(r[key]); (acc[k] = acc[k] || []).push(r); return acc;
  }, {}),
  sortBy: (rows, key, dir = 'asc') => [...rows].sort((a, b) => {
    const x = a[key], y = b[key];
    return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'desc' ? -1 : 1);
  })
};

function jsonSafe(value) {
  try { return JSON.parse(JSON.stringify(value === undefined ? null : value)); }
  catch (_) { return String(value); }
}

self.onmessage = async (event) => {
  const { code, input, data } = event.data || {};
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('input', 'data', 'helpers', '"use strict";\n' + code);
    const result = await fn(
      input == null ? {} : input,
      Array.isArray(data) ? data : [],
      helpers
    );
    self.postMessage({ ok: true, value: jsonSafe(result) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message ? err.message : err) });
  }
};
