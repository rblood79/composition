# ADR-120 Inventory: Legacy mirror persistence cleanup

## Snapshot

- Date: 2026-05-08
- ADR: [120](../120-legacy-mirror-persistence-cleanup.md)
- Primary local source: `CompositionDocument` in IndexedDB `documents`
- Cleanup target: local `pages`/`elements`/`layouts` mirror persistence,
  `DatabaseAdapter.pages/elements/layouts`, and IndexedDB mirror objectStores
- Completion meaning: runtime project document state is not read from or written to
  local legacy mirror stores, the adapter public surface is removed, and the mirror
  objectStores are deleted. Compatibility/export/cloud projection may remain only as
  explicit `CompositionDocument`-derived boundary code.

## Strong Decisions

| Axis                         | ADR-120 decision                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------- |
| runtime local mirror         | production `db.pages/elements/layouts` project-state call sites become 0          |
| `DatabaseAdapter` surface    | `pages/elements/layouts` groups are removed, not kept as compatibility cache      |
| IndexedDB schema             | `pages/elements/layouts` objectStores are deleted after call site 0 + test gates  |
| Supabase/cloud compatibility | legacy row APIs may remain only as document-derived upload/download transport     |
| canonical/export adapters    | kept only when they project from canonical document, not when they read DB mirror |

## Current Primary Signals

| Evidence                                 | File/line                                                                                                                                                                                                      | Meaning                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| local persist primary                    | `apps/builder/src/builder/main/BuilderCore.tsx:163`                                                                                                                                                            | active `CompositionDocument` is persisted via `db.documents` |
| local hydrate primary                    | `apps/builder/src/builder/hooks/usePageManager.ts:372`                                                                                                                                                         | project hydrate reads `db.documents.get(projectId)`          |
| adapter still exposes legacy + documents | `apps/builder/src/lib/db/types.ts:108`, `apps/builder/src/lib/db/types.ts:127`, `apps/builder/src/lib/db/types.ts:183`, `apps/builder/src/lib/db/types.ts:193`                                                 | `pages/elements/layouts` coexist with `documents`            |
| IndexedDB still creates legacy stores    | `apps/builder/src/lib/db/indexedDB/adapter.ts:204`, `apps/builder/src/lib/db/indexedDB/adapter.ts:210`, `apps/builder/src/lib/db/indexedDB/adapter.ts:226`, `apps/builder/src/lib/db/indexedDB/adapter.ts:302` | `documents`, `pages`, `elements`, `layouts` stores coexist   |

## Delete Runtime Bucket

These call sites are cleanup candidates because they read/write local legacy mirror
stores as project document state.

| Surface                        | Current call site                                                                                                                                                                                                                                                                                              | ADR-120 direction                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| dashboard project create       | `apps/builder/src/dashboard/index.tsx:301`, `apps/builder/src/dashboard/index.tsx:313`, `apps/builder/src/dashboard/index.tsx:324`                                                                                                                                                                             | create local `documents` only; cloud projection boundary                              |
| dashboard project delete       | `apps/builder/src/dashboard/index.tsx:356`, `apps/builder/src/dashboard/index.tsx:381`                                                                                                                                                                                                                         | delete `documents`; keep non-project-data store cleanup                               |
| project upload                 | `apps/builder/src/utils/projectSync.ts:59`, `apps/builder/src/utils/projectSync.ts:88`                                                                                                                                                                                                                         | source from `db.documents`; project legacy upload derived                             |
| project download               | `apps/builder/src/utils/projectSync.ts:159`, `apps/builder/src/utils/projectSync.ts:178`, `apps/builder/src/utils/projectSync.ts:189`                                                                                                                                                                          | prefer cloud document; avoid local mirror recreation                                  |
| project delete                 | `apps/builder/src/utils/projectSync.ts:223`, `apps/builder/src/utils/projectSync.ts:236`                                                                                                                                                                                                                       | local delete via `documents`; cloud API boundary only                                 |
| element loader                 | `apps/builder/src/builder/stores/elementLoader.ts:123`, `apps/builder/src/builder/stores/elementLoader.ts:164`                                                                                                                                                                                                 | derive from canonical document or remove loader path                                  |
| element create                 | `apps/builder/src/builder/stores/utils/elementCreation.ts:176`, `apps/builder/src/builder/stores/utils/elementCreation.ts:181`                                                                                                                                                                                 | keep canonical merge + document persist; remove mirror insert                         |
| element update                 | `apps/builder/src/builder/stores/utils/elementUpdate.ts:141`, `apps/builder/src/builder/stores/utils/elementUpdate.ts:160`                                                                                                                                                                                     | keep document persist; remove mirror update helpers                                   |
| inspector mirror persist       | `apps/builder/src/builder/stores/inspectorActions.ts:267`                                                                                                                                                                                                                                                      | persist inspector changes through canonical document only                             |
| page parent/slug editor        | `apps/builder/src/builder/panels/properties/editors/PageParentSelector.tsx:142`, `apps/builder/src/builder/panels/properties/editors/PageParentSelector.tsx:171`                                                                                                                                               | update canonical page metadata; remove page row mirror write                          |
| page delete UI                 | `apps/builder/src/builder/panels/nodes/PagesSection.tsx:277`, `apps/builder/src/builder/panels/nodes/PagesSection.tsx:281`, `apps/builder/src/builder/panels/nodes/PagesSection.tsx:283`                                                                                                                       | delete from canonical document; remove page/elements row delete                       |
| frame create/update            | `apps/builder/src/builder/stores/utils/frameActions.ts:168`, `apps/builder/src/builder/stores/utils/frameActions.ts:226`                                                                                                                                                                                       | canonical reusable frame node primary                                                 |
| frame delete                   | `apps/builder/src/builder/stores/utils/frameActions.ts:193`, `apps/builder/src/builder/stores/utils/frameActions.ts:200`                                                                                                                                                                                       | canonical delete primary; remove layout row delete                                    |
| page-frame binding             | `apps/builder/src/adapters/canonical/pageFrameBinding.ts:303`                                                                                                                                                                                                                                                  | canonical binding primary; remove page row mirror write                               |
| frame element load             | `apps/builder/src/adapters/canonical/frameElementLoader.ts:72`                                                                                                                                                                                                                                                 | resolve from active document                                                          |
| frame cascade adapter          | `apps/builder/src/adapters/canonical/frameLayoutCascade.ts:249`, `apps/builder/src/adapters/canonical/frameLayoutCascade.ts:346`, `apps/builder/src/adapters/canonical/frameLayoutCascade.ts:374`                                                                                                              | keep cascade semantics; remove local mirror store as source                           |
| layout preset cleanup          | `apps/builder/src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.ts:172`                                                                                                                                                                                                                | remove preset slots through canonical document only                                   |
| drag/drop persist              | `apps/builder/src/builder/workspace/canvas/hooks/useDragBridge.ts:148`, `apps/builder/src/builder/workspace/canvas/hooks/useDragBridge.ts:487`                                                                                                                                                                 | canonical splice + document persist only                                              |
| factory creation/cache         | `apps/builder/src/builder/factories/utils/elementCreation.ts:124`, `apps/builder/src/builder/factories/utils/dbPersistence.ts:91`                                                                                                                                                                              | route factory persistence and parent lookup through canonical document                |
| collection/selection renderers | `packages/shared/src/renderers/CollectionRenderers.tsx:417`, `packages/shared/src/renderers/SelectionRenderers.tsx:979`                                                                                                                                                                                        | remove renderer-side direct DB element writes or route through explicit host callback |
| item/property editors          | `apps/builder/src/builder/panels/properties/editors/TagEditor.tsx:137`, `apps/builder/src/builder/panels/properties/editors/ListBoxItemEditor.tsx:140`, `apps/builder/src/builder/panels/properties/editors/TreeItemEditor.tsx:88`, `apps/builder/src/builder/panels/properties/editors/tabsItemActions.ts:48` | create/update child items through canonical document mutation boundary                |
| instance materialization       | `apps/builder/src/builder/stores/utils/instanceActions.ts:189`                                                                                                                                                                                                                                                 | materialize/detach through canonical document; remove local element mirror insert     |

## Project Sync Boundary Bucket

| Surface                        | Current state                                                                                | ADR-120 decision                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pagesApi`                     | imported and used by dashboard/projectSync                                                   | keep only as document-derived cloud projection or replace                        |
| `legacyElementsApiService`     | imported by services/projectSync/canonical wrappers                                          | keep only as projection boundary until cloud document API                        |
| Supabase `pages`/`elements`    | current manual types expose legacy physical tables; no current `documents` API hit was found | local cleanup proceeds; upload/download uses one-shot document projection/import |
| `projectSync.order_num` upload | ADR-119 allows call-time derived `pages.order_num` compatibility in upload                   | remove when cloud document primary exists                                        |

## Canonical Adapter Boundary Bucket

These are not automatic deletion targets. They should be kept or narrowed until
export/import/cloud compatibility no longer needs them.

| Surface                                                      | Allowed reason                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `apps/builder/src/adapters/canonical/legacyElementFields.ts` | canonical-node legacy field serialization quarantine        |
| `apps/builder/src/adapters/canonical/canonicalMutations.ts`  | canonical primary mutation bridge and projection wrapper    |
| `apps/builder/src/adapters/canonical/frameMirror.ts`         | page/frame binding compatibility boundary                   |
| `apps/builder/src/adapters/canonical/slotMirror.ts`          | slot mirror compatibility boundary                          |
| `packages/shared/src/utils/export.utils.ts`                  | canonical document to render/export model projection        |
| `packages/shared/src/utils/legacyExtensionFields.ts`         | renderer compatibility for legacy events/dataBinding fields |

## Out Of Scope Bucket

| Surface                                     | Reason                                               |
| ------------------------------------------- | ---------------------------------------------------- |
| Table/TableRenderer `order_num`             | component data model, not project mirror persistence |
| collection item migration `order_num` tests | legacy collection data migration fixture             |
| font/theme/data table stores                | not page/element/layout document mirror              |
| historical comments in completed ADRs       | documentation history                                |
| tests verifying legacy import rejection     | regression guard                                     |

## Phase 0 Search Baseline

Use these commands at implementation start and paste updated counts into this file.

```bash
rg -n "db\\.(pages|elements|layouts)" apps/builder/src packages/shared/src
rg -n "pagesApi|elementsApi|layoutsApi" apps/builder/src packages/shared/src
rg -n "createObjectStore\\(\"(pages|elements|layouts)\"|objectStore\\(\"(pages|elements|layouts)\"" apps/builder/src/lib/db/indexedDB/adapter.ts
rg -n "legacyElementsApiService|PagesApiService" apps/builder/src packages/shared/src
```

## Completion Gates

| Gate                         | Required evidence                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| runtime local mirror 0       | production `db.pages/elements/layouts` project-state hits are 0                         |
| adapter surface removed      | `DatabaseAdapter` no longer exposes `pages/elements/layouts`                            |
| IndexedDB cleanup            | `pages/elements/layouts` objectStores removed; delete-only upgrade allowlist fixed      |
| cloud sync boundary explicit | upload derives rows from document; legacy-only download imports rows into document only |
| browser smoke                | refresh, frame binding, origin/instance, drag/drop, project create/delete verified      |
