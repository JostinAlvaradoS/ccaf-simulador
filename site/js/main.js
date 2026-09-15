import { h } from './ui/common.js';
import { renderHome } from './ui/home.js';
import { renderPractice } from './ui/practice.js';
import { renderExam } from './ui/exam.js';
import { renderResults } from './ui/results.js';
import { renderHistory, renderProgress } from './ui/history.js';

const app = document.getElementById('app');
let bank = null;

async function loadBank() {
  const res = await fetch('data/bank.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar el banco (${res.status})`);
  bank = await res.json();
  bank.byId = Object.fromEntries(bank.questions.map((q) => [q.id, q]));
  return bank;
}

const routes = {
  '': renderHome, '/': renderHome,
  '/practica': renderPractice,
  '/examen': renderExam,
  '/resultados': renderResults,
  '/historial': renderHistory,
  '/progreso': renderProgress,
};

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, params: new URLSearchParams(qs || '') };
}

async function route() {
  const { path, params } = parseHash();
  window.__examMode = path === '/examen';
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + path));
  const view = routes[path] || (() => h('div', { class: 'card' }, h('h2', {}, 'Página no encontrada'), h('a', { href: '#/' }, 'Volver al inicio')));
  app.replaceChildren();
  try {
    const node = await view({ bank, params, navigate: (to) => { location.hash = to; } });
    app.replaceChildren(node);
    window.scrollTo({ top: 0 });
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('div', { class: 'card' }, h('h2', {}, 'Error'), h('pre', {}, String(e.stack || e))));
  }
}

window.addEventListener('hashchange', route);
loadBank().then(route).catch((e) => {
  app.replaceChildren(h('div', { class: 'card' }, h('h2', {}, 'No se pudo cargar el banco'), h('p', {}, String(e.message)),
    h('p', { class: 'muted' }, 'Si abriste el archivo directamente, sirve la carpeta site/ con un servidor local: ', h('code', {}, 'python3 -m http.server 8080 --directory site'))));
});
