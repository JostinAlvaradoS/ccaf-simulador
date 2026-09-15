import { h } from './common.js';
import { history, practiceStats, failedIds, loadAttempt } from '../engine/progress.js';

export function renderHome({ bank }) {
  const stats = practiceStats();
  const seen = Object.keys(stats).length;
  const attempts = history();
  const pending = loadAttempt();
  const ex = bank.meta.exam;

  return h('div', { class: 'stack' },
    h('section', { class: 'hero' },
      h('h1', {}, 'Simulador CCAR-F'),
      h('p', { class: 'muted' }, 'Claude Certified Architect – Foundations. Practica por dominio con retroalimentación inmediata o rinde un simulacro con el formato del examen real: ',
        `${ex.items} preguntas, ${ex.minutos} minutos, ${ex.escenariosPorExamen} de ${bank.scenarios.length} escenarios, aprobación con ${ex.corte} en escala ${ex.escalaMin}–${ex.escalaMax}.`),
      h('div', { class: 'row', style: 'margin-top:1rem' },
        h('a', { class: 'btn btn-primary', href: '#/practica' }, 'Modo práctica'),
        h('a', { class: 'btn', style: 'background:#fff', href: '#/examen' }, pending ? 'Continuar examen en curso' : 'Modo examen'),
      )),
    h('div', { class: 'grid grid-3' },
      h('div', { class: 'card' }, h('div', { class: 'kpi' }, bank.meta.activeQuestions), h('div', { class: 'muted' }, 'preguntas activas en el banco')),
      h('div', { class: 'card' }, h('div', { class: 'kpi' }, `${seen} / ${bank.meta.activeQuestions}`), h('div', { class: 'muted' }, 'preguntas vistas en práctica'),
        failedIds().length ? h('a', { class: 'small', href: '#/practica?failed=1' }, `${failedIds().length} pendientes de repasar`) : null),
      h('div', { class: 'card' }, h('div', { class: 'kpi' }, attempts.length), h('div', { class: 'muted' }, 'simulacros completados'),
        attempts[0] ? h('a', { class: 'small', href: '#/historial' }, `último: ${attempts[0].scaled} puntos`) : null),
    ),
    h('div', { class: 'grid grid-2' },
      h('div', { class: 'card' },
        h('h2', {}, 'Cómo está armado el examen'),
        h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Dominio'), h('th', {}, 'Peso'), h('th', {}, 'Ítems'), h('th', {}, 'Banco'))),
          h('tbody', {}, bank.domains.map((d) => h('tr', {},
            h('td', {}, `D${d.id} · ${d.name.es}`), h('td', {}, `${Math.round(d.weight * 100)} %`), h('td', {}, bank.meta.quota[d.id]), h('td', {}, bank.meta.byDomain[d.id] ?? 0))))),
        h('p', { class: 'muted small', style: 'margin-top:.6rem' }, 'Las preguntas transversales (modelos, seguridad, plataforma) solo aparecen en práctica.')),
      h('div', { class: 'card' },
        h('h2', {}, 'Los seis escenarios'),
        h('ul', { style: 'padding-left:1.1rem;margin:0' }, bank.scenarios.map((s) => h('li', {}, h('strong', {}, `${s.id} · ${s.title.es}`), ' ', h('span', { class: 'muted small' }, `(${bank.meta.byScenario[s.id] ?? 0} preguntas)`)))),
        h('p', { class: 'muted small', style: 'margin-top:.6rem' }, 'En el examen real las preguntas cuelgan de un escenario. El simulador elige 4 al azar y agrupa las preguntas bajo su contexto.')),
    ),
  );
}
