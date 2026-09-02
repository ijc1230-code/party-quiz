/* 파티 퀴즈 — 공용 셸: 화면 전환, 팀 점수판, 단축키 */
const App = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const TEAM_KEY = 'partyquiz.teams';
  const games = {};
  let current = 'home';
  let teams = loadTeams();

  /* ------------------------------------------------------------- 유틸 */
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 한 세션에서 같은 문제가 다시 나오지 않게 해 주는 뽑기 통
  class Deck {
    constructor(items) { this.items = items; this.reset(); }
    reset() { this.pool = shuffle(this.items); this.drawn = 0; }
    draw() {
      if (!this.pool.length) this.reset();   // 다 쓰면 다시 섞어서 순환
      this.drawn++;
      return this.pool.pop();
    }
    get left() { return this.pool.length; }
  }

  let toastTimer = null;
  function toast(msg, ms = 2200) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  // .seg / .chips 안의 버튼을 토글 그룹으로 만든다
  function segment(root, onChange, { multi = false } = {}) {
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (multi) {
        btn.classList.toggle('on');
        if (!$$('button.on', root).length) btn.classList.add('on'); // 최소 1개 유지
        onChange($$('button.on', root).map((b) => b.dataset.v));
      } else {
        $$('button', root).forEach((b) => b.classList.toggle('on', b === btn));
        onChange(btn.dataset.v);
      }
    });
  }

  const segValue = (root) => $('button.on', root)?.dataset.v;

  /* --------------------------------------------------------- 팀 점수판 */
  function loadTeams() {
    try {
      const saved = JSON.parse(localStorage.getItem(TEAM_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch { /* 저장값이 깨졌으면 기본값으로 */ }
    return [{ name: 'A팀', score: 0 }, { name: 'B팀', score: 0 }];
  }

  function saveTeams() {
    try { localStorage.setItem(TEAM_KEY, JSON.stringify(teams)); } catch { /* 사생활 보호 모드 등 */ }
  }

  function addPoint(i, delta) {
    if (!teams[i]) return;
    teams[i].score += delta;
    saveTeams();
    renderScoreboard();
    const card = $$('#scoreboard .team')[i];
    if (card && delta > 0) {
      card.classList.remove('flash');
      void card.offsetWidth;            // 애니메이션 재시작
      card.classList.add('flash');
    }
  }

  function renderScoreboard() {
    const box = $('#scoreboard');
    box.innerHTML = '';
    teams.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'team';
      el.innerHTML = '<div class="name"></div><div class="score"></div>'
        + '<div class="btns"><button class="minus">−</button><button class="plus">+1</button></div>';
      $('.name', el).textContent = t.name;
      $('.score', el).textContent = t.score;
      $('.plus', el).addEventListener('click', () => addPoint(i, 1));
      $('.minus', el).addEventListener('click', () => addPoint(i, -1));
      box.appendChild(el);
    });
  }

  function renderTeamEditor() {
    const box = $('#team-editor');
    box.innerHTML = '';
    teams.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'te-row';
      row.innerHTML = '<input type="text" maxlength="12"><button class="te-del">✕</button>';
      const input = $('input', row);
      input.value = t.name;
      input.addEventListener('input', () => {
        teams[i].name = input.value || ('팀 ' + (i + 1));
        saveTeams();
        renderScoreboard();
      });
      $('.te-del', row).addEventListener('click', () => {
        if (teams.length <= 1) { toast('팀은 최소 하나 있어야 해요'); return; }
        teams.splice(i, 1);
        saveTeams();
        renderTeamEditor();
        renderScoreboard();
      });
      box.appendChild(row);
    });
  }

  /* --------------------------------------------------------- 화면 전환 */
  function register(name, def) { games[name] = def; }

  function go(name) {
    if (current !== name && games[current]?.leave) games[current].leave();
    current = name;

    $$('.screen').forEach((s) => { s.hidden = s.dataset.screen !== name; });
    $('#btn-home').hidden = name === 'home';
    $('#screen-title').textContent = name === 'home' ? '파티 퀴즈' : (games[name]?.title || '파티 퀴즈');
    $('#main').scrollTop = 0;

    if (name !== 'home') showPhase(name, 'setup');
    games[name]?.enter?.();
  }

  // 각 게임 화면은 setup / play 두 단계를 가진다
  function showPhase(screen, phase) {
    const root = $('.screen[data-screen="' + screen + '"]');
    $$('[data-phase]', root).forEach((el) => { el.hidden = el.dataset.phase !== phase; });
  }

  /* ----------------------------------------------------------- 단축키 */
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT') return;

    if (e.key >= '1' && e.key <= '9') {
      const i = Number(e.key) - 1;
      if (teams[i]) { addPoint(i, 1); e.preventDefault(); }
      return;
    }
    if (e.key === 'Escape') { go('home'); return; }

    const g = games[current];
    if (!g?.key) return;
    if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); g.key('space'); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); g.key('next'); }
  }

  /* ------------------------------------------------------------- 시작 */
  function boot() {
    renderScoreboard();
    renderTeamEditor();

    $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
    $('#btn-home').addEventListener('click', () => go('home'));

    $('#team-add').addEventListener('click', () => {
      if (teams.length >= 6) { toast('팀은 6개까지만 만들 수 있어요'); return; }
      teams.push({ name: '팀 ' + (teams.length + 1), score: 0 });
      saveTeams();
      renderTeamEditor();
      renderScoreboard();
    });

    $('#team-reset').addEventListener('click', () => {
      teams.forEach((t) => { t.score = 0; });
      saveTeams();
      renderScoreboard();
      toast('점수를 초기화했어요');
    });

    $('#btn-full').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.().catch(() => toast('전체화면을 쓸 수 없는 브라우저예요'));
    });

    document.addEventListener('keydown', onKeyDown);

    // 홈 카드에 보유 문제 수 표시 (데이터가 없으면 비활성)
    // 게임이 pool() 을 알려 주면 그걸 쓴다 — 인물 퀴즈처럼 데이터를 여럿 합쳐 쓰는 경우가 있다
    const counts = [
      ['#home-lol-n', '.game-card.lol', 'lol', window.CHAMPIONS, '챔피언'],
      ['#home-song-n', '.game-card.song', 'song', window.SONGS, '곡'],
      ['#home-person-n', '.game-card.person', 'person', window.PEOPLE, '명'],
      ['#home-flag-n', '.game-card.flag', 'flag', window.FLAGS, '개국'],
      ['#home-career-n', '.game-card.career', 'career', window.FOOTBALL, '명'],
    ];
    for (const [nSel, cardSel, name, data, unit] of counts) {
      const n = games[name]?.pool ? games[name].pool() : (Array.isArray(data) ? data.length : 0);
      $(nSel).textContent = n ? (n + unit) : '데이터 없음 — tools/build-data.mjs 실행 필요';
      if (!n) $(cardSel).classList.add('off');
    }

    go('home');
  }

  return { boot, go, register, showPhase, segment, segValue, shuffle, Deck, toast, addPoint, $, $$ };
})();
