/* 인물 사진 퀴즈 — 사진 보고 맞춘 뒤 이름 공개 */
(() => {
  const { $, $$, Deck, segment } = App;

  const state = { cats: [], deck: null, cur: null, n: 0, revealed: false };

  // 축구 선수는 축구 퀴즈와 명단을 함께 쓴다 (data/football.js)
  const people = () => (Array.isArray(window.PEOPLE) ? window.PEOPLE : []);
  const footballers = () => (Array.isArray(window.FOOTBALL) ? window.FOOTBALL : [])
    .filter((f) => !people().some((p) => p.name === f.ko))   // 손흥민·박지성처럼 겹치면 기존 것을 쓴다
    .map((f) => ({ name: f.ko, desc: f.desc, category: '축구선수', img: f.img }));

  const all = () => [...people(), ...footballers()];
  const categories = () => [...new Set(all().map((p) => p.category))];
  const pooled = () => (state.cats.includes('전체') || !state.cats.length
    ? all()
    : all().filter((p) => state.cats.includes(p.category)));

  function buildCatChips() {
    const box = $('#person-cats');
    if (box.dataset.built) return;
    box.dataset.built = '1';

    const cats = ['전체', ...categories()];
    cats.forEach((c, i) => {
      const b = document.createElement('button');
      b.dataset.v = c;
      b.textContent = c;
      if (i === 0) b.classList.add('on');
      box.appendChild(b);
    });
    state.cats = ['전체'];

    segment(box, (values) => {
      // "전체" 와 개별 분야는 같이 켜지지 않게 정리
      const last = values[values.length - 1];
      if (last === '전체' || !values.length) {
        $$('button', box).forEach((b) => b.classList.toggle('on', b.dataset.v === '전체'));
        state.cats = ['전체'];
      } else {
        $('button[data-v="전체"]', box).classList.remove('on');
        state.cats = $$('button.on', box).map((b) => b.dataset.v);
      }
      updateCount();
    }, { multi: true });
  }

  function nextRound() {
    state.cur = state.deck.draw();
    state.n++;
    state.revealed = false;

    $('#person-progress').textContent = state.n + '번째 문제 · 남은 인물 ' + state.deck.left + '명';
    $('#person-img').src = state.cur.img;
    $('#person-img').alt = '누구일까요?';
    $('#person-answer').hidden = true;
    $('#person-reveal').hidden = false;
    $('#person-hint').hidden = false;
    $('#person-next').hidden = true;
  }

  function reveal() {
    if (state.revealed) return;
    state.revealed = true;
    $('#person-name').textContent = state.cur.name;
    $('#person-desc').textContent = state.cur.desc;
    $('#person-answer').hidden = false;
    $('#person-reveal').hidden = true;
    $('#person-hint').hidden = true;
    $('#person-next').hidden = false;
  }

  function updateCount() {
    const n = pooled().length;
    $('#person-count').textContent = n
      ? ('이 설정이면 ' + n + '명 중에서 나옵니다.')
      : '인물 데이터가 없습니다. tools/build-data.mjs people 을 실행해 주세요.';
    $('#person-start').disabled = !n;
  }

  $('#person-start').addEventListener('click', () => {
    state.deck = new Deck(pooled());
    state.n = 0;
    App.showPhase('person', 'play');
    nextRound();
  });

  $('#person-hint').addEventListener('click', () => {
    App.toast('힌트: ' + state.cur.category + ' · ' + state.cur.desc.split('·')[0].trim());
  });

  $('#person-reveal').addEventListener('click', reveal);
  $('#person-next').addEventListener('click', nextRound);

  App.register('person', {
    title: '인물 사진 퀴즈',
    pool: () => all().length,
    enter() { buildCatChips(); updateCount(); },
    key(action) {
      if (action === 'next') { state.revealed ? nextRound() : reveal(); return; }
      if (action === 'space') { state.revealed ? nextRound() : reveal(); }
    },
  });
})();
