import { Modal, App, Notice, Menu, TFile } from 'obsidian';
import { ReadingInsightsModal } from './ReadingInsights';
import * as pdfjsLib from 'pdfjs-dist';
import ePub from 'epubjs';
import {
  setupWorker,
  decodeFb2,
  fb2Href,
  addBookFileMenu,
  deleteBookFromVault,
  resolveBookNote,
  bookNoteLinkFor
} from '../main';
import { __ertr } from '../utils/i18n';
import { svgIcon, docOf } from '../utils/icons';
import { erLibTheme } from '../utils/theme';
import { erPath } from '../utils/path';
import { erAutoFocus, erBlurOnTapOutside } from '../utils/dom';
import {
  buildLibChips,
  filterLibBooks,
  bookTagsOf,
  pluralBooks,
  LibChip
} from '../utils/library';

export class LibraryModal extends Modal {
  plugin: unknown;
  _grid: HTMLElement | null = null;
  _dropBound = false;
  _coverResizeObs: ResizeObserver | null = null;
  _thumbQueue: Promise<unknown> | null = null;
  _thumbDirty = false;
  _thumbSaveT: number | undefined = undefined;

  constructor(app: App, plugin: unknown) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen(): Promise<void> {
    const { contentEl, modalEl } = this;

    this.containerEl.addClass("er-modal-lib");
    modalEl.addClass("er-modal-lib");
    contentEl.addClass("er-lib");

    const t = erLibTheme(this.plugin.settings);
    modalEl.style.setProperty("--er-lib-bg", t.bg);
    modalEl.style.setProperty("--er-lib-text", t.text);
    modalEl.style.setProperty("--er-lib-card", t.ui);
    modalEl.style.setProperty("--er-lib-border", t.border);
    modalEl.style.setProperty("--er-lib-accent", t.accent);
    modalEl.style.setProperty("--er-lib-muted", t.muted);

    const hdr = contentEl.createDiv("er-lib-hdr");
    const brand = hdr.createDiv("er-lib-brand");
    brand.createDiv("er-lib-logo").setText("\u{1F4DA}");
    const hw = brand.createDiv("er-lib-hw");
    hw.createDiv("er-lib-title").setText(__ertr("Library"));
    hw.createDiv("er-lib-sub").setText("Kindle reader");

    const addBtn = hdr.createDiv("er-lib-add");
    addBtn.setAttribute("role", "button");
    addBtn.setAttribute("tabindex", "0");
    addBtn.setAttribute("aria-label", __ertr("Add a book"));
    svgIcon(addBtn, "plus");
    addBtn.createSpan({ cls: "er-lib-add-label", text: __ertr("Add a book") });

    const doPick = () => this._pickBooks();
    addBtn.addEventListener("click", doPick);
    addBtn.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        doPick();
      }
    });

    this._setupDropZone();

    const search = hdr.createDiv("er-lib-search");
    const sIc = search.createDiv("er-lib-search-ic");
    svgIcon(sIc, "search");
    const input = search.createEl("input", {
      cls: "er-lib-search-input",
      attr: { type: "text", placeholder: __ertr("Search a book…"), spellcheck: "false" }
    });
    const count = hdr.createDiv("er-lib-count");

    const sizeWrap = hdr.createDiv("er-lib-size");
    const applySize = () => {
      const px = Math.max(110, Math.min(300, this.plugin.settings.libCoverSize || 176));
      if (this._grid) {
        this._grid.style.gridTemplateColumns = `repeat(auto-fill,minmax(${px}px,1fr))`;
      }
    };

    const mkSz = (label: string, d: number, aria: string) => {
      const b = sizeWrap.createDiv("er-lib-szbtn");
      b.setText(label);
      b.setAttribute("aria-label", aria);
      b.addEventListener("click", async () => {
        this.plugin.settings.libCoverSize = Math.max(
          110,
          Math.min(300, (this.plugin.settings.libCoverSize || 176) + d)
        );
        applySize();
        window.requestAnimationFrame(() => this._sizeCovers());
        await this.plugin.saveAll();
      });
    };
    mkSz("−", -28, __ertr("Smaller covers"));
    mkSz("+", 28, __ertr("Larger covers"));

    const statsBtn = hdr.createDiv("er-lib-szbtn er-lib-stats-btn");
    svgIcon(statsBtn, "flame");
    statsBtn.setAttribute("aria-label", __ertr("Reading insights & heatmap"));
    statsBtn.addEventListener("click", () => new ReadingInsightsModal(this.app, this.plugin).open());

    await this.plugin.refreshProgress();
    const folder = erPath(this.plugin.settings.booksFolder);
    const prefix = folder ? folder + "/" : "";
    const files = this.app.vault.getFiles().filter(
      (f: TFile) =>
        (f.extension === "epub" || f.extension === "pdf" || f.extension === "fb2") &&
        (prefix === "" || f.path.startsWith(prefix))
    );

    if (!files.length) {
      const e = contentEl.createDiv("er-lib-empty");
      e.createDiv("er-lib-empty-icon").setText("\u{1F5C2}");
      e.createDiv("er-lib-empty-text").setText(__ertr("No books"));
      e.createDiv("er-lib-empty-hint").setText(folder || __ertr("All vault folders"));

      const cta = e.createDiv("er-lib-empty-add");
      cta.setAttribute("role", "button");
      cta.setAttribute("tabindex", "0");
      svgIcon(cta, "plus");
      cta.createSpan({ text: __ertr("Add a book") });
      const goCta = () => this._pickBooks();
      cta.addEventListener("click", goCta);
      cta.addEventListener("keydown", (ev: KeyboardEvent) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          goCta();
        }
      });
      return;
    }

    files.sort((a: TFile, b: TFile) => {
      const pa = this.plugin.getProgress(a.path)?.lastRead ?? 0;
      const pb = this.plugin.getProgress(b.path)?.lastRead ?? 0;
      return pb !== pa ? pb - pa : a.basename.localeCompare(b.basename);
    });

    const chipsRow = contentEl.createDiv("er-lib-chips");
    const grid = contentEl.createDiv("er-lib-grid");
    this._grid = grid;
    applySize();

    const getProg = (p: string) => this.plugin.getProgress(p);
    const getTags = (p: string) => bookTagsOf(this.plugin.settings, p);

    let active = this.plugin.settings.libCategory || "all";
    let chips = buildLibChips(files, folder, getProg, getTags, active);
    if (!chips.some((c: LibChip) => c.id === active)) {
      active = "all";
      chips = buildLibChips(files, folder, getProg, getTags, active);
    }

    const render = (q: string) => {
      grid.empty();
      const shown = filterLibBooks(files, active, q, folder, getProg, getTags);
      count.setText(`${shown.length} ${pluralBooks(shown.length)}`);
      if (!shown.length) {
        grid.createDiv("er-lib-noresult").setText(__ertr("Nothing found"));
        return;
      }
      for (const f of shown) this.renderCard(grid, f);

      window.requestAnimationFrame(() => this._sizeCovers());
      [120, 350, 650].forEach((t) => window.setTimeout(() => this._sizeCovers(), t));
    };

    const drawChips = () => {
      chips = buildLibChips(files, folder, getProg, getTags, active);
      chipsRow.empty();
      if (chips.length <= 1) {
        chipsRow.addClass("er-hidden");
        return;
      }
      chipsRow.removeClass("er-hidden");
      chips.forEach((c: LibChip) => {
        const el = chipsRow.createDiv("er-lib-chip");
        if (c.sub) el.addClass("er-lib-chip-sub");
        el.createSpan({ text: c.label });
        el.createSpan({ cls: "er-lib-chip-n", text: String(c.count) });
        if (c.id === active) el.addClass("er-lib-chip-on");
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        const pick = async () => {
          active = c.id;
          this.plugin.settings.libCategory = c.id;
          await this.plugin._saveLocalData();
          drawChips();
          render(input.value);
        };
        el.addEventListener("click", pick);
        el.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick();
          }
        });
      });
    };

    drawChips();
    input.addEventListener("input", () => render(input.value));
    render("");

    this._coverResizeObs = new ResizeObserver(() => this._sizeCovers());
    this._coverResizeObs.observe(grid);

    erAutoFocus(input, 60);
    erBlurOnTapOutside(this.contentEl, input);
  }

  _pickBooks(): void {
    const doc = docOf(this.contentEl);
    const inp = doc.win.createEl("input");
    inp.type = "file";
    inp.accept = ".pdf,.epub,.fb2,application/pdf,application/epub+zip";
    inp.multiple = true;
    inp.addClass("er-hidden");
    inp.addEventListener("change", async () => {
      const files = Array.from(inp.files || []);
      inp.remove();
      await this._importBooks(files);
    });
    doc.body.appendChild(inp);
    inp.click();
  }

  _setupDropZone(): void {
    if (this._dropBound) return;
    this._dropBound = true;
    const host = this.modalEl;
    const overlay = host.createDiv("er-lib-drop");
    const inner = overlay.createDiv("er-lib-drop-inner");
    svgIcon(inner, "plus");
    inner.createSpan({ text: __ertr("Drop the files to add them to your library") });

    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");

    host.addEventListener("dragenter", (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      host.addClass("er-lib-dragging");
    });
    host.addEventListener("dragover", (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    host.addEventListener("dragleave", (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) host.removeClass("er-lib-dragging");
    });
    host.addEventListener("drop", async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      host.removeClass("er-lib-dragging");

      const items = Array.from(e.dataTransfer?.items || []);
      const dropped = Array.from(e.dataTransfer?.files || []);
      let usable = dropped;

      if (items.length === dropped.length && typeof (items[0] as unknown)?.webkitGetAsEntry === "function") {
        usable = dropped.filter((f, i) => {
          const entry = (items[i] as unknown).webkitGetAsEntry();
          return !entry || entry.isFile;
        });
        const folders = dropped.length - usable.length;
        if (folders) {
          new Notice(__ertr("Folders were skipped — drop the book files themselves ({0})", folders));
        }
      }
      await this._importBooks(usable);
    });
  }

  _targetDir(): string {
    const set = erPath(this.plugin.settings.booksFolder || "");
    if (set) return set;
    const exts = ["pdf", "epub", "fb2"];
    const counts = new Map<string, number>();
    for (const f of this.app.vault.getFiles()) {
      if (!exts.includes(f.extension)) continue;
      const dir = f.parent && f.parent.path && f.parent.path !== "/" ? f.parent.path : "";
      counts.set(dir, (counts.get(dir) || 0) + 1);
    }
    let best = "", bestN = -1;
    for (const [dir, n] of Array.from(counts.entries())) {
      if (n > bestN) {
        best = dir;
        bestN = n;
      }
    }
    return best;
  }

  _freeBookPath(dir: string, name: string): string {
    const clean = (name || "book").replace(/[\\/:*?"<>|\n\r\t]/g, "_").trim() || "book";
    const dot = clean.lastIndexOf(".");
    const base = dot > 0 ? clean.slice(0, dot) : clean;
    const ext = dot > 0 ? clean.slice(dot) : "";
    const join = (b: string) => erPath((dir ? dir + "/" : "") + b + ext);
    let p = join(base), i = 1;
    while (this.app.vault.getAbstractFileByPath(p)) {
      p = join(`${base} (${i++})`);
    }
    return p;
  }

  async _importBooks(fileList: File[]): Promise<void> {
    const exts = ["pdf", "epub", "fb2"];
    const all = fileList || [];

    const extOf = (f: File) => {
      const raw = (f && f.name) || ((f as unknown)?.path ? String((f as unknown).path).split(/[\\/]/).pop() : "");
      const n = String(raw || "").trim().replace(/[.\s]+$/, "");
      const dot = n.lastIndexOf(".");
      const e = dot > 0 ? n.slice(dot + 1).toLowerCase() : "";
      if (exts.includes(e)) return e;
      const mime = String((f && f.type) || "").toLowerCase();
      if (mime === "application/pdf") return "pdf";
      if (mime === "application/epub+zip") return "epub";
      return e;
    };

    const picked = all.filter((f) => exts.includes(extOf(f)));
    const rejected = all.filter((f) => !exts.includes(extOf(f)));

    if (rejected.length) {
      const detail = rejected
        .slice(0, 5)
        .map((f) => {
          const nm = (f && f.name) || (f as unknown)?.path || "?";
          return `${nm} [${extOf(f) || "—"}${f && f.type ? ", " + f.type : ""}]`;
        })
        .join("; ");
      console.warn("Kindle Reader: rejected on import —", rejected.map((f) => ({
        name: f && f.name,
        path: (f as unknown)?.path,
        type: f && f.type,
        size: f && f.size,
        seenAs: extOf(f)
      })));
      new Notice(__ertr("Not accepted ({0}): {1}. PDF, EPUB and FB2 are supported.", rejected.length, detail), 10000);
    }

    if (!picked.length) {
      if (!rejected.length) new Notice(__ertr("No files selected"));
      return;
    }

    const dir = this._targetDir();
    if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
      await this.app.vault.createFolder(dir).catch(() => {});
    }

    let ok = 0;
    const errors: string[] = [];
    for (const f of picked) {
      try {
        const buf = await f.arrayBuffer();
        await this.app.vault.createBinary(this._freeBookPath(dir, f.name), buf);
        ok++;
      } catch (err) {
        console.warn("Kindle Reader: could not import", f && f.name, err);
        errors.push(f.name);
      }
    }

    if (ok) {
      new Notice(
        __ertr("Books added: {0}", ok) +
        (rejected.length ? " · " + __ertr("skipped: {0}", rejected.length) : "")
      );
    }
    if (errors.length) new Notice(__ertr("Could not add: {0}", errors.join(", ")));
    if (ok) this._refresh();
  }

  _refresh(): void {
    if (this._coverResizeObs) {
      try {
        this._coverResizeObs.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.contentEl.empty();
    this.onOpen();
  }

  _sizeCovers(): void {
    if (!this._grid) return;
    this._grid.querySelectorAll<HTMLElement>(".er-lib-cover").forEach((c) => {
      const w = c.offsetWidth;
      if (!w) return;
      const h = c.offsetHeight;
      if (h < w * 1.35 || h > w * 1.65) {
        c.style.setProperty("height", Math.round(w * 1.5) + "px", "important");
      } else {
        c.style.removeProperty("height");
      }
    });
  }

  renderCard(grid: HTMLElement, file: TFile): void {
    const prog = this.plugin.getProgress(file.path);
    const pct = prog?.percent ?? 0;
    const card = grid.createDiv("er-lib-card");
    const cover = card.createDiv("er-lib-cover");
    const fits = (this.plugin.settings.coverFits ??= {});
    if (fits[file.path] === "fill") cover.addClass("er-fit-fill");

    const ph = cover.createDiv("er-lib-ph");
    ph.createDiv("er-lib-ph-ext").setText(file.extension.toUpperCase());
    ph.createDiv("er-lib-ph-init").setText(file.basename.slice(0, 2).toUpperCase());
    this.loadThumb(file, cover, ph);

    const fitBtn = cover.createDiv("er-lib-fitbtn");
    fitBtn.setAttribute("aria-label", __ertr("Cover fit"));
    const applyFit = () => {
      const fill = cover.hasClass("er-fit-fill");
      cover.style.setProperty("background-size", fill ? "cover" : "contain", "important");
      svgIcon(fitBtn, fill ? "cover-fit" : "cover-fill");
    };
    applyFit();

    fitBtn.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      const nowFill = !cover.hasClass("er-fit-fill");
      cover.toggleClass("er-fit-fill", nowFill);
      if (nowFill) fits[file.path] = "fill";
      else delete fits[file.path];
      applyFit();
      this.plugin.saveAll();
    });

    if (pct > 0) {
      const s = cover.createDiv("er-lib-strip");
      s.createDiv("er-lib-strip-fill").style.width = `${pct}%`;
    }

    const info = card.createDiv("er-lib-info");
    info.createDiv("er-lib-book-title").setText(file.basename);
    const meta = info.createDiv("er-lib-book-meta");
    if (prog?.lastRead) {
      meta.setText(
        `${pct}% · ${new Date(prog.lastRead).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short"
        })}`
      );
    } else {
      meta.setText(__ertr("Not started"));
    }

    const bookMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const menu = new Menu();
      addBookFileMenu(this.app, menu, file);
      menu.addSeparator();
      menu.addItem((it) =>
        it.setTitle(__ertr("Delete book")).setIcon("trash").onClick(() => {
          deleteBookFromVault(this.app, this.plugin, file, () => this._refresh());
        })
      );
      menu.showAtMouseEvent(e);
    };

    card.addEventListener("contextmenu", bookMenu);
    const moreBtn = cover.createDiv("er-lib-morebtn");
    moreBtn.setAttribute("aria-label", __ertr("Book actions"));
    svgIcon(moreBtn, "more");
    moreBtn.addEventListener("click", bookMenu);

    card.addEventListener("click", () => {
      this.close();
      this.plugin.openFile(file);
    });
  }

  async loadThumb(file: TFile, coverEl: HTMLElement, ph: HTMLElement): Promise<unknown> {
    const own = this.coverFromBookNote(file);
    if (own) {
      this.showImg(coverEl, ph, own);
      return;
    }

    if (this.plugin.thumbCache[file.path]) {
      this.showImg(coverEl, ph, this.plugin.thumbCache[file.path]);
      return;
    }

    this._thumbQueue = (this._thumbQueue != null ? this._thumbQueue : Promise.resolve()).then(async () => {
      if (this.plugin.thumbCache[file.path]) {
        this.showImg(coverEl, ph, this.plugin.thumbCache[file.path]);
        return;
      }
      try {
        const url =
          file.extension === "pdf"
            ? await this.makePdfThumb(file)
            : file.extension === "fb2"
            ? await this.makeFb2Thumb(file)
            : await this.makeEpubThumb(file);
        if (!url) return;
        this.plugin.thumbCache[file.path] = url;
        this._thumbDirty = true;
        this.showImg(coverEl, ph, url);
      } catch (e) {
        console.warn("Kindle Reader: cover failed for", file.path, e);
      }
    }).then(() => {
      window.clearTimeout(this._thumbSaveT);
      this._thumbSaveT = window.setTimeout(() => {
        if (this._thumbDirty) {
          this._thumbDirty = false;
          this.plugin._saveThumbCache();
        }
      }, 800);
    });
    return this._thumbQueue;
  }

  coverFromBookNote(file: TFile): string | null {
    try {
      const name = bookNoteLinkFor(this.plugin, file);
      if (!name) return null;
      const note = resolveBookNote(this.app, name);
      if (!note) return null;
      const fm = this.app.metadataCache.getFileCache(note)?.frontmatter;
      if (!fm) return null;
      const raw = fm.cover ?? fm["обложка"] ?? fm.Cover ?? fm["Обложка"];
      const val = String(Array.isArray(raw) ? raw[0] : (raw ?? "")).trim();
      if (!val) return null;
      if (/^https?:\/\//i.test(val)) return val;
      const inner = (val.match(/^!?\[\[([^\]|#]+)/) || [])[1] || val;
      const img =
        this.app.metadataCache.getFirstLinkpathDest(inner.trim(), note.path) ||
        this.app.vault.getAbstractFileByPath(erPath(inner.trim()));
      return img instanceof TFile ? this.app.vault.getResourcePath(img) : null;
    } catch {
      return null;
    }
  }

  showImg(coverEl: HTMLElement, ph: HTMLElement, src: string): void {
    if (!src) return;
    ph.addClass("er-hidden");
    coverEl.style.setProperty("background-image", `url("${src.replace(/"/g, '\\"')}")`, "important");
    coverEl.addClass("er-cover-img");
    coverEl.style.setProperty(
      "background-size",
      coverEl.hasClass("er-fit-fill") ? "cover" : "contain",
      "important"
    );
    coverEl.addClass("er-has-cover");
  }

  async makePdfThumb(file: TFile): Promise<string> {
    await setupWorker(this.app);
    const buf = await this.app.vault.readBinary(file);
    const task = (pdfjsLib as unknown).getDocument({
      data: buf,
      isEvalSupported: false
    });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, Math.max(1, 520 / (base.width || 400)));
    const vp = page.getViewport({ scale });
    const cv = createEl("canvas");
    cv.width = Math.ceil(vp.width);
    cv.height = Math.ceil(vp.height);
    const ctx = cv.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      await (page.render({ canvasContext: ctx, viewport: vp, canvas: cv } as unknown as Parameters<typeof page.render>[0])).promise;
    }
    const url = cv.toDataURL("image/jpeg", 0.85);
    try {
      await task.destroy();
    } catch {
      /* ignore */
    }
    return url;
  }

  async makeFb2Thumb(file: TFile): Promise<string> {
    const buf = await this.app.vault.readBinary(file);
    const bytes = new Uint8Array(buf);
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) throw new Error("fb2 is zipped");
    const doc = new DOMParser().parseFromString(decodeFb2(buf), "application/xml");
    const cp = doc.getElementsByTagName("coverpage")[0];
    const img = cp && cp.getElementsByTagName("image")[0];
    const id = img ? fb2Href(img) : "";
    const bins = Array.from(doc.getElementsByTagName("binary"));
    const bin = (id && bins.find((b) => b.getAttribute("id") === id)) || bins[0];
    if (!bin) throw new Error("no cover");
    const data = (bin.textContent || "").replace(/\s+/g, "");
    if (!data) throw new Error("no cover");
    return `data:${bin.getAttribute("content-type") || "image/jpeg"};base64,${data}`;
  }

  async makeEpubThumb(file: TFile): Promise<string> {
    const buf = await this.app.vault.readBinary(file);
    const book = ePub(buf);
    await book.ready;
    const coverPath = await book.loaded.cover;
    if (!coverPath) {
      book.destroy();
      throw new Error("no cover");
    }
    const archive = book.archive;
    if (!archive || typeof archive.getBase64 !== "function") {
      book.destroy();
      throw new Error("epub archive unavailable");
    }
    const dataUrl = await archive.getBase64(coverPath);
    book.destroy();
    if (!dataUrl) throw new Error("no cover");
    return dataUrl;
  }

  onClose(): void {
    window.clearTimeout(this._thumbSaveT);
    if (this._thumbDirty) {
      this._thumbDirty = false;
      this.plugin.saveAll();
    }
    this._coverResizeObs?.disconnect();
    this.contentEl.empty();
  }
}
