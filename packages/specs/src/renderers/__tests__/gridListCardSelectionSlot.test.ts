import { describe, expect, it } from "vitest";

import {
  buildCardSelectionEntry,
  resolveCardSelectionExtra,
  resolveCollectionRowMetric,
} from "../utils/collectionItemMetrics";
import { getSkiaPrimitive } from "../skiaPrimitives";
import type { ComponentVisualRule } from "../utils/resolveComponentVisual";
import type { Shape, SizeSpec } from "../../types";

/**
 * design-data 감사 §1-2 축② 잔여 — GridList 카드의 선택 체크박스 (2026-08-22).
 *
 * DOM 실측(preview iframe, md 카드 189×98):
 *   checkbox  → checkbox y=13(h20), label y=35(h24), description y=61(h24) → 카드 98
 *   highlight → label y=13, description y=39 → 카드 76
 *
 * Tree 행과 **반대 축**이다. Tree 는 체크박스가 라벨 왼쪽에 서서 textX 를 밀지만, 카드는
 * `flex-direction: column` 이라 라벨 **위**에 서서 카드 **높이**를 +22 늘린다. 그래서 폭
 * 예약(resolveSelectionSlot) 이 아니라 스택 블록(buildCardSelectionEntry)으로 들어간다.
 *
 * 카드 높이를 내는 지점이 4곳(escape / layout per-card / layout owner / virtualization stride)
 * 이라, 같은 심볼을 쓰는지가 이 슬라이스의 실질 계약이다.
 */

const size = {
  fontSize: 14,
  paddingX: 16,
  paddingY: 12,
  borderRadius: 8,
  borderWidth: 1,
  height: 0,
  gap: 2,
} as unknown as SizeSpec;

const visual = {
  fill: { default: { base: "{color.layer-1}" } },
  text: "{color.neutral}",
  border: "{color.border}",
  selectedBorder: "{color.accent}",
  textWeight: 600,
  selectionCheckbox: {
    size: 20,
    gap: 2,
    fill: "{color.base}",
    border: "{color.border}",
    selectedFill: "{color.accent}",
    checkColor: "{color.on-accent}",
  },
} as unknown as ComponentVisualRule;

const draw = getSkiaPrimitive("gridlist_card")!;

const shapesOf = (props: Record<string, unknown>) =>
  draw({
    props: { style: { width: 189 }, ...props },
    size,
    visual,
    style: { width: 189 },
  } as never) as Array<Shape & { type: string; x?: number; y?: number }>;

const cardHeight = (props: Record<string, unknown>): number =>
  shapesOf(props).find((s) => s.type === "roundRect" && s.id === "card-bg")!
    .height as number;

const texts = (props: Record<string, unknown>) =>
  shapesOf(props).filter((s) => s.type === "text") as Array<{
    y: number;
    text: string;
  }>;

const CARD = { children: "Documents", description: "12 files" };

describe("GridList 카드 선택 체크박스 — 세로 스택 블록", () => {
  it("체크박스가 서면 카드가 22 높아지고 텍스트가 그만큼 내려간다 (DOM 98 vs 76)", () => {
    // escape 의 카드 박스는 padding-box — DOM 76/98 에서 테두리 2 를 뺀 74/96 이다
    //   (border shape 은 target:"card-bg" 로 따로 그려진다).
    expect(cardHeight(CARD)).toBe(74);
    expect(texts(CARD).map((t) => t.y)).toEqual([12, 38]);

    const on = { ...CARD, _showSelectionCheckbox: true };
    expect(cardHeight(on)).toBe(96);
    // 카드 로컬 좌표 = DOM 좌표 − border 1 (DOM 13/35/61 → 12/34/60).
    expect(texts(on).map((t) => t.y)).toEqual([34, 60]);
  });

  it("체크박스 상자는 좌측 padding, 스택 첫 자리에 그려진다", () => {
    const boxes = shapesOf({ ...CARD, _showSelectionCheckbox: true }).filter(
      (s) => s.id === "selection-box",
    );
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toMatchObject({ x: 16, y: 12, fill: "{color.base}" });
  });

  it("선택 시 accent 채움 + 체크 2선 (isSelected — _isSelected 아님)", () => {
    const selected = shapesOf({
      ...CARD,
      _showSelectionCheckbox: true,
      isSelected: true,
    });
    const box = selected.find((s) => s.id === "selection-box") as {
      fill: string;
    };
    expect(box.fill).toBe("{color.accent}");
    expect(selected.filter((s) => s.type === "line")).toHaveLength(2);

    // `_isSelected` 단독은 신호가 아니다 — projection 이 두 키를 함께 주입해야 한다.
    const legacyOnly = shapesOf({
      ...CARD,
      _showSelectionCheckbox: true,
      _isSelected: true,
    });
    expect(
      (legacyOnly.find((s) => s.id === "selection-box") as { fill: string })
        .fill,
    ).toBe("{color.base}");
  });

  it("채널 미정의 컴포넌트는 신호가 있어도 무반응 (회귀 0)", () => {
    const noChannel = {
      ...visual,
      selectionCheckbox: undefined,
    } as unknown as ComponentVisualRule;
    const out = draw({
      props: { ...CARD, _showSelectionCheckbox: true, style: { width: 189 } },
      size,
      visual: noChannel,
      style: { width: 189 },
    } as never) as Array<Shape & { type: string }>;
    expect(out.some((s) => s.id === "selection-box")).toBe(false);
    expect(
      (out.find((s) => s.id === "card-bg") as { height: number }).height,
    ).toBe(74);
  });
});

describe("카드 높이 4경로 공유 심볼", () => {
  it("델타(공식 경로)와 블록(metric 경로)이 같은 22 를 낸다", () => {
    expect(
      resolveCardSelectionExtra({
        visible: true,
        selectionBoxSize: 20,
        gap: 2,
      }),
    ).toBe(22);
    expect(
      resolveCardSelectionExtra({
        visible: false,
        selectionBoxSize: 20,
        gap: 2,
      }),
    ).toBe(0);

    const withEntry = resolveCollectionRowMetric({
      containerWidth: 189,
      paddingTop: 12,
      paddingRight: 16,
      paddingBottom: 12,
      paddingLeft: 16,
      gap: 2,
      textX: 16,
      fontFamily: "sans-serif",
      entries: [
        buildCardSelectionEntry(20),
        {
          role: "label",
          text: "",
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 24,
        },
        {
          role: "description",
          text: "",
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 24,
        },
      ],
      fallbackLineHeight: 24,
    });
    const withoutEntry = resolveCollectionRowMetric({
      containerWidth: 189,
      paddingTop: 12,
      paddingRight: 16,
      paddingBottom: 12,
      paddingLeft: 16,
      gap: 2,
      textX: 16,
      fontFamily: "sans-serif",
      entries: [
        {
          role: "label",
          text: "",
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 24,
        },
        {
          role: "description",
          text: "",
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 24,
        },
      ],
      fallbackLineHeight: 24,
    });
    expect(withEntry.rowHeight - withoutEntry.rowHeight).toBe(22);
    // 체크박스 블록은 폭을 안 먹는다 — 라벨 wrap 폭은 그대로(Tree 행과 반대 축).
    expect(withEntry.maxWidth).toBe(withoutEntry.maxWidth);
    expect(withEntry.slotBlocks.selection).toMatchObject({ y: 12, height: 20 });
  });
});
