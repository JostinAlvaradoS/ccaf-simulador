import { makeRng } from './rng.js';

// Cuotas por dominio a partir de los pesos del blueprint. 60 → 16/11/12/12/9.
export function domainQuotas(domains, items) {
  const quota = {};
  for (const d of domains) quota[d.id] = Math.round(d.weight * items);
  let diff = items - Object.values(quota).reduce((a, b) => a + b, 0);
  const byWeight = domains.slice().sort((a, b) => b.weight - a.weight);
  for (let i = 0; diff !== 0; i = (i + 1) % byWeight.length) {
    quota[byWeight[i].id] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
  }
  return quota;
}

/**
 * Arma un examen que imita el real:
 *  - elige `scenarioCount` de los 6 escenarios (al azar, con semilla)
 *  - respeta la cuota por dominio
 *  - nunca incluye dos redacciones de la misma pregunta (enlace relatedTo)
 *  - reparte las ideas (clusters) lo más parejo posible
 *  - solo dominios 1–5 (los transversales quedan para práctica)
 *  - agrupa las preguntas por escenario, como en Pearson VUE
 * Si un dominio no alcanza su cuota dentro de los 4 escenarios, completa con
 * preguntas de otros escenarios y lo reporta en `fallbacks`.
 */
export function buildExam(bank, { seed, items, scenarioCount } = {}) {
  const exam = bank.meta.exam;
  items = items ?? exam.items;
  scenarioCount = scenarioCount ?? exam.escenariosPorExamen;
  const rng = makeRng(seed);

  const allScenarios = bank.scenarios.map((s) => s.id);
  const chosen = rng.shuffle(allScenarios).slice(0, scenarioCount);
  const quota = domainQuotas(bank.domains, items);

  const pool = bank.questions.filter((q) => q.domain >= 1 && q.domain <= 5);
  const inScope = rng.shuffle(pool.filter((q) => chosen.includes(q.scenario)));
  const outScope = rng.shuffle(pool.filter((q) => !chosen.includes(q.scenario)));

  // Dedup: `relatedTo` enlaza redacciones de la misma pregunta (guía de estudio
  // corta vs. larga, examen vs. práctica). Nunca entran dos enlazadas al mismo examen.
  const related = new Map(pool.map((q) => [q.id, new Set(q.relatedTo || [])]));
  for (const q of pool) for (const r of q.relatedTo || []) related.get(r)?.add(q.id);
  const pickedIds = new Set();
  const blocked = new Set();
  const clusterUse = {};
  const picked = [];
  const fallbacks = [];
  const perScenario = Object.fromEntries(chosen.map((s) => [s, 0]));
  const take = (q) => {
    picked.push(q); pickedIds.add(q.id);
    for (const r of related.get(q.id) || []) blocked.add(r);
    clusterUse[q.cluster] = (clusterUse[q.cluster] || 0) + 1;
    if (q.scenario in perScenario) perScenario[q.scenario]++;
  };
  const ok = (q) => !pickedIds.has(q.id) && !blocked.has(q.id);

  for (const dom of Object.keys(quota).map(Number)) {
    let need = quota[dom];
    // Dentro de los escenarios elegidos: prefiere clusters (ideas) aún no usados
    // y reparte parejo entre escenarios.
    const candidates = inScope.filter((q) => q.domain === dom);
    while (need > 0) {
      const avail = candidates.filter(ok);
      if (!avail.length) break;
      avail.sort((a, b) => (clusterUse[a.cluster] || 0) - (clusterUse[b.cluster] || 0) || perScenario[a.scenario] - perScenario[b.scenario]);
      take(avail[0]); need--;
    }
    // Fuera de los escenarios elegidos, solo si hace falta.
    while (need > 0) {
      const avail = outScope.filter((q) => q.domain === dom && ok(q));
      if (!avail.length) break;
      avail.sort((a, b) => (clusterUse[a.cluster] || 0) - (clusterUse[b.cluster] || 0));
      take(avail[0]); fallbacks.push(avail[0].id); need--;
    }
    if (need > 0) throw new Error(`Banco insuficiente para el dominio ${dom}: faltan ${need}`);
  }

  // Orden final: exactamente los escenarios elegidos, como en el examen real.
  // Una pregunta de fallback se muestra bajo el escenario elegido cuyos dominios
  // primarios incluyen su dominio (o el menos cargado); el escenario original queda
  // en `q.scenario` para el desglose de resultados.
  const primary = Object.fromEntries(bank.scenarios.map((s) => [s.id, s.primaryDomains || []]));
  const placement = {};
  for (const q of picked) {
    if (chosen.includes(q.scenario)) { placement[q.id] = q.scenario; continue; }
    const fit = chosen.filter((s) => primary[s].includes(q.domain));
    const pool2 = fit.length ? fit : chosen;
    const target = pool2.slice().sort((a, b) => perScenario[a] - perScenario[b])[0];
    placement[q.id] = target; perScenario[target]++;
  }
  const sections = chosen
    .map((s) => ({ scenario: s, questionIds: rng.shuffle(picked.filter((q) => placement[q.id] === s)).map((q) => q.id) }))
    .filter((sec) => sec.questionIds.length);

  // Las opciones también se barajan (con semilla) para que memorizar letras no sirva.
  const optionOrder = {};
  for (const q of picked) optionOrder[q.id] = rng.shuffle(q.text.en.options.map((o) => o.id));

  return {
    seed: String(seed),
    createdAt: new Date().toISOString(),
    scenarios: chosen,
    sections,
    questionIds: sections.flatMap((s) => s.questionIds),
    optionOrder,
    placement,
    quota,
    fallbacks,
    minutes: exam.minutos,
  };
}

/** Filtro para modo práctica. Devuelve preguntas barajadas con semilla opcional. */
export function buildPractice(bank, { domains = [], topics = [], scenarios = [], ids = null, seed = 'practice', limit = null } = {}) {
  const rng = makeRng(seed);
  let qs = bank.questions.filter((q) =>
    (!domains.length || domains.includes(q.domain)) &&
    (!topics.length || topics.includes(q.topic)) &&
    (!scenarios.length || scenarios.includes(q.scenario)) &&
    (!ids || ids.includes(q.id)));
  qs = rng.shuffle(qs);
  if (limit) qs = qs.slice(0, limit);
  const optionOrder = {};
  for (const q of qs) optionOrder[q.id] = rng.shuffle(q.text.en.options.map((o) => o.id));
  return { questionIds: qs.map((q) => q.id), optionOrder };
}
