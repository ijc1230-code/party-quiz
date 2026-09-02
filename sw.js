// 파티 퀴즈 서비스워커
//
// 캐시 전략을 두 갈래로 나눈다:
//  - 코드·데이터(html/css/js) : 네트워크 우선, 실패하면 캐시  -> 수정이 바로 반영되고 오프라인도 됨
//  - 음성·사진(ogg/jpg/png)   : 캐시 우선                    -> 한 번 받으면 데이터를 다시 안 씀
//
// 이전 버전은 전부 캐시 우선이어서, 프리캐시가 한 번 낡으면 갱신이 안 됐다.
const CACHE = 'party-quiz-v6';   // v6: 축구 퀴즈 2종 추가

const SHELL = [
  './', './index.html', './credits.html',
  './css/style.css',
  './js/app.js', './js/lol.js', './js/song.js', './js/person.js', './js/flag.js', './js/career.js',
  './data/champions.js', './data/songs.js', './data/people.js', './data/flags.js',
  './data/football.js', './data/clubs.js',
  './manifest.webmanifest',
];

const IS_MEDIA = /\.(ogg|mp3|m4a|jpg|jpeg|png|webp)$/i;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache:'reload' 로 받아야 브라우저 HTTP 캐시의 낡은 사본이 아니라 최신을 가져온다
    await Promise.all(SHELL.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok) await cache.put(url, res);
      } catch { /* 오프라인 설치는 그냥 넘어간다 */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// <audio> 는 Range 요청(206)을 보내는데 206 은 Cache API 에 저장할 수 없다.
// Range 없는 전체 GET 을 따로 받아 캐시하고 그 200 응답을 돌려준다.
// 클립이 짧아서(1~30초) 탐색이 필요 없으므로 전체 응답으로 충분하다.
async function mediaCacheFirst(request) {
  const cache = await caches.open(CACHE);
  const key = new URL(request.url).pathname;

  const hit = await cache.match(key);
  if (hit) return hit;

  try {
    const res = await fetch(key, { cache: 'no-store' });
    if (res.ok && res.status === 200) {
      await cache.put(key, res.clone());
      return res;
    }
  } catch { /* 아래에서 원래 요청으로 재시도 */ }
  return fetch(request);
}

// 코드·데이터는 최신을 먼저 시도하고, 오프라인이면 캐시로 떨어진다
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && res.status === 200) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw new Error('오프라인이고 캐시에도 없습니다: ' + request.url);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 애플 미리듣기·앨범 커버는 캐시하지 않고 그대로 흘려보낸다
  if (url.origin !== self.location.origin) return;

  e.respondWith(IS_MEDIA.test(url.pathname) ? mediaCacheFirst(req) : networkFirst(req));
});
