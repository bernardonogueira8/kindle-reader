import { TFile } from "obsidian";
import { __ertr } from "./i18n";
import { bookRelFolder, bookCategoryOf } from "./path";

export interface LibChip {
  id: string;
  label: string;
  count: number;
  sub?: boolean;
}

export function bookStatusOf(prog: any): "new" | "reading" | "done" {
  if (!prog || !prog.lastRead) return "new";
  const pct = typeof prog.percent === "number" ? prog.percent : 0;
  if (pct >= 98) return "done";
  if (pct > 0) return "reading";
  return "new";
}

export function buildLibChips(
  files: TFile[],
  booksFolder: string,
  getProgress: (p: string) => any,
  getTags: ((p: string) => string[]) | null,
  activeChip: string
): LibChip[] {
  const statuses = { reading: 0, new: 0, done: 0 };
  const folders = new Map<string, number>();
  const tags = new Map<string, number>();

  for (const f of files) {
    statuses[bookStatusOf(getProgress(f.path))]++;
    const cat = bookCategoryOf(f.path, booksFolder);
    folders.set(cat, (folders.get(cat) || 0) + 1);
    for (const t of (getTags ? getTags(f.path) : [])) {
      tags.set(t, (tags.get(t) || 0) + 1);
    }
  }

  const chips: LibChip[] = [{ id: "all", label: __ertr("All"), count: files.length }];
  if (statuses.reading) chips.push({ id: "status:reading", label: __ertr("Reading"), count: statuses.reading });
  if (statuses.new) chips.push({ id: "status:new", label: __ertr("Not started"), count: statuses.new });
  if (statuses.done) chips.push({ id: "status:done", label: __ertr("Finished"), count: statuses.done });

  for (const [t, n] of Array.from(tags.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    chips.push({ id: `tag:${t}`, label: t, count: n });
  }

  const named = Array.from(folders.entries()).filter(([c]) => c).sort((a, b) => a[0].localeCompare(b[0]));
  const openFolder = activeChip && activeChip.startsWith("folder:") ? activeChip.slice(7) : null;
  const subs = new Map<string, number>();

  if (openFolder) {
    for (const f of files) {
      const rel = bookRelFolder(f.path, booksFolder);
      if (rel !== openFolder && rel.startsWith(openFolder + "/")) {
        const next = openFolder + "/" + rel.slice(openFolder.length + 1).split("/")[0];
        subs.set(next, (subs.get(next) || 0) + 1);
      }
    }
  }

  if (named.length > 1 || (named.length === 1 && folders.has(""))) {
    for (const [cat, n] of named) {
      chips.push({ id: `folder:${cat}`, label: cat, count: n });
      if (openFolder === cat && subs.size > 1) {
        for (const [sub, sn] of Array.from(subs.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
          chips.push({ id: `folder:${sub}`, label: "└ " + sub.slice(cat.length + 1), count: sn, sub: true });
        }
      }
    }
    if (folders.get("")) chips.push({ id: "folder:", label: __ertr("No folder"), count: folders.get("")! });
  }

  return chips;
}

export function filterLibBooks(
  files: TFile[],
  chipId: string,
  query: string,
  booksFolder: string,
  getProgress: (p: string) => any,
  getTags: ((p: string) => string[]) | null
): TFile[] {
  const needle = (query || "").trim().toLowerCase();
  return files.filter((f) => {
    if (needle && !f.basename.toLowerCase().includes(needle)) return false;
    if (!chipId || chipId === "all") return true;
    if (chipId.startsWith("status:")) return bookStatusOf(getProgress(f.path)) === chipId.slice(7);
    if (chipId.startsWith("folder:")) {
      const want = chipId.slice(7);
      const have = bookRelFolder(f.path, booksFolder);
      return want === "" ? have === "" : (have === want || have.startsWith(want + "/"));
    }
    if (chipId.startsWith("tag:")) return (getTags ? getTags(f.path) : []).includes(chipId.slice(4));
    return true;
  });
}

export function bookTagsOf(settings: any, bookPath: string): string[] {
  const m = (settings && settings.bookTags) || {};
  const v = m[bookPath];
  return Array.isArray(v) ? v.filter(Boolean) : [];
}

export function allBookTags(settings: any): string[] {
  const m = (settings && settings.bookTags) || {};
  const set = new Set<string>();
  for (const k of Object.keys(m)) {
    for (const t of (Array.isArray(m[k]) ? m[k] : [])) {
      if (t) set.add(t);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function parseBookTags(raw: string): string[] {
  return String(raw || "")
    .split(/[,;\n]+/)
    .map((t) => t.trim().replace(/^#+/, "").trim())
    .filter(Boolean)
    .filter((t, i, a) => a.indexOf(t) === i);
}

export function pluralBooks(n: number): string {
  return n === 1 ? __ertr("book") : __ertr("books");
}
