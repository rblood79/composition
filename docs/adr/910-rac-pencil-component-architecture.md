# ADR-910: RAC core + Pencil format 1차 원리 컴포넌트 아키텍처

## Status

Proposed — 2026-06-01

> 사용자 요청(2026-06-01): "기존 SSOT spec 방식은 무시하고, Adobe React Aria Components(RAC) core 개발 방법론 + Claude Code/Pencil app 개발 방법론으로 컴포넌트 시스템을 새로 설계하라." 본 ADR 은 composition 내부 누적 부채(현행 `*.spec.ts`, 전환기 adapter)를 출발점으로 삼지 않고, 두 외부 검증 자산(RAC + Pencil canonical document format)을 1차 원리로 재유도한 결과다.

> **문서 위상: 점진 cutover 전략의 비교 기록 (비착수)**. 본 ADR 은 현재 코드(124 spec / 6 레지스트리 / 전환기 adapter)를 출발점으로 삼아 family 단위 cutover / 레거시 격리·제거 / preflight / phase land 를 규정한 **점진 전환 실행 설계서**였다. 같은 목표 구조를 현재 코드 비참조로 규정한 **비실행 목표 참조(Target Reference)** 는 [ADR-911](911-rac-pencil-target-component-architecture.md) 이다.
>
> **착수 ADR 이관 (사용자 옵션 B 결정 2026-06-02 / codex review 결함 1 정정)**: 사용자가 "레거시 미보존 + 갈아엎기"를 결정함에 따라, 점진 cutover(legacy 격리 유지)는 사용자 지시와 충돌하여 **착수하지 않는다**. 실제 `execute-adr` 착수 대상은 [ADR-912](completed/912-rac-pencil-rebuild-cutover.md)(백지 직행) 단독이다. 본 ADR(910)은 supersede 되지 않고 **점진 전략의 비교 기록**으로 유지되며(세 전략 — 910 점진 / 911 목표 / 912 직행 — 의 관점 차이 보존), ADR-911 은 목표 구조 drift 판정 reference 로 유지된다. 본 ADR 의 Risks/Gates(전환 위험 — 마이그레이션 / cutover 격리)는 점진 전략을 택했을 경우의 위험 기록이며, 직행 전략의 착수 게이트는 ADR-912 가 소유한다.

## Context

composition(노코드 웹 빌더)의 컴포넌트 시스템은 빌더 방식 변경, local DB 형식 변경, reusable/origin/instance/slot 모델 보정, CSS 최적화, Preview/Skia 경로 보정이 누적되며 **정본이 여러 개인 상태**가 되었다. 컴포넌트 하나를 등록하려면 서로 독립된 6개 목록(Component Panel hard-coded list / Factory creator map / `rendererMap` / `getDefaultProps` map / `BASE_TAG_SPEC_MAP` / builder `TAG_SPEC_MAP`)에 각각 등록해야 한다. 이 목록들이 어긋나며 등록 누락과 CSS/Skia drift 가 반복된다.

`packages/specs/src/components/*.spec.ts` 124개는 컴포넌트당 정의 파일이다. 이 모델(`ComponentSpec.render.shapes()`)은 시각을 직접 그리는 함수 중심이라 RAC 의 구조(parts/slots/render-prop state, collection children)를 표현하지 못한다. 그 결과 Builder(Skia)와 Preview(DOM)가 같은 컴포넌트를 다르게 그리는 정합 실패가 반복됐다.

본 ADR 은 두 검증된 외부 자산을 1차 원리로 삼는다.

- **Adobe React Aria Components(RAC) core 방법론** — data/render 분리(`<Collection items>` + 렌더 함수 → 내부 Node tree), 접근성 hooks(`useButton`/`useTableState`), render-prop state(`composeRenderProps`, `{({isSelected}) => ...}`), slot 합성(`slot="selection"`). 시각은 100% CSS 토큰(`var(--radius)`, `data-variant`). 실측: `packages/react-aria-starter/src` 55 컴포넌트 원본(D3 시각/구조 참조용 vendored snapshot, runtime import 아님) + 그 CSS token/패턴을 중복제거해 정규화한 `packages/design.md`(reference baseline — Colors/Typography/Layout/Elevation/Shapes/Components/Motion/Mapping). 입력 체인은 `react-aria-starter/src` CSS → `design.md` 정규화 reference → theme/tokens 저작이며, `design.md` 는 그 저작의 **필수 선행 입력**이지 runtime 계약이 아니다(런타임 시각 SSOT 는 theme/tokens root collection).
- **Pencil app/format 방법론** — canonical document 가 **노드 type(실측 8종: frame/text/ref/icon_font/path/ellipse/rectangle/line) + 모든 노드가 공유하는 보편 속성 집합(CSS 처럼, 값만 다름)** 으로 87개 컴포넌트를 코드 0줄로 표현. 컴포넌트화는 데이터에 직접 존재: `reusable:true` frame(origin) / `{type:"ref", ref}`(instance) / `descendants:{nodeId:{override}}`(3-mode) / `{slot:[ids]}`(fill). theme 다축(Accent/Base/Mode) + `variables`(token 값이 theme 조합별 배열, `"$--accent"` 참조). 실측: `docs/migrations/shadcn-design-system.json`.

두 원리는 같은 결론으로 합류한다 — **컴포넌트는 코드 정의 파일이 아니다.** RAC 는 "시각·조합 = 데이터(token/composition)", Pencil 은 "컴포넌트 = 데이터(노드 + 보편 속성)". 둘 다 컴포넌트별 코드를 거부한다.

### 3-domain 분류 (ADR-063 정합)

- **D1 DOM/접근성/상호작용**: RAC(`react-aria-components`)가 절대 권위이자 runtime primitive. composition 은 RAC 동작을 수동 재구현하지 않는다.
- **D2 Props/API**: leaf 는 `PrimitiveBinding.props.accepts`, 조합 컴포넌트는 reusable 문서의 `propsSchema` 가 SSOT(같은 `PropContract` 타입). 컴포넌트당 spec 파일 아님.
- **D3 시각/구조**: 시각 SSOT 는 theme/tokens. 구조 SSOT 는 canonical 문서 트리. 컴포넌트당 `visual` 필드를 두지 않는다.

### Hard Constraints

1. **단일 공급원 SSOT**: 한 노드의 편집 가능한 값은 그 노드 하나에서 나온다. 의미값(`content`/`variant`/`size`)은 노드 props 에, 사용자가 덮어쓴 시각값(`fontSize`/`fill`/`padding`/`gap`/`cornerRadius`)은 `node.props.style`(override layer)에 있다. 시각 base(컴포넌트 default)는 노드가 아니라 theme rule 에서 resolve 되고, 노드는 그 위에 얹은 override 만 들고 있다. 이로부터 Publishing / Preview / Properties Panel / Style Panel / Skia Rendering 이 모두 **같은 노드 하나 + 같은 theme rule** 을 공급원으로 삼는다 — 별도 store·별도 공급처가 없다. 예: `button.size="sm"` → resolved `fontSize:14`(rule base) 가 5곳 동일. 노드 값(또는 override)이 바뀌면 5곳 즉시 동일 반영. 시각 대칭의 보장점은 두 렌더 backend(DOM/Skia)가 같은 노드 override + 같은 theme(`resolveToken`/`resolveComponentRule`)를 읽는 것이다.
2. **패널 = 단일 공급원의 두 view**: Properties Panel 과 Style Panel 은 공급처가 둘이 아니라, 한 노드의 편집 계약 하나를 `section` 태그로 필터링한 두 화면이다. 편집 진입점은 `resolveEditContract(node)` 하나 — 이 함수가 의미 props 계약과 보편 시각 속성 계약(`props.style` 키 공간)을 **합집합**으로 묶어 단일 PropContract 집합을 낸다. Properties view(`section ∈ {content, state}`) 와 Style view(`section ∈ {transform, appearance, layout}`)는 그 부분 view. 단일 공급원은 저장 평면화를 요구하지 않는다 — `props`(의미) 와 `props.style`(시각 override) 이 분리 저장돼 있어도 `resolveEditContract` 가 둘을 한 계약 집합으로 합쳐 노출하므로, 한 패널 편집이 다른 패널에 즉시 반영되고 round-trip 무손실이 보장된다.
3. **base / override 2층 schema**: 한 노드의 시각값은 두 출처가 명시적으로 분리된다 — **base**(컴포넌트 default)는 노드에 저장하지 않고 theme rule(`resolveComponentRule(type, doc).sizes[size]` 등)에서 resolve 하며, **사용자 override** 는 `node.props.style` 에만 저장한다. `props.style` 은 "제거 대상 중첩 래퍼" 가 아니라 **"사용자가 base 를 덮어쓴 키만 담는 override layer"** 다 — 키 존재 자체가 override 신호이고, 키 부재 = base 따름. 병합은 `props.style[k] ?? rule.resolve(k)`(override 우선, fallback base). 이로써 reset-to-default(`delete props.style[k]`), size 변경 시 override 유지(키 존재), instance override(`RefNode.descendants[path]` = origin base 위 명시 patch layer)가 모두 정의된다. **Pencil 동형의 정확한 의미**: 한 노드 내부의 키 나열은 평면이되, base/override 는 **노드 간**(origin 노드 ↔ ref.descendants)으로 분리한다 — 한 노드 안에 base+override 를 같은 키 공간에 섞지 않는다(ADR-907 Layer B 보존). 렌더 backend 는 resolved 시각값(base ⊕ override)을 React `CSSProperties`(DOM) 또는 Skia shape(Skia)로 단일 어댑터(`toReactStyle`/`toSkiaStyle`)를 통해 투영한다.
4. **Skia 성능**: Skia 화면=시각적 빌더 화면, 60fps 최저선(엔터프라이즈 타깃). List/Table/Grid 반복 컬렉션은 Viewport Culling + Virtualization 으로 보이는 영역만 렌더. Pencil App 수준의 정확한 Skia 텍스트(CanvasKit Paragraph).
5. **깨진 spec 참조 금지**: 조합 컴포넌트 reusable 문서는 starter + 디자인 의도로부터 새로 저작. 구버전 spec 에서 자동 변환하지 않는다(사용자 제약 2026-05-19).
6. **RAC 절대 권위 보존**: ARIA/키보드/포커스를 RAC 가 100% 소유. composition 코드는 prop 투영(`toRacProps`)만 — ARIA 수동 작성 0.
7. **Skia editor surface 는 projected 하위 노드 접근 가능**: 빌더 Skia 화면은 미리보기가 아니라 직접 조작 editor 다. collection 깊은 노드(ListBox row 내부 Text/Icon, Table cell)는 canonical 저장 노드로 전부 materialize 하지 않되, Skia runtime 에서 hit-test·drill-in·edit-route 가능한 **projected tree**(`template subtree × visible data window`)로 존재한다. 10,000 row 도 canonical/Skia scene 에 전부 생성하지 않는다(viewport window + overscan). **render-space projected id 와 canonical write target 은 분리**한다 — projected id 는 canonical mutation/history/IndexedDB 에 유입 금지이며(ADR-135/136 Render-Space Interaction Boundary 의 collection 적용), 편집은 template/data/item-override route 중 하나로 명시 변환한다. (구현 상세: breakdown §4.12/§5.11)

### Soft Constraints

- 공통 기반(노드 resolve + generic DOM 렌더러 + generic Skia 렌더러 + 단일 Inspector field renderer + theme resolve)은 family cutover 보다 선행한다(generic 렌더러는 family-무관 단일 코드).
- 기존 124 `ComponentSpec` / `ReactRenderer` / `CSSGenerator` / `render.shapes()` / `rendererMap` 은 import/export 호환 boundary 로만 유지, active authoring source 에서 제외.

## Alternatives Considered

### 대안 A: 컴포넌트당 spec 점진 보수 (현행 유지)

- 설명: 현행 `*.spec.ts` 124개 + 6 레지스트리 + adapter/fallback 구조를 유지하며 drift 를 개별 수정.
- 근거: 변경 비용 0. 기존 검증 자산 보존.
- 위험:
  - 기술: M — 새 기술 없음. 단 RAC 구조 표현 불가가 영구화.
  - 성능: M — 컴포넌트당 정의 124 런타임 import 유지.
  - 유지보수: **H** — 다중 정본 + adapter/fallback 혼합 유지. drift 가 구조적으로 반복(현재 문제의 원인).
  - 마이그레이션: L — 변경 없음.

### 대안 B: 기존 `ComponentSpec`(render.shapes) 확장

- 설명: `ComponentSpec` 스키마를 두껍게 해 RAC 의 parts/slots/render-prop state/collection children 을 담는다.
- 근거: 기존 파이프라인 재사용. 점진 확장.
- 위험:
  - 기술: **H** — `render.shapes()` 는 시각을 직접 그리는 함수라 RAC 의 data/render 분리·합성 구조를 표현 불가. 불완전 모델 위에 필드를 덧붙이면 정합 실패 반복.
  - 성능: M — 정의 표면 증가.
  - 유지보수: **H** — Builder↔Preview drift 가 구조적으로 반복(ADR-142 Context ①). RAC 1차 원리(data/render 분리)와 정면 충돌.
  - 마이그레이션: M.

### 대안 C: 컴포넌트당 contract 객체 (Spec vNext / StarterComponentContract)

- 설명: 컴포넌트당 새 contract 객체 + 컴포넌트당 변환기(`toGeneratedCss`/`toSkiaVisualModel`/`toInspectorFields`).
- 근거: 스키마를 깨끗이 재설계. RAC 구조 표현 가능.
- 위험:
  - 기술: M — 새 스키마 설계 가능.
  - 성능: M.
  - 유지보수: **H** — 4 output 중 3개는 (문서 노드 + theme)의 함수이지 컴포넌트당 계약의 산물이 아님. 컴포넌트당 두면 124×3 변환기 손유지. canonical 문서와 평행한 **두 번째 SSOT** → upstream/downstream 양쪽 drift. 직전 개정안(2026-05-18)이 이것이었고 사용자 검토에서 "실패 반복"으로 기각.
  - 마이그레이션: M.

### 대안 D: RAC(`react-aria-components`)를 제품 곳곳에서 직접 import

- 설명: leaf wrapper 없이 제품 코드가 RAC primitive 를 직접 import.
- 근거: 중간 레이어 제거. RAC API 직접 사용.
- 위험:
  - 기술: M.
  - 성능: L.
  - 유지보수: **H** — props mapping / canonical 정규화 / `toRacProps` 투영의 단일 위치 소멸 → 57+ 파일 분산. RAC 버전 업데이트가 제품 코드 곳곳 직접 타격. Inspector/Skia 연결점 분산 — Pencil 의 "데이터 1곳" 원리 위반.
  - 마이그레이션: **H** — 분산된 import 를 되돌리기 어려움.

### 대안 E: Canonical 문서 SSOT + RAC primitive binding (document 모델)

- 설명: leaf 컴포넌트 = RAC primitive 1개당 1개 `PrimitiveBinding`(코드, ~35개). 조합 컴포넌트 = `reusable:true` 노드 문서(데이터). 등록 = 단일 `componentCatalog`. 시각 = theme/tokens(`data-*`). 렌더 = (resolved canonical tree + theme)를 소비하는 generic 렌더러 하나(traversal 1개, backend 2개: DOM/Skia).
- 근거: RAC 원리(data/render 분리) + Pencil 원리(컴포넌트 = 데이터)에 **동시 정합**하는 유일 대안. ADR-142 가 같은 1차 원리로 도달한 end-state 와 수렴.
- 위험:
  - 기술: **H** — generic 렌더러 공통 기반이 제품 규모에서 미검증(T-1). Skia generic 이 `render.shapes` 재현 부담(T-3). 단 family 단위 격리 가능.
  - 성능: M — 정의 124→~35 감소(우호). 단 collection virtualization↔Taffy 연계 미검증(T-4).
  - 유지보수: **L** — 컴포넌트당 정의 파일 부재 → drift 할 "다른 곳"이 구조적으로 없음. 파생/재사용이 reusable 참조로 자동 정상화.
  - 마이그레이션: M — legacy boundary 격리 + family atomic cutover 로 회복 가능.

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :---: | :--: | :------: | :----------: | :--------: |
| A    |   M   |  M   |  **H**   |      L       |     1      |
| B    | **H** |  M   |  **H**   |      M       |     2      |
| C    |   M   |  M   |  **H**   |      M       |     1      |
| D    |   M   |  L   |  **H**   |    **H**     |     2      |
| E    | **H** |  M   |    L     |      M       |     1      |

루프 판정: 모든 대안이 HIGH 1개 이상. 그러나 A/C 의 HIGH(유지보수)는 **회복 불가능한 반복 비용**(drift 영구화)인 반면, E 의 HIGH(기술)는 **family 단위로 격리·gate 가능한 1회성**이다. B/D 는 HIGH 2개. 유지보수 HIGH 를 LOW 로 낮추는 유일 대안이 E 이며, E 의 기술 HIGH 는 Gate(공통 기반 + family fixture)로 관리 가능 → 추가 대안 없이 E 채택, 잔존 기술 HIGH 는 위험 수용 근거로 관리.

## Decision

**대안 E: Canonical 문서 SSOT + RAC primitive binding** 을 선택한다.

선택 근거(위험 수용):

1. **유지보수 HIGH 제거가 본질** — 현재 문제(다중 정본 drift)의 원인은 컴포넌트당 정의의 다중성이다. E 만 이를 구조적으로 차단한다(컴포넌트당 정의 부재 → drift 할 곳 부재). A/C 의 유지보수 HIGH 는 이 문제를 영속화한다.
2. **기술 HIGH 의 수용 가능성** — E 의 기술 HIGH(generic 공통 기반 무게 T-1, Skia 재현 부담 T-3)는 family 단위로 격리된다(cutover 는 family atomic). 한 family 가 Skia 재현에 실패해도 `cutover:"legacy"` 유지로 그 family 만 격리, 다른 family 진행을 막지 않는다. 회복 불가능한 A/C 의 유지보수 HIGH 와 질적으로 다르다.
3. **두 외부 원리에 동시 정합** — E 는 RAC(data/render 분리) + Pencil(컴포넌트=데이터)에 동시 정합하는 유일 대안. 사용자 요청("RAC core + Pencil 방법론으로 새로 생각")의 직접 귀결.

기각 사유:

- **대안 A 기각**: 현재 문제의 원인인 다중 정본 + adapter/fallback 혼합을 유지한다.
- **대안 B 기각**: `render.shapes()` 모델은 RAC 구조를 표현하지 못한다. 불완전 모델 위에 필드를 덧붙이면 정합 실패가 반복된다(RAC 1차 원리 위반).
- **대안 C 기각**: 컴포넌트당 contract 객체는 canonical 문서와 평행한 두 번째 SSOT 다. drift 가 재발한다(사용자 2026-05-19 기각).
- **대안 D 기각**: 단일 props mapping/투영 위치가 소멸하고 RAC 버전 충격이 제품 코드 곳곳에 직접 미친다(Pencil "데이터 1곳" 원리 위반).

> **ADR-142 와의 관계**: 본 ADR 은 ADR-142(Accepted 2026-05-30) 를 supersede 하지 않는다. 두 ADR 은 같은 1차 원리에서 출발하므로 end-state 가 수렴하며, 본 ADR 은 그 목표 상태를 외부 방법론(RAC core + Pencil) 언어로 재서술한 독립 설계다. 실행은 ADR-142 cutover 경로와 합류한다.

> **ADR-920 흡수 (supersede)**: 본 ADR 은 ADR-920(RAC Format Interactive Projected Tree, 같은 외부 입력의 Codex 독립 설계)을 흡수해 supersede 한다. 두 설계의 base/override 원리는 동일하다(HC#3 ≡ ADR-920 HC#5 — 독립 도달한 수렴 증거). 910 을 상위 컴포넌트 아키텍처로 두고, 920 이 정면 설계한 **collection Interactive Projected Tree**(910 미설계 영역)를 HC#7 + Risks(T-PROJECT/T-DEEP/T-TPL) + Gates(G8/G9) + breakdown §4.12/§5.11/§7-4/⑪ 로 흡수했다. 920 의 behavior/page frame/data 축은 이미 ADR-131/132/135/136 관할(Implemented)이므로 **bridge 참조만** 두어 관할 중복을 피했다(breakdown ⑪ 흡수 경계). 920 의 schema/registry(`FormatNode`/`RacFormatDefinition`/`FormatCapabilityRegistry`)는 910 의 단일 schema(`CanonicalNode`/`PrimitiveBinding`/`COMPONENT_RULES_TABLE`+`PropContract`)로 **흡수·통합**한다 — 병렬 schema 를 두지 않으며(두 번째 SSOT 금지), 920 schema 타입은 본 ADR 어디에도 정의·import 하지 않는다. 920 고유 기여 `ProjectedNodeRef` 만 render-space 전용 신규 타입으로 흡수되며 canonical schema 와 직교한다(breakdown ⑪ schema/registry 단일화 표).

> 구현 상세: [910-rac-pencil-component-architecture-breakdown.md](design/910-rac-pencil-component-architecture-breakdown.md) — 설계 산출물 ①~⑩ + ⑪ ADR-920 흡수 경계(아키텍처 개요 / Format Schema / RAC→Format 변환 / Skia 렌더 레이어+Interactive Projected Tree / Panel 연동+edit route / Publishing·Preview / 컴포넌트 예시 / TS 타입 / trade-off / roadmap / 920 흡수 경계).

> **심볼 신규/재사용 경계** (Proposed — 본 ADR 은 미구현 설계다): 본문이 인용하는 심볼은 둘로 갈린다. **본 ADR 이 신규 도입할 심볼** = `resolveEditContract`(편집 계약 단일 진입점, HC#2) / `toReactStyle` · `toSkiaStyle`(base⊕override → DOM·Skia 단일 어댑터, HC#3·T-ADAPT·G2) — 현재 코드 0건, breakdown §"편집 계약"·§4.2 가 정의한다. **이미 실재하여 재사용·확장하는 심볼** = `resolveComponentRule` / `COMPONENT_RULES_TABLE`(theme rule base 테이블, `generated/componentRulesTable.ts` export) / `resolveToken`(theme rule base resolve) / `toRacProps`(D1 prop 투영) / `buildCatalogShapes`(Skia box+text) / `PrimitiveBinding` / `componentCatalog` / `CutoverState`. 920 흡수 신규 타입은 `ProjectedNodeRef`(render-space 전용, §4.12) 하나다. 즉 본 설계의 신규 코드 표면은 단일 어댑터 2 + 편집 계약 1 + projected ref 1 로 좁다 — 나머지는 ADR-142 가 이미 land 한 catalog/rule/binding 인프라 위에 선다.

## Risks

> Alternatives 단계의 4축 평가는 대안 비교용이고, 본 섹션은 대안 E 이행 중 관리할 잔존 운영 위험이다. ID 는 breakdown ⑨.2 위험표와 대응한다(breakdown 은 어댑터 책임이 겹치는 T-3·T-ADAPT 를 한 행으로 병합 표기 — 본문은 Risk/Gate 추적을 위해 분리 유지).

| ID        | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |  심각도  | 대응                                                                                                                                                                                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1       | generic 렌더러 공통 기반(resolve/generic DOM/generic Skia/Inspector/theme resolve) 1개 버그가 모든 family 동시 회귀. family 격리 안 됨                                                                                                                                                                                                                                                                                                                                                                                                       | **HIGH** | Gate G1 + Button vertical slice(breakdown ⑩.5). slice 깨지면 공통 기반 재설계, family 진행 중단                                                                                                                                                                                                                        |
| T-3       | Skia generic 이 `render.shapes` 재현 부담 — text 측정 64 + 특수 shape 38 + ADR-907 spacing 4 + ADR-908 fill 30 resolver re-home                                                                                                                                                                                                                                                                                                                                                                                                              | **HIGH** | Gate G5 `/cross-check` family 마다. box+text 로 환원 안 되는 특수 shape(arc/shadow/arrow)는 `SkiaPrimitiveDrawFn` escape hatch(④.4)로 합성 — legacy `render.shapes` 경유 아님. 재현 미달 family 는 `cutover:"cutting-over"` 보류(legacy 영구 유지 금지) → 다음 family 진행                                             |
| T-4       | collection virtualization ↔ Taffy layout 연계 복잡도. 보이는 item 만 렌더하며 전체 content height 동기화(scrollOffset 차감). **projected tree(§4.12)의 windowing 토대** — collection family cutover 의 일부이지 후순위 분리 과제가 아님                                                                                                                                                                                                                                                                                                      | **HIGH** | collection family cutover 가 projected tree windowing(④.7)을 포함(projected-first). List/Table 1000+ row FPS fixture. 실패 시 해당 family `cutover:"cutting-over"` 보류 — collection Skia legacy 영구 유지 금지(skiaLegacy 는 ADR-142 전환기 출발 상태일 뿐 목표 아님)                                                 |
| T-7       | Skia state 모델 미완 — 현재 `default`/`disabled` 2개만 derive, hover/pressed hit-test wiring 없음 → Builder 화면 hover/pressed 시각 부재                                                                                                                                                                                                                                                                                                                                                                                                     | **HIGH** | Gate G-state. selection family data-attribute parity test. `racStateAttrs` 도입 + `ComponentState` enum derived 격하. 상태 시각 미달 family 는 `cutover:"cutting-over"` 보류                                                                                                                                           |
| T-ADAPT   | base ⊕ override 병합 ↔ 렌더 backend 어댑터 — theme rule base 와 `props.style` override 를 병합(`override ?? base`)한 resolved 시각값을 DOM(React `CSSProperties`) 과 Skia(shape) 로 투영하는 단일 어댑터(`toReactStyle`/`toSkiaStyle`)가 두 backend 에서 동일 결과를 내야 함. shorthand(`padding`)↔longhand 분배, Taffy 레이아웃 reader, token 참조 해소, override 우선 병합이 이 어댑터 한 곳에 모임. **저장 평면화 없음** — `props.style` override layer 보존(ADR-907 Layer B 정합)                                                        | **HIGH** | Gate G2. 어댑터를 단일 모듈로 두고 DOM/Skia 가 그것만 호출(분산 금지). `/cross-check` 가 어댑터 1개를 검증(컴포넌트마다 아님). family fixture 시각 대칭 PASS + reset-to-default(`delete props.style[k]` → base 복귀) round-trip                                                                                        |
| T-PARITY  | 기능 퇴보 — family cutover 가 시각 정합(G2/G5)은 통과해도 기존 컴포넌트의 편집 UX·동작·옵션을 누락하면 "기존 대비 기능 저하"로 폐기된다. **과거 재설계 폐기의 직접 원인**(설계는 무결했으나 정합성 20% 미만 + 기능 퇴보로 폐기). 위험 경로 실측: ① 124 spec → ~35 binding 축약 시 흡수 안 된 컴포넌트별 미세 동작 = 기능 손실, ② generic `resolveEditContract` 통합 시 컴포넌트별 세밀 편집 옵션 누락, ③ 조합 컴포넌트 origin/slot 전환 시 기존 편집 UX 교체(ADR-147 "레거시 Field/Convert to Dynamic 제거")가 기존만큼 강력하지 않으면 퇴보 | **HIGH** | Gate G-parity. family cutover 시 기존 프로젝트 무손실 마이그레이션 + 기존 편집/동작 parity 검증(ADR-147 HC#4 무손실 마이그레이션 패턴을 family 일반 gate 로 격상). 실패 시 family `cutover:"legacy"` 유지 — 정합성만으로 cutover 전환 금지                                                                             |
| T-PROJECT | (ADR-920 흡수, HC#7) collection projected tree(breakdown §4.12)의 render-space `projectionId` 가 canonical mutation/history/IndexedDB 에 유입되면 데이터 corruption. selection/hover/edit/mutation 4 경로마다 projected id guard 필요 — projected tree 도입의 구조적 동반 위험                                                                                                                                                                                                                                                               | **HIGH** | Gate G8. projected id → canonical API 직접 유입 negative fixture PASS + refresh 후 `elementsMap` synthetic projectionId 0건. ADR-135/136 Render-Space Boundary 의 collection 적용 — §5.11 edit route 가 canonical write target 으로 명시 변환. 실패 시 해당 collection family `cutover:"cutting-over"` 보류(전환 금지) |
| T-DEEP    | (ADR-920 흡수, HC#7) collection 깊은 노드(row 내부 Text/Icon, Table cell) 편집 UX 미달 — flattened row 만 선택 가능하면 Skia editor surface drill-in 요구 미충족이자 기능 미달. T-PARITY 와 인접하나 별개: T-PARITY=기존 대비 누락, T-DEEP=신규 editor surface 미달                                                                                                                                                                                                                                                                          | **HIGH** | Gate G9. Skia row 내부 Text/Icon 클릭 → deepest 선택, 더블클릭 → drill-in/data edit, style edit → template route(§5.11). 10k row draw/hit 노드 ≤ window+overscan. 실패 시 flat row selection 만 + phase hold                                                                                                           |
| T-TPL     | (ADR-920 흡수) template subtree layout cache(breakdown §4.7) ↔ 기존 layout publish/projection version 연계 — 별도 cache 가 stale Skia/Layer Tree 유발 가능. T-4 collection virtualization 의 인접 정밀화                                                                                                                                                                                                                                                                                                                                     |   MED    | `TemplateLayoutCacheKey` 무효화를 기존 layout publish/projectionVersion/synthetic element invalidation 신호에 연결(독립 cache 금지). Gate G7 에 흡수                                                                                                                                                                   |
| T-2       | 조합 컴포넌트 수작업 저작(자동 변환 금지, HC#5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |   MED    | Builder 안에서 저작 후 reusable 승격. family 단위 분할                                                                                                                                                                                                                                                                 |
| T-5       | RAC 버전 의존 — breaking change 가 `toRacProps` + `binding.rac.states` 일괄 영향                                                                                                                                                                                                                                                                                                                                                                                                                                                             |   MED    | 단일 wrapper surface(`shared/components`)로 충격 국한                                                                                                                                                                                                                                                                  |
| T-6       | theme 다축 resolve 비용 — 현재 `resolveToken` 은 light/dark binary(`tokenResolver.ts:21`), Pencil 다축은 신규                                                                                                                                                                                                                                                                                                                                                                                                                                |   MED    | 다축 best-match resolver 도입. 다축 요구 컴포넌트 실재 확인 후 도입                                                                                                                                                                                                                                                    |

잔존 HIGH 위험: T-1 / T-3 / T-ADAPT / T-4 / T-7 / T-PARITY / **T-PROJECT / T-DEEP** (8건). 모두 Gate 와 1:1 대응하며 family 단위 격리 가능(T-1→G1 / T-3→G2·G5 / T-ADAPT→G2 / T-4→G7 / **T-7→G-state** / T-PARITY→G-parity / T-PROJECT→G8 / T-DEEP→G9). **T-PARITY 는 과거 재설계 폐기의 직접 원인(정합성 통과 ≠ 기능 동등)을 설계 단계에서 차단하는 위험축** — 정합성 Gate(G2/G5)와 별개로 G-parity 가 기능 동등을 독립 검증한다. **T-7 은 Skia state 모델 미완(hover/pressed 시각 부재)** — G-state 가 selection family cutover 마다 상태 시각 parity 를 독립 검증한다(상태 시각 미달 시 cutover 전환 금지). **T-PROJECT/T-DEEP 는 ADR-920 흡수로 추가된 collection Interactive Projected Tree(HC#7) 의 구조적 위험** — G8(canonical boundary)/G9(깊은 노드 편집)가 각각 1:1 대응한다. behavior/page frame/data 영역은 ADR-131/132/135/136 이 관할하므로 본 ADR Risks 에 추가하지 않는다(breakdown ⑪ 흡수 경계).

## Gates

공통 기반 Gate(G1/G2)는 family cutover 착수 전 1회. family Gate(G4~G6 + G-parity + G-state)는 family 마다 반복(G-state 는 hover/pressed 상태 시각이 있는 selection/interactive family 에 적용). G7 은 전 family `cutover:"catalog"` 도달 시 1회. **G8/G9(ADR-920 흡수)는 collection/tree-table family cutover 의 전환 조건** — 그 family 의 `cutover:"catalog"` 도달이 projected tree(legacy 경유 아님)를 요구하므로, 별도 후순위 단계가 아니라 collection family cutover 와 동시점이다(projected-first). (breakdown ⑩ roadmap 과 동기.)

| Gate     | 시점                                            | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 실패 시 대안                                                           |
| -------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| G1       | 공통 기반 핵심 (T-1)                            | generic 렌더러 DOM/Skia backend 가 resolved canonical tree + theme 소비. **Button vertical slice**: `Button` 노드의 `size="md"→"sm"` 편집 1회 → DOM / Skia / Properties Panel / Style Panel / Publish 5곳이 같은 노드 값(`fontSize:14`)을 즉시 동일 반영 + `/cross-check` 시각 대칭 PASS. 단일 공급원이 코드로 증명됨                                                                                                                                                                                                                                                                                | 공통 기반 재설계, family 전면 보류                                     |
| G2       | base⊕override backend 어댑터 (T-3/T-ADAPT)      | `toReactStyle`/`toSkiaStyle` 단일 어댑터가 theme rule base ⊕ `props.style` override 를 병합해 DOM/Skia 동일 시각으로 투영. text 측정 + 특수 shape(arc/track/indicator) + spacing/fill resolver 가 어댑터 경유. shorthand↔longhand · Taffy reader · override 우선 병합이 어댑터 한 곳에 수렴. reset-to-default(`delete props.style[k]` → base 복귀) round-trip 검증                                                                                                                                                                                                                                   | 해당 family `cutover:"cutting-over"` 보류                              |
| G4       | family Builder cutover                          | family 의 Component Panel / Factory 가 catalog 기준 동작. manual duplicate registration 없음(ADR-139 contract test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | family legacy 유지                                                     |
| G5       | family Preview/Publish/Skia 정합 (T-3)          | family fixture 가 Preview DOM, Skia 양쪽에서 동일 시각(`/cross-check`). reusable/ref/slot 렌더 정상                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | family hidden 또는 legacy fallback                                     |
| G-parity | family 기능 동등 (T-PARITY)                     | family cutover 가 **시각 정합과 별개로 기능 동등**을 통과: ① 기존 프로젝트의 해당 family 컴포넌트가 무손실 마이그레이션(ADR-147 HC#4 패턴 — flat/Field → 조합/dataBinding, default 해석 보존), ② 기존 편집 UX·옵션이 generic Inspector 에서 동등 이상 제공(누락 0), ③ 기존 컴포넌트 동작(selection/disabled/binding 등)이 cutover 후 회귀 0. **collection(ADR-920 흡수)**: ListBox/Table cutover 시 기존 row 편집·selection·정렬·columnMapping/groups/sorting/resizing/pagination/heightMode 동작이 projected tree 전환 후 회귀 0(breakdown 7-4 d parity matrix). **정합성만으로 cutover 전환 금지** | 해당 family `cutover:"legacy"` 유지                                    |
| G-state  | family Skia state 모델 (T-7)                    | family cutover 시 Skia editor surface 가 `default`/`disabled` 뿐 아니라 **hover/pressed/selected 상태 시각**을 derive: `racStateAttrs`(RAC `data-*` 상태 → Skia state) wiring + `ComponentState` enum 으로부터 base⊕override 시각 분기. selection family fixture 가 Builder Skia 에서 hover/pressed data-attribute parity 를 Preview DOM 과 동일하게 통과(`/cross-check` 상태 시각 대칭). **상태 시각 부재로 cutover 전환 금지**                                                                                                                                                                     | 해당 family `cutover:"cutting-over"` 보류 — 상태 시각 미달 family 격리 |
| G6       | family Legacy 격리                              | family active 경로에서 `ComponentSpec`/`ReactRenderer`/`render.shapes` 참조 0건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | family cutover 보류                                                    |
| G7       | Final verification (T-4/T-TPL)                  | `pnpm run codex:preflight` 통과. 전 family `cutover:"catalog"`. collection virtualization List/Table FPS fixture(T-4). template layout cache 가 기존 layout publish/projectionVersion/synthetic invalidation 신호에 연결(T-TPL, 독립 cache 금지). README/ADR status 동기화                                                                                                                                                                                                                                                                                                                           | 실패 family commit revert(다른 family 무영향)                          |
| G8       | collection projected/canonical 경계 (T-PROJECT) | projected render id 가 canonical update/remove/move API 에 직접 유입되는 **negative fixture PASS**. refresh 후 `elementsMap` 에 synthetic projectionId 0건. projected 편집은 §5.11 edit route(template/data/override) 경유만 — ADR-135/136 Render-Space Boundary 정합. (collection/tree-table family cutover 의 일부 — projected-first)                                                                                                                                                                                                                                                              | 해당 collection family `cutover:"cutting-over"` 보류                   |
| G9       | collection Interactive Projected Tree (T-DEEP)  | Skia 에서 collection row 내부 Text/Icon 클릭 → deepest projected 노드 선택, 더블클릭 → drill-in / data edit route, style edit → template route 검증. 10k row ListBox/Table 에서 draw/hit 노드 수 ≤ viewport window + overscan. **collection family 의 `cutover:"catalog"` 도달 조건** — Skia 가 projected tree 로 catalog 전환(legacy `render.shapes` flattened row 아님)                                                                                                                                                                                                                            | flat row selection 만 허용 + 해당 family cutover 보류                  |

## Consequences

### Positive

- 정본이 단일 노드(의미값 + `props.style` override) + 동반 build-time theme rule 테이블로 통합된다. 컴포넌트당 정의 파일과 6개 등록 목록이 단일 `componentCatalog` 로 대체된다.
- Properties Panel·Style Panel·DOM·Skia·Publish 가 같은 노드 하나 + 같은 theme rule 을 공급원으로 삼는다(`resolveEditContract` 합집합 view) — 별도 store/공급처 부재로 패널 간·렌더 간 drift 가 구조적으로 사라진다.
- ADR-907 Layer B(`props.style` override layer)/908(fill rule)/909(longhand 정책)가 보존된다 — 평면화로 닫힌 drift 를 재오픈하지 않는다. base(theme rule) vs 사용자 override(`props.style`) 분리가 유지되어 reset-to-default·size 변경 시 override 유지가 정의된 채로 남는다.
- 컴포넌트당 spec 파일과 변환기가 사라진다(124 spec → ~35 binding). 손유지 정의 표면이 크게 줄어든다.
- 렌더 경로가 generic 렌더러 하나로 단일화된다. `/cross-check` 가 컴포넌트마다가 아니라 렌더러·어댑터를 한 번 검증한다.
- 파생/재사용이 별도 파생 그래프 없이 정상화된다 — base(theme/leaf binding) 수정이 모든 파생/instance 로 자동 전파.
- D1 접근성을 RAC 가 100% 소유 → 접근성 버그 표면이 RAC upstream 으로 국한.

### Negative

- 공통 기반(G1/G2)이 무겁다. Gate 가 아니라 사실상 제품이다 — generic 렌더러 + base⊕override backend 어댑터가 먼저 동작해야 한다.
- 조합 컴포넌트를 reusable 문서로 새로 저작해야 한다(자동 변환 불가).
- generic 렌더러 버그는 family 격리가 안 된다(T-1) — G1 검증 부담이 크다.
- base(theme rule) ⊕ override(`props.style`) 병합을 DOM/Skia 동일 시각으로 투영하는 단일 어댑터가 무겁다(T-ADAPT/T-3) — text 측정/특수 shape/spacing·fill/token 해소/override 병합이 어댑터 한 곳에 모인다.
- collection virtualization 의 Taffy 연계(T-4)와 Skia state 모델(T-7)은 가장 미검증된 영역.
- 컴포넌트당 `render.shapes()` 를 Skia 시각 source 로 둔 메커니즘이 폐기 방향(theme rule 로 대체) — 단 ADR-907 Layer B/908 fill/909 longhand 는 **보존**(평면화 철회로 override layer 유지). ADR-036 status 재평가 필요.
