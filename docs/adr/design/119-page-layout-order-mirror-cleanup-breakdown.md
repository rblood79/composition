# ADR-119 Breakdown: Page/Layout order mirror 제거 및 canonical source-order 통합

## Implementation Status

Implemented — 2026-05-08.

Phase 0 inventory: [119-page-layout-order-inventory.md](119-page-layout-order-inventory.md)

## Scope

이 문서는 `pages.order_num`, `layouts.order_num`, canonical page/layout
`metadata.order_num`을 runtime order source에서 제거하고, page/layout order를
`CompositionDocument.children[]` source order로 수렴시키는 실행 계획이다.

ADR-118은 Element sibling order를 이미 canonical `children[]` index로 정리했다.
ADR-119는 그 후속으로 page/layout compatibility mirror를 제거한다.

## Scope Matrix

| Surface                               | 포함 여부 | 최종 order source                                       | 비고                                 |
| ------------------------------------- | --------- | ------------------------------------------------------- | ------------------------------------ |
| PageTree page row order               | In        | document root page-like node source order               | Home identity는 slug `/`             |
| Nested PageTree sibling order         | In        | parent_id sibling subsequence of root page source order | sibling-local order field 금지       |
| Preview/Publish page route order      | In        | derived render model page source order                  | `RuntimePage.order_num` 제거 후보    |
| page create/reorder/delete            | In        | canonical root `children[]` append/splice               | row mirror order write 금지          |
| project bootstrap / initial seed      | In        | canonical root `children[]` source order                | dashboard local/cloud 생성 경로 포함 |
| reusable frame/layout catalog order   | In        | document root reusable frame source order               | Frames tree/layout selector 공유     |
| layout create/reorder/delete          | In        | canonical root reusable frame append/splice             | `layouts.order_num` 제거 후보        |
| page/layout canonical metadata        | In        | no order metadata                                       | slug/identity/layout binding만 보존  |
| IndexedDB `pages.order_num` index     | In        | remove                                                  | DB_VERSION bump 필요                 |
| IndexedDB `layouts.order_num` index   | In        | remove                                                  | DB_VERSION bump 필요                 |
| Supabase `pages.order_num` column     | Boundary  | derived compatibility only, physical removal separate   | 별도 migration 승인 필요             |
| Table/collection component data order | Out       | existing component data model                           | ADR-119 범위 아님                    |
| Element sibling order                 | Out       | already ADR-118 / Element cleanup                       | Phase 0에서 residual hit 제거 확인   |

## Current Baseline

현재 repo에서 page/layout order mirror가 남은 주요 위치:

- `apps/builder/src/services/api/PagesApiService.ts`: Supabase pages query가
  `order_num` 정렬을 사용한다.
- `apps/builder/src/lib/db/indexedDB/adapter.ts`: `pages`와 `layouts` objectStore에
  `order_num` index가 있다.
- `apps/builder/src/builder/panels/nodes/tree/PageTree/usePageTreeData.ts`:
  PageTree update/persistence/canonical metadata sync가 `order_num`을 쓴다.
- `apps/builder/src/builder/hooks/usePageManager.ts`: page 생성 시 다음
  `order_num`을 계산한다.
- `apps/builder/src/builder/hooks/usePageManager.ts`: page 생성 body `Element` payload에
  `order_num: 0` residual이 남아 있다. 이는 ADR-119 구현 전 닫아야 할 ADR-118 follow-up
  blocker다.
- `apps/builder/src/dashboard/createInitialProjectDocument.ts`,
  `apps/builder/src/dashboard/index.tsx`: project bootstrap/initial document seed와
  local/cloud page create payload가 `pages.order_num` 및 page metadata `order_num`을
  생성한다.
- `apps/builder/src/builder/components/dialog/AddPageDialog.tsx`,
  `apps/builder/src/builder/panels/properties/editors/PageParentSelector.tsx`: URL/layout
  binding helper payload가 `page.order_num`을 전달하고, `AddPageDialog` temp page payload가
  `order_num: 0`을 생성한다.
- `apps/builder/src/builder/stores/canonical/canonicalFrameStore.ts`:
  reusable frame layout projection이 layout metadata `order_num`을 읽고 쓴다.
- `apps/builder/src/builder/stores/utils/frameActions.ts`: frame/layout 생성 시
  `order_num`을 부여한다.
- `apps/builder/src/adapters/canonical/*`: page/layout shell metadata에
  `order_num`을 보존한다.
- `apps/builder/src/builder/hooks/useIframeMessenger.ts`,
  `apps/builder/src/preview/router/CanvasRouter.tsx`,
  `apps/builder/src/preview/store/types.ts`: Preview page payload에 `order_num`이 있다.
- `apps/builder/src/utils/projectSync.ts`: local/cloud page round-trip에 `order_num`을
  포함한다.

## Phase 0: Inventory + Bucket Classification

### 작업

1. page/layout `order_num` hit를 전수 분류한다.
2. bucket:
   - `runtime-read`: PageTree/Frames/Preview/hydrate/layout invalidation.
   - `runtime-write`: create/reorder/delete/write-through.
   - `adapter-boundary`: Supabase/project sync/export/import compatibility.
   - `schema`: IndexedDB index/type, Supabase type.
   - `test-fixture`: legacy fixture, static guard.
3. `metadata.order_num` consumer를 page/layout/Element/Table로 분리한다.
4. page 생성 body payload 등 `Element.order_num` residual hit를 ADR-118 follow-up blocker로
   분리하고, Phase 1 착수 전 제거 또는 별도 이슈로 명시한다.
5. dashboard bootstrap, `createInitialProjectDocument`, local/cloud project creation seed를
   `runtime-write`와 `adapter-boundary` bucket에 포함한다.
6. `AddPageDialog` / `PageParentSelector` helper payload를 `runtime-read` 또는
   `adapter-boundary` bucket으로 분리하고, temp payload의 `order_num: 0`은 삭제 후보로
   표시한다.
7. nested PageTree의 parent별 sibling order가 root page source order의 stable subsequence로
   projection되는지 확인한다.
8. Phase 6 allowlist를 먼저 만든다.

### 확인 명령

```bash
rg -n "order_num|orderNum" apps/builder/src packages/shared/src packages/specs/src -g '!**/*.test.*' -g '!**/__tests__/**'
rg -n "metadata.*order_num|order_num.*metadata" apps/builder/src packages/shared/src
rg -n "order_num: 0" apps/builder/src/dashboard apps/builder/src/builder/hooks/usePageManager.ts
rg -n "order_num" apps/builder/src/builder/components/dialog/AddPageDialog.tsx apps/builder/src/builder/panels/properties/editors/PageParentSelector.tsx
rg -n "pagesStore.createIndex\\(\"order_num\"|layoutsStore.createIndex\\(\"order_num\"" apps/builder/src/lib/db/indexedDB/adapter.ts
```

### 산출물

- `docs/adr/design/119-page-layout-order-inventory.md`
- bucket별 allowed/deleted list
- Phase별 test target list

## Phase 1: Page Order Read Cutover

### 작업

1. page-like node selector를 정의한다.
   - input: `CompositionDocument`
   - output: source-ordered `Page[]` 또는 lightweight page refs
   - nested tree: `parent_id`는 grouping만 담당하고, 각 parent의 sibling order는 root
     page-like source order에서 해당 parent page만 필터링한 stable subsequence다.
   - reusable frame catalog node는 제외한다.
2. `deriveProjectRenderModelFromDocument`가 page order를 stored page metadata나
   row mirror가 아니라 document child order에서만 파생하는지 고정한다.
3. PageTree projection에서 `page.order_num`을 display/order source로 쓰지 않는다.
4. `AddPageDialog` / `PageParentSelector`의 URL/layout binding helper가 page ordering을
   위해 `page.order_num`을 전달하지 않도록 한다. 타입 호환성 때문에 field가 필요하면
   canonical source order에서 call-time derived boundary로만 둔다.
5. `RuntimePage.order_num` 제거 가능성을 평가한다. 즉시 제거가 어렵다면 derived
   compatibility field로 격리한다.
6. `PagesApiService.getPagesByProjectId()`의 `.order("order_num")` 의존을 끊는다.
   cloud pages row만 읽는 fallback은 created_at/slug identity로 제한하고, document가
   있으면 document order가 우선한다.

### 검증

```bash
pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts
pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts
```

## Phase 2: Layout/Reusable Frame Order Read Cutover

### 작업

1. reusable frame selector를 정의한다.
   - source: document root `children[]`
   - filter: `type: "frame"` + `reusable: true`
   - order: source order
2. `canonicalDocumentToReusableFrameLayouts()`가 metadata `order_num`을 읽지 않고
   source index만 derived field로 만들거나 field 자체를 제거한다.
3. Frames tree/layout selector/invalidation fingerprint에서 `layouts.order_num`을 제거한다.
4. `Layout` type의 `order_num` optional field 제거 범위를 확정한다.

### 검증

```bash
pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalFrameStore.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts
```

## Phase 3: Page/Layout Write Cutover

### 작업

1. page 생성:
   - canonical page node를 document root page slot에 append한다.
   - `pages.order_num`을 계산하지 않는다.
   - body `Element` 생성 payload에 `order_num`을 쓰지 않는다.
   - dashboard bootstrap, `createInitialProjectDocument`, local/cloud project creation seed도
     같은 규칙을 따른다.
   - `AddPageDialog` temp page payload의 `order_num: 0`도 제거하거나 derived compatibility
     boundary로 격리한다.
2. PageTree DnD:
   - update payload에서 `orderNum` 제거.
   - parentId + insertion index 또는 ordered id list로 canonical root page slot을 splice한다.
   - nested reorder는 target parent sibling subsequence를 root page-like source order에
     다시 merge한다.
   - DB `pages` row update는 parent/slug/title 등 metadata만 저장한다.
3. frame/layout 생성:
   - reusable frame node를 document root reusable frame slot에 append한다.
   - `layouts.order_num`을 계산하지 않는다.
4. frame reorder가 있다면 source ordered reusable frame ids를 canonical root children splice로
   저장한다.
5. delete path는 source order를 재번호화하지 않는다.

### 검증

```bash
pnpm -F @composition/builder exec vitest run src/builder/panels/nodes/tree/PageTree/usePageTreeDnd.test.ts src/builder/stores/__tests__/pageRemovalSemantics.test.ts
```

## Phase 4: Canonical Metadata Cleanup

### 작업

1. page shell metadata에서 `order_num` 제거:
   - `canonicalMutations.ts`
   - `pageFrameBinding.ts`
   - `adapters/canonical/index.ts`
   - `slotAndLayoutAdapter.ts`
   - `PageTree/usePageTreeData.ts`
   - `dashboard/createInitialProjectDocument.ts`
2. layout/reusable frame metadata에서 `order_num` 제거:
   - `canonicalFrameStore.ts`
   - `frameActions.ts`
   - `canonicalMutations.ts`
3. tests가 `metadata.order_num`을 assert하면 source order assertion으로 전환한다.
4. `.agents` rule에서 page/layout `order_num` 예외 문구를 제거하거나
   "adapter compatibility only"로 낮춘다.

### 금지

- `metadata.order_num`을 "documents 테이블 내부 order"라는 이름으로 primary화하지 않는다.
- metadata 제거 후 `children[]` order 보존을 위해 별도 `sortKey` metadata를 만들지 않는다.

## Phase 5: IndexedDB/API Schema Cleanup

### IndexedDB

1. `DB_VERSION` bump.
2. `pages` store `order_num` index 생성 제거.
3. `layouts` store `order_num` index 생성 제거.
4. upgrade path에서 기존 index가 있으면 `deleteIndex("order_num")`.
5. 기존 `pages`/`layouts`/`elements` row의 stale `order_num`/`orderNum` field와
   `documents` canonical node metadata의 stale `order_num`/`orderNum` field를
   DB v13 upgrade에서 제거한다.
6. `metaStore.test.ts`에 pages/layouts order index 제거 guard와 stale payload
   strip guard 추가.

### API / Supabase

1. Builder runtime type에서 `Page.order_num`, `Layout.order_num` 제거.
2. Supabase generated/manual type은 physical schema migration 전에는 optional
   compatibility field로 남길 수 있다.
3. `PagesApiService`는 `order_num` sort를 사용하지 않는다.
4. `projectSync`는 document export/import가 가능하면 document order를 우선하고,
   pages row payload에 order field를 보내야 하면 call-time derived index만 사용한다.
5. Supabase column drop은 별도 승인 없이는 이 phase에서 하지 않는다.

### 검증

```bash
pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts
pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalDocumentStore.test.ts
```

## Phase 6: Verification + Docs/Rules

### Targeted Tests

```bash
pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts src/utils/__tests__/compositionDocumentOrder.test.ts
pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts src/builder/panels/nodes/tree/PageTree/usePageTreeData.test.ts src/builder/panels/nodes/tree/PageTree/usePageTreeDnd.test.ts src/builder/stores/canonical/__tests__/canonicalFrameStore.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts
pnpm run codex:typecheck
pnpm run codex:preflight
```

### Browser/Runtime Smoke

1. 새 프로젝트 생성 후 page 3개 추가.
2. PageTree에서 root page reorder와 nested page sibling reorder 후 refresh.
3. Frames tree에서 reusable frame 생성/순서 확인 후 refresh.
4. Preview route가 canonical page source order와 slug identity를 유지하는지 확인.
5. IndexedDB inspection:
   - `documents` store document child order가 primary.
   - `pages`/`layouts` store에 `order_num` index 없음.
   - 기존 `pages`/`layouts`/`elements` row와 page/layout canonical metadata에
     stale `order_num`/`orderNum` payload 없음.
   - 신규 body Element payload에 `order_num` 없음.

### Docs/Rules

1. `.agents/skills/composition-patterns/rules/domain-canonical-format-order.md`
   page/layout 예외 제거.
2. `.agents/skills/composition-patterns/SKILL.md` 핵심 불변식 갱신.
3. `.agents/rules/state-management.md` page/layout order wording 갱신.
4. `docs/CHANGELOG.md`에 implementation 완료 시점에 기록.

## Rollback Strategy

- Phase 1/2 read cutover 실패: 해당 selector만 mirror fallback으로 되돌린다.
- Phase 3 write cutover 실패: DnD/create path별 canonical splice를 비활성화하고 기존
  mirror write를 임시 복구한다.
- Phase 5 DB index cleanup 실패: DB_VERSION bump를 revert하고 index 제거 path를 보류한다.
- Supabase schema migration은 이 ADR 기본 scope 밖이므로 rollback 대상에 포함하지 않는다.
