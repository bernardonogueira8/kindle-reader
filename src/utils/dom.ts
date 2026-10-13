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

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.body.createEl("textarea");
    ta.value = text;
    ta.setCssStyles({ position: "fixed", left: "-9999px", top: "-9999px" });
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
