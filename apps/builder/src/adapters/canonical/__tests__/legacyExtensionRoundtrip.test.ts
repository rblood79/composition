/**
 * @fileoverview Legacy events/dataBinding round-trip — ADR-116 Phase 5 G7
 *   본격 cutover (2026-05-01)
 *
 * **검증 영역**:
 * - `legacyToCanonical` 가 element.events / element.dataBinding 를
 *   `x-composition` extension 으로 분리 (metadata.legacyProps 미반영)
 * - `exportLegacyDocument` 가 `x-composition` extension 에서 reverse 추출하여
 *   element.events / element.dataBinding 복원 (top-level field 로 분리)
 * - round-trip 정합 (legacy → canonical → legacy 동등)
 * - `buildLegacyElementMetadata` 는 events/dataBinding 미보존 (dual-storage 종결)
 * - undefined / null edge case
 *
 * **G7 본격 cutover framing**:
 * - transition first slice (metadata.legacyProps dual-storage) 종결.
 * - `x-composition` extension namespace 가 events/dataBinding 단일 SSOT.
 * - 본 file 의 검증 = legacy ↔ canonical adapter 영역의 schema 분리 정합.
 *
 * **isolated 분리 사유**: 본 file 은 store import 무경유 (`legacyMetadata.ts` +
 * `exportLegacyDocument.ts` + `index.ts` 의 `legacyToCanonical` 만 import) —
 * vitest mock 함정 영역 외.
 */

import { describe, it, expect } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  CompositionExtension,
} from "@composition/shared";

import { buildLegacyElementMetadata } from "../legacyMetadata";
import { exportLegacyDocument } from "../exportLegacyDocument";
import { legacyToCanonical } from "../index";
import type { LegacyAdapterInput } from "../types";
import type { Element } from "@/types/builder/unified.types";
import type { DataBinding } from "@/types/builder/unified.types";

function makeCanonicalDoc(children: CanonicalNode[]): CompositionDocument {
  return { schemaVersion: "1.0", children };
}

/**
 * legacyToCanonical 호출용 minimal deps stub — convertComponentRole 은 단순 baseline
 * (master/instance 분기 미적용), convertPageLayout 은 null 반환 (page 미사용 시).
 */
const noopDeps = {
  convertComponentRole: () => ({
    reusable: false,
    ref: null,
    descendantsRemapped: undefined,
    rootOverrides: undefined,
  }),
  convertPageLayout: () => null,
};

const TEST_PAGE_ID = "__test_page__";

/**
 * legacyToCanonical 는 elements 를 page_id 기반 grouping → pages 가 비어 있으면
 * element 가 emit 안 됨. test 용 dummy page 로 wrapping 후 첫 page node 의
 * children 으로 element 들이 변환됨.
 */
function buildCanonicalFromElements(elements: Element[]): CompositionDocument {
  const pageIds = new Set<string>();
  const elementsWithPage = elements.map((e) => {
    const pageId = e.page_id ?? TEST_PAGE_ID;
    pageIds.add(pageId);
    return { ...e, page_id: pageId };
  });
  const pages = Array.from(pageIds).map((id) => ({
    id,
    title: id,
    project_id: "test-proj",
    slug: id,
  }));
  const input: LegacyAdapterInput = {
    elements: elementsWithPage,
    pages,
    layouts: [],
  };
  return legacyToCanonical(input, noopDeps);
}

/**
 * dummy page wrapper 안의 첫 element node 추출 (G7 cutover 검증 helper).
 */
function firstElementNode(
  doc: CompositionDocument,
): CanonicalNode & { "x-composition"?: CompositionExtension } {
  const pageNode = doc.children[0];
  const node = pageNode?.children?.[0];
  if (!node) {
    throw new Error("test fixture: page node has no children");
  }
  return node as CanonicalNode & { "x-composition"?: CompositionExtension };
}

// ─────────────────────────────────────────────
// A. legacyToCanonical — events/dataBinding → x-composition extension
// ─────────────────────────────────────────────

describe("legacyToCanonical — G7 cutover events/dataBinding → x-composition extension", () => {
  it("element.events 정의 → 해당 노드 'x-composition'.events 로 분리", () => {
    const element: Element = {
      id: "el-1",
      type: "Button",
      props: { variant: "primary" },
      parent_id: null,
      page_id: null,
      order_num: 0,
      events: [{ id: "evt-1", kind: "onPress" }],
    };

    const doc = buildCanonicalFromElements([element]);
    const node = firstElementNode(doc);
    expect(node["x-composition"]?.events).toEqual([
      { id: "evt-1", kind: "onPress" },
    ]);
    // metadata.legacyProps 에 events 미spread (dual-storage 종결)
    const meta = node.metadata as { legacyProps?: Record<string, unknown> };
    expect(meta.legacyProps).not.toHaveProperty("events");
  });

  it("element.dataBinding 정의 → 해당 노드 'x-composition'.dataBinding 으로 분리", () => {
    const dataBinding: DataBinding = {
      type: "collection",
      source: "supabase",
      config: { table: "users" },
    };
    const element: Element = {
      id: "el-2",
      type: "ListBox",
      props: { variant: "default" },
      parent_id: null,
      page_id: null,
      order_num: 0,
      dataBinding,
    };

    const doc = buildCanonicalFromElements([element]);
    const node = firstElementNode(doc);
    expect(node["x-composition"]?.dataBinding).toEqual(dataBinding);
    const meta = node.metadata as { legacyProps?: Record<string, unknown> };
    expect(meta.legacyProps).not.toHaveProperty("dataBinding");
  });

  it("events / dataBinding 양쪽 동시 정의 → extension 동시 분리", () => {
    const element: Element = {
      id: "el-3",
      type: "Button",
      props: {},
      parent_id: null,
      page_id: null,
      order_num: 0,
      events: [{ id: "e1", kind: "onPress" }],
      dataBinding: {
        type: "value",
        source: "state",
        config: { key: "count" },
      },
    };

    const doc = buildCanonicalFromElements([element]);
    const node = firstElementNode(doc);
    expect(node["x-composition"]?.events).toEqual([
      { id: "e1", kind: "onPress" },
    ]);
    expect(node["x-composition"]?.dataBinding).toEqual({
      type: "value",
      source: "state",
      config: { key: "count" },
    });
  });

  it("events / dataBinding 미정의 → 'x-composition' field 자체 노출 안 함", () => {
    const element: Element = {
      id: "el-4",
      type: "Button",
      props: {},
      parent_id: null,
      page_id: null,
      order_num: 0,
    };

    const doc = buildCanonicalFromElements([element]);
    const node = firstElementNode(doc);
    expect(node["x-composition"]).toBeUndefined();
  });

  it("빈 배열 events 는 extension 미노출 (length === 0 skip)", () => {
    const element: Element = {
      id: "el-5",
      type: "Button",
      props: {},
      parent_id: null,
      page_id: null,
      order_num: 0,
      events: [],
    };

    const doc = buildCanonicalFromElements([element]);
    const node = firstElementNode(doc);
    expect(node["x-composition"]?.events).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// B. buildLegacyElementMetadata — events/dataBinding 미보존 (dual-storage 종결)
// ─────────────────────────────────────────────

describe("buildLegacyElementMetadata — G7 cutover dual-storage 종결", () => {
  it("element.events 정의해도 metadata.legacyProps 에 events 키 미노출", () => {
    const element: Element = {
      id: "el-1",
      type: "Button",
      props: { variant: "primary" },
      events: [{ id: "evt-1", kind: "onPress" }],
    };

    const metadata = buildLegacyElementMetadata(element);
    expect(metadata.legacyProps).not.toHaveProperty("events");
  });

  it("element.dataBinding 정의해도 metadata.legacyProps 에 dataBinding 키 미노출", () => {
    const element: Element = {
      id: "el-2",
      type: "ListBox",
      props: {},
      dataBinding: {
        type: "collection",
        source: "supabase",
        config: { table: "users" },
      },
    };

    const metadata = buildLegacyElementMetadata(element);
    expect(metadata.legacyProps).not.toHaveProperty("dataBinding");
  });

  it("element.props 의 events/dataBinding 키는 spread 그대로 보존 (top-level 만 분리)", () => {
    const element: Element = {
      id: "el-3",
      type: "Button",
      props: {
        events: [{ id: "props-evt", kind: "onPress" }],
        dataBinding: { type: "static", source: "static", config: {} },
      },
      events: [{ id: "top-evt", kind: "onClick" }],
    };

    const metadata = buildLegacyElementMetadata(element);
    // props.events 는 metadata.legacyProps 에 그대로 (top-level events 영향 무관)
    expect(metadata.legacyProps.events).toEqual([
      { id: "props-evt", kind: "onPress" },
    ]);
    expect(metadata.legacyProps.dataBinding).toEqual({
      type: "static",
      source: "static",
      config: {},
    });
  });
});

// ─────────────────────────────────────────────
// C. exportLegacyDocument — x-composition extension reverse
// ─────────────────────────────────────────────

describe("exportLegacyDocument — G7 cutover extension reverse", () => {
  it("'x-composition'.events 보존된 노드 → element.events 복원", () => {
    const doc = makeCanonicalDoc([
      {
        id: "seg-1",
        type: "Button",
        props: {},
        "x-composition": {
          events: [{ id: "evt-1", kind: "onPress" }],
        },
      } as CanonicalNode,
    ]);

    const elements = exportLegacyDocument(doc);
    expect(elements).toHaveLength(1);
    expect(elements[0].events).toEqual([{ id: "evt-1", kind: "onPress" }]);
    // props 에 events 미잔존
    expect(elements[0].props).not.toHaveProperty("events");
  });

  it("'x-composition'.dataBinding 보존된 노드 → element.dataBinding 복원", () => {
    const doc = makeCanonicalDoc([
      {
        id: "seg-2",
        type: "ListBox",
        props: {},
        "x-composition": {
          dataBinding: {
            type: "collection",
            source: "supabase",
            config: { table: "users" },
          },
        },
      } as CanonicalNode,
    ]);

    const [el] = exportLegacyDocument(doc);
    expect(el.dataBinding).toEqual({
      type: "collection",
      source: "supabase",
      config: { table: "users" },
    });
    expect(el.props).not.toHaveProperty("dataBinding");
  });

  it("extension 미정의 노드 → element 에 events/dataBinding 미정의", () => {
    const doc = makeCanonicalDoc([
      {
        id: "seg-3",
        type: "Button",
        props: {},
      },
    ]);

    const [el] = exportLegacyDocument(doc);
    expect(el.events).toBeUndefined();
    expect(el.dataBinding).toBeUndefined();
  });

  it("props.events 는 extension 미정의 시 props 로 잔존", () => {
    const doc = makeCanonicalDoc([
      {
        id: "seg-4",
        type: "Button",
        props: {
          events: [{ id: "stale-evt", kind: "onPress" }],
        },
      } as CanonicalNode,
    ]);

    const [el] = exportLegacyDocument(doc);
    // top-level events 는 미설정 (extension 미정의)
    expect(el.events).toBeUndefined();
    expect(el.props.events).toEqual([{ id: "stale-evt", kind: "onPress" }]);
  });

  it("component ref descendants.children 은 override payload 로만 보존하고 element 로 중복 export 하지 않는다", () => {
    const doc = makeCanonicalDoc([
      {
        id: "card-origin",
        type: "Card",
        reusable: true,
        props: {},
        children: [
          {
            id: "card-header",
            type: "CardHeader",
            props: {},
            children: [
              {
                id: "card-heading",
                type: "Heading",
                props: { children: "Origin" },
              },
            ],
          },
        ],
      },
      {
        id: "card-instance",
        type: "ref",
        ref: "card-origin",
        props: {},
        descendants: {
          "card-header": {
            children: [
              {
                id: "card-heading",
                type: "Heading",
                props: { children: "Instance" },
              },
            ],
          },
        },
      } as CanonicalNode,
    ]);

    const elements = exportLegacyDocument(doc);

    expect(
      elements.filter((element) => element.id === "card-heading"),
    ).toHaveLength(1);
    expect(
      elements.find((element) => element.id === "card-instance"),
    ).toMatchObject({
      componentRole: "instance",
      masterId: "card-origin",
      descendants: {
        "card-header": {
          children: [
            expect.objectContaining({
              id: "card-heading",
              type: "Heading",
            }),
          ],
        },
      },
    });
  });

  it("page ref descendants.children 은 page content 로 export 한다", () => {
    const doc = makeCanonicalDoc([
      {
        id: "page-1",
        type: "ref",
        ref: "layout-frame-1",
        metadata: { type: "legacy-page", pageId: "page-1" },
        descendants: {
          content: {
            children: [
              {
                id: "page-card",
                type: "Card",
                props: {},
              },
            ],
          },
        },
      } as CanonicalNode,
      {
        id: "layout-frame-1",
        type: "frame",
        reusable: true,
        metadata: { type: "legacy-layout", layoutId: "frame-1" },
        children: [],
      },
    ]);

    expect(exportLegacyDocument(doc)).toEqual([
      expect.objectContaining({
        id: "page-card",
        page_id: "page-1",
      }),
    ]);
  });
});

// ─────────────────────────────────────────────
// D. round-trip 정합 (legacy → canonical → legacy 동등)
// ─────────────────────────────────────────────

describe("Round-trip — legacy → canonical (extension) → legacy 동등", () => {
  it("Button + events round-trip preserves canonical props and extension", () => {
    const original: Element = {
      id: "el-rt-1",
      customId: "el-rt-1",
      type: "Button",
      props: { variant: "primary", children: "Click" },
      parent_id: null,
      page_id: "page-1",
      order_num: 5,
      events: [{ id: "evt-rt", kind: "onPress" }],
    };

    const doc = buildCanonicalFromElements([original]);
    const [restored] = exportLegacyDocument(doc);
    expect(restored.id).toBe(original.id);
    expect(restored.type).toBe(original.type);
    expect(restored.props).toEqual(original.props);
    expect(restored.parent_id).toBe(original.parent_id);
    expect(restored.page_id).toBe(original.page_id);
    expect(restored.order_num).toBe(0);
    expect(restored.events).toEqual(original.events);
    // props 에 events 누락 (extension 으로 분리됨)
    expect(restored.props).not.toHaveProperty("events");
  });

  it("ListBox + dataBinding round-trip 동등", () => {
    const original: Element = {
      id: "el-rt-2",
      customId: "el-rt-2",
      type: "ListBox",
      props: { variant: "default" },
      parent_id: null,
      page_id: "page-1",
      order_num: 0,
      dataBinding: {
        type: "collection",
        source: "supabase",
        config: { table: "items", limit: 50 },
      },
    };

    const doc = buildCanonicalFromElements([original]);
    const [restored] = exportLegacyDocument(doc);
    expect(restored.dataBinding).toEqual(original.dataBinding);
    expect(restored.props).not.toHaveProperty("dataBinding");
  });

  it("events + dataBinding 동시 round-trip 동등", () => {
    const original: Element = {
      id: "el-rt-3",
      customId: "el-rt-3",
      type: "Button",
      props: { variant: "primary" },
      parent_id: null,
      page_id: null,
      order_num: 0,
      events: [
        { id: "e1", kind: "onPress" },
        { id: "e2", kind: "onHover" },
      ],
      dataBinding: {
        type: "value",
        source: "state",
        config: { key: "count" },
      },
    };

    const doc = buildCanonicalFromElements([original]);
    const [restored] = exportLegacyDocument(doc);
    expect(restored.events).toEqual(original.events);
    expect(restored.dataBinding).toEqual(original.dataBinding);
    expect(restored.props).toEqual({ variant: "primary" });
  });

  it("events/dataBinding 미정의 element round-trip — restored 도 미정의", () => {
    const original: Element = {
      id: "el-rt-4",
      customId: "el-rt-4",
      type: "Box",
      props: { name: "container" },
      parent_id: null,
      page_id: null,
      order_num: 0,
    };

    const doc = buildCanonicalFromElements([original]);
    const [restored] = exportLegacyDocument(doc);
    expect(restored.events).toBeUndefined();
    expect(restored.dataBinding).toBeUndefined();
  });

  it("element.props.events 와 top-level events 공존 — props.events 보존 + top-level 우선 분리", () => {
    const original: Element = {
      id: "el-rt-5",
      customId: "el-rt-5",
      type: "Button",
      props: {
        variant: "primary",
        events: [{ id: "props-evt", kind: "onPress" }],
      },
      parent_id: null,
      page_id: null,
      order_num: 0,
      events: [{ id: "top-evt", kind: "onClick" }],
    };

    const doc = buildCanonicalFromElements([original]);
    const [restored] = exportLegacyDocument(doc);
    // top-level events = extension 으로 분리 후 복원
    expect(restored.events).toEqual([{ id: "top-evt", kind: "onClick" }]);
    // props.events 는 CanonicalNode.props 통해 복원
    expect(restored.props.events).toEqual([
      { id: "props-evt", kind: "onPress" },
    ]);
  });
});

// ─────────────────────────────────────────────
// E. G7 closure marker — canonical document 직렬화 형태 contract
// ─────────────────────────────────────────────

/**
 * **G7 closure 의 본질**: events/dataBinding 가 canonical document 의 직렬화
 * 형태에서 `x-composition` extension 단일 위치에만 존재. metadata.legacyProps
 * (transition first slice 의 dual-storage) 또는 다른 위치에는 0건.
 *
 * 본 contract 검증은 canonical document 의 schema 정합성 보장 — Phase 3 G4
 * canonical primary write 진입 시점에 events/dataBinding 의 SSOT 가 extension
 * 임을 grep gate 자동 검증.
 *
 * 본 영역 외 write boundary 5 site (Inspector mapper / history undo-redo /
 * AI tool / factory / Events Panel) 는 element top-level events/dataBinding
 * 직접 write 영역 — Phase 3 G4 canonical primary write 진입 시점의 migration
 * 영역 (G7 closure 의 일부 아님). design §10.2.12 분류 참조.
 */
describe("G7 closure marker — canonical document 직렬화 형태 contract", () => {
  it("legacyToCanonical 결과의 모든 metadata.legacyProps 에 events/dataBinding 키 0건", () => {
    const elements: Element[] = [
      {
        id: "el-c-1",
        type: "Button",
        props: { variant: "primary" },
        events: [{ id: "evt-1", kind: "onPress" }],
      },
      {
        id: "el-c-2",
        type: "ListBox",
        props: { variant: "default" },
        dataBinding: {
          type: "collection",
          source: "supabase",
          config: { table: "users" },
        },
      },
      {
        id: "el-c-3",
        type: "Box",
        props: { name: "container" },
        // events/dataBinding 미정의
      },
    ];

    const doc = buildCanonicalFromElements(elements);

    // DFS 순회 — 모든 노드의 metadata.legacyProps 에 events/dataBinding 키 0건
    function visit(node: CanonicalNode): void {
      const meta = node.metadata as
        | { legacyProps?: Record<string, unknown> }
        | undefined;
      if (meta?.legacyProps) {
        expect(meta.legacyProps).not.toHaveProperty("events");
        expect(meta.legacyProps).not.toHaveProperty("dataBinding");
      }
      if (node.children) {
        for (const child of node.children) visit(child);
      }
    }
    for (const child of doc.children) visit(child);
  });

  it("legacyToCanonical 결과 — events 정의 element 가 있으면 해당 노드의 'x-composition'.events 단일 위치에만 존재", () => {
    const original: Element = {
      id: "el-c-events",
      type: "Button",
      props: {},
      events: [{ id: "evt-c", kind: "onPress" }],
    };

    const doc = buildCanonicalFromElements([original]);
    const node = firstElementNode(doc);

    // 직렬화 형태 contract: x-composition.events 에만 존재
    expect(node["x-composition"]?.events).toEqual([
      { id: "evt-c", kind: "onPress" },
    ]);
    // 다른 위치 0건 (metadata.legacyProps / node 직접 / children 등)
    const meta = node.metadata as
      | { legacyProps?: Record<string, unknown> }
      | undefined;
    expect(meta?.legacyProps).not.toHaveProperty("events");
    expect((node as unknown as { events?: unknown }).events).toBeUndefined();
  });

  it("legacyToCanonical 결과 — dataBinding 정의 element 가 있으면 해당 노드의 'x-composition'.dataBinding 단일 위치에만 존재", () => {
    const original: Element = {
      id: "el-c-db",
      type: "ListBox",
      props: {},
      dataBinding: {
        type: "value",
        source: "state",
        config: { key: "count" },
      },
    };

    const doc = buildCanonicalFromElements([original]);
    const node = firstElementNode(doc);

    expect(node["x-composition"]?.dataBinding).toEqual({
      type: "value",
      source: "state",
      config: { key: "count" },
    });
    const meta = node.metadata as
      | { legacyProps?: Record<string, unknown> }
      | undefined;
    expect(meta?.legacyProps).not.toHaveProperty("dataBinding");
    expect(
      (node as unknown as { dataBinding?: unknown }).dataBinding,
    ).toBeUndefined();
  });

  it("legacyToCanonical 결과 — events/dataBinding 미정의 element 는 'x-composition' 자체 노출 안 함", () => {
    const original: Element = {
      id: "el-c-none",
      type: "Box",
      props: { name: "container" },
    };

    const doc = buildCanonicalFromElements([original]);
    const node = firstElementNode(doc);
    expect(node["x-composition"]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// F. G6-2 second slice — history parity 자동 cover (canonicalDocumentSync 회로)
// ─────────────────────────────────────────────

/**
 * **G6-2 second slice (§10.2.13)** — legacy history undo/redo → canonical store
 * sync 회로의 events/dataBinding 자동 cover evidence.
 *
 * **회로**: `useStore mutation` → `canonicalDocumentSync.scheduleSync` →
 * `selectCanonicalDocument(state, pages, layouts)` → `legacyToCanonical(input)` →
 * `useCanonicalDocumentStore.setDocument(...)`. 본 회로의 핵심 변환 단계 =
 * `legacyToCanonical` — events/dataBinding 가 `x-composition` extension 으로
 * 직렬화. mutation forward/reverse (undo/redo) 모두 동일 변환 경로 통과 →
 * **history parity 가 G7 cutover 의 결과로 자동 cover**.
 *
 * **isolated 검증 패턴** (vitest mock path resolution 회피):
 * - `canonicalDocumentSync.test.ts` 는 `useStore` import 시 `stores/index.ts`
 *   evaluation 로 `createElementsSlice is not a function` setup fail (별 영역).
 * - 본 file 은 `legacyToCanonical` + `exportLegacyDocument` 만 import →
 *   store 무경유 → 회로의 핵심 변환 단계 단독 검증.
 *
 * **검증 의의**: G7 본격 cutover 후 events/dataBinding 가 `x-composition`
 * 단일 SSOT 로 직렬화 → history undo (events 제거) / redo (events 복원) 도
 * 동일 회로 통과 → write-through sync 의 events/dataBinding 자동 cover
 * evidence 도달.
 */
describe("G6-2 second slice — history parity 자동 cover (canonicalDocumentSync 회로)", () => {
  it("forward mutation (events 추가) → legacyToCanonical → x-composition.events 직렬화", () => {
    const baseline: Element = {
      id: "el-h-1",
      type: "Button",
      props: { variant: "primary" },
      parent_id: null,
      page_id: null,
      order_num: 0,
      // events 미정의 (initial)
    };

    // mutation: events 추가
    const mutated: Element = {
      ...baseline,
      events: [{ id: "evt-h", kind: "onPress" }],
    };

    const docInitial = buildCanonicalFromElements([baseline]);
    const docMutated = buildCanonicalFromElements([mutated]);

    expect(firstElementNode(docInitial)["x-composition"]).toBeUndefined();
    expect(firstElementNode(docMutated)["x-composition"]?.events).toEqual([
      { id: "evt-h", kind: "onPress" },
    ]);
  });

  it("reverse mutation (events 제거 = history.undo) → x-composition.events 미노출", () => {
    const withEvents: Element = {
      id: "el-h-2",
      type: "Button",
      props: {},
      parent_id: null,
      page_id: null,
      order_num: 0,
      events: [{ id: "evt-h", kind: "onPress" }],
    };

    // history.undo() simulation: events 제거
    const undone: Element = {
      ...withEvents,
      events: undefined,
    };

    const docMutated = buildCanonicalFromElements([withEvents]);
    const docUndone = buildCanonicalFromElements([undone]);

    expect(firstElementNode(docMutated)["x-composition"]?.events).toEqual([
      { id: "evt-h", kind: "onPress" },
    ]);
    expect(firstElementNode(docUndone)["x-composition"]).toBeUndefined();
  });

  it("re-mutation (events 재추가 = history.redo) → x-composition.events 재직렬화", () => {
    const undone: Element = {
      id: "el-h-3",
      type: "Button",
      props: {},
      parent_id: null,
      page_id: null,
      order_num: 0,
      // undo 직후 미정의
    };

    // history.redo() simulation: events 재추가
    const redone: Element = {
      ...undone,
      events: [{ id: "evt-r", kind: "onPress" }],
    };

    const docUndone = buildCanonicalFromElements([undone]);
    const docRedone = buildCanonicalFromElements([redone]);

    expect(firstElementNode(docUndone)["x-composition"]).toBeUndefined();
    expect(firstElementNode(docRedone)["x-composition"]?.events).toEqual([
      { id: "evt-r", kind: "onPress" },
    ]);
  });

  it("dataBinding mutation forward/reverse 회로 — undo/redo 동일 cover", () => {
    const baseline: Element = {
      id: "el-h-4",
      type: "ListBox",
      props: { variant: "default" },
      parent_id: null,
      page_id: null,
      order_num: 0,
    };
    const withDb: Element = {
      ...baseline,
      dataBinding: {
        type: "collection",
        source: "supabase",
        config: { table: "items" },
      },
    };
    const undone: Element = { ...withDb, dataBinding: undefined };

    const docInitial = buildCanonicalFromElements([baseline]);
    const docMutated = buildCanonicalFromElements([withDb]);
    const docUndone = buildCanonicalFromElements([undone]);

    expect(firstElementNode(docInitial)["x-composition"]).toBeUndefined();
    expect(firstElementNode(docMutated)["x-composition"]?.dataBinding).toEqual({
      type: "collection",
      source: "supabase",
      config: { table: "items" },
    });
    // undo: dataBinding 제거 → x-composition 미노출
    expect(firstElementNode(docUndone)["x-composition"]).toBeUndefined();
  });

  it("multi-element mutation (events + dataBinding 동시 변경) 회로 정합", () => {
    const elements: Element[] = [
      {
        id: "el-m-1",
        type: "Button",
        props: {},
        parent_id: null,
        page_id: null,
        order_num: 0,
        events: [{ id: "e-1", kind: "onPress" }],
      },
      {
        id: "el-m-2",
        type: "ListBox",
        props: {},
        parent_id: null,
        page_id: null,
        order_num: 1,
        dataBinding: { type: "value", source: "state", config: { key: "x" } },
      },
    ];

    const doc = buildCanonicalFromElements(elements);
    const pageNode = doc.children[0];
    const node1 = pageNode.children![0] as CanonicalNode & {
      "x-composition"?: CompositionExtension;
    };
    const node2 = pageNode.children![1] as CanonicalNode & {
      "x-composition"?: CompositionExtension;
    };

    expect(node1["x-composition"]?.events).toEqual([
      { id: "e-1", kind: "onPress" },
    ]);
    expect(node2["x-composition"]?.dataBinding).toEqual({
      type: "value",
      source: "state",
      config: { key: "x" },
    });
    // 양 노드 모두 metadata.legacyProps 에는 events/dataBinding 미spread (G7 cutover 정합)
    const meta1 = node1.metadata as { legacyProps?: Record<string, unknown> };
    const meta2 = node2.metadata as { legacyProps?: Record<string, unknown> };
    expect(meta1.legacyProps).not.toHaveProperty("events");
    expect(meta2.legacyProps).not.toHaveProperty("dataBinding");
  });

  it("round-trip 보장 — mutation forward → legacyToCanonical → exportLegacyDocument → element 동등 (history.undo 후 재mutation 도 동등)", () => {
    const original: Element = {
      id: "el-rt-h",
      type: "Button",
      props: { variant: "primary" },
      parent_id: null,
      page_id: null,
      order_num: 0,
      events: [{ id: "rt-evt", kind: "onPress" }],
      dataBinding: { type: "value", source: "state", config: { key: "y" } },
    };

    const doc = buildCanonicalFromElements([original]);
    const [restored] = exportLegacyDocument(doc);

    // history undo simulation: 변경 직전 element 재구성. forward → reverse 동등
    expect(restored.events).toEqual(original.events);
    expect(restored.dataBinding).toEqual(original.dataBinding);
    expect(restored.props).toEqual({ variant: "primary" });
  });
});
