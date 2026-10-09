import { Modal, App } from 'obsidian';
import { __ertr } from '../../utils/i18n';

export interface OnboardSlide {
  emoji: string;
  title: string;
  tone?: string;
  body: string | string[];
}

export const ONBOARD_SLIDES: OnboardSlide[] = [
  {
    emoji: "\u{1F4D6}",
    title: __ertr("Welcome to Book Reader!"),
    body: [
      __ertr("It's a cozy book reader right inside Obsidian. Read, highlight what matters and turn highlights into notes — without leaving your vault."),
      __ertr("Flip through a few screens with the → arrow (or the \"Next\" button). It takes a minute, but then everything will be clear.")
    ]
  },
  {
    emoji: "\u{1F4DA}",
    title: __ertr("Which formats, and how to open a book"),
    body: [
      __ertr("The reader opens three formats: EPUB (.epub), FB2 (.fb2) and PDF (.pdf)."),
      __ertr("To read a book, put its file into your Obsidian vault and just click it — it opens in the reader."),
      __ertr("In the left sidebar there's a 📖 \"Library\" icon — all your books with covers in one place.")
    ]
  },
  {
    emoji: "\u{1F423}",
    title: __ertr("This is the very first version"),
    tone: "warn",
    body: [
      __ertr("Please don't load a lot of books at once. Start with two or three and check that everything works reliably on your device."),
      __ertr("Be especially careful with very large PDFs (hundreds of pages or scanned images) — they're heavy and may lag."),
      __ertr("The plugin will keep getting better. For now — little by little and gently 🙂")
    ]
  },
  {
    emoji: "\u{1F58D}️",
    title: __ertr("Highlights: colors and actions"),
    body: [
      __ertr("Select text with a finger or the mouse — a palette appears. Pick a color and the highlight is saved."),
      __ertr("Tap an existing highlight — the same menu opens: change color, copy, set a \"stopped here\" bookmark, create a note, send it to the book note, or delete."),
      __ertr("All of the book's highlights are gathered in the 🖍️ panel at the top — from there you can jump to any of them or export them all at once.")
    ]
  },
  {
    emoji: "\u{1F517}",
    title: __ertr("What a \"book note\" is"),
    body: [
      __ertr("For each book you can keep one ordinary Obsidian note — its \"home page\", for example \"The Master and Margarita.md\"."),
      __ertr("When you create a note from a highlight, it links back to this book note. You can also send quotes straight into it — so all your thoughts on the book gather in one place."),
      __ertr("You don't have to set this up right now — you can link a book note at any time later. Open the book, press the ⓘ (help) icon at the top of the reader and fill in the \"Book note for links\" field. Until something is linked, links simply point to the book's file name.")
    ]
  },
  {
    emoji: "\u{1F4BE}",
    title: __ertr("Where everything is stored"),
    body: [
      __ertr("Your reading progress and highlights are stored as files right in the vault (next to the books or in a separate folder — it's configurable). Nothing is hidden \"inside the plugin\" — it's all yours."),
      __ertr("Highlight notes and book notes are ordinary .md notes in your folder. Open, edit and link them like any others.")
    ]
  },
  {
    emoji: "\u{1F504}",
    title: __ertr("About syncing"),
    tone: "warn",
    body: [
      __ertr("Since progress and highlights are files in the vault, they sync along with it (Obsidian Sync, iCloud, etc.)."),
      __ertr("Let syncing finish before opening the same book on another device, and don't read one book on two devices at once — otherwise the position may \"argue with itself\"."),
      __ertr("The path to the books folder can differ across devices — check the folders in the plugin settings.")
    ]
  },
  {
    emoji: "\u{1F9ED}",
    title: __ertr("Example: how it all works"),
    body: [
      __ertr("1. Put the book file (.epub, .fb2 or .pdf) in your vault and open it with a click."),
      __ertr("2. Read. Your position saves itself on every page turn — nothing to press."),
      __ertr("3. Like a thought — highlight it and pick a color. The highlight is saved."),
      __ertr("4. (optional) Press ⓘ at the top and link a \"book note\" — your page for this book. You can do this later too."),
      __ertr("5. Tap a highlight → \"to book note\" — the quote flies into that page, and the plugin offers to open it. Done: all your quotes in one place.")
    ]
  },
  {
    emoji: "⚙️",
    title: __ertr("Next: a tour of the settings"),
    body: [
      __ertr("The next few screens walk through the plugin's settings: what each one does, what to pick, and what happens if you change nothing."),
      __ertr("To open the settings: Obsidian's gear icon → Community plugins → Book Reader. There are five tabs at the top: Reading, Notes, Translation, Data and About."),
      __ertr("None of this has to be set up now — the plugin works as it is. This tour is here so you know what can be changed at all.")
    ]
  },
  {
    emoji: "\u{1F4CA}",
    title: __ertr("The Reading tab: statistics"),
    body: [
      __ertr("At the top of the tab there is a stats card: your all-time reading total, your current day streak, the daily average, your best day and a two-week chart."),
      __ertr("It fills itself in as you read with the timer running (the ▶ button at the top of the reader). Nothing to configure — just look at it."),
      __ertr("For example: \"12 h 30 min all-time · 🔥 5-day streak\". If you never start the timer, no time is counted.")
    ]
  },
  {
    emoji: "\u{1F446}",
    title: __ertr("The \"Turning pages\" setting"),
    body: [
      __ertr("\"Buttons\" — turn pages with the arrows at the bottom, the ← → ↑ ↓ keys and space, or a swipe on a phone. The middle of the page stays free, so selecting text is easy."),
      __ertr("\"By mouse click\" — clicking the left half of the page goes back, the right half forward. Faster, but a stray click can turn the page when you meant to select a phrase."),
      __ertr("What to pick: start with \"Buttons\". Switch to \"By click\" if you read straight through and highlight little.")
    ]
  },
  {
    emoji: "\u{1F4D0}",
    title: __ertr("Alignment and text position"),
    body: [
      __ertr("Alignment — how the text sits in the column: left (ragged right edge, as in a browser), justified (both edges even, as in a printed book), centred or right."),
      __ertr("Position on the page — what to do when a page isn't full, at the end of a chapter for instance: leave the text at the top, centre it, or push it to the bottom."),
      __ertr("What to pick: justified + top is the most book-like. Centring is only worth it if half-empty pages at the end of chapters bother you.")
    ]
  },
  {
    emoji: "\u{1F576}️",
    title: __ertr("Immersive mode and the reading goal"),
    body: [
      __ertr("Immersive: the top and bottom bars gently dim after a couple of seconds without mouse movement and come back the instant you move. Nothing distracts from the text."),
      __ertr("Daily goal: a slider from 5 to 120 minutes. The ▶ timer at the top of the reader is started BY HAND and counts down to the goal; ⏸ pauses it."),
      __ertr("Note: the timer never starts on its own. Forget to press ▶ and neither your reading time nor the statistics will add up.")
    ]
  },
  {
    emoji: "\u{1F4DD}",
    title: __ertr("A note from a highlight: title, folder, tags"),
    body: [
      __ertr("Highlight a passage → \"Create note\". A dialog opens with three fields: the title (a short one is suggested; edit it, or take the whole passage with one click), the folder and the tags."),
      __ertr("The folder is picked from a suggestion list; tags are comma-separated and suggested from the ones already used in your vault. Both are remembered for the next note, so you don't retype them each time."),
      __ertr("For example: highlight a paragraph about PEP 8 → title \"PEP 8 code style\", folder \"0. Files/5. Inbox\", tags \"python, style\". The dialog can be turned off in Settings → Notes.")
    ]
  },
  {
    emoji: "\u{1F50B}",
    title: __ertr("E-ink reader mode"),
    body: [
      __ertr("If Obsidian is running on an Android e-ink reader, turn on \"E-ink reader mode\" in Settings → Reading."),
      __ertr("It removes everything that leaves ghosting on such a screen: animations, fades, shadows, blur and transparency. Colours become pure black on white, borders are hard, and buttons are bigger for a thumb."),
      __ertr("An extra \"E-ink\" theme also appears in the theme list — maximum contrast, no tinting.")
    ]
  },
  {
    emoji: "\u{1F4C2}",
    title: __ertr("Where notes are filed"),
    body: [
      __ertr("\"Folder for new notes\" — where notes made from highlights are filed. Empty means the vault root. For example: 0. Files/5. Inbox"),
      __ertr("\"Book-notes folder\" — where the list comes from when you pick a book's note. Empty means you can choose any note in the vault. For example: 3. Resources/Book base"),
      __ertr("Paths are written from the vault root, with forward slashes. You can pick a folder from the suggestions — start typing and a list appears.")
    ]
  },
  {
    emoji: "\u{1F517}",
    title: __ertr("The book note and the template"),
    body: [
      __ertr("Each book can have a note of its own — quotes are collected there, and the \"— from [[…]]\" links in every note about that book point to it."),
      __ertr("\"A separate note per book\" — create it automatically on a book's first open, without asking. Otherwise the plugin asks you once."),
      __ertr("\"Note template\" — the file new highlight notes are built from. Works with Templater too, if you have it. Empty means the note is just the quote and a link.")
    ]
  },
  {
    emoji: "\u{1F30D}",
    title: __ertr("The Translate tab"),
    body: [
      __ertr("Off by default. Turn it on and a translate button appears on selected text — handy for books in another language."),
      __ertr("This is the only place the plugin reaches the internet: the selected passage goes to the free Google translator. Nothing else is sent anywhere."),
      __ertr("The target language is chosen in the same place. A translation can be saved into a note underneath the original.")
    ]
  },
  {
    emoji: "\u{1F5C4}️",
    title: __ertr("The Data tab: where things live"),
    body: [
      __ertr("\"Books folder\" — where the plugin looks for books to fill the library. Empty means it searches the whole vault."),
      __ertr("\"Data folder\" — where the progress and highlight files live. Empty means next to the books. These files sync between devices, which is how reading carries on from the same spot on your phone."),
      __ertr("\"What the reader remembers\" — the \"Forget all books\" button clears the note links and categories without deleting any notes. Use it if you want to set everything up again from scratch.")
    ]
  },
  {
    emoji: "\u{1F58D}️",
    title: __ertr("Moving highlights into notes"),
    body: [
      __ertr("The export button at the top of the Highlights panel opens a tick-list of every highlight in the book."),
      __ertr("Tick them one by one, or use \"Select all\" or \"New only\". Anything already in the book note is marked and left unticked — exporting again never duplicates it."),
      __ertr("Then choose: paste them as text into the book note (everything in one place), or create a separate note per passage (for linking between notes)."),
      __ertr("In the note, quotes are grouped by chapter, each carries the book's page number, and your comment (if you left one) sits right under the quote.")
    ]
  },
  {
    emoji: "\u{1F4AC}",
    title: __ertr("Comment on a highlight"),
    body: [
      __ertr("Highlighted text has a comment icon besides \"Create a note\" — a short thought that stays WITH the highlight instead of flying off into a separate file."),
      __ertr("Example: you highlight a shaky claim and jot \"he contradicts himself right here\" — it shows under the quote in the Highlights panel and travels with it on export."),
      __ertr("Saved with the button or Ctrl+Enter. Clearing the field removes the comment; the quote itself stays.")
    ]
  },
  {
    emoji: "\u{1F50E}",
    title: __ertr("Search the book"),
    body: [
      __ertr("The magnifier icon at the top of the reader (or the \"Search the book\" command) opens full-text search, with a list of matches and surrounding context for each."),
      __ertr("Click a result to jump straight to that spot, on any device and at any window width."),
      __ertr("The matched word is painted yellow right in the book's text — and stays painted after you close the panel, so you don't have to hunt for it in the paragraph. Turn it off with \"Clear highlight\" in the search panel."),
      __ertr("Matches partial words: searching \"system\" finds \"system\", \"systems\" and \"systemic\".")
    ]
  },
  {
    emoji: "\u{1F4D1}",
    title: __ertr("Contents: where it comes from"),
    body: [
      __ertr("The plugin looks for a contents source in this order: real PDF bookmarks first, then headings in the text, then the book's own printed contents page (the one with the dotted leaders), and as a last resort, bold paragraphs if nothing else is there to go on."),
      __ertr("Each entry shows the book's own page number and the current spread number, recomputed live — it changes with window width or a sidebar opening, so it can't be stored once and reused."),
      __ertr("When there are many entries (technical books can have 300–400), a filter field appears at the top — start typing a chapter name.")
    ]
  },
  {
    emoji: "\u{1F5BC}️",
    title: __ertr("Pictures in books"),
    body: [
      __ertr("Pictures from a PDF are shown right in the text. Scanned pages are drawn whole, while on ordinary pages the picture itself is cropped out rather than a screenshot of the entire page."),
      __ertr("They load as you read and are released once they are far behind, so a 500-page illustrated book doesn't eat your memory."),
      __ertr("If the pictures get in the way and you only want text, turn them off: Settings → Reading → \"Show pictures from the book\".")
    ]
  },
  {
    emoji: "⌨️",
    title: __ertr("Commands and hotkeys"),
    body: [
      __ertr("The command palette (Ctrl+P) has an \"Open book: …\" entry for every book you have — assign a hotkey and a particular book is one keystroke away."),
      __ertr("There is also \"Continue reading\", which opens your last book where you left off, and \"Open a book…\", a searchable list."),
      __ertr("Hotkeys are assigned in Obsidian's settings → Hotkeys; search for Reader.")
    ]
  },
  {
    emoji: "💬",
    title: __ertr("Feedback and bugs — in the Telegram bot"),
    body: [
      __ertr("Everything you would like changed or fixed is now collected in one place — the Telegram bot @book_in_obsidian_bot."),
      __ertr("No GitHub account and no form needed: found a bug, missing a feature, something awkward on the phone — just send the bot an ordinary message."),
      __ertr("I read every one of them, and that is what the plan for the next versions is made of.")
    ]
  },
  {
    emoji: "✅",
    title: __ertr("All set — enjoy your reading!"),
    body: [
      __ertr("What to set up if you like (not required right away): the books folder and the notes folder — in the plugin settings. The book note — under the ⓘ icon while reading."),
      __ertr("What you can leave alone entirely: progress and highlights work right away and save themselves."),
      __ertr("Full help for every button — the ⓘ icon in the reader. You can reopen this welcome screen in the plugin settings."),
      __ertr("Press \"Start reading\" and open your first book 📖")
    ]
  }
];

export class OnboardingModal extends Modal {
  plugin: any;
  idx = 0;
  _finished = false;

  constructor(app: App, plugin?: any) {
    super(app);
    this.plugin = plugin || null;
  }

  onOpen(): void {
    this.modalEl.addClass("er-onb-modal");
    this.scope.register([], "ArrowRight", (e: KeyboardEvent) => {
      e.preventDefault();
      this._go(1);
    });
    this.scope.register([], "ArrowLeft", (e: KeyboardEvent) => {
      e.preventDefault();
      this._go(-1);
    });
    this._render();
  }

  _go(dir: number): void {
    const n = this.idx + dir;
    if (n < 0 || n >= ONBOARD_SLIDES.length) return;
    this.idx = n;
    this._render();
  }

  _markSeen(): void {
    if (this._finished) return;
    this._finished = true;
    if (this.plugin && !this.plugin.settings.onboarded) {
      this.plugin.settings.onboarded = true;
      this.plugin.saveAll();
    }
  }

  _render(): void {
    const { contentEl } = this;
    contentEl.empty();
    const s = ONBOARD_SLIDES[this.idx];
    const total = ONBOARD_SLIDES.length;
    const last = this.idx === total - 1;
    const card = contentEl.createDiv("er-onb-card" + (s.tone === "warn" ? " er-onb-warn" : ""));
    card.createDiv("er-onb-emoji").setText(s.emoji);
    card.createDiv("er-onb-title").setText(s.title);
    const body = card.createDiv("er-onb-body");
    (Array.isArray(s.body) ? s.body : [s.body]).forEach((p) => body.createEl("p").setText(p));
    const dots = contentEl.createDiv("er-onb-dots");
    ONBOARD_SLIDES.forEach((_, i) => {
      const d = dots.createDiv("er-onb-dot" + (i === this.idx ? " er-onb-dot-on" : ""));
      d.setAttribute("aria-label", __ertr("Screen {0}", i + 1));
      d.addEventListener("click", () => {
        this.idx = i;
        this._render();
      });
    });
    const nav = contentEl.createDiv("er-onb-nav");
    const prev = nav.createEl("button", { text: __ertr("‹ Back") });
    prev.addClass("er-onb-prev");
    prev.disabled = this.idx === 0;
    prev.addEventListener("click", () => this._go(-1));
    nav.createDiv("er-onb-counter").setText(`${this.idx + 1} / ${total}`);
    const next = nav.createEl("button", { text: last ? __ertr("Start reading") : __ertr("Next ›") });
    next.addClass(last ? "er-onb-start" : "er-onb-next");
    next.addEventListener("click", () => {
      if (last) {
        this._markSeen();
        this.close();
      } else this._go(1);
    });
    const skip = contentEl.createDiv("er-onb-skip");
    skip.setText(last ? "" : __ertr("Skip"));
    if (!last) skip.addEventListener("click", () => {
      this._markSeen();
      this.close();
    });
  }

  onClose(): void {
    this._markSeen();
    this.contentEl.empty();
  }
}
