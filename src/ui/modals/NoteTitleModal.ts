import { App, Modal, TFile } from 'obsidian';
import { __ertr } from '../../utils/i18n';
import { erPath } from '../../utils/path';
import { erAutoFocus } from '../../utils/dom';
import {
  suggestNoteTitle,
  sanitizeNoteTitle,
  notesFolderPath,
  parseNoteTags,
  allVaultTags,
  bookNoteLinkFor,
} from '../../utils/notes';
import { FolderSuggest } from './SuggestModals';

export interface NoteTitleResult {
  title?: string;
  folder?: string;
  tags?: string[];
  toBookNote?: boolean;
}

export class NoteTitleModal extends Modal {
  private plugin: any;
  private fragment: string;
  private bookFile: TFile | null;
  private onDone: (res: NoteTitleResult | null) => void;
  private _answered = false;

  constructor(app: App, plugin: any, fragment: string, bookFile: TFile | null, onDone: (res: NoteTitleResult | null) => void) {
    super(app);
    this.plugin = plugin;
    this.fragment = fragment;
    this.bookFile = bookFile || null;
    this.onDone = onDone;
  }

  onOpen(): void {
    const c = this.contentEl;
    c.addClass('er-title-modal');
    c.createDiv('er-info-title').setText(__ertr('New note from a highlight'));

    const field = (label: string, hint?: string): HTMLInputElement => {
      const w = c.createDiv('er-setup-field');
      w.createDiv('er-setup-label').setText(label);
      const el = w.createEl('input', { type: 'text' });
      el.addClass('er-setup-input');
      if (hint) el.placeholder = hint;
      return el;
    };

    const input = field(__ertr('Title'));
    input.value = suggestNoteTitle(this.fragment);

    const full = sanitizeNoteTitle(this.fragment);
    if (full && full !== input.value) {
      const useFull = c.createDiv('er-title-alt');
      useFull.setText(__ertr('Use the whole passage as the title'));
      useFull.addEventListener('click', () => {
        input.value = full;
        input.focus();
      });
    }

    const folderInput = field(__ertr('Folder'), notesFolderPath(this.app) || __ertr('Vault root'));
    folderInput.value = this.plugin?.settings?.lastNoteFolder || '';
    try {
      if (FolderSuggest) new FolderSuggest(this.app, folderInput);
    } catch { /* optional step; a failure here must not interrupt reading */ }

    const tagsInput = field(__ertr('Tags'), __ertr('For example: ideas, psychology'));
    tagsInput.value = this.plugin?.settings?.lastNoteTags || '';
    const known = allVaultTags(this.app);
    if (known.length) {
      const dl = c.createEl('datalist');
      dl.id = 'er-note-tags-' + Math.random().toString(36).slice(2, 8);
      known.forEach((t) => dl.createEl('option', { value: t }));
      tagsInput.setAttr('list', dl.id);
    }

    c.createDiv('er-setup-hint').setText(
      __ertr('The folder and tags are remembered for the next note. The passage itself goes into the note in full — the title does not affect that.')
    );

    const foot = c.createDiv('er-setup-foot');
    const ok = foot.createEl('button', { text: __ertr('Create note') });
    ok.addClass('er-setup-btn', 'er-setup-btn-primary');

    const bookNote = this.bookFile ? bookNoteLinkFor(this.plugin, this.bookFile) : '';
    if (bookNote) {
      const toBook = foot.createEl('button', { text: __ertr('Into the book note') });
      toBook.addClass('er-setup-btn', 'er-setup-btn-quiet');
      toBook.setAttribute('aria-label', __ertr('Append the quote to «{0}» instead of making a separate note', bookNote));
      toBook.addEventListener('click', () => {
        this._answered = true;
        this.close();
        this.onDone({ toBookNote: true });
      });
    }

    const cancel = foot.createEl('button', { text: __ertr('Cancel') });
    cancel.addClass('er-setup-btn', 'er-setup-btn-quiet');

    const submit = async () => {
      const v = input.value.trim();
      if (!v) {
        input.focus();
        return;
      }
      this._answered = true;
      const folder = erPath(folderInput.value.trim());
      const tags = parseNoteTags(tagsInput.value);
      if (this.plugin?.settings) {
        this.plugin.settings.lastNoteFolder = folder;
        this.plugin.settings.lastNoteTags = tagsInput.value.trim();
      }
      try {
        await this.plugin?._saveLocalData?.();
      } catch { /* optional step; a failure here must not interrupt reading */ }
      this.close();
      this.onDone({ title: v, folder, tags });
    };

    ok.addEventListener('click', submit);
    cancel.addEventListener('click', () => this.close());

    for (const el of [input, folderInput, tagsInput]) {
      el.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        }
      });
    }
    erAutoFocus(input, 30);
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this._answered) this.onDone(null);
  }
}
