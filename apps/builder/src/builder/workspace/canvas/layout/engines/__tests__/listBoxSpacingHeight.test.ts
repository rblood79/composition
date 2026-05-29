/**
 * ADR-147 (RAC 표준 ListBoxItem) — calculateContentHeight ListBox/ListBoxItem 높이 정합.
 *
 * render.shapes 가 description 행을 paddingY*2 + lineHeight + gap + lineHeight (=50) 로 그리는데,
 * ListBox 컨테이너가 label-only itemHeight(=28) 로만 행을 할당하면 description 행이 잘린다.
 * 본 테스트는:
 *  (a) description 항목 → 컨테이너가 itemHeightWithDescription(=50) 로 수용 (잘림 해소)
 *  (b) label-only 항목 → 기존 itemHeight(=28) 유지 (회귀)
 *  (c) standalone ListBoxItem element → render.shapes 와 동일 intrinsic height
 */

import { describe, expect, it } from "vitest";
import { resolveListBoxSpacingMetric } from "@composition/specs";
import { calculateContentHeight } from "../utils";
import type { Element } from "../../../../../../types/core/store.types";

type Item = { id: string; label: string; description?: string };

function makeListBox(items: Item[], style?: Record<string, unknown>): Element {
  return {
    id: "lb-1",
    type: "ListBox",
    props: { items, style },
    childrenIds: [],
  } as unknown as Element;
}

function makeListBoxItem(
  props: Record<string, unknown>,
  style?: Record<string, unknown>,
): Element {
  return {
    id: "lbi-1",
    type: "ListBoxItem",
    props: { ...props, style },
    childrenIds: [],
  } as unknown as Element;
}

const DESC_ITEMS: Item[] = [
  { id: "a", label: "Aardvark", description: "A nocturnal burrowing mammal" },
  { id: "c", label: "Cat", description: "A small domesticated carnivore" },
  { id: "k", label: "Kangaroo", description: "A large marsupial" },
];
const PLAIN_ITEMS: Item[] = [
  { id: "a", label: "Aardvark" },
  { id: "c", label: "Cat" },
  { id: "k", label: "Kangaroo" },
];

describe("calculateContentHeight — ListBox description-aware (ADR-147)", () => {
  const m = resolveListBoxSpacingMetric({});

  it("description 항목 3개 → 3 * itemHeightWithDescription + gap + padding + border", () => {
    const h = calculateContentHeight(makeListBox(DESC_ITEMS));
    const expected =
      m.paddingTop +
      m.paddingBottom +
      3 * m.itemHeightWithDescription +
      2 * m.rowGap +
      2 * m.borderWidth;
    expect(h).toBe(expected);
  });

  it("label-only 항목 3개 → 3 * itemHeight (회귀 유지)", () => {
    const h = calculateContentHeight(makeListBox(PLAIN_ITEMS));
    const expected =
      m.paddingTop +
      m.paddingBottom +
      3 * m.itemHeight +
      2 * m.rowGap +
      2 * m.borderWidth;
    expect(h).toBe(expected);
  });

  it("description 항목이 label-only 보다 행당 (50-28)=22px 더 큼", () => {
    const desc = calculateContentHeight(makeListBox(DESC_ITEMS));
    const plain = calculateContentHeight(makeListBox(PLAIN_ITEMS));
    expect(desc - plain).toBe(3 * (m.itemHeightWithDescription - m.itemHeight));
  });
});

describe("calculateContentHeight — standalone ListBoxItem (ADR-147)", () => {
  const m = resolveListBoxSpacingMetric({});

  it("description 있는 ListBoxItem → itemHeightWithDescription", () => {
    const h = calculateContentHeight(
      makeListBoxItem({ children: "{label}", description: "{description}" }),
    );
    expect(h).toBe(m.itemHeightWithDescription);
  });

  it("label-only ListBoxItem → itemHeight", () => {
    const h = calculateContentHeight(makeListBoxItem({ children: "{label}" }));
    expect(h).toBe(m.itemHeight);
  });

  it("명시적 style.height → 우선", () => {
    const h = calculateContentHeight(
      makeListBoxItem(
        { children: "{label}", description: "{description}" },
        { height: 72 },
      ),
    );
    expect(h).toBe(72);
  });
});
