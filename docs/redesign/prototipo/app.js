/* Kultura · prototipo. Datos reales en window.MEDIA (portadas y, en las del pipeline, mapas de profundidad). */
(() => {
  'use strict';
  const M = window.MEDIA || [];
  const $ = (s, r = document) => r.querySelector(s);
  const html = document.documentElement;
  const mq = (q) => window.matchMedia(q).matches;
  const REDUCED = mq('(prefers-reduced-motion: reduce)');
  const FMT = { movie: 'Película', tv: 'Serie', anime: 'Anime', manga: 'Manga', game: 'Videojuego', book: 'Libro', comic: 'Cómic' };
  const VERB = { movie: 'ves', tv: 'ves', anime: 'ves', manga: 'lees', book: 'lees', comic: 'lees', game: 'juegas' };
  const ROOMS = [
    { verb: 'ves', say: 'Películas, series y anime. Apunta lo que quieres ver y puntúa lo que viste.', ground: '#08121d', rim: '#6fa8ff' },
    { verb: 'lees', say: 'Manga, libros y cómics, con la página por la que vas.', ground: '#170e09', rim: '#ffb36b' },
    { verb: 'juegas', say: 'Videojuegos, con las horas que llevas y los que tienes pendientes.', ground: '#0a150c', rim: '#8dff9e' },
  ];
  const HERO_GROUND = '#0a0a0c';
  const byId = Object.fromEntries(M.map((m) => [m.id, m]));
  const STAR = '<svg class="star" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2l1.95 4.2 4.6.5-3.45 3.1.98 4.55L8 11.2l-4.08 2.35.98-4.55L1.45 5.9l4.6-.5z" fill="currentColor"/></svg>';
  const num = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const sub = (m) => [FMT[m.format], m.author, m.year].filter(Boolean).join(' · ');

  /* ---------- static content (also the finished composition) ---------- */
  // Rooms without 3D
  const shelf = $('#shelf');
  ROOMS.forEach((r, i) => {
    const items = M.filter((m) => VERB[m.format] === r.verb).slice(0, 8);
    const el = document.createElement('div');
    el.className = 'room-static';
    el.innerHTML = `<h2 class="rs">Lo que ${r.verb}</h2><p>${r.say}</p><ul>${items.map((m) => `<li><img src="${m.img}" alt="${m.title}, ${FMT[m.format]}" width="${m.w}" height="${m.h}" decoding="async"></li>`).join('')}</ul>`;
    shelf.appendChild(el);
  });

  // hero without 3D: a flat horizon of real covers (formats alternate)
  $('#horizon').innerHTML = ['ranking-0', 'book-dune', 'game-eldenring', 'feature-1', 'comic-watchmen', 'ranking-2', 'manga-chainsaw', 'game-silksong', 'step-1', 'book-hailmary', 'ranking-1']
    .map((id, i, a) => { const m = byId[id]; const d = i - (a.length - 1) / 2; return `<li style="--r:${(d * 1.3).toFixed(1)}deg;--y:${Math.round(d * d * 3)}px"><img src="${m.img}" alt="" width="${m.w}" height="${m.h}"></li>`; }).join('');
  // Best of 2026 (real ratings from the ranking seeds)
  const ranked = M.filter((m) => m.rating && m.year === 2026).sort((a, b) => b.rating - a.rating).slice(0, 8);
  const one = ranked[0];
  $('#first').innerHTML = `<img src="${one.img}" alt="${one.title}, ${FMT[one.format]}" width="${one.w}" height="${one.h}" loading="lazy"><figcaption><em aria-label="Nota ${num(one.rating)} sobre 10">${num(one.rating)}</em><b>${one.title}</b><span>${FMT[one.format]} · ${one.year} · la mejor nota del año en Kultura</span></figcaption>`;
  $('#best').innerHTML = ranked.slice(1, 7)
    .map((m) => `<li><img src="${m.img}" alt="" width="48" height="72" loading="lazy"><span class="t">${m.title}<span class="f">${FMT[m.format]}</span></span><span class="r" aria-label="Nota ${num(m.rating)} sobre 10">${STAR} ${num(m.rating)}</span></li>`).join('');

  // Live thing: rate four
  const picks = ['ranking-1', 'manga-frieren', 'game-eldenring', 'book-dune'].map((id) => byId[id]).filter(Boolean);
  $('#picks').innerHTML = picks.map((m, i) => `
    <div class="pick"><img src="${m.img}" alt="" loading="lazy">
      <p class="nm" id="pn${i}">${m.title}<span>${FMT[m.format]}</span></p>
      <div class="val" role="group" aria-labelledby="pn${i}"><button type="button" data-d="-1" data-i="${i}" aria-label="Bajar nota de ${m.title}">−</button><output id="pv${i}" aria-live="polite"></output><button type="button" data-d="1" data-i="${i}" aria-label="Subir nota de ${m.title}">+</button></div></div>`).join('');
  const bars = [...$('#mixbar').children];
  const words = { ves: 'ver', lees: 'leer', juegas: 'jugar' };
  const notes = [8, 9, 6, 7]; // sample ratings so the mix shows from the first frame; the visitor changes them
  function mix() {
    const sum = { ves: 0, lees: 0, juegas: 0 };
    picks.forEach((m, i) => {
      const v = notes[i];
      $('#pv' + i).innerHTML = STAR + ' ' + v;
      sum[VERB[m.format]] += v;
    });
    const keys = ['ves', 'lees', 'juegas'];
    const max = Math.max(...keys.map((k) => sum[k]));
    const tops = keys.filter((k) => sum[k] === max && max > 0);
    const tot = keys.reduce((a, k) => a + sum[k], 0);
    keys.forEach((k, i) => { bars[i].style.flexGrow = 1 + sum[k]; bars[i].querySelector('span').textContent = tot ? Math.round(sum[k] / tot * 100) + ' %' : ''; bars[i].classList.toggle('top', tops.length === 1 && tops[0] === k); });
    $('#mixsay').textContent = !max ? ''
      : tops.length > 1 ? 'Te tira todo por igual. Te recomendaremos de los siete formatos.'
      : `Te tira más ${words[tops[0]]}. Empezaremos por ahí.`;
  }
  $('#picks').addEventListener('click', (e) => { const b = e.target.closest('button[data-d]'); if (!b) return; const i = +b.dataset.i; notes[i] = Math.max(1, Math.min(10, notes[i] + +b.dataset.d)); mix(); });
  mix();

  // App fragments (true-black flat)
  const f = byId['step-1'];
  const logo = '<svg width="22" height="22" viewBox="0 0 30 30" aria-hidden="true"><rect x="3" y="4" width="7" height="22" fill="#fff"/><rect x="12.5" y="4" width="7" height="22" fill="#fff" transform="rotate(-14 16 15)"/><rect x="20" y="6" width="7" height="20" fill="#e9e34a" transform="rotate(10 23.5 16)"/></svg>';
  const search = '<button type="button" class="sbtn" aria-label="Buscar"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg></button>';
  $('#ficha').innerHTML = `
    <div class="tb">${logo}<nav aria-label="Ficha: navegación de la app"><span>Inicio</span><span>Descubrir</span><b>Biblioteca</b></nav>${search}</div>
    <div class="body"><div class="cov"><img src="${f.img}" alt="${f.title}"></div>
      <div><h3>${f.title}</h3><p class="meta">Anime · 2026 · 12 episodios</p>
        <div class="seg" role="group" aria-label="Estado">${['Pendiente', 'En curso', 'Completado', 'Abandonado'].map((s) => `<button type="button" aria-pressed="${s === 'En curso'}">${s}</button>`).join('')}</div>
        <div class="kv"><div><span>Tu nota</span><b>${STAR} 9</b></div><div><span>Kultura</span><b>${STAR} ${num(f.rating)}</b></div><div><span>Vas por</span><b>Ep. 5</b></div></div>
        <div class="prog" role="img" aria-label="5 de 12 episodios"><i style="width:41.6%"></i></div>
        <div class="also"><div><img src="${byId['manga-frieren'].img}" alt=""><div><span>También es manga</span><b>Frieren, tomo 1</b></div></div><div><div><span>Dónde verla</span><div class="pl"><i>Crunchyroll</i><i>Netflix</i></div></div></div></div>
        <div class="friends"><span style="background:#f3c6d2">LM</span><span style="background:#c6e3f3">AR</span><span style="background:#d9f3c6">JP</span>3 amigos lo están viendo</div>
      </div></div>`;
  $('#ficha .seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $('#ficha .seg').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); });
  const cov = $('#ficha .cov img');
  $('#ficha').addEventListener('pointermove', (e) => { if (REDUCED) return; const r = cov.getBoundingClientRect(); cov.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 16 + 'deg'); cov.style.setProperty('--rx', -((e.clientY - r.top) / r.height - .5) * 12 + 'deg'); });
  $('#ficha').addEventListener('pointerleave', () => { cov.style.setProperty('--ry', '0deg'); cov.style.setProperty('--rx', '0deg'); });
  const wall = ['ranking-0', 'book-hailmary', 'game-silksong', 'manga-chainsaw', 'ranking-2', 'comic-saga', 'game-bg3', 'feature-1'].map((id) => byId[id]);
  const prog = [62, 35, 20, 80, 45, 10, 55, 90];
  $('#lib').innerHTML = `
    <div class="tb">${logo}<nav aria-label="Biblioteca: navegación de la app"><span>Inicio</span><b>Biblioteca</b><span>Listas</span></nav>${search}</div>
    <div class="chips" role="group" aria-label="Filtrar por estado">${[['En curso', 8], ['Pendiente', 42], ['Completado', 318], ['Abandonado', 0]].map(([n, c], i) => `<button type="button" aria-pressed="${i === 0}">${n} ${c}</button>`).join('')}</div>
    <div class="wall">${wall.map((m, i) => `<div><img src="${m.img}" alt="${m.title}" loading="lazy"><div class="p" role="img" aria-label="${prog[i]} %"><i style="width:${prog[i]}%"></i></div></div>`).join('')}</div>`;

  $('#lib .chips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $('#lib .chips').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); });

  // Entrances (once, 85% down the viewport)
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  $('#first').classList.add('shutter'); $('#best').classList.add('lift'); $('#picks').classList.add('lift');
  document.querySelectorAll('.rise, .shutter, .lift').forEach((el) => io.observe(el));
  // Hero title: painted on the first frame; the arrival is carried by the 3D objects coming out of the fog
  // Bar gets a solid ground once quiet sections reach it
  const bar = $('#bar');
  const quietIO = new IntersectionObserver((es) => { bar.classList.toggle('solid', es.some((e) => e.isIntersecting) || [...document.querySelectorAll('.quiet')].some((q) => { const r = q.getBoundingClientRect(); return r.top < 70 && r.bottom > 0; })); }, { rootMargin: '0px 0px -92% 0px' });
  document.querySelectorAll('.quiet').forEach((q) => quietIO.observe(q));

  /* ---------- 3D stage ---------- */
  const T = window.THREE;
  const conn = navigator.connection || {};
  const canGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; } })();
  if (!T || !canGL || REDUCED || conn.saveData || (navigator.deviceMemory && navigator.deviceMemory < 2)) return; // finished composition stays

  const canvas = $('#gl');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.fog = new T.Fog(new T.Color(HERO_GROUND), 13, 30);
  const camera = new T.PerspectiveCamera(30, 1, 0.1, 80);
  camera.position.set(0, 0, 10);
  const hemi = new T.HemisphereLight(0xffffff, 0x20202a, 0.55); scene.add(hemi);
  const key = new T.SpotLight(0xfff4e6, 2.4, 40, 0.62, 0.85, 1.1);
  key.position.set(2, 2, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 2; key.shadow.camera.far = 30; key.shadow.bias = -0.0004; key.shadow.radius = 6; scene.add(key); scene.add(key.target);
  const floor = new T.Mesh(new T.PlaneGeometry(60, 60), new T.ShadowMaterial({ opacity: 0.5 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // the room: a floor and a back wall in the room's colour, so the spotlight leaves a pool of light
  const roomMat = new T.MeshStandardMaterial({ color: 0x000000, roughness: 0.92, metalness: 0 });
  const roomFloor = new T.Mesh(new T.PlaneGeometry(40, 30), roomMat); roomFloor.rotation.x = -Math.PI / 2; roomFloor.receiveShadow = true; scene.add(roomFloor);
  const roomWall = new T.Mesh(new T.PlaneGeometry(40, 20), roomMat); roomWall.receiveShadow = true; scene.add(roomWall);
  const rim = new T.DirectionalLight(0xbcd2ff, 0.7); rim.position.set(-4, 5, -6); scene.add(rim);

  const loader = new T.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (src, color) => new Promise((res) => loader.load(src, (t) => { if (color) t.encoding = T.sRGBEncoding; t.anisotropy = Math.min(8, maxAniso); t.minFilter = T.LinearFilter; t.generateMipmaps = false; res(t); }, undefined, () => res(null)));
  const shade = (hex, k) => { const c = new T.Color(hex); c.multiplyScalar(k); return c; };

  const H = 1.4;
  function spineTex(m) {
    const c = document.createElement('canvas'); c.width = 96; c.height = 768; const x = c.getContext('2d');
    const col = new T.Color(m.accent || '#444'); const hsl = {}; col.getHSL(hsl);
    col.setHSL(hsl.h, Math.min(0.75, hsl.s + 0.15), Math.min(0.42, Math.max(0.18, hsl.l * 0.8)));
    x.fillStyle = '#' + col.getHexString(); x.fillRect(0, 0, 96, 768);
    x.save(); x.translate(60, 40); x.rotate(Math.PI / 2); x.fillStyle = '#f4efe4';
    x.font = '600 34px "Red Hat Text", system-ui, sans-serif'; let t = m.title; while (x.measureText(t).width > 560 && t.length > 4) t = t.slice(0, -2);
    x.fillText(t === m.title ? t : t.trim() + '…', 0, 0);
    if (m.author) { x.font = '400 24px "Red Hat Text", system-ui, sans-serif'; x.globalAlpha = 0.75; x.fillText(m.author.slice(0, 22), 600 - Math.min(150, x.measureText(m.author.slice(0, 22)).width) - 10, 0); }
    x.restore();
    x.fillStyle = '#f4efe4'; x.globalAlpha = 0.9; x.fillRect(30, 712, 36, 4);
    const t2 = new T.CanvasTexture(c); t2.encoding = T.sRGBEncoding; t2.anisotropy = 4; return t2;
  }
  const THICK = { movie: 0.035, tv: 0.035, anime: 0.035, comic: 0.025, manga: 0.15, book: 0.26, game: 0.13 };
  const phoneNow = () => innerWidth < 768;
  const LIMIT = phoneNow() ? 16 : M.length;
  const list = [...M].sort((a, b) => (a.depth ? 0 : 1) - (b.depth ? 0 : 1)).slice(0, LIMIT);
  const objs = [];

  async function build(m, i) {
    const [map, dep] = await Promise.all([tex(m.img, true), m.depth ? tex(m.depth, false) : null]);
    if (!map) return;
    const W = H * m.w / m.h, d = THICK[m.format] || 0.04;
    const g = new T.Group();
    const paper = new T.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.92 });
    const spine = (m.format === 'book' || m.format === 'manga' || m.format === 'comic') ? new T.MeshStandardMaterial({ map: spineTex(m), emissiveMap: null, roughness: 0.7 }) : new T.MeshStandardMaterial({ color: shade(m.accent || '#444', 0.6), roughness: 0.7 });
    const dark = new T.MeshStandardMaterial({ color: 0x050506, roughness: m.format === 'game' ? 0.22 : 0.32, metalness: m.format === 'game' ? 0.25 : 0.55 });
    let cover;
    if (dep) {
      // screens: thin body, cover with real relief from its depth map
      const body = new T.Mesh(new T.BoxGeometry(W * 1.03, H * 1.02, 0.08), dark); body.position.z = -0.02; g.add(body);
      cover = new T.Mesh(new T.PlaneGeometry(W, H, 90, Math.round(90 * H / W)),
        new T.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.32, displacementMap: dep, displacementScale: 0.09, displacementBias: 0, roughness: 0.82, metalness: 0 }));
      cover.position.z = 0.03; g.add(cover); // in front of the bezel's face (0.02)
    } else if (m.format === 'game') {
      const body = new T.Mesh(new T.BoxGeometry(W * 1.05, H * 1.03, d), dark); g.add(body);
      cover = new T.Mesh(new T.PlaneGeometry(W * 0.97, H * 0.97), new T.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.38, roughness: 0.3, metalness: 0.08 }));
      cover.position.z = d / 2 + 0.003; g.add(cover);
    } else {
      // paper: spine on the left face, page edges elsewhere, the cover printed on the front
      const front = new T.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.78 });
      const mats = [paper, spine, paper, paper, front, spine];
      cover = new T.Mesh(new T.BoxGeometry(W, H, d), mats); g.add(cover);
    }
    g.userData = { m, i, W, d, cover, dep: !!dep, h: 0, hT: 0, seed: i * 1.731, spin: 0 };
    g.traverse((o) => { o.userData.root = g; if (o.isMesh) o.castShadow = true; });
    scene.add(g); objs[i] = g;
  }

  /* layouts: each returns a target {p,r,s} per object index; objects not in the room go deep into the fog */
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const away = (i) => ({ p: V(4 + (i % 5) * 1.6, -1.5 + ((i * 7) % 5) * 0.9, -22 - (i % 4) * 2), r: V(0, -0.6, 0), s: 0.8, off: true });
  function region(verb) {
    const P = phoneNow();
    const F = P ? { ves: [-0.08, 1.08, 0.27, 0.8], lees: [0.02, 0.98, 0.3, 0.8], juegas: [-0.06, 1.06, 0.27, 0.8] }
                : { ves: [0.16, 0.84, 0.4, 0.9], lees: [0.06, 0.94, 0.47, 0.88], juegas: [0.26, 0.8, 0.42, 0.86] };
    const [sx0, sx1, sy0, sy1] = F[verb || 'ves'];
    const a = at(sx0, sy1, 0), b = at(sx1, sy0, 0);
    return { x0: a.x, x1: b.x, y0: a.y, y1: b.y };
  }
  // screen-space → world at depth z (camera at z=10 looking down -z)
  const visH = (z) => 2 * Math.tan(camera.fov * Math.PI / 360) * (10 - z);
  const at = (sx, sy, z) => V((sx - 0.5) * visH(z) * camera.aspect, (0.5 - sy) * visH(z), z);
  function heroLayout() {
    const P = phoneNow(), n = objs.length, out = [];
    const focal = ['book-dune', 'ranking-0', 'game-eldenring'].map((id) => objs.findIndex((o) => o && o.userData.m.id === id)).filter((i) => i >= 0);
    const others = [...objs.keys()].filter((i) => objs[i] && !focal.includes(i)).sort((a, b) => ((a * 7) % n) - ((b * 7) % n));
    // three focal pieces in front, under the title
    focal.forEach((i, k) => { const sx = P ? [0.5, 0.18, 0.82][k] : [0.5, 0.3, 0.7][k];
      out[i] = { p: at(sx, P ? 0.5 : 0.66, k ? -0.6 : 0.4), r: V(0.02, k === 1 ? 0.28 : k === 2 ? -0.28 : 0, 0), s: P ? 0.9 : 1.08 }; });
    // a ring of nine behind them, the rest dissolving in the fog
    const ring = P ? 6 : 9;
    others.forEach((i, k) => {
      if (k < ring) { const u = (k + 0.5) / ring, side = u < 0.5 ? -1 : 1;
        out[i] = { p: at(P ? 0.06 + u * 0.88 : 0.08 + u * 0.84, (P ? 0.42 : 0.56) + Math.abs(u - 0.5) * (P ? 0.12 : 0.14), -4.2 - (k % 3) * 0.7), r: V(0, side * -0.25 + Math.sin(k) * 0.1, Math.sin(k * 1.9) * 0.05), s: P ? 0.95 : 1 }; }
      else out[i] = { p: at(0.2 + (((k - ring) * 0.37) % 1) * 0.6, 0.5, -28), r: V(0, 0, 0), s: 1 };
    });
    return out;
  }
  function roomLayout(verb) {
    const R = region(verb), out = objs.map((_, i) => away(i));
    const idx = objs.map((o, i) => (o && VERB[o.userData.m.format] === verb ? i : -1)).filter((i) => i >= 0);
    const P = phoneNow(), cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, w = R.x1 - R.x0, h = R.y1 - R.y0;
    if (verb === 'ves') { // a home cinema: three big screens in a triptych, the rest of the wall far behind
      const main = idx.slice(0, 3), rest = [];
      const sc = Math.min(h * 0.9 / H, w * (P ? 0.46 : 0.3) / Math.max(...main.map((i) => objs[i].userData.W)));
      const off = w * (P ? 0.36 : 0.33);
      front.ves = main[0];
      [[0, 0, -0.9, 0], [-1, -off, -0.1, 0.5], [1, off, -0.1, -0.5]].forEach(([_, dx, z, ry], k) => { const i = main[k]; if (i === undefined) return;
        out[i] = { p: V(cx + dx, cy - (k ? 0.04 : 0), z), r: V(0, ry, 0), s: sc * (k ? 0.86 : 1) }; });
      rest.forEach((i, k) => { const u = (k + 0.5) / rest.length;
        out[i] = { p: V(cx - w * 0.55 + u * w * 1.1, cy + h * 0.32, -6.5), r: V(0, 0, 0), s: sc * 0.75 }; });
      floorY.ves = cy - H * sc / 2;
    } else if (verb === 'lees') { // a long shelf along the bottom: some face out, most show their printed spine
      const use = idx.slice(0, P ? 7 : 9), faceOut = new Set(P ? [0, 3, 6] : [0, 4, 8]);
      const unit = use.map((i, k) => { const o = objs[i].userData, fo = faceOut.has(k); return { i, fo, w: fo ? o.W : o.d + 0.035, gap: fo ? 0.12 : 0.015 }; });
      const total = unit.reduce((a, u) => a + u.w + u.gap, 0);
      const s = Math.min(h * 0.95 / H, w * 0.97 / total);
      let x = cx - total * s / 2; const base = R.y0 + 0.05;
      unit.forEach((u, k) => { const ww = u.w * s;
        out[u.i] = { p: V(x + ww / 2, base + H * s / 2, -0.3 + (u.fo ? 0.12 : 0)), r: V(0, u.fo ? -0.1 : 1.5708, u.fo ? 0 : (k % 3 === 1 ? 0.05 : 0)), s };
        x += ww + u.gap * s; });
      shelfY = base; shelfW = total * s + 0.4; shelfX = cx; floorY.lees = base;
    } else { // games fanned like cards in a hand, running off the right edge
      const pref = ['game-bg3', 'game-hades2', 'game-eldenring', 'game-silksong', 'ranking-3', 'feature-3'];
      const use = idx.slice().sort((x, y) => pref.indexOf(objs[x].userData.m.id) - pref.indexOf(objs[y].userData.m.id)).slice(0, P ? 5 : 6), n = use.length, maxW = Math.max(...use.map((j) => objs[j].userData.W));
      const sg = Math.min(h * 0.82 / H, w / (maxW * (P ? 2.7 : 3.2))), rad = w * (P ? 0.78 : 0.62);
      use.forEach((i, k) => { const a = (k - (n - 1) / 2) * (P ? 0.32 : 0.3);
        out[i] = { p: V(cx + Math.sin(a) * rad, cy + 0.1 - (1 - Math.cos(a)) * rad * 0.5, -0.2 - Math.abs(a) * 0.9 + (k - n / 2) * 0.09), r: V(0, -a * 0.2, -a * 0.6), s: sg }; front.juegas = use[Math.floor((n - 1) / 2)]; });
      floorY.juegas = cy - H * sg / 2 - 0.25;
    }
    return out;
  }
  const star = () => null; let starObj = null;
  const firstImg = () => document.querySelector('#first img');
  // a screen point → the point on the z=0 plane under it, through the real camera (it drifts with the cursor)
  const _v = new T.Vector3(), _d = new T.Vector3();
  function onPlane(px, py) {
    const cr = canvas.getBoundingClientRect(); // the canvas stops covering the viewport once the world scrolls away
    _v.set((px - cr.left) / cr.width * 2 - 1, -((py - cr.top) / cr.height * 2 - 1), 0.5).unproject(camera);
    _d.copy(_v).sub(camera.position).normalize(); const t = -camera.position.z / _d.z;
    return camera.position.clone().add(_d.multiplyScalar(t));
  }
  function posterSlot() {
    const im = firstImg(); if (!im || !starObj) return null; const r = im.getBoundingClientRect(); if (r.height < 10) return null;
    const top = onPlane(r.left + r.width / 2, r.top), bot = onPlane(r.left + r.width / 2, r.bottom);
    const p = top.clone().add(bot).multiplyScalar(0.5);
    return { p, s: (top.y - bot.y) / H };
  }
  let L = [], shelfY = 0, shelfW = 1, shelfX = 0; const floorY = { hero: -2, ves: -2, lees: -2, juegas: -2 }; const front = {};
  const layouts = () => { L = [heroLayout(), roomLayout('ves'), roomLayout('lees'), roomLayout('juegas'), objs.map((_, i) => away(i))]; floorY.hero = Math.min(...L[0].filter((o) => o && o.p.z > -2).map((o) => o.p.y - H * o.s / 2)) - 0.02; };

  /* shelf plank for the reading room */
  const plank = new T.Mesh(new T.BoxGeometry(1, 0.06, 0.55), new T.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.85 }));
  scene.add(plank);

  /* scroll → k (0 hero · 1 ves · 2 lees · 3 juegas), with held plateaus */
  const rooms = $('#salas');
  let kT = 0, k = 0, beat = 0;
  const FORCE = new URLSearchParams(location.search).get('k');
  function mapP(p) {
    const seg = [[0, .22, 0, 1], [.22, .38, 1, 1], [.38, .52, 1, 2], [.52, .66, 2, 2], [.66, .8, 2, 3], [.8, 1, 3, 3]];
    for (const [a, b, u, v] of seg) if (p <= b) { const t = (p - a) / (b - a); return u + (v - u) * (t * t * (3 - 2 * t)); }
    return 3;
  }
  let kRooms = 0, kRank = 0;
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger); gsap.ticker.lagSmoothing(0);
    ScrollTrigger.create({ trigger: rooms, start: 'top bottom', end: 'bottom bottom', onUpdate: (st) => { kRooms = mapP(st.progress); kT = kRooms + kRank; } });
    // leaving the last room: the poster of the year's best flies into the ranking
    ScrollTrigger.create({ trigger: '#mejor', start: 'top bottom', end: 'top 25%', onUpdate: (st) => { kRank = st.progress; kT = kRooms + kRank; } });
  } else {
    addEventListener('scroll', () => { const r = rooms.getBoundingClientRect(), tot = r.height; kT = mapP(Math.min(1, Math.max(0, (innerHeight - r.top) / tot))); }, { passive: true });
  }

  /* chapter: hard cut of ground + fog, verb swap */
  const verbEl = $('#verb'), sayEl = $('#say'), countEl = $('#count'), stageEl = $('#salas .stage');
  let verbTl = null;
  function setBeat(b) {
    if (b === beat) return; beat = b;
    const g = b === 0 ? HERO_GROUND : ROOMS[b - 1].ground;
    document.body.style.background = g; html.style.background = g; scene.fog.color.set(g);
    stageEl.dataset.room = b > 0 ? ROOMS[b - 1].verb : '';
    if (b > 0) {
      const r = ROOMS[b - 1];
      if (countEl) countEl.textContent = b + ' de 3';
      if (window.gsap) {
        if (verbTl) verbTl.kill();
        verbTl = gsap.timeline()
          .to(verbEl, { yPercent: -105, duration: 0.24, ease: 'power2.in' })
          .add(() => { verbEl.textContent = r.verb; sayEl.textContent = r.say; })
          .fromTo(verbEl, { yPercent: 105 }, { yPercent: 0, duration: 0.6, ease: 'expo.out' })
          .fromTo(sayEl, { opacity: 0.45, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'expo.out' }, '<');
      } else { verbEl.textContent = r.verb; sayEl.textContent = r.say; }
    }
  }

  /* pointer: light follows it, objects lean toward it, hover lifts one and opens its relief */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0, has: false }, ndc = new T.Vector2(), ray = new T.Raycaster();
  addEventListener('pointermove', (e) => { ptr.has = true; ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = -(e.clientY / innerHeight * 2 - 1); ndc.set(ptr.tx, ptr.ty); }, { passive: true });
  canvas.addEventListener('click', () => { if (hovered && !REDUCED) hovered.userData.spin = 1; });
  const nowEl = $('#now'), hint = $('.hero .hint'); let featIdx = 0, featT = 0, featObj = null;
  let hovered = null;

  function size() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phoneNow() ? 1.5 : 2));
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 42 : 30; camera.updateProjectionMatrix();
    layouts();
  }
  addEventListener('resize', size);

  const tmpP = new T.Vector3(), tmpR = new T.Vector3();
  let ready = false, running = false, last = performance.now(), t = 0, intro = 0;
  function frame(now) {
    if (!ready) { if (running) requestAnimationFrame(frame); return; }
    const dt = Math.min(0.1, (now - last) / 1000); const ease = (r) => 1 - Math.exp(-dt * r); last = now; t += dt;
    if (!ptr.has) { ptr.tx = Math.sin(t * 0.35) * 0.5; ptr.ty = Math.cos(t * 0.27) * 0.3; }
    ptr.x += (ptr.tx - ptr.x) * ease(3.5); ptr.y += (ptr.ty - ptr.y) * ease(3.5);
    if (FORCE !== null) { kT = k = +FORCE; } else { if (Math.abs(kT - k) > 1.2) k = kT; else k += (kT - k) * ease(5); }
    intro = FORCE !== null ? 1 : Math.min(1, intro + dt / 1.6); const ie = 1 - Math.pow(1 - intro, 4);
    const b = Math.min(3, Math.round(k)); setBeat(k > 3.5 ? 0 : b);
    const a = Math.floor(Math.min(k, 3.999)), f = k - a, A = L[a], B = L[a + 1];
    // camera drifts with the chapter and the pointer
    const CAM = [[0, 0, 10, 0], [0, -0.35, 8.7, -0.15], [0, 0.15, 9.3, 0], [0, 1.3, 9.2, 0.35], [0, 0, 10, 0]];
    const ca = CAM[a], cb = CAM[a + 1], cf = f * f * (3 - 2 * f), cv = (j) => ca[j] + (cb[j] - ca[j]) * cf;
    const pan = Math.max(0, 1 - Math.abs(k - 2) * 2) * (kRooms - 2) * 1.6; // travelling along the shelf while you are in it
    camera.position.set(ptr.x * 0.35 + cv(0) + pan, ptr.y * 0.25 + cv(1), cv(2));
    camera.lookAt(pan * 0.9, cv(3), 0);
    key.position.set(ptr.x * 6, ptr.y * 4 + 1.5, 7); key.target.position.set(ptr.x * 2.5, ptr.y * 1.6, 0);
    // hover
    ray.setFromCamera(ndc, camera);
    const hit = ptr.has ? ray.intersectObjects(objs.filter(Boolean).map((o) => o.userData.cover), false)[0] : null;
    const h = hit ? hit.object.userData.root : null;
    if (h !== hovered) { hovered = h; }
    // featured object of the room: the hovered one, otherwise one every 3.2 s
    let feat = null;
    if (b > 0 && k <= 3.25) {
      const inRoom = objs.filter((o) => o && VERB[o.userData.m.format] === ROOMS[b - 1].verb && L[b][o.userData.i].p.z > -5);
      featT += dt; if (featT > 3.2) { featT = 0; featIdx++; }
      const fr = objs[front[ROOMS[b - 1].verb]]; feat = hovered && inRoom.includes(hovered) ? hovered : (fr && inRoom.includes(fr) ? fr : inRoom[featIdx % Math.max(1, inRoom.length)]);
    }
    if (feat && !phoneNow() && b === 3) { nowEl.style.left = '40px'; nowEl.style.top = (innerHeight - 140) + 'px'; }
    else if (feat && !phoneNow() && b === 2) { nowEl.style.left = (innerWidth * 0.62) + 'px'; nowEl.style.top = (innerHeight * 0.2) + 'px'; }
    else if (feat) { const v = feat.position.clone(); v.y -= H * feat.scale.y * 0.5 + 0.12; v.project(camera);
      nowEl.style.left = (phoneNow() ? 20 : Math.min(innerWidth - 320, Math.max(40, (v.x + 1) / 2 * innerWidth - 150))) + 'px'; nowEl.style.top = Math.min(innerHeight - 96, (1 - v.y) / 2 * innerHeight + 10) + 'px'; }
    if (k > 3.25) feat = null;
    if (feat !== featObj) { featObj = feat; const m = feat && feat.userData.m;
      nowEl.innerHTML = m ? `<b>${m.title}</b><span>${[FMT[m.format], m.author, m.year].filter(Boolean).join(' · ')}${m.rating ? ' · ' + STAR + ' ' + num(m.rating) : ''}</span>` : ''; }
    // the poster slot of the ranking, live (it scrolls with the page)
    const slot = posterSlot();
    objs.forEach((o, i) => {
      if (!o) return; const u = o.userData; const pa = A[i];
      // hero → first room: the pieces that do not belong in the cinema fly past the camera, either side
      const pb = a === 0 && B[i].off ? { p: V(pa.p.x * 2.6 + (pa.p.x >= 0 ? 2 : -2), pa.p.y * 1.6 - 0.6, 10.5), r: V(0, pa.p.x >= 0 ? -0.9 : 0.9, 0), s: pa.s, off: true } : B[i];
      // outgoing pieces leave in the first half, incoming ones arrive in the second, one after another
      const st = ((i * 37) % 11) / 11 * 0.18;
      let g = f;
      if (pb.off && !pa.off) g = Math.min(1, f / 0.5);
      else if (pa.off && !pb.off) g = Math.max(0, Math.min(1, (f - 0.3 - st) / 0.52));
      else g = Math.max(0, Math.min(1, (f - st * 0.5) / 0.91));
      g = g * g * (3 - 2 * g);
      tmpP.lerpVectors(pa.p, pb.p, g); tmpR.lerpVectors(pa.r, pb.r, g); let s = pa.s + (pb.s - pa.s) * g;
      if (o === starObj && slot && k > 2.6) { const q = Math.min(1, Math.max(0, (k - 3) / 0.85)); const e = q * q * (3 - 2 * q);
        tmpP.lerp(slot.p, e); tmpR.multiplyScalar(1 - e); s += (slot.s - s) * e; }
      u.hT = (o === hovered || o === featObj) && !(o === starObj && k > 3.2) ? 1 : 0; u.h += (u.hT - u.h) * ease(8);
      const life = 1 - Math.abs(f - 0.5) * 0; // always alive
      const lift = phoneNow() ? 0.22 : 0.45;
      o.position.set(tmpP.x, tmpP.y + Math.sin(t * 0.8 + u.seed) * 0.035 * life, tmpP.z + u.h * lift - (1 - ie) * (10 + (i % 5) * 2));
      if (u.spin > 0) u.spin = Math.max(0, u.spin - dt / 1.1); const sp = u.spin > 0 ? (1 - Math.pow(u.spin, 3)) * Math.PI * 2 : 0;
      o.rotation.set(tmpR.x - ptr.y * 0.14 + u.h * -ptr.y * 0.2, tmpR.y + ptr.x * 0.2 + u.h * ptr.x * 0.25 + sp, tmpR.z);
      o.scale.setScalar(s * (1 + u.h * (phoneNow() ? 0.03 : 0.06)));
      if (u.dep) u.cover.material.displacementScale = 0.09 + u.h * 0.12;
    });
    const FY = [floorY.hero, floorY.ves, floorY.lees, floorY.juegas, floorY.juegas]; floor.position.y = FY[a] + (FY[a + 1] - FY[a]) * f;
    const inRoomK = Math.min(1, Math.max(0, k - 0.5) * 2, Math.max(0, 3.6 - k) * 2); // 0 in the hero, 1 inside the rooms
    roomMat.color.set(beat > 0 ? ROOMS[beat - 1].ground : HERO_GROUND); roomMat.color.multiplyScalar(0.55);
    roomFloor.position.set(0, floor.position.y - 0.002, -4); roomWall.position.set(0, floor.position.y + 10, -4.5 - (1 - inRoomK) * 30);
    roomFloor.visible = roomWall.visible = inRoomK > 0.01 && k < 3.5 && kT < 3.5; floor.visible = !roomFloor.visible;
    hemi.intensity = 0.55 - inRoomK * 0.2; key.intensity = 2.4 + inRoomK * 1.9; rim.color.set(beat > 0 ? ROOMS[beat - 1].rim : 0xbcd2ff); rim.intensity = 0.7 + inRoomK * 0.9; key.angle = 0.62 - inRoomK * 0.18;
    // shelf plank only in the reading room
    const lees = Math.max(0, 1 - Math.abs(k - 2) * 1.6);
    plank.visible = lees > 0.01;
    plank.scale.set(shelfW, 1, 1); plank.position.set(shelfX, shelfY - 0.03, -0.3 - (1 - lees) * 14);
    renderer.render(scene, camera);
    if (running) requestAnimationFrame(frame);
  }
  // render only while the hero or the rooms are on screen and the tab is visible
  const stageIO = new IntersectionObserver(() => toggle(), {});
  stageIO.observe($('#top')); stageIO.observe(rooms);
  function visible() { const r = rooms.getBoundingClientRect(); return r.bottom > 0 && !document.hidden; }
  function toggle() { const v = visible(); if (v && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } else if (!v) running = false; }
  addEventListener('scroll', toggle, { passive: true }); document.addEventListener('visibilitychange', toggle);

  Promise.all(list.map((m, i) => build(m, i))).then(() => {
    starObj = objs.find((o) => o && o.userData.m.id === 'ranking-2') || null;
    size(); ready = true;
    html.classList.add('gl-on');
    toggle();
  });
})();
