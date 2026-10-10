import { Modal, Menu, Notice, Platform } from "obsidian";
import { Paginator } from "../reader/Paginator";
import { __ertr } from "../utils/i18n";
import { svgIcon, iconLabel, docOf, selOf } from "../utils/icons";
import { erTheme, FONTS, hlColorCss } from "../utils/theme";
import { erAutoFocus } from "../utils/dom";
import { bookNoteAction } from "../utils/notes";
import { GoToPageModal, ReadSettingsModal, BookSetupModal, InfoModal } from "./modals";
import {
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
  openImageLightbox,
  extractEpub,
  erShowVeil,
  erHideVeil,
  positionHlPopup,
  followFootnote,
  addBarButtons,
  addMoreBtn,
  extractFb2,
  extractPdf,
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
  addBookFileMenu,
  hlCommentMd,
  exportHighlightsMenu
} from "../main";

export class ReaderModal extends Modal {
  constructor(app, plugin, file) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    this.ext = file.extension === "epub" ? "epub" : file.extension === "fb2" ? "fb2" : "pdf";
    this.pager = new Paginator();
    this.pager.onSpreadChange = (cur, tot) => {
      (this.updateUI || this._updateUI).call(this, cur, tot);
      if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    };
    this.bookHtml = "";
    this.tocItems = [];
    this.panelOpen = null;
    this._pendingSel = null;
    this._editHlId = null;
    this.timeLeftEl = null;
    this.clockEl = null;
    this._clockTimer = null;
    this._pageTurnTimes = [];
    this._lastTurnTime = null;
    this._timeLeftMode = "time";
  }
  async onOpen() {
    if (Platform && (Platform.isAndroidApp || Platform.isAndroid)) {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          void document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {
        /* optional */
      }
    }
    const { modalEl, contentEl } = this;
    this.plugin._openReaderModal = this;
    try {
      if (this.scope && Array.isArray(this.scope.keys)) {
        this.scope.keys = this.scope.keys.filter((k) => String(k && k.key).toLowerCase() !== "escape");
      }
    } catch {
      // ignore
    }
    modalEl.addClass("er-fullscreen-modal");
    this.containerEl.addClass("er-fullscreen-container");
    contentEl.addClass("er-fullscreen-content");
    const CLOSE_BTNS = ".modal-close-button, .modal-header-button";
    const dropStrayCloses = (all) => {
      try {
        for (const b of docOf(modalEl).querySelectorAll(CLOSE_BTNS)) {
          const own = b.closest(".modal-container");
          if (all || !own || own === this.containerEl) b.remove();
        }
      } catch {
        // ignore
      }
    };
    dropStrayCloses(true);
    this._closeWatch = new MutationObserver(() => dropStrayCloses(false));
    this._closeWatch.observe(docOf(modalEl).body, { childList: true, subtree: true });
    this._applyTheme();
    this._buildDOM();
    await this._loadBook();
    this._sessionSec = 0;
    this._running = false;
    this._goalNotified = this.plugin.getTodaySeconds() >= this.plugin.getGoalSeconds();
    updateGoalBar(this);
    updateTimerBtn(this);
    this._lastW = this.areaEl.clientWidth;
    this._resizeObs = new ResizeObserver(() => {
      window.clearTimeout(this._rsT);
      this._rsT = window.setTimeout(() => {
        const w = this.areaEl ? this.areaEl.clientWidth : 0;
        if (w && Math.abs(w - (this._lastW || 0)) > 4) {
          this._lastW = w;
          this._repaginate();
        }
      }, 180);
    });
    this._resizeObs.observe(this.areaEl);
  }
  _applyTheme() {
    const t = erTheme(this.plugin.settings);
    const m = this.modalEl;
    m.style.setProperty("--er-bg", t.bg);
    m.style.setProperty("--er-text", t.text);
    m.style.setProperty("--er-ui", t.ui);
    m.style.setProperty("--er-border", t.border);
    m.style.setProperty("--er-accent", t.accent);
    m.style.setProperty("--er-muted", t.muted);
    m.style.background = t.bg;
  }
  _buildDOM() {
    const root = this.contentEl;
    root.empty();
    const pb = root.createDiv("er-pbar");
    this.pbarFill = pb.createDiv("er-pbar-fill");
    const top = root.createDiv("er-top");
    const lb = top.createDiv("er-ibtn");
    svgIcon(lb, "arrow-left");
    lb.setAttribute("aria-label", __ertr("Close the book"));
    lb.addEventListener("click", () => this.close());
    this.titleEl = top.createDiv("er-top-title");
    this.titleEl.setText(this.file.basename);
    const tr = top.createDiv("er-top-right");
    this.timerBtnEl = tr.createDiv("er-timerbtn");
    this.timerIconEl = this.timerBtnEl.createDiv("er-timer-ic");
    this.timerLabelEl = this.timerBtnEl.createDiv("er-timer-label");
    this.timerResetEl = this.timerBtnEl.createDiv("er-timer-reset");
    svgIcon(this.timerResetEl, "rotate-ccw");
    this.timerResetEl.setAttribute("aria-label", __ertr("Reset timer"));
    this.timerResetEl.addEventListener("click", (e) => {
      e.stopPropagation();
      resetTimerSession(this);
    });
    this.timerBtnEl.setAttribute("aria-label", __ertr("Timer: time left to the goal — start/pause"));
    this.timerBtnEl.addEventListener("click", () => toggleTimerSession(this));
    updateTimerBtn(this);
    const tocBtn = tr.createDiv("er-ibtn er-b-toc");
    svgIcon(tocBtn, "list");
    tocBtn.setAttribute("aria-label", __ertr("Table of contents"));
    tocBtn.addEventListener("click", () => this._togglePanel("toc"));
    const setBtn = tr.createDiv("er-ibtn er-b-settings");
    svgIcon(setBtn, "sliders");
    setBtn.setAttribute("aria-label", __ertr("Reading settings"));
    setBtn.addEventListener("click", () => new ReadSettingsModal(this.app, this).open());
    const moreBtn = tr.createDiv("er-ibtn er-b-more");
    svgIcon(moreBtn, "more-horizontal");
    moreBtn.setAttribute("aria-label", __ertr("More"));
    moreBtn.addEventListener("click", (e) => {
      const menu = new Menu();
      menu.addItem((it) => it.setTitle(__ertr("Search the book")).setIcon("search").onClick(() => {
        this._togglePanel("find");
        if (this._findInput) erAutoFocus(this._findInput, 80);
      }));
      menu.addItem((it) => it.setTitle(__ertr("Table of contents")).setIcon("list").onClick(() => this._togglePanel("toc")));
      menu.addItem((it) => it.setTitle(__ertr("Highlights")).setIcon("highlighter").onClick(() => this._togglePanel("highlights")));
      menu.addItem((it) => it.setTitle(__ertr("Save position")).setIcon("save").onClick(() => this.saveNow()));
      menu.addItem((it) => it.setTitle(__ertr("Re-flow the book")).setIcon("refresh-cw").onClick(async () => {
        await this._repaginate();
        new Notice(__ertr("The book has been re-flowed"));
      }));
      menu.addItem((it) => it.setTitle(__ertr("Reset timer")).setIcon("rotate-ccw").onClick(() => resetTimerSession(this)));
      menu.addItem((it) => it.setTitle(__ertr("Reading settings")).setIcon("sliders").onClick(() => new ReadSettingsModal(this.app, this).open()));
      addBookFileMenu(this.app, menu, this.file);
      menu.addSeparator();
      menu.addItem((it) => it.setTitle(__ertr("Close the book")).setIcon("x").onClick(() => this.close()));
      menu.showAtMouseEvent(e);
    });
    this.areaEl = root.createDiv("er-area er-marea");
    if ((this.plugin.settings.navMode || "buttons") === "click") root.addClass("er-navclick");
    const bot = root.createDiv("er-bot");
    const pv = bot.createDiv("er-navbtn er-navbtn-prev");
    svgIcon(pv, "chevron-left");
    pv.setAttribute("aria-label", __ertr("Previous page"));
    pv.addEventListener("click", () => this._nav("prev"));

    const footContent = bot.createDiv("er-bot-content");

    // Lado inferior esquerdo: Tempo restante (horas e minutos)
    const leftCol = footContent.createDiv("er-bot-col er-bot-left");
    this.timeLeftEl = leftCol.createDiv("er-bot-time-left");
    this.timeLeftEl.setText(__ertr("Calculating…"));
    this.timeLeftEl.setAttribute("aria-label", __ertr("Time left in book"));
    this.timeLeftEl.addEventListener("click", () => this._toggleTimeLeftDisplay());

    // Centralizado: Relógio visível da hora atual + localização
    const centerCol = footContent.createDiv("er-bot-col er-bot-center");
    this.clockEl = centerCol.createDiv("er-bot-clock");
    this.clockEl.setText(this._getCurrentTimeStr());
    this.clockEl.setAttribute("aria-label", __ertr("Current time"));

    this.locEl = centerCol.createDiv("er-loc er-loc-clickable");
    this.locEl.setAttribute("aria-label", __ertr("Go to page"));
    this.locEl.addEventListener("click", () => {
      if (!this.file || !this.pager || !this.pager.total) return;
      new GoToPageModal(
        this.app,
        this.pager.total,
        this.pager.spread,
        (n) => {
          const [cur, tot] = this.pager.jumpTo(n - 1);
          this._updateUI(cur, tot);
          this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
        },
        () => this._togglePanel("toc")
      ).open();
    });

    // Lado inferior direito: % do livro
    const rightCol = footContent.createDiv("er-bot-col er-bot-right");
    this.pctEl = rightCol.createDiv("er-pct");
    this.pctEl.setText("0%");
    this.pctEl.setAttribute("aria-label", __ertr("Reading progress"));
    this.pctEl.addEventListener("click", () => {
      if (!this.file || !this.pager || !this.pager.total) return;
      new GoToPageModal(this.app, this.pager.total, this.pager.spread, (n) => {
        const [cur, tot] = this.pager.jumpTo(n - 1);
        this._updateUI(cur, tot);
        this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
      }).open();
    });

    const nx = bot.createDiv("er-navbtn er-navbtn-next");
    svgIcon(nx, "chevron-right");
    nx.setAttribute("aria-label", __ertr("Next page"));
    nx.addEventListener("click", () => this._nav("next"));

    if (this._clockTimer) window.clearInterval(this._clockTimer);
    this._clockTimer = window.setInterval(() => {
      if (this.clockEl) this.clockEl.setText(this._getCurrentTimeStr());
    }, 10000);
    this.overlayEl = root.createDiv("er-overlay");
    this.overlayEl.addEventListener("click", () => this._closePanel());
    this.settPan = root.createDiv("er-panel");
    this.tocPan = root.createDiv("er-panel er-toc-panel");
    this.hlPan = root.createDiv("er-panel er-toc-panel er-hl-panel");
    this.findPan = root.createDiv("er-panel er-toc-panel er-find-panel");
    this._buildSettPanel();
    this._buildTocPanel();
    this._buildHlPanel();
    this._buildFindPanel();
    this.hlPopup = root.createDiv("er-hl-popup");
    this._buildHlPopup();
    this._selHandler = () => this._scheduleSelCheck();
    this._selDoc = docOf(this.areaEl);
    this._selDoc.addEventListener("selectionchange", this._selHandler);
    this.areaEl.addEventListener("click", (e) => {
      const refEl = e.target instanceof HTMLElement ? e.target.closest("[data-er-ref]") : null;
      if (refEl) {
        e.preventDefault();
        e.stopPropagation();
        if (followFootnote(this, refEl.getAttribute("data-er-ref"))) return;
      }
      const imgEl = e.target instanceof HTMLElement ? e.target.closest("img") : null;
      if (imgEl && imgEl.src) {
        e.preventDefault();
        openImageLightbox(imgEl.currentSrc || imgEl.src, this.app, imgEl);
        return;
      }
      const span = e.target instanceof HTMLElement ? e.target.closest(".er-hl") : null;
      if (span) {
        e.preventDefault();
        this._openHlEdit(span.getAttribute("data-hl-id"));
      } else if (this._editHlId) this._hideHlPopup();
    });
    let sx = 0, sy = 0, dir = null, longPress = false, lpTimer = null, hadSel = false;
    this.areaEl.addEventListener("touchstart", (e) => {
      if (e.touches.length > 1) {
        dir = "v";
        return;
      }
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      dir = null;
      longPress = false;
      const sel = selOf(this.areaEl);
      hadSel = !!(sel && !sel.isCollapsed);
      window.clearTimeout(lpTimer);
      lpTimer = window.setTimeout(() => {
        longPress = true;
      }, 350);
    }, { passive: true });
    this.areaEl.addEventListener("touchmove", (e) => {
      if (dir) {
        if (dir === "h") e.preventDefault();
        return;
      }
      const dx = Math.abs(e.touches[0].clientX - sx), dy = Math.abs(e.touches[0].clientY - sy);
      if (dx < 8 && dy < 8) return;
      window.clearTimeout(lpTimer);
      const sel = selOf(this.areaEl);
      if (longPress || hadSel || sel && !sel.isCollapsed) {
        dir = "v";
        return;
      }
      dir = dx > dy ? "h" : "v";
      if (dir === "h") e.preventDefault();
    }, { passive: false });
    this.areaEl.addEventListener("touchend", (e) => {
      window.clearTimeout(lpTimer);
      if (dir !== "h") return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 44) this._nav(dx < 0 ? "next" : "prev");
    }, { passive: true });
    this.areaEl.addEventListener("click", (e) => handleAreaNavClick(this, e));
    const armImmersive = () => {
      const root2 = this.contentEl;
      if (!root2) return;
      if (!this.plugin.settings.immersive) {
        root2.removeClass("er-immersive");
        return;
      }
      root2.removeClass("er-immersive");
      window.clearTimeout(this._immTimer);
      this._immTimer = window.setTimeout(() => {
        if (this.bookHtml && this.contentEl) this.contentEl.addClass("er-immersive");
      }, 2600);
    };
    this._armImmersive = armImmersive;
    this.contentEl.addEventListener("touchstart", armImmersive, { passive: true });
    this.contentEl.addEventListener("pointerdown", armImmersive);
    armImmersive();
  }
  // Settings changes (theme/font/size/line-height) → rebuild the pages, keeping
  // the current reading %. (Named _applyContentStyle for the panel callers.)
  async _applyContentStyle() {
    await this._repaginate();
  }
  async _repaginate() {
    if (!this.bookHtml || !this.areaEl || !this.areaEl.clientWidth) return;
    const savedBlock = this.pager.currentBlockIndex();
    const savedPct = this.pager.currentPct;
    this.areaEl.addClass("er-booting");
    erShowVeil(this);
    const [, total] = await this.pager.build(this.areaEl, this.bookHtml, this.plugin.settings, 0);
    const target = typeof savedBlock === "number" && savedBlock >= 0 ? this.pager.spreadForBlock(savedBlock) : Math.round(savedPct * Math.max(0, total - 1));
    this._renderFlowHighlights();
    const [cur, tot] = this.pager.jumpTo(target);
    erRevealWhenSettled(this);
    this._updateUI(cur, tot);
    if (this._tocRender) this._tocRender();
    this._findCorpus = null;
    if (this._foundQuery) this._markFound(this._foundQuery);
  }
  async _loadBook() {
    this.areaEl.empty();
    const loading = this.areaEl.createDiv("er-loading");
    loading.addClass("er-centered");
    loading.createDiv("er-spin");
    const loadText = loading.createDiv("er-loading-text");
    loadText.setText(__ertr("Loading the book…"));
    await new Promise((r) => window.requestAnimationFrame(r));
    await new Promise((r) => window.requestAnimationFrame(r));
    try {
      this._pdfLazy?.destroy?.();
      this._pdfLazy = null;
      if (this.ext === "epub") {
        const epubMeta = {};
        this.bookHtml = await extractEpub(this.file, this.app, epubMeta);
        this._epubToc = epubMeta.toc || null;
      } else if (this.ext === "fb2") {
        this._epubToc = null;
        this.bookHtml = await extractFb2(this.file, this.app);
      } else {
        this._epubToc = null;
        const res = await extractPdf(this.file, this.app, this.plugin.settings, (i, n) => loadText.setText(__ertr("Готовим книгу… {0}%", Math.round(i / n * 100))));
        this.bookHtml = res.html;
        this._pdfLazy = res.lazy;
        this._pdfOutline = res.outline;
      }
      this.tocItems = buildTocItems(this.bookHtml, this._pdfOutline, this._epubToc);
      this._buildTocPanel();
      await this.plugin.refreshHighlights();
      await this.plugin.refreshProgress();
      const saved = this.plugin.getProgress(this.file.path);
      const pct = (saved == null ? void 0 : saved.pct) != null ? saved.pct : 0;
      this.areaEl.addClass("er-booting");
      erShowVeil(this);
      window.setTimeout(() => {
        if (this.areaEl) this.areaEl.removeClass("er-booting");
        erHideVeil(this);
      }, 3e3);
      await this.pager.build(this.areaEl, this.bookHtml, this.plugin.settings, 0);
      const hasBlock = saved && typeof saved.block === "number" && saved.block >= 0;
      const target = hasBlock ? this.pager.spreadForBlock(saved.block) : Math.round(pct * Math.max(0, this.pager.total - 1));
      this._renderFlowHighlights();
      const [cur, tot] = this.pager.jumpTo(target);
      this._updateUI(cur, tot);
      erRevealWhenSettled(this);
      if (hasBlock) this._flashBlock(saved.block);
      this._buildSettPanel();
      this._maybePromptBookNote(this.file);
    } catch (e) {
      console.error("ReaderModal:", e);
      this.areaEl.empty();
      this.areaEl.createEl("p", { cls: "er-load-error", text: __ertr("Ошибка: {0}", e.message) });
    }
  }
  // First open of a book → the setup screen (create / pick / skip). Same rules as
  // the desktop view: never for a book that already has a note, never twice.
  _maybePromptBookNote(file) {
    const s = this.plugin.settings;
    if (!file) return;
    if (!s.bookNoteLinks) s.bookNoteLinks = {};
    if (!s.bookNotePrompted) s.bookNotePrompted = {};
    const action = bookNoteAction(s, file.path);
    if (action === "linked" || action === "prompted") return;
    if (action === "auto") {
      s.bookNotePrompted[file.path] = true;
      this.plugin.ensureBookNote(file).then((note) => {
        if (note) new Notice(__ertr("Заметка книги создана: {0}", note.basename));
      });
      return;
    }
    new BookSetupModal(this.app, this.plugin, file, () => {
    }).open();
  }
  // Jump to the page holding a global block index, flash it, save the position.
  _jumpToBlock(block, flash = true) {
    if (!this.bookHtml) return;
    const [cur, tot] = this.pager.jumpTo(this.pager.spreadForBlock(block));
    this._updateUI(cur, tot);
    if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    if (flash) this._flashBlock(block);
  }
  // Briefly highlight the paragraph the reader resumed at.
  // Jump to a paragraph as soon as the book is laid out. Called from a backlink,
  // which arrives while the book is still being built, so it waits for the
  // pager rather than assuming the text is already there. Gives up after a few
  // seconds instead of polling forever on a book that failed to open.
  // Land on a PDF page once the book is laid out. Pages are marked in the flow
  // with data-pdf-page-no, so this is a lookup rather than a guess.
  jumpToPdfPageWhenReady(pageNo) {
    let tries = 0;
    const tick = () => {
      const flow = this.pager && this.pager.flow;
      if (flow && this.pager.total) {
        const el = flow.querySelector(`[data-pdf-page-no="${pageNo}"]`);
        if (el) {
          const x = el.getBoundingClientRect().left - flow.getBoundingClientRect().left;
          const stride = this.pager.sw / (this.pager.cols || 1);
          const spread = Math.floor(Math.round(x / stride) / (this.pager.cols || 1));
          const [cur, tot] = this.pager.jumpTo(Math.max(0, Math.min(spread, this.pager.total - 1)));
          (this.updateUI || this._updateUI).call(this, cur, tot);
          return;
        }
      }
      if (++tries > 40) return;
      window.setTimeout(tick, 100);
    };
    tick();
  }
  jumpToBlockWhenReady(idx) {
    let tries = 0;
    const tick = () => {
      if (this.pager && this.pager.flow && this.pager.total) {
        const [cur, tot] = this.pager.jumpTo(this.pager.spreadForBlock(idx));
        (this.updateUI || this._updateUI).call(this, cur, tot);
        this._flashBlock(idx);
        return;
      }
      if (++tries > 40) return;
      window.setTimeout(tick, 100);
    };
    tick();
  }
  _flashBlock(idx) {
    const el = this.pager.blockEl(idx);
    if (!el) return;
    el.classList.remove("er-resume-flash");
    void el.offsetWidth;
    el.classList.add("er-resume-flash");
    window.setTimeout(() => el.classList.remove("er-resume-flash"), 2400);
  }
  _nav(dir) {
    if (!this.bookHtml) return;
    const _now = Date.now();
    if (this._lastNavTs && _now - this._lastNavTs < 90) return;
    this._lastNavTs = _now;
    this._lastActive = _now;
    this._hideHlPopup();
    this._recordPageTurn();
    const [cur, total] = dir === "next" ? this.pager.next() : this.pager.prev();
    this._updateUI(cur, total);
    this.plugin.saveProgress(this.file.path, cur, total, this.pager.currentBlockIndex());
  }
  saveNow() {
    if (!this.bookHtml || !this.file) {
      new Notice(__ertr("Nothing to save"));
      return;
    }
    const pct = this.plugin.saveNow(this.file.path, this.pager.spread, this.pager.total, this.pager.currentBlockIndex());
    new Notice(__ertr("Сохранено ✓ — {0}%", pct));
    if (this.panelOpen === "settings") this._renderHistory();
  }
  exportHighlights(evt) {
    if (!this.file) {
      new Notice(__ertr("No book is open"));
      return;
    }
    const list = enrichHighlights(this, this.plugin.getHighlights(this.file.path));
    exportHighlightsMenu(this.app, this.plugin, this.file, list, evt);
  }
  _getCurrentTimeStr() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  _recordPageTurn() {
    const now = Date.now();
    if (this._lastTurnTime) {
      const elapsedSec = (now - this._lastTurnTime) / 1000;
      if (elapsedSec >= 6 && elapsedSec <= 300) {
        if (!this._pageTurnTimes) this._pageTurnTimes = [];
        this._pageTurnTimes.push(elapsedSec);
        if (this._pageTurnTimes.length > 8) this._pageTurnTimes.shift();
      }
    }
    this._lastTurnTime = now;
  }
  _toggleTimeLeftDisplay() {
    this._timeLeftMode = this._timeLeftMode === "pages" ? "time" : "pages";
    if (this.pager) {
      this._updateTimeLeft(this.pager.spread, this.pager.total);
    }
  }
  _updateTimeLeft(cur, total) {
    if (!this.timeLeftEl) return;
    if (total == null || total <= 0) {
      this.timeLeftEl.setText("");
      return;
    }
    const remainingSpreads = Math.max(0, total - (cur + 1));
    if (remainingSpreads === 0) {
      this.timeLeftEl.setText(__ertr("Finished"));
      return;
    }
    if (this._timeLeftMode === "pages") {
      this.timeLeftEl.setText(__ertr("{0} pages left", remainingSpreads));
      return;
    }
    let secPerSpread = 65;
    if (this._pageTurnTimes && this._pageTurnTimes.length >= 2) {
      const sum = this._pageTurnTimes.reduce((a, b) => a + b, 0);
      secPerSpread = Math.max(20, Math.min(180, Math.round(sum / this._pageTurnTimes.length)));
    }
    const secLeft = remainingSpreads * secPerSpread;
    const minsLeft = Math.round(secLeft / 60);
    if (minsLeft < 1) {
      this.timeLeftEl.setText(__ertr("< 1 min left"));
    } else if (minsLeft < 60) {
      this.timeLeftEl.setText(__ertr("{0} min left", minsLeft));
    } else {
      const h = Math.floor(minsLeft / 60);
      const m = minsLeft % 60;
      if (m === 0) {
        this.timeLeftEl.setText(__ertr("{0} h left", h));
      } else {
        this.timeLeftEl.setText(__ertr("{0} h {1} min left", h, m));
      }
    }
  }
  _updateUI(cur, total) {
    if (this.contentEl) this.contentEl.toggleClass("er-scrolling", !!(this.pager && this.pager.scrollMode));
    cur = cur != null ? cur : this.pager.spread;
    total = total != null ? total : this.pager.total;
    const pct = total > 0 ? Math.round((cur + 1) / total * 100) : 0;
    if (this.pbarFill) this.pbarFill.style.width = `${pct}%`;
    const bookPage = currentBookPage(this);
    const where = this.ext === "pdf" ? __ertr("Spread {0} of {1}", cur + 1, total) : `${cur + 1} / ${total}`;
    if (this.locEl) this.locEl.setText(bookPage ? __ertr("p. {0}", bookPage) + ` · ${where}` : where);
    if (this.pctEl) this.pctEl.setText(`${pct}%`);
    if (this.clockEl) this.clockEl.setText(this._getCurrentTimeStr());
    this._updateTimeLeft(cur, total);
    renderVisibleFigures(this);
  }
  _buildSettPanel() {
    const p = this.settPan;
    p.empty();
    p.createDiv("er-pan-title").setText(__ertr("Settings"));
    const sec = (l) => p.createDiv("er-pan-sec").setText(l);
    sec(__ertr("Theme"));
    const thRow = p.createDiv("er-theme-row");
    ["auto", "dark", "light", "sepia", "eink"].forEach((t) => {
      const btn = thRow.createDiv(`er-theme-btn er-theme-${t}`);
      btn.setText({ auto: __ertr("Match Obsidian"), dark: __ertr("Dark"), light: __ertr("Light"), sepia: "Sepia", eink: "E-ink" }[t]);
      if (this.plugin.settings.theme === t) btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.theme = t;
        await this.plugin.saveAll();
        this._applyTheme();
        thRow.querySelectorAll(".er-theme-btn").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    sec(__ertr("Font size"));
    const szRow = p.createDiv("er-sz-row");
    const szMinus = szRow.createDiv("er-sz-btn");
    szMinus.setText("A−");
    this.szLabel = szRow.createDiv("er-sz-label");
    this.szLabel.setText(`${this.plugin.settings.fontSize}px`);
    const szPlus = szRow.createDiv("er-sz-btn");
    szPlus.setText("A+");
    const chSz = async (d) => {
      this.plugin.settings.fontSize = Math.min(32, Math.max(12, this.plugin.settings.fontSize + d));
      this.szLabel.setText(`${this.plugin.settings.fontSize}px`);
      await this.plugin.saveAll();
      this._applyContentStyle();
    };
    szMinus.addEventListener("click", () => chSz(-1));
    szPlus.addEventListener("click", () => chSz(1));
    const advHdr = p.createDiv("er-pan-adv-hdr");
    advHdr.createSpan({ cls: "er-pan-adv-ic", text: "⚙️" });
    advHdr.createSpan({ cls: "er-pan-adv-lbl", text: __ertr("More settings") });
    const advCar = advHdr.createSpan({ cls: "er-pan-adv-car", text: "›" });
    const advWrap = p.createDiv("er-pan-adv");
    const adv = advWrap.createDiv("er-pan-adv-body");
    const secA = (l) => adv.createDiv("er-pan-sec").setText(l);
    if (this.plugin.settings.readerAdvOpen) {
      advWrap.addClass("er-pan-adv-on");
      advCar.addClass("er-pan-adv-car-on");
    }
    advHdr.addEventListener("click", async () => {
      const on = advWrap.hasClass("er-pan-adv-on");
      advWrap.toggleClass("er-pan-adv-on", !on);
      advCar.toggleClass("er-pan-adv-car-on", !on);
      this.plugin.settings.readerAdvOpen = !on;
      await this.plugin._saveLocalData();
    });
    secA(__ertr("Font"));
    const ffRow = adv.createDiv("er-ff-row");
    Object.keys(FONTS).forEach((ff) => {
      const btn = ffRow.createDiv("er-ff-btn");
      btn.setText(ff);
      btn.style.fontFamily = FONTS[ff];
      if (this.plugin.settings.fontFamily === ff) btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.fontFamily = ff;
        await this.plugin.saveAll();
        this._applyContentStyle();
        ffRow.querySelectorAll(".er-ff-btn").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    secA(__ertr("Line spacing"));
    const lhRow = adv.createDiv("er-lh-row");
    [1.4, 1.6, 1.8, 2.1].forEach((lh) => {
      const btn = lhRow.createDiv("er-lh-btn");
      btn.setText(`${lh}`);
      if (Math.abs(this.plugin.settings.lineHeight - lh) < 0.05) btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.lineHeight = lh;
        await this.plugin.saveAll();
        this._applyContentStyle();
        lhRow.querySelectorAll(".er-lh-btn").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    buildReaderExtraSettings(this, adv);
    this._histRow = panelSection(this, p, {
      label: __ertr("Jump back"),
      emoji: "\u{1F516}",
      settingKey: "readerHistOpen"
    }).createDiv("er-hist-row");
    this._renderHistory();
    p.createDiv("er-pan-sec").setText(__ertr("Actions"));
    const actRow = p.createDiv("er-act-row");
    const actBtn = actRow.createDiv("er-act-btn");
    iconLabel(actBtn, "info", __ertr("Help"));
    actBtn.addEventListener("click", () => {
      this._closePanel();
      new InfoModal(this.app, this.plugin, this.file).open();
    });
  }
  _renderHistory() {
    const c = this._histRow;
    if (!c) return;
    c.empty();
    const list = this.file ? this.plugin.getBackups(this.file.path) : [];
    const badge = c.parentElement && c.parentElement._erCount;
    if (badge) badge.setText(list.length ? String(list.length) : "");
    if (!list.length) {
      c.createDiv("er-hist-empty").setText(__ertr("No points yet"));
      return;
    }
    [...list].reverse().slice(0, 14).forEach((snap) => {
      const chip = c.createDiv("er-hist-chip");
      if (snap.manual) chip.addClass("er-hist-manual");
      const d = new Date(snap.ts || snap.lastRead || Date.now());
      const mark = snap.manual ? "\u{1F4BE} " : "";
      chip.setText(`${mark}${snap.percent}% \xB7 ${d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`);
      chip.addEventListener("click", () => {
        if (!this.bookHtml) return;
        this._closePanel();
        if (typeof snap.block === "number" && snap.block >= 0) {
          this._jumpToBlock(snap.block);
        } else {
          const frac = typeof snap.pct === "number" ? snap.pct : (snap.percent || 0) / 100;
          const [cur, tot] = this.pager.jumpTo(Math.round(frac * Math.max(0, this.pager.total - 1)));
          this._updateUI(cur, tot);
          if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
        }
        new Notice(__ertr("Вернулись к {0}%", snap.percent));
      });
    });
  }
  _buildTocPanel() {
    this._tocRender = buildTocPanelFor(this, this.tocPan, {
      close: () => this._closePanel(),
      jump: (b) => this._jumpToBlock(b)
    });
  }
  _buildFindPanel() {
    buildFindPanelFor(this, this.findPan, {
      close: () => this._closePanel(),
      jump: (b) => this._jumpToBlock(b)
    });
  }
  _markFound(query) {
    markFoundIn(this, query);
  }
  _clearFound() {
    clearFoundIn(this);
  }
  _togglePanel(name) {
    if (this.panelOpen === name) {
      this._closePanel();
      return;
    }
    this._hideHlPopup();
    if (name === "highlights") this._buildHlPanel();
    if (name === "settings") this._renderHistory();
    this.panelOpen = name;
    this.settPan.classList.toggle("er-panel-open", name === "settings");
    this.tocPan.classList.toggle("er-panel-open", name === "toc");
    this.hlPan.classList.toggle("er-panel-open", name === "highlights");
    if (this.findPan) this.findPan.classList.toggle("er-panel-open", name === "find");
    this.overlayEl.classList.add("er-overlay-on");
  }
  _closePanel() {
    this.panelOpen = null;
    this.settPan.classList.remove("er-panel-open");
    this.tocPan.classList.remove("er-panel-open");
    this.hlPan.classList.remove("er-panel-open");
    if (this.findPan) this.findPan.classList.remove("er-panel-open");
    this.overlayEl.classList.remove("er-overlay-on");
  }
  // ── Highlights (mobile) ───────────────────────────────
  // Now identical to the desktop flow model: highlights are addressed by the
  // GLOBAL block index inside the single paginated flow (no per-section offset).
  _renderFlowHighlights() {
    if (!this.file || !this.pager.flow) return;
    unwrapAllHighlights(this.pager.flow);
    const blocks = this.pager.flow.querySelectorAll("p,h1,h2,h3,h4");
    const list = this.plugin.getHighlights(this.file.path);
    for (const hl of list) {
      const block = blocks[hl.block];
      if (!block) continue;
      const text = block.textContent;
      const loc = locateHl(text, hl);
      if (!loc) continue;
      wrapBlockRange(block, loc.start, loc.start + loc.len, { id: hl.id, color: hlColorCss(hl.color) });
    }
  }
  _scheduleSelCheck() {
    window.clearTimeout(this._selTimer);
    this._selTimer = window.setTimeout(() => this._onSelectionCheck(), 80);
  }
  _onSelectionCheck() {
    if (this._editHlId) return;
    const sel = selOf(this.areaEl);
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      this._hideHlPopup();
      return;
    }
    const range = sel.getRangeAt(0);
    const flow = this.pager.flow;
    if (!flow || !flow.contains(range.startContainer)) {
      this._hideHlPopup();
      return;
    }
    let node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const block = node ? node.closest("p,h1,h2,h3,h4") : null;
    if (!block || !flow.contains(block)) {
      this._hideHlPopup();
      return;
    }
    const blocks = [...flow.querySelectorAll("p,h1,h2,h3,h4")];
    const blockIndex = blocks.indexOf(block);
    if (blockIndex < 0) {
      this._hideHlPopup();
      return;
    }
    const parts = [];
    for (let bi = blockIndex; bi < blocks.length; bi++) {
      const b = blocks[bi];
      if (bi > blockIndex && !range.intersectsNode(b)) break;
      const bText = b.textContent;
      const from = bi === blockIndex ? offsetInBlock(b, range.startContainer, range.startOffset) : 0;
      const ends = b.contains(range.endContainer);
      const to = ends ? offsetInBlock(b, range.endContainer, range.endOffset) : bText.length;
      if (to > from) {
        const seg = bText.slice(from, to);
        if (seg.trim()) {
          parts.push({
            block: bi,
            occ: countOccurrencesBefore(bText, seg, from),
            text: seg,
            pre: bText.slice(Math.max(0, from - 32), from),
            post: bText.slice(to, to + 32)
          });
        }
      }
      if (ends) break;
    }
    if (!parts.length) {
      this._hideHlPopup();
      return;
    }
    this._pendingSel = { ...parts[0], parts, text: parts.map((p) => p.text).join(" ") };
    erPaintSelection(this, range);
    this._showHlPopup(range.getBoundingClientRect());
  }
  _buildHlPopup() {
    const pop = this.hlPopup;
    pop.empty();
    pop.addEventListener("mousedown", (e) => e.preventDefault());
    addBarButtons(this, pop);
    addMoreBtn(this, pop);
  }
  _applyPopupColor(colorId) {
    if (this._editHlId && this.file) {
      const id = this._editHlId;
      this.plugin.setHighlightColor(this.file.path, id, colorId);
      this.pager.flow?.querySelectorAll(`[data-hl-id="${id}"]`).forEach((s) => {
        s.style.background = hlColorCss(colorId);
      });
      if (this.panelOpen === "highlights") this._buildHlPanel();
      this._hideHlPopup();
      return;
    }
    if (this._pendingSel && this.file) {
      const parts = this._pendingSel.parts || [this._pendingSel];
      for (const part of parts) this._createHighlight(part, colorId);
      selOf(this.areaEl)?.removeAllRanges();
      if (this.panelOpen === "highlights") this._buildHlPanel();
    }
    this._hideHlPopup();
  }
  // Same as in the desktop reader: needed so a comment can create the highlight
  // it hangs on. Returns the new id.
  _createHighlight(sel, colorId) {
    if (!sel || !this.file) return null;
    const id = "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const hl = { id, color: colorId, text: sel.text, block: sel.block, occ: sel.occ, pre: sel.pre, post: sel.post, created: Date.now() };
    this.plugin.addHighlight(this.file.path, hl);
    const blocks = this.pager.flow ? this.pager.flow.querySelectorAll("p,h1,h2,h3,h4") : [];
    const block = blocks[hl.block];
    if (block) {
      const t = block.textContent;
      const loc = locateHl(t, hl);
      if (loc) wrapBlockRange(block, loc.start, loc.start + loc.len, { id: hl.id, color: hlColorCss(colorId) });
    }
    return id;
  }
  _currentHl() {
    if (this._editHlId && this.file) {
      const hl = this.plugin.getHighlights(this.file.path).find((h) => h.id === this._editHlId);
      if (hl) return { text: hl.text || "", block: hl.block, color: hl.color };
    }
    if (this._pendingSel) return { text: this._pendingSel.text || "", block: this._pendingSel.block, color: null };
    return null;
  }
  _openHlEdit(id) {
    const span = this.pager.flow?.querySelector(`[data-hl-id="${id}"]`);
    if (!span) return;
    this._pendingSel = null;
    this._editHlId = id;
    this._showHlPopup(span.getBoundingClientRect());
  }
  _unwrapHighlight(id) {
    const flow = this.pager.flow;
    if (!flow) return;
    flow.querySelectorAll(`[data-hl-id="${id}"]`).forEach((span) => {
      const parent2 = span.parentNode;
      while (span.firstChild) parent2.insertBefore(span.firstChild, span);
      parent2.removeChild(span);
      parent2.normalize();
    });
  }
  _showHlPopup(rect) {
    const pop = this.hlPopup;
    pop.classList.add("er-hl-popup-on");
    positionHlPopup(this, rect, 230, 46);
  }
  _hideHlPopup() {
    erClearPaintedSelection();
    this._pendingSel = null;
    this._editHlId = null;
    if (this.hlPopup) this.hlPopup.classList.remove("er-hl-popup-on");
  }
  goToHighlight(id) {
    const hl = this.file ? this.plugin.getHighlights(this.file.path).find((h) => h.id === id) : null;
    if (!hl) return;
    this._closePanel();
    const [cur, tot] = this.pager.jumpTo(this.pager.spreadForBlock(hl.block));
    this._updateUI(cur, tot);
    if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    window.requestAnimationFrame(() => {
      const span = this.pager.flow?.querySelector(`[data-hl-id="${id}"]`);
      if (span) {
        span.classList.add("er-hl-flash");
        window.setTimeout(() => span.classList.remove("er-hl-flash"), 1200);
      }
    });
  }
  _buildHlPanel() {
    const p = this.hlPan;
    p.empty();
    p.createDiv("er-pan-title").setText(__ertr("Highlights"));
    const list = this.file ? this.plugin.getHighlights(this.file.path) : [];
    if (!list.length) {
      p.createDiv("er-toc-empty").setText(__ertr("No highlights yet.\nSelect text and pick a color."));
      return;
    }
    const exp = p.createDiv("er-hl-export");
    iconLabel(exp, "download", __ertr("Экспортировать в заметки ({0})", list.length));
    exp.setAttribute("aria-label", __ertr("Export all highlights"));
    exp.addEventListener("click", (e) => this.exportHighlights(e));
    const wrap = p.createDiv("er-toc-list");
    list.forEach((hl) => {
      const item = wrap.createDiv("er-hl-item");
      const dot = item.createDiv("er-hl-dot");
      dot.style.background = hlColorCss(hl.color);
      const body = item.createDiv("er-hl-body");
      const txt = body.createDiv("er-hl-text");
      txt.setText(hl.text.length > 160 ? hl.text.slice(0, 160) + "…" : hl.text);
      if (hl.comment) body.createDiv("er-hl-comment").setText(hl.comment);
      const showHlMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.file) return;
        const menu = new Menu();
        menu.addItem((it) => it.setTitle(__ertr("Create note")).setIcon("file-plus").onClick(() => {
          createNoteFromSelection(this.app, this.plugin, hl.text, this.file, { extra: hlCommentMd(hl), color: hl.color });
        }));
        menu.addItem((it) => it.setTitle(__ertr("As text into the book note")).setIcon("text-quote").onClick(() => {
          sendQuoteToBookNote(this, hl);
        }));
        menu.showAtMouseEvent(e);
      };
      const more = item.createDiv("er-hl-more");
      svgIcon(more, "more");
      more.setAttribute("aria-label", __ertr("More"));
      more.addEventListener("click", showHlMenu);
      const del = item.createDiv("er-hl-del");
      svgIcon(del, "trash");
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!this.file) return;
        this.plugin.removeHighlight(this.file.path, hl.id);
        this._unwrapHighlight(hl.id);
        this._buildHlPanel();
      });
      item.addEventListener("click", () => this.goToHighlight(hl.id));
      item.addEventListener("contextmenu", showHlMenu);
    });
  }
  onClose() {
    stopReadingTimer(this);
    if (this._clockTimer) {
      window.clearInterval(this._clockTimer);
      this._clockTimer = null;
    }
    if (Platform && (Platform.isAndroidApp || Platform.isAndroid)) {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          void document.exitFullscreen().catch(() => {});
        }
      } catch {
        /* optional */
      }
    }
    if (this.plugin._openReaderModal === this) this.plugin._openReaderModal = null;
    clearFoundIn(this);
    if (this._selHandler) (this._selDoc || document).removeEventListener("selectionchange", this._selHandler);
    this._resizeObs?.disconnect();
    this._pdfLazy?.destroy?.();
    this._pdfLazy = null;
    window.clearTimeout(this._rsT);
    window.clearTimeout(this._selTimer);
    window.clearTimeout(this._immTimer);
    window.clearTimeout(this._revealT);
    this._closeWatch?.disconnect();
    this.contentEl.empty();
  }
};
