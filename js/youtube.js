/* =========================================================
   ▶️ YouTube adentro de FUNVS (en Ver): buscar videos, vivos y canales y verlos sin salir.
   - Sin buscar: lo más visto de hoy en Argentina (barato: 1 unidad de cuota).
   - Cada búsqueda gasta 100 unidades de tu clave (10.000 por día ≈ 100 búsquedas): se guarda 6 h para no repetir gasto.
   - Videos: se ven en el reproductor de FUNVS (en el Fire Stick, en la app de YouTube con tu Premium).
   - Canales: ➕ los sumás a Mis canales para tenerlos en la grilla y en el zapping.
   ========================================================= */
const YouTube = (() => {
  const TIPOS = [['video', '🎬 Videos'], ['live', '🔴 En vivo'], ['channel', '📺 Canales']];
  const DURS = [['', 'Cualquier duración'], ['short', 'Menos de 4 min'], ['medium', '4 a 20 min'], ['long', 'Más de 20 min']];
  const ORDS = [['relevance', 'Más relevantes'], ['date', 'Más nuevos'], ['viewCount', 'Más vistos']];
  let st = { q:'', tipo:'video', dur:'', ord:'relevance', items:[], next:'', loading:false, err:'' }, home = null;
  const cache = () => S.get('ytSearchCache', {});
  const hist = () => S.get('ytHist', []);
  const isoMin = d => { const m = String(d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if (!m) return ''; const h = +m[1] || 0, mi = +m[2] || 0, s = +m[3] || 0; return h ? `${h}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${mi}:${String(s).padStart(2, '0')}`; };
  const nfmt = n => !n ? '' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' M' : n >= 1e3 ? Math.round(n / 1e3) + ' mil' : String(n);
  const dec = s => { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; };

  // completa duración y vistas de una tanda de videos (1 unidad por cada 50)
  async function details(list) {
    const ids = list.filter(x => x.id && !x.dur).map(x => x.id); if (!ids.length) return;
    try { const j = await Canales.yt('videos', { part:'contentDetails,statistics,liveStreamingDetails', id:ids.slice(0, 50).join(',') });
      for (const v of j.items || []) { const x = list.find(y => y.id === v.id); if (!x) continue; x.dur = isoMin(v.contentDetails?.duration); x.views = +v.statistics?.viewCount || 0;
        if (v.liveStreamingDetails?.actualStartTime && !v.liveStreamingDetails?.actualEndTime) { x.live = true; x.viewers = +v.liveStreamingDetails.concurrentViewers || 0; } } } catch {}
  }
  async function loadHome() {
    if (home && Date.now() - home.at < 3 * 3600e3) return;
    const c = S.get('ytHome', null); if (c && Date.now() - c.at < 3 * 3600e3) { home = c; return; }
    try { const j = await Canales.yt('videos', { part:'snippet,contentDetails,statistics', chart:'mostPopular', regionCode:'AR', maxResults:24, hl:'es' });
      home = { at:Date.now(), items:(j.items || []).map(v => ({ k:'video', id:v.id, t:v.snippet.title, ch:v.snippet.channelTitle, cid:v.snippet.channelId, date:v.snippet.publishedAt, dur:isoMin(v.contentDetails?.duration), views:+v.statistics?.viewCount || 0 })) };
      S.set('ytHome', home);
    } catch (e) { home = { at:Date.now(), items:[], err:niceErr(e.message || '') }; }
  }
  async function search(more) {
    if (!db.key) { st.err = 'Para buscar en YouTube hace falta tu clave de YouTube (Ajustes → Contenido → YouTube y cuota).'; return render(); }
    const q = st.q.trim(); if (!q) return render();
    const ck = [q.toLowerCase(), st.tipo, st.dur, st.ord].join('|'), C = cache();
    if (!more && C[ck] && Date.now() - C[ck].at < 6 * 3600e3) { Object.assign(st, { items:C[ck].items, next:C[ck].next, err:'' }); return render(); }
    st.loading = true; st.err = ''; render();
    try {
      const p = { part:'snippet', q, maxResults:24, regionCode:'AR', relevanceLanguage:'es', safeSearch:'none', order:st.ord };
      if (st.tipo === 'channel') p.type = 'channel'; else { p.type = 'video'; if (st.tipo === 'live') p.eventType = 'live'; if (st.dur) p.videoDuration = st.dur; }
      if (more && st.next) p.pageToken = st.next;
      const j = await Canales.yt('search', p);
      const items = (j.items || []).map(r => r.id.kind === 'youtube#channel'
        ? { k:'channel', cid:r.id.channelId, t:dec(r.snippet.title), d:dec(r.snippet.description), img:r.snippet.thumbnails?.medium?.url || r.snippet.thumbnails?.default?.url || '' }
        : { k:'video', id:r.id.videoId, t:dec(r.snippet.title), ch:dec(r.snippet.channelTitle), cid:r.snippet.channelId, date:r.snippet.publishedAt, live:r.snippet.liveBroadcastContent === 'live' }).filter(x => x.id || x.cid);
      await details(items);
      st.items = more ? [...st.items, ...items] : items; st.next = j.nextPageToken || '';
      const C2 = cache(); C2[ck] = { at:Date.now(), items:st.items, next:st.next };
      const keys = Object.keys(C2).sort((a, b) => C2[b].at - C2[a].at).slice(0, 15); S.set('ytSearchCache', Object.fromEntries(keys.map(k => [k, C2[k]])));
      if (!more) S.set('ytHist', [q, ...hist().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 12));
    } catch (e) { st.err = niceErr(e.message || 'No se pudo buscar'); }
    st.loading = false; render();
  }
  function play(x) { Player.play({ uid:'sv_' + x.id, platform:'youtube', ref:{ video:x.id }, name:x.t }); }
  function addChannel(x) {
    if (db.chans.some(c => c.ref?.channelId === x.cid)) return toast('<b>Ya está en tus canales</b>', { cls:'info' });
    const cat = db.cats.find(k => /stream/i.test(k)) || db.cats[0] || 'Streamers'; if (!db.cats.includes(cat)) db.cats.push(cat);
    db.chans.push({ uid:uid(), platform:'youtube', ref:{ channelId:x.cid }, name:x.t, cat, avatar:x.img || '', num:Math.max(0, ...db.chans.map(c => +c.num || 0)) + 1 });
    save(); try { Canales.refresh(); } catch {}
    toast(`<b>📺 «${esc(x.t)}» sumado a Mis canales</b><small>Categoría ${esc(cat)} · lo podés mover en Canales</small>`, { ms:4500 }); render();
  }
  const cardV = (x, i) => `<div class="card ytc" tabindex="0" data-ytv="${i}"><div class="thumb" style="background-image:url('https://i.ytimg.com/vi/${esc(x.id)}/mqdefault.jpg')">${x.live ? '<span class="badge live">🔴 EN VIVO</span>' : x.dur ? `<span class="ytdur">${x.dur}</span>` : ''}</div>
    <div class="ytt"><b>${esc(x.t)}</b><small>${esc(x.ch || '')}${x.live && x.viewers ? ` · ${nfmt(x.viewers)} mirando` : x.views ? ` · ${nfmt(x.views)} vistas` : ''}${x.date && !x.live ? ' · ' + ago(x.date) : ''}</small></div></div>`;
  const cardC = (x, i) => { const mine = db.chans.some(c => c.ref?.channelId === x.cid);
    return `<div class="ytch"><img src="${esc(x.img)}" alt="" loading="lazy"><div><b>${esc(x.t)}</b><small>${esc(x.d.slice(0, 120))}</small></div>
      <div class="btns"><button data-ytc="${i}" ${mine ? 'disabled' : 'class="pri"'}>${mine ? '✓ En mis canales' : '➕ Sumar a mis canales'}</button><a class="btn" href="https://www.youtube.com/channel/${esc(x.cid)}" target="_blank" rel="noopener">↗</a></div></div>`; };

  function render() {
    const v = $('v-youtube'); if (!v) return;
    const qt = (() => { try { return Canales.quotaTotal(); } catch { return null; } })(), H = hist(), list = st.q ? st.items : (home?.items || []);
    const sel = (id, arr, val) => `<select id="${id}">${arr.map(([k, t]) => `<option value="${k}" ${val === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    v.innerHTML = `<h2 class="sec">▶️ YouTube <small class="mut">buscá y mirá sin salir de FUNVS</small></h2>
      <form class="ytbar" id="ytForm"><input id="ytQ" type="search" placeholder="Buscar en YouTube…" value="${esc(st.q)}" autocomplete="off" enterkeyhint="search"><button class="pri" type="submit">🔎 Buscar</button></form>
      <div class="ytfil"><div class="chips">${TIPOS.map(([k, t]) => `<button class="chip ${st.tipo === k ? 'on' : ''}" data-ytt="${k}">${t}</button>`).join('')}</div>
        ${st.tipo !== 'channel' ? sel('ytDur', DURS, st.dur) : ''}${sel('ytOrd', ORDS, st.ord)}</div>
      ${H.length && !st.q ? `<div class="chips ythist"><small class="mut">Buscaste:</small>${H.map(h => `<button class="chip" data-yth="${esc(h)}">${esc(h)}</button>`).join('')}<button class="chip" data-ythx title="Borrar historial">✕</button></div>` : ''}
      ${st.err ? `<div class="empty">⚠️ ${esc(st.err)}</div>` : ''}
      ${!st.q ? `<h3 class="ytsub">🔥 Lo más visto hoy en Argentina</h3>` : st.loading && !st.items.length ? '' : `<h3 class="ytsub">Resultados para «${esc(st.q)}» <button class="chip" data-ytclr>✕ Limpiar</button></h3>`}
      ${st.loading && !list.length ? '<div class="empty">Buscando…</div>' : ''}
      ${list.length ? (st.q && st.tipo === 'channel' ? `<div class="ytchs">${list.map(cardC).join('')}</div>` : `<div class="grid ytgrid">${list.map(cardV).join('')}</div>`) : !st.loading && st.q && !st.err ? '<div class="empty">No encontré nada con eso.</div>' : !st.q && home?.err ? `<div class="empty">⚠️ ${esc(home.err)}</div>` : ''}
      ${st.q && st.next ? `<div class="btns" style="justify-content:center;margin:14px 0"><button data-ytmore ${st.loading ? 'disabled' : ''}>${st.loading ? 'Cargando…' : 'Ver más resultados'}</button></div>` : ''}
      <p class="mut ytq">Cada búsqueda nueva gasta 100 de tu cuota de YouTube${qt != null ? ` (hoy llevás ${qt.toLocaleString('es-AR')} de 10.000)` : ''}; las repetidas se guardan 6 horas y no gastan.${Device.mode === 'tv' ? ' En la tele podés escribir desde el celu con 📱 Control.' : ''}</p>`;
    bind(v, list);
    if (!st.q && !home && db.key) loadHome().then(() => { if (Nav.current === 'youtube' && !st.q) render(); });
  }
  function bind(v, list) {
    $('ytForm').onsubmit = e => { e.preventDefault(); st.q = $('ytQ').value.trim(); st.items = []; st.next = ''; $('ytQ').blur(); search(); };
    v.querySelectorAll('[data-ytt]').forEach(b => b.onclick = () => { st.tipo = b.dataset.ytt; st.items = []; st.next = ''; st.q ? search() : render(); });
    $('ytDur')?.addEventListener('change', e => { st.dur = e.target.value; st.items = []; if (st.q) search(); });
    $('ytOrd').onchange = e => { st.ord = e.target.value; st.items = []; if (st.q) search(); };
    v.querySelectorAll('[data-yth]').forEach(b => b.onclick = () => { st.q = b.dataset.yth; st.items = []; search(); });
    v.querySelector('[data-ythx]')?.addEventListener('click', () => { S.set('ytHist', []); render(); });
    v.querySelector('[data-ytclr]')?.addEventListener('click', () => { st = { ...st, q:'', items:[], next:'', err:'' }; render(); });
    v.querySelector('[data-ytmore]')?.addEventListener('click', () => search(true));
    v.querySelectorAll('[data-ytv]').forEach(c => { const go = () => play(list[+c.dataset.ytv]); c.onclick = go; c.onkeydown = e => { if (e.key === 'Enter') go(); }; });
    v.querySelectorAll('[data-ytc]').forEach(b => b.onclick = () => addChannel(list[+b.dataset.ytc]));
  }
  // desde el buscador general (🔎) o el control del celu
  function find(q) { st.q = q; st.items = []; st.next = ''; Nav.go('youtube'); search(); }
  return { render, find };
})();
