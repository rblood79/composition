import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVisiblePageSet } from "./buildVisiblePageSet";
import { CONTENT_COVERAGE_PADDING_CSS_PX } from "./renderCoverage";
import type { ScenePageFrame } from "./sceneSnapshotTypes";

/**
 * ADR-173 Phase 1 — 컬링 반경과 content surface 패딩은 **같은 값**이어야 한다.
 *
 * 캐시 surface 는 뷰포트+패딩만큼 크게 그려두고 그 안에서는 blit 으로 때운다.
 * 거기 그릴 내용을 정하는 가시 집합이 더 좁은 반경으로 판정되면, 패딩의
 * 바깥 구간은 페이지가 있어도 **빈 채로 래스터**되어 blit 이 공백을 나른다.
 * 그래서 두 값은 하나의 상수에서 나와야 하고, 이 파일이 그 계약을 고정한다.
 */

const CONTAINER = { height: 800, width: 1000 };

function frameAt(x: number): ScenePageFrame {
  return {
    elementCount: 0,
    height: 100,
    id: `page-${x}`,
    title: "p",
    width: 100,
    x,
    y: 0,
  };
}

describe("ADR-173 Phase 1 — 컬링 반경 = content surface 패딩", () => {
  it("기본 반경이 패딩 상수와 같다 — 패딩 안 페이지는 가시로 잡힌다", () => {
    // 뷰포트 오른쪽 밖으로 300px 떨어진 페이지: 구 반경(200)에선 탈락,
    // 패딩(512) 기준에선 가시 — 이 구간이 "빈 채로 래스터되던" 영역이다.
    const justInsidePadding = buildVisiblePageSet({
      containerSize: CONTAINER,
      pageFrames: [frameAt(CONTAINER.width + 300)],
      panOffset: { x: 0, y: 0 },
      zoom: 1,
    });

    expect(CONTENT_COVERAGE_PADDING_CSS_PX).toBeGreaterThan(300);
    expect(justInsidePadding.size).toBe(1);
  });

  it("패딩 밖 페이지는 여전히 탈락한다 (반경이 무한이 아님)", () => {
    const outside = buildVisiblePageSet({
      containerSize: CONTAINER,
      pageFrames: [
        frameAt(CONTAINER.width + CONTENT_COVERAGE_PADDING_CSS_PX + 10),
      ],
      panOffset: { x: 0, y: 0 },
      zoom: 1,
    });

    expect(outside.size).toBe(0);
  });

  it("반경 경계는 정확히 상수값이다", () => {
    const onBoundary = buildVisiblePageSet({
      containerSize: CONTAINER,
      pageFrames: [
        frameAt(CONTAINER.width + CONTENT_COVERAGE_PADDING_CSS_PX - 1),
      ],
      panOffset: { x: 0, y: 0 },
      zoom: 1,
    });

    expect(onBoundary.size).toBe(1);
  });

  it("SkiaRenderer 의 content 패딩이 같은 상수를 참조한다 (리터럴 재선언 금지)", () => {
    const source = readFileSync(
      join(__dirname, "..", "skia", "SkiaRenderer.ts"),
      "utf8",
    );

    expect(source).toContain("CONTENT_COVERAGE_PADDING_CSS_PX");
    // 패딩을 숫자 리터럴로 되돌리면 두 기준면이 다시 갈린다.
    expect(source).not.toMatch(/contentPaddingCssPx\s*=\s*\d/);
  });
});
