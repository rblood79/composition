# ADR-309 breakdown — 날짜 · 시각 값을 문서가 저장한다

> 본문: [ADR-309](../completed/309-date-value-authoring.md). 이 문서는 구현 순서 · 파일 · 검증을 담는다. 줄 번호는 main `4b6c75cde` 기준이고 Phase 0 에서 다시 잰다.

## 1. 범위

- 대상 6 type: DateField · TimeField · DatePicker · DateRangePicker · Calendar · RangeCalendar.
- 넣는 것: 문서의 `value` (와 숨긴 `defaultValue`) · 읽는 함수 하나 · Canvas 값 그리기 (입력 글자 · 선택 칸 · 보이는 달) · 패널 날짜 칸 (Value · Min · Max · Placeholder) · Code 보기 왕복 · 규칙 인자 입력.
- 넣지 않는 것: `focusedValue` 칸 (확정 전제 ①) · `isDateUnavailable` (함수 prop) · 상대 날짜 (사용자 결정 3 의 권고) · 문서 변환 코드 · 계약 번호 변경 · 새 rule 값 · 생성 CSS 변경.
- fork 4 질문: 해당 없음 — 기존 ADR 을 나누거나 잔여를 떼어낸 것이 아니다 (본문 Status).

## 2. type × 값 속성 × 값 형 (G0 에서 설치 타입으로 확정)

| type            | S2 값 속성                                                                   | 문서 `value`                                  | 값 형           | 패널 칸              |
| --------------- | ---------------------------------------------------------------------------- | --------------------------------------------- | --------------- | -------------------- |
| DateField       | `value` · `defaultValue` (`DateValue`)                                       | 날짜 · 날짜+시각 · 시간대 포함 ISO            | `string`        | `date`               |
| DatePicker      | 같음                                                                         | 같음                                          | `string`        | `date`               |
| TimeField       | `value` · `defaultValue` (`TimeValue`)                                       | 시각 ISO (`10:00` · `10:00:30`)               | `string`        | `time`               |
| DateRangePicker | `value` · `defaultValue` (`RangeValue<DateValue>`)                           | `{start, end}` (각각 날짜 ISO)                | `dateRange`     | `date-range`         |
| RangeCalendar   | 같음 + `focusedValue` · `defaultFocusedValue`                                | `{start, end}`                                | `dateRange`     | `date-range`         |
| Calendar        | `value` · `defaultValue` (단일 = 날짜, 다중 = 날짜 목록) + `focusedValue` 쌍 | 날짜 ISO, `selectionMode: multiple` 이면 목록 | `calendarValue` | `date` / `date-list` |

- Min · Max · Placeholder value: 값 형 `string` 유지, 칸만 `date` (TimeField 는 `time`).
- 읽지 못하는 글자 = 빈 값 (지금 DOM 과 같음). `dateRange` 는 `start` · `end` 가 둘 다 읽혀야 값.
- 시작 값 = 문서에 `value` 키가 있으면 그것, 없으면 `defaultValue` (6종 공통). 실행 중 override 는 키가 있으면 (명시 `null` · 빈 목록 포함) 시작 값보다 먼저다.
- Calendar 는 읽을 때 `selectionMode` 에 맞춘다 — 단일 모드의 목록 = 첫 날짜, 다중 모드의 날짜 하나 = 원소 하나인 목록, 읽지 못한 원소는 뺀다. 저장 값은 모드를 바꿔도 고치지 않는다.

## 3. Phase

### Phase 0 — 인벤토리 · 기준선 (동작 변화 0)

- 설치 `@react-spectrum/s2` · `react-aria-components` 타입에서 §2 표를 뽑아 대조 (`d2S2Alignment.static.test.ts` 와 같은 program).
- **읽는 함수 대조표 (R4)**: 입력 집합 (날짜 · 날짜+시각 · 초 · 소수초 · `Z` · offset · `[zone]` · 시각만 · 빈 글자 · 잘못된 글자 · 앞뒤 공백) 을 `safeParseDateString` · DOM `timeValue` · `catalogParseCalendarDay` · `parseDateValue` 에 넣고 결과 차이를 표로. 차이마다 「유지」 · 「변경 (사유)」 를 정한다.
- **granularity 예외 재현 (R3)**: RAC DateField · DatePicker 에 granularity 5 (`day` · `hour` · `minute` · `second` · 미지정) × 값 갈래 4 를 넣어 예외가 나는 조합을 기록 (jsdom 렌더 probe).
- Code 보기 현행: TextField · NumberField 의 `value` 가 어떤 속성 이름 (`value` / `defaultValue`) 으로 나오는지, 변수 날짜 기본값 표기 (`generate.ts:260-263`).
- **실행 값 경계 (R8 · R9)**: override 가 노드 props 에 합쳐지는 자리와 명시 `null` 이 남는지 (`runtime/runtimeStateProps.ts:25-27` · `runtime/domBinding.runtime.ts:3879-3883`), 6종 규칙 `clear` 가 쓰는 값, Calendar `onChange` 가 다중 모드에서 주는 값의 모양.
- **리뷰 round 1 반례 4건** (picker 2종의 보이는 달 · 5종 `defaultValue` 전달 · Calendar 다중 렌더 예외 · 다중 선택 뒤 저장 표기 — `.agent/runs/2026-11-12-review-adr309/`, 로컬 전용) 을 Phase 1 · 2 테스트의 RED 로 옮긴다.
- 번들 기준선: `vite build` → `adr209-bundle-closure.mjs` (ADR-308 G0-6 과 같은 절차).
- 산출: §6 기록. G0.

### Phase 1 — 값 형 · 읽는 함수 하나 · DOM 경계 · binding (기존 문서 동작 변화 0)

| 파일                                                                                                 | 변경                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog/types.ts` `InspectorFieldKind`                                                              | `date` · `time` · `date-range` · `date-list`                                                                                                                                                                                                                                                                                         |
| `document/types.ts` `ValueType` · `document/valueType.ts` · `document/validation.ts`                 | `dateRange` · `calendarValue` + 맞는지 검사 (`catalogDateRangeFits` …)                                                                                                                                                                                                                                                               |
| `document/ruleDefinition.ts` `PROP_KIND_VALUE_TYPE`                                                  | `date` · `time` → `string`, `date-range` → `dateRange`, Calendar `value` → `calendarValue`                                                                                                                                                                                                                                           |
| 새 `catalog/runtime/dateValueRead.ts`                                                                | `catalogDateValue(text, granularity)` · `catalogTimeValue` · `catalogDateRange` — `parseDateValue` 위의 한 함수 (granularity 맞추기 포함) · `catalogDateStartValue(props)` (시작 값 고르기) · `catalogCalendarValue(value, selectionMode)` · `catalogCalendarOverride(next, selectionMode)` (Calendar 양방향 — ISO 목록 ↔ 날짜 목록) |
| `runtime/delegatedDom.runtime.ts` (`dateValue` · `timeValue` · `dateRangeValue` · `placeholderDate`) | 위 함수로 교체 · 6종 모두 시작 값 고르기를 거친다 (5종의 `props.value` 직접 읽기 삭제) · Calendar 의 값 · `onChange` · `focusedDateProps` 가 모드별 변환을 쓴다 (focus = 첫 날짜)                                                                                                                                                    |
| `runtime/calendarModel.ts` `catalogParseCalendarDay`                                                 | 위 함수로 교체                                                                                                                                                                                                                                                                                                                       |
| `runtime/delegatedDom.runtime.ts` `catalogStateSourceValue` (`value` 가지)                           | 날짜 6종은 시작 값 고르기 결과를 돌려준다 — render 와 dispatcher 가 같은 값에서 시작. 실행 중 override 는 지금처럼 키 유무 (`runtimeStateProps.ts`)                                                                                                                                                                                  |
| `bindings/{DateField,TimeField,DatePicker,DateRangePicker,Calendar,RangeCalendar}.binding.ts`        | `value` (Value 구획 · 이 Phase 에서는 `editorHidden`) · `defaultValue` (`editorHidden`)                                                                                                                                                                                                                                              |
| `document/d2Provenance.ts`                                                                           | 필요 없음 예상 (S2 가 선언하는 키) — 게이트가 판정                                                                                                                                                                                                                                                                                   |
| `apps/builder/src/services/ai/compiler/manifest.ts`                                                  | 새 칸 종류 4                                                                                                                                                                                                                                                                                                                         |

- 테스트: 대조표의 「유지」 입력 전부에서 DOM 이 RAC 에 넘기는 값이 전과 같다 (G1 b) · granularity × 값 갈래 행렬 렌더 오류 0 (G1 c) · Calendar 다중 — ISO 목록 렌더 · 선택 변경 뒤 실행 값 = ISO 목록 · 빈 목록 · 지우기 · 모드 전환 (G1 e) · `defaultValue` 만 있는 6종의 시작 값과 지운 뒤 (G1 f) · `d2S2Alignment` · `propSectionConsistency`.

### Phase 2 — Canvas 값 그리기 · 패널 칸 (한 커밋)

| 파일                                                                                                | 변경                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document/dateSegments.ts` `racDateSegmentParts`                                                    | 값 입력을 받는다 — 값이 있으면 그 날짜의 `formatToParts` (자릿수 · 12/24 시 · `shouldForceLeadingZeros` 는 RAC `useDateFieldState` 대로), 없으면 지금의 자리 글자                           |
| `runtime/compositionRoot.ts` `segmentText`                                                          | owner (field · picker) 의 `value` 를 넘긴다. DateRangePicker 는 시작 · 끝. 값 글자색 (자리 글자 paint 가 아닌 Input 글자색)                                                                 |
| `runtime/calendarModel.ts`                                                                          | 입력에 `value` · `selectionMode` — 격자 모델에 선택 칸 (`selected` · 범위 `start` · `end` · 사이) · 보이는 달 = 혼자 선 달력은 F7 순서, picker 안 달력은 F15 순서 (값 → Placeholder → 오늘) |
| `runtime/presence.ts` `calendarModelInput` · 파생 의존                                              | 달력 · picker 의 시작 값을 모델에 · picker 의 Placeholder 는 값이 없을 때만 넘긴다 (`:1766`) · owner 값 변경 → 입력 부품 · 격자 · picker 안 달력 재판정 (R2)                                |
| `apps/builder/src/builder/catalogRuntime/ruleShapes.ts` (CalendarGrid)                              | 선택 칸을 CalendarCell rule 의 선택 상태 값으로 그린다 (`CALENDAR_CELL_STATE` · `RANGE_CALENDAR_CELL_STATE` — 색 · 모서리 · 범위 띠)                                                        |
| `bindings/*` 6                                                                                      | `value` 의 `editorHidden` 해제 · Min · Max · Placeholder 의 `kind` 를 `date` / `time` 으로                                                                                                  |
| `apps/builder/src/builder/panels/properties/generic/GenericFieldRenderer.tsx` + 새 `DateField*.tsx` | 칸 종류 4 의 renderer — `DateValueInput` 재사용 (사용자 결정 1). granularity 가 시각이면 날짜+시각 입력. 범위 = 시작 · 끝 두 입력 한 칸. 목록 = 추가 · 삭제                                 |
| `apps/builder/src/i18n/*`                                                                           | 새 문구 (시작 · 끝 · 날짜 추가 · 읽을 수 없는 값)                                                                                                                                           |

- 읽을 수 없는 기존 글자 (Min · Max · Placeholder): 칸은 비어 보이고 「읽을 수 없는 값」 표시 + 원문 툴팁. 사용자가 새 값을 고르기 전에는 지우지 않는다 (R5).
- 변수에 묶인 `value`: 다른 필드의 변수 연결 표시를 그대로 (R7).
- 테스트: G2 (a) 행렬 (설치 RAC 렌더가 기준값) · G2 (b) 편집 · Undo · Redo = 새 bind · G2 (c) 칸 쓰기 · 읽기.
- live: 6 type (G2 d) — foreground 탭, Canvas 스크린샷 + Preview DOM.

### Phase 3 — Code 보기 · 규칙 인자 · 문서

| 파일                                                                                 | 변경                                                                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/codeView/generate.ts`                                           | 6종 시작 값 (고르기 결과 — 한 번만) → `parseDate('…')` 계열 (변수 기본값의 표 재사용) · 범위 `{start, end}` · import 추가 |
| `apps/builder/src/builder/catalogRuntime/codeViewEdit.ts` `propValue`                | 위 표기의 되읽기                                                                                                          |
| `interactions/concepts/value.ts` · `apps/builder/src/builder/panels/interactions/*`  | `valueDate` · `valueDateRange` 의 인자 종류를 날짜 입력으로 (사용자 결정 4)                                               |
| `docs/CHANGELOG.md` · `.claude/rules/state-management.md` §5 · `catalog-subparts.md` | 읽는 함수 하나 · 저장 자리 · Canvas 값 그리기 기록                                                                        |

- `pnpm docs:stale-symbols` (함수 교체 뒤).
- G3: 본문 Gates.

## 4. 추정

- 소스 ≈ 26 파일 (binding 6 · runtime 6 · document 5 · 패널 4 · Code 2 · interactions 2 · i18n 3) · 테스트 ≈ 9 파일.
- Phase 2 가 가장 크다 (Canvas 입력 글자 · 선택 칸 · 의존). 선택 칸 그리기가 `ruleShapes.ts` 의 기존 primitive 로 안 되면 Phase 0 인벤토리를 고쳐 흡수한다 (새 ADR 사유 아님 — `adr-writing.md` M3).

## 5. 열린 확인 (Phase 0 에서 닫는다)

- Canvas 의 CalendarGrid 가 칸마다 상태 칠을 받을 수 있는 구조인지 (지금은 날짜 글자 + 오늘 점).
- DateRangePicker 의 Canvas 입력이 시작 · 끝을 어떤 record 로 그리는지 (`segmentText` 주석: 「one typed DateInput is the product's start/end pair」).
- 시간대 포함 값의 입력 글자 (`hideTimeZone` 기본 `true` — 표시 여부).

## 6. 기록

### Phase 0 — 2026-11-12 (G0 PASS, 동작 변화 0)

측정: 프로브 테스트 2개 (jsdom · 설치 RAC 렌더, 결과 JSON 은 run `20261112-132205-adr-309…/artifacts/` — 로컬 전용). 기준 HEAD `43b7a9539`.

**§2 표 대조 — 같음.** 설치 `react-stately` 타입: DateField · DatePicker `ValueBase<T | null>` (`T extends DateValue` = CalendarDate · CalendarDateTime · ZonedDateTime), DateRangePicker `RangeValue<T>`, Calendar `CalendarValueType<T, M>` (`single` = `T`, 그 밖 = `readonly T[]` — `calendar/types.d.ts:172`), RangeCalendar `RangeValue<T>`, Calendar · RangeCalendar 의 `focusedValue` · `defaultFocusedValue`. 하나 보탬: TimeField 의 `TimeValue` 는 `Time` 뿐 아니라 날짜+시각 · 시간대 포함 값도 받는다 — 문서의 시각 값은 `parseDateValue` 의 time · dateTime · zoned 를 그대로 넘긴다.

**읽는 함수 대조표 (R4).** DOM 날짜 (`safeParseDateString`) 는 이미 `parseDateValue` 위의 함수다 (time 만 뺀다) — F9 의 넷은 실제로 셋.

| 입력                                | `parseDateValue`    | DOM 날짜 | DOM 시각 (`timeValue`)                                      | Canvas 달력 (`catalogParseCalendarDay`) | 결정                                                                                      |
| ----------------------------------- | ------------------- | -------- | ----------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `2026-11-12`                        | date                | 같음     | —                                                           | 같은 날                                 | 유지                                                                                      |
| `2026-11-12T10:30` · `:15` · `.250` | dateTime            | 같음     | **23:30** (`parseInt("2026-11-12T10")` = 2026 시가 넘쳐 돎) | 앞 10 글자                              | 시각: **변경** — dateTime 을 RAC 에 그대로 (10:30)                                        |
| `…Z` · `…+09:00`                    | zoned (UTC 로 읽음) | 같음     | —                                                           | 앞 10 글자 (offset 의 날)               | 달력: **변경** — DOM 과 같은 날 (UTC 로 읽은 날). 날이 갈리는 값만 차이 (`…T02:00+09:00`) |
| `…[Asia/Seoul]`                     | zoned               | 같음     | —                                                           | 앞 10 글자                              | 유지 (같은 날)                                                                            |
| `10:30` · `10:30:15`                | time                | 없음     | Time                                                        | 없음                                    | 유지                                                                                      |
| `""` · `garbage` · `2026-13-40`     | 없음                | 없음     | 없음                                                        | 없음                                    | 유지                                                                                      |
| `2026-11-12` (앞뒤 공백)            | date                | 같음     | —                                                           | **없음**                                | 달력: **변경** — 읽는다 (DOM 과 같음)                                                     |
| `2026-11-12junk`                    | 없음                | 없음     | —                                                           | **2026-11-12**                          | 달력: **변경** — 읽지 않는다 (DOM 과 같음)                                                |

「변경」 4건은 모두 Canvas 달력 · DOM 시각을 DOM 날짜 (= `parseDateValue`) 쪽으로 맞추는 것이다. 지금 문서에서 이 값이 닿는 자리는 Min · Max · Placeholder (글자 칸) 와 변수 연결뿐이다.

**granularity 예외 (R3) — 재현.** DateField · DatePicker × granularity 5 × 값 4 (date · dateTime · `[zone]` · `Z`) = 40 조합 중 **6 조합에서 렌더가 예외를 던진다**: 날짜만 있는 값 × `hour` · `minute` · `second` (`Error: Invalid granularity minute for value 2026-11-12` — render 밖으로 던져져 Preview 가 빈다). 나머지 34 조합 오류 0. TimeField 4 × 3 = 12 조합 오류 0 (위 23:30 결함은 값이 틀린 것이지 예외는 아니다). 대응 = Decision 3 (자정으로 채움) — Phase 1 의 G1 (c) 가 이 6 조합을 RED 로 쓴다.

**지금 문서가 받는가.** 6종 모두 `setFields({value})` → `CatalogValidationError …value` (F2 그대로 — 받는 길은 변수 연결뿐).

**Code 보기 현행.** 필드 값은 저장한 이름 그대로 `value=` 로 나온다 (`<TextField value="hello" />` · `<NumberField value="7" />`). 날짜 6종도 같은 규칙을 따른다 — `value={parseDate('2026-11-12')}`, 문서에 `defaultValue` 만 있으면 `defaultValue={…}`. 변수 날짜 기본값의 표 (`DATE_PARSE_FN` · `Z` · offset 은 `parseAbsolute(…, 'UTC')`) 를 재사용한다 (`generate.ts:258-263` · `:1159-1178`). (본문 Consequences 의 `defaultValue={…}` 예시는 이 규칙에 맞춰 Phase 3 에서 고친다.)

**실행 값 경계 (R8 · R9).** override 는 노드 props 에 합쳐지지 않는다 — Preview 는 `overrideOf(recordId)` 를 따로 읽고 (`domBinding.runtime.ts:3879-3883`), 상태 읽기는 키 유무 (`runtimeStateProps.ts:25-27`) 라 명시 `null` 이 남는다. 규칙 `clear` 는 6종 모두 `null` 을 쓴다 (`interactions/concepts/value.ts:94-107` — `valueDate` · `valueDateRange` 의 clear 값). Calendar 다중 모드의 `onChange` 는 날짜 배열을 준다 (리뷰 round 1 프로브: `{value: '2026-11-12,2026-11-14'}` 로 저장됨).

**리뷰 round 1 반례 4건** — Phase 1 (5종 `defaultValue` · Calendar 다중 렌더 · 다중 저장 표기) 와 Phase 2 (picker 보이는 달) 의 테스트에 RED 로 옮긴다.

**번들 기준선** (`vite build` → `adr209-bundle-closure.mjs`, `43b7a9539`): Builder initial JS gzip **1,524,395 B** · Preview **151,352 B**. G3 (c) 는 이 값 대비 Δ (Builder ≤ +4,096 · Preview ≤ +3,584).

### Phase 1 — 2026-11-12 (G1 — 판정은 아래 「검증」)

**바꾼 것** (소스 15 · 새 파일 2 · 테스트 2):

- 칸 종류 4 (`date` · `time` · `date-range` · `date-list`) · 값 형 2 (`dateRange` · `calendarValue`) — `catalog/types.ts` · `document/types.ts` · `ruleDefinition.ts` (`PROP_KIND_VALUE_TYPE`) · `valueType.ts` · `validation.ts` (`authoredValue` 가 `{start, end}` 를 받는다) · 새 `document/dateRangeValue.ts`. 상태 변수 형: `calendarValue` → `date` · `dateRange` → `object` (`stateTemplate.ts`). AI 편집 manifest 가 칸 종류 4 를 검사한다.
- 새 `runtime/dateValueRead.ts` — `catalogDateValue` (granularity 맞추기) · `catalogTimeValue` · `catalogDateRange` · `catalogDateStartValue` · `catalogCalendarValue` · `catalogCalendarOverride` · `catalogCalendarFirstDate` · `catalogCalendarDayOf`. DOM (`delegatedDom.runtime.ts` 의 `dateValue` · `timeValue` · `dateRangeValue` · `placeholderDate`) 과 Canvas 달력 (`catalogParseCalendarDay`) 이 이것을 읽는다.
- 6종 모두 시작 값 고르기를 거친다 (5종의 `props.value` 직접 읽기 삭제). Calendar 의 값 · `onChange` · focus 는 선택 모드별 변환. dispatcher 시작 상태 (`catalogStateSourceValue`) 도 같은 값 — `CATALOG_DATE_VALUE_TYPES`.
- binding 6종 `value` · `defaultValue` (Value 구획, 이 Phase 에서는 둘 다 `editorHidden`). Calendar 의 칸 종류는 `date-list` 하나로 두고 패널 renderer 가 선택 모드에 따라 날짜 하나 · 목록을 낸다 (Phase 2) — breakdown §2 의 「`date` / `date-list`」 를 칸 종류 하나로 구현했다.

**행동 변화 (기존 문서)**: 대조표의 「변경」 4건 — TimeField 의 날짜+시각 값 (23:30 → 10:30), Canvas 달력의 앞뒤 공백 · 꼬리 글자 · offset 의 날. 그 밖에는 같다 (G1 b).

**원복 RED**: `adr309DateValue.test.tsx` 16건이 구현 전 16/16 실패 (accepts 없음 · granularity 예외 · 23:30 · `defaultValue` 버려짐 · 다중 렌더 예외) → 구현 뒤 16/16 통과.

**추가 수리 (스위트에서 발견)**: 다중 모드의 빈 목록을 RAC 에 `[]` 로 넘기면 정적 렌더가 예외를 던진다 — RAC `useCalendarState` 가 배열 값의 첫 focus 를 `value[0]` 로 읽고 빈 배열도 참이라 `undefined.subtract` (`adr256CalendarNodeTree` 「selectionMode: multiple」). 빈 목록은 RAC 에 `null` (RAC 다중 선택은 `null` 위에 날짜를 더한다 — `selectDate`), 문서 · 실행 값의 표기는 `[]` 그대로.

**검증 (G1)**: `adr309DateValue.test.tsx` 16 · `adr309DateValueRead.test.ts` 6 통과. `pnpm type-check` 0. shared 2,462 통과 + 기존 Toast 1 실패. builder 8,729 통과 — 실패 10 중 달력 1 은 위 수리, Phase 0 프로브 1 은 실행 중 지운 파일, 나머지 (`adr282LibraryOriginUnlock` · `phase4eOriginView` · `phase4ePalette` · `existingComponentContracts` · `adr284Authoring`) 는 단독 실행 통과 (전체 실행 부하의 시간 초과). live 는 Phase 2 (칸 · Canvas 와 함께 — 이 Phase 에서는 값을 패널로 줄 길이 없다).

### Phase 2 — 2026-11-12 (G2)

**사용자 결정 1 · 2 · 3 · 5** (착수 전 AskUserQuestion): `DateValueInput` 재사용 · 시간대 포함 값 받기 · 상대 날짜 범위 밖 · Calendar 다중 = 날짜 목록. 넷 다 권고안.

**바꾼 것**:

- Canvas 입력 글자 — DateInput 의 파생 값 `_dateValue` (owner 의 시작 값, DateRangePicker 의 start · end DateInput 은 범위의 그 끝 — 두 끝이 다 읽힐 때만) · `_forceLeadingZeros` · `_hideTimeZone` (`presence.ts`). owner 의 값을 파생 값으로 두어 owner 편집이 DateInput 을 다시 판정한다 (R2 — 기존 파생 의존 전파 그대로). `segmentText` 가 같은 읽는 함수로 읽고 `racDateSegmentParts` 의 값 경로가 RAC `getFormatOptions` 대로 (`shouldForceLeadingZeros` 의 2자리 · `hourCycle` · 값의 시간대 · `hideTimeZone`) `formatToParts` 한다. 값 segment 는 `placeholder: false` — Skia 는 자리 글자 칠이 아니라 field 글자색.
- Canvas 달력 — 모델 입력에 `value` · `selectionMode` · `range` (`calendarModelInput`). 보이는 달: 혼자 선 달력 = `defaultFocusedValue` → 값의 첫 날짜 → 오늘, picker 안 달력 = 값 → Placeholder → 오늘 (값이 있으면 Placeholder 를 넘기지 않는다 — F15). 격자 모델에 `selected` (`selected` · `start` · `end` · `startEnd` · `middle`, Min · Max 밖은 빼고 — RAC `isCellDisabled`). picker 의 값 변경 → 그 달력 부품 재판정은 이미 있던 picker 가지 (`derivedDependents`) 가 맡는다.
- Skia — `calendar_month_grid` 가 선택 원 (Calendar 선택 · 범위 시작 · 끝) 과 범위 띠 (주 행마다 pill + 1px 테두리 — 띠는 범위 끝 · 주 끝 · 달 끝에서만 끊기니 각 조각이 pill) 를 그린다. 색은 Builder 가 rule 에서 읽는다 (`catalogCalendarGridPaintProps` — Calendar 의 CalendarCell 상태 트리 `background.isSelected` · `color.isSelected` · `::after` today 점, RangeCalendar 의 `td::before` 띠 `background` · `border`).
- 패널 — binding 6종 `value` 노출 (`defaultValue` 는 숨김), Min · Max · Placeholder 를 `date` / `time` 칸으로. 새 `DateValueFields.tsx` (`DateValueField` · `DateRangeField` · `DateListField`) — `DateValueInput` (빈 칸의 입력 형식 `emptyType` 을 더함: 시각 단위면 날짜+시각, TimeField 는 시각) 을 감싸고, ISO 입력 중의 미완성 글자는 쓰지 않는다 (완성된 ISO 또는 빈 글자만). 읽을 수 없는 기존 글자는 적힌 그대로 보이고 「날짜로 읽을 수 없는 값」 표시 (R5). 문구 5 (ko · en).
- 규칙 유도 Do (`referenceCapabilities.ts`) — `date` · `time` 칸도 글자 입력 Do 를 유도한다 (칸 종류를 바꾸자 Min · Max · Placeholder 의 `set…` 16 이 빠졌다 — Phase 3 의 날짜 입력 전까지 동작 변화 0).

**live 에서 고친 것 2**: 범위 칸이 시작 · 끝을 나란히 두어 입력이 76px 로 잘림 → 세로로 쌓음. 목록 행 폭 0 (그룹의 가운데 정렬) → 행이 칸 폭을 채움.

**검증 (G2)**:

- (a) `adr309CanvasValue.test.tsx` — 입력 글자 19 사례 (locale en · ko · ja · th 불기 달력 · 2자리 끔 · 초 · 24 / 12 시 · 날짜만 + 분 단위 · 시간대 · `defaultValue` · picker · TimeField 3 · 범위 · 빈 값 · 반쪽 범위) 의 Canvas segment = 설치 RAC DOM segment, 달력 9 사례 (다른 달 · `defaultValue` · 다중 · 두 달 · Min 밖 · 불기 · 두 달 범위 · 두 달 보기 범위 · 하루 범위) 의 선택 칸 · 표시 · 제목 = RAC `data-selected` · `-selection-start/end` · CalendarHeading, picker 2종의 값 > Placeholder (March 2027).
- (b) 편집 · Undo · Redo 뒤 = 새 bind — 입력 4종 · 달력 3종.
- (c) `adr309DateValueFields.test.tsx` 7 — 쓰기 · 읽기 · 지우기 · 입력 형식 · 읽을 수 없는 글자 보존 · 시간대 보존 · 범위 한 번 쓰기 · 목록 추가 · 고침 · 삭제 · 단일 모드.
- (d) live (Chrome MCP, 5173, 새 프로젝트) — 6종을 놓고 Value 칸 (ISO 입력) 으로 값 · Placeholder → Canvas 값 글자 · 선택 원 · 범위 띠가 Publish DOM 과 같음 (입력 6 · 범위 24~30 · 선택 10 · 18), Publish 에서 DatePicker 를 열면 March 2027 (Placeholder 2030 아님), 새로고침 뒤 같음, 콘솔 오류 0.
- 원복 RED 4/4: `_dateValue` 제거 21 실패 · 보이는 달의 값 제거 13 · picker 에 Placeholder 먼저 2 · 선택 칸 제거 10.
- `d2S2Alignment` 5 · `propSectionConsistency` 23 · `pnpm type-check` 0 · shared 2,468 통과 + 기존 Toast 1 · rendering 1,280.
- builder 8,781 통과 — 실패 2 (`adr256CalendarModel` 「default value」 en · ko): Canvas 모델이 `defaultValue` 의 선택 칸을 내는데 RAC 기준 추출이 선택 칸을 읽지 않았다 → 기준에 RAC `data-selected` 칸을 더함 (33/33). 판정 강화이지 기대값 완화가 아니다.
- builder 8,781 통과 — 실패 2 (`adr256CalendarModel` 「default value」 en · ko): Canvas 모델이 `defaultValue` 의 선택 칸을 내는데 RAC 기준 추출이 선택 칸을 읽지 않았다 → 기준에 RAC `data-selected` 칸을 더함 (33/33). 판정 강화이지 기대값 완화가 아니다.

### Phase 3 — 2026-11-12 (G3)

**사용자 결정 4** (착수 전 AskUserQuestion): 규칙의 날짜 인자를 날짜 입력으로 (권고안).

**바꾼 것**:

- Code 보기 — `generate.ts` `datePropCode` · `dateExpression` (변수 날짜 기본값의 표를 함수로 꺼내 같이 쓴다): 6종의 `value` · `defaultValue` · `minValue` · `maxValue` · `placeholderValue` 를 `{parseDate('…')}` · `parseDateTime` · `parseTime` · `parseZonedDateTime` · `parseAbsolute('…', 'UTC')` 로, 범위는 `{{start: …, end: …}}`, Calendar 목록은 `{[…]}`, import 를 더한다. 날짜로 읽히지 않는 글자는 글자 그대로. 되읽기 (`codeViewEdit.ts` `propValue`) 는 `parse…('…')` 호출을 그 ISO 글자로 바꾼 뒤 기존 글자 · 객체 · 배열 읽기에 넘긴다 (`DATE_CALL`). 속성 이름은 저장한 이름 그대로 (Phase 0 실측 — 필드 값은 `value=`).
- 규칙 인자 — `CapabilityParam` 에 `date` · `date-range`. 값 개념 (`valueDate` · `valueDateRange`) 과 유도 Do (`date` · `time` 칸) 가 그것을 묻고, Interactions 패널 Value 칸 (`ValueField` · `ParamField`) 이 Design 패널의 날짜 입력 (`DateValueField` · `DateRangeField`) 을 쓴다 (TimeField 대상이면 시각 입력, 값 고르기 `{ }` 그대로). 문서 검증 · 타입이 capability 값의 `{start, end}` 를 받는다.
- 번들 (G3 c 첫 측정 Builder +4,678 B — 상한 +4,096 초과): `DateValueInput` 은 지금까지 lazy 패널 (변수 표 · 데이터 격자) 에만 있었는데 Design 패널이 직접 import 해 첫 번들로 들어왔다. 날짜 칸 (`DateKindField` 새 모듈) 과 규칙 Value 칸의 날짜 입력을 lazy 경계 뒤로 옮겼다 → **Builder +3,907 B · Preview +325 B** (기준선 1,524,395 · 151,352 → 1,528,302 · 151,677).
- 문서 — `state-management.md` §5 (날짜 값 저장 · 읽는 함수 하나) · `catalog-subparts.md` (DateInput 값 · 달력 선택) · ADR Consequences 의 Code 예시 (`value={…}`). `pnpm docs:stale-symbols` 0.

**검증 (G3)**:

- (a) `adr309CodeView.test.tsx` 9 — DateField · DatePicker (날짜+시각) · TimeField · `Z` 시각 · DateRangePicker · RangeCalendar · Calendar 목록 · Min value 가 한 번 나오고 import 되며, 바꾸지 않은 적용은 revision 그대로, 고친 리터럴은 ISO 글자로 저장 · 읽을 수 없는 글자는 글자 그대로. 원복 RED 2/2 (생성 쪽 · 되읽기 쪽 각 8 실패).
- (b) `adr309RuleDateArgs.test.tsx` 2 — 6종 값 Do 가 `date` / `date-range` 를, 유도 Min · Max · Placeholder Do 가 `date` 를 묻고, Value 칸이 날짜 · 범위 · 시각을 쓴다.
- (c) 번들 — 위.
- (d) `pnpm type-check` 0 · shared 2,468 통과 + 기존 Toast 1 · rendering 1,280 · builder 8,790 통과 — 실패 4 (`phase4ePalette` 1 · `adr284Authoring` 3) 는 전체 실행 부하의 5초 시간 초과, 단독 실행 25/25 (Phase 1 과 같은 파일 · Phase 2 전체 실행에서는 통과).
- (e) live (Chrome MCP, 같은 live 프로젝트) — Code 보기 `Home.tsx` 에 6종 값 · `import {parseDate, parseTime} from '@internationalized/date'`. Interactions: DatePicker onChange → DateField Set value 의 Value 칸이 날짜 입력, 2026-12-25 → Publish 에서 DatePicker 를 2027-03-15 로 고르면 DateField 가 12/25/2026, 콘솔 오류 0.
