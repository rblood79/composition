#!/usr/bin/env node
// ADR-248 G0: expose what the 51/121/68 field inventories actually classify.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const dir = resolve(root, "docs/adr/design/248-baseline");
const read = (name) => JSON.parse(readFileSync(resolve(dir, name), "utf8"));
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const core = read("core-field-matrix.json");
const flow = read("core-field-flow-audit.json");
const extended = read("field-matrix.json");
const visual = read("visual-value-source.json");
const nonvisual = read("nonvisual-field-audit.json");
const adjacent = read("adjacent-public-surfaces.json");
for (const report of [core, extended, adjacent])
  if (report.baselineHead !== head)
    throw new Error("Field inventory HEAD drift");
if (flow.head !== head || visual.baselineHead !== head)
  throw new Error("Source edge HEAD drift");
const byFlow = new Map(flow.rows.map((row) => [row.key, row]));
const byVisual = new Map(visual.rows.map((row) => [row.key, row]));
const byNonvisual = new Map(
  nonvisual.fields.map((row) => [`${row.family}.${row.field}`, row]),
);
const anchor = (path, needle) => {
  const lines = readFileSync(resolve(root, path), "utf8").split("\n");
  const index = lines.findIndex((line) => line.includes(needle));
  if (index < 0) throw new Error(`${path}: missing ${needle}`);
  return { path, line: index + 1, needle };
};
const b = "apps/builder/src/builder/";
const c = "apps/builder/src/adapters/canonical/";
const a = "apps/builder/src/lib/db/indexedDB/";
const s = "packages/shared/src/";
const adjacentRoles = {
  DataBinding: {
    use: "LEGACY_READER_INPUT; NO_CURRENT_PUBLIC_UI_WRITER",
    writer: null,
    consumer: anchor(
      `${s}hooks/useCollectionData.tsx`,
      "dataBinding.config as",
    ),
  },
  PropertyDataBinding: {
    use: "ACTIVE_TYPED_BINDING_UI_OR_OPTIONAL_SCHEMA_INPUT",
    writer: anchor(
      `${b}components/property/PropertyDataBinding.tsx`,
      "onChange: (value:",
    ),
    consumer: anchor(
      `${s}hooks/useCollectionData.tsx`,
      "asPropertyBinding(stableDataBinding)",
    ),
  },
  ElementDataBinding: {
    use: "DECLARATION_ONLY",
    writer: null,
    consumer: anchor(
      "apps/builder/src/types/builder/data.types.ts",
      "interface ElementDataBinding",
    ),
  },
  VariableDef: {
    use: "ACTIVE_PROJECT_DATA_STORE_OR_ELEMENT_STATE_SCHEMA",
    writer: anchor(
      `${b}stores/utils/dataChange.ts`,
      "function reduceDefineVariable(",
    ),
    consumer: anchor(`${s}state/variable.types.ts`, "VariableDefSchema:"),
  },
  InteractionRule: {
    use: "ACTIVE_ROOT_INTERACTION_INPUT",
    writer: anchor(
      `${b}stores/canonical/rootCollectionInteractionsWrite.ts`,
      "export function writeInteractionRulesToRootCollection(",
    ),
    consumer: anchor(
      `${s}interactions/dispatcher.ts`,
      "export function executeInteractionRule(",
    ),
  },
  CanonicalDocumentRecord: {
    use: "LEGACY_DOCUMENT_ROW_READER_ONLY; NEW_WRITES_USE_PARTS",
    writer: null,
    consumer: anchor(
      `${a}incrementalDocuments.ts`,
      'tx.objectStore("documents").get(projectId)',
    ),
  },
  CanonicalDocumentBackupRecord: {
    use: "ACTIVE_IDB_BACKUP_RECORD",
    writer: anchor(
      `${a}incrementalDocuments.ts`,
      "const backup: CanonicalDocumentBackupRecord =",
    ),
    consumer: anchor(
      `${a}adapter.ts`,
      "getAllByIndex<CanonicalDocumentBackupRecord>(",
    ),
  },
  DocumentPersistOptions: {
    use: "ACTIVE_COMMAND_OPTION; NOT_PERSISTED_FIELD",
    writer: anchor(`${a}adapter.ts`, "options?: DocumentPersistOptions"),
    consumer: anchor(
      `${a}documentPersistGuard.ts`,
      "export function evaluateDocumentPersist(",
    ),
  },
  DatabaseAdapter: {
    use: "ACTIVE_IDB_METHOD_CONTRACT",
    writer: anchor(
      `${a}adapter.ts`,
      "export class IndexedDBAdapter implements DatabaseAdapter",
    ),
    consumer: anchor(`${a}adapter.ts`, "projects = {"),
  },
  ResolvedNode: {
    use: "DERIVED_RESOLVER_OUTPUT; NOT_PERSISTED_FIELD",
    writer: anchor(
      "apps/builder/src/resolvers/canonical/index.ts",
      "const resolved: ResolvedNode =",
    ),
    consumer: anchor(
      "apps/builder/src/resolvers/canonical/index.ts",
      "export function resolveCanonicalDocument(",
    ),
  },
  ResolverCache: {
    use: "ACTIVE_DERIVED_CACHE; NOT_PERSISTED_FIELD",
    writer: anchor(
      "apps/builder/src/resolvers/canonical/cache.ts",
      "export function createResolverCache(",
    ),
    consumer: anchor(
      "apps/builder/src/resolvers/canonical/index.ts",
      "const hit = cache.get(key)",
    ),
  },
  ImportResolverContext: {
    use: "ACTIVE_IMPORT_LOOKUP_CONTRACT",
    writer: anchor(
      "apps/builder/src/resolvers/canonical/importRegistry.ts",
      "function resolveImportDocument(",
    ),
    consumer: anchor(
      "apps/builder/src/resolvers/canonical/index.ts",
      "imports.resolveImportDocument(parsed.importKey, source)",
    ),
  },
  CanonicalMutationRunnerBridge: {
    use: "ACTIVE_MUTATION_CALLBACK_CONTRACT",
    writer: anchor(
      `${c}canonicalMutationRunner.ts`,
      "rebuildIndexes: (source:",
    ),
    consumer: anchor(
      `${c}canonicalMutationRunner.ts`,
      "bridge.rebuildIndexes(stages.indexSource",
    ),
  },
};
for (const name of [
  "NavigateAction",
  "ToastAction",
  "CapabilityAction",
  "SetStateAction",
])
  adjacentRoles[name] = {
    use: "ACTIVE_INTERACTION_ACTION_INPUT",
    writer: adjacentRoles.InteractionRule.writer,
    consumer: adjacentRoles.InteractionRule.consumer,
  };
const oldInputUse = {
  "ThemeSnapshot.customTokens": "LEGACY_IMPORT_READER_ONLY",
  "CompositionExtension.events": "DORMANT_GENERIC_WRITER_ONLY",
  "CompositionExtension.dataBinding": "ACTIVE_BINDING_FALLBACK",
  "CompositionExtension.actions": "DORMANT_GENERIC_WRITER_ONLY",
  "CompositionExtension.editor": "DORMANT_GENERIC_WRITER_ONLY",
  'CompositionExtendedNode."x-composition"': "ACTIVE_BINDING_WRAPPER",
  "SerializedDataBinding.[index]": "LEGACY_OPEN_INPUT_READER_ONLY",
};
const coreRows = core.entries.map((row) => {
  const edge = byFlow.get(row.key);
  if (!edge || !row.proposedDestination || !row.plannedGates?.length)
    throw new Error(`${row.key}: responsibility absent`);
  const currentUse = edge.oldSample
    ? edge.status.startsWith("OLD_PUBLIC_ACTION")
      ? "ACTIVE_PUBLIC_COMMAND"
      : "ACTIVE_CREATION_OR_HYDRATION"
    : edge.status;
  return {
    key: row.key,
    currentUse,
    currentWriter: edge.oldWriter,
    currentConsumer: edge.oldReader,
    currentStore: edge.oldStore,
    currentSave: edge.oldSave,
    currentRefresh: edge.oldRefresh,
    sourceDisposition: edge.disposition,
    oldOutput: edge.oldSample?.oldOutput ?? null,
    proposedDestination: row.proposedDestination,
    plannedGates: row.plannedGates,
    classificationStatus:
      edge.oldSample || edge.disposition
        ? "CURRENT_USE_AND_NEW_OWNER_CLASSIFIED"
        : "CURRENT_USE_OR_NEW_OWNER_UNCLASSIFIED",
  };
});
const extendedRows = extended.entries.map((row) => {
  const isVisual = row.oldInterface.startsWith("ComponentRule");
  const source = isVisual ? byVisual.get(row.key) : null;
  const oldNonvisual = isVisual ? null : byNonvisual.get(row.key);
  if (isVisual && !source) throw new Error(`${row.key}: visual source absent`);
  if (!isVisual && !oldNonvisual)
    throw new Error(`${row.key}: nonvisual source absent`);
  const currentUse = isVisual
    ? source.authoredCount > 0
      ? "ACTIVE_LIBRARY_TABLE_VALUE"
      : "ABSENT_FROM_CURRENT_LIBRARY_TABLE"
    : row.oldRuntimeValueEvidence?.status === "OLD_PURE_RUNTIME_WITNESS"
      ? "ACTIVE_OLD_ADAPTER_OR_READER_WITNESS"
      : (oldInputUse[row.key] ??
        "SOURCE_DISPOSITION_ONLY; CURRENT_USE_UNCONFIRMED");
  return {
    key: row.key,
    currentUse,
    currentWriter: isVisual
      ? { path: source.tablePath, authoredCount: source.authoredCount }
      : oldNonvisual.writer,
    currentConsumer: isVisual
      ? {
          directExamples: source.directConsumerExamples,
          indirectRoutes: source.indirectRoutes,
        }
      : oldNonvisual.reader,
    sourceDisposition: row.disposition ?? null,
    proposedDestination: row.proposedDestination,
    plannedGates: row.plannedGates,
    classificationStatus: currentUse.includes("UNCONFIRMED")
      ? "CURRENT_USE_UNCLASSIFIED"
      : "CURRENT_USE_AND_NEW_OWNER_CLASSIFIED",
  };
});
const adjacentRows = adjacent.rows.map((row) => {
  if (
    !row.disposition ||
    !row.proposedDestination ||
    !row.plannedGates?.length ||
    !row.currentConsumerFamilyPaths?.length
  )
    throw new Error(`${row.key}: responsibility absent`);
  const [family, field] = row.key.split(".");
  const role = adjacentRoles[family];
  if (!role) throw new Error(`${row.key}: current role absent`);
  const currentUse =
    family === "PropertyDataBinding" && ["path", "defaultValue"].includes(field)
      ? "OPTIONAL_SCHEMA_INPUT; NO_PUBLIC_UI_WRITER_OBSERVED"
      : family === "VariableDef" && field === "source"
        ? "ELEMENT_STATE_SCHEMA_INPUT; NO_PROJECT_DATA_WRITER"
        : role.use;
  return {
    key: row.key,
    currentUse,
    currentWriter:
      currentUse.includes("NO_PUBLIC_UI_WRITER") ||
      currentUse.includes("NO_PROJECT_DATA_WRITER")
        ? null
        : role.writer,
    currentConsumer: role.consumer,
    currentFamilyPaths: row.currentConsumerFamilyPaths,
    sourceDisposition: row.disposition,
    proposedDestination: row.proposedDestination,
    plannedGates: row.plannedGates,
    classificationStatus:
      "CURRENT_USE_AND_NEW_OWNER_CLASSIFIED; BEHAVIOR_UNVERIFIED",
  };
});
const unclassified = [...coreRows, ...extendedRows, ...adjacentRows].filter(
  (row) => row.classificationStatus.includes("UNCLASSIFIED"),
);
const report = {
  head,
  status: unclassified.length
    ? "RESPONSIBILITY_CANDIDATES_PRESENT; G0_SOURCE_CLASSIFICATION_INCOMPLETE"
    : "RESPONSIBILITY_CLASSIFIED",
  summary: {
    core: coreRows.length,
    extended: extendedRows.length,
    adjacent: adjacentRows.length,
    totalRows: coreRows.length + extendedRows.length + adjacentRows.length,
    coreWithOldActionOrHydrationSample: coreRows.filter((row) => row.oldOutput)
      .length,
    extendedWithCurrentTableValue: extendedRows.filter(
      (row) => row.currentUse === "ACTIVE_LIBRARY_TABLE_VALUE",
    ).length,
    extendedAbsentFromCurrentTable: extendedRows.filter(
      (row) => row.currentUse === "ABSENT_FROM_CURRENT_LIBRARY_TABLE",
    ).length,
    extendedSourceDispositionOnly: extendedRows.filter((row) =>
      row.currentUse.includes("UNCONFIRMED"),
    ).length,
    adjacentDirectionalSourceUnclassified: adjacentRows.filter((row) =>
      row.classificationStatus.includes("UNCLASSIFIED"),
    ).length,
    unclassified: unclassified.length,
  },
  unclassifiedKeys: unclassified.map((row) => row.key),
  coreRows,
  extendedRows,
  adjacentRows,
};
if (
  coreRows.length !== 51 ||
  extendedRows.length !== 121 ||
  adjacentRows.length !== 68
)
  throw new Error("Field inventory cardinality changed");
const index = process.argv.indexOf("--out");
if (index < 0 || !process.argv[index + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[index + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);
