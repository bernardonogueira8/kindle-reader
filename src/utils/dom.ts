import { Platform } from "obsidian";
import { docOf } from "./icons";

export function erIsMobile(app?: unknown): boolean {
  try {
    if (Platform && typeof Platform.isMobile === "boolean") return Platform.isMobile;
  } catch {
    /* optional step */
  }
  return !!(app && app.isMobile);
}

export function erBlurOnTapOutside(root: HTMLElement | null, field: HTMLElement | null): void {
  if (!root || !field) return;
  root.addEventListener("pointerdown", (e) => {
    const t = e.target;
    if (t === field) return;
    if (t instanceof HTMLElement && t.closest(".er-ai-bar, .er-find-bar, input, textarea")) return;
    if (docOf(field).activeElement === field) field.blur();
  });
}

export function erAutoFocus(el: HTMLElement | null, delayMs?: number): void {
  if (!el || erIsMobile()) return;
  if (delayMs) {
    window.setTimeout(() => {
      try {
        el.focus();
      } catch {
        /* optional step */
      }
    }, delayMs);
  } else {
    try {
      el.focus();
    } catch {
      /* optional step */
    }
  }
}
