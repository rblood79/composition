import { describe, expect, it } from "vitest";

import { computeMaxScroll } from "../fullTreeLayout";

/**
 * 스크롤 컨테이너의 끝쪽 padding·border 는 scrollable overflow 에 들어간다 (CSS-OVERFLOW-3 §2.2).
 *
 * Chrome 153 실측 (2026-09-18, 같은 세션): `width:200; padding:24; overflow:auto; box-sizing:
 * border-box` 블록 안에 400px 자식 → `scrollWidth 448 = 24 + 400 + 24`, `clientWidth 200`.
 * 끝까지 스크롤하면 콘텐츠 오른쪽에 padding 24 가 남는다. 종전 Skia 는 `자식 right − width`
 * 만 세서 (424 − 200 = 224) 끝 padding 이 잘렸다 — Compare 모드에서 body padding 24 가
 * 오른쪽에서만 사라지던 사용자 보고.
 *
 * 자식 좌표는 부모 border-box 기준이므로 (borderLeft + paddingLeft 포함) 끝쪽 값만 더한다.
 * Chrome `scrollWidth − clientWidth` = (padL + content + padR) − (width − bL − bR)
 *   = (bL + padL + content) + padR + bR − width = extent + padR + bR − width.
 */
describe("computeMaxScroll — 끝 padding·border 포함", () => {
  it("padding 24 블록: Chrome scrollWidth 448 − clientWidth 200 = 248", () => {
    expect(
      computeMaxScroll({ extent: 24 + 400, size: 200, endPadding: 24, endBorder: 0 }),
    ).toBe(248);
  });

  it("border 5 + padding 24: 429 + 24 + 5 − 200 = 258", () => {
    expect(
      computeMaxScroll({ extent: 5 + 24 + 400, size: 200, endPadding: 24, endBorder: 5 }),
    ).toBe(258);
  });

  it("콘텐츠가 padding-box 안에 들어가면 0 (음수 금지)", () => {
    expect(
      computeMaxScroll({ extent: 24 + 100, size: 200, endPadding: 24, endBorder: 0 }),
    ).toBe(0);
  });

  it("끝 padding 만으로 콘텐츠가 넘치면 그만큼 스크롤된다", () => {
    // 콘텐츠 right 190 + padR 24 = 214 > 200
    expect(
      computeMaxScroll({ extent: 190, size: 200, endPadding: 24, endBorder: 0 }),
    ).toBe(14);
  });
});
