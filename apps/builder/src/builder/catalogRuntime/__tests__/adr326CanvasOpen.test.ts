import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
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

  it("tree · drill 은 Phase 5 까지 Canvas 에서 닫힌 채 (Preview 는 연다)", async () => {
    const h = await place({ isOpen: true });
    for (const mode of ["tree", "drill"]) {
      h.write({ mode });
      expect(h.hidden(h.popover())).toBe(true);
    }
    h.write({ mode: "columns" });
    expect(h.hidden(h.popover())).toBe(false);
  });
});
