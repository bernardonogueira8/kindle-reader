import { PluginSettingTab, App, Setting, Notice, Platform } from 'obsidian';
import { __ertr, __erSetLang } from '../utils/i18n';
import { AI_PROVIDERS, QUOTE_TEMPLATE_DEFAULT } from '../settings';
import { SettingsGroupModal } from './SettingsGroupModal';
import { OnboardingModal, WhatsNewModal, WHATS_NEW, attachPathInput } from './modals';
import { HL_COLORS } from '../utils/theme';
import {
  VIEW_TYPE,
  erDeviceKey,
  readerTodayKey,
  fmtReadTime,
  readingStats
} from '../main';

export class SettingsTab extends PluginSettingTab {
  plugin: unknown;
  _tab: string = "read";

  override getSettingDefinitions() {
    return [];
  }

  // A row that stands for a whole group: name, one line on what is inside, and
  // the button that opens it.
  _group(c: HTMLElement, { name, desc, build }: { name: string; desc: string; build: (c: HTMLElement, redraw: () => void) => void }) {
    new Setting(c)
      .setName(name)
      .setDesc(desc)
      .addButton((b) => b
        .setButtonText(__ertr("Configure"))
        .onClick(() => new SettingsGroupModal(this.app, name, build).open()));
  }

  constructor(app: App, plugin: unknown) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Rebuild the page while preserving scroll position
  _redraw() {
    const el = this.containerEl;
    const scroller = el.scrollHeight > el.clientHeight ? el : (el.closest(".vertical-tab-content") || el.parentElement || el);
    const y = scroller.scrollTop;
    this._render();
    scroller.scrollTop = y;
    window.requestAnimationFrame(() => { scroller.scrollTop = y; });
  }

  display() {
    this._render();
  }

  _render() {
    const { containerEl: c } = this;
    c.empty();

    const TABS = [
      { id: "read", label: __ertr("Reading") },
      { id: "look", label: __ertr("Appearance") },
      { id: "notes", label: __ertr("Notes") },
      { id: "translate", label: __ertr("Translation") },
      { id: "data", label: __ertr("Data") },
      { id: "about", label: __ertr("About") }
    ];

    if (!this._tab || !TABS.some((t) => t.id === this._tab)) this._tab = "read";

    // Language selector sits above tabs
    new Setting(c)
      .setName(__ertr("Language"))
      .setDesc(__ertr("The plugin's interface language. Reopen the book to apply."))
      .addDropdown((d) => d
        .addOption("en", "English")
        .addOption("pt", "Portuguese")
        .addOption("ru", __ertr("Russian"))
        .setValue(this.plugin.settings.language || "en")
        .onChange(async (v) => {
          this.plugin.settings.language = v;
          this.plugin.settings.languagePicked = true;
          __erSetLang(v);
          await this.plugin.saveAll();
          this._redraw();
        }));

    const bar = c.createDiv("er-set-tabs");
    TABS.forEach((t) => {
      const el = bar.createDiv("er-set-tab");
      el.setText(t.label);
      if (t.id === this._tab) el.addClass("er-set-tab-on");
      el.addEventListener("click", () => { this._tab = t.id; this._redraw(); });
    });

    const body = c.createDiv("er-set-body");
    if (this._tab === "read") this._tabReading(body);
    else if (this._tab === "look") this._groupAppearance(body);
    else if (this._tab === "notes") this._tabNotes(body);
    else if (this._tab === "translate") this._tabTranslate(body);
    else if (this._tab === "data") this._tabData(body);
    else this._tabAbout(body);
  }

  // Lifetime reading stats card
  _statsCard(c: HTMLElement) {
    const st = readingStats(this.plugin.settings.readingLog, this.plugin.settings.lifetimeSeconds, readerTodayKey());
    const card = c.createDiv({ cls: "er-stats" });

    const head = card.createDiv({ cls: "er-stats-head" });
    const total = head.createDiv({ cls: "er-stats-total" });
    total.createDiv({ cls: "er-stats-big", text: fmtReadTime(st.total) });
    total.createDiv({ cls: "er-stats-cap", text: __ertr("all-time with books") });

    if (st.streak > 0) {
      const fl = head.createDiv({ cls: "er-stats-streak" });
      fl.createSpan({ cls: "er-stats-flame", text: "🔥" });
      fl.createSpan({ text: __ertr("{0} days in a row", st.streak) });
    }

    const grid = card.createDiv({ cls: "er-stats-grid" });
    const cell = (label: string, value: string) => {
      const d = grid.createDiv({ cls: "er-stats-cell" });
      d.createDiv({ cls: "er-stats-val", text: value });
      d.createDiv({ cls: "er-stats-lab", text: label });
    };

    cell(__ertr("today"), fmtReadTime(st.today));
    cell(__ertr("days with a book"), st.daysRead ? String(st.daysRead) : "—");
    cell(__ertr("daily average"), fmtReadTime(st.avgPerDay));
    cell(__ertr("best day"), fmtReadTime(st.best));

    const peak = st.recent.reduce((a: number, r: unknown) => Math.max(a, r.sec), 0);
    if (peak > 0) {
      const chart = card.createDiv({ cls: "er-stats-chart" });
      const bars = chart.createDiv({ cls: "er-stats-bars" });
      for (const r of st.recent) {
        const col = bars.createDiv({ cls: "er-stats-col" });
        const barWrap = col.createDiv({ cls: "er-stats-bwrap" });
        const fill = barWrap.createDiv({ cls: "er-stats-bfill" });
        const pct = Math.round((r.sec / peak) * 100);
        fill.style.height = `${pct}%`;
        if (r.sec === 0) fill.addClass("er-stats-zero");
        col.createDiv({ cls: "er-stats-day", text: r.day });
      }
      const leg = chart.createDiv({ cls: "er-stats-leg" });
      leg.createSpan({ text: __ertr("14 days ago") });
      leg.createSpan({ text: __ertr("today") });
    }
  }

  // ── Tab: Reading ──────────────────────────────────────────────────────────
  _tabReading(c: HTMLElement) {
    this._statsCard(c);

    new Setting(c).setClass("er-set-h").setName(__ertr("Page & Navigation")).setHeading();

    new Setting(c)
      .setName(__ertr("Line width"))
      .setDesc(__ertr("Sets how many characters fit on a line. Shorter lines are easier to read."))
      .addDropdown((d) => d
        .addOption("0", __ertr("Full width"))
        .addOption("60", "60")
        .addOption("70", "70")
        .addOption("80", "80")
        .addOption("90", "90")
        .setValue(String(this.plugin.settings.maxLineCh || 0))
        .onChange(async (v) => {
          this.plugin.settings.maxLineCh = Number(v) || 0;
          await this.plugin.saveAll();
          this._refreshReaderViews();
        }));

    new Setting(c)
      .setName(__ertr("Page turning"))
      .setDesc(__ertr("\"Buttons\" — arrows/keys/swipe. \"By click\" — clicking the left/right part of the page turns back/forward (the center stays free for selecting text)."))
      .addDropdown((d) => d
        .addOption("buttons", __ertr("Buttons"))
        .addOption("click", __ertr("By mouse click"))
        .setValue(this.plugin.settings.navMode || "buttons")
        .onChange(async (v) => {
          this.plugin.settings.navMode = v;
          await this.plugin.saveAll();
        }));

    new Setting(c)
      .setName(__ertr("Page-turn animation"))
      .setDesc(__ertr("The page slides sideways as it turns — that movement is what shows the book moved, and which way. Independent of the system's \"reduce motion\" setting: that one drops decoration, this is feedback. Turn it off if you prefer pages to switch instantly."))
      .addToggle((t) => t.setValue(this.plugin.settings.pageTurnAnimation !== false).onChange(async (v) => {
        this.plugin.settings.pageTurnAnimation = v;
        await this.plugin.saveAll();
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          const view: unknown = leaf.view;
          if (view && view.pager && view.pager.flow) {
            view.pager.animate = v;
            view.pager.flow.toggleClass("er-flow-anim", v);
          }
        }
      }));

    new Setting(c)
      .setName(__ertr("How to read"))
      .setDesc(__ertr("\"Pages\" splits the text into spreads you turn like a book. \"Scrolling\" is one long column you move with a finger or the wheel, like a web page. \"Realistic flip\" renders smooth 3D page turning like a real book. Reopen the book to apply."))
      .addDropdown((d) => d
        .addOption("pages", __ertr("In pages"))
        .addOption("scroll", __ertr("By scrolling"))
        .addOption("flip", __ertr("Realistic flip (Flip book)"))
        .setValue(this.plugin.settings.readMode || "pages")
        .onChange(async (v) => {
          this.plugin.settings.readMode = v;
          await this.plugin.saveAll();
          this._refreshReaderViews();
        }));

    new Setting(c).setClass("er-set-h").setName(__ertr("Reading goal")).setHeading();

    new Setting(c)
      .setName(__ertr("Reading-goal timer"))
      .setDesc(__ertr("A countdown to your daily goal (for example, 15 minutes) — how much is left to read. Started MANUALLY with the ▶ button at the top of the reader, next to \"Save\" (pause — ⏸)."))
      .addToggle((t) => t.setValue(this.plugin.settings.timerEnabled !== false).onChange(async (v) => {
        this.plugin.settings.timerEnabled = v;
        await this.plugin.saveAll();
      }));

    new Setting(c)
      .setName(__ertr("Daily goal, minutes"))
      .setDesc(__ertr("How many minutes a day you want to read. Today's progress is in the card at the top of this tab."))
      .addSlider((sl) => sl.setLimits(5, 120, 5).setValue(this.plugin.settings.dailyGoalMin || 15).onChange(async (v) => {
        this.plugin.settings.dailyGoalMin = v;
        await this.plugin.saveAll();
      }));
  }

  // ── Tab: Appearance ───────────────────────────────────────────────────────
  _groupAppearance(c: HTMLElement) {
    new Setting(c).setName(__ertr("Theme & Colors")).setHeading();

    new Setting(c)
      .setName(__ertr("Reader theme"))
      .setDesc(__ertr("The color palette used for the book reader background, paper and typography."))
      .addDropdown((d) => d
        .addOption("auto", __ertr("Follow Obsidian (Auto)"))
        .addOption("light", __ertr("Light paper"))
        .addOption("dark", __ertr("Dark paper"))
        .addOption("sepia", __ertr("Warm sepia"))
        .addOption("eink", __ertr("E-ink high contrast"))
        .setValue(this.plugin.settings.theme || "auto")
        .onChange(async (v) => {
          this.plugin.settings.theme = v;
          if (v === "eink") this.plugin.settings.einkMode = true;
          else if (this.plugin.settings.einkMode) this.plugin.settings.einkMode = false;
          await this.plugin.saveAll();
          this._applyThemeToViews();
        }));

    new Setting(c)
      .setName(__ertr("Library theme"))
      .setDesc(__ertr("The color theme for the library shelf and book cards."))
      .addDropdown((d) => d
        .addOption("auto", __ertr("Follow Obsidian (Auto)"))
        .addOption("reader", __ertr("Same as book reader"))
        .addOption("light", __ertr("Light"))
        .addOption("dark", __ertr("Dark"))
        .addOption("sepia", __ertr("Sepia"))
        .setValue(this.plugin.settings.libTheme || "auto")
        .onChange(async (v) => {
          this.plugin.settings.libTheme = v;
          await this.plugin.saveAll();
        }));

    new Setting(c)
      .setName(__ertr("Library cover card size"))
      .setDesc(__ertr("Width of book cover cards on the library shelf (120px - 280px)."))
      .addSlider((sl) => sl.setLimits(120, 280, 8).setValue(this.plugin.settings.libCoverSize || 176).onChange(async (v) => {
        this.plugin.settings.libCoverSize = v;
        await this.plugin.saveAll();
      }));

    new Setting(c).setName(__ertr("Typography & Columns")).setHeading();

    new Setting(c)
      .setName(__ertr("Font family"))
      .setDesc(__ertr("Typeface used for the book text."))
      .addDropdown((d) => d
        .addOption("bookerly", "Bookerly (amazon serif)")
        .addOption("caecilia", "Caecilia (slab serif)")
        .addOption("georgia", "Georgia (serif)")
        .addOption("lora", "Lora (book serif)")
        .addOption("inter", "Inter (clean sans-serif)")
        .setValue(this.plugin.settings.fontFamily || "georgia")
        .onChange(async (v) => {
          this.plugin.settings.fontFamily = v;
          await this.plugin.saveAll();
          this._applyThemeToViews();
        }));

    new Setting(c)
      .setName(__ertr("Font size"))
      .setDesc(__ertr("Size of the book text in pixels."))
      .addSlider((sl) => sl.setLimits(12, 34, 1).setValue(this.plugin.settings.fontSize || 18).onChange(async (v) => {
        this.plugin.settings.fontSize = v;
        await this.plugin.saveAll();
        this._applyThemeToViews();
      }));

    new Setting(c)
      .setName(__ertr("Line spacing"))
      .setDesc(__ertr("Relative line height multiplier for text lines."))
      .addSlider((sl) => sl.setLimits(1.2, 2.4, 0.1).setValue(this.plugin.settings.lineHeight || 1.8).onChange(async (v) => {
        this.plugin.settings.lineHeight = v;
        await this.plugin.saveAll();
        this._applyThemeToViews();
      }));

    new Setting(c)
      .setName(__ertr("Number of columns"))
      .setDesc(__ertr("Display one page column or two pages side-by-side (two pages require wide screen)."))
      .addDropdown((d) => d
        .addOption("1", __ertr("One page"))
        .addOption("2", __ertr("Two pages"))
        .setValue(String(this.plugin.settings.columns || "2"))
        .onChange(async (v) => {
          this.plugin.settings.columns = v;
          await this.plugin.saveAll();
          this._refreshReaderViews();
        }));

    new Setting(c)
      .setName(__ertr("Text alignment"))
      .setDesc(__ertr("How text is aligned in the reading column."))
      .addDropdown((d) => d
        .addOption("left", __ertr("Left"))
        .addOption("justify", __ertr("Justify"))
        .addOption("center", __ertr("Center"))
        .addOption("right", __ertr("Right"))
        .setValue(this.plugin.settings.textAlign || "left")
        .onChange(async (v) => {
          this.plugin.settings.textAlign = v;
          await this.plugin.saveAll();
          this._refreshReaderViews();
        }));

    new Setting(c)
      .setName(__ertr("Text position on the page"))
      .setDesc(__ertr("When a page isn't filled (at the end of a chapter, for instance), the text vertical alignment."))
      .addDropdown((d) => d
        .addOption("top", __ertr("Top"))
        .addOption("center", __ertr("Center"))
        .addOption("bottom", __ertr("Bottom"))
        .setValue(this.plugin.settings.vAlign || "top")
        .onChange(async (v) => {
          this.plugin.settings.vAlign = v;
          await this.plugin.saveAll();
          this._refreshReaderViews();
        }));

    new Setting(c).setName(__ertr("Display Features")).setHeading();

    new Setting(c)
      .setName(__ertr("Show pictures from the book"))
      .setDesc(__ertr("When a page yields text, also show illustrations, diagrams and charts above the text."))
      .addToggle((t) => t.setValue(this.plugin.settings.pdfShowFiguresOnTextPages === true).onChange(async (v) => {
        this.plugin.settings.pdfShowFiguresOnTextPages = v;
        await this.plugin.saveAll();
      }));

    new Setting(c)
      .setName(__ertr("Immersive"))
      .setDesc(__ertr("The top and bottom bars gently dim after a couple of seconds without mouse movement."))
      .addToggle((t) => t.setValue(this.plugin.settings.immersive !== false).onChange(async (v) => {
        this.plugin.settings.immersive = v;
        await this.plugin.saveAll();
      }));

    if (Platform.isMobile) {
      new Setting(c)
        .setName(__ertr("Top inset on mobile"))
        .setDesc(__ertr("Height of the status bar in pixels (usually 24-48). Zero means trust the system. Reopen the book to apply."))
        .addText((t) => t
          .setPlaceholder("0")
          .setValue(String(this.plugin.settings.mobileTopInset || 0))
          .onChange(async (v) => {
            const n = Math.max(0, Math.min(120, Number(String(v).replace(/[^\d]/g, "")) || 0));
            this.plugin.settings.mobileTopInset = n;
            await this.plugin.saveAll();
          }));
    }

    new Setting(c).setName(__ertr("Devices & Special Screens")).setHeading();

    new Setting(c)
      .setName(__ertr("A separate look on each device"))
      .setDesc(__ertr("Font size, theme, typeface, line spacing and columns are remembered separately for computer, tablet and phone. This device: {0}.",
        __ertr({ desktop: "Computer", tablet: "Tablet", phone: "Phone" }[erDeviceKey()] || "Computer")))
      .addToggle((t) => t.setValue(this.plugin.settings.perDevice === true).onChange(async (v) => {
        this.plugin.settings.perDevice = v;
        await this.plugin.saveAll();
        this._redraw();
      }));

    new Setting(c)
      .setName(__ertr("E-ink reader mode"))
      .setDesc(__ertr("For Android e-ink readers. Removes animations, shadows and blurs. Pure black on white, hard borders, bigger buttons."))
      .addToggle((t) => t.setValue(this.plugin.settings.einkMode === true).onChange(async (v) => {
        this.plugin.settings.einkMode = v;
        if (v) this.plugin.settings.theme = "eink";
        else if (this.plugin.settings.theme === "eink") this.plugin.settings.theme = "auto";
        await this.plugin.saveAll();
        this._applyThemeToViews();
      }));
  }

  // ── Tab: Notes ────────────────────────────────────────────────────────────
  _tabNotes(c: HTMLElement) {
    new Setting(c).setName(__ertr("Where notes go")).setHeading();

    new Setting(c)
      .setName(__ertr("Folder for new notes"))
      .setDesc(__ertr("Where separate highlight notes go. Empty means the vault root."))
      .addText((t) => {
        t.setPlaceholder("Inbox").setValue(this.plugin.settings.notesFolder || "");
        attachPathInput(this.app, t, async (v) => {
          this.plugin.settings.notesFolder = v;
          await this.plugin.saveAll();
        });
      });

    new Setting(c)
      .setName(__ertr("Keep notes next to the book"))
      .setDesc(__ertr("A note made from a highlight is created in the same folder as the book file."))
      .addToggle((t) => t.setValue(this.plugin.settings.notesNextToBook === true).onChange(async (v) => {
        this.plugin.settings.notesNextToBook = v;
        await this.plugin.saveAll();
      }));

    new Setting(c)
      .setName(__ertr("Where a new note opens"))
      .setDesc(__ertr("\"Beside the book\" splits the pane. \"In a new tab\" opens on top. \"Don't open it\" keeps reading uninterrupted."))
      .addDropdown((d) => d
        .addOption("split", __ertr("Beside the book"))
        .addOption("tab", __ertr("In a new tab"))
        .addOption("none", __ertr("Don't open it"))
        .setValue(this.plugin.settings.noteOpenMode || "split")
        .onChange(async (v) => {
          this.plugin.settings.noteOpenMode = v;
          await this.plugin.saveAll();
        }));

    new Setting(c)
      .setName(__ertr("Ask for the note title"))
      .setDesc(__ertr("Before a note is created, a prompt offers a short title you can edit."))
      .addToggle((t) => t.setValue(this.plugin.settings.askNoteTitle !== false).onChange(async (v) => {
        this.plugin.settings.askNoteTitle = v;
        await this.plugin.saveAll();
        this._redraw();
      }));

    if (this.plugin.settings.askNoteTitle === false) {
      new Setting(c)
        .setName(__ertr("Short titles, no questions"))
        .setDesc(__ertr("The title is chosen automatically from the passage's opening."))
        .addToggle((t) => t.setValue(this.plugin.settings.shortNoteTitles !== false).onChange(async (v) => {
          this.plugin.settings.shortNoteTitles = v;
          await this.plugin.saveAll();
        }));
    }

    new Setting(c).setName(__ertr("Quotes and highlights")).setHeading();

    new Setting(c)
      .setName(__ertr("Default highlight colour"))
      .setDesc(__ertr("Which colour to use when commenting on a passage without choosing a colour first."))
      .addDropdown((d) => {
        HL_COLORS.forEach((col: unknown) => d.addOption(col.id, col.name));
        d.setValue(this.plugin.settings.defaultHlColor || HL_COLORS[0].id)
          .onChange(async (v) => {
            this.plugin.settings.defaultHlColor = v;
            await this.plugin.saveAll();
          });
      });

    const tpl = new Setting(c)
      .setName(__ertr("Shape of a copied quote"))
      .setDesc(__ertr("What \"Copy as a quote\" puts on the clipboard. Available: {text}, {book}, {page}, {link}, {comment}."))
      .addTextArea((t) => {
        t.setPlaceholder(QUOTE_TEMPLATE_DEFAULT)
          .setValue(this.plugin.settings.quoteTemplate || "")
          .onChange(async (v) => {
            this.plugin.settings.quoteTemplate = v;
            await this.plugin.saveAll();
          });
        t.inputEl.rows = 4;
        t.inputEl.addClass("er-tpl-input");
      });
    tpl.settingEl.addClass("er-set-stacked");

    new Setting(c)
      .setName(__ertr("Link back to the book under each quote"))
      .setDesc(__ertr("Every exported quote gets a link that opens the book at the exact paragraph."))
      .addToggle((t) => t.setValue(this.plugin.settings.quoteBacklinks !== false).onChange(async (v) => {
        this.plugin.settings.quoteBacklinks = v;
        await this.plugin.saveAll();
      }));

    new Setting(c)
      .setName(__ertr("Wording of that link"))
      .setDesc(__ertr("Text used to label the backlink in notes."))
      .addText((t) => t
        .setPlaceholder(__ertr("↪ to this spot in the book"))
        .setValue(this.plugin.settings.quoteBacklinkLabel || "")
        .onChange(async (v) => {
          this.plugin.settings.quoteBacklinkLabel = v;
          await this.plugin.saveAll();
        }));

    new Setting(c)
      .setName(__ertr("Keep highlight color on export"))
      .setDesc(__ertr("Wrap quotes in a colored <mark> tag so the highlight color shows in reading mode."))
      .addToggle((t) => t.setValue(this.plugin.settings.exportColors !== false).onChange(async (v) => {
        this.plugin.settings.exportColors = v;
        await this.plugin.saveAll();
      }));

    new Setting(c).setName(__ertr("The book note")).setHeading();

    new Setting(c)
      .setName(__ertr("A separate note per book"))
      .setDesc(__ertr("On a book's first open, automatically create and link a dedicated note named after the book."))
      .addToggle((t) => t.setValue(this.plugin.settings.autoBookNote === true).onChange(async (v) => {
        this.plugin.settings.autoBookNote = v;
        await this.plugin.saveAll();
        if (v) new Notice(__ertr("A note will be created automatically upon opening each book."), 5000);
      }));

    new Setting(c)
      .setName(__ertr("Quotes straight into the book note"))
      .setDesc(__ertr("Every new highlight is appended directly into the book's note with chapter and page number."))
      .addToggle((t) => t.setValue(this.plugin.settings.quotesToBookNote === true).onChange(async (v) => {
        this.plugin.settings.quotesToBookNote = v;
        await this.plugin.saveAll();
      }));

    new Setting(c)
      .setName(__ertr("Book-notes folder (for links)"))
      .setDesc(__ertr("Where book notes live. Fills the picker when linking a note to a book."))
      .addText((t) => {
        t.setPlaceholder(__ertr("3. Resources/Book base")).setValue(this.plugin.settings.bookNotesFolder || "");
        attachPathInput(this.app, t, async (v) => {
          this.plugin.settings.bookNotesFolder = v;
          await this.plugin.saveAll();
        });
      });

    new Setting(c)
      .setName(__ertr("Progress in the book note's properties"))
      .setDesc(__ertr("Adds reading-progress (%) and reading-updated date to the book note frontmatter properties."))
      .addToggle((t) => t.setValue(this.plugin.settings.progressToFrontmatter === true).onChange(async (v) => {
        this.plugin.settings.progressToFrontmatter = v;
        await this.plugin.saveAll();
      }));

    new Setting(c).setName(__ertr("Template")).setHeading();

    new Setting(c)
      .setName(__ertr("Note template"))
      .setDesc(__ertr("Path to your template applied to new highlight notes. Example: Templates/Template.md"))
      .addText((t) => t.setPlaceholder(__ertr("Templates/Template.md")).setValue(this.plugin.settings.noteTemplate || "").onChange(async (v) => {
        this.plugin.settings.noteTemplate = v.trim();
        await this.plugin.saveAll();
      }));

    new Setting(c)
      .setName(__ertr("Keep «What's new» as a note"))
      .setDesc(__ertr("After the plugin updates, save a release summary note into your vault."))
      .addToggle((t) => t.setValue(this.plugin.settings.whatsNewNote !== false).onChange(async (v) => {
        this.plugin.settings.whatsNewNote = v;
        await this.plugin.saveAll();
      }));
  }

  // ── Tab: Translation & AI ─────────────────────────────────────────────────
  _tabTranslate(c: HTMLElement) {
    new Setting(c)
      .setName(__ertr("AI passage breakdown"))
      .setDesc(__ertr("Adds a ✨ button to the selection popup: opens a conversation to explain, translate and break down passages."))
      .addToggle((t) => t.setValue(this.plugin.settings.aiEnabled === true).onChange(async (v) => {
        this.plugin.settings.aiEnabled = v;
        await this.plugin.saveAll();
        this._redraw();
      }));

    if (this.plugin.settings.aiEnabled) {
      this._group(c, {
        name: __ertr("Where breakdowns come from"),
        desc: __ertr("Service, key and model. A local model needs no key and sends nothing to the internet."),
        build: (b, redraw) => this._groupAi(b, redraw),
      });
    }

    new Setting(c)
      .setName(__ertr("Translate button in the selection popup"))
      .setDesc(__ertr("Adds a Google Translate button to the selection popup to translate passages instantly."))
      .addToggle((t) => t.setValue(this.plugin.settings.translateEnabled === true).onChange(async (v) => {
        this.plugin.settings.translateEnabled = v;
        await this.plugin.saveAll();
      }));

    new Setting(c)
      .setName(__ertr("Translate into"))
      .setDesc(__ertr("Target language for translation."))
      .addDropdown((d) => d
        .addOption("en", "English")
        .addOption("pt", "Portuguese")
        .addOption("ru", __ertr("Russian"))
        .addOption("de", "Deutsch")
        .addOption("fr", "Français")
        .addOption("es", "Español")
        .addOption("it", "Italiano")
        .setValue(this.plugin.settings.translateTo || "en")
        .onChange(async (v) => {
          this.plugin.settings.translateTo = v;
          await this.plugin.saveAll();
        }));
  }

  _groupAi(c: HTMLElement, redraw: () => void) {
    const s = this.plugin.settings;

    new Setting(c)
      .setName(__ertr("Service"))
      .setDesc(__ertr("Which AI service provides passage explanations."))
      .addDropdown((d) => {
        for (const [id, prov] of Object.entries(AI_PROVIDERS)) {
          d.addOption(id, prov.label);
        }
        const provKey = (s.aiProvider && AI_PROVIDERS[s.aiProvider]) ? s.aiProvider : "openrouter";
        d.setValue(provKey).onChange(async (v) => {
          s.aiProvider = v;
          s.aiModel = "";
          await this.plugin.saveAll();
          redraw();
        });
      });

    const activeProv = AI_PROVIDERS[s.aiProvider] || AI_PROVIDERS.openrouter;
    if (activeProv.needsKey) {
      new Setting(c)
        .setName(__ertr("API Key"))
        .setDesc(__ertr("Your API key for {0}.", activeProv.label))
        .addText((t) => {
          t.inputEl.type = "password";
          t.setValue(s.aiKey || "").onChange(async (v) => {
            s.aiKey = v.trim();
            await this.plugin.saveAll();
          });
        });
    }

    new Setting(c)
      .setName(__ertr("Model"))
      .setDesc(__ertr("Leave empty to use default ({0}).", activeProv.model || ""))
      .addText((t) => t
        .setPlaceholder(activeProv.model || "")
        .setValue(s.aiModel || "")
        .onChange(async (v) => {
          s.aiModel = v.trim();
          await this.plugin.saveAll();
        }));

    new Setting(c)
      .setName(__ertr("Custom Base URL"))
      .setDesc(__ertr("API endpoint URL. Default: {0}", activeProv.base || ""))
      .addText((t) => t
        .setPlaceholder(activeProv.base || "")
        .setValue(s.aiBase || "")
        .onChange(async (v) => {
          s.aiBase = v.trim();
          await this.plugin.saveAll();
        }));

    new Setting(c)
      .setName(__ertr("Your own system prompt"))
      .setDesc(__ertr("Instructions sent to the AI before every query."))
      .addTextArea((t) => {
        t.inputEl.rows = 4;
        t.setValue(s.aiSystem || "").onChange(async (v) => {
          s.aiSystem = v;
          await this.plugin.saveAll();
        });
      });

    new Setting(c)
      .setName(__ertr("Answer in"))
      .setDesc(__ertr("Which language to write the explanation in."))
      .addText((t) => t.setPlaceholder("English").setValue(s.aiInto || "English").onChange(async (v) => {
        s.aiInto = v.trim() || "English";
        await this.plugin.saveAll();
      }));
  }

  // ── Tab: Data & Storage ───────────────────────────────────────────────────
  _tabData(c: HTMLElement) {
    new Setting(c)
      .setName(__ertr("Books folder"))
      .setDesc(__ertr("Folder where books are stored. Empty = search whole vault."))
      .addText((t) => {
        t.setPlaceholder("Books").setValue(this.plugin.settings.booksFolder || "");
        attachPathInput(this.app, t, async (v) => {
          this.plugin.settings.booksFolder = v;
          await this.plugin._saveLocalData();
          await this.plugin.saveAll();
        });
      });

    new Setting(c)
      .setName(__ertr("Reading-data folder"))
      .setDesc(__ertr("Where progress, highlights and backups are saved (reading-progress.json). Empty = next to books."))
      .addText((t) => {
        t.setPlaceholder(__ertr("Next to the books")).setValue(this.plugin.settings.dataFolder || "");
        attachPathInput(this.app, t, async (v) => {
          this.plugin.settings.dataFolder = v;
          await this.plugin._saveLocalData();
          await this.plugin.saveAll();
        });
      });

    new Setting(c).setName(__ertr("Syncing across devices")).setHeading();

    new Setting(c)
      .setName(__ertr("Sync method"))
      .setDesc(__ertr("How reading progress is synchronized across devices."))
      .addDropdown((d) => d
        .addOption("auto", __ertr("Auto (recommended)"))
        .addOption("obsidian", "Obsidian Sync")
        .addOption("remotely", "Remotely save / self-hosted")
        .addOption("cloud", __ertr("iCloud / Google Drive / folder"))
        .addOption("none", __ertr("No syncing"))
        .setValue(this.plugin.settings.syncMode || "auto")
        .onChange(async (v) => {
          this.plugin.settings.syncMode = v;
          await this.plugin.saveAll();
          this._redraw();
        }));

    new Setting(c).setName(__ertr("Cleanup")).setHeading();

    const thumbSet = new Setting(c)
      .setName(__ertr("Cover cache"))
      .setDesc(__ertr("Saved covers: {0}", Object.keys(this.plugin.thumbCache || {}).length))
      .addButton((b) => b.setButtonText(__ertr("Clear")).onClick(async () => {
        this.plugin.thumbCache = {};
        await this.plugin._saveThumbCache();
        new Notice(__ertr("Cache cleared"));
        thumbSet.setDesc(__ertr("Saved covers: {0}", 0));
      }));

    const progSet = new Setting(c)
      .setName(__ertr("Progress"))
      .setDesc(__ertr("Tracked books: {0}", Object.keys(this.plugin.progress || {}).length))
      .addButton((b) => b.setButtonText(__ertr("Clear")).setClass("mod-warning").onClick(async () => {
        this.plugin.progress = {};
        await this.plugin.saveAll();
        new Notice(__ertr("Progress cleared"));
        progSet.setDesc(__ertr("Tracked books: {0}", 0));
      }));

    const hlCount = Object.values(this.plugin.highlights || {}).reduce((s: number, a: unknown) => s + (Array.isArray(a) ? a.length : 0), 0);
    const hlSet = new Setting(c)
      .setName(__ertr("Highlights"))
      .setDesc(__ertr("Total highlights: {0}", hlCount))
      .addButton((b) => b.setButtonText(__ertr("Clear all")).setClass("mod-warning").onClick(async () => {
        this.plugin.highlights = {};
        await this.plugin._saveHighlightsToVault();
        new Notice(__ertr("Highlights cleared"));
        hlSet.setDesc(__ertr("Total highlights: {0}", 0));
      }));

    const memCount = () => {
      const s = this.plugin.settings;
      return new Set([
        ...Object.keys(s.bookNoteLinks || {}),
        ...Object.keys(s.bookNotePrompted || {}),
        ...Object.keys(s.bookTags || {}),
        ...Object.keys(s.bookTemplates || {})
      ]).size;
    };

    const memSet = new Setting(c)
      .setName(__ertr("What the reader remembers"))
      .setDesc(__ertr("Books: {0}. Linked notes, categories, per-book templates and prompted flags.", memCount()));

    let armed = false;
    memSet.addButton((b) => b.setButtonText(__ertr("Forget all books")).setClass("mod-warning").onClick(async () => {
      if (!armed) {
        armed = true;
        b.setButtonText(__ertr("Really forget?"));
        window.setTimeout(() => {
          if (armed) {
            armed = false;
            b.setButtonText(__ertr("Forget all books"));
          }
        }, 4000);
        return;
      }
      armed = false;
      b.setButtonText(__ertr("Forget all books"));
      const s = this.plugin.settings;
      s.bookNoteLinks = {};
      s.bookNotePrompted = {};
      s.bookTags = {};
      s.bookTemplates = {};
      await this.plugin.saveAll();
      new Notice(__ertr("Done — the reader will ask about note setup again on next book open"));
      memSet.setDesc(__ertr("Books: {0}. Linked notes, categories, per-book templates and prompted flags.", 0));
    }));
  }

  // ── Tab: About ────────────────────────────────────────────────────────────
  _tabAbout(c: HTMLElement) {
    new Setting(c).setName(__ertr("Help & Documentation")).setHeading();

    new Setting(c)
      .setName(__ertr("Plugin guide"))
      .setDesc(__ertr("Interactive guide walkthrough: formats, gestures, highlights, notes, sync and settings tour."))
      .addButton((b) => b
        .setButtonText(__ertr("Open guide"))
        .onClick(() => new OnboardingModal(this.app, this.plugin).open()));

    new Setting(c)
      .setName(__ertr("What's new"))
      .setDesc(__ertr("List of new features, bug fixes and performance improvements in recent versions."))
      .addButton((b) => b
        .setButtonText(__ertr("Show"))
        .onClick(() => new WhatsNewModal(this.app, this.plugin, WHATS_NEW.slice(0, 4)).open()));

    new Setting(c).setName(__ertr("Support & development")).setHeading();

    new Setting(c)
      .setName(__ertr("Buy me a coffee"))
      .setDesc(__ertr("If you enjoy using Kindle Reader and want to support continued development, consider buying me a coffee!"))
      .addButton((b) => b
        .setButtonText(__ertr("Support the project ☕"))
        .setCta()
        .onClick(() => {
          window.open("https://buymeacoffee.com/bernardonogueira8", "_blank");
        }));

    const aboutCard = c.createDiv({ cls: "er-set-note er-about-card" });
    aboutCard.createDiv({ cls: "er-about-title", text: "Kindle Reader" });
    aboutCard.createEl("p", {
      text: __ertr("Version {0}. Read EPUB, FB2 and PDF books with realistic flip, highlights, and vault-synced progress.", this.plugin.manifest.version)
    });
    const sub = aboutCard.createDiv();
    sub.createSpan({ text: __ertr("Kindle Reader for Obsidian. Extended and maintained with modern TypeScript and responsive UI.") });
  }

  private _refreshReaderViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      const view: unknown = leaf.view;
      if (view && view.bookHtml && typeof view.repaginate === "function") {
        view.repaginate();
      }
    }
  }

  private _applyThemeToViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      const view: unknown = leaf.view;
      if (view && typeof view.applyVars === "function") {
        view.applyVars();
        if (view.bookHtml && typeof view.repaginate === "function") {
          view.repaginate();
        }
      }
    }
  }
}