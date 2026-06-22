# ADR-911: RAC core + Pencil format 백지 목표 컴포넌트 아키텍처

## Status

Proposed — 2026-06-02

> **문서 위상: 비실행 목표 참조(Target Reference)**. 본 ADR 은 `execute-adr` 착수 문서가 아니다. **실행 owner(Phase land / 레거시 제거 / 등록 collapse)는 [ADR-912](completed/912-rac-pencil-rebuild-cutover.md)(백지 직행, 유일 착수) 다** — 사용자 옵션 B 결정(2026-06-02)으로 점진 cutover([ADR-910](910-rac-pencil-component-architecture.md))은 착수하지 않고 점진 전략 비교 기록으로 남는다(codex review 2026-06-02 라우팅 동기화). 본 ADR 의 Gate 는 구현 phase gate 가 아니라 목표 구조가 성립하는지 검증하는 **proof gate** 이며, 실패 시 직접 land 를 보류하는 것이 아니라 목표 구조 또는 ADR-912 실행 설계를 재검토한다.

> 본 ADR 은 **백지 목표 아키텍처 설계서** 다. 현재 composition 코드(누적된 `*.spec.ts`, 레지스트리, 전환기 adapter)를 출발점으로 삼지 않고, 두 외부 검증 자산(RAC core + Pencil canonical document format)을 1차 원리로 하여 **"아래 조건을 만족하는 컴포넌트 시스템은 정적으로 어떤 구조인가"** 만 유도한다. 현재 코드에서 이 목표로 가는 전환 경로(마이그레이션 / cutover / family 순서 / 레거시 제거 / 성능 회귀 방어)는 본 ADR 범위가 **아니다** — 그 전환 설계는 [ADR-910](910-rac-pencil-component-architecture.md)(cutover 실행 설계서)가 담당한다. 두 문서는 같은 1차 원리에서 출발하므로 목표 구조가 수렴하며, 본 ADR 은 "목표가 무엇인가"를, ADR-910 은 "현재에서 거기로 어떻게 가는가"를 분담한다.

## Context

composition 은 노코드 웹 빌더다. 빌더 화면은 Skia 로 그려지는 직접 조작 editor 이고, Preview/Publish 는 DOM+CSS(React Aria Components)로 렌더된다. 두 렌더 매체가 같은 컴포넌트를 그리므로 **시각 결과의 동일성(대칭)** 이 컴포넌트 시스템의 1차 요구다.

본 ADR 은 그 컴포넌트 시스템을 두 검증된 외부 원리로부터 유도한다.

- **Adobe React Aria Components(RAC) core 방법론** — data/render 분리(`<Collection items>` + 렌더 함수 → 내부 Node tree), 접근성 hooks, render-prop state(`composeRenderProps`), slot 합성. 시각은 100% CSS 토큰(`var(--radius)`, `data-variant`). 입력 reference: `packages/react-aria-starter/src` 55 컴포넌트 + 그 CSS token/패턴을 정규화한 `packages/design.md`(reference baseline — runtime 계약 아님, theme/tokens 저작의 선행 입력).
- **Pencil app/format 방법론** — canonical document 가 노드 type + 모든 노드가 공유하는 보편 속성 집합(CSS 처럼, 값만 다름)으로 컴포넌트를 코드 0줄로 표현. 컴포넌트화는 데이터에 직접 존재: `reusable:true`(origin) / `{type:"ref"}`(instance) / `descendants`(override) / `slot`(fill). 입력 reference: `docs/migrations/shadcn-design-system.json`.

두 원리는 같은 결론으로 합류한다 — **컴포넌트는 코드 정의 파일이 아니다.** RAC 는 "시각·조합 = 데이터", Pencil 은 "컴포넌트 = 데이터". 본 ADR 은 이 합류점이 정적으로 어떤 구조인지를 규정한다.

> **이 ADR 이 다루지 않는 것**: 현재 코드의 진단(정본 다중성, 등록 누락, drift 빈도), 전환 비용, 기존 자산 호환, family 단위 순서, 레거시 제거 시점. 이것들은 전환 문제이며 ADR-910 의 영역이다. 본 ADR 의 모든 평가는 **목표 구조 자체의 성립성** 기준이다.

### 3-domain 분류 (ADR-063 정합)

- **D1 DOM/접근성/상호작용**: RAC(`react-aria-components`)가 절대 권위이자 runtime primitive. composition 은 RAC 동작을 수동 재구현하지 않는다.
- **D2 Props/API**: leaf 는 `PrimitiveBinding.props.accepts`, 조합 컴포넌트는 reusable 문서의 props 계약(같은 `PropContract` 타입)이 SSOT. 컴포넌트당 spec 파일 아님.
- **D3 시각/구조**: 시각 SSOT 는 theme/tokens. 구조 SSOT 는 canonical 문서 트리. 컴포넌트당 `visual` 필드를 두지 않는다.

### Hard Constraints

1. **단일 공급원 SSOT**: 한 노드의 편집 가능한 값은 그 노드 하나에서 나온다. 의미값(`content`/`variant`/`size`)은 노드 props 에, 사용자가 덮어쓴 시각값은 `node.props.style`(override layer)에 있다. 시각 base(컴포넌트 default)는 노드가 아니라 theme rule 에서 resolve 된다. Publishing / Preview / Properties Panel / Style Panel / Skia Rendering 이 모두 **같은 노드 하나 + 같은 theme rule** 을 공급원으로 삼는다.
2. **패널 = 단일 공급원의 두 view**: Properties Panel 과 Style Panel 은 공급처가 둘이 아니라, 한 노드의 편집 계약 하나를 `section` 태그로 필터링한 두 화면이다. 편집 진입점은 `resolveEditContract(node)` 하나 — 의미 props 계약과 보편 시각 속성 계약을 합집합으로 묶는다. 저장 평면화를 요구하지 않는다.
3. **base / override 2층 schema**: base(컴포넌트 default)는 노드에 저장하지 않고 theme rule 에서 resolve 하며, 사용자 override 는 `node.props.style` 에만 저장한다. 병합은 `props.style[k] ?? rule.resolve(k)`(override 우선, fallback base). base/override 는 **노드 간**(origin ↔ ref.descendants)으로 분리하고 한 노드 안에 섞지 않는다. reset-to-default(`delete props.style[k]`), size 변경 시 override 유지, instance override 가 모두 이로부터 정의된다.
4. **Skia 성능**: Skia 화면 = 시각적 빌더 화면, 60fps 최저선(엔터프라이즈 타깃). List/Table/Grid 반복 컬렉션은 Viewport Culling + Virtualization 으로 보이는 영역만 렌더. CanvasKit Paragraph 수준의 정확한 텍스트.
5. **조합 컴포넌트 = 데이터**: 조합 컴포넌트는 코드 정의 파일이 아니라 `reusable:true` 노드 문서로 표현된다. 신규 조합 컴포넌트 추가는 코드 변경 0(빌더 저작 후 reusable 승격).
6. **RAC 절대 권위 보존**: ARIA/키보드/포커스를 RAC 가 100% 소유. composition 코드는 prop 투영(`toRacProps`)만 — ARIA 수동 작성 0.
7. **Skia editor surface 는 projected 하위 노드 접근 가능**: 빌더 Skia 화면은 미리보기가 아니라 직접 조작 editor 다. collection 깊은 노드(row 내부 Text/Icon, Table cell)는 canonical 에 전부 materialize 하지 않되, Skia runtime 에서 hit-test·drill-in·edit-route 가능한 projected tree(`template subtree × visible data window`)로 존재한다. render-space projected id 와 canonical write target 은 분리한다.

### Soft Constraints

- 공통 기반(노드 resolve + generic DOM 렌더러 + generic Skia 렌더러 + 단일 Inspector field renderer + theme resolve)은 family-무관 단일 코드다 — 목표 구조에서 컴포넌트별로 갈리는 코드 표면이 최소여야 한다.
- D1 접근성은 RAC 가 100% 소유하므로 접근성 동작은 composition 의 설계 자유도 밖이다(RAC 에 위임).
- 시각 정본은 theme/tokens 이며 OKLCH relative-color + light/dark/다축 adaptation 을 따른다(현재 토큰 모델 유지).

## Alternatives Considered

> 본 ADR 은 백지 목표 설계이므로, 대안은 "현재 코드를 어떻게 고치는가"가 아니라 **"컴포넌트를 무엇으로 표현하는 목표 구조인가"** 의 설계 선택이다. 마이그레이션 축은 전환 문제(ADR-910)이므로 각 대안에서 N/A 로 둔다.

### 대안 A: 컴포넌트당 코드 정의 객체 (component-as-code)

- 설명: 컴포넌트마다 정의 파일/객체를 두고, 시각·변형·구조를 그 객체가 선언. 렌더러가 객체를 소비.
- 근거: 업계 다수 디자인 시스템(컴포넌트별 컴포넌트 파일)의 표준 형태.
- 위험:
  - 기술: M — 객체 스키마로 RAC data/render 분리·collection children 을 표현하려면 스키마가 계속 두꺼워진다.
  - 성능: M — 컴포넌트당 정의 런타임 로드.
  - 유지보수: **H** — 컴포넌트 N개 = 정의 N개 = 시각·등록·렌더 변환기가 컴포넌트별로 증식. canonical 문서와 평행한 두 번째 SSOT.
  - 마이그레이션: N/A — 전환 문제(ADR-910), 목표 평가 제외.

### 대안 B: 두꺼운 단일 컴포넌트 스키마 (fat schema)

- 설명: 단일 스키마를 충분히 두껍게 설계해 RAC 의 parts/slots/render-prop state/collection children 을 모두 담는다. 렌더러가 스키마를 직접 그린다.
- 근거: 단일 스키마라 등록은 하나. 점진 확장 가능.
- 위험:
  - 기술: **H** — 스키마가 시각을 직접 그리는 방향이면 RAC 의 data/render 분리와 충돌. 합성/상태 표현을 위해 스키마가 무한 확장.
  - 성능: M — 스키마 해석 비용.
  - 유지보수: **H** — 시각 + 구조 + 상태가 한 스키마에 응집되어 변경 충격이 전역.
  - 마이그레이션: N/A.

### 대안 C: 컴포넌트당 contract 객체 + 컴포넌트당 변환기

- 설명: 컴포넌트당 contract 객체 + 컴포넌트당 변환기(`toGeneratedCss` / `toSkiaVisualModel` / `toInspectorFields`).
- 근거: 스키마를 깨끗이 재설계하면서 RAC 구조 표현 가능.
- 위험:
  - 기술: M — 새 스키마 설계 가능.
  - 성능: M.
  - 유지보수: **H** — 변환기 output 다수가 (문서 노드 + theme)의 함수이지 컴포넌트당 계약의 산물이 아님. 컴포넌트당 두면 N×변환기 손유지 + canonical 문서와 평행한 두 번째 SSOT.
  - 마이그레이션: N/A.

### 대안 D: RAC 직접 사용 (binding 레이어 없음)

- 설명: leaf wrapper 없이 목표 구조가 RAC primitive 를 곳곳에서 직접 소비.
- 근거: 중간 레이어 제거.
- 위험:
  - 기술: M.
  - 성능: L.
  - 유지보수: **H** — props mapping / canonical 정규화 / `toRacProps` 투영의 단일 위치가 소멸하고 분산. RAC 버전 충격이 곳곳에 직접. Pencil "데이터 1곳" 원리 위반.
  - 마이그레이션: N/A.

### 대안 E: Canonical 문서 SSOT + RAC primitive binding (document 모델)

- 설명: leaf = RAC primitive 1개당 `PrimitiveBinding` 하나(코드, ~35). 조합 = `reusable:true` 노드 문서(데이터). 등록 = 단일 `componentCatalog`. 시각 = theme/tokens(`data-*`). 렌더 = (resolved canonical tree + theme)를 소비하는 generic 렌더러 하나(traversal 1, backend 2: DOM/Skia). collection 깊은 노드는 Interactive Projected Tree.
- 근거: RAC 원리(data/render 분리) + Pencil 원리(컴포넌트 = 데이터)에 **동시 정합**하는 유일 구조. 두 외부 원리의 합류점 그 자체.
- 위험:
  - 기술: **H** — generic 렌더러 + base⊕override 단일 어댑터 + collection projected tree 가 제품 규모에서 성립함이 목표 설계 단계에서는 미증명.
  - 성능: M — 컴포넌트당 정의 부재로 정의 표면 최소. 단 collection projected tree 의 60fps 성립이 미증명.
  - 유지보수: **L** — 컴포넌트당 정의 파일 부재 → drift 할 "다른 곳"이 구조적으로 없음. 파생/재사용이 reusable 참조로 자동 정상화.
  - 마이그레이션: N/A.

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :---: | :--: | :------: | :----------: | :--------: |
| A    |   M   |  M   |  **H**   |     N/A      |     1      |
| B    | **H** |  M   |  **H**   |     N/A      |     2      |
| C    |   M   |  M   |  **H**   |     N/A      |     1      |
| D    |   M   |  L   |  **H**   |     N/A      |     1      |
| E    | **H** |  M   |    L     |     N/A      |     1      |

루프 판정: 모든 대안이 HIGH 1개 이상. A/C/D 의 HIGH(유지보수)는 **목표 구조 자체에 내재한 영구 비용**(컴포넌트당 정의/분산 = drift 표면이 구조적으로 존재)인 반면, E 의 HIGH(기술)는 **목표 구조의 미증명 영역**(공통 기반·projected tree 성립성)으로 Gate(vertical slice + projected fixture)로 증명 가능한 1회성이다. 유지보수 HIGH 를 LOW 로 낮추는 유일 대안이 E 이며, E 의 기술 HIGH 는 증명 게이트로 관리 가능 → 추가 대안 없이 E 채택.

## Decision

**대안 E: Canonical 문서 SSOT + RAC primitive binding** 을 목표 아키텍처로 채택한다.

선택 근거(위험 수용):

1. **유지보수 LOW 가 목표의 본질** — 노코드 빌더에서 컴포넌트는 사용자가 데이터로 만든다. 컴포넌트당 정의 파일이 없는 구조(E)만 "컴포넌트 = 데이터" 원리에 정합하고, drift 할 평행 SSOT 가 구조적으로 부재하다. A/C/D 의 유지보수 HIGH 는 목표 구조 자체에 내재한 영구 비용이다.
2. **기술 HIGH 의 증명 가능성** — E 의 기술 HIGH(generic 공통 기반·collection projected tree 성립)는 단일 vertical slice 와 projected fixture 로 목표 단계에서 증명 가능한 미지수다. 구조에 내재한 영구 비용이 아니다.
3. **두 외부 원리에 동시 정합** — E 는 RAC(data/render 분리) + Pencil(컴포넌트=데이터)에 동시 정합하는 유일 구조다. 본 ADR 의 1차 원리(RAC core + Pencil format)의 직접 귀결.

기각 사유:

- **대안 A 기각**: 컴포넌트당 코드 정의는 "컴포넌트 = 데이터"(HC#5)와 정면 충돌하고 drift 표면을 구조화한다.
- **대안 B 기각**: 시각을 직접 그리는 두꺼운 스키마는 RAC data/render 분리를 표현 못 하고 무한 확장한다.
- **대안 C 기각**: 컴포넌트당 contract 객체 + 변환기는 canonical 문서와 평행한 두 번째 SSOT 다.
- **대안 D 기각**: 단일 props 투영 위치가 소멸하고 RAC 버전 충격이 분산된다(Pencil "데이터 1곳" 원리 위반).

> 목표 상세: [911-rac-pencil-target-component-architecture-breakdown.md](design/911-rac-pencil-target-component-architecture-breakdown.md) — 목표 아키텍처 정적 정의(아키텍처 개요 / Component Schema / RAC binding / Generic 렌더 + Interactive Projected Tree / 편집 계약 + edit route / 시각 SSOT / 컴포넌트 예시 / 핵심 타입 / HC↔구조 1:1 증명). 현재 코드에 도입하는 실행 순서와 파일 mutation scope 는 ADR-910 breakdown 이 소유한다.

> **ADR-910/912 와의 관계**: 본 ADR(목표 설계)과 ADR-910(점진 cutover 비교 기록)·ADR-912(백지 직행 착수)는 같은 1차 원리에서 출발하므로 목표 구조가 동일하다. 차이는 전략·관점이다 — 본 ADR 은 현재 코드를 참조하지 않고 "조건을 만족하는 목표 구조"만 규정하고, ADR-910 은 점진 cutover(legacy 격리), ADR-912 는 백지 직행(레거시 미보존)이다. 본 ADR 의 Risks/Gates 는 **목표 구조의 성립성** 만 평가하며, 실행 위험(레거시 제거 / 정합성 회귀 / 등록 collapse)은 ADR-912 가 보유한다. **따라서 착수(execute-adr) ADR 은 911 도 910 도 아니라 ADR-912** 이며(사용자 옵션 B 2026-06-02), 911 은 912 의 실행 중 목표 구조 drift 를 판정하는 reference 로만 사용한다.

## Risks

> 본 섹션은 목표 아키텍처 E 자체의 **설계 성립 불확실성** 이다. 현재 코드 전환 위험(마이그레이션 / cutover / 레거시 제거 / 정합성 회귀)은 본 ADR 범위가 아니다(ADR-910). 따라서 마이그레이션 축 위험은 본 표에 없다.

| ID  | 위험                                                                                                                                                               |  심각도  | 대응                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------: | --------------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | generic 렌더러 공통 기반(resolve + generic DOM + generic Skia + Inspector + theme resolve)이 제품 규모의 모든 컴포넌트를 단일 코드로 표현 가능한지 미증명          | **HIGH** | Gate G-slice — 단일 컴포넌트(Button) vertical slice 로 공통 기반이 단일 공급원을 코드로 증명. 실패 시 목표 구조 E 재검토                |
| R-2 | base ⊕ override 단일 어댑터(`toReactStyle`/`toSkiaStyle`)가 DOM 과 Skia 에서 동일 시각 결과를 내는지 미증명 — text 측정/특수 shape/spacing/token 해소가 한 곳 집중 | **HIGH** | Gate G-adapter — `/cross-check` 시각 대칭 + reset-to-default round-trip. 단일 어댑터가 두 backend 동일 결과 증명                        |
| R-3 | collection Interactive Projected Tree(④.2)가 60fps + 깊은 노드 편집을 동시에 성립시키는지 미증명 — projected id ↔ canonical write target 분리 정합                 | **HIGH** | Gate G-projected — 10k row projected draw/hit ≤ window+overscan + 깊은 노드 클릭/drill-in/edit route + projected id 의 canonical 비유입 |
| R-4 | Skia 상태 모델(hover/pressed/selected)이 RAC data-attribute 와 동일 규칙으로 derive 되는지 미증명 — Skia 는 caller 결정 단일 값, DOM 은 자동 `:hover`              | **HIGH** | Gate G-state — selection 컴포넌트 fixture 가 Builder Skia ↔ Preview DOM 상태 시각 parity                                                |
| R-5 | theme 다축(Accent/Base/Mode) resolve 가 단일 best-match resolver 로 성립하는지 — 현재 토큰 모델은 light/dark binary                                                |   MED    | 다축 best-match resolver 설계. 다축 요구 컴포넌트 실재 확인 후 도입                                                                     |
| R-6 | RAC 버전 변경이 `toRacProps` + binding states 계약에 미치는 충격 표면                                                                                              |   MED    | 단일 binding/wrapper surface 로 충격 국한                                                                                               |

잔존 HIGH 위험: R-1 / R-2 / R-3 / R-4 (4건). 모두 목표 구조의 미증명 영역이며 각각 증명 Gate 와 1:1 대응한다. 전환 위험(기존 마이그레이션 / 정합성 회귀 / cutover 격리)은 본 ADR 에 없다 — ADR-910 이 보유한다.

## Gates

> 본 ADR 의 Gate 는 **proof gate(비실행)** 다 — "목표 구조가 조건(HC)을 만족함을 증명"하는 검증이지 `execute-adr` 가 land 하는 phase gate 가 아니다. 실패 시 직접 land 를 보류하는 것이 아니라 목표 구조 E 또는 ADR-912 실행 설계를 재검토한다. 레거시 제거 / 등록 collapse / G-slice·G-adapter·G-state·G-projected 같은 실행 게이트는 **ADR-912** 의 영역이며 본 표에 없다(착수 owner=912, 사용자 옵션 B 2026-06-02).

| Gate        | 시점                             | 통과 조건                                                                                                                                                                                                                                             | 실패 시 대안                      |
| ----------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| G-slice     | 공통 기반 증명 (R-1)             | 단일 컴포넌트(Button) 노드의 `size` 편집 1회 → DOM / Skia / Properties Panel / Style Panel / Publish 5곳이 같은 노드 값 + 같은 theme rule base 를 즉시 동일 반영. 단일 공급원(HC#1·HC#2)이 코드로 증명됨                                              | 목표 구조 E 재검토                |
| G-adapter   | base⊕override 어댑터 (R-2)       | `toReactStyle`/`toSkiaStyle` 단일 어댑터가 theme rule base ⊕ `props.style` override 를 병합해 DOM/Skia 동일 시각 투영. `/cross-check` 대칭 PASS + reset-to-default(`delete props.style[k]` → base 복귀) round-trip. base/override 2층(HC#3) 증명      | 어댑터 책임 분해 재설계           |
| G-projected | Interactive Projected Tree (R-3) | Skia collection row 내부 Text/Icon 클릭 → deepest projected 노드 선택, 더블클릭 → drill-in/data edit, style edit → template route. 10k row draw/hit 노드 ≤ window+overscan(60fps). projected id 가 canonical mutation/영속에 0건 유입. HC#4·HC#7 증명 | 깊은 노드 편집 미달 — 구조 재검토 |
| G-state     | Skia 상태 모델 (R-4)             | selection 컴포넌트 fixture 가 Builder Skia hover/pressed/selected 상태 시각을 Preview DOM 과 동일하게 derive(`data-*` parity)                                                                                                                         | 상태 모델 재설계                  |

## Consequences

### Positive

- 정본이 단일 노드(의미값 + `props.style` override) + theme rule 테이블로 통합된다. 컴포넌트당 정의 파일과 등록 목록이 단일 `componentCatalog` 로 표현된다.
- Properties Panel·Style Panel·DOM·Skia·Publish 가 같은 노드 하나 + 같은 theme rule 을 공급원으로 삼는다(`resolveEditContract` 합집합 view) — 별도 store/공급처 부재로 패널 간·렌더 간 drift 가 구조적으로 사라진다.
- 컴포넌트당 정의 파일이 없다 — 조합 컴포넌트는 reusable 문서(데이터), 신규 추가가 코드 변경 0.
- 렌더 경로가 generic 렌더러 하나로 단일화된다. `/cross-check` 가 컴포넌트마다가 아니라 렌더러·어댑터를 한 번 검증한다.
- D1 접근성을 RAC 가 100% 소유 → 접근성 버그 표면이 RAC upstream 으로 국한.
- collection 깊은 노드가 Skia editor 에서 직접 편집 가능(Interactive Projected Tree) — 빌더 화면이 미리보기가 아니라 editor 라는 요구를 충족.

### Negative

- 공통 기반(generic 렌더러 + base⊕override 단일 어댑터 + projected tree)이 무겁다 — Gate 가 아니라 사실상 제품이다.
- 조합 컴포넌트를 reusable 문서로 저작해야 한다(코드 자동 생성 아님).
- generic 렌더러 버그는 전 컴포넌트 동시 영향(R-1) — 공통 기반 증명 부담이 크다.
- base ⊕ override 를 DOM/Skia 동일 시각으로 투영하는 단일 어댑터가 무겁다(R-2) — text 측정/특수 shape/spacing/token 해소가 어댑터 한 곳에 모인다.
- collection projected tree(R-3)와 Skia 상태 모델(R-4)이 목표 구조에서 가장 미증명된 영역이다.
