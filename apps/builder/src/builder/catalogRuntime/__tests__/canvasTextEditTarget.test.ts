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
  resolveCatalogClickRecord,
  resolveCatalogContextEntry,
  resolveCatalogContextExit,
  resolveCatalogTextEditRecord,
} from "../canvasPick";
import { catalogTextKey } from "../canvasText";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A double click enters a container one level (a document node, or a template position inside an
 * instance — its record identity: a Card's Content, a ListBox's item, 2026-10-13 사용자
 * 「listboxitem 은 group … 더블클릭으로 child 에 접근」), and edits text when it enters nothing:
 * the click target's own, or the text under the pointer inside it.
 */
const BODY = "project:node:home-body" as NodeId;
const CARD = "project:node:card" as NodeId;

async function placed(definitionId: string, id: NodeId) {
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
          id,
          definitionId: definitionId as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  const records = workspace.root.domInputs;
  const bySource = (suffix: string) =>
    [...records.values()].find((record) => record.sourceId.endsWith(suffix))!;
  const hasText = (id: string) => !!catalogTextKey(records.get(id));
  return { workspace, records, hasText, bySource };
}

async function placedCard() {
  const { records, hasText, bySource } = await placed(
    "lib:definition:origin-component-card",
    CARD,
  );
  return {
    records,
    hasText,
    card: bySource("node:card"),
    // (ADR-256 Phase 10: the S2 Card's title sits in its Content.)
    content: bySource("component-card__content"),
    // (Its title is the Content's first node — a placed Card holds its slots' contents as its own
    // nodes since 2026-10-14.)
    title: [...records.values()].find(
      (record) => record.parentId === bySource("component-card__content").id,
    )!,
    footer: bySource("component-card__footer"),
  };
}

describe("a double click enters one level, then edits the text it cannot enter further", () => {
  it("inside a Card: the Content (a template position) is entered, its title selected, then edited", async () => {
    const { records, hasText, card, content, title } = await placedCard();
    // In the Card (context = the Card node), the click target under the title is the Content; a
    // double click enters it (its record identity — one template id names it in every Card).
    expect(resolveCatalogContextEntry(records, title.id, card.sourceId)).toEqual({
      context: content.id,
      target: title.id,
    });
    // Inside the Content the title is the target itself: nothing to enter, its text is edited.
    expect(
      resolveCatalogContextEntry(records, title.id, content.id),
    ).toBeUndefined();
    expect(
      resolveCatalogTextEditRecord(records, title.id, title.id, hasText),
    ).toBe(title.id);
  });

  it("a ListBox's item is a group: a double click enters it and selects the child under the pointer", async () => {
    const LIST = "project:node:list" as NodeId;
    const { workspace, records, hasText, bySource } = await placed(
      "lib:definition:origin-component-listbox",
      LIST,
    );
    const list = bySource("node:list");
    // (A placed ListBox's items are its own nodes since 2026-10-14 — its first record child.)
    const item = [...records.values()].find(
      (record) => record.parentId === list.id,
    )!;
    const label = [...records.values()].find(
      (record) =>
        record.parentId === item.id && record.sourceId.endsWith("__label"),
    )!;
    // The item (an owned ListBoxItem instance) has a text of its own (`{label}`): before, the
    // double click edited that text instead of entering it.
    expect(item.sourceId.startsWith("project:node:")).toBe(true);
    expect(hasText(item.id)).toBe(true);
    // In the ListBox the click target is the item; a double click enters it, the label selected.
    expect(resolveCatalogClickRecord(records, label.id, list.sourceId)).toBe(
      item.id,
    );
    expect(resolveCatalogContextEntry(records, label.id, list.sourceId)).toEqual({
      context: item.sourceId,
      target: label.id,
    });
    // Inside the item a click selects its child; the next double click edits the label's text.
    expect(resolveCatalogClickRecord(records, label.id, item.sourceId)).toBe(label.id);
    expect(resolveCatalogContextEntry(records, label.id, item.sourceId)).toBeUndefined();
    expect(
      resolveCatalogTextEditRecord(records, label.id, label.id, hasText),
    ).toBe(label.id);
    // (An owned item is entered by its node id, as a Card.) The session takes it as its context and keeps it across a step; Escape
    // climbs back to the ListBox with the item selected.
    workspace.session.enterContext(item.sourceId);
    workspace.session.reconcile();
    expect(workspace.session.getSnapshot().editingContext).toBe(item.sourceId);
    expect(resolveCatalogContextExit(records, label.id, item.sourceId)).toEqual({
      select: item.id,
      context: list.sourceId,
    });
    workspace.dispose();
  });

  it("an element with its own text is edited itself", async () => {
    const { records, hasText, title } = await placedCard();
    expect(
      resolveCatalogTextEditRecord(records, title.id, title.id, hasText),
    ).toBe(title.id);
  });

  it("no text below the target, or a text outside it: nothing to edit", async () => {
    const { records, hasText, content, title, footer } = await placedCard();
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
      resolveCatalogTextEditRecord(records, content.id, content.id, hasText),
    ).toBeUndefined();
  });
});
