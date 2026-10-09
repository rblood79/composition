import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { componentCatalog } from "../../../../../../packages/shared/src/catalog/componentCatalog";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogDocument,
  CatalogLibrary,
  DefinitionId,
  NodeEntry,
  StateName,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import {
  bindCatalogCanvas,
  CATALOG_CANVAS_BINDING_IDS,
} from "../canvasBinding";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import {
  CATALOG_DOM_BINDING_IDS,
  catalogDomRendersNode,
  renderCatalogDom,
} from "../domBinding";
import { CATALOG_DELEGATED_DOM } from "../../../../../../packages/shared/src/catalog/runtime/delegatedDom";
import { CatalogStorage } from "../storage";
import { CATALOG_RULE_EXECUTOR_PAINT_STATES } from "../rulePaint";
import { writeEvidence } from "./support/evidence";

/**
 * ADR-248 Phase 3 — G3 registered type/state census (recount only; no gate change). The type
 * universe is re-derived from the current registry (`componentCatalog` ∪ `COMPONENT_RULES_TABLE`);
 * every type is instantiated from the current typed library and run through the product
 * composition root, Canvas binding and DOM binding. Execution is the verdict; the static
 * binding sets below are cross-checked against it.
 */
const OUTPUT = resolve(
  process.cwd(),
  "../../docs/adr/design/248-phase3-g3-census.json",
);
/** Binding ids present in both product binding tables (`canvasBinding.ts`, `domBinding.tsx`). */
const PRODUCT_BINDINGS = new Set(
  [...CATALOG_CANVAS_BINDING_IDS].filter((id) =>
    CATALOG_DOM_BINDING_IDS.has(id),
  ),
);

type RawLayout = {
  buildTreeBatch(input: string): Uint32Array;
  createNodeRaw(input: string): number;
  updateStyleRaw(handle: number, input: string): boolean;
  setChildren(handle: number, children: Uint32Array): boolean;
  markDirty(handle: number): boolean;
  removeNode(handle: number): boolean;
  setViewport(width: number, height: number): void;
  computeLayout(handle: number, width: number, height: number): void;
  getLayout(handle: number): string;
  clear(): void;
  nodeCount(): number;
};
async function layoutEngineFactory(): Promise<() => LayoutEngineAPI> {
  const directory = resolve(
    process.cwd(),
    "src/builder/workspace/canvas/wasm-bindings/engine-pkg",
  );
  const glue = (await import(
    pathToFileURL(join(directory, "engine_bg.js")).href
  )) as {
    __wbg_set_wasm(value: WebAssembly.Exports): void;
    LayoutEngine: new () => RawLayout;
  };
  const instance = await WebAssembly.instantiate(
    readFileSync(join(directory, "engine_bg.wasm")),
    { "./engine_bg.js": glue },
  );
  glue.__wbg_set_wasm(instance.instance.exports);
  return () => {
    const raw = new glue.LayoutEngine();
    return {
      isAvailable: () => true,
      hasBinaryProtocol: () => false,
      buildTreeBatch: (input) => [...raw.buildTreeBatch(input)],
      buildTreeBatchBinary: () => {
        throw new Error("JSON harness only");
      },
      createNodeRaw: (input) => raw.createNodeRaw(input),
      updateStyleRaw: (handle, input) => raw.updateStyleRaw(handle, input),
      setChildren: (handle, children) =>
        raw.setChildren(handle, Uint32Array.from(children)),
      markDirty: (handle) => raw.markDirty(handle),
      removeNode: (handle) => raw.removeNode(handle),
      setViewport: (width, height) => raw.setViewport(width, height),
      computeLayout: (handle, width, height) =>
        raw.computeLayout(handle, width, height),
      getLayoutsBatch: (handles) =>
        new Map(
          handles.map((handle) => [handle, JSON.parse(raw.getLayout(handle))]),
        ),
      clear: () => raw.clear(),
      nodeCount: () => raw.nodeCount(),
    };
  };
}

/** G0 types whose old fixtures exist only inside a parent (`oldFixtureCoverage`). */
function parentContextTypes(): Set<string> {
  const coverage = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../../docs/adr/design/248-phase3-coverage.json"),
      "utf8",
    ),
  ) as { types: { type: string; oldFixtureCoverage: string }[] };
  return new Set(
    coverage.types
      .filter(
        (entry) => entry.oldFixtureCoverage === "INDIRECT_PARENT_CONTEXT_ONLY",
      )
      .map((entry) => entry.type),
  );
}

/** G0-frozen state axes per type (`248-phase3-coverage.json`, structure-state + paint-state). */
function stateAxes(): Map<string, string[]> {
  const coverage = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../../docs/adr/design/248-phase3-coverage.json"),
      "utf8",
    ),
  ) as { types: { type: string; requiredAxes: string[] }[] };
  return new Map(
    coverage.types.map((entry) => [
      entry.type,
      entry.requiredAxes.filter(
        (axis) =>
          axis.startsWith("structure-state:") ||
          axis.startsWith("paint-state:"),
      ),
    ]),
  );
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function run(
  library: CatalogLibrary,
  definitionId: DefinitionId,
  engine: LayoutEngineAPI,
  name: string,
) {
  const projectId = "project:project:census" as const;
  const pageId = "project:page:main" as const;
  const nodeId = "project:node:subject" as NodeEntry["id"];
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 33,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "census",
        pageIds: [pageId],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      [pageId]: {
        kind: "page",
        id: pageId,
        name: "Main",
        route: "/",
        children: [nodeId],
      },
      [nodeId]: {
        kind: "node",
        id: nodeId,
        definitionId,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
    },
  };
  const result: {
    stage: "graph" | "root" | "canvas" | "dom" | "pass";
    error?: string;
    resolvedNodes?: number;
    resolvedBindingIds?: Record<string, number>;
    /** Binding ids executed by the rule-backed executors (no type binding entry). */
    ruleExecutedBindingIds?: string[];
    /** Binding ids of nodes with no Canvas executor or no DOM executor where DOM is rendered. */
    missingBindingIds?: string[];
    resolvedDefinitionIds?: string[];
  } = { stage: "graph" };
  try {
    const runtime = new CatalogRuntime(
      new CatalogGraph(document, library),
      new CatalogStorage(indexedDB, `adr248-census-${name}`),
    );
    result.stage = "root";
    const root = new CatalogCompositionRoot(runtime, engine, {
      width: 1440,
      height: 900,
    });
    const counts: Record<string, number> = {};
    for (const input of root.canvasInputs.values()) {
      const key =
        input.bindingId ??
        (input.definitionMode === "composite" ? "composite" : "(none)");
      counts[key] = (counts[key] ?? 0) + 1;
    }
    result.resolvedNodes = root.canvasInputs.size;
    result.resolvedBindingIds = counts;
    result.resolvedDefinitionIds = [
      ...new Set(
        [...root.canvasInputs.values()].map((input) => input.definitionId),
      ),
    ].sort();
    result.ruleExecutedBindingIds = [
      ...new Set(
        [...root.canvasInputs.values()]
          .filter(
            (input) =>
              input.ruleId !== undefined &&
              !PRODUCT_BINDINGS.has(input.bindingId ?? ""),
          )
          .map((input) => input.bindingId ?? "(none)"),
      ),
    ].sort();
    // Per node: a Canvas executor, and a DOM executor unless a RAC parent owns the node's DOM.
    const bindingKey = (input: {
      bindingId?: string;
      definitionMode?: string;
    }) =>
      input.bindingId ??
      (input.definitionMode === "composite" ? "composite" : "(none)");
    result.missingBindingIds = [
      ...new Set(
        [...root.canvasInputs.values()]
          .filter((input) => {
            const key = bindingKey(input);
            const canvas =
              CATALOG_CANVAS_BINDING_IDS.has(key) || !!input.ruleId;
            const dom =
              !catalogDomRendersNode(root, input.id) ||
              CATALOG_DOM_BINDING_IDS.has(key) ||
              // A node-tree renderer (ADR-256 Phase 3 — the group items wrappers have no rule).
              !!CATALOG_DELEGATED_DOM[key] ||
              !!input.ruleId;
            return !canvas || !dom;
          })
          .map(bindingKey),
      ),
    ].sort();
    const rootId = [...root.canvasInputs.values()].find(
      (input) => input.parentId === "catalog:root",
    )!.id;
    result.stage = "canvas";
    bindCatalogCanvas(root, [rootId]).dispose();
    result.stage = "dom";
    const markup = renderToStaticMarkup(renderCatalogDom(root, rootId));
    for (const id of root.domInputs.keys())
      if (
        catalogDomRendersNode(root, id) &&
        !markup.includes(`data-catalog-id="${id}"`)
      )
        throw new Error(`CATALOG_DOM_NODE_NOT_RENDERED:${id}`);
    result.stage = "pass";
  } catch (error) {
    result.error = message(error);
  }
  return result;
}

describe("ADR-248 Phase 3 G3 type/state census", () => {
  it("re-counts registered types and states against the typed library and product bindings", async () => {
    const createEngine = await layoutEngineFactory();
    const code = await buildCodeCatalogLibrary();
    const fixture = createPencilFixtureLibrary();
    const axes = stateAxes();
    const ruleTypes = Object.keys(COMPONENT_RULES_TABLE);
    const registryTypes = componentCatalog.map((entry) => entry.type);
    const universe = [...new Set([...registryTypes, ...ruleTypes])].sort();
    const composites = [...code.definitions.values()].filter(
      (definition) => definition.mode === "composite",
    );
    const parentContext = parentContextTypes();
    /** First composite (by id) whose template contains a node of `definitionId`. */
    const hostOf = (definitionId: string) =>
      composites
        .filter((composite) => {
          const walk = (id: string): boolean => {
            const template = code.templates.get(id as never)!;
            return (
              template.definitionId === definitionId ||
              template.children.some(walk)
            );
          };
          return !!composite.templateRootId && walk(composite.templateRootId);
        })
        .map((composite) => composite.id)
        .sort()[0];

    const types = universe.map((type) => {
      const registration = componentCatalog
        .filter((entry) => entry.type === type)
        .map((entry) => entry.kind);
      const base = composites.find((definition) => definition.name === type);
      const stateOrigins = composites
        .filter((definition) => definition.name.startsWith(`${type}/`))
        .map((definition) => definition.name.slice(type.length + 1));
      const direct = [
        `lib:definition:${type.toLowerCase()}`,
        `lib:definition:type-${type}`,
      ].find((id) => code.definitions.has(id as never)) as
        DefinitionId | undefined;
      const fixtureId = `lib:definition:${type.toLowerCase()}` as DefinitionId;
      const host =
        parentContext.has(type) && direct ? hostOf(direct) : undefined;
      const route = host
        ? {
            library: "code",
            kind: "parent-context",
            definitionId: host,
            typeDefinitionId: direct,
          }
        : base
          ? { library: "code", kind: "composite", definitionId: base.id }
          : direct
            ? { library: "code", kind: "direct", definitionId: direct }
            : fixture.definitions.has(fixtureId as never)
              ? { library: "fixture", kind: "direct", definitionId: fixtureId }
              : undefined;
      const definition = route
        ? (route.library === "code" ? code : fixture).definitions.get(
            ("typeDefinitionId" in route && route.typeDefinitionId
              ? route.typeDefinitionId
              : route.definitionId) as never,
          )
        : undefined;
      const execution = route
        ? run(
            route.library === "code" ? code : fixture,
            route.definitionId as DefinitionId,
            createEngine(),
            type,
          )
        : undefined;
      const missingBindings = execution?.missingBindingIds ?? [];
      // In a parent context the type counts only if the host run resolved a node of it.
      if (
        execution?.stage === "pass" &&
        "typeDefinitionId" in route! &&
        !execution.resolvedDefinitionIds?.includes(route.typeDefinitionId!)
      ) {
        execution.stage = "root";
        execution.error = `PARENT_CONTEXT_NODE_ABSENT:${route.typeDefinitionId}`;
      }
      const reason = !route
        ? "NO_TYPED_DEFINITION"
        : execution!.stage === "pass"
          ? route.kind === "parent-context"
            ? "RUNS_IN_PARENT_CONTEXT"
            : route.library === "fixture"
              ? "RUNS_DIRECT_TEST_FIXTURE_DEFINITION"
              : route.kind === "composite"
                ? "RUNS_COMPOSITE_ON_EXISTING_TEMPLATE_BINDINGS"
                : "RUNS_DIRECT_CODE_DEFINITION"
          : route.kind === "composite" && missingBindings.length
            ? "COMPOSITE_TEMPLATE_NEEDS_NEW_BINDING"
            : missingBindings.length
              ? "DIRECT_BINDING_MISSING"
              : `FAILED_AT_${execution!.stage.toUpperCase()}`;
      const states = axes.get(type) ?? [];
      const typedStateRules = Object.keys(definition?.stateRules ?? {});
      // The registered type's own definition (a composite route's template root is this one).
      const own = direct ? code.definitions.get(direct as never) : definition;
      /**
       * New-runtime channel of each registered state axis: the resting paint, a typed state rule
       * (`stateRules` or a `conditionalRules` entry with that `state` — disabled opacity), the rule
       * executor's own variant paint (`CATALOG_RULE_EXECUTOR_PAINT_STATES`), else none.
       */
      const stateChannels = Object.fromEntries(
        states.map((axis) => {
          const name = axis.split(":")[1];
          const stateName = (
            name === "emphasizedSelected" ? "selected" : name
          ) as StateName;
          const channel =
            name === "base"
              ? "rest"
              : own &&
                  ((own.stateRules as Record<string, unknown> | undefined)?.[
                    stateName
                  ] ||
                    ("conditionalRules" in own &&
                      own.conditionalRules?.some(
                        (rule) => rule.state === stateName,
                      )))
                ? "typedStateRule"
                : own &&
                    "ruleId" in own &&
                    own.ruleId &&
                    CATALOG_RULE_EXECUTOR_PAINT_STATES.has(stateName)
                  ? "ruleExecutorPaint"
                  : "none";
          return [axis, channel];
        }),
      );
      return {
        type,
        registration,
        visualRule: ruleTypes.includes(type),
        route: route ?? null,
        typedVisualFields: Object.keys(definition?.visual ?? {}).length,
        typedStateRules,
        stateChannels,
        stateOriginVariants: stateOrigins,
        registeredStates: states,
        execution: execution ?? null,
        missingBindings,
        reason,
      };
    });

    // Missing bindings always block execution. Known bindings may still fail visual or DOM
    // semantics, so only the actual run can mark a type executable.
    for (const entry of types)
      if (entry.execution && entry.missingBindings.length)
        expect(entry.execution.stage, entry.type).not.toBe("pass");

    const byReason: Record<string, number> = {};
    for (const entry of types)
      byReason[entry.reason] = (byReason[entry.reason] ?? 0) + 1;
    /** Missing binding id → composites it blocks, and composites it alone blocks. */
    const blockers: Record<
      string,
      { blocks: number; blocksAlone: number; direct: boolean }
    > = {};
    for (const entry of types)
      for (const id of entry.missingBindings) {
        blockers[id] ??= { blocks: 0, blocksAlone: 0, direct: false };
        blockers[id].blocks++;
        if (entry.missingBindings.length === 1) blockers[id].blocksAlone++;
        if (id === entry.type.toLowerCase()) blockers[id].direct = true;
      }
    const runnable = types.filter((entry) => entry.execution?.stage === "pass");
    const stateTotal = types.reduce(
      (sum, entry) => sum + entry.registeredStates.length,
      0,
    );
    const summary = {
      registeredTypes: types.length,
      registryEntries: registryTypes.length,
      ruleTypes: ruleTypes.length,
      runnableTypes: runnable.length,
      runnableTypeNames: runnable.map((entry) => entry.type),
      byReason,
      registeredStates: stateTotal,
      statesWithTypedStateRule: types.reduce(
        (sum, entry) =>
          sum +
          entry.registeredStates.filter((axis) =>
            entry.typedStateRules.includes(axis.split(":")[1]),
          ).length,
        0,
      ),
      /** Registered state axes by new-runtime channel (`stateChannels`). */
      statesByChannel: types.reduce<Record<string, number>>((sum, entry) => {
        for (const channel of Object.values(entry.stateChannels))
          sum[channel] = (sum[channel] ?? 0) + 1;
        return sum;
      }, {}),
      /** Axes without a channel, by state name. */
      statesWithoutChannel: types.reduce<Record<string, number>>(
        (sum, entry) => {
          for (const [axis, channel] of Object.entries(entry.stateChannels))
            if (channel === "none")
              sum[axis.split(":")[1]] = (sum[axis.split(":")[1]] ?? 0) + 1;
          return sum;
        },
        {},
      ),
      statesOnRunnableTypes: runnable.reduce(
        (sum, entry) => sum + entry.registeredStates.length,
        0,
      ),
      typesWithStateOriginVariants: types.filter(
        (entry) => entry.stateOriginVariants.length,
      ).length,
      productBindings: [...PRODUCT_BINDINGS],
      missingBindingIds: Object.keys(blockers).length,
      compositeTypes: types.filter((entry) => entry.route?.kind === "composite")
        .length,
      compositeTypesUsingCommonWrapper: types.filter(
        (entry) => entry.execution?.resolvedBindingIds?.composite,
      ).length,
      compositesRunnableOnExistingTemplateBindings: types.filter(
        (entry) =>
          entry.route?.kind === "composite" &&
          entry.execution?.stage === "pass",
      ).length,
    };
    writeEvidence(
      OUTPUT,
      `${JSON.stringify(
        {
          adr: 248,
          phase: 3,
          check: "g3-type-state-census",
          note: "recount only; G3 verdicts unchanged. statesWithTypedStateRule counts the type definition's own stateRules; statesByChannel classifies every registered state axis by the new-runtime channel that paints it (rest, typed state rule incl. state conditional rules, rule executor paint, none)",
          summary,
          blockers: Object.fromEntries(
            Object.entries(blockers).sort(
              ([, a], [, b]) => b.blocks - a.blocks,
            ),
          ),
          types,
        },
        null,
        2,
      )}\n`,
    );
    console.info("[adr248-g3-census]", JSON.stringify(summary));
    // ADR-251: + RadioItems · CheckboxItems (the group items wrappers).
    // + CheckboxIndicator · RadioIndicator · SwitchIndicator (toggle indicator nodes, 2026-10-04).
    // + TooltipTrigger (the Tooltip origin's root, ADR-255 2026-10-07).
    // + DisclosureChevron (the Disclosure trigger's chevron node, 2026-10-07).
    // + CheckboxButton · SwitchButton · RadioButton (ADR-256 Phase 3 — RAC *Field > *Button, 2026-10-08).
    // + SelectionIndicator (ADR-256 Phase 5e — the Tab's selection bar node).
    // + Keyboard · SubmenuTrigger (ADR-256 Phase 5g — a MenuItem's shortcut · a submenu).
    // + TreeItemContent (ADR-256 Phase 5h — a TreeItem's row content; its chevron is an authored
    //   Button — the TreeItemChevron node of 2026-10-04 is deleted).
    // − SelectTrigger (the field trigger box is a RAC Group node since ADR-256 Phase 6b; the type
    //   is deleted, 2026-10-09).
    // + Autocomplete (ADR-256 Phase 6g — RAC Autocomplete, no element of its own).
    // + ProgressBarFill (ADR-256 Phase 7a — the fill in a ProgressBar's track).
    // + MeterFill (ADR-256 Phase 7b).
    // + SliderFill (ADR-256 Phase 7c).
    // + OverlayArrow (ADR-256 Phase 8a).
    // + DisclosurePanel (ADR-256 Phase 8c).
    // − DisclosureHeader · DisclosureChevron · DisclosureContent (ADR-256 Phase 8e).
    // + MenuTrigger (ADR-256 후속 4 — the Menu origin's root).
    expect(types.length).toBe(148);
  }, 120_000);
});
