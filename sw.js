// 파티 퀴즈 서비스워커 — 한 번 받은 파일은 캐시에서 바로 꺼내 쓴다.
// 미리 33MB 를 다 받지는 않고, 실제로 나온 문제의 음성/사진만 그때그때 캐시한다.
// (첫 접속 후에는 롤·인물 퀴즈가 인터넷 없이도 돌아간다)
const CACHE = 'party-quiz-v1';

// 화면 코드는 항상 최신을 쓰도록 설치 시 미리 받아 둔다
const SHELL = [
  './', './index.html', './credits.html',
  './css/style.css',
  './js/app.js', './js/lol.js', './js/song.js', './js/person.js',
  './data/champions.js', './data/songs.js', './data/people.js',
  './manifest.webmanifest',
];

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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 애플 미리듣기·앨범 커버는 캐시하지 않고 그대로 흘려보낸다
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // 정상 응답만 캐시 (206 부분 응답은 캐시가 거부한다)
        if (res.ok && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
    })
  );
});
