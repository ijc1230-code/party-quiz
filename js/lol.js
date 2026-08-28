/* 롤 챔피언 픽 소리 맞추기 */
(() => {
  const { $, $$, segment, segValue, shuffle, Deck, toast } = App;

  // 다 같이 놀 때 "아는 챔피언"만 나오게 하는 기본 풀
  const POPULAR = new Set([
    'Aatrox', 'Ahri', 'Akali', 'Alistar', 'Amumu', 'Annie', 'Ashe', 'Blitzcrank', 'Braum',
    'Caitlyn', 'Camille', 'Darius', 'Diana', 'Draven', 'Ekko', 'Evelynn', 'Ezreal', 'Fiora',
    'Fizz', 'Garen', 'Gragas', 'Graves', 'Gwen', 'Irelia', 'Janna', 'JarvanIV', 'Jax', 'Jhin',
    'Jinx', 'Kaisa', 'Karthus', 'Katarina', 'Kayn', 'Khazix', 'Kindred', 'LeeSin', 'Leona',
    'Lucian', 'Lulu', 'Lux', 'Malphite', 'MasterYi', 'MissFortune', 'Mordekaiser', 'Morgana',
    'Nami', 'Nasus', 'Nautilus', 'Neeko', 'Olaf', 'Orianna', 'Poppy', 'Pyke', 'Rakan', 'Rammus',
    'Rengar', 'Renekton', 'Riven', 'Ryze', 'Samira', 'Senna', 'Seraphine', 'Sett', 'Shaco',
    'Shen', 'Singed', 'Sona', 'Soraka', 'Sylas', 'Syndra', 'Talon', 'Teemo', 'Thresh',
    'Tristana', 'TwistedFate', 'Vayne', 'Veigar', 'Vi', 'Viego', 'Viktor', 'Volibear',
    'Warwick', 'Xayah', 'Yasuo', 'Yone', 'Yorick', 'Yuumi', 'Zed', 'Ziggs', 'Zoe',
  ]);

  const state = { mode: 'open', pool: 'popular', deck: null, cur: null, n: 0, revealed: false };
  let audio = null;

  const all = () => (Array.isArray(window.CHAMPIONS) ? window.CHAMPIONS : []);
  const pooled = () => (state.pool === 'all' ? all() : all().filter((c) => POPULAR.has(c.en)));

  /* ------------------------------------------------------------ 오디오 */
  function stopAudio() {
    if (!audio) return;
    audio.pause();
    audio = null;
    $('#lol-play').classList.remove('playing');
  }

  function playChampion(champ) {
    stopAudio();
    const btn = $('#lol-play');
    btn.classList.add('playing');
    $('#lol-play-label').textContent = '재생 중...';

    // 받아 둔 로컬 파일 우선, 없으면 라이엇 CDN 으로 폴백
    let usedFallback = false;
    const start = (src) => {
      audio = new Audio(src);
      audio.addEventListener('ended', () => {
        btn.classList.remove('playing');
        $('#lol-play-label').textContent = '다시 듣기';
      });
      audio.addEventListener('error', onFail);
      audio.play().catch(onFail);
    };
    const onFail = () => {
      if (usedFallback) {
        btn.classList.remove('playing');
        $('#lol-play-label').textContent = '재생 실패 — 다시 시도';
        toast('픽 음성을 재생하지 못했어요');
        return;
      }
      usedFallback = true;
      start(champ.voUrl);
    };
    start('audio/lol/' + champ.key + '.ogg');
  }

  /* ------------------------------------------------------------- 라운드 */
  function nextRound() {
    stopAudio();
    state.cur = state.deck.draw();
    state.n++;
    state.revealed = false;

    $('#lol-progress').textContent = state.n + '번째 문제 · 남은 챔피언 ' + state.deck.left + '명';
    $('#lol-play-label').textContent = '픽 소리 듣기';
    $('#lol-answer').hidden = true;
    $('#lol-reveal').hidden = false;
    $('#lol-next').hidden = true;

    const choices = $('#lol-choices');
    choices.hidden = state.mode !== 'choice';
    choices.innerHTML = '';

    if (state.mode === 'choice') {
      const wrong = shuffle(pooled().filter((c) => c.key !== state.cur.key)).slice(0, 3);
      shuffle([state.cur, ...wrong]).forEach((c) => {
        const b = document.createElement('button');
        b.textContent = c.ko;
        b.addEventListener('click', () => {
          if (state.revealed) return;
          b.classList.add(c.key === state.cur.key ? 'right' : 'wrong');
          if (c.key !== state.cur.key) return;
          reveal();
        });
        choices.appendChild(b);
      });
    }

    playChampion(state.cur);
  }

  function reveal() {
    if (state.revealed) return;
    state.revealed = true;
    stopAudio();

    const c = state.cur;
    const img = $('#lol-img');
    img.onerror = () => { img.onerror = null; img.src = c.tileUrl; };  // 로컬에 없으면 CDN
    img.src = 'img/champion/' + c.en + '.png';
    img.alt = c.ko;
    $('#lol-ko').textContent = c.ko;
    $('#lol-en').textContent = c.en + (c.title ? ' · ' + c.title : '');
    $('#lol-answer').hidden = false;
    $('#lol-reveal').hidden = true;
    $('#lol-next').hidden = false;

    $$('#lol-choices button').forEach((b) => {
      if (b.textContent === c.ko) b.classList.add('right');
    });
  }

  /* ------------------------------------------------------------- 배선 */
  function updateCount() {
    const n = pooled().length;
    $('#lol-count').textContent = n
      ? ('이 설정이면 ' + n + '명 중에서 나옵니다.')
      : '챔피언 데이터가 없습니다. tools/build-data.mjs champions 를 실행해 주세요.';
    $('#lol-start').disabled = !n;
  }

  segment($('#lol-mode'), (v) => { state.mode = v; });
  segment($('#lol-pool'), (v) => { state.pool = v; updateCount(); });

  $('#lol-start').addEventListener('click', () => {
    state.deck = new Deck(pooled());
    state.n = 0;
    App.showPhase('lol', 'play');
    nextRound();
  });

  $('#lol-play').addEventListener('click', () => playChampion(state.cur));
  $('#lol-reveal').addEventListener('click', reveal);
  $('#lol-next').addEventListener('click', nextRound);

  App.register('lol', {
    title: '롤 픽 소리 맞추기',
    enter: updateCount,
    leave: stopAudio,
    key(action) {
      if (action === 'next') { state.revealed ? nextRound() : reveal(); return; }
      if (action === 'space') {
        if (state.revealed) nextRound();
        else if ($('#lol-play').classList.contains('playing')) reveal();
        else playChampion(state.cur);
      }
    },
  });
})();
