#!/usr/bin/env node
// ADR-248 G0: classify adjacent public API fields at the H1/H2/Builder boundary.
// These are proposed ownership routes, not proof that the new model works.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(
  readFileSync(resolve(baselineDir, "inventory.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== inventory.baselineHead)
  throw new Error("Adjacent public surface audit uses another baseline HEAD");

const plan = {
  DataBinding: {
    evidence: [
      "packages/shared/src/hooks/useCollectionData.tsx",
      "packages/shared/src/collections/normalizeDataBinding.ts",
    ],
    fields: {
      type: ["REPLACE_LEGACY_SHAPE", "node.binding.kind", "G1/G4"],
      source: ["REPLACE_LEGACY_SHAPE", "node.binding.sourceKind", "G1/G4"],
      config: [
        "RETIRE_OPEN_INLINE_PAYLOAD",
        "typed node binding ID/options; collection and endpoint payloads stay in H1 stores",
        "G1/G4",
      ],
    },
  },
  PropertyDataBinding: {
    evidence: [
      "apps/builder/src/builder/components/property/PropertyDataBinding.tsx",
      "packages/shared/src/hooks/useCollectionData.tsx",
      "packages/shared/src/collections/resolveBoundCollection.ts",
    ],
    fields: {
      source: ["RETAIN_TYPED_NODE_BINDING", "node.binding.sourceKind", "G1/G4"],
      collectionId: [
        "RETAIN_H1_REFERENCE",
        "node.binding.dataRefId → H1 collections",
        "G1/G4",
      ],
      name: [
        "RETIRE_NAME_FALLBACK",
        "resolve display name from H1 collection/endpoint by stable ID",
        "G1/G4",
      ],
      fieldMap: [
        "RETAIN_TYPED_NODE_BINDING",
        "node.binding.fieldMap (typed role and field ID)",
        "G1/G4",
      ],
      path: [
        "RETAIN_IF_AUTHORED",
        "node.binding.path (typed source option)",
        "G1/G4",
      ],
      defaultValue: [
        "RETAIN_IF_AUTHORED",
        "node.binding.defaultValue (typed source option)",
        "G1/G4",
      ],
      refreshMode: [
        "RETAIN_IF_AUTHORED",
        "node.binding.refresh.mode (API binding option)",
        "G1/G4",
      ],
      refreshInterval: [
        "RETAIN_IF_AUTHORED",
        "node.binding.refresh.intervalMs (API binding option)",
        "G1/G4",
      ],
    },
  },
  ElementDataBinding: {
    evidence: ["apps/builder/src/types/builder/data.types.ts"],
    fields: {
      dataSource: [
        "RETIRE_DECLARATION_ONLY",
        "node.binding.dataRefId if a live authoring route is found",
        "G0/G4/G6",
      ],
      bindings: [
        "RETIRE_DECLARATION_ONLY",
        "node.binding.fieldMap if a live authoring route is found",
        "G0/G4/G6",
      ],
    },
  },
  VariableDef: {
    evidence: [
      "packages/shared/src/state/variable.types.ts",
      "apps/builder/src/builder/stores/utils/dataChange.ts",
    ],
    fields: {
      id: [
        "RETAIN_BY_OWNER",
        "project: H1 variable ID; page/node: graph state ID",
        "G1/G4",
      ],
      name: [
        "RETAIN_BY_OWNER",
        "project: H1 variable name; page/node: graph state name",
        "G1/G4",
      ],
      type: [
        "RETAIN_BY_OWNER",
        "project: H1 variable type; page/node: graph state type",
        "G1/G4",
      ],
      defaultValue: [
        "RETAIN_BY_OWNER",
        "project: H1 variable default; page/node: graph state default",
        "G1/G4",
      ],
      persist: [
        "PROJECT_OWNER_ONLY",
        "H1 project variable runtime persist policy",
        "G1/G4",
      ],
      source: [
        "ELEMENT_OWNER_ONLY",
        "graph node state implicit RAC source prop",
        "G1/G3/G4",
      ],
    },
  },
  InteractionRule: {
    evidence: [
      "apps/builder/src/builder/stores/canonical/rootCollectionInteractionsWrite.ts",
      "packages/shared/src/interactions/dispatcher.ts",
    ],
    fields: {
      id: ["MOVE_TO_GRAPH", "interaction.id", "G1/G2/G4"],
      type: ["MOVE_TO_GRAPH", "interaction.kind discriminator", "G1/G4"],
      elementId: ["MOVE_TO_GRAPH", "interaction.triggerNodeId", "G1/G2/G4"],
      trigger: ["MOVE_TO_GRAPH", "interaction.trigger", "G1/G3/G4"],
      action: ["MOVE_TO_GRAPH", "interaction.action (typed union)", "G1/G3/G4"],
    },
  },
  NavigateAction: {
    evidence: ["packages/shared/src/interactions/dispatcher.ts"],
    fields: {
      kind: ["RETAIN_GRAPH_ACTION", "interaction.action.kind", "G1/G3"],
      params: [
        "RETAIN_GRAPH_ACTION",
        "interaction.action.navigate.path",
        "G1/G3",
      ],
    },
  },
  ToastAction: {
    evidence: ["packages/shared/src/interactions/dispatcher.ts"],
    fields: {
      kind: ["RETAIN_GRAPH_ACTION", "interaction.action.kind", "G1/G3"],
      params: [
        "RETAIN_GRAPH_ACTION",
        "interaction.action.toast.message",
        "G1/G3",
      ],
    },
  },
  CapabilityAction: {
    evidence: [
      "packages/shared/src/interactions/dispatcher.ts",
      "packages/shared/src/interactions/capabilityRegistry.ts",
    ],
    fields: {
      kind: ["RETAIN_GRAPH_ACTION", "interaction.action.kind", "G1/G3"],
      targetId: [
        "RETAIN_GRAPH_ACTION",
        "interaction.action.targetNodeId",
        "G1/G3",
      ],
      capability: [
        "RETAIN_GRAPH_ACTION",
        "interaction.action.capabilityId",
        "G1/G3",
      ],
      params: [
        "RETAIN_GRAPH_ACTION",
        "interaction.action.capabilityParams",
        "G1/G3",
      ],
    },
  },
  SetStateAction: {
    evidence: [
      "packages/shared/src/interactions/dispatcher.ts",
      "packages/shared/src/state/variable.types.ts",
    ],
    fields: {
      kind: ["RETAIN_GRAPH_ACTION", "interaction.action.kind", "G1/G3"],
      variableId: [
        "RETAIN_OWNER_REFERENCE",
        "interaction.action.variableId → H1 project variable or graph page/node state",
        "G1/G3/G4",
      ],
      op: ["RETAIN_GRAPH_ACTION", "interaction.action.stateOp", "G1/G3"],
      value: ["RETAIN_GRAPH_ACTION", "interaction.action.value", "G1/G3"],
    },
  },
  CanonicalDocumentRecord: {
    evidence: ["apps/builder/src/lib/db/indexedDB/adapter.ts"],
    fields: {
      project_id: ["REPLACE_DOCUMENT_ROW", "catalog graph row.projectId", "G4"],
      document: ["REPLACE_DOCUMENT_ROW", "catalog graph row.document", "G4"],
      updated_at: [
        "RETAIN_STORAGE_METADATA",
        "catalog graph row.updatedAt",
        "G4",
      ],
    },
  },
  CanonicalDocumentBackupRecord: {
    evidence: ["apps/builder/src/lib/db/indexedDB/adapter.ts"],
    fields: {
      backup_id: ["REPLACE_DOCUMENT_BACKUP", "catalog graph backup.id", "G4"],
      project_id: [
        "REPLACE_DOCUMENT_BACKUP",
        "catalog graph backup.projectId",
        "G4",
      ],
      document: [
        "REPLACE_DOCUMENT_BACKUP",
        "catalog graph backup.document",
        "G4",
      ],
      updated_at: [
        "RETAIN_STORAGE_METADATA",
        "catalog graph backup.updatedAt",
        "G4",
      ],
    },
  },
  DocumentPersistOptions: {
    evidence: ["apps/builder/src/lib/db/indexedDB/documentPersistGuard.ts"],
    fields: {
      allowShrink: [
        "REPLACE_GRAPH_GUARD",
        "catalog graph persist guard.allowShrink",
        "G4",
      ],
      expectedShrinkNodeCount: [
        "REPLACE_GRAPH_GUARD",
        "catalog graph persist guard.expectedRemovedNodeCount",
        "G4",
      ],
      reason: ["RETAIN_DIAGNOSTIC", "catalog graph persist guard.reason", "G4"],
    },
  },
  DatabaseAdapter: {
    evidence: ["apps/builder/src/lib/db/indexedDB/adapter.ts"],
    fields: {
      init: ["RETAIN_ADAPTER_LIFECYCLE", "database.init", "G4"],
      close: ["RETAIN_ADAPTER_LIFECYCLE", "database.close", "G4"],
      clearCaches: [
        "RETAIN_RUNTIME_CACHE_POLICY",
        "database.clearCaches",
        "G4",
      ],
      projects: ["RETAIN_PROJECT_STORE", "database.projects", "G4"],
      documents: ["REPLACE_STORAGE_NAMESPACE", "database.catalogGraphs", "G4"],
      collections: ["RETAIN_H1_DATA_STORE", "database.collections", "G4"],
      api_endpoints: ["RETAIN_H1_DATA_STORE", "database.api_endpoints", "G4"],
      variables: ["RETAIN_H1_DATA_STORE", "database.variables", "G4"],
      events: [
        "REMOVE_DOCUMENT_MIRROR",
        "interaction graph entries only",
        "G4/G6",
      ],
      actions: [
        "REMOVE_DOCUMENT_MIRROR",
        "interaction graph entries only",
        "G4/G6",
      ],
    },
  },
  ResolvedNode: {
    evidence: ["apps/builder/src/resolvers/canonical/index.ts"],
    fields: {
      _resolvedFrom: [
        "REPLACE_DERIVED_VIEW",
        "resolved graph originDefinitionId",
        "G1/G3",
      ],
      _overrides: [
        "REPLACE_DERIVED_VIEW",
        "resolved graph overridePaths",
        "G1/G3",
      ],
      _pathSegment: [
        "REPLACE_DERIVED_VIEW",
        "resolved graph stableChildSegment",
        "G1/G3",
      ],
      _instanceOwnChild: [
        "REPLACE_DERIVED_VIEW",
        "resolved graph instanceOwned",
        "G1/G3",
      ],
      children: [
        "REPLACE_DERIVED_VIEW",
        "resolved graph ordered children",
        "G1/G3",
      ],
    },
  },
  ResolverCache: {
    evidence: ["apps/builder/src/resolvers/canonical/cache.ts"],
    fields: {
      get: ["REPLACE_EPHEMERAL_CACHE", "catalog resolver cache.get", "G1/G5"],
      set: ["REPLACE_EPHEMERAL_CACHE", "catalog resolver cache.set", "G1/G5"],
      invalidateSubtree: [
        "REPLACE_EPHEMERAL_CACHE",
        "catalog resolver cache.invalidateSubtree",
        "G1/G5",
      ],
      invalidateAll: [
        "REPLACE_EPHEMERAL_CACHE",
        "catalog resolver cache.invalidateAll",
        "G1/G5",
      ],
      stats: [
        "REPLACE_EPHEMERAL_CACHE",
        "catalog resolver cache.stats",
        "G1/G5",
      ],
    },
  },
  ImportResolverContext: {
    evidence: ["apps/builder/src/resolvers/canonical/importRegistry.ts"],
    fields: {
      resolveImportDocument: [
        "REPLACE_IMPORTED_DOCUMENT_READER",
        "catalog import registry.resolveDefinition (validated external graph)",
        "G1/G4",
      ],
    },
  },
  CanonicalMutationRunnerBridge: {
    evidence: [
      "apps/builder/src/adapters/canonical/canonicalMutationRunner.ts",
    ],
    fields: {
      rebuildIndexes: [
        "RETIRE_BRIDGE",
        "catalog transaction applies derived index delta within one commit",
        "G2/G6",
      ],
    },
  },
};

const elementBindingReferences = execFileSync(
  "rg",
  ["-l", "\\bElementDataBinding\\b", "apps/builder/src", "packages/shared/src"],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .sort();
if (
  elementBindingReferences.length !== 1 ||
  elementBindingReferences[0] !== "apps/builder/src/types/builder/data.types.ts"
)
  throw new Error("ElementDataBinding gained a live source consumer");

const actualNames = inventory.adjacentPublicSurfaces.map(
  (surface) => surface.name,
);
if (
  actualNames.length !== 17 ||
  new Set(actualNames).size !== actualNames.length ||
  actualNames.sort().join("|") !== Object.keys(plan).sort().join("|")
)
  throw new Error("Adjacent public surface interface classification changed");

const rows = inventory.adjacentPublicSurfaces.flatMap((surface) => {
  const contract = plan[surface.name];
  if (
    surface.fields
      .map((field) => field.name)
      .sort()
      .join("|") !== Object.keys(contract.fields).sort().join("|")
  )
    throw new Error(`${surface.name}: adjacent public fields changed`);
  for (const path of contract.evidence) {
    if (!existsSync(resolve(root, path)))
      throw new Error(`${surface.name}: evidence path missing: ${path}`);
  }
  return surface.fields.map((field) => {
    const [disposition, target, gate] = contract.fields[field.name];
    if (!disposition || !target || !gate)
      throw new Error(`${surface.name}.${field.name}: missing destination`);
    return {
      key: `${surface.name}.${field.name}`,
      oldType: field.type,
      sourcePath: surface.path,
      currentConsumerFamilyPaths: contract.evidence,
      disposition,
      proposedDestination: target,
      plannedGates: gate.split("/"),
      status: "CLASSIFIED_CANDIDATE; BEHAVIOR_UNVERIFIED",
    };
  });
});
if (
  rows.length !== 68 ||
  new Set(rows.map((row) => row.key)).size !== rows.length
)
  throw new Error("Expected 68 unique adjacent public fields");

const report = {
  baselineHead: head,
  status:
    "68 adjacent public fields classified by proposed owner; active value flow and new model behavior UNVERIFIED",
  summary: {
    interfaces: actualNames.length,
    fields: rows.length,
    missingDestinationOrGate: rows.filter(
      (row) => !row.proposedDestination || !row.plannedGates.length,
    ).length,
    h1BoundaryFields: rows.filter((row) =>
      /H1/.test(`${row.disposition} ${row.proposedDestination}`),
    ).length,
    retiredOrReplacedFields: rows.filter((row) =>
      /RETIRE|REMOVE|REPLACE/.test(row.disposition),
    ).length,
  },
  declarationOnly: { ElementDataBinding: elementBindingReferences },
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
