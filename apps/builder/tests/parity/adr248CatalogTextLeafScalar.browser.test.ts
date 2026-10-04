import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { insertNodes } from "../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../packages/shared/src/catalog/document/types";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { newCatalogProjectDocument } from "@/builder/catalogRuntime/project";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { CatalogWorkspace } from "@/builder/catalogRuntime/workspace";

/**
 * Falsification case for the parity harness's legacy pipeline leg (2026-10-05, review-loop-closure
 * §2 — hypothesis + one counter case). `textLeafScalarBlockParent` measured the old TS pipeline
 * (`calculateFullTreeLayout`), whose text-leaf scalar supply collapsed a shrink-to-fit block parent
 * (400 · 12 · 0 where Chrome gave the text width). Production now feeds the engine through the
 * composition root (`styleOf` + `catalogTextMeasure`), which the legacy leg never runs.
 *
 * Hypothesis: the catalog path supplies the scalars on every one of those parents. The same cases
 * as catalog documents: the composition root's geometry against the catalog DOM binding's boxes in
 * Chrome (both product paths — no hand-written CSS leg).
 */
const TEXT = "Hello World";
let host: HTMLDivElement;
let reactRoot: Root;
let css: HTMLStyleElement;

beforeAll(async () => {
  await initEngineWasm();
  css = document.createElement("style");
  css.textContent = `${bundleCss}\n@font-face { font-family: Pretendard; src: url('/fonts/PretendardVariable.ttf'); font-style: normal; font-weight: 100 900; }`;
  document.head.append(css);
  await document.fonts.load("16px Pretendard");
  host = document.createElement("div");
  host.style.cssText =
    "position:relative;width:1440px;height:900px;font-family:Pretendard,sans-serif";
  document.body.append(host);
  reactRoot = createRoot(host);
});
afterAll(() => {
  reactRoot.unmount();
  host.remove();
  css.remove();
});

type Layout = Record<string, string>;
interface Case {
  name: string;
  outer: Layout;
  box: {
    layout?: Layout;
    visual?: Record<string, string | number>;
    width?: number;
  };
  text?: Record<string, string | number>;
}

const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:t${++next}` as EntryId<K>;
};
const set = <T>(value: T) => ({ kind: "set" as const, value });
const fields = <T>(values: Record<string, T> = {}) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, set(v)]));

async function open(c: Case) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:scalar" as EntryId<"project">,
        name: "Scalar",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-scalar-${Math.random()}`),
    {
      engine: createLayoutEngine(),
      viewport: { width: 1440, height: 900 },
      autosaveSchedule: () => {},
      textMeasure: catalogTextMeasure,
    },
  );
  const node = (
    id: string,
    definitionId: string,
    children: string[],
    rest: Partial<NodeEntry>,
  ): NodeEntry =>
    ({
      kind: "node",
      id: `project:node:${id}` as NodeId,
      definitionId,
      children: children.map((child) => `project:node:${child}` as NodeId),
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
      ...rest,
    }) as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        node("outer", "lib:definition:type-frame", ["box"], {
          layout: fields(c.outer),
          sizing: { width: set(400) },
        } as never),
        node("box", "lib:definition:type-frame", ["txt"], {
          layout: fields(c.box.layout),
          visual: fields(c.box.visual),
          sizing: c.box.width ? { width: set(c.box.width) } : {},
        } as never),
        node("txt", "lib:definition:text", [], {
          props: { children: set(TEXT) },
          visual: fields({ fontSize: 16, ...c.text }),
        } as never),
      ],
      rootIds: ["project:node:outer" as NodeId],
      newId: allocator(),
    }),
  );
  const root = workspace.root;
  const record = (id: string) => root.recordsOfSource(`project:node:${id}`)[0];
  const ids = {
    outer: record("outer"),
    box: record("box"),
    txt: record("txt"),
  };
  // Canvas side: the engine geometry (each rect relative to its parent record).
  const geometry = root.getGeometry(Object.values(ids));
  const canvas = {
    boxX: geometry.get(ids.box)!.x,
    boxW: geometry.get(ids.box)!.width,
    txtX: geometry.get(ids.txt)!.x,
    txtW: geometry.get(ids.txt)!.width,
    txtH: geometry.get(ids.txt)!.height,
  };
  // DOM side: the catalog DOM binding in Chrome.
  reactRoot.render(renderCatalogDom(root, ids.outer));
  await new Promise<void>((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => done())),
  );
  const rect = (id: string) =>
    host
      .querySelector<HTMLElement>(`[data-catalog-id="${id}"]`)!
      .getBoundingClientRect();
  const outer = rect(ids.outer);
  const boxRect = rect(ids.box);
  const txtRect = rect(ids.txt);
  const dom = {
    boxX: boxRect.x - outer.x,
    boxW: boxRect.width,
    txtX: txtRect.x - boxRect.x,
    txtW: txtRect.width,
    txtH: txtRect.height,
  };
  reactRoot.render(React.createElement(React.Fragment));
  return { canvas, dom };
}

const BLOCK: Layout = { display: "block" };
const CASES: Case[] = [
  {
    name: "block max-content > Text",
    outer: BLOCK,
    box: { layout: BLOCK, visual: { width: "max-content" } },
  },
  {
    name: "block max-content > Text paddingLeft 12",
    outer: BLOCK,
    box: { layout: BLOCK, visual: { width: "max-content" } },
    text: { paddingLeft: 12 },
  },
  {
    name: "block min-content > Text (2 lines)",
    outer: BLOCK,
    box: { layout: BLOCK, visual: { width: "min-content" } },
  },
  {
    name: "block fit-content > Text",
    outer: BLOCK,
    box: { layout: BLOCK, visual: { width: "fit-content" } },
  },
  {
    name: "Container Align — column align center > block > Text",
    outer: { display: "flex", flexDirection: "column", alignItems: "center" },
    box: { layout: BLOCK },
  },
  // Controls: a definite parent stretches the text; a percentage resolves without the scalars.
  {
    name: "control — block w400 > Text",
    outer: BLOCK,
    box: { layout: BLOCK, width: 400 },
  },
  {
    name: "control — block w400 > Text paddingLeft 12",
    outer: BLOCK,
    box: { layout: BLOCK, width: 400 },
    text: { paddingLeft: 12 },
  },
  {
    name: "control — block w400 > Text width 50%",
    outer: BLOCK,
    box: { layout: BLOCK, width: 400 },
    text: { width: "50%" },
  },
];

describe("catalog path — text leaf scalars under a shrink-to-fit block parent", () => {
  it.each(CASES.map((c) => [c.name, c] as const))("%s", async (_name, c) => {
    const { canvas, dom } = await open(c);
    // The old pipeline's collapse: a shrink-to-fit box at 400 (the root) or 0 / padding only.
    expect(dom.boxW).toBeGreaterThan(20);
    for (const key of Object.keys(dom) as (keyof typeof dom)[])
      expect(
        Math.abs(canvas[key] - dom[key]),
        `${key}: canvas ${canvas[key]} vs dom ${dom[key]}`,
      ).toBeLessThanOrEqual(1);
  });
});
