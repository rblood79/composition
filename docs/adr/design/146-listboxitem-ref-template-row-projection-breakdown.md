# ADR-146 Breakdown: ListBoxItem Ref Template and Row Projection

## 1. 목표

ListBox authoring 구조를 다음 4개 권위로 분리한다.

- `Components` system page: reusable origin 보관 및 편집 source.
- content page `ListBox`: Components page `ListBox` origin의 ref instance이며 locked `ListBoxItem` ref template anchor 보유.
- collection data: `dataBinding`/ADR-132 `collections.runtimeData` 또는 `ListBox.props.items`에서 단일 resolved collection items read model로 row data 제공.
- row projection: Layer Tree, selection, Skia visible row 렌더를 위한 render-only projection.

핵심 산출물:

- 프로젝트 생성 시 자동 생성되는 `Components` system page
- `ListBoxItem/Default` reusable origin과 optional selected variant
- content page `ListBox`의 locked `ListBoxItem` ref template anchor
- Layer Tree `Rows` projection group
- Skia `ListBoxItem` template/ref row renderer
- ADR-145 local template child에서 origin/ref anchor로 가는 migration

## 2. 비목표

- 전체 collection family 일반화. ComboBox/Select/GridList/Table/Tree는 후속 ADR에서 case-by-case로 다룬다.
- row마다 canonical child를 저장하는 materialization.
- `ListBoxItem` 내부 nested interactive child 지원.
- Component Panel에 `ListBoxItem`을 독립 placeable 컴포넌트로 노출.
- `Components` page를 Preview/Publish에서 runtime page로 노출.

## 3. 파일 경계

### 새로 만들 가능성이 높은 파일

| 파일                                                                                          | 책임                                                                                    |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/pages/systemComponentsPage.ts`                                      | `Components` system page 생성/보정 helper                                               |
| `apps/builder/src/builder/pages/__tests__/systemComponentsPage.test.ts`                       | 신규 프로젝트 bootstrap, delete guard, page order/name count 검증                       |
| `apps/builder/src/builder/components/listbox/listBoxTemplateOrigins.ts`                       | `ListBoxItem/Default`, selected variant, `ListBox` origin seed 생성                     |
| `apps/builder/src/builder/components/listbox/__tests__/listBoxTemplateOrigins.test.ts`        | origin/ref/slot allow-list fixture                                                      |
| `apps/builder/src/builder/components/slotHostPolicy.ts`                                       | slot host allow-list 정책 registry. `frame` 계열과 `ListBox` 정책을 단일 source로 제공  |
| `apps/builder/src/builder/components/__tests__/slotHostPolicy.test.ts`                        | `ListBox`는 `ListBoxItem` variants만 허용하고 nested interactive child를 막는 정책 검증 |
| `apps/builder/src/builder/projection/renderProjectionIds.ts`                                  | `::page-frame::`와 `projection:listbox-row:`를 함께 판정하는 render projection id guard |
| `apps/builder/src/builder/projection/__tests__/renderProjectionIds.test.ts`                   | projected id가 canonical/store mutation boundary에 들어가지 않는 negative fixture       |
| `apps/builder/src/builder/layers/listBoxRowProjection.ts`                                     | Layer Tree row projection 모델과 projection id 생성                                     |
| `apps/builder/src/builder/layers/__tests__/listBoxRowProjection.test.ts`                      | static/data-bound rows, stable id, mutation routing, 10k row windowing 검증             |
| `apps/builder/src/builder/workspace/canvas/skia/listBoxRowTemplateRenderer.ts`                | Skia visible row -> `ListBoxItem` template/ref renderer bridge                          |
| `apps/builder/src/builder/workspace/canvas/skia/__tests__/listBoxRowTemplateRenderer.test.ts` | parent composite paint 제거, viewport/row renderer parity 검증                          |

### 수정할 가능성이 높은 파일

| 파일                                                                          | 변경                                                                                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `apps/builder/src/builder/hooks/usePageManager.ts` 또는 page bootstrap 경로   | 프로젝트 생성/초기화 시 `Components` system page 보장. Builder page list는 editor page derivation을 사용해 `Components`를 포함 |
| `apps/builder/src/builder/panels/nodes/PagesSection.tsx`                      | `Components`, `Home`, user pages 순서. `handlePageDelete`/duplicate/page-n count system guard                                  |
| `apps/builder/src/builder/panels/nodes/tree/PageTree/types.ts`                | `PageTreeNode.isSystemPage` 또는 동등 editor-only mirror 추가                                                                  |
| `apps/builder/src/builder/panels/nodes/tree/PageTree/usePageTreeData.ts`      | `Components` order와 system page flag projection                                                                               |
| `apps/builder/src/builder/panels/nodes/tree/PageTree/PageTreeItemContent.tsx` | system page delete/drag affordance 숨김                                                                                        |
| `apps/builder/src/builder/panels/nodes/tree/PageTree/validation.ts`           | system page drag/drop/reorder guard                                                                                            |
| `apps/builder/src/builder/panels/layers/**`                                   | canonical children + row projection group 병합 표시                                                                            |
| `packages/shared/src/utils/export.utils.ts`                                   | editor page derivation과 runtime render model derivation 분리. runtime/export 기본은 `Components` page 제외                    |
| `apps/builder/src/preview/App.tsx`                                            | canonical page filter가 `metadata.pageRole === "components"`를 제외                                                            |
| `apps/publish/src/App.tsx`                                                    | shared render model exclusion을 소비하고 publish page list 누수 회귀 fixture 추가                                              |
| `apps/builder/src/builder/panels/properties/FrameSlotSection.tsx`             | local `SLOT_HOST_TYPES`를 shared slot host policy 소비로 전환. `ListBox` policy 표시                                           |
| `apps/builder/src/builder/panels/properties/ComponentSlotFillSection.tsx`     | slot fill 후보를 shared slot host policy로 제한                                                                                |
| `apps/builder/src/builder/factories/SelectionComponents.ts`                   | ListBox factory가 local child가 아니라 origin/ref template anchor를 사용                                                       |
| `apps/builder/src/adapters/canonical/legacyListBoxTemplateMigration.ts`       | ADR-145 local template child를 Components page origin/ref로 migration                                                          |
| `apps/builder/src/adapters/canonical/canonicalMutations.ts`                   | projected row id가 canonical move target이 되는 경로 차단                                                                      |
| `apps/builder/src/builder/stores/utils/elementUpdate.ts`                      | `projection:listbox-row:` update 요청을 silent return이 아니라 guarded no-op/dev failure로 차단                                |
| `apps/builder/src/builder/stores/utils/elementRemoval.ts`                     | `projection:listbox-row:` remove 요청을 silent return이 아니라 guarded no-op/dev failure로 차단                                |
| `apps/builder/src/resolvers/canonical/**`                                     | `ListBoxItem` ref template anchor resolution fixture 보강                                                                      |
| `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`         | `ListBox` parent row composite paint 제거/compatibility 격리                                                                   |
| `packages/specs/src/components/ListBox.spec.ts`                               | row parent paint payload 의존 제거 또는 legacy fallback 표시                                                                   |
| `packages/shared/src/renderers/SelectionRenderers.tsx`                        | `renderListBox` Preview RAC dynamic collection과 Builder template metadata 정합                                                |
| `packages/shared/src/components/ListBox.tsx`                                  | RAC `ListBox`/`ListBoxItem` component path의 collection/template parity 확인                                                   |
| `apps/builder/src/builder/panels/properties/**`                               | row projection 선택 시 Inspector read path 정의                                                                                |
| `docs/CHANGELOG.md`                                                           | Implemented 승격 시 사용자 가시 변경 기록                                                                                      |

### 참조 fixture

| 파일                                        | 사용                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `docs/migrations/shadcn-tabs.json`          | reusable origin/ref/descendants/slot + instance children override 패턴 |
| `docs/migrations/shadcn-cards.json`         | slot frame origin과 descendants replacement 패턴                       |
| `docs/migrations/shadcn-design-system.json` | Table Row/Table/Dropdown slot allow-list 패턴                          |

## 4. 데이터 모델

### Page metadata

결정: persisted source는 canonical page node `metadata`다. legacy `Page` interface는 `id/title/project_id/slug/parent_id` 중심의 runtime/export mirror이므로 persisted system metadata를 추가하지 않는다.

```ts
interface ComponentsPageMetadata {
  type: "legacy-page";
  pageId: string;
  slug: "/__components";
  pageRole: "components";
  systemOwned?: boolean;
  previewExcluded?: boolean;
  publishExcluded?: boolean;
  excludeFromAutoNameCount?: boolean;
}
```

정책:

- `props`는 runtime component props source이므로 사용하지 않는다.
- `x-composition.editor`는 selection/runtime editor state 용도이므로 page identity/source exclusion에는 사용하지 않는다.
- `Page` mirror에 transient helper field를 둘 수는 있지만 저장/수출 SSOT가 아니다.
- canonical document는 JSON store이므로 IndexedDB `DB_VERSION` 증가는 요구하지 않는다. 단 fixture는 `documents` store round-trip과 export exclusion을 함께 검증한다.
- page 판정은 audience를 분리한다. `isEditorPageNode()`는 `metadata.type === "page" | "legacy-page"` page를 포함하고 `Components` system page도 Builder page list에 남긴다. `isRuntimePageNode()`는 같은 page 판정 뒤 `metadata.pageRole !== "components"`를 추가 확인한다.
- Builder `usePageManager.initializeProject()`의 `apiPages`/`storePages` hydrate는 `deriveProjectEditorPageModelFromDocument()` 또는 `deriveProjectRenderModelFromDocument({ audience: "editor" })`를 사용한다.
- export/runtime, Preview canonical page filter, Publish shared render model은 `deriveProjectRenderModelFromDocument()` runtime 기본값 또는 `{ audience: "runtime" }`을 사용해 `Components` page를 제외한다. 단일 helper를 쓰더라도 call site audience가 명시되어야 한다.
- page 자동 번호는 `pages.filter(!isComponentsPageMirror).length + 1` 또는 동등 helper로 계산한다.

### Template anchor metadata

```ts
interface ListBoxTemplateAnchorMetadata {
  role: "listbox-item-template-anchor";
  originRef: string;
  locked: true;
  deleteDisabled: true;
  rowProjectionSource: "dataBinding" | "items" | "static-children";
}
```

anchor는 content page `ListBox` 아래 canonical/ref node로 존재한다. 이 anchor는 row 1개가 아니라 projection renderer의 template input이다.

### Mode detection and row data source

첫 implementation slice의 mode detection은 다음 순서로 고정한다.

1. `dataBinding` 또는 ADR-132 `collections.runtimeData` binding이 있으면 data-bound mode다. row data는 `useCollectionData`가 resolve한 runtime collection items를 사용한다.
2. binding이 없고 non-empty `ListBox.props.items`가 있으면 data-bound mode다. row data는 stored `props.items`를 사용한다.
3. binding과 `props.items`가 모두 없고 실제 `ListBoxItem` ref children이 있으면 static authoring mode다. 이 경우 row마다 실제 canonical ref child를 유지하고 `Rows` projection group을 만들지 않는다.
4. `dataBinding`과 `props.items`가 동시에 있으면 `dataBinding`/`collections.runtimeData`가 우선이고 `props.items`는 loading/error/offline fallback 또는 initial seed로만 사용한다.
5. row count threshold는 mode를 바꾸지 않는다. large collection 여부는 mode가 아니라 projection windowing만 바꾼다.

### Row projection id

```ts
type ListBoxRowProjectionId = `projection:listbox-row:${string}:${string}`;
// projection:listbox-row:<listboxNodeId>:<itemKey>
```

shared guard:

```ts
type RenderProjectionId =
  | `projection:listbox-row:${string}:${string}`
  | `${string}::page-frame::${string}`;

function isRenderProjectionId(id: string | null | undefined): boolean {
  return (
    typeof id === "string" &&
    (id.startsWith("projection:listbox-row:") || id.includes("::page-frame::"))
  );
}
```

규칙:

- canonical node id와 prefix가 겹치지 않는다.
- selection/hover/hit-test에서 projection id는 canonical mutation target으로 직접 쓰지 않는다.
- Inspector write가 필요한 경우 data binding route 또는 template origin route로 명시적으로 변환한다.
- projected id가 `removeElement`/`updateElement`/`moveElementToCanonicalTarget`류 mutation API에 직접 들어가면 Gate G3 실패다.
- 현재 `canonicalMutations.ts`의 page-frame 전용 guard는 이 shared guard로 대체한다.
- `updateElement`/`removeElement`는 미존재 id silent return만으로 projected id 유입을 덮지 않는다. projected id면 dev/static fixture가 감지 가능한 guard path를 탄다.

## 5. Layer Tree 계약

Layer Tree는 `ListBox`를 다음처럼 표시한다.

```text
ListBox
├─ ListBoxItem             // reusable ref instance, template anchor, delete disabled
└─ Rows                    // projection group, canonical child 아님
   ├─ Aardvark             // projection row
   ├─ Cat
   └─ Kangaroo
```

정책:

- `Rows` group은 expanded 상태일 때만 projection rows를 materialize한다.
- large collection에서는 전체 row를 모두 만들지 않고 visible/limited window를 표시한다. acceptance fixture는 10k row 입력에서 generated LayerTree row projection node 수가 window limit 이하임을 검증한다.
- row label은 collection item의 primary text field에서 온다. label field가 없으면 item key를 fallback으로 사용한다.
- drag/drop reorder는 static mode에서만 허용한다. data-bound mode에서는 collection reorder action으로 route하거나 비활성화한다.
- delete는 row projection에 직접 적용하지 않는다. data-bound mode에서는 data source mutation command가 있을 때만 별도 UI로 route한다.

## 6. Skia 렌더링 계약

### 폐기할 경로

`ListBox` parent가 다음을 직접 수행하는 경로는 active path에서 제거한다.

1. `props.items` 전수 순회
2. `_listBoxItemTemplateStyle`만 추출
3. parent `render.shapes`에서 row background/text/indicator를 직접 그림

이 경로는 migration/legacy fixture 비교용 compatibility fallback으로만 남길 수 있다.

G4 이후 production active path에는 남기지 않는다. 비교용 코드가 필요하면 test 또는 migration fixture allowlist에만 둔다.

### 신규 경로

```text
ListBox canonical/ref node
├─ template anchor resolve
├─ collection visible rows compute
└─ for each visible row:
   ├─ resolve ListBoxItem template/ref
   ├─ bind row data to template slots/text/description
   ├─ compute row layout bounds
   └─ render through ListBoxItem renderer
```

row renderer input:

```ts
interface ListBoxProjectedRowRenderInput {
  listBoxId: string;
  projectionId: string;
  itemKey: string;
  item: unknown;
  rowIndex: number;
  rowBounds: { x: number; y: number; width: number; height: number };
  state: {
    selected: boolean;
    focused: boolean;
    disabled: boolean;
    hovered: boolean;
  };
  templateAnchorId: string;
  templateOriginId: string;
}
```

## 7. Preview/Publish 계약

Preview/Publish는 runtime page list에서 `Components` page를 제외한다.

DOM rendering은 RAC dynamic collection 패턴을 유지한다.

```tsx
<ListBox items={items}>
  {(item) => <ListBoxItem>{/* template-bound content */}</ListBoxItem>}
</ListBox>
```

Composition의 canonical source에서는 render function을 저장하지 않는다. 대신 `ListBoxItem` template anchor와 template origin/ref가 render function 역할을 한다. Preview renderer는 template origin/ref와 row data를 결합해 RAC `ListBoxItem` children을 만든다.

## 8. Migration

### 입력

ADR-145 이후 프로젝트:

```text
Page A
└─ ListBox
   └─ ListBoxItem      // local template child
```

### 출력

```text
Components
├─ ListBoxItem/Default // reusable origin, local template child style/content 승격
└─ ListBox             // reusable origin, slot allow-list 포함

Page A
└─ ListBox ref      // locked host instance, originRef=ListBox
   └─ ListBoxItem ref  // locked template anchor, originRef=ListBoxItem/Default
```

규칙:

- 기존 local template child의 style/content/descendants는 `ListBoxItem/Default` origin으로 승격한다.
- page별 override가 있으면 content page의 template anchor `descendants` override로 보존한다.
- 이미 `Components` page가 있으면 system origins를 de-duplicate한다.
- migration은 idempotent해야 한다.
- Components system page bootstrap과 `ListBoxItem/Default` origin 보정은 ListBox migration보다 먼저 실행한다. bootstrap이 실패하면 ListBox migration은 진행하지 않는다.
- 여러 ListBox가 legacy local template child를 동시에 갖는 경우 canonical document order에서 처음 만난 template을 `ListBoxItem/Default` origin 승격 기준으로 삼는다. 이후 template의 구조/style 차이는 각 content page template anchor의 `descendants` override로 보존하고 새 system origin을 증식하지 않는다.

## 9. Phase Plan

### Phase 0 - Inventory and fixture freeze

- ADR-145 ListBox factory/hydration/Skia row paint surface inventory.
- shadcn fixture evidence 문서화.
- current page creation/page list/Preview export path inventory.
- G0 통과.

### Phase 1 - Components system page

- 신규 프로젝트 bootstrap에 `Components` page 생성.
- Page list ordering: `Components`, `Home`, user pages.
- 일반 page와 동일 선택, Skia, Layers Tree render path 적용.
- `usePageManager.initializeProject()`의 `apiPages`/`storePages` 초기화는 editor page derivation을 사용해 `Components` page를 Builder page list에 유지한다.
- `packages/shared/src/utils/export.utils.ts`는 editor page derivation과 runtime render model derivation을 분리한다. runtime/export path는 `Components` page를 pages/elements에서 제외한다.
- `apps/builder/src/preview/App.tsx` canonical page filter에서 runtime helper로 제외한다.
- `apps/publish/src/App.tsx` publish project data에서 runtime helper/render model exclusion을 소비한다.
- page 자동 번호 계산에서 system page를 제외한다.
- `PagesSection.handlePageDelete`, `PageTreeNode.isSystemPage`, `PageTreeItemContent`, `PageTree.validation`에서 delete/rename/duplicate/drag/page-n count policy 고정.
- `Components` page duplicate 금지. content page duplicate는 system origins를 복제하지 않고 ref anchor만 새 id로 재생성.
- G1 통과.

### Phase 2 - ListBox origins and template anchor

- `ListBoxItem/Default` origin seed 생성.
- optional selected variant seed 구조 정의.
- `ListBox` origin slot allow-list 설정.
- mode detection fixture 추가: `dataBinding` 또는 non-empty `props.items`는 data-bound mode, ref children only는 static authoring mode, `dataBinding + props.items` 혼합은 dataBinding 우선 + props fallback/seed.
- shared slot host policy registry 도입. `FrameSlotSection` / slot fill UI / insert guard / resolver warning path가 같은 `ListBox` allow-list를 소비.
- content page `ListBox` factory가 `ListBox` origin ref instance와 locked `ListBoxItem` ref template anchor 생성.
- existing ADR-145 local template migration helper 보강.
- G2 통과.

### Phase 3 - Layer Tree row projection

- `Rows` projection group 모델 도입.
- static mode와 data-bound mode 표시 분기.
- projection id namespace, selection/hover, Inspector read route 정의.
- shared render projection id guard 도입.
- `canonicalMutations` / `elementUpdate` / `elementRemoval` / drag-drop mutation route negative fixture 추가.
- 10k rows data-bound fixture에서 Layer Tree projection window만 생성.
- G3 통과.

### Phase 4 - Skia row template renderer

- parent composite row paint active path 제거.
- visible row projection이 `ListBoxItem` template/ref renderer를 통과하게 변경.
- viewport/virtualization input과 row bounds 계산 연결.
- DOM Preview RAC dynamic collection parity fixture는 `packages/shared/src/renderers/SelectionRenderers.tsx`의 `renderListBox`와 `packages/shared/src/components/ListBox.tsx` RAC component path를 기준으로 추가.
- G4 통과.

### Phase 5 - Migration and compatibility

- existing projects hydration migration.
- Components bootstrap 선행 후 ListBox migration 실행.
- 다중 ListBox legacy template migration fixture: 첫 template origin 승격, 이후 차이는 anchor `descendants` override로 보존, system origin 중복 0.
- reusable master round-trip.
- import/export compatibility.
- refresh hydration no-dup/no-loss fixture.
- G5 통과.

### Phase 6 - Verification and closure

- targeted Vitest.
- ListBox cross-check.
- `pnpm run codex:typecheck`.
- Browser sanity: 10k data-bound ListBox fixture에서 Layer Tree projection rows ≤ 200, expand/select/hover interaction console/page error 0, rAF target 60fps 또는 local baseline 대비 >10% regression 없음.
- README/CHANGELOG/ADR status sync.
- G6 통과 후 Implemented 승격.

## 10. Acceptance Fixtures

| Fixture | 내용                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1      | 신규 프로젝트 생성 시 `Components` page가 Builder page list/PageTree에서 `Home` 앞에 있고, runtime render model/export/Preview/Publish page list에는 없다.      |
| F2      | `Components` page 선택 시 Skia canvas와 Layers Tree가 origin 구조를 표시한다.                                                                                   |
| F3      | Page A `ListBox` Layer Tree가 template anchor와 `Rows` projection group을 표시한다.                                                                             |
| F4      | data-bound 3 rows가 projection id를 안정적으로 유지하고 selection overlay가 row bounds에 맞는다.                                                                |
| F5      | row projection delete/update/move는 canonical child mutation으로 실행되지 않고 projection guard에서 차단된다.                                                   |
| F6      | Skia active path에서 `ListBox` parent가 row text/background를 직접 paint하지 않는다.                                                                            |
| F7      | Preview DOM path는 RAC `items` collection semantics를 유지한다.                                                                                                 |
| F8      | ADR-145 local template child 프로젝트가 origin/ref anchor 구조로 idempotent migration된다.                                                                      |
| F9      | 10k data-bound rows에서도 Layer Tree는 projection window만 생성하고 전체 row node를 materialize하지 않는다.                                                     |
| F10     | `Components` system page는 PageTree delete button/drag-drop/reorder/duplicate/`handlePageDelete` 경로에서 불변으로 차단된다.                                    |
| F11     | mode detection은 `dataBinding`/non-empty `props.items`를 data-bound mode로, ref children only를 static authoring mode로 안정 분기한다.                          |
| F12     | `dataBinding + props.items` 혼합에서는 `dataBinding`/`collections.runtimeData`가 row source로 우선하고 `props.items`는 fallback/seed로만 남는다.                |
| F13     | 다중 legacy ListBox migration은 document order 첫 template만 origin으로 승격하고 나머지 차이를 anchor `descendants` override로 보존한다.                        |
| F14     | browser sanity는 10k data-bound ListBox에서 projection rows ≤ 200, console/page error 0, rAF target 60fps 또는 baseline 대비 >10% regression 없음으로 통과한다. |

## 11. Open Questions for Implementation

1. `ListBoxItem/Selected`를 별도 origin variant로 seed할지, state style만 origin token으로 둘지는 Phase 2에서 current theme/state model과 맞춰 결정한다.
2. row projection의 Inspector write surface는 first slice에서 read-only로 닫고, data mutation route는 후속 slice로 둘 수 있다.
