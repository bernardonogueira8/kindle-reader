import { AbstractInputSuggest, App, FuzzySuggestModal, TFile, TFolder } from 'obsidian';
import { __ertr } from '../../utils/i18n';

export class BookNotePicker extends FuzzySuggestModal<TFile> {
  private _files: TFile[];
  private _onChoose: (f: TFile) => void;

  constructor(app: App, files: TFile[], onChoose: (f: TFile) => void) {
    super(app);
    this._files = files;
    this._onChoose = onChoose;
    this.setPlaceholder(__ertr('Book note for links — start typing a name…'));
  }

  getItems(): TFile[] {
    return this._files;
  }

  getItemText(f: TFile): string {
    return f.basename;
  }

  onChooseItem(f: TFile): void {
    this._onChoose(f);
  }
}

export class TemplatePicker extends FuzzySuggestModal<TFile> {
  private _files: TFile[];
  private _onChoose: (f: TFile) => void;

  constructor(app: App, files: TFile[], onChoose: (f: TFile) => void) {
    super(app);
    this._files = files;
    this._onChoose = onChoose;
    this.setPlaceholder(__ertr('Note template — start typing a path…'));
  }

  getItems(): TFile[] {
    return this._files;
  }

  getItemText(f: TFile): string {
    return f.path;
  }

  onChooseItem(f: TFile): void {
    this._onChoose(f);
  }
}

export const FolderSuggest: (new (app: App, inputEl: HTMLInputElement) => unknown) | null = AbstractInputSuggest
  ? class extends AbstractInputSuggest<string> {
      private _inputEl: HTMLInputElement;

      constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this._inputEl = inputEl;
      }

      getSuggestions(query: string): string[] {
        const q = (query || '').toLowerCase();
        const out: string[] = [];
        for (const f of this.app.vault.getAllLoadedFiles()) {
          if (f instanceof TFolder && f.path && f.path.toLowerCase().includes(q)) {
            out.push(f.path);
          }
        }
        return out.sort().slice(0, 50);
      }

      renderSuggestion(pathVal: string, el: HTMLElement): void {
        el.setText(pathVal);
      }

      selectSuggestion(pathVal: string): void {
        this._inputEl.value = pathVal;
        this._inputEl.dispatchEvent(new Event('input'));
        this._inputEl.dispatchEvent(new Event('er-path-pick'));
        this.close();
      }
    }
  : null;

export function attachFolderSuggest(app: App, textComp: unknown): void {
  try {
    if (FolderSuggest && textComp && textComp.inputEl) {
      new FolderSuggest(app, textComp.inputEl);
    }
  } catch (e) {
    console.warn('Book Reader: folder suggest unavailable', e);
  }
}

export function attachPathInput(app: App, textComp: unknown, commit: (val: string) => void): unknown {
  attachFolderSuggest(app, textComp);
  const el = textComp.inputEl;
  let dirty = false;
  textComp.onChange(() => {
    dirty = true;
  });
  const flush = () => {
    if (!dirty) return;
    dirty = false;
    commit(el.value.trim());
  };
  el.addEventListener('blur', flush);
  el.addEventListener('er-path-pick', flush);
  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    flush();
  });
  return textComp;
}
