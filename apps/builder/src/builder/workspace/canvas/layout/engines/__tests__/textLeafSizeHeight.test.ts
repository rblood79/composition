import { describe, expect, test } from "vitest";
import { calculateContentHeight } from "../utils";
import type { CanvasLayoutNode } from "../../layoutNode";

/**
 * 회귀 가드: Text(및 TEXT_LEAF_TAGS) 의 size 변경이 layout height 로 전파되어야 한다.
 *
 * 버그: size 를 M→L 로 바꿔도 height 가 24px(=16*1.5 fontSize fallback) 로 고정.
 * 수정: text leaf 가 spec render.shapes 경로(extractSpecTextStyle)로 size 기준
 * fontSize/lineHeight 를 resolve → md=24(text-base--line-height), lg=28(text-lg--line-height).
 *
 * availableWidth 미지정 → 4.9 줄바꿈 분기 skip → step 5 에서 spec lineHeight 반환
 * (canvas 측정 의존 없이 결정적).
 */
const mkText = (size: string): CanvasLayoutNode =>
  ({
    id: "t1",
    type: "text",
    props: { size, children: "Hello" },
  }) as unknown as CanvasLayoutNode;

describe("calculateContentHeight — text leaf size→height (A안)", () => {
  test("Text height 가 size 를 따라간다 (md=24, lg=28)", () => {
    const hMd = calculateContentHeight(mkText("md"));
    const hLg = calculateContentHeight(mkText("lg"));

    expect(hMd).toBe(24);
    expect(hLg).toBe(28);
    // 핵심: 둘이 달라야 한다 (기존 버그에서는 24/24 로 동일)
    expect(hLg).toBeGreaterThan(hMd);
  });

  test("heading 도 size 를 따라간다 (md ≠ lg)", () => {
    const heading = (size: string): CanvasLayoutNode =>
      ({
        id: "h1",
        type: "heading",
        props: { size, children: "Title" },
      }) as unknown as CanvasLayoutNode;

    expect(calculateContentHeight(heading("lg"))).toBeGreaterThan(
      calculateContentHeight(heading("md")),
    );
  });
});
