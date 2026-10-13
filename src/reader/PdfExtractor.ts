import { App, Notice, TFile } from "obsidian";
import * as pdfjsLib from "pdfjs-dist";
import { __ertr } from "../utils/i18n";
import { icon } from "../utils/icons";
import { escHtml, tocLineHtml } from "./htmlUtils";

declare const __PDF_WORKER_CODE__: string;

let workerReady = false;

export async function setupWorker(app: App): Promise<void> {
  if (workerReady) return;
  try {
    const code = typeof __PDF_WORKER_CODE__ !== "undefined" ? __PDF_WORKER_CODE__ : "";
    if (!code) throw new Error("embedded pdf.worker is empty");
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
      new Blob([code], { type: "application/javascript" })
    );
    workerReady = true;
    return;
  } catch (e) {
    console.error("Book Reader: could not load the embedded pdf.worker", e);
    new Notice(__ertr("Could not prepare PDF reading. Please reinstall the plugin."));
  }
  workerReady = true;
}

const PDF_CYR_SHIFT = 470;

function unshiftCyrillic(s: string): string {
  let out = "";
  for (const ch of String(s)) {
    const c = ch.codePointAt(0) || 0;
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) out += " ";
    else out += c >= 384 && c <= 687 ? String.fromCodePoint(c + PDF_CYR_SHIFT) : ch;
  }
  return out;
}

export function pdfItemsLookShifted(items: unknown[]): boolean {
  const text = (items || []).map((it) => typeof it.str === "string" ? it.str : "").join(" ");
  const letters = text.replace(/\s/g, "");
  if (letters.length < 40) return false;
  const odd = letters.match(/[ƀ-ʯ]/g);
  if (!odd || odd.length / letters.length < 0.3) return false;
  const fixed = odd.filter((ch) => /[\u0410-\u044f\u0401\u0451]/.test(unshiftCyrillic(ch)));
  return fixed.length / odd.length > 0.9;
}

export function pdfFixShiftedCyrillic(items: unknown[]): boolean {
  if (!pdfItemsLookShifted(items)) return false;
  for (const it of items) {
    if (typeof it.str === "string") it.str = unshiftCyrillic(it.str);
  }
  return true;
}

export function pdfTextLooksUnreadable(items: unknown[]): boolean {
  const text = (items || []).map((it) => typeof it.str === "string" ? it.str : "").join(" ");
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 30) return false;
  const singles = tokens.filter((t) => t.length === 1).length;
  if (singles / tokens.length > 0.7) return true;

  const letters = text.replace(/\s/g, "");
  if (letters.length < 60) return false;
  let junk = 0;
  for (const ch of letters) {
    const c = ch.codePointAt(0) || 0;
    if ((c >= 384 && c <= 767) || (c >= 57344 && c <= 63743) || (c < 32 && c !== 9 && c !== 10 && c !== 13)) junk++;
  }
  return junk / letters.length > 0.35;
}

export async function pdfFigureScore(page: unknown): Promise<unknown> {
  let ops: unknown;
  try {
    ops = await page.getOperatorList();
  } catch {
    return null;
  }
  const fn = ops.fnArray, args = ops.argsArray;
  const view = page.view || [0, 0, 612, 792];
  const pw = Math.abs(view[2] - view[0]) || 612;
  const ph = Math.abs(view[3] - view[1]) || 792;
  const pageArea = pw * ph;
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let imgArea = 0, vectorOps = 0, shading = 0;
  const rects: unknown[] = [];
  for (let i = 0; i < fn.length; i++) {
    const f = fn[i];
    if (f === 10) stack.push(m);
    else if (f === 11) {
      if (stack.length) m = stack.pop();
    } else if (f === 12) {
      const t = args[i];
      m = [
        m[0] * t[0] + m[2] * t[1],
        m[1] * t[0] + m[3] * t[1],
        m[0] * t[2] + m[2] * t[3],
        m[1] * t[2] + m[3] * t[3],
        m[0] * t[4] + m[2] * t[5] + m[4],
        m[1] * t[4] + m[3] * t[5] + m[5]
      ];
    } else if (f >= 83 && f <= 90) {
      imgArea += Math.abs(m[0] * m[3] - m[1] * m[2]);
      const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]];
      const ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
      const x0 = Math.max(0, Math.min(...xs)), y0 = Math.max(0, Math.min(...ys));
      const x1 = Math.min(pw, Math.max(...xs)), y1 = Math.min(ph, Math.max(...ys));
      if (x1 > x0 && y1 > y0) {
        rects.push({ x0, y0, x1, y1 });
      }
    } else if (f >= 20 && f <= 27) vectorOps++;
    else if (f === 62) shading++;
  }
  return { imgFrac: imgArea / pageArea, vectorOps, shading, rects };
}

export function pdfNoteBtn(pageNo: number): string {
  return `<button class="er-pdf-note-btn" data-pdf-note-page="${pageNo}" type="button" title="${escHtml(__ertr("Note from this page"))}">${icon("note")}</button>`;
}

function rectsNear(a: unknown, b: unknown, pad: number): boolean {
  return !(a.x1 + pad < b.x0 || b.x1 + pad < a.x0 || a.y1 + pad < b.y0 || b.y1 + pad < a.y0);
}

function mergeRects(rects: unknown[], pad: number): unknown[] {
  const out: unknown[] = [];
  for (const r of rects) {
    let cur = { ...r };
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = out.length - 1; i >= 0; i--) {
        if (rectsNear(cur, out[i], pad)) {
          const o = out.splice(i, 1)[0];
          cur = {
            x0: Math.min(cur.x0, o.x0),
            y0: Math.min(cur.y0, o.y0),
            x1: Math.max(cur.x1, o.x1),
            y1: Math.max(cur.y1, o.y1)
          };
          merged = true;
        }
      }
    }
    out.push(cur);
  }
  return out;
}

export function pdfPickFigures(rects: unknown[], view: unknown): unknown[] {
  const pw = Math.abs(view[2] - view[0]) || 612;
  const ph = Math.abs(view[3] - view[1]) || 792;
  const pageArea = pw * ph;
  const big = (rects || []).filter((r: unknown) => {
    if (r.x1 <= 0 || r.y1 <= 0 || r.x0 >= pw || r.y0 >= ph) return false;
    const w = Math.min(r.x1, pw) - Math.max(r.x0, 0);
    const h = Math.min(r.y1, ph) - Math.max(r.y0, 0);
    if (w < 48 || h < 48) return false;
    if (w * h < pageArea * 0.015) return false;
    if (w * h > pageArea * 0.92) return false;
    return true;
  });
  return mergeRects(big, 6).filter((r) => r.x1 - r.x0 >= 56 && r.y1 - r.y0 >= 56).sort((a, b) => {
    if (Math.abs(b.y1 - a.y1) <= 10) return a.x0 - b.x0;
    return b.y1 - a.y1;
  });
}

function fixPunct(s: string): string {
  return (s || "").replace(/­/g, "").replace(/[ \t\u00A0]+/g, " ").replace(/\s+([,.;:!?…)\]»%”’])/g, "$1").replace(/([([«“‘])\s+/g, "$1").replace(/([\u0410-\u042f\u0430-\u044f\u0401\u0451A-Za-z]) - ([\u0410-\u042f\u0430-\u044f\u0401\u0451A-Za-z])/g, "$1—$2").replace(/ +/g, " ").trim();
}

function isListStart(s: string): boolean {
  const t = (s || "").replace(/^[\s"«(]+/, "");
  if (/^[✓✔•·◦‣▪▫●○■□◆◉➤●❖*]/.test(t)) return true;
  if (/^\d{1,3}[.)]\s/.test(t)) return true;
  if (/^[\u0430-\u044f\u0451a-z][.)]\s/.test(t)) return true;
  return false;
}

function isMonoRun(it: unknown, styles: unknown, measured: unknown): boolean {
  const st = styles && it.fontName ? styles[it.fontName] : null;
  if (st && /mono/i.test(String(st.fontFamily || ""))) return true;
  if (measured && it.fontName && measured.has(it.fontName)) return true;
  return /courier|consol|menlo|monaco|mono/i.test(String(it.fontName || ""));
}

function detectFontStyles(it: unknown, styles: unknown, monoFonts: unknown): { isBold: boolean; isItalic: boolean; isLight: boolean; mono: boolean } {
  const fontObj = styles && it.fontName ? styles[it.fontName] : null;
  const rawName = String(it.fontName || "");
  const cleanName = rawName.replace(/^[A-Z]{6}\+/, "");
  const family = fontObj && fontObj.fontFamily ? String(fontObj.fontFamily) : "";
  const combined = (cleanName + " " + family).toLowerCase();

  const isBold = /bold|black|heavy|semibold|semi-bold|demibold|bolder|\bmedium\b|\b[6-9]00\b|\bcmbx|\bcmb\b|\bbf\b/i.test(combined);
  const isItalic = /italic|oblique|slant|slanted|\bcmti|\bcmmi|\bcmsl|\bit\b|kursiv/i.test(combined);
  const isLight = /light|thin|ultralight|\b[1-3]00\b/i.test(combined);
  const mono = isMonoRun(it, styles, monoFonts) || /mono|courier|consol|menlo|monaco|cmtt|teletype/i.test(combined);

  return { isBold, isItalic, isLight, mono };
}

export function pdfMeasureMonoFonts(items: unknown[]): Set<string> {
  const byFont = new Map<string, number[]>();
  for (const it of items) {
    if (!it || typeof it.str !== "string" || !it.fontName) continue;
    if (it.str.replace(/\s/g, "").length < 4 || !(it.width > 0)) continue;
    const size = Math.abs(it.transform?.[3] ?? 0) || 12;
    const adv = it.width / it.str.length / size;
    if (!(adv > 0)) continue;
    if (!byFont.has(it.fontName)) byFont.set(it.fontName, []);
    byFont.get(it.fontName)!.push(adv);
  }
  const mono = new Set<string>();
  for (const [name, adv] of byFont) {
    if (adv.length < 4) continue;
    const mean = adv.reduce((a, b) => a + b, 0) / adv.length;
    if (!(mean > 0)) continue;
    const sd = Math.sqrt(adv.reduce((a, b) => a + (b - mean) ** 2, 0) / adv.length);
    if (sd / mean < 0.02) mono.add(name);
  }
  return mono;
}

export function pdfAsideBoundary(lines: unknown[], pageLeft: number, pageRight: number): number | null {
  const width = pageRight - pageLeft;
  if (!(width > 0)) return null;
  const minX = pageLeft + width * 0.45;
  const candidates = lines.filter((l) => l.x >= minX && l.monoInk === 0 && l.propInk > 0);
  if (candidates.length < 3) return null;
  const left = Math.min(...candidates.map((l) => l.x));
  if (left < minX) return null;
  return left - 6;
}

function looksLikeCodeLine(text: string): boolean {
  const s = String(text || "").trim();
  if (!s) return false;
  if (!/[{}()[\];=]|>>>|^\s*(def |class |import |from |#include|@)/.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean).length;
  if (words >= 9 && /^[A-Z\u0410-\u042f\u0401][a-z\u0430-\u044f\u0451]{2,}\s/.test(s) && !/[;{}=]|>>>/.test(s)) return false;
  return true;
}

export function pdfItemsToHtml(items: unknown[], styles: unknown, figures: unknown[] = []): string {
  const runs = items.filter((it) => it && typeof it.str === "string");
  if (!runs.length) {
    if (figures && figures.length) {
      return figures.map((fig) => `<figure class="er-pdf-figure"><img class="er-pdf-page-img er-pdf-lazy" data-pdf-page="${fig.pageNum}" data-pdf-rect="${fig.k}" width="${fig.rw}" height="${fig.rh}" alt=""></figure>`).join("\n");
    }
    return "";
  }
  const monoFonts = pdfMeasureMonoFonts(runs);
  const sorted = runs.slice().sort((a, b) => {
    const ay = a.transform?.[5] ?? 0, by = b.transform?.[5] ?? 0;
    if (Math.abs(ay - by) > 3) return by - ay;
    return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
  });
  const lines: unknown[] = [];
  for (const it of sorted) {
    const str = it.str;
    const y = it.transform?.[5] ?? 0;
    const x = it.transform?.[4] ?? 0;
    const size = Math.abs(it.transform?.[3] ?? 12) || 12;
    let w = it.width ?? 0;
    if (!w && str) w = str.length * size * 0.5;
    const ink = str.replace(/\s/g, "").length;
    const fontStyle = detectFontStyles(it, styles, monoFonts);
    const piece = {
      str,
      x,
      w,
      size,
      mono: fontStyle.mono,
      isBold: fontStyle.isBold,
      isItalic: fontStyle.isItalic,
      isLight: fontStyle.isLight,
      ink
    };
    const last = lines[lines.length - 1];
    if (last && Math.abs(y - last.y) <= Math.max(2, size * 0.35)) {
      last.pieces.push(piece);
      last.endX = Math.max(last.endX, x + w);
      last.size = Math.max(last.size, size);
      last.x = Math.min(last.x, x);
      if (piece.mono) last.monoInk += ink;
      else last.propInk += ink;
      if (piece.isBold) last.boldInk += ink;
      if (piece.isItalic) last.italicInk += ink;
    } else if (str.trim() !== "") {
      lines.push({
        y,
        x,
        endX: x + w,
        size,
        monoInk: piece.mono ? ink : 0,
        propInk: piece.mono ? 0 : ink,
        boldInk: piece.isBold ? ink : 0,
        italicInk: piece.isItalic ? ink : 0,
        pieces: [piece]
      });
    }
  }
  if (!lines.length) return "";
  const stitchRuns = (pieces: unknown[]) => {
    const rOut: unknown[] = [];
    let endX: number | null = null;
    for (const p of pieces) {
      if (!p.str) continue;
      const s = p.str;
      if (endX !== null && rOut.length > 0) {
        const lastRun = rOut[rOut.length - 1];
        if (!/\s$/.test(lastRun.str) && !/^\s/.test(s)) {
          const gapRight = p.x - endX > p.size * 0.2;
          const wrapped = p.x < endX - p.size;
          if (gapRight || wrapped) {
            lastRun.str += " ";
          }
        }
      }
      const prev = rOut[rOut.length - 1];
      const sameStyle = prev &&
        prev.isBold === p.isBold &&
        prev.isItalic === p.isItalic &&
        prev.mono === p.mono &&
        prev.isLight === p.isLight;

      if (sameStyle) {
        prev.str += s;
      } else {
        rOut.push({
          str: s,
          isBold: !!p.isBold,
          isItalic: !!p.isItalic,
          mono: !!p.mono,
          isLight: !!p.isLight
        });
      }
      endX = p.x + p.w;
    }
    return rOut;
  };
  const pageLeft = Math.min(...lines.map((l) => l.x));
  const pageRight = Math.max(...lines.map((l) => l.endX));
  const asideAt = pdfAsideBoundary(lines, pageLeft, pageRight);
  const asides: unknown[] = [];
  if (asideAt !== null) {
    for (const l of lines) {
      const hasMono = l.pieces.some((p: unknown) => p.mono);
      const allProp = !hasMono;
      const wholeLineAside = allProp && l.x >= asideAt;
      if (!wholeLineAside && !hasMono) continue;
      const keep: unknown[] = [], moved: unknown[] = [];
      for (const p of l.pieces) ((wholeLineAside || p.x >= asideAt) && !p.mono ? moved : keep).push(p);
      if (!moved.length) continue;
      if (!keep.length) {
        l.dropped = true;
        const movedRuns = stitchRuns(moved);
        asides.push({ y: l.y, text: movedRuns.map((r: unknown) => r.str).join(""), runs: movedRuns });
        continue;
      }
      l.pieces = keep;
      l.runs = stitchRuns(keep);
      l.text = l.runs.map((r: unknown) => r.str).join("");
      l.endX = Math.max(...keep.map((p: unknown) => p.x + p.w));
      l.monoInk = keep.filter((p: unknown) => p.mono).reduce((s: number, p: unknown) => s + p.ink, 0);
      l.propInk = keep.filter((p: unknown) => !p.mono).reduce((s: number, p: unknown) => s + p.ink, 0);
      l.boldInk = keep.filter((p: unknown) => p.isBold).reduce((s: number, p: unknown) => s + p.ink, 0);
      l.italicInk = keep.filter((p: unknown) => p.isItalic).reduce((s: number, p: unknown) => s + p.ink, 0);
      const movedRuns = stitchRuns(moved);
      asides.push({ y: l.y, text: movedRuns.map((r: unknown) => r.str).join(""), runs: movedRuns });
    }
  }
  for (const l of lines) {
    if (!l.runs) {
      l.runs = stitchRuns(l.pieces);
      l.text = l.runs.map((r: unknown) => r.str).join("");
    }
  }
  const real = lines.filter((l) => !l.dropped && l.text.trim() !== "");
  if (!real.length && !asides.length) {
    if (figures && figures.length) {
      return figures.map((fig) => `<figure class="er-pdf-figure"><img class="er-pdf-page-img er-pdf-lazy" data-pdf-page="${fig.pageNum}" data-pdf-rect="${fig.k}" width="${fig.rw}" height="${fig.rh}" alt=""></figure>`).join("\n");
    }
    return "";
  }
  const avg = real.length ? real.reduce((s: number, l: unknown) => s + (Number(l.size) || 0), 0) / real.length : 12;
  const measure = Math.max(...real.map((l: unknown) => l.endX - l.x)) || 1;
  const gaps: number[] = [];
  for (let i = 1; i < real.length; i++) {
    const g = Math.abs((real[i - 1] as unknown).y - (real[i] as unknown).y);
    if (g > 0.5 && g < avg * 6) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const bucket = new Map<number, number>();
  for (const g of gaps) {
    const k = Math.round(g * 2) / 2;
    bucket.set(k, (bucket.get(k) || 0) + 1);
  }
  let mode = 0, modeN = 0;
  for (const [k, n] of bucket) if (n > modeN || (n === modeN && k > mode)) {
    mode = k;
    modeN = n;
  }
  const lineGap = gaps.length ? Math.min(modeN >= 3 ? mode : gaps[Math.floor(gaps.length * 0.3)], avg * 2.2) : avg * 1.4;
  const paraGap = Math.max(lineGap * 1.45, avg * 1.1);
  const leftXs = real.map((l: unknown) => l.x).sort((a: number, b: number) => a - b);
  const bodyLeft = leftXs.length ? leftXs[Math.floor(leftXs.length * 0.15)] : 0;
  const indentMin = Math.max(avg * 0.8, (pageRight - bodyLeft) * 0.015);
  const indentedLines = real.filter((l: unknown) => l.x - bodyLeft > indentMin).length;
  const indentMarksParas = indentedLines / (real.length || 1) <= 0.35;
  const monoInk = real.reduce((s: number, l: unknown) => s + (Number(l.monoInk) || 0), 0);
  const allInk = real.reduce((s: number, l: unknown) => s + (Number(l.monoInk) || 0) + (Number(l.propInk) || 0), 0) || 1;
  const boldInk = real.reduce((s: number, l: unknown) => s + (Number(l.boldInk) || 0), 0);
  const italicInk = real.reduce((s: number, l: unknown) => s + (Number(l.italicInk) || 0), 0);
  const treatBoldAsBody = boldInk / allInk > 0.85;
  const treatItalicAsBody = italicInk / allInk > 0.85;
  const codeAllowed = monoInk / allInk < 0.8;
  const isSeed = (l: unknown) => {
    if (!codeAllowed || !(l.monoInk > 0) || l.monoInk < l.propInk) return false;
    const ratio = l.monoInk / (l.monoInk + l.propInk || 1);
    return ratio >= 0.8 || looksLikeCodeLine(l.text);
  };
  const codeFlag = new Array(real.length).fill(false);
  for (let i = 0; i < real.length; i++) if (isSeed(real[i])) codeFlag[i] = true;
  for (let i = 0; i < real.length; i++) {
    if (!codeFlag[i]) continue;
    let j = i;
    const inner: number[] = [];
    while (j + 1 < real.length && codeFlag[j + 1]) {
      inner.push(real[j].y - real[j + 1].y);
      j++;
    }
    const tight = inner.length ? Math.min(...inner) * 1.3 : lineGap * 0.95;
    const blockLeft = Math.min(...real.slice(i, j + 1).map((l) => l.x));
    for (let k = j + 1; k < real.length; k++) {
      const gap = real[k - 1].y - real[k].y;
      if (!(gap > 0 && gap <= tight)) break;
      if (real[k].x < blockLeft - real[k].size) break;
      if (real[k].size > avg * 1.22) break;
      if (!looksLikeCodeLine(real[k].text)) break;
      if (real[k].endX - real[k].x > measure * 0.92) break;
      codeFlag[k] = true;
    }
    i = j;
  }
  const html: string[] = [];
  let paraRuns: unknown[] = [];
  let paraText = "";
  let lastY: number | null = null;
  let code: unknown = null;

  const formatRunsHtml = (runsList: unknown[], isHeading = false) => {
    let out = "";
    for (const r of runsList) {
      if (!r.str) continue;
      const s = fixPunct(r.str);
      if (!s) continue;
      let esc = escHtml(s);
      if (r.mono && !isHeading) {
        esc = `<code>${esc}</code>`;
      }
      if (r.isBold && !isHeading && !treatBoldAsBody) {
        esc = `<strong>${esc}</strong>`;
      }
      if (r.isItalic && !treatItalicAsBody) {
        esc = `<em>${esc}</em>`;
      }
      if (r.isLight && !r.isBold && !isHeading) {
        esc = `<span class="er-light">${esc}</span>`;
      }
      out += esc;
    }
    return out;
  };

  const appendLineToPara = (lineRuns: unknown[], lineText: string) => {
    if (!paraRuns.length) {
      paraRuns = lineRuns.map((r) => ({ ...r }));
      paraText = lineText;
      return;
    }
    const lastRun = paraRuns[paraRuns.length - 1];
    const firstRun = lineRuns[0];
    const isHyphenated = /[\u0430-\u044f\u0451a-z]-$/i.test(lastRun.str) && firstRun && /^[\u0430-\u044f\u0451a-z]/i.test(firstRun.str);

    if (isHyphenated) {
      lastRun.str = lastRun.str.slice(0, -1);
      paraText = paraText.slice(0, -1);
    } else if (!/\s$/.test(lastRun.str) && firstRun && !/^\s/.test(firstRun.str)) {
      lastRun.str += " ";
      paraText += " ";
    }

    for (let k = 0; k < lineRuns.length; k++) {
      const lr = lineRuns[k];
      const prev = paraRuns[paraRuns.length - 1];
      const sameStyle = prev &&
        prev.isBold === lr.isBold &&
        prev.isItalic === lr.isItalic &&
        prev.mono === lr.mono &&
        prev.isLight === lr.isLight;

      if (sameStyle) {
        prev.str += lr.str;
      } else {
        paraRuns.push({ ...lr });
      }
    }
    paraText += lineText;
  };

  const flush = () => {
    if (paraText.trim()) {
      const li = isListStart(paraText) ? ' class="er-pdf-li"' : "";
      const inner = formatRunsHtml(paraRuns);
      if (inner.trim()) {
        html.push(`<p${li}>${inner}</p>`);
      }
      paraRuns = [];
      paraText = "";
    }
  };
  const flushCode = () => {
    if (!code || !code.lines.length) {
      code = null;
      return;
    }
    const minX = Math.min(...code.lines.map((l: unknown) => l.x));
    const unit = Math.max(1, code.size * 0.5);
    const body = code.lines.map((l: unknown) => " ".repeat(Math.min(60, Math.max(0, Math.round((l.x - minX) / unit)))) + l.text.replace(/\s+$/, "")).join("\n");
    if (body.trim()) html.push(`<pre class="er-code"><code>${escHtml(body)}</code></pre>`);
    code = null;
  };

  const sortedFigs = figures && figures.length ? figures.slice().sort((a, b) => {
    if (Math.abs(b.topY - a.topY) <= 10) return (a.r?.x0 ?? 0) - (b.r?.x0 ?? 0);
    return b.topY - a.topY;
  }) : [];
  let figIdx = 0;
  const emitPendingFigures = (currentY: number | null) => {
    while (figIdx < sortedFigs.length) {
      const fig = sortedFigs[figIdx];
      if (currentY !== null && fig.topY < currentY) {
        break;
      }
      flush();
      flushCode();
      html.push(`<figure class="er-pdf-figure"><img class="er-pdf-page-img er-pdf-lazy" data-pdf-page="${fig.pageNum}" data-pdf-rect="${fig.k}" width="${fig.rw}" height="${fig.rh}" alt=""></figure>`);
      figIdx++;
    }
  };

  for (let i = 0; i < real.length; i++) {
    const line = real[i];
    emitPendingFigures(line.y);

    if (codeFlag[i]) {
      flush();
      if (!code) code = { lines: [], size: line.size };
      code.lines.push(line);
      code.size = Math.max(code.size, line.size);
      lastY = line.y;
      continue;
    }
    const t2 = fixPunct(line.text);
    if (!t2) continue;
    flushCode();
    const toc = tocLineHtml(t2);
    if (toc) {
      flush();
      html.push(toc);
      lastY = line.y;
      continue;
    }
    const fillsMeasure = line.endX - line.x > measure * 0.9;
    const isH = line.size > avg * 1.22 && !fillsMeasure && t2.length < 120;
    const gap = lastY !== null ? Math.abs(lastY - line.y) : 0;
    const isBoldTitle = !treatBoldAsBody && (line.boldInk >= line.propInk * 0.8 || (line.runs.length === 1 && line.runs[0].isBold)) && !fillsMeasure && t2.length < 90 && (!lastY || gap > avg * 0.85);

    if (isH) {
      flush();
      const hTag = line.size > avg * 1.45 ? "h2" : "h3";
      const inner = formatRunsHtml(line.runs, true);
      html.push(`<${hTag}>${inner || escHtml(t2)}</${hTag}>`);
      lastY = line.y;
      continue;
    }
    if (isBoldTitle && !isListStart(t2)) {
      flush();
      const inner = formatRunsHtml(line.runs, true);
      html.push(`<h3 class="er-subhead">${inner || escHtml(t2)}</h3>`);
      lastY = line.y;
      continue;
    }
    if (lastY !== null && gap > paraGap) flush();
    else if (indentMarksParas && paraText && line.x - bodyLeft > indentMin) flush();
    if (paraText && isListStart(t2)) flush();
    appendLineToPara(line.runs, t2);
    lastY = line.y;
  }
  flush();
  flushCode();
  emitPendingFigures(null);

  if (asides.length) {
    const merged: unknown[] = [];
    for (const a of asides) {
      const prev = merged[merged.length - 1];
      if (prev && prev.y - a.y > 0 && prev.y - a.y <= avg * 1.8) {
        prev.runs.push({ str: " ", isBold: false, isItalic: false, mono: false, isLight: false }, ...a.runs);
        prev.y = a.y;
      } else {
        merged.push({ y: a.y, runs: [...a.runs] });
      }
    }
    const body = merged.map((a) => formatRunsHtml(a.runs)).filter((t: string) => t.trim().length > 0);
    if (body.length) {
      html.push(`<div class="er-side-notes">${body.map((t: string) => `<p>${t}</p>`).join("")}</div>`);
    }
  }
  return html.join("\n");
}

export async function extractPdf(file: TFile, app: App, settings: Record<string, unknown> = {}, onProgress?: (i: number, n: number) => void): Promise<{ html: string; lazy: unknown; outline: unknown[] }> {
  await setupWorker(app);
  const alsoFigOnText = settings.pdfShowFiguresOnTextPages === true;
  const buf = await app.vault.readBinary(file);
  const doc = await pdfjsLib.getDocument({
    data: buf,
    isEvalSupported: false
  }).promise;
  const total = doc.numPages;
  const parts: string[] = [];
  const figRects: Record<number, unknown[]> = {};
  for (let i = 1; i <= total; i++) {
    if (onProgress && (i === 1 || i % 4 === 0 || i === total)) onProgress(i, total);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pdfFixShiftedCyrillic(tc.items);
    const textLen = tc.items.reduce((n: number, it: unknown) => n + (typeof it.str === "string" ? it.str.replace(/\s+/g, "").length : 0), 0);
    const view = page.view || [0, 0, 612, 792];
    const pw = Math.max(1, Math.round(Math.abs(view[2] - view[0])));
    const ph = Math.max(1, Math.round(Math.abs(view[3] - view[1])));
    const brokenText = textLen >= 40 && pdfTextLooksUnreadable(tc.items);
    let html = "";
    if (textLen < 40 || brokenText) {
      const fig = await pdfFigureScore(page);
      if (brokenText || (fig && (fig.imgFrac >= 0.02 || fig.vectorOps >= 20 || fig.shading > 0))) {
        html = `<figure class="er-pdf-figure"><img class="er-pdf-page-img er-pdf-lazy" data-pdf-page="${i}" width="${pw}" height="${ph}" alt="">${pdfNoteBtn(i)}</figure>` + (brokenText ? "" : pdfItemsToHtml(tc.items, tc.styles));
      } else if (textLen > 0) {
        html = pdfItemsToHtml(tc.items, tc.styles);
      }
    } else if (alsoFigOnText) {
      const fig = await pdfFigureScore(page);
      let picked = fig ? pdfPickFigures(fig.rects, view) : [];
      if (picked.length) {
        picked = picked.filter((r: unknown) => {
          let textInRect = 0;
          for (const it of tc.items as unknown[]) {
            const x = it.transform[4], y = it.transform[5];
            if (x >= r.x0 - 5 && x <= r.x1 + 5 && y >= r.y0 - 5 && y <= r.y1 + 5) {
              textInRect += (typeof it.str === "string" ? it.str.replace(/\s+/g, "").length : 0);
            }
          }
          return textInRect < 100;
        });
      }

      if (picked.length) {
        figRects[i] = picked;
        const inside = (it: unknown) => {
          const x = it.transform[4], y = it.transform[5];
          return picked.some((r: unknown) => x >= r.x0 - 1 && x <= r.x1 + 1 && y >= r.y0 - 1 && y <= r.y1 + 1);
        };
        const outside = tc.items.filter((it: unknown) => !inside(it));
        const keptEnough = outside.length >= tc.items.length * 0.25;
        const itemsToUse = outside.length < tc.items.length && keptEnough ? outside : tc.items;
        const pageFigures = picked.map((r: unknown, k: number) => ({
          pageNum: i,
          k,
          r,
          rw: Math.max(1, Math.round(r.x1 - r.x0)),
          rh: Math.max(1, Math.round(r.y1 - r.y0)),
          topY: r.y1,
          bottomY: r.y0
        }));
        html = pdfItemsToHtml(itemsToUse, tc.styles, pageFigures);
      } else {
        html = pdfItemsToHtml(tc.items, tc.styles);
      }
    } else {
      html = pdfItemsToHtml(tc.items, tc.styles);
    }
    if (html) parts.push(`<div class="er-pdf-page-break" data-pdf-page-no="${i}">${html}</div>`);
  }
  const outline: unknown[] = [];
  try {
    const walk2 = async (nodes: unknown[], level: number) => {
      for (const n of nodes || []) {
        let page = null;
        try {
          const dest = typeof n.dest === "string" ? await doc.getDestination(n.dest) : n.dest;
          if (Array.isArray(dest) && dest[0]) page = await doc.getPageIndex(dest[0]) + 1;
        } catch {
          /* optional step; a failure here must not interrupt reading */
        }
        const label = String(n.title || "").replace(/\s+/g, " ").trim();
        if (label && page) outline.push({ label, page, level });
        if (n.items && n.items.length) await walk2(n.items, level + 1);
      }
    };
    await walk2(await doc.getOutline(), 0);
  } catch (e) {
    console.warn("Book Reader: PDF outline unavailable", e);
  }
  const lazy = {
    _doc: doc,
    _rects: figRects,
    async _paint(task: unknown, ms: number) {
      task.promise.catch(() => {});
      let timer: unknown = null;
      try {
        await Promise.race([
          task.promise,
          new Promise((_, rej) => {
            timer = window.setTimeout(() => {
              try {
                task.cancel();
              } catch {
                /* optional step; a failure here must not interrupt reading */
              }
              rej(new Error("er-render-budget"));
            }, ms);
          })
        ]);
      } finally {
        window.clearTimeout(timer);
      }
    },
    async render(pageNum: number, rectIdx: number | null) {
      const page = await doc.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const r = rectIdx == null ? null : (this._rects[pageNum] || [])[rectIdx] || null;
      if (!r) {
        const full = Math.max(1, Math.min(2, 1600 / Math.max(base.width, base.height, 1)));
        for (const [scale2, budget] of [[full, 15000], [full / 2, 8000]]) {
          const vp2 = page.getViewport({ scale: scale2 });
          const cv2 = createEl("canvas");
          cv2.width = Math.ceil(vp2.width);
          cv2.height = Math.ceil(vp2.height);
          const ctx2 = cv2.getContext("2d")!;
          ctx2.fillStyle = "#ffffff";
          ctx2.fillRect(0, 0, cv2.width, cv2.height);
          try {
            await this._paint(page.render({ canvasContext: ctx2, viewport: vp2 }), budget);
            return cv2.toDataURL("image/jpeg", 0.78);
          } catch (e: unknown) {
            if (String(e && e.message) !== "er-render-budget") throw e;
          }
        }
        throw new Error("er-render-too-heavy");
      }
      const rw = Math.max(1, r.x1 - r.x0), rh = Math.max(1, r.y1 - r.y0);
      const scale = Math.max(1, Math.min(3, 1400 / Math.max(rw, rh)));
      const vp = page.getViewport({ scale });
      const [ax, ay] = vp.convertToViewportPoint(r.x0, r.y0);
      const [bx, by] = vp.convertToViewportPoint(r.x1, r.y1);
      const left = Math.min(ax, bx), top = Math.min(ay, by);
      const cw = Math.max(1, Math.round(Math.abs(bx - ax)));
      const ch = Math.max(1, Math.round(Math.abs(by - ay)));
      const cv = createEl("canvas");
      cv.width = cw;
      cv.height = ch;
      const ctx = cv.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      ctx.translate(-left, -top);
      try {
        await this._paint(page.render({ canvasContext: ctx, viewport: vp }), 15000);
      } catch (e: unknown) {
        throw String(e && e.message) === "er-render-budget" ? new Error("er-render-too-heavy") : e;
      }
      return cv.toDataURL("image/jpeg", 0.85);
    },
    destroy() {
      try {
        doc.destroy();
      } catch {
        /* optional step; a failure here must not interrupt reading */
      }
    }
  };
  return { html: parts.join("\n"), lazy, outline };
}
