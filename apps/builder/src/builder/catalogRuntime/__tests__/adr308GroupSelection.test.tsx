// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  removeTargets,
  setFields,
  setHtmlId,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { catalogStateValue } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import {
  catalogGroupKeysFields,
  catalogGroupKeysWriteCommand,
  catalogItemKeyRenameCommands,
} from "../singleSelection";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-308 G2 — a selection is its group's: the group's prop decides which items the Canvas paints
 * selected and which RAC renders `data-selected` (the oracle — installed RAC, independent of the
 * Canvas judgment), the Design panel's group field writes the group, an item key edit moves the
 * keys that name it, a deleted item leaves the group's keys.
 */
// (jsdom has no ResizeObserver — a TagGroup's row measuring needs one.)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:group" as NodeId;

/** Group (palette type) → its item type, its stored prop and the item key it is set to. */
const FAMILIES: ReadonlyArray<[string, string, string]> = [
  ["Tabs", "Tab", "defaultSelectedKey"],
  ["SegmentedControl", "SegmentedControlItem", "defaultSelectedKey"],
  ["ListBox", "ListBoxItem", "defaultSelectedKeys"],
  ["GridList", "GridListItem", "defaultSelectedKeys"],
  ["TagGroup", "Tag", "defaultSelectedKeys"],
  ["CardView", "Card", "defaultSelectedKeys"],
  ["ToggleButtonGroup", "ToggleButton", "defaultSelectedKeys"],
  ["SelectBoxGroup", "SelectBox", "defaultSelectedKeys"],
  ["RadioGroup", "Radio", "value"],
  ["CheckboxGroup", "Checkbox", "value"],
  ["Tree", "TreeItem", "defaultSelectedKeys"],
];

async function open(groupType: string, props: Record<string, unknown> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr308-group" as EntryId<"project">,
        name: "ADR-308 group",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr308-group-${Math.random()}`),
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
          id: GROUP,
          definitionId: catalogPaletteDefinitionId(library, groupType),
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
        } as NodeEntry,
      ],
      rootIds: [GROUP],
      newId: workspace.newId,
    }),
  );
  const root = () => workspace.root;
  const group = () =>
    [...root().canvasInputs.values()].find(
      (record) => record.id.split("::").pop() === GROUP,
    )!;
  const items = (itemType: string) => {
    const out: CatalogConsumerNode[] = [];
    const visit = (record: CatalogConsumerNode) => {
      for (const id of record.children) {
        const child = root().canvasInputs.get(id);
        if (!child) continue;
        if (root().typeOf(child) === itemType) out.push(child);
        visit(child);
      }
    };
    visit(group());
    return out;
  };
  const key = (record: CatalogConsumerNode, itemType: string) =>
    String(
      ["Radio", "Checkbox"].includes(itemType)
        ? record.props.value
        : record.props.id,
    );
  /** The Canvas: the items whose rest state is selected. */
  const canvasSelected = (itemType: string) =>
    items(itemType)
      .filter((record) =>
        catalogStateValue(
          record,
          "isSelected",
          (id) => root().canvasInputs.get(id),
          root().typeOf,
        ),
      )
      .map((record) => key(record, itemType));
  /** RAC: the rendered items marked selected (`data-selected` · `aria-selected` · checked). */
  const domSelected = async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () =>
      reactRoot.render(renderCatalogDom(root(), group().id)),
    );
    const marked = [
      ...host.querySelectorAll<HTMLElement>(
        '[data-selected="true"], [aria-selected="true"], [aria-checked="true"]',
      ),
    ]
      .map((element) => element.closest("[data-catalog-id]"))
      .filter((element): element is Element => !!element)
      .map((element) => element.getAttribute("data-catalog-id")!);
    await act(async () => reactRoot.unmount());
    host.remove();
    return [...new Set(marked)];
  };
  const write = (prop: string, value: unknown) => {
    const command = catalogGroupKeysWriteCommand(
      workspace,
      group().id,
      prop,
      value,
    );
    workspace.execute(command!);
  };
  return {
    workspace,
    root,
    group,
    items,
    key,
    canvasSelected,
    domSelected,
    write,
  };
}

const MULTIPLE: Readonly<Record<string, Record<string, unknown>>> = {
  ListBox: { selectionMode: "multiple" },
  GridList: { selectionMode: "multiple" },
  TagGroup: { selectionMode: "multiple" },
  CardView: { selectionMode: "multiple" },
  ToggleButtonGroup: { selectionMode: "multiple" },
  SelectBoxGroup: { selectionMode: "multiple" },
  Tree: { selectionMode: "multiple" },
};

describe("ADR-308 G2 (a) — the group's keys decide the Canvas and RAC alike", () => {
  it.each(FAMILIES)(
    "%s: the group's %s keys → the Canvas selection = RAC's",
    async (groupType, itemType, prop) => {
      const scene = await open(groupType, MULTIPLE[groupType] ?? {});
      // (The items RAC renders — a collapsed TreeItem's children are not.)
      const all = scene
        .items(itemType)
        .filter((r) => r.hidden !== true)
        .map((r) => scene.key(r, itemType));
      expect(all.length).toBeGreaterThan(1);
      const many = prop.endsWith("Keys") || groupType === "CheckboxGroup";
      const cases: unknown[] = many
        ? [[all[1]], [all[0], all[1]], [], ["no-such-key"]]
        : [all[1], all[0], "no-such-key"];
      for (const value of cases) {
        scene.write(prop, value);
        const expected = (Array.isArray(value) ? value : [value]).filter((k) =>
          all.includes(String(k)),
        );
        const canvas = scene.canvasSelected(itemType);
        // (Tabs · SegmentedControl select their first enabled item without a key RAC knows.)
        if (
          !expected.length &&
          ["Tabs", "SegmentedControl"].includes(groupType)
        )
          expect(canvas).toEqual([all[0]]);
        else expect(canvas.sort()).toEqual([...expected].map(String).sort());
        // The oracle: what RAC marks selected — the records of those items.
        const records = new Set(
          scene
            .items(itemType)
            .filter((r) => canvas.includes(scene.key(r, itemType)))
            .map((r) => r.id),
        );
        const dom = await scene.domSelected();
        for (const id of records) expect(dom).toContain(id);
      }
      // No item `isSelected` was written.
      for (const record of scene.items(itemType))
        expect(record.props.isSelected === true).toBe(false);
    },
  );
});

describe("ADR-308 R9 — an item's RAC key is its `id`, not its HTML id", () => {
  it.each([
    ["Table", "Row", "defaultSelectedKeys", { selectionMode: "multiple" }],
    ["ToggleButtonGroup", "ToggleButton", "defaultSelectedKeys", {}],
  ] as const)(
    "%s: a %s with an HTML id is still the key the selection names (Canvas = RAC)",
    async (groupType, itemType, prop, props) => {
      const scene = await open(groupType, { ...props });
      const item = scene.items(itemType)[0]!;
      scene.workspace.execute(
        setHtmlId({
          id: item.id.split("::").pop() as NodeId,
          htmlId: "my-item",
        }),
      );
      const key = scene.key(scene.items(itemType)[0]!, itemType);
      expect(key).not.toBe("my-item");
      scene.write(prop, [key]);
      expect(scene.canvasSelected(itemType)).toEqual([key]);
      const dom = await scene.domSelected();
      expect(dom).toContain(scene.items(itemType)[0]!.id);
    },
  );
});

describe("ADR-308 Decision 5 · 7 — the Design panel's group field and item keys", () => {
  it("the group field offers the items and shows the stored keys", async () => {
    const scene = await open("ListBox", { selectionMode: "multiple" });
    scene.write("defaultSelectedKeys", ["starred"]);
    const [field] = catalogGroupKeysFields(scene.root(), scene.group().id);
    expect(field).toMatchObject({
      key: "defaultSelectedKeys",
      many: true,
      value: ["starred"],
    });
    expect(field!.options.map((option) => option.value)).toEqual([
      "inbox",
      "starred",
      "archive",
    ]);
  });

  it.each(["Select", "ComboBox", "ListBox"] as const)(
    "%s: the group field's options are the items' text, not their template binding",
    async (groupType) => {
      const scene = await open(groupType, {});
      const [field] = catalogGroupKeysFields(scene.root(), scene.group().id);
      expect(field!.options.length).toBeGreaterThan(0);
      for (const option of field!.options)
        expect(option.label).not.toMatch(/[{}]/);
    },
  );

  it("an Accordion's expansion is its group field (one key while it expands one)", async () => {
    const scene = await open("Accordion");
    const fields = catalogGroupKeysFields(scene.root(), scene.group().id);
    expect(fields).toEqual([
      // (One key while it expands one — a dropdown, 사용자 결정 3.)
      expect.objectContaining({
        key: "expandedKeys",
        many: false,
        value: "section-1",
      }),
    ]);
    scene.write("expandedKeys", "section-2");
    // (The field's one key is stored as the group's key list.)
    expect(scene.group().props.expandedKeys).toEqual(["section-2"]);
    const expanded = scene
      .items("Disclosure")
      .filter((record) =>
        catalogStateValue(
          record,
          "isExpanded",
          (id) => scene.root().canvasInputs.get(id),
          scene.root().typeOf,
        ),
      )
      .map((record) => record.props.id);
    expect(expanded).toEqual(["section-2"]);
  });

  it("G2 (f) — a Tab's key edit keeps its selection and its TabPanel", async () => {
    const scene = await open("Tabs");
    scene.write("defaultSelectedKey", "tab-2");
    const second = scene.items("Tab")[1]!;
    const target = scene.workspace.positionOfRecord(second.id)!.target;
    scene.workspace.execute((reader) => {
      const own = setFields({
        targets: [target],
        props: { id: { kind: "set", value: "home" } },
      })(reader);
      const rest = catalogItemKeyRenameCommands(
        scene.workspace,
        second.id,
        "home",
      ).map((command) => command(reader));
      return {
        label: "Rename",
        ops: [...own.ops, ...rest.flatMap((plan) => plan.ops)],
      };
    });
    expect(scene.group().props.defaultSelectedKey).toBe("home");
    const panels = [...scene.root().canvasInputs.values()].filter(
      (record) => scene.root().typeOf(record) === "TabPanel",
    );
    expect(panels.map((panel) => panel.props.itemId)).toEqual([
      "tab-1",
      "home",
    ]);
    expect(scene.canvasSelected("Tab")).toEqual(["home"]);
  });

  it("G2 (f) — a deleted item leaves its group's keys", async () => {
    const scene = await open("ListBox", { selectionMode: "multiple" });
    scene.write("defaultSelectedKeys", ["inbox", "starred"]);
    const starred = scene
      .items("ListBoxItem")
      .find((record) => record.props.id === "starred")!;
    scene.workspace.execute(
      removeTargets({
        targets: [{ kind: "node", id: starred.id.split("::").pop() as NodeId }],
      }),
    );
    expect(scene.group().props.defaultSelectedKeys).toEqual(["inbox"]);
  });
});

describe("ADR-308 G2 (b) — a group edit's incremental records = a fresh bind", () => {
  it.each([
    [
      "ListBox",
      "defaultSelectedKeys",
      ["starred"],
      { selectionMode: "multiple" },
    ],
    ["Tabs", "defaultSelectedKey", "tab-2", {}],
    ["TagGroup", "defaultSelectedKeys", ["mint"], {}],
    ["ToggleButtonGroup", "defaultSelectedKeys", ["toggle-2"], {}],
    ["RadioGroup", "value", "option2", {}],
    ["Accordion", "expandedKeys", ["section-2"], {}],
    // (Parts inside an item that read its selection: a SegmentedControl item's indicator, a
    //  picker option's check — the item's own record does not change.)
    ["SegmentedControl", "defaultSelectedKey", "second", {}],
    ["Select", "value", "cat", { isOpen: true }],
    ["Select", "value", ["cat"], { isOpen: true, selectionMode: "multiple" }],
    ["ComboBox", "defaultSelectedKey", "cat", { isOpen: true }],
  ] as const)(
    "%s: %s edit · Undo · Redo",
    async (groupType, prop, value, props) => {
      const scene = await open(groupType, { ...props });
      /** Every record's selection · expansion state and presence (what the Canvas paints). */
      const state = () =>
        Object.fromEntries(
          [...scene.root().canvasInputs.values()].map((record) => [
            record.id,
            {
              hidden: record.hidden === true,
              selected: (record.derivedProps as Record<string, unknown>)
                ?._isSelected,
              markHidden: (record.derivedProps as Record<string, unknown>)
                ?._selectionMarkHidden,
              shownSelected: catalogStateValue(
                record,
                "isSelected",
                (id) => scene.root().canvasInputs.get(id),
                scene.root().typeOf,
              ),
              expanded: catalogStateValue(
                record,
                "isExpanded",
                (id) => scene.root().canvasInputs.get(id),
                scene.root().typeOf,
              ),
            },
          ]),
        );
      const fresh = () => {
        // (A new device pixel ratio builds the root again — a fresh bind of the same document.)
        const dpr = scene.root() ? 1 + Math.random() : 1;
        scene.workspace.setDevicePixelRatio(dpr);
        return state();
      };
      const check = () => {
        const incremental = state();
        expect(incremental).toEqual(fresh());
      };
      scene.write(prop, value);
      check();
      scene.workspace.undo();
      check();
      scene.workspace.redo();
      check();
    },
  );
});

describe("ADR-310 Phase 1 — an item key is one per group", () => {
  /** The Design panel's key edit: the item's own write plus the group's moved keys, one step. */
  const renameKey = (
    scene: Awaited<ReturnType<typeof open>>,
    record: CatalogConsumerNode,
    prop: "id" | "value",
    next: string,
  ) =>
    scene.workspace.execute((reader) => {
      const own = setFields({
        targets: [scene.workspace.positionOfRecord(record.id)!.target],
        props: { [prop]: { kind: "set", value: next } },
      })(reader);
      const rest = catalogItemKeyRenameCommands(
        scene.workspace,
        record.id,
        next,
      ).map((command) => command(reader));
      return {
        label: "Rename",
        ops: [...own.ops, ...rest.flatMap((plan) => plan.ops)],
      };
    });

  it("a Radio's value edit moves its RadioGroup's value", async () => {
    const scene = await open("RadioGroup");
    const first = scene.items("Radio")[0]!;
    scene.write("value", String(first.props.value));
    renameKey(scene, first, "value", "renamed");
    expect(scene.group().props.value).toBe("renamed");
    expect(scene.canvasSelected("Radio")).toEqual(["renamed"]);
  });

  it("a key another item of the group has is refused (the document unchanged)", async () => {
    const scene = await open("ListBox");
    const [first, second] = scene.items("ListBoxItem");
    const taken = String(second!.props.id);
    let code: unknown;
    try {
      renameKey(scene, first!, "id", taken);
    } catch (error) {
      code = (error as { code?: unknown }).code;
    }
    expect(code).toBe("ITEM_KEY_TAKEN");
    expect(scene.items("ListBoxItem").map((item) => item.props.id)).toEqual([
      String(first!.props.id),
      taken,
      ...scene
        .items("ListBoxItem")
        .slice(2)
        .map((item) => item.props.id),
    ]);
  });
});
