/* 국기 보고 나라 맞추기 */
(() => {
  const { $, $$, segment, shuffle, Deck } = App;

  const state = { mode: 'open', tier: 'easy', deck: null, cur: null, n: 0, revealed: false };

  const all = () => (Array.isArray(window.FLAGS) ? window.FLAGS : []);
  const pooled = () => (state.tier === 'all' ? all() : all().filter((f) => f.tier === 1));

  function nextRound() {
    state.cur = state.deck.draw();
    state.n++;
    state.revealed = false;

    $('#flag-progress').textContent = state.n + '번째 문제 · 남은 나라 ' + state.deck.left + '개';
    $('#flag-img').src = state.cur.img;
    $('#flag-answer').hidden = true;
    $('#flag-reveal').hidden = false;
    $('#flag-next').hidden = true;

    const choices = $('#flag-choices');
    choices.hidden = state.mode !== 'choice';
    choices.innerHTML = '';

    if (state.mode === 'choice') {
      // 오답은 같은 대륙에서 먼저 고른다 (그래야 문제가 너무 쉬워지지 않는다)
      const sameRegion = pooled().filter((f) => f.code !== state.cur.code && f.region === state.cur.region);
      const others = pooled().filter((f) => f.code !== state.cur.code && f.region !== state.cur.region);
      const wrong = [...shuffle(sameRegion), ...shuffle(others)].slice(0, 3);

      shuffle([state.cur, ...wrong]).forEach((f) => {
        const b = document.createElement('button');
        b.textContent = f.ko;
        b.addEventListener('click', () => {
          if (state.revealed) return;
          b.classList.add(f.code === state.cur.code ? 'right' : 'wrong');
          if (f.code === state.cur.code) reveal();
        });
        choices.appendChild(b);
      });
    }
  }

  function reveal() {
    if (state.revealed) return;
    state.revealed = true;

    const f = state.cur;
    $('#flag-ko').textContent = f.ko;
    $('#flag-region').textContent = f.region;
    $('#flag-answer').hidden = false;
    $('#flag-reveal').hidden = true;
    $('#flag-next').hidden = false;

    $$('#flag-choices button').forEach((b) => {
      if (b.textContent === f.ko) b.classList.add('right');
    });
  }

  function updateCount() {
    const n = pooled().length;
    $('#flag-count').textContent = n
      ? ('이 설정이면 ' + n + '개국 중에서 나옵니다.')
      : '국기 데이터가 없습니다. tools/build-data.mjs flags 를 실행해 주세요.';
    $('#flag-start').disabled = !n;
  }

  segment($('#flag-mode'), (v) => { state.mode = v; });
  segment($('#flag-tier'), (v) => { state.tier = v; updateCount(); });

  $('#flag-start').addEventListener('click', () => {
    state.deck = new Deck(pooled());
    state.n = 0;
    App.showPhase('flag', 'play');
    nextRound();
  });

  $('#flag-reveal').addEventListener('click', reveal);
  $('#flag-next').addEventListener('click', nextRound);

  App.register('flag', {
    title: '국기 맞추기',
    enter: updateCount,
    key(action) {
      if (action === 'next') { state.revealed ? nextRound() : reveal(); return; }
      if (action === 'space') { state.revealed ? nextRound() : reveal(); }
    },
  });
})();
