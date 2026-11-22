/* =========================================================
   🌀 Espiral (Jugar → Espiral): juego tipo Zuma con ritmo. Vive en espiral/index.html y se abre acá adentro.
   El progreso (récord, niveles, estrellas, tótem) se guarda en db.espiral (se sincroniza con el Gist).
   Los premios van a los vaccoins de Colección con Figus.juego (id único y tope diario de los juegos).
   ========================================================= */
window.EspiralHost = {
  get: () => db.espiral || null,
  set: v => { db.espiral = v; save(); },
  ganar: (id, n, m) => { try { return Figus.juego('esp-' + id, n, m); } catch { return 0; } }
};
const Espiral = (() => {
  let frame = null;
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
    frame.style.height = Math.max(460, innerHeight - frame.getBoundingClientRect().top - cover() - 8) + 'px';
  }
  function render() {
    const v = $('v-espiral');
    if (!frame) {
      v.innerHTML = '<iframe id="espiralFrame" title="Espiral" src="espiral/?v=173" allow="autoplay; fullscreen" style="display:block;width:100%;border:0;border-radius:18px;background:#07040f"></iframe>';
      frame = $('espiralFrame');
      addEventListener('resize', fit); setInterval(fit, 2000);
    }
    requestAnimationFrame(fit);
  }
  return { render };
})();
