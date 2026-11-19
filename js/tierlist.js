/* =========================================================
   🏆 Tierlist (Jugar → Tierlist)
   Pegás imágenes (Ctrl+V, 📋 Pegar o ＋ Subir), las arrastrás a las filas S/A/B/C/D
   y al terminar se saca una captura que queda guardada con su título en "Mis tierlists".
   Todo queda en este aparato (IndexedDB), no se sube a ningún lado.
   ========================================================= */
const Tierlist = (() => {
  // 💙 colores de Vélez: del blanco al azul oscuro y el negro
  const COLS = ['#ffffff', '#c9d8ff', '#7fa2ff', '#1d4fd8', '#0b2a7a', '#2a2e39', '#9aa0ad', '#000000'];
  const BASE = [['S', '#ffffff'], ['A', '#c9d8ff'], ['B', '#7fa2ff'], ['C', '#1d4fd8'], ['D', '#0b2a7a']];
  const ink = h => { const n = parseInt(String(h).slice(1), 16); return ((n >> 16) * .299 + (n >> 8 & 255) * .587 + (n & 255) * .114) > 150 ? '#0b0c10' : '#ffffff'; };
  /* ---------- guardado (IndexedDB: no entra en el localStorage) ---------- */
  let dbP = null;
  const idb = () => dbP || (dbP = new Promise((ok, no) => { const r = indexedDB.open('funvs-tier', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
  const tx = async (mode, fn) => { const d = await idb(); return new Promise((ok, no) => { const t = d.transaction('kv', mode), s = t.objectStore('kv'); const r = fn(s); t.oncomplete = () => ok(r?.result); t.onerror = () => no(t.error); }); };
  const get = k => tx('readonly', s => s.get(k)), put = (k, v) => tx('readwrite', s => s.put(v, k)), del = k => tx('readwrite', s => s.delete(k));

  const fresh = () => { const tiers = BASE.map(([label, color]) => ({ id:uid(), label, color })); return { id:uid(), title:'', tiers, items:{}, rows:Object.fromEntries([...tiers.map(t => [t.id, []]), ['pool', []]]) }; };
  let cur = null, list = [], tab = 'armar', selId = null, loaded = false, saveT = 0, viewer = null;
  async function load() {
    if (loaded) return; loaded = true;
    try { cur = await get('cur'); list = (await get('list')) || []; } catch {}
    if (!cur) cur = fresh();
  }
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => put('cur', cur).catch(() => {}), 300); };

  /* ---------- imágenes ---------- */
  function shrink(file, max = 260) {
    return new Promise((ok, no) => { const fr = new FileReader();
      fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); let out = c.toDataURL('image/webp', .85); if (!/^data:image\/webp/.test(out)) out = c.toDataURL('image/jpeg', .88); ok(out); };
        im.onerror = () => no(new Error('No pude leer esa imagen.')); im.src = fr.result; };
      fr.onerror = () => no(new Error('No pude leer el archivo.')); fr.readAsDataURL(file); });
  }
  async function addFiles(files) {
    let n = 0;
    for (const f of files) { if (!f?.type?.startsWith('image/')) continue; try { const id = uid(); cur.items[id] = { img:await shrink(f) }; cur.rows.pool.push(id); n++; } catch (e) { toast(`<b>${esc(e.message)}</b>`, { cls:'info' }); } }
    if (n) { persist(); render(); toast(`<b>🖼️ ${n === 1 ? 'Imagen agregada' : n + ' imágenes agregadas'}</b><small>Están abajo, en "Sin ubicar". Arrastralas a una fila.</small>`, { ms:2500 }); }
  }
  addEventListener('paste', e => { if (Nav.current !== 'tierlist' || tab !== 'armar' || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return; const f = pastedImages(e); if (f.length) { e.preventDefault(); addFiles(f); } });

  /* ---------- mover ---------- */
  const rowOf = id => Object.keys(cur.rows).find(k => cur.rows[k].includes(id));
  function moveTo(id, row, idx = null) {
    const from = rowOf(id); if (!from || !cur.rows[row]) return;
    const a = cur.rows[from], oi = a.indexOf(id); a.splice(oi, 1);
    const b = cur.rows[row]; if (idx === null || idx > b.length) idx = b.length; if (from === row && oi < idx) idx--;
    b.splice(Math.max(0, idx), 0, id); persist();
  }
  // dónde cae: la fila bajo el dedo y la posición según las fichas que hay
  function dropAt(x, y, skip) {
    const el = document.elementFromPoint(x, y)?.closest('[data-tlrow]'); if (!el) return null;
    const its = [...el.querySelectorAll('[data-tli]')].filter(t => t.dataset.tli !== skip);
    let idx = its.length;
    for (let i = 0; i < its.length; i++) { const r = its[i].getBoundingClientRect(); if (y < r.top - 4) { idx = i; break; } if (y <= r.bottom + 4 && x < r.left + r.width / 2) { idx = i; break; } }
    return { row:el.dataset.tlrow, idx, el };
  }
  function bindDrag(v) {
    v.querySelectorAll('[data-tli]').forEach(t => {
      t.onpointerdown = e => {
        if (e.button > 0 || e.target.closest('[data-tlx]')) return;
        const id = t.dataset.tli, sx = e.clientX, sy = e.clientY; let ghost = null, over = null;
        const mv = ev => {
          if (!ghost) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 7) return;
            ghost = t.cloneNode(true); ghost.classList.add('tlghost'); document.body.appendChild(ghost); t.classList.add('tldrag'); }
          ev.preventDefault();
          ghost.style.left = ev.clientX - 36 + 'px'; ghost.style.top = ev.clientY - 36 + 'px';
          const d = dropAt(ev.clientX, ev.clientY, id); if (over !== d?.el) { over?.classList.remove('tlover'); over = d?.el || null; over?.classList.add('tlover'); }
          if (ev.clientY < 60) scrollBy(0, -12); else if (ev.clientY > innerHeight - 90) scrollBy(0, 12);
        };
        const up = ev => {
          removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
          over?.classList.remove('tlover');
          if (!ghost) { // toque: elegir / soltar
            selId = selId === id ? null : id; return render(); }
          ghost.remove(); t.classList.remove('tldrag');
          const d = ev.type === 'pointerup' && dropAt(ev.clientX, ev.clientY, id); if (d) { moveTo(id, d.row, d.idx); selId = null; } render();
        };
        addEventListener('pointermove', mv, { passive:false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
      };
    });
    // con una ficha elegida, tocar una fila la manda ahí
    v.querySelectorAll('[data-tlrow]').forEach(r => r.addEventListener('click', e => { if (!selId || e.target.closest('[data-tli]')) return; moveTo(selId, r.dataset.tlrow); selId = null; render(); }));
  }

  /* ---------- captura (dibujada en un canvas, sin servicios de afuera) ---------- */
  const loadImg = u => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = u; });
  function wrap(g, txt, maxW) { const w = txt.split(/\s+/), L = []; let l = ''; for (const x of w) { const t = l ? l + ' ' + x : x; if (g.measureText(t).width > maxW && l) { L.push(l); l = x; } else l = t; } if (l) L.push(l); return L; }
  async function snapshot() {
    const W = 1200, LAB = 150, S = 110, GAP = 6, PAD = 16, perRow = Math.floor((W - LAB - PAD * 2 - GAP) / (S + GAP));
    const rows = cur.tiers.map(t => ({ t, ids:cur.rows[t.id] || [] }));
    const hs = rows.map(r => Math.max(1, Math.ceil(r.ids.length / perRow)) * (S + GAP) + GAP);
    const TOP = cur.title ? 84 : 20, H = TOP + hs.reduce((a, b) => a + b, 0) + 44;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#0e0f13'; g.fillRect(0, 0, W, H);
    if (cur.title) { g.fillStyle = '#fff'; g.font = 'bold 40px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText(cur.title, PAD, 44, W - PAD * 2); }
    const imgs = {}; for (const r of rows) for (const id of r.ids) { const it = cur.items[id]; if (it?.img) imgs[id] = await loadImg(it.img); }
    let y = TOP;
    rows.forEach((r, i) => {
      const h = hs[i];
      g.fillStyle = '#171920'; g.fillRect(PAD, y, W - PAD * 2, h - 2);
      g.fillStyle = r.t.color; g.fillRect(PAD, y, LAB, h - 2);
      g.fillStyle = ink(r.t.color); g.textAlign = 'center'; g.textBaseline = 'middle';
      const fs = r.t.label.length <= 2 ? 52 : r.t.label.length <= 6 ? 30 : 20; g.font = `bold ${fs}px system-ui, sans-serif`;
      const ls = wrap(g, r.t.label, LAB - 16); ls.forEach((l, k) => g.fillText(l, PAD + LAB / 2, y + (h - 2) / 2 + (k - (ls.length - 1) / 2) * fs * 1.1));
      r.ids.forEach((id, k) => {
        const x = PAD + LAB + GAP + (k % perRow) * (S + GAP), yy = y + GAP + Math.floor(k / perRow) * (S + GAP), it = cur.items[id], im = imgs[id];
        g.fillStyle = '#1f222b'; g.fillRect(x, yy, S, S);
        if (im) { const z = Math.max(S / im.width, S / im.height), w = im.width * z, hh = im.height * z; g.save(); g.beginPath(); g.rect(x, yy, S, S); g.clip(); g.drawImage(im, x + (S - w) / 2, yy + (S - hh) / 2, w, hh); g.restore(); }
        else { g.fillStyle = '#fff'; g.font = 'bold 17px system-ui, sans-serif'; const ls2 = wrap(g, it?.txt || '', S - 10).slice(0, 5); ls2.forEach((l, j) => g.fillText(l, x + S / 2, yy + S / 2 + (j - (ls2.length - 1) / 2) * 20)); }
      });
      g.textAlign = 'left'; y += h;
    });
    g.fillStyle = '#8b8f9c'; g.font = '15px system-ui, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillText('FUNVS · ' + new Date().toLocaleDateString('es-AR'), W - PAD, H - 20);
    let png = c.toDataURL('image/webp', .9); if (!/^data:image\/webp/.test(png)) png = c.toDataURL('image/jpeg', .9);
    return png;
  }
  async function terminar() {
    const placed = cur.tiers.reduce((a, t) => a + (cur.rows[t.id] || []).length, 0);
    if (!placed) return toast('<b>Todavía no ubicaste nada</b><small>Arrastrá alguna imagen a una fila antes de guardar.</small>', { cls:'info' });
    if (!cur.title.trim()) { const t = prompt('¿Qué título le ponemos?', ''); if (t === null) return; cur.title = t.trim() || 'Tierlist sin título'; }
    const pic = await snapshot(), at = Date.now(), m = list.find(x => x.id === cur.id);
    await put('pic:' + cur.id, pic); await put('st:' + cur.id, JSON.parse(JSON.stringify(cur)));
    if (m) { m.title = cur.title; m.at = at; } else list.unshift({ id:cur.id, title:cur.title, at });
    list.sort((a, b) => b.at - a.at); await put('list', list);
    cur = fresh(); await put('cur', cur); selId = null; tab = 'mis';
    toast(`<b>📸 Tierlist guardada</b><small>${esc(list[0].title)} · está en "Mis tierlists".</small>`, { cls:'info', ms:4000 });
    render(); openView(list[0].id);
  }

  /* ---------- ver una guardada ---------- */
  async function openView(id) {
    const m = list.find(x => x.id === id); if (!m) return; const pic = await get('pic:' + id); if (!pic) return toast('<b>No encontré la captura</b>', { cls:'info' });
    viewer?.remove();
    viewer = document.createElement('div'); viewer.className = 'tlview';
    viewer.innerHTML = `<div class="tlvbox"><div class="tlvhead"><b>${esc(m.title)}</b><small class="mut">${new Date(m.at).toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' })}</small><button data-tv="x" title="Cerrar">✕</button></div>
      <img src="${pic}" alt="${esc(m.title)}">
      ${Device.mode === 'tv' ? '' : `<div class="btns"><button class="pri" data-tv="dl">⬇ Descargar</button><button data-tv="ed">✏️ Editar</button><button data-tv="rm">🗑 Borrar</button></div>`}</div>`;
    document.body.appendChild(viewer);
    const close = () => { viewer?.remove(); viewer = null; };
    viewer.onclick = e => { if (e.target === viewer) close(); };
    viewer.querySelector('[data-tv="x"]').onclick = close;
    viewer.querySelector('[data-tv="x"]').focus();
    viewer.querySelector('[data-tv="dl"]')?.addEventListener('click', async () => { const b = await (await fetch(pic)).blob(); saveFile(b, `tierlist-${(m.title || 'funvs').replace(/[^\wáéíóúñ -]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'funvs'}.${b.type.includes('webp') ? 'webp' : 'jpg'}`); });
    viewer.querySelector('[data-tv="ed"]')?.addEventListener('click', async () => {
      const hayAlgo = Object.keys(cur.items).length; if (hayAlgo && !confirm('Tenés una tierlist a medio armar. ¿La reemplazo por esta para editarla?')) return;
      const s = await get('st:' + id); if (!s) return toast('<b>No tengo guardado cómo estaba armada</b>', { cls:'info' });
      cur = s; persist(); tab = 'armar'; close(); render(); });
    viewer.querySelector('[data-tv="rm"]')?.addEventListener('click', async () => {
      if (!confirm(`¿Borrar "${m.title}"? No se puede deshacer.`)) return;
      list = list.filter(x => x.id !== id); await put('list', list); await del('pic:' + id); await del('st:' + id); close(); render(); });
  }

  /* ---------- pantalla ---------- */
  async function render() {
    const v = $('v-tierlist'); if (!v) return;
    await load();
    const tv = Device.mode === 'tv'; if (tv) tab = 'mis';
    const head = `<div class="tabs tltabs">${tv ? '' : `<button data-tlt="armar" class="${tab === 'armar' ? 'on' : ''}">✏️ Armar</button>`}<button data-tlt="mis" class="${tab === 'mis' ? 'on' : ''}">🗂️ Mis tierlists <span class="cnt">${list.length}</span></button></div>`;
    if (tab === 'mis') {
      const pics = {}; for (const m of list) pics[m.id] = await get('pic:' + m.id).catch(() => null);
      v.innerHTML = head + (list.length ? `<div class="tlgal">${list.map(m => `<button class="tlcard" data-tlo="${m.id}"><span style="background-image:url('${pics[m.id] || ''}')"></span><b>${esc(m.title)}</b><small>${new Date(m.at).toLocaleDateString('es-AR', { day:'numeric', month:'short', year:'numeric' })}</small></button>`).join('')}</div>`
        : `<div class="empty">Todavía no guardaste ninguna tierlist.${tv ? ' Armalas en el celu o la compu.' : ' Armá una en ✏️ Armar y tocá 📸 Terminar.'}</div>`) +
        '<p class="mut tlnote">Las tierlists quedan guardadas en este aparato. Para pasarlas a otro, descargá la imagen.</p>';
      v.querySelectorAll('[data-tlt]').forEach(b => b.onclick = () => { tab = b.dataset.tlt; render(); });
      v.querySelectorAll('[data-tlo]').forEach(b => b.onclick = () => openView(b.dataset.tlo));
      return;
    }
    const tile = id => { const it = cur.items[id] || {}; return `<div class="tlitem ${selId === id ? 'sel' : ''} ${it.img ? '' : 'txt'}" data-tli="${id}" ${it.img ? `style="background-image:url('${it.img}')"` : ''}>${it.img ? '' : `<span>${esc(it.txt)}</span>`}${selId === id ? `<button class="tlx" data-tlx="${id}" title="Sacar">✕</button>` : ''}</div>`; };
    v.innerHTML = head + `
      <div class="box tlbar"><input id="tlTitle" placeholder="Título (ej.: Discos de Miss May I)" value="${esc(cur.title)}" maxlength="80">
        <button class="pri" data-tla="fin">📸 Terminar y guardar</button></div>
      ${selId ? '<p class="tlhint">Elegiste una: tocá la fila donde va, o ✕ para sacarla.</p>' : ''}
      <div class="tlboard">${cur.tiers.map((t, i) => `<div class="tlrowwrap">
        <div class="tllab" style="background:${esc(t.color)};color:${ink(t.color)}"><input value="${esc(t.label)}" data-tll="${t.id}" maxlength="24" aria-label="Nombre de la fila"></div>
        <div class="tlrow" data-tlrow="${t.id}">${(cur.rows[t.id] || []).map(tile).join('')}</div>
        <div class="tltools"><label class="tlcol" title="Elegir color" style="background:${esc(t.color)}"><input type="color" data-tlc="${t.id}" value="${esc(t.color)}"></label><button class="sm" data-tlu="${i}" title="Subir" ${i ? '' : 'disabled'}>▲</button><button class="sm" data-tld="${i}" title="Bajar" ${i < cur.tiers.length - 1 ? '' : 'disabled'}>▼</button><button class="sm" data-tlr="${t.id}" title="Borrar fila">✕</button></div></div>`).join('')}
      </div>
      <div class="btns tladdrow"><span class="tlcnt">Categorías: <button class="sm" data-tla="less" ${cur.tiers.length > 1 ? '' : 'disabled'}>−</button><b>${cur.tiers.length}</b><button class="sm" data-tla="row" ${cur.tiers.length < 15 ? '' : 'disabled'}>＋</button></span>
        <span class="tlpal">${COLS.map(c => `<button class="tlsw" data-tlsw="${c}" style="background:${c}" title="Pintar todas en degradé desde este color"></button>`).join('')}<button class="sm" data-tlclasico title="Rojo, naranja, amarillo, verde, azul…">🌈 Clásicos</button><button class="sm" data-tlvelez title="Del blanco al azul oscuro">💙 Vélez</button></span></div>
      <div class="box tlpoolbox"><div class="tlpoolhead"><b>🖼️ Sin ubicar</b>
        <div class="btns"><button class="pri" data-tla="paste">📋 Pegar</button><label class="btn"><input type="file" accept="image/*" multiple data-tlf hidden>＋ Subir</label><button data-tla="txt">＋ Texto</button><button data-tla="new">🧹 Empezar de nuevo</button></div></div>
        <div class="tlrow tlpool" data-tlrow="pool">${cur.rows.pool.map(tile).join('') || `<span class="mut tlempty">${Device.mode === 'pc' ? 'Copiá una imagen y apretá <b>Ctrl+V</b> acá, arrastrá archivos o usá los botones.' : 'Copiá una imagen (mantené apretado → Copiar) y tocá <b>📋 Pegar</b>, o subila de la galería.'}</span>`}</div></div>
      <p class="mut tlnote">Arrastrá cada imagen a su fila (con el dedo o el mouse). También podés tocar una y después tocar la fila. Los nombres y colores de las filas se cambian ahí mismo.</p>`;
    v.querySelectorAll('[data-tlt]').forEach(b => b.onclick = () => { tab = b.dataset.tlt; render(); });
    $('tlTitle').oninput = e => { cur.title = e.target.value; persist(); };
    v.querySelectorAll('[data-tll]').forEach(i => { i.oninput = () => { cur.tiers.find(t => t.id === i.dataset.tll).label = i.value; persist(); }; i.onpointerdown = e => e.stopPropagation(); });
    v.querySelectorAll('[data-tlc]').forEach(i => { i.oninput = () => { const t = cur.tiers.find(x => x.id === i.dataset.tlc); t.color = i.value; const row = i.closest('.tlrowwrap'); row.querySelector('.tllab').style.background = i.value; row.querySelector('.tllab').style.color = ink(i.value); i.parentElement.style.background = i.value; persist(); }; });
    const swap = (i, j) => { [cur.tiers[i], cur.tiers[j]] = [cur.tiers[j], cur.tiers[i]]; persist(); render(); };
    v.querySelectorAll('[data-tlu]').forEach(b => b.onclick = () => swap(+b.dataset.tlu, +b.dataset.tlu - 1));
    v.querySelectorAll('[data-tld]').forEach(b => b.onclick = () => swap(+b.dataset.tld, +b.dataset.tld + 1));
    v.querySelectorAll('[data-tlr]').forEach(b => b.onclick = () => { const id = b.dataset.tlr, n = (cur.rows[id] || []).length;
      if (n && !confirm(`Esa fila tiene ${n}. ¿La borro? Las imágenes vuelven a "Sin ubicar".`)) return;
      cur.rows.pool.push(...(cur.rows[id] || [])); delete cur.rows[id]; cur.tiers = cur.tiers.filter(t => t.id !== id); persist(); render(); });
    const LET = 'SABCDEFGHIJKLMNO';
    v.querySelector('[data-tla="row"]').onclick = () => { const id = uid(); cur.tiers.push({ id, label:LET[cur.tiers.length] || 'Nueva', color:COLS[cur.tiers.length % COLS.length] }); cur.rows[id] = []; persist(); render(); };
    v.querySelector('[data-tla="less"]').onclick = () => { const t = cur.tiers[cur.tiers.length - 1], n = (cur.rows[t.id] || []).length; if (n && !confirm(`La última fila (${t.label}) tiene ${n}. ¿La saco? Las imágenes vuelven a "Sin ubicar".`)) return; cur.rows.pool.push(...(cur.rows[t.id] || [])); delete cur.rows[t.id]; cur.tiers.pop(); persist(); render(); };
    const RAIN = ['#ff7f7f', '#ffbf7f', '#ffdf7f', '#ffff7f', '#bfff7f', '#7fff7f', '#7fffff', '#7fbfff', '#7f7fff', '#ff7fff', '#bf7fbf', '#9aa0ad'];
    v.querySelector('[data-tlclasico]').onclick = () => { cur.tiers.forEach((t, i) => t.color = RAIN[i % RAIN.length]); persist(); render(); };
    v.querySelector('[data-tlvelez]').onclick = () => { cur.tiers.forEach((t, i) => t.color = COLS[i % COLS.length]); persist(); render(); };
    // un toque en la paleta: pinta todas las filas en degradé, del color elegido al negro
    v.querySelectorAll('[data-tlsw]').forEach(b => b.onclick = () => { const h = b.dataset.tlsw, n = cur.tiers.length, rgb = [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)); cur.tiers.forEach((t, i) => { const f = n > 1 ? 1 - i / (n - 1) * .8 : 1; t.color = '#' + rgb.map(c => Math.round(c * f).toString(16).padStart(2, '0')).join(''); }); persist(); render(); });
    v.querySelector('[data-tla="paste"]').onclick = async () => { try { addFiles(await clipImages()); } catch (er) { toast(`<b>${esc(er.message)}</b>`, { cls:'info' }); } };
    v.querySelector('[data-tlf]').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
    v.querySelector('[data-tla="txt"]').onclick = () => { const t = prompt('Texto de la ficha (ej.: el nombre de una banda):'); if (!t?.trim()) return; const id = uid(); cur.items[id] = { txt:t.trim().slice(0, 60) }; cur.rows.pool.push(id); persist(); render(); };
    v.querySelector('[data-tla="new"]').onclick = () => { if (Object.keys(cur.items).length && !confirm('¿Borrar todo lo que armaste y empezar de cero? (Las guardadas no se tocan.)')) return; cur = fresh(); selId = null; persist(); render(); };
    v.querySelector('[data-tla="fin"]').onclick = () => terminar();
    v.querySelectorAll('[data-tlx]').forEach(b => b.onclick = e => { e.stopPropagation(); const id = b.dataset.tlx; const r = rowOf(id); if (r) cur.rows[r] = cur.rows[r].filter(x => x !== id); delete cur.items[id]; selId = null; persist(); render(); });
    const board = v; board.ondragover = e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); };
    board.ondrop = e => { const f = [...(e.dataTransfer?.files || [])]; if (f.length) { e.preventDefault(); addFiles(f); } };
    bindDrag(v);
  }
  return { render };
})();
