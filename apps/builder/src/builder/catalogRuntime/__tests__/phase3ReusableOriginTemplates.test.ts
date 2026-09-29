// @vitest-environment node
/**
 * ADR-248 Phase 3 — composite template policy (user decision 2026-09-29).
 *
 * The 60 registered reusable origins (plus the auxiliary origins they reference) are converted once
 * from the Builder's `catalogOrigins.ts` seed into typed `lib:*` definitions/templates. The written
 * module `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` is the code-catalog
 * source of truth; this test re-derives it and compares (대조) stable IDs, child order, props, slot and
 * visual values against the canonical origins, proves every canonical field is either represented or
 * listed as a contract gap, and resolves an instance of every definition through the real resolver.
 *
 * Regenerate only on purpose: `ADR248_WRITE_REUSABLE_ORIGINS=1`.
 */
import "fake-indexeddb/auto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { CanonicalNode } from "@composition/shared";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../../../packages/shared/src/catalog/document/fixture";
import type {
  CatalogEntry,
  LibraryTemplateNode,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  resolveCatalogNode,
  type ResolvedCatalogNode,
} from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import {
  convertReusableOrigins,
  originDefinitionId,
  originTemplateId,
} from "./support/reusableOriginConverter";
import { buildReusableOriginSource } from "./support/reusableOriginSource";

const repo = resolve(process.cwd(), "../..");
const generatedPath = resolve(
  repo,
  "packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts",
);
const gapsPath = resolve(
  repo,
  "docs/adr/design/248-phase3-reusable-origin-contract-gaps.json",
);
const write = process.env.ADR248_WRITE_REUSABLE_ORIGINS === "1";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T12:00:00+09:00"));
  vi.spyOn(navigator, "language", "get").mockReturnValue("ko-KR");
});
afterAll(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const childrenOf = (node: CanonicalNode): CanonicalNode[] =>
  Array.isArray(node.children) ? node.children : [];

/** Independent field-path walk of the canonical input (not the converter's own bookkeeping). */
function canonicalFieldPaths(origins: readonly CanonicalNode[]): Set<string> {
  const paths = new Set<string>();
  const walk = (node: CanonicalNode) => {
    const add = (path: string) => paths.add(`${node.id}\u0000${path}`);
    for (const [field, value] of Object.entries(node)) {
      if (value === undefined) continue;
      if (field === "props") {
        const props = value as Record<string, unknown>;
        if (Object.keys(props).length === 0) add("props");
        for (const [key, prop] of Object.entries(props)) {
          if (
            key === "style" &&
            prop &&
            typeof prop === "object" &&
            !Array.isArray(prop)
          )
            for (const styleKey of Object.keys(prop))
              add(`props.style.${styleKey}`);
          else add(`props.${key}`);
        }
      } else if (field === "metadata") {
        for (const [key, entry] of Object.entries(value as object))
          if (entry !== undefined) add(`metadata.${key}`);
      } else if (field === "descendants")
        for (const [key, patch] of Object.entries(value as object)) {
          if (!patch || typeof patch !== "object") {
            add(`descendants.${key}`);
            continue;
          }
          for (const [field, entry] of Object.entries(patch))
            if (
              field === "style" &&
              entry &&
              typeof entry === "object" &&
              !Array.isArray(entry)
            )
              for (const styleKey of Object.keys(entry))
                add(`descendants.${key}.style.${styleKey}`);
            else add(`descendants.${key}.${field}`);
        }
      else add(field);
    }
    childrenOf(node).forEach(walk);
  };
  origins.forEach(walk);
  return paths;
}

const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;
const UUID_MARKER = "<uuid-v4:nondeterministic-seed>";
function normalizeUuids<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value).replace(new RegExp(UUID.source, "g"), UUID_MARKER),
  ) as T;
}

function countBy<T>(items: readonly T[], key: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

it("converts every reusable origin into typed lib:* templates, accounts for every field, and resolves them", async () => {
  const source = buildReusableOriginSource();
  const conversion = convertReusableOrigins(source.origins);

  // ── Source scope: 60 registered entries, each an origin definition ──────
  expect(source.entries).toHaveLength(60);
  const definitionIds = new Set(conversion.definitions.map((item) => item.id));
  for (const entry of source.entries)
    expect(definitionIds.has(originDefinitionId(entry.reusableId))).toBe(true);

  // ── No silent drop: canonical fields = represented ⊔ gaps ────────────
  const canonical = canonicalFieldPaths(source.origins);
  const represented = new Set(conversion.represented);
  const gapped = new Set(
    conversion.gaps.map((gap) => `${gap.nodeId}\u0000${gap.path}`),
  );
  expect(represented.size).toBe(conversion.represented.length);
  expect([...represented].filter((path) => gapped.has(path))).toEqual([]);
  expect(
    [...canonical].filter(
      (path) => !represented.has(path) && !gapped.has(path),
    ),
  ).toEqual([]);
  expect(
    [...represented, ...gapped].filter((path) => !canonical.has(path)),
  ).toEqual([]);

  // ── Determinism of the one-time input ─────────────────────────────────
  // The seed issues fresh v4 UUIDs for collection item keys on every run. Typed output must be
  // byte-stable; such values may only live in gap records, where they are normalized and listed.
  const second = convertReusableOrigins(buildReusableOriginSource().origins);
  expect(second.definitions).toEqual(conversion.definitions);
  expect(second.templates).toEqual(conversion.templates);
  expect(second.represented).toEqual(conversion.represented);
  expect(JSON.stringify(conversion.templates)).not.toMatch(UUID);
  expect(JSON.stringify(conversion.definitions)).not.toMatch(UUID);
  const nondeterministicGapPaths = conversion.gaps
    .filter(
      (gap, index) =>
        JSON.stringify(gap) !== JSON.stringify(second.gaps[index]),
    )
    .map((gap) => ({ nodeId: gap.nodeId, path: gap.path }));
  expect(nondeterministicGapPaths.length).toBeGreaterThan(0);
  expect(normalizeUuids(second.gaps)).toEqual(normalizeUuids(conversion.gaps));
  conversion.gaps = normalizeUuids(conversion.gaps);

  const gapReport = {
    policy:
      "ADR-248 Phase 3 user decision 2026-09-29: typed lib:* templates are the code-catalog source of truth; canonical-only fields are reported, never dropped",
    input:
      "ensureComponentsSystemPage → ensureReusableCompositeOrigins (catalogOrigins.ts + template ensurers) on a fresh document; Modal via buildCatalogOrigin",
    counts: {
      registeredEntries: source.entries.length,
      origins: source.origins.length,
      directOrigins: source.directOriginIds,
      compositeDefinitions: conversion.definitions.length,
      templates: conversion.templates.length,
      typeDefinitions: conversion.typeDefinitions.length,
      canonicalFields: canonical.size,
      representedFields: represented.size,
      gapFields: gapped.size,
    },
    nondeterministicSource: {
      finding:
        "catalog origin seed assigns a fresh v4 UUID to collection item keys on every hydration; node IDs are stable. Values below are normalized to UUID_MARKER and never enter typed templates.",
      marker: UUID_MARKER,
      paths: nondeterministicGapPaths,
    },
    gapsByReason: countBy(conversion.gaps, (gap) => gap.reason),
    gapsByOrigin: countBy(conversion.gaps, (gap) => gap.originId),
    gaps: conversion.gaps,
  };

  if (write) {
    mkdirSync(dirname(generatedPath), { recursive: true });
    writeFileSync(
      generatedPath,
      [
        "// ADR-248 Phase 3 — typed reusable origin library (code-catalog source of truth).",
        "// Converted once from the Builder origin seed (catalogOrigins.ts + template ensurers) by",
        "// apps/builder/src/builder/catalogRuntime/__tests__/phase3ReusableOriginTemplates.test.ts",
        "// (ADR248_WRITE_REUSABLE_ORIGINS=1), which also compares it against that seed. The runtime",
        "// reads only this module — never canonical nodes. Canonical-only fields are listed in",
        "// docs/adr/design/248-phase3-reusable-origin-contract-gaps.json.",
        'import type { LibraryDefinition, LibraryTemplateNode } from "../types";',
        "",
        `export const REUSABLE_ORIGIN_DEFINITIONS: readonly LibraryDefinition[] = ${JSON.stringify(conversion.definitions, null, 2)};`,
        "",
        `export const REUSABLE_ORIGIN_TEMPLATES: readonly LibraryTemplateNode[] = ${JSON.stringify(conversion.templates, null, 2)};`,
        "",
      ].join("\n"),
    );
    writeFileSync(gapsPath, `${JSON.stringify(gapReport, null, 2)}\n`);
    return;
  }

  // ── 대조: the written source of truth equals the conversion ───────────
  const generated =
    await import("../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary");
  expect(generated.REUSABLE_ORIGIN_DEFINITIONS).toEqual(conversion.definitions);
  expect(generated.REUSABLE_ORIGIN_TEMPLATES).toEqual(conversion.templates);
  expect(JSON.parse(readFileSync(gapsPath, "utf8"))).toEqual(
    JSON.parse(JSON.stringify(gapReport)),
  );

  // ── Independent comparison with the canonical origins ─────────────────
  const templates = new Map<string, LibraryTemplateNode>(
    generated.REUSABLE_ORIGIN_TEMPLATES.map((template) => [
      template.id,
      template,
    ]),
  );
  let compared = 0;
  const definitions = new Map(
    generated.REUSABLE_ORIGIN_DEFINITIONS.map((definition) => [
      definition.id,
      definition,
    ]),
  );
  const compare = (node: CanonicalNode, origin: CanonicalNode = node) => {
    const template = templates.get(originTemplateId(node.id));
    expect(template, node.id).toBeDefined();
    compared++;
    expect(template!.children).toEqual(
      childrenOf(node).map((child) => originTemplateId(child.id)),
    );
    if (node.type === "ref")
      expect(template!.definitionId).toBe(
        originDefinitionId(String((node as { ref?: unknown }).ref)),
      );
    const props = (node.props ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(template!.props)) {
      // A propagated child prop binds the owner prop (`{label}`): the composite default carries
      // the canonical value.
      const bound = typeof value === "string" ? /^\{(\w+)\}$/.exec(value)?.[1] : undefined;
      if (bound && node !== origin && props[key] !== value) {
        const defaults = definitions.get(originDefinitionId(origin.id))?.defaults;
        expect(defaults?.[bound], `${node.id}.${key} ← {${bound}}`).toBe(
          props[key] ?? defaults?.[bound],
        );
        continue;
      }
      expect(props[key], `${node.id}.${key}`).toBe(value);
    }
    const style = (props.style ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(template!.visual)) {
      // Typed px units: a canonical `"Npx"` is the number N, and a leaf's px line height is the
      // ratio N / its font size.
      const raw = style[key];
      const px =
        typeof raw === "string" && typeof value === "number"
          ? /^(\d+(?:\.\d+)?)px$/.exec(raw.trim())
          : null;
      const expected = px
        ? key === "lineHeight"
          ? Number(px[1]) / Number(style.fontSize)
          : Number(px[1])
        : raw;
      expect(value, `${node.id}.style.${key}`).toBe(expected);
    }
    expect(template!.slot).toBeUndefined();
    childrenOf(node).forEach((child) => compare(child, origin));
  };
  source.origins.forEach((origin) => compare(origin));
  expect(compared).toBe(templates.size);

  // ── Consumption: code library validates and the resolver projects each definition ──
  const library = await buildCodeCatalogLibrary();
  for (const definition of generated.REUSABLE_ORIGIN_DEFINITIONS)
    expect(library.definitions.get(definition.id)).toEqual(definition);
  const { document: seed } = createG1Fixture();
  const page = seed.entries["project:page:main"] as Extract<
    CatalogEntry,
    { kind: "page" }
  >;
  const instances: NodeEntry[] = source.entries.map((entry) => ({
    kind: "node",
    id: `project:node:instance-${entry.reusableId}`,
    definitionId: originDefinitionId(entry.reusableId),
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }));
  const graph = new CatalogGraph(
    {
      ...seed,
      entries: {
        [seed.projectId]: seed.entries[seed.projectId],
        [page.id]: { ...page, children: instances.map((item) => item.id) },
        ...Object.fromEntries(instances.map((item) => [item.id, item])),
      },
    },
    library,
  );
  const origins = new Map(source.origins.map((origin) => [origin.id, origin]));
  const expectProjection = (
    resolved: ResolvedCatalogNode,
    node: CanonicalNode,
  ) => {
    expect(resolved.sourceId).toBe(originTemplateId(node.id));
    const own = resolved.children.slice(node.type === "ref" ? 1 : 0);
    expect(own.map((child) => child.sourceId)).toEqual(
      childrenOf(node).map((child) => originTemplateId(child.id)),
    );
    if (node.type === "ref") {
      const target = origins.get(String((node as { ref?: unknown }).ref))!;
      expect(resolved.children[0].sourceId).toBe(originTemplateId(target.id));
    }
    childrenOf(node).forEach((child, index) =>
      expectProjection(own[index], child),
    );
  };
  for (const [index, entry] of source.entries.entries()) {
    const resolved = resolveCatalogNode(graph, instances[index].id);
    expect(resolved.children).toHaveLength(1);
    expectProjection(resolved.children[0], origins.get(entry.reusableId)!);
  }
}, 120_000);
