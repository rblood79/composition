/**
 * ADR-303 G2 — `{color.container}` (자식은 가장 가까운 컨테이너의 배경 층) 가 Canvas 와 DOM 에서 같은 hex.
 *
 * 실제 노드 트리: 층 토큰을 Fill 로 가진 Frame (layer-1 · layer-2 · 중첩) · 임의 hex Frame (층을 물려주기만) ·
 * rule 컨테이너 (Card secondary = layer-1) 안에 reader (Separator · Link · Menu) 를 두고, 같은 record 를
 * 두 consumer 로 그린다 — DOM = product binding (`renderCatalogDom`) + Preview 번들 CSS 의 computed 배경
 * (`var(--container-bg, var(--bg))` 상속), Canvas = `bindCatalogCanvas` 의 node data `box.fillColor`.
 * oracle (Q5) 은 두 consumer 가 아니라 테마 snapshot 의 기대 층 hex — light · dark 두 모드.
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import {
  insertNodes,
  moveNodes,
  setWholeField,
} from "../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { libraryTokenId } from "../../../../packages/shared/src/catalog/document/libraryTokenScale";
import type {
  CatalogFillLayer,
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../packages/shared/src/catalog/document/types";
import { applyCatalogPreviewTheme } from "../../../../packages/shared/src/catalog/runtime/domView.runtime";
import { catalogThemeState } from "../../../../packages/shared/src/catalog/runtime/theme";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { getSkiaNode } from "@/builder/workspace/canvas/skia/useSkiaNode";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import { bindCatalogCanvas } from "@/builder/catalogRuntime/canvasBinding";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { catalogPaletteDefinitionId } from "@/builder/catalogRuntime/paletteInsert";
import { newCatalogProjectDocument } from "@/builder/catalogRuntime/project";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { CatalogWorkspace } from "@/builder/catalogRuntime/workspace";

let host: HTMLDivElement;
let reactRoot: Root;
const css = document.createElement("style");
const noTransition = document.createElement("style");

beforeAll(async () => {
  await initEngineWasm();
  css.textContent = bundleCss;
  document.head.append(css);
  injectPreviewBaseStyles(document);
  noTransition.textContent =
    "*, *::before, *::after { transition: none !important; animation: none !important; }";
  document.head.append(noTransition);
  host = document.createElement("div");
  host.style.cssText = "position:relative;width:1440px";
  document.body.append(host);
  reactRoot = createRoot(host);
});
afterAll(() => {
  reactRoot.unmount();
  host.remove();
  css.remove();
  noTransition.remove();
  document.getElementById("runtime-theme-vars")?.remove();
  document.documentElement.removeAttribute("data-theme");
});

const probe = new OffscreenCanvas(1, 1).getContext("2d", {
  willReadFrequently: true,
})!;
function cssBytes(value: string): string {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#00000000";
  probe.fillStyle = value;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return a === 0 ? "none" : `${r},${g},${b},${a}`;
}
function skiaBytes(color: Float32Array | undefined): string {
  if (!color || color[3]! <= 0) return "none";
  const [r, g, b, a] = [...color].map((v) => Math.round(v * 255));
  return `${r},${g},${b},${a}`;
}

const layerFill = (layer: string): CatalogFillLayer =>
  ({
    id: `fill-${layer}`,
    kind: "color",
    color: { kind: "token", tokenId: libraryTokenId(`{color.${layer}}`) },
    enabled: true,
    opacity: 1,
    blendMode: "normal",
  }) as CatalogFillLayer;
const hexFill: CatalogFillLayer = {
  id: "fill-hex",
  kind: "color",
  color: "#ff000080",
  enabled: true,
  opacity: 1,
  blendMode: "normal",
};

/** parent (undefined = body) · type · fills · props · expected layer of the reader (undefined = container) */
const TREE: readonly {
  id: string;
  parent?: string;
  type: string;
  fills?: CatalogFillLayer[];
  props?: Record<string, unknown>;
  expect?: string;
}[] = [
  { id: "nav-root", type: "Nav", expect: "base" },
  { id: "f1", type: "frame", fills: [layerFill("layer-1")] },
  { id: "nav-f1", parent: "f1", type: "Nav", expect: "layer-1" },
  { id: "bc-f1", parent: "f1", type: "Breadcrumbs", expect: "layer-1" },
  { id: "dz-f1", parent: "f1", type: "DropZone", expect: "layer-1" },
  { id: "lb-f1", parent: "f1", type: "ListBox", expect: "layer-1" },
  { id: "f1-hex", parent: "f1", type: "frame", fills: [hexFill] },
  { id: "nav-f1-hex", parent: "f1-hex", type: "Nav", expect: "layer-1" },
  { id: "f12", parent: "f1", type: "frame", fills: [layerFill("layer-2")] },
  { id: "lb-f12", parent: "f12", type: "ListBox", expect: "layer-2" },
  { id: "f2", type: "frame", fills: [layerFill("layer-2")] },
  { id: "dz-f2", parent: "f2", type: "DropZone", expect: "layer-2" },
  { id: "card", type: "Card", props: { variant: "secondary" } },
  { id: "nav-card", parent: "card", type: "Nav", expect: "layer-1" },
  // (투명 Group 은 컨테이너가 아니다 — 안의 reader 는 Card 층)
  { id: "grp-card", parent: "card", type: "Group" },
  { id: "nav-grp", parent: "grp-card", type: "Nav", expect: "layer-1" },
];

/** f1 의 Fill 을 layer-2 로 바꾼 뒤 (증분 — 다시 묶지 않는다) 의 기대 층. */
const AFTER_EDIT: Readonly<Record<string, string>> = {
  "nav-f1": "layer-2",
  "bc-f1": "layer-2",
  "dz-f1": "layer-2",
  "lb-f1": "layer-2",
  "nav-f1-hex": "layer-2",
  "lb-f12": "layer-2",
};

const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:c${++next}` as EntryId<K>;
};

async function measure(mode: "light" | "dark") {
  const library = await buildCodeCatalogLibrary();
  const theme = (graph: CatalogGraph) => {
    const state = catalogThemeState(graph);
    return { ...state, key: `${state.key}|${mode}`, colorMode: mode };
  };
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: `project:project:container-${mode}` as EntryId<"project">,
        name: "Container",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr303-container-${Math.random()}`),
    {
      engine: createLayoutEngine(),
      viewport: { width: 1440, height: 900 },
      autosaveSchedule: () => {},
      textMeasure: catalogTextMeasure,
      theme: theme as never,
    },
  );
  const state = theme(workspace.runtime.graph);
  applyCatalogPreviewTheme(state as never);
  const snapshot = state.snapshot().colors[mode] as Record<string, string>;
  const newId = allocator();
  for (const { id, parent, type, fills, props = {} } of TREE) {
    const nodeId = `project:node:${id}` as NodeId;
    workspace.execute(
      insertNodes({
        parent: {
          kind: "node",
          id: `project:node:${parent ?? "home-body"}` as NodeId,
        },
        entries: [
          {
            kind: "node",
            id: nodeId,
            definitionId: catalogPaletteDefinitionId(library, type),
            children: [],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [
                k,
                { kind: "set", value: v },
              ]),
            ),
            visual: {},
            sizing: { width: { kind: "set", value: 240 } },
            ...(fills ? { fills } : {}),
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [nodeId],
        newId,
      }),
    );
  }
  const root = workspace.root;
  const bodyRecord = root.pageRootRecords()[0]!;
  reactRoot.render(
    React.createElement("div", null, renderCatalogDom(root, bodyRecord)),
  );
  await new Promise<void>((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => done())),
  );
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const rows: string[] = [];
  let compared = 0;
  const check = (label: string, expected: (id: string) => string | undefined) => {
    for (const { id } of TREE) {
      const layer = expected(id);
      if (!layer) continue;
      const record = root.recordsOfSource(`project:node:${id}`)[0]!;
      const element = host.querySelector(
        `[data-catalog-id="${CSS.escape(record)}"]`,
      );
      const data = getSkiaNode(record);
      const want = cssBytes(snapshot[layer]!);
      const dom = element
        ? cssBytes(getComputedStyle(element).backgroundColor)
        : "no-dom";
      const skia = data?.box ? skiaBytes(data.box.fillColor) : "no-canvas";
      compared += 1;
      if (dom !== want || skia !== want)
        rows.push(
          `${mode} ${label} ${id}: want ${layer} ${want} · DOM ${dom} · Canvas ${skia}`,
        );
    }
  };
  check("insert", (id) => TREE.find((n) => n.id === id)?.expect);
  // (Q2 불리 케이스 — 컨테이너 층 편집: 자손 reader 의 `_containerLayer` 가 증분으로 따라와야 한다)
  workspace.execute(
    setWholeField({
      targets: [{ kind: "node", id: "project:node:f1" as NodeId }],
      field: "fills",
      value: [layerFill("layer-2")],
      label: "Fill",
    }),
  );
  // (the Builder's frame loop — the binding re-derives the records the step marked dirty)
  canvas.update();
  reactRoot.render(
    React.createElement("div", null, renderCatalogDom(root, bodyRecord)),
  );
  await new Promise<void>((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => done())),
  );
  check(
    "edit",
    (id) => AFTER_EDIT[id] ?? TREE.find((n) => n.id === id)?.expect,
  );
  // (컨테이너가 아닌 hex Frame 을 body 로 옮긴다 — 층은 그대로지만 위가 바뀌어 안의 reader 는 base)
  workspace.execute(
    moveNodes({
      ids: ["project:node:f1-hex" as NodeId],
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      newId,
    }),
  );
  canvas.update();
  reactRoot.render(
    React.createElement("div", null, renderCatalogDom(root, bodyRecord)),
  );
  await new Promise<void>((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => done())),
  );
  check("move", (id) =>
    id === "nav-f1-hex"
      ? "base"
      : (AFTER_EDIT[id] ?? TREE.find((n) => n.id === id)?.expect),
  );
  canvas.dispose();
  reactRoot.render(null);
  return { rows, compared, snapshot };
}

it("{color.container} — Canvas = DOM = 기대 층 hex (light · dark, Frame 층 · 중첩 · hex 통과 · rule 컨테이너 · 층 편집 · 이동 증분)", async () => {
  const light = await measure("light");
  const dark = await measure("dark");
  // (dark 에서 층이 실제로 갈린다 — base ≠ layer-1 ≠ layer-2, 그래서 같은 hex 가 우연이 아니다)
  expect(
    new Set(["base", "layer-1", "layer-2"].map((k) => dark.snapshot[k])).size,
  ).toBe(3);
  expect(light.compared + dark.compared).toBe(60);
  expect([...light.rows, ...dark.rows]).toEqual([]);
});
