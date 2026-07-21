import { beforeEach, describe, expect, it } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  FrameNode,
} from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../canonicalMutations";
import { buildLegacyElementMetadata } from "../legacyMetadata";
import { useCanonicalDocumentStore } from "@/builder/stores/canonical/canonicalDocumentStore";

/**
 * 재현 — Components 페이지에서 reusable origin 및 그 자식의 값/스타일을 편집하면 형제 순서가
 * 맨 아래로 밀리는 버그 (2026-07-21 사용자 보고).
 *
 * 근본 원인: `upsertElementIntoDocument` 는 `legacyPositionMatches` 가 true 여야 제자리 replace
 * (순서 보존), false 면 remove + append(맨 뒤). `legacyPositionMatches` 는 이전 canonical
 * 노드의 **저장된 sourceComponentRole** 을 읽어 incoming 의 **재계산 effectiveRole** 과 비교하는데,
 * `getEffectiveLegacyPositionRole` 은 `reusable===true` → "master" 를 유도하지만, 저장 노드가
 * `reusable:true` 만 있고 componentRole 미러가 없으면 sourceComponentRole=undefined →
 * `sameLegacyValue(undefined, "master")`=false → 매 편집마다 맨 뒤 재배열.
 *
 * canonicalMutationRoleOrder.test.ts 는 fixture 에 componentRole:"master" 를 명시해 이 gap 을
 * 가렸다 — 본 테스트는 componentRole 미러 **없이 reusable:true 만** 있는 실제 시나리오를 재현한다.
 */

type TestElementPatch = Partial<Element> & Record<string, unknown>;

function makeElement(
  id: string,
  type: string,
  patch: TestElementPatch = {},
): Element {
  return {
    id,
    type,
    props: {},
    parent_id: null,
    page_id: null,
    ...patch,
  } as Element;
}

function makePage(id: string): Page {
  return {
    id,
    project_id: "project-1",
    title: id,
    slug: `/${id}`,
    parent_id: null,
  } as Page;
}

function makeCanonicalNode(element: Element): CanonicalNode {
  return {
    id: element.id,
    type: element.type,
    props: element.props as Record<string, unknown>,
    metadata: buildLegacyElementMetadata(element),
  } as CanonicalNode;
}

const page = makePage("page-components");
const body = makeElement("page-components-body", "body", { page_id: page.id });
const leading = makeElement("leading", "Box", {
  parent_id: body.id,
  page_id: page.id,
});
// reusable origin — reusable:true 만, componentRole 미러 없음 (실제 seed 시나리오).
const origin = makeElement("origin-button", "Button", {
  parent_id: body.id,
  page_id: page.id,
  reusable: true,
  props: { label: "Origin" },
});
const originLabel = makeElement("origin-label", "Text", {
  parent_id: origin.id,
  page_id: page.id,
  props: { children: "Label" },
});
const originIcon = makeElement("origin-icon", "Icon", {
  parent_id: origin.id,
  page_id: page.id,
});
const trailing = makeElement("trailing", "Box", {
  parent_id: body.id,
  page_id: page.id,
});

// 2차 자식을 position metadata **없이** 저장 (seed/template 시나리오 — readLegacyElement
//   PositionMetadata 가 null → legacyPositionMatches `if (!previous) return false`).
function makeMetadatalessNode(element: Element): CanonicalNode {
  return {
    id: element.id,
    type: element.type,
    props: element.props as Record<string, unknown>,
  } as CanonicalNode;
}

function buildFixtureDoc(metadatalessChildren = false): CompositionDocument {
  const labelNode = metadatalessChildren
    ? makeMetadatalessNode(originLabel)
    : makeCanonicalNode(originLabel);
  const originNode = {
    ...makeCanonicalNode(origin),
    reusable: true,
    children: [labelNode, makeCanonicalNode(originIcon)],
  } as CanonicalNode;

  return {
    version: "composition-1.0",
    children: [
      {
        id: page.id,
        type: "frame",
        name: page.title,
        metadata: { type: "legacy-page", pageId: page.id },
        children: [
          {
            ...makeCanonicalNode(body),
            children: [
              makeCanonicalNode(leading),
              originNode,
              makeCanonicalNode(trailing),
            ],
          },
        ],
      } as FrameNode,
    ],
  };
}

function bodyChildIds(): string[] {
  const pageNode = useCanonicalDocumentStore
    .getState()
    .getDocument("project-1")
    ?.children.find((node) => node.id === page.id) as FrameNode | undefined;
  return (
    pageNode?.children
      ?.find((node) => node.id === body.id)
      ?.children?.map((node) => node.id) ?? []
  );
}

function originChildIds(): string[] {
  const pageNode = useCanonicalDocumentStore
    .getState()
    .getDocument("project-1")
    ?.children.find((node) => node.id === page.id) as FrameNode | undefined;
  const bodyNode = pageNode?.children?.find((node) => node.id === body.id);
  return (
    bodyNode?.children
      ?.find((node) => node.id === origin.id)
      ?.children?.map((node) => node.id) ?? []
  );
}

describe("canonical mutation — reusable origin 편집 시 형제 순서 보존", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: "project-1",
      documentVersion: 0,
    });
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [body, leading, origin, originLabel, originIcon, trailing],
        layouts: [],
        pages: [page],
      }),
      getCurrentProjectId: () => "project-1",
    });
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", buildFixtureDoc());
  });

  it("1차 요소(reusable origin) prop 편집 시 body 형제 순서 유지 (맨 뒤 이동 금지)", () => {
    mergeElementsCanonicalPrimary([
      { ...origin, props: { label: "Origin edited" } },
    ]);
    expect(bodyChildIds()).toEqual(["leading", "origin-button", "trailing"]);
  });

  it("2차 요소(origin 자식) prop 편집 시 origin 자식 순서 유지 (맨 뒤 이동 금지)", () => {
    mergeElementsCanonicalPrimary([
      { ...originLabel, props: { children: "Label edited" } },
    ]);
    expect(originChildIds()).toEqual(["origin-label", "origin-icon"]);
  });

  it("2차 요소가 position metadata 없이 저장돼도(seed/template) 순서 유지 (트리 구조 판정)", () => {
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", buildFixtureDoc(true));
    mergeElementsCanonicalPrimary([
      { ...originLabel, props: { children: "Label edited" } },
    ]);
    expect(originChildIds()).toEqual(["origin-label", "origin-icon"]);
  });
});
