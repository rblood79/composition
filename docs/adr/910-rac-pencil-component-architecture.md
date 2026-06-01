# ADR-910: RAC core + Pencil format 1차 원리 컴포넌트 아키텍처

## Status

Proposed — 2026-06-01

> 사용자 요청(2026-06-01): "기존 SSOT spec 방식은 무시하고, Adobe React Aria Components(RAC) core 개발 방법론 + Claude Code/Pencil app 개발 방법론으로 컴포넌트 시스템을 새로 설계하라." 본 ADR 은 composition 내부 누적 부채(현행 `*.spec.ts`, 전환기 adapter)를 출발점으로 삼지 않고, 두 외부 검증 자산(RAC + Pencil canonical document format)을 1차 원리로 백지 재유도한 결과다.

## Context

composition(노코드 웹 빌더)의 컴포넌트 시스템은 빌더 방식 변경, local DB 형식 변경, reusable/origin/instance/slot 모델 보정, CSS 최적화, Preview/Skia 경로 보정이 누적되며 **정본이 여러 개인 상태**가 되었다. 컴포넌트 하나를 등록하려면 서로 독립된 6개 목록(Component Panel hard-coded list / Factory creator map / `rendererMap` / `getDefaultProps` map / `BASE_TAG_SPEC_MAP` / builder `TAG_SPEC_MAP`)에 각각 등록해야 한다. 이 목록들이 어긋나며 등록 누락과 CSS/Skia drift 가 반복된다.

`packages/specs/src/components/*.spec.ts` 124개는 컴포넌트당 정의 파일이다. 이 모델(`ComponentSpec.render.shapes()`)은 시각을 직접 그리는 함수 중심이라 RAC 의 구조(parts/slots/render-prop state, collection children)를 표현하지 못한다. 그 결과 Builder(Skia)와 Preview(DOM)가 같은 컴포넌트를 다르게 그리는 정합 실패가 반복됐다.

본 ADR 은 두 검증된 외부 자산을 1차 원리로 삼는다.

- **Adobe React Aria Components(RAC) core 방법론** — data/render 분리(`<Collection items>` + 렌더 함수 → 내부 Node tree), 접근성 hooks(`useButton`/`useTableState`), render-prop state(`composeRenderProps`, `{({isSelected}) => ...}`), slot 합성(`slot="selection"`). 시각은 100% CSS 토큰(`var(--radius)`, `data-variant`). 실측: `packages/react-aria-starter/src` 55 컴포넌트 원본(D3 시각/구조 참조용 vendored snapshot, runtime import 아님).
- **Pencil app/format 방법론** — canonical document 가 **노드 type(실측 8종: frame/text/ref/icon_font/path/ellipse/rectangle/line) + 모든 노드가 공유하는 보편 속성 집합(CSS 처럼, 값만 다름)** 으로 87개 컴포넌트를 코드 0줄로 표현. 컴포넌트화는 데이터에 직접 존재: `reusable:true` frame(origin) / `{type:"ref", ref}`(instance) / `descendants:{nodeId:{override}}`(3-mode) / `{slot:[ids]}`(fill). theme 다축(Accent/Base/Mode) + `variables`(token 값이 theme 조합별 배열, `"$--accent"` 참조). 실측: `docs/migrations/shadcn-design-system.json`.

두 원리는 같은 결론으로 합류한다 — **컴포넌트는 코드 정의 파일이 아니다.** RAC 는 "시각·조합 = 데이터(token/composition)", Pencil 은 "컴포넌트 = 데이터(노드 + 보편 속성)". 둘 다 컴포넌트별 코드를 거부한다.

### 3-domain 분류 (ADR-063 정합)

- **D1 DOM/접근성/상호작용**: RAC(`react-aria-components`)가 절대 권위이자 runtime primitive. composition 은 RAC 동작을 수동 재구현하지 않는다.
- **D2 Props/API**: leaf 는 `PrimitiveBinding.props.accepts`, 조합 컴포넌트는 reusable 문서의 `propsSchema` 가 SSOT(같은 `PropContract` 타입). 컴포넌트당 spec 파일 아님.
- **D3 시각/구조**: 시각 SSOT 는 theme/tokens. 구조 SSOT 는 canonical 문서 트리. 컴포넌트당 `visual` 필드를 두지 않는다.

### Hard Constraints

1. **SSOT**: Publishing / Preview / Style·Properties Panel / Skia Rendering 이 모두 하나의 공급처에서 같은 값을 받는다. 예: `button.size="sm"` → `fontSize:14` 가 4곳 동일. 공급처 값이 바뀌면 4곳 즉시 동일 반영. **보장 근거는 "단일 노드에 박힌 computed 값"이 아니라 "두 backend 가 동일 `componentRulesTable` 심볼 + 동일 `resolveToken` 구현을 호출"** (적대적 검증: 실측 `ResolvedNode`(`canonical-resolver.types.ts:107-118`)에 computed/dataAttributes 필드 없음 — resolve 는 ref→descendants→slot 까지).
2. **Skia 성능**: Skia 화면=시각적 빌더 화면, 60fps 최저선(엔터프라이즈 타깃). List/Table/Grid 반복 컬렉션은 Viewport Culling + Virtualization 으로 보이는 영역만 렌더. Pencil App 수준의 정확한 Skia 텍스트(CanvasKit Paragraph).
3. **canonical schema 불변**: `CompositionDocument` / `CanonicalNode.type=ComponentTag` + `props` bag / reusable·ref·descendants·slot 스키마를 변경하지 않는다(ADR-142 HC#4 수렴, 적대적 검증으로 재확인). "Pencil 8 primitive node 로 UI 트리를 재구성"은 별도 ADR scope — 본 설계 범위 밖.
4. **깨진 spec 참조 금지**: 조합 컴포넌트 reusable 문서는 starter + 디자인 의도로부터 새로 저작. 구버전 spec 에서 자동 변환하지 않는다(사용자 제약 2026-05-19).
5. **RAC 절대 권위 보존**: ARIA/키보드/포커스를 RAC 가 100% 소유. composition 코드는 prop 투영(`toRacProps`)만 — ARIA 수동 작성 0.

### Soft Constraints

- 공통 기반(resolve + generic DOM 렌더러 + generic Skia 렌더러 + Inspector field renderer + theme resolve)은 family cutover 보다 선행해야 한다(generic 렌더러는 family-무관 단일 코드).
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

> 구현 상세: [910-rac-pencil-component-architecture-breakdown.md](design/910-rac-pencil-component-architecture-breakdown.md) — 설계 산출물 ①~⑩(아키텍처 개요 / Format Schema / RAC→Format 변환 / Skia 렌더 레이어 / Panel 연동 / Publishing·Preview / 컴포넌트 예시 / TS 타입 / trade-off / roadmap).

## Risks

> Alternatives 단계의 4축 평가는 대안 비교용이고, 본 섹션은 대안 E 이행 중 관리할 잔존 운영 위험이다. ID 는 breakdown ⑨ trade-off 분석과 1:1 대응한다.

| ID   | 위험                                                                                                                                     |  심각도  | 대응                                                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | :------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1  | generic 렌더러 공통 기반(resolve/generic DOM/generic Skia/Inspector/theme resolve) 1개 버그가 모든 family 동시 회귀. family 격리 안 됨   | **HIGH** | Gate G1 + Button vertical slice(breakdown ⑩.5). slice 깨지면 공통 기반 재설계, family 진행 중단                                                                  |
| T-3  | Skia generic 이 `render.shapes` 재현 부담 — text 측정 64 + 특수 shape 38 + ADR-907 spacing 4 + ADR-908 fill 30 resolver re-home          | **HIGH** | Gate G5 `/cross-check` family 마다. family 별 `skiaLegacy:true` 격리 → 다음 family 진행                                                                          |
| T-4  | collection virtualization ↔ Taffy layout 연계 복잡도. 보이는 item 만 렌더하며 전체 content height 동기화(scrollOffset 차감)              | **HIGH** | 전 family cutover 후 일괄 과제(breakdown ⑩.3). List/Table 1000+ row FPS fixture. 실패 시 collection Skia legacy 유지                                             |
| T-7  | Skia state 모델 미완 — 현재 `default`/`disabled` 2개만 derive, hover/pressed hit-test wiring 없음 → Builder 화면 hover/pressed 시각 부재 | **HIGH** | selection family data-attribute parity test. `racStateAttrs` 도입 + `ComponentState` enum derived 격하                                                           |
| T-2  | 조합 컴포넌트 수작업 저작(자동 변환 금지, HC#4)                                                                                          |   MED    | Builder 안에서 저작 후 reusable 승격. family 단위 분할                                                                                                           |
| T-5  | RAC 버전 의존 — breaking change 가 `toRacProps` + `binding.rac.states` 일괄 영향                                                         |   MED    | 단일 wrapper surface(`shared/components`)로 충격 국한                                                                                                            |
| T-6  | theme 다축 resolve 비용 — 현재 `resolveToken` 은 light/dark binary(`tokenResolver.ts:21`), Pencil 다축은 신규                            |   MED    | 다축 best-match 는 별도 변경. 다축 요구 컴포넌트 실재 확인 후 도입                                                                                               |
| R-S1 | 두 backend 가 다른 rule 테이블/`resolveToken` 호출 시 값 drift(transition 중 DOM=CSSGenerator spec 파생, Skia=rule 테이블)               |   MED    | `/cross-check` family 마다 + `generate-rules.ts` 가 spec→rule build-time 복제로 값 동일 보장(전환기). runtime 단일화는 CSSGenerator/sizes 축 rule 전환 완료 시점 |

잔존 HIGH 위험: T-1 / T-3 / T-4 / T-7 (4건). 모두 Gate 와 1:1 대응하며 family 단위 격리 가능.

## Gates

공통 기반 Gate(G1/G2)는 family cutover 착수 전 1회. family Gate(G4~G6)는 family 마다 반복. G7 은 전 family `cutover:"catalog"` 도달 시 1회. (breakdown ⑩.2/⑩.6 와 동기.)

| Gate | 시점                                   | 통과 조건                                                                                                                                                                                                                                                                                                     | 실패 시 대안                                  |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| G1   | 공통 기반 핵심 (T-1)                   | generic 렌더러 DOM/Skia backend 가 resolved canonical tree + theme 소비. Preview 가 `resolveCanonicalDocument()` 결과를 단일 source 로 소비. **Button vertical slice**(`componentRulesTable["Button"].sizes.sm.fontSize` 1곳 mutation → DOM/Skia/Panel/Publish 4곳 즉시 동기 + `/cross-check` 시각 대칭 PASS) | 공통 기반 재설계, family 전면 보류            |
| G2   | Skia-rewrite (T-3)                     | `buildSpecNodeData` 재작성 + ADR-907 spacing / ADR-908 fill resolver re-home + text 측정 64 spec 재현 + `skiaPrimitive`(arc/track/indicator). 통과 전까지 Preview canonical + Skia legacy fallback 유지                                                                                                       | 해당 family `skiaLegacy:true` 격리            |
| G4   | family Builder cutover                 | family 의 Component Panel / Factory 가 catalog 기준 동작. manual duplicate registration 없음(ADR-139 contract test)                                                                                                                                                                                           | family legacy 유지                            |
| G5   | family Preview/Publish/Skia 정합 (T-3) | family fixture 가 Preview DOM, Skia 양쪽에서 동일 시각(`/cross-check`). reusable/ref/slot 렌더 정상                                                                                                                                                                                                           | family hidden 또는 legacy fallback            |
| G6   | family Legacy 격리                     | family active 경로에서 `ComponentSpec`/`ReactRenderer`/`render.shapes` 참조 0건                                                                                                                                                                                                                               | family cutover 보류                           |
| G7   | Final verification (T-4)               | `pnpm run codex:preflight` 통과. 전 family `cutover:"catalog"`. collection virtualization List/Table FPS fixture(T-4). README/ADR status 동기화                                                                                                                                                               | 실패 family commit revert(다른 family 무영향) |

## Consequences

### Positive

- 정본이 canonical 문서 + 동반 build-time 테이블(`componentCatalog`/`componentRulesTable`)로 통합된다. 6개 등록 목록이 단일 `componentCatalog` 로 대체된다.
- 컴포넌트당 spec 파일과 변환기가 사라진다(124 spec → ~35 binding). 손유지 정의 표면이 크게 줄어든다.
- 렌더 경로가 generic 렌더러 하나로 단일화된다. `/cross-check` 가 컴포넌트마다가 아니라 렌더러를 한 번 검증한다.
- 파생/재사용이 별도 파생 그래프 없이 정상화된다 — base(theme/leaf binding) 수정이 모든 파생/instance 로 자동 전파.
- D1 접근성을 RAC 가 100% 소유 → 접근성 버그 표면이 RAC upstream 으로 국한.

### Negative

- 공통 기반(G1/G2)이 무겁다. Gate 가 아니라 사실상 제품이다 — generic 렌더러 + Preview resolved-tree 가 먼저 동작해야 한다.
- 조합 컴포넌트를 reusable 문서로 새로 저작해야 한다(자동 변환 불가).
- generic 렌더러 버그는 family 격리가 안 된다(T-1) — G1 검증 부담이 크다.
- Skia generic 이 `render.shapes` 시각을 전부 재현해야 한다(T-3) — text 측정/특수 shape/spacing·fill resolver re-home 이 G2 의 최대 무게.
- collection virtualization 의 Taffy 연계(T-4)와 Skia state 모델(T-7)은 현재 미구현 — 가장 미검증된 영역.
- 컴포넌트당 spec 을 D3 SSOT 로 둔 ADR-036/907/908 의 메커니즘이 폐기 방향 — status 재평가 필요.
