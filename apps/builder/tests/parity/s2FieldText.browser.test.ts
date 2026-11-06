import {
  codeViewFileTree,
  generateCodeViewFile,
} from "../../../../packages/shared/src/codeView/files/tree";
import { catalogCodeView } from "@/builder/catalogRuntime/codeView";
import { catalogTextMetrics } from "../../../../packages/shared/src/catalog/runtime/boxModel";
import { act, createElement } from "react";
import { SearchField as SpectrumSearchField } from "@react-spectrum/s2/SearchField";
import { I18nProvider } from "react-aria/I18nProvider";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import {
  insertNodes,
  removeTargets,
  setLibraryDefault,
  setFields,
  setSiteSettings,
} from "../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { NodeEntry } from "../../../../packages/shared/src/catalog/document/types";
import { applyCatalogPreviewTheme } from "../../../../packages/shared/src/catalog/runtime/domView.runtime";
import { resolveThemeSnapshot } from "../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
import { installThemeMaps } from "../../../../packages/shared/src/catalog/runtime/themeMaps";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../packages/shared/src/catalog/runtime/fontDefaults";
import { createThemeDefinition } from "@composition/shared";
import { resolveToken, type TokenRef } from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { catalogPaletteDefinitionId } from "@/builder/catalogRuntime/paletteInsert";
import { newCatalogProjectDocument } from "@/builder/catalogRuntime/project";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { CatalogWorkspace } from "@/builder/catalogRuntime/workspace";
import {
  catalogAuthoredVisual,
  catalogHasExplicitVisual,
} from "@/builder/catalogRuntime/libraryVisual";
import { catalogFieldPrefixCommand } from "@/builder/catalogRuntime/fieldPrefixCommand";
import { nodePosition } from "../../../../packages/shared/src/catalog/resolution/positions";
import { catalogRuleShapes } from "@/builder/catalogRuntime/ruleShapes";
import { catalogCanvasNodeData } from "@/builder/catalogRuntime/canvasBinding";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import { getIconData } from "@composition/rendering";
import {
  catalogRulePaint,
  catalogStateOutline,
} from "../../../../packages/shared/src/catalog/runtime/rulePaint";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
const css = document.createElement("style");
let library: Awaited<ReturnType<typeof buildCodeCatalogLibrary>>;
beforeAll(async () => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  await initEngineWasm();
  library = await buildCodeCatalogLibrary();
  css.textContent =
    bundleCss +
    "\n*,*::before { transition: none !important; animation: none !important; }";
  document.head.append(css);
  injectPreviewBaseStyles(document);
});
afterAll(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  css.remove();
  installThemeMaps(null);
  document.getElementById("runtime-theme-vars")?.remove();
});
async function fixture(
  type: string,
  size: string,
  mode: "light" | "dark" = "light",
  locale?: string,
  actualMetrics = false,
) {
  const owner = type;
  const storage = new CatalogStorage(indexedDB, `field-text-${Math.random()}`);
  const documentSource = newCatalogProjectDocument({
    projectId: "project:project:selection",
    name: "Field text",
  });
  await storage.create(documentSource, library);
  const workspace = new CatalogWorkspace(
    new CatalogGraph(documentSource, library),
    storage,
    {
      root: { colorMode: mode },
      locale,
      engine: createLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: actualMetrics
        ? catalogTextMeasure
        : (text, font) => ({
            width: (text.length * font.fontSize) / 2,
            minWidth: (text.length * font.fontSize) / 2,
            height: font.fontSize * font.lineHeight,
          }),
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [
        {
          kind: "node",
          id: "project:node:selection",
          definitionId: catalogPaletteDefinitionId(library, owner),
          children: [],
          props: { size: { kind: "set", value: size } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: ["project:node:selection"],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const field = () =>
    [...root.domInputs.values()].find((n) => root.typeOf(n) === "Input")!;
  const group = () =>
    [...root.domInputs.values()].find((n) => root.typeOf(n) === owner)!;
  const write = (
    id: string,
    props: Record<string, string | number | boolean>,
  ) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(id)!.target],
        props: Object.fromEntries(
          Object.entries(props).map(([k, value]) => [
            k,
            { kind: "set", value },
          ]),
        ),
      }),
    );
  const host = document.body.appendChild(document.createElement("div"));
  const react = createRoot(host);
  const render = async (
    from = root,
    context?: Parameters<typeof renderCatalogDom>[2],
  ) => {
    await act(async () =>
      react.render(renderCatalogDom(from, group().id, context)),
    );
  };
  return {
    storage,
    workspace,
    root,
    field,
    group,
    write,
    host,
    render,
    dispose: async () => {
      await act(async () => react.unmount());
      host.remove();
      workspace.dispose();
    },
  };
}

const types = [
  "TextField",
  "TextArea",
  "SearchField",
  "NumberField",
  "ColorField",
  "ComboBox",
];
const necessityFieldTypes = [
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "CheckboxGroup",
  "RadioGroup",
  "Select",
  "ComboBox",
];
// Installed S2 1.8.2 Field.tsx: gray-600, neutral-subdued, negative, disabled-content.
const palettes = {
  light: {
    placeholder: "#717171",
    label: "#505050",
    error: "#d73220",
    disabled: "#c6c6c6",
    value: "#292929",
  },
  dark: {
    placeholder: "#8a8a8a",
    label: "#afafaf",
    error: "#fc432e",
    disabled: "#444444",
    value: "#dbdbdb",
  },
};
const sizes = { S: 12, M: 14, L: 16, XL: 18 };
function theme(mode: "light" | "dark") {
  const snapshot = resolveThemeSnapshot(
    createThemeDefinition("field-text", "Field text"),
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );
  installThemeMaps(snapshot);
  applyCatalogPreviewTheme({
    key: "field-text",
    colorMode: mode,
    install() {},
    snapshot: () => snapshot,
  });
}
function rgb(hex: string) {
  return `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
}
function canvasText(
  h: Awaited<ReturnType<typeof fixture>>,
  type: string,
  mode: "light" | "dark",
  authoredVisual = {},
) {
  let node = [...h.root.domInputs.values()].find(
    (n) => h.root.typeOf(n) === type,
  )!;
  if (type === "Label" && node.derivedProps?._fieldComposed === true) {
    node = node.children
      .map((id) => h.root.domInputs.get(id)!)
      .find((n) => n.props.slot === "label-content")!;
    type = "Text";
  }
  const shape = catalogRuleShapes({
    type,
    rule: COMPONENT_RULES_TABLE[type],
    node: { ...node, props: { ...node.props, ...node.derivedProps } },
    rect: { width: 208, height: 32 },
    theme: mode,
    authoredVisual: {
      ...catalogAuthoredVisual(h.root, node),
      ...authoredVisual,
    },
  }).find((s) => s.type === "text")!;
  if (!shape || shape.type !== "text") throw new Error(`Missing ${type} text`);
  const fill = String(shape.fill);
  return {
    ...shape,
    ...catalogTextMetrics(node, h.root.domInputs.get(node.parentId)),
    color: fill.startsWith("{") ? resolveToken(fill as TokenRef, mode) : fill,
  };
}
const cases = types.flatMap((type) =>
  (["light", "dark"] as const).flatMap((mode) =>
    Object.entries(sizes).map(([size, font]) => ({ type, mode, size, font })),
  ),
);

it.each(
  (["light", "dark"] as const).flatMap((mode) =>
    (["S", "M", "L", "XL"] as const).map((size) => ({ mode, size })),
  ),
)(
  "SearchField $mode $size: S2 icon and clear default visuals",
  async ({ mode, size }) => {
    const h = await fixture("SearchField", size, mode);
    theme(mode);
    const oracleHost = document.body.appendChild(document.createElement("div"));
    oracleHost.style.colorScheme = mode;
    oracleHost.style.setProperty("--s2-scale", "1");
    oracleHost.style.setProperty("--s2-font-size-base", "14");
    const oracle = createRoot(oracleHost);
    try {
      await h.render();
      for (const isDisabled of [false, true, false]) {
        await act(async () => {
          h.write(h.group().id, { value: "query", isDisabled });
          oracle.render(
            createElement(SpectrumSearchField, {
              label: "Search",
              value: "query",
              size,
              isDisabled,
              UNSAFE_style: {
                width: h.host.querySelector("input")!.getBoundingClientRect()
                  .width,
              },
            }),
          );
        });
        await h.render();
        const button = h.host.querySelector("button")!;
        const reference = oracleHost.querySelector("button")!;
        const leading = h.host.querySelector<HTMLElement>(
          '.react-aria-Icon[data-icon="s2-search"]',
        )!;
        const searchSvg = leading.querySelector("svg")!;
        const referenceSearch = oracleHost.querySelector("svg")!;
        const clearSvg = button.querySelector("svg")!;
        const referenceClear = reference.querySelector("svg")!;
        const clearRecord = [...h.root.canvasInputs.values()].find(
          (n) => h.root.typeOf(n) === "Button",
        )!;
        const iconRecord = [...h.root.canvasInputs.values()].find(
          (n) => n.props.iconName === "s2-search",
        )!;
        const crossRecord = [...h.root.canvasInputs.values()].find(
          (n) => n.props.iconName === "s2-cross",
        )!;
        const canvasRect = h.root
          .getGeometry([clearRecord.id])
          .get(clearRecord.id)!;
        for (const key of ["width", "height"] as const) {
          expect(
            button.getBoundingClientRect()[key],
            `button ${key}`,
          ).toBeCloseTo(reference.getBoundingClientRect()[key], 1);
          expect(canvasRect[key], `Canvas button ${key}`).toBeCloseTo(
            reference.getBoundingClientRect()[key],
            1,
          );
          expect(
            searchSvg.getBoundingClientRect()[key],
            `search ${key}`,
          ).toBeCloseTo(referenceSearch.getBoundingClientRect()[key], 1);
          expect(
            clearSvg.getBoundingClientRect()[key],
            `cross ${key}`,
          ).toBeCloseTo(referenceClear.getBoundingClientRect()[key], 1);
        }
        expect(getComputedStyle(button).backgroundColor).toBe(
          "rgba(0, 0, 0, 0)",
        );
        expect(getComputedStyle(button).color).toBe(
          getComputedStyle(reference).color,
        );
        expect(getComputedStyle(leading).color).toBe(
          getComputedStyle(reference).color,
        );
        expect(getComputedStyle(clearSvg).color).toBe(
          getComputedStyle(referenceClear).color,
        );
        const inputRect = h.host
          .querySelector("input")!
          .getBoundingClientRect();
        const refRect = oracleHost
          .querySelector("input")!
          .parentElement!.getBoundingClientRect();
        for (const [svg, ref] of [
          [searchSvg, referenceSearch],
          [clearSvg, referenceClear],
        ]) {
          expect(
            svg.getBoundingClientRect().left - inputRect.left,
            "glyph left",
          ).toBeCloseTo(ref.getBoundingClientRect().left - refRect.left, 0);
          expect(
            svg.getBoundingClientRect().top - inputRect.top,
            "glyph top",
          ).toBeCloseTo(ref.getBoundingClientRect().top - refRect.top, 0);
        }
        for (const [svg, ref, record] of [
          [searchSvg, referenceSearch, iconRecord],
          [clearSvg, referenceClear, crossRecord],
        ] as const) {
          expect(svg.getAttribute("viewBox")).toBe(ref.getAttribute("viewBox"));
          expect(svg.querySelector("path")!.getAttribute("d")).toBe(
            ref.querySelector("path")!.getAttribute("d"),
          );
          const data = catalogCanvasNodeData(h.root, record.id).iconPath!;
          expect(data.filled).toBe(true);
          expect(data.paths).toEqual(
            getIconData(String(record.props.iconName), "lucide", size)!.paths,
          );
          expect(data.size).toBeCloseTo(svg.getBoundingClientRect().width, 1);
          const color = Array.from(data.strokeColor)
            .slice(0, 3)
            .map((c) => Math.round(c * 255));
          expect(`rgb(${color.join(", ")})`).toBe(getComputedStyle(svg).color);
        }
      }
    } finally {
      await act(async () => oracle.unmount());
      oracleHost.remove();
      await h.dispose();
    }
  },
);

it.each(["light", "dark"] as const)(
  "SearchField %s: clear hover·pressed·focus paint",
  async (mode) => {
    const h = await fixture("SearchField", "M", mode);
    theme(mode);
    try {
      h.write(h.group().id, { value: "query" });
      await h.render();
      const button = h.host.querySelector("button")!;
      const record = [...h.root.canvasInputs.values()].find(
        (n) => h.root.typeOf(n) === "Button",
      )!;
      for (const state of ["hover", "pressed", "focusVisible"] as const) {
        delete button.dataset.hovered;
        delete button.dataset.pressed;
        delete button.dataset.focusVisible;
        button.dataset[state === "hover" ? "hovered" : state] = "true";
        const input = {
          type: "Button",
          rule: COMPONENT_RULES_TABLE.Button,
          node: record,
          state,
          theme: mode,
          authoredVisual: catalogAuthoredVisual(h.root, record),
          rect: { width: 32, height: 28 },
        };
        const computed = getComputedStyle(button);
        expect(computed.backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(computed.color).toBe(rgb(palettes[mode].value));
        const { paint } = catalogRulePaint(input);
        expect(resolveToken(paint.color as TokenRef, mode)).toBe(
          palettes[mode].value,
        );
        expect(resolveToken(paint.backgroundColor as TokenRef, mode)).toBe(
          "transparent",
        );
        if (state === "focusVisible") {
          expect(computed.outlineOffset).toBe("-4px");
          expect(computed.outlineWidth).toBe("2px");
          expect(computed.outlineStyle).toBe("solid");
          expect(catalogStateOutline(input)).toMatchObject({
            width: 2,
            offset: -4,
          });
        }
      }
    } finally {
      await h.dispose();
    }
  },
);

// 스타일 편집은 catalog 명령과 실제 저장소를 통해 검증한다.
it("SearchField: 아이콘·버튼 편집, Undo/Redo, 재로드와 기본값 복원", async () => {
  const h = await fixture("SearchField", "M");
  theme("light");
  let loaded: CatalogWorkspace | undefined;
  try {
    h.write(h.group().id, { value: "query", isDisabled: true });
    const search = [...h.root.domInputs.values()].find(
      (n) => n.props.iconName === "s2-search",
    )!;
    const button = [...h.root.domInputs.values()].find(
      (n) => h.root.typeOf(n) === "Button",
    )!;
    const cross = [...h.root.domInputs.values()].find(
      (n) => n.props.iconName === "s2-cross",
    )!;
    const edit = (
      id: string,
      values: Record<string, string | number>,
      remove = false,
    ) =>
      h.workspace.execute(
        setFields({
          targets: [h.workspace.positionOfRecord(id)!.target],
          visual: Object.fromEntries(
            Object.entries(values).map(([key, value]) => [
              key,
              remove ? { kind: "remove" } : { kind: "set", value },
            ]),
          ),
        }),
      );
    const check = async (custom: boolean, root = h.root) => {
      await h.render(root);
      const glyph = h.host.querySelector(
        '.react-aria-Icon[data-icon="s2-search"] svg',
      )!;
      const clear = h.host.querySelector("button")!;
      const crossSvg = clear.querySelector("svg")!;
      expect(getComputedStyle(glyph).color).toBe(
        rgb(custom ? "#008866" : palettes.light.disabled),
      );
      expect(glyph.getBoundingClientRect().width).toBe(custom ? 25 : 18);
      expect(getComputedStyle(clear).backgroundColor).toBe(
        custom ? rgb("#ffeecc") : "rgba(0, 0, 0, 0)",
      );
      expect(getComputedStyle(crossSvg).color).toBe(
        rgb(custom ? "#aa0044" : palettes.light.disabled),
      );
      for (const [id, svg] of [
        [search.id, glyph],
        [cross.id, crossSvg],
      ] as const) {
        const data = catalogCanvasNodeData(root, id).iconPath!;
        expect(data.size).toBe(svg.getBoundingClientRect().width);
        expect(
          `rgb(${Array.from(data.strokeColor)
            .slice(0, 3)
            .map((c) => Math.round(c * 255))
            .join(", ")})`,
        ).toBe(getComputedStyle(svg).color);
      }
    };
    await act(async () => {
      edit(search.id, { color: "#008866", fontSize: 25 });
      edit(button.id, { fill: "#ffeecc", color: "#aa0044" });
    });
    await check(true);
    await act(async () => {
      h.workspace.undo();
      h.workspace.undo();
    });
    await check(false);
    await act(async () => {
      h.workspace.redo();
      h.workspace.redo();
    });
    await check(true);
    await h.workspace.autosave.retry();
    expect(h.workspace.autosave.getSnapshot().state).toBe("saved");
    loaded = new CatalogWorkspace(
      new CatalogGraph(
        await h.storage.load(h.workspace.runtime.graph.projectId, library),
        library,
      ),
      h.storage,
      {
        engine: createLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule() {},
      },
    );
    await check(true, loaded.root);
    await act(async () => {
      edit(search.id, { color: "", fontSize: 0 }, true);
      edit(button.id, { fill: "", color: "" }, true);
    });
    await check(false);
    await act(async () => h.write(cross.id, { iconName: "x" }));
    await h.render();
    const editedIcon = h.host.querySelector("button svg")!;
    expect(editedIcon.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(editedIcon.getAttribute("fill")).toBe("none");
    expect(catalogCanvasNodeData(h.root, cross.id).iconPath!.paths).toEqual(
      getIconData("x")!.paths,
    );
    await act(async () => h.workspace.undo());
    // 같은 인스턴스의 크기 변경이 optical glyph에도 전달되어야 한다.
    for (const size of ["L", "S", "XL", "M"] as const) {
      await act(async () => h.write(h.group().id, { size }));
      await h.render();
      const svg = h.host.querySelector("button svg")!;
      expect(svg.querySelector("path")!.getAttribute("d")).toBe(
        getIconData("s2-cross", "lucide", size)!.paths[0],
      );
      expect(catalogCanvasNodeData(h.root, cross.id).iconPath!.paths).toEqual(
        getIconData("s2-cross", "lucide", size)!.paths,
      );
    }
  } finally {
    loaded?.dispose();
    await h.dispose();
  }
});

it.each(["S", "M", "L", "XL"] as const)(
  "SearchField %s: input end space matches installed S2",
  async (size) => {
    const h = await fixture("SearchField", size);
    const oracleHost = document.body.appendChild(document.createElement("div"));
    oracleHost.style.setProperty("--s2-scale", "1");
    oracleHost.style.setProperty("--s2-font-size-base", "14");
    const oracle = createRoot(oracleHost);
    try {
      for (const value of ["", "query"]) {
        for (const isReadOnly of [false, true]) {
          await act(async () => {
            h.write(h.group().id, { value, isReadOnly });
            oracle.render(
              createElement(SpectrumSearchField, {
                label: "Search",
                value,
                isReadOnly,
                size,
              }),
            );
          });
          await h.render();
          const input = h.host.querySelector("input")!;
          const reference = oracleHost.querySelector("input")!;
          const ownCss = getComputedStyle(input);
          const refCss = getComputedStyle(reference);
          const ownEnd =
            parseFloat(ownCss.paddingRight) +
            parseFloat(ownCss.borderRightWidth);
          const refEnd =
            reference.parentElement!.getBoundingClientRect().right -
            reference.getBoundingClientRect().right +
            parseFloat(refCss.paddingRight) +
            parseFloat(refCss.borderRightWidth);
          expect(ownEnd).toBeCloseTo(refEnd, 1);
        }
      }
    } finally {
      await act(async () => oracle.unmount());
      oracleHost.remove();
      await h.dispose();
    }
  },
);

// S2 1.8.2 SearchField.tsx: clear is present only when !isEmpty && !isReadOnly.
it.each(
  (["light", "dark"] as const).flatMap((mode) =>
    Object.keys(sizes).map((size) => ({ mode, size })),
  ),
)(
  "SearchField $mode $size: clear presence follows value and readonly",
  async ({ mode, size }) => {
    const h = await fixture("SearchField", size, mode);
    theme(mode);
    try {
      for (const value of ["", "query", "0", " "]) {
        for (const isReadOnly of [false, true, false]) {
          for (const isDisabled of [false, true]) {
            await act(async () =>
              h.write(h.group().id, { value, isReadOnly, isDisabled }),
            );
            await h.render();
            const clear = [...h.root.domInputs.values()].find(
              (n) => h.root.typeOf(n) === "Button",
            )!;
            const button = h.host.querySelector("button")!;
            const hidden = value === "" || isReadOnly;
            expect(h.root.layoutInputs.get(clear.id)?.hidden === true).toBe(
              hidden,
            );
            expect(getComputedStyle(button).display === "none").toBe(hidden);
            const input = h.host.querySelector("input")!;
            expect(input.readOnly).toBe(isReadOnly);
            expect(input.disabled).toBe(isDisabled);
            expect(input.value).toBe(value);
            const padding = hidden ? 0 : { S: 24, M: 32, L: 40, XL: 48 }[size]!;
            expect(h.field().visual.paddingRight, "resolved part padding").toBe(
              padding,
            );
            expect(parseFloat(getComputedStyle(input).paddingRight)).toBe(
              padding,
            );
            expect(canvasText(h, "Input", mode).paddingRight).toBe(padding);
          }
        }
      }
    } finally {
      await h.dispose();
    }
  },
);

it("SearchField: readonly Undo/Redo, save/load and reset restore clear presence", async () => {
  const h = await fixture("SearchField", "M");
  let loaded: CatalogWorkspace | undefined;
  const clear = [...h.root.domInputs.values()].find(
    (n) => h.root.typeOf(n) === "Button",
  )!;
  const check = async (hidden: boolean, root = h.root) => {
    await h.render(root);
    expect(root.layoutInputs.get(clear.id)?.hidden === true).toBe(hidden);
    expect(
      getComputedStyle(h.host.querySelector("button")!).display === "none",
    ).toBe(hidden);
    expect(h.host.querySelector("input")!.value).toBe("persisted query");
    expect(
      parseFloat(getComputedStyle(h.host.querySelector("input")!).paddingRight),
    ).toBe(hidden ? 0 : 32);
    expect(root.domInputs.get(h.field().id)!.visual.paddingRight).toBe(
      hidden ? 0 : 32,
    );
  };
  try {
    await act(async () => h.write(h.group().id, { value: "persisted query" }));
    await check(false);
    await act(async () => h.write(h.group().id, { isReadOnly: true }));
    await check(true);
    await act(async () => {
      h.workspace.undo();
    });
    await check(false);
    await act(async () => {
      h.workspace.redo();
    });
    await check(true);
    await h.workspace.autosave.retry();
    expect(h.workspace.autosave.getSnapshot().state).toBe("saved");
    loaded = new CatalogWorkspace(
      new CatalogGraph(
        await h.storage.load(h.workspace.runtime.graph.projectId, library),
        library,
      ),
      h.storage,
      {
        engine: createLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule() {},
      },
    );
    await check(true, loaded.root);
    await act(async () => {
      loaded!.execute(
        setFields({
          targets: [loaded!.positionOfRecord(h.group().id)!.target],
          props: { isReadOnly: { kind: "remove" } },
        }),
      );
    });
    await check(false, loaded.root);
  } finally {
    loaded?.dispose();
    await h.dispose();
  }
});

it.each([0, 12, 32, 23])(
  "SearchField: authored end padding %s survives state, history and reload",
  async (padding) => {
    const h = await fixture("SearchField", "M");
    let loaded: CatalogWorkspace | undefined;
    const edit = (remove = false) =>
      h.workspace.execute(
        setFields({
          targets: [h.workspace.positionOfRecord(h.field().id)!.target],
          visual: {
            paddingRight: remove
              ? { kind: "remove" }
              : { kind: "set", value: padding },
          },
        }),
      );
    const check = async (expected: number, root = h.root) => {
      await h.render(root);
      expect(root.domInputs.get(h.field().id)!.visual.paddingRight).toBe(
        expected,
      );
      expect(
        parseFloat(
          getComputedStyle(h.host.querySelector("input")!).paddingRight,
        ),
      ).toBe(expected);
    };
    try {
      await act(async () => edit());
      for (const value of ["", "query"]) {
        for (const isReadOnly of [false, true]) {
          await act(async () => h.write(h.group().id, { value, isReadOnly }));
          await check(padding);
          expect(canvasText(h, "Input", "light").paddingRight).toBe(padding);
        }
      }
      await act(async () => edit(true));
      await check(0);
      await act(async () => h.workspace.undo());
      await check(padding);
      await act(async () => h.workspace.redo());
      await check(0);
      await act(async () => h.workspace.undo());
      await h.workspace.autosave.retry();
      loaded = new CatalogWorkspace(
        new CatalogGraph(
          await h.storage.load(h.workspace.runtime.graph.projectId, library),
          library,
        ),
        h.storage,
        {
          engine: createLayoutEngine(),
          viewport: { width: 1000, height: 800 },
          autosaveSchedule() {},
        },
      );
      await check(padding, loaded.root);
    } finally {
      loaded?.dispose();
      await h.dispose();
    }
  },
);

it("SearchField: Input library padding remains editable across clear states", async () => {
  const h = await fixture("SearchField", "M");
  try {
    for (const padding of [0, 32, 23, undefined]) {
      await act(async () =>
        h.workspace.execute(
          setLibraryDefault({
            definitionId: "lib:definition:origin-component-input",
            scope: "visual",
            key: "paddingRight",
            write:
              padding === undefined
                ? { kind: "remove" }
                : { kind: "set", value: padding },
            newId: h.workspace.newId,
          }),
        ),
      );
      for (const value of ["", "query"]) {
        await act(async () => h.write(h.group().id, { value }));
        await h.render();
        const expected = padding ?? (value ? 32 : 0);
        expect(
          parseFloat(
            getComputedStyle(h.host.querySelector("input")!).paddingRight,
          ),
        ).toBe(expected);
        expect(h.field().visual.paddingRight).toBe(expected);
      }
    }
  } finally {
    await h.dispose();
  }
});

it("SearchField: runtime style override wins over clear-state defaults", async () => {
  const h = await fixture("SearchField", "M");
  try {
    await h.render(h.root, {
      runtime: {
        revisionOf: () => 0,
        handlersOf: () => ({}),
        subscribe: () => () => {},
        overrideOf: (id) =>
          id === h.field().id ? { style: { paddingRight: 17 } } : undefined,
      },
    });
    const input = h.host.querySelector("input")!;
    expect(parseFloat(getComputedStyle(input).paddingRight)).toBe(17);
    await act(async () => {
      await userEvent.click(input);
      await userEvent.keyboard("query");
    });
    expect(parseFloat(getComputedStyle(input).paddingRight)).toBe(17);
  } finally {
    await h.dispose();
  }
});

it("SearchField: typed value, readonly keyboard traversal and clear restore input focus", async () => {
  const h = await fixture("SearchField", "M");
  try {
    await h.render();
    const input = () => h.host.querySelector("input")!;
    const clear = () => h.host.querySelector("button")!;
    const padding = () => parseFloat(getComputedStyle(input()).paddingRight);
    expect(padding()).toBe(0);
    const after = h.host.appendChild(document.createElement("button"));
    after.textContent = "After field";
    await act(async () => {
      await userEvent.click(input());
      await userEvent.keyboard("typed query");
    });
    expect(getComputedStyle(clear()).display).not.toBe("none");
    expect(padding()).toBe(32);
    await act(async () => h.write(h.group().id, { isReadOnly: true }));
    await h.render();
    expect(getComputedStyle(clear()).display).toBe("none");
    expect(padding()).toBe(0);
    await act(async () => {
      await userEvent.click(input());
      await userEvent.keyboard("x");
      await userEvent.tab();
    });
    expect(input().value).toBe("typed query");
    expect(document.activeElement).toBe(after);
    await act(async () => h.write(h.group().id, { isReadOnly: false }));
    await h.render();
    await act(async () => {
      await userEvent.click(input());
      await userEvent.tab();
    });
    // RAC excludes clear from the tab order; keyboard users clear with Escape.
    expect(document.activeElement).toBe(after);
    expect(clear().tabIndex).toBe(-1);
    await act(async () => {
      await userEvent.click(clear());
    });
    expect(input().value).toBe("");
    expect(document.activeElement).toBe(input());
    expect(getComputedStyle(clear()).display).toBe("none");
    expect(padding()).toBe(0);
    await act(async () => {
      await userEvent.keyboard("again");
    });
    expect(getComputedStyle(clear()).display).not.toBe("none");
    expect(padding()).toBe(32);
    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
    expect(input().value).toBe("");
    expect(getComputedStyle(clear()).display).toBe("none");
    expect(padding()).toBe(0);
    after.remove();
  } finally {
    await h.dispose();
  }
});

it.each(cases)(
  "$type $mode $size: field text defaults and state restoration",
  async ({ type, mode, size, font }) => {
    const h = await fixture(type, size, mode);
    theme(mode);
    const colors = palettes[mode];
    try {
      await act(async () => {
        h.write(h.group().id, {
          description: "Help text",
          errorMessage: "Invalid text",
          placeholder: "Placeholder",
        });
      });
      for (const [isInvalid, isDisabled] of [
        [false, false],
        [false, true],
        [true, false],
        [true, true],
        [false, false],
      ]) {
        await act(async () => {
          h.write(h.group().id, { isInvalid, isDisabled });
        });
        await h.render();
        const input = h.host.querySelector<HTMLInputElement>(
          "input:not([type=hidden]),textarea",
        )!;
        expect(getComputedStyle(input, "::placeholder").color).toBe(
          rgb(colors.placeholder),
        );
        expect(canvasText(h, "Input", mode).color).toBe(colors.placeholder);
        const label = h.host.querySelector(".react-aria-Label")!;
        expect(getComputedStyle(label).fontWeight).toBe("400");
        const body = label.querySelector<HTMLElement>(
          '[slot="label-content"]',
        )!;
        expect(getComputedStyle(body).fontSize).toBe(`${font}px`);
        expect(getComputedStyle(body).color).toBe(
          rgb(isDisabled ? colors.disabled : colors.label),
        );
        const bodyNode = [...h.root.domInputs.values()].find(
          (n) => n.props.slot === "label-content",
        )!;
        expect(
          catalogTextMetrics(bodyNode, h.root.domInputs.get(bodyNode.parentId))
            .color,
        ).toBe(isDisabled ? colors.disabled : colors.label);
        expect(canvasText(h, "Label", mode).fontWeight).toBe(400);
        const hintType = isInvalid ? "FieldError" : "Description";
        const hint = h.host.querySelector(
          isInvalid ? ".react-aria-FieldError" : '[slot="description"]',
        )!;
        expect(getComputedStyle(hint).fontSize).toBe(`${font}px`);
        const color = isDisabled
          ? colors.disabled
          : isInvalid
            ? colors.error
            : colors.label;
        expect(getComputedStyle(hint).color).toBe(rgb(color));
        expect(canvasText(h, hintType, mode).color).toBe(color);
        expect(canvasText(h, hintType, mode).fontSize).toBe(font);
        expect(
          h.host.querySelector(
            isInvalid ? '[slot="description"]' : ".react-aria-FieldError",
          ),
        ).toBeNull();
        const help = [...h.root.canvasInputs.values()].find(
          (n) => h.root.typeOf(n) === "Description",
        )!;
        expect(help.hidden === true).toBe(isInvalid);
      }
    } finally {
      await h.dispose();
    }
  },
);
it.each(types)(
  "%s: authored placeholder color, Undo/Redo and reset",
  async (type) => {
    const h = await fixture(type, "M");
    theme("light");
    try {
      await act(async () => {
        h.write(h.group().id, { placeholder: "Placeholder", isDisabled: true });
      });
      const check = async (custom: boolean) => {
        await h.render();
        const input = h.host.querySelector<HTMLInputElement>(
          "input:not([type=hidden]),textarea",
        )!;
        expect(getComputedStyle(input, "::placeholder").color).toBe(
          rgb(custom ? "#008866" : palettes.light.placeholder),
        );
        expect(
          canvasText(h, "Input", "light", custom ? { color: "#008866" } : {})
            .color,
        ).toBe(custom ? "#008866" : palettes.light.placeholder);
      };
      await act(async () => {
        h.workspace.execute(
          setFields({
            targets: [h.workspace.positionOfRecord(h.field().id)!.target],
            visual: { color: { kind: "set", value: "#008866" } },
          }),
        );
      });
      await check(true);
      await act(async () => {
        h.workspace.undo();
      });
      await check(false);
      await act(async () => {
        h.workspace.redo();
      });
      await check(true);
      await act(async () => {
        h.workspace.execute(
          setFields({
            targets: [h.workspace.positionOfRecord(h.field().id)!.target],
            visual: { color: { kind: "remove" } },
          }),
        );
      });
      await check(false);
    } finally {
      await h.dispose();
    }
  },
);
it.each(["TextField", "SearchField", "NumberField"])(
  "%s: value color differs from placeholder and clears",
  async (type) => {
    const h = await fixture(type, "M");
    theme("light");
    try {
      const value =
        type === "NumberField"
          ? "1234"
          : type === "ColorField"
            ? "#abcdef"
            : "Actual value";
      for (const filled of [true, false]) {
        await act(async () => {
          h.write(h.group().id, { placeholder: "Placeholder" });
          h.workspace.execute(
            setFields({
              targets: [h.workspace.positionOfRecord(h.group().id)!.target],
              props: {
                value: filled ? { kind: "set", value } : { kind: "remove" },
              },
            }),
          );
        });
        await h.render();
        const input = h.host.querySelector<HTMLInputElement>(
          "input:not([type=hidden]),textarea",
        )!;
        const shape = canvasText(h, "Input", "light");
        expect(shape.text).toBe(input.value || input.placeholder);
        expect(shape.color).toBe(
          filled ? palettes.light.value : palettes.light.placeholder,
        );
      }
    } finally {
      await h.dispose();
    }
  },
);

// Prefix is a real editable Text slot; SearchField uses its search icon instead.
it.each(types.filter((type) => type !== "SearchField"))(
  "%s: prefix shares the S2 gray-600 token",
  async (type) => {
    const h = await fixture(type, "M");
    theme("light");
    try {
      await act(async () => {
        h.workspace.execute(
          catalogFieldPrefixCommand({
            field: nodePosition(
              h.workspace.runtime.graph,
              "project:node:selection",
            ),
            kind: "text",
            newId: h.workspace.newId,
          }),
        );
      });
      await h.render();
      const prefix = h.host.querySelector('[slot="prefix"]')!;
      expect(getComputedStyle(prefix).color).toBe(
        rgb(palettes.light.placeholder),
      );
      const node = [...h.root.domInputs.values()].find(
        (n) => n.props.slot === "prefix",
      )!;
      expect(node.visual.color).toBe(palettes.light.placeholder);
    } finally {
      await h.dispose();
    }
  },
);
it.each(types)(
  "%s: hint edits survive save/load and reset to defaults",
  async (type) => {
    const h = await fixture(type, "M");
    theme("light");
    let loaded: CatalogWorkspace | undefined;
    try {
      await act(async () => {
        h.write(h.group().id, {
          description: "Help text",
          errorMessage: "Invalid text",
          isInvalid: true,
          isDisabled: true,
        });
      });
      const error = [...h.root.domInputs.values()].find(
        (n) => h.root.typeOf(n) === "FieldError",
      )!;
      await act(async () => {
        h.workspace.execute(
          setFields({
            targets: [h.workspace.positionOfRecord(error.id)!.target],
            visual: {
              color: { kind: "set", value: "#008866" },
              fontSize: { kind: "set", value: 21 },
            },
          }),
        );
      });
      await h.render();
      expect(
        getComputedStyle(h.host.querySelector(".react-aria-FieldError")!).color,
      ).toBe(rgb("#008866"));
      expect(
        getComputedStyle(h.host.querySelector(".react-aria-FieldError")!)
          .fontSize,
      ).toBe("21px");
      expect(canvasText(h, "FieldError", "light").color).toBe("#008866");
      await h.workspace.autosave.retry();
      expect(h.workspace.autosave.getSnapshot().state).toBe("saved");
      loaded = new CatalogWorkspace(
        new CatalogGraph(
          await h.storage.load(h.workspace.runtime.graph.projectId, library),
          library,
        ),
        h.storage,
        {
          engine: createLayoutEngine(),
          viewport: { width: 1000, height: 800 },
          autosaveSchedule() {},
        },
      );
      const restored = loaded.root.domInputs.get(error.id)!;
      expect(restored.visual.fontSize).toBe(21);
      expect(
        canvasText({ ...h, root: loaded.root }, "FieldError", "light").color,
      ).toBe("#008866");
      await h.render(loaded.root);
      const reloaded = h.host.querySelector(".react-aria-FieldError")!;
      expect(getComputedStyle(reloaded).color).toBe(rgb("#008866"));
      expect(getComputedStyle(reloaded).fontSize).toBe("21px");
      await act(async () => {
        h.workspace.execute(
          setFields({
            targets: [h.workspace.positionOfRecord(error.id)!.target],
            visual: { color: { kind: "remove" }, fontSize: { kind: "remove" } },
          }),
        );
      });
      await h.render();
      const reset = h.host.querySelector(".react-aria-FieldError")!;
      expect(getComputedStyle(reset).fontSize).toBe("14px");
      expect(getComputedStyle(reset).color).toBe(rgb(palettes.light.disabled));
      expect(canvasText(h, "FieldError", "light").color).toBe(
        palettes.light.disabled,
      );
    } finally {
      loaded?.dispose();
      await h.dispose();
    }
  },
);

// Other FieldLabel/HelpText consumers share the editable origin defaults.
it.each([
  "Select",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "CheckboxGroup",
  "RadioGroup",
])("%s: shared hint and label typography", async (type) => {
  const h = await fixture(type, "M");
  theme("light");
  try {
    await act(async () => {
      h.write(h.group().id, {
        description: "Help text",
        errorMessage: "Invalid text",
      });
    });
    for (const isInvalid of [false, true]) {
      await act(async () => {
        h.write(h.group().id, { isInvalid });
      });
      await h.render();
      const hint = h.host.querySelector(
        isInvalid ? ".react-aria-FieldError" : '[slot="description"]',
      )!;
      expect(getComputedStyle(hint).fontSize).toBe("14px");
      expect(
        getComputedStyle(h.host.querySelector(".react-aria-Label")!).fontWeight,
      ).toBe("400");
      expect(getComputedStyle(hint).color).toBe(
        rgb(isInvalid ? palettes.light.error : palettes.light.label),
      );
    }
  } finally {
    await h.dispose();
  }
});

// Label-only consumers do not expose the field's hint props.
it.each(["Slider", "ProgressBar", "Meter"])(
  "%s: Label shares the regular font default",
  async (type) => {
    const h = await fixture(type, "M");
    theme("light");
    try {
      await h.render();
      expect(
        getComputedStyle(h.host.querySelector(".react-aria-Label")!).fontWeight,
      ).toBe("400");
      expect(canvasText(h, "Label", "light").fontWeight).toBe(400);
    } finally {
      await h.dispose();
    }
  },
);

it("ComboBox authored selection text uses value paint", async () => {
  const h = await fixture("ComboBox", "M");
  theme("light");
  try {
    const option = [...h.root.domInputs.values()].find(
      (n) => h.root.typeOf(n) === "ListBoxItem",
    )!;
    await act(async () => {
      h.write(option.id, { isSelected: true });
    });
    await h.render();
    const input = h.host.querySelector<HTMLInputElement>(
      'input[role="combobox"]',
    )!;
    expect(input.value).not.toBe("");
    expect(canvasText(h, "Input", "light").text).toBe(input.value);
    expect(canvasText(h, "Input", "light").color).toBe(palettes.light.value);
    const label = option.children
      .map((id) => h.root.domInputs.get(id)!)
      .find((n) => n.props.slot === "label")!;
    await act(async () => {
      h.write(label.id, { children: "Edited option" });
    });
    await h.render();
    expect(canvasText(h, "Input", "light").text).toBe("Edited option");
    expect(
      h.host.querySelector<HTMLInputElement>('input[role="combobox"]')!.value,
    ).toBe("Edited option");
    await act(async () => {
      h.write(option.id, { isSelected: false });
    });
    await h.render();
    expect(
      h.host.querySelector<HTMLInputElement>('input[role="combobox"]')!.value,
    ).toBe("");
    expect(canvasText(h, "Input", "light").color).toBe(
      palettes.light.placeholder,
    );
  } finally {
    await h.dispose();
  }
});

it.each(types)(
  "%s: Library Label weight propagates and resets",
  async (type) => {
    const h = await fixture(type, "M");
    theme("light");
    try {
      for (const custom of [true, false]) {
        await act(async () => {
          h.workspace.execute(
            setLibraryDefault({
              definitionId: "lib:definition:origin-component-label",
              scope: "visual",
              key: "fontWeight",
              write: custom ? { kind: "set", value: 700 } : { kind: "remove" },
              newId: h.workspace.newId,
            }),
          );
        });
        await h.render();
        expect(
          getComputedStyle(h.host.querySelector(".react-aria-Label")!)
            .fontWeight,
        ).toBe(custom ? "700" : "400");
        expect(canvasText(h, "Label", "light").fontWeight).toBe(
          custom ? 700 : 400,
        );
      }
    } finally {
      await h.dispose();
    }
  },
);

it.each(["TextField", "Select", "CheckboxGroup"])(
  "%s: necessity accessibility name follows S2 field policy",
  async (type) => {
    const h = await fixture(type, "M");
    try {
      for (const necessityIndicator of ["icon", "label"]) {
        for (const isRequired of [true, false, true]) {
          await act(async () =>
            h.write(h.group().id, { necessityIndicator, isRequired }),
          );
          await h.render();
          const part = [...h.root.domInputs.values()].find(
            (n) =>
              n.props.slot ===
              (necessityIndicator === "icon"
                ? "necessity-icon"
                : "necessity-label"),
          )!;
          const indicator = h.host.querySelector(
            `[data-catalog-id="${part.id}"]`,
          );
          if (necessityIndicator === "icon" && !isRequired) {
            expect(indicator).toBeNull();
            continue;
          }
          expect(indicator).not.toBeNull();
          const include = type === "Select" || type === "CheckboxGroup";
          expect(indicator!.getAttribute("aria-hidden")).toBe(
            necessityIndicator === "icon"
              ? String(!include)
              : !include && isRequired
                ? "true"
                : null,
          );
          expect(indicator!.getAttribute("aria-label")).toBe(
            include && necessityIndicator === "icon" ? "(required)" : null,
          );
          const target = h.host.querySelector<HTMLElement>(
            type === "Select"
              ? "button"
              : type === "CheckboxGroup"
                ? '[role="group"]'
                : "input",
          )!;
          const suffix =
            include && isRequired
              ? "(required)"
              : necessityIndicator === "label" && !isRequired
                ? "(optional)"
                : "";
          const name = `${h.group().props.label}${suffix ? " " + suffix : ""}`;
          // RAC Select는 선택값도 이름에 포함하므로 라벨 부분을 검증한다.
          const expectedName = new RegExp(
            (type === "Select" ? "" : "^") +
              name
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                .replace(/ /g, "\\s+") +
              "$",
          );
          await expect.element(target).toHaveAccessibleName(expectedName);
        }
      }
    } finally {
      await h.dispose();
    }
  },
);

it.each(["S", "M", "L", "XL"] as const)(
  "Asterisk %s: editable Icon shares installed S2 paths with Canvas",
  async (size) => {
    const h = await fixture("Icon", size);
    const oracleHost = document.body.appendChild(document.createElement("div"));
    const oracle = createRoot(oracleHost);
    let loaded: CatalogWorkspace | undefined;
    try {
      await act(async () => {
        h.write(h.group().id, { iconName: "s2-asterisk" });
        oracle.render(
          createElement(SpectrumSearchField, {
            label: "Search",
            isRequired: true,
            size,
          }),
        );
      });
      await h.render();
      const svg = h.host.querySelector("svg")!;
      const reference = oracleHost.querySelector("label svg")!;
      expect(reference).not.toBeNull();
      expect(svg.getAttribute("viewBox")).toBe(
        reference.getAttribute("viewBox"),
      );
      expect(
        [...svg.querySelectorAll("path")].map((p) => p.getAttribute("d")),
      ).toEqual(
        [...reference.querySelectorAll("path")].map((p) => p.getAttribute("d")),
      );
      const data = catalogCanvasNodeData(h.root, h.group().id).iconPath!;
      expect(data.filled).toBe(true);
      expect(data.paths).toEqual(
        getIconData("s2-asterisk", "lucide", size)!.paths,
      );
      await act(async () =>
        h.workspace.execute(
          setFields({
            targets: [h.workspace.positionOfRecord(h.group().id)!.target],
            visual: {
              fontSize: { kind: "set", value: 23 },
              color: { kind: "set", value: "#008866" },
            },
          }),
        ),
      );
      await h.render();
      expect(h.host.querySelector("svg")!.getBoundingClientRect().width).toBe(
        23,
      );
      expect(getComputedStyle(h.host.querySelector("svg")!).color).toBe(
        "rgb(0, 136, 102)",
      );
      expect(
        catalogCanvasNodeData(h.root, h.group().id).iconPath!.paths,
      ).toEqual(data.paths);
      await act(async () => h.workspace.undo());
      await h.render();
      expect(h.host.querySelector("svg")!.getAttribute("viewBox")).toBe(
        reference.getAttribute("viewBox"),
      );
      await act(async () => h.workspace.redo());
      await h.render();
      expect(h.host.querySelector("svg")!.getBoundingClientRect().width).toBe(
        23,
      );
      await h.workspace.autosave.retry();
      expect(h.workspace.autosave.getSnapshot().state).toBe("saved");
      loaded = new CatalogWorkspace(
        new CatalogGraph(
          await h.storage.load(h.workspace.runtime.graph.projectId, library),
          library,
        ),
        h.storage,
        {
          engine: createLayoutEngine(),
          viewport: { width: 1000, height: 800 },
          autosaveSchedule() {},
        },
      );
      await h.render(loaded.root);
      expect(h.host.querySelector("svg")!.getBoundingClientRect().width).toBe(
        23,
      );
      expect(getComputedStyle(h.host.querySelector("svg")!).color).toBe(
        "rgb(0, 136, 102)",
      );
      expect(
        catalogCanvasNodeData(loaded.root, h.group().id).iconPath!.paths,
      ).toEqual(data.paths);
    } finally {
      loaded?.dispose();
      await act(async () => oracle.unmount());
      oracleHost.remove();
      await h.dispose();
    }
  },
);

it.each(necessityFieldTypes)(
  "%s: actual Label parts follow state and empty labels",
  async (type) => {
    const h = await fixture(type, "M");
    try {
      const parts = [...h.root.domInputs.values()].filter((n) =>
        [
          "label-content",
          "necessity-icon",
          "necessity-label",
          "necessity-space",
        ].includes(String(n.props.slot)),
      );
      expect(parts).toHaveLength(4);
      const label = h.root.domInputs.get(parts[0].parentId)!;
      expect(label.children).toHaveLength(4);
      for (const necessityIndicator of ["icon", "label"]) {
        for (const isRequired of [false, true, false]) {
          await act(async () =>
            h.write(h.group().id, {
              label: "Field title",
              necessityIndicator,
              isRequired,
            }),
          );
          await h.render();
          const visible = (role: string) => {
            const part = parts.find((n) => n.props.slot === role)!;
            const expected =
              role === "label-content" ||
              (role === "necessity-icon"
                ? necessityIndicator === "icon" && isRequired
                : role === "necessity-label"
                  ? necessityIndicator === "label"
                  : necessityIndicator === "label" || isRequired);
            expect(h.root.layoutInputs.get(part.id)?.hidden === true).toBe(
              !expected,
            );
            expect(
              h.host.querySelector(`[data-catalog-id="${part.id}"]`) !== null,
            ).toBe(expected);
          };
          for (const part of parts) visible(String(part.props.slot));
          const body = h.host.querySelector(
            `[data-catalog-id="${parts[0].id}"]`,
          )!;
          expect(body.textContent!.trim()).toBe("Field title");
          await act(async () => h.write(h.group().id, { label: "" }));
          await h.render();
          expect(
            h.host.querySelector(`[data-catalog-id="${label.id}"]`),
          ).toBeNull();
          expect(h.root.layoutInputs.get(label.id)?.hidden).toBe(true);
        }
      }
    } finally {
      await h.dispose();
    }
  },
);

it.each(["S", "M", "L", "XL"] as const)(
  "SearchField %s: composed necessity matches S2 label geometry",
  async (size) => {
    const h = await fixture("SearchField", size, "light", undefined, true);
    const host = document.body.appendChild(document.createElement("div"));
    host.style.setProperty("--s2-scale", "1");
    host.style.setProperty("--s2-font-size-base", "14");
    const oracle = createRoot(host);
    try {
      await act(async () => {
        h.write(h.group().id, { label: "Field title", isRequired: true });
        oracle.render(
          createElement(SpectrumSearchField, {
            label: "Field title",
            isRequired: true,
            size,
          }),
        );
      });
      await h.render();
      const label = h.host.querySelector("label")!;
      const ref = host.querySelector("label")!;
      const icon = label.querySelector("svg")!;
      const refIcon = ref.querySelector("svg")!;
      const record = [...h.root.domInputs.values()].find(
        (n) => n.props.slot === "necessity-icon",
      )!;
      const canvas = h.root.getGeometry([record.id, record.parentId]);
      expect(
        record.layout.marginTop,
        JSON.stringify({
          parent: h.root.domInputs.get(record.parentId)?.props,
          rules: library.definitions.get("lib:definition:type-Label")
            ?.partRules,
        }),
      ).toBeUndefined(); // Inline baseline replaces the former flex centring margin.
      expect(icon.getAttribute("viewBox")).toBe(
        refIcon.getAttribute("viewBox"),
      );
      expect(icon.querySelector("path")!.getAttribute("d")).toBe(
        refIcon.querySelector("path")!.getAttribute("d"),
      );
      expect(icon.getBoundingClientRect().width).toBe(
        refIcon.getBoundingClientRect().width,
      );
      expect(canvas.get(record.id)!.width).toBe(
        refIcon.getBoundingClientRect().width,
      );
      const fieldRect = h.root.getGeometry([h.group().id]).get(h.group().id)!;
      expect(canvas.get(record.id)!.y - fieldRect.y).toBeCloseTo(
        refIcon.getBoundingClientRect().top -
          host.firstElementChild!.getBoundingClientRect().top,
        0,
      );
      expect(label.textContent!.trim()).toBe("Field title");
      expect(getComputedStyle(label).fontSize).toBe(
        getComputedStyle(ref).fontSize,
      );
      expect(
        icon.getBoundingClientRect().left - label.getBoundingClientRect().left,
      ).toBeCloseTo(
        refIcon.getBoundingClientRect().left - ref.getBoundingClientRect().left,
        0,
      );
      expect(
        icon.getBoundingClientRect().top -
          h.host
            .querySelector(".react-aria-SearchField")!
            .getBoundingClientRect().top,
      ).toBeCloseTo(
        refIcon.getBoundingClientRect().top -
          host.firstElementChild!.getBoundingClientRect().top,
        0,
      );
    } finally {
      await act(async () => oracle.unmount());
      host.remove();
      await h.dispose();
    }
  },
);

it.each(necessityFieldTypes)(
  "%s: CJK Label line height matches S2 at every size",
  async (type) => {
    const h = await fixture(type, "M", "light", "ko-KR");
    const host = document.body.appendChild(document.createElement("div"));
    host.lang = "ko-KR";
    host.style.setProperty("--s2-scale", "1");
    host.style.setProperty("--s2-font-size-base", "14");
    const oracle = createRoot(host);
    try {
      for (const size of ["S", "M", "L", "XL"] as const) {
        await act(async () => {
          h.write(h.group().id, { label: "이름", isRequired: true, size });
          oracle.render(
            createElement(I18nProvider, {
              locale: "ko-KR",
              children: createElement(SpectrumSearchField, {
                label: "이름",
                size,
                isRequired: true,
              }),
            }),
          );
        });
        await h.render();
        const label = [...h.root.domInputs.values()].find(
          (n) => h.root.typeOf(n) === "Label",
        )!;
        const body = [...h.root.domInputs.values()].find(
          (n) => n.props.slot === "label-content",
        )!;
        const expected = getComputedStyle(
          host.querySelector("label")!,
        ).lineHeight;
        expect(
          getComputedStyle(h.host.querySelector(".react-aria-Label")!)
            .lineHeight,
        ).toBe(expected);
        expect(
          getComputedStyle(h.host.querySelector('[slot="label-content"]')!)
            .lineHeight,
        ).toBe(expected);
        expect(label.visual.lineHeight).toBe(1.5);
        expect(body.derivedProps?.lineHeight).toBe(1.5);
        const canvas = canvasText(h, "Label", "light");
        expect(canvas.lineHeight! * canvas.fontSize).toBeCloseTo(
          Number.parseFloat(expected),
          5,
        );
        expect(
          (
            catalogCanvasNodeData(h.root, body.id).text ??
            catalogCanvasNodeData(h.root, body.id).children?.[0]?.text
          )?.lineHeight,
        ).toBeCloseTo(Number.parseFloat(expected), 5);
      }
    } finally {
      await act(async () => oracle.unmount());
      host.remove();
      await h.dispose();
    }
  },
);

it("SearchField: CJK Label explicit styles and Library defaults survive Reset and Undo/Redo", async () => {
  const h = await fixture("SearchField", "M", "light", "ko-KR");
  try {
    const label = () =>
      [...h.root.domInputs.values()].find((n) => h.root.typeOf(n) === "Label")!;
    const body = () =>
      [...h.root.domInputs.values()].find(
        (n) => n.props.slot === "label-content",
      )!;
    const write = (id: string, value?: number) =>
      h.workspace.execute(
        setFields({
          targets: [h.workspace.positionOfRecord(id)!.target],
          visual: {
            lineHeight:
              value === undefined ? { kind: "remove" } : { kind: "set", value },
          },
        }),
      );
    const check = async (ratio: number, partRatio = ratio) => {
      await h.render();
      expect(label().visual.lineHeight).toBeCloseTo(ratio, 6);
      expect(
        body().derivedProps?.lineHeight ?? body().visual.lineHeight,
      ).toBeCloseTo(partRatio, 6);
      expect(
        Number.parseFloat(
          getComputedStyle(h.host.querySelector('[slot="label-content"]')!)
            .lineHeight,
        ),
      ).toBeCloseTo(14 * partRatio, 3);
    };
    await check(1.5);
    expect(catalogAuthoredVisual(h.root, label()).lineHeight).toBeUndefined();
    await act(async () => write(label().id, 18 / 14));
    await check(18 / 14);
    expect(catalogHasExplicitVisual(h.root, label(), "lineHeight")).toBe(true);
    await act(async () => h.workspace.undo());
    await check(1.5);
    await act(async () => h.workspace.redo());
    await check(18 / 14);
    await act(async () => write(label().id));
    await check(1.5);
    await act(async () => write(body().id, 2));
    await check(1.5, 2);
    await act(async () => write(body().id));
    await check(1.5);
    for (const custom of [true, false]) {
      await act(async () =>
        h.workspace.execute(
          setLibraryDefault({
            definitionId: "lib:definition:origin-component-label",
            scope: "visual",
            key: "lineHeight",
            write: custom ? { kind: "set", value: 2 } : { kind: "remove" },
            newId: h.workspace.newId,
          }),
        ),
      );
      await check(custom ? 2 : 1.5);
    }
  } finally {
    await h.dispose();
  }
});

it.each(["ja-JP", "zh-CN", "zh-Hant-TW", "en-US"])(
  "SearchField: %s Label locale follows site changes and Undo",
  async (locale) => {
    const h = await fixture("SearchField", "M", "light", "en-US");
    try {
      const label = () =>
        [...h.root.domInputs.values()].find(
          (n) => h.root.typeOf(n) === "Label",
        )!;
      await act(async () =>
        h.workspace.execute(setSiteSettings({ patch: { lang: locale } })),
      );
      await h.render();
      expect(label().visual.lineHeight).toBeCloseTo(
        locale === "en-US" ? 18 / 14 : 1.5,
        6,
      );
      await act(async () => h.workspace.undo());
      await h.render();
      expect(label().visual.lineHeight).toBeCloseTo(18 / 14, 6);
      await act(async () => h.workspace.redo());
      await h.render();
      expect(label().visual.lineHeight).toBeCloseTo(
        locale === "en-US" ? 18 / 14 : 1.5,
        6,
      );
    } finally {
      await h.dispose();
    }
  },
);

it.each([18, 28])(
  "SearchField: explicit Theme line height %ipx wins over the CJK default",
  async (line) => {
    const definition = createThemeDefinition(
      "label-line",
      "Label line",
      undefined,
      {
        "typography.text-sm--line-height": {
          type: "number",
          value: line,
          source: "spec-token",
        },
      },
    );
    const snapshot = resolveThemeSnapshot(definition, {
      baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
    });
    installThemeMaps(snapshot);
    applyCatalogPreviewTheme({
      key: "label-line",
      colorMode: "light",
      install() {},
      snapshot: () => snapshot,
    });
    const h = await fixture("SearchField", "M", "light", "ko-KR");
    try {
      await h.render();
      const label = [...h.root.domInputs.values()].find(
        (n) => h.root.typeOf(n) === "Label",
      )!;
      expect(label.visual.lineHeight).toBeCloseTo(line / 14, 6);
      expect(
        Number.parseFloat(
          getComputedStyle(h.host.querySelector('[slot="label-content"]')!)
            .lineHeight,
        ),
      ).toBeCloseTo(line, 3);
    } finally {
      await h.dispose();
      installThemeMaps(null);
    }
  },
);

it.each(necessityFieldTypes)(
  "%s: necessity text stays unbroken and explicit wrapping can be reset",
  async (type) => {
    const h = await fixture(type, "M");
    const part = () =>
      [...h.root.domInputs.values()].find(
        (n) => n.props.slot === "necessity-label",
      )!;
    const target = () => h.workspace.positionOfRecord(part().id)!.target;
    try {
      await act(async () => {
        h.write(h.group().id, {
          label: "A longer field title to wrap",
          isRequired: true,
          necessityIndicator: "label",
        });
        h.write(part().id, { children: "This field is required" });
        h.workspace.execute(
          setFields({
            targets: [h.workspace.positionOfRecord(h.group().id)!.target],
            visual: { width: { kind: "set", value: 160 } },
          }),
        );
      });
      await h.render();
      const element = () =>
        h.host.querySelector(`[data-catalog-id="${part().id}"]`)!;
      expect(getComputedStyle(element()).whiteSpace).toBe("nowrap");
      expect(h.root.getLayoutInput(part().id)!.flexShrink).toBe(0);
      expect(part().visual.whiteSpace).toBe("nowrap");
      const range = document.createRange();
      range.selectNodeContents(element());
      expect(range.getClientRects()).toHaveLength(1);
      await act(async () =>
        h.workspace.execute(
          setFields({
            targets: [target()],
            visual: {
              whiteSpace: { kind: "set", value: "normal" },
            },
          }),
        ),
      );
      // Inline text wraps at its containing field; width on an inline span is ignored by CSS.
      await act(async () =>
        h.workspace.execute(
          setFields({
            targets: [h.workspace.positionOfRecord(h.group().id)!.target],
            visual: { width: { kind: "set", value: 48 } },
          }),
        ),
      );
      await h.render();
      expect(getComputedStyle(element()).whiteSpace).toBe("normal");
      range.selectNodeContents(element());
      expect(range.getClientRects().length).toBeGreaterThan(1);
      await act(async () =>
        h.workspace.execute(
          setFields({
            targets: [target()],
            visual: {
              width: { kind: "remove" },
              whiteSpace: { kind: "remove" },
            },
          }),
        ),
      );
      await h.render();
      expect(getComputedStyle(element()).whiteSpace).toBe("nowrap");
      expect(part().visual.whiteSpace).toBe("nowrap");
    } finally {
      await h.dispose();
    }
  },
);

it("SearchField: necessity child styles, text, reset and persistence remain editable", async () => {
  const h = await fixture("SearchField", "M");
  let loaded: CatalogWorkspace | undefined;
  const part = (slot: string) =>
    [...h.root.domInputs.values()].find((n) => n.props.slot === slot)!;
  const edit = (slot: string, remove = false) =>
    h.workspace.execute(
      setFields({
        targets: [h.workspace.positionOfRecord(part(slot).id)!.target],
        visual: {
          fontSize: remove ? { kind: "remove" } : { kind: "set", value: 23 },
          color: remove
            ? { kind: "remove" }
            : { kind: "set", value: "#008866" },
        },
      }),
    );
  const check = async (custom: boolean, root = h.root) => {
    await h.render(root);
    const icon = h.host.querySelector(
      `[data-catalog-id="${part("necessity-icon").id}"] svg`,
    )!;
    expect(icon.getBoundingClientRect().width).toBe(custom ? 23 : 8);
    expect(
      root
        .getGeometry([part("necessity-icon").id])
        .get(part("necessity-icon").id)!.width,
    ).toBe(custom ? 23 : 8);
    if (custom) expect(getComputedStyle(icon).color).toBe("rgb(0, 136, 102)");
  };
  try {
    await act(async () => h.write(h.group().id, { isRequired: true }));
    await check(false);
    await act(async () => edit("necessity-icon"));
    await check(true);
    await act(async () => h.workspace.undo());
    await check(false);
    await act(async () => h.workspace.redo());
    await check(true);
    await h.workspace.autosave.retry();
    loaded = new CatalogWorkspace(
      new CatalogGraph(
        await h.storage.load(h.workspace.runtime.graph.projectId, library),
        library,
      ),
      h.storage,
      {
        engine: createLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule() {},
      },
    );
    await check(true, loaded.root);
    await act(async () => edit("necessity-icon", true));
    await check(false);
    await act(async () =>
      h.write(h.group().id, { necessityIndicator: "label" }),
    );
    await act(async () =>
      h.write(part("necessity-label").id, { children: "Custom requirement" }),
    );
    await h.render();
    expect(
      h.host.querySelector(`[data-catalog-id="${part("necessity-label").id}"]`)!
        .textContent,
    ).toBe("Custom requirement");
    await act(async () => h.write(h.group().id, { isRequired: false }));
    await h.render();
    expect(
      h.host.querySelector(`[data-catalog-id="${part("necessity-label").id}"]`)!
        .textContent,
    ).toBe("Custom requirement");
  } finally {
    loaded?.dispose();
    await h.dispose();
  }
});

it("SearchField: necessity text follows environment locale", async () => {
  const h = await fixture("SearchField", "M", "light", "ko-KR");
  try {
    for (const isRequired of [true, false]) {
      await act(async () =>
        h.write(h.group().id, { necessityIndicator: "label", isRequired }),
      );
      await h.render();
      const part = [...h.root.domInputs.values()].find(
        (n) => n.props.slot === "necessity-label",
      )!;
      expect(part.derivedProps?.children).toBe(
        isRequired ? "(필수 사항)" : "(선택 사항)",
      );
      expect(
        h.host.querySelector(`[data-catalog-id="${part.id}"]`)!.textContent,
      ).toBe(part.derivedProps?.children);
    }
  } finally {
    await h.dispose();
  }
});

it("Form: necessity mode inheritance and explicit child choice survive reset", async () => {
  const h = await fixture("Form", "M");
  try {
    await act(async () =>
      h.workspace.execute(
        insertNodes({
          parent: { kind: "node", id: "project:node:selection" },
          entries: [
            {
              kind: "node",
              id: "project:node:inside",
              definitionId: catalogPaletteDefinitionId(library, "SearchField"),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: ["project:node:inside"],
          newId: h.workspace.newId,
        }),
      ),
    );
    const field = () =>
      [...h.root.domInputs.values()].find(
        (n) => h.root.typeOf(n) === "SearchField",
      )!;
    const mode = () =>
      [...h.root.domInputs.values()].find(
        (n) =>
          n.props.slot === "necessity-label" &&
          n.id.includes("project:node:inside"),
      )!;
    await act(async () =>
      h.write(h.group().id, { necessityIndicator: "label" }),
    );
    await h.render();
    expect(h.root.layoutInputs.get(mode().id)?.hidden).not.toBe(true);
    await act(async () => h.write(field().id, { necessityIndicator: "icon" }));
    await h.render();
    expect(h.root.layoutInputs.get(mode().id)?.hidden).toBe(true);
    await act(async () =>
      h.workspace.execute(
        setFields({
          targets: [h.workspace.positionOfRecord(field().id)!.target],
          props: { necessityIndicator: { kind: "remove" } },
        }),
      ),
    );
    await h.render();
    expect(h.root.layoutInputs.get(mode().id)?.hidden).not.toBe(true);
  } finally {
    await h.dispose();
  }
});

it("SearchField: Code View preserves necessity child overrides", async () => {
  const h = await fixture("SearchField", "M");
  try {
    const part = [...h.root.domInputs.values()].find(
      (n) => n.props.slot === "necessity-icon",
    )!;
    await act(async () =>
      h.workspace.execute(
        setFields({
          targets: [h.workspace.positionOfRecord(part.id)!.target],
          visual: { color: { kind: "set", value: "#008866" } },
        }),
      ),
    );
    const output = catalogCodeView(
      h.workspace.runtime.graph,
      "project:page:home",
      { collections: [], endpoints: [] },
    );
    expect(output).not.toBeNull();
    const reader = h.workspace.runtime.graph;
    const file = codeViewFileTree(reader).find(
      (file) => file.kind === "pageStyle" && file.id === "project:page:home",
    )!;
    const css = generateCodeViewFile({
      reader,
      file,
      collections: [],
      endpoints: [],
    });
    expect(css.code).toContain("#008866");
  } finally {
    await h.dispose();
  }
});

it("SearchField: deleting a necessity child does not inject a replacement", async () => {
  const h = await fixture("SearchField", "M");
  try {
    await act(async () => h.write(h.group().id, { isRequired: true }));
    const icon = [...h.root.domInputs.values()].find(
      (n) => n.props.slot === "necessity-icon",
    )!;
    await act(async () =>
      h.workspace.execute(
        removeTargets({
          targets: [h.workspace.positionOfRecord(icon.id)!.target],
        }),
      ),
    );
    await h.render();
    const label = h.host.querySelector("label")!;
    expect(label.querySelector("svg")).toBeNull();
    expect(label.querySelector(".necessity-indicator")).toBeNull();
    await act(async () => h.workspace.undo());
    await h.render();
    expect(h.host.querySelector("label svg")).not.toBeNull();
  } finally {
    await h.dispose();
  }
});

it("SearchField: body text runs retain necessity spacing and undo restores the binding", async () => {
  const h = await fixture("SearchField", "M");
  try {
    await act(async () => h.write(h.group().id, { isRequired: true }));
    const body = [...h.root.domInputs.values()].find(
      (n) => n.props.slot === "label-content",
    )!;
    await act(async () =>
      h.workspace.execute(
        setFields({
          targets: [h.workspace.positionOfRecord(body.id)!.target],
          props: {
            children: {
              kind: "set",
              value: {
                kind: "text",
                runs: [
                  { text: "Custom", marks: { fontWeight: 700 } },
                  { text: " title" },
                ],
              },
            },
          },
        }),
      ),
    );
    await h.render();
    expect(
      h.host.querySelector(`[data-catalog-id="${body.id}"]`)!.textContent,
    ).toBe("Custom title");
    expect(h.root.domInputs.get(body.id)!.derivedProps?.children).toBe(
      "Custom title",
    );
    expect(h.host.querySelector('[slot="necessity-space"]')!.textContent).toBe(
      "\u00a0",
    );
    await act(async () => h.workspace.undo());
    await h.render();
    expect(
      h.host.querySelector(`[data-catalog-id="${body.id}"]`)!.textContent,
    ).toBe("Search");
  } finally {
    await h.dispose();
  }
});
