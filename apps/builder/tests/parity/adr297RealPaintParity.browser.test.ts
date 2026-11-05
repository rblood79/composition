/**
 * ADR-297 Phase 3 닫힘 판정 — 표 전수 칠 대조 (`adr297DomPaintParity`) 의 남은 행을 **실제 노드 트리** 에서 다시 잰다.
 * 그 하니스는 rule 마다 합성 요소 하나 (조상 · 자식 없음) 에 상태 속성을 걸고 Canvas 쪽은 `resolveCatalogPaint`
 * (칠 입력) 를 읽는다 — Canvas 가 그 상자를 실제로 칠하는지, DOM 이 같은 값을 부품 · 조상 선택자로 주는지는 모른다.
 *
 * 여기서는 팔레트 instance 를 문서에 넣고, 같은 record 를 두 consumer 로 그린다: DOM = product binding
 * (`renderCatalogDom`) + Preview 번들 CSS 의 computed 값, Canvas = `bindCatalogCanvas` 가 등록한 node data
 * (`box.fillColor` · `strokeColor` × `strokeWidth` · `text.color`). 상자 칠 · 테두리 · 글자색을 record 마다 비교한다
 * (`.agent/runs/adr297-real-paint.json`, 로컬 전용).
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { commands } from "vitest/browser";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { insertNodes } from "../../../../packages/shared/src/catalog/commands";
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

/** 합성 대조의 남은 행이 나온 type 을 그리는 팔레트 owner (부품 type 은 그 owner 안에서 잰다). */
const OWNERS: readonly {
  readonly type: string;
  readonly props?: Record<string, unknown>;
  readonly visual?: Record<string, string | number>;
}[] = [
  { type: "ToggleButton" },
  { type: "ToggleButton", props: { isSelected: true } },
  { type: "ToggleButton", props: { staticColor: "white" } },
  { type: "ToggleButton", props: { staticColor: "black" } },
  { type: "ToggleButton", props: { staticColor: "white", isSelected: true } },
  { type: "ToggleButton", props: { isQuiet: true } },
  { type: "ToggleButtonGroup" },
  { type: "ToggleButtonGroup", props: { staticColor: "white" } },
  { type: "ToggleButtonGroup", props: { staticColor: "black" } },
  { type: "TagGroup" },
  { type: "TagGroup", props: { isEmphasized: true } },
  { type: "Tree" },
  { type: "Tree", props: { isEmphasized: true } },
  { type: "GridList" },
  { type: "GridList", props: { isQuiet: true } },
  { type: "Meter" },
  { type: "Meter", props: { variant: "positive" } },
  { type: "Meter", props: { variant: "notice" } },
  { type: "Meter", props: { variant: "negative" } },
  { type: "ProgressBar" },
  { type: "Toast" },
  { type: "Group" },
  { type: "CheckboxGroup" },
  { type: "RadioGroup" },
  { type: "Accordion" },
  { type: "Form" },
  { type: "Image" },
  { type: "Pagination" },
  { type: "Skeleton" },
  { type: "Table" },
  { type: "Table", props: { isQuiet: true } },
  { type: "Toolbar" },
  { type: "ListBox" },
  { type: "Tabs" },
  { type: "TextField" },
  { type: "TextField", props: { isInvalid: true } },
  { type: "Button", props: { variant: "genai" } },
  { type: "Button", props: { variant: "genai", staticColor: "white" } },
  { type: "Button", props: { variant: "genai", fillStyle: "outline" } },
  { type: "Button", props: { variant: "genai", isDisabled: true } },
  { type: "Button", props: { variant: "premium" } },
  {
    type: "Button",
    props: { variant: "genai" },
    visual: { borderColor: "#ff0000", borderWidth: 4, radius: 0 },
  },
  {
    type: "Button",
    props: { variant: "premium" },
    visual: { borderColor: "#ff0000", borderWidth: 4, radius: 8 },
  },
];

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

const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:r${++next}` as EntryId<K>;
};

/** Any CSS color → `r,g,b,a` bytes (the browser parses it — oklch · color-mix · var-resolved). */
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
const near = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (a === "none" || b === "none") return false;
  // (a gradient's stop list — every stop near)
  if (a.includes(" ") || b.includes(" ")) {
    const [x, y] = [a.split(" "), b.split(" ")];
    return x.length === y.length && x.every((stop, i) => near(stop, y[i]!));
  }
  const x = a.split(",").map(Number);
  const y = b.split(",").map(Number);
  return x.every((v, i) => Math.abs(v - y[i]!) <= 2);
};

interface Row {
  owner: string;
  type: string;
  id: string;
  channel: "bg" | "bd" | "fg" | "img";
  canvas: string;
  dom: string;
}

it("Canvas node data == DOM computed paint per record on the real node tree (the synthetic rows' judgment)", async () => {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:real-paint" as EntryId<"project">,
        name: "Real paint",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr297-real-${Math.random()}`),
    {
      engine: createLayoutEngine(),
      viewport: { width: 1440, height: 900 },
      autosaveSchedule: () => {},
      textMeasure: catalogTextMeasure,
      // (the project's theme on both consumers — the Canvas token values and the Preview variables)
      theme: catalogThemeState,
    },
  );
  applyCatalogPreviewTheme(catalogThemeState(workspace.runtime.graph));
  const newId = allocator();
  const owners: { label: string; id: NodeId }[] = [];
  const missing: string[] = [];
  for (const { type, props = {}, visual = {} } of OWNERS) {
    const label = `${type}${Object.keys(props).length ? JSON.stringify(props) : ""}${Object.keys(visual).length ? JSON.stringify(visual) : ""}`;
    const id =
      `project:node:o-${label.replace(/[^A-Za-z0-9]/g, "-")}` as NodeId;
    try {
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: "project:node:home-body" as NodeId },
          entries: [
            {
              kind: "node",
              id,
              definitionId: catalogPaletteDefinitionId(library, type),
              children: [],
              props: Object.fromEntries(
                Object.entries(props).map(([k, v]) => [
                  k,
                  { kind: "set", value: v },
                ]),
              ),
              visual: Object.fromEntries(
                Object.entries(visual).map(([key, value]) => [
                  key,
                  { kind: "set", value },
                ]),
              ),
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [id],
          newId,
        }),
      );
      owners.push({ label, id });
    } catch (error) {
      missing.push(`${label}: ${(error as Error).message}`);
    }
  }
  const root = workspace.root;
  const ownerRecords = owners.map(({ label, id }) => ({
    label,
    record: root.recordsOfSource(id)[0]!,
  }));
  reactRoot.render(
    React.createElement(
      React.Fragment,
      null,
      ...ownerRecords.map(({ label, record }) =>
        React.createElement(
          "div",
          { key: label, "data-real-owner": label },
          renderCatalogDom(root, record),
        ),
      ),
    ),
  );
  await new Promise<void>((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => done())),
  );
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());

  const inputs = root.canvasInputs;
  const ownerOf = (id: string): string | undefined => {
    let cursor: string | undefined = id;
    for (let depth = 0; cursor && depth < 64; depth += 1) {
      const hit = ownerRecords.find((o) => o.record === cursor);
      if (hit) return hit.label;
      cursor = inputs.get(cursor)?.parentId;
    }
    return undefined;
  };
  const rows: Row[] = [];
  let compared = 0;
  let noDom = 0;
  let noCanvas = 0;
  for (const [id] of inputs) {
    const owner = ownerOf(id);
    if (!owner) continue;
    const type = root.typeOf(inputs.get(id)!);
    const element = host.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    const data = getSkiaNode(id);
    if (!element) {
      noDom += 1;
      continue;
    }
    if (!data) {
      noCanvas += 1;
      continue;
    }
    const computed = getComputedStyle(element);
    const pairs: [Row["channel"], string, string][] = [];
    if (data.box) {
      pairs.push([
        "bg",
        skiaBytes(data.box.fillColor),
        cssBytes(computed.backgroundColor),
      ]);
      // (Per side — a Table's Column · Row draw their bottom line only, the Canvas `strokeWidths`
      //  top · right · bottom · left; a uniform stroke is every side's.)
      const width = data.box.strokeWidth ?? 0;
      const sides = (data.box as { strokeWidths?: readonly number[] })
        .strokeWidths;
      const side = sides
        ? Math.max(
            0,
            sides.findIndex((w) => w > 0),
          )
        : 0;
      const css = (["Top", "Right", "Bottom", "Left"] as const)[side]!;
      const canvasWidth = sides ? (sides[side] ?? 0) : width;
      pairs.push([
        "bd",
        canvasWidth > 0 ? skiaBytes(data.box.strokeColor) : "none",
        parseFloat(computed[`border${css}Width`]) > 0
          ? cssBytes(computed[`border${css}Color`])
          : "none",
      ]);
    }
    if (data.text?.content)
      pairs.push(["fg", skiaBytes(data.text.color), cssBytes(computed.color)]);
    // ADR-297 후속 ⑥: the gradient over the background (S2 premium · genai Button) — its stop colors,
    //   the Canvas box background against the DOM `background-image`.
    const gradient =
      data.box?.fill?.type === "linear-gradient" ? data.box.fill : undefined;
    const domImage = computed.backgroundImage;
    if (gradient || (domImage && domImage !== "none"))
      pairs.push([
        "img",
        gradient ? gradient.colors.map(skiaBytes).join(" ") : "none",
        domImage === "none"
          ? "none"
          : (domImage.match(/rgba?\([^)]*\)/g) ?? []).map(cssBytes).join(" "),
      ]);
    for (const [channel, c, d] of pairs) {
      compared += 1;
      if (!near(c, d))
        rows.push({ owner, type, id, channel, canvas: c, dom: d });
    }
  }
  canvas.dispose();
  const byType: Record<string, number> = {};
  for (const row of rows) byType[row.type] = (byType[row.type] ?? 0) + 1;
  console.log(
    `[adr297-real-paint] owners ${owners.length} · compared ${compared} · mismatches ${rows.length} · no DOM ${noDom} · no Canvas ${noCanvas}\n` +
      Object.entries(byType)
        .map(([t, n]) => `  ${t} ${n}`)
        .join("\n"),
  );
  expect(owners.length).toBeGreaterThan(30);
  expect(missing).toEqual([]);
  expect(compared).toBeGreaterThan(200);
  await commands.writeFile(
    "../../.agent/runs/adr297-real-paint.json",
    `${JSON.stringify({ owners: owners.map((o) => o.label), missing, compared, noDom, noCanvas, byType, rows }, null, 1)}\n`,
  );
  // ADR-297 후속 ② ~ ⑥ (2026-11-02): every record paints the same on both consumers — the genai Button's
  //   gradient included (⑥ — the rule tree's `backgroundImage`).
  expect(
    rows.map(
      (row) => `${row.owner} ${row.type} ${row.channel} ${row.canvas} / ${row.dom}`,
    ),
  ).toEqual([]);
  expect(rows.length).toBe(0);
});
