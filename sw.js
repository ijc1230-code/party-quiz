// 파티 퀴즈 서비스워커 — 한 번 받은 파일은 캐시에서 바로 꺼내 쓴다.
// 미리 34MB 를 다 받지는 않고, 실제로 나온 문제의 음성/사진만 그때그때 캐시한다.
// (첫 접속 후에는 그 문제들이 인터넷 없이도 돌아간다)
const CACHE = 'party-quiz-v3';   // v3: 픽 음성을 한국어로 교체

// 화면 코드는 설치할 때 미리 받아 둔다
const SHELL = [
  './', './index.html', './credits.html',
  './css/style.css',
  './js/app.js', './js/lol.js', './js/song.js', './js/person.js',
  './data/champions.js', './data/songs.js', './data/people.js',
  './manifest.webmanifest',
];

const IS_MEDIA = /\.(ogg|mp3|m4a|jpg|jpeg|png|webp)$/i;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// <audio> 는 Range 요청(206 부분 응답)을 보내는데 206 은 Cache API 에 저장할 수 없다.
// 그래서 Range 를 무시한 전체 GET 을 따로 받아서 캐시하고, 그 200 응답을 돌려준다.
// 클립이 짧아서(1~30초) 탐색이 필요 없으므로 전체 응답으로 충분하다.
async function mediaFirst(request) {
  const cache = await caches.open(CACHE);
  const url = new URL(request.url);
  const key = url.pathname;                 // Range 헤더와 무관하게 경로로 캐시

  const hit = await cache.match(key);
  if (hit) return hit;

  try {
    const res = await fetch(key, { cache: 'no-store' });   // Range 없이 전체 요청
    if (res.ok && res.status === 200) {
      await cache.put(key, res.clone());
      return res;
    }
    return fetch(request);                  // 이상하면 원래 요청 그대로
  } catch {
    return fetch(request);                  // 오프라인이고 캐시도 없으면 실패시킨다
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.status === 200) cache.put(request, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 애플 미리듣기·앨범 커버는 캐시하지 않고 그대로 흘려보낸다
  if (url.origin !== self.location.origin) return;

  e.respondWith(IS_MEDIA.test(url.pathname) ? mediaFirst(req) : cacheFirst(req));
});
