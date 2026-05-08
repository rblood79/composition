# ADR-119 Inventory: Page/Layout order mirror cleanup

## Snapshot

- Date: 2026-05-08
- ADR: [119](../completed/119-page-layout-order-mirror-cleanup.md)
- Canonical source: `CompositionDocument.children[]`
- Runtime order rule: page/layout order is source order projection, not
  `pages.order_num`, `layouts.order_num`, or page/layout `metadata.order_num`.
- Completion meaning: ADR-119 removes page/layout/runtime order mirror usage. It
  does not claim repo-wide textual deletion of every `order_num` occurrence.

## Deleted Runtime Reads/Writes

| Bucket          | Deleted surface                                 | Replacement                                  |
| --------------- | ----------------------------------------------- | -------------------------------------------- |
| `runtime-read`  | PageTree `PageTreeNode.orderNum`                | incoming page array source order             |
| `runtime-read`  | PageTree metadata `order_num` comparison        | `pageId`, `slug`, `parent_id` only           |
| `runtime-read`  | Preview `RuntimePage.order_num`                 | runtime page array source order              |
| `runtime-read`  | reusable frame metadata `order_num` projection  | root reusable frame source order             |
| `runtime-read`  | renderer layout invalidation `layout.order_num` | layout id/name/slug/binding fields           |
| `runtime-write` | PageTree DnD `orderNum` updates                 | ordered id update list + `parentId`          |
| `runtime-write` | page create max `order_num` calculation         | page count only for label/slug               |
| `runtime-write` | page/body bootstrap `order_num: 0`              | no order mirror written                      |
| `runtime-write` | reusable frame create `layouts.order_num`       | canonical append order                       |
| `metadata`      | page shell `metadata.order_num`                 | removed; stale existing metadata is stripped |
| `metadata`      | layout shell `metadata.order_num`               | removed; stale existing metadata is stripped |
| `schema`        | IndexedDB `pages.order_num` index               | DB upgrade `deleteIndex("order_num")`        |
| `schema`        | IndexedDB `layouts.order_num` index             | DB upgrade `deleteIndex("order_num")`        |
| `schema`        | stale IndexedDB row/document `order_num` values | DB v13 value payload purge                   |

## Compatibility Boundary

| Surface                                      | Status  | Rule                                                          |
| -------------------------------------------- | ------- | ------------------------------------------------------------- |
| `PagesApiService.Page.order_num`             | allowed | Supabase physical schema compatibility only                   |
| `Database.public.Tables.pages.Row.order_num` | allowed | generated/manual Supabase type boundary                       |
| `projectSync.syncProjectToCloud()`           | allowed | derives `order_num` from local page source index at call time |
| export JSON fixtures                         | allowed | legacy fixture coverage, not runtime primary                  |

## Out Of Scope

| Surface                         | Reason                                              |
| ------------------------------- | --------------------------------------------------- |
| Table column/group `order_num`  | component data model, explicitly out of ADR-119     |
| collection item migration tests | component data migration, explicitly out of ADR-119 |
| Supabase physical column drop   | requires separate migration approval                |

## Residual Search Allowlist

`rg -n "order_num|orderNum" apps/builder/src packages/shared/src packages/specs/src
-g '!**/*.test.*' -g '!**/__tests__/**'`의 잔존 hit는 다음 분류만 허용한다.

| Residual surface                                | Allowed reason                                              |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `PagesApiService.Page.order_num`                | Supabase physical schema compatibility type only            |
| `supabase.types.ts` pages row `order_num`       | Supabase physical schema compatibility type only            |
| `projectSync.ts` `order_num: pageIndex`         | upload call-time derived boundary, never local runtime read |
| IndexedDB `deleteIndex("order_num")`            | old index removal migration guard                           |
| IndexedDB `stripLegacyOrderPayload`             | DB v13 stale value purge, not runtime order source          |
| page/layout metadata `delete ...order_num`      | stale metadata strip guard                                  |
| shared export JSON fixtures                     | legacy fixture coverage                                     |
| Table/TableRenderer `order_num`                 | component data model, out of ADR-119 scope                  |
| comments documenting removed legacy `order_num` | historical guardrail only                                   |

## Browser/IndexedDB Verification Note

2026-05-08에 실제 Builder URL
`http://localhost:5173/builder/394ad236-73cd-40c4-91f1-ee57bc699e41`을 reload한 뒤
DevTools에서 IndexedDB를 확인했다.

| Check                         | Result                         |
| ----------------------------- | ------------------------------ |
| `composition` DB version      | 13                             |
| `pages` indexes               | `["project_id"]`               |
| `layouts` indexes             | `["name","project_id","slug"]` |
| `elements` indexes            | `["page_id","parent_id"]`      |
| `pages` row `order_num` count | 0                              |
| `layouts` row `order_num`     | 0                              |
| `elements` row `order_num`    | 0                              |
| project document order hits   | `[]`                           |

## Verification

```bash
pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts src/utils/__tests__/compositionDocumentOrder.test.ts
pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts src/builder/panels/nodes/tree/PageTree/usePageTreeDnd.test.ts src/builder/stores/canonical/__tests__/canonicalFrameStore.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/stores/__tests__/pageRemovalSemantics.test.ts src/builder/stores/canonical/__tests__/canonicalDocumentStore.test.ts
pnpm run codex:typecheck
```
