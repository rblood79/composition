// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
import { catalogEditContract } from "../editContract";
import { catalogRuleShapes } from "../ruleShapes";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 G5 (2026-10-12, 사용자 지시 「둘 다 레퍼런스대로 고쳐」):
 * - example 11 — a sortable Column's sort indicator is the reference's (react-aria.adobe.com
 *   Table.md `Column`): `span.sort-indicator` right after the name Group, always — hidden while
 *   the column is not sorted, its box kept (the Canvas keeps it beside the name).
 * - example 10 — an Image outside an S2 Card's preview is the RAC examples' plain `img`.
 */
const BODY = "project:node:home-body" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

const node = (
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  children: string[] = [],
): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId: `lib:definition:type-${type}`,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, set(value)]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

async function open(entries: NodeEntry[], rootIds: string[]) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-g5-sort" as EntryId<"project">,
        name: "G5",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-g5-sort-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: rootIds as NodeId[],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const record = (sourceId: string) =>
    [...root.domInputs.values()].find((r) => r.sourceId === sourceId)!;
  const draw = (sourceId: string) => {
    const view = render(renderCatalogDom(root, record(sourceId).id));
    cleanups.push(() => view.unmount());
    return view.container;
  };
  const rect = (sourceId: string) =>
    root.getGeometry([record(sourceId).id]).get(record(sourceId).id)!;
  return { workspace, root, record, draw, rect };
}

/** A Table whose Name column is the Column original's shape: `Column > Group[presentation] > Text`. */
const table = (nameProps: Record<string, unknown>) => [
  node("project:node:t", "Table", {}, ["project:node:th", "project:node:tb"]),
  node("project:node:th", "TableHeader", {}, [
    "project:node:name",
    "project:node:type",
  ]),
  node("project:node:name", "Column", { children: "Name", ...nameProps }, [
    "project:node:name-group",
  ]),
  node("project:node:name-group", "Group", { role: "presentation" }, [
    "project:node:name-text",
  ]),
  {
    ...node("project:node:name-text", "Text", { children: "Name" }),
    definitionId: "lib:definition:text",
  } as NodeEntry,
  node("project:node:type", "Column", { children: "Type" }),
  node("project:node:tb", "TableBody", {}, ["project:node:r0"]),
  node("project:node:r0", "Row", {}, [
    "project:node:r0c0",
    "project:node:r0c1",
  ]),
  node("project:node:r0c0", "Cell", { children: "Games" }),
  node("project:node:r0c1", "Cell", { children: "File folder" }),
];

describe("ADR-256 G5 example 11 — the reference's sort indicator", () => {
  it("DOM: a sortable column's indicator follows its name Group (a chevron, hidden at rest); none in an unsortable one", async () => {
    const { draw } = await open(table({ allowsSorting: true }), [
      "project:node:t",
    ]);
    const container = draw("project:node:t");
    const [name, type] = container.querySelectorAll("[role=columnheader]");
    const group = name.querySelector("[role=presentation]")!;
    const indicator = group.nextElementSibling!;
    expect(indicator.tagName).toBe("SPAN");
    expect(indicator.className).toBe("sort-indicator");
    expect(indicator.getAttribute("aria-hidden")).toBe("true");
    expect(indicator.children[0].tagName.toLowerCase()).toBe("svg");
    // (`visibility: hidden` while the column is not sorted — `Table.css`.)
    expect(name.hasAttribute("data-sort-direction")).toBe(false);
    expect(type.querySelector(".sort-indicator")).toBeNull();
  });

  it("the sortable column is the reference's `.column-header` row: the name takes the rest beside the indicator's box (Canvas = DOM)", async () => {
    const { root, record, rect } = await open(table({ allowsSorting: true }), [
      "project:node:t",
    ]);
    const column = record("project:node:name");
    expect(column.layout.display).toBe("flex");
    expect(column.layout.alignItems).toBe("center");
    const group = record("project:node:name-group");
    expect(group.layout.flexGrow ?? group.layout.flex).toBeDefined();
    // The Canvas name Group ends where the DOM indicator begins: the column's content box less
    // the indicator (16px chevron + 2px each side).
    const columnBox = rect("project:node:name");
    const groupBox = rect("project:node:name-group");
    expect(groupBox.width).toBe(columnBox.width - 8 * 2 - 20);
    void root;
  });

  it("allowsSorting on and off moves the Canvas name box (the Column's dependents)", async () => {
    const { workspace, record, rect } = await open(table({}), [
      "project:node:t",
    ]);
    const full = rect("project:node:name-group").width;
    workspace.root.execute(
      setFields({
        targets: [
          workspace.positionOfRecord(record("project:node:name").id)!.target,
        ],
        props: { allowsSorting: set(true) },
      }),
    );
    expect(rect("project:node:name-group").width).toBe(full - 20);
  });
});

describe("ADR-256 G5 example 10 — Image is the RAC examples' plain img outside an S2 Card", () => {
  it("in a frame: the `img` itself carries the Image's box", async () => {
    const { draw } = await open(
      [
        {
          ...node("project:node:f", "frame", {}, ["project:node:img"]),
          definitionId: "lib:definition:type-frame",
        } as NodeEntry,
        node("project:node:img", "Image"),
      ],
      ["project:node:f"],
    );
    const container = draw("project:node:f");
    const image = container.querySelector(".react-aria-Image")!;
    expect(image.tagName).toBe("IMG");
    expect(image.getAttribute("alt")).toBe("");
    expect(image.getAttribute("data-catalog-id")).toBeTruthy();
    expect(image.children.length).toBe(0);
  });
});

/**
 * 2026-10-24 (사용자 「image 컴퍼넌트 프러퍼티에 image src, alt 를 넣을 프러퍼티가 누락」): S2 `Image`
 * `src` · `alt` — the Design panel edits them, the DOM `img` and the Canvas image shape show them.
 */
describe("Image src · alt (S2 Image)", () => {
  const SRC = "https://example.test/photo.png";
  const frame = (imageProps: Record<string, unknown>, inCard = false) => [
    ...(inCard
      ? [
          node("project:node:f", "Card", {}, ["project:node:p"]),
          node("project:node:p", "CardPreview", {}, ["project:node:img"]),
        ]
      : [
          {
            ...node("project:node:f", "frame", {}, ["project:node:img"]),
            definitionId: "lib:definition:type-frame",
          } as NodeEntry,
        ]),
    node("project:node:img", "Image", imageProps),
  ];

  it("the Design panel offers src and alt", async () => {
    const { workspace, record } = await open(frame({}), ["project:node:f"]);
    const contract = catalogEditContract(
      workspace.runtime.graph,
      workspace.readModel,
      workspace.positionOfRecord(record("project:node:img").id)!.target,
    );
    expect(
      contract.fields
        .filter((field) => !field.editorHidden)
        .map((field) => [field.key, field.section]),
    ).toEqual(
      expect.arrayContaining([
        ["src", "content"],
        ["alt", "content"],
      ]),
    );
  });

  for (const inCard of [false, true])
    it(`the DOM img carries them (${inCard ? "S2 Card preview" : "plain img"})`, async () => {
      const { draw } = await open(frame({ src: SRC, alt: "A photo" }, inCard), [
        "project:node:f",
      ]);
      const img = draw("project:node:f").querySelector("img")!;
      expect(img.getAttribute("src")).toBe(SRC);
      expect(img.getAttribute("alt")).toBe("A photo");
      expect(img.style.objectFit).toBe("cover");
    });

  it("no source: no src attribute, decorative alt", async () => {
    const { draw } = await open(frame({}), ["project:node:f"]);
    const img = draw("project:node:f").querySelector("img")!;
    expect(img.hasAttribute("src")).toBe(false);
    expect(img.getAttribute("alt")).toBe("");
  });

  it("the Canvas draws the picture over the placeholder, covering the box", async () => {
    const { workspace, root, record, rect } = await open(frame({ src: SRC }), [
      "project:node:f",
    ]);
    const image = record("project:node:img");
    const box = rect("project:node:img");
    const shapes = catalogRuleShapes({
      node: root.canvasInputs.get(image.id)!,
      rect: { width: box.width, height: box.height },
      rule: workspace.runtime.graph.library.rules.get("Image" as never)!,
      type: "Image",
      authoredVisual: {},
    });
    const at = shapes.findIndex((shape) => shape.type === "image");
    expect(shapes[at]).toMatchObject({
      src: SRC,
      fit: "cover",
      width: box.width,
      height: box.height,
    });
    expect(at).toBeGreaterThan(
      shapes.findIndex((shape) => "id" in shape && shape.id === "bg"),
    );
    workspace.root.execute(
      setFields({
        targets: [workspace.positionOfRecord(image.id)!.target],
        props: { src: set("") },
      }),
    );
    expect(
      catalogRuleShapes({
        node: root.canvasInputs.get(image.id)!,
        rect: { width: box.width, height: box.height },
        rule: workspace.runtime.graph.library.rules.get("Image" as never)!,
        type: "Image",
        authoredVisual: {},
      }).some((shape) => shape.type === "image"),
    ).toBe(false);
  });
});
