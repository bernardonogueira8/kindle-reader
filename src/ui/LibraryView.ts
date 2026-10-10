import { ItemView, WorkspaceLeaf } from 'obsidian';
import { LibraryModal } from './LibraryModal';
import { __ertr } from '../utils/i18n';

export const LIB_VIEW_TYPE = "elton-library";

export class LibraryView extends ItemView {
  plugin: unknown;
  modalEl!: HTMLElement;
  _grid: HTMLElement | null = null;
  _dropBound = false;
  _coverResizeObs: ResizeObserver | null = null;
  _thumbQueue: Promise<unknown> | null = null;
  _thumbDirty = false;
  _thumbSaveT: number | undefined = undefined;

  constructor(leaf: WorkspaceLeaf, plugin: unknown) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return LIB_VIEW_TYPE;
  }

  getDisplayText(): string {
    return __ertr("Library");
  }

  getIcon(): string {
    return "library";
  }

  async onOpen(): Promise<void> {
    this.modalEl = this.containerEl;
    this.containerEl.addClass("er-modal-lib", "er-lib-as-view");
    await LibraryModal.prototype.onOpen.call(this);
  }

  close(): void {
    /* a tab stays put */
  }

  onClose(): Promise<void> {
    if (this._coverResizeObs) {
      try {
        this._coverResizeObs.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.contentEl.empty();
    return Promise.resolve();
  }
}

// Everything the library draws lives on LibraryModal's prototype. Borrow it
// wholesale rather than duplicating 500 lines that would then drift apart.
for (const name of Object.getOwnPropertyNames(LibraryModal.prototype)) {
  if (["constructor", "onOpen", "onClose", "close"].includes(name)) continue;
  Object.defineProperty(
    LibraryView.prototype,
    name,
    Object.getOwnPropertyDescriptor(LibraryModal.prototype, name)!
  );
}

export interface LibraryView extends Pick<LibraryModal,
  '_pickBooks' | '_setupDropZone' | '_targetDir' | '_freeBookPath' |
  '_importBooks' | '_refresh' | '_sizeCovers' | 'renderCard' |
  'loadThumb' | 'coverFromBookNote' | 'showImg' | 'makePdfThumb' |
  'makeFb2Thumb' | 'makeEpubThumb'
> {}

