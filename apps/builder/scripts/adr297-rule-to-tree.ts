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
import {
  variantPaintTree,
  type LegacyVariantPaint,
} from "../../../packages/shared/src/catalog/rule/rulePaintTree";
import type { ComponentRule } from "../../../packages/shared/src/types/catalog-style.types";

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
