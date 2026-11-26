# ADR-317 breakdown — Table 편집 격자 (붙여넣기 · 채우기 손잡이 · 편집 상태 표시 · 줄무늬 행)

> 본문: [317-table-editing-grid-paste-fill-status.md](../317-table-editing-grid-paste-fill-status.md). 코드 인용은 2026-11-25 HEAD `56e769429` 실측이고 Phase 0 에서 다시 대조한다.

## 1. 범위 · 출처

- 사용자 2026-11-25: ReUI Data Grid 대조 보고 뒤 「ADR-315의 D1 예외 목록을 넓히고 ADR로진행」.
- 범위 = 대조에서 「우리에게 없는 것」 가운데 붙여넣기 · 채우기 손잡이 · 편집 상태 표시 · 줄무늬 행. 딸린 선택 항목 (범위 지우기 · 잘라내기 · 채우기 키 · 저장 길) 은 본문의 사용자 결정 목록.
- 선행: ADR-315 (표 상태 · 칸 범위 선택) — G6 (VoiceOver 청취) 통과가 Phase 2 의 착수 조건이다.
- fork 4 질문은 본문 Context 「선행 결정」 아래에 적었다.

## 2. ReUI 대조 표

ReUI 쪽은 `reui.io/components/data-grid` 와 문서 페이지 (Base UI 판) 에서 읽었다 — 예제 7 ~ 34 의 코드 본문과 Radix 판 문서는 읽지 않았다. 「우리」 열은 코드 실측이다.

|  #  | ReUI 기능 (prop · 예제)                                                                | 우리 Table                                                | 이 ADR                         |
| :-: | -------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------ |
|  1  | 정렬 · 필터 · 후보 값 개수                                                             | 있음 (ADR-315 Phase 2 · 3)                                | —                              |
|  2  | 열 숨김 · 고정 · 폭 · 순서 (`columnsPinnable` · `columnsMovable` · `columnsDraggable`) | 있음 (ADR-315 Phase 4)                                    | —                              |
|  3  | 행 선택 · 펼침 · 계층 · 행 고정 (`rowsPinnable`)                                       | 있음 (RAC · ADR-315 Phase 5)                              | —                              |
|  4  | 합계 바닥줄 (`DataGridTableFoot`)                                                      | 있음 (`TableFooter` — 집계 11 종)                         | —                              |
|  5  | 칸 범위 선택 · 복사 (`cellSelection` · `onCellsCopy`)                                  | 있음 (`runtime/tableCellSelection.ts`)                    | base                           |
|  6  | 칸 편집 (`cellEditMode` — 칸 안 편집기)                                                | 있음, 다른 방식 (S2 `EditableCell` — popover Form)        | 그대로 둔다 (대안 A 기각)      |
|  7  | 붙여넣기 (예제 「Spreadsheet Editing」)                                                | 없음 (`paste` listener 없음)                              | Phase 2                        |
|  8  | 채우기 손잡이 (`cellFillHandle` · `cellFillHandleVariant`)                             | 없음                                                      | Phase 3                        |
|  9  | 행 상태 (`getRowStatus` — `new` · `dirty` · `deleted`) · 칸 상태 (`getCellStatus`)     | 없음 — 정보는 세션 편집 기록에 있다                       | Phase 4                        |
| 10  | 여러 칸 변경 알림 (`onCellsChange`)                                                    | 없음 — 칸 하나는 Form 의 When `onSubmit`                  | Phase 4 (사용자 결정 1)        |
| 11  | 줄무늬 행 (`stripped`) · 행 모서리 (`rowRounded`)                                      | 없음                                                      | 줄무늬만 Phase 5               |
| 12  | 행 끌기 (`rowsDraggable`)                                                              | 있음 (규칙 `onReorder` — ADR-284)                         | —                              |
| 13  | 쪽 · 이어 불러오기 · 행 · 열 가상화                                                    | 있음 (`rowDisplay` · `catalogVirtualizer.components.tsx`) | —                              |
| 14  | 빈 상태 · 불러오는 중 (`loadingMode: skeleton · spinner`)                              | 있음 (IllustratedMessage · S2 진행 원)                    | skeleton 행은 하지 않는다      |
| 15  | 행 추가 줄 (`onRowCreate` · `rowCreateLabel`)                                          | 없음 — Button + Do `append` 로 만든다                     | 하지 않는다 (규칙으로 이미 됨) |
| 16  | 칸 우클릭 메뉴                                                                         | 없음                                                      | 하지 않는다 (본문 Decision 9)  |
| 17  | 여러 줄 머리글 (`meta.headerColSpan`)                                                  | 없음                                                      | 하지 않는다 (ADR-315 유지)     |

`rowRounded` 는 넣지 않는다 — 행의 모서리는 S2 TableView 에 없는 모양이고 요청 범위가 아니다.

## 3. 설치본이 주는 것

`react-aria-components` 1.22.1 · `@react-spectrum/s2` 1.8.2.

| 능력                                 | 설치본                                                                                                   | 쓰는 방법                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 칸 편집                              | S2 `EditableCell` — `renderEditing` · `isSaving` · `onSubmit` · `onCancel` (`TableView.tsx:1586-1594`)   | 그대로 (6-6 구현 — `runtime/editableCell.components.tsx`)                                  |
| 클립보드                             | react-aria `useClipboard` — `getItems` · `onCopy` · `onCut` · `onPaste(items)` (`dnd/useClipboard.d.ts`) | Phase 0 에서 우리 `copy` listener 와 견준다 (§7 P1) — 훅은 focus 된 요소의 props 로 붙는다 |
| 칸 focus 이동                        | RAC Table (`keyboardNavigationBehavior`)                                                                 | 그대로                                                                                     |
| 붙여넣기 · 채우기 · 행 상태 · 줄무늬 | 없음                                                                                                     | 이 ADR                                                                                     |

## 4. D1 예외 — 넓힌 목록 (정본)

ADR-315 breakdown §5.6 의 목록에 **더하는 것**이다. 구현이 이 목록을 넘으면 규칙 위반이다. 구현 Phase (2 · 3) 가 끝날 때 `.claude/rules/ssot-hierarchy.md` §1 D1 의 「Table 칸 범위 선택 예외」 에 같은 목록을 적는다.

- **대상**: 「Cell selection」 과 「Paste」 (또는 「Fill handle」) 을 켠 사용자 컴포넌트 Table 의 body 칸. 머리글 · 바닥줄 · 다른 컴포넌트는 아니다.
- **직접 다루는 것**
  - 키: Ctrl / Cmd + V — 브라우저 `paste` 이벤트의 `text/plain` 을 읽는다 (키 자체를 가로채지 않는다). 표 안에 focus 가 있을 때 `beforecopy` · `beforecut` · `beforepaste` 를 막아 Safari 의 편집 메뉴 (와 그 단축키) 를 켠다 — react-aria `useClipboard` 와 같은 방법 (Phase 0 시제품 (4)).
  - 키 (사용자 결정 3 이 「넣는다」 일 때): Delete · Backspace (범위의 편집 가능 칸 비움) · Ctrl / Cmd + X (브라우저 `cut` — 복사 + 비움).
  - 키 (사용자 결정 2): Ctrl / Cmd + D (범위의 첫 행 값을 아래로 채움).
  - 포인터: 채우기 손잡이 끌기 — 마지막 범위의 오른쪽 아래 칸에 우리가 그리는 요소 (`aria-hidden` — 같은 일을 키로 할 수 있다).
  - 요소: 결과 알림 영역 하나 — 표의 감싸개 안, RAC Table 요소 밖의 `role="status"` 요소. 「칸 12 개에 붙여넣음 · 3 개 건너뜀」 같은 한 줄.
  - 속성: 편집 격자인 표의 편집할 수 없는 열 칸에 `aria-readonly="true"` — Phase 0 (§7 P5) 에서 VoiceOver 가 읽는 값이 쓸모 있을 때만 넣는다.
- **그대로 두는 것**: 칸 focus 이동 · 행 · 칸의 DOM · 한 칸 편집 (S2 `EditableCell` 의 버튼 · popover · Form) · 정렬 · 폭 조절 · 행 선택.
- **겹침 규칙**
  - `EditableCell` 의 popover 가 열려 있으면 표는 `paste` · `cut` · Delete 를 다루지 않는다 (입력 요소의 것).
  - 채우기 끌기는 손잡이 요소에서 시작한 `pointerdown` 만이다 — 칸에서 시작한 끌기는 범위 선택 (ADR-315) 그대로.
  - 행 선택을 켠 표에는 없다 (ADR-315 사용자 결정 5 — 칸 범위 선택과 한 표에서 같이 켜지 않는다).

## 5. 설계

### 5.1 묶음 쓰기 (Phase 1)

- 세션에 「여러 행 · 여러 필드를 한 번에」 쓰는 편집을 더한다. 입력은 `{ key, fields }` 목록이다.
- 한 번의 호출 = 편집 기록 한 건 · `refreshRows` 1 번 (지금 `edit` 는 건마다 부른다 — `catalogPreviewSession.ts:1149-1171`).
- 칸마다 `update` 와 같은 거르기를 지난다: schema 에 있는 필드만 · `normalizeRows(…, "text")` 변환 (`itemFields`, `:1135`) · key 필드 제외 (`:1292`) · 없는 key 는 건너뜀.
- 돌려주는 값: 쓴 칸 수 · 건너뛴 칸 수와 사유별 수 (편집 불가 열 · key 필드 · 계산 필드 · 읽기 실패 · 없는 행). 알림 영역 (§4) 과 When payload 가 이 값을 읽는다.
- 읽기 실패 판정 (review 317 round 1 h1): `normalizeRows` 를 **행마다** 한 번 불러 그 행 report 의 필드별 수로 칸을 가른다 — `unread` · `precision` (글자 칸을 열 타입으로 읽지 못함 — `readCell` 이 `null` 을 돌려준다, `normalizeRows.ts:164-178`) 과 `typeMismatch` (글자가 아닌 값이 열 타입과 다름 — 값은 그대로 돌아온다, `:184`. 가로 채우기가 다른 타입 열의 값을 옮길 때 난다). 셋 중 하나에 센 칸은 쓰지 않는다 — 원래 값 유지, 「읽기 실패」 로 센다. 빈 글자는 실패가 아니다 (열의 빈 값으로 읽힌다 — 범위 지우기가 이 길이다).
- 지금 `update` (`EditableCell` 저장 · 규칙 Do `update`, `catalogPreviewSession.ts:1135-1148`) 는 같은 경우에 `readCell` 의 `null` 을 그대로 쓴다 — 읽지 못한 글자를 넣으면 칸이 비워진다. 묶음 쓰기는 그 동작을 따르지 않는다 (붙여넣기는 머리글 줄 · 다른 열 글자가 섞이기 쉬워 조용한 비움이 곧 값 손실이다). 두 길을 맞출지는 사용자 결정 8 이다 — 맞추면 `update` 가 같은 판정 함수를 부르고 건너뛴 필드를 사유 (`reason`) 로 돌려준다. 판정 함수는 하나다 (HC2 — 두 번째 변환 없음).
- 편집 가능 판정은 표가 한다 (열의 「Editable」 — `tableColumnEditable`) — 세션은 열을 모른다. 표 controller 가 대상 칸을 고른 뒤 세션에 넘긴다 (`catalogTableController.ts` 의 `editTableRow` 옆).

### 5.2 붙여넣기 (Phase 2)

- 글자 → 칸: 줄은 `\n` · `\r\n`, 칸은 탭. 큰따옴표로 감싼 칸 안의 탭 · 줄바꿈 · `""` 를 보존한다 (Excel 의 복사 형식). Builder 의 `pasteRows.ts` 와 같은 fixture 로 검사한다 — 그쪽은 첫 줄이 머리글이고 여기는 머리글이 없다.
- 놓는 자리: 마지막 범위의 왼쪽 위 칸 (범위가 없으면 focus 된 칸) 부터 오른쪽 · 아래로. 순서는 `CatalogCellSelectionSource.order()` — 지금 보이는 행 순서와 그려진 열 순서 (숨긴 열 제외, 선택 열 제외).
- 값이 하나 (1 × 1) 이고 범위가 여러 칸이면 범위 전체에 쓴다. 그 밖에는 붙여넣는 크기대로 쓰고 범위 크기에 맞춰 되풀이하지 않는다.
- 행의 종류: 데이터 행만 쓴다. 묶음 행 · 합계 행 · 상세 행 · 작성한 고정 Row 는 자리를 차지하되 건너뛴다 (그 줄의 값은 버린다 — 화면의 줄과 클립보드의 줄이 1:1 이어야 사용자가 결과를 예측할 수 있다).
- 표 끝을 넘는 줄 · 열: 사용자 결정 4 (권고 — 버리고 알림).
- 붙여넣은 뒤 범위는 쓴 영역이 된다.
- 서버가 쪽을 나눠 주는 표: `order()` 가 내는 행 (불러온 행) 만 대상이다.

### 5.3 채우기 (Phase 3)

- 손잡이는 마지막 범위의 오른쪽 아래 칸이 그려져 있을 때만 보인다 (가상 표 — 창 밖이면 없음).
- 끌기: 손잡이에서 시작해 세로 또는 가로 한 방향으로 범위를 넓힌다 (먼저 움직인 축). 놓으면 넓힌 칸에 원래 범위의 값을 그 방향으로 되풀이해 쓴다.
- 가상 표에서 표 가장자리 근처로 끌면 자동 스크롤한다 (§7 P2 — 범위 끌기에 자동 스크롤이 있는지부터 확인하고 같은 구현을 쓴다).
- 키보드: 사용자 결정 2 (권고 — Ctrl / Cmd + D, 범위의 첫 행을 아래 행들에).
- 쓰기는 §5.1 의 묶음 쓰기 한 번이다.

### 5.4 편집 상태 (Phase 4)

- 출처: 세션 `itemEdits` (`catalogPreviewSession.ts:560`). 편집 기록이 바뀔 때 collection 마다 `key → { status: "new" | "dirty", fields }` Map 을 한 번 만든다 — 행을 그릴 때마다 기록을 훑지 않는다 (R3).
- **상태는 다시 적용 (replay) 중에 항목에 붙이고, key 는 replay 뒤에 읽는다** (review 317 round 1 m1). 편집 기록의 `key` 글자로 Map 을 세우지 않는다 — key 는 keyField · `id` · `key` · `value` 가 없으면 위치 (`row-N` — `resolveCollectionItems.ts:340-351`) 라, 고친 뒤 `insert` · `remove` · `move` 가 오면 기록의 key 가 다른 행을 가리킨다 (값은 replay 가 기록 순서대로 적용해 맞지만, 기록 key 로 칠한 표시는 밀린 행에 간다).
  - replay (`replayItemEdits` · `replayFlatTreeEdits`) 는 편집이 만든 항목 객체를 새로 만든다 (`append` · `insert` 의 `edit.item`, `update` 의 `{ ...item, ...patch }` — `:388-394`). 그 객체를 열쇠로 하는 WeakMap 에 `{ status, fields, seq }` 를 적는다: `append` · `insert` = 새 행, `update` · 묶음 쓰기 = 고친 행 + 바뀐 필드 (원래 항목이 새 행이면 새 행 유지 · 필드는 합침). `seq` 는 그 항목 · 필드를 마지막으로 쓴 편집의 번호 (아래 「사라지는 때」).
  - replay 결과를 바운드 목록과 같은 `getItemKey` 로 훑어 key → 상태 Map 을 만든다 — 행의 지금 key 로 읽으므로 위치가 밀려도 표시가 따라간다.
  - `remove` 된 행은 화면에 없다 (지운 행을 남기지 않는다 — 사용자 결정 6 의 권고).
- 편집 번호: 세션이 collection 마다 편집 기록에 단조 증가 번호를 붙인다 (기록 한 건 = 번호 하나, 묶음 쓰기도 한 건).
- 사라지는 때: 다시 불러올 때 (`showLoaded` 가 기록을 지운다 — `:1824-1830`). 사용자 결정 6 이 「저장 Do 성공 때도」 면 **그 저장이 보낸 칸만** 표시를 지운다 (review 317 round 1 m2) — collection 표시를 통째 지우지 않는다. 통째로 지우면 「붙여넣기 A → 저장 요청 (느림) → 붙여넣기 B → A 성공 → B 의 표시도 지워짐 → B 저장 실패」 에서 저장되지 않은 행이 표시 없이 남는다.
  - 저장이 보낸 칸 = 그 규칙을 일으킨 편집이 쓴 (key, field) 목록과 그 편집 번호. Table 의 When 「Cells change」 (사용자 결정 1) 는 payload 에 그 목록과 번호를 싣는다. `EditableCell` 의 Form When `onSubmit` 은 그 칸의 `editTableRow` 가 쓴 편집 (행 key · Form 필드 · 번호) 을 같은 실행의 이벤트에 싣는다 — Form 은 collection 을 모르므로 세션이 그 편집에서 collection 을 안다. 순서는 맞다: RAC `useContextProps` 가 `mergeProps(contextProps, props)` 로 합쳐 (`react-aria-components/dist/private/utils.mjs:100`) `EditableCell` 의 `FormContext` submit (`onSave` → 세션 `update`, `editableCell.components.tsx:69-79 · 121`) 이 Form 규칙의 `onSubmit` 보다 먼저 돈다 — 규칙이 실행될 때 편집 번호가 이미 있다. 이벤트에 싣는 자리는 Phase 4 에서 정한다 (submit 이 그 이벤트 → 편집을 세션에 적고 규칙 실행이 읽는다).
  - `callEndpoint` 가 성공하면 (`settled` — dispatcher 가 응답 뒤 남은 Do 를 잇는 그 자리) 그 목록의 칸 가운데 **마지막으로 쓴 편집 번호 ≤ 보낸 번호** 인 칸만 표시를 지운다. 보낸 뒤에 다시 고친 칸은 남는다. 실패하면 아무것도 지우지 않는다.
  - 지우는 것은 표시뿐이다 — 「저장된 번호」 를 (collection, key, field) 마다 적고 상태 Map 이 그 번호 이하의 편집을 빼고 만든다. 편집 기록 자체 (행의 값) 는 지우지 않는다 (지우면 화면이 원래 값으로 돌아간다). 다시 불러오면 기록과 함께 저장 번호도 지운다.
  - 「저장 Do」 가 없는 규칙 (세션에만 — 결정 1 의 셋째 안) 은 이 길을 지나지 않는다.
- DOM: Row 의 `data-edit-status` · Cell 의 `data-edited` (data 속성 — ARIA 아님). 화면 낭독기용으로 row header 칸 안에 보이지 않는 글자 (「수정됨」 · 「새 행」) 를 우리 요소로 둔다 (속성을 직접 쓰지 않는다). 색만으로 알리지 않게 행 앞 가장자리에 표시 선을 그린다.
- 칠: Row · Cell rule 의 조건 가지 (ADR-297 — 줄무늬 < 편집 상태 < hover < 선택 순서는 Phase 4 에서 S2 의 행 상태 순서를 읽고 정한다).
- Canvas: 그리지 않는다 (편집 기록이 없다).
- 「Edit marks」 스위치가 꺼진 표는 Map 을 만들지 않는다.

### 5.5 줄무늬 행 (Phase 5)

- Table 의 작성 값 하나 (이름은 Phase 0 에서 design-data · v3 를 확인한 뒤 — 없으면 composition 확장, `d2Provenance.ts`).
- 짝 · 홀은 데이터 층의 보이는 순서로 정한다: 데이터 행의 보이는 번호 (묶음 행 · 상세 행은 세지 않는다 — Phase 5 에서 묶음 표의 모양을 보고 확정). Row 의 파생 값으로 싣고 Canvas (`styleOf`) 와 DOM (data 속성 → rule `rootSelectors`) 이 같이 읽는다.
- CSS `:nth-child` 를 쓰지 않는 이유: 가상 표는 DOM 행이 창의 일부이고 재사용되며, 고정 행 · 묶음 행은 DOM 순서와 보이는 순서가 다르다.
- 병합 열이 있는 표 (ADR-315 Phase 6 — 행 선을 칸이 그린다) 에서 병합된 칸의 바탕은 Phase 5 에서 `/cross-check` 로 정한다 (G5 의 대안 = 병합 칸이 없는 표에만).

### 5.6 작성 화면 · 저장 길

- Table Property 탭 (ADR-315 의 「Grid」 묶음): 「Cell selection」 아래 「Paste」 · 「Fill handle」 · 「Edit marks」, 모양 쪽 「Striped rows」.
- 켤 수 있는 조건: 「Paste」 · 「Fill handle」 은 「Cell selection」 켜짐 + 「Editable」 열 1 개 이상. 조건이 깨지면 (마지막 Editable 열을 끔) 스위치를 끄지 않고 실행 때 아무 칸도 쓰지 않는다 — 패널이 사유를 안내한다.
- 저장 길 (사용자 결정 1, 권고안 기준): Table 의 When 「Cells change」 — payload 는 바뀐 행 key 목록과 그 행의 값, 쓴 (key, field) 목록과 편집 번호 (§5.4 — 저장 성공 때 그 칸의 표시만 지운다). 붙여넣기 · 채우기 · 지우기 한 번에 한 번 일어난다. `EditableCell` 한 칸 저장은 지금처럼 Form 의 When `onSubmit` 이다 (두 길을 합칠지는 결정 1 을 물을 때 같이 묻는다). 이름은 RAC 에 없으므로 composition 확장으로 적는다 (`interactions/componentInteractionSpecs.ts` 의 Table 절 — ADR-315 의 열 상태 prop 과 같은 자리).

## 6. Phase

| Phase | 내용                                                                                                                                                 | contract | Gate |
| :---: | ---------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | :--: |
|   0   | ADR-315 G6 확인 · 코드 사실 재대조 · 시제품 5 (§7) · D2 이름 확인 (design-data · v3) · 기준선 (속도 · 번들) · 기능별 go / no-go                      |    —     |  G0  |
|   1   | 묶음 쓰기 (§5.1) — 세션 · 표 controller. 화면 없음                                                                                                   |    —     |  G1  |
|   2   | 붙여넣기 (§5.2) + 사용자 결정 3 · 4 — 탭 구분 파서 · `paste` listener · 알림 영역 · 「Paste」 스위치 · 규칙 문서 D1 목록                             |    —     |  G2  |
|   3   | 채우기 (§5.3) + 사용자 결정 2 · 5 — 손잡이 요소 · 끌기 · 자동 스크롤 · 키 · 「Fill handle」 스위치 · rule 의 손잡이 모양                             |    —     |  G3  |
|   4   | 편집 상태 (§5.4) + 사용자 결정 1 · 6 — 상태 Map · Row / Cell 파생 값 · rule 가지 · 「Edit marks」 스위치 · 저장 When                                 |  0 ~ 1   |  G4  |
|   5   | 줄무늬 행 (§5.5) — binding prop · 파생 값 · rule 가지 · Canvas · 생성 CSS · 「Striped rows」 스위치                                                  |  0 ~ 1   |  G5  |
|   6   | HC5 교대 측정 · 번들 · live 재확인 (Chrome · WebKit) · `/cross-check` · 규칙 문서 (ssot-hierarchy · data-interaction · catalog-subparts) · CHANGELOG |    —     |  G6  |

- contract 는 entry 형이 바뀔 때만 올린다 (새 binding prop · 새 When 이름이 문서 검증의 닫힌 목록을 넓히면 1 회). Phase 4 · 5 를 한 번으로 모을 수 있으면 모은다. 번호는 착수 때 origin/main 과 대조한다.
- 각 Phase 끝은 커밋 가능한 상태다. Phase 0 의 no-go 는 해당 Phase 의 범위를 줄이고 본문 「하지 않는 것」 에 사유를 더한다.
- Phase 마다 남기는 것: 단위 테스트 · 변이 RED · type-check · 회귀 · 번들 Δ · 그 Phase 가 새로 만든 동작의 live 1 회. 교대 측정 · live 재확인 묶음 · `/cross-check` 묶음은 Phase 6 에서 한 번 (ADR-315 사용자 결정 2026-11-21 「매번 테스트 시간이 너무 길다」 를 그대로 따른다).

## 7. Phase 0 시제품

| ID  | 무엇을 확인하나                                                                                                                                                                              | no-go 조건                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| P1  | focus 가 gridcell (편집 불가 요소) 에 있을 때 Ctrl / Cmd + V 로 `paste` 이벤트가 표에 오고 `clipboardData.getData("text/plain")` 을 읽을 수 있는가 — Chrome · WebKit. `useClipboard` 와 비교 | 두 브라우저 가운데 하나라도 이벤트가 오지 않고 대안이 권한 창 |
| P2  | 가상 표에서 손잡이 끌기 — 창 밖으로 넓히는 동안 자동 스크롤 · 재사용되는 칸 요소 위에서 끌기가 끊기지 않는가 · 범위 끌기와 구별되는가                                                        | 끌기가 스크롤 중 끊기고 고칠 수 없음                          |
| P3  | 묶음 쓰기 1,000 칸 (10,000 행 표 · 정렬 걸림) → 화면 반영 시간 · 행 다시 읽기 수                                                                                                             | 정렬 클릭 기준선을 넘고 줄일 길이 없음                        |
| P4  | 줄무늬 짝 · 홀 — 가상 표 스크롤 · 묶음 행 펼침 · 고정 행 · 정렬 변경에서 보이는 순서와 일치하는가 · Canvas 와 같은가                                                                         | Canvas 와 DOM 을 맞출 수 없음                                 |
| P5  | 알림 영역 (`role="status"`) 을 VoiceOver 가 읽는가 · `aria-readonly` 칸을 어떻게 읽는가 (사용자와 듣는다 — ADR-315 G6 과 같은 자리에서)                                                      | 알림을 읽지 않고 대안 (focus 이동 없는 다른 알림) 도 없음     |

기준선: ADR-315 하니스 (`apps/builder/scripts/datagrid-table-vs-tanstack-live.mjs`) 의 10,000 행 로드 · 힙 · 정렬 클릭 · 스크롤 p95 와 일반 `vite build` 의 initial JS gzip (Builder · Preview) 을 착수 HEAD 에서 다시 잰다.

## 8. 파일 추정 (Phase 0 에서 확정)

| 영역                | 파일 (추정)                                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 세션 · controller   | `runtime/catalogPreviewSession.ts` (묶음 쓰기 · 상태 Map) · `runtime/catalogTableController.ts` (대상 칸 고르기) · `runtime/catalogPreviewInteractions.ts` · `runtime/domView.runtime.ts` |
| 칸 선택 chunk       | `runtime/tableCellSelection.ts` (paste · cut · Delete · 손잡이) · 새 모듈 2 (탭 구분 파서 · 채우기 계산)                                                                                  |
| DOM · 파생 값       | `runtime/domBinding.runtime.ts` · `runtime/presence.ts` (Row / Cell 파생 값) · `runtime/tableOperationsDom.*` (알림 영역)                                                                 |
| rule · CSS · Canvas | `generated/componentRulesTable.ts` (Row · Cell 가지 · 손잡이) · 생성 CSS · Canvas `styleOf` 경로                                                                                          |
| binding · 패널      | `bindings/Table.binding.ts` · `document/d2Provenance.ts` · Builder 의 Table Property 패널 · `i18n/messages/en-US.ts` · `ko-KR.ts`                                                         |
| interaction         | `interactions/componentInteractionSpecs.ts` (사용자 결정 1)                                                                                                                               |
| 규칙 문서           | `.claude/rules/ssot-hierarchy.md` · `data-interaction.md` · `catalog-subparts.md` · `composition-patterns/reference/table-data-grid.md`                                                   |

추정 shared 12 ~ 18 · builder 6 ~ 10 파일 + 테스트.

## 9. Phase 결과

### Phase 0 (2026-11-26 — G0 통과)

- **착수**: 사용자 `/execute-adr 317` (2026-11-26) + reviews/317.md round 2 pending 0 → Accepted. 착수 HEAD `e8c51fa2a` (코드는 실측 HEAD `56e769429` 과 같다 — 그 사이는 이 ADR 의 문서 커밋).
- **코드 사실 재대조**: F1 ~ F8 차이 0 (`presence.ts` 의 `catalogEditableCellForm` 줄만 5979 → 5970). 추가로 본 것: `normalizeRows` 는 `formula` 필드를 건너뛰어 (`active` — `normalizeRows.ts`) 계산 필드 값이 변환 없이 쓰였다 — 묶음 쓰기의 「계산 필드는 쓰지 않음」 은 판정이 따로 막아야 한다 (Phase 1 반영).
- **시제품** (`apps/builder/scripts/adr317Prototypes.mjs` + `adr317-phase0-prototypes.mjs` — 설치된 RAC 1.22.1 Table 위에 제품의 `attachCatalogCellSelection` 을 그대로 import, 판정값은 브라우저의 `paste` 이벤트 · 좌표 · 속성 · 계산된 색, 정답 값은 스크립트에 따로 적음). Chrome · Playwright WebKit 모두 통과:

  | ID  | 결과                                                                                                                                                                                                                                |  판정   |
  | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----: |
  | P1  | gridcell 에 focus · Ctrl / Cmd + V → 표에 `paste` (`text/plain` 읽힘) · 우리 `copy` → 붙여넣기 값 = 정답 · `beforepaste` 막음 유 · 무 같음. Excel 형식 (따옴표 칸) 은 자동화가 클립보드에 직접 쓰지 못해 파서 단위 검사로 (Phase 2) |   go    |
  | P2  | 가상 2,000 행 · 손잡이 끌기 → 자동 스크롤로 창 밖 151 행 (WebKit 77 행) 까지 · 손잡이 칸이 창 밖으로 나가 요소가 해제돼도 끌기 유지 · 값 복사 = 정답 · 범위 선택 그대로 · 칸에서 시작한 끌기는 범위 선택                            |   go    |
  | P3  | 묶음 쓰기 위에서만 잴 수 있다 → Phase 2 live (10,000 행 · 1,000 칸 붙여넣기). Phase 1 은 행 다시 읽기 카운트 1 을 단위 테스트로 고정                                                                                                | Phase 2 |
  | P4  | 데이터 층 순서의 짝 · 홀 = 화면 순서 (가상: 처음 · 1,234 행 스크롤 · 내림차순 정렬 · 정렬 뒤 위로 / 비가상 40 행) · 번갈아 · 칠                                                                                                     |   go    |
  | P5  | 알림 영역 낭독 — Phase 2 live 에서 사용자와 (ADR-315 G6 은 통과 — 사용자 답 2026-11-26)                                                                                                                                             | Phase 2 |

- **시제품이 설계에 더한 것**:
  1. RAC `ScrollView` 는 스크롤 중 · 끝난 뒤 300 ms 까지 내용에 `pointer-events: none` 을 건다 (`react-aria/dist/private/virtualizer/ScrollView.mjs:267`). 자동 스크롤 중 `elementFromPoint` 는 행을 못 찾는다 (첫 측정: scrollTop 5,707 에서 끝 행 9 에 멈춤) — 손잡이 끌기는 그려진 행의 상자로 판정한다. ADR-315 의 범위 끌기 (`onPointerMove` 의 `elementFromPoint`) 도 휠 스크롤과 같이 하면 같은 일을 겪는다 — Phase 3 에서 같은 판정으로 맞춘다.
  2. 손잡이의 `pointerdown` 은 표의 capture listener (범위 끌기) 보다 먼저 받아야 한다 — document capture 에서 잡고 멈춘다 (시제품). 제품에서는 `tableCellSelection.ts` 의 `onPointerDown` 이 손잡이를 건너뛰게 하는 쪽이 간단하다 (Phase 3).
  3. RAC 는 focus 된 칸의 행을 창 밖에서도 남긴다 (persisted key) — focus 가 손잡이 칸이면 요소가 해제되지 않는다. 끌기는 손잡이 요소에 의존하지 않는다 (document listener).
  4. 가상 표의 칸은 `role="presentation"` 감싸개 안이라 `[role=row] > *` 는 감싸개를 겨눈다 — 줄무늬 · 편집 상태 칠은 칸 (`gridcell` · `rowheader`) 을 겨눈다 (Phase 4 · 5).
  5. Safari: react-aria `useClipboard` 는 `beforecopy` · `beforecut` · `beforepaste` 를 막아 편집 메뉴를 켠다 — 메뉴가 꺼져 있으면 Safari 는 단축키에도 이벤트를 보내지 않는다. Playwright WebKit 은 메뉴 판정을 지나지 않아 차이를 보지 못했다 — §4 목록에 더했다 (Phase 2).
- **D2 이름 확인**: S2 1.8.2 (`TableView.tsx` — strip · zebra · paste 없음) · design-data `table` (옵션 size · density · isQuiet · isSortable · hideHeader · columns · rows) · v3 (설치본 없음 — v3 TableView 는 `density` · `overflowMode` · `isQuiet`) 어디에도 붙여넣기 · 채우기 · 행 상태 · 줄무늬 prop 이 없다 → composition 확장, `d2Provenance.ts` 에 그 Phase 에서. design-data Table 지침에 「Don't use zebra stripes」 (행 구분선 · hover · 선택으로 충분) 가 있어 사용자에게 물었다 → **「composition 확장으로 유지」** (기본 꺼짐).
- **기준선** (`.agent/runs/2026-11-26-adr317-phase0/`): 번들 (일반 `vite build` + `adr209-bundle-closure.mjs`) Builder initial JS gzip **1,634,043 B** · Preview **172,215 B** (상한 1,650,000 · 327,000). 10,000 행 (`datagrid-table-vs-tanstack-live.mjs` · production · headed Chrome): 로드 401 ms · 힙 157 MB · 정렬 클릭 1x 161.4 ~ 169.1 · 4x 616.6 ~ 648.4 ms (중앙값, 글자 · 숫자 열) · 스크롤 p95 1x 24.7 ~ 25.1 · 4x 117.6 ~ 126.7 ms. (ADR-315 Phase 0 의 4x 정렬 556 ~ 589 ms 보다 높다 — 그 뒤 커밋들의 차이인지 측정 노이즈인지는 이 ADR 의 판정 대상이 아니다. HC5 는 같은 빌드의 끈 arm 과 켠 arm 교대로 잰다.)
- **사용자 답 (2026-11-26)**: 결정 8 「맞춘다」 · 줄무늬 「composition 확장으로 유지」 · ADR-315 G6 「통과 확인함」.

### Phase 1 (2026-11-26 — G1 통과)

- **구현**:
  - `runtime/catalogPreviewSession.ts` — 편집 기록 `updateMany` (항목 key → patch, replay 는 한 번 훑기 — 중첩 배열 · 평평한 트리 둘 다 `replayItemEdits` 를 지난다) · `updateMany(collectionId, writes)` (편집 기록 한 건 · `edit` 의 행 다시 읽기 1 번, 쓸 것이 없으면 기록도 다시 읽기도 없음) · 판정 하나 `itemFields` (→ `{ patch, refused }`): schema 밖 (`unknown`) · 계산 필드 (`computed`) · `normalizeRows` 의 `unread` · `precision` · `typeMismatch` (`unread`) 는 쓰지 않는다. `updateMany` 는 key 필드 (`keyField`) · 없는 항목 (`missing`) 도 센다. `update` 는 같은 판정 — 읽지 못한 필드는 쓰지 않고 사유 (`읽을 수 없는 값이라 쓰지 않음: …`) 를 돌려준다, 쓸 필드가 없으면 실패. `append` · `insert` 는 옛 변환 그대로 (`itemValues` — 판정을 그쪽에 걸면 문자열 id 열의 숫자 id 가 빠졌다: `treeData.test.tsx` 「numeric parent IDs」 가 잡았다).
  - `runtime/catalogTableController.ts` — `editTableCells(tableId, cells)`: 표 record 의 그려진 body 칸 가운데 Form 을 가진 칸 (S2 `EditableCell`) 의 열 key (`CATALOG_CELL_COLUMN_PROP` — 「Cell selection」 표가 싣는다) 만 편집 가능 (`notEditable`), 읽은 데이터 행 (`rowValuesOf`) 만 (`notDataRow`), 행마다 모아 `updateMany` 한 번. `editTableRow` 는 부분 거절 (`ok` + 사유) 도 경고한다.
- **검사**: 새 테스트 `apps/builder/src/preview/catalog/__tests__/adr317BatchWrite.test.tsx` 6 (정답 값은 손으로 적음 — 묶음 쓰기 값 · 사유별 수 · 행 다시 읽기 1 · 편집 기록 +1, 쓸 것 없음 = 기록 · 다시 읽기 0, `update` 와 같은 값, 결정 8 의 `update`, 표의 편집 가능 열 · 데이터 행). 변이 RED 6/6 (판정 건너뜀 · 결정 8 되돌림 · replay 빠짐 · 편집 가능 판정 빠짐 · 데이터 행 판정 빠짐 · 빈 쓰기 기록) — 원복 스크립트 + 바이트 복원 확인. type-check 통과. 회귀: builder `src/preview` · `src/builder/catalogRuntime` 5,627 통과 · shared 2,767 통과 (새 실패 0).
- **번들** (Phase 0 기준선 대비, 같은 방법): Builder initial JS 1,634,043 → 1,634,044 B (+1) · Preview 172,215 → 172,213 B (−2) — 사용자 결정 7 안.
- **live** (`apps/builder/scripts/adr317-p1-editable-unread-live.mjs`, 5173 dev · headed Chrome): Builder 에 Table + Users (status = number) · status Column 「Editable」 → Publish 첫 행 status 2 에 「abc」 Save → 칸 2 유지 + `[interactions] Editable cell: 읽을 수 없는 값이라 쓰지 않음: status` · 「7」 → 7 · 빈 값 → 빈 칸 · page error 0. 묶음 쓰기 자체는 화면 길이 없어 (Phase 2 의 붙여넣기가 첫 길) 단위 테스트까지다.

### Phase 2 (2026-11-26 — G2, VoiceOver 청취만 사용자 확인 대기)

- **사용자 답 (2026-11-26)**: 결정 3 「넣는다」 (Delete · Backspace · Ctrl / Cmd + X) · 결정 4 「버리고 알림」.
- **구현**:
  - `packages/shared/src/collections/intake/tabText.ts` `splitTabText` — 줄 (`\n` · `\r\n` · `\r`) · 탭, 따옴표 칸 (Excel · Sheets — 칸 안 탭 · 줄바꿈 · `""`), 끝 줄바꿈 하나 버림, 닫히지 않은 따옴표는 따옴표 없이 읽음. 타입 없음 — 쓰는 자리에서 `normalizeRows(…, "text")`.
  - `runtime/tableCellSelection.ts` — source 의 `write` 가 있는 표만: `paste` (마지막 범위 → 없으면 focus 칸의 왼쪽 위부터, 1 × 1 은 범위 전체, 표 끝 밖은 `outside` 로 세고 버림, 붙인 뒤 범위 = 쓴 영역) · `cut` (복사 + 마지막 범위 비움) · Delete · Backspace (모든 범위 비움, 입력 요소의 키는 건드리지 않음) · document 의 `before*` 막기 (표 안 focus 일 때만). 결과 문구 `catalogCellWriteStatus` (en · ko · ja · zh) 를 `announce` 로.
  - `runtime/domRegistry.components.tsx` `CatalogTable` — source 에 `locale` · `announce` 를 얹고, `write` 가 있으면 RAC Table 형제 `span[role=status][data-table-write-status]` (화면 낭독 전용 — 같은 글자도 다시 읽게 비운 뒤 다음 frame 에 씀).
  - `runtime/domBinding.runtime.ts` (`allowsPasting` 인 표의 `cellSelection.write` → `runtime.editTableCells`) · `catalogPreviewInteractions.ts` · `domView.runtime.ts` (→ `session.tables.editTableCells`).
  - `bindings/Table.binding.ts` `allowsPasting` (label 「Paste」, `section: "state"` — Behavior 칩, `visibleWhen allowsCellSelection`) · `d2Provenance.ts` (`composition`) · i18n `properties.tablePaste` (en-US 「Paste」 · ko-KR 「붙여넣기」). contract 그대로 (노드 props 는 형이 정해지지 않은 레코드 — ADR-315 Phase 6 과 같다).
  - 규칙 문서: `.claude/rules/ssot-hierarchy.md` §1 D1 Table 예외에 (4) ~ (6) 옮김.
- **검사**: 새 테스트 — shared `collections/intake/__tests__/tabText.test.ts` 5 · builder `preview/catalog/__tests__/adr317Paste.test.tsx` 8 (블록 붙여넣기 · 편집 불가 열 · 읽기 실패 · 행 다시 읽기 1 · 알림 · 범위 갱신, 표 끝 넘침 · 한 값 채우기, Delete · cut · Backspace, `beforepaste` (표 안 / 밖), 「Paste」 꺼진 표, Builder 파서와 같은 칸 3 fixture). 정답 값은 손으로 적음. 변이 RED 7/7 (한 값 채우기 · 넘침 세기 · Delete · cut 비우기 · `beforepaste` · 「Paste」 조건 · 따옴표 칸) — 원복 스크립트 + 바이트 복원 확인. type-check 통과. 회귀: builder `src/preview` · `src/builder/catalogRuntime` · `src/builder/panels` 7,060 · shared 2,772 통과 (새 실패 0).
- **번들** (Phase 0 대비): Builder 1,634,043 → 1,634,069 B (+26) · Preview 172,215 → 172,214 B (−1). 파서 · 문구는 칸 선택 lazy chunk 안이다.
- **live** (`apps/builder/scripts/adr317-p2-paste-live.mjs`, 5173 dev, Chrome · Playwright WebKit): Builder 에 Table + Users 1,000 행 (가상 표) → Design 패널 name · status 「Editable」 · Table 「Cell selection」 칩 → 「Paste」 칩 (Cell selection 전에는 없음) → Publish: p1:name ~ p2:status 를 Ctrl / Cmd + C → p5:name 에 Ctrl / Cmd + V → p5 · p6 name · status 바뀜 · type 그대로 · 알림 「칸 4개에 붙여넣음 · 2개 건너뜀」 / (Chrome) Excel 형식 `"Kim\nJr"\tX\t"7"` 붙여넣기 → 칸 안 줄바꿈 보존 / Delete → Editable 칸만 비움 / Ctrl / Cmd + A 뒤 한 값 → 1,000 행 · 「칸 1000개에 붙여넣음 · 2000개 건너뜀」 · 마지막 행까지, 화면 반영 Chrome 164 ~ 219 · WebKit 196 ms (dev · 1x — 10,000 행 production 은 Phase 6 HC5) · page error 0. 잘라내기는 단위 테스트까지 (live 는 Phase 6 재확인 묶음).
- **live 가 찾은 하니스 함정**: 가상 표에서 Playwright 의 자동 스크롤 클릭은 RAC 가 스크롤 뒤 300 ms 동안 끈 pointer 때문에 칸에 닿지 않는다 — 먼저 스크롤하고 기다린다 (Phase 0 시제품 (1) 과 같은 원인).
- **남은 것 (G2)**: P5 — VoiceOver 가 `role="status"` 알림을 읽는지 사용자 청취.
