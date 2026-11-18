/* HACKIT – Erweiterte Werkzeuge für Experten- & Meister-Missionen */
(() => {
  const { def, fail, node, readFile, inputText, parseFlags } = Shell;

  def('exiftool', () => tr('Zeigt Metadaten einer Datei (z.B. Bilder)', 'Shows metadata of a file (e.g. images)'), async (ctx, args) => {
    if (!args.length) fail(tr('exiftool: Verwendung: exiftool DATEI', 'exiftool: Usage: exiftool FILE'));
    const f = args[0];
    const n = readFile(ctx, f, 'exiftool');
    const meta = n.meta || {
      'File Name': f.split('/').pop(),
      'File Size': (n.content || '').length + ' bytes',
      'File Type': n.binary ? 'Binary / Image' : 'Text',
      'MIME Type': n.binary ? 'application/octet-stream' : 'text/plain',
    };
    ctx.emit({ type: 'exif', path: f, host: ctx.sess.host.name, meta });
    return Object.entries(meta).map(([k, v]) => `${C('c', k.padEnd(24))}: ${v}`).join('\n');
  });

  def('xor', () => tr('XOR-Verschlüsselung/-Entschlüsselung (-k SCHLÜSSEL [--hex])', 'XOR encryption/decryption (-k KEY [--hex])'), async (ctx, args, stdin) => {
    const { flags, rest } = parseFlags(args, ['k']);
    const key = flags.k;
    if (!key) fail(tr('xor: Verwendung: xor -k SCHLÜSSEL [--hex] [DATEI]', 'xor: Usage: xor -k KEY [--hex] [FILE]'));
    const raw = inputText(ctx, rest, stdin, 'xor').trim();
    let bytes;
    if (flags.hex) {
      const clean = raw.replace(/\s+/g, '');
      if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
        fail(tr('xor: Ungültiger Hex-String', 'xor: Invalid hex string'));
      }
      bytes = [];
      for (let i = 0; i < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
    } else {
      bytes = [...raw].map(ch => ch.charCodeAt(0));
    }
    const outBytes = bytes.map((b, i) => b ^ key.charCodeAt(i % key.length));
    if (flags['out-hex']) {
      return outBytes.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    const result = outBytes.map(b => String.fromCharCode(b)).join('');
    ctx.emit({ type: 'decode', algo: 'xor', result });
    return result;
  });

  def('env', () => tr('Zeigt Umgebungsvariablen der aktuellen Sitzung', 'Shows environment variables of the current session'), async (ctx) => {
    const s = ctx.sess;
    const h = s.host;
    const base = {
      USER: s.user,
      HOME: VFS.pathStr(s.home),
      SHELL: '/bin/bash',
      PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      HOSTNAME: h.name,
      ...(h.env || {}),
      ...(s.env || {}),
    };
    ctx.emit({ type: 'env', host: h.name, user: s.user, vars: base });
    return Object.entries(base).map(([k, v]) => `${C('g', k)}=${v}`).join('\n');
  });

  def('export', () => tr('Setzt eine Umgebungsvariable (export NAME=WERT)', 'Sets an environment variable (export NAME=VALUE)'), async (ctx, args) => {
    if (!args.length) fail(tr('export: Verwendung: export NAME=WERT', 'export: Usage: export NAME=VALUE'));
    const eq = args[0].indexOf('=');
    if (eq <= 0) fail(tr('export: Verwendung: export NAME=WERT', 'export: Usage: export NAME=VALUE'));
    const k = args[0].slice(0, eq);
    if (['__proto__', 'constructor', 'prototype'].includes(k)) {
      fail(tr('export: Ungültiger Variablenname', 'export: Invalid variable name'));
    }
    const v = args.slice(0).join(' ').slice(eq + 1);
    ctx.sess.env = ctx.sess.env || Object.create(null);
    ctx.sess.env[k] = v;
    ctx.emit({ type: 'export', key: k, value: v, host: ctx.sess.host.name });
    return '';
  });

  def('chmod', () => tr('Ändert Dateiberechtigungen (z.B. chmod +x DATEI)', 'Changes file permissions (e.g. chmod +x FILE)'), async (ctx, args) => {
    if (args.length < 2) fail(tr('chmod: Verwendung: chmod +x DATEI', 'chmod: Usage: chmod +x FILE'));
    const mode = args[0], target = args[1];
    const { n, parts } = node(ctx, target, 'chmod');
    if (ctx.sess.user !== 'root' && n.owner !== ctx.sess.user && !n.writable) {
      fail(`chmod: ${target}: ${tr('Vorgang nicht zulässig', 'Operation not permitted')}`);
    }
    if (mode.includes('+x')) n.exec = true;
    else if (mode.includes('-x')) n.exec = false;
    else fail(tr('chmod: Unterstützt wird +x / -x', 'chmod: Supported modes are +x / -x'));
    ctx.emit({ type: 'chmod', path: VFS.pathStr(parts), host: ctx.sess.host.name, mode });
    return '';
  });

  def('crontab', () => tr('Zeigt geplante Aufgaben (crontab -l)', 'Shows scheduled jobs (crontab -l)'), async (ctx, args) => {
    if (!args.includes('-l')) fail(tr('crontab: Verwendung: crontab -l', 'crontab: Usage: crontab -l'));
    const h = ctx.sess.host;
    const jobs = h.cron || [];
    ctx.emit({ type: 'crontab', host: h.name });
    if (!jobs.length) return `no crontab for ${ctx.sess.user}`;
    return [
      C('d', '# m h  dom mon dow   user    command'),
      ...jobs.map(j => `${C('c', j.schedule || '* * * * *')}  ${C('y', (j.user || 'root').padEnd(6))}  ${j.cmd}`),
    ].join('\n');
  });

  const BAD_NAME = new Set(['__proto__', 'constructor', 'prototype']);
  const canWriteDir = (ctx, dir) => ctx.sess.user === 'root' || dir.writable || dir.owner === ctx.sess.user;

  def('mkdir', () => tr('Erstellt ein Verzeichnis (mkdir ORDNER)', 'Creates a directory (mkdir DIR)'), async (ctx, args) => {
    if (!args.length) fail(tr('mkdir: Verwendung: mkdir ORDNER', 'mkdir: Usage: mkdir DIR'));
    const parts = VFS.resolve(ctx.sess, args[0]);
    const name = parts.pop();
    if (!name || BAD_NAME.has(name)) fail(`mkdir: ${args[0]}: ${tr('Ungültiger Name', 'Invalid name')}`);
    const parent = VFS.get(ctx.sess.host.fs, parts);
    if (!parent || parent.type !== 'dir') fail(`mkdir: ${args[0]}: ${tr('Pfad existiert nicht', 'No such file or directory')}`);
    if (!canWriteDir(ctx, parent)) fail(`mkdir: ${args[0]}: Permission denied`);
    if (Object.prototype.hasOwnProperty.call(parent.children, name)) fail(`mkdir: ${args[0]}: File exists`);
    parent.children[name] = VFS.D({}, { owner: ctx.sess.user });
    return '';
  });

  def('touch', () => tr('Erstellt eine leere Datei (touch DATEI)', 'Creates an empty file (touch FILE)'), async (ctx, args) => {
    if (!args.length) fail(tr('touch: Verwendung: touch DATEI', 'touch: Usage: touch FILE'));
    const parts = VFS.resolve(ctx.sess, args[0]);
    const name = parts.pop();
    if (!name || BAD_NAME.has(name)) fail(`touch: ${args[0]}: ${tr('Ungültiger Name', 'Invalid name')}`);
    const parent = VFS.get(ctx.sess.host.fs, parts);
    if (!parent || parent.type !== 'dir') fail(`touch: ${args[0]}: No such file or directory`);
    if (!Object.prototype.hasOwnProperty.call(parent.children, name)) {
      if (!canWriteDir(ctx, parent)) fail(`touch: ${args[0]}: Permission denied`);
      parent.children[name] = VFS.F('', { owner: ctx.sess.user });
    }
    return '';
  });

  def('rm', () => tr('Löscht eine Datei (rm DATEI)', 'Removes a file (rm FILE)'), async (ctx, args) => {
    if (!args.length) fail(tr('rm: Verwendung: rm DATEI', 'rm: Usage: rm FILE'));
    const parts = VFS.resolve(ctx.sess, args[0]);
    const name = parts.pop();
    if (!name || BAD_NAME.has(name)) fail(`rm: ${args[0]}: Invalid name`);
    const parent = VFS.get(ctx.sess.host.fs, parts);
    if (!parent || parent.type !== 'dir' || !Object.prototype.hasOwnProperty.call(parent.children, name)) {
      fail(`rm: ${args[0]}: No such file or directory`);
    }
    const target = parent.children[name];
    if (target.type === 'dir' && Object.keys(target.children).length) fail(`rm: ${args[0]}: Is a directory`);
    if (!canWriteDir(ctx, parent) && target.owner !== ctx.sess.user) fail(`rm: ${args[0]}: Permission denied`);
    delete parent.children[name];
    return '';
  });

  def('cp', () => tr('Kopiert eine Datei (cp QUELLE ZIEL)', 'Copies a file (cp SRC DEST)'), async (ctx, args) => {
    if (args.length < 2) fail(tr('cp: Verwendung: cp QUELLE ZIEL', 'cp: Usage: cp SRC DEST'));
    const src = readFile(ctx, args[0], 'cp');
    const parts = VFS.resolve(ctx.sess, args[1]);
    let name = parts.pop();
    let parent = VFS.get(ctx.sess.host.fs, parts);
    if (parent && parent.type === 'dir' && Object.prototype.hasOwnProperty.call(parent.children, name) && parent.children[name].type === 'dir') {
      parent = parent.children[name];
      name = args[0].split('/').pop();
    }
    if (!name || BAD_NAME.has(name) || !parent || parent.type !== 'dir') fail(`cp: ${args[1]}: No such file or directory`);
    if (!canWriteDir(ctx, parent)) fail(`cp: ${args[1]}: Permission denied`);
    parent.children[name] = VFS.F(src.content, { owner: ctx.sess.user, exec: !!src.exec, binary: !!src.binary, meta: src.meta });
    return '';
  });
})();
