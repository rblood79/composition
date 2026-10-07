// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ColorSwatch } from "react-aria-components/ColorSwatch";
import {
  ColorSwatchPicker,
  ColorSwatchPickerItem,
} from "react-aria-components/ColorSwatchPicker";
import { describe, expect, it } from "vitest";
import {
  insertGroupItem,
  insertNodes,
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
 * ADR-256 Phase 5b (G2) — a ColorSwatchPicker is the reference's `ColorSwatchPicker >
 * ColorSwatchPickerItem (color) > ColorSwatch`: each item a node whose color reaches the ColorSwatch
 * inside through RAC's context.
 */
const BODY = "project:node:home-body" as NodeId;
const PICKER = "project:node:picker" as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-swatches" as EntryId<"project">,
        name: "Swatches",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-swatches-${Math.random()}`),
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
          id: PICKER,
          definitionId: "lib:definition:origin-component-colorswatchpicker",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [PICKER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(
        root,
        [...root.domInputs.values()].find((r) => r.sourceId === PICKER)!.id,
      ),
    );
  return { workspace, root, html };
}

/** Decision 11 structure (tag · role · aria): the swatch's color is checked on its own. */
function structure(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter((attribute) =>
        /^(role|aria-(?!labelledby|describedby))/.test(attribute.name),
      )
      .map((attribute) =>
        attribute.name === "aria-label"
          ? "aria-label"
          : `${attribute.name}=${attribute.value}`,
      )
      .sort();
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${[
      ...element.children,
    ]
      .map(walk)
      .join("")}</>`;
  };
  return [...host.children].map(walk).join("\n");
}

const COLORS = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
];

describe("ADR-256 Phase 5b — ColorSwatchPicker items are ColorSwatchPickerItem > ColorSwatch", () => {
  it("has the reference example's structure", async () => {
    const { html } = await open();
    const reference = renderToStaticMarkup(
      createElement(
        ColorSwatchPicker,
        null,
        ...COLORS.map((color) =>
          createElement(
            ColorSwatchPickerItem,
            { key: color, color },
            createElement(ColorSwatch),
          ),
        ),
      ),
    );
    expect(structure(html())).toBe(structure(reference));
  });

  it("each item's color reaches its ColorSwatch (RAC context) — the swatch has none of its own", async () => {
    const { html, root } = await open();
    const host = document.createElement("div");
    host.innerHTML = html();
    const swatches = [...host.querySelectorAll(".react-aria-ColorSwatch")];
    expect(
      swatches.map((swatch) => swatch.getAttribute("aria-label")),
    ).toHaveLength(6);
    // RAC writes the swatch's color as its background (`style`), from the item.
    expect(
      swatches.every((swatch) =>
        (swatch.getAttribute("style") ?? "").includes("background"),
      ),
    ).toBe(true);
    const items = [...root.canvasInputs.values()].filter(
      (r) => root.typeOf(r) === "ColorSwatchPickerItem",
    );
    expect(items.map((item) => item.props.color)).toEqual(COLORS);
    expect(
      items.every(
        (item) =>
          item.children.length === 1 &&
          root.typeOf(root.canvasInputs.get(item.children[0]!)!) ===
            "ColorSwatch",
      ),
    ).toBe(true);
  });

  it("the picker's + adds an item with an unused color and its ColorSwatch", async () => {
    const { workspace, root, html } = await open();
    const item = workspace.newId("node");
    workspace.root.execute(
      insertGroupItem({
        hostId: PICKER,
        entries: [
          {
            kind: "node",
            id: item,
            definitionId: "lib:definition:type-ColorSwatchPickerItem",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootId: item,
        newId: workspace.newId,
      }),
    );
    const added = [...root.canvasInputs.values()].find(
      (r) => r.sourceId === item,
    )!;
    expect(COLORS).not.toContain(added.props.color);
    expect(added.children).toHaveLength(1);
    expect(html().match(/react-aria-ColorSwatchPickerItem/g)).toHaveLength(7);
  });
});
