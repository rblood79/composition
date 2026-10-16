import { describe, expect, it } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogAutomaticHtmlId,
  catalogUniqueHtmlId,
  type CatalogHtmlIdIndex,
} from "../attributes";

/**
 * ADR-265 C11: the ID field's automatic id, counted once per revision and stem, is the search's
 * answer (`catalogUniqueHtmlId`) — random holders, gaps, a node's own id (alone or shared), ids of
 * another stem and padded numbers — and follows a new revision.
 */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("ADR-265 C11 catalogAutomaticHtmlId", () => {
  it("equals the search for 5,000 random id tables", () => {
    const next = random(11);
    const node = (n: number) => `project:node:n${n}` as NodeId;
    for (let round = 0; round < 5_000; round++) {
      const holders = new Map<string, Set<string>>();
      const own = new Map<NodeId, string>();
      const give = (nodeId: NodeId, htmlId: string) => {
        own.set(nodeId, htmlId);
        let set = holders.get(htmlId);
        if (!set) holders.set(htmlId, (set = new Set()));
        set.add(nodeId);
      };
      const nodes = Math.floor(next() * 12);
      for (let n = 0; n < nodes; n++) {
        const roll = next();
        const number = 1 + Math.floor(next() * 8);
        give(
          node(n),
          roll < 0.7
            ? `text_${number}`
            : roll < 0.8
              ? `text_0${number}`
              : roll < 0.9
                ? `button_${number}`
                : `text`,
        );
      }
      const index: CatalogHtmlIdIndex & { revision: number } = {
        revision: round,
        nodesWithHtmlId: (htmlId) => holders.get(htmlId) ?? new Set(),
      };
      const self = node(Math.floor(next() * (nodes + 1)));
      for (const base of ["text", "text_3", "button"])
        expect(catalogAutomaticHtmlId(index, base, self, own.get(self))).toBe(
          catalogUniqueHtmlId(index, base, self),
        );
    }
  });

  it("counts again for a new revision, not for the same one", () => {
    const holders = new Map<string, Set<string>>([
      ["text_1", new Set(["project:node:a"])],
    ]);
    const index = {
      revision: 1,
      nodesWithHtmlId: (htmlId: string) => holders.get(htmlId) ?? new Set(),
    };
    const self = "project:node:z" as NodeId;
    expect(catalogAutomaticHtmlId(index, "text", self, undefined)).toBe(
      "text_2",
    );
    holders.set("text_2", new Set(["project:node:b"]));
    // Same revision: the counted answer stands (the index changes only with a commit).
    expect(catalogAutomaticHtmlId(index, "text", self, undefined)).toBe(
      "text_2",
    );
    index.revision = 2;
    expect(catalogAutomaticHtmlId(index, "text", self, undefined)).toBe(
      "text_3",
    );
  });
});
