import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "@/types/builder/unified.types";
import type { Layout } from "@/types/builder/layout.types";
import { FillType, type FillItem } from "@/types/builder/fill.types";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { canonicalDocumentToElements } from "../../../builder/stores/canonical/canonicalElementsView";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../canonicalMutations";

/**
 * Background(fills) canonical 왕복 회귀 테스트.
 *
 * ADR-116/122 canonical 전환 때 fills 가 이관되지 않아 기능 전체가 죽어 있던
 * 결함의 재발 차단. 기존 useAppearanceValues.test.tsx 는 legacy Element 직주입
 * fixture 라 이 결함을 마스킹했다 — 본 테스트는 canonical document 경유로
 * 쓰기(mergeElementsCanonicalPrimary) → 저장(canonical node 1차 필드) →
 * 읽기(canonicalDocumentToElements) 전 구간을 검증한다.
 */

type TestElement = Element & { layout_id?: string | null };

const COLOR_FILL: FillItem = {
  id: "fill-1",
  type: FillType.Color,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  color: "#FF0000FF",
};

function makeElement(
  id: string,
  type: string,
  patch: Partial<TestElement> = {},
): TestElement {
  return {
    id,
    type,
    props: {},
    parent_id: null,
    page_id: null,
    layout_id: null,
    ...patch,
  } as TestElement;
}

function makeLayout(id: string): Layout {
  return {
    id,
    name: id,
    project_id: "project-1",
  };
}

function makeDocument(
  children: Array<Record<string, unknown>> = [],
): CompositionDocument {
  return {
    version: "composition-1.0",
    children: children as unknown as CompositionDocument["children"],
  } satisfies CompositionDocument;
}

function setupFrameDocument(): void {
  const layout = makeLayout("frame-1");
  const doc = makeDocument([
    {
      id: "layout-frame-1",
      type: "frame",
      reusable: true,
      metadata: { type: "legacy-layout", layoutId: "frame-1" },
      children: [],
    },
  ]);
  useCanonicalDocumentStore.getState().setCurrentProject("project-1");
  useCanonicalDocumentStore.getState().setDocument("project-1", doc);
  registerCanonicalMutationStoreActions({
    getCurrentLegacySnapshot: () => ({
      elements: [],
      pages: [],
      layouts: [layout],
    }),
    getCurrentProjectId: () => "project-1",
  });
}

function getActiveDocument(): CompositionDocument {
  const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
  if (!doc) throw new Error("active canonical document missing");
  return doc;
}

function findNode(
  nodes: CompositionDocument["children"],
  id: string,
): Record<string, unknown> | null {
  for (const node of nodes) {
    if (node.id === id) return node as unknown as Record<string, unknown>;
    const children = (node as { children?: CompositionDocument["children"] })
      .children;
    if (children) {
      const found = findNode(children, id);
      if (found) return found;
    }
  }
  return null;
}

describe("canonical fills roundtrip", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("carries element.fills onto the canonical node as a first-class field", () => {
    setupFrameDocument();

    mergeElementsCanonicalPrimary([
      makeElement("box-1", "Box", {
        layout_id: "frame-1",
        fills: [COLOR_FILL],
      }),
    ]);

    const node = findNode(getActiveDocument().children, "box-1");
    expect(node?.fills).toEqual([COLOR_FILL]);
    // 격리 보존(metadata.legacyProps)만 있고 1차 필드가 비는 과거 절단 재발 방지
    const metadata = node?.metadata as
      | { legacyProps?: Record<string, unknown> }
      | undefined;
    expect(metadata?.legacyProps?.fills).toEqual([COLOR_FILL]);
  });

  it("restores fills when deriving Element[] from the canonical document", () => {
    setupFrameDocument();

    mergeElementsCanonicalPrimary([
      makeElement("box-1", "Box", {
        layout_id: "frame-1",
        fills: [COLOR_FILL],
      }),
    ]);

    const derived = canonicalDocumentToElements(getActiveDocument());
    const box = derived.find((element) => element.id === "box-1");
    expect(box?.fills).toEqual([COLOR_FILL]);
  });

  it("falls back to metadata.legacyProps.fills for pre-cutover documents", () => {
    const doc = makeDocument([
      {
        id: "box-legacy",
        type: "Box",
        props: {},
        metadata: {
          type: "legacy-element-props",
          legacyProps: {
            id: "box-legacy",
            parent_id: null,
            page_id: null,
            fills: [COLOR_FILL],
            type: "Box",
          },
        },
      },
    ]);

    const derived = canonicalDocumentToElements(doc);
    const box = derived.find((element) => element.id === "box-legacy");
    expect(box?.fills).toEqual([COLOR_FILL]);
  });

  it("clears node fills when the element no longer has fills", () => {
    setupFrameDocument();

    mergeElementsCanonicalPrimary([
      makeElement("box-1", "Box", {
        layout_id: "frame-1",
        fills: [COLOR_FILL],
      }),
    ]);
    mergeElementsCanonicalPrimary([
      makeElement("box-1", "Box", { layout_id: "frame-1", fills: [] }),
    ]);

    const node = findNode(getActiveDocument().children, "box-1");
    expect(node?.fills).toBeUndefined();

    const derived = canonicalDocumentToElements(getActiveDocument());
    const box = derived.find((element) => element.id === "box-1");
    expect(box?.fills).toBeUndefined();
  });

  it("keeps parent fills across a structure change (child insertion)", () => {
    setupFrameDocument();

    mergeElementsCanonicalPrimary([
      makeElement("box-1", "Box", {
        layout_id: "frame-1",
        fills: [COLOR_FILL],
      }),
    ]);
    // 구조 변경: box-1 아래 자식 추가 — 과거에는 이 시점의 canonical 재파생이
    // legacy mirror fills 를 소거했다 (canonicalNodeToElement fills:undefined).
    mergeElementsCanonicalPrimary([
      makeElement("child-1", "Text", {
        parent_id: "box-1",
        props: { text: "hello" },
      }),
    ]);

    const derived = canonicalDocumentToElements(getActiveDocument());
    const box = derived.find((element) => element.id === "box-1");
    const child = derived.find((element) => element.id === "child-1");
    expect(box?.fills).toEqual([COLOR_FILL]);
    expect(child?.parent_id).toBe("box-1");
  });
});
