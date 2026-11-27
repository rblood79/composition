import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CollectionEntry,
  CollectionSaveSettings,
  DataBindingRef,
  EndpointEntry,
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { setDataEntries } from "../../../../../../packages/shared/src/catalog/commands/data";
import {
  setNodeInteractions,
  setSiteSettings,
} from "../../../../../../packages/shared/src/catalog/commands/project";
import { catalogBindingRef } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { catalogCollectionSaveCommand } from "../collectionSaveCommand";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-324 G1 — 「모아서 저장」 as a document contract: the switch's command (setting · save bar ·
 * edit marks) with undo · redo, the refusals (a rule that saves at once in either shape · no key
 * field · a batch with If-Match · a GET write endpoint · a save Do on a collection without it) and
 * the document's round trip. Expected values are written by hand.
 */
const BODY = "project:node:home-body" as NodeId;
const TABLE = "project:node:table" as NodeId;
const BUTTON = "project:node:button" as NodeId;
const COLLECTION = "data:collection:orders" as DataBindingRef["collectionId"];
const endpoint = (
  id: string,
  method: EndpointEntry["method"],
  path: string,
): EndpointEntry => ({
  kind: "endpoint",
  id: `data:endpoint:${id}` as EndpointEntry["id"],
  name: id,
  method,
  baseUrl: "http://stub.local",
  path,
  headers: [],
  queryParams: [],
  bodyType: method === "GET" || method === "DELETE" ? "none" : "json",
  responseMapping: { dataPath: "" },
  executionMode: "client",
});
const ROWS: CollectionSaveSettings = {
  send: {
    shape: "rows",
    update: { endpointId: "data:endpoint:patch", body: "changed" },
    create: { endpointId: "data:endpoint:post" },
    remove: { endpointId: "data:endpoint:delete" },
  },
};

async function open(
  schema = [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-name", key: "name", type: "string" },
    { id: "f-ver", key: "version", type: "string" },
  ],
) {
  const library = await buildCodeCatalogLibrary();
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:save" as EntryId<"project">,
      name: "Save",
    }),
    library,
  );
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr324-g1-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    setDataEntries({
      puts: [
        {
          kind: "collection",
          id: COLLECTION,
          name: "Orders",
          schema,
          mockData: [{ id: "o1", name: "볼펜", version: "v1" }],
          useMockData: true,
        } as CollectionEntry,
        endpoint("patch", "PATCH", "/orders/{{ key }}"),
        endpoint("post", "POST", "/orders"),
        endpoint("delete", "DELETE", "/orders/{{ key }}"),
        endpoint("one", "GET", "/orders/{{ key }}"),
      ],
    }),
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: TABLE,
          definitionId: catalogPaletteDefinitionId(library, "Table"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
        {
          kind: "node",
          id: BUTTON,
          definitionId: catalogPaletteDefinitionId(library, "Button"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [TABLE, BUTTON],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: TABLE }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "orders",
        name: "Orders",
      })!,
    ),
  );
  const graphOf = () => workspace.runtime.graph;
  const collection = () => graphOf().getEntry(COLLECTION) as CollectionEntry;
  const rules = () => {
    const project = graphOf().getEntry(graphOf().projectId) as ProjectEntry;
    return project.interactionIds.map(
      (id) => graphOf().getEntry(id) as InteractionEntry,
    );
  };
  const turnOn = (
    save: CollectionSaveSettings | undefined,
    extra: { removeRuleIds?: string[]; bars?: boolean } = {},
  ) =>
    workspace.execute(
      catalogCollectionSaveCommand(
        graphOf(),
        {
          collectionId: COLLECTION,
          save,
          ...(extra.removeRuleIds
            ? { removeRuleIds: extra.removeRuleIds }
            : {}),
          ...(extra.bars ? { saveBars: true } : {}),
        },
        workspace.newId,
      ),
    );
  const rule = (
    ownerId: NodeId,
    trigger: string,
    actions: InteractionEntry["actions"],
  ) =>
    workspace.execute(
      setNodeInteractions({
        ownerId,
        entries: [
          {
            kind: "interaction",
            id: workspace.newId("interaction") as EntryId<"interaction">,
            ownerId,
            trigger,
            actions,
          },
        ],
      }),
    );
  const bodyChildren = () => (graphOf().getEntry(BODY) as NodeEntry).children;
  return {
    workspace,
    graphOf,
    collection,
    rules,
    turnOn,
    rule,
    bodyChildren,
    library,
  };
}

const refusal = (run: () => unknown): string | undefined => {
  try {
    run();
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
};

describe("ADR-324 G1 — 「모아서 저장」 문서 계약", () => {
  it("turning on: the setting, a save bar after the Table with its seven rules, the Table's edit marks — one undo", async () => {
    const { workspace, collection, rules, turnOn, bodyChildren, graphOf } =
      await open();
    turnOn(ROWS, { bars: true });
    expect(collection().save).toEqual(ROWS);
    const children = bodyChildren();
    expect(children.indexOf(TABLE) + 1).toBe(
      children.findIndex(
        (id) => (graphOf().getEntry(id) as NodeEntry).name === "Save bar",
      ),
    );
    const bar = graphOf().getEntry(
      children[children.indexOf(TABLE) + 1]!,
    ) as NodeEntry;
    expect(bar.children).toHaveLength(8);
    const order = (action: object) => JSON.stringify(Object.entries(action).sort());
    expect(rules().map((rule) => order(rule.actions[0]!)).sort()).toEqual(
      [
        { opcode: "saveChanges", collectionId: COLLECTION },
        { opcode: "discardChanges", collectionId: COLLECTION },
        { opcode: "saveChanges", collectionId: COLLECTION, scope: "conflicts" },
        { opcode: "discardChanges", collectionId: COLLECTION, scope: "conflicts" },
        { opcode: "saveChanges", collectionId: COLLECTION, scope: "link" },
        { opcode: "saveChanges", collectionId: COLLECTION, scope: "pending" },
        { opcode: "discardChanges", collectionId: COLLECTION, scope: "pending" },
      ]
        .map(order)
        .sort(),
    );
    const table = graphOf().getEntry(TABLE) as NodeEntry;
    expect(table.props.showEditMarks).toEqual({ kind: "set", value: true });
    // (The bar's texts are the site's language — none set: English.)
    const text = graphOf().getEntry(bar.children[0]!) as NodeEntry;
    expect(text.props.children).toEqual({
      kind: "set",
      value: "Unsaved changes: {{ changes.orders.count }}",
    });
    workspace.undo();
    expect(collection().save).toBeUndefined();
    expect(bodyChildren()).toEqual([TABLE, BUTTON]);
    expect(rules()).toHaveLength(0);
    workspace.redo();
    expect(collection().save).toEqual(ROWS);
    expect(rules()).toHaveLength(7);
  });

  it("a Korean site's save bar is written in Korean (the site's language, not the Builder's)", async () => {
    const { workspace, turnOn, bodyChildren, graphOf } = await open();
    workspace.execute(setSiteSettings({ patch: { lang: "ko" } }));
    turnOn(ROWS, { bars: true });
    const children = bodyChildren();
    const bar = graphOf().getEntry(
      children[children.indexOf(TABLE) + 1]!,
    ) as NodeEntry;
    const texts = bar.children.map((id) => {
      const node = graphOf().getEntry(id) as NodeEntry;
      return (node.props.children ?? node.props.label) as { value?: unknown };
    });
    expect(texts.map((write) => write?.value)).toContain(
      "저장 안 된 변경 {{ changes.orders.count }}건",
    );
    expect(texts.map((write) => write?.value)).toContain("내 값으로 다시 저장");
  });

  it("round 3 m14 — the switch that made the save bar turns it off: the bar and its rules go, a save Do elsewhere loses its rule only — one undo", async () => {
    const { workspace, collection, rules, turnOn, rule, bodyChildren } =
      await open();
    turnOn(ROWS, { bars: true });
    // (The author's own save Button, outside the bar.)
    rule(BUTTON, "onPress", [
      { opcode: "saveChanges", collectionId: COLLECTION },
    ]);
    expect(rules()).toHaveLength(8);
    expect(refusal(() => turnOn(undefined))).toBeUndefined();
    expect(collection().save).toBeUndefined();
    expect(bodyChildren()).toEqual([TABLE, BUTTON]);
    expect(rules()).toHaveLength(0);
    workspace.undo();
    expect(collection().save).toEqual(ROWS);
    expect(bodyChildren()).toHaveLength(3);
    expect(rules()).toHaveLength(8);
  });

  it("round 3 h9 — each write connection takes its own methods: an update is never a DELETE", async () => {
    const { turnOn } = await open();
    const rows = (send: object) =>
      refusal(() =>
        turnOn({ send: { shape: "rows", ...send } } as CollectionSaveSettings),
      );
    expect(
      rows({ update: { endpointId: "data:endpoint:delete", body: "changed" } }),
    ).toBe("SAVE_ENDPOINT_METHOD");
    expect(
      rows({ update: { endpointId: "data:endpoint:post", body: "changed" } }),
    ).toBe("SAVE_ENDPOINT_METHOD");
    expect(rows({ create: { endpointId: "data:endpoint:patch" } })).toBe(
      "SAVE_ENDPOINT_METHOD",
    );
    expect(rows({ remove: { endpointId: "data:endpoint:post" } })).toBe(
      "SAVE_ENDPOINT_METHOD",
    );
    expect(
      refusal(() =>
        turnOn({
          send: {
            shape: "batch",
            endpointId: "data:endpoint:delete",
            atomic: true,
          },
        }),
      ),
    ).toBe("SAVE_ENDPOINT_METHOD");
  });

  it("a rule that saves the edits at once — on the Table's 「Cells change」 or editing and posting in one — refuses it; 「규칙을 지우고 켜기」 is one command", async () => {
    const { turnOn, rule, rules, collection, workspace } = await open();
    rule(TABLE, "onCellsChange", [
      { opcode: "callEndpoint", endpointId: "data:endpoint:patch" },
    ]);
    expect(refusal(() => turnOn(ROWS))).toBe("IMMEDIATE_SAVE_RULE");
    turnOn(ROWS, { removeRuleIds: rules().map((item) => item.id) });
    expect(collection().save).toEqual(ROWS);
    expect(rules()).toHaveLength(0);
    // (Shape 2: a Do that edits it with a write call — refused while it is on.)
    expect(
      refusal(() =>
        rule(BUTTON, "onPress", [
          { opcode: "append", collectionId: COLLECTION },
          { opcode: "callEndpoint", endpointId: "data:endpoint:post" },
        ]),
      ),
    ).toBe("IMMEDIATE_SAVE_RULE");
    // (A read call beside an edit is no save.)
    rule(BUTTON, "onPress", [
      { opcode: "append", collectionId: COLLECTION },
      { opcode: "callEndpoint", endpointId: "data:endpoint:one" },
    ]);
    workspace.undo();
    expect(rules()).toHaveLength(0);
  });

  it("refused shapes: no key field · a batch with If-Match · a GET write · a POST read-by-key · a save Do on a collection without it", async () => {
    const keyless = await open([
      { id: "f-name", key: "name", type: "string" },
      { id: "f-ver", key: "version", type: "string" },
    ]);
    expect(refusal(() => keyless.turnOn(ROWS))).toBe("SAVE_KEY_FIELD_REQUIRED");
    // (Creates only need no key.)
    keyless.turnOn({
      send: { shape: "rows", create: { endpointId: "data:endpoint:post" } },
    });

    const { turnOn, rule } = await open();
    expect(
      refusal(() =>
        turnOn({
          send: {
            shape: "batch",
            endpointId: "data:endpoint:post",
            atomic: true,
          },
          conflict: { by: "version", fieldId: "f-ver", send: "ifMatch" },
        }),
      ),
    ).toBe("SAVE_BATCH_IF_MATCH");
    expect(
      refusal(() =>
        turnOn({
          send: {
            shape: "rows",
            update: { endpointId: "data:endpoint:one", body: "changed" },
          },
        }),
      ),
    ).toBe("SAVE_ENDPOINT_METHOD");
    expect(
      refusal(() =>
        turnOn({
          ...ROWS,
          conflict: { by: "recheck", endpointId: "data:endpoint:post" },
        }),
      ),
    ).toBe("SAVE_ENDPOINT_METHOD");
    expect(
      refusal(() =>
        rule(BUTTON, "onPress", [
          { opcode: "saveChanges", collectionId: COLLECTION },
        ]),
      ),
    ).toBe("SAVE_NOT_ENABLED");
  });

  it("the setting and the Dos survive the document's round trip", async () => {
    const { turnOn, graphOf, library } = await open();
    turnOn(
      {
        send: {
          shape: "batch",
          endpointId: "data:endpoint:post",
          atomic: false,
          gzip: true,
        },
        conflict: { by: "version", fieldId: "f-ver", send: "body" },
        idempotency: { in: "header", name: "Idempotency-Key" },
      },
      { bars: true },
    );
    const document = graphOf().exportDocument();
    const again = new CatalogGraph(
      JSON.parse(JSON.stringify(document)),
      library,
    );
    expect((again.getEntry(COLLECTION) as CollectionEntry).save).toEqual({
      send: {
        shape: "batch",
        endpointId: "data:endpoint:post",
        atomic: false,
        gzip: true,
      },
      conflict: { by: "version", fieldId: "f-ver", send: "body" },
      idempotency: { in: "header", name: "Idempotency-Key" },
    });
  });
});
