import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import {
  resolveCatalogContextEntry,
  resolveCatalogTextEditRecord,
} from "../canvasPick";
import { catalogTextKey } from "../canvasText";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A double click that enters nothing edits text: the click target's own, or — inside a container
 * the double click cannot enter (a template position of an instance: a Card's CardHeader) — the
 * text under the pointer. Before, a Card's title could not be edited on the Canvas: the double
 * click stopped at the CardHeader.
 */
const BODY = "project:node:home-body" as NodeId;
const CARD = "project:node:card" as NodeId;

async function placedCard() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:text-edit" as EntryId<"project">,
        name: "text edit",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `text-edit-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: CARD,
          definitionId:
            "lib:definition:origin-component-card" as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [CARD],
      newId: workspace.newId,
    }),
  );
  const records = workspace.root.domInputs;
  const bySource = (suffix: string) =>
    [...records.values()].find((record) => record.sourceId.endsWith(suffix))!;
  const hasText = (id: string) => !!catalogTextKey(records.get(id));
  return {
    records,
    hasText,
    card: bySource("node:card"),
    header: bySource("component-card__header"),
    title: bySource("component-card__title"),
    footer: bySource("component-card__footer"),
  };
}

describe("a double click edits the text it cannot enter further", () => {
  it("inside a Card: the CardHeader is not entered, its title is edited", async () => {
    const { records, hasText, card, header, title } = await placedCard();
    // In the Card (context = the Card node), the click target under the title is the CardHeader,
    // and a double click enters nothing: a template position is no context.
    expect(
      resolveCatalogContextEntry(records, title.id, card.sourceId),
    ).toBeUndefined();
    expect(
      resolveCatalogTextEditRecord(records, title.id, header.id, hasText),
    ).toBe(title.id);
  });

  it("an element with its own text is edited itself", async () => {
    const { records, hasText, title } = await placedCard();
    expect(
      resolveCatalogTextEditRecord(records, title.id, title.id, hasText),
    ).toBe(title.id);
  });

  it("no text below the target, or a text outside it: nothing to edit", async () => {
    const { records, hasText, header, title, footer } = await placedCard();
    // The pointer is on the footer (no text).
    expect(
      resolveCatalogTextEditRecord(records, footer.id, footer.id, hasText),
    ).toBeUndefined();
    // The picked text is not inside the target.
    expect(
      resolveCatalogTextEditRecord(records, title.id, footer.id, hasText),
    ).toBeUndefined();
    // A container without text picked as itself.
    expect(
      resolveCatalogTextEditRecord(records, header.id, header.id, hasText),
    ).toBeUndefined();
  });
});
