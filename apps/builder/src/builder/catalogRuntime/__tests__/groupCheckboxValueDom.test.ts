// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A Checkbox in a CheckboxGroup keeps its own `value` and `name` (RAC `useCheckboxGroupItem`: the
 * value is the item's key in the group and its form value, `name: props.name || group's`; S2 passes
 * both). The DOM gives them to RAC — an item without a value falls back to its record id.
 */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:group" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:group-value" as EntryId<"project">,
        name: "Group value",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `group-value-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: GROUP,
          definitionId: "lib:definition:origin-component-checkboxgroup",
          children: [],
          props: { name: set("fruits") },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [GROUP],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const boxes = () =>
    [...root.domInputs.values()].filter(
      (record) => root.typeOf(record) === "Checkbox",
    );
  const write = (index: number, props: Record<string, string | boolean>) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(boxes()[index]!.id)!.target],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  const group = () =>
    [...root.domInputs.values()].find((record) => record.sourceId === GROUP)!;
  const inputs = () =>
    renderToStaticMarkup(renderCatalogDom(root, group().id)).match(
      /<input[^>]*type="checkbox"[^>]*>/g,
    ) ?? [];
  return { boxes, write, inputs };
}

describe("a grouped Checkbox's value and name", () => {
  it("reach RAC: its value is the form value and the group's key; its name wins over the group's", async () => {
    const { boxes, write, inputs } = await open();
    expect(boxes().length).toBeGreaterThan(1);

    write(0, { value: "apple", isSelected: true });
    write(1, { value: "pear", name: "other" });
    const [first, second] = inputs();
    expect(first).toMatch(/value="apple"/);
    expect(first).toMatch(/name="fruits"/);
    // (Selected by its value — the group's default value holds the item's value.)
    expect(first).toMatch(/checked=""/);
    expect(second).toMatch(/value="pear"/);
    expect(second).toMatch(/name="other"/);
    expect(second).not.toMatch(/checked=""/);
  });
});
