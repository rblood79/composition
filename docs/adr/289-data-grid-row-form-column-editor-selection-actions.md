# ADR-289: 데이터 격자의 행 · 열 입력 양식 — 행 양식 (삽입 · 수정) · 열 편집기 절 구조 · 선택 행 복사 · 내보내기

## Status

Proposed — 2026-10-29

- 사용자 요청: `/create-adr` (2026-10-29) — ADR-288 G6 수정 7 ~ 9 (격자 체크박스 · Insert 메뉴 · 표 설정 팝오버) 직후.
- 방향을 정한 사용자 원문 (2026-10-28 ~ 29, 같은 대화):
  - 「현재 크롬브라우저 최상단에 supabase table editor 화면 오픈해두었다 구조는 제일 유사한 구조이지않을까한다」 → Supabase Table Editor 를 레퍼런스로 (Context §레퍼런스 — 실제 화면을 열어 읽기 전용으로 대조).
  - 「row와 column 입력화면도 참고하는것은 어떤가」 · 「더 세부적으로 분석해라」 → 행 · 열 입력 화면 분석 (Context §레퍼런스 2 · 3).
  - 「ADR-288 수정으로 처리가능한 것들 부터 모두 처리해 완료후 ADR 설계 시작하자」 → 설정 이동 · Insert 메뉴 · 체크박스는 ADR-288 G6 수정으로 끝냈고 (2026-10-29), **행 양식 · 열 편집기 보강 · 선택 행 동작** 이 이 ADR.
- 사용자가 이미 답한 확인 항목: 격자 위 바는 `Filter · Insert ▾ · Export` 이고 행을 고르면 Insert 자리가 선택 동작으로 바뀐다 (ADR-288 G6 수정 8 — 이 ADR 은 그 자리를 채운다) · 표 설정은 목록 행 ⋮ 의 「Edit table…」 (G6 수정 9 — 이 ADR 범위 밖).
- 리뷰 round 1 (2026-10-29, codex — `docs/adr/reviews/289.md`): HIGH 2 · MEDIUM 1 을 설계에 반영 — H1 기본값 읽기는 `String()` 대신 `resolveFieldDefault` (Decision 2) · H2 행 대상은 `id` 를 믿지 않는 판정 (Decision 1 · R2) · M3 Insert 의 「미입력 = 기본값」 과 Update 의 「지움 = 비움」 분리 (Decision 1). round 2 (같은 날): H1 · M3 해소, H2 는 HIGH 1 로 남음 — 「행 객체 참조」 판정은 store 투영이 바뀐 collection 을 JSON 으로 복제해 (`catalogDataStore.ts:64`) 성립하지 않고, 유일 `id` fallback 은 같은 `id` · 같은 값의 B/C 에서 B 를 지우면 C 를 고른다. → **행 집합 snapshot 비교로 보수적 거절** (Decision 1 · R2) 로 다시 설계. round 3 (같은 날): HIGH 0 · MEDIUM 0 · pending 0 — 실제 catalog transaction 포함 9/9 (행 변경 · 중복 행 삭제 거절, Undo 복귀 · 표 이름 변경 · 다른 표 편집 허용). 전제 확정 (리뷰 승인 = 종결 계약 1). 착수는 사용자 `/execute-adr 289`.
- 메모리: `user-non-developer-list-first-mental-model` (기능 단위 사고 · 진입점 양쪽 · 첫 화면 어휘는 비개발자) · `feedback-design-whole-scope-upfront-no-deferral` (설계는 처음부터 전체 범위) · `feedback-no-document-migration-code-dev-stage` (마이그레이션 코드 금지) · `project-catalog-single-source-of-builder-code` (쓰기는 `applyDataChange` 한 step).

> 구현 상세: [design/289-data-grid-row-form-breakdown.md](design/289-data-grid-row-form-breakdown.md)

## Context

### 도메인

빌더 크롬 UI (패널 표준 ADR-163 · 데이터 패널 ADR-212 → 288) 와 문서 명령 (ADR-286 `DataChange`). D1 · D2 · D3 어느 것도 아니다 — 사용자 캔버스 컴포넌트의 RAC DOM · S2 prop · 시각 값을 건드리지 않는다. 양식 · 팝오버는 Builder 자체 RAC (`:not([data-catalog-id])` 크롬) 이다. 경계 교차 없음.

### 현재 (실측 2026-10-29, main `3a6612001` + ADR-288 G6 작업 트리)

- **행 입력 화면이 없다**: `Insert ▾ → Insert row` 는 `grid/DataGrid.components.tsx` `addRow` 가 빈 행 하나를 `insert_rows` 로 끝에 넣고 (`id` 는 `DataGrid.runtime.ts:101` `nextRowId`, 나머지는 `field.defaultValue ?? null`) 첫 칸에 포커스를 둔다. 값은 셀마다 인라인 입력 (`inputMode="decimal"` — `:1329`) 또는 팝오버 편집기 (`array` · `object` = JSON, `date` · `datetime` — `:1365 ~ 1369`, `cellValue.ts` `resolveCellEditorKind` — 80 자 넘는 글자도 팝오버) 로 넣는다. 한 행을 한 화면에서 보며 채우는 길이 없다.
- **필수 (`DataField.required`, `types/builder/data.types.ts:62`) 는 저장돼도 아무 데서도 쓰지 않는다**: 빈 행 삽입 · 붙여넣기 · 셀 비우기 (`clear-cell`) 어느 길도 `required` 를 보지 않는다 (`grep required grid/` 0 — 열 편집기의 스위치만).
- **기본값은 타입과 무관하게 글자로 저장된다**: 열 편집기 (`grid/ColumnEditorPopover.tsx:366 ~ 381`) 의 기본값 칸은 `<input type="text">` 하나이고 `patchField({ defaultValue: v === "" ? null : v })` — Boolean 열의 기본값이 `"true"` (문자열) 로 들어가고 `addRow` 가 그 문자열을 셀에 그대로 넣는다. 셀 편집 · 붙여넣기는 `cellValue.ts` `coerceCellValue(type, raw)` (빈 입력 = `null`, 실패 = `null` + `ok: false`) 로 타입을 맞추는데 기본값만 이 길을 지나지 않는다.
- **열 편집기는 한 덩어리**: 이름 · 타입 (검색 목록, `utils/fieldTypes.ts:28 ~ 39` 11 종 — i18n `datatable.types.*` 는 이름뿐, 설명 없음) · 참조 대상 (`reference` 의 표 · 키 필드, ADR-284 Phase 4c) · 필수 · 라벨 · 기본값 · 사용처 N · 삭제가 `fieldset.properties-aria` 여덟 개로 한 줄로 이어진다 (495 줄). 새 열은 머리글 끝 `+` 의 인라인 이름 입력 (string 고정) 뿐 — 타입 · 기본값 · 필수를 한 번에 정하려면 만든 뒤 머리글을 다시 연다. `Insert ▾ → Insert column` 도 그 인라인 입력을 연다 (G6 수정 8).
- **선택 행 동작은 삭제뿐**: 행을 고르면 바가 `Delete N rows` 로 바뀐다 (G6 수정 8, `selectedRowIndexes` → `remove_rows`). Export CSV 는 늘 전체 (`handleExportCSV` — `Papa.unparse(rows)`). 복사 (클립보드) · 선택 행만 내보내기는 없다. 격자 셀 복사 · 붙여넣기 (`handlePaste` → `pasteGrid.ts`) 는 있다.
- **쓰기 경로** (ADR-286): 격자의 모든 변경은 `useDataStore.applyDataChange({ ops, origin: "user" })` 한 번 = 문서 명령 한 step = Undo 한 번 (`packages/shared/src/schemas/dataChange.ts` — `insert_rows:218` · `set_cell:211` · `remove_rows:224` · `add_field:193` · `update_field:199`). ops 를 한 호출에 묶으면 한 step.
- **본문 레이아웃** (ADR-288 Phase 3 · G6): `.datatable-surface` = 목록 열 (`--datatable-list-width`, 228 기본) + 본문 (`DataTablePanel.css:57 ~ 60`), 본문 `.datatable-surface-body` 는 flex 열 (`:156`) 이고 하한 320 (`DATA_SURFACE_BODY_MIN`), 패널 ≤ 459 (`DATA_SURFACE_NARROW_MAX`) 면 목록 · 본문이 번갈아 보인다. 격자는 `ResizableTableContainer` + `Virtualizer` (`TableLayout`, 행 28) — 폭이 바뀌면 열이 다시 잰다.
- **문서 스키마**: `DataField` (`key` · `type` · `label` · `required` · `defaultValue: unknown` · `children` · `reference`) — 이 ADR 은 필드를 더하지 않는다 (Supabase 의 Description · unique · CHECK · sensitive 는 우리 모델에 없다 — 범위 밖).
- **번들**: `datatable` 패널은 lazy (`panelConfigs.ts`) 이고 격자 · 열 편집기는 그 안의 editors chunk 다 — 이 ADR 의 코드는 전부 그 chunk 에 들어가 initial 은 변하지 않아야 한다.

### 레퍼런스 — Supabase Table Editor (2026-10-29, 사용자가 연 실제 프로젝트 화면을 읽기 전용으로 대조 — 저장 0)

1. **격자 위 바**: `Filter` · `Sort` · 상태 배지 (RLS) · Role · ⋮ · ↻ · **`Insert ▾`** (Insert row · Insert column · Import data from CSV). 행 체크박스를 고르면 바가 **`Copy ▾` · `Export ▾` · `Delete N rows`** 로 바뀐다. 아래 Page · 100 rows · N record · Data | Definition (읽기 전용 SQL).
2. **행 입력 (Insert row · Update row, 오른쪽 672 px 패널)**: 제목 「Add new row to `users`」 / 「Update row from `users`」. 필드마다 왼쪽 라벨 (열 이름 + 타입), 오른쪽 입력 — uuid = input (placeholder `Default: gen_random_uuid()`), text = textarea (placeholder `Default: NULL`, 모서리 ✎ = 큰 편집기), timestamp = `datetime-local`. **필수 열 먼저**, 아래 「Optional Fields — These are columns that do not need any value」 절로 선택 열 분리. 빈 칸은 기본값이 들어간다 (placeholder 가 그 값을 보인다). 하단 `Create more` 스위치 · Cancel · `Save ⌘↵`. Update row 는 행 hover 의 ↗ (레코드 열기) 로, 셀 더블클릭은 셀 위에 떠오르는 textarea.
3. **열 입력 (Insert column · Update column, 오른쪽 900 px 패널)**: 2열 (왼쪽 절 제목 · 오른쪽 입력) 절 다섯 — **General** (Name — 안내 「lowercase + underscore」 · Description Optional) · **Data Type** (Type 검색 콤보 — 항목마다 아이콘 + 이름 + **설명 한 줄** (`int2 Signed two-byte integer` · `text Variable-length character string` · `{ } json`) · Define as array · Default Value select — 리터럴 또는 식, 「Suggested expressions」) · **Foreign Keys** (Add foreign key) · **Constraints** (Is Primary Key · Allow Nullable · Is unique 스위치 + 설명 · CHECK constraint) · **Data Privacy** (Mark as sensitive). 하단 `Create more` · Cancel · `Save ⌘↵`. Update column 은 값이 채워져 있다 (email: Nullable off · unique on).
4. **표 편집 (Edit table, 768 px)**: Name · Description · RLS · Realtime · Columns 인라인 표 · Foreign keys · Data API URL — ADR-288 G6 수정 9 가 우리 네 항목 (이름 · Use table data · API endpoint · Execution policy) 을 목록 행 ⋮ → 288 px 팝오버로 끝냈다. 이 ADR 범위 밖.

대응표 (Supabase → 우리 데이터 모델):

| Supabase                                         | 우리                                                  | 판정                                                   |
| ------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------ |
| Insert row · Update row 패널 (필수 → 선택 절)    | 없음 — 빈 행 삽입 뒤 셀마다                           | **채택** (Decision 1)                                  |
| 빈 칸 = 기본값 (placeholder 로 표시)             | `addRow` 가 `defaultValue` 를 넣지만 타입 강제 없음   | **채택** + 기본값을 `coerceCellValue` 로 (Decision 2)  |
| 입력은 타입별 (textarea · datetime-local …)      | 셀 편집기에 이미 타입별 (인라인 · 팝오버)             | 같은 규칙 (`cellValue.ts`) 을 양식이 쓴다              |
| Create more                                      | 없음                                                  | 채택 (행 · 열 양식 둘 다, 사용자 결정 5)               |
| 열 패널 절 (General · Data Type · Constraints …) | 한 줄로 이어진 fieldset 8                             | **채택** — 절 넷 (Decision 3)                          |
| 타입 목록의 설명 한 줄                           | 이름뿐                                                | 채택 — 비개발자에게 `string` 보다 「글자」 설명        |
| Default Value select + 「Suggested expressions」 | 글자 input (타입 무관)                                | **타입별 기본값 입력** 으로 (식은 우리 모델에 없음)    |
| Foreign Keys 절                                  | `reference` 대상 (표 · 키 필드) — ADR-284             | 「참조」 절로 이름만 모은다                            |
| Allow Nullable                                   | `required` 의 반대                                    | 「필수」 그대로 (비개발자 어휘)                        |
| Is unique · CHECK · Description · sensitive      | 모델에 없음                                           | 범위 밖 (스키마 변경 = 별도 결정)                      |
| Insert column 패널                               | 머리글 `+` 인라인 이름 입력 (string 고정)             | **채택** — Insert ▾ → 전체 편집기, `+` 는 빠른 길 유지 |
| 행 선택 → Copy ▾ · Export ▾ · Delete N rows      | Delete N rows 만                                      | **채택** (Decision 4)                                  |
| Definition (SQL) · Sort · Role · Realtime · RLS  | 코드 보기 (ADR-285) · 보기 규칙 (ADR-284) · 해당 없음 | 범위 밖                                                |

### 사용자와 제약

- 사용자 (비개발자 · 기능 단위) 는 「행 하나 넣기」 를 한 화면에서 끝내길 기대한다 — Supabase 의 행 패널이 그 모양이다. 지금은 빈 행 → 셀 11 번.
- **Hard — 쓰기 경로 무변경**: 양식의 저장은 `applyDataChange` 한 번 (`insert_rows` 한 행 / 바뀐 칸만 `set_cell` 여러 개를 한 호출에) = Undo 한 번. 패널에서 문서 graph 를 직접 만지지 않는다 (state-management §2 · §3).
- **Hard — 문서 스키마 무변경**: `DataField` 에 필드를 더하지 않는다. 기본값의 타입 맞춤은 **저장할 때** (열 편집기 — 타입별 입력이 값 그대로 저장) 와 **적용할 때** (행 양식 · `addRow` — `resolveFieldDefault`: 타입이 맞는 값은 그대로, 글자 기본값은 `coerceCellValue`, 그 밖의 구조 값은 `formatCellValue` (JSON) 뒤 강제 — Decision 2) 둘 다에서 하고, 기존 문서를 고치는 마이그레이션 코드는 두지 않는다 (메모리 `feedback-no-document-migration-code-dev-stage`).
- **Hard — 행에는 정체성이 없다 (리뷰 H2 round 1 · 2)**: 문서 검증은 `id` 없는 행 · 중복 `id` 행을 받고 (`packages/shared/src/catalog/document/validation.ts:2019 ~ 2021`), CSV · JSON import 도 행을 그대로 넣으며 (`grid/DataGrid.components.tsx:646 ~ 669`), `normalizeCollection` 은 필드 id 만 채운다. 행을 가리키는 것은 `set_cell` · `remove_rows` 의 **index** 뿐이다 (`stores/utils/dataChange.ts:737 ~ 783`). 행 **객체** 도 정체성이 아니다 — 바뀐 collection 은 sink 가 `toCollectionEntry` 로 JSON 복제해 문서에 쓰고 (`catalogRuntime/catalogDataStore.ts:64` `json`), 다음 투영이 새 행 객체를 만든다 (Undo 도 같다). 살아남는 identity 는 **collection 단위** 하나다: step 은 건드린 entry 만 바꾸고 (`packages/shared/src/catalog/document/graph.ts:691` `commit` — staged 만 `replace`), `fromCollectionEntry` 가 entry 객체마다 `DataTable` 을 캐시해 (`catalogRuntime/catalogDataRead.ts:31 ~ 58` `tableCache`) 건드리지 않은 표의 `table.mockData` 배열은 **같은 참조** 로 남는다. 그래서 「이 표의 행이 양식을 연 뒤 바뀌었는가」 는 알 수 있어도 「그 행이 지금 어디 있는가」 는 알 수 없다 — 바뀌었으면 거절한다. 적용은 동기다 — `applyNow` 가 호출 순간의 `get().collections` 를 reduce 한다 (`dataChange.ts:1087`).
- **Hard — 격자가 보이는 채로**: 행 양식은 격자를 가리지 않는다 (Supabase 의 오른쪽 패널 — 레코드를 넣으며 다른 행을 본다). 본문 하한 320 · 좁은 폭 규칙 (≤ 459 번갈아 보기) 과 양립해야 한다.
- **Hard — 패널 표준**: 입력 묶음은 `fieldset.properties-aria` + `legend.fieldset-legend` (ADR-163), 보조 액션 2 개 이상은 ⋮ 메뉴, 팝오버 · 양식은 Builder RAC (`Dialog` · `Popover` · `Menu` · `Switch` · `ComboBox`). 양식 접근성은 web-interface-guidelines — Enter 가 저장 (textarea 는 ⌘Enter), 저장 시 첫 오류로 포커스, 저장 안 한 변경이 있으면 닫기 전에 확인.
- **Hard — 번들**: Builder initial JS gzip Δ ≤ +300 B (`adr209-bundle-closure.mjs`, 착수 HEAD 대비 — 코드는 전부 `datatable` lazy chunk) · Preview Δ 0.
- **Hard — 이름 · 어휘**: 첫 화면 어휘는 비개발자 (「필수」 · 「기본값」 · 「참조」 · 「글자」), 메뉴 항목은 `…` 로 후속 열림 표시 (「Edit table…」 과 같은 어법).

## Alternatives Considered

### 대안 A — 행 양식을 팝오버 (288 px, 열 편집기 · 표 설정과 같은 부품) 로

- 설명: `Insert ▾ → Insert row…` 는 Insert 버튼 아래, Update row 는 행의 ↗ 아래에 `Popover` + `Dialog`. 부품 재사용 100 %.
- 위험: 기술 **L** / 성능 **L** / 유지보수 **M** (열 10 개면 288 px 안에서 스크롤만 길어진다 · 팝오버는 바깥 클릭에 닫혀 격자를 보며 채우는 흐름과 어긋난다 · 트리거가 사라지는 Update row (가상화로 행이 화면 밖으로 가면 anchor 소실)) / 마이그레이션 **L**.

### 대안 B — 행 양식을 본문 오른쪽 사이드 패널 (격자 옆 두 번째 열) 로 ✅

- 설명: `.datatable-surface-body` 를 `격자 minmax(0,1fr) | 양식 360px` 두 열로. 양식은 RAC `Dialog` (비모달 — `aria-label` · 포커스 이동 · Esc) 를 그 열에 그린다. 본문이 좁으면 (격자 + 360 < 본문 하한 320 + 360 = 680) 양식이 격자 **자리를 대신** 한다 (ADR-288 의 좁은 폭 번갈아 보기 규칙과 같은 어법, 헤더 ✕ = 격자로 복귀). Update row 는 anchor 가 필요 없다 — 행 index 만 든다.
- 위험: 기술 **M** (격자 폭이 바뀌면 `ResizableTableContainer` 가 열을 다시 잰다 — 가상화 재배치 1 회 · 양식 열림 중 행 삭제 · 재정렬 시 index 추적) / 성능 **L** / 유지보수 **L** (양식 하나로 Insert · Update) / 마이그레이션 **L**.

### 대안 C — 행 양식을 모달 Dialog (가운데) 로

- 설명: RAC `Modal` + `Dialog` 가운데 480 px. 포커스 · Esc · 바깥 클릭이 RAC 몫.
- 위험: 기술 **L** / 성능 **L** / 유지보수 **M** (격자를 가린다 — 다른 행의 값을 보며 채우지 못한다, Supabase · Airtable (레코드 확장은 가운데 모달이지만 격자 편집이 주) 어느 쪽 흐름도 아니다) / 마이그레이션 **L**. 기각.

### 대안 D — 현상 유지 (격자 인라인만) + 열 편집기 절 구조만

- 설명: 행 양식은 두지 않고 열 편집기 · 선택 바만 손본다.
- 위험: 기술 **L** / 성능 **L** / 유지보수 **M** (필수 · 기본값이 계속 아무 데서도 안 보인다 · 긴 글 · JSON · 날짜는 셀 팝오버 11 번) / 마이그레이션 **L**. 사용자 요청 (「row 와 column 입력화면도 참고」) 과 어긋나 기각.

### Risk Threshold Check

| 대안 | HIGH+ | 판정                                                |
| ---- | :---: | --------------------------------------------------- |
| A    |   0   | 유지보수 M — 팝오버 anchor · 폭                     |
| B    |   0   | 기술 M — 격자 재측정 · index 추적 (Gate G1 로 관리) |
| C    |   0   | 격자를 가림 — 기각                                  |
| D    |   0   | 요청 미충족 — 기각                                  |

HIGH 없음 — 루프 종료. B 채택.

## Decision

**대안 B**. 네 결정:

1. **행 양식 (사이드 패널)** — `Insert ▾ → Insert row…` 와 행 hover · focus 의 ↗ (`Update row`, 선택 열 안 — 열 폭 36 → 56) · 셀에서 `Shift+Enter` 가 같은 양식을 본문 오른쪽 열 (360 px) 에 연다. 제목 「`Roles` 에 행 추가」 / 「`Roles` 의 행 수정」 (i18n `formattedMessages`). 필드마다 라벨 (열 이름 · 타입 아이콘) + 입력 — **필수 열 먼저**, 아래 「선택 항목 — 비워 두면 기본값」 절. 입력은 타입별: `string` · `email` · `url` = 자라는 textarea (1 줄 시작) · `number` = `inputMode="decimal"` · `boolean` = 셋 중 하나 (비움 · 켬 · 끔) · `date` = `type="date"` · `datetime` = `datetime-local` · `image` = URL 입력 + 미리보기 · `array` · `object` = JSON textarea (유효성 즉시) · `reference` = 대상 표 행 ComboBox (키 필드 값 · 첫 글자 열 표시, 50 개까지 필터) · `id` = 읽기 전용 「자동: row_6」. **빈 칸의 뜻은 모드마다 다르다** (리뷰 M3) — **Insert**: 칸은 빈 채로 시작하고, 손대지 않았거나 비운 칸은 기본값 (`resolveFieldDefault`) → 없으면 `null`, placeholder 「기본값: X」 / 「비움」. **Update**: 칸은 지금 값으로 시작하고 (`formatCellValue` — 구조 값은 JSON), 손대지 않은 칸은 쓰지 않으며 (보존), 지운 칸은 `null` — 셀 편집의 「빈 입력 = `null`」 과 같다. 기본값으로 바꾸지 않고, placeholder 도 「비움」 뿐이다. `boolean` 의 「비움」 도 같은 규칙 (Insert = 기본값, Update = `null`). **필수는 저장할 최종 값으로 판정한다** — Insert 는 기본값을 채운 뒤, Update 는 보존 칸의 현재 값까지 포함해 `null` 이면 그 칸 아래 오류 + 저장이 첫 오류로 포커스. 저장 = `applyDataChange` 한 번 (Insert: `insert_rows` 끝에 한 행 · Update: 바뀐 칸만 `set_cell` 묶음). **Update 는 행 집합이 열 때와 같을 때만 쓴다** (리뷰 H2 — `id` 도 행 객체도 믿지 않는다): 양식은 열 때 `rowIndex` · 그 표의 `mockData` 배열 참조 · 그 배열의 JSON (`snapshot`, ≤ 1,000 행) 을 든다. 저장 직전 `useDataStore.getState()` 의 그 표에서 ① `mockData` 가 같은 참조면 (그 표를 건드린 step 없음) 그 `rowIndex` ② 참조가 다르지만 JSON 이 `snapshot` 과 같으면 (이름 · 설정 · schema 만 바뀜 · 또는 Undo 로 돌아옴) 그 `rowIndex` — 단 이번에 쓰는 fieldId 가 schema 에 남아 있어야 한다 ③ 그 밖 (행 추가 · 삭제 · 편집 · 붙여넣기 · import · 표 삭제) 은 **충돌 — 저장 거절, 입력은 그대로, 「이 표의 행이 양식을 연 뒤 바뀌었다 — 닫고 다시 여세요」 안내 (닫기)**. 다른 표 · 캔버스의 변경은 영향 없다. 대상 판정과 `applyDataChange` 호출 사이에 await 를 두지 않는다 (reducer 가 호출 순간 상태를 읽는다). Insert 의 `at` 도 호출 순간 최신 행 수다 — Undo 한 번. 하단 「계속 추가」 (Create more — 사용자 결정 5) · 취소 · 저장 (Enter · textarea 는 ⌘Enter). 저장 안 한 변경이 있을 때 ✕ · Esc 는 ConfirmDialog. 본문이 680 보다 좁으면 양식이 격자 자리를 대신하고 헤더 ✕ 로 격자로 돌아온다.
2. **기본값은 타입을 지킨다** — 열 편집기의 기본값 입력이 타입별 (행 양식과 같은 입력 부품) 이 되고 값 그대로 저장한다 (`true` 는 boolean). 읽는 쪽 (`addRow` · 행 양식 placeholder · 적용) 은 `resolveFieldDefault(field)` 하나다 (리뷰 H1): 타입이 이미 맞는 값 (`boolean` · 유한 `number` · `array` 의 배열 (빈 배열 포함) · `object` 의 plain object · 글자 타입의 string) 은 **그대로**, 글자 기본값 (`"true"` · `"3"` · 날짜 글자 — `date` · `datetime` 은 늘 정규화) 은 `coerceCellValue`, 그 밖의 값은 `formatCellValue` (구조 값 = `JSON.stringify`) 뒤 `coerceCellValue`. `String()` 은 쓰지 않는다 — `{ "enabled": true }` 가 `[object Object]` (실패), `[1, 2]` 가 `1,2` (실패), `[]` 가 빈 글자 → 성공한 `null` 이 된다. 강제 실패는 「기본값 없음」 으로 읽고 열 편집기가 「기본값이 타입과 맞지 않음」 을 보인다 — 문서 마이그레이션 없음.
3. **열 편집기 절 구조 + 만들기 경로** — 팝오버 (288 px 그대로) 안을 절 넷으로: **이름** (이름 · 라벨) · **타입** (검색 목록 — 항목 = 아이콘 · 이름 · **설명 한 줄** (i18n `datatable.typeHints.*` 11 종, 사용자 결정 3) · 기본값 (타입별)) · **규칙** (필수 · 참조 대상 — 타입이 `reference` 일 때) · **사용처 · 삭제**. `Insert ▾ → Insert column…` 은 머리글 끝 `+` 슬롯에 anchor 한 **같은 팝오버의 만들기 모드** (이름 · 타입 · 기본값 · 필수 · 참조, 「계속 추가」) — `add_field` 한 번. 머리글 `+` 의 인라인 이름 입력 (string · Enter 연속) 은 빠른 길로 그대로 (진입점 양쪽).
4. **선택 행 바** — 행을 고르면 Insert 자리가 `복사 ▾` (CSV · JSON → 클립보드) · `내보내기 ▾` (선택 행 CSV · JSON) · `Delete N rows` 가 된다. 선택이 없을 때의 `Export` 는 전체 CSV 그대로 (JSON 추가).

기각 사유: A — 288 px 팝오버는 열 10 개 양식에 좁고 바깥 클릭 · 가상화로 닫히거나 anchor 를 잃는다 (Update row 가 성립하지 않는다). C — 격자를 가린다. D — 사용자 요청 미충족 · 필수 · 기본값 결함 (현재 §) 이 그대로 남는다.

### 사용자 결정 N건 (execute-adr 가 닿을 때 묻는다)

1. **행 양식 자리** — B 사이드 패널 (권장) vs A 팝오버. 권장 이유: 열 10 개 이상 · 격자를 보며 채움 · Update row anchor 불필요.
2. **Insert row 의 동작** — 양식 열기 (권장 — 빈 채로 저장 = 지금의 빈 행) vs 지금처럼 빈 행 바로 삽입 + 양식은 ↗ 로만.
3. **타입 설명 문안 11 종** (ko · en) — 예 `string` 「글자 — 이름 · 제목 · 설명」 · `number` 「숫자 — 계산 · 정렬에 쓴다」 · `reference` 「다른 표의 행을 가리킨다」. breakdown §3 표 승인.
4. **Update row 진입** — 선택 열의 ↗ (hover · focus) + 셀 `Shift+Enter` (권장) vs 행 더블클릭 (셀 더블클릭 = 편집 진입과 충돌하므로 비권장).
5. **「계속 추가」 (Create more) 노출** — 행 · 열 양식 둘 다 (권장) vs 생략.

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                  | 심각도 | 대응                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 기존 문서의 글자 기본값 (`"true"` · `"3"`) 과 구조 기본값 (`{…}` · `[…]` · `[]`) 이 타입별 입력 · 적용과 어긋난다                                                                                                                                                                     |  MED   | 읽는 쪽 전부 `resolveFieldDefault` 하나 (Decision 2 — 맞는 타입 보존 · 글자는 강제 · 구조 값은 JSON) · unit 표 (object · array · 빈 배열 · 글자 `"true"` · `"3"` · 날짜 글자 · 타입 불일치) · RED 테스트 (Phase 0) · 마이그레이션 코드 없음       |
| R2  | Update 양식이 열린 뒤 다른 곳의 삭제 · 삽입 · 편집 · Undo 로 행 index 가 옮으면 다른 행을 덮어쓴다 — 행에는 `id` 도 객체도 정체성이 없다 (리뷰 H2: `id` 없는 A/B/C 에서 A 삭제 → index 1 = C · 같은 `id` · 같은 값의 B/C 에서 B 삭제 → 유일 `id` 가 C · 투영이 행 객체를 새로 만든다) |  MED   | Decision 1 — 열 때의 `mockData` 참조 · JSON snapshot 과 저장 직전 최신 store 를 비교, 행 집합이 다르면 **충돌 거절** (입력 보존). 같은 동기 구간에서 판정 · 적용. G1 반례 넷 (A 삭제 · 중복 B 삭제 · 표 이름만 변경 → 성공 · 삭제 뒤 Undo → 성공) |
| R3  | 좁은 본문 (< 680) 에서 양식이 격자 자리를 대신하면 사용자가 격자를 잃은 것처럼 보인다                                                                                                                                                                                                 |  LOW   | 헤더 제목 「… 에 행 추가」 + ✕ = 격자 복귀 (ADR-288 좁은 폭 규칙과 같은 어법) · G1 에 459 · 600 폭 케이스                                                                                                                                         |
| R4  | `reference` ComboBox 가 큰 대상 표 (10k 행) 에서 느리다                                                                                                                                                                                                                               |  MED   | 필터 결과 50 개 상한 · 입력 debounce 없음 (useDeferredValue) · G4 에 10k 행 대상 표 측정 (입력 p95 ≤ 16 ms)                                                                                                                                       |
| R5  | Insert row 가 즉시 삽입에서 양식으로 바뀌어 빠른 빈 행 추가가 한 단계 늘어난다                                                                                                                                                                                                        |  LOW   | 사용자 결정 2 · 양식 빈 저장 = 빈 행 · 「계속 추가」                                                                                                                                                                                              |
| R6  | 번들 — RAC `ComboBox` · `Switch` 가 `datatable` chunk 에 처음 들어오면 chunk 는 커진다 (initial 은 아님)                                                                                                                                                                              |  LOW   | G4 initial Δ ≤ +300 B · chunk Δ 는 기록만                                                                                                                                                                                                         |
| R7  | 양식이 열리며 격자 폭이 줄어 `ResizableTableContainer` · Virtualizer 가 열을 다시 잰다                                                                                                                                                                                                |  LOW   | 열림 · 닫힘에 한 번 — G1 live 에서 스크롤 위치 · 포커스 유지 확인                                                                                                                                                                                 |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 실패 시 대안                                   |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| G0   | Phase 0 | RED 4 (`it.fails`): ① 행 양식 없음 (Insert row 가 `insert_rows` 즉시) ② `required` 미적용 (빈 행이 통과) ③ Boolean 기본값 `"true"` 가 셀에 글자로 ④ 선택 행 복사 없음. 인벤토리 — 셀 편집기 타입 분기 · `coerceCellValue` 입력 범위 · 본문 폭 분포 (패널 기본 100 % · 저장 폭) 가 breakdown §1                                                                                                                                                                                                                                                                                                                                                                                                                                             | RED 가 다른 이유로 실패하면 수정 전 수리       |
| G1   | Phase 1 | 행 양식 live (Chrome MCP, 5174): Insert row… → 필수 (`name`) 비우고 저장 → 오류 + 포커스 → 채우고 저장 → `insert_rows` 1 · Undo 1 → Update row (↗ · `Shift+Enter`) 2 칸 수정 → `set_cell` 2 가 한 step (Undo 1) → 「계속 추가」 로 2 행 연속 → Esc (변경 있음) → ConfirmDialog → Update 에서 기본값 있는 칸을 지우고 저장 → `null` (기본값 아님) · 손대지 않은 칸은 `set_cell` 없음 → `id` 없는 표 A/B/C 에서 B 양식을 열고 A 삭제 → 저장 → 충돌 안내 · C 무변경 · 입력 유지 → Undo (A 복귀) → 저장 → B 에 `set_cell` · 같은 `id` · 같은 값의 B/C 에서 B 를 열고 B 삭제 → 충돌 · 양식 열고 표 이름만 바꿈 → 저장 성공 · 양식 열고 다른 표 편집 → 저장 성공 → 본문 600 · 459 폭에서 양식이 격자 자리 · ✕ 복귀. axe critical 0 · 콘솔 오류 0 | 어긋남 수리 뒤 영향 케이스만 재실행            |
| G2   | Phase 2 | 열 편집기 절 넷 · 타입 설명 11 종 · `Insert ▾ → Insert column…` → 팝오버 만들기 모드 (타입 `boolean` · 기본값 켬 · 필수) → `add_field` 1 → 새 행의 그 칸이 `true` (boolean, 글자 아님) · 기존 `"true"` 글자 기본값 열도 새 행에 boolean · `object` 기본값 `{ "enabled": true }` · `array` `[1, 2]` · 빈 배열 `[]` 저장 → 열 편집기 · 행 양식 placeholder 가 JSON 글자 → 새 행 셀이 같은 구조 값 (`null` · 글자 아님) · 머리글 `+` 인라인 길 유지 (`DataGrid.test` 기존 케이스 PASS)                                                                                                                                                                                                                                                        | 수리 뒤 재실행                                 |
| G3   | Phase 3 | 행 2 선택 → `복사 ▾ → CSV` 클립보드 = 머리글 + 2 행 (Papa) · `JSON` = 배열 2 · `내보내기 ▾ → 선택 행 CSV` 파일 2 행 · `Delete 2 rows` 그대로 · 선택 해제 → Insert ▾ 복귀                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 수리 뒤 재실행                                 |
| G4   | Phase 4 | 번들 Builder initial JS gzip Δ ≤ +300 B · Preview Δ 0 (`adr209-bundle-closure.mjs`, 착수 HEAD 대비 — ADR-288 Phase 5 와 같은 방식) · `reference` ComboBox 10k 행 대상 표 입력 p95 ≤ 16 ms (foreground · DPR2 · 측정 조건 기록) · `docs:stale-symbols` 0 · CHANGELOG · 규칙 (`panel-structure.md` 양식 자리 한 항)                                                                                                                                                                                                                                                                                                                                                                                                                          | 초과분을 lazy 분리 · 상한 재승인은 사용자 판단 |
| G5   | 종결    | 사용자 Builder 확인 (5173) — 행 양식 · 열 만들기 · 선택 바. 사용자 결정 1 ~ 5 기록                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 요청 반영 뒤 재확인                            |

### Live Exercise

(Implemented 승격 시 기재 — G1 · G2 · G3 의 Chrome MCP 결과와 G5 사용자 confirm.)

## Consequences

### Positive

- 「행 하나 넣기」 가 한 화면 — 필수 · 기본값이 처음으로 사용자에게 보이고 작동한다 (현재는 저장만 되는 필드).
- 기본값의 타입 결함 (글자 저장) 이 저장 · 적용 양쪽에서 닫힌다 — 마이그레이션 없이.
- 열 만들기가 한 번에 (타입 · 기본값 · 필수 · 참조) — 빠른 길 (`+` 인라인) 은 그대로.
- 선택 행 동작이 레퍼런스와 같은 세 가지 (복사 · 내보내기 · 삭제).
- 코드는 전부 `datatable` lazy chunk — initial 번들 불변.

### Negative

- 격자 본문이 양식과 폭을 나눈다 (360 px) — 좁은 본문에서는 번갈아 보기.
- RAC `ComboBox` · `Switch` 가 격자 chunk 에 추가된다 (chunk 크기 ↑, initial 아님).
- 타입 설명 11 종 · 양식 문구 ~25 개 i18n (ko · en) 유지 비용.
- Supabase 의 Description · unique · CHECK · sensitive 는 들어오지 않는다 — 스키마 변경이 필요한 별도 결정.
