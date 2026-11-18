/* HACKIT – Terminal-Darstellung */
class Terminal {
  constructor({ root, out, line, prompt, input, title }) {
    Object.assign(this, { root, out, line, promptEl: prompt, input, titleEl: title });
    this.history = [];
    this.hIndex = 0;
    this.busy = false;
    this.asking = null;
    this.onCommand = null;
    this.onComplete = null;
    this.promptText = '$ ';

    root.addEventListener('click', () => {
      if (!window.getSelection().toString()) this.focus();
    });
    input.addEventListener('keydown', e => this.key(e));
  }

  static esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Markup: ⟦farbe|text⟧ */
  static render(text) {
    let html = Terminal.esc(text);
    for (let i = 0; i < 3; i++) {
      html = html.replace(/⟦(\w+)\|([^⟦⟧]*)⟧/g, (_, c, t) => `<span class="c-${c}">${t}</span>`);
    }
    return html;
  }

  static strip(text) {
    let s = String(text);
    for (let i = 0; i < 3; i++) s = s.replace(/⟦(\w+)\|([^⟦⟧]*)⟧/g, '$2');
    return s;
  }

  print(text = '', cls = '') {
    const lines = String(text).split('\n');
    const frag = document.createDocumentFragment();
    for (const l of lines) {
      const div = document.createElement('div');
      div.className = 'l' + (cls ? ' ' + cls : '');
      div.innerHTML = Terminal.render(l);
      frag.appendChild(div);
    }
    this.out.appendChild(frag);
    this.scroll();
  }

  async typeOut(text, speed = 8) {
    for (const l of String(text).split('\n')) {
      this.print(l);
      await new Promise(r => setTimeout(r, speed));
    }
  }

  echoCommand(cmd) {
    const div = document.createElement('div');
    div.className = 'l';
    div.innerHTML = this.promptEl.innerHTML + Terminal.esc(cmd);
    this.out.appendChild(div);
  }

  clear() { this.out.innerHTML = ''; }

  setPrompt(markup, title) {
    this.promptText = markup;
    this.promptEl.innerHTML = Terminal.render(markup);
    if (title) this.titleEl.textContent = title;
  }

  scroll() { this.root.scrollTop = this.root.scrollHeight; }
  focus() { this.input.focus({ preventScroll: true }); }

  setBusy(b) {
    this.busy = b;
    this.line.style.visibility = b && !this.asking ? 'hidden' : 'visible';
    if (!b) { this.scroll(); this.focus(); }
  }

  /** Interaktive Abfrage (z.B. Passwort) */
  ask(label, secret = false) {
    return new Promise(resolve => {
      this.asking = { resolve, secret };
      this.savedPrompt = this.promptEl.innerHTML;
      this.promptEl.innerHTML = Terminal.render(label);
      this.input.type = secret ? 'password' : 'text';
      this.line.style.visibility = 'visible';
      this.focus();
      this.scroll();
    });
  }

  key(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = this.input.value;
      this.input.value = '';
      if (this.asking) {
        const { resolve, secret } = this.asking;
        const div = document.createElement('div');
        div.className = 'l';
        div.innerHTML = this.promptEl.innerHTML + (secret ? '' : Terminal.esc(val));
        this.out.appendChild(div);
        this.asking = null;
        this.input.type = 'text';
        this.promptEl.innerHTML = this.savedPrompt;
        this.line.style.visibility = this.busy ? 'hidden' : 'visible';
        resolve(val);
        return;
      }
      if (this.busy) return;
      this.echoCommand(val);
      if (val.trim()) { this.history.push(val); }
      this.hIndex = this.history.length;
      if (this.onCommand) this.onCommand(val);
      this.scroll();
    } else if (e.key === 'ArrowUp' && !this.asking) {
      e.preventDefault();
      if (this.hIndex > 0) { this.hIndex--; this.input.value = this.history[this.hIndex]; }
      setTimeout(() => this.input.setSelectionRange(9999, 9999));
    } else if (e.key === 'ArrowDown' && !this.asking) {
      e.preventDefault();
      if (this.hIndex < this.history.length - 1) { this.hIndex++; this.input.value = this.history[this.hIndex]; }
      else { this.hIndex = this.history.length; this.input.value = ''; }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (this.asking || !this.onComplete) return;
      const res = this.onComplete(this.input.value);
      if (res && res.value != null) this.input.value = res.value;
      if (res && res.options && res.options.length > 1) {
        this.echoCommand(this.input.value);
        this.print(res.options.join('   '), 'c-d');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      this.clear();
    } else if (e.key === 'c' && e.ctrlKey && !window.getSelection().toString()) {
      e.preventDefault();
      this.echoCommand(this.input.value + '^C');
      this.input.value = '';
    }
  }
}
