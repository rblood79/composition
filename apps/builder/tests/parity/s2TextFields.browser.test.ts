import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import {
  insertNodes,
  setFields,
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
  catalogRuleShapes,
  catalogRuleNodeData,
} from "@/builder/catalogRuntime/ruleShapes";

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
async function fixture(type: string, size: string) {
  const owner = type;
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:selection",
        name: "Selection",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `selection-${Math.random()}`),
    {
      engine: createLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: (text, font) => ({
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
  const write = (id: string, props: Record<string, string | boolean>) =>
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
  const render = async () => {
    await act(async () => react.render(renderCatalogDom(root, group().id)));
  };
  return {
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

// Input의 공통 규칙을 소비하는 필드를 같은 상태·크기·테마로 검증한다.
const types = [
  "TextField",
  "TextArea",
  "SearchField",
  "NumberField",
  "ColorField",
  "ComboBox",
];
const colors = {
  light: {
    base: "#ffffff",
    border: "#dadada",
    hover: "#c6c6c6",
    focus: "#131313",
    invalid: "#d73220",
    invalidFocus: "#b72818",
    disabled: "#c6c6c6",
    label: "#505050",
  },
  dark: {
    base: "#111111",
    border: "#393939",
    hover: "#444444",
    focus: "#f2f2f2",
    invalid: "#fc432e",
    invalidFocus: "#ff6756",
    disabled: "#444444",
    label: "#afafaf",
  },
};
const cases = types.flatMap((type) =>
  (["light", "dark"] as const).flatMap((mode) =>
    ["S", "M", "L", "XL"].map((size) => ({ type, mode, size })),
  ),
);
it.each(cases)(
  "$type $mode $size: input states agree with Canvas",
  async ({ type, mode, size }) => {
    const h = await fixture(type, size);
    const snapshot = resolveThemeSnapshot(
      createThemeDefinition("fields", "Fields"),
      { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
    );
    installThemeMaps(snapshot);
    applyCatalogPreviewTheme({
      key: "fields",
      colorMode: mode,
      install() {},
      snapshot: () => snapshot,
    });
    const probe = document.body.appendChild(document.createElement("span"));
    const rgb = (hex: string) => {
      probe.style.color = hex;
      return getComputedStyle(probe).color;
    };
    const t = colors[mode];
    try {
      for (const scenario of [
        "default",
        "invalid",
        "disabled-invalid",
        "restored",
      ]) {
        const disabled = scenario === "disabled-invalid";
        const invalid = scenario.includes("invalid");
        await act(async () => {
          h.write(h.group().id, { isInvalid: invalid, isDisabled: disabled });
        });
        await h.render();
        const dom = h.host.querySelector<HTMLInputElement>(
          "input:not([type=hidden]),textarea",
        )!;
        expect(dom.disabled).toBe(disabled);
        expect(getComputedStyle(h.host.firstElementChild!).opacity).toBe("1");
        expect(
          getComputedStyle(h.host.querySelector(".react-aria-Label")!).color,
        ).toBe(rgb(disabled ? t.disabled : t.label));
        for (const state of [
          undefined,
          "hover",
          "pressed",
          "focusVisible",
        ] as const) {
          for (const attr of [
            "data-hovered",
            "data-pressed",
            "data-focused",
            "data-focus-visible",
          ])
            dom.removeAttribute(attr);
          if (state === "hover") dom.setAttribute("data-hovered", "");
          if (state === "pressed") dom.setAttribute("data-pressed", "");
          if (state === "focusVisible") {
            dom.setAttribute("data-focused", "");
            dom.setAttribute("data-focus-visible", "");
          }
          const expected = disabled
            ? t.disabled
            : invalid
              ? state
                ? t.invalidFocus
                : t.invalid
              : state === "focusVisible"
                ? t.focus
                : state
                  ? t.hover
                  : t.border;
          expect(getComputedStyle(dom).backgroundColor).toBe(rgb(t.base));
          expect(getComputedStyle(dom).borderTopWidth).toBe("2px");
          expect(
            getComputedStyle(dom).borderTopColor,
            scenario + ":" + state,
          ).toBe(rgb(expected));
          const node = h.field();
          const input = {
            type: "Input",
            rule: COMPONENT_RULES_TABLE.Input,
            node: { ...node, props: { ...node.props, ...node.derivedProps } },
            rect: { width: 208, height: 32 },
            theme: mode,
            state,
            authoredVisual: {},
          };
          const shapes = catalogRuleShapes(input);
          const border = shapes.find((s) => s.type === "border")!;
          const color = "color" in border ? String(border.color) : "";
          expect(
            color.startsWith("{")
              ? resolveToken(color as TokenRef, mode)
              : color,
            scenario + ":" + state,
          ).toBe(expected);
          if (state === "focusVisible") {
            const data = catalogRuleNodeData(input);
            expect(getComputedStyle(dom).outlineWidth).toBe("2px");
            expect(getComputedStyle(dom).outlineOffset).toBe("2px");
            expect(data.box?.outlineWidth).toBe(2);
            expect(data.box?.outlineOffset).toBe(2);
          }
        }
      }
    } finally {
      probe.remove();
      await h.dispose();
    }
  },
);
it.each(["TextField", "TextArea", "SearchField"])(
  "%s editable input, keyboard focus and readonly restoration",
  async (type) => {
    const h = await fixture(type, "M");
    try {
      await h.render();
      const input = () =>
        h.host.querySelector<HTMLInputElement>(
          "input:not([type=hidden]),textarea",
        )!;
      await act(async () => {
        await userEvent.click(input());
        await userEvent.keyboard("alpha");
      });
      expect(input().value).toBe("alpha");
      await act(async () => {
        h.write(h.group().id, { isReadOnly: true });
      });
      await h.render();
      expect(input().readOnly).toBe(true);
      expect(input().disabled).toBe(false);
      const before = input().value;
      await act(async () => {
        await userEvent.click(input());
        await userEvent.keyboard("x");
      });
      expect(input().value).toBe(before);
      await act(async () => {
        h.write(h.group().id, { isReadOnly: false });
      });
      await h.render();
      await act(async () => {
        await userEvent.click(input());
        await userEvent.keyboard("z");
      });
      expect(input().value).toContain("z");
      const sentinel = h.host.insertBefore(
        document.createElement("button"),
        h.host.firstChild,
      );
      sentinel.textContent = "Before";
      await act(async () => {
        await userEvent.click(sentinel);
        await userEvent.tab();
      });
      expect(document.activeElement).toBe(input());
      expect(input().hasAttribute("data-focus-visible")).toBe(true);
      expect(getComputedStyle(input()).outlineWidth).toBe("2px");
      sentinel.remove();
    } finally {
      await h.dispose();
    }
  },
);
it.each(types)(
  "%s authored border and background survive state changes and reset",
  async (type) => {
    const h = await fixture(type, "M");
    const snapshot = resolveThemeSnapshot(
      createThemeDefinition("fields", "Fields"),
      { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
    );
    installThemeMaps(snapshot);
    applyCatalogPreviewTheme({
      key: "fields",
      colorMode: "light",
      install() {},
      snapshot: () => snapshot,
    });
    try {
      for (const custom of [true, false]) {
        await act(async () => {
          h.workspace.execute(
            setFields({
              targets: [h.workspace.positionOfRecord(h.field().id)!.target],
              visual: {
                borderColor: custom
                  ? { kind: "set", value: "#008866" }
                  : { kind: "remove" },
                backgroundColor: custom
                  ? { kind: "set", value: "#ffeedd" }
                  : { kind: "remove" },
              },
            }),
          );
          h.write(h.group().id, { isInvalid: true, isDisabled: true });
        });
        await h.render();
        const dom = h.host.querySelector<HTMLInputElement>(
          "input:not([type=hidden]),textarea",
        )!;
        expect(getComputedStyle(dom).borderTopColor).toBe(
          custom ? "rgb(0, 136, 102)" : "rgb(198, 198, 198)",
        );
        expect(getComputedStyle(dom).backgroundColor).toBe(
          custom ? "rgb(255, 238, 221)" : "rgb(255, 255, 255)",
        );
        const node = h.field();
        const shapes = catalogRuleShapes({
          type: "Input",
          rule: COMPONENT_RULES_TABLE.Input,
          node: { ...node, props: { ...node.props, ...node.derivedProps } },
          rect: { width: 208, height: 32 },
          theme: "light",
          authoredVisual: custom
            ? { borderColor: "#008866", backgroundColor: "#ffeedd" }
            : {},
        });
        const border = shapes.find((s) => s.type === "border")!;
        const color = "color" in border ? String(border.color) : "";
        expect(
          color.startsWith("{")
            ? resolveToken(color as TokenRef, "light")
            : color,
        ).toBe(custom ? "#008866" : "#c6c6c6");
      }
    } finally {
      await h.dispose();
    }
  },
);

it.each([
  ["TextArea", "first line\nsecond line", "replacement"],
  ["ColorField", "#336699", "#112233"],
])(
  "%s authored value updates owner context and preserves native editing",
  async (type, value, replacement) => {
    const h = await fixture(type, "M");
    try {
      await h.render();
      const input = () =>
        h.host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          "input:not([type=hidden]),textarea",
        )!;
      expect(input().value).toBe("");
      h.write(h.group().id, { value });
      await h.render();
      expect(input().value.toLowerCase()).toBe(value.toLowerCase());
      expect(h.field().derivedProps?.value).toBe(value);
      await act(async () => {
        await userEvent.fill(input(), replacement);
        await userEvent.tab();
      });
      expect(input().value.toLowerCase()).toBe(replacement.toLowerCase());
      // Preview interactions stay in RAC runtime state, without authoring the child Input.
      expect(h.field().props.value).toBeUndefined();
      h.write(h.group().id, { value: "" });
      await h.render();
      expect(input().value).toBe("");
      expect(h.field().derivedProps?.value).toBe("");
    } finally {
      await h.dispose();
    }
  },
);

it.each(["DateField", "TimeField", "DatePicker", "DateRangePicker"])(
  "%s segment keyboard, readonly and validation state remain connected",
  async (type) => {
    const h = await fixture(type, "M");
    try {
      h.write(h.group().id, {
        placeholderValue: type === "TimeField" ? "10:30" : "2026-11-07",
        validationBehavior: "aria",
      });
      await h.render();
      const segment = () =>
        h.host.querySelector<HTMLElement>('[role="spinbutton"]')!;
      expect(segment()).not.toBeNull();
      await act(async () => {
        await userEvent.click(segment());
        await userEvent.keyboard("{ArrowUp}");
      });
      expect(segment().getAttribute("aria-valuenow")).not.toBeNull();
      const value = segment().textContent;
      h.write(h.group().id, { isReadOnly: true });
      await h.render();
      await act(async () => {
        await userEvent.click(segment());
        await userEvent.keyboard("{ArrowUp}");
      });
      expect(segment().textContent).toBe(value);
      h.write(h.group().id, {
        isReadOnly: false,
        isInvalid: true,
        errorMessage: "Check date or time",
      });
      await h.render();
      expect(h.host.querySelector("[data-invalid]")).not.toBeNull();
      expect(segment().getAttribute("aria-invalid")).toBe("true");
      expect(h.host.textContent).toContain("Check date or time");
    } finally {
      await h.dispose();
    }
  },
);
