// @vitest-environment node
/**
 * ADR-150 Phase 0 — 결함 재현 RED 고정 (breakdown §2-3).
 *
 * 각 케이스는 **고친 뒤의 기대 동작**을 단언하고 `it.fails` 로 현재 실패를 고정한다.
 * Phase 1 (A2' 행 offset 함수) · Phase 2 (A3' 데이터 행 origin 진입) 이 해당 결함을 고치면
 * `it.fails` 가 실패로 뒤집히므로, 그 phase 에서 `it` 으로 바꿔 회귀 테스트로 쓴다.
 * 원본: 리뷰 round 3 · 4 probe (`/private/tmp/adr150-review-20260926-probe.test.ts`).
 */
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { buildCanonicalSceneModel } from "./canonicalSceneModel";
import { resolveVirtualizedCollectionWindows } from "./collectionVirtualization";
import { calculateContentHeight } from "../layout/engines/utils";
import { resolveCanvasInteractionTarget } from "../interaction/resolveCanvasInteractionTarget";
import {
  isPointerDoubleClick,
  resolveDoubleClickTargetId,
} from "../interaction/pointerSession";
import { toListBoxRowsGroupProjectionId } from "../../../projection/renderProjectionIds";

function documentOf(children: unknown[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children,
      },
    ],
  } as CompositionDocument;
}

function scrollListBox(items: Array<Record<string, unknown>>) {
  return documentOf([
    {
      id: "list",
      type: "ListBox",
      props: {
        items,
        style: { height: 400, width: 1000, overflowY: "auto" },
      },
      children: [],
    },
  ]);
}

/** layout 이 실제로 배치하는 행 높이 합 + 행 묶음 rowGap (window 없는 전체 투영 기준). */
function layoutRowsExtent(doc: CompositionDocument, ownerId: string) {
  const model = buildCanonicalSceneModel(doc);
  const rows = model.sceneNodes.filter(
    (n) => n.projection?.kind === "listbox-row",
  );
  const heights = rows.map((row) => calculateContentHeight(row, 1000));
  const rowsGroup = model.sceneNodesMap.get(
    toListBoxRowsGroupProjectionId(ownerId),
  );
  const style = (rowsGroup?.props?.style ?? {}) as Record<string, unknown>;
  const gap = typeof style.rowGap === "number" ? style.rowGap : 0;
  const sum = heights.reduce((acc, h) => acc + h, 0);
  return {
    heights,
    gap,
    extent: sum + Math.max(0, heights.length - 1) * gap,
  };
}

function expandedGridListDoc() {
  return documentOf([
    {
      id: "card-origin",
      type: "GridListItem",
      reusable: true,
      props: {},
      children: [
        { id: "heading", type: "Text", props: { children: "{label}" } },
        { id: "detail", type: "Text", props: { children: "{description}" } },
      ],
    },
    {
      id: "grid",
      type: "GridList",
      slot: ["card-origin"],
      props: {
        items: [
          { id: "a", label: "A", description: "A detail" },
          { id: "b", label: "B", description: "B detail" },
        ],
      },
      children: [{ id: "anchor", type: "ref", ref: "card-origin", props: {} }],
    },
  ]);
}

function expandedTextHits() {
  const model = buildCanonicalSceneModel(expandedGridListDoc());
  const hits = model.sceneNodes.filter(
    (n) => n.type === "Text" && n.projection?.kind === "gridlist-row",
  );
  return { model, hits };
}

describe("ADR-150 Phase 1 — A2' 행 위치 단일 소스 (G1, Phase 0 RED 에서 전환)", () => {
  it("ListBox scroll 모드 행 영역 높이는 행 묶음 rowGap 을 포함한다", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: `k${i}`,
      label: `Item ${i}`,
    }));
    const doc = scrollListBox(items);
    const layout = layoutRowsExtent(doc, "list");
    // 전제: 기본 rowGap 이 0 이 아니어야 이 반례가 의미를 갖는다.
    expect(layout.gap).toBeGreaterThan(0);
    const resolution = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    }).get("list")!;
    expect(resolution.rowsExtent).toBe(layout.extent);
  });

  it("description 유무가 교대하는 ListBox 는 행별 높이 합으로 행 영역 높이를 만든다", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: `k${i}`,
      label: `Item ${i}`,
      ...(i % 2 ? { description: "Short description" } : {}),
    }));
    const doc = scrollListBox(items);
    const layout = layoutRowsExtent(doc, "list");
    // 전제: 단일 줄인데도 행 높이가 둘로 갈린다 (round 3 h2 — 32 · 50px).
    expect(new Set(layout.heights).size).toBe(2);
    const resolution = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    }).get("list")!;
    expect(resolution.rowsExtent).toBe(layout.extent);
  });
});

describe("ADR-150 Phase 0 RED — A3' 데이터 행 origin 진입 (G2)", () => {
  it.fails(
    "owner 로 넘어가는 interaction target 이 원래 hit 노드를 sourceHit 으로 싣는다",
    () => {
      const { model, hits } = expandedTextHits();
      expect(hits.length).toBeGreaterThanOrEqual(2);
      for (const hit of hits) {
        const target = resolveCanvasInteractionTarget({
          candidateIds: [hit.id],
          elementsMap: model.sceneNodesMap,
          childrenMap: model.sceneChildrenByParent,
        });
        expect(target.kind).toBe("select");
        const sourceHit = (target as { sourceHit?: { nodeId?: string } })
          .sourceHit;
        expect(sourceHit?.nodeId).toBe(hit.id);
      }
    },
  );

  it.fails(
    "서로 다른 카드를 300ms 안에 한 번씩 누르면 double-click 이 아니다",
    () => {
      const { model, hits } = expandedTextHits();
      const cardA = hits.find((n) => n.id.includes(":a/"));
      const cardB = hits.find((n) => n.id.includes(":b/"));
      expect(cardA && cardB).toBeTruthy();
      const keyOf = (hitId: string) => {
        const target = resolveCanvasInteractionTarget({
          candidateIds: [hitId],
          elementsMap: model.sceneNodesMap,
          childrenMap: model.sceneChildrenByParent,
        });
        const elementId = target.kind === "select" ? target.elementId : null;
        return resolveDoubleClickTargetId(elementId, "grid");
      };
      const second = isPointerDoubleClick(
        { lastClickTargetId: keyOf(cardA!.id), lastClickTime: 1000 },
        keyOf(cardB!.id),
        1200,
      );
      expect(second).toBe(false);
    },
  );
});

describe("ADR-150 Phase 1 — GridList 시각 행별 높이 · spacer 전체 열 (G1)", () => {
  function scrollGridList(items: Array<Record<string, unknown>>) {
    return documentOf([
      {
        id: "grid",
        type: "GridList",
        props: {
          items,
          layout: "grid",
          columns: 2,
          style: { height: 300, width: 400, overflowY: "auto" },
        },
        children: [],
      },
    ]);
  }

  it("description 이 시각 행 단위로 교대하면 행 높이 = 그 행 카드 최대, 행 영역 = Σ + gap", () => {
    // 시각 행 0 = 카드 0·1 (desc 없음), 행 1 = 카드 2·3 (한 장만 desc) … 200 카드 = 100 시각 행.
    const items = Array.from({ length: 200 }, (_, i) => ({
      id: `r${i}`,
      label: `Row ${i}`,
      ...(Math.floor(i / 2) % 2 === 1 && i % 2 === 0
        ? { description: `detail ${i}` }
        : {}),
    }));
    const doc = scrollGridList(items);
    const resolution = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    }).get("grid")!;
    // 카드 50 (desc 없음) · 76 (desc) — 행 1 은 한 장만 desc 여도 76 (DOM grid stretch).
    const rowHeights = Array.from({ length: 100 }, (_, r) =>
      r % 2 === 1 ? 76 : 50,
    );
    const expected =
      rowHeights.reduce((sum, h) => sum + h, 0) + (rowHeights.length - 1) * 12;
    expect(resolution.rowsExtent).toBe(expected);
  });

  it("gap 은 DOM 과 같은 축 — owner style.gap 이 행 묶음 rowGap · 행 영역 gap 이 된다", () => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      id: `r${i}`,
      label: `Row ${i}`,
    }));
    const doc = documentOf([
      {
        id: "grid",
        type: "GridList",
        props: {
          items,
          layout: "grid",
          columns: 2,
          style: { height: 300, width: 400, overflowY: "auto", gap: "20px" },
        },
        children: [],
      },
    ]);
    const resolution = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    }).get("grid")!;
    expect(resolution.rowsExtent).toBe(100 * 50 + 99 * 20);
    const model = buildCanonicalSceneModel(doc, {
      collections: [],
      collectionWindows: new Map([["grid", resolution]]),
    });
    const rowsGroup = model.sceneNodes.find(
      (n) => n.projection?.kind === "gridlist-rows",
    );
    const style = rowsGroup?.props?.style as Record<string, unknown>;
    expect(style.rowGap).toBe(20);
    expect(style.columnGap).toBe(20);
  });

  it("lead · trail spacer 는 grid 전체 열을 차지한다 (gridColumnStart 1 / End -1)", () => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      id: `r${i}`,
      label: `Row ${i}`,
    }));
    const doc = scrollGridList(items);
    const collectionWindows = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map([["grid", 3000]]),
    });
    const model = buildCanonicalSceneModel(doc, {
      collections: [],
      collectionWindows,
    });
    const spacers = model.sceneNodes.filter(
      (n) => n.projection?.kind === "gridlist-spacer",
    );
    expect(spacers).toHaveLength(2);
    for (const spacer of spacers) {
      const style = spacer.props?.style as Record<string, unknown>;
      expect(style.gridColumnStart).toBe("1");
      expect(style.gridColumnEnd).toBe("-1");
    }
    // 첫 window 카드는 짝수 index (열 0 에서 시작).
    const firstCard = model.sceneNodes.find(
      (n) => n.projection?.kind === "gridlist-row",
    );
    const firstKey = (firstCard?.projection as { itemKey?: string }).itemKey;
    expect(Number(firstKey?.slice(1)) % 2).toBe(0);
  });
});
