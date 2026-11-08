/**
 * ADR-303 리뷰 round 3 m1 — owner 상태가 주는 부품 그림자 (S2 quiet Card 의 CardPreview: `Card.tsx:251`
 * `preview` — hover · focus · selected `elevated`). Card rule 의 `partStateStyles["&% .react-aria-CardPreview"]`
 * 하나를 생성 CSS (자손 선택자) 와 Canvas (owner 상태로 평가) 가 같이 읽는지 잰다.
 *
 * 실제 노드 트리 (primary Card 대조군 · quiet 선택 Card > CardPreview) 를 두 consumer 로 그린다 — DOM =
 * product binding (`renderCatalogDom`) + Preview 번들 CSS 의 computed `box-shadow` 층 수, Canvas =
 * `bindCatalogCanvas` node data 의 `box.shadows` + drop-shadow 효과 수. owner 편집 (선택 해제 · 다시 선택 ·
 * variant 전환) 은 증분 (`canvas.update()`) 으로 따라와야 한다 — 부품 record 는 그대로다.
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import {
  insertNodes,
  setFields,
} from "../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
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

const TREE: readonly {
  id: string;
  parent?: string;
  type: string;
  props?: Record<string, unknown>;
}[] = [
  { id: "pc", type: "Card" },
  { id: "qc", type: "Card", props: { variant: "quiet", isSelected: true } },
  { id: "qp", parent: "qc", type: "CardPreview" },
];

const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:s${++next}` as EntryId<K>;
};

/** DOM `box-shadow` 의 층 수 (`none` = 0). */
const domLayers = (value: string) =>
  value === "none" ? 0 : (value.match(/rgba?\(/g) ?? []).length;

async function measure(mode: "light" | "dark") {
  const library = await buildCodeCatalogLibrary();
  const theme = (graph: CatalogGraph) => {
    const state = catalogThemeState(graph);
    return { ...state, key: `${state.key}|${mode}`, colorMode: mode };
  };
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: `project:project:part-shadow-${mode}` as EntryId<"project">,
        name: "Part shadow",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr303-part-shadow-${Math.random()}`),
    {
      engine: createLayoutEngine(),
      viewport: { width: 1440, height: 900 },
      autosaveSchedule: () => {},
      textMeasure: catalogTextMeasure,
      theme: theme as never,
    },
  );
  applyCatalogPreviewTheme(theme(workspace.runtime.graph) as never);
  const newId = allocator();
  for (const { id, parent, type, props = {} } of TREE) {
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
            sizing: {
              width: { kind: "set", value: 240 },
              ...(type === "CardPreview"
                ? { height: { kind: "set", value: 80 } }
                : {}),
            },
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
  const paint = async () => {
    reactRoot.render(
      React.createElement("div", null, renderCatalogDom(root, bodyRecord)),
    );
    await new Promise<void>((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done())),
    );
  };
  await paint();
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const rows: string[] = [];
  let compared = 0;
  const check = (label: string, want: Readonly<Record<string, number>>) => {
    for (const [id, layers] of Object.entries(want)) {
      const record = root.recordsOfSource(`project:node:${id}`)[0]!;
      const element = host.querySelector(
        `[data-catalog-id="${CSS.escape(record)}"]`,
      );
      const data = getSkiaNode(record);
      const dom = element
        ? domLayers(getComputedStyle(element).boxShadow)
        : "no-dom";
      const skia = data
        ? (data.box?.shadows?.length ?? 0) +
          (data.effects ?? []).filter((e) => e.type === "drop-shadow").length
        : "no-canvas";
      compared += 1;
      if (dom !== layers || skia !== layers)
        rows.push(
          `${mode} ${label} ${id}: want ${layers} · DOM ${dom} · Canvas ${skia}`,
        );
    }
  };
  const setProp = async (key: string, value: string | boolean) => {
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:qc" as NodeId }],
        props: { [key]: { kind: "set", value } },
        label: key,
      }),
    );
    // (the Builder's frame loop — the binding redraws what the step marked dirty)
    canvas.update();
    await paint();
  };
  // (대조군 primary 는 휴지 `emphasized` — 루트 그림자 3 층)
  const primaryRest = 3;
  check("insert", { pc: primaryRest, qc: 0, qp: 3 });
  await setProp("isSelected", false);
  check("unselect", { qc: 0, qp: 0 });
  await setProp("isSelected", true);
  check("reselect", { qc: 0, qp: 3 });
  // (primary 는 루트가 그림자를 갖고 미리보기는 없다)
  await setProp("variant", "primary");
  check("primary", { qp: 0 });
  canvas.dispose();
  reactRoot.render(null);
  return { rows, compared };
}

it("quiet Card 의 CardPreview 상태 그림자 — Canvas = DOM (light · dark, 선택 · 해제 · variant 증분)", async () => {
  const light = await measure("light");
  const dark = await measure("dark");
  expect(light.compared + dark.compared).toBe(16);
  expect([...light.rows, ...dark.rows]).toEqual([]);
});
