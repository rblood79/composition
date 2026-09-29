// ADR-248 G0: pair every public visual-rule field with frozen table values and old consumer routes.
// Source/consumer classification is not a DOM/Canvas behavior or future graph PASS.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPONENT_RULES_TABLE } from "../../../packages/shared/src/catalog/generated/componentRulesTable";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const read = (name: string) =>
  JSON.parse(readFileSync(resolve(baselineDir, name), "utf8"));
const inventory = read("inventory.json");
const uses = read("visual-field-uses.json");
const bridges = read("visual-bridge-audit.json");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (
  head !== inventory.baselineHead ||
  head !== uses.baselineHead ||
  head !== bridges.baselineHead
)
  throw new Error("Visual value-source audit uses another baseline HEAD");

type Rule = (typeof COMPONENT_RULES_TABLE)[string];
type FieldOwner = {
  type: string;
  path: string;
  value: Record<string, unknown>;
};
const owners: Record<string, (type: string, rule: Rule) => FieldOwner[]> = {
  ComponentRule: (type, rule) => [
    { type, path: type, value: rule as Record<string, unknown> },
  ],
  ComponentRuleStructure: (type, rule) =>
    rule.structure
      ? [
          {
            type,
            path: `${type}.structure`,
            value: rule.structure as Record<string, unknown>,
          },
        ]
      : [],
  ComponentRuleComposition: (type, rule) =>
    rule.structure?.composition
      ? [
          {
            type,
            path: `${type}.structure.composition`,
            value: rule.structure.composition as Record<string, unknown>,
          },
        ]
      : [],
  ComponentRuleStates: (type, rule) =>
    rule.structure?.states
      ? [
          {
            type,
            path: `${type}.structure.states`,
            value: rule.structure.states as Record<string, unknown>,
          },
        ]
      : [],
  ComponentRuleChart: (type, rule) =>
    rule.chart
      ? [
          {
            type,
            path: `${type}.chart`,
            value: rule.chart as Record<string, unknown>,
          },
        ]
      : [],
  ComponentRuleSize: (type, rule) =>
    Object.entries(rule.sizes).map(([name, value]) => ({
      type,
      path: `${type}.sizes.${name}`,
      value: value as Record<string, unknown>,
    })),
  ComponentRuleDensity: (type, rule) =>
    Object.entries(rule.densities ?? {}).map(([name, value]) => ({
      type,
      path: `${type}.densities.${name}`,
      value: value as Record<string, unknown>,
    })),
  ComponentRuleContainerVariantStyles: (type, rule) =>
    Object.entries(rule.containerVariants ?? {}).flatMap(([attr, variants]) =>
      Object.entries(variants).map(([name, value]) => ({
        type,
        path: `${type}.containerVariants.${attr}.${name}`,
        value: value as Record<string, unknown>,
      })),
    ),
  ComponentRuleVariant: (type, rule) =>
    Object.entries(rule.variants).map(([name, value]) => ({
      type,
      path: `${type}.variants.${name}`,
      value: value as Record<string, unknown>,
    })),
  ComponentRuleVariantColors: (type, rule) =>
    Object.entries(rule.variants).flatMap(([name, value]) =>
      value.colors
        ? [
            {
              type,
              path: `${type}.variants.${name}.colors`,
              value: value.colors as Record<string, unknown>,
            },
          ]
        : [],
    ),
  ComponentRuleFill: (type, rule) =>
    Object.entries(rule.variants).map(([name, value]) => ({
      type,
      path: `${type}.variants.${name}.fill`,
      value: value.fill as Record<string, unknown>,
    })),
  ComponentRuleFillState: (type, rule) =>
    Object.entries(rule.variants).flatMap(([name, variant]) =>
      ["default", "outline", "subtle", "quiet"].flatMap((style) => {
        const value = variant.fill[style as keyof typeof variant.fill];
        return value && typeof value === "object"
          ? [
              {
                type,
                path: `${type}.variants.${name}.fill.${style}`,
                value: value as Record<string, unknown>,
              },
            ]
          : [];
      }),
    ),
};

const declared = new Map<string, string[]>(
  inventory.exportedInterfaces
    .filter((item: { name: string }) => item.name.startsWith("ComponentRule"))
    .map((item: { name: string; fields: { name: string }[] }) => [
      item.name,
      item.fields.map((field) => field.name),
    ]),
);
const rows = uses.rows.map(
  (row: {
    interface: string;
    field: string;
    sites: { path: string; line: number; test: boolean; source: string }[];
  }) => {
    const key = `${row.interface}.${row.field}`;
    const collect = owners[row.interface];
    if (!collect || !declared.get(row.interface)?.includes(row.field))
      throw new Error(`${key}: missing field owner`);
    const containers = Object.entries(COMPONENT_RULES_TABLE).flatMap(
      ([type, rule]) => collect(type, rule),
    );
    const extraKeys =
      row.field === "[index]"
        ? new Set(
            containers.flatMap(({ value }) =>
              Object.keys(value).filter(
                (field) => !declared.get(row.interface)?.includes(field),
              ),
            ),
          )
        : null;
    const authored = containers.flatMap(({ type, path, value }) => {
      const fields = extraKeys
        ? [...extraKeys].filter((field) => Object.hasOwn(value, field))
        : [row.field];
      return fields
        .filter((field) => Object.hasOwn(value, field))
        .map((field) => {
          const current = value[field];
          const json = JSON.stringify(current);
          return {
            type,
            path: `${path}.${field}`,
            valueKind: Array.isArray(current)
              ? "array"
              : current === null
                ? "null"
                : typeof current,
            value: typeof current === "object" ? undefined : current,
            valueSha256: createHash("sha256")
              .update(json ?? "undefined")
              .digest("hex"),
          };
        });
    });
    const direct = row.sites.filter((site) => !site.test);
    const indirect = bridges.indirectRoutes.filter(
      (route: { fields: string[] }) => route.fields.includes(key),
    );
    const chart = row.interface === "ComponentRuleChart";
    if (!direct.length && !indirect.length && !chart)
      throw new Error(`${key}: no old consumer route classified`);
    return {
      key,
      tablePath: "packages/shared/src/catalog/generated/componentRulesTable.ts",
      authoredCount: authored.length,
      authoredTypes: [...new Set(authored.map((sample) => sample.type))].length,
      samples: authored.slice(0, 5),
      currentValueStatus: authored.length
        ? "AUTHORED_IN_TABLE"
        : "NO_CURRENT_TABLE_VALUE",
      directConsumerSites: direct.length,
      directConsumerExamples: direct.slice(0, 5).map((site) => ({
        path: site.path,
        line: site.line,
        source: site.source,
      })),
      indirectRoutes: indirect.map(
        (route: {
          route: string;
          status: string;
          edges: [string, string][];
        }) => ({
          route: route.route,
          status: route.status,
          edges: route.edges,
        }),
      ),
      ...(chart
        ? {
            chartBridge:
              "rule.chart → generate-css/CSSGenerator and buildSpecNodeData/ChartRuleChannel; see visual-bridge-audit.json",
          }
        : {}),
      status: "OLD_SOURCE_AND_CONSUMER_CLASSIFIED; BEHAVIOR_UNVERIFIED",
    };
  },
);
if (
  rows.length !== 102 ||
  new Set(rows.map((row: { key: string }) => row.key)).size !== 102
)
  throw new Error("Expected 102 distinct visual rule fields");
const report = {
  baselineHead: head,
  method:
    "Read the frozen catalog table as code and combine typed direct consumers with the reviewed bridge routes. A table value and source route do not prove runtime visual behavior or project override propagation.",
  summary: {
    fields: rows.length,
    fieldsWithTableValue: rows.filter(
      (row: { authoredCount: number }) => row.authoredCount > 0,
    ).length,
    fieldsWithoutTableValue: rows
      .filter((row: { authoredCount: number }) => row.authoredCount === 0)
      .map((row: { key: string }) => row.key),
    fieldsWithClassifiedConsumer: rows.length,
    runtimeBehaviorVerified: 0,
  },
  rows,
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);
