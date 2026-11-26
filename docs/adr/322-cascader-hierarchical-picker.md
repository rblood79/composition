# ADR-322: Cascader 컴포넌트 — 여러 단계를 파고드는 선택 필드 (방식 셋 · RAC 조립 · 닫힌 D1 예외 1 — 폼 값 input)

## Status

Proposed — 2026-11-26

- 사용자 요청: `/create-adr` (2026-11-26). 방향을 정한 원문 (같은 날): 「https://reui.io/components 분석후 우리 컴퍼넌트와 비교하고 reui가 더 편리한 부분과 차용할 부분들 비교 분석해줘」 → 비교 보고 뒤 `/create-adr`.
- 사용자가 이미 답한 것 (2026-11-26, 선택 질문 2): 범위 = 차용 후보 네 묶음 전부, 문서 단위 = 「묶음마다 ADR 하나」 (결정 지점 1 의 확정). 이 문서는 「Cascader」 묶음이다. 다른 묶음: [320](320-filter-bar-runtime-condition-builder.md) · [321](321-steplist-rating-components.md) · [323](323-timeline-event-calendar-gantt.md).
- 사용자 답 (2026-11-26, 리뷰 round 2 뒤 선택 질문): 폼 값을 싣는 숨은 input = 「값 + 필수 검증 예외」 — **결정 지점 3 (SSOT 경계 — 사용자 컴포넌트의 D1 예외 추가) 의 확정이다.** 범위는 [breakdown §3.1](design/322-cascader-hierarchical-picker-breakdown.md) 의 목록으로 닫는다. 기각된 선택지: 「값만 싣는 예외 (필수 검증 없음)」. 사용자 결정 6 (필수 검증) 도 이 답으로 「따른다」 로 확정됐다.
- 분리 점검 (4 질문) 은 [ADR-320 Status](320-filter-bar-runtime-condition-builder.md) 에 적었다. ReUI 에서는 Filters 가 Cascader 를 소비하지만 우리 필터 바 (320) 는 이 컴포넌트를 쓰지 않는다 — 두 ADR 은 서로의 선행이 아니다. 이 ADR 은 기존 ADR 을 나누거나 합치지 않는다.
- 리뷰 round 1 (2026-11-26, codex — [reviews/322.md](reviews/322.md)): HIGH 2. 둘 다 코드로 확인하고 설계에 반영했다. Round 2 의 h1 · h2 는 round 3 수리 검증에서 종결됐고, round 3 의 h3 (이름 없는 필수 필드) 도 설계에 반영했다. 사용자 결정 (2026-11-27) — round 4 는 열지 않고 h3 의 다음 판정은 구현 Gate G6 에서 한다. 리뷰 기록 pending 0. 착수는 사용자 `/execute-adr 322`.
  > round 1 반영: (h1) 다른 부모 아래의 같은 key 를 고르면 값 하나로 경로를 되찾지 못한다 → 화면 안의 항목 식별은 경로로 하고, key 가 계층 안에서 겹치는 항목은 고를 수 없다 (F10 · HC4 · Decision 4 · R3 · G4). (h2) 응답 오류 경로는 제출을 보낸 뒤라 빈 필수 값을 막지 못한다 → 숨은 값 input 이 RAC Select · DatePicker 와 같은 방식으로 폼의 검증에 참여한다 (F7 · F9 · Decision 9 · 사용자 결정 6 · R4 · G0 · G6).
  > round 2 반영 (2026-11-26): (h1) 단계별로 불러오는 계층에서는 받은 항목만으로 key 의 유일성을 알 수 없고 (A/01 만 받은 동안 01 이 제출된다), 같은 부모 아래의 같은 key 는 경로 식별자까지 겹친다 → 단계별 원격 로드는 「key 가 계층 전체에서 유일하다」 를 선언한 endpoint 만 받고, 형제의 겹치는 key 는 RAC collection 을 만들기 전에 갈라 둘 다 고를 수 없게 한다 (Decision 4 · 7 · 사용자 결정 4 · R3 · G4 · G6). (h2) 빈 다중 선택은 input 이 0 개라 제출되고, 비활성 필드가 검증과 제출에 참여한다. 숨은 input 을 직접 그리면서 「D1 예외 0」 이라 할 수 없다 → 사용자 답으로 닫힌 D1 예외 1 건으로 두고, 속성과 동작을 설치본 RAC `HiddenSelect` 와 같게 적었다 — 빈 값에도 input 하나 · `disabled` 전달 (HC2 · Decision 9 · breakdown §3.1 · R4 · G0 · G6).
  > round 3 수리 검증: 기존 h1·h2를 종결했다. 이름 없는 필수 필드의 native 제출을 막을 검증 요소가 빠지는 h3가 남는다.
  > round 3 반영 (2026-11-26): (h3) input 을 `name` 이 있을 때만 그려 Name 을 비운 필수 필드가 빈 값으로 제출됐다 → 검증 참여와 제출용 이름을 가른다 — native 필수면 이름이 없어도 검증 input 하나를 두고 (`name` 속성 없음 — FormData 에 싣지 않는다) 값을 싣는 것만 `name` 을 따른다 (Decision 9 · breakdown §3.1 · G6). 예외 목록의 요소 종류는 그대로다.

## Context

### 도메인

- **D1 (DOM · 접근성)**: 설치된 `react-aria-components` 1.22.1 에 계층 선택 필드가 없다 (`Select` · `ComboBox` 는 한 단계 목록이다). 있는 부품으로 조립한다 — 여는 버튼은 `Button`, 내용은 방식에 따라 `Menu` + `SubmenuTrigger` · `Tree` · `GridList` + `Breadcrumbs`, 검색은 `Autocomplete`. RAC 가 주지 않는 것은 폼 값을 싣는 숨은 input 하나뿐이고 닫힌 D1 예외다 (사용자 답 2026-11-26 — HC2).
- **D2 (Props)**: S2 1.8.2 · design-data 에 없다 (design-data 검색 결과는 picker · tree-view 뿐). v3 는 Phase 0 에서 확인한다. 정본 순서의 4 번 — composition 확장으로 `d2Provenance.ts` 에 적는다. 필드로서의 prop (라벨 · 설명 · 크기 · 필수) 은 S2 Picker 의 이름을 그대로 쓴다.
- **D3 (시각)**: 닫힌 필드의 모양은 S2 Picker 값을 쓰는 기존 부품 rule 이고, 열린 목록은 Menu · Tree · GridList 의 기존 rule 이다. Canvas 는 닫힌 필드만 그린다.

### 문제

업무 데이터에는 계층이 흔하다 — 지역 (시도 · 시군구 · 읍면동), 분류 (대 · 중 · 소), 조직 (본부 · 팀 · 파트). 지금 이것을 고르게 하려면 Select 를 단계 수만큼 놓고 변수와 보기 조건으로 서로 잇거나, Tree 를 화면에 펼쳐 놓아야 한다. 앞의 것은 단계 수가 고정이어야 하고 값이 여러 변수로 흩어지며, 뒤의 것은 필드 하나의 자리에 들어가지 않는다. ReUI 의 Cascader 는 필드 하나에서 단계를 파고들어 고르고 고른 경로를 보여 준다.

### 코드 사실 (2026-11-26 실측, HEAD `0ea8c33d8`)

- **F1** RAC 1.22.1 에 `SubmenuTrigger` · `Tree` (`TreeLoadMoreItem` 포함) · `GridList` · `Breadcrumbs` · `Autocomplete` · `Virtualizer` 가 있다 (`react-aria-components/dist/types/exports/`). 로컬 RAC 문서의 Autocomplete 예제는 `Menu` 를 감싼다 (`.claude/skills/react-aria/references/components/Autocomplete.md`) — `Tree` 를 감쌀 수 있는지는 확인하지 못했다 (Phase 0).
- **F2** 계층 데이터의 역할은 이미 있다 — `fieldMap.children` (중첩 배열) 과 `fieldMap.parentId` (평면 행), Tree 와 Table 이 같은 역할을 읽는다 (`packages/shared/src/collections/resolveCollectionItems.ts:268-273`).
- **F3** Tree 의 Preview renderer 와 이어 불러오기 항목이 있다 (`catalog/runtime/delegatedDom.runtime.ts:612`), Tree 의 상태 concept 과 끌기 옵션도 등록되어 있다 (`interactions/componentInteractionSpecs.ts:318`, `:509`).
- **F4** 필드 가족의 등록 선례는 Select 다 (`catalog/bindings/Select.binding.ts` — `renderer: "select"`, 라벨 · 설명 · placeholder · 크기 · 라벨 위치, 항목은 자식 노드 또는 `dataBinding`).
- **F5** 버튼이 Popover 안의 Dialog 를 여는 조립 선례가 있다 — 열 필터 (`catalog/runtime/tableOperationsDom.components.tsx:396-453`).
- **F6** 다중 선택한 Select 는 2 개부터 개수로 표시한다 (S2 계약 — `.claude/rules/ssot-hierarchy-context.md` §Select 다중 선택).
- **F7** Form 은 응답의 필드 오류를 `validationErrors` 로 필드에 올린다 (`catalog/runtime/catalogPreviewInteractions.ts:624-705`). 이 길은 endpoint 가 답한 **뒤** 다 — 빈 필수 값의 제출을 막지 못한다.
- **F8** `LIBRARY_CONTRACT_VERSION` 79, initial 번들 여유 Builder 약 10,600 B (상한 만료 2026-12-25 — Phase 0 재측정).
- **F9** RAC 의 선택 필드가 폼 검증에 참여하는 방식은 숨은 값 input 이다 — Select 는 `input[type=text]` 를 보이지 않게 두고 `required` 를 주며 (`react-aria/dist/private/select/HiddenSelect.mjs:135-145` — 주석 「`type=hidden` 대신 — 빈 값이 제출을 막도록」), DatePicker 는 `input[type=text]` 에 `hidden` · `required` 를 준다 (`react-aria/dist/private/datepicker/useDateField.mjs:131-135`). 둘 다 `useFormValidation` 이 `invalid` 를 받아 오류를 올리고 focus 를 조작 요소로 넘긴다. `input[type=hidden]` 은 제약 검증 대상이 아니다 (리뷰 round 1 의 Chrome 실측 — `required` 와 빈 값에도 제출된다).
- **F10** 항목 key 는 행의 key 필드 값 그대로다 (`collections/resolveCollectionItems.ts:340-351` `getItemKey`). 계층 안에서 유일한지는 보지 않는다 — 중첩 데이터에서 다른 부모 아래의 두 항목이 같은 key 를 가질 수 있다. 평면 행 (`parentId`) 은 부모를 key 로 가리키므로 key 가 유일해야 계층이 선다.

### 레퍼런스

- **ReUI Cascader** (`reui.io/docs/components/base/cascader`, registry 소스 11 파일 — 2026-11-26 읽음): Base UI Combobox 위의 조립형. `mode` 는 `drill` (기본 — 한 번에 한 단계 + breadcrumb) · `columns` (Miller columns) · `tree` (제자리 펼침). `selectable: leaf | any` (부모 선택), `multiple` + `cascade` (연쇄 — 부분 선택은 `aria-checked="mixed"`), `searchScope: level | deep | global` (깊은 검색은 결과에 조상 경로, 200 건 상한), `getChildren(node, { signal, cursor })` (단계별 로드), 표시는 `display: path | leaf | count`. focus 는 목록으로 옮기지 않고 `aria-activedescendant` 만 쓴다.
- **Ant Design Cascader**: `changeOnSelect` (부모 선택) · `showSearch` · `loadData` (검색과 같이 쓸 수 없다) · `multiple` · `showCheckedStrategy` · `displayRender` (기본 `label.join('/')`) · `expandTrigger: click | hover`.
- 대조 표 전문은 [breakdown §2](design/322-cascader-hierarchical-picker-breakdown.md).

### Hard constraints

- **HC1** 새 런타임 의존성 0.
- **HC2** D1 예외는 breakdown §3.1 의 목록으로 닫힌다 (사용자 답 2026-11-26) — 폼 값을 싣는 숨은 input 요소 하나와 그 검증 연결. 그 밖의 role · `aria-*` · 키 handler 는 RAC 컴포넌트가 내는 것뿐이고, 라벨 · 오류 문구의 연결은 RAC 가 받는 prop 과 context 로 한다. 구현이 그 목록을 넘으면 안 된다 (정적 검사). 조립으로 풀리지 않는 것이 더 나오면 멈추고 사용자에게 보고한다 (결정 지점 3).
- **HC3** 대칭: 같은 작성 값에서 Canvas 와 Preview 첫 화면의 닫힌 필드 rect 가 ±1 px 로 같다 (기준값 = 실제 Chrome).
- **HC4** 값은 항목의 key 하나다 (다중이면 key 목록). 경로는 값에서 계산한다 — 경로를 따로 저장하지 않는다. 그래서 값이 되는 key 는 계층 전체에서 한 항목만 가리켜야 한다 — 둘 이상의 항목이 가진 key 는 값으로 받지 않는다.
- **HC5** 성능: 5,000 항목 · 4 단 데이터에서 열기 → 첫 목록 표시가 같은 문서의 5,000 항목 Select 열기 기준선의 1.5 배 안 (CPU 1x · 4x 병기).
- **HC6** 번들: initial Δ 는 사용자 결정 8 안. 열린 내용 (목록 · 검색) 은 lazy chunk 다.
- **HC7** 키보드만으로 열기 · 단계 이동 · 고르기 · 검색 · 닫기 전부.
- **HC8** 문서 변환 코드 0 — contract 는 더하기만.

### Soft constraints

- 만드는 사이트의 동작 방식은 하나로 좁히지 않는다 — 방식 셋을 모두 고를 수 있게 한다 (사용자 원칙 2026-11-15).
- RTL 은 대상이 아니다.
- 사용자는 비개발자다 — 계층 데이터를 연결하면 단계가 자동으로 선다.

## Alternatives Considered

### 대안 A: 제3자 Cascader 도입 (ReUI 소스 복사 또는 `rc-cascader`)

- 설명: ReUI 의 11 파일을 복사하거나 Ant Design 의 `rc-cascader` 를 감싼다.
- 위험: 기술 MEDIUM / 성능 MEDIUM (Base UI Combobox · TanStack Virtual 이 번들에 든다) / 유지보수 **HIGH** (DOM 과 focus 모델이 D1 정본 밖 · 스타일을 Canvas 가 그릴 수 없다) / 마이그레이션 LOW.

### 대안 B: 전용 `Cascader` 필드 + RAC 조립 (채택)

- 설명: 필드 가족의 새 type 하나. 여는 버튼은 RAC `Button`, 열린 내용은 방식마다 RAC 부품으로 조립한다. 데이터는 Tree 와 같은 계층 역할을 읽는다.
- 근거: F1 (부품) · F2 (계층 역할) · F3 · F4 · F5 (선례).
- 위험: 기술 MEDIUM (방식 셋의 조립 · 검색) / 성능 MEDIUM (HC5) / 유지보수 MEDIUM (조립을 우리가 유지) / 마이그레이션 LOW.

### 대안 C: 새 컴포넌트 없이 종속 Select 묶음을 만드는 저작 명령

- 설명: 「단계 선택 추가」 가 Select 를 단계 수만큼 놓고 변수 · 보기 조건으로 잇는다.
- 근거: 새 type 0 · 지금 기구로 된다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 MEDIUM (단계마다 변수 · 규칙 · 보기) / 마이그레이션 LOW. 단계 수가 고정이어야 하고 (깊이가 행마다 다른 분류를 다루지 못한다), 값이 여러 변수로 흩어지며, 한 칸에 경로를 보여 주지 못한다 — 범위를 채우지 못한다.

### 대안 D: Popover 안에 Tree 를 넣는 조합을 안내

- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW. 필드의 계약 (라벨 · 값 표시 · 폼 값 · 필수) 이 없다 — 범위를 채우지 못한다.

### Risk Threshold Check

| 대안 | HIGH 이상       | 판정               |
| ---- | --------------- | ------------------ |
| A    | 유지보수        | 기각               |
| B    | 없음 (MEDIUM 3) | 채택 — 루프 불필요 |
| C    | 없음            | 범위 미달로 기각   |
| D    | 없음            | 범위 미달로 기각   |

## Decision

**대안 B 를 채택한다.**

1. **type** — `Cascader` (필드 가족) 와 정적 항목 `CascaderItem` (재귀). 필드 prop 은 S2 Picker 의 이름이다 (라벨 · 설명 · placeholder · 크기 · 라벨 위치 · 필수 · 비활성 · 오류).
2. **여는 버튼** — `DialogTrigger` (또는 방식에 따라 `MenuTrigger`) 안의 RAC `Button` 이다. 라벨과의 연결은 RAC 가 받는 `aria-labelledby` prop 으로 한다.
3. **방식 셋** — `mode` 로 고른다. 기본값은 사용자 결정 1.
   - `columns`: `Menu` + `SubmenuTrigger`. 하위 단계가 옆으로 펼쳐지고 오른쪽 · 왼쪽 화살표로 단계를 오간다.
   - `tree`: `Popover > Dialog` 안의 `Tree`. 제자리에서 펼치고 고른다.
   - `drill`: `Popover > Dialog` 안의 `Breadcrumbs` + `GridList`. 한 번에 한 단계를 보여 주고 행의 동작이 다음 단계로 들어간다.
4. **값** — 고른 항목의 key 하나 (HC4). 화면 안의 항목 식별 (RAC 의 항목 id · 펼침 · focus) 은 경로 (조상 key 사슬) 로 하고, 밖으로 나가는 값 (폼 · 이름 붙인 상태 · When 인자) 은 key 다. key 가 계층 안에서 둘 이상의 항목에 있으면 그 항목들은 고를 수 없는 항목으로 그리고 (RAC `disabledKeys`) 필드가 그 사실을 알린다 — 값 하나로 경로를 되찾을 수 없는 선택을 받지 않는다. 같은 부모 아래의 같은 key (경로까지 같다) 는 RAC collection 을 만들기 전에 경로 식별자에 순번을 붙여 가르고 둘 다 고를 수 없게 한다. 이 판정은 계층 전체를 가진 데이터에서만 선다 — 단계별로 불러오는 데이터의 유일성은 endpoint 의 선언이 맡는다 (Decision 7). 시작 값 · Do 「값 넣기」 · 변수에서 온 값도 같은 판정을 지나고, 항목이 없거나 겹치는 key 는 거절로 보고한다 (첫 항목으로 조용히 맞추지 않는다). 닫힌 필드는 경로 전체 또는 끝 항목 이름을 보여 준다 (사용자 결정 7). 다중 선택은 2 개부터 개수로 표시한다 (F6).
5. **부모 단계 고르기** — 기본은 끝 항목만이고 「어느 단계든」 은 사용자 결정 2.
6. **다중 선택** — 사용자 결정 3. 연쇄 (부모를 고르면 하위 전체 · 부분 선택 표시) 는 RAC 가 부분 선택 상태를 내지 않으므로 권고에서 뺀다.
7. **데이터** — 정적 항목 (자식 노드) 또는 `dataBinding`. 연결하면 Tree 와 같은 역할 (`children` 중첩 또는 `parentId` 평면) 로 단계가 선다. 단계마다 다른 표를 잇는 모양은 사용자 결정 5, 단계별 원격 로드는 사용자 결정 4. 단계별 원격 로드는 「key 가 계층 전체에서 유일하다」 를 선언한 endpoint 에만 켠다 — 받은 항목만으로는 유일성을 알 수 없다 (A/01 만 받은 동안 01 을 고를 수 있고 B/01 이 나중에 온다). 선언이 없으면 전량을 불러오는 길만 쓴다. 선언과 다르게 겹치는 key 가 나중에 도착하면 그때부터 그 항목들을 고를 수 없게 하고, 지금 값이 그 key 면 값을 비우며 알린다 (서버가 선언을 어긴 것으로 보고한다).
8. **검색** — 검색어가 있으면 모든 단계의 항목을 경로와 함께 한 목록으로 보여 준다 (`Autocomplete` + `Menu`, 표시 200 건). 찾기는 항목 이름의 부분 일치이고 한글은 기존 검색 비교를 쓴다.
9. **폼** — `name` 이 있으면 값을 폼에 싣는다. 검증 참여는 이름과 별개다 — native 필수 필드는 `name` 이 없어도 검증 input 하나를 두어 빈 값의 제출을 막는다 (그 input 은 `name` 속성이 없어 FormData 에 실리지 않는다). 값을 싣는 요소는 숨은 값 input 이다 (닫힌 D1 예외 — 속성과 동작은 설치본 RAC `HiddenSelect` 의 input 길과 같다, F9): 값이 비어도 input 하나를 두고 (빈 다중 선택도 — 그 input 이 `required` 를 든다), 다중이면 key 마다 하나, 비활성 필드는 `disabled` 를 넘겨 검증과 제출에서 빠진다. Form 의 `!event.formData` 가 그 값을 읽는다. 필수 (사용자 결정 6 — 확정) 는 Form 의 검증 방식을 따른다 — native 면 첫 input 의 `required` 가 빈 값의 제출을 막고, react-aria `useFormValidation` 이 오류를 필드의 FieldError 에 올리고 focus 를 여는 버튼으로 넘긴다. aria 방식에서는 RAC 필드와 같이 제출을 막지 않는다. 응답 오류 (F7) 는 그 뒤의 별도 경로로 그대로 둔다.
10. **상태 연동** — 이름 붙인 상태 (값), When 「변경」 · 「열림 변경」, Do 「값 넣기 · 지우기」. Picker 의 concept 을 그대로 쓴다.
11. **Canvas** — 닫힌 필드와 시작 값의 표시 글자만 그린다.
12. **하지 않는 것**
    - 제3자 Cascader 도입 (대안 A).
    - 연쇄 선택의 부분 선택 표시 — D1 예외가 필요하다.
    - hover 로 하위 단계 열기를 따로 만드는 일 — RAC `SubmenuTrigger` 가 주는 동작 그대로 둔다.
    - 목록 아래의 임의 명령 줄 (ReUI footer actions) · 항목의 임의 렌더 함수.
    - 문서 변환 코드 (HC8).

위험 수용 근거: B 의 남는 위험은 방식 셋의 조립이다. 셋 모두 RAC 가 키보드 · 낭독 계약을 가진 부품 (Menu · Tree · GridList) 이고, Phase 0 의 시제품이 방식마다 go / no-go 를 가른다 — 서지 않는 방식은 그 방식만 뺀다. 데이터 쪽은 Tree 가 이미 읽는 역할이다.

기각 사유:

- **A** — DOM 과 focus 모델이 RAC 가 아니고 스타일을 Canvas 가 그릴 수 없다.
- **C** — 깊이가 고정이어야 하고 값이 흩어지며 경로를 한 칸에 보여 주지 못한다.
- **D** — 필드의 계약이 없다.

> 구현 상세: [322-cascader-hierarchical-picker-breakdown.md](design/322-cascader-hierarchical-picker-breakdown.md)

### 사용자 결정 (8 건 — 6 번은 확정, 나머지는 그 Phase 에 닿을 때 묻는다)

|  #  | 항목                                                                                                                                    | 권고                                                                                                                                                                                                                                                                | 닿는 Phase |
| :-: | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------: |
|  1  | 기본 방식 — `columns` / `tree` / `drill`                                                                                                | `columns` — 익숙한 모양이고 RAC Menu 가 단계 사이의 화살표 이동을 준다. 셋 다 고를 수 있다                                                                                                                                                                          |     1      |
|  2  | 부모 단계 고르기 — 끝 항목만 / 「어느 단계든」 스위치 추가                                                                              | 스위치 추가 (기본 끝 항목만) — 「서울 전체」 처럼 중간 단계에서 멈추는 선택이 필요하다                                                                                                                                                                              |     5      |
|  3  | 다중 선택 — 넣는다 (고른 항목만 값) / 연쇄까지 (D1 예외 필요) / 단일만                                                                  | 넣되 연쇄 없음 — 연쇄의 부분 선택 표시는 RAC 가 내지 않는다                                                                                                                                                                                                         |     5      |
|  4  | 단계별 원격 로드 — 넣는다 (부모 key 로 자식을 묻는 요청과 「key 가 계층 전체에서 유일」 을 선언한 endpoint 만) / 전량을 불러온 데이터만 | 넣는다 — 큰 계층 (행정구역 · 품목) 은 한 번에 불러오지 못한다. 요청 형식은 ADR-313 의 외부 API 계약과 대조한다                                                                                                                                                      |     6      |
|  5  | 단계마다 다른 표 (대분류 표 · 중분류 표 · 소분류 표가 참조로 이어짐) — 넣는다 / 한 표의 계층만                                          | 넣는다 — 정규화된 업무 DB 에서 흔한 모양이다. 단계 목록에 표와 「부모를 가리키는 필드」 를 적는다. 값은 끝 단계의 행 key 다 — 「어느 단계든」 (결정 2) 과 같이 쓰면 단계가 다른 같은 key 는 고를 수 없으므로 (Decision 4), 값에 단계를 싣는 모양을 이때 같이 정한다 |     4      |
|  6  | 필수 검증 — Form 의 검증 방식을 따른다 (native 면 빈 값이 제출을 막고 필드에 오류 · focus) / 넣지 않는다 (`isRequired` 를 내지 않는다)  | **확정 (사용자 답 2026-11-26): 따른다** — 숨은 값 input 이 RAC Select 와 같은 방식으로 폼 검증에 참여한다 (F9 · 닫힌 D1 예외). 응답 오류 경로 (F7) 는 제출을 보낸 뒤라 빈 값을 막지 못한다                                                                          |     6      |
|  7  | 닫힌 필드의 표시 기본값 — 경로 전체 (「서울 / 강남구 / 역삼동」) / 끝 항목만                                                            | 경로 전체 — 같은 이름의 끝 항목 (「중구」) 이 여러 부모에 있다. prop 으로 바꿀 수 있다                                                                                                                                                                              |     2      |
|  8  | 번들 Δ 수용 범위                                                                                                                        | initial Δ ≤ Builder +3,000 · Preview +2,000 B gzip. 넘으면 보고                                                                                                                                                                                                     |  각 Phase  |

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 방식 셋의 조립에서 키보드 · 낭독이 서지 않는다 (하위 메뉴 안의 선택 · drill 행의 「들어가기」 와 「고르기」 구분 · Dialog 안 Tree · 검색 목록) — 새 `catalog/runtime/cascader.components.tsx`, 선례 `tableOperationsDom.components.tsx:396-453` · `delegatedDom.runtime.ts:612`                                                                                                                                                                                                                                                                 |  HIGH  | G0 시제품 P1 ~ P3 의 방식별 go / no-go. no-go 인 방식은 빼고 보고하고, 셋 다 서지 않으면 사용자에게 D1 예외를 묻는다 (결정 지점 3). G6 VoiceOver                                                                                                                                                                                                                |
| R2  | 큰 계층에서 열기가 느리다 (HC5) — Tree 방식이 전 항목을 그린다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | MEDIUM | G0 시제품 P4 — 5,000 항목. 넘으면 Tree 방식에 RAC `Virtualizer` 를 쓴다                                                                                                                                                                                                                                                                                         |
| R3  | 값 key 가 계층 전체에서 유일하지 않은 데이터 — 다른 부모 아래의 같은 key 를 고르면 폼 · 상태에 key 하나만 남아 다시 열 때 어느 조상을 펼칠지 모른다. `collections/resolveCollectionItems.ts:340-351` (`getItemKey` — 유일성 검사 없음), `catalog/resolution/resolver.ts:1049` (`nestTreeRows` — 하위 행을 그대로 반복), `catalog/runtime/catalogPreviewSession.ts:1605` (`treeFieldKeyOf`), 새 `catalog/runtime/cascader.ts` (항목 표). 단계별로 불러오는 데이터는 받은 항목만으로 유일성을 알 수 없고, 형제의 같은 key 는 경로 식별자도 겹친다 |  HIGH  | 항목 식별은 경로, 겹치는 key 의 항목은 고를 수 없음 + 필드의 알림, 값 쓰기는 같은 판정으로 거절 (Decision 4). 단계별 원격 로드는 유일성을 선언한 endpoint 만 (Decision 7), 형제 충돌은 collection 을 만들기 전에 가른다. G4 — 다른 부모의 같은 key · 같은 부모의 같은 key 정답표. G6 — 늦게 도착한 충돌. Design 패널은 「key 필드를 유일한 필드로」 를 안내한다 |
| R4  | 빈 필수 값이 제출된다 — 응답 오류 경로는 제출 뒤다 (`catalog/runtime/catalogPreviewInteractions.ts:624-705`), `input[type=hidden]` 은 검증 대상이 아니다 (F9), Form 의 제출은 `requestSubmit()` 의 native 검증을 지난다 (dispatcher `invokeImperative`), 새 `catalog/runtime/cascader.components.tsx` 의 값 input. 빈 다중 선택이나 이름 없는 필드에 input 이 없으면 `required` 를 들 요소가 없고, `disabled` 를 넘기지 않으면 비활성 필드가 제출을 막거나 값을 싣는다                                                                          |  HIGH  | 숨은 값 input + `useFormValidation` (Decision 9 — 닫힌 D1 예외, breakdown §3.1). G0 시제품 P5 의 go / no-go — 서지 않으면 사용자에게 보고. G6 — 단일 · 다중 · 비활성 × native · aria 의 제출 표, 구현의 속성 = §3.1 (정적 검사)                                                                                                                                 |
| R7  | 단계별 로드가 새 요청 계약을 만든다 (사용자 결정 4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | MEDIUM | Phase 6 의 inventory 로 자리를 세고 ADR-313 과 대조한 뒤 확정한다                                                                                                                                                                                                                                                                                               |
| R5  | initial 번들 (F8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | MEDIUM | G0 기준선 · Phase 마다 Δ (사용자 결정 8)                                                                                                                                                                                                                                                                                                                        |
| R6  | Canvas 는 열린 목록을 보여 주지 않는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |  LOW   | 닫힌 필드만 대칭 기준으로 둔다 (HC3). 열린 모양은 Library page 의 표시 상태 (ADR-278) 로 본다                                                                                                                                                                                                                                                                   |

HIGH 가 셋 (R1 · R3 · R4) 이다. Phase 를 다른 ADR 로 나누지 않는다 — 셋 다 Cascader 한 컴포넌트의 조립 · 값 · 폼이고, 떼어 내면 값이 없는 필드가 남는다.

## Gates

측정 조건 ([measurement-validity.md](../../.claude/rules/measurement-validity.md)): 속도 측정의 데이터는 부하용 생성 계층 (규모 전용 — 5,000 항목 · 4 단 · 한 부모 아래 최대 300), 불리한 경우 = Tree 방식에서 전부 펼친 채 열기와 깊은 검색 한 글자, 대조군 = 같은 문서의 5,000 항목 Select 열기와 교대 3 쌍, 조건 = production 빌드 · headed Chrome · 보이는 탭 · CPU 1x 와 4x. 고르기 결과의 기준값은 따로 적은 정답표다. 폼 검증의 기준은 실제 브라우저의 동작 (제출 이벤트 수 · endpoint 호출 수) 이고 Chrome 과 WebKit 둘 다 본다.

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 실패 시 대안                                             |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| G0   | Phase 0 끝 | 코드 사실 F1 ~ F10 재대조 차이 0 · v3 확인 · 시제품 5 (방식 셋의 조립 · 검색 목록 · 5,000 항목 · 숨은 값 input 의 필수 검증) 의 go / no-go · 번들 기준선                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | no-go 인 방식을 빼고 사용자에게 보고 (D1 은 결정 지점 3) |
| G1   | Phase 1 끝 | 등록 게이트 (`pnpm codex:preflight` 의 registration · `d2S2Alignment.static.test.ts`) · contract · 닫힌 필드의 Canvas rect = Chrome rect ±1 px · `/cross-check` · 원복 RED                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 어긋나는 필드 부품을 Select 의 것과 맞춘다               |
| G2   | Phase 2 끝 | `columns` 방식 — 정적 항목 3 단에서 고르기 · 값 · 표시 글자가 정답표와 일치 · 키보드 전 경로 · role · `aria-*` 가 RAC 가 낸 것뿐 (정적 검사) · Chrome 과 WebKit live                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 표시 글자를 끝 항목만으로                                |
| G3   | Phase 3 끝 | `tree` · `drill` 방식이 같은 정답표를 통과 · 방식을 바꿔도 값이 같다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 서지 않는 방식을 뺀다                                    |
| G4   | Phase 4 끝 | 데이터 연결 — 중첩 · 평면 · (결정 5) 단계마다 다른 표의 세 모양에서 단계가 서고 값 = 행 key · 겹치는 key 정답표 (A 와 B 아래 각각 `id=01` 인 끝 항목: 둘 다 고를 수 없고 필드가 알림 · 유일한 key 는 고른 뒤 다시 열면 그 조상이 펼쳐짐 · 겹치는 key 와 없는 key 의 「값 넣기」 · 시작 값은 거절 보고 · 같은 부모 A 아래 `id=01` 둘: 목록에 두 항목이 따로 그려지고 (RAC 의 항목 id 가 겹치지 않음) 둘 다 고를 수 없음)                                                                                                                                                                                                                                                                                                  | 단계마다 다른 표를 빼고 보고                             |
| G5   | Phase 5 끝 | 검색 (경로 표시 · 200 건) · 다중 · 부모 단계 고르기 · 이름 붙인 상태 · When · Do 가 정답표와 일치 · HC5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 깊은 검색을 지금 단계 안의 찾기로 줄인다                 |
| G6   | Phase 6 끝 | 단계별 로드 (결정 4 — 유일성 선언이 없는 endpoint 에서는 켜지지 않음 · 선언한 endpoint 에서 A/01 을 고른 뒤 B/01 이 도착하면 두 항목이 고를 수 없게 되고 값이 비며 알림) · 폼 값 (`!event.formData` 에 key) · 필수 검증 (결정 6 — native: 빈 필수 단일 · 빈 필수 다중 모두 submit 0 · 필드 오류 · focus 가 여는 버튼 · endpoint 호출 0 회, 값을 고른 뒤 제출 1 회 / 비활성 필드: 비어도 제출을 막지 않고 값이 있어도 FormData 에 없음 / 이름 없는 필수 필드: 빈 값이면 submit 0 · focus 가 여는 버튼, 값이 있으면 submit 1, 어느 쪽도 FormData 항목 0 / aria: 비어도 제출됨 — Chrome 과 WebKit) · 숨은 input 의 속성 = breakdown §3.1 (정적 검사) · 번들 (결정 8) · `/evaluate` 종결 live · VoiceOver 청취와 사용자 확인 | 넘는 항목을 수리하거나 빼고 보고                         |

집행: 각 Gate 의 테스트는 unit · browser project 에 두고 Phase 끝에 실행자가 `pnpm -F @composition/shared test` · `pnpm -F @composition/builder test` (browser 는 `test:parity`) 와 `pnpm codex:preflight` 로 돌려 결과를 breakdown §8 에 적는다. 번들은 `adr201-bundle-gate.mjs` 와 배포 workflow (`push: main`) 의 상한 단계가 막는다.

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 계층 데이터를 필드 하나로 고른다 — 단계 수가 달라도 되고 값이 key 하나다.
- 필수 검증이 다른 선택 필드 (Select · DatePicker) 와 같은 방식으로 Form 에 참여한다 — 빈 값이 서버로 가지 않는다.
- 계층 데이터를 연결하면 단계가 자동으로 선다 (Tree 와 같은 역할).
- 방식 셋을 사이트마다 고를 수 있고, 모두 RAC 의 키보드 · 낭독 계약이다.

### Negative

- 조립 셋을 우리가 유지한다. ReUI 의 일부 기능 (연쇄 선택의 부분 표시 · 목록 아래 명령 줄 · 임의 렌더) 은 없다.
- `columns` 방식은 Miller columns 처럼 지나온 단계가 나란히 남는 모양이 아니라 하위 메뉴가 옆으로 펼쳐지는 모양이다.
- contract 가 오르고 initial 번들에 등록 몫이 더해진다 (사용자 결정 8).
- 사용자 컴포넌트의 D1 예외가 하나 는다 — 폼 값을 싣는 숨은 input (접근성 트리 밖).
- key 가 계층 안에서 겹치는 데이터는 그 항목을 고를 수 없다 — 작성자가 key 필드를 유일한 필드로 바꿔야 한다.
- Canvas 는 열린 목록을 보여 주지 않는다.
