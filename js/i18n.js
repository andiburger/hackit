/* HACKIT – Sprache / Language */
const I18N = (() => {
  const KEY = 'hackit-lang';
  const supported = ['de', 'en'];
  let lang = localStorage.getItem(KEY);
  if (!supported.includes(lang)) lang = (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
  const listeners = [];
  return {
    supported,
    get lang() { return lang; },
    set(l) {
      if (!supported.includes(l) || l === lang) return;
      lang = l;
      localStorage.setItem(KEY, l);
      document.documentElement.lang = l;
      listeners.forEach(fn => fn(l));
    },
    onChange(fn) { listeners.push(fn); },
  };
})();

/** tr('Deutscher Text', 'English text') – wählt passend zur aktuellen Sprache */
const tr = (de, en) => (I18N.lang === 'en' ? en : de);
