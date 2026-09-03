/**
 * @fileoverview ADR-116 Phase 5 G7 canonical extension contract.
 *
 * Legacy element 입력의 events/dataBinding은 canonical `x-composition`으로만
 * 이동하며 metadata.legacyProps에 중복 저장되지 않는다. 프로젝트 JSON
 * 가져오기/내보내기는 canonical document를 직접 사용하므로 역변환 계약은 없다.
 */

import { describe, expect, it } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  CompositionExtension,
} from "@composition/shared";

import type { DataBinding, Element } from "@/types/builder/unified.types";
import { buildLegacyElementMetadata } from "../legacyMetadata";
import { legacyToCanonical } from "../index";
import { firstUserPageNode } from "./helpers/systemBootstrapNodes";
import type { LegacyAdapterInput } from "../types";

type LegacyEl = Element & {
  order_num?: number;
  reusable?: boolean;
  ref?: string;
};

const noopDeps = {
  convertComponentRole: () => ({
    reusable: false,
    ref: undefined,
    descendantsRemapped: undefined,
    rootOverrides: undefined,
  }),
  convertPageLayout: () => null,
};

const TEST_PAGE_ID = "__test_page__";

function buildCanonicalFromElements(elements: Element[]): CompositionDocument {
  const pageIds = new Set<string>();
  const elementsWithPage = elements.map((element) => {
    const pageId = element.page_id ?? TEST_PAGE_ID;
    pageIds.add(pageId);
    return { ...element, page_id: pageId };
  });
  const input: LegacyAdapterInput = {
    elements: elementsWithPage,
    pages: Array.from(pageIds).map((id) => ({
      id,
      title: id,
      project_id: "test-proj",
      slug: id,
    })),
    layouts: [],
  };
  return legacyToCanonical(input, noopDeps);
}

function firstElementNode(
  doc: CompositionDocument,
): CanonicalNode & { "x-composition"?: CompositionExtension } {
  const node = firstUserPageNode(doc).children?.[0];
  if (!node) throw new Error("test fixture: page node has no children");
  return node as CanonicalNode & {
    "x-composition"?: CompositionExtension;
  };
}

describe("A. legacyToCanonical canonical extension", () => {
  it("events를 x-composition에만 저장한다", () => {
    const doc = buildCanonicalFromElements([
      {
        id: "button",
        type: "Button",
        props: { variant: "primary" },
        parent_id: null,
        page_id: null,
        order_num: 0,
        events: [{ id: "press", kind: "onPress" }],
      } as LegacyEl,
    ]);
    const node = firstElementNode(doc);

    expect(node["x-composition"]?.events).toEqual([
      { id: "press", kind: "onPress" },
    ]);
    expect(
      (node.metadata as { legacyProps?: Record<string, unknown> }).legacyProps,
    ).not.toHaveProperty("events");
    expect((node as unknown as { events?: unknown }).events).toBeUndefined();
  });

  it("dataBinding을 x-composition에만 저장한다", () => {
    const dataBinding: DataBinding = {
      type: "collection",
      source: "supabase",
      config: { table: "users" },
    };
    const doc = buildCanonicalFromElements([
      {
        id: "list",
        type: "ListBox",
        props: {},
        parent_id: null,
        page_id: null,
        order_num: 0,
        dataBinding,
      } as LegacyEl,
    ]);
    const node = firstElementNode(doc);

    expect(node["x-composition"]?.dataBinding).toEqual(dataBinding);
    expect(
      (node.metadata as { legacyProps?: Record<string, unknown> }).legacyProps,
    ).not.toHaveProperty("dataBinding");
    expect(
      (node as unknown as { dataBinding?: unknown }).dataBinding,
    ).toBeUndefined();
  });

  it("events와 dataBinding을 함께 보존한다", () => {
    const doc = buildCanonicalFromElements([
      {
        id: "button",
        type: "Button",
        props: {},
        events: [{ id: "press", kind: "onPress" }],
        dataBinding: {
          type: "value",
          source: "state",
          config: { key: "count" },
        },
      } as LegacyEl,
    ]);
    const extension = firstElementNode(doc)["x-composition"];

    expect(extension?.events).toEqual([{ id: "press", kind: "onPress" }]);
    expect(extension?.dataBinding).toEqual({
      type: "value",
      source: "state",
      config: { key: "count" },
    });
  });

  it("events와 dataBinding이 없으면 extension을 만들지 않는다", () => {
    const doc = buildCanonicalFromElements([
      {
        id: "button",
        type: "Button",
        props: {},
      } as LegacyEl,
    ]);

    expect(firstElementNode(doc)["x-composition"]).toBeUndefined();
  });

  it("빈 events 배열이면 extension을 만들지 않는다", () => {
    const doc = buildCanonicalFromElements([
      {
        id: "button",
        type: "Button",
        props: {},
        events: [],
      } as LegacyEl,
    ]);

    expect(firstElementNode(doc)["x-composition"]?.events).toBeUndefined();
  });
});

describe("B. buildLegacyElementMetadata extension 분리", () => {
  it("top-level events를 legacyProps에 복제하지 않는다", () => {
    const metadata = buildLegacyElementMetadata({
      id: "button",
      type: "Button",
      props: {},
      events: [{ id: "press", kind: "onPress" }],
    } as LegacyEl);

    expect(metadata.legacyProps).not.toHaveProperty("events");
  });

  it("top-level dataBinding을 legacyProps에 복제하지 않는다", () => {
    const metadata = buildLegacyElementMetadata({
      id: "list",
      type: "ListBox",
      props: {},
      dataBinding: {
        type: "value",
        source: "state",
        config: { key: "count" },
      },
    } as LegacyEl);

    expect(metadata.legacyProps).not.toHaveProperty("dataBinding");
  });

  it("props 안의 동명 사용자 값은 그대로 보존한다", () => {
    const metadata = buildLegacyElementMetadata({
      id: "button",
      type: "Button",
      props: {
        events: [{ id: "props-event", kind: "onPress" }],
        dataBinding: { type: "static", source: "static", config: {} },
      },
      events: [{ id: "top-event", kind: "onClick" }],
    } as LegacyEl);

    expect(metadata.legacyProps.events).toEqual([
      { id: "props-event", kind: "onPress" },
    ]);
    expect(metadata.legacyProps.dataBinding).toEqual({
      type: "static",
      source: "static",
      config: {},
    });
  });
});

describe("E. canonical document serialization contract", () => {
  it("모든 metadata.legacyProps에서 events와 dataBinding을 제거한다", () => {
    const doc = buildCanonicalFromElements([
      {
        id: "button",
        type: "Button",
        props: { variant: "primary" },
        events: [{ id: "press", kind: "onPress" }],
      } as LegacyEl,
      {
        id: "list",
        type: "ListBox",
        props: {},
        dataBinding: {
          type: "collection",
          source: "supabase",
          config: { table: "users" },
        },
      } as LegacyEl,
      {
        id: "box",
        type: "Box",
        props: {},
      } as LegacyEl,
    ]);

    function visit(node: CanonicalNode): void {
      const legacyProps = (
        node.metadata as { legacyProps?: Record<string, unknown> } | undefined
      )?.legacyProps;
      if (legacyProps) {
        expect(legacyProps).not.toHaveProperty("events");
        expect(legacyProps).not.toHaveProperty("dataBinding");
      }
      node.children?.forEach(visit);
    }

    doc.children.forEach(visit);
  });

  it("events를 x-composition의 단일 위치에 직렬화한다", () => {
    const node = firstElementNode(
      buildCanonicalFromElements([
        {
          id: "button",
          type: "Button",
          props: {},
          events: [{ id: "press", kind: "onPress" }],
        } as LegacyEl,
      ]),
    );

    expect(node["x-composition"]?.events).toEqual([
      { id: "press", kind: "onPress" },
    ]);
    expect(
      (node.metadata as { legacyProps?: Record<string, unknown> }).legacyProps,
    ).not.toHaveProperty("events");
    expect((node as unknown as { events?: unknown }).events).toBeUndefined();
  });

  it("dataBinding을 x-composition의 단일 위치에 직렬화한다", () => {
    const node = firstElementNode(
      buildCanonicalFromElements([
        {
          id: "list",
          type: "ListBox",
          props: {},
          dataBinding: {
            type: "value",
            source: "state",
            config: { key: "count" },
          },
        } as LegacyEl,
      ]),
    );

    expect(node["x-composition"]?.dataBinding).toEqual({
      type: "value",
      source: "state",
      config: { key: "count" },
    });
    expect(
      (node.metadata as { legacyProps?: Record<string, unknown> }).legacyProps,
    ).not.toHaveProperty("dataBinding");
    expect(
      (node as unknown as { dataBinding?: unknown }).dataBinding,
    ).toBeUndefined();
  });

  it("extension 값이 없으면 x-composition을 직렬화하지 않는다", () => {
    const node = firstElementNode(
      buildCanonicalFromElements([
        {
          id: "box",
          type: "Box",
          props: {},
        } as LegacyEl,
      ]),
    );

    expect(node["x-composition"]).toBeUndefined();
  });
});

describe("F. canonical extension history parity", () => {
  it("events 추가를 canonical extension에 반영한다", () => {
    const baseline: LegacyEl = {
      id: "button",
      type: "Button",
      props: {},
    };
    const withEvents: LegacyEl = {
      ...baseline,
      events: [{ id: "press", kind: "onPress" }],
    };

    expect(
      firstElementNode(buildCanonicalFromElements([baseline]))["x-composition"],
    ).toBeUndefined();
    expect(
      firstElementNode(buildCanonicalFromElements([withEvents]))[
        "x-composition"
      ]?.events,
    ).toEqual([{ id: "press", kind: "onPress" }]);
  });

  it("events 제거를 canonical extension에 반영한다", () => {
    const withEvents: LegacyEl = {
      id: "button",
      type: "Button",
      props: {},
      events: [{ id: "press", kind: "onPress" }],
    };

    expect(
      firstElementNode(
        buildCanonicalFromElements([{ ...withEvents, events: undefined }]),
      )["x-composition"],
    ).toBeUndefined();
  });

  it("events 재추가를 canonical extension에 반영한다", () => {
    const redone: LegacyEl = {
      id: "button",
      type: "Button",
      props: {},
      events: [{ id: "press", kind: "onPress" }],
    };

    expect(
      firstElementNode(buildCanonicalFromElements([redone]))["x-composition"]
        ?.events,
    ).toEqual([{ id: "press", kind: "onPress" }]);
  });

  it("dataBinding 추가·제거를 canonical extension에 반영한다", () => {
    const baseline: LegacyEl = {
      id: "list",
      type: "ListBox",
      props: {},
    };
    const withBinding: LegacyEl = {
      ...baseline,
      dataBinding: {
        type: "collection",
        source: "supabase",
        config: { table: "items" },
      },
    };

    expect(
      firstElementNode(buildCanonicalFromElements([withBinding]))[
        "x-composition"
      ]?.dataBinding,
    ).toEqual({
      type: "collection",
      source: "supabase",
      config: { table: "items" },
    });
    expect(
      firstElementNode(
        buildCanonicalFromElements([
          { ...withBinding, dataBinding: undefined },
        ]),
      )["x-composition"],
    ).toBeUndefined();
  });

  it("여러 노드의 extension을 각 canonical node에 분리한다", () => {
    const doc = buildCanonicalFromElements([
      {
        id: "button",
        type: "Button",
        props: {},
        order_num: 0,
        events: [{ id: "press", kind: "onPress" }],
      } as LegacyEl,
      {
        id: "list",
        type: "ListBox",
        props: {},
        order_num: 1,
        dataBinding: {
          type: "value",
          source: "state",
          config: { key: "items" },
        },
      } as LegacyEl,
    ]);
    const nodes = firstUserPageNode(doc).children as Array<
      CanonicalNode & { "x-composition"?: CompositionExtension }
    >;

    expect(nodes[0]["x-composition"]?.events).toEqual([
      { id: "press", kind: "onPress" },
    ]);
    expect(nodes[1]["x-composition"]?.dataBinding).toEqual({
      type: "value",
      source: "state",
      config: { key: "items" },
    });
  });
});
