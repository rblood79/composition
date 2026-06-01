# ADR-920: RAC Format Interactive Projected Tree

## Status

Proposed - 2026-06-01

## Context

React Aria Components(RAC)의 Button, ListBox, Table, GridList 등은 Builder의 Skia
렌더링 엔진에서 사용할 수 있어야 한다. ADR-920의 규범 입력은
`packages/react-aria-starter/src`의 Adobe RAC starter와 Pencil App format JSON이다.
`ComponentSpec`/`render.shapes()` 기반 컴포넌트 설계는 이 ADR의 출발점, 정합성 기준,
schema 결정 근거로 사용하지 않는다.

collection을 데이터 배열만으로 표현하면 Pencil App과 같은 tree structure가 사라진다.
tree가 사라지면 깊은 템플릿의 size, padding, gap, line-height, nested frame 계산이
row마다 근사값으로 대체되고, 트리가 깊어질수록 Skia/Preview/Panel의 size 정합성이
급격히 낮아진다.

layout/style/size도 컴포넌트별로 복제하면 같은 문제가 반복된다. Pencil식 `layout`,
`gap`, `padding`, `fill`, typography, semantic size는 Button, ListBoxItem, Tabs,
Table cell 등 모든 component/part가 공유하는 format capability여야 한다. 각 RAC component
definition은 이 공통 capability를 어떤 part에 허용하고 어떤 semantic prop(`size`,
`variant`, `orientation` 등)이 어떤 style patch로 해석되는지만 선언한다. component마다
별도 layout/style vocabulary를 만들지 않는다.

Pencil App에서 이 역할의 핵심은 `frame`이다. Pencil schema의 `Frame`은 graphics,
children, layout을 함께 가진 container이며 `layout: "horizontal" | "vertical" | "none"`,
`gap`, `padding`, `justifyContent`, `alignItems`, `width`/`height`, `fill`, `stroke`,
`cornerRadius`, `clip`, `slot`, `reusable`을 같은 node에 둔다. 따라서 ADR-920의 canonical
format도 CSS `display:flex`를 원본 개념으로 저장하지 않고, Pencil식 `frame`/`layout`
contract를 SSOT로 둔 뒤 Preview/Publish adapter에서만 CSS로 변환한다.

또한 Builder의 Skia 화면은 단순 미리보기가 아니라 직접 조작 가능한 editor surface다.
사용자는 Skia에서 클릭/더블클릭으로 ListBox row, Table cell, row 내부 Text/Icon 같은
하위 노드에 접근할 수 있어야 한다. 따라서 collection row는 canonical 저장 노드로
전부 materialize하지 않더라도, Skia runtime에서는 hit-test와 selection이 가능한
projected tree로 존재해야 한다.

**Hard Constraints**:

1. `ComponentSpec`/`render.shapes()`는 ADR-920의 source of truth, schema input,
   visual token input이 아니다. 필요한 compatibility는 별도 integration layer에서
   format 값을 읽는 consumer로만 구현한다.
2. D1 DOM/접근성은 RAC가 권위다. keyboard, ARIA, focus, selection semantics를 Skia가
   임의 재구현하지 않는다.
3. D2 component props와 D3 visual/style 값은 `FormatCapabilityRegistry` +
   `RacFormatDefinition` + format document가 단일 source다. Preview, Publish, Style Panel,
   Properties Panel, Skia는 같은 resolver를 소비한다.
4. layout, appearance, typography, sizing은 component-local schema가 아니라 공통
   `FormatCapabilityRegistry`에서 온다. `rac.listbox.item`, `rac.tabs`, `rac.button`,
   `rac.table.cell`, `text`는 같은 style property vocabulary를 공유하고, component
   definition은 capability allow-list와 part binding만 선언한다.
5. `props.size` 같은 semantic prop은 default preset이다. `style.fontSize` 같은 style field는
   사용자가 명시 수정한 override다. Resolver는 preset default를 먼저 만들고, explicit
   `style.*` override가 있으면 해당 field는 override 값을 우선한다.
6. `frame`은 semantic-free layout/container primitive로 first-class node다. RAC component는
   접근성/interaction semantics를 담당하고, layout container 역할은 frame contract를
   재사용하거나 명시적 `frame` child에 위임한다.
7. Pencil App처럼 structure tree가 보존되어야 한다. collection도 template subtree를
   가져야 하며, size/layout 계산은 `items`가 아니라 template tree를 기준으로 한다.
8. Skia는 반복 collection의 보이는 viewport window만 렌더링한다. 1,000/10,000 rows를
   canonical tree나 Skia scene에 전부 생성하지 않는다.
9. Skia Builder는 projected 하위 노드를 hit-test 가능하게 만들어 클릭/더블클릭 drill-in,
   text/data edit, template style edit을 지원해야 한다.
10. projected row/cell id는 canonical mutation target으로 직접 사용하지 않는다. write는
    template edit, data edit, item override edit 중 하나로 명시 route한다.
11. Button, ListBox, Table 첫 proof는 text까지 Skia에서 정상 렌더링되어야 한다. DOM fallback
    또는 hidden HTML overlay에 의존하지 않는다.
12. collection data의 저장 권위는 기존 Builder data surface와 충돌하면 안 된다. node-local
    static data는 detached seed/example에만 허용하고, runtime data는 root
    `collections`/`apiEndpoints`/`variables`와 element-level binding reference를 통해 resolve한다.
13. `frame` contract는 Pencil식 layout primitive뿐 아니라 현재 Builder의 page frame binding,
    Slot fill, projected Slot DnD/mutation route와 연결되어야 한다. render-space projected id와
    canonical-space write target을 분리한다.
14. ADR-920 resolver는 별도 layout engine을 만들지 않는다. 기존 layout publish, synthetic element,
    projection version, dirty tracking boundary와 연결되어 Skia/Layer Tree/Preview가 같은 layout
    invalidation signal을 소비해야 한다.
15. events/actions/dataBinding은 RAC/Pencil core schema에 섞지 않는다. composition-only behavior는
    `x-composition`/root behavior collection extension으로 유지하고, Preview/Publish adapter가
    `onPress`, `onSelectionChange`, `onAction` 같은 RAC callback으로 bridge한다.
16. `Icon`/`icon_font`는 RAC primitive가 아니라 composition internal primitive다. clean-source schema의
    예외로 명시하고, ListBoxItem/Button/Table cell slot tree에서 text와 같은 first-class child target으로
    다룬다.

**Soft Constraints**:

- Pencil format의 `children`, `reusable`, `type:"ref"`, `descendants`, `slot`,
  theme variables 철학을 최대한 유지한다.
- Clean-source boundary를 유지한다. RAC starter와 Pencil format에서 직접 도출되지 않은
  builder/spec 계열 개념은 schema에 들어갈 수 없다.
- 대규모 family cutover 대신 Button -> ListBox -> Table 순서로 proof surface를 좁힌다.
- Panel UX는 "items-only"와 "tree-only"의 이중 모드가 아니라 template tree와 projected
  rows를 한 mental model 안에서 보여준다.

## Alternatives Considered

### 대안 A: items-only collection renderer

- 설명: `props.items`/`rows`만 저장하고 ListBox/Table renderer가 row를 직접 반복 paint한다.
  template tree는 JSON에 보존하지 않는다.
- 위험:
  - 기술: MED - RAC dynamic collection에는 맞지만 Builder editing target이 부족하다.
  - 성능: LOW - visible range만 그리기 쉽다.
  - 유지보수: HIGH - size/layout/panel/Skia가 각자 row metric을 재계산해 drift가 누적된다.
  - 마이그레이션: MED - tree 기반 authoring mental model로 다시 전환하기 어렵다.

### 대안 B: 모든 row를 canonical tree에 materialize

- 설명: collection data row마다 실제 `ListBoxItem`/`Row`/`Cell` canonical child를 생성한다.
  Pencil tree와 Skia hit-test는 단순해진다.
- 위험:
  - 기술: MED - 구조는 명확하지만 data refresh와 history semantics가 복잡해진다.
  - 성능: CRITICAL - 10,000 row에서 document, history, layout, Layer Tree, Skia scene이 폭증한다.
  - 유지보수: HIGH - data와 structure가 중복 SSOT가 된다.
  - 마이그레이션: HIGH - data source와 document structure 사이의 동기화 계약이 복잡해진다.

### 대안 C: hidden template pointer + flat Skia hit rectangles

- 설명: `itemTemplateRef` 같은 hidden pointer만 두고, Skia에는 row/cell rectangle hit target만
  제공한다. 실제 하위 Text/Icon tree는 Panel에서만 편집한다.
- 위험:
  - 기술: MED - 구현은 가능하지만 Skia Builder의 직접 조작 모델과 어긋난다.
  - 성능: LOW - flat hit map은 가볍다.
  - 유지보수: HIGH - Panel tree, Skia hit target, Preview tree가 서로 다른 모델이 된다.
  - 마이그레이션: MED - template source를 숨겨야 하므로 Pencil/ref mental model과 충돌한다.

### 대안 D: Template Tree + Interactive Projected Tree (채택)

- 설명:
  - format document는 Pencil처럼 `children[]` template tree를 보존한다.
  - 반복 데이터는 `collection` binding/static seed contract로 resolve하되 root data store와 중복하지 않는다.
  - Skia/Layer Tree/selection은 `template tree x visible data window`로 projected tree를 만든다.
  - projected node는 hit-test와 drill-in 대상이지만 canonical 저장 노드가 아니다.
  - write는 template, data, item override route 중 하나로 명시 변환한다.
- 위험:
  - 기술: HIGH - resolver, projected id, hit tree, edit route, culling이 함께 필요하다.
  - 성능: MED - visible window만 유지해야 하고 template layout cache가 필요하다.
  - 유지보수: MED - canonical tree와 projected tree boundary를 지속적으로 검증해야 한다.
  - 마이그레이션: MED - pre-ADR-920 consumer는 새 format resolver를 읽는 integration layer로만 붙여야 한다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  L   |    H     |      M       |     1      |
| B    |  M   |  C   |    H     |      H       |     3      |
| C    |  M   |  L   |    H     |      M       |     1      |
| D    |  H   |  M   |    M     |      M       |     1      |

루프 판정: 모든 대안이 HIGH+를 하나 이상 갖는다. B는 CRITICAL이 있어 폐기한다.
A/C는 핵심 사용자 요구(tree structure, Skia 하위 노드 접근)를 만족하지 못하는
HIGH가 남는다. D의 HIGH는 구현 복잡도이며, Gate를 통해 phase별로 절단 가능한
위험이므로 D를 선택한다.

## Decision

**대안 D: Template Tree + Interactive Projected Tree**를 선택한다.

선택 근거:

1. Pencil App 방식처럼 실제 structure tree를 유지하므로 깊은 template에서도 size/layout
   계산을 근사값으로 낮추지 않는다.
2. 반복 데이터는 canonical children으로 복제하지 않아 Skia/Layer Tree/History 성능을
   지킨다.
3. Skia Builder 안에서 클릭/더블클릭으로 projected 하위 노드에 접근할 수 있다.
4. RAC Preview/Publish는 같은 format tree에서 RAC props와 children render function을
   생성하므로 D1 접근성 권위를 유지한다.
5. Button 같은 leaf primitive와 ListBox/Table 같은 collection family를 같은
   capability/definition resolver 체인으로 다룰 수 있다.

기각 사유:

- **대안 A 기각**: items-only는 row metric을 빠르게 그릴 수 있지만 Pencil식 tree와
  하위 노드 편집을 잃는다.
- **대안 B 기각**: canonical materialization은 tree access를 해결하지만 대용량 collection에서
  성능과 persistence가 붕괴한다.
- **대안 C 기각**: hidden pointer와 flat hit rectangles는 Skia editor의 직접 조작 요구와
  Preview tree를 분리한다.

> 구현 상세: [920-rac-format-interactive-projected-tree-breakdown.md](design/920-rac-format-interactive-projected-tree-breakdown.md)

## Gates

| Gate                              | 시점    | 통과 조건                                                                                                                                     | 실패 시 대안                                       |
| --------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| G1 Format resolver                | Phase 1 | Button `props.size="sm"` 기본값과 `style.fontSize` override precedence가 Panel/Preview/Publish/Skia에서 동일                                  | resolver 범위를 Button leaf로 축소 후 재설계       |
| G2 Template tree layout           | Phase 2 | ListBoxItem template subtree의 padding/gap/font/lineHeight가 Skia row height와 Preview DOM height에 같은 입력으로 반영                        | items-only fallback 금지, layout resolver부터 보정 |
| G3 Interactive projected hit tree | Phase 3 | Skia에서 row 내부 Text/Icon을 클릭해 deepest projected node selection, 더블클릭 drill-in/text edit route 검증                                 | flat row selection만 허용하지 말고 phase hold      |
| G4 Visible-only performance       | Phase 4 | 10,000 row ListBox/Table에서 Skia draw/hit node 수가 viewport window + overscan 이하                                                          | row windowing 우선 구현 후 Table 확장 보류         |
| G5 Mutation boundary              | Phase 4 | projected id가 canonical update/remove/move API에 직접 유입되는 negative fixture PASS                                                         | write route registry 도입 전 진행 중단             |
| G6 Preview/Publish parity         | Phase 5 | RAC Preview/Publish가 같은 format tree와 data source로 Button/ListBox/Table을 렌더                                                            | Skia-only path merge 금지                          |
| G7 Clean-source cross-check       | Phase 5 | Button/ListBox/Table에 대해 Format/Factory/Panel/Preview/Skia가 capability/definition registry만 read source로 사용하는지 검증                | spec-derived schema 유입 시 phase hold             |
| G8 Shared style capability        | Phase 5 | Button/ListBoxItem/Tabs/Table cell이 `layout`/`gap`/`padding`/fill/typography/size를 같은 capability registry에서 resolve                     | component별 style schema 반복 발견 시 phase hold   |
| G9 Pencil frame contract          | Phase 5 | Button/ListBoxItem/Tabs/Table cell이 `frame` layout contract(`layout`/`gap`/`padding`/slot/reusable)를 유지하고 CSS는 adapter 산출로만 생성   | CSS-style canonical field가 schema에 남으면 hold   |
| G10 Data SSOT bridge              | Phase 2 | ListBox/Table static seed, DataTable binding, API endpoint binding이 기존 root data store와 `useCollectionData` semantics를 중복 없이 resolve | node-local API/data SSOT 생성 시 phase hold        |
| G11 Page frame/Slot projection    | Phase 3 | page-applied frame Slot projection에서 click, DnD, canonical mutation target이 render id가 아니라 ref descendant route로 변환됨               | generic frame만 구현하고 page frame은 phase hold   |
| G12 Layout publication bridge     | Phase 4 | `resolveTemplateLayout()` 결과가 layout publish/projection version/synthetic element invalidation과 같은 신호로 Skia rebuild를 유도           | 독립 layout cache가 stale render를 만들면 중단     |
| G13 Behavior bridge               | Phase 5 | Button `onPress`, ListBox `onSelectionChange`/`onAction`, Table `onSelectionChange`가 root events/actions와 Preview/Publish에서 연결됨        | visual-only proof로 승격 금지                      |
| G14 Table parity matrix           | Phase 5 | column mapping, column groups, sorting, resizing, pagination/infinite, height mode, API data mapping의 지원/deferral이 명시된 fixture PASS    | Table proof 범위를 ListBox 이후로 재절단           |

## Consequences

### Positive

- Builder Skia 화면이 Pencil처럼 tree-aware editor surface가 된다.
- 반복 collection에서 대용량 성능과 하위 노드 접근을 동시에 유지한다.
- size/layout 정합성은 template subtree 계산을 통해 깊은 트리에서도 보존된다.
- layout/style/size vocabulary가 component family마다 반복되지 않아 ListBoxItem, Tabs,
  Table cell 같은 깊은 node도 같은 Panel/Skia resolver를 공유한다.
- Pencil의 `frame`처럼 layout, graphics, children, slot, reusable/ref가 한 tree 안에 남아
  RAC component가 깊어져도 structure와 metric source가 분리되지 않는다.
- `FormatCapabilityRegistry`와 `RacFormatDefinition`이 Preview, Publish, Panel, Skia의 공통
  read source가 된다.
- RAC starter와 Pencil format 기준의 새 component family를 현재 builder 내부 구현과 분리해
  설계할 수 있다.

### Negative

- projected tree와 canonical tree의 boundary가 추가되어 구현 난도가 높다.
- selection, hover, edit, mutation route에 projected id guard가 필요하다.
- variable row height와 nested template layout cache가 초기 성능 위험이다.
- 공통 style capability를 너무 넓게 열면 RAC part에 맞지 않는 layout/style 조합이 생길 수
  있어 part-level allow-list와 validation이 필요하다.
- Table은 2D row/column culling과 cell hit-test가 필요해 ListBox보다 proof 난도가 높다.
- pre-ADR-920 renderer/spec consumer는 compatibility boundary로 격리해야 하며, 중간 단계에서
  dual consumer path가 발생할 수 있다.
- 기존 data store, page frame Slot projection, behavior extension을 누락하면 새 format SSOT가
  기존 Builder SSOT와 병렬로 생겨 migration drift가 발생한다.
- `Icon` 같은 internal primitive 예외를 과도하게 열면 clean-source boundary가 흐려질 수 있으므로
  예외 목록과 source kind를 고정해야 한다.
