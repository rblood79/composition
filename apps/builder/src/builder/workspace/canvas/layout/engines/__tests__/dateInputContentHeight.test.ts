import { describe, expect, test } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { calculateContentHeight } from "../utils";

/**
 * DateInput intrinsic content **height** — DatePicker 안에서 입력 box 를 위아래로
 *   넘치던 버그(2026-07-14) 회귀 게이트.
 *
 * 근본 원인: `calculateContentHeight("dateinput")` 이 문맥과 무관하게 catalog
 *   `DateInput.sizes[size].height`(md=30) 를 반환했다. 그 30 은 **standalone DateField**
 *   에서 DateInput 이 *테두리 있는 입력 box 자체*일 때의 높이다.
 *
 *   DatePicker/DateRangePicker 안에서는 box 를 `SelectTrigger`(RAC Group)가 소유한다 —
 *   실측 CSS(2026-07-14): trigger 는 border 1px + paddingY 4px + `--bg-inset` 배경 + height 30,
 *   그 안의 DateInput 은 **border 0 / padding 0 / background transparent / height 20**
 *   (= 순수 텍스트 행). 30 을 그대로 쓰면 30px trigger 안에서 자식이 30 이 되어
 *   위아래 5px 씩 넘쳤다 (Skia DateInput y=5 h=30 vs DOM h=20).
 *
 * 수정: picker 안(`_parentTag`)에서는 trigger content-box 로 산출 —
 *   `SelectTrigger.sizes[size]`: height - paddingY*2 - borderWidth*2.
 *   (md: 30 - 4*2 - 1*2 = 20 — DOM 실측 일치.)
 */
const makeDateInput = (props: Record<string, unknown> = {}): CanvasLayoutNode =>
  ({
    id: "di-1",
    type: "DateInput",
    props: {
      _granularity: "day",
      _locale: "en-US",
      size: "md",
      ...props,
    },
  }) as unknown as CanvasLayoutNode;

describe("DateInput intrinsic content height", () => {
  test("DatePicker 안 — trigger content-box(20) 이지 box height(30) 가 아니다", () => {
    const h = calculateContentHeight(
      makeDateInput({ _parentTag: "DatePicker" }),
    );
    // SelectTrigger md: height 30 - paddingY 4*2 - borderWidth 1*2 = 20 (DOM 실측 20)
    expect(h).toBe(20);
  });

  test("DateRangePicker 안 — DatePicker 와 동일 (같은 SelectTrigger box)", () => {
    const h = calculateContentHeight(
      makeDateInput({ _parentTag: "DateRangePicker" }),
    );
    expect(h).toBe(20);
  });

  test("standalone DateField — DateInput 이 box 자체라 catalog height(30) 유지", () => {
    // _parentTag 가 picker 가 아니면(DateField / 미지정) 기존 동작 보존.
    expect(
      calculateContentHeight(makeDateInput({ _parentTag: "DateField" })),
    ).toBe(30);
    expect(calculateContentHeight(makeDateInput())).toBe(30);
  });

  test("picker 안 높이는 trigger box 보다 항상 작다 (넘침 불가) — 전 size", () => {
    // trigger box height (catalog SelectTrigger): xs20 / sm22 / md30 / lg42 / xl54
    const triggerBox: Record<string, number> = {
      xs: 20,
      sm: 22,
      md: 30,
      lg: 42,
      xl: 54,
    };
    for (const size of ["xs", "sm", "md", "lg", "xl"]) {
      const h = calculateContentHeight(
        makeDateInput({ _parentTag: "DatePicker", size }),
      );
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThan(triggerBox[size]);
    }
  });
});
