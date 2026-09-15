#!/usr/bin/env python3
"""Construye site/data/bank.json a partir de data/.

Entradas:
  data/banco-fuente.json          banco consolidado (fuente de verdad, no se edita a mano)
  data/escenarios-asignados.json  id de pregunta -> escenario oficial S1..S6
  data/escenarios.json            los 6 escenarios de la guía
  data/dominios.json              pesos, statements, mapeo tópico -> statement
  data/i18n/en.json, es.json      textos por idioma, por id de pregunta

Salida: site/data/bank.json con solo preguntas activas y ambos idiomas.
Falla (exit 1) ante cualquier inconsistencia: es el validador del proyecto.
"""
import json, sys, pathlib, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "site" / "data" / "bank.json"

errors = []
def err(msg): errors.append(msg)

def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)

fuente = load(DATA / "banco-fuente.json")
asign = load(DATA / "escenarios-asignados.json")["asignaciones"]
escen = load(DATA / "escenarios.json")["escenarios"]
dom = load(DATA / "dominios.json")
i18n = {lang: load(DATA / "i18n" / f"{lang}.json") for lang in ("en", "es")}

scenario_ids = {s["id"] for s in escen}
topics = {t["id"]: t for t in fuente["topics"]}
active = [q for q in fuente["questions"] if q["status"] == "active"]
active_ids = {q["id"] for q in active}

# --- validaciones estructurales ---
ids = [q["id"] for q in active]
if len(ids) != len(set(ids)):
    err("ids duplicados en el banco")

out_questions = []
for q in active:
    qid = q["id"]
    opts = q["options"]
    correct = [o["id"] for o in opts if o["isCorrect"]]
    if q["type"] == "single":
        if len(correct) != 1:
            err(f"{qid}: single con {len(correct)} correctas")
        select_count = 1
    elif q["type"] == "multiple-response":
        select_count = q.get("selectCount")
        if not select_count or select_count != len(correct):
            err(f"{qid}: multiple-response selectCount={select_count} pero {len(correct)} correctas")
    else:
        err(f"{qid}: tipo desconocido {q['type']}"); continue
    if len({o["id"] for o in opts}) != len(opts):
        err(f"{qid}: ids de opción repetidos")
    if qid not in asign:
        err(f"{qid}: sin escenario asignado")
    elif asign[qid] not in scenario_ids:
        err(f"{qid}: escenario {asign[qid]} no existe")
    if q["topic"] not in topics:
        err(f"{qid}: tópico {q['topic']} no existe")
    if q["domain"] not in (0, 1, 2, 3, 4, 5):
        err(f"{qid}: dominio {q['domain']} inválido")

    text = {}
    for lang in ("en", "es"):
        t = i18n[lang].get(qid)
        if not t:
            err(f"{qid}: falta texto en {lang}"); continue
        if [o["id"] for o in t["options"]] != [o["id"] for o in opts]:
            err(f"{qid}: opciones de {lang} no coinciden con el banco")
        if not t.get("stem") or not t.get("rationale"):
            err(f"{qid}: stem o rationale vacío en {lang}")
        text[lang] = {
            "stem": t["stem"],
            "options": [{"id": o["id"], "text": o["text"], "explanation": o.get("explanation") or ""} for o in t["options"]],
            "rationale": t["rationale"],
        }

    out_questions.append({
        "id": qid,
        "domain": q["domain"],
        "topic": q["topic"],
        "statement": dom["topicToStatement"].get(q["topic"]),
        "scenario": asign.get(qid),
        "type": q["type"],
        "selectCount": select_count,
        "difficulty": q.get("difficulty"),
        "source": q["source"],
        "cluster": q.get("cluster"),
        "isCanonical": bool(q.get("isCanonical")),
        "relatedTo": [r for r in q.get("relatedTo", []) if r in active_ids],
        "conflictNote": q.get("conflictNote"),
        "sources": q.get("sources", []),
        "correct": correct,
        "text": text,
    })

# --- validaciones de cobertura para el modo examen ---
weights = {d["id"]: d["weight"] for d in dom["dominios"]}
items = dom["examen"]["items"]
quota = {d: round(w * items) for d, w in weights.items()}
diff = items - sum(quota.values())
if diff:  # ajusta el residuo de redondeo sobre el dominio de mayor peso
    top = max(quota, key=lambda d: weights[d]); quota[top] += diff
per_domain = collections.Counter(q["domain"] for q in out_questions)
for d, n in quota.items():
    if per_domain[d] < n:
        err(f"dominio {d}: solo {per_domain[d]} preguntas activas, la cuota del examen es {n}")

if errors:
    print("BUILD FALLIDO:", file=sys.stderr)
    for e in errors: print("  -", e, file=sys.stderr)
    sys.exit(1)

bank = {
    "meta": {
        "name": "Simulador CCAR-F",
        "sourceBank": fuente["meta"]["name"],
        "activeQuestions": len(out_questions),
        "byDomain": dict(sorted(per_domain.items())),
        "byScenario": dict(sorted(collections.Counter(q["scenario"] for q in out_questions).items())),
        "exam": dom["examen"],
        "quota": quota,
    },
    "domains": dom["dominios"],
    "statements": dom["statements"],
    "topics": [{"id": t["id"], "domain": t["domain"], "name": t["name"], "desc": t.get("desc", "")} for t in fuente["topics"]],
    "scenarios": escen,
    "questions": out_questions,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(bank, f, ensure_ascii=False, indent=1)
print(f"OK: {len(out_questions)} preguntas -> {OUT.relative_to(ROOT)}")
print("  por dominio:", dict(sorted(per_domain.items())))
print("  por escenario:", bank["meta"]["byScenario"])
print("  cuota examen:", quota)
