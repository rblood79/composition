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

## 3. D1 — 조립 표 (예외 0)

| 자리          | RAC 부품                                                               | RAC 가 주는 것                                                    | 우리가 정하는 것                          |
| ------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------- |
| 여는 버튼     | `Button` (`aria-labelledby` prop) — `DialogTrigger` · `MenuTrigger` 안 | `aria-haspopup` · `aria-expanded` · press                         | 표시 글자 (경로 · 끝 항목 · 개수)         |
| `columns`     | `Popover` > `Menu` · `SubmenuTrigger` (재귀)                           | menu 계약 · 오른쪽 / 왼쪽으로 하위 메뉴 · 선택 (`menuitemradio`)  | 항목 · 고른 경로의 표시                   |
| `tree`        | `Popover` > `Dialog` > `Tree`                                          | treegrid 계약 · 펼침 · 선택 · typeahead                           | 항목 · 시작 펼침 (고른 값의 조상)         |
| `drill`       | `Popover` > `Dialog` > `Breadcrumbs` + `GridList`                      | grid 계약 · 행 동작 (`onAction`) 과 선택의 분리 · breadcrumb link | 지금 단계의 항목 · 「들어가기」 = 행 동작 |
| 검색          | `Autocomplete` > `SearchField` + `Menu`                                | 검색 중 virtual focus · 걸러내기                                  | 평평한 결과 (이름 + 경로) · 200 건        |
| 이어 불러오기 | `TreeLoadMoreItem` · `GridListLoadMoreItem`                            | 보이면 다음 쪽 요청                                               | 요청 (사용자 결정 4)                      |

- 예외 0 의 조건: 구현 파일에 `role=` · `aria-` 리터럴과 `onKeyDown` 이 없다 (RAC prop 으로 넘기는 `aria-label` · `aria-labelledby` 제외) — G2 의 정적 검사가 본다.
- 조립으로 낼 수 없어 넣지 않는 것: 연쇄 선택의 부분 표시 (`mixed`), drill 방식의 왼쪽 화살표로 뒤로 (Breadcrumbs 와 「뒤로」 Button 으로 간다), Miller columns 처럼 지나온 단계를 나란히 두는 모양.
- 「어느 단계든」 (사용자 결정 2) 의 방식별 표현: `tree` 는 모든 행이 선택 가능, `drill` 은 행의 선택 (고르기) 과 행 동작 (들어가기) 이 따로, `columns` 는 하위 메뉴의 첫 항목이 「이 단계 고르기」 다.

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
- 닫힌 필드: `path` = 조상 이름을 구분 글자로 이은 것, `leaf` = 끝 항목 이름. 값에 해당하는 항목이 없으면 (지워진 행 · 아직 불러오지 않은 단계) key 를 그대로 보여 주고 Design 패널에 알린다.
- 열 때 고른 값의 조상 단계가 펼쳐진 채로 선다 (`tree` 는 `expandedKeys`, `drill` 은 그 단계, `columns` 는 첫 단계에서 고른 경로를 표시).

### 4.3 데이터

- 정적: `CascaderItem` 자식 노드 (이름 · key · 비활성).
- 연결: `dataBinding` 의 `fieldMap` — `value` (key) · 이름 필드 · `children` 또는 `parentId` (F2). Tree 의 계층 해석을 그대로 쓴다.
- 단계마다 다른 표 (사용자 결정 5): Cascader 의 단계 목록 — 단계마다 collection 과 「부모를 가리키는 참조 필드」. 첫 단계는 부모 없음. key 는 단계와 행 key 를 합쳐 계층 전체에서 유일하게 만든다.
- 단계별 원격 로드 (사용자 결정 4): 단계를 열 때 부모 key 로 자식을 묻는 요청. 선언한 endpoint 에만 보내고, 불러오는 동안은 그 단계에 로딩 표시, 실패하면 다시 시도 Button.

### 4.4 검색

- 검색어가 있으면 방식과 무관하게 한 목록 — 항목 이름과 경로. 찾기는 이름의 부분 일치 (기존 검색 비교 — 한글 자모 규칙 포함).
- 부모 단계 고르기가 꺼져 있으면 끝 항목만 결과에 나온다.
- 표시 200 건, 넘으면 「N 건 더 — 더 입력해 좁히기」.
- 원격 단계별 로드 데이터에서는 불러온 항목에서만 찾고 그 사실을 알린다.

### 4.5 폼 · 상태 연동

- `name` 이 있으면 값 (key, 다중이면 여러 값) 을 폼 제출에 싣는다.
- 필수 (사용자 결정 6): 제출 때 값이 없으면 그 필드의 오류로 올리고 제출을 막는다 — Form 의 오류 경로를 쓴다.
- 이름 붙인 상태 = 값. When 「변경」 · 「열림 변경」. Do 「값 넣기」 · 「지우기」 · 「열기 · 닫기」.

### 4.6 Canvas

- 닫힌 필드 (라벨 · Button · 설명) 와 시작 값의 표시 글자. 표시 글자는 Preview 첫 화면과 같은 함수를 읽는다.
- 열린 목록은 그리지 않는다.

## 5. Phase

| Phase | 내용                                                                                                    | Gate |
| :---: | ------------------------------------------------------------------------------------------------------- | :--: |
|   0   | 코드 사실 재대조 · v3 확인 · 시제품 4 · 번들 · Select 열기 기준선                                       |  G0  |
|   1   | 등록 (binding · rule · template · traits · nesting · d2Provenance) · 닫힌 필드 · Canvas 정적 · contract |  G1  |
|   2   | `columns` 방식 — 정적 항목 · 단일 선택 · 값 · 표시 글자                                                 |  G2  |
|   3   | `tree` · `drill` 방식                                                                                   |  G3  |
|   4   | 데이터 연결 — 중첩 · 평면 · 단계마다 다른 표 (결정 5)                                                   |  G4  |
|   5   | 검색 · 다중 (결정 3) · 부모 단계 고르기 (결정 2) · 이름 붙인 상태 · When · Do · 속도 측정               |  G5  |
|   6   | 단계별 로드 (결정 4) · 폼 값과 필수 (결정 6) · 번들 · 종결 live · 문서                                  |  G6  |

## 6. Phase 0 시제품

| ID  | 확인할 것                                                                                                                      | go 기준                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| P1  | `columns` — `Menu` + `SubmenuTrigger` 3 단, 끝 항목 선택 (`selectionMode`) 과 하위 메뉴 열기가 한 메뉴에서 같이 서는지         | 키보드로 3 단 내려가 고르고 닫힘 · 접근성 트리에 menu 와 선택 상태 |
| P2  | `drill` — `GridList` 의 행 동작 (들어가기) 과 선택 (고르기) 분리, `Breadcrumbs` 로 뒤로, 단계가 바뀔 때 focus 가 목록에 남는지 | 키보드 전 경로 · focus 를 잃지 않음                                |
| P3  | 검색 — `Autocomplete` 가 `Menu` 의 평평한 결과를 거르는지, `Tree` 도 감쌀 수 있는지 (F1 의 미확인)                             | Menu 로 서면 go (Tree 지원은 기록만)                               |
| P4  | 5,000 항목 · 4 단 — `tree` 방식의 열기 시간과 `Virtualizer` 유무의 차이, `columns` 의 한 단계 300 항목 열기                    | HC5 안 (또는 Virtualizer 로 안)                                    |

## 7. 파일 추정 (Phase 0 에서 확정)

| 자리                | 파일                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 등록 (shared)       | 새 `bindings/Cascader.binding.ts` · `CascaderItem.binding.ts` · `bindings/index.ts` · `componentCatalog.ts` · `generated/componentRulesTable.ts` · `document/generated/reusableOriginLibrary.ts` · `document/d2Provenance.ts` · `domain/componentTraits.ts` · `nesting/requiredParts.ts` · `commands/collections.ts` (`COLLECTION_TYPE_TABLE`) |
| 실행 (shared, lazy) | 새 `runtime/cascader.ts` (경로 · 검색 계산) · `runtime/cascader.components.tsx` · `runtime/delegatedDom.runtime.ts`                                                                                                                                                                                                                            |
| 데이터 (shared)     | `collections/resolveCollectionItems.ts` (단계마다 다른 표) · 요청 형식 (결정 4)                                                                                                                                                                                                                                                                |
| 상태 연동 (shared)  | `interactions/componentInteractionSpecs.ts` · Picker concept 재사용                                                                                                                                                                                                                                                                            |
| Canvas · 패널       | `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` · `paletteItems.ts` · 단계 목록 편집기 · i18n                                                                                                                                                                                                                                       |

추정 shared 12 ~ 16 · builder 5 ~ 8 파일 + 테스트.

## 8. Phase 결과

(Phase 가 닫힐 때마다 기록)
