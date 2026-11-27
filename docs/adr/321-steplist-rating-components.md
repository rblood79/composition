# ADR-321: StepList · Rating 컴포넌트 — Spectrum 정의의 단계 표시와 별점을 RAC 조립으로 (D1 예외 0)

## Status

Accepted — 2026-11-27 (Proposed 2026-11-26)

- 승격 근거: 사용자 착수 지시 2026-11-27 (「ADR-320, ADR-321 병렬 착수」) + [reviews/321.md](reviews/321.md) round 2 잔여 이슈 0 (HIGH 1 · MEDIUM 1 모두 `fixed`, `pending` 0).
  > **Phase 0 (G0 재료) — 2026-11-27**, HEAD `f4a9c4b51`: 코드 사실 F1 ~ F12 재대조 — 내용 차이는 F2 하나 (스키마의 `size` · `variant` · `anatomyReview` 와 토큰 binding 은 설치된 design-data 3.9.1 이 아니라 MCP dataset 4.7.0 의 것), F10 은 contract 80 (이 ADR 은 81 부터), F11 은 줄만 이동 (`catalogPreviewInteractions.ts:1212` · `:1616`). 토큰 표 고정 — 비어 있는 값은 step 폭 · 높이 · step 과 선의 간격 · 글자 맞춤 · Rating 높이, 저장소에 없는 TokenRef 는 색 alias 셋과 6 px 간격 · 1.3 행간 · radius 7. 시제품 **P1 go 초안** — `ol > li > RAC Link` 의 `role` · `aria-current` · `aria-disabled` · `tabindex` 가 fixture 넷에서 v3 hook 대조 목록 · 따로 적은 정답표와 같고, Chrome 내부 접근성 트리 (`ariaCurrentState=step` · `restriction=disabled`) 와 macOS 접근성 객체 (`AXARIACurrent='step'`) 에 실린다 · Tab 순서 · Enter 활성 일치. **P2 go 초안** — track 상자를 「폭 = (별 + 간격) × 5, 왼쪽으로 반 칸」 으로 두면 별 누르기 15 / 15 (M · S), track 상자 = 별 줄이면 8 / 15 · 화살표로 0 도달 · 값 2.5 · 6 · −1 의 range input = 3 · 5 · 0 · Meter 낭독 값 「50%」 대 「5점 만점에 2.5점」. 측정: headed Chrome 158 · visible · DPR 1 (headless 도 같은 결과). 사용자에게 물을 것 — StepList 목록의 이름 (v3 는 `ol` 에 `aria-label`, 조립은 예외 0 조건에서 이름 없음). 번들 기준선은 메인 세션. 상세 [breakdown §8](design/321-steplist-rating-components-breakdown.md).
  > **G0 닫힘 — 2026-11-27**: P1 · P2 go. 사용자 답 (같은 날): 결정 1 = v3 이름 · 결정 4 = 설명 한 줄만 · StepList 목록의 이름 = RAC `Group` 으로 감싸기 (Phase 0 발견 2) · 결정 8 = 권고대로 (Builder +3,000 · Preview +2,000 B, Builder 절대 상한 1,660,000 B 재승인 — ADR-320 과 공용). 메인 세션 판단: design-data 대조 기준 = MCP dataset 4.7.0 을 굳힌 fixture, 색은 새 토큰 없이 기존 TokenRef.
  > **Phase 1 (G1) — 2026-11-27**, `3718e2423` (worktree): StepList · Step 등록 (contract 81 — main 병합 때 **83**) · 상태 규칙의 정지 모양 · Canvas 정적 · DOM 정적 (RAC `Group > ol > li`, Link 조립은 Phase 2). 표식 · 선은 노드가 아니라 Step 이 자기 여백에 그린다. fixture 25 의 Canvas rect = Chrome rect (최대 차 0.02 px) · 실제 builder live 19 / 19 · 원복 RED 변이 10 모두 실패 · 복원 확인. **번들: Builder initial +3,629 B (1,647,247 B) — 결정 8 의 +3,000 (두 컴포넌트 합) 을 StepList 등록만으로 넘는다 (보고 · 사용자 판단 대기)**, Preview −1 B. 정한 값 · 색 대체 · 설계와 달라진 것: [breakdown §5.3 · §8](design/321-steplist-rating-components-breakdown.md).
  > **사용자 답 (2026-11-27, Phase 1 보고 뒤)**: 결정 8 의 Builder 한도 +3,000 → **+7,000 B** (StepList 등록만으로 +3,629 — 남은 Phase 몫 포함, Builder 절대 상한 1,660,000 그대로). Preview +2,000 그대로.
  > **Phase 2 (G2) — 2026-11-27**, `3718e2423` (worktree): StepList 의 동작 — RAC `Group > ol > li > Link` 조립 (`aria-current` · `isDisabled` · 상태 문구 · 작성 이름), 상태 규칙의 이동 (누르기 · Do 4), 「자유 이동」 스위치 `allowsFreeNavigation` (사용자 답 — 결정 3), When 2 · 이름 붙인 상태 2. 상태 규칙 = v3 state hook (시작 값 324 가지 · 이동 · 완료 — 차이 0) · 조립 속성 = v3 hook 속성 · D1 예외 0 (정적 검사) · 실행 Preview 전 경로 9 건 · live Chrome 12 / 12 · WebKit 12 / 12 · 정적 모양 회귀 25 / 25 · 원복 RED 변이 25 모두 실패 · 복원 확인. contract 81 그대로 (더하기뿐). 번들: Builder initial +5,219 B (1,648,837 B — Phase 2 의 몫 +1,590 B), 결정 8 의 +7,000 까지 1,781 B 남음 · Preview −1 B. 정한 규칙 · 설계와 달라진 것: [breakdown §5.2 · §8](design/321-steplist-rating-components-breakdown.md).
  > **사용자 답 (2026-11-27, Phase 2 보고 뒤)**: 결정 8 의 Builder 한도는 Phase 3 (Rating) 에서 실제 증가량을 잰 뒤 정한다 (지금 +7,000 B 그대로).
  > **main 병합 (2026-11-27)**: worktree 커밋 `3718e2423` 을 main 에 합쳤다. main 이 ADR-320 Phase 2 로 contract 82 를 먼저 냈으므로 이 ADR 의 번호는 **83** 이다 (81 은 따로 나간 적이 없다 — `LIBRARY_CONTRACT_VERSION` 주석). 리터럴 · 등록 수 (199) · 생성 CSS 수 (142 · index 124) 는 두 ADR 합으로 맞췄다.
- 사용자 요청: `/create-adr` (2026-11-26). 방향을 정한 원문 (같은 날): 「https://reui.io/components 분석후 우리 컴퍼넌트와 비교하고 reui가 더 편리한 부분과 차용할 부분들 비교 분석해줘」 → 비교 보고 뒤 `/create-adr`.
- 사용자가 이미 답한 것 (2026-11-26, 선택 질문 2): 범위 = 차용 후보 네 묶음 전부, 문서 단위 = 「묶음마다 ADR 하나」 (결정 지점 1 의 확정). 이 문서는 「Stepper · Rating」 묶음이다. 다른 묶음: [320](320-filter-bar-runtime-condition-builder.md) · [322](322-cascader-hierarchical-picker.md) · [323](323-timeline-event-calendar-gantt.md).
- 분리 점검 (4 질문) 은 [ADR-320 Status](320-filter-bar-runtime-condition-builder.md) 에 적었다 — 네 ADR 은 서로의 선행이 아니고 저장 형식이 겹치지 않는다. 이 ADR 은 기존 ADR 을 나누거나 합치지 않는다.
- 이름: ReUI 의 「Stepper」 는 Spectrum 에서 **StepList** 다. type 이름은 Spectrum 을 따른다.
- 리뷰 round 1 (2026-11-26, codex — [reviews/321.md](reviews/321.md)): HIGH 1 · MEDIUM 1. 둘 다 코드로 확인하고 설계에 반영했다. Round 2 수리 검증에서 2건을 종결했다. 설계 리뷰 잔여 이슈는 0건이다. 착수는 사용자 `/execute-adr 321`.
  > round 1 반영: (h1) 입력 별점의 폼 값 (RAC Slider 가 맞춘 값) 과 이름 붙인 상태 (넣은 값 그대로) 가 갈린다 → 별점의 유효값 함수 하나를 별 채움 · 폼 · 상태 · 낭독이 같이 읽는다 (F11 · Decision 8 · R8 · G5). (m2) 표시 전용 Meter 의 낭독 값이 백분율이다 → 「5점 만점에 N점」 문구를 `valueLabel` 로 넘긴다 (F12 · Decision 6 · G5). 검증 범위의 지적 — 자유 이동 (결정 3) 은 v3 에 없으므로 따로 적은 정답표로 본다 (Decision 3 · G2).

## Context

### 도메인

- **D1 (DOM · 접근성)**: 설치된 `react-aria-components` 1.22.1 에 StepList 와 Rating 이 없다. 둘 다 있는 RAC 부품으로 조립한다 — StepList 는 RAC `Group` (목록의 이름) 안 순서 목록의 RAC `Link`, Rating 은 RAC `Slider` (입력) 와 `Meter` (표시). **D1 예외를 만들지 않는 것이 제약이다** (HC2).
- **D2 (Props)**: S2 1.8.2 에 둘 다 없다. 정본 순서의 2 번 — spectrum-design-data 에 `steplist` · `rating` 스키마가 있다. StepList 는 3 번 (v3) 에도 구현이 있다. 어느 이름을 쓸지는 사용자 결정 1.
- **D3 (시각)**: 표식 · 선 · 별의 치수와 색은 catalog rule 이 정본이고 값은 design-data 토큰에서 가져온다 (S2 설치본에 대응 컴포넌트가 없다). Canvas 와 DOM 이 같은 rule 을 읽는다.

### 문제

고객의 업무 화면에는 여러 단계로 나뉜 입력 (신청 · 등록 · 결재) 과 평점 (만족도 · 평가) 이 있다. 지금 단계 표시는 Tabs 나 Breadcrumbs 로 흉내 낼 수밖에 없어 「완료 · 현재 · 남은 단계」 구분과 「앞 단계를 마쳐야 다음으로」 가 없고, 별점은 Slider 로만 만들 수 있어 별 모양이 없다. ReUI 는 Stepper (부품 10 · 단계별 내용 패널) 와 Rating 을 주지만, Stepper 는 tablist 의미이고 Rating 은 role 과 키 처리가 아예 없다. Spectrum 은 두 컴포넌트를 design-data 에 정의해 두었다.

### 코드 사실 (2026-11-26 실측, HEAD `0ea8c33d8`)

- **F1** RAC 1.22.1 의 export 와 S2 1.8.2 의 `exports/index.ts` 에 step · rating 이 없다.
- **F2** design-data 에 두 스키마가 있다 (`@adobe/spectrum-design-data/components/steplist.json` · `rating.json`, 둘 다 `specVersion: 1.0.0-draft`). steplist 의 `anatomyReview` 는 「There is no React Spectrum or SWC steplist」 라고 적는다. **Phase 0 정정**: 아래 옵션 가운데 steplist 의 `variant` · `size` · 최상위 `isDisabled` · `anatomyReview` 와 rating 의 `size`, 그리고 두 컴포넌트의 토큰 binding 은 design-data MCP 의 dataset 4.7.0 에서 읽은 것이다 — 저장소에 설치된 3.9.1 의 두 파일에는 없다 ([breakdown §1](design/321-steplist-rating-components-breakdown.md)). **Phase 1 확정**: 설치본은 올리지 않는다. 대조 기준은 MCP dataset 4.7.0 의 steplist · rating 값을 굳힌 fixture `packages/shared/src/catalog/__tests__/fixtures/adr321-design-data.json` (머리말 `$source` 에 dataset 버전 · 조회 날짜 2026-11-27) 이고 게이트 `adr321StepListDesignData.static.test.ts` 가 rule 을 그것과 대조한다.
  - steplist: `orientation` (horizontal · vertical) · `variant` (default · emphasized) · `size` (s · m · l · xl) · `currentStep` · `items[]` (`label` · `isDisabled` · `stepState`) · `isDisabled`. 지침: 선형 흐름 (남은 단계는 누를 수 없다), 완료 = 체크 · 남은 단계 = 숫자 · 현재 = 진한 칠.
  - rating: `value` (0 ~ 5, 0.5 단위) · `isEmphasized` · `isDisabled` · `size` (s · m). `accessibility.role: "slider"`. 지침: 별은 늘 5 개, 입력은 정수 별 · 소수는 집계 표시, 화살표로 0 까지 줄여 지운다.
- **F3** v3 StepList 는 alpha 다 (npm `@react-spectrum/steplist` 3.0.0-alpha.25, 공식 문서는 stub). hook 은 설치본의 private 경로에 있다 (`react-aria/dist/private/steplist/useStepList.mjs` · `useStepListItem.mjs`, `react-stately/dist/private/steplist/useStepListState.mjs`). DOM 은 `ol > li > a[role=link]`, 현재 단계에 `aria-current="step"`, 상태 규칙은 state hook 에 있다 (완료 = `lastCompletedStep` 이하 · 선택 가능 = 완료된 단계와 그 다음 단계).
- **F4** RAC `Link` 는 `aria-current` 를 prop 으로 받고 값에 `'step'` 이 있다 (`react-aria/dist/types/src/link/useLink.d.ts:9`).
- **F5** RAC `Slider` 에는 `isReadOnly` 가 없다 (`react-aria-components/dist/types/src/Slider.d.ts` 0 건 — `isDisabled` 뿐). `RadioGroup` 은 `isReadOnly` 가 있지만 고른 값을 해제하는 경로가 없다. `Meter` 는 표시 전용 role 이다.
- **F6** 가까운 등록 선례: Tabs (짝 TabPanel 을 같이 다루는 명령 — `packages/shared/src/catalog/commands/collections.ts:305`, 상태 concept `interactions/concepts/singleSelection.ts:81-101`) · Breadcrumbs (`catalog/runtime/delegatedDom.runtime.ts:2882`) · Slider (`interactions/concepts/valueCommit.ts:25-45`, renderer `delegatedDom.runtime.ts:3527`) · Meter (`:3674`).
- **F7** `d2Provenance.ts` 의 출처 값은 `v3` · `rac` · `composition` 셋이다 (`catalog/document/d2Provenance.ts:16`). 정본 순서 2 번 (design-data) 을 적을 값이 없다.
- **F8** 아이콘 세트에 `star` · `star-half` · `check` 가 있다 (`packages/rendering/src/icons/lucideIconData.generated.ts`).
- **F9** Form 의 검증 방식은 Form 에서만 정한다 (사용자 결정 2026-11-23). Form 의 When 은 `onSubmit` · `onReset` · `onInvalid` 다 (`interactions/concepts/form.ts:15-31`).
- **F10** `LIBRARY_CONTRACT_VERSION` 79, initial 번들 여유 Builder 약 10,600 B (상한 만료 2026-12-25 — Phase 0 재측정). **Phase 0**: contract 는 80 이다 (ADR-324 `b8e0beef4`) — 이 ADR 은 81 부터. 번들 기준선 (메인 세션, `f4a9c4b51` · 일반 `vite build` → `adr209-bundle-closure.mjs`): Builder initial JS gzip 1,643,618 B · Preview 172,277 B. Builder 절대 상한은 2026-11-27 에 1,660,000 B 로 재승인됐다 (ADR-320 과 공용 — ADR-201).
- **F11** Slider 의 값 concept 은 넣은 수를 그대로 쓴다 — Do 「값 넣기」 는 숫자를 그대로 넘기고 (`interactions/concepts/valueCommit.ts:25-45`), 이름 붙인 상태로의 미러도 그대로 적는다 (`catalog/runtime/catalogPreviewInteractions.ts:1151` · `:1555` — Phase 0 기준 `:1212` · `:1616`, 정규화는 `state/implicitState.ts:94`). RAC Slider 는 받은 값을 범위와 단계에 맞춘다 — 0 ~ 5 · 1 단계에 2.5 를 주면 range input 은 3, 6 을 주면 5 다 (리뷰 round 1 의 SSR 실측 — Phase 0 에서 실제 Chrome 의 range input 으로 같은 값). 그래서 폼 값과 상태 값이 갈린다.
- **F12** RAC Meter 는 `valueLabel` 이 없으면 값을 백분율로 낭독한다 — 0 ~ 5 의 2.5 는 `aria-valuetext="50%"` 다 (같은 실측). 저장소의 Meter renderer 는 `valueLabel` 을 넘길 수 있다 (`catalog/runtime/delegatedDom.runtime.ts:3690-3695`).

### 레퍼런스

- **ReUI Stepper** (registry 소스 읽음): `role="tablist"` · `tab` · roving tabindex, 어느 단계든 누르면 활성 (선형 제한 없음), 단계별 내용 패널 (`StepperPanel` > `StepperContent`), 단계 설명 · loading · 상태별 표식 교체. 검증 연동은 문서 · 예제 44 개 어디에도 없다 (값을 밖에서 제어하는 예제뿐).
- **ReUI Rating**: `rating` (소수 = 부분 별) · `maxRating` · `showValue` · `editable`. DOM 은 `div` 와 클릭 handler 뿐이고 role · `aria-*` · 키 처리가 없다 — 문서가 키보드 입력에는 Radio Group 을 쓰라고 안내한다.
- **WAI-ARIA APG**: Rating Slider (`role="slider"`, 0 = 아직 고르지 않음) 와 Rating Radio Group (화살표 = 이동과 선택, 해제 없음).
- **Spectrum CSS rating**: `input[type=range]` (min 0 · max 5) + 별 아이콘.
- 대조 표 전문은 [breakdown §2](design/321-steplist-rating-components-breakdown.md).

### Hard constraints

- **HC1** 새 런타임 의존성 0.
- **HC2** D1 예외 0 — react-aria 의 private steplist hook 을 쓰지 않고, role · `aria-*` 를 직접 적지 않는다 (RAC prop 으로 넘기는 `aria-current` · `aria-label` 은 RAC 의 계약이다). 조립으로 풀리지 않으면 멈추고 사용자에게 보고한다 (결정 지점 3).
- **HC3** 대칭: 같은 작성 값에서 Canvas 와 Preview 첫 화면의 표식 · 선 · 별 rect 가 ±1 px 로 같다. 기준값은 실제 Chrome 의 `getBoundingClientRect` 다.
- **HC4** 번들: initial Δ 는 사용자 결정 8 안.
- **HC5** 키보드만으로 단계 이동과 별점 입력 · 지우기 전부.
- **HC6** 문서 변환 코드 0 — contract 는 더하기만.
- **HC7** 치수 · 색 값은 design-data 토큰 (대조 기준 = MCP dataset 4.7.0 을 굳힌 fixture — F2) 을 저장소의 TokenRef 이름으로 옮긴다. 저장소에 같은 이름이 없는 색은 새 테마 토큰을 만들지 않고 가장 가까운 기존 TokenRef 로 두며 차이와 사유를 breakdown §5.3 과 게이트의 목록에 적는다. 토큰이 비어 있는 값 (step 의 폭 · 높이 · step 과 선의 간격 · 라벨 글자 맞춤) 은 Phase 1 에서 정하고 분류 목록에 적는다.

### Soft constraints

- RAC · S2 가 StepList 나 Rating 을 내면 그 컴포넌트로 바꾼다.
- RTL 은 대상이 아니다.
- 사용자는 비개발자다 — 「다음 단계」 같은 동작이 Do 하나로 잡혀야 한다.

## Alternatives Considered

### 대안 A: ReUI 방식 그대로 (Stepper = tablist · Rating = 클릭 handler)

- 설명: Stepper 는 RAC `Tabs` 로, Rating 은 별마다 클릭을 받는 `div` 로 만든다.
- 근거: ReUI 의 표면 (내용 패널 · 임의 단계 이동) 과 같다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 **HIGH** (Rating 에 키보드 · 낭독이 없다 — 넣으려면 직접 ARIA 를 적어야 하고 D1 위반이다. Stepper 의 tablist 의미는 Spectrum 정의의 「단계 link 목록 · `aria-current="step"`」 과 다르다) / 마이그레이션 LOW.

### 대안 B: Spectrum 정의 + RAC 조립 (채택)

- 설명: StepList 는 `ol > li` 안의 RAC `Link` (`aria-current="step"` · `isDisabled`) 와 순수 함수인 상태 규칙. Rating 은 RAC `Slider` (입력) 와 `Meter` (표시 전용) 위에 별을 그린다.
- 근거: F2 (Spectrum 정의) · F3 (v3 의 DOM · 상태 규칙을 대조 기준으로) · F4 · F5.
- 위험: 기술 MEDIUM (Slider 의 track 누르기가 「누른 별 = 값」 이 되는지 · Link 목록의 낭독) / 성능 LOW / 유지보수 MEDIUM (상태 규칙을 우리가 가진다) / 마이그레이션 LOW.

### 대안 C: react-aria private steplist hook + 직접 DOM, Rating 은 직접 ARIA

- 설명: v3 그대로 `useStepList` · `useStepListItem` 으로 요소를 직접 렌더하고, Rating 은 `role="slider"` 를 직접 단다.
- 근거: Spectrum 의 구현과 가장 가깝다 (화살표 이동 포함).
- 위험: 기술 MEDIUM (alpha · private 경로) / 성능 LOW / 유지보수 **HIGH** (사용자 컴포넌트의 D1 예외가 둘 더 늘고, alpha hook 의 변경을 따라가야 한다) / 마이그레이션 LOW.

### 대안 D: 새 컴포넌트 없이 기존 조합 안내 (Tabs · Breadcrumbs · Slider)

- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW. 완료 상태 · 순서 강제 · 별 모양이 없다 — 사용자 범위를 채우지 못한다.

### Risk Threshold Check

| 대안 | HIGH 이상       | 판정               |
| ---- | --------------- | ------------------ |
| A    | 유지보수        | 기각               |
| B    | 없음 (MEDIUM 2) | 채택 — 루프 불필요 |
| C    | 유지보수        | 기각               |
| D    | 없음            | 범위 미달로 기각   |

## Decision

**대안 B 를 채택한다.**

1. **type** — `StepList` · `Step` (항목) 과 `Rating`. 단계별 내용 패널 `StepPanel` 은 사용자 결정 2.
2. **StepList 의 DOM** — RAC `Group` 안의 `ol`, 그 `li` 마다 RAC `Link` 하나. Group 이 목록의 이름을 갖는다 (`aria-label` prop — 작성값, 없으면 i18n 기본 문구 「단계 목록」. 사용자 답 2026-11-27, Phase 0 발견 2 — `ol` 은 RAC 부품이 아니라 예외 0 조건에서 이름을 줄 수 없다). 접근성 트리는 `group > list > listitem > link` 다. 문서 노드 · rule 의 상자는 Group 이고 `ol` 은 그 안을 채우는 요소다 (노드 아님). 현재 단계의 Link 에 `aria-current="step"` 을 prop 으로 넘기고, 갈 수 없는 단계는 `isDisabled` 다. 상태 (현재 · 완료 · 남음) 는 Link 안의 보이지 않는 글자로 읽힌다. 이동은 Tab 과 Enter 다 — 화살표 이동은 넣지 않는다 (RAC Link 가 주지 않는 키).
3. **StepList 의 상태** — `selectedKey` (지금 단계) 와 `lastCompletedStep` (어디까지 마쳤는지) 둘. 규칙은 순수 함수 하나다: 완료 = `lastCompletedStep` 이하, 갈 수 있는 단계 = 완료된 단계와 그 바로 다음 단계와 첫 단계, 다음 단계로 가면 지나온 단계가 완료된다. v3 state hook 의 결과와 대조 테스트로 맞춘다 (hook 은 테스트의 대조 기준으로만 읽는다). 순서 강제를 끄는 스위치는 사용자 결정 3 — 자유 이동은 v3 에 없는 규칙이라 v3 대조는 선형 모드에만 걸고, 자유 이동은 따로 적은 정답표로 고정한다.
4. **StepList 의 모양** — `orientation` · `size` (S · M · L · XL) · 강조. 완료 = 체크, 남은 단계 = 숫자, 현재 = 진한 칠, S 크기는 점만. 값은 design-data 의 steplist 토큰이다.
5. **단계의 동작** — Do 「다음 단계 · 이전 단계 · 단계로 이동 · 단계 완료」, When 「단계 변경 · 완료 단계 변경」, 이름 붙인 상태 둘 (지금 단계 · 마친 단계). 폼과는 Form 의 When 「Submit」 → Do 「단계 완료 · 다음 단계」 로 잇는다 — 조건부 Do 를 만들지 않는다.
6. **Rating 의 DOM** — 입력은 RAC `Slider` (0 ~ 5 · 1 단계), 표시 전용 (`isReadOnly`) 은 RAC `Meter` 다 (사용자 결정 7). 별 다섯은 track 안의 장식이고 값만큼 채운다. 표시 전용은 0.5 단위의 반쪽 별을 그리고, Meter 에 범위 0 ~ 5 와 지역화한 `valueLabel` (「5점 만점에 2.5점」) 을 넘긴다 — 넘기지 않으면 낭독 값이 백분율이다 (F12).
7. **Rating 의 조작** — 별을 누르면 그 별까지, 화살표로 한 칸씩, 0 까지 줄이면 지워진다. hover 미리보기는 CSS 만으로 그린다. 「가장 높은 별을 다시 눌러 지우기」 (design-data 지침) 는 RAC Slider 가 주지 않으므로 넣지 않는다.
8. **Rating 의 prop** — design-data 의 `value` · `isEmphasized` · `isDisabled` · `size` (S · M) 와 composition 확장 `isReadOnly`. 폼 필드로서의 범위는 사용자 결정 5, 별 개수는 사용자 결정 6. 값 연동은 Slider 의 concept (`valueCommitNumber`) 을 쓴다.
   - **유효값은 함수 하나다.** 입력 모드 = 0 ~ 별 개수로 자르고 정수로 맞춘다 (RAC Slider 가 단계에 맞추는 것과 같은 반올림 — 2.5 → 3 · 6 → 5 · −1 → 0). 표시 모드 = 0 ~ 별 개수로 자르고 0.5 단위로 맞춘다 (2.3 → 2.5). 숫자가 아닌 값은 0 이다.
   - 작성 값 · 데이터에서 온 값 · Do 「값 넣기」 · RAC 의 변경이 모두 이 함수를 지난 수를 쓴다 — 별 채움 (Canvas · DOM) · 폼 값 · 이름 붙인 상태 · 낭독 값이 같은 수다. 상태로의 미러는 넣은 수가 아니라 유효값을 적는다 (F11 의 자리).
   - 같은 어긋남이 Slider 에도 있다 (단계 사이 · 범위 밖의 값). 맞추는 자리를 `valueCommitNumber` 를 쓰는 type 의 공용 자리에 두어 Slider 도 같이 닫는다.
9. **D2 출처** — `d2Provenance.ts` 에 출처 값 `design-data` 를 더한다 (F7 — 정본 순서 2 번을 적을 값이 없었다). StepList 의 이름은 사용자 결정 1.
10. **Canvas** — 작성 값의 정지 모양을 그린다 (시작 단계 · 시작 값). 단계 이동과 별 누르기는 Preview · Publish 에만 있다.
11. **하지 않는 것**
    - ReUI 의 tablist 의미 · role 없는 별점 (대안 A). private steplist hook · 직접 ARIA (대안 C).
    - 단계의 loading 상태 · 임의 표식 교체 (사용자 결정 4 의 권고 밖).
    - 별점의 임의 소수 입력 — 입력은 정수, 소수는 표시뿐이다 (Spectrum 지침).
    - 단계 검증을 StepList 가 직접 하는 일 — 검증은 Form 의 것이다 (F9).
    - 문서 변환 코드 (HC6).

위험 수용 근거: B 의 남는 위험은 조립이 서는지다. 둘 다 Phase 0 의 시제품으로 먼저 가르고 (G0), 서지 않으면 그 컴포넌트의 방식만 바꾼다. 상태 규칙은 입력과 출력이 key 인 순수 함수라 v3 hook 의 결과로 고정할 수 있다.

기각 사유:

- **A** — Rating 에 키보드와 낭독이 없고, Stepper 의 의미가 Spectrum 정의와 다르다.
- **C** — D1 예외가 둘 늘고 alpha 인 private hook 에 묶인다.
- **D** — 완료 상태 · 순서 강제 · 별 모양이 없다.

> 구현 상세: [321-steplist-rating-components-breakdown.md](design/321-steplist-rating-components-breakdown.md)

### 사용자 결정 (8 건 — 그 Phase 에 닿을 때 묻는다)

|  #  | 항목                                                                                                                                  | 권고                                                                                                                                              | 닿는 Phase |
| :-: | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | :--------: |
|  1  | StepList 의 prop 이름 — v3 이름 (`selectedKey` · `lastCompletedStep` · `isEmphasized`) / design-data 이름 (`currentStep` · `variant`) | v3 이름 — 상태 prop 이 RAC 의 이름 (`selectedKey`) 과 같고 강조가 S2 의 축 (`isEmphasized`) 과 같다. design-data 는 값 (치수 · 색) 의 출처로 쓴다 |     1      |
|  2  | 단계별 내용 패널 `StepPanel` — 넣는다 (Tabs 의 짝 방식) / 넣지 않는다 (내용은 표시 조건으로)                                          | 넣는다 — 「단계 = 화면 한 장」 이 한 묶음으로 놓이고, 패널은 role 없는 상자다. ReUI 가 편리했던 지점이다                                          |     3      |
|  3  | 순서 강제 — 늘 선형 (Spectrum 지침) / 「자유 이동」 스위치 추가                                                                       | 스위치 추가 (기본 선형) — 이미 저장된 신청을 고치는 화면처럼 어느 단계로든 가야 하는 쓰임이 있다                                                  |     2      |
|  4  | ReUI 에만 있는 단계 표현 — 설명 한 줄 / 아이콘 표식 / loading                                                                         | 설명 한 줄만 넣는다. 표식은 Spectrum 의 숫자 · 체크로 두고 loading 은 넣지 않는다                                                                 |     1      |
|  5  | Rating 의 폼 필드 범위 — `label` · `name` / 필수 · 오류까지 / 없음                                                                    | `label` · `name` — RAC Slider 가 주는 범위다. 필수 · 오류는 Slider 에 계약이 없어 넣지 않는다                                                     |     5      |
|  6  | 별 개수 — 5 고정 / `maxValue` 로 바꾸기                                                                                               | 5 고정 (Spectrum 지침 「always 5 available stars」)                                                                                               |     4      |
|  7  | 표시 전용 별점의 DOM — RAC `Meter` / 비활성 `Slider`                                                                                  | `Meter` — 표시 전용의 role 이고 소수 값을 그대로 읽는다. 비활성 Slider 는 흐리게 그려지고 값을 읽지 못하는 낭독기가 있다                          |     5      |
|  8  | 번들 Δ 수용 범위                                                                                                                      | initial Δ ≤ Builder +3,000 · Preview +2,000 B gzip (두 컴포넌트의 등록 · 정적 renderer · rule). 넘으면 보고                                       |  각 Phase  |

답 (2026-11-27, 선택 질문):

- **1** = v3 이름 (`selectedKey` · `lastCompletedStep` · `isEmphasized`). design-data 는 치수 · 색 값의 출처로만 쓴다.
- **4** = 설명 한 줄만. 표식은 Spectrum 의 숫자 · 체크 그대로, loading 없음.
- **8** = 권고대로 — initial Δ ≤ Builder +3,000 · Preview +2,000 B. Builder 절대 상한은 1,660,000 B 로 재승인 (ADR-320 과 공용). 넘으면 보고. → Phase 1 보고 뒤 Builder 한도를 **+7,000 B** 로 올렸다 (두 컴포넌트 전체, Preview +2,000 · 절대 상한 그대로).
- **3** = 「자유 이동」 스위치 추가 · 기본 선형 (Phase 2 착수 때 답). 선형은 v3 state hook 대조, 자유 이동은 따로 적은 정답표로 고정한다 (Decision 3 그대로). 스위치의 이름은 `allowsFreeNavigation` (composition 확장).
- 색 대체 둘 (design-data 와 한 단 차이 — breakdown §5.3) 은 그대로 둔다 — 새 토큰 없음 (Phase 1 보고 뒤 답).
- 표에 없던 것 — **StepList 목록의 이름** (Phase 0 발견 2) = RAC `Group` 으로 감싸기 (Decision 2). D1 예외 0 유지.
- **2** = StepPanel 을 넣는다 — Tabs 의 짝 방식 (Phase 3 착수 때 답, 2026-11-27). 자리 = 감싸는 새 type `Stepper` (같은 날 답 — ReUI Stepper · Tabs 의 모양): `Stepper > StepList + StepPanel…`. StepList 는 Phase 1 · 2 그대로 쓰고 패널은 「단계 목록」 group 밖에 놓인다. 기각: StepList 직계 자식 (배치를 grid 로 바꾸고 패널이 group 안에 든다) · StepList 형제 (선례 없는 형제 짝 · frame 을 풀면 짝이 깨짐).
- Phase 2 의 정한 것 5 (자유 이동에서도 건너뛴 단계는 완료) = 그대로 (2026-11-27 확인).
- 남은 것: 5 · 6 · 7 (Phase 4 · 5).

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                          | 심각도 | 대응                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | StepList 조립의 낭독 · 키보드가 Spectrum 정의와 어긋난다 — 새 `catalog/runtime/stepList.components.tsx`, 대조 기준 `react-aria/dist/private/steplist/useStepListItem.mjs:26-32` (role · `aria-current` · `aria-disabled` · tabIndex), 조립 선례 Breadcrumbs (`delegatedDom.runtime.ts:2882`)                                                  |  HIGH  | G0 시제품 P1 (Chrome 접근성 트리) · G2 — 조립이 낸 속성 = v3 hook 이 내는 속성 (대조 테스트) · 키보드 전 경로. G6 — VoiceOver 청취 (사용자)                          |
| R2  | Rating 에서 누른 별과 값이 어긋난다 — RAC Slider 는 track 위치를 가까운 단계로 반올림한다 (`react-aria/dist/private/slider/useSlider.mjs:73-84` 의 track 누르기 · `react-stately/dist/private/slider/useSliderState.mjs:129-135`), renderer `delegatedDom.runtime.ts:3527`, 새 rule 의 track 배치                                             |  HIGH  | G0 시제품 P2 — track 배치로 별 다섯의 왼쪽 · 가운데 · 오른쪽 누르기 15 점이 모두 그 별의 값. no-go 면 RadioGroup 방식 (지우기는 Do 로) 을 사용자에게 보고하고 정한다 |
| R3  | 짝이 깨진 문서 — Step 과 StepPanel 의 수 · 순서가 어긋난다 (사용자 결정 2 가 「넣는다」 일 때)                                                                                                                                                                                                                                                | MEDIUM | Tabs 의 짝 명령 방식 (`commands/collections.ts:305`) 을 그대로 쓰고 renderer 는 짝 없는 단계를 패널 없이 그린다                                                      |
| R4  | design-data 토큰이 비어 있는 값 (step 폭 · step 과 선의 간격) 을 우리가 정한다                                                                                                                                                                                                                                                                | MEDIUM | Phase 1 에서 값과 근거를 breakdown 에 적고 `componentRulesTable.static.test.ts` 의 분류 목록에 넣는다                                                                |
| R5  | 두 번째 상태 (`lastCompletedStep`) 의 concept 이 없다 — 미러 변수 · Do 가 새 자리다                                                                                                                                                                                                                                                           | MEDIUM | 값 형은 기존 `key` 를 쓴다. concept 파일 하나를 더하고 등록표 유도 테스트로 본다                                                                                     |
| R6  | initial 번들 (F10)                                                                                                                                                                                                                                                                                                                            | MEDIUM | G0 기준선 · Phase 마다 Δ (사용자 결정 8)                                                                                                                             |
| R7  | Canvas 는 단계 이동 · 별 hover 를 보여 주지 않는다                                                                                                                                                                                                                                                                                            |  LOW   | 대칭 기준을 「같은 상태의 정지 모양」 으로 둔다                                                                                                                      |
| R8  | 별점의 값이 표면마다 다르다 — 값 넣기 Do 가 수를 그대로 넘기고 (`interactions/concepts/valueCommit.ts:25-45`), 상태 미러가 그대로 적고 (`catalog/runtime/catalogPreviewInteractions.ts:1212` · `:1616`), RAC Slider 는 단계에 맞추며 (`catalog/runtime/delegatedDom.runtime.ts:3527`), Meter 는 `valueLabel` 없이 백분율을 낭독한다 (`:3674`) |  HIGH  | 유효값 함수 하나 (Decision 8) 와 Meter 의 `valueLabel` (Decision 6). G5 — 유효값 정답표에서 별 채움 = 폼 값 = 상태 값 = 낭독 값                                      |

HIGH 가 셋이고 StepList 하나 · Rating 둘이다. ADR 을 둘로 나누지 않는다 — 사용자가 이 묶음을 ADR 하나로 정했고 (Status), 한쪽이 no-go 여도 다른 쪽의 Phase 는 그대로 진행한다.

## Gates

측정 조건 ([measurement-validity.md](../../.claude/rules/measurement-validity.md)): 배치 대조의 fixture 는 계약이 갈리는 입력 차원 (방향 둘 · 크기 넷 · 강조 · 단계 수 2 · 5 · 9 · 긴 라벨 줄바꿈 · 설명 유무 · 별 값 0 · 2.5 · 5) 을 모두 쓰고 기준값은 실제 Chrome 의 rect 다. 상태 규칙의 기준값은 v3 state hook 의 결과와 따로 적은 정답표 둘이다 (자유 이동은 정답표만). 별점 값의 기준값은 따로 적은 정답표 (입력 2.5 → 3 · 6 → 5 · −1 → 0, 표시 2.3 → 2.5 · 6 → 5) 와 실제 DOM 의 range input 값 · `aria-valuetext` 이고, 유효값 함수의 출력으로 채점하지 않는다.

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                                                         | 실패 시 대안                                                  |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| G0   | Phase 0 끝 | 코드 사실 F1 ~ F12 재대조 차이 0 · design-data 두 스키마와 토큰 표 고정 · 시제품 2 (StepList Link 조립의 접근성 트리 · Rating 의 별 누르기 15 점) 의 go / no-go · 번들 기준선                                                                                                                                                                                     | no-go 인 컴포넌트는 방식을 바꿔 사용자에게 보고 (결정 지점 3) |
| G1   | Phase 1 끝 | StepList 등록 게이트 (`pnpm codex:preflight` 의 registration · `d2S2Alignment.static.test.ts`) · contract · fixture 의 Canvas rect = Chrome rect ±1 px · `/cross-check` · 원복 RED                                                                                                                                                                                | 어긋나는 크기 · 방향을 빼고 보고                              |
| G2   | Phase 2 끝 | 상태 규칙 = v3 hook = 정답표 (선형) · 자유 이동 = 정답표 (결정 3 이 「스위치 추가」 일 때) · 조립이 낸 속성 = v3 hook 의 속성 · Do 4 · When 2 · 키보드 전 경로 · Chrome 과 WebKit live                                                                                                                                                                            | 어긋나는 규칙을 v3 쪽으로 맞춘다                              |
| G3   | Phase 3 끝 | (결정 2 가 「넣는다」 일 때) 짝 명령 (추가 · 삭제 · 순서 · 되돌리기) · 고른 단계의 패널만 보임 · Form Submit → 다음 단계 live                                                                                                                                                                                                                                     | 패널을 빼고 표시 조건 안내로                                  |
| G4   | Phase 4 끝 | Rating 등록 게이트 · 값 0 ~ 5 (0.5 단위) 의 Canvas = DOM (`/cross-check`) · 강조 · 비활성 · 크기 둘                                                                                                                                                                                                                                                               | 반쪽 별을 표시 전용에서만                                     |
| G5   | Phase 5 끝 | 별 누르기 15 점 · 화살표 · 0 까지 줄이기가 정답표와 일치 · 유효값 정답표의 입력마다 (작성 값 · 데이터 값 · Do 「값 넣기」 세 길) 별 채움 = range input 값 = 폼 값 (결정 5) = 이름 붙인 상태 값 · 표시 전용의 `aria-valuetext` 가 「5점 만점에 N점」 (접근성 트리 — 백분율이 아님) 이고 그 N 이 반쪽 별 채움과 같음 · Slider 회귀 (단계 사이 값의 상태 = input 값) | 결정 7 을 다시 묻는다                                         |
| G6   | Phase 6 끝 | 번들 (결정 8) · `/evaluate` 종결 live (단계 입력 화면 하나 · 평점 입력과 집계 표시) · VoiceOver 청취와 사용자 확인                                                                                                                                                                                                                                                | 넘는 항목을 수리하거나 빼고 보고                              |

집행: 각 Gate 의 테스트는 unit · browser project 에 두고 Phase 끝에 실행자가 `pnpm -F @composition/shared test` · `pnpm -F @composition/builder test` (browser 는 `test:parity`) 와 `pnpm codex:preflight` 로 돌려 결과를 breakdown §8 에 적는다. 번들은 `adr201-bundle-gate.mjs` 와 배포 workflow (`push: main`) 의 상한 단계가 막는다.

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 단계로 나뉜 입력 화면과 별점을 컴포넌트 하나로 만든다 — 완료 · 현재 · 남은 단계가 구분되고 순서가 지켜진다.
- 두 컴포넌트 모두 키보드와 낭독이 RAC 의 계약이다. D1 예외가 늘지 않는다.
- prop 과 치수가 Spectrum 의 정의에서 온다 — S2 가 두 컴포넌트를 내면 옮기기 쉽다.

### Negative

- StepList 의 상태 규칙과 조립을 우리가 유지한다. 화살표로 단계 사이를 옮기는 조작은 없다.
- Rating 에서 design-data 지침의 일부 (같은 별을 다시 눌러 지우기 · hover 툴팁 문구) 가 빠진다.
- Slider 의 이름 붙인 상태가 넣은 수가 아니라 단계에 맞춘 수를 갖게 된다 (지금까지 폼 값과 달랐던 것을 맞춘다).
- contract 가 오르고 initial 번들에 등록 몫이 더해진다 (사용자 결정 8).
- Canvas 는 단계 이동과 별 누르기를 보여 주지 않는다.
