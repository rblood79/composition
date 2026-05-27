# ADR-146 Breakdown: ListBoxItem Ref Template and Row Projection

## 1. 목표

ListBox authoring 구조를 다음 4개 권위로 분리한다.

- `Components` system page: reusable origin 보관 및 편집 source.
- content page `ListBox`: locked `ListBoxItem` ref template anchor 보유.
- collection data: `ListBox.props.items` 또는 ADR-132 `collections.runtimeData`로 row data 제공.
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

| 파일                                                                                          | 책임                                                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/builder/src/builder/pages/systemComponentsPage.ts`                                      | `Components` system page 생성/보정 helper                           |
| `apps/builder/src/builder/pages/__tests__/systemComponentsPage.test.ts`                       | 신규 프로젝트 bootstrap, delete guard, page order/name count 검증   |
| `apps/builder/src/builder/components/listbox/listBoxTemplateOrigins.ts`                       | `ListBoxItem/Default`, selected variant, `ListBox` origin seed 생성 |
| `apps/builder/src/builder/components/listbox/__tests__/listBoxTemplateOrigins.test.ts`        | origin/ref/slot allow-list fixture                                  |
| `apps/builder/src/builder/layers/listBoxRowProjection.ts`                                     | Layer Tree row projection 모델과 projection id 생성                 |
| `apps/builder/src/builder/layers/__tests__/listBoxRowProjection.test.ts`                      | static/data-bound rows, stable id, mutation routing 검증            |
| `apps/builder/src/builder/workspace/canvas/skia/listBoxRowTemplateRenderer.ts`                | Skia visible row -> `ListBoxItem` template/ref renderer bridge      |
| `apps/builder/src/builder/workspace/canvas/skia/__tests__/listBoxRowTemplateRenderer.test.ts` | parent composite paint 제거, viewport/row renderer parity 검증      |

### 수정할 가능성이 높은 파일

| 파일                                                                        | 변경                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/builder/src/builder/hooks/usePageManager.ts` 또는 page bootstrap 경로 | 프로젝트 생성/초기화 시 `Components` system page 보장                    |
| `apps/builder/src/stores/**/pages` 관련 action                              | system page delete/rename/duplicate guard, page order/name count 정책    |
| `apps/builder/src/builder/panels/pages/**`                                  | `Home` 앞/왼쪽에 `Components` page 표시. 일반 page와 동일 선택 경로 사용 |
| `apps/builder/src/builder/panels/layers/**`                                 | canonical children + row projection group 병합 표시                      |
| `apps/builder/src/builder/factories/SelectionComponents.ts`                 | ListBox factory가 local child가 아니라 origin/ref template anchor를 사용 |
| `apps/builder/src/adapters/canonical/legacyListBoxTemplateMigration.ts`     | ADR-145 local template child를 Components page origin/ref로 migration    |
| `apps/builder/src/resolvers/canonical/**`                                   | `ListBoxItem` ref template anchor resolution fixture 보강                |
| `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`       | `ListBox` parent row composite paint 제거/compatibility 격리             |
| `packages/specs/src/components/ListBox.spec.ts`                             | row parent paint payload 의존 제거 또는 legacy fallback 표시             |
| `packages/shared/src/components/selection/ListBox*.tsx`                     | Preview RAC dynamic collection과 Builder template metadata 정합          |
| `apps/builder/src/builder/panels/properties/**`                             | row projection 선택 시 Inspector read path 정의                          |
| `docs/CHANGELOG.md`                                                         | Implemented 승격 시 사용자 가시 변경 기록                                |

### 참조 fixture

| 파일                                        | 사용                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `docs/migrations/shadcn-tabs.json`          | reusable origin/ref/descendants/slot + instance children override 패턴 |
| `docs/migrations/shadcn-cards.json`         | slot frame origin과 descendants replacement 패턴                       |
| `docs/migrations/shadcn-design-system.json` | Table Row/Table/Dropdown slot allow-list 패턴                          |

## 4. 데이터 모델

### Page metadata

```ts
interface PageSystemMetadata {
  kind?: "components";
  systemOwned?: boolean;
  previewExcluded?: boolean;
  publishExcluded?: boolean;
  excludeFromAutoNameCount?: boolean;
}
```

기존 page schema에 별도 root collection을 추가하기보다 page metadata/extension으로 표현한다. 실제 타입명과 저장 위치는 현재 canonical page metadata 구조를 inventory한 뒤 결정한다.

### Template anchor metadata

```ts
interface ListBoxTemplateAnchorMetadata {
  role: "listbox-item-template-anchor";
  originRef: string;
  locked: true;
  deleteDisabled: true;
  rowProjectionSource: "items" | "collection";
}
```

anchor는 content page `ListBox` 아래 canonical/ref node로 존재한다. 이 anchor는 row 1개가 아니라 projection renderer의 template input이다.

### Row projection id

```ts
type ListBoxRowProjectionId = `projection:listbox-row:${string}:${string}`;
// projection:listbox-row:<listboxNodeId>:<itemKey>
```

규칙:

- canonical node id와 prefix가 겹치지 않는다.
- selection/hover/hit-test에서 projection id는 canonical mutation target으로 직접 쓰지 않는다.
- Inspector write가 필요한 경우 data binding route 또는 template origin route로 명시적으로 변환한다.

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
- large collection에서는 전체 row를 모두 만들지 않고 visible/limited window를 표시한다.
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
└─ ListBox
   └─ ListBoxItem ref  // locked template anchor, originRef=ListBoxItem/Default
```

규칙:

- 기존 local template child의 style/content/descendants는 `ListBoxItem/Default` origin으로 승격한다.
- page별 override가 있으면 content page의 template anchor `descendants` override로 보존한다.
- 이미 `Components` page가 있으면 system origins를 de-duplicate한다.
- migration은 idempotent해야 한다.

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
- Preview/Publish/runtime/export 제외.
- delete/rename/duplicate/page-n count policy 고정.
- G1 통과.

### Phase 2 - ListBox origins and template anchor

- `ListBoxItem/Default` origin seed 생성.
- optional selected variant seed 구조 정의.
- `ListBox` origin slot allow-list 설정.
- content page `ListBox` factory가 locked ref template anchor 생성.
- existing ADR-145 local template migration helper 보강.
- G2 통과.

### Phase 3 - Layer Tree row projection

- `Rows` projection group 모델 도입.
- static mode와 data-bound mode 표시 분기.
- projection id namespace, selection/hover, Inspector read route 정의.
- delete/reorder/mutation guard fixture 추가.
- G3 통과.

### Phase 4 - Skia row template renderer

- parent composite row paint active path 제거.
- visible row projection이 `ListBoxItem` template/ref renderer를 통과하게 변경.
- viewport/virtualization input과 row bounds 계산 연결.
- DOM Preview RAC dynamic collection parity fixture 추가.
- G4 통과.

### Phase 5 - Migration and compatibility

- existing projects hydration migration.
- reusable master round-trip.
- import/export compatibility.
- refresh hydration no-dup/no-loss fixture.
- G5 통과.

### Phase 6 - Verification and closure

- targeted Vitest.
- ListBox cross-check.
- `pnpm run codex:typecheck`.
- 필요한 browser sanity.
- README/CHANGELOG/ADR status sync.
- G6 통과 후 Implemented 승격.

## 10. Acceptance Fixtures

| Fixture | 내용                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------ |
| F1      | 신규 프로젝트 생성 시 `Components` page가 `Home` 앞에 있고 Preview page list에는 없다.           |
| F2      | `Components` page 선택 시 Skia canvas와 Layers Tree가 origin 구조를 표시한다.                    |
| F3      | Page A `ListBox` Layer Tree가 template anchor와 `Rows` projection group을 표시한다.              |
| F4      | data-bound 3 rows가 projection id를 안정적으로 유지하고 selection overlay가 row bounds에 맞는다. |
| F5      | row projection delete는 canonical child delete로 실행되지 않는다.                                |
| F6      | Skia active path에서 `ListBox` parent가 row text/background를 직접 paint하지 않는다.             |
| F7      | Preview DOM path는 RAC `items` collection semantics를 유지한다.                                  |
| F8      | ADR-145 local template child 프로젝트가 origin/ref anchor 구조로 idempotent migration된다.       |

## 11. Open Questions for Implementation

1. `Components` page metadata를 canonical page `props`, `metadata`, `x-composition` 중 어디에 둘지 Phase 0에서 현재 schema를 보고 결정한다.
2. `ListBoxItem/Selected`를 별도 origin variant로 seed할지, state style만 origin token으로 둘지는 Phase 2에서 current theme/state model과 맞춰 결정한다.
3. row projection의 Inspector write surface는 first slice에서 read-only로 닫고, data mutation route는 후속 slice로 둘 수 있다.
4. Layer Tree에서 large collection을 몇 개까지 표시할지 기본 window size를 정해야 한다.
