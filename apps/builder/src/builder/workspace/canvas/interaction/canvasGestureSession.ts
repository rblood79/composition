export type CanvasGestureMode = "element" | "idle" | "page" | "pan";

export interface PageGestureOwner {
  pageId: string;
  pointerId: number;
  startBreakpoint: string;
}

export function resolveCanvasGestureMode({
  button,
  isSpacePressed,
}: {
  button: number;
  isSpacePressed: boolean;
}): CanvasGestureMode {
  if (button === 1 || (button === 0 && isSpacePressed)) {
    return "pan";
  }

  return "element";
}

/**
 * Canvas pointer session의 제스처 소유권을 유지한다.
 *
 * Space를 누른 primary pointer는 pointerup까지 pan이 독점한다. 따라서 Space를
 * 먼저 놓아도 동일 pointer session에서 요소 drag/drop으로 전환되지 않는다.
 */
export class CanvasGestureSession {
  private activePointerId: number | null = null;
  private mode: CanvasGestureMode = "idle";
  private isSpacePressed = false;
  private pageOwner: PageGestureOwner | null = null;
  private readonly listeners = new Set<() => void>();

  setSpacePressed(isPressed: boolean): void {
    if (this.isSpacePressed === isPressed) {
      return;
    }

    this.isSpacePressed = isPressed;
    this.notify();
  }

  get spacePressed(): boolean {
    return this.isSpacePressed;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  beginPointer(pointerId: number, button: number): CanvasGestureMode {
    if (this.activePointerId === pointerId) {
      return this.mode;
    }

    if (this.activePointerId !== null) {
      return "idle";
    }

    this.activePointerId = pointerId;
    this.pageOwner = null;
    this.mode = resolveCanvasGestureMode({
      button,
      isSpacePressed: this.isSpacePressed,
    });
    this.notify();
    return this.mode;
  }

  tryClaimPage(
    pointerId: number,
    pageId: string,
    startBreakpoint: string,
  ): boolean {
    if (this.activePointerId !== null) {
      return false;
    }

    this.activePointerId = pointerId;
    this.mode = "page";
    this.pageOwner = {
      pageId,
      pointerId,
      startBreakpoint,
    };
    this.notify();
    return true;
  }

  ownerFor(pointerId: number): CanvasGestureMode {
    return this.activePointerId === pointerId ? this.mode : "idle";
  }

  pageOwnerFor(pointerId: number): PageGestureOwner | null {
    if (this.pageOwner?.pointerId !== pointerId) {
      return null;
    }

    return { ...this.pageOwner };
  }

  isOwnedByAnotherPointer(pointerId: number): boolean {
    return this.activePointerId !== null && this.activePointerId !== pointerId;
  }

  endPage(pointerId: number): void {
    if (this.mode !== "page" || this.activePointerId !== pointerId) {
      return;
    }

    this.releasePointer();
  }

  endPointer(pointerId: number): void {
    if (this.mode === "page" || this.activePointerId !== pointerId) {
      return;
    }

    this.releasePointer();
  }

  shouldSuppressElementInteraction(pointerId: number): boolean {
    return (
      this.isOwnedByAnotherPointer(pointerId) ||
      (this.activePointerId === pointerId &&
        (this.mode === "page" || this.mode === "pan"))
    );
  }

  /**
   * Hand/Pan mode가 armed된 동안 hover hit-test를 막는다.
   *
   * 실제 pointer가 아직 없어도 Space keydown부터 hover를 비우고, Space를 먼저
   * 놓은 pan pointer는 pointerup까지 계속 차단한다.
   */
  shouldSuppressElementHover(): boolean {
    return this.isSpacePressed || this.mode === "page" || this.mode === "pan";
  }

  private releasePointer(): void {
    this.activePointerId = null;
    this.mode = "idle";
    this.pageOwner = null;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
