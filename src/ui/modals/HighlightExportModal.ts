import { App, Modal, TFile } from 'obsidian';
import { __ertr } from '../../utils/i18n';
import { BookHighlight } from '../../types';
import { splitExportedHighlights } from '../../utils/notes';

export interface ExportItem {
  hl: BookHighlight;
  on: boolean;
}

export type ExportHighlightsFn = (
  app: App,
  plugin: any,
  bookFile: TFile | null,
  sel: BookHighlight[]
) => Promise<void> | void;

export class HighlightExportModal extends Modal {
  private plugin: any;
  private bookFile: TFile | null;
  private noteName: string;
  private already: Set<BookHighlight>;
  private items: ExportItem[];
  private newCount: number;
  public onExportToBookNote?: ExportHighlightsFn;
  public onExportSeparate?: ExportHighlightsFn;

  constructor(
    app: App,
    plugin: any,
    bookFile: TFile | null,
    highlights: BookHighlight[],
    noteText: string,
    noteName?: string,
    onExportToBookNote?: ExportHighlightsFn,
    onExportSeparate?: ExportHighlightsFn
  ) {
    super(app);
    this.plugin = plugin;
    this.bookFile = bookFile;
    this.noteName = noteName || '';
    const split = splitExportedHighlights(noteText, highlights);
    this.already = new Set(split.already);
    this.items = (highlights || []).map((hl) => ({ hl, on: !split.already.includes(hl) }));
    this.newCount = split.fresh.length;
    this.onExportToBookNote = onExportToBookNote;
    this.onExportSeparate = onExportSeparate;
  }

  onOpen(): void {
    const c = this.contentEl;
    c.addClass('er-exp-modal');
    c.createDiv('er-info-title').setText(__ertr('What to copy into the note'));

    const sub = c.createDiv('er-info-sub');
    sub.setText(
      this.noteName
        ? this.already.size
          ? __ertr('Note "{0}" — {1} already there, {2} new ones ticked', this.noteName, this.already.size, this.newCount)
          : __ertr('Note "{0}" — none of the {1} are there yet', this.noteName, this.items.length)
        : __ertr('No book note linked — separate notes only')
    );

    const bar = c.createDiv('er-exp-bar');
    const counter = bar.createSpan({ cls: 'er-exp-count' });

    const mkLink = (label: string, fn: () => void) => {
      const a = bar.createSpan({ cls: 'er-exp-link', text: label });
      a.addEventListener('click', () => {
        fn();
        refresh();
      });
      return a;
    };

    mkLink(__ertr('Select all'), () => this.items.forEach((i) => (i.on = true)));
    mkLink(__ertr('Clear all'), () => this.items.forEach((i) => (i.on = false)));
    if (this.already.size) {
      mkLink(__ertr('New only'), () => this.items.forEach((i) => (i.on = !this.already.has(i.hl))));
    }

    const list = c.createDiv('er-exp-list');
    const rows = this.items.map((item) => {
      const row = list.createDiv('er-exp-row');
      const box = row.createEl('input', { type: 'checkbox' });
      box.addClass('er-exp-box');
      box.checked = item.on;

      const body = row.createDiv('er-exp-body');
      const txt = (item.hl.text || '').replace(/\s+/g, ' ').trim();
      body.createDiv('er-exp-text').setText(txt.length > 220 ? txt.slice(0, 220) + '…' : txt);

      if (this.already.has(item.hl)) {
        row.addClass('er-exp-done');
        body.createDiv('er-exp-tag').setText(__ertr('already in the note'));
      }

      const toggle = () => {
        item.on = !item.on;
        box.checked = item.on;
        refresh();
      };

      box.addEventListener('click', (e) => {
        e.stopPropagation();
        item.on = box.checked;
        refresh();
      });

      row.addEventListener('click', toggle);
      return { item, box };
    });

    const foot = c.createDiv('er-setup-foot');
    const toNote = foot.createEl('button', { text: __ertr('Into the book note') });
    toNote.addClass('er-setup-btn', 'er-setup-btn-primary');
    const toSep = foot.createEl('button', { text: __ertr('As separate notes') });
    toSep.addClass('er-setup-btn');

    const refresh = () => {
      for (const r of rows) r.box.checked = r.item.on;
      const n = this.items.filter((i) => i.on).length;
      counter.setText(__ertr('Ticked: {0} of {1}', n, this.items.length));
      toNote.disabled = !n || !this.noteName;
      toSep.disabled = !n;
    };

    const picked = () => this.items.filter((i) => i.on).map((i) => i.hl);

    toNote.addEventListener('click', () => {
      const sel = picked();
      this.close();
      if (this.onExportToBookNote) {
        this.onExportToBookNote(this.app, this.plugin, this.bookFile, sel);
      } else if (typeof this.plugin?.exportHighlightsToBookNote === 'function') {
        this.plugin.exportHighlightsToBookNote(this.bookFile, sel);
      }
    });

    toSep.addEventListener('click', () => {
      const sel = picked();
      this.close();
      if (this.onExportSeparate) {
        this.onExportSeparate(this.app, this.plugin, this.bookFile, sel);
      } else if (typeof this.plugin?.exportHighlightsSeparate === 'function') {
        this.plugin.exportHighlightsSeparate(this.bookFile, sel);
      }
    });

    refresh();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
