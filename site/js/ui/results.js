import { h, questionCard, fmtTime, fmtDate, pct, scenarioBox } from './common.js';
import { history } from '../engine/progress.js';
import { trafficLight } from '../engine/scorer.js';

export function renderResults({ bank, params }) {
  const id = params.get('id');
  const rec = history().find((r) => r.id === id) || history()[0];
  if (!rec) return h('div', { class: 'card' }, h('h2', {}, 'Sin resultados'), h('a', { href: '#/examen' }, 'Rendir un simulacro'));
  let lang = rec.lang || 'en';
  const root = h('div', { class: 'stack' });
  draw();
  return root;

  function draw() {
    const ex = bank.meta.exam;
    root.replaceChildren(
      h('div', { class: 'card score-hero' },
        h('div', {}, h('div', { class: 'score-big ' + (rec.passed ? 'pass' : 'fail') }, rec.scaled), h('div', { class: 'muted small' }, `escala ${ex.escalaMin}–${ex.escalaMax} · corte ${ex.corte}`)),
        h('div', {},
          h('h1', {}, rec.passed ? 'Aprobado' : 'No aprobado'),
          h('p', {}, `${rec.correctCount} de ${rec.total} correctas (${rec.percent} %) · ${fmtTime(rec.durationSec)} usados de ${fmtTime(ex.minutos * 60)}${rec.timedOut ? ' · tiempo agotado' : ''}`),
          h('p', { class: 'muted small' }, `Formulario ${rec.seed} · ${fmtDate(rec.finishedAt)} · Escenarios: ${rec.form.scenarios.join(', ')}`),
          rec.form.fallbacks?.length ? h('p', { class: 'muted small' }, `${rec.form.fallbacks.length} preguntas se tomaron de escenarios no elegidos para completar la cuota por dominio.`) : null,
          h('div', { class: 'row' },
            h('button', { class: 'btn-sm', onClick: () => { lang = lang === 'en' ? 'es' : 'en'; draw(); } }, lang === 'en' ? 'Ver revisión en español' : 'See review in English'),
            h('a', { class: 'btn btn-sm', href: '#/examen' }, 'Nuevo simulacro'),
            h('a', { class: 'btn btn-sm btn-ghost', href: '#/historial' }, 'Historial')))),
      h('div', { class: 'grid grid-2' },
        h('div', { class: 'card' }, h('h2', {}, 'Por dominio'), h('p', { class: 'muted small' }, 'El informe real de Pearson VUE muestra exactamente esto: porcentaje de aciertos por dominio.'),
          table(bank.domains.map((d) => [`D${d.id} · ${d.name.es}`, rec.perDomain[d.id]]))),
        h('div', { class: 'card' }, h('h2', {}, 'Por escenario'),
          table(rec.form.scenarios.map((s) => [`${s} · ${bank.scenarios.find((x) => x.id === s)?.title.es}`, rec.perScenario[s]])))),
      h('div', { class: 'card' }, h('h2', {}, 'Por task statement'),
        h('p', { class: 'muted small' }, 'Verde ≥ 80 %, ámbar ≥ 60 %, rojo debajo. Los statements en rojo son tu plan de repaso.'),
        h('table', {}, h('tbody', {}, Object.entries(rec.perStatement).sort().map(([st, v]) => h('tr', {},
          h('td', {}, h('span', { class: 'dot ' + trafficLight(v) }), h('strong', {}, st)), h('td', {}, bank.statements[st] || ''), h('td', { style: 'white-space:nowrap' }, `${v.correct}/${v.total}`),
          h('td', { style: 'width:30%' }, h('div', { class: 'bar ' + trafficLight(v) }, h('span', { style: `width:${pct(v.correct, v.total)}%` })))))))),
      h('div', { class: 'card' }, h('h2', {}, 'Revisión pregunta por pregunta'),
        h('p', { class: 'muted small' }, 'Abrí cada una para ver tu respuesta, la correcta y por qué cada distractor está mal.'),
        h('div', { class: 'row', style: 'margin-bottom:.6rem' },
          h('button', { class: 'btn-sm', onClick: () => root.querySelectorAll('details.review.ko').forEach((d) => { d.open = true; }) }, 'Abrir solo las incorrectas'),
          h('button', { class: 'btn-sm', onClick: () => root.querySelectorAll('details.review').forEach((d) => { d.open = false; }) }, 'Cerrar todas')),
        h('div', { class: 'stack' }, rec.form.sections.map((sec) => h('div', { class: 'stack' },
          scenarioBox(bank, sec.scenario, lang, false),
          sec.questionIds.map((qid) => {
            const q = bank.byId[qid]; const d = rec.details.find((x) => x.id === qid);
            const idx = rec.form.questionIds.indexOf(qid) + 1;
            return h('details', { class: 'review ' + (d.correct ? 'ok' : 'ko') },
              h('summary', {}, h('span', { class: 'mark ' + (d.correct ? 'ok' : 'ko') }, d.correct ? '✔' : (d.answered ? '✘' : '—')), h('strong', {}, `#${idx}`), h('span', { class: 'badge badge-d' + q.domain }, `D${q.domain}`), h('span', { class: 'muted small' }, q.text[lang].stem.slice(0, 110) + (q.text[lang].stem.length > 110 ? '…' : ''))),
              h('div', { class: 'body' }, questionCard(bank, q, { lang, optionOrder: rec.form.optionOrder[qid], answer: rec.answers[qid], mode: 'reveal' })));
          }))))),
    );
  }

  function table(rows) {
    return h('table', {}, h('tbody', {}, rows.map(([label, v]) => { v = v || { correct: 0, total: 0 }; return h('tr', {}, h('td', {}, label), h('td', { style: 'white-space:nowrap' }, `${v.correct}/${v.total}`), h('td', { style: 'width:40%' }, h('div', { class: 'bar ' + trafficLight(v) }, h('span', { style: `width:${pct(v.correct, v.total)}%` }))), h('td', {}, `${pct(v.correct, v.total)} %`)); })));
  }
}
