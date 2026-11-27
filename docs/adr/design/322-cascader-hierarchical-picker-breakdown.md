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

### Phase 0 — G0 (2026-11-27, HEAD `e1463237f`)

**코드 사실 재대조** — 내용 차이 0. 줄 이동: F3 Tree concept `interactions/componentInteractionSpecs.ts:329` · F5 Popover 조립 `tableOperationsDom.components.tsx:420-519` · F7 응답 오류 `catalogPreviewInteractions.ts:676-770`. F8 contract 는 **86** (이 ADR 은 87 부터). F9 의 설치본 `HiddenSelect.mjs:117-150` · `useDateField.mjs:127-133` 그대로 (`react-aria` 3.53.1 · RAC 1.22.1). F1 의 미확인 = `Autocomplete` 는 `Tree` 를 거르지 않는다 (P3 기록).

**v3** — `@adobe/react-spectrum` 3.47.7 (npm 판) 의 export 목록에 Cascader 가 없다 (Picker · TreeView · Menu 뿐). D2 = composition 확장 (`d2Provenance.ts` — Phase 1).

**시제품** — `apps/builder/scripts/adr322Prototypes.mjs` (설치본 RAC 위의 작은 Cascader, production lib build) · 판정 `adr322-phase0-prototypes.mjs` (Chrome 158 · WebKit 27.2, headed · visible · DPR 1). 기대값은 판정 파일에 따로 적었다 (§3.1 표 · §6 go 기준).

| ID  | 결과                                                                                                                                                                                                                                                                                                                                                                                                |         판정          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------: |
| P1  | `MenuTrigger` > `Menu` · `SubmenuTrigger` 3 단: Enter 로 열면 첫 항목 focus · → 두 번에 하위 메뉴 둘 · ← 로 하나 닫힘 · 끝 항목 Enter 로 전부 닫히고 focus 가 여는 버튼 · 값 = 경로 식별자 · 다시 열면 끝 단계 `menuitemradio "삼성동" [checked]` · Esc 는 한 번에 한 단계씩 닫음 (두 브라우저 같음)                                                                                                |          go           |
| P2  | `Popover` > `Dialog` > `Breadcrumbs` + 「뒤로」 + `GridList` (`autoFocus: "first"`, 단계마다 `key`): 가지 행 Enter = 들어가기 (값 그대로) · 끝 행 Enter = 고르기 · 다시 열면 고른 값의 단계와 `aria-selected` · 「뒤로」 · breadcrumb 「전체」 뒤에도 focus 유지 · 가지 행 Space = 선택 (결정 2 의 drill 표현 재료)                                                                                 |          go           |
| P3  | `Autocomplete` > `SearchField` + `Menu`: 「동」 → 끝 항목 넷이 「이름 — 경로」 로 · ↓ 에도 focus 는 검색 칸 (`aria-activedescendant`) · 「명」 → 하나 · Enter 로 값. 기록: `Autocomplete` > `Tree` 는 거르지 않음 (10 → 10)                                                                                                                                                                         |          go           |
| P4  | 5,000 항목 · 4 단 (부하용 생성 — 규모 전용, 한 부모 아래 300), 교대 3 쌍, 대조군 = 같은 페이지 RAC `Select` 5,000 (가상화 없음). 아래 표                                                                                                                                                                                                                                                            | go (Virtualizer 조건) |
| P5  | RAC `Form` + 여는 `Button` + §3.1 의 숨은 값 input + `useFormValidation` (`react-aria/private/form/useFormValidation`) · `useFormValidationState` (`react-stately/private/form/…`) · `FieldErrorContext`: §3.1 표의 10 상태 (단일 · 다중 · 비활성 · 이름 없음 포함) × native · aria × Enter · `requestSubmit()` + 막힌 경우 「값을 고른 뒤 오류 지워짐 · 제출 1」 — Chrome 44 / 44 · WebKit 44 / 44 |          go           |

P4 — 열기 = 클릭부터 목록이 다 그려진 뒤 다음 frame (`performance.now`, 중앙값):

| 조건                 | Select 5,000 (대조) | tree 전부 펼침 (가상화 없음) | tree + `Virtualizer` | columns 300 항목 단계 |
| -------------------- | ------------------: | ---------------------------: | -------------------: | --------------------: |
| Chrome 1x            |              599 ms |               902 ms (×1.51) |        39 ms (×0.07) |         75 ms (×0.13) |
| Chrome 4x (CDP 감속) |            2,292 ms |             3,197 ms (×1.40) |       120 ms (×0.05) |        163 ms (×0.07) |
| WebKit 1x            |              506 ms |               661 ms (×1.31) |        44 ms (×0.09) |         44 ms (×0.09) |

→ `tree` 방식은 `Virtualizer` 로 그린다 (R2 의 대응이 실제로 필요 — Phase 3 의 조건). 대조군 Select 는 시제품의 것이다 — 제품 문서의 Select 기준선 (HC5 의 「같은 문서」) 은 G5 에서 다시 잰다.

**발견** (설계에 닿는 것):

1. 선택이 있는 `GridList` · `Tree` 는 기본 `escapeKeyBehavior` (`clearSelection`) 가 Esc 를 먹어 Popover 가 닫히지 않는다 — drill · tree 방식은 `escapeKeyBehavior: "none"` (RAC prop) 을 준다 (Phase 3).
2. columns 의 첫 단계는 고른 값의 조상을 `menuitem [expanded]` 로만 보인다 — 선택 상태는 끝 단계 menu 에만 있다. 닫힌 필드의 표시 글자 (결정 7) 가 경로를 보여 주는 자리다.
3. 한글 IME 입력은 keydown 이 `Process` 라 RAC typeahead 에 닿지 않는다 (RAC 목록 공통 — 글자 key 를 직접 보내면 「부」 → 부산). 한글 찾기는 검색 칸 (`isSearchable`) 이 맡는다.

**번들 기준선** (일반 `vite build` → `adr209-bundle-closure.mjs`, `e1463237f`): Builder initial JS gzip **1,661,018** B (절대 상한 1,662,000 — 여유 **982 B**, 만료 2026-12-25) · Preview 172,276 B · CSS 57,888 / 68,177 B. 결정 8 의 권고 (Builder +3,000) 는 상한을 넘는다 → Phase 1 전에 사용자에게 묻는다 (상한 재승인 또는 등록 몫을 lazy 로).

G0 닫힘 — P1 ~ P5 전부 go, no-go 인 방식 없음.

### Phase 1 — G1 (2026-11-27)

사용자 답 (Phase 1 진입 전): 결정 1 = `columns` · 결정 7 = 경로 전체 · 결정 8 = 권고대로 + Builder 절대 상한 1,665,000 B 재승인.

**구현** (shared · builder):

| 자리     | 파일                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| binding  | 새 `bindings/Cascader.binding.ts` (`Cascader` — 필드 prop 은 Select 의 키 · `mode` · `displayMode` · `separator`, `CascaderItem` — `id` (항목 key 계약 `ITEM_KEY_PROP_CONTRACT`) · `label` · `isDisabled`) · `bindings/index.ts`                                                                                                                                                                                                                                                                                                                                     |
| rule     | `generated/componentRulesTable.ts` — Select rule 을 `SELECT_RULE` 상수로 꺼내 `Cascader` 가 공유 (Popover sheet 없음, delegation prefix `select-*` → `cascader-*` — prefix 는 rule 마다 하나), `CascaderItem` (container — 그리지 않음)                                                                                                                                                                                                                                                                                                                              |
| 원본     | 새 `document/cascaderOrigins.ts` — Select 의 부품 원본 (라벨 행 · Button > SelectValue + Icon · Description · FieldError) + 표본 항목 11 (세 단계)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 등록 표  | `componentCatalog.ts` (entry 둘 · 팔레트 원본) · `componentTraits.ts` (SelectValue · FieldLabel · FieldError 의 owner, `CascaderItem` 재귀) · `collectionItems.ts` (「+」 행 — recursive) · `d2Provenance.ts` (composition 형) · `sizePropagation.ts` · `formContext.ts` · `nestingRules.ts` · `resolveDelegatedChildFontSize.ts` · `rulePartRules.ts` (부품 토큰 · wrapper `Button` · glyph) · `rulePaint.ts` · `presence.ts` (`FIELD_HINT_OWNERS` · `FIELD_BUTTON_OWNERS` · `CATALOG_LABEL_NODE_FIELDS` · 필수 표시) · builder `ruleShapes.ts` · `paletteItems.ts` |
| 실행     | 새 `runtime/cascader.ts` (항목 표 — 경로 식별자 · 형제 충돌 순번 · 겹치는 key · 값 판정 · 표시 글자) · 새 `runtime/cascader.components.tsx` (닫힌 필드의 RAC context · 값 글자 요소) · `delegatedDom.runtime.ts` (`cascader` · `cascaderitem`) · `domBinding.runtime.ts` (SelectValue 의 Cascader 분기) · `domBinding.components.tsx` (트리거 구독) · `presence.ts` (트리거 부품 표식 · 값 글자 파생 · 항목 숨김 · 재해석 의존)                                                                                                                                      |
| CSS      | `generated/Cascader.css` · `CascaderItem.css` (`pnpm generate:css`) · `styles/index.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| contract | `document/types.ts` 87 · 테스트 핀 34 파일                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**G1 결과**:

- 등록 게이트: `codex:preflight` 의 guard · format · typecheck · registration · css-boundary · chart-contract · agent-catalog · skills gate 통과. `docs:rule-size` 는 이 작업 밖의 두 파일 (`canvas-rendering.md` · `panel-structure.md` — HEAD 의 다른 커밋 몫) 로 실패 — 보고만.
- 스위트: shared 3,036 + `adr322Cascader` 9 · builder unit 10,109 → Cascader 로 늘어난 집합 핀 5 건 수리 후 해당 파일 통과 · `adr322CascaderWiring` 7.
- 대칭 (`adr295PaletteSymmetry` · Chromium): Cascader XS · L · XL 최대 1 px, S · M 은 라벨 안 inline 글자의 줄 상자 2 px (Canvas 18 / DOM 16) — Select@S · M 과 같은 값이라 같은 사유로 알려진 목록에 넣었다 (G1 의 실패 시 대안 「Select 의 것과 맞춘다」). 이 하니스가 결함 2 를 잡았다: 값 글자가 Canvas 에서 폭 0 (부품 규칙이 Button 을 건너지 못함 — `SUBPART_WRAPPERS`), 라벨이 Select 보다 큼 (크기 전파 행 없음). 참고: Select@XS · L · XL 은 지금 대칭인데 알려진 목록에 남아 있다 (기존 — 이 작업 밖).
- live (`apps/builder/scripts/adr322-g1-live.mjs`, Builder 5173 → 팔레트 → Publish, headed Chrome): **19 / 19** — 다섯 상태의 상자 ±1 px · 값 글자 · placeholder 표시 · Button 바탕 픽셀 · 오류 상태의 설명 / 오류 문구 (S2 HelpText — 오류가 설명 자리) · HC2 (필드 `div` role · aria 0, Button 이름 = 값 + 라벨, 항목 요소 0) · page error 0.
- 원복 RED (`adr322CascaderWiring` 기준): 값 글자 파생 · 항목 숨김 · 트리거 부품 표식 · 라벨 행 표 · Button 이름 · DOM 값 분기 · 부품 규칙 wrapper · 크기 전파 · Cascader prop → 트리거 재해석 = 9 / 9 RED. 「항목 → 값 글자」 의존 줄은 빼도 GREEN (기존 경로가 다시 해석) — 죽은 코드라 지웠다 (테스트는 남김).
- 번들 (일반 `vite build` → `adr209-bundle-closure.mjs`, HEAD `ebb97c8ac` 위 작업 트리 — 다른 세션 WIP 는 양쪽에 같게, 이 Phase 의 tracked 소스만 HEAD 로 돌린 빌드와 나란히): Builder initial JS gzip 1,661,115 → **1,663,284 (+2,169)** — 결정 8 의 +3,000 안, 절대 상한 1,665,000 까지 1,716. Preview JS +3 B · CSS +386 B.

남은 것 → Phase 2: 열린 내용 (`columns` — RAC `MenuTrigger` > `Menu` · `SubmenuTrigger`, lazy chunk), 값 쓰기, 키보드 전 경로, Chrome · WebKit live. 번들 남은 몫 831 B (결정 8 의 +3,000 기준) — 열린 내용은 모두 lazy.

### Phase 2 — G2 (2026-11-27)

**조립** (breakdown §3 의 `columns` 행 — 모두 RAC · react-aria): 필드가 RAC `MenuTrigger` 의 안을 그대로 갖는다 — react-aria `useMenuTrigger` + react-stately `useMenuTriggerState`, trigger props 는 `ButtonContext` 로 여는 Button 에만 (RAC Select 가 trigger 를 넘기는 길 — `PressResponder` 로 필드 전체를 감싸면 라벨 행의 도움말 버튼도 트리거가 된다), 열린 내용에는 RAC `MenuTrigger` 의 context 넷 (`MenuContext` · `OverlayTriggerStateContext` · `RootMenuTriggerStateContext` · `PopoverContext` — `bottom start`). 열린 내용은 lazy chunk `runtime/cascaderMenu.components.tsx`: `Popover` > `Menu` (단일 선택 · 고른 항목의 단계에 `selectedKeys` · 겹치는 key 와 비활성 항목은 `disabledKeys`), 가지는 `SubmenuTrigger` (`MenuItem` + S2 chevron — catalog MenuItem 원본과 같은 `slot="descriptor"` Icon · `Popover` `end top` > 다음 단계 `Menu`), 끝 항목의 `onAction` 이 그 key 를 값으로. 실행 값은 record 의 runtime `value` (`setRuntimeProps`), 값 글자는 필드가 같은 함수 (`cascaderValueText`) 로 계산해 context 로 넘긴다 (Canvas 는 시작 값 — 설계된 비대칭). 항목의 key · 이름 편집은 필드가 구독한다 (`watchesChildren`).

**G2 결과**:

- 동작 (`adr322CascaderWiring` jsdom + user-event, 세 번 반복 10 / 10): Enter → 첫 단계 (`aria-haspopup="menu"` · `aria-expanded`) · → → 셋째 단계 · ↓ Enter 고르기 → 닫힘 · focus 가 여는 Button · 값 글자 = 경로 · 다시 열면 `menuitemradio [checked]` · 포인터로 끝 항목 · 가지는 고르지 않음 · 겹치는 key (Desktops 의 key 를 `men` 으로) 의 두 항목 `aria-disabled`.
- D1 정적 검사 `adr322D1Static.static.test.ts` — 조립 파일 셋에 role · 직접 쓴 aria (`aria-label` · `aria-labelledby` · `aria-describedby` prop 제외) · `onKeyDown` 0. 금지 속성을 넣으면 RED (바이트 복원 확인).
- live `apps/builder/scripts/adr322-g2-live.mjs` (Builder 5173 → 팔레트 → Publish): Chrome **6 / 6** · WebKit **6 / 6** — 키보드 전 경로 · 접근성 스냅샷 (가지 `menuitem` · 끝 `menuitemradio` · 고른 항목 `[checked]`) · ← 로 한 단계 · Esc 로 전부 · focus 복귀 · 포인터 (올려서 하위 메뉴 → 끝 항목) · page error 0.
- 원복 RED 4 / 4 (끝 항목 고르기 · 겹치는 key 비활성 · trigger props · 고른 항목 표시).
- 번들 (P1 과 같은 A/B — 이 ADR 의 tracked 소스만 HEAD 로 돌린 빌드): Builder initial 1,660,930 → **1,663,657 (P1 + P2 = +2,727)** — P2 몫 ≈ +558 (trigger hook · context), 결정 8 의 +3,000 까지 273 B · 절대 상한 1,665,000 까지 1,343 B. 열린 메뉴는 lazy chunk. Preview JS +2 B.
- 알아 둔 것: 메뉴의 이름은 RAC `MenuTrigger` 대로 여는 Button 을 가리킨다 (`aria-labelledby` — 값 글자). Canvas 는 열린 목록을 그리지 않는다 (R6).

남은 몫이 작다 (+3,000 기준 273 B) — Phase 3 의 `tree` · `drill` 조립은 lazy chunk 안에 둔다.

### Phase 3 — G3 (2026-11-27)

**조립**: 필드가 `mode` 로 trigger 를 고른다 — `columns` 는 RAC `MenuTrigger` 의 안 (Phase 2), `tree` · `drill` 은 RAC `DialogTrigger` 의 안 (react-aria `useOverlayTrigger({type: "dialog"})` + `DialogContext` · `OverlayTriggerStateContext` · `RootMenuTriggerStateContext` · `PopoverContext` — Dialog 는 trigger 이름으로). 열린 내용은 둘 다 lazy chunk `runtime/cascaderPanel.components.tsx` (`columns` 와 다른 chunk):

- `tree`: `Popover` > `Dialog` > RAC `Virtualizer` (`ListLayout`) > `Tree` — 단일 선택 (controlled, 가지의 선택은 값이 아니라 무시) · 겹치는 key `disabledKeys` · 고른 항목의 조상을 펼친 채 시작 · 가지 행은 RAC chevron `Button[slot=chevron]` · `escapeKeyBehavior: "none"` (Phase 0 발견 1) · `autoFocus` (고른 행, 없으면 첫 행).
- `drill`: `Popover` > `Dialog` > RAC `Breadcrumbs` (맨 앞 = 필드 라벨, 각 단계 `Link`) + 「뒤로」 `Button` (이름 = 네 언어 문구 `useCatalogLocalized`) + 단계마다 `key` 가 바뀌는 `GridList` (`onAction` = 가지면 들어가기 · 끝이면 고르기, `autoFocus`, `escapeKeyBehavior: "none"`).
- 모양: 열린 tree · drill 은 Canvas 가 그리지 않으므로 (R6) catalog Tree · GridList 의 record inline 모양이 없다 — Select 가 picker Popover 를 꾸미듯 Cascader rule 의 `externalStyles` (`.react-aria-Popover.cascader-panel` — 행 = 필드 M 단 · collection focus 칠 · 단계 들여쓰기 · 조용한 chevron (펼치면 90°) · 「뒤로」 · breadcrumb 줄) 가 정본이다. `columns` 는 Menu · MenuItem 시트 그대로.

**G3 결과**:

- 같은 정답표 — jsdom (`adr322CascaderWiring` 11 / 11): drill 의 Enter 들어가기 · ↓ Enter 고르기 → 「Electronics / Computers / Desktops」 (columns 와 같은 값) · 다시 열면 고른 단계 `aria-selected` · 「뒤로」 한 단계 · Esc. 방식을 바꿔도 값 · 글자가 같다 (값은 key — `mode` 와 무관).
- live `apps/builder/scripts/adr322-g3-live.mjs` (Builder → 팔레트 → `mode` 쓰기 → Publish): Chrome **6 / 6** · WebKit **6 / 6** — tree: Enter 로 열면 첫 행 focus · → ↓ → ↓ ↓ Enter → 값 · 접근성 `treegrid` · 펼친 가지 `[expanded]` · 다시 열면 조상 펼침 + `[selected]` · Esc 닫힘 · focus 복귀 / drill: 첫 행 focus · Enter 들어가기 · 고르기 · 다시 열면 고른 단계 `[selected]` · breadcrumb 으로 첫 단계 · Esc · page error 0.
- 원복 RED 4 / 4 — drill 행 동작 · 고른 행 표시 · dialog trigger (jsdom), drill `autoFocus` 는 jsdom 에서 GREEN 이라 live 로 가렸다 (빼면 focus 가 Dialog 에 남아 D1 FAIL — 실제 브라우저 RED).
- D1 정적 검사에 `cascaderPanel.components.tsx` 추가 — role · 직접 aria · 키 handler 0 (「뒤로」 의 `aria-label` 은 RAC Button prop).
- 번들 (같은 A/B, HEAD `4b09eccba`): Builder initial 1,660,973 → **1,664,269 (P1 ~ P3 = +3,296)** — 결정 8 의 +3,000 을 **296 B 넘음** (절대 상한 1,665,000 까지 731 B). P3 몫 ≈ +570 B 의 대부분은 첫 화면 rule 표에 실린 열린 모양 (`externalStyles`) 과 dialog trigger hook. 열린 내용 둘은 각자 lazy chunk (`cascaderMenu` · `cascaderPanel`). Preview JS +3 B · CSS +665 B. → 사용자 보고 (결정 8).

사용자 답 (Phase 4 진입 전, 2026-11-27): 결정 5 = 넣는다 · 결정 8 = 몫 +6,000 (Phase 1 ~ 6 합계) · Builder 절대 상한 1,668,000 재승인 (만료 그대로).
