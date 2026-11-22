/* =========================================================
   ⚽ Fulbito completo (para no abrir más Sofascore ni Promiedos)
   - Ficha de cada partido: minuto a minuto, formaciones en la cancha, estadísticas, previa, relato.
   - 📊 Tablas: posiciones con zonas, Tabla Anual y Promedios (los arma el robot), fixture por fecha,
     goleadores y asistidores.
   - Página de cada equipo: próximos, resultados, plantel y posición.
   Datos: ESPN (públicos). Anual y Promedios: calculados por el robot de FUNVS con esos resultados.
   ========================================================= */
const FutPro = (() => {
  const B = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
  const getJ = async (u, ms = 0) => {
    const k = 'fp:' + u, c = mem.get(k); if (c && Date.now() - c.at < (ms || 60e3)) return c.j;
    const r = await fetch(u); if (!r.ok) throw new Error('ESPN ' + r.status);
    const j = await r.json(); mem.set(k, { at:Date.now(), j }); return j;
  };
  const mem = new Map();
  const tnm = t => t?.shortDisplayName || t?.displayName || t?.name || '';
  const logoOf = t => t?.logo || t?.logos?.[0]?.href || (t?.id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${t.id}.png` : '');
  const crest = t => { try { return Fulbito.crest(t); } catch { return ''; } };
  const dd = d => new Date(d).toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'numeric' });
  const hh = d => new Date(d).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  const apell = n => { const p = String(n || '').split(' '); return p.length > 1 ? p.slice(1).join(' ') : n; };

  function dlg(id, cls = '') {
    let d = $(id); if (!d) { d = document.createElement('dialog'); d.id = id; d.className = 'fpdlg ' + cls; document.body.appendChild(d); d.addEventListener('close', () => d._close?.()); }
    if (!d.open) d.showModal(); return d;
  }

  /* =================== 📋 FICHA DEL PARTIDO =================== */
  const KE = [   // tipo de evento → ícono
    [/own-goal/, '⚽', 'Gol en contra'], [/penalty---scored|penalty-scored/, '⚽', 'Gol de penal'], [/penalty---missed|penalty---saved|penalty-missed|penalty-saved/, '❌', 'Penal errado'],
    [/goal/, '⚽', 'Gol'], [/yellow-red|second-yellow/, '🟨🟥', 'Doble amarilla'], [/red-card/, '🟥', 'Roja'], [/yellow-card/, '🟨', 'Amarilla'],
    [/substitution/, '🔁', 'Cambio'], [/var/i, '📺', 'VAR'], [/^kickoff$/, '▶', 'Arranca el partido'], [/halftime/, '⏸', 'Entretiempo'],
    [/start-2nd-half/, '▶', 'Arranca el segundo tiempo'], [/end-regular-time|full-?time|end-of-game|^end$/, '🏁', 'Final'], [/extra-time|start-extra/, '⏱', 'Alargue'], [/shootout/, '🥅', 'Penales']
  ];
  const keOf = k => { const t = (k.type?.type || '') + (k.scoringPlay && !/goal|penalty/.test(k.type?.type || '') ? 'goal' : ''); for (const [rx, ic, lb] of KE) if (rx.test(t) || (lb === 'VAR' && /\bVAR\b/.test(k.text || k.type?.text || ''))) return { ic, lb }; return null; };
  const STATS = [['possessionPct', 'Posesión', '%'], ['totalShots', 'Remates'], ['shotsOnTarget', 'Remates al arco'], ['blockedShots', 'Remates bloqueados'], ['wonCorners', 'Córners'], ['offsides', 'Offsides'],
    ['foulsCommitted', 'Faltas'], ['yellowCards', 'Amarillas'], ['redCards', 'Rojas'], ['saves', 'Atajadas'], ['totalPasses', 'Pases'], ['accuratePasses', 'Pases correctos'], ['passPct', 'Precisión de pases', 'pct'],
    ['totalCrosses', 'Centros'], ['totalLongBalls', 'Pelotazos largos'], ['totalTackles', 'Quites'], ['interceptions', 'Intercepciones'], ['totalClearance', 'Despejes']];

  let F = { id:null, lg:null, tab:'min', t:null, s:null };
  async function ficha(id, lg = 'arg.1') {
    const d = dlg('dlgFicha');
    if (F.id !== id) F = { id, lg, tab:'min', t:null, s:null };
    d._close = () => { clearTimeout(F.t); F.id = null; };
    if (!F.s) d.innerHTML = `<div class="maphead"><b>📋 Ficha del partido</b><span class="sp"></span><button data-x>✕</button></div><div class="empty">Cargando la ficha…</div>`;
    d.querySelector('[data-x]').onclick = () => d.close();
    try { F.s = await getJ(`${B}/${lg}/summary?event=${id}&lang=es&region=ar`, 25e3); } catch (e) { if (!F.s) { d.querySelector('.empty').textContent = 'No pude traer la ficha (' + e.message + '). Probá de nuevo en un rato.'; return; } }
    if (F.id !== id) return;
    paintFicha(d);
    clearTimeout(F.t);
    if (F.s.header?.competitions?.[0]?.status?.type?.state === 'in') F.t = setTimeout(() => d.open && F.id === id && ficha(id, lg), 30e3);
  }
  function paintFicha(d) {
    const s = F.s, c = s.header?.competitions?.[0] || {}, st = c.status || {}, state = st.type?.state;
    const H = c.competitors?.find(x => x.homeAway === 'home') || {}, A = c.competitors?.find(x => x.homeAway === 'away') || {};
    const gi = s.gameInfo || {}, ven = gi.venue || {};
    const refs = (gi.officials || []).map(o => `${esc(o.fullName || o.displayName)}${o.position?.displayName ? ` <small>(${esc(o.position.displayName.replace('Referee', 'árbitro').replace('Assistant', 'asistente'))})</small>` : ''}`);
    const scoreTxt = state === 'pre' ? hh(c.date) : `${H.score ?? 0} - ${A.score ?? 0}`;
    const stTxt = state === 'pre' ? dd(c.date) : state === 'in' ? '● ' + (st.displayClock || st.type?.shortDetail || 'En juego') : (st.type?.detail || 'Final').replace(/^FT$|Full Time/i, 'Final');
    const sho = (H.shootoutScore ?? null) !== null ? `<small>Penales ${H.shootoutScore}-${A.shootoutScore}</small>` : '';
    const TABS = [['min', '⏱️ Minuto a minuto'], ['form', '🧍 Formaciones'], ['est', '📊 Estadísticas'], ['prev', '📋 Previa'], ['rel', '💬 Relato']];
    const scrollY = d.querySelector('.fpbody')?.scrollTop || 0;
    d.innerHTML = `<div class="maphead"><b>📋 ${esc(c.competitors ? tnm(H.team) + ' vs ' + tnm(A.team) : 'Ficha')}</b><span class="sp"></span>${state === 'in' ? '<small class="fplive">EN VIVO · se actualiza solo</small>' : ''}<button data-x>✕</button></div>
      <div class="fphead ${state}">
        <button class="fpteam" data-team="${esc(H.team?.id)}">${crest(H.team || {})}<span>${esc(tnm(H.team))}</span></button>
        <div class="fpsc"><b>${esc(scoreTxt)}</b><span>${esc(stTxt)}</span>${sho}</div>
        <button class="fpteam" data-team="${esc(A.team?.id)}">${crest(A.team || {})}<span>${esc(tnm(A.team))}</span></button>
      </div>
      ${goalsLine(s, H, A)}
      <div class="fpmeta">${ven.fullName ? `🏟️ ${esc(ven.fullName)}${ven.address?.city ? ', ' + esc(ven.address.city) : ''}` : ''}${gi.attendance ? ` · 👥 ${(+gi.attendance).toLocaleString('es-AR')}` : ''}${refs.length ? `<br>🧑‍⚖️ ${refs.slice(0, 2).join(' · ')}` : ''}</div>
      <div class="chips fptabs">${TABS.map(([k, n]) => `<button data-tab="${k}" class="${F.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="fpbody">${tabHtml(F.tab, s, H, A)}</div>`;
    d.querySelector('.fpbody').scrollTop = scrollY;
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelector('.fptabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { F.tab = b.dataset.tab; paintFicha(d); } };
    d.querySelectorAll('[data-team]').forEach(b => b.onclick = () => b.dataset.team && team(b.dataset.team, F.lg));
    try { HScroll.attach(d.querySelector('.fptabs')); } catch {}
  }
  function goalsLine(s, H, A) {
    const g = (s.keyEvents || []).filter(k => k.scoringPlay || /goal|penalty---scored/.test(k.type?.type || ''));
    if (!g.length) return '';
    const side = id => g.filter(k => k.team?.id === id).map(k => `${esc(apell(k.participants?.[0]?.athlete?.displayName || ''))} ${esc(k.clock?.displayValue || '')}${/penalty/.test(k.type?.type) ? ' (p)' : ''}${/own/.test(k.type?.type) ? ' (ec)' : ''}`).join('<br>');
    return `<div class="fpgoals"><div>${side(H.team?.id)}</div><span>⚽</span><div>${side(A.team?.id)}</div></div>`;
  }
  function tabHtml(tab, s, H, A) {
    if (tab === 'min') {
      const ev = (s.keyEvents || []).map(k => ({ k, t:keOf(k) })).filter(x => x.t);
      if (!ev.length) return '<div class="empty">Todavía no hay eventos.</div>';
      return `<div class="fptl">${ev.slice().reverse().map(({ k, t }) => {
        const ppl = (k.participants || []).map(p => p.athlete?.displayName).filter(Boolean);
        const who = /Cambio/.test(t.lb) && ppl.length > 1 ? `<span class="in">↑ ${esc(ppl[0])}</span> <span class="out">↓ ${esc(ppl[1])}</span>` : t.ic === '⚽' && ppl.length > 1 ? `${esc(ppl[0])} <small>· asistencia de ${esc(ppl[1])}</small>` : esc(ppl.join(', ') || (k.text && !/Arranca|Final|Entretiempo/.test(t.lb) ? k.text : ''));
        const sd = k.team?.id === H.team?.id ? 'h' : k.team?.id === A.team?.id ? 'a' : 'c';
        return `<div class="fpev ${sd} ${t.ic === '⚽' ? 'gol' : ''}"><i>${esc(k.clock?.displayValue || '')}</i><b>${t.ic}</b><div><b>${esc(t.lb)}</b>${sd !== 'c' ? ` · <small>${esc(tnm(k.team))}</small>` : ''}${who ? `<br>${who}` : ''}</div></div>`; }).join('')}</div>`;
    }
    if (tab === 'form') return pitch(s, H, A);
    if (tab === 'est') {
      const T = s.boxscore?.teams || [], th = T.find(t => t.team?.id === H.team?.id) || T[0], ta = T.find(t => t.team?.id === A.team?.id) || T[1];
      const val = (t, n) => { const x = (t?.statistics || []).find(z => z.name === n); return x ? +x.displayValue : null; };
      const rows = STATS.map(([n, lb, u]) => { let a = val(th, n), b = val(ta, n); if (a === null && b === null) return '';
        a = a || 0; b = b || 0; const fmt = v => u === 'pct' ? Math.round(v * (v <= 1 ? 100 : 1)) + '%' : u === '%' ? Math.round(v) + '%' : v;
        const tot = a + b || 1;
        return `<div class="fpst"><b>${fmt(a)}</b><span>${esc(lb)}</span><b>${fmt(b)}</b><div class="bar"><i style="width:${a / tot * 100}%"></i><i style="width:${b / tot * 100}%"></i></div></div>`; }).join('');
      return rows ? `<div class="fpsth"><span>${esc(tnm(H.team))}</span><span>${esc(tnm(A.team))}</span></div>${rows}` : '<div class="empty">Las estadísticas aparecen cuando arranca el partido.</div>';
    }
    if (tab === 'prev') return previa(s, H, A);
    if (tab === 'rel') {
      const cm = s.commentary || [];
      return cm.length ? `<div class="fprel">${cm.slice().reverse().map(c => `<p><i>${esc(c.time?.displayValue || '')}</i>${esc(c.text || '')}</p>`).join('')}</div>` : '<div class="empty">No hay relato para este partido.</div>';
    }
    return '';
  }
  // 🧍 Formaciones: dibujadas en la cancha (local abajo, visitante arriba)
  function pitch(s, H, A) {
    const R = s.rosters || []; if (!R.length) return '<div class="empty">Las formaciones aparecen cuando se confirman (≈ 1 hora antes).</div>';
    const evs = s.keyEvents || [], byName = {};
    evs.forEach(k => { const t = keOf(k); if (!t) return; (k.participants || []).forEach((p, i) => { const n = p.athlete?.displayName; if (!n) return; const o = byName[n] = byName[n] || [];
      if (t.ic === '⚽' && i === 0) o.push(/own/.test(k.type?.type) ? '⚽ec' : '⚽'); else if (t.ic === '🟨' || t.ic === '🟥' || t.ic === '🟨🟥') o.push(t.ic); else if (t.lb === 'Cambio') o.push(i === 0 ? '↑' + (k.clock?.displayValue || '') : '↓' + (k.clock?.displayValue || '')); }); });
    // líneas según la formación (numeración estándar de Opta que usa ESPN: 1 arquero, 2-3-5-6 defensa…)
    const FORM = { '4-4-2':[[2, 5, 6, 3], [7, 4, 8, 11], [10, 9]], '4-3-3':[[2, 5, 6, 3], [7, 4, 8], [10, 9, 11]], '4-2-3-1':[[2, 5, 6, 3], [8, 4], [7, 10, 11], [9]],
      '4-1-4-1':[[2, 5, 6, 3], [4], [7, 8, 10, 11], [9]], '4-4-1-1':[[2, 5, 6, 3], [7, 4, 8, 11], [10], [9]], '4-5-1':[[2, 5, 6, 3], [7, 4, 10, 8, 11], [9]] };
    const lat = a => /I$/.test(a) ? 0 : /D$/.test(a) && !/^D?C?D?$/.test(a) ? 2 : 1;   // abreviaturas en castellano: …I izquierda, …D derecha
    const rank = (a, pl) => pl === 1 ? 0 : /^(L|DC|DF|CA|DEF)/.test(a) ? 1 : /^(MCD|MDC|PIV)/.test(a) ? 2 : /^(MO|MCO|MP)/.test(a) ? 4 : /^M/.test(a) ? 3 : 5;
    const side = (r, top) => {
      const xi = (r.roster || []).filter(p => p.starter), bench = (r.roster || []).filter(p => !p.starter);
      const ab = p => p.position?.abbreviation || '', fp = p => +p.formationPlace || 0;
      const gk = xi.filter(p => fp(p) === 1).slice(0, 1), rest = xi.filter(p => !gk.includes(p));
      let lines;
      const T = FORM[r.formation];
      if (T && T.flat().every(n => rest.some(p => fp(p) === n))) lines = [gk, ...T.map(l => l.map(n => rest.find(p => fp(p) === n)).sort((a, b) => lat(ab(a)) - lat(ab(b))))];
      else {
        rest.sort((a, b) => rank(ab(a), fp(a)) - rank(ab(b), fp(b)) || lat(ab(a)) - lat(ab(b)));
        let cnt = String(r.formation || '').split('-').map(Number).filter(Boolean);
        if (cnt.reduce((a, b) => a + b, 0) !== rest.length) { const g = {}; rest.forEach(p => (g[rank(ab(p), fp(p))] = (g[rank(ab(p), fp(p))] || 0) + 1)); cnt = Object.keys(g).sort().map(k => g[k]); }
        lines = [gk]; let i = 0; cnt.forEach(n => { lines.push(rest.slice(i, i + n).sort((a, b) => lat(ab(a)) - lat(ab(b)))); i += n; });
      }
      const chip = p => { const n = p.athlete?.displayName || '', ic = (byName[n] || []).filter(x => !x.startsWith('↑'));
        return `<div class="pl"><b>${esc(p.jersey || '')}</b><span>${esc(apell(n))}</span>${ic.length ? `<em>${ic.map(x => x.startsWith('↓') ? `<small class="out">🔻${esc(x.slice(1))}</small>` : esc(x)).join('')}</em>` : ''}</div>`; };
      const L = (top ? lines : lines.slice().reverse()).map(l => `<div class="pline">${(top ? l.slice().reverse() : l).map(chip).join('')}</div>`).join('');
      const bn = bench.sort((a, b) => (b.subbedIn ? 1 : 0) - (a.subbedIn ? 1 : 0)).map(p => { const n = p.athlete?.displayName || '', i2 = (byName[n] || []); const up = i2.find(x => x.startsWith('↑'));
        return `<span class="${p.subbedIn ? 'in' : ''}">${esc(p.jersey || '')} ${esc(n)}${up ? ` <small>↑${esc(up.slice(1))}</small>` : ''}${i2.filter(x => !x.startsWith('↑') && !x.startsWith('↓')).join('')}</span>`; }).join('');
      return { L, bn, f:r.formation || '' };
    };
    const rh = R.find(r => r.homeAway === 'home' || r.team?.id === H.team?.id) || R[0], ra = R.find(r => r !== rh) || R[1];
    const a = side(ra, true), h = side(rh, false);
    return `<div class="pitch"><div class="ptag top">${esc(tnm(A.team))} · ${esc(a.f)}</div><div class="phalf top">${a.L}</div><div class="pmid"></div><div class="phalf">${h.L}</div><div class="ptag">${esc(tnm(H.team))} · ${esc(h.f)}</div></div>
      <div class="bench"><div><b>Suplentes ${esc(tnm(H.team))}</b>${h.bn}</div><div><b>Suplentes ${esc(tnm(A.team))}</b>${a.bn}</div></div>`;
  }
  function previa(s, H, A) {
    const out = [];
    const ss = (s.seasonseries || []).find(x => x.type === 'head-to-head') || s.seasonseries?.[0];
    const h2h = (ss?.events || []).filter(e => e.status === 'post' || e.statusType?.completed).slice(-6).reverse().map(e => { const h = e.competitors?.find(c => c.homeAway === 'home'), a = e.competitors?.find(c => c.homeAway === 'away');
      return h && a ? `<span>${esc(tnm(h.team) || h.team?.abbreviation)} <b>${h.score} - ${a.score}</b> ${esc(tnm(a.team) || a.team?.abbreviation)} <small>${esc((e.date || '').slice(0, 10).split('-').reverse().join('/'))}</small></span>` : ''; }).join('');
    const hg = (s.headToHeadGames || []).flatMap(t => t.events || []).slice(0, 6).map(e => `<span>${esc(e.atVs === '@' ? '' : '')}${esc(e.opponent?.displayName ? 'vs ' + e.opponent.displayName : '')} <b>${esc(e.score || ((e.homeTeamScore ?? '') + '-' + (e.awayTeamScore ?? '')))}</b> <small>${esc((e.gameDate || '').slice(0, 10).split('-').reverse().join('/'))}</small></span>`).join('');
    if (h2h || hg) out.push(`<h4>🤝 Frente a frente${ss?.summary ? ' · ' + esc(ss.summary.replace(/leads series/, 'gana la serie').replace(/series tied/i, 'serie empatada')) : ''}</h4><div class="fph2h">${h2h || hg}</div>`);
    const lf = s.lastFiveGames || [];
    if (lf.length) out.push(`<h4>📈 Cómo vienen</h4>${lf.map(t => `<div class="fpform"><b>${esc(tnm(t.team))}</b>${(t.events || []).slice(0, 5).map(e => `<span class="fm ${e.gameResult}" title="${esc((e.atVs === '@' ? 'de visitante ' : 'de local ') + 'vs ' + (e.opponent?.displayName || '') + ' ' + (e.score || ''))}">${{ W:'G', D:'E', L:'P' }[e.gameResult] || e.gameResult}</span><small>${esc(e.score || '')} ${esc(e.opponent?.abbreviation || '')}</small>`).join('')}</div>`).join('')}`);
    const gr = s.standings?.groups || [];
    const ids = [H.team?.id, A.team?.id];
    gr.forEach(g => { const E = g.standings?.entries || []; if (!E.some(e => ids.includes(e.id))) return;
      out.push(`<h4>📊 ${esc(g.header || 'Tabla')}</h4><table class="fptab"><tr><th>#</th><th>Equipo</th><th>PJ</th><th>DG</th><th>Pts</th></tr>${E.map((e, i) => { const st = Object.fromEntries((e.stats || []).map(x => [x.name, x.displayValue]));
        return `<tr class="${ids.includes(e.id) ? 'me' : ''}"><td>${st.rank || i + 1}</td><td>${esc(e.team)}</td><td>${st.gamesPlayed ?? ''}</td><td>${st.pointDifferential ?? ''}</td><td><b>${st.points ?? ''}</b></td></tr>`; }).join('')}</table>`); });
    const nw = s.news?.articles || [];
    if (nw.length) out.push(`<h4>📰 Noticias</h4>${nw.slice(0, 4).map(n => `<a class="lnk fpnews" href="${esc(n.links?.web?.href || '#')}" target="_blank" rel="noopener">${esc(n.headline)} ↗</a>`).join('')}`);
    return out.join('') || '<div class="empty">No hay previa para este partido.</div>';
  }

  /* =================== 👕 PÁGINA DEL EQUIPO =================== */
  const POS = { G:'Arqueros', D:'Defensores', M:'Mediocampistas', F:'Delanteros' };
  let posCache = {};
  async function team(id, lg = 'arg.1') {
    const d = dlg('dlgTeam'); let tab = 'prox';
    d.innerHTML = `<div class="maphead"><b>👕 Equipo</b><span class="sp"></span><button data-x>✕</button></div><div class="empty">Cargando…</div>`;
    d.querySelector('[data-x]').onclick = () => d.close();
    const [ti, past, fix, ros] = await Promise.all([getJ(`${B}/${lg}/teams/${id}`, 6 * 3600e3).catch(() => null), getJ(`${B}/${lg}/teams/${id}/schedule`, 10 * 60e3).catch(() => null),
      getJ(`${B}/${lg}/teams/${id}/schedule?fixture=true`, 10 * 60e3).catch(() => null), getJ(`${B}/${lg}/teams/${id}/roster`, 12 * 3600e3).catch(() => null)]);
    const T = ti?.team || past?.team || { id };
    const std = await standings(lg).catch(() => null), me = std?.flatMap(g => g.rows.map(r => ({ ...r, g:g.name }))).find(r => r.id === id);
    const all = [...(past?.events || []), ...(fix?.events || [])].filter((e, i, a) => a.findIndex(x => x.id === e.id) === i).map(e => { const c = e.competitions?.[0] || {}, h = c.competitors?.find(x => x.homeAway === 'home'), a = c.competitors?.find(x => x.homeAway === 'away');
      const sc = x => x?.score && typeof x.score === 'object' ? x.score.displayValue : x?.score;
      return { id:e.id, d:e.date, st:c.status?.type?.state || 'pre', h:h?.team || {}, a:a?.team || {}, hs:sc(h), as:sc(a), lg:e.league?.slug || lg, tn:e.seasonType?.name || '' }; });
    const prox = all.filter(e => e.st !== 'post').sort((a, b) => Date.parse(a.d) - Date.parse(b.d)), res = all.filter(e => e.st === 'post').sort((a, b) => Date.parse(b.d) - Date.parse(a.d));
    const resOf = e => { const mine = e.h.id === id ? +e.hs : +e.as, oth = e.h.id === id ? +e.as : +e.hs; return mine > oth ? 'W' : mine < oth ? 'L' : 'D'; };
    const ev = (e, r) => `<div class="fpm" data-ev="${esc(e.id)}" data-lg="${esc(e.lg)}" tabindex="0"><small>${dd(e.d)}${e.st === 'pre' ? ' · ' + hh(e.d) : ''}</small><span>${esc(tnm(e.h))}</span><b>${e.st === 'pre' ? 'vs' : esc(e.hs + ' - ' + e.as)}</b><span>${esc(tnm(e.a))}</span>${r ? `<i class="fm ${resOf(e)}">${{ W:'G', D:'E', L:'P' }[resOf(e)]}</i>` : ''}</div>`;
    const athletes = (ros?.athletes || []).flatMap(x => x.items ? x.items : [x]);
    const plantel = () => { const g = {}; athletes.forEach(a => { const k = (a.position?.abbreviation || '?')[0]; (g[k] = g[k] || []).push(a); });
      return Object.keys(POS).filter(k => g[k]).map(k => `<h4>${POS[k]}</h4><div class="fpros">${g[k].sort((a, b) => (+a.jersey || 99) - (+b.jersey || 99)).map(a => `<span><b>${esc(a.jersey || '–')}</b>${esc(a.displayName)}${a.age ? ` <small>${a.age} años</small>` : ''}${a.citizenship && a.citizenship !== 'Argentina' ? ` <small>· ${esc(a.citizenship)}</small>` : ''}</span>`).join('')}</div>`).join('')
        || '<div class="empty">ESPN no tiene el plantel de este equipo.</div>'; };
    const paint = () => {
      d.innerHTML = `<div class="maphead"><b>👕 ${esc(T.displayName || 'Equipo')}</b><span class="sp"></span><button data-fav>${(() => { try { return db.futbol.teams.some(f => norm(f) === norm(T.displayName || '')) ? '★' : '☆'; } catch { return '☆'; } })()}</button><button data-x>✕</button></div>
        <div class="fpthead">${crest({ ...T, logo:logoOf(T) })}<div><b>${esc(T.displayName || '')}</b>${me ? `<span>${me.pos}° ${esc(me.g || '')} · ${me.pts} pts · ${me.pj} PJ</span>` : T.standingSummary ? `<span>${esc(T.standingSummary)}</span>` : ''}<span class="fms">${res.slice(0, 5).map(e => `<i class="fm ${resOf(e)}">${{ W:'G', D:'E', L:'P' }[resOf(e)]}</i>`).join('')}</span></div></div>
        <div class="chips fptabs"><button data-tab="prox" class="${tab === 'prox' ? 'on' : ''}">📅 Próximos</button><button data-tab="res" class="${tab === 'res' ? 'on' : ''}">✅ Resultados</button><button data-tab="pl" class="${tab === 'pl' ? 'on' : ''}">🧍 Plantel</button></div>
        <div class="fpbody">${tab === 'prox' ? (prox.map(e => ev(e)).join('') || '<div class="empty">ESPN todavía no tiene próximos partidos cargados.</div>') : tab === 'res' ? res.slice(0, 25).map(e => ev(e, 1)).join('') || '<div class="empty">Sin resultados.</div>' : plantel()}</div>`;
      d.querySelector('[data-x]').onclick = () => d.close();
      d.querySelector('.fptabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; paint(); } };
      d.querySelector('[data-fav]').onclick = () => { const n = T.displayName; if (!n) return; const on = db.futbol.teams.some(f => norm(f) === norm(n)); db.futbol.teams = on ? db.futbol.teams.filter(f => norm(f) !== norm(n)) : [...db.futbol.teams, n]; save(); paint(); };
      bindEvs(d);
    };
    paint();
  }
  const bindEvs = el => el.querySelectorAll('[data-ev]').forEach(x => { x.onclick = e => { if (e.target.closest('button,a,select,input')) return; ficha(x.dataset.ev, x.dataset.lg || 'arg.1'); }; x.onkeydown = e => { if (e.key === 'Enter') x.click(); }; });

  /* =================== 📊 TABLAS =================== */
  async function standings(lg) {
    const j = await getJ(`https://site.api.espn.com/apis/v2/sports/soccer/${lg}/standings`, 10 * 60e3);
    const groups = j.children?.length ? j.children : [j];
    return groups.map(g => ({ name:(g.name || g.abbreviation || '').replace(/^Group /, 'Zona '), rows:(g.standings?.entries || []).map(e => { const st = {}; (e.stats || []).forEach(x => st[x.name] = x.value ?? +x.displayValue);
      return { id:e.team?.id, t:e.team, note:e.note, pos:st.rank || 0, pj:st.gamesPlayed || 0, g:st.wins || 0, e:st.ties || 0, p:st.losses || 0, gf:st.pointsFor || 0, gc:st.pointsAgainst || 0, dg:st.pointDifferential || 0, pts:st.points || 0 }; }).sort((a, b) => a.pos - b.pos) })).filter(g => g.rows.length);
  }
  let tablas = S.get('fpTablas', null), tbAt = 0;
  async function loadTablas() {
    if (tablas && Date.now() - tbAt < 30 * 60e3) return tablas;
    try { const j = await (await fetch(REPO.data + 'tablas.json?t=' + Math.floor(Date.now() / 900e3))).json(); if (j?.anual) { tablas = j; tbAt = Date.now(); S.set('fpTablas', j); } } catch {}
    return tablas;
  }
  const TB = [['pos', '📊 Posiciones'], ['anual', '📅 Anual'], ['prom', '📉 Promedios'], ['fix', '🗓️ Fixture'], ['gol', '⚽ Goleadores'], ['asi', '🅰️ Asistencias']];
  let tb = S.get('fpTb', { lg:'arg.1', tab:'pos', fix:null, wk:0 });
  const saveTb = () => S.set('fpTb', tb);
  const trow = (r, i, cls, extra = '') => `<tr class="${cls}" data-team="${esc(r.id)}" tabindex="0"><td>${r.pos || i + 1}</td><td class="tn"><div>${crest(r.t || {})}<span>${esc(tnm(r.t))}</span></div></td><td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td><td>${r.gf}:${r.gc}</td><td>${r.dg > 0 ? '+' : ''}${r.dg}</td><td><b>${r.pts}</b></td>${extra}</tr>`;
  const THEAD = '<tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>Goles</th><th>DG</th><th>Pts</th></tr>';
  async function tablasView(el) {
    const ligas = (() => { try { return Fulbito.ligas(); } catch { return [['arg.1', 'Liga Profesional']]; } })();
    const isArg = tb.lg === 'arg.1';
    const tabs = TB.filter(([k]) => isArg || (k !== 'anual' && k !== 'prom'));
    if (!tabs.some(t => t[0] === tb.tab)) tb.tab = 'pos';
    el.innerHTML = `<div class="subbar"><select id="tbLg" style="width:auto">${ligas.map(([id, n]) => `<option value="${id}" ${id === tb.lg ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <div class="chips" id="tbTabs" style="margin:0">${tabs.map(([k, n]) => `<button data-tb="${k}" class="${k === tb.tab ? 'on' : ''}">${n}</button>`).join('')}</div></div><div id="tbBody"><div class="empty">Cargando…</div></div>`;
    $('tbLg').onchange = e => { tb.lg = e.target.value; tb.fix = null; tb.wk = 0; saveTb(); tablasView(el); };
    $('tbTabs').onclick = e => { const b = e.target.closest('[data-tb]'); if (b) { tb.tab = b.dataset.tb; saveTb(); tablasView(el); } };
    try { HScroll.attach($('tbTabs')); } catch {}
    const body = $('tbBody');
    try { body.innerHTML = await tabBody(); } catch (e) { body.innerHTML = `<div class="empty">No pude traer los datos (${esc(e.message)}).</div>`; }
    body.querySelectorAll('[data-team]').forEach(r => { r.onclick = () => team(r.dataset.team, tb.lg); r.onkeydown = e => { if (e.key === 'Enter') r.click(); }; });
    body.querySelectorAll('[data-fx]').forEach(b => b.onclick = () => { const a = +b.dataset.fx; if (isArg && tablas?.fixture) { const T = fixKeys(); let i = T.indexOf(tb.fix) + a; i = Math.max(0, Math.min(T.length - 1, i)); tb.fix = T[i]; } else tb.wk += a; saveTb(); tablasView(el); });
    body.querySelector('#tbFixSel')?.addEventListener('change', e => { tb.fix = e.target.value; saveTb(); tablasView(el); });
    bindEvs(body);
  }
  // todas las fechas de la temporada en orden: "Apertura · Fecha 1"…
  const fixKeys = () => Object.entries(tablas?.fixture || {}).sort((a, b) => Date.parse(Object.values(a[1])[0]?.[0]?.d) - Date.parse(Object.values(b[1])[0]?.[0]?.d))
    .flatMap(([T, fs]) => Object.entries(fs).sort((a, b) => Date.parse(a[1][0].d) - Date.parse(b[1][0].d)).map(([f]) => T + ' · ' + f));
  async function tabBody() {
    const lg = tb.lg;
    if (tb.tab === 'pos') {
      const G = await standings(lg); if (!G.length) return '<div class="empty">ESPN no tiene tabla de este torneo.</div>';
      const zona = (r, i, n) => r.note?.description ? 'z-note' : lg === 'arg.1' ? (i < 8 ? 'z-po' : '') : (i === n - 1 ? 'z-desc' : '');
      const legend = new Map(); G.forEach(g => g.rows.forEach(r => r.note?.description && legend.set(r.note.color, r.note.description)));
      return G.map(g => `<div class="league"><h3>${esc(g.name || 'Posiciones')}</h3><div class="tbwrap"><table class="fptab big">${THEAD}${g.rows.map((r, i) => trow(r, i, zona(r, i, g.rows.length)).replace('<tr ', r.note?.color ? `<tr style="--zc:${esc(r.note.color)}" ` : '<tr ')).join('')}</table></div></div>`).join('')
        + `<div class="tbleg">${lg === 'arg.1' ? '<span class="z-po">Clasifican a los playoffs (8 por zona)</span>' : ''}${[...legend].map(([c, t]) => `<span style="--zc:${esc(c)}" class="z-note">${esc(t)}</span>`).join('')}</div>`;
    }
    if (tb.tab === 'anual' || tb.tab === 'prom') {
      const t = await loadTablas(); if (!t) return '<div class="empty">El robot todavía no armó la Tabla Anual ni los Promedios. Volvé en un rato (se arman cada 3 horas).</div>';
      const tm = id => ({ ...(t.teams[id] || {}), displayName:t.teams[id]?.n, shortDisplayName:t.teams[id]?.c, logo:t.teams[id]?.logo, id });
      const nota = `<p class="mut" style="font-size:11px;margin-top:8px">${esc(t.nota || '')} Actualizado ${fmtH(new Date(t.updated))}.</p>`;
      if (tb.tab === 'anual') {
        const n = t.anual.length;
        const z = i => i === 0 ? 'z-lib' : i < 3 ? 'z-lib' : i < 9 ? 'z-sud' : i === n - 1 ? 'z-desc' : '';
        return `<div class="league"><h3>📅 Tabla Anual ${t.season} (Apertura + Clausura, fase regular)</h3><div class="tbwrap"><table class="fptab big">${THEAD}${t.anual.map((r, i) => trow({ ...r, t:tm(r.id), dg:r.gf - r.gc }, i, z(i))).join('')}</table></div></div>
          <div class="tbleg"><span class="z-lib">Zona Libertadores (aprox.)</span><span class="z-sud">Zona Sudamericana (aprox.)</span><span class="z-desc">Desciende por tabla anual</span></div><p class="mut" style="font-size:11px">Los cupos exactos dependen de quién salga campeón de cada torneo y de la Copa Argentina.</p>${nota}`;
      }
      const Y = t.season, n = t.promedios.length;
      return `<div class="league"><h3>📉 Promedios ${Y} (${Y - 2}, ${Y - 1} y ${Y})</h3><div class="tbwrap"><table class="fptab big"><tr><th>#</th><th>Equipo</th><th>${Y - 2}</th><th>${Y - 1}</th><th>${Y}</th><th>Pts</th><th>PJ</th><th>Prom.</th></tr>
        ${t.promedios.map((r, i) => `<tr class="${i === n - 1 ? 'z-desc' : i >= n - 3 ? 'z-risk' : ''}" data-team="${esc(r.id)}" tabindex="0"><td>${i + 1}</td><td class="tn"><div>${crest(tm(r.id))}<span>${esc(t.teams[r.id]?.c || '')}</span></div></td>${r.cols.map(c => `<td>${c ?? '–'}</td>`).join('')}<td>${r.pts}</td><td>${r.pj}</td><td><b>${r.prom.toFixed(3)}</b></td></tr>`).join('')}</table></div></div>
        <div class="tbleg"><span class="z-desc">Desciende por promedios</span><span class="z-risk">Zona de peligro</span></div>${nota}`;
    }
    if (tb.tab === 'fix') {
      if (lg === 'arg.1') { const t = await loadTablas(); if (t?.fixture && Object.keys(t.fixture).length) return fixArg(t); }
      // otras ligas: semana por semana
      const off = tb.wk * 7, days = [0, 1, 2, 3, 4, 5, 6].map(d => off + d);
      const res = await Promise.all(days.map(d => Fulbito.board(lg, d).then(j => Fulbito.evs(j)).catch(() => [])));
      const all = res.flat().filter((m, i, a) => a.findIndex(x => x.id === m.id) === i).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      const d0 = new Date(); d0.setDate(d0.getDate() + off); const d1 = new Date(d0); d1.setDate(d1.getDate() + 6);
      return `<div class="fxnav"><button data-fx="-1">◀ Semana anterior</button><b>${dd(d0)} al ${dd(d1)}</b><button data-fx="1">Semana siguiente ▶</button></div>
        <div class="league">${all.map(m => Fulbito.matchRow({ ...m, lg })).join('') || '<div class="empty">No hay partidos esa semana.</div>'}</div>`;
    }
    if (tb.tab === 'gol' || tb.tab === 'asi') {
      const j = await getJ(`${B}/${lg}/statistics`, 30 * 60e3);
      const L = (j.stats || []).find(s => s.name === (tb.tab === 'gol' ? 'goalsLeaders' : 'assistsLeaders'))?.leaders || [];
      if (!L.length) return '<div class="empty">ESPN no tiene esta estadística para este torneo.</div>';
      return `<div class="league"><h3>${tb.tab === 'gol' ? '⚽ Goleadores' : '🅰️ Asistidores'}</h3><div class="tbwrap"><table class="fptab big"><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>PJ</th><th>${tb.tab === 'gol' ? 'Goles' : 'Asist.'}</th></tr>
        ${L.slice(0, 30).map((x, i) => { const pj = (String(x.displayValue).match(/Matches:\s*(\d+)/) || [])[1] || ''; const T = x.athlete?.team || {};
          return `<tr ${T.id ? `data-team="${esc(T.id)}" tabindex="0"` : ''}><td>${i + 1}</td><td><b>${esc(x.athlete?.displayName || '')}</b></td><td class="tn"><div>${T.id ? crest({ ...T, logo:logoOf(T) }) : ''}<span>${esc(tnm(T))}</span></div></td><td>${pj}</td><td><b>${x.value}</b></td></tr>`; }).join('')}</table></div></div>`;
    }
    return '';
  }
  function fixArg(t) {
    const keys = fixKeys(); if (!keys.length) return '<div class="empty">Sin fixture.</div>';
    if (!keys.includes(tb.fix)) {   // por defecto: la fecha más cercana a hoy
      let best = keys[keys.length - 1], bd = Infinity;
      keys.forEach(k => { const [T, f] = k.split(' · '); const ms = t.fixture[T][f].map(m => Math.abs(Date.parse(m.d) - Date.now())); const v = Math.min(...ms); if (v < bd) { bd = v; best = k; } });
      tb.fix = best;
    }
    const [T, f] = tb.fix.split(' · '), L = (t.fixture[T]?.[f] || []).slice().sort((a, b) => Date.parse(a.d) - Date.parse(b.d));
    const tm = id => ({ displayName:t.teams[id]?.n || '?', shortDisplayName:t.teams[id]?.c, logo:t.teams[id]?.logo, id });
    const live = (() => { try { return Object.fromEntries(Object.values(Fulbito.today()).flatMap(x => x.events).map(m => [m.id, m])); } catch { return {}; } })();
    const rows = L.map(m => { const lv = live[m.id];
      if (lv) return Fulbito.matchRow({ ...lv, lg:'arg.1' });
      return `<div class="match ${m.st}" data-ev="${esc(m.id)}" data-lg="arg.1" tabindex="0"><div class="st">${m.st === 'post' ? 'Final' : `${dd(m.d)} ${hh(m.d)}`}</div><div class="tm h"><span>${esc(tm(m.h).shortDisplayName)}</span>${crest(tm(m.h))}</div><div class="sc">${m.st === 'post' ? m.hs + ' - ' + m.as : 'vs'}${m.ps ? `<small class="pens">(${m.ps[0]}-${m.ps[1]} p)</small>` : ''}</div><div class="tm a">${crest(tm(m.a))}<span>${esc(tm(m.a).shortDisplayName)}</span></div></div>`; }).join('');
    return `<div class="fxnav"><button data-fx="-1">◀</button><select id="tbFixSel">${keys.map(k => `<option ${k === tb.fix ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select><button data-fx="1">▶</button></div><div class="league">${rows}</div>`;
  }

  // ---------- tocar un partido en cualquier lista de Fulbito abre su ficha ----------
  function init() {
    document.addEventListener('click', e => {
      const m = e.target.closest('#v-fulbito .match[data-ev], #v-velez .match[data-ev], #v-inicio [data-ficha]');
      if (!m || e.target.closest('button,a,select,input,.chips,.vchips')) return;
      ficha(m.dataset.ev || m.dataset.ficha, m.dataset.lg || 'arg.1');
    });
    document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('.match[data-ev]')) { e.preventDefault(); e.target.click(); } });
    loadTablas();
  }
  return { init, ficha, team, tablasView, standings, loadTablas };
})();
