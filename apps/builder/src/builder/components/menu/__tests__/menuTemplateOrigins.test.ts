import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { resolveSlotComposition } from "@composition/shared";

import {
  ensureMenuTemplateOrigins,
  MENU_ITEM_DEFAULT_ORIGIN_ID,
} from "../menuTemplateOrigins";

function makeDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-home",
        type: "frame",
        name: "Home",
        metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
        children: [{ id: "body-home", type: "body" as CanonicalNode["type"] }],
      },
    ],
  };
}

function findById(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findById(node.children ?? [], id);
    if (child) return child;
  }
  return undefined;
}

describe("ADR-148 Phase 4 Menu template origins", () => {
  it("bootstraps the MenuItem default origin with icon/label/shortcut/description slot children (itemSchema 시각 4키)", () => {
    const doc = ensureMenuTemplateOrigins(makeDocument());

    const origin = findById(doc.children, MENU_ITEM_DEFAULT_ORIGIN_ID);
    expect(origin).toMatchObject({
      type: "MenuItem",
      reusable: true,
      metadata: expect.objectContaining({
        type: "menu-template-origin",
        systemOwned: true,
        componentFamily: "Menu",
      }),
    });

    // itemSchema 중 시각 slot 축 4키 — 잔여(value/href/isDisabled)는
    // 데이터·동작 축이라 slot 대상 아님 (Phase 4 판정).
    const composition = resolveSlotComposition(origin?.children);
    expect(composition?.order).toEqual([
      "icon",
      "label",
      "shortcut",
      "description",
    ]);
    expect(composition?.slots.icon?.optional).toBe(true);
    expect(composition?.slots.shortcut?.optional).toBe(true);
    expect(composition?.slots.description?.optional).toBe(true);
    expect(composition?.slots.label?.optional).toBeUndefined();
  });

  it("is idempotent — re-running produces identical content (no duplicate origins)", () => {
    const once = ensureMenuTemplateOrigins(makeDocument());
    const twice = ensureMenuTemplateOrigins(once);
    expect(twice).toEqual(once);

    const countOrigins = (nodes: readonly CanonicalNode[]): number =>
      nodes.reduce(
        (sum, node) =>
          sum +
          (node.id === MENU_ITEM_DEFAULT_ORIGIN_ID ? 1 : 0) +
          countOrigins(node.children ?? []),
        0,
      );
    expect(countOrigins(twice.children)).toBe(1);
  });
});
