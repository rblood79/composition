// @vitest-environment jsdom
/**
 * S2 체크리스트 §9.2 (2026-11-24) — S2 · RAC MenuSection `selectionMode` · `selectedKeys`: a section
 * with its own selection mode is its items' group (ADR-308 — the group stores the keys). The Canvas
 * marks its selected item (`catalogItemSelected`), the Design panel lists its items, and the DOM's
 * RAC MenuSection selects from the same keys (`menuitemradio` · `aria-checked`).
 */
import "fake-indexeddb/auto";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect, it } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogItemKey,
  catalogItemSelected,
  catalogSelectionGroupOf,
} from "../../../../../../packages/shared/src/catalog/runtime/groupSelection";
import { catalogGroupKeysFields } from "../singleSelection";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

it("a MenuSection with its own selection mode selects its items — Canvas, panel and DOM", async () => {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:menu-section-selection",
        name: "Menu section selection",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `menu-section-selection-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const blank = { props: {}, visual: {}, sizing: {}, descendantOverrides: [] };
  const entries: NodeEntry[] = [
    {
      kind: "node",
      id: "project:node:trigger",
      definitionId: "lib:definition:type-MenuTrigger",
      children: ["project:node:button", "project:node:popover"],
      ...blank,
      props: { isOpen: { kind: "set", value: true } },
    },
    {
      kind: "node",
      id: "project:node:button",
      definitionId: "lib:definition:origin-component-button",
      children: [],
      ...blank,
      props: { label: { kind: "set", value: "Menu" } },
    },
    {
      kind: "node",
      id: "project:node:popover",
      definitionId: "lib:definition:type-Popover",
      children: ["project:node:menu"],
      ...blank,
    },
    {
      kind: "node",
      id: "project:node:menu",
      definitionId: "lib:definition:type-Menu",
      children: ["project:node:section"],
      ...blank,
    },
    {
      kind: "node",
      id: "project:node:section",
      definitionId: "lib:definition:origin-component-menu-section",
      children: [],
      ...blank,
    },
  ];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries,
      rootIds: ["project:node:trigger"],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const get = (id: string) => root.canvasInputs.get(id);
  const typeOf = (record: Parameters<typeof root.typeOf>[0]) =>
    root.typeOf(record);
  const section = get(root.recordsOfSource("project:node:section")[0]!)!;
  const items = [...root.canvasInputs.values()].filter(
    (record) => typeOf(record) === "MenuItem",
  );
  expect(items.length).toBeGreaterThan(1);
  // Without a mode of its own the Menu is the group.
  expect(typeOf(catalogSelectionGroupOf(items[0]!, get, typeOf)!)).toBe("Menu");

  const key = catalogItemKey(items[0]!, typeOf);
  workspace.execute(
    setFields({
      targets: [workspace.itemOfRecord(section.id)!.target],
      props: {
        selectionMode: { kind: "set", value: "single" },
        selectedKeys: { kind: "set", value: [key] },
      },
    }),
  );
  const after = workspace.root;
  const read = (id: string) => after.canvasInputs.get(id)!;
  const sectionNow = read(section.id);
  expect(
    catalogSelectionGroupOf(
      read(items[0]!.id),
      (id) => after.canvasInputs.get(id),
      (r) => after.typeOf(r),
    )?.id,
  ).toBe(section.id);
  expect(
    items.map((item) =>
      catalogItemSelected(
        read(item.id),
        (id) => after.canvasInputs.get(id),
        (r) => after.typeOf(r),
      ),
    ),
  ).toEqual(items.map((_, index) => index === 0));
  const field = catalogGroupKeysFields(after, sectionNow.id).find(
    (candidate) => candidate.key === "defaultSelectedKeys",
  );
  expect(field?.options.map((option) => option.value)).toEqual(
    items.map((item) => catalogItemKey(item, typeOf)),
  );

  const { unmount } = render(
    renderCatalogDom(after, after.recordsOfSource("project:node:trigger")[0]!),
  );
  try {
    const checked = [
      ...document.querySelectorAll('[role="menuitemradio"]'),
    ].map((element) => element.getAttribute("aria-checked"));
    expect(checked).toEqual(items.map((_, index) => String(index === 0)));
  } finally {
    unmount();
    workspace.dispose();
  }
});
