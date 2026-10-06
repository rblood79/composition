# SSOT 체인 정본 — 3-Domain 분할

> **정본**: composition 프로젝트 전체의 Spec/SSOT/권위 관계를 규정하는 최상위 규칙. 모든 ADR, skill, agent, 규칙 파일은 본 문서를 참조한다. 본 문서가 ADR-063(charter)의 명시적 부연이며, D3 SSOT 메커니즘은 ADR-142(2026-06-02 Implemented)로 재정의됐다. 다른 문서와 충돌 시 본 문서 우선.

> §0 역사적 맥락 · §2 용어 사전 · §5 주요 ADR 관계는 [ssot-hierarchy-context.md](ssot-hierarchy-context.md) 로 분리 (2026-08-31 — `docs/adr/**` · `packages/specs/**` · `packages/shared/src/catalog/**` 작업 시 자동 로드). 절 번호는 인용 안정성을 위해 그대로 둔다.

## 1. 3-Domain 분할 (핵심)

composition 아키텍처는 **3개의 독립 domain**으로 구성된다. 각 domain은 고유 권위를 가지며 경계 교차 금지.

> **2026-07-08 갱신 (ADR-142 Implemented)**: D3 SSOT는 컴포넌트당 spec 파일에서 **catalog(`COMPONENT_RULES_TABLE`) + theme/tokens root collection**으로 전환됐다. 아래 표와 "D3 (시각 스타일)" 절은 이 전환을 반영한다. 2026-10-04 ADR-248 Publish 후속으로 Frame/Group/Slot도 catalog 입력으로 통합하고 specs 패키지를 제거했다. 상세: [ADR-142](../../docs/adr/completed/142-starter-spec-component-system-cutover.md), [ADR-036 Superseded 안내](../../docs/adr/completed/036-spec-first-single-source.md).

| Domain              | 권위                                                       | 내용                                                      | Spec 개입                         |
| ------------------- | ---------------------------------------------------------- | --------------------------------------------------------- | --------------------------------- |
| **D1. DOM/접근성**  | **설치된 `react-aria-components` (절대)**                  | HTML 구조, ARIA 속성, 키보드 동작, 포커스 관리, 접근성    | **금지 — 관찰·소비만**            |
| **D2. Props/API**   | **RSP 참조 + custom 확장**                                 | 사용자 편의 props (isQuiet, contextualHelp 등)            | 타입 선언만, 구현은 RAC + custom  |
| **D3. 시각 스타일** | **catalog(`COMPONENT_RULES_TABLE`) + theme/tokens (SSOT)** | 화면에 보여지는 style 전부 — 색상/크기/폰트/레이아웃/형태 | **Frame/Group/Slot 포함 catalog** |

### D1 (DOM/접근성)

- **소유자**: 설치된 `react-aria-components` 패키지 — unstyled primitive 라이브러리. 버전은 `pnpm-workspace.yaml` `catalogs.default` 가 고정하고 `apps/builder` · `packages/shared` 가 소비한다
- **정본 판정**: DOM·ARIA·동작 질문은 설치된 패키지 소스 (`node_modules/react-aria-components`) 로 답한다. 예제 코드 (RAC starter 등, 2026-09-29 저장소에서 제거) 는 권위가 없다
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

> 일반 컴포넌트의 SSOT 는 catalog(`COMPONENT_RULES_TABLE`, `packages/shared/src/catalog/`) + theme/tokens root collection(ADR-110)이다. Frame/Group/Slot에도 같은 원칙을 적용한다.

- **SSOT (일반 컴포넌트)**: catalog `COMPONENT_RULES_TABLE` (`packages/shared/src/catalog/generated/componentRulesTable.ts`) + theme/tokens root collection. `PrimitiveBinding`(leaf RAC primitive ~35개)이 코드 정의를 담당
- **CSS 생성**: `packages/rendering/scripts/generate-css.ts`가 catalog의 structure·size·variant를 읽는다. 별도 native spec 입력은 없다.
- **목적**: **Builder(Skia)와 Preview/Publish(DOM/CSS)의 시각 정합성 유지**
- **consumer (대등, symmetric)**:
  - **Builder** = Skia 렌더 (`apps/builder/src/builder/workspace/canvas/skia/*`)
  - **Preview/Publish** = DOM + CSS 렌더 (shared catalog runtime + catalog에서 생성한 CSS)
- **대칭 원칙**: "CSS가 기준, Skia가 따라간다"가 아니며, 역도 아님. **두 경로가 동일 SSOT(catalog)로부터 동일 시각 결과를 산출**하는지 검증
- **대칭 정의 재확인**: 대칭은 "구현 방법"이 아니라 **"시각 결과"의 동일성**. Skia가 arc 그리든 DOM이 border-radius 쓰든 **보여지는 결과가 같으면 통과**
- **금지 사항**:
  - 수동 CSS가 SSOT(catalog)에서 파생이 아니라 독립 정의
  - `@sync` 주석으로 CSS 파일 간 참조 (SSOT 거치지 않은 consumer-to-consumer)
  - Skia 전용 시각 표현 (DOM/CSS로 재현 불가능한 효과를 도입)

**D3 sub-part — field 가족의 부품 노드 (ADR-253 Phase 3, 2026-10-07 — ADR-923 Phase 5 후속의 2026-09-03 · 09-04 판정을 대체)**:

- field · 그룹의 Label · Description · FieldError · Input · DateInput · Button (NumberField 증감 · FieldButton · Select 의 trigger) 은 **부품 원본의 instance** 다. Preview/publish DOM 은 그 노드를 RAC 컴포넌트로 부모의 RAC context 안에서 직접 그리고 (`catalog/runtime/domBinding.tsx` · `delegatedDom.tsx`), 모양은 **부품 자신의 rule** 이 정본이다. 부모 rule 의 delegation 은 배치 (폭 · flex · margin · 버튼 자리) 만 선언한다 — 정적 게이트 `adr253PartShapeOwner.static.test.ts`.
- **편집 축**: style 은 부품 노드 자신이 정본이다 (Styles 패널이 그대로 편집, Canvas 와 DOM 이 같은 record). **글자 축만** 부모 소유인 부품은 `TEXT_ONLY_SUBPART_PARENTS` (Label · Description · FieldError · Input · Select 의 SelectValue — 글자는 부모의 `label` · `description` · `errorMessage` · `placeholder` prop 이 정본). 술어는 `resolveDelegatedSubpartOwnerType` (글자 축 · 전체 — Properties 패널) 와 `resolveSubpartStyleOwnerType` (style 축 — Styles 패널 · AI style 편집) 이고, catalog record 로는 `catalogSubpartOwnerType` (`catalogRuntime/subpart.ts`) 이 읽는다.
- **두 축 모두 부모 소유로 남은 것**: control wrapper `SelectTrigger` (NumberField · ComboBox · SearchField · DatePicker · DateRangePicker — DOM 은 shared 컴포넌트가 Group · container 를 직접 만들고 wrapper 노드의 style 을 읽지 않는다, `DELEGATED_SUBPART_CHILD_TOKENS`) 와 owner 가 그리는 part (`OWNER_DRAWN_PART_OWNERS` — 아래 toggle indicator). style 축만 부모 소유인 부품은 없다 (`STYLE_ONLY_SUBPART_PARENTS` 비어 있음).
- **picker 의 선택 목록 (ADR-253 Phase 4, 2026-10-07)**: Select · ComboBox 의 항목은 그 안의 ListBox — ListBox 원본의 instance — 의 slot 채움이다 (library `slotFills`). DOM 은 ListBox 노드의 요소를 RAC Popover 안에 그리고 (RAC `ListBox` 그대로 — 이름 · 선택 · focus 는 RAC 의 Select · ComboBox context 소유, D1), Canvas 는 닫힌 목록을 그리지 않는다 (`presence.ts` `TRIGGER_OVERLAY_CHILDREN`). 항목을 picker 루트의 직계 자식으로 두지 않는다 (DOM 이 그리지 않는다 — `SELF_COMPOSED_CONTAINER_CHILD_TYPES`).
- **quiet (`isQuiet`)**: field 의 상자 부품 (Input · DateInput) 이 자기 상태로 그린다 — 부품 rule 의 `&[data-quiet]` 한 정의, 요소의 `data-quiet` 는 quiet field 의 부품에 파생 값 (`presence.ts` `derivedProps.isQuiet`) 으로 실린다. Select 의 trigger 와 DateRangePicker 의 Group 은 그 field rule 의 quiet 블록이 그린다. **Canvas 는 field 의 quiet 모양을 그리지 않는다** (ADR-253 이전부터의 비대칭 — 미해결).
- 금지: 자식 style 을 RAC 내부 sub-part 로 운반하는 custom prop 신설 (RSP 미규정 — D2 위반).

**그룹 항목 묶음 노드 — RadioItems · CheckboxItems (ADR-251, 2026-10-03)**: RAC `RadioGroup` · `CheckboxGroup` 의 children 안에 composition 이 두는 항목 상자 (`div.radio-items`, RAC 구조 밖 · role 없음 — D1 무변경) 를 문서 노드로 둔다. 값 (방향 · gap) 은 그룹 rule `orientation` 블록이 정본 (D3), 묶음 노드는 사용자 prop 이 없고 `size` 만 내부 운반 값 (D2 신규 prop 0). DOM 은 그룹이 묶음을 흡수하고 shared 컴포넌트의 상자 하나가 그린다 — 묶음에 작성한 style 은 DOM 에 닿지 않는다 (TagList 와 같은 편집 범위).

**toggle indicator 노드 — CheckboxIndicator · RadioIndicator · SwitchIndicator (2026-10-04 사용자 지시 「1안」)**: Checkbox · Radio · Switch 의 indicator 상자 (RAC toggle 이 직접 그리는 `div.checkbox` · `.react-aria-Radio::before` · `div.indicator`) 를 template 첫 자식 노드로 둔다. 크기는 toggle rule `size.indicator` 가 partRule 로, 칠은 toggle rule primitive 를 노드 상자에서 실행한다 (D3 정본 = toggle rule). 노드는 사용자 prop 0 (D2 신규 prop 0) · DOM 출력 0 (D1 무변경 — 부모가 흡수) · 편집 surface 는 toggle 로 귀속 (`OWNER_DRAWN_PART_OWNERS` — sub-part owner 판정). **TreeItem 의 chevron (`TreeItemChevron`, 같은 날 「1안」)** 도 같은 방식이다 — DOM `Button[slot="chevron"]` (shared Tree 의 `TreeItemContent`), 상자는 `Tree.css` 버튼 (`catalogTreeChevronLayout`), 아이콘은 TreeItem rule `leadingIcon` 을 노드 상자에서 실행.

**D1 ↔ D3 분리 사례 — RAC `Group` ↔ canonical `frame` (ADR-130 Implemented 2026-05-13)**:

- RAC `Group` = D1 ARIA semantic (`role: "group"`, `aria-label`) — catalog Group definition/primitive binding
- canonical `frame` = D3 layout container — catalog frame definition (skipCSSGeneration:true, ARIA role 없음)
- 진입점 단일화: builder palette / multi-select grouping / pencil import 모두 `type: "frame"`. RAC ARIA Group 으로 layout 의도 흡수 금지 (D1 침범)
- canonical schema `FrameNode` (`clip`/`placeholder` 1차 필드) 와 Frame.spec 1:1 정합. alias (`BASE_TAG_SPEC_MAP["frame"] = GroupSpec`) 패턴 금지 — ARIA role emit 으로 D1 침범
- legacy `type: "Group" + customId="group_N"` 은 `isLegacyGroupForFrameMigration()` 으로 1회 hydration migration 대상. ARIA Group (customId 없음 또는 다른 prefix) 보존

## 3. 경계 판정 기준

D3 SSOT(catalog)가 어디까지 관여하는지의 판정:

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

**회색지대 판정 원칙**: 의심스러우면 **"Builder와 Preview가 시각적으로 달라질 수 있는 요소인가?"** 질문. 그렇다면 D3 → catalog SSOT.

**생성 CSS archetype 미지정 = 중립 상자 (ADR-223 Implemented 2026-09-18)**: catalog `structure.archetype: "default"` (와 잔존 spec 의 archetype 미선언) 의 생성 CSS base 는 `container` 와 같은 block · box-sizing · font-family 뿐이다 — Skia 가 읽지 않는 버튼 어법 (inline-flex · align/justify center · cursor · user-select · transition) 을 기본값으로 싣지 않는다. 정렬·크기 (geometry) 는 `structure.containerStyles` 로 두 consumer 가 같이 읽고, Canvas 저작 surface 에 대응이 없는 DOM interaction (cursor · user-select · transition) 은 `composition.rootSelectors["&"]` 가 catalog 정본이되 Canvas 는 소비하지 않는다 (Card · Tab). 신규 entry 는 archetype 또는 `composition.layout` 을 명시한다 (`archetypeDefaultCohort.static.test.ts` ratchet).

## 4. 집행 메커니즘

### 4-1. 대칭 검증 수단

- **runtime**: `/cross-check` skill (단일 컴포넌트 · 패밀리는 영향 컴포넌트마다 반복)
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

- ❌ catalog이 DOM 구조 지정 (D1 침범)
- ❌ catalog에 RSP 미규정 prop 도입 (D2 위반) — ADR-062
- ❌ 수동 CSS가 SSOT(catalog)에서 파생 아님 (D3 위반) — ADR-059
- ❌ `@sync` 주석으로 CSS↔CSS 참조 (D3 symmetric 위반)
- ❌ "CSS가 기준, Skia 따라가" 언어 사용 (대칭 위반)
- ❌ Skia 전용 시각 효과를 도입 (대칭 결과 불가능)
- ❌ 일반 컴포넌트에 컴포넌트당 spec 파일 신규 생성 (ADR-142로 폐기된 메커니즘 부활 — 잔존 3개 예외만 허용)
- ❌ RAC 컴포넌트 DOM 재작성 또는 ARIA 수동 작성 (D1 침범)

## 7. 허용 패턴

- ✅ catalog(`COMPONENT_RULES_TABLE`) + theme/tokens가 색상 토큰/사이즈/레이아웃 정의 (일반 컴포넌트)
- ✅ Frame/Group/Slot도 catalog가 색상 토큰/사이즈/레이아웃을 정의
- ✅ catalog binding 또는 CSS Generator(잔존 spec 한정)가 SSOT를 CSS로 자동 변환
- ✅ Skia 렌더가 catalog(또는 잔존 spec)를 shape로 변환
- ✅ RAC 컴포넌트를 그대로 사용 + CSS로 스타일 적용
- ✅ RSP props를 custom 구현으로 catalog binding에 추가
- ✅ `/cross-check`로 시각 대칭 확인
- ✅ 의심스러운 회색지대는 "시각적으로 달라질 수 있나" 기준으로 판정

## 8. 참조

- 역사적 맥락 확장: [auto-memory: ssot-chain-definition.md]
- ADR 현황: [docs/adr/README.md]
- composition 패턴: [.claude/skills/composition-patterns/SKILL.md]
- 대칭 검증 skill: [.claude/skills/cross-check/SKILL.md]
