import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DataBindingRef,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { setDataEntries } from "../../../../../../packages/shared/src/catalog/commands/data";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import { catalogBindingRef } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogBuilderBoundRows } from "../catalogDataRead";
import { catalogItemInsertChoices } from "../itemInsert";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogCanvasNodeData } from "../canvasBinding";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-317 Phase 5 — a Table 「Striped rows」 on the Builder's Canvas (breakdown §5.5): its sample rows
 * shade every second one in the order the data layer gives them (the Row rule's derived `striped`
 * block — `{color.table-stripe}`), a merged run's Cells take the run's first row's, a selected row
 * shows its selection, an authored (unbound) Table's body rows by their place. Expected values are
 * written by hand from the fixture: p1 Ara A · p2 Bora A · p3 Chan A · p4 Dana B · p5 Eun B.
 */
const BODY = "project:node:home-body" as NodeId;
const TABLE = "project:node:table" as NodeId;
const COLLECTION = "data:collection:users" as DataBindingRef["collectionId"];
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
/** `#f8f8f8` — light `{color.table-stripe}` (S2 gray-50) as the Skia fill's channels. */
const STRIPE_FILL = [248, 248, 248, 255];
/** `#ffffff` — light `{color.base}`, the Table's own (a merged run's Cell over a shaded row). */
const BASE_FILL = [255, 255, 255, 255];

async function open(bind: boolean) {
  const library = await buildCodeCatalogLibrary();
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:striped" as EntryId<"project">,
      name: "Striped",
    }),
    library,
  );
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr317-striped-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        rowSample: true,
        rows: (binding, kind, ownerId, _instancePath, slices) =>
          catalogBuilderBoundRows(graph, binding, kind, ownerId, slices),
      },
    },
  );
  workspace.execute(
    setDataEntries({
      puts: [
        {
          kind: "collection",
          id: COLLECTION,
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
            { id: "f-type", key: "type", type: "string" },
          ],
          mockData: [
            { id: "p1", name: "Ara", type: "A" },
            { id: "p2", name: "Bora", type: "A" },
            { id: "p3", name: "Chan", type: "A" },
            { id: "p4", name: "Dana", type: "B" },
            { id: "p5", name: "Eun", type: "B" },
          ],
          useMockData: true,
        } as never,
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
      ],
      rootIds: [TABLE],
      newId: workspace.newId,
    }),
  );
  if (bind)
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: TABLE }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
      ),
    );
  await settle();
  const root = () => workspace.root;
  const typeOf = (record: { definitionId: string }) =>
    root().typeOf(record as never);
  const fillOf = (id: string) => {
    const fill = catalogCanvasNodeData(root(), id).box?.fillColor;
    return fill && [...fill].map((channel) => Math.round(channel * 255));
  };
  const set = async (props: Record<string, unknown>, target?: string) => {
    workspace.execute(
      setFields({
        targets: [
          target
            ? workspace.positionOfRecord(target)!.target
            : { kind: "node", id: TABLE },
        ],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set", value },
          ]),
        ) as never,
      }),
    );
    await settle();
  };
  /** The body's Rows: striped mark, fill, Cells. */
  const rows = () => {
    const records = [...root().canvasInputs.values()];
    const body = records.find((record) => typeOf(record) === "TableBody")!;
    return body.children
      .map((child) => root().canvasInputs.get(child)!)
      .filter((record) => typeOf(record) === "Row")
      .map((record) => ({
        record,
        striped: record.derivedProps?.striped === "true",
        fill: fillOf(record.id),
        cells: record.children
          .map((child) => root().canvasInputs.get(child)!)
          .filter((cell) => typeOf(cell) === "Cell"),
      }));
  };
  const column = (key: string) =>
    [...root().canvasInputs.values()].find(
      (record) => typeOf(record) === "Column" && record.props.key === key,
    )!;
  return { workspace, set, rows, column, fillOf };
}

describe("ADR-317 Phase 5 — Striped rows on the Builder's Canvas", () => {
  it("shades every second sample row with the stripe color — none while off", async () => {
    const t = await open(true);
    expect(t.rows()).toHaveLength(5);
    expect(t.rows().some((row) => row.striped)).toBe(false);
    await t.set({ isStriped: true });
    expect(t.rows().map((row) => row.striped)).toEqual([
      false,
      true,
      false,
      true,
      false,
    ]);
    expect(t.rows()[1]!.fill).toEqual(STRIPE_FILL);
    expect(t.rows()[3]!.fill).toEqual(STRIPE_FILL);
    expect(t.rows()[0]!.fill).not.toEqual(STRIPE_FILL);
    await t.set({ isStriped: false });
    expect(t.rows().some((row) => row.striped)).toBe(false);
    expect(t.rows()[1]!.fill).not.toEqual(STRIPE_FILL);
  }, 120_000);

  it("a merged run is one cell to the eye: its Cells take the run's first row's stripe", async () => {
    const t = await open(true);
    await t.set({ isStriped: true });
    await t.set({ mergeSameValues: true }, t.column("type").id);
    const rows = t.rows();
    // (Type A A A from p1 (unshaded) · B B from p4 (shaded): p2's Type Cell is `off` over its
    //  shaded row, p5's `on` over its unshaded one — no other Cell has its own.)
    const marked = rows.map((row) =>
      row.cells.flatMap((cell) =>
        cell.derivedProps?.cellStripe
          ? [[cell.id, cell.derivedProps.cellStripe] as const]
          : [],
      ),
    );
    expect(marked.map((cells) => cells.map(([, stripe]) => stripe))).toEqual([
      [],
      ["off"],
      [],
      [],
      ["on"],
    ]);
    expect(t.fillOf(marked[1]![0]![0])).toEqual(BASE_FILL);
    expect(t.fillOf(marked[4]![0]![0])).toEqual(STRIPE_FILL);
  }, 120_000);

  it("a selected row shows its selection; an authored (unbound) Table shades its body's second row", async () => {
    const t = await open(true);
    await t.set({
      isStriped: true,
      selectionMode: "multiple",
      selectionStyle: "highlight",
      selectedKeys: ["p2"],
    });
    expect(t.rows().map((row) => row.striped)).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(t.rows()[1]!.fill).not.toEqual(STRIPE_FILL);

    const authored = await open(false);
    // (The palette Table holds one body Row: two more by the Layers' 「+」 — authored rows.)
    for (let index = 0; index < 2; index += 1) {
      const body = [...authored.workspace.root.canvasInputs.values()].find(
        (record) => authored.workspace.root.typeOf(record) === "TableBody",
      )!;
      authored.workspace.execute(
        catalogItemInsertChoices(
          {
            graph: authored.workspace.runtime.graph,
            readModel: authored.workspace.readModel,
            newId: authored.workspace.newId,
          },
          authored.workspace.positionOfRecord(body.id)!,
        )
          .find((choice) => choice.type === "Row")!
          .build(),
      );
      await settle();
    }
    await authored.set({ isStriped: true });
    const rows = authored.rows();
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.striped)).toEqual(
      rows.map((_, index) => index % 2 === 1),
    );
    expect(rows[1]!.fill).toEqual(STRIPE_FILL);
  }, 120_000);
});
