// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CompositionDocument, VariableDef } from "@composition/shared";
import { ensureListBoxTemplateOrigins } from "../../../components/listbox/listBoxTemplateOrigins";
import { flattenCanonicalDocumentNodes } from "./canonicalSceneModel";

import {
  resolveVirtualizedCollectionWindows,
  resolveCollectionRowPositions,
  __rowHeightCacheSizeForTest,
  collectionWindowSignature,
  DEFAULT_LISTBOX_ROW_HEIGHT,
} from "./collectionVirtualization";
import { buildCanonicalSceneModel } from "./canonicalSceneModel";
import { parsePxValue } from "@composition/specs";
import { resolveContainerStylesFallback } from "../layout/engines/implicitStyles";

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

/**
 * origin(`component-listbox-item-default`)을 label/description slot 자식과 함께 실제로
 * 정의한 doc — instance 행 높이가 slot size 를 반영하는지(Issue 2) 검증용. slot 자식은
 * explicit `style.fontSize`(catalog 미의존) 로 size 를 authoring.
 */
function listBoxDocWithSizedOrigin(opts: {
  itemCount: number;
  style?: Record<string, unknown>;
  labelFontSize: number;
  descriptionFontSize: number;
}): CompositionDocument {
  const items = Array.from({ length: opts.itemCount }, (_, i) => ({
    id: `k${i}`,
    label: `Item ${i}`,
    description: `desc ${i}`,
  }));
  const slotChild = (
    role: "label" | "description",
    fontSize: number,
  ): unknown => ({
    id: `component-listbox-item-default__${role}`,
    type: "Text",
    props: { slot: role, style: { fontSize } },
    metadata: { slotRole: role },
  });
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-components",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-components" },
        children: [
          {
            id: "component-listbox-item-default",
            type: "ListBoxItem",
            reusable: true,
            props: {},
            children: [
              slotChild("label", opts.labelFontSize),
              slotChild("description", opts.descriptionFontSize),
            ],
          },
        ],
      },
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
  it("기본 행 높이 = 32 (label react-aria-Text 16 → line box 24 + pad 4*2)", () => {
    // 2026-07-22 라이브 실측: label 은 react-aria-Text 기본 16 (item fontSize 미상속) →
    //   getTextLineHeight(16)=24 → itemHeight pad4*2+24=32. description 없음. row resolver
    //   (resolveListBoxItemRowHeightFromStyle)와 동일 심볼로 산출해 fallback 상수=실 stride.
    expect(DEFAULT_LISTBOX_ROW_HEIGHT).toBe(32);
  });

  it("bounded height + overflow auto + data source → window 등재 (top)", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 1000, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("listbox-1");
    expect(entry).toBeDefined();
    expect(entry?.rowHeight).toBe(32);
    expect(entry?.totalRows).toBe(1000);
    // ADR-150 A2' (2026-09-27): 행 위치 = resolveCollectionRowOffsets — 행 32 + 행 묶음 gap 2 (catalog) = stride 34, owner inset border 1 + padding 4 = 5.
    //   scrollTop 0 → 보이는 행 영역 [-5, 395) → 끝 행 ceil(395/34)=12, overscan 6 → 18.
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 18 });
  });

  it("스크롤 시 window 가 firstVisible ± overscan 로 이동", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 1000, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map([["listbox-1", 2800]]),
    });
    // ADR-150 A2' (2026-09-27): 행 위치 = resolveCollectionRowOffsets — 행 32 + 행 묶음 gap 2 (catalog) = stride 34, owner inset border 1 + padding 4 = 5.
    //   보이는 행 영역 [2795, 3195) → 첫 행 floor((2795−32)/34)+1=82 (start 76), 끝 ceil(3195/34)=94 (end 100).
    expect(map.get("listbox-1")?.window).toEqual({
      startIndex: 76,
      endIndex: 100,
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
    expect(entry?.rowHeight).toBe(32);
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
    // ADR-150 A2' stride 34 · inset 5 → 끝 행 ceil(395/34)=12 + overscan 6.
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 18 });
  });

  it("description 있는 행은 taller rowHeight(50) + 그에 맞는 window", () => {
    // A(정확 rowHeight): description 행은 label+desc 2줄이라 nominal 32 이 아닌 50
    //   (pad4*2 + label 24(react-aria-Text 16→1.5×) + gap2 + desc 16(--text-xs 12→1.333×, label
    //    무관 decouple)). 라이브 실측 2026-07-22: label 1.5× / desc 1.333× 별도 비율.
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
    expect(entry?.rowHeight).toBe(50); // label 24(1.5×16) + desc 16(1.333×12) + pad 8 + gap 2
    // viewport 400 / 50 = 8 visible, overscan 6 → end 14.
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 14 });
  });

  it("description 없는 기본 행은 rowHeight 32 (itemHeight)", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 1000, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.get("listbox-1")?.rowHeight).toBe(32);
  });

  // 2026-07-22 라이브 실측: origin label/description slot size 가 instance 행 높이에 반영 +
  //   origin/CSS line box 일치. label 은 slot CSS override 없어 1.5×(getTextLineHeight): 30→45.
  //   description 은 CSS [slot=desc] line-height 1.333×(getDescriptionLineHeight): 24→32.
  //   → pad 4*2 + 45 + gap 2 + 32 = 87 (과거 91 은 desc 에도 1.5× 적용한 stale 값).
  it("origin label(3xl)/description(2xl) slot size → 행 높이가 size 비례로 커진다", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDocWithSizedOrigin({
        itemCount: 1000,
        style: SCROLLABLE,
        labelFontSize: 30,
        descriptionFontSize: 24,
      }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.get("listbox-1")?.rowHeight).toBe(87);
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
    // scrollTop 0 → window {0,18} (ADR-150 A2' stride 34 · inset 5) → 18 행만 투영 (10000 아님).
    expect(rowNodes).toHaveLength(18);
    // 전체 scene 노드도 10k 수준이 아님 (page/body/listbox/rowsGroup/18행/trailing spacer 등).
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
    // ② 정정 (2026-07-21): gap 미지정 시 catalog containerStyles.gap fallback 이 반영된다.
    const catalogGap = parsePxValue(
      resolveContainerStylesFallback("listbox", {}).gap,
      0,
    );
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
    // hatch box 높이 = hiddenRows(990) × rowHeight(32) + (990-1) × catalogGap → 컨테이너가
    //   totalRows 전체 높이(gap 포함)에 auto-size.
    const style = remainder[0]?.props?.style as { height?: number } | undefined;
    expect(style?.height).toBe(990 * 32 + 989 * catalogGap);
    // trailing 은 hatch 이지 빈 spacer 아님 (sample mode).
    expect(
      model.sceneNodes.filter((n) => n.projection?.kind === "listbox-spacer"),
    ).toHaveLength(0);
    // remainder projection id 는 canonical 저장 금지 계약(projection: prefix).
    expect(remainder[0]?.id.startsWith("projection:")).toBe(true);

    // ADR-157 Phase 3: owner 에 totalRows 전체 높이(= 1000 × 28 + 999 × catalogGap) 주입 →
    //   layout §1.55b(또는 ref 는 fix b early-check)가 소비해 clip 방지(배치 진실성).
    const owner = model.sceneNodes.find(
      (n) => (n.type ?? "").toLowerCase() === "listbox",
    );
    expect(
      (owner?.props as { _projectedRowsContentHeight?: number } | undefined)
        ?._projectedRowsContentHeight,
    ).toBe(1000 * 32 + 999 * catalogGap);
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

  // ADR-157 gap 배선 (②, 2026-07-21): rowsGroup 이 gap:0 하드코딩이라 ListBox 의 gap 스타일이
  //   무시됐다(GridList 는 rowGap:gap 적용 — 패밀리 비대칭). rowsGroup 이 소유자 gap 을 소비하고,
  //   injection/hatch 공식이 gap 을 반영해야 owner auto-size + 배치 진실성이 유지된다.
  it("소유자 gap → rowsGroup rowGap 소비 + injection/remainder 가 gap 반영", () => {
    // itemCount 12, rowHeight 28, gap 8 → sample 10 + hidden 2.
    //   injection = 12×28 + (12-1)×8 = 336 + 88 = 424 (owner content 전체 높이)
    //   remainder = 2×28 + (2-1)×8 = 56 + 8 = 64 (hidden 영역, gap 포함)
    const doc = listBoxDoc({
      itemCount: 12,
      style: { overflowY: "auto", rowGap: 8 },
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

    const rowsGroup = model.sceneNodes.find(
      (n) => n.projection?.kind === "listbox-rows",
    );
    expect((rowsGroup?.props?.style as { rowGap?: number })?.rowGap).toBe(8);

    const owner = model.sceneNodes.find(
      (n) => (n.type ?? "").toLowerCase() === "listbox",
    );
    expect(
      (owner?.props as { _projectedRowsContentHeight?: number })
        ?._projectedRowsContentHeight,
    ).toBe(12 * 32 + 11 * 8);

    const remainder = model.sceneNodes.find(
      (n) => n.projection?.kind === "collection-remainder",
    );
    expect((remainder?.props?.style as { height?: number })?.height).toBe(
      2 * 32 + 1 * 8,
    );
  });

  it("element gap 미지정 → catalog containerStyles.gap 을 fallback 으로 소비 (CSS 정합, D3 대칭)", () => {
    // 정정 (2026-07-21): 이전엔 "gap 미지정 → 0" 을 BC 로 봤으나, 실제 CSS 는 catalog
    //   containerStyles.gap(theme 토큰 → px)을 적용한다. Skia rowsGroup 도 동일 소스를 써야
    //   D3 대칭 — element gap 없으면 catalog gap 이 rowsGroup/injection/hatch 에 반영된다.
    const catalogGap = parsePxValue(
      resolveContainerStylesFallback("listbox", {}).gap,
      0,
    );
    const doc = listBoxDoc({ itemCount: 12, style: { overflowY: "auto" } });
    const collectionWindows = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    });
    const model = buildCanonicalSceneModel(doc, {
      collections: [],
      collectionWindows,
    });
    const rowsGroup = model.sceneNodes.find(
      (n) => n.projection?.kind === "listbox-rows",
    );
    expect((rowsGroup?.props?.style as { rowGap?: number })?.rowGap).toBe(
      catalogGap,
    );
    const owner = model.sceneNodes.find(
      (n) => (n.type ?? "").toLowerCase() === "listbox",
    );
    expect(
      (owner?.props as { _projectedRowsContentHeight?: number })
        ?._projectedRowsContentHeight,
    ).toBe(12 * 32 + 11 * catalogGap);
    const remainder = model.sceneNodes.find(
      (n) => n.projection?.kind === "collection-remainder",
    );
    expect((remainder?.props?.style as { height?: number })?.height).toBe(
      2 * 32 + 1 * catalogGap,
    );
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
  it("stack 모드: 카드 높이 50 (pad24+border2+label24) + gap 12, columns 1, window", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({ itemCount: 1000, style: SCROLLABLE, layout: "stack" }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("gridlist-1");
    // ADR-150 A2' (2026-09-27): rowHeight = 시각 행 높이 (카드 = padding 12·2 + border 1·2 + label 24 = 50 — 구 stride 60 은 카드 border 2 를 빼먹고 gap 12 를 더한 값). gap 은 행 위치 함수 (resolveCollectionRowOffsets) 가 따로 넣는다 — stride 62.
    expect(entry?.rowHeight).toBe(50);
    expect(entry?.columns).toBe(1);
    expect(entry?.totalRows).toBe(1000);
    // viewport 400 / stride 62 = ceil 7 visible, overscan 6 → end 13.
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 13 });
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
    expect(entry?.rowHeight).toBe(50);
    expect(entry?.columns).toBe(2);
    // 시각 행 window {0,13} × numCols 2 → item {0,26}.
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 26 });
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
      scrollTops: new Map([["gridlist-1", 560]]), // 시각 행 stride 60
    });
    // firstVisibleVisualRow = floor(560/60)=9, start 3, end 9+7+6=22 → item {6,44}.
    expect(map.get("gridlist-1")?.window).toEqual({
      startIndex: 6,
      endIndex: 44,
    });
  });

  it("description 카드는 taller 76 (pad24+border2+label24+descGap2+desc24)", () => {
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

  // ADR-162 Phase 1 (round 2 h2) — stride 도 소유자 자기 항목 origin 으로 (scene 투영
  //   `resolveGridListTemplateOriginId` 와 같은 규칙). 종전은 상수 기본 origin 을 읽어, description slot
  //   을 끈 custom origin 의 GridList 에서 stride (86) 가 카드 (60) 와 갈렸다.
  it("소유자 slot 의 custom origin (description slot 없음) → description 행도 카드 50", () => {
    const doc = gridListDoc({
      itemCount: 1000,
      style: SCROLLABLE,
      layout: "stack",
      withDescription: true,
    });
    const body = (
      doc.children[0] as unknown as { children: { children: unknown[] }[] }
    ).children[0];
    const owner = body.children[0] as { slot?: string[] };
    owner.slot = ["user-card"];
    const originOf = (id: string, withDescriptionSlot: boolean) => ({
      id,
      type: "GridListItem",
      reusable: true,
      props: {},
      children: [
        { id: `${id}__label`, type: "Text", props: { slot: "label" } },
        ...(withDescriptionSlot
          ? [
              {
                id: `${id}__description`,
                type: "Text",
                props: { slot: "description" },
              },
            ]
          : []),
      ],
    });
    body.children.push(
      originOf("component-gridlist-item-default", true),
      originOf("user-card", false),
    );
    const map = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.get("gridlist-1")?.rowHeight).toBe(50);
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

  it("bounded height 없음 → A2 scroll 제외, ADR-157 sample resolution (mode:'sample', maxScroll 없음)", () => {
    // Phase 4 이전 계약(auto-height GridList 전량 제외)에서 전환: auto-height >10 은 A2 scroll
    //   window(viewportHeight/maxScrollTop)는 아니지만 샘플 정책 대상이다(mode:'sample').
    const map = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({ itemCount: 1000, style: { overflowY: "auto" } }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("gridlist-1");
    expect(entry?.mode).toBe("sample");
    expect(entry?.maxScrollTop).toBeUndefined(); // A2 scroll window 아님
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
    // 시각 window {0,13}(행) × 2 = item {0,26} → 26 카드 (10000 아님).
    expect(cardNodes).toHaveLength(26);
    // scrollTop 0 → lead spacer 없음, trailing spacer 1개(시각 행 5000-13 × 60).
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
    // ADR-150 A2': window item {6,44} → 시각 행 [3,22). lead = top(3) − gap = 3×62 − 12 = 174,
    //   trail = 행 영역 − top(22) (행 영역 = 5000×50 + 4999×12). spacer 뒤 gap 은 행 묶음 rowGap 이 넣는다.
    const lead = spacers.find((s) => s.pos === "lead");
    const trail = spacers.find((s) => s.pos === "trail");
    expect(lead?.h).toBe(3 * 62 - 12);
    expect(trail?.h).toBe(5000 * 50 + 4999 * 12 - 22 * 62);
  });
});

// ── ADR-150 A2 Table 확산 (header 상시 + data 행 windowing) ─────────────────

function tableDoc(opts: {
  rowCount: number;
  style?: Record<string, unknown>;
  size?: "sm" | "md" | "lg";
  asRefInstance?: boolean;
  /** origin (`component-table`) props — ref instance 가 상속한다. */
  originProps?: Record<string, unknown>;
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
  // 값 없는 키는 싣지 않는다 — `size: undefined` 는 ref instance patch 에서 origin 값을 덮는다.
  const commonProps = {
    columns,
    rows,
    ...(opts.size ? { size: opts.size } : {}),
    ...(opts.style ? { style: opts.style } : {}),
  };
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
            children: [
              ...(opts.originProps
                ? [
                    {
                      id: "component-table",
                      type: "Table",
                      props: opts.originProps,
                      children: [],
                    },
                  ]
                : []),
              owner,
            ],
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
    // ADR-150 A2': 헤더 44 가 행 영역 앞 여백 → 보이는 data 영역 [−44, 356) → 끝 ceil(356/44)=9,
    //   overscan 6 → {0,15} (구 {0,16} 은 헤더가 viewport 를 차지하는 것을 무시했다).
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 15 });
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

  it("ref 인스턴스는 origin 의 size 를 상속한다 — 팔레트 Table (origin sm) 행 36 (ADR-150 Phase 1 live)", () => {
    const doc = tableDoc({
      rowCount: 500,
      style: SCROLLABLE,
      asRefInstance: true,
      originProps: { size: "sm" },
    });
    const entry = resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
    }).get("table-1");
    expect(entry?.rowHeight).toBe(36);
    const positions = resolveCollectionRowPositions({
      doc,
      collections: [],
      scrollTops: new Map(),
      ownerId: "table-1",
    });
    expect(positions?.heights[0]).toBe(36);
    // 헤더 (projection 헤더 행 = 행 높이) 36 + 500 × 36 − viewport 400.
    expect(positions?.maxScrollTop).toBe(36 + 500 * 36 - 400);
  });

  it("quick connect 모양 (ref instance + mode C 자기 열) 은 요소 헤더 = Column 셀 높이 (ADR-150 Phase 1 live)", () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({
      id: `r${i}`,
      a: `a${i}`,
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
                  id: "component-table",
                  type: "Table",
                  props: { size: "sm" },
                  children: [
                    {
                      id: "component-table__1",
                      type: "TableHeader",
                      props: {},
                      children: [],
                    },
                    {
                      id: "component-table__2",
                      type: "TableBody",
                      props: {},
                      children: [],
                    },
                  ],
                },
                {
                  id: "component-table-column",
                  type: "Column",
                  props: {},
                  children: [],
                },
                {
                  id: "table-1",
                  type: "ref",
                  name: "Table",
                  ref: "component-table",
                  props: { rows, style: SCROLLABLE },
                  descendants: {
                    "component-table__1": {
                      children: [
                        {
                          id: "col-a",
                          type: "ref",
                          ref: "component-table-column",
                          props: { key: "a", children: "A" },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
    const positions = resolveCollectionRowPositions({
      doc,
      collections: [],
      scrollTops: new Map(),
      ownerId: "table-1",
    });
    // 헤더 = Column md 셀 (lineHeight 24 + paddingY 8·2) 40 · data 행 = origin sm 36.
    expect(positions?.leadingExtent).toBe(40);
    expect(positions?.heights[0]).toBe(36);
    expect(positions?.maxScrollTop).toBe(40 + 500 * 36 - 400);
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
    // header 는 항상 1개, data 행은 window 15개 (10000 아님 — ADR-150 A2' 헤더 여백 반영).
    expect(headerRows).toHaveLength(1);
    expect(dataRows).toHaveLength(15);
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
  it("ListBox: maxScrollTop = inset + 행 영역 (행 + gap) + inset − viewportHeight", () => {
    const entry = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 1000, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map(),
    }).get("listbox-1");
    // ADR-150 A2': 행 영역 1000×32 + 999×2 = 33998, scroll content 5 + 33998 + 5 = 34008,
    //   maxScrollTop 34008 − 400 = 33608 (구 계약 32000 / 31600 은 gap · inset 을 빼먹었다 — 끝 행 미도달).
    expect(entry?.viewportHeight).toBe(400);
    expect(entry?.rowsExtent).toBe(33998);
    expect(entry?.contentHeight).toBe(34008);
    expect(entry?.maxScrollTop).toBe(33608);
  });

  it("content 가 viewport 안에 들어가면 maxScrollTop 0 (스크롤 불가)", () => {
    const entry = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 10, style: SCROLLABLE }),
      collections: [],
      scrollTops: new Map(),
    }).get("listbox-1");
    // ADR-150 A2': scroll content 5 + (10×32 + 9×2) + 5 = 348 < viewport 400 → max(0, 348−400)=0.
    expect(entry?.contentHeight).toBe(348);
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
    expect(at0).toBe(33608);
    expect(at2800).toBe(33608);
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
    // ADR-150 A2': 시각 행 500 × 카드 50 + 499 × gap 12 = 30988 (owner inset 0), maxScrollTop 30588.
    expect(entry?.contentHeight).toBe(30988);
    expect(entry?.maxScrollTop).toBe(30588);
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

// ── ADR-157 Phase 4: GridList / Table auto-height 샘플 resolution + hatch 확산 ──────

describe("resolveVirtualizedCollectionWindows — ADR-157 Phase 4 sample (GridList/Table)", () => {
  it("GridList stack auto-height >10 → mode:'sample' window [0,10] columns 1 stride 60", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({
        itemCount: 1000,
        style: { overflowY: "auto" },
        layout: "stack",
      }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("gridlist-1");
    expect(entry?.mode).toBe("sample");
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 10 });
    expect(entry?.totalRows).toBe(1000);
    expect(entry?.rowHeight).toBe(50);
    expect(entry?.columns).toBe(1);
    // sample 은 스크롤 아님 → viewport/maxScroll 미설정.
    expect(entry?.maxScrollTop).toBeUndefined();
  });

  it("GridList grid(columns 2) auto-height >10 → mode:'sample' columns 2 (item window [0,10])", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({
        itemCount: 1000,
        style: { overflowY: "auto" },
        layout: "grid",
        columns: 2,
      }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("gridlist-1");
    expect(entry?.mode).toBe("sample");
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 10 });
    expect(entry?.columns).toBe(2);
    expect(entry?.rowHeight).toBe(50);
  });

  it("GridList auto-height ≤10 → 전량 투영(sample resolution 없음)", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: gridListDoc({ itemCount: 6, style: { overflowY: "auto" } }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.has("gridlist-1")).toBe(false);
  });

  it("Table auto-height >10 → mode:'sample' window [0,10] rowHeight 44(md) columns 1", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: tableDoc({
        rowCount: 1000,
        style: { overflowY: "auto" },
        size: "md",
      }),
      collections: [],
      scrollTops: new Map(),
    });
    const entry = map.get("table-1");
    expect(entry?.mode).toBe("sample");
    expect(entry?.window).toEqual({ startIndex: 0, endIndex: 10 });
    expect(entry?.totalRows).toBe(1000);
    expect(entry?.rowHeight).toBe(44);
    expect(entry?.columns).toBe(1);
    expect(entry?.maxScrollTop).toBeUndefined();
  });

  it("Table auto-height ≤10 → 전량 투영(sample resolution 없음)", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: tableDoc({ rowCount: 9, style: { overflowY: "auto" } }),
      collections: [],
      scrollTops: new Map(),
    });
    expect(map.has("table-1")).toBe(false);
  });
});

describe("ADR-157 Phase 4 — GridList/Table 샘플 + hatch remainder (scene emit)", () => {
  it("GridList grid(cols 2) sample → 10 카드 + hatch 1개 + owner 주입 visualRows×stride", () => {
    const doc = gridListDoc({
      itemCount: 1000,
      style: { overflowY: "auto" },
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
    expect(
      model.sceneNodes.filter((n) => n.projection?.kind === "gridlist-row"),
    ).toHaveLength(10);
    const remainder = model.sceneNodes.filter(
      (n) => n.projection?.kind === "collection-remainder",
    );
    expect(remainder).toHaveLength(1);
    // trailing 은 hatch 이지 빈 spacer 아님 (sample mode).
    expect(
      model.sceneNodes.filter((n) => n.projection?.kind === "gridlist-spacer"),
    ).toHaveLength(0);
    expect(remainder[0]?.id.startsWith("projection:")).toBe(true);
    // ADR-150 A2': hatch height = 행 영역 − top(5) (시각 행 500, sample 5 시각 행, stride 62). hiddenRows 495.
    const style = remainder[0]?.props?.style as { height?: number } | undefined;
    expect(style?.height).toBe(500 * 50 + 499 * 12 - 5 * 62);
    expect(
      (remainder[0]?.projection as { hiddenRows?: number } | undefined)
        ?.hiddenRows,
    ).toBe(495);
    // owner 주입 = 행 영역 = 500 × 50 + 499 × 12 (§1.55c 소비, 배치 진실성 — 구 500 × 60 은 gap 1 개를 더 셌다).
    const owner = model.sceneNodes.find(
      (n) => (n.type ?? "").toLowerCase() === "gridlist",
    );
    expect(
      (owner?.props as { _projectedRowsContentHeight?: number } | undefined)
        ?._projectedRowsContentHeight,
    ).toBe(500 * 50 + 499 * 12);
  });

  it("Table sample → header + 10 data 행 + hatch 1개, owner 주입 없음(child-sum)", () => {
    const doc = tableDoc({
      rowCount: 1000,
      style: { overflowY: "auto" },
      size: "md",
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
    // data 행만 10 (header 는 kind:'table-row' isHeader — 별도 계수).
    const dataRows = model.sceneNodes.filter(
      (n) =>
        n.projection?.kind === "table-row" &&
        !(n.projection as { isHeader?: boolean }).isHeader,
    );
    expect(dataRows).toHaveLength(10);
    const remainder = model.sceneNodes.filter(
      (n) => n.projection?.kind === "collection-remainder",
    );
    expect(remainder).toHaveLength(1);
    // trailing 은 hatch 이지 빈 table-spacer 아님.
    expect(
      model.sceneNodes.filter((n) => n.projection?.kind === "table-spacer"),
    ).toHaveLength(0);
    // hatch height = trail(990) × 44. hiddenRows 990.
    const style = remainder[0]?.props?.style as { height?: number } | undefined;
    expect(style?.height).toBe(990 * 44);
    expect(
      (remainder[0]?.projection as { hiddenRows?: number } | undefined)
        ?.hiddenRows,
    ).toBe(990);
    // Table 은 child-sum 경로 → owner 높이 주입 없음(_projectedRowsContentHeight 미설정).
    const owner = model.sceneNodes.find(
      (n) => (n.type ?? "").toLowerCase() === "table",
    );
    expect(
      (owner?.props as { _projectedRowsContentHeight?: number } | undefined)
        ?._projectedRowsContentHeight,
    ).toBeUndefined();
  });
});

describe("ADR-150 Phase 1 판독 M1 — 행 높이 목록 캐시 (문서 복제 뒤 재사용 · 입력 변경 시 갱신)", () => {
  const COLLECTIONS: never[] = [];
  function listDoc(
    items: Array<Record<string, unknown>>,
    extraProps: Record<string, unknown> = {},
  ): CompositionDocument {
    return {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "cache-list",
              type: "ListBox",
              props: {
                items,
                style: { height: 400, width: 400, overflowY: "auto" },
                ...extraProps,
              },
              children: [],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
  }
  const extentOf = (doc: CompositionDocument) =>
    resolveVirtualizedCollectionWindows({
      doc,
      collections: COLLECTIONS,
      scrollTops: new Map(),
    }).get("cache-list")!.rowsExtent!;
  const plain = Array.from({ length: 200 }, (_, i) => ({
    id: `k${i}`,
    label: `Item ${i}`,
  }));

  it("행 데이터가 바뀌면 (새 배열) 높이 목록을 다시 만든다", () => {
    const before = extentOf(listDoc(plain));
    const withDescription = plain.map((row, i) =>
      i === 0 ? { ...row, description: "added" } : row,
    );
    expect(extentOf(listDoc(withDescription))).toBe(before + 18);
    // 같은 배열 참조로 되돌리면 원래 값.
    expect(extentOf(listDoc(plain))).toBe(before);
  });

  it("다른 prop 만 바뀐 복제 문서는 같은 값 (서명의 값 참조 비교)", () => {
    const before = extentOf(listDoc(plain));
    expect(extentOf(listDoc(plain, { "aria-label": "edited" }))).toBe(before);
  });
});

describe("ADR-150 Phase 1 판독 M2 — 행 템플릿의 state 템플릿 `{{ }}` 은 scene 과 같은 env 로 푼다", () => {
  function docWithDescriptionTemplate(
    text: string | null,
  ): CompositionDocument {
    const doc = ensureListBoxTemplateOrigins({
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "state-list",
              type: "ListBox",
              props: {
                items: Array.from({ length: 100 }, (_, i) => ({
                  id: `k${i}`,
                  label: `Item ${i}`,
                })),
                style: { height: 400, width: 400, overflowY: "auto" },
              },
              children: [
                {
                  id: "state-anchor",
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
    } as unknown as CompositionDocument);
    if (text != null) {
      const origin = flattenCanonicalDocumentNodes(doc).find(
        (n) => n.id === "component-listbox-item-default",
      )!;
      const description = origin.children!.find(
        (c) =>
          (c.props as { slot?: string } | undefined)?.slot === "description",
      )!;
      (description.props as Record<string, unknown>).children = text;
    }
    return doc;
  }
  const extent = (doc: CompositionDocument, projectVariables?: VariableDef[]) =>
    resolveVirtualizedCollectionWindows({
      doc,
      collections: [],
      scrollTops: new Map(),
      projectVariables,
    }).get("state-list")!.rowsExtent!;

  it('description 슬롯 `{{ subtitle }}` (기본값 "") → 행에 description 없음 = 32 행', () => {
    const variables: VariableDef[] = [
      { id: "v-subtitle", name: "subtitle", type: "string", defaultValue: "" },
    ];
    const baseline = extent(docWithDescriptionTemplate(null));
    expect(
      extent(docWithDescriptionTemplate("{{ subtitle }}"), variables),
    ).toBe(baseline);
  });
});

describe("ADR-150 Phase 1 판독 M3 — GridList · Table owner 여백은 responsive override 를 반영한다", () => {
  function ownerDoc(type: "GridList" | "Table"): CompositionDocument {
    const rows = Array.from({ length: 200 }, (_, i) => ({
      id: `r${i}`,
      label: `Row ${i}`,
      a: `a${i}`,
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
              id: "resp-owner",
              type,
              props: {
                ...(type === "Table"
                  ? { rows, columns: [{ id: "a", label: "A", width: 100 }] }
                  : { items: rows, layout: "grid", columns: 2 }),
                style: { height: 300, width: 400, overflowY: "auto" },
              },
              responsive: {
                styles: {
                  paddingTop: { mobile: "16px" },
                  paddingBottom: { mobile: "16px" },
                },
              },
              children: [],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
  }
  it.each(["GridList", "Table"] as const)(
    "%s: mobile 에서 앞 여백 +16 · 스크롤 범위 +32",
    (type) => {
      const at = (activeBreakpoint: "desktop" | "mobile") =>
        resolveCollectionRowPositions({
          doc: ownerDoc(type),
          collections: [],
          scrollTops: new Map(),
          ownerId: "resp-owner",
          activeBreakpoint,
        })!;
      const desktop = at("desktop");
      const mobile = at("mobile");
      expect(mobile.leadingExtent - desktop.leadingExtent).toBe(16);
      expect(mobile.maxScrollTop - desktop.maxScrollTop).toBe(32);
    },
  );
});

describe("ADR-150 Phase 1 수리 검증 M-a — 삭제된 owner 의 행 높이 서명 캐시는 지운다", () => {
  it("owner 가 문서에서 빠지면 다음 resolver 호출에서 항목이 사라진다", () => {
    const withOwner = listBoxDoc({
      itemCount: 200,
      style: { height: 400, width: 400, overflowY: "auto" },
    });
    resolveVirtualizedCollectionWindows({
      doc: withOwner,
      collections: [],
      scrollTops: new Map(),
    });
    expect(__rowHeightCacheSizeForTest()).toBeGreaterThan(0);
    resolveVirtualizedCollectionWindows({
      doc: {
        version: "composition-1.0",
        children: [],
      } as unknown as CompositionDocument,
      collections: [],
      scrollTops: new Map(),
    });
    expect(__rowHeightCacheSizeForTest()).toBe(0);
  });
});
