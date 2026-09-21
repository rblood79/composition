import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import {
  resolveCreationParentForType,
  resolveCreationParentId,
} from "./useElementCreator";
import type { ComponentCreationSourceNode } from "../factories/types";

function makeNode(
  id: string,
  type: string,
  overrides: Partial<ComponentCreationSourceNode> = {},
): ComponentCreationSourceNode {
  return {
    id,
    type,
    parent_id: null,
    page_id: null,
    props: {},
    ...overrides,
  };
}

const emptyDoc = {
  version: "composition-1.0",
  children: [],
} as CompositionDocument;

describe("resolveCreationParentId", () => {
  it("page id selection falls back to the page body element", () => {
    const pageId = "page-1";
    const body = makeNode("body-1", "body", { page_id: pageId });
    const elements = [body];

    expect(
      resolveCreationParentId({
        selectedElementId: pageId,
        elements,
        currentPageId: pageId,
        layoutId: null,
        doc: emptyDoc,
      }),
    ).toBe(body.id);
  });

  it("valid element selection remains the creation parent", () => {
    const pageId = "page-1";
    const body = makeNode("body-1", "body", { page_id: pageId });
    const card = makeNode("card-1", "Card", {
      page_id: pageId,
      parent_id: body.id,
    });
    const elements = [body, card];

    expect(
      resolveCreationParentId({
        selectedElementId: card.id,
        elements,
        currentPageId: pageId,
        layoutId: null,
        doc: emptyDoc,
      }),
    ).toBe(card.id);
  });

  it("empty selection uses the page body element", () => {
    const pageId = "page-1";
    const body = makeNode("body-1", "body", { page_id: pageId });
    const elements = [body];

    expect(
      resolveCreationParentId({
        selectedElementId: null,
        elements,
        currentPageId: pageId,
        layoutId: null,
        doc: emptyDoc,
      }),
    ).toBe(body.id);
  });

  it("reusable frame body를 canonical parent edge로 찾는다", () => {
    const frameId = "frame-1";
    const body = makeNode("frame-body", "body", { parent_id: frameId });
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: frameId,
          type: "frame",
          reusable: true,
          props: {},
          children: [{ id: body.id, type: "body", props: {} }],
        },
      ],
    } as unknown as CompositionDocument;

    expect(
      resolveCreationParentId({
        selectedElementId: null,
        elements: [body],
        currentPageId: null,
        layoutId: frameId,
        doc,
      }),
    ).toBe(body.id);
  });
});

/**
 * ADR-228 (codex round 3 h1, 2026-09-21): 선택된 요소가 ref instance 면 origin 은 Components
 * 페이지에 있어 page-scoped `elements` 에 없다 — 문서에서 유효 타입을 읽지 않으면 preflight 가
 * "ref" 를 opaque 통과시켜 Button 안 Button 이 만들어졌다 (headed 재현).
 */
describe("resolveCreationParentForType — ref instance 부모의 유효 타입 (ADR-228)", () => {
  const pageId = "page-1";
  const body = makeNode("body-1", "body", { page_id: pageId });
  const instance = makeNode("inst-a", "ref", {
    page_id: pageId,
    parent_id: body.id,
    ref: "component-button",
  } as Partial<ComponentCreationSourceNode>);
  const doc = {
    version: "composition-1.0",
    children: [
      {
        id: "page-components-body",
        type: "body",
        children: [{ id: "component-button", type: "Button", props: {} }],
      },
      {
        id: body.id,
        type: "body",
        children: [{ id: instance.id, type: "ref", ref: "component-button" }],
      },
    ],
  } as unknown as CompositionDocument;

  it("Button instance 를 선택한 채 Button 을 추가하면 body 로 옮긴다 (Button 안 Button 금지)", () => {
    const parent = resolveCreationParentForType("Button", {
      selectedElementId: instance.id,
      elements: [body, instance],
      currentPageId: pageId,
      layoutId: null,
      doc,
    });
    expect(parent.rejected).toBe(false);
    expect(parent.relocated).toBe(true);
    expect(parent.parentId).toBe(body.id);
  });

  it("frame 을 선택한 채 Button 을 추가하면 그대로 frame 이 부모다", () => {
    const frame = makeNode("frame-1", "frame", {
      page_id: pageId,
      parent_id: body.id,
    });
    const parent = resolveCreationParentForType("Button", {
      selectedElementId: frame.id,
      elements: [body, frame],
      currentPageId: pageId,
      layoutId: null,
      doc,
    });
    expect(parent.relocated).toBe(false);
    expect(parent.parentId).toBe(frame.id);
  });
});
