/* HACKIT – virtuelles Dateisystem & Welt-Helfer */
const VFS = (() => {
  const D = (children = {}, opts = {}) => ({ type: 'dir', children, ...opts });
  const F = (content = '', opts = {}) => ({ type: 'file', content, ...opts });

  function setOwner(node, user) {
    if (!node.owner) node.owner = user;
    if (node.type === 'dir') Object.values(node.children).forEach(c => setOwner(c, user));
    return node;
  }

  /** Erzeugt ein Standard-Linux-Dateisystem */
  function linuxFS({ hostname, users = {}, homes = {}, root = {}, extra = {} }) {
    const home = {};
    for (const [u, children] of Object.entries(homes)) {
      home[u] = setOwner(D(children, { private: !!(users[u] && users[u].privateHome) }), u);
    }
    const passwd = ['root:x:0:0:root:/root:/bin/bash',
      'daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin',
      'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin',
      ...Object.keys(users).filter(u => u !== 'root' && u !== 'www-data')
        .map((u, i) => `${u}:x:${1000 + i}:${1000 + i}:${u}:/home/${u}:/bin/bash`)].join('\n');
    const fs = D({
      bin: D({ bash: F('\x7fELF', { exec: true, binary: true }), sh: F('\x7fELF', { exec: true, binary: true }) }),
      etc: D({
        hostname: F(hostname),
        passwd: F(passwd),
        shadow: F('root:$6$Zx...:19000:0:99999:7:::', { private: true, owner: 'root' }),
        'os-release': F('NAME="Ubuntu"\nVERSION="22.04 LTS (Jammy Jellyfish)"'),
      }),
      home: D(home),
      root: setOwner(D(root, { private: true }), 'root'),
      tmp: D({}, { writable: true }),
      var: D({ log: D({}) }),
      usr: D({ bin: D({}) }),
    });
    setOwner(fs, 'root');
    for (const [k, v] of Object.entries(extra)) {
      setOwner(v, 'root');
      if (fs.children[k] && fs.children[k].type === 'dir' && v.type === 'dir') Object.assign(fs.children[k].children, v.children);
      else fs.children[k] = v;
    }
    return fs;
  }

  function host({ name, ip, users, fs, services = [], sudo = {}, motd = '' }) {
    return { name, ip, users, fs, services, sudo, motd };
  }

  function resolve(sess, p) {
    let parts;
    if (!p || p === '~') return p === '~' ? sess.home.slice() : sess.cwd.slice();
    if (p.startsWith('/')) parts = [];
    else if (p.startsWith('~')) { parts = sess.home.slice(); p = p.slice(1); }
    else parts = sess.cwd.slice();
    for (const seg of p.split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return parts;
  }

  function get(fs, parts) {
    let n = fs;
    for (const part of parts) {
      if (!n || n.type !== 'dir' || !n.children[part]) return null;
      n = n.children[part];
    }
    return n;
  }

  const pathStr = parts => '/' + parts.join('/');

  function displayPath(sess) {
    const p = pathStr(sess.cwd);
    const h = pathStr(sess.home);
    if (p === h) return '~';
    if (p.startsWith(h + '/')) return '~' + p.slice(h.length);
    return p;
  }

  function canRead(sess, node) {
    if (!node.private) return true;
    return sess.user === 'root' || node.owner === sess.user;
  }

  /** Prüft ob alle Elternordner betretbar sind */
  function canTraverse(sess, fs, parts) {
    let n = fs;
    for (const part of parts) {
      if (n.type === 'dir' && !canRead(sess, n)) return false;
      n = n.children[part];
      if (!n) return true;
    }
    return true;
  }

  function walk(node, parts, cb) {
    cb(node, parts);
    if (node.type === 'dir') {
      for (const [k, c] of Object.entries(node.children).sort()) walk(c, [...parts, k], cb);
    }
  }

  function glob(pat) {
    return new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  }

  return { D, F, setOwner, linuxFS, host, resolve, get, pathStr, displayPath, canRead, canTraverse, walk, glob };
})();
