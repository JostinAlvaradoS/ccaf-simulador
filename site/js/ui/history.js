import { h, fmtDate, fmtTime, pct, toast } from './common.js';
import { history, practiceStats, exportAll, importAll, resetAll, store } from '../engine/progress.js';
import { trafficLight } from '../engine/scorer.js';

export function renderHistory({ bank }) {
  const rows = history();
  const root = h('div', { class: 'stack' },
    h('div', { class: 'card' },
      h('div', { class: 'row spread' }, h('h1', {}, 'Historial de simulacros'), h('div', { class: 'row' },
        h('button', { class: 'btn-sm', onClick: doExport }, 'Exportar progreso (JSON)'),
        h('label', { class: 'btn btn-sm' }, 'Importar', h('input', { type: 'file', accept: 'application/json', style: 'display:none', onChange: doImport })),
        h('button', { class: 'btn-sm btn-danger', onClick: () => { if (confirm('¿Borrar todo el progreso guardado en este navegador?')) { resetAll(); location.reload(); } } }, 'Borrar todo'))),
      rows.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), h('th', {}, 'Formulario'), h('th', {}, 'Puntaje'), h('th', {}, 'Aciertos'), h('th', {}, 'Tiempo'), h('th', {}, 'D1'), h('th', {}, 'D2'), h('th', {}, 'D3'), h('th', {}, 'D4'), h('th', {}, 'D5'), h('th', {}))),
        h('tbody', {}, rows.map((r) => h('tr', {},
          h('td', {}, fmtDate(r.finishedAt)), h('td', { class: 'mono' }, r.seed),
          h('td', {}, h('strong', { style: `color:${r.passed ? 'var(--green)' : 'var(--red)'}` }, r.scaled)),
          h('td', {}, `${r.correctCount}/${r.total}`), h('td', {}, fmtTime(r.durationSec)),
          ...[1, 2, 3, 4, 5].map((d) => h('td', {}, r.perDomain[d] ? `${pct(r.perDomain[d].correct, r.perDomain[d].total)} %` : '—')),
          h('td', {}, h('a', { href: `#/resultados?id=${r.id}` }, 'Ver'))))))
        : h('p', { class: 'muted' }, 'Todavía no rendiste ningún simulacro. ', h('a', { href: '#/examen' }, 'Empezar uno'))),
    h('p', { class: 'muted small' }, 'El progreso vive solo en este navegador. Exportalo si vas a cambiar de equipo o si el instructor te lo pide antes del simulacro presencial.'),
  );
  return root;

  function doExport() {
    const blob = new Blob([JSON.stringify(exportAll(), null, 1)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `ccaf-progreso-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
  }
  function doImport(e) {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((txt) => { importAll(JSON.parse(txt)); toast('Progreso importado'); location.reload(); }).catch(() => toast('Archivo inválido'));
  }
}

export function renderProgress({ bank }) {
  // Combina práctica (última respuesta por pregunta) + todos los simulacros, por statement.
  const agg = {};
  const bump = (st, ok) => { if (!st) return; agg[st] = agg[st] || { correct: 0, total: 0 }; agg[st].total++; if (ok) agg[st].correct++; };
  const ps = practiceStats();
  for (const [qid, e] of Object.entries(ps)) { const q = bank.byId[qid]; if (q) bump(q.statement, e.lastCorrect); }
  for (const r of history()) for (const d of r.details) { const q = bank.byId[d.id]; if (q) bump(q.statement, d.correct); }

  const byDomain = {};
  for (const q of bank.questions) if (q.statement) (byDomain[q.domain] = byDomain[q.domain] || new Set()).add(q.statement);
  const weakest = Object.entries(agg).filter(([, v]) => v.total >= 2).sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total)).slice(0, 3);

  return h('div', { class: 'stack' },
    h('div', { class: 'card' },
      h('h1', {}, 'Semáforo por task statement'),
      h('p', { class: 'muted' }, 'Combina tus respuestas de práctica (la última por pregunta) y todos tus simulacros. Los 30 statements son el temario oficial: en el examen cada pregunta se escribe contra uno de ellos.'),
      weakest.length ? h('div', { class: 'notice' }, h('strong', {}, 'Tus 3 statements más débiles: '), weakest.map(([st]) => `${st} (${bank.statements[st]})`).join(' · ')) : null),
    ...bank.domains.map((d) => h('div', { class: 'card' },
      h('h2', {}, `D${d.id} · ${d.name.es} `, h('span', { class: 'muted small' }, `${Math.round(d.weight * 100)} % del examen`)),
      h('table', {}, h('tbody', {}, [...(byDomain[d.id] || [])].sort().map((st) => {
        const v = agg[st]; const n = bank.questions.filter((q) => q.statement === st).length;
        return h('tr', {},
          h('td', { style: 'white-space:nowrap' }, h('span', { class: 'dot ' + trafficLight(v) }), h('strong', {}, st)),
          h('td', {}, bank.statements[st]),
          h('td', { style: 'white-space:nowrap' }, v ? `${v.correct}/${v.total}` : h('span', { class: 'muted' }, 'sin datos')),
          h('td', { style: 'width:25%' }, h('div', { class: 'bar ' + trafficLight(v) }, h('span', { style: `width:${v ? pct(v.correct, v.total) : 0}%` }))),
          h('td', {}, h('a', { class: 'small', href: `#/practica`, title: `${n} preguntas en el banco` }, 'practicar')));
      }))))),
  );
}
