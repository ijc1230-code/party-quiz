/* 축구 소속팀 퀴즈 — 거쳐 간 팀 로고를 순서대로 한 번에 보여 주고 선수를 맞힌다 */
(() => {
  const { $, $$, segment, Deck } = App;

  const state = { tier: 'famous', names: false, years: true, deck: null, cur: null, n: 0, revealed: false };

  // 한 팀에서만 뛴 선수(말디니·람)는 문제가 안 되니 뺀다
  const all = () => (Array.isArray(window.FOOTBALL) ? window.FOOTBALL : []).filter((p) => p.career.length >= 2);
  const pooled = () => (state.tier === 'all' ? all() : all().filter((p) => p.tier === 1));
  const clubOf = (title) => (window.CLUBS && window.CLUBS[title]) || { ko: title, short: '?', c1: '#4a4a5e', c2: '#2c2c3c' };

  function lightness(color) {
    const hex = color.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      const n = parseInt(hex[1], 16);
      return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
    }
    const hsl = color.match(/hsl\(\s*[\d.]+\s+[\d.]+%\s+([\d.]+)%/i);
    return hsl ? Number(hsl[1]) / 100 : 0.4;
  }

  // 로고를 못 구한 팀은 흰 판에 팀 색 글자로 — 흰 판 위라 둘 중 어두운 색을 쓴다
  function inkOnWhite(info) {
    const dark = lightness(info.c1) <= lightness(info.c2) ? info.c1 : info.c2;
    return lightness(dark) > 0.7 ? '#3a3a4a' : dark;
  }

  function yearText(step) {
    if (!step.from) return '';
    if (step.to === null) return step.from + '–';
    return step.from === step.to ? String(step.from) : step.from + '–' + step.to;
  }

  function clubTile(step, order) {
    const info = clubOf(step.club);
    const showName = state.names || state.revealed;

    const el = document.createElement('div');
    el.className = 'club-tile';
    el.innerHTML = '<span class="order"></span><div class="crest"></div>'
      + '<div class="cname"></div><div class="cyear"></div>';

    $('.order', el).textContent = order;

    const crest = $('.crest', el);
    if (info.logo) {
      const img = document.createElement('img');
      img.src = info.logo;
      img.alt = showName ? info.ko : '';
      crest.appendChild(img);
    } else {
      // 로고가 없는 팀(영문 위키 문서가 없는 옛 팀)은 이니셜로 대신한다
      crest.classList.add('nologo');
      crest.textContent = info.short;
      crest.style.color = inkOnWhite(info);
    }

    $('.cname', el).textContent = showName ? info.ko : '';
    $('.cyear', el).textContent = state.years ? yearText(step) : '';
    return el;
  }

  function render() {
    const box = $('#career-chain');
    box.innerHTML = '';
    state.cur.career.forEach((step, i) => box.appendChild(clubTile(step, i + 1)));

    $('#career-progress').textContent = state.n + '번째 문제 · 거쳐 간 팀 '
      + state.cur.career.length + '개 · 남은 선수 ' + state.deck.left + '명';
  }

  function nextRound() {
    state.cur = state.deck.draw();
    state.n++;
    state.revealed = false;

    $('#career-answer').hidden = true;
    $('#career-reveal').hidden = false;
    $('#career-next').hidden = true;
    render();
  }

  function reveal() {
    if (state.revealed) return;
    state.revealed = true;
    render();                                   // 팀 이름을 같이 펼친다

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
  segment($('#career-names'), (v) => { state.names = v === 'on'; if (state.cur) render(); });
  segment($('#career-years'), (v) => { state.years = v === 'on'; if (state.cur) render(); });

  $('#career-start').addEventListener('click', () => {
    state.deck = new Deck(pooled());
    state.n = 0;
    App.showPhase('career', 'play');
    nextRound();
  });

  $('#career-reveal').addEventListener('click', reveal);
  $('#career-next').addEventListener('click', nextRound);

  App.register('career', {
    title: '축구 소속팀 맞추기',
    pool: () => all().length,
    enter: updateCount,
    key(action) {
      if (!state.cur) return;                   // 아직 시작 전
      if (action === 'next' || action === 'space') { state.revealed ? nextRound() : reveal(); }
    },
  });
})();
