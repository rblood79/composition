import "@react-spectrum/s2/page.css";
import { act, createElement as h, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { Tabs, TabList, Tab, TabPanel, Provider } from "@react-spectrum/s2";
import { Collection } from "@react-spectrum/s2/Tabs";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import {
  insertNodes,
  editItems,
  setFields,
} from "../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../packages/shared/src/catalog/document/types";
import { applyCatalogPreviewTheme } from "../../../../packages/shared/src/catalog/runtime/domView.runtime";
import { catalogThemeState } from "../../../../packages/shared/src/catalog/runtime/theme";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { loadBuiltinFontsToSkia } from "@/builder/fonts/loadCustomFontsToSkia";
import { getSkiaNode } from "@/builder/workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "@/builder/catalogRuntime/canvasBinding";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { catalogPaletteDefinitionId } from "@/builder/catalogRuntime/paletteInsert";
import { newCatalogProjectDocument } from "@/builder/catalogRuntime/project";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { CatalogWorkspace } from "@/builder/catalogRuntime/workspace";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const colorProbe = new OffscreenCanvas(1, 1).getContext("2d", {
  willReadFrequently: true,
})!;
function colorBytes(value: string): number[] {
  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = value;
  colorProbe.fillRect(0, 0, 1, 1);
  return [...colorProbe.getImageData(0, 0, 1, 1).data];
}
const css = document.createElement("style");
const face = document.createElement("style");
let library: Awaited<ReturnType<typeof buildCodeCatalogLibrary>>;
beforeAll(async () => {
  face.textContent =
    '@font-face { font-family: "Pretendard"; src: url("/fonts/PretendardVariable.ttf") format("truetype"); font-weight: 45 920; font-display: block; }';
  document.head.append(face);
  await document.fonts.load('400 14px "Pretendard"');
  await initEngineWasm();
  await initCanvasKit();
  await loadBuiltinFontsToSkia();
  library = await buildCodeCatalogLibrary();
  css.textContent = bundleCss;
  document.head.append(css);
  injectPreviewBaseStyles(document);
});
afterAll(() => {
  css.remove();
  face.remove();
  document.getElementById("runtime-theme-vars")?.remove();
  document.documentElement.removeAttribute("data-theme");
});

type TabsCase = {
  colorMode: "light" | "dark";
  orientation: "horizontal" | "vertical";
  density: "compact" | "regular";
  labelBehavior: "show" | "hide";
  isDisabled: boolean;
};
const cases = (["light", "dark"] as const).flatMap((colorMode) =>
  (["horizontal", "vertical"] as const).flatMap((orientation) =>
    (["compact", "regular"] as const).flatMap((density) =>
      (["show", "hide"] as const).flatMap((labelBehavior) =>
        [false, true].map((isDisabled) => ({
          colorMode,
          orientation,
          density,
          labelBehavior,
          isDisabled,
        })),
      ),
    ),
  ),
);

it("dynamic items keep S2 selection and panel content in sync after edits", async () => {
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:dynamic-tabs",
      name: "Dynamic tabs",
    }),
    library,
  );
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `tabs-dynamic-${Math.random()}`),
    {
      engine: createLayoutEngine(),
      viewport: { width: 800, height: 600 },
      autosaveSchedule: () => {},
      textMeasure: catalogTextMeasure,
    },
  );
  const id = "project:node:tabs" as NodeId;
  let items = [
    { id: "a", title: "Alpha", content: "Alpha body" },
    { id: "b", title: "Beta", content: "Beta body" },
    { id: "c", title: "Gamma", content: "Gamma body" },
  ];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [
        {
          kind: "node",
          id,
          definitionId: catalogPaletteDefinitionId(library, "Tabs"),
          children: [],
          props: { items: { kind: "set", value: items } },
          visual: { width: { kind: "set", value: 500 } },
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  applyCatalogPreviewTheme(catalogThemeState(graph));
  const root = workspace.root;
  const record = root.recordsOfSource(id)[0]!;
  const host = document.body.appendChild(document.createElement("div"));
  const reactRoot = createRoot(host);
  const draw = () =>
    reactRoot.render(
      h(
        Fragment,
        null,
        h("div", { "data-own": true }, renderCatalogDom(root, record)),
        compareSelection
          ? h(Provider, {
              children: h(
                "div",
                { "data-reference": true },
                h(Tabs, {
                  "aria-label": "Dynamic tabs",
                  children: [
                    h(TabList<(typeof items)[number]>, {
                      key: "list",
                      items,
                      children: (item) => h(Tab, { children: item.title }),
                    }),
                    h(Collection<(typeof items)[number]>, {
                      key: "panels",
                      items,
                      children: (item) =>
                        h(TabPanel, { children: item.content }),
                    }),
                  ],
                }),
              ),
            })
          : null,
      ),
    );
  const own = () => host.querySelector("[data-own]")!;
  const ref = () => host.querySelector("[data-reference]")!;
  const tabs = (element: Element) => [
    ...element.querySelectorAll<HTMLElement>("[role=tab]"),
  ];
  let compareSelection = true;
  const check = () => {
    expect(tabs(own()).map((tab) => tab.textContent)).toEqual(
      items.map((item) => item.title),
    );
    if (compareSelection)
      expect(own().querySelector("[role=tabpanel]")?.textContent).toBe(
        ref().querySelector("[role=tabpanel]")?.textContent,
      );
    if (compareSelection)
      expect(
        tabs(own()).find((tab) => tab.getAttribute("aria-selected") === "true")
          ?.textContent,
      ).toBe(
        tabs(ref()).find((tab) => tab.getAttribute("aria-selected") === "true")
          ?.textContent,
      );
    const panels = [...root.canvasInputs.values()].filter(
      (node) => root.typeOf(node) === "TabPanel",
    );
    expect(panels).toHaveLength(items.length);
    expect(
      [...root.canvasInputs.values()].filter(
        (node) => root.typeOf(node) === "Tab",
      ),
    ).toHaveLength(items.length);
  };
  const edit = async (change: Parameters<typeof editItems>[0]["edit"]) => {
    await act(async () => {
      workspace.execute(
        editItems({ target: { kind: "node", id }, key: "items", edit: change }),
      );
      const entry = graph.getEntry(id) as NodeEntry;
      items = (entry.props.items as { kind: "set"; value: typeof items }).value;
      draw();
    });
    check();
  };
  try {
    await act(async () => draw());
    check();
    await act(async () => userEvent.click(tabs(own())[1]!));
    await act(async () => userEvent.click(tabs(ref())[1]!));
    check();
    await edit({ kind: "move", id: "b", index: 0 });
    await edit({
      kind: "update",
      id: "b",
      patch: { title: "Edited", content: "Edited body" },
    });
    expect(own().querySelector("[role=tabpanel]")?.textContent).toBe(
      "Edited body",
    );
    await edit({
      kind: "add",
      item: { id: "d", title: "Delta", content: "Delta body" },
    });
    // Builder는 삭제된 선택을 남은 첫 항목으로 복구한다. S2의 uncontrolled
    // 선택은 삭제된 key를 유지하므로 이 지점부터는 Builder 계약을 검증한다.
    compareSelection = false;
    await edit({ kind: "remove", id: "b" });
    expect(own().querySelector("[role=tabpanel]")?.textContent).toBe(
      "Alpha body",
    );
    for (const key of ["a", "c", "d"]) await edit({ kind: "remove", id: key });
    expect(own().querySelector("[role=tabpanel]")).toBeNull();
    await edit({
      kind: "add",
      item: { id: "e", title: "Restored", content: "Restored body" },
    });
    expect(own().querySelector("[role=tabpanel]")?.textContent).toBe(
      "Restored body",
    );
  } finally {
    await act(async () => reactRoot.unmount());
    host.remove();
    workspace.dispose();
  }
});

function reference(props: TabsCase) {
  return h(Provider, {
    colorScheme: props.colorMode,
    children: h(
      "div",
      { "data-reference": true },
      h(Tabs, {
        "aria-label": "Tabs",
        orientation: props.orientation,
        density: props.density,
        labelBehavior: props.labelBehavior,
        isDisabled: props.isDisabled,
        UNSAFE_style: { width: 500, fontFamily: "var(--font-sans)" },
        children: [
          h(TabList, {
            key: "list",
            children: [
              h(Tab, { id: "tab-1", key: "tab-1", children: "Tab 1" }),
              h(Tab, { id: "tab-2", key: "tab-2", children: "Tab 2" }),
            ],
          }),
          h(TabPanel, { id: "tab-1", key: "p1", children: null }),
          h(TabPanel, { id: "tab-2", key: "p2", children: null }),
        ],
      }),
    ),
  });
}

it.each(cases)(
  "S2 Tabs: $colorMode $orientation $density $labelBehavior disabled=$isDisabled",
  async (props) => {
    const { colorMode, labelBehavior } = props;
    const graph = new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:tabs",
        name: "Tabs",
      }),
      library,
    );
    const theme = () => ({ ...catalogThemeState(graph), colorMode });
    const workspace = new CatalogWorkspace(
      graph,
      new CatalogStorage(indexedDB, `tabs-${Math.random()}`),
      {
        engine: createLayoutEngine(),
        viewport: { width: 800, height: 600 },
        autosaveSchedule: () => {},
        theme,
        textMeasure: catalogTextMeasure,
      },
    );
    applyCatalogPreviewTheme(theme());
    const id = "project:node:tabs" as NodeId;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" as NodeId },
        entries: [
          {
            kind: "node",
            id,
            definitionId: catalogPaletteDefinitionId(library, "Tabs"),
            children: [],
            props: Object.fromEntries(
              Object.entries(props)
                .filter(([key]) => key !== "colorMode")
                .map(([key, value]) => [key, { kind: "set", value }]),
            ),
            visual: { width: { kind: "set", value: 500 } },
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [id],
        newId: workspace.newId,
      }),
    );
    const root = workspace.root;
    const record = root.recordsOfSource(id)[0]!;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    let canvas: ReturnType<typeof bindCatalogCanvas> | undefined;
    try {
      await act(async () =>
        reactRoot.render(
          h(
            Fragment,
            null,
            h("div", { "data-own": true }, renderCatalogDom(root, record)),
            reference(props),
          ),
        ),
      );
      const own = host.querySelector("[data-own]")!;
      const ref = host.querySelector("[data-reference]")!;
      const ownList = own.querySelector("[role=tablist]")!;
      const refList = ref.querySelector("[role=tablist]")!;
      expect(own.querySelector(".react-aria-TabPanels")).toBeNull();
      const ownTabs = [...own.querySelectorAll("[role=tab]")];
      const refTabs = [...ref.querySelectorAll("[role=tab]")];
      for (let i = 0; i < 2; i++) {
        const actual = ownTabs[i]!;
        const expected = refTabs[i]!;
        for (const key of ["height", "width"] as const)
          expect(
            actual.getBoundingClientRect()[key],
            `tab ${i} ${key}`,
          ).toBeCloseTo(expected.getBoundingClientRect()[key], 1);
        expect(actual.getAttribute("aria-disabled")).toBe(
          expected.getAttribute("aria-disabled"),
        );
        if (labelBehavior === "hide")
          expect(actual.getAttribute("aria-label")).toBe(`Tab ${i + 1}`);
        const a = getComputedStyle(actual);
        const e = getComputedStyle(expected);
        for (const key of [
          "fontSize",
          "fontWeight",
          "lineHeight",
          "borderRadius",
          "paddingLeft",
          "paddingRight",
          "flexShrink",
        ] as const)
          expect(a[key], key).toBe(e[key]);
        expect(parseFloat(a.gap)).toBeCloseTo(parseFloat(e.gap), 3);
        expect(colorBytes(a.color)).toEqual(colorBytes(e.color));
      }
      for (const key of [
        "gap",
        "marginLeft",
        "marginRight",
        "flexDirection",
      ] as const) {
        const expected = getComputedStyle(refList)[key];
        expect(getComputedStyle(ownList)[key], key).toBe(
          expected === "normal" ? "0px" : expected,
        );
      }
      const panel = own.querySelector("[role=tabpanel]")!;
      const refPanel = ref.querySelector("[role=tabpanel]")!;
      expect(panel.parentElement).toBe(own.querySelector(".react-aria-Tabs"));
      for (const key of [
        "paddingTop",
        "paddingLeft",
        "marginTop",
        "display",
        "flexGrow",
      ] as const)
        expect(getComputedStyle(panel)[key], key).toBe(
          getComputedStyle(refPanel)[key],
        );
      const indicator = own.querySelector(".react-aria-SelectionIndicator")!;
      const refIndicator = refTabs[0]!.firstElementChild!;
      for (const key of ["width", "height"] as const)
        expect(
          indicator.getBoundingClientRect()[key],
          `indicator ${key}`,
        ).toBeCloseTo(refIndicator.getBoundingClientRect()[key], 1);
      const indicatorColor = colorBytes(
        getComputedStyle(indicator).backgroundColor,
      );
      expect(indicatorColor).toEqual(
        colorBytes(getComputedStyle(refIndicator).backgroundColor),
      );
      canvas = bindCatalogCanvas(root, root.pageRootRecords());
      for (const type of ["TabList", "Tab", "TabPanel", "SelectionIndicator"]) {
        const nodes = [...root.canvasInputs.values()].filter(
          (n) => root.typeOf(n) === type && !n.hidden,
        );
        for (const n of nodes) {
          const element = own.querySelector(`[data-catalog-id="${n.id}"]`);
          if (!element) continue;
          const rect = root.getGeometry([n.id]).get(n.id)!;
          const dom = element.getBoundingClientRect();
          for (const key of ["width", "height"] as const)
            expect(rect[key], `Canvas ${type} ${key}`).toBeCloseTo(dom[key], 0);
          if (type === "SelectionIndicator") {
            const color = getSkiaNode(n.id)!.box!.fillColor!;
            for (let channel = 0; channel < 3; channel++)
              expect(color[channel] * 255).toBeCloseTo(
                indicatorColor[channel]!,
                0,
              );
          }
        }
      }
      // 실제 Chromium 키 이벤트: 자동/수동 활성화와 disabledKeys의 탐색 제외.
      if (
        colorMode === "dark" &&
        props.density === "regular" &&
        labelBehavior === "show" &&
        !props.isDisabled
      ) {
        const tabs = () => [...own.querySelectorAll<HTMLElement>("[role=tab]")];
        const selected = () =>
          tabs().findIndex(
            (tab) => tab.getAttribute("aria-selected") === "true",
          );
        const next =
          props.orientation === "vertical" ? "{ArrowDown}" : "{ArrowRight}";
        await act(async () => userEvent.click(tabs()[0]!));
        await act(async () => userEvent.keyboard(next));
        expect(selected()).toBe(1);
        const edit = async (values: Record<string, string | string[]>) => {
          await act(async () => {
            workspace.execute(
              setFields({
                targets: [workspace.positionOfRecord(record)!.target],
                props: Object.fromEntries(
                  Object.entries(values).map(([key, value]) => [
                    key,
                    { kind: "set", value },
                  ]),
                ),
              }),
            );
          });
        };
        await edit({
          keyboardActivation: "manual",
          defaultSelectedKey: "tab-1",
        });
        await act(async () => userEvent.click(tabs()[0]!));
        await act(async () => userEvent.keyboard(next));
        expect(document.activeElement).toBe(tabs()[1]);
        expect(selected()).toBe(0);
        await act(async () => userEvent.keyboard("{Enter}"));
        expect(selected()).toBe(1);
        await edit({
          keyboardActivation: "automatic",
          disabledKeys: ["tab-2"],
          defaultSelectedKey: "tab-1",
        });
        await act(async () => userEvent.click(tabs()[0]!));
        await act(async () => userEvent.keyboard(next));
        expect(selected()).toBe(0);
        expect(tabs()[1]!.getAttribute("aria-disabled")).toBe("true");
      }
    } finally {
      canvas?.dispose();
      await act(async () => reactRoot.unmount());
      host.remove();
      workspace.dispose();
    }
  },
);
