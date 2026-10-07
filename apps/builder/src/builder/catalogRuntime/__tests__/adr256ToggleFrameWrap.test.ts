// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  moveNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 3 review (round 8): a layout frame the author puts inside a toggle keeps the toggle
 * whole — RAC passes its contexts and the button's render state through any element, and the
 * toggle's selectors reach through it (`.react-aria-Checkbox .react-aria-CheckboxButton`,
 * `.react-aria-CheckboxButton … .checkbox`). (m1) a frame around the indicator or around the button:
 * the DOM draws the indicator, the Canvas sizes and paints it from the toggle; (m2) a frame around
 * the button's text: the text stays the button's own `span` (not RAC's `Label`, which would take the
 * group's label id); (m3) a frame around a group item: the group's initial value still counts it.
 */
const BODY = "project:node:home-body" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  type: string,
  children: string[],
  props: Record<string, unknown> = {},
) =>
  ({
    kind: "node",
    id: id(name),
    definitionId: `lib:definition:type-${type}`,
    children: children.map(id),
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, set(value)]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as unknown as NodeEntry;

async function open(entries: NodeEntry[], rootId: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-toggle-frame" as EntryId<"project">,
        name: "Toggle frame",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-toggle-frame-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  // (`root.execute`: no automatic HTML ids — RAC's own label ids stay the links in the markup.)
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: [id(rootId)],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = (name: string) =>
    [...root.canvasInputs.values()].find((r) => r.sourceId === id(name))!;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(
        root,
        [...root.domInputs.values()].find((r) => r.sourceId === id(rootId))!.id,
      ),
    );
  /** Wrap `names` (siblings, in order) in a new frame at the first one's place. */
  const wrap = (
    frame: string,
    parent: string,
    index: number,
    names: string[],
  ) => {
    workspace.root.execute(
      insertNodes({
        parent: { kind: "node", id: id(parent) },
        index,
        entries: [node(frame, "frame", [])],
        rootIds: [id(frame)],
        newId: workspace.newId,
      }),
    );
    workspace.root.execute(
      moveNodes({
        ids: names.map(id),
        parent: { kind: "node", id: id(frame) },
        newId: workspace.newId,
      }),
    );
  };
  return { workspace, root, record, html, wrap };
}

const TOGGLES = [
  ["Checkbox", "CheckboxButton", "CheckboxIndicator", /class="checkbox"/g],
  ["Switch", "SwitchButton", "SwitchIndicator", /class="indicator"/g],
  ["Radio", "RadioButton", "RadioIndicator", /class="indicator"/g],
] as const;

/** A toggle the author built from the parts (a Radio sits in a RadioGroup — its root is the group). */
const toggle = (owner: string, button: string, indicator: string) => [
  ...(owner === "Radio" ? [node("host", "RadioGroup", ["box"])] : []),
  node("box", owner, ["box-button"], owner === "Radio" ? { value: "a" } : {}),
  node("box-button", button, ["box-indicator", "box-text"]),
  node("box-indicator", indicator, []),
  node("box-text", "Label", [], { children: "Own" }),
];
const rootOf = (owner: string) => (owner === "Radio" ? "host" : "box");

describe("ADR-256 Phase 3 review m1 — a frame around a toggle's indicator or button", () => {
  it.each(TOGGLES)(
    "%s: a frame around the indicator — the DOM draws it, the Canvas sizes and paints it",
    async (owner, button, indicator, element) => {
      const { workspace, root, record, html, wrap } = await open(
        toggle(owner, button, indicator),
        rootOf(owner),
      );
      const box = () => {
        const g = root.getGeometry([record("box-indicator").id]);
        const r = g.get(record("box-indicator").id)!;
        return [r.width, r.height];
      };
      const paint = () => {
        const canvas = bindCatalogCanvas(root, root.pageRootRecords());
        const data = getSkiaNode(record("box-indicator").id)!;
        const out = JSON.stringify({ box: data.box, children: data.children });
        canvas.dispose();
        return out;
      };
      const before = {
        count: html().match(element)?.length,
        size: box(),
        paint: paint(),
      };
      expect(before.count).toBe(1);
      wrap("wrap", "box-button", 0, ["box-indicator"]);
      expect(html().match(element)?.length).toBe(1);
      expect(box()).toEqual(before.size);
      expect(paint()).toBe(before.paint);
      workspace.dispose();
    },
  );

  it.each(TOGGLES)(
    "%s: a frame around the button — the Canvas indicator still paints from the toggle",
    async (owner, button, indicator, element) => {
      const { workspace, root, record, html, wrap } = await open(
        toggle(owner, button, indicator),
        rootOf(owner),
      );
      const box = () => {
        const r = root
          .getGeometry([record("box-indicator").id])
          .get(record("box-indicator").id)!;
        return [r.width, r.height];
      };
      const before = box();
      const paint = () => {
        const canvas = bindCatalogCanvas(root, root.pageRootRecords());
        const data = getSkiaNode(record("box-indicator").id)!;
        const out = JSON.stringify({ box: data.box, children: data.children });
        canvas.dispose();
        return out;
      };
      const painted = paint();
      wrap("wrap", "box", 0, ["box-button"]);
      expect(html().match(element)?.length).toBe(1);
      expect(box()).toEqual(before);
      expect(paint()).toBe(painted);
      workspace.dispose();
    },
  );
});

describe("ADR-256 Phase 3 review m2 — a frame around a toggle's text", () => {
  it("the text stays the button's span: the group label names the group only", async () => {
    const { html, wrap } = await open(
      [
        node("group", "CheckboxGroup", ["group-items", "group-label"]),
        node("group-label", "Label", [], { children: "Toppings" }),
        node("group-items", "CheckboxItems", ["box"]),
        ...toggle("Checkbox", "CheckboxButton", "CheckboxIndicator"),
      ],
      "group",
    );
    wrap("wrap", "box-button", 1, ["box-text"]);
    const host = document.createElement("div");
    host.innerHTML = html();
    const group = host.querySelector('[role="group"]')!;
    const first = group.getAttribute("aria-labelledby")!.split(" ")[0]!;
    expect(host.querySelector(`#${CSS.escape(first)}`)?.textContent).toBe(
      "Toppings",
    );
    expect(host.querySelectorAll("label label")).toHaveLength(0);
  });

  it("a standalone Checkbox: no label inside the button's label", async () => {
    const { html, wrap } = await open(
      toggle("Checkbox", "CheckboxButton", "CheckboxIndicator"),
      "box",
    );
    wrap("wrap", "box-button", 1, ["box-text"]);
    const host = document.createElement("div");
    host.innerHTML = html();
    expect(host.querySelectorAll("label label")).toHaveLength(0);
    expect(host.querySelector("span.react-aria-Label")?.textContent).toBe(
      "Own",
    );
  });
});

describe("ADR-256 Phase 3 review m3 — a frame around a group item", () => {
  const item = (
    name: string,
    owner: "Checkbox" | "Radio",
    props: Record<string, unknown>,
  ) => [
    node(name, owner, [`${name}-button`], props),
    node(`${name}-button`, `${owner}Button`, [
      `${name}-indicator`,
      `${name}-text`,
    ]),
    node(`${name}-indicator`, `${owner}Indicator`, []),
    node(`${name}-text`, "Label", [], { children: name }),
  ];

  it.each([
    ["CheckboxGroup", "CheckboxItems", "Checkbox"],
    ["RadioGroup", "RadioItems", "Radio"],
  ] as const)(
    "%s: the wrapped selected item is still selected",
    async (group, items, owner) => {
      const { html, wrap } = await open(
        [
          node("group", group, ["group-items"]),
          node("group-items", items, ["one", "two"]),
          ...item("one", owner, { isSelected: true, value: "one" }),
          ...item("two", owner, { value: "two" }),
        ],
        "group",
      );
      const checked = () => {
        const host = document.createElement("div");
        host.innerHTML = html();
        return [...host.querySelectorAll("input")].map((input) =>
          input.hasAttribute("checked"),
        );
      };
      expect(checked()).toEqual([true, false]);
      wrap("wrap", "group-items", 0, ["one"]);
      expect(checked()).toEqual([true, false]);
    },
  );
});
