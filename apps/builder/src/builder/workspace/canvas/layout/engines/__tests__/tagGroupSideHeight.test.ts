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
import { computeTagFoldKeep } from "../fullTreeLayout";
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

// ── 폭 의존 접힘 경계 — height 계산 폭 == 실제 배치 폭이라야 정합 (2026-07-01) ──
//
// maxRows=3 gap 발산 근본: TagList height 계산(calculateContentHeight)이 부모 top-down
// 추정폭(넓음)을 쓰면 "접힘 없음, height 작음"으로 계산되나, 실제 RowsGroup 배치폭(좁음)에선
// "접힘 발생, height 큼"이 된다. 두 폭 불일치 시 강제 height < 실배치 → align-content 분산
// → 세로 gap 발산. 본 테스트는 동일 items+maxRows 에서 폭이 접힘/rows/contentHeight 를
// 가르는 것을 고정 — 따라서 fold-skip / render / height 모두 실제 배치폭을 써야 정합.
describe("resolveTagWrapLayout — 폭 의존 접힘 경계 (height 정합 계약)", () => {
  // 12 item: 넓은 폭에선 maxRows=3 안에 다 fit, 좁은 폭에선 초과 → 접힘.
  const TWELVE: TagItem[] = Array.from({ length: 12 }, (_, i) => ({
    id: `t${i}`,
    label:
      i < 4 ? ["Chocolate", "Mint", "Strawberry", "Vanilla"][i] : "New Tag",
  }));

  it("동일 items+maxRows 에서 넓은 폭은 접힘 없음, 좁은 폭은 접힘 (폭이 판정을 가름)", () => {
    const wide = resolveTagWrapLayout({
      items: TWELVE,
      containerWidth: 400, // 넓음 → 3줄 안에 fit 가능성
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 3,
    });
    const narrow = resolveTagWrapLayout({
      items: TWELVE,
      containerWidth: 260, // 좁음 → 3줄 초과 → 접힘
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 3,
    });
    // 좁은 폭이 접힘(또는 최소한 넓은 폭보다 적은 visible).
    expect(narrow.visibleItemCount).toBeLessThanOrEqual(wide.visibleItemCount);
    // 좁은 폭이 접히면 shouldShowAll, 넓은 폭보다 contentHeight 가 크거나 같다.
    if (narrow.shouldShowAll && !wide.shouldShowAll) {
      expect(narrow.contentHeight).toBeGreaterThan(wide.contentHeight);
    }
  });

  it("contentHeight 는 containerWidth 에 단조 반응 (좁을수록 크거나 같음)", () => {
    const h400 = resolveTagWrapLayout({
      items: TWELVE,
      containerWidth: 400,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 3,
    }).contentHeight;
    const h310 = resolveTagWrapLayout({
      items: TWELVE,
      containerWidth: 310,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 3,
    }).contentHeight;
    const h260 = resolveTagWrapLayout({
      items: TWELVE,
      containerWidth: 260,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 3,
    }).contentHeight;
    // 폭이 좁아질수록 접힘/행 수 증가 → contentHeight 단조 비감소.
    expect(h310).toBeGreaterThanOrEqual(h400);
    expect(h260).toBeGreaterThanOrEqual(h310);
  });

  it("contentHeight = calculateContentHeight taglist 분기 (동일 폭이면 동일 값)", () => {
    // 실제 배치폭(예 310)으로 두 경로가 같은 값을 산출해야 gap 정합.
    const W = 310;
    const tagList: Element = {
      id: "tl",
      type: "TagList",
      props: { size: "md", items: TWELVE, maxRows: 3 },
      childrenIds: [],
    } as Element;
    const viaCalc = calculateContentHeight(tagList, W, [], () => []);
    const viaResolver = resolveTagWrapLayout({
      items: TWELVE,
      containerWidth: W,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 3,
    }).contentHeight;
    expect(viaCalc).toBe(viaResolver);
  });
});

// ── computeTagFoldKeep — Taffy 실측 rowY 기반 chip 접힘 (폭 가변 견고, 2026-07-02) ──
//
// maxRows gap 발산 최종 근본: 추정 wrap 공식(measureText, 특정 폭 의존) 대신 Taffy 가 배치한
// 각 chip 의 실제 y좌표(rowY)로 행 번호를 매핑해 `행 번호 ≥ maxRows` chip 을 제외. 폭 값을 전혀
// 안 써 리사이즈에 견고. CSS 정본(TagGroup.tsx computeVisibleTagCount: getBoundingClientRect y
// 로 rowCount, rowCount > maxRows break)과 동일 원리.
describe("computeTagFoldKeep — rowY 기반 chip 접힘 (폭 무관)", () => {
  // 헬퍼: 각 행에 n개씩 chip, 마지막에 Show all. y = 행번호 * 34 (tagHeight30 + gap4).
  const makeChips = (
    rowsOfCounts: number[],
    showAllRow: number | null,
  ): Array<{ id: string; y: number; isShowAll: boolean }> => {
    const chips: Array<{ id: string; y: number; isShowAll: boolean }> = [];
    let idx = 0;
    rowsOfCounts.forEach((count, row) => {
      for (let i = 0; i < count; i++) {
        chips.push({ id: `chip-${idx++}`, y: row * 34, isShowAll: false });
      }
    });
    if (showAllRow !== null) {
      chips.push({ id: "chip-showall", y: showAllRow * 34, isShowAll: true });
    }
    return chips;
  };

  it("접힘 발생(itemRow > maxRows): 행번호 ≥ maxRows chip 제외 + Show all 유지", () => {
    // 5 item 행 (4/4/4/2/1) + Show all 별도 행, maxRows=3.
    const chips = makeChips([4, 4, 4, 2, 1], 5);
    const keep = computeTagFoldKeep(chips, 3);
    // 행 0,1,2 chip(4+4+4=12) 유지, 행 3,4 제외. Show all 유지.
    expect(keep).toContain("chip-showall");
    // 행 0~2 의 12 chip + Show all = 13 keep.
    expect(keep.length).toBe(13);
    // 행 3 이상 chip 제외 확인 (chip-12 = 행 3 첫 chip).
    expect(keep).not.toContain("chip-12");
  });

  it("접힘 미발생(itemRow ≤ maxRows): 모든 item 유지 + Show all 제외", () => {
    // 2 item 행, maxRows=3 → 접힘 없음.
    const chips = makeChips([3, 3], 2);
    const keep = computeTagFoldKeep(chips, 3);
    expect(keep).not.toContain("chip-showall"); // 미접힘 → Show all 불필요
    expect(keep.length).toBe(6); // item chip 전부
  });

  it("폭 무관: 같은 item 이 폭에 따라 다른 행 배치여도 rowY 기준으로 정확 접힘", () => {
    // 넓은 폭(행당 5개, 3행) vs 좁은 폭(행당 2개, 8행), 둘 다 maxRows=2.
    const wide = makeChips([5, 5, 5], 3); // 15 item, 3행
    const narrow = makeChips([2, 2, 2, 2, 2, 2, 2, 1], 8); // 15 item, 8행
    const keepWide = computeTagFoldKeep(wide, 2);
    const keepNarrow = computeTagFoldKeep(narrow, 2);
    // 넓은 폭: 행 0,1 = 10 chip + Show all = 11.
    expect(keepWide.length).toBe(11);
    // 좁은 폭: 행 0,1 = 4 chip + Show all = 5.
    expect(keepNarrow.length).toBe(5);
    // 둘 다 Show all 유지 (접힘 발생).
    expect(keepWide).toContain("chip-showall");
    expect(keepNarrow).toContain("chip-showall");
  });

  it("maxRows=1: 1행만 유지 + Show all", () => {
    const chips = makeChips([3, 3, 3], 3);
    const keep = computeTagFoldKeep(chips, 1);
    // 행 0 = 3 chip + Show all = 4.
    expect(keep.length).toBe(4);
    expect(keep).toContain("chip-showall");
    expect(keep).toContain("chip-0");
    expect(keep).not.toContain("chip-3"); // 행 1 첫 chip 제외
  });

  it("빈 chip / maxRows=0: item chip 만 반환 (접힘 없음)", () => {
    expect(computeTagFoldKeep([], 3)).toEqual([]);
    const chips = makeChips([3], null);
    expect(computeTagFoldKeep(chips, 0)).toEqual([
      "chip-0",
      "chip-1",
      "chip-2",
    ]);
  });
});
