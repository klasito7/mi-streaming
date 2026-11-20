// 🌴 Especial GTA VI (del 19/11 al 19/12/2026): noticias de portales gamers y videos de youtubers, solo lo que habla de GTA.
// Gratis: usa los feeds públicos (RSS) de los portales y de YouTube; no gasta cuota.
// Uso: node scripts/fetch-gta6.mjs carpeta_salida   → escribe gta6.json
import { writeFile, readFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.';
await mkdir(dir, { recursive:true });
if (Date.now() > Date.parse('2026-12-20T12:00:00Z')) { console.log('Especial GTA VI terminado'); process.exit(0); }
const UA = { 'User-Agent':'Mozilla/5.0 (FUNVS uso personal)', 'Accept-Language':'es-AR,es;q=0.9' };
const GTA = /\bGTA\b|GTA ?(VI|6)|Grand Theft Auto|Rockstar|Leonida|Vice City/i;
const GTA6 = /\bGTA\s?(VI|6)\b|GTAVI|GTA6|Grand\s+Theft\s+Auto\s+(VI|6)\b|\bLeonida\b/i;   // videos: solo GTA VI
const get = async (u, ms = 15000) => { const r = await fetch(u, { headers:UA, signal:AbortSignal.timeout(ms) }); if (!r.ok) throw new Error(r.status); return r.text(); };
const dec = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
const tag = (x, t) => (x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || '';
let prev = {}; try { prev = JSON.parse(await readFile(dir + '/gta6.json', 'utf8')); } catch {}

// 📰 portales gamers en castellano
const PORTALES = [
  ['3DJuegos', 'https://www.3djuegos.com/feedburner.xml'], ['Vandal', 'https://vandal.elespanol.com/xml.cgi'], ['MeriStation', 'https://as.com/meristation/rss/'],
  ['HobbyConsolas', 'https://www.hobbyconsolas.com/rss'], ['Vida Extra', 'https://www.vidaextra.com/feedburner.xml'], ['IGN Latinoamérica', 'https://latam.ign.com/feed.xml'],
  ['LevelUp', 'https://www.levelup.com/rss'], ['Eurogamer', 'https://www.eurogamer.es/feed'], ['Areajugones', 'https://areajugones.sport.es/feed/'], ['Cultura Geek', 'https://culturageek.com.ar/feed/'],
];
const news = [], fuentes = {};
await Promise.all(PORTALES.map(async ([src, u]) => {
  try {
    const x = await get(u); let n = 0;
    for (const it of x.split(/<item[\s>]|<entry[\s>]/).slice(1)) {
      const t = dec(tag(it, 'title')); if (!GTA.test(t)) continue;
      const url = dec(tag(it, 'link')) || (it.match(/<link[^>]+href="([^"]+)"/) || [])[1] || '';
      const date = Date.parse(dec(tag(it, 'pubDate')) || dec(tag(it, 'published')) || dec(tag(it, 'updated'))) || Date.now();
      const img = (it.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/) || it.match(/<enclosure[^>]+url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i) || it.match(/<img[^>]+src="([^"]+)"/) || [])[1] || '';
      if (/^https?:\/\//.test(url)) { news.push({ t, url, src, date, img:img.replace(/&amp;/g, '&') }); n++; }
    }
    fuentes[src] = n;
  } catch (e) { fuentes[src] = 'error ' + e.message; }
}));
const seen = new Set();
const NEWS = [...news, ...(prev.news || [])].sort((a, b) => b.date - a.date).filter(n => { const k = n.url.split('?')[0]; if (seen.has(k)) return false; seen.add(k); return Date.now() - n.date < 40 * 864e5; }).slice(0, 80);

// ▶️ youtubers: el canal se busca por su @ (y queda guardado para la próxima)
// varios @ = canales distintos de la misma persona (Germán, Willyrex); el resto se queda con el primero que encuentra
const YT = [['IlloJuan', ['UC:UCKvoBRFqMNqvuSvFBiNadgw']], ['elrubius', ['elrubiusOMG']], ['Germán', ['JuegaGerman', 'HolaSoyGerman']], ['Willyrex', ['willyrex', 'TheWillyrex']],
  ['DaniRep', ['thedanirep']], ['Bananirou', ['bananirou']], ['Vector', ['vector']], ['Mangel', ['mangelrogel']]];
const chans = { ...(prev.chans || {}) }, vids = [];
delete chans.VectorTV; delete chans.Vectorrp;
async function idOf(h) {
  if (h.startsWith('UC:')) return h.slice(3);
  if (chans[h]) return chans[h];
  try { const x = await get('https://www.youtube.com/@' + h, 20000); const m = x.match(/"externalId":"(UC[\w-]{22})"/) || x.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) || x.match(/"channelId":"(UC[\w-]{22})"/);
    if (m) return (chans[h] = m[1]); } catch {}
  return '';
}
await Promise.all(YT.map(async ([name, hs]) => {
  for (const h of hs) {
    const cid = await idOf(h); if (!cid) continue;
    try {
      const x = await get('https://www.youtube.com/feeds/videos.xml?channel_id=' + cid);
      for (const e of x.split('<entry>').slice(1)) {
        const t = dec(tag(e, 'title')), id = tag(e, 'yt:videoId'); if (!id || !GTA6.test(t)) continue;
        vids.push({ id, t, ch:name, h:h.replace(/^UC:/, ''), date:Date.parse(tag(e, 'published')) || Date.now(), views:+(e.match(/<media:statistics views="(\d+)"/) || [])[1] || 0 });
      }
    } catch {}
  }
}));
const vs = new Set();
const VIDS = [...vids, ...(prev.vids || [])].sort((a, b) => b.date - a.date).filter(v => GTA6.test(v.t) && !['VectorTV', 'Vectorrp'].includes(v.h) && !vs.has(v.id) && vs.add(v.id) && Date.now() - v.date < 40 * 864e5).slice(0, 80);
await writeFile(dir + '/gta6.json', JSON.stringify({ updated:new Date().toISOString(), news:NEWS, vids:VIDS, chans, fuentes }));
console.log(`Especial GTA VI: ${NEWS.length} noticias (${JSON.stringify(fuentes)}), ${VIDS.length} videos, canales ${Object.keys(chans).length}`);
