import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { editContractFixture } from "./support/editContractFixture";
import { catalogItemInsertChoices } from "../itemInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 Row `isDisabled` (RAC Row): a disabled row — RAC's `data-disabled` and `aria-disabled` in the
 * DOM, the Row rule's disabled opacity (0.38, `Table.css` `.react-aria-Row[data-disabled]`) on both
 * sides.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const measure: CatalogTextMeasure = (value, font) => ({
  width: value.length * font.fontSize * 0.5,
  exactWidth: value.length * font.fontSize * 0.5,
  minWidth: value.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

async function place(type: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:row-disabled" as EntryId<"project">,
        name: "Date locale",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `row-disabled-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      locale: "en-US",
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: FIELD,
          definitionId:
            `lib:definition:origin-component-${type}` as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const part = (typeName: string) =>
    [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === typeName,
    )!;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
    );
  const write = (props: Record<string, string>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  return { root, part, html, write, workspace };
}

describe("S2 Row isDisabled", () => {
  it("the Design panel offers it", () => {
    expect(
      editContractFixture("Row").fields.find(
        (field) => field.key === "isDisabled",
      )?.kind,
    ).toBe("boolean");
  });

  it("a disabled row: RAC's disabled row in the DOM, the rule's opacity on the Canvas", async () => {
    const { root, part, html, workspace } = await placeTable();
    const row = part("Row");
    expect(row.visual.opacity ?? 1).toBe(1);
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(row.id)!.target],
        props: { isDisabled: set(true) },
      }),
    );
    const disabled = part("Row");
    expect(disabled.visual.opacity).toBe(0.38);
    const markup = renderToStaticMarkup(
      renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
    );
    const rowTag = new RegExp(
      `<tr[^>]*data-catalog-id="${disabled.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`,
    ).exec(markup)?.[0];
    expect(rowTag).toMatch(/data-disabled="true"/);
    expect(html).toBeDefined();
  });
});

/** A Table with a column and a row (the Table's own "+" — Insert Column · Insert Row). */
async function placeTable() {
  const placed = await place("table");
  const { workspace, root, part } = placed;
  for (const type of ["Column", "Row"])
    workspace.execute(
      catalogItemInsertChoices(
        {
          graph: workspace.runtime.graph,
          readModel: workspace.readModel,
          newId: workspace.newId,
        },
        workspace.positionOfRecord(part("Table").id)!,
      )
        .find((choice) => choice.type === type)!
        .build(),
    );
  expect(root.typeOf(part("Row"))).toBe("Row");
  return placed;
}
