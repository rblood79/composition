import { describe, expect, it } from "vitest";

import { __testing_resolveInstanceDescendantTarget } from "../inspectorActions";
import type { Element } from "@/types/builder/unified.types";

/**
 * ADR-144 Phase 5 G4 — Inspector edit 라우팅 evidence.
 *
 * resolveInstanceDescendantTarget 가 primaryOwnerPath 를 분석해 nearest ref instance
 * ancestor 를 찾아 `{ instanceId, descendantKey }` 를 반환하는 contract 를 고정한다.
 * 본 logic 이 깨지면 Inspector single-element edit 가 origin child 를 직접 mutate 해
 * 모든 ref instance 의 라벨을 동시에 바꾸는 회귀가 발생한다.
 */

function makeElement(
  id: string,
  partial: Partial<Element> & { type?: string } = {},
): Element {
  return {
    id,
    type: partial.type ?? "Box",
    page_id: "page-1",
    parent_id: partial.parent_id ?? null,
    order_num: 0,
    props: {},
    deleted: false,
    ...partial,
  } as Element;
}

describe("ADR-144 G4 resolveInstanceDescendantTarget", () => {
  it("returns instanceId + descendantKey when ownerPath traverses a ref instance ancestor", () => {
    const elements = new Map<string, Element>([
      [
        "tab-origin",
        makeElement("tab-origin", {
          type: "Tab",
          reusable: true,
          componentRole: "master",
        }),
      ],
      [
        "tab-label",
        makeElement("tab-label", {
          type: "Text",
          parent_id: "tab-origin",
          componentRole: undefined,
        }),
      ],
      [
        "tab-ref-overview",
        makeElement("tab-ref-overview", {
          type: "Tab",
          parent_id: "tablist-origin",
          ref: "tab-origin",
          componentRole: "instance",
          masterId: "tab-origin",
          descendants: { "tab-label": { text: "Overview" } },
        }),
      ],
    ]);

    const target = __testing_resolveInstanceDescendantTarget(
      "page-body/tabs-instance/tablist-instance/tab-ref-overview/tab-label",
      "tab-label",
      (id) => elements.get(id),
    );

    expect(target).toEqual({
      instanceId: "tab-ref-overview",
      descendantKey: "tab-label",
    });
  });

  it("returns null when selectedElementId is the instance itself (instance-level edit)", () => {
    const elements = new Map<string, Element>([
      [
        "tab-ref-overview",
        makeElement("tab-ref-overview", {
          type: "Tab",
          parent_id: "tablist-origin",
          ref: "tab-origin",
          componentRole: "instance",
          masterId: "tab-origin",
        }),
      ],
    ]);

    const target = __testing_resolveInstanceDescendantTarget(
      "page-body/tabs-instance/tablist-instance/tab-ref-overview",
      "tab-ref-overview",
      (id) => elements.get(id),
    );

    expect(target).toBeNull();
  });

  it("returns null when ownerPath has no ancestor ref instance (origin master child only)", () => {
    const elements = new Map<string, Element>([
      [
        "tab-origin",
        makeElement("tab-origin", {
          type: "Tab",
          reusable: true,
          componentRole: "master",
        }),
      ],
      [
        "tab-label",
        makeElement("tab-label", {
          type: "Text",
          parent_id: "tab-origin",
        }),
      ],
    ]);

    const target = __testing_resolveInstanceDescendantTarget(
      "tab-origin/tab-label",
      "tab-label",
      (id) => elements.get(id),
    );

    expect(target).toBeNull();
  });

  it("returns null when primaryOwnerPath is null (selection from non-Skia hit-test entry)", () => {
    const elements = new Map<string, Element>([
      ["tab-label", makeElement("tab-label", { type: "Text" })],
    ]);

    const target = __testing_resolveInstanceDescendantTarget(
      null,
      "tab-label",
      (id) => elements.get(id),
    );

    expect(target).toBeNull();
  });

  it("returns null when ownerPath last segment does not match selectedElementId (stale state)", () => {
    const elements = new Map<string, Element>([
      [
        "tab-label",
        makeElement("tab-label", { type: "Text", parent_id: "tab-origin" }),
      ],
      [
        "tab-ref-overview",
        makeElement("tab-ref-overview", {
          type: "Tab",
          ref: "tab-origin",
          componentRole: "instance",
          masterId: "tab-origin",
        }),
      ],
    ]);

    const target = __testing_resolveInstanceDescendantTarget(
      "page-body/tabs-instance/tab-ref-overview/tab-label",
      "different-element",
      (id) => elements.get(id),
    );

    expect(target).toBeNull();
  });

  it("picks the NEAREST instance ancestor when ownerPath has multiple instance segments", () => {
    const elements = new Map<string, Element>([
      [
        "outer-instance",
        makeElement("outer-instance", {
          type: "Tabs",
          componentRole: "instance",
          masterId: "tabs-origin",
        }),
      ],
      [
        "inner-instance",
        makeElement("inner-instance", {
          type: "Tab",
          parent_id: "outer-instance",
          componentRole: "instance",
          masterId: "tab-origin",
        }),
      ],
      [
        "tab-label",
        makeElement("tab-label", {
          type: "Text",
          parent_id: "tab-origin",
        }),
      ],
    ]);

    const target = __testing_resolveInstanceDescendantTarget(
      "page-body/outer-instance/inner-instance/tab-label",
      "tab-label",
      (id) => elements.get(id),
    );

    // nearest 가 inner-instance — outer 가 아님
    expect(target).toEqual({
      instanceId: "inner-instance",
      descendantKey: "tab-label",
    });
  });
});
