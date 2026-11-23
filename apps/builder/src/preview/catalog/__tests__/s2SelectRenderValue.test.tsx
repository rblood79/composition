import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogGroupSelectionStoreProp } from "../../../../../../packages/shared/src/catalog/runtime/groupSelection";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { catalogRulePaint } from "../../../../../../packages/shared/src/catalog/runtime/rulePaint";
import { HOME, openAdr296 } from "./support/adr296Harness";
import {
  catalogCodeViewPlan,
  catalogCodeViewSession,
} from "../../../builder/catalogRuntime/codeViewEdit";

/**
 * S2 체크리스트 §9.3 (2026-11-23, 사용자 결정 「값 칸 template 노드」) — S2 Picker `renderValue`: the
 * nodes an author puts in a Select's SelectValue are its value's shape; a node marked `repeat` repeats
 * per item, and the copies of the selected items show (the Canvas — the stored selection; the
 * Preview — RAC's running selection). Nothing selected: the placeholder. Measurement: jsdom, the
 * palette Select (Aardvark · Cat · Dog · Kangaroo).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const node = (
  id: string,
  definitionId: string,
  props: Record<string, unknown>,
  extra: Partial<NodeEntry> = {},
): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId,
    children: [],
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        { kind: "set", value },
      ]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...extra,
  }) as NodeEntry;

async function openShaped(
  text: string,
  selectProps: Record<string, unknown> = {},
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["Select"]);
  const select = h.ids[0] as NodeId;
  if (Object.keys(selectProps).length) h.declare(select, selectProps as never);
  const root = h.workspace.root;
  const selectValue = [...root.canvasInputs.values()].find(
    (record) => root.typeOf(record) === "SelectValue",
  )!;
  const copy = "project:node:value-copy" as NodeId;
  h.workspace.execute(
    insertNodes({
      parent: h.workspace.positionOfRecord(selectValue.id)!.target as never,
      entries: [
        node(copy, "lib:definition:text", { children: text }, { repeat: true }),
      ],
      rootIds: [copy],
      newId: h.workspace.newId,
    }),
  );
  h.flush();
  await settle();
  const records = () => [...root.canvasInputs.values()];
  const selectValueRecord = () =>
    records().find((record) => root.typeOf(record) === "SelectValue")!;
  /** The Canvas copies (record · its text · hidden). */
  const copies = () =>
    records()
      .filter((record) => record.id.includes("value-copy"))
      .map((record) => ({
        text: String(record.props.children),
        hidden: record.hidden === true,
      }));
  const trigger = () =>
    h.element(select)?.querySelector(".react-aria-SelectValue") ??
    document.querySelector(".react-aria-SelectValue");
  const store = catalogGroupSelectionStoreProp("Select")!;
  return { h, root, select, selectValueRecord, copies, trigger, store };
}

describe("S2 §9.3 Select renderValue — a static Select (rows = its items: id · label)", () => {
  it("nothing selected: the placeholder, every copy hidden; selected: that item's copy shows (Canvas · Preview)", async () => {
    const { h, select, selectValueRecord, copies, trigger, store } =
      await openShaped("Picked {label}");
    // (A copy per item — the static Select's rows.)
    expect(copies().map((copy) => copy.text)).toEqual([
      "Picked Aardvark",
      "Picked Cat",
      "Picked Dog",
      "Picked Kangaroo",
    ]);
    expect(copies().every((copy) => copy.hidden)).toBe(true);
    // (The Canvas keeps painting its placeholder text — the rule's text, not a shell of its hidden
    //  nodes.)
    const paintOf = () =>
      catalogRulePaint({
        node: selectValueRecord(),
        rule: COMPONENT_RULES_TABLE.SelectValue,
        type: "SelectValue",
        authoredVisual: {},
      }).props._hasChildren;
    expect(paintOf()).toBeUndefined();
    expect(selectValueRecord().derivedProps?._valueTemplate).toBeUndefined();
    expect(trigger()!.textContent).toContain("Choose an option");

    h.declare(select, { [store]: "cat" } as never);
    await settle();
    expect(copies().map((copy) => copy.hidden)).toEqual([
      true,
      false,
      true,
      true,
    ]);
    expect(selectValueRecord().derivedProps?._valueTemplate).toBe(true);
    expect(paintOf()).toBe(true);
    expect(trigger()!.textContent).toBe("Picked Cat");
    h.view.unmount();
  });

  it("the Preview follows the running pick: choosing Dog shows its copy", async () => {
    const { h, trigger } = await openShaped("Picked {label}");
    const button = trigger()!.closest("button")!;
    fireEvent.click(button);
    await waitFor(() =>
      expect(document.querySelector('[role="option"]')).not.toBeNull(),
    );
    const dog = [...document.querySelectorAll('[role="option"]')].find(
      (option) => option.textContent?.includes("Dog"),
    )!;
    fireEvent.click(dog);
    await settle();
    expect(trigger()!.textContent).toBe("Picked Dog");
    h.view.unmount();
  });

  it("multiple: the selected items' copies in place of S2's 「N selected」", async () => {
    const { h, select, copies, trigger, store } = await openShaped(
      "[{label}]",
      {
        selectionMode: "multiple",
      },
    );
    h.declare(select, { [store]: ["cat", "kangaroo"] } as never);
    await settle();
    expect(
      copies()
        .filter((copy) => !copy.hidden)
        .map((c) => c.text),
    ).toEqual(["[Cat]", "[Kangaroo]"]);
    expect(trigger()!.textContent).toBe("[Cat][Kangaroo]");
    h.view.unmount();
  });
});

describe("S2 §9.3 Select renderValue — a bound Select (rows = its data table)", () => {
  it("the copies read the row's fields ({#fieldId}); the selected row's shows", async () => {
    const { h, select, trigger, store } = await openShaped(
      "{#f-name} ({#f-id})",
    );
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
            mockData: [
              { id: "u1", name: "Kim" },
              { id: "u2", name: "Park" },
            ],
            runtimeData: [],
            useMockData: true,
          },
        ],
        variables: [],
        apiEndpoints: [],
      });
    });
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: select }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
      ),
    );
    h.flush();
    h.declare(select, { [store]: "u2" } as never);
    await settle();
    // (The Preview's records — the Builder harness carries no rows; the live run covers the Canvas.)
    expect(trigger()!.textContent).toBe("Park (u2)");
    h.view.unmount();
  });
});

describe("S2 §9.3 Select renderValue — code view", () => {
  it("writes the repeated node as S2 renderValue's body over selectedItems, and reads it back (strict)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("Select");
    const root = h.workspace.root;
    const selectValue = [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === "SelectValue",
    )!;
    const copy = "project:node:value-copy" as NodeId;
    h.workspace.execute(
      insertNodes({
        parent: h.workspace.positionOfRecord(selectValue.id)!.target as never,
        entries: [
          node(
            copy,
            "lib:definition:text",
            { children: "[{label}]" },
            { repeat: true },
          ),
        ],
        rootIds: [copy],
        newId: h.workspace.newId,
      }),
    );
    const code = h.code();
    expect(code).toContain('<Slot name="value">');
    expect(code).toMatch(
      /\{selectedItems\.map\(item => \(\s*<Text key=\{item\.id\}>\{`\[\$\{item\?\.label \?\? ''\}\]`\}<\/Text>/,
    );
    const data = h.dataOf();
    const session = catalogCodeViewSession(h.graph(), HOME, data)!;
    expect(
      catalogCodeViewPlan({
        reader: h.workspace.runtime.graph.commandReader,
        session,
        edited: session.baseline.code,
        changes: [],
        data,
        newId: h.workspace.newId,
        strict: true,
      }).rejected,
    ).toEqual([]);
  });
});
