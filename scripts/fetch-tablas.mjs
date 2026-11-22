// 📊 Tablas de la Liga Profesional que ESPN no da armadas: Tabla Anual, Promedios y el fixture por fecha.
// Se calculan con los resultados de ESPN (calendario de cada equipo, temporadas 2024, 2025 y la actual).
// Promedios: puntos / partidos de las últimas 3 temporadas en Primera, solo fase regular (sin playoffs).
//   2024: Liga Profesional + fase de grupos de la Copa de la Liga. Puede diferir de la oficial por quitas de puntos.
// Se rearma cada 3 horas (o enseguida si hay partidos terminados nuevos).
// Uso: node scripts/fetch-tablas.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
const UA = { 'User-Agent':'FUNVS/1.0 (uso personal)' };
const B = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const getJ = async u => { for (let i = 0; i < 2; i++) { try { const r = await fetch(u, { headers:UA, signal:AbortSignal.timeout(30000) }); if (r.ok) return r.json(); } catch {} } return null; };

const prev = await getJ(`https://raw.githubusercontent.com/${repo}/datos/tablas.json?t=${Date.now()}`);
if (prev?.updated && Date.now() - Date.parse(prev.updated) < 3 * 3600e3 && !process.env.FORCE) { await writeFile(dir + '/tablas.json', JSON.stringify(prev)); console.log('Tablas: reuso las de hace menos de 3 h'); process.exit(0); }

const tj = await getJ(`${B}/arg.1/teams`);
const teams = (tj?.sports?.[0]?.leagues?.[0]?.teams || []).map(t => ({ id:t.team.id, n:t.team.displayName, c:t.team.shortDisplayName || t.team.displayName, ab:t.team.abbreviation, logo:t.team.logos?.[0]?.href || '' }));
if (teams.length < 20) { console.log('Tablas: ESPN no devolvió los equipos'); if (prev) await writeFile(dir + '/tablas.json', JSON.stringify(prev)); process.exit(0); }
const Y = new Date().getFullYear();
const num = s => +(s && typeof s === 'object' ? s.displayValue ?? s.value : s);
const PLAYOFF = /round of|quarter|semi|final|playoff|octavos|cuartos/i;
const RONDA = n => n.replace(/^(Apertura|Clausura) - /, '').replace('Round of 16', 'Octavos de final').replace('Quarterfinals', 'Cuartos de final').replace('Semifinals', 'Semifinales').replace(/^Final$/, 'Final');

// todos los partidos (sin repetir) de cada temporada
const events = new Map();   // id → partido
async function sched(lg, id, season) {
  const j = await getJ(`${B}/${lg}/teams/${id}/schedule?season=${season}`);
  for (const e of j?.events || []) {
    if (events.has(e.id)) continue;
    const c = e.competitions?.[0]; if (!c) continue;
    const H = c.competitors.find(x => x.homeAway === 'home'), A = c.competitors.find(x => x.homeAway === 'away'); if (!H || !A) continue;
    const st = c.status?.type?.state || 'pre', tn = e.seasonType?.name || '';
    const regular = lg === 'arg.copa_lpf' ? /group/i.test(tn) : !PLAYOFF.test(tn);
    events.set(e.id, { id:e.id, d:e.date, s:season, lg, tn, regular, st, h:H.team.id, a:A.team.id, hn:H.team.displayName, an:A.team.displayName, hs:st === 'post' ? num(H.score) : null, as:st === 'post' ? num(A.score) : null });
  }
}
for (const t of teams) {
  await Promise.all([sched('arg.1', t.id, Y), sched('arg.1', t.id, Y - 1), sched('arg.1', t.id, Y - 2), sched('arg.copa_lpf', t.id, Y - 2)]);
}
console.log('Tablas: partidos', events.size);

// puntos por equipo y temporada (fase regular, terminados)
const acc = {}, row = id => (acc[id] = acc[id] || { pj:0, g:0, e:0, p:0, gf:0, gc:0, pts:0 });
const per = {};   // per[id][season] = {pj, pts}
for (const m of events.values()) {
  if (!m.regular || m.st !== 'post' || !Number.isFinite(m.hs) || !Number.isFinite(m.as)) continue;
  for (const [id, gf, gc] of [[m.h, m.hs, m.as], [m.a, m.as, m.hs]]) {
    const pts = gf > gc ? 3 : gf === gc ? 1 : 0;
    const P = ((per[id] = per[id] || {})[m.s] = per[id][m.s] || { pj:0, pts:0 }); P.pj++; P.pts += pts;
    if (m.s === Y) { const r = row(id); r.pj++; r.gf += gf; r.gc += gc; r.pts += pts; if (pts === 3) r.g++; else if (pts === 1) r.e++; else r.p++; }
  }
}
const info = Object.fromEntries(teams.map(t => [t.id, t]));
const anual = teams.map(t => ({ id:t.id, ...row(t.id) })).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf);
const promedios = teams.map(t => {
  const s = per[t.id] || {}, cols = [Y - 2, Y - 1, Y].map(y => s[y]?.pts ?? null);
  const pj = Object.values(s).reduce((a, x) => a + x.pj, 0), pts = Object.values(s).reduce((a, x) => a + x.pts, 0);
  return { id:t.id, cols, pj, pts, prom:pj ? +(pts / pj).toFixed(3) : 0 };
}).sort((a, b) => b.prom - a.prom);

// fixture de la temporada actual: cada torneo por fecha (fecha = número de partido del local en ese torneo)
const cur = [...events.values()].filter(m => m.s === Y && m.lg === 'arg.1').sort((a, b) => Date.parse(a.d) - Date.parse(b.d));
const torneoOf = m => /clausura/i.test(m.tn) ? 'Clausura' : /apertura/i.test(m.tn) ? 'Apertura' : 'Liga';
const cnt = {}, fixture = {};
for (const m of cur) {
  const T = torneoOf(m);
  let f;
  if (m.regular) { const kh = T + m.h, ka = T + m.a; cnt[kh] = (cnt[kh] || 0) + 1; cnt[ka] = (cnt[ka] || 0) + 1; f = 'Fecha ' + Math.max(cnt[kh], cnt[ka]); }
  else f = RONDA(m.tn);
  ((fixture[T] = fixture[T] || {})[f] = fixture[T][f] || []).push({ id:m.id, d:m.d, st:m.st, h:m.h, a:m.a, hs:m.hs, as:m.as });
}

const out = { updated:new Date().toISOString(), season:Y, teams:info, anual, promedios, fixture,
  nota:'Calculado con resultados de ESPN (fase regular). Puede diferir de la tabla oficial por quitas de puntos o partidos suspendidos.' };
await writeFile(dir + '/tablas.json', JSON.stringify(out));
console.log('Tablas: ok', anual.length, 'equipos; último en promedios:', info[promedios.at(-1)?.id]?.n);
