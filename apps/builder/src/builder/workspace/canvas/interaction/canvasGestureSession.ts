export type CanvasGestureMode = "element" | "idle" | "page" | "pan";

export interface PageGestureOwner {
  /** 드래그 리더 페이지 (포인터가 잡은 페이지 — 스냅/타겟 판정 기준) */
  pageId: string;
  /**
   * ADR-178: 이 gesture 가 함께 움직이는 페이지 집합 (리더 포함).
   * pointer 당 owner 1 계약(ADR-176 HC2)은 유지 — owner 가 집합을 보유한다.
   */
  pageIds: readonly string[];
  startBreakpoint: string;
}

/** 리더가 항상 집합의 첫 요소가 되도록 정규화 (중복 제거 포함). */
function normalizePageIds(
  leaderPageId: string,
  pageIds: readonly string[],
): readonly string[] {
  const rest = pageIds.filter((id) => id !== leaderPageId);
  return rest.length > 0 ? [leaderPageId, ...new Set(rest)] : [leaderPageId];
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
    pageIds: readonly string[] = [pageId],
  ): boolean {
    if (this.activePointerId !== null) {
      return false;
    }

    this.activePointerId = pointerId;
    this.mode = "page";
    this.pageOwner = {
      pageId,
      pageIds: normalizePageIds(pageId, pageIds),
      startBreakpoint,
    };
    this.notify();
    return true;
  }

  /**
   * 이미 element로 시작한 pointer를 page drag owner로 승격한다.
   *
   * 페이지 body를 선택한 뒤 빈 page 영역에서 drag를 시작할 때 사용한다.
   * pointerdown capture 단계가 generic element owner를 먼저 만들기 때문에,
   * 소유권을 release/reclaim하지 않고 같은 pointer session 안에서 원자적으로
   * page owner로 전환한다.
   */
  promoteElementToPage(
    pointerId: number,
    pageId: string,
    startBreakpoint: string,
    pageIds: readonly string[] = [pageId],
  ): boolean {
    if (this.activePointerId !== pointerId || this.mode !== "element") {
      return false;
    }

    this.mode = "page";
    this.pageOwner = {
      pageId,
      pageIds: normalizePageIds(pageId, pageIds),
      startBreakpoint,
    };
    this.notify();
    return true;
  }

  ownerFor(pointerId: number): CanvasGestureMode {
    return this.activePointerId === pointerId ? this.mode : "idle";
  }

  pageOwnerFor(pointerId: number): PageGestureOwner | null {
    if (!this.pageOwner || this.activePointerId !== pointerId) {
      return null;
    }

    return { ...this.pageOwner };
  }

  isOwnedByAnotherPointer(pointerId: number): boolean {
    return this.activePointerId !== null && this.activePointerId !== pointerId;
  }

  /**
   * 이 pointerdown이 새 제스처를 시작할 수 없는지 판정한다.
   *
   * 이미 다른 pointer가 소유 중이거나, 이 pointer가 자기 lifecycle을 따로 가진
   * mode(page)로 claim된 경우다. 어떤 mode가 여기 해당하는지는 session만 안다 —
   * 호출부가 `ownerFor(id) === "page"` 로 재판정하면 mode 추가 시 누락된다.
   */
  blocksPointerDown(pointerId: number): boolean {
    return (
      this.isOwnedByAnotherPointer(pointerId) ||
      (this.activePointerId === pointerId && this.mode === "page")
    );
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
