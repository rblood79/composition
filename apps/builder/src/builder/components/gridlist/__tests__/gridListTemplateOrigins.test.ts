import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { resolveSlotComposition } from "@composition/shared";

import {
  ensureGridListTemplateOrigins,
  GRIDLIST_ITEM_DEFAULT_ORIGIN_ID,
} from "../gridListTemplateOrigins";

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

describe("ADR-148 Phase 4 GridList template origins", () => {
  it("bootstraps the GridListItem default origin with label/description slot children", () => {
    const doc = ensureGridListTemplateOrigins(makeDocument());

    const origin = findById(doc.children, GRIDLIST_ITEM_DEFAULT_ORIGIN_ID);
    expect(origin).toMatchObject({
      type: "GridListItem",
      reusable: true,
      props: {
        children: "{label}",
        textValue: "{label}",
        description: "{description}",
      },
      metadata: expect.objectContaining({
        type: "gridlist-template-origin",
        systemOwned: true,
        componentFamily: "GridList",
      }),
    });

    // slot 조합 자식 — 구성 SSOT (order + optional + slotRole 양축 병기).
    const composition = resolveSlotComposition(origin?.children);
    expect(composition?.order).toEqual(["label", "description"]);
    expect(composition?.slots.description?.optional).toBe(true);
  });

  it("is idempotent and preserves user edits on the origin (repair semantics)", () => {
    const once = ensureGridListTemplateOrigins(makeDocument());
    const twice = ensureGridListTemplateOrigins(once);
    // 재실행 시 내용 동일 + origin 중복 없음 (toolbar 선례 동형).
    expect(twice).toEqual(once);

    // 사용자 편집(자식 slot 제거 + style 부여)이 repair 로 되돌려지지 않아야 한다.
    const edited = JSON.parse(JSON.stringify(once)) as CompositionDocument;
    const origin = findById(edited.children, GRIDLIST_ITEM_DEFAULT_ORIGIN_ID);
    origin!.children = origin!.children!.filter(
      (child) => child.metadata?.slotRole !== "description",
    );
    origin!.children![0]!.props = {
      ...origin!.children![0]!.props,
      style: { fontWeight: 700 },
    };

    const repaired = ensureGridListTemplateOrigins(edited);
    const repairedOrigin = findById(
      repaired.children,
      GRIDLIST_ITEM_DEFAULT_ORIGIN_ID,
    );
    const composition = resolveSlotComposition(repairedOrigin?.children);
    expect(composition?.order).toEqual(["label"]);
    expect(composition?.slots.label?.style).toMatchObject({ fontWeight: 700 });
  });
});
