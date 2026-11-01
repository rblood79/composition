/**
 * ADR-297 codemod — rule variant 의 옛 칠 (`fill.<style>.<state>` · `colors` 접미사 키) 을 조건 트리 (`paint`) 로.
 * 손 분류 금지 (breakdown §4 Phase 2) — 트리는 `variantPaintTree` (G1 표 전수 동치 테스트가 검증한 변환) 가 표의
 * **실행 값** 에서 만들고, 이 스크립트는 그 결과를 소스 위치에 쓴다. variant 의 다른 키 · 주석은 원문 그대로 둔다.
 * (2026-11-01 Phase 2 에서 표 전수 190 variant 를 옮겼다 — 지금 표에는 옛 `fill` literal 이 없어 변환 0 이다.)
 *
 *   pnpm -F @composition/builder exec tsx scripts/adr297-rule-to-tree.ts [--dry] Type…   (Type 없으면 전부)
 *
 * 건너뛰는 variant (보고만): 초기값이 객체 literal 이 아니거나, fill · colors 안에 문자열 · 숫자 literal 이 아닌 값.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { COMPONENT_RULES_TABLE } from "../../../packages/shared/src/catalog/generated/componentRulesTable";
import { rulePaintReach } from "../../../packages/shared/src/catalog/rule/paintReach";
import type {
  ComponentRulePaint,
  PaintReach,
  PaintTree,
} from "../../../packages/shared/src/catalog/rule/rulePaintTree";
import type {
  CatalogFillStyleValues,
  ComponentRule,
} from "../../../packages/shared/src/types/catalog-style.types";

// ── 옛 형식 → 트리 (Phase 2 codemod 의 변환 — Phase 3i 에서 shared `rulePaintTree.ts` 에서 옮겨 왔다) ──

/** 옛 `fill.<style>` 의 상태 칸 (ADR-908 `FillStateTokens` 투영). */
interface LegacyFillState {
  base: string;
  hover?: string;
  pressed?: string;
  selected?: string;
  selectedHover?: string;
  selectedPressed?: string;
  emphasizedSelected?: string;
}
/** 옛 `fill` — fillStyle (default · outline · subtle) × 상태 + quiet + 투명도. */
interface LegacyFill {
  default: LegacyFillState;
  outline?: Partial<LegacyFillState>;
  subtle?: Partial<LegacyFillState>;
  quiet?: Partial<LegacyFillState>;
  alpha?: number;
}
/** 옛 `colors` — 글자 · 테두리와 그 상태 접미사 키. */
interface LegacyColors {
  text?: string;
  textHover?: string;
  border?: string;
  borderHover?: string;
  outlineText?: string;
  outlineBorder?: string;
  subtleText?: string;
  selectedText?: string;
  selectedBorder?: string;
  emphasizedSelectedText?: string;
  emphasizedSelectedBorder?: string;
}
/** 옛 형식의 variant 칠 (`fill` · `colors`). */
interface LegacyVariantPaint {
  fill: LegacyFill;
  colors?: LegacyColors;
}

type Node = Record<
  string,
  PaintTree | Readonly<Record<string, PaintTree | undefined>> | undefined
>;

const compact = (node: Node): Node | undefined => {
  for (const key of Object.keys(node))
    if (node[key] === undefined) delete node[key];
  return Object.keys(node).length > 0 ? node : undefined;
};

/** `{ default: base, isHovered, isPressed }` — 한 fillStyle 의 상태 칠 (`S.hover ?? S.base`). */
function stateNode(
  states: Partial<LegacyFillState> | undefined,
): PaintTree | undefined {
  if (!states) return undefined;
  const node = compact({
    default: states.base,
    isHovered: states.hover,
    isPressed: states.pressed,
  });
  // 상태 하나뿐이면 leaf 로 (`fillStyle: { outline: "{color.transparent}" }`).
  return node && Object.keys(node).length === 1 && "default" in node
    ? (node.default as PaintTree)
    : node;
}

/**
 * 옛 `fill.<style>` · `colors` 접미사 키 → 트리 (전환 codemod 와 같은 변환). 트리는 현행 Canvas 사슬
 * (`resolveCatalogPaint`) 의 뜻을 그대로 담는다 — 선택 · outline · subtle 은 그 칸만 칠하는 배타 가지라, 닿는 축
 * (`reach`) 에서 칸이 비면 `null` 가지를 둔다.
 */
function variantPaintTree(
  variant: LegacyVariantPaint,
  fillStyleValues?: CatalogFillStyleValues,
  reach: PaintReach = {},
): ComponentRulePaint {
  const fill = variant.fill;
  const c: LegacyColors = variant.colors ?? {};
  const outline = fillStyleValues?.outline ?? "outline";
  const subtle = fillStyleValues?.subtle ?? "subtle";
  const reaches = (value: string) => reach.fillStyles?.includes(value) === true;
  const selectable = reach.selectable === true;
  const d = fill.default;
  // 옛 사슬: outline · subtle 에서는 hover 글자 · 테두리를 읽지 않는다. 그 칸이 비고 hover 값이 있으면 트리로
  //   담을 수 없다 (「hover 아님」 조건이 없다) — 닿는 축에서는 표에 0 건이라 멈춘다.
  const exclusive = (
    value: string,
    slot: string | undefined,
    hover: string | undefined,
    key: string,
  ) => {
    if (slot === undefined && hover !== undefined && reaches(value))
      throw new Error(`ADR297_UNREPRESENTABLE_HOVER:${key}:${value}`);
    return slot;
  };
  const fillSlot = (
    states: Partial<LegacyFillState> | undefined,
    value: string,
  ) => stateNode(states) ?? (reaches(value) ? null : undefined);

  const backgroundColor = compact({
    default: d.base,
    isHovered: d.hover,
    isPressed: d.pressed,
    fillStyle: compact({
      [outline]: fillSlot(fill.outline, outline),
      [subtle]: fillSlot(fill.subtle, subtle),
    }) as Record<string, PaintTree> | undefined,
    isQuiet: stateNode(fill.quiet),
    isSelected:
      selectable ||
      d.selected !== undefined ||
      d.emphasizedSelected !== undefined ||
      d.selectedHover !== undefined ||
      d.selectedPressed !== undefined
        ? compact({
            default: d.selected ?? null,
            isHovered: d.selectedHover,
            isPressed: d.selectedPressed,
            isEmphasized: d.emphasizedSelected,
          })
        : undefined,
  });

  const color = compact({
    default: c.text,
    isHovered: c.textHover,
    fillStyle: compact({
      [outline]: exclusive(outline, c.outlineText, c.textHover, "color"),
      [subtle]: exclusive(subtle, c.subtleText, c.textHover, "color"),
    }) as Record<string, PaintTree> | undefined,
    isSelected:
      selectable ||
      c.selectedText !== undefined ||
      c.emphasizedSelectedText !== undefined
        ? compact({
            default: c.selectedText ?? null,
            isEmphasized: c.emphasizedSelectedText,
          })
        : undefined,
  });

  const borderColor = compact({
    default: c.border,
    isHovered: c.borderHover,
    fillStyle: compact({
      [outline]: exclusive(outline, c.outlineBorder, c.borderHover, "border"),
    }) as Record<string, PaintTree> | undefined,
    isSelected:
      selectable ||
      c.selectedBorder !== undefined ||
      c.emphasizedSelectedBorder !== undefined
        ? compact({
            default: c.selectedBorder ?? null,
            isEmphasized: c.emphasizedSelectedBorder,
          })
        : undefined,
  });

  return {
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(color ? { color } : {}),
    ...(borderColor ? { borderColor } : {}),
  };
}


const args = process.argv.slice(2);
const dry = args.includes("--dry");
const only = new Set(args.filter((a) => !a.startsWith("--")));
const file = path.resolve(
  import.meta.dirname,
  "../../../packages/shared/src/catalog/generated/componentRulesTable.ts",
);
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

function literalOnly(node: ts.Node): boolean {
  if (ts.isObjectLiteralExpression(node))
    return node.properties.every(
      (p) => ts.isPropertyAssignment(p) && literalOnly(p.initializer),
    );
  return ts.isStringLiteral(node) || ts.isNumericLiteral(node);
}

/** 원문의 `//` · `/* *\/` 주석 (문자열 밖 — 칠 값은 TokenRef 라 `//` 를 담지 않는다). */
function commentsIn(range: string): string[] {
  return [...range.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g)].map((m) => m[0]);
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
const skipped: string[] = [];
let converted = 0;
for (const ruleProp of tableObject.properties) {
  const type = nameOf(ruleProp);
  if (!type || (only.size > 0 && !only.has(type))) continue;
  if (!ts.isPropertyAssignment(ruleProp)) continue;
  if (!ts.isObjectLiteralExpression(ruleProp.initializer)) {
    skipped.push(`${type}: rule is not an object literal`);
    continue;
  }
  const rule = table[type];
  const variantsProp = propOf(ruleProp.initializer, "variants");
  if (!rule || !variantsProp) continue;
  if (!ts.isObjectLiteralExpression(variantsProp.initializer)) {
    skipped.push(`${type}: variants is not an object literal`);
    continue;
  }
  const reach = rulePaintReach(type, rule);
  const fsv = rule.fillStyleValues;
  for (const variantProp of variantsProp.initializer.properties) {
    const name = nameOf(variantProp);
    if (!name || !ts.isPropertyAssignment(variantProp)) continue;
    const init = variantProp.initializer;
    if (!ts.isObjectLiteralExpression(init)) {
      skipped.push(`${type}.${name}: variant is not an object literal`);
      continue;
    }
    const fillProp = propOf(init, "fill");
    const colorsProp = propOf(init, "colors");
    if (!fillProp) continue;
    if (
      !literalOnly(fillProp.initializer) ||
      (colorsProp && !literalOnly(colorsProp.initializer))
    ) {
      skipped.push(`${type}.${name}: non-literal fill / colors value`);
      continue;
    }
    // (the source variant still in the legacy shape — `fill` · `colors` literals)
    const variant = rule.variants[name] as unknown as LegacyVariantPaint;
    const paint = variantPaintTree(variant, fsv, reach);
    const alpha = variant.fill.alpha;
    const comments = [fillProp, colorsProp]
      .filter((p): p is ts.PropertyAssignment => !!p)
      .flatMap((p) => commentsIn(text.slice(p.getFullStart(), p.getEnd())));
    const rest = init.properties
      .filter((p) => p !== fillProp && p !== colorsProp)
      .map((p) =>
        text.slice(p.getFullStart(), p.getEnd()).replace(/^\s*\n/, "\n"),
      );
    const indent = "        ";
    const body = [
      ...comments.map((c) => `${indent}${c}`),
      `${indent}paint: ${serialize(paint, indent)},`,
      ...(alpha !== undefined ? [`${indent}alpha: ${alpha},`] : []),
      ...rest.map((r) => `${r.trimEnd()},`),
    ].join("\n");
    edits.push({
      start: init.getStart(),
      end: init.getEnd(),
      text: `{\n${body}\n      }`,
    });
    converted += 1;
  }
}

let out = text;
for (const edit of edits.sort((a, b) => b.start - a.start))
  out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
if (!dry) writeFileSync(file, out);
console.log(JSON.stringify({ converted, skipped, dry }, null, 2));
