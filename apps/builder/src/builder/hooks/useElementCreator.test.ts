import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";

import { resolveCreationParentId } from "./useElementCreator";
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
