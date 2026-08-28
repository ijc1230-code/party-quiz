// 웹 게임 원본(Desktop\11\games)을 이 배포 폴더로 복사한다.
//   node tools/sync-game.mjs
// GitHub Pages 에 올릴 정적 파일만 남기고, 로컬 서버·bat·데이터 수집 스크립트는 제외한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = process.env.GAME_SRC || path.resolve(ROOT, '..', '11', 'games');

const INCLUDE = [
  'index.html', 'credits.html', 'manifest.webmanifest', 'sw.js',
  'css', 'js', 'data', 'audio', 'img',
];

if (!fs.existsSync(SRC)) {
  console.error('게임 원본을 찾을 수 없습니다: ' + SRC);
  process.exit(1);
}

// 이전 사본 정리 (git 관련 파일과 배포 설정은 남긴다)
const KEEP = new Set(['.git', '.gitignore', '.nojekyll', 'robots.txt', 'README.md', 'tools']);
for (const name of fs.readdirSync(ROOT)) {
  if (!KEEP.has(name)) fs.rmSync(path.join(ROOT, name), { recursive: true, force: true });
}

let files = 0;
let bytes = 0;
function copy(rel) {
  const from = path.join(SRC, rel);
  const to = path.join(ROOT, rel);
  if (!fs.existsSync(from)) { console.warn('  (없음, 건너뜀) ' + rel); return; }
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) copy(path.join(rel, name));
  } else {
    fs.copyFileSync(from, to);
    files++;
    bytes += stat.size;
  }
}

console.log('게임 파일 복사: ' + SRC);
for (const item of INCLUDE) copy(item);
console.log('  -> ' + files + '개 파일, ' + (bytes / 1e6).toFixed(1) + 'MB');

// GitHub Pages 가 Jekyll 로 처리하지 않게 (밑줄로 시작하는 파일 무시 등을 막는다)
fs.writeFileSync(path.join(ROOT, '.nojekyll'), '');

// 검색엔진 색인 차단 — 배포 목적이 아니라 혼자 쓰는 페이지다
fs.writeFileSync(path.join(ROOT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

for (const f of ['index.html', 'data/songs.js', 'sw.js', 'manifest.webmanifest']) {
  const ok = fs.existsSync(path.join(ROOT, f));
  console.log('  ' + (ok ? '있음' : '★없음') + '  ' + f);
  if (!ok) process.exitCode = 1;
}
