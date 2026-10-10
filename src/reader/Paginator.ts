import { FONTS } from '../utils/theme';

export const SHORT_PAGE_GAP = 0.35;

export interface PaginatorSettings {
  readMode?: string;
  pageTurnAnimation?: boolean;
  columns?: string;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  paragraphSpacing?: number;
  wordSpacing?: number;
  letterSpacing?: number;
  pageMargin?: string;
  textAlign?: string;
  vAlign?: string;
  maxLineCh?: number;
  theme?: string;
  einkMode?: boolean;
}

export class Paginator {
  spread: number = 0;
  total: number = 0;
  sw: number = 0; // stride per spread in px (float)
  cols: number = 1;
  builtWidth: number = 0;
  clip: HTMLElement | null = null;
  flow: HTMLElement | null = null;
  scrollMode: boolean = false;
  flipMode: boolean = false;
  animate: boolean = true;
  onSpreadChange: ((cur: number, tot: number) => void) | null = null;

  private _vAlign: string = 'top';
  private _vCache: Map<number, number> | null = null;
  private _blockGeom: Array<{ x: number; bottom: number }> | null = null;
  private _colX: Map<number, number> | null = null;
  private _pitch: number = 0;
  private _html: string = '';
  private _scrollT: number | null = null;
  private _isFlipping: boolean = false;
  private _activeStage: HTMLElement | null = null;
  private _flipTimeout: number | null = null;

  constructor() {
    this.spread = 0;
    this.total = 0;
    this.sw = 0;
  }

  /** Build the paginator. Returns [currentSpread, totalSpreads]. */
  async build(
    container: HTMLElement,
    html: string,
    settings: PaginatorSettings,
    savedSpread: number
  ): Promise<[number, number]> {
    const isReusedLayout = !!(
      this.flow &&
      this.clip &&
      this.flow.parentElement === this.clip &&
      this.clip.parentElement === container &&
      this._html === html
    );
    if (!isReusedLayout) container.empty();

    // Vertical placement is decided per spread from real geometry
    this._vAlign = settings.vAlign || 'top';
    this._vCache = null;
    this._blockGeom = null;

    // Read modes: "pages" (sliding spreads), "scroll" (vertical scroll), "flip" (realistic book page flip)
    const mode = settings.readMode || 'pages';
    this.scrollMode = mode === 'scroll';
    this.flipMode = mode === 'flip';
    this.animate = settings.pageTurnAnimation !== false;

    /* 1. Clip — measure real px after one frame */
    this.clip = isReusedLayout ? this.clip : container.createDiv('er-clip');
    this.clip.style.cssText = `flex:1;align-self:stretch;position:relative;min-width:0;min-height:0;`;
    if (this.scrollMode) this.clip.addClass('er-clip-scroll');
    else this.clip.removeClass('er-clip-scroll');

    if (this.flipMode) this.clip.addClass('er-clip-flip');
    else this.clip.removeClass('er-clip-flip');

    await new Promise((r) => window.requestAnimationFrame(r));
    await new Promise((r) => window.requestAnimationFrame(r));
    if (!container.offsetWidth) await new Promise((r) => window.setTimeout(r, 80));

    const aW = this.clip.offsetWidth || container.offsetWidth || 390;
    const aH = this.clip.offsetHeight || container.offsetHeight || 700;
    this.builtWidth = aW;

    const cols = settings.columns === '2' && aW > 700 ? 2 : 1;
    const gap = cols === 2 ? 48 : 0;

    let marginMult = 1.0;
    if (settings.pageMargin === 'compact') marginMult = 0.55;
    else if (settings.pageMargin === 'wide') marginMult = 1.6;
    else if (settings.pageMargin === 'extra') marginMult = 2.3;

    const basePadRaw = cols === 2 ? 48 : aW <= 600 ? 26 : aW <= 820 ? 42 : 60;
    const basePad = Math.max(10, Math.round(basePadRaw * marginMult));
    const padVt = Math.min(basePad, 40);
    const padVtBot = padVt;
    const aHinner = aH - padVt - padVtBot;

    // Add spine visual in realistic flip mode with two columns
    if (this.flipMode && cols === 2) {
      if (!this.clip.querySelector('.er-book-spine')) {
        const spine = this.clip.createDiv('er-book-spine');
        spine.setAttribute('aria-hidden', 'true');
      }
    } else {
      const existingSpine = this.clip.querySelector('.er-book-spine');
      if (existingSpine && existingSpine.parentElement) {
        existingSpine.parentElement.removeChild(existingSpine);
      }
    }

    /* 2. Column geometry */
    const slot = aW / cols;
    const colW = this.scrollMode ? aW : slot - gap;
    const flowW = this.scrollMode ? aW : 4000 * slot - gap;

    let pad = basePad;
    const maxCh = Number(settings.maxLineCh) || 0;
    if (maxCh > 0) {
      const target = maxCh * (Number(settings.fontSize) || 18) * 0.5;
      if (target > 0 && target < colW - basePad * 2) pad = Math.round((colW - target) / 2);
    }

    /* 3. Flow element */
    this.flow = isReusedLayout && this.flow ? this.flow : this.clip.createDiv('er-flow');
    this.flow.style.cssText = `
      width:${flowW}px;
      ${
        this.scrollMode
          ? 'height:auto;min-height:100%;'
          : `height:${aHinner}px;
      column-width:${colW}px;
      column-gap:${gap}px;
      column-fill:auto;`
      }
      position:relative;
      left:${this.scrollMode ? 0 : gap / 2}px;
      orphans:1;
      widows:1;
      padding:${padVt}px 0 ${padVtBot}px;
      box-sizing:content-box;
      margin-top:0;
      font-family:${FONTS[settings.fontFamily || ''] || FONTS.georgia || 'serif'};
      font-size:${settings.fontSize || 18}px;
      line-height:${settings.lineHeight || 1.8};
      letter-spacing:${settings.letterSpacing != null ? settings.letterSpacing : 0}px;
      word-spacing:${settings.wordSpacing != null ? settings.wordSpacing : 0}px;
      color:var(--er-text);
      background:var(--er-bg);
      overflow:hidden;
      user-select:text;
      -webkit-user-select:text;
      will-change:transform;`;

    /* Padding via <style> so every column gets consistent margins */
    const markup = `<style>
.er-flow b,.er-flow strong{font-weight:700 !important}
.er-flow i,.er-flow em,.er-flow cite,.er-flow dfn,.er-flow var{font-style:italic !important}
.er-flow b em,.er-flow strong em,.er-flow b i,.er-flow strong i,
.er-flow em b,.er-flow em strong,.er-flow i b,.er-flow i strong{font-weight:700 !important;font-style:italic !important}
.er-flow p{text-align:${settings.textAlign || 'justify'};text-indent:1.2em}
.er-flow p:first-of-type,.er-flow h1+p,.er-flow h2+p,.er-flow h3+p,.er-flow h4+p,.er-flow .er-subhead+p,.er-flow .er-quote p,.er-flow .er-list p{text-indent:0}
.er-flow u,.er-flow ins{text-decoration:underline;text-decoration-thickness:from-font;text-underline-offset:.16em}
.er-flow s,.er-flow del,.er-flow strike{text-decoration:line-through}
.er-flow .er-sc{font-variant:small-caps;letter-spacing:.03em}
.er-flow ul.er-list:not(.er-list-none){list-style-type:disc !important}
.er-flow ol.er-list:not(.er-list-none){list-style-type:decimal !important;counter-reset:none !important}
.er-flow ul.er-list:not(.er-list-none),.er-flow ol.er-list:not(.er-list-none){margin:.2em ${pad}px .9em;padding:0 0 0 2em}
.er-flow .er-list-none,.er-flow ol.er-list-none,.er-flow ul.er-list-none{list-style:none !important;list-style-type:none !important;padding-left:${pad}px !important;padding-right:${pad}px !important;margin:.2em 0 .8em !important}
.er-flow .er-list-none>li{list-style:none !important;list-style-type:none !important;padding-left:0 !important;margin:0 0 .4em}
.er-flow .er-list-none>li::before{display:none !important;content:none !important}
.er-flow ul.er-list ul.er-list,.er-flow ol.er-list ol.er-list,.er-flow ul.er-list ol.er-list,.er-flow ol.er-list ul.er-list{margin:.25em 0 .35em;padding-left:1.5em}
.er-flow .er-list li{margin:0 0 .3em;break-inside:auto;-webkit-column-break-inside:auto;list-style-position:outside}
.er-flow .er-list li::before{display:none !important;content:none !important}
.er-flow .er-list li>p{padding:0 !important;margin:0 0 .3em !important;text-align:left;text-indent:0}
.er-flow .er-subhead{font-weight:700 !important;font-size:1.22em;line-height:1.3;margin:1.3em 0 .45em;padding-left:${pad}px;padding-right:${pad}px;text-align:left;text-indent:0 !important;break-after:avoid;-webkit-column-break-after:avoid}
.er-flow .er-subhead p{padding:0 !important;margin:0 !important;text-indent:0 !important;font-size:inherit;font-weight:inherit;text-align:left;display:inline}
.er-flow blockquote.er-quote{margin:.5em ${pad}px 1em;padding:.4em 1em .4em 1.05em;
  border-left:3px solid var(--er-accent);border-radius:0 10px 10px 0;
  background:color-mix(in srgb,var(--er-text) 5%,transparent);font-style:italic;
  break-inside:auto;-webkit-column-break-inside:auto;
  box-decoration-break:clone;-webkit-box-decoration-break:clone}
.er-flow blockquote.er-quote p{padding:0 !important;margin:0 0 .55em !important;text-align:left}
.er-flow blockquote.er-quote p:last-child{margin-bottom:0 !important}
.er-flow blockquote.er-quote p.er-cite{font-style:normal;font-size:.88em;opacity:.78;text-align:right;margin-top:.5em !important}
.er-flow blockquote.er-quote p.er-cite::before{content:"— "}
.er-flow a.er-ilink{color:var(--er-accent);text-decoration:none;border-bottom:1px dotted currentColor;cursor:pointer}
.er-flow a.er-xlink{color:var(--er-accent);text-decoration:underline;text-underline-offset:.16em}
.er-flow .er-anchor{display:inline;width:0;height:0;padding:0;margin:0}
.er-eink .er-flow blockquote.er-quote{background:none;border-left-color:#000}
.er-flow .er-section,.er-flow .er-pdf-page-break{
  display:block;overflow:visible;contain:none;
  break-inside:auto;-webkit-column-break-inside:auto}
.er-flow p,.er-flow li{
  break-inside:auto;-webkit-column-break-inside:auto;orphans:1;widows:1}
.er-flow p,.er-flow h1,.er-flow h2,.er-flow h3,.er-flow h4{
  padding-left:${pad}px;padding-right:${pad}px;margin:0 0 ${settings.paragraphSpacing != null ? settings.paragraphSpacing : 0.75}em}
.er-flow h1,.er-flow h2,.er-flow h3,.er-flow h4{margin-top:1.1em}
.er-flow>p:first-of-type,.er-flow .er-section:first-child>p:first-child,
.er-flow .er-section:first-child>h1:first-child,.er-flow .er-section:first-child>h2:first-child,
.er-flow .er-section:first-child>h3:first-child{padding-top:${padVt}px}
.er-flow img{max-width:calc(100% - ${pad * 2}px);max-height:${aHinner - 12}px;height:auto;width:auto;object-fit:contain;display:block;margin:8px auto;break-inside:avoid;page-break-inside:avoid;-webkit-column-break-inside:avoid}
.er-flow figure{break-inside:avoid;-webkit-column-break-inside:avoid;margin:8px auto}
.er-flow .er-pdf-figure{margin:0 0 .9em;padding:0 ${pad}px;break-inside:avoid;-webkit-column-break-inside:avoid;text-align:center;position:relative}
.er-flow .er-pdf-note-btn{position:absolute;top:8px;right:${pad + 8}px;width:34px;height:34px;
  display:flex;align-items:center;justify-content:center;padding:6px;cursor:pointer;
  background:var(--er-ui);color:var(--er-text);border:1px solid var(--er-border);border-radius:9px;
  opacity:.55;transition:opacity .15s,transform .15s;z-index:2}
.er-flow .er-pdf-note-btn:hover{opacity:1;transform:scale(1.06)}
.er-flow .er-pdf-note-btn svg{width:18px;height:18px}
.er-flow .er-pdf-page-img{max-width:100%;max-height:${aHinner - 24}px;width:auto;height:auto;object-fit:contain;margin:4px auto;border:1px solid var(--er-border);border-radius:10px;break-inside:avoid;-webkit-column-break-inside:avoid}
.er-flow pre.er-code{margin:0 0 .85em;padding:.55em .7em;box-sizing:border-box;
  max-width:calc(100% - ${pad * 2}px);margin-left:${pad}px;margin-right:${pad}px;
  white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2;
  font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;
  font-size:.8em;line-height:1.45;background:var(--er-ui);border:1px solid var(--er-border);
  border-radius:8px;break-inside:avoid;-webkit-column-break-inside:avoid}
.er-flow pre.er-code code{font:inherit;background:none;padding:0;color:inherit}
.er-flow p.er-toc-line{display:flex;align-items:baseline;gap:8px;text-align:left !important;
  margin:0 0 .35em;padding-left:${pad}px;padding-right:${pad}px}
.er-flow p.er-toc-line .er-toc-t{flex:1;min-width:0}
.er-flow p.er-toc-line .er-toc-n{flex:none;opacity:.65;font-variant-numeric:tabular-nums}
.er-flow .er-side-notes{margin:.2em ${pad}px .9em;padding:.5em .8em;border-left:2px solid var(--er-border);
  background:color-mix(in srgb,var(--er-text) 4%,transparent);border-radius:0 8px 8px 0;
  break-inside:avoid;-webkit-column-break-inside:avoid}
.er-flow .er-side-notes p{padding:0 !important;margin:0 0 .4em;font-size:.9em;opacity:.85;text-align:left}
.er-flow .er-side-notes p:last-child{margin-bottom:0}
.er-flow code{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;
  font-size:.86em;background:var(--er-ui);border:1px solid var(--er-border);border-radius:4px;
  padding:0 .28em;overflow-wrap:anywhere}
.er-flow table.er-table{margin:0 ${pad}px .9em;border-collapse:collapse;
  max-width:calc(100% - ${pad * 2}px);font-size:.82em;line-height:1.4;
  break-inside:avoid;-webkit-column-break-inside:avoid}
.er-flow table.er-table th,.er-flow table.er-table td{border:1px solid var(--er-border);
  padding:.3em .5em;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.er-flow table.er-table th{background:var(--er-ui);font-weight:700}
.er-flow .er-light{font-weight:300 !important;opacity:.9}
.er-flow .er-end{display:block;height:0;margin:0;padding:0;border:0;visibility:hidden}
</style>${html}<div class="er-end" aria-hidden="true"></div>`;

    if (!isReusedLayout) {
      const parsed = new DOMParser().parseFromString(markup, 'text/html');
      this.flow.empty();
      const nodes = [...Array.from(parsed.head.childNodes), ...Array.from(parsed.body.childNodes)];
      for (const node of nodes) {
        this.flow.appendChild(document.importNode(node, true));
      }
      this._html = html;
    }

    /* 4. Two rAF: first inserts DOM, second completes multicol layout */
    await new Promise((r) => window.requestAnimationFrame(r));
    await new Promise((r) => window.requestAnimationFrame(r));

    /* 4b. Reserve lazy figure boxes */
    const figMaxH = Math.max(40, aHinner - 24);
    for (const img of Array.from(this.flow.querySelectorAll('img.er-pdf-lazy'))) {
      const aw = parseFloat(img.getAttribute('width') || '0') || 0;
      const ah = parseFloat(img.getAttribute('height') || '0') || 0;
      if (!aw || !ah) continue;
      const host = img.parentElement;
      const hostW = host ? host.getBoundingClientRect().width - pad * 2 : colW - pad * 2;
      const maxW = Math.max(40, hostW);
      const scale = Math.min(1, maxW / aw, figMaxH / ah);
      (img as HTMLElement).style.width = `${Math.round(aw * scale)}px`;
      (img as HTMLElement).style.height = `${Math.round(ah * scale)}px`;
    }
    await new Promise((r) => window.requestAnimationFrame(r));

    /* 5. Count columns */
    const endEl = this.flow.querySelector('.er-end');
    const measure = (): number => {
      const fRect = this.flow.getBoundingClientRect();
      let lastX = endEl ? endEl.getBoundingClientRect().right - fRect.left : 0;
      if (lastX <= 0) {
        for (const el of Array.from(this.flow.querySelectorAll(
          'p,h1,h2,h3,h4,h5,h6,img,li,pre,table,blockquote,figure,dd,dt'
        ))) {
          const r = el.getBoundingClientRect().right - fRect.left;
          if (r > lastX) lastX = r;
        }
      }
      return Math.max(1, Math.ceil(lastX / slot));
    };

    /* Scrolling mode */
    if (this.scrollMode) {
      this.sw = aH;
      this.cols = 1;
      this._pitch = aH;
      this._colX = null;
      const viewH = this.clip.clientHeight || aH;
      this.total = Math.max(1, Math.ceil((this.clip.scrollHeight || viewH) / viewH));
      this.spread = Math.max(0, Math.min(savedSpread, this.total - 1));
      this.flow.toggleClass('er-flow-anim', this.animate !== false);
      this.applyTransform(false);

      this.clip.addEventListener(
        'scroll',
        () => {
          if (this._scrollT) window.clearTimeout(this._scrollT);
          this._scrollT = window.setTimeout(() => {
            const h = this.clip.clientHeight || 1;
            const at = Math.max(0, Math.min(Math.round(this.clip.scrollTop / h), this.total - 1));
            if (at === this.spread) return;
            this.spread = at;
            if (this.onSpreadChange) this.onSpreadChange(at, this.total);
          }, 140);
        },
        { passive: true }
      );
      return [this.spread, this.total];
    }

    /* Paged / Flip mode */
    let nPhys = measure();
    this.flow.style.width = `${Math.ceil(nPhys * slot) - gap}px`;
    await new Promise((r) => window.requestAnimationFrame(r));
    await new Promise((r) => window.requestAnimationFrame(r));
    nPhys = Math.max(nPhys, measure());

    this.sw = slot * cols;
    this.cols = cols;
    this._pitch = slot;

    this._colX = null;
    try {
      const fRect2 = this.flow.getBoundingClientRect();
      const endX = endEl ? endEl.getBoundingClientRect().left - fRect2.left : 0;
      if (endEl && Math.abs(endX - (nPhys - 1) * slot) > 1) {
        this._colX = new Map();
        for (const el of Array.from(this.flow.querySelectorAll('p,h1,h2,h3,h4'))) {
          const x = el.getBoundingClientRect().left - fRect2.left;
          const k = Math.round(x / slot);
          const curr = this._colX.get(k);
          if (curr === undefined || x < curr) this._colX.set(k, x);
        }
      }
    } catch {
      this._colX = null;
    }

    this.total = Math.max(1, Math.ceil(nPhys / cols));
    this.spread = Math.max(0, Math.min(savedSpread, this.total - 1));
    this.flow.toggleClass('er-flow-anim', !this.flipMode && this.animate !== false);
    this.applyTransform(false);
    return [this.spread, this.total];
  }

  _vOffsetFor(s: number): number {
    const mode = this._vAlign || 'top';
    if (mode === 'top' || !this.flow) return 0;
    if (!this._vCache) this._vCache = new Map();
    const cached = this._vCache.get(s);
    if (cached !== undefined) return cached;
    let off = 0;
    try {
      if (!this._blockGeom) {
        const fRect = this.flow.getBoundingClientRect();
        this._blockGeom = [...Array.from(this._blocks())].map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left - fRect.left, bottom: r.bottom - fRect.top };
        });
      }
      const from = this._spreadOffsetFor(s);
      const to = from + this.sw;
      let maxBottom = 0;
      for (const g of this._blockGeom) {
        if (g.x >= from - 2 && g.x < to - 2 && g.bottom > maxBottom) maxBottom = g.bottom;
      }
      const height = this.flow.clientHeight || 0;
      if (maxBottom > 0 && height > 0) {
        const leftover = height - maxBottom;
        if (leftover > height * SHORT_PAGE_GAP) off = mode === 'center' ? leftover / 2 : leftover;
      }
    } catch {
      off = 0;
    }
    off = Math.round(off);
    this._vCache.set(s, off);
    return off;
  }

  _vOffset(): number {
    return this._vOffsetFor(this.spread);
  }

  _spreadOffsetFor(s: number): number {
    if (this.scrollMode) return this.clip ? this.clip.scrollTop : 0;
    const k = s * (this.cols || 1);
    const exact = this._colX && this._colX.get(k);
    if (typeof exact === 'number') return exact;
    if (this._colX && this._colX.size) {
      let bestK: number | null = null;
      for (const kk of this._colX.keys()) {
        if (bestK === null || Math.abs(kk - k) < Math.abs(bestK - k)) bestK = kk;
      }
      if (bestK !== null) {
        const base = this._colX.get(bestK) ?? 0;
        return base + (k - bestK) * (this._pitch || this.sw / (this.cols || 1));
      }
    }
    return s * this.sw;
  }

  _spreadOffset(): number {
    return this._spreadOffsetFor(this.spread);
  }

  applyTransform(animate = true): void {
    if (!this.flow || !this.clip) return;
    if (this.scrollMode) {
      const viewH = this.clip.clientHeight || 1;
      this.clip.scrollTo({ top: this.spread * viewH, behavior: animate ? 'smooth' : 'auto' });
      return;
    }

    this.flow.style.top = this._vOffset() + 'px';
    const t = `translate3d(${-Math.round(this._spreadOffset())}px, 0, 0)`;

    if (this.flipMode) {
      // No modo flip, aplicamos a transição elástica de folha de papel física diretamente na GPU
      this.flow.removeClass('er-flow-anim');
      this.flow.toggleClass('er-flow-paper-anim', animate && this.animate !== false);
      this.flow.style.transform = t;
    } else if (!animate) {
      this.flow.removeClass('er-flow-anim');
      this.flow.removeClass('er-flow-paper-anim');
      this.flow.getBoundingClientRect();
      this.flow.style.transform = t;
      window.requestAnimationFrame(() => this.flow?.toggleClass('er-flow-anim', this.animate !== false));
    } else {
      this.flow.removeClass('er-flow-paper-anim');
      this.flow.style.transform = t;
    }
  }

  /**
   * Realistic Page Flip (Kindle E-Paper Ultra-Fluid Engine - Opção A)
   * Zero DOM clones, aceleração pura de hardware GPU, 120 FPS
   */
  performRealisticFlip(direction: 1 | -1, fromSpread: number, toSpread: number): void {
    if (!this.clip || !this.flow) return;
    this._cleanupFlip();
    this._isFlipping = true;

    const clipW = this.clip.offsetWidth || 400;

    // Sombra dinâmica de curvatura de papel deslizando sobre a borda da folha
    const shadow = this.clip.createDiv('er-paper-crease-shadow');
    this._activeStage = shadow;

    if (direction === 1) {
      // AVANÇAR: sombra desliza da direita para a esquerda
      shadow.addClass('er-shadow-next');
      shadow.setCssStyles({
        left: `${clipW}px`,
        transform: 'translate3d(0, 0, 0)',
        opacity: '0.85',
      });
      shadow.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        shadow.setCssStyles({
          transform: `translate3d(-${clipW}px, 0, 0)`,
          opacity: '0',
        });
      });
    } else {
      // VOLTAR: sombra desliza da esquerda para a direita
      shadow.addClass('er-shadow-prev');
      shadow.setCssStyles({
        left: '-54px',
        transform: 'translate3d(0, 0, 0)',
        opacity: '0.85',
      });
      shadow.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        shadow.setCssStyles({
          transform: `translate3d(${clipW + 54}px, 0, 0)`,
          opacity: '0',
        });
      });
    }

    // Executa a transição de papel diretamente no flow
    this.spread = toSpread;
    this.applyTransform(true);

    this._flipTimeout = window.setTimeout(() => {
      this._cleanupFlip();
    }, 290);
  }

  private _cleanupFlip(): void {
    if (this._flipTimeout) {
      window.clearTimeout(this._flipTimeout);
      this._flipTimeout = null;
    }
    if (this._activeStage && this._activeStage.parentElement) {
      this._activeStage.parentElement.removeChild(this._activeStage);
    }
    this._activeStage = null;
    this._isFlipping = false;
  }

  next(): [number, number] {
    if (this.spread < this.total - 1) {
      return this.goTo(this.spread + 1, true);
    }
    return [this.spread, this.total];
  }

  prev(): [number, number] {
    if (this.spread > 0) {
      return this.goTo(this.spread - 1, true);
    }
    return [this.spread, this.total];
  }

  goTo(s: number, animate = true): [number, number] {
    const target = Math.max(0, Math.min(s, this.total - 1));
    if (this.flipMode && animate && this.animate && target !== this.spread) {
      const dir = target > this.spread ? 1 : -1;
      const prev = this.spread;
      this.performRealisticFlip(dir, prev, target);
      return [this.spread, this.total];
    }
    this.spread = target;
    this.applyTransform(animate);
    return [this.spread, this.total];
  }

  jumpTo(s: number): [number, number] {
    return this.goTo(s, false);
  }

  _blocks(): NodeListOf<Element> {
    return this.flow ? this.flow.querySelectorAll('p,h1,h2,h3,h4') : ([] as unknown);
  }

  _blockIndexAtScroll(): number {
    const blocks = this._blocks();
    if (!blocks.length || !this.clip || !this.flow) return 0;
    const fTop = this.flow.getBoundingClientRect().top;
    const want = this.clip.scrollTop - 2;
    const topAt = (i: number) => blocks[i].getBoundingClientRect().top - fTop;
    let lo = 0,
      hi = blocks.length - 1,
      ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (topAt(mid) >= want) {
        ans = mid;
        hi = mid - 1;
      } else lo = mid + 1;
    }
    return ans;
  }

  currentBlockIndex(): number {
    if (this.scrollMode) return this._blockIndexAtScroll();
    const blocks = this._blocks();
    if (!blocks.length || !this.sw || !this.flow) return 0;
    const fLeft = this.flow.getBoundingClientRect().left;
    const winLeft = this._spreadOffset() - 2;
    const xat = (i: number) => blocks[i].getBoundingClientRect().left - fLeft;
    let lo = 0,
      hi = blocks.length - 1,
      ans = blocks.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (xat(mid) >= winLeft) {
        ans = mid;
        hi = mid - 1;
      } else lo = mid + 1;
    }
    return ans;
  }

  spreadForBlock(idx: number): number {
    if (this.scrollMode) {
      const blocks = this._blocks();
      if (!blocks.length || idx < 0 || !this.clip || !this.flow) return 0;
      const el = blocks[Math.min(idx, blocks.length - 1)];
      const top = el.getBoundingClientRect().top - this.flow.getBoundingClientRect().top;
      const viewH = this.clip.clientHeight || 1;
      return Math.max(0, Math.min(Math.floor(top / viewH), this.total - 1));
    }
    const blocks = this._blocks();
    if (!blocks.length || !this.sw || idx < 0 || !this.flow) return 0;
    const el = blocks[Math.min(idx, blocks.length - 1)];
    const x = el.getBoundingClientRect().left - this.flow.getBoundingClientRect().left;
    const k = Math.round(x / (this.sw / (this.cols || 1)));
    return Math.max(0, Math.min(Math.floor(k / (this.cols || 1)), this.total - 1));
  }

  blockEl(idx: number): Element | null {
    const blocks = this._blocks();
    if (!blocks.length) return null;
    return blocks[Math.min(Math.max(0, idx), blocks.length - 1)] || null;
  }

  get currentSpread(): number {
    return this.spread;
  }

  get currentPct(): number {
    return this.total > 1 ? this.spread / (this.total - 1) : 0;
  }

  get totalSpreads(): number {
    return this.total;
  }
}
