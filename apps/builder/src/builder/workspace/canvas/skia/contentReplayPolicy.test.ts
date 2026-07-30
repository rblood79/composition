import { describe, expect, it } from "vitest";
import {
  contentPictureCovers,
  isCameraDrivenRasterReason,
  resolveContentPaintPath,
} from "./contentReplayPolicy";

/**
 * ADR-173 Phase 5 — content Picture replay 판정.
 *
 * 카메라 유발 재래스터(스트림 불변)만 replay/record-replay 대상이고, 콘텐츠
 * 변경(invalidate/registry/animation)은 항상 walk 다 — walk 가 Picture 를
 * 폐기하므로 이 분류가 틀리면 stale 콘텐츠가 화면에 남는다.
 */

function rect(x: number, y: number, w: number, h: number): DOMRect {
  return new DOMRect(x, y, w, h);
}

const RECORDED = { bounds: rect(-100, -100, 2200, 1400), registryVersion: 7 };

describe("ADR-173 Phase 5 — content Picture replay 판정", () => {
  it("콘텐츠 변경 사유는 전부 walk (Picture 가 있어도)", () => {
    for (const reason of ["invalidate", "registry", "animation", "unknown"]) {
      expect(
        resolveContentPaintPath(reason, RECORDED, 7, rect(0, 0, 100, 100)),
      ).toBe("walk");
    }
    expect(
      resolveContentPaintPath(null, RECORDED, 7, rect(0, 0, 100, 100)),
    ).toBe("walk");
  });

  it("카메라 유발 사유 + Picture 부재 → record-replay (첫 회 lazy 기록)", () => {
    expect(
      resolveContentPaintPath("zoom-refresh", null, 7, rect(0, 0, 100, 100)),
    ).toBe("record-replay");
  });

  it("registryVersion 불일치 → record-replay (stale 세대 replay 금지)", () => {
    expect(
      resolveContentPaintPath(
        "zoom-refresh",
        RECORDED,
        8,
        rect(0, 0, 100, 100),
      ),
    ).toBe("record-replay");
  });

  it("zoom-in 으로 축소된 요구 영역은 replay (커버리지 ⊆ 기록 범위)", () => {
    // zoom-in: visible rect 와 padding/zoom 이 함께 축소 — 항상 부분집합
    expect(
      resolveContentPaintPath(
        "zoom-refresh",
        RECORDED,
        7,
        rect(200, 100, 900, 600),
      ),
    ).toBe("replay");
  });

  it("기록 범위를 벗어난 요구 영역(pan/zoom-out)은 record-replay", () => {
    expect(
      resolveContentPaintPath(
        "coverage-refresh",
        RECORDED,
        7,
        rect(-500, -100, 2200, 1400),
      ),
    ).toBe("record-replay");
  });

  it("cleanup 이 기록 시점과 동일 커버리지면 replay (epsilon 경계 포함)", () => {
    const same = rect(
      RECORDED.bounds.x + 0.005,
      RECORDED.bounds.y,
      RECORDED.bounds.width,
      RECORDED.bounds.height,
    );
    expect(resolveContentPaintPath("cleanup", RECORDED, 7, same)).toBe(
      "replay",
    );
  });

  it("커버리지 판정은 4변 전부 본다", () => {
    const base = rect(0, 0, 100, 100);
    expect(contentPictureCovers(base, rect(10, 10, 80, 80))).toBe(true);
    expect(contentPictureCovers(base, rect(-10, 10, 80, 80))).toBe(false); // left
    expect(contentPictureCovers(base, rect(10, -10, 80, 80))).toBe(false); // top
    expect(contentPictureCovers(base, rect(30, 10, 80, 80))).toBe(false); // right
    expect(contentPictureCovers(base, rect(10, 30, 80, 80))).toBe(false); // bottom
  });

  it("사유 분류: classifyFrame reason 문자열과 1:1", () => {
    for (const r of [
      "zoom-refresh",
      "coverage-refresh",
      "cleanup",
      "no-snapshot",
    ]) {
      expect(isCameraDrivenRasterReason(r)).toBe(true);
    }
    for (const r of ["invalidate", "registry", "animation", null]) {
      expect(isCameraDrivenRasterReason(r)).toBe(false);
    }
  });
});
