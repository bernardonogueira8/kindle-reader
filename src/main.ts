/*
 * Book Reader for Obsidian — plugin source.
 *
 * Read EPUB, FB2 and PDF books inside Obsidian, highlight passages and turn them
 * into notes. Everything below is the plugin's own code; the libraries it uses
 * (pdf.js, epub.js, JSZip, localForage) come from npm and are bundled at build
 * time by esbuild — see esbuild.config.mjs.
 */
import { SettingsTab } from './ui/SettingsTab';
import { registerCommands } from './commands';
import { LibraryModal } from './ui/LibraryModal';
import { LibraryView, LIB_VIEW_TYPE, LEGACY_LIB_VIEW_TYPE } from './ui/LibraryView';
import { App, MarkdownRenderer, Menu, Modal, Notice, Platform, Plugin, PluginManifest, Scope, Setting, TFile, requestUrl } from "obsidian";
import { extractEpub, epubResolveHref, epubFlattenToc } from './reader/EpubExtractor';
import { extractFb2, decodeFb2, fb2Href } from './reader/Fb2Extractor';
import { extractPdf, setupWorker } from './reader/PdfExtractor';
import { escHtml, splitTocLine, tocLineHtml } from './reader/htmlUtils';
export { extractEpub, epubResolveHref, epubFlattenToc };
export { extractFb2, decodeFb2, fb2Href };
export { extractPdf, setupWorker };
export { escHtml, splitTocLine, tocLineHtml };

import { __ertr, __erSetLang } from './utils/i18n';
import { svgIcon, iconLabel, docOf, winOf, selOf, icon } from './utils/icons';
import { THEMES, erTheme, erLibTheme, FONTS, HL_COLORS, hlColorCss } from './utils/theme';
export { svgIcon, iconLabel, docOf, winOf, selOf, icon };
export { THEMES, erTheme, erLibTheme, FONTS, HL_COLORS, hlColorCss };
import { erPath, bookRelFolder, bookCategoryOf } from './utils/path';
import { bookStatusOf, buildLibChips, filterLibBooks, bookTagsOf, allBookTags, parseBookTags, pluralBooks } from './utils/library';
import { erAutoFocus, erBlurOnTapOutside, erIsMobile } from './utils/dom';
export { erPath, bookRelFolder, bookCategoryOf };
export { bookStatusOf, buildLibChips, filterLibBooks, bookTagsOf, allBookTags, parseBookTags, pluralBooks };
export { erAutoFocus, erBlurOnTapOutside, erIsMobile };
export { LibraryModal, LibraryView, LIB_VIEW_TYPE, LEGACY_LIB_VIEW_TYPE };
import { ReaderView } from './ui/ReaderView';
import { ReaderModal } from './ui/ReaderModal';
export { ReaderView, ReaderModal };

export { addBookFileMenu, deleteBookFromVault };
const VIEW_TYPE = "kindle-reader";
import { KindleReaderSettings, DEFAULT_SETTINGS, DEFAULT, AI_PROVIDERS, aiConfig } from './settings';
import { BookProgress, ProgressBackup, BookHighlight, HighlightBackup, ThumbCache, ReadingLog, DeviceProfile } from './types';
export { KindleReaderSettings, DEFAULT_SETTINGS, DEFAULT, AI_PROVIDERS, aiConfig };
export { BookProgress, ProgressBackup, BookHighlight, HighlightBackup, ThumbCache, ReadingLog, DeviceProfile };
import {
  ConfirmModal,
  GoToPageModal,
  HighlightCommentModal,
  InfoModal,
  OnboardingModal,
  ONBOARD_SLIDES,
  WhatsNewModal,
  WHATS_NEW,
  cmpVer,
  whatsNewSince,
  NoteTitleModal,
  BookSetupModal,
  HighlightExportModal,
  BookNotePicker,
  TemplatePicker,
  FolderSuggest,
  attachFolderSuggest,
  attachPathInput,
  ReadSettingsModal,
  DictionaryModal
} from './ui/modals';
export {
  ConfirmModal,
  GoToPageModal,
  HighlightCommentModal,
  InfoModal,
  OnboardingModal,
  ONBOARD_SLIDES,
  WhatsNewModal,
  WHATS_NEW,
  cmpVer,
  whatsNewSince,
  NoteTitleModal,
  BookSetupModal,
  HighlightExportModal,
  BookNotePicker,
  TemplatePicker,
  FolderSuggest,
  attachFolderSuggest,
  attachPathInput
};
import {
  _readerSettings,
  noteTemplatePath,
  notesFolderPath,
  bookNotesFolderPath,
  inboxNotePath,
  resolveNotesFolder,
  bookNoteFiles,
  resolveBookNote,
  writeBookProperty,
  sanitizeNoteTitle,
  suggestNoteTitle,
  splitExportedHighlights,
  parseNoteTags,
  allVaultTags,
  normalizeHlText,
  bookNoteLinkFor,
  bookNoteFromFrontmatter
} from './utils/notes';
export {
  _readerSettings,
  noteTemplatePath,
  notesFolderPath,
  bookNotesFolderPath,
  inboxNotePath,
  resolveNotesFolder,
  bookNoteFiles,
  resolveBookNote,
  writeBookProperty,
  sanitizeNoteTitle,
  suggestNoteTitle,
  splitExportedHighlights,
  parseNoteTags,
  allVaultTags,
  normalizeHlText,
  bookNoteLinkFor,
  bookNoteFromFrontmatter
};
import { Paginator, SHORT_PAGE_GAP } from './reader/Paginator';
export { Paginator, SHORT_PAGE_GAP };

// ── Which window are we actually in? ────────────────────────────────────────
// Obsidian can move a leaf into a separate OS window, and that window has its
// own document with its OWN selection. `window.getSelection()` therefore comes
// back empty whenever the reader is living in a popout — which is why selecting
// text there produced no colour palette, and why the reader looked broken in a
// detached window while working fine in a tab.
//
// These take the element whose window we mean, rather than reading the global
// `activeDocument`: that one follows keyboard focus, so it can legitimately
// answer with one document when a listener is added and a different one when
// it is removed, leaking the listener.
// A missing element falls back to the main window, i.e. to the old behaviour.
// ── Per-device appearance ───────────────────────────────────────────────────
// data.json travels with the vault, so one font size was shared by the phone,
// the tablet and the desktop. What reads comfortably on a 27" monitor is tiny
// on a tablet and enormous on a phone, and readers were re-adjusting the size
// every time they switched device.
//
// Only the LOOK is per device. Folders, templates, highlight colours and
// reading progress stay shared — those are decisions about the vault, not about
// the screen you happen to be holding.
const DEVICE_KEYS = [
  "theme", "fontSize", "fontFamily", "lineHeight",
  "paragraphSpacing", "wordSpacing", "letterSpacing",
  "pageMargin",
  "columns", "textAlign", "vAlign", "einkMode"
];
function erDeviceKey() {
  try {
    if (Platform) {
      if (Platform.isPhone) return "phone";
      if (Platform.isTablet) return "tablet";
    }
  } catch { /* optional step; a failure here must not interrupt reading */ }
  return "desktop";
}
// Load this device's saved look over the shared defaults. A key the device has
// never set is left alone, so turning the option on inherits what is on screen
// now rather than resetting the book to factory settings mid-sentence.
function applyDeviceProfile(settings) {
  if (!settings || !settings.perDevice) return;
  const p = (settings.deviceProfiles || {})[erDeviceKey()];
  if (!p) return;
  for (const k of DEVICE_KEYS) if (p[k] !== void 0) settings[k] = p[k];
}
// Stash the live look back into this device's slot on the way to disk. Done at
// save time rather than at each of the ~35 places that read or write a font
// size, so the reader's own code is untouched and there is one place to check.
function captureDeviceProfile(settings) {
  if (!settings || !settings.perDevice) return;
  if (!settings.deviceProfiles) settings.deviceProfiles = {};
  const key = erDeviceKey();
  const p = settings.deviceProfiles[key] || (settings.deviceProfiles[key] = {});
  for (const k of DEVICE_KEYS) p[k] = settings[k];
}
// Show the book only once the layout has stopped moving.
//
// "It jumps between two pages when it opens" has been reported four times, and
// every mechanism I found and fixed was real but not the last one. So this stops
// hunting and makes the symptom impossible instead: the curtain (er-booting)
// comes up when the book is built and comes down only after the page area has
// held the same width for a beat. Anything that re-flows in that window — the
// dialog settling, the keyboard leaving, a rotation landing — happens behind it.
// Every call re-arms, so a re-flow that starts late just holds the curtain
// longer rather than revealing a half-finished page.
//
// The cost is a fifth of a second before the text appears. That is worth it: the
// reader sees the page they left, once, instead of watching it change.
const ER_SETTLE_MS = 200;
function erRevealWhenSettled(view) {
  const area = view.areaEl;
  if (!area) return;
  const win = winOf(area);
  win.clearTimeout(view._revealT);
  const width = () => (view.areaEl ? view.areaEl.clientWidth : 0);
  let last = width();
  const check = () => {
    if (!view.areaEl) return;
    const now = width();
    // Still moving — wait for it to settle rather than reveal mid-flight.
    if (now !== last) { last = now; view._revealT = win.setTimeout(check, ER_SETTLE_MS); return; }
    view.areaEl.removeClass("er-booting");
    erHideVeil(view);
  };
  view._revealT = win.setTimeout(check, ER_SETTLE_MS);
}
//
const ER_SEL_HL = "er-selection";
function erPaintSelection(view, range) {
  try {
    if (!erIsMobile(view.app)) return;
    if (view.pager && view.pager.scrollMode) return;
    if (typeof CSS === "undefined" || !CSS.highlights || typeof Highlight !== "function") return;
    CSS.highlights.set(ER_SEL_HL, new Highlight(range.cloneRange()));
  } catch { /* decoration: never let it interrupt selecting */ }
}
function erClearPaintedSelection() {
  try { if (typeof CSS !== "undefined" && CSS.highlights) CSS.highlights.delete(ER_SEL_HL); }
  catch { /* nothing painted is a fine outcome */ }
}
// ── Reading-goal timer + click-to-turn helpers ────────────────────────────────
// Shared by both readers (the desktop ItemView and the mobile full-screen Modal),
// which each expose `plugin`, `areaEl`, `bookHtml`, a nav method, and the goal-bar
// element refs. Keeping this as free functions avoids duplicating the logic twice.
// A page counts as "short" — worth centring — only when this much of it is empty.
// Below the threshold the page is essentially full and must stay put.
const SHORT_PAGE_GAP = 0.35;
// How long a search match stays painted before fading out by itself.
const FOUND_PAINT_MS = 4000;
// Upper bound on per-book commands. Enough for a normal shelf; a 500-book vault
const MAX_BOOK_COMMANDS = 60;
function readerTodayKey() {
  try { return window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().slice(0, 10); }
  catch { return new Date().toISOString().slice(0, 10); }
}
// ── Reading statistics ──────────────────────────────────────────────────────
// Pure helpers over the reading log so the stats card can be unit-tested without
// a vault. The log is { "YYYY-MM-DD": seconds } trimmed to ~90 days.

// which would look like the counter is broken.
function fmtReadTime(sec) {
  const total = Math.max(0, Math.floor(sec || 0));
  if (total < 60) return total > 0 ? __ertr("less than a minute") : "—";
  const mins = Math.floor(total / 60);
  if (mins < 60) return __ertr("{0} min", mins);
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return m ? __ertr("{0} h {1} min", h, m) : __ertr("{0} h", h);
  const d = Math.floor(h / 24), rh = h % 24;
  return rh ? __ertr("{0} d {1} h", d, rh) : __ertr("{0} d", d);
}
// Shift a YYYY-MM-DD key by N days without touching the local timezone: parsing
// as UTC noon keeps DST changes from rolling the date backwards.
function shiftDayKey(key, delta) {
  const d = new Date(key + "T12:00:00Z");
  if (isNaN(d.getTime())) return key;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
// Consecutive days with any reading, counting back from today. Reading yesterday
// but not yet today still counts as a live streak — otherwise the number would
// collapse to 0 every morning and feel punishing.
function readingStreak(log, todayKey) {
  if (!log) return 0;
  const hit = (k) => (log[k] || 0) > 0;
  let cur = todayKey;
  if (!hit(cur)) {
    cur = shiftDayKey(cur, -1);
    if (!hit(cur)) return 0;
  }
  let n = 0;
  while (hit(cur) && n < 4000) { n++; cur = shiftDayKey(cur, -1); }
  return n;
}
// Everything the stats card needs, in one pass.
function readingStats(log, lifetimeSeconds, todayKey) {
  const l = log || {};
  const keys = Object.keys(l);
  const logSum = keys.reduce((a, k) => a + (l[k] || 0), 0);
  const daysRead = keys.filter((k) => (l[k] || 0) > 0).length;
  let best = 0, bestDay = "";
  for (const k of keys) if ((l[k] || 0) > best) { best = l[k]; bestDay = k; }
  // Lifetime is untrimmed and wins, but never report less than the log proves.
  const total = Math.max(lifetimeSeconds || 0, logSum);
  const recent = [];
  for (let i = 13; i >= 0; i--) {
    const k = shiftDayKey(todayKey, -i);
    recent.push({ key: k, sec: l[k] || 0 });
  }
  return {
    total,
    today: l[todayKey] || 0,
    streak: readingStreak(l, todayKey),
    daysRead,
    best, bestDay,
    avgPerDay: daysRead ? Math.round(logSum / daysRead) : 0,
    recent,
  };
}
// The timer is MANUAL: it counts only while the user has pressed ▶ (start), and
// pauses on ⏸. No activity/idle guessing — the reader is in control. Each running
// second is added to today's tally (feeding the daily-goal bar) and to the live
// session counter shown on the toolbar button.
function startTimerSession(view) {
  if (view._timer) return;
  if (!view.plugin.settings.timerEnabled) return;
  view._running = true;
  view._flushAcc = 0;
  view._timer = window.setInterval(() => {
    if (!view.plugin.settings.timerEnabled) { pauseTimerSession(view); return; }
    view.plugin.bumpReadingTime(1);
    view._sessionSec = (view._sessionSec || 0) + 1;
    view._flushAcc = (view._flushAcc || 0) + 1;
    if (view._flushAcc >= 15) { view._flushAcc = 0; view.plugin.flushReadingTime(); }
    updateTimerBtn(view);
    updateGoalBar(view);
    if (!view._goalNotified && view.plugin.getTodaySeconds() >= view.plugin.getGoalSeconds()) {
      view._goalNotified = true;
      view.plugin.flushReadingTime();
      new Notice(__ertr("Today's reading goal reached 🎉"));
    }
  }, 1e3);
  updateTimerBtn(view);
}
function pauseTimerSession(view) {
  if (view._timer) { window.clearInterval(view._timer); view._timer = null; }
  view._running = false;
  if (view.plugin) view.plugin.flushReadingTime();
  updateTimerBtn(view);
}
function toggleTimerSession(view) {
  if (!view.plugin.settings.timerEnabled) {
    new Notice(__ertr("Timer is off — enable it in reading settings"));
    return;
  }
  view._running ? pauseTimerSession(view) : startTimerSession(view);
}
// Alias kept for the close hooks: stopping the reader just pauses + flushes.
function stopReadingTimer(view) { pauseTimerSession(view); }
// Reset today's reading time to zero (with confirmation).
function resetTimerSession(view) {
  if (!view.plugin.settings.timerEnabled) return;
  pauseTimerSession(view);
  view.plugin.resetTodaySeconds();
  view.plugin.flushReadingTime();
  view._goalNotified = false;
  updateTimerBtn(view);
  updateGoalBar(view);
  new Notice(__ertr("Timer reset"));
}
// Refresh the toolbar timer button. It's a COUNTDOWN toward the daily goal:
// remaining = goal − read-today, shown as m:ss and ticking down while running.
// At 0 it flips to a green "done" state with a check.
function updateTimerBtn(view) {
  if (!view.timerBtnEl) return;
  const s = view.plugin.settings;
  if (!s.timerEnabled) { view.timerBtnEl.addClass("er-hidden"); return; }
  view.timerBtnEl.removeClass("er-hidden");
  const remain = Math.max(0, view.plugin.getGoalSeconds() - view.plugin.getTodaySeconds());
  const done = remain <= 0;
  const mm = Math.floor(remain / 60), ss = remain % 60;
  view.timerBtnEl.classList.toggle("er-timer-run", !!view._running && !done);
  view.timerBtnEl.classList.toggle("er-timer-done", done);
  if (view.timerIconEl) svgIcon(view.timerIconEl, done ? "check" : (view._running ? "pause" : "play"));
  if (view.timerLabelEl) view.timerLabelEl.setText(`${mm}:${String(ss).padStart(2, "0")}`);
}
// Recompute the daily-goal progress bar (fill width + label + "done" glow).
function updateGoalBar(view) {
  if (!view.goalWrapEl) return;
  const s = view.plugin.settings;
  if (!s.timerEnabled) { view.goalWrapEl.addClass("er-hidden"); return; }
  view.goalWrapEl.removeClass("er-hidden");
  const done = view.plugin.getTodaySeconds();
  const goal = view.plugin.getGoalSeconds();
  const pct = Math.min(100, Math.round(done / goal * 100));
  const mins = Math.floor(done / 60);
  view.goalFillEl.style.width = pct + "%";
  const reached = done >= goal;
  view.goalWrapEl.classList.toggle("er-goal-done", reached);
  view.goalTxtEl.setText(reached
    ? __ertr("✓ Goal reached — {0} min today", (mins))
    : __ertr("⏱ {0} of {1} min · {2}%", (mins), (s.dailyGoalMin || 15), (pct)));
}
// "Click to turn": a click on the left/right third of the page turns it. Returns
// true if it handled the click. Guards against images, highlights and active
// selections so those interactions keep working, and leaves the center neutral.
function handleAreaNavClick(view, e) {
  if ((view.plugin.settings.navMode || "buttons") !== "click") return false;
  // Not while scrolling. Tapping the side of the page to turn it fights a
  // scroller: a finger that stops moving reads as a tap, and the reader jumps a
  // screenful away from where they were reading. The stylesheet already said the
  // side zones are off in this mode; the code did not know.
  if (view.pager && view.pager.scrollMode) return false;
  if (e.target instanceof HTMLElement && e.target.closest("img,.er-hl,.er-hl-popup")) return false;
  const sel = selOf(view.areaEl);
  if (sel && !sel.isCollapsed && sel.toString().trim()) return false;
  const r = view.areaEl.getBoundingClientRect();
  if (!r.width) return false;
  const x = e.clientX - r.left;
  const goNext = () => view.nav ? view.nav("next") : view._nav("next");
  const goPrev = () => view.nav ? view.nav("prev") : view._nav("prev");
  if (x < r.width * 0.32) { goPrev(); return true; }
  if (x > r.width * 0.68) { goNext(); return true; }
  return false;
}
// reader's settings panel. Shared by both reader classes.
// The three settings that belong to THIS book. They used to sit inside the
// help dialog, which is a reference screen — editable fields had no business
// being there. Rendered at the end of the reading panel's advanced group.
function buildBookSettings(view, p) {
  if (!view.plugin || !view.file) return;
  // Forget just THIS book, so the setup screen can be tried again without
  // wiping every link in the vault (the settings tab has the "forget all"
  // version). Handy while setting a book up — and the only alternative used to
  // be renaming the file on disk.
  const resetRow = p.createDiv("er-pan-hint");
  const resetLink = resetRow.createSpan({ text: __ertr("Forget this book's settings") });
  resetLink.addClass("er-inline-link");
  resetLink.addEventListener("click", async () => {
    const s = view.plugin.settings;
    const path5 = view.file.path;
    if (s.bookNoteLinks) delete s.bookNoteLinks[path5];
    if (s.bookNotePrompted) delete s.bookNotePrompted[path5];
    if (s.bookTags) delete s.bookTags[path5];
    if (s.bookTemplates) delete s.bookTemplates[path5];
    await view.plugin.saveAll();
    new Notice(__ertr("Book settings cleared — the setup screen will appear next time you open it"));
  });
      p.createDiv("er-info-group").setText(__ertr("Book note for links"));
      const bnWrap = p.createDiv("er-info-booknote");
      const bnHint = bnWrap.createDiv("er-info-rowdesc");
      bnHint.setText(__ertr("Where the \"— from [[…]]\" link in highlight notes points. Empty — the book's file name."));
      bnHint.addClass("er-panel-hint");
      const bnInput = bnWrap.createEl("input", { type: "text" });
      bnInput.addClass("er-panel-input");
      bnInput.placeholder = view.file ? view.file.basename : __ertr("Open a book first…");
      bnInput.disabled = !view.file;
      if (view.file) {
        const map = view.plugin.settings.bookNoteLinks || {};
        bnInput.value = map[view.file.path] || "";
      }
      const saveBookNote = async () => {
        if (!view.file) return;
        if (!view.plugin.settings.bookNoteLinks) view.plugin.settings.bookNoteLinks = {};
        const v = bnInput.value.trim().replace(/^\[\[|\]\]$/g, "").trim();
        if (v) view.plugin.settings.bookNoteLinks[view.file.path] = v;
        else delete view.plugin.settings.bookNoteLinks[view.file.path];
        await view.plugin.saveAll();
        // Mirror it into the note, so the binding is visible in the vault.
        if (v) await writeBookProperty(view.app, v, view.file);
      };
      bnInput.addEventListener("change", saveBookNote);
      bnInput.addEventListener("blur", saveBookNote);
      // Two ways out, side by side — picking an existing note was the only one
      // before, which left readers stuck when the note didn't exist yet.
      const bnActions = bnWrap.createDiv("er-booknote-actions");
      bnActions.addClass("er-panel-actions");
      const bnNew = bnActions.createDiv("er-booknote-pick");
      bnNew.setText(__ertr("+ Create new"));
      bnNew.addClass("er-panel-link-strong");
      bnNew.addEventListener("click", async () => {
        if (!view.file) return;
        const folder = bookNotesFolderPath(view.app) || notesFolderPath(view.app) || "";
        const note = await view.plugin.createBookNote(view.file, view.file.basename, folder);
        if (note) {
          bnInput.value = note.basename;
          new Notice(__ertr("Book note created: {0}", note.basename));
        }
      });
      const bnPick = bnActions.createDiv("er-booknote-pick");
      bnPick.setText(__ertr("Choose from the list…"));
      bnPick.addClass("er-panel-link");
      bnPick.addEventListener("click", () => {
        if (!view.file) return;
        const files = bookNoteFiles(view.app);
        if (!files.length) { const bf = bookNotesFolderPath(view.app); new Notice(bf ? __ertr("No notes in \"{0}\"", (bf)) : __ertr("No notes in the vault")); return; }
        new BookNotePicker(view.app, files, async (chosen) => {
          if (!view.plugin.settings.bookNoteLinks) view.plugin.settings.bookNoteLinks = {};
          view.plugin.settings.bookNoteLinks[view.file.path] = chosen.basename;
          await view.plugin.saveAll();
          await writeBookProperty(view.app, chosen.basename, view.file);
          bnInput.value = chosen.basename;
          new Notice(__ertr("Book note: {0}", (chosen.basename)));
        }).open();
      });

      // ── Category (groups books in the library) ──────────────────────────────
      p.createDiv("er-info-group").setText(__ertr("Category"));
      const tgWrap = p.createDiv("er-info-booknote");
      const tgHint = tgWrap.createDiv("er-info-rowdesc");
      tgHint.setText(__ertr("Genre or topic — books are grouped by it in the library. Separate several with commas. Empty means no category."));
      tgHint.addClass("er-panel-hint");
      const tgInput = tgWrap.createEl("input", { type: "text" });
      tgInput.addClass("er-panel-input");
      tgInput.placeholder = __ertr("e.g. Psychology, Business");
      tgInput.disabled = !view.file;
      if (view.file) tgInput.value = bookTagsOf(view.plugin.settings, view.file.path).join(", ");
      const knownTags = allBookTags(view.plugin.settings);
      if (knownTags.length) {
        const dl = tgWrap.createEl("datalist");
        dl.id = "er-info-tags-" + Math.random().toString(36).slice(2, 8);
        knownTags.forEach((t) => dl.createEl("option", { value: t }));
        tgInput.setAttr("list", dl.id);
      }
      const saveTags = async () => {
        if (!view.file) return;
        await view.plugin.setBookTags(view.file.path, parseBookTags(tgInput.value));
      };
      tgInput.addEventListener("change", saveTags);
      tgInput.addEventListener("blur", saveTags);

      // ── Per-book template override ──────────────────────────────────────────
      p.createDiv("er-info-group").setText(__ertr("Template for this book"));
      const tpWrap = p.createDiv("er-info-booknote");
      const tpHint = tpWrap.createDiv("er-info-rowdesc");
      tpHint.setText(__ertr("A template just for this book (for example, per genre). Empty — the shared template from the plugin settings is used."));
      tpHint.addClass("er-panel-hint");
      const tpInput = tpWrap.createEl("input", { type: "text" });
      tpInput.addClass("er-panel-input");
      tpInput.placeholder = (view.plugin.settings.noteTemplate || "").trim() || __ertr("Templates/Template.md");
      tpInput.disabled = !view.file;
      if (view.file) {
        const tmap = view.plugin.settings.bookTemplates || {};
        tpInput.value = tmap[view.file.path] || "";
      }
      const saveBookTemplate = async () => {
        if (!view.file) return;
        if (!view.plugin.settings.bookTemplates) view.plugin.settings.bookTemplates = {};
        const v = tpInput.value.trim();
        if (v) view.plugin.settings.bookTemplates[view.file.path] = v;
        else delete view.plugin.settings.bookTemplates[view.file.path];
        await view.plugin.saveAll();
      };
      tpInput.addEventListener("change", saveBookTemplate);
      tpInput.addEventListener("blur", saveBookTemplate);
      const tpPick = tpWrap.createDiv("er-booknote-pick");
      tpPick.setText(__ertr("Choose from the list…"));
      tpPick.addClass("er-panel-link-spaced");
      tpPick.addEventListener("click", () => {
        if (!view.file) return;
        const files = view.app.vault.getMarkdownFiles();
        if (!files.length) { new Notice(__ertr("No notes in the vault")); return; }
        new TemplatePicker(view.app, files, async (chosen) => {
          if (!view.plugin.settings.bookTemplates) view.plugin.settings.bookTemplates = {};
          view.plugin.settings.bookTemplates[view.file.path] = chosen.path;
          await view.plugin.saveAll();
          tpInput.value = chosen.path;
          new Notice(__ertr("Book template: {0}", (chosen.basename)));
        }).open();
      });
}
// Returns the body element to fill. The open/closed state is remembered in
// settings under `settingKey` so the panel reopens the way it was left.
// Shared by both readers — the desktop panel and the mobile sheet.
function panelSection(view, p, { label, emoji, settingKey, defaultOpen = false }) {
  const hdr = p.createDiv("er-pan-adv-hdr");
  if (emoji) hdr.createSpan({ cls: "er-pan-adv-ic", text: emoji });
  hdr.createSpan({ cls: "er-pan-adv-lbl", text: label });
  // Collapsed sections hide whether there is anything inside, so the header
  // carries a count that the section's own render fills in.
  const count = hdr.createSpan({ cls: "er-pan-adv-count" });
  const car = hdr.createSpan({ cls: "er-pan-adv-car", text: "›" });
  const wrap = p.createDiv("er-pan-adv");
  // The open/close animation needs exactly ONE child to size against.
  const body = wrap.createDiv("er-pan-adv-body");
  body._erCount = count;
  const stored = view.plugin.settings[settingKey];
  if (stored === void 0 ? defaultOpen : stored) {
    wrap.addClass("er-pan-adv-on");
    car.addClass("er-pan-adv-car-on");
  }
  hdr.addEventListener("click", async () => {
    const on = wrap.hasClass("er-pan-adv-on");
    wrap.toggleClass("er-pan-adv-on", !on);
    car.toggleClass("er-pan-adv-car-on", !on);
    view.plugin.settings[settingKey] = !on;
    // Local-only write: this is a UI preference, not reading data, so it must not
    // trigger the folder/progress machinery that saveAll() drives.
    await view.plugin._saveLocalData();
  });
  return body;
}
function buildReaderExtraSettings(view, p) {
  const s = view.plugin.settings;
  const sec = (l) => p.createDiv("er-pan-sec").setText(l);
  sec(__ertr("Page turning"));
  const navRow = p.createDiv("er-col-row");
  [["buttons", __ertr("Buttons")], ["click", __ertr("By click")]].forEach(([v, label]) => {
    const btn = navRow.createDiv("er-col-btn");
    btn.setText(label);
    if ((s.navMode || "buttons") === v) btn.addClass("active");
    btn.addEventListener("click", async () => {
      s.navMode = v;
      await view.plugin.saveAll();
      navRow.querySelectorAll(".er-col-btn").forEach((b) => b.removeClass("active"));
      btn.addClass("active");
      (view.contentEl || view.containerEl).classList.toggle("er-navclick", v === "click");
    });
  });
  p.createDiv("er-pan-hint").setText(__ertr("\"By click\": clicking the left part of the page goes back, the right part goes forward. The center stays free for selecting text."));
  sec(__ertr("Text alignment"));
  const alRow = p.createDiv("er-col-row");
  [["left", __ertr("Left")], ["justify", __ertr("Justify")], ["center", __ertr("Center")], ["right", __ertr("Right")]].forEach(([v, label]) => {
    const btn = alRow.createDiv("er-col-btn");
    btn.setText(label);
    if ((s.textAlign || "left") === v) btn.addClass("active");
    btn.addEventListener("click", async () => {
      s.textAlign = v;
      await view.plugin.saveAll();
      alRow.querySelectorAll(".er-col-btn").forEach((b) => b.removeClass("active"));
      btn.addClass("active");
      if (view.bookHtml && typeof view.repaginate === "function") await view.repaginate();
      else if (view.bookHtml && typeof view._repaginate === "function") await view._repaginate();
    });
  });
  sec(__ertr("Position on the page"));
  const vaRow = p.createDiv("er-col-row");
  [["top", __ertr("Top")], ["center", __ertr("Center")], ["bottom", __ertr("Bottom")]].forEach(([v, label]) => {
    const btn = vaRow.createDiv("er-col-btn");
    btn.setText(label);
    if ((s.vAlign || "top") === v) btn.addClass("active");
    btn.addEventListener("click", async () => {
      s.vAlign = v;
      await view.plugin.saveAll();
      vaRow.querySelectorAll(".er-col-btn").forEach((b) => b.removeClass("active"));
      btn.addClass("active");
      if (view.bookHtml && typeof view.repaginate === "function") await view.repaginate();
      else if (view.bookHtml && typeof view._repaginate === "function") await view._repaginate();
    });
  });
  p.createDiv("er-pan-hint").setText(__ertr("Where to place the text when a page isn't filled — at the end of a chapter, for instance."));
  sec(__ertr("Reading goal"));
  const onRow = p.createDiv("er-col-row");
  const goalStep = p.createDiv("er-sz-row");
  [["on", __ertr("On")], ["off", __ertr("Off")]].forEach(([v, label]) => {
    const btn = onRow.createDiv("er-col-btn");
    btn.setText(label);
    const isOn = v === "on";
    if (!!s.timerEnabled === isOn) btn.addClass("active");
    btn.addEventListener("click", async () => {
      s.timerEnabled = isOn;
      await view.plugin.saveAll();
      onRow.querySelectorAll(".er-col-btn").forEach((b) => b.removeClass("active"));
      btn.addClass("active");
      goalStep.style.opacity = isOn ? "1" : ".45";
      updateGoalBar(view);
    });
  });
  const gM = goalStep.createDiv("er-sz-btn"); gM.setText("−");
  const gL = goalStep.createDiv("er-sz-label");
  const gP = goalStep.createDiv("er-sz-btn"); gP.setText("+");
  const setGL = () => gL.setText(__ertr("{0} min/day", (s.dailyGoalMin || 15)));
  setGL();
  goalStep.style.opacity = s.timerEnabled ? "1" : ".45";
  const chG = async (d) => {
    s.dailyGoalMin = Math.min(180, Math.max(5, (s.dailyGoalMin || 15) + d));
    setGL();
    await view.plugin.saveAll();
    updateGoalBar(view);
  };
  gM.addEventListener("click", () => chG(-5));
  gP.addEventListener("click", () => chG(5));
  const mins = Math.floor(view.plugin.getTodaySeconds() / 60);
  const totalMin = Math.floor(view.plugin.getTotalSeconds() / 60);
  const totalH = Math.floor(totalMin / 60);
  const totalStr = totalH > 0 ? __ertr("{0} h {1} min", totalH, totalMin % 60) : __ertr("{0} min", totalMin);
  p.createDiv("er-pan-hint").setText(__ertr("Read today: {0} min. All-time total: {1}. The ▶ button at the top starts the countdown toward the goal (pause — ⏸).", (mins), totalStr));
  buildBookSettings(view, p);
}
function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Copy text to the clipboard, with a fallback for older/mobile webviews where
// navigator.clipboard may be unavailable or blocked.
async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* optional step; a failure here must not interrupt reading */ }
  return false;
}
// Open an image full-screen over everything (works on desktop and the mobile
// modal). Tap the image again to zoom to 100% (then pan); tap the backdrop, the
// ✕, or press Esc to close. Used for illustration pages that are too small to
// read inside a reading column.
function openImageLightbox(src: string, app: unknown, ownerEl?: unknown) {
  if (!src) return;
  const doc = docOf(ownerEl);
  const host = doc.body || (doc.documentElement as HTMLElement) || document.body;
  const ov = host.createDiv("er-lightbox");
  // Image is a direct flex child centered with margin:auto. Unlike
  // align-items/justify-content:center, margin:auto keeps the top-left edge
  // reachable when the (zoomed) image is larger than the screen, so you can
  // scroll to every part of it.
  const img = ov.createEl("img");
  img.src = src;
  const closeBtn = ov.createDiv("er-lightbox-close");
  closeBtn.setText("✕");
  const hint = ov.createDiv("er-lightbox-hint");
  hint.setText(__ertr("Tap the image to zoom · background or ✕ to close"));
  let closed = false;
  let scope: unknown = null;
  const remove = () => {
    if (closed) return;
    closed = true;
    if (scope && app && (app as { keymap?: { popScope: (s: unknown) => void } }).keymap) {
      try {
        (app as { keymap: { popScope: (s: unknown) => void } }).keymap.popScope(scope);
      } catch {
        /* optional step; a failure here must not interrupt reading */
      }
    }
    doc.removeEventListener("keydown", onKey, true);
    ov.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      remove();
    }
  };
  // The ONLY reliable way to grab Esc before Obsidian closes the reader/leaf is
  // its own keymap: push a scope so this viewer becomes the active key handler;
  // the Escape handler returns false to stop the event going any further. The
  // capture-phase DOM listener is a belt-and-suspenders fallback.
  if (app && (app as { keymap?: { pushScope: (s: unknown) => void } }).keymap && Scope) {
    try {
      const sc = new Scope();
      sc.register([], "Escape", () => {
        remove();
        return false;
      });
      (app as { keymap: { pushScope: (s: unknown) => void } }).keymap.pushScope(sc);
      scope = sc;
    } catch {
      scope = null;
    }
  }
  doc.addEventListener("keydown", onKey, true);
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    remove();
  });
  ov.addEventListener("click", (e) => {
    if (e.target === ov) remove();
  });
  img.addEventListener("click", (e) => {
    e.stopPropagation();
    img.classList.toggle("er-lightbox-zoom");
  });
  window.requestAnimationFrame(() => ov.classList.add("er-lightbox-on"));
}
class KindleReaderPlugin extends Plugin {
  settings: KindleReaderSettings;
  progress: Record<string, BookProgress>;
  thumbCache: Record<string, string>;
  highlights: Record<string, BookHighlight[]>;
  progressBackups: Record<string, ProgressBackup[]>;
  highlightsBackups: Record<string, HighlightBackup[]>;
  _lastBookPath?: string;
  _bookCmdTimer?: number;
  _onbShown?: boolean;
  _wnShown?: boolean;
  _openReaderModal?: (modal: Modal) => void;

  constructor(...args: [App, PluginManifest]) {
    super(...args);
    this.settings = { ...DEFAULT };
    this.progress = {};
    this.thumbCache = {};
    this.highlights = {};
    this.progressBackups = {};
    this.highlightsBackups = {};
  }
  async onload() {
    registerCommands(this);
    await this.loadAll();
    this.registerView(VIEW_TYPE, (leaf) => new ReaderView(leaf, this));
    this.registerView(LIB_VIEW_TYPE, (leaf) => new LibraryView(leaf, this));
    this.registerView(LEGACY_LIB_VIEW_TYPE, (leaf) => new LibraryView(leaf, this));
    // Quote backlinks. A quote in a note carries an obsidian:// link back to the
    // exact paragraph it came from, so clicking it opens the book there. Using
    // the app's own URI scheme rather than something bespoke means the link
    // works from anywhere a link works — a note, the daily journal, a canvas.
    const handleProto = (params: Record<string, string>) => {
      // `block` for a quote, `page` for a note made from a scanned page — the
      // latter has no paragraph to anchor to.
      this.openBookAt(params.book || "", params.block, params.page);
    };
    this.registerObsidianProtocolHandler("kindle-reader", handleProto);
    this.registerObsidianProtocolHandler("elton-reader", handleProto);
    this.registerExtensions(["epub"], VIEW_TYPE);
    // FB2 in its own try/catch for the same reason as PDF below: Obsidian has no
    // built-in handler for it, but another plugin might have claimed it, and that
    // must not take epub down with it.
    try { this.registerExtensions(["fb2"], VIEW_TYPE); }
    catch (e) { console.warn("Kindle Reader: could not register .fb2", e); }
    // Also open PDFs in the reader instead of Obsidian's built-in PDF viewer.
    // Separate call in try/catch: if some other plugin already claimed "pdf",
    // we still keep epub working and fall back to the right-click menu for PDFs.
    try { this.registerExtensions(["pdf"], VIEW_TYPE); }
    catch (e) { console.warn(__ertr("Kindle Reader: could not register .pdf, use right-click → Open in Kindle Reader"), e); }
    this.addRibbonIcon(
      "book-open",
      __ertr("Kindle Reader — Library"),
      () => this.openLibrary()
    );
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (file instanceof TFile && file.extension === "pdf")
        menu.addItem((item) => item.setTitle(__ertr("📖 Open in Kindle Reader")).setIcon("book-open").onClick(() => this.openFile(file)));
    }));
    this.addSettingTab(new SettingsTab(this.app, this));
    // One command per book, so a book can be given its own hotkey. Deferred: at
    // onload the vault index is still filling and getFiles() would miss books.
    this.app.workspace.onLayoutReady(() => {
      this.registerBookCommands();
      // Keep the list honest as books are added, renamed or deleted. Debounced —
      // a sync or a bulk import fires these events in bursts.
      const refresh = () => {
        window.clearTimeout(this._bookCmdTimer);
        this._bookCmdTimer = window.setTimeout(() => this.registerBookCommands(), 1500);
      };
      for (const ev of ["create", "delete", "rename"]) {
        this.registerEvent(this.app.vault.on(ev, (f) => {
          if (f && /^(epub|fb2|pdf)$/.test(f.extension || "")) refresh();
        }));
      }
    });
    // First run: greet the user once with the welcome slideshow, after the
    // workspace is ready so it doesn't fight the initial layout. We persist the
    // "seen" flag BEFORE opening (and await it) — otherwise a re-trigger (e.g. a
    // plugin reload from sync writing data.json) could fire the onboarding a
    // second time before the old close-time flag ever hit disk. A per-session
    // guard covers the rest.
    if (!this.settings.onboarded) {
      this.app.workspace.onLayoutReady(async () => {
        if (this.settings.onboarded || this._onbShown) return;
        this._onbShown = true;
        this.settings.onboarded = true;
        this.settings.lastSeenVersion = this.manifest.version;   // fresh install: nothing to catch up on
        await this.saveAll();
        new OnboardingModal(this.app, this).open();
      });
    } else {
      // Already a user, and the plugin has been updated since they last looked →
      // show what they got. Same "persist before opening" guard as above so a
      // reload can't show it twice.
      this.app.workspace.onLayoutReady(async () => {
        if (this._wnShown) return;
        const seen = this.settings.lastSeenVersion || "";
        const cur = this.manifest.version;
        // Blank means they upgraded from a build that never tracked this; show
        // the history so the jump isn't silent.
        const news = whatsNewSince(seen, cur);
        if (!news.length) {
          if (seen !== cur) { this.settings.lastSeenVersion = cur; await this._saveLocalData(); }
          return;
        }
        this._wnShown = true;
        this.settings.lastSeenVersion = cur;
        await this.saveAll();
        const noteFile = this.settings.whatsNewNote === false
          ? null
          : await writeWhatsNewNote(this.app, this, news);
        new WhatsNewModal(this.app, this, news, noteFile).open();
      });
    }
  }
  async openFile(file) {
    // A dialog on the phone, a tab everywhere else — and the dialog is not a
    // workaround, it is the only shape that works.
    //
    // I tried a leaf here, because the library became one and it fixed the
    // library. On a phone the book came out worse, and for reasons a leaf cannot
    // avoid: Obsidian floats its own header buttons over the top of the content
    // (straight across the reader's title bar and the clock) and puts the mobile
    // navbar over the bottom of it (straight across the page counter). Worse,
    // the workspace keeps the gestures — a swipe left opens the file sidebar
    // instead of turning the page, and a pull down fires the quick action. There
    // is no plugin API to take a gesture back; the request for one is still open
    // on the forum. A modal sits above the workspace and keeps its own touches,
    // which is exactly what a book needs.
    if (this.app.isMobile) {
      new ReaderModal(this.app, this, file).open();
      return;
    }
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    const leaf = leaves.length > 0 ? leaves[0] : this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE, state: { path: file.path }, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  // Open the library. As a tab by default, so it can be docked, split, resized
  // and dragged out into its own window like anything else in Obsidian; in a
  // separate window straight away when asked.
  //
  // On a phone there are no windows and tabs are cramped, so the full-screen
  // dialog stays the right shape there.
  async openLibrary(inNewWindow = false, asModal = false) {
    if (asModal) {
      new LibraryModal(this.app, this).open();
      return;
    }
    try {
      const existing = [
        ...this.app.workspace.getLeavesOfType(LIB_VIEW_TYPE),
        ...this.app.workspace.getLeavesOfType(LEGACY_LIB_VIEW_TYPE)
      ];
      if (existing.length && !inNewWindow) {
        this.app.workspace.revealLeaf(existing[0]);
        return;
      }
      const leaf = inNewWindow && !this.app.isMobile && this.app.workspace.openPopoutLeaf
        ? this.app.workspace.openPopoutLeaf()
        : this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: LIB_VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    } catch (err) {
      console.warn("Kindle Reader: could not open library view, falling back to modal", err);
      new LibraryModal(this.app, this).open();
    }
  }
  // Open a book AND land on a particular paragraph. This is what a quote's
  // backlink resolves to: readers asked to click a quote in their notes and
  // arrive at the page it came from, the way a PDF annotation plugin does.
  //
  // The paragraph index is the same anchor reading progress uses, so it travels
  // between devices and survives a different font size or column count.
  async openBookAt(path, block, page) {
    const file = this.app.vault.getAbstractFileByPath(erPath(path));
    if (!(file instanceof TFile)) {
      new Notice(__ertr("Book not found: {0}", path));
      return;
    }
    await this.openFile(file);
    let idx = Number(block);
    if (!Number.isFinite(idx) || idx < 0) {
      // No paragraph anchor — this came from a scanned page, which carries a
      // page number instead. Resolve it to the first block of that page.
      const pg = Number(page);
      if (!Number.isFinite(pg) || pg < 1) return;
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
        const view = leaf.view;
        if (view && typeof view.jumpToPdfPageWhenReady === "function") {
          view.jumpToPdfPageWhenReady(pg);
          return;
        }
      }
      return;
    }
    // The book is still being laid out at this point; the view exposes the jump
    // so it can be applied once the text exists.
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      const view = leaf.view;
      if (view && typeof view.jumpToBlockWhenReady === "function") {
        view.jumpToBlockWhenReady(idx);
        return;
      }
    }
  }
  // Folder that holds reading data (progress / highlights / rescue backups):
  // the dedicated "dataFolder" if set, otherwise next to the books (booksFolder).
  _dataFolder() {
    const dedicated = erPath(this.settings.dataFolder);
    if (dedicated) return dedicated;
    return erPath(this.settings.booksFolder);
  }
  // Returns the vault path for the progress JSON file.
  _progressFilePath() {
    const folder = this._dataFolder();
    return erPath(folder ? `${folder}/reading-progress.json` : "reading-progress.json");
  }
  async loadAll() {
    const d = await this.loadData();
    this.settings = { ...DEFAULT, ...(d?.settings ?? {}) };
    // Overlay whatever THIS device last looked like (no-op unless enabled).
    applyDeviceProfile(this.settings);
    // An older install may carry a null here from a build that derived this
    // from the system preference; treat it as on, which is the default now.
    if (this.settings.pageTurnAnimation === null || this.settings.pageTurnAnimation === void 0) {
      this.settings.pageTurnAnimation = true;
    }
    // Default to English unless the reader has chosen another interface language.
    if (!this.settings.languagePicked) {
      this.settings.language = "en";
    }
    // Publish the chosen UI language so __ertr() (module-level i18n helper) can read it.
    __erSetLang(this.settings.language);
    // Bump THUMB_VER whenever the thumbnail renderer changes so old (blurry)
    // covers are regenerated once at the new quality instead of lingering.
    // Cover thumbnails live in their OWN local file (thumb-cache.json), kept out
    // of data.json so the synced settings stay tiny and conflict-free. On the
    // first run after this change, migrate the old cache out of data.json.
    await this._loadThumbCache(d);
    this.progressBackups = (d == null ? void 0 : d.progressBackups) != null ? d.progressBackups : {};
    this.highlightsBackups = (d == null ? void 0 : d.highlightsBackups) != null ? d.highlightsBackups : {};
    // Remember the last book's folder across restarts so rescue backups land
    // next to the books even before a book is opened in this session.
    this._lastBookPath = (d == null ? void 0 : d.lastBookPath) || "";
    // Load progress from vault file (syncs via Obsidian Sync)
    this.progress = await this._loadProgressFromVault();
    // Highlights live next to progress so they also sync via Obsidian Sync
    this.highlights = await this._loadHighlightsFromVault();
    // One-time repair. Older builds set "already asked about this book" BEFORE
    // the reader answered — and back then the prompt couldn't create a note at
    // all, and gave up silently when no book-notes folder was configured. Those
    // books can therefore never show the setup screen again, even though the
    // reader was never actually offered anything. Clear the flag wherever no note
    // was linked, so the fixed flow gets exactly one chance. Books that DO have a
    // note are left alone, and from now on the flag is only set on a real answer.
    if (!this.settings.promptedRepaired) {
      const asked = this.settings.bookNotePrompted || {};
      const links = this.settings.bookNoteLinks || {};
      for (const k of Object.keys(asked)) if (!links[k]) delete asked[k];
      this.settings.promptedRepaired = true;
      // Previously logged how many books were repaired. It ran once per install
      // and told the reader nothing they could act on, so it only added noise to
      // a console other plugins have to share.
      await this._saveLocalData();
    }
    // One-time migration: turn pictures on for everyone who never chose to hide
    // them. The setting shipped defaulting to OFF, so every existing install has
    // `false` written into data.json without anyone having decided that — and the
    // symptom (illustrated books silently showing no pictures) reads as a bug,
    // not a preference. Runs once; anyone who switches it off afterwards keeps it.
    if (!this.settings.figuresShownByDefault) {
      this.settings.pdfShowFiguresOnTextPages = true;
      this.settings.figuresShownByDefault = true;
      await this._saveLocalData();
    }
    // One-time migration: if old data.json had progress, move it to vault file
    const oldProgress = d?.progress ?? {};
    if (Object.keys(oldProgress).length > 0 && Object.keys(this.progress).length === 0) {
      this.progress = oldProgress;
      await this._saveProgressToVault();
      // Remove from data.json to avoid future confusion
      await this._saveLocalData();
    }
  }
  async saveAll() {
    await this._saveLocalData();
    await this._saveProgressToVault();
  }
  _saveLocalData() {
    captureDeviceProfile(this.settings);
    return this.saveData({ settings: this.settings, progressBackups: this.progressBackups, highlightsBackups: this.highlightsBackups, lastBookPath: this._lastBookPath || "" });
  }
  // ── Cover thumbnail cache (separate, device-local, NOT synced) ─────────────
  _thumbCachePath() { return erPath(`${this.manifest.dir}/thumb-cache.json`); }
  async _loadThumbCache(d) {
    try {
      const p = this._thumbCachePath();
      if (await this.app.vault.adapter.exists(p)) {
        const j = JSON.parse(await this.app.vault.adapter.read(p));
        this.thumbCache = (j && j.ver === 2 && j.cache) ? j.cache : {};
        return;
      }
    } catch (e) { console.warn("Book Reader: thumb cache load failed", e); }
    // Migrate the old in-data.json cache once, then persist to the new file.
    this.thumbCache = ((d == null ? void 0 : d.thumbCacheVer) === 2 && (d == null ? void 0 : d.thumbCache)) ? d.thumbCache : {};
    if (Object.keys(this.thumbCache).length) this._saveThumbCache();
  }
  _saveThumbCache() {
    this._thumbSaveChain = (this._thumbSaveChain || Promise.resolve()).then(
      () => this.app.vault.adapter.write(this._thumbCachePath(), JSON.stringify({ ver: 2, cache: this.thumbCache }))
    ).catch((e) => console.warn("Book Reader: thumb cache save failed", e));
    return this._thumbSaveChain;
  }
  // ── Daily reading-goal timer ───────────────────────────────────────────────
  _todayKey() { return readerTodayKey(); }
  // Add active reading seconds to today's tally (kept in memory; flushed to disk
  // periodically so we don't rewrite data.json every second).
  bumpReadingTime(sec) {
    const s = this.settings;
    if (!s.readingLog) s.readingLog = {};
    const k = this._todayKey();
    s.readingLog[k] = (s.readingLog[k] || 0) + sec;
    s.lifetimeSeconds = (s.lifetimeSeconds || 0) + sec;
    const keys = Object.keys(s.readingLog);
    if (keys.length > 100) { keys.sort(); while (keys.length > 90) delete s.readingLog[keys.shift()]; }
    this._readingDirty = true;
  }
  getTodaySeconds() {
    const s = this.settings;
    return (s.readingLog && s.readingLog[this._todayKey()]) || 0;
  }
  // Sum of every day's reading seconds we still keep (~last 90 days) — shown as a
  // running total in the reading panel and settings. Requested by readers.
  getTotalSeconds() {
    const s = this.settings;
    const logSum = s.readingLog ? Object.keys(s.readingLog).reduce((a, k) => a + (s.readingLog[k] || 0), 0) : 0;
    // Lifetime counter is untrimmed; for users upgrading with existing history it
    // may start behind the 90-day log, so never report less than the log holds.
    return Math.max(s.lifetimeSeconds || 0, logSum);
  }
  // ── Opening books by command ───────────────────────────────────────────────
  // Every readable book in the configured folder (or the whole vault when none
  // is set) — the same rule the library window uses.
  bookFiles() {
    const folder = erPath(this.settings.booksFolder || "");
    const prefix = folder ? folder + "/" : "";
    return this.app.vault.getFiles().filter(
      (f) => (f.extension === "epub" || f.extension === "pdf" || f.extension === "fb2")
        && (prefix === "" || f.path.startsWith(prefix))
    );
  }
  // The book with the most recent reading timestamp, skipping any whose file has
  // since been deleted or renamed.
  lastReadBookFile() {
    const prog = this.progress || {};
    let bestPath = "", bestAt = -1;
    for (const p of Object.keys(prog)) {
      const at = (prog[p] && (prog[p].lastRead || prog[p].updated)) || 0;
      const ts = typeof at === "number" ? at : Date.parse(at) || 0;
      if (ts > bestAt) { bestAt = ts; bestPath = p; }
    }
    if (!bestPath) bestPath = this.settings.lastBookPath || "";
    if (!bestPath) return null;
    const f = this.app.vault.getAbstractFileByPath(bestPath);
    return f && f.extension ? f : null;
  }
  // Register "Book Reader: <title>" for each book so it can be opened directly or
  // bound to a hotkey. Obsidian has no public API for dropping a command, so the
  // ids are tracked and removed through the (undocumented) registry when the list
  // is rebuilt — guarded, since that call is not part of the public API.
  registerBookCommands() {
    const prev = this._bookCmdIds || [];
    for (const id of prev) {
      try { this.app.commands.removeCommand(id); } catch { /* not supported — leave it */ }
    }
    const ids = [];
    const files = this.bookFiles()
      .sort((a, b) => a.basename.localeCompare(b.basename))
      .slice(0, MAX_BOOK_COMMANDS);   // a huge library would otherwise bury every other command
    for (const f of files) {
      const path = f.path;
      const cmd = this.addCommand({
        // Path-derived so the id survives restarts and keeps any assigned hotkey.
        id: "open-book:" + path,
        name: __ertr("Open book: {0}", f.basename),
        callback: () => {
          const cur = this.app.vault.getAbstractFileByPath(path);
          if (cur) this.openFile(cur);
          else new Notice(__ertr("Book not found: {0}", path));
        }
      });
      if (cmd && cmd.id) ids.push(cmd.id);
    }
    this._bookCmdIds = ids;
  }
  // Auto-create (once) a dedicated note named after the book and link it, so
  // every book gets its own note without manual picking. Opt-in via autoBookNote.
  async ensureBookNote(file) {
    if (!file) return null;
    const s = this.settings;
    if (!s.bookNoteLinks) s.bookNoteLinks = {};
    if (s.bookNoteLinks[file.path]) return null;
    const base = bookNotesFolderPath(this.app) || notesFolderPath(this.app) || "";
    return this.createBookNote(file, file.basename, base);
  }
  // Categories assigned to a book. Stored per book rather than derived from the
  // note, so a book can be filed under a category even without a note.
  async setBookTags(bookPath, tags) {
    const s = this.settings;
    if (!s.bookTags) s.bookTags = {};
    const list = (tags || []).filter(Boolean);
    if (list.length) s.bookTags[bookPath] = list;
    else delete s.bookTags[bookPath];
    await this.saveAll();
  }
  // Create the note for a book and link it. `title` and `folder` come from the
  // setup screen, so the reader can name it and place it wherever they want
  // instead of being stuck with the defaults.
  async createBookNote(file, title, folder) {
    try {
      if (!file) return null;
      const s = this.settings;
      if (!s.bookNoteLinks) s.bookNoteLinks = {};
      const base = erPath(folder);
      const name = sanitizeNoteTitle(title || file.basename);
      // Never overwrite: if that name is taken, link the EXISTING note rather
      // than clobbering someone's file or silently failing.
      const path5 = erPath(base ? `${base}/${name}.md` : `${name}.md`);
      let note = this.app.vault.getAbstractFileByPath(path5);
      if (!(note instanceof TFile)) {
        if (base && !this.app.vault.getAbstractFileByPath(base)) await this.app.vault.createFolder(base).catch(() => {});
        // The note template applies here too. It only ever ran for notes made
        // from a selection, so a reader who had set one up and turned on
        // automatic book notes got a bare heading and no explanation why —
        let body = `# ${name}\n\n`;
        const tplPath = noteTemplatePath(this.app, file);
        const tplFile = tplPath ? this.app.vault.getAbstractFileByPath(tplPath) : null;
        if (tplFile instanceof TFile) {
          try { body = processTemplateManually(await this.app.vault.read(tplFile), name) + "\n\n"; }
          catch { /* a broken template must not stop the note being created */ }
        }
        note = await this.app.vault.create(path5, body).catch((e) => {
          console.error("Kindle Reader: create book note failed", e);
          return null;
        });
      }
      if (note instanceof TFile) {
        s.bookNoteLinks[file.path] = note.basename;
        await this.saveAll();
        await writeBookProperty(this.app, note.basename, file);
        return note;
      }
      new Notice(__ertr("Could not create the note"));
      return null;
    } catch (e) {
      console.error("Kindle Reader: create book note failed", e);
      new Notice(__ertr("Could not create the note"));
      return null;
    }
  }
  resetTodaySeconds() {
    const s = this.settings;
    if (!s.readingLog) s.readingLog = {};
    s.readingLog[this._todayKey()] = 0;
    this._readingDirty = true;
  }
  getGoalSeconds() { return Math.max(60, (this.settings.dailyGoalMin || 15) * 60); }
  flushReadingTime() {
    if (!this._readingDirty) return;
    this._readingDirty = false;
    this._saveLocalData();
  }
  // Keep a rolling local history of reading positions per book (in data.json),
  // so a glitch (e.g. a stray jump to 100%) never loses the real position.
  _recordBackup(path5, prev, now) {
    if (!prev || typeof prev.percent !== "number") return;
    const list = this.progressBackups[path5] || (this.progressBackups[path5] = []);
    const last = list[list.length - 1];
    if (last && last.percent === prev.percent) { last.ts = now; return; }
    list.push({ pct: prev.pct, percent: prev.percent, lastRead: prev.lastRead || now, ts: now });
    if (list.length > 30) list.shift();
  }
  async _loadProgressFromVault() {
    try {
      const path5 = this._progressFilePath();
      const exists = await this.app.vault.adapter.exists(path5);
      if (!exists) return {};
      const raw = await this.app.vault.adapter.read(path5);
      return JSON.parse(raw);
    } catch (e) {
      console.error("Kindle Reader: could not load progress file", e);
      return {};
    }
  }
  async _saveProgressToVault() {
    try {
      const path5 = this._progressFilePath();
      const folder = path5.substring(0, path5.lastIndexOf("/"));
      if (folder) {
        const folderExists = await this.app.vault.adapter.exists(folder);
        if (!folderExists) await this.app.vault.createFolder(folder).catch(() => {});
      }
      await this.app.vault.adapter.write(path5, JSON.stringify(this.progress, null, 2));
      this._writeRescue(false);
    } catch (e) {
      console.error("Kindle Reader: could not save progress file", e);
    }
  }
  // Safety net: keep a dated copy of progress + highlights + the plugin's own
  // data.json under "<booksFolder>/_reader-rescue-<date>" so a sync glitch can
  // never wipe out highlights for good. Progress saves are throttled
  // (≤ once / 5 min); highlight saves force a write (force=true).
  async _writeRescue(force) {
    try {
      const now = Date.now();
      if (!force && this._lastRescueTs && (now - this._lastRescueTs) < 5 * 60 * 1e3) return;
      this._lastRescueTs = now;
      let date;
      try { date = window.moment ? window.moment().format("YYYY-MM-DD") : new Date().toISOString().slice(0, 10); }
      catch { date = new Date().toISOString().slice(0, 10); }
      const bf = this._dataFolder();
      // Prefer the configured data/books folder. When neither is set, keep the
      // backup next to the last book read (persisted across restarts). If we
      // still don't know any book folder, SKIP the backup entirely rather than
      // dumping a "_reader-rescue" folder at the vault root.
      let base;
      if (bf) {
        base = erPath(`${bf}/_reader-rescue`);
      } else if (this._lastBookPath && this._lastBookPath.includes("/")) {
        const bookDir = this._lastBookPath.slice(0, this._lastBookPath.lastIndexOf("/"));
        base = erPath(`${bookDir}/_reader-rescue`);
      } else {
        return;
      }
      const dir = erPath(`${base}/_reader-rescue-${date}`);
      const ad = this.app.vault.adapter;
      if (!await ad.exists(base)) await this.app.vault.createFolder(base).catch(() => {});
      if (!await ad.exists(dir)) await this.app.vault.createFolder(dir).catch(() => {});
      await ad.write(erPath(`${dir}/reading-progress.json`), JSON.stringify(this.progress, null, 2));
      await ad.write(erPath(`${dir}/reading-highlights.json`), JSON.stringify(this.highlights, null, 2));
      const dataPath = erPath(`${this.manifest.dir}/data.json`);
      if (await ad.exists(dataPath)) await ad.write(erPath(`${dir}/plugin-data.json`), await ad.read(dataPath));
    } catch (e) {
      console.error("Kindle Reader: rescue backup failed", e);
    }
  }
  saveProgress(path5, spread, total, block) {
    // Store as 0-1 float so it works across devices with different
    // screen sizes / column counts / font sizes.
    const pct = total > 1 ? spread / (total - 1) : 0;
    const pctDisplay = Math.round(pct * 100);
    const now = Date.now();
    const prev = this.progress[path5];
    // Snapshot the previous position into history on a big jump (≥15%) or
    // roughly every 3 minutes — so we can always roll back to a real spot.
    const bigJump = prev && typeof prev.pct === "number" && Math.abs(pct - prev.pct) >= 0.15;
    const list = this.progressBackups[path5];
    const last = list && list[list.length - 1];
    const periodic = !last || (now - (last.ts || 0)) >= 3 * 60 * 1e3;
    if (bigJump || periodic) this._recordBackup(path5, prev, now);
    this._lastBookPath = path5;
    const entry = { pct, percent: pctDisplay, lastRead: now, page: spread + 1, total };
    // Device-independent anchor: global index of the first visible paragraph.
    if (typeof block === "number" && block >= 0) entry.block = block;
    this.progress[path5] = entry;
    this._saveProgressToVault();
    this._saveLocalData();
    this._syncProgressFrontmatter(path5);
  }
  // Mirror the reading position and Dataview metadata into the book note's frontmatter.
  //
  // Progress itself lives in a JSON file next to the books, which is right — it
  // is the reader's own bookkeeping and has no business in a note. But a reader
  // pointed out that a number in frontmatter is a number Bases can chart, sort
  // and filter, and there is no other way to get reading progress into a table.
  // So the note gets a COPY: the JSON stays the source of truth, the note gets
  // something to look at.
  //
  // Debounced, because progress is written on every page turn and rewriting a
  // note that often would spam the vault (and any sync watching it).
  _syncProgressFrontmatter(bookPath) {
    if (!this.settings.progressToFrontmatter) return;
    const noteName = bookNoteLinkFor(this, { path: bookPath, basename: "" });
    if (!noteName) return;
    const note = resolveBookNote(this.app, noteName);
    if (!note) return;
    window.clearTimeout(this._fmTimers && this._fmTimers[bookPath]);
    if (!this._fmTimers) this._fmTimers = {};
    this._fmTimers[bookPath] = window.setTimeout(async () => {
      const p = this.progress[bookPath];
      if (!p) return;
      try {
        await this.app.fileManager.processFrontMatter(note, (fm) => {
          const pctVal = Math.round((p.pct || 0) * 100);
          fm["reading-progress"] = pctVal;
          fm["progresso_percentual"] = pctVal;
          fm["reading-updated"] = new Date(p.lastRead || Date.now()).toISOString().slice(0, 10);

          if (typeof p.page === "number") {
            fm["paginas_lidas"] = p.page;
          }
          if (typeof p.total === "number" && p.total > 0) {
            fm["total_paginas"] = p.total;
          }
          if (fm["status"] === undefined || fm["status"] === "lendo" || fm["status"] === "lido") {
            fm["status"] = pctVal >= 100 ? "lido" : "lendo";
          }
          if (!fm["data_inicio"]) {
            fm["data_inicio"] = new Date(p.lastRead || Date.now()).toISOString().slice(0, 10);
          }
          if (pctVal >= 100) {
            if (!fm["data_conclusao"]) {
              fm["data_conclusao"] = new Date(p.lastRead || Date.now()).toISOString().slice(0, 10);
            }
          }
          if (fm["autor"] === undefined) {
            const hit = this.app.vault.getAbstractFileByPath(bookPath);
            let authorGuess = "";
            if (hit instanceof TFile && hit.basename.includes(" - ")) {
              authorGuess = hit.basename.split(" - ")[0].trim();
            }
            fm["autor"] = authorGuess;
          }
        });
      } catch (e) {
        console.warn("Book Reader: could not write progress into the book note", e);
      }
    }, 4000);
  }
  // Manual save (the 💾 button / command). Like saveProgress, but always drops a
  // "manual" restore point for the CURRENT position so the user can jump back to
  // exactly here later, even after lots of further reading.
  saveNow(path5, spread, total, block) {
    const pct = total > 1 ? spread / (total - 1) : 0;
    const pctDisplay = Math.round(pct * 100);
    const now = Date.now();
    const hasBlock = typeof block === "number" && block >= 0;
    this._lastBookPath = path5;
    const entry = { pct, percent: pctDisplay, lastRead: now, page: spread + 1, total };
    if (hasBlock) entry.block = block;
    this.progress[path5] = entry;
    const list = this.progressBackups[path5] || (this.progressBackups[path5] = []);
    const last = list[list.length - 1];
    if (last && last.percent === pctDisplay) {
      last.ts = now; last.lastRead = now; last.manual = true;
      if (hasBlock) last.block = block;
    } else {
      const snap = { pct, percent: pctDisplay, lastRead: now, ts: now, manual: true, page: spread + 1, total };
      if (hasBlock) snap.block = block;
      list.push(snap);
      if (list.length > 30) list.shift();
    }
    this._saveProgressToVault();
    this._saveLocalData();
    this._syncProgressFrontmatter(path5);
    return pctDisplay;
  }
  getBackups(path5) {
    const list = this.progressBackups[path5];
    return Array.isArray(list) ? list : [];
  }
  getProgress(path5) {
    let _a;
    return (_a = this.progress[path5]) != null ? _a : null;
  }
  // Returns the spread index for the current device given saved progress.
  getSpreadForTotal(path5, total) {
    const prog = this.getProgress(path5);
    if (!prog) return 0;
    // New format: pct is a 0-1 float
    if (typeof prog.pct === "number") {
      return Math.round(prog.pct * Math.max(0, total - 1));
    }
    // Legacy format: raw spread number (old version) - use as-is
    return typeof prog.spread === "number" ? prog.spread : 0;
  }
  // Re-reads progress from vault file — call before opening a book
  // to get fresh data after Obsidian Sync may have updated the file.
  async refreshProgress() {
    this.progress = await this._loadProgressFromVault();
  }
  // ── Highlights ────────────────────────────────────────
  _highlightsFilePath() {
    const folder = this._dataFolder();
    return erPath(folder ? `${folder}/reading-highlights.json` : "reading-highlights.json");
  }
  async _loadHighlightsFromVault() {
    try {
      const path5 = this._highlightsFilePath();
      const exists = await this.app.vault.adapter.exists(path5);
      if (!exists) return {};
      const raw = await this.app.vault.adapter.read(path5);
      return JSON.parse(raw);
    } catch (e) {
      console.error("Kindle Reader: could not load highlights file", e);
      return {};
    }
  }
  async _saveHighlightsToVault() {
    try {
      const path5 = this._highlightsFilePath();
      const folder = path5.substring(0, path5.lastIndexOf("/"));
      if (folder) {
        const folderExists = await this.app.vault.adapter.exists(folder);
        if (!folderExists) await this.app.vault.createFolder(folder).catch(() => {});
      }
      await this.app.vault.adapter.write(path5, JSON.stringify(this.highlights, null, 2));
      this._writeRescue(true);
    } catch (e) {
      console.error("Kindle Reader: could not save highlights file", e);
    }
  }
  async refreshHighlights() {
    this.highlights = await this._loadHighlightsFromVault();
  }
  getHighlights(path5) {
    let _a;
    const list = (_a = this.highlights[path5]) != null ? _a : [];
    // Stable reading order: by block, then by position inside block
    return [...list].sort((a, b) => a.block - b.block || a.occ - b.occ);
  }
  addHighlight(path5, hl) {
    if (!this.highlights[path5]) this.highlights[path5] = [];
    this.highlights[path5].push(hl);
    this._persistHighlights(path5, (disk) => {
      if (!disk[path5]) disk[path5] = [];
      if (!disk[path5].some((x) => x.id === hl.id)) disk[path5].push(hl);
    });
  }
  removeHighlight(path5, id) {
    const list = this.highlights[path5];
    if (list) this.highlights[path5] = list.filter((h) => h.id !== id);
    this._persistHighlights(path5, (disk) => {
      if (disk[path5]) disk[path5] = disk[path5].filter((h) => h.id !== id);
    });
  }
  // Attach (or clear) the margin note on a highlight. `id` may be null when the
  // reader commented on a plain selection that was never saved — in that case the
  // matching highlight is found by its text, and if there is none we cannot store
  // anything, so the caller is told nothing happened.
  async setHighlightComment(path5, id, hl, text) {
    const list = this.highlights[path5] || [];
    let target = id ? list.find((x) => x.id === id) : null;
    if (!target && hl && hl.text) target = list.find((x) => x.text === hl.text);
    if (!target) { new Notice(__ertr("Highlight a passage with a colour first")); return false; }
    const value = String(text || "").trim();
    if (value) target.comment = value; else delete target.comment;
    this._persistHighlights(path5, (disk) => {
      const d = (disk[path5] || []).find((x) => x.id === target.id);
      if (d) { if (value) d.comment = value; else delete d.comment; }
    });
    new Notice(value ? __ertr("Comment saved") : __ertr("Comment removed"));
    return true;
  }
  setHighlightColor(path5, id, color) {
    const list = this.highlights[path5];
    if (list) {
      const h = list.find((x) => x.id === id);
      if (h) h.color = color;
    }
    this._persistHighlights(path5, (disk) => {
      if (disk[path5]) {
        const h = disk[path5].find((x) => x.id === id);
        if (h) h.color = color;
      }
    });
  }
  // Crash-/sync-safe persistence for incremental highlight edits.
  // Re-reads the on-disk file (which may already contain highlights written by
  // ANOTHER device that this session never loaded) and merges our single change
  // INTO it, so a stale in-memory copy can never clobber newer data via Obsidian
  // Sync. Mutations are serialized through a promise chain to avoid lost updates.
  _persistHighlights(path5, applyFn) {
    this._lastBookPath = path5;
    this._hlChain = (this._hlChain || Promise.resolve()).then(async () => {
      let disk = {};
      try {
        const fp = this._highlightsFilePath();
        if (await this.app.vault.adapter.exists(fp)) {
          disk = JSON.parse(await this.app.vault.adapter.read(fp));
        }
      } catch (e) {
        console.error("Kindle Reader: could not re-read highlights, falling back to memory", e);
        disk = JSON.parse(JSON.stringify(this.highlights || {}));
      }
      if (!disk || typeof disk !== "object") disk = {};
      applyFn(disk);
      // Re-add any local highlights the disk copy doesn't have yet (protects
      // rapid successive edits and concurrent local adds from being dropped).
      if (Array.isArray(this.highlights[path5])) {
        if (!disk[path5]) disk[path5] = [];
        const seen = new Set(disk[path5].map((h) => h.id));
        for (const h of this.highlights[path5]) if (!seen.has(h.id)) disk[path5].push(h);
      }
      this.highlights = disk;
      this._backupHighlights(path5, disk[path5] || []);
      await this._saveHighlightsToVault();
      await this._saveLocalData();
    }).catch((e) => console.error("Kindle Reader: highlight persist failed", e));
    return this._hlChain;
  }
  // Rolling local snapshots of a book's highlights (kept in data.json), so an
  // accidental loss/overwrite can always be restored on this device.
  _backupHighlights(path5, list) {
    if (!this.highlightsBackups) this.highlightsBackups = {};
    const arr = this.highlightsBackups[path5] || (this.highlightsBackups[path5] = []);
    const now = Date.now();
    const sig = list.map((h) => h.id).sort().join(",");
    const last = arr[arr.length - 1];
    if (last && last.sig === sig) { last.ts = now; return; }
    arr.push({ ts: now, count: list.length, sig, items: JSON.parse(JSON.stringify(list)) });
    while (arr.length > 12) arr.shift();
  }
};
// ── Translation ───────────────────────────────────────────────────────────────
// Translate a fragment through Google's public keyless endpoint.
//
// Two deliberate choices:
//  • requestUrl (Obsidian API), not fetch — the reader runs in a renderer where
//    CORS would block this host outright; requestUrl goes through the app.
//  • Chunking — the endpoint silently truncates long input, so a long selection
//    is split on sentence/word boundaries and stitched back together.
//
// This endpoint is free and needs no key, but it's unofficial and rate-limited:
// it is meant for selections, not for translating a whole book.
async function translateText(text, to = "en") {
  const q = (text || "").replace(/\s+/g, " ").trim();
  if (!q) return "";
  const MAX = 1600;
  const chunks = [];
  let rest = q;
  while (rest.length > MAX) {
    // Prefer a sentence end, else a space; never cut mid-word.
    let cut = rest.lastIndexOf(". ", MAX);
    if (cut < MAX * 0.4) cut = rest.lastIndexOf(" ", MAX);
    if (cut <= 0) cut = MAX; else cut += 1;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  let out = "";
  for (const chunk of chunks) {
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto"
      + `&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(chunk)}`;
    // `throw: false` so the STATUS is visible here. Letting requestUrl throw
    // collapsed every failure into one "you need internet" message, which is
    // what a tablet reader saw while plainly being online: the real answer was
    // Google rate-limiting the free endpoint.
    const res = await requestUrl({ url, method: "GET", throw: false });
    if (res.status === 429 || res.status === 503) {
      const err = new Error("translate rate-limited");
      err.erReason = "limit";
      throw err;
    }
    if (res.status < 200 || res.status >= 300) {
      const err = new Error("translate http " + res.status);
      err.erReason = "http";
      err.erStatus = res.status;
      throw err;
    }
    const data = res.json;
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error("unexpected translate response");
    out += data[0].map((p) => (p && p[0]) || "").join("");
  }
  return out.trim();
}
/* ── Reading a book in a foreign language ──────────────────────────────────
 *
 * Readers described the same routine: copy a passage out of the book, paste it
 * into a chat model, and ask for a translation plus a word-by-word breakdown —
 * why this word and not another, and sometimes where it came from. Then paste
 * the answer back. This does that without leaving the page.
 *
 * Every provider here speaks OpenAI's chat-completions dialect, so a provider
 * is only a base URL, a key and a model name — one request path for all of them.
 *
 * requestUrl, never fetch: a fetch() from a plugin is a browser request and is
 * subject to CORS, and a local Ollama server refuses the app://obsidian.md
 * origin unless the reader sets OLLAMA_ORIGINS by hand. requestUrl is issued by
 * the app itself, so the local option works with no setup — which is the whole
 * reason for offering it.
 */

// One instruction for the whole conversation. The breakdown is not a mode of its
// own: it is simply the question most readers ask first, so it is described here
// and sent as an ordinary message.
function aiSystemChat(into) {
  return [
    `You are helping someone read a book in a language they are still learning.`,
    `They send a passage from it and then talk to you about that passage.`,
    `Answer in ${into}. Use Markdown. Be concise — this is read beside the book, not instead of it.`,
    ``,
    `If they ask for a breakdown of the passage, give exactly these sections:`,
    `1. **Translation** — a natural translation of the whole passage, not word-for-word.`,
    `2. **Word by word** — a list of only the words and phrases that are genuinely hard`,
    `   (idioms, rare senses, false friends). Skip anything obvious. For each: the word,`,
    `   its meaning HERE, and its dictionary form if that differs.`,
    `3. **Why it is phrased this way** — the tone, register or construction that a learner`,
    `   would miss: why this wording rather than the plain one. Two or three sentences.`,
    `4. **Word origins** — etymology for at most two words, and only where it actually`,
    `   helps remember them. Omit this section entirely if nothing qualifies.`,
    ``,
    `For anything else, just answer what was asked — no fixed sections, and no`,
    `translation of the whole passage unless that is what they asked for.`,
  ].join("\n");
}
// The reader's own instruction replaces the built-in one entirely. The passage
// rides along with their first message, so the model never sees it as an order.
function aiMessages(text, settings, turns, book) {
  const into = settings.aiInto || "English";
  const own = (settings.aiSystem || "").trim();
  const msgs = [{ role: "system", content: own || aiSystemChat(into) }];
  // Which book this is from, sent quietly with the passage: a page out of context
  // reads very differently from the same page in a book the model knows.
  const from = String(book || "").trim();
  const head = (from ? `From the book “${from}”.\n` : "") + `Passage:\n${text}`;
  turns.forEach((turn, i) => {
    msgs.push(i === 0 && turn.role === "user"
      ? { role: "user", content: `${head}\n\n${turn.content}` }
      : { role: turn.role, content: turn.content });
  });
  return msgs;
}
async function aiExplain(text, settings, turns, book) {
  const cfg = aiConfig(settings);
  if (cfg.needsKey && !cfg.key) {
    const err = new Error("no api key");
    err.erReason = "nokey";
    throw err;
  }
  const headers = { "Content-Type": "application/json" };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  const res = await requestUrl({
    url: `${cfg.base}/chat/completions`,
    method: "POST",
    headers,
    throw: false,
    body: JSON.stringify({
      model: cfg.model,
      messages: aiMessages(text, settings, turns, book),
      temperature: 0.2,
      max_tokens: 900,
    }),
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error("auth"); err.erReason = "auth"; throw err;
  }
  if (res.status === 429) {
    const err = new Error("rate"); err.erReason = "limit"; throw err;
  }
  if (res.status < 200 || res.status >= 300) {
    const err = new Error("http " + res.status);
    err.erReason = "http";
    err.erStatus = res.status;
    // A local server that is simply not running is the single most likely
    // failure of the local option, and "http 0" explains nothing.
    if (cfg.id === "local") err.erReason = "local";
    throw err;
  }
  const data = res.json;
  let out = data && data.choices && data.choices[0] && data.choices[0].message
    ? String(data.choices[0].message.content || "").trim()
    : "";
  if (!out) { const err = new Error("empty"); err.erReason = "empty"; throw err; }
  return out;
}
// Shows the translation of a selection, with the original kept above it so the
// reader can compare. Actions mirror the popup: copy, or save as a note (the
// note keeps the ORIGINAL quote and puts the translation under it).
const TranslateModal = class extends Modal {
  constructor(app, plugin, text, bookFile) {
    super(app);
    this.plugin = plugin;
    this.text = text;
    this.bookFile = bookFile;
  }
  async onOpen() {
    const c = this.contentEl;
    c.empty();
    c.createEl("h3", { text: __ertr("Translation") });
    const box = (label) => {
      const w = c.createDiv();
      w.addClass("er-tr-box");
      const l = w.createDiv();
      l.setText(label);
      l.addClass("er-tr-label");
      const b = w.createDiv();
      b.style.cssText = "max-height:180px;overflow:auto;padding:10px 12px;border:1px solid var(--background-modifier-border);"
        + "border-radius:8px;background:var(--background-secondary);line-height:1.55;white-space:pre-wrap;user-select:text";
      return b;
    };
    box(__ertr("Original")).setText(this.text);
    const outEl = box(__ertr("Translation"));
    outEl.setText(__ertr("Translating…"));
    let tr = "";
    try {
      tr = await translateText(this.text, this.plugin.settings.translateTo || "en");
      outEl.setText(tr || __ertr("The translator returned nothing"));
    } catch (e) {
      console.error("Kindle Reader: translate failed", e);
      const why = e && e.erReason;
      outEl.setText(
        why === "limit"
          ? __ertr("Google is rate-limiting translations. Wait a minute and try again — this is a limit of the free Google Translate, not of your connection.")
          : why === "http"
            ? __ertr("The translator answered with error {0}. Your connection is fine — try again later.", e.erStatus)
            : __ertr("Could not reach the translator. It looks like there is no internet connection."));
      return;
    }
    new Setting(c)
      .addButton((b) => b.setButtonText(__ertr("Copy translation")).onClick(async () => {
        const ok = await copyToClipboard(tr);
        new Notice(ok ? __ertr("Copied ✓") : __ertr("Could not copy"));
      }))
      .addButton((b) => b.setButtonText(__ertr("To a note")).setCta().onClick(async () => {
        // The note keeps the original as the quote (that's what's citable) and
        // adds the translation beneath it.
        await createNoteFromSelection(this.app, this.plugin, this.text, this.bookFile, {
          open: false, silent: true, extra: __ertr("\n\n**Translation:**\n{0}", tr)
        });
        new Notice(__ertr("Note created"));
        this.close();
      }));
  }
  onClose() { this.contentEl.empty(); }
};
// Is the reader running on a phone/tablet? Platform is the modern API; app.isMobile
// is the long-standing fallback, so a missing Platform never breaks the reader.
function erShowVeil(view, text) {
  const host = view && view.areaEl && view.areaEl.parentElement;
  if (!host) return;
  erHideVeil(view);
  const veil = host.createDiv("er-veil");
  const sk = veil.createDiv("er-veil-skel");
  for (let i = 0; i < 8; i++) sk.createDiv("er-veil-line");
  veil.createDiv({ cls: "er-veil-text", text: text || __ertr("Laying out the pages…") });
  view._veil = veil;
}
function erHideVeil(view) {
  if (view && view._veil) {
    view._veil.remove();
    view._veil = null;
  }
}
// Place the highlight bar.
//
// On mobile it is DOCKED to the bottom of the reader rather than floated over the
// selection: Android/iOS draw their own selection toolbar (copy / share / select
// all) directly above the selected text, as an OS-level layer that always wins.
// Ours used to land in exactly that spot and was permanently hidden behind it.
// On desktop there is no such toolbar, so the bar stays next to the selection.
function positionHlPopup(view, rect, fallbackW, fallbackH) {
  const pop = view.hlPopup;
  const root = view.contentEl;
  if (erIsMobile(view.app)) {
    // Docked rather than floated: Android and iOS draw their own selection
    // toolbar (copy / share / select all) directly over the selection, as an
    // OS layer that always wins, and ours used to land underneath it.
    //
    // Which edge it docks to is chosen per selection. Always docking to the
    // bottom left it half a screen away on a tablet — a reader said he did not
    // even notice it had appeared. Docking to the edge FURTHEST from the
    // selection keeps it clear of the OS toolbar while staying in view.
    // Just BELOW the selection, not pinned to the bottom of the screen.
    //
    // Both extremes were wrong. Floating it over the selection buried it under
    // the OS toolbar; pinning it to the bottom edge put it a whole page away
    // from what you had just selected. Below the selection is the one place
    // that is neither: Android and iOS put their own toolbar ABOVE the
    // selection, so the space underneath is free, and the bar appears where the
    // eye already is.
    const rootRect = root.getBoundingClientRect();
    const barH = pop.offsetHeight || fallbackH || 92;
    const barW = pop.offsetWidth || fallbackW || 260;
    // Keep clear of the page controls at the foot of the reader.
    const bottomLimit = rootRect.height - barH - 74;
    const hasRect = rect && rect.height;
    let top = hasRect ? rect.bottom - rootRect.top + 12 : bottomLimit;
    // No room underneath (selection near the foot of the page) — go above it
    // instead, which on that part of the screen is where the OS toolbar is not.
    if (top > bottomLimit) {
      const above = (hasRect ? rect.top - rootRect.top : 0) - barH - 12;
      top = above > 8 ? above : Math.max(8, bottomLimit);
    }
    pop.classList.add("er-hl-popup-docked");
    pop.style.removeProperty("bottom");
    pop.style.top = `${Math.round(Math.max(8, top))}px`;
    // Centred on the selection, then kept inside the page.
    const wantLeft = hasRect
      ? rect.left - rootRect.left + rect.width / 2 - barW / 2
      : (rootRect.width - barW) / 2;
    pop.style.left = `${Math.round(Math.max(8, Math.min(wantLeft, rootRect.width - barW - 8)))}px`;
    return;
  }
  pop.classList.remove("er-hl-popup-docked");
  const rootRect = root.getBoundingClientRect();
  const pw = pop.offsetWidth || fallbackW, ph = pop.offsetHeight || fallbackH;
  let left = rect.left - rootRect.left + rect.width / 2 - pw / 2;
  let top = rect.top - rootRect.top - ph - 10;
  if (top < 4) top = rect.bottom - rootRect.top + 10;
  left = Math.max(6, Math.min(left, root.clientWidth - pw - 6));
  top = Math.max(6, Math.min(top, rootRect.height - ph - 6));
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}
// Wire up the per-page "note" buttons that sit on image/scan pages. Shared by
// both readers. Click → a note for that page, linked back to the book, with the
// page's text as the quote when the PDF has a text layer (on a true scan there
// is none, so the note opens ready for the reader's own words).
function bindPdfNoteButtons(view) {
  const flow = view.pager && view.pager.flow;
  if (!flow) return;
  flow.querySelectorAll("button.er-pdf-note-btn").forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    // The reader turns pages on click in "click" nav mode — this button must not
    // count as a page turn, nor start a text selection.
    btn.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); });
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const pageNo = parseInt(btn.dataset.pdfNotePage, 10);
      await createNoteFromPdfPage(view, pageNo, btn);
    });
  });
}
// Build the note for a single PDF page.
async function createNoteFromPdfPage(view, pageNo, btn) {
  const app = view.app, plugin = view.plugin, file = view.file;
  if (!file) return;
  try {
    // Any text the page does have (the figure sits above it in the same page div).
    let pageText = "";
    const holder = btn && btn.closest ? btn.closest("[data-pdf-page-no]") : null;
    if (holder) {
      pageText = [...holder.querySelectorAll("p")]
        .map((p) => (p.textContent || "").trim())
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000);
    }
    const linkName = bookNoteLinkFor(plugin, file) || file.basename;
    const title = sanitizeNoteTitle(__ertr("{0} — p. {1}", file.basename, pageNo));
    // Same folder rules as a note made from a highlight, so scan pages don't
    // land somewhere else than the rest of a book's notes.
    let folderOverride = null;
    if (plugin.settings.notesNextToBook && file.parent) {
      const beside = erPath(file.parent.path || "");
      if (beside) folderOverride = beside;
    }
    let filename = title, n = 2;
    while (app.vault.getAbstractFileByPath(inboxNotePath(app, filename, folderOverride))) filename = `${title} ${n++}`;
    const quote = pageText
      ? pageText.split("\n\n").map((p) => `> ${p}`).join("\n>\n")
      : __ertr("> *(scanned page — no text to quote, write it in your own words)*");
    // A scanned page has no paragraph to anchor to, so the backlink points at
    // the page — still one click from the note back to where it came from.
    const back = plugin.settings.quoteBacklinks !== false
      ? ` [${backlinkLabel(plugin)}](obsidian://kindle-reader?book=${encodeURIComponent(file.path)}&page=${pageNo})`
      : "";
    const body = `${quote}\n\n${__ertr("— from [[{0}]], p. {1}", linkName, pageNo)}${back}\n`;
    await resolveNotesFolder(app, folderOverride);
    const path5 = inboxNotePath(app, filename, folderOverride);
    const note = await app.vault.create(path5, body);
    if (note instanceof TFile) {
      await appendLinkToBookNote(app, plugin, file, note);
      new Notice(__ertr("Note created: {0}", note.basename));
      await openNoteBesideBook(app, plugin, note);
    }
  } catch (e) {
    console.error("Kindle Reader: note from PDF page failed", e);
    new Notice(__ertr("Could not create the note"));
  }
}
function findAnchorTarget(flow: HTMLElement, ref: string): HTMLElement | null {
  if (!flow || !ref) return null;

  // 1. Direct exact match on data-er-id
  try {
    const el = flow.querySelector(`[data-er-id="${CSS.escape(ref)}"]`);
    if (el.instanceOf(HTMLElement)) return el;
  } catch {
    /* ignore */
  }

  // 2. Try with/without trailing '#'
  try {
    const altRef = ref.endsWith("#") ? ref.slice(0, -1) : ref + "#";
    const el = flow.querySelector(`[data-er-id="${CSS.escape(altRef)}"]`);
    if (el.instanceOf(HTMLElement)) return el;
  } catch {
    /* ignore */
  }

  const hashIdx = ref.indexOf("#");
  const pathPart = hashIdx >= 0 ? ref.slice(0, hashIdx) : ref;
  const fragPart = hashIdx >= 0 ? ref.slice(hashIdx + 1) : "";

  // 3. Search by fragment if present
  if (fragPart) {
    try {
      const el = flow.querySelector(`[data-er-id$="#${CSS.escape(fragPart)}"]`);
      if (el.instanceOf(HTMLElement)) return el;
    } catch {
      /* ignore */
    }

    try {
      const el = flow.querySelector(`#${CSS.escape(fragPart)}, [name="${CSS.escape(fragPart)}"], [id="${CSS.escape(fragPart)}"]`);
      if (el.instanceOf(HTMLElement)) return el;
    } catch {
      /* ignore */
    }
  }

  // 4. Search by filename (handling relative path differences)
  if (pathPart) {
    const filename = pathPart.split("/").pop() || "";
    if (filename) {
      if (fragPart) {
        try {
          const el = flow.querySelector(`[data-er-id="${CSS.escape(filename)}#${CSS.escape(fragPart)}"]`)
            || flow.querySelector(`[data-er-id$="/${CSS.escape(filename)}#${CSS.escape(fragPart)}"]`);
          if (el.instanceOf(HTMLElement)) return el;
        } catch {
          /* ignore */
        }
      }
      try {
        const el = flow.querySelector(`[data-er-id="${CSS.escape(filename)}#"]`)
          || flow.querySelector(`[data-er-id="${CSS.escape(filename)}"]`)
          || flow.querySelector(`[data-er-id$="/${CSS.escape(filename)}#"]`)
          || flow.querySelector(`[data-er-id$="/${CSS.escape(filename)}"]`);
        if (el.instanceOf(HTMLElement)) return el;
      } catch {
        /* ignore */
      }
    }
  }

  // 5. Fallback: search all [data-er-id] elements for substring match
  try {
    const all = flow.querySelectorAll("[data-er-id]");
    for (let i = 0; i < all.length; i++) {
      const val = all[i].getAttribute("data-er-id") || "";
      if (fragPart && val.endsWith("#" + fragPart)) {
        return all[i] as HTMLElement;
      }
      if (pathPart) {
        const fn = pathPart.split("/").pop();
        if (fn && (val === fn || val === fn + "#" || val.endsWith("/" + fn) || val.endsWith("/" + fn + "#"))) {
          return all[i] as HTMLElement;
        }
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

// Follow a footnote reference, and leave a way back.
//
// A note you can reach but not return from is worse than no link at all: the
// reader ends up in the endnotes with no idea which page they left. So the
// origin spread is remembered and offered as a pill until it is used.
function followFootnote(view: unknown, ref: string): boolean {
  const v = view as {
    pager?: {
      flow?: HTMLElement;
      clip?: HTMLElement;
      sw?: number;
      cols?: number;
      total?: number;
      spread?: number;
      currentSpread?: number;
      scrollMode?: boolean;
      spreadForBlock?: (idx: number) => number;
      jumpTo?: (s: number) => [number, number];
      currentBlockIndex?: () => number;
    };
    updateUI?: (cur: number, tot: number) => void;
    _updateUI?: (cur: number, tot: number) => void;
    file?: { path: string };
    plugin?: { saveProgress?: (path: string, cur: number, tot: number, bi: number) => void };
  };
  const flow = v.pager && v.pager.flow;
  if (!flow || !ref) return false;
  const target = findAnchorTarget(flow, ref);
  if (!target) return false;
  const from = v.pager.spread != null ? v.pager.spread : v.pager.currentSpread;

  let spread = -1;
  const blocks = Array.from(flow.querySelectorAll("p,h1,h2,h3,h4"));
  const owner = (target.closest && target.closest("p,h1,h2,h3,h4"))
    || (target.querySelector && target.querySelector("p,h1,h2,h3,h4"))
    || target;
  const idx = blocks.indexOf(owner);

  if (idx >= 0 && typeof v.pager.spreadForBlock === "function") {
    spread = v.pager.spreadForBlock(idx);
  } else {
    // Direct geometric calculation from target element bounding box relative to flow
    if (v.pager.scrollMode) {
      const top = target.getBoundingClientRect().top - flow.getBoundingClientRect().top;
      const viewH = v.pager.clip ? v.pager.clip.clientHeight : 1;
      spread = Math.max(0, Math.min(Math.floor(top / viewH), (v.pager.total || 1) - 1));
    } else {
      const x = target.getBoundingClientRect().left - flow.getBoundingClientRect().left;
      const stride = (v.pager.sw || 1) / (v.pager.cols || 1);
      spread = stride > 0 ? Math.max(0, Math.min(Math.floor(Math.round(x / stride) / (v.pager.cols || 1)), (v.pager.total || 1) - 1)) : 0;
    }
  }

  if (spread < 0) return false;

  const [cur, tot] = typeof v.pager.jumpTo === "function" ? v.pager.jumpTo(spread) : [spread, v.pager.total || 1];
  (v.updateUI || v._updateUI)?.call(v, cur, tot);
  if (v.file && v.plugin && typeof v.plugin.saveProgress === "function") {
    const bi = typeof v.pager.currentBlockIndex === "function" ? v.pager.currentBlockIndex() : (idx >= 0 ? idx : 0);
    v.plugin.saveProgress(v.file.path, cur, tot, bi);
  }
  if (typeof from === "number" && !isNaN(from) && from >= 0) {
    showFootnoteReturn(view, from);
  }
  return true;
}
function showFootnoteReturn(view, spread) {
  hideFootnoteReturn(view);
  const host = view.areaEl;
  if (!host) return;
  const pill = host.createDiv("er-note-back");
  iconLabel(pill, "arrow-left", __ertr("Back to the text"));
  pill.setAttribute("role", "button");
  pill.setAttribute("tabindex", "0");
  const go = () => {
    const [cur, tot] = view.pager.jumpTo(spread);
    (view.updateUI || view._updateUI).call(view, cur, tot);
    hideFootnoteReturn(view);
  };
  pill.addEventListener("click", go);
  pill.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
  });
  view._noteBackEl = pill;
}
function hideFootnoteReturn(view) {
  if (view._noteBackEl) { view._noteBackEl.remove(); view._noteBackEl = null; }
}
function addAiBtn(view, pop) {
  if (!view.plugin.settings.aiEnabled) return;
  const btn = pop.createDiv("er-hl-sw er-hl-ai");
  svgIcon(btn, "sparkles");
  btn.setAttribute("aria-label", __ertr("Break this passage down"));
  btn.addEventListener("click", () => {
    const cur = view._currentHl();
    view._hideHlPopup();
    selOf(view.areaEl)?.removeAllRanges();
    if (!cur) return;
    new AiExplainModal(view.app, view.plugin, cur.text, view.file).open();
  });
}
// The two views spell the same two methods differently (buildHlPanel /
// togglePanel in the leaf, _buildHlPanel / _togglePanel in the phone modal).
// Shared popup code must not have to know which one it is holding: calling the
// name the other view uses threw, and a comment written on the phone was saved
// and then vanished without a word.
//
function erSelectionRect(range, areaEl) {
  let rects = [];
  try {
    rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
  } catch { /* optional step; a failure here must not interrupt reading */ }
  if (!rects.length) return range.getBoundingClientRect();
  const box = areaEl ? areaEl.getBoundingClientRect() : null;
  if (box) {
    const seen = rects.filter((r) => r.right > box.left + 1 && r.left < box.right - 1);
    if (seen.length) rects = seen;
  }
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, right, top, bottom, width: right - left, height: bottom - top, x: left, y: top };
}
function erRefreshHlPanel(view) {
  const fn = view.buildHlPanel || view._buildHlPanel;
  if (typeof fn === "function") fn.call(view);
}
function erOpenHlPanel(view) {
  const fn = view.togglePanel || view._togglePanel;
  if (view.panelOpen !== "highlights" && typeof fn === "function") fn.call(view, "highlights");
}
// Everything that does not fit one comfortable row.
//
// Thirteen round buttons wrapped on a phone and left the last one alone on a
// second line. Only the three actions a reader reaches for mid-page stay in the
// bar; the rest move into a menu, where they finally have names instead of being
// nine icons to decode. The menu is Obsidian's own, so it looks and behaves like
// every other menu on the device — a list on the desktop, a sheet on a phone.
function addBarButtons(view, pop) {
  if (erIsMobile()) return;
  for (const c of HL_COLORS) {
    const sw = pop.createDiv("er-hl-sw");
    sw.style.background = c.css;
    sw.setAttribute("aria-label", c.name);
    sw.addEventListener("click", () => view._applyPopupColor(c.id));
  }
  const act = (cls, icon2, label, fn) => {
    const b = pop.createDiv("er-hl-sw " + cls);
    svgIcon(b, icon2);
    b.setAttribute("aria-label", label);
    b.addEventListener("click", fn);
    return b;
  };
  act("er-hl-copy", "copy", __ertr("Copy text"), async () => {
    const cur = view._currentHl();
    view._hideHlPopup();
    selOf(view.areaEl)?.removeAllRanges();
    if (!cur) return;
    const ok = await copyToClipboard(cur.text);
    new Notice(ok ? __ertr("Copied ✓") : __ertr("Could not copy"));
  });
  act("er-hl-note", "note", __ertr("Create note"), () => {
    const cur = view._currentHl();
    view._hideHlPopup();
    selOf(view.areaEl)?.removeAllRanges();
    if (!cur) return;
    createNoteFromSelection(view.app, view.plugin, cur.text, view.file, { extra: hlCommentMd(cur), color: cur.color, hl: cur });
  });
  if (view.plugin.settings.dictionaryEnabled !== false) {
    act("er-hl-dict", "book-open", __ertr("Dictionary & Definition"), () => {
      const cur = view._currentHl();
      view._hideHlPopup();
      selOf(view.areaEl)?.removeAllRanges();
      if (!cur) return;
      new DictionaryModal(view.app, view.plugin, cur.text, view.file).open();
    });
  }
  addAiBtn(view, pop);
}
function addMoreBtn(view, pop) {
  const btn = pop.createDiv("er-hl-sw er-hl-menu");
  svgIcon(btn, "more");
  btn.setAttribute("aria-label", __ertr("More"));
  btn.addEventListener("click", (e) => {
    // Read before hiding: hiding the bar is what forgets which passage this was.
    const cur = view._currentHl();
    const editId = view._editHlId;
    const pending = view._pendingSel;
    view._hideHlPopup();
    selOf(view.areaEl)?.removeAllRanges();
    if (!cur) return;
    const menu = new Menu();
    menu.addItem((it) => it.setTitle(__ertr("Copy text")).setIcon("copy").onClick(async () => {
      const ok = await copyToClipboard(cur.text);
      new Notice(ok ? __ertr("Copied ✓") : __ertr("Could not copy"));
    }));
    menu.addItem((it) => it.setTitle(__ertr("Create note")).setIcon("file-plus").onClick(() => {
      createNoteFromSelection(view.app, view.plugin, cur.text, view.file, { extra: hlCommentMd(cur), color: cur.color, hl: cur });
    }));
    if (bookNoteLinkFor(view.plugin, view.file)) {
      menu.addItem((it) => it.setTitle(__ertr("As text into the book note")).setIcon("text-quote").onClick(() => {
        sendQuoteToBookNote(view, cur);
      }));
    }
    if (view.plugin.settings.aiEnabled) {
      menu.addItem((it) => it.setTitle(__ertr("Break this passage down")).setIcon("sparkles").onClick(() => {
        new AiExplainModal(view.app, view.plugin, cur.text, view.file).open();
      }));
    }
    menu.addSeparator();
    for (const c of HL_COLORS) {
      menu.addItem((it) => it.setTitle(__ertr("Highlight: {0}", (c.name))).setIcon("highlighter").onClick(() => {
        view._pendingSel = pending;
        view._editHlId = editId;
        view._applyPopupColor(c.id);
      }));
    }
    menu.addSeparator();
    menu.addItem((it) => it.setTitle(__ertr("Copy as a quote")).setIcon("text-quote").onClick(async () => {
      const md = quoteMarkdown(view.plugin, cur, view.file);
      const ok = md && await copyToClipboard(md);
      new Notice(ok ? __ertr("Quote copied ✓ — paste it into any note") : __ertr("Could not copy"));
    }));
    menu.addItem((it) => it.setTitle(__ertr("Stopped here")).setIcon("bookmark").onClick(() => {
      if (!view.file) return;
      const pct = view.plugin.saveNow(view.file.path, view.pager.spread, view.pager.total, cur.block);
      new Notice(__ertr("\"Stopped here\" bookmark — {0}%", (pct)));
      if (view.panelOpen === "settings" && typeof view._renderHistory === "function") view._renderHistory();
    }));
    // A thought in the margin. Distinct from "create a note": this stays WITH the
    // highlight instead of becoming a separate file.
    menu.addItem((it) => it.setTitle(__ertr("Comment on a highlight")).setIcon("message-square").onClick(() => {
      if (!view.file) return;
      let id = editId;
      const existing = id ? view.plugin.getHighlights(view.file.path).find((h) => h.id === id) : null;
      new HighlightCommentModal(view.app, (existing && existing.comment) || "", async (text) => {
        if (text === null) return;
        // Commenting on a plain selection turns it INTO a highlight first: a
        // comment has to hang on something.
        if (!id && pending) id = view._createHighlight(pending, view.plugin.settings.defaultHlColor || HL_COLORS[0].id);
        if (!id) { new Notice(__ertr("Could not save the comment")); return; }
        await view.plugin.setHighlightComment(view.file.path, id, cur, text);
        view._renderFlowHighlights();
        erRefreshHlPanel(view);
        erOpenHlPanel(view);
      }).open();
    }));
    if (view.plugin.settings.dictionaryEnabled !== false) {
      menu.addItem((it) => it.setTitle(__ertr("Dictionary & Definition")).setIcon("book-open").onClick(() => {
        new DictionaryModal(view.app, view.plugin, cur.text, view.file).open();
      }));
    }
    if (view.plugin.settings.translateEnabled) {
      menu.addItem((it) => it.setTitle(__ertr("Translate")).setIcon("languages").onClick(() => {
        new TranslateModal(view.app, view.plugin, cur.text, view.file).open();
      }));
    }
    menu.addItem((it) => it.setTitle(__ertr("Export to the book note")).setIcon("download").onClick(() => {
      if (view.file) sendQuoteToBookNote(view, cur);
    }));
    // Only for a highlight that already exists — there is nothing to delete
    // about a selection the reader has not coloured yet.
    if (editId) {
      menu.addSeparator();
      menu.addItem((it) => it.setTitle(__ertr("Remove highlight")).setIcon("trash-2").setWarning(true).onClick(() => {
        if (!view.file) return;
        view.plugin.removeHighlight(view.file.path, editId);
        view._unwrapHighlight(editId);
        if (view.panelOpen === "highlights") erRefreshHlPanel(view);
      }));
    }
    menu.showAtMouseEvent(e);
  });
}
// The breakdown itself: the passage on top, the answer under it, and the two
// things a reader wants to do with it — copy it, or keep it under the quote.
const AiExplainModal = class extends Modal {
  constructor(app, plugin, text, bookFile) {
    super(app);
    this.plugin = plugin;
    this.text = text;
    this.bookFile = bookFile;
    this.book = bookFile ? bookNoteLinkFor(plugin, bookFile) || bookFile.basename : "";
    // What has been said so far, in the shape the service wants it. Nothing is
    // sent until the reader says something: the passage alone is not a question.
    this.turns = [];
  }
  async onOpen() {
    const c = this.contentEl;
    c.empty();
    this.modalEl.addClass("er-ai-modal");
    // A chat is a column: a head that stays, a log that grows and scrolls, and
    // a composer pinned under it. On a phone the three used to be four stacked
    // rows of buttons with the conversation squeezed into the gap between them.
    const head = c.createDiv("er-ai-head");
    head.createDiv({ cls: "er-ai-title", text: __ertr("Talking about the passage") });
    if (this.book) head.createDiv({ cls: "er-ai-book", text: this.book });
    // The passage is context, not the subject: two lines, and it opens on a tap
    // for the times the reader wants to check the wording.
    const quote = c.createDiv({ cls: "er-ai-quote", text: this.text });
    quote.addEventListener("click", () => quote.classList.toggle("er-ai-quote-open"));
    this.log = c.createDiv("er-ai-log");
    this._buildEmpty();
    const bar = c.createDiv("er-ai-bar");
    const input = bar.createEl("input", { cls: "er-ai-input", type: "text" });
    input.placeholder = __ertr("Message…");
    const send = bar.createEl("button", { cls: "er-ai-send" });
    svgIcon(send, "send");
    send.setAttribute("aria-label", __ertr("Send"));
    const fire = async () => {
      const q = input.value.trim();
      if (!q) return;
      input.blur();
      input.value = "";
      if (!await this._send(q)) input.value = q;
    };
    send.addEventListener("click", fire);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); fire(); }
    });
    erAutoFocus(input);
    erBlurOnTapOutside(c, input);
    this._watchKeyboard();
  }
  _watchKeyboard() {
    const modal = this.modalEl;
    const height = (e) => {
      const h = e && (e.keyboardHeight != null ? e.keyboardHeight
        : e.detail && e.detail.keyboardHeight);
      return typeof h === "number" && h > 0 ? h : 0;
    };
    this._kbShow = (e) => {
      const h = height(e);
      if (!h) return;
      modal.style.setProperty("--er-kb", h + "px");
      modal.addClass("er-kb-up");
      window.setTimeout(() => this._scroll(), 60);
    };
    this._kbHide = () => {
      modal.removeClass("er-kb-up");
      modal.style.removeProperty("--er-kb");
    };
    window.addEventListener("keyboardWillShow", this._kbShow);
    window.addEventListener("keyboardDidShow", this._kbShow);
    window.addEventListener("keyboardWillHide", this._kbHide);
  }
  // An empty chat should say what it is for and offer the one thing most
  // readers want first, instead of showing a bare input and a lone chip.
  _buildEmpty() {
    const empty = this.log.createDiv("er-ai-empty");
    svgIcon(empty.createDiv("er-ai-empty-icon"), "sparkles");
    empty.createDiv({ cls: "er-ai-empty-title", text: __ertr("What would you like to ask?") });
    empty.createDiv({
      cls: "er-ai-empty-sub",
      text: __ertr("Ask anything about this passage — or start with a breakdown."),
    });
    const chip = empty.createEl("button", { cls: "er-ai-chip", text: __ertr("Break this passage down") });
    chip.addEventListener("click", () => this._send(chip.textContent));
    this.empty = empty;
  }
  _scroll() { this.log.scrollTop = this.log.scrollHeight; }
  // Copy / keep, hung under the answer they belong to. A single pair of buttons
  // at the bottom of the window could only ever act on the last answer, and it
  // cost a whole row of a phone screen to say so.
  _actions(group, answer) {
    const row = group.createDiv("er-ai-acts");
    const act = (icon2, label, fn) => {
      const b = row.createEl("button", { cls: "er-ai-act" });
      svgIcon(b, icon2);
      b.createSpan({ text: label });
      b.addEventListener("click", fn);
      return b;
    };
    act("copy", __ertr("Copy"), async () => {
      const ok = await copyToClipboard(answer);
      new Notice(ok ? __ertr("Copied ✓") : __ertr("Could not copy"));
    });
    act("note", __ertr("To a note"), async () => {
      await createNoteFromSelection(this.app, this.plugin, this.text, this.bookFile, {
        extra: "\n\n" + answer,
        // The note is written mid-reading: it gets its own tab, but the book
        // stays in front — the reader goes to the note when they want to.
        openMode: "tab",
        openBackground: true,
      });
      this.close();
    });
  }
  // Sends one message and hangs the answer under it. Returns whether it went
  // through, so the input knows whether to clear itself.
  async _send(text) {
    if (this.busy || !text) return false;
    this.busy = true;
    if (this.empty) { this.empty.remove(); this.empty = null; }
    const me = this.log.createDiv("er-ai-msg er-ai-msg-me");
    me.setText(text);
    this.turns.push({ role: "user", content: text });
    const group = this.log.createDiv("er-ai-group");
    const bubble = group.createDiv("er-ai-msg er-ai-msg-ai");
    // Waiting looks like waiting: three dots that actually move, the same
    // indicator Kindle Reader AI uses. A still line of text reads as a frozen window.
    const ind = bubble.createDiv("er-ai-typing");
    const dots = ind.createDiv("er-ai-typing-dots");
    for (let i = 0; i < 3; i++) dots.createDiv("er-ai-typing-dot");
    ind.createDiv({ cls: "er-ai-typing-text", text: __ertr("Thinking…") });
    this._scroll();
    let answer = "";
    try {
      answer = await aiExplain(this.text, this.plugin.settings, this.turns, this.book);
    } catch (e) {
      console.error("Book Reader: AI chat failed", e);
      // The unanswered message leaves the thread: keeping it would send the same
      // question twice as soon as the next one is asked.
      this.turns.pop();
      const why = e && e.erReason;
      bubble.addClass("er-ai-msg-err");
      bubble.setText(
        why === "nokey" ? __ertr("No key set. Open the plugin settings → AI breakdown and paste the key for your service.")
          : why === "auth" ? __ertr("The service rejected the key. Check it in the plugin settings.")
            : why === "limit" ? __ertr("The service is rate-limiting. Wait a minute and try again.")
              : why === "local" ? __ertr("The local model is not answering. Check that Ollama or LM Studio is running.")
                : why === "empty" ? __ertr("The model returned nothing.")
                  : why === "http" ? __ertr("The service answered with error {0}.", e.erStatus)
                    : __ertr("Could not reach the service. It looks like there is no internet connection."));
      this._scroll();
      this.busy = false;
      return false;
    }
    this.turns.push({ role: "assistant", content: answer });
    this.answer = answer;
    bubble.empty();
    // Rendered as Markdown so the sections and lists read as sections and lists.
    await MarkdownRenderer.render(this.app, answer, bubble, this.bookFile ? this.bookFile.path : "", this);
    this._actions(group, answer);
    this._scroll();
    this.busy = false;
    return true;
  }
  onClose() {
    if (this._kbShow) {
      window.removeEventListener("keyboardWillShow", this._kbShow);
      window.removeEventListener("keyboardDidShow", this._kbShow);
    }
    if (this._kbHide) window.removeEventListener("keyboardWillHide", this._kbHide);
    this.contentEl.empty();
  }
};
function searchBookBlocks(blocks, query, limit = 300) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];
  let out = [];
  for (let i = 0; i < blocks.length && out.length < limit; i++) {
    const text = blocks[i];
    const hay = text.toLowerCase();
    let from = 0;
    while (out.length < limit) {
      const at = hay.indexOf(q, from);
      if (at < 0) break;
      const s = Math.max(0, at - 45), e = Math.min(text.length, at + q.length + 55);
      let pre = text.slice(s, at), post = text.slice(at + q.length, e);
      if (s > 0) pre = pre.replace(/^\S*\s/, "");
      if (e < text.length) post = post.replace(/\s\S*$/, "");
      out.push({
        block: i,
        pre: (s > 0 ? "…" : "") + pre,
        hit: text.slice(at, at + q.length),
        post: post + (e < text.length ? "…" : "")
      });
      from = at + q.length;
    }
  }
  return out;
}
function markFoundIn(view, query) {
  clearFoundIn(view);
  const flow = view.pager && view.pager.flow;
  const q = String(query || "").trim().toLowerCase();
  if (!flow || q.length < 2) return;
  if (typeof CSS === "undefined" || !CSS.highlights || typeof Highlight === "undefined") return;
  view._foundQuery = q;
  const ranges = [];
  const CAP = 2e3;
  try {
    const walker = docOf(flow).createTreeWalker(flow, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) && ranges.length < CAP) {
      const text = node.nodeValue || "";
      const hay = text.toLowerCase();
      let from = 0;
      while (ranges.length < CAP) {
        const at = hay.indexOf(q, from);
        if (at < 0) break;
        const r = docOf(flow).createRange();
        r.setStart(node, at);
        r.setEnd(node, at + q.length);
        ranges.push(r);
        from = at + q.length;
      }
    }
    if (ranges.length) CSS.highlights.set("er-found", new Highlight(...ranges));
    window.clearTimeout(view._foundTimer);
    view._foundTimer = window.setTimeout(() => clearFoundIn(view), FOUND_PAINT_MS);
  } catch { /* optional step; a failure here must not interrupt reading */ }
}
function clearFoundIn(view) {
  window.clearTimeout(view._foundTimer);
  view._foundQuery = "";
  try {
    if (typeof CSS !== "undefined" && CSS.highlights) CSS.highlights.delete("er-found");
  } catch { /* optional step; a failure here must not interrupt reading */ }
}
function buildFindPanelFor(view, p, { close, jump }) {
  p.empty();
  p.createDiv("er-pan-title").setText(__ertr("Search the book"));
  const box = p.createDiv("er-toc-find");
  const inp = box.createEl("input", { type: "text" });
  inp.addClass("er-toc-find-input");
  inp.placeholder = __ertr("What to find in the book…");
  const info = p.createDiv("er-find-info");
  const off = p.createDiv("er-find-off");
  off.setText(__ertr("Clear highlight"));
  const list = p.createDiv("er-toc-list");
  off.addEventListener("click", () => {
    inp.value = "";
    clearFoundIn(view);
    list.empty();
    info.setText("");
  });
  view._findInput = inp;
  const run = () => {
    const q = inp.value;
    list.empty();
    if (q.trim().length < 2) {
      info.setText(__ertr("Type at least two characters"));
      clearFoundIn(view);
      return;
    }
    if (!view._findCorpus) view._findCorpus = blockTexts(view.pager && view.pager.flow);
    const hits = searchBookBlocks(view._findCorpus, q);
    if (!hits.length) {
      info.setText(__ertr("Nothing found"));
      clearFoundIn(view);
      return;
    }
    info.setText(__ertr("Found: {0}. The word is highlighted in the text.", hits.length));
    markFoundIn(view, q);
    for (const h of hits) {
      const el = list.createDiv("er-toc-item er-find-item");
      const line = el.createDiv("er-find-text");
      line.createSpan({ text: h.pre });
      line.createSpan({ cls: "er-find-hit", text: h.hit });
      line.createSpan({ text: h.post });
      const spread = view.pager && view.pager.spreadForBlock ? view.pager.spreadForBlock(h.block) : null;
      if (typeof spread === "number") el.createDiv("er-toc-where").setText(__ertr("spr. {0}", spread + 1));
      el.addEventListener("click", () => {
        close();
        jump(h.block);
        markFoundIn(view, q);
      });
    }
  };
  let timer = null;
  inp.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 180);
  });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      window.clearTimeout(timer);
      run();
    }
  });
}
function buildTocPanelFor(view, p, { close, jump }) {
  p.empty();
  const titleRow = p.createDiv("er-pan-title er-pan-title-row");
  titleRow.createSpan({ text: __ertr("Contents") });
  const closeBtn = titleRow.createDiv("er-pan-close");
  closeBtn.setText("✕");
  closeBtn.setAttribute("aria-label", __ertr("Close"));
  closeBtn.addEventListener("click", () => close());
  const items = view.tocItems || [];
  if (!items.length) {
    p.createDiv("er-toc-empty").setText(__ertr("No contents and no headings were found in this book."));
    return null;
  }
  let filter = "";
  if (items.length > 12) {
    const box = p.createDiv("er-toc-find");
    const inp = box.createEl("input", { type: "text" });
    inp.addClass("er-toc-find-input");
    inp.placeholder = __ertr("Filter by title…");
    inp.addEventListener("input", () => {
      filter = inp.value.trim().toLowerCase();
      render();
    });
  }
  const list = p.createDiv("er-toc-list");
  const render = () => {
    list.empty();
    const cur = view.pager ? view.pager.spread : 0;
    let shown = 0;
    for (const item of items) {
      if (filter && !item.label.toLowerCase().includes(filter)) continue;
      shown++;
      const el = list.createDiv("er-toc-item");
      const row = el.createDiv("er-toc-row");
      row.createSpan({ cls: "er-toc-label", text: item.label });
      const spread = view.pager && view.pager.spreadForBlock ? view.pager.spreadForBlock(item.block) : null;
      const bits = [];
      if (item.page) bits.push(__ertr("p. {0}", item.page));
      if (typeof spread === "number") bits.push(__ertr("spr. {0}", spread + 1));
      if (bits.length) row.createSpan({ cls: "er-toc-where", text: bits.join(" \xB7 ") });
      if (item.level) el.style.paddingLeft = `${8 + item.level * 12}px`;
      if (typeof spread === "number" && spread === cur) el.addClass("active");
      el.addEventListener("click", () => {
        close();
        jump(item.block);
      });
    }
    if (!shown) list.createDiv("er-toc-empty").setText(__ertr("Nothing found"));
  };
  render();
  return render;
}
function chapterForBlock(toc, block) {
  if (!toc || !toc.length || typeof block !== "number") return "";
  let best = "";
  for (const it of toc) {
    if (it.block <= block) best = it.label;
    else break;
  }
  return best;
}
function pageForBlock(flow, block) {
  try {
    const blocks = flow ? flow.querySelectorAll("p,h1,h2,h3,h4") : null;
    const el = blocks && blocks[block];
    const holder = el && el.closest ? el.closest("[data-pdf-page-no]") : null;
    const p = holder ? parseInt(holder.getAttribute("data-pdf-page-no"), 10) : NaN;
    return isNaN(p) ? null : p;
  } catch {
    return null;
  }
}
function enrichHighlights(view, list) {
  const flow = view && view.pager ? view.pager.flow : null;
  const toc = view && view.tocItems || [];
  return (list || []).map((hl) => {
    if (typeof hl.block !== "number") return hl;
    return {
      ...hl,
      chapter: hl.chapter || chapterForBlock(toc, hl.block),
      page: hl.page || pageForBlock(flow, hl.block)
    };
  });
}
function currentBookPage(view) {
  try {
    const flow = view && view.pager ? view.pager.flow : null;
    if (!flow) return null;
    const block = view.pager.currentBlockIndex();
    if (typeof block !== "number" || block < 0) return null;
    return pageForBlock(flow, block);
  } catch {
    return null;
  }
}
function sendQuoteToBookNote(view, hl) {
  if (!hl || !hl.text) return;
  const [full] = enrichHighlights(view, [hl]);
  exportHighlightsToBookNote(view.app, view.plugin, view.file, [full]);
}
function blockTexts(flow) {
  if (!flow) return [];
  return [...flow.querySelectorAll("p,h1,h2,h3,h4")].map((el) => (el.textContent || "").replace(/\s+/g, " ").trim());
}
function tocLooksLikeNoise(items, all) {
  if (!items || items.length < 30) return false;
  const pages = /* @__PURE__ */ new Set();
  for (const el of all) {
    const h = el.closest ? el.closest("[data-pdf-page-no]") : null;
    if (h) pages.add(h.getAttribute("data-pdf-page-no"));
  }
  const limit = pages.size ? Math.max(30, pages.size * 0.6) : Math.max(30, all.length / 12);
  return items.length > limit;
}
function buildTocItems(html, outline, epubToc) {
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const all = [...doc.body.querySelectorAll("p,h1,h2,h3,h4")];
    const pageOfBlock = (i) => {
      const el = all[i];
      const holder = el && el.closest ? el.closest("[data-pdf-page-no]") : null;
      const p = holder ? parseInt(holder.getAttribute("data-pdf-page-no"), 10) : NaN;
      return isNaN(p) ? null : p;
    };
    const withPages = (items2) => items2.map((it) => ({ ...it, page: pageOfBlock(it.block) }));
    if (epubToc && epubToc.length) {
      // The book's own contents: each entry points at an anchor marker that
      // extractEpub left inside the block where that chapter/section starts.
      const blockOfKey = /* @__PURE__ */ new Map();
      doc.body.querySelectorAll("[data-er-id]").forEach((m) => {
        const key = m.getAttribute("data-er-id");
        if (blockOfKey.has(key)) return;
        const owner = m.closest("p,h1,h2,h3,h4");
        const idx = owner ? all.indexOf(owner) : -1;
        if (idx >= 0) blockOfKey.set(key, idx);
      });
      const items3 = [];
      for (const t of epubToc) {
        let block = blockOfKey.get(t.key);
        if (block === void 0) block = blockOfKey.get(t.key.split("#")[0] + "#");
        if (block === void 0) continue;
        items3.push({ label: String(t.label).slice(0, 60), block, level: t.level || 0 });
      }
      if (items3.length) return withPages(items3);
    }
    if (outline && outline.length) {
      const firstBlockOf = /* @__PURE__ */ new Map();
      all.forEach((el, i) => {
        const holder = el.closest ? el.closest("[data-pdf-page-no]") : null;
        const p = holder ? parseInt(holder.getAttribute("data-pdf-page-no"), 10) : NaN;
        if (!isNaN(p) && !firstBlockOf.has(p)) firstBlockOf.set(p, i);
      });
      const pages = [...firstBlockOf.keys()].sort((a, b) => a - b);
      const items2 = [];
      for (const o of outline) {
        let block = firstBlockOf.get(o.page);
        if (block === void 0) {
          const nxt = pages.find((p) => p >= o.page);
          if (nxt === void 0) continue;
          block = firstBlockOf.get(nxt);
        }
        items2.push({ label: String(o.label).slice(0, 60), block, level: o.level || 0 });
      }
      if (items2.length) return withPages(items2);
    }
    const items = [];
    all.forEach((el, i) => {
      if (/^H[1-3]$/.test(el.tagName)) {
        const label = (el.textContent || "").trim().slice(0, 60);
        if (label) items.push({ label, block: i, level: 0 });
      }
    });
    if (items.length && !tocLooksLikeNoise(items, all)) return withPages(items);
    const printed = tocFromPrintedContents(all);
    if (printed.length && !tocLooksLikeNoise(printed, all)) return withPages(printed);
    const bold = tocFromBoldParagraphs(all);
    return tocLooksLikeNoise(bold, all) ? [] : withPages(bold);
  } catch {
    return [];
  }
}
function tocNorm(s) {
  return String(s || "").toLowerCase().replace(/[«»"'`.,:;!?()[\]—–-]/g, " ").replace(/\s+/g, " ").trim();
}
function tocFromPrintedContents(all) {
  const lines = [];
  all.forEach((el, i) => {
    if (el.classList && el.classList.contains("er-toc-line")) {
      const t = el.querySelector ? el.querySelector(".er-toc-t") : null;
      const label = ((t ? t.textContent : el.textContent) || "").trim();
      if (label) lines.push({ label, at: i });
    }
  });
  if (!lines.length) return [];
  const lastContents = lines[lines.length - 1].at;
  const body = [];
  all.forEach((el, i) => {
    if (i <= lastContents) return;
    if (el.classList && el.classList.contains("er-toc-line")) return;
    const txt = tocNorm(el.textContent);
    if (txt) body.push({ i, txt });
  });
  const items = [];
  let from = 0;
  for (const ln of lines) {
    const want = tocNorm(ln.label);
    if (!want) continue;
    let hit = -1;
    for (let k = from; k < body.length; k++) {
      const txt = body[k].txt;
      if (txt === want || txt.startsWith(want + " ") || want.length >= 12 && txt.startsWith(want)) {
        hit = k;
        break;
      }
    }
    if (hit < 0) continue;
    items.push({ label: ln.label.slice(0, 60), block: body[hit].i, level: 0 });
    from = hit + 1;
  }
  return items.length >= 3 ? items : [];
}
function tocFromBoldParagraphs(all) {
  const items = [];
  all.forEach((el, i) => {
    if (el.tagName !== "P") return;
    if (el.classList && el.classList.contains("er-toc-line")) return;
    const text = (el.textContent || "").trim();
    if (!text || text.length > 80 || text.length < 3) return;
    if (/[.!?;:]$/.test(text)) return;
    const kids = [...el.children || []];
    const bold = kids.length === 1 && /^(B|STRONG)$/.test(kids[0].tagName) && (kids[0].textContent || "").trim() === text;
    if (!bold) return;
    if (!/\s/.test(text) && text.length < 12) return;
    if (/^[\dIVXLC\u041c.,\s—–-]+$/i.test(text)) return;
    items.push({ label: text.slice(0, 60), block: i, level: 0 });
  });
  const seen = /* @__PURE__ */ new Map();
  for (const it of items) seen.set(it.label, (seen.get(it.label) || 0) + 1);
  const unique = items.filter((it) => seen.get(it.label) <= 2);
  const pages = Math.max(1, all.length / 12);
  if (unique.length > pages) return [];
  return unique.length >= 3 ? unique : [];
}
async function renderVisibleFigures(view) {
  const lazy = view._pdfLazy;
  if (!lazy || !view.pager || !view.pager.flow) return;
  bindPdfNoteButtons(view);
  if (view._figBusy) {
    view._figPending = true;
    return;
  }
  view._figBusy = true;
  try {
    const flow = view.pager.flow;
    const sw = view.pager.sw || 1;
    const cur = view.pager.spread;
    const fRect = flow.getBoundingClientRect();
    const scrolling = view.pager.scrollMode;
    const distOf = (img) => {
      const r = img.getBoundingClientRect();
      const at = scrolling ? r.top - fRect.top : r.left - fRect.left;
      return Math.abs(Math.floor(at / sw + 0.01) - cur);
    };
    const imgs = [...flow.querySelectorAll("img.er-pdf-lazy")];
    for (const img of imgs) {
      const dist = distOf(img);
      const loaded = img.dataset.loaded === "1";
      const gaveUp = img.dataset.loaded === "skip";
      if (dist <= 2 && !loaded && !gaveUp) {
        const ri = img.dataset.pdfRect;
        try {
          img.src = await lazy.render(parseInt(img.dataset.pdfPage), ri == null ? null : parseInt(ri));
          img.dataset.loaded = "1";
        } catch (e) {
          if (String(e && e.message) === "er-render-too-heavy") {
            img.dataset.loaded = "skip";
            img.addClass("er-pdf-heavy");
            img.alt = __ertr("This page is too heavy to draw");
          }
        }
      } else if (dist > 6 && loaded) {
        img.removeAttribute("src");
        img.dataset.loaded = "0";
      }
    }
  } finally {
    view._figBusy = false;
    if (view._figPending) {
      view._figPending = false;
      renderVisibleFigures(view);
    }
  }
}
function offsetInBlock(block, container, offset) {
  try {
    const r = docOf(block).createRange();
    r.setStart(block, 0);
    r.setEnd(container, offset);
    return r.toString().length;
  } catch {
    return 0;
  }
}
function nthIndexOf(text, sub, occ) {
  let idx = -1;
  for (let i = 0; i <= occ; i++) {
    idx = text.indexOf(sub, idx + 1);
    if (idx < 0) return -1;
  }
  return idx;
}
function countOccurrencesBefore(text, sub, limit) {
  if (!sub) return 0;
  let n = 0, idx = -1;
  while ((idx = text.indexOf(sub, idx + 1)) >= 0 && idx < limit) n++;
  return n;
}
function _hlNormMap(s) {
  s = s || "";
  let norm = "";
  const map = [];
  let prevSpace = false;
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    if (c === "\xA0" || c === " " || /\s/.test(c)) {
      if (prevSpace) continue;
      norm += " ";
      map.push(i);
      prevSpace = true;
      continue;
    }
    prevSpace = false;
    if (c === "‘" || c === "’" || c === "‚" || c === "‛") c = "'";
    else if (c === "“" || c === "”" || c === "„" || c === "‟") c = '"';
    else if (c === "–" || c === "—" || c === "−") c = "-";
    norm += c;
    map.push(i);
  }
  return { norm, map };
}
function locateHl(blockText, hl) {
  if (!hl || !hl.text) return null;
  const occ = typeof hl.occ === "number" ? hl.occ : 0;
  let start = nthIndexOf(blockText, hl.text, occ);
  if (start >= 0) return { start, len: hl.text.length };
  if (hl.pre != null || hl.post != null) {
    let from = 0, idx;
    while ((idx = blockText.indexOf(hl.text, from)) >= 0) {
      const preOk = !hl.pre || blockText.slice(Math.max(0, idx - hl.pre.length), idx).endsWith(hl.pre);
      const endPos = idx + hl.text.length;
      const postOk = !hl.post || blockText.slice(endPos, endPos + hl.post.length).startsWith(hl.post);
      if (preOk && postOk) return { start: idx, len: hl.text.length };
      from = idx + 1;
    }
  }
  const { norm: nBlock, map } = _hlNormMap(blockText);
  const nText = _hlNormMap(hl.text).norm.trim();
  if (nText) {
    let nIdx = -1;
    const nPre = hl.pre ? _hlNormMap(hl.pre).norm.trim() : "";
    if (nPre) {
      const p = nBlock.indexOf(nPre);
      if (p >= 0) nIdx = nBlock.indexOf(nText, Math.max(0, p + nPre.length - 1));
    }
    if (nIdx < 0) nIdx = nBlock.indexOf(nText);
    if (nIdx >= 0 && nIdx < map.length) {
      const lastN = Math.min(nIdx + nText.length - 1, map.length - 1);
      const startRaw = map[nIdx];
      const endRaw = map[lastN] + 1;
      if (endRaw > startRaw) return { start: startRaw, len: endRaw - startRaw };
    }
  }
  return null;
}
//
function unwrapAllHighlights(flow) {
  if (!flow) return;
  flow.querySelectorAll("[data-hl-id]").forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
    parent.normalize();
  });
}
function wrapBlockRange(block, start, end, hl) {
  if (end <= start) return;
  const walker = docOf(block).createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
  let node, pos = 0;
  const targets = [];
  while ((node = walker.nextNode())) {
    const len = node.textContent.length;
    const nodeStart = pos, nodeEnd = pos + len;
    pos = nodeEnd;
    if (nodeEnd <= start || nodeStart >= end) continue;
    targets.push({ node, s: Math.max(0, start - nodeStart), e: Math.min(len, end - nodeStart) });
  }
  for (const t of targets) {
    let n = t.node;
    if (t.e < n.textContent.length) n.splitText(t.e);
    if (t.s > 0) n = n.splitText(t.s);
    const span = docOf(block).win.createSpan();
    span.className = "er-hl";
    span.style.background = hl.color;
    span.setAttribute("data-hl-id", hl.id);
    n.parentNode.insertBefore(span, n);
    span.appendChild(n);
  }
}
async function appendLinkToBookNote(app, plugin, bookFile, newFile) {
  try {
    const name = bookNoteLinkFor(plugin, bookFile);
    if (!name) return;
    const noteFile = resolveBookNote(app, name);
    if (!noteFile || noteFile.path === newFile.path) return;
    const heading = __ertr("## Notes from highlights");
    const link = `- [[${newFile.basename}]]`;
    const add = (data) => {
      const base = data.replace(/\s*$/, "");
      return data.includes(heading) ? `${base}
${link}
` : `${base}

${heading}
${link}
`;
    };
    if (typeof app.vault.process === "function") await app.vault.process(noteFile, add);
    else await app.vault.modify(noteFile, add(await app.vault.read(noteFile)));
  } catch (e) {
    console.error("Kindle Reader: append to book note failed", e);
  }
}
function processTemplateManually(tplText, title) {
  let today;
  try {
    today = window.moment ? window.moment().format("YYYY-MM-DD") : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  } catch {
    today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
  return tplText.replace(/<%[-_]?\s*tp\.file\.title\s*[-_]?%>/g, title).replace(/<%[-_]?\s*tp\.date\.now\([^)]*\)\s*[-_]?%>/g, today).replace(/<%[-_]?\s*tp\.file\.cursor\([^)]*\)\s*[-_]?%>/g, "").replace(/<%[\s\S]*?%>/g, "");
}
async function createNoteFromSelection(app, plugin, selText, bookFile, opts = {}) {
  let _a, _b;
  const {
    open = true,
    silent = false,
    reserved = null,
    color = null,
    extra = "",
    openMode = null,
    openBackground = false
  } = opts;
  const clean = (selText || "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
  if (!clean) {
    if (!silent) new Notice(__ertr("Empty highlight"));
    return null;
  }
  let title = sanitizeNoteTitle(clean);
  let chosenFolder = null, chosenTags = [];
  if (!silent && plugin.settings.askNoteTitle !== false) {
    const chosen = await new Promise((resolve) => {
      new NoteTitleModal(app, plugin, clean, bookFile, resolve).open();
    });
    if (chosen === null) return null;
    if (chosen.toBookNote) {
      const base = opts.hl && typeof opts.hl === "object" ? opts.hl : {};
      await exportHighlightsToBookNote(app, plugin, bookFile, [{ ...base, text: clean, color: color != null ? color : base.color }]);
      return null;
    }
    title = sanitizeNoteTitle(chosen.title);
    chosenFolder = chosen.folder || null;
    chosenTags = chosen.tags || [];
  } else if (!silent && plugin.settings.shortNoteTitles) {
    title = sanitizeNoteTitle(suggestNoteTitle(clean));
  }
  if (!chosenFolder && plugin.settings.notesNextToBook && bookFile && bookFile.parent) {
    const beside = erPath(bookFile.parent.path || "");
    if (beside) chosenFolder = beside;
  }
  let filename = title, n = 2;
  const taken = (name) => app.vault.getAbstractFileByPath(inboxNotePath(app, name, chosenFolder)) || reserved && reserved.has(name);
  while (taken(filename)) filename = `${title} ${n++}`;
  if (reserved) reserved.add(filename);
  const linkName = bookFile ? bookNoteLinkFor(plugin, bookFile) || bookFile.basename : "";
  const tagLine = chosenTags.length ? chosenTags.map((t) => "#" + t).join(" ") + "\n\n" : "";

  let quote = "";
  if (plugin && plugin.settings && plugin.settings.exportCallouts !== false) {
    const calloutType = plugin.settings.exportCalloutType || "quote";
    const header = color ? `> [!${calloutType}|${color}]` : `> [!${calloutType}]`;
    const cleanLines = clean.split("\n").map((l: string) => `> ${l}`).join("\n");
    const srcLine = bookFile ? `\n>\n> — from [[${linkName}]]` : "";
    const extraLines = extra ? extra.split("\n").map((l: string) => l ? `> ${l}` : ">").join("\n") : "";
    quote = `${tagLine}${header}\n${cleanLines}${extraLines ? "\n" + extraLines : ""}${srcLine}`;
  } else {
    const src = bookFile ? __ertr("\n\n— from [[{0}]]", linkName) : "";
    const marked = color ? hlMark(app, clean.replace(/\n/g, "\n> "), color) : clean.replace(/\n/g, "\n> ");
    quote = `${tagLine}> ${marked}${extra}${src}`;
  }
  const cursorRe = /<%\s*tp\.file\.cursor\([^)]*\)\s*%>/;
  const cursorReAll = /<%\s*tp\.file\.cursor\([^)]*\)\s*%>/g;
  try {
    const tplPlugin = (_b = (_a = app.plugins) == null ? void 0 : _a.plugins) == null ? void 0 : _b["templater-obsidian"];
    const templater = tplPlugin == null ? void 0 : tplPlugin.templater;
    const _tplPath = noteTemplatePath(app, bookFile);
    const templateFile = _tplPath ? app.vault.getAbstractFileByPath(_tplPath) : null;
    let folder = await resolveNotesFolder(app, chosenFolder);
    let newFile = null;
    if (templater && templateFile && folder && typeof templater.create_new_note_from_template === "function") {
      newFile = await templater.create_new_note_from_template(templateFile, folder, filename, false);
      if (!newFile) newFile = app.vault.getAbstractFileByPath(inboxNotePath(app, filename, chosenFolder));
      if (newFile) {
        const transform = (data) => {
          let out = cursorRe.test(data) ? data.replace(cursorRe, `
${quote}
`) : `${data.replace(/\s*$/, "")}

${quote}
`;
          return out.replace(cursorReAll, "");
        };
        if (typeof app.vault.process === "function") await app.vault.process(newFile, transform);
        else await app.vault.modify(newFile, transform(await app.vault.read(newFile)));
      }
    } else {
      let body = "";
      if (templateFile) {
        try {
          body = processTemplateManually(await app.vault.read(templateFile), filename);
        } catch { /* optional step; a failure here must not interrupt reading */ }
      }
      newFile = await app.vault.create(inboxNotePath(app, filename, chosenFolder), `${body}

${quote}
`);
    }
    if (newFile) {
      if (!silent && bookFile) await appendLinkToBookNote(app, plugin, bookFile, newFile);
      if (open) await openNoteBesideBook(app, plugin, newFile, null, { mode: openMode, background: openBackground });
      if (!silent) new Notice(__ertr("Note created"));
    }
    return newFile;
  } catch (e) {
    console.error("Kindle Reader: note creation failed", e);
    if (!silent) new Notice(__ertr("Could not create the note"));
    return null;
  }
}
function _escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function hlMark(app, text, colorId) {
  const c = HL_COLORS.find((x) => x.id === colorId);
  if (!c || _readerSettings(app).exportColors === false) return text;
  return `<mark style="background:${c.css}">${_escHtml(text)}</mark>`;
}
async function openNoteBesideBook(app, plugin, file, line, opts = {}) {
  const mode = opts.mode || plugin && plugin.settings && plugin.settings.noteOpenMode || "split";
  if (mode === "none" || !file) return null;
  const back = opts.background === true;
  const prev = back ? app.workspace.getMostRecentLeaf() : null;
  const leaf = app.workspace.getLeaf(mode === "tab" ? "tab" : "split");
  await leaf.openFile(file, back ? { active: false } : void 0);
  if (back && prev) app.workspace.setActiveLeaf(prev, { focus: true });
  if (typeof line === "number" && line > 0) {
    try {
      const view = leaf.view;
      if (view && view.editor) view.editor.setCursor({ line, ch: 0 });
    } catch { /* optional step; a failure here must not interrupt reading */ }
  }
  return leaf;
}
function addBookFileMenu(app, menu, file) {
  if (!file) return menu;
  menu.addSeparator();
  menu.addItem((it) => it.setTitle(__ertr("Reveal in file explorer")).setIcon("folder-open").onClick(() => {
    const explorer = app.workspace.getLeavesOfType("file-explorer")[0];
    if (!explorer) return;
    app.workspace.revealLeaf(explorer);
    const tree = explorer.view;
    if (tree && typeof tree.revealInFolder === "function") tree.revealInFolder(file);
  }));
  app.workspace.trigger("file-menu", menu, file, "kindle-reader");
  return menu;
}
function deleteBookFromVault(app, plugin, file, after) {
  if (!file) return;
  new ConfirmModal(app, {
    title: __ertr("Delete book?"),
    body: __ertr("“{0}” will be removed from the vault along with its reading progress and highlights. The book note will remain.", file.basename),
    okText: __ertr("Delete"),
    cancelText: __ertr("Cancel"),
    onYes: async () => {
      try {
        await app.fileManager.trashFile(file);
        const path5 = file.path;
        if (plugin.progress) delete plugin.progress[path5];
        if (plugin.progressBackups) delete plugin.progressBackups[path5];
        if (plugin.highlights) delete plugin.highlights[path5];
        if (plugin.settings && plugin.settings.coverFits) delete plugin.settings.coverFits[path5];
        await plugin.saveAll();
        new Notice(__ertr("Book deleted: {0}", file.basename));
        if (typeof after === "function") after();
      } catch (e) {
        console.error("Kindle Reader: delete book failed", e);
        new Notice(__ertr("Could not delete the book"));
      }
    }
  }).open();
}
const QUOTE_TEMPLATE_DEFAULT = "> {text}\n\n— from [[{book}]]{page}{link}";
function backlinkLabel(plugin) {
  const own = String(plugin && plugin.settings && plugin.settings.quoteBacklinkLabel || "").trim();
  return own || __ertr("↪ to this spot in the book");
}
function quoteMarkdown(plugin, hl, bookFile) {
  const clean = String(hl && hl.text || "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
  if (!clean) return "";
  const bookName = bookFile ? bookNoteLinkFor(plugin, bookFile) || bookFile.basename : "";
  const page = hl && hl.page ? __ertr(", p. {0}", hl.page) : "";
  let link = "";
  if (plugin && plugin.settings && plugin.settings.quoteBacklinks !== false && bookFile && typeof hl.block === "number" && hl.block >= 0) {
    link = ` [${backlinkLabel(plugin)}](obsidian://kindle-reader?book=${encodeURIComponent(bookFile.path)}&block=${hl.block})`;
  }
  const comment = hl && hl.comment ? `
>
> — ${String(hl.comment).replace(/\n/g, "\n> ")}` : "";

  if (plugin && plugin.settings && plugin.settings.quoteTemplate) {
    return plugin.settings.quoteTemplate
      .split("{text}").join(clean + comment)
      .split("{book}").join(bookName)
      .split("{page}").join(page)
      .split("{link}").join(link)
      .split("{comment}").join(comment.replace(/^\n>\n> /, ""))
      .split("{color}").join(hl && hl.color ? `|${hl.color}` : "")
      .trim();
  }

  if (plugin && plugin.settings && plugin.settings.exportCallouts !== false) {
    const type = plugin.settings.exportCalloutType || "quote";
    const colorTag = hl && hl.color ? `|${hl.color}` : "";
    const cleanLines = clean.split("\n").map((l: string) => `> ${l}`).join("\n");
    const cmt = hl && hl.comment ? `\n>\n> **${__ertr("Comment")}:** ${String(hl.comment).replace(/\n/g, "\n> ")}` : "";
    const src = (bookName || page || link) ? `\n>\n> — from [[${bookName}]]${page}${link}` : "";
    return `> [!${type}${colorTag}]\n${cleanLines}${cmt}${src}`.trim();
  }

  const tpl = (plugin && plugin.settings && plugin.settings.quoteTemplate) || QUOTE_TEMPLATE_DEFAULT;
  return tpl.split("{text}").join(clean + comment).split("{book}").join(bookName).split("{page}").join(page).split("{link}").join(link).split("{comment}").join(comment.replace(/^\n>\n> /, "")).trim();
}
function hlCommentMd(hl) {
  const c = hl && hl.comment ? String(hl.comment).trim() : "";
  return c ? "\n>\n> — " + c.replace(/\n/g, "\n> ") : "";
}
async function exportHighlightsSeparate(app, plugin, bookFile, highlights) {
  if (!highlights || !highlights.length) {
    new Notice(__ertr("No highlights to export"));
    return;
  }
  new Notice(__ertr("Creating notes: {0}…", highlights.length));
  const reserved = /* @__PURE__ */ new Set();
  let ok = 0, fail = 0;
  for (const hl of highlights) {
    const f = await createNoteFromSelection(app, plugin, hl.text, bookFile, { open: false, silent: true, reserved, extra: hlCommentMd(hl), color: hl.color });
    if (f) ok++;
    else fail++;
  }
  new Notice(fail ? __ertr("Notes created: {0}, errors: {1}", ok, fail) : __ertr("Notes created: {0}", ok));
}
async function openNoteInTab(app, file, line) {
  const leaf = app.workspace.getLeaf("tab");
  if (!leaf) return;
  const eState = typeof line === "number" ? { line, cursor: { from: { line, ch: 0 }, to: { line, ch: 0 } }, focus: true } : void 0;
  await leaf.openFile(file, eState ? { eState } : void 0);
}
async function exportHighlightsToBookNote(app, plugin, bookFile, highlights) {
  if (!highlights || !highlights.length) {
    new Notice(__ertr("No highlights to export"));
    return;
  }
  const name = bookFile ? bookNoteLinkFor(plugin, bookFile) : "";
  if (!name) {
    new Notice(__ertr("No note is linked to this book — set it in settings"));
    return;
  }
  const noteFile = resolveBookNote(app, name);
  if (!noteFile) {
    new Notice(__ertr("Book note not found: {0}", name));
    return;
  }
  let existingText = "";
  try {
    existingText = await app.vault.read(noteFile);
  } catch {
    existingText = "";
  }
  const split = splitExportedHighlights(existingText, highlights);
  if (!split.fresh.length) {
    new Notice(split.already.length === 1 ? __ertr("That quote is already in \"{0}\"", noteFile.basename) : __ertr("All the selected quotes are already in \"{0}\"", noteFile.basename));
    return;
  }
  const skipped = split.already.length;
  highlights = split.fresh;
  const groups = [];
  for (const hl of highlights) {
    const clean = (hl.text || "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
    if (!clean) continue;
    const chapter = hl.chapter || "";
    let g = groups.find((x) => x.chapter === chapter);
    if (!g) {
      g = { chapter, lines: [] };
      groups.push(g);
    }
    let where = hl.page ? __ertr(" *(p. {0})*", hl.page) : "";
    if (plugin.settings.quoteBacklinks !== false && bookFile && typeof hl.block === "number" && hl.block >= 0) {
      const uri = `obsidian://kindle-reader?book=${encodeURIComponent(bookFile.path)}&block=${hl.block}`;
      where += ` [${backlinkLabel(plugin)}](${uri})`;
    }
    if (plugin.settings.exportCallouts !== false) {
      const type = plugin.settings.exportCalloutType || "quote";
      const header = hl.color ? `> [!${type}|${hl.color}]` : `> [!${type}]`;
      const cleanLines = clean.split("\n").map((l) => `> ${l}`).join("\n");
      const cmt = hl.comment ? `\n>\n> **${__ertr("Comment")}:** ${hl.comment.replace(/\n/g, "\n> ")}` : "";
      const sourceLine = where ? `\n>\n> —${where}` : "";
      g.lines.push(`${header}\n${cleanLines}${cmt}${sourceLine}`);
    } else {
      const cmt = hl.comment ? `\n>\n> — ${hl.comment.replace(/\n/g, "\n> ")}` : "";
      g.lines.push(`> ${hlMark(app, clean, hl.color)}${where}${cmt}`);
    }
  }
  const parts = groups.flatMap((g) => g.lines);
  if (!parts.length) {
    new Notice(__ertr("No highlights to export"));
    return;
  }
  const heading = __ertr("## Quotes");
  const block = groups.map((g) => (g.chapter ? `**${g.chapter}**

` : "") + g.lines.join("\n\n")).join("\n\n");
  let targetLine = 0;
  const add = (data) => {
    const base = data.replace(/\s*$/, "");
    const prefix = data.includes(heading) ? `${base}

` : `${base}

${heading}

`;
    targetLine = (prefix.match(/\n/g) || []).length;
    return `${prefix}${block}
`;
  };
  try {
    if (typeof app.vault.process === "function") await app.vault.process(noteFile, add);
    else await app.vault.modify(noteFile, add(await app.vault.read(noteFile)));
    new Notice(skipped ? __ertr("Added to \"{0}\": {1}; skipped as already present: {2}", noteFile.basename, parts.length, skipped) : __ertr("Quotes added to \"{0}\": {1}", noteFile.basename, parts.length));
    new ConfirmModal(app, {
      title: __ertr("Quotes added"),
      body: __ertr("Open the note \"{0}\" in a separate tab?", noteFile.basename),
      okText: __ertr("Yes, open"),
      cancelText: __ertr("No"),
      onYes: () => openNoteInTab(app, noteFile, targetLine)
    }).open();
  } catch (e) {
    console.error("Kindle Reader: append quotes to book note failed", e);
    new Notice(__ertr("Could not add quotes to the book note"));
  }
}
async function exportHighlightsMenu(app, plugin, bookFile, highlights, evt) {
  if (!highlights || !highlights.length) {
    new Notice(__ertr("No highlights to export"));
    return;
  }
  const name = bookFile ? bookNoteLinkFor(plugin, bookFile) : "";
  const noteFile = name ? resolveBookNote(app, name) : null;
  let noteText = "";
  if (noteFile) {
    try {
      noteText = await app.vault.cachedRead(noteFile);
    } catch {
      noteText = "";
    }
  }
  new HighlightExportModal(
    app,
    plugin,
    bookFile,
    highlights,
    noteText,
    noteFile ? noteFile.basename : "",
    exportHighlightsToBookNote,
    exportHighlightsSeparate
  ).open();
}

async function writeWhatsNewNote(app, plugin, releases) {
  try {
    if (!releases || !releases.length) return null;
    const title = sanitizeNoteTitle(__ertr("Book Reader {0} - what's new", plugin.manifest.version));
    const path = inboxNotePath(app, title, null);
    const exist = app.vault.getAbstractFileByPath(path);
    if (exist instanceof TFile) return exist;
    const body = releases.map((r) => `## ${r.v}

${r.items.map((i) => `- ${i}`).join("\n")}`).join("\n\n");
    await resolveNotesFolder(app, null);
    const f = await app.vault.create(path, `${__ertr("Book Reader has been updated to {0}. Here is what changed:", plugin.manifest.version)}

${body}

---

☕ **${__ertr("Support the project")}**: [Buy me a coffee](https://buymeacoffee.com/bernardonogueira8)
`);
    return f instanceof TFile ? f : null;
  } catch (e) {
    console.warn("Book Reader: could not write the what's-new note", e);
    return null;
  }
}

// ── Reader helpers exported for ReaderView & ReaderModal ──
export {
  VIEW_TYPE,
  erDeviceKey,
  readerTodayKey,
  fmtReadTime,
  shiftDayKey,
  readingStreak,
  readingStats,
  erRevealWhenSettled,
  erPaintSelection,
  erClearPaintedSelection,
  toggleTimerSession,
  stopReadingTimer,
  resetTimerSession,
  updateTimerBtn,
  updateGoalBar,
  handleAreaNavClick,
  panelSection,
  buildReaderExtraSettings,
  copyToClipboard,
  openImageLightbox,
  erShowVeil,
  erHideVeil,
  positionHlPopup,
  followFootnote,
  erSelectionRect,
  addBarButtons,
  addMoreBtn,
  markFoundIn,
  clearFoundIn,
  buildFindPanelFor,
  buildTocPanelFor,
  enrichHighlights,
  currentBookPage,
  sendQuoteToBookNote,
  buildTocItems,
  renderVisibleFigures,
  offsetInBlock,
  countOccurrencesBefore,
  locateHl,
  unwrapAllHighlights,
  wrapBlockRange,
  createNoteFromSelection,
  quoteMarkdown,
  hlCommentMd,
  exportHighlightsMenu,
  ReadSettingsModal,
  DictionaryModal
};

export { KindleReaderPlugin };
export default KindleReaderPlugin;
