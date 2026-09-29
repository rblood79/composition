#!/usr/bin/env node
// ADR-248 G0: dispose every old descendant write/call AST site by current reachability.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const dir = resolve(root, "docs/adr/design/248-baseline");
const read = (name) => JSON.parse(readFileSync(resolve(dir, name), "utf8"));
const old = read("descendant-caller-audit.json");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (old.head !== head) throw new Error("Descendant AST and HEAD differ");

const A = "ACTIVE_UI_OR_COMMAND_WRITER";
const D = "DERIVED_READER_OR_PROJECTION";
const M = "MIGRATION_OR_SEED_NORMALIZATION";
const I = "INACTIVE_OR_NO_PRODUCT_CALLER";
const canonical = "apps/builder/src/adapters/canonical/";
const builder = "apps/builder/src/builder/";
const route = (category, routeId, reason) => ({ category, routeId, reason });
const classify = (site) => {
  const p = site.path;
  const line = site.line;
  if (p === "packages/shared/src/schemas/project.schema.ts")
    return route(I, null, "Zod shape declaration; no document mutation");
  if (p === "packages/shared/src/types/pencil-adapter.types.ts")
    return line < 500
      ? route(
          I,
          "isolated-pen-import",
          "Pencil import constructs an override, but Builder product has no caller of importPencilDocument; isolated adapter oracle only",
        )
      : route(D, null, "Pencil export serializes the existing override");
  if (p === "packages/shared/src/utils/export.utils.ts")
    return route(D, null, "Project export reads an existing override");
  if (p === "packages/shared/src/utils/compositionDocumentOrder.ts")
    return route(
      A,
      "structural-order",
      "Shared insert/remove/move helper invoked by old public canonical actions",
    );
  if (p === `${canonical}index.ts`)
    return route(
      M,
      "legacy-to-canonical",
      "Legacy Element document conversion into canonical ref, not a public edit action",
    );
  if (p === `${canonical}pageFrameBinding.ts`)
    return route(
      A,
      "page-binding",
      "Old page/frame binding command rebuilds page ref/slot ownership",
    );
  if (p === `${canonical}slotAndLayoutAdapter.ts`)
    return route(
      M,
      "legacy-layout",
      "Old layout Element conversion builds mode C slot children",
    );
  if (p === `${canonical}legacyElementSanitizer.ts`)
    return route(
      D,
      null,
      "Old mirror serialization/projection, not the owner writer",
    );
  if (
    p === `${builder}stores/history/canonicalHistoryEvents.ts` ||
    p === `${builder}stores/history/historyActions.ts`
  )
    return route(
      A,
      "history-inverse",
      "Undo/Redo applies structural and descendant inverse writes",
    );
  if (p === "apps/builder/src/resolvers/canonical/index.ts")
    return route(
      D,
      null,
      "Resolver merges or reads descendant overrides without authoring",
    );
  if (p === `${canonical}canonicalMutations.ts`)
    return route(
      A,
      "element-mutation",
      "Old public element mutation helper writes canonical node/descendant structure",
    );
  if (p === `${canonical}canonicalRefResolution.ts`)
    return line <= 330
      ? route(
          A,
          site.callee === "withCanonicalRefDescendantFills" || line === 301
            ? "presentation-fills"
            : "presentation-style",
          "Presentation commit writes a ref descendant fill/style patch",
        )
      : route(D, null, "Resolved ref traversal or derived layer construction");
  if (p === `${canonical}legacyMetadata.ts`)
    return route(
      M,
      "legacy-metadata",
      "Legacy metadata reconstruction of prior descendant payload",
    );
  if (p === `${builder}stores/canonical/canonicalTraversalHelpers.ts`)
    return route(
      A,
      "history-inverse",
      "Shared override replacement helper called by history application",
    );
  if (p === `${builder}stores/utils/instanceActions.ts`)
    return route(
      A,
      "reset-override",
      "Public reset command removes one old instance descendant field",
    );
  if (p === `${builder}stores/canonical/canonicalDocumentStore.ts`)
    return route(
      A,
      "canonical-actions",
      "Public canonical command API; no current panel caller for these methods, but updateDescendant on an existing persisted ref reaches the old resolver and survives refresh",
    );
  if (p === `${builder}panels/canonicalPanelNodes.ts`)
    return route(
      D,
      null,
      "Panel model projection copies descendants for display",
    );
  if (
    p === `${builder}components/groupItemInsert.ts` ||
    p === `${builder}panels/properties/FrameSlotSection.tsx`
  )
    return route(
      A,
      "group-item-insert",
      "Frame slot UI plans a group item insertion",
    );
  if (p === `${builder}components/stateVariantMigration.ts`)
    return route(
      M,
      "state-variant-migration",
      "Seed/origin normalization of old state variant refs",
    );
  if (p === `${builder}components/staticCollectionMigration.ts`)
    return route(
      M,
      "static-collection-migration",
      "Old static collection to instance normalization",
    );
  if (p === `${builder}components/collectionItemInsert.ts`)
    return route(
      A,
      "collection-item-insert",
      "Slot Add command plans collection item ownership",
    );
  if (p === `${builder}components/originChildRefs.ts`)
    return route(
      M,
      "origin-child-normalization",
      "Seeded composite origin child/ref normalization",
    );
  if (p === `${builder}workspace/canvas/scene/canvasSceneNode.ts`)
    return route(
      D,
      null,
      "Canvas scene or virtual row projection; no document write",
    );
  if (p === `${builder}components/tableColumnInsert.ts`)
    return route(
      A,
      "table-column-insert",
      "Table column/row Add command plans owned descendants",
    );
  if (p === `${builder}components/slotFillEdit.ts`)
    return route(
      A,
      "slot-owned-edit",
      "Inspector helper writes owned mode C child, including nested ref",
    );
  if (
    p === `${builder}components/migrateDialogTriggerInstances.ts` ||
    p === `${builder}components/dialogRegionPaths.ts`
  )
    return route(
      M,
      "dialog-region-migration",
      "Legacy dialog region path rewrite",
    );
  if (p === `${builder}components/tree/treeTemplateOrigins.ts`)
    return route(
      D,
      null,
      "Read-only code library template construction, not project authoring",
    );
  if (p === `${builder}components/stateVariantLayers.ts`)
    return route(D, null, "Read-only state layer/owned-key composition");
  if (p === `${builder}presentation/editorPresentationCommitAdapter.ts`)
    return route(
      A,
      site.callee === "withCanonicalRefDescendantFills"
        ? "presentation-fills"
        : "presentation-style",
      "Editor presentation commit owns the ref descendant patch",
    );
  if (p === `${builder}stores/inspectorActions.ts`)
    return route(
      A,
      "inspector-child-edit",
      "Inspector selected synthetic child command builds mode A/C patch",
    );
  if (p === `${builder}panels/properties/ComponentSemanticsSection.tsx`)
    return route(
      A,
      "reset-override",
      "Properties button invokes public reset override command",
    );
  throw new Error(
    `Unclassified ${site.path}:${site.line} ${site.callee ?? site.kind}`,
  );
};
const verify = (site) => {
  const lines = readFileSync(resolve(root, site.path), "utf8").split("\n");
  const current = lines[site.line - 1];
  if (!current || !current.includes(site.source))
    throw new Error(
      `AST anchor drift ${site.path}:${site.line}: ${site.source}`,
    );
  return { path: site.path, line: site.line, source: site.source };
};
const dispose = (site, kind) => ({
  ...verify(site),
  kind,
  callee: site.callee ?? null,
  ...classify(site),
});
const writes = old.writes.map((site) => dispose(site, "write"));
const calls = old.calls.map((site) => dispose(site, "direct-call"));
const all = [...writes, ...calls];
if (writes.length !== 115 || calls.length !== 40)
  throw new Error("Descendant AST cardinality changed");
const counts = Object.fromEntries(
  [A, D, M, I].map((category) => [
    category,
    all.filter((row) => row.category === category).length,
  ]),
);
const activeRoutes = [
  ...new Set(all.filter((row) => row.category === A).map((row) => row.routeId)),
].sort();
const report = {
  head,
  status: "ALL_AST_SITES_DISPOSED; ACTIVE_ROUTE_ORACLES_AUDITED_SEPARATELY",
  summary: {
    writeSites: writes.length,
    directCalls: calls.length,
    totalSites: all.length,
    categories: counts,
    activeRoutes,
    unclassified: 0,
  },
  writes,
  calls,
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);
