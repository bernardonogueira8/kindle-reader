import { App, Modal, Notice, TFile } from 'obsidian';
import { __ertr } from '../../utils/i18n';
import { erAutoFocus, erBlurOnTapOutside } from '../../utils/dom';
import { bookTagsOf, allBookTags, parseBookTags } from '../../utils/library';
import {
  bookNoteFiles,
  writeBookProperty,
  sanitizeNoteTitle,
  bookNotesFolderPath,
  notesFolderPath,
} from '../../utils/notes';
import { FolderSuggest } from './SuggestModals';

export class BookSetupModal extends Modal {
  private plugin: unknown;
  private file: TFile;
  private onDone: () => void;
  private _answered = false;
  private _step = 1;

  constructor(app: App, plugin: unknown, file: TFile, onDone?: () => void) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    this.onDone = onDone || (() => {});
  }

  onOpen(): void {
    this.modalEl.addClass('er-setup-modal');
    this._render();
  }

  private _render(): void {
    this.contentEl.empty();
    if (this._step === 1) this._renderPick();
    else this._renderCreate();
  }

  // ── Step 1: link an existing note ─────────────────────────────────────────
  private _renderPick(): void {
    const c = this.contentEl;
    c.createDiv('er-info-title').setText(__ertr('A note for this book'));
    c.createDiv('er-info-sub').setText(this.file.basename);
    c.createDiv('er-setup-lead').setText(__ertr('Quotes and thoughts from this book will link to this note.'));

    const search = c.createEl('input', { type: 'text' });
    search.addClass('er-setup-input');
    search.placeholder = __ertr('Search notes…');

    const listEl = c.createDiv('er-setup-list');
    const all = bookNoteFiles(this.app);

    const paint = (q: string) => {
      listEl.empty();
      const needle = (q || '').trim().toLowerCase();
      const shown = (needle ? all.filter((f) => f.basename.toLowerCase().includes(needle)) : all).slice(0, 200);
      if (!all.length) {
        listEl.createDiv('er-setup-empty').setText(__ertr('No notes in the vault yet — create one below'));
        return;
      }
      if (!shown.length) {
        listEl.createDiv('er-setup-empty').setText(__ertr('Nothing found'));
        return;
      }
      for (const f of shown) {
        const row = listEl.createDiv('er-setup-row');
        row.createDiv('er-setup-row-name').setText(f.basename);
        const dir = f.parent && f.parent.path && f.parent.path !== '/' ? f.parent.path : '';
        if (dir) row.createDiv('er-setup-row-path').setText(dir);
        row.addEventListener('click', async () => {
          if (!this.plugin.settings.bookNoteLinks) this.plugin.settings.bookNoteLinks = {};
          this.plugin.settings.bookNoteLinks[this.file.path] = f.basename;
          await this.plugin.saveAll();
          await writeBookProperty(this.app, f.basename, this.file);
          this._finish(__ertr('Book note: {0}', f.basename));
        });
      }
    };

    search.addEventListener('input', () => paint(search.value));
    paint('');

    const foot = c.createDiv('er-setup-foot');
    const mk = foot.createEl('button', { text: __ertr('Create a note…') });
    mk.addClass('er-setup-btn', 'er-setup-btn-primary');
    mk.addEventListener('click', () => {
      this._step = 2;
      this._render();
    });

    const skip = foot.createEl('button', { text: __ertr('Read without a note') });
    skip.addClass('er-setup-btn', 'er-setup-btn-quiet');
    skip.addEventListener('click', () => this._finish(''));

    erAutoFocus(search, 30);
    erBlurOnTapOutside(this.contentEl, search);
  }

  // ── Step 2: create a new note ─────────────────────────────────────────────
  private _renderCreate(): void {
    const c = this.contentEl;
    const back = c.createDiv('er-setup-back');
    back.setText(__ertr('← Back'));
    back.addEventListener('click', () => {
      this._step = 1;
      this._render();
    });

    c.createDiv('er-info-title').setText(__ertr('Create note'));
    c.createDiv('er-info-sub').setText(this.file.basename);

    const field = (label: string, value?: string, placeholder?: string): HTMLInputElement => {
      const w = c.createDiv('er-setup-field');
      w.createDiv('er-setup-label').setText(label);
      const el = w.createEl('input', { type: 'text' });
      el.addClass('er-setup-input');
      if (value) el.value = value;
      if (placeholder) el.placeholder = placeholder;
      return el;
    };

    const nameInput = field(__ertr('Note name'), sanitizeNoteTitle(this.file.basename));
    const folderInput = field(
      __ertr('Folder'),
      bookNotesFolderPath(this.app) || notesFolderPath(this.app) || '',
      __ertr('Vault root')
    );
    try {
      if (FolderSuggest) new FolderSuggest(this.app, folderInput);
    } catch { /* optional step; a failure here must not interrupt reading */ }

    const tagsInput = field(
      __ertr('Category'),
      bookTagsOf(this.plugin.settings, this.file.path).join(', '),
      __ertr('e.g. Psychology, Business')
    );
    const known = allBookTags(this.plugin.settings);
    if (known.length) {
      const dl = c.createEl('datalist');
      dl.id = 'er-setup-tags-' + Math.random().toString(36).slice(2, 8);
      known.forEach((t) => dl.createEl('option', { value: t }));
      tagsInput.setAttr('list', dl.id);
    }

    c.createDiv('er-setup-hint').setText(
      __ertr('Genre or topic — books are grouped by it in the library. Separate several with commas. Can be left empty.')
    );

    const foot = c.createDiv('er-setup-foot');
    const createBtn = foot.createEl('button', { text: __ertr('Create and start reading') });
    createBtn.addClass('er-setup-btn', 'er-setup-btn-primary');
    createBtn.addEventListener('click', async () => {
      createBtn.disabled = true;
      const note = await this.plugin.createBookNote(this.file, nameInput.value, folderInput.value);
      if (!note) {
        createBtn.disabled = false;
        return;
      }
      await this.plugin.setBookTags(this.file.path, parseBookTags(tagsInput.value));
      this._finish(__ertr('Book note created: {0}', note.basename));
    });

    [nameInput, folderInput, tagsInput].forEach((el) =>
      el.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          createBtn.click();
        }
      })
    );

    erAutoFocus(nameInput, 30);
    erBlurOnTapOutside(this.contentEl, nameInput);
  }

  private async _finish(msg?: string): Promise<void> {
    this._answered = true;
    const s = this.plugin.settings;
    if (!s.bookNotePrompted) s.bookNotePrompted = {};
    s.bookNotePrompted[this.file.path] = true;
    await this.plugin.saveAll();
    if (msg) new Notice(msg);
    this.close();
    this.onDone();
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this._answered) this.onDone();
  }
}
