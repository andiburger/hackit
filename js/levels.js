/* HACKIT – Missionen / Missions (zweisprachig: tr(de, en) aus js/i18n.js) */

/* Bausteine für Missionen – auch von weiteren Level-Dateien nutzbar */
const LevelKit = (() => {
  const { linuxFS, host } = VFS;

  // Deterministischer Zufall
  function rng(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  function kali(ip, homeChildren, extra = {}) {
    return host({
      name: 'kali', ip,
      users: { hacker: { password: 'hacker' }, root: { password: null } },
      fs: linuxFS({ hostname: 'kali', users: { hacker: {} }, homes: { hacker: homeChildren }, extra }),
    });
  }

  function world(hosts, start, more = {}) {
    const map = {};
    for (const h of hosts) map[h.ip] = h;
    return { hosts: map, start, ...more };
  }

  function genLog(flagLine) {
    const r = rng(42);
    const ips = ['192.168.1.23', '192.168.1.47', '10.0.0.12', '172.16.4.9', '192.168.1.101', '203.0.113.77'];
    const pages = ['/index.html', '/login', '/shop/cart', '/api/v1/items', '/images/logo.png', tr('/kontakt', '/contact'), tr('/impressum', '/imprint'), '/favicon.ico'];
    const okMsg = tr('Login erfolgreich', 'Login successful');
    const failMsg = tr('Login fehlgeschlagen', 'Login failed');
    const lines = [];
    for (let i = 0; i < 480; i++) {
      const h = String(Math.floor(i / 20)).padStart(2, '0'), m = String((i * 7) % 60).padStart(2, '0'), s = String(Math.floor(r() * 60)).padStart(2, '0');
      const ts = `2026-11-12 ${h}:${m}:${s}`;
      const t = r();
      if (i === 313) lines.push(`${ts} ${flagLine}`);
      else if (t < 0.6) lines.push(`${ts} INFO  [web]  GET ${pick(r, pages)} ${pick(r, ['200', '200', '200', '304', '404'])} (${pick(r, ips)})`);
      else if (t < 0.8) lines.push(`${ts} INFO  [auth] ${okMsg}: user=${pick(r, ['anna', 'ben', 'carla', 'dieter', 'emil'])}`);
      else if (t < 0.93) lines.push(`${ts} WARN  [auth] ${failMsg}: user=${pick(r, ['admin', 'root', 'test', 'guest'])} (${pick(r, ips)})`);
      else lines.push(`${ts} ERROR [db]   ${tr('Timeout nach', 'Timeout after')} ${Math.floor(r() * 900 + 100)}ms`);
    }
    return lines.join('\n');
  }

  function binary(strings) {
    const r = rng(7);
    const junk = n => {
      let s = '';
      for (let i = 0; i < n; i++) {
        if (r() < 0.12) s += String.fromCharCode(33 + Math.floor(r() * 90));
        else s += String.fromCharCode(r() < 0.5 ? Math.floor(r() * 8) : 128 + Math.floor(r() * 127));
      }
      return s;
    };
    let out = '\x7fELF\x02\x01\x01' + junk(40);
    for (const s of strings) out += s + '\x00' + junk(20 + Math.floor(r() * 50));
    return out;
  }

  function sqlLogin(u = '', p = '', users) {
    const q = `SELECT * FROM users WHERE user='${u}' AND pass='${p}'`;
    let clean = '', inQ = false;
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      if (c === "'") { inQ = !inQ; clean += c; continue; }
      if (!inQ && (c === '#' || (c === '-' && q[i + 1] === '-'))) break;
      clean += c;
    }
    if (inQ) return { error: true, q };
    const where = clean.slice(clean.indexOf('WHERE') + 5);
    const taut = where.match(/\bOR\b\s*('?)(\w+)\1\s*=\s*('?)(\w+)\3/i);
    if (taut && taut[2] === taut[4]) return { ok: true, user: Object.keys(users)[0], q };
    const onlyUser = where.match(/^\s*user='([^']*)'\s*$/);
    if (onlyUser && users[onlyUser[1]] != null) return { ok: true, user: onlyUser[1], q };
    const norm = where.match(/^\s*user='([^']*)' AND pass='([^']*)'\s*$/);
    if (norm && users[norm[1]] === norm[2]) return { ok: true, user: norm[1], q };
    return { ok: false, q };
  }

  function webApp({ title, users, onAdmin }) {
    return (path, params, ctx) => {
      if (path === '/' || path === '/index.html') {
        return `${C('d', 'HTTP/1.1 200 OK')}
<!DOCTYPE html>
<html>
  <head><title>${title}</title></head>
  <body>
    <h1>${title} – ${tr('Mitarbeiter-Login', 'Staff Login')}</h1>
    <form action="/login" method="GET">
      <input name="user"> <input name="pass" type="password">
    </form>
    ${C('y', tr('<!-- TODO: Eingaben noch nicht gefiltert! Test-Aufruf: /login?user=NAME&pass=PASSWORT -->', '<!-- TODO: input not filtered yet! Test call: /login?user=NAME&pass=PASSWORD -->'))}
  </body>
</html>`;
      }
      if (path === '/robots.txt') return 'User-agent: *\nDisallow: /admin';
      if (path === '/admin') return `${C('r', 'HTTP/1.1 403 Forbidden')}\n${tr('Bitte zuerst über /login anmelden.', 'Please log in via /login first.')}`;
      if (path === '/login') {
        if (params.user == null || params.pass == null) return `${C('y', 'HTTP/1.1 400 Bad Request')}\n${tr('Parameter fehlen. Erwartet: /login?user=NAME&pass=PASSWORT', 'Missing parameters. Expected: /login?user=NAME&pass=PASSWORD')}`;
        const res = sqlLogin(params.user, params.pass, users);
        if (res.error) {
          ctx.emit({ type: 'sqlerror' });
          return `${C('r', 'HTTP/1.1 500 Internal Server Error')}
${C('r', tr('MySQL-Fehler', 'MySQL error') + ': You have an error in your SQL syntax; check the manual near')}
${C('d', 'Query:')} ${res.q}`;
        }
        if (!res.ok) return `${C('y', 'HTTP/1.1 401 Unauthorized')}\n${tr('Login fehlgeschlagen: Benutzername oder Passwort falsch.', 'Login failed: wrong username or password.')}`;
        ctx.emit({ type: 'sqli', user: res.user });
        return `${C('g', 'HTTP/1.1 200 OK')}\n${C('d', 'Query:')} ${res.q}\n\n` + onAdmin(res.user);
      }
      return `${C('r', 'HTTP/1.1 404 Not Found')}\n${tr(`Die Seite ${path} existiert nicht.`, `The page ${path} does not exist.`)}`;
    };
  }

  const ev = (type, pred = () => true) => e => e.type === type && pred(e);

  return { rng, pick, kali, world, genLog, binary, sqlLogin, webApp, ev };
})();

/* ======================================================================= */
function coreChapters() {
  return [
    { title: tr('Kapitel 1 · Grundlagen', 'Chapter 1 · Basics'), desc: tr('Lerne das Terminal kennen – das wichtigste Werkzeug jedes Hackers.', "Get to know the terminal – every hacker's most important tool.") },
    { title: tr('Kapitel 2 · Daten & Kryptografie', 'Chapter 2 · Data & Cryptography'), desc: tr('Durchsuche, dekodiere und entschlüssele Geheimnisse.', 'Search, decode and decrypt secrets.') },
    { title: tr('Kapitel 3 · Netzwerk & Angriffe', 'Chapter 3 · Networks & Attacks'), desc: tr('Scanne Netze, knacke Passwörter und werde root.', 'Scan networks, crack passwords and become root.') },
    { title: tr('Kapitel 4 · Finale', 'Chapter 4 · Finale'), desc: tr('Die ultimative Prüfung.', 'The ultimate test.') },
  ];
}

/* ======================================================================= */
function coreLevels() {
  const { D, F, linuxFS, host } = VFS;
  const { kali, world, genLog, binary, webApp, ev } = LevelKit;

  return [
    /* ------------------------------ 1 ------------------------------ */
    {
      chapter: 0, title: tr('Hallo, Hacker', 'Hello, Hacker'), category: 'Terminal', difficulty: 1,
      flag: 'HACKIT{h4ll0_h4ck3r}',
      commands: ['help', 'hint', 'mission', 'clear', 'submit', 'ls', 'cat'],
      newCommands: [
        { cmd: 'ls', desc: tr('zeigt die Dateien im aktuellen Ordner', 'lists the files in the current folder') },
        { cmd: tr('cat DATEI', 'cat FILE'), desc: tr('zeigt den Inhalt einer Datei an', 'shows the contents of a file') },
        { cmd: 'submit FLAG', desc: tr('reicht eine gefundene Flag ein', 'submits a flag you found') },
      ],
      story: tr(`<p>Willkommen bei <b>HACKIT</b>! Hacker arbeiten fast immer im <b>Terminal</b> – einem Textfenster, in das man Befehle tippt.</p>
        <p>In jeder Mission suchst du eine <b>Flag</b>: einen geheimen Code im Format <code>HACKIT{...}</code>.</p>
        <p>Schau dich auf deinem Rechner um. Tippe rechts <code>ls</code> und drücke Enter.</p>`,
      `<p>Welcome to <b>HACKIT</b>! Hackers almost always work in the <b>terminal</b> – a text window where you type commands.</p>
        <p>In every mission you're looking for a <b>flag</b>: a secret code in the format <code>HACKIT{...}</code>.</p>
        <p>Take a look around your computer. Type <code>ls</code> on the right and press Enter.</p>`),
      objectives: [
        { text: tr('Zeige mit ls die Dateien an', 'List the files with ls'), check: ev('ls') },
        { text: tr('Lies willkommen.txt mit cat', 'Read willkommen.txt with cat'), check: ev('read', e => e.path.endsWith('willkommen.txt')) },
        { text: tr('Finde die Flag', 'Find the flag'), check: ev('read', e => e.path.endsWith('flag.txt')) },
      ],
      hints: [
        tr('Tippe <code>ls</code> und drücke Enter. Du siehst dann alle Dateien in deinem Ordner.', 'Type <code>ls</code> and press Enter. You will see all the files in your folder.'),
        tr('Mit <code>cat</code> und einem Dateinamen liest du eine Datei, z.B. <code>cat willkommen.txt</code>.', 'Use <code>cat</code> followed by a file name to read a file, e.g. <code>cat willkommen.txt</code>.'),
        tr('Lies die Flag mit <code>cat flag.txt</code> und gib sie dann mit <code>submit HACKIT{...}</code> ein (oder nutze das Feld links).', 'Read the flag with <code>cat flag.txt</code>, then enter it with <code>submit HACKIT{...}</code> (or use the field on the left).'),
      ],
      learned: tr('Du kannst Dateien auflisten (ls) und lesen (cat).', 'You can list files (ls) and read them (cat).'),
      setup() {
        return world([kali('10.0.0.5', {
          'willkommen.txt': F(tr(
            `Hey ${'{alias}'}!\n\nSchön, dass du dabei bist. Ich bin ${C('m', 'Zero')}, deine Mentorin.\nIch begleite dich durch deine Ausbildung.\n\nIn diesem Ordner liegt eine Datei namens flag.txt.\nLies sie mit cat und reiche die Flag mit submit ein.\n\n– Zero`,
            `Hey ${'{alias}'}!\n\nGreat to have you on board. I'm ${C('m', 'Zero')}, your mentor.\nI'll guide you through your training.\n\nThere's a file called flag.txt in this folder.\nRead it with cat and submit the flag with submit.\n\n– Zero`)),
          'flag.txt': F(tr('Glückwunsch! Deine erste Flag:\n\n   HACKIT{h4ll0_h4ck3r}\n\nReiche sie ein mit:  submit HACKIT{h4ll0_h4ck3r}', 'Congratulations! Your first flag:\n\n   HACKIT{h4ll0_h4ck3r}\n\nSubmit it with:  submit HACKIT{h4ll0_h4ck3r}')),
          'einkaufsliste.txt': F(tr('- Energy Drinks\n- Pizza\n- neues Netzwerkkabel', '- Energy drinks\n- Pizza\n- new network cable')),
        })], { ip: '10.0.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 2 ------------------------------ */
    {
      chapter: 0, title: tr('Im Labyrinth der Ordner', 'The Folder Labyrinth'), category: 'Terminal', difficulty: 1,
      flag: 'HACKIT{d1r3ct0ry_tr4v3l3r}',
      commands: ['cd', 'pwd', 'whoami', 'hostname'],
      newCommands: [
        { cmd: tr('cd ORDNER', 'cd FOLDER'), desc: tr('wechselt in einen Ordner', 'changes into a folder') },
        { cmd: 'cd ..', desc: tr('geht einen Ordner zurück (nach oben)', 'goes back one folder (up)') },
        { cmd: 'pwd', desc: tr('zeigt, in welchem Ordner du gerade bist', 'shows which folder you are in right now') },
      ],
      story: tr(`<p>Ordner sind wie Schubladen in Schubladen. Zero hat die Flag tief im Ordner <code>projekte</code> versteckt.</p>
        <p>Wechsle mit <code>cd</code> in Ordner hinein und schau dich in jedem mit <code>ls</code> um.</p>
        <p class="c-d">Profi-Trick: Drück <b>TAB</b>, um Namen automatisch zu vervollständigen.</p>`,
      `<p>Folders are like drawers inside drawers. Zero has hidden the flag deep inside the folder <code>projekte</code> (German for "projects").</p>
        <p>Use <code>cd</code> to move into folders and look around in each one with <code>ls</code>.</p>
        <p class="c-d">Pro tip: press <b>TAB</b> to auto-complete names.</p>`),
      objectives: [
        { text: tr('Wechsle in den Ordner projekte', 'Change into the folder projekte'), check: ev('cd', e => e.path.endsWith('/projekte')) },
        { text: tr('Finde den Ordner geheim', 'Find the folder geheim'), check: ev('cd', e => e.path.endsWith('/geheim')) },
        { text: tr('Lies die Flag', 'Read the flag'), check: ev('read', e => e.path.endsWith('geheim/flag.txt')) },
      ],
      hints: [
        tr('Gib <code>cd projekte</code> ein und dann <code>ls</code>, um zu sehen, was darin liegt.', 'Enter <code>cd projekte</code> and then <code>ls</code> to see what\'s inside.'),
        tr('Ordner werden <span class="c-b">blau</span> mit einem / am Ende angezeigt. In <code>projekte</code> gibt es den Ordner <code>2026</code> – und darin noch mehr.', 'Folders are shown in <span class="c-b">blue</span> with a / at the end. Inside <code>projekte</code> there is a folder <code>2026</code> – and more inside that.'),
        tr('Der Weg ist: <code>cd projekte/2026/geheim</code> und dann <code>cat flag.txt</code>. Mit <code>cd ..</code> kommst du jederzeit zurück.', 'The path is: <code>cd projekte/2026/geheim</code> and then <code>cat flag.txt</code>. You can always go back with <code>cd ..</code>.'),
      ],
      learned: tr('Du kannst dich mit cd und pwd durch Verzeichnisse bewegen.', 'You can move through directories with cd and pwd.'),
      setup() {
        return world([kali('10.0.0.5', {
          'lies_mich.txt': F(tr('Die Flag liegt irgendwo im Ordner "projekte".\nTipp: cd ORDNER zum Hineingehen, cd .. zum Zurückgehen.', 'The flag is somewhere in the folder "projekte".\nTip: cd FOLDER to go in, cd .. to go back.')),
          bilder: D({ 'urlaub.jpg': F('\x89PNG...', { binary: true }), 'katze.png': F('\x89PNG...', { binary: true }) }),
          dokumente: D({ 'lebenslauf.txt': F(tr('Name: hacker\nSkills: noch keine :)', 'Name: hacker\nSkills: none yet :)')) }),
          projekte: D({
            '2025': D({ 'alt.txt': F(tr('Hier ist nichts mehr. Schau im aktuellen Jahr nach.', 'Nothing left here. Check the current year.')) }),
            '2026': D({
              'todo.txt': F(tr('[x] Flag verstecken\n[ ] Kaffee kaufen', '[x] Hide flag\n[ ] Buy coffee')),
              geheim: D({ 'flag.txt': F(tr('Sehr gut, du findest dich zurecht!\n\nHACKIT{d1r3ct0ry_tr4v3l3r}', 'Very good, you know your way around!\n\nHACKIT{d1r3ct0ry_tr4v3l3r}')) }),
              website: D({ 'index.html': F('<h1>Coming soon</h1>') }),
            }),
          }),
        })], { ip: '10.0.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 3 ------------------------------ */
    {
      chapter: 0, title: tr('Unsichtbare Dateien', 'Invisible Files'), category: 'Terminal', difficulty: 1,
      flag: 'HACKIT{n1chts_bl31bt_v3rst3ckt}',
      commands: [],
      newCommands: [
        { cmd: 'ls -a', desc: tr('zeigt auch versteckte Dateien (beginnen mit .)', 'also shows hidden files (starting with .)') },
        { cmd: 'ls -l', desc: tr('zeigt Details wie Besitzer und Größe', 'shows details like owner and size') },
      ],
      story: tr(`<p>Unter Linux ist jede Datei <b>versteckt</b>, deren Name mit einem Punkt beginnt, z.B. <code>.config</code>. Ein normales <code>ls</code> zeigt sie nicht an.</p>
        <p>Ein Admin dachte, er wäre schlau, und hat seine Notizen so versteckt. Finde sie!</p>`,
      `<p>On Linux, every file whose name starts with a dot is <b>hidden</b>, e.g. <code>.config</code>. A plain <code>ls</code> doesn't show it.</p>
        <p>An admin thought he was clever and hid his notes this way. Find them!</p>`),
      objectives: [
        { text: tr('Zeige versteckte Dateien an', 'Show hidden files'), check: ev('ls', e => e.all) },
        { text: tr('Finde und lies die versteckte Flag', 'Find and read the hidden flag'), check: ev('read', e => e.path.endsWith('.flag')) },
      ],
      hints: [
        tr('Programme verstehen <b>Optionen</b>, die mit einem Minus beginnen. <code>ls</code> hat eine Option für <i>alle</i> (englisch: <i>all</i>) Dateien.', 'Programs understand <b>options</b> that start with a minus. <code>ls</code> has an option for <i>all</i> files.'),
        tr('Probiere <code>ls -a</code>. Danach siehst du einen versteckten Ordner, in den du mit <code>cd</code> wechseln kannst.', 'Try <code>ls -a</code>. You\'ll then see a hidden folder you can enter with <code>cd</code>.'),
        tr('<code>cd .admin_notizen</code>, dann <code>ls -a</code> und <code>cat .flag</code>.', '<code>cd .admin_notizen</code>, then <code>ls -a</code> and <code>cat .flag</code>.'),
      ],
      learned: tr('Versteckte Dateien beginnen mit einem Punkt – ls -a deckt sie auf.', 'Hidden files start with a dot – ls -a reveals them.'),
      setup() {
        return world([kali('10.0.0.5', {
          'notiz.txt': F(tr('Hier gibt es nichts zu sehen. Wirklich nicht. Ehrlich!\n– Admin', 'Nothing to see here. Really. Honestly!\n– Admin')),
          '.bash_history': F('ls\ncd .admin_notizen\nnano .flag\nexit'),
          '.admin_notizen': D({
            'einkauf.txt': F(tr('Milch, Brot, neue Tastatur', 'Milk, bread, new keyboard')),
            '.flag': F(tr('Mist, du hast mich gefunden!\n\nHACKIT{n1chts_bl31bt_v3rst3ckt}', 'Darn, you found me!\n\nHACKIT{n1chts_bl31bt_v3rst3ckt}')),
          }),
        })], { ip: '10.0.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 4 ------------------------------ */
    {
      chapter: 1, title: tr('Nadel im Heuhaufen', 'Needle in a Haystack'), category: tr('Forensik', 'Forensics'), difficulty: 2,
      flag: 'HACKIT{gr3p_f1nd3t_4ll3s}',
      commands: ['grep', 'head', 'tail'],
      newCommands: [
        { cmd: tr('head DATEI', 'head FILE'), desc: tr('zeigt die ersten 10 Zeilen', 'shows the first 10 lines') },
        { cmd: tr('tail DATEI', 'tail FILE'), desc: tr('zeigt die letzten 10 Zeilen', 'shows the last 10 lines') },
        { cmd: tr('grep MUSTER DATEI', 'grep PATTERN FILE'), desc: tr('zeigt nur Zeilen, die MUSTER enthalten', 'shows only lines containing PATTERN') },
      ],
      story: tr(`<p>Ein Webserver wurde angegriffen. In der Logdatei <code>server.log</code> steht irgendwo ein versehentlich geloggtes Geheimnis.</p>
        <p>Das Problem: Die Datei hat fast <b>500 Zeilen</b>. Alles zu lesen dauert ewig. Profis <b>filtern</b> stattdessen.</p>`,
      `<p>A web server was attacked. Somewhere in the log file <code>server.log</code> there's a secret that was logged by accident.</p>
        <p>The problem: the file has almost <b>500 lines</b>. Reading it all takes forever. Pros <b>filter</b> instead.</p>`),
      objectives: [
        { text: tr('Verschaffe dir mit head einen Überblick', 'Get an overview with head'), check: ev('cmd', e => e.name === 'head' || e.name === 'tail') },
        { text: tr('Durchsuche das Log mit grep', 'Search the log with grep'), check: ev('grep', e => e.found) },
        { text: tr('Finde die Zeile mit der Flag', 'Find the line with the flag'), check: ev('grep', e => /hackit/i.test(e.pattern)) },
      ],
      hints: [
        tr('Mit <code>head server.log</code> siehst du, wie die Einträge aufgebaut sind. Mit <code>grep</code> suchst du nach einem Wort.', 'With <code>head server.log</code> you can see how the entries are structured. With <code>grep</code> you search for a word.'),
        tr('Du weißt, wie jede Flag beginnt … Wonach könntest du also suchen? Probier z.B. <code>grep WARN server.log</code>, um zu sehen, wie grep funktioniert.', 'You know how every flag starts … so what could you search for? Try e.g. <code>grep WARN server.log</code> to see how grep works.'),
        tr('Gib <code>grep HACKIT server.log</code> ein.', 'Enter <code>grep HACKIT server.log</code>.'),
      ],
      learned: tr('grep findet in Sekunden, was du in riesigen Dateien suchst.', 'grep finds what you\'re looking for in huge files within seconds.'),
      setup() {
        return world([kali('10.0.0.5', {
          'server.log': F(genLog(tr('WARN  [auth] DEBUG-Modus aktiv, Token im Klartext: HACKIT{gr3p_f1nd3t_4ll3s}', 'WARN  [auth] DEBUG mode active, token in plain text: HACKIT{gr3p_f1nd3t_4ll3s}'))),
          'auftrag.txt': F(tr('Untersuche server.log. Irgendwo hat der Server etwas Geheimes protokolliert.', 'Investigate server.log. Somewhere the server logged something secret.')),
        })], { ip: '10.0.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 5 ------------------------------ */
    {
      chapter: 1, title: tr('Kodiert ist nicht verschlüsselt', 'Encoded Is Not Encrypted'), category: tr('Kryptografie', 'Cryptography'), difficulty: 2,
      flag: 'HACKIT{b4se64_1st_k31ne_kryp70}',
      commands: ['base64', 'echo'],
      newCommands: [
        { cmd: tr('base64 -d DATEI', 'base64 -d FILE'), desc: tr('dekodiert Base64-Text', 'decodes Base64 text') },
        { cmd: 'echo TEXT', desc: tr('gibt Text aus', 'prints text') },
        { cmd: 'A | B', desc: tr('Pipe: Ausgabe von A wird Eingabe von B', 'Pipe: output of A becomes input of B') },
      ],
      story: tr(`<p>Du hast eine E-Mail abgefangen. Der Anhang sieht aus wie Kauderwelsch – ist aber nur <b>Base64-kodiert</b>.</p>
        <p>Base64 macht aus beliebigen Daten lesbare Zeichen (A–Z, a–z, 0–9, +, /). Man erkennt es oft am <code>=</code> am Ende. Es ist <b>keine Verschlüsselung</b> – jeder kann es zurückwandeln!</p>`,
      `<p>You intercepted an e-mail. The attachment looks like gibberish – but it's only <b>Base64-encoded</b>.</p>
        <p>Base64 turns any data into readable characters (A–Z, a–z, 0–9, +, /). You can often recognize it by the <code>=</code> at the end. It is <b>not encryption</b> – anyone can turn it back!</p>`),
      objectives: [
        { text: tr('Lies die abgefangene Mail', 'Read the intercepted mail'), check: ev('read', e => e.path.endsWith('mail.txt')) },
        { text: tr('Dekodiere den Anhang', 'Decode the attachment'), check: ev('decode', e => e.result.includes('HACKIT')) },
      ],
      hints: [
        tr('Schau dir <code>anhang.b64</code> mit <code>cat</code> an. Die Endung .b64 und das <code>=</code> am Ende verraten die Kodierung.', 'Look at <code>anhang.b64</code> with <code>cat</code>. The .b64 extension and the <code>=</code> at the end give away the encoding.'),
        tr('Das Werkzeug <code>base64</code> kodiert Text. Mit der Option <code>-d</code> (decode) wandelt es ihn zurück. Teste: <code>echo SGFsbG8= | base64 -d</code>', 'The tool <code>base64</code> encodes text. With the option <code>-d</code> (decode) it turns it back. Try: <code>echo SGFsbG8= | base64 -d</code>'),
        tr('Gib <code>base64 -d anhang.b64</code> ein – oder mit Pipe: <code>cat anhang.b64 | base64 -d</code>', 'Enter <code>base64 -d anhang.b64</code> – or with a pipe: <code>cat anhang.b64 | base64 -d</code>'),
      ],
      learned: tr('Base64 ist nur eine Kodierung, keine Verschlüsselung. Und du kennst jetzt Pipes (|).', 'Base64 is just an encoding, not encryption. And now you know pipes (|).'),
      setup() {
        const secret = tr('Hallo Max,\nhier wie besprochen der Zugangscode. Niemand wird das lesen können, ist ja verschlüsselt ;)\n\nHACKIT{b4se64_1st_k31ne_kryp70}\n\nGruß, Lisa',
          'Hi Max,\nhere is the access code as discussed. Nobody will be able to read it, it\'s encrypted after all ;)\n\nHACKIT{b4se64_1st_k31ne_kryp70}\n\nCheers, Lisa');
        const b64 = Shell.b64encode(secret).replace(/(.{60})/g, '$1\n');
        return world([kali('10.0.0.5', {
          'mail.txt': F(tr('Von:     lisa@megacorp.example\nAn:      max@megacorp.example\nBetreff: Zugangscode (VERSCHLÜSSELT!!)\nAnhang:  anhang.b64\n\nHi Max,\nden Code hab ich sicherheitshalber verschlüsselt, siehe Anhang.\n\nLG Lisa',
            'From:       lisa@megacorp.example\nTo:         max@megacorp.example\nSubject:    Access code (ENCRYPTED!!)\nAttachment: anhang.b64\n\nHi Max,\nI encrypted the code just to be safe, see attachment.\n\nBest, Lisa')),
          'anhang.b64': F(b64),
        })], { ip: '10.0.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 6 ------------------------------ */
    {
      chapter: 1, title: tr('Caesars Geheimnis', "Caesar's Secret"), category: tr('Kryptografie', 'Cryptography'), difficulty: 2,
      flag: 'HACKIT{c43s4r_w4r_n1cht_s1ch3r}',
      commands: ['caesar'],
      newCommands: [
        { cmd: tr('caesar -s N DATEI', 'caesar -s N FILE'), desc: tr('verschiebt jeden Buchstaben um N Stellen', 'shifts every letter by N positions') },
        { cmd: tr('caesar --brute DATEI', 'caesar --brute FILE'), desc: tr('probiert alle 25 Verschiebungen aus', 'tries all 25 shifts') },
      ],
      story: tr(`<p>Julius Caesar verschlüsselte Nachrichten, indem er jeden Buchstaben um eine feste Anzahl im Alphabet verschob (bei 3: A→D, B→E …).</p>
        <p>Du hast einen <code>funkspruch.txt</code> abgefangen. Die Verschiebung kennst du nicht – aber es gibt nur <b>25 Möglichkeiten</b>. Das kann man einfach alle ausprobieren: ein <b>Brute-Force-Angriff</b>.</p>`,
      `<p>Julius Caesar encrypted messages by shifting every letter a fixed number of places in the alphabet (with 3: A→D, B→E …).</p>
        <p>You intercepted a radio message, <code>funkspruch.txt</code>. You don't know the shift – but there are only <b>25 possibilities</b>. You can simply try them all: a <b>brute-force attack</b>.</p>`),
      objectives: [
        { text: tr('Lies den Funkspruch', 'Read the radio message'), check: ev('read', e => e.path.endsWith('funkspruch.txt')) },
        { text: tr('Knacke die Caesar-Verschlüsselung', 'Crack the Caesar cipher'), check: ev('decode', e => e.algo === 'caesar' && e.result.includes('HACKIT{c43s4r')) },
      ],
      hints: [
        tr('Probiere eine Verschiebung aus, z.B. <code>caesar -s 3 funkspruch.txt</code>. Ergibt das Sinn?', 'Try a shift, e.g. <code>caesar -s 3 funkspruch.txt</code>. Does it make sense?'),
        tr('Statt jede Zahl einzeln zu testen, probiert <code>--brute</code> alle 25 Verschiebungen auf einmal. Suche die Zeile mit lesbarem Deutsch.', 'Instead of testing every number one by one, <code>--brute</code> tries all 25 shifts at once. Look for the line with readable English.'),
        tr('<code>caesar --brute funkspruch.txt | grep HACKIT</code> – so filterst du direkt die richtige Zeile heraus!', '<code>caesar --brute funkspruch.txt | grep HACKIT</code> – this filters out the right line directly!'),
      ],
      learned: tr('Caesar-Chiffren haben nur 25 Schlüssel – Brute-Force knackt sie sofort.', 'Caesar ciphers have only 25 keys – brute force cracks them instantly.'),
      setup() {
        const plain = tr('TREFFPUNKT UM MITTERNACHT AM ALTEN HAFEN. DAS LOSUNGSWORT LAUTET HACKIT{c43s4r_w4r_n1cht_s1ch3r}',
          'MEET AT MIDNIGHT AT THE OLD HARBOR. THE PASSWORD IS HACKIT{c43s4r_w4r_n1cht_s1ch3r}');
        return world([kali('10.0.0.5', {
          'funkspruch.txt': F(Shell.caesar(plain, 11)),
          'notizbuch.txt': F(tr('Aus dem Notizbuch von Julius:\n"Ich verschiebe jeden Buchstaben – um wie viele Stellen, verrate ich natürlich nicht!"', 'From the notebook of Julius:\n"I shift every letter – by how many places, I won\'t tell, of course!"')),
        })], { ip: '10.0.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 7 ------------------------------ */
    {
      chapter: 1, title: tr('Vergessene Backups', 'Forgotten Backups'), category: tr('Forensik', 'Forensics'), difficulty: 3,
      flag: 'HACKIT{b4ckups_s1nd_g0ld}',
      commands: ['find'],
      newCommands: [
        { cmd: tr('find PFAD -name "MUSTER"', 'find PATH -name "PATTERN"'), desc: tr('sucht Dateien nach Namen', 'searches files by name') },
        { cmd: '*', desc: tr('Platzhalter: *.txt = alle Dateien, die auf .txt enden', 'Wildcard: *.txt = all files ending in .txt') },
      ],
      story: tr(`<p>Du bist auf dem Dateiserver von MegaCorp. Laut Gerüchten hat ein Admin eine Sicherungskopie mit Zugangsdaten herumliegen lassen. Backup-Dateien enden oft auf <code>.bak</code>.</p>
        <p>Der Server hat hunderte Ordner – mit <code>cd</code> würdest du ewig suchen. Lass den Computer suchen!</p>`,
      `<p>You're on MegaCorp's file server. Rumor has it an admin left a backup copy with login credentials lying around. Backup files often end in <code>.bak</code>.</p>
        <p>The server has hundreds of folders – with <code>cd</code> you'd be searching forever. Let the computer do the searching!</p>`),
      objectives: [
        { text: tr('Suche mit find nach .bak-Dateien', 'Search for .bak files with find'), check: ev('find', e => e.count > 0 && e.name && e.name.includes('bak')) },
        { text: tr('Finde das richtige Backup', 'Find the right backup'), check: ev('read', e => e.path.endsWith('zugang.txt.bak')) },
      ],
      hints: [
        tr('<code>find</code> durchsucht einen Ordner und alle Unterordner. Mit <code>/</code> als Pfad durchsuchst du das ganze System.', '<code>find</code> searches a folder and all its subfolders. With <code>/</code> as the path you search the whole system.'),
        tr('Mit <code>-name</code> filterst du nach Namen. Der Stern <code>*</code> steht für beliebige Zeichen: <code>find / -name "*.txt"</code>', 'With <code>-name</code> you filter by name. The star <code>*</code> stands for any characters: <code>find / -name "*.txt"</code>'),
        tr('Gib <code>find / -name "*.bak"</code> ein und lies die Treffer mit <code>cat</code>. Nicht jedes Backup ist das richtige!', 'Enter <code>find / -name "*.bak"</code> and read the results with <code>cat</code>. Not every backup is the right one!'),
      ],
      learned: tr('find durchsucht ganze Systeme in Sekunden – Backups sind oft eine Goldgrube.', 'find searches entire systems in seconds – backups are often a gold mine.'),
      setup() {
        const dept = n => D({ 'protokoll.txt': F(tr(`Protokoll ${n}: nichts Besonderes.`, `Minutes ${n}: nothing special.`)), 'budget.csv': F(tr('posten;betrag\nKaffee;9000', 'item;amount\nCoffee;9000')) });
        return world([host({
          name: 'fileserver', ip: '10.0.0.8',
          users: { hacker: { password: 'x' }, root: {} },
          fs: linuxFS({
            hostname: 'fileserver', users: { hacker: {} },
            homes: { hacker: { 'aufgabe.txt': F(tr('Suche eine Backup-Datei (.bak) mit Zugangsdaten.\nTipp: find kann das ganze System durchsuchen.', 'Look for a backup file (.bak) with login credentials.\nTip: find can search the whole system.')) } },
            root: { 'root.bak': F('...') },
            extra: {
              srv: D({ daten: D({ abteilungen: D({
                vertrieb: dept(tr('Vertrieb', 'Sales')), marketing: dept('Marketing'), personal: dept(tr('Personal', 'HR')),
                it: D({
                  skripte: D({ 'backup.sh': F('#!/bin/bash\ntar czf /tmp/backup.tgz /srv', { exec: true }) }),
                  alt: D({
                    '2024': D({ 'liesmich.txt': F(tr('Alte Daten', 'Old data')) }),
                    '2025': D({ cache: D({ 'zugang.txt.bak': F(tr('=== Zugangsdaten Dateiserver (BACKUP) ===\nadmin : Fr1hl1ng2025\n\nHACKIT{b4ckups_s1nd_g0ld}', '=== File server credentials (BACKUP) ===\nadmin : Fr1hl1ng2025\n\nHACKIT{b4ckups_s1nd_g0ld}')) }) }),
                  }),
                }),
              }) }) }),
              opt: D({ webapp: D({ 'config.php': F('<?php $db="prod"; ?>'), 'config.php.bak': F(tr('<?php\n$db_user = "web";\n$db_pass = "geheim123"; // alt, nicht mehr gültig\n?>', '<?php\n$db_user = "web";\n$db_pass = "geheim123"; // old, no longer valid\n?>')) }) }),
              var: D({ backups: D({ 'passwd.bak': F('root:x:0:0:root:/root:/bin/bash\nhacker:x:1000:1000::/home/hacker:/bin/bash'), 'dpkg.status.0': F('Package: bash') }) }),
            },
          }),
        })], { ip: '10.0.0.8', user: 'hacker' });
      },
    },

    /* ------------------------------ 8 ------------------------------ */
    {
      chapter: 1, title: tr('Der Tresor', 'The Safe'), category: 'Reverse Engineering', difficulty: 3,
      flag: 'HACKIT{str1ngs_v3rr4t3n_4ll3s}',
      commands: ['strings'],
      newCommands: [
        { cmd: tr('./PROGRAMM', './PROGRAM'), desc: tr('startet ein Programm im aktuellen Ordner', 'runs a program in the current folder') },
        { cmd: tr('strings DATEI', 'strings FILE'), desc: tr('zeigt lesbaren Text in Programmdateien', 'shows readable text inside program files') },
      ],
      story: tr(`<p>Das Programm <code>tresor</code> schützt die Flag mit einem Passwort. Raten ist zwecklos – nach dem falschen Passwort ertönt Alarm.</p>
        <p>Aber: Viele Entwickler speichern Passwörter direkt im Programmcode (<b>hardcoded</b>). Programme bestehen zwar aus Maschinencode, Texte darin bleiben aber lesbar …</p>`,
      `<p>The program <code>tresor</code> (German for "safe") protects the flag with a password. Guessing is pointless – a wrong password sets off the alarm.</p>
        <p>But: many developers store passwords directly in the program code (<b>hardcoded</b>). Programs consist of machine code, but the text inside them stays readable …</p>`),
      objectives: [
        { text: tr('Starte das Programm ./tresor', 'Run the program ./tresor'), check: ev('exec', e => e.file.includes('tresor')) },
        { text: tr('Untersuche das Programm mit strings', 'Examine the program with strings'), check: ev('strings') },
        { text: tr('Öffne den Tresor', 'Open the safe'), check: ev('tresor') },
      ],
      hints: [
        tr('Starte das Programm mit <code>./tresor</code>. Versuche danach mal <code>cat tresor</code> – Maschinencode ist kaum lesbar.', 'Run the program with <code>./tresor</code>. Then try <code>cat tresor</code> – machine code is barely readable.'),
        tr('<code>strings tresor</code> filtert nur die lesbaren Textstellen heraus. Zwischen den Meldungen des Programms versteckt sich ein Wort, das nicht dazugehört.', '<code>strings tresor</code> filters out only the readable bits of text. Among the program\'s messages hides a word that doesn\'t belong.'),
        tr('Neben „Passwort:“ und „Tresor geoeffnet!“ steht <code>goldfisch42</code>. Starte <code>./tresor</code> und gib es ein.', 'Right next to "Password:" and "Safe opened!" is <code>goldfisch42</code>. Run <code>./tresor</code> and enter it.'),
      ],
      learned: tr('Hardcoded Passwörter lassen sich mit strings aus Programmen auslesen.', 'Hardcoded passwords can be pulled out of programs with strings.'),
      setup() {
        const flag = 'HACKIT{str1ngs_v3rr4t3n_4ll3s}';
        const banner = tr('=== TRESOR v1.3 ===', '=== SAFE v1.3 ===');
        const prompt = tr('Passwort: ', 'Password: ');
        const wrong = tr('Falsches Passwort! Alarm ausgeloest.', 'Wrong password! Alarm triggered.');
        const opened = tr('Tresor geoeffnet!', 'Safe opened!');
        const content = binary(['/lib64/ld-linux-x86-64.so.2', 'libc.so.6', 'puts', 'printf', 'fgets', 'strcmp', '__libc_start_main', 'GLIBC_2.2.5',
          banner, prompt, 'goldfisch42', wrong, opened, 'GCC: (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0', 'main', '.text', '.rodata']);
        const tresor = F(content, {
          exec: true, binary: true,
          async run(ctx) {
            const t = ctx.term;
            t.print(C('c', banner));
            const pw = await t.ask(prompt, true);
            await sleep(500);
            if (pw === 'goldfisch42') {
              ctx.emit({ type: 'tresor' });
              return `${C('g', opened)}\n\n   🔓  ${flag}`;
            }
            return C('r', wrong + ' 🚨');
          },
        });
        return world([kali('10.0.0.5', {
          tresor,
          'notiz.txt': F(tr('Ich habe das Passwort direkt ins Programm geschrieben,\ndann kann ich es nicht vergessen. Genial! – Dev', 'I wrote the password straight into the program,\nthat way I can\'t forget it. Genius! – Dev')),
        })], { ip: '10.0.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 9 ------------------------------ */
    {
      chapter: 2, title: tr('Netzwerk-Aufklärung', 'Network Recon'), category: tr('Netzwerk', 'Network'), difficulty: 3,
      flag: 'HACKIT{st4nd4rd_p4ssw0rt_f41l}',
      commands: ['ifconfig', 'nmap', 'ssh', 'exit'],
      newCommands: [
        { cmd: 'ifconfig', desc: tr('zeigt deine IP-Adresse', 'shows your IP address') },
        { cmd: 'nmap 10.10.0.0/24', desc: tr('scannt alle 256 Adressen eines Netzes', 'scans all 256 addresses of a network') },
        { cmd: 'ssh user@IP', desc: tr('meldet dich auf einem anderen Rechner an', 'logs you in to another computer') },
        { cmd: 'exit', desc: tr('beendet die ssh-Verbindung', 'closes the ssh connection') },
      ],
      story: tr(`<p>Jetzt geht's ins Netzwerk! Jeder Rechner hat eine <b>IP-Adresse</b>, z.B. <code>10.10.0.5</code>. Programme lauschen auf <b>Ports</b> – SSH (Fernzugriff) z.B. auf Port 22.</p>
        <p>Irgendwo in deinem Netz steht ein alter Druckserver. Gerüchten zufolge hat der Admin das <b>Standardpasswort</b> nie geändert.</p>`,
      `<p>Now we're heading into the network! Every computer has an <b>IP address</b>, e.g. <code>10.10.0.5</code>. Programs listen on <b>ports</b> – SSH (remote access), for example, on port 22.</p>
        <p>Somewhere in your network there's an old print server. Rumor has it the admin never changed the <b>default password</b>.</p>`),
      objectives: [
        { text: tr('Finde deine eigene IP heraus', 'Find out your own IP'), check: ev('cmd', e => e.name === 'ifconfig') },
        { text: tr('Scanne das Netzwerk', 'Scan the network'), check: ev('nmap', e => e.hosts.length > 1) },
        { text: tr('Melde dich auf dem Druckserver an', 'Log in to the print server'), check: ev('login', e => e.host === 'printsrv') },
        { text: tr('Lies die Flag auf dem Server', 'Read the flag on the server'), check: ev('read', e => e.host === 'printsrv' && e.path.endsWith('flag.txt')) },
      ],
      hints: [
        tr('<code>ifconfig</code> zeigt deine IP: 10.10.0.5. Alle Rechner im selben Netz beginnen mit <code>10.10.0.</code> – das schreibt man als <code>10.10.0.0/24</code>.', '<code>ifconfig</code> shows your IP: 10.10.0.5. All computers in the same network start with <code>10.10.0.</code> – written as <code>10.10.0.0/24</code>.'),
        tr('Scanne mit <code>nmap 10.10.0.0/24</code>. Suche den Rechner, der nach Drucker klingt und Port 22 (ssh) offen hat. In <code>standardpasswoerter.txt</code> stehen typische Logins.', 'Scan with <code>nmap 10.10.0.0/24</code>. Look for the computer that sounds like a printer and has port 22 (ssh) open. <code>standardpasswoerter.txt</code> lists typical logins.'),
        tr('<code>ssh admin@10.10.0.23</code> mit dem Passwort <code>admin</code>. Dann <code>ls</code> und <code>cat flag.txt</code>.', '<code>ssh admin@10.10.0.23</code> with the password <code>admin</code>. Then <code>ls</code> and <code>cat flag.txt</code>.'),
      ],
      learned: tr('Netzwerk-Scans zeigen Angriffsflächen. Standardpasswörter sind eine der häufigsten Schwachstellen!', 'Network scans reveal attack surfaces. Default passwords are one of the most common weaknesses!'),
      setup() {
        const k = kali('10.10.0.5', {
          'auftrag.txt': F(tr('Auftrag von Zero:\n\nIn unserem Ziel-Netz steht ein alter Druckserver.\nFinde ihn, melde dich an und hol die Flag.\n\nTipp: Admins sind faul. Die ändern selten das Standardpasswort.',
            'Assignment from Zero:\n\nThere\'s an old print server in our target network.\nFind it, log in and grab the flag.\n\nTip: admins are lazy. They rarely change the default password.')),
          'standardpasswoerter.txt': F(tr('Häufige Standard-Logins (Benutzer:Passwort)\n-----------------------------------------\n', 'Common default logins (user:password)\n-------------------------------------\n') + 'admin:admin\nadmin:1234\nroot:toor\nroot:root\nuser:user\nguest:guest'),
        });
        const router = host({
          name: 'router', ip: '10.10.0.1', users: {}, fs: linuxFS({ hostname: 'router' }),
          services: [{ port: 53, name: 'domain', version: 'dnsmasq 2.80' }, { port: 80, name: 'http', version: 'lighttpd 1.4', web: () => tr('<h1>Router-Konfiguration</h1>\nZugriff nur aus dem internen Verwaltungsnetz.', '<h1>Router configuration</h1>\nAccess only from the internal management network.') }],
        });
        const printsrv = host({
          name: 'printsrv', ip: '10.10.0.23', motd: C('y', tr('*** HP Druckserver – nur für autorisierte Mitarbeiter ***', '*** HP print server – authorized staff only ***')),
          users: { admin: { password: 'admin' }, root: { password: 'Xk!92#pL' } },
          fs: linuxFS({
            hostname: 'printsrv', users: { admin: {} },
            homes: { admin: { 'flag.txt': F(tr('Standardpasswörter – der Klassiker!\n\nHACKIT{st4nd4rd_p4ssw0rt_f41l}', 'Default passwords – a classic!\n\nHACKIT{st4nd4rd_p4ssw0rt_f41l}')), 'druckauftraege.log': F(tr('job 1: urlaubsantrag.pdf\njob 2: gehaltsliste.xlsx  (!)', 'job 1: vacation_request.pdf\njob 2: salaries.xlsx  (!)')) } },
          }),
          services: [{ port: 22, name: 'ssh', version: tr('OpenSSH 7.2p2 (veraltet)', 'OpenSSH 7.2p2 (outdated)') }, { port: 631, name: 'ipp', version: 'CUPS 2.1' }],
        });
        const nas = host({
          name: 'nas', ip: '10.10.0.42', users: {}, fs: linuxFS({ hostname: 'nas' }),
          services: [{ port: 445, name: 'smb', version: 'Samba 4.15' }],
        });
        return world([k, router, printsrv, nas], { ip: '10.10.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 10 ------------------------------ */
    {
      chapter: 2, title: tr('Passwort-Knacker', 'Password Cracker'), category: tr('Passwörter', 'Passwords'), difficulty: 4,
      flag: 'HACKIT{j0hn_d3r_kn4ck3r}',
      commands: ['john', 'su'],
      newCommands: [
        { cmd: tr('john HASHES --wordlist=LISTE', 'john HASHES --wordlist=LIST'), desc: tr('knackt Hashes mit einer Wortliste', 'cracks hashes using a wordlist') },
        { cmd: tr('su BENUTZER', 'su USER'), desc: tr('wechselt zu einem anderen Benutzer', 'switches to another user') },
      ],
      story: tr(`<p>Du bist als <code>praktikant</code> auf dem Intranet-Server. Der Chef hat in seinem Ordner etwas Wertvolles – aber der ist für dich gesperrt.</p>
        <p>Du hast einen Datenbank-Dump gefunden. Passwörter werden dort nicht im Klartext gespeichert, sondern als <b>Hash</b> – eine Einbahnstraße. Aber: Man kann tausende bekannte Passwörter hashen und vergleichen. Schwache Passwörter fallen so sofort!</p>`,
      `<p>You're logged in as <code>praktikant</code> (the intern) on the intranet server. The boss (<code>chef</code>) keeps something valuable in his folder – but it's locked for you.</p>
        <p>You found a database dump. Passwords aren't stored there in plain text, but as a <b>hash</b> – a one-way street. But: you can hash thousands of known passwords and compare. Weak passwords fall instantly!</p>`),
      objectives: [
        { text: tr('Untersuche den Ordner des Chefs', "Examine the boss's folder"), check: ev('cmd', e => ['cd', 'ls', 'cat'].includes(e.name) && e.args.some(a => a.includes('chef'))) },
        { text: tr('Knacke das Passwort des Chefs', "Crack the boss's password"), check: ev('crack', e => e.user === 'chef') },
        { text: tr('Werde zum Benutzer chef', 'Become the user chef'), check: ev('login', e => e.user === 'chef') },
        { text: tr('Lies die Flag des Chefs', "Read the boss's flag"), check: ev('read', e => e.path === '/home/chef/flag.txt') },
      ],
      hints: [
        tr('Versuche <code>ls /home/chef</code> – Zugriff verweigert. Schau dir <code>hashes.txt</code> und <code>passwoerter.txt</code> an.', 'Try <code>ls /home/chef</code> – access denied. Take a look at <code>hashes.txt</code> and <code>passwoerter.txt</code>.'),
        tr('John the Ripper vergleicht Hashes mit einer Wortliste: <code>john hashes.txt --wordlist=passwoerter.txt</code>', 'John the Ripper compares hashes against a wordlist: <code>john hashes.txt --wordlist=passwoerter.txt</code>'),
        tr('Das Passwort von chef ist <code>sonnenschein</code>. Wechsle mit <code>su chef</code> und lies <code>/home/chef/flag.txt</code>.', 'The password of chef is <code>sonnenschein</code>. Switch with <code>su chef</code> and read <code>/home/chef/flag.txt</code>.'),
      ],
      learned: tr('Gehashte Passwörter sind nur sicher, wenn sie lang und zufällig sind.', 'Hashed passwords are only safe if they are long and random.'),
      setup() {
        const words = ['123456', 'passwort', 'hallo', 'qwertz', 'schatz', 'master', 'iloveyou', 'fussball', 'dragon', 'monkey', 'letmein', 'sommer2025', 'hallo123', 'schalke04', 'bayern', 'freiheit', 'sonne', 'blume', 'baseball', 'password1', 'passwort123', 'qwerty', 'abc123', 'admin', 'welcome', 'login', 'princess', 'starwars', 'pokemon', 'sonnenschein', 'hamburg', 'berlin', 'killer', 'superman', 'batman', 'computer', 'internet', 'test123', 'geheim', 'lol123', 'mausi', 'ferrari', 'charlie', 'shadow', 'michael', 'jennifer', 'trustno1', '000000', 'zxcvbnm'];
        const h = host({
          name: 'intranet', ip: '10.10.0.30',
          users: { praktikant: { password: 'passwort123' }, chef: { password: 'sonnenschein', privateHome: true }, backup: { password: 'X9#kL!q2vB' }, root: {} },
          fs: linuxFS({
            hostname: 'intranet', users: { praktikant: {}, chef: { privateHome: true }, backup: {} },
            homes: {
              praktikant: {
                'hashes.txt': F('chef:a2b0ef405bae8278b51270241c4084c5\npraktikant:8c405ae1daf2575440a037284f934421\nbackup:89b81376198fd7f8d06f1409d00fca1c'),
                'passwoerter.txt': F(words.join('\n')),
                'woher.txt': F(tr('hashes.txt habe ich aus dem Datenbank-Backup kopiert (MD5-Hashes).\npasswoerter.txt ist eine Liste der häufigsten Passwörter.', 'I copied hashes.txt from the database backup (MD5 hashes).\npasswoerter.txt is a list of the most common passwords.')),
              },
              chef: { 'flag.txt': F(tr('Mein Passwort war wohl doch nicht so sicher...\n\nHACKIT{j0hn_d3r_kn4ck3r}', 'Guess my password wasn\'t that secure after all...\n\nHACKIT{j0hn_d3r_kn4ck3r}')), 'gehalt.xlsx': F(tr('vertraulich', 'confidential')) },
              backup: {},
            },
          }),
          services: [{ port: 22, name: 'ssh', version: 'OpenSSH 8.9' }],
        });
        return world([h], { ip: '10.10.0.30', user: 'praktikant' }, {
          hashdb: { a2b0ef405bae8278b51270241c4084c5: 'sonnenschein', '8c405ae1daf2575440a037284f934421': 'passwort123', '89b81376198fd7f8d06f1409d00fca1c': 'X9#kL!q2vB' },
        });
      },
    },

    /* ------------------------------ 11 ------------------------------ */
    {
      chapter: 2, title: 'SQL-Injection', category: 'Web', difficulty: 4,
      flag: 'HACKIT{sql_1nj3ct10n_ftw}',
      commands: ['curl'],
      newCommands: [
        { cmd: 'curl URL', desc: tr('ruft eine Webseite im Terminal ab', 'fetches a web page in the terminal') },
        { cmd: '"..."', desc: tr('Anführungszeichen schützen Sonderzeichen', 'quotes protect special characters') },
      ],
      story: tr(`<p>Der Online-Shop <b>MegaShop</b> (<code>10.20.0.80</code>) hat einen Mitarbeiter-Login. Hinter dem Login prüft eine <b>SQL-Datenbank</b> Name und Passwort mit einer Abfrage wie:</p>
        <p><code>SELECT * FROM users WHERE user='<i>NAME</i>' AND pass='<i>PASSWORT</i>'</code></p>
        <p>Was passiert, wenn deine Eingabe selbst ein <code>'</code> enthält? Wenn die Seite Eingaben nicht filtert, kannst du die Abfrage <b>umschreiben</b>.</p>`,
      `<p>The online shop <b>MegaShop</b> (<code>10.20.0.80</code>) has a staff login. Behind the login, a <b>SQL database</b> checks name and password with a query like:</p>
        <p><code>SELECT * FROM users WHERE user='<i>NAME</i>' AND pass='<i>PASSWORD</i>'</code></p>
        <p>What happens if your input itself contains a <code>'</code>? If the page doesn't filter input, you can <b>rewrite</b> the query.</p>`),
      objectives: [
        { text: tr('Rufe die Webseite auf', 'Open the website'), check: ev('curl', e => e.path === '/') },
        { text: tr('Provoziere einen SQL-Fehler', 'Provoke a SQL error'), check: ev('sqlerror') },
        { text: tr('Logge dich ohne Passwort als admin ein', 'Log in as admin without a password'), check: ev('sqli') },
      ],
      hints: [
        tr('Starte mit <code>curl http://10.20.0.80/</code> und lies den HTML-Kommentar. Teste dann einen normalen Login: <code>curl "http://10.20.0.80/login?user=admin&pass=test"</code>', 'Start with <code>curl http://10.20.0.80/</code> and read the HTML comment. Then test a normal login: <code>curl "http://10.20.0.80/login?user=admin&pass=test"</code>'),
        tr('Setze ein einzelnes <code>\'</code> in das Passwort. Die Fehlermeldung zeigt dir die Abfrage. Kannst du die Bedingung so ergänzen, dass sie <b>immer wahr</b> ist? Tipp: <code>OR \'1\'=\'1</code>', 'Put a single <code>\'</code> into the password. The error message shows you the query. Can you extend the condition so that it is <b>always true</b>? Tip: <code>OR \'1\'=\'1</code>'),
        tr('<code>curl "http://10.20.0.80/login?user=admin&pass=\' OR \'1\'=\'1"</code> – die Abfrage wird zu <code>...pass=\'\' OR \'1\'=\'1\'</code>, also immer wahr.', '<code>curl "http://10.20.0.80/login?user=admin&pass=\' OR \'1\'=\'1"</code> – the query becomes <code>...pass=\'\' OR \'1\'=\'1\'</code>, which is always true.'),
      ],
      learned: tr('Ungefilterte Eingaben in SQL-Abfragen sind gefährlich. Entwickler müssen Prepared Statements nutzen!', 'Unfiltered input in SQL queries is dangerous. Developers must use prepared statements!'),
      setup() {
        const k = kali('10.20.0.5', {
          'auftrag.txt': F(tr('Ziel: MegaShop-Webserver 10.20.0.80\nLogge dich in den Adminbereich ein.\nDas Admin-Passwort kennen wir nicht ...', 'Target: MegaShop web server 10.20.0.80\nLog in to the admin area.\nWe don\'t know the admin password ...')),
          'sql_spickzettel.txt': F(tr("SQL-Grundlagen\n--------------\n'   beendet einen Text in SQL\nOR  verknüpft Bedingungen: wahr, wenn EINE Seite wahr ist\n'1'='1'  ist immer wahr\n--  oder #  leitet einen Kommentar ein (Rest wird ignoriert)",
            "SQL basics\n----------\n'   ends a text string in SQL\nOR  combines conditions: true if EITHER side is true\n'1'='1'  is always true\n--  or #  starts a comment (the rest is ignored)")),
        });
        const web = host({
          name: 'megashop', ip: '10.20.0.80', users: { root: {} }, fs: linuxFS({ hostname: 'megashop' }),
          services: [
            { port: 80, name: 'http', version: 'Apache httpd 2.4.41 (PHP 7.4)', web: webApp({
              title: 'MegaShop', users: { admin: 'xT9!vQ2#mm', lisa: 'L1sa2026' },
              onAdmin: u => tr(
                `<h1>Willkommen im Adminbereich, ${u}!</h1>\n  Umsatz heute: 13.337 €\n  Offene Bestellungen: 42\n\n  ${C('g', 'Geheime Notiz: HACKIT{sql_1nj3ct10n_ftw}')}`,
                `<h1>Welcome to the admin area, ${u}!</h1>\n  Revenue today: €13,337\n  Open orders: 42\n\n  ${C('g', 'Secret note: HACKIT{sql_1nj3ct10n_ftw}')}`),
            }) },
          ],
        });
        return world([k, web], { ip: '10.20.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 12 ------------------------------ */
    {
      chapter: 2, title: tr('Root werden', 'Becoming Root'), category: 'Privilege Escalation', difficulty: 4,
      flag: 'HACKIT{r00t_v1a_gtf0b1ns}',
      commands: ['sudo'],
      newCommands: [
        { cmd: 'sudo -l', desc: tr('zeigt, was du als root ausführen darfst', 'shows what you may run as root') },
        { cmd: tr('sudo BEFEHL', 'sudo COMMAND'), desc: tr('führt einen Befehl als root aus', 'runs a command as root') },
        { cmd: 'find ... -exec CMD {} \\;', desc: tr('führt CMD für jeden Treffer aus', 'runs CMD for every match') },
      ],
      story: tr(`<p>Du hast über eine Lücke eine Shell auf dem MegaShop-Server – aber nur als <code>www-data</code>, der Benutzer des Webservers. Der wertvollste Account ist <b>root</b>: Er darf <i>alles</i>.</p>
        <p>Admins vergeben manchmal per <code>sudo</code> einzelne Root-Rechte. Doch viele harmlose Programme können mehr, als man denkt … (Profis schlagen sowas auf <b>GTFOBins</b> nach.)</p>`,
      `<p>Through a vulnerability you got a shell on the MegaShop server – but only as <code>www-data</code>, the web server's user. The most valuable account is <b>root</b>: it may do <i>everything</i>.</p>
        <p>Admins sometimes grant individual root rights via <code>sudo</code>. But many harmless-looking programs can do more than you'd think … (Pros look these up on <b>GTFOBins</b>.)</p>`),
      objectives: [
        { text: tr('Finde heraus, welche sudo-Rechte du hast', 'Find out which sudo rights you have'), check: ev('sudo-l') },
        { text: tr('Nutze sudo mit dem erlaubten Programm', 'Use sudo with the allowed program'), check: ev('sudo', e => e.cmd === 'find') },
        { text: tr('Lies /root/flag.txt', 'Read /root/flag.txt'), check: ev('read', e => e.path === '/root/flag.txt') },
      ],
      hints: [
        tr('Versuche <code>cat /root/flag.txt</code> – keine Chance. Prüfe mit <code>sudo -l</code>, was du als root ausführen darfst. Die Notiz in <code>html/.notizen</code> ist auch interessant.', 'Try <code>cat /root/flag.txt</code> – no chance. Check with <code>sudo -l</code> what you may run as root. The note in <code>html/.notizen</code> is interesting too.'),
        tr('Du darfst <code>find</code> als root starten. find hat die Option <code>-exec</code>, die für jeden Treffer einen Befehl ausführt – und zwar mit den Rechten von find!', 'You may run <code>find</code> as root. find has the option <code>-exec</code>, which runs a command for every match – with find\'s privileges!'),
        tr('<code>sudo find /root -name flag.txt -exec cat {} \\;</code><br>Oder für eine komplette Root-Shell: <code>sudo find . -exec /bin/sh \\;</code>', '<code>sudo find /root -name flag.txt -exec cat {} \\;</code><br>Or for a full root shell: <code>sudo find . -exec /bin/sh \\;</code>'),
      ],
      learned: tr('Zu großzügige sudo-Rechte sind ein Klassiker der Rechteausweitung.', 'Overly generous sudo rights are a classic path to privilege escalation.'),
      setup() {
        const web = host({
          name: 'megashop', ip: '10.20.0.80',
          users: { 'www-data': { password: null, home: ['var', 'www'] }, root: { password: 'n0pe!n0pe' } },
          sudo: { 'www-data': ['find'] },
          fs: linuxFS({
            hostname: 'megashop', users: {},
            root: { 'flag.txt': F(tr('Du bist root! Das System gehört dir.\n\nHACKIT{r00t_v1a_gtf0b1ns}', 'You are root! The system is yours.\n\nHACKIT{r00t_v1a_gtf0b1ns}')) },
            extra: {
              var: D({ www: D({ html: D({
                'index.php': F('<?php include "login.php"; ?>'),
                'login.php': F(tr('<?php $q = "SELECT * FROM users WHERE user=\'$u\'"; // TODO: absichern ?>', '<?php $q = "SELECT * FROM users WHERE user=\'$u\'"; // TODO: secure this ?>')),
                '.notizen': F(tr('TODO (Admin):\n- Cleanup-Skript braucht "find" als root -> sudo-Regel für www-data angelegt.\n- Muss ich irgendwann wieder entfernen... ist ja nur find, was soll passieren?',
                  'TODO (admin):\n- Cleanup script needs "find" as root -> created sudo rule for www-data.\n- Should remove it again someday... it\'s only find, what could happen?')),
              }, { owner: 'www-data' }) }, { owner: 'www-data' }) }),
            },
          }),
          services: [{ port: 22, name: 'ssh', version: 'OpenSSH 8.2' }, { port: 80, name: 'http', version: 'Apache 2.4.41' }],
        });
        return world([web], { ip: '10.20.0.80', user: 'www-data' });
      },
    },

    /* ------------------------------ 13 ------------------------------ */
    {
      chapter: 3, title: 'Operation Blackout', category: tr('Finale', 'Finale'), difficulty: 5,
      flag: 'HACKIT{0p3r4t10n_bl4ck0ut_c0mpl3t3}',
      commands: [],
      newCommands: [
        { cmd: tr('Alles!', 'Everything!'), desc: tr('Kombiniere, was du gelernt hast', 'Combine everything you\'ve learned') },
      ],
      story: tr(`<p><b>Zero:</b> „Das ist deine Abschlussprüfung. MegaCorp betreibt im Netz <code>10.66.0.0/24</code> einen hochsicheren Server namens <b>vault</b>. Darauf liegt <code>/root/blackout.txt</code>.</p>
        <p>Ich gebe dir keine Anleitung mehr – nur meine Tipps, wenn du sie brauchst. Zeig mir, was du gelernt hast."</p>`,
      `<p><b>Zero:</b> "This is your final exam. MegaCorp runs a high-security server called <b>vault</b> in the network <code>10.66.0.0/24</code>. On it lies <code>/root/blackout.txt</code>.</p>
        <p>I won't give you instructions anymore – only my tips, if you need them. Show me what you've learned."</p>`),
      objectives: [
        { text: tr('Erkunde das Zielnetz', 'Explore the target network'), check: ev('nmap', e => e.hosts.length > 1) },
        { text: tr('Verschaffe dir Zugang zum Webportal', 'Gain access to the web portal'), check: ev('sqli') },
        { text: tr('Entschlüssele die Wartungs-Zugangsdaten', 'Decode the maintenance credentials'), check: ev('decode', e => e.result.includes('Bl4ck0ut')) },
        { text: tr('Melde dich auf vault an', 'Log in to vault'), check: ev('login', e => e.host === 'vault') },
        { text: tr('Lies /root/blackout.txt', 'Read /root/blackout.txt'), check: ev('read', e => e.path === '/root/blackout.txt') },
      ],
      hints: [
        tr('Starte wie in Mission 9 mit einem Netzwerk-Scan: <code>nmap 10.66.0.0/24</code>. Auf vault kommst du nicht ohne Passwort – aber vielleicht verrät der Webserver etwas.', 'Start like in mission 9 with a network scan: <code>nmap 10.66.0.0/24</code>. You won\'t get onto vault without a password – but maybe the web server gives something away.'),
        tr('Das Portal auf 10.66.0.10 ist anfällig für SQL-Injection (wie Mission 11). Im Adminbereich findest du Base64-kodierte Zugangsdaten: <code>echo DATEN | base64 -d</code>. Auf vault hilft dann <code>sudo -l</code>.', 'The portal on 10.66.0.10 is vulnerable to SQL injection (like mission 11). In the admin area you\'ll find Base64-encoded credentials: <code>echo DATA | base64 -d</code>. On vault, <code>sudo -l</code> will help.'),
        tr('Login: <code>ssh ops@10.66.0.20</code>. Du darfst <code>base64</code> als root ausführen: <code>sudo base64 /root/blackout.txt | base64 -d</code>', 'Login: <code>ssh ops@10.66.0.20</code>. You may run <code>base64</code> as root: <code>sudo base64 /root/blackout.txt | base64 -d</code>'),
      ],
      learned: tr('Echte Angriffe sind Ketten aus vielen kleinen Schwachstellen. Du hast sie alle gemeistert!', 'Real attacks are chains of many small weaknesses. You mastered them all!'),
      setup() {
        const creds = Shell.b64encode('ops:Bl4ck0ut#2026');
        const k = kali('10.66.0.5', {
          'briefing.txt': F(tr('OPERATION BLACKOUT\n==================\nZiel:    MegaCorp-Netz 10.66.0.0/24\nAuftrag: /root/blackout.txt vom Server "vault" beschaffen.\n\nViel Glück. – Zero',
            'OPERATION BLACKOUT\n==================\nTarget:  MegaCorp network 10.66.0.0/24\nMission: retrieve /root/blackout.txt from the server "vault".\n\nGood luck. – Zero')),
        });
        const web = host({
          name: 'portal', ip: '10.66.0.10', users: { root: {} }, fs: linuxFS({ hostname: 'portal' }),
          services: [
            { port: 22, name: 'ssh', version: 'OpenSSH 8.9' },
            { port: 80, name: 'http', version: 'nginx 1.18 (PHP 8.1)', web: webApp({
              title: 'MegaCorp Portal', users: { administrator: 'n!eMaLs-r4ten', ops: 'Bl4ck0ut#2026' },
              onAdmin: u => tr(
                `<h1>MegaCorp Portal – Administration (${u})</h1>\n  Systemstatus: alles grün\n\n  ${C('y', 'Interne Notiz: Wartungszugang für vault (10.66.0.20)')}\n  ${C('y', 'Zugangsdaten (base64): ' + creds)}`,
                `<h1>MegaCorp Portal – Administration (${u})</h1>\n  System status: all green\n\n  ${C('y', 'Internal note: maintenance access for vault (10.66.0.20)')}\n  ${C('y', 'Credentials (base64): ' + creds)}`),
            }) },
          ],
        });
        const vault = host({
          name: 'vault', ip: '10.66.0.20', motd: C('r', tr('█ MEGACORP VAULT █  Jeder Zugriff wird protokolliert.', '█ MEGACORP VAULT █  All access is logged.')),
          users: { ops: { password: 'Bl4ck0ut#2026' }, root: { password: 'zXq!8a#Lp0$' } },
          sudo: { ops: ['base64'] },
          fs: linuxFS({
            hostname: 'vault', users: { ops: {} },
            homes: { ops: { 'wartung.txt': F(tr('Für das Backup-Skript darf ops "base64" als root ausführen.\nDas ist ja nur ein Kodier-Tool, also ungefährlich.', 'For the backup script, ops may run "base64" as root.\nIt\'s just an encoding tool, so it\'s harmless.')) } },
            root: { 'blackout.txt': F(tr('████ OPERATION BLACKOUT ████\n\nDu hast es geschafft, Hacker. Zero ist stolz auf dich.\n\nHACKIT{0p3r4t10n_bl4ck0ut_c0mpl3t3}', '████ OPERATION BLACKOUT ████\n\nYou did it, hacker. Zero is proud of you.\n\nHACKIT{0p3r4t10n_bl4ck0ut_c0mpl3t3}')) },
          }),
          services: [{ port: 22, name: 'ssh', version: 'OpenSSH 9.3' }],
        });
        const printer = host({
          name: 'printer', ip: '10.66.0.30', users: {}, fs: linuxFS({ hostname: 'printer' }),
          services: [{ port: 631, name: 'ipp', version: 'CUPS 2.4' }, { port: 9100, name: 'jetdirect', version: '' }],
        });
        return world([k, web, vault, printer], { ip: '10.66.0.5', user: 'hacker' });
      },
    },
  ];
}
