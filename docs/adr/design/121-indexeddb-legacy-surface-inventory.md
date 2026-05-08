# ADR-121 Inventory: IndexedDB legacy surface cleanup

## Snapshot

- Date: 2026-05-08
- ADR: [121](../completed/121-indexeddb-legacy-surface-cleanup.md)
- Status: Implemented
- Primary local project state: `CompositionDocument` in `composition.documents`
- Cleanup target: dormant/mismatched `composition` DB store/API surface after ADR-120

## Post-Implementation `composition` ObjectStore Scan

Source: `apps/builder/src/lib/db/indexedDB/adapter.ts`.

| Store              | Current creation | Consumer state                               | Classification       | ADR-121 result                    |
| ------------------ | ---------------- | -------------------------------------------- | -------------------- | --------------------------------- |
| `projects`         | yes              | dashboard/project lifecycle                  | active               | kept                              |
| `documents`        | yes              | canonical project document primary           | active primary       | kept                              |
| `design_tokens`    | yes              | `TokenService`, dashboard/projectSync delete | active feature store | kept                              |
| `design_themes`    | yes              | `ThemeService`, dashboard/projectSync delete | active feature store | kept                              |
| `data_tables`      | yes              | data panel read/write + project delete       | active feature store | kept                              |
| `api_endpoints`    | yes              | data panel read/write + project delete       | active feature store | kept                              |
| `variables`        | yes              | data panel/runtime variable read/write       | active feature store | kept                              |
| `transformers`     | yes              | data panel read/write + project delete       | active feature store | kept                              |
| `metadata`         | no               | production consumer 0 after cleanup          | dormant legacy sync  | removed + delete-only cleanup     |
| `history`          | no               | duplicate `composition` store removed        | duplicate dormant    | removed + delete-only cleanup     |
| `pages`            | no               | ADR-120 removed                              | legacy mirror        | delete-only cleanup retained      |
| `elements`         | no               | ADR-120 removed                              | legacy mirror        | delete-only cleanup retained      |
| `layouts`          | no               | ADR-120 removed                              | legacy mirror        | delete-only cleanup retained      |
| `design_variables` | no               | production consumer 0 after cleanup          | API-only mismatch    | API removed + delete-only cleanup |

## Evidence

| Finding                                      | Evidence                                                                                                                             | Meaning                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| DB version is 15                             | `apps/builder/src/lib/db/indexedDB/adapter.ts:26`                                                                                    | ADR-121 schema cleanup version landed                        |
| `documents` is primary store                 | `apps/builder/src/lib/db/indexedDB/adapter.ts:198`-`:200`                                                                            | project document state remains canonical primary             |
| legacy/dormant stores are delete-only        | `apps/builder/src/lib/db/indexedDB/adapter.ts:204`-`:214`                                                                            | stale stores are dropped without reintroducing create paths  |
| active feature stores are still created      | `apps/builder/src/lib/db/indexedDB/adapter.ts:219`, `:243`, `:256`, `:268`, `:283`, `:297`                                           | theme/data stores stayed out of deletion bucket              |
| `DatabaseAdapter` active surface is narrowed | `apps/builder/src/lib/db/types.ts:38`-`:156`                                                                                         | `metadata`/`history`/`designVariables` public groups removed |
| batch payload excludes sync metadata         | `apps/builder/src/lib/db/indexedDB/adapter.ts:954`-`:999`                                                                            | `batch.export/import` no longer reads/writes `metadata`      |
| dashboard clears only current history DB     | `apps/builder/src/dashboard/index.tsx:359`-`:360`                                                                                    | duplicate `db.history.clear` call removed                    |
| real history DB is separate                  | `apps/builder/src/builder/stores/history/historyIndexedDB.ts:43`-`:46`                                                               | `composition-history` remains current undo/redo persistence  |
| real history save/read uses separate DB      | `apps/builder/src/builder/stores/history/historyIndexedDB.ts:133`, `apps/builder/src/builder/stores/history/historyIndexedDB.ts:212` | current history persistence path preserved                   |
| data stores have live read/write paths       | `apps/builder/src/builder/stores/utils/dataActions.ts:90`, `apps/builder/src/builder/stores/utils/dataActions.ts:139`                | data panel stores are active, not cleanup targets            |
| variables store has live write path          | `apps/builder/src/builder/stores/utils/dataActions.ts:652`, `apps/builder/src/builder/stores/utils/dataActions.ts:700`               | `variables.page_id` remains an active Data Panel field       |
| schema reference matches v15 model           | `docs/reference/schemas/INDEXDB.md:3`, `docs/reference/schemas/INDEXDB.md:37`-`:48`, `docs/reference/schemas/INDEXDB.md:214`-`:225`  | docs now separate active stores and removed legacy stores    |

## Column/Field Classification

| Field/surface                         | Current location                        | Classification               | Result                                               |
| ------------------------------------- | --------------------------------------- | ---------------------------- | ---------------------------------------------------- |
| `SyncMetadata.sync_enabled` etc.      | removed from DB adapter                 | dormant sync metadata        | removed                                              |
| `HistoryEntry.page_id`, `created_at`  | removed from `composition` DB adapter   | duplicate dormant history    | removed from `composition`; separate history DB kept |
| `Page.order_num`, `Element.order_num` | stale docs / cloud compatibility        | not local IndexedDB current  | kept out of current DB; docs cleaned                 |
| `layout_id`                           | canonical/export compatibility boundary | boundary field               | not removed under ADR-121                            |
| `componentRole`, `masterId`           | canonical adapter/cloud compatibility   | boundary field               | not removed under ADR-121                            |
| `variables.page_id`                   | Data Panel variable scope               | active feature field         | kept                                                 |
| `CanonicalNode.metadata.type`         | `CompositionDocument`                   | canonical compatibility hint | kept                                                 |
| `RefNode.descendants`                 | `CompositionDocument`                   | canonical ref model          | kept                                                 |

## Out Of Scope

| Surface                                    | Reason                                                         |
| ------------------------------------------ | -------------------------------------------------------------- |
| `composition-history` DB                   | current undo/redo persistence                                  |
| Supabase `pages`/`elements` transport API  | ADR-120 cloud compatibility boundary                           |
| canonical adapter `legacyElementFields`    | compatibility quarantine, not IndexedDB table/column           |
| `layout_id` in export/derived render model | frame/layout compatibility boundary                            |
| Table component `order_num`                | component data model, not IndexedDB project-state mirror       |
| historical completed ADR docs              | historical record; only current reference schema was rewritten |

## Search Gates

Post-implementation expected result: all commands below return 0 matches.

```bash
rg -n "SyncMetadata|\\bmetadata\\s*[:=]\\s*\\{|\\.metadata\\.(get|set|update)|metadata\\??: SyncMetadata" apps/builder/src/lib/db -g '*.ts'
rg -n "\\bhistory\\s*[:=]\\s*\\{|db\\.history|HistoryEntry|createObjectStore\\(\\\"history\\\"|objectStore\\(\\\"history\\\"" apps/builder/src/lib/db apps/builder/src/dashboard -g '*.ts' -g '*.tsx'
rg -n "db\\.designVariables|\\.designVariables\\.(insert|insertMany|update|delete|getById|getByProject|getByName|getAll)" apps/builder/src packages/shared/src -g '*.ts' -g '*.tsx' -g '!apps/builder/src/lib/db/**'
rg -n "\\bdesignVariables\\b|design_variables|DesignVariable" apps/builder/src/lib/db -g '*.ts'
rg -n "createObjectStore\\(\\\"(metadata|history|design_variables)\\\"|objectStore\\(\\\"(metadata|history|design_variables)\\\"" apps/builder/src/lib/db/indexedDB/adapter.ts
```

Allowed remaining broader-repo hits:

- `historyIndexedDB` and `composition-history`.
- ADR/design docs describing this cleanup.
- Historical completed ADRs.
