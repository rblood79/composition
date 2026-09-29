#!/usr/bin/env node
// ADR-248 G0: source anchored disposition for every old core field.
// A persisted sample and a source reader are recorded separately; neither is
// silently promoted to a field-specific UI/Canvas behavior assertion.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const read = (name) =>
  JSON.parse(readFileSync(resolve(baselineDir, name), "utf8"));
const matrix = read("core-field-matrix.json");
const active = read("core-active-flow/baseline.json");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== matrix.baselineHead || head !== active.head)
  throw new Error("Core flow audit HEAD drift");
const path = {
  mutation: "apps/builder/src/adapters/canonical/canonicalMutations.ts",
  store: "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
  view: "apps/builder/src/builder/stores/canonical/canonicalElementsView.ts",
  scene: "apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts",
  resolver: "apps/builder/src/resolvers/canonical/index.ts",
  adapter: "apps/builder/src/adapters/canonical/index.ts",
  ref: "apps/builder/src/adapters/canonical/canonicalRefResolution.ts",
  themeActions: "apps/builder/src/builder/panels/themes/themeActions.ts",
  themePure: "packages/shared/src/theme/themesCollection.ts",
  themeReader: "apps/builder/src/utils/theme/resolveThemeSnapshot.ts",
  page: "apps/builder/src/builder/workspace/canvas/scene/pagePlacement.ts",
  pageCommit: "apps/builder/src/builder/stores/utils/pagePlacementCommit.ts",
  pageHydration:
    "apps/builder/src/builder/stores/utils/pagePlacementHydration.ts",
  guide:
    "apps/builder/src/builder/workspace/canvas/viewport/pageGuideActions.ts",
  binding: "packages/shared/src/interactions/bindings.ts",
  pencil: "packages/shared/src/types/pencil-adapter.types.ts",
  save: "apps/builder/src/lib/db/indexedDB/incrementalDocuments.ts",
};
const a = (file, needle) => {
  const source = readFileSync(resolve(root, path[file] ?? file), "utf8");
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`Missing anchor ${file}: ${needle}`);
  return {
    path: path[file] ?? file,
    line: source.slice(0, index).split("\n").length,
    needle,
  };
};
const spec = {
  "CanonicalNode.id": [
    a("mutation", "id: previousNode?.id ?? element.id"),
    a("scene", "node.id"),
  ],
  "CanonicalNode.type": [
    a("mutation", "type: tagToType(element.type)"),
    a("scene", 'node.type === "frame"'),
  ],
  "CanonicalNode.name": [
    a("store", "const merged: CanonicalNode"),
    a("view", "componentName: node.name"),
  ],
  "CanonicalNode.props": [
    a("mutation", "props: element.props as Record<string, unknown>"),
    a("scene", "let props = { ...(node.props ?? {}) }"),
  ],
  "CanonicalNode.fills": [
    a("store", "const merged: CanonicalNode"),
    a("scene", "Array.isArray(node.fills) && node.fills.length > 0"),
  ],
  "CanonicalNode.responsive": [
    a("store", "const merged: CanonicalNode"),
    a("scene", "if (node.responsive) sceneNode.responsive"),
  ],
  "CanonicalNode.enabled": [
    a("store", "const merged: CanonicalNode"),
    a("resolver", "return node.enabled !== false"),
  ],
  "CanonicalNode.sizing": [
    a("store", "const merged: CanonicalNode"),
    a("scene", "if (node.sizing) sceneNode.sizing"),
  ],
  "CanonicalNode.state": [
    a("mutation", "...canonicalStateField(element, previousNode)"),
    a("view", "out.state = node.state"),
  ],
  "CanonicalNode.metadata": [
    a("mutation", "metadata: buildCanonicalMutationMetadata(metadataElement)"),
    a("scene", "...(node.metadata ? { metadata: node.metadata } : {})"),
  ],
  "CanonicalNode.reusable": [
    a("adapter", "...(roleResult.reusable ? { reusable: true } : {})"),
    a("resolver", "if (node.reusable === true) masters.push(node)"),
  ],
  "CanonicalNode.children": [
    a("mutation", "children: upsertChild(node.children, child)"),
    a("resolver", "node.children && node.children.length > 0"),
  ],
  "CanonicalNode.slot": [
    a("store", "const merged: CanonicalNode"),
    a("scene", "sceneNode.slot = node.slot"),
  ],
  "CanonicalNode.theme": [
    a("store", "const merged: CanonicalNode"),
    a(
      "apps/builder/src/adapters/canonical/frameLayoutCascade.ts",
      "...(node.theme ? { theme: node.theme } : {})",
    ),
  ],
  "FrameNode.type": [
    a("mutation", "type: tagToType(element.type)"),
    a(
      "apps/builder/src/adapters/canonical/frameElementScope.ts",
      'node.type === "frame"',
    ),
  ],
  "FrameNode.clip": [
    a("mutation", "? { clip: (element as Element & { clip: boolean }).clip }"),
    null,
  ],
  "FrameNode.placeholder": [
    a(
      "mutation",
      "placeholder: (element as Element & { placeholder: boolean })",
    ),
    null,
  ],
  "RefNode.type": [a("mutation", 'type: "ref"'), a("resolver", "refNode.ref")],
  "RefNode.ref": [
    a("mutation", "ref: masterNode?.id ?? refTarget"),
    a("resolver", "findReusableMaster(doc, refNode.ref, imports)"),
  ],
  "RefNode.descendants": [
    a("store", "nextDescendants[descendantPath] = value"),
    a("resolver", "refNode.descendants as Record<string, unknown> | undefined"),
  ],
  "CompositionDocument.version": [
    a("adapter", 'version: "composition-1.0"'),
    a("resolver", "cached.version === doc.version"),
  ],
  "CompositionDocument.themes": [
    a("themeActions", ".setThemes(after)"),
    a("themeActions", "const active = getActiveTheme(doc)"),
  ],
  "CompositionDocument.tokens": [
    a(
      "adapter",
      "...(tokensSnapshot !== undefined ? { tokens: tokensSnapshot } : {})",
    ),
    a("themeActions", "rootTokens ?? activeDocument()?.tokens"),
  ],
  "CompositionDocument.componentRules": [
    null,
    a(
      "packages/shared/src/catalog/resolvers/resolveComponentRule.ts",
      "doc?.componentRules",
    ),
  ],
  "CompositionDocument.imports": [
    a("pencil", "...(imports ? { imports } : {})"),
    a("resolver", "const source = doc.imports?.[parsed.importKey]"),
  ],
  "CompositionDocument.pagePositions": [
    a("store", "setPagePositions: (entries) =>"),
    a("page", "input.legacyPositions"),
  ],
  "CompositionDocument.pageLayout": [
    a("store", "setPageLayout: (patch) =>"),
    a("page", "pageLayout?.gap"),
  ],
  "CompositionDocument.pageGuides": [
    a("store", "setPageGuides: (entries) =>"),
    a("guide", "doc?.pageGuides?.[pageId]?.[breakpoint]"),
  ],
  "CompositionDocument._meta": [
    a("pencil", "_meta: { schemaVersion: CANONICAL_SCHEMA_VERSION }"),
    null,
  ],
  "CompositionDocument.children": [
    a(
      "adapter",
      "children: [...layoutFrames, ...reusableMasters, ...pageNodes]",
    ),
    a("resolver", "return doc.children"),
  ],
  "CompositionDocument.events": [
    a("store", "setEvents: (events) =>"),
    a(
      "apps/builder/src/preview/App.tsx",
      "buildInteractionIndex(canonicalDocument?.events)",
    ),
  ],
  "CompositionDocument.actions": [a("store", "setActions: (actions) =>"), null],
  "ThemeDefinition.id": [
    a("themePure", "return { id, name, preset:"),
    a("themeReader", "themeId: theme.id"),
  ],
  "ThemeDefinition.name": [
    a("themeActions", "createThemeDefinition("),
    a("themeActions", "themeName"),
  ],
  "ThemeDefinition.preset": [
    a("themePure", "[id]: { ...item, preset }"),
    a("themeReader", "const preset = theme.preset"),
  ],
  "ThemeDefinition.tokens": [
    a("themePure", "[id]: { ...item, tokens }"),
    a("themeReader", "...theme.tokens"),
  ],
  "ThemesCollection.active": [
    a("themePure", "setActiveTheme("),
    a("themeActions", "const active = getActiveTheme(doc)"),
  ],
  "ThemesCollection.items": [
    a(
      "themePure",
      "items: { ...collection.items, [definition.id]: definition }",
    ),
    a("themePure", "const item = collection.items[id]"),
  ],
  "ThemesCollection.order": [
    a("themePure", "const order = [...collection.order]"),
    a("themePure", "for (const id of collection.order)"),
  ],
  "PagePlacement.style": [
    a("store", "setPagePlacements: (entries) =>"),
    a("page", "resolvePagePlacementStyle("),
  ],
  "PagePlacement.responsive": [
    a("store", "setPagePlacements: (entries) =>"),
    a(
      "page",
      "placement.responsive ? { styles: placement.responsive } : undefined",
    ),
  ],
  "PageLayoutSettingsDocument.direction": [
    a("store", "setPageLayout: (patch) =>"),
    a("page", "direction: normalizeDirection(pageLayout?.direction)"),
  ],
  "PageLayoutSettingsDocument.gap": [
    a("store", "setPageLayout: (patch) =>"),
    a("page", "pageLayout?.gap"),
  ],
  "PageLayoutSettingsDocument.columns": [
    a("store", "setPageLayout: (patch) =>"),
    a("page", "pageLayout?.columns"),
  ],
  "PageLayoutSettingsDocument.responsive": [
    a("store", "setPageLayout: (patch) =>"),
    a("page", "pageLayout?.responsive?.gap"),
  ],
  "PageLayoutSettingsDocument.placementModel": [
    a("pageHydration", 'patch: { placementModel: "derived" }'),
    a("page", "placementModel: pageLayout?.placementModel ?? null"),
  ],
  "PageLayoutSettingsDocument.placements": [
    a("store", "setPagePlacements: (entries) =>"),
    a("page", "input.pageLayout?.placements"),
  ],
  "PageLayoutSettingsDocument.legacyFallback": [
    a("pageCommit", "legacyFallback: fallback"),
    a("page", "input.pageLayout?.legacyFallback?.[input.activeBreakpoint]"),
  ],
  "PageGuideLine.id": [
    a("store", "[entry.breakpoint]: guides.map((g) => ({ ...g }))"),
    a("store", "a.id !== b.id"),
  ],
  "PageGuideLine.axis": [
    a("store", "[entry.breakpoint]: guides.map((g) => ({ ...g }))"),
    a("store", "a.axis !== b.axis"),
  ],
  "PageGuideLine.position": [
    a("store", "[entry.breakpoint]: guides.map((g) => ({ ...g }))"),
    a("store", "a.position !== b.position"),
  ],
};
const dispositions = {
  "CompositionDocument.tokens":
    "OPTIONAL_OLD_ADAPTER_INPUT; current theme UI writes ThemesCollection item token delta, not root tokens",
  "CompositionDocument.componentRules":
    "FUTURE_OVERRIDE_HOOK; current table is code library, no old public writer",
  "CompositionDocument.imports":
    "EXTERNAL_PEN_IMPORT_ONLY; no current Builder editor command for import map",
  "CompositionDocument.pagePositions":
    "LEGACY_PAGE_POSITION_OR_DEBUG_INPUT; derived page placement owns new projects",
  "CompositionDocument._meta":
    "PENCIL_IMPORT_MARKER_ONLY; absent from new old Builder project",
  "CompositionDocument.actions":
    "DORMANT_ROOT_AND_IDB_MIRROR; InteractionRule has inline action and no chain consumer",
  "PageLayoutSettingsDocument.legacyFallback":
    "LEGACY_MODEL_ROLLBACK_ONLY; absent in derived new project",
  "FrameNode.clip":
    "KNOWN_OLD_RUNTIME_GAP; canonical value survives refresh but Canvas reads style.overflow instead",
  "FrameNode.placeholder":
    "NO_OLD_LIVE_RUNTIME_READER_FOUND; Pencil export and slot adapter preserve field, generic Canvas ignores it",
};
const save = a("save", "const { children, ...header } = document");
const nodeSave = a("save", "const { children: nested, ...properties } = node");
const refresh = a(
  "save",
  "export function joinDocument(parts: Map<string, string>)",
);
const rows = matrix.entries.map((entry) => {
  const pair = spec[entry.key];
  if (!pair) throw new Error(`${entry.key}: writer/reader route missing`);
  const [writer, reader] = pair;
  const disposition = dispositions[entry.key] ?? null;
  const sample = entry.oldSampleEvidence ?? null;
  const activeReaderOutput =
    {
      "CanonicalNode.state":
        "core-active-flow/baseline.json#reader.childElementState",
      "RefNode.descendants":
        "core-active-flow/baseline.json#reader.refResolved.labels",
      "CompositionDocument.pageLayout":
        "core-active-flow/baseline.json#reader.mobileLayout",
      "CompositionDocument.events":
        "core-active-flow/baseline.json#reader.interaction",
      "ThemeDefinition.tokens":
        "core-active-flow/baseline.json#reader.theme.tint",
      "PagePlacement.responsive":
        "core-active-flow/baseline.json#reader.mobilePlacement",
      "PageLayoutSettingsDocument.responsive":
        "core-active-flow/baseline.json#reader.mobileLayout",
    }[entry.key] ?? null;
  return {
    key: entry.key,
    oldWriter: writer,
    oldStore: a("store", "documents: nextMap"),
    oldReader: reader,
    oldSave:
      entry.key.startsWith("CanonicalNode.") ||
      entry.key.startsWith("FrameNode.") ||
      entry.key.startsWith("RefNode.")
        ? nodeSave
        : save,
    oldRefresh: refresh,
    oldSample: sample,
    activeReaderOutput,
    disposition,
    status: disposition
      ? disposition.split(";")[0]
      : sample?.scope.startsWith("one old Builder public action")
        ? "OLD_PUBLIC_ACTION_DOCUMENT_IDB_REFRESH_SAMPLE; SPECIFIC_CONSUMER_VALUE_NOT_PROVEN_BY_THIS_MATRIX"
        : sample
          ? "OLD_CREATION_OR_HYDRATION_DOCUMENT_IDB_REFRESH_SAMPLE; SPECIFIC_CONSUMER_VALUE_NOT_PROVEN_BY_THIS_MATRIX"
          : "ACTIVE_FIELD_WITHOUT_OLD_OUTPUT",
  };
});
if (rows.length !== 51 || Object.keys(spec).length !== 51)
  throw new Error("Core flow coverage drift");
const report = {
  head,
  status:
    "SOURCE_ROUTES_AND_OLD_ROUNDTRIP_SAMPLES_CLASSIFIED; FIELD_SPECIFIC_CONSUMER_BEHAVIOR_PARTIAL",
  summary: {
    fields: rows.length,
    sourceRouteRows: rows.filter((row) => row.oldWriter && row.oldReader)
      .length,
    publicActionRoundtripSamples: rows.filter((row) =>
      row.status.startsWith("OLD_PUBLIC_ACTION"),
    ).length,
    creationOrHydrationRoundtripSamples: rows.filter((row) =>
      row.status.startsWith("OLD_CREATION"),
    ).length,
    explicitDispositions: rows.filter((row) => row.disposition).length,
    sourceReaderAbsent: rows
      .filter((row) => !row.oldReader)
      .map((row) => row.key),
    activeReaderOutputFields: rows.filter((row) => row.activeReaderOutput)
      .length,
    fieldSpecificConsumerOutputsVerified: 0,
  },
  commonSaveBoundary: { root: save, node: nodeSave, refresh },
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
