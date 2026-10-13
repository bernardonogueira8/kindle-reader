import { Menu, Notice, Platform, TFile } from "obsidian";
import { Paginator } from "../reader/Paginator";
import { __ertr } from "../utils/i18n";
import { svgIcon, iconLabel, selOf } from "../utils/icons";
import { erTheme, FONTS, hlColorCss } from "../utils/theme";
import { bookNoteAction } from "../utils/notes";
import { BookSetupModal, InfoModal, BookmarksModal } from "./modals";
import { BookmarkEntry } from "../types";
import {
  erRevealWhenSettled,
  erPaintSelection,
  erClearPaintedSelection,
  positionHlPopup,
  markFoundIn,
  clearFoundIn,
  buildFindPanelFor,
  buildTocPanelFor,
  enrichHighlights,
  currentBookPage,
  sendQuoteToBookNote,
  renderVisibleFigures,
  offsetInBlock,
  countOccurrencesBefore,
  locateHl,
  unwrapAllHighlights,
  wrapBlockRange,
  createNoteFromSelection,
  hlCommentMd,
  exportHighlightsMenu,
  addBarButtons,
  addMoreBtn,
  erShowVeil,
  erHideVeil,
  panelSection,
  buildReaderExtraSettings,
  handleAreaNavClick
} from "../main";

export type GConstructor<T = {}> = new (...args: unknown[]) => T;

export function WithBaseReader<TBase extends GConstructor<unknown>>(Base: TBase) {
  return class BaseReader extends Base {
    file: TFile | null = null;
    ext: string | null = null;
    pager: Paginator = new Paginator();
    bookHtml = "";
    tocItems: unknown[] = [];
    panelOpen: string | null = null;
    plugin: unknown;

    _pendingSel: unknown = null;
    _editHlId: string | null = null;
    timeLeftEl: HTMLElement | null = null;
    clockEl: HTMLElement | null = null;
    locEl: HTMLElement | null = null;
    pctEl: HTMLElement | null = null;
    pbarFill: HTMLElement | null = null;
    titleEl: HTMLElement | null = null;
    areaEl!: HTMLElement;
    overlayEl!: HTMLElement;
    settPan!: HTMLElement;
    tocPan!: HTMLElement;
    hlPan!: HTMLElement;
    findPan!: HTMLElement;
    hlPopup!: HTMLElement;
    szLabel: HTMLElement | null = null;
    timerBtnEl: HTMLElement | null = null;
    timerIconEl: HTMLElement | null = null;
    timerLabelEl: HTMLElement | null = null;
    timerResetEl: HTMLElement | null = null;
    bookmarkBtn: HTMLElement | null = null;
    bookmarkRibbonEl: HTMLElement | null = null;

    _clockTimer: unknown = null;
    _pageTurnTimes: number[] = [];
    _lastTurnTime: number | null = null;
    _timeLeftMode = "time";
    _lastNavTs = 0;
    _lastActive = 0;
    _laidOutWidth = 0;
    _staleGaveUpAt: number | null = null;
    _sessionSec = 0;
    _running = false;
    _goalNotified = false;
    _timerInterval: unknown = null;
    _pdfLazy: unknown = null;
    _pdfOutline: unknown = null;
    _epubToc: unknown = null;
    _tocRender: unknown = null;
    _histRow: HTMLElement | null = null;
    _findQuery: string | null = null;
    _findCorpus: string | null = null;
    _selHandler: unknown = null;
    _selDoc: unknown = null;
    _selTimer: unknown = null;
    _immTimer: unknown = null;
    _revealT: unknown = null;
    _resizeObs: ResizeObserver | null = null;
    _spinEl: HTMLElement | null = null;
    _findInput: HTMLInputElement | null = null;

    constructor(...args: unknown[]) {
      super(...args);
      this.pager.onSpreadChange = (cur: number, tot: number) => {
        (this.updateUI || this._updateUI).call(this, cur, tot);
        if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
      };
    }

    _getCurrentTimeStr(): string {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    }

    _startClockTimer(): void {
      if (this._clockTimer) window.clearInterval(this._clockTimer);
      this._clockTimer = window.setInterval(() => {
        if (this.clockEl) this.clockEl.setText(this._getCurrentTimeStr());
      }, 15000);
    }

    _stopClockTimer(): void {
      if (this._clockTimer) {
        window.clearInterval(this._clockTimer);
        this._clockTimer = null;
      }
    }

    _recordPageTurn(): void {
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

    _getChapterSpreadsLeft(curSpread: number, totalSpreads: number): { spreadsLeft: number; chapterTitle: string } {
      if (!this.pager) {
        return { spreadsLeft: Math.max(0, totalSpreads - (curSpread + 1)), chapterTitle: "" };
      }
      const curBlock = typeof this.pager.currentBlockIndex === "function" ? this.pager.currentBlockIndex() : -1;
      const items = (this.tocItems || []).filter((x: unknown) => typeof x.block === "number").sort((a: unknown, b: unknown) => a.block - b.block);

      if (!items.length) {
        return { spreadsLeft: Math.max(0, totalSpreads - (curSpread + 1)), chapterTitle: "" };
      }

      let activeIdx = -1;
      for (let i = 0; i < items.length; i++) {
        const spr = typeof this.pager.spreadForBlock === "function" ? this.pager.spreadForBlock(items[i].block) : null;
        if (typeof spr === "number") {
          if (spr <= curSpread) activeIdx = i;
          else break;
        } else if (items[i].block <= curBlock) {
          activeIdx = i;
        } else {
          break;
        }
      }

      const activeTitle = activeIdx >= 0 ? items[activeIdx].label : "";

      if (activeIdx >= 0 && activeIdx + 1 < items.length) {
        const nextSpr = typeof this.pager.spreadForBlock === "function" ? this.pager.spreadForBlock(items[activeIdx + 1].block) : null;
        if (typeof nextSpr === "number") {
          const spreadsLeft = Math.max(0, nextSpr - curSpread);
          return { spreadsLeft, chapterTitle: activeTitle };
        }
      }

      const spreadsLeft = Math.max(0, totalSpreads - (curSpread + 1));
      return { spreadsLeft, chapterTitle: activeTitle };
    }

    _toggleTimeLeftDisplay(): void {
      const modes = ["chapter_time", "book_time", "chapter_pages", "book_pages"];
      const current = this.plugin?.settings?.timeLeftMode || this._timeLeftMode || "chapter_time";
      const idx = modes.indexOf(current);
      const nextMode = modes[(idx + 1) % modes.length];
      this._timeLeftMode = nextMode;
      if (this.plugin?.settings) {
        this.plugin.settings.timeLeftMode = nextMode;
        void this.plugin.saveAll();
      }
      if (this.pager) {
        this._updateTimeLeft(this.pager.spread, this.pager.total);
      }
    }

    _updateTimeLeft(cur: number, total: number): void {
      if (!this.timeLeftEl) return;
      if (total == null || total <= 0) {
        this.timeLeftEl.setText("");
        return;
      }
      const remainingBookSpreads = Math.max(0, total - (cur + 1));
      if (remainingBookSpreads === 0) {
        this.timeLeftEl.setText(__ertr("Finished"));
        return;
      }

      const mode = this.plugin?.settings?.timeLeftMode || this._timeLeftMode || "chapter_time";
      const chInfo = this._getChapterSpreadsLeft(cur, total);

      let secPerSpread = 65;
      if (this._pageTurnTimes && this._pageTurnTimes.length >= 2) {
        const sum = this._pageTurnTimes.reduce((a, b) => a + b, 0);
        secPerSpread = Math.max(20, Math.min(180, Math.round(sum / this._pageTurnTimes.length)));
      }

      const formatTime = (mins: number, suffix: string) => {
        if (mins < 1) return __ertr("< 1 min") + " " + suffix;
        if (mins < 60) return `${mins} min ${suffix}`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m === 0 ? `${h} h ${suffix}` : `${h} h ${m} min ${suffix}`;
      };

      if (mode === "chapter_time") {
        const chMins = Math.round((chInfo.spreadsLeft * secPerSpread) / 60);
        this.timeLeftEl.setText(formatTime(chMins, __ertr("in chapter")));
        this.timeLeftEl.setAttribute("aria-label", __ertr("Time left in chapter"));
      } else if (mode === "book_time") {
        const bookMins = Math.round((remainingBookSpreads * secPerSpread) / 60);
        this.timeLeftEl.setText(formatTime(bookMins, __ertr("in book")));
        this.timeLeftEl.setAttribute("aria-label", __ertr("Time left in book"));
      } else if (mode === "chapter_pages") {
        this.timeLeftEl.setText(__ertr("{0} pages in chapter", chInfo.spreadsLeft));
        this.timeLeftEl.setAttribute("aria-label", __ertr("Pages left in chapter"));
      } else {
        this.timeLeftEl.setText(__ertr("{0} pages in book", remainingBookSpreads));
        this.timeLeftEl.setAttribute("aria-label", __ertr("Pages left in book"));
      }
    }

    _getBookmarks(): BookmarkEntry[] {
      if (!this.file || !this.plugin?.settings?.bookmarks) return [];
      return this.plugin.settings.bookmarks[this.file.path] || [];
    }

    _isBookmarked(spread?: number): boolean {
      const s = spread !== undefined ? spread : (this.pager ? this.pager.current : 0);
      const bms = this._getBookmarks();
      return bms.some((b: BookmarkEntry) => b.spread === s);
    }

    async toggleBookmark(): Promise<void> {
      if (!this.file) return;
      if (!this.plugin.settings.bookmarks) {
        this.plugin.settings.bookmarks = {};
      }
      const path = this.file.path;
      let bms = this.plugin.settings.bookmarks[path] || (this.plugin.settings.bookmarks[path] = []);
      const cur = this.pager ? this.pager.current : 0;
      const existingIndex = bms.findIndex((b: BookmarkEntry) => b.spread === cur);

      if (existingIndex >= 0) {
        bms.splice(existingIndex, 1);
        this.plugin.settings.bookmarks[path] = bms;
        await this.plugin._saveLocalData();
        this._updateBookmarkUI(cur);
        new Notice(__ertr("Bookmark removed"));
      } else {
        const page = currentBookPage(this) || cur + 1;
        const chInfo = this._getChapterSpreadsLeft(cur);
        const chapter = chInfo && chInfo.chapterTitle ? chInfo.chapterTitle : undefined;
        const startBlock = this.pager && this.pager.spreads && this.pager.spreads[cur] ? this.pager.spreads[cur].startBlock : 0;

        let title: string | undefined;
        const curSpreadEl = this.areaEl?.querySelector?.(".er-spread");
        if (curSpreadEl) {
          const text = curSpreadEl.textContent?.replace(/\s+/g, " ")?.trim();
          if (text) {
            title = text.length > 60 ? text.slice(0, 60) + "…" : text;
          }
        }

        const newBm: BookmarkEntry = {
          id: "bm_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
          spread: cur,
          block: startBlock,
          page,
          chapter,
          title,
          created: Date.now()
        };
        bms.push(newBm);
        bms.sort((a: BookmarkEntry, b: BookmarkEntry) => a.spread - b.spread);
        this.plugin.settings.bookmarks[path] = bms;
        await this.plugin._saveLocalData();
        this._updateBookmarkUI(cur);
        new Notice(__ertr("Bookmark added"));
      }
    }

    _updateBookmarkUI(cur?: number): void {
      if (cur === undefined) cur = this.pager ? this.pager.current : 0;
      const isBm = this._isBookmarked(cur);
      if (this.bookmarkBtn) {
        this.bookmarkBtn.toggleClass("active", isBm);
        this.bookmarkBtn.setAttribute("aria-label", isBm ? __ertr("Remove bookmark") : __ertr("Add bookmark"));
      }
      if (this.bookmarkRibbonEl) {
        this.bookmarkRibbonEl.toggleClass("visible", isBm);
        this.bookmarkRibbonEl.setAttribute("aria-label", isBm ? __ertr("Page bookmarked — click to remove") : "");
      }
    }

    initBookmarkRibbon(): void {
      if (!this.areaEl) return;
      if (this.bookmarkRibbonEl) {
        this.bookmarkRibbonEl.remove();
      }
      this.bookmarkRibbonEl = this.areaEl.createDiv("er-bookmark-ribbon");
      svgIcon(this.bookmarkRibbonEl, "bookmark");
      this.bookmarkRibbonEl.addEventListener("click", (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        this.toggleBookmark();
      });
      this._updateBookmarkUI();
    }

    openBookmarksModal(): void {
      new BookmarksModal(this.app, this).open();
    }

    updateUI(cur: number, total: number): void {
      if (this.contentEl) this.contentEl.toggleClass("er-scrolling", !!(this.pager && this.pager.scrollMode));
      const pct = total > 0 ? Math.round((cur + 1) / total * 100) : 0;
      if (this.pbarFill) this.pbarFill.style.width = `${pct}%`;
      const bookPage = currentBookPage(this);
      const where = this.ext === "pdf" ? __ertr("Spread {0} of {1}", cur + 1, total) : `${cur + 1} / ${total}`;
      if (this.locEl) this.locEl.setText(bookPage ? __ertr("p. {0}", bookPage) + " · " + where : where);
      if (this.pctEl) this.pctEl.setText(`${pct}%`);
      if (this.clockEl) this.clockEl.setText(this._getCurrentTimeStr());
      this._updateTimeLeft(cur, total);
      this._updateBookmarkUI(cur);
      renderVisibleFigures(this);
    }

    _updateUI(cur: number, total: number): void {
      this.updateUI(cur, total);
    }

    applyVars(): void {
      const t = erTheme(this.plugin.settings);
      const s = this.plugin.settings;
      const targets = [this.contentEl, (this as unknown).modalEl].filter(Boolean);
      for (const el of targets) {
        el.style.setProperty("--er-bg", t.bg);
        el.style.setProperty("--er-text", t.text);
        el.style.setProperty("--er-ui", t.ui);
        el.style.setProperty("--er-border", t.border);
        el.style.setProperty("--er-accent", t.accent);
        el.style.setProperty("--er-muted", t.muted);
        el.toggleClass("er-eink", s.einkMode === true);
      }
    }

    _applyTheme(): void {
      this.applyVars();
    }

    _setRelayout(on: boolean): void {
      if (!on) erHideVeil(this);
      const root = (this as unknown).contentEl;
      if (!root) return;
      if (on && !this._spinEl) {
        this._spinEl = root.createDiv("er-relayout-spin");
        this._spinEl.createDiv("er-relayout-ring");
      }
      root.toggleClass("er-relayouting", !!on);
    }

    _layoutWidthStale(): boolean {
      if (!this.bookHtml || !this.areaEl) return false;
      const w = this.areaEl.clientWidth;
      if (!w) return false;
      const container = (this as unknown).containerEl;
      if (container && container.offsetParent === null) return false;
      if (this._staleGaveUpAt && Math.abs(w - this._staleGaveUpAt) < 8) return false;
      return Math.abs(w - (this._laidOutWidth || 0)) >= 8;
    }

    async paginate(savedPct = 0, savedBlock: number | null = null): Promise<void> {
      if (!this.areaEl) return;
      this.areaEl.empty();
      let w = this.areaEl.clientWidth, a = 0;
      while (!w && a < 60) {
        await new Promise((r) => window.requestAnimationFrame(r));
        w = this.areaEl.clientWidth;
        a++;
      }
      if (!w) {
        w = this.areaEl.clientWidth || ((this as unknown).containerEl?.clientWidth) || 400;
      }
      this.areaEl.addClass("er-booting");
      erShowVeil(this);
      window.setTimeout(() => {
        if (this.areaEl) this.areaEl.removeClass("er-booting");
        erHideVeil(this);
      }, 3000);
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

    async repaginate(): Promise<void> {
      if (!this.bookHtml) return;
      if (!this.areaEl || !this.areaEl.clientWidth || (this as unknown).containerEl?.offsetParent === null) return;
      const savedBlock = this.pager.currentBlockIndex();
      const savedPct = this.pager.currentPct;
      if (typeof (this as unknown)._setRelayout === "function") (this as unknown)._setRelayout(true);
      this.areaEl.addClass("er-booting");
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
        const targetSpread = typeof savedBlock === "number" && savedBlock >= 0
          ? this.pager.spreadForBlock(savedBlock)
          : Math.round(savedPct * Math.max(0, total - 1));
        this._renderFlowHighlights();
        const [cur, tot] = this.pager.jumpTo(targetSpread);
        this.updateUI(cur, tot);
        if (this._tocRender) this._tocRender();
        this._findCorpus = null;
        if (this._foundQuery) this._markFound(this._foundQuery);
      } finally {
        erRevealWhenSettled(this);
        if (typeof (this as unknown)._setRelayout === "function") {
          window.requestAnimationFrame(() => (this as unknown)._setRelayout(false));
        }
      }
    }

    async _repaginate(): Promise<void> {
      await this.repaginate();
    }

    async _applyContentStyle(): Promise<void> {
      await this.repaginate();
    }

    nav(dir: "next" | "prev"): void {
      if (!this.bookHtml) return;
      const _now = Date.now();
      if (this._lastNavTs && _now - this._lastNavTs < 90) return;
      this._lastNavTs = _now;
      this._lastActive = _now;
      if (typeof (this as unknown)._layoutWidthStale === "function" && (this as unknown)._layoutWidthStale()) {
        this.repaginate().then(() => this._navNow(dir)).catch(() => this._navNow(dir));
        return;
      }
      this._navNow(dir);
    }

    _nav(dir: "next" | "prev"): void {
      this.nav(dir);
    }

    _navNow(dir: "next" | "prev"): void {
      if (!this.bookHtml) return;
      this._hideHlPopup();
      this._recordPageTurn();
      const [cur, total] = dir === "next" ? this.pager.next() : this.pager.prev();
      this.updateUI(cur, total);
      if (this.file) this.plugin.saveProgress(this.file.path, cur, total, this.pager.currentBlockIndex());
    }

    saveNow(): void {
      if (!this.bookHtml || !this.file) {
        new Notice(__ertr("Nothing to save"));
        return;
      }
      const cur = this.pager.spread;
      const tot = this.pager.total;
      const pct = this.plugin.saveNow(this.file.path, cur, tot, this.pager.currentBlockIndex());
      new Notice(__ertr("Saved ✓ — {0}%", pct));
      if (this.panelOpen === "settings") this._renderHistory();
    }

    exportHighlights(evt: MouseEvent): void {
      if (!this.file) {
        new Notice(__ertr("No book is open"));
        return;
      }
      const list = enrichHighlights(this, this.plugin.getHighlights(this.file.path));
      exportHighlightsMenu((this as unknown).app, this.plugin, this.file, list, evt);
    }

    _flashBlock(idx: number): void {
      const el = this.pager.blockEl(idx);
      if (!el) return;
      el.classList.remove("er-resume-flash");
      void el.offsetWidth;
      el.classList.add("er-resume-flash");
      window.setTimeout(() => el?.classList.remove("er-resume-flash"), 2400);
    }

    _jumpToBlock(block: number, flash = true): void {
      if (!this.bookHtml || typeof block !== "number") return;
      const [cur, tot] = this.pager.jumpTo(this.pager.spreadForBlock(block));
      this.updateUI(cur, tot);
      if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
      if (flash) this._flashBlock(block);
    }

    jumpToPdfPageWhenReady(pageNo: number): void {
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

    jumpToBlockWhenReady(idx: number): void {
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

    _maybePromptBookNote(file: TFile): void {
      const s = this.plugin.settings;
      if (!file) return;
      if (!s.bookNoteLinks) s.bookNoteLinks = {};
      if (!s.bookNotePrompted) s.bookNotePrompted = {};
      const action = bookNoteAction(s, file.path);
      if (action === "linked" || action === "prompted") return;
      if (action === "auto") {
        s.bookNotePrompted[file.path] = true;
        this.plugin.ensureBookNote(file).then((note: unknown) => {
          if (note) new Notice(__ertr("Book note created: {0}", note.basename));
          if (this.panelOpen === "settings" && typeof (this as unknown).buildSettPanel === "function") {
            (this as unknown).buildSettPanel();
          }
        });
        return;
      }
      new BookSetupModal((this as unknown).app, this.plugin, file, () => {
        if (this.panelOpen === "settings" && typeof (this as unknown).buildSettPanel === "function") {
          (this as unknown).buildSettPanel();
        }
      }).open();
    }

    _markFound(query: string): void {
      markFoundIn(this, query);
    }

    _clearFound(): void {
      clearFoundIn(this);
    }

    _buildTocPanel(): void {
      this._tocRender = buildTocPanelFor(this, this.tocPan, {
        close: () => this.closePanel(),
        jump: (b: number) => this._jumpToBlock(b)
      });
    }

    buildTocPanel(): void {
      this._buildTocPanel();
    }

    _buildFindPanel(): void {
      buildFindPanelFor(this, this.findPan, {
        close: () => this.closePanel(),
        jump: (b: number) => this._jumpToBlock(b)
      });
    }

    buildFindPanel(): void {
      this._buildFindPanel();
    }

    togglePanel(name: string): void {
      if (this.panelOpen === name) {
        this.closePanel();
        return;
      }
      this._hideHlPopup();
      if (name === "highlights") this.buildHlPanel();
      if (name === "settings") this._renderHistory();
      if (name === "toc" && this._tocRender) this._tocRender();
      this.panelOpen = name;
      if (this.settPan) this.settPan.classList.toggle("er-panel-open", name === "settings");
      if (this.tocPan) this.tocPan.classList.toggle("er-panel-open", name === "toc");
      if (this.hlPan) this.hlPan.classList.toggle("er-panel-open", name === "highlights");
      if (this.findPan) this.findPan.classList.toggle("er-panel-open", name === "find");
      if (this.overlayEl) this.overlayEl.classList.add("er-overlay-on");
    }

    _togglePanel(name: string): void {
      this.togglePanel(name);
    }

    closePanel(): void {
      this.panelOpen = null;
      if (this.settPan) this.settPan.classList.remove("er-panel-open");
      if (this.tocPan) this.tocPan.classList.remove("er-panel-open");
      if (this.hlPan) this.hlPan.classList.remove("er-panel-open");
      if (this.findPan) this.findPan.classList.remove("er-panel-open");
      if (this.overlayEl) this.overlayEl.classList.remove("er-overlay-on");
    }

    _closePanel(): void {
      this.closePanel();
    }

    async reloadView(): Promise<void> {
      if (!this.bookHtml || !this.file) {
        new Notice(__ertr("Nothing to refresh"));
        return;
      }
      const cur = this.pager.spread, tot = this.pager.total;
      this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
      this._hideHlPopup();
      this.closePanel();
      await this.plugin.refreshHighlights();
      if ((this as unknown)._lastWidth && this.areaEl) {
        (this as unknown)._lastWidth = this.areaEl.clientWidth;
      }
      await this.repaginate();
      new Notice(__ertr("Refreshed"));
    }

    buildSettPanel(): void {
      const p = this.settPan;
      if (!p) return;
      p.empty();
      p.createDiv("er-pan-title").setText(__ertr("Reading settings"));
      const sec = (l: string) => p.createDiv("er-pan-sec").setText(l);
      sec(__ertr("Theme"));
      const thRow = p.createDiv("er-theme-row");
      ["auto", "dark", "light", "sepia", "eink"].forEach((t) => {
        const btn = thRow.createDiv(`er-theme-btn er-theme-${t}`);
        btn.setText({ auto: __ertr("Match Obsidian"), dark: __ertr("Dark"), light: __ertr("Light"), sepia: __ertr("Sepia"), eink: "E-ink" }[t] || t);
        if (this.plugin.settings.theme === t) btn.addClass("active");
        btn.addEventListener("click", async () => {
          this.plugin.settings.theme = t;
          await this.plugin.saveAll();
          this.applyVars();
          if (this.bookHtml) await this.repaginate();
          thRow.querySelectorAll(".er-theme-btn").forEach((b) => b.removeClass("active"));
          btn.addClass("active");
        });
      });
      sec(__ertr("Font size"));
      const szRow = p.createDiv("er-sz-row");
      const szM = szRow.createDiv("er-sz-btn");
      szM.setText("A−");
      this.szLabel = szRow.createDiv("er-sz-label");
      this.szLabel.setText(`${this.plugin.settings.fontSize}px`);
      const szP = szRow.createDiv("er-sz-btn");
      szP.setText("A+");
      const changeSz = async (d: number) => {
        const nv = Math.min(36, Math.max(12, this.plugin.settings.fontSize + d));
        this.plugin.settings.fontSize = nv;
        if (this.szLabel) this.szLabel.setText(`${nv}px`);
        await this.plugin.saveAll();
        if (this.bookHtml) await this.repaginate();
      };
      szM.addEventListener("click", () => changeSz(-1));
      szP.addEventListener("click", () => changeSz(1));
      const advHdr = p.createDiv("er-pan-adv-hdr");
      advHdr.createSpan({ cls: "er-pan-adv-ic", text: "⚙️" });
      advHdr.createSpan({ cls: "er-pan-adv-lbl", text: __ertr("More settings") });
      const advCar = advHdr.createSpan({ cls: "er-pan-adv-car", text: "›" });
      const advWrap = p.createDiv("er-pan-adv");
      const adv = advWrap.createDiv("er-pan-adv-body");
      const secA = (l: string) => adv.createDiv("er-pan-sec").setText(l);
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
        if (this.plugin.settings.fontFamily === f) btn.addClass("active");
        btn.addEventListener("click", async () => {
          this.plugin.settings.fontFamily = f;
          await this.plugin.saveAll();
          if (this.bookHtml) await this.repaginate();
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
          if (this.bookHtml) await this.repaginate();
          lhRow.querySelectorAll(".er-lh-btn").forEach((b) => b.removeClass("active"));
          btn.addClass("active");
        });
      });
      if (!Platform || !Platform.isPhone) {
        secA(__ertr("Pages side by side"));
        const colRow = adv.createDiv("er-col-row");
        [["1", __ertr("1 page")], ["2", __ertr("2 pages")]].forEach(([v, label]) => {
          const btn = colRow.createDiv("er-col-btn");
          btn.setText(label);
          if (this.plugin.settings.columns === v) btn.addClass("active");
          btn.addEventListener("click", async () => {
            this.plugin.settings.columns = v;
            await this.plugin.saveAll();
            if (this.bookHtml) await this.repaginate();
            colRow.querySelectorAll(".er-col-btn").forEach((b) => b.removeClass("active"));
            btn.addClass("active");
          });
        });
      }
      buildReaderExtraSettings(this, adv);
      this._histRow = panelSection(this, p, {
        label: __ertr("Jump back"),
        emoji: "🔖",
        settingKey: "readerHistOpen"
      }).createDiv("er-hist-row");
      this._renderHistory();
      sec(__ertr("Actions"));
      const actRow = p.createDiv("er-act-row");
      const actBtn = actRow.createDiv("er-act-btn");
      iconLabel(actBtn, "info", __ertr("Help"));
      actBtn.addEventListener("click", () => {
        this.closePanel();
        new InfoModal((this as unknown).app, this.plugin, this.file).open();
      });
    }

    _buildSettPanel(): void {
      this.buildSettPanel();
    }

    _renderHistory(): void {
      const c = this._histRow;
      if (!c) return;
      c.empty();
      const list = this.file ? this.plugin.getBackups(this.file.path) : [];
      const badge = c.parentElement && (c.parentElement as unknown)._erCount;
      if (badge) badge.setText(list.length ? String(list.length) : "");
      if (!list.length) {
        c.createDiv("er-hist-empty").setText(__ertr("No points yet"));
        return;
      }
      [...list].reverse().slice(0, 14).forEach((snap: unknown) => {
        const chip = c.createDiv("er-hist-chip");
        if (snap.manual) chip.addClass("er-hist-manual");
        const d = new Date(snap.ts || snap.lastRead || Date.now());
        const mark = snap.manual ? "💾 " : "";
        chip.setText(`${mark}${snap.percent}% · ${d.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`);
        chip.addEventListener("click", () => {
          if (!this.bookHtml) return;
          this.closePanel();
          if (typeof snap.block === "number" && snap.block >= 0) {
            this._jumpToBlock(snap.block);
          } else {
            const frac = typeof snap.pct === "number" ? snap.pct : (snap.percent || 0) / 100;
            const [cur, tot] = this.pager.jumpTo(Math.round(frac * Math.max(0, this.pager.total - 1)));
            this.updateUI(cur, tot);
            if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
          }
          new Notice(__ertr("Returned to {0}%", snap.percent));
        });
      });
    }

    _renderFlowHighlights(): void {
      if (!this.file || !this.pager.flow) return;
      unwrapAllHighlights(this.pager.flow);
      const blocks = this.pager.flow.querySelectorAll("p,h1,h2,h3,h4");
      const list = this.plugin.getHighlights(this.file.path);
      for (const hl of list) {
        const block = blocks[hl.block];
        if (!block) continue;
        const text = block.textContent || "";
        const loc = locateHl(text, hl);
        if (!loc) continue;
        wrapBlockRange(block, loc.start, loc.start + loc.len, { id: hl.id, color: hlColorCss(hl.color) });
      }
    }

    _scheduleSelCheck(): void {
      window.clearTimeout(this._selTimer);
      this._selTimer = window.setTimeout(() => this._onSelectionCheck(), 80);
    }

    _onSelectionCheck(): void {
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
      let node: Node | null = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const block = node.instanceOf(Element) ? node.closest("p,h1,h2,h3,h4") : null;
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
      const parts: unknown[] = [];
      for (let bi = blockIndex; bi < blocks.length; bi++) {
        const b = blocks[bi];
        if (bi > blockIndex && !range.intersectsNode(b)) break;
        const bText = b.textContent || "";
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

    _buildHlPopup(): void {
      const pop = this.hlPopup;
      if (!pop) return;
      pop.empty();
      pop.addEventListener("mousedown", (e) => e.preventDefault());
      addBarButtons(this, pop);
      addMoreBtn(this, pop);
    }

    buildHlPopup(): void {
      this._buildHlPopup();
    }

    _applyPopupColor(colorId: string): void {
      if (this._editHlId && this.file) {
        const id = this._editHlId;
        this.plugin.setHighlightColor(this.file.path, id, colorId);
        this.pager.flow?.querySelectorAll(`[data-hl-id="${id}"]`).forEach((s: unknown) => {
          s.style.background = hlColorCss(colorId);
        });
        if (this.panelOpen === "highlights") this.buildHlPanel();
        this._hideHlPopup();
        return;
      }
      if (this._pendingSel && this.file) {
        const parts = this._pendingSel.parts || [this._pendingSel];
        for (const part of parts) this._createHighlight(part, colorId);
        selOf(this.areaEl)?.removeAllRanges();
        if (this.panelOpen === "highlights") this.buildHlPanel();
      }
      this._hideHlPopup();
    }

    _createHighlight(sel: unknown, colorId: string): string | null {
      if (!sel || !this.file) return null;
      const id = "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const hl = {
        id,
        color: colorId,
        text: sel.text,
        block: sel.block,
        occ: sel.occ,
        pre: sel.pre,
        post: sel.post,
        created: Date.now()
      };
      this.plugin.addHighlight(this.file.path, hl);
      const blocks = this.pager.flow ? this.pager.flow.querySelectorAll("p,h1,h2,h3,h4") : [];
      const block = blocks[hl.block];
      if (block) {
        const t = block.textContent || "";
        const loc = locateHl(t, hl);
        if (loc) wrapBlockRange(block, loc.start, loc.start + loc.len, { id: hl.id, color: hlColorCss(colorId) });
      }
      return id;
    }

    _currentHl(): { text: string; block: number; color: string | null } | null {
      if (this._editHlId && this.file) {
        const hl = this.plugin.getHighlights(this.file.path).find((h: unknown) => h.id === this._editHlId);
        if (hl) return { text: hl.text || "", block: hl.block, color: hl.color };
      }
      if (this._pendingSel) return { text: this._pendingSel.text || "", block: this._pendingSel.block, color: null };
      return null;
    }

    _openHlEdit(id: string): void {
      const span = this.pager.flow?.querySelector(`[data-hl-id="${id}"]`);
      if (!span) return;
      this._pendingSel = null;
      this._editHlId = id;
      this._showHlPopup(span.getBoundingClientRect());
    }

    _unwrapHighlight(id: string): void {
      const flow = this.pager.flow;
      if (!flow) return;
      flow.querySelectorAll(`[data-hl-id="${id}"]`).forEach((span) => {
        const parent2 = span.parentNode;
        if (!parent2) return;
        while (span.firstChild) parent2.insertBefore(span.firstChild, span);
        parent2.removeChild(span);
        parent2.normalize();
      });
    }

    _showHlPopup(rect: DOMRect): void {
      const pop = this.hlPopup;
      pop.classList.add("er-hl-popup-on");
      positionHlPopup(this, rect, 230, 46);
    }

    _hideHlPopup(): void {
      erClearPaintedSelection();
      this._pendingSel = null;
      this._editHlId = null;
      if (this.hlPopup) this.hlPopup.classList.remove("er-hl-popup-on");
    }

    goToHighlight(id: string): void {
      const hl = this.file ? this.plugin.getHighlights(this.file.path).find((h: unknown) => h.id === id) : null;
      if (!hl) return;
      this.closePanel();
      const [cur, tot] = this.pager.jumpTo(this.pager.spreadForBlock(hl.block));
      this.updateUI(cur, tot);
      if (this.file) this.plugin.saveProgress(this.file.path, cur, tot, this.pager.currentBlockIndex());
      window.requestAnimationFrame(() => {
        const span = this.pager.flow?.querySelector(`[data-hl-id="${id}"]`);
        if (span) {
          span.classList.add("er-hl-flash");
          window.setTimeout(() => span.classList.remove("er-hl-flash"), 1200);
        }
      });
    }

    buildHlPanel(): void {
      const p = this.hlPan;
      if (!p) return;
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
      list.forEach((hl: unknown) => {
        const item = wrap.createDiv("er-hl-item");
        const dot = item.createDiv("er-hl-dot");
        dot.style.background = hlColorCss(hl.color);
        const body = item.createDiv("er-hl-body");
        const txt = body.createDiv("er-hl-text");
        txt.setText(hl.text.length > 160 ? hl.text.slice(0, 160) + "…" : hl.text);
        if (hl.comment) body.createDiv("er-hl-comment").setText(hl.comment);
        const showHlMenu = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (!this.file) return;
          const menu = new Menu();
          menu.addItem((it) => it.setTitle(__ertr("Create note")).setIcon("file-plus").onClick(() => {
            createNoteFromSelection((this as unknown).app, this.plugin, hl.text, this.file, { extra: hlCommentMd(hl), color: hl.color });
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
          this.buildHlPanel();
        });
        item.addEventListener("click", () => this.goToHighlight(hl.id));
        item.addEventListener("contextmenu", showHlMenu);
      });
    }

    _wakeLock: ScreenWakeLockManager | null = null;

    initWakeLock(): void {
      if (this.plugin.settings.keepScreenAwake !== false) {
        if (!this._wakeLock) {
          this._wakeLock = new ScreenWakeLockManager(true);
        }
        void this._wakeLock.acquire();
      }
    }

    releaseWakeLock(): void {
      if (this._wakeLock) {
        void this._wakeLock.release();
        this._wakeLock = null;
      }
    }

    _buildHlPanel(): void {
      this.buildHlPanel();
    }
  };
}

export class ScreenWakeLockManager {
  private sentinel: unknown = null;
  private isAcquiring = false;
  private visibilityListener: (() => void) | null = null;
  private enabled = true;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      void this.acquire();
    } else {
      void this.release();
    }
  }

  async acquire(): Promise<void> {
    if (!this.enabled) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    if (this.sentinel && !this.sentinel.released) return;
    if (this.isAcquiring) return;

    this.isAcquiring = true;
    try {
      this.sentinel = await (navigator as unknown).wakeLock.request("screen");
      this.sentinel.addEventListener("release", () => {
        this.sentinel = null;
      });

      if (!this.visibilityListener && typeof document !== "undefined") {
        this.visibilityListener = () => {
          if (document.visibilityState === "visible" && this.enabled) {
            void this.acquire();
          }
        };
        document.addEventListener("visibilitychange", this.visibilityListener);
      }
    } catch (e) {
      console.debug("Kindle Reader: Screen wake lock could not be acquired", e);
    } finally {
      this.isAcquiring = false;
    }
  }

  async release(): Promise<void> {
    if (this.visibilityListener && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityListener);
      this.visibilityListener = null;
    }
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch {
        /* ignore */
      }
      this.sentinel = null;
    }
  }
}


export function setupReaderGestures(reader: unknown, rootEl: HTMLElement, areaEl: HTMLElement): void {
  let sx = 0, sy = 0, dir: "h" | "v" | null = null;
  let longPress = false, lpTimer: unknown = null, hadSel = false;
  let pinching = false, initDist = 0, initFontSize = 18;
  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
  let singleTapTimer: unknown = null;
  let toastEl: HTMLElement | null = null;
  let toastHideTimer: unknown = null;

  const showZoomToast = (text: string) => {
    if (toastHideTimer) window.clearTimeout(toastHideTimer);
    if (!toastEl) {
      toastEl = areaEl.createDiv("er-zoom-toast");
    }
    toastEl.removeClass("er-zoom-toast-hiding");
    toastEl.setText(text);
  };

  const hideZoomToast = () => {
    if (toastHideTimer) window.clearTimeout(toastHideTimer);
    toastHideTimer = window.setTimeout(() => {
      if (toastEl) {
        toastEl.addClass("er-zoom-toast-hiding");
        window.setTimeout(() => {
          if (toastEl) {
            toastEl.remove();
            toastEl = null;
          }
        }, 260);
      }
    }, 450);
  };

  areaEl.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      pinching = true;
      dir = "v";
      initDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initFontSize = reader.plugin.settings.fontSize || 18;
      window.clearTimeout(lpTimer);
      return;
    }

    if (e.touches.length > 2) {
      dir = "v";
      return;
    }

    pinching = false;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    dir = null;
    longPress = false;
    const sel = selOf(areaEl);
    hadSel = !!(sel && !sel.isCollapsed);
    window.clearTimeout(lpTimer);
    lpTimer = window.setTimeout(() => {
      longPress = true;
    }, 350);
  }, { passive: true });

  areaEl.addEventListener("touchmove", (e) => {
    if (pinching && e.touches.length === 2) {
      e.preventDefault();
      const currDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (initDist > 0) {
        const ratio = currDist / initDist;
        const targetSize = Math.min(36, Math.max(12, Math.round(initFontSize * ratio)));
        if (targetSize !== reader.plugin.settings.fontSize) {
          reader.plugin.settings.fontSize = targetSize;
          if (reader.szLabel) reader.szLabel.setText(`${targetSize}px`);
          showZoomToast(`${targetSize}px`);
          if (reader.pager?.flow) {
            reader.pager.flow.style.fontSize = `${targetSize}px`;
          }
        }
      }
      return;
    }

    if (dir) {
      if (dir === "h") e.preventDefault();
      return;
    }

    const dx = Math.abs(e.touches[0].clientX - sx);
    const dy = Math.abs(e.touches[0].clientY - sy);
    if (dx < 8 && dy < 8) return;
    window.clearTimeout(lpTimer);
    const sel = selOf(areaEl);
    if (longPress || hadSel || (sel && !sel.isCollapsed)) {
      dir = "v";
      return;
    }
    dir = dx > dy ? "h" : "v";
    if (dir === "h") e.preventDefault();
  }, { passive: false });

  areaEl.addEventListener("touchend", async (e) => {
    window.clearTimeout(lpTimer);

    if (pinching) {
      pinching = false;
      hideZoomToast();
      await reader.plugin.saveAll();
      if (reader.bookHtml) {
        if (typeof reader.repaginate === "function") await reader.repaginate();
        else if (typeof reader._repaginate === "function") await reader._repaginate();
      }
      return;
    }

    if (dir === "h") {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 44) {
        if (typeof reader.nav === "function") reader.nav(dx < 0 ? "next" : "prev");
        else if (typeof reader._nav === "function") reader._nav(dx < 0 ? "next" : "prev");
      }
    }
  }, { passive: true });

  // Click & Double-tap
  areaEl.addEventListener("click", (e) => {
    const t = e.target;
    if (t instanceof HTMLElement && t.closest("img, .er-hl, .er-hl-popup, .er-dict-modal, button, a")) return;
    const sel = selOf(areaEl);
    if (sel && !sel.isCollapsed && sel.toString().trim()) return;

    const now = Date.now();
    const timeDiff = now - lastTapTime;
    const distDiff = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY);

    if (timeDiff > 40 && timeDiff < 320 && distDiff < 40) {
      // Double tap!
      if (singleTapTimer) {
        window.clearTimeout(singleTapTimer);
        singleTapTimer = null;
      }
      lastTapTime = 0;
      const isImm = rootEl.classList.contains("er-immersive");
      if (isImm) rootEl.classList.remove("er-immersive");
      else rootEl.classList.add("er-immersive");
      window.requestAnimationFrame(async () => {
        if (reader.bookHtml) {
          if (typeof reader.repaginate === "function") await reader.repaginate();
          else if (typeof reader._repaginate === "function") await reader._repaginate();
        }
      });
      return;
    }

    lastTapTime = now;
    lastTapX = e.clientX;
    lastTapY = e.clientY;

    if ((reader.plugin.settings.navMode || "buttons") === "click") {
      singleTapTimer = window.setTimeout(() => {
        singleTapTimer = null;
        handleAreaNavClick(reader, e);
      }, 260);
    }
  });
}
