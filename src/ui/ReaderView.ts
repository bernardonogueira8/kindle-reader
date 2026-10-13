import { ItemView, TFile, Menu, Notice, Platform } from "obsidian";
import { WithBaseReader, setupReaderGestures } from "./BaseReader";
import { __ertr } from "../utils/i18n";
import { svgIcon, docOf, selOf } from "../utils/icons";
import { HL_COLORS } from "../utils/theme";
import { erAutoFocus } from "../utils/dom";
import { GoToPageModal, ReadSettingsModal } from "./modals";
import { VIEW_TYPE } from "../types";
import { extractEpub } from "../reader/EpubExtractor";
import { extractFb2 } from "../reader/Fb2Extractor";
import { extractPdf } from "../reader/PdfExtractor";
import {
  toggleTimerSession,
  stopReadingTimer,
  resetTimerSession,
  updateTimerBtn,
  updateGoalBar,
  copyToClipboard,
  openImageLightbox,
  erHideVeil,
  followFootnote,
  clearFoundIn,
  buildTocItems,
  createNoteFromSelection,
  addBookFileMenu,
  quoteMarkdown,
  sendQuoteToBookNote
} from "../main";

export class ReaderView extends WithBaseReader(ItemView) {
  _resizeTimer: unknown = null;
  _lastWidth = 0;

  constructor(leaf: unknown, plugin: unknown) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  // The tab's "..." menu. A book opened in the reader used to have none of the
  // things every other file in Obsidian offers there — reveal in the folder
  // tree, rename, move, delete — which readers reported as the reader "taking
  // the file hostage". These come from Obsidian itself, so they stay correct.
  onPaneMenu(menu: unknown, source: unknown) {
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

  async setState(state: unknown, result: unknown) {
    await super.setState(state, result);
    const s = state as Record<string, unknown> | null;
    const path5 = typeof s?.file === "string" ? s.file : typeof s?.path === "string" ? s.path : null;
    if (!path5)
      return;
    this.buildDOM();
    if (this.file && this.file.path === path5 && this.bookHtml)
      return;
    const f = this.app.vault.getAbstractFileByPath(path5);
    if (f instanceof TFile)
      await this.openFile(f);
  }

  async onOpen() {
    this.buildDOM();
    if (!this.areaEl) return;
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

  async openFile(file: TFile) {
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
    this.buildDOM();
    this.titleEl?.setText(file.basename);
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
        const epubMeta: Record<string, unknown> = {};
        this.bookHtml = await extractEpub(file, this.app, epubMeta);
        this._epubToc = (epubMeta.toc as unknown[]) || null;
      } else if (this.ext === "fb2") {
        this._epubToc = null;
        this.bookHtml = await extractFb2(file, this.app);
      } else {
        this._epubToc = null;
        const res = await extractPdf(file, this.app, this.plugin.settings, (i: number, n: number) => loadText.setText(__ertr("Preparing the book… {0}%", Math.round(i / n * 100))));
        this.bookHtml = res.html;
        this._pdfLazy = res.lazy;
        this._pdfOutline = res.outline;
      }

      this.tocItems = buildTocItems(this.bookHtml, this._pdfOutline, this._epubToc);
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
      this.initWakeLock();
    } catch (e: unknown) {
      console.error("Kindle Reader:", e);
      new Notice(__ertr("Error opening the file"));
    }
  }

  // ── DOM ──────────────────────────────────────────────
  buildDOM() {
    const root = this.contentEl;
    if (!root) return;
    if (this.areaEl && root.contains(this.areaEl)) return;
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
    const bmBtn = tr.createDiv("er-ibtn er-b-bookmark");
    svgIcon(bmBtn, "bookmark");
    bmBtn.setAttribute("aria-label", __ertr("Bookmark"));
    bmBtn.addEventListener("click", () => this.toggleBookmark());
    bmBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.openBookmarksModal();
    });
    this.bookmarkBtn = bmBtn;
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
    this._buildHlPopup();
    this.registerDomEvent(docOf(this.containerEl), "selectionchange", () => this._scheduleSelCheck());
    this.areaEl.addEventListener("mouseup", () => this._scheduleSelCheck());
    this.areaEl.addEventListener("click", (e) => {
      const refEl = e.target instanceof HTMLElement ? e.target.closest("[data-er-ref], a.er-ilink, a[href]") : null;
      if (refEl) {
        const ref = refEl.getAttribute("data-er-ref") || refEl.getAttribute("href");
        if (ref) {
          if (/^https?:\/\//i.test(ref)) {
            window.open(ref, "_blank");
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (followFootnote(this, ref)) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }
      const imgEl = e.target instanceof HTMLElement ? e.target.closest("img") : null;
      if (imgEl && (imgEl.currentSrc || imgEl.src)) {
        e.preventDefault();
        e.stopPropagation();
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
      if (this.hlPopup.contains(t as Node)) return;
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
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || (ae as HTMLElement).isContentEditable))
        return;
      if (!this.containerEl.contains(ae) && this.app.workspace.getActiveViewOfType(this.constructor as unknown) !== this)
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
    setupReaderGestures(this, root, this.areaEl);
    this.initBookmarkRibbon();
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

  async onClose() {
    this.releaseWakeLock();
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
