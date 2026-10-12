import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  type VirtualItem,
} from "@tanstack/react-virtual";
import { useLayoutEffect, useState, useSyncExternalStore } from "react";

interface VirtualRowsSnapshot {
  readonly items: readonly VirtualItem[];
  readonly totalSize: number;
}

class TableVirtualRows {
  private snapshot: VirtualRowsSnapshot = { items: [], totalSize: 0 };
  private listeners = new Set<() => void>();
  readonly virtualizer = new Virtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: 0,
    getScrollElement: () => null,
    estimateSize: () => 0,
    scrollToFn: elementScroll,
    observeElementRect,
    observeElementOffset,
    onChange: () => this.publish(),
  });

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  readonly getSnapshot = (): VirtualRowsSnapshot => this.snapshot;

  publish(): void {
    const items = this.virtualizer.getVirtualItems();
    const totalSize = this.virtualizer.getTotalSize();
    if (
      totalSize === this.snapshot.totalSize &&
      items.length === this.snapshot.items.length &&
      items.every((item, index) => {
        const previous = this.snapshot.items[index];
        return (
          item.key === previous.key &&
          item.start === previous.start &&
          item.size === previous.size
        );
      })
    )
      return;
    this.snapshot = { items: items.map((item) => ({ ...item })), totalSize };
    for (const listener of this.listeners) listener();
  }
}

export function useTableVirtualRows(
  scrollElement: HTMLDivElement | null,
  count: number,
  rowHeight: number,
  overscan: number,
) {
  const [source] = useState(() => new TableVirtualRows());
  const snapshot = useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    source.getSnapshot,
  );
  useLayoutEffect(() => source.virtualizer._didMount(), [source]);
  useLayoutEffect(() => {
    source.virtualizer.setOptions({
      ...source.virtualizer.options,
      count,
      getScrollElement: () => scrollElement,
      estimateSize: () => rowHeight,
      overscan: Math.max(overscan, 5),
      measureElement:
        typeof navigator !== "undefined" &&
        !navigator.userAgent.includes("Firefox")
          ? (element) => element.getBoundingClientRect().height
          : undefined,
    });
    source.virtualizer._willUpdate();
    source.publish();
  }, [source, scrollElement, count, rowHeight, overscan]);
  return { ...snapshot, measureElement: source.virtualizer.measureElement };
}
