import { h, questionCard, scenarioBox, toast } from './common.js';
import { buildPractice } from '../engine/selector.js';
import { isCorrect } from '../engine/scorer.js';
import { recordPractice, failedIds, getPref, setPref, practiceStats } from '../engine/progress.js';
import { randomSeed } from '../engine/rng.js';

export function renderPractice({ bank, params }) {
  const root = h('div', { class: 'stack' });
  const state = {
    lang: getPref('lang', 'en'), showAlt: getPref('showAlt', false),
    domains: [], topics: [], scenarios: [], onlyFailed: params.get('failed') === '1', limit: 20,
  };
  renderSetup();
  return root;

  function renderSetup() {
    const stats = practiceStats();
    const domFs = h('fieldset', {}, h('legend', {}, 'Dominios'));
    for (const d of [...bank.domains, { id: 0, name: { es: 'Transversales (modelos, seguridad, plataforma)' } }]) {
      const n = bank.meta.byDomain[d.id] ?? 0;
      domFs.append(h('label', { class: 'check' }, h('input', { type: 'checkbox', value: d.id, onChange: (e) => { toggle(state.domains, d.id, e.target.checked); refreshTopics(); } }), `D${d.id} · ${d.name.es} `, h('span', { class: 'muted small' }, `(${n})`)));
    }
    const topicSel = h('select', { multiple: true, size: 8, style: 'width:100%', onChange: (e) => { state.topics = Array.from(e.target.selectedOptions).map((o) => o.value); } });
    const topicFs = h('fieldset', {}, h('legend', {}, 'Tópicos (opcional)'), topicSel, h('p', { class: 'muted small', style: 'margin:.4rem 0 0' }, 'Ctrl/Cmd + clic para varios. Vacío = todos los del dominio.'));
    function refreshTopics() {
      topicSel.replaceChildren();
      const ts = bank.topics.filter((t) => !state.domains.length || state.domains.includes(t.domain));
      for (const t of ts) {
        const n = bank.questions.filter((q) => q.topic === t.id).length;
        const seen = bank.questions.filter((q) => q.topic === t.id && stats[q.id]).length;
        topicSel.append(h('option', { value: t.id }, `D${t.domain} · ${t.name} (${seen}/${n})`));
      }
      state.topics = [];
    }
    refreshTopics();

    const scnFs = h('fieldset', {}, h('legend', {}, 'Escenarios (opcional)'));
    for (const s of bank.scenarios) scnFs.append(h('label', { class: 'check' }, h('input', { type: 'checkbox', value: s.id, onChange: (e) => toggle(state.scenarios, s.id, e.target.checked) }), `${s.id} · ${s.title.es}`));

    const failed = failedIds();
    const optsFs = h('fieldset', {}, h('legend', {}, 'Opciones'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: state.onlyFailed, disabled: !failed.length, onChange: (e) => { state.onlyFailed = e.target.checked; } }), `Solo las que fallé la última vez (${failed.length})`),
      h('label', { class: 'check' }, 'Cantidad ', h('select', { onChange: (e) => { state.limit = Number(e.target.value); } }, [10, 20, 30, 50, 0].map((n) => h('option', { value: n, selected: n === state.limit }, n ? String(n) : 'Todas')))),
      h('label', { class: 'check' }, 'Idioma de la pregunta ', h('select', { onChange: (e) => { state.lang = e.target.value; setPref('lang', state.lang); } }, h('option', { value: 'en', selected: state.lang === 'en' }, 'Inglés (como el examen)'), h('option', { value: 'es', selected: state.lang === 'es' }, 'Español'))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: state.showAlt, onChange: (e) => { state.showAlt = e.target.checked; setPref('showAlt', state.showAlt); } }), 'Mostrar también la traducción'),
    );

    root.replaceChildren(
      h('div', { class: 'card' },
        h('h1', {}, 'Modo práctica'),
        h('p', { class: 'muted' }, 'Elegís qué practicar y recibís la corrección al instante: por qué la opción correcta lo es y por qué cada distractor no. Tu avance se guarda en este navegador.'),
        h('div', { class: 'grid grid-2', style: 'margin-top:1rem' }, domFs, topicFs, scnFs, optsFs),
        h('div', { class: 'row', style: 'margin-top:1rem' },
          h('button', { class: 'btn-primary', onClick: start }, 'Empezar'),
          h('a', { class: 'btn btn-ghost', href: '#/progreso' }, 'Ver mi semáforo por statement')),
      ));
  }

  function toggle(arr, v, on) { const i = arr.indexOf(v); if (on && i < 0) arr.push(v); if (!on && i >= 0) arr.splice(i, 1); }

  function start() {
    const set = buildPractice(bank, {
      domains: state.domains, topics: state.topics, scenarios: state.scenarios,
      ids: state.onlyFailed ? failedIds() : null, seed: randomSeed(), limit: state.limit || null,
    });
    if (!set.questionIds.length) { toast('No hay preguntas con ese filtro'); return; }
    runSession(set);
  }

  function runSession(set) {
    let i = 0; let correct = 0; let answer = null; let revealed = false;
    const results = [];
    const wrap = h('div', { class: 'stack' });
    root.replaceChildren(wrap);
    show();

    function show() {
      const q = bank.byId[set.questionIds[i]];
      answer = null; revealed = false;
      const header = h('div', { class: 'row spread' },
        h('div', { class: 'row' }, h('strong', {}, `${i + 1} / ${set.questionIds.length}`), h('span', { class: 'muted' }, `· ${correct} correctas`)),
        h('div', { class: 'row' },
          h('button', { class: 'btn-sm', onClick: () => { state.lang = state.lang === 'en' ? 'es' : 'en'; setPref('lang', state.lang); show(); } }, state.lang === 'en' ? 'Ver en español' : 'See in English'),
          h('button', { class: 'btn-sm', onClick: () => { state.showAlt = !state.showAlt; setPref('showAlt', state.showAlt); show(); } }, state.showAlt ? 'Ocultar traducción' : 'Mostrar traducción'),
          h('button', { class: 'btn-sm btn-ghost', onClick: () => { if (confirm('¿Salir de la sesión de práctica?')) renderSetup(); } }, 'Salir')));
      const card = questionCard(bank, q, { lang: state.lang, showAlt: state.showAlt, optionOrder: set.optionOrder[q.id], mode: 'answer', onChange: (a) => { answer = a; checkBtn.disabled = !ready(q, a); } });
      const checkBtn = h('button', { class: 'btn-primary', disabled: true, onClick: reveal }, 'Comprobar');
      const actions = h('div', { class: 'row' }, checkBtn);
      wrap.replaceChildren(header, scenarioBox(bank, q.scenario, state.lang, false), card, actions);

      function reveal() {
        if (revealed) return; revealed = true;
        const ok = isCorrect(q, answer);
        if (ok) correct++;
        recordPractice(q.id, ok);
        results.push({ id: q.id, ok });
        const revealCard = questionCard(bank, q, { lang: state.lang, showAlt: state.showAlt, optionOrder: set.optionOrder[q.id], answer, mode: 'reveal' });
        revealCard.prepend(h('div', { class: 'verdict ' + (ok ? 'ok' : 'ko') }, ok ? '✔ Correcto' : '✘ Incorrecto'));
        card.replaceWith(revealCard);
        actions.replaceChildren(h('button', { class: 'btn-primary', onClick: next }, i + 1 < set.questionIds.length ? 'Siguiente' : 'Ver resumen'));
        actions.querySelector('button').focus();
      }
    }
    function next() { i++; if (i < set.questionIds.length) show(); else summary(); }
    function summary() {
      const wrong = results.filter((r) => !r.ok);
      wrap.replaceChildren(h('div', { class: 'card' },
        h('h2', {}, 'Resumen de la sesión'),
        h('p', {}, h('span', { class: 'kpi' }, `${correct} / ${results.length}`), ' correctas'),
        wrong.length ? h('div', {}, h('h3', {}, 'Para repasar'), h('ul', {}, wrong.map((r) => { const q = bank.byId[r.id]; return h('li', {}, h('span', { class: 'mono' }, r.id), ' · ', q.text[state.lang].stem.slice(0, 120) + '…'); }))) : h('p', { class: 'muted' }, 'Sin errores. Probá otro dominio o subí la cantidad.'),
        h('div', { class: 'row', style: 'margin-top:1rem' },
          wrong.length ? h('button', { class: 'btn-primary', onClick: () => runSession(buildPractice(bank, { ids: wrong.map((r) => r.id), seed: randomSeed() })) }, 'Repetir solo las falladas') : null,
          h('button', { onClick: renderSetup }, 'Nueva sesión'),
          h('a', { class: 'btn btn-ghost', href: '#/progreso' }, 'Ver progreso'))));
    }
  }
}

function ready(q, a) {
  if (q.type === 'multiple-response') return Array.isArray(a) && a.length === q.selectCount;
  return !!a;
}
