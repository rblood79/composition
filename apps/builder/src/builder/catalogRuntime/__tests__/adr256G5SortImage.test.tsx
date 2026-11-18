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
 * - example 11 — moved to S2 TableView (2026-11-19): the sort arrow is S2 `ColumnContents`' —
 *   `s2TableViewStructure.test.tsx` · `adr257TableOperations.test.tsx`.
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

describe("S2 Image outside an S2 Card (2026-11-18 — was the RAC examples' plain img, G5 example 10)", () => {
  it("in a frame: a box around its `img`, as S2 `Image`", async () => {
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
    expect(image.tagName).toBe("DIV");
    expect(image.getAttribute("data-catalog-id")).toBeTruthy();
    expect(image.children.length).toBe(1);
    expect(image.children[0]!.tagName).toBe("IMG");
    expect(image.children[0]!.getAttribute("alt")).toBe("");
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
