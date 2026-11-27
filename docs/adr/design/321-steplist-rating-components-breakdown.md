# ADR-321 breakdown — StepList · Rating

> 결정: [ADR-321](../321-steplist-rating-components.md). 경로 약칭 `S/` = `packages/shared/src/`, `RA/` = 설치된 `react-aria` 3.53.1, `RS/` = `react-stately` 3.51.0.

## 1. 범위 · 출처

- 사용자 요청 2026-11-26 — ReUI 비교 보고 뒤 `/create-adr`, 「Stepper · Rating」 묶음.
- 범위: `StepList` · `Step` (· `StepPanel`) 과 `Rating` 의 등록 · 정적 모양 · 동작 · 상태 연동.
- 범위 밖: 단계 검증 (Form 의 것) · 별점 집계 계산 (보기의 집계 `mean` 이 한다).
- 조사 근거: design-data MCP · 설치본 소스 · v3 저장소 소스 · ReUI registry 소스 · APG.
- **design-data 의 출처 버전 (Phase 0 정정)**: 스키마의 `size` · `variant` · `anatomyReview` 와 토큰 binding (§5.3 · §5.6) 은 design-data MCP 의 내장 dataset **4.7.0** 에서 읽은 것이다 (2026-11-27 `design-data-primer` — 최신 공개판 4.8.0). 저장소에 설치된 `@adobe/spectrum-design-data` **3.9.1** (`apps/builder/package.json:63`, ADR-302 색 oracle 용) 의 `components/steplist.json` · `rating.json` 에는 그 옵션이 없고 (steplist = `orientation` · `items` · `currentStep`, rating = `value` · `isEmphasized` · `isDisabled`) 두 컴포넌트의 토큰 binding 기록도 없다. Phase 1 · 4 의 대조 게이트는 설치본이 아니라 MCP 값을 굳힌 fixture 를 기준으로 삼는다 (§8 Phase 0 「설계와 어긋나는 발견」 1).

## 2. 대조 표

### 2.1 StepList

| 항목           | design-data `steplist`                        | v3 StepList (alpha)                                                            | ReUI Stepper                               | 이 ADR                                       |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------- |
| 지금 단계      | `currentStep`                                 | `selectedKey` · `defaultSelectedKey` · `onSelectionChange`                     | `value` (number)                           | 사용자 결정 1 (권고 v3)                      |
| 완료           | `items[].stepState`                           | `lastCompletedStep` · `defaultLastCompletedStep` · `onLastCompletedStepChange` | `completed` (단계마다) 또는 `step < value` | `lastCompletedStep`                          |
| 방향           | `orientation` horizontal · vertical           | 같음                                                                           | 같음                                       | 같음                                         |
| 크기           | `size` s · m · l · xl                         | S · M · L · XL                                                                 | 없음                                       | S · M · L · XL                               |
| 강조           | `variant` default · emphasized                | `isEmphasized`                                                                 | 없음                                       | 사용자 결정 1 (권고 `isEmphasized`)          |
| 비활성         | `isDisabled` · `items[].isDisabled`           | `isDisabled` · `disabledKeys` · `isReadOnly`                                   | `disabled` (단계마다)                      | `isDisabled` · `disabledKeys` · `isReadOnly` |
| 순서 강제      | 선형 (남은 단계는 누를 수 없다)               | 선형 (state hook 의 규칙)                                                      | 없음 (어느 단계든)                         | 선형 + 사용자 결정 3                         |
| DOM            | role 정의 없음 (`intents: navigate`)          | `ol > li > a[role=link]` · `aria-current="step"`                               | `role="tablist"` · `tab`                   | `ol > li` > RAC `Link`                       |
| 키보드         | navigate-items · activate                     | Tab (선택 가능한 단계 사이) · 화살표 · Home · End                              | 화살표 넷 · Home · End · Enter · Space     | Tab · Enter                                  |
| 표식           | 완료 체크 · 남음 숫자 · 현재 진한 칠 (M 이상) | 숫자뿐                                                                         | 상태별 교체 (`indicators`)                 | design-data 그대로                           |
| 내용 패널      | 없음                                          | 없음                                                                           | `StepperPanel` > `StepperContent`          | 사용자 결정 2                                |
| 설명 · loading | 없음                                          | 없음                                                                           | 있음                                       | 사용자 결정 4                                |

### 2.2 Rating

| 항목      | design-data `rating`                  | ReUI Rating          | APG                              | 이 ADR                                    |
| --------- | ------------------------------------- | -------------------- | -------------------------------- | ----------------------------------------- |
| 값        | `value` 0 ~ 5 · 0.5 단위              | `rating` (임의 소수) | slider 0 ~ 10 / radio 1 ~ 5      | `value` 0 ~ 5 (입력 정수 · 표시 0.5 단위) |
| 별 개수   | 5 고정                                | `maxRating`          | 예제마다                         | 사용자 결정 6 (권고 5)                    |
| 크기      | s · m                                 | sm · default · lg    | —                                | S · M                                     |
| 강조      | `isEmphasized`                        | 없음                 | —                                | `isEmphasized`                            |
| 읽기 전용 | 없음 (집계 표시는 지침에만)           | `editable` 끄기      | radio 에 `aria-readonly`         | `isReadOnly` (composition 확장)           |
| role      | `slider`                              | 없음                 | `slider` 또는 `radiogroup`       | Slider (입력) · Meter (표시)              |
| 지우기    | 같은 별 다시 누르기 · 화살표로 0 까지 | 없음                 | slider 의 0 / radio 는 해제 없음 | 화살표로 0 까지                           |
| 숫자 표시 | 없음                                  | `showValue`          | —                                | 넣지 않음 (Text 로 값을 읽으면 된다)      |

## 3. 설치본이 주는 것

- RAC `Link` — `aria-current` prop (`'step'` 포함, `RA/dist/types/src/link/useLink.d.ts:9`) · `isDisabled` → `aria-disabled` · press. `href` 가 없으면 요소는 `span[role=link]` 이고 (`react-aria-components/dist/private/Link.mjs:29`) 비활성이면 `tabindex` 가 빠진다 (`RA/dist/private/link/useLink.mjs:27`).
- RAC `Slider` — root `role="group"` + 숨은 `input[type=range]`, 화살표 ± step · PageUp · PageDown · Home · End, `aria-valuetext`. `isReadOnly` 없음. track 누르기는 `값 = round((누른 자리 − track 왼쪽) ÷ track 폭 × (max − min) ÷ step) × step` 이다 (`RA/dist/private/slider/useSlider.mjs:73-84` · `RS/dist/private/slider/useSliderState.mjs:129-135`). thumb 은 track 의 `값 ÷ max` 자리에 가운데가 놓인다 (`RA/dist/private/slider/useSliderThumb.mjs:188-191`).
- RAC `Meter` — `role="meter"` · `aria-valuenow` · `aria-valuetext`. `valueLabel` 이 없으면 `aria-valuetext` 는 백분율이다 (0 ~ 5 의 2.5 = 「50%」).
- v3 hook (대조 기준으로만 읽는다) — `RA/dist/private/steplist/useStepListItem.mjs:26-32` (role · `aria-current` · `aria-disabled` · tabIndex), `RS/dist/private/steplist/useStepListState.mjs:31-70` (완료 · 선택 가능 · 지나온 단계 완료 규칙). 목록 요소에는 `useStepList.mjs:39` 가 `aria-label` (작성값, 없으면 지역화한 「Step List」) 을 준다.

## 4. D1 — 조립 표 (예외 0)

| 자리      | RAC 부품                                                        | RAC 가 주는 것                                        | 우리가 정하는 것                                |
| --------- | --------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| 단계 목록 | `Group` (`aria-label` prop) > `ol` · `li` (역할 없는 구조 요소) | group role · 이름 (Group) · 목록 의미 (브라우저 기본) | 순서 · 이름 (작성값, 없으면 i18n 「단계 목록」) |
| 단계      | `Link` (`aria-current` · `isDisabled` prop)                     | link role · `aria-disabled` · press · focus           | 어느 단계가 현재 · 갈 수 없는지 (상태 규칙)     |
| 상태 문구 | Link 안의 보이지 않는 글자 (`VisuallyHidden`)                   | 낭독되는 글자                                         | 「현재 · 완료 · 남음」 문구 (i18n)              |
| 별점 입력 | `Slider` > `SliderTrack` > `SliderThumb`                        | range input · 키 · 값 낭독                            | track 안의 별 배치 · 채움                       |
| 별점 표시 | `Meter` (`valueLabel` prop)                                     | meter role · 값 낭독                                  | 별 채움 (0.5 단위) · 낭독 문구 (i18n)           |

- 예외 0 의 조건: 구현 파일에 `role=` · `aria-` 리터럴과 `onKeyDown` 이 없다 (RAC prop 으로 넘기는 `aria-current` · `aria-label` 제외) — G2 · G5 의 정적 검사가 본다.
- 조립으로 낼 수 없어 넣지 않는 것: 단계 사이의 화살표 이동, 같은 별을 다시 눌러 지우기.
- **목록의 이름 (Phase 0 발견 → 사용자 답 2026-11-27 「RAC Group 으로 감싸기」)**: v3 는 `ol` 에 `aria-label` 을 준다. 조립의 `ol` 은 RAC 부품이 아니라서 예외 0 조건 아래에서는 이름을 줄 수 없다. 그래서 RAC `Group` 이 `ol` 을 감싸고 이름은 Group 의 `aria-label` prop 이다 (RAC 의 계약 — 예외 0 유지). 접근성 트리는 `group > list > listitem > link`. Phase 1 은 구조와 언어별 기본 이름 (`runtime/stepList.components.tsx`) 까지, Phase 2 가 작성 이름 (노드의 접근 이름 → Group 의 `aria-label` prop) 을 더했다.

## 5. 설계

### 5.1 StepList 의 노드 · prop

- `StepList` (팔레트 `layout` 범주 — Tabs · Breadcrumbs 와 같은 묶음) > `Step` 여럿. `Step` 은 `StepList` 안에만 놓인다 (collection 가족 — `COLLECTION_TYPE_TABLE` 에 한 줄).
- `StepList`: `selectedKey` · `defaultSelectedKey` · `lastCompletedStep` · `defaultLastCompletedStep` · `orientation` · `size` · `isEmphasized` · `isDisabled` · `isReadOnly` · `disabledKeys` · (결정 3) 자유 이동 스위치.
  - Phase 2 확정 (사용자 답 2026-11-27, 결정 3 = 스위치 추가 · 기본 선형): 스위치는 `allowsFreeNavigation` (boolean, Design 패널 「Free navigation」 · 「자유 이동」) — v3 · design-data 에 없는 composition 확장이다 (`d2Provenance.ts`). 목록의 이름은 노드의 접근 이름 (`aria-label` 칸 — `ariaLabelNeed.ts` 가 StepList 에 늘 낸다) 이고 RAC Group 의 `aria-label` prop 으로 간다.
- `Step`: 라벨 (자식 Text) · (결정 4) 설명 · `isDisabled`. key 는 노드의 항목 key 다.
  - Phase 1 확정: 원본 `component-step` = `Step > Text {label} + Text[slot=description] {description}`. 글자는 Step 의 `label` · `description` prop 이 정본이고 (template 바인딩 — ADR-254 Decision 5), 설명 Text 는 `presentWhen: "nonEmptyText"` 라 비면 노드가 없다. 표식 · 선은 노드가 아니다 (§5.3 「Phase 1 에서 정한 값」).
  - 이름 (사용자 답 2026-11-27, 결정 1): v3 이름 — `selectedKey` · `defaultSelectedKey` · `lastCompletedStep` · `defaultLastCompletedStep` · `isEmphasized` · `isReadOnly` · `disabledKeys`. design-data 는 치수 · 색 값의 출처로만 쓴다 (`d2Provenance.ts` 의 출처 값 `design-data` 는 스키마에도 같은 이름이 있는 `orientation` · `isDisabled` · Step `label` · `isDisabled` 에).
- `StepPanel` (결정 2): Tabs 의 TabPanel 처럼 Step 과 key 로 짝. role 없는 상자이고 고른 단계의 것만 그린다.
- 단계 값은 데이터에서 올 수 있다 — 행 template 안의 StepList 에 `selectedKey` · `lastCompletedStep` 을 필드 값으로 잇는다 (기존 값 바인딩). 단계 항목 자체는 자식 노드다.

### 5.2 StepList 의 상태 규칙 (순수 함수 하나)

- 입력: 단계 key 목록 · `selectedKey` · `lastCompletedStep` · `disabledKeys` · `isDisabled` · `isReadOnly` · 자유 이동.
- 출력: 단계마다 `현재 · 완료 · 남음` 과 `갈 수 있음`.
- 규칙: 완료 = 순서가 `lastCompletedStep` 이하. 갈 수 있음 = 완료된 단계 · 바로 앞이 완료된 단계 · 첫 단계 (비활성 · 읽기 전용이면 없음). 자유 이동이면 비활성이 아닌 모든 단계.
- 단계로 갈 때: 앞 단계가 완료가 아니면 앞 단계까지 완료로 올린다 (v3 규칙).
- 선택이 비면 완료 · 비활성이 아닌 첫 단계를 고른다.

**Phase 2 확정 (`S/catalog/runtime/stepListState.ts` — import 없는 순수 모듈, 두 consumer 의 파생 값 · DOM 조립 · dispatcher 가 같이 읽는다)**

| 것                                   | 규칙                                                                                                                                                                                     | 기준                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 지금 단계 · 완료 · 갈 수 있음 (선형) | 위 규칙 그대로. 지금 단계가 마지막 완료 단계보다 둘 이상 앞이면 그 앞 단계까지 완료 (읽을 때 정규화)                                                                                     | v3 `useStepListState` — 시작 값 324 가지에서 같다 (`adr321StepListV3.test.tsx`)                            |
| 누르기 (사용자)                      | 갈 수 있는 단계만. 가면 그 앞 단계까지 완료로 올리고 완료는 줄지 않는다                                                                                                                  | v3 `isSelectable` + `setSelectedKey`                                                                       |
| 자유 이동                            | 갈 수 있음 = 비활성이 아닌 모든 단계 (목록이 비활성 · 읽기 전용이면 없음). 완료 · 현재 판정과 「가면 앞 단계까지 완료」 는 선형과 같다 — 건너뛴 단계가 완료가 되고 뒤로 가도 줄지 않는다 | v3 에 없다 — 따로 적은 정답표 (`adr321StepListMoves.test.ts`)                                              |
| Do 「단계로 이동」                   | 순서를 따지지 않고 간다 (그 앞 단계까지 완료). 막는 것: 비활성 목록 · 비활성 단계 · 없는 key                                                                                             | v3 `state.setSelectedKey` (앱이 정하는 이동 — 비활성이 아닌 모든 단계에서 같은 쌍)                         |
| Do 「다음 단계」                     | 지금 단계를 완료로, 다음 단계를 현재로. 마지막 단계에서는 머문다 (실패가 아니다). 다음 단계가 비활성이면 가지 않고 이유를 낸다                                                           | `setSelectedKey(다음 key)` · 끝은 범위의 끝 (RAC 가 범위를 자르는 것과 같은 판단)                          |
| Do 「이전 단계」                     | 현재만 옮긴다. 첫 단계에서는 머문다                                                                                                                                                      | 같은 식                                                                                                    |
| Do 「단계 완료」                     | 지금 단계까지 완료. 이미 더 뒤까지 완료돼 있으면 그대로 (줄이지 않는다)                                                                                                                  | v3 `setLastCompletedStep(지금 단계)` — 지금 단계가 완료가 아닐 때 같은 쌍. v3 의 setter 는 줄일 수도 있다  |
| 읽기 전용 (`isReadOnly`)             | 누르기만 막는다 — Do 는 받는다                                                                                                                                                           | v3: `isReadOnly` 는 `isSelectable` 에만 있다. 「단계는 못 누르고 버튼으로 넘기는」 진행 표시가 이 모양이다 |
| 비활성 (`isDisabled`)                | 누르기도 Do 도 받지 않는다 (Do 는 이유를 보고)                                                                                                                                           | 다른 컴포넌트의 guard 와 같다 (`declaredRefusal`)                                                          |
| When                                 | 사용자의 누르기만 알린다 — 「완료 단계 변경」 먼저, 「단계 변경」 다음. Do 의 쓰기는 When 을 실행하지 않는다                                                                             | RAC 의 변경 callback · v3 `setSelectedKey` 의 순서                                                         |

### 5.3 StepList 의 모양 (design-data 토큰)

| 값                    | S   | M   | L   | XL  |
| --------------------- | --- | --- | --- | --- |
| 표식 크기 (px)        | 8   | 16  | 24  | 32  |
| 글자와 표식 간격 (px) | 4   | 6   | 6   | 6   |
| 라벨 글자 (px)        | 12  | 14  | 16  | 18  |

- 표식 테두리 2 px · 선 두께 2 px · 라벨 행간 1.3 (CJK 1.5).
- 색: 완료 = neutral subdued 배경, 현재 = neutral 배경, 강조의 완료 · 현재 = accent 배경, 남음 = neutral visual, 비활성 = disabled.
- S 크기는 숫자 · 체크 없이 점만 그린다 (지침: 숫자 · 체크는 M 이상).
- 선은 마지막 단계에 없다. 라벨이 길면 줄바꿈한다.
- 토큰이 비어 있는 값 (step 폭 · step 과 선의 간격) 은 Phase 1 에서 정했다 — 아래 「Phase 1 에서 정한 값」.

**토큰 표 고정 (Phase 0, MCP dataset 4.7.0 · desktop · light — `design-data-component-tokens steplist`, binding 85 건)**

| 값                         | design-data 토큰 (binding context)                                           | 값                             | 저장소 TokenRef                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 표식 크기 S · M · L · XL   | `steplist-visual-size-small` · `-medium` · `-large` · `-extra-large`         | 8 · 16 · 24 · 32 px            | 없음 — 리터럴 (분류 목록에 등재)                                                                            |
| 표식 테두리                | `border-width` scaleIndex 200 (Visual border)                                | 2 px                           | `{border.width.thick}`                                                                                      |
| 글자와 표식 간격           | `base-gap-small` · `-medium` · `-large` · `-extra-large`                     | 4 · 6 · 6 · 6 px               | S = `{spacing.xs}`. 6 은 없음 — spacing 단 밖. 글자 상대 형 `text-to-visual` (6/14 em) 은 M 에서만 같은 값  |
| 선 두께                    | `bar-thickness-extra-small` (Steplist track thickness)                       | 2 px                           | 없음 — 리터럴 (`{border.width.thick}` 과 값은 같지만 border 축)                                             |
| 라벨 글자 S · M · L · XL   | `font-size-75` · `-100` · `-200` · `-300`                                    | 12 · 14 · 16 · 18 px (터치 17) | `{typography.text-xs}` · `{typography.text-sm}` · `{typography.text-base}` · `{typography.text-lg}`         |
| 라벨 행간                  | `line-height-100` · `cjk-line-height-100`                                    | 1.3 · 1.5 (배수)               | 배수 형 없음 — 저장소 사다리 `--line-height` 는 16 · 18 · 20 · 22 px (1.3 배수는 15.6 · 18.2 · 20.8 · 23.4) |
| 라벨 서체 · 굵기           | `default-font-family` · `regular-font-weight`                                | 문서 서체 · 400                | 문서 기본 (선언하지 않는다 — text-font 규칙)                                                                |
| 라벨 색 완료 · 남음        | `neutral-subdued-content-color-default`                                      | gray 700 / 700                 | `{color.neutral-subdued}`                                                                                   |
| 라벨 색 현재               | `neutral-content-color-default`                                              | gray 800 / 800                 | `{color.neutral-content}`                                                                                   |
| 라벨 색 현재 (강조)        | `accent-content-color-default`                                               | accent 900 / 900               | `{color.accent-content}`                                                                                    |
| 라벨 색 비활성             | `disabled-content-color`                                                     | gray 400 / 400                 | `{color.disabled-content}`                                                                                  |
| 표식 색 완료               | `neutral-subdued-background-color-default` (hover `-hover`)                  | gray 700 / 500                 | 이름 없음 — 같은 값의 `{color.gray}` (tone 700 / 500, oracle 는 `gray-background-color-default`)            |
| 표식 색 현재               | `neutral-background-color-default`                                           | gray 800 / 800                 | `{color.neutral-fill}`                                                                                      |
| 표식 색 완료 · 현재 (강조) | `accent-background-color-default` (hover `-hover`)                           | accent 900 / 800               | `{color.accent}` (hover `{color.accent-hover}`)                                                             |
| 표식 색 남음               | `neutral-visual-color` (stepState 조건 없는 binding — 아래 「비어 있는 값」) | gray 500 / 600                 | 없음 — alias 추가 필요                                                                                      |
| 표식 색 비활성             | `disabled-background-color`                                                  | gray 100 / 100                 | `{color.disabled}`                                                                                          |
| 표식 안 글자 · 체크        | gray 25 · white (조건 없는 binding 둘)                                       | 흰색 (dark 의 gray 25 는 17)   | `{color.on-neutral}` (tone 25 / 25) · `{color.white}` — 어느 쪽인지 data 가 정하지 않는다                   |
| 선 색 완료                 | `neutral-subdued-background-color-default`                                   | gray 700 / 500                 | 위 표식 색 완료와 같다                                                                                      |
| 선 색 완료 (강조)          | `accent-visual-color`                                                        | accent 800 / 900               | 없음 — alias 추가 필요 (accent 축. `{color.informative-visual}` 은 status 축)                               |
| 선 색 현재 · 남음          | `neutral-visual-color`                                                       | gray 500 / 600                 | 없음 — 표식 색 남음과 같은 alias                                                                            |

- 색 열의 「a / b」 = light / dark 의 S2 색 단 (`colorAliases.ts` 의 `tone` · `accent` 인자와 같은 표기). 값 확인: light `neutral-subdued-background` rgb(80, 80, 80) · dark rgb(109, 109, 109), `neutral-visual` rgb(143, 143, 143) · dark rgb(138, 138, 138), `accent-visual` rgb(75, 117, 255) · dark rgb(86, 129, 255).
- **비어 있는 값 (binding 은 있고 토큰이 없다)**: step 의 폭 (`Width` — 크기 넷) · step 의 높이 (`Height` — 크기 넷) · step 과 선의 간격 (`Spacing (step to track)` — 크기 넷) · 라벨 글자 맞춤 (`Label (text adjustment)`). ADR HC7 이 적은 둘 (폭 · step 과 선의 간격) 에 높이 · 글자 맞춤 둘이 더 있다.
- **data 가 조건을 주지 않는 값 (우리 해석)**: 「남음」 표식의 색 — `stepState` 조건이 없는 표식 색 binding 이 여럿이다 (`neutral-visual-color` · `*-key-focus` 셋). 「남음 = neutral visual」 은 지침 문장과 선 색에서 읽은 해석이다. 표식 안 글자색 (gray 25 대 white) 도 같다. keyboard focus 색 (`*-key-focus`) 은 focus ring 으로 대신하므로 쓰지 않는다.
- Phase 1 에서 정할 것: 6 px 간격 (리터럴 대 `text-to-visual`) · 행간 (1.3 배수 대 저장소 사다리) · 색 alias 셋 (`neutral-visual` · `accent-visual` · 완료 표식의 이름) · 비어 있는 값 넷. → 아래.

**Phase 1 에서 정한 값 (2026-11-27 — `S/catalog/rule/stepList.ts`, 대조 기준 `S/catalog/__tests__/fixtures/adr321-design-data.json`)**

대조 기준은 설치본이 아니라 MCP dataset 4.7.0 의 steplist · rating 값을 굳힌 fixture 다 (머리말 `$source` 에 dataset 버전 · 조회 날짜 2026-11-27 — 메인 세션 판단: 설치본을 올리지 않는다). 게이트 `adr321StepListDesignData.static.test.ts` 가 rule 을 fixture 와 대조하고, fixture 와 다르게 둔 값은 그 테스트의 `SUBSTITUTED` 목록과 아래 표에 사유가 있어야 통과한다.

| 값                        | 정한 값                                                                                                                        | 근거                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| step 의 폭 (가로)         | 목록 폭을 단계 수로 고르게 나눈다 (`flex: 1 1 0`). 최소 = 표식 + 24 (S 32 · M 40 · L 48 · XL 56)                               | 토큰 없음. recipe 가 단계를 한 줄의 같은 몫으로 그린다. 최소는 선이 16 px 아래로 줄지 않게 (`trackGap × 2 + minTrack`) |
| step 의 높이              | 내용 높이 (글자 + 글자와 표식 간격 + 표식). 세로 방향의 최소 = 표식 + 24                                                       | 토큰 없음. 세로 최소는 가로 최소와 같은 식                                                                             |
| step 과 선의 간격         | 4 px (선의 양 끝이 표식에서 4 떨어진다)                                                                                        | 토큰 없음. S2 spacing 단의 가장 작은 간격 — S 크기의 글자와 표식 간격과 같은 값                                        |
| 글자 끝 여백              | 8 px (가로 = 단계의 오른쪽, 세로 = 아래)                                                                                       | 토큰 없음. 긴 라벨이 다음 단계의 라벨 · 표식에 닿지 않게                                                               |
| 라벨 글자 맞춤            | 가로: 맞춤 없음 (라벨 왼쪽 끝 = 표식 왼쪽 끝). 세로: 라벨 첫 줄과 표식의 세로 가운데를 맞춘다 (`\|행간 − 표식\| ÷ 2`)          | 토큰 없음 (`Label (text adjustment)`). 가로는 recipe 그대로. 세로는 recipe 에 그림이 없다 (`notVisual: orientation`)   |
| 목록의 교차축 맞춤 (가로) | `align-items: flex-end`                                                                                                        | recipe 는 start. 라벨 줄 수가 단계마다 달라도 표식 · 선이 한 줄에 놓여야 한다 (긴 라벨 줄바꿈 — §5.3)                  |
| 글자와 표식 간격 6 px     | 리터럴 (`componentRulesTable.static.test.ts` `INTENTIONAL_LITERAL` — `iconSize` 넷과 `iconGap` M · L · XL)                     | spacing 단에 6 이 없다. `text-to-visual` (6/14 em) 은 M 에서만 같은 값이라 쓰지 않는다                                 |
| 라벨 행간                 | 저장소 사다리 (`{typography.text-*--line-height}` — 16 · 18 · 20 · 22 px)                                                      | 배수 형 TokenRef 가 없다. design-data 1.3 배수와 1.5 px 안 (게이트가 검사)                                             |
| 설명 글자 (결정 4)        | 11 · 12 · 14 · 16 px (S · M · L · XL), 색 `{color.neutral-subdued}`, 비활성 `{color.disabled-content}`                         | design-data 에 없다 (사용자 답 「설명 한 줄만」). 라벨보다 한 단계 아래                                                |
| 표식 안 숫자 · 체크       | 크기 10 · 14 · 18 px (M · L · XL — 표식의 0.6 안팎), 숫자 굵기 700, 체크 = lucide `check` 선 두께 3. S 는 점만                 | design-data 에 값 없음. 지침: 숫자 · 체크는 M 이상                                                                     |
| 표식 안 글자색            | 채운 표식 `{color.on-neutral}` · 강조 `{color.on-accent}` · 남음 `{color.neutral-subdued}` · 비활성 `{color.disabled-content}` | data 가 조건을 주지 않는다 (gray 25 대 white) — gray 25 쪽 (`on-neutral`). 남음 표식은 채움이 없어 라벨 색             |
| 비활성 표식               | 완료 · 현재 = 채움 `{color.disabled}`, 남음 = 테두리 `{color.border-disabled}`, 선 `{color.disabled}`                          | `disabled-background-color` binding. 남음의 테두리 색은 data 에 조건이 없다                                            |

색 — 저장소에 같은 이름이 없는 셋은 새 테마 토큰을 만들지 않고 가장 가까운 기존 TokenRef 로 둔다 (메인 세션 판단):

| design-data                                                 | 저장소 TokenRef             | 차이                                                                          |
| ----------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| `neutral-subdued-background-color-default` (완료 표식 · 선) | `{color.gray}`              | 없음 (gray 700 / 500 — 같은 값)                                               |
| `neutral-visual-color` (남음 표식 테두리 · 현재 · 남음 선)  | `{color.field-placeholder}` | light 만 한 단 진하다 (gray 600 대 500), dark 같음                            |
| `accent-visual-color` (강조의 완료 선)                      | `{color.accent}`            | light · dark 모두 한 단 (accent 900 / 800 대 800 / 900) — 강조 표식과 같은 색 |

구조 (Phase 1): 목록의 상자는 RAC `Group` 이고 (사용자 답 2026-11-27 — 목록의 이름) 그 안 `ol.step-list-items` 가 Group 을 채우며 Group 의 flex 값 (rule 의 방향 블록 · 작성값 — `flex-direction` · `align-items` · `justify-content` · `gap` 을 `inherit`) 으로 단계를 배치한다 — Canvas 에서는 단계가 StepList record 의 직계 flex item 이다. 표식 · 선은 노드가 아니다 — Step 이 자기 padding 안에 그린다 (Toast 의 variant 아이콘과 같은 방식). 여백 · 자리 · 색은 `rule/stepList.ts` 의 함수 셋 (`catalogStepPadding` · `catalogStepChromeAnchors` · `catalogStepChromeColors`) 이 정본이고 두 consumer 가 같이 읽는다 — Canvas 는 파생 값 (`presence.ts` `_stepPad*` → `catalogBoxModel`) 과 도형 (`ruleShapes.ts` `catalogStepChromeShapes`), DOM 은 단계와 `span.step-visual` · `span.step-track` 의 inline 값 (`runtime/stepList.ts` `catalogStepDomStyle` · `catalogStepChromeDom`). 생성 CSS (`Step.css` · `StepList.css`) 는 바뀌지 않는 모양만 든다. 정답표 (`adr321StepList.test.ts` 의 px 표 · parity 의 `EXPECTED`) 는 이 함수를 부르지 않고 따로 적은 수다.

### 5.4 StepList 의 상태 연동

- 이름 붙인 상태: `selectedKey` (값 형 key) · `lastCompletedStep` (key).
  - Phase 2 확정 (`S/interactions/concepts/stepList.ts` — concept 둘 `stepSelection` · `stepCompletion`): When `onSelectionChange` · `onLastCompletedStepChange` (인자 `!event.key`), Do `nextStep` · `previousStep` · `goToStep` (값 = 단계 key) · `completeStep`. Do 는 prop 하나가 아니라 상태 규칙이 낸 쌍을 쓴다 (`CapabilityDef.step` → dispatcher 의 한 분기). 시작 상태는 `catalogStateSourceValue` 의 `selectedKey` · `lastCompletedStep` 이 규칙을 거친 값으로 낸다 (작성 값 → 규칙이 고른 단계).
- When: 「단계 변경」 · 「완료 단계 변경」.
- Do: 「다음 단계」 · 「이전 단계」 · 「단계로 이동」 (key) · 「단계 완료」 (지금 단계를 완료로).
- 폼 연결의 기본 모양: 패널 안의 Form 에 When 「Submit」 → Do 「단계 완료」 · 「다음 단계」.

### 5.5 Rating 의 노드 · prop

- `Rating` (팔레트 `forms` 범주 — Slider 와 같은 묶음). 부품: track (별 다섯) · thumb (focus 를 받는 숨은 조작자).
- prop: `value` · `defaultValue` · `isEmphasized` · `isDisabled` · `isReadOnly` · `size` (S · M) · (결정 5) `label` · `name`.
- `isReadOnly` 가 켜지면 Meter 로 그린다 (결정 7) — `minValue` 0 · `maxValue` 별 개수 · `valueLabel` = 「{별 개수}점 만점에 {값}점」 (i18n 문구, 값은 유효값).
- **유효값** — 순수 함수 하나 (`runtime/rating.ts`). 입력 모드: 0 ~ 별 개수로 자르고 정수로 맞춘다 (RAC Slider 의 단계 맞춤과 같은 반올림). 표시 모드: 0 ~ 별 개수로 자르고 0.5 단위로 맞춘다. 숫자가 아닌 값 = 0.
- 유효값을 읽는 곳: DOM renderer (Slider · Meter 의 `value`) · Canvas 의 별 채움 · 값 쓰기 (Do 「값 넣기」 와 이름 붙인 상태로의 미러 — `S/catalog/runtime/catalogPreviewInteractions.ts:1212` · `:1616`, 정규화 함수 `S/state/implicitState.ts:94`) · 폼 값. 넣은 수를 그대로 읽는 곳을 남기지 않는다.
- 맞추는 자리는 `valueCommitNumber` 를 쓰는 type 의 공용 자리다 — type 이 맞춤 함수를 주면 미러와 값 쓰기가 그 함수를 지난다. Slider 는 자기 `minValue` · `maxValue` · `step` 으로 맞춘다 (`S/catalog/runtime/presence.ts:1947` `catalogSliderRange`).

### 5.6 Rating 의 모양 (design-data 토큰)

| 값                | S   | M   |
| ----------------- | --- | --- |
| 별 아이콘 (px)    | 16  | 18  |
| 전체 폭 (px)      | 104 | 128 |
| 세로 padding (px) | 4   | 7   |
| radius (px)       | 7   | 8   |

- 별 간격 4 px · focus ring 2 px + 간격 2 px. 색은 neutral content (강조는 accent content, 비활성은 disabled content).
- 채움: 값 이하의 별 = 채운 별, 0.5 = 반쪽 별 (표시 전용), 그 뒤 = 빈 별.

**토큰 표 고정 (Phase 0, MCP dataset 4.7.0 · desktop · light — `design-data-component-tokens rating`, binding 22 건)**

| 값                     | design-data 토큰 (binding context)                              | 값                      | 저장소 TokenRef                                                                           |
| ---------------------- | --------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| 별 아이콘 S · M        | `workflow-icon-small` · `-medium` (Layout)                      | 16 · 18 px (터치 24)    | `{size.icon.S}` · `{size.icon.M}` (터치 벌은 S2 배율 1.25 — 22.5, design-data 24 와 다름) |
| 전체 폭 S · M          | `rating-width-small` · `-medium`                                | 104 · 128 px            | 없음 — 리터럴. 아래 「어긋나는 값」                                                       |
| 전체 높이 S · M        | 토큰 없음 (`Height` binding 만)                                 | —                       | 아이콘 + 세로 padding × 2 = 24 · 32 = `{size.height.S}` · `{size.height.M}`               |
| 세로 padding S · M     | `base-padding-vertical-small` · `-medium`                       | 4 · 7 px                | S = `{spacing.xs}`. M 의 7 은 (32 − 18) ÷ 2 — control 가운데 맞춤 값                      |
| radius S · M           | `corner-radius-medium-size-small` · `-medium`                   | 7 · 8 px                | M = `{radius.md}`. S 의 7 은 없음 (radius 단 2 · 4 · 8 · 10)                              |
| 별 간격                | `spacing` scaleIndex 75 (Spacing (icon to icon))                | 4 px                    | `{spacing.xs}`                                                                            |
| focus ring 두께 · 간격 | `focus-indicator thickness` · `focus-ring-gap`                  | 2 · 2 px                | `{focus.ring.default}` (2 px · offset 2 px)                                               |
| 별 색                  | `neutral-content-color-default` (hover `-hover` · down `-down`) | gray 800 (hover 900)    | `{color.neutral-content}` · `{color.neutral-content-hover}` (down 은 hover 와 같은 값)    |
| 별 색 (강조)           | `accent-content-color-default` (hover `-hover` · down `-down`)  | accent 900 (hover 1000) | `{color.accent-content}` · `{color.accent-content-hover}`                                 |
| 별 색 비활성           | `disabled-content-color`                                        | gray 400                | `{color.disabled-content}`                                                                |

- **비어 있는 값**: 전체 높이 (S · M).
- **어긋나는 값**: 전체 폭 토큰 (104 · 128) 이 `별 5 + 간격 4` (16 × 5 + 4 × 4 = 96 · 18 × 5 + 4 × 4 = 106) 와 다르다 — S 는 8, M 은 22 px 남는다. anatomyReview 는 폭을 「legacy width records」 라고 적는다. 별의 자리 (slot) 를 어느 쪽으로 정하는지가 §5.7 의 track 배치 (Phase 0 P2) 를 정한다 — Phase 4 에서 정해 분류 목록에 적는다 (R4). Phase 0 시제품은 `slot = 별 + 간격` (M 22 · S 20 px) 으로 쟀다.
- **채운 별의 도형**: 아이콘 세트의 `star` · `star-half` 는 lucide 의 선 아이콘이다 (`packages/rendering/src/icons/lucideIconData.generated.ts:1753` · `:1748` — `filled` 표시 없음. `star-half` 는 왼쪽 반의 윤곽선이다). 채운 별과 반쪽 채움은 Phase 4 가 정한다 — 같은 경로를 칠로 그리거나 S2 의 `StarFilled` (설치본 `@react-spectrum/s2/icons/StarFilled`) 를 `spectrumIcons.ts` 에 더하고, 반쪽은 채운 별을 반 폭으로 자른다 (Canvas clip · DOM `clip-path`).

### 5.7 Rating 의 조작

- 별 누르기 = Slider 의 track 누르기. track 의 배치로 「누른 별 = 그 별의 값」 이 되게 한다 (Phase 0 시제품 P2).
- **track 배치 (Phase 0 P2 로 확정)**: `slot = 별 + 간격` 일 때 track 상자는 **폭 = slot × 5, 왼쪽 끝 = 별 줄의 왼쪽에서 `slot ÷ 2 + 간격 ÷ 2` 만큼 왼쪽** 이다 (M: 폭 110 · −13 px, S: 폭 100 · −12 px). 별 i 의 가운데가 track 의 `i ÷ 5` 자리에 놓여 별 i 의 어느 점도 `round` 뒤 i 가 된다. 별은 track 의 자식으로 오른쪽 반 칸을 넘쳐 그린다 — 넘친 자리의 누르기도 track 으로 올라가 5 로 잘린다. track 상자를 별 줄과 같게 두면 (대조군) 15 점 중 8 점만 맞는다.
- 별 줄 밖 왼쪽 반 칸: track 이 포인터를 받으면 그 자리의 누르기가 0 (지우기) 이 된다. track 의 `pointer-events` 를 끄고 slot 만 받게 하면 그 자리는 눌리지 않는다 (15 점은 그대로 15 / 15). 어느 쪽으로 둘지는 Phase 5 에서 정한다 (design-data 에 없는 포인터 지우기).
- thumb 은 값 0 에서 track 의 왼쪽 끝 (별 줄 밖) 에 놓인다 — thumb 은 보이지 않게 두고 focus ring 은 Rating 상자에 그린다.
- 화살표 = 한 칸. 0 까지 내려가면 지워진 상태다.
- hover 미리보기 = CSS 의 형제 선택자로 hover 한 별까지 채워 그린다 (값은 바뀌지 않는다).
- 값 연동: Slider 의 concept (`valueCommitNumber` — When 「변경」 · 「변경 끝」, Do 「값 넣기」). 값은 §5.5 의 유효값이다 — 「값 넣기 2.5」 는 입력 모드에서 3 을 쓴다.

### 5.8 Canvas

- StepList: 시작 단계 · 시작 완료 값의 정지 모양 (표식 · 선 · 라벨). 고른 단계의 패널만 그린다 (Tabs 와 같은 방식).
- Rating: 시작 값의 별 채움.

## 6. Phase

| Phase | 내용                                                                                                                            | Gate |
| :---: | ------------------------------------------------------------------------------------------------------------------------------- | :--: |
|   0   | 코드 사실 재대조 · design-data 스키마와 토큰 표 고정 · 시제품 2 · 번들 기준선                                                   |  G0  |
|   1   | StepList · Step 등록 (binding · rule · template · traits · nesting · d2Provenance 의 `design-data` 값) · Canvas 정적 · contract |  G1  |
|   2   | StepList 동작 — 상태 규칙 · Link 조립 · 이름 붙인 상태 2 · When 2 · Do 4                                                        |  G2  |
|   3   | StepPanel (결정 2) — 짝 명령 · 고른 단계의 패널 · Form 연결 live                                                                |  G3  |
|   4   | Rating 등록 · Canvas 정적 · 반쪽 별                                                                                             |  G4  |
|   5   | Rating 동작 — Slider 조립 · 표시 전용 · 값 연동 · 폼 필드 (결정 5)                                                              |  G5  |
|   6   | 번들 · 종결 live · 문서 (규칙 · CHANGELOG)                                                                                      |  G6  |

## 7. Phase 0 시제품

| ID  | 확인할 것                                                                                                               | go 기준                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | `ol > li > Link` 조립 — Chrome 접근성 트리에 list · listitem · link 와 `current: step` · disabled, Tab 순서, Enter 활성 | 트리의 속성이 v3 hook 이 내는 것과 같다. VoiceOver 는 사용자                                                                                                |
| P2  | Slider 위의 별 다섯 — 각 별의 왼쪽 · 가운데 · 오른쪽 15 점을 눌러 값이 그 별의 번호인지, 화살표로 0 까지, 낭독되는 값   | 15 점 전부 일치 · 0 도달 · 접근성 트리에 slider 와 값. 같이 기록: 값 2.5 · 6 을 준 Slider 의 range input 값과 Meter 의 `aria-valuetext` (`valueLabel` 유무) |

## 8. 파일 (Phase 0 확정) · Phase 결과

선례의 등록 지점을 센 결과다 — Tabs · Tab · TabPanel · Breadcrumbs · Breadcrumb · Slider · Meter 의 type 이름이 문자열 · 객체 키로 나오는 소스 파일 107 개 (테스트 · 생성 CSS 포함) 와, 가장 최근에 더한 type 인 Resizable 의 구현 커밋 (`0048b7900`) 이 건드린 소스 43 개를 겹쳐 StepList · Step · StepPanel · Rating 이 닿는 곳을 골랐다.

| 자리               | 파일                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 등록 (shared)      | 새 `S/catalog/bindings/StepList.binding.ts` · `Step.binding.ts` · `Rating.binding.ts` · `bindings/index.ts` · `catalog/componentCatalog.ts` · `catalog/generated/componentRulesTable.ts` · `catalog/document/generated/reusableOriginLibrary.ts` · `document/d2Provenance.ts` (:16 출처 값 `design-data`) · `document/types.ts` (:207 contract 80 → 81) · `domain/componentTraits.ts` · `document/collectionItems.ts` (`COLLECTION_TYPE_TABLE` 한 줄 — Step 과 짝 StepPanel) · `document/ruleDefinition.ts` (:428 짝 key `itemId`) · `document/sizePropagation.ts` · `document/rulePartRules.ts` · `nesting/nestingRules.ts` · `nesting/requiredParts.ts` (Rating 의 부품을 노드로 둘 때) · `document/formContext.ts` (:51 — 결정 5) |
| 생성 산출 (shared) | `S/components/styles/generated/StepList.css` · `Step.css` · `StepPanel.css` · `Rating.css` (`pnpm build:specs`) · `components/styles/index.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 실행 (shared)      | 새 `S/catalog/runtime/stepList.ts` (상태 규칙) · `stepList.components.tsx` · `rating.ts` (유효값) · `rating.components.tsx` · `runtime/delegatedDom.runtime.ts` (선례 tabs :2477 · breadcrumbs :2882 · slider :3527 · meter :3674) · `runtime/presence.ts` (파생 값 — 단계 상태 · 별 채움 · 고른 패널) · `runtime/catalogPreviewInteractions.ts` (미러 :1212 · :1616 · `setRuntimeProps` :1579) · `S/state/implicitState.ts` (:94 미러 정규화 — 맞춤 자리 후보) · `catalog/resolution/resolver.ts` (고른 패널 · 짝 — Tabs 8 곳) · `runtime/compositionRoot.ts` · `runtime/valueBindings.ts` (값이 데이터에서 올 때) · `S/codeView/generate.ts` (:406 짝 key)                                                                         |
| 상태 연동 (shared) | 새 `S/interactions/concepts/stepList.ts` · `interactions/componentInteractionSpecs.ts` (:243 Slider · :491 prop 표) · `interactions/concepts/valueCommit.ts` (유효값 맞춤) · `catalog/commands/collections.ts` (:305 짝 · :483 항목 넣기) · `commands/rowTemplate.ts` (:182 · :314 짝 반복) · `commands/structure.ts`                                                                                                                                                                                                                                                                                                                                                                                                                |
| Canvas (rendering) | `packages/rendering/src/renderers/buildCatalogShapes.ts` · `renderers/skiaPrimitives.ts` (표식 · 반쪽 별) · `primitives/colorAliases.ts` (새 alias — §5.3) · `icons/spectrumIcons.ts` (S2 `StarFilled` 를 더할 때)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| builder            | `apps/builder/src/builder/catalogRuntime/ruleShapes.ts` · `itemInsert.ts` (:560-596 Step + StepPanel 넣기) · `singleSelection.ts` (:372 key 개명과 짝) · `workspace.ts` (:985) · `componentsPage.ts` · `panels/components/paletteItems.ts` · `panels/properties/ariaLabelNeed.ts` · `panels/navigator/catalog/CatalogLayerIcon.tsx` · `i18n/messages/en-US.ts` · `ko-KR.ts` · `i18n/labels.ts`                                                                                                                                                                                                                                                                                                                                       |
| 테스트             | 상태 규칙 정답표 + v3 hook 대조 (unit) · 유효값 정답표 · 등록 게이트 (`phase4ePalette` · `phase3G3Census` · `d2S2Alignment.static.test.ts` · `componentRulesTable.static.test.ts` 분류 목록) · HC2 정적 검사 · parity fixture (browser) · live 하니스                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

- `StepPanel.binding.ts` 는 두지 않는다 — 선례 TabPanel 은 binding 파일 없이 rule · traits · `ruleDefinition.ts` 의 key 표로 등록돼 있다 (`bindings/` 에 `Tabs` · `TabList` · `Tab` 뿐).
- 닿지 않는 곳: `catalog/generated/racSlotProviders.ts` · `racStateKeys.ts` · `racSlotContract.ts` · `runtime/racSlotScope.tsx` (설치 RAC 의 부품에서 생성한 표 — StepList · Rating 은 RAC 부품이 아니다). `components/metadata.ts` · `apps/builder/src/types/builder/unified.types.ts` · `factories/constants.ts` · `types/composition-vocabulary.ts` 는 선례 type 이 남아 있지만 Resizable 등록은 건드리지 않았다.
- 확정: shared 28 ~ 32 (새 파일 8 포함) · builder 11 · rendering 3 ~ 4 파일 + 생성 CSS 4 + 테스트. 추정 (shared 14 ~ 18 · builder 5 ~ 8 · rendering 1 ~ 2) 의 1.6 배 안팎이다 — 짝 (StepPanel) 이 닿는 곳 (`collectionItems` · `ruleDefinition` · `resolver` · `rowTemplate` · `itemInsert` · `singleSelection` · `codeView`) 과 색 alias 가 추정에 없었다.

### Phase 0 (G0 재료) — 2026-11-27

HEAD `f4a9c4b51` (ADR-324 · 325 구현 위, 격리 worktree). 실행 = `node apps/builder/scripts/adr321-phase0-prototypes.mjs <out>` — 시제품 `adr321Prototypes.mjs` (설치된 RAC 1.22.1 위의 조립) 와 대조 목록 `adr321V3StepListReference.mjs` (v3 private hook 을 그대로 그린 `ol > li > a` — 시제품은 import 하지 않는다) 를 production lib build 해 빈 페이지에 올린다. 측정 조건: Chrome 158.0.8127.37 (Playwright `channel: chrome`) · headed · viewport 1280 × 800 · DPR 1 · `visibilityState` visible · `hasFocus` true · locale ko-KR · `--force-renderer-accessibility` · 포인터와 키는 CDP 입력 (`page.mouse` · `page.keyboard`). 같은 스크립트의 headless 실행도 결과가 같다 (출력 43 줄 모두 PASS). WebKit 은 재지 않았다 (G2). 번들 기준선은 메인 세션이 잰다. 결과 원본은 로컬 scratchpad (커밋하지 않음).

**코드 사실 재대조 (F1 ~ F12)**

| 사실 | 지금 자리                                                                                                                                                                            | 판정                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1   | `react-aria-components/dist/types/exports/index.d.ts` · `@react-spectrum/s2/exports/index.ts` — `steplist` · `rating` 0 건 (같은 검색으로 `Slider` 는 걸린다)                        | 그대로                                                                                                                                                                         |
| F2   | 설치 `@adobe/spectrum-design-data` 3.9.1 `components/steplist.json` · `rating.json` · MCP dataset 4.7.0                                                                              | **달라짐** — 두 스키마는 있지만 `variant` · `size` · 최상위 `isDisabled` · `anatomyReview` (steplist) 와 `size` (rating) 는 MCP 4.7.0 에만 있다. 토큰 binding 도 MCP 에만 (§1) |
| F3   | `RA/dist/private/steplist/useStepList.mjs` · `useStepListItem.mjs:26-32` · `RS/dist/private/steplist/useStepListState.mjs:31-70`, npm `@react-spectrum/steplist` 3.0.0-alpha.25      | 그대로                                                                                                                                                                         |
| F4   | `RA/dist/types/src/link/useLink.d.ts:9`                                                                                                                                              | 그대로                                                                                                                                                                         |
| F5   | `react-aria-components/dist/types/src/Slider.d.ts` — `readonly` 0 건 · `isDisabled` :37 · `RadioGroup.d.ts` `isReadOnly` :69                                                         | 그대로                                                                                                                                                                         |
| F6   | `S/catalog/commands/collections.ts:305` · `S/interactions/concepts/singleSelection.ts:81-101` · `delegatedDom.runtime.ts:2882` · `:3527` · `:3674` · `concepts/valueCommit.ts:25-45` | 그대로 (네 파일 모두 `0ea8c33d8` 뒤 변경 0)                                                                                                                                    |
| F7   | `S/catalog/document/d2Provenance.ts:16`                                                                                                                                              | 그대로                                                                                                                                                                         |
| F8   | `packages/rendering/src/icons/lucideIconData.generated.ts` — `check` :371 · `star-half` :1748 · `star` :1753                                                                         | 그대로 — 단 셋 다 선 아이콘이다 (§5.6 「채운 별의 도형」)                                                                                                                      |
| F9   | `S/interactions/concepts/form.ts:15-31`                                                                                                                                              | 그대로                                                                                                                                                                         |
| F10  | `S/catalog/document/types.ts:207`                                                                                                                                                    | **달라짐** — `LIBRARY_CONTRACT_VERSION` 80 (ADR-324 가 79 → 80). 이 ADR 의 contract 는 81 부터. 번들 여유는 메인 세션의 기준선으로 바꾼다                                      |
| F11  | `S/catalog/runtime/catalogPreviewInteractions.ts:1212` (관찰 미러) · `:1616` (`setRuntimeProps` 의 미러) · 정규화 `S/state/implicitState.ts:94-108`                                  | 줄만 이동 (:1151 → :1212 · :1555 → :1616, ADR-324 · 325 구현이 +61 줄). 본문 그대로 — 숫자는 `typeof raw === "number" ? raw : Number(raw) \|\| 0` 로 넣은 수를 그대로 쓴다     |
| F12  | `S/catalog/runtime/delegatedDom.runtime.ts:3693` (`valueLabel: opt(props.valueLabel)`, meter renderer :3674)                                                                         | 그대로. 낭독 값 「50%」 는 아래 P2 에서 실제 DOM · 접근성 트리로 다시 쟀다                                                                                                     |

- 인용 정밀도 (본문 Risks): R2 의 `useSliderThumb.mjs:63-78` 은 PageUp · PageDown · Home · End 의 키 처리다. track 누르기의 반올림은 `RA/dist/private/slider/useSlider.mjs:73-84` (`onDownTrack`) 와 `RS/dist/private/slider/useSliderState.mjs:129-135` (`getRoundedValue` · `getPercentValue`) 에 있다.
- breakdown 의 팔레트 범주 이름을 실제 것으로 고쳤다 — `navigation` → `layout` · `inputs` → `forms` (`paletteItems.ts:131-140`).

**design-data 고정** — 스키마 둘은 §1 의 출처 버전, 토큰 표는 §5.3 · §5.6.

**시제품**

| 시제품                 | 결과                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 판정 초안                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| P1 StepList Link 조립  | 22 / 22 (기록만 하는 줄 3 제외). fixture 넷 (선형 · `disabledKeys` · 현재 = 마지막 완료 · 선택 없음) 의 단계마다 `role` · `aria-current` · `aria-disabled` · `tabindex` 가 따로 적은 정답표와 같고 v3 hook 대조 목록과도 같다 (요소만 `span` 대 `a`). Chrome 내부 접근성 트리: `list > listItem × 5 > link`, 현재 단계에만 `ariaCurrentState=step`, 갈 수 없는 단계에 `restriction=disabled`, 갈 수 있는 단계만 `focusable`. macOS 접근성 객체: `AXLink AXARIACurrent='step'` · 갈 수 없는 단계 `AXEnabled=0`. Tab 순서 s1 → s2 → s3 → 뒤 요소 (갈 수 없는 단계는 건너뜀 — v3 대조 목록과 같다). Enter = 그 단계가 현재, Space = 활성 없음, 갈 수 없는 단계의 포인터 누르기 = 변화 없음, 「단계 완료 · 다음 단계」 뒤 다음 단계가 현재가 되고 그다음 단계만 갈 수 없다 | go — 속성 · 트리 · Tab · Enter 가 v3 와 같다. 목록 이름은 사용자 결정 (아래 발견 2)  |
| P2 Rating 의 별 누르기 | 17 / 17 (대조군 2 포함). shifted 배치 (§5.7) = M · S 모두 15 / 15, slot 만 포인터를 받는 변형도 15 / 15. 대조군 (track 상자 = 별 줄) = 8 / 15 (별의 왼쪽 점은 모두 한 칸 아래 값, 별 1 · 2 의 가운데도 아래 값). 끌기 별 1 → 별 4 = 1 → 2 → 2 → 3 → 3 → 4 → 4. 화살표 오른쪽 6 번 = 1 · 2 · 3 · 4 · 5 · 5, 왼쪽 6 번 = 4 · 3 · 2 · 1 · 0 · 0, 위 · 아래 · End · Home · PageUp · PageDown 도 정답표와 같다 (0 도달). 접근성 트리: `group "평점" > slider "평점"` 값 3 · 최소 0 · 최대 5 (macOS `AXSlider AXValue=3 AXMinValue=0 AXMaxValue=5`)                                                                                                                                                                                                                          | go — 배치 조건 (§5.7) 아래 15 / 15. 별의 자리 폭은 Phase 4 에서 정한다 (아래 발견 3) |

- 같이 기록 (F11 · F12): 값 2.5 · 6 · −1 을 준 Slider (0 ~ 5 · step 1) 의 range input 값 = 3 · 5 · 0 (`aria-valuetext` 같은 값, thumb 자리 60 % · 100 % · 0 %) — 제어 (`value`) · 비제어 (`defaultValue`) 모두. Meter (0 ~ 5, 값 2.5) 의 `aria-valuetext` = `valueLabel` 없을 때 「50%」 · 있을 때 「5점 만점에 2.5점」 — DOM 속성 · Chrome 내부 트리 (`ariaValueText`) · macOS 객체 (`AXValueDescription`) 셋이 같다.
- 채점의 유효성: 단계 규칙을 일부러 틀리게 바꾼 시제품 (`index − 1 ≤ last` → `index − 2 ≤ last`) 은 P1 에서 14 건이 실패한다. P2 는 대조군 배치가 8 / 15 로 실패한다.
- **접근성 트리를 읽는 길**: CDP `Accessibility.getFullAXTree` 는 `aria-current` 를 내지 않고 meter 의 `valuetext` 를 빈 글자로 낸다 (slider 는 값을 낸다). 그래서 `chrome://accessibility` 의 Chrome 내부 트리와 macOS 접근성 객체 덤프를 읽었다. G2 · G5 의 접근성 트리 대조도 CDP 속성이 아니라 이 길 (또는 DOM 속성) 을 쓴다.
- 조립의 관찰: link 의 이름은 표식 숫자 · 라벨 · 상태 문구를 이은 글자다 (「3 결제 현재」 — 완료 단계는 숫자 대신 체크라서 「배송지 완료」). 보이지 않는 상태 문구는 macOS 트리에서 link 아래 `AXGroup` 하나로 나온다. Space 는 link 를 활성하지 않고 막지도 않아 긴 문서에서는 페이지가 스크롤된다 (브라우저의 link 기본 동작과 같다).
- VoiceOver 청취는 사용자다 (G6) — `node apps/builder/scripts/adr321-phase0-prototypes.mjs <out> --serve` 가 내는 주소의 `#auto`.

**설계와 어긋나는 발견**

1. **design-data 의 출처** (Context F2 · HC7 · D2 정본 순서 2 번) — 설치본 3.9.1 로는 StepList 의 `size` · `variant` 와 두 컴포넌트의 토큰 표를 대조할 수 없다. 길은 둘이다: 설치본을 4.7 이상으로 올린다 (ADR-302 색 oracle fixture 를 같이 다시 굳혀야 한다) / MCP 4.7.0 의 스키마 · binding 을 fixture JSON 으로 굳혀 게이트가 읽는다. Phase 1 착수 때 정한다. → **fixture 로 정했다** (메인 세션 판단 — §5.3).
2. **목록의 이름** (Decision 2 · HC2 · R1) — v3 의 `ol` 은 `aria-label` 을 갖는다 (`useStepList.mjs:39`). 조립의 `ol` 은 RAC 부품이 아니어서 예외 0 조건에서는 이름이 없다. 길은 셋이다: 이름 없이 둔다 (목록 의미 · 단계 수 낭독은 남는다) / 이름을 받는 RAC 부품으로 감싼다 (RAC `Group` + `aria-label` — `group > list` 로 한 겹 는다) / `ol` 의 `aria-label` 한 속성을 D1 예외로 둔다 (결정 지점 3 — SSOT 경계). Phase 2 전에 사용자에게 묻는다. → **답: RAC Group 으로 감싸기** (2026-11-27 — §4).
3. **별의 자리 폭** (HC7 · R2 · R4) — 폭 토큰 104 · 128 이 `별 5 + 간격 4` (96 · 106) 와 맞지 않는다 (§5.6). track 배치는 slot 폭에서 나오므로 Phase 4 가 폭을 정할 때 같이 정해진다. 어느 쪽이든 §5.7 의 식 (폭 = slot × 5 · 왼쪽으로 반 칸) 은 같다.
4. **채운 별 · 반쪽 별의 도형** (Decision 6 · F8 · G4) — 아이콘 세트의 별은 선 아이콘이다 (§5.6).
5. **색 alias** (HC7) — `neutral-visual` · `accent-visual` 과 완료 표식의 이름이 저장소에 없다 (§5.3). 테마 색은 accent · tone 두 축에서만 낸다는 결정 (2026-11-07) 안에서 alias 를 더한다. → **StepList 는 alias 를 더하지 않았다** — 가장 가까운 기존 TokenRef (§5.3 색 표, 메인 세션 판단).
6. **표식 색 「남음」 과 표식 안 글자색** (HC7) — data 가 조건을 주지 않아 우리 해석이다 (§5.3).

**Phase 1 에 넘기는 것**: contract 는 81 부터 (착수 때 `LIBRARY_CONTRACT_VERSION` 을 다시 본다 — ADR-320 이 같은 번호를 쓸 수 있다) · 사용자 결정 1 · 4 · 위 발견 1.

### Phase 0 닫힘 (G0) — 2026-11-27

G0 는 P1 · P2 go 로 닫았다 (메인 세션 판정 — 위 시제품 표). 사용자 답 (2026-11-27): 결정 1 = v3 이름 · 결정 4 = 설명 한 줄만 · 목록의 이름 = RAC Group 으로 감싸기 (발견 2) · 결정 8 = 권고대로 (Builder +3,000 · Preview +2,000 B, Builder 절대 상한 1,660,000 B 재승인 — ADR-320 과 공용). 메인 세션 판단: design-data 대조 기준 = MCP dataset 4.7.0 을 굳힌 fixture (발견 1), 색은 새 토큰 없이 기존 TokenRef (발견 5). 번들 기준선 (`f4a9c4b51`, 일반 `vite build` → `adr209-bundle-closure.mjs`): Builder initial JS gzip 1,643,618 B · Preview 172,277 B.

### Phase 1 (G1) — 2026-11-27

HEAD `f4a9c4b51` 위 worktree 커밋 `3718e2423`. contract 80 → **81** (main 병합 때 **83** — ADR-320 이 82 를 먼저 냈다) (`LIBRARY_CONTRACT_VERSION` — StepList · Step 의 정의 · 원본 둘을 더했다. 문서 변환 코드 0).

**한 일**

- 등록: binding 둘 (`StepList` · `Step` — `bindings/StepList.binding.ts`), rule 둘 (`rule/stepList.ts`), 원본 둘 (`document/stepListOrigins.ts` — `component-steplist` 는 단계 셋 · 현재 2 · 완료 1 로 놓인다), traits (`StepList` = collection, `Step` = `staticCollectionItem`), `COLLECTION_TYPE_TABLE` 한 줄 (`insert` 만 — 반복 · 선택 · 코드 항목 없음), size 전파 (`StepList → Step`), 팔레트 (`layout` 범주, Breadcrumbs 뒤), `d2Provenance.ts` 의 출처 값 `design-data`, i18n 라벨 둘.
- 상태 규칙 (§5.2 의 선형 규칙, 순수 함수 `runtime/stepList.ts` `catalogStepListStates`) 과 파생 값 (`presence.ts` — 단계마다 `_stepState` · `_stepNumber` · `_stepLast` · `_stepOrientation` · `_stepEmphasized` · `_stepDisabled` · `_stepSize` · `_stepPad*`). 목록 · 단계 편집 뒤 다시 유도할 대상 (`catalogDerivedPropsDependents` — 단계와 그 글자).
- Canvas: 상자 (`boxModel.ts` 가 `_stepPad*` 를 작성값 아래에서 읽는다) · 배치 (`compositionRoot.ts` `styleOf` ← `catalogStepListLayout`) · 도형 (`ruleShapes.ts` `catalogStepChromeShapes` — 원 · 테두리 · 숫자 · 체크 · 선) · 글자 색 (파생 `color`).
- DOM (정적 모양까지): RAC `Group` (언어별 기본 이름) `> ol.step-list-items > li.react-aria-Step`, 단계 안 글자 뒤에 `span.step-visual` (숫자는 `span.step-glyph`, 완료는 `check` 글리프) · `span.step-track`. 자리 · 색 · 여백은 inline (`catalogStepDomStyle` · `catalogStepChromeDom`). Link · `aria-current` · 상태 문구 · 이동은 Phase 2.

**파일 (실제)** — §8 표의 Phase 1 몫과 다른 곳만 적는다.

- 새 파일 (shared): `bindings/StepList.binding.ts` (Step binding 도 여기 — `Step.binding.ts` 를 따로 두지 않았다) · `rule/stepList.ts` · `document/stepListOrigins.ts` · `runtime/stepList.ts` · `runtime/stepList.components.tsx` · 생성 CSS `Step.css` · `StepList.css` · fixture `__tests__/fixtures/adr321-design-data.json`.
- 고친 파일 (shared): `bindings/index.ts` · `componentCatalog.ts` · `generated/componentRulesTable.ts` · `document/generated/reusableOriginLibrary.ts` · `document/types.ts` · `document/d2Provenance.ts` · `document/collectionItems.ts` · `document/sizePropagation.ts` · `domain/componentTraits.ts` · `runtime/presence.ts` · `runtime/boxModel.ts` · `runtime/compositionRoot.ts` · `runtime/delegatedDom.runtime.ts` · `runtime/domBinding.runtime.ts` · `codeView/generate.ts` (`CODE_VIEW_ITEMS_HOSTS` 를 반복 행 type 으로 한정) · `components/styles/index.css`.
- 고친 파일 (builder): `catalogRuntime/ruleShapes.ts` · `panels/components/paletteItems.ts` · `i18n/labels.ts` · `i18n/messages/en-US.ts` · `ko-KR.ts`.
- 표에 있었지만 Phase 1 에서 닿지 않은 곳: `document/ruleDefinition.ts` · `rulePartRules.ts` · `nesting/*` (Step 의 자리는 traits `owners` 가 정한다) · rendering 패키지 (도형은 기존 primitive — circle · rect · text · icon_font — 로 그린다, 색 alias 를 더하지 않았다) · `itemInsert.ts` (항목 「+」 는 `COLLECTION_TYPE_TABLE` 의 `insert` 로 선다) · `CatalogLayerIcon.tsx` · `ariaLabelNeed.ts` (작성 이름은 Phase 2).
- 테스트: 새 `runtime/__tests__/adr321StepList.test.ts` (상태 규칙 정답표 · 여백 · 자리 · 색) · `__tests__/adr321StepListDesignData.static.test.ts` (rule = fixture) · builder `catalogRuntime/__tests__/adr321StepListWiring.test.tsx` (실제 workspace) · `tests/adr248-g3/adr321StepListParity.browser.test.ts` (Canvas ↔ Chrome) · `scripts/adr321-g1-live.mjs` (실제 builder). 고친 게이트: contract 리터럴 80 → 81 (테스트 44 곳) · `adr310CollectionTypeTable.static.test.ts` · `generatedCssLoadInventory.static.test.ts` · `componentRulesTable.static.test.ts` (`INTENTIONAL_LITERAL`) · `componentTraits.test.ts` · `phase3G3Census.test.tsx` (195 → 197) · `orientationDrivenTags.test.ts` · `paletteOracle.ts`.

**G1 결과**

| 조건                                                                                                                                                       | 결과                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 등록 게이트 (`pnpm codex:preflight` — guard · format · typecheck · registration · css-boundary · chart-contract · agent-catalog · skills gate · rule-size) | rule-size 를 뺀 단계 통과 — guard · format · typecheck · registration (7 / 7) · css-boundary (52 / 52) · chart-contract (1,012) · agent-catalog · skills gate (관련 변경 없음). rule-size 는 HEAD `f4a9c4b51` 에서도 실패한다 (`.claude/rules/canvas-rendering.md` 55,244 > 55,100 B · `panel-structure.md` 39,913 > 39,624 B — 이 작업은 두 파일을 건드리지 않았다)                                                                              |
| `d2S2Alignment.static.test.ts` (S2 에 없는 키는 `d2Provenance.ts` 에) · `d3S2Alignment` · `componentRulesTable.static.test.ts` 분류 목록                   | 통과 (아래 builder · shared 전체 실행에 포함)                                                                                                                                                                                                                                                                                                                                                                                                     |
| contract                                                                                                                                                   | 81 — `LIBRARY_CONTRACT_VERSION` 과 테스트의 리터럴이 같다                                                                                                                                                                                                                                                                                                                                                                                         |
| fixture 의 Canvas rect = Chrome rect ±1 px                                                                                                                 | 25 / 25 (방향 둘 × 크기 넷 · 단계 수 2 · 5 · 9 · 강조 · 긴 라벨 줄바꿈 · 설명 유무 · 비활성 셋 · 시작 값 없음 · 목록에 작성한 상자 값 둘 · 증분 셋). 최대 차 0.02 px (아래 표)                                                                                                                                                                                                                                                                    |
| `/cross-check`                                                                                                                                             | 변경 경로 대조 (rule · 원본 template → 생성 CSS · DOM runtime · Canvas 상자 · 도형) + 위 하니스 + 실제 builder 의 Canvas 화면 픽셀 대 Publish (아래 live). 픽셀 대조는 표식 · 선 자리의 색 표본이다 (pixelmatch 전체 비교가 아니다)                                                                                                                                                                                                               |
| live (실제 builder — `adr321-g1-live.mjs`, dev 서버 5174 · Playwright Chrome headless · 줌 85 %)                                                           | 19 / 19 — 팔레트에서 StepList 를 놓음 (단계 셋 = 완료 · 현재 · 남음) · 다섯 상태 (기본 가로 M · XL 강조 · 세로 L · 설명과 긴 라벨 · 현재 3 번째와 첫 단계 비활성) 에서 record 상자 = Publish 상자 ±1 px, Canvas 화면 픽셀 = Publish 의 표식 · 선 색, 글자 색 · Publish 의 목록 = RAC Group (`role="group"` · 이름 「단계 목록」) `> ol > li` 이고 `ol` · `li` 에 role · aria 속성 0 · Design 패널 「+」 로 4 단계 → undo 로 3 단계 · page error 0 |
| `pnpm type-check`                                                                                                                                          | 통과                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| shared 전체 (`pnpm -F @composition/shared test`)                                                                                                           | 273 파일 통과 (1 건너뜀) · 2,911 통과 (18 건너뜀)                                                                                                                                                                                                                                                                                                                                                                                                 |
| builder 단위 전체 (`vitest run --project unit`)                                                                                                            | 1,195 파일 통과 (7 건너뜀) · 9,981 통과 (예상 실패 1 · 건너뜀 14) — `d2S2Alignment` · `phase4ePalette` · `phase3G3Census` 포함                                                                                                                                                                                                                                                                                                                    |
| 원복 RED (bash 스크립트 + trap 복원 + `cmp`)                                                                                                               | 변이 10 모두 게이트가 실패 · 파일 9 바이트 복원 확인 (아래 표)                                                                                                                                                                                                                                                                                                                                                                                    |

원복 RED — 변이 하나를 넣고 세 게이트 (단위 = shared `adr321StepList.test.ts` · `adr321StepListDesignData.static.test.ts`, wiring = `adr321StepListWiring.test.tsx`, Canvas ↔ Chrome = parity) 를 돌린 실패 수:

| 변이 | 바꾼 것                                                                               | 단위 (실패 수) | wiring | Canvas ↔ Chrome |
| ---- | ------------------------------------------------------------------------------------- | -------------- | ------ | --------------- |
| m1   | step 과 선의 간격 4 → 6 (두 consumer 가 같이 읽는 값)                                 | 5              | 0      | 7               |
| m2   | 두 consumer: 가로 단계의 아래 여백에서 글자와 표식 간격을 뺀다 (정답표가 잡아야 한다) | 1              | 1      | 3               |
| m3   | DOM 만: 단계의 inline 아래 여백을 6 줄인다                                            | 0              | 0      | 16              |
| m4   | 목록 편집의 dependents (단계 · 글자 다시 유도) 를 끈다                                | 0              | 2      | 0               |
| m5   | Canvas 만: 상자가 단계의 아래 여백 (표식 자리) 을 읽지 않는다                         | 0              | 0      | 16              |
| m6   | 단계 글자의 상태 색을 싣지 않는다                                                     | 0              | 4      | 0               |
| m7   | 상태 규칙: 지나온 단계 완료를 뺀다                                                    | 2              | 1      | 0               |
| m8   | DOM 이 마지막 단계에도 선을 그린다                                                    | 0              | 1      | 25              |
| m9   | Canvas 가 표식 · 선을 그리지 않는다                                                   | 0              | 0      | 25              |
| m10  | DOM 만: 목록 (RAC Group) 에 작성한 gap 이 안쪽 ol 에 닿지 않는다                      | 0              | 0      | 2               |

- parity 가 못 잡는 변이 (m4 · m6 · m7 — 두 consumer 가 같이 틀리거나 색 · 편집 뒤 상태) 는 wiring · 단위가 잡는다. 한 consumer 만 틀리는 변이 (m3 · m5 · m8 · m9 · m10) 는 parity 가 잡는다.

**Canvas rect = Chrome rect** (browser 하니스 — Playwright Chrome channel · headless · viewport 1440 × 900 · DPR 1 · en-US · Pretendard. 단위 px, 단계와 표식 · 선은 왼쪽 위 기준. 「최대 차」 = 그 fixture 의 모든 record 상자 · 표식 · 선에서 Chrome 과 Canvas 의 가장 큰 차)

| fixture                      | 목록 상자 w · h (Chrome / Canvas) | 단계 2 의 상자 x · y · w · h (Chrome / Canvas)    | 표식 (단계 안, Chrome / Canvas)     | 선 (단계 안, Chrome / Canvas)             | 최대 차 px |
| ---------------------------- | --------------------------------- | ------------------------------------------------- | ----------------------------------- | ----------------------------------------- | ---------- |
| `horizontal-S-5`             | 720 · 28 / 720 · 28               | 144 · 0 · 144 · 28 / 144 · 0 · 144 · 28           | 0 · 20 · 8 · 8 / 0 · 20 · 8 · 8     | 12 · 23 · 128 · 2 / 12 · 23 · 128 · 2     | 0.01       |
| `vertical-S-5`               | 240 · 160 / 240 · 160             | 0 · 32 · 240 · 32 / 0 · 32 · 240 · 32             | 0 · 4 · 8 · 8 / 0 · 4 · 8 · 8       | 3 · 16 · 2 · 16 / 3 · 16 · 2 · 16         | 0.01       |
| `horizontal-M-5`             | 720 · 40 / 720 · 40               | 144 · 0 · 144 · 40 / 144 · 0 · 144 · 40           | 0 · 24 · 16 · 16 / 0 · 24 · 16 · 16 | 20 · 31 · 120 · 2 / 20 · 31 · 120 · 2     | 0.02       |
| `vertical-M-5`               | 240 · 200 / 240 · 200             | 0 · 40 · 240 · 40 / 0 · 40 · 240 · 40             | 0 · 1 · 16 · 16 / 0 · 1 · 16 · 16   | 7 · 21 · 2 · 16 / 7 · 21 · 2 · 16         | 0.02       |
| `horizontal-L-5`             | 720 · 50 / 720 · 50               | 144 · 0 · 144 · 50 / 144 · 0 · 144 · 50           | 0 · 26 · 24 · 24 / 0 · 26 · 24 · 24 | 28 · 37 · 112 · 2 / 28 · 37 · 112 · 2     | 0.01       |
| `vertical-L-5`               | 240 · 240 / 240 · 240             | 0 · 48 · 240 · 48 / 0 · 48 · 240 · 48             | 0 · 0 · 24 · 24 / 0 · 0 · 24 · 24   | 11 · 28 · 2 · 16 / 11 · 28 · 2 · 16       | 0.01       |
| `horizontal-XL-5`            | 720 · 60 / 720 · 60               | 144 · 0 · 144 · 60 / 144 · 0 · 144 · 60           | 0 · 28 · 32 · 32 / 0 · 28 · 32 · 32 | 36 · 43 · 104 · 2 / 36 · 43 · 104 · 2     | 0.02       |
| `vertical-XL-5`              | 240 · 280 / 240 · 280             | 0 · 56 · 240 · 56 / 0 · 56 · 240 · 56             | 0 · 0 · 32 · 32 / 0 · 0 · 32 · 32   | 15 · 36 · 2 · 16 / 15 · 36 · 2 · 16       | 0.02       |
| `horizontal-M-2`             | 320 · 40 / 320 · 40               | 160 · 0 · 160 · 40 / 160 · 0 · 160 · 40           | 0 · 24 · 16 · 16 / 0 · 24 · 16 · 16 | 없음 / 없음                               | 0.00       |
| `horizontal-M-9`             | 1080 · 40 / 1080 · 40             | 120 · 0 · 120 · 40 / 120 · 0 · 120 · 40           | 0 · 24 · 16 · 16 / 0 · 24 · 16 · 16 | 20 · 31 · 96 · 2 / 20 · 31 · 96 · 2       | 0.02       |
| `vertical-M-9`               | 240 · 360 / 240 · 360             | 0 · 40 · 240 · 40 / 0 · 40 · 240 · 40             | 0 · 1 · 16 · 16 / 0 · 1 · 16 · 16   | 7 · 21 · 2 · 16 / 7 · 21 · 2 · 16         | 0.02       |
| `horizontal-M-emphasized`    | 720 · 40 / 720 · 40               | 144 · 0 · 144 · 40 / 144 · 0 · 144 · 40           | 0 · 24 · 16 · 16 / 0 · 24 · 16 · 16 | 20 · 31 · 120 · 2 / 20 · 31 · 120 · 2     | 0.02       |
| `vertical-L-emphasized`      | 240 · 240 / 240 · 240             | 0 · 48 · 240 · 48 / 0 · 48 · 240 · 48             | 0 · 0 · 24 · 24 / 0 · 0 · 24 · 24   | 11 · 28 · 2 · 16 / 11 · 28 · 2 · 16       | 0.01       |
| `horizontal-M-long-labels`   | 560 · 112 / 560 · 112             | 112 · 72 · 112 · 40 / 112 · 72 · 112 · 40         | 0 · 24 · 16 · 16 / 0 · 24 · 16 · 16 | 20 · 31 · 88 · 2 / 20 · 31 · 88 · 2       | 0.01       |
| `vertical-M-long-labels`     | 180 · 244 / 180 · 244             | 0 · 62 · 180 · 40 / 0 · 62 · 180 · 40             | 0 · 1 · 16 · 16 / 0 · 1 · 16 · 16   | 7 · 21 · 2 · 16 / 7 · 21 · 2 · 16         | 0.01       |
| `horizontal-M-descriptions`  | 720 · 55.4 / 720 · 55.4           | 180 · 15.4 · 180 · 40 / 180 · 15.4 · 180 · 40     | 0 · 24 · 16 · 16 / 0 · 24 · 16 · 16 | 20 · 31 · 156 · 2 / 20 · 31 · 156 · 2     | 0.02       |
| `vertical-XL-descriptions`   | 280 · 224 / 280 · 224             | 0 · 56 · 280 · 56 / 0 · 56 · 280 · 56             | 0 · 0 · 32 · 32 / 0 · 0 · 32 · 32   | 15 · 36 · 2 · 16 / 15 · 36 · 2 · 16       | 0.02       |
| `horizontal-M-list-disabled` | 720 · 40 / 720 · 40               | 144 · 0 · 144 · 40 / 144 · 0 · 144 · 40           | 0 · 24 · 16 · 16 / 0 · 24 · 16 · 16 | 20 · 31 · 120 · 2 / 20 · 31 · 120 · 2     | 0.02       |
| `horizontal-M-step-disabled` | 720 · 40 / 720 · 40               | 144 · 0 · 144 · 40 / 144 · 0 · 144 · 40           | 0 · 24 · 16 · 16 / 0 · 24 · 16 · 16 | 20 · 31 · 120 · 2 / 20 · 31 · 120 · 2     | 0.02       |
| `horizontal-M-no-start`      | 480 · 40 / 480 · 40               | 160 · 0 · 160 · 40 / 160 · 0 · 160 · 40           | 0 · 24 · 16 · 16 / 0 · 24 · 16 · 16 | 20 · 31 · 136 · 2 / 20 · 31 · 136 · 2     | 0.02       |
| `horizontal-M-authored-box`  | 720 · 120 / 720 · 120             | 152.4 · 70 · 130.4 · 40 / 152.4 · 70 · 130.4 · 40 | 0 · 24 · 16 · 16 / 0 · 24 · 16 · 16 | 20 · 31 · 106.4 · 2 / 20 · 31 · 106.4 · 2 | 0.02       |
| `vertical-M-authored-box`    | 240 · 400 / 240 · 400             | 10 · 62 · 220 · 40 / 10 · 62 · 220 · 40           | 0 · 1 · 16 · 16 / 0 · 1 · 16 · 16   | 7 · 21 · 2 · 16 / 7 · 21 · 2 · 16         | 0.02       |
| `incremental-keys`           | 720 · 40 / 720 · 40               | 144 · 0 · 144 · 40 / 144 · 0 · 144 · 40           | 0 · 24 · 16 · 16 / 0 · 24 · 16 · 16 | 20 · 31 · 120 · 2 / 20 · 31 · 120 · 2     | 0.02       |
| `incremental-orientation`    | 320 · 160 / 320 · 160             | 0 · 40 · 320 · 40 / 0 · 40 · 320 · 40             | 0 · 1 · 16 · 16 / 0 · 1 · 16 · 16   | 7 · 21 · 2 · 16 / 7 · 21 · 2 · 16         | 0.02       |
| `incremental-size-emphasis`  | 720 · 60 / 720 · 60               | 144 · 0 · 144 · 60 / 144 · 0 · 144 · 60           | 0 · 28 · 32 · 32 / 0 · 28 · 32 · 32 | 36 · 43 · 104 · 2 / 36 · 43 · 104 · 2     | 0.02       |

- 색 · 글자: 같은 하니스가 표식의 채움 · 테두리 · 선의 색과 글자의 크기 · 굵기 · 색을 두 쪽에서 같이 읽어 같은지 본다 (차이 0).
- Chrome 단독 대 정답표 (`EXPECTED` — rule 의 글에서 따로 적은 px, 함수 출력이 아니다): 가로 M · XL, 세로 S · M · XL (설명), 작성 상자 둘 — 0.5 px 안.

**번들** (`vite build` → `adr209-bundle-closure.mjs`, 기준선과 같은 방법)

| 대상                    | 기준선 (`f4a9c4b51`) | Phase 1 뒤  | Δ        | 결정 8                             | 절대 상한                                       |
| ----------------------- | -------------------- | ----------- | -------- | ---------------------------------- | ----------------------------------------------- |
| Builder initial JS gzip | 1,643,618 B          | 1,647,247 B | +3,629 B | +3,000 (두 컴포넌트 합) — **넘음** | 1,660,000 (남은 여유 12,753 B, ADR-320 과 공용) |
| Preview initial JS gzip | 172,277 B            | 172,276 B   | −1 B     | +2,000                             | 327,000                                         |

- **결정 8 을 넘는다 — 보고 대상.** StepList 의 등록 · 상태 규칙 · 정적 renderer 만으로 Builder +3,629 B 다. 결정 8 의 +3,000 은 두 컴포넌트 (StepList · Rating) 의 합이고 Phase 2 (Link 조립 · 상태 연동) · 3 (StepPanel) · 4 · 5 (Rating) 가 남아 있다.
- 줄인 것: 상태 · 방향 · 크기별 CSS 선택자를 inline 값으로 (rule 모듈 gzip 2,320 → 1,810 B — 모듈 단독 minify · gzip 추정) · 팔레트 아이콘을 이미 번들에 있는 것으로. 처음 잰 값은 +3,714 B 였다.
- lazy 로 뺄 수 있는 것이 없다: rule · binding · 원본 · 파생 값 (`presence.ts`) · Canvas 도형은 Builder 첫 화면이 읽는 표이고, DOM runtime (`delegatedDom.runtime`) 도 Builder 의 initial chunk 다. Preview 의 initial 은 catalog 를 싣지 않아 Δ 가 없다.
- 모듈 단독 추정 (esbuild minify + gzip — 번들 안에서는 더 작다): `rule/stepList.ts` 약 1.8 KB · `runtime/stepList.ts` 약 1.3 KB · binding 0.5 KB · 원본 0.5 KB · Group 컴포넌트 0.3 KB · 나머지 (파생 값 · 도형 · renderer · 등록 · 라벨).

**설계와 달라진 것**

1. 표식 · 선은 노드가 아니다 — Step 이 자기 padding 안에 그린다 (Toast 의 아이콘 방식). §8 표의 「rendering 패키지의 새 primitive」 는 쓰지 않았다.
2. 목록의 교차축 맞춤은 `flex-end` 다 (recipe 는 start) — 긴 라벨이 줄바꿈해도 표식 · 선이 한 줄에 놓인다 (§5.3).
3. 색 alias 를 더하지 않았다 (메인 세션 판단) — 대체한 둘은 design-data 와 한 단 다르다 (§5.3 색 표). 게이트의 `SUBSTITUTED` 목록이 그 차이를 고정한다.
4. Step 은 `staticCollectionItem` 이다 — 놓은 단계에 자동 HTML id 가 붙지 않고 key 는 `id` prop 이다 (Tab 과 같다).
5. Styles 패널의 Direction 토글은 StepList 에서 `orientation` 을 쓴다 — `ORIENTATION_DRIVEN_TAGS` 는 rule 의 `containerVariants.orientation` 과 binding 의 `orientation` 을 둘 다 가진 type 에서 유도된다. 맞는 동작이라 (flex-direction 만 바꾸면 단계의 여백 · 표식 자리가 따라오지 않는다) 목록 테스트에 더했다. 그래서 목록의 세로 방향은 DOM 이 rule 의 그 블록에서, Canvas 가 `catalogStepListLayout` 에서 읽는다 (`containerVariants` 는 등록한 type 만 Canvas 에 닿는다).
6. `CODE_VIEW_ITEMS_HOSTS` 를 반복 행 type (`row.repeat`) 으로 한정했다 — `COLLECTION_TYPE_TABLE` 의 모든 행을 items host 로 읽고 있어 StepList 가 `items` 배열 host 로 잡혔다.
7. 단계의 여백 · 표식과 선의 자리 · 색은 DOM 에서 생성 CSS 가 아니라 inline 이다. 처음에는 rule 의 상태 · 방향 · 크기 선택자로 냈는데 (약 30 블록) rule 모듈만 gzip 2.3 KB 였다 — 같은 함수의 값을 inline 으로 내면 선택자가 넷으로 줄고 두 consumer 가 같은 함수를 읽는다. 두 arm 은 여전히 따로 깨진다 (원복 RED m3 · m5 · m8 · m9 · m10).
8. 팔레트 아이콘은 이미 번들에 있는 `ListIcon` 이다 (`ListOrdered` 를 새로 싣지 않는다).

**Phase 2 에 넘기는 것**

- Group 의 작성 이름 (`aria-label` 칸 · `ariaLabelNeed.ts`) · 단계의 RAC `Link` (`aria-current="step"` · `isDisabled`) · 상태 문구 · 상태 규칙의 이동 (지나온 단계 완료 쓰기) · 자유 이동 (결정 3) · 이름 붙인 상태 2 · When 2 · Do 4 · HC2 정적 검사 · v3 hook 대조 (Phase 0 의 `adr321V3StepListReference.mjs`).
- Link 가 단계의 글자와 표식을 감싸면 단계 안 구조가 바뀐다 (`li > Link > 글자 + 표식`) — parity fixture 와 `EXPECTED` 는 상자 값이라 그대로 기준이 된다.
- Code 보기: StepList 의 코드 모양은 정하지 않았다 (지금은 일반 컬렉션 경로).
- contract: ADR-320 이 Phase 2 에서 82 를 쓴다 — 321 Phase 2 가 문서 계약을 더하면 번호를 맞춘다.

### Phase 2 (G2) — 2026-11-27

HEAD `f4a9c4b51` 위 worktree 커밋 `3718e2423` (Phase 1 과 같은 커밋). contract 는 **81 그대로** (main 병합 때 83) — Phase 2 가 더한 것 (목록의 스위치 `allowsFreeNavigation` · 상태 concept 둘) 은 더하기뿐이고 81 은 따로 나간 적이 없다 (`LIBRARY_CONTRACT_VERSION` 주석에 기록). ADR-318 Phase 5 (Panel 의 size 상태 · When) 도 번호를 올리지 않았다. 문서 변환 코드 0.

**한 일**

- 상태 규칙을 import 없는 순수 모듈로 나눴다 (`runtime/stepListState.ts`): 상태 (`catalogStepListStates` — 정규화한 마지막 완료 단계도 낸다) · 누르기 (`catalogStepListPress`) · Do 넷 (`catalogStepListDo`) · 자유 이동 (§5.2 「Phase 2 확정」 표).
- DOM 조립 (`runtime/stepList.components.tsx`): RAC `Group` (작성 이름 → `aria-label` prop, 없으면 언어별 기본) `> ol > li > RAC Link` (`aria-current="step"` · `isDisabled` · `onPress`). Link 안에 글자 · 상태 문구 (react-aria `VisuallyHidden` — 「현재 · 완료 · 남음」, 언어 넷) · 표식, `li` 에 선. Link 는 `li` 의 flex 값을 `inherit` 으로 받아 글자가 record 의 직계 flex item 처럼 놓인다 (rule `.step-link`). 키보드 focus ring 은 rule 의 `[data-focus-visible]` (다른 컨트롤의 focus ring 변수).
- 실행 상태: 목록의 두 key 는 record 의 실행 값이다 (`catalogRuntimeStateOf` — 시작 값은 `catalogStateSourceValue` 가 상태 규칙을 거쳐 낸다). 목록 컴포넌트가 지금 상태로 규칙을 다시 읽어 단계마다 상태를 context 로 주고, 누르기는 규칙이 낸 쌍을 `setRuntimeProps` 로 쓴 뒤 목록의 When 을 알린다.
- 글자 색: 단계의 라벨 · 설명 Text 는 DOM 에서 단계 요소의 색을 따른다 (`color: inherit` · `var(--step-description-color)` — `domBinding.runtime.ts`). 정지 색을 Text 에 inline 으로 두면 누르기로 현재 단계가 바뀌어도 색이 남는다 (ToggleButton 글자와 같은 이유). Canvas Text 는 record 의 파생 색 그대로다.
- 상태 연동: concept 둘 (`interactions/concepts/stepList.ts`) → 등록표의 When 2 · Do 4 · 이름 붙인 상태 2 (유도). Do 는 `CapabilityDef.step` 으로 dispatcher 의 한 분기를 지나 상태 규칙이 낸 쌍을 쓴다. 규칙 실행이 읽는 단계 key 는 `catalogCollectionItemKeys` 의 StepList 분기 (`presence.ts` `catalogStepListInput` — 파생 값 · DOM · 규칙 실행이 같이 읽는 입력 하나).
- Design 패널: 「Free navigation」 스위치 (`allowsFreeNavigation`), 목록의 접근 이름 칸 (`ariaLabelNeed.ts`). i18n: 스위치 · When 2 · Do 4 · 값 이름 · When 묶음 이름 둘 (en · ko).

**파일**

- 새 파일 (shared): `catalog/runtime/stepListState.ts` · `interactions/concepts/stepList.ts`. 테스트 `catalog/runtime/__tests__/adr321StepListMoves.test.ts` (이동 정답표 — 선형 · 자유 이동 · Do) · `adr321D1Assembly.static.test.ts` (HC2 정적 검사) · `interactions/__tests__/adr321StepList.test.ts` (등록표 · dispatcher).
- 새 파일 (builder): `catalogRuntime/__tests__/adr321StepListV3.test.tsx` · `__tests__/support/adr321V3StepList.tsx` (v3 private hook 을 테스트의 대조 기준으로만 읽는다) · `preview/catalog/__tests__/adr321StepListRun.test.tsx` (실행 Preview 전 경로) · `scripts/adr321-g2-live.mjs`.
- 고친 파일 (shared): `catalog/runtime/{stepList,stepList.components,presence,delegatedDom.runtime,domBinding.runtime}.ts(x)` · `catalog/rule/stepList.ts` · `catalog/bindings/StepList.binding.ts` · `catalog/document/{d2Provenance,types}.ts` · `interactions/{dispatcher,capabilityRegistry,deriveRegistry,componentInteractionSpecs}.ts` · `interactions/concepts/types.ts` · 생성 CSS `Step.css`.
- 고친 파일 (builder): `panels/properties/ariaLabelNeed.ts` · `i18n/{labels,types,messages/en-US,messages/ko-KR}.ts`.
- 고친 게이트: `adr321StepListWiring.test.tsx` (Link 구조 · v3 속성 대조) · `adr321StepListParity.browser.test.ts` · `adr321-g1-live.mjs` (표식 선택자) · `interactionWhenReach.test.tsx` (When 두 행 — 실제 누르기) · `capabilityBindingReach.test.ts` (Do 도달 근거 파일) · `capabilityLabelKeys.static.test.ts` (등록표 70 → 71 type).
- §8 표에 있었지만 닿지 않은 곳: `catalogPreviewInteractions.ts` · `implicitState.ts` (이름 붙인 상태 · 미러는 concept 에서 유도돼 손대지 않았다) · `resolver.ts` · `valueBindings.ts` · `commands/*`. 메인 세션이 고치는 파일은 건드리지 않았다.

**G2 결과**

| 조건 (G2)                                                              | 결과                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 상태 규칙 = v3 hook = 정답표 (선형)                                    | 설치된 `react-stately` 의 `useStepListState` 를 jsdom 에서 실제로 돌려 대조: 시작 값 324 가지 (지금 단계 6 × 완료 6 × 비활성 key 3 × 목록 상태 3) 에서 지금 단계 · 완료 · 갈 수 있는 단계가 같고, `setSelectedKey` 뒤의 쌍 (비활성이 아닌 모든 단계로) · `setLastCompletedStep(지금 단계)` 뒤의 쌍이 같다 — 차이 0. 따로 적은 정답표 (`adr321StepList.test.ts` · `adr321StepListMoves.test.ts`) 도 통과                                                       |
| 자유 이동 = 정답표                                                     | `adr321StepListMoves.test.ts` — 갈 수 있는 단계 다섯 경우 (선형 대 자유) · 누르기 · 비활성 · 읽기 전용                                                                                                                                                                                                                                                                                                                                                        |
| 조립이 낸 속성 = v3 hook 의 속성                                       | 시작 값 여섯 (기본 · 첫 단계 · 모두 완료 · 비활성 key · 비활성 목록 · 읽기 전용) 에서 제품 DOM 의 Link 와 v3 `useStepListItem` 의 `role` · `aria-current` · `aria-disabled` · `tabindex` 가 같다 (`adr321StepListWiring.test.tsx` — 서로 다른 속성 조합 5 이상). 따로 적은 정답표 (기본 · live) 와도 같다                                                                                                                                                     |
| D1 예외 0 (HC2)                                                        | `adr321D1Assembly.static.test.ts` — 조립 코드의 ARIA 이름은 RAC prop 둘 (`aria-label` on Group · `aria-current` on Link) 뿐, `role` · 키 handler · `setAttribute` · `tabIndex` · private hook import 0. DOM: `ol` · `li` · 표식 · 선에 role · aria 속성 0                                                                                                                                                                                                     |
| Do 4 · When 2 · 이름 붙인 상태 2                                       | 등록표 (`interactions/__tests__/adr321StepList.test.ts`) · 실행 Preview 전 경로 (`adr321StepListRun.test.tsx` 9 건 — 팔레트의 StepList · 규칙 · 변수 · Button 넷으로 누르기 · Do · When · 자유 이동 · 읽기 전용 · 비활성 목록 · 비활성 단계 · 작성 시작 값) · When 도달 행렬 (`interactionWhenReach.test.tsx` 의 두 행)                                                                                                                                       |
| 키보드 전 경로                                                         | live: Tab 이 갈 수 있는 단계만 차례로 지나 다음 요소로 (focus ring 2 px) · Enter 로 그 단계가 현재 · Space 는 옮기지 않는다                                                                                                                                                                                                                                                                                                                                   |
| Chrome 과 WebKit live (`adr321-g2-live.mjs`, dev 서버 5174 · headless) | Chrome 12 / 12 · WebKit 12 / 12 — 실제 builder 에서 StepList 를 놓고 이름 · 변수 · 이름 붙인 상태 · 규칙 · Button 넷을 만든 뒤 Publish 에서: 첫 화면 (Group 이름 = 작성 이름, 속성 = 정답표) · 키보드 · 포인터 (갈 수 없는 단계는 그대로) · Do 여섯 번의 자취 (상태는 따르고 When 은 실행되지 않음) · 「단계 완료」 뒤 다음 단계 누르기 · 자유 이동 (When 「완료 단계 변경」) · Design 패널의 스위치와 이름 칸 · Interactions 패널의 When 이름 · page error 0 |
| 정적 모양 회귀 (G1)                                                    | Canvas ↔ Chrome 대조 25 / 25 (Link 구조에서도 rect · 색 그대로) · `adr321-g1-live.mjs` 19 / 19                                                                                                                                                                                                                                                                                                                                                                |
| `pnpm type-check`                                                      | 통과                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| shared 전체                                                            | 276 파일 통과 (1 건너뜀) · 2,940 통과 (18 건너뜀)                                                                                                                                                                                                                                                                                                                                                                                                             |
| builder 단위 전체                                                      | 1,197 파일 통과 (7 건너뜀) · 9,996 통과 (예상 실패 1 · 건너뜀 14). 그 앞의 실행 한 번은 `adr284Authoring` · `adr315GroupWindow` 의 두 건이 5 초 시간 초과로 실패했다 (연쇄 포함 7 건) — 두 파일 단독 24 / 24 통과, 다시 돌린 전체에서 통과 (부하 때의 시간 초과로 본다)                                                                                                                                                                                       |
| `pnpm codex:preflight`                                                 | rule-size 를 뺀 단계 통과 — guard · format · typecheck · registration (7 / 7) · css-boundary (52 / 52) · chart-contract (1,012) · agent-catalog. rule-size 는 Phase 1 때와 같이 HEAD 에서도 실패한다 (`.claude/rules/canvas-rendering.md` · `panel-structure.md` — 이 작업은 건드리지 않았다)                                                                                                                                                                 |
| 원복 RED                                                               | 변이 25 모두 실패 · 복원 확인 (아래)                                                                                                                                                                                                                                                                                                                                                                                                                          |

**원복 RED** (bash 스크립트 + trap 복원 + `cmp` — 변이 하나를 넣고 세 묶음을 돌린 실패 수. 단위 = shared 의 상태 규칙 · 이동 · design-data · D1 정적 · 등록표와 dispatcher, 조립 = builder 의 wiring · v3 대조 · 실행 Preview, 대조 = Canvas ↔ Chrome)

| 변이 | 바꾼 것                                                                        | 단위 | 조립 | 대조 |
| ---- | ------------------------------------------------------------------------------ | ---- | ---- | ---- |
| p1   | 선형 규칙: 「바로 앞이 완료된 단계」 를 갈 수 없게 한다                        | 9    | 11   | 0    |
| p2   | 자유 이동 스위치를 읽지 않는다                                                 | 4    | 1    | 0    |
| p3   | 이동할 때 지나온 단계를 완료로 올리지 않는다                                   | 6    | 3    | 0    |
| p4   | 비활성 목록이 Do 를 받는다                                                     | 2    | 1    | 0    |
| p5   | DOM: 현재 단계의 Link 에 aria-current 를 넘기지 않는다                         | 0    | 11   | 0    |
| p6   | DOM: 갈 수 없는 단계의 Link 를 비활성으로 두지 않는다                          | 0    | 8    | 0    |
| p7   | DOM: 누르기가 When 「완료 단계 변경」 을 알리지 않는다                         | 0    | 1    | 0    |
| p8   | DOM: 상태 문구 (현재 · 완료 · 남음) 를 넣지 않는다                             | 0    | 1    | 0    |
| p9   | DOM: 누르기가 실행 상태를 쓰지 않는다                                          | 0    | 3    | 0    |
| p10  | 시작 상태: 마친 단계의 시작 값 (defaultLastCompletedStep) 을 읽지 않는다       | 0    | 2    | 0    |
| p11  | 시작 상태: 지금 단계의 시작 값 (defaultSelectedKey) 을 읽지 않는다             | 0    | 1    | 0    |
| p12  | 규칙 실행이 목록의 단계 key 를 받지 못한다                                     | 0    | 5    | 0    |
| p13  | dispatcher: 이동 Do 가 상태 규칙을 거치지 않는다 (prop 하나만 쓴다)            | 6    | 4    | 0    |
| p14  | DOM: 단계 글자가 단계 요소의 색을 따르지 않는다 (정지 색이 inline 으로 남는다) | 0    | 1    | 0    |
| p15  | DOM 만: 단계의 Link 가 li 의 방향을 따르지 않는다 (글자가 가로로 놓인다)       | 0    | 0    | 2    |
| m1   | step 과 선의 간격 4 → 6 (두 consumer 가 같이 읽는 값)                          | 5    | 0    | 7    |
| m2   | 두 consumer: 가로 단계의 아래 여백에서 글자와 표식 간격을 뺀다                 | 1    | 1    | 3    |
| m3   | DOM 만: 단계의 inline 아래 여백을 6 줄인다                                     | 0    | 0    | 16   |
| m4   | 목록 편집의 dependents (단계 · 글자 다시 유도) 를 끈다                         | 0    | 2    | 1    |
| m5   | Canvas 만: 상자가 단계의 아래 여백 (표식 자리) 을 읽지 않는다                  | 0    | 0    | 16   |
| m6   | Canvas: 단계 글자의 상태 색을 싣지 않는다                                      | 0    | 4    | 25   |
| m7   | 상태 규칙: 지나온 단계 완료 (읽을 때의 정규화) 를 뺀다                         | 3    | 3    | 0    |
| m8   | DOM 이 마지막 단계에도 선을 그린다                                             | 0    | 1    | 25   |
| m9   | Canvas 가 표식 · 선을 그리지 않는다                                            | 0    | 0    | 25   |
| m10  | DOM 만: 목록 (RAC Group) 에 작성한 gap 이 안쪽 ol 에 닿지 않는다               | 0    | 0    | 2    |

- 변이 25 (Phase 2 의 p1 ~ p15 · Phase 1 의 m1 ~ m10 을 지금 코드에서 다시) 모두 한 묶음 이상이 실패하고, 파일 13 의 바이트 복원을 `cmp` 로 확인했다.

**번들** (`vite build` → `adr209-bundle-closure.mjs`, 기준선과 같은 방법)

| 대상                    | 기준선 (`f4a9c4b51`) | Phase 1 뒤  | Phase 2 뒤  | Phase 2 의 Δ | 기준선 대비 | 결정 8 (두 컴포넌트 전체)  |
| ----------------------- | -------------------- | ----------- | ----------- | ------------ | ----------- | -------------------------- |
| Builder initial JS gzip | 1,643,618 B          | 1,647,247 B | 1,648,837 B | +1,590 B     | +5,219 B    | +7,000 — 남은 여유 1,781 B |
| Preview initial JS gzip | 172,277 B            | 172,276 B   | 172,276 B   | +0 B         | −1 B        | +2,000                     |

- Builder 절대 상한 1,660,000 B 까지 11,163 B (ADR-320 과 공용 — 이 worktree 는 ADR-320 의 변경을 싣지 않는다).
- 남은 Phase (StepPanel · Rating 등록 · Rating 동작) 의 몫이 1,781 B 다. Phase 1 · 2 가 각각 +3,629 · +1,590 B 였으므로 Rating 의 등록과 동작이 이 안에 들기 어렵다 — Phase 4 에 닿기 전에 다시 본다.
- lazy 로 뺄 것은 Phase 1 과 같다 (없음): 상태 규칙 · concept · dispatcher 분기 · DOM 조립은 Builder 의 initial chunk 다.

**설계와 달라진 것 · 정한 것**

1. Do 는 순서를 따지지 않는다 (v3 `setSelectedKey` — 앱이 정하는 이동). 선형 순서가 막는 것은 사용자의 누르기뿐이다. breakdown §5.2 의 「갈 수 있음」 은 Link 의 `isDisabled` 에만 쓴다.
2. 읽기 전용 목록은 Do 를 받는다 (v3: `isReadOnly` 는 `isSelectable` 에만). concept 의 guard 는 `isDisabled` · `disabledKeys` 둘이다 — 다른 컴포넌트의 값 concept 은 `isReadOnly` 도 Do 를 막는다.
3. 「다음 단계」 는 마지막 단계에서, 「이전 단계」 는 첫 단계에서 머문다 (성공, 쓰기 없음). 실패로 두면 「Submit → 단계 완료 · 다음 단계」 규칙이 마지막 단계에서 경고를 낸다.
4. 「단계 완료」 는 완료를 줄이지 않는다 (v3 의 setter 는 줄일 수 있다).
5. 자유 이동에서도 건너뛴 단계는 완료가 된다 (§5.2 의 「단계로 갈 때 앞 단계까지 완료」 를 그대로 적용). 「완료는 Do 로만 바뀐다」 로 두려면 규칙이 달라진다 — 사용자 확인 대상.
6. 표식은 Link 안에 있다 (표식을 눌러도 간다) — Link 의 이름은 라벨 · (설명) · 상태 문구 · 표식 숫자를 이은 글자다 (「Step 2현재2」). Phase 0 시제품은 숫자가 앞이었다.
7. contract 를 올리지 않았다 (위).
8. hover 색 (design-data 의 `-hover` 토큰) 은 넣지 않았다 — G2 조건 밖, Canvas 에 없는 상태다.

**Phase 3 에 넘기는 것**

- StepPanel (결정 2 — 아직 묻지 않았다): 짝 명령 · 고른 단계의 패널만 · Form 연결 live.
- Code 보기의 StepList 모양.
- 번들: 남은 여유 (위 번들 표) 안에서 StepPanel 과 Rating 을 넣어야 한다.

(Phase 가 닫힐 때마다 결과를 여기에 기록)
