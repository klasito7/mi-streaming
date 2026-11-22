/* =========================================================
   🏙️ Urbe (Jugar → Ciudad): city builder 3D tipo Cities: Skylines (calles con curvas, casas a mano). Vive en barrio/index.html y se abre acá adentro.
   La partida se guarda en db.barrio (se sincroniza con el Gist). db.barrio.avisos es lo que va a pasar
   (obras, ampliaciones, tope de recaudación): GitHub lo lee cada ~10 min (scripts/alertas.mjs) y manda el Telegram.
   ========================================================= */
window.BarrioHost = {
  get: () => db.barrio || null,
  set: v => { db.barrio = v; save(); },
  onChange: f => onChange(f)
};
const Barrio = (() => {
  let frame = null;
  // lo que tapan las barras fijas de abajo (reloj, radio, música…)
  function cover() {
    let top = innerHeight;
    for (const el of document.querySelectorAll('#hud > *, #radiobar, #musicbar, #tvfoot')) {
      const r = el.getBoundingClientRect();
      if (r.height && r.bottom >= innerHeight - 6 && r.top > innerHeight / 2) top = Math.min(top, r.top);
    }
    return innerHeight - top;
  }
  function fit() {
    if (!frame || !frame.offsetParent) return;
    frame.style.height = Math.max(420, innerHeight - frame.getBoundingClientRect().top - cover() - 8) + 'px';
  }
  function render() {
    const v = $('v-barrio');
    if (!frame) {
      v.innerHTML = '<iframe id="barrioFrame" title="Urbe, tu ciudad" src="barrio/?v=175" style="display:block;width:100%;border:0;border-radius:18px;background:#79c6f6"></iframe>';
      frame = $('barrioFrame');
      addEventListener('resize', fit); setInterval(fit, 2000);
    }
    requestAnimationFrame(fit);
  }
  return { render };
})();
