/**
 * ADR-297 Phase 3g oracle — 수동 CSS 의 selected · focus 규칙을 rule 트리로 옮기기 전후의 **실제 catalog DOM** computed
 * 값. 팔레트 instance 를 문서에 넣고 product DOM binding (`renderCatalogDom`) 으로 그린 뒤, 상태를 받는 요소 (항목 ·
 * toggle · 셀 · 부품) 에 RAC 상태 속성을 조합으로 걸어 그 요소와 자손 · `::before` · `::after` 의 값을 기록한다
 * (`.agent/runs/adr297-manual-state.json`). 합성 fixture 가 아니라 실제 DOM 이라 조상 맥락 (`data-variant` · 변수 ·
 * Popover) 이 그대로 실린다. 둘째 기록은 같은 DOM 에서 `data-catalog-id` 를 지우고 빌더 위젯 시트
 * (`apps/builder/src/builder/styles/widgets/`, 빌더 문서 표지 포함) 로 잰다 — Builder 위젯 쪽 값 (R7).
 */
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { commands } from "vitest/browser";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
// ADR-305 — 빌더 문서의 위젯 시트 (사용자 컴포넌트 시트를 싣지 않는다 · 범위 = <html data-document="builder">)
import builderCss from "@/builder/styles/widgets/index.css?inline";
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
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../packages/shared/src/catalog/runtime/fontDefaults";
import { resolveThemeSnapshot } from "../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
import type { CatalogThemeState } from "../../../../packages/shared/src/catalog/runtime/theme";
import { createThemeDefinition } from "../../../../packages/shared/src/theme/themesCollection";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { catalogPaletteDefinitionId } from "@/builder/catalogRuntime/paletteInsert";
import { newCatalogProjectDocument } from "@/builder/catalogRuntime/project";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { CatalogWorkspace } from "@/builder/catalogRuntime/workspace";

/** 팔레트 type — 수동 selected · focus 규칙이 닿는 요소를 그리는 것. */
const TYPES = [
  "ListBox",
  "GridList",
  "Tree",
  "TagGroup",
  "Tabs",
  "Table",
  "Menu",
  "Calendar",
  "RangeCalendar",
  "ColorSwatchPicker",
  "Checkbox",
  "CheckboxGroup",
  "RadioGroup",
  "Switch",
  "ToggleButton",
  "ToggleButtonGroup",
  "Breadcrumbs",
  "ColorPicker",
  "ColorArea",
  "ColorSlider",
  "ColorWheel",
  "Link",
  "TextField",
] as const;
/** 맥락 축 — 같은 type 을 prop 하나 바꿔 한 번 더 (수동 규칙의 조상 선택자 `[data-selection-style]` · size …). */
const VARIANT_OWNERS: readonly {
  readonly type: string;
  readonly props: Record<string, unknown>;
}[] = [
  { type: "Tree", props: { selectionStyle: "highlight" } },
  { type: "Tree", props: { isEmphasized: true } },
  { type: "Table", props: { selectionStyle: "highlight" } },
  { type: "GridList", props: { selectionStyle: "highlight" } },
  { type: "GridList", props: { layout: "grid" } },
  { type: "TagGroup", props: { isEmphasized: true } },
  { type: "RadioGroup", props: { size: "S" } },
  { type: "RadioGroup", props: { size: "L" } },
  { type: "RadioGroup", props: { size: "XL" } },
  { type: "RadioGroup", props: { isEmphasized: true } },
  { type: "Switch", props: { size: "XL" } },
  { type: "Switch", props: { isEmphasized: true } },
  { type: "Checkbox", props: { isEmphasized: true } },
  { type: "ToggleButtonGroup", props: { staticColor: "white" } },
  { type: "ToggleButtonGroup", props: { isEmphasized: true } },
  { type: "Tabs", props: { orientation: "vertical" } },
  { type: "Menu", props: { selectionMode: "single" } },
  { type: "Menu", props: { selectionMode: "multiple" } },
];

/** 상태를 받는 요소 — owner 안에서 선택자마다 첫 요소 하나. */
const TARGETS = [
  ".react-aria-ListBox",
  ".react-aria-ListBoxItem",
  ".react-aria-GridList",
  ".react-aria-GridListItem",
  ".react-aria-Tree",
  ".react-aria-TreeItem",
  ".react-aria-Tag",
  ".react-aria-Tab",
  ".react-aria-Table",
  ".react-aria-Row",
  ".react-aria-Cell",
  ".react-aria-Column",
  ".react-aria-MenuItem",
  ".react-aria-CalendarCell",
  ".react-aria-ColorSwatchPickerItem",
  ".react-aria-Checkbox",
  ".react-aria-CheckboxButton",
  ".react-aria-Radio",
  ".react-aria-RadioButton",
  ".react-aria-Switch",
  ".react-aria-SwitchButton",
  ".react-aria-ToggleButton",
  ".react-aria-Link",
  ".react-aria-Label",
  ".react-aria-ColorPicker",
  ".react-aria-ColorThumb",
  ".react-aria-Breadcrumb",
] as const;

const COMBOS: Record<string, readonly string[]> = {
  rest: [],
  hovered: ["data-hovered"],
  pressed: ["data-pressed"],
  focusVisible: ["data-focused", "data-focus-visible"],
  disabled: ["data-disabled"],
  invalid: ["data-invalid"],
  invalidPressed: ["data-invalid", "data-pressed"],
  selected: ["data-selected"],
  selectedFocusVisible: ["data-selected", "data-focused", "data-focus-visible"],
  selectedHovered: ["data-selected", "data-hovered"],
  selectedPressed: ["data-selected", "data-pressed"],
  selectedDisabled: ["data-selected", "data-disabled"],
  selectedInvalid: ["data-selected", "data-invalid"],
  selectedInvalidPressed: ["data-selected", "data-invalid", "data-pressed"],
  indeterminate: ["data-indeterminate"],
  indeterminatePressed: ["data-indeterminate", "data-pressed"],
  today: ["data-selected", "data-today"],
  rangeStart: ["data-selected", "data-selection-start"],
  rangeEnd: ["data-selected", "data-selection-end", "data-hovered"],
  rangeSingle: ["data-selected", "data-selection-start", "data-selection-end"],
  rangeInvalid: ["data-selected", "data-invalid"],
  rangeStartFocus: [
    "data-selected",
    "data-selection-start",
    "data-focus-visible",
  ],
  dropTarget: ["data-drop-target"],
  selectedDropTarget: ["data-selected", "data-drop-target"],
  selectedDisabledFocus: [
    "data-selected",
    "data-disabled",
    "data-focus-visible",
  ],
};
/**
 * RAC 가 같은 상태를 두 요소에 싣는 자리 (D1 — `*Field` `div` 와 그 안 `*Button` `label`): button 을 잴 때 field 에도
 * 같은 상태 속성을 건다 (pressed · hover · focus 는 button 만 — RAC 그대로).
 */
const FIELD_OF: Record<string, string> = {
  ".react-aria-CheckboxButton": ".react-aria-Checkbox",
  ".react-aria-RadioButton": ".react-aria-Radio",
  ".react-aria-SwitchButton": ".react-aria-Switch",
};
const FIELD_ATTRS = new Set([
  "data-selected",
  "data-invalid",
  "data-disabled",
  "data-indeterminate",
]);

const PROPS = [
  "background-color",
  "color",
  "border-top-color",
  "border-top-width",
  "border-left-width",
  "border-top-left-radius",
  "border-bottom-left-radius",
  "outline-style",
  "outline-width",
  "outline-color",
  "outline-offset",
  "box-shadow",
  "width",
  "height",
  "translate",
  "visibility",
  "opacity",
  "stroke-dashoffset",
  "text-decoration-line",
  "--tag-color",
  "--button-color",
  "--selected-color",
  "--radius-top",
  "--radius-bottom",
] as const;
const PSEUDO_PROPS = [
  "content",
  "background-color",
  "color",
  "border-top-color",
  "border-top-width",
  "outline-style",
  "outline-color",
  "translate",
  "width",
  "height",
  "inset",
] as const;

let host: HTMLDivElement;
let reactRoot: Root;
const css = document.createElement("style");
const noTransition = document.createElement("style");

beforeAll(async () => {
  await initEngineWasm();
  css.textContent = bundleCss;
  delete document.documentElement.dataset.document;
  document.head.append(css);
  injectPreviewBaseStyles(document);
  noTransition.textContent =
    "*, *::before, *::after { transition: none !important; animation: none !important; }";
  document.head.append(noTransition);
  const snapshot = resolveThemeSnapshot(
    createThemeDefinition("parity", "Parity"),
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );
  applyCatalogPreviewTheme({
    key: "",
    colorMode: "light",
    install: () => {},
    snapshot: () => snapshot,
  } satisfies CatalogThemeState);
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
    `project:${kind}:m${++next}` as EntryId<K>;
};

function color(value: string): string {
  return value.replace(/\s+/g, "");
}
function styleRow(element: Element, pseudo?: "::before" | "::after"): string {
  const c = getComputedStyle(element, pseudo);
  if (pseudo && (c.content === "none" || c.content === "normal")) return "";
  return (pseudo ? PSEUDO_PROPS : PROPS)
    .map((p) => {
      const v = c.getPropertyValue(p).trim();
      return /color/.test(p) ? color(v) : v;
    })
    .join(" · ");
}

/** target 과 자손 (깊이 우선, 상한 16) — 경로는 class 첫 토큰 사슬. */
function measure(target: Element): Record<string, string> {
  const out: Record<string, string> = {};
  const nodes: [Element, string][] = [[target, "&"]];
  const stack: [Element, string][] = [[target, "&"]];
  while (stack.length && nodes.length < 16) {
    const [el, path] = stack.shift()!;
    [...el.children].forEach((child, i) => {
      if (nodes.length >= 16) return;
      const name =
        child.getAttribute("class")?.split(/\s+/)[0] ||
        child.tagName.toLowerCase();
      const entry: [Element, string] = [child, `${path}>${name}#${i}`];
      nodes.push(entry);
      stack.push(entry);
    });
  }
  // (a day cell's band is its td's `::before` — RangeCalendar)
  if (target.matches(".react-aria-CalendarCell") && target.parentElement)
    nodes.push([target.parentElement, "^"]);
  for (const [el, path] of nodes) {
    out[path] = styleRow(el);
    const before = styleRow(el, "::before");
    if (before) out[`${path}::before`] = before;
    const after = styleRow(el, "::after");
    if (after) out[`${path}::after`] = after;
  }
  return out;
}

function record(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const owner of host.querySelectorAll<HTMLElement>(
    "[data-parity-owner]",
  )) {
    const type = owner.dataset.parityOwner!;
    for (const selector of TARGETS) {
      const target = owner.matches(selector)
        ? owner
        : owner.querySelector(selector);
      if (!target) continue;
      // (the field and its button carry the state together — whichever of the two is measured)
      const buttonSelector = Object.keys(FIELD_OF).find(
        (button) => FIELD_OF[button] === selector,
      );
      const field = FIELD_OF[selector]
        ? target.closest(FIELD_OF[selector])
        : buttonSelector
          ? target
          : null;
      const button = buttonSelector
        ? target.querySelector(buttonSelector)
        : FIELD_OF[selector]
          ? target
          : null;
      const stated = [
        ...new Set([
          target,
          ...(field ? [field] : []),
          ...(button ? [button] : []),
        ]),
      ];
      const saved = stated.map(
        (el) =>
          new Map([...el.attributes].map((a) => [a.name, a.value] as const)),
      );
      const STATE =
        /^data-(selected|indeterminate|hovered|pressed|focused|focus-visible|disabled|invalid|today|selection-start|selection-end|drop-target)$/;
      for (const [combo, attrs] of Object.entries(COMBOS)) {
        // (each combo is the whole state — the rendered state attributes are cleared first)
        for (const el of stated)
          for (const name of [...el.getAttributeNames()])
            if (STATE.test(name)) el.removeAttribute(name);
        for (const attr of attrs) {
          (button ?? target).setAttribute(attr, "true");
          if (field && FIELD_ATTRS.has(attr)) field.setAttribute(attr, "true");
        }
        for (const [path, row] of Object.entries(measure(target)))
          out[`${type} ${selector} ${combo} ${path}`] = row;
      }
      stated.forEach((el, i) => {
        for (const name of [...el.getAttributeNames()])
          if (STATE.test(name)) el.removeAttribute(name);
        for (const [name, value] of saved[i]) el.setAttribute(name, value);
      });
    }
  }
  return out;
}

/**
 * Reach probe (`.agent/runs/adr297-probe.json` — groups of resolved manual selectors, local only): blank each
 * group's matching style rules in the bundle sheet, re-record the catalog DOM, report the rows that change.
 * A group with no changed row does not reach the catalog DOM (dead, shadowed or equal to the tree).
 */
interface ProbeGroup {
  readonly name: string;
  readonly rules: readonly { line: number; selectors: readonly string[] }[];
}
const norm = (selector: string) =>
  selector
    .replace(/\s+/g, "")
    .replaceAll("'", '"')
    .replace(/(?<!:):(before|after)/g, "::$1");
function splitList(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of selector) {
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}
function styleRules(
  rules: CSSRuleList,
  parents: readonly string[],
  visit: (rule: CSSStyleRule, resolved: readonly string[]) => void,
): void {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      const resolved = parents.flatMap((parent) =>
        splitList(rule.selectorText).map((s) =>
          s.includes("&")
            ? s.replaceAll("&", parent)
            : parent
              ? `${parent} ${s}`
              : s,
        ),
      );
      visit(rule, resolved);
      styleRules(rule.cssRules, resolved, visit);
    } else if ("cssRules" in rule)
      styleRules((rule as CSSGroupingRule).cssRules, parents, visit);
  }
}
async function probeManualRules(
  base: Record<string, string>,
): Promise<Record<string, unknown>> {
  let spec: ProbeGroup[];
  try {
    spec = JSON.parse(
      await commands.readFile("../../.agent/runs/adr297-probe.json"),
    ) as ProbeGroup[];
  } catch {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const group of spec) {
    const wanted = new Map<string, number[]>();
    for (const rule of group.rules) {
      const key = rule.selectors.map(norm).join(",");
      wanted.set(key, [...(wanted.get(key) ?? []), rule.line]);
    }
    const blanked: [CSSStyleRule, string][] = [];
    const hit = new Set<number>();
    styleRules(css.sheet!.cssRules, [""], (rule, resolved) => {
      const lines = wanted.get(resolved.map(norm).join(","));
      if (!lines) return;
      for (const line of lines) hit.add(line);
      blanked.push([rule, rule.style.cssText]);
      rule.style.cssText = "";
    });
    const probe = record();
    for (const [rule, text] of blanked) rule.style.cssText = text;
    const changed = Object.keys(base).filter((k) => base[k] !== probe[k]);
    out[group.name] = {
      unmatched: group.rules.filter((r) => !hit.has(r.line)).map((r) => r.line),
      changed: Object.fromEntries(
        changed.map((k) => [k, { base: base[k], without: probe[k] }]),
      ),
    };
  }
  return out;
}

it("records the manual selected · focus rules' computed styles on the real catalog DOM (catalog · chrome) — 3g before/after", async () => {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:manual-state" as EntryId<"project">,
        name: "Manual state",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr297-manual-${Math.random()}`),
    {
      engine: createLayoutEngine(),
      viewport: { width: 1440, height: 900 },
      autosaveSchedule: () => {},
      textMeasure: catalogTextMeasure,
    },
  );
  const newId = allocator();
  const owners: { type: string; id: NodeId }[] = [];
  const plan = [
    ...TYPES.map((type) => ({ type, label: type, props: {} })),
    ...VARIANT_OWNERS.map(({ type, props }) => ({
      type,
      label: `${type}[${Object.entries(props)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(",")}]`,
      props: Object.fromEntries(
        Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
      ),
    })),
  ];
  for (const { type, label, props } of plan) {
    const id =
      `project:node:owner-${label.replace(/[^A-Za-z0-9]/g, "-")}` as NodeId;
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
              props,
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [id],
          newId,
        }),
      );
      owners.push({ type: label, id });
    } catch {
      // (a type the palette does not offer — reported by the count below)
    }
  }
  const root = workspace.root;
  const records = owners.map(({ type, id }) => ({
    type,
    record: root.recordsOfSource(id)[0]!,
  }));
  reactRoot.render(
    React.createElement(
      React.Fragment,
      null,
      ...records.map(({ type, record }) =>
        React.createElement(
          "div",
          { key: type, "data-parity-owner": type },
          renderCatalogDom(root, record),
        ),
      ),
    ),
  );
  await new Promise<void>((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => done())),
  );
  // (A closed MenuTrigger draws no item: the selection glyph's selectors read the item's own attributes
  //  only, so a synthetic RAC-shaped item stands in — `data-selection-mode` is RAC's.)
  for (const mode of ["single", "multiple"]) {
    const owner = document.createElement("div");
    owner.dataset.parityOwner = `MenuItem(synthetic ${mode})`;
    owner.innerHTML = `<div class="react-aria-Menu" data-catalog-id="parity:menu-${mode}"><div class="react-aria-MenuItem" data-catalog-id="parity:item-${mode}" data-selection-mode="${mode}" data-rac=""><span>Item</span></div></div>`;
    host.append(owner);
  }
  // (the owner wrapper carries the type — the catalog element is its first child)
  const catalog = record();
  const probes = await probeManualRules(catalog);
  for (const el of host.querySelectorAll("[data-catalog-id]"))
    el.removeAttribute("data-catalog-id");
  css.textContent = builderCss;
  document.documentElement.dataset.document = "builder";
  const chrome = record();
  css.textContent = bundleCss;
  delete document.documentElement.dataset.document;
  expect(owners.length).toBeGreaterThan(18);
  expect(Object.keys(catalog).length).toBeGreaterThan(500);
  await commands.writeFile(
    "../../.agent/runs/adr297-manual-state.json",
    `${JSON.stringify(
      { owners: owners.map((o) => o.type), catalog, chrome, probes },
      null,
      1,
    )}\n`,
  );
});
