/**
 * HoverManager (ADR-100)
 *
 * DOM pointermove 기반 hover 상태 관리.
 * WASM SpatialIndex hitTest로 호버된 요소 감지.
 */

import { hitTestPoint } from "../wasm-bindings/spatialIndex";

export type PreviewState = "hover" | "pressed" | null;
export type SetPreviewStateFn = (
  state: { elementId: string; state: "hover" | "pressed" } | null,
) => void;

export class HoverManager {
  private currentHoverId: string | null = null;
  private setPreviewState: SetPreviewStateFn;

  constructor(setPreviewState: SetPreviewStateFn) {
    this.setPreviewState = setPreviewState;
  }

  /**
   * Called on every pointermove. Resolves hover target via WASM hit test.
   * @param canvasX scene-local X coordinate
   * @param canvasY scene-local Y coordinate
   */
  onPointerMove(canvasX: number, canvasY: number): void {
    const hitIds = hitTestPoint(canvasX, canvasY);
    const topId = hitIds.length > 0 ? hitIds[0] : null;

    if (topId === this.currentHoverId) return;

    // Leave old
    if (this.currentHoverId) {
      this.setPreviewState(null);
    }

    // Enter new
    if (topId) {
      this.setPreviewState({ elementId: topId, state: "hover" });
    }

    this.currentHoverId = topId;
  }

  /**
   * Called on pointerdown.
   */
  onPointerDown(canvasX: number, canvasY: number): void {
    const hitIds = hitTestPoint(canvasX, canvasY);
    const topId = hitIds.length > 0 ? hitIds[0] : null;

    if (topId) {
      this.setPreviewState({ elementId: topId, state: "pressed" });
    }
  }

  /**
   * Called on pointerup.
   */
  onPointerUp(): void {
    if (this.currentHoverId) {
      this.setPreviewState({ elementId: this.currentHoverId, state: "hover" });
    }
  }

  /**
   * Called when pointer leaves the canvas entirely.
   */
  onPointerLeave(): void {
    if (this.currentHoverId) {
      this.setPreviewState(null);
      this.currentHoverId = null;
    }
  }

  getCurrentHoverId(): string | null {
    return this.currentHoverId;
  }
}
