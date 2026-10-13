import { App, Plugin, TFile } from 'obsidian';
import { __ertr } from '../utils/i18n';
import { erAutoFocus } from '../utils/dom';
import { ReaderView } from '../ui/ReaderView';
import { OnboardingModal } from '../ui/modals';
import { BookQuickOpen } from '../ui/BookQuickOpen';
import { ReadingInsightsModal } from '../ui/ReadingInsights';

export interface CommandHostPlugin extends Plugin {
  app: App;
  openLibrary(popout?: boolean): void | Promise<void>;
  openFile(file: TFile): void | Promise<void>;
  lastReadBookFile(): TFile | null;
  _openReaderModal?: {
    bookHtml?: unknown;
    togglePanel?(name: string): void;
    _togglePanel?(name: string): void;
    _findInput?: HTMLInputElement;
  } | null;
}

export function registerCommands(plugin: CommandHostPlugin) {
  plugin.addCommand({
    id: "open-library",
    name: __ertr("Open library"),
    callback: () => {
      void plugin.openLibrary();
    }
  });
  plugin.addCommand({
    id: "open-library-window",
    name: __ertr("Open library in a separate window"),
    callback: () => {
      void plugin.openLibrary(true);
    }
  });
  plugin.addCommand({
    id: "open-pdf-reader",
    name: __ertr("Open PDF in the reader"),
    checkCallback: (checking: boolean) => {
      const f = plugin.app.workspace.getActiveFile();
      if (f?.extension === "pdf") {
        if (!checking) {
          void plugin.openFile(f);
        }
        return true;
      }
      return false;
    }
  });
  plugin.addCommand({
    id: "search-in-book",
    name: __ertr("Search the book"),
    checkCallback: (checking: boolean) => {
      const view = plugin.app.workspace.getActiveViewOfType(ReaderView);
      const target = (view && view.bookHtml) ? view : (plugin._openReaderModal || null);
      if (!(target && target.bookHtml)) return false;
      if (!checking) {
        if (target.togglePanel) {
          target.togglePanel("find");
        } else if (target._togglePanel) {
          target._togglePanel("find");
        }
        if (target._findInput) erAutoFocus(target._findInput, 80);
      }
      return true;
    }
  });
  plugin.addCommand({
    id: "save-position",
    name: __ertr("Save reading position"),
    checkCallback: (checking: boolean) => {
      const view = plugin.app.workspace.getActiveViewOfType(ReaderView);
      if (!(view && view.bookHtml && view.file)) return false;
      if (!checking) view.saveNow();
      return true;
    }
  });
  plugin.addCommand({
    id: "export-highlights",
    name: __ertr("Export highlights to notes"),
    checkCallback: (checking: boolean) => {
      const view = plugin.app.workspace.getActiveViewOfType(ReaderView);
      if (!(view && view.file)) return false;
      if (!checking) view.exportHighlights();
      return true;
    }
  });
  plugin.addCommand({
    id: "show-onboarding",
    name: __ertr("Show welcome (onboarding)"),
    callback: () => {
      new OnboardingModal(plugin.app, plugin).open();
    }
  });
  plugin.addCommand({
    id: "continue-reading",
    name: __ertr("Continue reading (last book)"),
    checkCallback: (checking: boolean) => {
      const f = plugin.lastReadBookFile();
      if (!f) return false;
      if (!checking) {
        void plugin.openFile(f);
      }
      return true;
    }
  });
  plugin.addCommand({
    id: "open-book-picker",
    name: __ertr("Open a book…"),
    callback: () => {
      new BookQuickOpen(plugin.app, plugin).open();
    }
  });
  plugin.addCommand({
    id: "reading-insights",
    name: __ertr("Reading insights & heatmap"),
    callback: () => {
      new ReadingInsightsModal(plugin.app, plugin).open();
    }
  });
  plugin.addCommand({
    id: "toggle-bookmark",
    name: __ertr("Toggle bookmark on current page"),
    checkCallback: (checking: boolean) => {
      const view = plugin.app.workspace.getActiveViewOfType(ReaderView);
      if (!(view && view.file)) return false;
      if (!checking) {
        void (view as unknown).toggleBookmark();
      }
      return true;
    }
  });
  plugin.addCommand({
    id: "open-bookmarks",
    name: __ertr("Open bookmarks"),
    checkCallback: (checking: boolean) => {
      const view = plugin.app.workspace.getActiveViewOfType(ReaderView);
      if (!(view && view.file)) return false;
      if (!checking) {
        (view as unknown).openBookmarksModal();
      }
      return true;
    }
  });
}
