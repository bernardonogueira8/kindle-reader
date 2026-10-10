import { Modal, App, TFile } from 'obsidian';
import { __ertr } from '../../utils/i18n';
import { svgIcon } from '../../utils/icons';

export class InfoModal extends Modal {
  plugin: unknown;
  file: TFile | null;
  _pdfLazy: unknown = null;

  constructor(app: App, plugin?: unknown, file?: TFile | null) {
    super(app);
    this.plugin = plugin || null;
    this.file = file || null;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass("er-info-modal");
    contentEl.empty();
    contentEl.createDiv("er-info-title").setText(__ertr("How to use Book Reader"));
    contentEl.createDiv("er-info-sub").setText(__ertr("What each button does and why"));
    const groups = [
      { head: __ertr("Top bar"), rows: [
        ["save", __ertr("Save position"), __ertr("Remembers where you left off and drops a restore point (marked 💾 in \"Settings → Jump back\"). It's like a \"save\" in a game — press it before closing the book if you want to be completely sure your spot won't be lost.")],
        ["refresh", __ertr("Refresh"), __ertr("Rebuilds the page if the layout breaks — for example, after resizing the window or opening/closing a sidebar panel or tab (the text may look misaligned). Your current position is preserved.")],
        ["search", __ertr("Search"), __ertr("Search across the whole book's text — a list of matches with context around each, click to jump to that spot.")],
        ["highlighter", __ertr("Highlights"), __ertr("Opens every highlight you have made in this book. Click a row to jump to that spot. Each highlight has a comment icon — a short thought that stays with the quote. The export-to-notes button sits above the list.")],
        ["list", __ertr("Contents"), __ertr("The book's contents: PDF bookmarks, headings, the book's own printed contents page or bold paragraphs — whichever turns up first. Each entry shows a page number and the current spread. When there are many entries, a filter appears at the top.")],
        ["sliders", __ertr("Settings"), __ertr("Theme, font, text size, column count and the \"Jump back\" block — a list of points you can roll back to.")],
        ["info", __ertr("Help"), __ertr("This window.")]
      ] },
      { head: __ertr("Reading and navigation"), rows: [
        ["chevron-left", __ertr("Turn pages"), __ertr("The arrows at the bottom of the screen, the ← → ↑ ↓ keys and space, or a finger swipe on mobile. Every page turn saves your position automatically — you don't need to press \"Save\" separately.")]
      ] },
      { head: __ertr("Highlights and notes"), rows: [
        ["highlighter", __ertr("Highlight text"), __ertr("Select a fragment with the mouse or a finger — a color palette pops up. Click an existing highlight to change its color or remove it.")],
        ["note", __ertr("Create a note from a highlight"), __ertr("Right-click the highlighted text → \"Create new note\". The note is created from your template in the chosen folder, with the quote and a link to the book.")],
        ["download", __ertr("Move highlights into notes"), __ertr("The button at the top of the Highlights panel. It opens a list where you tick what you want — one by one, \"Select all\" or \"New only\". Anything already copied into the book note is marked and left unticked, so exporting again never duplicates it. Then choose: paste them as text into the book note, or make a separate note for each passage.")]
      ] }
    ];
    groups.forEach((g) => {
      contentEl.createDiv("er-info-group").setText(g.head);
      g.rows.forEach(([ic, title, desc]) => {
        const row = contentEl.createDiv("er-info-row");
        const ig = row.createDiv("er-info-ic");
        svgIcon(ig, ic);
        const tx = row.createDiv("er-info-tx");
        tx.createDiv("er-info-rowtitle").setText(title);
        tx.createDiv("er-info-rowdesc").setText(desc);
      });
    });
    const note = contentEl.createDiv("er-info-note");
    note.createDiv("er-info-rowtitle").setText(__ertr("About autosave"));
    note.createDiv("er-info-rowdesc").setText(__ertr("Your position is saved automatically on every page turn and kept in a shared file that syncs across devices (Obsidian Sync). Rebuilding the page (resizing the window, panels, zoom) no longer moves or re-saves progress — so it won't \"drift\" on its own."));
  }

  onClose(): void {
    if (this._pdfLazy && typeof this._pdfLazy.destroy === "function") {
      this._pdfLazy.destroy();
    }
    this._pdfLazy = null;
    this.contentEl.empty();
  }
}
