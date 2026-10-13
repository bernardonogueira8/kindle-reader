import { App, TFile } from "obsidian";
import ePub from "epubjs";
import { escHtml, tocLineHtml } from "./htmlUtils";

const BLOCK_TAGS = /^(p|div|section|article|main|aside|nav|header|footer|figure|figcaption|h[1-6]|ul|ol|dl|li|dt|dd|table|pre|blockquote|hr|img|svg)$/i;
const FORMAT_OWN_TAGS = new Set(["b", "strong", "i", "em", "cite", "dfn", "var", "u", "ins", "s", "strike", "del", "th"]);

export function epubResolveArchivePath(itemPath: string, relPath: string): string {
  const cleanRel = String(relPath || "").replace(/^\/+/, "");
  let fullPath = cleanRel;
  if (!String(relPath || "").startsWith("/")) {
    const itemDir = String(itemPath || "").replace(/^\/+/, "").split("/").slice(0, -1);
    fullPath = [...itemDir, ...cleanRel.split("/")].join("/");
  }
  const stack: string[] = [];
  for (const seg of fullPath.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      stack.pop();
    } else {
      stack.push(seg);
    }
  }
  return "/" + stack.join("/");
}

export function escAttr(s: unknown): string {
  return escHtml(String(s)).replace(/"/g, "&quot;");
}

export function elClassMatches(el: Element, set: Set<string> | null | undefined, re: RegExp | null): boolean {
  const cls = ((el.getAttribute && el.getAttribute("class")) || "").toLowerCase();
  if (!cls) return false;
  for (const c of cls.split(/\s+/)) {
    if (!c) continue;
    if (set && set.has(c)) return true;
    if (re && re.test(c)) return true;
  }
  return false;
}

export function elStyleHas(el: Element, re: RegExp): boolean {
  return re.test(((el.getAttribute && el.getAttribute("style")) || "").toLowerCase());
}

function isElementBold(el: Element, boldClasses?: Set<string>): boolean {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "b" || tag === "strong" || tag === "th") return true;
  if (elStyleHas(el, /font-weight\s*:\s*(bold|bolder|[6-9]00)\b/)) return true;
  return elClassMatches(el, boldClasses, /(^|[-_])(bold|bolder|strong|negrito)([-_]|$)/);
}

function isElementItalic(el: Element, italicClasses?: Set<string>): boolean {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "i" || tag === "em" || tag === "cite" || tag === "dfn" || tag === "var") return true;
  if (elStyleHas(el, /font-style\s*:\s*(italic|oblique)\b/)) return true;
  return elClassMatches(el, italicClasses, /(^|[-_])(italic|italico|italics|oblique|emphasis|emph)([-_]|$)/);
}

function isElementUnderline(el: Element, underlineClasses?: Set<string>): boolean {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "a") return false;
  if (tag === "u" || tag === "ins") return true;
  if (elStyleHas(el, /text-decoration(?:-line)?\s*:[^;]*\bunderline\b/)) return true;
  return elClassMatches(el, underlineClasses, /(^|[-_])(underline|underlined|sublinhado)([-_]|$)/);
}

function isElementStrike(el: Element, strikeClasses?: Set<string>): boolean {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "s" || tag === "strike" || tag === "del") return true;
  if (elStyleHas(el, /text-decoration(?:-line)?\s*:[^;]*\bline-through\b/)) return true;
  return elClassMatches(el, strikeClasses, /(^|[-_])(strike|strikethrough|line-?through|riscado)([-_]|$)/);
}

function isElementSmallcaps(el: Element, smallcapsClasses?: Set<string>): boolean {
  if (!el || !el.tagName) return false;
  if (elStyleHas(el, /font-variant(?:-caps)?\s*:[^;]*\bsmall-caps\b/)) return true;
  return elClassMatches(el, smallcapsClasses, /(^|[-_])(small-?caps|smcap|versalete)([-_]|$)/);
}

function wrapFormat(el: Element, inner: string, ctx?: unknown): string {
  if (!inner || !el || !el.tagName) return inner;
  if (FORMAT_OWN_TAGS.has(el.tagName.toLowerCase())) return inner;
  if (isElementUnderline(el, ctx && ctx.underlineClasses)) inner = `<u>${inner}</u>`;
  if (isElementStrike(el, ctx && ctx.strikeClasses)) inner = `<s>${inner}</s>`;
  if (isElementSmallcaps(el, ctx && ctx.smallcapsClasses)) inner = `<span class="er-sc">${inner}</span>`;
  if (isElementItalic(el, ctx && ctx.italicClasses)) inner = `<em>${inner}</em>`;
  if (isElementBold(el, ctx && ctx.boldClasses)) inner = `<strong>${inner}</strong>`;
  return inner;
}

function registerAnchor(el: Element, ctx?: unknown): void {
  if (!ctx || !ctx.pending || !el || !el.getAttribute) return;
  const tag = (el.tagName || "").toLowerCase();
  const id = el.getAttribute("id") || (tag === "a" ? el.getAttribute("name") : "");
  if (id) ctx.pending.push(epubResolveHref(ctx.href, "#" + id));
}

function takeAnchors(ctx?: unknown): string {
  if (!ctx || !ctx.pending || !ctx.pending.length) return "";
  const out = ctx.pending.map((k: string) => `<span class="er-anchor" data-er-id="${escAttr(k)}"></span>`).join("");
  ctx.pending.length = 0;
  return out;
}

function isQuoteLike(el: Element): boolean {
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "blockquote") return true;
  if (!["div", "section", "aside", "p"].includes(tag)) return false;
  return elClassMatches(el, null, /(^|[-_])(quote|blockquote|epigraph|citation|cita|citacao|epigrafe)([-_]|$)/);
}

function isCiteBlock(el: Element): boolean {
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "footer" || tag === "figcaption") return true;
  if (elClassMatches(el, null, /(^|[-_])(attribution|attrib|cite|author|autor|source|fonte|credit)([-_]|$)/)) return true;
  const txt = (el.textContent || "").trim();
  if (!txt || txt.length > 140 || tag !== "p") return false;
  if (/^[—–―]\s*\S/.test(txt)) return true;
  const kids = Array.from(el.children || []);
  return kids.length === 1 && (kids[0].tagName || "").toLowerCase() === "cite" && (kids[0].textContent || "").trim() === txt;
}

function citeHtml(el: Element, ctx?: unknown): string {
  const inner = inlineHtml(el, ctx).trim().replace(/^[—–―]\s*/, "");
  return inner ? `<p class="er-cite">${takeAnchors(ctx)}${inner}</p>` : "";
}

function quoteHtml(el: Element, ctx?: unknown): string {
  const parts: string[] = [];
  const lastEl = el.lastElementChild;
  const kidCount = (el.children || []).length;
  let buf = "";
  const flush = () => {
    if (buf.trim()) parts.push(`<p>${takeAnchors(ctx)}${buf}</p>`);
    buf = "";
  };
  for (const node of Array.from(el.childNodes || [])) {
    if (node.nodeType === Node.TEXT_NODE) {
      buf += escHtml(node.textContent || "");
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const childEl = node as Element;
      const t = (childEl.tagName || "").toLowerCase();
      if (t === "footer" || t === "figcaption" || BLOCK_TAGS.test(t)) {
        flush();
        registerAnchor(childEl, ctx);
        const credit = t === "footer" || t === "figcaption" || (childEl === lastEl && kidCount > 1 && isCiteBlock(childEl));
        const h = credit ? citeHtml(childEl, ctx) : nodeToHtml(childEl, ctx);
        if (h) parts.push(h);
      } else {
        buf += inlineHtml({ childNodes: [childEl] } as unknown, ctx);
      }
    }
  }
  flush();
  return parts.length ? `<blockquote class="er-quote">${parts.join("\n")}</blockquote>` : "";
}

function childrenBlocksHtml(el: Element, ctx?: unknown): string {
  const out: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) out.push(`<p>${takeAnchors(ctx)}${buf}</p>`);
    buf = "";
  };
  for (const node of Array.from(el.childNodes || [])) {
    if (node.nodeType === Node.TEXT_NODE) {
      buf += escHtml(node.textContent || "");
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const childEl = node as Element;
      if (BLOCK_TAGS.test(childEl.tagName || "")) {
        flush();
        const h = nodeToHtml(childEl, ctx);
        if (h) out.push(h);
      } else {
        buf += inlineHtml({ childNodes: [childEl] } as unknown, ctx);
      }
    }
  }
  flush();
  return out.join("\n");
}

function containerHtml(el: Element, ctx?: unknown): string {
  const hasBlock = Array.from(el.children || []).some((c) => BLOCK_TAGS.test(c.tagName || ""));
  if (hasBlock) return childrenBlocksHtml(el, ctx);
  const inner = wrapFormat(el, inlineHtml(el, ctx), ctx);
  return inner.trim() ? `<p>${takeAnchors(ctx)}${inner}</p>` : "";
}

function isListElementNone(el: Element, ctx?: unknown): boolean {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "ol" && ctx && ctx.allOlNone) return true;
  if (tag === "ul" && ctx && ctx.allUlNone) return true;
  if (elStyleHas(el, /list-style(?:-type)?\s*:\s*none\b/)) return true;
  if (elClassMatches(el, ctx && ctx.listNoneClasses, /(^|[-_])(none|unstyled|plain|no-bullet|no-num|toc|nav)([-_]|$)/)) return true;
  const parentTag = (el.parentElement && el.parentElement.tagName ? el.parentElement.tagName.toLowerCase() : "");
  if (parentTag === "nav") return true;
  return false;
}

function isHeadingLikeItem(li: Element, ctx?: unknown): boolean {
  if (!li || !li.tagName) return false;
  const id = (li.getAttribute("id") || "").toLowerCase();
  if (/^(toc_?id|sec|head|sigil_toc|tit)/i.test(id)) return true;
  if (li.getAttribute("role") === "heading") return true;
  if (elStyleHas(li, /page-break-after\s*:\s*avoid/)) return true;
  if (elClassMatches(li, ctx && ctx.headingClasses, /(^|[-_])(heading|subhead|subheading|title|titulo|subtitulo|caption|toc[-_]?item)([-_]|$)/)) return true;
  const kids = Array.from(li.children || []);
  if (kids.some((k) => /^h[1-6]$/i.test(k.tagName || ""))) return true;
  if (kids.length === 1 && (elClassMatches(kids[0], ctx && ctx.headingClasses, null) || elClassMatches(kids[0], ctx && ctx.boldClasses, null))) {
    const textLen = (li.textContent || "").trim().length;
    if (textLen > 0 && textLen < 160) return true;
  }
  return false;
}

function listHtml(el: Element, ctx?: unknown): string {
  const tag = (el.tagName || "").toLowerCase();
  const liChildren = Array.from(el.children || []).filter((c) => (c.tagName || "").toLowerCase() === "li");
  const isNone = isListElementNone(el, ctx) || (liChildren.length > 0 && liChildren.every((c) => isListElementNone(c, ctx)));

  if (liChildren.length === 1 && (isNone || isHeadingLikeItem(liChildren[0], ctx))) {
    const singleLi = liChildren[0];
    registerAnchor(el, ctx);
    registerAnchor(singleLi, ctx);
    const hasBlock = Array.from(singleLi.children || []).some((c) => BLOCK_TAGS.test(c.tagName || ""));
    const inner = hasBlock ? containerHtml(singleLi, ctx) : wrapFormat(singleLi, inlineHtml(singleLi, ctx), ctx);
    if (!inner.trim()) return "";
    return `<h3 class="er-subhead">${takeAnchors(ctx)}${inner}</h3>`;
  }

  const items: string[] = [];
  let index = tag === "ol" ? parseInt(el.getAttribute("start") || "1", 10) || 1 : 0;
  for (const child of Array.from(el.children || [])) {
    if ((child.tagName || "").toLowerCase() !== "li") {
      const h = nodeToHtml(child, ctx);
      if (h) items.push(h);
      continue;
    }
    registerAnchor(child, ctx);
    const inner = containerHtml(child, ctx);
    if (inner.trim()) {
      if (tag === "ol" && !isNone) {
        items.push(`<li value="${index}">${inner}</li>`);
        index++;
      } else {
        items.push(`<li>${inner}</li>`);
      }
    }
  }
  if (!items.length) return "";
  const start = tag === "ol" && !isNone ? parseInt(el.getAttribute("start") || "", 10) : NaN;
  const listClass = isNone ? "er-list er-list-none" : "er-list";
  return `<${tag} class="${listClass}"${isNaN(start) ? "" : ` start="${start}"`}>${items.join("")}</${tag}>`;
}

function tableToHtml(el: Element, ctx?: unknown): string {
  const rows = Array.from(el.querySelectorAll ? el.querySelectorAll("tr") : []);
  if (!rows.length) return "";
  const body = rows.map((tr) => {
    const cells = Array.from(tr.children || []).filter((c) => /^(td|th)$/i.test(c.tagName || ""));
    if (!cells.length) return "";
    return "<tr>" + cells.map((c) => {
      const t = (c.tagName || "").toLowerCase() === "th" ? "th" : "td";
      const inner = inlineHtml(c, ctx).trim();
      return `<${t}>${inner}</${t}>`;
    }).join("") + "</tr>";
  }).filter(Boolean).join("");
  return body ? `<table class="er-table">${body}</table>` : "";
}

export function nodeToHtml(el: Element | null, ctx?: unknown): string {
  if (!el) return "";
  const tag = (el.tagName || "").toLowerCase();
  registerAnchor(el, ctx);
  const text = (el.textContent || "").trim();
  const hasImg = !!(el.querySelector && (el.querySelector("img") || el.querySelector("image")));
  if (!text && !["br", "hr", "img", "svg", "image"].includes(tag) && !hasImg)
    return "";
  if (/^h[1-6]$/.test(tag)) {
    const inner = wrapFormat(el, inlineHtml(el, ctx), ctx) || escHtml(text);
    return `<${tag}>${takeAnchors(ctx)}${inner}</${tag}>`;
  }
  if (tag === "br") return "<br>";
  if (tag === "hr") return "<hr>";
  if (tag === "img") {
    const src = (el.getAttribute && el.getAttribute("src")) || "";
    if (!src) return "";
    return `${takeAnchors(ctx)}<img src="${escHtml(src)}" style="max-width:100%;height:auto;display:block;margin:6px auto">`;
  }
  if (tag === "svg") {
    const imgEl = el.querySelector ? (el.querySelector("image") || el.querySelector("img")) : null;
    if (imgEl) {
      const src = (imgEl.getAttribute && (imgEl.getAttribute("xlink:href") || imgEl.getAttribute("href") || imgEl.getAttribute("src"))) || "";
      if (src) {
        return `${takeAnchors(ctx)}<img src="${escHtml(src)}" style="max-width:100%;height:auto;display:block;margin:6px auto">`;
      }
    }
    return "";
  }
  if (tag === "image") {
    const src = (el.getAttribute && (el.getAttribute("xlink:href") || el.getAttribute("href"))) || "";
    if (!src) return "";
    return `${takeAnchors(ctx)}<img src="${escHtml(src)}" style="max-width:100%;height:auto;display:block;margin:6px auto">`;
  }
  if (tag === "pre") {
    const code = (el.textContent || "").replace(/\s+$/, "");
    return code.trim() ? `<pre class="er-code"><code>${escHtml(code)}</code></pre>` : "";
  }
  if (tag === "table") return tableToHtml(el, ctx);
  if (isQuoteLike(el)) return quoteHtml(el, ctx);
  if (tag === "aside") {
    const inner = containerHtml(el, ctx);
    return inner ? `<div class="er-side-notes">${inner}</div>` : "";
  }
  if (tag === "ul" || tag === "ol") return listHtml(el, ctx);
  if (tag === "dl") {
    return Array.from(el.children || []).map((c) => nodeToHtml(c, ctx)).filter(Boolean).join("\n");
  }
  if (["div", "section", "article", "body", "main", "figure", "nav", "header"].includes(tag)) {
    return containerHtml(el, ctx);
  }
  if (["p", "li", "dt", "dd"].includes(tag)) {
    const hasLink = !!(el.querySelector && el.querySelector("a[href]"));
    if (!hasLink) {
      const toc = tocLineHtml(text);
      if (toc) return toc;
    }
    return containerHtml(el, ctx);
  }
  const inner = wrapFormat(el, inlineHtml(el, ctx), ctx) || escHtml(text);
  return inner.trim() ? `<p>${takeAnchors(ctx)}${inner}</p>` : "";
}

export function inlineHtml(el: { childNodes: NodeListOf<ChildNode> | Node[] } | Element, ctx?: unknown): string {
  let out = "";
  for (const node of Array.from(el.childNodes || [])) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += escHtml(node.textContent || "");
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const childEl = node as Element;
    const t = (childEl.tagName || "").toLowerCase();
    registerAnchor(childEl, ctx);
    let inner = inlineHtml(childEl, ctx);
    if (!inner && !["br", "img", "image", "svg"].includes(t)) continue;
    inner = wrapFormat(childEl, inner, ctx);
    if (t === "b" || t === "strong") {
      out += `<strong>${inner}</strong>`;
    } else if (["i", "em", "cite", "dfn", "var"].includes(t)) {
      out += `<em>${inner}</em>`;
    } else if (["code", "kbd", "samp", "tt"].includes(t)) {
      out += `<code>${inner}</code>`;
    } else if (t === "sup") {
      out += `<sup>${inner}</sup>`;
    } else if (t === "sub") {
      out += `<sub>${inner}</sub>`;
    } else if (t === "s" || t === "strike" || t === "del") {
      out += `<s>${inner}</s>`;
    } else if (t === "u" || t === "ins") {
      out += `<u>${inner}</u>`;
    } else if (t === "mark") {
      out += `<mark>${inner}</mark>`;
    } else if (t === "br") {
      out += "<br>";
    } else if (t === "img") {
      const src = (childEl.getAttribute && childEl.getAttribute("src")) || "";
      if (src) out += `<img src="${escHtml(src)}" style="max-width:100%;height:auto">`;
    } else if (t === "image") {
      const src = (childEl.getAttribute && (childEl.getAttribute("xlink:href") || childEl.getAttribute("href"))) || "";
      if (src) out += `<img src="${escHtml(src)}" style="max-width:100%;height:auto">`;
    } else if (t === "svg") {
      const imgEl = childEl.querySelector ? (childEl.querySelector("image") || childEl.querySelector("img")) : null;
      if (imgEl) {
        const src = (imgEl.getAttribute && (imgEl.getAttribute("xlink:href") || imgEl.getAttribute("href") || imgEl.getAttribute("src"))) || "";
        if (src) out += `<img src="${escHtml(src)}" style="max-width:100%;height:auto">`;
      }
    } else if (t === "a") {
      const href = (childEl.getAttribute && childEl.getAttribute("href")) || "";
      if (/^https?:\/\//i.test(href)) {
        out += `<a class="er-xlink" href="${escAttr(href)}" target="_blank" rel="noopener">${inner}</a>`;
      } else if (href && !/^[a-z][a-z0-9+.-]*:/i.test(href) && ctx && ctx.href) {
        out += `<a class="er-ilink" data-er-ref="${escAttr(epubResolveHref(ctx.href, href))}">${inner}</a>`;
      } else {
        out += inner;
      }
    } else {
      out += inner;
    }
  }
  return out;
}

export async function getArchiveText(book: unknown, path: string): Promise<string> {
  try {
    if (typeof book.archive.getText === "function") {
      const t = await book.archive.getText(path);
      if (t) return t;
    }
  } catch {
    /* ignore */
  }
  try {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    const file = (book.archive && book.archive.zip && book.archive.zip.file && (book.archive.zip.file(cleanPath) || book.archive.zip.file(path))) || null;
    if (file && typeof file.async === "function") {
      return await file.async("text");
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function lastCompoundClasses(selector: string): string[] {
  const out: string[] = [];
  for (const part of String(selector || "").split(",")) {
    const last = part.trim().split(/[\s>+~]+/).pop() || "";
    if (!last || last.includes(":")) continue;
    for (const m of last.matchAll(/\.([-_a-zA-Z0-9]+)/g)) out.push(m[1].toLowerCase());
  }
  return out;
}

export function parseCssRulesForFormatting(cssText: string, boldClasses: Set<string>, italicClasses: Set<string>, extra?: unknown): void {
  if (!cssText) return;
  const clean = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
  const ruleRe = /([^{}]+)\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(clean)) !== null) {
    const selector = match[1];
    const body = match[2];
    const flags = {
      bold: /font-weight\s*:\s*(bold|bolder|[6-9]00)\b/i.test(body),
      italic: /font-style\s*:\s*(italic|oblique)\b/i.test(body),
      underline: /text-decoration(?:-line)?\s*:[^;}]*\bunderline\b/i.test(body),
      strike: /text-decoration(?:-line)?\s*:[^;}]*\bline-through\b/i.test(body),
      smallcaps: /font-variant(?:-caps)?\s*:[^;}]*\bsmall-caps\b/i.test(body),
      listNone: /list-style(?:-type)?\s*:\s*none\b/i.test(body),
      heading: (
        /(?:font-size\s*:\s*(?:1\.[1-9]|[2-9]|\d{2,})\s*(?:em|rem|pt|px)|\bpage-break-after\s*:\s*avoid\b)/i.test(body) &&
        /(?:font-weight\s*:\s*(?:bold|bolder|[6-9]00)|line-height\s*:\s*1\.[0-3]|font-family)/i.test(body)
      ) || /(?:^|[\s.#_])(?:heading|subhead|subheading|title|titulo|subtitulo|caption|toc_id|header|h[1-6])(?:[-_0-9]|$)/i.test(selector)
    };
    if (!flags.bold && !flags.italic && !flags.underline && !flags.strike && !flags.smallcaps && !flags.listNone && !flags.heading) continue;

    if (extra && flags.listNone) {
      const trimmed = selector.trim().toLowerCase();
      if (trimmed === "ol" || trimmed === "ol.er-list") extra.allOlNone = true;
      if (trimmed === "ul" || trimmed === "ul.er-list") extra.allUlNone = true;
    }

    for (const clsName of lastCompoundClasses(selector)) {
      if (flags.bold) boldClasses.add(clsName);
      if (flags.italic) italicClasses.add(clsName);
      if (extra) {
        if (flags.underline) extra.underline.add(clsName);
        if (flags.strike) extra.strike.add(clsName);
        if (flags.smallcaps) extra.smallcaps.add(clsName);
        if (flags.listNone) extra.listNone.add(clsName);
        if (flags.heading) extra.headings.add(clsName);
      }
    }
  }
}

export function epubResolveHref(base: string, href: string): string {
  let path = String(href || "");
  let frag = "";
  const hash = path.indexOf("#");
  if (hash >= 0) { frag = path.slice(hash + 1); path = path.slice(0, hash); }
  try { path = decodeURIComponent(path); } catch { /* keep raw */ }
  try { frag = decodeURIComponent(frag); } catch { /* keep raw */ }
  if (!path) path = base;
  else if (!path.startsWith("/")) {
    const dir = String(base || "").split("/").slice(0, -1);
    path = [...dir, ...path.split("/")].join("/");
  }
  const stack: string[] = [];
  for (const seg of path.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") stack.pop();
    else stack.push(seg);
  }
  return `${stack.join("/")}#${frag}`;
}

export function epubFlattenToc(book: unknown): unknown[] {
  const out: unknown[] = [];
  const spine = book.spine;
  const keyFor = (href: string) => {
    const raw = String(href || "");
    const hash = raw.indexOf("#");
    const path = hash >= 0 ? raw.slice(0, hash) : raw;
    const frag = hash >= 0 ? raw.slice(hash + 1) : "";
    let sec = null;
    try { sec = spine.get(path); } catch { /* try a looser match below */ }
    let secHref = sec && sec.href;
    if (!secHref) {
      const hit = (spine.spineItems || []).find((s: unknown) => s.href && (s.href.endsWith(path) || path.endsWith(s.href)));
      secHref = hit && hit.href;
    }
    if (!secHref) return null;
    return epubResolveHref(secHref, "#" + frag);
  };
  const walk = (items: unknown[], level: number) => {
    for (const t of items || []) {
      const label = String(t.label || "").replace(/\s+/g, " ").trim();
      const key = keyFor(t.href);
      if (label && key) out.push({ label, key, level });
      walk(t.subitems, level + 1);
    }
  };
  walk(book.navigation && book.navigation.toc, 0);
  return out;
}

export async function extractEpub(file: TFile, app: App, meta?: Record<string, unknown>): Promise<string> {
  const buf = await app.vault.readBinary(file);
  const book = ePub(buf);
  await book.ready;
  const spineItems = book.spine.spineItems;
  const parts: string[] = [];
  for (const item of spineItems) {
    try {
      const doc = await item.load(book.load.bind(book));
      const body = (doc && doc.querySelector && doc.querySelector("body")) || doc;

      const boldClasses = new Set<string>();
      const italicClasses = new Set<string>();
      const extra = {
        underline: new Set<string>(),
        strike: new Set<string>(),
        smallcaps: new Set<string>(),
        listNone: new Set<string>(),
        headings: new Set<string>(),
        allOlNone: false,
        allUlNone: false
      };

      const styleEls = Array.from((doc && doc.querySelectorAll && doc.querySelectorAll("style")) || []);
      for (const s of styleEls) {
        parseCssRulesForFormatting((s as Element).textContent || "", boldClasses, italicClasses, extra);
      }

      const itemPath = item.href || item.url || "";
      const linkEls = Array.from((doc && doc.querySelectorAll && doc.querySelectorAll("link[rel='stylesheet'], link[type='text/css']")) || []);
      for (const link of linkEls) {
        const href = (link as Element).getAttribute && (link as Element).getAttribute("href");
        if (!href) continue;
        try {
          const resolved = epubResolveArchivePath(itemPath, href);
          let cssText = await getArchiveText(book, resolved);
          if (!cssText && resolved.startsWith("/")) {
            cssText = await getArchiveText(book, resolved.slice(1));
          }
          if (cssText) parseCssRulesForFormatting(cssText, boldClasses, italicClasses, extra);
        } catch {
          /* continua se um stylesheet específico falhar */
        }
      }

      const imgNodes = Array.from((body && body.querySelectorAll && body.querySelectorAll("img, image")) || []);
      for (const node of imgNodes) {
        const el = node as Element;
        const isSvgImg = (el.tagName || "").toLowerCase() === "image";
        const src = isSvgImg ? (el.getAttribute("xlink:href") || el.getAttribute("href")) : el.getAttribute("src");
        if (!src || src.startsWith("data:")) continue;
        try {
          const resolved = epubResolveArchivePath(itemPath, src);
          let dataUrl = await book.archive.getBase64(resolved);
          if (!dataUrl && resolved.startsWith("/")) {
            dataUrl = await book.archive.getBase64(resolved.slice(1));
          }
          if (dataUrl) {
            if (isSvgImg) {
              el.setAttribute("xlink:href", dataUrl);
              el.setAttribute("href", dataUrl);
            } else {
              el.setAttribute("src", dataUrl);
            }
          }
        } catch {
          /* optional step; a failure here must not interrupt reading */
        }
      }

      const chapterHref = item.href || item.url || "";
      const ctx = {
        boldClasses,
        italicClasses,
        underlineClasses: extra.underline,
        strikeClasses: extra.strike,
        smallcapsClasses: extra.smallcaps,
        listNoneClasses: extra.listNone,
        headingClasses: extra.headings,
        allOlNone: extra.allOlNone,
        allUlNone: extra.allUlNone,
        href: chapterHref,
        pending: [epubResolveHref(chapterHref, "#")]
      };
      const html = nodeToHtml(body, ctx);
      if (html.trim())
        parts.push(`<div class="er-section">${html}</div>`);
      item.unload();
    } catch {
      /* a chapter that will not parse is skipped, not fatal */
    }
  }
  if (meta) {
    try { meta.toc = epubFlattenToc(book); } catch { meta.toc = []; }
    try {
      if (book.package && book.package.metadata) {
        meta.author = book.package.metadata.creator || "";
        meta.title = book.package.metadata.title || "";
      }
    } catch { /* optional metadata */ }
  }
  book.destroy();
  return parts.join("\n");
}
