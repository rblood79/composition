// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { ensureReusableCompositeOrigins } from "../../../components/reusableCompositeOrigins";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "../../../components/templateItemOriginIds";
import {
  toCollectionRowProjectionId,
  toCollectionRowsGroupProjectionId,
} from "../../../projection/renderProjectionIds";
import { resolveVirtualizedCollectionWindows } from "./collectionVirtualization";
import {
  __resetExpandedCardHeightsForTest,
  anchorScrollTop,
  getExpandedCardHeightsVersion,
  harvestExpandedCardHeights,
  noteExpandedCardWindow,
  resolveExpandedCardHeights,
  type ExpandedCardPlanInput,
  type ExpandedCardScrollAccess,
} from "./expandedCardHeights";

/**
 * ADR-162 Phase 4 — 펼친 GridList 카드의 실측 · 추정 행 높이를 ADR-150 행 offset 함수에 공급한다.
 * layout 실측 (window 카드 상자) → 캐시 → 시각 행 높이 목록 → window · spacer · maxScrollTop, 그리고 교체 때
 * scroll anchoring (끝 고정 · 화면 첫 행 고정) · 진동 0 · 템플릿 / 폭 / 행 데이터 변경 무효화.
 */

const OWNER = "p4-gl";
const ROWS = 40;
const COLUMNS = 2;
const VIEWPORT = 300;

function makeDoc(options: { withImage?: boolean; imageHeight?: number } = {}) {
  const items = Array.from({ length: ROWS }, (_, i) => ({
    id: `r${i}`,
    label: `Row ${i}`,
    description: `desc ${i}`,
  }));
  const doc = ensureReusableCompositeOrigins({
    version: "composition-1.0",
    children: [
      {
        id: "page-home",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
        children: [
          {
            id: "body-home",
            type: "body" as CanonicalNode["type"],
            children: [
              {
                id: OWNER,
                type: "GridList",
                dataBinding: {
                  type: "collection",
                  source: "static",
                  config: { data: items },
                },
                props: {
                  columns: COLUMNS,
                  style: {
                    width: "400px",
                    height: `${VIEWPORT}px`,
                    overflow: "auto",
                  },
                },
              },
            ] as unknown as CanonicalNode[],
          },
        ],
      },
    ],
  } as CompositionDocument);
  if (options.withImage !== false) {
    const find = (
      nodes: readonly CanonicalNode[],
    ): CanonicalNode | undefined => {
      for (const n of nodes) {
        if (n.id === GRIDLIST_ITEM_DEFAULT_ORIGIN_ID) return n;
        const hit = find(n.children ?? []);
        if (hit) return hit;
      }
      return undefined;
    };
    const origin = find(doc.children)!;
    origin.children = [
      ...(origin.children ?? []),
      {
        id: "p4-image",
        type: "Image",
        props: {
          style: { width: "48px", height: `${options.imageHeight ?? 48}px` },
        },
      } as unknown as CanonicalNode,
    ];
  }
  return doc;
}

// production 은 collections 배열을 memo 로 유지한다 — 같은 참조여야 plan 캐시가 적중한다.
const COLLECTIONS: [] = [];

function resolve(doc: CompositionDocument, scrollTop: number) {
  return resolveVirtualizedCollectionWindows({
    doc,
    collections: COLLECTIONS,
    scrollTops: new Map([[OWNER, scrollTop]]),
  }).get(OWNER)!;
}

/** window 카드마다 높이 `heightOf(i)` 인 가짜 layout map. */
function layoutFor(
  window: { startIndex: number; endIndex: number },
  heightOf: (i: number) => number,
  ownerWidth = 400,
) {
  const map = new Map<string, { width: number; height: number }>();
  map.set(OWNER, { width: ownerWidth, height: VIEWPORT });
  for (let i = window.startIndex; i < window.endIndex; i += 1) {
    map.set(toCollectionRowProjectionId("gridlist", OWNER, `r${i}`), {
      width: 194,
      height: heightOf(i),
    });
  }
  return map;
}

function scrollStub(initial = 0) {
  const state = { scrollTop: initial, maxScrollTop: Infinity };
  const access: ExpandedCardScrollAccess = {
    get: () => ({ scrollTop: state.scrollTop }),
    apply: (_id, max, top) => {
      state.maxScrollTop = max;
      state.scrollTop = top;
    },
  };
  return { state, access };
}

beforeEach(() => __resetExpandedCardHeightsForTest());

describe("ADR-162 Phase 4 — 펼친 카드 실측 → 행 offset 함수", () => {
  it("실측 전 = 공식 추정, 수확 뒤 = 실측 카드 높이로 행 영역 · maxScrollTop · window 를 다시 낸다", () => {
    const doc = makeDoc();
    const before = resolve(doc, 0);
    const formulaRows = before.rowsExtent!;
    const visualRows = ROWS / COLUMNS;

    const { access } = scrollStub(0);
    expect(
      harvestExpandedCardHeights(
        layoutFor(before.window, () => 126),
        access,
      ),
    ).toBe(true);
    const after = resolve(doc, 0);
    // 실측 126 · 추정 = 첫 실측 126 → 모든 시각 행 126, gap 12.
    expect(after.rowsExtent).toBe(visualRows * 126 + (visualRows - 1) * 12);
    expect(after.rowsExtent).toBeGreaterThan(formulaRows);
    expect(after.maxScrollTop).toBe(after.contentHeight! - VIEWPORT);
    // 카드가 커져 같은 viewport 에 시각 행이 덜 들어간다.
    expect(after.window.endIndex).toBeLessThanOrEqual(before.window.endIndex);
  });

  it("행마다 다른 실측 — 시각 행 높이 = 그 행 카드 중 최대", () => {
    const doc = makeDoc();
    const w = resolve(doc, 0).window;
    // 카드 0 = 100 · 카드 1 = 150 (같은 시각 행) · 나머지 120.
    harvestExpandedCardHeights(
      layoutFor(w, (i) => (i === 0 ? 100 : i === 1 ? 150 : 120)),
      scrollStub().access,
    );
    const after = resolve(doc, 0);
    expect(after.leadSpacerHeight).toBe(0);
    // 첫 시각 행 150, 나머지 실측 120 · 미측정 추정 = 첫 실측 (카드 0 = 100) — 합으로 확인.
    const measuredVisual = Math.ceil((w.endIndex - w.startIndex) / COLUMNS);
    const rest = ROWS / COLUMNS - measuredVisual;
    expect(after.rowsExtent).toBe(
      150 + (measuredVisual - 1) * 120 + rest * 100 + (ROWS / COLUMNS - 1) * 12,
    );
  });

  it("같은 값 재수확은 변화 없음 (진동 0) · 같은 스크롤 위치 연속 resolve 는 같은 window · offset", () => {
    const doc = makeDoc();
    const w = resolve(doc, 0).window;
    const { access } = scrollStub();
    harvestExpandedCardHeights(
      layoutFor(w, () => 126),
      access,
    );
    const v = getExpandedCardHeightsVersion();
    expect(
      harvestExpandedCardHeights(
        layoutFor(w, () => 126),
        access,
      ),
    ).toBe(false);
    expect(getExpandedCardHeightsVersion()).toBe(v);
    const a = resolve(doc, 500);
    const b = resolve(doc, 500);
    expect([a.window, a.leadSpacerHeight, a.maxScrollTop]).toEqual([
      b.window,
      b.leadSpacerHeight,
      b.maxScrollTop,
    ]);
  });

  it("origin 편집 (템플릿 서명) · owner 폭 변경 · 행 데이터 변경은 실측을 버린다", () => {
    const doc = makeDoc();
    const w = resolve(doc, 0).window;
    const { access } = scrollStub();
    harvestExpandedCardHeights(
      layoutFor(w, () => 126),
      access,
    );
    const measured = resolve(doc, 0).rowsExtent;

    // 템플릿 변경 — Image 높이 80 → 서명이 달라 공식 추정으로 돌아간다.
    const edited = makeDoc({ imageHeight: 80 });
    expect(resolve(edited, 0).rowsExtent).not.toBe(measured);

    // 폭 변경 — 같은 문서, owner 폭 300 으로 수확하면 이전 실측을 버리고 새 값 (140) 을 쓴다.
    __resetExpandedCardHeightsForTest();
    resolve(doc, 0);
    harvestExpandedCardHeights(
      layoutFor(w, () => 126),
      access,
    );
    harvestExpandedCardHeights(
      layoutFor(w, () => 140, 300),
      access,
    );
    const visualRows = ROWS / COLUMNS;
    expect(resolve(doc, 0).rowsExtent).toBe(
      visualRows * 140 + (visualRows - 1) * 12,
    );
  });

  it("scroll anchoring — 중간이면 화면 첫 시각 행의 화면 y 고정, 끝이면 새 끝", () => {
    const plan = {
      gap: 12,
      leadingExtent: 0,
      trailingExtent: 0,
      viewportHeight: 300,
    };
    const oldVisual = Array.from({ length: 20 }, () => 76);
    // 앞 5 행이 126 으로 실측 교체 — scrollTop 600 (행 6 부근) 의 기준 행 top 이 5×50 = 250 내려간다.
    const newVisual = oldVisual.map((h, i) => (i < 5 ? 126 : h));
    const mid = anchorScrollTop(plan, oldVisual, newVisual, 600);
    expect(mid.scrollTop).toBe(850);
    // 끝 — oldMax = 20×76 + 19×12 − 300 = 1448 → 새 끝으로.
    const end = anchorScrollTop(plan, oldVisual, newVisual, 1448);
    expect(end.scrollTop).toBe(end.maxScrollTop);
    expect(end.maxScrollTop).toBe(1448 + 250);
  });

  it("펼침 → 접힘 (origin 에서 Image 제거) 뒤 남은 entry 로 수확하지 않는다 — maxScrollTop 을 덮지 않음", () => {
    const expandedDoc = makeDoc();
    const w = resolve(expandedDoc, 0).window;
    const { state, access } = scrollStub(0);
    harvestExpandedCardHeights(
      layoutFor(w, () => 126),
      access,
    );
    const collapsedDoc = makeDoc({ withImage: false });
    const collapsed = resolve(collapsedDoc, 0);
    state.maxScrollTop = collapsed.maxScrollTop!;
    // 접힌 카드도 같은 projection id — layout 이 공식 높이로 publish 된다.
    expect(
      harvestExpandedCardHeights(
        layoutFor(collapsed.window, () => 76),
        access,
      ),
    ).toBe(false);
    expect(state.maxScrollTop).toBe(collapsed.maxScrollTop);
  });

  it("slot-only 카드: 실측 = 공식이면 변화 0, 줄바꿈된 카드만 실측으로 바꾸고 안 본 카드는 공식 (ADR-150 후속 R1)", () => {
    const doc = makeDoc({ withImage: false });
    const before = resolve(doc, 0);
    const formula = before.rowHeight!;
    // 줄바꿈 없음 — layout 이 공식 높이를 주면 캐시만 채우고 version · 행 위치는 그대로.
    expect(
      harvestExpandedCardHeights(
        layoutFor(before.window, () => formula),
        scrollStub().access,
      ),
    ).toBe(false);
    expect(resolve(doc, 0).rowsExtent).toBe(before.rowsExtent);
    // 카드 r0 만 두 줄 (+24) — 그 시각 행만 늘고, 안 본 카드는 첫 실측이 아니라 공식 그대로.
    const { access } = scrollStub(0);
    expect(
      harvestExpandedCardHeights(
        layoutFor(before.window, (i) => (i === 0 ? formula + 24 : formula)),
        access,
      ),
    ).toBe(true);
    const after = resolve(doc, 0);
    expect(after.rowsExtent).toBe(before.rowsExtent! + 24);
  });

  it("ListBox 행: 줄바꿈된 행만 실측으로 바뀌고 window · 스크롤 범위가 그 높이를 읽는다 (ADR-150 후속 R1)", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      id: `k${i}`,
      label: `Row ${i}`,
    }));
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
          children: [
            {
              id: "body-home",
              type: "body",
              children: [
                {
                  id: "r1-lb",
                  type: "ListBox",
                  dataBinding: {
                    type: "collection",
                    source: "static",
                    config: { data: items },
                  },
                  props: {
                    style: {
                      width: "200px",
                      height: "300px",
                      overflow: "auto",
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
    const read = () =>
      resolveVirtualizedCollectionWindows({
        doc,
        collections: COLLECTIONS,
        scrollTops: new Map([["r1-lb", 0]]),
      }).get("r1-lb")!;
    const before = read();
    const map = new Map<string, { width: number; height: number }>();
    map.set("r1-lb", { width: 200, height: 300 });
    for (let i = before.window.startIndex; i < before.window.endIndex; i += 1) {
      map.set(toCollectionRowProjectionId("listbox", "r1-lb", `k${i}`), {
        width: 190,
        height: i % 3 === 0 ? 104 : before.rowHeight!,
      });
    }
    const { state, access } = scrollStub(0);
    expect(harvestExpandedCardHeights(map, access)).toBe(true);
    const after = read();
    const wrapped = Math.ceil(
      (before.window.endIndex - before.window.startIndex) / 3,
    );
    expect(after.rowsExtent).toBe(
      before.rowsExtent! + wrapped * (104 - before.rowHeight!),
    );
    expect(after.maxScrollTop).toBe(state.maxScrollTop);
  });
});

describe("ADR-150 후속 R1 판독 — 실측의 측정 조건 (템플릿 · 행 폭 · 공식값)", () => {
  const KEYS = Array.from({ length: 30 }, (_, i) => `k${i}`);
  const ITEMS = KEYS.map((key) => ({ id: key }));
  const LABEL_A = { text: "{label}" };
  const LABEL_B = { text: "{id}" };
  const planOf = (
    over: Partial<ExpandedCardPlanInput> = {},
  ): ExpandedCardPlanInput => ({
    ownerId: "lb",
    family: "listbox",
    estimate: "formula",
    templateSig: "sig",
    templateRefs: [LABEL_A],
    itemKeys: KEYS,
    items: ITEMS,
    formulaCardHeights: KEYS.map(() => 32),
    columns: 1,
    gap: 0,
    leadingExtent: 0,
    trailingExtent: 0,
    viewportHeight: 0,
    ...over,
  });
  const layout = (
    from: number,
    to: number,
    height: (i: number) => number,
    rowWidth = 190,
  ) => {
    const map = new Map<string, { width: number; height: number }>();
    map.set("lb", { width: 200, height: 300 });
    // 행 묶음 = owner content box (행 가용 폭).
    map.set(toCollectionRowsGroupProjectionId("listbox", "lb"), {
      width: rowWidth + 2,
      height: 300,
    });
    for (let i = from; i < to; i += 1) {
      map.set(toCollectionRowProjectionId("listbox", "lb", `k${i}`), {
        width: rowWidth,
        height: height(i),
      });
    }
    return map;
  };
  /** k0 을 104 로 실측한 뒤 window 를 k20 ~ k30 으로 옮긴 상태 (k0 은 화면 밖). */
  const measureK0ThenScrollAway = () => {
    resolveExpandedCardHeights(planOf());
    noteExpandedCardWindow("lb", { startIndex: 0, endIndex: 10 }, 300);
    harvestExpandedCardHeights(
      layout(0, 10, (i) => (i === 0 ? 104 : 32)),
      scrollStub().access,
    );
    expect(resolveExpandedCardHeights(planOf())[0]).toBe(104);
    noteExpandedCardWindow("lb", { startIndex: 20, endIndex: 30 }, 300);
  };

  it("M1 — 템플릿 원문이 바뀌면 (컴파일 참조 교체) 화면 밖 실측도 버린다", () => {
    measureK0ThenScrollAway();
    expect(
      resolveExpandedCardHeights(planOf({ templateRefs: [LABEL_B] }))[0],
    ).toBe(32);
  });

  it("M2 — 행 가용 폭이 바뀌면 (padding · 열 수) 화면 밖 실측도 버린다", () => {
    measureK0ThenScrollAway();
    harvestExpandedCardHeights(
      layout(20, 30, () => 32, 150),
      scrollStub().access,
    );
    expect(resolveExpandedCardHeights(planOf())[0]).toBe(32);
  });

  it("M3 — 그 행의 공식값이 바뀌면 (선택 variant 등) 실측이 적중하지 않는다", () => {
    measureK0ThenScrollAway();
    const formula = KEYS.map((_, i) => (i === 0 ? 40 : 32));
    expect(
      resolveExpandedCardHeights(planOf({ formulaCardHeights: formula }))[0],
    ).toBe(40);
  });
  it("N1 — 행 폭이 행마다 달라도 (Hug 폭 · 선택 variant) 행 가용 폭이 같으면 실측을 유지한다", () => {
    measureK0ThenScrollAway();
    const map = layout(20, 30, () => 32);
    // 행 묶음 폭은 그대로, 행 상자 폭만 행마다 다르다.
    for (let i = 20; i < 30; i += 1) {
      map.set(toCollectionRowProjectionId("listbox", "lb", `k${i}`), {
        width: 80 + i,
        height: 32,
      });
    }
    harvestExpandedCardHeights(map, scrollStub().access);
    expect(resolveExpandedCardHeights(planOf())[0]).toBe(104);
  });
});
