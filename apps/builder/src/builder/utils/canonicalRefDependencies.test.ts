import { describe, expect, it } from "vitest";
import type { Element } from "../../types/core/store.types";
import { includeCanonicalRefDependencies } from "./canonicalRefDependencies";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Button",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

describe("includeCanonicalRefDependencies", () => {
  it("includes a cross-page origin subtree needed to resolve a scoped ref instance", () => {
    const page1Body = makeElement("page-1-body", {
      type: "body",
      page_id: "page-1",
    });
    const origin = makeElement("origin", {
      reusable: true,
      parent_id: page1Body.id,
      page_id: "page-1",
    });
    const originLabel = makeElement("origin-label", {
      type: "Text",
      parent_id: origin.id,
      page_id: "page-1",
    });
    const page2Body = makeElement("page-2-body", {
      type: "body",
      page_id: "page-2",
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: origin.id,
      parent_id: page2Body.id,
      page_id: "page-2",
    } as never);
    const allElements = [page1Body, origin, originLabel, page2Body, instance];

    const scoped = includeCanonicalRefDependencies(
      [page2Body, instance],
      allElements,
    );

    expect(scoped.map((element) => element.id)).toEqual([
      page2Body.id,
      instance.id,
      origin.id,
      originLabel.id,
    ]);
    expect(scoped).not.toContain(page1Body);
  });

  it("does not duplicate dependencies already present in the scoped page", () => {
    const body = makeElement("body", { type: "body" });
    const origin = makeElement("origin", {
      reusable: true,
      parent_id: body.id,
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: origin.id,
      parent_id: body.id,
    } as never);

    const scoped = includeCanonicalRefDependencies(
      [body, origin, instance],
      [body, origin, instance],
    );

    expect(scoped.map((element) => element.id)).toEqual([
      body.id,
      origin.id,
      instance.id,
    ]);
  });
});
