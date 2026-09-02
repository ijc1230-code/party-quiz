/* 축구 소속팀 퀴즈 — 거쳐 간 팀을 하나씩 보여 주고 선수를 맞힌다 */
(() => {
  const { $, $$, segment, Deck } = App;

  const state = { tier: 'famous', years: true, deck: null, cur: null, n: 0, shown: 0, revealed: false };

  // 한 팀에서만 뛴 선수(말디니·람)는 문제가 안 되니 뺀다
  const all = () => (Array.isArray(window.FOOTBALL) ? window.FOOTBALL : []).filter((p) => p.career.length >= 2);
  const pooled = () => (state.tier === 'all' ? all() : all().filter((p) => p.tier === 1));
  const clubOf = (title) => (window.CLUBS && window.CLUBS[title]) || { ko: title, short: '?', c1: '#4a4a5e', c2: '#2c2c3c' };

  // 배지 글자색: 팀 색이 밝으면 검정, 어두우면 흰색
  function inkOn(color) {
    let light = 0.4;
    const hex = color.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      const n = parseInt(hex[1], 16);
      light = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
    } else {
      const hsl = color.match(/hsl\(\s*[\d.]+\s+[\d.]+%\s+([\d.]+)%/i);
      if (hsl) light = Number(hsl[1]) / 100;
    }
    return light > 0.62 ? '#14141c' : '#ffffff';
  }

  function yearText(c) {
    if (!c.from) return '';
    if (c.to === null) return c.from + '–';
    return c.from === c.to ? String(c.from) : c.from + '–' + c.to;
  }

  function clubCard(step, showYear) {
    const info = clubOf(step.club);
    const el = document.createElement('div');
    el.className = 'career-club';
    el.innerHTML = '<span class="badge"></span><span class="cname"></span><span class="cyear"></span>';

    const badge = $('.badge', el);
    badge.textContent = info.short;
    badge.style.background = info.c1;
    badge.style.borderColor = info.c2;
    badge.style.color = inkOn(info.c1);

    $('.cname', el).textContent = info.ko;
    $('.cyear', el).textContent = showYear ? yearText(step) : '';
    return el;
  }

  function renderChain() {
    const box = $('#career-chain');
    box.innerHTML = '';
    const career = state.cur.career;

    career.slice(0, state.shown).forEach((step, i) => {
      if (i) {
        const arrow = document.createElement('div');
        arrow.className = 'career-arrow';
        arrow.textContent = '↓';
        box.appendChild(arrow);
      }
      const card = clubCard(step, state.years || state.revealed);
      if (i === state.shown - 1 && state.shown > 1) card.classList.add('fresh');
      box.appendChild(card);
    });

    // 아직 안 나온 팀은 자리만 비워 둔다 (몇 팀 더 남았는지는 보여 준다)
    const left = career.length - state.shown;
    if (left > 0) {
      const rest = document.createElement('div');
      rest.className = 'career-rest';
      rest.textContent = '남은 팀 ' + left + '개';
      box.appendChild(rest);
    }

    $('#career-progress').textContent = state.n + '번째 문제 · 공개 '
      + state.shown + '/' + career.length + '팀 · 남은 선수 ' + state.deck.left + '명';
    $('#career-more').hidden = state.revealed || left <= 0;
    $('#career-more').textContent = '팀 하나 더 (' + left + ')';
  }

  function nextRound() {
    state.cur = state.deck.draw();
    state.n++;
    state.shown = 1;
    state.revealed = false;

    $('#career-answer').hidden = true;
    $('#career-reveal').hidden = false;
    $('#career-next').hidden = true;
    renderChain();
  }

  function showMore() {
    if (state.revealed || state.shown >= state.cur.career.length) return;
    state.shown++;
    renderChain();
  }

  function reveal() {
    if (state.revealed) return;
    state.revealed = true;
    state.shown = state.cur.career.length;   // 정답과 함께 커리어 전체를 편다
    renderChain();

    $('#career-img').src = state.cur.img;
    $('#career-name').textContent = state.cur.ko;
    $('#career-desc').textContent = state.cur.desc;
    $('#career-answer').hidden = false;
    $('#career-reveal').hidden = true;
    $('#career-next').hidden = false;
  }

  function updateCount() {
    const n = pooled().length;
    $('#career-count').textContent = n
      ? ('이 설정이면 ' + n + '명 중에서 나옵니다.')
      : '축구 데이터가 없습니다. tools/build-football.mjs 를 실행해 주세요.';
    $('#career-start').disabled = !n;
  }

  segment($('#career-tier'), (v) => { state.tier = v; updateCount(); });
  segment($('#career-years'), (v) => { state.years = v === 'on'; if (state.cur) renderChain(); });

  $('#career-start').addEventListener('click', () => {
    state.deck = new Deck(pooled());
    state.n = 0;
    App.showPhase('career', 'play');
    nextRound();
  });

  $('#career-more').addEventListener('click', showMore);
  $('#career-reveal').addEventListener('click', reveal);
  $('#career-next').addEventListener('click', nextRound);

  App.register('career', {
    title: '축구 소속팀 맞추기',
    pool: () => all().length,
    enter: updateCount,
    key(action) {
      if (!state.cur) return;                 // 아직 시작 전
      // 스페이스: 팀을 하나씩 더 → 다 나오면 정답 → 그다음은 다음 문제
      if (action === 'space') {
        if (state.revealed) nextRound();
        else if (state.shown < state.cur.career.length) showMore();
        else reveal();
        return;
      }
      if (action === 'next') { state.revealed ? nextRound() : reveal(); }
    },
  });
})();
