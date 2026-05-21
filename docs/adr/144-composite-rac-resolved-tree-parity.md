# ADR-144: Composite RAC resolved-tree 정합성 및 slot-editable component contract

## Status

Proposed — 2026-05-21

## Context

ADR-142 는 `componentCatalog` / `PrimitiveBinding` / catalog-first Panel·Factory·Preview·Skia
route 를 닫았고 `Implemented` 로 승격됐다. 그러나 실제 composite component
정합성 관점에서는 "catalog-only routing" 과 "editable resolved-tree parity" 가
다른 acceptance surface 였다.

현재 `Tabs` 는 대표적인 gap 이다. catalog entry 는 `defaultProps.items[]` 와
`skiaPrimitive: { kind: "tabs" }` 를 갖는 props-only primitive 로 등록되어 있고,
Preview 는 resolved children 대신 `<Tabs {...tabsProps}>` 를 직접 렌더한다.
Skia 는 `buildGenericTabsNode()` 안에서 `${node.id}:tab:*`, `${node.id}:panel:*`
형태의 synthetic child 를 만든다. 이 synthetic child 는 canonical document node 가
아니므로 selection owner, edit path, undo/history, Preview DOM marker 와 정합되지
않는다.

Pencil app 에서 생성한 RAC/shadcn design-system JSON 은 반대 방향을 보여준다.
RAC showcase 는 `Tab`, `TabList`, `Tabs`, `Table`, `Tree`, `Select`, `ComboBox`,
date/color 계열을 reusable frame/ref/descendants 구조로 표현한다. slot tabs fixture
는 `slot: ["coMmv", "QY0Ka"]` 와 instance children refs 로 tab item 을 채운다.
shadcn fixture 는 동일 slot/ref/descendants pattern 을 `Dropdown`, `Table Row`,
`Table`, nested slot 에 반복한다. 즉 composite 구조는 props array 가 아니라
canonical reusable origin + `type:"ref"` instance + `descendants` override +
`slot` fill 로 표현되어야 한다.

ADR-144 는 ADR-142 를 대체하지 않는다. ADR-142 의 leaf RAC `PrimitiveBinding` 과
catalog entrypoint 를 유지하되, composite RAC component 의 completion gate 를
"catalog route active" 에서 "Preview·Skia·selection·editing 이 같은 resolved tree 를
소비" 로 보정한다.

**Hard Constraints**:

1. `CompositionDocument` schema 는 변경하지 않는다. 기존 `children[]`, `props`,
   `reusable`, `type:"ref"`, `ref`, `descendants`, `slot` shape 를 사용한다.
2. 사용자 선택·편집 가능한 composite subpart 는 canonical node 또는 resolved
   canonical node 여야 한다. Skia/Preview private synthetic node 를 editable owner 로
   만들지 않는다.
3. Preview, Skia, selection overlay, hit-test, Inspector edit path 는 같은 resolved
   tree identity 를 소비해야 한다. bounds 는 target별 backend 산출값일 수 있지만
   owner id/path 는 같아야 한다.
4. RAC keyboard/focus/selection/overlay behavior 는 `react-aria-components` 를
   runtime primitive 로 유지한다. keyboard navigation 을 composition 이 수동
   재구현하지 않는다.
5. `items[]`, `columns[]`, `rows[]` 같은 collection props 는 RAC runtime projection
   입력일 수 있지만, editable composite subpart 의 authoring SSOT 가 될 수 없다.
6. ADR-910 의 deterministic rendering optimization 은 parity 이후의 성능 layer 다.
   wrong tree 를 빠르게 그리는 것으로 ADR-144 gate 를 대체하지 않는다.
7. legacy `render.shapes()` / legacy childtree 는 adapter/reference boundary 로만
   남긴다. ADR-144 는 legacy component spec 을 되살리지 않는다.

**Soft Constraints**:

- 첫 vertical slice 는 `Tabs` 로 한다. 현재 gap 이 사용자 증상과 직접 연결되고,
  `RAC-showcase.json`, `slot-tabs-selection.json`, `shadcn-design-system.json` 모두
  tabs pattern 을 제공한다.
- JSON fixtures 는 format contract evidence 로 사용한다. 디자인 자체를 golden 으로
  복제하지 않는다.
- `PrimitiveBinding` 은 leaf RAC behavior boundary 로 유지한다. composite authoring
  구조를 props-only binding 으로 닫지 않는다.

## Alternatives Considered

### 대안 A: ADR-142 props-only primitive 모델 유지

- 설명: `Tabs`, `Select`, `ComboBox`, `Table`, `Tree` 를 계속 `items[]`/`rows[]`
  props 와 `skiaPrimitive` 로 렌더한다.
- 근거: 이미 catalog route 와 generic Skia path 가 존재하며 단기 코드 변경량이
  작다.
- 위험:
  - 기술: HIGH — Preview/RAC 내부 DOM 과 Skia synthetic tree identity 가 달라
    selection/editing owner 를 안정적으로 매핑할 수 없다.
  - 성능: LOW — 현 경로는 빠르지만 wrong tree 를 빠르게 그릴 뿐이다.
  - 유지보수: HIGH — component별 props projection, Preview internals, Skia synthetic
    geometry, Inspector edit path 가 다시 병렬 SSOT 가 된다.
  - 마이그레이션: LOW — 현 payload 를 유지한다.

### 대안 B: ADR-142 재오픈 후 completion definition 교체

- 설명: ADR-142 를 `Implemented` 에서 되돌리고, composite resolved-tree parity 를
  ADR-142 안의 미완 gate 로 재정의한다.
- 근거: 문제의 원인이 ADR-142 completion surface 에 있으므로 같은 ADR 안에서
  닫을 수 있다.
- 위험:
  - 기술: MEDIUM — 기술 방향은 맞지만 ADR-142 의 leaf primitive cutover 산출물과
    composite parity 산출물이 섞인다.
  - 성능: MEDIUM — ADR-142 G2/G7 성능 gate 와 ADR-910 perf gate 의 경계가 흐려진다.
  - 유지보수: MEDIUM — 완료된 leaf primitive routing 이 다시 불안정한 상태로 보인다.
  - 마이그레이션: HIGH — README/changelog/completed archive 상태를 되돌려야 하며
    이미 land 된 family cutover history 가 혼재된다.

### 대안 C: 새 corrective ADR 로 composite resolved-tree contract 추가

- 설명: ADR-142 를 `Amends ADR-142` 로 보정한다. leaf primitive routing 은 유지하고,
  composite component 는 reusable origin/ref/descendants/slot resolved tree 를
  authoring/rendering/editing SSOT 로 삼는 별도 gate 를 둔다.
- 근거: 현재 canonical format 과 resolver 는 이미 필요한 primitive 를 갖고 있다.
  문제는 component catalog/Preview/Skia/selection/editing 이 그 format 을 composite
  completion으로 소비하지 않는 데 있다.
- 위험:
  - 기술: MEDIUM — resolved tree identity 를 Skia hit-test/selection/edit path 까지
    확장해야 한다.
  - 성능: MEDIUM — props-only synthetic drawing 보다 resolved child 수가 늘 수 있다.
  - 유지보수: LOW — composite 구조의 SSOT 가 canonical document 로 수렴한다.
  - 마이그레이션: MEDIUM — existing props-only component payload 를 adapter/projection
    boundary 로 다뤄야 한다.

### 대안 D: DOM/CSS 측정 기반 Skia parity

- 설명: React Aria DOM/CSS 를 실제 브라우저에서 측정하고 그 결과를 Skia selection
  geometry 로 가져온다.
- 근거: CSS Preview 와 가장 가까운 geometry 를 얻을 수 있다.
- 위험:
  - 기술: HIGH — Builder Skia renderer 가 DOM measurement lifecycle 에 종속된다.
  - 성능: HIGH — layout measurement bridge 가 interaction/render loop 를 막을 수 있다.
  - 유지보수: MEDIUM — DOM/CSS 변화와 Skia cache invalidation 의 coupled surface 가
    늘어난다.
  - 마이그레이션: HIGH — Preview iframe/runtime boundary 와 Canvas renderer boundary 를
    재설계해야 한다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  H   |  L   |    H     |      L       |     2      |
| B    |  M   |  M   |    M     |      H       |     1      |
| C    |  M   |  M   |    L     |      M       |     0      |
| D    |  H   |  H   |    M     |      H       |     3      |

대안 C 만 HIGH 위험이 없다. A 는 현재 증상을 유지하고, B 는 문서 이력과 완료된 leaf
primitive 산출물을 되돌리는 비용이 크며, D 는 renderer architecture 를 불필요하게
DOM measurement 에 묶는다.

## Decision

**대안 C: 새 corrective ADR 로 composite resolved-tree contract 추가**를 선택한다.

세부 결정:

1. ADR-144 는 `Amends ADR-142` 이다. ADR-142 의 `PrimitiveBinding` / catalog route
   / leaf RAC wrapper 산출물은 유지한다.
2. Composite RAC component 의 authoring SSOT 는 canonical reusable document 이다.
   component catalog 는 composite family 에 대해 props-only primitive entry 가 아니라
   reusable origin/ref instance creation path 를 제공해야 한다.
3. Editable subpart 는 resolved canonical node identity 를 가져야 한다. Tab label,
   Tab indicator, TabPanel body, table cell, dropdown item 같은 subpart 는 Skia private
   id 로만 존재하면 안 된다.
4. `items[]`/`rows[]`/`columns[]` 는 RAC runtime projection 이다. Projection 은
   resolved tree 에서 파생할 수 있지만, 사용자가 편집하는 구조의 persisted SSOT 는
   `children[]`/`ref`/`descendants`/`slot` 이다.
5. `slot?: false | string[]` 는 삽입 가능한 reusable component id 목록이다. slot
   child 는 real child/ref 로 채워지고, nested slot 도 같은 규칙을 따른다.
6. Preview 는 resolved children 을 렌더하고 RAC behavior 에 필요한 props 를 tree 에서
   project 한다. Skia 는 같은 resolved children 을 그리며 editable owner id/path 를
   보존한다.
7. Selection/editing 은 rendered backend id 가 아니라 canonical owner id/path 로
   동작한다. ref instance 의 descendant edit 은 root props override 또는
   `descendants` stable id path patch 로 기록한다.
8. ADR-910 은 ADR-144 parity gate 이후 적용한다. ADR-144 는 correct tree 와 owner
   identity 를 먼저 고정하고, ADR-910 은 그 tree 의 draw cost 를 줄인다.

기각 사유:

- **대안 A 기각**: current Tabs symptom 의 root cause 인 props-only/synthetic tree 를
  유지한다.
- **대안 B 기각**: ADR-142 leaf primitive cutover 를 되돌릴 이유는 없다. 문제는
  completion surface 보정이므로 별도 corrective ADR 이 더 좁고 추적 가능하다.
- **대안 D 기각**: DOM/CSS measurement 는 parity shortcut 처럼 보이지만 renderer
  lifecycle coupling 과 performance risk 가 크다. composition 은 canonical resolved
  tree SSOT 를 먼저 고정해야 한다.

> 구현 상세: [144-composite-rac-resolved-tree-parity-breakdown.md](design/144-composite-rac-resolved-tree-parity-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                      | 심각도 | 대응                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------- |
| R1  | Skia hit-test/selection overlay 가 synthetic ids 에 의존하는 잔존 경로를 놓치면 editability gap 이 남는다.                                |  HIGH  | G3/G4 에서 Tabs label/panel/body selection과 `${tabsId}:panel:*` editable-owner 금지를 test gate 로 둔다.              |
| R2  | nested slot resolution 이 Layer tree 에서는 맞지만 Skia/Preview 에서 다른 parent/bounds 로 소비될 수 있다.                                |  MED   | G1 fixture 와 G6 family matrix 에 nested slot case 를 포함한다.                                                        |
| R3  | RAC behavior projection 을 tree 구조에서 파생하는 과정에서 keyboard/focus semantics 를 깨뜨릴 수 있다.                                    |  MED   | G5 에 React Aria official testing pattern 기반 behavior tests 를 둔다.                                                 |
| R4  | real resolved children 수 증가로 Skia frame cost 가 늘 수 있다.                                                                           |  MED   | G7 에 ADR-910 handoff 전 perf baseline 을 요구한다. 최적화는 ADR-910 에서 수행한다.                                    |
| R5  | 기존 props-only `Tabs.items[]` payload 와 새 resolved-tree payload 가 공존하는 migration period 에 Inspector/edit path 가 혼동될 수 있다. |  MED   | legacy props payload 는 adapter/projection boundary 로 분류하고 new authoring path 는 reusable/ref tree 로만 생성한다. |
| R6  | JSON fixtures 가 Pencil app export format change 로 drift 할 수 있다.                                                                     |  LOW   | fixtures 는 repo-local contract evidence 로 고정하고, `.pen` 원본은 직접 읽지 않는다.                                  |

잔존 HIGH 위험: R1 1건. G3/G4 가 통과하기 전에는 Tabs slice 를 완료로 보지 않는다.

## Gates

| Gate | 시점                     | 통과 조건                                                                                                                                   | 실패 시 대안                          |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| G0   | Phase 0                  | ADR-142 current route, Tabs props-only implementation, fixture inventory 를 line evidence 로 freeze                                         | ADR-144 scope 재작성                  |
| G1   | Phase 1                  | `RAC-showcase.json`, `slot-tabs-selection.json`, `shadcn-design-system.json` fixture 가 reusable/ref/descendants/slot contract test 로 통과 | contract 축소 또는 fixture 분리       |
| G2   | Tabs creation            | Component Panel/Factory 가 새 Tabs 를 reusable origin + ref/slot children 구조로 생성                                                       | creation path 중단, adapter-only 유지 |
| G3   | Tabs Preview/Skia parity | TabList/Tab/TabPanel/body owner id/path 와 bounds 가 Preview marker, Skia node, selection overlay 에서 매칭                                 | Skia/Preview consumer 재설계          |
| G4   | Tabs editability         | Tab label, active indicator, panel body 선택/편집이 root props 또는 descendants patch 로 저장되고 undo/redo/hydration 후 유지               | phase rollback                        |
| G5   | RAC behavior             | Tabs keyboard navigation/focus/selection behavior 가 RAC contract test 를 통과                                                              | behavior projection 수정              |
| G6   | Family expansion         | collections/table/tree/overlay/date-color family 별 coverage matrix 에서 synthetic editable owner 0건                                       | family hold                           |
| G7   | Perf handoff             | parity 통과 tree 에 대해 baseline frame/memory 측정 완료, ADR-910 적용 entry 명확화                                                         | ADR-910 진입 보류                     |

## Consequences

### Positive

- ADR-142 의 catalog-only routing 성과를 유지하면서 composite editability gap 을 별도
  gate 로 닫는다.
- Preview, Skia, selection, Inspector 가 같은 canonical owner identity 를 보게 된다.
- Pencil app 의 `reusable` / `ref` / `descendants` / `slot` format 과 composition
  canonical format 이 같은 방향으로 수렴한다.
- ADR-910 은 correct resolved tree 를 대상으로 최적화할 수 있다.

### Negative

- `Tabs` 같은 composite component 는 기존 props-only payload 보다 문서 구조가 커진다.
- Component Panel/Factory/Preview/Skia/selection/Inspector 를 한 slice 에서 동시에
  닫아야 하므로 첫 Tabs slice 의 blast radius 가 작지 않다.
- 기존 props-only component payload 는 adapter/projection boundary 로 유지되어
  migration period 동안 두 표현을 구분해야 한다.
