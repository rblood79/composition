import { act, fireEvent, render } from "@testing-library/react";
import { User } from "@react-aria/test-utils";
import { useState } from "react";
import {
  Button,
  Cell,
  Column,
  GridList,
  GridListItem,
  Row,
  Table,
  TableBody,
  TableHeader,
  Tree,
  TreeItem,
  TreeItemContent,
  useDragAndDrop,
  type Key,
  type Selection,
} from "react-aria-components";
import { useListData } from "react-stately";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogListDataEventDefaults } from "../../../builder/catalogRuntime/interactions";
import { openAdr280Preview } from "./support/adr280Harness";
import { DROP_ITEM, DROP_ROW, dropRects, racDrag } from "./support/racDrag";

/**
 * RAC 동작 차이 테스트 (2026-10-28, `.agent/runs/2026-10-28-adobe-repository-analysis` 권장 3):
 * Tree · GridList · Table 의 focus 이동 · selection · drag/drop · controlled 전환을 **같은 RAC tester**
 * (`@react-aria/test-utils` 1.0.0-rc.1) 로 두 팔에서 실행하고 관찰 결과를 비교한다 —
 *   upstream 팔 = 설치된 RAC 1.22.1 을 그대로 쓴 최소 조립 (D1 권위),
 *   composition 팔 = Builder workspace → channel → Preview (catalog runtime 이 그린 같은 RAC).
 * 두 팔이 다르면 composition 쪽 결함 (버그 수정 절차, ADR 불필요). tester 의 `checkboxSelection: false`
 * 로 두 팔 모두 행 자체를 누른다 (Preview 의 checkbox 열 유무와 무관하게 같은 입력).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const ROWS = [
  { id: "u1", name: "Kim" },
  { id: "u2", name: "Park" },
  { id: "u3", name: "Lee" },
];
const COLLECTION = "data:collection:users";
const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
const user = new User({
  interactionType: "mouse",
  advanceTimer: (ms) => new Promise((r) => setTimeout(r, ms)),
});
type TesterName = "GridList" | "Tree" | "Table";
type Tester = ReturnType<typeof user.createTester<TesterName>>;

/** What a tester sees — the oracle both arms are compared on. */
function observe(tester: Tester) {
  const rows = tester.getRows();
  const index = (row: Element | null) =>
    row ? rows.indexOf(row as HTMLElement) : -1;
  return {
    rows: rows.length,
    selected: rows
      .map((row, i) => (row.getAttribute("aria-selected") === "true" ? i : -1))
      .filter((i) => i >= 0),
    focused: index(document.activeElement?.closest('[role="row"]') ?? null),
    expanded: rows
      .map((row, i) => (row.getAttribute("aria-expanded") === "true" ? i : -1))
      .filter((i) => i >= 0),
  };
}

const collectionRoot = (element: HTMLElement) =>
  element.matches("[role=grid],[role=treegrid]")
    ? element
    : element.querySelector<HTMLElement>("[role=grid],[role=treegrid]")!;

// ───────────────────────────── composition arm ─────────────────────────────

async function composition(type: TesterName, declare: Record<string, unknown>) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([type, "Button"]);
  const [list, button] = h.ids as [NodeId, NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "users",
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
          ],
          mockData: ROWS,
          runtimeData: [],
          useMockData: true,
        },
      ],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: list }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  h.flush();
  h.declare(list, declare as Record<string, never>);
  await settle();
  const tester = user.createTester(type, {
    root: collectionRoot(h.element(list)!),
  });
  const press = () =>
    act(() => {
      fireEvent.click(h.element(button)!);
    });
  return { ...h, list, button, tester, press };
}

// ───────────────────────────── upstream arm ─────────────────────────────

function Upstream({
  type,
  selectionMode,
  controlled,
  onSelect,
  reorder,
}: {
  type: TesterName;
  selectionMode: "single" | "multiple";
  /** The Button's press sets this selection (the controlled arm). */
  controlled?: Key[];
  onSelect?: (keys: Selection) => void;
  reorder?: boolean;
}) {
  const list = useListData({ initialItems: ROWS });
  const [selected, setSelected] = useState<Selection>(new Set());
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    onReorder: (e) => {
      if (e.target.dropPosition === "before")
        list.moveBefore(e.target.key, e.keys);
      else if (e.target.dropPosition === "after")
        list.moveAfter(e.target.key, e.keys);
    },
  });
  const shared = {
    "aria-label": "Users",
    selectionMode,
    ...(controlled
      ? {
          selectedKeys: selected,
          onSelectionChange: (keys: Selection) => {
            setSelected(keys);
            onSelect?.(keys);
          },
        }
      : {}),
    ...(reorder ? { dragAndDropHooks } : {}),
  };
  return (
    <>
      <Button onPress={() => setSelected(new Set(controlled ?? []))}>
        Set
      </Button>
      {type === "GridList" && (
        <GridList {...shared} items={list.items}>
          {(item) => (
            <GridListItem textValue={item.name}>{item.name}</GridListItem>
          )}
        </GridList>
      )}
      {type === "Tree" && (
        <Tree {...shared} items={list.items}>
          {(item) => (
            <TreeItem textValue={item.name}>
              <TreeItemContent>{item.name}</TreeItemContent>
            </TreeItem>
          )}
        </Tree>
      )}
      {type === "Table" && (
        <Table {...shared}>
          <TableHeader>
            <Column isRowHeader>Name</Column>
            <Column>Id</Column>
          </TableHeader>
          <TableBody items={list.items}>
            {(item) => (
              <Row>
                <Cell>{item.name}</Cell>
                <Cell>{item.id}</Cell>
              </Row>
            )}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function upstream(props: Parameters<typeof Upstream>[0]) {
  const view = render(<Upstream {...props} />);
  const tester = user.createTester(props.type, {
    root: view.container.querySelector<HTMLElement>(
      "[role=grid],[role=treegrid]",
    )!,
  });
  const press = () =>
    act(() => {
      fireEvent.click(view.getByRole("button", { name: "Set" }));
    });
  return { view, tester, press };
}

const TYPES: TesterName[] = ["GridList", "Tree", "Table"];
const CHECKBOX = { selectionStyle: "checkbox" } as const;

describe("RAC 동작 차이 — selection (mouse)", () => {
  it.each(TYPES)(
    "%s multiple: rows 0 · 2 toggled → both selected, focus on the last",
    async (type) => {
      const up = upstream({ type, selectionMode: "multiple" });
      for (const row of [0, 2])
        await up.tester.toggleRowSelection({ row, checkboxSelection: false });
      const expected = observe(up.tester);
      up.view.unmount();

      const c = await composition(type, {
        selectionMode: "multiple",
        ...CHECKBOX,
      });
      for (const row of [0, 2])
        await c.tester.toggleRowSelection({ row, checkboxSelection: false });
      expect(observe(c.tester)).toEqual(expected);
      expect(expected.selected).toEqual([0, 2]);
      c.view.unmount();
    },
  );

  it.each(TYPES)("%s single: row 0 then row 2 → only row 2", async (type) => {
    const up = upstream({ type, selectionMode: "single" });
    for (const row of [0, 2])
      await up.tester.toggleRowSelection({ row, checkboxSelection: false });
    const expected = observe(up.tester);
    up.view.unmount();

    const c = await composition(type, { selectionMode: "single", ...CHECKBOX });
    for (const row of [0, 2])
      await c.tester.toggleRowSelection({ row, checkboxSelection: false });
    expect(observe(c.tester)).toEqual(expected);
    expect(expected.selected).toEqual([2]);
    c.view.unmount();
  });
});

describe("RAC 동작 차이 — focus (keyboard)", () => {
  it.each(TYPES)(
    "%s: arrow keys to row 1, Space selects it, focus stays on it",
    async (type) => {
      const up = upstream({ type, selectionMode: "multiple" });
      await up.tester.toggleRowSelection({
        row: 1,
        interactionType: "keyboard",
        checkboxSelection: false,
      });
      const expected = observe(up.tester);
      up.view.unmount();

      const c = await composition(type, {
        selectionMode: "multiple",
        ...CHECKBOX,
      });
      await c.tester.toggleRowSelection({
        row: 1,
        interactionType: "keyboard",
        checkboxSelection: false,
      });
      expect(observe(c.tester)).toEqual(expected);
      expect(expected).toMatchObject({ selected: [1], focused: 1 });
      c.view.unmount();
    },
  );
});

describe("RAC 동작 차이 — controlled 전환 (a rule's write, then the user's toggle)", () => {
  it.each(TYPES)(
    "%s multiple: the Button selects row 2; the user's toggle of row 0 keeps both",
    async (type) => {
      const up = upstream({
        type,
        selectionMode: "multiple",
        controlled: ["u3"],
      });
      up.press();
      await up.tester.toggleRowSelection({ row: 0, checkboxSelection: false });
      const expected = observe(up.tester);
      up.view.unmount();

      const c = await composition(type, {
        selectionMode: "multiple",
        ...CHECKBOX,
      });
      c.rule(c.button, "onPress", {
        opcode: "capability",
        target: { nodeId: c.list },
        capabilityId: "selectItem",
        value: "u3",
      });
      c.press();
      await settle();
      await c.tester.toggleRowSelection({ row: 0, checkboxSelection: false });
      expect(observe(c.tester)).toEqual(expected);
      expect(expected.selected).toEqual([0, 2]);
      c.view.unmount();
    },
  );

  it.each(TYPES)(
    "%s single: the Button selects row 2; the user's toggle of row 0 replaces it",
    async (type) => {
      const up = upstream({
        type,
        selectionMode: "single",
        controlled: ["u3"],
      });
      up.press();
      await up.tester.toggleRowSelection({ row: 0, checkboxSelection: false });
      const expected = observe(up.tester);
      up.view.unmount();

      const c = await composition(type, {
        selectionMode: "single",
        ...CHECKBOX,
      });
      c.rule(c.button, "onPress", {
        opcode: "capability",
        target: { nodeId: c.list },
        capabilityId: "selectItem",
        value: "u3",
      });
      c.press();
      await settle();
      await c.tester.toggleRowSelection({ row: 0, checkboxSelection: false });
      expect(observe(c.tester)).toEqual(expected);
      expect(expected.selected).toEqual([0]);
      c.view.unmount();
    },
  );
});

describe("RAC 동작 차이 — drag/drop reorder (RAC's own drag events)", () => {
  const names = (root: HTMLElement) =>
    [...root.querySelectorAll(DROP_ITEM)].map(
      (row) => /Kim|Park|Lee/.exec(row.textContent ?? "")?.[0],
    );
  const reorder = async (root: HTMLElement) => {
    dropRects();
    root.setAttribute("data-drop-left", "300");
    const rows = [...root.querySelectorAll(DROP_ITEM)];
    // (The third row dragged onto the top quarter of the first — `before`.)
    await racDrag(rows[2]!, rows[0]!, 100, DROP_ROW / 4);
    await settle();
  };

  it.each(TYPES)(
    "%s: the third row dropped before the first → Lee · Kim · Park",
    async (type) => {
      const up = upstream({ type, selectionMode: "multiple", reorder: true });
      const upRoot = up.tester[
        `get${type === "GridList" ? "Gridlist" : type}` as "getRows"
      ]() as unknown as HTMLElement;
      await reorder(upRoot);
      const expected = names(upRoot);
      up.view.unmount();
      vi.restoreAllMocks();

      const c = await composition(type, {
        selectionMode: "multiple",
        ...CHECKBOX,
      });
      c.rule(
        c.list,
        "onReorder",
        catalogListDataEventDefaults(
          { opcode: "moveBefore", collectionId: COLLECTION } as never,
          ["keys", "target", "dropOperation"],
        ) as never,
      );
      await act(async () => {
        await import("../../../../../../packages/shared/src/catalog/runtime/catalogDragAndDrop.components");
      });
      await settle();
      const root = collectionRoot(c.element(c.list)!);
      await reorder(root);
      expect(names(root)).toEqual(expected);
      expect(expected).toEqual(["Lee", "Kim", "Park"]);
      c.view.unmount();
    },
  );
});

describe("RAC 동작 차이 — Tree expansion (controlled expand, then the user's toggle)", () => {
  function UpstreamTree({ expand }: { expand: Key[] }) {
    const [expanded, setExpanded] = useState<Set<Key>>(new Set());
    return (
      <>
        <Button onPress={() => setExpanded(new Set(expand))}>Set</Button>
        <Tree
          aria-label="Nodes"
          // (The palette Tree's defaults — `selectionMode: single` · `selectionStyle: highlight`.)
          selectionMode="single"
          selectionBehavior="replace"
          expandedKeys={expanded}
          onExpandedChange={setExpanded}
        >
          <TreeItem id="item-1" textValue="Node 1">
            <TreeItemContent>
              <Button slot="chevron">▸</Button>Node 1
            </TreeItemContent>
            <TreeItem id="item-1-1" textValue="Node 1.1">
              <TreeItemContent>Node 1.1</TreeItemContent>
            </TreeItem>
          </TreeItem>
          <TreeItem id="item-2" textValue="Node 2">
            <TreeItemContent>Node 2</TreeItemContent>
          </TreeItem>
        </Tree>
      </>
    );
  }

  it("the Button expands the first row (its child appears); the user's toggle collapses it", async () => {
    const view = render(<UpstreamTree expand={["item-1"]} />);
    const tester = user.createTester("Tree", {
      root: view.container.querySelector<HTMLElement>("[role=treegrid]")!,
    });
    const before = observe(tester);
    act(() => {
      fireEvent.click(view.getByRole("button", { name: "Set" }));
    });
    const afterExpand = observe(tester);
    await tester.toggleRowExpansion({ row: 0 });
    const afterToggle = observe(tester);
    view.unmount();
    expect([before.rows, afterExpand.rows, afterToggle.rows]).toEqual([
      2, 3, 2,
    ]);

    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["Tree", "Button"]);
    const [tree, button] = h.ids as [NodeId, NodeId];
    h.declare(tree, { selectionMode: "single", selectionStyle: "highlight" });
    const cTester = user.createTester("Tree", {
      root: collectionRoot(h.element(tree)!),
    });
    const firstKey = cTester.getRows()[0]!.getAttribute("data-key")!;
    h.rule(button, "onPress", {
      opcode: "capability",
      target: { nodeId: tree },
      capabilityId: "expand",
      value: firstKey,
    });
    const cBefore = observe(cTester);
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    await settle();
    const cAfterExpand = observe(cTester);
    await cTester.toggleRowExpansion({ row: 0 });
    await settle();
    const cAfterToggle = observe(cTester);
    expect([cBefore, cAfterExpand, cAfterToggle]).toEqual([
      before,
      afterExpand,
      afterToggle,
    ]);
    h.view.unmount();
  });
});
