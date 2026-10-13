/**
 * S2 prop 정렬 조사 — 우리 쪽 입력 (catalog binding accepts · rule variant/size 이름) 을 뽑는다.
 * 실행: pnpm -F @composition/rendering exec tsx "$PWD/docs/explanation/research/s2-prop-alignment-2026-10/extract-ours.ts" <outDir>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { getPrimitiveBinding } from "../../../../packages/shared/src/catalog/bindings";
import { COMPONENT_RULES_TABLE } from "../../../../packages/shared/src/catalog/generated/componentRulesTable";

const outDir = process.argv[2] ?? ".";
// The registry is not exported: its keys are read from the source.
const src = readFileSync(
  new URL(
    "../../../../packages/shared/src/catalog/bindings/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const start = src.indexOf("const PRIMITIVE_BINDINGS");
const body = src.slice(start, src.indexOf("\n};", start));
const keys = [...body.matchAll(/^\s{2}([A-Z]\w*):/gm)].map((m) => m[1]!);

const ours: Record<string, Record<string, unknown>> = {};
const rules: Record<string, unknown> = {};
for (const key of keys) {
  const binding = getPrimitiveBinding(key) as
    | { props?: { accepts?: Record<string, Record<string, unknown>> } }
    | undefined;
  const props: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(binding?.props?.accepts ?? {})) {
    const entry: Record<string, unknown> = { kind: spec.kind };
    if (Array.isArray(spec.options))
      entry.options = spec.options.map((o: unknown) =>
        typeof o === "object" && o ? (o as { value: unknown }).value : o,
      );
    if (spec.default !== undefined) entry.default = spec.default;
    if (spec.editorHidden || spec.hidden) entry.hidden = true;
    props[name] = entry;
  }
  ours[key] = props;
  const rule = (
    COMPONENT_RULES_TABLE as Record<
      string,
      { variants?: object; sizes?: object }
    >
  )[key];
  rules[key] = {
    variants: Object.keys(rule?.variants ?? {}),
    sizes: Object.keys(rule?.sizes ?? {}),
  };
}
writeFileSync(`${outDir}/ours.json`, JSON.stringify(ours, null, 1));
writeFileSync(`${outDir}/rules.json`, JSON.stringify(rules));
console.log(keys.length, "types");
