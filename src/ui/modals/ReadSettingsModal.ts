import { App, Modal, Notice, Platform, TFile } from 'obsidian';
import { __ertr } from '../../utils/i18n';
import { erTheme, FONTS } from '../../utils/theme';
import { svgIcon, iconLabel } from '../../utils/icons';
import { InfoModal } from './InfoModal';

interface ReaderSettingsLike {
  theme?: string;
  einkMode?: boolean;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  paragraphSpacing?: number;
  wordSpacing?: number;
  letterSpacing?: number;
  pageMargin?: string;
  columns?: string;
  readMode?: string;
  maxLineCh?: number;
  navMode?: string;
  textAlign?: string;
  vAlign?: string;
  timerEnabled?: boolean;
  dailyGoalMin?: number;
  bookNoteLinks?: Record<string, string>;
  bookNotePrompted?: Record<string, boolean>;
  bookTags?: Record<string, string>;
  bookTemplates?: Record<string, string>;
  [key: string]: unknown;
}

interface ReaderPluginLike {
  settings: ReaderSettingsLike;
  saveAll: () => Promise<void>;
  saveNow: (path: string, spread: number, total: number, block?: number | null) => void;
  saveProgress: (path: string, cur: number, total: number, block?: number | null) => void;
  getTodaySeconds: () => number;
  getTotalSeconds: () => number;
  getGoalSeconds: () => number;
  getBackups?: (path: string) => Array<{ label: string; spread: number; block?: number }>;
  [key: string]: unknown;
}

export interface ReaderViewLike {
  app: App;
  plugin: ReaderPluginLike;
  file?: TFile | null;
  bookHtml?: string;
  pager?: {
    spread: number;
    total: number;
    currentBlockIndex: () => number | null;
    spreadForBlock: (block: number) => number;
    jumpTo: (spread: number) => [number, number];
    scrollMode?: boolean;
  };
  contentEl?: HTMLElement;
  containerEl?: HTMLElement;
  applyVars?: () => void;
  _applyTheme?: () => void;
  repaginate?: () => Promise<void>;
  _repaginate?: () => Promise<void>;
  updateUI?: (cur?: number, tot?: number) => void;
  _updateUI?: (cur?: number, tot?: number) => void;
  openFile?: (file: TFile) => Promise<void>;
  _loadBook?: () => Promise<void>;
  _renderHistory?: () => void;
  _histRow?: HTMLElement | null;
  goalWrapEl?: HTMLElement;
  goalFillEl?: HTMLElement;
  goalTxtEl?: HTMLElement;
}

function isPhoneDevice(): boolean {
  try {
    if (Platform && Platform.isPhone) return true;
  } catch {
    /* fallback */
  }
  return false;
}

export class ReadSettingsModal extends Modal {
  view: ReaderViewLike;
  private previewCardEl: HTMLElement | null = null;
  private previewTextEl: HTMLElement | null = null;
  private previewHeaderEl: HTMLElement | null = null;
  private _saveT?: number;
  private activeTab: 'appearance' | 'layout' | 'reading' = 'appearance';
  private tabContentContainer: HTMLElement | null = null;
  private tabButtons: Map<string, HTMLElement> = new Map();

  constructor(app: App, view: ReaderViewLike) {
    super(app);
    this.view = view;
  }

  async _apply(needsRecalculation: boolean): Promise<void> {
    const v = this.view;
    if (this._saveT) window.clearTimeout(this._saveT);
    this._saveT = window.setTimeout(() => {
      void v.plugin.saveAll();
    }, 400);

    if (typeof v.applyVars === 'function') v.applyVars();
    if (typeof v._applyTheme === 'function') v._applyTheme();

    if (needsRecalculation && v.bookHtml) {
      let block: number | null = null;
      try {
        block = v.pager ? v.pager.currentBlockIndex() : null;
      } catch {
        /* optional */
      }
      if (v.file && v.pager && typeof block === 'number' && block >= 0) {
        v.plugin.saveNow(v.file.path, v.pager.spread, v.pager.total, block);
      }
      if (typeof v.repaginate === 'function') await v.repaginate();
      else if (typeof v._repaginate === 'function') await v._repaginate();

      if (v.pager && typeof block === 'number' && block >= 0) {
        const [cur, tot] = v.pager.jumpTo(v.pager.spreadForBlock(block));
        const ui = v.updateUI || v._updateUI;
        if (typeof ui === 'function') ui.call(v, cur, tot);
        if (v.file) v.plugin.saveNow(v.file.path, cur, tot, block);
      }
    }
    this._paintPreview();
  }

  _paintPreview(): void {
    if (!this.previewCardEl || !this.previewTextEl) return;
    const s = this.view.plugin.settings;
    const t = erTheme(s);

    this.previewCardEl.setCssStyles({
      backgroundColor: t.bg,
      borderColor: t.border,
      color: t.text,
    });

    let previewPadH = 16;
    if (s.pageMargin === 'compact') previewPadH = 6;
    else if (s.pageMargin === 'wide') previewPadH = 32;
    else if (s.pageMargin === 'extra') previewPadH = 50;

    this.previewTextEl.setCssStyles({
      fontFamily: FONTS[s.fontFamily || ''] || FONTS.georgia,
      fontSize: `${s.fontSize || 18}px`,
      lineHeight: String(s.lineHeight ?? 1.8),
      letterSpacing: `${s.letterSpacing ?? 0}px`,
      wordSpacing: `${s.wordSpacing ?? 0}px`,
      textAlign: s.textAlign || 'left',
      paddingLeft: `${previewPadH}px`,
      paddingRight: `${previewPadH}px`,
      color: t.text,
    });

    const pSpacing = s.paragraphSpacing ?? 0.75;
    const pEls = this.previewTextEl.querySelectorAll<HTMLElement>('.er-rs-preview-p');
    pEls.forEach((p, idx) => {
      p.setCssStyles({
        marginBottom: idx === pEls.length - 1 ? '0' : `${pSpacing}em`,
      });
    });
  }

  onOpen(): void {
    this.modalEl.addClass('er-rs-modal');
    const c = this.contentEl;
    c.empty();
    c.addClass('er-rs-root');

    // Header bar
    const hdr = c.createDiv('er-rs-header');
    const hdrLeft = hdr.createDiv('er-rs-hdr-left');
    const iconWrap = hdrLeft.createDiv('er-rs-hdr-icon');
    svgIcon(iconWrap, 'sliders');
    const title = hdrLeft.createDiv('er-rs-hdr-title');
    title.setText(__ertr('Reading settings'));

    const closeBtn = hdr.createDiv('er-rs-hdr-close');
    svgIcon(closeBtn, 'x');
    closeBtn.setAttribute('aria-label', __ertr('Close the book'));
    closeBtn.addEventListener('click', () => this.close());

    // Live Preview Card
    this.buildLivePreview(c);

    // Navigation Tabs
    const tabNav = c.createDiv('er-rs-nav-tabs');
    const tabs: Array<{ id: 'appearance' | 'layout' | 'reading'; label: string; iconName: string }> = [
      { id: 'appearance', label: __ertr('Appearance'), iconName: 'sparkles' },
      { id: 'layout', label: __ertr('Page'), iconName: 'cover-fit' },
      { id: 'reading', label: __ertr('Reading'), iconName: 'bookmark' },
    ];

    tabs.forEach((tab) => {
      const btn = tabNav.createDiv('er-rs-nav-btn');
      if (tab.id === this.activeTab) btn.addClass('active');
      const ic = btn.createSpan('er-rs-nav-ic');
      svgIcon(ic, tab.iconName);
      btn.createSpan({ text: tab.label });

      btn.addEventListener('click', () => {
        if (this.activeTab === tab.id) return;
        this.activeTab = tab.id;
        this.tabButtons.forEach((b, k) => b.toggleClass('active', k === tab.id));
        this.renderActiveTabContent();
      });
      this.tabButtons.set(tab.id, btn);
    });

    // Content container for tabs
    this.tabContentContainer = c.createDiv('er-rs-tab-body');
    this.renderActiveTabContent();

    // Footer
    this.buildFooter(c);
  }

  private buildLivePreview(host: HTMLElement): void {
    const card = host.createDiv('er-rs-preview-card');
    this.previewCardEl = card;

    const topBar = card.createDiv('er-rs-preview-topbar');
    const badge = topBar.createSpan('er-rs-preview-badge');
    badge.setText(__ertr('This is what the book text will look like'));

    if (this.view.file) {
      const bookLabel = topBar.createSpan('er-rs-preview-booktitle');
      bookLabel.setText(this.view.file.basename);
    }

    const body = card.createDiv('er-rs-preview-content');
    this.previewTextEl = body;

    const p1 = body.createEl('p', { cls: 'er-rs-preview-p' });
    p1.setText(
      __ertr(
        'A verdadeira leitura transforma o silêncio em imaginação. Ajuste o tamanho da fonte, as margens e os espaçamentos para criar o ambiente ideal de foco.'
      )
    );

    const p2 = body.createEl('p', { cls: 'er-rs-preview-p' });
    p2.setText(
      __ertr(
        'Cada página traz uma experiência única com conforto visual e harmonia tipográfica.'
      )
    );

    this._paintPreview();
  }

  private renderActiveTabContent(): void {
    if (!this.tabContentContainer) return;
    this.tabContentContainer.empty();

    if (this.activeTab === 'appearance') {
      this.buildAppearanceTab(this.tabContentContainer);
    } else if (this.activeTab === 'layout') {
      this.buildLayoutTab(this.tabContentContainer);
    } else if (this.activeTab === 'reading') {
      this.buildReadingTab(this.tabContentContainer);
    }
  }

  // --- TAB 1: APARÊNCIA & TIPOGRAFIA ---
  private buildAppearanceTab(host: HTMLElement): void {
    const s = this.view.plugin.settings;

    // Theme Section
    const themeSec = host.createDiv('er-rs-sec-card');
    themeSec.createDiv('er-rs-sec-title').setText(__ertr('Theme'));

    const themeGrid = themeSec.createDiv('er-rs-theme-grid');
    const themes: Array<{ id: string; name: string; bg: string; text: string; isEink?: boolean }> = [
      { id: 'auto', name: __ertr('Match Obsidian'), bg: 'var(--background-primary)', text: 'var(--text-normal)' },
      { id: 'light', name: __ertr('Light'), bg: '#faf8f3', text: '#1a1a2e' },
      { id: 'sepia', name: 'Sepia', bg: '#f5efe3', text: '#2c2416' },
      { id: 'dark', name: __ertr('Dark'), bg: '#12121a', text: '#ddd8f0' },
      { id: 'eink', name: 'E-ink', bg: '#ffffff', text: '#000000', isEink: true },
    ];

    const currentTheme = s.einkMode ? 'eink' : s.theme || 'auto';

    themes.forEach((th) => {
      const chip = themeGrid.createDiv('er-rs-theme-chip');
      if (th.id === currentTheme) chip.addClass('active');

      const circle = chip.createDiv('er-rs-theme-circle');
      circle.style.backgroundColor = th.bg;
      circle.style.borderColor = th.isEink ? '#000000' : 'rgba(128, 128, 128, 0.3)';

      const innerDot = circle.createDiv('er-rs-theme-dot');
      innerDot.style.backgroundColor = th.text;

      const lbl = chip.createDiv('er-rs-theme-label');
      lbl.setText(th.name);

      if (th.id === currentTheme) {
        const check = chip.createDiv('er-rs-theme-check');
        svgIcon(check, 'check');
      }

      chip.addEventListener('click', async () => {
        if (th.id === 'eink') {
          s.einkMode = true;
        } else {
          s.einkMode = false;
          s.theme = th.id;
        }
        await this._apply(false);
        this.renderActiveTabContent();
      });
    });

    // Font Section
    const fontSec = host.createDiv('er-rs-sec-card');
    fontSec.createDiv('er-rs-sec-title').setText(__ertr('Font'));

    const fontRow = fontSec.createDiv('er-rs-font-row');
    const fontList = [
      { key: 'bookerly', name: 'Bookerly', desc: 'Amazon Serif' },
      { key: 'caecilia', name: 'Caecilia', desc: 'Slab Serif' },
      { key: 'georgia', name: 'Georgia', desc: 'Serif Clássica' },
      { key: 'lora', name: 'Lora', desc: 'Serif Literária' },
      { key: 'inter', name: 'Inter', desc: 'Sans-serif Limpa' },
    ];

    const currentFont = s.fontFamily || 'georgia';

    fontList.forEach((f) => {
      const chip = fontRow.createDiv('er-rs-font-chip');
      chip.style.fontFamily = FONTS[f.key] || FONTS.georgia;
      if (f.key === currentFont) chip.addClass('active');

      const topName = chip.createDiv('er-rs-font-name');
      topName.setText(f.name);

      const subDesc = chip.createDiv('er-rs-font-sub');
      subDesc.setText(f.desc);

      chip.addEventListener('click', async () => {
        s.fontFamily = f.key;
        await this._apply(true);
        fontRow.querySelectorAll('.er-rs-font-chip').forEach((el) => el.removeClass('active'));
        chip.addClass('active');
      });
    });

    // Font Size Stepper & Slider
    const szSec = host.createDiv('er-rs-sec-card');
    const szHdr = szSec.createDiv('er-rs-sec-hdr-row');
    szHdr.createDiv('er-rs-sec-title').setText(__ertr('Font size'));
    const szBadge = szHdr.createDiv('er-rs-badge');
    const currentSize = s.fontSize || 18;
    szBadge.setText(`${currentSize}px`);

    const szControl = szSec.createDiv('er-rs-stepper-control');

    const szMinus = szControl.createDiv('er-rs-stepper-btn');
    szMinus.setText('A−');
    szMinus.setAttribute('aria-label', __ertr('Decrease font size'));

    const slider = szControl.createEl('input', { type: 'range' });
    slider.addClass('er-rs-range');
    slider.min = '12';
    slider.max = '34';
    slider.step = '1';
    slider.value = String(currentSize);

    const szPlus = szControl.createDiv('er-rs-stepper-btn');
    szPlus.setText('A+');
    szPlus.setAttribute('aria-label', __ertr('Increase font size'));

    const updateSize = async (newVal: number) => {
      const clamped = Math.min(34, Math.max(12, newVal));
      s.fontSize = clamped;
      slider.value = String(clamped);
      szBadge.setText(`${clamped}px`);
      await this._apply(true);
    };

    szMinus.addEventListener('click', () => updateSize((s.fontSize || 18) - 1));
    szPlus.addEventListener('click', () => updateSize((s.fontSize || 18) + 1));
    slider.addEventListener('input', () => {
      szBadge.setText(`${slider.value}px`);
    });
    slider.addEventListener('change', () => {
      void updateSize(Number(slider.value));
    });
  }

  private addSliderItem(
    container: HTMLElement,
    options: {
      title: string;
      value: number;
      min: number;
      max: number;
      step: number;
      minusLabel?: string;
      plusLabel?: string;
      format: (val: number) => string;
      onInput?: (val: number) => void;
      onChange: (val: number) => Promise<void> | void;
    }
  ): void {
    const item = container.createDiv('er-rs-slider-item');
    const hdr = item.createDiv('er-rs-slider-header');
    hdr.createDiv('er-rs-slider-label').setText(options.title);
    const badge = hdr.createDiv('er-rs-badge');
    badge.setText(options.format(options.value));

    const ctrl = item.createDiv('er-rs-stepper-control');
    const minusBtn = ctrl.createDiv('er-rs-stepper-btn');
    minusBtn.setText(options.minusLabel ?? '−');
    minusBtn.setAttribute('aria-label', `${__ertr('Decrease')} ${options.title}`);

    const slider = ctrl.createEl('input', { type: 'range' });
    slider.addClass('er-rs-range');
    slider.min = String(options.min);
    slider.max = String(options.max);
    slider.step = String(options.step);
    slider.value = String(options.value);

    const plusBtn = ctrl.createDiv('er-rs-stepper-btn');
    plusBtn.setText(options.plusLabel ?? '+');
    plusBtn.setAttribute('aria-label', `${__ertr('Increase')} ${options.title}`);

    const applyValue = async (newVal: number) => {
      const clamped = Math.min(options.max, Math.max(options.min, Math.round(newVal * 100) / 100));
      slider.value = String(clamped);
      badge.setText(options.format(clamped));
      await options.onChange(clamped);
    };

    minusBtn.addEventListener('click', () => {
      const cur = Number(slider.value);
      void applyValue(cur - options.step);
    });

    plusBtn.addEventListener('click', () => {
      const cur = Number(slider.value);
      void applyValue(cur + options.step);
    });

    slider.addEventListener('input', () => {
      const cur = Number(slider.value);
      badge.setText(options.format(cur));
      if (options.onInput) {
        options.onInput(cur);
      }
    });

    slider.addEventListener('change', () => {
      void applyValue(Number(slider.value));
    });
  }

  // --- TAB 2: LAYOUT DA PÁGINA ---
  private buildLayoutTab(host: HTMLElement): void {
    const s = this.view.plugin.settings;

    // Text Spacing (Espaçamento do texto)
    const spacingSec = host.createDiv('er-rs-sec-card');
    spacingSec.createDiv('er-rs-sec-title').setText(__ertr('Text spacing'));
    const spacingGroup = spacingSec.createDiv('er-rs-slider-group');

    // 1. Entre linhas
    this.addSliderItem(spacingGroup, {
      title: __ertr('Line spacing'),
      value: s.lineHeight ?? 1.8,
      min: 1.1,
      max: 2.6,
      step: 0.05,
      format: (v) => `${v.toFixed(2)}x`,
      onInput: (v) => {
        s.lineHeight = v;
        this._paintPreview();
      },
      onChange: async (v) => {
        s.lineHeight = v;
        await this._apply(true);
      },
    });

    // 2. Entre parágrafos
    this.addSliderItem(spacingGroup, {
      title: __ertr('Paragraph spacing'),
      value: s.paragraphSpacing ?? 0.75,
      min: 0.0,
      max: 2.5,
      step: 0.05,
      format: (v) => `${v.toFixed(2)} em`,
      onInput: (v) => {
        s.paragraphSpacing = v;
        this._paintPreview();
      },
      onChange: async (v) => {
        s.paragraphSpacing = v;
        await this._apply(true);
      },
    });

    // 3. Entre palavras
    this.addSliderItem(spacingGroup, {
      title: __ertr('Word spacing'),
      value: s.wordSpacing ?? 0.0,
      min: -2.0,
      max: 8.0,
      step: 0.5,
      format: (v) => `${v.toFixed(1)} px`,
      onInput: (v) => {
        s.wordSpacing = v;
        this._paintPreview();
      },
      onChange: async (v) => {
        s.wordSpacing = v;
        await this._apply(true);
      },
    });

    // 4. Entre caracteres
    this.addSliderItem(spacingGroup, {
      title: __ertr('Letter spacing'),
      value: s.letterSpacing ?? 0.0,
      min: -1.0,
      max: 4.0,
      step: 0.1,
      format: (v) => `${v.toFixed(1)} px`,
      onInput: (v) => {
        s.letterSpacing = v;
        this._paintPreview();
      },
      onChange: async (v) => {
        s.letterSpacing = v;
        await this._apply(true);
      },
    });

    // Margins (Margens da página / coluna de texto)
    const marginSec = host.createDiv('er-rs-sec-card');
    marginSec.createDiv('er-rs-sec-title').setText(__ertr('Margins'));
    const marginRow = marginSec.createDiv('er-rs-segmented-row');
    const curMargin = s.pageMargin || 'wide';

    const marginOptions = [
      { key: 'compact', iconName: 'margin-compact', label: __ertr('Narrow') },
      { key: 'normal', iconName: 'margin-normal', label: __ertr('Normal') },
      { key: 'wide', iconName: 'margin-wide', label: __ertr('Wide') },
      { key: 'extra', iconName: 'margin-extra', label: __ertr('Extra wide') },
    ];

    marginOptions.forEach((opt) => {
      const btn = marginRow.createDiv('er-rs-seg-btn er-rs-seg-icon');
      const ic = btn.createSpan('er-rs-seg-ic');
      svgIcon(ic, opt.iconName);
      btn.createSpan({ text: opt.label });
      if (opt.key === curMargin) btn.addClass('active');

      btn.addEventListener('click', async () => {
        s.pageMargin = opt.key;
        marginRow.querySelectorAll('.er-rs-seg-btn').forEach((b) => b.removeClass('active'));
        btn.addClass('active');
        await this._apply(true);
      });
    });

    marginSec
      .createDiv('er-rs-hint')
      .setText(__ertr('Adjusts the side margins around the text column.'));

    // Text Alignment
    const alignSec = host.createDiv('er-rs-sec-card');
    alignSec.createDiv('er-rs-sec-title').setText(__ertr('Text alignment'));
    const alignRow = alignSec.createDiv('er-rs-segmented-row');

    const alignments = [
      { key: 'left', iconName: 'align-left', label: __ertr('Left') },
      { key: 'justify', iconName: 'align-justify', label: __ertr('Justify') },
      { key: 'center', iconName: 'align-center', label: __ertr('Center') },
      { key: 'right', iconName: 'align-right', label: __ertr('Right') },
    ];

    const curAlign = s.textAlign || 'left';

    alignments.forEach((al) => {
      const btn = alignRow.createDiv('er-rs-seg-btn er-rs-seg-icon');
      const ic = btn.createSpan('er-rs-seg-ic');
      svgIcon(ic, al.iconName);
      btn.createSpan({ text: al.label });
      if (al.key === curAlign) btn.addClass('active');

      btn.addEventListener('click', async () => {
        s.textAlign = al.key;
        alignRow.querySelectorAll('.er-rs-seg-btn').forEach((b) => b.removeClass('active'));
        btn.addClass('active');
        await this._apply(true);
      });
    });

    // Page Turning Mode
    const pageModeSec = host.createDiv('er-rs-sec-card');
    pageModeSec.createDiv('er-rs-sec-title').setText(__ertr('Page turning'));
    const pageModeRow = pageModeSec.createDiv('er-rs-segmented-row');

    const modes = [
      { key: 'pages', label: __ertr('Pages') },
      { key: 'scroll', label: __ertr('Scrolling') },
      { key: 'flip', label: __ertr('Realistic flip') },
    ];

    const curReadMode = s.readMode || 'pages';

    modes.forEach((m) => {
      const btn = pageModeRow.createDiv('er-rs-seg-btn');
      btn.setText(m.label);
      if (m.key === curReadMode) btn.addClass('active');

      btn.addEventListener('click', async () => {
        if (m.key === (s.readMode || 'pages')) return;
        const v = this.view;
        try {
          if (v.file && v.pager) {
            v.plugin.saveNow(v.file.path, v.pager.spread, v.pager.total, v.pager.currentBlockIndex());
          }
        } catch {
          /* optional */
        }
        s.readMode = m.key;
        await this._apply(false);
        const file = v.file;
        if (file) {
          if (typeof v.openFile === 'function') await v.openFile(file);
          else if (typeof v._loadBook === 'function') await v._loadBook();
        }
        this.renderActiveTabContent();
      });
    });

    // Columns (Desktop/Tablet only)
    if (!isPhoneDevice()) {
      const colSec = host.createDiv('er-rs-sec-card');
      colSec.createDiv('er-rs-sec-title').setText(__ertr('Pages side by side'));
      const colRow = colSec.createDiv('er-rs-segmented-row');
      const curCols = String(s.columns || '2');

      [
        { key: '1', label: __ertr('One') },
        { key: '2', label: __ertr('Two') },
      ].forEach((c) => {
        const btn = colRow.createDiv('er-rs-seg-btn');
        btn.setText(c.label);
        if (c.key === curCols) btn.addClass('active');

        btn.addEventListener('click', async () => {
          s.columns = c.key;
          colRow.querySelectorAll('.er-rs-seg-btn').forEach((b) => b.removeClass('active'));
          btn.addClass('active');
          await this._apply(true);
        });
      });
      colSec
        .createDiv('er-rs-hint')
        .setText(__ertr('Two pages are available only on wider screens.'));
    }

    // Line Width (Max characters)
    if (!isPhoneDevice()) {
      const lwSec = host.createDiv('er-rs-sec-card');
      lwSec.createDiv('er-rs-sec-title').setText(__ertr('Line width'));
      const lwRow = lwSec.createDiv('er-rs-segmented-row');
      const curLw = Number(s.maxLineCh) || 0;

      [
        { val: 0, label: __ertr('Auto') },
        { val: 60, label: '60 ch' },
        { val: 70, label: '70 ch' },
        { val: 80, label: '80 ch' },
        { val: 90, label: '90 ch' },
      ].forEach((lw) => {
        const btn = lwRow.createDiv('er-rs-seg-btn');
        btn.setText(lw.label);
        if (lw.val === curLw) btn.addClass('active');

        btn.addEventListener('click', async () => {
          s.maxLineCh = lw.val;
          lwRow.querySelectorAll('.er-rs-seg-btn').forEach((b) => b.removeClass('active'));
          btn.addClass('active');
          await this._apply(true);
        });
      });
      lwSec
        .createDiv('er-rs-hint')
        .setText(
          __ertr('Sets how many characters fit on a line. Shorter lines are easier to read.')
        );
    }

    // Vertical Position
    const vaSec = host.createDiv('er-rs-sec-card');
    vaSec.createDiv('er-rs-sec-title').setText(__ertr('Position on the page'));
    const vaRow = vaSec.createDiv('er-rs-segmented-row');
    const curVa = s.vAlign || 'top';

    [
      { key: 'top', label: __ertr('Top') },
      { key: 'center', label: __ertr('Center') },
      { key: 'bottom', label: __ertr('Bottom') },
    ].forEach((va) => {
      const btn = vaRow.createDiv('er-rs-seg-btn');
      btn.setText(va.label);
      if (va.key === curVa) btn.addClass('active');

      btn.addEventListener('click', async () => {
        s.vAlign = va.key;
        vaRow.querySelectorAll('.er-rs-seg-btn').forEach((b) => b.removeClass('active'));
        btn.addClass('active');
        await this._apply(true);
      });
    });
    vaSec
      .createDiv('er-rs-hint')
      .setText(
        __ertr('Where to place the text when a page isn\'t filled — at the end of a chapter, for instance.')
      );
  }

  // --- TAB 3: LEITURA & METAS ---
  private buildReadingTab(host: HTMLElement): void {
    const s = this.view.plugin.settings;
    const v = this.view;

    // Navigation mode (Buttons vs Click)
    const navSec = host.createDiv('er-rs-sec-card');
    navSec.createDiv('er-rs-sec-title').setText(__ertr('Page turning'));
    const navRow = navSec.createDiv('er-rs-segmented-row');
    const curNav = s.navMode || 'buttons';

    [
      { key: 'buttons', label: __ertr('Buttons') },
      { key: 'click', label: __ertr('By click') },
    ].forEach((nv) => {
      const btn = navRow.createDiv('er-rs-seg-btn');
      btn.setText(nv.label);
      if (nv.key === curNav) btn.addClass('active');

      btn.addEventListener('click', async () => {
        s.navMode = nv.key;
        navRow.querySelectorAll('.er-rs-seg-btn').forEach((b) => b.removeClass('active'));
        btn.addClass('active');
        await v.plugin.saveAll();
        if (v.contentEl) v.contentEl.classList.toggle('er-navclick', nv.key === 'click');
        if (v.containerEl) v.containerEl.classList.toggle('er-navclick', nv.key === 'click');
      });
    });
    navSec
      .createDiv('er-rs-hint')
      .setText(
        __ertr(
          '"By click": clicking the left part of the page goes back, the right part goes forward. The center stays free for selecting text.'
        )
      );

    // Reading Goal Card
    const goalSec = host.createDiv('er-rs-sec-card');
    const goalHdr = goalSec.createDiv('er-rs-sec-hdr-row');
    goalHdr.createDiv('er-rs-sec-title').setText(__ertr('Reading goal'));

    const goalToggle = goalHdr.createDiv('er-rs-toggle-switch');
    if (s.timerEnabled) goalToggle.addClass('on');
    goalToggle.createDiv('er-rs-toggle-knob');

    const goalBody = goalSec.createDiv('er-rs-goal-body');
    goalBody.style.opacity = s.timerEnabled ? '1' : '0.45';

    const goalStepper = goalBody.createDiv('er-rs-stepper-control');
    const gMinus = goalStepper.createDiv('er-rs-stepper-btn');
    gMinus.setText('−');
    const gLabel = goalStepper.createDiv('er-rs-stepper-label');
    const setGLabel = () => gLabel.setText(__ertr('{0} min/day', s.dailyGoalMin || 15));
    setGLabel();
    const gPlus = goalStepper.createDiv('er-rs-stepper-btn');
    gPlus.setText('+');

    const changeGoal = async (d: number) => {
      s.dailyGoalMin = Math.min(180, Math.max(5, (s.dailyGoalMin || 15) + d));
      setGLabel();
      await v.plugin.saveAll();
      this.updateGoalStats(goalHint);
    };

    gMinus.addEventListener('click', () => {
      if (!s.timerEnabled) return;
      void changeGoal(-5);
    });
    gPlus.addEventListener('click', () => {
      if (!s.timerEnabled) return;
      void changeGoal(5);
    });

    goalToggle.addEventListener('click', async () => {
      const nowOn = !goalToggle.hasClass('on');
      goalToggle.toggleClass('on', nowOn);
      s.timerEnabled = nowOn;
      goalBody.style.opacity = nowOn ? '1' : '0.45';
      await v.plugin.saveAll();
      this.updateGoalStats(goalHint);
    });

    const goalHint = goalSec.createDiv('er-rs-hint');
    this.updateGoalStats(goalHint);

    // Book Actions Card
    const actSec = host.createDiv('er-rs-sec-card');
    actSec.createDiv('er-rs-sec-title').setText(__ertr('Actions'));

    const actGrid = actSec.createDiv('er-rs-actions-grid');

    // Re-flow button
    const reflowBtn = actGrid.createDiv('er-rs-action-tile');
    const reflowIc = reflowBtn.createDiv('er-rs-action-ic');
    svgIcon(reflowIc, 'refresh');
    reflowBtn.createDiv('er-rs-action-txt').setText(__ertr('Re-flow the book'));
    reflowBtn.addEventListener('click', async () => {
      if (typeof v.repaginate === 'function') await v.repaginate();
      else if (typeof v._repaginate === 'function') await v._repaginate();
      new Notice(__ertr('The book has been re-flowed'));
    });

    // Forget this book settings button (if file exists)
    if (v.file) {
      const resetBtn = actGrid.createDiv('er-rs-action-tile');
      const resetIc = resetBtn.createDiv('er-rs-action-ic');
      svgIcon(resetIc, 'rotate-ccw');
      resetBtn.createDiv('er-rs-action-txt').setText(__ertr('Forget this book\'s settings'));
      resetBtn.addEventListener('click', async () => {
        const filePath = v.file ? v.file.path : '';
        if (s.bookNoteLinks && filePath) delete s.bookNoteLinks[filePath];
        if (s.bookNotePrompted && filePath) delete s.bookNotePrompted[filePath];
        if (s.bookTags && filePath) delete s.bookTags[filePath];
        if (s.bookTemplates && filePath) delete s.bookTemplates[filePath];
        await v.plugin.saveAll();
        new Notice(
          __ertr('Book settings cleared — the setup screen will appear next time you open it')
        );
      });
    }

    // Jump back history (if available)
    if (typeof v._renderHistory === 'function') {
      const histSec = host.createDiv('er-rs-sec-card');
      histSec.createDiv('er-rs-sec-title').setText(__ertr('Jump back'));
      v._histRow = histSec.createDiv('er-hist-row');
      v._renderHistory();
    }
  }

  private updateGoalStats(hintEl: HTMLElement): void {
    const v = this.view;
    const mins = Math.floor(v.plugin.getTodaySeconds() / 60);
    const totalMin = Math.floor(v.plugin.getTotalSeconds() / 60);
    const totalH = Math.floor(totalMin / 60);
    const totalStr =
      totalH > 0 ? __ertr('{0} h {1} min', totalH, totalMin % 60) : __ertr('{0} min', totalMin);
    hintEl.setText(
      __ertr(
        'Read today: {0} min. All-time total: {1}. The ▶ button at the top starts the countdown toward the goal (pause — ⏸).',
        mins,
        totalStr
      )
    );
  }

  private buildFooter(host: HTMLElement): void {
    const foot = host.createDiv('er-rs-footer');

    const helpBtn = foot.createDiv('er-rs-foot-help');
    iconLabel(helpBtn, 'info', __ertr('Help'));
    helpBtn.addEventListener('click', () => {
      this.close();
      new InfoModal(this.app, this.view.plugin, this.view.file || null).open();
    });

    const doneBtn = foot.createDiv('er-rs-foot-done');
    doneBtn.setText(__ertr('Done'));
    doneBtn.addEventListener('click', () => {
      this.close();
    });
  }

  onClose(): void {
    if (this._saveT) window.clearTimeout(this._saveT);
    if (this.view && this.view.plugin) {
      void this.view.plugin.saveAll();
    }
    if (this.view) this.view._histRow = null;
    this.contentEl.empty();
  }
}
