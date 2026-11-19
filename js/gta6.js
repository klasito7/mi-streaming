/* =========================================================
   🌴 Especial GTA VI (del 19/11 al 19/12/2026, en Ver):
   videos de GTA de los youtubers (IlloJuan, elrubius, Germán, Willyrex, DaniRep, Bananirou, Vector, Mangel)
   y noticias de portales gamers. Lo junta el robot (gta6.json): solo lo que habla de GTA.
   ========================================================= */
const Gta6 = (() => {
  const END = Date.parse('2026-12-19T23:59:59-03:00'), LAUNCH = Date.parse('2026-11-19T00:00:00-03:00');
  const YTS = ['IlloJuan', 'elrubius', 'Germán', 'Willyrex', 'DaniRep', 'Bananirou', 'Vector', 'Mangel'];
  let data = S.get('gta6Data', null), at = 0, who = '', tab = S.get('gta6Tab', 'vids');
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
    const V = (data?.vids || []).filter(x => !who || x.ch === who), N = data?.news || [];
    const hay = new Set((data?.vids || []).map(x => x.ch));
    v.innerHTML = `<div class="g6hero"><div class="g6sun"></div><div class="g6palms"></div>
        <div class="g6txt"><small>ESPECIAL · DÍA ${dia} DEL ESTRENO</small><h2>GTA VI ya salió</h2><p>Videos de tus youtubers y noticias de los portales gamers, todo sobre GTA. ${dias ? `El especial sigue ${dias === 1 ? 'hasta mañana' : dias + ' días más'}.` : 'Último día del especial.'}</p>
        ${skin ? '<button class="g6btn" id="g6Skin">🌴 Conseguí el skin «Noches de Neón» en el Market</button>' : ''}</div></div>
      <div class="tabs g6tabs"><button data-g6t="vids" class="${tab === 'vids' ? 'on' : ''}">▶️ Videos <span class="cnt">${(data?.vids || []).length}</span></button><button data-g6t="news" class="${tab === 'news' ? 'on' : ''}">📰 Noticias <span class="cnt">${N.length}</span></button></div>
      ${!data ? '<div class="empty">Juntando lo de GTA VI… El robot pasa cada algunas horas: si recién arranca el especial, volvé en un rato.</div>'
      : tab === 'vids' ? `<div class="chips g6who"><button class="chip ${!who ? 'on' : ''}" data-g6w="">Todos</button>${YTS.map(n => `<button class="chip ${who === n ? 'on' : ''} ${hay.has(n) ? '' : 'dim'}" data-g6w="${n}">${n}</button>`).join('')}</div>
        <div class="grid g6grid">${V.map((x, i) => `<div class="card g6v" tabindex="0" data-g6v="${i}"><div class="thumb" style="background-image:url('https://i.ytimg.com/vi/${esc(x.id)}/mqdefault.jpg')"><span class="badge">${esc(x.ch)}</span></div>
          <div class="g6vt"><b>${esc(x.t)}</b><small>${ago2(x.date)}${x.views ? ' · ' + x.views.toLocaleString('es-AR') + ' vistas' : ''}</small></div></div>`).join('') || `<div class="empty">${who ? `${who} todavía no subió nada de GTA (o no lo encontré).` : 'Todavía no hay videos de GTA de tus youtubers.'}</div>`}</div>`
      : `<div class="g6news">${N.map((n, i) => `<a class="g6n" href="${esc(n.url)}" target="_blank" rel="noopener" data-g6n="${i}">${n.img ? `<img src="${esc(n.img)}" alt="" loading="lazy">` : '<div class="g6nimg">🌴</div>'}<div><b>${esc(n.t)}</b><small>${esc(n.src)} · ${ago2(n.date)}</small></div></a>`).join('') || '<div class="empty">Todavía no hay noticias de GTA en los portales.</div>'}</div>`}
      ${data?.updated ? `<p class="mut g6upd">Actualizado ${ago(data.updated)}</p>` : ''}`;
    v.querySelectorAll('[data-g6t]').forEach(b => b.onclick = () => { tab = b.dataset.g6t; S.set('gta6Tab', tab); render(); });
    v.querySelectorAll('[data-g6w]').forEach(b => b.onclick = () => { who = b.dataset.g6w; render(); });
    v.querySelectorAll('[data-g6v]').forEach(c => { const go = () => play(V[+c.dataset.g6v]); c.onclick = go; c.onkeydown = e => { if (e.key === 'Enter') go(); }; });
    if (Device.mode === 'tv') v.querySelectorAll('[data-g6n]').forEach(a => a.onclick = e => { e.preventDefault(); toast(`<b>Esta nota se lee mejor en el celu</b><small>${esc(N[+a.dataset.g6n].src)}</small>`, { cls:'info', ms:5000 }); });
    $('g6Skin')?.addEventListener('click', () => { Nav.go('figus'); setTimeout(() => Figus.tab('market'), 50); });
    if (Date.now() - at > 10 * 60e3) load().then(() => { if (Nav.current === 'gta6') render(); });
  }
  return { render };
})();
