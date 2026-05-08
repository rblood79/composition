# composition IndexedDB Schema Documentation

> **Version**: 15
> **Last Updated**: 2026-05-08
> **Primary DB**: `composition`
> **History DB**: `composition-history`
> **Source**: `apps/builder/src/lib/db/indexedDB/adapter.ts`

## Overview

Builder local project persistence is centered on a canonical
`CompositionDocument` record stored in the `composition.documents` object store.
Legacy local project mirror stores are not current runtime sources.

The `composition` database keeps only active project, document, theme/token, and
Data Panel stores. Undo/redo history is stored in a separate IndexedDB database,
`composition-history`.

## Current Databases

### `composition` DB

| Property                     | Value                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Version                      | 15                                                                                    |
| Purpose                      | Local project metadata, canonical document primary, theme/token data, Data Panel data |
| Primary project-state source | `documents`                                                                           |

### `composition-history` DB

| Property | Value                                                         |
| -------- | ------------------------------------------------------------- |
| Version  | 1                                                             |
| Purpose  | Current undo/redo history persistence                         |
| Owner    | `apps/builder/src/builder/stores/history/historyIndexedDB.ts` |

## `composition` Object Stores

| Store Name      | Key Path     | Indexes                                                            | Status         |
| --------------- | ------------ | ------------------------------------------------------------------ | -------------- |
| `projects`      | `id`         | none                                                               | active         |
| `documents`     | `project_id` | none                                                               | active primary |
| `design_tokens` | `id`         | `project_id`, `theme_id`                                           | active         |
| `design_themes` | `id`         | `project_id`, `status`                                             | active         |
| `data_tables`   | `id`         | `project_id`, `name`                                               | active         |
| `api_endpoints` | `id`         | `project_id`, `name`, `targetDataTable`                            | active         |
| `variables`     | `id`         | `project_id`, `name`, `scope`, `page_id`                           | active         |
| `transformers`  | `id`         | `project_id`, `name`, `level`, `inputDataTable`, `outputDataTable` | active         |

## Store Schemas

### `projects`

Project list metadata for the local dashboard.

```typescript
interface Project {
  id: string;
  name: string;
  created_by?: string;
  domain?: string;
  created_at?: string;
  updated_at?: string;
}
```

### `documents`

Canonical project document primary storage. One record is stored per project.

```typescript
interface CanonicalDocumentRecord {
  project_id: string;
  document: CompositionDocument;
  updated_at: string;
}
```

`CompositionDocument.children[]` is the local structural order source for
pages, frames, reusable origins, instances, slot descendants, and element
children.

### `design_tokens`

Design token records keyed by token id.

```typescript
interface DesignToken {
  id: string;
  project_id: string;
  theme_id: string;
  name: string;
  type: string;
  value: unknown;
  scope?: string;
  alias_of?: string | null;
  css_variable?: string;
  created_at?: string;
  updated_at?: string;
}
```

Indexes:

- `project_id`
- `theme_id`

### `design_themes`

Theme records keyed by theme id.

```typescript
interface DesignTheme {
  id: string;
  project_id: string;
  name: string;
  status: "active" | "draft" | "archived";
  version?: number;
  parent_theme_id?: string;
  supports_dark_mode?: boolean;
  created_at?: string;
  updated_at?: string;
}
```

Indexes:

- `project_id`
- `status`

### `data_tables`

Data Panel table records keyed by table id.

```typescript
interface DataTable {
  id: string;
  project_id: string;
  name: string;
  columns?: unknown[];
  rows?: unknown[];
  created_at?: string;
  updated_at?: string;
}
```

Indexes:

- `project_id`
- `name`

### `api_endpoints`

Data Panel API endpoint records keyed by endpoint id.

```typescript
interface ApiEndpoint {
  id: string;
  project_id: string;
  name: string;
  targetDataTable?: string;
  created_at?: string;
  updated_at?: string;
}
```

Indexes:

- `project_id`
- `name`
- `targetDataTable`

### `variables`

Data Panel/runtime variable records keyed by variable id.

```typescript
interface Variable {
  id: string;
  project_id: string;
  name: string;
  scope: string;
  page_id?: string;
  value?: unknown;
  created_at?: string;
  updated_at?: string;
}
```

Indexes:

- `project_id`
- `name`
- `scope`
- `page_id`

`variables.page_id` is an active page-scoped Data Panel field. It is not a
legacy page mirror column.

### `transformers`

Data transformer records keyed by transformer id.

```typescript
interface Transformer {
  id: string;
  project_id: string;
  name: string;
  level?: string;
  inputDataTable?: string;
  outputDataTable?: string;
  created_at?: string;
  updated_at?: string;
}
```

Indexes:

- `project_id`
- `name`
- `level`
- `inputDataTable`
- `outputDataTable`

## `composition-history` Object Stores

Current undo/redo history is not stored in `composition`.

| Store Name        | Key Path | Indexes                                   | Status |
| ----------------- | -------- | ----------------------------------------- | ------ |
| `history-entries` | `id`     | `pageId`, `createdAt`, `pageId_createdAt` | active |
| `page-meta`       | `pageId` | none                                      | active |

```typescript
interface HistoryDBSchema {
  id: string;
  pageId: string;
  entry: HistoryEntry;
  createdAt: number;
}

interface PageHistoryMeta {
  pageId: string;
  currentIndex: number;
  totalEntries: number;
  lastUpdated: number;
}
```

## Removed Legacy Local Stores

The following object stores are not current local runtime sources. `DB_VERSION`
15 keeps them only in the delete-only upgrade cleanup list so old dev databases
drop stale stores during open.

| Removed Store      | Removal Reason                                                    |
| ------------------ | ----------------------------------------------------------------- |
| `pages`            | ADR-120 removed local project-state mirror persistence            |
| `elements`         | ADR-120 removed local project-state mirror persistence            |
| `layouts`          | ADR-120 removed local project-state mirror persistence            |
| `metadata`         | ADR-121 removed dormant sync metadata store/API                   |
| `history`          | ADR-121 removed duplicate `composition` history store/API         |
| `design_variables` | ADR-121 removed API-only adapter mismatch; no production consumer |

`order_num` and local `layout_id` indexes from pre-ADR-119/120 schema are not
part of the current `composition` IndexedDB schema. Supabase compatibility
projection and canonical adapter metadata are separate transport/boundary
concerns, not local IndexedDB object stores.

## Adapter Surface

`DatabaseAdapter` current groups:

- `projects`
- `documents`
- `designTokens`
- `themes`
- `data_tables`
- `api_endpoints`
- `variables`
- `transformers`
- `batch`

Removed groups:

- `pages`
- `elements`
- `layouts`
- `metadata`
- `history`
- `designVariables`

## Batch Operations

`batch.export()` exports:

- `project`
- `document`
- `designTokens`

`batch.import()` imports:

- `project`
- `document`
- `designTokens`

Sync metadata payloads are no longer part of the local IndexedDB batch API.

## Version History

| Version | Change                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| v1-v7   | Historical schema with project mirror stores, theme/token stores, history/metadata, and Data Panel stores    |
| v10     | ADR-116 direct cutover marker for canonical document primary                                                 |
| v11-v13 | Legacy order payload cleanup for element/page/layout mirror data and canonical metadata                      |
| v14     | ADR-120 delete-only cleanup for local `pages`/`elements`/`layouts` mirror stores                             |
| v15     | ADR-121 delete-only cleanup for dormant `metadata`, duplicate `history`, and stale `design_variables` stores |

## Verification

Current schema drift checks:

```bash
rg -n "createObjectStore\\(|createIndex\\(|deleteObjectStore\\(|objectStore\\(" apps/builder/src/lib/db/indexedDB/adapter.ts
rg -n "SyncMetadata|\\.metadata\\.(get|set|update)|metadata\\??: SyncMetadata" apps/builder/src/lib/db -g '*.ts'
rg -n "\\bhistory\\s*[:=]\\s*\\{|db\\.history|HistoryEntry|createObjectStore\\(\\\"history\\\"|objectStore\\(\\\"history\\\"" apps/builder/src/lib/db apps/builder/src/dashboard -g '*.ts' -g '*.tsx'
rg -n "db\\.designVariables|\\.designVariables\\.(insert|insertMany|update|delete|getById|getByProject|getByName|getAll)" apps/builder/src packages/shared/src -g '*.ts' -g '*.tsx' -g '!apps/builder/src/lib/db/**'
rg -n "\\bdesignVariables\\b|design_variables|DesignVariable" apps/builder/src/lib/db -g '*.ts'
```
