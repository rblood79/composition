// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  composeCommands,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DefinitionId,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogStateValue } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { renderCatalogDom } from "../domBinding";
import { catalogPropertiesPatchCommand } from "../editContract";
import { newCatalogProjectDocument } from "../project";
import {
  catalogRadioGroupValueOptions,
  catalogSingleSelectionCommand,
  catalogTabsSelectedTab,
} from "../singleSelection";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-13 (사용자 「radioGroup, Tabs 등은 하나의 값만 선택되어야한다. 현재 radioGroup 프러퍼티에
 * value옵션이 있지만 동작하지않는다」): a RadioGroup's Value offers its Radios' values and selects
 * that Radio (Canvas = Preview); an item set Selected in a one-value collection or group takes the
 * selection from the others (Tabs, RadioGroup, a `single` ListBox) — a multiple one keeps each.
 */
const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:owner" as NodeId;

async function open(definition: string, ownerProps: Record<string, unknown> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:single-selection" as EntryId<"project">,
        name: "Single selection",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `single-selection-${Math.random()}`),
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
          id: OWNER,
          definitionId: `lib:definition:origin-component-${definition}` as DefinitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(ownerProps).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  // The Properties panel's write: the patch, then what keeps one value — one step.
  const edit = (recordId: string, patch: Record<string, unknown>) => {
    const target = workspace.positionOfRecord(recordId)!.target;
    const command = catalogPropertiesPatchCommand(
      workspace.runtime.graph,
      [target],
      patch,
      (key) => workspace.readModel.propSource(target, key).value,
      new Set(),
    )!;
    const keep = catalogSingleSelectionCommand(workspace, recordId, patch);
    workspace.execute(() =>
      composeCommands(workspace.runtime.graph, "Edit properties", [
        command,
        ...keep,
      ]),
    );
  };
  const selected = (type: string) =>
    of(type).map((record) =>
      catalogStateValue(
        record,
        "isSelected",
        (id) => root.canvasInputs.get(id),
        (r) => root.typeOf(r),
      ),
    );
  // A Tabs' Selected Tab: the panel writes only what keeps one value (no key on the Tabs).
  const chooseTab = (tabsId: string, key: string) =>
    workspace.execute(() =>
      composeCommands(
        workspace.runtime.graph,
        "Edit properties",
        catalogSingleSelectionCommand(workspace, tabsId, {
          defaultSelectedKey: key,
        }),
      ),
    );
  return { workspace, root, of, edit, selected, chooseTab };
}

async function dom(root: Awaited<ReturnType<typeof open>>["root"], type: string) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const host = document.body.appendChild(document.createElement("div"));
  const reactRoot = createRoot(host);
  const record = [...root.domInputs.values()].find((r) => root.typeOf(r) === type)!;
  await act(async () => reactRoot.render(renderCatalogDom(root, record.id)));
  return {
    host,
    close: async () => {
      await act(async () => reactRoot.unmount());
      host.remove();
    },
  };
}

describe("RadioGroup Value — its Radios' values, one Radio selected", () => {
  it("offers the Radios' values", async () => {
    const { root, of } = await open("radiogroup");
    expect(catalogRadioGroupValueOptions(root, of("RadioGroup")[0]!.id)).toEqual([
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
    ]);
  });

  it("a chosen Value selects its Radio (Canvas = Preview), and a Radio set Selected writes the Value", async () => {
    const { root, of, edit, selected } = await open("radiogroup");
    edit(of("RadioGroup")[0]!.id, { value: "option2" });
    expect(selected("Radio")).toEqual([false, true]);
    expect(of("Radio").map((r) => r.props.isSelected === true)).toEqual([false, true]);
    let view = await dom(root, "RadioGroup");
    expect(
      [...view.host.querySelectorAll("input[type=radio]")].map((input) => (input as HTMLInputElement).checked),
    ).toEqual([false, true]);
    await view.close();
    edit(of("Radio")[0]!.id, { isSelected: true });
    expect(selected("Radio")).toEqual([true, false]);
    expect(of("Radio").map((r) => r.props.isSelected === true)).toEqual([true, false]);
    expect(of("RadioGroup")[0]!.props.value).toBe("option1");
    view = await dom(root, "RadioGroup");
    expect(
      [...view.host.querySelectorAll("input[type=radio]")].map((input) => (input as HTMLInputElement).checked),
    ).toEqual([true, false]);
    await view.close();
    // Unselecting the selected Radio clears the Value.
    edit(of("Radio")[0]!.id, { isSelected: false });
    expect(selected("Radio")).toEqual([false, false]);
    expect(of("RadioGroup")[0]!.props.value).toBe("");
  });
});

describe("one value — a Selected item takes the selection from the others", () => {
  it("Tabs: one Tab", async () => {
    const { of, edit, selected } = await open("tabs");
    edit(of("Tab")[0]!.id, { isSelected: true });
    edit(of("Tab")[1]!.id, { isSelected: true });
    expect(of("Tab").map((r) => r.props.isSelected === true)).toEqual([false, true]);
    expect(selected("Tab")).toEqual([false, true]);
  });

  it("Tabs: the Selected Tab field lists the Tabs, shows the selected one and selects the chosen", async () => {
    const { root, of, edit, selected, chooseTab } = await open("tabs");
    const tabsId = of("Tabs")[0]!.id;
    const field = catalogTabsSelectedTab(root, tabsId)!;
    expect(field.options.map((option) => option.label)).toEqual([
      "Tab 1",
      "Tab 2",
    ]);
    expect(field.value).toBe(field.options[0]!.value);
    chooseTab(tabsId, field.options[1]!.value);
    expect(selected("Tab")).toEqual([false, true]);
    expect(catalogTabsSelectedTab(root, tabsId)!.value).toBe(
      field.options[1]!.value,
    );
    // (No identity in the document: the Tabs keep no key.)
    expect(of("Tabs")[0]!.props.defaultSelectedKey ?? "").toBe("");
    edit(of("Tab")[0]!.id, { isSelected: true });
    expect(catalogTabsSelectedTab(root, tabsId)!.value).toBe(
      field.options[0]!.value,
    );
    const view = await dom(root, "Tabs");
    expect(
      [...view.host.querySelectorAll("[role=tab]")].map(
        (tab) => tab.getAttribute("aria-selected") === "true",
      ),
    ).toEqual([true, false]);
    await view.close();
  });

  it("ListBox single: one item — multiple keeps each", async () => {
    const single = await open("listbox", { selectionMode: "single" });
    single.edit(single.of("ListBoxItem")[0]!.id, { isSelected: true });
    single.edit(single.of("ListBoxItem")[2]!.id, { isSelected: true });
    expect(single.selected("ListBoxItem")).toEqual([false, false, true]);
    const multiple = await open("listbox", { selectionMode: "multiple" });
    multiple.edit(multiple.of("ListBoxItem")[0]!.id, { isSelected: true });
    multiple.edit(multiple.of("ListBoxItem")[2]!.id, { isSelected: true });
    expect(multiple.selected("ListBoxItem")).toEqual([true, false, true]);
  });
});
