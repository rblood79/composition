export class CatalogPreviewToastBridge {
  private handler: ((message: string) => void) | undefined;

  show(message: string): void {
    this.handler?.(message);
  }

  connect(handler: (message: string) => void): () => void {
    this.handler = handler;
    return () => {
      if (this.handler === handler) this.handler = undefined;
    };
  }
}
