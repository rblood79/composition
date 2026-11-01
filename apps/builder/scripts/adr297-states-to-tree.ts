/**
 * ADR-297 Phase 3b codemod — rule 의 `structure.states` (상태별 CSS 맵) 를 `structure.stateStyles` (속성마다 조건 트리) 로.
 * 손 분류 금지 — 트리는 생성기가 지금 내는 **실효값** 에서 만든다 (`CSSGenerator` `generateStateStyles` 의 규칙 그대로):
 * 생성 CSS 를 내는 rule 은 `states` 가 없거나 비어도 focus ring (`{focus.ring.default}`) 과 disabled 블록 (opacity 0.38 ·
 * cursor not-allowed · pointer-events none) 을 받으므로 그 값을 트리에 적는다. 생성 CSS 를 내지 않는 rule
 * (skipCSSGeneration · DOM class 가 다른 rule) 과 시트가 Preview 번들 (`index.css`) 에 실리지 않는 rule 은 적힌 값만
 * 옮긴다 (Canvas 의 disabled 흐림이 읽는 값 — 두 쪽 모두 값 변경 0).
 *
 *   pnpm -F @composition/builder exec tsx scripts/adr297-states-to-tree.ts [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { getPrimitiveBinding } from "../../../packages/shared/src/catalog/bindings";
import { COMPONENT_RULES_TABLE } from "../../../packages/shared/src/catalog/generated/componentRulesTable";

type States = Record<string, Record<string, unknown> | undefined>;
type Tree = Record<string, Record<string, string | number>>;

const dry = process.argv.includes("--dry");
const file = path.resolve(
  import.meta.dirname,
  "../../../packages/shared/src/catalog/generated/componentRulesTable.ts",
);
const text = readFileSync(file, "utf8");
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const table = COMPONENT_RULES_TABLE as unknown as Record<
  string,
  { structure?: Record<string, unknown> }
>;

/** Preview 번들 (`styles/index.css`) 이 싣는 생성 시트 — 안 실리는 시트의 상태 블록은 DOM 에 닿지 않는다. */
const LOADED_SHEETS = new Set(
  [
    ...readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../../packages/shared/src/components/styles/index.css",
      ),
      "utf8",
    ).matchAll(/@import\s+"\.\/generated\/([A-Za-z]+)\.css"/g),
  ].map((m) => m[1]),
);

/**
 * `buildVirtualSpecs` 의 생성 멤버십 + 상태 블록 여부 (`skipStateStyles`) + 그 시트가 Preview 에 실리는가.
 * 셋 다 참일 때만 생성기 기본값 (ring · disabled) 이 DOM 의 실효값이다.
 */
function emitsStateBlocks(type: string): boolean {
  const sheet = type[0].toUpperCase() + type.slice(1);
  if (!LOADED_SHEETS.has(sheet)) return false;
  const structure = table[type]?.structure;
  if (!structure || structure.skipCSSGeneration || structure.skipStateStyles)
    return false;
  const dom = getPrimitiveBinding(type)?.source as
    { kind?: string; component?: string } | undefined;
  return !(
    dom?.kind === "rac" &&
    dom.component !== type &&
    dom.component?.toLowerCase() !== type.toLowerCase()
  );
}

const DEFAULT_STATES: States = {
  hover: {},
  pressed: {},
  disabled: { opacity: 0.38 },
  focusVisible: {},
};

/**
 * 생성기 기본 disabled 블록 (적힌 `disabled.opacity` 없음) 이 실제로 닿는 요소 — DOM 이 `data-disabled` 를 내는 것만
 * (D1: 설치된 RAC `Link` · `SliderOutput` · `SliderFill` 은 내고 · composition `Card.tsx` 는 낸다. RAC `Form` ·
 * `Separator` · `Header` 와 나머지 internal renderer 는 내지 않아 그 블록은 죽어 있었다 — 트리에 두면 Canvas 가 흐림을
 * 새로 그린다: Form 은 필드와 이중).
 */
const DOM_DISABLED_DEFAULT = new Set([
  "Link",
  "Card",
  "SliderOutput",
  "SliderFill",
]);

/** 옛 상태 맵 → 트리. `full` = 생성기 기본값 포함 (생성 CSS 를 내는 rule). */
function treeOf(
  states: States | undefined,
  full: boolean,
  type: string,
): Tree {
  const s = states ?? (full ? DEFAULT_STATES : {});
  const tree: Tree = {};
  const put = (property: string, condition: string, value: unknown) => {
    if (value === undefined) return;
    (tree[property] ??= {})[condition] = value as string | number;
  };
  const known: Record<string, readonly string[]> = {
    hover: ["background"],
    pressed: ["scale", "boxShadow"],
    disabled: ["opacity", "cursor", "pointerEvents"],
    focusVisible: ["focusRing"],
  };
  for (const [state, decl] of Object.entries(s))
    for (const key of Object.keys(decl ?? {}))
      if (!known[state]?.includes(key))
        throw new Error(`unhandled state key ${state}.${key}`);
  put("background", "isHovered", s.hover?.background);
  if (full || s.focusVisible?.focusRing !== undefined)
    put(
      "focusRing",
      "isFocusVisible",
      s.focusVisible?.focusRing ?? "{focus.ring.default}",
    );
  if (s.pressed?.scale !== undefined)
    put("transform", "isPressed", `scale(${s.pressed.scale})`);
  put("boxShadow", "isPressed", s.pressed?.boxShadow);
  let d = s.disabled;
  if (
    full &&
    states?.disabled?.opacity === undefined &&
    !DOM_DISABLED_DEFAULT.has(type)
  ) {
    full = false;
    d = states?.disabled;
  }
  put("opacity", "isDisabled", full ? (d?.opacity ?? 0.38) : d?.opacity);
  put("cursor", "isDisabled", full ? (d?.cursor ?? "not-allowed") : d?.cursor);
  put(
    "pointerEvents",
    "isDisabled",
    full ? (d?.pointerEvents ?? "none") : d?.pointerEvents,
  );
  return tree;
}

const RING = '{"isFocusVisible":"{focus.ring.default}"}';
const INERT = {
  opacity: '{"isDisabled":0.38}',
  cursor: '{"isDisabled":"not-allowed"}',
  pointerEvents: '{"isDisabled":"none"}',
};
function serialize(tree: Tree, indent: string): string {
  const inner = `${indent}  `;
  const lines: string[] = [];
  const inert = (Object.keys(INERT) as (keyof typeof INERT)[]).every(
    (k) => JSON.stringify(tree[k]) === INERT[k],
  );
  for (const [property, branch] of Object.entries(tree)) {
    if (property === "focusRing" && JSON.stringify(branch) === RING) {
      lines.push(`${inner}...FOCUS_RING_STATE,`);
      continue;
    }
    if (inert && property in INERT) {
      if (property === "opacity") lines.push(`${inner}...DISABLED_STATE,`);
      continue;
    }
    const body = Object.entries(branch)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(", ");
    lines.push(`${inner}${property}: { ${body} },`);
  }
  return `{\n${lines.join("\n")}\n${indent}}`;
}

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
const report: Record<string, number> = { replaced: 0, inserted: 0 };
const skipped: string[] = [];
for (const ruleProp of tableObject.properties) {
  const type = nameOf(ruleProp);
  if (!type || !ts.isPropertyAssignment(ruleProp)) continue;
  if (!ts.isObjectLiteralExpression(ruleProp.initializer)) continue;
  const structureProp = propOf(ruleProp.initializer, "structure");
  if (!structureProp) continue;
  if (!ts.isObjectLiteralExpression(structureProp.initializer)) {
    skipped.push(`${type}: structure is not an object literal`);
    continue;
  }
  const structure = structureProp.initializer;
  const statesProp = propOf(structure, "states");
  const states = table[type]?.structure?.states as States | undefined;
  const full = emitsStateBlocks(type);
  const tree = treeOf(states, full, type);
  const indent = "      ";
  if (statesProp) {
    const replacement =
      Object.keys(tree).length > 0
        ? `stateStyles: ${serialize(tree, indent)}`
        : undefined;
    if (replacement)
      edits.push({
        start: statesProp.getStart(),
        end: statesProp.getEnd(),
        text: replacement,
      });
    else {
      // (an empty state map on a rule that emits no state blocks — the property goes)
      const full = text.slice(statesProp.getFullStart(), statesProp.getEnd());
      const after = text.slice(statesProp.getEnd()).match(/^\s*,/)?.[0] ?? "";
      edits.push({
        start: statesProp.getFullStart(),
        end: statesProp.getEnd() + after.length,
        text: full.match(/^\s*\/\/[^\n]*\n/)?.[0] ?? "",
      });
    }
    report.replaced += 1;
  } else if (Object.keys(tree).length > 0) {
    const last = structure.properties[structure.properties.length - 1];
    const at = last ? last.getEnd() : structure.getStart() + 1;
    const comma = last && !/^\s*,/.test(text.slice(at)) ? "," : "";
    const commaEnd = last
      ? at + (text.slice(at).match(/^\s*,/)?.[0].length ?? 0)
      : at;
    edits.push({
      start: commaEnd,
      end: commaEnd,
      text: `${comma}\n${indent}stateStyles: ${serialize(tree, indent)},`,
    });
    report.inserted += 1;
  }
}

let out = text;
for (const edit of edits.sort((a, b) => b.start - a.start))
  out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
const CONSTANTS = `/**
 * ADR-297 Phase 3b — 상태 스타일 트리 (\`structure.stateStyles\`) 에서 rule 대부분이 같이 쓰는 가지: 키보드 focus 의 ring
 * 과 disabled 의 흐림 · 조작 차단. 생성 CSS 는 \`compileConditionTree\` 로 (\`:where([data-focus-visible])\` ·
 * \`:where([data-disabled])\`), Canvas 는 disabled 흐림을 같은 트리에서 읽는다 (\`disabledStateRules\`).
 */
const FOCUS_RING_STATE = {
  focusRing: { isFocusVisible: "{focus.ring.default}" },
} as const;
const DISABLED_STATE = {
  opacity: { isDisabled: 0.38 },
  cursor: { isDisabled: "not-allowed" },
  pointerEvents: { isDisabled: "none" },
} as const;

`;
if (!out.includes("const FOCUS_RING_STATE")) {
  const anchor = out.indexOf("export const COMPONENT_RULES_TABLE");
  const docStart = out.lastIndexOf("/**", anchor);
  const at =
    docStart >= 0 && !out.slice(docStart, anchor).includes("*/\n\n")
      ? docStart
      : anchor;
  out = out.slice(0, at) + CONSTANTS + out.slice(at);
}
if (!dry) writeFileSync(file, out);
console.log(JSON.stringify({ ...report, skipped, dry }, null, 2));
