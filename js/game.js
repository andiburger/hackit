/* HACKIT – Spiellogik & UI */
(() => {
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'hackit-save-v1';

  /* ---------------- UI-Texte ---------------- */
  const UI = {
    tagline: ['// Lerne zu denken wie ein Hacker.', '// Learn to think like a hacker.'],
    aliasLabel: ['Dein Hacker-Alias', 'Your hacker alias'],
    aliasPh: ['z.B. n30n', 'e.g. n30n'],
    connect: ['Verbindung herstellen ▶', 'Connect ▶'],
    continueAs: ['Weiter als {a} ▶', 'Continue as {a} ▶'],
    disclaimer: ['⚠ Alle Systeme in HACKIT sind simuliert. Greife im echten Leben nur Systeme an, für die du eine ausdrückliche Erlaubnis hast.',
      '⚠ All systems in HACKIT are simulated. In real life, only test systems you have explicit permission to test.'],
    points: ['Punkte', 'Points'], missions: ['Missionen', 'Missions'], stars: ['★ Sterne', '★ Stars'],
    reset: ['⟲ Reset', '⟲ Reset'], back: ['← Missionen', '← Missions'], restart: ['↺ Neustart', '↺ Restart'],
    saved: ['● gespeichert', '● saved'], possible: ['möglich', 'possible'],
    briefing: ['📡 Briefing', '📡 Briefing'], objectives: ['🎯 Ziele', '🎯 Objectives'], tools: ['🧰 Neue Werkzeuge', '🧰 New tools'],
    hints: ['💡 Tipps', '💡 Hints'], submitFlag: ['🚩 Flag einreichen', '🚩 Submit flag'], send: ['Senden', 'Send'],
    accessGranted: ['ZUGRIFF ERLANGT', 'ACCESS GRANTED'], toMap: ['Missionsübersicht', 'Mission overview'], nextMission: ['Nächste Mission ▶', 'Next mission ▶'],
    certBtn: ['🏆 Zertifikat', '🏆 Certificate'], certTitle: ['HACKIT ZERTIFIKAT', 'HACKIT CERTIFICATE'], close: ['Schließen', 'Close'],
    exportBtn: ['⬇ Export', '⬇ Export'], importBtn: ['⬆ Import', '⬆ Import'],
    cheatBtn: ['📖 Befehle', '📖 Commands'], cheatTitle: ['SPICKZETTEL', 'COMMAND CHEATSHEET'],
  };
  const t = (key, vars = {}) => {
    let s = tr(...UI[key]);
    for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', v);
    return s;
  };

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('.lang-switch').forEach(box => {
      box.innerHTML = I18N.supported.map(l => `<button data-lang="${l}" class="${l === I18N.lang ? 'on' : ''}">${l.toUpperCase()}</button>`).join('');
    });
    document.title = tr('HACKIT – Das Hacker-Lernspiel', 'HACKIT – The hacker learning game');
    updateStartButton();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.lang-switch button');
    if (b) I18N.set(b.dataset.lang);
  });

  /* ---------------- Speicherstand ---------------- */
  let save = load();
  function load() {
    let s;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { s = null; }
    s = s || {};
    s.alias ||= '';
    s.levels ||= {};
    s.sessions ||= {};
    s.daily ||= {};
    return s;
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
    catch (e) { // Speicher voll → Terminal-Verläufe kürzen
      Object.values(save.sessions).forEach(s => { s.lines = []; });
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { console.warn('Speichern fehlgeschlagen', e); }
    }
  }
  const lv = id => (id === 'daily'
    ? (save.daily[new Date().toISOString().slice(0, 10)] ||= { done: false, stars: 0, points: 0, hints: 0 })
    : (save.levels[id] ||= { done: false, stars: 0, points: 0, hints: 0 }));

  const maxPoints = () => LEVELS.list.length * 100;
  const totalPoints = () => Object.values(save.levels).reduce((a, l) => a + (l.points || 0), 0);
  const totalStars = () => Object.values(save.levels).reduce((a, l) => a + (l.stars || 0), 0);
  const doneCount = () => LEVELS.list.filter(l => lv(l.id).done).length;
  function rank() {
    const r = totalPoints() / maxPoints();
    const ranks = [
      [0, tr('Script Kiddie', 'Script Kiddie')], [0.08, tr('Neuling', 'Newbie')], [0.2, 'Hacker'], [0.35, 'Pentester'],
      [0.5, tr('Elite-Hacker', 'Elite Hacker')], [0.7, tr('Red-Team-Profi', 'Red Team Pro')], [0.85, tr('Legende', 'Legend')], [0.98, 'Ghost 👻'],
    ];
    return ranks.filter(([p]) => r >= p).pop()[1];
  }
  const isUnlocked = id => id === 1 || lv(id - 1).done;
  const potential = hints => Math.max(25, 100 - hints * 25);
  const starsFor = hints => Math.max(1, 3 - hints);

  /* ---------------- Sound (Web Audio API) ---------------- */
  let soundOn = localStorage.getItem('hackit-sound') === '1';
  let audioCtx = null;
  function beep(freq, dur = 0.08, type = 'sine', vol = 0.06) {
    if (!soundOn || typeof AudioContext === 'undefined') return;
    try {
      audioCtx = audioCtx || new AudioContext();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch {}
  }
  function updateSoundBtn() { const b = $('btn-sound'); if (b) b.textContent = soundOn ? '🔊' : '🔇'; }
  if ($('btn-sound')) $('btn-sound').addEventListener('click', () => {
    soundOn = !soundOn; localStorage.setItem('hackit-sound', soundOn ? '1' : '0'); updateSoundBtn(); beep(660, 0.06);
  });

  /* ---------------- Screens ---------------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
  }
  const currentScreen = () => (document.querySelector('.screen.active') || {}).id;

  /* ---------------- Matrix-Regen ---------------- */
  (function matrix() {
    const cv = $('matrix'), g = cv.getContext('2d');
    const chars = 'アカサタナハマヤラワ0123456789ABCDEF<>/{}$#'.split('');
    let cols, drops;
    const fs = 16;
    const resize = () => {
      cv.width = innerWidth; cv.height = innerHeight;
      cols = Math.ceil(cv.width / fs); drops = Array.from({ length: cols }, () => Math.random() * -50);
    };
    resize(); addEventListener('resize', resize);
    setInterval(() => {
      g.fillStyle = 'rgba(5,8,10,0.12)'; g.fillRect(0, 0, cv.width, cv.height);
      g.font = fs + 'px monospace';
      for (let i = 0; i < cols; i++) {
        const y = drops[i] * fs;
        g.fillStyle = Math.random() > 0.975 ? '#c9ffe9' : '#00ff9c';
        g.fillText(chars[Math.floor(Math.random() * chars.length)], i * fs, y);
        if (y > cv.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
    }, 55);
  })();

  /* ---------------- Start ---------------- */
  function updateStartButton() {
    const a = $('alias').value.trim();
    $('btn-start').textContent = save.alias && a === save.alias ? t('continueAs', { a: save.alias }) : t('connect');
  }

  async function boot() {
    const lines = [
      [tr('[ BOOT ] HACKIT OS v3.0 wird geladen', '[ BOOT ] Loading HACKIT OS v3.0'), 220],
      [tr('[  OK  ] Kernel-Module geladen', '[  OK  ] Kernel modules loaded'), 160],
      [tr('[  OK  ] Verschlüsselter Tunnel aufgebaut', '[  OK  ] Encrypted tunnel established'), 200],
      [tr(`[  OK  ] Trainingsnetzwerk simuliert (${LEVELS.list.length} Ziele)`, `[  OK  ] Training network simulated (${LEVELS.list.length} targets)`), 200],
      [tr('[ INFO ] Mentorin „Zero" ist online', '[ INFO ] Mentor "Zero" is online'), 250],
      ['', 0],
    ];
    const el = $('boot');
    el.innerHTML = '';
    for (const [l, d] of lines) {
      el.innerHTML += Terminal.esc(l).replace(/\[ {2}OK {2}\]/, '<span class="ok">[  OK  ]</span>') + '\n';
      await new Promise(r => setTimeout(r, d));
    }
    $('start-form').classList.remove('hidden');
    if (save.alias) $('alias').value = save.alias;
    updateStartButton();
    $('alias').focus();
  }
  $('alias').addEventListener('input', updateStartButton);
  $('alias').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-start').click(); });
  $('btn-start').addEventListener('click', () => {
    const a = $('alias').value.trim().replace(/[^\w\-.]/g, '') || 'anon';
    save.alias = a; persist();
    renderMap(); show('map');
  });

  /* ---------------- Missionsübersicht ---------------- */
  function renderMap() {
    $('p-alias').textContent = save.alias;
    $('p-rank').textContent = rank();
    $('p-points').textContent = totalPoints();
    $('p-done').textContent = `${doneCount()}/${LEVELS.list.length}`;
    $('p-stars').textContent = totalStars();
    $('p-progress').style.width = (doneCount() / LEVELS.list.length * 100) + '%';
    if ($('btn-cert')) $('btn-cert').classList.toggle('hidden', doneCount() < LEVELS.list.length);

    const map = $('map');
    map.innerHTML = '';

    // Laufende Session fortsetzen
    const active = save.active && save.sessions[save.active] && LEVELS.list.find(l => l.id === save.active);
    if (active) {
      const bar = document.createElement('div');
      bar.className = 'resume-bar';
      bar.innerHTML = `<span>⏸ ${tr('Laufende Session', 'Session in progress')}: <b>${String(active.id).padStart(2, '0')} · ${active.title}</b></span>
        <span class="c-d">${new Date(save.sessions[active.id].ts).toLocaleString(I18N.lang === 'en' ? 'en-GB' : 'de-DE')}</span>
        <button class="btn btn-small">${tr('Fortsetzen ▶', 'Resume ▶')}</button>`;
      bar.querySelector('button').addEventListener('click', () => startLevel(active.id));
      map.appendChild(bar);
    }

    // Daily Challenge Banner
    if (typeof dailyLevel === 'function') {
      const today = new Date().toISOString().slice(0, 10);
      const ds = save.daily[today];
      const dBar = document.createElement('div');
      dBar.className = 'daily-bar';
      dBar.innerHTML = `<span>🎲 <b>Daily Challenge (${today})</b> · ${ds && ds.done
        ? tr(`Gelöst in ${ds.bestSec || 0}s ★`, `Solved in ${ds.bestSec || 0}s ★`)
        : tr('Jeden Tag ein neues Zufalls-System!', 'A new procedural system every day!')}</span>
        <button class="btn btn-small">${ds && ds.done ? tr('Nochmal ▶', 'Replay ▶') : tr('Starten ▶', 'Play ▶')}</button>`;
      dBar.querySelector('button').addEventListener('click', () => startLevel('daily'));
      map.appendChild(dBar);
    }

    const firstOpen = LEVELS.list.find(l => isUnlocked(l.id) && !lv(l.id).done);
    LEVELS.chapters.forEach((ch, ci) => {
      const levels = LEVELS.list.filter(l => l.chapter === ci);
      if (!levels.length) return;
      const sec = document.createElement('section');
      sec.className = 'chapter' + (ci >= 4 ? ' expert' : '');
      sec.innerHTML = `<h2>${ch.title}</h2><p>${ch.desc}</p><div class="cards"></div>`;
      const cards = sec.querySelector('.cards');
      levels.forEach(l => {
        const s = lv(l.id);
        const open = isUnlocked(l.id);
        const running = !!save.sessions[l.id];
        const card = document.createElement('div');
        card.className = 'card' + (s.done ? ' done' : '') + (!open ? ' locked' : '') +
          (running && !s.done ? ' active-session' : firstOpen === l ? ' current' : '');
        const stars = [1, 2, 3].map(i => i <= s.stars ? '★' : '<span class="off">★</span>').join('');
        const badge = s.done ? tr('GEHACKT', 'HACKED') : running ? tr('LÄUFT', 'IN PROGRESS') : firstOpen === l ? tr('NEU', 'NEW') : '';
        card.innerHTML = `
          ${badge ? `<div class="badge">${badge}</div>` : ''}
          <div class="num">${String(l.id).padStart(2, '0')}</div>
          <div class="cat">${l.category}</div>
          <h4>${l.title}</h4>
          <div class="meta">
            <span class="diff">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= l.difficulty ? 'on' : ''}"></i>`).join('')}</span>
            <span class="st">${s.done ? `${s.bestSec ? `<small class="c-d">⏱${s.bestSec}s</small> ` : ''}${stars}` : open ? '' : tr('gesperrt', 'locked')}</span>
          </div>`;
        if (open) card.addEventListener('click', () => startLevel(l.id));
        cards.appendChild(card);
      });
      map.appendChild(sec);
    });
  }

  $('btn-reset').addEventListener('click', () => {
    if (confirm(tr('Gesamten Fortschritt (inkl. gespeicherter Sessions) wirklich löschen?', 'Really delete all progress (including saved sessions)?'))) {
      save = { alias: save.alias, levels: {}, sessions: {}, daily: {} }; persist(); renderMap();
    }
  });

  /* ---------------- Spiel ---------------- */
  const term = new Terminal({
    root: $('terminal'), out: $('term-out'), line: $('term-line'),
    prompt: $('term-prompt'), input: $('term-input'), title: $('term-title'),
  });

  let ctx = null, level = null, objectivesDone = [], msgQueue = [], errCount = 0, idleTimer = null, finished = false, writes = [], chmods = [], elapsedBase = 0, runStartedAt = 0, timerInt = null;

  const fmtTime = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `⏱ ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const currentElapsed = () => elapsedBase + (runStartedAt ? Date.now() - runStartedAt : 0);
  function startTimer() {
    clearInterval(timerInt);
    runStartedAt = Date.now();
    if ($('g-timer')) $('g-timer').textContent = fmtTime(currentElapsed());
    timerInt = setInterval(() => { if ($('g-timer')) $('g-timer').textContent = fmtTime(currentElapsed()); }, 1000);
  }
  function stopTimer() {
    elapsedBase = currentElapsed();
    runStartedAt = 0;
    clearInterval(timerInt);
  }

  function replaceAlias(node) {
    if (node.type === 'file' && typeof node.content === 'string') node.content = node.content.replace(/\{alias\}/g, save.alias);
    if (node.type === 'dir') Object.values(node.children).forEach(replaceAlias);
  }

  function unlockedFor(id) {
    if (id === 'daily') return Object.keys(Shell.cmds);
    const unlocked = [];
    LEVELS.list.filter(l => l.id <= id).forEach(l => l.commands.forEach(c => { if (!unlocked.includes(c)) unlocked.push(c); }));
    return unlocked;
  }

  function startLevel(id, { fresh = false } = {}) {
    level = id === 'daily' && typeof dailyLevel === 'function' ? dailyLevel() : LEVELS.list.find(l => l.id === id);
    const world = level.setup();
    Object.values(world.hosts).forEach(h => replaceAlias(h.fs));
    const startHost = world.hosts[world.start.ip];
    const u = world.start.user;
    const home = (startHost.users[u] && startHost.users[u].home) || ['home', u];

    ctx = {
      term, world, level, unlocked: unlockedFor(id),
      sessions: [{ host: startHost, user: u, home, cwd: home.slice() }],
      get sess() { return this.sessions[this.sessions.length - 1]; },
      emit: onEvent,
      updatePrompt,
      submit: submitFlag,
      showHint,
      showMission: () => missionText(),
    };
    objectivesDone = level.objectives.map(() => false);
    msgQueue = []; errCount = 0; finished = false; writes = []; chmods = []; elapsedBase = 0; runStartedAt = 0;
    if (fresh) delete save.sessions[id];
    const saved = save.sessions[id];

    renderSidebar();
    show('game');
    term.clear();
    term.history = [];
    term.hIndex = 0;

    if (saved) restoreSession(saved);
    updatePrompt();

    if (saved) {
      term.print(C('sys', tr(
        `» Session vom ${new Date(saved.ts).toLocaleString('de-DE')} wiederhergestellt. Neu beginnen mit „↺ Neustart".`,
        `» Session from ${new Date(saved.ts).toLocaleString('en-GB')} restored. Start over with "↺ Restart".`)), 'restored');
    } else {
      printBanner(startHost, u);
    }
    if (!level.isDaily) save.active = id;
    saveSession();
    startTimer();
    resetIdle();
    setTimeout(() => term.focus(), 50);
  }

  function printBanner(startHost, u) {
    const pad = s => s.padEnd(44);
    term.print([
      C('g', '╔══════════════════════════════════════════════╗'),
      C('g', '║ ') + C('w', pad(`HACKIT // MISSION ${String(level.id).padStart(2, '0')}`)) + C('g', ' ║'),
      C('g', '║ ') + C('c', pad(level.title.slice(0, 44))) + C('g', ' ║'),
      C('g', '╚══════════════════════════════════════════════╝'),
      '',
      `${C('d', tr('Verbunden mit', 'Connected to'))} ${C('w', startHost.name)} ${C('d', '(' + startHost.ip + ') ' + tr('als', 'as'))} ${C('w', u)}`,
      tr(`${C('d', 'Tippe')} ${C('g', 'help')} ${C('d', 'für alle Befehle,')} ${C('g', 'mission')} ${C('d', 'für den Auftrag und')} ${C('y', 'hint')} ${C('d', 'für einen Tipp.')}`,
        `${C('d', 'Type')} ${C('g', 'help')} ${C('d', 'for all commands,')} ${C('g', 'mission')} ${C('d', 'for your briefing and')} ${C('y', 'hint')} ${C('d', 'for a hint.')}`),
      '',
    ].join('\n'));
    if (level.id === 1) term.print(C('sys', tr('» Klick ins Terminal, tippe ls und drücke Enter.', '» Click into the terminal, type ls and press Enter.')) + '\n');
  }

  function renderSidebar() {
    $('g-num').textContent = level.isDaily ? '🎲' : String(level.id).padStart(2, '0');
    $('g-title').textContent = level.title;
    $('g-story').innerHTML = level.story;
    $('g-newcmds').innerHTML = level.newCommands.map(c =>
      `<div class="c"><code data-cmd="${c.cmd.replace(/"/g, '&quot;')}">${Terminal.esc(c.cmd)}</code><span>${c.desc}</span></div>`).join('');
    $('g-newcmds').querySelectorAll('code').forEach(el => el.addEventListener('click', () => {
      const cmd = el.dataset.cmd;
      if (/^[a-z.\/]/.test(cmd) && !cmd.includes('|')) { term.input.value = cmd.replace(/\s+[A-ZÄÖÜ]{2,}.*$/, ' '); term.focus(); }
    }));
    $('flag-input').value = '';
    renderObjectives();
    renderHints();
  }

  /* ---------------- Sessions speichern ---------------- */
  function saveSession() {
    if (!ctx || !level || level.isDaily) return;
    if (finished) { delete save.sessions[level.id]; if (save.active === level.id) save.active = null; persist(); return; }
    const nodes = [...term.out.children].slice(-300);
    const lines = nodes.map(n => n.textContent);
    save.sessions[level.id] = {
      ts: Date.now(),
      objectives: objectivesDone.slice(),
      history: term.history.slice(-100),
      lines,
      stack: ctx.sessions.map(s => ({ ip: s.host.ip, user: s.user, cwd: s.cwd, home: s.home, env: s.env ? { ...s.env } : null })),
      writes,
      chmods,
      elapsedMs: currentElapsed(),
      errCount,
    };
    save.active = level.id;
    persist();
    const ind = $('save-indicator');
    ind.classList.add('show');
    clearTimeout(ind._t);
    ind._t = setTimeout(() => ind.classList.remove('show'), 1200);
  }

  function restoreSession(s) {
    // Dateiänderungen (z.B. durch > und >>) erneut anwenden
    for (const w of s.writes || []) {
      const h = ctx.world.hosts[w.ip];
      if (!h) continue;
      const parts = w.path.split('/').filter(Boolean);
      const name = parts.pop();
      const dir = VFS.get(h.fs, parts);
      if (!dir || dir.type !== 'dir') continue;
      const existing = dir.children[name];
      if (existing && existing.type === 'file') existing.content = w.content;
      else if (!existing) dir.children[name] = VFS.F(w.content, { owner: w.owner });
    }
    writes = (s.writes || []).slice();
    // chmod +x/-x Änderungen wiederherstellen
    for (const ch of s.chmods || []) {
      const h = ctx.world.hosts[ch.ip];
      const nd = h && VFS.get(h.fs, ch.path.split('/').filter(Boolean));
      if (nd) nd.exec = !!ch.exec;
    }
    chmods = (s.chmods || []).slice();
    // Sitzungs-Stapel (ssh/su) inkl. env wiederherstellen
    const stack = (s.stack || []).map(x => {
      const h = ctx.world.hosts[x.ip];
      if (!h) return null;
      const sess = { host: h, user: x.user, cwd: x.cwd, home: x.home };
      if (x.env) sess.env = Object.assign(Object.create(null), x.env);
      return sess;
    }).filter(Boolean);
    if (stack.length) ctx.sessions = stack;
    if (Array.isArray(s.objectives) && s.objectives.length === objectivesDone.length) objectivesDone = s.objectives.slice();
    elapsedBase = s.elapsedMs || 0;
    errCount = s.errCount || 0;
    term.history = (s.history || []).slice();
    term.hIndex = term.history.length;
    term.clear();
    if (Array.isArray(s.lines)) s.lines.forEach(l => term.print(l));
    renderObjectives();
  }

  function leaveGame() {
    stopTimer();
    saveSession();
    clearTimeout(idleTimer);
    renderMap();
    show('map');
  }

  window.addEventListener('beforeunload', () => { if (currentScreen() === 'screen-game') saveSession(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && currentScreen() === 'screen-game') saveSession(); });

  /* ---------------- Terminal ---------------- */
  function missionText() {
    const tmp = document.createElement('div');
    tmp.innerHTML = level.story;
    const text = [...tmp.querySelectorAll('p')].map(p => p.textContent.trim()).join('\n\n') || tmp.textContent.trim();
    const objs = level.objectives.map((o, i) => `  ${objectivesDone[i] ? C('g', '[✓]') : C('d', '[ ]')} ${o.text}`).join('\n');
    return `${C('w', tr('AUFTRAG: ', 'MISSION: ') + level.title)}\n\n${text}\n\n${C('c', tr('Ziele:', 'Objectives:'))}\n${objs}`;
  }

  function updatePrompt() {
    const s = ctx.sess;
    const root = s.user === 'root';
    const path = VFS.displayPath(s);
    term.setPrompt(`${C(root ? 'r' : 'g', `${s.user}@${s.host.name}`)}:${C('b', path)}${root ? '# ' : '$ '}`, `${s.user}@${s.host.name}: ${path}`);
  }

  term.onCommand = async line => {
    if (!ctx) return;
    term.setBusy(true);
    try { await Shell.execute(ctx, line); }
    finally {
      flushMessages();
      term.setBusy(false);
      saveSession();
    }
  };
  term.onComplete = value => ctx && Shell.complete(ctx, value);

  /* ---------------- Ziele & Ereignisse ---------------- */
  function onEvent(e) {
    if (!level || finished) return;
    if (e.type === 'write' && e.node) {
      const h = Object.values(ctx.world.hosts).find(x => x.name === e.host) || ctx.sess.host;
      writes = writes.filter(w => !(w.ip === h.ip && w.path === e.path));
      writes.push({ ip: h.ip, path: e.path, content: e.node.content, owner: e.node.owner });
    }
    if (e.type === 'chmod') {
      const h = Object.values(ctx.world.hosts).find(x => x.name === e.host) || ctx.sess.host;
      chmods = chmods.filter(c => !(c.ip === h.ip && c.path === e.path));
      chmods.push({ ip: h.ip, path: e.path, exec: String(e.mode).includes('+x') });
    }
    if (e.type === 'error') {
      errCount++;
      if (errCount === 3 || errCount === 7) {
        nudge(tr('Du scheinst festzustecken. Tippe ', 'Looks like you are stuck. Type ') + C('y', 'hint') +
          tr(' oder nutze den Tipp-Button links.', ' or use the hint button on the left.'));
      }
      return;
    }
    level.objectives.forEach((o, i) => {
      if (objectivesDone[i]) return;
      try {
        if (o.check(e, ctx)) {
          objectivesDone[i] = true;
          msgQueue.push(C('ok', tr(' ✔ ZIEL ERREICHT ', ' ✔ OBJECTIVE COMPLETE ')) + ' ' + C('g', o.text));
          beep(880, 0.08, 'triangle');
          renderObjectives(i);
          errCount = 0;
          resetIdle();
        }
      } catch (err) { console.error(err); }
    });
  }

  function flushMessages() {
    if (msgQueue.length) { term.print(''); msgQueue.forEach(m => term.print(m)); msgQueue = []; }
    if (!finished && objectivesDone.every(Boolean) && !ctx._allDoneHint) {
      ctx._allDoneHint = true;
      term.print(C('sys', tr('» Alle Ziele erreicht! Reiche jetzt die Flag mit submit ein.', '» All objectives complete! Now submit the flag with submit.')));
    }
  }

  function nudge(msg) {
    term.print(C('sys', '» ' + msg));
    $('btn-hint').classList.add('pulse');
  }

  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!finished && lv(level.id).hints < level.hints.length && currentScreen() === 'screen-game') {
        nudge(tr('Schon eine Weile nichts Neues? Ein Tipp kostet nur 25 Punkte.', 'Nothing new for a while? A hint only costs 25 points.'));
        term.scroll();
      }
    }, 120000);
  }

  function renderObjectives(justIdx = -1) {
    $('g-objectives').innerHTML = level.objectives.map((o, i) =>
      `<li class="${objectivesDone[i] ? 'done' : ''} ${i === justIdx ? 'just' : ''}">${o.text}</li>`).join('') +
      `<li class="${finished ? 'done' : ''}">${tr('Flag einreichen', 'Submit the flag')} 🚩</li>`;
  }

  /* ---------------- Tipps ---------------- */
  function renderHints() {
    const used = lv(level.id).hints;
    $('g-hints').innerHTML = level.hints.slice(0, used).map((h, i) => `<div class="hint"><b>${tr('Tipp', 'Hint')} ${i + 1}:</b> ${h}</div>`).join('');
    $('g-hintcount').textContent = `(${used}/${level.hints.length})`;
    const btn = $('btn-hint');
    btn.classList.remove('pulse');
    const cost = tr('(−25 Punkte)', '(−25 points)');
    if (lv(level.id).done) {
      btn.disabled = used >= level.hints.length;
      btn.textContent = used >= level.hints.length ? tr('Alle Tipps angezeigt', 'All hints shown') : tr('Tipp anzeigen (bereits gelöst)', 'Show hint (already solved)');
    } else if (used >= level.hints.length) {
      btn.disabled = true; btn.textContent = tr('Keine weiteren Tipps', 'No more hints');
    } else {
      btn.disabled = false;
      btn.textContent = used === level.hints.length - 1 ? `${tr('Lösung anzeigen', 'Show solution')} ${cost}` : `${tr('Tipp anzeigen', 'Show hint')} ${cost}`;
    }
    $('g-points').textContent = lv(level.id).done ? lv(level.id).points : potential(used);
  }

  function showHint() {
    const s = lv(level.id);
    if (s.hints >= level.hints.length) {
      term.print(C('sys', tr('» Du hast bereits alle Tipps für diese Mission gesehen (siehe links).', '» You have already seen all hints for this mission (see left).')));
      return;
    }
    s.hints++;
    persist();
    renderHints();
    const tmp = document.createElement('div');
    tmp.innerHTML = level.hints[s.hints - 1];
    term.print(`${C('y', `💡 ${tr('Tipp', 'Hint')} ${s.hints}/${level.hints.length}:`)} ${tmp.textContent}`);
    $('hints-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  $('btn-hint').addEventListener('click', () => { showHint(); saveSession(); term.focus(); });

  /* ---------------- Flag ---------------- */
  function submitFlag(raw) {
    const f = raw.trim();
    if (f.toLowerCase() === level.flag.toLowerCase()) return complete();
    beep(180, 0.14, 'sawtooth', 0.05);
    term.print(C('r', tr('✘ Falsche Flag. ', '✘ Wrong flag. ')) +
      C('d', tr('Flags haben das Format HACKIT{...} – achte auf die genaue Schreibweise.', 'Flags look like HACKIT{...} – check the exact spelling.')));
    onEvent({ type: 'error', kind: 'flag' });
    const form = $('flag-form');
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
  }

  $('flag-form').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('flag-input').value;
    if (!v.trim() || !level) return;
    term.echoCommand('submit ' + v);
    submitFlag(v);
    flushMessages();
    saveSession();
    term.scroll();
  });

  function complete() {
    if (finished) return;
    finished = true;
    stopTimer();
    clearTimeout(idleTimer);
    const sec = Math.max(1, Math.round(elapsedBase / 1000));
    const s = lv(level.id);
    const pts = potential(s.hints), stars = starsFor(s.hints);
    const first = !s.done;
    s.done = true;
    s.points = Math.max(s.points, pts);
    s.stars = Math.max(s.stars, stars);
    s.bestSec = s.bestSec ? Math.min(s.bestSec, sec) : sec;
    if (!level.isDaily) {
      delete save.sessions[level.id];
      if (save.active === level.id) save.active = null;
    }
    persist();
    objectivesDone = objectivesDone.map(() => true);
    renderObjectives();
    renderHints();
    term.print('\n' + C('ok', tr(' ✔ FLAG KORREKT ', ' ✔ FLAG CORRECT ')) + ' ' + C('g', level.flag) + '\n');
    beep(523, 0.08); setTimeout(() => beep(784, 0.14), 90);

    setTimeout(() => {
      const last = level.isDaily || level.id === LEVELS.list.length;
      $('m-text').textContent = level.isDaily
        ? tr(`Daily Challenge gemeistert in ${sec}s!`, `Daily Challenge mastered in ${sec}s!`)
        : last
          ? tr(`Unglaublich, ${save.alias}! Du hast alle Missionen gemeistert.`, `Incredible, ${save.alias}! You have mastered every mission.`)
          : tr(`Mission „${level.title}“ abgeschlossen.`, `Mission "${level.title}" complete.`);
      $('m-stars').innerHTML = [1, 2, 3].map(i => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('');
      $('m-points').textContent = level.isDaily
        ? `⏱ ${sec}s (${tr('Bestzeit', 'best')}: ${s.bestSec}s)`
        : first
          ? `+${pts} ${tr('Punkte', 'points')} · ⏱ ${sec}s · ${tr('Rang', 'Rank')}: ${rank()}`
          : `${pts} ${tr('Punkte', 'points')} (${tr('Bestwert', 'best')}: ${s.points}) · ⏱ ${sec}s · ${tr('Rang', 'Rank')}: ${rank()}`;
      $('m-learned').innerHTML = `🧠 <b>${tr('Gelernt', 'Learned')}:</b> ${level.learned}`;
      $('m-next').classList.toggle('hidden', last);
      $('modal').classList.remove('hidden');
      $('m-next').focus();
    }, 700);
  }

  $('m-next').addEventListener('click', () => { $('modal').classList.add('hidden'); startLevel(level.id + 1); });
  $('m-map').addEventListener('click', () => { $('modal').classList.add('hidden'); renderMap(); show('map'); });
  if ($('btn-cert')) $('btn-cert').addEventListener('click', () => {
    $('cert-alias').textContent = `${save.alias} · ${rank()}`;
    $('cert-stats').textContent = `${doneCount()}/${LEVELS.list.length} ${tr('Missionen', 'Missions')} · ${totalPoints()} ${tr('Punkte', 'Points')} · ${totalStars()} ★`;
    $('cert-date').textContent = new Date().toLocaleDateString(I18N.lang === 'en' ? 'en-GB' : 'de-DE');
    $('cert-modal').classList.remove('hidden');
  });
  if ($('cert-close')) $('cert-close').addEventListener('click', () => $('cert-modal').classList.add('hidden'));
  if ($('btn-cheat')) $('btn-cheat').addEventListener('click', () => {
    if (!ctx) return;
    $('cheat-list').innerHTML = ctx.unlocked.map(c => `<div class="cheat-row"><code data-c="${c}">${c}</code><span>${Terminal.esc(Shell.describe(c))}</span></div>`).join('');
    $('cheat-list').querySelectorAll('code').forEach(el => el.addEventListener('click', () => {
      term.input.value = el.dataset.c + ' ';
      $('cheat-modal').classList.add('hidden');
      term.focus();
    }));
    $('cheat-modal').classList.remove('hidden');
  });
  if ($('cheat-close')) $('cheat-close').addEventListener('click', () => $('cheat-modal').classList.add('hidden'));
  if ($('btn-export')) $('btn-export').addEventListener('click', () => {
    const data = JSON.stringify({ alias: save.alias, levels: save.levels, daily: save.daily }, null, 2);
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
    a.download = `hackit-save-${save.alias || 'anon'}.json`;
    a.click();
  });
  if ($('btn-import') && $('import-file')) {
    $('btn-import').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = JSON.parse(r.result);
          if (!parsed || typeof parsed.levels !== 'object') throw new Error('Invalid save');
          save.alias = String(parsed.alias || save.alias || 'anon').replace(/[^\w\-.]/g, '') || 'anon';
          save.levels = parsed.levels;
          save.daily = parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {};
          persist(); renderMap();
        } catch { alert(tr('Ungültige Spielstand-Datei.', 'Invalid save file.')); }
      };
      r.readAsText(f);
      e.target.value = '';
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('modal').classList.contains('hidden')) $('modal').classList.add('hidden');
      if ($('cert-modal') && !$('cert-modal').classList.contains('hidden')) $('cert-modal').classList.add('hidden');
      if ($('cheat-modal') && !$('cheat-modal').classList.contains('hidden')) $('cheat-modal').classList.add('hidden');
    }
  });
  $('btn-back').addEventListener('click', leaveGame);
  $('btn-restart').addEventListener('click', () => {
    if (!level) return;
    if (confirm(tr('Mission neu starten? Der Terminal-Verlauf dieser Session geht verloren (benutzte Tipps bleiben).',
      'Restart this mission? The terminal history of this session will be lost (used hints remain).'))) {
      startLevel(level.id, { fresh: true });
    }
  });

  /* ---------------- Sprachwechsel ---------------- */
  I18N.onChange(() => {
    // LEVELS wurde bereits neu gebaut (levels-index.js) → Referenzen aktualisieren
    applyI18n();
    if (level) {
      level = level.isDaily && typeof dailyLevel === 'function' ? dailyLevel(level.dateKey) : LEVELS.list.find(l => l.id === level.id);
      if (ctx) { ctx.level = level; }
      renderSidebar();
      $('modal').classList.add('hidden');
    }
    if (currentScreen() === 'screen-map') renderMap();
    if (currentScreen() === 'screen-start' && !$('start-form').classList.contains('hidden')) updateStartButton();
  });

  document.documentElement.lang = I18N.lang;
  applyI18n();
  updateSoundBtn();
  boot();
})();
