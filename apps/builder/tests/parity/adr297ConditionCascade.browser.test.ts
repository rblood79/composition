/**
 * ADR-297 G1 (e) — compiler 의 `:where()` 출력을 실제 Chromium cascade 에 싣고, 겹친 조건 조합마다
 * `getComputedStyle` 값이 evaluator 값과 같은가 (리뷰 round 1 h1 · round 2 h3). 생성 CSS diff 0 은 「옛 출력과 같음」
 * 만 증명하므로 트리 의미와 cascade 의 동치는 이 하니스가 따로 잰다 (measurement-validity Q5 — oracle 은 브라우저).
 *
 * 트리: 표에서 트리로 옮긴 rule (Button 가족) 의 모든 variant · 속성 + Input 테두리 (breakdown §3 예 — DOM 전용
 * `isFocused` 포함) + 리뷰 round 1 반례 (quiet+hover+invalid). 조합: 트리가 쓰는 boolean 조건의 부분집합 전부 × 값
 * 조건의 값. leaf 마다 고유 rgb 를 매겨 computed 값으로 어느 leaf 가 이겼는지 읽는다. `null` leaf (값 없음) 는
 * `revert-layer` — 조건이 하나도 안 맞는 요소와 같은 값이어야 한다.
 */
import { afterAll, beforeAll, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../../../../packages/shared/src/catalog/generated/componentRulesTable";
import {
  compileConditionTree,
  evaluateConditionTree,
  isConditionNode,
  type ConditionSet,
  type ConditionalValue,
} from "../../../../packages/shared/src/catalog/rule/conditionTree";
import type { PaintValue } from "../../../../packages/shared/src/catalog/rule/rulePaintTree";

type Tree = ConditionalValue<PaintValue>;
const PROPERTIES = {
  backgroundColor: "background-color",
  color: "color",
  borderColor: "border-color",
} as const;
type Prop = keyof typeof PROPERTIES;

const cases: { name: string; tree: Tree; property: Prop }[] = [];
for (const type of [
  "Button",
  "ToggleButton",
  "ToggleButtonGroup",
  "ButtonGroup",
  "FileTrigger",
])
  for (const [variant, rule] of Object.entries(
    COMPONENT_RULES_TABLE[type].variants,
  ))
    for (const property of Object.keys(PROPERTIES) as Prop[]) {
      const tree = rule.paint?.[property];
      if (tree !== undefined)
        cases.push({ name: `${type}.${variant}.${property}`, tree, property });
    }
cases.push({
  name: "Input.borderColor (breakdown §3)",
  property: "borderColor",
  tree: {
    default: "{color.border}",
    isHovered: "{color.border-hover}",
    isFocused: "{color.accent-content}",
    isInvalid: { default: "{color.negative}", isFocused: "{color.negative}" },
    isQuiet: {
      default: "transparent-q",
      isHovered: "transparent-qh",
      isFocused: "transparent-qf",
      isInvalid: "transparent-qi",
    },
  },
});
cases.push({
  name: "review round 1 h1 (quiet+hover vs invalid)",
  property: "borderColor",
  tree: { default: "base", isQuiet: { isHovered: "red" }, isInvalid: "blue" },
});
cases.push({
  name: "null leaf (selected without a selected paint)",
  property: "backgroundColor",
  tree: { default: "base", isHovered: "hover", isSelected: { default: null } },
});

const ATTRIBUTES: Record<string, string> = {
  isHovered: "data-hovered",
  isPressed: "data-pressed",
  isFocusVisible: "data-focus-visible",
  isDisabled: "data-disabled",
  isSelected: "data-selected",
  isEmphasized: "data-emphasized",
  isStaticColor: "data-static-color",
  isQuiet: "data-quiet",
  isInvalid: "data-invalid",
  isFocused: "data-focused",
  isFocusWithin: "data-focus-within",
};
const VALUE_ATTRIBUTES: Record<string, string> = {
  variant: "data-variant",
  size: "data-size",
  fillStyle: "data-fill-style",
};

/** 트리의 boolean 조건 키 · 값 조건 → 값들. */
function axes(tree: Tree) {
  const flags = new Set<string>();
  const values = new Map<string, Set<string>>();
  const visit = (node: unknown) => {
    if (!isConditionNode(node)) return;
    for (const [key, child] of Object.entries(node)) {
      if (key === "default") visit(child);
      else if (key in VALUE_ATTRIBUTES) {
        const set = values.get(key) ?? new Set<string>();
        for (const [value, branch] of Object.entries(child as object)) {
          set.add(value);
          visit(branch);
        }
        values.set(key, set);
      } else {
        flags.add(key);
        visit(child);
      }
    }
  };
  visit(tree);
  return { flags: [...flags], values };
}

function combos(tree: Tree): ConditionSet[] {
  const { flags, values } = axes(tree);
  let out: Record<string, unknown>[] = [];
  for (let mask = 0; mask < 1 << flags.length; mask += 1)
    out.push(
      Object.fromEntries(
        flags.filter((_, i) => mask & (1 << i)).map((f) => [f, true]),
      ),
    );
  for (const [key, set] of values)
    out = out.flatMap((c) => [
      c,
      ...[...set].map((value) => ({ ...c, [key]: value })),
    ]);
  return out as ConditionSet[];
}

const leafColors = new Map<string, string>();
const colorOf = (leaf: string) => {
  let color = leafColors.get(leaf);
  if (!color) {
    const n = leafColors.size + 1;
    color = `rgb(${n % 256}, ${(n * 7) % 256}, ${(n * 13 + 1) % 256})`;
    leafColors.set(leaf, color);
  }
  return color;
};

const sheet = document.createElement("style");
const host = document.createElement("div");
const css: string[] = [];
cases.forEach((c, i) => {
  const root = `.adr297-case-${i}`;
  for (const block of compileConditionTree(
    c.tree,
    root,
    PROPERTIES[c.property],
  )) {
    const value = block.value === null ? "revert-layer" : colorOf(block.value);
    const rule = `${block.selector} { ${block.property}: ${value}; }`;
    css.push(block.media ? `${block.media} { ${rule} }` : rule);
  }
});
beforeAll(() => {
  // A base the catalog layer sits on — what `revert-layer` (no catalog value) falls back to.
  sheet.textContent = `@layer base, components;
@layer base { [class^="adr297-case-"] { background-color: rgb(1, 2, 3); color: rgb(4, 5, 6); border: 1px solid rgb(7, 8, 9); } }
@layer components {\n${css.join("\n")}\n}`;
  document.head.append(sheet);
  document.body.append(host);
});
afterAll(() => {
  sheet.remove();
  host.remove();
});

it("compiled :where() cascade == evaluator for every overlapping condition combination", () => {
  const mismatches: string[] = [];
  let compared = 0;
  cases.forEach((c, i) => {
    const property = PROPERTIES[c.property];
    const read = (conditions: ConditionSet) => {
      const element = document.createElement("div");
      element.className = `adr297-case-${i}`;
      for (const [key, value] of Object.entries(conditions)) {
        if (value === true) element.setAttribute(ATTRIBUTES[key], "true");
        else if (typeof value === "string")
          element.setAttribute(VALUE_ATTRIBUTES[key], value);
      }
      host.append(element);
      const computed = getComputedStyle(element).getPropertyValue(property);
      element.remove();
      return computed;
    };
    for (const conditions of combos(c.tree)) {
      const expected = evaluateConditionTree(c.tree, conditions);
      const want =
        expected === undefined || expected === null
          ? {
              backgroundColor: "rgb(1, 2, 3)",
              color: "rgb(4, 5, 6)",
              borderColor: "rgb(7, 8, 9)",
            }[c.property]
          : colorOf(expected);
      const got = read(conditions);
      compared += 1;
      if (got !== want)
        mismatches.push(
          `${c.name} ${JSON.stringify(conditions)}: want ${want} (${String(expected)}) got ${got}`,
        );
    }
  });
  expect(compared).toBeGreaterThan(100);
  expect(mismatches).toEqual([]);
});
