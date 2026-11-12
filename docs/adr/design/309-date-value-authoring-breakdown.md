# ADR-309 breakdown — 날짜 · 시각 값을 문서가 저장한다

> 본문: [ADR-309](../309-date-value-authoring.md). 이 문서는 구현 순서 · 파일 · 검증을 담는다. 줄 번호는 main `4b6c75cde` 기준이고 Phase 0 에서 다시 잰다.

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

(Phase 를 닫을 때 적는다.)
