# ADR-120 Inventory: Legacy mirror persistence cleanup

## Snapshot

- Date: 2026-05-08
- ADR: [120](../completed/120-legacy-mirror-persistence-cleanup.md)
- Status: Implemented — 2026-05-08
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

| Evidence                         | File/line                                                                                                                                                 | Meaning                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| local persist primary            | `apps/builder/src/builder/main/BuilderCore.tsx:163`, `apps/builder/src/builder/stores/utils/frameActions.ts:73`                                           | active `CompositionDocument` is persisted via `db.documents`             |
| local hydrate primary            | `apps/builder/src/builder/hooks/usePageManager.ts:372`                                                                                                    | project hydrate reads `db.documents.get(projectId)`                      |
| project lifecycle document store | `apps/builder/src/dashboard/index.tsx:322`, `apps/builder/src/dashboard/index.tsx:354`, `apps/builder/src/dashboard/index.tsx:394`                        | dashboard create/delete uses `db.documents` for project document state   |
| adapter surface removed          | `apps/builder/src/lib/db/types.ts:90`, `apps/builder/src/lib/db/types.ts:142`                                                                             | `DatabaseAdapter` keeps `documents`; `pages/elements/layouts` are absent |
| IndexedDB cleanup                | `apps/builder/src/lib/db/indexedDB/adapter.ts:32`, `apps/builder/src/lib/db/indexedDB/adapter.ts:207`, `apps/builder/src/lib/db/indexedDB/adapter.ts:810` | DB v14 deletes legacy stores and keeps `documents` as primary            |
| project sync boundary            | `apps/builder/src/utils/projectSync.ts:65`, `apps/builder/src/utils/projectSync.ts:218`, `apps/builder/src/utils/projectSync.ts:293`                      | upload/download/delete source/sink local project state through documents |

## Delete Runtime Bucket (Closed)

These pre-implementation call sites were cleanup candidates because they read/write
local legacy mirror stores as project document state. ADR-120 implementation closed
the bucket: production `db.pages/elements/layouts` project-state grep gate is 0.

| Surface                        | Initial call site                                                                                                  | Final status                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| dashboard project create       | `apps/builder/src/dashboard/index.tsx`                                                                             | local `documents` only; cloud projection boundary                 |
| dashboard project delete       | `apps/builder/src/dashboard/index.tsx`                                                                             | local project document delete via `db.documents.delete`           |
| project upload/download/delete | `apps/builder/src/utils/projectSync.ts`                                                                            | local source/sink `db.documents`; Supabase row API transport only |
| element loader                 | `apps/builder/src/builder/stores/elementLoader.ts`                                                                 | active canonical document derived view                            |
| element create/update/remove   | `apps/builder/src/builder/stores/utils/*`                                                                          | active document mutation + `db.documents.put`                     |
| history/inspector/editor       | `apps/builder/src/builder/stores/history`, `apps/builder/src/builder/stores/inspectorActions.ts`, property editors | local mirror write removed                                        |
| page/frame binding/cascade     | `apps/builder/src/adapters/canonical/*`, `apps/builder/src/builder/stores/utils/frameActions.ts`                   | canonical document source; projection boundary retained           |
| drag/drop/factory/renderers    | canvas drag bridge, factory helpers, shared renderers                                                              | canonical splice/document persist or host callback only           |

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

## Final Search Gate

Implementation result on 2026-05-08:

```bash
rg -n "db\\.(pages|elements|layouts)" apps/builder/src packages/shared/src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!**/*.test.ts' -g '!**/*.test.tsx'
rg -n "pages:\\s*\\{|elements:\\s*\\{|layouts:\\s*\\{" apps/builder/src/lib/db/types.ts
rg -n "createObjectStore\\(\"(pages|elements|layouts)\"|objectStore\\(\"(pages|elements|layouts)\"" apps/builder/src/lib/db/indexedDB/adapter.ts
```

All three commands return 0 results. Remaining `pagesApi`/`elementsApi` references are
Supabase/cloud transport compatibility and canonical adapter wrapper boundary only.

## Completion Gates

| Gate                         | Evidence                                                                                           | Status |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | ------ |
| runtime local mirror 0       | production `db.pages/elements/layouts` project-state hits are 0                                    | PASS   |
| adapter surface removed      | `DatabaseAdapter` no longer exposes `pages/elements/layouts`                                       | PASS   |
| IndexedDB cleanup            | DB version 14; `pages/elements/layouts` objectStores removed by delete-only upgrade allowlist      | PASS   |
| cloud sync boundary explicit | upload derives rows from document; legacy-only download imports rows into document only            | PASS   |
| browser smoke                | new URL smoke shows DB v14, no mirror stores, document exists, no order payload, no console events | PASS   |
| final preflight              | `pnpm run codex:preflight` completed after docs/rules sync                                         | PASS   |
