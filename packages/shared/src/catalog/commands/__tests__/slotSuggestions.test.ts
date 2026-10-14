/**
 * ADR-261 Phase 3 — slot suggestions (Decision 3 · G2): a slot of a project component lists
 * suggested components (pen.dev — a hint, not a restriction). The graph checks they exist; removing
 * a component takes it out of the suggestions; another project's paste drops the project ones it
 * lacks (review m1) and keeps the library ones; the same project's paste keeps them.
 */
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../document/graph";
import type { DefinitionEntry, NodeEntry, NodeId } from "../../document/types";
import { dissolveComponent } from "../components";
import { setSlotDeclaration } from "../fields";
import { copyNodes, pasteNodes } from "../structure";
import {
  allocator,
  code,
  documentOf,
  graphOf,
  library,
  node,
  PAGE,
  run,
  snapshot,
  undo,
} from "./fixture";

const id = (name: string) => `project:node:${name}` as NodeId;
const SECTION = "lib:definition:section";
const definition = (name: string, root: string): DefinitionEntry => ({
  kind: "definition",
  id: `project:definition:${name}`,
  name,
  mode: "composite",
  accepts: {},
  defaults: {},
  visual: {},
  stateRules: {},
  templateRootId: id(root),
  originRef: true,
});
const CARD = "project:definition:Card" as const;
const CHIP = "project:definition:Chip" as const;

/** Card (origin on the page: root > slot S) · Chip (origin on the page). */
function fixture() {
  const nodes: NodeEntry[] = [
    node("root", SECTION, { children: [id("S")] }),
    node("S", SECTION, { slot: { name: "content", required: false } }),
    node("chip", SECTION),
  ];
  return graphOf(
    nodes,
    ["root", "chip"],
    [definition("Card", "root"), definition("Chip", "chip")],
  );
}
const suggest = (graph: CatalogGraph, suggested: string[]) =>
  run(
    graph,
    setSlotDeclaration({
      id: id("S"),
      slot: {
        name: "content",
        required: false,
        suggested: suggested as never,
      },
    }),
  );
const slotOf = (graph: CatalogGraph, name = "S") =>
  (graph.getEntry(id(name)) as NodeEntry).slot;

describe("ADR-261 Phase 3 — slot suggestions", () => {
  it("records project and library suggestions; undo restores", () => {
    const graph = fixture();
    const start = snapshot(graph);
    const { result } = suggest(graph, [CHIP, "lib:definition:badge"]);
    expect(slotOf(graph)?.suggested).toEqual([CHIP, "lib:definition:badge"]);
    undo(graph, result.inverse);
    expect(snapshot(graph)).toBe(start);
  });

  it("refuses a missing component, a duplicate and a non-definition id", () => {
    const graph = fixture();
    expect(code(() => suggest(graph, ["project:definition:none"]))).toBe(
      "DANGLING_DEFINITION",
    );
    expect(code(() => suggest(graph, [CHIP, CHIP]))).toBe(
      "DUPLICATE_SUGGESTION",
    );
    expect(code(() => suggest(graph, [id("chip")]))).toBe(
      "DEFINITION_ID_REQUIRED",
    );
    // An old document's slot (no field) loads as is.
    expect(
      () =>
        new CatalogGraph(
          documentOf(
            [node("x", SECTION, { slot: { name: "a", required: true } })],
            ["x"],
          ),
          library(),
        ),
    ).not.toThrow();
  });

  it("removing a suggested component takes it out of the suggestions", () => {
    const graph = fixture();
    suggest(graph, [CHIP, "lib:definition:badge"]);
    run(graph, dissolveComponent({ definitionId: CHIP, newId: allocator() }));
    expect(slotOf(graph)?.suggested).toEqual(["lib:definition:badge"]);
  });

  it("another project's paste drops the project suggestions it lacks; the same project keeps them", () => {
    const graph = fixture();
    suggest(graph, [CHIP, "lib:definition:badge"]);
    const clipboard = copyNodes(graph, [id("S")]);
    // Same project: kept.
    const same = run(
      graph,
      pasteNodes({
        clipboard,
        parent: { kind: "node", id: id("chip") },
        newId: allocator(),
      }),
    );
    const sameCopy = same.plan.selectAfter![0];
    expect((graph.getEntry(sameCopy) as NodeEntry).slot?.suggested).toEqual([
      CHIP,
      "lib:definition:badge",
    ]);
    // Another project (no Chip): only the library suggestion stays.
    const other = graphOf([node("host", SECTION)], ["host"]);
    const pasted = run(
      other,
      pasteNodes({
        clipboard,
        parent: { kind: "page", id: PAGE },
        newId: allocator(),
      }),
    );
    const copy = pasted.plan.selectAfter![0];
    expect((other.getEntry(copy) as NodeEntry).slot?.suggested).toEqual([
      "lib:definition:badge",
    ]);
  });
});

describe("ADR-261 Phase 3 review — a slot copy that suggests its own component", () => {
  it("dissolving a component whose instance's detached copy suggests it is not refused", () => {
    const graph = graphOf(
      [
        node("root", SECTION, { children: [id("S")] }),
        node("S", SECTION, { slot: { name: "content", required: false } }),
        node("chip", SECTION),
        node("ci", CHIP),
      ],
      ["root", "chip", "ci"],
      [definition("Card", "root"), definition("Chip", "chip")],
    );
    suggest(graph, [CHIP]);
    const newId = allocator();
    // A copy of the slot inside Chip's origin: it suggests Chip itself.
    const clipboard = copyNodes(graph, [id("S")]);
    run(
      graph,
      pasteNodes({
        clipboard,
        parent: { kind: "node", id: id("chip") },
        newId,
      }),
    );
    expect(
      code(() => run(graph, dissolveComponent({ definitionId: CHIP, newId }))),
    ).toBe("ACCEPTED");
    expect(graph.getEntry(CHIP)).toBeUndefined();
  });
});
