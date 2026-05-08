# ADR-120 Breakdown: Legacy mirror persistence 제거 계획

## Implementation Status

Implemented — 2026-05-08.

Phase 0 inventory seed: [120-legacy-mirror-persistence-inventory.md](120-legacy-mirror-persistence-inventory.md)

### Gate Closure Summary

| Gate | Status | Evidence                                                                                             |
| ---- | ------ | ---------------------------------------------------------------------------------------------------- |
| G0   | Done   | inventory bucket + allowlist 확정                                                                    |
| G1   | Done   | dashboard create/delete, `usePageManager`, `elementLoader` document-primary tests PASS               |
| G2   | Done   | element mutation/history/editor/drag local mirror write 제거 tests PASS                              |
| G3   | Done   | frame/page binding, frame loader, frame action canonical tests PASS                                  |
| G4   | Done   | `projectSync` document-primary static guard PASS                                                     |
| G5   | Done   | `DatabaseAdapter.pages/elements/layouts` 제거, DB_VERSION 14, legacy objectStore deletion guard PASS |
| G6   | Done   | grep gate 0, type-check/preflight PASS, browser smoke PASS, docs/rules sync 완료                     |

최종 검증 명령:

```bash
pnpm -F @composition/builder exec vitest run src/dashboard/__tests__/createInitialProjectDocument.test.ts src/dashboard/__tests__/dashboardLocalMirror.static.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/stores/__tests__/elementLoader.static.test.ts src/lib/db/__tests__/metaStore.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/stores/utils/__tests__/elementUpdateOriginImpact.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts src/builder/workspace/canvas/hooks/useDragBridge.test.ts src/builder/workspace/canvas/hooks/useDragBridge.static.test.ts
pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/adapters/canonical/__tests__/frameElementLoader.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts src/builder/stores/canonical/__tests__/canonicalFrameStore.test.ts
pnpm -F @composition/builder exec vitest run src/utils/projectSync.layoutId.static.test.ts src/lib/db/__tests__/metaStore.test.ts src/builder/stores/canonical
pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts src/utils/__tests__/compositionDocumentOrder.test.ts
pnpm run codex:typecheck
pnpm run codex:preflight
```

최종 grep gate:

```bash
rg -n "db\\.(pages|elements|layouts)" apps/builder/src packages/shared/src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!**/*.test.ts' -g '!**/*.test.tsx'
rg -n "pages:\\s*\\{|elements:\\s*\\{|layouts:\\s*\\{" apps/builder/src/lib/db/types.ts
rg -n "createObjectStore\\(\"(pages|elements|layouts)\"|objectStore\\(\"(pages|elements|layouts)\"" apps/builder/src/lib/db/indexedDB/adapter.ts
```

위 `rg` 3개는 모두 0건이어야 한다.

## Scope

이 문서는 ADR-111/112/113/116/118/119 이후 남은 local legacy mirror
persistence를 제거하는 실행 계획이다.

포함 범위:

- local IndexedDB `pages`/`elements`/`layouts` objectStore runtime read/write 제거 후
  objectStore 삭제.
- `DatabaseAdapter.pages/elements/layouts` public surface 제거.
- dashboard project create/delete, `usePageManager` hydrate, element/frame/page CRUD,
  history, inspector/editor, drag/drop path의 local mirror write 제거.
- `projectSync`를 canonical document primary 또는 document-derived cloud projection으로
  전환.
- IndexedDB schema cleanup과 docs/rules/changelog sync.

제외 범위:

- canonical format 재설계.
- `reusable/ref/descendants/slot/x-composition` contract 변경.
- Pencil/export/import adapter 삭제.
- Supabase physical schema drop의 즉시 수행.
- Table/collection data model cleanup.

## Scope Matrix

| Surface                                      | 포함 여부 | 최종 상태                                                                |
| -------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `DatabaseAdapter.documents`                  | In        | local project document primary 유지                                      |
| `DatabaseAdapter.pages/elements/layouts`     | In        | public surface 제거                                                      |
| IndexedDB `documents` store                  | In        | primary store 유지                                                       |
| IndexedDB `pages/elements/layouts` stores    | In        | runtime call site 0 이후 `DB_VERSION` bump로 삭제                        |
| dashboard create/delete                      | In        | project metadata + `documents` primary; mirror seed/delete 제거          |
| `usePageManager` hydrate                     | In        | `documents` only 유지, mirror fallback 금지                              |
| element create/update/remove                 | In        | active document mutation + `documents.put`; local `elements` mirror 제거 |
| history undo/redo                            | In        | document snapshot/mutation primary; `db.elements.*` mirror 제거          |
| canvas drag/drop                             | In        | canonical splice + `documents.put`; local `elements.updateMany` 제거     |
| page-frame binding / reusable frame actions  | In        | canonical node update; `pages.layout_id`/`layouts` mirror 제거           |
| frame element loader                         | In        | canonical frame scope resolver; `db.elements.getDescendants/getAll` 제거 |
| `pagesApi`/`elementsApi` Supabase projection | Boundary  | document-derived compatibility only until physical schema decision       |
| `apps/builder/src/adapters/canonical/**`     | Boundary  | active projection/export bridge; wholesale deletion 금지                 |
| `packages/shared/src/utils/export.utils.ts`  | Boundary  | export/render model projection boundary 유지                             |
| Table/collection `order_num`                 | Out       | component data model; ADR-120 범위 아님                                  |

## Phase 0: Inventory + Deletion Allowlist

### 작업

1. runtime call site를 전수 분류한다.
   - `db.pages.*`
   - `db.elements.*`
   - `db.layouts.*`
   - `pagesApi.*`
   - `elementsApi.*`
   - `layoutsApi.*`
2. bucket을 고정한다.
   - `delete-runtime`: local project document state의 read/write mirror.
   - `delete-schema`: IndexedDB objectStore/API surface.
   - `project-sync-boundary`: cloud compatibility projection.
   - `canonical-adapter-boundary`: export/import/resolution helper.
   - `non-project-data`: Table/collection/font/theme 등 별도 legacy.
   - `test-fixture`: regression fixture 또는 grep gate.
3. `apps/builder/src/adapters/canonical/**` 내부 helper를 삭제 대상과 boundary 대상으로
   분리한다.
4. `packages/shared/src/utils/export.utils.ts`의 runtime mirror field export는 cloud/export
   boundary로 유지할지, ADR-120 후속 G4에서만 축소할지 결정한다.
5. Phase 5에서 제거할 `DatabaseAdapter` method와 IndexedDB store list를 확정한다.

### 확인 명령

```bash
rg -n "db\\.(pages|elements|layouts)" apps/builder/src packages/shared/src
rg -n "pagesApi|elementsApi|layoutsApi" apps/builder/src packages/shared/src
rg -n "createObjectStore\\(\"(pages|elements|layouts)\"|objectStore\\(\"(pages|elements|layouts)\"" apps/builder/src/lib/db/indexedDB/adapter.ts
rg -n "layout_id|slot_name|componentRole|masterId|overrides|descendants" apps/builder/src packages/shared/src -g '!**/*.test.*' -g '!**/__tests__/**'
```

### 산출물

- `docs/adr/design/120-legacy-mirror-persistence-inventory.md` 갱신.
- 삭제 대상/허용 boundary 표.
- Phase별 targeted test list.

## Phase 1: Local Hydrate/Create/Delete Cutover

### 작업

1. dashboard project create:
   - local mode에서 `db.pages.insert(homePage)`와 `db.elements.insert(bodyElement)`를
     제거한다.
   - cloud/both mode에서 Supabase compatibility payload가 필요하면 canonical document에서
     call-time projection한다.
   - local primary는 `db.documents.put(projectId, createInitialProjectDocument(...))`만
     남긴다.
2. dashboard project delete:
   - local project document state 삭제는 `db.documents.delete(projectId)` 중심으로
     수행한다.
   - page별 `db.elements.getByPage/delete`, layout별
     `db.elements.getDescendants/delete`, `db.pages.delete`, `db.layouts.delete` loop를
     제거한다.
   - history/designTokens/themes/data_tables 등 별도 store delete는 유지한다.
3. `usePageManager.initializeProject`:
   - 이미 `db.documents.get(projectId)` primary인 경로를 유지한다.
   - mirror fallback 또는 mirror projection rebuild가 재도입되지 않도록 static guard를
     추가한다.
4. `elementLoader`:
   - page-level `db.elements.getByPage` load/cache path를 제거하거나 canonical document
     derived view로 대체한다.

### 검증

```bash
pnpm -F @composition/builder exec vitest run src/dashboard/__tests__/createInitialProjectDocument.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts
pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts
rg -n "db\\.elements\\.(getByPage|insertMany)" apps/builder/src/builder/stores/elementLoader.ts
```

마지막 `rg`는 Phase 1 종료 시 0건이어야 한다. `elementLoader` 전용 test가 필요해지면
Phase 1에서 `elementLoader.static.test.ts` 또는 canonical-derived loader test를 추가한다.

## Phase 2: Runtime Element Mutation Write Cutover

### 작업

1. `elementCreation.ts`
   - `mergeCreatedElementsIntoCanonicalDocument()`와 `db.documents.put()`를 primary로
     유지한다.
   - `db.elements.insert/insertMany` mirror write를 제거한다.
2. `elementUpdate.ts`
   - props/structural update가 active document를 먼저 갱신하고 `documents.put()`을
     수행한다.
   - `persistLegacyElementPropsMirrors()`와 `persistLegacyElementUpdateMirrors()`의
     local mirror write를 제거한다.
3. `elementRemoval.ts`
   - document removal + `documents.put()` primary 유지.
   - `db.elements.deleteMany`/reinsert mirror repair 제거.
4. `historyActions.ts`
   - undo/redo가 `db.elements.put/delete/insertMany`를 직접 호출하지 않게 한다.
   - history entry가 필요하면 canonical document snapshot 또는 canonical mutation
     payload를 저장한다.
5. inspector/editor paths:
   - `inspectorActions.ts`, `TagEditor`, `ListBoxItemEditor`, `TreeItemEditor`,
     `tabsItemActions`, collection/selection renderers의 `db.elements.*` write를
     document mutation boundary로 이동한다.
6. `useDragBridge.ts`
   - final drop/reparent persist에서 `db.elements.updateMany(updates)`를 제거한다.
   - canonical splice + `documents.put()`만 local persistence로 남긴다.

### 검증

```bash
pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/stores/utils/__tests__/elementUpdateOriginImpact.test.ts src/builder/stores/utils/__tests__/elementRemoval.test.ts
pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/hooks/useDragBridge.test.ts src/builder/workspace/canvas/hooks/useDragBridge.static.test.ts
rg -n "db\\.elements\\.(put|delete|insertMany|deleteMany)" apps/builder/src/builder/stores/history/historyActions.ts
```

마지막 `rg`는 Phase 2 종료 시 0건이어야 한다. `historyActions` 전용 test는 현재 없으므로
Phase 2에서 static grep gate 또는 canonical history mutation test를 추가한다.

## Phase 3: Page/Frame Binding + Reusable Frame Mirror Cleanup

### 작업

1. `frameActions.ts`
   - reusable frame create/update/delete가 `db.layouts.*`를 project state source로
     사용하지 않게 한다.
   - frame metadata는 canonical root reusable frame node에서 파생한다.
2. `pageFrameBinding.ts`
   - `persistPageFrameBindingMirror()`의 `db.pages.getById/update/insert` path를 제거한다.
   - page frame binding은 canonical page/ref node metadata 또는 established frame mirror
     adapter boundary에서만 처리한다.
3. `frameElementLoader.ts`
   - `db.elements.getDescendants/getAll` fallback을 제거한다.
   - active document에서 frame body/slot descendants를 resolve한다.
4. `frameLayoutCascade.ts`
   - `db.pages.getAll`, `db.pages.update`, `db.elements.deleteMany`, `db.elements.getAll`,
     `db.elements.insertMany` call을 canonical document mutation + projection boundary로
     교체한다.
5. Frames tab/layout selector tests는 `layouts` row가 없는 상태를 fixture로 고정한다.

### 검증

```bash
pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/adapters/canonical/__tests__/frameElementLoader.test.ts
pnpm -F @composition/builder exec vitest run src/builder/stores/utils/__tests__/frameActions.test.ts src/builder/stores/canonical/__tests__/canonicalFrameStore.test.ts
```

## Phase 4: Project Sync / Supabase Boundary

### 작업

1. 현재 cloud schema capability를 확인한다.
   - `documents` payload table/API가 있으면 `CompositionDocument`를 cloud primary로
     업로드/다운로드한다.
   - 없으면 `pagesApi`/`elementsApi` payload는 cloud transport format으로만 취급한다.
     upload는 canonical document에서 call-time export하고, download는 legacy rows를
     one-shot으로 `CompositionDocument`로 변환한다.
2. `syncProjectToCloud(projectId)`:
   - local source를 `db.documents.get(projectId)`로 전환한다.
   - `db.pages.getByProject`, `db.elements.getByPage`를 제거한다.
   - compatibility upload가 필요하면 `deriveProjectRenderModelFromDocument()` 또는
     `exportLegacyDocument()` 계열 boundary에서 pages/elements payload를 만든다.
3. `downloadProjectFromCloud(projectId)`:
   - cloud document가 있으면 `db.documents.put(projectId, doc)`만 수행한다.
   - cloud가 legacy rows만 제공하면 `cloudLegacyRowsToCompositionDocument()` 같은 좁은
     helper 또는 `legacyToCanonical({ pages, elements, layouts: [] }, deps)` wrapper로
     one-shot 변환한 뒤 `db.documents.put(projectId, doc)`만 수행한다.
   - 변환 실패 또는 canonical contract 위반 payload는 explicit error로 중단한다. local
     `db.pages.insert`, `db.elements.insertMany`, `db.layouts.*` fallback은 금지한다.
4. `deleteProject(projectId, location)`:
   - local delete는 `db.documents.delete(projectId)` 중심으로 전환한다.
   - cloud delete는 Supabase physical schema가 남아 있는 동안 기존 API boundary를 유지할 수
     있다.
5. `PagesApiService`/`legacyElementsApiService`는 runtime primary가 아니라 cloud
   compatibility service임을 명시하거나, document API가 생기면 제거한다.

### 검증

```bash
pnpm -F @composition/builder exec vitest run src/utils/projectSync.layoutId.static.test.ts
rg -n "db\\.(pages|elements|layouts)" apps/builder/src/utils/projectSync.ts
rg -n "pagesApi|elementsApi" apps/builder/src/utils/projectSync.ts
```

`projectSync`의 document-primary contract test는 현재 없으므로 Phase 4에서
`projectSync.documentBoundary.static.test.ts` 같은 신규 static test를 추가한다. 위 `rg`
명령은 Phase 4 종료 시 `projectSync.ts` 내부 local source/sink `db.pages/elements/layouts`
0건을 보여야 한다. `pagesApi`/`elementsApi`가 남는 경우에도 입력은
`CompositionDocument`에서 파생된 compatibility payload여야 하며 local mirror store를
재생성하면 안 된다. 같은 static test는 `downloadProjectFromCloud`가 legacy-only cloud
rows를 local mirror store에 쓰지 않고 `db.documents.put(projectId, doc)`만 호출하는지
고정한다.

## Phase 5: IndexedDB / DatabaseAdapter Surface Removal

### 작업

1. `apps/builder/src/lib/db/types.ts`
   - `DatabaseAdapter.pages`, `DatabaseAdapter.elements`, `DatabaseAdapter.layouts` 제거.
   - boundary가 필요한 경우 별도 `LegacyProjectionAdapter` 같은 좁은 타입으로 분리한다.
2. `apps/builder/src/lib/db/indexedDB/adapter.ts`
   - `pages`, `elements`, `layouts` objectStore create path 제거.
   - `DB_VERSION` bump.
   - 기존 DB upgrade에서 `deleteObjectStore("pages")`,
     `deleteObjectStore("elements")`, `deleteObjectStore("layouts")` 수행.
   - 삭제 전 안정화가 필요하면 read/write methods가 throw하는 guard를 임시 phase로 둘 수
     있지만, guard-only 상태는 ADR-120 완료가 아니다.
3. cache stats/debug UI에서 page/element/layout cache entry를 제거한다.
4. tests/mocks:
   - DB mock shape에서 `pages/elements/layouts` 제거.
   - remaining tests는 canonical document fixture를 사용한다.

### 검증

```bash
pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts
pnpm -F @composition/builder exec vitest run src/builder/stores/canonical
rg -n "pages:\\s*\\{|elements:\\s*\\{|layouts:\\s*\\{" apps/builder/src/lib/db/types.ts
rg -n "createObjectStore\\(\"(pages|elements|layouts)\"|objectStore\\(\"(pages|elements|layouts)\"" apps/builder/src/lib/db/indexedDB/adapter.ts
pnpm run codex:typecheck
```

위 `rg`는 Phase 5 종료 시 0건이어야 한다. `deleteObjectStore("pages"|"elements"|"layouts")`
upgrade cleanup만 필요하면 별도 static test에서 deletion-only allowlist로 고정한다.

## Phase 6: Verification + Docs/Rules

### Targeted Tests

Phase별 테스트 외에 다음 smoke set을 실행한다.

```bash
pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts src/utils/__tests__/compositionDocumentOrder.test.ts
pnpm -F @composition/builder exec vitest run src/builder/stores/canonical src/adapters/canonical
pnpm run codex:typecheck
pnpm run codex:preflight
```

### Browser/Runtime Smoke

1. 새 프로젝트 생성 후 refresh.
2. page 3개 생성, PageTree reorder, refresh.
3. reusable origin + instance를 같은 page와 다른 page에 배치하고 origin 삭제/instance
   detach/materialize 상태 확인.
4. origin page 삭제 후 다른 page instance가 영역만 남거나 layer tree에 stale `ref`로 남지
   않는지 확인.
5. page-frame binding apply/remove 후 refresh.
6. Skia canvas drag/drop 후 sibling order와 layout position refresh 유지 확인.
7. IndexedDB 검사:
   - `documents` store에 active project document 존재.
   - `pages`/`elements`/`layouts` objectStore가 존재하지 않음.

### Docs/Rules

1. ADR body status/implementation log 갱신.
2. `docs/adr/README.md` row/status/count 갱신.
3. `docs/CHANGELOG.md`에 implementation 섹션 추가.
4. `.agents/skills/composition-patterns/rules/domain-canonical-format-order.md` 또는 관련
   rule에 legacy mirror persistence 금지/allowlist를 갱신한다.
5. grep gate allowlist를 문서와 테스트가 같은 bucket명으로 공유한다.
