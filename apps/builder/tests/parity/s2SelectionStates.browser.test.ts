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
const tones = {
  light: {
    base: "#ffffff",
    neutral: "#292929",
    active: "#131313",
    accent: "#3b63fb",
    accentActive: "#274dea",
    negative: "#d73220",
    negativeActive: "#b72818",
    disabled: "#c6c6c6",
    focus: "#4b75ff",
  },
  dark: {
    base: "#111111",
    neutral: "#dbdbdb",
    active: "#f2f2f2",
    accent: "#5681ff",
    accentActive: "#6995fe",
    negative: "#fc432e",
    negativeActive: "#ff6756",
    disabled: "#444444",
    focus: "#4069fd",
  },
};
const cases = (["Checkbox", "Radio", "Switch"] as const).flatMap((type) =>
  (["light", "dark"] as const).flatMap((mode) =>
    ["S", "M", "L", "XL"].map((size) => ({ type, mode, size })),
  ),
);
async function fixture(
  type: "Checkbox" | "Radio" | "Switch",
  size: string,
  grouped = false,
) {
  const owner =
    type === "Radio" ? "RadioGroup" : grouped ? "CheckboxGroup" : type;
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
    [...root.domInputs.values()].find((n) => root.typeOf(n) === type)!;
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
it.each(cases)(
  "$type $mode $size: actual catalog DOM and Canvas indicator states",
  async ({ type, mode, size }) => {
    const h = await fixture(type, size);
    const snapshot = resolveThemeSnapshot(
      createThemeDefinition("selection", "Selection"),
      { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
    );
    installThemeMaps(snapshot);
    applyCatalogPreviewTheme({
      key: "selection",
      colorMode: mode,
      install() {},
      snapshot: () => snapshot,
    });
    const probe = document.body.appendChild(document.createElement("span"));
    const rgb = (color: string) => {
      probe.style.color = color;
      return getComputedStyle(probe).color;
    };
    const resolved = (v: unknown) =>
      rgb(
        typeof v === "string" && v.startsWith("{")
          ? String(resolveToken(v as TokenRef, mode))
          : String(v),
      );
    const t = tones[mode];
    try {
      for (const scenario of [
        "off",
        "selected",
        "emphasized",
        "invalid",
        "disabled-invalid",
        "indeterminate",
      ]) {
        if (scenario === "indeterminate" && type !== "Checkbox") continue;
        const selected = scenario !== "off";
        const invalid = scenario.includes("invalid") && type !== "Switch";
        const disabled = scenario === "disabled-invalid";
        const emphasized = scenario === "emphasized";
        h.write(h.group().id, {
          isEmphasized: emphasized,
          isDisabled: disabled,
          ...(type === "Radio"
            ? {
                isInvalid: invalid,
                value: selected
                  ? String(h.field().props.value || h.field().id)
                  : "",
              }
            : {
                isSelected: selected && scenario !== "indeterminate",
                isInvalid: invalid,
                ...(type === "Checkbox"
                  ? { isIndeterminate: scenario === "indeterminate" }
                  : {}),
              }),
        });
        await h.render();
        const field = h.host.querySelector(`.react-aria-${type}`)!;
        const button = field.querySelector(`.react-aria-${type}Button`)!;
        const indicator = button.querySelector(
          type === "Checkbox" ? ".checkbox" : ".indicator",
        )!;
        expect(button.hasAttribute("data-emphasized")).toBe(emphasized);
        expect(button.hasAttribute("data-disabled")).toBe(disabled);
        expect(getComputedStyle(field).opacity).toBe("1");
        for (const state of [
          "default",
          "hover",
          "pressed",
          "focusVisible",
        ] as const) {
          for (const attr of [
            "data-hovered",
            "data-pressed",
            "data-focus-visible",
          ]) {
            button.removeAttribute(attr);
          }
          if (state !== "default") {
            button.setAttribute(
              state === "hover"
                ? "data-hovered"
                : state === "pressed"
                  ? "data-pressed"
                  : "data-focus-visible",
              "",
            );
          }
          const active = state !== "default";
          const selectedColor = disabled
            ? t.disabled
            : invalid
              ? active
                ? t.negativeActive
                : t.negative
              : emphasized
                ? active
                  ? t.accentActive
                  : t.accent
                : active
                  ? t.active
                  : t.neutral;
          const bg = type !== "Radio" && selected ? selectedColor : t.base;
          const border =
            type !== "Radio" && selected
              ? "transparent"
              : disabled
                ? t.disabled
                : invalid
                  ? active
                    ? t.negativeActive
                    : t.negative
                  : selected && emphasized
                    ? active
                      ? t.accentActive
                      : t.accent
                    : active
                      ? t.active
                      : t.neutral;
          const dom = getComputedStyle(indicator);
          expect(dom.backgroundColor, `${scenario}/${state} fill`).toBe(
            rgb(bg),
          );
          expect(
            getComputedStyle(button.querySelector(".react-aria-Label")!).color,
          ).toBe(rgb(disabled ? t.disabled : active ? t.active : t.neutral));
          expect(dom.borderTopColor, `${scenario}/${state} border`).toBe(
            rgb(border),
          );
          if (state === "focusVisible") {
            expect(dom.outlineColor).toBe(rgb(t.focus));
            expect(dom.outlineWidth).toBe("2px");
            expect(getComputedStyle(button).outlineStyle).toBe("none");
          }
          const node = h.field();
          const input = {
            type,
            rule: COMPONENT_RULES_TABLE[type],
            node: {
              ...node,
              props: {
                ...node.props,
                ...node.derivedProps,
              },
            },
            rect: {
              x: 0,
              y: 0,
              width: parseFloat(dom.width),
              height: parseFloat(dom.height),
            },
            theme: mode,
            authoredVisual: {},
            state: state === "default" ? undefined : state,
          };
          const shapes = catalogRuleShapes(input);
          const shape = shapes.find(
            (s) => s.type === "roundRect" || s.type === "circle",
          )!;
          expect(
            resolved("fill" in shape ? shape.fill : ""),
            `${scenario}/${state} Canvas`,
          ).toBe(rgb(type === "Radio" && selected ? border : bg));
          if (state === "focusVisible") {
            expect(catalogRuleNodeData(input).box?.outlineWidth).toBe(2);
          }
          if (type === "Switch") {
            const thumb = getComputedStyle(indicator, "::before");
            const expected = selected
              ? t.base
              : disabled
                ? t.disabled
                : active
                  ? t.active
                  : t.neutral;
            expect(thumb.backgroundColor).toBe(rgb(expected));
          }
        }
      }
    } finally {
      probe.remove();
      await h.dispose();
    }
  },
);
it.each(["Checkbox", "Radio", "Switch"] as const)(
  "%s native keyboard selection and focus",
  async (type) => {
    const h = await fixture(type, "M");
    try {
      h.write(
        h.group().id,
        type === "Radio" ? { value: "" } : { isSelected: false },
      );
      await h.render();
      const input = h.host.querySelector("input")!;
      const before = document.createElement("button");
      before.textContent = "Before selection";
      h.host.before(before);
      await act(async () => {
        await userEvent.click(before);
        await userEvent.tab();
      });
      before.remove();
      expect(document.activeElement).toBe(input);
      expect(h.host.querySelector("[data-focus-visible]")).not.toBeNull();
      if (type === "Radio") {
        await act(async () => {
          await userEvent.keyboard("{ArrowDown}");
        });
        expect(h.host.querySelectorAll("input")[1]!.checked).toBe(true);
      } else {
        await act(async () => {
          await userEvent.keyboard(" ");
        });
        expect(input.checked).toBe(true);
      }
    } finally {
      await h.dispose();
    }
  },
);
it.each(["Checkbox", "Radio", "Switch"] as const)(
  "%s editable theme and focus restore",
  async (type) => {
    const h = await fixture(type, "M");
    const make = (custom: boolean) =>
      resolveThemeSnapshot(
        createThemeDefinition(
          "selection",
          "Selection",
          undefined,
          custom
            ? {
                "color.selection-accent": {
                  type: "color",
                  value: "#008866",
                  source: "spec-token",
                },
                "focus.ring-color": {
                  type: "color",
                  value: "#ff0000",
                  source: "spec-token",
                },
                "focus.ring-width": {
                  type: "number",
                  value: 3,
                  source: "spec-token",
                },
                "focus.ring-offset": {
                  type: "number",
                  value: 4,
                  source: "spec-token",
                },
              }
            : {},
        ),
        { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
      );
    try {
      h.write(h.group().id, {
        isEmphasized: true,
        ...(type === "Radio"
          ? { value: String(h.field().props.value || h.field().id) }
          : { isSelected: true }),
      });
      await h.render();
      for (const custom of [true, false]) {
        const snapshot = make(custom);
        installThemeMaps(snapshot);
        applyCatalogPreviewTheme({
          key: "selection",
          colorMode: "light",
          install() {},
          snapshot: () => snapshot,
        });
        const button = h.host.querySelector(`.react-aria-${type}Button`)!;
        const indicator = button.querySelector(
          type === "Checkbox" ? ".checkbox" : ".indicator",
        )!;
        button.removeAttribute("data-focus-visible");
        const rest = getComputedStyle(indicator);
        expect(
          type === "Radio" ? rest.borderTopColor : rest.backgroundColor,
        ).toBe(custom ? "rgb(0, 136, 102)" : "rgb(59, 99, 251)");
        // Canvas binding은 RadioGroup에서 파생된 선택/강조 값을 props에 합친다.
        const field = h.field();
        const shape = catalogRuleShapes({
          type,
          rule: COMPONENT_RULES_TABLE[type],
          node: {
            ...field,
            props: { ...field.props, ...field.derivedProps },
          },
          rect: { width: 16, height: 16 },
          theme: "light",
          authoredVisual: {},
        }).find((item) => item.type === "circle" || item.type === "roundRect")!;
        const fill = "fill" in shape ? String(shape.fill) : "";
        expect(
          fill.startsWith("{") ? resolveToken(fill as TokenRef, "light") : fill,
        ).toBe(custom ? "#008866" : "#3b63fb");
        button.setAttribute("data-focus-visible", "");
        expect(getComputedStyle(indicator).outlineWidth).toBe(
          custom ? "3px" : "2px",
        );
        expect(getComputedStyle(indicator).outlineOffset).toBe(
          custom ? "4px" : "2px",
        );
        const data = catalogRuleNodeData({
          type,
          rule: COMPONENT_RULES_TABLE[type],
          node: h.field(),
          rect: { width: 16, height: 16 },
          theme: "light",
          authoredVisual: {},
          state: "focusVisible",
        });
        expect(data.box?.outlineWidth).toBe(custom ? 3 : 2);
        expect(data.box?.outlineOffset).toBe(custom ? 4 : 2);
      }
    } finally {
      await h.dispose();
    }
  },
);

const groupCases = (["Checkbox", "Radio"] as const).flatMap((type) =>
  (["light", "dark"] as const).flatMap((mode) =>
    ["S", "M", "L", "XL"].map((size) => ({ type, mode, size })),
  ),
);
it.each(groupCases)(
  "$type group $mode $size: inherited states and restoration reach both consumers",
  async ({ type, mode, size }) => {
    const h = await fixture(type, size, true);
    const snapshot = resolveThemeSnapshot(
      createThemeDefinition("groups", "Groups"),
      { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
    );
    installThemeMaps(snapshot);
    applyCatalogPreviewTheme({
      key: "groups",
      colorMode: mode,
      install() {},
      snapshot: () => snapshot,
    });
    const probe = document.body.appendChild(document.createElement("span"));
    const rgb = (value: string) => {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    };
    const fields = () =>
      [...h.root.domInputs.values()].filter(
        (node) => h.root.typeOf(node) === type,
      );
    try {
      // 그룹 값 UI는 Checkbox 자식의 Selected로 조립된다. 자식 false도 그룹 disabled를 해제하지 않는다.
      for (const [index, field] of fields().entries()) {
        h.write(field.id, { isSelected: index === 0, isDisabled: false });
      }
      for (const state of ["emphasized", "invalid", "disabled", "restored"]) {
        h.write(h.group().id, {
          isEmphasized: state === "emphasized",
          isInvalid: state === "invalid" || state === "disabled",
          isDisabled: state === "disabled",
        });
        await h.render();
        const group = h.host.querySelector(`.react-aria-${type}Group`)!;
        expect(getComputedStyle(group).opacity, `${state} group opacity`).toBe(
          "1",
        );
        expect(
          getComputedStyle(group.querySelector(".react-aria-Label")!).color,
        ).toBe(
          rgb(
            state === "disabled"
              ? tones[mode].disabled
              : mode === "light"
                ? "#505050"
                : "#afafaf",
          ),
        );
        const controls = [
          ...h.host.querySelectorAll<HTMLInputElement>("input"),
        ];
        const nodes = fields();
        for (const [index, node] of nodes.entries()) {
          const selected = index === 0;
          expect(controls[index]!.checked).toBe(selected);
          expect(controls[index]!.disabled).toBe(state === "disabled");
          const props = { ...node.props, ...node.derivedProps };
          const input = {
            type,
            rule: COMPONENT_RULES_TABLE[type],
            node: { ...node, props },
            rect: { width: 16, height: 16 },
            authoredVisual: {},
            theme: mode,
          };
          const shapes = catalogRuleShapes(input);
          const shape = shapes.find(
            (s) => s.type === "roundRect" || s.type === "circle",
          )!;
          const color =
            state === "disabled"
              ? tones[mode].disabled
              : state === "invalid"
                ? tones[mode].negative
                : state === "emphasized" && selected
                  ? tones[mode].accent
                  : tones[mode].neutral;
          const fill = "fill" in shape ? String(shape.fill) : "";
          const expectedFill = selected ? color : tones[mode].base;
          expect(
            fill.startsWith("{") ? resolveToken(fill as TokenRef, mode) : fill,
          ).toBe(expectedFill);
          const field = h.host.querySelectorAll(`.react-aria-${type}`)[index]!;
          const indicator = field.querySelector(
            type === "Checkbox" ? ".checkbox" : ".indicator",
          )!;
          const dom = getComputedStyle(indicator);
          expect(dom.backgroundColor).toBe(
            rgb(type === "Radio" ? tones[mode].base : expectedFill),
          );
          expect(dom.borderTopColor).toBe(
            rgb(type === "Checkbox" && selected ? "transparent" : color),
          );
          expect(getComputedStyle(field).opacity).toBe("1");
          const label = field.querySelector(".react-aria-Label")!;
          expect(getComputedStyle(label).color).toBe(
            rgb(
              state === "disabled" ? tones[mode].disabled : tones[mode].neutral,
            ),
          );
        }
      }
      // 그룹 상태를 해제한 뒤 자식의 개별 disabled와 선택 편집도 보존한다.
      h.write(fields()[0]!.id, { isDisabled: true, isSelected: false });
      h.write(fields()[1]!.id, { isSelected: true });
      await h.render();
      const controls = h.host.querySelectorAll<HTMLInputElement>("input");
      expect(controls[0]!.disabled).toBe(true);
      expect(controls[1]!.disabled).toBe(false);
      expect(controls[0]!.checked).toBe(false);
      expect(controls[1]!.checked).toBe(true);
    } finally {
      probe.remove();
      await h.dispose();
    }
  },
);
it.each(["Checkbox", "Radio"] as const)(
  "%s group label authored color wins and reset restores state color",
  async (type) => {
    const h = await fixture(type, "M", true);
    const snapshot = resolveThemeSnapshot(
      createThemeDefinition("groups", "Groups"),
      { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
    );
    installThemeMaps(snapshot);
    applyCatalogPreviewTheme({
      key: "groups",
      colorMode: "light",
      install() {},
      snapshot: () => snapshot,
    });
    const labelId = h
      .group()
      .children.find((id) => h.root.domInputs.get(id)?.bindingId === "label")!;
    try {
      for (const custom of [true, false]) {
        await act(async () => {
          h.workspace.execute(
            setFields({
              targets: [h.workspace.positionOfRecord(labelId)!.target],
              visual: {
                color: custom
                  ? { kind: "set", value: "#008866" }
                  : { kind: "remove" },
              },
            }),
          );
        });
        for (const disabled of [true, false]) {
          await act(async () => {
            h.write(h.group().id, { isDisabled: disabled });
          });
          await h.render();
          const label = h.root.domInputs.get(labelId)!;
          expect(label.derivedProps?.color ?? label.visual.color).toBe(
            custom ? "#008866" : disabled ? "#c6c6c6" : "#505050",
          );
          const domLabel = h.host.querySelector(".react-aria-Label")!;
          expect(getComputedStyle(domLabel).color).toBe(
            custom
              ? "rgb(0, 136, 102)"
              : disabled
                ? "rgb(198, 198, 198)"
                : "rgb(80, 80, 80)",
          );
        }
      }
    } finally {
      await h.dispose();
    }
  },
);
it("CheckboxGroup native multiple selection and read-only restoration", async () => {
  const h = await fixture("Checkbox", "M", true);
  const fields = () =>
    [...h.root.domInputs.values()].filter(
      (node) => h.root.typeOf(node) === "Checkbox",
    );
  try {
    for (const field of fields()) h.write(field.id, { isSelected: false });
    await h.render();
    const buttons = () =>
      h.host.querySelectorAll<HTMLElement>(".react-aria-CheckboxButton");
    const inputs = () => h.host.querySelectorAll<HTMLInputElement>("input");
    await act(async () => {
      await userEvent.click(buttons()[0]!);
      await userEvent.keyboard(" ");
    });
    expect(inputs()[0]!.checked).toBe(false);
    await act(async () => {
      await userEvent.keyboard(" ");
      await userEvent.tab();
      await userEvent.keyboard(" ");
    });
    expect(inputs()[0]!.checked).toBe(true);
    expect(inputs()[1]!.checked).toBe(true);
    h.write(h.group().id, { isReadOnly: true });
    await h.render();
    await act(async () => {
      await userEvent.click(buttons()[1]!);
    });
    expect(inputs()[1]!.checked).toBe(true);
    expect(inputs()[1]!.disabled).toBe(false);
    h.write(h.group().id, { isReadOnly: false });
    await h.render();
    await act(async () => {
      await userEvent.click(buttons()[1]!);
    });
    expect(inputs()[1]!.checked).toBe(false);
  } finally {
    await h.dispose();
  }
});
