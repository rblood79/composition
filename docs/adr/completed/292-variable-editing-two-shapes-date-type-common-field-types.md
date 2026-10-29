# ADR-292: 변수 편집 두 모양 · `date` 타입 · 표 열 타입을 변수와 같은 공통 타입으로

## Status

Implemented — 2026-10-29 (코드 main `1a6af386e`, 같은 날 사용자 지시로 구현 뒤 문서화)

- 사용자 요청: `/create-adr` (2026-10-29) — 「date 문제로 create adr 할필요 없는건가?」 뒤 요청.
- 방향을 정한 사용자 원문 (2026-10-29, 순서대로):
  - 「tables, apis 와는 다르게 variables 는 left-list 구조가 아니다」 → 선택 「변수 묶음 목록」.
  - 「변수도 data table 로 관리해도 되지않나?」 → 「격자 모양으로 맞추는 방향으로 진행해」 · (div 구조 제안에) 「아니다 그렇다면」 (`table` 유지).
  - 「type 은 선택은 셀선택이지만 팝업이나오고 셀선택이 변경된다」 · 「행의 마지막은 삭제 외에는 추가할기능이 없다면 삭제 버튼으로」 · 「delete 버튼의 회색 배경등은 제거 되어야한다. 추가로 design패널의 page variables와 스타일이 구분되어야한다」.
  - 「design패널-프러퍼티탭 - state section 부분 수정이다 - data패널의 variables와 다르게 delete 버튼 부분은 table 밖 으로 나와야 한다 grid 7column 구조에 마지막 우측영역에 추가기능 버튼 영역이라」 → 「잘못들어 갔다, id, route 확인해」 → 「table 구조는 맞지 않는듯하다」 → **「내용은 동일하지만 Data패널의 Variables탭은 현재 테이블 스타일 그대로, Design 패널 State 절은 변수마다 패널행」**.
  - 「number, string, object, array 등을 select 다운버튼 스타일로 아이콘으로 하자」 · 「해당필드셋의 grid-template-columns: 4fr 2fr 1fr」 → 「4fr 2fr var(--control-size) 로 변경」.
  - 「bool 일경우 true, false 선택 하도록」 · 「data 패널에도 동일하게」.
  - 「type 중에 array, object 가 의미있나? json 으로 통합할수있지않나」 → **「화면에서만 「JSON」 하나로 보여 주고, 목록 여부는 저장할 때 값으로 정하기, supabase 에서도 별도의 list 같은것은없다」**.
  - 「오히려 int, numeric, date, time 인데 현재 number 는 이제 잘쓰지않는것인가?」 · 「string 도 text나 varchar 로 변경해야하나」 → (답: JS 값 형은 하나) → 「그렇다면 지금 4개 type에 date 하나만 더추가하면 될까」 → 「@react-aria/ 나 react-aria/useDateFormatter 라이브러리에는 없나?」 → **「date 타입 추가해」** · 「date 편집일때 캘린오픈 하면되지않나?」.
  - 「json 편집 popover창 table 의 편집 popover창 같이 쓰면 되지않나」 · **「design패널 state section 에도 적용해야지」** (ADR-288 contract 51 을 넓히는 결정).
  - 「table 의 type도 variable 과 맞춰야 하지않나」 → 「같이 공통적으로 사용하면되지않나」 → (reference 설명 뒤) **「reference 는 표 전용으로 남기고 공통 타입으로 맞춰」** · 「type 선택하는 popover 창 자체가 다른데」.
  - **「기존 문서 마이그레이션 필요없다」** (옛 타입 열 처리).
- 사용자가 이미 답한 확인 항목 — 위 원문이 곧 답이다. 이 ADR 안에 남은 사용자 결정은 없다.

### Live Exercise

2026-10-29, dev 5174 (별도 서버 — 사용자 5173 은 건드리지 않음), Chrome MCP. 확인마다 임시 변수 · 표를 만들어 보고 지웠고 (`dateCheck` · `jsonCheck` · 실수로 생긴 「New Table」 삭제), 콘솔 오류 0.

| 시나리오                                                                                                                                                                            | 결과 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
| Data 패널 Variables: 목록 열 (Project variables · 페이지 묶음) → 본문 격자 · 이름 칸 더블클릭 편집 · Enter 저장 · Esc 취소 · 글자 키 시작                                           | PASS |
| 타입 칸: 클릭은 포커스만, Enter · 더블클릭 → 셀에 붙은 목록 (String · Number · Boolean · Date · JSON + 안내) · 고르면 저장 · 포커스 셀 복귀                                         | PASS |
| boolean 시작값: 격자 셀 더블클릭 → true · false 목록 → 저장 · 포커스 복귀; State 절 → 패널 Select                                                                                   | PASS |
| date 시작값: 격자 셀 Enter → 브라우저 날짜 선택기가 열림 (캡처) · 닫히며 `2026-10-29` 저장; `2026-13-45` → 「Not a valid date」 · `2026-10-29T10:30` → 저장                         | PASS |
| JSON 시작값: 격자 셀 Enter → 격자 팝오버 편집기 (제목 · JSON · ⏎ 저장 · Esc) · `{"a": [1, 2]}` 저장 · 포커스 복귀; `[1,2]` 저장 뒤 저장 타입 array (placeholder `[]`)               | PASS |
| 삭제 버튼 · ↗: 투명 `ActionIconButton` 28 · 셀 안 (bg `rgba(0,0,0,0)` · border 0)                                                                                                   | PASS |
| Design 패널 State 절: 변수 행 = `.fieldset-row` (`112 · 56 · 28`, ⋮ 칸 1834–1862 = ID · Route 행의 액션 칸과 같은 자리) · 이름 상자 끝 타입 아이콘 (▾ 상자 20) · 목록 아이콘 + 이름 | PASS |
| State 절 JSON: 요소 변수를 JSON 으로 → 시작값 칸이 JSON 칸 → 누르면 「Edit state2 JSON」 편집기 (사용자 탭에서 그 변수에 `{"lat":…}` 저장됨)                                        | PASS |
| 열 편집기 (Tables): 타입 목록 6 (String · Number · Boolean · Date · JSON · Reference, 한 줄 안내) · String 열의 Format 목록 (Text · Email · URL · Image)                            | PASS |
| 옛 타입 열 (`email`) 이 있는 기존 문서: 머리글 String 아이콘 · 타입 칸 「—」 · 오류 없음 (사용자 결정 「마이그레이션 필요없다」)                                                    | PASS |

정적: type-check PASS · shared 1,904 · builder catalogRuntime · panels · components · 코드 보기 3,993 · 데이터 · 변수 · AI · i18n 480 PASS (`chromeIsland.static` 1 건은 이 세션 전부터 실패).

## Context

### 도메인

빌더 크롬 UI (패널 표준 ADR-163 · 데이터 패널 ADR-288 · 289) 와 문서 스키마 (ADR-248 · 286). D1 · D2 · D3 어느 것도 아니다 — 사용자 캔버스 컴포넌트의 RAC DOM · S2 prop · 시각 값을 건드리지 않는다. 날짜 값의 판정 · 변환은 RAC 가 쓰는 `@internationalized/date` (설치본 3.12.4, shared 가 이미 의존) 를 그대로 쓴다.

### 현재 (실측 2026-10-29, ADR-288 Implemented 직후 main `c8dedfdd5`)

- **변수 표 하나가 두 자리에 같은 모양**: `components/variables/VariableTable.tsx` (RAC Table) 를 Data 패널 Variables 탭과 Design 패널 State 절이 같은 패널 필드 모양 (회색 입력 상자 · 칸 안 Select · ⋮) 으로 그렸다. Data 패널의 표는 옆의 데이터 격자 (`grid/DataGrid`) 와 모양 · 조작이 달랐고, State 절의 표는 같은 패널의 ID · Route 행 (`.fieldset-row` 84 · 84 · 28, ADR-163 · 패널 격자 7칸) 과 달랐다.
- **Variables 탭은 목록 열이 없다**: Tables · APIs 는 왼쪽 목록 + 본문인데 Variables 는 본문 하나였다.
- **변수 타입 5 · 표 열 타입 11**: 변수 `string · number · boolean · object · array` (`VARIABLE_DEF_TYPES`), 표 열 `string · number · boolean · date · datetime · email · url · image · array · object · reference` (`DataFieldType`). 같은 값을 두 목록이 다른 이름 · 다른 목록 모양으로 보였다. 날짜 변수는 없어 RAC 날짜 상태 (`DateValue` — Calendar `focusedValue`) 를 변수로 이름 붙일 수 없었다 (`implicitState.ts:29` 「변수 타입으로 정규화되지 않는 값 … 제외」).
- **구조 시작값 계약 (ADR-288 contract 51)**: 페이지 · 요소 변수의 `object` · `array` 시작값은 `""` 만 (`validation.ts` `DEFAULT_VALUE_TYPE`), JSON 시작값은 프로젝트 변수만 — ADR-288 은 이를 Hard 로 두고 「세 소유자에 JSON 을 열려면 … 별도 결정」 이라 적었다.
- **JSON 편집기 둘**: 데이터 격자의 셀 팝오버 편집기 (`DataGrid.components.tsx` `PopoverCellEditor` — 제목 · 안내 · ⏎ 저장 · Esc) 와 변수 표의 자체 팝업 (textarea, blur 저장) 이 따로 있었고, 후자는 바깥을 눌러 닫으면 입력이 사라졌다 (입력칸이 React commit 안에서 지워져 blur 가 버려짐 — `bfd3804ac` 의 탭 전환 결함과 같은 원인).

### 레퍼런스

- Figma Variables: 묶음 (collection) 목록 + 표. Supabase Table Editor: 열 타입은 Postgres 형이고 list 형은 따로 없다 (배열 · 객체는 `jsonb`), 이메일 · URL 은 `text`.
- RAC 날짜: `@internationalized/date` 의 `parseDate` · `parseDateTime` · `parseTime` · `parseZonedDateTime` · `parseAbsolute` 와 각 값의 `toString()` 이 같은 ISO 모양을 주고받는다. Supabase JS 응답의 `date` · `timestamp` · `time` 열도 같은 ISO 글자다.

### 사용자와 제약

- 사용자 (비개발자 · 기능 단위): 「같은 변수를 두 자리에서 편집」 이 자리마다 다른 모양이면 다른 기능으로 읽힌다. 반대로 두 자리의 **둘러싼 화면** 이 다르다 — Data 패널은 격자 옆, Design 패널은 필드 행 사이.
- **Hard — 마이그레이션 코드 금지** (개발 단계 규칙 · 사용자 「기존 문서 마이그레이션 필요없다」): 옛 타입 이름으로 저장된 열 · 변수는 그대로 두고, 읽을 때 바꿔 주는 처리도 넣지 않는다. 새 코드가 모르는 타입은 String 으로 읽힌다.
- **Hard — 패널 격자**: Design 패널의 행은 7칸 격자 (`--inspector-row-columns`, 액션 칸 = `--control-size` 28, 사용자 결정 2026-10-28). 행 안에 표를 넣거나 액션 칸을 필드 안으로 들이면 위반.
- **Hard — 쓰기 경로 무변경** (ADR-288): 편집은 `applyDataChange` (프로젝트 변수 · 표) 와 `catalogVariableCommands` (페이지 · 요소 변수) → `workspace.execute` 한 step.
- **Hard — 값 형은 JS 하나**: 변수 값은 JS 런타임 · 문서 JSON 에 산다. `int` · `numeric` · `text` · `varchar` 같은 DB 열 구분을 변수 타입에 두지 않는다 (값이 같으면 타입도 하나).
- **Hard — 격자 부품 재사용 금지** (ADR-288 R2): 변수 표가 `DataGrid` 자체를 쓰지 않는다 — 칸 편집기가 행 타입을 따르고 저장이 변수 명령이다. 모양 · 조작만 맞춘다.
- **Soft — 번들**: `datatable` 패널은 lazy · State 절의 변수 표는 lazy (ADR-288 G5). 날짜 라이브러리는 이미 shared 의존이라 새 chunk 없음.

## Alternatives Considered

### 대안 A: 변수 표 한 모양 유지 · 타입 목록 둘 유지 (현 상태)

- 설명: `VariableTable` 의 패널 필드 모양을 두 자리에 두고, 변수 타입 5 · 표 열 타입 11 을 따로 둔다. 결함 (JSON 팝업 바깥 클릭) 만 고친다.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 같은 값의 타입 목록 둘 · 편집기 둘이 각자 변한다; 날짜 변수 없음이 RAC 날짜 상태를 막는다) / 마이그레이션(L)

### 대안 B: 한 부품 두 모양 + 공통 타입 (채택)

- 설명: `VariableTable` 하나가 두 모양을 그린다 — Data 패널은 데이터 격자 모양 · 조작 (`data-look="grid"`: 28 px 칸 · 셀 포커스 · Enter · F2 · 글자 키 · 더블클릭 편집 · 셀에 붙은 목록 · 격자 팝오버 편집기), Design 패널 State 절은 변수마다 패널 행 (`.fieldset-row` `4fr 2fr var(--control-size)` = [이름 + 타입 아이콘][시작값][⋮ · ↗]). 변수 · 표 열의 타입을 한 목록으로: `string · number · boolean · date · JSON(object/array)` + 표만 `reference`. `date` = ISO 글자 (모양이 정밀도 — 날짜 · 날짜+시각 · 시각 · 시간대), 판정은 `@internationalized/date`. 이메일 · URL · 이미지는 `string` 의 `format`. 페이지 · 요소 변수도 JSON 시작값을 가진다 (contract 51 을 「`""` 또는 그 타입의 JSON 값」 으로). 세 타입 목록이 열 편집기의 목록 (이름 + 한 줄 안내) 하나.
- 위험: 기술(M — 문서 스키마 3 곳 변경: `valueType` 에 `date`, `StateVariableEntry.defaultValue` 에 JSON, `DataField.format`) / 성능(L) / 유지보수(L — 타입 정본 `FIELD_TYPES` 하나, 편집기 `PopoverTextEditor` 하나, 날짜 `dateValue.ts` 하나) / 마이그레이션(**M** — 옛 타입 열은 String 으로 읽히고 사용자가 다시 고른다; 마이그레이션 코드 없음은 사용자 결정)

### 대안 C: 변수 표가 격자 부품 (`DataGrid` · Virtualizer div) 을 그대로 쓴다

- 설명: Data 패널의 변수를 `DataGrid` 행으로 그린다 (사용자 첫 제안 「변수도 data table 로」 · 「div tag 방식」).
- 위험: 기술(**H** — 격자의 칸 편집기는 열 타입 하나 · 저장은 행 patch 인데 변수는 행마다 타입이 다르고 저장이 변수 명령; ADR-288 R2 가 기각한 결합) / 성능(L) / 유지보수(**H** — 격자의 선택 · 붙여넣기 · 가상화가 변수에 의미 없이 따라온다) / 마이그레이션(L)
- 사용자 원문: 「아니다 그렇다면」 (table 유지).

### 대안 D: 타입 이름만 바꾸기 (`array` → `list`, `object` → `json`) · 표 열 타입은 그대로

- 설명: 저장 값 `object` · `array` 를 `list` · `json` 으로 개명해 뜻을 드러내고, 표 열의 11 종은 그대로 둔다.
- 위험: 기술(M — 저장 값 개명은 문서 전체의 `valueType` 을 바꾼다, 마이그레이션 없이는 기존 문서가 깨진다) / 성능(L) / 유지보수(M — 변수 · 표 열의 목록 둘 유지) / 마이그레이션(**H**)
- 사용자 원문: 「화면에서만 「JSON」 하나로 보여 주고, 목록 여부는 저장할 때 값으로 정하기」.

### 대안 E: 날짜를 `date` · `datetime` · `time` 세 타입으로 (표 열의 `datetime` 유지)

- 설명: 정밀도마다 타입 하나.
- 위험: 기술(L) / 성능(L) / 유지보수(M — 같은 ISO 글자 · 같은 파서인데 목록 셋, 변수와 표 열이 또 갈린다; RAC `DateValue` 는 값 하나가 셋을 모두 담는다) / 마이그레이션(L)
- 사용자 원문: 「지금 4개 type에 date 하나만 더추가하면 될까」 → 하나.

### Risk Threshold Check

| 대안 | HIGH+ 축            | 판정                                                 |
| ---- | ------------------- | ---------------------------------------------------- |
| A    | 유지보수 H          | 둘로 갈린 목록 · 편집기가 계속 갈린다 — 기각         |
| B    | 없음 (M 2)          | 채택 — 잔존 M 은 Risks 에                            |
| C    | 기술 H · 유지보수 H | ADR-288 R2 와 같은 결합 — 기각 (사용자 「아니다」)   |
| D    | 마이그레이션 H      | 저장 값 개명 — 기각 (사용자 「화면에서만」)          |
| E    | 없음 (M 1)          | B 의 `date` 하나가 같은 값을 더 적은 목록으로 — 기각 |

루프 불필요 — 채택 대안 B 에 HIGH 없음.

## Decision

대안 B. 결정 9 (전부 사용자 원문에 닿는다):

1. **Variables 탭은 목록 열 + 본문** (「변수 묶음 목록」) — 목록은 묶음 (Project variables · 변수가 있는 페이지), 본문은 고른 묶음의 표. 페이지 묶음은 읽기 전용 색인 (행 = 소유자로 이동 ↗).
2. **Data 패널 변수 표 = 격자 모양 · 조작**: 28 px 머리글 · 칸 테두리 · 셀 포커스 링 (클릭 = 포커스만), Enter · F2 · 글자 키 · 더블클릭 = 편집, Enter 저장 (셀 복귀) · Esc 취소 · 칸을 벗어나거나 편집 중 사라지면 저장. 타입 · boolean · JSON 칸은 셀에 붙은 목록 · 격자 팝오버 편집기. 행 끝은 삭제만 있으니 ⋮ 대신 투명 삭제 버튼 (`ActionIconButton`). 격자 부품 재사용은 하지 않는다 (ADR-288 R2).
3. **Design 패널 State 절 = 변수마다 패널 행** (「내용은 동일하지만 … 변수마다 패널행」): `.fieldset-row` `4fr 2fr var(--control-size)` (212 에서 112 · 56 · 28) = [이름 입력 + 타입 아이콘 (패널 Select 의 ▾ 상자 안)][시작값][⋮ (사용처 · 삭제) / ↗]. State 묶음 fieldset 은 7칸 전체 (필드 하나 폭 176 상한을 푼다 — 그 상한이 액션 칸을 필드 안으로 밀었다).
4. **boolean 시작값은 true · false 선택** (격자는 셀에 붙은 목록, State 절은 패널 Select) — 스위치 아님.
5. **변수 타입에 `date`**: 값은 ISO 글자 하나 (`2026-10-29` · `2026-10-29T10:30` · `10:30` · `…Z` · `…[Asia/Seoul]`), 빈 값 `""`. 판정 · 변환은 `@internationalized/date` (shared `state/dateValue.ts` — `parseDateValue` · `isDateValueText` · `dateValueToText` · `nativeDateInputOf` · `coerceDateText`). 편집은 브라우저 날짜 선택기 (값 모양에 따라 `date` · `datetime-local` · `time`; 격자는 Enter · F2 · 더블클릭에 바로 열림, 글자 키는 ISO 글자 직접 입력). 타입 변경 때 날짜 글자는 남고 아니면 비운다. 런타임은 `Date` · RAC 날짜 값을 글자로 받는다. Calendar `focusedValue` 를 변수로 이름 붙인다. 「변수로 정하기」 비교는 날짜 비교. 코드 보기는 `useState<DateValue | null>(parseDate('…'))` (시각은 `Time`, 빈 값 `null`) 로 쓰고 그대로 읽는다. `int` · `numeric` · `text` · `varchar` 는 두지 않는다 (JS 값 형은 하나).
6. **`object` · `array` 는 화면에서 JSON 하나**: JSON 을 고르면 `object` 로 저장, 저장한 값이 배열이면 `array` 로 같은 step 에 바뀐다 (프로젝트 변수 `onJsonDefault`, 페이지 · 요소 `setJsonDefault`). 만들기 양식도 JSON 하나.
7. **페이지 · 요소 변수도 JSON 시작값** (「design패널 state section 에도 적용」) — ADR-288 contract 51 「`""` 만」 → 「`""` 또는 그 타입의 JSON 값」: `StateVariableEntry.defaultValue` 에 `StructuredDefault`, 검증은 모양 (object ↔ array) 이 다를 때만 `DEFAULT_VALUE_TYPE`, 타입 변경 규칙은 맞는 JSON 값을 남김, 코드 보기 `useState({…})` · `useState([…])`.
8. **JSON 편집기는 격자의 셀 팝오버 편집기 하나** (`grid/PopoverTextEditor.tsx` 로 분리 — 제목 · 안내 · ⏎ 저장 · ⇧⏎ 줄바꿈 · Esc · 바깥 누름 = 취소 · Cancel · Save; 커서는 값 끝). `DataGrid` 와 변수 표 (격자 셀 · State 행의 JSON 칸) 가 같이 쓴다. 바깥 클릭 = 취소는 격자의 규칙을 따른다 (전 팝업의 「입력이 사라짐」 결함은 같은 편집기로 사라졌다 — 저장은 ⏎ · Save).
9. **표 열 타입 = 변수와 같은 공통 타입 + `reference`** (「reference 는 표 전용으로 남기고 공통 타입으로 맞춰」): `string · number · boolean · date · JSON · reference` (11 → 6). `datetime` → `date` (셀도 값 모양의 선택기, 느슨한 글자 `Sep 12 2026` 은 날짜로), 이메일 · URL · 이미지 → `string` 의 **`format`** (`DataField.format` · `CatalogDataField.format` · `update_field.patch.format`; 열 편집기 Type 절의 「Format: Text · Email · URL · Image」 — 입력 키보드 · 이미지 미리보기 · 머리글 아이콘만 다르다). 가져오기 추론 · 프리셋 · AI 표 생성 (`format` · 날짜 규칙 `withTime`) · 비교 연산이 같은 타입을 쓴다. **타입을 고르는 목록도 하나**: 열 편집기 · 변수 격자 · State 절이 `FIELD_TYPES` 에서 같은 이름 · 한 줄 안내 · 순서 (변수는 Reference 제외). `reference` 는 「다른 표의 행을 가리키는 열」 로 변수에 대응이 없어 표 전용.

**기존 문서**: 옛 타입 (`datetime` · `email` · `url` · `image`) 으로 저장된 열은 그대로 두고 읽을 때도 바꾸지 않는다 (사용자 「기존 문서 마이그레이션 필요없다」). 그런 열은 String 으로 읽히고 (머리글 String 아이콘 · 타입 칸 「—」), 열 편집기에서 다시 고르면 새 타입이 된다.

기각 사유: A — 목록 · 편집기 둘이 계속 갈린다. C — 격자의 열 타입 · 행 patch 결합 (ADR-288 R2). D — 저장 값 개명은 마이그레이션 없이 기존 문서를 깬다. E — RAC `DateValue` 하나가 담는 값을 타입 셋으로 가른다.

> 구현 상세: [292-variable-editing-two-shapes-date-type-common-field-types-breakdown.md](../design/292-variable-editing-two-shapes-date-type-common-field-types-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                             | 심각도 | 대응                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 옛 타입 열이 있는 기존 문서 — `email` 열은 String 으로 읽혀 이메일 키보드 · 미리보기가 없고, `datetime` 열은 셀 편집이 글자가 된다               |  MED   | 사용자 결정 「마이그레이션 필요없다」 — 열 편집기에서 다시 고르면 새 타입. `resolveFieldType` 은 모르는 타입을 String 아이콘으로 (오류 없음, live 확인) |
| R2  | ADR-288 의 Hard 「contract 51 유지」 와 어긋난다 — 그 문서만 읽으면 페이지 · 요소 JSON 시작값이 금지로 보인다                                    |  MED   | ADR-288 본문 해당 줄에 「ADR-292 에서 넓힘」 표기 · 이 ADR 결정 7                                                                                       |
| R3  | JSON 편집기의 바깥 누름 = 취소 (격자 규칙) — 입력 뒤 바깥을 누르면 사라진다                                                                      |  LOW   | 편집기 안의 키 안내 (⏎ 저장 · esc 취소) · Cancel · Save 버튼이 보인다. 격자와 같은 규칙이라 한 곳만 다르게 두지 않는다                                  |
| R4  | 변수의 타입 목록이 표 열 정본 (`FIELD_TYPES`, 데이터 패널 chunk) 에 의존한다 — State 절 (Design 패널) 이 그 모듈을 끌어온다                      |  LOW   | `fieldTypes.ts` 는 아이콘 · i18n 키만 (격자 없음) · State 절의 변수 표는 이미 lazy (ADR-288 G5)                                                         |
| R5  | `date` 의 시간대 instant (`…Z` · `[tz]`) 를 브라우저 선택기로 고치면 현지 시각의 `datetime-local` 로 저장돼 시간대가 사라진다                    |  LOW   | 글자 키로 ISO 글자를 직접 쓰면 유지. 시간대가 필요한 쓰임이 나오면 선택기 종류를 값에 더해 정한다                                                       |
| R6  | 두 세션이 같은 파일 (`types.ts` · `validation.ts`) 을 고치던 중 커밋 — 다른 세션의 `formula` 줄은 커밋에서 뺐다 (`git update-index --cacheinfo`) |  LOW   | 커밋 `1a6af386e` 에 그 줄 없음 확인 (`git diff --cached …                                                                                               | grep -c formula` = 0) |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — 집행은 정적 게이트와 live 로 끝냈다 (위 Live Exercise).

| Gate | 시점    | 통과 조건                                                                                                            | 결과                                                 |
| ---- | ------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| G1   | 커밋 전 | type-check PASS · shared · builder 관련 스위트 PASS (타입 5 → 6 · 열 타입 11 → 6 · contract 51 테스트를 새 계약으로) | PASS 2026-10-29 (shared 1,904 · builder 3,993 + 480) |
| G2   | 커밋 전 | live: 두 모양 · date 선택기 · JSON 편집기 · 공통 타입 목록 · Format · 옛 타입 열 무오류 (5174 · Chrome MCP)          | PASS 2026-10-29 (Live Exercise 표)                   |
| G3   | 커밋 전 | 다른 세션의 dirty 변경을 커밋에 섞지 않는다 (pathspec · 공유 파일은 제 hunk 만)                                      | PASS — 72 파일, `formula` 0                          |

## Consequences

### Positive

- 같은 변수가 두 자리에서 같은 내용 · 같은 타입 목록 · 같은 편집기로 보이고, 각 자리의 둘러싼 화면 (격자 · 패널 행) 과 맞는다.
- 변수와 표 열의 타입이 하나의 정본 (`FIELD_TYPES` · `DATA_VALUE_FIELD_TYPES` ⊂ `VARIABLE_DEF_TYPES` + `reference`) — 목록 · 이름 · 안내 · 순서가 따로 놀 수 없다.
- `date` 변수로 RAC 날짜 상태를 변수로 이름 붙이고 날짜 비교 · 코드 보기 왕복이 된다. 날짜 코드는 `@internationalized/date` 호출뿐.
- JSON 편집기 하나 (`PopoverTextEditor`) — 전 팝업의 「바깥 클릭에 입력 사라짐」 결함 소멸.

### Negative

- ADR-288 Hard (contract 51 · 문서 스키마 무변경) 를 넓혔다 — 문서 스키마 3 곳 변경 (`valueType` `date` · `StructuredDefault` · `format`).
- 옛 타입 열은 사용자가 다시 골라야 새 타입이 된다 (마이그레이션 없음 — 사용자 결정).
- 세 표면 (격자 · 변수 표 · State 절) 이 한 타입 정본을 공유하므로 정본 변경이 세 곳에 동시에 닿는다 (의도한 결합).
