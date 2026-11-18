/* HACKIT – Unit- & UI-Test-Suite (ausführbar mit JavaScriptCore `jsc` oder Node.js `node`) */
(() => {
  const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  const ROOT = isNode
    ? require('path').resolve(__dirname, '..') + '/'
    : '/Users/andreas/Documents/GitHub/hackit/';
  const runScript = isNode
    ? (p) => require('vm').runInThisContext(require('fs').readFileSync(p, 'utf8'), { filename: p })
    : (p) => load(p);
  const log = isNode ? (...a) => console.log(...a) : (...a) => print(...a);

  /* ---------------- Mini-Test-Framework ---------------- */
  let passed = 0, failed = 0, currentSuite = '';
  const failures = [];
  const asyncQueue = [];

  function suite(name, fn) {
    currentSuite = name;
    fn();
  }
  function test(name, fn) {
    const label = `${currentSuite} > ${name}`;
    asyncQueue.push(async () => {
      try {
        await fn();
        passed++;
      } catch (e) {
        failed++;
        failures.push({ label, e });
      }
    });
  }
  function assert(cond, msg = 'Assertion failed') {
    if (!cond) throw new Error(msg);
  }
  function eq(a, b, msg = '') {
    const ja = JSON.stringify(a), jb = JSON.stringify(b);
    if (ja !== jb) throw new Error(`${msg ? msg + ': ' : ''}expected ${jb}, got ${ja}`);
  }
  function includes(hay, needle, msg = '') {
    if (!String(hay).includes(needle)) throw new Error(`${msg ? msg + ': ' : ''}expected "${hay}" to include "${needle}"`);
  }

  /* ---------------- Browser/DOM-Stubs (auf globalThis für load()) ---------------- */
  globalThis.setTimeout = (fn) => { const id = ++globalThis.setTimeout._id; if (!globalThis.setTimeout._skip) Promise.resolve().then(() => { if (!globalThis.setTimeout._cleared.has(id)) fn(); }); return id; };
  globalThis.setTimeout._id = 0; globalThis.setTimeout._cleared = new Set(); globalThis.setTimeout._skip = false;
  globalThis.clearTimeout = (id) => { globalThis.setTimeout._cleared.add(id); };
  globalThis.setInterval = (fn) => { globalThis._intervals.push(fn); return globalThis._intervals.length; };
  globalThis._intervals = [];
  globalThis.clearInterval = () => {};
  globalThis.confirm = () => true;
  globalThis.innerWidth = 1280; globalThis.innerHeight = 800;
  globalThis.addEventListener = () => {};
  globalThis.localStorage = {
    _d: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
    clear() { this._d = {}; },
  };
  globalThis.navigator = { language: 'de-DE' };
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  globalThis.btoa = s => {
    let o = '';
    for (let i = 0; i < s.length; i += 3) {
      const a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2);
      const n = (a << 16) | ((b || 0) << 8) | (c || 0);
      o += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (isNaN(b) ? '=' : B64[(n >> 6) & 63]) + (isNaN(c) ? '=' : B64[n & 63]);
    }
    return o;
  };
  globalThis.atob = s => {
    s = s.replace(/=+$/, '');
    if (/[^A-Za-z0-9+/]/.test(s)) throw new Error('Invalid base64');
    let o = '', bits = 0, val = 0;
    for (const ch of s) {
      val = (val << 6) | B64.indexOf(ch); bits += 6;
      if (bits >= 8) { bits -= 8; o += String.fromCharCode((val >> bits) & 255); }
    }
    return o;
  };

  /* Leichtgewichtiges DOM-Modell für terminal.js & game.js */
  class MockClassList {
    constructor(el) { this.el = el; this.set = new Set(); }
    add(...cls) { cls.forEach(c => c && this.set.add(c)); }
    remove(...cls) { cls.forEach(c => this.set.delete(c)); }
    toggle(c, force) {
      if (force === undefined) force = !this.set.has(c);
      if (force) this.set.add(c); else this.set.delete(c);
      return force;
    }
    contains(c) { return this.set.has(c); }
    toString() { return [...this.set].join(' '); }
  }

  class MockElement {
    constructor(tag = 'div', id = '') {
      this.tagName = tag.toUpperCase();
      this.id = id;
      this.children = [];
      this.parentNode = null;
      this.classList = new MockClassList(this);
      this.dataset = {};
      this.style = {};
      this.listeners = {};
      this._innerHTML = '';
      this._textContent = '';
      this.value = '';
      this.placeholder = '';
      this.type = 'text';
      this.disabled = false;
      this.scrollTop = 0;
      this.scrollHeight = 100;
      this.focused = false;
      if (id) byId[id] = this;
    }
    set className(v) { this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get className() { return this.classList.toString(); }
    get textContent() {
      if (this._innerHTML) return this._innerHTML.replace(/<[^>]+>/g, '');
      if (this.children.length) return this.children.map(c => c.textContent).join('');
      return this._textContent;
    }
    set textContent(v) { this._textContent = String(v); this._innerHTML = ''; this.children = []; }
    get innerHTML() {
      return (this._innerHTML || this._textContent) + this.children.map(c => c.outerHTML).join('');
    }
    set innerHTML(v) {
      this._innerHTML = String(v);
      this._textContent = '';
      this.children = [];
      if (this._innerHTML.includes('class="cards"')) {
        const d = new MockElement('div');
        d.className = 'cards';
        this.appendChild(d);
      }
      if (this._innerHTML.includes('<button')) {
        const ms = this._innerHTML.match(/<button([^>]*)>/gi) || [];
        ms.forEach(tag => {
          const b = new MockElement('button');
          const dm = tag.match(/data-lang="([^"]*)"/);
          if (dm) b.dataset.lang = dm[1];
          this.appendChild(b);
        });
      }
    }
    get outerHTML() {
      const cls = this.className ? ` class="${this.className}"` : '';
      return `<${this.tagName.toLowerCase()}${cls}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;
    }
    appendChild(child) {
      if (child && child._isFrag) {
        child.children.forEach(c => this.appendChild(c));
        return child;
      }
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
    dispatchEvent(ev) {
      ev.target = ev.target || this;
      ev.preventDefault = ev.preventDefault || (() => {});
      (this.listeners[ev.type] || []).forEach(fn => fn(ev));
      if (this.parentNode && !ev._stop) this.parentNode.dispatchEvent(ev);
    }
    click() { this.dispatchEvent({ type: 'click', target: this, closest: sel => this._closest(sel) }); }
    _closest(sel) {
      if (sel.startsWith('.') && this.classList.contains(sel.slice(1))) return this;
      return this.parentNode ? this.parentNode._closest(sel) : null;
    }
    closest(sel) { return this._closest(sel); }
    focus() { this.focused = true; }
    setSelectionRange() {}
    scrollIntoView() {}
    getContext() { return { fillStyle: '', font: '', fillRect() {}, fillText() {} }; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      const res = [];
      const match = el => {
        if (sel === 'button') return el.tagName === 'BUTTON';
        if (sel === 'code') return el.tagName === 'CODE';
        if (sel === 'p') return el.tagName === 'P';
        if (sel === '.cards') return el.classList.contains('cards');
        return false;
      };
      const walk = el => {
        for (const c of el.children) { if (match(c)) res.push(c); walk(c); }
      };
      walk(this);
      // Fallback für dynamisches innerHTML mit <p>, <code> oder <button data-lang="...">
      if (!res.length && this._innerHTML) {
        if (sel === 'p') {
          const ms = this._innerHTML.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
          return ms.map(m => { const e = new MockElement('p'); e.innerHTML = m.replace(/<\/?p[^>]*>/gi, ''); return e; });
        }
        if (sel === 'code') {
          const ms = this._innerHTML.match(/<code[^>]*data-cmd="([^"]*)"[^>]*>([\s\S]*?)<\/code>/gi) || [];
          return ms.map(m => {
            const e = new MockElement('code');
            const cm = m.match(/data-cmd="([^"]*)"/);
            e.dataset.cmd = cm ? cm[1].replace(/&quot;/g, '"') : '';
            return e;
          });
        }
        if (sel === '.lang-switch button' || sel === 'button') {
          const ms = this._innerHTML.match(/<button[^>]*data-lang="([^"]*)"[^>]*>/gi) || [];
          return ms.map(m => {
            const e = new MockElement('button');
            e.parentNode = this;
            e.dataset.lang = m.match(/data-lang="([^"]*)"/)[1];
            return e;
          });
        }
      }
      return res;
    }
  }

  const byId = {};
  const allScreens = [];
  const i18nEls = [];
  const i18nPhEls = [];
  const langBoxes = [];

  function mk(tag, id, attrs = {}) {
    const el = new MockElement(tag, id);
    if (attrs.screen) { el.classList.add('screen'); allScreens.push(el); }
    if (attrs.active) el.classList.add('active');
    if (attrs.i18n) { el.dataset.i18n = attrs.i18n; i18nEls.push(el); }
    if (attrs.ph) { el.dataset.i18nPh = attrs.ph; i18nPhEls.push(el); }
    if (attrs.langBox) { el.classList.add('lang-switch'); langBoxes.push(el); }
    return el;
  }

  // Alle Elemente aus index.html anlegen
  mk('canvas', 'matrix');
  mk('section', 'screen-start', { screen: true, active: true });
  mk('p', '', { i18n: 'tagline' });
  mk('div', 'boot');
  const startForm = mk('div', 'start-form'); startForm.classList.add('hidden');
  mk('label', '', { i18n: 'aliasLabel' });
  mk('input', 'alias', { ph: 'aliasPh' });
  mk('button', 'btn-start');
  mk('p', '', { i18n: 'disclaimer' });
  mk('div', '', { langBox: true });

  mk('section', 'screen-map', { screen: true });
  mk('div', 'p-alias'); mk('div', 'p-rank');
  mk('span', 'p-points'); mk('span', 'p-done'); mk('span', 'p-stars');
  mk('div', 'p-progress'); mk('main', 'map');
  mk('button', 'btn-reset', { i18n: 'reset' });

  mk('section', 'screen-game', { screen: true });
  mk('button', 'btn-back', { i18n: 'back' });
  mk('button', 'btn-restart', { i18n: 'restart' });
  mk('span', 'save-indicator', { i18n: 'saved' });
  mk('span', 'g-num'); mk('span', 'g-title'); mk('span', 'g-points');
  mk('div', 'g-story'); mk('ul', 'g-objectives'); mk('div', 'g-newcmds');
  mk('div', 'hints-panel'); mk('small', 'g-hintcount'); mk('div', 'g-hints'); mk('button', 'btn-hint');
  mk('form', 'flag-form'); mk('input', 'flag-input');
  mk('span', 'term-title'); mk('div', 'terminal'); mk('div', 'term-out');
  mk('div', 'term-line'); mk('span', 'term-prompt'); mk('input', 'term-input');

  mk('div', 'modal').classList.add('hidden');
  mk('p', 'm-text'); mk('div', 'm-stars'); mk('p', 'm-points'); mk('p', 'm-learned');
  mk('button', 'm-map', { i18n: 'toMap' }); mk('button', 'm-next', { i18n: 'nextMission' });

  const docListeners = {};
  globalThis.document = {
    title: '',
    hidden: false,
    documentElement: { lang: 'de' },
    getElementById: id => byId[id] || null,
    createElement: tag => new MockElement(tag),
    createDocumentFragment: () => ({ _isFrag: true, children: [], appendChild(c) { this.children.push(c); } }),
    querySelector: sel => sel === '.screen.active' ? allScreens.find(s => s.classList.contains('active')) || null : null,
    querySelectorAll: sel => {
      if (sel === '.screen') return allScreens;
      if (sel === '[data-i18n]') return i18nEls;
      if (sel === '[data-i18n-ph]') return i18nPhEls;
      if (sel === '.lang-switch') return langBoxes;
      return [];
    },
    addEventListener: (ev, fn) => { (docListeners[ev] ||= []).push(fn); },
  };
  globalThis.window = {
    _ls: {},
    getSelection: () => ({ toString: () => '' }),
    addEventListener: (ev, fn) => { (globalThis.window._ls[ev] ||= []).push(fn); },
  };

  /* ---------------- Module laden ---------------- */
  for (const f of ['js/i18n.js', 'js/vfs.js', 'js/terminal.js', 'js/commands.js', 'js/commands-extra.js', 'js/levels.js', 'js/levels-advanced.js', 'js/levels-index.js']) {
    runScript(ROOT + f);
  }

  /* ======================================================================
   * 1. I18N Tests
   * ====================================================================== */
  suite('I18N', () => {
    test('default language is de and tr() selects properly', () => {
      I18N.set('de');
      eq(I18N.lang, 'de');
      eq(tr('Hallo', 'Hello'), 'Hallo');
    });
    test('I18N.set switches to en, persists and notifies listeners', () => {
      let called = null;
      I18N.onChange(l => { called = l; });
      I18N.set('en');
      eq(I18N.lang, 'en');
      eq(called, 'en');
      eq(tr('Hallo', 'Hello'), 'Hello');
      eq(localStorage.getItem('hackit-lang'), 'en');
      eq(document.documentElement.lang, 'en');
      I18N.set('de');
    });
    test('unsupported language is ignored', () => {
      I18N.set('fr');
      eq(I18N.lang, 'de');
    });
  });

  /* ======================================================================
   * 2. VFS Tests
   * ====================================================================== */
  suite('VFS', () => {
    test('linuxFS builds standard directories and writable /tmp', () => {
      const fs = VFS.linuxFS({ hostname: 'box', users: { alice: {} }, homes: { alice: { 'a.txt': VFS.F('hi') } } });
      assert(fs.children.tmp.writable === true, '/tmp must be writable');
      assert(fs.children.root.private === true, '/root must be private');
      assert(VFS.get(fs, ['home', 'alice', 'a.txt']).content === 'hi');
      assert(VFS.get(fs, ['etc', 'hostname']).content === 'box');
    });
    test('resolve handles relative, absolute, ~, . and ..', () => {
      const sess = { home: ['home', 'hacker'], cwd: ['home', 'hacker', 'sub'] };
      eq(VFS.resolve(sess, '~'), ['home', 'hacker']);
      eq(VFS.resolve(sess, '~/docs'), ['home', 'hacker', 'docs']);
      eq(VFS.resolve(sess, '..'), ['home', 'hacker']);
      eq(VFS.resolve(sess, '/etc/./passwd'), ['etc', 'passwd']);
    });
    test('displayPath shortens home to ~', () => {
      eq(VFS.displayPath({ home: ['home', 'u'], cwd: ['home', 'u'] }), '~');
      eq(VFS.displayPath({ home: ['home', 'u'], cwd: ['home', 'u', 'a'] }), '~/a');
      eq(VFS.displayPath({ home: ['home', 'u'], cwd: ['var', 'log'] }), '/var/log');
    });
    test('canRead & canTraverse enforce private ownership and root bypass', () => {
      const fs = VFS.linuxFS({ hostname: 'h', users: { alice: { privateHome: true }, bob: {} }, homes: { alice: { 's.txt': VFS.F('sec') }, bob: {} } });
      const bob = { user: 'bob' }, alice = { user: 'alice' }, root = { user: 'root' };
      eq(VFS.canTraverse(bob, fs, ['home', 'alice', 's.txt']), false);
      eq(VFS.canTraverse(alice, fs, ['home', 'alice', 's.txt']), true);
      eq(VFS.canTraverse(root, fs, ['home', 'alice', 's.txt']), true);
    });
    test('walk and glob match expected files', () => {
      const fs = VFS.D({ a: VFS.F('1'), sub: VFS.D({ 'b.bak': VFS.F('2') }) });
      const paths = [];
      VFS.walk(fs, [], (_n, p) => paths.push(VFS.pathStr(p)));
      assert(paths.includes('/sub/b.bak'));
      const re = VFS.glob('*.bak');
      assert(re.test('x.bak') && !re.test('x.txt'));
    });
  });

  /* ======================================================================
   * 3. Terminal Tests
   * ====================================================================== */
  suite('Terminal', () => {
    function makeTerm() {
      const root = new MockElement('div');
      const out = new MockElement('div');
      const line = new MockElement('div');
      const prompt = new MockElement('span');
      const input = new MockElement('input');
      const title = new MockElement('span');
      return new Terminal({ root, out, line, prompt, input, title });
    }
    test('esc, render and strip handle markup safely', () => {
      eq(Terminal.esc('<a>&'), '&lt;a&gt;&amp;');
      eq(Terminal.render('⟦g|ok⟧ <x>'), '<span class="c-g">ok</span> &lt;x&gt;');
      eq(Terminal.strip('⟦c|nested ⟦y|txt⟧⟧'), 'nested txt');
    });
    test('print, clear, setPrompt, setBusy', () => {
      const t = makeTerm();
      t.print('line1\nline2');
      eq(t.out.children.length, 2);
      t.setPrompt('⟦g|u@h⟧$ ', 'win');
      eq(t.titleEl.textContent, 'win');
      t.setBusy(true);
      eq(t.line.style.visibility, 'hidden');
      t.setBusy(false);
      eq(t.line.style.visibility, 'visible');
      t.clear();
      eq(t.out.children.length, 0);
      t.root.click();
      assert(t.input.focused, 'root click focuses input');
    });
    test('typeOut prints lines asynchronously and Tab lists multiple options', async () => {
      const t = makeTerm();
      await t.typeOut('l1\nl2', 1);
      eq(t.out.children.length, 2);
      t.onComplete = v => ({ value: v, options: ['exit', 'exiftool'] });
      t.input.value = 'exi';
      t.key({ key: 'Tab', preventDefault() {} });
      includes(t.out.innerHTML, 'exiftool');
    });
    test('key handling: Enter, history, Tab, Ctrl+L, Ctrl+C', () => {
      const t = makeTerm();
      let ran = null;
      t.onCommand = c => { ran = c; };
      t.input.value = 'ls -a';
      t.key({ key: 'Enter', preventDefault() {} });
      eq(ran, 'ls -a');
      eq(t.history, ['ls -a']);
      t.key({ key: 'ArrowUp', preventDefault() {} });
      eq(t.input.value, 'ls -a');
      t.key({ key: 'ArrowDown', preventDefault() {} });
      eq(t.input.value, '');
      t.onComplete = v => ({ value: v + 's ', options: ['ls'] });
      t.input.value = 'l';
      t.key({ key: 'Tab', preventDefault() {} });
      eq(t.input.value, 'ls ');
      t.key({ key: 'l', ctrlKey: true, preventDefault() {} });
      eq(t.out.children.length, 0);
      t.input.value = 'abc';
      t.key({ key: 'c', ctrlKey: true, preventDefault() {} });
      eq(t.input.value, '');
    });
    test('ask resolves with secret input', async () => {
      const t = makeTerm();
      const p = t.ask('PW: ', true);
      eq(t.input.type, 'password');
      t.input.value = 'secret';
      t.key({ key: 'Enter', preventDefault() {} });
      const res = await p;
      eq(res, 'secret');
      eq(t.input.type, 'text');
    });
  });

  /* ======================================================================
   * 4. Shell & Commands Tests
   * ====================================================================== */
  suite('Shell & Commands', () => {
    function mkCtx(extraFS = {}) {
      const h = VFS.host({
        name: 'kali', ip: '10.0.0.5',
        users: { hacker: { password: 'pw' }, root: { password: 'rpw' } },
        sudo: { hacker: ['id'] },
        fs: VFS.linuxFS({
          hostname: 'kali', users: { hacker: {} },
          homes: { hacker: {
            'a.txt': VFS.F('alpha\nbeta\ngamma'),
            '.hidden': VFS.F('secret'),
            'b.b64': VFS.F(Shell.b64encode('hello')),
            'caesar.txt': VFS.F(Shell.caesar('HALLO', 3)),
            'bin': VFS.F('\x7fELF\x00PASS=1234\x00', { binary: true, exec: true }),
            'suidbin': VFS.F('', { suid: true, writable: true }),
            ...extraFS,
          } },
        }),
      });
      h.cron = [{ schedule: '* * * * *', user: 'root', cmd: '/bin/true' }];
      const out = [], events = [];
      const ctx = {
        world: { hosts: { '10.0.0.5': h } },
        level: { newCommands: [] },
        unlocked: Object.keys(Shell.cmds),
        term: { print: s => out.push(Terminal.strip(s)), ask: async () => 'pw', clear() {}, history: ['ls'] },
        sessions: [{ host: h, user: 'hacker', home: ['home', 'hacker'], cwd: ['home', 'hacker'] }],
        get sess() { return this.sessions[this.sessions.length - 1]; },
        emit: e => events.push(e),
        updatePrompt() {}, submit() {}, showHint() {}, showMission: () => 'M',
        out, events,
      };
      return ctx;
    }

    test('lex / tokenize handles quotes, escapes, pipes, redirections and chains', () => {
      eq(Shell.lex('echo "a | b" > /tmp/x && ls; pwd'),
        ['echo', 'a | b', { op: '>' }, '/tmp/x', { op: '&&' }, 'ls', { op: ';' }, 'pwd']);
    });
    test('parseFlags handles short, combined, long and value flags', () => {
      const { flags, rest } = Shell.parseFlags(['-la', '-n', '5', '--wordlist=w.txt', 'file'], ['n']);
      eq(flags, { l: true, a: true, n: '5', wordlist: 'w.txt' });
      eq(rest, ['file']);
    });
    test('permString renders directory, suid and writable bits', () => {
      eq(Shell.permString(VFS.F('', { suid: true, exec: true })), '-rwsr-xr-x');
      eq(Shell.permString(VFS.F('', { suid: true })), '-rwSr--r--');
      eq(Shell.permString(VFS.F('', { writable: true })), '-rw-rw-rw-');
    });
    test('redirection > and >> work in /tmp and fail on protected /etc', async () => {
      const ctx = mkCtx();
      await Shell.execute(ctx, 'echo one > /tmp/out.txt');
      await Shell.execute(ctx, 'echo two >> /tmp/out.txt');
      eq(VFS.get(ctx.sess.host.fs, ['tmp', 'out.txt']).content, 'one\ntwo');
      await Shell.execute(ctx, 'echo bad > /etc/passwd');
      includes(ctx.out.join('\n'), 'Permission denied');
    });
    test('&& stops on error while ; continues', async () => {
      const ctx = mkCtx();
      await Shell.execute(ctx, 'cat missing && echo should_not_appear');
      assert(!ctx.out.join('\n').includes('should_not_appear'));
      await Shell.execute(ctx, 'cat missing ; echo appeared');
      includes(ctx.out.join('\n'), 'appeared');
    });
    test('pipes, grep, head, tail, wc, base64, caesar, strings, find', async () => {
      const ctx = mkCtx();
      await Shell.execute(ctx, 'cat a.txt | grep -n beta');
      includes(ctx.out.pop(), '2:beta');
      await Shell.execute(ctx, 'head -n 1 a.txt');
      eq(ctx.out.pop(), 'alpha');
      await Shell.execute(ctx, 'tail -n 1 a.txt');
      eq(ctx.out.pop(), 'gamma');
      await Shell.execute(ctx, 'wc a.txt');
      eq(ctx.out.pop(), '3');
      await Shell.execute(ctx, 'base64 -d b.b64');
      eq(ctx.out.pop(), 'hello');
      await Shell.execute(ctx, 'caesar -s -3 caesar.txt');
      eq(ctx.out.pop(), 'HALLO');
      await Shell.execute(ctx, 'strings bin');
      includes(ctx.out.pop(), 'PASS=1234');
      await Shell.execute(ctx, 'find . -name "a.*"');
      includes(ctx.out.pop(), './a.txt');
    });
    test('complete suggests commands and file paths', () => {
      const ctx = mkCtx();
      const c1 = Shell.complete(ctx, 'exi');
      eq(c1.options, ['exit', 'exiftool']);
      const c2 = Shell.complete(ctx, 'expor');
      eq(c2.value, 'export ');
      const c3 = Shell.complete(ctx, 'cat a.');
      eq(c3.value, 'cat a.txt ');
    });
    test('commands-extra: exiftool, xor, env, export, chmod, crontab', async () => {
      const ctx = mkCtx({
        'pic.jpg': VFS.F('img', { binary: true, meta: { Author: 'Zero' } }),
        's.txt': VFS.F('script'),
      });
      await Shell.execute(ctx, 'exiftool pic.jpg');
      includes(ctx.out.pop(), 'Zero');
      await Shell.execute(ctx, 'echo secret | xor -k K --out-hex | xor -k K --hex');
      eq(ctx.out.pop(), 'secret');
      await Shell.execute(ctx, 'export MYVAR=42 && env');
      includes(ctx.out.pop(), 'MYVAR=42');
      await Shell.execute(ctx, 'chmod +x s.txt');
      eq(VFS.get(ctx.sess.host.fs, ['home', 'hacker', 's.txt']).exec, true);
      await Shell.execute(ctx, 'crontab -l');
      includes(ctx.out.pop(), '/bin/true');
      await Shell.execute(ctx, 'echo ZZZZ | xor -k K --hex');
      includes(ctx.out.pop().toLowerCase(), 'hex');
      await Shell.execute(ctx, 'chmod +x /etc/passwd');
      includes(ctx.out.pop(), 'zulässig');
      await Shell.execute(ctx, 'cat toString');
      includes(ctx.out.pop(), 'nicht gefunden');
      await Shell.execute(ctx, 'export __proto__=bad');
      includes(ctx.out.pop(), 'Ungültiger');
      await Shell.execute(ctx, 'mkdir /tmp/d && touch /tmp/d/f && cp /tmp/d/f /tmp/d/g && rm /tmp/d/f');
      assert(VFS.get(ctx.sess.host.fs, ['tmp', 'd', 'g']) && !VFS.get(ctx.sess.host.fs, ['tmp', 'd', 'f']));
    });
    test('edge cases: help, ls -l, cat binary, id, grep -r, find -perm/-exec, nmap single, su/sudo/ssh/curl errors, syntax', async () => {
      const restricted = VFS.host({
        name: 'secretbox', ip: '10.0.0.99',
        users: { u: { password: 'p' } }, fs: VFS.linuxFS({ hostname: 'secretbox' }),
        services: [{ port: 22, name: 'ssh' }, { port: 80, name: 'http', web: () => 'ok' }],
      });
      restricted.onlyFrom = ['10.0.0.88'];
      const ctx = mkCtx();
      ctx.world.hosts['10.0.0.99'] = restricted;
      ctx.level = { newCommands: [{ cmd: 'ls', desc: '' }] };
      eq(Shell.tokenize('a | b'), [['a'], ['b']]);
      assert(typeof Shell.describe('ls') === 'string' && Shell.describe('nonexistent') === '');

      await Shell.execute(ctx, 'help');
      includes(ctx.out.pop(), 'ls');
      await Shell.execute(ctx, 'ls -la');
      includes(ctx.out.pop(), 'drwx');
      await Shell.execute(ctx, 'cat bin');
      assert(ctx.out.pop().length > 0);
      await Shell.execute(ctx, 'id');
      includes(ctx.out.pop(), 'uid=1000');
      await Shell.execute(ctx, 'grep beta .');
      includes(ctx.out.pop(), 'Verzeichnis');
      await Shell.execute(ctx, 'grep -r beta .');
      includes(ctx.out.pop(), 'a.txt');
      await Shell.execute(ctx, 'find . -perm -w');
      includes(ctx.out.pop(), 'suidbin');
      await Shell.execute(ctx, 'find . -name "a.txt" -exec cat {} \\;');
      includes(ctx.out.pop(), 'alpha');
      await Shell.execute(ctx, 'nmap 10.0.0.5');
      includes(ctx.out.pop(), '10.0.0.5');
      await Shell.execute(ctx, 'ssh u@10.0.0.99');
      includes(ctx.out.pop(), 'Network is unreachable');
      await Shell.execute(ctx, 'curl http://10.0.0.99/');
      includes(ctx.out.pop(), 'Network is unreachable');
      ctx.term.ask = async () => 'wrong';
      await Shell.execute(ctx, 'su root');
      includes(ctx.out.pop(), 'fehlgeschlagen');
      await Shell.execute(ctx, 'sudo cat /etc/shadow');
      includes(ctx.out.pop(), 'not allowed');
      ctx.sess.host.sudo = {};
      await Shell.execute(ctx, 'sudo id');
      includes(ctx.out.pop(), 'sudoers');
      await Shell.execute(ctx, 'submit');
      includes(ctx.out.pop(), 'submit HACKIT');
      await Shell.execute(ctx, 'unknowncmd');
      includes(ctx.out.pop(), 'nicht gefunden');
      ctx.unlocked = ['ls'];
      await Shell.execute(ctx, 'nmap 10.0.0.5');
      includes(ctx.out.pop(), 'späteren Mission');
      await Shell.execute(ctx, 'echo ok ;');
      await Shell.execute(ctx, 'echo ok &&');
      includes(ctx.out.pop(), 'Syntaxfehler');
    });
  });

  /* ======================================================================
   * 5. Levels (All 26 Missions in DE & EN)
   * ====================================================================== */
  suite('Missions (DE & EN)', () => {
    test('26 missions across 7 chapters with unique flags and 3 hints each', () => {
      eq(LEVELS.list.length, 26);
      eq(LEVELS.chapters.length, 7);
      const flags = new Set();
      LEVELS.list.forEach((l, i) => {
        eq(l.id, i + 1);
        assert(!flags.has(l.flag), 'Duplicate flag ' + l.flag);
        flags.add(l.flag);
        eq(l.hints.length, 3, '3 hints for level ' + l.id);
      });
    });

    const solutions = {
      1: [['ls'], ['cat willkommen.txt'], ['cat flag.txt']],
      2: [['cd projekte'], ['cd 2026/geheim'], ['cat flag.txt']],
      3: [['ls -a'], ['cd .admin_notizen'], ['cat .flag']],
      4: [['head server.log'], ['grep HACKIT server.log']],
      5: [['cat mail.txt'], ['cat anhang.b64 | base64 -d']],
      6: [['cat funkspruch.txt'], ['caesar --brute funkspruch.txt | grep HACKIT']],
      7: [['find / -name "*.bak"'], ['cat /srv/daten/abteilungen/it/alt/2025/cache/zugang.txt.bak']],
      8: [['./tresor', 'falsch'], ['strings tresor'], ['./tresor', 'goldfisch42']],
      9: [['ifconfig'], ['nmap 10.10.0.0/24'], ['ssh admin@10.10.0.23', 'x', 'admin'], ['cat flag.txt'], ['exit']],
      10: [['ls /home/chef'], ['john hashes.txt --wordlist=passwoerter.txt'], ['su chef', 'sonnenschein'], ['cat /home/chef/flag.txt']],
      11: [['curl http://10.20.0.80/'], ['curl "http://10.20.0.80/login?user=admin&pass=\'"'], ['curl "http://10.20.0.80/login?user=admin&pass=\' OR \'1\'=\'1"']],
      12: [['cat /root/flag.txt'], ['sudo -l'], ['sudo find . -exec /bin/sh \\;'], ['whoami'], ['cat /root/flag.txt']],
      13: [['nmap 10.66.0.0/24'], ['curl "10.66.0.10/login?user=x&pass=\' or 1=1 -- "'], ['echo b3BzOkJsNGNrMHV0IzIwMjY= | base64 -d'], ['ssh ops@10.66.0.20', 'Bl4ck0ut#2026'], ['sudo -l'], ['sudo base64 /root/blackout.txt | base64 -d']],
      14: [['exiftool beweis.jpg'], ['echo YXJjaGl2OmZvdG9fMjAyNg== | base64 -d'], ['ssh archiv@10.30.0.15', 'foto_2026'], ['cat flag.txt']],
      15: [['env'], ['export VAULT_ENV=debug'], ['./check_vault', '7391']],
      16: [['strings keycache.bin'], ['xor -k N3BULA --hex bericht.xor']],
      17: [['base64 -d token.b64 > /tmp/token.txt'], ['chmod +x unlocker'], ['./unlocker']],
      18: [['crontab -l'], ['cat /var/spool/reports/.nightly.out'], ['caesar --brute /var/spool/reports/.nightly.out | grep HACKIT']],
      19: [['curl http://10.50.0.90/'], ['echo dXNlcj1nYXN0O3JvbGU9Z3Vlc3Q= | base64 -d'], ['curl -H "X-Auth: dXNlcj1nYXN0O3JvbGU9YXVkaXRvcg==" http://10.50.0.90/status']],
      20: [['nmap 10.60.0.0/24'], ['ssh bridge@10.60.0.10', 'Br1dg3_2026'], ['env'], ['ssh vaultadmin@10.60.0.99', 'T1efImN3tz!'], ['cat flag.txt']],
      21: [['exiftool ausweis.jpg'], ['xor -k KRYPT0 --hex zugang.xor'], ['ssh gate@10.77.0.10', 'G4t3way!77'], ['ssh ghost@10.77.0.50', 'Ph4nt0m#Root99'], ['sudo cat /root/phantom.txt']],
      22: [['grep X-Trace packet.cap'], ['echo WFJMU1ZZUj0vaW5lL2d6Yy8uaW5oeWdfeHJs | base64 -d | caesar --brute'], ['cat /var/tmp/.vault_key'], ['xor -k SH4D0W --hex cipher.xor']],
      23: [['curl http://10.80.0.10/robots.txt'], ['curl -H "X-Debug: true" http://10.80.0.10/debug/users > /tmp/h.txt'], ['john /tmp/h.txt --wordlist=dict.txt'], ['ssh svc_deploy@10.80.0.10', 'nebula99'], ['sudo tail -n 5 /root/secret.flag']],
      24: [['strings agent.bin'], ['exiftool node_map.jpg'], ['echo 285033370b1d2953677361393e471463017675017a621f6a7d | xor -k M4TR1X --hex'], ['ssh edge@10.85.0.20', 'Edg3!Pass'], ['find / -name "*.bak"'], ['cat /var/log/auth.bak | base64 -d'], ['ssh warden@10.85.99.7', 'W4rd3n_C1t4d3l!'], ['cat flag.txt']],
      25: [['crontab -l'], ['ls -l /opt/jobs'], ['echo "cat /root/flag.txt > /tmp/loot.txt" > /opt/jobs/plugin.sh'], ['cat /tmp/loot.txt']],
      26: [['nmap 10.99.0.0/24'], ['curl -H "X-Token: dXNlcj1hbm9uO3JvbGU9b3Bz" http://10.99.0.10/creds'], ['ssh relay@10.99.0.10', 'R3l4y#99'], ['exiftool /opt/assets/eclipse.png'], ['xor -k ECL1PS --hex /opt/assets/monolith.xor'], ['ssh omega@10.99.0.40', '0m3g4_V4ult!'], ['sudo find /root -name "*.txt" -exec cat {} \\;']],
    };

    for (const lang of ['de', 'en']) {
      test(`all 26 missions solvable in ${lang}`, async () => {
        I18N.set(lang);
        for (const level of LEVELS.list) {
          const steps = solutions[level.id];
          const answers = steps.flatMap(s => s.slice(1));
          const world = level.setup();
          const h = world.hosts[world.start.ip], u = world.start.user;
          const home = (h.users[u] && h.users[u].home) || ['home', u];
          const unlocked = [];
          LEVELS.list.filter(l => l.id <= level.id).forEach(l => l.commands.forEach(c => unlocked.includes(c) || unlocked.push(c)));
          const done = level.objectives.map(() => false);
          const out = [];
          const ctx = {
            world, level, unlocked,
            term: { print: t => out.push(Terminal.strip(t)), ask: async () => answers.shift(), clear() {}, history: [] },
            sessions: [{ host: h, user: u, home, cwd: home.slice() }],
            get sess() { return this.sessions[this.sessions.length - 1]; },
            emit: e => level.objectives.forEach((o, i) => { if (!done[i] && o.check(e, ctx)) done[i] = true; }),
            updatePrompt() {}, submit() {}, showHint() {}, showMission: () => '',
          };
          for (const [cmd] of steps) await Shell.execute(ctx, cmd);
          assert(done.every(Boolean), `L${level.id} (${lang}) objectives: ${JSON.stringify(done)}`);
          includes(out.join('\n'), level.flag, `L${level.id} (${lang}) flag`);
        }
        I18N.set('de');
      });
    }
  });

  /* ======================================================================
   * 6. UI & Game-Loop Tests (js/game.js)
   * ====================================================================== */
  suite('UI & Game (game.js)', () => {
    runScript(ROOT + 'js/game.js');

    const flush = () => new Promise(r => Promise.resolve().then(() => Promise.resolve().then(r)));

    test('boot, start screen, map rendering, language toggle, mission play, hints, flag & session restore', async () => {
      for (let i = 0; i < 12; i++) await flush();
      assert(!byId['start-form'].classList.contains('hidden'), 'start-form visible after boot');

      // Alias eingeben & starten
      byId['alias'].value = 'n30n';
      byId['btn-start'].click();
      assert(byId['screen-map'].classList.contains('active'), 'map screen active');
      eq(byId['p-alias'].textContent, 'n30n');
      eq(byId['p-done'].textContent, '0/26');

      // Sprache auf Englisch umschalten
      I18N.set('en');
      includes(document.title, 'hacker learning game');
      eq(byId['btn-back'].textContent, '← Missions');
      I18N.set('de');
      eq(byId['btn-back'].textContent, '← Missionen');

      // Mission 1 starten
      const firstCard = byId['map'].children[0].querySelector('.cards').children[0];
      firstCard.click();
      assert(byId['screen-game'].classList.contains('active'), 'game screen active');
      eq(byId['g-num'].textContent, '01');
      eq(byId['g-points'].textContent, '100');

      // Tipp verwenden -> -25 Punkte
      byId['btn-hint'].click();
      eq(byId['g-points'].textContent, '75');
      eq(byId['g-hintcount'].textContent, '(1/3)');

      // Befehl im Terminal eingeben
      byId['term-input'].value = 'ls';
      byId['term-input'].dispatchEvent({ type: 'keydown', key: 'Enter' });
      await flush();
      includes(byId['term-out'].innerHTML, 'willkommen.txt');

      // Zurück zur Übersicht -> Session gespeichert & Fortsetzen-Banner sichtbar
      byId['btn-back'].click();
      assert(byId['screen-map'].classList.contains('active'));
      const saved = JSON.parse(localStorage.getItem('hackit-save-v1'));
      assert(saved.sessions[1], 'session 1 persisted');
      assert(byId['map'].children[0].classList.contains('resume-bar'), 'resume-bar shown');

      // Session fortsetzen -> Terminal-Verlauf wiederhergestellt
      byId['map'].children[0].querySelector('button').click();
      includes(byId['term-out'].innerHTML, 'willkommen.txt');

      // Falsche Flag -> Modal bleibt geschlossen
      byId['flag-input'].value = 'HACKIT{falsch}';
      byId['flag-form'].dispatchEvent({ type: 'submit' });
      assert(byId['modal'].classList.contains('hidden'));

      // Richtige Flag -> Mission 1 abgeschlossen, 75 Punkte (wegen 1 Tipp), 2 Sterne
      byId['flag-input'].value = 'HACKIT{h4ll0_h4ck3r}';
      byId['flag-form'].dispatchEvent({ type: 'submit' });
      await flush(); await flush();
      assert(!byId['modal'].classList.contains('hidden'), 'success modal shown');
      includes(byId['m-points'].textContent, '+75');
      eq(JSON.parse(localStorage.getItem('hackit-save-v1')).levels[1].stars, 2);
      // Escape schließt Modal
      docListeners.keydown.forEach(fn => fn({ key: 'Escape' }));
      assert(byId['modal'].classList.contains('hidden'), 'Escape closes modal');

      // Nächste Mission starten
      byId['m-next'].click();
      eq(byId['g-num'].textContent, '02');

      // Matrix-Tick, Sprachwechsel im Spiel, Cmd-Pill-Klick, 3 Fehler-Nudge, alle Tipps verbrauchen, Write-Restore & Neustart
      globalThis._intervals.forEach(fn => fn());
      const langBtn = langBoxes[0].querySelector('button');
      if (langBtn) { langBtn.dataset.lang = 'en'; docListeners.click.forEach(fn => fn({ target: { closest: () => langBtn } })); }
      eq(byId['g-num'].textContent, '02');
      I18N.set('de');

      const codePill = byId['g-newcmds'].querySelector('code');
      if (codePill) codePill.click();

      for (const cmd of ['mission', 'badcmd1', 'badcmd2', 'badcmd3', 'echo saved > /tmp/note.txt', 'cd projekte', 'cd 2026/geheim', 'cat flag.txt']) {
        byId['term-input'].value = cmd;
        byId['term-input'].dispatchEvent({ type: 'keydown', key: 'Enter' });
        await flush(); await flush();
      }
      includes(byId['term-out'].innerHTML, 'Alle Ziele erreicht');

      // Alle 3 Tipps + 4. Aufruf („Keine weiteren Tipps")
      byId['btn-hint'].click(); byId['btn-hint'].click(); byId['btn-hint'].click();
      assert(byId['btn-hint'].disabled);
      byId['term-input'].value = 'hint';
      byId['term-input'].dispatchEvent({ type: 'keydown', key: 'Enter' });
      await flush();

      // Zurück & Session mit geschriebener Datei /tmp/note.txt wiederherstellen
      byId['btn-back'].click();
      byId['map'].children[0].querySelector('button').click();
      byId['term-input'].value = 'cat /tmp/note.txt';
      byId['term-input'].dispatchEvent({ type: 'keydown', key: 'Enter' });
      await flush();
      includes(byId['term-out'].innerHTML, 'saved');

      // Mission neu starten
      byId['btn-restart'].click();
      eq(byId['g-num'].textContent, '02');

      // Reset löscht Fortschritt
      byId['btn-back'].click();
      byId['btn-reset'].click();
      eq(byId['p-points'].textContent, '0');
      eq(byId['p-done'].textContent, '0/26');
    });
  });

  /* ---------------- Ergebnis ausgeben ---------------- */
  (async () => {
    for (const runTest of asyncQueue) await runTest();
    log(`HACKIT Test Suite: ${passed} passed, ${failed} failed`);
    if (failures.length) {
      failures.forEach(f => log(`  FAIL: ${f.label}\n    ${f.e.message}\n    ${f.e.stack || ''}`));
      if (isNode) process.exit(1);
    }
  })();
})();
