import { describe, expect, test } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { enrichWithIntrinsicSize } from "../utils";

/**
 * flex-grow item 의 intrinsic width 주입 계약 (2026-07-14 회귀 게이트).
 *
 * 버그: `enrichWithIntrinsicSize` 가 INLINE_BLOCK_TAGS 자식에 intrinsic 폭을 **명시 width**
 *   로 주입 → `flex:1` item 의 grow 가 원천 차단. CSS 에서 intrinsic 폭은 flex **base size**
 *   일 뿐이고 used 폭은 free space 분배 결과다.
 *   실측(DatePicker > SelectTrigger(350) > DateInput `flex:1 minWidth:0`):
 *     Skia width 102 (콘텐츠 고정) vs DOM 308 (grow). icon 도 x=119 로 딸려옴 (DOM x=345).
 *
 * 동반 결함: `!style?.minWidth` 가 **minWidth:0 을 미설정으로 오판**(falsy 함정) → implicitStyles
 *   가 준 `minWidth:0`(= 콘텐츠 밑으로 축소 허용) 을 intrinsic 폭으로 덮어씀.
 *
 * 대칭 확인: 같은 `flex:1 minWidth:0` 을 받는 SelectValue 는 INLINE_BLOCK_TAGS **비소속**이라
 *   width 미주입 → 원래부터 정상 grow. Select 의 정상 동작은 우연이었다.
 */
const makeDateInput = (
  style: Record<string, unknown>,
  props: Record<string, unknown> = {},
): CanvasLayoutNode =>
  ({
    id: "di-1",
    type: "DateInput",
    props: {
      size: "md",
      _parentTag: "DatePicker",
      ...props,
      style,
    },
  }) as CanvasLayoutNode;

/** enrich 후 최종 style */
const enrich = (el: CanvasLayoutNode, isFlexChild: boolean) =>
  (
    enrichWithIntrinsicSize(
      el,
      350,
      30,
      undefined,
      undefined,
      undefined,
      isFlexChild,
    ).props as Record<string, unknown>
  ).style as Record<string, unknown>;

describe("flex-grow item 의 intrinsic width 주입 계약", () => {
  test("grow item(flex:1) 에는 명시 width 를 주입하지 않는다 — grow 차단 금지", () => {
    const style = enrich(
      makeDateInput({ flex: 1, minWidth: 0, verticalAlign: "middle" }),
      true,
    );
    expect(style.width).toBeUndefined();
  });

  test("grow item 의 명시 minWidth:0 을 intrinsic 폭으로 덮어쓰지 않는다 (falsy 함정)", () => {
    const style = enrich(makeDateInput({ flex: 1, minWidth: 0 }), true);
    expect(style.minWidth).toBe(0);
  });

  test("flexGrow 표기(flex 대신)도 동일하게 width 를 굳히지 않는다", () => {
    const style = enrich(makeDateInput({ flexGrow: 1, minWidth: 0 }), true);
    expect(style.width).toBeUndefined();
  });

  test("문자열 flex('1 1 0%')도 grow 로 인식한다", () => {
    const style = enrich(makeDateInput({ flex: "1 1 0%", minWidth: 0 }), true);
    expect(style.width).toBeUndefined();
  });

  test("grow 하지 않는 item 은 intrinsic width 를 그대로 주입한다 (standalone DateField 보존)", () => {
    // grow 없음 → 콘텐츠 폭이 box 를 만든다. 미주입 시 DateInput box < 텍스트 → overflow.
    const style = enrich(makeDateInput({}, { _parentTag: "DateField" }), true);
    expect(typeof style.width).toBe("number");
    expect(style.width as number).toBeGreaterThan(0);
  });

  test("flex:0 은 grow 가 아니다 — width 주입 유지", () => {
    const style = enrich(makeDateInput({ flex: 0 }), true);
    expect(typeof style.width).toBe("number");
  });

  test("flex child 가 아니면 grow 판정 없이 width 주입 (block 자식)", () => {
    const style = enrich(makeDateInput({ flex: 1 }), false);
    expect(typeof style.width).toBe("number");
  });

  test("grow item 이라도 minWidth 미지정이면 intrinsic 폭을 하한으로 남긴다", () => {
    // width 는 굳히지 않되, min-width:auto 상당의 하한은 유지 → free space 없으면 콘텐츠 폭 보존.
    const style = enrich(makeDateInput({ flex: 1 }), true);
    expect(style.width).toBeUndefined();
    expect(typeof style.minWidth).toBe("number");
    expect(style.minWidth as number).toBeGreaterThan(0);
  });
});
