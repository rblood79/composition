import type { PageHeaderFrame } from "../overlay/pageHeader/pageHeaderGeometry";
import type { BoundingBox } from "../selection/types";

/** Scene-produced values; React subscribes to frames and events query current bounds. */
export class CatalogCanvasViewState {
  private frames: PageHeaderFrame[] = [];
  private listeners = new Set<() => void>();
  private readBounds: (identity: string) => BoundingBox | undefined = () =>
    undefined;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  readonly getFrames = (): PageHeaderFrame[] => this.frames;

  publishFrames(frames: PageHeaderFrame[]): void {
    if (this.frames === frames) return;
    this.frames = frames;
    for (const listener of this.listeners) listener();
  }

  connectBounds(
    read: (identity: string) => BoundingBox | undefined,
  ): () => void {
    this.readBounds = read;
    return () => {
      if (this.readBounds === read) this.readBounds = () => undefined;
    };
  }

  boundsOf(identity: string): BoundingBox | undefined {
    return this.readBounds(identity);
  }
}
