import { Modal, App, TFile } from 'obsidian';
import { __ertr } from '../../utils/i18n';
import { OnboardingModal } from './OnboardingModal';

export interface ReleaseItem {
  v: string;
  items: string[];
}

export function getWhatsNew(): ReleaseItem[] {
  return [
  { v: "3.1.2", items: [
    __ertr("PDFs open again on iPhone and iPad, where the book used to be replaced by a readableStream error"),
    __ertr("PDFs whose font brings no character table are no longer shown as gibberish: the text is restored, and it can be selected and searched again"),
    __ertr("When the text cannot be restored, the page is shown as a picture, the way Obsidian itself shows it, instead of a row of odd symbols"),
    __ertr("On Android the tap-zone tint no longer stays burned on the screen after a tap"),
    __ertr("The scrollbar is visible on light themes, not only on dark ones"),
    __ertr("In scrolling mode a footnote link now leads to the footnote instead of the start of the book")
  ] },
  { v: "3.1.1", items: [
    __ertr("Book covers are built again: drawing a PDF to an image used browser features Obsidian does not have yet"),
    __ertr("The same fix covers pictures and scanned pages inside a PDF, which are drawn the same way")
  ] },
  { v: "3.1.0", items: [
    __ertr("The plugin loads again where it used to say «Failed to load»: older Obsidian builds, Huawei tablets and some Windows installs"),
    __ertr("Quotes can pile up in one book note: the title dialog now has an «Into the book's note» button, and the selection menu has «As text into the book's note»"),
    __ertr("The wording of the «↪ to this spot in the book» link is yours now - set it in the settings"),
    __ertr("Tapping a highlight in the list takes you to its place in the book even when that page has not been drawn yet"),
    __ertr("The selection bar no longer jumps to empty space at the start of a paragraph or across a page break"),
    __ertr("On Android the top bar no longer slides under the clock; if the phone's skin keeps the status-bar height to itself, the inset can be set by hand"),
    __ertr("What's new is saved as a note in your vault, so there is nothing to memorise from a window")
  ] },
  { v: "3.0.2", items: [
    __ertr("Feedback and bugs are now collected in the Telegram bot @book_in_obsidian_bot — just send it a message"),
    __ertr("Explaining a passage is a conversation now: your own question, your own system prompt, and the book's title is sent as background context"),
    __ertr("The reader adapts to the device: phone, tablet and desktop each get their own layout"),
    __ertr("Reader and library themes switch instantly, and can follow your Obsidian theme"),
    __ertr("The PDF engine has been updated — opening books is more reliable")
  ] },
  { v: "2.0.1", items: [
    __ertr("PDF paragraphs are kept as in the original — the text no longer glues into one solid wall"),
    __ertr("Library: an \"Add a book\" button and drag-and-drop of files (PDF, EPUB, FB2) straight into the window"),
    __ertr("The PDF engine is now bundled in — books open offline, nothing is fetched from the internet"),
    __ertr("In the highlights list a comment no longer breaks the quote — it sits neatly underneath it")
  ] },
  { v: "2.0.0", items: [
    __ertr("Search the whole book — magnifier icon at the top, with a match list and jump-to-spot"),
    __ertr("The matched word is painted right in the text, so you don't have to hunt for it in the paragraph"),
    __ertr("Comment on a highlight — a short thought stays with the quote instead of flying into a separate file"),
    __ertr("Contents finally works — it had the data but never showed it; fixed, plus page numbers, a live spread number and a filter for long lists"),
    __ertr("Quote export now groups by chapter and labels the page number"),
    __ertr("Pictures now show up straight away — previously you had to open another reader to find them"),
    __ertr("A note made from a highlight can go straight into the folder you want, with tags"),
    __ertr("Highlights are exported selectively: tick boxes, \"select all\", \"new only\" — nothing already copied gets duplicated"),
    __ertr("E-ink reader mode: no animations or shadows, pure black on white, bigger buttons"),
    __ertr("The guide has grown — it now walks through every setting with examples"),
    __ertr("Open a book by command — each book gets its own command and hotkey"),
    __ertr("Reading stats: all-time total, day streak and a two-week chart"),
    __ertr("Page turns go straight sideways instead of drifting into the corner, and text is sharp"),
    __ertr("Lines fill the page to the bottom — no more blank gaps at the foot of a column"),
    __ertr("Re-layout when sidebars open or close now fades instead of jumping"),
    __ertr("New format: FB2, including older files in windows-1251 encoding"),
    __ertr("Technical books read properly: code, tables and formulas no longer fall apart"),
    __ertr("Code listings are recognised even where the book declares no monospaced font"),
    __ertr("Margin notes are no longer glued into the middle of code lines"),
    __ertr("Contents pages with dot leaders come out as a tidy list"),
    __ertr("A short page can be centred vertically instead of pinned to the top"),
    __ertr("Contents are taken from the PDF itself, and on desktop it finally works"),
    __ertr("PDFs show the illustrations themselves rather than a screenshot of the page"),
    __ertr("Translation of a selected passage — switched on in the settings"),
    __ertr("Library: categories by genre and folder, plus a reading / finished filter"),
    __ertr("On a book's first open you can now CREATE its note, not only pick an existing one"),
    __ertr("Settings are split across tabs, with the rarely used ones tucked away"),
    __ertr("The text re-flows by itself when panels open, without losing your place"),
    __ertr("Fixed: typing a path in the settings created a folder per keystroke"),
    __ertr("The plugin is nearly 4 MB lighter")
  ] }
];
}

export const WHATS_NEW: ReleaseItem[] = new Proxy([] as ReleaseItem[], {
  get(target, prop, receiver) {
    const list = getWhatsNew();
    const val = Reflect.get(list, prop, receiver);
    if (typeof val === 'function') {
      return (val as (...args: unknown[]) => unknown).bind(list);
    }
    return val;
  }
});

export function cmpVer(a: string, b: string): number {
  const pa = String(a || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

export function whatsNewSince(lastSeen: string, current: string, log?: ReleaseItem[]): ReleaseItem[] {
  return (log || getWhatsNew()).filter((r) => cmpVer(r.v, lastSeen) > 0 && cmpVer(r.v, current) <= 0);
}

export class WhatsNewModal extends Modal {
  plugin: unknown;
  releases: ReleaseItem[];
  noteFile: TFile | null;

  constructor(app: App, plugin: unknown, releases: ReleaseItem[], noteFile?: TFile | null) {
    super(app);
    this.plugin = plugin;
    this.releases = releases;
    this.noteFile = noteFile || null;
  }

  onOpen(): void {
    const c = this.contentEl;
    this.modalEl.addClass("er-onb-modal");
    c.empty();
    const card = c.createDiv("er-onb-card er-wn-card");
    card.createDiv("er-onb-emoji").setText("✨");
    card.createDiv("er-onb-title").setText(__ertr("What's new"));
    card.createDiv("er-wn-sub").setText(__ertr("Book Reader updated to {0}", (this.plugin as unknown)?.manifest?.version || ""));
    const wrap = card.createDiv("er-wn-wrap");
    for (const r of this.releases) {
      const grp = wrap.createDiv("er-wn-rel");
      grp.createDiv("er-wn-ver").setText(r.v);
      const ul = grp.createDiv("er-wn-list");
      for (const it of r.items) {
        const row = ul.createDiv("er-wn-item");
        row.createSpan({ cls: "er-wn-dot", text: "✦" });
        row.createSpan({ text: __ertr(it) });
      }
    }
    const nav = c.createDiv("er-onb-nav er-wn-nav");
    const ok = nav.createEl("button", { text: __ertr("Got it") });
    ok.addClass("er-onb-start", "er-wn-ok");
    ok.addEventListener("click", () => this.close());
    if (this.noteFile) {
      const open = c.createDiv("er-onb-skip");
      open.setText(__ertr("Saved as the note «{0}» - open it", this.noteFile.basename));
      open.addEventListener("click", () => {
        this.close();
        this.app.workspace.getLeaf(true).openFile(this.noteFile!);
      });
    }
    const help = c.createDiv("er-onb-skip");
    help.setText(__ertr("Guide: every setting, step by step"));
    help.addEventListener("click", () => {
      this.close();
      new OnboardingModal(this.app, this.plugin).open();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
