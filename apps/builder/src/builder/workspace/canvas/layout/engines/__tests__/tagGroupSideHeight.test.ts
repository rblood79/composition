/**
 * TagGroup labelPosition="side" 전체 height 산출 contract (2026-06-19).
 *
 * **배경 (버그)**: side 모드(컨테이너 row, Label 좌측 + TagList 우측)에서 TagGroup 전체
 *   height 가 top 과 동일(1줄)하게 고정 → 칩 2줄째가 selection 박스 밖으로 삐져나가는 버그.
 *   진짜 root cause = "Taffy 배치 ↔ calculateContentHeight 이중 메커니즘": TagList(items
 *   projection wrapper)가 enrich 시 컨테이너 전체 폭(Label 미차감)으로 칩 wrap 을 계산해
 *   1줄(28)로 무너지는 것. RAC 레퍼런스(`.react-aria-TagList { display:flex; flex-wrap }`,
 *   labelPosition/maxRows prop 의 존재 자체가 items wrapper 를 강제)대로, side 에서 TagList 는
 *   Label 자연폭을 차감한 폭에서 칩을 wrap 해야 한다(CheckboxGroup synthetic wrapper 와 동형).
 *
 * 본 테스트는 calculateContentHeight 의 taggroup 분기가:
 *  (a) side 모드: Label 자연폭 차감 → 좁아진 폭에서 칩이 더 많은 행으로 wrap → top 보다 큰 height
 *  (b) top 모드: 전체 폭에서 칩 wrap (세로 합산: Label + TagList)
 *  (c) side 의 비-Label 자식(TagList)에 (availableWidth − labelWidth − gap) 가 전달됨을 확증
 *      (좁은 폭일수록 행 수 증가 → height 단조 증가).
 *
 * Taffy 자식 폭 분배(fullTreeLayout traversePostOrder) + projection-only 컨테이너 height 보존
 *   (1-pass/2-pass)은 integration 영역이라 본 단위 테스트는 SSOT 인 calculateContentHeight 의
 *   side 차감 분기만 고정한다.
 */

import { describe, expect, it } from "vitest";
import { calculateContentHeight } from "../utils";
import type { Element } from "../../../../../../types/core/store.types";

type TagItem = { id: string; label: string };

const ITEMS: TagItem[] = [
  { id: "t1", label: "Chocolate" },
  { id: "t2", label: "Mint" },
  { id: "t3", label: "Strawberry" },
  { id: "t4", label: "Vanilla" },
];

const TAG_GROUP_ID = "tg-1";
const LABEL_ID = "tg-label";
const TAGLIST_ID = "tg-list";

function makeTagGroup(labelPosition: "top" | "side"): Element {
  return {
    id: TAG_GROUP_ID,
    type: "TagGroup",
    props: {
      label: "Tag Group",
      labelPosition,
      size: "md",
      items: ITEMS,
    },
    childrenIds: [LABEL_ID, TAGLIST_ID],
  } as Element;
}

const LABEL_CHILD: Element = {
  id: LABEL_ID,
  type: "Label",
  props: { children: "Tag Group", style: { whiteSpace: "nowrap" } },
  childrenIds: [],
} as Element;

const TAGLIST_CHILD: Element = {
  id: TAGLIST_ID,
  type: "TagList",
  props: { size: "md", items: ITEMS },
  childrenIds: [],
} as Element;

/** TagGroup 의 직속 자식(Label + TagList) 반환. */
function getChildElements(id: string): Element[] {
  if (id === TAG_GROUP_ID) return [LABEL_CHILD, TAGLIST_CHILD];
  return [];
}

describe("calculateContentHeight — TagGroup side label height", () => {
  it("side: Label 폭 차감으로 칩이 2줄 wrap → top(1줄)보다 큰 height", () => {
    const W = 350;
    const sideH = calculateContentHeight(
      makeTagGroup("side"),
      W,
      getChildElements(TAG_GROUP_ID),
      getChildElements,
    );
    const topH = calculateContentHeight(
      makeTagGroup("top"),
      W,
      getChildElements(TAG_GROUP_ID),
      getChildElements,
    );
    // side 는 TagList 가 (350 − Label폭 − gap) ≈ 269 에서 칩 2줄 → 행 높이 2배 수준,
    //   top 은 전체 폭 350 에서 칩 1줄 + Label 세로 합산. side 가 더 커야 한다(버그 시 동일).
    expect(sideH).toBeGreaterThan(topH);
  });

  it("side: availableWidth 가 좁아질수록 height 단조 증가(행 수 증가)", () => {
    const wide = calculateContentHeight(
      makeTagGroup("side"),
      400,
      getChildElements(TAG_GROUP_ID),
      getChildElements,
    );
    const narrow = calculateContentHeight(
      makeTagGroup("side"),
      250,
      getChildElements(TAG_GROUP_ID),
      getChildElements,
    );
    // 폭이 좁으면 같은 칩이 더 많은 행으로 wrap → height 증가(또는 동일). 역전되면 안 됨.
    expect(narrow).toBeGreaterThanOrEqual(wide);
  });

  it("side: 단일 행으로 끝나지 않음(전체 폭 그대로 넘겨 1줄 무너지는 버그 회귀 가드)", () => {
    // 버그 재현 조건: availableWidth 전체(350)를 TagList 에 그대로 넘기면 4칩이 1줄(28) →
    //   side height 가 top 의 세로 합산과 같아진다. Label 차감(229)이면 2줄.
    const W = 350;
    const sideH = calculateContentHeight(
      makeTagGroup("side"),
      W,
      getChildElements(TAG_GROUP_ID),
      getChildElements,
    );
    // TagList 단독(229 폭)이 2줄 height. side TagGroup 은 max(Label, TagList) 라 그 2줄 height
    //   이상이어야 한다. chip md: lineHeight + paddingY*2 + rowGap → 단일행 ~28, 2행 ~60.
    const tagListNarrow = calculateContentHeight(
      TAGLIST_CHILD,
      229,
      [],
      getChildElements,
    );
    const tagListWide = calculateContentHeight(
      TAGLIST_CHILD,
      350,
      [],
      getChildElements,
    );
    // 229 폭 TagList 가 350 폭보다 큰(더 많은 행) height → 차감이 실제 wrap 에 영향.
    expect(tagListNarrow).toBeGreaterThan(tagListWide);
    // side TagGroup height 는 좁은 TagList(2줄) 이상.
    expect(sideH).toBeGreaterThanOrEqual(tagListNarrow);
  });

  // ── 칩 border-box 높이 회귀 가드 (2026-06-19, selection 과대 버그) ───────────
  // **버그**: tagHeight = lineHeight + paddingY*2 (border 누락) → md 칩이 28 로 계산되어
  //   2줄 = 28*2 + gap4 = 60. 그러나 실제 Tag catalog shape(projection RowsGroup)는 CSS
  //   border 1px*2 포함 30 → 2줄 = 64. 이 4px 불일치가 Taffy 자식 합산 단계에서 TagGroup
  //   side height 를 84 로 발산시켜 selection/hover outline 이 실제 박스보다 20px 높게 잡혔다.
  // **수정**: tagHeight 에 borderWidth*2 반영 (28 → 30) → 2줄 = 64 (CSS 실측 정합).
  it("side: TagList 2줄 height = chip border-box(30) 기반 (border 누락 시 60, 정합 시 64)", () => {
    // 229 폭에서 4칩(md)이 2줄 wrap. 칩 border-box = lineHeight(20) + paddingY*2(8) +
    //   border*2(2) = 30. 2줄 = 30*2 + rowGap(4) = 64. border 누락 회귀 시 60 으로 떨어진다.
    const tagListTwoRow = calculateContentHeight(
      TAGLIST_CHILD,
      229,
      [],
      getChildElements,
    );
    // border 포함(30) 기반 2줄 = 64. border 누락(28) 회귀 시 60 → 이 테스트가 FAIL.
    expect(tagListTwoRow).toBe(64);
  });

  it("side: TagGroup 전체 height = max(Label, TagList 2줄) = 64 (selection 박스 정합)", () => {
    // side(row) 컨테이너 height SSOT = Math.max(Label 20, TagList 64) = 64.
    //   selection/hover outline 이 이 값을 그대로 mirror 하므로, 이 값이 CSS(64)와
    //   일치해야 selection 이 실제 박스를 정확히 감싼다(20px 과대 버그 회귀 가드).
    const sideH = calculateContentHeight(
      makeTagGroup("side"),
      350,
      getChildElements(TAG_GROUP_ID),
      getChildElements,
    );
    expect(sideH).toBe(64);
  });
});
