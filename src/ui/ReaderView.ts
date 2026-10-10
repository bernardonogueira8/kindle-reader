import { ItemView, TFile, Menu, Notice, Platform } from "obsidian";
import { Paginator } from "../reader/Paginator";
import { __ertr } from "../utils/i18n";
import { svgIcon, iconLabel, docOf, selOf } from "../utils/icons";
import { erTheme, FONTS, HL_COLORS, hlColorCss } from "../utils/theme";
import { erAutoFocus } from "../utils/dom";
import { bookNoteAction } from "../utils/notes";
import { GoToPageModal, ReadSettingsModal, BookSetupModal, InfoModal } from "./modals";
import {
  VIEW_TYPE,
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
  extractEpub,
  erShowVeil,
  erHideVeil,
  positionHlPopup,
  followFootnote,
  erSelectionRect,
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
  quoteMarkdown,
  hlCommentMd,
  exportHighlightsMenu
} from "../main";

export class ReaderView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.file = null;
    this.ext = null;
    this.pager = new Paginator();
    this.pager.onSpreadChange = (cur, tot) => {
      (this.updateUI || this._updateUI).call(this, cur, tot);
      if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    };
    this.bookHtml = "";
    this.tocItems = [];
    this.panelOpen = null;
    this.plugin = plugin;
    this._resizeTimer = null;
    this._lastWidth = 0;
    this._pendingSel = null;
    this._editHlId = null;
    this.timeLeftEl = null;
    this.clockEl = null;
    this._clockTimer = null;
    this._pageTurnTimes = [];
    this._lastTurnTime = null;
    this._timeLeftMode = "time";
  }
  getViewType() {
    return VIEW_TYPE;
  }
  // The tab's "..." menu. A book opened in the reader used to have none of the
  // things every other file in Obsidian offers there — reveal in the folder
  // tree, rename, move, delete — which readers reported as the reader "taking
  // the file hostage". These come from Obsidian itself, so they stay correct.
  onPaneMenu(menu, source) {
    super.onPaneMenu(menu, source);
    addBookFileMenu(this.app, menu, this.file);
  }
  getDisplayText() {
    let _a, _b;
    return (_b = (_a = this.file) == null ? void 0 : _a.basename) != null ? _b : "Book Reader";
  }
  getIcon() {
    return "book-open";
  }
  getState() {
    let _a, _b;
    const p = (_b = (_a = this.file) == null ? void 0 : _a.path) != null ? _b : "";
    return { file: p, path: p };
  }
  async setState(state, result) {
    const path5 = (state == null ? void 0 : state.file) != null ? state.file : state == null ? void 0 : state.path;
    if (!path5)
      return;
    if (this.file && this.file.path === path5 && this.bookHtml)
      return;
    const f = this.app.vault.getAbstractFileByPath(path5);
    if (f instanceof TFile)
      await this.openFile(f);
  }
  async onOpen() {
    this.buildDOM();
    this._resizeObs = new ResizeObserver(() => {
      let _a;
      if (!this.bookHtml) return;
      if (this.containerEl.offsetParent === null) return;
      const w = this.areaEl.clientWidth;
      if (!w) return;
      if (Math.abs(w - (this._laidOutWidth || 0)) < 8) return;
      this._setRelayout(true);
      window.clearTimeout(this._resizeTimer);
      const delay = ((_a = this.app) == null ? void 0 : _a.isMobile) ? 500 : 260;
      this._resizeTimer = window.setTimeout(() => {
        const fw = this.areaEl.clientWidth;
        if (!fw || this.containerEl.offsetParent === null) {
          this._setRelayout(false);
          return;
        }
        if (Math.abs(fw - (this._laidOutWidth || 0)) < 8) {
          this._setRelayout(false);
          return;
        }
        this.repaginate();
      }, delay);
    });
    this._resizeObs.observe(this.areaEl);
    const recheck = () => {
      if (this._layoutWidthStale()) this.repaginate();
    };
    this.registerEvent(this.app.workspace.on("layout-change", recheck));
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf === this.leaf) recheck();
    }));
  }
  async openFile(file) {
    if (Platform && (Platform.isAndroidApp || Platform.isAndroid)) {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          void document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {
        /* optional */
      }
    }
    this.file = file;
    this.ext = file.extension === "epub" ? "epub" : file.extension === "fb2" ? "fb2" : "pdf";
    this.bookHtml = "";
    this.tocItems = [];
    this._pdfLazy?.destroy?.();
    this._pdfLazy = null;
    this._pdfOutline = null;
    this.titleEl.setText(file.basename);
    this.applyVars();
    this.areaEl.empty();
    const loading = this.areaEl.createDiv("er-loading");
    loading.createDiv("er-spin");
    const loadText = loading.createDiv("er-loading-text");
    loadText.setText(__ertr("Loading the book…"));
    await new Promise((r) => window.requestAnimationFrame(r));
    await new Promise((r) => window.requestAnimationFrame(r));
    try {
      if (this.ext === "epub") {
        this.bookHtml = await extractEpub(file, this.app);
      } else if (this.ext === "fb2") {
        this.bookHtml = await extractFb2(file, this.app);
      } else {
        const res = await extractPdf(file, this.app, this.plugin.settings, (i, n) => loadText.setText(__ertr("Preparing the book… {0}%", Math.round(i / n * 100))));
        this.bookHtml = res.html;
        this._pdfLazy = res.lazy;
        this._pdfOutline = res.outline;
      }
      this.tocItems = buildTocItems(this.bookHtml, this._pdfOutline);
      this.buildTocPanel();
      await this.plugin.refreshProgress();
      await this.plugin.refreshHighlights();
      const saved = this.plugin.getProgress(file.path);
      const pct = (saved == null ? void 0 : saved.pct) != null ? saved.pct : 0;
      await this.paginate(pct, saved == null ? void 0 : saved.block);
      this.buildSettPanel();
      this._maybePromptBookNote(file);
      this._sessionSec = 0;
      this._running = false;
      this._goalNotified = this.plugin.getTodaySeconds() >= this.plugin.getGoalSeconds();
      updateGoalBar(this);
      updateTimerBtn(this);
    } catch (e) {
      console.error("Elton Reader:", e);
      new Notice(__ertr("Error opening the file"));
    }
  }
  // On a book's first open, offer to pick its index note (from the configured
  // book-notes folder). Asks once per book; afterwards use the field/button in
  // the info panel. Skipped entirely unless a dedicated folder is configured, so
  // it never pops up over the whole vault for users who don't use this feature.
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
        if (note) new Notice(__ertr("Book note created: {0}", note.basename));
        if (this.panelOpen === "settings") this.buildSettPanel();
      });
      return;
    }
    new BookSetupModal(this.app, this.plugin, file, () => {
      if (this.panelOpen === "settings") this.buildSettPanel();
    }).open();
  }
  async paginate(savedPct = 0, savedBlock = null) {
    this.areaEl.empty();
    let w = this.areaEl.clientWidth, a = 0;
    while (!w && a < 60) {
      await new Promise((r) => window.requestAnimationFrame(r));
      w = this.areaEl.clientWidth;
      a++;
    }
    if (!w) return;
    this.areaEl.addClass("er-booting");
    erShowVeil(this);
    window.setTimeout(() => {
      if (this.areaEl) this.areaEl.removeClass("er-booting");
      erHideVeil(this);
    }, 3e3);
    const [, total] = await this.pager.build(
      this.areaEl,
      this.bookHtml,
      this.plugin.settings,
      0
    );
    this._laidOutWidth = this.pager.builtWidth || w;
    const hasBlock = typeof savedBlock === "number" && savedBlock >= 0;
    const targetSpread = hasBlock ? this.pager.spreadForBlock(savedBlock) : Math.round(savedPct * Math.max(0, total - 1));
    this._renderFlowHighlights();
    const [cur, tot] = this.pager.jumpTo(targetSpread);
    this.updateUI(cur, tot);
    erRevealWhenSettled(this);
    if (hasBlock) this._flashBlock(savedBlock);
  }
  // Briefly highlight the paragraph the reader resumed at, so the eye finds it.
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
  // Paint every occurrence of the search term in the book, so that after jumping
  // to a result the eye finds the actual word instead of hunting through the
  // paragraph.
  //
  // Uses the CSS Custom Highlight API: it draws over existing text WITHOUT
  // touching the DOM. Wrapping matches in <span> would have been the obvious
  // route, but inserting elements into the flow re-runs the column layout and
  // would disturb both pagination and the reader's own <mark> highlights.
  _markFound(query) {
    markFoundIn(this, query);
  }
  _clearFound() {
    clearFoundIn(this);
  }
  // Jump to the page holding a global block index, flash it, save the position.
  // Used by the TOC panel.
  _jumpToBlock(block, flash = true) {
    if (!this.bookHtml || typeof block !== "number") return;
    const [cur, tot] = this.pager.jumpTo(this.pager.spreadForBlock(block));
    this.updateUI(cur, tot);
    if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    if (flash) this._flashBlock(block);
  }
  // Repaginate preserving current reading % (used on settings change)
  // Show/hide the "re-laying out" veil: the page blurs and a spinner fades in.
  // The class goes on the ROOT, not on the reading area, because the spinner has
  // to sit OUTSIDE the blurred element — a child of it would be blurred too.
  _setRelayout(on) {
    if (!on) erHideVeil(this);
    const root = this.contentEl;
    if (!root) return;
    if (on && !this._spinEl) {
      this._spinEl = root.createDiv("er-relayout-spin");
      this._spinEl.createDiv("er-relayout-ring");
    }
    root.toggleClass("er-relayouting", !!on);
  }
  async repaginate() {
    if (!this.bookHtml) return;
    if (!this.areaEl.clientWidth || this.containerEl.offsetParent === null) return;
    const savedBlock = this.pager.currentBlockIndex();
    const savedPct = this.pager.currentPct;
    this._setRelayout(true);
    erShowVeil(this);
    try {
      await new Promise((r) => window.requestAnimationFrame(r));
      this.areaEl.empty();
      const [, total] = await this.pager.build(
        this.areaEl,
        this.bookHtml,
        this.plugin.settings,
        0
      );
      this._laidOutWidth = this.pager.builtWidth || this.areaEl.clientWidth;
      const w = this.areaEl.clientWidth;
      this._staleGaveUpAt = w && Math.abs(w - (this.pager.builtWidth || 0)) >= 8 ? this.pager.builtWidth : null;
      const targetSpread = typeof savedBlock === "number" && savedBlock >= 0 ? this.pager.spreadForBlock(savedBlock) : Math.round(savedPct * Math.max(0, total - 1));
      this._renderFlowHighlights();
      const [cur, tot] = this.pager.jumpTo(targetSpread);
      this.updateUI(cur, tot);
      if (this._tocRender) this._tocRender();
      this._findCorpus = null;
      if (this._foundQuery) this._markFound(this._foundQuery);
    } finally {
      window.requestAnimationFrame(() => this._setRelayout(false));
    }
  }
  // ── DOM ──────────────────────────────────────────────
  buildDOM() {
    const root = this.contentEl;
    root.empty();
    root.addClass("er-view");
    this.applyVars();
    const pb = root.createDiv("er-pbar");
    this.pbarFill = pb.createDiv("er-pbar-fill");
    const top = root.createDiv("er-top");
    const lb = top.createDiv("er-ibtn");
    svgIcon(lb, "arrow-left");
    lb.addEventListener("click", () => this.plugin.openLibrary());
    this.titleEl = top.createDiv("er-top-title");
    this.titleEl.setText("Book reader");
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
    const saveBtn = tr.createDiv("er-ibtn");
    svgIcon(saveBtn, "save");
    saveBtn.setAttribute("aria-label", __ertr("Save position"));
    saveBtn.addEventListener("click", () => this.saveNow());
    const refBtn = tr.createDiv("er-ibtn");
    svgIcon(refBtn, "refresh");
    refBtn.setAttribute("aria-label", __ertr("Refresh (redraw the view)"));
    refBtn.addEventListener("click", () => this.reloadView());
    const hlBtn = tr.createDiv("er-ibtn");
    svgIcon(hlBtn, "highlighter");
    hlBtn.setAttribute("aria-label", __ertr("Highlights"));
    hlBtn.addEventListener("click", () => this.togglePanel("highlights"));
    const findBtn = tr.createDiv("er-ibtn");
    svgIcon(findBtn, "search");
    findBtn.setAttribute("aria-label", __ertr("Search the book"));
    findBtn.addEventListener("click", () => {
      this.togglePanel("find");
      if (this._findInput) erAutoFocus(this._findInput, 60);
    });
    const tocBtn = tr.createDiv("er-ibtn");
    svgIcon(tocBtn, "list");
    tocBtn.setAttribute("aria-label", __ertr("Table of contents"));
    tocBtn.addEventListener("click", () => this.togglePanel("toc"));
    const setBtn = tr.createDiv("er-ibtn");
    svgIcon(setBtn, "sliders");
    setBtn.setAttribute("aria-label", __ertr("Reading settings"));
    setBtn.addEventListener("click", () => new ReadSettingsModal(this.app, this).open());
    this.areaEl = root.createDiv("er-area");
    if ((this.plugin.settings.navMode || "buttons") === "click") root.addClass("er-navclick");
    const bot = root.createDiv("er-bot");
    const pv = bot.createDiv("er-navbtn er-navbtn-prev");
    svgIcon(pv, "chevron-left");
    pv.setAttribute("aria-label", __ertr("Previous page"));
    pv.addEventListener("click", () => this.nav("prev"));

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
      new GoToPageModal(this.app, this.pager.total, this.pager.spread, (n) => {
        const [cur, tot] = this.pager.jumpTo(n - 1);
        this.updateUI(cur, tot);
        this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
      }).open();
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
        this.updateUI(cur, tot);
        this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
      }).open();
    });

    const nx = bot.createDiv("er-navbtn er-navbtn-next");
    svgIcon(nx, "chevron-right");
    nx.setAttribute("aria-label", __ertr("Next page"));
    nx.addEventListener("click", () => this.nav("next"));

    if (this._clockTimer) window.clearInterval(this._clockTimer);
    this._clockTimer = window.setInterval(() => {
      if (this.clockEl) this.clockEl.setText(this._getCurrentTimeStr());
    }, 10000);
    this.overlayEl = root.createDiv("er-overlay");
    this.overlayEl.addEventListener("click", () => this.closePanel());
    this.settPan = root.createDiv("er-panel");
    this.tocPan = root.createDiv("er-panel er-toc-panel");
    this.hlPan = root.createDiv("er-panel er-toc-panel er-hl-panel");
    this.findPan = root.createDiv("er-panel er-toc-panel er-find-panel");
    this.buildSettPanel();
    this.buildTocPanel();
    this.buildHlPanel();
    this.buildFindPanel();
    this.hlPopup = root.createDiv("er-hl-popup");
    this.buildHlPopup();
    this.registerDomEvent(docOf(this.containerEl), "selectionchange", () => this._scheduleSelCheck());
    this.areaEl.addEventListener("mouseup", () => this._scheduleSelCheck());
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
      } else if (this._editHlId) {
        this._hideHlPopup();
      }
    });
    this.registerDomEvent(docOf(this.containerEl), "mousedown", (e) => {
      if (!this._editHlId) return;
      const t = e.target;
      if (this.hlPopup.contains(t)) return;
      if (t instanceof HTMLElement && t.closest(".er-hl")) return;
      this._hideHlPopup();
    });
    this.areaEl.addEventListener("contextmenu", (e) => {
      const sel = selOf(this.areaEl);
      const text = sel && !sel.isCollapsed && sel.rangeCount ? sel.toString() : "";
      const flow = this.pager.flow;
      if (!text.trim() || !flow || !flow.contains(sel.getRangeAt(0).startContainer)) return;
      e.preventDefault();
      const menu = new Menu();
      menu.addItem((it) => it.setTitle(__ertr("Copy as a quote")).setIcon("text-quote").onClick(async () => {
        this._hideHlPopup();
        const md = quoteMarkdown(this.plugin, { text, block: this._pendingSel && this._pendingSel.block, page: this._pendingSel && this._pendingSel.page }, this.file);
        const okc = md && await copyToClipboard(md);
        new Notice(okc ? __ertr("Quote copied ✓ — paste it into any note") : __ertr("Could not copy"));
      }));
      menu.addItem((it) => it.setTitle(__ertr("Create new note")).setIcon("file-plus").onClick(() => {
        this._hideHlPopup();
        createNoteFromSelection(this.app, this.plugin, text, this.file);
      }));
      menu.addItem((it) => it.setTitle(__ertr("As text into the book note")).setIcon("text-quote").onClick(() => {
        this._hideHlPopup();
        sendQuoteToBookNote(this, { text, block: this._pendingSel && this._pendingSel.block });
      }));
      menu.addSeparator();
      HL_COLORS.forEach((c) => {
        menu.addItem((it) => it.setTitle(__ertr("Highlight: {0}", c.name)).onClick(() => {
          this._onSelectionCheck();
          this._applyPopupColor(c.id);
        }));
      });
      menu.showAtMouseEvent(e);
    });
    this.registerDomEvent(docOf(this.containerEl), "keydown", (e) => {
      if (!this.bookHtml)
        return;
      const ae = docOf(this.areaEl).activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable))
        return;
      if (!this.containerEl.contains(ae) && this.app.workspace.getActiveViewOfType(this.constructor) !== this)
        return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        this.nav("next");
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        this.nav("prev");
      }
    });
    let sx = 0, sy = 0, _swipeDir = null, _longPress = false, _lpTimer = null, _hadSel = false;
    this.areaEl.addEventListener("touchstart", (e) => {
      if (e.touches.length > 1) {
        _swipeDir = "v";
        return;
      }
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      _swipeDir = null;
      _longPress = false;
      const sel = selOf(this.areaEl);
      _hadSel = !!(sel && !sel.isCollapsed);
      window.clearTimeout(_lpTimer);
      _lpTimer = window.setTimeout(() => {
        _longPress = true;
      }, 350);
    }, { passive: true });
    this.areaEl.addEventListener("touchmove", (e) => {
      if (_swipeDir !== null) {
        if (_swipeDir === "h") e.preventDefault();
        return;
      }
      const dx = Math.abs(e.touches[0].clientX - sx);
      const dy = Math.abs(e.touches[0].clientY - sy);
      if (dx < 8 && dy < 8) return;
      window.clearTimeout(_lpTimer);
      const sel = selOf(this.areaEl);
      if (_longPress || _hadSel || sel && !sel.isCollapsed) {
        _swipeDir = "v";
        return;
      }
      _swipeDir = dx > dy ? "h" : "v";
      if (_swipeDir === "h") e.preventDefault();
    }, { passive: false });
    this.areaEl.addEventListener("touchend", (e) => {
      window.clearTimeout(_lpTimer);
      if (_swipeDir !== "h") return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 44)
        dx < 0 ? this.nav("next") : this.nav("prev");
    }, { passive: true });
    this.areaEl.addEventListener("click", (e) => handleAreaNavClick(this, e));
    const armImmersive = () => {
      if (!this.plugin.settings.immersive) {
        root.removeClass("er-immersive");
        return;
      }
      root.removeClass("er-immersive");
      window.clearTimeout(this._immTimer);
      this._immTimer = window.setTimeout(() => {
        if (this.bookHtml) root.addClass("er-immersive");
      }, 2600);
    };
    root.addEventListener("pointermove", armImmersive);
    root.addEventListener("pointerdown", armImmersive);
    root.addEventListener("touchstart", armImmersive, { passive: true });
    armImmersive();
  }
  applyVars() {
    const t = erTheme(this.plugin.settings);
    const s = this.plugin.settings;
    const r = this.contentEl;
    r.style.setProperty("--er-bg", t.bg);
    r.style.setProperty("--er-text", t.text);
    r.style.setProperty("--er-ui", t.ui);
    r.style.setProperty("--er-border", t.border);
    r.style.setProperty("--er-accent", t.accent);
    r.style.setProperty("--er-muted", t.muted);
    r.toggleClass("er-eink", s.einkMode === true);
  }
  nav(dir) {
    if (!this.bookHtml)
      return;
    const _now = Date.now();
    if (this._lastNavTs && _now - this._lastNavTs < 90) return;
    this._lastNavTs = _now;
    this._lastActive = _now;
    if (this._layoutWidthStale()) {
      this.repaginate().then(() => this._navNow(dir)).catch(() => this._navNow(dir));
      return;
    }
    this._navNow(dir);
  }
  _navNow(dir) {
    if (!this.bookHtml) return;
    this._hideHlPopup();
    this._recordPageTurn();
    const [cur, total] = dir === "next" ? this.pager.next() : this.pager.prev();
    this.updateUI(cur, total);
    this.plugin.saveProgress(this.file.path, cur, total, this.pager.currentBlockIndex());
  }
  // True when the page is laid out for a different width than it is displayed at.
  // `builtWidth` is what the paginator actually measured, so this compares like
  // with like — the width the caller *intended* can differ from it.
  _layoutWidthStale() {
    if (!this.bookHtml || !this.pager || !this.pager.builtWidth) return false;
    if (this.containerEl.offsetParent === null) return false;
    if (this._staleGaveUpAt === this.pager.builtWidth) return false;
    const now = this.areaEl.clientWidth;
    if (!now) return false;
    return Math.abs(now - this.pager.builtWidth) >= 8;
  }
  // Manual save (💾 button / command): persist the current spot AND drop a
  // restore point, with a clear confirmation — like "saved" in a game.
  saveNow() {
    if (!this.bookHtml || !this.file) {
      new Notice(__ertr("Nothing to save"));
      return;
    }
    const cur = this.pager.spread, tot = this.pager.total;
    const pct = this.plugin.saveNow(this.file.path, cur, tot, this.pager.currentBlockIndex());
    new Notice(__ertr("Saved ✓ — {0}%", pct));
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
  updateUI(cur, total) {
    if (this.contentEl) this.contentEl.toggleClass("er-scrolling", !!(this.pager && this.pager.scrollMode));
    const pct = total > 0 ? Math.round((cur + 1) / total * 100) : 0;
    if (this.pbarFill) this.pbarFill.style.width = `${pct}%`;
    const bookPage = currentBookPage(this);
    const where = this.ext === "pdf" ? __ertr("Spread {0} of {1}", cur + 1, total) : `${cur + 1} / ${total}`;
    if (this.locEl) this.locEl.setText(bookPage ? __ertr("p. {0}", bookPage) + " · " + where : where);
    if (this.pctEl) this.pctEl.setText(`${pct}%`);
    if (this.clockEl) this.clockEl.setText(this._getCurrentTimeStr());
    this._updateTimeLeft(cur, total);
    renderVisibleFigures(this);
  }
  // ── Settings panel ────────────────────────────────────
  buildSettPanel() {
    const p = this.settPan;
    p.empty();
    p.createDiv("er-pan-title").setText(__ertr("Reading settings"));
    const sec = (l) => p.createDiv("er-pan-sec").setText(l);
    sec(__ertr("Theme"));
    const thRow = p.createDiv("er-theme-row");
    ["auto", "dark", "light", "sepia", "eink"].forEach((t) => {
      const btn = thRow.createDiv(`er-theme-btn er-theme-${t}`);
      btn.setText({ auto: __ertr("Match Obsidian"), dark: __ertr("Dark"), light: __ertr("Light"), sepia: __ertr("Sepia"), eink: "E-ink" }[t]);
      if (this.plugin.settings.theme === t)
        btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.theme = t;
        await this.plugin.saveAll();
        this.applyVars();
        if (this.bookHtml)
          await this.repaginate();
        thRow.querySelectorAll(".er-theme-btn").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    sec(__ertr("Font size"));
    const szRow = p.createDiv("er-sz-row");
    const szM = szRow.createDiv("er-sz-btn");
    szM.setText("A−");
    const szL = szRow.createDiv("er-sz-label");
    szL.setText(`${this.plugin.settings.fontSize}px`);
    const szP = szRow.createDiv("er-sz-btn");
    szP.setText("A+");
    const changeSz = async (d) => {
      const nv = this.plugin.settings.fontSize + d;
      if (nv < 12 || nv > 36)
        return;
      this.plugin.settings.fontSize = nv;
      szL.setText(`${nv}px`);
      await this.plugin.saveAll();
      if (this.bookHtml)
        await this.repaginate();
    };
    szM.addEventListener("click", () => changeSz(-1));
    szP.addEventListener("click", () => changeSz(1));
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
    Object.keys(FONTS).forEach((f) => {
      const btn = ffRow.createDiv("er-ff-btn");
      btn.setText(f.charAt(0).toUpperCase() + f.slice(1));
      btn.style.fontFamily = FONTS[f];
      if (this.plugin.settings.fontFamily === f)
        btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.fontFamily = f;
        await this.plugin.saveAll();
        if (this.bookHtml)
          await this.repaginate();
        ffRow.querySelectorAll(".er-ff-btn").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    secA(__ertr("Line spacing"));
    const lhRow = adv.createDiv("er-lh-row");
    [1.4, 1.6, 1.8, 2.1].forEach((lh) => {
      const btn = lhRow.createDiv("er-lh-btn");
      btn.setText(`${lh}`);
      if (Math.abs(this.plugin.settings.lineHeight - lh) < 0.05)
        btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.lineHeight = lh;
        await this.plugin.saveAll();
        if (this.bookHtml)
          await this.repaginate();
        lhRow.querySelectorAll(".er-lh-btn").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    });
    secA(__ertr("Pages side by side"));
    const colRow = adv.createDiv("er-col-row");
    [["1", __ertr("1 page")], ["2", __ertr("2 pages")]].forEach(([v, label]) => {
      const btn = colRow.createDiv("er-col-btn");
      btn.setText(label);
      if (this.plugin.settings.columns === v)
        btn.addClass("active");
      btn.addEventListener("click", async () => {
        this.plugin.settings.columns = v;
        await this.plugin.saveAll();
        if (this.bookHtml)
          await this.repaginate();
        colRow.querySelectorAll(".er-col-btn").forEach((b) => b.removeClass("active"));
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
    sec(__ertr("Actions"));
    const actRow = p.createDiv("er-act-row");
    const mkAct = (label, ic, fn) => {
      const b = actRow.createDiv("er-act-btn");
      iconLabel(b, ic, label);
      b.addEventListener("click", fn);
    };
    mkAct(__ertr("Help"), "info", () => new InfoModal(this.app, this.plugin, this.file).open());
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
        const total = this.pager.total;
        let target;
        if (typeof snap.block === "number" && snap.block >= 0) {
          target = this.pager.spreadForBlock(snap.block);
        } else {
          const frac = typeof snap.pct === "number" ? snap.pct : (snap.percent || 0) / 100;
          target = Math.round(frac * Math.max(0, total - 1));
        }
        const [cur, tot] = this.pager.jumpTo(target);
        this.updateUI(cur, tot);
        if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
        this.closePanel();
        new Notice(__ertr("Jumped back to {0}%", snap.percent));
      });
    });
  }
  buildTocPanel() {
    this._tocRender = buildTocPanelFor(this, this.tocPan, {
      close: () => this.closePanel(),
      jump: (b) => this._jumpToBlock(b)
    });
  }
  // Find text anywhere in the open book. Results are block indexes — the same
  // anchor reading position and the contents list use — so a hit lands correctly
  // whatever the window width or column count.
  buildFindPanel() {
    buildFindPanelFor(this, this.findPan, {
      close: () => this.closePanel(),
      jump: (b) => this._jumpToBlock(b)
    });
  }
  togglePanel(name) {
    if (this.panelOpen === name) {
      this.closePanel();
      return;
    }
    this._hideHlPopup();
    if (name === "highlights") this.buildHlPanel();
    if (name === "settings") this._renderHistory();
    if (name === "toc" && this._tocRender) this._tocRender();
    this.panelOpen = name;
    this.settPan.classList.toggle("er-panel-open", name === "settings");
    this.tocPan.classList.toggle("er-panel-open", name === "toc");
    this.findPan.classList.toggle("er-panel-open", name === "find");
    this.hlPan.classList.toggle("er-panel-open", name === "highlights");
    if (this.findPan) this.findPan.classList.toggle("er-panel-open", name === "find");
    if (name === "toc" && this._tocRender) this._tocRender();
    this.overlayEl.classList.add("er-overlay-on");
  }
  closePanel() {
    this.panelOpen = null;
    this.settPan.classList.remove("er-panel-open");
    this.tocPan.classList.remove("er-panel-open");
    this.hlPan.classList.remove("er-panel-open");
    if (this.findPan) this.findPan.classList.remove("er-panel-open");
    this.overlayEl.classList.remove("er-overlay-on");
  }
  // ── Refresh: save progress + rebuild cleanly (kills stray column) ──────
  async reloadView() {
    if (!this.bookHtml || !this.file) {
      new Notice(__ertr("Nothing to refresh"));
      return;
    }
    const cur = this.pager.spread, tot = this.pager.total;
    this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    const pct = this.pager.currentPct;
    this._hideHlPopup();
    this.closePanel();
    await this.plugin.refreshHighlights();
    this._lastWidth = this.areaEl.clientWidth;
    await this.paginate(pct);
    new Notice(__ertr("Refreshed"));
  }
  // ── Highlights: render / select / navigate ────────────
  _renderFlowHighlights() {
    if (!this.file || !this.pager.flow) return;
    const flow = this.pager.flow;
    unwrapAllHighlights(flow);
    const blocks = flow.querySelectorAll("p,h1,h2,h3,h4");
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
    this._selTimer = window.setTimeout(() => this._onSelectionCheck(), 60);
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
    this._showHlPopup(erSelectionRect(range, this.areaEl));
  }
  buildHlPopup() {
    const pop = this.hlPopup;
    pop.empty();
    pop.addEventListener("mousedown", (e) => e.preventDefault());
    addBarButtons(this, pop);
    addMoreBtn(this, pop);
  }
  _applyPopupColor(colorId) {
    let _a, _b;
    if (this._editHlId && this.file) {
      const id = this._editHlId;
      this.plugin.setHighlightColor(this.file.path, id, colorId);
      (_a = this.pager.flow) == null ? void 0 : _a.querySelectorAll(`[data-hl-id="${id}"]`).forEach((s) => {
        s.style.background = hlColorCss(colorId);
      });
      if (this.panelOpen === "highlights") this.buildHlPanel();
      this._hideHlPopup();
      return;
    }
    if (this._pendingSel && this.file) {
      const parts = this._pendingSel.parts || [this._pendingSel];
      const made = [];
      for (const part of parts) {
        const id = this._createHighlight(part, colorId);
        if (id) made.push({ ...part, id, color: colorId });
      }
      (_b = selOf(this.areaEl)) == null ? void 0 : _b.removeAllRanges();
      if (this.panelOpen === "highlights") this.buildHlPanel();
      if (this.plugin.settings.quotesToBookNote === true && made.length) {
        for (const hl of made) sendQuoteToBookNote(this, hl);
      }
    }
    this._hideHlPopup();
  }
  // Save a highlight for a pending selection and paint it in the text.
  // Returns its id — the comment button needs it, because commenting on a plain
  // selection has to create the highlight first (otherwise the note had nothing
  // to attach to and silently vanished).
  _createHighlight(sel, colorId) {
    if (!sel || !this.file) return null;
    const id = "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const hl = { id, color: colorId, text: sel.text, block: sel.block, occ: sel.occ, pre: sel.pre, post: sel.post, created: Date.now() };
    this.plugin.addHighlight(this.file.path, hl);
    const blocks = this.pager.flow.querySelectorAll("p,h1,h2,h3,h4");
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
    let _a;
    const span = (_a = this.pager.flow) == null ? void 0 : _a.querySelector(`[data-hl-id="${id}"]`);
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
    positionHlPopup(this, rect, 210, 44);
  }
  _hideHlPopup() {
    erClearPaintedSelection();
    this._pendingSel = null;
    this._editHlId = null;
    if (this.hlPopup) this.hlPopup.classList.remove("er-hl-popup-on");
  }
  goToHighlight(id) {
    const flow = this.pager.flow;
    const span = flow == null ? void 0 : flow.querySelector(`[data-hl-id="${id}"]`);
    if (!span) {
      const hl = this.file ? this.plugin.getHighlights(this.file.path).find((h) => h.id === id) : null;
      if (!hl || typeof hl.block !== "number") {
        new Notice(__ertr("Highlight not found"));
        return;
      }
      const [c2, t2] = this.pager.jumpTo(this.pager.spreadForBlock(hl.block));
      this.updateUI(c2, t2);
      if (this.file) this.plugin.saveProgress(this.file.path, c2, t2, this.pager.currentBlockIndex());
      this.closePanel();
      window.requestAnimationFrame(() => {
        const later = this.pager.flow?.querySelector(`[data-hl-id="${id}"]`);
        if (later) {
          later.classList.add("er-hl-flash");
          window.setTimeout(() => later.classList.remove("er-hl-flash"), 1200);
        }
      });
      return;
    }
    const rel = span.getBoundingClientRect().left - flow.getBoundingClientRect().left;
    const spread = Math.max(0, Math.floor(rel / this.pager.sw + 1e-3));
    const [cur, tot] = this.pager.jumpTo(spread);
    this.updateUI(cur, tot);
    if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
    this.closePanel();
    span.classList.add("er-hl-flash");
    window.setTimeout(() => span.classList.remove("er-hl-flash"), 1200);
  }
  buildHlPanel() {
    const p = this.hlPan;
    p.empty();
    p.createDiv("er-pan-title").setText(__ertr("Highlights"));
    const list = this.file ? this.plugin.getHighlights(this.file.path) : [];
    if (!list.length) {
      p.createDiv("er-toc-empty").setText(__ertr("No highlights yet.\nSelect text and pick a color."));
      return;
    }
    const exp = p.createDiv("er-hl-export");
    iconLabel(exp, "download", __ertr("Export to notes ({0})", list.length));
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
          createNoteFromSelection(this.app, this.plugin, hl.text, this.file, { extra: hlCommentMd(hl), color: hl.color, hl });
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
      del.setAttribute("aria-label", __ertr("Delete"));
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!this.file) return;
        this.plugin.removeHighlight(this.file.path, hl.id);
        this._unwrapHighlight(hl.id);
        this.buildHlPanel();
      });
      item.addEventListener("click", () => this.goToHighlight(hl.id));
      item.addEventListener("contextmenu", showHlMenu);
    });
  }
  async onClose() {
    erHideVeil(this);
    let _a;
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
    window.clearTimeout(this._immTimer);
    (_a = this._resizeObs) == null ? void 0 : _a.disconnect();
    window.clearTimeout(this._resizeTimer);
    window.clearTimeout(this._selTimer);
    window.clearTimeout(this._revealT);
    clearFoundIn(this);
  }
}
