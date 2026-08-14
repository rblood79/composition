/**
 * 가이드 드래그 transient — ADR-181 Phase 5.
 *
 * 확인 대상은 `mergeGuideDrag` 의 합성 규칙이다. 드래그 중 화면에 보이는
 * 것이 여기서만 나오므로, "원래 자리에서 빼고 새 자리에 넣는" 두 동작이
 * 한 번에 맞아야 한다 — 하나만 되면 잔상이 남거나 미리보기가 사라진다.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { PageGuideLine } from "@composition/shared";

import {
  beginGuideDrag,
  endGuideDrag,
  getGuideDrag,
  mergeGuideDrag,
  publishGuideDrag,
  resetGuideDragForTest,
  resolveGuideDragPreview,
  type GuideDragState,
} from "./guidePresentation";
import {
  getPageGuideRevision,
  resetPageGuideRevisionForTest,
} from "./pageGuideRevision";

const g = (id: string, axis: "x" | "y", position: number): PageGuideLine => ({
  id,
  axis,
  position,
});

const CANONICAL = new Map<string, readonly PageGuideLine[]>([
  ["page-1", [g("a", "x", 100), g("b", "y", 40)]],
  ["page-2", [g("c", "x", 20)]],
]);

const MOVE: GuideDragState = {
  kind: "move",
  guideId: "a",
  axis: "x",
  pageId: "page-1",
  position: 260,
  removing: false,
  originPageId: "page-1",
  originPosition: 100,
  scenePosition: 460,
};

beforeEach(() => {
  resetGuideDragForTest();
  resetPageGuideRevisionForTest();
});

describe("mergeGuideDrag", () => {
  it("드래그가 없으면 입력을 그대로 돌려준다 (통상 경로 할당 0)", () => {
    expect(mergeGuideDrag(CANONICAL, null)).toBe(CANONICAL);
  });

  it("이동 — 원래 자리에서 빼고 새 위치로 넣는다 (중복 없음)", () => {
    const merged = mergeGuideDrag(CANONICAL, MOVE);
    expect(merged.get("page-1")).toEqual([g("b", "y", 40), g("a", "x", 260)]);
    expect(merged.get("page-2")).toEqual([g("c", "x", 20)]);
  });

  it("되돌리는 중이면 목록에서 사라진다 (놓으면 삭제)", () => {
    const merged = mergeGuideDrag(CANONICAL, { ...MOVE, removing: true });
    expect(merged.get("page-1")).toEqual([g("b", "y", 40)]);
  });

  it("마지막 하나를 되돌리면 페이지 키까지 사라진다", () => {
    const merged = mergeGuideDrag(CANONICAL, {
      kind: "move",
      guideId: "c",
      axis: "x",
      pageId: "page-2",
      position: 20,
      removing: true,
      originPageId: "page-2",
      originPosition: 20,
      scenePosition: 220,
    });
    expect(merged.has("page-2")).toBe(false);
  });

  it("생성 — 아직 페이지 위가 아니면 아무것도 그리지 않는다", () => {
    const create: GuideDragState = {
      kind: "create",
      guideId: "new",
      axis: "y",
      pageId: null,
      position: 0,
      removing: false,
      originPageId: null,
      originPosition: 0,
      scenePosition: 12,
    };
    expect(mergeGuideDrag(CANONICAL, create).get("page-1")).toEqual(
      CANONICAL.get("page-1"),
    );
  });

  it("생성 — 페이지 위면 그 페이지 목록 끝에 미리보기가 붙는다", () => {
    const merged = mergeGuideDrag(CANONICAL, {
      kind: "create",
      guideId: "new",
      axis: "y",
      pageId: "page-2",
      position: 300,
      removing: false,
      originPageId: null,
      originPosition: 0,
      scenePosition: 700,
    });
    expect(merged.get("page-2")).toEqual([g("c", "x", 20), g("new", "y", 300)]);
  });

  it("가이드가 없던 페이지에도 미리보기가 생긴다", () => {
    const merged = mergeGuideDrag(CANONICAL, {
      kind: "create",
      guideId: "new",
      axis: "x",
      pageId: "page-3",
      position: 10,
      removing: false,
      originPageId: null,
      originPosition: 0,
      scenePosition: 810,
    });
    expect(merged.get("page-3")).toEqual([g("new", "x", 10)]);
  });

  it("입력 map 을 변형하지 않는다", () => {
    mergeGuideDrag(CANONICAL, MOVE);
    expect(CANONICAL.get("page-1")).toEqual([
      g("a", "x", 100),
      g("b", "y", 40),
    ]);
  });
});

describe("begin/publish/end — 값이 바뀐 때만 재렌더 신호", () => {
  it("begin 은 상태를 복사해 들고 개정을 올린다", () => {
    beginGuideDrag(MOVE);
    expect(getGuideDrag()).toEqual(MOVE);
    expect(getGuideDrag()).not.toBe(MOVE);
    expect(getPageGuideRevision()).toBe(1);
  });

  it("같은 값 publish 는 no-op (프레임마다 불려도 무효화 안 함)", () => {
    beginGuideDrag(MOVE);
    publishGuideDrag({ position: 260 });
    expect(getPageGuideRevision()).toBe(1);
    publishGuideDrag({ position: 261 });
    expect(getPageGuideRevision()).toBe(2);
  });

  it("드래그 중이 아니면 publish 는 아무 일도 하지 않는다", () => {
    publishGuideDrag({ position: 999 });
    expect(getGuideDrag()).toBeNull();
    expect(getPageGuideRevision()).toBe(0);
  });

  it("end 는 1회만 신호를 낸다", () => {
    beginGuideDrag(MOVE);
    endGuideDrag();
    expect(getGuideDrag()).toBeNull();
    expect(getPageGuideRevision()).toBe(2);
    endGuideDrag();
    expect(getPageGuideRevision()).toBe(2);
  });
});

describe("resolveGuideDragPreview — 소속 미정 구간의 미리보기", () => {
  const CREATE_OVER_RULER: GuideDragState = {
    kind: "create",
    guideId: "new",
    axis: "x",
    pageId: null,
    position: 0,
    removing: false,
    originPageId: null,
    originPosition: 0,
    scenePosition: 640,
  };

  it("소속이 없으면 커서 축 좌표로 미리보기를 낸다", () => {
    expect(resolveGuideDragPreview(CREATE_OVER_RULER)).toEqual({
      axis: "x",
      scenePosition: 640,
    });
  });

  it("가로 가이드도 같은 어법 (axis 를 그대로 전달)", () => {
    expect(
      resolveGuideDragPreview({
        ...CREATE_OVER_RULER,
        axis: "y",
        scenePosition: 305,
      }),
    ).toEqual({ axis: "y", scenePosition: 305 });
  });

  it("소속이 정해지면 null — mergeGuideDrag 와 배타 (이중 렌더 금지)", () => {
    expect(
      resolveGuideDragPreview({ ...CREATE_OVER_RULER, pageId: "page-2" }),
    ).toBeNull();
    // 이동 드래그는 항상 소속이 있으므로 미리보기 경로를 타지 않는다
    expect(resolveGuideDragPreview(MOVE)).toBeNull();
  });

  it("되돌리는 중이면 null — 사라지는 것이 '놓으면 삭제' 피드백", () => {
    expect(
      resolveGuideDragPreview({
        ...MOVE,
        pageId: null,
        removing: true,
      }),
    ).toBeNull();
  });

  it("좌표가 아직 없거나 드래그가 없으면 null", () => {
    expect(
      resolveGuideDragPreview({ ...CREATE_OVER_RULER, scenePosition: null }),
    ).toBeNull();
    expect(resolveGuideDragPreview(null)).toBeNull();
  });

  it("scenePosition 0 을 '없음' 으로 읽지 않는다", () => {
    expect(
      resolveGuideDragPreview({ ...CREATE_OVER_RULER, scenePosition: 0 }),
    ).toEqual({ axis: "x", scenePosition: 0 });
  });
});

describe("publish — 눈금자 위 이동도 재렌더 신호여야 한다", () => {
  it("scenePosition 만 바뀌어도 개정이 오른다", () => {
    // 눈금자 위를 좌우로 끄는 구간: pageId/position/removing 은 전부 그대로라
    // scenePosition 비교가 없으면 미리보기가 커서를 따라오지 않는다
    beginGuideDrag({
      kind: "create",
      guideId: "new",
      axis: "x",
      pageId: null,
      position: 0,
      removing: false,
      originPageId: null,
      originPosition: 0,
      scenePosition: 100,
    });
    expect(getPageGuideRevision()).toBe(1);

    publishGuideDrag({ pageId: null, removing: false, scenePosition: 140 });
    expect(getPageGuideRevision()).toBe(2);
    expect(getGuideDrag()?.scenePosition).toBe(140);

    publishGuideDrag({ pageId: null, removing: false, scenePosition: 140 });
    expect(getPageGuideRevision()).toBe(2);
  });
});
