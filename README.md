# 파티 퀴즈 (웹)

게임 5종: 롤 픽 소리(173) · 노래(83) · 인물 사진(133) · 국기(133) · 축구 소속팀(60)

GitHub Pages 배포 폴더.
혼자 쓰는 페이지라 검색엔진 색인은 막아 뒀다 (`robots.txt`, `noindex`).

> ⚠️ **원본이 어디인지 주의.**
> 원래는 `Desktop\11\games` 가 원본이고 `tools/sync-game.mjs` 로 이 폴더에 복사하는 구조였다.
> 그런데 **축구 퀴즈(사진·소속팀)는 이 저장소에서 직접 만들었다.** 원본 폴더에는 없다.
> 그러니 지금은 **이 저장소가 원본**이다. 원본 폴더가 있는 PC 에서 `sync-game.mjs` 를 돌리면
> 이 폴더를 통째로 지우고 덮어써서 축구 퀴즈가 사라진다. 돌리기 전에 원본 폴더로 먼저 합칠 것.

## 배포

개인 GitHub 계정으로 로그인한 뒤:

```bash
gh auth login   # 개인 계정 (ijc1230-code)
gh repo create party-quiz --public --source=. --push
gh api -X POST repos/ijc1230-code/party-quiz/pages -f "source[branch]=main" -f "source[path]=/"
```

배포됨: **https://ijc1230-code.github.io/party-quiz/**

## 태블릿에서 쓰기

1. 크롬으로 위 주소 접속 (첫 접속은 Wi-Fi 권장 — 음성·사진을 받는다)
2. 메뉴 → **홈 화면에 추가** → 아이콘이 생기고 전체화면 앱처럼 뜬다

## 게임 내용을 고친 뒤

롤·노래·인물·국기 는 여기 파일을 직접 고치고 커밋하면 된다.

```bash
git add -A && git commit -m "update" && git push
```

## 축구 퀴즈 선수를 바꾸려면

선수 명단은 `tools/football-roster.json` 하나뿐이다. 여기에 이름·영문 위키 문서 제목·난이도를
적고 스크립트를 돌리면 커리어·클럽 한국어 이름·사진이 자동으로 채워진다.

```bash
node tools/build-football.mjs              # 명단대로 다시 만든다
node tools/build-football.mjs --no-photo   # 사진은 그대로 두고 커리어만
node tools/build-football.mjs --candidates "Son Heung-min"   # 사진 후보 목록
```

- 커리어는 영문 위키백과 인포박스에서 가져오고 **유스·임대·2군은 자동으로 뺀다**.
- 사진이 마음에 안 들면 `--candidates` 로 후보를 보고 명단의 `photo` 에 파일명을 적는다.
  (비워 두면 위키백과 대표 사진을 쓴다.)
- 선수 사진은 위키미디어 공용에 있는 것만 받는다.
- **클럽 엠블럼**은 위키백과 구단 문서의 `{{Infobox football club}}` 에 실린 엠블럼 파일을 받는다
  (`img/club/`, 143팀 중 141팀). 엠블럼은 구단 상표이고 비영리 개인용으로만 쓴다.
  문서가 아예 없는 옛 팀 2곳(델타 바르샤바·한국신탁은행)만 팀 색 이니셜로 대신한다 —
  그 색은 스크립트 안 `CLUB_STYLE` 표에서 온다.
- 이미 받아 둔 사진·엠블럼은 다시 받지 않는다. 강제로 새로 받으려면 `--refresh`.

## 오프라인 동작

`sw.js` 가 한 번 받은 파일을 캐시해서, 두 번째 접속부터는 롤·인물 퀴즈가 인터넷 없이 돌아간다.
미리 34MB 를 다 받지는 않고 **실제로 나온 문제의 음성·사진만** 그때그때 캐시한다.

노래 퀴즈는 애플 미리듣기를 스트리밍하므로 **항상 인터넷이 필요**하다 (캐시하지 않는다).

### 확인 방법

태블릿에서 한 번 실행해 롤 퀴즈를 몇 문제 풀어 본 뒤 → **비행기 모드** → 새로고침 →
그 문제들이 다시 나올 때 소리가 나면 캐시가 동작하는 것이다.

> 검증됨: 배포된 https 사이트에서 서비스워커가 활성화되고, 롤 픽 음성이 캐시되어
> 캐시본만으로 재생되는 것까지 확인했다 (200 / audio/ogg / 24KB).
>
> 다만 **미리 다 받는 게 아니라 실제로 나온 문제만** 캐시된다. 비행기 모드에서
> 처음 보는 챔피언은 소리가 안 난다.

## 파일

| 항목 | 설명 |
|---|---|
| `index.html` 외 정적 파일 | 게임 본체 |
| `sw.js` | 서비스워커 (오프라인 캐시) |
| `manifest.webmanifest` | 홈 화면 추가 시 앱 이름·아이콘·전체화면 설정 |
| `.nojekyll` | GitHub Pages 의 Jekyll 처리 비활성화 |
| `robots.txt` | 검색엔진 색인 차단 |
| `tools/football-roster.json` | 축구 퀴즈 선수 명단 (손으로 고치는 파일) |
| `tools/build-football.mjs` | 명단 → `data/football.js`·`data/clubs.js`·`img/football/` |
| `tools/sync-game.mjs` | 옛 원본 폴더 → 이 폴더 복사 (위 경고 참고) |
