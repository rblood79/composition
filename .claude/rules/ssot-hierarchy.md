# SSOT 체인 정본 — 3-Domain 분할

> **정본**: composition 프로젝트 전체의 Spec/SSOT/권위 관계를 규정하는 최상위 규칙. 모든 ADR, skill, agent, 규칙 파일은 본 문서를 참조한다. 본 문서가 ADR-063(charter)의 명시적 부연이며, D3 SSOT 메커니즘은 ADR-142(2026-06-02 Implemented)로 재정의됐다. 다른 문서와 충돌 시 본 문서 우선.

> §0 역사적 맥락 · §2 용어 사전 · §5 주요 ADR 관계는 [ssot-hierarchy-context.md](ssot-hierarchy-context.md) 로 분리 (2026-08-31 — `docs/adr/**` · `packages/specs/**` · `packages/shared/src/catalog/**` 작업 시 자동 로드). 절 번호는 인용 안정성을 위해 그대로 둔다.

## 1. 3-Domain 분할 (핵심)

composition 아키텍처는 **3개의 독립 domain**으로 구성된다. 각 domain은 고유 권위를 가지며 경계 교차 금지.

> **2026-07-08 갱신 (ADR-142 Implemented)**: D3 SSOT는 컴포넌트당 spec 파일에서 **catalog(`COMPONENT_RULES_TABLE`) + theme/tokens root collection**으로 전환됐다. 아래 표와 "D3 (시각 스타일)" 절은 이 전환을 반영한다. 잔존 spec 3개(Frame/Group/Slot)는 D1 ARIA 예외(Group) 및 canonical layout container(Frame) 한정 존속이며, 일반 컴포넌트는 전부 catalog 경로다. 상세: [ADR-142](../../docs/adr/completed/142-starter-spec-component-system-cutover.md), [ADR-036 Superseded 안내](../../docs/adr/completed/036-spec-first-single-source.md).

| Domain              | 권위                                                       | 내용                                                      | Spec 개입                                               |
| ------------------- | ---------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| **D1. DOM/접근성**  | **Adobe RAC (절대)**                                       | HTML 구조, ARIA 속성, 키보드 동작, 포커스 관리, 접근성    | **금지 — 관찰·소비만**                                  |
| **D2. Props/API**   | **RSP 참조 + custom 확장**                                 | 사용자 편의 props (isQuiet, contextualHelp 등)            | 타입 선언만, 구현은 RAC + custom                        |
| **D3. 시각 스타일** | **catalog(`COMPONENT_RULES_TABLE`) + theme/tokens (SSOT)** | 화면에 보여지는 style 전부 — 색상/크기/폰트/레이아웃/형태 | **잔존 spec 3개(Frame/Group/Slot) 한정, 그 외 catalog** |

### D1 (DOM/접근성)

- **소유자**: React Aria Components (RAC) — unstyled primitive 라이브러리
- **composition 역할**: RAC가 출력하는 DOM 구조를 **그대로 사용**. 수정/확장 금지
- **선택 이유**: RAC가 unstyled이므로 스타일 자유도 확보 가능 (← 이것이 RAC 선택의 본질적 이유)
- **금지 사항**:
  - RAC 컴포넌트의 DOM 구조 재작성
  - aria 속성 수동 작성 (RAC가 제공하는 것 사용)
  - 접근성 동작 변경

### D2 (Props/API)

- **참조 원천**: React Spectrum (RSP) — Adobe의 고수준 스펙트럼 API
- **마이그레이션 기준**: **RAC + custom 구현으로 달성 가능한 범위 전부** 채택
  - 예: `isQuiet` — RAC 지원 가능 → 채택
  - 예: `contextualHelp` — RAC에 직접 없으나 custom 구현 가능 → 채택
  - 기본 정책: **채택 방향**. 명시적 기각은 매우 드묾
- **금지 사항**:
  - RSP에 없는 커스텀 prop 임의 도입 (디자인 일관성 훼손)
  - RSP prop 중 RAC로 구현 불가능한 것을 억지 구현

### D3 (시각 스타일)

> **2026-07-08 갱신**: 아래는 ADR-142 이전(spec 파일 기반) 메커니즘의 기록이다. 현재 SSOT는 catalog(`COMPONENT_RULES_TABLE`, `packages/shared/src/catalog/`) + theme/tokens root collection(ADR-110)이다. 잔존 spec 3개(Frame/Group/Slot)에 한해 아래 규칙이 여전히 유효.

- **SSOT (일반 컴포넌트)**: catalog `COMPONENT_RULES_TABLE` (`packages/shared/src/catalog/generated/componentRulesTable.ts`) + theme/tokens root collection. `PrimitiveBinding`(leaf RAC primitive ~35개)이 코드 정의를 담당
- **SSOT (잔존 spec 3개 한정)**: `packages/specs/src/components/{Frame,Group,Slot}.spec.ts` + `packages/specs/src/primitives/*`
- **목적**: **Builder(Skia)와 Preview/Publish(DOM/CSS)의 시각 정합성 유지**
- **consumer (대등, symmetric)**:
  - **Builder** = Skia 렌더 (`apps/builder/src/builder/workspace/canvas/skia/*`)
  - **Preview/Publish** = DOM + CSS 렌더 (일반 컴포넌트는 catalog binding 경유, 잔존 spec 3개는 `packages/specs/src/renderers/CSSGenerator.ts`가 Spec → CSS 변환)
- **대칭 원칙**: "CSS가 기준, Skia가 따라간다"가 아니며, 역도 아님. **두 경로가 동일 SSOT(catalog 또는 잔존 spec)로부터 동일 시각 결과를 산출**하는지 검증
- **대칭 정의 재확인**: 대칭은 "구현 방법"이 아니라 **"시각 결과"의 동일성**. Skia가 arc 그리든 DOM이 border-radius 쓰든 **보여지는 결과가 같으면 통과**
- **금지 사항**:
  - 수동 CSS가 SSOT(catalog 또는 잔존 spec)에서 파생이 아니라 독립 정의
  - `@sync` 주석으로 CSS 파일 간 참조 (SSOT 거치지 않은 consumer-to-consumer)
  - Skia 전용 시각 표현 (DOM/CSS로 재현 불가능한 효과를 도입)
  - (잔존 spec 3개 한정) VariantSpec 또는 IndicatorModeSpec 에 `background` / `backgroundHover` / `backgroundPressed` / `selectedBackground*` / `outlineBackground` / `subtleBackground` / `backgroundAlpha` 등 **legacy 개별 background 필드 신규 도입** (ADR-908 Phase 4 로 fill preset SSOT 통합, `FillTokenSpec` / `FillStateTokens` 단일 소스)

**D3 Fill 계열 SSOT (ADR-908 Implemented 2026-04-24)**:

- VariantSpec 의 배경 계열 10+ 필드 + IndicatorModeSpec 의 background\* 는 모두 `FillTokenSpec` (fillStyle × state 2축) + `FillStateTokens` 로 통합됨.
- 신규 spec 작성 시 `variants[name].fill = { default: { base, hover?, pressed?, selected?, ... }, outline?, subtle?, alpha? }` 구조 사용.
- consumer 는 항상 `resolveFillTokens(variant)` / `resolveIndicatorFill(im)` 경유로 fill 접근 (direct property access 금지).
- 비-background 색상 (`text / border / textHover / borderHover / selectedText / outlineText / subtleText / selectedBorder / emphasizedSelectedText / emphasizedSelectedBorder`) 는 VariantSpec 직접 필드로 유지 — fill preset 언어로의 확장은 후속 ADR 판정.

**D3 read-only sub-part — field 5 가족의 FieldError 자식 (ADR-923 Phase 5 후속 잔여 1, 2026-09-03 사용자 판정 A)**:

- Preview/publish 는 TextField·TextArea·NumberField·DateField·TimeField 를 parent props 만으로 self-compose 하고 canonical 자식 Label/Input/FieldError 를 읽지 않는다. 그중 FieldError 는 parent rule 의 `.react-aria-FieldError` delegation 이 시각 정본 — 자식은 canonical 에 남되 (Canvas 구조 정본) **편집 surface 는 parent 로 귀속**한다.
- 술어 `hasDelegatedChild(parentType, childSelector)` (`@composition/shared`) 하나를 Canvas read 경로 (layout·Skia — 자식 인라인 style 통째 무시, 투영 display + delegation fontSize 만) 와 Properties·Styles 패널 (`panels/delegatedSubpart.ts` — 안내만) 이 같이 읽는다.
- 금지: 자식 style 을 RAC 내부 sub-part 로 운반하는 custom prop 신설 (RSP 미규정 — D2 위반). Label/Input 은 factory 인라인이 Canvas layout 입력이라 별도 판정.

**D1 ↔ D3 분리 사례 — RAC `Group` ↔ canonical `frame` (ADR-130 Implemented 2026-05-13)**:

- RAC `Group` = D1 ARIA semantic (`role: "group"`, `aria-label`) — `Group.spec.ts` 보존 (변경 0)
- canonical `frame` = D3 layout container — `Frame.spec.ts` 신규 (skipCSSGeneration:true, ARIA role 없음)
- 진입점 단일화: builder palette / multi-select grouping / pencil import 모두 `type: "frame"`. RAC ARIA Group 으로 layout 의도 흡수 금지 (D1 침범)
- canonical schema `FrameNode` (`clip`/`placeholder` 1차 필드) 와 Frame.spec 1:1 정합. alias (`BASE_TAG_SPEC_MAP["frame"] = GroupSpec`) 패턴 금지 — ARIA role emit 으로 D1 침범
- legacy `type: "Group" + customId="group_N"` 은 `isLegacyGroupForFrameMigration()` 으로 1회 hydration migration 대상. ARIA Group (customId 없음 또는 다른 prefix) 보존

## 3. 경계 판정 기준

D3 SSOT(catalog, 잔존 spec 3개는 예외)가 어디까지 관여하는지의 판정:

| 요소                                           | 어느 domain? | SSOT 관여                        |
| ---------------------------------------------- | ------------ | -------------------------------- |
| `<div role="...">` 같은 DOM 태그/속성          | D1           | ❌                               |
| `aria-invalid`, `aria-label` 등 ARIA           | D1           | ❌                               |
| 키보드 네비게이션 동작                         | D1           | ❌                               |
| `isQuiet: boolean` props 선언                  | D2           | ✅ (타입만)                      |
| `variant: string` props 선언 (RSP에 없는 경우) | D2 위반      | ❌ (ADR-062로 제거)              |
| 색상 (background/border/text)                  | D3           | ✅ (catalog SSOT)                |
| 크기 (height/padding/gap)                      | D3           | ✅ (catalog SSOT)                |
| 폰트 (size/weight/family)                      | D3           | ✅ (catalog SSOT + theme/tokens) |
| 형태 (border-radius/shadow)                    | D3           | ✅ (catalog SSOT)                |
| 애니메이션/transition                          | D3           | ✅ (catalog SSOT)                |
| layout flow (flex-direction 등)                | D3           | ✅ (catalog SSOT)                |

**회색지대 판정 원칙**: 의심스러우면 **"Builder와 Preview가 시각적으로 달라질 수 있는 요소인가?"** 질문. 그렇다면 D3 → catalog SSOT (잔존 spec 3개는 spec SSOT).

## 4. 집행 메커니즘

### 4-1. 대칭 검증 수단

- **runtime**: `/cross-check` skill (단일 컴포넌트), `parallel-verify` skill (패밀리 일괄)
- **검증 대상**: 시각 결과 일치 — Builder Skia 렌더와 Preview DOM/CSS 렌더의 스크린샷 or 구조적 비교
- **build-time 자동화**: 미완성. 향후 과제

### 4-2. 위반 감지 및 대응

| 위반 유형                       | 감지                                      | 대응                                    |
| ------------------------------- | ----------------------------------------- | --------------------------------------- |
| 수동 CSS가 SSOT에서 파생 아님   | `skipCSSGeneration: true` + 수동 CSS 존재 | ADR 작성 → 해체 계획                    |
| consumer-to-consumer 참조       | `@sync` 주석                              | catalog(또는 잔존 spec) 경유로 재작성   |
| catalog/잔존 spec 이 D1/D2 침범 | 코드 리뷰                                 | 위반 코드 즉시 거부                     |
| 시각 비대칭 (CSS≠Skia)          | `/cross-check` 실패                       | 어느 쪽이 SSOT 맞는지 조사 후 양쪽 정렬 |
| RSP 미규정 prop 임의 도입       | 코드 리뷰                                 | 거부, RSP 참조 요구                     |

### 4-3. 문서 교차 참조 의무

새 ADR 작성 시 Context 섹션에서 **3개 domain 중 어느 것에 해당하는지 명시** 필수. 경계 교차 시 정당화 필요.

## 6. 금지 패턴 요약

- ❌ catalog 또는 잔존 spec이 DOM 구조 지정 (D1 침범)
- ❌ catalog 또는 잔존 spec에 RSP 미규정 prop 도입 (D2 위반) — ADR-062
- ❌ 수동 CSS가 SSOT(catalog 또는 잔존 spec)에서 파생 아님 (D3 위반) — ADR-059
- ❌ `@sync` 주석으로 CSS↔CSS 참조 (D3 symmetric 위반)
- ❌ "CSS가 기준, Skia 따라가" 언어 사용 (대칭 위반)
- ❌ Skia 전용 시각 효과를 도입 (대칭 결과 불가능)
- ❌ 일반 컴포넌트에 컴포넌트당 spec 파일 신규 생성 (ADR-142로 폐기된 메커니즘 부활 — 잔존 3개 예외만 허용)
- ❌ RAC 컴포넌트 DOM 재작성 또는 ARIA 수동 작성 (D1 침범)

## 7. 허용 패턴

- ✅ catalog(`COMPONENT_RULES_TABLE`) + theme/tokens가 색상 토큰/사이즈/레이아웃 정의 (일반 컴포넌트)
- ✅ 잔존 spec 3개(Frame/Group/Slot)가 색상 토큰/사이즈/레이아웃 정의 (예외)
- ✅ catalog binding 또는 CSS Generator(잔존 spec 한정)가 SSOT를 CSS로 자동 변환
- ✅ Skia 렌더가 catalog(또는 잔존 spec)를 shape로 변환
- ✅ RAC 컴포넌트를 그대로 사용 + CSS로 스타일 적용
- ✅ RSP props를 custom 구현으로 catalog binding에 추가
- ✅ `parallel-verify` / `/cross-check`로 시각 대칭 확인
- ✅ 의심스러운 회색지대는 "시각적으로 달라질 수 있나" 기준으로 판정

## 8. 참조

- 역사적 맥락 확장: [auto-memory: ssot-chain-definition.md]
- ADR 현황: [docs/adr/README.md]
- composition 패턴: [.claude/skills/composition-patterns/SKILL.md]
- 대칭 검증 skill: [.claude/skills/cross-check/SKILL.md], [.claude/skills/parallel-verify/SKILL.md]
