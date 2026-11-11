import { describe, expect, it } from "vitest";
import { catalogAuthoredFontRequests } from "../catalogFontUse";

/** ADR-307 — the fonts a document's page nodes write, read without the records. */
const set = <T>(value: T) => ({ kind: "set" as const, value });
const node = (
  id: string,
  fields: Record<string, unknown> = {},
  children: string[] = [],
) => ({
  kind: "node",
  id,
  children,
  props: {},
  visual: {},
  descendantOverrides: [],
  ...fields,
});
const graphOf = (entries: Record<string, unknown>) =>
  ({
    projectId: "project",
    getEntry: (id: string) => entries[id],
  }) as unknown as Parameters<typeof catalogAuthoredFontRequests>[0];
const key = (request: { family: string; weight: number; style: string }) =>
  `${request.family}/${request.weight}/${request.style}`;

describe("catalogAuthoredFontRequests", () => {
  it("asks for nothing when no page node writes a family or a style", () => {
    const graph = graphOf({
      project: { kind: "project", pageIds: ["page"] },
      page: { kind: "page", children: ["body"] },
      body: node("body", { visual: { fontWeight: set(700) } }, ["a"]),
      a: node("a"),
    });
    expect(catalogAuthoredFontRequests(graph, "Base")).toEqual([]);
  });

  it("reads every page: base and breakpoint layers, text runs, slot contents, replacements", () => {
    const graph = graphOf({
      project: { kind: "project", pageIds: ["p1", "p2"] },
      p1: { kind: "page", children: ["b1"] },
      p2: { kind: "page", children: ["b2"] },
      b1: node("b1", { visual: { fontFamily: set("Source Code Pro") } }, [
        "run",
      ]),
      run: node("run", {
        props: {
          children: set({
            kind: "text",
            runs: [{ text: "a", marks: { fontStyle: "italic" } }],
          }),
        },
      }),
      b2: node("b2", {
        responsive: { mobile: { visual: { fontWeight: set(700) } } },
        descendantOverrides: [
          { kind: "fillSlot", childIds: ["slotted"] },
          { kind: "replace", replacementId: "swapped" },
        ],
      }),
      slotted: node("slotted", {
        visual: { fontFamily: set("Adobe Clean Serif") },
      }),
      swapped: node("swapped", { visual: { fontStyle: { kind: "remove" } } }),
      // A node no page holds is not read.
      stray: node("stray", { visual: { fontFamily: set("Stray") } }),
    });
    expect(catalogAuthoredFontRequests(graph, "Base").map(key).sort()).toEqual(
      [
        "Adobe Clean Serif/400/italic",
        "Adobe Clean Serif/400/normal",
        "Adobe Clean Serif/700/italic",
        "Adobe Clean Serif/700/normal",
        "Source Code Pro/400/italic",
        "Source Code Pro/400/normal",
        "Source Code Pro/700/italic",
        "Source Code Pro/700/normal",
      ].sort(),
    );
  });

  it("a written style without a family asks for the base family's face", () => {
    const graph = graphOf({
      project: { kind: "project", pageIds: ["page"] },
      page: { kind: "page", children: ["body"] },
      body: node("body", { visual: { fontStyle: set("italic") } }),
    });
    expect(catalogAuthoredFontRequests(graph, "Base").map(key).sort()).toEqual([
      "Base/400/italic",
      "Base/400/normal",
    ]);
  });
});
