// Corrección. Respuesta múltiple: todo o nada, como en el examen real.
export function isCorrect(question, answer) {
  const given = Array.isArray(answer) ? answer.slice().sort() : (answer ? [answer] : []);
  const want = question.correct.slice().sort();
  return given.length === want.length && given.every((v, i) => v === want[i]);
}

/**
 * Escala lineal 100–1000. Anthropic no publica su método de escalado; el examen
 * real usa una escala psicométrica, así que esto es una aproximación declarada.
 * Con 60 ítems, 720 ≈ 42 aciertos (68,9 %): (720-100)/(1000-100) = 0,689.
 */
export function scaledScore(correct, total, { min = 100, max = 1000 } = {}) {
  if (!total) return min;
  return Math.round(min + (max - min) * (correct / total));
}

export function gradeExam(bank, examForm, answers) {
  const byId = Object.fromEntries(bank.questions.map((q) => [q.id, q]));
  const exam = bank.meta.exam;
  const perDomain = {};
  const perStatement = {};
  const perScenario = {};
  const details = [];
  let correctCount = 0;
  for (const id of examForm.questionIds) {
    const q = byId[id];
    const ok = isCorrect(q, answers[id]);
    if (ok) correctCount++;
    const bump = (obj, key) => { obj[key] = obj[key] || { correct: 0, total: 0 }; obj[key].total++; if (ok) obj[key].correct++; };
    bump(perDomain, q.domain);
    if (q.statement) bump(perStatement, q.statement);
    bump(perScenario, examForm.placement?.[id] || q.scenario);
    details.push({ id, correct: ok, answer: answers[id] ?? null, expected: q.correct, answered: answers[id] != null && (!Array.isArray(answers[id]) || answers[id].length > 0) });
  }
  const total = examForm.questionIds.length;
  const scaled = scaledScore(correctCount, total, { min: exam.escalaMin, max: exam.escalaMax });
  return {
    total, correctCount,
    percent: total ? Math.round((correctCount / total) * 1000) / 10 : 0,
    scaled, passed: scaled >= exam.corte, cutoff: exam.corte,
    perDomain, perStatement, perScenario, details,
  };
}

/** Semáforo por statement: verde ≥ 80 %, ámbar ≥ 60 %, rojo debajo; gris sin datos. */
export function trafficLight(stat) {
  if (!stat || !stat.total) return 'none';
  const p = stat.correct / stat.total;
  if (p >= 0.8) return 'green';
  if (p >= 0.6) return 'amber';
  return 'red';
}
