/* =========================================================
   🎨 Skins de FUNVS: cambian toda la pinta (colores, encabezado, botones).
   Se compran en 🛒 Market (Colección) con vaccoins y quedan para siempre.
   Lo que tenés puesto se sincroniza (db.skin) y se aplica en todos los aparatos;
   en el Fire Stick va la versión liviana (sin brillos).
   ========================================================= */
const Skins = (() => {
  // 🌴 especial por el estreno de GTA VI (19/11/2026): se puede conseguir hasta el 19/12
  const SKINS = {
    neon:{ nm:'Noches de Neón', ic:'🌴', tag:'Especial GTA VI', cost:400, from:'2026-11-19T00:00:00-03:00', until:'2026-12-19T23:59:59-03:00',
      d:'Atardecer de Florida en toda la app: cielo rosa y naranja, palmeras, neón rosa y celeste, botones con brillo de cartel de motel. Edición limitada por el estreno.',
      sw:['#ff4fa3', '#ff9a3c', '#22e6d6', '#5b2a86', '#140a1f'] },
  };
  const now = () => Date.now();
  const onSale = k => { const s = SKINS[k]; return s && now() >= Date.parse(s.from) && now() <= Date.parse(s.until); };
  const daysLeft = k => Math.max(0, Math.ceil((Date.parse(SKINS[k].until) - now()) / 864e5));
  const owns = k => { try { return typeof Figus !== 'undefined' && Figus.owns(k); } catch { return false; } };
  const cur = () => (db.skin && SKINS[db.skin] && owns(db.skin)) ? db.skin : '';
  function apply() {
    const h = document.documentElement, k = cur();
    Object.keys(SKINS).forEach(x => h.classList.toggle('skin-' + x, x === k));
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = k === 'neon' ? '#2b0f3f' : '#171920';
  }
  function wear(k) { db.skin = k; save(); apply(); }

  // la vidriera del Market
  function marketHtml() {
    const coins = (() => { try { return Figus.coins; } catch { return 0; } })();
    const cards = Object.entries(SKINS).map(([k, s]) => {
      const own = owns(k), on = cur() === k, sale = onSale(k), dl = daysLeft(k), falta = Math.max(0, s.cost - coins);
      return `<div class="mkcard ${own ? 'own' : ''}">
        <div class="mkprev skinprev-${k}"><div class="mkph"><b>FUNVS</b><i></i><i></i><i></i></div><div class="mkpb"><span></span><span></span><span></span></div><div class="mkpalms"></div></div>
        <div class="mkinfo"><small class="mktag">${s.ic} ${esc(s.tag)}${sale && !own ? ` · ⏳ ${dl === 1 ? 'último día' : 'quedan ' + dl + ' días'}` : ''}</small>
          <h3>${esc(s.nm)}</h3><p>${esc(s.d)}</p>
          <div class="mksw">${s.sw.map(c => `<i style="background:${c}"></i>`).join('')}</div>
          <div class="btns">${own ? (on ? '<button data-skoff>✓ Puesto · sacar</button>' : `<button class="pri" data-skon="${k}">🎨 Ponérmelo</button>`)
            : sale ? `<button class="pri" data-skbuy="${k}" ${falta ? 'disabled' : ''}>🪙 ${s.cost} vaccoins</button>${falta ? `<small class="mut">Te faltan ${falta}</small>` : ''}`
            : '<button disabled>Ya no está a la venta</button>'}</div></div></div>`;
    }).join('');
    return `<div class="mkhead"><div><h2>🛒 Market de FUNVS</h2><p class="mut">Cosas para tu FUNVS que se pagan con vaccoins. Lo que comprás queda para siempre, en todos tus aparatos.</p></div>
        <div class="mkcoins">🪙 <b>${coins}</b><small>vaccoins</small></div></div>
      <div class="mkgrid">${cards}</div>
      <div class="box mkhow"><b>¿Cómo junto vaccoins rápido?</b><ul>
        <li>🎁 Regalo del día al abrir FUNVS (sube con la racha, hasta +55).</li><li>⏱️ 1 por cada 5 minutos usando o escuchando FUNVS (hasta 60 por día).</li>
        <li>🔮 Prode de Fulbito: 15 por acertar, 40 por resultado exacto.</li><li>♻️ Vender figus repetidas en 🔁 Repes.</li></ul>
        <p class="mut">Usándolo todos los días se junta el skin en 3 a 5 días.</p></div>`;
  }
  function bindMarket(v, re) {
    v.querySelectorAll('[data-skbuy]').forEach(b => b.onclick = () => {
      const k = b.dataset.skbuy, s = SKINS[k]; if (!onSale(k)) return;
      if (!confirm(`¿Comprar el skin «${s.nm}» por ${s.cost} vaccoins?`)) return;
      if (!Figus.buySkin(k, s.cost, s.nm)) return toast('<b>No te alcanzan los vaccoins</b>', { cls:'info' });
      wear(k); toast(`<b>${s.ic} ¡Es tuyo! «${s.nm}»</b><small>Ya lo tenés puesto. Lo podés sacar o volver a poner cuando quieras.</small>`, { ms:6000 }); re();
    });
    v.querySelectorAll('[data-skon]').forEach(b => b.onclick = () => { wear(b.dataset.skon); re(); });
    v.querySelector('[data-skoff]')?.addEventListener('click', () => { wear(''); re(); });
  }
  // para Ajustes → Pantalla
  const owned = () => Object.keys(SKINS).filter(owns).map(k => [k, SKINS[k].ic + ' ' + SKINS[k].nm]);
  function init() { apply(); onChange(apply); setTimeout(apply, 1500); }
  return { init, apply, wear, cur, owned, marketHtml, bindMarket, SKINS, onSale };
})();
