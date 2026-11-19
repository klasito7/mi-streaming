/* =========================================================
   🎸 One Day, One Band (Escuchar → Banda del día)
   Cada día te ofrezco 2 bandas y elegís 1. La que no elegís vuelve al día siguiente contra otra nueva,
   hasta 3 veces: si la salteás 3 veces, sale de la rotación ("se fueron sin elegir").
   Si un día no elegís, la ronda te espera (no se pierde nada). Las rondas se sincronizan (db.odob).
   Las bandas están en banda-data*.js. Escuchar la elegida da 15 vaccoins (una vez por ronda).
   ========================================================= */
const Banda = (() => {
  const PREMIO = 15, MAXV = 3, FIRST = 'Miss May I';
  const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const byN = n => BANDAS.find(b => b.n === n) || null;
  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  let sel = null, busy = '';

  /* ---------- rondas ---------- */
  function S0() {
    if (!db.odob || !Array.isArray(db.odob.r)) { db.odob = { r:[{ a:FIRST, b:null, p:FIRST, d:'2026-11-19' }], like:{}, oido:{} }; save(); }
    return db.odob;
  }
  const rounds = () => S0().r;
  const skips = n => rounds().filter(r => r.p && r.p !== n && (r.a === n || r.b === n)).length;
  const shown = () => new Set(rounds().flatMap(r => [r.a, r.b]).filter(Boolean));
  const retired = () => [...shown()].filter(n => !rounds().some(r => r.p === n) && skips(n) >= MAXV);
  function queue() { const s = shown(); return BANDAS.map(b => b.n).filter(n => !s.has(n)).sort((x, y) => hash('odob' + x) - hash('odob' + y)); }
  // la ronda de hoy: si la última ya se eligió en un día anterior, armo una nueva
  function current() {
    const R = rounds(), last = R[R.length - 1], today = ymd();
    if (last.p && last.d < today) {
      const out = last.b ? (last.p === last.a ? last.b : last.a) : null;
      const q = queue(), carry = out && skips(out) < MAXV ? out : null;
      let a = carry || q.shift(), b = q.shift();
      if (!a && !b) return last;                       // se terminó el catálogo: queda la última
      if (!b) { b = a; a = null; }
      if (a && hash(today + a) % 2) [a, b] = [b, a];    // la que vuelve no siempre a la izquierda
      R.push({ a:a || b, b:a ? b : null, p:a ? null : b, d:today }); save();
    }
    return R[R.length - 1];
  }
  const roundNo = r => rounds().indexOf(r) + 1;
  function pick(r, n) { r.p = n; r.d = ymd(); save(); sel = null; render(); }
  const listened = no => (typeof Figus !== 'undefined' && Figus.bandaOk?.(no)) || !!S0().oido?.[no];

  /* ---------- buscar en YouTube (con tu clave; 100 de cuota la primera vez, después queda guardado) ---------- */
  const base = b => b.q || b.n.replace(/\s*\(.*\)$/, '');
  async function findId(q, tipo) {
    const C = S.get('odobIds', {}), k = tipo + '|' + q.toLowerCase();
    if (C[k]) return C[k];
    const j = await Canales.yt('search', tipo === 'video'
      ? { part:'snippet', type:'video', videoCategoryId:'10', q, maxResults:1, regionCode:'AR' }
      : { part:'snippet', type:'playlist', q:q + ' álbum', maxResults:1, regionCode:'AR' });
    const r = j.items?.[0]; if (!r) return null;
    const x = { id:r.id.videoId || r.id.playlistId, t:r.snippet.title, thumb:r.snippet.thumbnails?.medium?.url || '' };
    C[k] = x; S.set('odobIds', C); return x;
  }
  const ytm = q => window.open('https://music.youtube.com/search?q=' + encodeURIComponent(q), '_blank');
  const sinClave = q => { if (Device.mode === 'tv') toast('<b>Para escucharla acá hace falta tu clave de YouTube</b><small>Ajustes → Contenido → YouTube y cuota.</small>', { cls:'info' }); else ytm(q); };
  async function run(key, fn) {
    if (busy) return; busy = key; render();
    try { await fn(); } catch (e) { toast(`<b>No pude buscarlo</b><small>${esc(niceErr(e.message || ''))}</small>`, { cls:'info' }); }
    busy = ''; render();
  }
  function playTema(b, i) {
    const [t] = b.t[i], q = `${base(b)} ${t}`;
    if (!db.key) return sinClave(q);
    run('t' + i, async () => { const x = await findId(q, 'video'); if (!x) throw new Error('No encontré ese tema en YouTube.');
      Musica.play({ id:`odob-${hash(b.n)}-${i}`, kind:'video', ref:x.id, name:t, by:b.n, thumb:x.thumb }); });
  }
  function playTodos(b) {
    if (!db.key) return sinClave(base(b));
    run('all', async () => {
      const xs = []; for (const [t] of b.t) { try { const x = await findId(`${base(b)} ${t}`, 'video'); if (x) xs.push(x); } catch (e) { if (!xs.length) throw e; } }
      if (!xs.length) throw new Error('No encontré los temas en YouTube.');
      Musica.play({ id:`odob-${hash(b.n)}-all`, kind:'list', ids:xs.map(x => x.id), name:`${b.n}: temas clave`, by:b.n, thumb:xs[0].thumb });
    });
  }
  function playDisco(b) {
    const [al, yr] = b.a, q = yr ? `${base(b)} ${al}` : `${base(b)} grandes éxitos`;
    if (!db.key) return sinClave(q);
    run('disco', async () => { const x = await findId(q, 'playlist'); if (!x) throw new Error('No encontré el disco en YouTube.');
      Musica.play({ id:`odob-${hash(b.n)}-disco`, kind:'playlist', ref:x.id, name:yr ? al : x.t, by:b.n, thumb:x.thumb }); });
  }
  function marcar(no, b) {
    const s = S0(); s.oido = { ...(s.oido || {}), [no]:Date.now() }; save();
    const got = typeof Figus !== 'undefined' && Figus.banda ? Figus.banda(no, b.n, PREMIO) : 0;
    toast(got ? `<b>🎸 ¡Banda escuchada! +${got} vaccoins</b><small>${esc(b.n)} · se sumaron a tu Colección.</small>` : `<b>🎸 Anotada: ${esc(b.n)}</b>`, { cls:'info', ms:4000 });
    render();
  }
  function like(n, v) { const s = S0(); s.like = { ...(s.like || {}) }; s.like[n] = s.like[n] === v ? 0 : v; save(); render(); }

  /* ---------- pantalla ---------- */
  const hook = b => (b.s.match(/^[^.:]+[.:]?/) || [b.s])[0];
  function duelo(r) {
    const card = n => { const b = byN(n), v = skips(n);
      return `<div class="odpick"><div class="odpe">${b.e}</div><span class="odchip">${esc(b.g)}</span><h3>${esc(b.n)}</h3>
        <small class="mut">📍 ${esc(b.o)} · 🗓️ ${esc(b.y)}</small><p>${esc(hook(b))}</p>
        ${v ? `<span class="odback">↩ Vuelve por ${v + 1}ª vez${v + 1 >= MAXV ? ' · última oportunidad' : ''}</span>` : ''}
        <button class="pri" data-odp="${esc(n)}">Elegir esta</button></div>`; };
    return `<div class="odhero odduel"><div class="odtxt"><small>ONE DAY, ONE BAND · RONDA ${roundNo(r)}${r.d < ymd() ? ' · TE ESTÁ ESPERANDO' : ''}</small><h2>¿Cuál escuchamos hoy?</h2>
        <p class="odfecha">La que no elijas vuelve mañana contra otra (hasta ${MAXV} veces).</p></div></div>
      <div class="odpicks">${card(r.a)}<div class="odvs">VS</div>${card(r.b)}</div>`;
  }
  function ficha(b, no, r) {
    const ok = no && listened(no), lk = S0().like?.[b.n] || 0, H = current();
    const otra = r && r.b ? (r.p === r.a ? r.b : r.a) : null, ov = otra ? skips(otra) : 0;
    const btn = (key, txt) => busy === key ? '⏳ Buscando…' : txt;
    const fecha = r ? new Date(r.d + 'T12:00:00').toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' }).replace(/^./, c => c.toUpperCase()) : '';
    return `
      <div class="odhero">
        <div class="odtxt"><small>ONE DAY, ONE BAND${no ? ` · RONDA ${no}` : ''}${r === H ? ' · HOY' : ''}${!r ? ' · SE FUE SIN ELEGIR' : ''}</small>
          <h2>${b.e} ${esc(b.n)}</h2>
          <div class="odmeta"><span class="odchip">${esc(b.g)}</span><span>📍 ${esc(b.o)}</span><span>🗓️ ${esc(b.y)}</span></div>
          <p class="odfecha">${fecha}</p>
          <div class="btns"><button class="pri" data-od="all">${btn('all', '▶ Escuchar los temas clave')}</button>
            <button data-od="disco">${btn('disco', '💿 Disco para arrancar')}</button>
            ${Device.mode === 'tv' ? '' : '<button data-od="ytm">↗ YouTube Music</button>'}</div></div></div>
      <div class="odgrid">
        <div class="box odcol">
          <h3>👥 Quiénes</h3><p>${esc(b.m)}</p>
          <h3>📖 La historia</h3><p>${esc(b.h)}</p>
          <h3>🔊 Cómo suena</h3><p>${esc(b.s)}</p>
          <h3>💡 Dato curioso</h3><p>${esc(b.c)}</p>
        </div>
        <div class="odcol">
          <div class="box odstart"><h3>💿 Para arrancar</h3><b>${esc(b.a[0])}${b.a[1] ? ` <span class="mut">(${b.a[1]})</span>` : ''}</b><p>${esc(b.a[2])}</p></div>
          <div class="box"><h3>🎵 Temas clave</h3><div class="odtemas">${b.t.map(([t, al], i) => `<button class="odtema" data-odt="${i}"><span class="odnum">${busy === 't' + i ? '⏳' : '▶'}</span><span><b>${esc(t)}</b>${al ? `<small>${esc(al)}</small>` : ''}</span></button>`).join('')}</div></div>
          ${b.d.length ? `<div class="box"><h3>📀 Discografía</h3><div class="oddisc">${b.d.map(([t, y]) => `<div><span>${y}</span><b>${esc(t)}</b></div>`).join('')}</div></div>` : ''}
          <div class="box"><h3>➡️ Si te gusta, seguí con</h3><p>${esc(b.r)}</p></div>
        </div>
      </div>
      <div class="box odfin">
        ${!no ? '' : ok ? '<span class="odok">✅ Ya la escuchaste</span>' : `<button class="pri" data-od="oido">✅ La escuché (+${PREMIO} vaccoins)</button>`}
        <button data-odl="1" class="${lk === 1 ? 'on' : ''}">👍 Me gustó</button><button data-odl="-1" class="${lk === -1 ? 'on' : ''}">👎 No es lo mío</button>
        ${r === H && r.b && r.d === ymd() && !ok ? '<button data-odcambio>↺ Cambiar por la otra</button>' : ''}
        ${r === H && otra ? `<span class="mut odprox">${ov >= MAXV ? `<b>${esc(otra)}</b> ya pasó ${MAXV} veces: sale de la rotación.` : `Mañana vuelve <b>${esc(otra)}</b> (${ov + 1}/${MAXV}) contra una nueva.`}</span>` : ''}
        ${r !== H ? '<button data-odhoy>↩ Volver a la de hoy</button>' : ''}
      </div>`;
  }
  function archivo() {
    const R = rounds().filter(r => r.p), ret = retired();
    return `<h2 class="sec">🗂️ Las que elegiste</h2>
      <div class="odarch">${[...R].reverse().map(r => { const no = roundNo(r), x = byN(r.p); if (!x) return ''; return `<button class="odday ${sel === r.p ? 'on' : ''}" data-odn="${esc(r.p)}"><small>Ronda ${no}${listened(no) ? ' ✅' : ''}${S0().like?.[r.p] === 1 ? ' 👍' : ''}</small><b>${x.e} ${esc(x.n)}</b><span>${esc(x.g)}</span></button>`; }).join('')}</div>
      ${ret.length ? `<h2 class="sec">🚪 Se fueron sin elegir</h2><div class="odarch">${ret.map(n => { const x = byN(n); return x ? `<button class="odday dim ${sel === n ? 'on' : ''}" data-odn="${esc(n)}"><small>La salteaste ${MAXV} veces</small><b>${x.e} ${esc(x.n)}</b><span>${esc(x.g)}</span></button>` : ''; }).join('')}</div>` : ''}
      <p class="mut odnota">${BANDAS.length} bandas en el catálogo · quedan ${queue().length} sin aparecer. Los temas se buscan en YouTube la primera vez (100 de tu cuota cada uno) y después quedan guardados. Suenan en el reproductor de la barra de abajo.</p>`;
  }
  function render() {
    const v = $('v-banda'); if (!v) return;
    const H = current();
    let html, b = null, no = 0, r = null;
    if (sel) { r = rounds().find(x => x.p === sel) || null; b = byN(sel); no = r ? roundNo(r) : 0; }
    if (!b && !H.p) html = duelo(H);
    else { if (!b) { r = H; b = byN(H.p); no = roundNo(H); } html = ficha(b, no, r); }
    v.innerHTML = html + archivo();
    v.querySelectorAll('[data-odp]').forEach(x => x.onclick = () => pick(H, x.dataset.odp));
    if (b) {
      v.querySelector('[data-od="all"]').onclick = () => playTodos(b);
      v.querySelector('[data-od="disco"]').onclick = () => playDisco(b);
      v.querySelector('[data-od="ytm"]')?.addEventListener('click', () => ytm(base(b)));
      v.querySelector('[data-od="oido"]')?.addEventListener('click', () => marcar(no, b));
      v.querySelectorAll('[data-odt]').forEach(x => x.onclick = () => playTema(b, +x.dataset.odt));
      v.querySelectorAll('[data-odl]').forEach(x => x.onclick = () => like(b.n, +x.dataset.odl));
      v.querySelector('[data-odcambio]')?.addEventListener('click', () => pick(H, H.p === H.a ? H.b : H.a));
    }
    v.querySelectorAll('[data-odn]').forEach(x => x.onclick = () => { sel = x.dataset.odn === H.p ? null : x.dataset.odn; render(); v.scrollIntoView?.({ block:'start', behavior:'smooth' }); });
    v.querySelector('[data-odhoy]')?.addEventListener('click', () => { sel = null; render(); });
  }
  // para el bloque de Ahora
  function resumen() { const H = current(); return H.p ? { pick:byN(H.p), no:roundNo(H), ok:listened(roundNo(H)) } : { duel:[byN(H.a), byN(H.b)], no:roundNo(H) }; }
  return { render, resumen };
})();

/* 🏠 en Ahora: la banda del día (o el duelo para elegir) */
Inicio.add({ id:'banda', order:62, html() {
  const s = Banda.resumen();
  if (s.duel) { const [a, b] = s.duel; return `<h2 class="sec">🎸 One Day, One Band</h2><button class="inalb odin" data-odgo><span class="odinic">🆚</span><div><small>Ronda ${s.no} · elegí la de hoy</small><b>${esc(a.n)} o ${esc(b.n)}</b><em>${esc(a.g)} vs ${esc(b.g)}</em></div><i>▶</i></button>`; }
  const b = s.pick;
  return `<h2 class="sec">🎸 One Day, One Band</h2><button class="inalb odin" data-odgo><span class="odinic">${b.e}</span><div><small>Ronda ${s.no} · ${esc(b.g)}</small><b>${esc(b.n)}</b><em>${s.ok ? '✅ Ya la escuchaste' : 'Historia, disco para arrancar y temas clave'}</em></div><i>▶</i></button>`; },
  bind(el) { el.querySelector('[data-odgo]')?.addEventListener('click', () => Nav.go('banda')); } });
