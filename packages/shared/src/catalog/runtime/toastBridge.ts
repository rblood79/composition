import type { CatalogToastOptions } from "../../interactions/interactionRule.types";

/** The session's toasts (a rule's `toast` Do · a reported failure) to the document's toast region. */
export class CatalogPreviewToastBridge {
  private handler:
    ((message: string, options?: CatalogToastOptions) => void) | undefined;

  show(message: string, options?: CatalogToastOptions): void {
    if (options) this.handler?.(message, options);
    else this.handler?.(message);
  }

  connect(
    handler: (message: string, options?: CatalogToastOptions) => void,
  ): () => void {
    this.handler = handler;
    return () => {
      if (this.handler === handler) this.handler = undefined;
    };
  }
}
