/**
 * ADR-909 store longhand 정책 — calculateContentHeight consumer 회귀 가드.
 *
 * Inspector 의 distributeShorthand 는 gap/padding shorthand 를 longhand 로 분배 저장한다
 * (gap → rowGap/columnGap, padding → paddingTop/Right/Bottom/Left). 따라서
 * calculateContentHeight 의 모든 분기는 longhand 우선 + shorthand fallback 으로 읽어야
 * Style Panel 편집이 Skia 높이에 반영된다.
 *
 * 본 테스트는 동일 수치를 (a) shorthand 로 준 element 와 (b) longhand 로 준 element 가
 * **같은 높이** 를 산출하는지로 longhand 소비를 확증한다. consumer 가 shorthand 만 읽으면
 * longhand 케이스가 fallback(spec 기본값) 으로 떨어져 두 높이가 달라진다.
 *
 * Why (regression): Select/ComboBox(utils.ts:2634) gap 과 Card(utils.ts:2473) padding 이
 * shorthand 단독 읽기 → store longhand 미반영 → 사용자 gap·padding 편집이 무시되던 버그.
 */

import { describe, expect, it } from "vitest";
import { calculateContentHeight } from "../utils";
import type { Element } from "../../../../../../types/core/store.types";

function el(id: string, type: string, props: Record<string, unknown>): Element {
  return { id, type, props, childrenIds: [] } as unknown as Element;
}

describe("calculateContentHeight — ADR-909 store longhand 소비 (Select/ComboBox gap)", () => {
  // Select 는 display:flex + visible 자식 2개(Label + SelectTrigger) 일 때만 gap 이
  // gap * (visibleCount - 1) 로 높이에 합산된다.
  const GAP = 24;
  // Select 분기는 calculateContentHeight 의 3번째 인자(childElements)를 직접 순회한다.
  const childOf = (): Element[] => [
    el("sel-label", "Label", { children: "Choose", style: { height: 20 } }),
    el("sel-trigger", "SelectTrigger", {}),
  ];
  const makeSelect = (gapStyle: Record<string, unknown>): Element =>
    el("sel-1", "Select", {
      label: "Choose",
      size: "md",
      style: { display: "flex", ...gapStyle },
    });

  it("shorthand gap 과 longhand columnGap 이 동일 높이 산출 (longhand 소비)", () => {
    const hShort = calculateContentHeight(
      makeSelect({ gap: GAP }),
      300,
      childOf(),
    );
    const hLong = calculateContentHeight(
      makeSelect({ columnGap: GAP }),
      300,
      childOf(),
    );
    expect(hLong).toBe(hShort);
  });

  it("longhand rowGap 도 동일 높이 산출 (readGapValue rowGap 우선)", () => {
    const hShort = calculateContentHeight(
      makeSelect({ gap: GAP }),
      300,
      childOf(),
    );
    const hRow = calculateContentHeight(
      makeSelect({ rowGap: GAP }),
      300,
      childOf(),
    );
    expect(hRow).toBe(hShort);
  });

  it("gap 미설정 대비 longhand gap 설정 시 높이가 정확히 gap 만큼 증가 (gap 실반영)", () => {
    const hNo = calculateContentHeight(makeSelect({}), 300, childOf());
    const hWith = calculateContentHeight(
      makeSelect({ columnGap: GAP }),
      300,
      childOf(),
    );
    // visibleCount=2 → gap 1회. 단, 미설정 시 readGapValue=undefined → 기본 8 적용.
    // 따라서 차이 = (24 - 8) = 16 (1 gap 간격).
    expect(hWith - hNo).toBe(GAP - 8);
  });
});

describe("calculateContentHeight — ADR-909 store longhand 소비 (Card padding)", () => {
  // Card 의 자식 없는 fallback 분기는 padding 을 content-box 너비 계산(wrapWidth)에 사용.
  // padding 이 다르면 wrapWidth 가 달라져 description 줄바꿈 높이가 달라질 수 있다.
  // longhand paddingTop 만으로도 shorthand padding 과 동일하게 읽혀야 한다.
  const PAD = 40;
  const makeCard = (padStyle: Record<string, unknown>): Element =>
    el("card-1", "Card", {
      size: "md",
      title: "A reasonably long card title that should wrap at narrow widths",
      description:
        "A long card description that wraps across multiple lines when the content width is reduced by larger padding values applied to the card.",
      style: padStyle,
    });

  it("shorthand padding 과 longhand paddingTop 이 동일 높이 산출 (longhand 소비)", () => {
    const shorthand = makeCard({ padding: PAD });
    const longhand = makeCard({ paddingTop: PAD });
    // 좁은 availableWidth 로 wrapWidth 가 padding 에 민감해지게 함
    const hShort = calculateContentHeight(shorthand, 220);
    const hLong = calculateContentHeight(longhand, 220);
    expect(hLong).toBe(hShort);
  });
});
