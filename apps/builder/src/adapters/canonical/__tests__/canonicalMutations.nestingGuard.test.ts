/**
 * canonical 변이 경계의 중첩 guard — 캔버스는 RAC 를 그리는 도구라 Pen 구조 · RAC 합성 ·
 * HTML 의미 세 층을 상속한다. 이 경계가 fail-closed 백스톱이다.
 *
 * RED (guard 이전): 아래 이동·삽입이 전부 `changed: true` 로 통과해 RAC 가 그릴 수 없는
 * 트리가 문서에 남았다 (2026-09-08 사용자 판정: 편의가 아니라 기능 결함).
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "@/types/builder/unified.types";

import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import {
  mergeElementsCanonicalPrimary,
  moveElementsToCanonicalTarget,
  moveElementToCanonicalTarget,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../canonicalMutations";

function makeDocument(
  children: Array<Record<string, unknown>>,
): CompositionDocument {
  return {
    version: "composition-1.0",
    children: children as unknown as CompositionDocument["children"],
  };
}

function makeElement(
  id: string,
  type: string,
  parent_id: string | null,
): Element {
  return {
    id,
    type,
    props: {},
    parent_id,
    page_id: "page-1",
  } as unknown as Element;
}

function setup(doc: CompositionDocument): void {
  useCanonicalDocumentStore.getState().setCurrentProject("project-1");
  useCanonicalDocumentStore.getState().setDocument("project-1", doc);
  registerCanonicalMutationStoreActions({
    getCurrentLegacySnapshot: () => ({ elements: [], pages: [], layouts: [] }),
    getCurrentProjectId: () => "project-1",
  });
}

/**
 * body > frame-a > [button-a > [text-a], link-a]
 *      > frame-b > [tabs > [tablist > [tab-1], panels > [panel-1]], form-a]
 *      > text-lone
 */
const BASE_DOC = makeDocument([
  {
    id: "body",
    type: "body",
    children: [
      {
        id: "frame-a",
        type: "frame",
        children: [
          {
            id: "button-a",
            type: "Button",
            children: [{ id: "text-a", type: "Text" }],
          },
          { id: "link-a", type: "Link" },
        ],
      },
      {
        id: "frame-b",
        type: "frame",
        children: [
          {
            id: "tabs",
            type: "Tabs",
            children: [
              {
                id: "tablist",
                type: "TabList",
                children: [{ id: "tab-1", type: "Tab" }],
              },
              {
                id: "panels",
                type: "TabPanels",
                children: [{ id: "panel-1", type: "TabPanel" }],
              },
            ],
          },
          { id: "form-a", type: "Form" },
        ],
      },
      { id: "text-lone", type: "Text" },
    ],
  },
]);

describe("canonical nesting guard — move", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    setup(BASE_DOC);
  });

  it("층 3: Link 를 Button 안으로 옮기지 못한다 (interactive ⊄ button)", () => {
    const result = moveElementToCanonicalTarget("link-a", {
      kind: "node-children",
      parentId: "button-a",
      insertionIndex: 0,
    });
    expect(result.changed).toBe(false);
    expect(result.nestingViolation).toMatchObject({
      layer: "html-content",
      parentType: "Button",
      childType: "Link",
    });
  });

  it("층 1: Text 안으로는 아무것도 옮기지 못한다 (Pen leaf)", () => {
    const result = moveElementToCanonicalTarget("link-a", {
      kind: "node-children",
      parentId: "text-lone",
      insertionIndex: 0,
    });
    expect(result.changed).toBe(false);
    expect(result.nestingViolation?.layer).toBe("pen-structure");
  });

  it("층 2: TabPanel 을 Tabs 밖 frame 으로 옮기지 못한다 (합성 부품은 소유자 안)", () => {
    const result = moveElementToCanonicalTarget("panel-1", {
      kind: "node-children",
      parentId: "frame-a",
      insertionIndex: 0,
    });
    expect(result.changed).toBe(false);
    expect(result.nestingViolation).toMatchObject({
      layer: "rac-composition",
      childType: "TabPanel",
    });
  });

  it("층 2: TabList 안에는 Tab 만 — Link 를 옮기지 못한다", () => {
    const result = moveElementToCanonicalTarget("link-a", {
      kind: "node-children",
      parentId: "tablist",
      insertionIndex: 0,
    });
    expect(result.changed).toBe(false);
    expect(result.nestingViolation?.layer).toBe("rac-composition");
  });

  it("층 3: Form 을 Form 안으로 옮기지 못한다", () => {
    // frame-a 를 form-a 안으로 (frame 자체는 허용) 는 통과, 그 안의 자식도 검사 대상이
    // 아니다 — 이동 guard 는 이동 노드 자신만 본다. Form 자체를 Form 안으로:
    setup(
      makeDocument([
        {
          id: "body",
          type: "body",
          children: [
            { id: "form-outer", type: "Form" },
            { id: "form-inner", type: "Form" },
          ],
        },
      ]),
    );
    const result = moveElementToCanonicalTarget("form-inner", {
      kind: "node-children",
      parentId: "form-outer",
      insertionIndex: 0,
    });
    expect(result.changed).toBe(false);
    expect(result.nestingViolation?.layer).toBe("html-content");
  });

  it("유효한 이동은 그대로 통과한다 — Link 를 frame-b 로", () => {
    const result = moveElementToCanonicalTarget("link-a", {
      kind: "node-children",
      parentId: "frame-b",
      insertionIndex: 0,
    });
    expect(result.changed).toBe(true);
    expect(result.nestingViolation).toBeUndefined();
  });

  it("배치 이동은 하나라도 위반이면 전체를 거부한다 (원자성)", () => {
    const result = moveElementsToCanonicalTarget(["link-a", "form-a"], {
      kind: "node-children",
      parentId: "button-a",
      insertionIndex: 0,
    });
    expect(result.changed).toBe(false);
    expect(result.movedIds).toEqual([]);
    expect(result.nestingViolation).toBeDefined();
  });

  it("ref descendants 슬롯도 원본 타입으로 판정한다", () => {
    setup(
      makeDocument([
        {
          id: "layout-frame",
          type: "frame",
          reusable: true,
          children: [
            {
              id: "hero-button",
              type: "Button",
              children: [{ id: "hero-slot", type: "Slot" }],
            },
          ],
        },
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          descendants: { "hero-button/hero-slot": { children: [] } },
        },
        { id: "lone-link", type: "Link" },
      ]),
    );
    // hero-slot 은 Button 안 — Link 를 거기로 넣으면 interactive ⊄ button
    const result = moveElementToCanonicalTarget("lone-link", {
      kind: "ref-descendants",
      refNodeId: "page-1",
      descendantPath: "hero-button/hero-slot",
      insertionIndex: 0,
    });
    expect(result.changed).toBe(false);
    expect(result.nestingViolation).toMatchObject({
      layer: "html-content",
      parentType: "Button",
    });
  });
});

describe("canonical nesting guard — merge (insert)", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    setup(BASE_DOC);
  });

  it("새 Button 을 Button 아래 삽입하지 못한다", () => {
    const result = mergeElementsCanonicalPrimary([
      makeElement("button-new", "Button", "button-a"),
    ]);
    expect(result.changed).toBe(false);
    expect(result.nestingViolation).toMatchObject({
      layer: "html-content",
      parentType: "Button",
      childType: "Button",
    });
  });

  it("새 요소를 Text 아래 삽입하지 못한다", () => {
    const result = mergeElementsCanonicalPrimary([
      makeElement("icon-new", "Icon", "text-lone"),
    ]);
    expect(result.changed).toBe(false);
    expect(result.nestingViolation?.layer).toBe("pen-structure");
  });

  it("배치 안의 부모 사슬을 따라간다 — 위반 요소만 건너뛰고 나머지는 들어간다", () => {
    const result = mergeElementsCanonicalPrimary([
      makeElement("f-new", "frame", "frame-a"),
      makeElement("l-new", "Link", "f-new"),
      makeElement("b-new", "Button", "l-new"),
      makeElement("t-new", "Text", "b-new"),
    ]);
    // frame · Link 는 통과, Button 과 그 배치 자손 Text 는 제외
    expect(result.changed).toBe(true);
    expect(result.nestingViolation).toMatchObject({
      parentType: "Link",
      childType: "Button",
    });
    const json = JSON.stringify(result.document);
    expect(json).toContain('"l-new"');
    expect(json).not.toContain('"b-new"');
    expect(json).not.toContain('"t-new"');
  });

  it("기존 노드의 제자리 upsert 는 검사하지 않는다 — 옛 문서의 위반이 편집을 막지 않는다", () => {
    // button-a 안에 이미 있는 text-a 를 같은 부모로 다시 upsert (prop 갱신 경로)
    const result = mergeElementsCanonicalPrimary([
      makeElement("text-a", "Text", "button-a"),
    ]);
    expect(result.nestingViolation).toBeUndefined();
  });

  it("유효한 삽입은 통과한다 — frame 아래 Button > Text", () => {
    const result = mergeElementsCanonicalPrimary([
      makeElement("b2", "Button", "frame-b"),
      makeElement("t2", "Text", "b2"),
    ]);
    expect(result.changed).toBe(true);
    expect(result.nestingViolation).toBeUndefined();
  });
});
