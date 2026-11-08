/* KULTURA · F2 · Datos de muestra y gesto común «marcar». El progreso es inventado para el prototipo. */
(() => {
  document.documentElement.classList.add('js');
  const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  const works = [
    { id: 'serie', fmt: 'Serie', title: 'El último reino', y: 2015, n: 8, cur: 5, scene: '#d9a35e', fp: '50% 34%', t: 44, hr: 1, verb: 'Marcar visto', done: 'Al día', lab: k => 'T2 E' + k, say: k => 'temporada 2, episodio ' + k, rest: r => r === 1 ? 'te queda 1 episodio' : 'te quedan ' + r + ' episodios' },
    { id: 'pelicula', fmt: 'Película', title: 'El caballero oscuro', y: 2008, n: 15, cur: 9, scene: '#67a5d9', fp: '50% 28%', t: 24, hr: .9, verb: 'Sumar 10 min', done: 'Vista', lab: k => (k * 10) + ' min', say: k => 'minuto ' + (k * 10), rest: r => 'te quedan ' + (r * 10) + ' min' },
    { id: 'anime', fmt: 'Anime', title: 'Frieren', y: 2023, n: 12, cur: 8, scene: '#3fb0dc', fp: '50% 30%', depth: 1, t: 36, hr: .94, verb: 'Marcar visto', done: 'Al día', lab: k => 'T1 E' + k, say: k => 'temporada 1, episodio ' + k, rest: r => r === 1 ? 'te queda 1 episodio' : 'te quedan ' + r + ' episodios' },
    { id: 'manga', fmt: 'Manga', title: 'Solo Leveling', y: 2018, n: 18, cur: 11, scene: '#5db1e4', fp: '50% 24%', depth: 1, t: 20, hr: .72, verb: 'Marcar leído', done: 'Al día', lab: k => 'cap. ' + (161 + k), say: k => 'capítulo ' + (161 + k), rest: r => r === 1 ? 'te queda 1 capítulo' : 'te quedan ' + r + ' capítulos' },
    { id: 'libro', fmt: 'Libro', title: 'Proyecto Hail Mary', y: 2021, n: 12, cur: 6, scene: '#ef6a35', fp: '50% 40%', t: 40, hr: .84, verb: 'Sumar 40 páginas', done: 'Leído', lab: k => 'p. ' + (k * 40), say: k => 'página ' + (k * 40), rest: r => 'te quedan ' + (r * 40) + ' páginas' },
    { id: 'comic', fmt: 'Cómic', title: 'Watchmen', y: 1987, n: 12, cur: 7, scene: '#e0c23a', fp: '50% 30%', t: 16, hr: .96, verb: 'Marcar leído', done: 'Leído', lab: k => 'n.º ' + k, say: k => 'número ' + k, rest: r => r === 1 ? 'te queda 1 número' : 'te quedan ' + r + ' números' },
    { id: 'juego', fmt: 'Juego', title: 'Valheim', y: 2021, n: 16, cur: 12, scene: '#f1a231', fp: '50% 30%', depth: 1, t: 22, hr: .8, verb: 'Sumar 1 hora', done: 'Acabado', lab: k => k + ' h', say: k => k + ' horas', rest: r => r + ' h para acabarlo' },
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const listeners = new Set();
  const emit = (w) => listeners.forEach(f => f(w));

  /* Región viva: existe desde la carga, para que el primer anuncio no se pierda */
  const live = document.createElement('div'); live.className = 'vh'; live.setAttribute('role', 'status'); document.body.append(live);
  const say = t => { live.textContent = t; };

  /* Deshacer: cada botón de marcar tiene su hueco reservado desde la carga, así el botón no se mueve nunca bajo el dedo.
     Se queda hasta cambiar de obra */
  const UNDO_ICON = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4 3.5 8.5 8 13M4 8.5h7.5a4.5 4.5 0 0 1 0 9H9" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
  const undo = document.createElement('button'); undo.type = 'button'; undo.className = 'btn btn--quiet undo';
  undo.innerHTML = UNDO_ICON;
  let stack = [], back = null;
  const dropUndo = () => { const had = document.activeElement === undo; undo.remove(); stack = []; if (had && back && back.isConnected) back.focus(); };
  undo.addEventListener('click', () => {
    const s = stack.pop(); if (!s) return;
    s.w.cur = s.was; emit(s.w); say(s.w.title + ': deshecho, ' + full(s.w) + '.');
    if (stack.length) { undo.setAttribute('aria-label', 'Deshacer ' + s.w.say(s.was - 1) + ' de ' + s.w.title); return; }
    undo.remove(); if (back && back.isConnected) back.focus();
  });

  const mark = (w, btn, ev) => {
    document.documentElement.classList.toggle('kb', !!ev && ev.detail === 0);
    if (w.cur > w.n) return;
    if (stack.length && stack[0].w !== w) stack = [];
    const was = w.cur; stack.push({ w, was }); w.cur += 1; emit(w);
    back = btn; btn.nextElementSibling.append(undo); undo.setAttribute('aria-label', 'Deshacer ' + w.say(was) + ' de ' + w.title);
    say(w.title + ': ' + w.say(was) + ', hecho. ' + left(w) + '.');
  };

  const isDone = w => w.cur > w.n;
  const label = w => isDone(w) ? w.done : w.lab(w.cur);
  const full = w => isDone(w) ? w.done : w.say(w.cur);
  const left = w => { const r = w.n - w.cur + 1; return r <= 0 ? 'sin nada pendiente' : w.rest(r); };

  /* El dato se ve abreviado y se oye entero (VOZ) */
  const setData = (el, w) => {
    el.textContent = '';
    const a = document.createElement('span'); a.setAttribute('aria-hidden', 'true'); a.textContent = label(w);
    const b = document.createElement('span'); b.className = 'vh'; b.textContent = full(w);
    el.append(a, b);
  };

  /* Copia revelada de una portada: base sin exponer + hasta donde vas + la unidad en curso a media luz */
  const cut = k => 'inset(0 0 ' + (100 - Math.min(1, Math.max(0, k)) * 100).toFixed(3) + '% 0)';
  const makePrint = (w, cls = '', intro = null) => {
    const p = document.createElement('div'); p.className = 'print ' + cls; p.style.setProperty('--fp', w.fp); p.setAttribute('aria-hidden', 'true');
    const layer = c => { const i = new Image(); i.src = 'img/' + w.id + '.jpg'; i.alt = ''; i.className = c; p.append(i); return i; };
    layer('print__base'); const now = layer('print__now'), on = layer('print__on');
    const paint = () => { now.style.clipPath = cut((isDone(w) ? w.n : w.cur) / w.n); on.style.clipPath = cut((w.cur - 1) / w.n); };
    /* Primera carga: la copia se revela a saltos, una unidad cada vez. Solo una vez y en menos de 900 ms */
    if (intro !== null && !rm) {
      now.style.clipPath = on.style.clipPath = cut(0);
      setTimeout(() => {
        const t = 'clip-path 620ms steps(' + Math.max(1, w.cur - 1) + ') ' + (intro * 35) + 'ms';
        now.style.transition = on.style.transition = t; paint();
        setTimeout(() => { now.style.transition = on.style.transition = ''; }, 620 + intro * 35 + 40);
      }, 40);
    } else paint();
    listeners.add(x => { if (x === w) paint(); });
    return p;
  };

  /* Botón que refleja el estado de una obra, con su hueco para Deshacer. El del primer pantallazo cambia de obra sin destruirse: el foco no se pierde */
  const markBtn = (first) => {
    let w = first;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--quiet mark';
    const paint = () => {
      b.textContent = isDone(w) ? 'Hecho' : w.verb;
      const v = document.createElement('span'); v.className = 'vh'; v.textContent = isDone(w) ? ': ' + w.title + ' completo' : ': ' + w.say(w.cur) + ' de ' + w.title; b.append(v);
      b.setAttribute('aria-disabled', String(isDone(w)));
    };
    b.addEventListener('click', e => mark(w, b, e)); paint();
    listeners.add(x => { if (x === w) paint(); });
    const slot = document.createElement('span'); slot.className = 'slot'; slot.innerHTML = UNDO_ICON;
    const set = document.createElement('span'); set.className = 'markset'; set.append(b, slot);
    set.setWork = x => { if (x !== w && undo.parentNode === slot) dropUndo(); w = x; paint(); };
    return set;
  };

  /* Profundidad real: el mapa de la portada recorta un primer plano, solo en lo ya revelado */
  const depthLayers = (w) => {
    const f = document.createDocumentFragment();
    if (!w.depth) return f;
    const fg = new Image(); fg.src = 'img/' + w.id + '.jpg'; fg.alt = ''; fg.className = 'depth-fg'; fg.setAttribute('aria-hidden', 'true');
    const m = 'url(img/' + w.id + '_d.jpg)'; fg.style.webkitMaskImage = m; fg.style.maskImage = m; fg.style.maskMode = 'luminance'; fg.style.webkitMaskSize = '100% 100%'; fg.style.maskSize = '100% 100%';
    const clip = () => { fg.style.clipPath = cut((w.cur - 1) / w.n); }; clip(); listeners.add(x => { if (x === w) clip(); });
    f.append(fg); return f;
  };

  /* Inclinación con el puntero: una sola interacción física */
  const tilt = (el, max = 6, target = el) => {
    if (rm || !fine) return;
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; target.style.setProperty('--rx', (-y * max * 2).toFixed(2) + 'deg'); target.style.setProperty('--ry', (x * max * 2).toFixed(2) + 'deg'); target.style.setProperty('--dx', (x * 18).toFixed(1) + 'px'); target.style.setProperty('--dy', (y * 18).toFixed(1) + 'px'); });
    el.addEventListener('pointerleave', () => ['--rx', '--ry', '--dx', '--dy'].forEach(p => target.style.removeProperty(p)));
  };

  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  const riseAll = () => document.querySelectorAll('.rise').forEach(el => io.observe(el));

  window.K = { works, $, label, full, left, setData, say, cut, makePrint, markBtn, depthLayers, tilt, riseAll, rm, fine, on: f => listeners.add(f) };
})();
