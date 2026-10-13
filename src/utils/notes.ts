import { App, TFile } from 'obsidian';
import { erPath } from './path';
import { __ertr } from './i18n';
import { BookHighlight } from '../types';

export function _readerSettings(app: App): unknown {
  const plugins = (app as unknown).plugins?.plugins;
  const p = plugins ? (plugins['kindle-reader'] || plugins['elton-reader-books']) : null;
  return p?.settings || {};
}

export function bookNoteAction(
  s: { bookNoteLinks?: Record<string, string>; bookNotePrompted?: Record<string, boolean>; autoBookNote?: boolean },
  path: string
): 'linked' | 'prompted' | 'auto' | 'setup' {
  if (s.bookNoteLinks && s.bookNoteLinks[path]) return 'linked';
  if (s.bookNotePrompted && s.bookNotePrompted[path]) return 'prompted';
  if (s.autoBookNote) return 'auto';
  return 'setup';
}


export function noteTemplatePath(app: App, bookFile?: TFile | null): string {
  const s = _readerSettings(app);
  if (bookFile && s.bookTemplates && s.bookTemplates[bookFile.path]) {
    return erPath(s.bookTemplates[bookFile.path]);
  }
  return erPath(s.noteTemplate);
}

export function notesFolderPath(app: App): string {
  return erPath(_readerSettings(app).notesFolder);
}

export function bookNotesFolderPath(app: App): string {
  return erPath(_readerSettings(app).bookNotesFolder);
}

export function inboxNotePath(app: App, name: string, override?: string | null): string {
  const f = typeof override === 'string' && override !== '' ? erPath(override) : notesFolderPath(app);
  return erPath(f ? `${f}/${name}.md` : `${name}.md`);
}

export async function resolveNotesFolder(app: App, override?: string | null): Promise<unknown> {
  const f = typeof override === 'string' && override !== '' ? erPath(override) : notesFolderPath(app);
  if (!f) return app.vault.getRoot();
  let folder = app.vault.getAbstractFileByPath(f);
  if (!folder) {
    await app.vault.createFolder(f).catch(() => {});
    folder = app.vault.getAbstractFileByPath(f);
  }
  return folder || app.vault.getRoot();
}

export function bookNoteFiles(app: App): TFile[] {
  const base = bookNotesFolderPath(app);
  const all = app.vault.getMarkdownFiles();
  if (!base) return all;
  const prefix = base + '/';
  return all.filter((f) => f.path.startsWith(prefix));
}

export function resolveBookNote(app: App, name: string): TFile | null {
  if (!name) return null;
  const byLink = app.metadataCache.getFirstLinkpathDest ? app.metadataCache.getFirstLinkpathDest(name, '') : null;
  if (byLink instanceof TFile) return byLink;
  const base = bookNotesFolderPath(app);
  const direct = app.vault.getAbstractFileByPath(erPath(base ? `${base}/${name}.md` : `${name}.md`));
  if (direct instanceof TFile) return direct;
  const hit = app.metadataCache.getFirstLinkpathDest(name, '');
  return hit instanceof TFile ? hit : null;
}

export async function writeBookProperty(
  app: App,
  noteName: string,
  bookFile: TFile | null,
  initialData?: { author?: string; curPage?: number; totalPages?: number; pct?: number }
): Promise<void> {
  try {
    if (!noteName || !bookFile) return;
    const note = resolveBookNote(app, noteName);
    if (!note) return;
    await (app as unknown).fileManager.processFrontMatter(note, (fm: unknown) => {
      fm.book = `[[${bookFile.path}]]`;

      let authorGuess = initialData?.author || "";
      if (!authorGuess && bookFile.basename.includes(" - ")) {
        authorGuess = bookFile.basename.split(" - ")[0].trim();
      }
      if (fm.autor === undefined) {
        fm.autor = authorGuess;
      }
      if (fm.paginas_lidas === undefined) {
        fm.paginas_lidas = initialData?.curPage ?? 0;
      }
      if (fm.total_paginas === undefined) {
        fm.total_paginas = initialData?.totalPages ?? 0;
      }
      const pct = initialData?.pct ?? 0;
      if (fm.progresso_percentual === undefined) {
        fm.progresso_percentual = Math.round(pct);
      }
      if (fm.status === undefined) {
        fm.status = pct >= 100 ? "lido" : "lendo";
      }
      if (fm.data_inicio === undefined) {
        fm.data_inicio = new Date().toISOString().slice(0, 10);
      }
      if (fm.data_conclusao === undefined) {
        fm.data_conclusao = pct >= 100 ? new Date().toISOString().slice(0, 10) : "";
      }
    });
  } catch (e) {
    console.warn("Book Reader: could not write the book property into the note", e);
  }
}

export function bookNoteFromFrontmatter(plugin: unknown, bookFile: TFile | null): string {
  try {
    const app = plugin?.app;
    if (!app || !bookFile) return '';
    const want = erPath(bookFile.path);
    const wantName = bookFile.basename;
    for (const md of app.vault.getMarkdownFiles()) {
      const fm = app.metadataCache.getFileCache(md);
      const v = fm?.frontmatter ? (fm.frontmatter.book ?? fm.frontmatter['annotation-target']) : null;
      if (!v) continue;
      const target = String(v).trim().replace(/^\[\[|\]\]$/g, '').split('|')[0].trim();
      if (!target) continue;
      if (erPath(target) === want || target === wantName) return md.basename;
    }
  } catch { /* optional step */ }
  return '';
}

export function bookNoteLinkFor(plugin: unknown, bookFile: TFile | null): string {
  if (!bookFile) return '';
  const map = plugin?.settings?.bookNoteLinks;
  const raw = map ? (map[bookFile.path] ?? '') : '';
  const fromSettings = String(raw).trim().replace(/^\[\[|\]\]$/g, '').trim();
  if (fromSettings) return fromSettings;
  return bookNoteFromFrontmatter(plugin, bookFile);
}

const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

export function sanitizeNoteTitle(raw: string, max = 100): string {
  // Control characters are exactly what has to go from a file name.
  // eslint-disable-next-line no-control-regex -- stripping them is the point
  let t = (raw || '').replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  if (t.length > max) t = t.slice(0, max).replace(/[.\s]+$/, '');
  if (!t) t = __ertr('Note');
  if (RESERVED_NAMES.test(t)) t = `_${t}`;
  return t;
}

export function suggestNoteTitle(text: string, max = 60): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean.replace(/[.,;:!?…\s]+$/, '');
  const m = clean.match(/^(.{10,}?[.!?…])(\s|$)/);
  if (m && m[1].length <= max && /[\p{L}]{3}[.!?…]+$/u.test(m[1])) {
    return m[1].replace(/[.,;:!?…\s]+$/, '');
  }
  let cut = clean.slice(0, max + 1);
  const sp = cut.lastIndexOf(' ');
  if (sp > max * 0.5) cut = cut.slice(0, sp);
  return cut.replace(/\s+[a-z\u0430-\u044f\u0451]{1,2}$/i, '').replace(/[.,;:!?…\-—\s]+$/, '');
}

export function normalizeHlText(s: string): string {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/==+/g, ' ')
    .replace(/^\s*>+\s?/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function splitExportedHighlights(noteText: string, highlights: BookHighlight[]): { fresh: BookHighlight[]; already: BookHighlight[] } {
  const hay = normalizeHlText(noteText);
  const fresh: BookHighlight[] = [], already: BookHighlight[] = [];
  for (const hl of highlights || []) {
    const needle = normalizeHlText(hl && hl.text);
    if (needle && hay && hay.includes(needle)) already.push(hl);
    else fresh.push(hl);
  }
  return { fresh, already };
}

export function parseNoteTags(raw: string): string[] {
  return String(raw || '')
    .replace(/\s+#/g, ',#')
    .split(/[,;\n]+/)
    .map((t) => t.trim().replace(/^#+/, '').replace(/\s+/g, '-'))
    .filter(Boolean)
    .filter((t, i, a) => a.indexOf(t) === i);
}

export function allVaultTags(app: App): string[] {
  try {
    const counts = (app.metadataCache as unknown)?.getTags?.();
    if (!counts) return [];
    return Object.keys(counts)
      .map((t) => t.replace(/^#/, ''))
      .sort((a, b) => ((counts['#' + b] || 0) - (counts['#' + a] || 0)))
      .slice(0, 60);
  } catch {
    return [];
  }
}
