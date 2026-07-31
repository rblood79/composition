export type CanvasGestureMode = "element" | "idle" | "pan";

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

    this.activePointerId = pointerId;
    this.mode = resolveCanvasGestureMode({
      button,
      isSpacePressed: this.isSpacePressed,
    });
    this.notify();
    return this.mode;
  }

  endPointer(pointerId: number): void {
    if (this.activePointerId !== pointerId) {
      return;
    }

    this.activePointerId = null;
    this.mode = "idle";
    this.notify();
  }

  reset(): void {
    const didChange =
      this.activePointerId !== null ||
      this.mode !== "idle" ||
      this.isSpacePressed;
    this.activePointerId = null;
    this.mode = "idle";
    this.isSpacePressed = false;
    if (didChange) {
      this.notify();
    }
  }

  shouldSuppressElementInteraction(pointerId: number): boolean {
    return this.activePointerId === pointerId && this.mode === "pan";
  }

  /**
   * Hand/Pan mode가 armed된 동안 hover hit-test를 막는다.
   *
   * 실제 pointer가 아직 없어도 Space keydown부터 hover를 비우고, Space를 먼저
   * 놓은 pan pointer는 pointerup까지 계속 차단한다.
   */
  shouldSuppressElementHover(): boolean {
    return this.isSpacePressed || this.mode === "pan";
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
