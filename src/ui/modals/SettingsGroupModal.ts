import { App, Modal } from 'obsidian';
import { __ertr } from '../../utils/i18n';

export class SettingsGroupModal extends Modal {
  groupTitle: string;
  build: (el: HTMLElement, redraw: () => void) => void;
  bodyEl: HTMLElement | null = null;

  constructor(app: App, title: string, build: (el: HTMLElement, redraw: () => void) => void) {
    super(app);
    this.groupTitle = title;
    this.build = build;
  }

  onOpen(): void {
    this.modalEl.addClass('er-settings-group');
    this.draw();
  }

  draw(): void {
    const c = this.contentEl;
    // The scrolling box itself is rebuilt below, so the position has to be
    // carried over by hand rather than left to the browser.
    const was = this.bodyEl ? this.bodyEl.scrollTop : 0;
    c.empty();
    c.createEl('h3', { text: this.groupTitle });
    this.bodyEl = c.createDiv('er-group-body');
    // Rebuilt on every redraw, because some of these settings decide whether
    // the others exist at all.
    this.build(this.bodyEl, () => this.draw());
    const row = c.createDiv('er-group-actions');
    // "Done" rather than "Save": every control here writes the moment it is
    // touched, exactly as it did on the settings page.
    const done = row.createEl('button', { cls: 'mod-cta', text: __ertr('Done') });
    done.addEventListener('click', () => this.close());
    if (was) this.bodyEl.scrollTop = was;
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
