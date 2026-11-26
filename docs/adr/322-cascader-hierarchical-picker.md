# ADR-322: Cascader 컴포넌트 — 여러 단계를 파고드는 선택 필드 (방식 셋 · RAC 조립 · D1 예외 0)

## Status

Proposed — 2026-11-26

- 사용자 요청: `/create-adr` (2026-11-26). 방향을 정한 원문 (같은 날): 「https://reui.io/components 분석후 우리 컴퍼넌트와 비교하고 reui가 더 편리한 부분과 차용할 부분들 비교 분석해줘」 → 비교 보고 뒤 `/create-adr`.
- 사용자가 이미 답한 것 (2026-11-26, 선택 질문 2): 범위 = 차용 후보 네 묶음 전부, 문서 단위 = 「묶음마다 ADR 하나」 (결정 지점 1 의 확정). 이 문서는 「Cascader」 묶음이다. 다른 묶음: [320](320-filter-bar-runtime-condition-builder.md) · [321](321-steplist-rating-components.md) · [323](323-timeline-event-calendar-gantt.md).
- 분리 점검 (4 질문) 은 [ADR-320 Status](320-filter-bar-runtime-condition-builder.md) 에 적었다. ReUI 에서는 Filters 가 Cascader 를 소비하지만 우리 필터 바 (320) 는 이 컴포넌트를 쓰지 않는다 — 두 ADR 은 서로의 선행이 아니다. 이 ADR 은 기존 ADR 을 나누거나 합치지 않는다.
- 리뷰 전. 착수는 사용자 `/execute-adr 322`.

## Context

### 도메인

- **D1 (DOM · 접근성)**: 설치된 `react-aria-components` 1.22.1 에 계층 선택 필드가 없다 (`Select` · `ComboBox` 는 한 단계 목록이다). 있는 부품으로 조립한다 — 여는 버튼은 `Button`, 내용은 방식에 따라 `Menu` + `SubmenuTrigger` · `Tree` · `GridList` + `Breadcrumbs`, 검색은 `Autocomplete`. **D1 예외를 만들지 않는 것이 제약이다** (HC2).
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
- **F7** Form 은 응답의 필드 오류를 `validationErrors` 로 필드에 올린다 (`catalog/runtime/catalogPreviewInteractions.ts:624-705`).
- **F8** `LIBRARY_CONTRACT_VERSION` 79, initial 번들 여유 Builder 약 10,600 B (상한 만료 2026-12-25 — Phase 0 재측정).

### 레퍼런스

- **ReUI Cascader** (`reui.io/docs/components/base/cascader`, registry 소스 11 파일 — 2026-11-26 읽음): Base UI Combobox 위의 조립형. `mode` 는 `drill` (기본 — 한 번에 한 단계 + breadcrumb) · `columns` (Miller columns) · `tree` (제자리 펼침). `selectable: leaf | any` (부모 선택), `multiple` + `cascade` (연쇄 — 부분 선택은 `aria-checked="mixed"`), `searchScope: level | deep | global` (깊은 검색은 결과에 조상 경로, 200 건 상한), `getChildren(node, { signal, cursor })` (단계별 로드), 표시는 `display: path | leaf | count`. focus 는 목록으로 옮기지 않고 `aria-activedescendant` 만 쓴다.
- **Ant Design Cascader**: `changeOnSelect` (부모 선택) · `showSearch` · `loadData` (검색과 같이 쓸 수 없다) · `multiple` · `showCheckedStrategy` · `displayRender` (기본 `label.join('/')`) · `expandTrigger: click | hover`.
- 대조 표 전문은 [breakdown §2](design/322-cascader-hierarchical-picker-breakdown.md).

### Hard constraints

- **HC1** 새 런타임 의존성 0.
- **HC2** D1 예외 0 — role · `aria-*` · 키 handler 는 RAC 컴포넌트가 내는 것뿐이다. 조립으로 풀리지 않는 것이 나오면 멈추고 사용자에게 보고한다 (결정 지점 3).
- **HC3** 대칭: 같은 작성 값에서 Canvas 와 Preview 첫 화면의 닫힌 필드 rect 가 ±1 px 로 같다 (기준값 = 실제 Chrome).
- **HC4** 값은 항목의 key 하나다 (다중이면 key 목록). 경로는 값에서 계산한다 — 경로를 따로 저장하지 않는다.
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
4. **값** — 고른 항목의 key 하나 (HC4). 닫힌 필드는 경로 전체 또는 끝 항목 이름을 보여 준다 (사용자 결정 7). 다중 선택은 2 개부터 개수로 표시한다 (F6).
5. **부모 단계 고르기** — 기본은 끝 항목만이고 「어느 단계든」 은 사용자 결정 2.
6. **다중 선택** — 사용자 결정 3. 연쇄 (부모를 고르면 하위 전체 · 부분 선택 표시) 는 RAC 가 부분 선택 상태를 내지 않으므로 권고에서 뺀다.
7. **데이터** — 정적 항목 (자식 노드) 또는 `dataBinding`. 연결하면 Tree 와 같은 역할 (`children` 중첩 또는 `parentId` 평면) 로 단계가 선다. 단계마다 다른 표를 잇는 모양은 사용자 결정 5, 단계별 원격 로드는 사용자 결정 4.
8. **검색** — 검색어가 있으면 모든 단계의 항목을 경로와 함께 한 목록으로 보여 준다 (`Autocomplete` + `Menu`, 표시 200 건). 찾기는 항목 이름의 부분 일치이고 한글은 기존 검색 비교를 쓴다.
9. **폼** — `name` 이 있으면 값을 폼에 싣는다. 필수 검증은 사용자 결정 6.
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

### 사용자 결정 (8 건 — 그 Phase 에 닿을 때 묻는다)

|  #  | 항목                                                                                                   | 권고                                                                                                           | 닿는 Phase |
| :-: | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | :--------: |
|  1  | 기본 방식 — `columns` / `tree` / `drill`                                                               | `columns` — 익숙한 모양이고 RAC Menu 가 단계 사이의 화살표 이동을 준다. 셋 다 고를 수 있다                     |     1      |
|  2  | 부모 단계 고르기 — 끝 항목만 / 「어느 단계든」 스위치 추가                                             | 스위치 추가 (기본 끝 항목만) — 「서울 전체」 처럼 중간 단계에서 멈추는 선택이 필요하다                         |     5      |
|  3  | 다중 선택 — 넣는다 (고른 항목만 값) / 연쇄까지 (D1 예외 필요) / 단일만                                 | 넣되 연쇄 없음 — 연쇄의 부분 선택 표시는 RAC 가 내지 않는다                                                    |     5      |
|  4  | 단계별 원격 로드 — 넣는다 (부모 key 로 자식을 묻는 요청을 선언한 endpoint 만) / 전량을 불러온 데이터만 | 넣는다 — 큰 계층 (행정구역 · 품목) 은 한 번에 불러오지 못한다. 요청 형식은 ADR-313 의 외부 API 계약과 대조한다 |     6      |
|  5  | 단계마다 다른 표 (대분류 표 · 중분류 표 · 소분류 표가 참조로 이어짐) — 넣는다 / 한 표의 계층만         | 넣는다 — 정규화된 업무 DB 에서 흔한 모양이다. 단계 목록에 표와 「부모를 가리키는 필드」 를 적는다              |     4      |
|  6  | 필수 검증 — 폼 제출 때 값이 없으면 필드 오류로 올린다 / 넣지 않는다                                    | 올린다 — Form 이 응답 오류를 필드에 올리는 경로 (F7) 를 쓴다                                                   |     6      |
|  7  | 닫힌 필드의 표시 기본값 — 경로 전체 (「서울 / 강남구 / 역삼동」) / 끝 항목만                           | 경로 전체 — 같은 이름의 끝 항목 (「중구」) 이 여러 부모에 있다. prop 으로 바꿀 수 있다                         |     2      |
|  8  | 번들 Δ 수용 범위                                                                                       | initial Δ ≤ Builder +3,000 · Preview +2,000 B gzip. 넘으면 보고                                                |  각 Phase  |

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                            | 심각도 | 대응                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 방식 셋의 조립에서 키보드 · 낭독이 서지 않는다 (하위 메뉴 안의 선택 · drill 행의 「들어가기」 와 「고르기」 구분 · Dialog 안 Tree · 검색 목록) — 새 `catalog/runtime/cascader.components.tsx`, 선례 `tableOperationsDom.components.tsx:396-453` · `delegatedDom.runtime.ts:612` |  HIGH  | G0 시제품 P1 ~ P3 의 방식별 go / no-go. no-go 인 방식은 빼고 보고하고, 셋 다 서지 않으면 사용자에게 D1 예외를 묻는다 (결정 지점 3). G6 VoiceOver |
| R2  | 큰 계층에서 열기가 느리다 (HC5) — Tree 방식이 전 항목을 그린다                                                                                                                                                                                                                  | MEDIUM | G0 시제품 P4 — 5,000 항목. 넘으면 Tree 방식에 RAC `Virtualizer` 를 쓴다                                                                          |
| R3  | 값 key 가 계층 전체에서 유일하지 않은 데이터 (중첩 배열의 하위 항목 key 가 겹침)                                                                                                                                                                                                | MEDIUM | Tree 가 지금 쓰는 key 규칙을 그대로 쓰고, 겹치면 Design 패널에 알림을 낸다                                                                       |
| R4  | 폼 필수 검증 · 단계별 로드가 새 계약을 만든다 (사용자 결정 4 · 6)                                                                                                                                                                                                               | MEDIUM | Phase 6 의 inventory 로 자리를 세고 ADR-313 과 대조한 뒤 확정한다                                                                                |
| R5  | initial 번들 (F8)                                                                                                                                                                                                                                                               | MEDIUM | G0 기준선 · Phase 마다 Δ (사용자 결정 8)                                                                                                         |
| R6  | Canvas 는 열린 목록을 보여 주지 않는다                                                                                                                                                                                                                                          |  LOW   | 닫힌 필드만 대칭 기준으로 둔다 (HC3). 열린 모양은 Library page 의 표시 상태 (ADR-278) 로 본다                                                    |

## Gates

측정 조건 ([measurement-validity.md](../../.claude/rules/measurement-validity.md)): 속도 측정의 데이터는 부하용 생성 계층 (규모 전용 — 5,000 항목 · 4 단 · 한 부모 아래 최대 300), 불리한 경우 = Tree 방식에서 전부 펼친 채 열기와 깊은 검색 한 글자, 대조군 = 같은 문서의 5,000 항목 Select 열기와 교대 3 쌍, 조건 = production 빌드 · headed Chrome · 보이는 탭 · CPU 1x 와 4x. 고르기 결과의 기준값은 따로 적은 정답표다.

| Gate | 시점       | 통과 조건                                                                                                                                                                  | 실패 시 대안                                             |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| G0   | Phase 0 끝 | 코드 사실 F1 ~ F8 재대조 차이 0 · v3 확인 · 시제품 4 (방식 셋의 조립 · 검색 목록 · 5,000 항목) 의 go / no-go · 번들 기준선                                                 | no-go 인 방식을 빼고 사용자에게 보고 (D1 은 결정 지점 3) |
| G1   | Phase 1 끝 | 등록 게이트 (`pnpm codex:preflight` 의 registration · `d2S2Alignment.static.test.ts`) · contract · 닫힌 필드의 Canvas rect = Chrome rect ±1 px · `/cross-check` · 원복 RED | 어긋나는 필드 부품을 Select 의 것과 맞춘다               |
| G2   | Phase 2 끝 | `columns` 방식 — 정적 항목 3 단에서 고르기 · 값 · 표시 글자가 정답표와 일치 · 키보드 전 경로 · role · `aria-*` 가 RAC 가 낸 것뿐 (정적 검사) · Chrome 과 WebKit live       | 표시 글자를 끝 항목만으로                                |
| G3   | Phase 3 끝 | `tree` · `drill` 방식이 같은 정답표를 통과 · 방식을 바꿔도 값이 같다                                                                                                       | 서지 않는 방식을 뺀다                                    |
| G4   | Phase 4 끝 | 데이터 연결 — 중첩 · 평면 · (결정 5) 단계마다 다른 표의 세 모양에서 단계가 서고 값 = 행 key                                                                                | 단계마다 다른 표를 빼고 보고                             |
| G5   | Phase 5 끝 | 검색 (경로 표시 · 200 건) · 다중 · 부모 단계 고르기 · 이름 붙인 상태 · When · Do 가 정답표와 일치 · HC5                                                                    | 깊은 검색을 지금 단계 안의 찾기로 줄인다                 |
| G6   | Phase 6 끝 | 단계별 로드 · 폼 값과 필수 검증 (결정 4 · 6) · 번들 (결정 8) · `/evaluate` 종결 live · VoiceOver 청취와 사용자 확인                                                        | 넘는 항목을 수리하거나 빼고 보고                         |

집행: 각 Gate 의 테스트는 unit · browser project 에 두고 Phase 끝에 실행자가 `pnpm -F @composition/shared test` · `pnpm -F @composition/builder test` (browser 는 `test:parity`) 와 `pnpm codex:preflight` 로 돌려 결과를 breakdown §8 에 적는다. 번들은 `adr201-bundle-gate.mjs` 와 배포 workflow (`push: main`) 의 상한 단계가 막는다.

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 계층 데이터를 필드 하나로 고른다 — 단계 수가 달라도 되고 값이 key 하나다.
- 계층 데이터를 연결하면 단계가 자동으로 선다 (Tree 와 같은 역할).
- 방식 셋을 사이트마다 고를 수 있고, 모두 RAC 의 키보드 · 낭독 계약이다. D1 예외가 늘지 않는다.

### Negative

- 조립 셋을 우리가 유지한다. ReUI 의 일부 기능 (연쇄 선택의 부분 표시 · 목록 아래 명령 줄 · 임의 렌더) 은 없다.
- `columns` 방식은 Miller columns 처럼 지나온 단계가 나란히 남는 모양이 아니라 하위 메뉴가 옆으로 펼쳐지는 모양이다.
- contract 가 오르고 initial 번들에 등록 몫이 더해진다 (사용자 결정 8).
- Canvas 는 열린 목록을 보여 주지 않는다.
