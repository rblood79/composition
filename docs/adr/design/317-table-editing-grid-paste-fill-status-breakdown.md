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

### Phase 3 (2026-11-26 — G3 통과)

- **사용자 답 (2026-11-26)**: 결정 2 「Ctrl / Cmd + D 만」 · 결정 5 「값 복사만」.
- **구현**:
  - `runtime/tableCellSelection.ts` — 손잡이 요소 하나 (`span.table-fill-handle[data-fill-handle][aria-hidden]`) 를 마지막 범위의 오른쪽 아래 칸 (`data-fill-corner`) 에 붙이고, 그 칸이 그려지지 않으면 (가상 표 창 밖) 뗀다. 끌기 (`startFill` · `fillStep` · `onFillUp`): `pointerdown` 이 손잡이면 범위 끌기 대신 시작, document `pointermove` · `pointerup` · `pointercancel`, rAF 마다 표 가장자리 24px 안이면 스크롤 + `placeAt` (그려진 행 상자 · 칸 상자, 표 안으로 clamp) 로 닿은 자리, 축은 먼저 벗어난 쪽, 닿은 칸은 `data-fill-target`. 놓으면 `catalogFillPlan` (순수 함수 — 아래 · 위 · 오른쪽 · 왼쪽, 범위 값의 되풀이, 범위가 닿은 칸까지 넓어짐) → 묶음 쓰기 한 번 · 알림 「칸 N개 채움」. Ctrl / Cmd + D: 마지막 범위의 첫 행을 그 아래 행들에 (한 행이면 위 행을 그 행에). `source.pastes` · `source.fills` 로 「Paste」 · 「Fill handle」 이 각자 켜진다. 범위 끌기는 `elementFromPoint` 가 칸을 못 찾으면 `placeAt` 으로.
  - `runtime/catalogTableController.ts` `tableCellValues` (+ `domBinding.runtime.ts` · `catalogPreviewInteractions.ts` · `domView.runtime.ts`) — 채우는 값은 행 데이터 그대로 (글자 아님 — 다른 타입 열은 `typeMismatch` 로 쓰지 않음).
  - Table rule `rootSelectors` (`generated/componentRulesTable.ts`) — `[data-fill-corner]` `position: relative` · `.table-fill-handle` (7px accent 사각형 · `0 0 0 1px var(--bg)` · crosshair · `touch-action: none`) · `[data-fill-target]` (1px 점선 accent). 생성 CSS `Table.css`. Canvas 는 그리지 않는다 (실행 상태 — HC9).
  - `bindings/Table.binding.ts` `allowsFilling` (「Fill handle」, Behavior 칩, `visibleWhen allowsCellSelection`) · `d2Provenance.ts` · i18n `properties.tableFillHandle` (「Fill handle」 · 「채우기 손잡이」).
  - `panels/properties/generic/fieldEditor.ts` — 칩의 「Fill」 접두 · Fill 묶음은 `fill*` key 만 (그전에는 라벨 「Fill …」 도 — 「Fill handle」 이 Fill 묶음의 「Handle」 칩이 됐다. 「Fill …」 라벨을 가진 기존 boolean 은 모두 `fill*` key 라 다른 칩은 그대로).
  - 규칙 문서: `.claude/rules/ssot-hierarchy.md` §1 D1 Table 예외에 (7) 손잡이 옮김.
- **검사**: 새 테스트 — `preview/catalog/__tests__/adr317Fill.test.tsx` 5 (계획: 아래 · 위 · 오른쪽 · 왼쪽 · 범위 안이면 없음 / 손잡이 자리 · 누름이 범위를 바꾸지 않음 · 범위가 옮기면 따라감 / Ctrl + D 여러 행 · 한 행 · 행 다시 읽기 1 · 알림 / 「Fill handle」 꺼진 표) · `fieldEditor.static.test.ts` +1 (칩 「Fill handle」). 정답 값은 손으로 적음 (위로 채울 때 c · d 무늬가 b = d · a = c 로 이어지는 것은 처음 적은 기대값이 틀렸고 코드가 맞았다 — Excel 과 같다). 변이 RED 6/6 (위 · 왼쪽 되풀이 · 손잡이 붙이기 · Ctrl + D 원본 행 · 「Fill handle」 조건 · 손잡이 누름 분기 · 칩 규칙) — 원복 스크립트 + 바이트 복원 확인. type-check 통과. 회귀: builder `src/preview` · `src/builder/catalogRuntime` · `src/builder/panels` 7,065 · shared 2,772 통과 (새 실패 0).
- **번들** (Phase 0 대비): Builder 1,634,043 → 1,634,228 B (+185 — binding · i18n · 칩 규칙) · Preview 172,215 → 172,213 B (−2). 손잡이 · 끌기 · 계획은 칸 선택 lazy chunk 안이다.
- **live** (`apps/builder/scripts/adr317-p3-fill-live.mjs`, 5173 dev, Chrome · Playwright WebKit): Builder 에 Table + Users 1,000 행 (가상) → name · status 「Editable」 · 「Cell selection」 → 「Fill handle」 칩 (전에는 없음) → Publish: p1:name ~ p2:status 범위 → 손잡이가 p2:status 칸에 → 끌어 표 아래 밖 1.5 초 (자동 스크롤) 뒤 안으로 → 놓기: 끝 행 Chrome p99 · WebKit p55 가 Name 1 / 1 또는 Name 2 / 2 (번갈아) · type 그대로 · 끄는 동안 점선 칸 21 ~ 24 · 알림 「칸 194개 채움 · 97개 건너뜀」 (Chrome) · Ctrl / Cmd + D p3 → p4 · page error 0.
- **live 가 찾은 하니스 함정**: Playwright 가 클릭 전에 스크롤하면 RAC 의 스크롤 중 pointer 끄기와 겹쳐 머리글 · grid 가 클릭을 가로챈다 — 스크롤 없이 보이는 행으로 (Phase 2 와 같은 원인).

### Phase 4 결과 (2026-11-26 — 종결, G4)

- **사용자 답 (2026-11-26)**: 결정 1 「Table When 하나」 (「Cells change」 → 작성자가 `callEndpoint` 를 잇는다) · 결정 6 「칸까지 · 저장 성공 때도 지움」 (그 저장이 보낸 칸 가운데 보낸 뒤 다시 고치지 않은 칸만 — §5.4).
- **contract 77 → 78**: 문서 검증이 규칙 `trigger` 를 `library.execution.triggerIds` (닫힌 목록 — `document/graph.ts:1733`) 로 거르므로 새 When 은 옛 코드가 열지 못하는 문서를 만든다. `document/types.ts` 기록 줄 · fixture 32 파일. origin/main 도 77 — 겹침 없음 (ADR-318 은 79 를 쓴다).
- **편집 번호 · 표시 (세션)**: `edit()` 가 세션 단조 번호 (`seq`) 를 편집 기록마다 붙이고 돌려준다 (`update` · `updateMany` · `editTableRow` 결과). replay 가 편집이 만든 항목 객체를 열쇠로 하는 WeakMap 표 (`ITEM_EDIT_MARKS` — `{ added?, fields: {필드 → 마지막 seq} }`) 에 적는다: `append` · `insert` 는 기록의 항목 자신 (번호는 바뀌지 않는다), `update` · `updateMany` 는 새로 만든 `{ ...item, ...patch }`. replay 가 항목을 복사하는 세 자리 (`withLevel` · `mapItems` 의 부모 사본, `replayFlatTreeEdits` 의 평평한 행 재구성) 는 `carriedItem` 으로 표시를 옮긴다. 처음에는 열거 가능한 symbol 속성으로 두어 펼침이 저절로 옮기게 했으나, 회귀에서 deep-equal 이 항목의 새 속성으로 보았다 (`updateRemove.test.tsx` 3) — `!item` 값처럼 항목이 밖으로 나가는 자리에도 새므로 표로 바꿨다. `editMarks(collectionId)` 가 replay 결과를 바운드 목록과 같은 `getItemKey` 로 훑어 key → `{ status: new | dirty, fields }` 를 만든다 — 위치 key (`row-N`) collection 에서 앞에 넣기 · 지우기가 와도 표시가 같은 항목을 따른다 (단위 테스트). 「Edit marks」 를 켠 바운드 노드만 행에 싣는다 (`withEditMarks` — 끈 표는 만들지 않음, R3).
- **저장 표시 — 착수 메모와 달라진 것**: 「(편집 때 key, field) → 저장 번호」 표 대신 **저장된 편집 번호 집합** (`savedEdits`). 칸은 그 칸을 마지막으로 쓴 편집이 저장됐으면 표시가 없다 — 「보낸 칸 중 마지막 번호 ≤ 보낸 번호」 와 같은 결과이고 key 를 다시 맞출 일이 없다. 규칙 실행 (`createElementHandlers`) 이 이벤트 객체의 `CATALOG_EVENT_EDITS` (symbol — 번호 목록) 와 그 규칙의 Do 가 저장 전에 만든 편집 (실행 전후 `editSeq`) 을 모아, `callEndpoint` 가 있는 규칙의 끝 결과가 성공일 때만 `markEditsSaved` 를 부른다 (실패 · 저장 없는 규칙은 아무것도 지우지 않는다). 이벤트에 함수 대신 번호를 싣는다 — 착수 메모의 「rulesSettled 함수」 보다 규칙이 스스로 만든 편집 (Form 의 append + 저장) 까지 한 길로 덮는다. 다시 불러오면 (`showLoaded`) 기록과 함께 그 번호들도 지운다.
- **When 「Cells change」**: 개념 파일 `interactions/concepts/tableEditing.ts` (`onCellsChange` · `argFields` · 인자 `keys` · `items` · `cells` — 편집 번호는 작성자에게 보이는 인자가 아니라 symbol 로 싣는다, 착수 메모의 `seq` 인자를 뺐다) · Table spec · `RacPropsOf` · 라벨 (en 「On cells change (paste · fill · clear)」 · ko 「칸이 바뀔 때 (붙여넣기 · 채우기 · 지우기)」). `CatalogTable` 이 칸 선택 source 의 `write` 를 감싸 쓴 칸이 있을 때 한 번 실행한다 (`editTableCells` 결과에 `keys` · `items` 를 더함). EditableCell 의 Form submit 은 `FormContext` `onSubmit` (세션 `update`) 이 같은 이벤트에 그 편집 번호를 적고, 뒤이어 Form 규칙이 같은 이벤트를 받는다.
- **표시 (DOM · rule)**: 행 데이터 `CatalogBoundRow.edit` → resolver `withEditedRow` (Row record `_editStatus` · `_editedFields`, 모든 층) → 열 투영 (`tableColumns.ts` `markedRow`) 이 Column key 로 Cell `_edited` 와 첫 데이터 칸의 `_rowEdit` → DOM Row `data-edit-status` · Cell `data-edited` · `data-row-edit` + `CatalogTableCell` 이 그 칸 안에 보이지 않는 글자 (「Edited」 · 「New row」 / 「수정됨」 · 「새 행」 — 4 개 언어). 착수 메모의 「런타임에 행 key 로 묻는 길」 대신 record 파생 값이라 저장 성공 뒤 `refreshRows` 한 번으로 바뀐 record 만 다시 그려진다. 칠은 Table rule `rootSelectors` 3 개 — 첫 칸 앞 가장자리 3px 선 (새 행 `--positive-visual` · 고친 행 `--notice-visual`) · 고친 칸 `--notice-visual` 14% 바탕, 칸 선택 칠 앞 (선택이 이긴다). S2 에 행 상태가 없어 순서는 「편집 표시 < 칸 선택」 하나만 정했다 (줄무늬는 Phase 5). D1: data 속성과 칸 내용 안 글자뿐 — ARIA 를 쓰지 않아 §4 목록은 넓히지 않았다. 첫 데이터 칸 = 보통 row header (RAC 는 지정이 없으면 첫 열).
- **검사**: 새 테스트 — builder `preview/catalog/__tests__/adr317EditMarks.test.tsx` 4 (붙여넣기 표시 · 끈 표 없음 / 위치 key 의 넣기 · 지우기 / 「Cells change」 저장 성공 · 다시 고친 칸 · 실패 / EditableCell 저장) · shared `interactions/__tests__/adr317SavedEdits.test.ts` 3 (When 등록 · 저장 성공의 번호 모음 · 실패와 저장 없는 규칙). 정답 표시는 손으로 적음 (위치 key 가 1 부터 센다는 것은 처음 기대값이 틀렸다 — 코드는 맞았다). 변이 RED 11/11 (필드 표시 · 저장 무시 · 이벤트 번호 · 실패 지움 · When 실행 · EditableCell 번호 · 칸 표시 · 스위치 · Row 속성 · 마지막 번호 · 사본 옮김 — 사본 옮김은 처음 GREEN 이라 트리 테스트 (`treeData.test.tsx` +2, 중첩 · 평평한 행) 를 더해 RED, 원복 해시 확인 — 공유 파일을 건드리는 변이라 HEAD + 이 Phase 변경만 담은 worktree 에서 돌림). type-check 통과. 회귀: shared 2,775 · builder `src/preview` · `src/builder/catalogRuntime` · `src/builder/panels` · `src/i18n` 7,064 통과 — 실패는 작업 트리의 ADR-318 WIP (팔레트 · Library · census · componentTraits · collection 표 — 깨끗한 worktree 에서 통과) 와 부하 중 시간 초과 · act 겹침 (단독 실행 통과), 내 변경이 고쳐야 했던 것은 기대값 2 (`adr317BatchWrite` — 결과에 `seq`) · When 감사 행렬 예외 1 (`interactionWhenReach` — 「Cells change」 는 `adr317EditMarks` 가 실행). 표시 저장을 표로 바꾼 뒤 `src/preview` 1,356 통과 · live 재실행.
- **번들** (Phase 3 대비, HEAD + 이 Phase 변경만 담은 worktree 에서 — 작업 트리의 ADR-318 WIP 제외): Builder 1,634,228 → 1,635,466 B (+1,238 — 세션 · resolver · DOM 표시 코드와 chunk 재분할: `dataBinding` −2,256 ↔ `template` +2,617 · `delegatedDom` +565 …) · Preview 172,213 → 172,215 B (+2). 상한 안.
- **live** (`apps/builder/scripts/adr317-p4-edit-marks-live.mjs`, 5173 dev, Chrome · Playwright WebKit 각 7/7): Builder 에 Table + Users 1,000 행 (가상) → name · status 「Editable」 · 「Cell selection」 · 「Paste」 · 「Edit marks」 칩 → endpoint + Table 규칙 「Cells change」 → callEndpoint `!event.items` (문서 검증 통과 — contract 78) → Publish: p2:name 에 「X\t\t9」 → p2 `dirty` · name · status 칸 · 낭독 「Edited」 · 요청 본문 p2 항목 → 응답 전 p2:name 「Y」 → 요청 1 성공 = status 표시만 사라짐 · 요청 2 실패 (500) = name 남음 → p3:status 「4」 성공 = p3 표시 없음 · 값 그대로 · page error 0. 화면: 표시 선 · 칸 바탕이 보이고 선택한 칸은 선택 칠.

### Phase 5 결과 (2026-11-26 — 종결, G5)

- **작성 값**: Table 「Striped rows」 (`isStriped` — composition 확장 · 기본 꺼짐, `d2Provenance.ts`) · Property 탭 모양 구획 (`section: "appearance"`). 새 When · 새 entry 형이 없어 **contract 그대로 (78)**. 색은 새 토큰 `{color.table-stripe}` (`--table-stripe`, alias 표 tone 50 — light `#f8f8f8` · dark `#1b1b1b`: Table 바탕 `base` 25 위 한 단 · 행 hover `neutral-subtle` 100 아래) — S2 에 줄무늬가 없어 소비 지점 대신 단을 적었다 (`colorAliases.ts` source).
- **짝 · 홀 (데이터 층)**: `runtime/tableStripes.ts` `catalogStripedRows` 가 resolver `boundTableRows` 에서 병합 (`catalogMergedRows`) 바로 뒤, 창 · 상자 높이 · 쪽이 자르기 전의 정렬 · 거르기 · 묶기 끝난 행 전체를 한 번 훑는다 — 가상 표의 창 · Builder 표본이 같은 자리의 값을 갖는다. 규칙 (단위 테스트로 고정): 데이터 행만 센다 · **묶음마다 다시** (각 묶음의 첫 데이터 행은 안 칠함 — 착수 메모의 「묶음 표의 모양을 보고 확정」) · 트리의 하위 행은 보이는 순서대로 이어 센다 · 상세 행은 그 행의 것 · 고정 행은 세지 않고 칠하지 않는다 (병합처럼 따로 선다) · 자리 표시 (닫힌 묶음) 제외. 데이터에 연결되지 않은 Table 은 body 의 Row 자리 순서 (`tableTracks.ts` `catalogRowStriped` — 작성한 순서).
- **병합 칸 (G5 의 남은 질문 — 「병합 칸이 없는 표에만」 대안 쓰지 않음)**: 병합 열의 묶음 (ADR-315 Phase 6 — 눈에 한 칸) 은 **묶음 첫 행의 줄무늬**를 따른다. 그 행의 줄무늬와 다른 칸만 Column key 로 적고 (`stripe.runs` → Row `_stripeRuns` → 열 투영 Cell `_cellStripe` `on` · `off`), Canvas 는 Cell rule 의 파생 `stripe` 블록 (`on` = 줄무늬 · `off` = Table 바탕 `base`), DOM 은 `data-stripe` → Table rule 블록 (행이 hover · 눌림 · 선택 · drop 대상이 아닐 때만 — 그때는 행의 상태가 보인다).
- **Canvas**: Row rule 의 파생 `striped` · Cell rule 의 파생 `stripe` 블록 (`presence.ts` `catalogStripeProps` → `catalogDerivedRestVisual`). 선택된 행 (작성한 `selectedKeys`) 은 줄무늬를 내지 않는다 — DOM 에서 선택 칠이 이기는 것과 같은 결과. 발견: rule 이 그리는 칸 (Cell 은 variant `alpha: 0`) 은 record 가 적은 바탕도 variant alpha 를 곱해 투명했다 (`resolveCatalogPaint`) — record 의 `style.backgroundColor` 는 그대로 그리도록 고쳤다 (DOM inline 과 같은 결과, `hasVisibleBoxPaint` 가 이미 그것을 「보이는 칠」 로 세고 있었다).
- **DOM**: Row `data-striped` · Cell `data-stripe` (data 속성 — ARIA 아님, §4 목록 무변경) → Table rule `partStateStyles` 의 세 블록이 행 상태 블록 **앞** (같은 `:where` 무게 — 뒤 블록인 hover · 눌림 · 선택 · drop 대상이 이긴다), 칸 자신의 칠 (편집 표시 · 칸 선택) 은 행 위라 그대로 이긴다. 순서 = 「줄무늬 < 편집 표시 < hover < 선택」 (§5.4 의 착수 메모 순서). **inline 금지**: 병합 표의 Row · Cell 은 선 블록을 inline 으로 쓰는데 (`catalogTakesDerivedVariant`) 그 길이 줄무늬까지 inline 에 실어 선택 칠을 덮었다 (live 에서 발견 — 아래) → `catalogWithoutSheetDerived` 가 시트가 그리는 파생 값을 inline 에서 뺀다.
- **검사**: 새 테스트 — shared `runtime/__tests__/tableStripes.test.ts` 5 (짝 · 홀 · 메타 · 같은 목록 / 묶음 / 트리 · 상세 · 고정 / 병합 묶음 / Table 블록 순서) · builder `preview/catalog/__tests__/adr317StripedRows.test.tsx` 4 (DOM — 켬 · 끔 · inline 0 / 정렬 뒤 자리 / 병합 칸 · 병합 표 inline 0 / 가상 표) · `catalogRuntime/__tests__/adr317StripedRowsCanvas.test.ts` 3 (Canvas — Skia 칠 `#f8f8f8` / 병합 칸 칠 / 선택 행 · 작성 행). 정답은 손으로 적은 짝 · 홀. 변이 RED 16/16 (짝 · 홀 · 묶음 다시 · 고정 행 · 상세 행 · 병합 runs · resolver 계산 · Canvas 선택 행 · Canvas 칸 · DOM `data-striped` · `data-stripe` · 열 투영 · 명시 바탕 alpha · 작성 행 자리 · Row rule 가지 · DOM inline 제외 · Table 시트 블록) (HEAD + 이 Phase 변경만 담은 worktree, 원복 해시 확인). type-check 통과. 회귀 shared 2,763 · builder `src/preview` · `catalogRuntime` · `panels` · `i18n` 7,093 통과, 새 실패 0 (HEAD + 이 Phase 변경만 담은 worktree — 작업 트리에서는 ADR-318 WIP 의 Resizable 실패 5 와 contract 79 fixture 가 섞인다).
- **번들** (Phase 4 대비, HEAD + 이 Phase 변경만 담은 worktree · 일반 `vite build` + closure): Builder 1,635,466 → 1,635,725 B (+259) · Preview 172,215 → 172,275 B (+60 — 테마 색 seed 에 `table-stripe` 두 벌). 상한 안.
- **live** (`apps/builder/scripts/adr317-p5-striped-rows-live.mjs`, 5173 dev, Chrome · Playwright WebKit 각 8/8): Builder 에 Table + Users 1,000 행 (가상 · 행 선택 multiple · Type 「Merge same values」) → Design 패널 「Striped rows」 스위치 → Canvas 표본 둘째 행마다 `striped` · 병합 칸 `off` · `on` → Publish: 그려진 행이 `aria-rowindex` 짝수마다 `data-striped` · 계산된 바탕 `rgb(248, 248, 248)` · inline 0 → 둘째 행 클릭 = 선택 칠 (`rgb(59, 99, 251)`) → 병합 칸 p2 `off` 흰 바탕 · p5 `on` 줄무늬 → 중간 (500 행) 까지 스크롤 = 그려진 행이 자리마다 짝 · 홀 · page error 0. **live 가 잡은 결함 1**: 첫 실행에서 병합 표의 행이 줄무늬를 inline 으로 받아 선택한 행이 줄무늬로 남았다 (단위 테스트는 병합 표의 inline 을 보지 않았다 → DOM 테스트에 단언 추가, 위 「inline 금지」). 남은 것 (LOW): 가상 표가 창 밖에 남겨 두는 focus 행 (`keptRowOf` — 값 없는 자리 표시, 보이지 않는다) 에는 줄무늬 표시가 없다.

### Phase 6 결과 (2026-11-26 — G6 통과, Implemented 는 P5 VoiceOver 청취 뒤)

- **사용자 답 (2026-11-26)**: HC5 붙여넣기 판정 「같은 표 기준으로 통과」 — 기준값은 같은 표 (Editable 열) 의 정렬 클릭. P5 (알림 영역 VoiceOver 청취) 가 끝나면 Implemented.

- **측정 환경 (measurement-validity)**: production 하니스 빌드 (`perf-build-dist.mjs` — `dist-317-g6` = HEAD `63db458e6` + Phase 5 + 하니스 handle) · headed Chrome · 10,000 행 (`datagrid-table-vs-tanstack-live.mjs`). 측정 조건의 「120 Hz」 는 지키지 못했다 — 이날 headed 창이 외부 모니터 (50 Hz) 에 떠 rAF p50 이 20 ms 다 (Phase 0 은 8.4 ms). 그래서 절대값은 Phase 0 기준선과 바로 비교하지 않고, 판정은 전부 **같은 시점의 교대 · 짝 측정**으로 했다. 다른 세션의 WebKit Playwright 가 같은 시각에 CPU 를 쓴 구간이 있어 (첫 교대 묶음 — 기본 표 정렬 262 ms 로 높게 나온 구간) 그 구간의 절대값은 판정에 쓰지 않았다.
- **HC5 — 기능을 끈 표 (끈 arm ↔ 켠 arm 교대 3 쌍)**: 같은 빌드 · 같은 문서, 끈 arm = 「Cell selection」 + Name · City 「Editable」, 켠 arm = 거기에 「Paste」 · 「Fill handle」 · 「Edit marks」 · 「Striped rows」. 중앙값 비율 (켠 / 끈): 로드 0.996 · 힙 0.911 · 스크롤 p95 1x 1.000 · 4x 1.087 · 4x frame 당 작업 1.091 · 정렬 클릭 1x Amount 0.980 · Name 1.069 · 4x Amount 1.030 · Name 1.082 — 전부 ≤ 1.10 (쌍 하나만 보면 4x Amount 1.147 · 4x frame 당 작업 1.135 가 있다 — 중앙값으로 판정). page error 0.
- **회귀 대조 — Phase 0 빌드 ↔ 지금 (교대 3 쌍)**: 기본 표 (Phase 0 기준선과 같은 설정, base = Phase 0 이 기준선을 잰 `/private/tmp/perf-baseline-dist` — `e8c51fa2a`, 소스 변경 0): 로드 1.076 · 힙 1.000 · 스크롤 p95 1x 0.976 · 정렬 1x 1.018 · 0.996 · 4x 0.984 · 0.969 · 4x frame 당 작업 1.04 (4x 스크롤 p95 는 1.188 — 50 Hz 의 한 frame (100 ↔ 120 ms) 차이로 갈리는 값이라 frame 당 작업으로 본다). Editable 표 (`cellsel,editable`, base = `e8c51fa2a` + 하니스 handle 한 줄 worktree 빌드): 로드 1.004 · 힙 1.000 · 정렬 1x 1.017 · 0.987 · 4x 1.007 · 0.984 · 스크롤 p95 1.000 · 0.995 · frame 당 작업 0.988 · 0.950. **Phase 1 ~ 5 가 끈 표를 느리게 하지 않았다.**
- **HC5 — 1,000 칸 붙여넣기 (기준값과 다름 — 사용자 확인 필요)**: 10,000 행 · Amount 정렬 · 가상 표의 첫 행 Name 칸에 값이 모두 다른 1,000 줄 → 그 칸이 새 값을 그린 다음 frame. 보이는 행이 따로 적은 정답 (1 ~ N 번째 줄) 과 같고 알림이 「Pasted into 1000 cells」 (모든 회차). 시간: 1x 240 ~ 275 · 4x 930 ~ 1,219 ms (실행 묶음마다). **F9 기준선 (Phase 0 의 정렬 클릭 1x 161 ~ 169 · 4x 617 ~ 648 ms) 은 「Editable」 열이 없는 표의 값이다** — 붙여넣기는 「Editable」 열이 있어야 쓰고, 그 열이 있는 표는 Phase 0 빌드에서도 정렬 클릭이 1x 250 ~ 267 · 4x 885 ~ 968 ms 다 (위 회귀 대조의 base). 같은 표의 정렬 클릭과 같은 페이지 · 같은 시점에 짝으로 재면 (하니스 `--measure-paste` 가 회차마다 Amount 정렬 두 번 → 붙여넣기, 3 실행): 1x 붙여넣기 중앙값 240.5 · 249.4 · 250.6 ↔ 정렬 292.3 · 285.4 · 296.4 ms, 4x 945.6 · 934.8 · 985.9 ↔ 1,064.8 · 1,012.9 · 1,104.5 ms — **3 / 3 붙여넣기 ≤ 같은 표의 정렬 클릭**. 따로 잰 Phase 0 빌드의 같은 표 정렬과 견주면 1x 는 같고 4x 는 0 ~ 10 % 높다 (다른 실행 — 실행 사이 흔들림이 15 % 가까이). 비용 내역 (CPU profile, 1x): 행 다시 읽기 (`edit` → `refreshRows`) 127 ms 가운데 flatten 101 · 세션 편집 재생 15 (`replayItemEdits` · 「Edit marks」 표시) · 나머지는 React 그리기 — 같은 표의 정렬 클릭도 flatten 98 ms 로 같은 크기다. **판정 제안**: HC5 의 「정렬 클릭 기준선 (F9)」 을 「같은 표 (Editable 열) 의 정렬 클릭」 으로 읽는다 — 붙여넣기가 할 수 있는 표에서 잰 정렬이라야 같은 일을 견준다 (measurement-validity — 기준값은 같은 조건).
- **번들 (사용자 결정 7)**: Phase 0 기준선 대비 Builder 1,634,043 → 1,635,732 B (+1,689 ≤ +3,000) · Preview 172,215 → 172,276 B (+61 ≤ +1,500). Phase 6 자체는 +7 · +1 B (하니스 handle 은 `DEV || VITE_COMPOSITION_HARNESS` 가지 안 — 일반 빌드에서 빠진다). 상한 (1,650,000 · 327,000) 안.
- **D1 예외 목록 ↔ 구현 (정적 검사)**: `packages/shared/src/catalog/runtime/__tests__/adr317D1Exception.static.test.ts` 3 — `tableCellSelection.ts` 가 듣는 이벤트 (`addEventListener` + `BEFORE_CLIPBOARD`) · 다루는 키 (`key === …` · `case …` + 화살표 접두) · 쓰는 ARIA 가 정해 둔 목록과 같고, 각 이름이 `ssot-hierarchy.md` 의 「Table 칸 범위 선택 예외」 절에 적혀 있다 (`aria-readonly` 는 없어야 · `role="status"` 는 있어야). 변이 RED 5/5 (새 listener · 규칙에서 `beforepaste` 빠짐 · 새 키 Enter · `aria-readonly` 씀 · 규칙의 `role="status"` 빠짐 — 원복 해시 확인).
- **`/cross-check` (G5 재확인 — `apps/builder/scripts/adr317-g6-crosscheck-live.mjs`, 5173 dev, Chrome · Playwright WebKit 각 4/4)**: Users 6 행 (Type A A A B B B) · 「Striped rows」 · Type 「Merge same values」 표를 Builder Canvas (camera scale 1 로 표를 화면 왼쪽 위에) 와 Publish 에서 찍어, 행마다 Name 칸 · Type 칸의 왼쪽 안쪽 한 점을 읽는다 — Name = 흰 · 줄 · 흰 · 줄 · 흰 · 줄, Type = 흰 · 흰 · 흰 · 줄 · 줄 · 줄 (묶음 첫 행의 줄무늬) 이 두 화면 모두 정답과 같고 (`255` · `248`) 두 화면끼리 같다 · page error 0. 화면으로도 같은 칠.
- **종결 live 재확인 (Chrome · WebKit)**: Phase 2 ~ 5 의 live 하니스를 지금 작업 트리 (5173 dev) 에서 다시 — 붙여넣기 (`adr317-p2-paste-live.mjs`, Chrome 8/8 · WebKit 7/7 — WebKit 은 클립보드 쓰기 단계 4 없음): 복사 → 붙여넣기 · Excel 형식 · Delete · **잘라내기 (새 단계 5b — p3 의 Editable 칸 비움 · 알림 「Cut 2 cells · 1 skipped」 · p7 에 붙여넣기 = `Name 3` · `3` · type 그대로)** · Ctrl / Cmd + A 뒤 한 값 1,000 행 (화면 반영 Chrome 226 · WebKit 278 ms, dev · 1x) / 채우기 (`adr317-p3-fill-live.mjs`, WebKit 5/5 · Chrome 4/5 → 다시 2 회 5/5): 손잡이 끌기 자동 스크롤 50 행 · Ctrl / Cmd + D / 편집 표시 (`adr317-p4-edit-marks-live.mjs`, 각 7/7) / 줄무늬 (`adr317-p5-striped-rows-live.mjs`, 각 8/8). Chrome 채우기 첫 실행의 실패 1 은 builder page error `CATALOG_WORKSPACE_REQUIRED` (`react.runtime.ts` `useCatalogWorkspace` — 패널이 workspace context 밖에서 그려짐, 표 · 채우기 코드 아님) — 같은 하니스를 오류 stack 을 받게 해 2 회 더 돌려 재현되지 않았다 (가설: 같은 dev 서버를 쓰는 다른 세션의 파일 저장이 일으킨 HMR 재마운트 — LOW, 재현 시 별도로 본다).
- **규칙 문서**: `ssot-hierarchy.md` 의 넓힘 머리에 정적 검사 이름 · `data-interaction.md` 에 편집 격자 안내 한 줄 · `catalog-subparts.md` 의 Table 항목에 줄무늬 · `composition-patterns/reference/table-data-grid.md` 에 「편집 격자」 절 (쓰기 · 편집 표시 · 줄무늬 · 하니스 플래그 — live 가 잡은 결함의 Why 포함).
- **하니스**: `datagrid-table-vs-tanstack-live.mjs` 에 `--with editable` (Name · City 「Editable」 — production 빌드에서 하니스 handle `table`) · `--with adr317` (네 스위치) · `--measure-paste` (붙여넣기 시간 · 정답 행 · 알림 + 같은 표 정렬 짝) · `--profile-paste` (+ `--profile-rate 4`). `adr317-p2-paste-live.mjs` 에 잘라내기 단계 (5b — Phase 2 에서 단위 테스트까지였던 것).
