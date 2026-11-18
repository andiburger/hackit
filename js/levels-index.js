/* HACKIT – Missionen zusammenführen (Kern + Fortgeschritten) */
const LEVELS = {
  list: [],
  chapters: [],
  build() {
    const adv = typeof advancedLevels === 'function' ? advancedLevels() : [];
    const advCh = typeof advancedChapters === 'function' ? advancedChapters() : [];
    this.list = [...coreLevels(), ...adv];
    this.list.forEach((l, i) => { l.id = i + 1; });
    this.chapters = [...coreChapters(), ...advCh];
  },
};
LEVELS.build();
I18N.onChange(() => LEVELS.build());
