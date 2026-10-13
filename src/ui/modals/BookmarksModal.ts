import { Modal, App, Notice } from 'obsidian';
import { BookmarkEntry } from '../../types';
import { __ertr } from '../../utils/i18n';
import { svgIcon } from '../../utils/icons';

export class BookmarksModal extends Modal {
  reader: unknown;

  constructor(app: App, reader: unknown) {
    super(app);
    this.reader = reader;
  }

  onOpen(): void {
    const { modalEl } = this;
    modalEl.addClass("er-confirm-modal", "er-bookmarks-modal");
    this.render();
  }

  render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const titleRow = contentEl.createDiv("er-modal-header-row");
    const title = titleRow.createDiv("er-confirm-title");
    title.setText(__ertr("Bookmarks"));

    const bookPath = this.reader.file?.path || "";
    const bms: BookmarkEntry[] = this.reader._getBookmarks ? this.reader._getBookmarks() : [];

    if (bms.length === 0) {
      const empty = contentEl.createDiv("er-bookmarks-empty");
      const emptyIcon = empty.createDiv("er-bookmarks-empty-icon");
      svgIcon(emptyIcon, "bookmark");
      empty.createDiv("er-bookmarks-empty-text").setText(
        __ertr("No bookmarks for this book")
      );
      const hint = empty.createDiv("er-bookmarks-empty-hint");
      hint.setText(__ertr("Tap the bookmark icon or corner ribbon while reading to bookmark a page."));
    } else {
      const listEl = contentEl.createDiv("er-bookmarks-list");
      bms.forEach((bm) => {
        const item = listEl.createDiv("er-bookmark-item");

        const left = item.createDiv("er-bookmark-left");
        const iconEl = left.createDiv("er-bookmark-ic");
        svgIcon(iconEl, "bookmark");

        const info = left.createDiv("er-bookmark-info");
        const pageLabel = bm.page ? __ertr("Page {0}", bm.page) : __ertr("Spread {0}", bm.spread + 1);
        const headerText = bm.chapter ? `${pageLabel} · ${bm.chapter}` : pageLabel;
        info.createDiv("er-bookmark-header").setText(headerText);

        if (bm.title) {
          info.createDiv("er-bookmark-snippet").setText(bm.title);
        }

        const dateStr = new Date(bm.created).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        info.createDiv("er-bookmark-date").setText(dateStr);

        // Click on left/item jumps to page
        left.addEventListener("click", () => {
          this.close();
          if (this.reader.pager) {
            this.reader.pager.goTo(bm.spread);
          }
        });

        const actions = item.createDiv("er-bookmark-actions");
        const jumpBtn = actions.createEl("button", { cls: "er-ibtn er-bm-jump", attr: { "aria-label": __ertr("Go to bookmark") } });
        svgIcon(jumpBtn, "arrow-right");
        jumpBtn.addEventListener("click", () => {
          this.close();
          if (this.reader.pager) {
            this.reader.pager.goTo(bm.spread);
          }
        });

        const delBtn = actions.createEl("button", { cls: "er-ibtn er-bm-del", attr: { "aria-label": __ertr("Delete bookmark") } });
        svgIcon(delBtn, "trash-2");
        delBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const list = this.reader.plugin.settings.bookmarks?.[bookPath] || [];
          const idx = list.findIndex((x: BookmarkEntry) => x.id === bm.id);
          if (idx >= 0) {
            list.splice(idx, 1);
            this.reader.plugin.settings.bookmarks[bookPath] = list;
            await this.reader.plugin._saveLocalData();
            this.reader._updateBookmarkUI();
            new Notice(__ertr("Bookmark removed"));
            this.render();
          }
        });
      });
    }

    const btns = contentEl.createDiv("er-confirm-btns");
    const cur = this.reader.pager ? this.reader.pager.current : 0;
    const isCurBookmarked = this.reader._isBookmarked ? this.reader._isBookmarked(cur) : false;

    if (!isCurBookmarked) {
      const markCurrentBtn = btns.createEl("button", {
        cls: "er-confirm-yes",
        text: __ertr("Bookmark current page")
      });
      markCurrentBtn.addEventListener("click", async () => {
        await this.reader.toggleBookmark();
        this.render();
      });
    }

    const closeBtn = btns.createEl("button", {
      cls: "er-confirm-no",
      text: __ertr("Close")
    });
    closeBtn.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
