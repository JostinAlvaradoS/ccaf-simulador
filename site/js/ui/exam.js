import { h, questionCard, scenarioBox, fmtTime, toast } from './common.js';
import { buildExam } from '../engine/selector.js';
import { gradeExam } from '../engine/scorer.js';
import { saveAttempt, loadAttempt, clearAttempt, pushHistory, getPref, setPref } from '../engine/progress.js';
import { randomSeed } from '../engine/rng.js';

const PRESETS = ['FORM-A', 'FORM-B', 'FORM-C'];

export function renderExam({ bank, navigate }) {
  const root = h('div', { class: 'stack' });
  const pending = loadAttempt();
  if (pending && !pending.submitted) renderResume(pending); else renderSetup();
  return root;

  function renderResume(att) {
    const left = Math.max(0, Math.round((att.endsAt - Date.now()) / 1000));
    root.replaceChildren(h('div', { class: 'card' },
      h('h1', {}, 'Tenés un examen en curso'),
      h('p', {}, `Formulario ${att.form.seed} · ${Object.keys(att.answers).length} de ${att.form.questionIds.length} respondidas · ${left > 0 ? fmtTime(left) + ' restantes' : 'tiempo agotado'}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn-primary', onClick: () => runExam(att) }, left > 0 ? 'Continuar' : 'Ver resultado'),
        h('button', { class: 'btn-danger', onClick: () => { if (confirm('¿Descartar este intento? No quedará en el historial.')) { clearAttempt(); renderSetup(); } } }, 'Descartar'))));
  }

  function renderSetup() {
    const ex = bank.meta.exam;
    let seed = PRESETS[0]; let lang = 'en';
    const seedInput = h('input', { type: 'text', value: seed, style: 'width:11rem', onInput: (e) => { seed = e.target.value.trim().toUpperCase(); } });
    root.replaceChildren(h('div', { class: 'card' },
      h('h1', {}, 'Modo examen'),
      h('p', { class: 'muted' }, `Simulacro con el formato real: ${ex.items} preguntas agrupadas en ${ex.escenariosPorExamen} escenarios, ${ex.minutos} minutos, sin retroalimentación hasta entregar. Podés marcar preguntas para revisar y navegar libremente. El intento se guarda en este navegador si cerrás la pestaña.`),
      h('div', { class: 'grid grid-2', style: 'margin-top:1rem' },
        h('fieldset', {}, h('legend', {}, 'Formulario'),
          h('p', { class: 'small muted', style: 'margin:0 0 .5rem' }, 'La misma semilla genera exactamente el mismo examen. Usá FORM-A, B o C para que toda la cohorte rinda el mismo, o una semilla propia.'),
          h('div', { class: 'row' }, ...PRESETS.map((p) => h('button', { class: 'btn-sm', onClick: () => { seed = p; seedInput.value = p; } }, p)),
            h('button', { class: 'btn-sm', onClick: () => { seed = randomSeed(); seedInput.value = seed; } }, 'Aleatoria')),
          h('div', { class: 'row', style: 'margin-top:.5rem' }, h('label', {}, 'Semilla: '), seedInput)),
        h('fieldset', {}, h('legend', {}, 'Idioma'),
          h('label', { class: 'check' }, h('input', { type: 'radio', name: 'lang', value: 'en', checked: true, onChange: () => { lang = 'en'; } }), 'Inglés (recomendado: el examen real es en inglés)'),
          h('label', { class: 'check' }, h('input', { type: 'radio', name: 'lang', value: 'es', onChange: () => { lang = 'es'; } }), 'Español'),
          h('p', { class: 'small muted' }, 'Durante el examen podés alternar el idioma de cada pregunta.')),
      ),
      h('div', { class: 'notice', style: 'margin-top:1rem' }, h('strong', {}, 'Sobre el puntaje: '), `el resultado se escala linealmente a ${ex.escalaMin}–${ex.escalaMax}, con corte en ${ex.corte} (≈ ${Math.ceil((ex.corte - ex.escalaMin) / (ex.escalaMax - ex.escalaMin) * ex.items)} de ${ex.items}). Anthropic no publica su método de escalado, así que es una aproximación.`),
      h('div', { class: 'row', style: 'margin-top:1rem' }, h('button', { class: 'btn-primary', onClick: () => start(seed || randomSeed(), lang) }, 'Comenzar examen')),
    ));
  }

  function start(seed, lang) {
    const form = buildExam(bank, { seed });
    const att = { form, lang, answers: {}, flags: {}, current: 0, startedAt: Date.now(), endsAt: Date.now() + form.minutes * 60 * 1000, submitted: false };
    saveAttempt(att);
    runExam(att);
  }

  function runExam(att) {
    let timerId = null;
    const total = att.form.questionIds.length;
    const wrap = h('div');
    root.replaceChildren(wrap);

    const timerEl = h('span', { class: 'timer' });
    function tick() {
      const left = Math.round((att.endsAt - Date.now()) / 1000);
      timerEl.textContent = fmtTime(left);
      timerEl.className = 'timer' + (left <= 300 ? ' danger' : left <= 900 ? ' warn' : '');
      if (left <= 0) { stop(); toast('Tiempo agotado. Se entrega el examen.'); submit(true); }
    }
    function stop() { if (timerId) clearInterval(timerId); timerId = null; window.removeEventListener('hashchange', stop); }
    timerId = setInterval(tick, 1000); tick();
    window.addEventListener('hashchange', stop);

    const persist = () => saveAttempt(att);
    const sectionOf = (idx) => att.form.sections.find((s) => s.questionIds.includes(att.form.questionIds[idx]));
    const answered = (id) => { const a = att.answers[id]; return a != null && (!Array.isArray(a) || a.length > 0); };

    function show(idx) {
      att.current = idx; persist();
      const id = att.form.questionIds[idx]; const q = bank.byId[id];
      const sec = sectionOf(idx);
      const bar = h('div', { class: 'exam-bar' },
        h('div', { class: 'row' }, h('strong', {}, `Pregunta ${idx + 1} de ${total}`), h('span', { class: 'muted small' }, `· ${bank.scenarios.find((s) => s.id === sec.scenario).title[att.lang]}`)),
        h('div', { class: 'row' },
          h('button', { class: 'btn-sm', onClick: () => { att.lang = att.lang === 'en' ? 'es' : 'en'; persist(); show(idx); } }, att.lang === 'en' ? 'Español' : 'English'),
          timerEl,
          h('button', { class: 'btn-sm btn-dark', onClick: review }, 'Revisar y entregar')));
      const isFirstInSection = sec.questionIds[0] === id;
      const card = questionCard(bank, q, { lang: att.lang, optionOrder: att.form.optionOrder[id], answer: att.answers[id], mode: 'answer', index: idx + 1, total,
        onChange: (a) => { att.answers[id] = a; persist(); refreshGrid(); } });
      const flagBtn = h('button', { class: 'flag-btn' + (att.flags[id] ? ' on' : ''), onClick: () => { att.flags[id] = !att.flags[id]; persist(); flagBtn.classList.toggle('on', !!att.flags[id]); flagBtn.textContent = att.flags[id] ? '⚑ Marcada para revisar' : '⚐ Marcar para revisar'; refreshGrid(); } }, att.flags[id] ? '⚑ Marcada para revisar' : '⚐ Marcar para revisar');
      const clearBtn = h('button', { class: 'btn-ghost btn-sm', onClick: () => { delete att.answers[id]; persist(); show(idx); } }, 'Limpiar respuesta');
      const nav = h('div', { class: 'row spread', style: 'margin-top:1rem' },
        h('button', { disabled: idx === 0, onClick: () => show(idx - 1) }, '← Anterior'),
        h('div', { class: 'row' }, flagBtn, clearBtn),
        idx + 1 < total ? h('button', { class: 'btn-primary', onClick: () => show(idx + 1) }, 'Siguiente →') : h('button', { class: 'btn-dark', onClick: review }, 'Revisar y entregar'));
      const side = h('aside', { class: 'card' }, h('h3', {}, 'Navegación'), grid(), h('div', { class: 'legend' },
        h('span', {}, h('i', { style: 'background:#e4e4f5' }), 'respondida'), h('span', {}, h('i', { style: 'box-shadow:inset 0 -3px 0 var(--orange)' }), 'marcada'), h('span', {}, h('i', { style: 'background:var(--navy)' }), 'actual')));
      wrap.replaceChildren(bar, h('div', { class: 'exam-layout' }, h('div', {}, scenarioBox(bank, sec.scenario, att.lang, isFirstInSection), card, nav), side));
    }

    let gridEl = null;
    function grid() {
      gridEl = h('div', { class: 'navgrid' });
      refreshGrid(); return gridEl;
    }
    function refreshGrid() {
      if (!gridEl) return;
      gridEl.replaceChildren(...att.form.questionIds.map((id, i) => h('button', {
        class: [answered(id) ? 'answered' : '', att.flags[id] ? 'flagged' : '', i === att.current ? 'current' : ''].join(' '),
        title: id, onClick: () => show(i) }, String(i + 1))));
    }

    function review() {
      const unanswered = att.form.questionIds.map((id, i) => [id, i]).filter(([id]) => !answered(id));
      const flagged = att.form.questionIds.map((id, i) => [id, i]).filter(([id]) => att.flags[id]);
      wrap.replaceChildren(
        h('div', { class: 'exam-bar' }, h('strong', {}, 'Revisión antes de entregar'), timerEl),
        h('div', { class: 'card stack' },
          h('p', {}, `Respondidas: ${total - unanswered.length} de ${total}. Sin responder: ${unanswered.length}. Marcadas: ${flagged.length}.`),
          unanswered.length ? h('div', {}, h('h3', {}, 'Sin responder'), h('div', { class: 'row' }, unanswered.map(([, i]) => h('button', { class: 'btn-sm', onClick: () => show(i) }, String(i + 1))))) : null,
          flagged.length ? h('div', {}, h('h3', {}, 'Marcadas para revisar'), h('div', { class: 'row' }, flagged.map(([, i]) => h('button', { class: 'btn-sm flag-btn on', onClick: () => show(i) }, String(i + 1))))) : null,
          h('p', { class: 'muted small' }, 'En el examen real no hay penalización por responder mal: una pregunta en blanco vale lo mismo que una incorrecta.'),
          h('div', { class: 'row' },
            h('button', { onClick: () => show(att.current) }, '← Volver al examen'),
            h('button', { class: 'btn-primary', onClick: () => { if (confirm(`¿Entregar el examen${unanswered.length ? ` con ${unanswered.length} sin responder` : ''}?`)) submit(false); } }, 'Entregar examen'))));
    }

    function submit(timedOut) {
      stop();
      const result = gradeExam(bank, att.form, att.answers);
      const record = {
        id: `att-${Date.now()}`, finishedAt: new Date().toISOString(), seed: att.form.seed, lang: att.lang, timedOut,
        durationSec: Math.round((Math.min(Date.now(), att.endsAt) - att.startedAt) / 1000),
        scaled: result.scaled, passed: result.passed, correctCount: result.correctCount, total: result.total, percent: result.percent,
        perDomain: result.perDomain, perStatement: result.perStatement, perScenario: result.perScenario,
        details: result.details, form: att.form, answers: att.answers, flags: att.flags,
      };
      pushHistory(record); clearAttempt();
      navigate(`/resultados?id=${record.id}`);
    }

    show(att.current || 0);
  }
}
