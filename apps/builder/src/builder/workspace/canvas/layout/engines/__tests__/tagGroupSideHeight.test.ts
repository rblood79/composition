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
import { calculateContentHeight, resolveTagWrapLayout } from "../utils";
import { computeTagRowsGroupFoldSkip } from "../fullTreeLayout";
import type { CanvasLayoutNode } from "../../layoutNode";
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

  // ── items SSOT: owner(TagGroup) vs stale mirror(TagList) 회귀 가드 (2026-07-01) ──
  // **버그**: items SSOT = TagGroup.props.items. TagList.props.items 는 mirror 로,
  //   propagation 이 PropertiesPanel onUpdate 경로로만 갱신돼 addItem 후 stale 할 수 있다
  //   (owner 7 개, mirror 4 개). CSS(propagation)/Skia chip projection(owner-first fallback)은
  //   owner 를 보는데, 이 taggroup height 분기가 TagList child 의 stale mirror items 로 wrap 을
  //   계산하면 행 수가 적게 나와(예: 4개→2줄) 실제 렌더(7개→3줄)보다 낮은 컨테이너 height →
  //   selection outline 이 마지막 칩 행 밖으로 삐져나간다(라이브 실측: side 64 vs CSS 98).
  // **수정**: taggroup 분기가 TagList child 에 owner(TagGroup) items 를 mirror 하여 계산.
  // 텍스트 측정 환경 의존을 피하려 절대 px 대신 3개 불변식으로 고정:
  //   (a) stale mirror(4) 여도 owner(7) 단독 계산과 동일 height (owner-first 적용 증명)
  //   (b) owner(7) height ≥ stale(4) height (칩 많으면 행 수 ≥, 단조)
  //   (c) 두 값이 실제로 다르다(회귀 시 stale 로 떨어지면 (a) FAIL).
  const OWNER_ITEMS: TagItem[] = [
    { id: "t1", label: "Chocolate" },
    { id: "t2", label: "VanillaCo" },
    { id: "t3", label: "New Tag" },
    { id: "t4", label: "New Tag" },
    { id: "t5", label: "New Tag" },
    { id: "t6", label: "New Tag" },
    { id: "t7", label: "New Tag" },
  ];
  const LONG_LABEL: Element = {
    id: LABEL_ID,
    type: "Label",
    props: { children: "Tag Group22", style: { whiteSpace: "nowrap" } },
    childrenIds: [],
  } as Element;
  const W = 390;

  function makeOwnerTagGroup(): Element {
    return {
      id: TAG_GROUP_ID,
      type: "TagGroup",
      props: {
        label: "Tag Group22",
        labelPosition: "side",
        size: "md",
        items: OWNER_ITEMS,
      },
      childrenIds: [LABEL_ID, TAGLIST_ID],
    } as Element;
  }
  const getChildrenWithMirror =
    (mirrorCount: number) =>
    (id: string): Element[] =>
      id === TAG_GROUP_ID
        ? [
            LONG_LABEL,
            {
              id: TAGLIST_ID,
              type: "TagList",
              props: { size: "md", items: OWNER_ITEMS.slice(0, mirrorCount) },
              childrenIds: [],
            } as Element,
          ]
        : [];

  it("side: TagList mirror 가 stale(4)여도 owner(TagGroup) items(7) 로 height 산출", () => {
    const getStale4 = getChildrenWithMirror(4);
    const getFresh7 = getChildrenWithMirror(7);

    // owner mirror 미적용 회귀 시 stale 4 개 wrap → 낮은 height. 적용 시 owner 7 개 wrap.
    const heightStaleMirror = calculateContentHeight(
      makeOwnerTagGroup(),
      W,
      getStale4(TAG_GROUP_ID),
      getStale4,
    );
    const heightFreshMirror = calculateContentHeight(
      makeOwnerTagGroup(),
      W,
      getFresh7(TAG_GROUP_ID),
      getFresh7,
    );

    // (a) stale mirror(4) 여도 fresh mirror(7)와 동일 — owner-first 적용 증명.
    expect(heightStaleMirror).toBe(heightFreshMirror);

    // (c) 두 items 수가 실제로 다른 행 수를 낳는지 확인(테스트가 tautology 아님):
    //   TagList 단독 계산은 owner-first 미적용이라 mirror items 그대로 → 4 vs 7 이 달라야 함.
    const sideAvail = W; // 근사 — 정확한 sideTagListAvail 아니어도 4≠7 행 수 차이 확인용
    const tagList4 = calculateContentHeight(
      {
        id: TAGLIST_ID,
        type: "TagList",
        props: { size: "md", items: OWNER_ITEMS.slice(0, 4) },
        childrenIds: [],
      } as Element,
      sideAvail - 92,
      [],
      () => [],
    );
    const tagList7 = calculateContentHeight(
      {
        id: TAGLIST_ID,
        type: "TagList",
        props: { size: "md", items: OWNER_ITEMS },
        childrenIds: [],
      } as Element,
      sideAvail - 92,
      [],
      () => [],
    );
    // (b) owner(7) 단독 ≥ stale(4) 단독 (칩 많으면 행 수 증가).
    expect(tagList7).toBeGreaterThan(tagList4);
  });
});

// ── resolveTagWrapLayout SSOT (maxRows 접힘, 2026-07-01) ──────────────────
// wrap 시뮬레이션 단일 resolver — calculateContentHeight(height) + Skia chip render skip
//   (visibleItemCount) 공유. jsdom 텍스트 측정은 근사라 절대 개수 대신 불변식으로 고정.
describe("resolveTagWrapLayout — maxRows chip 접힘 SSOT", () => {
  const MANY: TagItem[] = Array.from({ length: 13 }, (_, i) => ({
    id: `t${i}`,
    label: i < 2 ? ["Chocolate", "VanillaCo"][i] : "New Tag",
  }));

  it("maxRows=0 이면 전체 표시 (접힘 없음)", () => {
    const r = resolveTagWrapLayout({
      items: MANY,
      containerWidth: 350,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 0,
    });
    expect(r.visibleItemCount).toBe(13);
    expect(r.shouldShowAll).toBe(false);
  });

  it("maxRows 설정 + 폭 초과 시 접힘 (visibleItemCount < 전체, shouldShowAll)", () => {
    const r = resolveTagWrapLayout({
      items: MANY,
      containerWidth: 350,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 2,
    });
    // 350 폭에서 13개는 2줄 초과 → 접힘.
    expect(r.visibleItemCount).toBeLessThan(13);
    expect(r.shouldShowAll).toBe(true);
    expect(r.rowCount).toBe(2); // maxRows 만큼 배치
  });

  it("maxRows 증가 → visibleItemCount 단조 증가 (더 많은 chip 표시)", () => {
    const at2 = resolveTagWrapLayout({
      items: MANY,
      containerWidth: 350,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 2,
    }).visibleItemCount;
    const at3 = resolveTagWrapLayout({
      items: MANY,
      containerWidth: 350,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 3,
    }).visibleItemCount;
    expect(at3).toBeGreaterThanOrEqual(at2);
  });

  it("좁은 폭 → 같은 maxRows 에서 visibleItemCount 감소 (행당 chip 적음)", () => {
    const wide = resolveTagWrapLayout({
      items: MANY,
      containerWidth: 400,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 2,
    }).visibleItemCount;
    const narrow = resolveTagWrapLayout({
      items: MANY,
      containerWidth: 200,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 2,
    }).visibleItemCount;
    expect(narrow).toBeLessThanOrEqual(wide);
  });

  it("contentHeight = calculateContentHeight taglist 분기와 동일 (SSOT 공유)", () => {
    // TagList element 로 calculateContentHeight 호출 → 동일 resolver 경유.
    const tagList: Element = {
      id: "tl",
      type: "TagList",
      props: { size: "md", items: MANY, maxRows: 2 },
      childrenIds: [],
    } as Element;
    const viaCalc = calculateContentHeight(tagList, 350, [], () => []);
    const viaResolver = resolveTagWrapLayout({
      items: MANY,
      containerWidth: 350,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 2,
    }).contentHeight;
    expect(viaCalc).toBe(viaResolver);
  });
});

// ── computeTagRowsGroupFoldSkip — layout Taffy 트리 chip 제외 (2026-07-01) ──
//
// Show all 위치 버그 최종층: projection chip 이 Taffy 에 9개 전부 실려 RowsGroup 실배치를
// 밀어내(Show all 이 TagGroup 영역 밖) → layout 단계에서 초과 chip 을 Taffy 자식 목록에서
// 제외해야 한다. 본 헬퍼가 그 skip set 을 계산한다(render skip 게이트와 동일 resolver).
describe("computeTagRowsGroupFoldSkip — layout chip 제외 (owner-first)", () => {
  const OWNER_TG = "owner-tg";
  const TL = "tl";
  const ROWS = "tag::tl::-rows:tl"; // -rows: 포함(projection RowsGroup id 형식)

  // 9 item 라벨(폭 확보용 긴 라벨 포함).
  const NINE: Array<{ label: string }> = [
    { label: "Chocolate" },
    { label: "VanillaCo" },
    { label: "New Tag" },
    { label: "New Tag" },
    { label: "New Tag" },
    { label: "New Tag" },
    { label: "New Tag" },
    { label: "New Tag" },
    { label: "New Tag" },
  ];

  /** owner TagGroup items(NINE) SSOT, TagList mirror 는 stale(4개)로 세팅. */
  function buildElementsMap(opts: {
    maxRows: number;
    tagListItems?: Array<{ label: string }>;
  }): {
    elementsMap: Map<string, CanvasLayoutNode>;
    rowsNode: CanvasLayoutNode;
    chipIds: string[];
    showAllId: string;
  } {
    const chipIds = NINE.map((_, i) => `chip-${i}`);
    const showAllId = "chip-showall";
    const rowsNode: CanvasLayoutNode = {
      id: ROWS,
      type: "Rows",
      parent_id: TL,
      props: {},
    };
    // projection.kind 는 CanvasLayoutNode 타입에 없으나 runtime scene node 에 존재.
    (rowsNode as { projection?: { kind: string } }).projection = {
      kind: "tag-rows",
    };
    const em = new Map<string, CanvasLayoutNode>();
    em.set(OWNER_TG, {
      id: OWNER_TG,
      type: "TagGroup",
      parent_id: null,
      props: { items: NINE, maxRows: opts.maxRows, size: "md" },
    });
    em.set(TL, {
      id: TL,
      type: "TagList",
      parent_id: OWNER_TG,
      // TagList mirror 는 stale(4개) — owner-first 검증용.
      props: { items: opts.tagListItems ?? NINE.slice(0, 4), size: "md" },
    });
    em.set(ROWS, rowsNode);
    chipIds.forEach((id, i) => {
      em.set(id, {
        id,
        type: "Tag",
        parent_id: ROWS,
        props: { children: NINE[i].label },
      });
    });
    em.set(showAllId, {
      id: showAllId,
      type: "Tag",
      parent_id: ROWS,
      props: { children: `Show all (${NINE.length})`, _isShowAll: true },
    });
    return { elementsMap: em, rowsNode, chipIds, showAllId };
  }

  it("maxRows=1: 초과 chip skip, Show all + visible chip 은 유지", () => {
    const { elementsMap, rowsNode, chipIds, showAllId } = buildElementsMap({
      maxRows: 1,
    });
    const sorted = [...chipIds, showAllId];
    const skip = computeTagRowsGroupFoldSkip(
      ROWS,
      rowsNode,
      sorted,
      elementsMap,
      350, // RowsGroup 폭
    );
    expect(skip).not.toBeNull();
    // 1줄에 들어가는 만큼만 visible → 나머지 chip skip.
    const { visibleItemCount } = resolveTagWrapLayout({
      items: NINE,
      containerWidth: 350,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 1,
    });
    expect(visibleItemCount).toBeGreaterThan(0);
    expect(visibleItemCount).toBeLessThan(NINE.length);
    // skip 대상 = visibleItemCount 이상 index chip.
    for (let i = 0; i < NINE.length; i++) {
      if (i < visibleItemCount) {
        expect(skip!.has(chipIds[i])).toBe(false);
      } else {
        expect(skip!.has(chipIds[i])).toBe(true);
      }
    }
    // Show all chip 은 절대 skip 안 됨(마지막 visible 다음 배치).
    expect(skip!.has(showAllId)).toBe(false);
  });

  it("owner-first: TagList mirror 가 stale(4개)여도 owner items(9) 로 접힘 계산", () => {
    // TagList.items=4(stale)로도 owner TagGroup items=9 를 사용 → 초과 chip skip 발생.
    const { elementsMap, rowsNode, chipIds, showAllId } = buildElementsMap({
      maxRows: 1,
      tagListItems: NINE.slice(0, 4),
    });
    const sorted = [...chipIds, showAllId];
    const skip = computeTagRowsGroupFoldSkip(
      ROWS,
      rowsNode,
      sorted,
      elementsMap,
      350,
    );
    // owner 9 items 기준으로 skip 이 발생해야 함(stale 4 였다면 접힘 없음 → null).
    expect(skip).not.toBeNull();
    expect(skip!.size).toBeGreaterThan(0);
  });

  it("maxRows=0: 접힘 없음 → null", () => {
    const { elementsMap, rowsNode, chipIds, showAllId } = buildElementsMap({
      maxRows: 0,
    });
    const sorted = [...chipIds, showAllId];
    const skip = computeTagRowsGroupFoldSkip(
      ROWS,
      rowsNode,
      sorted,
      elementsMap,
      350,
    );
    expect(skip).toBeNull();
  });

  it("비-RowsGroup(id 에 -rows: 없음) → null (대상 아님)", () => {
    const { elementsMap, chipIds, showAllId } = buildElementsMap({
      maxRows: 1,
    });
    const notRows: CanvasLayoutNode = {
      id: "some-container",
      type: "Rows",
      parent_id: TL,
      props: {},
    };
    const skip = computeTagRowsGroupFoldSkip(
      "some-container",
      notRows,
      [...chipIds, showAllId],
      elementsMap,
      350,
    );
    expect(skip).toBeNull();
  });

  it("좁은 폭 → 더 많은 chip skip (단조성)", () => {
    const { elementsMap, rowsNode, chipIds, showAllId } = buildElementsMap({
      maxRows: 1,
    });
    const sorted = [...chipIds, showAllId];
    const wide = computeTagRowsGroupFoldSkip(
      ROWS,
      rowsNode,
      sorted,
      elementsMap,
      500,
    );
    const narrow = computeTagRowsGroupFoldSkip(
      ROWS,
      rowsNode,
      sorted,
      elementsMap,
      200,
    );
    // 좁을수록 1줄에 들어가는 chip 이 적음 → skip 이 더 많음(또는 같음).
    const wideSkip = wide?.size ?? 0;
    const narrowSkip = narrow?.size ?? 0;
    expect(narrowSkip).toBeGreaterThanOrEqual(wideSkip);
  });
});
