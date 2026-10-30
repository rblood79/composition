# SSOT 체인 정본 — 3-Domain 분할

> **정본**: composition 프로젝트 전체의 Spec/SSOT/권위 관계를 규정하는 최상위 규칙. 모든 ADR, skill, agent, 규칙 파일은 본 문서를 참조한다. 본 문서가 ADR-063(charter)의 명시적 부연이며, D3 SSOT 메커니즘은 ADR-142(2026-06-02 Implemented)로 재정의됐다. 다른 문서와 충돌 시 본 문서 우선.

> §0 역사적 맥락 · §2 용어 사전 · §5 주요 ADR 관계는 [ssot-hierarchy-context.md](ssot-hierarchy-context.md) 로 분리 (2026-08-31 — `docs/adr/**` · `packages/shared/src/catalog/**` 작업 시 자동 로드). 절 번호는 인용 안정성을 위해 그대로 둔다.

## 1. 3-Domain 분할 (핵심)

composition 아키텍처는 **3개의 독립 domain**으로 구성된다. 각 domain은 고유 권위를 가지며 경계 교차 금지.

> **2026-07-08 갱신 (ADR-142 Implemented)**: D3 SSOT는 컴포넌트당 spec 파일에서 **catalog(`COMPONENT_RULES_TABLE`) + theme/tokens root collection**으로 전환됐다. 아래 표와 "D3 (시각 스타일)" 절은 이 전환을 반영한다. 2026-10-04 ADR-248 Publish 후속으로 Frame/Group/Slot도 catalog 입력으로 통합하고 specs 패키지를 제거했다. 상세: [ADR-142](../../docs/adr/completed/142-starter-spec-component-system-cutover.md), [ADR-036 Superseded 안내](../../docs/adr/completed/036-spec-first-single-source.md).

| Domain              | 권위                                                                      | 내용                                                      | Spec 개입                         |
| ------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------- |
| **D1. DOM/접근성**  | **설치된 `react-aria-components` (절대)**                                 | HTML 구조, ARIA 속성, 키보드 동작, 포커스 관리, 접근성    | **금지 — 관찰·소비만**            |
| **D2. Props/API**   | **S2 `@react-spectrum/s2` 1.8.1 (고정) → design-data → v3 → custom 확장** | prop 이름 · 값 (isEmphasized, variant, staticColor 등)    | 타입 선언만, 구현은 RAC + custom  |
| **D3. 시각 스타일** | **catalog(`COMPONENT_RULES_TABLE`) + theme/tokens (SSOT)**                | 화면에 보여지는 style 전부 — 색상/크기/폰트/레이아웃/형태 | **Frame/Group/Slot 포함 catalog** |

### D1 (DOM/접근성)

- **소유자**: 설치된 `react-aria-components` 패키지 — unstyled primitive 라이브러리. 버전은 `pnpm-workspace.yaml` `catalogs.default` 가 고정하고 `apps/builder` · `packages/shared` 가 소비한다
- **정본 판정**: DOM·ARIA·동작 질문은 설치된 패키지 소스 (`node_modules/react-aria-components`) 로 답한다. 읽기용 문서는 `react-aria` skill (`.claude/skills/react-aria/references/` — 공식 Agent Skill 스냅샷, 설치본과 다르면 설치본). 예제 코드 (RAC starter 등, 2026-09-29 저장소에서 제거) 는 권위가 없다
- **composition 역할**: RAC가 출력하는 DOM 구조를 **그대로 사용**. 수정/확장 금지
- **선택 이유**: RAC가 unstyled이므로 스타일 자유도 확보 가능 (← 이것이 RAC 선택의 본질적 이유)
- **금지 사항**:
  - RAC 컴포넌트의 DOM 구조 재작성
  - aria 속성 수동 작성 (RAC가 제공하는 것 사용)
  - 접근성 동작 변경

### D2 (Props/API)

- **정본 순서 (2026-10-09 사용자 결정 — 「S2 1.8.0 고정 우선」)**: prop 이름 · 값은 위에서부터 처음 답하는 곳을 따른다.
  1. **S2 `@react-spectrum/s2` 1.8.1** (버전 고정 = `apps/builder/package.json` 의 설치 버전 — 올릴 때는 이 줄을 같이 고친다. 2026-10-14 전까지 1.8.0 으로 적혀 있었으나 설치본은 1.8.1 이었다). S2 는 RAC 위에 Spectrum 2 를 얹은 구현이라, 동작 · 상태 · 데이터 prop 은 RAC 이름 그대로이고 (`isSelected` · `selectedKeys` · `orientation` …) 시각 prop 은 Spectrum 축이다 (`variant` · `size` · `isEmphasized` · `fillStyle` · `staticColor` · `isQuiet` · `density`). 이 표면을 그대로 가져오면 D1 과 이름이 충돌하지 않는다. 읽기용 문서는 `react-spectrum` skill (`.claude/skills/react-spectrum/references/components/` — 공식 Agent Skill 스냅샷, 타입과 다르면 설치본).
  2. S2 에 없는 컴포넌트 · 축: **spectrum-design-data** (Spectrum 디자인 정본의 컴포넌트 스키마 — design-data MCP).
  3. 거기에도 없으면 **v3 `@adobe/react-spectrum`** (Spectrum 1 구현 — RAC 가 아니라 react-aria hooks 기반이라 동작 이름이 RAC 와 다를 수 있다: v3 `selectionStyle` ↔ RAC `selectionBehavior`).
  4. 어디에도 없으면 **composition 확장** — `packages/shared/src/catalog/document/d2Provenance.ts` 에 type · key 와 출처 (`v3` · `rac` · `composition`) 를 적는다 (2026-10-14 전까지는 binding 머리말).
- **게이트 (2026-10-14)**: `apps/builder/src/builder/catalogRuntime/__tests__/d2S2Alignment.static.test.ts` 가 설치된 S2 의 TypeScript 타입 (상속한 RAC prop 포함) 과 모든 binding 의 보이는 `accepts` 키 · `options` 값을 대조한다 — S2 에 없는 키는 `d2Provenance.ts` 에 있어야 하고, S2 가 선언하는 키가 거기 있으면 낡은 것으로 막는다. **Why**: 「S2 1.8.0 정본」 결정 뒤 전수 대조가 없어 Tooltip 의 배치 prop 5 (S2 는 TooltipTrigger 소유) · TooltipTrigger `closeDelay` (S2 가 뺌) · TableView `allowsSorting` (S2 는 Column 단위 — DOM 이 버리던 죽은 칸) · field 12종 `labelAlign: center` (S2 `start · end`) 가 남아 있었다. S2 의 상위집합인 RAC prop (Calendar `visibleDuration` ⊃ S2 `visibleMonths`) 은 `rac` 출처로 둔다.
- **Why**: RAC 는 headless 라 테마를 바꿀 수 있어 채택했고 (D1), prop 개념은 Spectrum 이 앞서 따랐다. 기준이 "RSP" 로만 적혀 v3 · S2 이름이 섞였다 (Meter `warning` · `critical` = v3, Checkbox `variant` ≠ S2 · v3 `isEmphasized` — 2026-10-09 전수 조사). S2 의 스타일은 쓰지 않는다 — 시각 값은 D3 (catalog) 가 정본이다.
- **마이그레이션 기준**: **RAC + custom 구현으로 달성 가능한 범위 전부** 채택
  - 예: `isQuiet` — RAC 지원 가능 → 채택
  - 예: `contextualHelp` — RAC에 직접 없으나 custom 구현 가능 → 채택
  - 기본 정책: **채택 방향**. 명시적 기각은 매우 드묾
- **금지 사항**:
  - 위 정본 순서에 없는 커스텀 prop 임의 도입 (디자인 일관성 훼손) — 확장은 4번으로 명시한다
  - RSP prop 중 RAC로 구현 불가능한 것을 억지 구현

### D3 (시각 스타일)

> 일반 컴포넌트의 SSOT 는 catalog(`COMPONENT_RULES_TABLE`, `packages/shared/src/catalog/`) + theme/tokens root collection(ADR-110)이다. Frame/Group/Slot에도 같은 원칙을 적용한다.

- **SSOT (일반 컴포넌트)**: catalog `COMPONENT_RULES_TABLE` (`packages/shared/src/catalog/generated/componentRulesTable.ts`) + theme/tokens root collection. `PrimitiveBinding`(leaf RAC primitive ~35개)이 코드 정의를 담당
- **CSS 생성**: `packages/rendering/scripts/generate-css.ts`가 catalog의 structure·size·variant를 읽는다. 별도 native spec 입력은 없다.
- **값 정본 = S2 설치본, 이름 = 저장소 (ADR-295, 2026-10-31)**: 사용자 컴포넌트의 치수 값 (radius · 글자 단계 · 행간 식 · control 높이 · 아이콘 단 · 여백 · 간격 · 막대 두께) 은 설치된 `@react-spectrum/s2` 의 style macro · 표가 정본이고, TokenRef 이름 (`{radius.md}` · `{size.height.M}`) · 패널 라벨 (XS ~ XL) 은 저장소 것을 그대로 쓴다. 값의 형 (고정 · `scale` 배율 · 글자 상대 · 높이 상대) 도 S2 를 따르며 터치 기기 값 (`scale` 1.25 · 글자 기준 17) 은 resolver 가 두 벌로 낸다. rule 값과 설치본의 대조는 `d3S2Alignment.static.test.ts`, S2 와 다르게 둔 리터럴은 `componentRulesTable.static.test.ts` 의 분류 목록 (의도적 · 대기 0) 이 막는다. 빌더 chrome 은 대상이 아니다 — [css-tokens.md](css-tokens.md) §컨트롤 크기.
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

children·RAC slot·필수 부품·상태 주체·값 바인딩의 구현·검증은
[RAC 조립 계약](../skills/composition-patterns/rules/domain-rac-composition.md)을 따른다.

**컴포넌트별 부품 노드 · 소유 축 (ADR-251 ~ 259)**: field 가족의 부품 (Label · Input · Button …) 은 부품 원본의 instance 이고 모양은 부품 자신의 rule, 부모 rule 은 배치만 — 글자 축 · style 축의 소유자, picker 의 ListBox · Popover, quiet, 라벨 행 · 도움말, 바탕의 제목 · 설명, 그룹 묶음 노드, toggle indicator, Color 조작기, Table 열 트랙의 구현 사실은 [catalog-subparts.md](catalog-subparts.md) (catalog · catalogRuntime · Canvas catalog 작업 시 자동 로드). 금지: 자식 style 을 RAC 내부 sub-part 로 운반하는 custom prop 신설 (RSP 미규정 — D2 위반).

**D1 ↔ D3 분리 사례 — RAC `Group` ↔ canonical `frame` (ADR-130 Implemented 2026-05-13)**:

- RAC `Group` = D1 ARIA semantic (`role: "group"`, `aria-label`) — catalog Group definition/primitive binding
- canonical `frame` = D3 layout container — catalog frame definition (skipCSSGeneration:true, ARIA role 없음)
- 진입점 단일화: builder palette / multi-select grouping / pencil import 모두 `type: "frame"`. RAC ARIA Group 으로 layout 의도 흡수 금지 (D1 침범)
- canonical schema `FrameNode` (`clip`/`placeholder` 1차 필드) 와 catalog `frame` entry 1:1 정합. `frame` 을 Group 의 alias 로 두는 패턴 금지 — ARIA role emit 으로 D1 침범 (옛 `BASE_TAG_SPEC_MAP` 은 ADR-248 에서 삭제)
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

| 위반 유형                     | 감지                                    | 대응                                    |
| ----------------------------- | --------------------------------------- | --------------------------------------- |
| 수동 CSS가 SSOT에서 파생 아님 | catalog rule 에 없는 값을 가진 수동 CSS | ADR 작성 → 해체 계획                    |
| consumer-to-consumer 참조     | `@sync` 주석                            | catalog 경유로 재작성                   |
| catalog 가 D1/D2 침범         | 코드 리뷰                               | 위반 코드 즉시 거부                     |
| 시각 비대칭 (CSS≠Skia)        | `/cross-check` 실패                     | 어느 쪽이 SSOT 맞는지 조사 후 양쪽 정렬 |
| RSP 미규정 prop 임의 도입     | 코드 리뷰                               | 거부, RSP 참조 요구                     |

### 4-3. 문서 교차 참조 의무

새 ADR 작성 시 Context 섹션에서 **3개 domain 중 어느 것에 해당하는지 명시** 필수. 경계 교차 시 정당화 필요.

## 6. 금지 패턴 요약

- ❌ catalog이 DOM 구조 지정 (D1 침범)
- ❌ catalog에 RSP 미규정 prop 도입 (D2 위반) — ADR-062
- ❌ 수동 CSS가 SSOT(catalog)에서 파생 아님 (D3 위반) — ADR-059
- ❌ `@sync` 주석으로 CSS↔CSS 참조 (D3 symmetric 위반)
- ❌ "CSS가 기준, Skia 따라가" 언어 사용 (대칭 위반)
- ❌ Skia 전용 시각 효과를 도입 (대칭 결과 불가능)
- ❌ 컴포넌트당 spec 파일 신규 생성 — 어떤 컴포넌트에도 (ADR-142 로 폐기, 마지막 3개와 `packages/specs` 는 ADR-248 에서 삭제. 예외 없음)
- ❌ RAC 컴포넌트 DOM 재작성 또는 ARIA 수동 작성 (D1 침범)

## 7. 허용 패턴

- ✅ catalog(`COMPONENT_RULES_TABLE`) + theme/tokens가 색상 토큰/사이즈/레이아웃 정의 (일반 컴포넌트)
- ✅ Frame/Group/Slot도 catalog가 색상 토큰/사이즈/레이아웃을 정의
- ✅ `generate-css.ts` 가 catalog SSOT 를 CSS 로 자동 변환
- ✅ Skia 렌더가 catalog 를 shape 로 변환
- ✅ RAC 컴포넌트를 그대로 사용 + CSS로 스타일 적용
- ✅ RSP props를 custom 구현으로 catalog binding에 추가
- ✅ `/cross-check`로 시각 대칭 확인
- ✅ 의심스러운 회색지대는 "시각적으로 달라질 수 있나" 기준으로 판정

## 8. 참조

- 역사적 맥락 확장: [auto-memory: ssot-chain-definition.md]
- ADR 현황: [docs/adr/README.md]
- composition 패턴: [.claude/skills/composition-patterns/SKILL.md]
- 대칭 검증 skill: [.claude/skills/cross-check/SKILL.md]
