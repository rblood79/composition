# ADR-142: RAC primitive binding + canonical 문서 기반 컴포넌트 시스템 family 단위 cutover

## Status

Implemented — 2026-06-02 (scope 축소 — 아래 완료 경계 참조)

> Proposed 2026-05-19 (컴포넌트당 contract 모델 → canonical 문서 모델 개정). Round 2 review "승인 가능"([reviews/142.md](../reviews/142.md)) + Phase 0 inventory 실측 recalibration([§Phase 0 Inventory Recalibration](#phase-0-inventory-recalibration-2026-05-30)) 후 대안 E 결정 승인 → **Accepted (2026-05-30)**.
>
> **Implemented (2026-06-02) — 축소된 scope.** 대안 E(canonical 문서 SSOT + RAC primitive binding)의 공통 기반(G2)과 family 단위 cutover 가 land 됐다. **DOM/Inspector 경로는 7 family 전부 catalog generic 으로 전환**(family ①~⑧, `cutover:"catalog"`). **Skia generic 전환은 box+text+skiaPrimitive 합성으로 재현 가능한 family 까지** 완료 — primitives(①)·fields(②)·selection(③, Slider 제외)·Tree(⑤)·overlays Dialog/Modal/Popover/DropZone(⑥). **Skia 잔여(`skiaLegacy:true` 유지)는 후속 ADR 로 명시 이관** — collections 7종(ListBox/Menu/Select/ComboBox/Tabs/TagGroup/GridList)·Table·date 4종(Calendar/RangeCalendar/DatePicker/DateRangePicker)·Tooltip·Slider 의 Skia generic backend(items 순회 / 2D grid / 날짜 grid 생성기)는 [ADR-146](146-listboxitem-ref-template-row-projection.md)(ListBox 단일 proof, Implemented) + [ADR-920](920-rac-format-interactive-projected-tree.md)(Interactive Projected Tree — collection/Table Skia 하위 노드 직접 접근 + virtualization, Proposed)이 이어받는다. color(TailSwatch/ColorPicker arc·wheel·gradient)는 사용자 지시(2026-05-31)로 본 ADR scope 외.
>
> **축소 근거(사용자 결정 2026-06-02)**: collections 의 Skia generic backend(데이터-시각 결합형 multi-item / 2D grid 렌더)는 R4(HIGH)가 가리키는 대규모 영역으로, ADR-142 의 family loop 안에서 atomic 하게 처리하기에 무게가 과하다. DOM cutover 와 box+text 재현 가능 Skia 는 본 ADR 에서 종결하고, 데이터-결합형 Skia 는 ADR-920 의 projected-tree 메커니즘으로 분리한다. ADR-142 의 §7 완료 판정도 이 경계로 갱신한다(아래 §7 갱신 주석 참조).

## Context

**목표: 검증된 pencil document format 과 검증된 Adobe React Aria Components(RAC)를 Builder(Skia)에서 만나게 한다.** pencil format 은 문서/구조 layer(canonical document — frame/ref/reusable/descendants/slot)이고, RAC 는 D1(DOM/접근성/상호작용) layer 다. 둘 다 각각 검증된 자산이다. ADR-142 는 이 둘을 발명하지 않고 잇는다 — 두 자산이 만나는 지점은 canonical 문서 + `PrimitiveBinding` 이며, 그 결과를 DOM(RAC 가 실제 실행)과 Skia(RAC 의 시각을 generic 렌더러가 재현) 두 경로가 같은 모습으로 소비한다. 새 위험은 두 자산 자체가 아니라 그 둘을 잇는 seam 에 있다(R1).

composition 의 컴포넌트 시스템은 builder 방식 변경, local DB 형식 변경, reusable/origin/instance/slot 모델 보정, CSS 최적화, Preview/Skia 경로 보정이 누적되면서 정본이 여러 개인 상태가 되었다. 컴포넌트 하나를 등록하려면 서로 독립된 6개 목록(Component Panel hard-coded list / Factory creator map / `rendererMap` / `getDefaultProps` map / `BASE_TAG_SPEC_MAP` / builder `TAG_SPEC_MAP`)에 각각 등록해야 한다. 이 목록들이 어긋나면서 등록 누락과 CSS/Skia drift 가 반복된다.

`packages/specs/src/components/*.spec.ts` 124개는 컴포넌트당 정의 파일이다. 이 모델(`ComponentSpec.render.shapes()`)은 시각을 직접 그리는 함수 중심이라, RAC 의 구조(parts/slots/render-prop state, collection children)를 표현하지 못한다. 그 결과 Builder(Skia)와 Preview(DOM)가 같은 컴포넌트를 다르게 그리는 정합 실패가 반복됐다.

이 다중 정본은 두 방향의 전파를 모두 깨뜨린다. ① **렌더 타깃 간** — 컴포넌트 시각을 한 번 고쳐도 Skia 와 Preview 가 별도 경로라 한쪽만 반영되고 drift 한다. ② **컴포넌트 파생·재사용 간** — RAC 에서 Button 의 press/focus 동작은 ToggleButton·MenuItem 이 공유하고, ListBox 는 ComboBox·Select 안에서 재사용된다. 그러나 현재는 컴포넌트마다 spec/CSS/renderer 가 따로라 base 를 고쳐도 파생이 따라오지 않아 전부 개별 수정해야 하고, 여러 곳에서 재사용되는 ListBox 류는 소비처마다 어긋난 상태다.

본 ADR 의 기준은 이렇다. **컴포넌트는 코드 정의 파일이 아니라 canonical 문서다.** Card·Section·아이콘이 붙은 Button 같은 조합 컴포넌트(composed component)는 `reusable: true` 인 frame 노드 — 사용자가 화면을 만들 때 쓰는 그 canonical 문서와 같은 데이터다. 그 인스턴스는 `type: "ref"` 노드다.

코드로 남는 정의는 단 하나다. DOM/접근성/상호작용이 환원 불가능한 leaf RAC primitive 약 35개의 `PrimitiveBinding`. binding 은 "이 primitive 를 `react-aria-components` 어디서 가져오고, canonical props 를 RAC props 로 어떻게 넘기는가"만 선언한다. 색·크기·변형 같은 시각은 binding 에 넣지 않는다.

이 방향은 두 가지를 명시적으로 배제한다.

1. 기존 `ComponentSpec` 을 확장해 RAC 구조를 담는 방식 — `render.shapes()` 모델이 RAC 구조를 표현하지 못해 실패가 반복된다.
2. 컴포넌트당 새 contract 객체(`StarterComponentContract`)를 만드는 방식 — 스키마를 두껍게 해도 "컴포넌트당 손으로 쓰는 정의 파일 + 컴포넌트당 변환기"라는 종류는 `ComponentSpec` 과 같다. 그것은 canonical 문서와 평행한 두 번째 SSOT 가 되어 같은 drift 를 반복한다.

자세한 비교는 Alternatives 참조. 직전 개정안(2026-05-18~05-19)이 2번 방식이었고, 사용자 검토에서 기각됐다.

**이 방향은 새 시스템을 처음부터 짓는 것이 아니다.** composition 은 ADR-111~131(15개 이상)을 거쳐 canonical document 모델을 storage + runtime SSOT 로 이미 전환했다(ADR-116/122). canonical 문서를 화면 트리로 푸는 resolver(`resolveCanonicalDocument()`)와 그 노드 렌더러(`CanonicalNodeRenderer`)는 이미 구현·테스트 통과 상태다 — 다만 Preview 가 그 결과를 주 렌더 source 로 쓰지 않고 legacy `elements[]` 경로를 쓰고 있을 뿐이다. theme/tokens(ADR-110/021), events/actions(ADR-131), collections(ADR-132)도 이미 root collection 이다. 본 ADR 은 그 전환을 마무리한다.

### 3-domain 분류 (ADR-063 정합)

- **D1 DOM/접근성/상호작용**: `react-aria-components`(npm)가 절대 권위이자 runtime primitive 다. `apps/builder` 와 `packages/shared` 의 `catalog:` 의존으로 설치되어 있고, `packages/shared/src/components` 의 57개 파일이 직접 import 한다. composition 은 RAC 동작을 수동 재구현하지 않는다.
- **D2 Props/API**: 조합 컴포넌트는 reusable frame 노드가 선언한 propsSchema 가 SSOT 다. primitive 는 `PrimitiveBinding` 이 받는 props 집합이 SSOT 다. 컴포넌트당 Spec 파일이 아니다.
- **D3 시각/구조**: 시각 SSOT 는 theme/tokens root collection(ADR-110)이다. 구조 SSOT 는 canonical 문서 트리 자체다. 컴포넌트당 `visual` 필드를 두지 않는다. `packages/react-aria-starter/src`(Adobe starter kit 의 vendored snapshot, 55 컴포넌트)는 이 D3 시각/구조를 저작할 때 참조하는 **reference 코드** 다 — runtime import 대상이 아니며(repo 전역 import 0건), `private` 패키지로 `main`/`exports` 가 없다.
- **Document/runtime format**: canonical `CompositionDocument` 가 저장·편집·runtime mutation source 다. 본 ADR 은 이 스키마를 변경하지 않고 그 위에 세운다.

ADR-063 과의 관계: ADR-063 은 D3 시각 SSOT 를 "Spec" 으로 불렀다. 본 ADR 은 그 D3 SSOT 를 컴포넌트당 spec 파일에서 theme/tokens root collection 으로 옮긴다 — ADR-063 이 의도한 "단일 시각 source" 를 그대로 따르되 그 source 의 위치를 명확히 한다. 컴포넌트당 spec 파일을 D3 SSOT 로 둔 ADR-036 의 메커니즘은 본 ADR 로 폐기된다.

### Hard Constraints

1. D1 runtime primitive 은 `react-aria-components`(npm)다. `packages/react-aria-starter/src` 는 D3 시각/구조 참조용 upstream snapshot 이며 runtime import 대상이 아니다. cutover 작업은 starter 원본 파일을 직접 수정하지 않고, 제품 코드가 starter 를 runtime import 하지도 않는다.
2. 새 시스템은 기존 124 `ComponentSpec` / `ReactRenderer` / `CSSGenerator` / `specShapesToSkia` / `render.shapes()` / `rendererMap` 을 참조·확장·migration source 로 쓰지 않는다. legacy boundary 로 격리한다.
3. 컴포넌트당 별도 정의 파일(구 `ComponentSpec`, 또는 컴포넌트당 contract 객체)을 새로 만들지 않는다. 조합 컴포넌트는 canonical reusable 문서다. 코드 정의는 leaf RAC primitive 약 35개의 `PrimitiveBinding` 으로 한정한다.
4. canonical schema(`CompositionDocument`, `CanonicalNode.props`, reusable/ref/descendants/slot)는 변경하지 않는다. 본 ADR 범위 밖이다.
5. D3 시각 SSOT 는 theme/tokens root collection 이다. 컴포넌트당 `visual` 필드 또는 컴포넌트당 시각 정의 파일을 두지 않는다.
6. 조합 컴포넌트의 reusable 문서는 starter + 디자인 의도로부터 새로 저작한다. 깨진 구버전 spec 에서 자동 변환·파생하지 않는다 (사용자 제약, 2026-05-19: "기존 불완전한 spec 을 참조하면 다시 실패한다").
7. Builder/Preview/Publish 의 공식 import surface 는 `packages/shared/src/components` 다. primitive wrapper 는 `react-aria-components` 를 import 한다. `apps/builder` 가 RAC primitive 를 wrapper 없이 직접 import 하거나 starter source path 를 import 하는 것은 inventory/test/tooling allowlist 를 제외하고 금지한다.
8. Preview/Publish 공식 runtime 은 resolved canonical tree 를 단일 render source 로 소비한다. reusable origin / `type:"ref"` instance / root props override / `descendants` 3-mode / `slot` fill 이 렌더 입력 전에 resolve 되어야 하며, fallback 경로가 resolved children 을 잃으면 안 된다.
9. Skia 는 RAC DOM/CSS 를 파싱하지 않는다. generic 렌더러가 resolved canonical tree + theme 를 소비하고, 비-DOM-trivial primitive 는 `PrimitiveBinding` 의 `skiaPrimitive` draw module 로 그린다.
10. cutover 는 전역 단일 스위치가 아니라 family(컴포넌트군) 단위 atomic 으로 수행한다. 공통 기반을 먼저 고정한 뒤 family 순서대로 4경로(Component Panel / Factory / Preview·Publish / Skia)를 동시에 전환한다. family 내부에서 신·구 경로를 섞지 않는다. 실패한 family 는 그 family 만 격리하고 다른 family 진행을 막지 않는다.
11. Tree/Table 은 leaf RAC primitive 의 `PrimitiveBinding`(RAC Tree/Table) + collections 데이터(ADR-132)로 구성한다. 수동 우회 구현으로 full support 를 주장하지 않는다.

### Soft Constraints

- 공통 기반 작업은 기존 시스템 옆에서 병렬로 완성할 수 있다. active cutover 만 family 단위 atomic 으로 수행한다.
- 기존 프로젝트의 legacy component payload 를 즉시 삭제하지 않는다. import/export/cloud/publish 호환 boundary 는 유지하되 active Builder authoring source 에서 제외한다.
- `packages/shared/src/components` public surface 는 유지하되 내부 책임을 RAC primitive wrapper 로 재정의한다.

## Alternatives Considered

### 대안 A: 기존 shared/components 점진 보수

- 설명: 기존 `packages/shared/src/components` 파일을 유지하고 starter 업데이트분을 컴포넌트별로 wrapper/CSS/Spec 에 조금씩 반영한다.
- 근거: import surface 변동이 작고 단기 회귀 위험이 낮다.
- 위험: 기술(MEDIUM) — 기존 rendererMap/factory/CSS/Spec 분기가 계속 남는다. 성능(LOW). 유지보수(HIGH) — 현재 문제의 원인인 다중 정본 + adapter + fallback 혼합 구조가 그대로 유지된다. 마이그레이션(MEDIUM).

### 대안 B: 기존 ComponentSpec(render.shapes) 확장

- 설명: 기존 `ComponentSpec` 에 RAC parts/slots/render-prop/structure 필드를 덧붙여 starter 컴포넌트를 표현한다.
- 근거: 기존 124 spec / `CSSGenerator` / `TAG_SPEC_MAP` 인프라를 재사용한다.
- 위험: 기술(HIGH) — `ReactRenderer` 는 className/dataAttributes/style 만 산출해 RAC component/parts/render-prop state 를 표현할 수 없고, `render.shapes()` 는 시각을 직접 그린다. 성능(LOW). 유지보수(HIGH) — 불완전한 구버전 모델 위에 필드를 누적해 Builder↔Preview 정합 실패가 반복된다. 마이그레이션(MEDIUM) — 실패가 이연될 뿐이다.

### 대안 C: 컴포넌트당 contract 객체 (StarterComponentContract / Spec vNext)

- 설명: 컴포넌트마다 `StarterComponentContract` 정의 객체를 만든다. `source`/`rac`/`canonical`/`structure`/`visual` 입력과 4개 output 변환기(`toRacProps`/`toGeneratedCss`/`toSkiaVisualModel`/`toInspectorFields`). manifest 는 이 contract 들의 registry 다.
- 근거: `render.shapes()` 보다 표현력이 크다. starter 의 parts/slots/render-prop 을 담을 수 있다.
- 위험: 기술(MEDIUM) — 표현력 자체는 충분하다. 성능(LOW). 유지보수(HIGH) — "컴포넌트당 손으로 쓰는 정의 파일 + 컴포넌트당 변환기" 라는 종류가 `ComponentSpec` 과 같다. canonical 문서와 평행한 두 번째 SSOT 가 되어 starter(upstream)와도 canonical 문서(downstream)와도 drift 한다. 4개 output 중 3개(`toGeneratedCss`/`toSkiaVisualModel`/`toInspectorFields`)는 (문서 노드 + theme)의 함수이지 컴포넌트당 계약의 산물이 아니다 — 컴포넌트당으로 두면 124개 × 3 변환기를 손으로 유지해야 한다. 마이그레이션(MEDIUM).
- 비고: 본 ADR 의 직전 개정안(2026-05-18~05-19)이 이 대안이었다. 사용자 검토(2026-05-19)에서 "스키마만 두꺼워진 ComponentSpec — 실패 반복" 으로 기각됐다.

### 대안 D: RAC primitive(`react-aria-components`)를 Builder/Preview 가 직접 import

- 설명: shared wrapper 계층을 최소화하고 `react-aria-components` 를 제품 컴포넌트 곳곳에서 직접 import 한다.
- 근거: upstream RAC 와 가장 가까운, 가장 얇은 코드 경로가 된다.
- 위험: 기술(HIGH) — composition props mapping / canonical payload 정규화 / `toRacProps` 투영을 둘 단일 위치가 사라져 57개 이상 파일에 흩어진다. 성능(LOW). 유지보수(HIGH) — Inspector·Skia 경로 연결점이 분산되고, RAC 버전 업데이트가 제품 코드 곳곳을 직접 흔든다. 마이그레이션(MEDIUM).

### 대안 E: Canonical 문서 SSOT + RAC primitive binding (document 모델)

- 설명: 컴포넌트당 정의 파일을 없앤다. 조합 컴포넌트 = canonical reusable 문서(데이터). 코드 정의 = leaf RAC primitive 약 35개의 `PrimitiveBinding`. 시각 = theme/tokens root collection. 렌더 = resolved canonical tree + theme 를 소비하는 generic 렌더러 1개(DOM backend + Skia backend). 등록은 6개 목록 대신 단일 `componentCatalog`.
- 근거: SSOT 가 진짜 하나(canonical 문서)가 된다. ADR-111~131 의 canonical 전환을 마무리한다. 사용자 제약("깨진 spec 참조 금지")을 가장 깨끗하게 지킨다 — 참조할 컴포넌트당 정의가 아예 없다.
- 위험: 기술(HIGH) — generic 렌더러(DOM+Skia) + Preview resolved-tree 소비가 공통 기반의 핵심이며 제품 규모에서 미검증이다. 다만 resolver 와 DOM 렌더러(`CanonicalNodeRenderer`)는 이미 구현·통과 상태라 처음부터는 아니다. 성능(LOW) — runtime 컴포넌트 정의 수가 줄고(124 → ~35 binding) 렌더 경로가 단일화된다. 유지보수(LOW) — 정본이 canonical 문서 하나다. 컴포넌트당 변환기·spec 파일이 없다. 마이그레이션(MEDIUM) — 조합 컴포넌트를 reusable 문서로 새로 저작해야 한다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  L   |    H     |      M       |     1      |
| B    |  H   |  L   |    H     |      M       |     2      |
| C    |  M   |  L   |    H     |      M       |     1      |
| D    |  H   |  L   |    H     |      M       |     2      |
| E    |  H   |  L   |    L     |      M       |     1      |

모든 대안이 HIGH 위험을 최소 1개 가진다. 이 문제 공간에는 HIGH 0건 대안이 존재하지 않는다 — 현 상태 유지(다중 정본)는 그 자체로 매일 실현되는 HIGH 유지보수 위험이다. 따라서 adr-writing.md 의 "최대 2회 루프 후에도 HIGH 이상이면 위험 수용 근거 명시" 절차를 적용한다.

대안 A/C 의 HIGH 는 **유지보수** — 다중 정본/두 번째 SSOT 가 남아 drift 가 무한정 재발하는 위험이다. 대안 B/D 의 HIGH 는 **기술 + 유지보수** 둘 다다. 대안 E 의 HIGH 는 **기술** 하나이며, (a) 1회성이고 (b) 공통 기반 단계로 front-load 되어 단일 Gate 로 관리 가능하며 (c) 이미 구현된 canonical resolver/DOM 렌더러로 일부 완화된다. 회복 불가능한 반복 유지보수 HIGH 보다, gate 로 막을 수 있는 1회성 기술 HIGH 를 수용한다.

## Decision

**대안 E: Canonical 문서 SSOT + RAC primitive binding** 을 선택한다.

세부 결정:

1. 컴포넌트당 정의 파일을 폐기한다. 기존 124 `ComponentSpec` 은 새 시스템의 기준이 아니다.
2. 조합 컴포넌트(Card 등)는 `reusable: true` canonical frame 노드로 정의한다 — 코드가 아니라 데이터다. 인스턴스는 `type:"ref"` 노드다.
3. 코드 정의는 leaf RAC primitive(약 35개)의 `PrimitiveBinding` 으로 한정한다. binding 은 `react-aria-components` import 경로 + RAC parts/slots/states/render-props/dataAttributes + canonical props → RAC props 투영(`toRacProps`)만 선언한다. 시각·변형·구조 필드를 두지 않는다.
4. 등록 SSOT 는 단일 `componentCatalog` 다 — primitive entry(→ `PrimitiveBinding`) + reusable entry(→ canonical reusable 문서 id). 기존 6개 목록을 대체한다. Component Panel / Factory 는 이 catalog 만 소비한다.
5. D3 시각 SSOT 는 theme/tokens root collection 이다. 컴포넌트의 변형(variant)은 노드의 `data-*` 속성 + theme 규칙으로 표현한다. 컴포넌트당 시각 정의를 두지 않는다.
6. 렌더는 resolved canonical tree + theme 를 소비하는 generic 렌더러 하나로 한다. traversal 은 하나, backend 는 둘(DOM/CSS, Skia)이다. CSS·Skia draw·Inspector fields 는 컴포넌트당 산출물이 아니라 이 generic 렌더러가 (문서 + theme)에 대해 만드는 산출물이다.
7. Skia backend 는 RAC DOM/CSS 를 파싱하지 않는다. resolved canonical tree + theme 를 그리고, arc/track/indicator 같은 비-DOM-trivial primitive 는 `PrimitiveBinding.skiaPrimitive` draw module 로 그린다.
8. Preview/Publish 는 `resolveCanonicalDocument()` 결과(resolved canonical tree)를 단일 render source 로 삼는다. `CanonicalNodeRenderer` 와 fallback 경로 모두 resolved `node.children` 를 소비해야 한다. legacy `elements[]` 경로는 명시적 격리 후 제거한다.
9. `packages/shared/src/components` 는 약 35개의 thin RAC primitive wrapper 로 재정의한다(`react-aria-components` import + `toRacProps` + generated CSS class). 조합 컴포넌트는 shared 파일을 갖지 않는다 — 문서다. `Frame`/`Slot`/reusable tooling 같은 composition-native 항목은 catalog 에 등록하되 RAC primitive import 없이 둔다.
10. 조합 컴포넌트의 reusable 문서는 starter + 디자인 의도로부터 새로 저작한다. Builder 안에서 만들고 reusable 로 승격하는 흐름을 사용한다. 깨진 구버전 spec 에서 자동 변환하지 않는다.
11. cutover 는 family 단위 atomic 이다. 공통 기반(`PrimitiveBinding` 타입 + generic 렌더러 + Preview resolved-tree 소비 + `componentCatalog` skeleton)을 1회 고정한 뒤, family 순서(primitives·actions → fields → selection → collections → Tree·Table → overlays → date·color → composition-native)대로 4경로를 동시에 전환한다. family 내부 신·구 혼재는 금지한다. 실패 family 는 그 family 만 격리한다.
12. 기존 `ComponentSpec`(124) / `ReactRenderer` / `CSSGenerator` / `render.shapes()` / `specShapesToSkia` / `rendererMap` 은 legacy boundary 로 격리한다. cutover 기간 동안 legacy 문서 import/export 호환 + migration reference 로만 둔다. 새 시스템은 이들을 import 하지 않는다.
13. 파생·재사용은 별도 파생 그래프 없이 정상화된다. 컴포넌트당 정의 파일이 없으므로 base→파생 동기화 대상 자체가 사라진다. (a) **시각 일관성** — Button·ToggleButton·MenuItem 은 같은 theme/tokens 토큰과 `data-*` 규칙을 읽는다. theme 한 곳을 고치면 모두 반영된다. (b) **동작 재사용** — ListBox 는 `PrimitiveBinding` 하나다. ComboBox·Select 는 그 동일 binding 을 합성한다 — ListBox 정의 복제본이 없다. (c) **조합 재사용** — 아이콘이 붙은 Button 같은 조합은 reusable 문서 하나이고, 인스턴스는 `ref` + `descendants` override 다. `descendants` 는 pencil 공식 3-mode(속성 patch / 노드 교체 / children 교체)이며 canonical schema(HC#4)에 이미 존재한다 — origin 문서를 고치면 instance 가 override 하지 않은 속성은 모든 `ref` 에 전파된다.
14. Properties Panel(Inspector)의 편집 필드는 컴포넌트당 정의에서 오지 않는다 — #6 의 Inspector 부분 구체화다. primitive 는 `PrimitiveBinding.props.accepts`(`Record<string, PropContract>`)가, 조합 컴포넌트는 reusable 컴포넌트가 노출한 `propsSchema`(같은 `Record<string, PropContract>`)가 D2 편집 source 다. generic 렌더러는 Inspector field renderer 하나를 두고 선택 노드의 `PropContract` 집합 + theme 로 편집 필드를 generic 하게 만든다 — 컴포넌트당 `properties.sections`/`SpecField` 분기를 두지 않는다. 필드 그룹(Content/Appearance/State 등)은 컴포넌트당 섹션 목록이 아니라 `PropContract` 의 `section` 태그로 표현하고, generic Inspector 가 그 태그로 묶는다. `variant`/`size` 종류 필드의 선택 가능한 값은 컴포넌트당 enum 이 아니라 theme 규칙이 정의한 `data-*` 값 집합(theme/tokens root collection)에서 읽는다. instance(`ref`) 선택 시 Inspector 는 동일 `PropContract` 집합을 root props override 로, `descendants` 3-mode 를 nested override 로 편집한다.

기각 사유:

- **대안 A 기각**: 현재 문제의 원인인 다중 정본과 adapter/fallback 혼합을 유지한다.
- **대안 B 기각**: `render.shapes()` 모델은 RAC 구조를 표현하지 못한다. 불완전한 모델 위에 필드를 덧붙이면 정합 실패가 반복된다.
- **대안 C 기각**: 컴포넌트당 contract 객체는 스키마가 두꺼워도 `ComponentSpec` 과 같은 종류 — canonical 문서와 평행한 두 번째 SSOT 다. drift 가 재발한다. 사용자 검토(2026-05-19)에서 "실패 반복" 으로 기각됐다.
- **대안 D 기각**: `react-aria-components` 를 제품 곳곳에서 직접 import 하면 RAC 버전 업데이트가 제품 코드를 직접 흔들고, composition-specific 계약(props mapping·canonical·Inspector·Skia)을 둘 단일 위치가 사라진다.

> 구현 상세: [142-starter-spec-component-system-cutover-breakdown.md](../design/142-starter-spec-component-system-cutover-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |  심각도  | 대응                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | generic 렌더러(DOM+Skia) + Preview resolved-tree 단일 소비가 공통 기반의 핵심이며 제품 규모에서 미검증이다. `resolveCanonicalDocument()`(`apps/builder/src/resolvers/canonical/index.ts`)·`CanonicalNodeRenderer`(`apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`)는 구현·통과 상태지만, Preview `App.tsx` 는 legacy `elements[]` 를 주 렌더 경로로 쓰고 Skia `buildSpecNodeData.ts` 는 `render.shapes()` 경로다. 이 3경로 전환이 실패하면 모든 family cutover 가 막힌다 | **HIGH** | Gate G2(공통 기반 gate)로 1:1 관리. family cutover 착수 전 F1~F4 reusable/ref/descendants/slot fixture + generic 렌더러 DOM↔Skia 대칭 fixture + Button primitive 파일럿 통과 필수                                                 |
| R2  | 조합 컴포넌트를 reusable 문서로 새로 저작하는 노동. 깨진 spec 에서 자동 변환할 수 없다(HC#6)                                                                                                                                                                                                                                                                                                                                                                                             |   MED    | Builder 안에서 저작 후 reusable 승격 흐름 사용. family 단위로 분할해 한 번에 한 family 만 저작                                                                                                                                    |
| R3  | generic 렌더러 버그는 family 격리가 안 된다(모든 family 가 렌더러를 공유)                                                                                                                                                                                                                                                                                                                                                                                                                |   MED    | G2 공통 기반 gate 에서 렌더러를 충분히 검증한 뒤 family loop 진입. family fixture 가 회귀를 감지                                                                                                                                  |
| R4  | theme/tokens 가 일부 컴포넌트별 시각(arc/track/indicator 등)을 표현하지 못할 수 있다                                                                                                                                                                                                                                                                                                                                                                                                     |   MED    | 비-DOM-trivial primitive 는 `PrimitiveBinding.skiaPrimitive` draw module + generic CSS escape hatch. Phase 0 inventory 에서 잔여 목록 식별                                                                                        |
| R5  | 기존 프로젝트의 legacy payload 가 새 렌더러에서 깨진다                                                                                                                                                                                                                                                                                                                                                                                                                                   |   MED    | import/export 호환 adapter 를 boundary 에 유지. canonical resolver round-trip fixture 로 검증                                                                                                                                     |
| R6  | `packages/shared/src/components` public surface 를 유지하면서 내부를 primitive wrapper 로 교체 — import path 는 같지만 의미가 바뀐다                                                                                                                                                                                                                                                                                                                                                     |   MED    | barrel export contract test + component smoke fixture. cutover release note 에 변경 범위 명시                                                                                                                                     |
| R7  | upstream starter update 때마다 수동 diff 가 커진다                                                                                                                                                                                                                                                                                                                                                                                                                                       |   LOW    | `packages/react-aria-starter/UPSTREAM.md` 정책 + inventory diff workflow                                                                                                                                                          |
| R8  | 컴포넌트당 spec 파일을 D3 SSOT 로 둔 ADR-036(및 spec 스키마 ADR-907/908)의 메커니즘이 폐기된다                                                                                                                                                                                                                                                                                                                                                                                           |   MED    | ADR-142 Implemented 승격 시 ADR-036/907/908 status 재평가. README ADR 대시보드 동시 갱신                                                                                                                                          |
| R9  | `PropContract` 가 현 `FieldDef` 11종 union 의 표현력을 전부 흡수하지 못할 수 있다 — 특히 임의 React 컴포넌트를 받는 `CustomField`, 한 prop 변경이 복수 prop 을 갱신하는 `derivedUpdateFn`.                                                                                                                                                                                                                                                                                               |   MED    | 현 `FieldDef` union 을 Phase 0 inventory 에서 `PropContract.kind` 로 전수 매핑. `CustomField` 잔여(ColorArea/Wheel 등)는 그 자체가 primitive 이므로 primitive 합성으로 흡수. 매핑 불가 항목은 inventory 에 명시 후 family 별 처리 |

잔존 HIGH 위험: R1 1건 — Gate G2 와 1:1 대응. R9 는 MED — Phase 0 inventory 매핑으로 관리.

> **2026-05-30 갱신**: Phase 0 inventory 실측으로 본 Risk 표가 일부 supersede 됨 — **R4 가 MED→HIGH 로 격상**(Skia generic scope 가 추정보다 큼), 잔존 HIGH = **R1 + R4 (2건)**, 둘 다 Gate G2. 상세는 본문 말미 [§Phase 0 Inventory Recalibration](#phase-0-inventory-recalibration-2026-05-30).

## Gates

공통 기반 Gate(G0~G3)는 family cutover 착수 전 1회 통과한다. family cutover Gate(G4~G6)는 family 마다 반복 적용하며 한 family 의 4경로를 동시에 검증한다. G7 은 전 family 가 `cutover:"catalog"` 에 도달했을 때 1회 통과한다.

| Gate   | 시점                             | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 실패 시 대안                                      |
| ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| G0     | Phase 0 freeze                   | starter source 보호 유지. 신규 active component 가 legacy 6개 목록으로 추가되지 않음                                                                                                                                                                                                                                                                                                                                                                       | cutover 착수 보류                                 |
| G1     | Inventory 완료                   | starter 55 컴포넌트의 primitive/composed 분류표 + 124 `ComponentSpec` 의 legacy 처분 + 6개 registry diff 문서화                                                                                                                                                                                                                                                                                                                                            | 누락 항목 먼저 분리                               |
| **G2** | **공통 기반 완료 (R1)**          | generic 렌더러 DOM/Skia backend 가 resolved canonical tree + theme 를 소비. Preview 가 `resolveCanonicalDocument()` 결과를 단일 source 로 소비. F1~F4 fixture(reusable origin / ref instance / descendants 3-mode / slot fill)가 Preview 에 의도된 visibility 로 렌더. DOM↔Skia 대칭 fixture 통과. `PrimitiveBinding` 타입 + Button 파일럿 확정. generic Inspector field renderer 가 `PropContract` 집합 + theme 로 편집 필드 생성 (Button `accepts` 검증) | family cutover 전면 보류                          |
| G3     | Catalog/배선 완료                | `componentCatalog`(primitive + reusable entry) 구성. Component Panel / Factory 가 catalog 만 소비. registration contract 불변식 C/D/E 통과                                                                                                                                                                                                                                                                                                                 | 배선 보류                                         |
| G4     | family Builder cutover           | 해당 family 의 Component Panel / Factory 가 catalog 기준으로 동작. manual duplicate registration 없음                                                                                                                                                                                                                                                                                                                                                      | 해당 family legacy 유지                           |
| G5     | family Preview/Publish/Skia 정합 | 해당 family fixture 가 Preview DOM, Skia 양쪽에서 동일 시각 결과(`/cross-check`). reusable/ref/slot 렌더 정상                                                                                                                                                                                                                                                                                                                                              | 해당 family hidden 또는 legacy fallback           |
| G6     | family Legacy 격리               | 해당 family 의 active 경로에서 `components/legacy` import + `ComponentSpec`/`ReactRenderer`/`render.shapes` 참조 0건                                                                                                                                                                                                                                                                                                                                       | 해당 family cutover 보류                          |
| G7     | Final verification               | `pnpm run codex:preflight` 통과. 전 family `cutover:"catalog"` 도달. README/ADR status 동기화. ADR-036/907/908 status 재평가                                                                                                                                                                                                                                                                                                                               | 실패 family commit revert (다른 family 영향 없음) |

## Consequences

### Positive

- 정본이 canonical 문서 하나로 통합된다. 6개 등록 목록이 단일 `componentCatalog` 로 대체된다.
- 컴포넌트당 spec 파일과 변환기가 사라진다(124 spec → ~35 binding). 손으로 유지할 정의 표면이 크게 줄어든다.
- 렌더 경로가 generic 렌더러 하나로 단일화된다. `/cross-check` 가 컴포넌트마다가 아니라 렌더러를 한 번 검증한다.
- ADR-111~131 의 canonical 전환을 마무리한다 — Preview 가 reusable/ref/slot 을 실제로 화면에 펼친다.
- `react-aria-components` 업데이트는 binding delta 로, starter snapshot 업데이트는 D3 시각 참조 diff 로 처리할 수 있다.
- 사용자 제약("깨진 spec 참조 금지")이 구조적으로 지켜진다 — 참조할 컴포넌트당 정의가 존재하지 않는다.

### Negative

- 공통 기반(Phase 0~G2)이 무겁다. Gate 가 아니라 사실상 제품이다 — generic 렌더러 + Preview resolved-tree 가 먼저 동작해야 한다.
- 조합 컴포넌트를 reusable 문서로 새로 저작해야 한다(자동 변환 불가).
- generic 렌더러 버그는 family 격리가 되지 않는다 — G2 단계의 검증 부담이 크다.
- 컴포넌트당 spec 파일을 D3 SSOT 로 둔 ADR-036(및 ADR-907/908)의 메커니즘이 폐기된다 — ADR-142 Implemented 시 해당 ADR status 재평가가 필요하다.
- 기존 124 `ComponentSpec` / `ReactRenderer` / `render.shapes` 파이프라인은 cutover 기간 동안 legacy 로 공존한다.
- Inspector 편집 필드 생성이 컴포넌트당 `properties.sections` 선언(124 spec 중 83개 보유)에서 generic `PropContract` 기반으로 바뀐다 — 임의 컴포넌트를 받던 `CustomField` 와 `derivedUpdateFn` 류는 generic 화 비용이 있다(R9).

## Phase 0 Inventory Recalibration (2026-05-30)

> Phase 0 inventory(Gate G1) 실측으로 본문 추정 3개를 교정한다. **결정(대안 E)·Hard Constraints·Alternatives 는 불변** — 위험 calibration + 카운트 정정만 한다. 근거 데이터: [`docs/reference/audits/2026-05-30-canonical-component-inventory.md`](../../reference/audits/2026-05-30-canonical-component-inventory.md). review: [`docs/adr/reviews/142.md`](../reviews/142.md) Round 2.

| 항목                                | 본문 추정                          | 실측 교정                                                                                                               | 근거 (inventory §)                                                                          |
| ----------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| leaf binding 수 (HC#3 / Decision#3) | ~35                                | **~40-49** (variant/sub-part folding 정책에 의존)                                                                       | §2: starter 49 RAC-controller-backed + 6 composed                                           |
| **R4 — Skia generic scope**         | MED, "arc/track/indicator 등 소수" | **HIGH** — render.shapes 대부분 재현 필요                                                                               | §4: text 측정 **64** spec + 특수 shape **38** + ADR-907 spacing **4** + ADR-908 fill **30** |
| R8 — ADR-907/908 처분               | "status 재평가"                    | "**resolver 로직**(`resolveContainerSpacing`/`resolveFillTokens`/CanvasKit 측정)을 generic Skia backend 에 **re-home**" | §4 — status 재평가만으론 부족                                                               |
| R2 — composite 재저작               | "~89 composite"                    | **~15 reusable** 재저작 (~40 sub-part 는 부모 binding `parts`/`slots` 로 흡수 → 별도 재저작 아님)                       | §3                                                                                          |
| R9 — FieldDef 매핑 난항             | `CustomField` + `derivedUpdateFn`  | `CustomField` **0개(dead, 미사용)** / `ChildrenManagerField` **5개(누락)** / `derivedUpdateFn` **19개(실제 주 위험)**   | §6                                                                                          |

**잔존 HIGH 위험 갱신: R1 + R4 (2건).** R4 → Gate **G2** 에 흡수(공통 기반의 Skia backend 부분, R1 과 동일 gate). adr-writing.md "각 HIGH Risk ≥1 Gate" 충족.

**G2 분해 권장 (review #1, 사용자 confirm 2026-05-30)**: G2 를 ① **DOM-first**(`resolveCanonicalDocument`/`CanonicalNodeRenderer` 기존 자산 활용, 저위험) → ② **Skia-rewrite**(64 text 측정 + 38 특수 shape + 34 spacing/fill resolver re-home, R4 의 실체이자 G2 최대 무게) 2 단계로 분리. Skia-rewrite 통과 전까지 Preview `?canonical` opt-in + Skia legacy fallback 유지(primary 렌더 경로 회귀 방지). breakdown §4 Phase 1 참조.

**R2 < R4 (실측 결론)**: 당초 composite 재저작(R2)이 주노동으로 보였으나, 실측상 sub-part 흡수로 R2 는 ~15건으로 작고 **R4(Skia generic 재구현)가 진짜 병목**이다. M1/G2 commit 전 이 점을 전제로 일정·위험을 산정한다.
