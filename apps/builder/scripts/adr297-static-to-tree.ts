/**
 * ADR-297 Phase 3 codemod — staticColor 칠을 조건 트리 가지로 (`staticColor: { black, white }` — 값 조건).
 * 손 분류 금지: 가지는 Canvas 의 옛 static 판정 (`resolveCatalogPaint` Phase 3 전 — 상태 칠 뒤 공통 단계) 을
 * leaf 마다 그대로 옮긴다:
 *   배경 — 그 상태의 배경이 불투명 (transparent · null 아님, outline · subtle 가지 밖, alpha ≠ 0) 이면 static 색,
 *          아니면 그대로.
 *   글자 — 같은 상태의 배경이 불투명하면 static 의 역상 (fillBar 트랙은 static 그대로), 아니면 static 색.
 *          (글자 가지는 배경 트리의 모양을 따른다 — 판정이 배경 값에 걸려 있다.)
 *   테두리 — 그 상태의 테두리가 있고 (transparent 가 아니거나 size 에 테두리 폭이 있으면) static 색.
 * props 의 fillStyle 이 outline · subtle 인데 트리에 그 가지가 없으면 (Canvas 는 props 로 outline 을 판정) static
 * 가지 끝에 그 값의 원래 트리를 둔다. 대상 = staticColor 가 닿는 rule (`rulePaintReach` — binding 이 받거나 파생).
 *
 *   pnpm -F @composition/builder exec tsx scripts/adr297-static-to-tree.ts [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { COMPONENT_RULES_TABLE } from "../../../packages/shared/src/catalog/generated/componentRulesTable";
import { isConditionNode } from "../../../packages/shared/src/catalog/rule/conditionTree";
import { rulePaintReach } from "../../../packages/shared/src/catalog/rule/paintReach";
import type {
  ComponentRule,
  ComponentRuleVariant,
} from "../../../packages/shared/src/types/catalog-style.types";

type Tree = unknown;
const dry = process.argv.includes("--dry");
const file = path.resolve(
  import.meta.dirname,
  "../../../packages/shared/src/catalog/generated/componentRulesTable.ts",
);
const TRANSPARENT = "{color.transparent}";
const HEX = { black: "#000000", white: "#ffffff" } as const;
const INVERSE = { black: "#ffffff", white: "#000000" } as const;

/** Copy a tree with every leaf mapped — `inStyle` = the leaf sits under a `fillStyle` outline · subtle value. */
function mapLeaves(
  tree: Tree,
  leaf: (value: unknown, inStyle: boolean) => unknown,
  styleValues: ReadonlySet<string>,
  inStyle = false,
): Tree {
  if (!isConditionNode(tree)) return leaf(tree, inStyle);
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(tree)) {
    if (child === undefined) continue;
    if (key === "fillStyle" || key === "variant" || key === "size")
      out[key] = Object.fromEntries(
        Object.entries(child as Record<string, unknown>).map(([value, b]) => [
          value,
          mapLeaves(
            b,
            leaf,
            styleValues,
            inStyle || (key === "fillStyle" && styleValues.has(value)),
          ),
        ]),
      );
    else if (key === "staticColor") continue;
    else out[key] = mapLeaves(child, leaf, styleValues, inStyle);
  }
  return out;
}

const opaque = (value: unknown) =>
  value !== undefined && value !== null && value !== TRANSPARENT;

function withStatic(tree: Tree, branches: Record<string, Tree>): Tree {
  const base = isConditionNode(tree) ? { ...tree } : { default: tree };
  delete (base as Record<string, unknown>).staticColor;
  return { ...base, staticColor: branches };
}

function staticPaint(
  type: string,
  rule: ComponentRule,
  variant: ComponentRuleVariant,
): ComponentRuleVariant["paint"] {
  const outline = rule.fillStyleValues?.outline ?? "outline";
  const subtle = rule.fillStyleValues?.subtle ?? "subtle";
  const styleValues = new Set([outline, subtle]);
  const reached = (rulePaintReach(type, rule).fillStyles ?? []).filter((v) =>
    styleValues.has(v),
  );
  const bg = variant.paint.backgroundColor;
  const fg = variant.paint.color;
  const bd = variant.paint.borderColor;
  const bgStyles = isConditionNode(bg)
    ? ((bg as Record<string, unknown>).fillStyle as
        | Record<string, unknown>
        | undefined)
    : undefined;
  const missing = reached.filter((value) => bgStyles?.[value] === undefined);
  const widths = new Set(
    Object.values(rule.sizes ?? {}).map((size) => size.borderWidth != null),
  );
  if (widths.size > 1) throw new Error(`ADR297_STATIC_MIXED_BORDER_WIDTH:${type}`);
  const borderWidth = widths.has(true);
  const alphaZero = variant.alpha === 0;
  const paint: Record<string, Tree> = { ...variant.paint };
  const branches = (make: (tone: "black" | "white") => Tree) => ({
    black: make("black"),
    white: make("white"),
  });
  if (bg !== undefined)
    paint.backgroundColor = withStatic(
      bg,
      branches((tone) => {
        const mapped = mapLeaves(
          bg,
          (value, inStyle) =>
            !inStyle && !alphaZero && opaque(value) ? HEX[tone] : value,
          styleValues,
        );
        return missing.length === 0
          ? mapped
          : {
              ...(isConditionNode(mapped) ? mapped : { default: mapped }),
              fillStyle: {
                ...((isConditionNode(mapped)
                  ? (mapped as Record<string, unknown>).fillStyle
                  : undefined) as Record<string, unknown> | undefined),
                ...Object.fromEntries(missing.map((value) => [value, bg])),
              },
            };
      }),
    );
  paint.color = withStatic(
    fg,
    branches((tone) => {
      const text = (value: unknown, inStyle: boolean) =>
        !inStyle && !alphaZero && opaque(value) && variant.fillBar == null
          ? INVERSE[tone]
          : HEX[tone];
      const mapped = bg === undefined ? HEX[tone] : mapLeaves(bg, text, styleValues);
      return missing.length === 0 || bg === undefined
        ? mapped
        : {
            ...(isConditionNode(mapped) ? mapped : { default: mapped }),
            fillStyle: {
              ...((isConditionNode(mapped)
                ? (mapped as Record<string, unknown>).fillStyle
                : undefined) as Record<string, unknown> | undefined),
              ...Object.fromEntries(missing.map((value) => [value, HEX[tone]])),
            },
          };
    }),
  );
  if (bd !== undefined)
    paint.borderColor = withStatic(
      bd,
      branches((tone) =>
        mapLeaves(
          bd,
          (value) =>
            value !== undefined &&
            value !== null &&
            (value !== TRANSPARENT || borderWidth)
              ? HEX[tone]
              : value,
          new Set(),
        ),
      ),
    );
  return paint as ComponentRuleVariant["paint"];
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function serialize(value: unknown, indent: string): string {
  if (value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  const inner = `${indent}  `;
  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, child]) =>
      `${inner}${IDENT.test(key) ? key : JSON.stringify(key)}: ${serialize(child, inner)},`,
  );
  return `{\n${entries.join("\n")}\n${indent}}`;
}

const text = readFileSync(file, "utf8");
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const table = COMPONENT_RULES_TABLE as Record<string, ComponentRule>;
const nameOf = (prop: ts.ObjectLiteralElementLike) =>
  prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
    ? prop.name.text
    : undefined;
const propOf = (obj: ts.ObjectLiteralExpression, name: string) =>
  obj.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) && nameOf(p) === name,
  );
let tableObject: ts.ObjectLiteralExpression | undefined;
source.forEachChild(function find(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "COMPONENT_RULES_TABLE" &&
    node.initializer &&
    ts.isObjectLiteralExpression(node.initializer)
  )
    tableObject = node.initializer;
  else node.forEachChild(find);
});
if (!tableObject) throw new Error("COMPONENT_RULES_TABLE literal not found");

const edits: { start: number; end: number; text: string }[] = [];
const converted: string[] = [];
for (const ruleProp of tableObject.properties) {
  const type = nameOf(ruleProp);
  if (!type || !ts.isPropertyAssignment(ruleProp)) continue;
  const rule = table[type];
  if (!rule?.variants || !rulePaintReach(type, rule).staticColor) continue;
  if (!ts.isObjectLiteralExpression(ruleProp.initializer)) continue;
  const variantsProp = propOf(ruleProp.initializer, "variants");
  if (!variantsProp || !ts.isObjectLiteralExpression(variantsProp.initializer))
    continue;
  for (const variantProp of variantsProp.initializer.properties) {
    const name = nameOf(variantProp);
    if (!name || !ts.isPropertyAssignment(variantProp)) continue;
    if (!ts.isObjectLiteralExpression(variantProp.initializer)) continue;
    const paintProp = propOf(variantProp.initializer, "paint");
    if (!paintProp) continue;
    const paint = staticPaint(type, rule, rule.variants[name]!);
    edits.push({
      start: paintProp.initializer.getStart(),
      end: paintProp.initializer.getEnd(),
      text: serialize(paint, "        "),
    });
    converted.push(`${type}.${name}`);
  }
}
let out = text;
for (const edit of edits.sort((a, b) => b.start - a.start))
  out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
if (!dry) writeFileSync(file, out);
console.log(JSON.stringify({ converted, dry }, null, 1));
