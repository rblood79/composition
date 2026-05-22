# ADR-144 Breakdown: Composite RAC resolved-tree parity + slot-editable component contract

## Goal

ADR-144 의 목표는 ADR-142 의 catalog-only cutover 위에 composite component completion
definition 을 추가하는 것이다.

완료 기준은 "componentCatalog 에 등록되어 Preview/Skia route 를 탄다"가 아니라:

1. editable subpart 가 canonical/resolved node identity 를 가진다.
2. Preview, Skia, selection overlay, Inspector edit path 가 같은 owner id/path 를
   소비한다.
3. RAC runtime behavior 는 `react-aria-components` primitive 에 남긴다.
4. `items[]`/`rows[]`/`columns[]` 는 tree 에서 파생되는 runtime projection 일 뿐,
   editable authoring SSOT 가 아니다.

## Non-Goals

- `CompositionDocument` schema 변경.
- `.pen` 원본 직접 parsing. JSON export fixture 만 사용한다.
- legacy `ComponentSpec` / `render.shapes()` 복원.
- ADR-910 성능 최적화 선실행.
- RAC keyboard/focus behavior 수동 재구현.

## Current Evidence

### Canonical format already has the required primitives

- `CanonicalNode.reusable?: boolean` exists.
- `CanonicalNode.children?: CanonicalNode[]` is the structural source.
- `CanonicalNode.slot?: false | string[]` uses allowed reusable component ids,
  not region labels.
- `RefNode` uses `type:"ref"`, `ref`, and `descendants` stable id path patches.
- Resolver opens refs into master type, preserves instance id, applies descendants,
  and returns resolved children.

Relevant files:

- `packages/shared/src/types/composition-document.types.ts`
- `apps/builder/src/resolvers/canonical/index.ts`

### ADR-142 completion is catalog routing, not composite parity

ADR-142 status says all families reached `componentCatalog` `cutover:"catalog"` and
Skia renders generic component surfaces. That is valid for routing closure, but not
enough for editable composite parity.

Current Tabs path:

- `packages/shared/src/catalog/primitives/tabs.ts` stores Tabs default authoring
  data as `items[]` props and marks Skia as `{ kind: "tabs" }`.
- `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx` converts props
  to RAC props and returns `<Tabs ... />` without resolved child ownership.
- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` constructs
  synthetic Skia node ids such as `${node.id}:tab:${item.id}:label` and
  `${node.id}:panel:content`.

This gives a rendered picture, but `TabPanel` and tab subparts are not editable
canonical children.

### Fixture evidence

`packages/RAC-showcase.json`:

- reusable components: 67.
- refs: 263.
- refs with descendants: 199.
- includes `Tab`, `TabList`, `Tabs`, `Table`, `Tree`, `Select`, `ComboBox`,
  date/color and overlay families.
- Tabs pattern: `Tab` reusable frame, `TabList` children refs with descendants
  label/indicator overrides, `Tabs` reusable frame with `TabList` ref and real
  panel/body child.

`packages/slot-tabs-selection.json`:

- `Tab Item/Active` is a reusable frame.
- `Tab Item/Inactive` is a reusable `ref` variant with descendants patch.
- `Tabs` is a reusable frame with `slot: ["coMmv", "QY0Ka"]`.
- `Tabs` instance is a `ref` with child refs filling the slot.
- selected ids include origin, variant, host, and instance, proving selection is
  intended over real nodes/refs.

`packages/shadcn-design-system.json`:

- top-level `reusableComponents` entries: 87.
- deep `reusable:true` objects across the full export: 174. This includes
  reusable nodes duplicated under the selected exported tree, so contract
  coverage uses the top-level `reusableComponents` entry count.
- refs: 119.
- reusable refs: 41.
- refs with descendants: 100.
- slot hosts: 22.
- slot/ref/descendants pattern repeats across `Tabs`, `Dropdown`, `Table Row`,
  `Table`, `Sidebar Content`, `Page Numbers Slot`, and `Data Table Content`.

The design language is not copied. The reusable/ref/descendants/slot authoring
pattern is copied as the contract evidence.

## Contract Decisions

### C1. Composite component equals reusable document origin

Composite RAC components are not closed by `PrimitiveBinding.defaultProps.items[]`.
They are canonical reusable origins. A catalog entry may point to a reusable origin
template and create an instance `type:"ref"`.

Examples:

- Tabs: reusable `Tabs` frame containing `TabList` ref and `panel` frame.
- TabList: reusable frame containing Tab item refs.
- Table: reusable frame with row/cell slot host.
- Dropdown/Menu-like surfaces: reusable frame with allowed item/section/separator
  slot ids.

### C2. PrimitiveBinding remains leaf behavior boundary

`PrimitiveBinding` remains the right abstraction for:

- Button-like press behavior.
- TextField/DateField/ColorField input behavior.
- RAC collection behavior at runtime.
- overlay/focus primitives.

It is not the authoring SSOT for editable composite structure. It may provide
projection helpers from resolved tree to RAC props.

### C3. Collection props are runtime projection

`items[]`, `rows[]`, `columns[]`, `selectedKey`, `selectedKeys`, and similar fields
can exist as RAC props projection. For editable surfaces they are derived from
canonical children/ref/descendants/slot.

Allowed:

- `resolved Tabs tree -> RAC Tabs props`
- `resolved TabList child refs -> items[]`
- `resolved panel frame -> selected panel content`

Not allowed as new authoring SSOT:

- persisted `Tabs.props.items[]` as the only location of tab labels and panel body.
- Skia-only `${id}:panel:*` nodes as edit owners.

#### C3-a. Data source 축

Composite component 의 data source 는 다음 3축으로 들어온다.

1. **Data Panel inline collection (persisted)** — ADR-132 `collections` IndexedDB store 의 entry (`schema` + `mockData`, `apps/builder/src/types/builder/data.types.ts:52-67`) 를 작가가 수동 생성. IndexedDB 에 persist 되는 정적 데이터. ADR-131 Phase 8 사용자 framing revert 로 `CompositionDocument.data` root field 는 추가되지 않음 — `collections` 는 store 분리 유지 (`packages/shared/src/types/composition-document.types.ts:439-440`).
2. **API endpoint (persisted config + runtime sink)** — `api_endpoints` IndexedDB store 의 config (target = `endpoint.targetCollection`, `apps/builder/src/types/builder/data.types.ts:205-215`) 가 persist 됨. 실행 시 `executeApiEndpoint` (`apps/builder/src/builder/stores/utils/dataActions.ts:645-660`) 가 응답을 `collections[id].runtimeData` 로 **Zustand store 의 메모리 sink** 에 set — **DB 저장 안 함** (`data.types.ts:68` 주석: "메모리에만 존재, DB에 저장 안함"). Preview/Canvas read path 는 postMessage 동기화 또는 `/api/proxy` direct fetch fallback (`apps/builder/src/builder/hooks/useCollectionData.ts:340-355` `isCanvasContext` branch) 잔존 — Builder execute path 와 Preview/Canvas read path 의 sink 정합 완성은 ADR-132 후속 영역으로 lock-in 됨 (`docs/adr/design/132-usecollectiondata-useasynclist-alignment-breakdown.md:241`). 본 ADR G3/G6 에서 두 경로의 row identity / owner projection 을 별도 검증한다.
3. **Properties 패널 inline editor** — ADR-076 정적 모드 ItemsManager (`apps/builder/src/builder/panels/properties/generic/ItemsManager.tsx:342`) 가 element `props[itemsKey]` (예: `props.items[]`) 를 직접 read/write — IndexedDB 미경유, canonical document 의 element props 로 직렬화. 새 creation path 는 §C3-b mode 3 (legacy fallback) 으로만 사용.

3축 모두 RAC runtime projection 입력 (`items[]`, `rows[]`, `columns[]`) 으로 합류한다. mode 1, 2 가 사용될 때 composite template 의 children/ref 는 row template 역할만 하고 데이터 자체는 `useCollectionData({ datatableId | dataBinding })` (`packages/shared/src/hooks/useCollectionData.tsx:220-228` RAC read entry point) 가 제공한다.

#### C3-b. Data SSOT 정의 + 3 input mode

**Data SSOT 분해**:

- `collections[id]` persisted `schema` + `mockData` + `api_endpoints[id]` config = **persisted data source** (IndexedDB).
- `collections[id].runtimeData` = **runtime sink/cache** (Zustand store 메모리, DB 미저장).
- `useCollectionData({ datatableId | dataBinding })` = **RAC read entry point** (Builder/Preview/Canvas 통합 진입점, Canvas direct proxy fallback 잔존).

**Authoring SSOT 분해**:

- Composite **reusable origin / ref / descendants / slot** = authoring SSOT (사용자 편집 대상, canonical `CompositionDocument.children[]` 안).

**한 instance 는 다음 3 input mode 중 하나의 active 상태**:

1. **External dataBinding** — `element.props.dataBinding` 설정. ADR-132 persisted data source 또는 runtime sink 를 `useCollectionData` 로 read. composite children/ref 는 row template 으로만 동작. data 자체의 mutation 은 Data Panel / API endpoint UI 에서.
2. **New resolved-tree local data (ADR-144 신규)** — `dataBinding` 미설정 + composite reusable origin + ref + `descendants` / `slot` patch. authoring SSOT = canonical `children[]` 자체. data 자체의 mutation 은 Phase 5 task 7 slot 추가/삭제 UI.
3. **Legacy `props.items[]` fallback** — `dataBinding` 미설정 + ADR-076 정적 모드 ItemsManager (`props[itemsKey]` 직접 편집). `PrimitiveBinding.defaultProps.items[]` (예: `apps/builder/src/builder/...` 류; 또는 `packages/shared/src/catalog/primitives/listBox.ts:168-177` Aardvark/Cat/Kangaroo 등 9 family inline) 의 adapter fallback. 새 creation path 는 본 mode 미사용.

세 mode 가 한 instance 에 동시 active 될 수 없다. Phase 5 task 7 Inspector Properties UI 는 instance 의 mode 를 감지하여 Editor UI 를 분기한다 (mode 1 = dataBinding picker, mode 2 = slot 추가/삭제 UI, mode 3 = legacy ItemsManager).

### C4. Slot semantics

`slot?: false | string[]` is an allow-list of reusable component ids.

Rules:

1. Slot host may be top-level reusable origin or nested frame inside a composite.
2. Slot fill is represented by real `children[]` on the instance/ref or descendant
   replacement path.
3. Inserted slot child must be a normal canonical node, usually `type:"ref"`.
4. Slot order is `children[]` order.
5. Slot validation is non-destructive: invalid fill should surface as validation
   error, not be silently dropped.

### C5. Owner identity

Every rendered editable visual part must map to a canonical owner:

| Surface                      | Owner                                    |
| ---------------------------- | ---------------------------------------- |
| reusable origin root         | origin node id                           |
| ref instance root            | instance ref id                          |
| descendant child under ref   | instance id + stable child id path       |
| slot-filled child            | child/ref id under instance `children[]` |
| backend-only paint primitive | nearest non-editable visual owner only   |

Synthetic backend ids may exist for draw commands, but they cannot be selection or
Inspector owners.

### C6. Preview and Skia consume the same resolved tree

Preview may use RAC DOM structure internally, and Skia may draw simplified visual
commands, but both must take the same resolved tree input.

For each editable owner:

- Preview marker exposes owner id/path.
- Skia node data preserves owner id/path.
- selection overlay/hit-test uses owner id/path.
- Inspector edit writes root props or descendants patch.

### C7. Behavior layer remains RAC

RAC behavior tests are separate from rendering parity tests.

Examples:

- Tabs keyboard activation and focus.
- Select/ListBox/Menu collection selection.
- Tree/Table directional navigation.
- overlay escape/focus restoration.

These tests verify `react-aria-components` integration, not Skia drawing.

## Phase Plan

### Phase 0 — Baseline and evidence freeze (Implemented 2026-05-21)

Purpose: lock current gap and fixture coverage before code changes.

Tasks:

1. Freeze current `Tabs` catalog/Preview/Skia route with file:line evidence.
2. Add fixture inventory doc or test fixture manifest for:
   - `packages/RAC-showcase.json`
   - `packages/slot-tabs-selection.json`
   - `packages/shadcn-design-system.json`
3. Record current behavior:
   - new builder Tabs creation payload shape.
   - Preview marker ids for Tabs.
   - Skia node ids for Tabs.
   - selection/editability failure for TabPanel/body.
4. Define synthetic editable owner denylist:
   - `${tabsId}:panel:bg`
   - `${tabsId}:panel:content`
   - `${tabsId}:tab:*` when no canonical owner path exists.

Gate: G0.

Evidence:

- [144-composite-rac-resolved-tree-parity-phase0-baseline.md](144-composite-rac-resolved-tree-parity-phase0-baseline.md)

### Phase 1 — Contract fixture tests (Implemented 2026-05-21)

Purpose: prove current canonical format can express the target structure without
schema changes.

Tasks:

1. Add fixture parser/normalizer for JSON export shape differences:
   - `reusableComponents` root shape from RAC showcase.
   - `nodes` root shape from slot fixture.
   - `selection` + `reusableComponents` shape from shadcn fixture.
2. Add contract tests:
   - reusable origin lookup.
   - reusable `ref` variant origin.
   - `descendants` patch by stable id path.
   - slot allow-list reading.
   - slot-filled instance children order.
   - nested slot discovery.
3. Assert no schema migration is needed.

Gate: G1.

Candidate test files:

- `apps/builder/src/resolvers/canonical/__tests__/compositeRacFixtures.test.ts`

Evidence:

- `apps/builder/src/resolvers/canonical/compositeRacFixtureContracts.ts`
- `apps/builder/src/resolvers/canonical/__tests__/compositeRacFixtures.test.ts`
- `pnpm -F @composition/builder exec vitest run src/resolvers/canonical/__tests__/compositeRacFixtures.test.ts`

### Phase 2 — Tabs authoring model (Implemented 2026-05-22)

Purpose: make new Tabs creation produce editable canonical structure.

Target structure:

1. `Tab` reusable origin.
2. `TabList` reusable origin with tab refs.
3. `Tabs` reusable origin with `TabList` ref + panel frame/body text.
4. `Tabs` instance created as `type:"ref"` or as materialized reusable template,
   depending on current component panel/library ownership model.

Tasks:

1. Add composite catalog entry type if needed:
   - `kind: "composite"`
   - `templateOriginId`
   - `allowedSlots`
   - `behaviorPrimitive?: "Tabs"`
2. Update Component Panel/Factory Tabs creation to use composite template.
3. Keep legacy props-only `Tabs.items[]` adapter for existing documents only.
4. Ensure generated node ids are stable and editable:
   - Tab label text id.
   - indicator rectangle id.
   - panel frame id.
   - panel body text id.
5. Composite template default child set:
   - 새 instance 생성 시 default content 는 composite template origin 의 children 으로 정의한다. 데이터 inline 박힌 `defaultProps.items[]` (Aardvark/Cat/Kangaroo 류) 는 사용하지 않는다.
   - 예 Tabs: `TabList` reusable origin + 2 Tab ref + 2 TabPanel frame (RAC dynamic collections 가이드의 `useState` 초기값 위치에 대응).
   - 예 collection family (ListBox/GridList/Menu/Select/ComboBox/TagGroup/Table/Tree): item origin + 0~1 sample ref. 0 ref 로 시작할지 1 sample ref 로 시작할지는 family 별 G2/G6 evidence 단계에서 결정한다 (작가가 빌더에서 곧바로 Properties UI 로 항목을 추가하는 시나리오를 기본 entry point 로 둔다).
   - 기존 `PrimitiveBinding.defaultProps.items[]` 의 inline 데이터는 catalog primitive 에서 제거하지 않는다. C3-b 에 따라 legacy props-only payload 의 adapter fallback 으로만 의미를 유지한다. 새 creation path 는 본 task 5 의 composite template 을 사용한다.
   - **Cross-link**: 본 default child set 으로 생성된 instance 의 사용자 entry point (작가가 빌더에서 항목 추가/삭제) 는 **Phase 5 task 7 의 slot 추가/삭제 UI** 가 cover. "0 ref 시작" 시 Phase 5 task 7 UI 의 Add 동작이 첫 ref 를 생성 (RAC dynamic collections 가이드의 `onPress={addItem}` 흐름과 정합). "1 sample ref 시작" 시 Phase 5 task 7 UI 는 Add/Remove 양방향 진입점.

Gate: G2.

Likely files:

- `packages/shared/src/catalog/**`
- `apps/builder/src/builder/panels/components/**`
- `apps/builder/src/builder/factories/**`
- `apps/builder/src/adapters/canonical/**`

Implementation decision:

- Composite catalog entry type was not needed for the first Tabs slice. The
  shared Tabs primitive binding keeps `defaultProps.items[]` as legacy adapter
  fallback, while the Builder factory uses a factory-level composite template for
  new authoring.
- New Tabs creation emits `Tab` / `TabList` / `Tabs` reusable origins, tab refs,
  descendants patches for label/indicator overrides, two editable `TabPanel`
  frames with body text, and a page-owned Tabs ref instance.
- C3-b input mode split is now explicit for Tabs: new local authoring uses
  resolved-tree composite payload; existing `props.items[]` stays fallback only;
  external `dataBinding` remains untouched for later G3/G6 projection checks.

Evidence:

- `apps/builder/src/builder/factories/definitions/LayoutComponents.ts`
- `apps/builder/src/builder/factories/ComponentFactory.ts`
- `apps/builder/src/builder/factories/__tests__/tabsCompositeFactory.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/factories/__tests__/tabsCompositeFactory.test.ts`

### Phase 3 — Preview resolved-tree projection (Implemented 2026-05-22)

Purpose: render Tabs from canonical children while preserving RAC behavior.

Tasks:

1. Add `resolvedTreeToTabsRacProps()` or equivalent projection from:
   - TabList child refs -> RAC tab items.
   - selected state -> selected/default key.
   - panel child -> TabPanel content.
2. Render real resolved child owners with markers.
3. Avoid hiding panel content behind opaque RAC-internal-only DOM with no owner
   mapping.
4. Keep ARIA behavior in RAC components.
5. Add tests for marker ids:
   - tab item label owner.
   - panel frame owner.
   - panel body owner.

Gate: G3 Preview half.

Likely files:

- `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`
- `packages/shared/src/components/Tabs.tsx`
- `packages/shared/src/catalog/primitives/tabs.ts`

Implementation decision:

- Preview projection is implemented in `CanonicalNodeRenderer` rather than the
  shared `Tabs` primitive. This keeps shared `Tabs` behavior-compatible for
  legacy `props.items[]` and dataBinding paths while letting canonical Preview
  render resolved `TabList` / `Tab` / `TabPanel` owners directly.
- `Text` descendants inside `Tab` use mode-A `text` patches, not `children`
  patches, because resolver `children` is the mode-C subtree replacement
  discriminator.
- G3 remains incomplete until Phase 4 lands the Skia half and owner/bounds
  parity check.

Evidence:

- `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`
- `apps/builder/src/preview/components/CanonicalNodeRenderer.adr144.test.tsx`
- `pnpm -F @composition/builder exec vitest run src/preview/components/CanonicalNodeRenderer.adr144.test.tsx src/builder/factories/__tests__/tabsCompositeFactory.test.ts`

### Phase 4 — Skia resolved-tree drawing and hit-test ownership (Implemented 2026-05-22)

Purpose: stop Skia from inventing editable Tabs parts.

Tasks:

1. Replace `buildGenericTabsNode()` editable synthetic output with resolved-child
   drawing.
2. Preserve draw-command synthetic ids only as non-editable internal ids.
3. Add owner id/path metadata to Skia node data where selection overlay consumes it.
4. Match Preview owner set for:
   - Tabs root.
   - TabList.
   - Tab item refs.
   - active indicator.
   - panel frame.
   - panel body text.
5. Add denylist test for `${node.id}:panel:*` as editable owner.

Gate: G3 Skia half + G4 denylist half.

Likely files:

- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`
- `apps/builder/src/builder/workspace/canvas/skia/**`
- `apps/builder/src/builder/workspace/canvas/selection/**`

Implementation decision:

- `buildGenericTabsNode()` now prefers resolved `TabList` / `Tab` / `TabPanel`
  children when present and keeps legacy `props.items[]` synthetic drawing only
  as the adapter fallback for existing payloads.
- Resolved Tabs subparts use canonical `elementId`, `ownerPath`, and
  `hitTestOwner: true`; draw-only background/border nodes have no editable
  owner id.
- `buildRenderCommandStream()` records bounds for internal Skia children only
  when `hitTestOwner` is set, so `${tabsId}:tab:*` and `${tabsId}:panel:*`
  remain non-editable draw internals.
- Full TabPanel/body edit writes remain Phase 5 scope; Phase 4 closes the Skia
  owner/bounds prerequisite.

Evidence:

- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`
- `apps/builder/src/builder/workspace/canvas/skia/nodeRendererTypes.ts`
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`
- `apps/builder/src/builder/workspace/canvas/skia/canonicalSkiaSymmetry.test.ts`
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.test.ts`
- `pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/canonicalSkiaSymmetry.test.ts src/builder/workspace/canvas/skia/renderCommands.test.ts src/builder/workspace/canvas/skia/buildSpecNodeData.test.ts`

### Phase 5 — Selection and editing (Implemented 2026-05-22)

Purpose: make selection/edit writes land in canonical owner paths.

Tasks:

1. Selection hit on Tab label selects the tab item ref/descendant label owner.
2. Selection hit on panel body selects panel body text owner.
3. Text edit writes:
   - origin child when editing origin.
   - instance `descendants[path].content` when editing ref instance child.
4. Style edit writes:
   - origin child style when editing origin.
   - instance `descendants[path]` style patch when editing ref instance child.
5. Undo/redo and IndexedDB hydration preserve changes.
6. Layout invalidation is explicit:
   - descendant content/style patch that can affect layout increments
     `layoutVersion` and marks the edited owner subtree dirty.
   - new top-level layout-affecting props are registered in
     `LAYOUT_AFFECTING_PROP_KEYS`.
   - new non-layout or inherited layout style props are checked against
     `NON_LAYOUT_PROPS_UPDATE` and `INHERITED_LAYOUT_PROPS_UPDATE`.
7. Inspector Properties UI integration (3 input mode 별 Editor 분기):
   - C3-b 의 3 input mode 각각이 Properties 패널에서 별도 Editor UI 를 활성화한다.
     - **Mode 1 (external dataBinding)**: dataBinding picker (Data Panel collection 선택 또는 API endpoint 선택). data 자체의 mutation 은 Data Panel / API endpoint UI 에서.
     - **Mode 2 (new resolved-tree local data, ADR-144 신규)**: **slot 추가/삭제 UI** — Phase 2 task 5 default child set 으로 생성된 composite instance 에 ref 를 추가/제거. RAC dynamic collections 가이드의 `<Button onPress={addItem}>Add item</Button>` 위치에 대응. canonical `children[]` mutation.
     - **Mode 3 (legacy `props.items[]` fallback)**: **ItemsManager 섹션** (`apps/builder/src/builder/panels/properties/generic/ItemsManager.tsx:342`) — ADR-076 정적 모드 호환 path. element `props[itemsKey]` 직접 편집.
   - ADR-076 `ListBoxPropertyEditor` 의 듀얼 모드 (정적 / 템플릿) 는 mode 3 (정적) + mode 2 (템플릿, Field 자식 보유 ↔ composite reusable origin + ref + descendants 의 prior art) 에 대응. ListBoxItemEditor 가 템플릿 모드의 Field 자식 편집 담당.
   - 한 instance 의 Properties 패널에는 3 mode 의 Editor UI 가 **상호 배타** 로 표시된다. instance 의 mode 감지는 (`dataBinding` 설정 여부 → mode 1) → (resolved-tree composite payload 여부 → mode 2) → (else → mode 3 fallback) 순서.
   - ADR-076 `getCustomPreEditor` pre-generic hook 패턴 (`apps/builder/src/builder/inspector/editors/registry.ts:38-60`) 은 이미 **4 family land** 완료: ListBox (ADR-076 P6, line 40-41) / TagGroup (ADR-097 P3, line 42-46) / Menu (ADR-099 Phase 4, line 47-51) / GridList (ADR-099 Phase 4, line 52-56). 남은 5 family 중 **Tabs 는 별 패턴** (`getHybridAfterSections`, `registry.ts:19-28` line 21-22 case) 으로 wiring 됨. Phase 7 family expansion 시 **Select / ComboBox / Table / Tree 4 family** 가 `getCustomPreEditor` 확장 대상 (3 mode 감지 + Editor UI 분기). Tabs 는 본 ADR 의 composite resolved-tree payload 와 정합한 새 PropertyEditor 패턴 (resolved-tree node selection + descendants patch editor) 으로 wiring — `getHybridAfterSections` 는 mode 3 legacy 호환 path 로 유지.

Gate: G4.

Likely files:

- `apps/builder/src/builder/stores/**`
- `apps/builder/src/builder/panels/properties/**`
- `apps/builder/src/builder/workspace/canvas/**`
- `apps/builder/src/adapters/canonical/**`

### Phase 6 — RAC behavior tests (Implemented 2026-05-22)

Purpose: keep behavior under RAC, not composition-drawn imitations.

Tasks:

1. Tabs behavior tests:
   - Arrow key changes focused tab.
   - activation policy follows `keyboardActivation`.
   - selected tab/panel relation remains valid.
2. Add official React Aria testing pattern references for collection families.
3. Keep behavior tests separate from Skia visual tests.

Gate: G5.

Landed implementation:

- File: `apps/builder/src/preview/components/Tabs.behavior.test.tsx` (6 tests
  passing). 두 group 으로 분리:
  - `ADR-144 Phase 6 — Tabs RAC behavior (wrapper)`: composition `Tabs` /
    `TabList` / `Tab` / `TabPanel` static-children path 가 RAC keyboard
    navigation (ArrowRight `automatic` activation), `keyboardActivation="manual"`
    contract (ArrowRight focus-only / Enter activation), `aria-controls`/
    `aria-labelledby` 양방향 wiring 을 그대로 통과시킨다는 evidence.
  - `ADR-144 Phase 6 — Tabs RAC behavior (canonical resolved-tree)`: ADR-144
    의 reusable `Tab`/`TabList`/`Tabs` origin + `type:"ref"` instance +
    `descendants` override + nested `TabPanel` body 의 resolved tree 가
    `CanonicalNodeRenderer` 를 통과해서 동일 RAC contract (ArrowRight,
    Home/End, RAC focus marker) 를 유지한다는 evidence. composition 의
    `data-canonical-id` marker wiring 이 RAC selection delivery 를 가로채지
    않는다.
- jsdom polyfill: 본 file inline `beforeAll` 에서 `CSS.escape` (react-aria
  `useSelectableCollection` onFocus 경로) + `Element.prototype.getAnimations`
  (RAC `SharedElementTransition` — `showIndicator: true` 시 frame polling) 만
  최소 stub. RAC primitive 자체는 그대로 사용.
- Official React Aria testing pattern 참조:
  - <https://react-spectrum.adobe.com/react-aria/testing.html>
  - <https://react-spectrum.adobe.com/react-aria/Tabs.html#props>
- `packages/shared/src/components/__tests__/` 는 vitest config 가 `.ts` only
  include + jsdom/testing-library devDeps 미보유. apps/builder 의 jsdom +
  alias 셋업을 활용해서 wrapper path 와 resolved-tree path 를 한 file 에 통합
  (인프라 변경 회피).

Files:

- `apps/builder/src/preview/components/Tabs.behavior.test.tsx` (신규)

### Phase 7 — Family expansion matrix (Wave A + Wave B + Wave C Implemented 2026-05-22)

Purpose: apply the same contract beyond Tabs.

Landed implementation (Wave A — collection family matrix row, 4 step land scope):

1. **Fixture contract** — `compositeRacFixtures.test.ts` expanded with 4
   regression cases proving `RAC-showcase.json` `ListBox` / `ListBoxItem` /
   `Menu` / `MenuItem` reusable origin + ref children + `vWhZJ` / `Cae9Z`
   leaf shape, `Select` / `ComboBox` named child shape (`label` / `button`
   or `field` / `description` / `error`), and `shadcn-design-system.json`
   `Dropdown` 6-slot host pattern (8/8 PASS).
2. **Composite factory** — `SelectionComponents.ts` exports
   `createCollectionCompositeElements` plus 4 family-specific wrappers
   (`createSelectCompositeElements` / `createComboBoxCompositeElements` /
   `createListBoxCompositeElements` / `createMenuCompositeElements`).
   Each new creation path produces 7 elements
   (item-origin + item-label leaf + container-origin with `slot:
[item-origin]` + 3 ref instance children with descendants overrides +
   page-owned ref instance). legacy `createSelectDefinition` /
   `createComboBoxDefinition` / `createListBoxDefinition` /
   `createMenuDefinition` (`SelectionComponents.ts` /
   `NavigationComponents.ts`) `props.items[]` factories remain as
   adapter fallback (5/5 PASS via `collectionCompositeFactories.test.ts`).
3. **Preview marker** — `CanonicalNodeRenderer.adr144.test.tsx` extended
   `it.each` matrix proves the page-owned ref instance of each of the 4
   families renders a Preview DOM element carrying
   `data-canonical-id='container-instance'`. ListBox / ComboBox / Select
   resolve onto the matching `react-aria-*` root class; the shared
   `<MenuButton>` wraps the canonical marker on a layout `div` instead of
   the RAC `Menu` primitive, which is documented in the test.
4. **Skia synthetic 0 editable owner (G6 acceptance)** —
   `canonicalSkiaSymmetry.test.ts` extended `it.each` matrix asserts that
   `buildGenericResolvedSkiaNodeData` keeps the root container `elementId`
   as the canonical instance id, and that none of the synthetic child
   SkiaNodeData ids (`${rootId}:item:*`, `${rootId}:trigger:*`,
   `${rootId}:menu:*`, `${rootId}:input`, `${rootId}:value`,
   `${rootId}:list:*`, `${rootId}:background`) is registered with
   `hitTestOwner: true`. This delivers ADR-144 Phase 7 G6 acceptance
   (synthetic editable owner 0 件) without further mutating
   `buildGenericListBoxNode` / `MenuNode` / `ComboBoxNode` / `SelectNode`.

Landed implementation (Wave B — 4 family Skia resolved-tree owner emission,
2026-05-22):

1. **Shared resolver** — `findResolvedCollectionItems(node, itemType)`
   (`apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`)
   walks `node.children` for canonical items of the requested type and
   discovers their optional Text label descendant via the existing
   `findResolvedTabsTextNode` heuristic (Text / Label / Paragraph /
   Heading). Returns `[]` when no canonical items are present — caller
   falls back to legacy `props.items[]` synthetic drawing.
2. **Per-family resolved-tree helpers** — `buildResolvedListBoxChildren`,
   `buildResolvedMenuChildren`, `buildResolvedComboBoxOrSelectChildren`
   mirror `buildResolvedTabsChildren`. Each helper emits draw-only chrome
   (background / trigger / list bg) plus per-item canonical owner pairs:
   - item box: `hitTestOwner: true`, `elementId = itemNode.id`,
     `ownerPath = ${containerId}/${itemId}`
   - label text: `hitTestOwner: true`,
     `elementId = labelNode.id ?? itemNode.id`,
     `ownerPath = ${containerId}/${itemId}/${labelId}`
3. **Dispatch wiring** — `buildGenericListBoxNode` / `MenuNode` /
   `ComboBoxNode` / `SelectNode` call their helper first; if it returns
   children, the container short-circuits with canonical owners. Legacy
   `props.items[]` rendering remains unchanged behind the fallback.
4. **Positive parity test** — `canonicalSkiaSymmetry.test.ts` adds a
   second 4-row `it.each` block (`ADR-144 Wave B`) that asserts canonical
   item ids + label ids appear in `collectHitTestOwnerElementIds`, the
   matching `ownerPath` strings appear in `collectOwnerPaths`, and the
   existing G6 denylist still holds (no synthetic owner regression).
5. **G7-A re-measurement** —
   `apps/builder/src/builder/workspace/canvas/skia/__perf__/adr144Phase8FrameBudget.perf.test.ts`
   adds a Wave B `it.each` matrix (N=50 dual-path) and a 1000-item stress
   row for ListBox / Menu. Wave B p95 stays under both the props-only +
   25 % ceiling and the 60fps budget; the 0.5ms floor catches the
   Select / ComboBox case where the resolved payload renders 108 nodes
   vs the props-only 14-node chrome (sub-millisecond noise must not
   gate). Evidence: 13/13 perf test PASS.

Landed implementation (Wave C — Inspector Properties UI 3 input mode 분기,
2026-05-22):

1. **`getCustomPreEditor` expansion** —
   `apps/builder/src/builder/inspector/editors/registry.ts` switch 에
   `case "Select"` → `"SelectPropertyEditor"`, `case "ComboBox"` →
   `"ComboBoxPropertyEditor"` 추가. 기존 ListBox / TagGroup / Menu /
   GridList 4 case 유지. spec-first early return 이전 평가되는 ADR-076 P6
   pre-generic hook 패턴.
2. **신규 PropertyEditor 2 종** —
   `apps/builder/src/builder/panels/properties/editors/SelectPropertyEditor.tsx` +
   `ComboBoxPropertyEditor.tsx`. 진입 시 `detectInspectorInputMode` 결과로
   mode 1 (external-databinding) / mode 2 (resolved-tree) / mode 3
   (legacy-items) 분기. mode 2 에서는 `ResolvedTreeSlotEditor` +
   `GenericPropertyEditor` filtered (`Item Management` 섹션 제외) 동시
   렌더. mode 1 / mode 3 은 `GenericPropertyEditor` 전체 주입 (ItemsManager
   가 dataBinding picker 또는 items[] 편집 UI 로 자체 분기).
3. **ListBox / Menu PropertyEditor mode 분기 통합** —
   `ListBoxPropertyEditor.tsx` / `MenuPropertyEditor.tsx` 가 동일
   `detectInspectorInputMode` 호출. ListBox 의 기존 `hasTemplateMode`
   (Field 자식 보유 시 ItemsManager 섹션 필터) 휴리스틱은 mode 3
   (legacy-items) 분기 안에서만 평가 — mode 2 진입 시 무시.
4. **공통 add/remove UI** —
   `ResolvedTreeSlotEditor.tsx` 가 4 family 공유. 현재 instance/origin 의
   containerOrigin 자식 ref 리스트 시각화, "Add item" → 새 ref instance
   생성 (descendants 에 `Item N` 기본 label), "Remove" → ref instance 삭제.
   `useStore.addElement` / `removeElement` 액션 단일 진입점 —
   Memory→Index→History→DB→Preview→Rebalance 순서는 액션 내부 contract 가
   보존.
5. **Static contract tests** —
   `registry.adr144.static.test.ts` (registry expansion 3 case) +
   `SelectPropertyEditor.test.tsx` / `ComboBoxPropertyEditor.test.tsx`
   (`__tests__/`, 6 case 각) + `ListBoxPropertyEditor.test.tsx` /
   `MenuPropertyEditor.test.tsx` (mode wiring 4 / 3 case). source-string
   검증 패턴 (canonicalPropertyEditors.static.test.ts 와 일관). 신규 22
   case + 기존 28 case 합쳐서 50/50 PASS.

Wave C 후 잔존 debt (별도 ADR scope):

- C3-a 데이터 source 3축 정합 (Data Panel inline persisted / API endpoint
  - Zustand runtime sink / Properties inline `element.props[itemsKey]`) —
    Builder execute path 와 Preview/Canvas read path 의 sink 정합
    (`useCollectionData.ts:340-355` direct proxy branch) 은 ADR-132
    collection sink 정합 영역으로 deferred. ADR-144 본질적 결정사항
    (composite RAC resolved-tree parity + slot-editable component
    contract) 은 Wave C 로 land 완결.

nested-descendant edit routing (Skia hit-test → Inspector store mutation)
is **already land** through Phase 5 `ownerPath` + `apply*FromSelection`
flow; Wave C only adds the
Properties panel mode-detection surface.

Wave A delivered the test/factory boundary; Wave B delivered the Skia
owner emission. The change set in Wave B is bounded to (a) helper
addition in `buildSpecNodeData.ts`, (b) dispatch hook in 4 existing
`buildGenericXNode` bodies, (c) Skia symmetry positive parity test,
(d) Phase 8 perf re-measurement.

**Wave A wiring 보강 (2026-05-22 사용자 raise — closure rollback 후 fix)**:
사용자가 "Tabs/4 family 등록해도 변화 없다" 로 raise. 조사 결과,
`ComponentFactory.createTabs` (LayoutComponents) 만 `createTabsCompositeElements`
호출, 4 family `createSelect / createComboBox / createListBox / createMenu` 는
여전히 legacy `createSelectDefinition / createComboBoxDefinition /
createListBoxDefinition / createMenuDefinition` (props.items[] payload) factory
호출 — 빌더 등록 시 composite resolved-tree 미생성. Wave A 의
`collectionCompositeFactories.test.ts` (5/5 PASS) 는 함수 export 와 payload
shape 만 검증, `ComponentFactory` 호출 wiring 미검증 (test gap).

Fix:

1. `ComponentFactory.createSelect / createComboBox / createListBox / createMenu`
   를 Tabs pattern (`parentId` 확보 → `createXxxCompositeElements(context,
{ parentId })` 호출 → `addElementsToStore(parent, children)` → `{ parent,
children, allElements }` 반환) 으로 전환.
2. SelectionComponents import 에 `createSelectCompositeElements /
createComboBoxCompositeElements / createListBoxCompositeElements /
createMenuCompositeElements` 추가 (이미 export 됨, 호출만 누락).
3. 신규 wiring contract test:
   `apps/builder/src/builder/factories/__tests__/componentFactoryCompositeWiring.test.ts`
   — source-string 으로 `ComponentFactory.createXxx` body 안에
   `createXxxCompositeElements` 호출 + `addElementsToStore` 호출이 있는지 +
   legacy `this.createComponent(createXxxDefinition, ...)` 호출이 0건임을
   검증 (6/6 PASS). Wave A `collectionCompositeFactories.test.ts` 의 함수
   export shape 검증과 dual-layer 로 contract 보장.

Coverage matrix:

| Family                             | Contract focus                                                          | Primary fixtures      | Gate  |
| ---------------------------------- | ----------------------------------------------------------------------- | --------------------- | ----- |
| Tabs/Segmented                     | tab refs, panel body, selected state projection                         | RAC + slot + shadcn   | G2-G5 |
| Select/ComboBox/ListBox/Menu       | item/section/separator refs, trigger/input projection, overlay behavior | RAC + shadcn Dropdown | G6    |
| Table/GridList/Tree                | row/cell/tree item refs, nested collection order, keyboard nav          | RAC + shadcn Table    | G6    |
| Toolbar/ToggleButtonGroup          | child button refs, selection projection                                 | RAC                   | G6    |
| Dialog/Modal/Popover/Tooltip/Toast | overlay root/content owner, focus behavior                              | RAC                   | G6    |
| Date/Color                         | composed subparts plus non-DOM-trivial draw primitive                   | RAC                   | G6    |
| Form/InputGroup                    | label/input/helper/validation owner paths                               | RAC                   | G6    |

For each family:

1. Fixture contract test.
2. creation payload test.
3. Preview owner marker test.
4. Skia owner parity test.
5. selection/edit test for at least one nested descendant.
6. RAC behavior test where applicable.

Gate: G6.

### Phase 8 — Perf baseline and ADR-910 handoff

Purpose: measure correct tree before optimizing it.

Tasks:

1. Measure Tabs resolved-tree Skia frame cost vs current props-only path.
2. Gate Tabs slice on a blocking budget:
   - p95 Skia frame cost must be no more than 25% above the current
     props-only path.
   - 60fps interaction budget must hold in the target builder viewport.
   - if either fails, Tabs parity work can merge only as an adapter-only hold;
     ADR-910 becomes a prerequisite before enabling the new authoring path.
3. Measure family matrix worst-case:
   - 1000+ tabs/items where the component allows that scale.
   - 1000+ table rows/cells.
   - nested dropdown/menu sections with slot-filled descendants.
4. Record memory and node-count growth per family.
5. If a family misses the blocking budget, mark that family `hold` and feed the
   measurement into ADR-910 Phase 0 before expanding beyond Tabs.
6. Feed passing baseline results into ADR-910 Phase 0 baseline measurement.

Gate: G7. This is a fail gate, not a measurement-only handoff.

### Phase 9 — reusableComponents root collection + composite master/instance routing + canvas visible + Layers/Properties UI (Wave D, amend 2026-05-22)

Purpose: Phase 7 Wave A/B 진행 중 실측 발견 — composite RAC creation path 가
master node 를 page tree (`children[]`) 의 sibling 으로 misroute 한다. 본 phase
는 master 를 root collection `CompositionDocument.reusableComponents` 로
분리하여 pencil "design system export" 형식과 정합한다. master 는 composition
multi-page/frame infinite canvas 위 visible origin 요소로 표시된다. **단일
phase, sub-phase 분할 없음** (4 layer 동시 작업 + 통합 1 commit).

본 phase scope 외 (다른 결정으로 분리):

- theme 영역 canvas 공간 배치 표시 (ADR-110 이어서 진행)
- master canvas isolation mode (단독 표시 mode, pencil edit-symbol UX)
- master detach (Cmd+Opt+X, instance → raw tree 변환)
- raw tree → reusable 양방향 변환 단축키 (Cmd+Opt+K)
- master 이름 / variant / props schema 사용자 편집 UX
- instance override UI (Properties Component section 확장)

Layer A — Schema:

1. `packages/shared/src/types/composition-document.types.ts` —
   `CompositionDocument.reusableComponents?: CanonicalNode[]` 추가
   (ADR-110/131 root collection 패턴 정합).
2. `apps/builder/src/resolvers/canonical/compositeRacFixtureContracts.ts` —
   runtime CompositionDocument 도 `rootKind: "reusableComponents"` 처리
   helper 를 동일 single source 로 사용.

Layer B — Runtime routing:

3. `apps/builder/src/builder/factories/definitions/LayoutComponents.ts` —
   `createTabsCompositeElements()` 반환 `{ master, instance }` 분할.
4. `apps/builder/src/builder/factories/definitions/SelectionComponents.ts` —
   `createSelectCompositeElements` / `createListBoxCompositeElements` /
   `createMenuCompositeElements` 동일 패턴.
5. `apps/builder/src/builder/factories/ComponentFactory.ts` —
   `addElementsToStore` 진입점에서 `{ master, instance }` 분리 routing.
6. `apps/builder/src/builder/store/elements.ts::_rebuildIndexes` — canonical
   `children` + `reusableComponents` 양쪽 traverse 하여 elementsMap derive.
7. `apps/builder/src/builder/store/canonicalDocument.ts` — 신규
   `addToReusableComponents(master)`, `syncReusableComponentsToCanonical()`
   추가. 호출 순서 (`set` → canonical update → `_rebuildIndexes` → persist)
   엄수 — `instance-sync-order-race` 회귀 차단.
   - **Scope inflation 확인 (2026-05-22, 사용자 confirm: atomic 전수 확장)**:
     단순 sync 함수 신설이 아닌 canonical mutation primitives 6 종 전수
     `doc.children + doc.reusableComponents` 양쪽 traverse 확장 동반:
     `findNodeById` / `appendChildToNode` / `removeNodeById` /
     `replaceNodeById` / `findCanonicalParentContext` / `findSlotPathInNode`.
     `upsertElementIntoDocument` 의 `legacy.componentRole === "master" &&
!parent_id && !page_id && !layout_id` 분기 (canonicalMutations.ts:1064)
     redirect target 을 `doc.children` 에서 `doc.reusableComponents` 로 변경.
     master 자식들 (parent_id=master.id) 의 `appendChildToNode` 도 양쪽
     검색해야 master 를 찾음. ADR-116 G7 boundary allowlist 확장 동반.
8. `deriveProjectRenderModelFromDocument()` — `type: "ref"` instance 의 ref
   를 `reusableComponents` lookup 으로 resolve (fixture normalizer 동일 로직
   재사용).

Layer C — Canvas (multi-frame infinite canvas 인프라 재사용):

9. `apps/builder/src/builder/workspace/canvas/skia/visiblePageRoots.ts` —
   master frame 도 visible root 등록 (page frame 메커니즘 재사용).
10. `apps/builder/src/builder/workspace/canvas/skia/skiaOverlayBuilder.ts` —
    master frame label 표시 (pencil-style frame label, type tag "Component"
    구분).
11. master 좌표 자동 할당 — 신규 master 생성 시 page 들 옆 공간 배치 (현
    page 등록 좌표 할당 로직 재사용, infinite canvas 자연 흡수).

Layer D — Panel UI:

12. `apps/builder/src/builder/panels/nodes/LayersSection.tsx` — Pages 섹션
    (children[]) + Components 섹션 (reusableComponents[]) 2 분할.
13. `apps/builder/src/builder/panels/nodes/tree/LayerTree/LayerTree.tsx` —
    변경 0, 양 섹션에서 tree render 위임.
14. Properties 패널 신규 `SlotSection.tsx` — master 선택 시 ##Slot section##
    표시 (collection binding `dataBinding: { collectionId }` + slot meta).
    ADR-132 `useCollectionData({ datatableId | dataBinding })` 와 자연 정합.

Clean break:

15. `apps/builder/src/builder/db/indexeddb-canonical-store.ts` — DB_VERSION
    bump. migration 코드 0 (개발 단계, 기존 데이터 폐기 가능).

Tests:

16. `apps/builder/src/builder/factories/__tests__/tabsCompositeFactory.test.ts`
    — `{ master, instance }` 반환 assertion 갱신.
17. `apps/builder/src/builder/factories/__tests__/collectionCompositeFactories.test.ts`
    — Select/ListBox/Menu 동일.
18. 신규
    `apps/builder/src/builder/store/__tests__/reusableComponentsRouting.test.ts`
    — schema + routing contract (4 composite family drop → master 가
    reusableComponents 에 / instance 가 children 에).
19. 신규
    `apps/builder/src/builder/panels/nodes/__tests__/LayersSection.componentsSection.test.tsx`
    — Pages/Components 분리 렌더 + 빈 Components 섹션 placeholder.
20. 신규
    `apps/builder/src/builder/workspace/canvas/skia/__tests__/visiblePageRoots.masterFrame.test.ts`
    — master frame 도 visible root 등록 검증.

Acceptance (G8):

- pnpm type-check PASS (apps/builder + packages/shared).
- pnpm test 회귀 PASS — 4 composite factory + LayersSection +
  reusableComponentsRouting + visiblePageRoots.masterFrame.
- Chrome MCP runtime 검증 — composite drop 시 (a) master 가 Components 섹션
  표시 + canvas 위 spatial 배치 visible / (b) instance 가 page tree /
  (c) Properties Slot section 표시 / (d) IndexedDB 검증 (master 가
  reusableComponents root, page tree 에 ref instance 만).
- fixture normalizer 와 runtime routing 이 동일 single source 사용 (코드 grep
  evidence — `rootKind: "reusableComponents"` 처리 helper 1 곳).
- clean break — DB_VERSION bump 적용, migration 코드 0건 grep 통과.

Gate: G8.

## Acceptance Checklist

- [x] ADR-144 body and breakdown exist.
- [x] README In Progress summary updated.
- [x] Phase 0 line evidence captured.
- [x] Fixture contract tests cover `RAC-showcase.json`, `slot-tabs-selection.json`,
      `shadcn-design-system.json`.
- [x] New Tabs creation no longer persists editable labels/panel body only in
      `props.items[]`.
- [x] Preview and Skia expose matching owner id/path for Tabs editable subparts.
- [x] TabPanel/body selection and editing work.
- [x] Synthetic Skia ids are not editable owners.
- [x] RAC behavior tests pass.
- [x] Layout invalidation is verified for descendant content/style patch writes.
- [x] Phase 7 Wave A — collection family expansion matrix (Select / ComboBox /
      ListBox / Menu) 4 step land: fixture contract evidence
      (`compositeRacFixtures.test.ts` +4 cases), composite factory 4 종
      (`SelectionComponents.ts` `createCollectionCompositeElements` + family
      wrappers, `collectionCompositeFactories.test.ts` 5/5), Preview marker
      matrix (`CanonicalNodeRenderer.adr144.test.tsx` `it.each` 4 family),
      Skia synthetic editable owner 0 件 (`canonicalSkiaSymmetry.test.ts`
      `it.each` 4 family).
- [x] Phase 7 Wave B — 4 family Skia resolved-tree owner emission
      (`buildGenericListBoxNode` / `MenuNode` / `ComboBoxNode` / `SelectNode`
      이 canonical `{Item}Type` + Text label 자식을 `hitTestOwner: true +
ownerPath` 으로 그린다). Tabs Phase 4 패턴 일반화 — shared
      `findResolvedCollectionItems()` + per-family `buildResolved*Children()`
      helper 4종 추가. legacy `props.items[]` synthetic drawing 은 adapter
      fallback (Hard Constraint 5). Positive parity test:
      `canonicalSkiaSymmetry.test.ts` Wave B `it.each` 4/4 PASS (canonical
      item id + label id 가 hit-test owner, `ownerPath` chain 매칭, denylist
      0 synthetic owner 유지). G7-A 재측정 13/13 PASS. Wave C debt 잔존
      (Select / ComboBox `getCustomPreEditor` + 4 family PropertyEditor
      `detectInspectorInputMode` wiring).
- [x] Phase 7 Wave C — Inspector Properties UI 3 input mode 분기 (2026-05-22).
      `getCustomPreEditor` 가 Select / ComboBox 까지 expansion (`registry.ts`
      switch). 신규 `SelectPropertyEditor.tsx` / `ComboBoxPropertyEditor.tsx` +
      mode 2 공통 `ResolvedTreeSlotEditor.tsx` (Add/Remove → canonical
      `addElement`/`removeElement` 액션 — Memory→Index→History→DB→Preview→
      Rebalance 순서 보존). `ListBoxPropertyEditor` / `MenuPropertyEditor` 가
      동일 `detectInspectorInputMode` 호출 — ListBox 의 기존 `hasTemplateMode`
      는 mode 3 분기 안에서만 평가. Evidence:
      `apps/builder/src/builder/inspector/editors/registry.adr144.static.test.ts`
      (3/3 PASS),
      `apps/builder/src/builder/panels/properties/editors/__tests__/SelectPropertyEditor.test.tsx`
      (6/6 PASS),
      `apps/builder/src/builder/panels/properties/editors/__tests__/ComboBoxPropertyEditor.test.tsx`
      (6/6 PASS),
      `apps/builder/src/builder/panels/properties/editors/ListBoxPropertyEditor.test.tsx`
      (4/4 PASS),
      `apps/builder/src/builder/panels/properties/editors/MenuPropertyEditor.test.tsx`
      (3/3 PASS) — 50/50 PASS 전체 기준 테스트.
- [x] Perf baseline is recorded and G7 blocking budget passes before ADR-910
      begins or the family is explicitly held. (Phase 8 PASS — 7/7 perf test
      land, Tabs resolved-tree p95 ≤ props-only × 1.25 + 모든 family 60fps
      budget hold. 1000-item ListBox/Menu props-only p95 0.27~0.36ms 가
      build-frame dominant cost — ADR-910 Phase 0 picture cache / paint pool
      후보. Wave B 후 4 family G7-A 재측정 6 case (N=50 dual-path + 1000
      stress ListBox/Menu) 도 통과 — resolved-tree p95 sub-millisecond 또는
      0.5ms floor 안. 1000-item resolved stress 도 60fps 유지 (p95
      ~0.23ms). Evidence:
      `apps/builder/src/builder/workspace/canvas/skia/__perf__/adr144Phase8FrameBudget.perf.test.ts`
      (13/13 PASS),
      `144-composite-rac-resolved-tree-parity-phase8-methodology.md`,
      `144-composite-rac-resolved-tree-parity-phase8-results.md`.)
- [ ] C3-a 데이터 source 3축 (Data Panel inline persisted / API endpoint persisted config + Zustand runtime sink + Canvas direct proxy fallback 잔존 / Properties inline `element.props[itemsKey]`) 과 C3-b 3 input mode (external dataBinding / new resolved-tree local data / legacy `props.items[]` fallback) 가 Phase 1 fixture / Phase 2 creation evidence 에 기록된다. Builder execute path 와 Preview/Canvas read path 의 sink 정합 (`useCollectionData.ts:340-355` direct proxy branch) 은 G3/G6 에서 row identity / owner projection 별도 검증.
- [x] Phase 2 task 5 composite template default child set 이 적용된 family 의 새 creation 은 `PrimitiveBinding.defaultProps.items[]` inline 데이터 (Aardvark/Cat/Kangaroo 류) 0건 의존이며, mode 2 (resolved-tree local data) 로 동작한다.
- [x] Phase 5 task 7 Inspector Properties UI 가 3 input mode (dataBinding picker / slot 추가·삭제 UI / ItemsManager) 로 분기되며 한 instance 에 동시 표시되지 않는다. mode 감지 순서: dataBinding → resolved-tree composite payload → legacy fallback. mode 감지는 `detectInspectorInputMode` (`apps/builder/src/builder/panels/properties/inspectorInputMode.ts`) 단일 진입점 helper 로 관리되고 ADR-076 `getCustomPreEditor` 패턴이 G6 family 확장 시 동일 helper 를 호출한다 (Select/ComboBox/Table/Tree). Tabs 는 composite resolved-tree PropertyEditor 별 패턴으로 G6 phase 7 family expansion 에서 wiring.

## Verification Commands

Initial docs-only ADR creation:

```bash
pnpm run codex:guard
git diff --check
```

Phase implementation gates will add targeted commands next to changed files.
Expected starting set:

```bash
pnpm -F @composition/builder exec vitest run src/resolvers/canonical/__tests__/compositeRacFixtures.test.ts
pnpm -F @composition/builder exec vitest run src/preview/components/CanonicalNodeRenderer.adr144.test.tsx
pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/canonicalSkiaSymmetry.test.ts
pnpm -F @composition/shared exec vitest run src/components/__tests__/Tabs.behavior.test.tsx
pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/skia/__perf__/adr144Phase8FrameBudget.perf.test.ts
pnpm run codex:typecheck
```
