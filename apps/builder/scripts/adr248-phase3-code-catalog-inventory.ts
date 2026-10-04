// Reproducible Phase 3 source/binding audit. Reads the live code catalog and frozen coverage.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { componentCatalog } from "../../../packages/shared/src/catalog/componentCatalog";
import { COMPONENT_RULES_TABLE } from "../../../packages/shared/src/catalog/generated/componentRulesTable";
import { SLOT_ROLES } from "../../../packages/shared/src/catalog/slotRoles";
import { CODE_CATALOG_SUPPORTED_TYPES } from "../../../packages/shared/src/catalog/document/codeCatalogLibrary";

const repoRoot = resolve(import.meta.dirname, "../../..");
const coveragePath = resolve(
  repoRoot,
  "docs/adr/design/248-phase3-coverage.json",
);
const outputPath = resolve(
  repoRoot,
  "docs/adr/design/248-phase3-code-catalog-inventory.json",
);
const coverage = JSON.parse(readFileSync(coveragePath, "utf8")) as {
  sourceHead: string;
  types: {
    type: string;
    requiredAxes: string[];
    oldFixtureCoverage: string;
    g3: string;
  }[];
  slotRoles: { role: string; g3: string }[];
};
const table = COMPONENT_RULES_TABLE as Record<
  string,
  {
    variants?: Record<
      string,
      { fill?: Record<string, Record<string, unknown>> }
    >;
    sizes?: Record<string, unknown>;
    structure?: Record<string, unknown>;
  }
>;
const registered = new Map<string, (typeof componentCatalog)[number][]>();
for (const entry of componentCatalog) {
  const group = registered.get(entry.type) ?? [];
  group.push(entry);
  registered.set(entry.type, group);
}
const names = new Set([...registered.keys(), ...Object.keys(table)]);
const frozen = new Set(coverage.types.map(({ type }) => type));
if (
  names.size !== 130 ||
  frozen.size !== 130 ||
  [...names].some((type) => !frozen.has(type))
)
  throw new Error("ADR248_TYPE_SOURCE_DRIFT");
if (
  coverage.types.reduce((sum, item) => sum + item.requiredAxes.length, 0) !==
  1333
)
  throw new Error("ADR248_AXIS_SOURCE_DRIFT");
if (
  SLOT_ROLES.length !== 14 ||
  coverage.slotRoles.length !== 14 ||
  SLOT_ROLES.some(
    (role) => !coverage.slotRoles.some((item) => item.role === role),
  )
)
  throw new Error("ADR248_ROLE_SOURCE_DRIFT");

const supported = new Set<string>(CODE_CATALOG_SUPPORTED_TYPES);
const types = coverage.types.map((item) => {
  const entries = registered.get(item.type) ?? [];
  const rule = table[item.type];
  const primitive = entries.find((entry) => entry.kind === "primitive");
  const reasons: string[] = [];
  if (!entries.length) reasons.push("NO_COMPONENT_CATALOG_REGISTRATION");
  if (!rule) reasons.push("NO_COMPONENT_RULES_TABLE_ENTRY");
  if (entries.some((entry) => entry.kind === "reusable"))
    reasons.push("REUSABLE_ORIGIN_NOT_TYPED_LIBRARY_TEMPLATE");
  if (entries.some((entry) => entry.kind === "native"))
    reasons.push("NATIVE_METADATA_ONLY_OR_SPEC_RESIDUE");
  if (primitive?.kind === "primitive" && primitive.binding.skiaPrimitive)
    reasons.push("SKIA_PRIMITIVE_CAPABILITY_NOT_REGISTERED_IN_NEW_ROOT");
  if (!supported.has(item.type))
    reasons.push("NO_COMPLETE_TYPED_VISUAL_AND_CONSUMER_BINDING");
  // The frozen axes are obligations, not a claim that every old rule is executable.
  const axes = item.requiredAxes.map((axis) => {
    const [kind, value] = axis.split(":", 2);
    const exact =
      axis === "base"
        ? Boolean(rule)
        : kind === "variant"
          ? Boolean(rule?.variants?.[value])
          : kind === "size"
            ? Boolean(rule?.sizes?.[value])
            : false;
    const familyOnly =
      !exact &&
      (kind === "structure-state"
        ? Boolean(rule?.structure)
        : kind === "paint-state"
          ? Boolean(rule?.variants)
          : false);
    return {
      axis,
      source: exact
        ? axis === "base"
          ? `COMPONENT_RULES_TABLE.${item.type}`
          : `COMPONENT_RULES_TABLE.${item.type}.${kind === "variant" ? "variants" : "sizes"}.${value}`
        : familyOnly
          ? `COMPONENT_RULES_TABLE.${item.type}.${kind === "paint-state" ? "variants" : "structure"}`
          : null,
      sourceResolution: exact
        ? "EXACT_RULE_KEY"
        : familyOnly
          ? "RULE_FAMILY_ONLY_AXIS_UNVERIFIED"
          : "SOURCE_NOT_CONFIRMED",
      consumer: "UNVERIFIED",
    };
  });
  return {
    type: item.type,
    registration: entries.map((entry) => ({
      kind: entry.kind,
      family: entry.family,
      ...(entry.kind === "primitive"
        ? {
            bindingSource: entry.binding.source,
            propKinds: Object.fromEntries(
              Object.entries(entry.binding.props.accepts).map(
                ([name, contract]) => [name, contract.kind],
              ),
            ),
          }
        : entry.kind === "reusable"
          ? { reusableId: entry.reusableId }
          : {}),
    })),
    ruleSource: rule ? `COMPONENT_RULES_TABLE.${item.type}` : null,
    axes,
    immutableDefinition: supported.has(item.type)
      ? `lib:definition:${item.type.toLowerCase()}`
      : null,
    definitionScope: supported.has(item.type)
      ? "TYPED_TEXT_DEFAULT_AND_SIZE_ONLY"
      : "UNSUPPORTED",
    bindingPossible: supported.has(item.type)
      ? "PRODUCT_PATH_TEXT_LEAF_BASIC"
      : "UNVERIFIED",
    unsupportedReasons: reasons,
    oldFixtureCoverage: item.oldFixtureCoverage,
    g3: item.g3,
  };
});
const roles = SLOT_ROLES.map((role) => ({
  role,
  source: "packages/shared/src/catalog/slotRoles.ts:SLOT_ROLES",
  typedRegionName: role,
  bindingPossible: "UNVERIFIED_ROLE_SEMANTIC_AND_VISUAL_CONSUMER",
  g3: coverage.slotRoles.find((item) => item.role === role)?.g3,
}));
const sourceFiles = [
  "packages/shared/src/catalog/componentCatalog.ts",
  "packages/shared/src/catalog/generated/componentRulesTable.ts",
  "packages/shared/src/catalog/slotRoles.ts",
  "packages/rendering/src/renderers/utils/tokenResolver.ts",
  "packages/rendering/src/primitives/colors.ts",
  "packages/rendering/src/primitives/typography.ts",
  "packages/rendering/src/primitives/radius.ts",
].map((path) => ({
  path,
  sha256: createHash("sha256")
    .update(readFileSync(resolve(repoRoot, path)))
    .digest("hex"),
}));
const result = {
  sourceHead: coverage.sourceHead,
  sourceFiles,
  coveragePath: "docs/adr/design/248-phase3-coverage.json",
  counts: {
    componentCatalogRegistrations: componentCatalog.length,
    componentCatalogUniqueTypes: registered.size,
    rulesTableTypes: Object.keys(table).length,
    unionTypes: names.size,
    requiredAxes: types.reduce((sum, item) => sum + item.axes.length, 0),
    exactSourceAxes: types
      .flatMap((item) => item.axes)
      .filter((axis) => axis.sourceResolution === "EXACT_RULE_KEY").length,
    familyOnlySourceAxes: types
      .flatMap((item) => item.axes)
      .filter(
        (axis) => axis.sourceResolution === "RULE_FAMILY_ONLY_AXIS_UNVERIFIED",
      ).length,
    unconfirmedSourceAxes: types
      .flatMap((item) => item.axes)
      .filter((axis) => axis.sourceResolution === "SOURCE_NOT_CONFIRMED")
      .length,
    slotRoles: roles.length,
    sourceDerivedDefinitions: types.filter((item) => item.immutableDefinition)
      .length,
  },
  types,
  roles,
};
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${outputPath}\n${JSON.stringify(result.counts)}\n`);
