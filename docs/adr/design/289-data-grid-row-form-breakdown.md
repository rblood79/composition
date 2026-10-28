# ADR-289 Design Breakdown — 격자 행 양식 · 열 편집기 절 구조 · 선택 행 동작

> 본문: [289-data-grid-row-form-column-editor-selection-actions.md](../289-data-grid-row-form-column-editor-selection-actions.md). 착수는 사용자 `/execute-adr 289`. 선행: ADR-288 G6 수정 7 ~ 9 (격자 체크박스 공용 부품 · `Insert ▾` 메뉴 · 표 설정 팝오버 — 2026-10-29 완료, Implemented 는 G6 사용자 확인 뒤). 이 문서가 구현 정본이고 `docs/adr/evidence/` 는 로컬 전용이라 인벤토리 · 실측 결론은 여기에 둔다.

## 1. Phase 0 — 인벤토리 · RED (G0)

### 1-1. 코드 사실 (2026-10-29 실측, ADR 본문 §현재의 근거)

| 사실                    | 위치                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 빈 행 삽입              | `panels/datatable/grid/DataGrid.components.tsx` `addRow` — `insert_rows` 끝 · `id` = `DataGrid.runtime.ts:101` `nextRowId` · 나머지 `defaultValue ?? null`                    |
| 셀 편집기 타입 분기     | `DataGrid.components.tsx:1329` (`inputMode decimal`) · `:1365 ~ 1369` (JSON · date · datetime 팝오버) · `cellValue.ts:77 ~ 82` `resolveCellEditorKind` · `INLINE_TEXT_MAX 80` |
| 타입 강제               | `cellValue.ts:16` `coerceCellValue(type, raw)` — 빈 = `null` 성공 · 실패 = `null` + `ok:false` · `formatCellValue:65`                                                         |
| 기본값 입력 (글자 저장) | `grid/ColumnEditorPopover.tsx:366 ~ 381` `patchField({ defaultValue: v === "" ? null : v })`                                                                                  |
| 열 편집기 필드 8        | `ColumnEditorPopover.tsx:269 ~ 400` fieldset 이름 · 타입 · (참조) · 필수 · 라벨 · 기본값 · 사용처 · 삭제                                                                      |
| 타입 11 종 (이름만)     | `utils/fieldTypes.ts:28 ~ 39` `FIELD_TYPES` — i18n `datatable.types.*` (translations 5889 ~ · 6443 ~)                                                                         |
| `required` 소비 0       | `grep required panels/datatable/grid/` → 열 편집기 스위치만                                                                                                                   |
| 선택 행 동작            | `DataGrid.components.tsx` `selectedRowIndexes` · `deleteSelected` (`remove_rows`) · 바 교체 (G6 수정 8) · `handleExportCSV` 전체                                              |
| ops                     | `packages/shared/src/schemas/dataChange.ts` `insert_rows:218` · `set_cell:211` · `remove_rows:224` · `add_field:193` · `update_field:199`                                     |
| 본문 레이아웃           | `DataTablePanel.css:57 ~ 60` (목록 · 본문 격자) · `:156` `.datatable-surface-body` flex 열 · `DataTablePanel.tsx` `DATA_SURFACE_BODY_MIN 320` · `DATA_SURFACE_NARROW_MAX 459` |
| 양식 부품 선례          | `ColumnEditorPopover` (Popover + Dialog 288) · `components/TableSettingsPopover.tsx` (같은 부품, G6 수정 9) · `ImportPreview.tsx` (본문 안 임시 양식 136 줄)                  |
| 메뉴 시트               | `components/property/PropertyRowMenu.css` `property-row-menu` (Insert ▾ · 행 ⋮ 가 재사용)                                                                                     |

### 1-2. Phase 0 할 일

- RED 4 (`grid/__tests__/adr289Red.test.tsx`, `it.fails`): ① `Insert row…` 메뉴 → 양식 (`role=dialog` 「… 에 행 추가」) 없이 `insert_rows` 즉시 ② `required: true` 열이 비어도 `insert_rows` 통과 ③ `boolean` 열 `defaultValue: "true"` → 새 행 셀이 `"true"` 글자 ④ 행 선택 뒤 「복사」 버튼 없음.
- 인벤토리: 셀 편집기의 타입별 입력 (어느 타입이 인라인 · 팝오버인지) 표 · `coerceCellValue` 가 받는 입력 형식 (date = `Date.parse` · boolean = `true/1/yes`) · 본문 폭 — 패널 기본 100 % (사용자 작업 영역 1,478 px 에서 본문 ≈ 1,240) · 저장 폭 280 (ADR-288 R4 케이스) 에서 본문 = 52 → 양식이 자리를 대신하는 경계 680 의 근거.
- Phase 0 은 go/no-go 가 아니다 (사용자 결정 1 ~ 5 만 묻는다).

## 2. Phase 1 — 행 양식 (G1)

- 새 `grid/RowForm.tsx` (+ `.css` · `.test.tsx`): props `table · mode: { kind: "insert" } | { kind: "update", rowIndex, opened }` (`opened` = 열 때의 `mockData` 참조 · JSON snapshot — 저장 시 `resolveRowFormTarget`) · `onClose` · `onSaved`. RAC `Dialog` (비모달, `aria-label` = 제목) 를 `.datatable-surface-body` 의 두 번째 열에 — `DataTableEditor` 가 `rowForm` 상태를 들고 `.datatable-editor-split` (grid `minmax(0,1fr) 360px`) 로 격자와 나란히. 본문 폭 < 680 이면 `data-replace` → 격자 숨김 · 헤더 ✕ 복귀 (ADR-288 좁은 폭 어법).
- 필드 순서: `required` 먼저 → 「선택 항목 — 비워 두면 기본값」 `fieldset`. 라벨 = 열 이름 + 타입 아이콘 (`resolveFieldType`).
- 입력 부품 `grid/FieldValueInput.tsx` (행 양식 · 열 편집기 기본값 공용): 타입별 분기 (string · email · url = textarea auto-grow · number = `inputMode decimal` · boolean = 3 상태 Select (비움 · 켬 · 끔) · date · datetime = native · image = URL + `<img>` 미리보기 · array · object = JSON textarea (`JSON.parse` 즉시 · 오류 글) · reference = RAC `ComboBox` — 대상 표 `collections.get(reference.collectionId)` 의 행에서 `keyField` 값 + 첫 string 열, `useDeferredValue` 필터 50 개 · id = 읽기 전용 「자동: row_N」 (`nextRowId`)). 값은 칸마다 `{ text, touched }` 로 든다 — 처음 `text` 는 Insert 면 빈 글자, Update 면 `formatCellValue(현재 값)` (구조 값 = JSON). 저장 시 `coerceCellValue(type, text)` — 양식과 셀이 같은 규칙.
- placeholder: Insert = `resolveFieldDefault(field)` 가 값을 주면 `t("rowFormDefault", { value: formatCellValue(value) })`, 아니면 `t("rowFormEmpty")` · Update = 늘 `t("rowFormEmpty")` (기본값을 보이지 않는다 — 지우면 `null`).
- 최종 값 (`finalRowValue(mode, field, draft, current)` — `grid/rowFormValues.ts`, 순수 함수): Insert = 빈 `text` → `resolveFieldDefault` → 없으면 `null`, 아니면 강제 값 · Update = `touched` 아니면 **쓰지 않음** (현재 값 보존), `touched` + 빈 `text` → `null`, 아니면 강제 값. `boolean` 3 상태의 「비움」 = 빈 `text` 와 같다.
- 검증: `required && 최종 값 == null` (Update 는 보존 칸의 현재 값 포함) → 칸 아래 `role=alert` 글 · 저장이 첫 오류 칸으로 포커스. `coerceCellValue` 실패 → 같은 자리 오류.
- 저장: insert = `applyDataChange({ ops: [{ op: "insert_rows", rows: [row], at: rows.length }] })` · update = `touched` 이고 최종 값이 현재 값과 다른 칸만 `set_cell` 배열 한 호출 (변경 0 이면 닫기만). 대상 index 는 아래 「대상 찾기」 결과 — 찾기와 `applyDataChange` 호출 사이에 await 없음. 저장 뒤 `announceDataPanelStatus` (`gridRowAdded` · 새 `rowFormUpdated`). 「계속 추가」 켜짐이면 양식 비우고 첫 칸 포커스.
- Update 진입: 선택 열 안 ↗ (`SquareArrowOutUpRight`, hover · focus-within 에 보임 — `SELECT_COLUMN` 폭 36 → 56) · 셀 `Shift+Enter` (`gridKeys.ts` 에 `open-row` 액션). **대상 판정** (`resolveRowFormTarget(latest, opened, writtenFieldIds)` — `grid/rowFormTarget.ts`, 순수 함수, R2 · 리뷰 H2 round 2): `opened = openRowFormTarget(table, rowIndex) = { rowIndex, mockData: table.mockData, snapshot: JSON.stringify(table.mockData) }` (열 때 한 번 — ≤ 1,000 행), `latest = useDataStore.getState().collections.get(table.id)` (렌더 prop 아님). ① `latest` 없음 → 충돌 ② `latest.mockData === opened.mockData` → `{ rowIndex }` ③ 아니면 `JSON.stringify(latest.mockData) === opened.snapshot` 이고 `writtenFieldIds` 가 모두 `latest.schema` 에 있으면 `{ rowIndex }` (이름 · 설정 · schema 변경 · Undo 복귀) ④ 그 밖 → `{ conflict: true }` → 저장 거절 · 입력 유지 · 양식 위 `role=alert` `rowFormConflict` (「닫기」 — 격자에서 그 행을 다시 ↗). `id` · 행 객체 비교는 하지 않는다 — 둘 다 정체성이 아니다 (본문 §제약). props 는 `{ kind: "update", rowIndex, opened }`.
- 닫기: ✕ · Esc · 취소 — dirty 면 `ConfirmDialog` (`rowFormDiscardTitle`).
- `Insert ▾ → Insert row…` 는 양식 열기 (사용자 결정 2) — `addRow` 는 양식의 빈 저장 경로로 흡수. 메뉴 라벨 `…`.
- i18n (ko · en): `rowFormInsertTitle {name}` · `rowFormUpdateTitle {name}` (formattedMessages) · `rowFormRequired` · `rowFormOptional` · `rowFormOptionalHint` · `rowFormDefault {value}` · `rowFormEmpty` · `rowFormAuto {value}` · `rowFormCreateMore` · `rowFormSave` · `rowFormRequiredError` · `rowFormInvalid {type}` · `rowFormUpdated` · `rowFormConflict` · `rowFormDiscardTitle` · `rowFormDiscardMessage` · `openRow` · `insertRow` → 「Insert row…」.
- 테스트: `rowFormTarget.test.ts` — step 을 흉내 낸다: 바뀐 표는 `fromCollectionEntry(toCollectionEntry(reduced))` 로 다시 투영 (JSON 복제 → 새 행 객체), 안 바뀐 표는 같은 `DataTable`. 반례 — `id` 없는 A/B/C 에서 B 를 열고 `reduceDataOps` 로 A `remove_rows` → 충돌 · 그 inverse (`insert_rows at 0`) 적용 → snapshot 같음 → `rowIndex` · 같은 `id` · 같은 값의 B/C 에서 B 삭제 → 충돌 · 표 이름만 `update_collection` → `rowIndex` · 쓰는 field 를 `remove_field` → 충돌 · 다른 표 변경 → 같은 참조 → `rowIndex` · 표 삭제 → 충돌 · `rowFormValues.test.ts` (Insert 빈 칸 = 기본값 · Update 지움 = `null` (기본값 `fallback` 있어도) · Update 미수정 = 쓰지 않음 · boolean 「비움」 두 모드 · 필수는 최종 값) · `RowForm.test.tsx` (필수 오류 · 저장 ops · update 변경 칸만 · Create more · 충돌 안내 · 입력 유지 · 충돌 뒤 닫기) · `DataGrid.test.tsx` 갱신 (Insert row… → 양식 · ↗ · Shift+Enter) · RED ① ② ③ GREEN.
- G1 live: 본문 §Gates.

## 3. Phase 2 — 열 편집기 절 구조 · 만들기 경로 (G2)

- `ColumnEditorPopover.tsx` 안을 `fieldset` 절 넷으로 재배치 (팝오버 288 그대로): **이름** (이름 · 라벨) · **타입** (검색 목록 — 항목 = 아이콘 · 이름 · 설명 한 줄 `datatable.typeHints.*` · 기본값 = `FieldValueInput`) · **규칙** (필수 · 참조 대상 — `reference` 일 때) · **사용처 · 삭제**. 기본값 칸은 `FieldValueInput` 의 `text` (처음 = `formatCellValue(resolveFieldDefault(field).value)`) 를 commit 때 `coerceCellValue(type, text)` 로 바꿔 `patchField({ defaultValue })` — 구조 타입은 파싱된 배열 · 객체, `""` = `null`. 타입을 바꾸면 `resolveFieldDefault({ ...field, type: next })` 로 다시 맞추고, 실패면 `null` + 안내.
- 만들기 모드 `mode: "create"`: `Insert ▾ → Insert column…` 이 `+` 슬롯 (`.datagrid-add-field-slot`) 을 anchor 로 연다 — 이름 · 타입 · 기본값 · 필수 · 참조 · 「계속 추가」 → `add_field` 한 번 (`planFieldRename` 의 키 검사 재사용). 머리글 `+` 인라인 입력은 그대로.
- 읽는 쪽: `addRow` · 행 양식 · 열 편집기 (붙여넣기는 그대로 — 붙여넣는 값이 있다) 가 `grid/fieldDefault.ts` `resolveFieldDefault(field): CoercedCell` 하나 (리뷰 H1): `defaultValue` 가 `null` · `undefined` → `{ ok: true, value: null }` · 타입이 이미 맞으면 **그대로** (`boolean` = boolean · `number` = 유한 number · `array` = `Array.isArray` (빈 배열 포함) · `object` = plain object (배열 · `null` 아님) · `string` · `email` · `url` · `image` · `reference` = string) · string 이면 `coerceCellValue(type, value)` (`date` · `datetime` 은 늘 여기 — 정규화) · 그 밖 `coerceCellValue(type, formatCellValue(value))`. `String()` 금지 (`[object Object]` · `1,2` · `[]` → 빈 글자). 구조 값을 행에 넣을 때는 `structuredClone` (열 정의와 행이 같은 객체를 나누지 않게). 테스트 `fieldDefault.test.ts`: `{ enabled: true }` · `[1, 2]` · `[]` 보존 · `'{"a":1}'` 글자 → 객체 · `"true"` → `true` · `"3"` → `3` · `3` (string 열) → `"3"` · `"abc"` (number 열) → `ok:false` · `null` → `null`.
- 타입 설명 11 종 (사용자 결정 3 — 초안):

| 타입        | ko                            | en                                    |
| ----------- | ----------------------------- | ------------------------------------- |
| `string`    | 글자 — 이름 · 제목 · 설명     | Text — names, titles, descriptions    |
| `number`    | 숫자 — 계산 · 정렬에 쓴다     | Number — for math and sorting         |
| `boolean`   | 켬 · 끔                       | On or off                             |
| `date`      | 날짜 (연 · 월 · 일)           | A calendar date                       |
| `datetime`  | 날짜와 시각                   | A date with a time                    |
| `email`     | 이메일 주소                   | An email address                      |
| `url`       | 웹 주소                       | A web address                         |
| `image`     | 이미지 주소 — 그림으로 보인다 | An image address — shows as a picture |
| `array`     | 목록 — 값 여러 개 (JSON)      | A list of values (JSON)               |
| `object`    | 묶음 — 이름 · 값 쌍 (JSON)    | A set of name · value pairs (JSON)    |
| `reference` | 다른 표의 행을 가리킨다       | Points at a row of another table      |

- 테스트: `ColumnEditorPopover.test.tsx` 갱신 (절 넷 · 설명 · boolean 기본값 저장 타입 · create 모드 `add_field`) · RED ③ 기본값 GREEN.

## 4. Phase 3 — 선택 행 바 (G3)

- `DataGrid.components.tsx` 선택 시 `toolbar-actions` = `복사 ▾` (CSV · JSON — `navigator.clipboard.writeText`, Papa `unparse(selectedRows, { columns })` / `JSON.stringify(selectedRows, null, 2)`) · `내보내기 ▾` (선택 행 CSV · JSON 파일 — `handleExportCSV` 를 행 인자 받게) · `Delete N rows`. 선택 없을 때 `Export ▾` (전체 CSV · JSON). `announceDataPanelStatus` 「N 행 복사」.
- i18n: `copy` · `copyCsv` · `copyJson` · `exportSelectedCsv` · `exportSelectedJson` · `exportJson` · `gridRowsCopied {count}`.
- 테스트: `DataGrid.test.tsx` (클립보드 mock · 선택 2 → CSV 머리글 + 2 행 · JSON 길이 2) · RED ④ GREEN.

## 5. Phase 4 — 번들 · 성능 · 문서 (G4)

- 번들: ADR-288 Phase 5 의 scratchpad `bundle288.sh` 방식 (착수 HEAD worktree before / 작업 트리 after · `adr209-bundle-closure.mjs`) — initial Δ ≤ +300 B · Preview Δ 0 · `datatable` chunk Δ 기록.
- `reference` ComboBox: 합성 대상 표 10k 행 (규모 전용 — 분포 인용 금지) 입력 p95 ≤ 16 ms, foreground · DPR2 · visible 기록.
- 문서: `panel-structure.md` 「본문 안 양식 자리 — 격자 옆 두 번째 열 · 좁으면 대신」 한 항 · README · CHANGELOG · `docs:stale-symbols` 0.

## 6. G5 — 사용자 확인 → Implemented · `completed/` 이동

## 7. 기록

(execute-adr 가 phase 마다 적는다.)
