import { FuzzySuggestModal, App, TFile } from 'obsidian';
import { __ertr } from '../utils/i18n';
import type { BookProgress } from '../types';

export class BookQuickOpen extends FuzzySuggestModal<TFile> {
  plugin: any;

  constructor(app: App, plugin: any) {
    super(app);
    this.plugin = plugin;
    this.setPlaceholder(__ertr("Which book do you want to open?"));
  }

  getItems(): TFile[] {
    const prog: Record<string, BookProgress> = this.plugin.progress || {};
    const started = (f: TFile) => {
      const p = prog[f.path];
      return p && typeof p.pct === "number" && p.pct > 0 ? p.pct : -1;
    };
    return this.plugin.bookFiles().sort((a: TFile, b: TFile) => {
      const sa = started(a);
      const sb = started(b);
      if (sa >= 0 !== sb >= 0) return sa >= 0 ? -1 : 1;
      return a.basename.localeCompare(b.basename);
    });
  }

  getItemText(f: TFile): string {
    const p = (this.plugin.progress || {})[f.path];
    const pct = p && typeof p.pct === "number" ? Math.round(p.pct * 100) : 0;
    return pct > 0 ? `${f.basename} — ${pct}%` : f.basename;
  }

  onChooseItem(f: TFile): void {
    this.plugin.openFile(f);
  }
}