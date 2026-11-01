/**
 * ADR-297 Phase 3 G4 — 표 전수 DOM ↔ Canvas 상태 칠 대조. Preview 와 같은 번들 CSS (`styles/index.css` — 생성 시트
 * + 수동 CSS + `.button-base`) 와 Preview base · 테마 변수를 싣고, rule 마다 루트 요소 (`react-aria-<Type>` +
 * DOM 이 붙이는 `button-base`) 에 RAC 상태 속성을 걸어 `getComputedStyle` 의 배경 · 글자 · 테두리 색을 Canvas 판정
 * (`resolveCatalogPaint` — 트리 evaluator + static) 의 값과 비교한다.
 *
 * 입력 = 닿는 조건 (`rulePaintReach` 의 fillStyle · 선택 + binding `accepts` 의 quiet · emphasized · staticColor) ×
 * interaction 3. oracle 은 브라우저 cascade (measurement-validity Q5) — 생성 CSS diff 0 이나 compiler 단위 테스트가
 * 보지 못하는 수동 CSS · `.button-base` · rootSelectors 와의 겹침까지 잰다.
 *
 * 루트에 칠이 없는 archetype (toggle-indicator — indicator 상자가 칠한다) 과 variant CSS 를 내지 않는 rule 은
 * 범위 밖 (`skipped`).
 */
import { afterAll, beforeAll, expect, it } from "vitest";
import { commands } from "vitest/browser";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import builderCss from "@composition/shared/components/styles/builder-components.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { getPrimitiveBinding } from "../../../../packages/shared/src/catalog/bindings";
import { COMPONENT_RULES_TABLE } from "../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { resolveCatalogPaint } from "../../../../packages/shared/src/catalog/resolvers/resolveCatalogPaint";
import { usesButtonBaseUtility } from "../../../../packages/shared/src/catalog/resolvers/resolveComponentRule";
import { colorTokenToCss } from "../../../../packages/shared/src/catalog/resolvers/colorTokenToCss";
import { rulePaintReach } from "../../../../packages/shared/src/catalog/rule/paintReach";
import { applyCatalogPreviewTheme } from "../../../../packages/shared/src/catalog/runtime/domView.runtime";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../packages/shared/src/catalog/runtime/fontDefaults";
import { resolveThemeSnapshot } from "../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
import type { CatalogThemeState } from "../../../../packages/shared/src/catalog/runtime/theme";
import { createThemeDefinition } from "../../../../packages/shared/src/theme/themesCollection";
import type { ComponentRule } from "../../../../packages/shared/src/types/catalog-style.types";

const css = document.createElement("style");
const host = document.createElement("div");
const noTransition = document.createElement("style");
beforeAll(() => {
  css.textContent = bundleCss;
  document.head.append(css);
  injectPreviewBaseStyles(document);
  // (one element is re-stated per input — a transition would report the previous state's colors)
  noTransition.textContent = "* { transition: none !important; }";
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
  document.body.append(host);
});
afterAll(() => {
  css.remove();
  noTransition.remove();
  host.remove();
  document.getElementById("runtime-theme-vars")?.remove();
  document.documentElement.removeAttribute("data-theme");
});

const canvas = document.createElement("canvas");
canvas.width = canvas.height = 1;
const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
/** 계산된 CSS 색 → `rgba(r,g,b,a)` (sRGB 8 bit · alpha 2 자리) — 투명은 `transparent`. */
function rgba(color: string): string {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a === 0) return "transparent";
  return `rgba(${r},${g},${b},${(a! / 255).toFixed(2)})`;
}
const probe = document.createElement("span");
/** Canvas 판정 값 (TokenRef · hex · `transparent`) → DOM 과 같은 해석 (같은 문서의 CSS 변수). */
function canvasColor(value: string | undefined, alpha = 1): string {
  if (value === undefined) return "none";
  const cssValue = value.startsWith("{")
    ? colorTokenToCss(value as never)
    : value;
  if (!probe.isConnected) host.append(probe);
  probe.style.color = "";
  probe.style.color = cssValue;
  const resolved = getComputedStyle(probe).color;
  if (alpha >= 1) return rgba(resolved);
  probe.style.color = `color-mix(in srgb, ${resolved} ${alpha * 100}%, transparent)`;
  return rgba(getComputedStyle(probe).color);
}

type Accepts = Record<
  string,
  { options?: readonly { value: unknown }[] } | undefined
>;
const INTERACTIONS = ["default", "hover", "pressed"] as const;

interface Row {
  readonly key: string;
  readonly canvas: string;
  readonly dom: string;
}

/**
 * `catalog` — a Preview catalog node (`data-catalog-id`), compared with the Canvas paint. `chrome` — the
 * same element as the Builder's own widgets render it (no `data-catalog-id`): only the DOM values are
 * recorded, for the before/after comparison of R7 (builder widgets must not change).
 */
function rowsFor(
  type: string,
  rule: ComponentRule,
  mode: "catalog" | "chrome" = "catalog",
): Row[] | "skip" {
  if (!rule.variants) return "skip";
  if (mode === "catalog" && rule.structure?.archetype === "toggle-indicator")
    return "skip";
  const binding = getPrimitiveBinding(type) as
    { props?: { accepts?: Accepts }; skiaPrimitive?: unknown } | undefined;
  // (a draw module paints these on Canvas — dot · bar · line · ring — not the root box)
  if (mode === "catalog" && binding?.skiaPrimitive !== undefined)
    return "skip";
  const accepts = binding?.props?.accepts ?? {};
  const reach = rulePaintReach(type, rule);
  const fillStyles = [undefined, ...(reach.fillStyles ?? [])];
  const quiets = accepts.isQuiet ? [false, true] : [false];
  const emphasized = accepts.isEmphasized ? [false, true] : [false];
  const selections = reach.selectable ? [false, true] : [false];
  const statics = accepts.staticColor
    ? (["auto", "white", "black"] as const)
    : ([undefined] as const);
  const size = rule.defaultSize ?? Object.keys(rule.sizes ?? {})[0];
  const rows: Row[] = [];
  const element = document.createElement("div");
  host.append(element);
  for (const [variantName, variant] of Object.entries(rule.variants))
    for (const fillStyle of fillStyles)
      for (const isQuiet of quiets)
        for (const isEmphasized of emphasized)
          for (const isSelected of selections)
            for (const staticColor of statics)
              for (const interaction of INTERACTIONS) {
                const props: Record<string, unknown> = {
                  ...(fillStyle ? { fillStyle } : {}),
                  ...(isQuiet ? { isQuiet } : {}),
                  ...(isEmphasized ? { isEmphasized } : {}),
                  ...(isSelected ? { isSelected } : {}),
                  ...(staticColor ? { staticColor } : {}),
                };
                const paint = resolveCatalogPaint({
                  variant,
                  size: size ? rule.sizes?.[size] : undefined,
                  props,
                  style: undefined,
                  interactionState: interaction,
                  fillStyleValues: rule.fillStyleValues,
                } as never);
                element.className = `react-aria-${type}${usesButtonBaseUtility(type) ? " button-base" : ""}`;
                for (const name of [...element.getAttributeNames()])
                  if (name !== "class") element.removeAttribute(name);
                // (a Preview catalog node — builder-chrome-only manual rules are `:not([data-catalog-id])`)
                if (mode === "catalog")
                  element.setAttribute("data-catalog-id", `parity:${type}`);
                element.setAttribute("data-rac", "");
                element.setAttribute("data-variant", variantName);
                if (size) element.setAttribute("data-size", size);
                if (fillStyle)
                  element.setAttribute("data-fill-style", fillStyle);
                if (isQuiet) element.setAttribute("data-quiet", "true");
                if (isEmphasized)
                  element.setAttribute("data-emphasized", "true");
                if (isSelected) element.setAttribute("data-selected", "true");
                if (staticColor)
                  element.setAttribute("data-static-color", staticColor);
                if (interaction === "hover")
                  element.setAttribute("data-hovered", "true");
                if (interaction === "pressed")
                  element.setAttribute("data-pressed", "true");
                const computed = getComputedStyle(element);
                const domBorder =
                  parseFloat(computed.borderTopWidth) > 0
                    ? rgba(computed.borderTopColor)
                    : "none";
                const canvasBorder =
                  paint.borderColor === undefined
                    ? "none"
                    : canvasColor(paint.borderColor as string);
                const key = `${type}.${variantName} ${JSON.stringify(props)} ${interaction}`;
                if (mode === "chrome") {
                  rows.push({
                    key,
                    canvas: "",
                    dom: `${rgba(computed.backgroundColor)} ${rgba(computed.color)} ${domBorder} ${computed.opacity}`,
                  });
                  continue;
                }
                const pairs: [string, string, string][] = [
                  [
                    "bg",
                    canvasColor(
                      paint.backgroundColor as string | undefined,
                      paint.backgroundAlpha,
                    ),
                    rgba(computed.backgroundColor),
                  ],
                  [
                    "fg",
                    canvasColor(paint.color as string | undefined),
                    rgba(computed.color),
                  ],
                  [
                    "bd",
                    canvasBorder === "transparent" ? "none" : canvasBorder,
                    domBorder === "transparent" ? "none" : domBorder,
                  ],
                ];
                for (const [channel, c, d] of pairs) {
                  // (a channel the Canvas leaves unpainted is not compared — the DOM may inherit it)
                  if (c === "none" && channel !== "bd") continue;
                  rows.push({ key: `${key} ${channel}`, canvas: c, dom: d });
                }
              }
  element.remove();
  return rows;
}

it("DOM computed paint == Canvas paint over the whole table (reach inputs)", async () => {
  const mismatches: Row[] = [];
  const skipped: string[] = [];
  let compared = 0;
  for (const [type, rule] of Object.entries(
    COMPONENT_RULES_TABLE as Record<string, ComponentRule>,
  )) {
    const rows = rowsFor(type, rule);
    if (rows === "skip") {
      skipped.push(type);
      continue;
    }
    compared += rows.length;
    for (const row of rows) if (row.canvas !== row.dom) mismatches.push(row);
  }
  const byType = new Map<string, number>();
  for (const row of mismatches) {
    const type = row.key.split(".")[0]!;
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }
  console.log(
    `[adr297-dom-parity] compared ${compared} · mismatches ${mismatches.length} · skipped ${skipped.length}\n` +
      [...byType].map(([t, n]) => `  ${t} ${n}`).join("\n"),
  );
  console.log(
    mismatches
      .slice(0, 400)
      .map((r) => `${r.key}: canvas ${r.canvas} · dom ${r.dom}`)
      .join("\n"),
  );
  expect(compared).toBeGreaterThan(1_000);
  // (local evidence — `.agent/runs/` is gitignored)
  await commands.writeFile(
    "../../.agent/runs/adr297-dom-parity.json",
    `${JSON.stringify({ compared, skipped, byType: Object.fromEntries(byType), mismatches }, null, 1)}\n`,
  );
});

it("records the Builder widgets' (no catalog id) computed paint — R7 before/after", async () => {
  // (the Builder's own bundle — a subset of the generated sheets + the manual sheets, pins last)
  css.textContent = builderCss;
  const chrome: Record<string, string> = {};
  for (const [type, rule] of Object.entries(
    COMPONENT_RULES_TABLE as Record<string, ComponentRule>,
  )) {
    const rows = rowsFor(type, rule, "chrome");
    if (rows !== "skip") for (const row of rows) chrome[row.key] = row.dom;
  }
  css.textContent = bundleCss;
  expect(Object.keys(chrome).length).toBeGreaterThan(1_000);
  await commands.writeFile(
    "../../.agent/runs/adr297-chrome-paint.json",
    `${JSON.stringify(chrome, null, 1)}\n`,
  );
});
