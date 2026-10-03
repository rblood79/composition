// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-909 on the catalog DOM: an authored `gap` (`visual.gap`) and an authored row / column gap
 * (`layout.rowGap` · `layout.columnGap`) must not reach the inline style as a shorthand next to its
 * longhands (padding likewise). React updates inline styles key by key, so a later `gap` change rewrites the row gap
 * the Canvas keeps (the Rust input lets the longhand win — `compositionRoot.ts` `styleOf`), and
 * React warns about the conflicting properties. The DOM writes `gap` as its two longhands and the
 * authored longhand wins, like the layout input.
 */
async function openCard(
  gap: number,
  rowGap?: string,
  padding?: { padding: number; paddingTop: number },
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:gap" as const,
        name: "Gap",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `gap-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [
        {
          kind: "node",
          id: "project:node:card",
          definitionId: catalogPaletteDefinitionId(library, "Card"),
          children: [],
          props: {},
          visual: {
            gap: { kind: "set", value: gap },
            ...(padding
              ? {
                  // Side before shorthand: the precedence must not follow key order.
                  paddingTop: { kind: "set", value: padding.paddingTop },
                  padding: { kind: "set", value: padding.padding },
                }
              : {}),
          },
          sizing: { width: { kind: "set", value: 300 } },
          ...(rowGap
            ? { layout: { rowGap: { kind: "set", value: rowGap } } }
            : {}),
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: ["project:node:card"],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = [...root.domInputs.values()].find(
    (node) => node.sourceId === "project:node:card",
  )!;
  // The case under test: a rule with a generated sheet (authored values only go inline).
  expect(
    root.runtime.graph.library.rules.get(record.ruleId!)?.structure,
  ).toBeTruthy();
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, record.id));
  const element = host.querySelector<HTMLElement>("[style]")!;
  return Object.assign(element.style, {
    /** Declared property names, as rendered (jsdom composes a shorthand from four longhands). */
    declared: (element.getAttribute("style") ?? "")
      .split(";")
      .map((part) => part.split(":")[0].trim())
      .filter(Boolean),
  });
}

describe("catalog DOM gap — longhands only", () => {
  it("an authored gap reaches the DOM as row-gap and column-gap, not the shorthand", async () => {
    const style = await openCard(8);
    expect(style.declared).not.toContain("gap");
    expect(style.rowGap).toBe("8px");
    expect(style.columnGap).toBe("8px");
  });

  it("an authored row gap wins over the gap, as in the layout input", async () => {
    const style = await openCard(8, "4px");
    expect(style.declared).not.toContain("gap");
    expect(style.rowGap).toBe("4px");
    expect(style.columnGap).toBe("8px");
  });

  it("an authored padding reaches the DOM as its four sides; a side wins over it", async () => {
    const style = await openCard(8, undefined, { padding: 10, paddingTop: 2 });
    expect(style.declared).not.toContain("padding");
    expect(style.paddingTop).toBe("2px");
    expect(style.paddingRight).toBe("10px");
    expect(style.paddingBottom).toBe("10px");
    expect(style.paddingLeft).toBe("10px");
  });
});
