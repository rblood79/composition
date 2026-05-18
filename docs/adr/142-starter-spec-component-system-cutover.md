# ADR-142: Starter + Spec vNext 기반 컴포넌트 시스템 family 단위 cutover

## Status

Proposed — 2026-05-18

## Context

composition 의 컴포넌트 시스템은 여러 차례의 builder 방식 변경, local DB 형식 변경, `format`/`reusable`/`origin`/`instance`/`slot` 모델 보정, CSS 최적화, Preview/Skia 경로 보정이 누적되면서 정본이 여러 개처럼 보이는 상태가 되었다. 기존 `packages/shared/src/components` 는 React Aria Components 기반 구현, React Spectrum 개념의 props/customization, composition 전용 최적화 CSS, legacy renderer/factory compatibility 가 섞인 active surface 이다.

이제 기준은 바뀐다. `packages/react-aria-starter/src` 를 React Aria starter upstream snapshot 으로 내부에 보관하고, composition 의 새 공식 컴포넌트 시스템은 starter 원본과 **새로 정의하는 `StarterComponentContract`(Spec vNext)** 를 기준으로 다시 세운다. starter 원본은 제품 코드처럼 직접 수정하지 않으며, composition 의 차이는 contract / manifest / runtime adapter / generated CSS / Skia visual model 로 표현한다.

**기존 `packages/specs` 의 `ComponentSpec`(`render.shapes()` 모델)은 새 시스템의 기준이 아니며, 참조·확장·migration 대상도 아니다.** 불완전한 구버전 Spec 을 참조하거나 고도화하는 방식은 정합 실패를 반복한다. 근거:

1. 기존 `ReactRenderer.renderToReact()` 는 className/dataAttributes/style 만 산출해 starter 의 RAC component/parts/slots/render-prop state/collection children plan 을 표현하지 못한다 — `packages/specs/src/renderers/ReactRenderer.ts`.
2. 기존 `Table.spec.ts` 는 structural table 이 아니라 `props.columns`/`rows` 와 sample fallback 을 shape 로 직접 그린다. 새 Table 의 기반이 아니라 폐기 예시다 — `packages/specs/src/components/Table.spec.ts`.
3. Skia 는 `spec.render.shapes()` → `specShapesToSkia` 파이프라인이라, 이 함수를 SSOT 로 삼으면 같은 실패가 반복된다 — `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`.

따라서 새 SSOT 는 구버전 Spec 이 아니라 **starter(D1) + canonical format + 새 contract layer** 위에 세운다.

본 ADR 의 핵심은 "기존 `shared/components` 를 점진 보수한다"가 아니다. 새 컴포넌트 시스템을 `react-aria-starter` + `StarterComponentContract` 기준으로 완성하고, 공통 기반(`StarterComponentContract` 정의 + `starterComponentManifest` + Tree·Table structure contract + Preview reusable·ref·descendants·slot resolver + `shared` official surface skeleton)을 먼저 고정한 뒤, Builder 의 공식 Component Panel / Factory / Preview / Publish / Skia 경로를 **family 단위로 atomic 하게** cutover 한다. 전역 단일 스위치가 아니라, 한 family 가 전환될 때 그 family 의 4경로(Panel / Factory / Preview·Publish / Skia)가 동시에 전환되고, family 내부에서 신·구 경로를 섞지 않는다 (family-gated atomic cutover).

`StarterComponentContract`(Spec vNext)는 shape 생성 함수가 아니라 **contract** 다. starter 의 RAC primitive/parts/slots/render-props 구조, canonical props schema, structure(leaf/slot-container/collection/recursive-collection/table), visual(token/variant/state/part)을 선언하고, CSS·RAC props·Skia draw command·Inspector fields 를 모두 contract 의 **output**(`toGeneratedCss` / `toRacProps` / `toSkiaVisualModel` / `toInspectorFields`)으로 산출한다.

특히 Tree/Table 은 본 ADR 의 능력 검증 대상이다. 구버전 Spec 은 Tree/Table 의 구조적 요구(재귀 collection, expansion, row/column/cell/header 모델, virtualized table layout, selection/sort/resize 상태)를 표현하지 못했다. 이는 Tree/Table 이 contract 로 불가능하다는 뜻이 아니라, 구버전 Spec 에 recursive collection/table structure contract 가 없었다는 뜻이다. 새 contract 는 Tree 를 `structure.kind:"recursive-collection"`, Table 을 `structure.kind:"table"`(row/column/cell/header) 로 표현하며, Tree/Table 을 기존 수동 구현으로 우회한 채 cutover 를 완료했다고 보지 않는다. 반복 구조는 `reusable` origin + `type:"ref"` instance + `slot` + `descendants` delta 로 표현하고, row/cell/tree node 를 전수 복제하지 않는다.

현재 Preview 의 직접 문제도 이 범위에 포함한다. `reusable` origin, `type:"ref"` instance, `descendants` override, `slot` fill 이 canonical resolver 에서 resolve 되더라도, Preview render consumer 가 resolved `node.children` 를 공식 입력으로 소비하지 않으면 복제된 instance/slot content 가 보이지 않는다 — `CanonicalNodeRenderer` 가 rendererMap hit 경로에서 legacy render context 에 children lookup 을 위임한다. 따라서 Preview cutover 는 새 shared component import 만이 아니라, 모든 Preview 경로(fallback 포함)가 resolved canonical tree 를 source 로 렌더링하도록 고정하는 작업이다.

**3-domain 분류 (ADR-063 정합)**:

- **D1 DOM/접근성/상호작용**: `packages/react-aria-starter/src` 의 React Aria Components 구현이 참조 원본 + runtime source 다. composition 은 RAC 동작을 수동 재구현하지 않는다.
- **D2 Props/API**: `StarterComponentContract.canonical`(propsSchema/defaults/dynamicProps)가 Builder 노출 API 의 SSOT 다. 기존 `ComponentSpec` props schema 는 legacy 다.
- **D3 시각/구조**: `StarterComponentContract` 의 `visual`(tokens/variants/states/parts) + `structure` 가 시각·구조 SSOT 다. Preview generated CSS / Skia visual model / RAC props / Inspector fields 는 모두 contract 의 `outputs` 다. starter CSS 와 기존 `ComponentSpec.render.shapes()` 는 reference/legacy 이며 runtime SSOT 가 아니다.
- **Document/runtime format**: canonical `CompositionDocument` 가 저장/편집/runtime mutation source 이며, `children[]`, `props`, `reusable`, `type:"ref"`, `ref`, `descendants`, `slot` 모델을 유지한다. contract 의 입력으로 소비되며 변경하지 않는다.

**Hard Constraints**:

1. `packages/react-aria-starter/src` 는 upstream snapshot 으로 보존한다. cutover 작업은 starter 원본 파일을 composition-specific behavior 로 직접 수정하지 않는다.
2. Builder/Preview/Publish 의 공식 import surface 는 `packages/shared/src/components` 이다. `apps/builder` 가 starter source path 를 직접 import 하는 것은 inventory/test/tooling allowlist 를 제외하고 금지한다.
3. 새 Component Panel 등록은 `starterComponentManifest` + `StarterComponentContract` 를 통과해야 한다. contract 없는 placeable component 는 공식 Panel 에 등록하지 않는다.
4. canonical schema 변경은 본 ADR 범위 밖이다. `CompositionDocument`, `CanonicalNode.props`, origin/instance/ref/descendants/slot shape 는 변경하지 않는다.
5. 기존 `ComponentSpec`(`render.shapes()` 124개), `ReactRenderer`, `specShapesToSkia`, `rendererMap`, 수동 ComponentFactory creator, old CSS, legacy shared component 는 새 시스템이 참조·확장하지 않는다. legacy boundary 로 격리하며, legacy document import/export compatibility + cutover migration reference 로만 유지한다.
6. Skia 는 starter DOM/CSS 를 파싱하지 않으며, 기존 `render.shapes()`/`specShapesToSkia` 도 새 SSOT 로 삼지 않는다. `StarterComponentContract` 의 `toSkiaVisualModel` output(ResolvedVisualModel/DrawCommand)만 소비한다.
7. Tree/Table 은 legacy 수동 구현으로 full support 를 주장하지 않는다. full support 는 contract 가 recursive collection/table structure 를 표현하고 Preview/Skia 가 동일 resolved structure 를 소비할 때만 인정한다.
8. Tree/Table 의 반복 구조는 canonical node 복제 대신 reusable origin/template + ref instance + slot fill + descendants delta 로 표현한다. 대량 row/cell/tree node 를 materialize 하는 것은 renderer/layout boundary 의 resolved projection 으로만 허용한다.
9. Preview/Publish 공식 runtime 은 raw canonical node 또는 legacy `elements[]` tree 가 아니라 resolved canonical tree 를 소비해야 한다. `reusable` origin, `type:"ref"` instance, root props override, `descendants` 3-mode override, `slot` fill 이 렌더러 입력 전에 resolve 되어야 하며, fallback render 경로가 resolved children 을 잃어버리면 안 된다.
10. `StarterComponentContract` 는 구버전 `ComponentSpec` 에서 파생·migration 하지 않고, starter 컴포넌트 + canonical format 으로부터 새로 작성한다. 불완전한 구버전 Spec 을 참조·확장하는 것은 정합 실패 반복의 직접 원인이다.

**Soft Constraints**:

- cutover 는 전역 단일 스위치가 아니라 family 단위 atomic 으로 수행한다. 공통 기반 gate 를 먼저 고정한 뒤 family 순서대로 전환하며, 한 family 의 4경로(Panel / Factory / Preview·Publish / Skia)는 동시에 전환하고 family 내부 신·구 혼재는 금지한다. 준비 구현은 기존 시스템 옆에서 병렬로 완성할 수 있다.
- 기존 프로젝트의 legacy component payload 를 즉시 삭제하지 않는다. import/export/cloud/publish compatibility 가 필요한 boundary 는 유지하되 active Builder authoring source 에서 제외한다.
- `packages/shared/src/components` 라는 public surface 는 유지하되, 그 내부 책임은 새 starter + contract runtime surface 로 재정의한다.

## Alternatives Considered

### 대안 A: 기존 shared/components 를 점진 보수

- 설명: 기존 `packages/shared/src/components` 파일을 유지하고, starter 업데이트분을 컴포넌트별로 조금씩 wrapper/CSS/Spec 에 반영한다.
- 근거: import surface 변동이 작고 단기 회귀 위험이 낮다.
- 위험:
  - 기술: MEDIUM — 기존 rendererMap/factory/CSS/Spec 분기가 계속 남는다.
  - 성능: LOW — runtime 방식 자체는 유지된다.
  - 유지보수: HIGH — 현재 문제의 원인인 "구버전 + 신버전 + adapter + fallback" 혼합 구조가 유지된다.
  - 마이그레이션: MEDIUM — component family 별 drift 가 장기간 공존한다.

### 대안 B: starter + StarterComponentContract 기반 새 시스템 병렬 구축 후 공식 경로 family-gated cutover

- 설명: starter inventory / `StarterComponentContract` 정의 / `starterComponentManifest` / runtime adapter / generated CSS / Skia visual model contract 를 기존 경로 옆에서 완성한 뒤, Component Panel / Factory / Preview / Publish / Skia official registration 을 새 시스템으로 전환한다 (전환 단위는 Decision 에서 family-gated atomic 으로 구체화). 기존 구현은 `legacy` boundary 로 내린다.
- 근거: 사용자의 명시 결정 — "새 컴포넌트 시스템을 starter + contract 기준으로 새로 세운다." 기존 불완전한 Spec 을 참조하지 않으므로 정합 실패 반복을 끊는다. ADR-139 registration gate 와 ADR-141 starter style sync 경험을 기반으로 신규 정본을 명확히 세운다.
- 위험:
  - 기술: MEDIUM — registry/factory/preview/skia/css 를 동시에 바꾸는 큰 cutover 이다. 단 새 contract 가 구버전 Spec 과 결합하지 않아 양자 의존이 없다.
  - 성능: LOW — runtime 컴포넌트 수 증가보다 registry/adapter 구조 변경이 중심이다.
  - 유지보수: LOW — cutover 후 공식 source 가 starter + contract + canonical 으로 단일화된다.
  - 마이그레이션: MEDIUM — legacy payload compatibility 를 boundary 로 유지하면서 active authoring 만 전환한다.

### 대안 C: starter source 를 Builder/Preview 가 직접 import

- 설명: `packages/react-aria-starter/src` 를 제품 런타임 컴포넌트로 직접 사용하고, shared wrapper 계층을 최소화한다.
- 근거: upstream 과 가장 가까운 코드 경로가 된다.
- 위험:
  - 기술: HIGH — upstream snapshot 교체 시 Builder/Preview/Publish import 가 직접 흔들린다.
  - 성능: LOW
  - 유지보수: HIGH — composition-specific props, canonical payload, Inspector, Skia contract 를 둘 위치가 사라진다.
  - 마이그레이션: MEDIUM — 기존 `@composition/shared/components` import surface 를 대규모 교체해야 한다.

### 대안 D: starter 를 shared 로 복사하고 shared 안에서 직접 수정

- 설명: starter 컴포넌트를 `packages/shared/src/components` 로 복사한 뒤 composition 최적화와 CSS 변경을 직접 적용한다.
- 근거: 단기적으로는 새 파일들이 shared official surface 에 바로 들어온다.
- 위험:
  - 기술: MEDIUM — 초기 cutover 는 가능하나 upstream 재동기화가 수동 diff 에 의존한다.
  - 성능: LOW
  - 유지보수: HIGH — upstream 원본과 composition 수정본이 다시 분기한다.
  - 마이그레이션: HIGH — 기존 shared 와 복사본의 경계가 흐려져 중복 제거 비용이 커진다.

### 대안 E: 기존 ComponentSpec 을 확장해 starter 구조를 흡수

- 설명: 기존 `packages/specs` 의 `ComponentSpec`(`render.shapes()` 모델)에 RAC parts/slots/render-prop/structure 필드를 덧붙여 starter 컴포넌트를 표현한다. `starterComponentManifest` 는 기존 ComponentSpec 을 참조한다.
- 근거: 기존 124 spec / `CSSGenerator` / `TAG_SPEC_MAP` 인프라를 재사용한다.
- 위험:
  - 기술: HIGH — `ReactRenderer` 는 className/dataAttributes/style 만 산출해 RAC component/parts/render-prop state 를 표현할 수 없고, `render.shapes()` 는 시각을 직접 그린다. 확장으로는 starter 구조를 담을 수 없다.
  - 성능: LOW
  - 유지보수: HIGH — 불완전한 구버전 모델 위에 필드를 누적 → Builder↔Preview 정합 실패가 반복된다.
  - 마이그레이션: MEDIUM — 기존 spec 을 그대로 두므로 초기 변동은 작으나 실패가 이연된다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  L   |    H     |      M       |     1      |
| B    |  M   |  L   |    L     |      M       |     0      |
| C    |  H   |  L   |    H     |      M       |     2      |
| D    |  M   |  L   |    H     |      H       |     2      |
| E    |  H   |  L   |    H     |      M       |     2      |

대안 B 만 HIGH+ 0건이다. 다른 대안은 유지보수 / upstream coupling / 불완전 모델 누적 에서 HIGH 위험을 남긴다. 추가 대안 루프 불필요.

## Decision

**대안 B: starter + StarterComponentContract 기반 새 시스템 병렬 구축 후 공식 경로 family-gated cutover** 를 선택한다.

세부 결정:

1. `packages/react-aria-starter/src` 는 upstream original snapshot 이며 read-only 기준선이다. composition-specific 수정은 그 안에 넣지 않는다.
2. `packages/shared/src/components` 는 cutover 후 새 공식 runtime component surface 로 재정의한다. 별도 `components/starter` 하위 경로를 공식 surface 로 두지 않는다.
3. 기존 shared 구현은 cutover 준비 과정에서 `packages/shared/src/components/legacy` boundary 로 격리한다. 공식 Component Panel / Factory / Preview 경로에서는 legacy 를 직접 사용하지 않는다.
4. Component Panel 등록 source 는 `starterComponentManifest`(= `StarterComponentContract` registry)로 통합한다. manual component list 는 compatibility 또는 UI grouping metadata 로만 남긴다.
5. Factory/default props 는 `StarterComponentContract.canonical.defaults` + canonical node props 를 기준으로 생성한다. legacy `Element[]` payload 를 신규 authoring source 로 되살리지 않는다.
6. Preview/Publish 는 새 shared component surface(starter import + contract adapter)와 `StarterComponentContract` runtime 을 사용한다. `rendererMap` 과 `ReactRenderer` 는 legacy migration fallback 으로만 남긴다.
7. CSS 는 `StarterComponentContract.outputs.toGeneratedCss` 로 산출한다. starter CSS 는 reference diff 이며 runtime SSOT 가 아니다. generator 가 표현하지 못하는 structural CSS 만 좁은 manual escape hatch 로 허용한다.
8. Skia/Canvas 는 `StarterComponentContract.outputs.toSkiaVisualModel`(ResolvedVisualModel/DrawCommand)을 소비한다. 기존 `render.shapes()`/`specShapesToSkia` 파이프라인은 legacy 이며, starter DOM 구조나 CSS selector 를 Skia 가 직접 재해석하지 않는다.
9. `Frame`, `Slot`, reusable origin/instance authoring tool 처럼 starter 에 없는 composition-native component 는 `packages/shared/src/components` 공식 surface 에 유지하되, 동일하게 `StarterComponentContract`(`source: "composition-native"`) + manifest 등록을 요구한다.
10. Tree/Table 은 새 contract 표현력의 acceptance test 로 취급한다. Tree/Table 을 공식 컴포넌트로 유지하려면 Tree/Table 전용 structure contract 와 parity fixture 를 통과해야 한다. 통과 전에는 Tree·Table family cutover 를 완료 처리하지 않는다.
11. Tree/Table 의 resource strategy 는 reusable/origin/instance/slot 기반 구조 공유다. 각 row/cell/tree node 를 canonical document 에 전수 복제하지 않고, origin template 과 instance delta 를 resolve 해서 Preview/Skia 에 공급한다.
12. Preview 는 `resolveCanonicalDocument()` 결과를 렌더링 source 로 삼고, 모든 Preview 경로(`CanonicalNodeRenderer` + fallback)가 resolved `node.children` 를 소비해야 한다. 기존 legacy render context 에만 children lookup 을 위임하는 경로는 cutover blocker 로 본다.
13. cutover 는 전역 단일 gate 가 아니라 **family-gated atomic cutover** 로 수행한다. 먼저 공통 기반 gate(`StarterComponentContract` 정의 + `starterComponentManifest` + Tree/Table structure contract + Preview reusable/ref/descendants/slot resolved-tree resolver + `shared` official surface skeleton)를 1회 고정한다. 그 뒤 family 순서(primitives·actions → fields → selection → collections → Tree·Table → overlays → date·color → composition-native)대로 전환하며, 한 family 가 전환될 때 그 family 의 Component Panel / Factory / Preview·Publish / Skia 4경로를 동시에 전환한다. family 내부에서 신·구 경로를 섞지 않는다. 한 family 의 통과 조건(manifest 등록 / contract / Factory / Preview·Publish / Skia / generated CSS / registration contract / targeted fixture)이 실패하면 그 family 만 legacy fallback 또는 hidden 으로 두고, 다른 family 진행은 막지 않는다.
14. 기존 `ComponentSpec`(124) / `ReactRenderer` / `render.shapes()` / `specShapesToSkia` / `rendererMap` 은 새 시스템이 참조·확장하지 않는다. cutover 기간에는 legacy document 호환 + migration reference 로만 두고, family cutover 가 끝나면 해당 family 의 legacy spec 은 boundary 에 격리된다. `StarterComponentContract` 는 starter 컴포넌트 + canonical format 으로부터 새로 작성한다.

기각 사유:

- **대안 A 기각**: 현재 문제의 원인인 다중 정본과 adapter/fallback 혼합을 유지한다. "기존과 크게 다를 게 없다"는 사용자 지적과 충돌한다.
- **대안 C 기각**: starter upstream snapshot 을 제품 runtime 으로 직접 import 하면 upstream update 때 제품 코드가 흔들리고, contract/Skia/Inspector 계약 위치가 사라진다.
- **대안 D 기각**: starter 를 복사해 shared 안에서 수정하면 기존의 downstream fork 문제가 반복된다. upstream 보존 + contract delta 라는 핵심 원칙과 충돌한다.
- **대안 E 기각**: 기존 `ComponentSpec` 은 `render.shapes()` 중심이라 starter 의 RAC component/parts/render-prop 구조를 표현하지 못한다(`ReactRenderer` 는 className/dataAttributes/style 만 산출). 불완전한 모델 위에 필드를 덧붙이면 정합 실패가 반복된다. 사용자 검증 판정(2026-05-19): "기존 불완전한 spec 을 참조하면 다시 실패한다."

> 구현 상세: [142-starter-spec-component-system-cutover-breakdown.md](design/142-starter-spec-component-system-cutover-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                    | 심각도 | 대응                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | cutover 범위가 Component Panel / Factory / Preview / Publish / Skia / CSS 를 동시에 건드려 회귀 blast radius 가 크다                                    |  MED   | 공통 기반 gate 선행 + family-gated atomic cutover 로 blast radius 를 family 1개로 한정. family 별 manifest/contract/preview/skia parity·registration contract test 통과 후 4경로 동시 전환 |
| R2  | starter inventory 와 existing shared/registry 간 누락이 생겨 Panel 에 보이지 않거나 Factory 가 생성하지 못하는 컴포넌트 발생                            |  MED   | starter inventory audit + ADR-139 registration contract 확장. placeable component 는 manifest/contract/factory/preview/skia support level 을 모두 선언                                     |
| R3  | starter 시각 기준이 contract/generated CSS/Skia 로 완전히 재현되지 않아 Preview 와 Skia 가 다시 갈라짐                                                  |  MED   | contract 의 `visual` D3 정의를 먼저 확정하고 `toGeneratedCss` snapshot + `toSkiaVisualModel` snapshot 을 같은 fixture 로 검증                                                              |
| R4  | legacy component import 를 active code path 에서 모두 제거하지 못해 새/구 시스템이 장기간 공존                                                          |  MED   | legacy allowlist grep gate. allowlist 외 `components/legacy` import 는 실패 처리                                                                                                           |
| R5  | 기존 프로젝트의 legacy payload 가 새 factory/renderer 에서 깨짐                                                                                         |  MED   | active authoring cutover 와 import/export compatibility 를 분리. legacy adapter 는 boundary 에 유지하고 canonical resolver round-trip fixture 로 검증                                      |
| R6  | `packages/shared/src/components` public surface 를 유지하면서 내부 파일을 교체해 downstream import path 는 유지되지만 의미 변화가 커짐                  |  MED   | barrel export contract test + component smoke fixture. cutover release note 에 active behavior 변경 범위를 명시                                                                            |
| R7  | upstream starter update 때마다 다시 수동 diff 가 커짐                                                                                                   |  LOW   | `packages/react-aria-starter/UPSTREAM.md` 정책 + inventory diff workflow + contract delta update gate                                                                                      |
| R8  | Tree/Table 이 기존 구버전 Spec 표현력 부족을 다시 legacy 수동 구현으로 우회할 위험                                                                      |  MED   | Tree/Table 전용 recursive collection/table structure contract 를 Gate 로 추가. Gate 실패 시 Tree·Table family cutover 완료를 보류                                                          |
| R9  | Tree/Table 구조를 canonical node 로 전수 materialize 해 document 크기·layout 비용이 폭증할 위험                                                         |  MED   | reusable origin/template + ref instance + slot + descendants delta 를 반복 구조의 저장 모델로 사용. materialized row/cell/tree node 는 resolved projection/cache 로만 생성                 |
| R10 | Preview 가 resolved children 대신 legacy `elements[]`/rendererMap context 를 계속 소비해 reusable instance 또는 slot-filled content 가 보이지 않을 위험 |  MED   | Preview resolved-tree fixture 를 Gate 로 추가. `CanonicalNodeRenderer` 와 fallback render context 가 `ResolvedNode.children` 를 렌더 source 로 소비하는지 검증                             |
| R11 | `StarterComponentContract`(Spec vNext)는 새 모델 — PartContract/SlotContract/ChildrenPlan/VisualContract/outputs 변환기 설계 surface 가 크다            |  MED   | Phase 1 에서 contract 타입 + 4 outputs 변환기를 primitives/Button family 로 먼저 확정(파일럿)하고, Tree/Table 로 표현력 acceptance 검증                                                    |
| R12 | 기존 124 `ComponentSpec` / `ReactRenderer` / Skia `render.shapes` 파이프라인 교체 범위가 크다                                                           |  MED   | 새 시스템이 구버전 Spec 을 참조하지 않으므로 양자 결합이 없다. family 별 점진 전환, 기존 spec 은 legacy boundary 격리(migration reference) — 동시 재작성 불필요                            |

잔존 HIGH 위험 없음.

## Gates

공통 기반 gate(G0~G3 및 G2-T·G2-R·G4-P)는 family cutover 착수 전 1회 통과한다. family cutover gate(G4·G5·G6)는 family 마다 반복 적용하며 한 family 의 4경로를 동시에 검증한다. G7 은 전 family 가 `cutover:"starter"` 에 도달했을 때 1회 통과한다.

| Gate | 시점                      | 통과 조건                                                                                                                                                                                                                                                                          | 실패 시 대안                                      |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| G0   | Phase 0 freeze            | 신규 active component 등록이 legacy shared/manual list 로 추가되지 않음. starter source formatting/prod edit 보호 유지                                                                                                                                                             | cutover 착수 보류                                 |
| G1   | Inventory 완료            | `packages/react-aria-starter/src` component inventory 와 current shared/spec/panel/factory/renderer registry diff 문서화. 기존 124 `ComponentSpec` 의 legacy 처분 명시                                                                                                             | 누락 family 를 먼저 분리                          |
| G2   | Manifest/Contract 완료    | placeable entry 100% 가 `StarterComponentContract`, default canonical props, panel category, dynamic props policy, skia support level 을 선언                                                                                                                                      | 해당 entry hidden 처리                            |
| G2-T | Tree/Table contract 완료  | contract 가 recursive collection/table structure, row/column/cell/header, expansion/selection/sort/resize 상태를 선언하고 Preview/Skia fixture 를 통과                                                                                                                             | Tree·Table family cutover 보류                    |
| G2-R | Tree/Table resource 완료  | Tree/Table 반복 구조가 reusable origin/template + ref instance + slot + descendants delta 로 저장되고, materialized projection 은 cache boundary 에 한정                                                                                                                           | Tree·Table family cutover 보류                    |
| G3   | Runtime surface 완료      | `packages/shared/src/components` public exports 가 새 surface 로 빌드되고, composition-native component(Frame/Slot 등)는 manifest 에 명시 + Preview 가 `resolveCanonicalDocument()` resolved tree 를 단일 render source 로 소비 (reusable/ref/descendants/slot fixture F1~F4 통과) | legacy fallback 유지 후 cutover 보류              |
| G4   | Builder cutover 완료      | Component Panel / Factory / Inspector 가 manifest + contract 를 source 로 사용하고 manual duplicate registration 이 없음                                                                                                                                                           | legacy path 롤백                                  |
| G4-P | Preview ref/slot 완료     | Preview canonical fixture 가 reusable origin, ref instance, root props override, descendants mode A/B/C, slot children replacement 를 모두 렌더링하고 unintended duplicate/invisible node 가 없음                                                                                  | atomic cutover 보류                               |
| G5   | Preview/Publish/Skia 정합 | canonical fixture 세트가 React Preview, `toGeneratedCss` snapshot, `toSkiaVisualModel`/draw command snapshot 을 통과                                                                                                                                                               | 해당 component hidden 또는 legacy fallback        |
| G6   | Legacy 격리               | allowlist 외 active runtime import 에서 `packages/shared/src/components/legacy` 와 starter direct import 0건. active 경로의 `ComponentSpec`/`ReactRenderer`/`render.shapes` 참조 0건                                                                                               | cutover 보류                                      |
| G7   | Final verification        | `pnpm run codex:guard`, `pnpm run codex:typecheck`, `pnpm run codex:preflight`, family 별 targeted registration/preview/skia tests 통과 + 전 family `cutover` 가 `starter` 도달                                                                                                    | 해당 family commit revert (다른 family 영향 없음) |

## Consequences

### Positive

- 공식 컴포넌트 source 가 `react-aria-starter` upstream + `StarterComponentContract` + canonical document 로 정리된다.
- Component Panel, Factory, Preview, Publish, Skia 가 같은 manifest/contract 를 소비해 등록 누락과 CSS/Skia drift 를 줄인다.
- CSS·RAC props·Skia draw command·Inspector fields 가 contract 의 명시 output 이라, 시각 정본이 한 곳에 모인다.
- starter 업데이트를 원본 파일 수정이 아니라 inventory diff + contract delta 로 처리할 수 있다.
- 기존 `packages/shared/src/components` import surface 는 유지하면서 내부 책임만 새 시스템으로 재정의한다.

### Negative

- cutover 준비 규모가 크다. inventory, `StarterComponentContract` 모델 정의, 4 outputs 변환기, registry, tests, visual parity fixture 작업이 먼저 필요하다.
- 기존 124 `ComponentSpec` / `ReactRenderer` / Skia `render.shapes` 파이프라인은 legacy 로 남아 cutover 기간 동안 새 시스템과 공존한다.
- 기존 shared 구현을 legacy boundary 로 이동하는 과정에서 import path/barrel export 정리가 필요하다.
- generated CSS 로 표현하지 못하는 RAC structural CSS 는 여전히 좁은 manual escape hatch 로 남는다.
- family cutover 직후 해당 family 의 기존 프로젝트 시각 결과가 starter baseline + contract delta 기준으로 달라질 수 있다.
