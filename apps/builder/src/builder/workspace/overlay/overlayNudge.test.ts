import { describe, expect, it } from "vitest";
import { MAX_OVERLAY_NUDGE, resolveOverlayNudge } from "./overlayNudge";
import {
  getTextDrawOrigin,
  recordTextDrawOrigin,
} from "../canvas/skia/nodeRendererState";

/**
 * ADR-027 Phase D2 — 편집기 첫 줄 상자를 Skia 가 paragraph 를 그린 자리로 옮긴다.
 * Skia 는 단일행 center 를 글리프 ink 상자로 잡고 (nodeRendererText computeDrawY)
 * DOM 은 line box 를 가운데 두므로 1~2px 가 갈린다 — 값은 마지막 Skia 프레임이 기록한
 * element-local 원점과 DOM 측정치의 차다.
 */
describe("resolveOverlayNudge", () => {
  it("Skia 원점 − DOM 첫 줄 원점 = 편집기 root 의 relative 오프셋", () => {
    expect(
      resolveOverlayNudge(
        { x: 18.5, y: 6.2 },
        { textLeft: 18.46, lineTop: 5.06 },
      ),
    ).toEqual({ dx: 0.04, dy: 1.14 });
  });

  it("Skia 기록이 없으면 보정 없음 (종전 배치 유지)", () => {
    expect(resolveOverlayNudge(null, { textLeft: 0, lineTop: 0 })).toBeNull();
  });

  it("빈 텍스트는 x 축을 잴 수 없어 dx 0", () => {
    expect(
      resolveOverlayNudge({ x: 12, y: 3 }, { textLeft: null, lineTop: 3 }),
    ).toEqual({ dx: 0, dy: 0 });
  });

  it("center 정렬은 글리프끼리 — Skia 상자 42 · DOM 상자 44 라도 첫 글리프 left 가 같으면 dx 0", () => {
    // live 2026-09-20 Save 라벨: 상자 left 로 재면 dx 1 이 나와 중심이 1px 밀렸다
    expect(
      resolveOverlayNudge({ x: 18.5, y: 5 }, { textLeft: 18.46, lineTop: 5 }),
    ).toEqual({ dx: 0.04, dy: 0 });
  });

  it("한도를 넘는 축은 기록이 다른 상태의 것이라 보고 0 으로 둔다", () => {
    const wild = MAX_OVERLAY_NUDGE + 1;
    expect(
      resolveOverlayNudge({ x: wild, y: -wild }, { textLeft: 0, lineTop: 0 }),
    ).toEqual({ dx: 0, dy: 0 });
  });
});

describe("text draw origin registry (Skia → overlay)", () => {
  it("마지막 기록을 element 별로 읽고, 같은 객체를 제자리 갱신한다", () => {
    recordTextDrawOrigin("el-1", 4, 5);
    const first = getTextDrawOrigin("el-1");
    expect(first).toEqual({ x: 4, y: 5 });
    recordTextDrawOrigin("el-1", 6, 7);
    expect(getTextDrawOrigin("el-1")).toBe(first);
    expect(first).toEqual({ x: 6, y: 7 });
    expect(getTextDrawOrigin("el-none")).toBeNull();
  });

  it("빈 elementId (record 프레임의 스택 base) 는 기록하지 않는다", () => {
    recordTextDrawOrigin("", 1, 1);
    expect(getTextDrawOrigin("")).toBeNull();
  });
});
