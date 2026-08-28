/* 노래 맞추기 — Apple 미리듣기(30초 m4a)를 지정한 초만 재생 */
(() => {
  const { $, segment, Deck, toast } = App;

  const state = {
    decade: 'all',
    durSec: 5,
    deck: null,
    cur: null,
    n: 0,
    revealed: false,
    playing: false,
    extra: 0,        // "+5초 더" 로 늘어난 시간
    retried: false,  // 재생 실패 시 URL 재조회를 한 번만 시도
  };

  let audio = null;
  let stopTimer = null;

  const all = () => (Array.isArray(window.SONGS) ? window.SONGS : []);
  const pooled = () => (state.decade === 'all' ? all() : all().filter((s) => s.decade === state.decade));

  /* ------------------------------------------------------------- 재생 UI */
  function setPlayingUI(on) {
    state.playing = on;
    $('#song-cover').classList.toggle('playing-anim', on);
    $('#song-play').classList.toggle('playing', on);
    $('#song-state').textContent = on ? '재생 중' : (state.revealed ? '정답 공개됨' : '준비됨');
    $('#song-play-label').textContent = on ? '재생 중...' : (state.n && !state.revealed ? '다시 듣기' : '노래 듣기');
  }

  function clearStopTimer() { clearTimeout(stopTimer); stopTimer = null; }

  function stopAll() {
    clearStopTimer();
    if (audio) { audio.pause(); audio = null; }
    setPlayingUI(false);
  }

  /* --------------------------------------------------------------- 재생 */
  // seconds 가 없으면 끝까지 (정답 공개 후 "이어 듣기")
  function play(seconds) {
    stopAll();
    const song = state.cur;
    if (!song) return;

    audio = new Audio(song.previewUrl);
    audio.addEventListener('ended', () => setPlayingUI(false));
    audio.addEventListener('error', onPlayFail);

    audio.play().then(() => {
      setPlayingUI(true);
      if (seconds) {
        stopTimer = setTimeout(() => {
          if (audio) audio.pause();
          setPlayingUI(false);
        }, seconds * 1000);
      }
    }).catch(onPlayFail);
  }

  // 미리듣기 주소는 가끔 만료된다. trackId 로 한 번 다시 받아 보고,
  // 그래도 안 되면 그 곡은 건너뛴다.
  async function onPlayFail() {
    if (state.retried || !state.cur?.trackId) {
      toast('이 곡은 재생할 수 없어서 넘어갑니다: ' + state.cur.artist + ' - ' + state.cur.title);
      nextRound();
      return;
    }
    state.retried = true;
    $('#song-state').textContent = '주소 다시 받는 중...';
    try {
      const res = await fetch('https://itunes.apple.com/lookup?id=' + state.cur.trackId);
      const url = (await res.json())?.results?.[0]?.previewUrl;
      if (!url) throw new Error('no preview');
      state.cur.previewUrl = url;
      play(state.durSec + state.extra);
    } catch {
      toast('이 곡은 재생할 수 없어서 넘어갑니다: ' + state.cur.artist + ' - ' + state.cur.title);
      nextRound();
    }
  }

  /* ------------------------------------------------------------- 라운드 */
  function nextRound() {
    stopAll();
    state.cur = state.deck.draw();
    state.extra = 0;
    state.retried = false;
    state.n++;
    state.revealed = false;

    $('#song-progress').textContent = state.n + '번째 문제 · 남은 곡 ' + state.deck.left + '곡';
    $('#song-answer').hidden = true;
    $('#song-reveal').hidden = false;
    $('#song-more').hidden = false;
    $('#song-listen').hidden = true;
    $('#song-next').hidden = true;
    $('#song-play-label').textContent = '노래 듣기';
    $('#song-state').textContent = '준비됨';
  }

  function reveal() {
    if (state.revealed) return;
    state.revealed = true;
    stopAll();

    const s = state.cur;
    const art = $('#song-art');
    if (s.artwork) { art.src = s.artwork; art.hidden = false; } else { art.hidden = true; }
    $('#song-title').textContent = s.title;
    $('#song-artist').textContent = s.artist + ' · ' + s.year + '년';
    $('#song-answer').hidden = false;
    $('#song-reveal').hidden = true;
    $('#song-more').hidden = true;
    $('#song-listen').hidden = false;
    $('#song-next').hidden = false;
    $('#song-state').textContent = '정답 공개됨';
  }

  /* --------------------------------------------------------------- 배선 */
  function updateCount() {
    const n = pooled().length;
    $('#song-count').textContent = n
      ? ('이 설정이면 ' + n + '곡 중에서 나옵니다.')
      : '노래 데이터가 없습니다. tools/build-data.mjs itunes 를 실행해 주세요.';
    $('#song-start').disabled = !n;
    $('#song-net').hidden = navigator.onLine;
  }

  segment($('#song-decade'), (v) => { state.decade = v; updateCount(); });
  segment($('#song-dur'), (v) => { state.durSec = Number(v); });

  $('#song-start').addEventListener('click', () => {
    state.deck = new Deck(pooled());
    state.n = 0;
    App.showPhase('song', 'play');
    nextRound();
  });

  $('#song-play').addEventListener('click', () => {
    if (state.playing) { stopAll(); return; }
    play(state.durSec + state.extra);
  });

  $('#song-more').addEventListener('click', () => {
    state.extra += 5;
    play(state.durSec + state.extra);
    toast('총 ' + (state.durSec + state.extra) + '초까지 들려줍니다');
  });

  $('#song-listen').addEventListener('click', () => play());   // 끝까지

  $('#song-reveal').addEventListener('click', reveal);
  $('#song-next').addEventListener('click', nextRound);

  App.register('song', {
    title: '노래 맞추기',
    enter: updateCount,
    leave: stopAll,
    key(action) {
      if (action === 'next') { state.revealed ? nextRound() : reveal(); return; }
      if (action === 'space') {
        if (state.revealed) nextRound();
        else if (state.playing) reveal();
        else play(state.durSec + state.extra);
      }
    },
  });
})();
