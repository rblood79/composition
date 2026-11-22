// @vitest-environment jsdom
/**
 * S2 체크리스트 §4.1 ListBox — a ListBox item's label is its control font and its description one step
 * down (S2 `PickerItem` — Menu.tsx `label({size})` · `description({size})`: S ui-xs · M ui-sm · L ui ·
 * XL ui-lg; XS, not in S2, takes S's). One table (the ListBoxItem rule's `sizeSelectors`) feeds the
 * Canvas part rules and the generated sheet — before, the Canvas drew the label 14 and the description
 * 12 at every size and the DOM the description 12.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

async function openListBox(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-listbox-item-text" as const,
        name: "S2 listbox item text",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-listbox-item-text-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const node = (
    id: string,
    type: string,
    children: string[],
    nodeProps: Record<string, unknown> = {},
  ) =>
    ({
      kind: "node",
      id: id as NodeId,
      // (Type definitions — a RAC ListBox collection of plain ListBoxItem · ListBoxSection elements.)
      definitionId: (type === "Text"
        ? "lib:definition:text"
        : `lib:definition:type-${type}`) as NodeEntry["definitionId"],
      children: children as NodeId[],
      props: Object.fromEntries(
        Object.entries(nodeProps).map(([key, value]) => [
          key,
          { kind: "set", value },
        ]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    }) as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        node(
          "project:node:lb",
          "ListBox",
          ["project:node:i1", "project:node:sec"],
          props,
        ),
        node("project:node:i1", "ListBoxItem", [
          "project:node:l1",
          "project:node:d1",
        ]),
        node("project:node:l1", "Text", [], {
          slot: "label",
          children: "Read",
        }),
        node("project:node:d1", "Text", [], {
          slot: "description",
          children: "Read only",
        }),
        node("project:node:sec", "ListBoxSection", ["project:node:i2"]),
        node("project:node:i2", "ListBoxItem", [
          "project:node:l2",
          "project:node:d2",
        ]),
        node("project:node:l2", "Text", [], {
          slot: "label",
          children: "Write",
        }),
        node("project:node:d2", "Text", [], {
          slot: "description",
          children: "Read and write",
        }),
      ],
      rootIds: ["project:node:lb" as NodeId],
      newId: workspace.newId,
    }),
  );
  return workspace.root;
}

const generated = (file: string) =>
  readFileSync(
    resolve(
      __dirname,
      "../../../../../../packages/shared/src/components/styles/generated",
      file,
    ),
    "utf8",
  );

describe("S2 ListBox item text steps — both consumers", () => {
  it.each([
    ["XS", 11, 11, "text-2xs", "text-2xs"],
    ["S", 12, 11, "text-xs", "text-2xs"],
    ["M", 14, 12, "text-sm", "text-xs"],
    ["L", 16, 14, "text-base", "text-sm"],
    ["XL", 18, 16, "text-lg", "text-base"],
  ])(
    "ListBox %s: label %d · description %d (Canvas), %s · %s (sheet)",
    async (size, label, description, labelToken, descriptionToken) => {
      const root = await openListBox({ size, selectionMode: "none" });
      const records = [...root.canvasInputs.values()];
      const text = (slot: string) =>
        records.filter(
          (r) => root.typeOf(r) === "Text" && r.props.slot === slot,
        );
      // (Two items — one in a ListBoxSection: the size reaches it through the section.)
      expect(text("label")).toHaveLength(2);
      for (const record of text("label")) {
        expect(record.visual.fontSize).toBe(label);
        expect(record.visual.fontWeight).toBe(500);
      }
      expect(text("description")).toHaveLength(2);
      for (const record of text("description"))
        expect(record.visual.fontSize).toBe(description);

      const list = [...root.domInputs.values()].find(
        (r) => r.sourceId === "project:node:lb",
      )!;
      const html = renderToStaticMarkup(renderCatalogDom(root, list.id));
      expect(
        html.match(
          new RegExp(
            `class="react-aria-ListBoxItem"[^>]*data-size="${size}"|data-size="${size}"[^>]*class="react-aria-ListBoxItem"`,
            "g",
          ),
        ),
      ).toHaveLength(2);
      const sheet = generated("ListBoxItem.css");
      const block = (slot: string) =>
        new RegExp(
          `\\.react-aria-ListBoxItem\\[data-size="${size}"\\] \\.react-aria-Text\\[slot="${slot}"\\] \\{([^}]*)\\}`,
        ).exec(sheet)?.[1];
      expect(block("label")).toContain(`var(--catalog-token-${labelToken})`);
      expect(block("description")).toContain(
        `var(--catalog-token-${descriptionToken})`,
      );
    },
  );

  it("the ListBox sheet no longer fixes the item text size (it would tie with the item's size blocks)", () => {
    const sheet = generated("ListBox.css");
    for (const [, body] of sheet.matchAll(
      /\[slot="(?:label|description)"\] \{([^}]*)\}/g,
    )) {
      expect(body).not.toMatch(/font-size|line-height/);
    }
  });
});
