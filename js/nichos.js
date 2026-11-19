/* =========================================================
   🧭 Nichos: para cuando estás aburrido y no sabés qué ver o escuchar.
   - Elegís cuánto tiempo tenés y qué tan raro lo querés, y te abre algo al azar
     de tu propia base de links (videos perdidos, discos raros, artículos viejos, curiosidades).
   - La base la vas llenando vos (pegás un link y listo); se sincroniza entre aparatos (db.nichos).
   - Prefiere lo que nunca abriste o hace mucho que no abrís.
   ========================================================= */
const Nichos = (() => {
  const KIND = { video:['🎬', 'Video'], disco:['💿', 'Disco'], articulo:['📜', 'Artículo'], curio:['🦉', 'Curiosidad'] };
  const TIME = [['5', '⚡ 5 min', 7], ['15', '☕ 15 min', 20], ['30', '🍿 Media hora', 40], ['60', '🛋️ Una hora o más', 1e9]];
  const RARE = [['1', '🟢 Conocido'], ['2', '🟡 Raro'], ['3', '🔴 Rarísimo'], ['', '🎲 Me da igual']];
  const WHAT = [['', 'Todo'], ['ver', '👀 Ver'], ['escuchar', '🎧 Escuchar'], ['leer', '📖 Leer']];
  const WHATK = { ver:['video', 'curio'], escuchar:['disco'], leer:['articulo', 'curio'] };
  const tv = () => Device.mode === 'tv';
  let pick = null, edit = null, q = '', got = {};
  const L = () => { if (!Array.isArray(db.nichos)) db.nichos = []; return db.nichos; };
  const f = () => ({ t:'15', r:'', w:'', ...S.get('nichosF', {}) });
  const ytId = u => (String(u).match(/(?:youtu\.be\/|v=|\/shorts\/|\/live\/|\/embed\/)([\w-]{11})/) || [])[1] || '';
  const guessKind = u => /youtu|vimeo|twitch|kick\.com/.test(u) ? 'video' : /spotify\.com\/album|bandcamp|music\.apple|deezer|soundcloud|discogs|rateyourmusic/.test(u) ? 'disco' : 'articulo';
  const isoMin = d => { const m = String(d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? Math.max(1, Math.round((+m[1] || 0) * 60 + (+m[2] || 0) + (+m[3] || 0) / 60)) : 0; };
  const dur = m => !m ? '' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');

  // lo que entra con los filtros; el que hace más que no abrís pesa más
  function matches(F = f()) {
    const tmax = TIME.find(x => x[0] === F.t)?.[2] ?? 1e9, ks = WHATK[F.w];
    return L().filter(x => (!F.r || String(x.r || 2) === F.r) && (!ks || ks.includes(x.k)) && (!x.min || x.min <= tmax || F.t === '60'));
  }
  function roll(not) {
    const M = matches().filter(x => x.id !== not); if (!M.length) return null;
    const w = M.map(x => !x.seen ? 6 : Math.min(5, 1 + (Date.now() - (x.last || 0)) / 6048e5)), tot = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot; for (let i = 0; i < M.length; i++) { r -= w[i]; if (r <= 0) return M[i]; } return M[M.length - 1];
  }
  function open(x) {
    x.seen = (x.seen || 0) + 1; x.last = Date.now(); save();
    const v = ytId(x.url);
    if (v) return Player.play({ uid:'sv_' + v, platform:'youtube', ref:{ video:v }, name:x.t || 'Nicho' });
    if (tv()) return toast(`<b>Este link se abre en el celu o la compu</b><small>${esc(x.url)}</small>`, { cls:'info', ms:8000 });
    window.open(x.url, '_blank', 'noopener');
  }

  async function lookup(u) {   // título y duración solos (YouTube con tu clave; si no, noembed)
    const v = ytId(u), o = {};
    if (v && db.key) try { const j = await Canales.yt('videos', { part:'snippet,contentDetails', id:v }); const it = j.items?.[0]; if (it) { o.t = it.snippet.title; o.min = isoMin(it.contentDetails.duration); o.by = it.snippet.channelTitle; } } catch {}
    if (!o.t) try { const j = await (await fetch('https://noembed.com/embed?url=' + encodeURIComponent(u))).json(); if (j.title) { o.t = j.title; o.by = j.author_name || ''; } } catch {}
    return o;
  }

  function card(x, big) {
    const [ic, kn] = KIND[x.k] || KIND.articulo, r = +x.r || 2;
    return `<div class="nchit ${big ? 'big' : ''}"><div class="nchic">${ic}</div><div class="nchtx"><b>${esc(x.t || x.url)}</b>
      <small>${kn}${x.min ? ' · ⏱ ' + dur(x.min) : ''} · ${['', '🟢 conocido', '🟡 raro', '🔴 rarísimo'][r]}${x.by ? ' · ' + esc(x.by) : ''}${x.seen ? ` · visto ${x.seen}×` : ' · 🆕 sin abrir'}</small>
      ${x.note ? `<p>${esc(x.note)}</p>` : ''}</div></div>`;
  }


  // 🌱 base inicial armada por Claude (rincones de Reddit tipo r/ObscureMedia y r/InternetIsBeautiful, archivos, discos de culto).
  // Se suma una sola vez a tu base (después es toda tuya: editás o borrás lo que quieras). Discos: búsqueda en YouTube Music.
  const YM = q => 'https://music.youtube.com/search?q=' + encodeURIComponent(q), W = t => 'https://es.wikipedia.org/wiki/' + t;
  const SEED_V = 1, SEED = [
    // 🎬 videos perdidos y archivos
    ['video', 'A Trip Down Market Street (1906): San Francisco cuatro días antes del terremoto', 'https://archive.org/details/TripDown1905', 13, 2, 'Película filmada desde un tranvía. Mirá los autos, los chicos y la gente cruzando como si nada.'],
    ['video', 'Powers of Ten (1977): un picnic y el universo en 10 minutos', 'https://www.youtube.com/watch?v=0fKBhvDjuy0', 9, 1, 'Corto de Charles y Ray Eames que cambia de escala de a 10 veces.'],
    ['video', 'Hans Rosling: 200 países, 200 años, 4 minutos', 'https://www.youtube.com/watch?v=jbkSRLYSojo', 5, 1, 'La historia del mundo en un gráfico que se mueve.'],
    ['video', 'Archivo DiFilm: noticieros y películas caseras de la Argentina del siglo XX', 'https://www.youtube.com/user/archivodichiara', 30, 2, 'El archivo fílmico privado más grande del país (Florencio Varela). Buscá tu barrio o un año.'],
    ['video', 'Prelinger Archives: películas educativas y publicitarias viejas', 'https://archive.org/details/prelinger', 30, 3, 'Miles de cortos institucionales de los años 30 a 70, gratis y de dominio público.'],
    ['video', 'Astronaut.io: videos de YouTube recién subidos con casi cero vistas', 'https://astronaut.io', 15, 3, 'Momentos de vidas ajenas: cumpleaños, ensayos, gente probando la cámara.'],
    ['video', 'Petit Tube: un video al azar que casi nadie vio', 'https://www.petittube.com', 5, 3, 'Apretás y sale cualquier cosa. A veces es una joya.'],
    ['video', 'Historias Innecesarias: archivo de la tele argentina con humor', 'https://www.youtube.com/results?search_query=Historias+Innecesarias', 15, 2, 'Rescates de la tele y la publicidad argentina de otras décadas.'],
    ['video', 'r/ObscureMedia: lo más votado de todos los tiempos', 'https://www.reddit.com/r/ObscureMedia/top/?t=all', 30, 3, 'Videos caseros, comerciales raros y rarezas de la TV que la gente desenterró.'],
    // 💿 discos raros o de culto
    ['disco', 'Mort Garson – Mother Earth’s Plantasia (1976)', YM('Mort Garson Mother Earth\'s Plantasia'), 31, 2, 'Música electrónica hecha "para las plantas". Se regalaba con la compra de una planta.'],
    ['disco', 'Hiroshi Yoshimura – Music for Nine Post Cards (1982)', YM('Hiroshi Yoshimura Music for Nine Post Cards'), 32, 3, 'Ambient japonés para un museo. Ideal para bajar un cambio.'],
    ['disco', 'Moondog – Moondog (1969)', YM('Moondog 1969 album'), 33, 3, 'Un músico ciego que vivía en una esquina de Nueva York vestido de vikingo.'],
    ['disco', 'Arthur Russell – World of Echo (1986)', YM('Arthur Russell World of Echo'), 72, 3, 'Chelo y voz con eco. Raro y hermoso.'],
    ['disco', 'Linda Perhacs – Parallelograms (1970)', YM('Linda Perhacs Parallelograms'), 34, 3, 'Una dentista que grabó un solo disco de folk psicodélico y desapareció 30 años.'],
    ['disco', 'Rodriguez – Cold Fact (1970)', YM('Rodriguez Cold Fact'), 33, 2, 'Fracasó en EE.UU. y fue enorme en Sudáfrica sin que él lo supiera.'],
    ['disco', 'Shuggie Otis – Inspiration Information (1974)', YM('Shuggie Otis Inspiration Information'), 36, 2, 'Soul casero adelantado a su época.'],
    ['disco', 'Os Mutantes – Os Mutantes (1968)', YM('Os Mutantes 1968'), 36, 2, 'Psicodelia brasileña del tropicalismo.'],
    ['disco', 'Midori Takada – Through the Looking Glass (1983)', YM('Midori Takada Through the Looking Glass'), 41, 3, 'Percusión minimalista que resucitó gracias al algoritmo de YouTube.'],
    ['disco', 'Agustín Pereyra Lucena – Agustín Pereyra Lucena (1970)', YM('Agustin Pereyra Lucena 1970'), 33, 3, 'Bossa nova hecha en Buenos Aires, joya poco conocida.'],
    ['disco', 'Arco Iris – Sudamérica o el regreso a la aurora (1972)', YM('Arco Iris Sudamerica o el regreso a la aurora'), 75, 3, 'Ópera rock de Santaolalla y compañía, doble y conceptual.'],
    ['disco', 'Aquelarre – Candiles (1972)', YM('Aquelarre Candiles'), 40, 3, 'Rock progresivo argentino de Héctor Starc y Emilio del Guercio.'],
    ['disco', 'Invisible – El jardín de los presentes (1976)', YM('Invisible El jardin de los presentes'), 40, 2, 'Spinetta en su etapa más rara y fina.'],
    ['disco', 'Billy Bond y La Pesada del Rock and Roll – Vol. 1 (1971)', YM('Billy Bond y La Pesada del Rock and Roll 1971'), 40, 3, 'La banda-zapada donde pasaron Spinetta, Pappo y Alejandro Medina.'],
    ['disco', 'Manal – Manal (1970)', YM('Manal 1970 album'), 37, 2, 'El blues porteño fundacional.'],
    ['disco', 'Raúl Porchetto – Reina Madre (1983)', YM('Raul Porchetto Reina Madre'), 40, 2, 'Disco grande de los 80 que hoy casi nadie pone.'],
    // 📜 artículos viejos y casos raros
    ['articulo', 'La epidemia de baile de 1518', W('Epidemia_de_baile_de_1518'), 7, 2, 'En Estrasburgo cientos de personas bailaron sin parar durante semanas.'],
    ['articulo', 'La inundación de melaza de Boston (1919)', W('Inundaci%C3%B3n_de_melaza_de_Boston'), 7, 2, 'Una ola de melaza por las calles. Pasó de verdad.'],
    ['articulo', 'La Gran Guerra del Emú (Australia, 1932)', 'https://en.wikipedia.org/wiki/Emu_War', 7, 2, 'El ejército contra las aves. Ganaron las aves.'],
    ['articulo', 'La epidemia de risa de Tanganica (1962)', W('Epidemia_de_risa_de_Tanganica'), 5, 3, 'Una risa contagiosa que cerró escuelas durante meses.'],
    ['articulo', 'El hackeo de Max Headroom (Chicago, 1987)', 'https://en.wikipedia.org/wiki/Max_Headroom_signal_hijacking', 10, 3, 'Alguien se metió en dos canales de TV con una máscara. Nunca lo encontraron.'],
    ['articulo', 'Las baldosas de Toynbee', W('Baldosas_de_Toynbee'), 7, 3, 'Mensajes misteriosos incrustados en el asfalto de varias ciudades, incluida Buenos Aires.'],
    ['articulo', 'La señal Wow! (1977)', W('Se%C3%B1al_Wow!'), 5, 2, 'La señal de radio del espacio que nadie pudo explicar.'],
    ['articulo', 'El misterio del Mary Celeste', W('Mary_Celeste'), 7, 1, 'Un barco encontrado navegando solo, sin nadie a bordo.'],
    ['articulo', 'El incidente del paso Diátlov', W('Incidente_del_paso_Di%C3%A1tlov'), 10, 2, 'Nueve excursionistas, una carpa cortada desde adentro.'],
    ['articulo', 'Villa Epecuén: el pueblo que se tragó la laguna', W('Villa_Epecu%C3%A9n'), 7, 2, 'Un balneario bonaerense que quedó 25 años bajo el agua y hoy es un pueblo fantasma.'],
    ['articulo', 'Rufina Cambaceres, la leyenda de la Recoleta', W('Rufina_Cambaceres'), 5, 2, 'La chica que habría sido enterrada viva en 1902.'],
    ['articulo', 'La Difunta Correa', W('Difunta_Correa'), 5, 1, 'De dónde salen las botellas de agua al costado de las rutas.'],
    ['articulo', 'Wikipedia: los artículos más raros', 'https://en.wikipedia.org/wiki/Wikipedia:Unusual_articles', 30, 2, 'La lista oficial de rarezas de Wikipedia. Pozo sin fondo.'],
    ['articulo', 'Lost Media Wiki: lo que se perdió y se busca', 'https://lostmediawiki.com', 30, 3, 'Programas, juegos y películas perdidos, y cómo la gente los rastrea.'],
    // 🦉 curiosidades
    ['curio', 'Radio Garden: radios de todo el mundo girando un globo', 'https://radio.garden', 15, 1, 'Tocás un puntito y escuchás una radio de ese lugar, en vivo.'],
    ['curio', 'Radiooooo: música por país y década', 'https://radiooooo.com', 30, 2, 'Elegís Japón 1970 o Argentina 1950 y suena lo de esa época.'],
    ['curio', 'Drive & Listen: manejar por ciudades con su radio', 'https://drivenlisten.com', 15, 2, 'Un viaje en auto por Tokio o Buenos Aires con la radio local.'],
    ['curio', 'WindowSwap: la ventana de otra persona en otro país', 'https://www.window-swap.com', 5, 2, 'Videos tranquilos desde ventanas de gente de todo el mundo.'],
    ['curio', 'The Deep Sea: bajar hasta el fondo del océano', 'https://neal.fun/deep-sea/', 5, 1, 'Scrolleás y vas bajando metro a metro con los bichos de cada profundidad.'],
    ['curio', 'La Biblioteca de Babel', 'https://libraryofbabel.info', 15, 3, 'La biblioteca infinita de Borges, hecha de verdad: contiene todo texto posible.'],
    ['curio', 'Musicmap: el árbol genealógico de la música', 'https://musicmap.info', 15, 2, 'De dónde viene cada género, con ejemplos para escuchar.'],
    ['curio', 'Earth: los vientos del planeta en vivo', 'https://earth.nullschool.net', 5, 2, 'Un globo que muestra el viento y las corrientes ahora mismo.'],
    ['curio', 'Atlas Obscura: lugares raros del mundo (y de Argentina)', 'https://www.atlasobscura.com/things-to-do/argentina', 15, 1, 'Rincones extraños para conocer o soñar.'],
    ['curio', 'One Terabyte of Kilobyte Age: la web de GeoCities', 'https://oneterabyteofkilobyteage.tumblr.com', 15, 3, 'Capturas de páginas caseras de los 90 que ya no existen.'],
    ['curio', 'The Pudding: historias contadas con datos', 'https://pudding.cool', 15, 2, 'Ensayos visuales sobre música, idiomas, cine y cosas cotidianas.'],
    ['curio', 'r/InternetIsBeautiful: lo más votado', 'https://www.reddit.com/r/InternetIsBeautiful/top/?t=all', 15, 1, 'Herramientas y páginas lindas que la gente fue encontrando.'],
  ];
  function seed() {
    if ((+db.nichosSeed || 0) >= SEED_V) return;
    const have = new Set(L().map(x => x.url)), now = Date.now();
    SEED.forEach(([k, t, url, min, r, note], i) => { if (!have.has(url)) L().push({ id:'s' + SEED_V + '-' + i, url, t, k, min, r, note, by:'Sugerido por FUNVS', seen:0, last:0, at:now - i }); });
    db.nichosSeed = SEED_V; save();
  }
  function render() {
    const v = $('v-nichos'); if (!v) return;
    seed();
    const F = f(), M = matches(F), all = L();
    const chips = (list, key) => list.map(([k, t]) => `<button class="chip ${F[key] === k ? 'on' : ''}" data-nf="${key}|${k}">${t}</button>`).join('');
    const shown = all.filter(x => !q || norm(x.t + ' ' + x.url + ' ' + (x.note || '') + ' ' + (x.by || '')).includes(norm(q)));
    v.innerHTML = `<h2 class="sec">🧭 Nichos <small class="mut">para cuando no sabés qué ver o escuchar</small></h2>
      <div class="nchpick">
        <div class="nchrow"><span>¿Cuánto tiempo tenés?</span><div class="chips">${chips(TIME, 't')}</div></div>
        <div class="nchrow"><span>¿Qué tan raro?</span><div class="chips">${chips(RARE, 'r')}</div></div>
        <div class="nchrow sm"><span>¿Qué?</span><div class="chips">${chips(WHAT, 'w')}</div></div>
        <button class="pri nchgo" data-ngo ${M.length ? '' : 'disabled'}>🎲 Sorprendeme <small>${M.length} posible${M.length === 1 ? '' : 's'}</small></button>
        ${!all.length ? '<p class="mut">Tu base está vacía: pegá abajo links de cosas raras que encuentres (videos perdidos, discos, artículos, curiosidades) y después el 🎲 te elige.</p>' : !M.length ? '<p class="mut">Nada entra con esos filtros. Probá con más tiempo o “Me da igual”.</p>' : ''}
      </div>
      ${pick ? `<div class="nchres">${card(pick, true)}<div class="btns"><button class="pri" data-nopen>${ytId(pick.url) ? '▶ Ver ahora' : tv() ? '📱 Ver el link' : '↗ Abrir'}</button><button data-nagain>🎲 Otro</button><button data-nedit="${esc(pick.id)}">✎</button><span class="sp"></span><button data-nx>✕</button></div></div>` : ''}
      <h2 class="sec">➕ Sumar a la base</h2>
      <div class="nchadd box">
        <div class="nchf"><input id="nchUrl" placeholder="Pegá un link (YouTube, Spotify, Bandcamp, un artículo…)" value="${esc(edit?.url || '')}"><button data-nlook>🔎</button></div>
        <div class="nchf"><input id="nchT" placeholder="Título (se completa solo si se puede)" value="${esc(edit?.t || '')}"></div>
        <div class="nchf3">
          <label>Tipo<select id="nchK">${Object.entries(KIND).map(([k, [ic, n]]) => `<option value="${k}" ${(edit?.k || '') === k ? 'selected' : ''}>${ic} ${n}</option>`).join('')}</select></label>
          <label>Duración (min)<input id="nchMin" type="number" min="0" max="999" value="${edit?.min || ''}" placeholder="¿?"></label>
          <label>Rareza<select id="nchR">${RARE.slice(0, 3).map(([k, t]) => `<option value="${k}" ${String(edit?.r || 2) === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
        <div class="nchf"><input id="nchNote" placeholder="Por qué vale la pena (opcional)" value="${esc(edit?.note || '')}"></div>
        <div class="btns">${edit?.id ? '<button data-ncancel>Cancelar</button>' : ''}<span class="sp"></span><button class="pri" data-nsave>${edit?.id ? 'Guardar cambios' : '＋ Sumar'}</button></div>
      </div>
      ${all.length ? `<h2 class="sec">📚 Tu base <small class="mut">${all.length}</small></h2>
        <input class="nchq" id="nchQ" placeholder="Buscar en la base…" value="${esc(q)}">
        <div class="nchlist">${shown.map(x => `<div class="nchli">${card(x)}<div class="btns"><button data-nopen1="${esc(x.id)}" title="Abrir">▶</button><button data-nedit="${esc(x.id)}" title="Editar">✎</button><button data-ndel="${esc(x.id)}" title="Borrar">🗑</button></div></div>`).join('') || '<div class="empty">Nada con esa búsqueda.</div>'}</div>` : ''}`;
    bind(v);
  }

  function bind(v) {
    const byId = id => L().find(x => x.id === id);
    v.querySelectorAll('[data-nf]').forEach(b => b.onclick = () => { const [k, val] = b.dataset.nf.split('|'); S.set('nichosF', { ...f(), [k]:val }); pick = null; render(); });
    v.querySelector('[data-ngo]')?.addEventListener('click', () => { pick = roll(); render(); v.querySelector('.nchres [data-nopen]')?.focus(); });
    v.querySelector('[data-nagain]')?.addEventListener('click', () => { pick = roll(pick?.id) || pick; render(); v.querySelector('.nchres [data-nopen]')?.focus(); });
    v.querySelector('[data-nopen]')?.addEventListener('click', () => { open(pick); render(); });
    v.querySelector('[data-nx]')?.addEventListener('click', () => { pick = null; render(); });
    v.querySelectorAll('[data-nopen1]').forEach(b => b.onclick = () => { const x = byId(b.dataset.nopen1); if (x) { open(x); render(); } });
    v.querySelectorAll('[data-nedit]').forEach(b => b.onclick = () => { edit = { ...byId(b.dataset.nedit) }; render(); $('nchUrl')?.scrollIntoView({ block:'center' }); });
    v.querySelectorAll('[data-ndel]').forEach(b => b.onclick = () => { const x = byId(b.dataset.ndel); if (!x || !confirm(`¿Borrar «${x.t || x.url}» de la base?`)) return; db.nichos = L().filter(y => y.id !== x.id); if (pick?.id === x.id) pick = null; save(); render(); });
    v.querySelector('[data-ncancel]')?.addEventListener('click', () => { edit = null; render(); });
    const url = $('nchUrl');
    const look = async () => { const u = url.value.trim(); if (!/^https?:\/\//.test(u)) return; const o = await lookup(u);
      if (o.t && !$('nchT').value) $('nchT').value = o.t; if (o.min && !$('nchMin').value) $('nchMin').value = o.min; if (!edit?.k) $('nchK').value = guessKind(u); got = { u, by:o.by || '' }; };
    url.onchange = look; url.onpaste = () => setTimeout(look, 30); v.querySelector('[data-nlook]').onclick = look;
    $('nchQ')?.addEventListener('input', e => { q = e.target.value; const p = e.target.selectionStart; render(); const n = $('nchQ'); n.focus(); n.setSelectionRange(p, p); });
    v.querySelector('[data-nsave]').onclick = () => {
      const u = url.value.trim(); if (!/^https?:\/\//.test(u)) return toast('<b>Pegá un link que empiece con http</b>', { cls:'info' });
      const x = { id:edit?.id || 'n' + uid(), url:u, t:$('nchT').value.trim(), k:$('nchK').value, min:+$('nchMin').value || 0, r:+$('nchR').value || 2, note:$('nchNote').value.trim(),
        by:(got.u === u && got.by) || edit?.by || '', seen:edit?.seen || 0, last:edit?.last || 0, at:edit?.at || Date.now() };
      const i = L().findIndex(y => y.id === x.id);
      if (i < 0 && L().some(y => y.url === u)) return toast('<b>Ese link ya está en tu base</b>', { cls:'info' });
      if (i >= 0) L()[i] = x; else L().unshift(x);
      if (pick?.id === x.id) pick = x; edit = null; save(); toast(`🧭 ${i >= 0 ? 'Guardado' : 'Sumado a tus nichos'}`, { ms:1800 }); render(); };
  }

  return { render, roll, count:() => L().length };
})();
