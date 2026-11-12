# ADR-309: 날짜 · 시각 값을 문서가 저장한다 — 날짜 계열 6종 `value` · 날짜 칸 · Canvas 값 그리기

## Status

Proposed — 2026-11-12

- 사용자 요청: `/create-adr` (2026-11-12, 「커밋후 /create-adr」 — ADR-308 커밋 `4b6c75cde` 뒤).
- 방향을 정한 사용자 원문 (같은 날 대화 순서대로):
  - 「프러퍼티탭에 재배치와 중복 제거는 다된건가」 — 점검 결과 날짜 계열 6종에만 값 칸이 없다는 보고.
  - 「3은 레퍼런스를 확인후 알려줘」 — S2 레퍼런스 대조 요청 (결과 = Context §코드 사실 F1 · F2).
  - 「Calendar 의 처음 보이는 달은 보통 선택한 날짜를 따라가게 하지않나?」 — 처음 보이는 달은 칸으로 내지 않는다.
- 앞서 작업 목록에 올라 있던 사용자 요청 (2026-11-12 「날짜 칸」 — Min · Max · Placeholder value 를 날짜 입력으로) 을 이 ADR 이 함께 담는다.
- 확정 전제 3 (구현 중 다시 묻지 않는다): ① 달력이 처음 보여 주는 달은 선택한 날짜를 따라간다 — `focusedValue` 칸은 없다 ② 한 개념 한 칸 (2026-11-12 「중복 제거」) — `value` · `defaultValue` 중 패널에는 하나만 ③ 옛 문서의 값을 바꾸는 코드는 넣지 않는다 (개발 단계 규칙).
- 리뷰 round 1 (2026-11-12, codex — `docs/adr/reviews/309.md`) 의 HIGH 1 · MEDIUM 2 를 반영했다: Calendar 다중 선택의 양방향 변환 · 시작 값 고르기 · picker 의 보이는 달 순서 (Decision 1 · 4, F15 ~ F17, R8 ~ R10, G1 e · f, G2 a).
- 분리 (fork) 아님: ADR-308 의 잔여 작업이 아니라 새 결정이다 (308 은 선택 · 펼침, 이 ADR 은 날짜 값). 선행 결정과의 관계는 Context §선행 결정.

## Context

### 도메인

- **D2 (Props/API)**: S2 `DateField` · `TimeField` · `DatePicker` · `DateRangePicker` · `Calendar` · `RangeCalendar` 의 `value` · `defaultValue` 를 문서가 받는다 (S2 prop 표면 정렬).
- **D3 (시각 스타일 — 대칭)**: 저장한 값을 Canvas 와 Preview/Publish 가 같은 모습으로 그린다. 선택 칸의 모양은 이미 있는 rule (CalendarCell 상태 시트) 을 Canvas 가 읽는다 — 새 rule 값 0, 생성 CSS 변경 0 (Spec · Generator 확장 ADR 이 아니다).
- **D1 (DOM/접근성)**: 무변경. DOM 은 지금도 RAC 컴포넌트에 값을 넘긴다 (F3).

### 문제

날짜 계열 6종은 Design 패널에 값 칸이 없다. 값을 주려면 변수를 만들어 묶어야 하고, 그렇게 해도 Canvas 는 늘 빈 칸 (`yyyy. mm. dd.`) 과 오늘이 있는 달을 그린다. Min · Max · Placeholder value 는 날짜인데 일반 글자 칸이라 형식을 사용자가 외워서 적어야 한다.

### 코드 사실 (main `4b6c75cde` 실측)

| ID  | 사실                                                                                                                                                                                                                                                                 | 근거                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | S2 6종 모두 `value` · `defaultValue` 를 받는다 — DateField · DatePicker = 날짜, TimeField = 시각, DateRangePicker · RangeCalendar = `{start, end}`, Calendar = 날짜 (다중 선택이면 여러 날짜). Calendar · RangeCalendar 는 `focusedValue` · `defaultFocusedValue` 도 | `.claude/skills/react-spectrum/references/components/{DateField,TimeField,DatePicker,DateRangePicker,Calendar,RangeCalendar}.md` 의 props 표                                        |
| F2  | 6종 binding 은 `value` · `defaultValue` 를 받지 않는다 (숨김이 아니라 없음)                                                                                                                                                                                          | `bindings/{DateField,TimeField,DatePicker,DateRangePicker,Calendar,RangeCalendar}.binding.ts` 의 `accepts`                                                                          |
| F3  | DOM 렌더러는 이미 `props.value` 를 읽어 RAC 에 넘긴다 — 지금 그 값의 출처는 변수 연결과 Preview 실행 값뿐                                                                                                                                                            | `runtime/delegatedDom.runtime.ts:2584-2613` (picker 2) · `:2624-2668` (field 2) · `:3900-3950` (달력 2)                                                                             |
| F4  | 문서는 `accepts` 에 없는 상태 속성도 변수 연결 (`PropVar`) 이면 받는다 — 「검색 추가」 의 DatePicker · DateRangePicker 가 이 길로 `value` 를 변수에 묶는다                                                                                                           | `document/graph.ts:1845-1852` · `apps/builder/src/builder/catalogRuntime/viewAuthoring.ts:902-923`                                                                                  |
| F5  | Canvas 의 DateInput 은 빈 입력의 자리 글자만 그린다 — 값을 읽는 입력이 없다                                                                                                                                                                                          | `document/dateSegments.ts:45-86` · `runtime/compositionRoot.ts:4903-4967` (`segmentText`)                                                                                           |
| F6  | Canvas 달력 모델은 보이는 달을 `defaultFocusedValue ?? defaultValue ?? 오늘` 로 정하지만 호출부가 값을 넘기지 않는다. 격자 모델에는 날짜 글자와 오늘 칸뿐 — 선택 칸이 없다                                                                                           | `runtime/calendarModel.ts:242-248` · `:84-87` · `runtime/presence.ts:1750-1768` (`calendarModelInput`)                                                                              |
| F7  | 혼자 선 달력의 처음 보이는 달 순서 (레퍼런스): `defaultFocusedValue` → 선택한 값 (다중이면 첫 날짜) → 오늘, 모두 Min · Max 안으로. DOM 도 같은 순서                                                                                                                  | 설치 `react-stately/dist/private/calendar/useCalendarState.mjs:55-58` · `runtime/delegatedDom.runtime.ts:3991-4005`                                                                 |
| F8  | Min · Max · Placeholder value 는 `kind: "string"` — 일반 글자 칸                                                                                                                                                                                                     | `DateField.binding.ts:114-115,156` · `TimeField.binding.ts:107-108,151` · `DatePicker.binding.ts:114-115,118` · `DateRangePicker.binding.ts:95-96,99` · `Calendar.binding.ts:65-66` |
| F9  | 날짜 글자를 읽는 자리가 넷이고 서로 다른 함수다 — DOM 날짜 (`safeParseDateString`) · DOM 시각 (`:` 로 직접 자름) · Canvas 달력 (`parseDate(앞 10 글자)`) · 변수 · 데이터 (`parseDateValue` — date · dateTime · zoned · time 넷으로 가름)                             | `delegatedDom.runtime.ts:1547-1548` · `:1589-1600` · `calendarModel.ts:117-124` · `packages/shared/src/state/dateValue.ts`                                                          |
| F10 | 패널용 날짜 입력은 이미 있다 — 변수 표 · 데이터 격자 · 행 양식이 쓰고, 원본의 시간대 · 초를 보존한다                                                                                                                                                                 | `apps/builder/src/builder/components/inputs/DateValueInput.tsx:33` · `packages/shared/src/state/dateValueEditing.ts`                                                                |
| F11 | Code 보기는 날짜 변수의 기본값을 `parseDate('…')` · `parseTime('…')` 등으로 쓴다. prop 의 날짜 리터럴을 쓰는 길은 없다                                                                                                                                               | `packages/shared/src/codeView/generate.ts:260-263` · `:1159-1172`                                                                                                                   |
| F12 | 규칙 (Do) 은 6종의 값을 이미 쓴다 (`setValue` · `clear`) — 인자 입력은 글자 칸                                                                                                                                                                                       | `interactions/concepts/value.ts:94-107` · `interactions/componentInteractionSpecs.ts:353-366`                                                                                       |
| F13 | 패널 칸 종류와 문서 값 형에 날짜가 없다                                                                                                                                                                                                                              | `catalog/types.ts:137-167` (`InspectorFieldKind`) · `document/types.ts:309-334` (`ValueType`)                                                                                       |
| F14 | 달력 칸의 선택 · 범위 모양은 DOM 에서 rule 시트가 그린다 (`[data-selected]` · `[data-selection-start]` …). Canvas 는 그 상태를 그리지 않는다                                                                                                                         | `generated/componentRulesTable.ts:341-343` · `:2371` · `:11313` · `apps/builder/src/builder/catalogRuntime/ruleShapes.ts:118`                                                       |
| F15 | picker 안 달력은 순서가 다르다 — RAC 는 picker 에 값이 있으면 Placeholder 를 달력에 넘기지 않는다 (값 → Placeholder → 오늘). Canvas 는 지금 picker 의 Placeholder 를 달력 모델의 `defaultFocusedValue` 로 넘긴다 (값이 없는 지금은 결과가 같다)                      | 설치 `react-aria/dist/private/datepicker/useDatePicker.mjs:167` · `useDateRangePicker.mjs:211` · `runtime/presence.ts:1766`                                                         |
| F16 | DOM 의 날짜 읽기 · 쓰기는 값 하나만 다룬다 — 읽기는 글자만 파싱하고 목록은 그대로 RAC 에 넘기며 (RAC 가 예외를 던진다), 쓰기는 `String(next)` 라 날짜 목록이 쉼표로 이은 글자 하나가 된다. 달력의 focus 도 같은 값을 받는다                                          | `delegatedDom.runtime.ts:1547-1551` · `:3914-3920` · `:3991-4005`                                                                                                                   |
| F17 | 시작 값으로 `defaultValue` 를 읽는 것은 Calendar 뿐이고 나머지 5종은 `props.value` 만 읽는다. 실행 중 값은 override 에 키가 있으면 (명시 `null` 포함) 그것, 없으면 시작 상태 한 함수 (`catalogStateSourceValue`) 인데 날짜 계열의 `value` 는 `props.value` 그대로다  | `delegatedDom.runtime.ts:2589` · `:2603` · `:2628` · `:2653` · `:3939` · `:3917` · `:4133-4162` · `runtime/runtimeStateProps.ts:25-27`                                              |

### 제약

- **Hard**: 값이 있는 문서에서 Canvas 가 그리는 입력 글자 · 선택 칸 · 보이는 달 = 설치 RAC 가 같은 값으로 내는 결과 (G2 a — 기준값은 RAC 출력). 번들 증가 ≤ ADR-201 Δ 상한 (Builder +4,096 B · Preview +3,584 B gzip). 기존 문서는 100% 그대로 열린다 (`accepts` 가산만 — 계약 번호를 올리지 않는다).
- **Hard**: RAC 는 시각 단위 granularity 에 날짜만 있는 값을 주면 예외를 던진다 (`useDatePickerState` — Invalid granularity). 저장 값과 granularity 가 어긋난 문서가 Preview 를 멈추면 안 된다 (R3).
- **Soft**: 패널 입력은 이미 있는 `DateValueInput` 을 재사용한다. 새 날짜 라이브러리 0 (`@internationalized/date` 는 이미 쓴다).

### 선행 결정

- 2026-11-12 Design 패널 「Value」 구획 (`ea02e5f33`) — 값 · 선택 · 열림 · 펼침은 Value 구획, 같은 개념은 한 칸.
- ADR-308 (2026-11-12) — 필드 가족은 `value` 를 저장하고 DOM 이 그것을 시작 값으로 넘긴다 (TextField · NumberField · Select 와 같은 자리).
- 2026-11-02 「날짜 편집은 ISO 원본을 보존한다」 · 「날짜 runtime 파서도 값 모양을 따른다」 (`.claude/rules/state-management.md` §5) — `parseDateValue` 의 네 갈래가 정본.
- ADR-256 Phase 9 — 달력 노드 트리 (`CalendarMonth` > header + `CalendarGrid`) 와 Canvas 달력 모델 (`calendarModel.ts`).

## Alternatives Considered

### 대안 A: 값 칸만 추가 — 문서가 받고 DOM 만 그린다

- 설명: binding 에 `value` 를 더하고 패널에 칸을 낸다. Canvas 는 지금처럼 빈 입력 · 오늘 달을 그린다.
- 근거: 가장 작은 변경. DOM 은 이미 값을 읽는다 (F3).
- 위험: 기술 LOW / 성능 LOW / 유지보수 **HIGH** / 마이그레이션 LOW
  - 유지보수 HIGH: 패널에서 날짜를 골라도 Canvas 가 그대로다 — D3 대칭 위반이 구조로 굳는다 (`ssot-hierarchy.md` §6 「시각 비대칭」). 사용자에게는 「칸이 동작하지 않는다」 로 보인다.

### 대안 B: 문서가 `value` 를 저장하고 두 소비자가 같은 값으로 그린다

- 설명: 6종이 `value` 를 받는다 (ISO 글자 — 변수 · 데이터 · Code 와 같은 표기). 읽는 함수는 `parseDateValue` 하나, granularity 에 맞추는 변환도 하나. Canvas 는 입력 글자를 그 값으로, 달력 선택 칸을 rule 의 선택 상태로, 보이는 달을 RAC 순서로 그린다. 패널은 Value 구획의 날짜 칸 (Min · Max · Placeholder 도 같은 칸).
- 근거: 레퍼런스 표면 그대로 (F1). 필요한 기반이 저장소에 있다 — DOM 의 값 읽기 (F3), 달력 모델의 `defaultValue` 자리 (F6), 패널 입력 (F10), Code 표기 (F11), 선택 칸 rule (F14).
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW
  - 기술 MEDIUM: Canvas 가 RAC 의 입력 글자 (locale · 달력 체계 · 12/24 시 · 자릿수) 와 선택 칸 (범위의 시작 · 끝 · 사이, 달 경계) 을 재현해야 한다. 자리 글자 재현은 이미 같은 방식으로 한다 (`dateSegments.ts`).

### 대안 C: 값은 변수로만 — 지금 구조를 유지하고 안내만 고친다

- 설명: 값 칸을 내지 않고 State 구획의 「Component state」 에서 변수를 만들어 묶게 한다. Canvas 가 변수 기본값을 그리도록만 고친다.
- 근거: 문서 형식 변경 0. 「검색 추가」 가 이미 이 길을 쓴다 (F4).
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 MEDIUM / 마이그레이션 LOW
  - 유지보수 MEDIUM: 「놓고 날짜 하나 고르기」 에 변수 만들기가 끼어든다 — 다른 필드 (TextField · NumberField · Select) 와 다른 조작. Min · Max 칸 문제는 그대로 남는다.

### 대안 D: 날짜를 구조화 값 (`{year, month, day}`) 으로 저장

- 설명: `value` 를 객체로 저장하고 형 검증을 엄격히 한다.
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 **HIGH** / 마이그레이션 MEDIUM
  - 유지보수 HIGH: 변수 · 데이터 · Code 보기 · 규칙 인자가 모두 ISO 글자다 (F9 · F11 · F12) — 경계마다 변환이 생기고 표기가 둘이 된다.

### Risk Threshold Check

| 대안 | HIGH+              | 판정                                    |
| ---- | ------------------ | --------------------------------------- |
| A    | 유지보수 HIGH      | 기각 — 대칭 위반이 남는다               |
| B    | 없음 (기술 MEDIUM) | 채택                                    |
| C    | 없음 (MEDIUM 2)    | 기각 — 사용자 조작이 다른 필드와 갈린다 |
| D    | 유지보수 HIGH      | 기각 — 표기가 둘이 된다                 |

B 에 HIGH 가 없어 루프는 돌지 않는다. 실행 중 관리할 위험은 Risks 에 둔다 (R1 · R2 · R3 · R8 이 HIGH).

## Decision

**대안 B** 를 채택한다.

1. **저장 자리 = `value` (ISO 글자).** DateField · DatePicker = 날짜 · 날짜+시각 · 시간대 포함 (`parseDateValue` 의 date · dateTime · zoned), TimeField = 시각 (time), DateRangePicker · RangeCalendar = `{start, end}`, Calendar = 날짜 하나 (다중 선택이면 날짜 목록).
   - **시작 값 고르기 (6종 공통, 한 함수)**: 문서에 `value` 키가 있으면 그것, 없으면 `defaultValue`. DOM · Canvas · Code 보기 · 규칙 dispatcher (`catalogStateSourceValue`) 가 같은 함수를 쓴다. `defaultValue` 는 패널에 내지 않는다 (확정 전제 ②) — Code · AI 편집으로 저장된 값이 버려지지 않게 하는 자리다 (F17).
   - **실행 중 값이 먼저**: 실행 중 override 에 `value` 키가 있으면 (지운 뒤의 명시 `null` · 빈 목록 포함) 그것이 이긴다. 비었다고 시작 값으로 돌아가지 않는다 — 키 유무로 가르고 `??` 로 잇지 않는다.
   - **DOM 전달**: 날짜 하나 · 시각 · 범위는 지금 방식 그대로다 (F3 — 시작 값, 달력은 실행 중 controlled). Calendar 는 값 변환이 `selectionMode` 를 따른다 (F16) — 읽기 = 목록 원소마다 ISO → 날짜 (읽지 못한 원소는 뺀다), 쓰기 = RAC 가 준 날짜 목록 → ISO 목록 (글자 하나로 잇지 않는다), 달력 focus = 첫 날짜. 빈 목록 = 선택 없음, 지우기 = 단일 `null` · 다중 빈 목록.
   - **`selectionMode` 를 바꿔도 저장 값은 고치지 않는다**: 읽을 때 모드에 맞춘다 — 단일 모드의 목록은 첫 날짜, 다중 모드의 날짜 하나는 원소 하나인 목록 (Select 의 `catalogSelectValue` 와 같은 방식). 패널 칸은 다음 편집 때 그 모드의 모양으로 쓴다.
2. **값 형은 넓히지 않는다.** 날짜 하나 · 시각은 `string`, 새 값 형은 둘 (`dateRange` · `calendarValue` — 하나 또는 목록). 읽지 못하는 글자는 빈 값으로 읽는다 (지금 DOM · 변수 연결과 같은 동작). Min · Max · Placeholder 는 값 형 `string` 그대로 — 칸만 날짜 입력이 된다. 기존 문서의 글자 값이 검증에 걸리지 않는다 (R5).
3. **읽는 함수 하나.** DOM 렌더러 · Canvas 입력 글자 · Canvas 달력 모델이 `parseDateValue` 와 「granularity 에 맞추기」 한 함수를 같이 쓴다 (F9 의 넷 → 하나). 날짜만 있는 값 + 시각 granularity 는 자정으로 채워 넘긴다 (R3). 시작 값 고르기와 Calendar 의 모드별 변환 (Decision 1) 도 같은 모듈에 둔다.
4. **Canvas 가 값을 그린다.**
   - 입력: 값이 있으면 자리 글자 대신 그 날짜의 글자 (같은 locale · 달력 체계 · 시 표기 · granularity), 색은 값 글자색. DateRangePicker 는 시작 · 끝.
   - 달력: 선택 칸 · 범위 (시작 · 끝 · 사이) 를 CalendarCell rule 의 선택 상태 값으로. picker 안 달력은 picker 의 값.
   - 보이는 달 (Min · Max 안으로, 칸은 없다 — 확정 전제 ①): 혼자 선 달력 = `defaultFocusedValue` → 값 (다중이면 첫 날짜, 범위면 시작) → 오늘 (F7). picker 안 달력 = picker 의 값 (범위면 시작) → picker 의 Placeholder → 오늘 (F15) — 값이 있으면 Placeholder 는 쓰이지 않는다.
5. **패널.** Value 구획에 「Value」 칸 — 날짜 · 날짜+시각 (granularity 를 따른다) · 시각 · 범위 (시작 · 끝) · 목록. Min · Max · Placeholder value 도 같은 날짜 입력. 입력 부품은 `DateValueInput` (사용자 결정 1).
6. **Code 보기.** 시작 값 (Decision 1 의 고르기 결과) 을 한 번만 쓴다. 값 리터럴을 변수 기본값과 같은 표기 (`parseDate('2026-11-12')` · `parseTime('10:00')` …) 로 쓰고 다시 읽는다. 범위는 `{start: …, end: …}`.
7. **규칙 (Do) 인자.** 6종 `setValue` 의 인자 입력을 같은 날짜 입력으로 (사용자 결정 4).
8. **문서 변환 없음 · 계약 번호 유지.** `accepts` 가산뿐이고 원본 template 은 값을 갖지 않는다.

### 기각 사유

- **A**: Canvas 가 값을 그리지 않으면 패널 칸이 Canvas 에서 무반응이다 — D3 대칭 위반.
- **C**: 값 하나를 주는 데 변수가 필요해 다른 필드와 조작이 갈리고, Min · Max 칸 문제를 풀지 못한다.
- **D**: 저장소의 날짜 표기 (변수 · 데이터 · Code · 규칙) 가 모두 ISO 글자라 경계마다 변환이 생긴다.

### 위험 수용 근거

B 의 잔존 위험은 「Canvas 가 RAC 출력과 다르게 그린다」 는 재현 위험이다. 자리 글자는 이미 같은 방식 (`Intl.DateTimeFormat` parts) 으로 맞추고 있고, 기준값을 설치 RAC 의 실제 출력으로 두는 게이트 (G2 a) 로 막는다. 문서 형식은 가산이라 되돌리기 쉽다.

### 사용자 결정 5건 (구현이 닿을 때 묻는다)

1. **패널 날짜 입력** (Phase 2): (a) 이미 있는 `DateValueInput` (브라우저 날짜 입력 + ISO 직접 입력 전환) / (b) 빌더 자체 RAC DatePicker 로 새로 만든다. 권고 (a) — 변수 표 · 데이터 격자와 같은 입력.
2. **시간대 포함 값** (Phase 2): (a) 패널에서 입력을 받는다 (`DateValueInput` 의 ISO 입력으로) / (b) 날짜 · 날짜+시각만. 권고 (a).
3. **「오늘」 같은 상대 값** (Phase 2): (a) 이번 범위 밖 — 고정 날짜만, 상대 날짜는 변수로 / (b) 「오늘」 선택지를 넣는다 (저장 표기 · Canvas 의 오늘 처리 필요). 권고 (a).
4. **규칙 인자 입력** (Phase 3): (a) 6종 `setValue` 인자를 날짜 입력으로 바꾼다 / (b) 글자 칸 그대로. 권고 (a).
5. **Calendar 다중 선택의 칸** (Phase 2): (a) 날짜 목록 (추가 · 삭제) / (b) 단일 선택만 칸을 내고 다중은 변수로. 권고 (a).

> 구현 상세: [309-date-value-authoring-breakdown.md](design/309-date-value-authoring-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                               | 심각도 | 대응                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Canvas 입력 글자 · 선택 칸이 RAC 와 다르다 — locale · 달력 체계 · 12/24 시 · 자릿수 · 달 경계의 범위 (`document/dateSegments.ts:45-86` · `runtime/compositionRoot.ts:4903-4967` · `runtime/calendarModel.ts:242-248` · `ruleShapes.ts:118`)        |  HIGH  | G2 (a) — 설치 RAC 출력이 기준값. 불리한 경우 (ko · ja · 불기 달력 · 12 시 · 초 단위 · 달을 넘는 범위 · Min · Max 밖 값) 를 행렬에 넣는다  |
| R2  | 값을 고쳐도 Canvas 가 다시 그려지지 않는다 — 입력 부품 · 달력 격자 · picker 안 달력이 owner 값에 의존하게 된다 (`runtime/presence.ts:1750-1768` · `:2960-2985` · `compositionRoot.ts` 의 의존 전파)                                                |  HIGH  | G2 (b) — 편집 · Undo · Redo 뒤 증분 결과 = 새 bind (메모리 `feedback-canvas-child-painted-from-owner-needs-dirty-expansion`)              |
| R3  | 저장 값과 granularity 가 어긋나 RAC 가 예외를 던진다 — 날짜만 있는 값 + 시각 granularity (`delegatedDom.runtime.ts:2584-2613` · `:2624-2668` · `:1536-1545` 의 Placeholder 변환이 선례)                                                            |  HIGH  | Decision 3 — 맞추기 함수 하나를 DOM · Canvas 가 같이 쓴다. G1 (c) — granularity 5 × 값 갈래 4 조합에서 Preview 렌더 오류 0                |
| R4  | 읽는 함수를 하나로 바꾸며 지금 읽히던 글자가 안 읽힌다 (또는 반대) — `safeParseDateString` · 시각 직접 자르기 · `parseDate(앞 10 글자)` 의 받는 범위가 `parseDateValue` 와 다르다 (F9)                                                             |  MED   | Phase 0 대조표 — 같은 입력 집합을 네 함수에 넣어 차이를 기록, 차이마다 유지 · 변경을 정한다. G1 (b)                                       |
| R5  | Min · Max · Placeholder 에 적힌 기존 글자 값이 문서 검증에 걸린다                                                                                                                                                                                  |  MED   | Decision 2 — 값 형 `string` 유지 (칸만 바뀜). 날짜로 읽히지 않는 기존 값은 패널이 빈 칸 + 「읽을 수 없는 값」 표시 (조용히 지우지 않는다) |
| R6  | 번들 상한 — HEAD 가 이미 ADR-201 절대 상한을 넘어 있다 (ADR-308 G0-6)                                                                                                                                                                              |  MED   | G3 (c) — 착수 기준선 대비 Δ 로 판정. Canvas 달력 모델은 이미 initial 에 있다 — 새 lazy 경계는 만들지 않는다                               |
| R7  | 변수에 묶인 값 (F4) 과 리터럴 값이 한 속성에서 만난다 — 패널 칸이 변수 연결을 덮어쓴다                                                                                                                                                             |  MED   | 다른 필드의 기존 규칙 (변수 연결 표시 · 해제 뒤 리터럴) 을 그대로 따른다. G2 (d) live 에 「검색 추가」 로 만든 DatePicker 를 넣는다       |
| R8  | Calendar 다중 선택 값이 DOM 경계를 넘지 못한다 — ISO 목록을 RAC 가 그대로 받아 예외를 던지고, 선택 뒤 실행 값이 쉼표로 이은 글자가 된다 (`delegatedDom.runtime.ts:1547-1551` · `:3914-3920` · `:3991-4005` · `runtime/runtimeStateProps.ts:25-27`) |  HIGH  | Decision 1 — 모드를 따르는 양방향 변환. G1 (e) — 그 DOM 경계를 실제로 실행해 판정한다                                                     |
| R9  | 받은 `defaultValue` 가 버려지거나 (5종 — F17), 지운 값이 시작 값으로 되살아난다                                                                                                                                                                    |  MED   | Decision 1 — 시작 값 고르기 한 함수 · 실행 중 값은 키 유무로. G1 (f)                                                                      |
| R10 | picker 의 값과 Placeholder 가 다른 달이면 Canvas 가 Placeholder 의 달을 보여 준다 (`runtime/presence.ts:1766` — F15)                                                                                                                               |  MED   | Decision 4 — picker 순서를 따로 둔다. G2 (a) 행렬에 넣는다                                                                                |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 실패 시 대안                                                 |
| ---- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| G0   | Phase 0 종료 | 설치 S2 · RAC 타입에서 뽑은 「6종 × 값 속성 × 값 형」 표가 breakdown §2 와 같다 · 읽는 함수 넷의 대조표 (R4) · Code 보기의 필드 값 현행 표기 · RAC granularity 예외 재현 (R3) · 번들 기준선                                                                                                                                                                                                                                                                                                                                                                                            | 표가 다르면 breakdown 을 실측으로 고친 뒤 진행               |
| G1   | Phase 1 종료 | (a) 6종 binding 이 `value` (와 숨긴 `defaultValue`) 를 받는다 (`d2S2Alignment` PASS) (b) 읽는 함수 하나 — 대조표의 「유지」 입력 전부에서 DOM 이 RAC 에 넘기는 값이 전과 같다 (c) granularity 5 × 값 갈래 4 에서 Preview 렌더 오류 0 (d) 기존 스위트 결과 변화 0 (e) Calendar `selectionMode: multiple` — ISO 목록 값으로 설치 RAC 렌더 오류 0 · 선택 칸 = 목록의 날짜, RAC 의 선택 변경 → 실행 값이 ISO 목록이고 다음 렌더가 같은 선택, 빈 목록 · 지우기 · 모드 전환 (f) `defaultValue` 만 있는 문서에서 6종이 RAC 에 넘기는 시작 값 = 그 값, 지운 뒤 (명시 `null`) 되살아나지 않는다 | (b) 차이는 대조표의 결정대로 수리. 동작 변화는 이월하지 않음 |
| G2   | Phase 2 종료 | (a) 6종 × 값 행렬에서 Canvas 입력 글자 = RAC 의 segment 글자, Canvas 선택 칸 = RAC `data-selected` · `data-selection-start` · `data-selection-end` 칸, Canvas 가 보여 주는 달 = RAC 제목 (picker 2종은 값과 Placeholder 가 다른 달인 경우 포함) (b) 값 편집 · Undo · Redo 뒤 증분 = 새 bind (c) Min · Max · Placeholder 칸이 같은 값을 쓰고 읽는다 · 읽을 수 없는 기존 글자는 지워지지 않는다 (d) live — 6종 각각 패널에서 고르고 Canvas · Preview · 새로고침, 콘솔 오류 0                                                                                                             | (a) (b) 실패는 한 type 만이어도 커밋하지 않는다              |
| G3   | Phase 3 종료 | (a) Code 보기 왕복 — 값이 한 번 나오고 다시 읽힌다 (6종 + 범위) (b) 규칙 `setValue` 인자 입력 (사용자 결정 4) (c) 번들 Δ ≤ ADR-201 Δ 상한 (d) `pnpm type-check` · shared · builder 스위트 (e) live — 새 프로젝트에서 DatePicker · DateRangePicker · Calendar                                                                                                                                                                                                                                                                                                                           | (c) 초과는 사용자에게 상한 재승인 요청                       |

측정 조건 (`measurement-validity.md` §1): G2 (a) 의 기준값은 설치 RAC 가 그 값으로 렌더한 DOM 이다 (외부 oracle — Canvas 계산과 독립). 행렬의 불리한 경우 — locale `ko-KR` · `ja-JP` · `en-US`, 달력 체계 `buddhist`, 12 시 표기, granularity `second`, 시간대 포함 값, Min · Max 밖 값, 두 달에 걸친 범위, 보이는 달 밖의 값, 다중 선택, 값과 Placeholder 가 다른 달인 picker. G2 (b) 의 대조군은 같은 문서의 새 bind. 사람이 만든 문서가 필요한 지표는 없다 (분포 지표 0).

HIGH 위험 R1 → G2 (a), R2 → G2 (b), R3 → G1 (c), R8 → G1 (e). 집행은 로컬 테스트 스위트 + `pnpm type-check` (Stop hook) + live 이다.

## Consequences

### Positive

- 날짜 계열 6종이 다른 필드처럼 「놓고 Value 칸에서 고르기」 로 값을 갖는다 — Value 구획에서 값 칸이 없는 필드가 없어진다.
- Canvas 가 값 · 선택 칸 · 보이는 달을 Preview 와 같게 그린다. 변수에 묶인 값 (「검색 추가」 의 DatePicker) 도 Canvas 에 기본값이 보인다.
- Min · Max · Placeholder value 를 날짜 입력으로 고른다 (형식을 외워 적지 않는다).
- 날짜 글자를 읽는 함수가 넷에서 하나가 된다.
- Code 보기에 레퍼런스 코드 모양 (`defaultValue={parseDate('2026-11-12')}`) 이 나온다.

### Negative

- Canvas 가 재현할 RAC 동작이 늘어난다 (값 글자 · 선택 칸) — 설치 RAC 를 올릴 때 G2 (a) 행렬을 다시 돌려야 한다.
- 값 형 2 · 칸 종류 4 가 늘어난다 (패널 renderer · AI 편집 manifest · 검증이 함께 받는다).
- 상대 날짜 (「오늘」) 는 이번 범위에 없다 (사용자 결정 3 의 권고대로면).
