import { describe, expect, it, vi } from "vitest";
import {
  CanvasGestureSession,
  resolveCanvasGestureMode,
} from "./canvasGestureSession";

describe("resolveCanvasGestureMode", () => {
  it("Space를 누른 primary pointer는 요소 조작 대신 pan을 선택한다", () => {
    expect(resolveCanvasGestureMode({ button: 0, isSpacePressed: true })).toBe(
      "pan",
    );
  });

  it("Space 없이 시작한 primary pointer는 요소 조작을 유지한다", () => {
    expect(resolveCanvasGestureMode({ button: 0, isSpacePressed: false })).toBe(
      "element",
    );
  });
});

describe("CanvasGestureSession", () => {
  it("Space만 누른 시점부터 hover를 즉시 차단하고 상태 변화를 알린다", () => {
    const session = new CanvasGestureSession();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    expect(session.shouldSuppressElementHover()).toBe(false);

    session.setSpacePressed(true);

    expect(session.shouldSuppressElementHover()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    session.setSpacePressed(false);

    expect(session.shouldSuppressElementHover()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("pan으로 시작한 pointer session 동안 요소 상호작용을 차단한다", () => {
    const session = new CanvasGestureSession();
    session.setSpacePressed(true);

    expect(session.beginPointer(7, 0)).toBe("pan");
    expect(session.shouldSuppressElementInteraction(7)).toBe(true);

    session.setSpacePressed(false);
    expect(session.shouldSuppressElementInteraction(7)).toBe(true);
    expect(session.shouldSuppressElementHover()).toBe(true);

    session.endPointer(7);
    expect(session.shouldSuppressElementInteraction(7)).toBe(false);
    expect(session.shouldSuppressElementHover()).toBe(false);
  });

  it("page title hit-test는 generic owner보다 먼저 page owner를 claim한다", () => {
    const session = new CanvasGestureSession();

    expect(session.tryClaimPage(11, "page-1", "desktop")).toBe(true);
    expect(session.ownerFor(11)).toBe("page");
    expect(session.pageOwnerFor(11)).toEqual({
      pageId: "page-1",
      pageIds: ["page-1"],
      startBreakpoint: "desktop",
    });
    expect(session.pageOwnerFor(12)).toBeNull();
    expect(session.blocksPointerDown(11)).toBe(true);
    expect(session.blocksPointerDown(12)).toBe(true);
    expect(session.beginPointer(11, 0)).toBe("page");
    expect(session.shouldSuppressElementInteraction(11)).toBe(true);
    // page claim 은 pointerdown 시점이라 hover 억제 대상이 아니다 — 누르고만 있어도
    // hover 외곽선이 꺼지면 요소(2px 유지)와 어긋난다. 실제 이동 중 억제는 hover
    // 판정부의 page-position presentation 가드가 맡는다 (2026-09-17).
    expect(session.shouldSuppressElementHover()).toBe(false);
  });

  it("hover 억제는 pan/Space 만 — page press 는 hover 를 끄지 않는다 (회귀)", () => {
    const session = new CanvasGestureSession();
    expect(session.shouldSuppressElementHover()).toBe(false);

    // page 를 잡아도 (= 누르고만 있어도) hover 는 살아 있어야 한다. 종전에는
    // mode "page" 가 억제 대상이라, 페이지만 press 중 2px → 1px 로 떨어졌다.
    session.tryClaimPage(11, "page-1", "desktop");
    session.beginPointer(11, 0);
    expect(session.shouldSuppressElementHover()).toBe(false);

    // pan 은 종전대로 억제
    const pan = new CanvasGestureSession();
    pan.setSpacePressed(true);
    expect(pan.shouldSuppressElementHover()).toBe(true);
  });

  it("선택된 page body의 빈 영역 gesture는 같은 pointer를 page owner로 승격한다", () => {
    const session = new CanvasGestureSession();

    expect(session.beginPointer(11, 0)).toBe("element");
    expect(session.promoteElementToPage(11, "page-1", "desktop")).toBe(true);
    expect(session.ownerFor(11)).toBe("page");
    expect(session.pageOwnerFor(11)).toEqual({
      pageId: "page-1",
      pageIds: ["page-1"],
      startBreakpoint: "desktop",
    });
    expect(session.shouldSuppressElementInteraction(11)).toBe(true);
  });

  it("ADR-222: element 로 시작한 pointer 를 spacing owner 로 승격하고 요소 상호작용·hover 를 막는다", () => {
    const session = new CanvasGestureSession();

    expect(session.beginPointer(21, 0)).toBe("element");
    expect(session.promoteElement(21, "spacing")).toBe(true);
    expect(session.ownerFor(21)).toBe("spacing");
    expect(session.shouldSuppressElementInteraction(21)).toBe(true);
    expect(session.shouldSuppressElementHover()).toBe(true);
    // 다른 pointer 의 새 제스처는 차단, 같은 pointer 의 endPointer 가 해제한다
    expect(session.blocksPointerDown(22)).toBe(true);
    session.endPointer(21);
    expect(session.ownerFor(21)).toBe("idle");
    expect(session.shouldSuppressElementHover()).toBe(false);
  });

  it("ADR-222: pan 이거나 다른 pointer 면 spacing 으로 승격하지 않는다", () => {
    const session = new CanvasGestureSession();
    session.setSpacePressed(true);
    expect(session.beginPointer(21, 0)).toBe("pan");
    expect(session.promoteElement(21, "spacing")).toBe(false);
    expect(session.promoteElement(22, "spacing")).toBe(false);
    expect(session.ownerFor(21)).toBe("pan");
  });

  it("pan 또는 다른 pointer owner는 page owner로 승격하지 않는다", () => {
    const session = new CanvasGestureSession();
    session.setSpacePressed(true);

    expect(session.beginPointer(11, 0)).toBe("pan");
    expect(session.promoteElementToPage(11, "page-1", "desktop")).toBe(false);
    expect(session.promoteElementToPage(12, "page-1", "desktop")).toBe(false);
    expect(session.ownerFor(11)).toBe("pan");
  });

  it("active page owner가 있으면 다른 pointer와 generic owner가 경쟁하지 않는다", () => {
    const session = new CanvasGestureSession();

    expect(session.tryClaimPage(11, "page-1", "desktop")).toBe(true);
    expect(session.tryClaimPage(12, "page-2", "mobile")).toBe(false);
    expect(session.beginPointer(12, 0)).toBe("idle");
    expect(session.isOwnedByAnotherPointer(12)).toBe(true);
    expect(session.ownerFor(12)).toBe("idle");
    expect(session.ownerFor(11)).toBe("page");

    session.endPointer(11);
    expect(session.ownerFor(11)).toBe("page");
    session.endPage(11);
    expect(session.ownerFor(11)).toBe("idle");
  });

  it("page owner는 pointercancel 경로에서 page controller만 release할 수 있다", () => {
    const session = new CanvasGestureSession();

    session.tryClaimPage(11, "page-1", "desktop");
    session.endPointer(11);
    expect(session.ownerFor(11)).toBe("page");

    session.endPage(11);
    expect(session.ownerFor(11)).toBe("idle");
    expect(session.shouldSuppressElementHover()).toBe(false);
  });
});
