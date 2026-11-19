/* =========================================================
   🎸 One Day, One Band (Escuchar → Banda del día)
   Cada día una banda: historia, sonido, disco para arrancar y temas clave para escuchar acá mismo.
   Las bandas están en banda-data.js (día 1 = 19/11/2026). Escucharla da 15 vaccoins (una vez por banda).
   ========================================================= */
const Banda = (() => {
  const START = new Date(2026, 10, 19), PREMIO = 15;
  const dayNum = (d = new Date()) => Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - START) / 864e5) + 1;
  const hoy = () => Math.max(1, dayNum());
  const bandOf = n => BANDAS[(n - 1) % BANDAS.length];
  const fechaOf = n => { const d = new Date(START); d.setDate(d.getDate() + n - 1); return d; };
  let sel = null, busy = '';
  const st = () => S.get('odob', { like:{} });
  const setSt = x => S.set('odob', x);
  const listened = n => (typeof Figus !== 'undefined' && Figus.bandaOk?.(n)) || !!st().oido?.[n];

  /* ---------- buscar en YouTube (con tu clave; cada búsqueda nueva 100 de cuota, después queda guardada para siempre) ---------- */
  const query = (b, tema) => `${b.q || b.n.replace(/\s*\(.*\)$/, '')} ${tema}`;
  async function findId(q, tipo) {
    const C = S.get('odobIds', {}), k = tipo + '|' + q.toLowerCase();
    if (C[k]) return C[k];
    const j = await Canales.yt('search', tipo === 'video'
      ? { part:'snippet', type:'video', videoCategoryId:'10', q, maxResults:1, regionCode:'AR' }
      : { part:'snippet', type:'playlist', q:q + ' álbum', maxResults:1, regionCode:'AR' });
    const r = j.items?.[0]; if (!r) return null;
    const x = { id:r.id.videoId || r.id.playlistId, t:r.snippet.title, by:(r.snippet.channelTitle || '').replace(/ - Topic$/, ''), thumb:r.snippet.thumbnails?.medium?.url || '' };
    C[k] = x; S.set('odobIds', C); return x;
  }
  const ytm = q => window.open('https://music.youtube.com/search?q=' + encodeURIComponent(q), '_blank');
  const sinClave = q => { if (Device.mode === 'tv') toast('<b>Para escucharla acá hace falta tu clave de YouTube</b><small>Ajustes → Contenido → YouTube y cuota.</small>', { cls:'info' }); else ytm(q); };
  async function run(key, fn) {
    if (busy) return; busy = key; render();
    try { await fn(); } catch (e) { toast(`<b>No pude buscarlo</b><small>${esc(niceErr(e.message || ''))}</small>`, { cls:'info' }); }
    busy = ''; render();
  }
  function playTema(n, i) {
    const b = bandOf(n), [t] = b.t[i], q = query(b, t);
    if (!db.key) return sinClave(q);
    run('t' + i, async () => { const x = await findId(q, 'video'); if (!x) throw new Error('No encontré ese tema en YouTube.');
      Musica.play({ id:`odob-${n}-${i}`, kind:'video', ref:x.id, name:t, by:b.n, thumb:x.thumb }); });
  }
  function playTodos(n) {
    const b = bandOf(n);
    if (!db.key) return sinClave(b.q || b.n);
    run('all', async () => {
      const xs = []; for (const [t] of b.t) { try { const x = await findId(query(b, t), 'video'); if (x) xs.push(x); } catch (e) { if (!xs.length) throw e; } }
      if (!xs.length) throw new Error('No encontré los temas en YouTube.');
      Musica.play({ id:`odob-${n}-all`, kind:'list', ids:xs.map(x => x.id), name:`${b.n}: temas clave`, by:b.n, thumb:xs[0].thumb });
    });
  }
  function playDisco(n) {
    const b = bandOf(n), [al, yr] = b.a, generic = !yr;
    const q = generic ? `${b.q || b.n} grandes éxitos` : `${b.q || b.n.replace(/\s*\(.*\)$/, '')} ${al}`;
    if (!db.key) return sinClave(q);
    run('disco', async () => { const x = await findId(q, 'playlist'); if (!x) throw new Error('No encontré el disco en YouTube.');
      Musica.play({ id:`odob-${n}-disco`, kind:'playlist', ref:x.id, name:generic ? x.t : al, by:b.n, thumb:x.thumb }); });
  }

  function marcar(n) {
    const b = bandOf(n), s = st(); s.oido = { ...(s.oido || {}), [n]:Date.now() }; setSt(s);
    const got = typeof Figus !== 'undefined' && Figus.banda ? Figus.banda(n, b.n, PREMIO) : 0;
    toast(got ? `<b>🎸 ¡Banda escuchada! +${got} vaccoins</b><small>${esc(b.n)} · se sumaron a tu Colección.</small>` : `<b>🎸 Anotada: ${esc(b.n)}</b>`, { cls:'info', ms:4000 });
    render();
  }
  function like(n, v) { const s = st(); s.like = { ...(s.like || {}) }; s.like[n] = s.like[n] === v ? 0 : v; setSt(s); render(); }

  /* ---------- pantalla ---------- */
  function render() {
    const v = $('v-banda'); if (!v) return;
    const H = hoy(), n = sel && sel <= H ? sel : H, b = bandOf(n), repaso = n > BANDAS.length, ok = listened(n), lk = st().like?.[n] || 0;
    const fecha = fechaOf(n).toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' }).replace(/^./, c => c.toUpperCase());
    const prox = bandOf(H + 1);
    const btn = (key, txt) => busy === key ? '⏳ Buscando…' : txt;
    v.innerHTML = `
      <div class="odhero">
        <div class="odtxt"><small>ONE DAY, ONE BAND · DÍA ${n}${repaso ? ' · REPASO' : ''}${n === H ? ' · HOY' : ''}</small>
          <h2>${b.e} ${esc(b.n)}</h2>
          <div class="odmeta"><span class="odchip">${esc(b.g)}</span><span>📍 ${esc(b.o)}</span><span>🗓️ ${esc(b.y)}</span></div>
          <p class="mut odfecha">${fecha}</p>
          <div class="btns"><button class="pri" data-od="all">${btn('all', '▶ Escuchar los temas clave')}</button>
            <button data-od="disco">${btn('disco', '💿 Disco para arrancar')}</button>
            ${Device.mode === 'tv' ? '' : `<button data-od="ytm">↗ YouTube Music</button>`}</div></div></div>
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
        ${ok ? '<span class="odok">✅ Ya la escuchaste</span>' : `<button class="pri" data-od="oido">✅ La escuché (+${PREMIO} vaccoins)</button>`}
        <button data-odl="1" class="${lk === 1 ? 'on' : ''}">👍 Me gustó</button><button data-odl="-1" class="${lk === -1 ? 'on' : ''}">👎 No es lo mío</button>
        ${n === H ? `<span class="mut odprox">Mañana: algo de <b>${esc(prox.g)}</b> ${prox.e}</span>` : `<button data-odhoy>↩ Volver a la de hoy</button>`}
      </div>
      <h2 class="sec">🗂️ Bandas anteriores</h2>
      <div class="odarch">${Array.from({ length:H }, (_, i) => H - i).map(d => { const x = bandOf(d); return `<button class="odday ${d === n ? 'on' : ''}" data-odd="${d}"><small>Día ${d}${listened(d) ? ' ✅' : ''}${st().like?.[d] === 1 ? ' 👍' : ''}</small><b>${x.e} ${esc(x.n)}</b><span>${esc(x.g)}</span></button>`; }).join('')}</div>
      <p class="mut odnota">Los temas se buscan en YouTube la primera vez (100 de tu cuota cada uno) y después quedan guardados. Suenan en el reproductor de la barra de abajo.</p>`;
    v.querySelector('[data-od="all"]').onclick = () => playTodos(n);
    v.querySelector('[data-od="disco"]').onclick = () => playDisco(n);
    v.querySelector('[data-od="ytm"]')?.addEventListener('click', () => ytm(b.q || b.n));
    v.querySelector('[data-od="oido"]')?.addEventListener('click', () => marcar(n));
    v.querySelectorAll('[data-odt]').forEach(x => x.onclick = () => playTema(n, +x.dataset.odt));
    v.querySelectorAll('[data-odl]').forEach(x => x.onclick = () => like(n, +x.dataset.odl));
    v.querySelectorAll('[data-odd]').forEach(x => x.onclick = () => { sel = +x.dataset.odd; render(); v.scrollIntoView?.({ block:'start', behavior:'smooth' }); });
    v.querySelector('[data-odhoy]')?.addEventListener('click', () => { sel = null; render(); });
  }
  return { render, hoy, bandOf, listened };
})();

/* 🏠 en Ahora: la banda del día */
Inicio.add({ id:'banda', order:62, html() {
  const n = Banda.hoy(), b = Banda.bandOf(n);
  return `<h2 class="sec">🎸 One Day, One Band</h2><button class="inalb odin" data-odgo><span class="odinic">${b.e}</span><div><small>Día ${n} · ${esc(b.g)}</small><b>${esc(b.n)}</b><em>${Banda.listened(n) ? '✅ Ya la escuchaste' : 'Historia, disco para arrancar y temas clave'}</em></div><i>▶</i></button>`; },
  bind(el) { el.querySelector('[data-odgo]')?.addEventListener('click', () => Nav.go('banda')); } });
