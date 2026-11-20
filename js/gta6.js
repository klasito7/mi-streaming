/* =========================================================
   🌴 Especial GTA VI (del 19/11 al 19/12/2026, en Ver):
   videos de GTA de los youtubers (IlloJuan, elrubius, Germán, Willyrex, DaniRep, Bananirou, Vector, Mangel)
   y noticias de portales gamers. Lo junta el robot (gta6.json): solo lo que habla de GTA.
   ========================================================= */
const Gta6 = (() => {
  const END = Date.parse('2026-12-19T23:59:59-03:00'), LAUNCH = Date.parse('2026-11-19T00:00:00-03:00');
  const YTS = ['IlloJuan', 'elrubius', 'Germán', 'Willyrex', 'DaniRep', 'Bananirou', 'Vector', 'Mangel'];
  let data = S.get('gta6Data', null), at = 0, who = '', tab = S.get('gta6Tab', 'vids');
  // 🎯 solo lo que habla de GTA VI en el título (no GTA V, ni Rockstar en general)
  const RX = /\bGTA\s?(VI|6)\b|GTAVI|GTA6|Grand\s+Theft\s+Auto\s+(VI|6)\b|\bLeonida\b|#GTA6|#GTAVI/i;
  // ➕ canales tuyos (por link): se revisan con tu clave de YouTube (1 de cuota por canal cada 20 min)
  const MC = () => { if (!Array.isArray(db.gta6Chans)) db.gta6Chans = []; return db.gta6Chans; };
  let mine = S.get('gta6Mine', null), mineAt = mine?.at || 0, mineBusy = false;
  function parseLink(t) {
    t = String(t || '').trim(); if (/^@[\w.-]+$/.test(t)) return { handle:t };
    if (/^UC[\w-]{22}$/.test(t)) return { cid:t };
    try { const u = new URL(/^https?:/.test(t) ? t : 'https://' + t), p = u.pathname.split('/').filter(Boolean);
      if (!/youtube\.com$|youtu\.be$/.test(u.hostname.replace(/^www\.|^m\./, ''))) return null;
      if (p[0] === 'channel' && p[1]) return { cid:p[1] }; if (p[0]?.startsWith('@')) return { handle:p[0] };
      if (['c', 'user'].includes(p[0]) && p[1]) return { handle:'@' + p[1] }; } catch {}
    return null;
  }
  async function addChan(link) {
    const r = parseLink(link); if (!r) return toast('<b>Pegá el link de un canal de YouTube</b><small>Por ejemplo youtube.com/@canal</small>', { cls:'info', ms:4000 });
    if (!db.key) return toast('<b>Hace falta tu clave de YouTube</b><small>Ajustes → Contenido → YouTube y cuota</small>', { cls:'info', ms:4500 });
    try { const j = await Canales.yt('channels', { part:'snippet,contentDetails', ...(r.cid ? { id:r.cid } : { forHandle:r.handle }) }); const ch = j.items?.[0]; if (!ch) throw new Error('No encontré ese canal');
      if (MC().some(x => x.cid === ch.id)) return toast('<b>Ese canal ya está en el especial</b>', { cls:'info' });
      MC().push({ cid:ch.id, name:ch.snippet.title, up:ch.contentDetails.relatedPlaylists.uploads, img:(ch.snippet.thumbnails.default || {}).url || '' }); save();
      toast(`<b>🌴 «${esc(ch.snippet.title)}» sumado al especial</b><small>Van a aparecer solo sus videos y vivos de GTA VI</small>`, { ms:4000 }); mineAt = 0; render();
    } catch (e) { toast(`<b>${esc(niceErr(e.message || ''))}</b>`, { cls:'info', ms:5000 }); }
  }
  async function loadMine() {
    if (mineBusy || !MC().length || !db.key || Date.now() - mineAt < 20 * 60e3) return; mineBusy = true; mineAt = Date.now();
    const out = [];
    await Promise.all(MC().map(async c => { try {
      const j = await Canales.yt('playlistItems', { part:'snippet,contentDetails', playlistId:c.up, maxResults:20 });
      (j.items || []).forEach(it => { const t = it.snippet.title; if (RX.test(t)) out.push({ id:it.contentDetails.videoId, t, ch:c.name, mine:true, date:Date.parse(it.contentDetails.videoPublishedAt || it.snippet.publishedAt) || Date.now() }); });
    } catch {} }));
    if (out.length) try { const j = await Canales.yt('videos', { part:'snippet,liveStreamingDetails,statistics', id:out.slice(0, 50).map(x => x.id).join(',') });
      (j.items || []).forEach(v => { const x = out.find(y => y.id === v.id); if (!x) return; x.live = v.snippet.liveBroadcastContent === 'live'; x.soon = v.snippet.liveBroadcastContent === 'upcoming'; x.views = +v.statistics?.viewCount || 0; x.viewers = +v.liveStreamingDetails?.concurrentViewers || 0; }); } catch {}
    mine = { at:mineAt, vids:out }; S.set('gta6Mine', mine); mineBusy = false;
    if (Nav.current === 'gta6') render();
  }
  async function load() {
    if (Date.now() - at < 10 * 60e3) return; at = Date.now();
    try { const j = await (await fetch(REPO.data + 'gta6.json?t=' + Math.floor(Date.now() / 600e3))).json(); if (j && (j.news || j.vids)) { data = j; S.set('gta6Data', j); } } catch {}
  }
  const ago2 = t => { const m = Math.round((Date.now() - t) / 60e3); return m < 60 ? `hace ${Math.max(1, m)} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
  function play(v) { Player.play({ uid:'sv_' + v.id, platform:'youtube', ref:{ video:v.id }, name:v.t }); }
  function render() {
    const v = $('v-gta6'); if (!v) return;
    const dias = Math.max(0, Math.ceil((END - Date.now()) / 864e5)), dia = Math.max(1, Math.floor((Date.now() - LAUNCH) / 864e5) + 1);
    const skin = typeof Skins !== 'undefined' && Skins.onSale('neon') && !(typeof Figus !== 'undefined' && Figus.owns('neon'));
    const ALL = [...(mine?.vids || []).filter(x => MC().some(c => c.name === x.ch)), ...(data?.vids || []).filter(x => RX.test(x.t))].filter((x, i, A) => A.findIndex(y => y.id === x.id) === i)
      .sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || b.date - a.date);
    const V = ALL.filter(x => !who || x.ch === who), N = data?.news || [];
    const hay = new Set(ALL.map(x => x.ch)), NAMES = [...YTS, ...MC().map(c => c.name).filter(n => !YTS.includes(n))];
    v.innerHTML = `<div class="g6hero"><div class="g6sun"></div><div class="g6palms"></div>
        <div class="g6txt"><small>ESPECIAL · DÍA ${dia} DEL ESTRENO</small><h2>GTA VI ya salió</h2><p>Videos de tus youtubers y noticias de los portales gamers, todo sobre GTA. ${dias ? `El especial sigue ${dias === 1 ? 'hasta mañana' : dias + ' días más'}.` : 'Último día del especial.'}</p>
        ${skin ? '<button class="g6btn" id="g6Skin">🌴 Conseguí el skin «Noches de Neón» en el Market</button>' : ''}</div></div>
      <div class="tabs g6tabs"><button data-g6t="vids" class="${tab === 'vids' ? 'on' : ''}">▶️ Videos <span class="cnt">${ALL.length}</span></button><button data-g6t="news" class="${tab === 'news' ? 'on' : ''}">📰 Noticias <span class="cnt">${N.length}</span></button></div>
      ${!data ? '<div class="empty">Juntando lo de GTA VI… El robot pasa cada algunas horas: si recién arranca el especial, volvé en un rato.</div>'
      : tab === 'vids' ? `<div class="chips g6who"><button class="chip ${!who ? 'on' : ''}" data-g6w="">Todos</button>${NAMES.map(n => `<button class="chip ${who === n ? 'on' : ''} ${hay.has(n) ? '' : 'dim'}" data-g6w="${esc(n)}">${esc(n)}</button>`).join('')}</div>
        <details class="g6add"><summary>➕ Agregar un canal por link <small class="mut">(${MC().length})</small></summary><form id="g6AddF" class="g6addf"><input id="g6Link" placeholder="Pegá el link del canal: youtube.com/@canal" autocomplete="off"><button class="pri">Agregar</button></form>
          ${MC().map((c, i) => `<span class="chip g6mine">${c.img ? `<img src="${esc(c.img)}" alt="">` : ''}${esc(c.name)} <button data-g6del="${i}" title="Sacar">✕</button></span>`).join('')}<p class="mut" style="font-size:12px;margin:6px 0 0">Solo se muestran sus videos y vivos que digan GTA VI (o GTA 6) en el título. Se revisan cada 20 min con tu clave de YouTube.</p></details>
        <div class="grid g6grid">${V.map((x, i) => `<div class="card g6v" tabindex="0" data-g6v="${i}"><div class="thumb" style="background-image:url('https://i.ytimg.com/vi/${esc(x.id)}/mqdefault.jpg')"><span class="badge ${x.live ? 'live' : ''}">${x.live ? '🔴 EN VIVO · ' : x.soon ? '⏰ ' : ''}${esc(x.ch)}</span></div>
          <div class="g6vt"><b>${esc(x.t)}</b><small>${x.live ? (x.viewers ? x.viewers.toLocaleString('es-AR') + ' mirando' : 'en vivo ahora') : ago2(x.date)}${!x.live && x.views ? ' · ' + x.views.toLocaleString('es-AR') + ' vistas' : ''}</small></div></div>`).join('') || `<div class="empty">${who ? `${who} todavía no subió nada de GTA (o no lo encontré).` : 'Todavía no hay videos de GTA de tus youtubers.'}</div>`}</div>`
      : `<div class="g6news">${N.map((n, i) => `<a class="g6n" href="${esc(n.url)}" target="_blank" rel="noopener" data-g6n="${i}">${n.img ? `<img src="${esc(n.img)}" alt="" loading="lazy">` : '<div class="g6nimg">🌴</div>'}<div><b>${esc(n.t)}</b><small>${esc(n.src)} · ${ago2(n.date)}</small></div></a>`).join('') || '<div class="empty">Todavía no hay noticias de GTA en los portales.</div>'}</div>`}
      ${data?.updated ? `<p class="mut g6upd">Actualizado ${ago(data.updated)}</p>` : ''}`;
    v.querySelectorAll('[data-g6t]').forEach(b => b.onclick = () => { tab = b.dataset.g6t; S.set('gta6Tab', tab); render(); });
    v.querySelectorAll('[data-g6w]').forEach(b => b.onclick = () => { who = b.dataset.g6w; render(); });
    v.querySelectorAll('[data-g6v]').forEach(c => { const go = () => play(V[+c.dataset.g6v]); c.onclick = go; c.onkeydown = e => { if (e.key === 'Enter') go(); }; });
    if (Device.mode === 'tv') v.querySelectorAll('[data-g6n]').forEach(a => a.onclick = e => { e.preventDefault(); toast(`<b>Esta nota se lee mejor en el celu</b><small>${esc(N[+a.dataset.g6n].src)}</small>`, { cls:'info', ms:5000 }); });
    $('g6AddF')?.addEventListener('submit', e => { e.preventDefault(); const l = $('g6Link').value; $('g6Link').value = ''; addChan(l); });
    v.querySelectorAll('[data-g6del]').forEach(b => b.onclick = e => { e.preventDefault(); const c = MC()[+b.dataset.g6del]; if (!c || !confirm(`¿Sacar «${c.name}» del especial?`)) return; db.gta6Chans = MC().filter(x => x !== c); save(); render(); });
    if (Date.now() - mineAt > 20 * 60e3) loadMine();
    $('g6Skin')?.addEventListener('click', () => { Nav.go('figus'); setTimeout(() => Figus.tab('market'), 50); });
    if (Date.now() - at > 10 * 60e3) load().then(() => { if (Nav.current === 'gta6') render(); });
  }
  return { render };
})();
