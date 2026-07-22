/**
 * isBoundedScrollOwnerStyle — bounded-scroll collection owner 판정 (preserveEnrichHeight 제외 게이트).
 *
 * 2026-07-22 (사용자 보고): ListBox ref 인스턴스(maxHeight:300px + overflow:auto)가
 * `onlyProjectionRowsChild` preserve 에 걸려 1-pass 추정 height(단일 줄 행 합산 234)가 Taffy 에
 * 동결 → Step 4.5 행 wrap 실측(rowsGroup 400)과 발산, CSS(min(content, maxHeight)=300) 대비 clip.
 * bounded-scroll owner 는 preserve 제외 → Taffy auto + max_size clamp 정합.
 *
 * 판정 의미론은 collectionVirtualization.ts 의 scroll-mode 판정
 * (readBoundedHeightPx + isScrollOverflow)과 동일 — sample-mode(auto-height, ADR-157) owner 는
 * bounded 아님 → false (preserve 유지, 표시 정책 불변).
 */

import { describe, it, expect } from "vitest";
import { isBoundedScrollOwnerStyle } from "../fullTreeLayout";

describe("isBoundedScrollOwnerStyle — bounded-scroll owner 판정", () => {
  it("maxHeight px 문자열 + overflow:auto → true (라이브 재현 케이스)", () => {
    expect(
      isBoundedScrollOwnerStyle({
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
      }),
    ).toBe(true);
  });

  it("height number + overflowY:scroll → true", () => {
    expect(
      isBoundedScrollOwnerStyle({ height: 240, overflowY: "scroll" }),
    ).toBe(true);
  });

  it("bounded 이지만 overflow 미지정 → false (스크롤 컨테이너 아님)", () => {
    expect(isBoundedScrollOwnerStyle({ maxHeight: "300px" })).toBe(false);
  });

  it("overflow:auto 이지만 height/maxHeight 없음 → false (sample-mode auto-height, ADR-157 preserve 유지)", () => {
    expect(isBoundedScrollOwnerStyle({ overflow: "auto" })).toBe(false);
  });

  it("overflow:hidden → false (scroll/auto 만 스크롤 컨테이너)", () => {
    expect(
      isBoundedScrollOwnerStyle({ maxHeight: 300, overflow: "hidden" }),
    ).toBe(false);
  });

  it("percentage maxHeight → false (px 만 bounded 판정 — collectionVirtualization 동일)", () => {
    expect(
      isBoundedScrollOwnerStyle({ maxHeight: "50%", overflow: "auto" }),
    ).toBe(false);
  });

  it("undefined style → false", () => {
    expect(isBoundedScrollOwnerStyle(undefined)).toBe(false);
  });
});
