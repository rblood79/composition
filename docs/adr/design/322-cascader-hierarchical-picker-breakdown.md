# ADR-322 breakdown — Cascader (여러 단계를 파고드는 선택 필드)

> 결정: [ADR-322](../322-cascader-hierarchical-picker.md). 경로 약칭 `S/` = `packages/shared/src/`.

## 1. 범위 · 출처

- 사용자 요청 2026-11-26 — ReUI 비교 보고 뒤 `/create-adr`, 「Cascader」 묶음.
- 범위: `Cascader` · `CascaderItem` 의 등록 · 닫힌 필드 · 방식 셋 · 데이터 연결 · 검색 · 다중 · 폼 · 상태 연동.
- 범위 밖: Tree 컴포넌트 자체의 변경 · 필터 바의 필드 고르기 (ADR-320 — RAC Menu 로 따로 조립).
- 조사 근거: ReUI 문서와 registry 소스 (Cascader 11 파일) · Ant Design 문서 · 설치본 RAC · 저장소 코드.

## 2. 대조 표

| 항목        | ReUI Cascader                                                   | Ant Design Cascader                          | 이 ADR                                                      |
| ----------- | --------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| 방식        | `mode: drill` (기본) · `columns` · `tree`                       | columns 뿐 (`expandTrigger: click \| hover`) | `mode` 셋 — 기본값 사용자 결정 1                            |
| 자료        | `CascaderNode` 중첩 또는 `getParent` (평면)                     | `options` 중첩 (`fieldNames`)                | 자식 노드 또는 `dataBinding` (`children` · `parentId` 역할) |
| 값          | 단일 `string` · 다중 `string[]` (key 는 트리 전체에서 유일)     | 경로 배열                                    | key 하나 · 다중은 key 목록 (경로는 계산)                    |
| 부모 선택   | `selectable: leaf \| any \| fn`                                 | `changeOnSelect`                             | 사용자 결정 2 (스위치)                                      |
| 다중 · 연쇄 | `multiple` · `max` · `cascade` (부분 선택 `aria-checked=mixed`) | `multiple` · `showCheckedStrategy`           | 사용자 결정 3 (연쇄 없음 권고)                              |
| 검색        | `searchScope: level \| deep \| global` · `onSearch` (서버)      | `showSearch` (`limit` 50)                    | 모든 단계 · 경로 표시 · 200 건                              |
| 단계별 로드 | `getChildren(node, { signal, cursor })` · `prefetch`            | `loadData` (검색과 같이 못 씀)               | 사용자 결정 4                                               |
| 표시        | `display: path \| leaf \| count` · `collapse` · `separator`     | `displayRender` (기본 `/` 로 이음)           | 경로 · 끝 항목 (사용자 결정 7) · 다중은 개수                |
| 가상화      | TanStack Virtual (100 행부터 자동)                              | 내장                                         | Tree 방식에 RAC `Virtualizer` (R2)                          |
| focus       | 검색 input 에 두고 `aria-activedescendant`                      | 자체                                         | RAC 부품의 focus 그대로                                     |
| 필드 이름   | 작성자가 `aria-label` 또는 `<label>`                            | Form.Item                                    | 필드 가족의 라벨 (S2 Picker 이름)                           |
| 폼          | `name` · `required` · `invalid` · `readOnly`                    | Form 연동                                    | `name` · 필수 (사용자 결정 6)                               |

## 3. D1 — 조립 표와 닫힌 예외 1

| 자리          | RAC 부품                                                                                                                  | RAC 가 주는 것                                                                                             | 우리가 정하는 것                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 여는 버튼     | `Button` (`aria-labelledby` prop) — `DialogTrigger` · `MenuTrigger` 안                                                    | `aria-haspopup` · `aria-expanded` · press                                                                  | 표시 글자 (경로 · 끝 항목 · 개수)         |
| `columns`     | `Popover` > `Menu` · `SubmenuTrigger` (재귀)                                                                              | menu 계약 · 오른쪽 / 왼쪽으로 하위 메뉴 · 선택 (`menuitemradio`)                                           | 항목 · 고른 경로의 표시                   |
| `tree`        | `Popover` > `Dialog` > `Tree`                                                                                             | treegrid 계약 · 펼침 · 선택 · typeahead                                                                    | 항목 · 시작 펼침 (고른 값의 조상)         |
| `drill`       | `Popover` > `Dialog` > `Breadcrumbs` + `GridList`                                                                         | grid 계약 · 행 동작 (`onAction`) 과 선택의 분리 · breadcrumb link                                          | 지금 단계의 항목 · 「들어가기」 = 행 동작 |
| 검색          | `Autocomplete` > `SearchField` + `Menu`                                                                                   | 검색 중 virtual focus · 걸러내기                                                                           | 평평한 결과 (이름 + 경로) · 200 건        |
| 이어 불러오기 | `TreeLoadMoreItem` · `GridListLoadMoreItem`                                                                               | 보이면 다음 쪽 요청                                                                                        | 요청 (사용자 결정 4)                      |
| 폼 값 · 필수  | 숨은 값 `input` (§3.1 — 닫힌 예외) + react-aria `useField` · `useFormValidation` + RAC `FieldError` (`FieldErrorContext`) | 제약 검증 참여 · `invalid` 때 오류 문구 · focus 넘기기 · 오류 문구와 버튼의 연결 (`aria-describedby` prop) | 값 (key) · 필수 여부                      |

- 조립 쪽의 조건: 구현 파일에 `role=` · `aria-` 리터럴과 `onKeyDown` 이 없다 (RAC prop 으로 넘기는 `aria-label` · `aria-labelledby` · `aria-describedby` 제외) — G2 의 정적 검사가 본다. 직접 그리는 요소는 §3.1 의 input 뿐이다.
- 조립으로 낼 수 없어 넣지 않는 것: 연쇄 선택의 부분 표시 (`mixed`), drill 방식의 왼쪽 화살표로 뒤로 (Breadcrumbs 와 「뒤로」 Button 으로 간다), Miller columns 처럼 지나온 단계를 나란히 두는 모양.
- 「어느 단계든」 (사용자 결정 2) 의 방식별 표현: `tree` 는 모든 행이 선택 가능, `drill` 은 행의 선택 (고르기) 과 행 동작 (들어가기) 이 따로, `columns` 는 하위 메뉴의 첫 항목이 「이 단계 고르기」 다.

### 3.1 닫힌 D1 예외 — 폼 값 input (사용자 답 2026-11-26, 정본)

RAC 에 계층 선택 필드가 없어 폼 값을 싣는 요소를 내는 부품이 없다. 사용자 컴포넌트 Cascader 만 아래를 직접 다룬다 — 설치본 RAC `HiddenSelect` 의 input 길 (`react-aria/dist/private/select/HiddenSelect.mjs:117-150`) 과 같은 속성 · 동작이다.

1. **요소** — `input` 을 그리는 조건은 둘 중 하나다: `name` 이 있다 (값 싣기), 또는 Form 이 native 이고 `isRequired` 다 (검증 참여 — `name` 이 없어도). 둘 다 아니면 그리지 않는다. `name` 이 있으면 값마다 하나 (다중 선택), `name` 이 없으면 검증 input 하나 (값 = 첫 key 또는 `""`). 어느 경우든 **값이 비면 값 `""` 인 input 하나** (설치본 `:122-125` 「Always render at least one hidden input」 — 빈 다중 선택에도 `required` 를 들 요소가 있어야 한다).
2. **속성** — `name` (필드에 `name` 이 있을 때만 — 없으면 속성을 쓰지 않아 FormData 에 실리지 않는다) · `form` · `value` · `disabled` (필드의 `isDisabled` — 비활성 필드는 제약 검증과 FormData 에서 빠진다, 설치본 `:132`) · `type` (Form 의 검증 방식이 native 면 `text` + `style: display none`, 아니면 `hidden` — 설치본 `:135-146`) · `required` (native 이고 `isRequired` 일 때 첫 input 에만) · 값 없는 `onChange` (React 경고 막기). 읽기 전용으로 두지 않는다 (읽기 전용 input 은 검증 대상이 아니다).
3. **검증 연결** — react-aria `useFormValidation` 을 첫 input 의 ref 에 붙인다: `invalid` 를 받아 오류를 FieldError 에 올리고 focus 를 여는 버튼으로 넘긴다 (input 자신은 focus 를 받지 않는다). 폼 reset 은 `useFormReset` 으로 시작 값에.

| 필드 상태                       | native                                                      | aria                                  |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------- |
| 필수 · 빈 값 (단일 · 다중 같음) | submit 0 · 오류 문구 · focus 가 여는 버튼                   | 제출됨 (빈 값)                        |
| 필수 · 값 있음                  | submit 1 · FormData 에 key (다중 = 같은 name 여러 값)       | 같음                                  |
| 비활성 · 빈 값                  | 제출을 막지 않음 · FormData 에 없음                         | 같음                                  |
| 비활성 · 값 있음                | FormData 에 없음                                            | 같음                                  |
| 필수 아님 · 빈 값               | submit 1 · FormData 에 빈 값 하나                           | 같음                                  |
| 이름 없음 · 필수 · 빈 값        | submit 0 · 오류 문구 · focus 가 여는 버튼 · FormData 항목 0 | 제출됨 · FormData 항목 0 (input 없음) |
| 이름 없음 · 필수 · 값 있음      | submit 1 · FormData 항목 0                                  | 같음 (input 없음)                     |
| 이름 없음 · 필수 아님           | input 없음 · submit 1 · FormData 항목 0                     | 같음                                  |

그대로 두는 것: input 은 접근성 트리와 Tab 순서에 없다 (`display: none` · `type=hidden`), role · `aria-*` · 키 handler 를 쓰지 않는다, 여는 버튼 · 목록 · 라벨 · 오류 문구의 DOM 과 속성은 RAC 것이다. 이 목록을 넘는 구현은 규칙 위반이다 — 대조 게이트는 `adr318D1List.static.test.ts` 와 같은 방식의 정적 테스트 (G6). 규칙 파일 (`.claude/rules/ssot-hierarchy.md` §1 D1) 에는 Accepted 승격 때 승인을 가리키는 한 줄을 넣고 구현이 끝날 때 목록 전문을 옮긴다 (ADR-318 과 같은 방식). RAC 가 계층 선택 필드를 내면 이 예외를 지우고 RAC 것을 쓴다.

## 4. 설계

### 4.1 노드 · prop

- `Cascader` (팔레트 inputs 범주 · 필드 가족) > 정적이면 `CascaderItem` (재귀 — Tree 의 TreeItem 가족과 같은 모양).
- 부품: Label · 여는 Button (값 글자 + 화살표 아이콘) · Description · FieldError — Select 의 부품 원본을 그대로 쓴다.

| prop                     | 값                           | 뜻                                                                                                                                       |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `value` · `defaultValue` | key (다중이면 key 목록)      | 고른 항목                                                                                                                                |
| `mode`                   | `columns` · `tree` · `drill` | 방식                                                                                                                                     |
| `selectionMode`          | `single` · `multiple`        | 사용자 결정 3                                                                                                                            |
| 부모 선택 스위치         | boolean                      | 사용자 결정 2                                                                                                                            |
| `displayMode`            | `path` · `leaf`              | 닫힌 필드의 표시 (사용자 결정 7)                                                                                                         |
| `separator`              | 글자 (기본 「 / 」)          | 경로 구분                                                                                                                                |
| `isSearchable`           | boolean                      | 검색 칸                                                                                                                                  |
| 필드 prop                | S2 Picker 이름               | `label` · `description` · `placeholder` · `size` · `labelPosition` · `isRequired` · `isDisabled` · `isInvalid` · `errorMessage` · `name` |
| `dataBinding`            | collection + `fieldMap`      | 계층 데이터                                                                                                                              |

- prop 이름의 확정과 `d2Provenance.ts` 등록은 Phase 1. 필드 prop 은 Select binding 과 같은 키를 쓴다.

### 4.2 값 · 경로

- 값은 key 다. 경로 (조상의 이름 목록) 는 항목 표에서 계산한다 — 저장하지 않는다 (HC4).
- **항목 표** — 계층을 한 번 걸어 항목마다 `경로 식별자` (조상 key 사슬) · `key` · 이름 · 조상 목록을 만든다. RAC 의 항목 id · 펼침 (`expandedKeys`) · focus 는 경로 식별자를 쓴다 (RAC collection 은 id 가 유일해야 하고, 겹치는 key 를 그대로 id 로 쓰면 두 항목이 한 항목이 된다).
- **형제 충돌** — 같은 부모 아래의 두 항목이 같은 key 면 경로 식별자도 같다 (`["A","01"]` 둘). 항목 표를 만들 때 (RAC collection 에 넘기기 전) 둘째부터 경로 식별자에 순번을 붙여 가르고, 그 key 의 항목은 첫째까지 모두 「겹치는 key」 로 표시한다.
- **값 → 항목** — key 를 가진 항목이 정확히 하나면 그 항목이다. 없으면 「없는 값」, 둘 이상이면 「겹치는 값」 — 둘 다 선택으로 받지 않는다.
- **겹치는 key 의 항목** — 고를 수 없는 항목으로 그린다 (RAC `disabledKeys` 에 그 경로 식별자). 필드는 Description 자리에 「고를 수 없는 항목 N 개 — key 가 겹친다」 를 알리고, Design 패널은 「key 필드를 유일한 필드로 바꾸기」 를 안내한다. 평면 행 (`parentId`) 은 key 가 겹치면 계층 자체가 서지 않으므로 같은 알림을 낸다.
- 값을 쓰는 모든 길 (고르기 · 시작 값 · Do 「값 넣기」 · 변수에서 온 값) 이 같은 판정을 지난다. 겹치거나 없는 key 는 거절로 보고하고 첫 항목으로 맞추지 않는다.
- 닫힌 필드: `path` = 조상 이름을 구분 글자로 이은 것, `leaf` = 끝 항목 이름. 시작 값에 해당하는 항목이 없으면 (지워진 행 · 아직 불러오지 않은 단계) key 를 그대로 보여 주고 Design 패널에 알린다.
- 열 때 고른 값의 조상 단계가 펼쳐진 채로 선다 (`tree` 는 `expandedKeys`, `drill` 은 그 단계, `columns` 는 첫 단계에서 고른 경로를 표시).

### 4.3 데이터

- 정적: `CascaderItem` 자식 노드 (이름 · key · 비활성).
- 연결: `dataBinding` 의 `fieldMap` — `value` (key) · 이름 필드 · `children` 또는 `parentId` (F2). Tree 의 계층 해석을 그대로 쓴다.
- 단계마다 다른 표 (사용자 결정 5): Cascader 의 단계 목록 — 단계마다 collection 과 「부모를 가리키는 참조 필드」. 첫 단계는 부모 없음. 화면 안의 식별은 경로 식별자 (§4.2) 이고 값은 끝 단계의 행 key 다. 「어느 단계든」 (결정 2) 과 같이 쓰면 단계가 다른 같은 key (대분류 1 · 중분류 1) 는 §4.2 의 겹치는 key 다 — 결정 5 를 물을 때 값에 단계를 싣는 모양 (`{ 단계, key }`) 을 같이 정한다.
- 단계별 원격 로드 (사용자 결정 4): 단계를 열 때 부모 key 로 자식을 묻는 요청. 선언한 endpoint 에만 보내고, 불러오는 동안은 그 단계에 로딩 표시, 실패하면 다시 시도 Button.
  - **유일성은 선언이다** — 받은 항목만으로는 key 가 계층 전체에서 유일한지 알 수 없다 (A 의 자식 `01` 만 받은 동안 항목 표의 `01` 은 하나다). 그래서 endpoint 가 「자식 요청」 과 함께 「key 가 계층 전체에서 유일하다」 를 선언해야 단계별 로드가 켜진다. 선언이 없으면 패널이 단계별 로드를 내지 않고 전량 로드 (상한 안) 로만 연결한다.
  - 선언을 어긴 응답 (나중에 온 단계에 이미 본 key) — 그 순간부터 두 항목을 고를 수 없게 하고, 지금 값이 그 key 면 값을 비우며 필드와 콘솔에 알린다. 이미 제출된 값은 되돌릴 수 없으므로 이 경우를 「서버 계약 위반」 으로 보고한다 (조용히 첫 항목으로 맞추지 않는다).

### 4.4 검색

- 검색어가 있으면 방식과 무관하게 한 목록 — 항목 이름과 경로. 찾기는 이름의 부분 일치 (기존 검색 비교 — 한글 자모 규칙 포함).
- 부모 단계 고르기가 꺼져 있으면 끝 항목만 결과에 나온다.
- 표시 200 건, 넘으면 「N 건 더 — 더 입력해 좁히기」.
- 원격 단계별 로드 데이터에서는 불러온 항목에서만 찾고 그 사실을 알린다.

### 4.5 폼 · 상태 연동

- `name` 이 있으면 값 (key, 다중이면 여러 값) 을 폼 제출에 싣는다 — 숨은 값 input (§3.1) 이 key 마다 하나, 값이 비면 빈 값 하나이고 Form 의 `!event.formData` 가 읽는다 (같은 name 여러 값 = 배열). 비활성 필드의 값은 싣지 않는다. `name` 이 없는 필드는 값을 싣지 않지만 native 필수 검증에는 참여한다 (§3.1 의 검증 input).
- 필수 (사용자 결정 6) 는 Form 의 검증 방식을 따른다:
  - native — 첫 값 input 에 `required` (빈 다중 선택도 input 하나가 있다). 빈 값이면 브라우저의 제약 검증이 제출을 막는다 (`requestSubmit()` 도 같다 — submit 이벤트 0, 규칙의 `callEndpoint` 0). `useFormValidation` 이 `invalid` 를 받아 오류 문구를 FieldError 에 올리고 focus 를 여는 버튼으로 넘긴다. 값을 고르면 오류가 지워진다.
  - aria — RAC 필드와 같이 제출을 막지 않는다 (오류는 응답 오류 · `isInvalid` 로만).
- 응답의 필드 오류 (`validationErrors` — `S/catalog/runtime/catalogPreviewInteractions.ts:624-705`) 는 제출 뒤의 경로로 그대로 둔다 — 같은 `name` 의 Cascader 에도 올라간다.
- 라벨 · 설명 · 오류 문구의 연결은 react-aria `useField` 가 낸 id 를 RAC 의 `LabelContext` · `TextContext` · `FieldErrorContext` 와 Button 의 `aria-labelledby` · `aria-describedby` prop 으로 넘긴다 (속성을 직접 쓰지 않는다).
- 이름 붙인 상태 = 값. When 「변경」 · 「열림 변경」. Do 「값 넣기」 · 「지우기」 · 「열기 · 닫기」.

### 4.6 Canvas

- 닫힌 필드 (라벨 · Button · 설명) 와 시작 값의 표시 글자. 표시 글자는 Preview 첫 화면과 같은 함수를 읽는다.
- 열린 목록은 그리지 않는다.

## 5. Phase

| Phase | 내용                                                                                                           | Gate |
| :---: | -------------------------------------------------------------------------------------------------------------- | :--: |
|   0   | 코드 사실 재대조 · v3 확인 · 시제품 5 · 번들 · Select 열기 기준선                                              |  G0  |
|   1   | 등록 (binding · rule · template · traits · nesting · d2Provenance) · 닫힌 필드 · Canvas 정적 · contract        |  G1  |
|   2   | `columns` 방식 — 정적 항목 · 단일 선택 · 값 · 표시 글자                                                        |  G2  |
|   3   | `tree` · `drill` 방식                                                                                          |  G3  |
|   4   | 데이터 연결 — 중첩 · 평면 · 단계마다 다른 표 (결정 5) · 항목 표와 겹치는 key 판정                              |  G4  |
|   5   | 검색 · 다중 (결정 3) · 부모 단계 고르기 (결정 2) · 이름 붙인 상태 · When · Do · 속도 측정                      |  G5  |
|   6   | 단계별 로드 (결정 4) · 폼 값과 필수 (§3.1 의 닫힌 예외) · D1 목록 전문을 규칙 문서로 · 번들 · 종결 live · 문서 |  G6  |

## 6. Phase 0 시제품

| ID  | 확인할 것                                                                                                                                               | go 기준                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P1  | `columns` — `Menu` + `SubmenuTrigger` 3 단, 끝 항목 선택 (`selectionMode`) 과 하위 메뉴 열기가 한 메뉴에서 같이 서는지                                  | 키보드로 3 단 내려가 고르고 닫힘 · 접근성 트리에 menu 와 선택 상태                            |
| P2  | `drill` — `GridList` 의 행 동작 (들어가기) 과 선택 (고르기) 분리, `Breadcrumbs` 로 뒤로, 단계가 바뀔 때 focus 가 목록에 남는지                          | 키보드 전 경로 · focus 를 잃지 않음                                                           |
| P3  | 검색 — `Autocomplete` 가 `Menu` 의 평평한 결과를 거르는지, `Tree` 도 감쌀 수 있는지 (F1 의 미확인)                                                      | Menu 로 서면 go (Tree 지원은 기록만)                                                          |
| P4  | 5,000 항목 · 4 단 — `tree` 방식의 열기 시간과 `Virtualizer` 유무의 차이, `columns` 의 한 단계 300 항목 열기                                             | HC5 안 (또는 Virtualizer 로 안)                                                               |
| P5  | 필수 검증 — RAC `Form` 안에 Button + §3.1 의 숨은 값 input + `useFormValidation`. §3.1 표의 여덟 상태 × native · aria 를 Enter · `requestSubmit()` 으로 | §3.1 표와 같은 결과 (Chrome · WebKit) — 빈 다중 선택 · 비활성 필드 · 이름 없는 필수 필드 포함 |

## 7. 파일 추정 (Phase 0 에서 확정)

| 자리                | 파일                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 등록 (shared)       | 새 `bindings/Cascader.binding.ts` · `CascaderItem.binding.ts` · `bindings/index.ts` · `componentCatalog.ts` · `generated/componentRulesTable.ts` · `document/generated/reusableOriginLibrary.ts` · `document/d2Provenance.ts` · `domain/componentTraits.ts` · `nesting/requiredParts.ts` · `commands/collections.ts` (`COLLECTION_TYPE_TABLE`) |
| 실행 (shared, lazy) | 새 `runtime/cascader.ts` (항목 표 · 겹치는 key 판정 · 경로 · 검색 계산) · `runtime/cascader.components.tsx` (조립 · 숨은 값 input) · `runtime/delegatedDom.runtime.ts`                                                                                                                                                                         |
| 데이터 (shared)     | `collections/resolveCollectionItems.ts` (단계마다 다른 표) · 요청 형식 (결정 4)                                                                                                                                                                                                                                                                |
| 상태 연동 (shared)  | `interactions/componentInteractionSpecs.ts` · Picker concept 재사용                                                                                                                                                                                                                                                                            |
| Canvas · 패널       | `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` · `paletteItems.ts` · 단계 목록 편집기 · i18n                                                                                                                                                                                                                                       |

추정 shared 12 ~ 16 · builder 5 ~ 8 파일 + 테스트.

## 8. Phase 결과

(Phase 가 닫힐 때마다 기록)
