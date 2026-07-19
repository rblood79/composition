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

  it("bounded height 없음 → 가상화 제외(unbounded = 스크롤 컨테이너 아님)", () => {
    const map = resolveVirtualizedCollectionWindows({
      doc: listBoxDoc({ itemCount: 1000, style: { overflowY: "auto" } }),
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
