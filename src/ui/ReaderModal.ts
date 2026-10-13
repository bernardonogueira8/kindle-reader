import { Modal, Menu, Notice, Platform, TFile } from "obsidian";
import { WithBaseReader, setupReaderGestures } from "./BaseReader";
import { __ertr } from "../utils/i18n";
import { svgIcon, docOf } from "../utils/icons";
import { erAutoFocus } from "../utils/dom";
import { GoToPageModal, ReadSettingsModal } from "./modals";
import { extractEpub } from "../reader/EpubExtractor";
import { extractFb2 } from "../reader/Fb2Extractor";
import { extractPdf } from "../reader/PdfExtractor";
import {
  toggleTimerSession,
  stopReadingTimer,
  resetTimerSession,
  updateTimerBtn,
  updateGoalBar,
  openImageLightbox,
  followFootnote,
  clearFoundIn,
  buildTocItems,
  addBookFileMenu
} from "../main";

export class ReaderModal extends WithBaseReader(Modal) {
  _closeWatch: MutationObserver | null = null;
  _lastW = 0;
  _rsT: unknown = null;
  _armImmersive: unknown = null;

  constructor(app: unknown, plugin: unknown, file: TFile) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    this.ext = file.extension === "epub" ? "epub" : file.extension === "fb2" ? "fb2" : "pdf";
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
      if (this.scope && Array.isArray((this.scope as unknown).keys)) {
        (this.scope as unknown).keys = (this.scope as unknown).keys.filter((k: unknown) => String(k && k.key).toLowerCase() !== "escape");
      }
    } catch {
      // ignore
    }
    modalEl.addClass("er-fullscreen-modal");
    this.containerEl.addClass("er-fullscreen-container");
    contentEl.addClass("er-fullscreen-content");
    const CLOSE_BTNS = ".modal-close-button, .modal-header-button";
    const dropStrayCloses = (all: boolean) => {
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
    this.titleEl.setText(this.file ? this.file.basename : "");
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
    this.bookmarkBtn = bmBtn;
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
      menu.addItem((it) => it.setTitle(__ertr("Bookmarks")).setIcon("bookmark").onClick(() => this.openBookmarksModal()));
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
      if (this.file) addBookFileMenu(this.app, menu, this.file);
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
          if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
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
        if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
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
      } else if (this._editHlId) this._hideHlPopup();
    });
    setupReaderGestures(this, root, this.areaEl);
    this.initBookmarkRibbon();
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
      if (!this.file) return;
      if (this.ext === "epub") {
        const epubMeta: Record<string, unknown> = {};
        this.bookHtml = await extractEpub(this.file, this.app, epubMeta);
        this._epubToc = (epubMeta.toc as unknown[]) || null;
      } else if (this.ext === "fb2") {
        this._epubToc = null;
        this.bookHtml = await extractFb2(this.file, this.app);
      } else {
        this._epubToc = null;
        const res = await extractPdf(this.file, this.app, this.plugin.settings, (i: number, n: number) => loadText.setText(__ertr("Preparing the book… {0}%", Math.round(i / n * 100))));
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
      await this.paginate(pct, saved == null ? void 0 : saved.block);
      this._buildSettPanel();
      this._maybePromptBookNote(this.file);
      this.initWakeLock();
    } catch (e: unknown) {
      console.error("ReaderModal:", e);
      this.areaEl.empty();
      this.areaEl.createEl("p", { cls: "er-load-error", text: __ertr("Error: {0}", e.message) });
    }
  }

  onClose() {
    this.releaseWakeLock();
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
}
