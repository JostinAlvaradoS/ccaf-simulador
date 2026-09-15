import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { makeRng } from '../site/js/engine/rng.js';
import { buildExam, buildPractice, domainQuotas } from '../site/js/engine/selector.js';
import { gradeExam, isCorrect, scaledScore, trafficLight } from '../site/js/engine/scorer.js';

const BANK_PATH = new URL('../site/data/bank.json', import.meta.url);

// Banco sintético para que los tests no dependan del JSON generado.
function syntheticBank() {
  const domains = [
    { id: 1, weight: 0.27 }, { id: 2, weight: 0.18 }, { id: 3, weight: 0.20 }, { id: 4, weight: 0.20 }, { id: 5, weight: 0.15 },
  ];
  const scenarios = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].map((id, i) => ({ id, primaryDomains: [(i % 5) + 1] }));
  const questions = [];
  let n = 0;
  for (const d of domains) for (const s of scenarios) for (let k = 0; k < 8; k++) {
    n++;
    questions.push({
      id: `Q${n}`, domain: d.id, scenario: s.id, cluster: `c${d.id}-${k % 3}`, relatedTo: k === 0 ? [`Q${n + 1}`] : [], statement: `${d.id}.1`, type: 'single', selectCount: 1,
      correct: ['B'], text: { en: { options: ['A', 'B', 'C', 'D'].map((id) => ({ id })) } },
    });
  }
  // un par de transversales que no deben entrar al examen
  questions.push({ id: 'X1', domain: 0, scenario: 'S1', cluster: 'cx1', type: 'single', correct: ['A'], text: { en: { options: [{ id: 'A' }, { id: 'B' }] } } });
  return {
    meta: { exam: { items: 60, minutos: 120, escenariosPorExamen: 4, escalaMin: 100, escalaMax: 1000, corte: 720 } },
    domains, scenarios, questions,
  };
}

test('rng es determinista con la misma semilla', () => {
  const a = makeRng('FORM-A'), b = makeRng('FORM-A'), c = makeRng('FORM-B');
  const sa = Array.from({ length: 5 }, () => a()), sb = Array.from({ length: 5 }, () => b()), sc = Array.from({ length: 5 }, () => c());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('cuotas por dominio suman 60 y siguen el blueprint', () => {
  const q = domainQuotas(syntheticBank().domains, 60);
  assert.deepEqual(q, { 1: 16, 2: 11, 3: 12, 4: 12, 5: 9 });
});

test('buildExam: 60 ítems, 4 escenarios, cuotas exactas, sin pares relatedTo, sin dominio 0', () => {
  const bank = syntheticBank();
  const exam = buildExam(bank, { seed: 'FORM-A' });
  assert.equal(exam.questionIds.length, 60);
  assert.equal(exam.scenarios.length, 4);
  assert.equal(new Set(exam.questionIds).size, 60);
  const byId = Object.fromEntries(bank.questions.map((q) => [q.id, q]));
  const perDomain = {};
  const ids = new Set(exam.questionIds);
  for (const id of exam.questionIds) {
    const q = byId[id];
    assert.ok(q.domain >= 1 && q.domain <= 5);
    assert.ok(exam.scenarios.includes(q.scenario), 'toda pregunta cae en un escenario elegido');
    for (const r of q.relatedTo) assert.ok(!ids.has(r), `${id} y ${r} son la misma pregunta`);
    perDomain[q.domain] = (perDomain[q.domain] || 0) + 1;
  }
  assert.deepEqual(perDomain, { 1: 16, 2: 11, 3: 12, 4: 12, 5: 9 });
  assert.equal(exam.fallbacks.length, 0);
  // secciones agrupadas por escenario y cubren todos los ids
  assert.deepEqual(exam.sections.flatMap((s) => s.questionIds), exam.questionIds);
});

test('buildExam es reproducible por semilla', () => {
  const bank = syntheticBank();
  const a = buildExam(bank, { seed: 'COHORTE-1' });
  const b = buildExam(bank, { seed: 'COHORTE-1' });
  assert.deepEqual(a.questionIds, b.questionIds);
  assert.deepEqual(a.optionOrder, b.optionOrder);
});

test('buildExam recurre a otros escenarios cuando falta cobertura y lo reporta', () => {
  const bank = syntheticBank();
  // deja el dominio 5 solo en S5 y S6
  bank.questions = bank.questions.filter((q) => q.domain !== 5 || q.scenario === 'S6' || q.scenario === 'S5');
  let exam; let seed = 0;
  do { exam = buildExam(bank, { seed: `s${seed++}` }); } while ((exam.scenarios.includes('S6') || exam.scenarios.includes('S5')) && seed < 500);
  assert.ok(!exam.scenarios.includes('S6') && !exam.scenarios.includes('S5'));
  assert.equal(exam.questionIds.length, 60);
  assert.equal(exam.fallbacks.length, 9);
  // aun con fallbacks, el examen muestra exactamente 4 secciones (escenarios elegidos)
  assert.deepEqual(exam.sections.map((s) => s.scenario).sort(), exam.scenarios.slice().sort());
  assert.deepEqual(exam.sections.flatMap((s) => s.questionIds).sort(), exam.questionIds.slice().sort());
});

test('isCorrect: single y multiple-response todo o nada', () => {
  const single = { correct: ['B'] };
  assert.equal(isCorrect(single, 'B'), true);
  assert.equal(isCorrect(single, 'A'), false);
  assert.equal(isCorrect(single, null), false);
  const multi = { correct: ['A', 'C', 'D'] };
  assert.equal(isCorrect(multi, ['D', 'A', 'C']), true);
  assert.equal(isCorrect(multi, ['A', 'C']), false);
  assert.equal(isCorrect(multi, ['A', 'C', 'D', 'B']), false);
});

test('escala lineal 100–1000: 42/60 aprueba, 41/60 no', () => {
  assert.equal(scaledScore(60, 60), 1000);
  assert.equal(scaledScore(0, 60), 100);
  assert.ok(scaledScore(42, 60) >= 720);
  assert.ok(scaledScore(41, 60) < 720);
});

test('gradeExam desglosa por dominio y marca aprobado', () => {
  const bank = syntheticBank();
  const exam = buildExam(bank, { seed: 'G' });
  const answers = {};
  exam.questionIds.forEach((id, i) => { answers[id] = i < 45 ? 'B' : 'A'; });
  const r = gradeExam(bank, exam, answers);
  assert.equal(r.correctCount, 45);
  assert.equal(r.total, 60);
  assert.equal(r.passed, true);
  assert.equal(Object.values(r.perDomain).reduce((a, d) => a + d.total, 0), 60);
  assert.equal(trafficLight({ correct: 9, total: 10 }), 'green');
  assert.equal(trafficLight({ correct: 6, total: 10 }), 'amber');
  assert.equal(trafficLight({ correct: 2, total: 10 }), 'red');
  assert.equal(trafficLight(null), 'none');
});

test('buildPractice filtra por dominio y tópico', () => {
  const bank = syntheticBank();
  const p = buildPractice(bank, { domains: [3] });
  assert.equal(p.questionIds.length, 48);
  const byId = Object.fromEntries(bank.questions.map((q) => [q.id, q]));
  assert.ok(p.questionIds.every((id) => byId[id].domain === 3));
});

test('banco real (si está construido): 3 formularios distintos con cuotas exactas', { skip: !existsSync(BANK_PATH) }, () => {
  const bank = JSON.parse(readFileSync(BANK_PATH, 'utf8'));
  const byId = Object.fromEntries(bank.questions.map((q) => [q.id, q]));
  for (const seed of ['FORM-A', 'FORM-B', 'FORM-C']) {
    const exam = buildExam(bank, { seed });
    assert.equal(exam.questionIds.length, 60, seed);
    const perDomain = {};
    const ids = new Set(exam.questionIds);
    for (const id of exam.questionIds) {
      perDomain[byId[id].domain] = (perDomain[byId[id].domain] || 0) + 1;
      for (const r of byId[id].relatedTo) assert.ok(!ids.has(r), `${seed}: ${id} y ${r} juntas`);
    }
    assert.deepEqual(perDomain, { 1: 16, 2: 11, 3: 12, 4: 12, 5: 9 }, seed);
    assert.ok(exam.fallbacks.length <= 12, `${seed}: demasiados fallbacks (${exam.fallbacks.length})`);
  }
});
