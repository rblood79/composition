// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import {
  resolveVirtualizedCollectionWindows,
  collectionWindowSignature,
  DEFAULT_LISTBOX_ROW_HEIGHT,
} from "./collectionVirtualization";
import { buildCanonicalSceneModel } from "./canonicalSceneModel";

function listBoxDoc(opts: {
  itemCount: number;
  style?: Record<string, unknown>;
  withDescription?: boolean;
}): CompositionDocument {
  const items = Array.from({ length: opts.itemCount }, (_, i) => ({
    id: `k${i}`,
    label: `Item ${i}`,
    ...(opts.withDescription ? { description: `desc ${i}` } : {}),
  }));
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "body-1",
            type: "Body",
            props: {},
            children: [
              {
                id: "listbox-1",
                type: "ListBox",
                props: { items, style: opts.style },
                children: [
                  {
                    id: "template-anchor",
                    type: "ref",
                    ref: "component-listbox-item-default",
                    props: {},
                    metadata: {
                      type: "legacy-element-props",
                      templateRole: "listbox-item-template-anchor",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

const SCROLLABLE = { width: "100%", height: 400, overflowY: "auto" };

describe("resolveVirtualizedCollectionWindows — 가상화 대상 판정 + window", () => {
  it("기본 행 높이는 catalog ListBoxItem md(fontSize14) = 28", () => {
    expect(DEFAULT_LISTBOX_ROW_HEIGHT).toBe(28);
  });

  it("bounded height + overflow auto + data source → window 등재 (top)", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 1000, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("listbox-1");
    expect(entry).toBeDefined();
    expect(entry?.rowHeight).toBe(28);
    expect(entry?.totalRows).toBe(1000);
    // scrollTop 0, viewport 400, rowHeight 28 → visibleCount ceil(400/28)=15, overscan 6.
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 21 });
  });

  it("스크롤 시 window 가 firstVisible ± overscan 로 이동", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 1000, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map([["listbox-1", 2800]]), // 100행 * 28
    });
    // firstVisible = floor(2800/28)=100, start=94, end=100+15+6=121.
    expect(map.get("listbox-1")?.window).toEqual({
      startIndex: 94,
      endIndex: 121,
    });
  });

  it("bounded height 없음(auto-height) → ADR-157 sample resolution (window [0,10] + mode:'sample')", () => {
    // A2 가상화(bounded scroll) 대상은 아니지만, auto-height data-bound 소유자는 ADR-157
    //   샘플 정책 대상 — 앞부분 10행 window + 나머지 hatch(scene 이 emit). scrollTop/maxScroll 무관.
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 1000, style: { overflowY: "auto" } }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("listbox-1");
    expect(entry).toBeDefined();
    expect(entry?.mode).toBe("sample");
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 10 });
    expect(entry?.totalRows).toBe(1000);
    expect(entry?.rowHeight).toBe(28);
    // sample 은 스크롤 아님 → viewportHeight/maxScrollTop 미설정.
    expect(entry?.maxScrollTop).toBeUndefined();
  });

  it("auto-height + 데이터 ≤ 샘플 상한(10) → 전량 투영(sample resolution 없음)", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 8, style: { overflowY: "auto" } }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.has("listbox-1")).toBe(false);
  });

  it("명시 height + overflow visible(비-scroll) → sample/A2 모두 제외 (컨테이너 고정 높이)", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({
        itemCount: 1000,
        style: { height: 400, overflow: "visible" },
      }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.has("listbox-1")).toBe(false);
  });

  it("overflow visible → 가상화 제외", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({
        itemCount: 1000,
        style: { height: 400, overflow: "visible" },
      }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.has("listbox-1")).toBe(false);
  });

  it("data source 0행 → 제외", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 0, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.has("listbox-1")).toBe(false);
  });

  it("ref 인스턴스 ListBox(type:'ref' + name:'ListBox')도 가상화 대상 (live 회귀 방지)", () => {
    // 페이지에 놓인 ListBox 는 origin 을 가리키는 ref 노드다 (type:'ListBox' 직접 아님).
    // 2026-07-19 live 검증에서 이 경로 누락이 발견됨 — 유닛 fixture 가 직접 노드만 썼던 갭.
    const items = Array.from({ length: 60 }, (_, i) => ({
      id: `k${i}`,
      label: `Row ${i}`,
    }));
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "body-1",
              type: "Body",
              props: {},
              children: [
                {
                  id: "listbox-instance-1",
                  type: "ref",
                  name: "ListBox",
                  ref: "component-listbox",
                  props: {
                    items,
                    style: { width: "100%", height: 400, overflowY: "auto" },
                  },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
    const map = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("listbox-instance-1");
    expect(entry).toBeDefined();
    expect(entry?.totalRows).toBe(60);
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 21 });
  });

  it("description 있는 행은 taller rowHeight(itemHeightWithDescription 50) + 그에 맞는 window", () => {
    // A(정확 rowHeight): description 행은 label+desc 2줄이라 nominal 28 이 아닌 50.
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({
        itemCount: 1000,
        style: SCROLLABLE,
        withDescription: true,
      }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("listbox-1");
    expect(entry?.rowHeight).toBe(50); // itemHeightWithDescription (fontSize14)
    // viewport 400 / 50 = 8 visible, overscan 6 → end 14.
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 14 });
  });

  it("description 없는 기본 행은 rowHeight 28 (itemHeight)", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 1000, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.get("listbox-1")?.rowHeight).toBe(28);
  });

  it('height "400px" 문자열도 bounded 로 인식', () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({
        itemCount: 500,
        style: { height: "400px", overflowY: "scroll" },
      }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.get("listbox-1")?.totalRows).toBe(500);
  });
});

describe("collectionWindowSignature — window 경계 rebuild 게이팅", () => {
  it("window 동일 → signature 동일 (overscan slack 안 스크롤은 rebuild 억제)", () => {
    const doc = listBoxDoc({ itemCount: 1000, style: SCROLLABLE });
    const a = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map([["listbox-1", 0]]),
    });
    const b = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map([["listbox-1", 10]]), // 10px < rowHeight 28 → 같은 window
    });
    expect(collectionWindowSignature(a)).toBe(collectionWindowSignature(b));
  });

  it("window 이동 → signature 변경", () => {
    const doc = listBoxDoc({ itemCount: 1000, style: SCROLLABLE });
    const a = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map([["listbox-1", 0]]),
    });
    const b = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map([["listbox-1", 2800]]),
    });
    expect(collectionWindowSignature(a)).not.toBe(collectionWindowSignature(b));
  });
});

describe("scene model 통합 — G-A2 핵심: 투영 노드 수 ≤ window+overscan (10k)", () => {
  it("10000행 ListBox → projected 행 노드는 window(21)개 뿐 (10k 아님)", () => {
    const doc = listBoxDoc({ itemCount: 10000, style: SCROLLABLE });
    const collectionWindows = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    });
    const model = buildCanonicalSceneModel(doc, {
      collections: [],
      collectionWindows,
    });
    const rowNodes = model.sceneNodes.filter(
      (n) => n.projection?.kind === "listbox-row",
    );
    // scrollTop 0 → window {0,21} → 21 행만 투영 (10000 아님).
    expect(rowNodes).toHaveLength(21);
    // 전체 scene 노드도 10k 수준이 아님 (page/body/listbox/rowsGroup/21행/trailing spacer 등).
    expect(model.sceneNodes.length).toBeLessThan(100);
  });

  it("collectionWindows 미제공 → legacy cap 100행 (BC, 가상화 비활성)", () => {
    const doc = listBoxDoc({ itemCount: 10000, style: SCROLLABLE });
    const model = buildCanonicalSceneModel(doc, { collections: [] });
    const rowNodes = model.sceneNodes.filter(
      (n) => n.projection?.kind === "listbox-row",
    );
    expect(rowNodes).toHaveLength(100);
  });
});

describe("ADR-157 — auto-height ListBox 샘플 + hatch remainder (scene emit)", () => {
  it("sample resolution → 10행 투영 + collection-remainder hatch 1개(hiddenRows/height)", () => {
    const doc = listBoxDoc({ itemCount: 1000, style: { overflowY: "auto" } });
    const collectionWindows = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    });
    const model = buildCanonicalSceneModel(doc, {
      collections: [],
      collectionWindows,
    });
    const rowNodes = model.sceneNodes.filter(
      (n) => n.projection?.kind === "listbox-row",
    );
    expect(rowNodes).toHaveLength(10);

    const remainder = model.sceneNodes.filter(
      (n) => n.projection?.kind === "collection-remainder",
    );
    expect(remainder).toHaveLength(1);
    expect(
      (remainder[0]?.projection as { hiddenRows?: number } | undefined)
        ?.hiddenRows,
    ).toBe(990);
    // hatch box 높이 = hiddenRows(990) × rowHeight(28) → 컨테이너가 totalRows 전체 높이에 auto-size.
    const style = remainder[0]?.props?.style as { height?: number } | undefined;
    expect(style?.height).toBe(990 * 28);
    // trailing 은 hatch 이지 빈 spacer 아님 (sample mode).
    expect(
      model.sceneNodes.filter((n) => n.projection?.kind === "listbox-spacer"),
    ).toHaveLength(0);
    // remainder projection id 는 canonical 저장 금지 계약(projection: prefix).
    expect(remainder[0]?.id.startsWith("projection:")).toBe(true);

    // ADR-157 Phase 3: owner 에 totalRows 전체 높이(= 1000 × rowHeight 28) 주입 →
    //   layout §1.55b 가 소비해 3-item fallback clip 방지(배치 진실성).
    const owner = model.sceneNodes.find(
      (n) => (n.type ?? "").toLowerCase() === "listbox",
    );
    expect(
      (owner?.props as { _projectedRowsContentHeight?: number } | undefined)
        ?._projectedRowsContentHeight,
    ).toBe(1000 * 28);
  });

  it("데이터 ≤ 샘플 상한(10) → 전량 투영 + remainder 없음 + owner 높이 주입 없음", () => {
    const doc = listBoxDoc({ itemCount: 8, style: { overflowY: "auto" } });
    const collectionWindows = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    });
    const model = buildCanonicalSceneModel(doc, {
      collections: [],
      collectionWindows,
    });
    expect(
      model.sceneNodes.filter((n) => n.projection?.kind === "listbox-row"),
    ).toHaveLength(8);
    expect(
      model.sceneNodes.filter(
        (n) => n.projection?.kind === "collection-remainder",
      ),
    ).toHaveLength(0);
    // sample mode 미발동(≤10) → owner 높이 주입 없음 (전량 투영이라 자식 합산으로 정합).
    const owner = model.sceneNodes.find(
      (n) => (n.type ?? "").toLowerCase() === "listbox",
    );
    expect(
      (owner?.props as { _projectedRowsContentHeight?: number } | undefined)
        ?._projectedRowsContentHeight,
    ).toBeUndefined();
  });
});

// ── ADR-150 A2 GridList 확산 (stack + grid numCols) ────────────────────────

function gridListDoc(opts: {
  itemCount: number;
  style?: Record<string, unknown>;
  layout?: "stack" | "grid";
  columns?: number;
  withDescription?: boolean;
  asRefInstance?: boolean;
}): CompositionDocument {
  const items = Array.from({ length: opts.itemCount }, (_, i) => ({
    id: `g${i}`,
    label: `Card ${i}`,
    ...(opts.withDescription ? { description: `desc ${i}` } : {}),
  }));
  const commonProps = {
    items,
    style: opts.style,
    layout: opts.layout,
    columns: opts.columns,
  };
  const owner = opts.asRefInstance
    ? {
        id: "gridlist-1",
        type: "ref",
        name: "GridList",
        ref: "component-gridlist",
        props: commonProps,
      }
    : {
        id: "gridlist-1",
        type: "GridList",
        props: commonProps,
        children: [],
      };
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "body-1",
            type: "Body",
            props: {},
            children: [owner],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

describe("resolveVirtualizedCollectionWindows — GridList 확산", () => {
  it("stack 모드: 카드 stride 56(pad24+label20+gap12), columns 1, window", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({ itemCount: 1000, style: SCROLLABLE, layout: "stack" }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("gridlist-1");
    expect(entry?.rowHeight).toBe(56);
    expect(entry?.columns).toBe(1);
    expect(entry?.totalRows).toBe(1000);
    // viewport 400 / 56 = 8 visible, overscan 6 → end 14.
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 14 });
  });

  it("grid 모드(columns 2): numCols 2, window 는 numCols 배수로 정렬", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({
        itemCount: 1000,
        style: SCROLLABLE,
        layout: "grid",
        columns: 2,
      }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("gridlist-1");
    expect(entry?.rowHeight).toBe(56);
    expect(entry?.columns).toBe(2);
    // 시각 행 window {0,14} × numCols 2 → item {0,28}.
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 28 });
  });

  it("grid 모드 스크롤: 시각 행 firstVisible±overscan → item index numCols 정렬", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({
        itemCount: 1000,
        style: SCROLLABLE,
        layout: "grid",
        columns: 2,
      }),
      collections: [],
      scrollTops: new Map([["gridlist-1", 560]]), // 10 시각 행 × 56
    });
    // firstVisibleVisualRow = floor(560/56)=10, start 4, end 10+8+6=24 → item {8,48}.
    expect(map.get("gridlist-1")?.window).toEqual({
      startIndex: 8,
      endIndex: 48,
    });
  });

  it("description 카드는 taller stride 76(pad24+label20+desc16+gap4+rowGap12)", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({
        itemCount: 1000,
        style: SCROLLABLE,
        layout: "stack",
        withDescription: true,
      }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.get("gridlist-1")?.rowHeight).toBe(76);
  });

  it("ref 인스턴스 GridService(type:'ref' + name:'GridList')도 가상화 대상", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({
        itemCount: 500,
        style: SCROLLABLE,
        layout: "grid",
        columns: 2,
        asRefInstance: true,
      }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("gridlist-1");
    expect(entry).toBeDefined();
    expect(entry?.columns).toBe(2);
    expect(entry?.totalRows).toBe(500);
  });

  it("bounded height 없음 → 제외", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({ itemCount: 1000, style: { overflowY: "auto" } }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.has("gridlist-1")).toBe(false);
  });
});

describe("scene model 통합 — GridList G-A2: 카드 노드 수 ≤ window (10k grid)", () => {
  it("10000행 GridList grid(cols 2) → 카드 노드 28개(window) + trailing spacer", () => {
    const doc = gridListDoc({
      itemCount: 10000,
      style: SCROLLABLE,
      layout: "grid",
      columns: 2,
    });
    const collectionWindows = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    });
    const model = buildCanonicalSceneModel(doc, {
      collections: [],
      collectionWindows,
    });
    const cardNodes = model.sceneNodes.filter(
      (n) => n.projection?.kind === "gridlist-row",
    );
    const spacers = model.sceneNodes.filter(
      (n) => n.projection?.kind === "gridlist-spacer",
    );
    // 시각 window {0,14}(행) × 2 = item {0,28} → 28 카드 (10000 아님).
    expect(cardNodes).toHaveLength(28);
    // scrollTop 0 → lead spacer 없음, trailing spacer 1개(시각 행 5000-14=4986 × 56).
    expect(spacers).toHaveLength(1);
    expect(
      (spacers[0]?.projection as { position?: string } | undefined)?.position,
    ).toBe("trail");
    expect(model.sceneNodes.length).toBeLessThan(100);
  });

  it("grid 스크롤 시 lead+trail spacer 가 시각 행 stride 로 절대 위치 보존", () => {
    const doc = gridListDoc({
      itemCount: 10000,
      style: SCROLLABLE,
      layout: "grid",
      columns: 2,
    });
    const collectionWindows = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map([["gridlist-1", 560]]), // 10 시각 행
    });
    const model = buildCanonicalSceneModel(doc, {
      collections: [],
      collectionWindows,
    });
    const spacers = model.sceneNodes
      .filter((n) => n.projection?.kind === "gridlist-spacer")
      .map((n) => ({
        pos: (n.projection as { position?: string } | undefined)?.position,
        h: (n.props?.style as Record<string, unknown> | undefined)?.height,
      }));
    // window item {8,48} → lead 시각 행 = ceil(8/2)=4 × 56 = 224, trail = (5000-24) × 56.
    const lead = spacers.find((s) => s.pos === "lead");
    const trail = spacers.find((s) => s.pos === "trail");
    expect(lead?.h).toBe(4 * 56);
    expect(trail?.h).toBe((5000 - 24) * 56);
  });
});

// ── ADR-150 A2 Table 확산 (header 상시 + data 행 windowing) ─────────────────

function tableDoc(opts: {
  rowCount: number;
  style?: Record<string, unknown>;
  size?: "sm" | "md" | "lg";
  asRefInstance?: boolean;
}): CompositionDocument {
  const columns = [
    { id: "a", label: "A", width: 100 },
    { id: "b", label: "B", width: 100 },
  ];
  const rows = Array.from({ length: opts.rowCount }, (_, i) => ({
    id: `r${i}`,
    a: `a${i}`,
    b: `b${i}`,
  }));
  const commonProps = { columns, rows, size: opts.size, style: opts.style };
  const owner = opts.asRefInstance
    ? {
        id: "table-1",
        type: "ref",
        name: "Table",
        ref: "component-table",
        props: commonProps,
      }
    : { id: "table-1", type: "Table", props: commonProps, children: [] };
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "body-1",
            type: "Body",
            props: {},
            children: [owner],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

describe("resolveVirtualizedCollectionWindows — Table 확산", () => {
  it("md 행 높이 44 + columns 1, data 행 window (header 제외 totalRows)", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: tableDoc({ rowCount: 10000, style: SCROLLABLE, size: "md" }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("table-1");
    expect(entry?.rowHeight).toBe(44);
    expect(entry?.columns).toBe(1);
    expect(entry?.totalRows).toBe(10000); // data 행만 (header 제외)
    // scrollTop 0 → header offset 후 0. visibleCount ceil(400/44)=10, overscan 6 → {0,16}.
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 16 });
  });

  it("스크롤: header 높이 보정 후 data 행 firstVisible±overscan", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: tableDoc({ rowCount: 10000, style: SCROLLABLE, size: "md" }),
      collections: [],
      scrollTops: new Map([["table-1", 44 + 44 * 100]]), // header + 100 data 행
    });
    // adjusted = 4444-44 = 4400, firstVisible=floor(4400/44)=100, {94, 100+10+6=116}.
    expect(map.get("table-1")?.window).toEqual({
      startIndex: 94,
      endIndex: 116,
    });
  });

  it("size sm → 36 / lg → 52", () => {
    const sm = resolveVirtualizedCollectionWindows({
      doc: tableDoc({ rowCount: 500, style: SCROLLABLE, size: "sm" }),
      collections: [],
      scrollTops: new Map(),
    });
    const lg = resolveVirtualizedCollectionWindows({
      doc: tableDoc({ rowCount: 500, style: SCROLLABLE, size: "lg" }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(sm.get("table-1")?.rowHeight).toBe(36);
    expect(lg.get("table-1")?.rowHeight).toBe(52);
  });

  it("ref 인스턴스 Table(type:'ref' + name:'Table')도 가상화 대상", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: tableDoc({ rowCount: 500, style: SCROLLABLE, asRefInstance: true }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("table-1");
    expect(entry).toBeDefined();
    expect(entry?.totalRows).toBe(500);
  });

  it("data 0행 → 제외", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: tableDoc({ rowCount: 0, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.has("table-1")).toBe(false);
  });
});

describe("scene model 통합 — Table G-A2: header 상시 + data 행 ≤ window (10k)", () => {
  it("10000행 Table → header 1 + data 16(window) TableRow + trailing spacer", () => {
    const doc = tableDoc({ rowCount: 10000, style: SCROLLABLE, size: "md" });
    const collectionWindows = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    });
    const model = buildCanonicalSceneModel(doc, {
      collections: [],
      collectionWindows,
    });
    const rowNodes = model.sceneNodes.filter(
      (n) => n.projection?.kind === "table-row",
    );
    const headerRows = rowNodes.filter(
      (n) =>
        (n.projection as { isHeader?: boolean } | undefined)?.isHeader === true,
    );
    const dataRows = rowNodes.filter(
      (n) =>
        (n.projection as { isHeader?: boolean } | undefined)?.isHeader ===
        false,
    );
    const spacers = model.sceneNodes.filter(
      (n) => n.projection?.kind === "table-spacer",
    );
    // header 는 항상 1개, data 행은 window 16개 (10000 아님).
    expect(headerRows).toHaveLength(1);
    expect(dataRows).toHaveLength(16);
    // scrollTop 0 → lead spacer 없음, trailing spacer 1개.
    expect(spacers).toHaveLength(1);
    expect(
      (spacers[0]?.projection as { position?: string } | undefined)?.position,
    ).toBe("trail");
    expect(model.sceneNodes.length).toBeLessThan(100);
  });

  it("스크롤 시 lead+trail spacer 가 data 행 절대 위치 보존", () => {
    const doc = tableDoc({ rowCount: 10000, style: SCROLLABLE, size: "md" });
    const collectionWindows = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map([["table-1", 44 + 44 * 100]]),
    });
    const model = buildCanonicalSceneModel(doc, {
      collections: [],
      collectionWindows,
    });
    const spacers = model.sceneNodes
      .filter((n) => n.projection?.kind === "table-spacer")
      .map((n) => ({
        pos: (n.projection as { position?: string } | undefined)?.position,
        h: (n.props?.style as Record<string, unknown> | undefined)?.height,
      }));
    // window {94,116} → lead = 94 × 44, trail = (10000-116) × 44.
    expect(spacers.find((s) => s.pos === "lead")?.h).toBe(94 * 44);
    expect(spacers.find((s) => s.pos === "trail")?.h).toBe((10000 - 116) * 44);
  });

  it("collectionWindows 미제공 → legacy cap 100 data행 (BC)", () => {
    const doc = tableDoc({ rowCount: 10000, style: SCROLLABLE, size: "md" });
    const model = buildCanonicalSceneModel(doc, { collections: [] });
    const dataRows = model.sceneNodes.filter(
      (n) =>
        n.projection?.kind === "table-row" &&
        (n.projection as { isHeader?: boolean } | undefined)?.isHeader ===
          false,
    );
    expect(dataRows).toHaveLength(100);
  });
});

// ── ADR-150 A2 스크롤 입력 배선: maxScrollTop = contentHeight − viewportHeight ─────
// data-bound collection 은 element 자식이 0개라 GAP 4(fullTreeLayout maxScroll)가 스크롤
// 범위를 못 구한다. resolver 가 투영 총 높이로 산출한 maxScrollTop 을 BuilderCanvas 가
// useScrollState.updateMaxScroll 로 주입해 휠 스크롤을 활성화한다(설계 breakdown §4 line 53).

describe("resolveVirtualizedCollectionWindows — maxScrollTop (스크롤 입력 배선)", () => {
  it("ListBox: contentHeight(totalRows×rowHeight) − viewportHeight", () => {
    const entry = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 1000, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map(),
    }).get("listbox-1");
    // rowHeight 28, viewport 400 → contentHeight 28000, maxScrollTop 27600.
    expect(entry?.viewportHeight).toBe(400);
    expect(entry?.contentHeight).toBe(28000);
    expect(entry?.maxScrollTop).toBe(27600);
  });

  it("content 가 viewport 안에 들어가면 maxScrollTop 0 (스크롤 불가)", () => {
    const entry = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 10, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map(),
    }).get("listbox-1");
    // contentHeight 10×28=280 < viewport 400 → max(0, 280−400)=0.
    expect(entry?.contentHeight).toBe(280);
    expect(entry?.maxScrollTop).toBe(0);
  });

  it("maxScrollTop 은 scrollTop 과 무관(총 스크롤 범위 = 불변)", () => {
    const doc = listBoxDoc({ itemCount: 1000, style: SCROLLABLE });
    const at0 = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    }).get("listbox-1")?.maxScrollTop;
    const at2800 = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map([["listbox-1", 2800]]),
    }).get("listbox-1")?.maxScrollTop;
    expect(at0).toBe(27600);
    expect(at2800).toBe(27600);
  });

  it("GridList grid(cols 2): 시각 행 수 ceil(totalRows/columns)×rowHeight 기반", () => {
    const entry = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({
        itemCount: 1000,
        style: SCROLLABLE,
        layout: "grid",
        columns: 2,
      }),
      collections: [],
      scrollTops: new Map(),
    }).get("gridlist-1");
    // visualRows ceil(1000/2)=500, rowHeight 56 → contentHeight 28000, maxScrollTop 27600.
    expect(entry?.contentHeight).toBe(28000);
    expect(entry?.maxScrollTop).toBe(27600);
  });

  it("Table: header 1행 가산 (visualRows+1)×rowHeight", () => {
    const entry = resolveVirtualizedCollectionWindows({
      doc: tableDoc({ rowCount: 10000, style: SCROLLABLE, size: "md" }),
      collections: [],
      scrollTops: new Map(),
    }).get("table-1");
    // rowHeight 44, data 10000 + header 1 = 10001 → contentHeight 440044, maxScrollTop 439644.
    expect(entry?.contentHeight).toBe(10001 * 44);
    expect(entry?.maxScrollTop).toBe(10001 * 44 - 400);
  });
});
