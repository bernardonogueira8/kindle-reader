export interface KindleReaderSettings {
  language: string;
  booksFolder: string;
  noteTemplate: string;
  notesFolder: string;
  bookNotesFolder: string;
  autoBookNote: boolean;
  quotesToBookNote: boolean;
  dataFolder: string;
  bookTemplates: Record<string, string>;
  exportColors: boolean;
  theme: string;
  libTheme: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  paragraphSpacing: number;
  wordSpacing: number;
  letterSpacing: number;
  pageMargin: string;
  columns: string;
  textAlign: string;
  vAlign: string;
  translateEnabled: boolean;
  translateTo: string;
  bookNoteLinks: Record<string, string>;
  bookNotePrompted: Record<string, boolean>;
  coverFits: Record<string, string>;
  syncMode: string;
  pdfShowFiguresOnTextPages: boolean;
  libCoverSize: number;
  libCategory: string;
  readerAdvOpen: boolean;
  readerHistOpen: boolean;
  askNoteTitle: boolean;
  shortNoteTitles: boolean;
  defaultHlColor: string;
  bookTags: Record<string, string[]>;
  navMode: string;
  timerEnabled: boolean;
  dailyGoalMin: number;
  readingLog: Record<string, number>;
  lifetimeSeconds: number;
  immersive: boolean;
  mobileTopInset: number;
  onboarded: boolean;
  promptedRepaired: boolean;
  figuresShownByDefault: boolean;
  einkMode: boolean;
  aiEnabled: boolean;
  aiProvider: string;
  aiKey: string;
  aiModel: string;
  aiBase: string;
  aiInto: string;
  aiSystem: string;
  languagePicked: boolean;
  readMode: string;
  pageTurnAnimation: boolean;
  progressToFrontmatter: boolean;
  quoteTemplate: string;
  quoteBacklinks: boolean;
  quoteBacklinkLabel: string;
  noteOpenMode: string;
  maxLineCh: number;
  notesNextToBook: boolean;
  perDevice: boolean;
  deviceProfiles: unknown;
  lastSeenVersion: string;
  whatsNewNote: boolean;
}

export const DEFAULT_SETTINGS: KindleReaderSettings = {
  // Interface language: "en", "pt", or "ru" when explicitly selected.
  language: "en",
  booksFolder: "",
  // ── Notes created from selections / highlights ────────────────────────────
  // Templater template applied to every new note ("" = create without a
  // template, just the quoted selection). Point this at your own template.
  noteTemplate: "",
  // Folder new notes are created in ("" = vault root).
  notesFolder: "",
  // Folder whose notes appear in the per-book "link to note" picker ("" = all).
  bookNotesFolder: "",
  // Opt-in: on a book's first open, automatically create a dedicated note named
  // after the book (in the book-notes folder, else the notes folder) and link it,
  // so every book gets its own note without manual picking.
  autoBookNote: false,
  // Every new highlight is appended to the book's note as it is made.
  quotesToBookNote: false,
  // Where reading data (progress, highlights, rescue backups) is stored.
  // "" = next to the books (the booksFolder).
  dataFolder: "",
  // Per-book template override, keyed by book path -> template path.
  bookTemplates: {},
  // Keep highlight colours when exporting: wraps each quote in a coloured
  // <mark> (renders in vanilla Obsidian). Off = plain quotes without colour.
  exportColors: true,
  // Default reader look mimics Obsidian, including dark themes.
  theme: "auto",
  // The library has its own theme and follows Obsidian by default.
  // "reader" = use the same theme as the book page.
  libTheme: "auto",
  fontSize: 18,
  fontFamily: "georgia",
  lineHeight: 1.8,
  paragraphSpacing: 0.75,
  wordSpacing: 0,
  letterSpacing: 0,
  pageMargin: "normal",
  columns: "2",
  // Text alignment inside the reading column: "left" (default), "justify",
  // "center" or "right".
  textAlign: "left",
  // Where a SHORT page sits vertically: "top" (default), "center" or "bottom".
  vAlign: "top",
  // Opt-in: adds a "translate" button to the selection popup. Off by default
  translateEnabled: false,
  // Target language for that button (ISO code Google Translate understands).
  translateTo: "en",
  // Per-book override for the backlink inserted into notes created from a
  // selection. Keyed by the book file's path -> the note name to link to.
  // Empty/unset -> fall back to the book file's own name.
  bookNoteLinks: {},
  // Books we've already shown the "pick a book note" prompt for (keyed by path),
  // so first-open asks once and never nags again.
  bookNotePrompted: {},
  // Per-book cover display mode in the library, keyed by path -> "contain".
  // Default (no entry) = "cover" (fills the card, may crop). "contain" shows the
  // WHOLE cover in proportion over a soft blurred backdrop.
  coverFits: {},
  // How the user syncs their vault between devices.
  syncMode: "auto",
  // Opt-in: on PDF pages that have BOTH a picture and extractable text, also show
  // the page artwork above the text.
  pdfShowFiguresOnTextPages: true,
  // Library cover size = the grid column width in px (cards scale with it).
  libCoverSize: 176,
  // Last category chip picked in the library.
  libCategory: "all",
  // Is the "Advanced" group in the reading panel expanded?
  readerAdvOpen: false,
  readerHistOpen: false,
  askNoteTitle: true,
  shortNoteTitles: true,
  // Colour used when a comment has to create the highlight it hangs on.
  defaultHlColor: "yellow",
  // Reader-assigned categories per book: { "<book path>": ["Psychology", ...] }.
  bookTags: {},
  // How pages are turned. "buttons" = the arrows / keys / swipe (default).
  // "click" = tap/click the left or right side of the page to turn it.
  navMode: "buttons",
  // Daily reading-goal timer.
  timerEnabled: true,
  dailyGoalMin: 15,
  // Accumulated reading seconds per day: { "YYYY-MM-DD": seconds }.
  readingLog: {},
  // Untrimmed lifetime reading total (seconds).
  lifetimeSeconds: 0,
  // Content-first "immersive" chrome: top/bottom bars dim.
  immersive: true,
  // Manual top inset on mobile (px). 0 = use system status bar height.
  mobileTopInset: 0,
  // Set to true once the first-run welcome slideshow has been shown.
  onboarded: false,
  // Repair flag for older builds.
  promptedRepaired: false,
  figuresShownByDefault: false,
  einkMode: false,
  // AI translation and passage breakdown.
  aiEnabled: false,
  aiProvider: "eltonlabs",
  aiKey: "",
  aiModel: "",
  aiBase: "",
  aiInto: "English",
  // Custom system prompt override.
  aiSystem: "",
  languagePicked: false,
  readMode: "pages",
  // Does a page slide when turned?
  pageTurnAnimation: true,
  // Copy the reading percentage into the book note's frontmatter.
  progressToFrontmatter: false,
  // How a copied quote is shaped.
  quoteTemplate: "",
  quoteBacklinks: true,
  // Backlink label. Empty = use interface language default.
  quoteBacklinkLabel: "",
  // Where a note made from a highlight opens: "split", "tab", "none".
  noteOpenMode: "split",
  // Widest a single reading column may get, in characters.
  maxLineCh: 0,
  // Put notes made from a book's highlights in the SAME folder as the book.
  notesNextToBook: false,
  perDevice: false,
  // Device specific profiles.
  deviceProfiles: {},
  // Plugin version the reader last saw the "what's new" screen for.
  lastSeenVersion: "",
  // Save what's new to the vault.
  whatsNewNote: true
};

export const QUOTE_TEMPLATE_DEFAULT = "> {text}\n\n— from [[{book}]]{page}{link}";

export const DEFAULT = DEFAULT_SETTINGS;

export interface AiProviderConfig {
  label: string;
  needsKey: boolean;
  base: string;
  model: string;
}

export const AI_PROVIDERS: Record<string, AiProviderConfig> = {
  eltonlabs:  { label: "Elton AI", needsKey: true,  base: "https://api.eltonlabs.org/v1", model: "anthropic/claude-haiku-4.5" },
  openrouter: { label: "OpenRouter", needsKey: true, base: "https://openrouter.ai/api/v1", model: "anthropic/claude-haiku-4.5" },
  openai:     { label: "OpenAI", needsKey: true, base: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  local:      { label: "Ollama / LM Studio", needsKey: false, base: "http://localhost:11434/v1", model: "qwen2.5:3b" },
};

export function aiConfig(settings: KindleReaderSettings) {
  const id = settings.aiProvider || "eltonlabs";
  const p = AI_PROVIDERS[id] || AI_PROVIDERS.eltonlabs;
  return {
    id,
    base: (settings.aiBase || p.base).replace(/\/+$/, ""),
    model: settings.aiModel || p.model,
    key: settings.aiKey || "",
    needsKey: p.needsKey,
  };
}

