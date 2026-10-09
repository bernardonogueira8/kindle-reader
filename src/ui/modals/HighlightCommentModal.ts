import { Modal, App } from 'obsidian';
import { __ertr } from '../../utils/i18n';
import { erAutoFocus, erBlurOnTapOutside } from '../../utils/dom';

export class HighlightCommentModal extends Modal {
  initial: string;
  onDone: (text: string | null) => void;
  _answered = false;

  constructor(app: App, initial: string, onDone: (text: string | null) => void) {
    super(app);
    this.initial = initial || "";
    this.onDone = onDone;
  }

  onOpen(): void {
    const c = this.contentEl;
    c.addClass("er-title-modal");
    c.createDiv("er-info-title").setText(this.initial ? __ertr("Edit comment") : __ertr("Comment on a highlight"));
    const w = c.createDiv("er-setup-field");
    const ta = w.createEl("textarea");
    ta.addClass("er-cmt-input");
    ta.value = this.initial;
    ta.placeholder = __ertr("Your thought about this passage…");
    c.createDiv("er-setup-hint").setText(__ertr("The comment is kept with the highlight and travels with it into your notes. Clear the field to remove it."));
    const foot = c.createDiv("er-setup-foot");
    const ok = foot.createEl("button", { text: __ertr("Save") });
    ok.addClass("er-setup-btn", "er-setup-btn-primary");
    const cancel = foot.createEl("button", { text: __ertr("Cancel") });
    cancel.addClass("er-setup-btn", "er-setup-btn-quiet");

    const submit = () => {
      this._answered = true;
      this.close();
      this.onDone(ta.value.trim());
    };

    ok.addEventListener("click", submit);
    cancel.addEventListener("click", () => this.close());
    ta.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submit();
      }
    });

    erAutoFocus(ta, 30);
    erBlurOnTapOutside(c, ta);
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this._answered) this.onDone(null);
  }
}
