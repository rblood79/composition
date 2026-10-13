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
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-14: a CheckboxGroup's Required reaches its Checkboxes — RAC reads a grouped item's
 * `isRequired ?? group's`, so the item passes none unless its own is on (it passed `false`, which
 * cut the group's off).
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(type: string, props: Record<string, string | boolean>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:group-required" as EntryId<"project">,
        name: "Group required",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `group-required-${Math.random()}`),
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
          id: FIELD,
          definitionId: `lib:definition:origin-component-${type}`,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const field = () =>
    [...workspace.root.domInputs.values()].find(
      (record) => record.sourceId === FIELD,
    )!;
  const html = () =>
    renderToStaticMarkup(renderCatalogDom(workspace.root, field().id));
  const part = (type: string) =>
    [...workspace.root.canvasInputs.values()].find(
      (record) => workspace.root.typeOf(record) === type,
    )!;
  return { workspace, field, html, part };
}

describe("a CheckboxGroup's Required reaches its Checkboxes", () => {
  it("required group: every checkbox input is required; not required: none", async () => {
    const required = (await open("checkboxgroup", { isRequired: true })).html();
    const inputs = required.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
    expect(inputs.length).toBeGreaterThan(1);
    expect(inputs.every((input) => /aria-required="true"|required=""/.test(input))).toBe(true);
    const optional = (await open("checkboxgroup", {})).html();
    expect(optional).not.toMatch(/<input[^>]*(aria-required="true"|required="")/);
  });
});
