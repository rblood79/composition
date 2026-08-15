/**
 * CursorManager (ADR-100)
 *
 * Canvas element cursor를 관리한다.
 */

export class CursorManager {
  private canvasEl: HTMLCanvasElement | null = null;
  private currentCursor = "default";

  setCanvasElement(el: HTMLCanvasElement): void {
    this.canvasEl = el;
  }

  /**
   * Update cursor based on what's under the pointer.
   * @param cursor CSS cursor value ('default', 'pointer', 'grab', 'nw-resize', etc.)
   */
  setCursor(cursor: string): void {
    if (cursor === this.currentCursor) return;
    this.currentCursor = cursor;
    if (this.canvasEl) {
      this.canvasEl.style.cursor = cursor;
    }
  }

  /**
   * Resolve cursor from handle hit or element.
   */
  updateFromHit(handleId: string | null, elementCursor: string | null): void {
    if (handleId) {
      // Resize handle cursors
      const handleCursors: Record<string, string> = {
        nw: "nwse-resize",
        ne: "nesw-resize",
        sw: "nesw-resize",
        se: "nwse-resize",
        n: "ns-resize",
        s: "ns-resize",
        w: "ew-resize",
        e: "ew-resize",
      };
      this.setCursor(handleCursors[handleId] ?? "default");
    } else if (elementCursor) {
      this.setCursor(elementCursor);
    } else {
      this.setCursor("default");
    }
  }
}
