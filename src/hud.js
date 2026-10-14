// hud.js — the HTML layer over the canvas.
//
// Everything bilingual: each slot holds a Hebrew node and an English node and
// `body.show-en` decides which is visible, so switching language never
// re-renders anything or loses state.
//
// Text is revealed word by word rather than character by character. Hebrew
// with nikud breaks badly under per-character typing: the vowel points are
// separate code points and you get a letter standing alone with a dangling
// kamatz for a frame. Word-at-a-time avoids that entirely.

import { clamp, lerp, clock } from './utils.js';
import T from './content.js';

const $ = id => document.getElementById(id);

function bi(parent, obj, cls = '') {
  parent.innerHTML = '';
  const he = document.createElement('span');
  he.className = 'he ' + cls;
  he.innerHTML = obj.he ?? '';
  const en = document.createElement('span');
  en.className = 'en ' + cls;
  en.innerHTML = obj.en ?? '';
  parent.append(he, en);
  return parent;
}

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      pairs: $('hud-pairs'),
      pairsLabel: $('hud-pairs-label'),
      manifest: $('manifest'),
      waterFill: $('water-fill'),
      waterLabel: $('water-label'),
      phase: $('phase'),
      toast: $('toast'),
      dialog: $('dialog'),
      dlgName: $('dlg-name'),
      dlgText: $('dlg-text'),
      prompt: $('prompt'),
      promptText: $('prompt-text'),
      marker: $('marker'),
      ending: $('ending'),
      endTitle: $('end-title'),
      endBody: $('end-body'),
      endStats: $('end-stats'),
      pause: $('pause'),
      verse: $('verse'),
      verseHe: $('verse-he'),
      verseEn: $('verse-en'),
      verseRef: $('verse-ref'),
      shofarRing: $('shofar-ring'),
    };
    this.showEn = false;
    this._toastT = 0;
    this._dlgT = 0;
    this.buildManifest();
    this.applyLang();
  }

  /* ── language ── */
  setLang(en) {
    this.showEn = en;
    this.applyLang();
  }
  applyLang() {
    document.body.classList.toggle('show-en', this.showEn);
    document.documentElement.lang = this.showEn ? 'en' : 'he';
    document.documentElement.dir = this.showEn ? 'ltr' : 'rtl';
    bi(this.el.pairsLabel, T.ui.pairs);
    bi(this.el.waterLabel, T.ui.water);
  }

  /* ── manifest strip ── */
  buildManifest() {
    const m = this.el.manifest;
    m.innerHTML = '';
    this.chips = new Map();
    for (const s of T.species) {
      const chip = document.createElement('div');
      chip.className = 'chip';
      const name = document.createElement('div');
      name.className = 'chip-name';
      bi(name, { he: s.he, en: s.en });
      const sexes = document.createElement('div');
      sexes.className = 'chip-sex';
      const male = document.createElement('i');
      male.className = 'sx m'; male.textContent = '♂';
      const fem = document.createElement('i');
      fem.className = 'sx f'; fem.textContent = '♀';
      sexes.append(male, fem);
      chip.append(name, sexes);
      m.append(chip);
      this.chips.set(s.key, { chip, male, fem });
    }
  }

  setManifest(manifest) {
    for (const [key, v] of manifest) {
      const c = this.chips.get(key);
      if (!c) continue;
      c.male.classList.toggle('on', !!v.m);
      c.fem.classList.toggle('on', !!v.f);
      c.chip.classList.toggle('done', !!(v.m && v.f));
    }
  }

  setPairs(n, total) {
    this.el.pairs.textContent = `${n}/${total}`;
    this.el.pairs.classList.toggle('full', n >= total);
  }

  /* ── water + phase ── */
  setWater(frac) {
    this.el.waterFill.style.height = `${clamp(frac, 0, 1) * 100}%`;
    this.el.waterFill.classList.toggle('high', frac > 0.72);
  }

  setPhase(phase) {
    bi(this.el.phase, { he: phase.he, en: phase.en });
    this.el.phase.classList.remove('pop');
    void this.el.phase.offsetWidth;
    this.el.phase.classList.add('pop');
  }

  /* ── toast ── */
  toast(obj, { dur = 3.2, kind = '' } = {}) {
    const t = this.el.toast;
    t.className = 'toast in ' + kind;
    bi(t, obj);
    this._toastT = dur;
  }

  /* ── villager dialogue ── */
  speak(name, line, dur = 4.4) {
    bi(this.el.dlgName, name);
    bi(this.el.dlgText, line);
    this.el.dialog.classList.add('in');
    this._dlgT = dur;
    this._revealWords(this.el.dlgText);
  }

  hideDialog() { this.el.dialog.classList.remove('in'); this._dlgT = 0; }

  /** Stagger each word in. Safe with nikud; per-character is not. */
  _revealWords(host) {
    for (const span of host.querySelectorAll('span.he, span.en')) {
      const text = span.textContent;
      span.textContent = '';
      const parts = text.split(/(\s+)/);
      parts.forEach((p, i) => {
        if (/^\s+$/.test(p)) { span.append(document.createTextNode(p)); return; }
        const w = document.createElement('i');
        w.className = 'w';
        w.textContent = p;
        w.style.transitionDelay = `${i * 26}ms`;
        span.append(w);
        requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('on')));
      });
    }
  }

  /* ── interaction prompt ── */
  setPrompt(show, obj = null) {
    this.el.prompt.classList.toggle('in', !!show);
    if (obj) bi(this.el.promptText, obj);
  }

  /* ── shofar cooldown ring ── */
  setShofar(frac) {
    this.el.shofarRing.style.setProperty('--f', String(clamp(frac, 0, 1)));
    this.el.shofarRing.classList.toggle('ready', frac >= 1);
  }

  /* ── offscreen marker pointing at the nearest animal ── */
  setMarker(screen, show, dist = 0) {
    const m = this.el.marker;
    m.classList.toggle('in', !!show);
    if (!show) return;
    m.style.left = `${screen.x}px`;
    m.style.top = `${screen.y}px`;
    m.style.transform = `translate(-50%,-50%) rotate(${screen.angle}rad)`;
    m.dataset.dist = `${Math.round(dist)}`;
  }

  /* ── verse card, used for the opening and the ending ── */
  async verse(v, dur = 4.2) {
    this.el.verseHe.innerHTML = v.he;
    this.el.verseEn.innerHTML = v.en;
    this.el.verseRef.textContent = v.ref ?? '';
    this.el.verse.classList.add('in');
    await clock.wait(dur);
    this.el.verse.classList.remove('in');
    await clock.wait(0.7);
  }

  hideVerse() { this.el.verse.classList.remove('in'); }

  /* ── pause ── */
  setPaused(on) { this.el.pause.classList.toggle('in', !!on); }

  /* ── ending card ── */
  showEnding({ grade, pairs, totalPairs, animals, believed, secret, timeLeft }) {
    const e = T.endings[grade];
    bi(this.el.endTitle, e.title);
    bi(this.el.endBody, e.body);

    const S = T.endings.stats;
    const rows = [
      [S.pairs, `${pairs}/${totalPairs}`],
      [S.animals, String(animals)],
      [S.believed, `${believed}`, S.believedNote],
      [S.secret, secret ? S.yes.he : S.no.he, null, secret ? S.yes.en : S.no.en],
    ];
    this.el.endStats.innerHTML = '';
    for (const [label, value, note, valueEn] of rows) {
      const row = document.createElement('div');
      row.className = 'stat';
      const l = document.createElement('div'); l.className = 'stat-l';
      bi(l, label);
      const v = document.createElement('div'); v.className = 'stat-v';
      if (valueEn) bi(v, { he: value, en: valueEn });
      else v.textContent = value;
      row.append(l, v);
      if (note) {
        const n = document.createElement('div'); n.className = 'stat-note';
        bi(n, note);
        row.append(n);
      }
      this.el.endStats.append(row);
    }
    this.el.ending.classList.add('in');
  }

  hideEnding() { this.el.ending.classList.remove('in'); }

  setHudVisible(on) { this.el.hud.classList.toggle('in', !!on); }

  /* ── per-frame ── */
  update(dt) {
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) this.el.toast.classList.remove('in');
    }
    if (this._dlgT > 0) {
      this._dlgT -= dt;
      if (this._dlgT <= 0) this.hideDialog();
    }
  }
}
