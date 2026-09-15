export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  const hh = Math.floor(m / 60), mm = m % 60;
  return (hh ? `${hh}:` : '') + `${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
}

export function domainBadge(bank, d) {
  const dom = bank.domains.find((x) => x.id === d);
  const label = d === 0 ? 'Transversal' : `D${d} · ${dom?.name.es ?? ''}`;
  return h('span', { class: `badge badge-d${d}`, title: dom?.name.en ?? '' }, label);
}

export function scenarioBadge(bank, sid, lang = 'es') {
  const s = bank.scenarios.find((x) => x.id === sid);
  return h('span', { class: 'badge badge-scn', title: s?.title.en ?? '' }, `${sid} · ${s?.title[lang] ?? ''}`);
}

export function scenarioBox(bank, sid, lang, open = true) {
  const s = bank.scenarios.find((x) => x.id === sid);
  if (!s) return null;
  return h('details', { class: 'scenario-box', open },
    h('summary', {}, `${lang === 'en' ? 'Scenario' : 'Escenario'}: ${s.title[lang]}`),
    h('p', {}, s.context[lang]));
}

export function pct(c, t) { return t ? Math.round((c / t) * 100) : 0; }

/**
 * Tarjeta de pregunta reutilizable.
 *  - mode 'answer': el usuario elige (radio/checkbox)
 *  - mode 'reveal': muestra corrección, explicaciones y justificación
 */
export function questionCard(bank, q, { lang = 'en', showAlt = false, optionOrder, answer, mode = 'answer', onChange, index, total } = {}) {
  const t = q.text[lang]; const alt = q.text[lang === 'en' ? 'es' : 'en'];
  const order = optionOrder || t.options.map((o) => o.id);
  const multi = q.type === 'multiple-response';
  const given = multi ? (Array.isArray(answer) ? answer : []) : answer;
  const letters = 'ABCDEFGH';

  const card = h('div', { class: 'card question' });
  const meta = h('div', { class: 'q-meta' });
  if (index != null) meta.append(h('strong', {}, `${lang === 'en' ? 'Question' : 'Pregunta'} ${index}${total ? ` / ${total}` : ''}`));
  if (mode === 'reveal' || !window.__examMode) {
    meta.append(domainBadge(bank, q.domain));
    if (q.statement) meta.append(h('span', { class: 'badge', title: bank.statements[q.statement] }, `Statement ${q.statement}`));
    meta.append(scenarioBadge(bank, q.scenario, lang));
    meta.append(h('span', { class: 'badge mono', title: `Fuente: ${q.source}` }, q.id));
  }
  if (multi) meta.append(h('span', { class: 'badge', style: 'background:var(--amber-bg);color:var(--amber)' }, lang === 'en' ? `Select ${q.selectCount}` : `Seleccione ${q.selectCount}`));
  card.append(meta);
  card.append(h('p', { class: 'q-stem' }, t.stem));
  if (showAlt) card.append(h('p', { class: 'q-stem alt' }, alt.stem));

  const list = h('ul', { class: 'options' });
  order.forEach((oid, i) => {
    const o = t.options.find((x) => x.id === oid);
    const oAlt = alt.options.find((x) => x.id === oid);
    const isSel = multi ? given.includes(oid) : given === oid;
    const isCorrect = q.correct.includes(oid);
    const cls = ['opt'];
    if (mode === 'answer' && isSel) cls.push('selected');
    if (mode === 'reveal') {
      cls.push('locked');
      if (isCorrect && isSel) cls.push('correct');
      else if (isCorrect) cls.push('missed');
      else if (isSel) cls.push('wrong');
    }
    const input = h('input', { type: multi ? 'checkbox' : 'radio', name: `q-${q.id}`, value: oid, checked: isSel, disabled: mode === 'reveal' });
    const li = h('li', { class: cls.join(' ') },
      input,
      h('span', { class: 'letter' }, letters[i] + '.'),
      h('div', {}, h('div', {}, o.text), showAlt ? h('div', { class: 'muted small' }, oAlt.text) : null));
    if (mode === 'reveal') {
      const expl = o.explanation || (isCorrect ? '' : '');
      if (expl) li.append(h('div', { class: 'explain' }, h('strong', {}, isCorrect ? (lang === 'en' ? 'Correct. ' : 'Correcta. ') : (lang === 'en' ? 'Incorrect. ' : 'Incorrecta. ')), expl));
      else if (isCorrect || isSel) li.append(h('div', { class: 'explain' }, h('strong', {}, isCorrect ? (lang === 'en' ? 'Correct answer' : 'Respuesta correcta') : (lang === 'en' ? 'Incorrect' : 'Incorrecta'))));
    } else {
      li.addEventListener('click', (ev) => {
        if (ev.target !== input) { input.checked = multi ? !input.checked : true; }
        let next;
        if (multi) {
          next = Array.from(list.querySelectorAll('input:checked')).map((x) => x.value);
          if (next.length > q.selectCount) { input.checked = false; next = next.filter((x) => x !== oid); toast(lang === 'en' ? `Select only ${q.selectCount}` : `Seleccione solo ${q.selectCount}`); }
        } else next = oid;
        list.querySelectorAll('.opt').forEach((el) => el.classList.toggle('selected', el.querySelector('input').checked));
        onChange?.(next);
      });
    }
    list.append(li);
  });
  card.append(list);

  if (mode === 'reveal') {
    card.append(h('div', { class: 'rationale' }, h('strong', {}, lang === 'en' ? 'Why: ' : 'Por qué: '), t.rationale));
    if (q.conflictNote) card.append(h('div', { class: 'notice', style: 'margin-top:.6rem' }, h('strong', {}, 'Nota del banco: '), q.conflictNote));
    const src = (q.sources || []).filter((s) => s.label);
    if (src.length) card.append(h('div', { class: 'sources muted' }, (lang === 'en' ? 'Sources: ' : 'Fuentes: ') + src.map((s) => s.label).join(' · ')));
  }
  return card;
}
