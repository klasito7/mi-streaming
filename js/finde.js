/* =========================================================
   📄 El fin de semana en un PDF con diseño de tarjetas: F1, Moto3, Moto2, MotoGP, Turismo Nacional (horarios de Argentina) y Huracán si juega.
   Horarios: APIs oficiales (motogp.com y la de la F1 que usa Jolpica) que junta GitHub.
   Partido: ESPN (fecha, cancha, árbitro, tabla, cómo viene, cruces) + la guía de TV de FUNVS.
   ========================================================= */
const Finde = (() => {
  const TZ = 'America/Argentina/Buenos_Aires';
  const dia = d => new Intl.DateTimeFormat('es-AR', { timeZone:TZ, weekday:'long', day:'numeric', month:'long' }).format(d);
  const hhmm = d => new Intl.DateTimeFormat('es-AR', { timeZone:TZ, hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(d);
  const keyDay = d => new Intl.DateTimeFormat('en-CA', { timeZone:TZ }).format(d);
  const mins = (a, b) => b ? Math.round((Date.parse(b) - Date.parse(a)) / 60e3) : 0;

  // la ventana del finde: de jueves a lunes alrededor del próximo domingo (si hoy es lunes, el finde que viene)
  function ventana() {
    const now = new Date(), d = new Date(now); d.setHours(0, 0, 0, 0);
    const toSun = (7 - d.getDay()) % 7; const sun = new Date(d); sun.setDate(d.getDate() + toSun);
    const from = new Date(sun); from.setDate(sun.getDate() - 3); const to = new Date(sun); to.setDate(sun.getDate() + 1); to.setHours(23, 59, 59);
    return { from, to };
  }
  const inWin = (iso, w) => { const t = Date.parse(iso); return t >= +w.from && t <= +w.to; };

  // nombres como los querés vos
  const MOTO = { 'Free Practice Nr. 1':'Práctica libre 1', 'Practice':'Práctica libre', 'Free Practice Nr. 2':'Práctica libre 2', 'Free Practice Nr. 3':'Práctica libre 3',
    'Qualifying Nr. 1':'Clasificación', 'Qualifying Nr. 2':null, 'Qualifying':'Clasificación', 'Tissot Sprint':'Carrera sprint', 'Sprint':'Carrera sprint', 'Warm Up':'Warmup', 'Grand Prix':'CARRERA', 'Race':'CARRERA' };
  const F1N = { 'Libres 1':'Práctica libre 1', 'Libres 2':'Práctica libre 2', 'Libres 3':'Práctica libre 3', 'Clasificación Sprint':'Clasificación sprint', 'Sprint':'Carrera sprint', 'Clasificación':'Clasificación', 'Carrera':'CARRERA' };
  const motoName = x => { if (x.n in MOTO) return MOTO[x.n]; if (x.k === 'RACE') return /sprint/i.test(x.n) ? 'Carrera sprint' : 'CARRERA'; if (x.k === 'QUALIFYING') return /2/.test(x.n) ? null : 'Clasificación'; if (x.k === 'WARM_UP') return 'Warmup'; return x.n; };

  // 🃏 cada categoría es una tarjeta: { color, title, sub, items:[{day}|{row}|{sec}|{kv}|{txt}|{note}] }
  const COL = { 'FÓRMULA 1':'#c8102e', MOTOGP:'#111827', MOTO2:'#3b3b98', MOTO3:'#0b7a75', 'TURISMO NACIONAL':'#1238b5', futbol:'#b3121b' };
  const diaTit = d => dia(d).replace(/^\w/, c => c.toUpperCase()).replace(/,/, '');
  function bloque(titulo, gp, ses, conMin) {   // ses: [{s, e, n, tag}] ya en orden
    const items = []; let last = '';
    for (const x of ses) { const d = new Date(x.s), k = keyDay(d);
      if (k !== last) { last = k; items.push({ day:diaTit(d) }); }
      const m = mins(x.s, x.e);
      items.push({ row:true, time:hhmm(d), name:x.n, tag:x.tag || '', dur:conMin && m > 0 && m < 240 ? m + ' min' : '', big:/^(CARRERA|FINAL)/.test(x.n) }); }
    return { color:COL[titulo] || '#1238b5', title:titulo, sub:`${gp || 'Gran Premio'} · horarios de Argentina`, items, sched:true };
  }
  // las líneas del partido (formato viejo) pasadas a tarjeta
  function fromLines(L, color) {
    const c = { color, title:'', sub:'', items:[] };
    for (const x of L) {
      if (x.h === 1) c.title = x.t; else if (x.h === 3) c.sub = x.t;
      else if (x.h === 2) c.items.push({ sec:x.t }); else if (x.h === 4) c.items.push({ sub:x.t });
      else if (x.small) c.items.push({ note:x.t });
      else { const i = x.t.indexOf('  '); c.items.push(i > 0 ? { k:x.t.slice(0, i).trim(), v:x.t.slice(i).trim() } : { txt:x.t }); }
    }
    return c;
  }

  async function motos(w) {
    const data = await Motor.data(), out = []; const nx = data?.cats?.motogp?.next; if (!nx) return out;
    const all = nx.all || {}, find = re => Object.entries(all).find(([k]) => re.test(k))?.[1];
    for (const [tit, re, conMin] of [['MOTO3', /^(MT3|M3|MOTO3)$/i, false], ['MOTO2', /^(MT2|M2|MOTO2)$/i, false], ['MOTOGP', /^(MGP|MOTOGP)$/i, true]]) {
      let l = find(re); if (!l && tit === 'MOTOGP') l = (nx.sessions || []).map(x => ({ n:x.name === 'Carrera' ? 'Grand Prix' : x.name, s:x.start, e:x.end, k:x.race ? 'RACE' : '' }));
      const ses = (l || []).filter(x => inWin(x.s, w)).map(x => ({ s:x.s, e:x.e, n:motoName(x) })).filter(x => x.n);
      if (ses.length) out.push(bloque(tit, nx.name, ses, conMin));
    }
    return out;
  }
  async function f1(w) {
    const data = await Motor.data(), nx = data?.cats?.f1?.next; if (!nx) return null;
    const ses = (nx.sessions || []).filter(x => inWin(x.start, w)).map(x => ({ s:x.start, n:F1N[x.name] || x.name }));
    return ses.length ? bloque('FÓRMULA 1', nx.name, ses, false) : null;
  }

  async function tn(w) {
    const data = await Motor.data(), nx = data?.cats?.tn?.next; if (!nx || nx.dayOnly) return null;
    const ses = (nx.sessions || []).filter(x => inWin(x.start, w)).map(x => ({ s:x.start, e:x.end, n:x.race ? 'FINAL' + (x.n.replace(/^FINAL/i, '') || '') : x.n, tag:x.cls }));
    if (!ses.length) return null;
    const c = bloque('TURISMO NACIONAL', `Fecha ${nx.round} · ${nx.circuit || nx.name}`, ses, false);
    if (data.cats.tn.tv?.length) c.items.push({ note:'TV: ' + data.cats.tn.tv.join(', ') });
    return c;
  }

  /* ⚽ Huracán (ESPN) */
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';
  const J = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); };
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  async function huracan(w) {
    const lg = 'arg.1';
    const teams = (await J(ESPN + lg + '/teams')).sports?.[0]?.leagues?.[0]?.teams?.map(t => t.team) || [];
    const me = teams.find(t => /hurac/i.test(norm(t.displayName))); if (!me) return null;
    const sch = await J(ESPN + lg + '/teams/' + me.id + '/schedule?fixture=true').catch(() => null);
    const ev = (sch?.events || []).find(e => inWin(e.date, w)); if (!ev) return null;
    const sum = await J(ESPN + lg + '/summary?event=' + ev.id).catch(() => ({}));
    const comp = sum.header?.competitions?.[0] || ev.competitions?.[0] || {}, cs = comp.competitors || [];
    const home = cs.find(c => c.homeAway === 'home') || cs[0], away = cs.find(c => c.homeAway === 'away') || cs[1];
    const nm = c => c?.team?.displayName || c?.team?.name || '';
    const d = new Date(comp.date || ev.date), L = [];
    L.push({ h:1, t:`${nm(home)} VS ${nm(away)}`.toUpperCase() });
    // tabla: zona y puesto
    const groups = (sum.standings?.groups || []).flatMap(g => g.standings?.entries ? [g] : (g.groups || []));
    const rowOf = c => { for (const g of groups) { const e = (g.standings?.entries || []).find(x => String(x.team?.id ?? x.id) === String(c?.team?.id) || norm(x.team?.displayName ?? x.team) === norm(nm(c)));
      if (e) { const st = k => e.stats?.find(s => s.name === k || s.abbreviation === k)?.displayValue; return { zona:g.header || g.name || '', pos:e.stats ? (st('rank') || (g.standings.entries.indexOf(e) + 1)) : g.standings.entries.indexOf(e) + 1, pts:st('points') || st('P') || '', n:g.standings.entries.length }; } } return null; };
    const rh = rowOf(home), ra = rowOf(away), meRow = rowOf(home?.team?.id === me.id ? home : away);
    L.push({ h:3, t:[sum.header?.league?.name || ev.league?.name || 'Liga Profesional', ev.week?.number ? 'Fecha ' + ev.week.number : '', meRow?.zona].filter(Boolean).join(' - ') });
    L.push({ h:2, t:'CUÁNDO Y DÓNDE' });
    L.push({ t:`Día  ${dia(d).replace(/^\w/, c => c.toUpperCase())}` });
    L.push({ t:`Hora  ${hhmm(d)} hs (hora de Argentina)` });
    const tv = await canal(nm(home), nm(away), d);
    L.push({ t:`Por TV  ${tv || 'a confirmar'}` });
    const venue = sum.gameInfo?.venue?.fullName || comp.venue?.fullName; if (venue) L.push({ t:`Cancha  ${venue} (${nm(home)} es local)` });
    const ref = (sum.gameInfo?.officials || []).find(o => /referee|árbitro/i.test(o.position?.name || o.position?.displayName || '') || o.order === 1); if (ref) L.push({ t:`Árbitro  ${ref.displayName || ref.fullName}` });
    L.push({ h:2, t:'CÓMO LLEGA CADA EQUIPO' });
    const form = c => { const f = (sum.boxscore?.form || []).find(x => String(x.team?.id) === String(c?.team?.id)); return f?.events || []; };
    const racha = evs => { if (!evs.length) return ''; const r = evs.map(e => e.gameResult); const f = r[0]; let n = 0; for (const x of r) { if (x === f) n++; else break; }
      const w = { W:['victoria', 'victorias'], L:['derrota', 'derrotas'], D:['empate', 'empates'] }[f]; return w ? `${n} ${n === 1 ? w[0] : w[1]} seguid${n === 1 ? (f === 'D' ? 'o' : 'a') : (f === 'D' ? 'os' : 'as')}` : ''; };
    const ultimo = (c, evs) => { const e = evs[0]; if (!e) return ''; const verb = { W:'Ganó', L:'Perdió', D:'Empató' }[e.gameResult] || ''; return `${verb} ${e.score || ''} contra ${e.opponent?.displayName || ''}`.trim(); };
    for (const [c, r] of [[home, rh], [away, ra]]) { const evs = form(c);
      L.push({ h:4, t:nm(c).toUpperCase() });
      if (r) L.push({ t:`Puesto en su zona  ${r.pos}°${r.pts ? ` (${r.pts} puntos)` : ''}` });
      if (racha(evs)) L.push({ t:`Cómo viene  ${racha(evs)}` });
      if (ultimo(c, evs)) L.push({ t:`Último partido  ${ultimo(c, evs)}` }); }
    if (meRow) { L.push({ h:2, t:'LO QUE SE JUEGA' });
      const cut = 8, mp = +meRow.pos; L.push({ t: mp <= cut ? `Huracán está ${mp === cut ? 'en el último lugar que' : 'en zona que'} clasifica a los playoffs (los ${cut} primeros de la zona).` : `Huracán está ${mp - cut} puesto${mp - cut === 1 ? '' : 's'} abajo del último que clasifica a los playoffs (los ${cut} primeros de la zona).` }); }
    const h2h = (sum.headToHeadGames || []).flatMap(x => x.events || []).slice(0, 5);
    if (h2h.length) { L.push({ h:2, t:'LOS ÚLTIMOS 5 CRUCES' });
      const hw = h2h.filter(e => (e.gameResult === 'W')).length, hl = h2h.filter(e => e.gameResult === 'L').length, hd = h2h.length - hw - hl, team = nm(sum.headToHeadGames?.[0]?.team ? { team:sum.headToHeadGames[0].team } : home);
      L.push({ t:`${team} ganó ${hw}, ${team === nm(home) ? nm(away) : nm(home)} ganó ${hl}, ${hd} empate${hd === 1 ? '' : 's'}.` });
      const u = h2h[0]; if (u) L.push({ t:`El último fue el ${new Intl.DateTimeFormat('es-AR', { day:'numeric', month:'long', year:'numeric', timeZone:TZ }).format(new Date(u.gameDate))}: ${u.homeTeamScore != null ? `${u.homeTeam?.displayName || ''} ${u.homeTeamScore} - ${u.awayTeamScore} ${u.awayTeam?.displayName || ''}` : (u.score || '')}.` }); }
    L.push({ small:true, t:'Datos de ESPN y de la guía de TV de FUNVS. Los horarios pueden cambiar: conviene confirmarlos antes del partido.' });
    return L;
  }
  async function canal(h, a, d) {
    try { const g = await (await fetch(REPO.data + 'tv.json?t=' + Math.floor(Date.now() / 600e3))).json();
      const w = s => new Set(norm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(x => x.length > 2 && !['club', 'atletico', 'deportivo'].includes(x)));
      const same = (x, y) => [...w(x)].some(t => w(y).has(t));
      const m = (g.matches || []).find(m => Math.abs(Date.parse(m.date) - d) < 2 * 864e5 && ((same(m.home, h) && same(m.away, a)) || (same(m.home, a) && same(m.away, h))));
      return m?.channels?.join(', ') || ''; } catch { return ''; }
  }

  /* 📄 armar, mostrar y bajar */
  let cards = [], lines = [];
  const rango = w => { const a = new Date(w.from), b = new Date(w.to);
    const f = (d, o) => new Intl.DateTimeFormat('es-AR', { timeZone:TZ, ...o }).format(d);
    return `Del ${f(a, { weekday:'long', day:'numeric' })} al ${f(b, { weekday:'long', day:'numeric', month:'long' })}`.replace(/,/g, ''); };
  const asText = () => cards.map(c => [c.title, c.sub, ...c.items.map(x => x.day ? '\n' + x.day.toUpperCase() : x.row ? `${x.time} hs  ${x.name}${x.tag ? ' (' + x.tag + ')' : ''}${x.dur ? '  ' + x.dur : ''}` : x.sec ? '\n' + x.sec : x.sub ? x.sub : x.k ? `${x.k}: ${x.v}` : x.txt || x.note || '')].join('\n')).join('\n\n');
  const cardHtml = c => `<article class="fdc ${c.sched ? '' : 'wide'}" style="--c:${c.color}"><header><b>${esc(c.title)}</b>${c.sub ? `<span>${esc(c.sub)}</span>` : ''}</header><div>${c.items.map(x =>
    x.day ? `<h5>${esc(x.day)}</h5>` : x.row ? `<p class="r ${x.big ? 'big' : ''}"><i>${esc(x.time)}</i><span>${esc(x.name)}${x.tag ? ` <em>${esc(x.tag)}</em>` : ''}</span>${x.dur ? `<small>${esc(x.dur)}</small>` : ''}</p>`
    : x.sec ? `<h5>${esc(x.sec)}</h5>` : x.sub ? `<h6>${esc(x.sub)}</h6>` : x.k ? `<p class="kv"><small>${esc(x.k)}</small><span>${esc(x.v)}</span></p>` : x.note ? `<p class="nt">${esc(x.note)}</p>` : `<p>${esc(x.txt)}</p>`).join('')}</div></article>`;
  const prevHtml = () => `<div class="fdhead"><b>EL FINDE</b><span>${esc(rango(ventana()))} · horarios de Argentina</span></div><div class="fdcards">${cards.map(cardHtml).join('')}</div>`;
  async function open() {
    const o = document.createElement('div'); o.id = 'findeDlg';
    o.innerHTML = `<div class="fdbox"><div class="btns"><b>📄 El finde: horarios de Argentina</b><span class="sp"></span><button data-fx>✕</button></div><div class="fdbody"><p class="mut">Armando los horarios…</p></div></div>`;
    document.body.appendChild(o); o.querySelector('[data-fx]').onclick = () => o.remove(); o.onclick = e => { if (e.target === o) o.remove(); };
    const w = ventana(), body = o.querySelector('.fdbody');
    const parts = await Promise.allSettled([motos(w), f1(w), tn(w), huracan(w)]);
    cards = [parts[1].value, ...(parts[0].value || []).slice().reverse(), parts[2].value, parts[3].value ? fromLines(parts[3].value, COL.futbol) : null].filter(Boolean);
    const fails = parts.filter(p => p.status === 'rejected').length;
    if (!cards.length) { body.innerHTML = `<p>No encontré carreras ni partido de Huracán entre el jueves y el lunes de este finde.</p>${fails ? '<p class="mut">Algunas fuentes no respondieron: probá en un rato.</p>' : ''}`; return; }
    body.innerHTML = `<style>${CARD_CSS.replace(/(^|\})\s*\./g, '$1 .fdprev .')}</style><div class="fdprev">${prevHtml()}</div>
      <p class="mut fdsrc">Horarios de motogp.com, de la F1 (vía Jolpica) y de la APAT (Turismo Nacional), en hora de Argentina. Partido: ESPN y la guía de TV.</p>
      <div class="btns"><button class="pri" data-fpdf>📄 Bajar PDF</button><button data-fcp>📋 Copiar texto</button><button data-fpr>🖨️ Imprimir</button></div>`;
    body.querySelector('[data-fcp]').onclick = async () => { try { await navigator.clipboard.writeText(asText()); toast('📋 Copiado', { ms:1500 }); } catch { toast('No pude copiar', { cls:'info' }); } };
    body.querySelector('[data-fpr]').onclick = () => printIt();
    body.querySelector('[data-fpdf]').onclick = () => pdf().catch(e => toast(`<b>No pude armar el PDF</b><small>${esc(e.message)}</small>`, { cls:'info' }));
  }
  const CARD_CSS = `.fdhead{background:#1238b5;color:#fff;border-radius:10px;padding:12px 16px;margin-bottom:12px;display:flex;flex-direction:column}.fdhead b{font:800 22px/1 system-ui;letter-spacing:2px}.fdhead span{font-size:12px;opacity:.9;margin-top:4px}
.fdcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;align-items:start}.fdc{border:1px solid #dde1ea;border-radius:10px;overflow:hidden;background:#fff;break-inside:avoid}.fdc.wide{grid-column:1/-1}
.fdc header{background:var(--c);color:#fff;padding:8px 12px;display:flex;flex-direction:column}.fdc header b{font-size:15px;letter-spacing:.5px}.fdc header span{font-size:11px;opacity:.9}
.fdc>div{padding:6px 12px 10px}.fdc h5{margin:8px 0 3px;font-size:10.5px;text-transform:uppercase;letter-spacing:.6px;color:var(--c);border-bottom:1px solid #eceef3;padding-bottom:2px}.fdc h6{margin:6px 0 2px;font-size:12px;color:var(--c)}
.fdc p{margin:3px 0;font-size:12.5px;color:#1b1f2a}.fdc .r{display:flex;align-items:center;gap:8px}.fdc .r i{font-style:normal;font-weight:700;font-size:11.5px;background:color-mix(in srgb,var(--c) 14%,#fff);color:var(--c);border-radius:6px;padding:2px 0;width:44px;text-align:center;flex:none}
.fdc .r span{flex:1}.fdc .r em{font-style:normal;font-size:10px;color:#667;background:#f1f2f6;border-radius:4px;padding:0 4px}.fdc .r small{color:#778;font-size:10.5px}.fdc .r.big i{background:var(--c);color:#fff}.fdc .r.big span{font-weight:800}
.fdc .kv{display:flex;gap:8px}.fdc .kv small{width:104px;flex:none;color:#778;font-size:11px;padding-top:1px}.fdc .nt{font-size:10.5px;color:#778;margin-top:6px}`;
  function printIt() {
    const w = window.open('', '_blank'); if (!w) return toast('El navegador bloqueó la ventana', { cls:'info' });
    w.document.write(`<!doctype html><meta charset="utf-8"><title>El finde</title><style>body{font:14px/1.4 system-ui;margin:20px;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}${CARD_CSS}</style>${prevHtml()}`);
    w.document.close(); setTimeout(() => w.print(), 300);
  }
  let jsp = null;
  const loadJsPDF = () => jsp || (jsp = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'; s.onload = () => ok(window.jspdf.jsPDF); s.onerror = () => { jsp = null; no(new Error('No se pudo cargar el armador de PDF (¿sin internet?)')); }; document.head.appendChild(s); }));
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const tint = (h, a) => rgb(h).map(v => Math.round(v * a + 255 * (1 - a)));
  // dibuja (o mide, si dry) una tarjeta; devuelve el alto
  function drawCard(doc, c, x, y, w, dry) {
    const C = rgb(c.color), P = 10, ink = [27, 31, 42], grey = [120, 124, 138];
    const T = (t, sz, st, col, tx, ty, o) => { if (!dry) { doc.setFont('helvetica', st); doc.setFontSize(sz); doc.setTextColor(...col); doc.text(t, tx, ty, o); } };
    const wrap = (t, sz, st, ww) => { doc.setFont('helvetica', st); doc.setFontSize(sz); return doc.splitTextToSize(String(t), ww); };
    const subL = c.sub ? wrap(c.sub, 8.5, 'normal', w - 2 * P) : [];
    const hh = 24 + subL.length * 10 + (subL.length ? 4 : 0);
    let cy = y + hh + 6;
    const body = [];   // [fn] para dibujar después del fondo
    let first = true;
    for (const it of c.items) {
      if (it.day || it.sec) { cy += first ? 2 : 7; const t = (it.day || it.sec).toUpperCase(), yy = cy;
        body.push(() => { T(t, 8, 'bold', C, x + P, yy + 8); doc.setDrawColor(230, 232, 238); doc.setLineWidth(0.6); doc.line(x + P, yy + 11.5, x + w - P, yy + 11.5); }); cy += 16; }
      else if (it.sub) { cy += 3; const yy = cy; body.push(() => T(it.sub, 9.5, 'bold', C, x + P, yy + 9)); cy += 13; }
      else if (it.row) {
        const dw = it.dur ? (doc.setFont('helvetica', 'normal'), doc.setFontSize(8), doc.getTextWidth(it.dur) + 6) : 0;
        const tagW = it.tag ? (doc.setFont('helvetica', 'normal'), doc.setFontSize(7), doc.getTextWidth(it.tag) + 8) : 0;
        const nl = wrap(it.name, 9.5, it.big ? 'bold' : 'normal', w - 2 * P - 46 - dw - (tagW ? tagW + 4 : 0)), rh = Math.max(15.5, nl.length * 11.5 + 4), yy = cy;
        body.push(() => {
          doc.setFillColor(...(it.big ? C : tint(c.color, 0.14))); doc.roundedRect(x + P, yy + 1, 38, 13, 3, 3, 'F');
          T(it.time, 8.5, 'bold', it.big ? [255, 255, 255] : C, x + P + 19, yy + 10.3, { align:'center' });
          nl.forEach((ln, i) => T(ln, 9.5, it.big ? 'bold' : 'normal', ink, x + P + 46, yy + 11 + i * 11.5));
          if (it.tag) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); const nx = x + P + 46 + Math.min(doc.getTextWidth(nl[0] || ''), w); doc.setFillColor(241, 242, 246); doc.roundedRect(nx + 4, yy + 3.5, tagW, 10, 2, 2, 'F'); T(it.tag, 7, 'normal', grey, nx + 8, yy + 10.6); }
          if (it.dur) T(it.dur, 8, 'normal', grey, x + w - P, yy + 10.8, { align:'right' });
        });
        cy += rh;
      }
      else if (it.k) { const vl = wrap(it.v, 9.5, 'normal', w - 2 * P - 92), yy = cy;
        body.push(() => { T(it.k, 8, 'normal', grey, x + P, yy + 10); vl.forEach((ln, i) => T(ln, 9.5, 'normal', ink, x + P + 92, yy + 10 + i * 11.5)); }); cy += vl.length * 11.5 + 4; }
      else if (it.note) { const nl = wrap(it.note, 7.5, 'normal', w - 2 * P), yy = cy + 3; body.push(() => nl.forEach((ln, i) => T(ln, 7.5, 'normal', grey, x + P, yy + 8 + i * 9))); cy += nl.length * 9 + 6; }
      else if (it.txt) { const nl = wrap(it.txt, 9.5, 'normal', w - 2 * P), yy = cy; body.push(() => nl.forEach((ln, i) => T(ln, 9.5, 'normal', ink, x + P, yy + 10 + i * 11.5))); cy += nl.length * 11.5 + 4; }
      first = false;
    }
    const h = cy - y + 6;
    if (!dry) {
      doc.setFillColor(255, 255, 255); doc.setDrawColor(221, 225, 234); doc.setLineWidth(0.8); doc.roundedRect(x, y, w, h, 7, 7, 'FD');
      doc.setFillColor(...C); doc.roundedRect(x, y, w, hh, 7, 7, 'F'); doc.rect(x, y + hh - 8, w, 8, 'F');
      T(c.title, 12.5, 'bold', [255, 255, 255], x + P, y + 17);
      subL.forEach((ln, i) => T(ln, 8.5, 'normal', [235, 238, 246], x + P, y + 29 + i * 10));
      body.forEach(f => f());
    }
    return h;
  }
  async function pdf() {
    const JS = await loadJsPDF(), doc = new JS({ unit:'pt', format:'a4' }), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const M = 28, G = 12, colW = (W - 2 * M - G) / 2, foot = 22;
    const head = () => {
      doc.setFillColor(18, 56, 181); doc.rect(0, 0, W, 58, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.text('EL FINDE', M, 30);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(rango(ventana()) + ' · horarios de Argentina', M, 46);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('FUNVS', W - M, 30, { align:'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130, 134, 148);
      doc.text('Fuentes: motogp.com, F1 (Jolpica), APAT, ESPN y la guía de TV de FUNVS. Los horarios pueden cambiar: confirmalos antes.', M, H - 12);
      return 72;
    };
    let top = head(), cols = [top, top];
    for (const c of cards) {
      const wide = !c.sched, w = wide ? W - 2 * M : colW, h = drawCard(doc, c, 0, 0, w, true);
      const lim = H - foot - 6, fits = i => cols[i] + h <= lim;
      let ci = cols[0] <= cols[1] ? 0 : 1; if (!wide && !fits(ci) && fits(1 - ci)) ci = 1 - ci;
      let y = wide ? Math.max(...cols) : cols[ci];
      if (y + h > lim && y > top) { doc.addPage(); top = head(); cols = [top, top]; ci = 0; y = top; }
      const x = wide ? M : M + ci * (colW + G);
      drawCard(doc, c, x, y, w, false);
      if (wide) cols = [y + h + G, y + h + G]; else cols[ci] = y + h + G;
    }
    const name = 'finde-' + keyDay(ventana().to).slice(0, 10) + '.pdf';
    await saveFile(doc.output('blob'), name);
    toast('📄 PDF listo', { ms:1800 });
  }
  return { open };
})();
