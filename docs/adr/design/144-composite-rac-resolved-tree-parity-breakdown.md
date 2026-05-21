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

### Phase 0 — Baseline and evidence freeze

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

### Phase 1 — Contract fixture tests

Purpose: prove current canonical format can express the target structure without
schema changes.

Tasks:

1. Add fixture parser/normalizer for JSON export shape differences:
   - `children` root shape from RAC showcase.
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
- `apps/builder/src/resolvers/canonical/__fixtures__/rac-showcase.tabs.json`
- `apps/builder/src/resolvers/canonical/__fixtures__/slot-tabs-selection.json`
- `apps/builder/src/resolvers/canonical/__fixtures__/shadcn-slots.json`

### Phase 2 — Tabs authoring model

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

### Phase 3 — Preview resolved-tree projection

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

### Phase 4 — Skia resolved-tree drawing and hit-test ownership

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

### Phase 5 — Selection and editing

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

### Phase 6 — RAC behavior tests

Purpose: keep behavior under RAC, not composition-drawn imitations.

Tasks:

1. Tabs behavior tests:
   - Arrow key changes focused tab.
   - activation policy follows `keyboardActivation`.
   - selected tab/panel relation remains valid.
2. Add official React Aria testing pattern references for collection families.
3. Keep behavior tests separate from Skia visual tests.

Gate: G5.

Likely files:

- `packages/shared/src/components/__tests__/**`
- `apps/builder/src/preview/components/**.test.tsx`

### Phase 7 — Family expansion matrix

Purpose: apply the same contract beyond Tabs.

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

## Acceptance Checklist

- [ ] ADR-144 body and breakdown exist.
- [ ] README Proposed row and counts updated.
- [ ] Phase 0 line evidence captured.
- [ ] Fixture contract tests cover `RAC-showcase.json`, `slot-tabs-selection.json`,
      `shadcn-design-system.json`.
- [ ] New Tabs creation no longer persists editable labels/panel body only in
      `props.items[]`.
- [ ] Preview and Skia expose matching owner id/path for Tabs editable subparts.
- [ ] TabPanel/body selection and editing work.
- [ ] Synthetic Skia ids are not editable owners.
- [ ] RAC behavior tests pass.
- [ ] Layout invalidation is verified for descendant content/style patch writes.
- [ ] Perf baseline is recorded and G7 blocking budget passes before ADR-910
      begins or the family is explicitly held.
- [ ] C3-a 데이터 source 3축 (Data Panel inline persisted / API endpoint persisted config + Zustand runtime sink + Canvas direct proxy fallback 잔존 / Properties inline `element.props[itemsKey]`) 과 C3-b 3 input mode (external dataBinding / new resolved-tree local data / legacy `props.items[]` fallback) 가 Phase 1 fixture / Phase 2 creation evidence 에 기록된다. Builder execute path 와 Preview/Canvas read path 의 sink 정합 (`useCollectionData.ts:340-355` direct proxy branch) 은 G3/G6 에서 row identity / owner projection 별도 검증.
- [ ] Phase 2 task 5 composite template default child set 이 적용된 family 의 새 creation 은 `PrimitiveBinding.defaultProps.items[]` inline 데이터 (Aardvark/Cat/Kangaroo 류) 0건 의존이며, mode 2 (resolved-tree local data) 로 동작한다.
- [ ] Phase 5 task 7 Inspector Properties UI 가 3 input mode (dataBinding picker / slot 추가·삭제 UI / ItemsManager) 로 분기되며 한 instance 에 동시 표시되지 않는다. mode 감지 순서: dataBinding → resolved-tree composite payload → legacy fallback. ADR-076 `getCustomPreEditor` 패턴이 G6 family 확장 시 동일 패턴으로 적용되며 (Select/ComboBox/Table/Tree), Tabs 는 composite resolved-tree PropertyEditor 별 패턴으로 wiring.

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
pnpm run codex:typecheck
```
