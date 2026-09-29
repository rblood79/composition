import { describe, expect, it } from "vitest";
import { createG1Fixture } from "../../document/fixture";
import { CatalogGraph } from "../../document/graph";
import type { InstanceAddress, NodeEntry } from "../../document/types";
import { CatalogValidationError } from "../../document/validation";
import { resolveCatalogNode } from "../../resolution/resolver";
import { applyCatalogTransaction } from "../../transactions/transaction";
import type { CatalogCommand } from "../compose";
import { composeCommands } from "../compose";
import {
  resetDescendant,
  setFields,
  setHtmlId,
  setWholeField,
} from "../fields";

/**
 * ADR-248 Phase 4b field commands on owned nodes and instance template positions: the resolved
 * value changes, the edit stays a value delta (no structural op), and the inverse restores.
 */
const CARD = "project:node:cardA" as const;
const TEXT: InstanceAddress = {
  instances: [CARD],
  templatePath: ["lib:template:cardRoot", "lib:template:cardText"],
};
const fixture = () => {
  const { document, library } = createG1Fixture();
  const graph = new CatalogGraph(document, library);
  const text: NodeEntry = {
    kind: "node",
    id: "project:node:t",
    definitionId: "lib:definition:text",
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  const page = graph.getEntry("project:page:main");
  if (page?.kind !== "page") throw new Error("fixture");
  apply(graph, [
    { kind: "put", entry: text },
    { kind: "put", entry: { ...page, children: [...page.children, text.id] } },
  ]);
  return graph;
};
function apply(graph: CatalogGraph, ops: readonly unknown[], label = "edit") {
  return applyCatalogTransaction(graph, {
    projectId: graph.projectId,
    expectedRevision: graph.revision,
    history: { kind: "record", label },
    ops: ops as never,
  });
}
const run = (graph: CatalogGraph, command: CatalogCommand) => {
  const plan = command(graph);
  return apply(graph, plan.ops, plan.label);
};
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    if (error instanceof CatalogValidationError) return error.code;
    throw error;
  }
  return "ACCEPTED";
};
const cardText = (graph: CatalogGraph, breakpoint?: "tablet") =>
  resolveCatalogNode(graph, CARD, undefined, undefined, breakpoint).children[0]
    .children[0];

describe("ADR-248 Phase 4b field commands", () => {
  it("edits props and style on an owned node and a template position as value deltas", () => {
    const graph = fixture();
    const before = JSON.stringify(graph.exportDocument().entries);
    const plan = composeCommands(graph, "Edit", [
      setFields({
        targets: [{ kind: "node", id: "project:node:t" }],
        props: { children: { kind: "set", value: "Owned" } },
        visual: { color: { kind: "set", value: "red" } },
      }),
      setFields({
        targets: [{ kind: "descendant", ownerId: CARD, address: TEXT }],
        props: { children: { kind: "set", value: "Title" } },
        layout: { rowGap: { kind: "set", value: "4px" } },
      }),
    ]);
    const result = apply(graph, plan.ops, plan.label);
    expect(result.impact.structural).toBe(false);
    expect(resolveCatalogNode(graph, "project:node:t").props.children).toBe(
      "Owned",
    );
    expect(resolveCatalogNode(graph, "project:node:t").visual.color).toBe(
      "red",
    );
    expect(cardText(graph).props.children).toBe("Title");
    expect(cardText(graph).layout.rowGap).toBe("4px");
    apply(graph, result.inverse);
    expect(JSON.stringify(graph.exportDocument().entries)).toBe(before);
  });

  it("writes a breakpoint layer on a node and on a path patch", () => {
    const graph = fixture();
    run(
      graph,
      setFields({
        targets: [
          { kind: "node", id: "project:node:t" },
          { kind: "descendant", ownerId: CARD, address: TEXT },
        ],
        breakpoint: "tablet",
        visual: { color: { kind: "set", value: "green" } },
      }),
    );
    expect(cardText(graph, "tablet").visual.color).toBe("green");
    expect(cardText(graph).visual.color).not.toBe("green");
    expect(
      resolveCatalogNode(
        graph,
        "project:node:t",
        undefined,
        undefined,
        "tablet",
      ).visual.color,
    ).toBe("green");
    // Removing the only tablet key clears the patch's responsive value.
    run(
      graph,
      setFields({
        targets: [{ kind: "descendant", ownerId: CARD, address: TEXT }],
        breakpoint: "tablet",
        visual: { color: { kind: "remove" } },
      }),
    );
    expect(cardText(graph, "tablet").visual.color).not.toBe("green");
    expect(
      code(() =>
        setFields({
          targets: [{ kind: "node", id: "project:node:t" }],
          breakpoint: "mobile",
          props: { children: { kind: "set", value: "x" } },
        })(graph),
      ),
    ).toBe("PROPS_NOT_RESPONSIVE");
  });

  it("sets and clears whole fields (fills, visibility) and the DOM id; resets an override", () => {
    const graph = fixture();
    const fills = [
      {
        kind: "color" as const,
        id: "f",
        enabled: true,
        opacity: 1,
        blendMode: "normal" as const,
        color: "#112233ff",
      },
    ];
    run(
      graph,
      setWholeField({
        targets: [
          { kind: "node", id: "project:node:t" },
          { kind: "descendant", ownerId: CARD, address: TEXT },
        ],
        field: "fills",
        value: fills,
      }),
    );
    expect(resolveCatalogNode(graph, "project:node:t").fills).toEqual(fills);
    expect(cardText(graph).fills).toEqual(fills);
    run(
      graph,
      setWholeField({
        targets: [{ kind: "descendant", ownerId: CARD, address: TEXT }],
        field: "fills",
        value: undefined,
      }),
    );
    expect(cardText(graph).fills).toBeUndefined();
    expect(
      code(() =>
        setWholeField({
          targets: [{ kind: "descendant", ownerId: CARD, address: TEXT }],
          field: "themeOverride",
          value: { tint: "red" } as never,
        })(graph),
      ),
    ).toBe("FIELD_NOT_PATCHABLE");
    run(graph, setHtmlId({ id: "project:node:t", htmlId: "hero" }));
    expect(resolveCatalogNode(graph, "project:node:t").htmlId).toBe("hero");
    run(graph, setHtmlId({ id: "project:node:t", htmlId: "" }));
    expect(resolveCatalogNode(graph, "project:node:t").htmlId).toBeUndefined();
    // Reset one key, then the whole patch.
    run(
      graph,
      setFields({
        targets: [{ kind: "descendant", ownerId: CARD, address: TEXT }],
        props: { children: { kind: "set", value: "Title" } },
        visual: { color: { kind: "set", value: "red" } },
      }),
    );
    run(
      graph,
      resetDescendant({
        ownerId: CARD,
        address: TEXT,
        scope: "props",
        keys: ["children"],
      }),
    );
    expect(cardText(graph).props.children).toBe("title");
    expect(cardText(graph).visual.color).toBe("red");
    run(graph, resetDescendant({ ownerId: CARD, address: TEXT }));
    expect((graph.getEntry(CARD) as NodeEntry).descendantOverrides).toEqual([]);
  });
});
