import { describe, expect, it } from "vitest";

import { detectInspectorInputMode } from "../inspectorInputMode";
import type { Element } from "@/types/builder/unified.types";

/**
 * ADR-144 Phase 5 task 7 — Inspector input mode 감지 evidence.
 *
 * mode 감지 순서: dataBinding → resolved-tree composite → legacy items[]
 * 한 element 에는 단일 mode 만 활성화되어야 한다 (Inspector UI 가 상호 배타 분기).
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
    props: partial.props ?? {},
    deleted: false,
    ...partial,
  } as Element;
}

const emptyLookup = () => undefined;

describe("ADR-144 task 7 detectInspectorInputMode", () => {
  it("returns 'external-databinding' when dataBinding is set (Data Panel / API endpoint)", () => {
    const element = makeElement("listbox-1", {
      type: "ListBox",
      dataBinding: {
        collection_id: "users",
      } as unknown as Element["dataBinding"],
      props: { items: [{ id: "a", label: "A" }] }, // items 도 함께 있어도 dataBinding 우선
    });

    expect(
      detectInspectorInputMode(element, {
        ownerPath: null,
        lookupElement: emptyLookup,
      }),
    ).toBe("external-databinding");
  });

  it("returns 'resolved-tree' when element itself is a ref instance", () => {
    const element = makeElement("tab-ref-overview", {
      type: "Tab",
      ref: "tab-origin",
      componentRole: "instance",
      masterId: "tab-origin",
    });

    expect(
      detectInspectorInputMode(element, {
        ownerPath: null,
        lookupElement: emptyLookup,
      }),
    ).toBe("resolved-tree");
  });

  it("returns 'resolved-tree' when element is a reusable origin with declared slot", () => {
    const element = makeElement("tabs-origin", {
      type: "Tabs",
      reusable: true,
      componentRole: "master",
      slot: ["tablist-origin"],
    });

    expect(
      detectInspectorInputMode(element, {
        ownerPath: null,
        lookupElement: emptyLookup,
      }),
    ).toBe("resolved-tree");
  });

  it("returns 'resolved-tree' when ownerPath traverses an instance ancestor (descendant origin child)", () => {
    const labelElement = makeElement("tab-label", {
      type: "Text",
      parent_id: "tab-origin",
    });
    const instanceElement = makeElement("tab-ref-overview", {
      type: "Tab",
      ref: "tab-origin",
      componentRole: "instance",
      masterId: "tab-origin",
    });
    const lookup = (id: string) =>
      id === "tab-ref-overview" ? instanceElement : undefined;

    expect(
      detectInspectorInputMode(labelElement, {
        ownerPath: "page-body/tabs-instance/tab-ref-overview/tab-label",
        lookupElement: lookup,
      }),
    ).toBe("resolved-tree");
  });

  it("returns 'legacy-items' when only props.items[] exists (no dataBinding, no instance context)", () => {
    const element = makeElement("listbox-2", {
      type: "ListBox",
      props: { items: [{ id: "a", label: "A" }] },
    });

    expect(
      detectInspectorInputMode(element, {
        ownerPath: "page-body/listbox-2",
        lookupElement: emptyLookup,
      }),
    ).toBe("legacy-items");
  });

  it("returns 'legacy-items' fallback when none of dataBinding / resolved-tree / items match", () => {
    const element = makeElement("box-1", {
      type: "Box",
      props: {},
    });

    expect(
      detectInspectorInputMode(element, {
        ownerPath: null,
        lookupElement: emptyLookup,
      }),
    ).toBe("legacy-items");
  });

  it("prefers dataBinding over resolved-tree (mode 1 wins when both are candidates)", () => {
    const element = makeElement("tab-ref-overview", {
      type: "Tab",
      ref: "tab-origin",
      componentRole: "instance",
      masterId: "tab-origin",
      dataBinding: {
        collection_id: "tabs",
      } as unknown as Element["dataBinding"],
    });

    expect(
      detectInspectorInputMode(element, {
        ownerPath: null,
        lookupElement: emptyLookup,
      }),
    ).toBe("external-databinding");
  });

  it("prefers resolved-tree over legacy items (mode 2 wins when both are candidates)", () => {
    const element = makeElement("listbox-3", {
      type: "ListBox",
      reusable: true,
      slot: ["item-origin"],
      props: { items: [{ id: "a", label: "A" }] }, // legacy items 도 동시에 있어도 mode 2 우선
    });

    expect(
      detectInspectorInputMode(element, {
        ownerPath: null,
        lookupElement: emptyLookup,
      }),
    ).toBe("resolved-tree");
  });
});
