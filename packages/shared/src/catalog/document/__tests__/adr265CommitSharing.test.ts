import { describe, expect, it } from "vitest";
import { createG1Fixture } from "../fixture";
import { CatalogGraph } from "../graph";
import type { CatalogEntry, NodeEntry } from "../types";

/**
 * ADR-265 Phase 1 (L3): a commit keeps a field the staged record shares with the record it
 * replaces (frozen all the way down) and copies every other field — the committed record still
 * equals the staged one, is frozen all the way down, and holds nothing the caller can change.
 */
const frozenDeep = (value: unknown): boolean =>
  !value ||
  typeof value !== "object" ||
  (Object.isFrozen(value) && Object.values(value).every(frozenDeep));

describe("ADR-265 commit sharing (ownedRecord)", () => {
  it("shares unchanged fields, copies changed ones, equals the staged record", () => {
    const { document, library } = createG1Fixture();
    const graph = new CatalogGraph(document, library);
    const before = graph.getEntry("project:node:cardA") as NodeEntry;
    // A style edit as a command builds it: the previous record spread, one field replaced.
    const visual: Record<string, unknown> = {
      ...before.visual,
      backgroundColor: "red",
    };
    const staged = { ...before, visual } as NodeEntry;
    graph.commit(
      new Map<string, CatalogEntry | null>([[staged.id, staged]]),
      "sharing",
      CatalogGraph.emptyMetrics(),
    );
    const after = graph.getEntry("project:node:cardA") as NodeEntry;
    expect(JSON.stringify(after)).toBe(JSON.stringify(staged));
    expect(frozenDeep(after)).toBe(true);
    // Unchanged fields are the committed (frozen) ones; the changed field is a copy.
    expect(after.children).toBe(before.children);
    expect(after.descendantOverrides).toBe(before.descendantOverrides);
    expect(after.props).toBe(before.props);
    expect(after.visual).not.toBe(visual);
    // The caller's object stays its own (not frozen by the commit).
    expect(Object.isFrozen(visual)).toBe(false);
    visual.backgroundColor = "blue";
    expect(after.visual.backgroundColor).toBe("red");
  });

  it("copies a field the caller built anew even when its content is the same", () => {
    const { document, library } = createG1Fixture();
    const graph = new CatalogGraph(document, library);
    const before = graph.getEntry("project:node:cardA") as NodeEntry;
    const children = [...before.children];
    graph.commit(
      new Map<string, CatalogEntry | null>([
        [before.id, { ...before, children }],
      ]),
      "rebuilt",
      CatalogGraph.emptyMetrics(),
    );
    const after = graph.getEntry("project:node:cardA") as NodeEntry;
    expect(after.children).toEqual(before.children);
    expect(after.children).not.toBe(children);
    expect(Object.isFrozen(after.children)).toBe(true);
    expect(Object.isFrozen(children)).toBe(false);
  });
});
