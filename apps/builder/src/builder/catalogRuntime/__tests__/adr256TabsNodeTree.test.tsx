// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SelectionIndicator,
  Tab,
  TabList,
  Tabs,
} from "react-aria-components/Tabs";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 5e (G2) — Tabs is the reference's (react-aria.adobe.com Tabs, G0 example 8): each
 * `Tab > (children + SelectionIndicator)` — the selected Tab's bar is a SelectionIndicator node of
 * the Tab origin (RAC shows it on the selected Tab and slides it), no longer a Tab primitive.
 */
const BODY = "project:node:home-body" as NodeId;
const TABS = "project:node:tabs" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(props: Record<string, string> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-tabs" as EntryId<"project">,
        name: "Tabs",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-tabs-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: TABS,
          definitionId: "lib:definition:origin-component-tabs",
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [TABS],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const tabs = () =>
    [...root.canvasInputs.values()].find((r) => r.sourceId === TABS)!;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(
        root,
        [...root.domInputs.values()].find((r) => r.sourceId === TABS)!.id,
      ),
    );
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const edit = (values: Record<string, string>) =>
    workspace.root.execute(
      setFields({
        targets: [workspace.positionOfRecord(tabs().id)!.target],
        props: Object.fromEntries(
          Object.entries(values).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  return { workspace, root, html, of, edit };
}

/** Decision 11 structure of the TabList: tag · role · aria (links as positions) · text. */
function tabListStructure(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  const list = host.querySelector("[role=tablist]")!;
  const all = [...list.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    return index < 0 ? "outside" : `#${index}`;
  };
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter((attribute) => /^(role|slot|aria-.*)$/.test(attribute.name))
      .map((attribute) =>
        /^aria-(labelledby|describedby|controls)$/.test(attribute.name)
          ? `${attribute.name}=${attribute.value.split(" ").map(position).join(",")}`
          : `${attribute.name}=${attribute.value}`,
      )
      .sort();
    const content = [...element.childNodes].map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return walk(list);
}

describe("ADR-256 Phase 5e — a Tab's selection bar is its SelectionIndicator node", () => {
  it("the TabList is the reference's: Tab > (text + SelectionIndicator on the selected one)", async () => {
    const { html } = await open();
    const reference = renderToStaticMarkup(
      createElement(
        Tabs,
        null,
        createElement(
          TabList,
          // (The example's list name is authored text; the origin's list has none — 5e-2.)
          null,
          ...["Tab 1", "Tab 2"].map((text) =>
            createElement(
              Tab,
              { key: text, id: text },
              // (Our label is a Text node — a span around the reference's text.)
              createElement("span", null, text),
              createElement(SelectionIndicator),
            ),
          ),
        ),
      ),
    );
    expect(tabListStructure(html())).toBe(tabListStructure(reference));
  });

  it("on the Canvas only the selected Tab's indicator is there, and it follows the selection", async () => {
    const { of, edit } = await open();
    const shown = () =>
      of("SelectionIndicator").map((indicator) => indicator.hidden !== true);
    expect(shown()).toEqual([true, false]);
    const second = of("Tab")[1]!;
    edit({ defaultSelectedKey: second.id });
    expect(shown()).toEqual([false, true]);
  });

  it("the bar is the sheet's: 3px along the Tab's bottom (the right edge in a vertical list)", async () => {
    const { root, of, edit } = await open();
    const bar = () => {
      const indicator = of("SelectionIndicator").find(
        (record) => record.hidden !== true,
      )!;
      const tab = root.canvasInputs.get(indicator.parentId)!;
      const boxes = root.getGeometry([indicator.id, tab.id]);
      return { bar: boxes.get(indicator.id)!, tab: boxes.get(tab.id)! };
    };
    const horizontal = bar();
    expect(horizontal.bar).toMatchObject({
      x: 0,
      y: horizontal.tab.height - 3,
      width: horizontal.tab.width,
      height: 3,
    });
    edit({ orientation: "vertical" });
    const vertical = bar();
    expect(vertical.bar).toMatchObject({
      x: vertical.tab.width - 3,
      y: 0,
      width: 3,
      height: vertical.tab.height,
    });
  });

  it("the Tab itself paints no bar (no primitive) — the node is the only one", async () => {
    const { root } = await open();
    const tab = [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === "Tab",
    )!;
    const definition = root.runtime.graph.getDefinition(
      tab.definitionId as never,
    ) as { bindingId?: string } | undefined;
    expect(definition).toBeDefined();
    const { getPrimitiveBinding } =
      await import("../../../../../../packages/shared/src/catalog/bindings");
    expect(getPrimitiveBinding("Tab")?.skiaPrimitive).toBeUndefined();
  });
});
