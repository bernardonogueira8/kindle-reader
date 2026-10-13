import { App, Modal, Notice, Setting, TFile, requestUrl } from "obsidian";
import { copyToClipboard } from "../../utils/dom";
import { __ertr } from "../../utils/i18n";
import { svgIcon } from "../../utils/icons";
import { createNoteFromSelection } from "../../main";

export interface DictMeaning {
  partOfSpeech: string;
  definitions: { definition: string; example?: string }[];
  synonyms?: string[];
}

export interface DictEntry {
  word: string;
  phonetic?: string;
  audio?: string;
  meanings: DictMeaning[];
}

export interface WikiSummary {
  title: string;
  description?: string;
  extract: string;
  thumbnailUrl?: string;
  pageUrl?: string;
}

export class DictionaryModal extends Modal {
  plugin: unknown;
  word: string;
  bookFile: TFile | null;
  private currentEntry: DictEntry | null = null;
  private currentWiki: WikiSummary | null = null;
  private resultsContainer!: HTMLElement;
  private searchInput!: HTMLInputElement;

  constructor(app: App, plugin: unknown, word: string, bookFile: TFile | null) {
    super(app);
    this.plugin = plugin;
    this.word = (word || "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim();
    this.bookFile = bookFile;
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("er-dict-modal");

    // Header & Search Box
    const header = contentEl.createDiv("er-dict-header");
    header.createEl("h3", { text: __ertr("Dictionary & Definitions") });

    const searchRow = contentEl.createDiv("er-dict-search-row");
    this.searchInput = searchRow.createEl("input", {
      type: "text",
      value: this.word,
      placeholder: __ertr("Search a word or concept…"),
      cls: "er-dict-search-input"
    });

    const searchBtn = searchRow.createEl("button", {
      text: __ertr("Search"),
      cls: "mod-cta er-dict-search-btn"
    });

    const doSearch = () => {
      const q = this.searchInput.value.trim();
      if (q) {
        this.word = q;
        this.lookup(q);
      }
    };

    searchBtn.addEventListener("click", doSearch);
    this.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });

    this.resultsContainer = contentEl.createDiv("er-dict-results");

    if (this.word) {
      await this.lookup(this.word);
    } else {
      this.resultsContainer.createDiv({
        cls: "er-dict-empty",
        text: __ertr("Type a word above to see its definition and Wikipedia summary.")
      });
    }
  }

  private async lookup(query: string): Promise<void> {
    this.resultsContainer.empty();
    const loading = this.resultsContainer.createDiv("er-dict-loading");
    loading.setText(__ertr("Searching definitions for “{0}”…", query));

    const cleanWord = query.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim();
    const lang = (this.plugin.settings?.translateTo || "en").toLowerCase();

    // Query in parallel
    const [dictRes, wikiRes] = await Promise.all([
      this.fetchDictionary(cleanWord),
      this.fetchWikipedia(cleanWord, lang)
    ]);

    this.currentEntry = dictRes;
    this.currentWiki = wikiRes;

    this.renderResults(cleanWord);
  }

  private async fetchDictionary(word: string): Promise<DictEntry | null> {
    if (!word || word.includes(" ")) return null;
    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`;
      const res = await requestUrl({ url, method: "GET", throw: false });
      if (res.status === 200 && Array.isArray(res.json) && res.json.length > 0) {
        const data = res.json[0];
        let audio: string | undefined;
        if (Array.isArray(data.phonetics)) {
          const phWithAudio = data.phonetics.find((p: unknown) => p.audio && p.audio.trim().length > 0);
          if (phWithAudio) audio = phWithAudio.audio;
        }
        const phonetic = data.phonetic || data.phonetics?.find((p: unknown) => p.text)?.text;

        const meanings: DictMeaning[] = (data.meanings || []).map((m: unknown) => ({
          partOfSpeech: m.partOfSpeech || "definition",
          definitions: (m.definitions || []).map((d: unknown) => ({
            definition: d.definition || "",
            example: d.example || ""
          })),
          synonyms: Array.isArray(m.synonyms) ? m.synonyms.slice(0, 6) : []
        }));

        return { word: data.word || word, phonetic, audio, meanings };
      }
    } catch (err) {
      console.debug("Kindle Reader: Dictionary API request failed", err);
    }
    return null;
  }

  private async fetchWikipedia(term: string, lang: string): Promise<WikiSummary | null> {
    const langsToTry = [lang];
    if (lang !== "en") langsToTry.push("en");

    for (const l of langsToTry) {
      try {
        const url = `https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`;
        const res = await requestUrl({ url, method: "GET", throw: false });
        if (res.status === 200 && res.json && res.json.extract && res.json.type !== "disambiguation") {
          return {
            title: res.json.title,
            description: res.json.description,
            extract: res.json.extract,
            thumbnailUrl: res.json.thumbnail?.source,
            pageUrl: res.json.content_urls?.desktop?.page || `https://${l}.wikipedia.org/wiki/${encodeURIComponent(term)}`
          };
        }
      } catch (err) {
        console.debug("Kindle Reader: Wikipedia API request failed", err);
      }
    }
    return null;
  }

  private renderResults(word: string): void {
    this.resultsContainer.empty();

    if (!this.currentEntry && !this.currentWiki) {
      const empty = this.resultsContainer.createDiv("er-dict-empty");
      empty.createEl("p", {
        text: __ertr("No definitions or encyclopedia entries found for “{0}”.", word)
      });
      empty.createEl("p", {
        cls: "er-dict-empty-hint",
        text: __ertr("Check the spelling or try searching a broader term.")
      });
      return;
    }

    // Dictionary Section
    if (this.currentEntry) {
      const dictSection = this.resultsContainer.createDiv("er-dict-section");
      const wordHeader = dictSection.createDiv("er-dict-word-head");
      wordHeader.createSpan({ cls: "er-dict-word-title", text: this.currentEntry.word });

      if (this.currentEntry.phonetic) {
        wordHeader.createSpan({ cls: "er-dict-phonetic", text: this.currentEntry.phonetic });
      }

      if (this.currentEntry.audio) {
        const audioBtn = wordHeader.createEl("button", {
          cls: "er-dict-audio-btn",
          attr: { "aria-label": __ertr("Listen pronunciation") }
        });
        svgIcon(audioBtn, "play");
        audioBtn.addEventListener("click", () => {
          try {
            const audio = new Audio(this.currentEntry?.audio);
            audio.play();
          } catch {
            new Notice(__ertr("Could not play audio"));
          }
        });
      }

      for (const m of this.currentEntry.meanings) {
        const mBlock = dictSection.createDiv("er-dict-meaning-block");
        mBlock.createSpan({ cls: "er-dict-pos", text: m.partOfSpeech });

        const ol = mBlock.createEl("ol", { cls: "er-dict-def-list" });
        for (const def of m.definitions) {
          const li = ol.createEl("li", { cls: "er-dict-def-item" });
          li.createSpan({ cls: "er-dict-def-text", text: def.definition });
          if (def.example) {
            li.createSpan({ cls: "er-dict-def-example", text: `“${def.example}”` });
          }
        }

        if (m.synonyms && m.synonyms.length > 0) {
          const synRow = mBlock.createDiv("er-dict-synonyms");
          synRow.createSpan({ cls: "er-dict-syn-label", text: __ertr("Synonyms: ") });
          for (const s of m.synonyms) {
            const chip = synRow.createSpan({ cls: "er-dict-syn-chip", text: s });
            chip.addEventListener("click", () => {
              this.searchInput.value = s;
              this.lookup(s);
            });
          }
        }
      }
    }

    // Wikipedia Section
    if (this.currentWiki) {
      const wikiSection = this.resultsContainer.createDiv("er-dict-wiki-section");
      const wikiHeader = wikiSection.createDiv("er-dict-wiki-head");
      wikiHeader.createSpan({ cls: "er-dict-wiki-badge", text: "WIKIPEDIA" });
      wikiHeader.createEl("h4", { cls: "er-dict-wiki-title", text: this.currentWiki.title });

      if (this.currentWiki.description) {
        wikiSection.createDiv({ cls: "er-dict-wiki-desc", text: this.currentWiki.description });
      }

      const wikiBody = wikiSection.createDiv("er-dict-wiki-body");
      if (this.currentWiki.thumbnailUrl) {
        wikiBody.createEl("img", {
          cls: "er-dict-wiki-thumb",
          attr: { src: this.currentWiki.thumbnailUrl, alt: this.currentWiki.title }
        });
      }
      wikiBody.createDiv({ cls: "er-dict-wiki-extract", text: this.currentWiki.extract });

      if (this.currentWiki.pageUrl) {
        const link = wikiSection.createEl("a", {
          cls: "er-dict-wiki-link",
          text: __ertr("Open full article on Wikipedia ↗"),
          href: this.currentWiki.pageUrl
        });
        link.setAttribute("target", "_blank");
      }
    }

    // Action buttons footer
    this.renderFooter();
  }

  private renderFooter(): void {
    const existingFoot = this.contentEl.querySelector(".er-dict-footer");
    if (existingFoot) existingFoot.remove();

    const footer = this.contentEl.createDiv("er-dict-footer");

    const formattedSummary = this.buildSummaryMarkdown();

    new Setting(footer)
      .addButton((b) =>
        b.setButtonText(__ertr("Copy definition")).onClick(async () => {
          const ok = await copyToClipboard(formattedSummary);
          new Notice(ok ? __ertr("Copied ✓") : __ertr("Could not copy"));
        })
      )
      .addButton((b) =>
        b
          .setButtonText(__ertr("Save to note"))
          .setCta()
          .onClick(async () => {
            await createNoteFromSelection(
              this.app,
              this.plugin,
              this.word,
              this.bookFile,
              {
                open: false,
                silent: true,
                extra: `\n\n${formattedSummary}`
              }
            );
            new Notice(__ertr("Note created with definition"));
            this.close();
          })
      );
  }

  private buildSummaryMarkdown(): string {
    const parts: string[] = [];
    if (this.currentEntry) {
      parts.push(`**${this.currentEntry.word}** ${this.currentEntry.phonetic ? `*(${this.currentEntry.phonetic})*` : ""}`);
      for (const m of this.currentEntry.meanings) {
        parts.push(`\n*${m.partOfSpeech}*`);
        m.definitions.forEach((d, i) => {
          parts.push(`${i + 1}. ${d.definition}`);
          if (d.example) parts.push(`   > *“${d.example}”*`);
        });
      }
    }
    if (this.currentWiki) {
      if (parts.length > 0) parts.push("\n---");
      parts.push(`**Wikipedia: ${this.currentWiki.title}**`);
      if (this.currentWiki.description) parts.push(`*${this.currentWiki.description}*`);
      parts.push(this.currentWiki.extract);
      if (this.currentWiki.pageUrl) parts.push(`[Wikipedia Link](${this.currentWiki.pageUrl})`);
    }
    return parts.join("\n");
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
