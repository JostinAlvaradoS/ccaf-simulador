# Simulador CCAR-F

Simulador del examen **Claude Certified Architect – Foundations (CCAR-F)** de Anthropic, construido para el Programa Orquestador CCAF. Dos modos:

- **Práctica**: elegís dominio, subtema o escenario y recibís corrección inmediata con la explicación de *cada* opción, no solo de la correcta. Hay filtro "solo las que fallé".
- **Examen**: 60 preguntas, 120 minutos, 4 de 6 escenarios, cuotas por dominio según el blueprint oficial, marcar para revisar, pantalla de revisión antes de entregar, sin retroalimentación hasta el final. El puntaje se escala a 100–1000 con corte en 720 y se desglosa por dominio como en el informe real.

El progreso vive en el navegador (localStorage) y se puede exportar e importar como JSON.

> Este banco es material de estudio elaborado a partir de la guía oficial del examen, la guía de estudio y exámenes de práctica. **No contiene preguntas reales del examen** y no está afiliado a Anthropic ni a Pearson VUE.

## Usar

Publicado con GitHub Pages desde `site/` (ver `.github/workflows/pages.yml`). Para correrlo local no hace falta compilar nada:

```bash
python3 -m http.server 8080 --directory site
# abrir http://localhost:8080
```

Abrir `site/index.html` directo con doble clic **no funciona**: los módulos ES y el `fetch` del banco necesitan un servidor.

## Cómo está armado

```
data/
  banco-fuente.json           banco consolidado (fuente de verdad; 208 preguntas, 194 activas)
  escenarios-asignados.json   pregunta → escenario oficial S1..S6
  escenarios.json             los 6 escenarios de la guía, en inglés y español
  dominios.json               pesos, task statements 1.1–5.6, mapeo tópico → statement
  i18n/en.json, es.json       texto de cada pregunta en ambos idiomas
scripts/build_bank.py         valida todo y genera site/data/bank.json
site/                         la app (HTML + CSS + JS sin bundler)
  js/engine/                  lógica pura: rng con semilla, selector, puntuador, progreso
  js/ui/                      vistas: inicio, práctica, examen, resultados, historial/progreso
tests/engine.test.js          tests del motor (node --test)
```

### Fidelidad con el examen real

| Aspecto | Examen real (guía oficial) | Simulador |
|---|---|---|
| Ítems y tiempo | 60 · 120 min | 60 · 120 min, autoentrega al agotarse |
| Escenarios | 4 al azar de 6; las preguntas cuelgan del escenario | Igual. Cada pregunta del banco tiene escenario asignado |
| Pesos por dominio | 27 / 18 / 20 / 20 / 15 % | Cuotas 16 / 11 / 12 / 12 / 9 |
| Formato | Opción única y respuesta múltiple con "Select N" | Igual; múltiple se puntúa todo o nada |
| Idioma | Inglés | Inglés por defecto, español con un clic |
| Puntaje | Escala 100–1000, corte 720, escalado no público | Lineal: 720 ≈ 42/60. Declarado como aproximación |
| Informe | Aprobado/no + % por dominio | Igual, más desglose por escenario y statement |
| Navegación | Marcar para revisar, pantalla de revisión | Igual |

Lo que el simulador **no** reproduce: la proctoría y el escalado psicométrico real.

### Formularios reproducibles

La semilla determina el examen completo (preguntas, orden, orden de opciones). `FORM-A`, `FORM-B` y `FORM-C` son presets para que toda una cohorte rinda el mismo simulacro y se puedan comparar resultados.

## Mantener el banco

1. Editar `data/banco-fuente.json` (o agregar preguntas nuevas con el mismo esquema y `status: "active"`).
2. Asignar escenario en `data/escenarios-asignados.json` y ambos idiomas en `data/i18n/`.
3. `npm run build` valida (una sola correcta en `single`, `selectCount` coherente, escenario y tópico existentes, textos en ambos idiomas, cuota por dominio alcanzable) y regenera `site/data/bank.json`.
4. `npm test` corre los tests del motor, incluido uno que arma tres formularios sobre el banco real.

El CI rechaza el push si `site/data/bank.json` no está regenerado.

### Notas sobre el etiquetado de escenarios

El intento de examen original usaba escenarios propios (`s1`–`s10`). Se remapearon a los seis oficiales: `s2` era investigación multiagente (S3), `s7` una plataforma de búsqueda federada (S4), `s9` un equipo de documentación con Claude Code (S2, S4 o S5 según la pregunta) y `s10` moderación de contenido (S1). Las 138 preguntas restantes se clasificaron una por una según el contexto del enunciado y los dominios primarios que la guía declara para cada escenario. Las 7 preguntas transversales (modelos, seguridad, plataforma) solo aparecen en práctica.
