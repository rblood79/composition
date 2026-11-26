# ADR-321 breakdown — StepList · Rating

> 결정: [ADR-321](../321-steplist-rating-components.md). 경로 약칭 `S/` = `packages/shared/src/`, `RA/` = 설치된 `react-aria` 3.53.1, `RS/` = `react-stately` 3.51.0.

## 1. 범위 · 출처

- 사용자 요청 2026-11-26 — ReUI 비교 보고 뒤 `/create-adr`, 「Stepper · Rating」 묶음.
- 범위: `StepList` · `Step` (· `StepPanel`) 과 `Rating` 의 등록 · 정적 모양 · 동작 · 상태 연동.
- 범위 밖: 단계 검증 (Form 의 것) · 별점 집계 계산 (보기의 집계 `mean` 이 한다).
- 조사 근거: design-data MCP (dataset 3.9.1) · 설치본 소스 · v3 저장소 소스 · ReUI registry 소스 · APG.

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

- RAC `Link` — `aria-current` prop (`'step'` 포함, `RA/dist/types/src/link/useLink.d.ts:9`) · `isDisabled` → `aria-disabled` · press.
- RAC `Slider` — root `role="group"` + 숨은 `input[type=range]`, 화살표 ± step · PageUp · PageDown · Home · End, `aria-valuetext`. `isReadOnly` 없음.
- RAC `Meter` — `role="meter"` · `aria-valuenow` · `aria-valuetext`.
- v3 hook (대조 기준으로만 읽는다) — `RA/dist/private/steplist/useStepListItem.mjs:26-32` (role · `aria-current` · `aria-disabled` · tabIndex), `RS/dist/private/steplist/useStepListState.mjs:31-70` (완료 · 선택 가능 · 지나온 단계 완료 규칙).

## 4. D1 — 조립 표 (예외 0)

| 자리      | RAC 부품                                      | RAC 가 주는 것                              | 우리가 정하는 것                            |
| --------- | --------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| 단계 목록 | `ol` · `li` (역할 없는 구조 요소)             | 목록 의미 (브라우저 기본)                   | 순서                                        |
| 단계      | `Link` (`aria-current` · `isDisabled` prop)   | link role · `aria-disabled` · press · focus | 어느 단계가 현재 · 갈 수 없는지 (상태 규칙) |
| 상태 문구 | Link 안의 보이지 않는 글자 (`VisuallyHidden`) | 낭독되는 글자                               | 「현재 · 완료 · 남음」 문구 (i18n)          |
| 별점 입력 | `Slider` > `SliderTrack` > `SliderThumb`      | range input · 키 · 값 낭독                  | track 안의 별 배치 · 채움                   |
| 별점 표시 | `Meter`                                       | meter role · 값 낭독                        | 별 채움 (0.5 단위)                          |

- 예외 0 의 조건: 구현 파일에 `role=` · `aria-` 리터럴과 `onKeyDown` 이 없다 (RAC prop 으로 넘기는 `aria-current` · `aria-label` 제외) — G2 · G5 의 정적 검사가 본다.
- 조립으로 낼 수 없어 넣지 않는 것: 단계 사이의 화살표 이동, 같은 별을 다시 눌러 지우기.

## 5. 설계

### 5.1 StepList 의 노드 · prop

- `StepList` (팔레트 navigation 범주) > `Step` 여럿. `Step` 은 `StepList` 안에만 놓인다 (collection 가족 — `COLLECTION_TYPE_TABLE` 에 한 줄).
- `StepList`: `selectedKey` · `defaultSelectedKey` · `lastCompletedStep` · `defaultLastCompletedStep` · `orientation` · `size` · `isEmphasized` · `isDisabled` · `isReadOnly` · `disabledKeys` · (결정 3) 자유 이동 스위치.
- `Step`: 라벨 (자식 Text) · (결정 4) 설명 · `isDisabled`. key 는 노드의 항목 key 다.
- `StepPanel` (결정 2): Tabs 의 TabPanel 처럼 Step 과 key 로 짝. role 없는 상자이고 고른 단계의 것만 그린다.
- 단계 값은 데이터에서 올 수 있다 — 행 template 안의 StepList 에 `selectedKey` · `lastCompletedStep` 을 필드 값으로 잇는다 (기존 값 바인딩). 단계 항목 자체는 자식 노드다.

### 5.2 StepList 의 상태 규칙 (순수 함수 하나)

- 입력: 단계 key 목록 · `selectedKey` · `lastCompletedStep` · `disabledKeys` · `isDisabled` · `isReadOnly` · 자유 이동.
- 출력: 단계마다 `현재 · 완료 · 남음` 과 `갈 수 있음`.
- 규칙: 완료 = 순서가 `lastCompletedStep` 이하. 갈 수 있음 = 완료된 단계 · 바로 앞이 완료된 단계 · 첫 단계 (비활성 · 읽기 전용이면 없음). 자유 이동이면 비활성이 아닌 모든 단계.
- 단계로 갈 때: 앞 단계가 완료가 아니면 앞 단계까지 완료로 올린다 (v3 규칙).
- 선택이 비면 완료 · 비활성이 아닌 첫 단계를 고른다.

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
- 토큰이 비어 있는 값 (step 폭 · step 과 선의 간격) 은 Phase 1 에서 정해 여기에 적는다.

### 5.4 StepList 의 상태 연동

- 이름 붙인 상태: `selectedKey` (값 형 key) · `lastCompletedStep` (key).
- When: 「단계 변경」 · 「완료 단계 변경」.
- Do: 「다음 단계」 · 「이전 단계」 · 「단계로 이동」 (key) · 「단계 완료」 (지금 단계를 완료로).
- 폼 연결의 기본 모양: 패널 안의 Form 에 When 「Submit」 → Do 「단계 완료」 · 「다음 단계」.

### 5.5 Rating 의 노드 · prop

- `Rating` (팔레트 inputs 범주). 부품: track (별 다섯) · thumb (focus 를 받는 숨은 조작자).
- prop: `value` · `defaultValue` · `isEmphasized` · `isDisabled` · `isReadOnly` · `size` (S · M) · (결정 5) `label` · `name`.
- `isReadOnly` 가 켜지면 Meter 로 그린다 (결정 7). 값은 0.5 단위로 반올림해 채운다.

### 5.6 Rating 의 모양 (design-data 토큰)

| 값                | S   | M   |
| ----------------- | --- | --- |
| 별 아이콘 (px)    | 16  | 18  |
| 전체 폭 (px)      | 104 | 128 |
| 세로 padding (px) | 4   | 7   |
| radius (px)       | 7   | 8   |

- 별 간격 4 px · focus ring 2 px + 간격 2 px. 색은 neutral content (강조는 accent content, 비활성은 disabled content).
- 채움: 값 이하의 별 = 채운 별, 0.5 = 반쪽 별 (표시 전용), 그 뒤 = 빈 별.

### 5.7 Rating 의 조작

- 별 누르기 = Slider 의 track 누르기. track 의 배치로 「누른 별 = 그 별의 값」 이 되게 한다 (Phase 0 시제품 P2).
- 화살표 = 한 칸. 0 까지 내려가면 지워진 상태다.
- hover 미리보기 = CSS 의 형제 선택자로 hover 한 별까지 채워 그린다 (값은 바뀌지 않는다).
- 값 연동: Slider 의 concept (`valueCommitNumber` — When 「변경」 · 「변경 끝」, Do 「값 넣기」).

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

| ID  | 확인할 것                                                                                                               | go 기준                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| P1  | `ol > li > Link` 조립 — Chrome 접근성 트리에 list · listitem · link 와 `current: step` · disabled, Tab 순서, Enter 활성 | 트리의 속성이 v3 hook 이 내는 것과 같다. VoiceOver 는 사용자 |
| P2  | Slider 위의 별 다섯 — 각 별의 왼쪽 · 가운데 · 오른쪽 15 점을 눌러 값이 그 별의 번호인지, 화살표로 0 까지, 낭독되는 값   | 15 점 전부 일치 · 0 도달 · 접근성 트리에 slider 와 값        |

## 8. 파일 추정 (Phase 0 에서 확정) · Phase 결과

| 자리               | 파일                                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 등록 (shared)      | 새 `bindings/StepList.binding.ts` · `Step.binding.ts` · `StepPanel.binding.ts` · `Rating.binding.ts` · `bindings/index.ts` · `componentCatalog.ts` · `generated/componentRulesTable.ts` · `document/generated/reusableOriginLibrary.ts` · `document/d2Provenance.ts` · `domain/componentTraits.ts` · `nesting/requiredParts.ts` · `document/types.ts` |
| 실행 (shared)      | 새 `runtime/stepList.ts` (상태 규칙) · `runtime/stepList.components.tsx` · `runtime/rating.components.tsx` · `runtime/delegatedDom.runtime.ts`                                                                                                                                                                                                        |
| 상태 연동 (shared) | 새 `interactions/concepts/stepList.ts` · `componentInteractionSpecs.ts` · `commands/collections.ts` (짝)                                                                                                                                                                                                                                              |
| Canvas · 패널      | `packages/rendering/src/renderers/buildCatalogShapes.ts` · `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` · `paletteItems.ts` · i18n                                                                                                                                                                                                      |

추정 shared 14 ~ 18 · builder 5 ~ 8 · rendering 1 ~ 2 파일 + 테스트.

(Phase 가 닫힐 때마다 결과를 여기에 기록)
