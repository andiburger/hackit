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
})();
