// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { ensureReusableCompositeOrigins } from "../../../components/reusableCompositeOrigins";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "../../../components/templateItemOriginIds";
import { toCollectionRowProjectionId } from "../../../projection/renderProjectionIds";
import { resolveVirtualizedCollectionWindows } from "./collectionVirtualization";
import {
  __resetExpandedCardHeightsForTest,
  anchorScrollTop,
  getExpandedCardHeightsVersion,
  harvestExpandedCardHeights,
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

  it("slot-only origin (접기) 은 수확 대상이 아니다 — 행 위치는 150 공식 그대로", () => {
    const doc = makeDoc({ withImage: false });
    const before = resolve(doc, 0);
    expect(
      harvestExpandedCardHeights(
        layoutFor(before.window, () => 126),
        scrollStub().access,
      ),
    ).toBe(false);
    expect(resolve(doc, 0).rowsExtent).toBe(before.rowsExtent);
  });
});
