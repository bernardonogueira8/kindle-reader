import { normalizePath } from "obsidian";

/**
 * Normalizes vault path, treating empty string as empty (vault root / next to book).
 */
export function erPath(p: string | null | undefined): string {
  const s = String(p == null ? "" : p).trim();
  if (!s) return "";
  try {
    const n = normalizePath(s);
    return n === "/" ? "" : n;
  } catch {
    return s.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
  }
}

/**
 * Returns relative folder of a book with respect to booksFolder.
 */
export function bookRelFolder(bookPath: string, booksFolder: string): string {
  const base = erPath(booksFolder);
  let rel = erPath(bookPath);
  if (base && rel.startsWith(base + "/")) rel = rel.slice(base.length + 1);
  const i = rel.lastIndexOf("/");
  return i > 0 ? rel.slice(0, i) : "";
}

/**
 * Returns the first folder level under booksFolder.
 */
export function bookCategoryOf(bookPath: string, booksFolder: string): string {
  const base = erPath(booksFolder);
  let rel = erPath(bookPath);
  if (base && rel.startsWith(base + "/")) rel = rel.slice(base.length + 1);
  const i = rel.indexOf("/");
  return i > 0 ? rel.slice(0, i) : "";
}
