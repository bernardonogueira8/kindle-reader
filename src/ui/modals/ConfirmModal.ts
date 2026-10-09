import { Modal, App } from 'obsidian';
import { __ertr } from '../../utils/i18n';

export interface ConfirmModalOptions {
  title?: string;
  body?: string;
  cancelText?: string;
  okText?: string;
  onNo?: () => void;
  onYes?: () => void;
}

export class ConfirmModal extends Modal {
  opts: ConfirmModalOptions;
  _done = false;

  constructor(app: App, opts?: ConfirmModalOptions) {
    super(app);
    this.opts = opts || {};
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass("er-confirm-modal");
    contentEl.empty();
    if (this.opts.title) contentEl.createDiv("er-confirm-title").setText(this.opts.title);
    if (this.opts.body) contentEl.createDiv("er-confirm-body").setText(this.opts.body);
    const btns = contentEl.createDiv("er-confirm-btns");
    const no = btns.createEl("button", { text: this.opts.cancelText || __ertr("No") });
    no.addClass("er-confirm-no");
    no.addEventListener("click", () => {
      this._done = true;
      this.close();
      this.opts.onNo?.();
    });
    const yes = btns.createEl("button", { text: this.opts.okText || __ertr("Yes") });
    yes.addClass("er-confirm-yes");
    yes.addEventListener("click", () => {
      this._done = true;
      this.close();
      this.opts.onYes?.();
    });
    window.setTimeout(() => yes.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
