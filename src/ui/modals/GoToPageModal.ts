import { Modal, App } from 'obsidian';
import { __ertr } from '../../utils/i18n';
import { erAutoFocus } from '../../utils/dom';

export class GoToPageModal extends Modal {
  total: number;
  current: number;
  onSubmit: (page: number) => void;

  constructor(app: App, total: number, current: number, onSubmit: (page: number) => void) {
    super(app);
    this.total = total;
    this.current = current || 0;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass("er-confirm-modal");
    contentEl.empty();
    contentEl.createDiv("er-confirm-title").setText(__ertr("Go to page"));
    const input = contentEl.createEl("input", {
      cls: "er-gotopage-input",
      attr: { type: "number", min: "1", max: String(this.total), placeholder: `1–${this.total}` }
    });
    input.value = String(this.current + 1);

    const submit = () => {
      const n = parseInt(input.value, 10);
      this.close();
      if (!isNaN(n)) this.onSubmit(Math.max(1, Math.min(this.total, n)));
    };

    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });

    const btns = contentEl.createDiv("er-confirm-btns");
    const go = btns.createEl("button", { text: __ertr("Go") });
    go.addClass("er-confirm-yes");
    go.addEventListener("click", submit);
    erAutoFocus(input, 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
