/* HACKIT – Fortgeschrittene Missionen (14–21), zweisprachig via tr(de, en) */

function advancedChapters() {
  return [
    {
      title: tr('Kapitel 5 · Experte', 'Chapter 5 · Expert'),
      desc: tr('Mehrstufige Forensik, Metadaten, Umgebungsvariablen und symmetrische Kryptografie.',
        'Multi-stage forensics, metadata, environment variables and symmetric cryptography.'),
    },
    {
      title: tr('Kapitel 6 · Meister', 'Chapter 6 · Master'),
      desc: tr('Komplexe Systemanalyse, Web-APIs, Netzwerk-Sprungbretter und das große Finale.',
        'Complex system analysis, web APIs, network jump hosts and the grand finale.'),
    },
    {
      title: tr('Kapitel 7 · Großmeister', 'Chapter 7 · Grandmaster'),
      desc: tr('Maximale Herausforderung: Mehrstufige Krypto-Ketten, Ablenkungsmanöver, API-Exploits und tiefes Pivoting.',
        'Maximum challenge: multi-stage crypto chains, decoys, API exploits and deep pivoting.'),
    },
  ];
}

function advancedLevels() {
  const { kali, world, binary, ev } = LevelKit;
  const { D, F, linuxFS, host } = VFS;

  return [
    /* ------------------------------ 14 ------------------------------ */
    {
      chapter: 4,
      title: tr('Spuren im Bild', 'Traces in the Image'),
      category: tr('Forensik', 'Forensics'),
      difficulty: 4,
      flag: 'HACKIT{3x1f_m3t4d4t4_l34k}',
      commands: ['exiftool'],
      newCommands: [
        { cmd: 'exiftool DATEI', desc: tr('zeigt Metadaten einer Datei an', 'displays file metadata') },
      ],
      story: tr(
        `<p>Fotos und Dokumente speichern oft unsichtbare Zusatzinformationen – sogenannte <b>EXIF-Metadaten</b> (Kamera, GPS-Koordinaten, Autor oder Kommentare).</p>
         <p>In deinem Ordner liegen drei Bilddateien. Eine davon enthält einen kodierten Hinweis auf den Archiv-Server <code>10.30.0.15</code>.</p>`,
        `<p>Photos and documents often store invisible extra data called <b>EXIF metadata</b> (camera model, GPS coordinates, author or comments).</p>
         <p>Your folder contains three image files. One of them holds an encoded clue pointing to the archive server <code>10.30.0.15</code>.</p>`
      ),
      objectives: [
        { text: tr('Untersuche die Bilder mit exiftool', 'Inspect the images with exiftool'), check: ev('exif', e => e.path.includes('beweis.jpg')) },
        { text: tr('Dekodiere den Base64-Kommentar', 'Decode the Base64 comment'), check: ev('decode', e => e.result.includes('archiv')) },
        { text: tr('Melde dich auf 10.30.0.15 an', 'Log in to 10.30.0.15'), check: ev('login', e => e.host === 'archive') },
        { text: tr('Lies die Flag auf dem Archiv-Server', 'Read the flag on the archive server'), check: ev('read', e => e.host === 'archive' && e.path.endsWith('flag.txt')) },
      ],
      hints: [
        tr('Prüfe alle Bilder mit <code>exiftool logo.png</code>, <code>exiftool banner.jpg</code> und <code>exiftool beweis.jpg</code>.',
          'Check all images with <code>exiftool logo.png</code>, <code>exiftool banner.jpg</code> and <code>exiftool beweis.jpg</code>.'),
        tr('Im Feld <code>Comment</code> von <code>beweis.jpg</code> steht ein Base64-Text. Dekodiere ihn mit <code>echo TEXT | base64 -d</code>.',
          'The <code>Comment</code> field of <code>beweis.jpg</code> contains Base64 text. Decode it with <code>echo TEXT | base64 -d</code>.'),
        tr('<code>echo YXJjaGl2OmZvdG9fMjAyNg== | base64 -d</code> liefert <code>archiv:foto_2026</code>. Melde dich mit <code>ssh archiv@10.30.0.15</code> an und lies <code>flag.txt</code>.',
          '<code>echo YXJjaGl2OmZvdG9fMjAyNg== | base64 -d</code> gives <code>archiv:foto_2026</code>. Log in via <code>ssh archiv@10.30.0.15</code> and read <code>flag.txt</code>.'),
      ],
      learned: tr('Bilddateien sollten vor der Veröffentlichung von Metadaten bereinigt werden.',
        'Image files should be stripped of metadata before publishing.'),
      setup() {
        const k = kali('10.30.0.5', {
          'logo.png': F('\x89PNG...', { binary: true, meta: { 'File Name': 'logo.png', 'Image Size': '512x512', Software: 'GIMP 2.10', Author: 'Design Team' } }),
          'banner.jpg': F('\xff\xd8\xff...', { binary: true, meta: { 'File Name': 'banner.jpg', 'Image Size': '1920x400', Camera: 'Canon EOS', Comment: tr('Nur ein Werbebanner', 'Just a promo banner') } }),
          'beweis.jpg': F('\xff\xd8\xff...', { binary: true, meta: {
            'File Name': 'beweis.jpg',
            'Image Size': '4032x3024',
            'GPS Position': '52 deg 31\' 12.00" N, 13 deg 24\' 18.00" E',
            Author: 'm.weber',
            Comment: 'SSH 10.30.0.15 -> YXJjaGl2OmZvdG9fMjAyNg==',
          } }),
        });
        const archive = host({
          name: 'archive', ip: '10.30.0.15',
          users: { archiv: { password: 'foto_2026' }, root: {} },
          fs: linuxFS({
            hostname: 'archive', users: { archiv: {} },
            homes: { archiv: { 'flag.txt': F(tr('Metadaten verraten oft mehr als das Bild selbst!\n\nHACKIT{3x1f_m3t4d4t4_l34k}', 'Metadata often reveals more than the picture itself!\n\nHACKIT{3x1f_m3t4d4t4_l34k}')) } },
          }),
          services: [{ port: 22, name: 'ssh', version: 'OpenSSH 8.9' }],
        });
        return world([k, archive], { ip: '10.30.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 15 ------------------------------ */
    {
      chapter: 4,
      title: tr('Umgebung & Modus', 'Environment & Mode'),
      category: tr('Systemanalyse', 'System Analysis'),
      difficulty: 4,
      flag: 'HACKIT{3nv_v4rs_c0ntr0l_fl0w}',
      commands: ['env', 'export'],
      newCommands: [
        { cmd: 'env', desc: tr('zeigt alle Umgebungsvariablen', 'lists all environment variables') },
        { cmd: 'export NAME=WERT', desc: tr('setzt eine Umgebungsvariable', 'sets an environment variable') },
      ],
      story: tr(
        `<p>Programme lesen Einstellungen häufig aus <b>Umgebungsvariablen</b> statt aus Dateien. Mit <code>env</code> machst du sie sichtbar, mit <code>export</code> änderst du sie für deine Sitzung.</p>
         <p>Das Diagnoseprogramm <code>./check_vault</code> verweigert die Ausgabe, solange die Umgebung nicht stimmt.</p>`,
        `<p>Programs often read settings from <b>environment variables</b> instead of files. Use <code>env</code> to inspect them and <code>export</code> to change them for your session.</p>
         <p>The diagnostic utility <code>./check_vault</code> refuses to output the key until the environment matches what it expects.</p>`
      ),
      objectives: [
        { text: tr('Inspiziere die Umgebungsvariablen mit env', 'Inspect environment variables with env'), check: ev('env') },
        { text: tr('Setze VAULT_ENV auf debug', 'Set VAULT_ENV to debug'), check: ev('export', e => e.key === 'VAULT_ENV' && e.value === 'debug') },
        { text: tr('Starte ./check_vault im Debug-Modus', 'Run ./check_vault in debug mode'), check: ev('vault_debug') },
      ],
      hints: [
        tr('Schau dir zuerst mit <code>env</code> die aktuellen Variablen an und starte einmal <code>./check_vault</code>.',
          'First inspect current variables with <code>env</code> and run <code>./check_vault</code> once.'),
        tr('In <code>env</code> siehst du <code>VAULT_ENV=production</code> und einen Hinweis in <code>VAULT_PIN</code>. Das Programm verlangt <code>VAULT_ENV=debug</code>.',
          'In <code>env</code> you can see <code>VAULT_ENV=production</code> and a pin in <code>VAULT_PIN</code>. The program requires <code>VAULT_ENV=debug</code>.'),
        tr('Führe <code>export VAULT_ENV=debug</code> aus, starte dann <code>./check_vault</code> und gib die PIN aus <code>env</code> (<code>7391</code>) ein.',
          'Run <code>export VAULT_ENV=debug</code>, then run <code>./check_vault</code> and enter the PIN from <code>env</code> (<code>7391</code>).'),
      ],
      learned: tr('Umgebungsvariablen steuern das Verhalten von Prozessen und sollten keine sensiblen Geheimnisse im Klartext halten.',
        'Environment variables control process behavior and should not expose sensitive secrets carelessly.'),
      setup() {
        const checkVault = F('\x7fELF...', {
          exec: true, binary: true,
          async run(ctx) {
            const curEnv = (ctx.sess.env && ctx.sess.env.VAULT_ENV) || ctx.sess.host.env.VAULT_ENV;
            if (curEnv !== 'debug') {
              return C('y', tr('Status: VAULT_ENV ist auf "production" gesetzt. Diagnose-Ausgabe nur bei VAULT_ENV=debug verfügbar.',
                'Status: VAULT_ENV is set to "production". Diagnostic output is only available when VAULT_ENV=debug.'));
            }
            const pin = await ctx.term.ask(tr('VAULT_PIN eingeben: ', 'Enter VAULT_PIN: '), false);
            if (pin.trim() !== '7391') return C('r', tr('Falsche PIN (siehe env).', 'Wrong PIN (check env).'));
            ctx.emit({ type: 'vault_debug' });
            return `${C('g', tr('Diagnose erfolgreich:', 'Diagnostics successful:'))}\n  HACKIT{3nv_v4rs_c0ntr0l_fl0w}`;
          },
        });
        const h = host({
          name: 'devbox', ip: '10.35.0.10',
          users: { hacker: { password: 'x' }, root: {} },
          fs: linuxFS({
            hostname: 'devbox', users: { hacker: {} },
            homes: { hacker: {
              check_vault: checkVault,
              'readme.txt': F(tr('Tipp: ./check_vault liest VAULT_ENV und VAULT_PIN aus der aktuellen Umgebung (env).',
                'Tip: ./check_vault reads VAULT_ENV and VAULT_PIN from the current environment (env).')),
            } },
          }),
        });
        h.env = { VAULT_ENV: 'production', VAULT_PIN: '7391' };
        return world([h], { ip: '10.35.0.10', user: 'hacker' });
      },
    },

    /* ------------------------------ 16 ------------------------------ */
    {
      chapter: 4,
      title: tr('Symmetrisches XOR', 'Symmetric XOR'),
      category: tr('Kryptografie', 'Cryptography'),
      difficulty: 4,
      flag: 'HACKIT{x0r_1st_symm3tr1sch}',
      commands: ['xor'],
      newCommands: [
        { cmd: 'xor -k KEY --hex DATEI', desc: tr('entschlüsselt eine Hex-kodierte XOR-Datei', 'decrypts a hex-encoded XOR file') },
      ],
      story: tr(
        `<p>Die <b>XOR-Verknüpfung</b> (Exklusiv-Oder) ist ein Grundbaustein moderner Kryptografie: Wendet man denselben Schlüssel zweimal an, erhält man wieder den Originaltext.</p>
         <p>Du hast eine verschlüsselte Hex-Nachricht <code>bericht.xor</code> und ein Speicherabbild <code>keycache.bin</code>. Finde den Schlüssel im Abbild und entschlüssele den Bericht.</p>`,
        `<p>The <b>XOR operation</b> (exclusive OR) is a building block of modern cryptography: applying the same key twice restores the original plaintext.</p>
         <p>You found an encrypted hex message <code>bericht.xor</code> and a binary dump <code>keycache.bin</code>. Recover the key from the binary and decrypt the message.</p>`
      ),
      objectives: [
        { text: tr('Extrahiere den XOR-Schlüssel mit strings', 'Extract the XOR key with strings'), check: ev('strings', e => e.file.includes('keycache.bin')) },
        { text: tr('Entschlüssele bericht.xor mit xor', 'Decrypt bericht.xor with xor'), check: ev('decode', e => e.algo === 'xor' && e.result.includes('HACKIT{x0r')) },
      ],
      hints: [
        tr('Mit <code>strings keycache.bin</code> durchsuchst du die Binärdatei nach lesbaren Hinweisen auf den Schlüssel.',
          'Use <code>strings keycache.bin</code> to search the binary dump for readable clues about the key.'),
        tr('In der Ausgabe von <code>strings</code> steht <code>XOR_KEY=N3BULA</code>. Nutze <code>xor -k SCHLÜSSEL --hex DATEI</code>.',
          'The output of <code>strings</code> contains <code>XOR_KEY=N3BULA</code>. Use <code>xor -k KEY --hex FILE</code>.'),
        tr('Gib <code>xor -k N3BULA --hex bericht.xor</code> ein.',
          'Run <code>xor -k N3BULA --hex bericht.xor</code>.'),
      ],
      learned: tr('XOR mit kurzem, wiederholtem Schlüssel ist anfällig, sobald der Schlüssel entdeckt oder erraten wird.',
        'Repeating-key XOR is vulnerable as soon as the key is discovered or guessed.'),
      setup() {
        const dump = binary(['ELF_CACHE_V2', 'SESSION_ID=9912', 'XOR_KEY=N3BULA', 'STATUS=LOCKED']);
        return world([kali('10.38.0.5', {
          'bericht.xor': F('09562a30252c2b416217293327502a2176610a563075163429412b332a322d5c26306c2d2f46363038610672011e0515354b722713703d471d26352c230036277d322d5b3f'),
          'keycache.bin': F(dump, { binary: true }),
          'notiz.txt': F(tr('bericht.xor wurde im Hex-Format mit einem 6-stelligen XOR-Schlüssel aus keycache.bin erzeugt.',
            'bericht.xor was created in hex format using a 6-character XOR key stored inside keycache.bin.')),
        })], { ip: '10.38.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 17 ------------------------------ */
    {
      chapter: 4,
      title: tr('Rechte & Werkzeuge', 'Permissions & Tools'),
      category: tr('Terminal', 'Terminal'),
      difficulty: 4,
      flag: 'HACKIT{chm0d_m4ch7_3x3cut4bl3}',
      commands: ['chmod'],
      newCommands: [
        { cmd: 'chmod +x DATEI', desc: tr('macht ein Skript oder Programm ausführbar', 'makes a script or binary executable') },
        { cmd: 'BEFEHL > DATEI', desc: tr('schreibt die Ausgabe in eine Datei', 'writes command output into a file') },
      ],
      story: tr(
        `<p>Unter Linux kann ein Programm nur gestartet werden, wenn das <b>Ausführungsrecht (x)</b> gesetzt ist. Mit <code>ls -l</code> erkennst du die Rechte, mit <code>chmod +x</code> aktivierst du sie.</p>
         <p>Außerdem verlangt das Prüfprogramm <code>./unlocker</code> eine Schlüsseldatei <code>/tmp/token.txt</code> mit dem dekodierten Token aus <code>token.b64</code>.</p>`,
        `<p>On Linux, a program can only be executed when its <b>execute permission (x)</b> is set. Check permissions with <code>ls -l</code> and enable execution with <code>chmod +x</code>.</p>
         <p>In addition, the verification tool <code>./unlocker</code> expects a file <code>/tmp/token.txt</code> containing the decoded token from <code>token.b64</code>.</p>`
      ),
      objectives: [
        { text: tr('Schreibe das dekodierte Token nach /tmp/token.txt', 'Write the decoded token to /tmp/token.txt'), check: ev('write', e => e.path === '/tmp/token.txt') },
        { text: tr('Mache unlocker mit chmod +x ausführbar', 'Make unlocker executable with chmod +x'), check: ev('chmod', e => e.path.endsWith('/unlocker')) },
        { text: tr('Führe ./unlocker aus', 'Run ./unlocker'), check: ev('unlocker_ok') },
      ],
      hints: [
        tr('Dekodiere zuerst <code>token.b64</code> und leite die Ausgabe mit <code>&gt;</code> direkt nach <code>/tmp/token.txt</code> um.',
          'First decode <code>token.b64</code> and redirect the output with <code>&gt;</code> directly to <code>/tmp/token.txt</code>.'),
        tr('<code>base64 -d token.b64 > /tmp/token.txt</code> erstellt die Datei. Danach musst du <code>unlocker</code> mit <code>chmod +x unlocker</code> ausführbar machen.',
          '<code>base64 -d token.b64 > /tmp/token.txt</code> creates the file. Next, make <code>unlocker</code> executable with <code>chmod +x unlocker</code>.'),
        tr('Führe <code>base64 -d token.b64 > /tmp/token.txt && chmod +x unlocker && ./unlocker</code> aus.',
          'Run <code>base64 -d token.b64 > /tmp/token.txt && chmod +x unlocker && ./unlocker</code>.'),
      ],
      learned: tr('Mit chmod +x und Ausgabeumleitung (>) kombinierst du Werkzeuge wie auf einem echten Linux-System.',
        'With chmod +x and output redirection (>) you can chain tools just like on a real Linux system.'),
      setup() {
        const expected = 'AUTH-TOKEN-2026-OMEGA';
        const unlocker = F('#!/bin/bash\n# token verifier', {
          exec: false, owner: 'hacker',
          async run(ctx) {
            const tok = VFS.get(ctx.sess.host.fs, ['tmp', 'token.txt']);
            if (!tok || tok.type !== 'file') {
              return C('r', tr('Fehler: /tmp/token.txt wurde nicht gefunden. Nutze > zur Umleitung.',
                'Error: /tmp/token.txt not found. Use > to redirect output.'));
            }
            if (tok.content.trim() !== expected) {
              return C('r', tr('Fehler: /tmp/token.txt enthält noch nicht das dekodierte Token.',
                'Error: /tmp/token.txt does not contain the decoded token yet.'));
            }
            ctx.emit({ type: 'unlocker_ok' });
            return `${C('g', tr('Token bestätigt!', 'Token verified!'))}\n\nHACKIT{chm0d_m4ch7_3x3cut4bl3}`;
          },
        });
        return world([kali('10.42.0.5', {
          'token.b64': F(Shell.b64encode(expected)),
          unlocker,
          'anleitung.txt': F(tr('1. Dekodiere token.b64 nach /tmp/token.txt\n2. Setze Ausführungsrechte für unlocker\n3. Starte ./unlocker',
            '1. Decode token.b64 into /tmp/token.txt\n2. Grant execute permission to unlocker\n3. Run ./unlocker')),
        })], { ip: '10.42.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 18 ------------------------------ */
    {
      chapter: 5,
      title: tr('Geplante Aufgaben', 'Scheduled Tasks'),
      category: tr('Forensik', 'Forensics'),
      difficulty: 5,
      flag: 'HACKIT{cr0nt4b_spu3rt_j0bs_4uf}',
      commands: ['crontab'],
      newCommands: [
        { cmd: 'crontab -l', desc: tr('zeigt regelmäßig geplante Hintergrund-Aufgaben', 'shows scheduled background tasks') },
      ],
      story: tr(
        `<p>Auf Servern laufen oft automatische Hintergrund-Jobs (<b>Cronjobs</b>), die Backups anlegen oder Berichte schreiben. Mit <code>crontab -l</code> siehst du, welche Jobs eingerichtet sind.</p>
         <p>Finde heraus, wohin der nächtliche Archivierungs-Job seine Ausgaben schreibt, und rekonstruiere daraus die Flag.</p>`,
        `<p>Servers often run automated background tasks (<b>cron jobs</b>) that create backups or write reports. Use <code>crontab -l</code> to see which jobs are configured.</p>
         <p>Find out where the nightly archiving job writes its output and reconstruct the flag from it.</p>`
      ),
      objectives: [
        { text: tr('Prüfe die geplanten Aufgaben mit crontab -l', 'Check scheduled tasks with crontab -l'), check: ev('crontab') },
        { text: tr('Finde den Schlüsselhinweis im Job-Verzeichnis', 'Find the key clue in the job directory'), check: ev('read', e => e.path.includes('/var/spool/reports/')) },
        { text: tr('Entschlüssele das Archiv-Fragment mit caesar', 'Decrypt the archive fragment with caesar'), check: ev('decode', e => e.algo === 'caesar' && e.result.includes('HACKIT{cr0nt4b')) },
      ],
      hints: [
        tr('Rufe <code>crontab -l</code> auf. Dort siehst du die genauen Pfade der ausgeführten Skripte und Berichte.',
          'Run <code>crontab -l</code>. It lists the exact paths of the executed scripts and reports.'),
        tr('Der Cronjob schreibt nach <code>/var/spool/reports/.nightly.out</code>. Schau dir dieses Verzeichnis mit <code>ls -a /var/spool/reports</code> an.',
          'The cron job writes to <code>/var/spool/reports/.nightly.out</code>. Inspect that directory with <code>ls -a /var/spool/reports</code>.'),
        tr('Lies <code>cat /var/spool/reports/.nightly.out</code> und entschlüssele es mit <code>caesar --brute /var/spool/reports/.nightly.out | grep HACKIT</code>.',
          'Read <code>cat /var/spool/reports/.nightly.out</code> and decrypt it with <code>caesar --brute /var/spool/reports/.nightly.out | grep HACKIT</code>.'),
      ],
      learned: tr('Cronjobs verraten oft versteckte Pfade, Backup-Orte und interne Abläufe eines Servers.',
        'Cron jobs often reveal hidden paths, backup locations and internal workflows on a server.'),
      setup() {
        const plain = 'NIGHTLY REPORT OK - ARCHIVE CODE: HACKIT{cr0nt4b_spu3rt_j0bs_4uf}';
        const h = host({
          name: 'cronbox', ip: '10.48.0.12',
          users: { operator: { password: 'x' }, root: {} },
          fs: linuxFS({
            hostname: 'cronbox', users: { operator: {} },
            homes: { operator: {
              'notiz.txt': F(tr('Der nächtliche Report-Job läuft automatisch über cron. Prüfe die Crontab.',
                'The nightly report job runs automatically via cron. Check the crontab.')),
            } },
            extra: {
              var: D({
                log: D({ 'syslog': F('Nov 18 03:00:01 cronbox CRON[412]: (root) CMD (/usr/local/bin/nightly_report.sh)') }),
                spool: D({
                  reports: D({
                    'readme.txt': F(tr('Öffentliche Berichte sind leer. Das Archiv liegt in einer versteckten Datei.',
                      'Public reports are empty. The archive is stored in a hidden file.')),
                    '.nightly.out': F(Shell.caesar(plain, 17)),
                  }),
                }),
              }),
            },
          }),
        });
        h.cron = [
          { schedule: '0 3 * * *', user: 'root', cmd: '/usr/local/bin/nightly_report.sh --rot > /var/spool/reports/.nightly.out' },
          { schedule: '*/15 * * * *', user: 'operator', cmd: '/usr/bin/uptime > /tmp/health.txt' },
        ];
        return world([h], { ip: '10.48.0.12', user: 'operator' });
      },
    },

    /* ------------------------------ 19 ------------------------------ */
    {
      chapter: 5,
      title: tr('Header & Tokens', 'Headers & Tokens'),
      category: tr('Web', 'Web'),
      difficulty: 5,
      flag: 'HACKIT{http_h34d3r_m4st3r}',
      commands: [],
      newCommands: [
        { cmd: 'curl -H "Name: Wert" URL', desc: tr('sendet einen eigenen HTTP-Header mit', 'sends a custom HTTP header') },
      ],
      story: tr(
        `<p>Moderne Web-APIs tauschen Sitzungsdaten oft über <b>HTTP-Header</b> aus. Mit <code>curl -H "Header: Wert"</code> kannst du eigene Header mitschicken.</p>
         <p>Untersuche den API-Server auf <code>10.50.0.90</code>: Hole dir unter <code>/token</code> ein Gast-Token, analysiere sein Format und rufe <code>/status</code> mit der Rolle <code>auditor</code> ab.</p>`,
        `<p>Modern web APIs often exchange session data via <b>HTTP headers</b>. With <code>curl -H "Header: Value"</code> you can send custom headers.</p>
         <p>Inspect the API server at <code>10.50.0.90</code>: fetch a guest token from <code>/token</code>, analyze its format and request <code>/status</code> with role <code>auditor</code>.</p>`
      ),
      objectives: [
        { text: tr('Rufe die API-Dokumentation auf 10.50.0.90 ab', 'Fetch the API documentation on 10.50.0.90'), check: ev('curl', e => e.path === '/') },
        { text: tr('Dekodiere das Base64-Token von /token', 'Decode the Base64 token from /token'), check: ev('decode', e => e.result.includes('role=guest')) },
        { text: tr('Rufe /status mit gültigem Auditor-Header ab', 'Request /status with a valid auditor header'), check: ev('api_auditor') },
      ],
      hints: [
        tr('Starte mit <code>curl http://10.50.0.90/</code> und danach <code>curl http://10.50.0.90/token</code>.',
          'Start with <code>curl http://10.50.0.90/</code> and then <code>curl http://10.50.0.90/token</code>.'),
        tr('Dekodiere das Token mit <code>echo dXNlcj1nYXN0O3JvbGU9Z3Vlc3Q= | base64 -d</code> → <code>user=gast;role=guest</code>. Kodiere nun denselben Text mit <code>role=auditor</code>!',
          'Decode the token with <code>echo dXNlcj1nYXN0O3JvbGU9Z3Vlc3Q= | base64 -d</code> → <code>user=gast;role=guest</code>. Now encode the same string with <code>role=auditor</code>!'),
        tr('<code>echo "user=gast;role=auditor" | base64</code> ergibt <code>dXNlcj1nYXN0O3JvbGU9YXVkaXRvcg==</code>. Rufe dann <code>curl -H "X-Auth: dXNlcj1nYXN0O3JvbGU9YXVkaXRvcg==" http://10.50.0.90/status</code> auf.',
          '<code>echo "user=gast;role=auditor" | base64</code> yields <code>dXNlcj1nYXN0O3JvbGU9YXVkaXRvcg==</code>. Then run <code>curl -H "X-Auth: dXNlcj1nYXN0O3JvbGU9YXVkaXRvcg==" http://10.50.0.90/status</code>.'),
      ],
      learned: tr('Unterschriebene Tokens (wie HMAC/JWT) sind Pflicht – einfaches Base64 lässt sich beliebig abändern.',
        'Cryptographically signed tokens (like HMAC/JWT) are essential – plain Base64 can be modified at will.'),
      setup() {
        const guestTok = Shell.b64encode('user=gast;role=guest');
        const k = kali('10.50.0.5', {
          'notiz.txt': F(tr('Ziel-API: http://10.50.0.90/\nEndpunkte: / , /token , /status\nHeader-Syntax: curl -H "X-Auth: TOKEN" http://10.50.0.90/status',
            'Target API: http://10.50.0.90/\nEndpoints: / , /token , /status\nHeader syntax: curl -H "X-Auth: TOKEN" http://10.50.0.90/status')),
        });
        const api = host({
          name: 'apigw', ip: '10.50.0.90', users: { root: {} }, fs: linuxFS({ hostname: 'apigw' }),
          services: [{
            port: 80, name: 'http', version: 'nginx 1.24 (API Gateway)',
            web(path, _params, ctx, req = {}) {
              if (path === '/') {
                return `${C('d', 'HTTP/1.1 200 OK')}\n{\n  "service": "MegaCorp Audit API",\n  "endpoints": ["/token", "/status"],\n  "auth_header": "X-Auth: <base64-token>"\n}`;
              }
              if (path === '/token') {
                return `${C('d', 'HTTP/1.1 200 OK')}\n{\n  "token": "${guestTok}",\n  "note": "${tr('Sende dieses Token im Header X-Auth an /status', 'Send this token in the X-Auth header to /status')}"\n}`;
              }
              if (path === '/status') {
                const hdr = req.header || '';
                const m = hdr.match(/X-Auth:\s*(\S+)/i);
                if (!m) return `${C('y', 'HTTP/1.1 401 Unauthorized')}\n${tr('Header X-Auth fehlt.', 'Missing X-Auth header.')}`;
                let decoded = '';
                try { decoded = Shell.b64decode(m[1]); }
                catch { return `${C('r', 'HTTP/1.1 400 Bad Request')}\nInvalid Base64 token.`; }
                if (!/role=auditor\b/.test(decoded)) {
                  return `${C('y', 'HTTP/1.1 403 Forbidden')}\n${tr('Zugriff verweigert für Token:', 'Access denied for token:')} ${decoded} (${tr('erfordert role=auditor', 'requires role=auditor')})`;
                }
                ctx.emit({ type: 'api_auditor' });
                return `${C('g', 'HTTP/1.1 200 OK')}\n{\n  "audit_status": "verified",\n  "flag": "HACKIT{http_h34d3r_m4st3r}"\n}`;
              }
              return `${C('r', 'HTTP/1.1 404 Not Found')}`;
            },
          }],
        });
        return world([k, api], { ip: '10.50.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 20 ------------------------------ */
    {
      chapter: 5,
      title: tr('Das Sprungbrett', 'The Jump Host'),
      category: tr('Netzwerk', 'Network'),
      difficulty: 5,
      flag: 'HACKIT{p1v0t_v1a_b4st10n}',
      commands: [],
      newCommands: [
        { cmd: 'ssh → ssh', desc: tr('Von einem entfernten Rechner weiter zum nächsten verbinden', 'Connect from one remote host onward to an internal host') },
      ],
      story: tr(
        `<p>In echten Unternehmensnetzen sind wichtige Server <b>segmentiert</b>: Du erreichst sie nicht direkt von außen, sondern nur über einen vorgeschalteten <b>Jump-Host (Bastion)</b>.</p>
         <p>Erkunde das Netz <code>10.60.0.0/24</code>. Der Datenbank-Tresor <code>10.60.0.99</code> akzeptiert Verbindungen ausschließlich vom Bastion-Host <code>10.60.0.10</code>.</p>`,
        `<p>In real corporate networks, critical servers are <b>segmented</b>: you cannot reach them directly from the outside, only via an intermediate <b>jump host (bastion)</b>.</p>
         <p>Explore the <code>10.60.0.0/24</code> network. The database vault <code>10.60.0.99</code> only accepts connections coming from the bastion host <code>10.60.0.10</code>.</p>`
      ),
      objectives: [
        { text: tr('Scanne das Netz 10.60.0.0/24', 'Scan the network 10.60.0.0/24'), check: ev('nmap', e => e.hosts.length >= 2) },
        { text: tr('Melde dich auf bastion (10.60.0.10) an', 'Log in to bastion (10.60.0.10)'), check: ev('login', e => e.host === 'bastion') },
        { text: tr('Finde die Zugangsdaten für dbvault in der Umgebung', 'Find the dbvault credentials in the environment'), check: ev('env', e => e.host === 'bastion') },
        { text: tr('Verbinde dich von bastion weiter auf dbvault (10.60.0.99)', 'Connect from bastion onward to dbvault (10.60.0.99)'), check: ev('login', e => e.host === 'dbvault') },
        { text: tr('Lies die Flag auf dbvault', 'Read the flag on dbvault'), check: ev('read', e => e.host === 'dbvault' && e.path.endsWith('flag.txt')) },
      ],
      hints: [
        tr('Scanne mit <code>nmap 10.60.0.0/24</code>. Auf deinem Rechner liegt in <code>wartung.b64</code> der Zugang für <code>bastion</code> (10.60.0.10).',
          'Scan with <code>nmap 10.60.0.0/24</code>. On your machine, <code>wartung.b64</code> holds the login for <code>bastion</code> (10.60.0.10).'),
        tr('<code>base64 -d wartung.b64</code> verrät <code>bridge:Br1dg3_2026</code>. Verbinde dich mit <code>ssh bridge@10.60.0.10</code> und führe dort <code>env</code> aus.',
          '<code>base64 -d wartung.b64</code> reveals <code>bridge:Br1dg3_2026</code>. Connect via <code>ssh bridge@10.60.0.10</code> and run <code>env</code> there.'),
        tr('Auf <code>bastion</code> zeigt <code>env</code> die Variable <code>DBVAULT_LOGIN=vaultadmin:T1efImN3tz!</code>. Tippe direkt auf bastion <code>ssh vaultadmin@10.60.0.99</code> und lies <code>flag.txt</code>.',
          'On <code>bastion</code>, <code>env</code> shows <code>DBVAULT_LOGIN=vaultadmin:T1efImN3tz!</code>. Directly from bastion, run <code>ssh vaultadmin@10.60.0.99</code> and read <code>flag.txt</code>.'),
      ],
      learned: tr('Netzwerksegmentierung schützt interne Systeme – doch ein kompromittierter Jump-Host öffnet den Weg nach innen.',
        'Network segmentation protects internal systems – but a compromised jump host opens the path inward.'),
      setup() {
        const k = kali('10.60.0.5', {
          'wartung.b64': F(Shell.b64encode('Bastion SSH (10.60.0.10) -> bridge:Br1dg3_2026')),
          'info.txt': F(tr('Zielnetz: 10.60.0.0/24. Direkter Zugriff auf interne Vault-Systeme ist durch die Firewall blockiert.',
            'Target subnet: 10.60.0.0/24. Direct access to internal vault systems is blocked by the firewall.')),
        });
        const bastion = host({
          name: 'bastion', ip: '10.60.0.10',
          users: { bridge: { password: 'Br1dg3_2026' }, root: {} },
          fs: linuxFS({
            hostname: 'bastion', users: { bridge: {} },
            homes: { bridge: {
              'readme.txt': F(tr('Dieser Jump-Host darf 10.60.0.99 erreichen. Verbindungsdaten liegen in den Umgebungsvariablen.',
                'This jump host is allowed to reach 10.60.0.99. Connection credentials are stored in environment variables.')),
            } },
          }),
          services: [{ port: 22, name: 'ssh', version: 'OpenSSH 9.0' }],
        });
        bastion.env = { DBVAULT_HOST: '10.60.0.99', DBVAULT_LOGIN: 'vaultadmin:T1efImN3tz!' };
        const dbvault = host({
          name: 'dbvault', ip: '10.60.0.99',
          onlyFrom: ['10.60.0.10'],
          users: { vaultadmin: { password: 'T1efImN3tz!' }, root: {} },
          fs: linuxFS({
            hostname: 'dbvault', users: { vaultadmin: {} },
            homes: { vaultadmin: {
              'flag.txt': F(tr('Erfolgreich über den Bastion-Host verbunden!\n\nHACKIT{p1v0t_v1a_b4st10n}',
                'Successfully pivoted via the bastion host!\n\nHACKIT{p1v0t_v1a_b4st10n}')),
            } },
          }),
          services: [{ port: 22, name: 'ssh', version: 'OpenSSH 9.3' }],
        });
        return world([k, bastion, dbvault], { ip: '10.60.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 21 ------------------------------ */
    {
      chapter: 5,
      title: tr('Operation Phantom', 'Operation Phantom'),
      category: tr('Finale', 'Finale'),
      difficulty: 5,
      flag: 'HACKIT{0p3r4t10n_ph4nt0m_m4st3r}',
      commands: [],
      newCommands: [
        { cmd: tr('Meister-Kette', 'Master Chain'), desc: tr('Kombiniere Metadaten, XOR, Jump-Host, Crontab & Sudo', 'Combine metadata, XOR, jump host, crontab & sudo') },
      ],
      story: tr(
        `<p><b>Zero:</b> „Willkommen zur Meisterprüfung. Im Netz <code>10.77.0.0/24</code> verbirgt sich der interne Tresor-Rechner <b>phantom</b> (<code>10.77.0.50</code>), der nur über das Gateway <code>10.77.0.10</code> erreichbar ist.</p>
         <p>In deinem Startordner liegt nur eine abgefangene Bilddatei <code>ausweis.jpg</code> und ein XOR-Chiffretext <code>zugang.xor</code>. Kombiniere alle Techniken, die du gelernt hast!"</p>`,
        `<p><b>Zero:</b> "Welcome to the master exam. Hidden inside <code>10.77.0.0/24</code> is the internal vault host <b>phantom</b> (<code>10.77.0.50</code>), reachable only through the gateway <code>10.77.0.10</code>.</p>
         <p>Your starting folder only contains an intercepted image <code>ausweis.jpg</code> and an XOR ciphertext <code>zugang.xor</code>. Combine every technique you have learned!"</p>`
      ),
      objectives: [
        { text: tr('Lies den XOR-Schlüssel aus den Bild-Metadaten', 'Read the XOR key from the image metadata'), check: ev('exif', e => e.path.includes('ausweis.jpg')) },
        { text: tr('Entschlüssele zugang.xor mit xor', 'Decrypt zugang.xor with xor'), check: ev('decode', e => e.algo === 'xor' && e.result.includes('ghost:')) },
        { text: tr('Melde dich auf gateway (10.77.0.10) an', 'Log in to gateway (10.77.0.10)'), check: ev('login', e => e.host === 'gateway') },
        { text: tr('Springe weiter auf phantom (10.77.0.50)', 'Pivot onward to phantom (10.77.0.50)'), check: ev('login', e => e.host === 'phantom') },
        { text: tr('Lies /root/phantom.txt auf phantom', 'Read /root/phantom.txt on phantom'), check: ev('read', e => e.host === 'phantom' && e.path === '/root/phantom.txt') },
      ],
      hints: [
        tr('Prüfe <code>exiftool ausweis.jpg</code>: Dort findest du sowohl den Gateway-Login (<code>gate:G4t3way!77</code>) als auch den XOR-Schlüssel <code>KRYPT0</code> für <code>zugang.xor</code>.',
          'Check <code>exiftool ausweis.jpg</code>: it contains both the gateway login (<code>gate:G4t3way!77</code>) and the XOR key <code>KRYPT0</code> for <code>zugang.xor</code>.'),
        tr('<code>xor -k KRYPT0 --hex zugang.xor</code> liefert <code>ghost:Ph4nt0m#Root99</code>. Verbinde dich erst per <code>ssh gate@10.77.0.10</code> und von dort per <code>ssh ghost@10.77.0.50</code>.',
          '<code>xor -k KRYPT0 --hex zugang.xor</code> yields <code>ghost:Ph4nt0m#Root99</code>. Connect first via <code>ssh gate@10.77.0.10</code> and from there via <code>ssh ghost@10.77.0.50</code>.'),
        tr('Auf <code>phantom</code> zeigt <code>sudo -l</code>, dass du <code>cat</code> als root ausführen darfst: <code>sudo cat /root/phantom.txt</code>.',
          'On <code>phantom</code>, <code>sudo -l</code> shows that you may run <code>cat</code> as root: <code>sudo cat /root/phantom.txt</code>.'),
      ],
      learned: tr('Herzlichen Glückwunsch! Du beherrschst die gesamte Kette von Forensik und Kryptografie bis zu mehrstufiger Netzwerk-Analyse.',
        'Congratulations! You have mastered the entire chain from forensics and cryptography to multi-hop network analysis.'),
      setup() {
        const k = kali('10.77.0.5', {
          'ausweis.jpg': F('\xff\xd8\xff...', {
            binary: true,
            meta: {
              'File Name': 'ausweis.jpg',
              Author: 'Security Ops',
              Gateway: '10.77.0.10 (gate:G4t3way!77)',
              Comment: 'XOR-Key for zugang.xor = KRYPT0',
            },
          }),
          'zugang.xor': F('2c3a3623200a1b3a6d3e200026710b3f3b44726b'),
        });
        const gateway = host({
          name: 'gateway', ip: '10.77.0.10',
          users: { gate: { password: 'G4t3way!77' }, root: {} },
          fs: linuxFS({
            hostname: 'gateway', users: { gate: {} },
            homes: { gate: {
              'routing.txt': F(tr('Internes Ziel: phantom (10.77.0.50) – SSH Port 22 erreichbar von diesem Gateway.',
                'Internal target: phantom (10.77.0.50) – SSH port 22 reachable from this gateway.')),
            } },
          }),
          services: [{ port: 22, name: 'ssh', version: 'OpenSSH 9.3' }],
        });
        const phantom = host({
          name: 'phantom', ip: '10.77.0.50',
          onlyFrom: ['10.77.0.10'],
          users: { ghost: { password: 'Ph4nt0m#Root99' }, root: {} },
          sudo: { ghost: ['cat'] },
          fs: linuxFS({
            hostname: 'phantom', users: { ghost: {} },
            homes: { ghost: {
              'hinweis.txt': F(tr('Prüfe deine Berechtigungen mit sudo -l. Die Ziel-Flag liegt unter /root/phantom.txt.',
                'Check your privileges with sudo -l. The target flag is located at /root/phantom.txt.')),
            } },
            root: {
              'phantom.txt': F(tr('████ OPERATION PHANTOM ABGESCHLOSSEN ████\n\nDu hast alle 21 Missionen von HACKIT gemeistert!\n\nHACKIT{0p3r4t10n_ph4nt0m_m4st3r}',
                '████ OPERATION PHANTOM COMPLETE ████\n\nYou have mastered all 21 missions of HACKIT!\n\nHACKIT{0p3r4t10n_ph4nt0m_m4st3r}')),
            },
          }),
          services: [{ port: 22, name: 'ssh', version: 'OpenSSH 9.6' }],
        });
        return world([k, gateway, phantom], { ip: '10.77.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 22 ------------------------------ */
    {
      chapter: 6,
      title: tr('Doppelte Spur', 'Double Trail'),
      category: tr('Forensik & Krypto', 'Forensics & Crypto'),
      difficulty: 5,
      flag: 'HACKIT{d0ubl3_tr41l_cr4ck3d}',
      commands: [],
      newCommands: [
        { cmd: tr('Krypto-Kette', 'Crypto Chain'), desc: tr('Base64 → Caesar → versteckte Datei → XOR', 'Base64 → Caesar → hidden file → XOR') },
      ],
      story: tr(
        `<p>Im Netzwerk-Mitschnitt <code>packet.cap</code> verbergen sich zwischen dutzenden harmlosen Paketen verdächtige Trace-Daten. Außerdem liegen mehrere Köder-Dateien im Ordner.</p>
         <p>Verfolge die richtige Spur durch drei Kodierungs-/Verschlüsselungsschichten, bis du <code>cipher.xor</code> öffnen kannst.</p>`,
        `<p>Inside the network capture <code>packet.cap</code>, suspicious trace data is hidden among dozens of harmless packets. Several decoy files are also lying around.</p>
         <p>Follow the real trail across three encoding/encryption layers until you can unlock <code>cipher.xor</code>.</p>`
      ),
      objectives: [
        { text: tr('Finde die X-Trace-Zeile in packet.cap', 'Find the X-Trace line in packet.cap'), check: ev('grep', e => e.found) },
        { text: tr('Dekodiere den Base64-Wert aus X-Trace', 'Decode the Base64 value from X-Trace'), check: ev('decode', e => e.algo === 'base64' && e.result.includes('XR')) },
        { text: tr('Entschlüssele die Caesar-Nachricht', 'Decrypt the Caesar message'), check: ev('decode', e => e.algo === 'caesar' && e.result.includes('.vault_key')) },
        { text: tr('Lies die versteckte Schlüsseldatei', 'Read the hidden key file'), check: ev('read', e => e.path === '/var/tmp/.vault_key') },
        { text: tr('Entschlüssele cipher.xor', 'Decrypt cipher.xor'), check: ev('decode', e => e.algo === 'xor' && e.result.includes('HACKIT{d0ubl3')) },
      ],
      hints: [
        tr('Filtere <code>packet.cap</code> mit <code>grep X-Trace packet.cap</code>. Ignoriere die Dateien <code>fake1.xor</code> und <code>fake2.b64</code>.',
          'Filter <code>packet.cap</code> with <code>grep X-Trace packet.cap</code>. Ignore the decoy files <code>fake1.xor</code> and <code>fake2.b64</code>.'),
        tr('Dekodiere <code>WFJMU1ZZUj0vaW5lL2d6Yy8uaW5oeWdfeHJs</code> mit <code>base64 -d</code> und jage das Ergebnis durch <code>caesar --brute</code>.',
          'Decode <code>WFJMU1ZZUj0vaW5lL2d6Yy8uaW5oeWdfeHJs</code> with <code>base64 -d</code> and pipe the result through <code>caesar --brute</code>.'),
        tr('ROT13 ergibt <code>KEYFILE=/var/tmp/.vault_key</code>. Lies <code>cat /var/tmp/.vault_key</code> (<code>SH4D0W</code>) und entschlüssele <code>xor -k SH4D0W --hex cipher.xor</code>.',
          'ROT13 yields <code>KEYFILE=/var/tmp/.vault_key</code>. Read <code>cat /var/tmp/.vault_key</code> (<code>SH4D0W</code>) and decrypt with <code>xor -k SH4D0W --hex cipher.xor</code>.'),
      ],
      learned: tr('Mehrstufige Verschleierung lässt sich Schritt für Schritt auflösen, wenn man Köder systematisch ausschließt.',
        'Multi-layer obfuscation can be peeled back step by step when you systematically rule out decoys.'),
      setup() {
        const cap = [];
        for (let i = 1; i <= 60; i++) {
          if (i === 37) cap.push(`0037 TCP 10.78.0.5:443 -> 10.78.0.9:8443 X-Trace: WFJMU1ZZUj0vaW5lL2d6Yy8uaW5oeWdfeHJs`);
          else cap.push(`${String(i).padStart(4, '0')} TCP 10.78.0.${(i % 9) + 1}:80 -> 10.78.0.2:5${String(i).padStart(3, '0')} ACK seq=${i * 137}`);
        }
        return world([kali('10.78.0.5', {
          'packet.cap': F(cap.join('\n')),
          'cipher.xor': F('150475030a771b09770f7903282c0431523b6017403604663f1757360434387b5039'),
          'fake1.xor': F('deadbeefcafebabe1234567890abcdef'),
          'fake2.b64': F(Shell.b64encode('DECOY: Hier gibt es nichts zu sehen.')),
        }, {
          var: D({ tmp: D({ '.vault_key': F('SH4D0W') }) }),
        })], { ip: '10.78.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 23 ------------------------------ */
    {
      chapter: 6,
      title: tr('Der falsche Admin', 'The Rogue Admin'),
      category: tr('Web & Passwörter', 'Web & Passwords'),
      difficulty: 5,
      flag: 'HACKIT{4p1_ch41n_4nd_cr4ck}',
      commands: [],
      newCommands: [
        { cmd: 'curl -H ... > DATEI', desc: tr('API-Dump mit Header-Bypass speichern & mit john knacken', 'Save API dump with header bypass & crack via john') },
      ],
      story: tr(
        `<p>Im Zielnetz <code>10.80.0.0/24</code> läuft ein Web-Dienst mit verstecktem Debug-Endpunkt. Nur wer den passenden HTTP-Header kennt, bekommt den internen Benutzer-Dump.</p>
         <p>Sichere den Dump, knacke das Passwort des richtigen Dienstkontos mit deiner Wortliste, melde dich per SSH an und lies <code>/root/secret.flag</code>.</p>`,
        `<p>Inside <code>10.80.0.0/24</code>, a web service exposes a hidden debug endpoint. Only requests carrying the right HTTP header receive the internal user dump.</p>
         <p>Save the dump, crack the right service account password with your wordlist, log in via SSH and read <code>/root/secret.flag</code>.</p>`
      ),
      objectives: [
        { text: tr('Finde den versteckten Endpunkt über /robots.txt', 'Discover the hidden endpoint via /robots.txt'), check: ev('curl', e => e.path === '/robots.txt') },
        { text: tr('Rufe /debug/users mit dem Debug-Header ab', 'Fetch /debug/users with the debug header'), check: ev('debug_dump') },
        { text: tr('Knacke das Passwort von svc_deploy mit john', 'Crack the password of svc_deploy with john'), check: ev('crack', e => e.user === 'svc_deploy') },
        { text: tr('Melde dich als svc_deploy auf 10.80.0.10 an', 'Log in as svc_deploy on 10.80.0.10'), check: ev('login', e => e.host === 'auth-api' && e.user === 'svc_deploy') },
        { text: tr('Lies /root/secret.flag mit sudo', 'Read /root/secret.flag using sudo'), check: ev('read', e => e.host === 'auth-api' && e.path === '/root/secret.flag') },
      ],
      hints: [
        tr('Prüfe <code>curl http://10.80.0.10/</code> und <code>curl http://10.80.0.10/robots.txt</code>. Im HTML-Kommentar steht der benötigte Header <code>X-Debug: true</code>.',
          'Check <code>curl http://10.80.0.10/</code> and <code>curl http://10.80.0.10/robots.txt</code>. The HTML comment reveals the required header <code>X-Debug: true</code>.'),
        tr('Speichere die Hashes: <code>curl -H "X-Debug: true" http://10.80.0.10/debug/users > /tmp/hashes.txt</code> und knacke sie mit <code>john /tmp/hashes.txt --wordlist=dict.txt</code>.',
          'Save the hashes: <code>curl -H "X-Debug: true" http://10.80.0.10/debug/users > /tmp/hashes.txt</code> and crack them with <code>john /tmp/hashes.txt --wordlist=dict.txt</code>.'),
        tr('<code>svc_deploy:nebula99</code> → <code>ssh svc_deploy@10.80.0.10</code> → <code>sudo -l</code> zeigt <code>tail</code> → <code>sudo tail -n 5 /root/secret.flag</code>.',
          '<code>svc_deploy:nebula99</code> → <code>ssh svc_deploy@10.80.0.10</code> → <code>sudo -l</code> shows <code>tail</code> → <code>sudo tail -n 5 /root/secret.flag</code>.'),
      ],
      learned: tr('Debug-Endpunkte mit leicht erratbaren Headern und schwache Service-Passwörter führen direkt zur vollständigen Übernahme.',
        'Debug endpoints guarded by guessable headers combined with weak service passwords lead directly to full compromise.'),
      setup() {
        const k = kali('10.80.0.5', {
          'dict.txt': F('admin123\nwelcome\nquasar\nnebula99\nsolaris\nmatrix01\ndecoy_pass_1'),
        });
        const authApi = host({
          name: 'auth-api', ip: '10.80.0.10',
          users: { svc_deploy: { password: 'nebula99' }, decoy: { password: 'decoy_pass_1' }, root: {} },
          sudo: { svc_deploy: ['tail'] },
          fs: linuxFS({
            hostname: 'auth-api', users: { svc_deploy: {} },
            homes: { svc_deploy: { 'note.txt': F(tr('Deployment-Konto. Prüfe sudo -l.', 'Deployment account. Check sudo -l.')) } },
            root: { 'secret.flag': F('HACKIT{4p1_ch41n_4nd_cr4ck}') },
          }),
          services: [
            { port: 22, name: 'ssh', version: 'OpenSSH 9.2' },
            {
              port: 80, name: 'http', version: 'uvicorn (FastAPI)',
              web(path, _params, ctx, req = {}) {
                if (path === '/') return '<h1>Auth Service v2</h1>\n<!-- internal debug requires X-Debug: true -->';
                if (path === '/robots.txt') return 'User-agent: *\nDisallow: /debug/users';
                if (path === '/debug/users') {
                  if (!/X-Debug:\s*true/i.test(req.header || '')) return `${C('r', 'HTTP/1.1 403 Forbidden')}\nDebug header required.`;
                  ctx.emit({ type: 'debug_dump' });
                  return 'decoy:642f965b132a448cb37ddd7f7dc27f70\nsvc_deploy:644711b8e1b4181554d0509f2db64ca2';
                }
                return `${C('r', 'HTTP/1.1 404 Not Found')}`;
              },
            },
          ],
        });
        return world([k, authApi], { ip: '10.80.0.5', user: 'hacker' }, {
          hashdb: {
            '642f965b132a448cb37ddd7f7dc27f70': 'decoy_pass_1',
            '644711b8e1b4181554d0509f2db64ca2': 'nebula99',
          },
        });
      },
    },

    /* ------------------------------ 24 ------------------------------ */
    {
      chapter: 6,
      title: tr('Schatten im Speicher', 'Shadow in Memory'),
      category: tr('Reverse & Pivot', 'Reverse & Pivot'),
      difficulty: 5,
      flag: 'HACKIT{sh4d0w_m3m0ry_p1v0t}',
      commands: [],
      newCommands: [
        { cmd: 'Split-Key + Pivot', desc: tr('Schlüssel aus Binary & Bild kombinieren, dann ins Subnetz springen', 'Combine key parts from binary & image, then pivot subnets') },
      ],
      story: tr(
        `<p>Der XOR-Schlüssel für die Zugangsdaten in <code>agent.bin</code> wurde auf zwei Dateien aufgeteilt: eine Hälfte steckt in der Binärdatei <code>agent.bin</code>, die andere in den Metadaten von <code>node_map.jpg</code>.</p>
         <p>Sobald du auf dem Edge-Server bist, suche das versteckte interne Subnetz und eine vergessene Backup-Datei, um bis in die <b>Citadel</b> vorzudringen.</p>`,
        `<p>The XOR key for the credentials inside <code>agent.bin</code> was split across two files: one half sits in the binary <code>agent.bin</code>, the other in the metadata of <code>node_map.jpg</code>.</p>
         <p>Once on the edge server, discover the hidden internal subnet and a forgotten backup file to reach the <b>Citadel</b>.</p>`
      ),
      objectives: [
        { text: tr('Finde beide Schlüssel-Teile (strings & exiftool)', 'Find both key parts (strings & exiftool)'), check: ev('exif', e => e.path.includes('node_map.jpg')) },
        { text: tr('Entschlüssele die Edge-Zugangsdaten mit xor', 'Decrypt the edge credentials with xor'), check: ev('decode', e => e.algo === 'xor' && e.result.includes('edge:')) },
        { text: tr('Melde dich auf edge (10.85.0.20) an', 'Log in to edge (10.85.0.20)'), check: ev('login', e => e.host === 'edge') },
        { text: tr('Finde die Backup-Datei auf edge mit find', 'Find the backup file on edge with find'), check: ev('read', e => e.host === 'edge' && e.path.endsWith('auth.bak')) },
        { text: tr('Springe weiter auf citadel (10.85.99.7) und lies flag.txt', 'Pivot to citadel (10.85.99.7) and read flag.txt'), check: ev('read', e => e.host === 'citadel' && e.path.endsWith('flag.txt')) },
      ],
      hints: [
        tr('<code>strings agent.bin</code> zeigt <code>KEY_PART1=M4T</code> und den Hex-Block <code>285033370b1d2953677361393e471463017675017a621f6a7d</code>. <code>exiftool node_map.jpg</code> liefert <code>KEY_PART2=R1X</code>.',
          '<code>strings agent.bin</code> shows <code>KEY_PART1=M4T</code> and hex <code>285033370b1d2953677361393e471463017675017a621f6a7d</code>. <code>exiftool node_map.jpg</code> gives <code>KEY_PART2=R1X</code>.'),
        tr('<code>echo 285033370b1d2953677361393e471463017675017a621f6a7d | xor -k M4TR1X --hex</code> liefert <code>edge:Edg3!Pass@10.85.0.20</code>. Auf <code>edge</code> zeigt <code>env</code> das Subnetz <code>10.85.99.0/24</code>.',
          '<code>echo 285033370b1d2953677361393e471463017675017a621f6a7d | xor -k M4TR1X --hex</code> gives <code>edge:Edg3!Pass@10.85.0.20</code>. On <code>edge</code>, <code>env</code> reveals subnet <code>10.85.99.0/24</code>.'),
        tr('Auf <code>edge</code>: <code>find / -name "*.bak"</code> → <code>cat /var/log/auth.bak | base64 -d</code> → <code>warden:W4rd3n_C1t4d3l!</code> → <code>ssh warden@10.85.99.7</code> → <code>cat flag.txt</code>.',
          'On <code>edge</code>: <code>find / -name "*.bak"</code> → <code>cat /var/log/auth.bak | base64 -d</code> → <code>warden:W4rd3n_C1t4d3l!</code> → <code>ssh warden@10.85.99.7</code> → <code>cat flag.txt</code>.'),
      ],
      learned: tr('Aufgeteilte Geheimnisse verlieren ihren Schutz, sobald ein Angreifer alle Artefakte einsammeln kann.',
        'Split secrets lose their protection as soon as an attacker can gather all artifacts.'),
      setup() {
        const dump = binary(['AGENT_CFG', 'DECOY_KEY=AAAA', 'KEY_PART1=M4T', 'PAYLOAD=285033370b1d2953677361393e471463017675017a621f6a7d']);
        const k = kali('10.85.0.5', {
          'agent.bin': F(dump, { binary: true }),
          'node_map.jpg': F('\xff\xd8\xff...', { binary: true, meta: { 'File Name': 'node_map.jpg', Comment: 'KEY_PART2=R1X' } }),
        });
        const edge = host({
          name: 'edge', ip: '10.85.0.20',
          users: { edge: { password: 'Edg3!Pass' }, root: {} },
          fs: linuxFS({
            hostname: 'edge', users: { edge: {} },
            homes: { edge: { 'notes.txt': F(tr('Prüfe env und alte Logs (*.bak).', 'Check env and old logs (*.bak).')) } },
            extra: { var: D({ log: D({ 'auth.bak': F('d2FyZGVuOlc0cmQzbl9DMXQ0ZDNsIQ==') }) }) },
          }),
          services: [{ port: 22, name: 'ssh', version: 'OpenSSH 9.1' }],
        });
        edge.env = { INTERNAL_SUBNET: '10.85.99.0/24' };
        const citadel = host({
          name: 'citadel', ip: '10.85.99.7',
          onlyFrom: ['10.85.0.20'],
          users: { warden: { password: 'W4rd3n_C1t4d3l!' }, root: {} },
          fs: linuxFS({
            hostname: 'citadel', users: { warden: {} },
            homes: { warden: { 'flag.txt': F('HACKIT{sh4d0w_m3m0ry_p1v0t}') } },
          }),
          services: [{ port: 22, name: 'ssh', version: 'OpenSSH 9.6' }],
        });
        return world([k, edge, citadel], { ip: '10.85.0.5', user: 'hacker' });
      },
    },

    /* ------------------------------ 25 ------------------------------ */
    {
      chapter: 6,
      title: tr('Zeitgesteuerter Ausbruch', 'Timed Breakout'),
      category: tr('Privilege Escalation', 'Privilege Escalation'),
      difficulty: 5,
      flag: 'HACKIT{cr0n_wr1t4bl3_pwn3d}',
      commands: [],
      newCommands: [
        { cmd: 'Cron + >', desc: tr('Beschreibbares Cron-Skript mit Ausgabeumleitung nutzen', 'Leverage a writable cron script via output redirection') },
      ],
      story: tr(
        `<p>Du bist als <code>guest</code> auf <code>compute</code>. <code>sudo -l</code> ist gesperrt, aber jede Minute läuft ein geplanter Root-Job.</p>
         <p>Analysiere den Cronjob und die Dateirechte im Job-Verzeichnis. Wenn ein von <code>root</code> ausgeführtes Skript für alle beschreibbar ist, kannst du darüber auf <code>/root/flag.txt</code> zugreifen.</p>`,
        `<p>You are logged in as <code>guest</code> on <code>compute</code>. <code>sudo -l</code> is blocked, yet a scheduled root job runs every minute.</p>
         <p>Inspect the cron job and file permissions in its directory. When a script executed by <code>root</code> is world-writable, you can use it to read <code>/root/flag.txt</code>.</p>`
      ),
      objectives: [
        { text: tr('Prüfe geplante Jobs mit crontab -l', 'Inspect scheduled jobs with crontab -l'), check: ev('crontab') },
        { text: tr('Prüfe die Rechte unter /opt/jobs mit ls -l', 'Check permissions under /opt/jobs with ls -l'), check: ev('ls', e => e.path === '/opt/jobs') },
        { text: tr('Schreibe einen Kopier-/Lese-Befehl in /opt/jobs/plugin.sh', 'Write a copy/read command into /opt/jobs/plugin.sh'), check(e, ctx) {
          if (e.type !== 'write' || e.path !== '/opt/jobs/plugin.sh') return false;
          const body = e.node.content || '';
          if (!body.includes('/root/flag.txt')) return false;
          const m = body.match(/\/tmp\/([^\s;>|]+)/);
          const target = m ? m[1] : 'loot.txt';
          ctx.sess.host.fs.children.tmp.children[target] = F('HACKIT{cr0n_wr1t4bl3_pwn3d}', { owner: 'root' });
          return true;
        } },
        { text: tr('Lies die von root erzeugte Datei unter /tmp/', 'Read the root-created file under /tmp/'), check: ev('read', e => e.path.startsWith('/tmp/')) },
      ],
      hints: [
        tr('<code>crontab -l</code> zeigt <code>/opt/jobs/runner.sh</code>. Prüfe <code>cat /opt/jobs/runner.sh</code> und <code>ls -l /opt/jobs</code>.',
          '<code>crontab -l</code> shows <code>/opt/jobs/runner.sh</code>. Check <code>cat /opt/jobs/runner.sh</code> and <code>ls -l /opt/jobs</code>.'),
        tr('<code>/opt/jobs/plugin.sh</code> hat <code>-rw-rw-rw-</code> (für jeden beschreibbar!) und wird von <code>runner.sh</code> als <code>root</code> aufgerufen.',
          '<code>/opt/jobs/plugin.sh</code> has <code>-rw-rw-rw-</code> (world-writable!) and is invoked by <code>runner.sh</code> as <code>root</code>.'),
        tr('Schreibe <code>echo "cat /root/flag.txt > /tmp/loot.txt" > /opt/jobs/plugin.sh</code>. Der simulierte Cronjob legt dann <code>/tmp/loot.txt</code> an – lies sie mit <code>cat /tmp/loot.txt</code>.',
          'Run <code>echo "cat /root/flag.txt > /tmp/loot.txt" > /opt/jobs/plugin.sh</code>. The simulated cron job creates <code>/tmp/loot.txt</code> – read it with <code>cat /tmp/loot.txt</code>.'),
      ],
      learned: tr('Von root ausgeführte Skripte und deren Unterverzeichnisse dürfen niemals für normale Benutzer beschreibbar sein.',
        'Scripts executed by root and their parent/plugin directories must never be writable by unprivileged users.'),
      setup() {
        const h = host({
          name: 'compute', ip: '10.90.0.15',
          users: { guest: { password: 'x' }, root: {} },
          fs: linuxFS({
            hostname: 'compute', users: { guest: {} },
            homes: { guest: { 'todo.txt': F(tr('Prüfe crontab -l und die Rechte in /opt/jobs.', 'Check crontab -l and permissions in /opt/jobs.')) } },
            root: { 'flag.txt': F('HACKIT{cr0n_wr1t4bl3_pwn3d}') },
            extra: {
              opt: D({
                jobs: D({
                  'runner.sh': F('#!/bin/bash\n/opt/jobs/plugin.sh', { exec: true, owner: 'root' }),
                  'plugin.sh': F('#!/bin/bash\n# custom hook', { exec: true, writable: true, owner: 'root' }),
                }),
              }),
            },
          }),
        });
        h.cron = [{ schedule: '* * * * *', user: 'root', cmd: '/opt/jobs/runner.sh' }];
        return world([h], { ip: '10.90.0.15', user: 'guest' });
      },
    },

    /* ------------------------------ 26 ------------------------------ */
    {
      chapter: 6,
      title: tr('Operation Eclipse', 'Operation Eclipse'),
      category: tr('Großmeister-Finale', 'Grandmaster Finale'),
      difficulty: 5,
      flag: 'HACKIT{0p3r4t10n_3cl1ps3_gr4ndm4st3r}',
      commands: [],
      newCommands: [
        { cmd: tr('Alles gemeistert', 'Mastered All'), desc: tr('Netzwerk, Web-Header, Base64, EXIF, XOR, Pivot & Sudo', 'Network, Web headers, Base64, EXIF, XOR, Pivot & Sudo') },
      ],
      story: tr(
        `<p><b>Zero:</b> „Die letzte Prüfung, Großmeister. Im Netz <code>10.99.0.0/24</code> steht hinter dem Web-Proxy (<code>10.99.0.10</code>) der isolierte Kernrechner <b>monolith</b> (<code>10.99.0.40</code>).</p>
         <p>Kein Start-Passwort, keine fertigen Hinweise. Knacke den Web-Zugang, arbeite dich über den Proxy auf den Monolith vor und übernimm <code>/root/eclipse.txt</code>."</p>`,
        `<p><b>Zero:</b> "Your final trial, Grandmaster. Inside <code>10.99.0.0/24</code>, behind the web proxy (<code>10.99.0.10</code>), sits the isolated core host <b>monolith</b> (<code>10.99.0.40</code>).</p>
         <p>No starting password, no hand-holding. Break the web auth, pivot through the proxy to monolith, and capture <code>/root/eclipse.txt</code>."</p>`
      ),
      objectives: [
        { text: tr('Scanne 10.99.0.0/24', 'Scan 10.99.0.0/24'), check: ev('nmap', e => e.hosts.length >= 2) },
        { text: tr('Fälsche das API-Token für /creds auf 10.99.0.10', 'Forge the API token for /creds on 10.99.0.10'), check: ev('eclipse_creds') },
        { text: tr('Melde dich auf proxy (10.99.0.10) an', 'Log in to proxy (10.99.0.10)'), check: ev('login', e => e.host === 'proxy') },
        { text: tr('Entschlüssele monolith.xor mittels EXIF-Schlüssel', 'Decrypt monolith.xor using the EXIF key'), check: ev('decode', e => e.algo === 'xor' && e.result.includes('omega:')) },
        { text: tr('Springe auf monolith (10.99.0.40) und lies /root/eclipse.txt', 'Pivot to monolith (10.99.0.40) and read /root/eclipse.txt'), check: ev('read', e => e.host === 'monolith' && e.path === '/root/eclipse.txt') },
      ],
      hints: [
        tr('<code>nmap 10.99.0.0/24</code> → <code>curl http://10.99.0.10/token</code> gibt <code>dXNlcj1hbm9uO3JvbGU9Z3Vlc3Q=</code>. Dekodiert ist das <code>user=anon;role=guest</code>; gefordert auf <code>/creds</code> wird <code>role=ops</code> im Header <code>X-Token</code>.',
          '<code>nmap 10.99.0.0/24</code> → <code>curl http://10.99.0.10/token</code> returns <code>dXNlcj1hbm9uO3JvbGU9Z3Vlc3Q=</code> (<code>user=anon;role=guest</code>). <code>/creds</code> requires <code>role=ops</code> in header <code>X-Token</code>.'),
        tr('<code>curl -H "X-Token: dXNlcj1hbm9uO3JvbGU9b3Bz" http://10.99.0.10/creds</code> liefert <code>relay:R3l4y#99</code>. Auf <code>proxy</code>: <code>exiftool /opt/assets/eclipse.png</code> gibt Key <code>ECL1PS</code>.',
          '<code>curl -H "X-Token: dXNlcj1hbm9uO3JvbGU9b3Bz" http://10.99.0.10/creds</code> gives <code>relay:R3l4y#99</code>. On <code>proxy</code>: <code>exiftool /opt/assets/eclipse.png</code> reveals key <code>ECL1PS</code>.'),
        tr('<code>xor -k ECL1PS --hex /opt/assets/monolith.xor</code> → <code>omega:0m3g4_V4ult!</code> → <code>ssh omega@10.99.0.40</code> → <code>sudo find /root -name "*.txt" -exec cat {} \\;</code>.',
          '<code>xor -k ECL1PS --hex /opt/assets/monolith.xor</code> → <code>omega:0m3g4_V4ult!</code> → <code>ssh omega@10.99.0.40</code> → <code>sudo find /root -name "*.txt" -exec cat {} \\;</code>.'),
      ],
      learned: tr('Du hast alle 26 Missionen von HACKIT gemeistert – vom ersten ls bis zur vollständigen Angriffskette!',
        'You have mastered all 26 missions of HACKIT – from your very first ls to a full multi-stage attack chain!'),
      setup() {
        const k = kali('10.99.0.5', {});
        const proxy = host({
          name: 'proxy', ip: '10.99.0.10',
          users: { relay: { password: 'R3l4y#99' }, root: {} },
          fs: linuxFS({
            hostname: 'proxy', users: { relay: {} },
            homes: { relay: { 'readme.txt': F(tr('Assets liegen unter /opt/assets.', 'Assets are stored under /opt/assets.')) } },
            extra: {
              opt: D({
                assets: D({
                  'eclipse.png': F('\x89PNG...', { binary: true, meta: { 'File Name': 'eclipse.png', Comment: 'XOR-Key=ECL1PS' } }),
                  'monolith.xor': F('2a2e29563169752e7f56640c1377395d2472'),
                }),
              }),
            },
          }),
          services: [
            { port: 22, name: 'ssh', version: 'OpenSSH 9.3' },
            {
              port: 80, name: 'http', version: 'nginx 1.25',
              web(path, _p, ctx, req = {}) {
                if (path === '/') return 'Endpoints: /token , /creds (Header: X-Token, requires role=ops)';
                if (path === '/token') return 'dXNlcj1hbm9uO3JvbGU9Z3Vlc3Q=';
                if (path === '/creds') {
                  const m = (req.header || '').match(/X-Token:\s*(\S+)/i);
                  if (!m) return `${C('y', 'HTTP/1.1 401 Unauthorized')}\nMissing X-Token`;
                  let dec = '';
                  try { dec = Shell.b64decode(m[1]); } catch { return `${C('r', 'HTTP/1.1 400 Bad Request')}`; }
                  if (!/role=ops\b/.test(dec)) return `${C('y', 'HTTP/1.1 403 Forbidden')}\nRequires role=ops`;
                  ctx.emit({ type: 'eclipse_creds' });
                  return 'SSH Proxy: relay:R3l4y#99';
                }
                return `${C('r', 'HTTP/1.1 404 Not Found')}`;
              },
            },
          ],
        });
        const monolith = host({
          name: 'monolith', ip: '10.99.0.40',
          onlyFrom: ['10.99.0.10'],
          users: { omega: { password: '0m3g4_V4ult!' }, root: {} },
          sudo: { omega: ['find'] },
          fs: linuxFS({
            hostname: 'monolith', users: { omega: {} },
            homes: { omega: { 'note.txt': F('sudo -l') } },
            root: { 'eclipse.txt': F('████ OPERATION ECLIPSE ████\n\nHACKIT{0p3r4t10n_3cl1ps3_gr4ndm4st3r}') },
          }),
          services: [{ port: 22, name: 'ssh', version: 'OpenSSH 9.6' }],
        });
        return world([k, proxy, monolith], { ip: '10.99.0.5', user: 'hacker' });
      },
    },
  ];
}
