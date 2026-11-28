import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertCollectionItem,
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CASCADER_ITEM_ORIGIN_ID } from "../../../../../../packages/shared/src/catalog/document/cascaderOrigins";
import { catalogHiddenAtRest } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import {
  catalogCascaderItemDependents,
  catalogCascaderItemDuplicate,
  catalogCascaderItemSelected,
} from "../../../../../../packages/shared/src/catalog/runtime/cascader";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { cascaderBinding } from "../../../../../../packages/shared/src/catalog/bindings/Cascader.binding";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { catalogSelectionSurface } from "../canvasSelectionGeometry";
import {
  bindCatalogCanvas,
  catalogCanvasNodeData,
  catalogCascaderRowData,
} from "../canvasBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-326 Phase 4 (G4 — breakdown §4.5 · §5): the Design panel's Open draws a `columns` Cascader's
 * just-opened screen on the Canvas — its Popover below the open Button, as wide as the Button
 * (S2 Picker), the first level's items (their name · a branch's chevron — a leaf draws none), no
 * deeper item; off closes it, Undo opens it again; a click on the open box is the Cascader's
 * selection (its surface). Expected values are written out here: the template's first level is
 * Electronics · Clothing · Books (Books a leaf).
 */
const BODY = "project:node:home-body" as NodeId;

async function place(props: Record<string, unknown> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr326-g4" as EntryId<"project">,
        name: "ADR-326 G4",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr326-g4-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
    },
  );
  const command = catalogPaletteInsertCommand(
    {
      graph: workspace.runtime.graph,
      records: workspace.root.domInputs,
      selection: () => [],
      itemOfRecord: (id) => workspace.itemOfRecord(id),
      pageContent: () => ({ kind: "node", id: BODY }),
      newId: workspace.newId,
    },
    "Cascader",
    props,
  );
  const placed = workspace.execute(command!).plan.selectAfter![0] as NodeId;
  const root = workspace.root;
  const records = () => [...root.canvasInputs.values()];
  const of = (type: string) =>
    records().filter((record) => root.typeOf(record) === type);
  const field = () =>
    records().find(
      (record) =>
        record.sourceId === placed && root.typeOf(record) === "Cascader",
    )!;
  const hidden = (record: CatalogConsumerNode) => {
    for (
      let cursor: CatalogConsumerNode | undefined = record;
      cursor;
      cursor = root.canvasInputs.get(cursor.parentId)
    )
      if (cursor.hidden) return true;
    return false;
  };
  const popover = () => of("Popover")[0]!;
  const shownItems = () =>
    of("CascaderItem")
      .filter((item) => !hidden(item))
      .map((item) => String(item.props.label));
  const write = (patch: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: placed }],
        props: Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [
            key,
            value === undefined ? { kind: "delete" } : { kind: "set", value },
          ]),
        ),
      } as never),
    );
  return { workspace, root, of, field, hidden, popover, shownItems, write };
}

describe("ADR-326 G4 — Canvas: a columns Cascader's just-opened screen", () => {
  it("Open 은 Value 절의 칸 (S2 Picker 의 isOpen) — 시작 열림은 패널에 없다", () => {
    expect(cascaderBinding.props.accepts.isOpen).toMatchObject({
      kind: "boolean",
      label: "Open",
      section: "value",
    });
    expect(cascaderBinding.props.accepts.defaultOpen).toMatchObject({
      editorHidden: true,
    });
  });

  it("닫힌 필드는 열린 상자 · 항목을 그리지 않는다", async () => {
    const h = await place();
    expect(h.hidden(h.popover())).toBe(true);
    expect(h.shownItems()).toEqual([]);
  });

  it("Open: 상자가 여는 Button 아래 · 같은 폭 · 첫 단계 항목만 · 잎의 chevron 없음", async () => {
    const h = await place({ isOpen: true });
    const pop = h.popover();
    expect(h.hidden(pop)).toBe(false);
    expect(h.shownItems()).toEqual(["Electronics", "Clothing", "Books"]);
    const button = h
      .of("Button")
      .find(
        (record) => h.root.canvasInputs.get(record.parentId) === h.field(),
      )!;
    const boxes = h.root.getGeometry([pop.id, button.id]);
    const placement = h.root.getOverlayPlacement(pop.id)!;
    const anchor = boxes.get(button.id)!;
    expect(placement.width).toBe(anchor.width);
    expect(placement.minWidth).toBe(anchor.width);
    // (Its left edge is the Button's — a picker's collision budget keeps the trigger's place at the
    //  viewport edge, the DOM's `CatalogPopover`.)
    expect(boxes.get(pop.id)!.x).toBe(anchor.x);
    // (Its own `bottom start` — RAC's from the field's PopoverContext.)
    expect(placement.placement).toBe("bottom");
    // (A branch keeps its chevron Icon, a leaf draws none — the DOM row's.)
    const chevrons = h
      .of("CascaderItem")
      .filter((item) => !h.hidden(item))
      .map((item) => {
        const icon = item.children
          .map((id) => h.root.canvasInputs.get(id)!)
          .find(
            (child) =>
              h.root.typeOf(child) === "Icon" &&
              child.props.slot === "descriptor",
          );
        return [String(item.props.label), !!icon && !h.hidden(icon)];
      });
    expect(chevrons).toEqual([
      ["Electronics", true],
      ["Clothing", true],
      ["Books", false],
    ]);
    // (The open Button is pressed — RAC's `isPressed` while open.)
    expect(button.derivedProps?._overlayOpen).toBe(true);
  });

  it("상자 폭을 넓혀도 왼쪽 끝 = Button 왼쪽 끝 (필드 context 의 bottom start — DOM 과 같다)", async () => {
    const h = await place({ isOpen: true });
    // (The field away from the page edge — a centred box would start left of the Button.)
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: h.field().sourceId as NodeId }],
        layout: { marginLeft: { kind: "set", value: "200px" } },
        // (A 260 field — a page-wide one's Button sets the box's minimum past 400.)
        visual: { width: { kind: "set", value: 260 } },
      } as never),
    );
    const pop = h.popover();
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(pop.id)!.target],
        visual: { width: { kind: "set", value: 400 } },
      } as never),
    );
    const button = h
      .of("Button")
      .find(
        (record) => h.root.canvasInputs.get(record.parentId) === h.field(),
      )!;
    const boxes = h.root.getGeometry([h.popover().id, button.id]);
    expect(boxes.get(h.popover().id)!.width).toBe(400);
    expect(boxes.get(h.popover().id)!.x).toBe(boxes.get(button.id)!.x);
  });

  it("끄면 닫히고 Undo 로 다시 열린다", async () => {
    const h = await place({ isOpen: true });
    h.write({ isOpen: false });
    expect(h.hidden(h.popover())).toBe(true);
    expect(h.shownItems()).toEqual([]);
    h.workspace.undo();
    expect(h.hidden(h.popover())).toBe(false);
    expect(h.shownItems()).toEqual(["Electronics", "Clothing", "Books"]);
  });

  it("열린 상자가 Cascader 의 선택 표면이다", async () => {
    const h = await place({ isOpen: true });
    expect(catalogSelectionSurface(h.root, h.field().id)).toBe(h.popover().id);
  });

  // ── Phase 4 판독 1 수리 (#2 · #3 · #4 · #5) ──

  it("#1 고른 행의 check 표시 (Icon 노드) — 고른 행에만 그리고, 모든 행이 check 열을 잡는다 (Preview 와 같다)", async () => {
    const h = await place({ isOpen: true, defaultValue: "books" });
    const marks = () =>
      h
        .of("CascaderItem")
        .filter((item) => !h.hidden(item))
        .map((item) => {
          const check = item.children
            .map((id) => h.root.canvasInputs.get(id)!)
            .find((child) => child.props.slot === "selection")!;
          return [
            String(item.props.label),
            !h.hidden(check) && check.derivedProps?._selectionMarkHidden !== true,
          ];
        });
    expect(marks()).toEqual([
      ["Electronics", false],
      ["Clothing", false],
      ["Books", true],
    ]);
    // (Every row keeps the column — the labels stand at one x.)
    const labels = h
      .of("CascaderItem")
      .filter((item) => !h.hidden(item))
      .map(
        (item) =>
          item.children
            .map((id) => h.root.canvasInputs.get(id)!)
            .find((child) => child.props.slot === "label")!.id,
      );
    const xs = [...h.root.getGeometry(labels).values()].map((box) => box.x);
    expect(new Set(xs).size).toBe(1);
    // (A branch key names no value row: no mark; Undo brings Books' back.)
    h.write({ defaultValue: "electronics" });
    expect(marks().every(([, shown]) => !shown)).toBe(true);
    h.workspace.undo();
    expect(marks()).toEqual([
      ["Electronics", false],
      ["Clothing", false],
      ["Books", true],
    ]);
  });

  it("#2 첫 단계 항목도 Show when 이 거짓이면 그리지 않는다 (Preview 와 같다)", async () => {
    const h = await place({ isOpen: true });
    const books = h
      .of("CascaderItem")
      .find((item) => item.props.label === "Books")!;
    const get = (id: string) => h.root.canvasInputs.get(id);
    expect(catalogHiddenAtRest(books, get, h.root.typeOf)).toBe(false);
    // (Its own `isDisabled` off — a `showWhen: isDisabled` item is not there, as in the DOM.)
    expect(
      catalogHiddenAtRest(
        { ...books, showWhen: { all: ["isDisabled"] } },
        get,
        h.root.typeOf,
      ),
    ).toBe(true);
  });

  it("#3 key 가 겹쳐 고를 수 없는 첫 단계 행은 Canvas 에서도 disabled (DOM Menu 의 disabledKeys)", async () => {
    const h = await place({ isOpen: true, allowsBranchSelection: true });
    const item = (label: string) =>
      h.of("CascaderItem").find((record) => record.props.label === label)!;
    const disabled = () =>
      ["Electronics", "Clothing", "Books"].map(
        (label) => item(label).derivedProps?.isDisabled === true,
      );
    expect(disabled()).toEqual([false, false, false]);
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(item("Clothing").id)!.target],
        props: {
          id: { kind: "set", value: String(item("Electronics").props.id) },
        },
      } as never),
    );
    expect(disabled()).toEqual([true, true, false]);
    h.workspace.undo();
    expect(disabled()).toEqual([false, false, false]);    // (The field's level choice decides which rows are values — branches repeat only then.)
    h.workspace.redo();
    h.write({ allowsBranchSelection: false });
    expect(disabled()).toEqual([false, false, false]);
    h.write({ allowsBranchSelection: true });
    expect(disabled()).toEqual([true, true, false]);
  });

  it("#4 Popover 의 상대 단위 Min W (50vw) 를 Canvas 도 지킨다", async () => {
    const h = await place({ isOpen: true });
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: h.field().sourceId as NodeId }],
        visual: { width: { kind: "set", value: 260 } },
      } as never),
    );
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(h.popover().id)!.target],
        visual: { minWidth: { kind: "set", value: "50vw" } },
      } as never),
    );
    // (1200 viewport — 50vw = 600, inside the room the collision padding leaves.)
    expect(
      h.root.getGeometry([h.popover().id]).get(h.popover().id)!.width,
    ).toBe(600);
  });

  it("#5 Cascader 검색 칸은 열 때마다 비어 있다 (작성한 Value 를 그리지 않는다)", async () => {
    const h = await place({ isOpen: true });
    const search = h.of("SearchField")[0]!;
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(search.id)!.target],
        props: { value: { kind: "set", value: "Books" } },
      } as never),
    );
    const input = h.of("Input").find((record) => {
      for (
        let at: CatalogConsumerNode | undefined = record;
        at;
        at = h.root.canvasInputs.get(at.parentId)
      )
        if (at.id === h.of("SearchField")[0]!.id) return true;
      return false;
    })!;
    expect(input.derivedProps?._inputHasValue).toBe(false);
    expect(h.shownItems()).toEqual(["Electronics", "Clothing", "Books"]);
    // (수리 검증 #4 — nor its clear button: the DOM's empty query has none, `data-empty`.)
    const inSearch = (record: CatalogConsumerNode) => {
      for (
        let at: CatalogConsumerNode | undefined = record;
        at;
        at = h.root.canvasInputs.get(at.parentId)
      )
        if (at.id === h.of("SearchField")[0]!.id) return true;
      return false;
    };
    const clear = h.of("Button").filter(inSearch);
    expect(clear.length).toBe(1);
    expect(h.hidden(clear[0]!)).toBe(true);
  });

  it("Stop 판독 — 행마다 묻는 중복 · 선택 판정은 한 pass 에 표 하나 (행 수에 선형)", () => {
    // (A synthetic field: 2,000 first-level rows — one pass asks every row; the lookups it makes
    //  stay linear in the rows, not rows × rows.)
    const rows = 2000;
    const records = new Map<string, CatalogConsumerNode>();
    const node = (
      id: string,
      type: string,
      parentId: string,
      children: string[],
      props: Record<string, unknown> = {},
    ) =>
      records.set(id, {
        id,
        parentId,
        children,
        props: { _type: type, ...props },
      } as unknown as CatalogConsumerNode);
    const items = Array.from({ length: rows }, (_, i) => `item-${i}`);
    node("field", "Cascader", "body", ["pop"], { defaultValue: "k-7" });
    node("pop", "Popover", "field", ["list"]);
    node("list", "CascaderList", "pop", items);
    items.forEach((id, i) =>
      node(id, "CascaderItem", "list", [], {
        id: i === 3 ? "k-9" : `k-${i}`,
        label: id,
      }),
    );
    const typeOf = (record: CatalogConsumerNode) => String(record.props._type);
    const pass = (count: { n: number }) => {
      const get = (id: string) => {
        count.n++;
        return records.get(id);
      };
      return items.map((id) => {
        const item = records.get(id)!;
        return [
          catalogCascaderItemDuplicate(item, get, typeOf),
          catalogCascaderItemSelected(item, get, typeOf),
        ];
      });
    };
    const count = { n: 0 };
    const result = pass(count);
    // (k-9 twice: rows 3 and 9 repeat a key; k-7 is the start value.)
    expect(result.filter(([dup]) => dup).length).toBe(2);
    expect(result.flatMap(([, sel], i) => (sel ? [i] : []))).toEqual([7]);
    expect(count.n).toBeLessThan(rows * 20);
    // (A multiple field whose value holds every row's key — the key list is as long as the rows.)
    //  The value list's reads are counted: read once a pass, not once a row.)
    const reads = { n: 0 };
    const value = new Proxy(
      items.map((_, i) => `k-${i}`),
      {
        get(target, key, receiver) {
          if (typeof key === "string" && /^\d+$/.test(key)) reads.n++;
          return Reflect.get(target, key, receiver);
        },
      },
    );
    records.set("field", {
      ...records.get("field")!,
      props: {
        _type: "Cascader",
        selectionMode: "multiple",
        defaultValue: value,
      },
    } as CatalogConsumerNode);
    const many = { n: 0 };
    const all = pass(many);
    // (Every row but the two that repeat k-9 — and the k-3 row is none: no item carries k-3.)
    expect(all.filter(([, sel]) => sel).length).toBe(rows - 2);
    expect(many.n).toBeLessThan(rows * 20);
    expect(reads.n).toBeLessThan(rows * 20);

    // (수리 검증 판독 HIGH — a field edit its rows do not read (its label) gives no row; a pass
    //  in which every row's key changed gives the rows once, not rows × rows.)
    const field = records.get("field")!;
    expect(
      catalogCascaderItemDependents(
        { ...field, props: { ...field.props, label: "Other" } },
        field,
        (id) => records.get(id),
        typeOf,
      ),
    ).toEqual([]);
    const step = (id: string) => records.get(id);
    const given = items.flatMap((id) => {
      const item = records.get(id)!;
      return catalogCascaderItemDependents(
        { ...item, props: { ...item.props, id: `new-${id}` } },
        item,
        step,
        typeOf,
      );
    });
    expect(given.length).toBe(rows - 1);
  });

  it("Stop 판독 — 가지 선택을 바꾸는 편집 한 번의 갱신 계획은 행 수에 선형 (id 로 찾는다)", async () => {
    const h = await place({ isOpen: true });
    const list = h.of("CascaderList")[0]!;
    const rows = 400;
    const ids = Array.from(
      { length: rows },
      (_, i) => `project:node:row-${i}` as NodeId,
    );
    h.workspace.execute(
      insertNodes({
        parent: h.workspace.itemOfRecord(list.id)!.target,
        entries: ids.map((id, i) => ({
          kind: "node",
          id,
          definitionId: CASCADER_ITEM_ORIGIN_ID,
          children: [],
          props: { label: { kind: "set", value: `Row ${i}` } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        })),
        rootIds: ids,
        newId: h.workspace.newId,
      } as never),
    );
    // (The planner's list scans: each `findIndex` callback call counted during one edit.)
    const original = Array.prototype.findIndex;
    let calls = 0;
    Array.prototype.findIndex = function (
      this: unknown[],
      predicate: (value: unknown, index: number, array: unknown[]) => unknown,
      thisArg?: unknown,
    ) {
      return original.call(
        this,
        (value: unknown, index: number, array: unknown[]) => {
          calls++;
          return predicate.call(thisArg, value, index, array);
        },
      );
    } as typeof Array.prototype.findIndex;
    try {
      h.write({ allowsBranchSelection: true });
    } finally {
      Array.prototype.findIndex = original;
    }
    expect(h.shownItems().length).toBe(rows + 3);
    expect(calls).toBeLessThan(rows * 50);
  });
});

/**
 * ADR-326 Phase 5 (G5 — breakdown §4.4 · §4.5): a `tree` · `drill` Cascader's just-opened screen on
 * the Canvas, as the Preview's first state (`cascaderOpeningView`). Start value Laptops (Electronics >
 * Computers > Laptops). Expected values from the Preview's DOM (Chrome, 260 wide, M): a `tree` row's
 * indent 8 · 20 · 32 (`--tree-item-level`), every row 32 high (a branch's as a leaf's), a leaf's
 * chevron room kept (S2 TreeView); a `drill` field stands at Computers' level — Laptops · Desktops —
 * under the trail (Category › Electronics › Computers) and 「Back」.
 */
describe("ADR-326 G5 — Canvas: a tree · drill Cascader's just-opened screen", () => {
  /** The drawn items in document order (depth first from the list box). */
  const shown = (h: Awaited<ReturnType<typeof place>>) => {
    const out: string[] = [];
    const visit = (id: string) => {
      const record = h.root.canvasInputs.get(id);
      if (!record || h.root.typeOf(record) !== "CascaderItem") return;
      if (!h.hidden(record)) out.push(String(record.props.label));
      record.children.forEach(visit);
    };
    h.of("CascaderList")[0]!.children.forEach(visit);
    return out;
  };
  /** A record's box in its page's coordinates (each rect is its layout parent's). */
  const abs = (h: Awaited<ReturnType<typeof place>>, id: string) => {
    let x = 0;
    let y = 0;
    for (
      let at = h.root.canvasInputs.get(id);
      at;
      at = h.root.canvasInputs.get(at.parentId)
    ) {
      const box = h.root.getGeometry([at.id]).get(at.id);
      if (!box) break;
      x += box.x;
      y += box.y;
    }
    const own = h.root.getGeometry([id]).get(id)!;
    return { x, y, width: own.width, height: own.height };
  };
  const itemOf = (h: Awaited<ReturnType<typeof place>>, label: string) =>
    h.of("CascaderItem").find((item) => item.props.label === label)!;
  const partOf = (
    h: Awaited<ReturnType<typeof place>>,
    item: CatalogConsumerNode,
    slot: string,
  ) =>
    item.children
      .map((id) => h.root.canvasInputs.get(id)!)
      .find((child) => child.props.slot === slot)!;

  it("tree: 시작 값의 조상이 펼쳐진 행 · 단계 들여쓰기 · 가지 행 = 잎 행 높이 · 잎 chevron 자리", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "tree", defaultValue: "laptops" });
    expect(h.hidden(h.popover())).toBe(false);
    expect(shown(h)).toEqual([
      "Electronics",
      "Computers",
      "Laptops",
      "Desktops",
      "Phones",
      "Clothing",
      "Books",
    ]);
    expect(
      ["Electronics", "Computers", "Laptops", "Phones", "Books"].map(
        (label) => itemOf(h, label).derivedProps?._cascaderRow,
      ),
    ).toEqual(["open", "open", "row", "row", "row"]);
    // (Each row's label: its level's indent — a leaf's after its chevron's room, as a branch's.)
    const label = (name: string) =>
      abs(h, partOf(h, itemOf(h, name), "label").id);
    const list = abs(h, h.of("CascaderList")[0]!.id);
    const xs = ["Electronics", "Computers", "Laptops", "Desktops", "Phones", "Clothing", "Books"].map(
      (name) => Math.round(label(name).x - list.x),
    );
    expect(xs).toEqual([56, 68, 80, 80, 68, 56, 56]);
    // (Rows one under another, 32 high each — the DOM's rows; an open branch's row is its composed
    //  row box, its items' rows under it.)
    const rowOf = (name: string) => {
      const item = itemOf(h, name);
      const part = `${item.id}::part:cascader-row`;
      const box = abs(h, item.id);
      const own = h.root.getGeometry([part]).get(part);
      return { y: box.y, height: own ? own.height : box.height };
    };
    const rows = ["Electronics", "Computers", "Laptops", "Desktops", "Phones", "Clothing", "Books"].map(
      rowOf,
    );
    expect(rows.map((row) => Math.round(row.y - list.y))).toEqual([0, 32, 64, 96, 128, 160, 192]);
    expect(rows.map((row) => Math.round(row.height))).toEqual([32, 32, 32, 32, 32, 32, 32]);
    // (A leaf's chevron keeps its room undrawn, an open branch's turns down.)
    const chevron = (name: string) => partOf(h, itemOf(h, name), "descriptor");
    expect(h.hidden(chevron("Laptops"))).toBe(false);
    expect(chevron("Laptops").derivedProps?._glyphRoomOnly).toBe(true);
    expect(chevron("Computers").derivedProps?._glyphTurned).toBe(true);
    expect(chevron("Phones").derivedProps?._glyphTurned).toBeUndefined();
    // (The picked leaf's check mark only.)
    expect(
      h.of("CascaderItem")
        .filter((item) => !h.hidden(item))
        .filter(
          (item) => partOf(h, item, "selection").derivedProps?._selectionMarkHidden === false,
        )
        .map((item) => item.props.label),
    ).toEqual(["Laptops"]);
  });

  it("tree: 시작 값을 바꾸면 펼친 가지가 따라간다 · Undo", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "tree", defaultValue: "laptops" });
    h.write({ defaultValue: "men" });
    expect(shown(h)).toEqual(["Electronics", "Clothing", "Men", "Women", "Books"]);
    h.workspace.undo();
    expect(shown(h)).toEqual([
      "Electronics",
      "Computers",
      "Laptops",
      "Desktops",
      "Phones",
      "Clothing",
      "Books",
    ]);
    // (A key no item carries picks nothing — the first level, closed.)
    h.write({ defaultValue: "nothing" });
    expect(shown(h)).toEqual(["Electronics", "Clothing", "Books"]);
  });

  it("drill: 시작 값의 단계 · 조상은 통과 (상자 없음) · 경로 조각 · 뒤로", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "drill", defaultValue: "laptops" });
    expect(h.hidden(h.popover())).toBe(false);
    expect(shown(h)).toEqual(["Electronics", "Computers", "Laptops", "Desktops"]);
    expect(
      ["Electronics", "Computers", "Laptops", "Desktops", "Clothing"].map(
        (label) => itemOf(h, label).derivedProps?._cascaderRow,
      ),
    ).toEqual(["pass", "pass", "row", "row", "none"]);
    // (A path item's own parts are not drawn.)
    expect(h.hidden(partOf(h, itemOf(h, "Computers"), "label"))).toBe(true);
    // (The level's rows stand in the list box as its own — the list's first row at its top.)
    const list = abs(h, h.of("CascaderList")[0]!.id);
    const rows = ["Laptops", "Desktops"].map((name) => abs(h, itemOf(h, name).id));
    expect(rows.map((row) => Math.round(row.y - list.y))).toEqual([0, 32]);
    expect(rows.map((row) => Math.round(row.x - list.x))).toEqual([0, 0]);
    expect(rows.every((row) => Math.round(row.width) === Math.round(list.width))).toBe(true);
    // (The trail: the path — Category › Electronics › Computers — in its positions, the last current.)
    const trail = h.of("Breadcrumbs")[0]!;
    expect(trail.derivedProps?._trailCrumbs).toBe(3);
    const crumbs = trail.children.map((id) => h.root.canvasInputs.get(id)!);
    expect(crumbs.map((crumb) => h.hidden(crumb))).toEqual([false, false, false, true]);
    const words = crumbs
      .filter((crumb) => !h.hidden(crumb))
      .map((crumb) =>
        crumb.children
          .map((id) => h.root.canvasInputs.get(id)!)
          .find((child) => child.derivedProps?._cascaderCrumb === true)?.derivedProps?.children,
      );
    expect(words).toEqual(["Category", "Electronics", "Computers"]);
    expect(crumbs[2]!.derivedProps?._isLast).toBe(true);
    // (「Back」 is drawn on a drill field.)
    const back = h.of("ActionButton").find((button) => button.props.slot === "back")!;
    expect(h.hidden(back)).toBe(false);
  });

  it("drill: 값 없음 = 맨 위 단계 · 경로는 첫 조각만", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "drill" });
    expect(shown(h)).toEqual(["Electronics", "Clothing", "Books"]);
    const trail = h.of("Breadcrumbs")[0]!;
    const crumbs = trail.children.map((id) => h.root.canvasInputs.get(id)!);
    expect(crumbs.map((crumb) => h.hidden(crumb))).toEqual([false, true, true, true]);
    expect(crumbs[0]!.derivedProps?._isLast).toBe(true);
  });

  it("drill: 경로 줄의 접힘은 열린 상자의 폭 (필드 폭) 으로 판정 — Popover 가 자리를 잡은 뒤", async () => {
    // (Each crumb 100 wide: three in the 260 box's trail (238) do not fit — S2 folds the middle one;
    //  the page's width before the box takes the field's would fit them all.)
    const h = await place({});
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: h.field().sourceId as NodeId }],
        visual: { width: { kind: "set", value: 260 } },
      } as never),
    );
    h.write({ mode: "drill", defaultValue: "laptops" });
    for (const crumb of h.of("Breadcrumb"))
      h.workspace.execute(
        setFields({
          targets: [h.workspace.itemOfRecord(crumb.id)!.target],
          visual: { width: { kind: "set", value: 100 } },
        } as never),
      );
    h.write({ isOpen: true });
    const trail = h.of("Breadcrumbs")[0]!;
    expect(h.root.breadcrumbMenuInputs.has(trail.id)).toBe(true);
  });

  it("tree: 가지 선택을 허용하면 고른 가지 행에 check (RAC Tree 의 selectedKeys) — columns 는 아님", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "tree", allowsBranchSelection: true, defaultValue: "computers" });
    const checked = () =>
      h.of("CascaderItem")
        .filter((item) => !h.hidden(item))
        .filter(
          (item) => partOf(h, item, "selection").derivedProps?._selectionMarkHidden === false,
        )
        .map((item) => item.props.label);
    expect(checked()).toEqual(["Computers"]);
    // (A `columns` field's picked branch is its submenu's own row — not its row, as the DOM's Menu.)
    h.write({ mode: "columns", defaultValue: "electronics" });
    expect(checked()).toEqual([]);
  });

  /** A chain the author added under the list box — a > b > c (document items, not the origin's). */
  const addChain = (h: Awaited<ReturnType<typeof place>>) => {
    let host = h.workspace.itemOfRecord(h.of("CascaderList")[0]!.id)!.target;
    for (const key of ["a", "b", "c"]) {
      const id = `project:node:chain-${key}` as NodeId;
      h.workspace.execute(
        insertCollectionItem({
          host,
          key,
          rootId: id,
          entries: [
            {
              kind: "node",
              id,
              definitionId: CASCADER_ITEM_ORIGIN_ID,
              children: [],
              props: {
                id: { kind: "set", value: key },
                label: { kind: "set", value: key },
              },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          newId: h.workspace.newId,
        } as never),
      );
      host = { kind: "node", id } as never;
    }
  };
  /** One item's props · look write (by its label). */
  const writeItem = (
    h: Awaited<ReturnType<typeof place>>,
    label: string,
    fields: {
      props?: Record<string, unknown>;
      visual?: Record<string, unknown>;
      layout?: Record<string, unknown>;
    },
  ) =>
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(itemOf(h, label).id)!.target],
        ...Object.fromEntries(
          Object.entries(fields).map(([axis, values]) => [
            axis,
            Object.fromEntries(
              Object.entries(values!).map(([key, value]) => [
                key,
                { kind: "set", value },
              ]),
            ),
          ]),
        ),
      } as never),
    );

  it("판독 1 #1 — drill · 가지 선택: 단계의 첫 줄 = 가지 record 의 「전체」 줄 (라벨 = 단계 이름 · chevron 없음 · 고르면 check)", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "drill", allowsBranchSelection: true, defaultValue: "laptops" });
    // (Electronics is on the path — no box; Computers is the level's own row.)
    expect(shown(h)).toEqual(["Electronics", "Computers", "Laptops", "Desktops"]);
    expect(itemOf(h, "Electronics").derivedProps?._cascaderRow).toBe("pass");
    const computers = itemOf(h, "Computers");
    expect(computers.derivedProps?._cascaderRow).toBe("open");
    expect(partOf(h, computers, "label").derivedProps?.children).toBe("All of Computers");
    expect(h.hidden(partOf(h, computers, "descriptor"))).toBe(true);
    expect(partOf(h, computers, "selection").derivedProps?._selectionMarkHidden).toBe(true);
    const list = abs(h, h.of("CascaderList")[0]!.id);
    expect(
      ["Computers", "Laptops", "Desktops"].map((name) =>
        Math.round(abs(h, itemOf(h, name).id).y - list.y),
      ),
    ).toEqual([0, 32, 64]);
    // (The branch picked: its own row checked.)
    h.write({ defaultValue: "computers" });
    expect(shown(h)).toEqual(["Electronics", "Computers", "Phones"]);
    expect(
      partOf(h, itemOf(h, "Electronics"), "label").derivedProps?.children,
    ).toBe("All of Electronics");
    // (Without branch selection the path item has no row.)
    h.write({ allowsBranchSelection: false, defaultValue: "laptops" });
    expect(itemOf(h, "Computers").derivedProps?._cascaderRow).toBe("pass");
  });

  it("판독 1 #2 — drill: 경로 항목 (pass) 에 쓴 배경은 Canvas 에 칠하지 않는다", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "drill", defaultValue: "laptops" });
    writeItem(h, "Computers", { visual: { backgroundColor: "#ff0000" } });
    expect(catalogCanvasNodeData(h.root, itemOf(h, "Computers").id).box).toBeUndefined();
    expect(catalogCanvasNodeData(h.root, itemOf(h, "Desktops").id).box).toBeDefined();
  });

  it("판독 1 #3 — tree: 열린 가지에 쓴 폭은 그 줄만 (자식 행은 목록 폭)", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "tree", defaultValue: "laptops" });
    const list = abs(h, h.of("CascaderList")[0]!.id);
    writeItem(h, "Computers", { visual: { width: 140 } });
    const part = `${itemOf(h, "Computers").id}::part:cascader-row`;
    expect(Math.round(h.root.getGeometry([part]).get(part)!.width)).toBe(140);
    expect(
      ["Laptops", "Desktops", "Phones"].map((name) =>
        Math.round(abs(h, itemOf(h, name).id).width),
      ),
    ).toEqual([list.width, list.width, list.width].map(Math.round));
  });

  it("판독 1 #4 — drill: 경로의 항목 이름을 바꾸면 경로 조각 글자가 따라간다 (문서에 넣은 항목)", async () => {
    const h = await place({ isOpen: true });
    // (A chain the author added — a > b > c — the field open at c.)
    addChain(h);
    h.write({ mode: "drill", defaultValue: "c" });
    writeItem(h, "b", { props: { label: "Bee" } });
    const words = h
      .of("Breadcrumbs")[0]!
      .children.map((id) => h.root.canvasInputs.get(id)!)
      .filter((crumb) => !h.hidden(crumb))
      .map(
        (crumb) =>
          crumb.children
            .map((id) => h.root.canvasInputs.get(id)!)
            .find((child) => child.derivedProps?._cascaderCrumb === true)?.derivedProps
            ?.children,
      );
    expect(words).toEqual(["Category", "a", "Bee"]);
  });

  it("판독 1 #5 — tree: 깊은 단계의 겹치는 key 도 Canvas 에서 비활성", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "tree", defaultValue: "laptops" });
    writeItem(h, "Desktops", { props: { id: "books" } });
    expect(itemOf(h, "Desktops").derivedProps?.isDisabled).toBe(true);
    expect(itemOf(h, "Books").derivedProps?.isDisabled).toBe(true);
    expect(itemOf(h, "Laptops").derivedProps?.isDisabled).toBeFalsy();
  });

  it("판독 1 #6 — drill: 맨 위 단계의 「뒤로」 는 Canvas 에서 비활성 칠 (DOM 은 제 단계 상태)", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "drill" });
    const back = () => h.of("ActionButton").find((b) => b.props.slot === "back")!;
    expect(back().derivedProps?._fieldDisabled).toBe(true);
    expect(back().derivedProps?.isDisabled).toBeUndefined();
    h.write({ defaultValue: "laptops" });
    expect(back().derivedProps?._fieldDisabled).toBeUndefined();
  });

  it("판독 1 #7 — tree: 열린 가지의 glyph 는 무슨 아이콘이든 90° 돈다 (rule 의 [data-expanded] 회전)", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "tree", defaultValue: "laptops" });
    const chevron = partOf(h, itemOf(h, "Computers"), "descriptor");
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(chevron.id)!.target],
        props: { iconName: { kind: "set", value: "arrow-right" } },
      } as never),
    );
    const turned = partOf(h, itemOf(h, "Computers"), "descriptor");
    expect(turned.derivedProps?._glyphTurned).toBe(true);
    expect(catalogCanvasNodeData(h.root, turned.id).transform).toBeDefined();
    expect(
      catalogCanvasNodeData(h.root, partOf(h, itemOf(h, "Phones"), "descriptor").id)
        .transform,
    ).toBeUndefined();
  });

  it("Stop 판독 — 불투명도: 열린 가지는 제 줄 (칠 · 부품) 만, 경로 항목 (pass) 은 아무것도 흐리지 않는다", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "tree", defaultValue: "laptops" });
    writeItem(h, "Computers", { visual: { opacity: 0.5, backgroundColor: "#ff0000" } });
    const opacities = (id: string) =>
      (catalogCanvasNodeData(h.root, id).effects ?? [])
        .filter((effect) => effect.type === "opacity")
        .map((effect) => (effect as { value: number }).value);
    const computers = itemOf(h, "Computers");
    // (Not a layer over its items' rows — its row node: one layer over the row's box and parts, as
    //  the DOM's row element.)
    expect(opacities(computers.id)).toEqual([]);
    const row = catalogCascaderRowData(h.root, computers)!;
    expect(
      (row.effects ?? [])
        .filter((effect) => effect.type === "opacity")
        .map((effect) => (effect as { value: number }).value),
    ).toEqual([0.5]);
    expect(row.box).toBeDefined();
    expect(Math.round(row.height)).toBe(32);
    expect(opacities(partOf(h, computers, "label").id)).toEqual([]);
    expect(opacities(itemOf(h, "Laptops").id)).toEqual([]);
    expect(opacities(partOf(h, itemOf(h, "Laptops"), "label").id)).toEqual([]);
    // (A drill path item: no row in the DOM — no dimming of the level's rows.)
    h.write({ mode: "drill" });
    expect(itemOf(h, "Computers").derivedProps?._cascaderRow).toBe("pass");
    expect(opacities(itemOf(h, "Computers").id)).toEqual([]);
  });

  it("Stop 판독 — 회전: 작성자가 쓴 transform 이 있으면 그 값 (DOM 의 인라인이 시트의 회전을 이긴다)", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "tree", defaultValue: "laptops" });
    const chevron = partOf(h, itemOf(h, "Computers"), "descriptor");
    const turned = catalogCanvasNodeData(h.root, chevron.id).transform!;
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(chevron.id)!.target],
        visual: { transform: { kind: "set", value: "scale(2)" } },
      } as never),
    );
    const own = catalogCanvasNodeData(
      h.root,
      partOf(h, itemOf(h, "Computers"), "descriptor").id,
    ).transform!;
    expect([...own]).not.toEqual([...turned]);
    expect(Math.round(own[0]! * 100) / 100).toBe(2);
    // (`none` written: no turn — the DOM's inline `transform: none` over the sheet's rotate.)
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(chevron.id)!.target],
        visual: { transform: { kind: "set", value: "none" } },
      } as never),
    );
    expect(
      catalogCanvasNodeData(h.root, partOf(h, itemOf(h, "Computers"), "descriptor").id)
        .transform,
    ).toBeUndefined();
  });

  it("수리 검증 #1 — drill: 고른 잎을 지우면 막 연 화면이 맨 위 단계로 (경로 · 뒤로 함께)", async () => {
    const h = await place({ isOpen: true });
    addChain(h);
    h.write({ mode: "drill", allowsBranchSelection: true, defaultValue: "c" });
    expect(itemOf(h, "c").derivedProps?._cascaderRow).toBe("row");
    h.workspace.execute(
      removeTargets({
        targets: [h.workspace.itemOfRecord(itemOf(h, "c").id)!.target],
      } as never),
    );
    expect(shown(h)).toEqual(["Electronics", "Clothing", "Books", "a"]);
    const crumbs = h
      .of("Breadcrumbs")[0]!
      .children.map((id) => h.root.canvasInputs.get(id)!)
      .filter((crumb) => !h.hidden(crumb));
    expect(crumbs).toHaveLength(1);
    const back = h.of("ActionButton").find((b) => b.props.slot === "back")!;
    expect(back.derivedProps?._fieldDisabled).toBe(true);
  });

  it("수리 검증 #2 · #3 — 열린 가지의 position · left 는 그 줄만, 경로 항목의 transform 은 아무것도 옮기지 않는다", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "tree", defaultValue: "laptops" });
    const before = abs(h, itemOf(h, "Laptops").id).x;
    writeItem(h, "Computers", { layout: { position: "relative", insetLeft: "30px" } });
    expect(abs(h, itemOf(h, "Laptops").id).x).toBe(before);
    const part = `${itemOf(h, "Computers").id}::part:cascader-row`;
    expect(Math.round(h.root.getGeometry([part]).get(part)!.x)).toBe(30);
    writeItem(h, "Computers", { visual: { transform: "translateX(40px)" } });
    h.write({ mode: "drill" });
    expect(itemOf(h, "Computers").derivedProps?._cascaderRow).toBe("pass");
    expect(catalogCanvasNodeData(h.root, itemOf(h, "Computers").id).transform).toBeUndefined();
  });

  it("Stop 판독 — 열린 가지의 줄 노드: 형제 추가 · 자식 잎 삭제 · 칠 편집이 증분으로 (전체 재바인딩 없이) 그대로 남는다", async () => {
    const h = await place({ isOpen: true });
    h.write({ mode: "tree", defaultValue: "laptops" });
    writeItem(h, "Computers", { visual: { backgroundColor: "#ff0000" } });
    const canvas = bindCatalogCanvas(h.root, h.root.pageRootRecords());
    const row = `${itemOf(h, "Computers").id}::part:cascader-row`;
    expect(getSkiaNode(row)?.box).toBeDefined();
    // (A sibling beside the Cascader — the body's structure.)
    h.workspace.execute(
      catalogPaletteInsertCommand(
        {
          graph: h.workspace.runtime.graph,
          records: h.workspace.root.domInputs,
          selection: () => [],
          itemOfRecord: (id) => h.workspace.itemOfRecord(id),
          pageContent: () => ({ kind: "node", id: BODY }),
          newId: h.workspace.newId,
        },
        "Button",
        {},
      )!,
    );
    expect(canvas.update()).toMatchObject({ status: "patched" });
    expect(getSkiaNode(row)?.box).toBeDefined();
    // (A child leaf of the open branch removed: its row node stays.)
    h.workspace.execute(
      removeTargets({
        targets: [h.workspace.itemOfRecord(itemOf(h, "Desktops").id)!.target],
      } as never),
    );
    expect(canvas.update()).toMatchObject({ status: "patched" });
    expect(getSkiaNode(row)?.box).toBeDefined();
    // (Its opacity edited: the row node's layer follows — not its parts' — 수리 검증 #4.)
    writeItem(h, "Computers", { visual: { opacity: 0.25 } });
    expect(canvas.update()).toMatchObject({ status: "patched" });
    expect(
      (getSkiaNode(row)?.effects ?? [])
        .filter((effect) => effect.type === "opacity")
        .map((effect) => (effect as { value: number }).value),
    ).toEqual([0.25]);
    canvas.dispose();
  });

  it("방식을 바꾸면 Canvas 의 막 연 화면이 따라간다 (columns · tree · drill)", async () => {
    const h = await place({ isOpen: true, defaultValue: "laptops" });
    expect(shown(h)).toEqual(["Electronics", "Clothing", "Books"]);
    h.write({ mode: "tree" });
    expect(shown(h)).toHaveLength(7);
    h.write({ mode: "drill" });
    expect(shown(h)).toEqual(["Electronics", "Computers", "Laptops", "Desktops"]);
    h.write({ mode: "columns" });
    expect(shown(h)).toEqual(["Electronics", "Clothing", "Books"]);
  });
});
