import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../packages/shared/src/catalog/document/fixture";
import { createPencilFixtureLibrary } from "../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogEntry,
  LayoutWrites,
  NodeEntry,
} from "../../../../packages/shared/src/catalog/document/types";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "@/builder/catalogRuntime/compositionRoot";
import { CatalogRuntime } from "@/builder/catalogRuntime/controller";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";

/**
 * ADR-275 G2 — an authored absolute box is `layout.position` + insets (+ `unsafe center`), and the
 * Canvas (engine through `styleOf`) and the Preview DOM (`renderCatalogDom`) place it the same for
 * each Position constraint: Left · Right · Left+Right · Center (Fixed · Hug · offset · overflow) ·
 * `%`. The parent has a border and padding (the containing block is its padding box).
 */
const set = (value: string) => ({ kind: "set" as const, value });

interface Case {
  name: string;
  /** Hand-computed border box from the parent's border-box origin (border 2 · padding box 396 × 296). */
  expect: [number, number, number, number];
  layout: Record<string, string>;
  size?: [number, number];
  content?: [number, number];
}

const CENTER = "unsafe center";
const CASES: Case[] = [
  {
    name: "left-top",
    expect: [26, 18, 100, 50],
    layout: { insetLeft: "24px", insetTop: "16px" },
    size: [100, 50],
  },
  {
    name: "right-bottom",
    expect: [274, 232, 100, 50],
    layout: { insetRight: "24px", insetBottom: "16px" },
    size: [100, 50],
  },
  {
    name: "left-right",
    expect: [26, 2, 348, 40],
    layout: { insetLeft: "24px", insetRight: "24px", insetTop: "0px" },
    size: [0, 40],
  },
  {
    name: "center-fixed",
    expect: [150, 125, 100, 50],
    layout: {
      insetLeft: "0px",
      insetRight: "0px",
      insetTop: "0px",
      insetBottom: "0px",
      justifySelf: CENTER,
      alignSelf: CENTER,
    },
    size: [100, 50],
  },
  {
    name: "center-offset",
    expect: [170, 105, 100, 50],
    layout: {
      insetLeft: "20px",
      insetRight: "-20px",
      insetTop: "-20px",
      insetBottom: "20px",
      justifySelf: CENTER,
      alignSelf: CENTER,
    },
    size: [100, 50],
  },
  {
    name: "center-hug",
    expect: [170, 140, 60, 20],
    layout: {
      insetLeft: "0px",
      insetRight: "0px",
      insetTop: "0px",
      insetBottom: "0px",
      justifySelf: CENTER,
      alignSelf: CENTER,
    },
    content: [60, 20],
  },
  {
    name: "percent",
    expect: [42, 32, 100, 50],
    layout: { insetLeft: "10%", insetTop: "10%" },
    size: [100, 50],
  },
  {
    name: "center-overflow",
    expect: [-50, -50, 500, 400],
    layout: {
      insetLeft: "0px",
      insetRight: "0px",
      insetTop: "0px",
      insetBottom: "0px",
      justifySelf: CENTER,
      alignSelf: CENTER,
    },
    size: [500, 400],
  },
];

let host: HTMLDivElement;
let reactRoot: Root;
let css: HTMLStyleElement;

beforeAll(async () => {
  await initEngineWasm();
  css = document.createElement("style");
  css.textContent = bundleCss;
  document.head.append(css);
  host = document.createElement("div");
  host.style.cssText = "position:relative;width:1440px;height:900px";
  document.body.append(host);
  reactRoot = createRoot(host);
});
afterAll(() => {
  reactRoot.unmount();
  host.remove();
  css.remove();
});

describe("ADR-275 authored absolute position — Canvas ↔ DOM", () => {
  it.each(CASES)("$name", async (testCase) => {
    const { document: seed } = createG1Fixture();
    const page = seed.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const parentId = "project:node:parent" as NodeEntry["id"];
    const childId = "project:node:child" as NodeEntry["id"];
    const contentId = "project:node:content" as NodeEntry["id"];
    const parent: NodeEntry = {
      kind: "node",
      id: parentId,
      definitionId: "lib:definition:frame",
      children: [childId],
      props: {},
      visual: {
        borderColor: set("#3851a4"),
        borderWidth: { kind: "set", value: 2 },
        paddingTop: { kind: "set", value: 10 },
        paddingRight: { kind: "set", value: 10 },
        paddingBottom: { kind: "set", value: 10 },
        paddingLeft: { kind: "set", value: 10 },
      },
      sizing: {
        width: { kind: "set", value: 400 },
        height: { kind: "set", value: 300 },
      },
      descendantOverrides: [],
    };
    const layout: LayoutWrites = {
      position: set("absolute"),
      ...Object.fromEntries(
        Object.entries(testCase.layout).map(([key, value]) => [
          key,
          set(value),
        ]),
      ),
    };
    const child: NodeEntry = {
      kind: "node",
      id: childId,
      definitionId: "lib:definition:frame",
      children: testCase.content ? [contentId] : [],
      props: {},
      visual: { fill: set("#e04747") },
      sizing: testCase.size
        ? {
            ...(testCase.size[0]
              ? { width: { kind: "set", value: testCase.size[0] } }
              : {}),
            height: { kind: "set", value: testCase.size[1] },
          }
        : {},
      layout,
      descendantOverrides: [],
    };
    const content: NodeEntry | undefined = testCase.content && {
      kind: "node",
      id: contentId,
      definitionId: "lib:definition:frame",
      children: [],
      props: {},
      visual: { fill: set("#53a853") },
      sizing: {
        width: { kind: "set", value: testCase.content[0] },
        height: { kind: "set", value: testCase.content[1] },
      },
      descendantOverrides: [],
    };
    const graph = new CatalogGraph(
      {
        ...seed,
        entries: {
          [seed.projectId]: seed.entries[seed.projectId],
          [page.id]: { ...page, children: [parentId] },
          [parentId]: parent,
          [childId]: child,
          ...(content ? { [contentId]: content } : {}),
        },
      },
      createPencilFixtureLibrary(),
    );
    const root = new CatalogCompositionRoot(
      new CatalogRuntime(
        graph,
        new CatalogStorage(indexedDB, `adr275-parity-${testCase.name}`),
      ),
      createLayoutEngine(),
      { width: 1440, height: 900 },
    );
    const bySource = new Map(
      [...root.domInputs.values()].map((node) => [node.sourceId, node]),
    );
    const parentRecord = bySource.get(parentId)!;
    const childRecord = bySource.get(childId)!;
    reactRoot.render(renderCatalogDom(root, parentRecord.id));
    await new Promise<void>((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done())),
    );
    const parentEl = host.querySelector<HTMLElement>(
      `[data-catalog-id="${parentRecord.id}"]`,
    )!;
    const childEl = host.querySelector<HTMLElement>(
      `[data-catalog-id="${childRecord.id}"]`,
    )!;
    const p = parentEl.getBoundingClientRect();
    const c = childEl.getBoundingClientRect();
    const dom = [c.x - p.x, c.y - p.y, c.width, c.height].map(Math.round);
    const engine = root.getGeometry([childRecord.id]).get(childRecord.id)!;
    expect(dom).toEqual(testCase.expect);
    expect(
      [engine.x, engine.y, engine.width, engine.height].map(Math.round),
    ).toEqual(dom);
  });
});
