// 축구 퀴즈 데이터 수집기
//   node tools/build-football.mjs                     전체 수집
//   node tools/build-football.mjs --candidates "이름"  사진 후보만 보기
//   node tools/build-football.mjs --no-photo          커리어만 다시 만들기(사진 건너뜀)
//
// tools/football-roster.json 을 읽어서
//   data/football.js   선수 + 커리어
//   data/clubs.js      클럽 한국어 이름 · 배지 색
//   img/football/*.jpg 선수 사진
//   credits.html       사진 출처 표(축구 부분)
// 을 만든다.
//
// 커리어는 영문 위키백과 {{Infobox football biography}} 의 years/clubs 를 쓴다.
// 유스는 youthclubs 라 애초에 안 들어오고, 임대는 '→ 팀 (loan)', 2군은 'Hamburger SV II'
// 같은 표기라 걸러낸다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CACHE_DIR = path.join(HERE, '.cache');
const IMG_DIR = path.join(ROOT, 'img', 'football');
const UA = 'party-quiz-builder/1.0 (personal quiz project; https://ijc1230-code.github.io/party-quiz/)';  // 헤더는 ASCII 만 가능

const args = process.argv.slice(2);
const NO_PHOTO = args.includes('--no-photo');

/* ------------------------------------------------------------ 요청 (캐시 + 간격) */
let lastAt = 0;
async function politeFetch(url) {
  const wait = 700 - (Date.now() - lastAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastAt = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(res.status + ' ' + url);
  return res;
}

// 위키 API 응답은 캐시해 둔다. 재실행이 잦아서(사진 교체 등) 매번 두드리면 느리고 예의도 아니다.
async function api(host, params) {
  const u = new URL('https://' + host + '/w/api.php');
  u.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params });

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // 질의 전체를 해시로 (앞부분만 잘라 쓰면 titles 만 다른 요청들이 같은 캐시를 읽는다)
  const key = host + '_' + crypto.createHash('sha1').update(u.search).digest('hex') + '.json';
  const file = path.join(CACHE_DIR, key);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));

  const data = await (await politeFetch(u)).json();
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

/* ------------------------------------------------------------- 위키텍스트 정리 */
function clean(s) {
  return String(s)
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

// [[A|B]] / [[A]] 에서 문서 제목(A)과 표시 이름(B)을 뽑는다
function firstLink(s) {
  const m = s.match(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/);
  if (!m) return null;
  return { title: m[1].trim(), label: (m[2] || m[1]).trim() };
}

function infobox(wikitext) {
  const start = wikitext.search(/\{\{\s*Infobox football biography/i);
  if (start < 0) return null;

  const fields = {};
  let depth = 0;
  for (const line of wikitext.slice(start).split('\n')) {
    const t = line.trim();
    // 인포박스 안에 {{CSS image crop}} 같은 템플릿이 끼어 있어서(설기현) 여는/닫는
    // 괄호를 세지 않으면 엉뚱한 '}}' 에서 일찍 끊긴다
    const before = depth;
    depth += (t.match(/\{\{/g) || []).length - (t.match(/\}\}/g) || []).length;
    if (before === 1 && depth <= 0) break;                 // 인포박스가 닫혔다
    if (before !== 1 || !t.startsWith('|')) continue;      // 중첩 템플릿 안쪽 줄은 무시
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(1, eq).trim().toLowerCase();
    if (!(k in fields)) fields[k] = t.slice(eq + 1);
  }
  return fields;
}

/* --------------------------------------------------------- 2군·유스팀 걸러내기 */
const RESERVE_TAIL = /\s(II|III|2|B|C|Reserves?|Castilla|Atlètic|Atletic|Mestalla|Amateure|Amateurs)$/i;
const RESERVE_WORD = /(Reserves|Academy|Youth|U-?1[5-9]|U-?2[0-3]|Under-\d+)/i;
const RESERVE_NAMES = new Set([
  'Real Madrid Castilla', 'Barcelona Atlètic', 'Bilbao Athletic', 'Valencia Mestalla',
  'Sevilla Atlético', 'Deportivo Fabril', 'Real Madrid C', 'Bayern Munich II',
]);

function isReserve(title) {
  return RESERVE_NAMES.has(title) || RESERVE_TAIL.test(title) || RESERVE_WORD.test(title);
}

function parseYears(raw) {
  const s = clean(raw).replace(/[–—-]/g, '–');
  const m = s.match(/(\d{4})\s*(?:–\s*(\d{4})?)?/);
  if (!m) return { from: null, to: null };
  return { from: Number(m[1]), to: m[2] ? Number(m[2]) : (s.includes('–') ? null : Number(m[1])) };
}

// 인포박스에서 시니어 커리어만 순서대로 뽑는다
function seniorCareer(fields) {
  const out = [];
  for (let i = 1; i <= 30; i++) {
    const rawClub = fields['clubs' + i];
    if (rawClub == null) continue;
    const raw = clean(rawClub);
    if (!raw) continue;
    if (raw.startsWith('→')) continue;                    // 임대
    if (/\(loan\)/i.test(raw)) continue;                  // 임대 (표기가 다른 경우)

    // {{ill|Korea Trust Bank|ko|한국신탁은행 축구단}} — 영문 문서가 없는 팀(차범근)
    const ill = raw.match(/\{\{\s*ill\s*\|([^|}]+)\|\s*ko\s*\|([^|}]+)/i);
    const link = firstLink(raw);
    const title = ill ? ill[1].trim()
      : link ? link.title.split('#')[0]
        : raw.replace(/[[\]{}]/g, '').split('|')[0].trim();
    if (!title || isReserve(title)) continue;             // 2군·유스
    const label = link ? link.label : title;
    if (isReserve(label)) continue;
    const { from, to } = parseYears(fields['years' + i] || '');
    out.push({ club: title, label, ko: ill ? ill[2].trim() : '', from, to });
  }
  // 같은 팀에 두 번 갔다 온 경우(복귀)도 순서대로 그대로 남긴다
  return out;
}

/* --------------------------------------------------------------- 클럽 배지 색 */
// 유명 클럽만 손으로 넣는다. 없는 팀은 이름 해시로 색을 만든다(배지는 장식이고
// 팀 이름이 카드에 같이 적히므로, 정확한 유니폼 색일 필요는 없다).
const CLUB_STYLE = {
  'Manchester United F.C.':      ['#DA291C', '#FBE122', 'MUN'],
  'Manchester City F.C.':        ['#6CABDD', '#1C2C5B', 'MCI'],
  'Liverpool F.C.':              ['#C8102E', '#00B2A9', 'LFC'],
  'Chelsea F.C.':                ['#034694', '#DBA111', 'CHE'],
  'Arsenal F.C.':                ['#EF0107', '#FFFFFF', 'ARS'],
  'Tottenham Hotspur F.C.':      ['#132257', '#FFFFFF', 'TOT'],
  'Everton F.C.':                ['#003399', '#FFFFFF', 'EVE'],
  'Newcastle United F.C.':       ['#241F20', '#FFFFFF', 'NEW'],
  'Aston Villa F.C.':            ['#95BFE5', '#670E36', 'AVL'],
  'Leeds United F.C.':           ['#FFCD00', '#1D428A', 'LEE'],
  'Wolverhampton Wanderers F.C.': ['#FDB913', '#231F20', 'WOL'],
  'Queens Park Rangers F.C.':    ['#1D5BA4', '#FFFFFF', 'QPR'],
  'Fulham F.C.':                 ['#FFFFFF', '#000000', 'FUL'],
  'Southampton F.C.':            ['#D71920', '#130C0E', 'SOU'],
  'Swansea City A.F.C.':         ['#FFFFFF', '#121212', 'SWA'],
  'Sunderland A.F.C.':           ['#EB172B', '#FFFFFF', 'SUN'],
  'West Ham United F.C.':        ['#7A263A', '#1BB1E7', 'WHU'],
  'Real Madrid CF':              ['#FEBE10', '#00529F', 'RMA'],
  'FC Barcelona':                ['#A50044', '#004D98', 'FCB'],
  'Atlético Madrid':             ['#CB3524', '#262E62', 'ATM'],
  'Valencia CF':                 ['#FFFFFF', '#F18800', 'VAL'],
  'Sevilla FC':                  ['#D91A21', '#FFFFFF', 'SEV'],
  'Villarreal CF':               ['#FFE667', '#005187', 'VIL'],
  'Real Sociedad':               ['#0067B1', '#FFFFFF', 'RSO'],
  'Athletic Bilbao':             ['#EE2523', '#FFFFFF', 'ATH'],
  'RCD Espanyol':                ['#007FC8', '#FFFFFF', 'ESP'],
  'Juventus FC':                 ['#000000', '#FFFFFF', 'JUV'],
  'A.C. Milan':                  ['#FB090B', '#000000', 'MIL'],
  'Inter Milan':                 ['#0068A8', '#010E80', 'INT'],
  'A.S. Roma':                   ['#8E1F2F', '#F0BC42', 'ROM'],
  'S.S. Lazio':                  ['#87D8F7', '#FFFFFF', 'LAZ'],
  'S.S.C. Napoli':               ['#12A0D7', '#FFFFFF', 'NAP'],
  'ACF Fiorentina':              ['#7B3F98', '#FFFFFF', 'FIO'],
  'Parma Calcio 1913':           ['#FFD200', '#0067B2', 'PAR'],
  'Udinese Calcio':              ['#000000', '#FFFFFF', 'UDI'],
  'Bayern Munich':               ['#DC052D', '#0066B2', 'FCB'],
  'FC Bayern Munich':            ['#DC052D', '#0066B2', 'FCB'],
  'Borussia Dortmund':           ['#FDE100', '#000000', 'BVB'],
  'Bayer 04 Leverkusen':         ['#E32221', '#000000', 'B04'],
  'Hamburger SV':                ['#0A3D91', '#FFFFFF', 'HSV'],
  'FC Schalke 04':               ['#004D9D', '#FFFFFF', 'S04'],
  'VfB Stuttgart':               ['#E32219', '#FFFFFF', 'VFB'],
  'Werder Bremen':               ['#1D9053', '#FFFFFF', 'SVW'],
  'Eintracht Frankfurt':         ['#E1000F', '#000000', 'SGE'],
  'FC Augsburg':                 ['#BA3733', '#46714D', 'FCA'],
  'VfL Wolfsburg':               ['#65B32E', '#FFFFFF', 'WOB'],
  '1. FSV Mainz 05':             ['#C3141E', '#FFFFFF', 'M05'],
  'Paris Saint-Germain F.C.':    ['#004170', '#DA291C', 'PSG'],
  'Olympique Lyonnais':          ['#FFFFFF', '#003399', 'OL'],
  'Olympique de Marseille':      ['#2FAEE0', '#FFFFFF', 'OM'],
  'AS Monaco FC':                ['#E63329', '#FFFFFF', 'ASM'],
  'AJ Auxerre':                  ['#005BA9', '#FFFFFF', 'AJA'],
  'AFC Ajax':                    ['#D2122E', '#FFFFFF', 'AJA'],
  'PSV Eindhoven':               ['#ED1C24', '#FFFFFF', 'PSV'],
  'Feyenoord':                   ['#DE1B22', '#FFFFFF', 'FEY'],
  'S.L. Benfica':                ['#E30613', '#FFFFFF', 'SLB'],
  'FC Porto':                    ['#00428C', '#FFFFFF', 'POR'],
  'Sporting CP':                 ['#008057', '#FFFFFF', 'SCP'],
  'Boca Juniors':                ['#0A2472', '#FFC72C', 'BOC'],
  'River Plate':                 ['#FFFFFF', '#DA291C', 'RIV'],
  'Santos FC':                   ['#FFFFFF', '#000000', 'SAN'],
  'Cruzeiro Esporte Clube':      ['#0A3B8C', '#FFFFFF', 'CRU'],
  'Sport Club Internacional':    ['#E5050F', '#FFFFFF', 'INT'],
  'S.C. Corinthians Paulista':   ['#000000', '#FFFFFF', 'COR'],
  'Los Angeles FC':              ['#000000', '#C39E6D', 'LAF'],
  'Inter Miami CF':              ['#F7B5CD', '#000000', 'MIA'],
  'LA Galaxy':                   ['#00245D', '#FFD200', 'LAG'],
  'Al Nassr FC':                 ['#F9DC33', '#0B4EA2', 'NAS'],
  'Al Hilal SFC':                ['#0B4EA2', '#FFFFFF', 'HIL'],
  'Celtic F.C.':                 ['#018749', '#FFFFFF', 'CEL'],
  'FC Seoul':                    ['#D6001C', '#000000', 'SEO'],
  'Jeonbuk Hyundai Motors':      ['#0A6E3E', '#FFFFFF', 'JBH'],
  'Suwon Samsung Bluewings':     ['#005BAC', '#FFFFFF', 'SUW'],
  'Ulsan HD FC':                 ['#0A4DA2', '#FFFFFF', 'ULS'],
  'Kyoto Sanga FC':              ['#8A1B61', '#FFFFFF', 'KYO'],
  'RB Leipzig':                  ['#DD0741', '#001F47', 'RBL'],
  'FC Red Bull Salzburg':        ['#D40028', '#FFFFFF', 'RBS'],
  'Wolverhampton Wanderers':     ['#FDB913', '#231F20', 'WOL'],
  'SSC Napoli':                  ['#12A0D7', '#FFFFFF', 'NAP'],
  'Fenerbahçe S.K. (football)':  ['#12326E', '#FFED00', 'FEN'],
  'Galatasaray S.K. (football)': ['#A90432', '#FBB912', 'GAL'],
};

// 표에 없는 팀: 이름에서 색을 만든다 (같은 팀은 항상 같은 색)
function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return ['hsl(' + hue + ' 55% 42%)', 'hsl(' + ((hue + 40) % 360) + ' 45% 24%)'];
}

const NOISE = /^(FC|F\.C\.|AFC|A\.F\.C\.|CF|C\.F\.|SC|S\.C\.|AC|A\.C\.|SS|S\.S\.|SSC|S\.S\.C\.|AS|A\.S\.|SL|S\.L\.|SV|VfB|VfL|BSC|RC|RCD|UD|CD|CA|SK|S\.K\.|1\.|FSV|TSV|BV|RB|Club|de|do|of)$/i;

function shortCode(enTitle) {
  const base = enTitle.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[.,-]/g, ' ');
  const words = base.split(/\s+/).filter((w) => w && !NOISE.test(w));
  const letters = (s) => s.normalize('NFD').replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (!words.length) return letters(enTitle).slice(0, 3) || '??';

  let code = words.slice(0, 3).map((w) => letters(w)[0] || '').join('');
  // 두 글자 이하면 배지가 허전하다 — 첫 단어에서 글자를 더 가져온다 (Bryne FK -> BRY)
  if (code.length < 3) code = (letters(words[0]).slice(0, 3) + letters(words[1] || '')).slice(0, 3);
  return code;
}

// 'Paris Saint-Germain F.C.' 와 'Paris Saint-Germain FC' 처럼 표기만 다른 제목을 같이 찾기
const STYLE_BY_KEY = new Map(
  Object.entries(CLUB_STYLE).map(([k, v]) => [k.replace(/[^a-z0-9]/gi, '').toLowerCase(), v]),
);
const styleOf = (title) => STYLE_BY_KEY.get(title.replace(/[^a-z0-9]/gi, '').toLowerCase());

// 한국어 문서가 없는 팀 (위키에 한국어판이 아예 없다)
const KO_FALLBACK = {
  'Delta Warsaw': '델타 바르샤바',
  'Olympique Alès': '올랭피크 알레스',
};

function trimKoClub(ko) {
  const noDisambig = ko.replace(/\s*\((축구|축구단|축구 클럽)\)\s*$/, '').trim();
  // 'FC' 를 떼도 이름이 남을 때만 뗀다 ('로스앤젤레스 FC' 를 '로스앤젤레스' 로 만들면 안 된다)
  const trimmed = noDisambig.replace(/\s+(FC|F\.C\.|CF|SC|AC|SK|S\.K\.)$/i, '').trim();
  return trimmed.split(/\s+/).length >= 2 ? trimmed : noDisambig;
}

/* ----------------------------------------------------------------- 위키 조회 */
async function wikitext(title) {
  const d = await api('en.wikipedia.org', { action: 'parse', prop: 'wikitext', page: title, redirects: '1' });
  if (d.error) throw new Error(title + ': ' + d.error.info);
  return d.parse.wikitext;
}

// 여러 문서의 한국어 제목을 한 번에 (최대 50개)
// 넘겨주기(redirect)도 함께 풀어서 돌려준다 — 같은 팀이 'Paris Saint-Germain FC' 와
// 'Paris Saint-Germain F.C.' 두 개로 갈라지는 걸 막는다
async function koTitles(titles) {
  const map = new Map();
  const canon = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const chunk = titles.slice(i, i + 40);
    const d = await api('en.wikipedia.org', {
      action: 'query', prop: 'langlinks', lllang: 'ko', lllimit: 'max',
      titles: chunk.join('|'), redirects: '1',
    });
    const q = d.query || {};
    // 넘겨준 제목 -> 실제 문서 제목 (정규화·넘겨주기 반영)
    const alias = new Map();
    for (const n of q.normalized || []) alias.set(n.from, n.to);
    for (const r of q.redirects || []) alias.set(r.from, r.to);
    const byTitle = new Map((q.pages || []).map((p) => [p.title, p.langlinks?.[0]?.title]));
    for (const t of chunk) {
      let real = t;
      for (let hop = 0; hop < 3 && alias.has(real); hop++) real = alias.get(real);
      canon.set(t, real);
      const ko = byTitle.get(real);
      if (ko) { map.set(t, ko); map.set(real, ko); }
    }
  }
  return { ko: map, canon };
}

// 선수 대표 사진 파일 이름
async function leadFile(title) {
  const d = await api('en.wikipedia.org', {
    action: 'query', prop: 'pageimages', piprop: 'name', titles: title, redirects: '1',
  });
  const name = d.query?.pages?.[0]?.pageimage;
  return name ? 'File:' + name : null;
}

// 커먼즈에 있는 파일만 쓴다 (영문 위키의 비자유 파일은 우리 저장소에 담으면 안 된다)
async function commonsInfo(fileTitle, width = 640) {
  const d = await api('commons.wikimedia.org', {
    action: 'query', prop: 'imageinfo', titles: fileTitle,
    iiprop: 'url|extmetadata', iiurlwidth: String(width),
  });
  const page = d.query?.pages?.[0];
  if (!page || page.missing || !page.imageinfo?.length) return null;
  const ii = page.imageinfo[0];
  const meta = ii.extmetadata || {};
  // 커먼즈는 미리 만들어 둔 크기(320/640/960…)로만 준다. 폭을 직접 지정하면 400 이 난다.
  // 대개 960px(200~400KB)가 오는데, 원본(수 MB)보다는 훨씬 작으니 그대로 쓴다.
  const thumb = (ii.thumburl || '').split('?')[0];
  return {
    url: thumb || ii.url.split('?')[0],
    page: ii.descriptionurl,
    license: clean(meta.LicenseShortName?.value || ''),
    artist: clean(meta.Artist?.value || ''),
  };
}

async function searchCommons(q, limit = 12) {
  const d = await api('commons.wikimedia.org', {
    action: 'query', list: 'search', srnamespace: '6', srlimit: String(limit), srsearch: q,
  });
  return (d.query?.search || []).map((s) => s.title);
}

/* --------------------------------------------------------------- 사진 후보 모드 */
async function candidates(name) {
  const player = ROSTER.players.find((p) => p.ko === name || p.en === name);
  const en = player ? player.en : name;
  const prime = player?.prime;
  console.log('# ' + en + (prime ? '  (전성기 ' + prime[0] + '–' + prime[1] + ')' : ''));

  const seen = new Set();
  const queries = [en, en + ' ' + (prime ? prime[0] : ''), en + ' ' + (prime ? prime[1] : '')];
  for (const q of queries) {
    for (const t of await searchCommons(q.trim(), 10)) {
      if (seen.has(t) || !/\.(jpg|jpeg|png)$/i.test(t)) continue;
      seen.add(t);
      console.log('  ' + t);
    }
  }
  const lead = await leadFile(en);
  console.log('  (위키 대표 사진) ' + (lead || '없음'));
}

/* ----------------------------------------------------------------------- 본체 */
const ROSTER = JSON.parse(fs.readFileSync(path.join(HERE, 'football-roster.json'), 'utf8'));

if (args.includes('--candidates')) {
  await candidates(args[args.indexOf('--candidates') + 1]);
  process.exit(0);
}

console.log('선수 ' + ROSTER.players.length + '명');

const players = [];
const problems = [];

for (const p of ROSTER.players) {
  let fields;
  try {
    fields = infobox(await wikitext(p.en));
  } catch (e) {
    problems.push(p.ko + ': 문서 없음 (' + p.en + ') ' + e.message);
    continue;
  }
  if (!fields) { problems.push(p.ko + ': 인포박스 없음 (' + p.en + ')'); continue; }

  const career = seniorCareer(fields);
  if (career.length < 2) problems.push(p.ko + ': 커리어가 ' + career.length + '팀뿐');

  players.push({ ...p, career });
  process.stdout.write('.');
}
console.log('');

/* 클럽 한국어 이름 */
const rawTitles = [...new Set(players.flatMap((p) => p.career.map((c) => c.club)))];
console.log('클럽 ' + rawTitles.length + '개 한국어 이름 조회');
const { ko, canon } = await koTitles(rawTitles);

// 넘겨주기를 푼 제목으로 통일
for (const p of players) for (const c of p.career) c.club = canon.get(c.club) || c.club;
const clubTitles = [...new Set(players.flatMap((p) => p.career.map((c) => c.club)))];

// 위키에 한국어 문서가 없어도 인포박스에 한국어 이름이 적혀 있는 경우가 있다
const inlineKo = new Map();
for (const p of players) for (const c of p.career) if (c.ko) inlineKo.set(c.club, c.ko);

const CLUBS = {};
for (const t of clubTitles) {
  const style = styleOf(t);
  const [c1, c2] = style ? [style[0], style[1]] : hashColor(t);
  const name = ko.get(t) || inlineKo.get(t) || KO_FALLBACK[t];
  CLUBS[t] = {
    ko: trimKoClub(name || t),
    short: style ? style[2] : shortCode(t),
    c1, c2,
  };
  if (!name) problems.push('클럽 한국어 이름 없음: ' + t);
}

/* 사진 */
fs.mkdirSync(IMG_DIR, { recursive: true });
const credits = [];

for (let i = 0; i < players.length; i++) {
  const p = players[i];
  // 확장자는 실제 파일 형식을 따른다 (커먼즈에 PNG 로 올라온 사진이 섞여 있다)
  p.source = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(p.en.replace(/ /g, '_'));

  if (NO_PHOTO) {
    const ext = ['jpg', 'png'].find((e) => fs.existsSync(path.join(IMG_DIR, 'f' + i + '.' + e)));
    if (ext) p.img = 'img/football/f' + i + '.' + ext;
    else problems.push(p.ko + ': 사진 없음(--no-photo)');
    continue;
  }

  const fileTitle = p.photo || await leadFile(p.en);
  if (!fileTitle) { problems.push(p.ko + ': 사진을 못 찾음'); continue; }

  const info = await commonsInfo(fileTitle);
  if (!info) { problems.push(p.ko + ': 커먼즈에 없는 파일 — ' + fileTitle); continue; }

  const ext = (info.url.match(/\.(jpe?g|png)(?:[?#]|$)/i) || [, 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg');
  try {
    const buf = Buffer.from(await (await politeFetch(info.url)).arrayBuffer());
    fs.writeFileSync(path.join(IMG_DIR, 'f' + i + '.' + ext), buf);
    p.img = 'img/football/f' + i + '.' + ext;
  } catch (e) {
    problems.push(p.ko + ': 사진 내려받기 실패 — ' + e.message);
    continue;
  }

  p.credit = info.page;
  p.file = fileTitle;
  credits.push({ ko: p.ko, source: p.source, file: fileTitle, page: info.page, license: info.license });
  process.stdout.write('.');
}
console.log('');

/* ------------------------------------------------------------------- 파일 쓰기 */
const HEAD = '// 자동 생성 파일 - tools/build-football.mjs 로 다시 만들 수 있습니다\n';

const out = players.map((p) => ({
  ko: p.ko,
  en: p.en,
  desc: p.desc,
  tier: p.tier,
  img: p.img,
  source: p.source,
  credit: p.credit || '',
  career: p.career.map((c) => ({ club: c.club, from: c.from, to: c.to })),
}));

fs.writeFileSync(path.join(ROOT, 'data', 'football.js'),
  HEAD + 'window.FOOTBALL = ' + JSON.stringify(out, null, 1) + ';\n');

fs.writeFileSync(path.join(ROOT, 'data', 'clubs.js'),
  HEAD + 'window.CLUBS = ' + JSON.stringify(CLUBS, null, 1) + ';\n');

/* credits.html 의 축구 표 갈아 끼우기 */
const CREDIT_START = '<!-- 축구 사진 출처 시작 -->';
const CREDIT_END = '<!-- 축구 사진 출처 끝 -->';
const rows = credits.map((c) => '    <tr><td>' + c.ko + '</td>'
  + '<td><a href="' + c.source + '" target="_blank" rel="noreferrer">위키백과</a></td>'
  + '<td class="u"><a href="' + c.page + '" target="_blank" rel="noreferrer">'
  + c.file.replace(/^File:/, '') + '</a>' + (c.license ? ' <span class="lic">' + c.license + '</span>' : '')
  + '</td></tr>').join('\n');

const block = CREDIT_START + '\n'
  + '<h1 id="football">축구선수 사진 출처</h1>\n'
  + '<p>축구 퀴즈(사진·소속팀)에 쓰인 사진은 모두 위키미디어 공용에서 가져왔습니다. 저작자와 라이선스는 아래 파일 링크의 설명 페이지에 있습니다.</p>\n'
  + '<table><thead><tr><th>선수</th><th>문서</th><th>사진 파일</th></tr></thead>\n<tbody>\n'
  + rows + '\n</tbody></table>\n' + CREDIT_END;

const creditsPath = path.join(ROOT, 'credits.html');
let html = fs.readFileSync(creditsPath, 'utf8');
if (html.includes(CREDIT_START)) {
  html = html.replace(new RegExp(CREDIT_START + '[\\s\\S]*?' + CREDIT_END), block);
} else {
  html = html.replace('</body>', block + '\n</body>');
}
if (!NO_PHOTO || !fs.existsSync(creditsPath)) fs.writeFileSync(creditsPath, html);

/* --------------------------------------------------------------------- 마무리 */
const clubCount = Object.keys(CLUBS).length;
const styled = Object.keys(CLUBS).filter((t) => styleOf(t)).length;
console.log('선수 ' + out.length + '명 · 클럽 ' + clubCount + '개 (색 지정 ' + styled + ', 자동 ' + (clubCount - styled) + ')');
console.log('사진 ' + credits.length + '장');

if (problems.length) {
  console.log('\n확인 필요 ' + problems.length + '건:');
  for (const w of problems) console.log('  - ' + w);
} else {
  console.log('문제 없음');
}
