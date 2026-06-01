# ADR-920 Breakdown: RAC Format Interactive Projected Tree

## 1. 목표

RAC starter 기반 컴포넌트를 Builder의 Skia editor에서 Pencil App 방식으로 사용할 수
있는 format architecture를 정의한다. 이 문서는 `ComponentSpec`/`render.shapes()` 계열
설계를 확장하지 않고, RAC starter와 Pencil format JSON에서 직접 schema와 renderer contract를
도출한다.

핵심 목표:

- Button, ListBox, Table의 first proof.
- `ComponentSpec`/`render.shapes()`가 아닌 `FormatCapabilityRegistry` +
  `RacFormatDefinition` + format document를 SSOT로 사용.
- schema 결정 기준은 `packages/react-aria-starter/src`와 Pencil format JSON으로 제한.
- Preview, Publish, Style Panel, Properties Panel, Skia가 같은 resolved value를 읽음.
- layout/style/size/color/typography는 component별 중복 schema가 아니라 공통
  `FormatCapabilityRegistry`에서 읽음.
- Pencil `frame`을 semantic-free layout/container primitive로 유지하고, RAC component는
  이 frame contract를 root part 또는 명시적 child frame으로 재사용.
- collection은 `items`/`rows` 데이터와 별개로 Pencil식 template tree를 유지.
- Skia는 visible rows/cells만 렌더링하지만, 보이는 projection은 클릭/더블클릭 가능한
  tree로 노출.
- 기존 Builder의 data root store, page frame Slot projection, events/actions extension,
  ref instance override semantics는 새 format core에 섞지 않고 integration boundary로 연결.

### 1.1 Clean Source Boundary

ADR-920의 source hierarchy:

1. `FormatCapabilityRegistry`: layout, sizing, spacing, typography, appearance, border,
   effects의 공통 property vocabulary와 token mapping의 SSOT.
2. `RacFormatDefinition`: RAC prop/state/slot vocabulary, part binding, capability allow-list의
   SSOT.
3. `FormatDocument`: user-authored props/style/tree와 collection reference/static seed의 SSOT.
4. `ResolvedFormatRuntime`: 모든 consumer가 읽는 resolved value surface.
5. Consumer adapters: Preview/Publish/Panel/Skia로 값을 전달하는 read-only projection.
6. Composition integration extension: 기존 Builder의 data binding, page frame binding,
   events/actions, internal icon primitive, origin/instance edit semantics와 연결되는 bridge.

금지:

- `ComponentSpec`/`render.shapes()`에서 RAC format schema를 역추론하지 않는다.
- pre-ADR-920 ListBox/Table renderer의 shape를 새 format node shape로 복사하지 않는다.
- Skia-only hit target이나 Panel-only field를 canonical format node에 저장하지 않는다.
- compatibility layer가 `RacFormatDefinition`보다 높은 우선순위를 갖지 않는다.
- `display:flex`, `gap`, `fontSize`, `color`, `size` 같은 style/layout 개념을 Button,
  ListBoxItem, Tabs, Table cell마다 별도 schema로 반복하지 않는다.
- CSS `display:flex`/`flexDirection`을 canonical format field로 저장하지 않는다. canonical
  layout은 Pencil `frame.layout: "horizontal" | "vertical" | "none"`이며 CSS는 Preview/Publish
  adapter 산출물이다.
- root `collections`/`apiEndpoints`/`variables`와 별개로 node-local API/data store를 새로 만들지
  않는다. format node의 collection field는 static seed 또는 existing binding reference만 저장한다.
- `events`, `actions`, `dataBinding`은 RAC/Pencil core props에 흡수하지 않는다. composition-only
  behavior는 extension namespace 또는 root behavior collection으로 남긴다.
- `Icon`/`icon_font`는 RAC primitive가 아니며, clean-source 예외 목록에 둔 internal primitive다.
  예외는 text/icon child projection을 위해 필요한 최소 primitive로 제한한다.

### 1.2 Pencil Frame Contract

Pencil MCP schema와 `docs/migrations/shadcn-design-system.json`을 확인한 결과 `frame`은
아래 계약을 가진다.

- `frame`은 graphics(`fill`, `stroke`, `cornerRadius`, effects), size/position,
  `children`, layout을 함께 갖는 container다.
- layout grammar는 CSS가 아니라 `layout: "horizontal" | "vertical" | "none"`,
  `gap`, `padding`, `justifyContent`, `alignItems`다.
- `clip`, `slot`, `reusable`이 frame에 붙는다. reusable frame은 component/symbol이 되고,
  `ref` + `descendants`로 instance override가 이뤄진다.
- only-frame layout rule을 ADR-920 format에 그대로 복제하지는 않더라도, RAC component의
  layout host는 반드시 같은 frame contract를 사용해야 한다. 즉 `rac.listbox.item`,
  `rac.tabs`, `rac.table.cell`이 별도 layout grammar를 만들 수 없다.

Pencil export 근거:

- Sidebar/Button 같은 reusable component root가 `type:"frame"`이고 `fill`, `gap`,
  `padding`, `reusable`을 직접 가진다:
  `docs/migrations/shadcn-design-system.json:1419`, `:1420`, `:1421`, `:1425`, `:1429`, `:1430`.
- Tabs와 Table도 slot-capable reusable frame이다:
  `docs/migrations/shadcn-design-system.json:3741`, `:3744`, `:3745`, `:5299`, `:5302`, `:5313`.

## 2. 비목표

- 모든 RAC family 일괄 cutover.
- `packages/specs`/ComponentSpec compatibility 설계.
- row 전체 canonical materialization.
- nested interactive child가 많은 Table/GridList 고급 패턴의 첫 phase 완성.
- variable-height virtualizer의 모든 edge case 해결.

## 3. 전체 아키텍처

```text
packages/react-aria-starter/src
  └─ RAC starter reference
      └─ RacFormatDefinition registry
          ├─ props schema
          ├─ parts/slots schema
          ├─ semantic state/variant/size mapping
          ├─ shared style capability bindings
          ├─ collection projection contract
          └─ consumer mapper contracts

FormatCapabilityRegistry
  ├─ frame layout: horizontal/vertical/none
  ├─ sizing: width/height/min/max + semantic control scales
  ├─ spacing: padding/gap
  ├─ typography: font/line/letter/text alignment
  ├─ appearance: fill/color/opacity
  └─ border/effects: radius/stroke/shadow/filter

FormatDocument
  ├─ variables / themes
  └─ children[]
      ├─ frame
      ├─ rac.button
      ├─ rac.listbox
      │   └─ rac.listbox.item template subtree
      └─ rac.table
          ├─ header tree
          └─ row template subtree

ResolvedFormatRuntime
  ├─ resolveEffectiveStyle()
  ├─ resolveTemplateLayout()
  ├─ projectCollectionWindow()
  ├─ toRacProps()
  ├─ toPanelSchema()
  └─ toSkiaCommandPlan()

Consumers
  ├─ Style & Properties Panel
  ├─ Preview iframe RAC renderer
  ├─ Publish RAC renderer
  └─ Skia Builder
      ├─ draw command tree
      ├─ hit-test tree
      ├─ selection/drill-in
      └─ edit route mapper
```

### 3.1 현재 구현 대비 Before/After 분석

이 비교의 "Before"는 2026-06-01 현재 코드 기준이다. 핵심은 현재 구현이 이미
Pencil식 `children[]`/`ref`/`descendants` 형식과 일부 RAC catalog 경로를 갖고 있지만,
Button/ListBox/Table의 실제 read source가 아직 `ComponentSpec`, generated component rules,
`PrimitiveBinding`, wrapper, Skia `render.shapes()`로 분산되어 있다는 점이다.

#### 현재 구현 다이어그램

```text
CompositionDocument
  ├─ children[] / props / ref / descendants
  ├─ tokens / componentRules
  ├─ root data store: collections / apiEndpoints / variables
  ├─ root behavior store: events / actions
  ├─ page frame binding / projected Slot mirror
  │
  ├─ Properties Panel
  │   ├─ catalog cutover: PrimitiveBinding.props.accepts
  │   └─ fallback: ComponentSpec.properties.sections
  │
  ├─ Style Panel
  │   └─ TAG_SPEC_MAP / ComponentSpec-derived context
  │
  ├─ Preview
  │   ├─ CanonicalNodeRenderer
  │   ├─ PrimitiveBinding.toRacProps
  │   └─ internal wrappers: ListBox.tsx / Table.tsx / Button.tsx
  │
  └─ Skia
      ├─ buildSpecNodeData()
      ├─ if isCatalogSkiaCutover(type): buildCatalogShapes()
      └─ else: ComponentSpec.render.shapes()
          ├─ ListBox: shell only
          ├─ ListBoxItem: flattened row shapes
          └─ Table: rows x columns shapes loop
```

#### ADR-920 이후 다이어그램

```text
RAC starter + Pencil format JSON
  ├─ FormatCapabilityRegistry
  │   ├─ frame layout / sizing / spacing
  │   ├─ typography
  │   └─ appearance / border / effects
  └─ RacFormatDefinition registry
      ├─ props / slots / parts
      ├─ semantic props -> shared capability patches
      ├─ part-level capability allow-list
      └─ collection projection contract

FormatDocument
  ├─ variables / themes
  ├─ integration refs: dataBinding / events / actions / pageFrameBinding
  └─ children[] template tree
      ├─ frame layout containers
      ├─ rac.button
      │   └─ text label node
      ├─ rac.listbox
      │   └─ rac.listbox.item template subtree
      └─ rac.table
          └─ rac.table.row / cell / text template subtree

ResolvedFormatRuntime
  ├─ resolveEffectiveStyle()
  ├─ resolveTemplateLayout()
  ├─ projectCollectionWindow()
  ├─ toPanelSchema()
  ├─ toRacProps() / toRacChildren()
  └─ toSkiaCommandPlan()

Consumers
  ├─ Properties Panel: definition props + selection route
  ├─ Style Panel: resolved style fields + edit route
  ├─ Preview/Publish: RAC primitives from same format tree
  └─ Skia: visible-only draw tree + hit-test tree + drill/edit routes
```

#### 전체 Before/After 표

| 축                      | Before: 현재 구현                                                                                                                                           | After: ADR-920 계획                                                                                                     | 차이/판정                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 규범 입력               | `CompositionDocument`는 Pencil 호환 필드를 갖지만, RAC component 시각/props는 `ComponentSpec`, generated `componentRules`, `PrimitiveBinding`에 분산된다.   | `packages/react-aria-starter/src`와 Pencil format JSON에서 `RacFormatDefinition`을 직접 도출한다.                       | 기존 spec 파생값을 새 schema 결정 근거로 쓰지 않는 clean-source 전환.          |
| 저장 tree               | `CanonicalNode.children[]`, `ref`, `descendants`, `slot`은 존재한다.                                                                                        | 같은 철학을 유지하되 `rac.*` format node와 collection template subtree를 명시한다.                                      | 저장 구조는 활용 가능하지만 component vocabulary는 새로 정의해야 한다.         |
| Frame/container model   | 현재 RAC component는 spec `containerStyles` 또는 wrapper 구조로 layout container 역할을 반복 정의한다.                                                      | Pencil `frame` contract를 first-class primitive로 두고, RAC root/part는 같은 frame layout grammar를 재사용한다.         | layout host와 RAC semantics를 분리해 중복을 줄인다.                            |
| Layout/style vocabulary | `display`, `flexDirection`, `gap`, `fontSize`, color, size metric이 component spec과 wrapper별로 반복 정의된다.                                             | canonical format은 `layout`/`gap`/`padding`/`fill`/`fontSize`를 공통 capability로 저장하고 CSS는 adapter가 생성한다.    | ListBoxItem/Tabs/Table cell로 깊어져도 같은 layout/style resolver를 사용한다.  |
| Button                  | `ButtonSpec`은 props/variants/sizes/render shapes를 갖고, `buttonBinding`은 RAC Button props 일부를 catalog로 투영한다.                                     | `rac.button` definition이 props, parts, size, state, visual을 모두 제공하고 label text도 child node가 된다.             | Button은 가장 가까운 proof지만, 현재는 spec과 binding이 병존한다.              |
| ListBox DOM             | wrapper가 RAC ListBox/ListBoxItem을 렌더하고, data binding 또는 `items`를 처리한다.                                                                         | Preview/Publish mapper가 format template tree에서 RAC children render function을 생성한다.                              | wrapper logic을 format adapter로 흡수해야 한다.                                |
| ListBox Skia            | ListBox shell은 `ListBoxSpec.render.shapes()`, data rows는 projected `ListBoxItem` scene node가 `ListBoxItemSpec.render.shapes()`로 flattened row를 그린다. | visible row마다 template subtree를 복제하지 않고 projected tree로 materialize해 Text/Icon까지 hit-test 가능하게 만든다. | 현재는 row leaf projection, ADR-920은 deep projected tree.                     |
| Table Skia              | `TableSpec.render.shapes()`가 `rows.forEach` x `columns.forEach`로 모든 cell shape를 직접 만든다.                                                           | row/column viewport culling 후 row/cell/text projected tree만 Skia plan에 올린다.                                       | 현재 Table은 data-visual 결합형 루프, ADR-920은 template + visible projection. |
| Virtualization          | DOM ListBox는 virtual rows를 사용한다. Skia ListBox projection은 source rows를 window limit 100으로 자른다. Table Skia는 rows 전체를 순회한다.              | Skia draw tree와 hit tree 모두 viewport window + overscan 이하만 materialize한다.                                       | `slice(0, 100)`은 viewport virtualization이 아니다.                            |
| Layer Tree              | ListBox는 `Rows` virtual group 아래 row leaf를 표시한다. row 하위 label/description/icon은 tree node가 아니다.                                              | Template subtree와 visible projected Rows를 모두 표시하고, row 아래 Text/Icon/Cell까지 tree로 노출한다.                 | 깊은 하위 노드 접근성이 현재 핵심 gap.                                         |
| Click/Double-click      | listbox-row projection 클릭은 canonical ListBox 선택으로 redirect된다. projected child selection은 없다.                                                    | click은 deepest projected node 선택, double-click은 row drill-in 또는 data text edit route로 분기한다.                  | current selection guard는 안전하지만 editor surface 요구를 만족하지 못한다.    |
| Mutation boundary       | projected render id guard가 canonical mutation boundary에 있다.                                                                                             | guard를 유지하되 write route를 template/data/override로 명시한다.                                                       | 기존 guard는 재사용 가능, edit route registry는 신규 필요.                     |
| Properties Panel        | catalog cutover type은 `PrimitiveBinding.props.accepts`, fallback은 `ComponentSpec.properties.sections`를 읽는다.                                           | `RacFormatDefinition.props`에서 panel schema를 생성한다.                                                                | panel read source를 하나로 줄인다.                                             |
| Style Panel             | `TAG_SPEC_MAP`/spec context가 style auxiliary와 fallback의 기준이다.                                                                                        | `FormatCapabilityRegistry` + `ResolvedFormatRuntime`의 style field와 edit route를 기준으로 표시한다.                    | style source가 spec registry에서 format resolver로 이동한다.                   |
| Preview/Publish         | Preview는 catalog/internal wrapper와 legacy renderer가 병존한다. Publish도 별도 compatibility boundary가 필요하다.                                          | Preview/Publish 모두 `FormatDocument` + capability/definition registry만 읽어 RAC element tree를 만든다.                | Skia-only/Preview-only split 제거가 목표.                                      |
| Data SSOT               | `DataTablePanel`/root collections/apiEndpoints/variables가 data 권위이고 element `dataBinding`은 reference다.                                               | format collection field는 static seed 또는 binding reference이며 root data store를 중복하지 않는다.                     | node-local `data`가 새 SSOT가 되면 기존 data panel과 충돌한다.                 |
| Page Frame/Slot         | page frame binding이 frame body layout을 page render pipeline에 합성하고 projected Slot은 drop/mutation target으로 변환된다.                                | `frame` primitive는 page frame binding bridge와 Slot fill projection route를 같이 정의한다.                             | generic frame만 정의하면 현재 page-applied frame 기능이 깨진다.                |
| Events/Actions          | canonical core 밖 root events/actions 또는 `x-composition` extension이 behavior를 가진다.                                                                   | RAC callback은 extension/root action dispatcher로 bridge하고 JSON에는 function을 저장하지 않는다.                       | visual-only format으로 가면 current interaction 기능이 누락된다.               |
| Internal Icon primitive | `Icon`은 RAC primitive가 아니라 Lucide 기반 internal renderer이고 Skia는 `icon_font` path를 사용한다.                                                       | `icon_font`는 clean-source 예외인 internal primitive로 명시하고 slot child/hit target으로 취급한다.                     | 예외를 숨기면 clean-source 원칙과 ListBoxItem slot tree가 충돌한다.            |

#### ListBox tree Before/After

```text
Before: current ListBox projection

ListBox (canonical)
├─ ref/ListBoxItem template anchor
│  └─ origin children are suppressed in visible scene
└─ Rows (virtual group)
   ├─ ListBoxItem projection row: Aardvark
   │  └─ no child tree, row renderer emits flattened text/icon shapes
   └─ ListBoxItem projection row: Cat
      └─ no child tree, row renderer emits flattened text/icon shapes

Click row -> select ListBox
Style edit -> current route edits ListBox/template indirectly
```

```text
After: ADR-920 interactive projected tree

rac.listbox (canonical format node)
├─ Template
│  └─ rac.listbox.item
│     ├─ icon_font slot=icon
│     ├─ text slot=label bind=item.label
│     ├─ text slot=description bind=item.description
│     └─ pseudo-part selectionIndicator (state-derived, persisted child only when customized)
└─ Rows (visible projected window)
   ├─ Row[item:a]
   │  ├─ Icon projected from template icon slot
   │  ├─ Text projected from template label
   │  ├─ Text projected from template description
   │  └─ SelectionIndicator projected from state part
   └─ Row[item:c]
      ├─ Icon projected from template icon slot
      ├─ Text projected from template label
      ├─ Text projected from template description
      └─ SelectionIndicator projected from state part

Click Text -> select projected Text
Double-click Text -> data edit route
Style edit Text -> template edit route by default
Override this row -> item override route
```

#### 코드 근거 표

| 현재 구현 사실                                                                                                | 근거                                                                                                                                                                                                                                                                                                             | ADR-920 영향                                                                                             |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Canonical document는 `children[]`, `props`, `ref`, `descendants`, `slot`을 이미 갖는다.                       | `packages/shared/src/types/composition-document.types.ts:302`, `:336`, `:352`, `:356`, `:368`, `:420`, `:444`, `:523`                                                                                                                                                                                            | Format document의 tree 철학은 기존 저장 구조와 맞지만, component definition source는 바꿔야 한다.        |
| 현재 component visual rules는 spec에서 build-time 생성된 `componentRules`와 fallback을 전제로 한다.           | `packages/shared/src/types/composition-document.types.ts:495`                                                                                                                                                                                                                                                    | ADR-920은 `RacFormatDefinition`을 read source로 두고 spec-derived schema 유입을 차단해야 한다.           |
| Button은 `ButtonSpec`와 `buttonBinding`이 병존한다.                                                           | `packages/specs/src/components/Button.spec.ts:62`, `packages/shared/src/catalog/bindings/Button.binding.ts:19`                                                                                                                                                                                                   | Button proof는 이중 source를 하나의 definition/resolver로 접는 첫 gate다.                                |
| ListBox catalog는 DOM/Inspector cutover지만 Skia는 `skiaLegacy:true`다.                                       | `packages/shared/src/catalog/componentCatalog.ts:187`, `:197`, `:201`; `packages/shared/src/catalog/bindings/ListBox.binding.ts:8`                                                                                                                                                                               | ADR-920의 핵심은 이 Skia legacy gap을 format-native projected tree로 대체하는 것이다.                    |
| Table catalog도 DOM-only이고 Skia는 legacy `render.shapes()`를 유지한다.                                      | `packages/shared/src/catalog/componentCatalog.ts:257`, `:271`, `:275`; `packages/shared/src/catalog/bindings/Table.binding.ts:8`                                                                                                                                                                                 | Table은 ListBox proof 후 2D row/column culling으로 확장해야 한다.                                        |
| Skia는 catalog cutover 여부에 따라 `buildCatalogShapes` 또는 `spec.render.shapes()`를 호출한다.               | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:1104`                                                                                                                                                                                                                                       | ADR-920에서는 이 분기가 `toSkiaCommandPlan()` consumer로 대체된다.                                       |
| ListBoxSpec parent는 shell만 그리고 row paint는 row projection renderer가 담당한다.                           | `packages/specs/src/components/ListBox.spec.ts:340`                                                                                                                                                                                                                                                              | 현재는 container와 row가 분리됐지만, row 하위 tree는 없다.                                               |
| ListBoxItemSpec은 label/description/icon/check를 flattened shapes로 만든다.                                   | `packages/specs/src/components/ListBoxItem.spec.ts:117`, `:217`, `:244`, `:277`                                                                                                                                                                                                                                  | ADR-920은 이 shape list를 template child tree 기반 command plan으로 바꿔야 한다.                         |
| TableSpec은 rows와 columns 전체를 순회해 shape를 만든다.                                                      | `packages/specs/src/components/Table.spec.ts:275`, `:296`                                                                                                                                                                                                                                                        | visible-only Skia requirement와 직접 충돌하므로 Table phase의 주요 리스크다.                             |
| DOM ListBox는 virtualizer의 visible rows를 렌더한다.                                                          | `packages/shared/src/components/ListBox.tsx:322`, `:346`                                                                                                                                                                                                                                                         | DOM virtualizer 패턴은 참고할 수 있지만 Skia는 별도 viewport window/hit tree가 필요하다.                 |
| Skia/ListBox row projection source는 `slice(0, windowLimit)`이며 기본 limit은 100이다.                        | `apps/builder/src/builder/components/listbox/listBoxRowProjectionModel.ts:1`, `:143`, `:154`                                                                                                                                                                                                                     | limit cap은 viewport culling이 아니므로 ADR-920 G4에서 교체 대상이다.                                    |
| Layer Tree는 ListBox `Rows` group과 row leaf만 만든다.                                                        | `apps/builder/src/builder/layers/listBoxRowProjection.ts:69`, `:79`, `:84`                                                                                                                                                                                                                                       | ADR-920은 row leaf 아래 template child projection까지 만들어야 한다.                                     |
| Canvas scene도 projected row를 `ListBoxItem` node로 만들지만 children 없이 flattened props만 넣는다.          | `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts:521`, `:526`, `:540`, `:557`                                                                                                                                                                                                                 | Skia hit tree가 text/icon/cell 하위 노드를 알 수 없다.                                                   |
| projected ListBox row 클릭은 ListBox 선택으로 redirect된다.                                                   | `apps/builder/src/builder/workspace/canvas/interaction/resolveCanvasInteractionTarget.ts:104`, `:113`                                                                                                                                                                                                            | ADR-920의 click/double-click 하위 접근 요구와 다르다.                                                    |
| projected id는 canonical mutation boundary에서 거부된다.                                                      | `apps/builder/src/adapters/canonical/__tests__/canonicalMutations.projectedIdGuard.test.ts:30`                                                                                                                                                                                                                   | guard는 유지하되 edit route mapper를 추가해야 한다.                                                      |
| Properties Panel은 catalog type이면 `PrimitiveBinding.accepts`, 아니면 `spec.properties.sections`를 사용한다. | `apps/builder/src/builder/panels/properties/generic/GenericPropertyEditor.tsx:47`, `:90`, `:110`                                                                                                                                                                                                                 | ADR-920에서는 panel schema가 definition에서만 나와야 한다.                                               |
| Style Panel context는 `getSpecForTag()`/`TAG_SPEC_MAP`에 기대고 있다.                                         | `apps/builder/src/builder/panels/styles/hooks/useElementStyleContext.ts:1`, `:17`; `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts:31`                                                                                                                                                          | style read source를 capability registry + `ResolvedFormatRuntime`으로 옮겨야 한다.                       |
| 현재 layout invalidation은 `size`, `layout`, `orientation` 같은 공통 prop key와 style key signature를 본다.   | `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts:112`, `:120`, `:121`, `:122`, `:171`, `:174`                                                                                                                                                                                                     | layout/style capability는 component별 schema보다 공통 resolver와 더 잘 맞는다.                           |
| dirty tracking도 color 계열 non-layout, typography 계열 inherited layout을 공통 CSS property로 분류한다.      | `apps/builder/src/builder/stores/utils/elementUpdate.ts:43`, `:44`, `:97`, `:98`, `:102`, `:163`                                                                                                                                                                                                                 | ADR-920은 이 shared property 분류를 format capability registry로 승격해야 한다.                          |
| Button/ListBoxItem/Tabs/TabList는 size, display, flexDirection, gap, fontSize를 각 spec에 반복 정의한다.      | `packages/specs/src/components/Button.spec.ts:270`, `:283`, `:287`, `:290`; `packages/specs/src/components/ListBoxItem.spec.ts:64`, `:65`, `:79`, `:87`, `:93`; `packages/specs/src/components/Tabs.spec.ts:57`, `:148`, `:153`, `:155`; `packages/specs/src/components/TabList.spec.ts:32`, `:46`, `:51`, `:53` | ADR-920은 이 반복을 새 format schema로 가져오지 않고 shared capability + component binding으로 분해한다. |

#### 핵심 gap

| Gap                 | 현재 상태                                                                                        | ADR-920에서 필요한 상태                                                                                                        | 위험                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| SSOT 단일성         | `ComponentSpec`, `PrimitiveBinding`, generated rules, wrapper, Skia shapes가 역할을 나눠 가진다. | `FormatCapabilityRegistry` + `RacFormatDefinition` + `FormatDocument` + resolver만 모든 consumer가 읽는다.                     | HIGH: migration 중 dual source drift.                           |
| 깊은 tree 정합성    | ListBox row는 leaf projection이고 label/description/icon은 shapes 내부 좌표다.                   | projected child Text/Icon/Cell이 tree node와 hit target으로 존재한다.                                                          | HIGH: 구현하지 않으면 사용자의 하위 노드 접근 요구 미충족.      |
| Skia virtualization | ListBox는 first 100 cap, Table은 전체 rows loop.                                                 | viewport window + overscan 기준 draw/hit node만 생성.                                                                          | HIGH: 10k rows에서 Skia 성능 절벽.                              |
| Edit routing        | row projection click은 ListBox로 redirect, projected child edit route 없음.                      | template/data/override route를 명시적으로 선택한다.                                                                            | MED/HIGH: projected id guard와 편집 UX 충돌 가능.               |
| Style duplication   | Button/ListBoxItem/Tabs/TabList가 `display`, `gap`, `fontSize`, size metric을 각자 들고 있다.    | shared capability registry가 Pencil frame `layout`/`gap`/`padding` 의미를 제공하고 component definition은 part binding만 둔다. | HIGH: 중복을 유지하면 깊은 tree일수록 Panel/Skia size drift.    |
| Table 2D projection | Table rows/columns shape loop에 data와 visual이 결합돼 있다.                                     | row/column culling + cell template projection.                                                                                 | HIGH: Table은 ListBox보다 늦은 phase로 두는 것이 맞다.          |
| Data SSOT           | current runtime은 root `collections`/dataBinding 소비가 강하다.                                  | ADR-920 `collection`은 binding reference 또는 static seed로 한정하고 root data SSOT와 중복하지 않아야 한다.                    | HIGH: node-local data가 기존 collections SSOT와 중복될 수 있음. |
| Page frame/Slot     | page frame binding, Slot fill, projected Slot drop/mutation target이 별도 구현되어 있다.         | `frame` primitive 설계가 page-applied frame projection과 canonical write route를 포함해야 한다.                                | HIGH: generic frame만 만들면 page frame authoring이 회귀.       |
| Layout publish      | layout publish/projection version/synthetic element map이 Skia rebuild trigger다.                | format layout cache가 같은 invalidation signal에 붙어야 한다.                                                                  | HIGH: 별도 cache가 stale Skia/Layer Tree를 만들 수 있음.        |
| Behavior bridge     | Button/ListBox/Table/Tabs events가 root events/actions와 연결된다.                               | format Preview/Publish adapter가 RAC callbacks를 root behavior dispatcher로 bridge해야 한다.                                   | MED/HIGH: visual parity만 맞고 interaction이 사라질 수 있음.    |
| Ref edit semantics  | ref instance override와 origin impact confirmation이 존재한다.                                   | projected edit route뿐 아니라 origin/instance route와 impact confirmation을 유지해야 한다.                                     | MED: origin edit이 모든 instance에 조용히 전파될 수 있음.       |
| Internal primitives | `text` 외에 Lucide `Icon`/`icon_font`가 Skia/DOM 양쪽에서 필요하다.                              | internal primitive exception list와 source kind를 고정한다.                                                                    | MED: clean-source boundary가 불명확하거나 icon slot이 빠짐.     |

## 4. Format Schema

### 4.1 Definition registry

```ts
type RacFormatComponent =
  | "rac.button"
  | "rac.listbox"
  | "rac.listbox.item"
  | "rac.table"
  | "rac.table.row"
  | "rac.table.cell"
  | "rac.tabs"
  | "rac.tablist"
  | "rac.tab"
  | "text"
  | "icon_font"
  | "frame"
  | "ref";

type TokenRef = `$--${string}` | `{${string}}`;
type PencilLayoutDirection = "none" | "vertical" | "horizontal";
type PencilSizingBehavior =
  | "fit_content"
  | "fill_container"
  | `fit_content(${number})`
  | `fill_container(${number})`;
type FormatStyleValue =
  | string
  | number
  | boolean
  | TokenRef
  | readonly FormatStyleValue[]
  | Record<string, unknown>
  | null;

type FormatStyleGroup =
  | "layout"
  | "sizing"
  | "spacing"
  | "typography"
  | "appearance"
  | "border"
  | "effects";

type FormatStyleAffects = "layout" | "paint" | "text" | "interaction";

type FormatStyleProperty =
  | "layout"
  | "layoutPosition"
  | "alignItems"
  | "justifyContent"
  | "gap"
  | "padding"
  | "x"
  | "y"
  | "width"
  | "height"
  | "minWidth"
  | "minHeight"
  | "clip"
  | "fontFamily"
  | "fontSize"
  | "fontWeight"
  | "lineHeight"
  | "letterSpacing"
  | "fill"
  | "stroke"
  | "strokeWidth"
  | "strokeAlignment"
  | "opacity"
  | "cornerRadius"
  | "effect";

type FormatStylePatch = Partial<Record<FormatStyleProperty, FormatStyleValue>>;
type FormatCapabilityKey = FormatStyleGroup | FormatStyleProperty | "frame";

interface FormatCapabilityRegistry {
  version: string;
  properties: Record<FormatStyleProperty, FormatStylePropertyDefinition>;
  sizeScales: Record<string, FormatSizeScale>;
  variants: Record<string, FormatVariantScale>;
}

interface FormatStylePropertyDefinition {
  group: FormatStyleGroup;
  valueKind: "keyword" | "length" | "color" | "number" | "token" | "shadow";
  inherited?: boolean;
  affects: FormatStyleAffects[];
  panel: {
    section: "Layout" | "Sizing" | "Typography" | "Appearance" | "Effects";
    label: string;
  };
  skia?: { supported: boolean };
}

interface FormatSizeScale {
  id: string;
  values: Record<string, FormatStylePatch>;
}

interface FormatVariantScale {
  id: string;
  values: Record<string, FormatStylePatch>;
}

interface RacFormatDefinition {
  id: RacFormatComponent;
  source: {
    kind: "rac-starter" | "internal-primitive";
    file?: string;
    exportName?: string;
    racPrimitive?: string;
    renderer?: "text" | "lucide-icon";
  };
  parts: Record<string, RacPartDefinition>;
  props: Record<string, RacPropDefinition>;
  style: RacStyleContract;
  states: Record<string, RacStateDefinition>;
  collection?: RacCollectionDefinition;
}

interface RacPartDefinition {
  role?: string;
  slot?: string;
  skiaPrimitive: "box" | "text" | "icon" | "row" | "cell" | "container";
  selectable?: boolean;
  editable?: boolean;
}

interface RacStyleContract {
  capabilities: RacCapabilityBinding[];
  semanticProps?: Record<string, RacSemanticStyleProp>;
  partDefaults?: Record<string, FormatStylePatch>;
}

interface RacCapabilityBinding {
  capability: FormatCapabilityKey;
  part: string;
  mode: "read-write" | "computed" | "locked";
  properties?: FormatStyleProperty[];
}

interface RacSemanticStyleProp {
  prop: "size" | "variant" | "density" | "orientation";
  source: "props";
  scale?: string;
  default: string;
  allowed: string[];
  role: "default-preset";
  mapsTo: Array<{
    value: string;
    rootPatch?: FormatStylePatch;
    partPatches?: Record<string, FormatStylePatch>;
  }>;
}

interface RacPropDefinition {
  kind:
    | "string"
    | "boolean"
    | "enum"
    | "variant"
    | "size"
    | "items"
    | "rows"
    | "columns"
    | "selection"
    | "binding";
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  panel: { section: string; label: string };
  rac?: { prop: string };
  skia?: { affects: "layout" | "paint" | "text" | "interaction" };
}

interface RacStateDefinition {
  dataAttribute?: string;
  visual?: FormatStylePatch;
}

interface RacCollectionDefinition {
  dataKey: "items" | "rows";
  templateRole: "item" | "row" | "cell";
  keyPath: string;
  labelPath?: string;
  virtualization: {
    axis: "vertical" | "grid" | "table2d";
    estimatedMainSize: number;
    overscanDefault: number;
  };
}
```

핵심 규칙:

- `FormatCapabilityRegistry.properties`가 `layout`, `gap`, `padding`, `fontSize`, `fill` 같은
  property 의미와 Panel section, Skia 지원 여부, layout invalidation 분류를 한 번만 정의한다.
- canonical property 이름은 Pencil frame vocabulary를 따른다. `layout:"horizontal"`은
  Preview에서 `display:flex; flex-direction:row`로 변환될 수 있지만, format document에는
  `display`/`flexDirection`을 저장하지 않는다.
- `FormatCapabilityRegistry.sizeScales`가 `control.sm`, `control.md`, `table.compact`
  같은 shared size scale을 정의한다. component별 `ButtonSizeDefinition`,
  `ListBoxItemSizeDefinition`, `TabsSizeDefinition`을 반복하지 않는다.
- `RacFormatDefinition.style.capabilities`는 어떤 part가 어떤 공통 capability를
  read/write할 수 있는지 선언한다.
- `RacFormatDefinition.style.semanticProps`는 RAC semantic prop인 `size`, `variant`,
  `orientation`이 공통 style patch로 해석되는 default preset mapping만 갖는다.
- semantic prop으로 만들어진 style 값은 default다. 예를 들어 `props.size="sm"`은
  `fontSize`, `padding`, `gap`, `height`의 기본값을 제공하지만, 사용자가 `style.fontSize`를
  명시하면 `fontSize`에 대해서는 `style.fontSize`가 우선한다.
- 같은 `layout:"horizontal"`/`gap:8`은 `rac.listbox.item`, `rac.tabs`, `rac.tablist`,
  `rac.table.cell`, `frame`에서 동일한 의미를 가진다. 차이는 allow-list와 part binding에서만
  발생한다.

### 4.2 Format document node

```ts
interface FormatNode {
  id: string;
  type: RacFormatComponent;
  name?: string;
  reusable?: boolean;
  ref?: string;
  descendants?: Record<string, DescendantOverride>;
  slot?: false | string[];
  children?: FormatNode[];

  props?: Record<string, unknown>;
  style?: FormatStylePatch;
  collection?: CollectionContract;
  projection?: ProjectionContract;
  projectedOverrides?: ProjectedOverrideMap;
  extension?: CompositionIntegrationExtension;
}

interface FrameFormatNode extends FormatNode {
  type: "frame";
  style?: FormatStylePatch & {
    layout?: PencilLayoutDirection;
    gap?: number | TokenRef;
    padding?:
      | number
      | TokenRef
      | [number | TokenRef, number | TokenRef]
      | [
          number | TokenRef,
          number | TokenRef,
          number | TokenRef,
          number | TokenRef,
        ];
    width?: number | TokenRef | PencilSizingBehavior;
    height?: number | TokenRef | PencilSizingBehavior;
    clip?: boolean | TokenRef;
  };
  reusable?: boolean;
  slot?: false | string[];
  children?: FormatNode[];
}

type CollectionContract =
  | {
      kind: "static";
      sourceScope: "node-seed";
      itemKey: "items" | "rows";
      items?: Array<Record<string, unknown>>;
      rows?: Array<Record<string, unknown>>;
    }
  | {
      kind: "binding-ref";
      binding: PropertyDataBindingRef;
      fallbackItems?: Array<Record<string, unknown>>;
      fallbackRows?: Array<Record<string, unknown>>;
    };

interface PropertyDataBindingRef {
  source: "dataTable" | "apiEndpoint" | "variable" | "static" | "supabase";
  name: string;
  refreshMode?: "manual" | "interval";
  refreshInterval?: number;
  config?: Record<string, unknown>;
}

type ProjectedOverrideMap = Record<string, Record<string, DescendantOverride>>;

interface CompositionIntegrationExtension {
  "x-composition"?: {
    dataBinding?: PropertyDataBindingRef;
    events?: Array<{
      event: "onPress" | "onSelectionChange" | "onAction" | string;
      actionRef: string;
    }>;
    actions?: Array<{ id: string; next?: string[] }>;
    pageFrameBinding?: {
      frameRef: string;
      bodyPath: string;
      slotFill?: Record<string, string>;
    };
  };
}

interface ProjectionContract {
  mode: "template-tree";
  templateNodeId: string;
  itemKey: "items" | "rows";
  keyPath: string;
  visibleOnly: true;
}
```

규칙:

- semantic props는 `props`에 둔다.
- explicit layout/style/size/color override는 공통 longhand vocabulary로 `style`에 둔다.
- computed value는 저장하지 않는다.
- collection template은 `children[]`에 둔다.
- data repetition은 `collection`에 둔다. `collection.kind:"static"`은 detached seed/example용이고,
  runtime data는 `collection.kind:"binding-ref"`가 root data store를 참조한다.
- projected rows/cells는 저장하지 않는다.
- per-item visual override는 `projectedOverrides[itemKey][templateNodeId]`에 저장한다. 일반 ref
  instance override와 호환되어야 하므로 payload는 `DescendantOverride` shape를 따른다.
- `extension["x-composition"]`은 behavior/data/page-frame integration boundary다. RAC/Pencil core
  `props`/`style` 결정 근거로 사용하지 않는다.
- `props.size`는 semantic input이며 resolved `fontSize`/padding/gap/height를 직접 저장하지
  않는다.
- `style.fontSize` 같은 `style.*` 값은 사용자가 직접 수정한 explicit override다. 해당 field는
  semantic default보다 우선하며, override를 reset하면 style field를 삭제하고 semantic default로
  돌아간다.
- Pencil JSON import/export adapter는 top-level `layout`, `gap`, `padding`, `fill`,
  `fontSize` 같은 Pencil fields를 같은 `FormatStylePatch` vocabulary로 변환한다.
- `frame`은 RAC component가 아니다. `frame`은 semantic-free container이고, RAC component는
  접근성/selection/collection semantics를 가진다.
- RAC component root나 part가 children layout을 담당해야 할 때도 `RacStyleContract`의
  `frame` capability를 통해 같은 `layout`/`gap`/`padding` grammar를 사용한다.

### 4.3 Current Builder integration contracts

ADR-920 format core는 기존 Builder 기능을 삭제하지 않는다. 아래 항목은 RAC/Pencil core
schema가 아니라 integration boundary로 고정한다.

| 영역            | 저장/권위                                                                      | ADR-920 bridge                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Data            | root `collections`/`apiEndpoints`/`variables`, element-level binding reference | `collection.kind:"binding-ref"`가 `PropertyDataBindingRef`를 저장하고 resolver가 기존 data store에서 rows를 읽는다.                   |
| Static examples | format node local seed                                                         | `collection.kind:"static"`만 허용한다. API endpoint/raw runtime cache는 node-local로 저장하지 않는다.                                 |
| Events/Actions  | root `events`/`actions` 또는 `x-composition` extension                         | Preview/Publish adapter가 RAC callback prop을 action dispatcher thunk로 만든다. JSON에는 function을 저장하지 않는다.                  |
| Page Frame      | page frame binding + projected Slot mirror                                     | `frame` resolver는 page viewport authority와 frame body layout grammar를 merge하고 Slot fill write는 ref descendant route로 변환한다. |
| Ref edit        | `ref` + `descendants` + origin impact confirmation                             | normal ref instance edit, origin edit, projected override edit을 서로 다른 route로 유지한다.                                          |
| Internal Icon   | composition Lucide primitive                                                   | `icon_font`는 `source.kind:"internal-primitive"`로 등록하고 text처럼 selectable/projectable child가 된다.                             |

System template origin contract:

- reusable template origins는 system-owned components page에 둔다. page metadata는
  `systemOwned:true`, `previewExcluded:true`, `publishExcluded:true`여야 한다.
- ListBox migration은 최소 `component-listbox`, `component-listbox-item-default`,
  `component-listbox-item-selected` origin을 보장한다.
- `component-listbox` origin의 slot allow-list는 default/selected ListBoxItem origin을 가리킨다.
- template origin child 식별은 reusable slot allow-list만으로 하지 않고 child slot role
  (`icon`, `label`, `description`) 또는 format child id path로 한다.
- system-owned origin은 Preview/Publish output에 직접 렌더하지 않고, ref/template resolution과
  "Go to source template" 편집 route에서만 노출한다.

Data binding resolution order:

1. `collection.kind:"binding-ref"`가 있으면 root data store에서 `source/name`을 resolve한다.
2. binding result가 pending/error이면 `fallbackItems`/`fallbackRows`를 preview seed로 사용할 수 있다.
3. binding이 없고 `collection.kind:"static"`이면 local seed를 사용한다.
4. legacy import/migration adapter는 기존 `props.items`, `props.rows`, `props.dataBinding`, `data`
   field를 위 contract로 변환한다. 신규 write는 `collection`과 `extension["x-composition"]`만 사용한다.

Page frame projection write route:

```ts
type FrameProjectionRef =
  | {
      kind: "page-frame-element";
      pageId: string;
      sourceElementId: string;
      renderElementId: string;
      canonicalParentId: string;
      descendantPath: string;
      slotName?: string;
    }
  | ProjectedNodeRef;

type CanonicalWriteRoute =
  | { kind: "canonical-node"; nodeId: string }
  | { kind: "ref-descendants"; refNodeId: string; descendantPath: string }
  | EditRoute;
```

규칙:

- render-space id는 selection/hit-test용이다. mutation API에는 `CanonicalWriteRoute`로 변환된
  target만 전달한다.
- page-applied frame은 Page가 viewport width/height/background 권위를 유지하고, frame body는
  layout grammar만 제공한다.
- projected Slot은 ordinary instance descendant와 다르게 drop container가 될 수 있다.
- Slot fill로 들어간 page child는 filled Slot의 default child를 숨기되, 미 fill Slot의 default
  child는 유지한다.

## 5. 대표 Format 예시

### 5.1 Frame primitive

```json
{
  "id": "sidebar-brand",
  "type": "frame",
  "name": "Brand",
  "reusable": true,
  "style": {
    "layout": "horizontal",
    "alignItems": "center",
    "gap": 8,
    "padding": 8,
    "fill": "$--sidebar",
    "cornerRadius": 6,
    "clip": true
  },
  "children": [
    {
      "id": "brand-logo",
      "type": "frame",
      "style": {
        "layout": "none",
        "width": 32,
        "height": 32,
        "fill": "$--sidebar-accent",
        "cornerRadius": 10,
        "clip": true
      }
    },
    {
      "id": "brand-name-stack",
      "type": "frame",
      "style": {
        "layout": "vertical",
        "justifyContent": "center"
      },
      "children": [
        {
          "id": "brand-name",
          "type": "text",
          "props": { "content": "Acme, Inc." },
          "style": { "fontSize": 14, "fill": "$--sidebar-foreground" }
        }
      ]
    }
  ]
}
```

이 node는 RAC semantics가 없는 순수 layout/container다. Button, ListBoxItem, Tabs,
Table cell은 필요 시 root part가 같은 frame contract를 구현하거나, 내부에 명시적 `frame`
child를 둔다.

### 5.2 Button

```json
{
  "id": "button-save",
  "type": "rac.button",
  "props": {
    "children": "Save",
    "variant": "primary",
    "size": "sm",
    "fillStyle": "fill",
    "isPending": false,
    "isDisabled": false
  },
  "style": {
    "layout": "horizontal",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "$--spacing-2",
    "padding": [2, 8]
  },
  "children": [
    {
      "id": "button-save-label",
      "type": "text",
      "props": { "content": "Save" }
    }
  ],
  "extension": {
    "x-composition": {
      "events": [{ "event": "onPress", "actionRef": "action-save-form" }]
    }
  }
}
```

Button도 leaf text를 tree로 둔다. `children[Text]`가 canonical label node이며,
Preview/Publish mapper가 RAC의 `children` render value를 파생한다. Skia hit-test는 button
background와 label text를 모두 선택 가능 target으로 가진다. `props.size="sm"`은 semantic
input이고, `style.layout`/`style.gap`/`style.padding`은 Pencil frame contract를 따르는 공통
capability registry의 property다.

### 5.3 ListBox

```json
{
  "id": "animal-list",
  "type": "rac.listbox",
  "props": {
    "size": "md",
    "variant": "default",
    "selectionMode": "single",
    "enableVirtualization": true,
    "overscan": 5
  },
  "style": {
    "layout": "vertical",
    "gap": 0
  },
  "collection": {
    "kind": "static",
    "sourceScope": "node-seed",
    "itemKey": "items",
    "items": [
      { "id": "a", "label": "Aardvark", "description": "Animal" },
      { "id": "c", "label": "Cat", "description": "Animal" }
    ]
  },
  "projection": {
    "mode": "template-tree",
    "templateNodeId": "animal-row-template",
    "itemKey": "items",
    "keyPath": "id",
    "visibleOnly": true
  },
  "children": [
    {
      "id": "animal-row-template",
      "type": "rac.listbox.item",
      "name": "ListBoxItem Template",
      "style": {
        "layout": "vertical",
        "gap": 2,
        "padding": [4, 12]
      },
      "children": [
        {
          "id": "animal-row-icon",
          "type": "icon_font",
          "name": "Icon",
          "props": { "bind": "item.icon", "slot": "icon" }
        },
        {
          "id": "animal-row-label",
          "type": "text",
          "name": "Label",
          "props": { "bind": "item.label", "slot": "label" }
        },
        {
          "id": "animal-row-description",
          "type": "text",
          "name": "Description",
          "props": { "bind": "item.description", "slot": "description" }
        }
      ]
    }
  ],
  "extension": {
    "x-composition": {
      "events": [
        { "event": "onSelectionChange", "actionRef": "action-list-selection" },
        { "event": "onAction", "actionRef": "action-list-row-action" }
      ]
    }
  }
}
```

Selection indicator는 기본 상태 part다. 현재 구현처럼 별도 persisted child가 없더라도 Skia
projection은 selected state에서 `selectionIndicator` pseudo-part를 hit/draw tree에 올릴 수 있다.
사용자가 indicator 자체를 커스터마이즈하는 phase에서는 `icon_font` child로 승격한다.

### 5.4 Table

```json
{
  "id": "users-table",
  "type": "rac.table",
  "props": {
    "size": "sm",
    "selectionMode": "multiple",
    "rowHeight": 32,
    "enableVirtualization": true,
    "paginationMode": "pagination",
    "itemsPerPage": 50,
    "heightMode": "fixed",
    "height": 300,
    "overscan": 10,
    "sortColumn": "name",
    "sortDirection": "ascending",
    "enableResize": true,
    "columns": [
      { "id": "name", "label": "Name", "width": 160, "isRowHeader": true },
      { "id": "role", "label": "Role", "width": 120 }
    ],
    "columnGroups": [
      { "id": "identity", "label": "Identity", "columns": ["name"] },
      { "id": "access", "label": "Access", "columns": ["role"] }
    ]
  },
  "collection": {
    "kind": "binding-ref",
    "binding": {
      "source": "dataTable",
      "name": "users"
    },
    "fallbackRows": [{ "id": "u1", "name": "Ada", "role": "Admin" }]
  },
  "style": {
    "layout": "vertical"
  },
  "projection": {
    "mode": "template-tree",
    "templateNodeId": "table-row-template",
    "itemKey": "rows",
    "keyPath": "id",
    "visibleOnly": true
  },
  "children": [
    {
      "id": "table-header",
      "type": "frame",
      "name": "TableHeader"
    },
    {
      "id": "table-row-template",
      "type": "rac.table.row",
      "children": [
        {
          "id": "cell-name",
          "type": "rac.table.cell",
          "props": { "column": "name" },
          "style": {
            "layout": "horizontal",
            "alignItems": "center",
            "padding": [0, 8]
          },
          "children": [
            {
              "id": "text-name",
              "type": "text",
              "props": { "bind": "row.name" }
            }
          ]
        },
        {
          "id": "cell-role",
          "type": "rac.table.cell",
          "props": { "column": "role" },
          "style": {
            "layout": "horizontal",
            "alignItems": "center",
            "padding": [0, 8]
          },
          "children": [
            {
              "id": "text-role",
              "type": "text",
              "props": { "bind": "row.role" }
            }
          ]
        }
      ]
    }
  ],
  "extension": {
    "x-composition": {
      "events": [
        { "event": "onSelectionChange", "actionRef": "action-table-selection" }
      ]
    }
  }
}
```

Table parity contract:

| 기능                | Format 위치                                                    | Phase 5 first proof                                                                 |
| ------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| column mapping      | `props.columns` + optional migrated `props.columnMapping`      | supported, adapter normalizes to column definitions                                 |
| column groups       | `props.columnGroups`                                           | supported for header layout; advanced nested groups can defer with explicit fixture |
| sorting             | `props.sortColumn`/`props.sortDirection` + RAC callback bridge | supported for current sort state and callback dispatch                              |
| resizing            | `props.enableResize` + column width override                   | supported for persisted width patch, not transient drag telemetry                   |
| pagination/infinite | `props.paginationMode`/`itemsPerPage`                          | supported as data window input; infinite prefetch may defer                         |
| height modes        | `props.heightMode`/`height`/`viewportHeight`                   | supported for layout input                                                          |
| API data mapping    | `collection.kind:"binding-ref"` -> root API endpoint config    | supported through existing data binding service, not node-local endpoint            |
| row virtualization  | `projection.visibleOnly` + row window                          | required                                                                            |
| column culling      | `RacCollectionDefinition.virtualization.axis:"table2d"`        | required for wide tables                                                            |

### 5.5 Shared capability reuse: ListBoxItem and Tabs

아래 두 node는 서로 다른 RAC component지만 같은 `style.layout`, `style.gap`,
`style.padding`, `style.fontSize` vocabulary를 사용한다. 차이는 `rac.listbox.item`과
`rac.tabs` definition의 part allow-list와 semantic prop mapping뿐이다.

```json
[
  {
    "id": "animal-row-template",
    "type": "rac.listbox.item",
    "props": { "size": "md" },
    "style": {
      "layout": "vertical",
      "gap": 2
    }
  },
  {
    "id": "settings-tabs",
    "type": "rac.tabs",
    "props": { "size": "md", "orientation": "horizontal" },
    "style": {
      "layout": "vertical",
      "gap": 0
    },
    "children": [
      {
        "id": "settings-tablist",
        "type": "rac.tablist",
        "style": {
          "layout": "horizontal",
          "gap": 0
        }
      }
    ]
  }
]
```

## 6. RAC Starter to Format 변환 레이어

```ts
interface RacFormatAdapter {
  readCapabilityRegistry(): FormatCapabilityRegistry;
  readDefinition(type: RacFormatComponent): RacFormatDefinition;
  resolveCollectionData(input: ResolveCollectionInput): ResolvedCollectionData;
  resolveEffectiveStyle(input: ResolveStyleInput): ResolvedStyle;
  resolveCanonicalWriteRoute(input: ProjectedWriteInput): CanonicalWriteRoute;
  toRacProps(node: FormatNode, ctx: RuntimeContext): Record<string, unknown>;
  toRacChildren(node: FormatNode, ctx: RuntimeContext): React.ReactNode;
  toBehaviorProps(node: FormatNode, ctx: RuntimeContext): BehaviorCallbackMap;
  toPanelSchema(type: RacFormatComponent): PanelSection[];
  toSkiaPlan(input: SkiaPlanInput): SkiaCommandPlan;
  toLayoutPublication(input: ResolvedFormatRuntime): FormatLayoutPublication;
}

interface ResolveCollectionInput {
  node: FormatNode;
  collection: CollectionContract | undefined;
  dataRuntime: {
    collections: readonly unknown[];
    apiEndpoints: readonly unknown[];
    variables: ReadonlyMap<string, unknown>;
  };
}

interface ResolvedCollectionData {
  rows: Array<Record<string, unknown>>;
  schema: Array<{ key: string; type?: string; label?: string }>;
  source:
    | "static-seed"
    | "data-table"
    | "api-endpoint"
    | "variable"
    | "fallback";
  refreshMode: "manual" | "interval";
  totalCount?: number;
}

type BehaviorCallbackMap = Record<string, (...args: unknown[]) => void>;

interface ResolveStyleInput {
  node: FormatNode;
  definition: RacFormatDefinition;
  capabilities: FormatCapabilityRegistry;
  state:
    | "default"
    | "hovered"
    | "pressed"
    | "selected"
    | "disabled"
    | "focusVisible";
  theme: ResolvedTheme;
}

interface ResolvedStyle {
  defaults: {
    root: FormatStylePatch;
    parts: Record<string, FormatStylePatch>;
  };
  overrides: {
    root: FormatStylePatch;
    parts: Record<string, FormatStylePatch>;
  };
  root: FormatStylePatch;
  parts: Record<string, FormatStylePatch>;
  affects: Set<FormatStyleAffects>;
  sourceMap: Record<
    FormatStyleProperty,
    | "capability-default"
    | "semantic-default"
    | "style-override"
    | "state-overlay"
  >;
}

interface FormatLayoutPublication {
  layoutDirty: boolean;
  projectionDirty: boolean;
  syntheticNodes: ProjectedTreeNode[];
  layoutAffects: Set<FormatStyleAffects>;
}
```

변환 규칙:

1. RAC starter의 prop/state vocabulary를 definition으로 고정한다.
2. `data-*` state는 definition `states`에 둔다.
3. layout/style/size/color/typography property 의미는 `FormatCapabilityRegistry`에서만
   읽는다.
4. `resolveEffectiveStyle()` precedence는 capability default -> semantic prop default
   (`props.size`, `props.variant` 등) -> explicit `style.*` override -> state overlay 순서다.
   같은 field에 `props.size`와 `style.fontSize`가 모두 영향을 주면 `style.fontSize`가 이긴다.
5. collection data는 `resolveCollectionData()`가 기존 data runtime을 읽어 resolve한다. node-local
   API endpoint fetcher를 새로 만들지 않는다.
6. Preview/Publish는 `toRacProps()`와 `toRacChildren()`만 사용하고, `layout:"horizontal"` /
   `"vertical"`을 CSS `display:flex` + `flex-direction`으로 변환하는 일은 adapter boundary에서만
   수행한다.
7. behavior는 `toBehaviorProps()`에서 root events/actions dispatcher로 bridge한다. JSON에는
   callback function을 저장하지 않는다.
8. Skia는 React render function을 실행하지 않고 동일한 template tree와 data binding을
   `toSkiaPlan()`으로 해석한다.
9. `toLayoutPublication()`은 기존 layout publish/projection version/synthetic element boundary에
   붙는 invalidation payload만 만든다. ADR-920은 독립 layout engine을 만들지 않는다.
10. Panel은 capability registry와 definition에서 field를 만들고 format node에만 patch한다.
11. `ComponentSpec`, `render.shapes()`, pre-ADR-920 Skia shape factory는 definition 생성 입력으로
    사용할 수 없다.

## 7. Interactive Projected Tree

### 7.1 Projection model

```ts
interface ProjectedNodeRef {
  kind: "projected";
  projectionId: string;
  ownerNodeId: string;
  templateNodeId: string;
  itemKey?: string;
  columnKey?: string;
  canonicalPath: string;
  projectionPath: string;
  role: "row" | "cell" | "container" | "text" | "icon" | "pseudo-part";
  part?: string;
  editTarget: "template" | "data" | "override" | "origin" | "instance";
}

interface ProjectedTreeNode {
  ref: ProjectedNodeRef;
  bounds: Rect;
  children: ProjectedTreeNode[];
  drawCommands: SkiaDrawCommand[];
}
```

예시:

```text
ListBox
├─ Row[item:a]
│  ├─ Text[label]       projection:listbox:animal-list:item:a:animal-row-label
│  └─ Text[description] projection:listbox:animal-list:item:a:animal-row-description
└─ Row[item:c]
   ├─ Text[label]
   └─ Text[description]
```

### 7.2 Hit-test and drill-in

```ts
interface SkiaSelection {
  kind: "canonical" | "projected";
  nodeId?: string;
  projected?: ProjectedNodeRef;
  drillStack: Array<string>;
}

type EditRoute =
  | { kind: "template"; nodeId: string; patch: Record<string, unknown> }
  | { kind: "origin"; originNodeId: string; patch: Record<string, unknown> }
  | { kind: "instance"; refNodeId: string; patch: Record<string, unknown> }
  | {
      kind: "data";
      ownerNodeId: string;
      itemKey: string;
      field: string;
      value: unknown;
    }
  | {
      kind: "override";
      ownerNodeId: string;
      itemKey: string;
      templateNodeId: string;
      patch: Record<string, unknown>;
    };
```

동작:

| Gesture                       | Target                    | Result                       |
| ----------------------------- | ------------------------- | ---------------------------- |
| click                         | collection background     | canonical collection 선택    |
| click                         | projected row             | row projection 선택          |
| click                         | projected child Text/Icon | deepest projected child 선택 |
| double-click                  | projected row             | row subtree drill-in         |
| double-click                  | projected Text with bind  | data edit route              |
| drag/drop                     | projected page frame Slot | ref descendant write route   |
| style edit on projected child | template edit route 기본  |
| explicit "Override this row"  | override route            |
| Esc / breadcrumb              | drill stack pop           |

기본 write policy:

- text content edit: data route.
- style/layout edit: template route.
- row-specific visual change: explicit override route.
- ref instance selection edit: instance route.
- reusable origin edit: origin route + impact confirmation.
- page frame Slot edit/drop: `ref-descendants` route.

## 8. Skia Rendering 최적화

### 8.1 Windowing

```ts
interface CollectionWindow {
  startIndex: number;
  endIndex: number;
  overscanStart: number;
  overscanEnd: number;
  totalCount: number;
  estimatedSize: number;
}
```

규칙:

- ListBox는 vertical row window.
- GridList는 2D grid window.
- Table은 row window + column culling.
- sticky header는 body row window와 별도 layer.
- hit tree도 draw tree와 같은 window만 가진다.

### 8.2 Template layout cache

```ts
interface TemplateLayoutCacheKey {
  templateHash: string;
  definitionVersion: string;
  capabilityVersion: string;
  size: string;
  variant: string;
  width: number;
  themeKey: string;
}
```

캐시 대상:

- template subtree intrinsic size.
- text measurement.
- row/cell child bounds.
- Skia command fragment.

무효화:

- template child structure 변경.
- shared capability registry 변경.
- size/variant/style/theme 변경.
- font load/version 변경.
- column width 변경.
- data value가 text measurement에 영향을 주는 경우 해당 visible item만.

### 8.3 Text rendering

- Skia text primitive가 `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `maxWidth`,
  `overflow`를 직접 소비한다.
- DOM overlay는 editing IME나 rich text phase에서만 temporary editor로 허용하고, 기본
  render source가 아니다.
- text measurement cache는 `text + font tuple + maxWidth` 기준이다.

### 8.4 Layout publication bridge

ADR-920의 template layout cache는 기존 Builder layout publish pipeline을 대체하지 않는다.
`ResolvedFormatRuntime`은 기존 layout engine이 소비할 수 있는 layout input과 Skia rebuild
invalidation만 산출한다.

```text
FormatDocument patch
  └─ resolveEffectiveStyle / resolveTemplateLayout
      ├─ layout-affecting field? -> layoutDirty
      ├─ projected window/template changed? -> projectionDirty
      ├─ synthetic projected nodes -> synthetic element publication
      └─ StoreRenderBridge receives layout publish/projection version change
```

규칙:

- `style.fill`, `stroke`, `opacity` 같은 paint-only update는 layout publish 없이 Skia paint
  rebuild만 허용한다.
- `style.fontSize`, `lineHeight`, `padding`, `gap`, `width`, `height`, `props.size`,
  `props.orientation`, `collection.rows`, `props.columns`는 layout-affecting update다.
- Tabs virtual Tab, page frame Slot, ListBox/Table projected child는 synthetic/projected node로
  다뤄지며, multi-page/frame render에서 root별 synthetic map을 잃지 않아야 한다.
- projection window 변경은 `projectionVersion`을 증가시켜 hit tree와 draw tree를 같이 rebuild한다.
- `slice(0, N)` cap은 viewport culling으로 인정하지 않는다. culling은 scroll offset, viewport
  size, estimated/measured row size, overscan으로 계산한다.

## 9. Panel 연동

### 9.1 Properties Panel

- component semantics: definition `props`에서 자동 생성.
- semantic style props: `size`, `variant`, `orientation`, `density`는 Properties Panel에서
  편집한다. 이 값들은 default preset이다.
- `props.size` 변경은 unset style fields의 기본값만 바꾼다. 예를 들어 `style.fontSize`가
  이미 있으면 `props.size`를 `sm`에서 `lg`로 바꿔도 `fontSize` override는 유지한다.
- Properties Panel은 `style.fontSize`를 직접 쓰지 않는다. 같은 시각 field를 바꿔야 하면
  Style Panel edit route를 사용한다.
- collection data: `items-manager`, `columns-manager`, `binding-selector`.
- collection binding selector는 root `collections`/`apiEndpoints`/`variables`를 선택하게 하며,
  node-local API endpoint를 생성하지 않는다.
- behavior section은 `extension["x-composition"].events`/root events/actions를 편집한다.
  `props`에 function callback이나 action payload를 직접 넣지 않는다.
- projected selection: 선택 target에 따라 panel route를 표시.

```text
Projected Text selected
├─ Data field: item.label
├─ Template node: animal-row-label
└─ Actions: Edit template style / Override this row / Go to source template
```

### 9.2 Style Panel

- 표시 field는 `FormatCapabilityRegistry.properties`와 selected node definition의
  `style.capabilities` 교집합으로 만든다.
- 표시값은 effective value를 보여주되, field별 source badge를 구분한다:
  `props.size`/semantic default, explicit `style.*` override, state overlay.
- canonical node 선택: common `FormatStylePatch`를 node `style`에 patch.
- projected template child 선택: common `FormatStylePatch`를 template node `style`에 patch.
- projected row override 선택: `projectedOverrides[itemKey][templateNodeId]` 또는
  `descendants`-compatible override patch.
- `style.fontSize`를 사용자가 입력하면 explicit override로 저장한다. `Reset`은
  `style.fontSize` field를 삭제하고 `props.size`에서 파생된 default로 복귀한다.
- longhand style 저장 정책은 유지한다.
- `ListBoxItem` 전용 Layout section, `Tabs` 전용 Layout section처럼 component별 중복
  panel section을 만들지 않는다. component 차이는 field allow-list와 disabled reason으로만
  표현한다.
- ref instance 선택 시 Style Panel은 origin definition을 기준으로 field를 보여주되 patch는
  instance `props/style` 또는 `descendants` override에 저장한다.
- reusable origin 선택 시 edit은 origin에 저장하고, impacted instance count confirmation을 거친다.

### 9.3 Panel route matrix

| Selection                 | Properties Panel write              | Style Panel write                  | Notes                                                |
| ------------------------- | ----------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| canonical `rac.button`    | `props.*` semantic fields           | `style.*` explicit overrides       | `props.size` is default preset                       |
| ref instance root         | instance `props.*` override         | instance `style.*` override        | inherited defaults are not copied                    |
| reusable origin root      | origin `props.*`                    | origin `style.*`                   | requires origin impact confirmation                  |
| projected row             | selection/data summary              | no implicit style write            | row-specific style requires explicit override action |
| projected text/icon child | data field or template source route | template node `style.*` by default | double-click bound text opens data edit              |
| projected page frame Slot | Slot fill route                     | `ref.descendants[slotPath]` patch  | render id is never mutation target                   |

## 10. Preview / Publish 데이터 흐름

```text
FormatDocument
  ├─ resolve collection data from root data runtime
  ├─ resolve behavior extension
  ├─ resolve template tree
  ├─ toRacProps(collection)
  ├─ toBehaviorProps(events/actions)
  └─ toRacChildren(template, item)
      └─ RAC ListBox/Table dynamic collection render
```

Preview/Publish 규칙:

- RAC accessibility와 keyboard behavior는 RAC primitive가 담당.
- render function은 JSON에 저장하지 않는다. adapter가 template tree에서 생성한다.
- Publish output은 format capability/definition/token CSS bundle과 serialized format document를 함께
  사용한다.
- Skia-only helper field는 publish payload에 노출하지 않는다.
- data runtime은 published bundle에서 configured data source adapter로 resolve한다. Builder-only
  mock/runtime cache를 publish payload의 canonical data로 승격하지 않는다.
- RAC callback props는 `toBehaviorProps()`가 root events/actions dispatcher로 생성한다. `onPress`,
  `onSelectionChange`, `onAction` 같은 handler 함수는 serialized format에 저장하지 않는다.
- `page-components` 같은 system-owned origin library page는 Preview/Publish visible route에서
  제외하고, ref/template resolution source로만 사용한다.
- `icon_font`는 internal primitive adapter가 DOM SVG 또는 Skia path로 변환한다. RAC definition
  source와 혼동하지 않는다.

## 11. Layer Tree 표시

```text
ListBox
├─ Template
│  └─ ListBoxItem Template
│     ├─ Label
│     └─ Description
└─ Rows
   ├─ Aardvark
   │  ├─ Label
   │  └─ Description
   └─ Cat
      ├─ Label
      └─ Description
```

대용량 collection:

- `Rows` expanded 시 visible window + limited search result만 표시.
- 전체 row count는 badge로 표시.
- offscreen row 접근은 scroll/search/data panel route를 사용.
- `Template` subtree는 system-owned origin이 `page-components`에 있더라도 사용자에게 source
  template으로 탐색 가능해야 한다.
- system-owned `page-components` page 자체는 preview/publish 대상이 아니지만 Layer Tree source
  navigation과 "Go to source template" route에서 접근 가능해야 한다.

## 12. 구현 Phase

### Phase 0: Clean source capture

- `packages/react-aria-starter/src/Button.tsx`, `ListBox.tsx`, `Table.tsx` prop/state/slot 조사.
- `docs/migrations/shadcn-design-system.json`에서 tree/ref/descendants/slot/variable과
  `layout`/`gap`/`padding`/`fill`/`fontSize` 같은 shared style field 구조 조사.
- builder/spec 계열 구현은 이 phase의 입력이 아니라 integration impact audit 대상으로만 기록.
- Button/ListBoxItem/Tabs/Table에서 반복된 layout/style/size 정의를 새 schema 입력이 아니라
  제거해야 할 duplication impact로만 기록.
- 기존 root data store, `useCollectionData`, page frame Slot projection, root events/actions,
  internal `Icon` primitive, ref instance override/origin impact semantics를 integration contract로
  inventory한다.

### Phase 1: Button leaf proof

- `FormatCapabilityRegistry` + `RacFormatDefinition` 최소 registry.
- Button format node -> Panel/Preview/Skia 공통 resolver.
- Button label text hit-test.
- Button `onPress` behavior bridge fixture.
- G1 통과.

### Phase 2: ListBox template tree proof

- ListBox/ListBoxItem template tree schema.
- collection static seed + visible row projection.
- DataTable binding-ref + static seed fallback.
- system-owned ListBox/ListBoxItem origin bootstrap migration.
- template subtree layout으로 row height 계산.
- Preview RAC children render function adapter.
- G2/G10 통과.

### Phase 3: Skia interactive projected tree

- `ProjectedNodeRef`, hit tree, drill stack.
- click deepest child selection.
- double-click row drill-in.
- double-click bound text data edit route.
- page frame Slot projected drop/mutation route.
- ref instance/origin/projected override route matrix.
- G3/G5/G11 통과.

### Phase 4: Virtualization and performance

- 10k ListBox fixture.
- draw/hit node count window gate.
- template layout/text cache.
- layout publish/projectionVersion/synthetic node invalidation bridge.
- G4/G12 통과.

### Phase 5: Table first proof

- column schema + row template tree.
- column mapping, column groups, sorting, resizing, pagination/infinite, height mode, API data mapping parity matrix.
- row/column culling.
- cell/text projected selection.
- RAC Table Preview/Publish parity.
- Table `onSelectionChange` behavior bridge.
- G6/G7/G13/G14 통과.

## 13. 파일 경계 초안

새 파일 후보:

| 파일                                                                          | 책임                                          |
| ----------------------------------------------------------------------------- | --------------------------------------------- |
| `packages/shared/src/format/formatCapabilityRegistry.ts`                      | shared layout/style/size registry             |
| `packages/shared/src/format/racFormatDefinition.ts`                           | RAC definition 타입과 part binding            |
| `packages/shared/src/format/racFormatResolver.ts`                             | effective style/layout resolver               |
| `packages/shared/src/format/racCollectionResolver.ts`                         | root data store binding-ref resolve           |
| `packages/shared/src/format/racBehaviorBridge.ts`                             | events/actions -> RAC callback map            |
| `packages/shared/src/format/racPreviewAdapter.tsx`                            | RAC props/children adapter                    |
| `apps/builder/src/builder/workspace/canvas/skia/projectedTree.ts`             | projected node model                          |
| `apps/builder/src/builder/workspace/canvas/skia/collectionWindow.ts`          | viewport window 계산                          |
| `apps/builder/src/builder/workspace/canvas/skia/racFormatSkiaAdapter.ts`      | Skia command plan                             |
| `apps/builder/src/builder/workspace/canvas/scene/racFormatLayoutBridge.ts`    | layout publish/projection invalidation bridge |
| `apps/builder/src/builder/workspace/canvas/scene/racFrameProjectionBridge.ts` | page frame Slot projection route              |
| `apps/builder/src/builder/panels/properties/projectedSelectionRoute.ts`       | projected edit route                          |

Integration boundary 후보:

| Boundary               | 계약                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ |
| Preview entry          | `FormatDocument` + capability/definition registry만 받아 RAC element tree 생성 |
| Publish entry          | serialized format + token/capability bundle만 받아 output 생성                 |
| Skia scene entry       | resolved format runtime만 받아 draw/hit command 생성                           |
| Layout bridge          | resolved format runtime -> existing layout publish/projection version signal   |
| Layer Tree entry       | canonical tree + visible projected tree를 read-only view로 표시                |
| Properties Panel entry | definition props와 selection route만 받아 patch 생성                           |
| Style Panel entry      | capability fields와 edit route만 받아 canonical/template patch 생성            |
| Data bridge            | collection binding-ref -> existing root data runtime                           |
| Behavior bridge        | events/actions extension -> RAC callback props                                 |

## 14. 검증 체크리스트

- [ ] Button `props.size="sm"`은 default preset으로 동작하고, `style.fontSize`가 있으면
      Panel/Preview/Skia 모두 override 값을 우선.
- [ ] Button/ListBoxItem/Tabs/Table cell이 `layout`/`gap`/`padding`/`fontSize`/fill을 같은
      `FormatCapabilityRegistry`에서 resolve.
- [ ] canonical format에는 `display`/`flexDirection`을 저장하지 않고 Preview/Publish adapter가
      `layout`에서 CSS를 생성.
- [ ] ListBox row height가 item template subtree 계산 결과와 일치.
- [ ] projected Text click이 row가 아닌 Text를 선택.
- [ ] double-click projected Text가 data edit route를 생성.
- [ ] style edit은 template route로 들어가 모든 visible row에 반영.
- [ ] explicit override는 특정 item projection에만 반영.
- [ ] 10k ListBox에서 draw/hit projected node 수가 window 이하.
- [ ] projected id가 canonical mutation API에 직접 전달되면 test fail.
- [ ] Preview/Publish RAC render와 Skia render가 같은 data/template source를 사용.
- [ ] component별 Layout/Appearance/Typography section 복제가 새 format schema에 들어가지 않음.
- [ ] Properties Panel은 semantic preset props만 쓰고, Style Panel은 explicit `style.*`
      override만 쓴다.
- [ ] DataTable binding, API endpoint binding, static seed fallback이 root data runtime을 통해
      resolve되고 node-local runtime data store가 생성되지 않음.
- [ ] system-owned `page-components` origins는 preview/publish에서 제외되고, template source
      navigation과 migration repair에서만 사용됨.
- [ ] page frame Slot projection에서 click/drop/style edit이 render id가 아니라
      `ref-descendants` route로 변환됨.
- [ ] layout-affecting update가 existing layout publish/projection version/synthetic map
      invalidation을 발생시키고, paint-only update는 layout publish를 피함.
- [ ] Button `onPress`, ListBox `onSelectionChange`/`onAction`, Table `onSelectionChange`가
      root events/actions dispatcher로 bridge됨.
- [ ] Table parity matrix의 columnMapping, columnGroups, sorting, resizing, pagination/infinite,
      heightMode, API dataMapping 각각이 supported/deferred fixture로 고정됨.
- [ ] `icon_font`는 internal primitive source kind로만 등록되고 RAC starter-derived definition과
      섞이지 않음.
- [ ] ref instance edit은 inherited defaults를 복사하지 않고 override만 저장하며, origin edit은
      impacted instance confirmation을 거침.
- [ ] cross-check: Format/Panel/Preview/Skia/Layout 5-layer 결과표 작성.
