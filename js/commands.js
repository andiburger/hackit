/* HACKIT – Befehle */
const C = (c, t) => `⟦${c}|${t}⟧`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const Shell = (() => {
  const { resolve, get, pathStr, canRead, canTraverse, walk, glob } = VFS;

  /* ---------- Tokenizer ---------- */
  const OPS = ['|', ';', '&&', '>', '>>', '2>', '2>>'];
  const isOp = (t, op) => t !== null && typeof t === 'object' && (op == null || t.op === op);

  /**
   * Zerlegt eine Zeile in Wörter (Strings) und Operatoren ({ op }).
   * Unquotierte Operatoren: |  ;  &&  >  >>  2>  2>>  (ein einzelnes & bleibt ein normales Zeichen).
   */
  function lex(line) {
    const out = [];
    let cur = null, q = null;
    const flush = () => { if (cur !== null) { out.push(cur); cur = null; } };
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === q) q = null; else cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; if (cur === null) cur = ''; }
      else if (ch === '\\' && i + 1 < line.length) { cur = (cur ?? '') + line[++i]; }
      else if (/\s/.test(ch)) flush();
      else if (ch === '|') { flush(); out.push({ op: '|' }); }
      else if (ch === ';') { flush(); out.push({ op: ';' }); }
      else if (ch === '&' && line[i + 1] === '&') { flush(); out.push({ op: '&&' }); i++; }
      else if (ch === '>') {
        let op = '>';
        if (cur === '2') { cur = null; op = '2>'; }
        flush();
        if (line[i + 1] === '>') { op += '>'; i++; }
        out.push({ op });
      }
      else cur = (cur ?? '') + ch;
    }
    flush();
    return out;
  }

  /** Kompatibel zur alten API: Liste von Pipe-Segmenten (andere Operatoren als Text) */
  function tokenize(line) {
    const segs = [[]];
    for (const t of lex(line)) {
      if (isOp(t, '|')) segs.push([]);
      else segs[segs.length - 1].push(isOp(t) ? t.op : t);
    }
    return segs;
  }

  /* ---------- Hilfsfunktionen ---------- */
  function parseFlags(args, withValue = []) {
    const flags = {}, rest = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.startsWith('--')) {
        const [k, v] = a.slice(2).split('=');
        flags[k] = v ?? true;
      } else if (a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) {
        const letters = a.slice(1);
        if (withValue.includes(letters)) { flags[letters] = args[++i]; continue; }
        for (const l of letters) flags[l] = true;
      } else rest.push(a);
    }
    return { flags, rest };
  }

  class CmdError extends Error {}
  const fail = msg => { throw new CmdError(msg); };

  const E = {
    denied: () => tr('Keine Berechtigung (Permission denied)', 'Permission denied'),
    notFound: () => tr('Datei oder Verzeichnis nicht gefunden', 'No such file or directory'),
    isDir: () => tr('Ist ein Verzeichnis', 'Is a directory'),
    notDir: () => tr('Ist kein Verzeichnis', 'Not a directory'),
    usage: () => tr('Verwendung', 'Usage'),
  };

  function node(ctx, p, cmd) {
    const s = ctx.sess, fs = s.host.fs;
    const parts = resolve(s, p);
    if (!canTraverse(s, fs, parts)) fail(`${cmd}: ${p}: ${E.denied()}`);
    const n = get(fs, parts);
    if (!n) fail(`${cmd}: ${p}: ${E.notFound()}`);
    return { n, parts };
  }

  function readFile(ctx, p, cmd) {
    const { n, parts } = node(ctx, p, cmd);
    if (n.type === 'dir') fail(`${cmd}: ${p}: ${E.isDir()}`);
    if (!canRead(ctx.sess, n)) fail(`${cmd}: ${p}: ${E.denied()}`);
    ctx.emit({ type: 'read', path: pathStr(parts), host: ctx.sess.host.name, user: ctx.sess.user, node: n });
    return n;
  }

  function inputText(ctx, files, stdin, cmd) {
    if (files.length) return files.map(f => readFile(ctx, f, cmd).content).join('\n');
    if (stdin != null) return stdin;
    fail(tr(`${cmd}: keine Eingabe. Gib eine Datei an oder nutze eine Pipe (|).`,
      `${cmd}: no input. Specify a file or use a pipe (|).`));
  }

  function garble(s) {
    const g = '░▒▓█■□▪▫◊¤§¶';
    return s.replace(/[\x00-\x08\x0b-\x1f\x7f-\xff]/g, ch => g[ch.charCodeAt(0) % g.length]);
  }

  function b64encode(s) { return btoa(unescape(encodeURIComponent(s))); }
  function b64decode(s) { return decodeURIComponent(escape(atob(s.replace(/\s+/g, '')))); }

  function caesar(s, n) {
    n = ((n % 26) + 26) % 26;
    return s.replace(/[a-z]/gi, ch => {
      const base = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode((ch.charCodeAt(0) - base + n) % 26 + base);
    });
  }

  function findHost(ctx, target) {
    const w = ctx.world;
    if (w.hosts[target]) return w.hosts[target];
    return Object.values(w.hosts).find(h => h.name === target) || null;
  }

  function pushSession(ctx, host, user) {
    const u = host.users[user] || {};
    const home = user === 'root' ? ['root'] : (u.home || ['home', user]);
    const fsHome = get(host.fs, home) ? home : [];
    ctx.sessions.push({ host, user, home: fsHome, cwd: fsHome.slice() });
    ctx.updatePrompt();
    ctx.emit({ type: 'login', host: host.name, ip: host.ip, user });
  }

  /** Rechte-String für ls -l, z.B. -rw-r--r--, -rw-rw-rw- (writable), -rwsr-xr-x (suid) */
  function permString(c) {
    if (c.type === 'dir') {
      if (c.private) return 'drwx------';
      return c.writable ? 'drwxrwxrwt' : 'drwxr-xr-x';
    }
    const x = c.exec ? (c.suid ? 's' : 'x') : (c.suid ? 'S' : '-');
    const owner = 'rw' + x;
    if (c.private) return '-' + owner + (c.writable ? '-w--w-' : '------');
    const go = 'r' + (c.writable ? 'w' : '-') + (c.exec ? 'x' : '-');
    return '-' + owner + go + go;
  }

  /* ---------- Befehle ---------- */
  const cmds = {};
  /**
   * Registriert einen Befehl.
   *   def(name, desc, fn, usage = '')
   *     name  : string – Befehlsname
   *     desc  : string | () => string – Beschreibung für `help`; als Funktion wird sie bei jedem
   *             Aufruf ausgewertet, z.B. () => tr('Deutsch', 'English'), damit Sprachwechsel live wirkt
   *     fn    : async (ctx, args: string[], stdin: string|null) => string – Ausgabe (darf C()-Farben enthalten);
   *             Fehler per Shell.fail(msg) werfen
   *     usage : optionaler Text
   *   describe(name|cmd) liefert die aktuelle Beschreibung als String.
   */
  const def = (name, desc, fn, usage = '') => { cmds[name] = { name, desc, fn, usage }; };
  const describe = c => {
    if (typeof c === 'string') c = cmds[c];
    if (!c) return '';
    return typeof c.desc === 'function' ? c.desc() : (c.desc || '');
  };

  def('help', () => tr('Zeigt alle verfügbaren Befehle', 'Shows all available commands'), async (ctx) => {
    const lines = [C('w', tr('Verfügbare Befehle:', 'Available commands:')), ''];
    const newOnes = new Set(((ctx.level && ctx.level.newCommands) || []).map(c => c.cmd.split(' ')[0]));
    for (const name of ctx.unlocked) {
      const c = cmds[name];
      if (!c) continue;
      const tag = newOnes.has(name) ? ' ' + C('m', tr('[NEU]', '[NEW]')) : '';
      lines.push(`  ${C('g', name.padEnd(10))} ${describe(c)}${tag}`);
    }
    lines.push('', C('d', tr(
      'Tipp: ↑/↓ = Befehlsverlauf · TAB = Autovervollständigen · Ctrl+L = Bildschirm leeren',
      'Tip: ↑/↓ = command history · TAB = autocomplete · Ctrl+L = clear screen')));
    return lines.join('\n');
  });

  def('mission', () => tr('Zeigt den Auftrag erneut an', 'Shows the mission briefing again'), async (ctx) => ctx.showMission());
  def('hint', () => tr('Gibt dir einen Tipp, wenn du feststeckst', 'Gives you a hint if you are stuck'), async (ctx) => { ctx.showHint(); return ''; });
  def('clear', () => tr('Leert den Bildschirm', 'Clears the screen'), async (ctx) => { ctx.term.clear(); return ''; });

  def('submit', () => tr('Reicht eine gefundene Flag ein', 'Submits a flag you found'), async (ctx, args) => {
    if (!args.length) fail(`submit: ${E.usage()}: submit HACKIT{...}`);
    ctx.submit(args.join(' '));
    return '';
  }, 'submit FLAG');

  def('ls', () => tr('Listet Dateien auf (-a: auch versteckte, -l: Details)', 'Lists files (-a: include hidden, -l: details)'), async (ctx, args) => {
    const { flags, rest } = parseFlags(args);
    const target = rest[0] || '.';
    const { n, parts } = node(ctx, target, 'ls');
    const fmt = (name, c) => {
      if (!c) return C('b', name);
      if (c.type === 'dir') return C('b', name + '/');
      if (c.suid && c.exec) return C('r', name + '*');
      if (c.exec) return C('g', name + '*');
      return name;
    };
    const long = (name, c) => {
      const size = c.type === 'dir' ? 4096 : (c.content || '').length;
      return `${permString(c)}  ${(c.owner || 'root').padEnd(9)} ${String(size).padStart(6)}  ${fmt(name, c)}`;
    };
    if (n.type === 'file') return flags.l ? long(target, n) : target;
    if (!canRead(ctx.sess, n)) fail(tr(`ls: Kann Verzeichnis '${target}' nicht öffnen: Keine Berechtigung`,
      `ls: cannot open directory '${target}': Permission denied`));
    ctx.emit({ type: 'ls', path: pathStr(parts), all: !!flags.a, long: !!flags.l, host: ctx.sess.host.name });
    let names = Object.keys(n.children).sort();
    if (flags.a) names = ['.', '..', ...names];
    else names = names.filter(x => !x.startsWith('.'));
    if (!names.length) return '';
    if (flags.l) {
      return names.map(name => long(name, name === '.' || name === '..' ? n : n.children[name])).join('\n');
    }
    return names.map(name => fmt(name, n.children[name])).join('   ');
  });

  def('cd', () => tr('Wechselt das Verzeichnis (cd .. = eine Ebene hoch)', 'Changes directory (cd .. = one level up)'), async (ctx, args) => {
    const s = ctx.sess;
    const target = args[0] || '~';
    const { n, parts } = node(ctx, target, 'cd');
    if (n.type !== 'dir') fail(`cd: ${target}: ${E.notDir()}`);
    if (!canRead(s, n)) fail(`cd: ${target}: ${E.denied()}`);
    s.cwd = parts;
    ctx.updatePrompt();
    ctx.emit({ type: 'cd', path: pathStr(parts), host: s.host.name });
    return '';
  });

  def('pwd', () => tr('Zeigt das aktuelle Verzeichnis', 'Prints the current directory'), async (ctx) => pathStr(ctx.sess.cwd));

  def('cat', () => tr('Zeigt den Inhalt einer Datei', 'Shows the contents of a file'), async (ctx, args, stdin) => {
    if (!args.length) { if (stdin != null) return stdin; fail(`cat: ${E.usage()}: cat ${tr('DATEI', 'FILE')}`); }
    return args.map(f => {
      const n = readFile(ctx, f, 'cat');
      return n.binary ? garble(n.content) : n.content;
    }).join('\n');
  });

  def('echo', () => tr('Gibt Text aus', 'Prints text'), async (ctx, args) => args.join(' '));
  def('whoami', () => tr('Zeigt deinen Benutzernamen', 'Shows your user name'), async (ctx) => ctx.sess.user);
  def('hostname', () => tr('Zeigt den Namen des Rechners', 'Shows the name of the machine'), async (ctx) => ctx.sess.host.name);
  def('id', () => tr('Zeigt Benutzer- und Gruppen-ID', 'Shows user and group ID'), async (ctx) => {
    const u = ctx.sess.user;
    return u === 'root' ? 'uid=0(root) gid=0(root) groups=0(root)' : `uid=1000(${u}) gid=1000(${u}) groups=1000(${u})`;
  });

  def('history', () => tr('Zeigt den Befehlsverlauf', 'Shows the command history'), async (ctx) =>
    ctx.term.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join('\n'));

  def('head', () => tr('Zeigt die ersten Zeilen (-n ANZAHL)', 'Shows the first lines (-n COUNT)'), async (ctx, args, stdin) => {
    const { flags, rest } = parseFlags(args, ['n']);
    const n = parseInt(flags.n || 10, 10);
    return inputText(ctx, rest, stdin, 'head').split('\n').slice(0, n).join('\n');
  });

  def('tail', () => tr('Zeigt die letzten Zeilen (-n ANZAHL)', 'Shows the last lines (-n COUNT)'), async (ctx, args, stdin) => {
    const { flags, rest } = parseFlags(args, ['n']);
    const n = parseInt(flags.n || 10, 10);
    return inputText(ctx, rest, stdin, 'tail').split('\n').slice(-n).join('\n');
  });

  def('wc', () => tr('Zählt Zeilen (-l)', 'Counts lines (-l)'), async (ctx, args, stdin) => {
    const { rest } = parseFlags(args);
    return String(inputText(ctx, rest, stdin, 'wc').split('\n').length);
  });

  def('grep', () => tr('Durchsucht Text nach einem Muster (-i, -r, -n, -v)', 'Searches text for a pattern (-i, -r, -n, -v)'), async (ctx, args, stdin) => {
    const { flags, rest } = parseFlags(args);
    const pattern = rest.shift();
    if (pattern == null) fail(`grep: ${E.usage()}: grep [-i] [-r] ${tr('MUSTER [DATEI]', 'PATTERN [FILE]')}`);
    let re;
    try { re = new RegExp(pattern, flags.i ? 'gi' : 'g'); }
    catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags.i ? 'gi' : 'g'); }
    const sources = [];
    if (!rest.length) {
      if (stdin == null) fail(tr('grep: keine Datei angegeben', 'grep: no file specified'));
      sources.push({ name: null, text: stdin });
    } else {
      for (const f of rest) {
        const { n, parts } = node(ctx, f, 'grep');
        if (n.type === 'dir') {
          if (!flags.r) { sources.push({ err: tr(`grep: ${f}: Ist ein Verzeichnis (nutze -r)`, `grep: ${f}: Is a directory (use -r)`) }); continue; }
          walk(n, parts, (c, p) => {
            if (c.type === 'file' && canRead(ctx.sess, c) && !c.binary) sources.push({ name: pathStr(p), text: c.content });
          });
        } else {
          sources.push({ name: f, text: readFile(ctx, f, 'grep').content });
        }
      }
    }
    const multi = sources.filter(s => !s.err).length > 1 || flags.r;
    const out = [];
    for (const s of sources) {
      if (s.err) { out.push(C('r', s.err)); continue; }
      s.text.split('\n').forEach((line, i) => {
        re.lastIndex = 0;
        const hit = re.test(line);
        if (hit === !!flags.v) return;
        re.lastIndex = 0;
        let l = flags.v ? line : line.replace(re, m => C('hl', m));
        if (flags.n) l = C('g', i + 1 + ':') + l;
        if (multi && s.name) l = C('m', s.name + ':') + l;
        out.push(l);
      });
    }
    ctx.emit({ type: 'grep', pattern, found: out.length > 0 });
    return out.join('\n');
  });

  def('find', () => tr('Sucht Dateien (find PFAD -name "MUSTER")', 'Finds files (find PATH -name "PATTERN")'), async (ctx, args) => {
    let start = '.', name = null, type = null, exec = null, perm = null;
    const a = args.slice();
    if (a[0] && !a[0].startsWith('-')) start = a.shift();
    while (a.length) {
      const t = a.shift();
      if (t === '-name' || t === '-iname') name = { re: glob(a.shift() || '*'), i: t === '-iname' };
      else if (t === '-type') type = a.shift();
      else if (t === '-perm') perm = a.shift() || '';
      else if (t === '-writable') perm = 'w';
      else if (t === '-exec') {
        exec = [];
        while (a.length && a[0] !== ';' && a[0] !== '+') exec.push(a.shift());
        if (!a.length) fail(tr("find: Fehlendes Argument für '-exec' (beende mit \\;)", "find: missing argument to '-exec' (end it with \\;)"));
        a.shift();
      } else fail(tr(`find: Unbekannte Option '${t}'`, `find: unknown predicate '${t}'`));
    }
    const { n, parts } = node(ctx, start, 'find');
    const out = [], matches = [];
    const denied = new Set();
    const rec = (nd, p) => {
      const ps = start === '.' ? '.' + (p.length > parts.length ? '/' + p.slice(parts.length).join('/') : '') : pathStr(p);
      let ok = true;
      if (name) {
        const base = p[p.length - 1] || '/';
        ok = name.i ? name.re.test(base.toLowerCase()) || new RegExp(name.re.source, 'i').test(base) : name.re.test(base);
      }
      if (type === 'f' && nd.type !== 'file') ok = false;
      if (type === 'd' && nd.type !== 'dir') ok = false;
      if (perm != null) {
        if (perm === 'w') { if (!(nd.writable || nd.owner === ctx.sess.user || ctx.sess.user === 'root')) ok = false; }
        else if (/4000|u\+s/.test(perm)) { if (!nd.suid) ok = false; }
        else if (/o\+w|0*2$|777|666/.test(perm)) { if (!nd.writable) ok = false; }
      }
      if (ok) matches.push({ nd, ps, p });
      if (nd.type === 'dir') {
        if (!canRead(ctx.sess, nd)) {
          if (!denied.has(ps)) { out.push(C('r', tr(`find: '${ps}': Keine Berechtigung`, `find: '${ps}': Permission denied`))); denied.add(ps); }
          return;
        }
        for (const k of Object.keys(nd.children).sort()) rec(nd.children[k], [...p, k]);
      }
    };
    rec(n, parts);
    ctx.emit({ type: 'find', count: matches.length, name: name && name.re.source, perm });
    if (!exec) return [...matches.map(m => m.ps), ...out].join('\n');

    // -exec
    const results = [];
    const bin = exec[0].split('/').pop();
    if (['sh', 'bash'].includes(bin)) {
      results.push(C('d', tr('# Neue Shell wird gestartet ...', '# Spawning a new shell ...')));
      pushSession(ctx, ctx.sess.host, ctx.sess.user);
      return results.join('\n');
    }
    for (const m of matches) {
      if (exec.join(' ').includes('{}') && m.nd.type === 'dir') continue;
      const cmdArgs = exec.slice(1).map(x => x.replace('{}', pathStr(m.p)));
      try { results.push(await run(ctx, bin, cmdArgs, null)); }
      catch (e) { results.push(C('r', e.message)); }
      if (results.length > 50) break;
    }
    return [...results.filter(Boolean), ...out].join('\n');
  });

  def('base64', () => tr('Kodiert/dekodiert Base64 (-d = dekodieren)', 'Encodes/decodes Base64 (-d = decode)'), async (ctx, args, stdin) => {
    const { flags, rest } = parseFlags(args);
    const text = inputText(ctx, rest, stdin, 'base64').trim();
    if (flags.d || flags.decode) {
      try {
        const r = b64decode(text);
        ctx.emit({ type: 'decode', algo: 'base64', result: r });
        return r;
      } catch { fail(tr('base64: ungültige Eingabe', 'base64: invalid input')); }
    }
    return b64encode(text);
  });

  def('caesar', () => tr('Caesar-Verschiebung (-s N oder --brute)', 'Caesar shift (-s N or --brute)'), async (ctx, args, stdin) => {
    const { flags, rest } = parseFlags(args, ['s']);
    const text = inputText(ctx, rest, stdin, 'caesar');
    if (flags.brute || flags.b) {
      const out = [];
      for (let i = 1; i < 26; i++) out.push(`${C('y', 'ROT' + String(i).padStart(2, '0'))}: ${caesar(text, i)}`);
      ctx.emit({ type: 'decode', algo: 'caesar', result: out.join('\n') });
      return out.join('\n');
    }
    if (flags.s == null) fail(tr('caesar: Verwendung: caesar -s VERSCHIEBUNG DATEI   oder   caesar --brute DATEI',
      'caesar: Usage: caesar -s SHIFT FILE   or   caesar --brute FILE'));
    const r = caesar(text, parseInt(flags.s, 10));
    ctx.emit({ type: 'decode', algo: 'caesar', result: r });
    return r;
  });

  def('strings', () => tr('Zeigt lesbare Texte in Binärdateien', 'Shows readable text in binary files'), async (ctx, args) => {
    if (!args.length) fail(`strings: ${E.usage()}: strings ${tr('DATEI', 'FILE')}`);
    const n = readFile(ctx, args[0], 'strings');
    const found = n.content.match(/[\x20-\x7e]{4,}/g) || [];
    ctx.emit({ type: 'strings', file: args[0] });
    return found.join('\n');
  });

  def('ifconfig', () => tr('Zeigt deine Netzwerk-Konfiguration', 'Shows your network configuration'), async (ctx) => {
    const h = ctx.sess.host;
    return `${C('w', 'eth0')}: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet ${C('g', h.ip)}  netmask 255.255.255.0  broadcast ${h.ip.replace(/\d+$/, '255')}
        ether 02:42:ac:11:00:${(h.ip.split('.').pop() % 256).toString(16).padStart(2, '0')}

${C('w', 'lo')}: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0`;
  });

  def('nmap', () => tr('Scannt Rechner/Netze nach offenen Ports', 'Scans hosts/networks for open ports'), async (ctx, args) => {
    const { rest } = parseFlags(args);
    const target = rest[0];
    if (!target) fail(tr('nmap: Verwendung: nmap ZIEL   (z.B. nmap 10.10.0.0/24 oder nmap 10.10.0.23)',
      'nmap: Usage: nmap TARGET   (e.g. nmap 10.10.0.0/24 or nmap 10.10.0.23)'));
    let hosts;
    if (target.includes('/') || target.includes('*')) {
      const prefix = target.split('/')[0].split('.').slice(0, 3).join('.') + '.';
      hosts = Object.values(ctx.world.hosts).filter(h => h.ip.startsWith(prefix));
    } else {
      const h = findHost(ctx, target);
      hosts = h ? [h] : [];
    }
    const t = ctx.term;
    t.print(`Starting Nmap 7.94 ( https://nmap.org ) at ${new Date().toLocaleString(tr('de-DE', 'en-US'))}`);
    t.print(C('d', tr(`Scanne ${target} ...`, `Scanning ${target} ...`)));
    await sleep(target.includes('/') ? 1400 : 700);
    const out = [];
    hosts.sort((a, b) => +a.ip.split('.').pop() - +b.ip.split('.').pop());
    for (const h of hosts) {
      out.push('', `Nmap scan report for ${C('w', h.name)} (${C('c', h.ip)})`, `Host is up (0.00${Math.floor(Math.random() * 90 + 10)}s latency).`);
      if (h === ctx.sessions[0].host) { out.push(C('d', tr('Das bist du selbst.', "That's you."))); }
      if (h.services.length) {
        out.push(C('w', 'PORT      STATE  SERVICE  VERSION'));
        for (const s of h.services) out.push(`${(s.port + '/tcp').padEnd(9)} ${C('g', 'open')}   ${s.name.padEnd(8)} ${s.version || ''}`);
      } else out.push(`All 1000 scanned ports on ${h.name} (${h.ip}) are closed`);
    }
    const n = hosts.length;
    out.push('', `Nmap done: ${target.includes('/') ? 256 : 1} IP address(es) (${n} host${n === 1 ? '' : 's'} up) scanned`);
    ctx.emit({ type: 'nmap', target, hosts: hosts.map(h => h.ip) });
    return out.join('\n');
  });

  def('ssh', () => tr('Verbindet dich mit einem anderen Rechner (ssh user@ip)', 'Connects you to another machine (ssh user@ip)'), async (ctx, args) => {
    const { rest } = parseFlags(args, ['l', 'p']);
    if (!rest[0]) fail(tr('ssh: Verwendung: ssh BENUTZER@ZIEL', 'ssh: Usage: ssh USER@TARGET'));
    let [user, target] = rest[0].includes('@') ? rest[0].split('@') : [ctx.sess.user, rest[0]];
    const h = findHost(ctx, target);
    if (!h) fail(`ssh: Could not resolve hostname ${target}: Name or service not known`);
    if (h.onlyFrom && !h.onlyFrom.includes(ctx.sess.host.ip)) {
      fail(`ssh: connect to host ${h.ip} port 22: Network is unreachable (${tr('nur aus internem Netz erreichbar', 'only reachable from internal network')})`);
    }
    if (!h.services.some(s => s.name === 'ssh')) fail(`ssh: connect to host ${target} port 22: Connection refused`);
    const t = ctx.term;
    for (let i = 0; i < 3; i++) {
      const pw = await t.ask(`${user}@${h.ip}'s password: `, true);
      await sleep(350);
      const u = h.users[user];
      if (u && u.password != null && u.password === pw && u.ssh !== false) {
        t.print(C('d', `Welcome to ${h.name} (Ubuntu 22.04 LTS)`));
        if (h.motd) t.print(typeof h.motd === 'function' ? h.motd() : h.motd);
        pushSession(ctx, h, user);
        return '';
      }
      t.print('Permission denied, please try again.');
      ctx.emit({ type: 'loginfail', host: h.name, user });
    }
    fail(`${user}@${h.ip}: Permission denied (publickey,password).`);
  });

  def('su', () => tr('Wechselt den Benutzer (su BENUTZER)', 'Switches user (su USER)'), async (ctx, args) => {
    const user = args.filter(a => a !== '-')[0] || 'root';
    const h = ctx.sess.host;
    const u = h.users[user];
    if (!u) fail(tr(`su: Benutzer ${user} existiert nicht`, `su: user ${user} does not exist`));
    if (ctx.sess.user !== 'root') {
      const pw = await ctx.term.ask(tr('Passwort: ', 'Password: '), true);
      await sleep(400);
      if (u.password == null || pw !== u.password) {
        ctx.emit({ type: 'loginfail', host: h.name, user });
        fail(tr('su: Authentifizierung fehlgeschlagen', 'su: Authentication failure'));
      }
    }
    pushSession(ctx, h, user);
    return '';
  });

  def('exit', () => tr('Beendet die aktuelle Sitzung (ssh/su)', 'Ends the current session (ssh/su)'), async (ctx) => {
    if (ctx.sessions.length > 1) {
      const old = ctx.sessions.pop();
      ctx.updatePrompt();
      const now = ctx.sess;
      return old.host === now.host ? 'logout' : `Connection to ${old.host.ip} closed.`;
    }
    return C('d', tr('Du bist auf deinem eigenen Rechner. Zurück zur Übersicht geht es oben links mit „← Missionen".',
      'You are on your own machine. Use "← Missions" at the top left to return to the overview.'));
  });
  cmds.logout = cmds.exit;

  def('sudo', () => tr('Führt einen Befehl als root aus (sudo -l: Rechte anzeigen)', 'Runs a command as root (sudo -l: list privileges)'), async (ctx, args) => {
    const s = ctx.sess, h = s.host;
    const allowed = h.sudo[s.user] || [];
    if (args[0] === '-l') {
      ctx.emit({ type: 'sudo-l' });
      if (!allowed.length) return `Sorry, user ${s.user} may not run sudo on ${h.name}.`;
      return `Matching Defaults entries for ${s.user} on ${h.name}:\n    env_reset, secure_path=/usr/local/sbin\\:/usr/bin\\:/bin\n\nUser ${s.user} may run the following commands on ${h.name}:\n` +
        allowed.map(c => `    (root) NOPASSWD: ${C('y', '/usr/bin/' + c)}`).join('\n');
    }
    if (!args.length) fail(tr('sudo: Verwendung: sudo BEFEHL   oder   sudo -l', 'sudo: Usage: sudo COMMAND   or   sudo -l'));
    const cmd = args[0].split('/').pop();
    if (s.user !== 'root' && !allowed.includes(cmd)) {
      if (!allowed.length) fail(`${s.user} is not in the sudoers file. This incident will be reported.`);
      fail(`Sorry, user ${s.user} is not allowed to execute '/usr/bin/${cmd}' as root on ${h.name}.`);
    }
    const prev = s.user;
    s.user = 'root';
    try {
      ctx.emit({ type: 'sudo', cmd });
      return await run(ctx, cmd, args.slice(1), null);
    } finally {
      // nur zurücksetzen, wenn keine neue Root-Shell gestartet wurde
      s.user = prev;
      if (ctx.sess !== s && ctx.sess.host === h && ctx.sess.user === 'root') ctx.updatePrompt();
    }
  });

  def('curl', () => tr('Ruft eine Webseite ab (curl http://ip/pfad)', 'Fetches a web page (curl http://ip/path)'), async (ctx, args) => {
    const { flags, rest } = parseFlags(args, ['X', 'd', 'H']);
    let url = rest[0];
    if (!url) fail(`curl: ${E.usage()}: curl URL`);
    if (!/^https?:\/\//.test(url)) url = 'http://' + url;
    const m = url.match(/^https?:\/\/([^/:?]+)(?::(\d+))?([^?]*)(?:\?(.*))?$/);
    if (!m) fail('curl: (3) URL using bad/illegal format');
    const [, hostName, port, path = '', query = ''] = m;
    const h = findHost(ctx, hostName);
    if (!h) fail(`curl: (6) Could not resolve host: ${hostName}`);
    if (h.onlyFrom && !h.onlyFrom.includes(ctx.sess.host.ip)) {
      fail(`curl: (7) Failed to connect to ${hostName}: Network is unreachable`);
    }
    const svc = h.services.find(s => s.web && (!port || s.port === +port));
    if (!svc) fail(`curl: (7) Failed to connect to ${hostName} port ${port || 80}: Connection refused`);
    const params = {};
    for (const kv of query.split('&').filter(Boolean)) {
      const eq = kv.indexOf('=');
      const k = eq < 0 ? kv : kv.slice(0, eq), v = eq < 0 ? '' : kv.slice(eq + 1);
      try { params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
      catch { params[k] = v; }
    }
    await sleep(250);
    const req = { method: (flags.X || 'GET').toUpperCase(), data: flags.d || '', header: flags.H || '' };
    ctx.emit({ type: 'curl', host: h.name, path: path || '/', params, req });
    return svc.web(path || '/', params, ctx, req);
  });

  def('john', () => tr('Knackt Passwort-Hashes (john DATEI --wordlist=LISTE)', 'Cracks password hashes (john FILE --wordlist=LIST)'), async (ctx, args) => {
    const { flags, rest } = parseFlags(args);
    if (!rest[0]) fail(tr('john: Verwendung: john HASHDATEI --wordlist=WORTLISTE', 'john: Usage: john HASHFILE --wordlist=WORDLIST'));
    const hashes = readFile(ctx, rest[0], 'john').content.split('\n').filter(l => l.includes(':'));
    if (!flags.wordlist || flags.wordlist === true) fail(tr('john: Bitte gib eine Wortliste an, z.B. --wordlist=passwords.txt',
      'john: Please specify a wordlist, e.g. --wordlist=passwords.txt'));
    const words = new Set(readFile(ctx, flags.wordlist, 'john').content.split('\n').map(w => w.trim()));
    const t = ctx.term;
    t.print(`Using default input encoding: UTF-8`);
    t.print(`Loaded ${hashes.length} password hashes with no different salts (Raw-MD5 [MD5 256/256 AVX2 8x3])`);
    t.print(C('d', 'Press q or Ctrl-C to abort, almost any other key for status'));
    await sleep(600);
    const db = ctx.world.hashdb || {};
    let cracked = 0;
    for (const line of hashes) {
      const [user, hash] = line.split(':');
      await sleep(450);
      const plain = db[hash.trim()];
      if (plain != null && words.has(plain)) {
        t.print(`${C('g', plain.padEnd(18))} (${user})`);
        cracked++;
        ctx.emit({ type: 'crack', user, plain });
      }
    }
    await sleep(300);
    return `${cracked}g 0:00:00:0${hashes.length} DONE (${new Date().toISOString().slice(0, 10)}) ${cracked}/${hashes.length} ${tr('geknackt', 'cracked')}\n` +
      (cracked < hashes.length ? C('d', tr('Nicht alle Passwörter standen in der Wortliste.', 'Not all passwords were in the wordlist.')) : '') +
      '\nSession completed.';
  });

  /* ---------- Ausführung ---------- */
  async function run(ctx, name, args, stdin) {
    // Ausführbare Datei
    if (name.includes('/')) {
      const { n } = node(ctx, name, 'bash');
      if (n.type === 'dir') fail(`bash: ${name}: ${E.isDir()}`);
      if (!n.exec) fail(tr(`bash: ${name}: Keine Berechtigung (nicht ausführbar)`, `bash: ${name}: Permission denied (not executable)`));
      if (!n.run) return '';
      ctx.emit({ type: 'exec', file: name });
      return await n.run(ctx, args, stdin);
    }
    const c = cmds[name];
    if (!c) {
      ctx.emit({ type: 'error', kind: 'notfound' });
      fail(tr(`${name}: Befehl nicht gefunden. Tippe ${C('g', 'help')} für eine Liste.`,
        `${name}: command not found. Type ${C('g', 'help')} for a list.`));
    }
    if (!ctx.unlocked.includes(name) && !['logout', 'history', 'id', 'wc', 'echo', 'mission', 'mkdir', 'touch', 'rm', 'cp'].includes(name)) {
      ctx.emit({ type: 'error', kind: 'locked' });
      fail(tr(`${name}: 🔒 Dieses Werkzeug lernst du in einer späteren Mission kennen.`,
        `${name}: 🔒 You will learn this tool in a later mission.`));
    }
    ctx.emit({ type: 'cmd', name, args });
    return await c.fn(ctx, args, stdin);
  }

  const syntaxError = tok => fail(tr(`bash: Syntaxfehler beim unerwarteten Symbol „${tok}"`,
    `bash: syntax error near unexpected token \`${tok}'`));

  /**
   * Prüft ein Umleitungsziel und liefert eine Schreibfunktion (oder wirft CmdError).
   * Regeln: Elternordner muss existieren und betretbar sein. Erlaubt, wenn root, oder die
   * vorhandene Datei writable/eigene ist, oder (neue Datei) der Elternordner writable/eigener ist.
   */
  function prepareWrite(ctx, path, append) {
    const s = ctx.sess, host = s.host, fs = host.fs, user = s.user;
    if (path === '/dev/null') return () => {};
    const parts = resolve(s, path);
    if (!parts.length) fail(`bash: ${path}: ${E.isDir()}`);
    const name = parts[parts.length - 1];
    const parent = get(fs, parts.slice(0, -1));
    if (!parent) fail(`bash: ${path}: ${E.notFound()}`);
    if (parent.type !== 'dir') fail(`bash: ${path}: ${E.notDir()}`);
    if (!canTraverse(s, fs, parts)) fail(`bash: ${path}: ${E.denied()}`);
    const existing = parent.children[name];
    if (existing && existing.type === 'dir') fail(`bash: ${path}: ${E.isDir()}`);
    const ok = user === 'root' || (existing
      ? (!!existing.writable || existing.owner === user)
      : (!!parent.writable || parent.owner === user));
    if (!ok) fail(`bash: ${path}: ${E.denied()}`);
    return content => {
      let n = parent.children[name];
      if (n && n.type === 'file') {
        n.content = append && n.content ? n.content + '\n' + content : content;
      } else {
        n = { type: 'file', content, owner: user };
        parent.children[name] = n;
      }
      ctx.emit({ type: 'write', path: pathStr(parts), host: host.name, user, node: n, append: !!append });
    };
  }

  /** Führt eine Pipeline (Tokens ohne ; und &&) aus. Gibt true bei Erfolg zurück. */
  async function runPipeline(ctx, toks) {
    // in Segmente aufteilen
    const segs = [[]];
    for (const t of toks) {
      if (isOp(t, '|')) segs.push([]);
      else segs[segs.length - 1].push(t);
    }
    // Umleitungen extrahieren
    let redirect = null, quietErr = false;
    const parsed = segs.map((seg, si) => {
      const words = [];
      for (let i = 0; i < seg.length; i++) {
        const t = seg[i];
        if (!isOp(t)) { words.push(t); continue; }
        const target = seg[i + 1];
        if (target == null || isOp(target)) syntaxError(target ? target.op : 'newline');
        i++;
        if (t.op === '2>' || t.op === '2>>') { quietErr = target === '/dev/null'; continue; }
        if (si !== segs.length - 1) fail(tr('bash: Umleitung (>) ist nur am Ende der Pipeline erlaubt',
          'bash: redirection (>) is only allowed at the end of the pipeline'));
        redirect = { path: target, append: t.op === '>>' };
      }
      return words;
    });
    parsed.forEach((w, i) => { if (!w.length && !(i === parsed.length - 1 && redirect && parsed.length === 1)) syntaxError('|'); });

    const write = redirect ? prepareWrite(ctx, redirect.path, redirect.append) : null;
    let data = null, out = '';
    for (const words of parsed) {
      if (!words.length) { out = ''; break; } // nur "> datei": leere Datei anlegen
      out = await run(ctx, words[0], words.slice(1), data);
      data = Terminal.strip(out ?? '');
    }
    if (quietErr && out) out = out.split('\n').filter(l => !l.startsWith('⟦r|')).join('\n');
    if (write) write(Terminal.strip(out ?? ''));
    else if (out) ctx.term.print(out);
    return true;
  }

  async function execute(ctx, line) {
    let toks;
    try { toks = lex(line.trim()); } catch (e) { toks = []; }
    if (!toks.length) return;
    // Auf oberster Ebene bei ; und && trennen
    const chain = [{ conn: null, toks: [] }];
    for (const t of toks) {
      if (isOp(t, ';') || isOp(t, '&&')) chain.push({ conn: t.op, toks: [] });
      else chain[chain.length - 1].toks.push(t);
    }
    // Syntax prüfen: leere Glieder nur am Ende nach ; erlaubt
    for (let i = 0; i < chain.length; i++) {
      const g = chain[i];
      if (g.toks.length) continue;
      const isLast = i === chain.length - 1;
      if (isLast && g.conn === ';' && i > 0) continue;
      const tok = i + 1 < chain.length ? chain[i + 1].conn : (g.conn || ';');
      ctx.term.print(C('r', tr(`bash: Syntaxfehler beim unerwarteten Symbol „${tok}"`, `bash: syntax error near unexpected token \`${tok}'`)));
      ctx.emit({ type: 'error', kind: 'syntax' });
      return;
    }
    let ok = true;
    for (const g of chain) {
      if (!g.toks.length) continue;
      if (g.conn === '&&' && !ok) continue;
      try {
        ok = await runPipeline(ctx, g.toks);
      } catch (e) {
        ok = false;
        if (e instanceof CmdError) { ctx.term.print(C('r', e.message)); ctx.emit({ type: 'error', kind: 'cmd' }); }
        else { console.error(e); ctx.term.print(C('r', tr('Interner Fehler: ', 'Internal error: ') + e.message)); }
      }
    }
  }

  /* ---------- Autovervollständigung ---------- */
  function complete(ctx, value) {
    const parts = value.split(/\s+/);
    const last = parts[parts.length - 1];
    const prev = parts[parts.length - 2];
    let options;
    if (parts.length === 1 || ['|', ';', '&&'].includes(prev)) {
      options = ctx.unlocked.filter(c => c.startsWith(last));
    } else {
      const slash = last.lastIndexOf('/');
      const dirPart = slash >= 0 ? last.slice(0, slash + 1) : '';
      const base = slash >= 0 ? last.slice(slash + 1) : last;
      const s = ctx.sess;
      const dir = get(s.host.fs, resolve(s, dirPart || '.'));
      if (!dir || dir.type !== 'dir' || !canRead(s, dir)) return null;
      options = Object.keys(dir.children)
        .filter(k => k.startsWith(base) && (base.startsWith('.') || !k.startsWith('.')))
        .map(k => dirPart + k + (dir.children[k].type === 'dir' ? '/' : ''));
    }
    if (!options.length) return null;
    let common = options[0];
    for (const o of options) while (!o.startsWith(common)) common = common.slice(0, -1);
    parts[parts.length - 1] = common + (options.length === 1 && !common.endsWith('/') ? ' ' : '');
    return { value: parts.join(' '), options: options.map(o => o.split('/').filter(Boolean).pop() + (o.endsWith('/') ? '/' : '')) };
  }

  // Öffentliche API – wird auch von commands-extra.js genutzt, um neue Befehle zu registrieren
  return {
    execute, complete, cmds, b64encode, b64decode, caesar, tokenize, lex,
    def, describe, fail, run, node, readFile, inputText, parseFlags, pushSession, findHost, garble, CmdError,
    permString, prepareWrite,
  };
})();
