// ADR-160 Phase 1 — collection projection 행 텍스트 측정 SSOT (`resolveCollectionRowMetric`).
//
// layout(M1)·buildSpecNodeData·escape 가 공유할 geometry SSOT 가 ListBox/GridList 두 escape 의
// 현재 공식을 정확히 재현하는지 검증한다:
//  - maxWidth = containerWidth − textX − paddingRight − rightReserve (icon/check-aware, §2.1 발견 1)
//  - 2-entry top-anchored(첫 블록 top=paddingTop) / 1-entry singleEntryCentered
//  - rowHeight = explicitHeight ?? max(pad + content, minHeight)
//  - wrap 은 주입 측정기, 미주입 시 단일 줄 fallback(BC)
import { describe, it, expect, afterEach } from "vitest";

import { resolveCollectionRowMetric } from "../renderers/utils/collectionItemMetrics";
import { setSpecWrappedTextHeightMeasurer } from "../renderers/utils/measureText";

// ListBox 기본 metric 정합 상수 (라이브 실측): label 16→lh 24, description 12→lh 16.
const LABEL_LH = 24;
const DESC_LH = 16;

const listBoxBase = {
  containerWidth: 200,
  paddingTop: 4,
  paddingRight: 12,
  paddingBottom: 4,
  paddingLeft: 12,
  gap: 2,
  minHeight: 20,
  textX: 12,
  rightReserve: 0,
  fontFamily: "sans",
  singleEntryCentered: true as const,
  fallbackLineHeight: LABEL_LH,
};

const labelEntry = {
  role: "label" as const,
  text: "Label",
  fontSize: 16,
  fontWeight: 600,
  lineHeight: LABEL_LH,
};
const descEntry = {
  role: "description" as const,
  text: "Description",
  fontSize: 12,
  fontWeight: 400,
  lineHeight: DESC_LH,
};

describe("resolveCollectionRowMetric — ListBox 계약", () => {
  afterEach(() => setSpecWrappedTextHeightMeasurer(null));

  it("2-entry, 측정기 미주입 → 단일 줄 fallback(BC)", () => {
    const m = resolveCollectionRowMetric({
      ...listBoxBase,
      entries: [labelEntry, descEntry],
    });
    // maxWidth = 200 − 12 − 12 − 0
    expect(m.maxWidth).toBe(176);
    // contentHeight = 24 + gap 2 + 16 = 42 ; rowHeight = max(8+42, 20) = 50
    expect(m.contentHeight).toBe(42);
    expect(m.rowHeight).toBe(50);
    // top-anchored: label top=paddingTop 4, desc top=4+24+2=30
    expect(m.slotBlocks.label).toEqual({ height: 24, y: 4, lineHeight: 24 });
    expect(m.slotBlocks.description).toEqual({
      height: 16,
      y: 30,
      lineHeight: 16,
    });
    expect(m.order).toEqual(["label", "description"]);
  });

  it("2-entry, label 3줄(72) wrap → 블록·행 높이 성장 (escape 98 정합)", () => {
    setSpecWrappedTextHeightMeasurer((text, _fs, _fw, _ff, _mw, lh) =>
      text === "Label" ? 72 : (lh ?? 16),
    );
    const m = resolveCollectionRowMetric({
      ...listBoxBase,
      entries: [labelEntry, descEntry],
    });
    // content = 72 + 2 + 16 = 90 ; rowHeight = max(8+90, 20) = 98
    expect(m.contentHeight).toBe(90);
    expect(m.rowHeight).toBe(98);
    expect(m.slotBlocks.label).toEqual({ height: 72, y: 4, lineHeight: 24 });
    // desc top = 4 + 72 + 2 = 78
    expect(m.slotBlocks.description?.y).toBe(78);
  });

  it("1-entry, singleEntryCentered → 블록 세로 중앙", () => {
    setSpecWrappedTextHeightMeasurer(() => 72);
    const m = resolveCollectionRowMetric({
      ...listBoxBase,
      explicitHeight: 100,
      entries: [labelEntry],
    });
    expect(m.rowHeight).toBe(100);
    // 중앙: (100 − 72) / 2 = 14
    expect(m.slotBlocks.label).toEqual({ height: 72, y: 14, lineHeight: 24 });
    expect(m.slotBlocks.description).toBeUndefined();
  });

  it("0-entry → fallbackLineHeight 로 content", () => {
    const m = resolveCollectionRowMetric({
      ...listBoxBase,
      entries: [],
    });
    expect(m.contentHeight).toBe(LABEL_LH);
    // max(8 + 24, 20) = 32
    expect(m.rowHeight).toBe(32);
    expect(m.slotBlocks).toEqual({});
  });

  it("icon/check reserve → maxWidth 축소 + 측정기에 전달", () => {
    let capturedMaxWidth = -1;
    setSpecWrappedTextHeightMeasurer((_t, _fs, _fw, _ff, mw, lh) => {
      capturedMaxWidth = mw;
      return lh ?? 24;
    });
    const m = resolveCollectionRowMetric({
      ...listBoxBase,
      textX: 34, // paddingLeft 12 + icon 예약 22
      rightReserve: 22, // check
      entries: [labelEntry],
    });
    // maxWidth = 200 − 34 − 12 − 22 = 132
    expect(m.maxWidth).toBe(132);
    expect(capturedMaxWidth).toBe(132);
    expect(m.textX).toBe(34);
  });

  it("minHeight clamp — 작은 content 는 minHeight 로", () => {
    const m = resolveCollectionRowMetric({
      ...listBoxBase,
      paddingTop: 0,
      paddingBottom: 0,
      minHeight: 40,
      entries: [{ ...labelEntry, lineHeight: 12 }],
    });
    // content 12, pad 0 → max(12, 40) = 40
    expect(m.rowHeight).toBe(40);
  });

  it("explicitHeight 는 min/content 무시하고 그대로", () => {
    const m = resolveCollectionRowMetric({
      ...listBoxBase,
      explicitHeight: 200,
      entries: [labelEntry, descEntry],
    });
    expect(m.rowHeight).toBe(200);
  });
});

describe("resolveCollectionRowMetric — GridList 계약", () => {
  afterEach(() => setSpecWrappedTextHeightMeasurer(null));

  // GridList: cardPaddingX 16, cardPaddingY 12, descGap 2, description lineHeight 1.5× (=24),
  //   singleEntryCentered=false(항상 top), rightReserve 0.
  const gridBase = {
    containerWidth: 200,
    paddingTop: 12,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16,
    gap: 2,
    textX: 16,
    rightReserve: 0,
    fontFamily: "sans",
    singleEntryCentered: false as const,
    fallbackLineHeight: 24,
  };
  const gLabel = {
    role: "label" as const,
    text: "Label",
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 24,
  };
  const gDesc = {
    role: "description" as const,
    text: "Description",
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 24,
  };

  it("2-entry fallback → cardHeight = pad + content (escape 74 정합, border 별도)", () => {
    const m = resolveCollectionRowMetric({
      ...gridBase,
      entries: [gLabel, gDesc],
    });
    // maxWidth = 200 − 16 − 16 − 0 = 168
    expect(m.maxWidth).toBe(168);
    // content = 24 + 2 + 24 = 50 ; cardHeight = 12+12+50 = 74
    expect(m.contentHeight).toBe(50);
    expect(m.rowHeight).toBe(74);
    // top-anchored: label top=12, desc top=12+24+2=38
    expect(m.slotBlocks.label?.y).toBe(12);
    expect(m.slotBlocks.description?.y).toBe(38);
  });

  it("1-entry, singleEntryCentered=false → top-anchored (중앙 아님)", () => {
    const m = resolveCollectionRowMetric({
      ...gridBase,
      explicitHeight: 100,
      entries: [gLabel],
    });
    expect(m.rowHeight).toBe(100);
    // GridList 는 1줄도 top: y = paddingTop 12 (중앙 44 아님)
    expect(m.slotBlocks.label?.y).toBe(12);
  });

  it("label wrap(48) → 스택·카드 높이 성장", () => {
    setSpecWrappedTextHeightMeasurer((text, _fs, _fw, _ff, _mw, lh) =>
      text === "Label" ? 48 : (lh ?? 24),
    );
    const m = resolveCollectionRowMetric({
      ...gridBase,
      entries: [gLabel, gDesc],
    });
    // content = 48 + 2 + 24 = 74 ; card = 24 + 74 = 98
    expect(m.rowHeight).toBe(98);
    expect(m.slotBlocks.label?.height).toBe(48);
    expect(m.slotBlocks.description?.y).toBe(12 + 48 + 2);
  });
});
