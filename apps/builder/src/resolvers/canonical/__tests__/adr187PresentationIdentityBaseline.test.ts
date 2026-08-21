import { describe, expect, it } from "vitest";
import type { CompositionDocument, ResolvedNode } from "@composition/shared";

import { resolveCanonicalRefTree } from "@/adapters/canonical/canonicalRefResolution";
import type { Element } from "@/types/builder/unified.types";
import { resolveCanonicalDocument } from "../index";

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findResolvedOrUndefined(node.children ?? [], id);
    if (child) return child;
  }
  throw new Error(`resolved node not found: ${id}`);
}

function findResolvedOrUndefined(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findResolvedOrUndefined(node.children ?? [], id);
    if (child) return child;
  }
  return undefined;
}

function element(
  id: string,
  partial: Partial<Element> & Pick<Element, "type">,
): Element {
  return {
    id,
    parent_id: null,
    props: {},
    ...partial,
  } as Element;
}

describe("ADR-187 Phase 0 DOM/Skia presentation identity baseline", () => {
  it("freezes origin, ref root, ref descendant, and fan-out identities", () => {
    const instanceIds = ["instance-a", "instance-b", "instance-c"];
    const document = {
      version: "composition-1.0",
      children: [
        {
          id: "origin-card",
          type: "Card",
          reusable: true,
          children: [
            {
              id: "origin-label-id",
              customId: "stable-label-key",
              type: "Text",
              props: { children: "Origin" },
            },
          ],
        },
        {
          id: "page-home",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
          children: [
            {
              id: "body-home",
              type: "body",
              children: instanceIds.map((id) => ({
                id,
                type: "ref",
                ref: "origin-card",
              })),
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;

    const domTree = resolveCanonicalDocument(document);
    expect(findResolved(domTree, "origin-card").id).toBe("origin-card");
    expect(findResolved(domTree, "origin-label-id").id).toBe("origin-label-id");
    for (const instanceId of instanceIds) {
      const instance = findResolved(domTree, instanceId);
      expect(instance).toMatchObject({
        id: instanceId,
        _resolvedFrom: "origin-card",
      });
      expect(instance.children?.map((child) => child.id)).toEqual([
        "origin-label-id",
      ]);
    }

    const flatElements = [
      element("origin-card", {
        type: "Card",
        reusable: true,
      } as never),
      element("origin-label-id", {
        type: "Text",
        customId: "stable-label-key",
        parent_id: "origin-card",
        props: { children: "Origin" },
      }),
      ...instanceIds.map((id) =>
        element(id, {
          type: "ref",
          parent_id: "body-home",
          ref: "origin-card",
        } as Partial<Element> & Pick<Element, "type">),
      ),
    ];
    const skiaTree = resolveCanonicalRefTree({
      elements: flatElements,
      elementsMap: new Map(flatElements.map((item) => [item.id, item])),
    });

    expect(skiaTree.elementsMap.get("origin-label-id")?.id).toBe(
      "origin-label-id",
    );
    for (const instanceId of instanceIds) {
      expect(skiaTree.elementsMap.get(instanceId)?.id).toBe(instanceId);
      expect(
        skiaTree.childrenMap.get(instanceId)?.map((item) => item.id),
      ).toEqual([`${instanceId}/stable-label-key`]);
    }

    // One canonical origin descendant projects to origin + three refs (k=4),
    // while renderer-local IDs intentionally differ between DOM and Skia.
    expect(instanceIds.length + 1).toBe(4);
  });

  it.each([1, 4, 16])(
    "freezes actual Skia projection fan-out k=%i independently from document N",
    (projectionCount) => {
      const instanceIds = Array.from(
        { length: projectionCount - 1 },
        (_, index) => `instance-${index + 1}`,
      );
      const flatElements = [
        element("origin-card", {
          type: "Card",
          reusable: true,
        } as never),
        element("origin-label-id", {
          type: "Text",
          customId: "stable-label-key",
          parent_id: "origin-card",
          props: { children: "Origin" },
        }),
        ...instanceIds.map((id) =>
          element(id, {
            type: "ref",
            parent_id: "body-home",
            ref: "origin-card",
          } as Partial<Element> & Pick<Element, "type">),
        ),
      ];

      const skiaTree = resolveCanonicalRefTree({
        elements: flatElements,
        elementsMap: new Map(flatElements.map((item) => [item.id, item])),
      });
      const projectedDescendantIds = [
        "origin-label-id",
        ...instanceIds.map((id) => `${id}/stable-label-key`),
      ];

      expect(
        projectedDescendantIds.filter((id) => skiaTree.elementsMap.has(id)),
      ).toEqual(projectedDescendantIds);
      expect(projectedDescendantIds).toHaveLength(projectionCount);
    },
  );
});
