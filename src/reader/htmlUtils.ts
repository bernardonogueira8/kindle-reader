export function escHtml(s: unknown): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function splitTocLine(s: unknown): { title: string; page: string } | null {
  const m = String(s || "").trim().match(/^(.*?)[\s.]*\.{4,}[\s.]*(\d{1,4})\s*$/);
  if (!m) return null;
  const title = m[1].replace(/[\s.]+$/, "").trim();
  return title ? { title, page: m[2] } : null;
}

export function tocLineHtml(text: unknown): string | null {
  const t = splitTocLine(text);
  if (!t) return null;
  return `<p class="er-toc-line"><span class="er-toc-t">${escHtml(t.title)}</span><span class="er-toc-n">${escHtml(t.page)}</span></p>`;
}
