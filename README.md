# 파티 퀴즈 (웹)

`Desktop\11\games` 의 게임을 GitHub Pages 로 올리기 위한 배포 폴더.
혼자 쓰는 페이지라 검색엔진 색인은 막아 뒀다 (`robots.txt`, `noindex`).

## 배포

개인 GitHub 계정으로 로그인한 뒤:

```bash
gh auth login                       # 개인 계정 선택
gh repo create party-quiz --public --source=. --push
gh api -X POST repos/:owner/party-quiz/pages -f "source[branch]=main" -f "source[path]=/"
```

몇 분 뒤 `https://<계정>.github.io/party-quiz/` 에서 열린다.

## 태블릿에서 쓰기

1. 크롬으로 위 주소 접속 (첫 접속은 Wi-Fi 권장 — 음성·사진을 받는다)
2. 메뉴 → **홈 화면에 추가** → 아이콘이 생기고 전체화면 앱처럼 뜬다

## 게임 내용을 고친 뒤

원본은 `Desktop\11\games` 다. 그쪽을 고치고:

```bash
node tools/sync-game.mjs
git add -A && git commit -m "update" && git push
```

## 오프라인 동작

`sw.js` 가 한 번 받은 파일을 캐시해서, 두 번째 접속부터는 롤·인물 퀴즈가 인터넷 없이 돌아간다.
미리 34MB 를 다 받지는 않고 **실제로 나온 문제의 음성·사진만** 그때그때 캐시한다.

노래 퀴즈는 애플 미리듣기를 스트리밍하므로 **항상 인터넷이 필요**하다 (캐시하지 않는다).

### 확인 방법

태블릿에서 한 번 실행해 롤 퀴즈를 몇 문제 풀어 본 뒤 → **비행기 모드** → 새로고침 →
그 문제들이 다시 나올 때 소리가 나면 캐시가 동작하는 것이다.

> 서비스워커는 개발용 미리보기 브라우저가 차단해서 **아직 실제 검증을 못 했다.**
> 등록에 실패해도 게임 자체는 정상 동작한다(온라인 기준).

## 파일

| 항목 | 설명 |
|---|---|
| `index.html` 외 정적 파일 | 게임 본체 (원본에서 복사됨) |
| `sw.js` | 서비스워커 (오프라인 캐시) |
| `manifest.webmanifest` | 홈 화면 추가 시 앱 이름·아이콘·전체화면 설정 |
| `.nojekyll` | GitHub Pages 의 Jekyll 처리 비활성화 |
| `robots.txt` | 검색엔진 색인 차단 |
| `tools/sync-game.mjs` | 원본 → 이 폴더 복사 |
