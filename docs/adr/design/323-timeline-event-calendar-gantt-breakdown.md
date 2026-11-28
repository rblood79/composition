# ADR-323 breakdown — Timeline · Event Calendar · Gantt

> 결정: [ADR-323](../323-timeline-event-calendar-gantt.md). 경로 약칭 `S/` = `packages/shared/src/`, `R/` = `packages/rendering/src/`.

## 1. 범위 · 출처

- 사용자 요청 2026-11-26 — ReUI 비교 보고 뒤 `/create-adr`, 「Timeline · Event Calendar · Gantt」 묶음. D1 처리 = 「목록 · 표가 조작 정본」 (같은 날 답).
- 범위: 날짜 축 역할과 기하 모듈 둘 · `Timeline` · `EventCalendar` · Table 의 시간축 열 (Gantt) · 쓰기 · 실행 상태 · 닫힌 D1 예외.
- 범위 밖: Chart 의 Calendar Heatmap (그대로) · 날짜 고르기 Calendar (그대로) · 공정 계산 (자동 일정 · critical path).
- 조사 근거: ReUI registry 소스 셋 · FullCalendar · react-big-calendar · Schedule-X · frappe-gantt · SVAR · dhtmlxGantt · Bryntum · MUI · Ant Design 문서 · APG · 설치본 RAC · 저장소 코드.

## 2. 대조 표

### 2.1 Timeline

| 항목        | ReUI                                                                    | MUI Lab · Ant Design                                 | 이 ADR                                                       |
| ----------- | ----------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| 구조        | 부품 8 (Item · Header · Date · Title · Indicator · Separator · Content) | 항목 + 표식 + 연결선 + 내용 (+ 반대쪽 내용)          | `Timeline` > `TimelineItem` (표식 · 선 · 날짜 · 제목 · 내용) |
| 자료        | JSX 조립                                                                | AntD `items`                                         | 자식 노드 또는 연결된 행마다 반복                            |
| 방향        | `orientation` vertical · horizontal                                     | AntD `orientation`                                   | 같음                                                         |
| 배치        | 예제만 (prop 없음)                                                      | MUI `position` left · right · alternate, AntD `mode` | 한쪽 (앞 · 뒤) · 번갈아                                      |
| 진행 · 상태 | `value` (step 이하 = 완료)                                              | AntD 항목 `color` · `loading`                        | 사용자 결정 1 (항목마다 상태)                                |
| DOM · 조작  | role 없는 `div`, 조작 0                                                 | 조작 0                                               | 순서 목록 구조, 조작 0                                       |

### 2.2 Event Calendar

| 항목      | ReUI                                                                                         | FullCalendar · 그 밖                                     | 이 ADR                                                    |
| --------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| 일정 형식 | `id` · `title` · `start` · `end` (exclusive) · `allDay` · `color` · `resourceId` · 반복 rule | 같은 뼈대 (`groupId` · `extendedProps`), rbc 는 accessor | 역할 — 시작 · 끝 (exclusive) · 종일 · 이름 · 색 · 자원    |
| 보기      | month · week · day · days · agenda · resource                                                | Month · TimeGrid · List · Multi-Month (자원은 유료)      | 월 · 주 · 일 · 일정 목록 + 사용자 결정 2                  |
| 반복      | 구조 rule · RRULE (건당 1,000 회 상한)                                                       | RRule plugin                                             | 사용자 결정 4 (행 하나 = 한 건 권고)                      |
| 시간대    | `timeZone` (IANA)                                                                            | 설정                                                     | 사용자 결정 7                                             |
| 격자 설정 | `dayStartHour/EndHour` · `slotDuration` 30 · `snapDuration` 15                               | 비슷                                                     | 하루 시작 · 끝 · 칸 · 끌기 단위 (결정 8)                  |
| 조작      | 끌어 옮기기 · 길이 조절 · 끌어 만들기 · 빈 칸 누르기                                         | 같음                                                     | 같음 (포인터) + 편집 Dialog (키보드)                      |
| 편집 화면 | 내장 없음                                                                                    | 내장 없음                                                | 행 편집 폼 (ADR-289)                                      |
| 접근성    | 월만 `grid`, 일정은 `aria-label` · `aria-pressed`, 키로 옮기기 확인 안 됨                    | Tab focus · list 보기                                    | 월 = RAC Calendar, 일정 = RAC Button, 목록 = RAC GridList |
| 가상화    | 없음                                                                                         | —                                                        | 보이는 기간만 계산                                        |

### 2.3 Gantt

| 항목      | ReUI                                               | frappe · SVAR · dhtmlx                                           | 이 ADR                                                |
| --------- | -------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| 작업 형식 | 일정 필드 + `progress` · `dependencies` · baseline | `start` · `end` 또는 `duration` · `progress` · `parent` · `type` | 역할 — 시작 · 끝 · 진행률 · 선행 (계층은 기존 역할)   |
| 의존      | 선행 id 목록 (끝 → 시작 · 그리기 전용)             | frappe 는 목록, dhtmlx · SVAR 는 link 행 4 종 · 지연             | 사용자 결정 6 (선행 key 목록 권고)                    |
| scale     | day · week · month · quarter · year, zoom 0.5 ~ 3  | Day · Week · Month · Year                                        | 다섯 + 확대                                           |
| 묶음      | `children` 있는 행, 요약 막대, 접기                | `parent` · `open`                                                | Table 의 계층 행 · 펼침                               |
| 조작      | 가로 이동 · 길이 · 끌어 만들기 · 행 재정렬         | 같음 (+ 자동 일정은 유료)                                        | 막대 끌기 · 길이 · 진행률 (포인터) + 칸 편집 (키보드) |
| 접근성    | role 없음, 막대 `button`                           | dhtmlx: 표 `treegrid` · 막대 `role="img"`                        | RAC Table (계층 행) + 칸 안 RAC Button                |
| 가상화    | 없음                                               | SVAR · dhtmlx 있음                                               | Table 의 행 창 + 보이는 기간만                        |
| 하지 않음 | —                                                  | 자동 일정 · critical path · baseline · 자원                      | 넷 다 넣지 않는다                                     |

## 3. 지금 있는 기구

- 월 격자: RAC `Calendar` 의 DOM renderer (`S/catalog/runtime/domBinding.runtime.ts:2104`) 와 Canvas 의 달력 모델 (`S/catalog/runtime/calendarModel.ts`), `CalendarCell` template 이 자식을 그린다 (`S/catalog/bindings/CalendarCell.binding.ts:3-9`).
- 날짜 유틸: `@internationalized/date` (`startOfWeek` · `getWeeksInMonth` · `getDayOfWeek` · `DateFormatter` — `calendarModel.ts:23-40`).
- 지역 prop: `locale` · `firstDayOfWeek` · `calendarSystem` (`S/catalog/bindings/dateLocaleProps.ts`).
- 공용 기하 선례: `R/chart/computeChartScene.ts:318` · `R/chart/model.ts:200`, Canvas primitive `chart_scene` (`R/renderers/skiaPrimitives.ts`).
- 계층 행 · 펼침 · 가상 스크롤 · 열 고정 · 칸 편집: Table (ADR-315 · 317).
- 쓰기: `updateMany` (`S/catalog/runtime/catalogPreviewSession.ts:1534`), 한 필드 쓰기 `update.field`.
- 포인터 끌기 선례: `S/catalog/runtime/resizable.components.tsx` (`useMove` · pointer capture).
- 행 편집 폼: ADR-289.

## 4. D1 — 조작 정본과 닫힌 예외 (정본)

### 4.1 RAC 가 맡는 것 (예외 아님)

| 자리                                  | RAC 부품                                       | 조작                                                  |
| ------------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| 월 보기                               | `Calendar` > `CalendarGrid` > `CalendarCell`   | 날짜 키 이동 · 날짜 고르기 (그 날의 일정 목록이 열림) |
| 그 날의 일정 · 일정 목록              | `Popover` > `Dialog` > `GridList`, `GridList`  | 일정 고르기 · 열기                                    |
| 주 · 일 보기의 일정                   | `Group` (날 열 — `aria-label` prop) > `Button` | Tab 으로 시간 순서 · Enter 로 편집 열기               |
| 편집                                  | `Dialog` > `Form` > 날짜 · 시간 필드           | 날짜 바꾸기 · 만들기 · 지우기                         |
| 머리 (이전 · 다음 · 오늘 · 보기 전환) | `Button` · `ToggleButtonGroup`                 | 기간 이동 · 보기 바꾸기                               |
| 머리의 「일정 만들기」                | `Button`                                       | 새 일정 폼 열기 (일정이 없는 기간의 키보드 진입점)    |
| Gantt 의 작업 표                      | `Table` (계층 행)                              | 행 이동 · 펼침 · 정렬 · 칸 편집                       |
| Gantt 의 막대                         | 시간축 칸 안의 `Button`                        | Enter 로 편집 열기                                    |
| 알림                                  | react-aria `announce`                          | 끌기 · 편집 결과                                      |

### 4.2 닫힌 D1 예외 (사용자 답 2026-11-26)

1. **장식 층의 숨김 속성** — 눈금선 · 현재 시각 선 · 의존선 · 주말 음영을 담는 요소에 `aria-hidden="true"`. 그 층에는 글자와 누르는 요소를 두지 않는다.
2. **포인터 끌기** — 일정 Button · 막대 Button 과 그 양 끝의 잡는 영역, 진행률 손잡이, 시간 격자 · 시간축의 빈 자리에서: `useMove` 의 포인터 handler 와 pointerdown 의 pointer capture. 요소에는 키 handler 를 붙이지 않는다 (`useMove` 의 키 handler 는 화살표를 삼키므로 쓰지 않는다 — ADR-318 과 같다). 끌기의 취소: 끄는 동안 (pointerdown ~ pointerup · pointercancel) 에만 owner document 에 `keydown` listener 하나를 두고 Escape 를 받으면 요소의 style 을 원래대로 돌리고 pointer capture 를 풀고 그 끌기의 놓기를 무시한다 — 쓰기 0 · When 0 · `announce` 「취소됨」. 다른 키는 읽지 않고 막지도 않는다. 끌기가 끝나면 listener 를 뗀다 (`useMove` 는 포인터의 이동 · 해제 · 취소만 구독한다 — `react-aria/dist/private/interactions/useMove.mjs:161-215`). `pointercancel` 도 같은 취소다. **Phase 0 P4 로 정한 세부 (2026-11-28)**: (a) listener 는 document 의 capture 단계에 둔다 — 끄는 동안의 Escape 는 그 끌기의 것이라 전파를 막는다 (막지 않으면 일정표를 담은 Modal Dialog 가 같이 닫힌다 — Chrome · WebKit 재현). 끄지 않을 때 · 다른 키는 그대로다. (b) pointer capture 는 RAC Button 의 pointerdown 처리가 끝난 뒤에 잡는다 — `usePress` 가 같은 pointerdown 에서 capture 를 푼다 (`react-aria/dist/private/interactions/usePress.mjs:355-361`, 바로 잡으면 capture 없는 대조군과 같아 iframe 위에서 놓은 끌기가 끝나지 않는다). (c) 끌기 없이 놓은 누르기도 listener 를 뗀다 (`useMove` 는 움직임이 없으면 끝을 부르지 않는다) — pointerup · pointercancel 에서, `useMove` 의 window listener 뒤에.
3. **확대** — Gantt 시간축 영역의 Ctrl / Cmd + wheel.

그대로 두는 것: 월 격자의 DOM 과 키, Table 의 DOM 과 키, Button · Dialog · GridList 의 계약, focus 순서 (문서 순서). 이 목록을 넘는 구현은 규칙 위반이다 — 대조 게이트는 `adr318D1List.static.test.ts` 와 같은 방식의 정적 테스트 (G5 · G7). RAC 가 일정표나 Gantt 를 내면 이 예외를 지운다.

## 5. 설계

### 5.1 날짜 축 역할 (Phase 1)

| 역할      | 필드 종류           | 쓰는 컴포넌트                    |
| --------- | ------------------- | -------------------------------- |
| 시작      | date                | Timeline · EventCalendar · Gantt |
| 끝        | date (exclusive)    | EventCalendar · Gantt            |
| 종일      | boolean             | EventCalendar                    |
| 이름      | text                | 셋 다                            |
| 색 · 상태 | text                | 셋 다                            |
| 자원      | text 또는 reference | EventCalendar (결정 2)           |
| 진행률    | number (0 ~ 100)    | Gantt                            |
| 선행      | array (행 key)      | Gantt (결정 6)                   |

- 역할 표는 한 곳이고 세 컴포넌트가 거기서 읽는다 (R6). 계층은 기존 `children` · `parentId` 역할이다.
- 끝이 없는 행: Timeline 은 시작만 쓰고, EventCalendar 는 기본 길이 (칸 하나), Gantt 는 마일스톤으로 그린다.
- 날만 있는 값 (정밀도 `date`) 은 종일로 읽는다 — 시작 날 00:00 부터 끝 날 00:00 까지 (끝 날 exclusive, 끝이 없으면 시작 날 하루), 컴포넌트의 시간대에서.
- **실제 끝** = 끝 값, 없으면 시작 + 기본 길이. 조회 · 기하 · 쓰기가 같은 함수 하나를 읽는다.

### 5.2 기하 모듈 둘 (Phase 1, lazy)

- **시간 격자** — 입력: 보이는 기간 · 하루 시작 / 끝 · 칸 길이 · 일정 목록 (시작 · 끝 · 종일 · 자원) · 시간대. 출력: 일정마다 rect (날 열 · 위 · 높이 · 겹침 안의 칸 번호와 폭), 종일 행의 띠 (줄 번호 · 시작 열 · 길이), 월 격자의 칸마다 보일 일정과 「+N」.
- **날짜 축 막대** — 입력: 보이는 기간 · scale · 확대 · 행 목록 (시작 · 끝 · 진행률 · 계층 · 선행). 출력: 눈금 (큰 단 · 작은 단), 행마다 막대 rect · 진행률 폭 · 마일스톤 · 요약 막대 (자식 범위), 의존선의 꺾은 점 목록과 어긋남 여부.
- 둘 다 순수 함수이고 `R/` 에 둔다 — Canvas primitive 와 DOM 컴포넌트가 같은 출력을 읽는다. 첫 화면 모듈은 값으로 import 하지 않는다 (정적 게이트 — 선례 `tableStateQueryImports.static.test.ts`).
- 보이는 기간 밖의 일정 · 막대는 계산하지 않는다.

### 5.3 Timeline (Phase 2)

- `Timeline` (팔레트 data 범주) > `TimelineItem`. 연결하면 행마다 항목 template 이 반복된다.
- 부품: 표식 (점 또는 아이콘) · 연결선 (마지막 항목에는 없다) · 날짜 Text · 제목 Text · 내용 (자유 내용 host).
- prop: `orientation` (vertical · horizontal) · 배치 (start · end · alternate) · `size` · (결정 1) 항목의 상태.
- DOM: `ol` > `li`, 날짜는 `time`. 조작 없음.

### 5.4 Event Calendar (Phase 3 ~ 5)

- `EventCalendar` (팔레트 data 범주). 부품: 머리 (이전 · 다음 · 오늘 Button · 기간 제목 · 보기 전환) · 본문 · 일정 template (반복).
- prop: 시작 보기 · 시작 날짜 (비면 오늘) · 하루 시작 / 끝 · 칸 길이 · 끌기 단위 (결정 8) · 주말 표시 · 월 칸의 최대 줄 수 · `locale` · `firstDayOfWeek` · `calendarSystem` · `timeZone` (결정 7) · `isReadOnly`.
- 보이는 기간의 행만 읽는다 (§5.4.1).
- 월 보기: 칸 안에 날짜 숫자와 일정 글자. 여러 날 일정은 줄 번호를 맞춘 띠 조각으로 칸마다 그린다. 날짜를 고르면 그 날의 일정 목록이 Popover 로 열린다. **칸의 낭독 이름은 RAC 의 날짜 이름뿐이다 (Phase 0 P1 no-go 로 바꾼 방식)** — `useCalendarCell` 이 칸 button 에 날짜 `aria-label` 을 붙이고 (`react-aria/dist/private/calendar/useCalendarCell.mjs:264-271`) RAC `CalendarCell` 에 aria prop 통로가 없어, 칸 안 일정 글자는 보이기만 하고 낭독되지 않는다. 낭독기 사용자가 일정에 닿는 길은 날짜 고르기 → 그 날의 목록 (GridList) 과 일정 목록 보기다. 일정 수를 칸 이름에 싣는 것은 D1 예외를 넓히는 일이라 (결정 지점 3) 하지 않았다.
- 주 · 일 보기: 날 열 `Group` 안에 일정 `Button` 이 기하의 rect 에 놓인다. DOM 순서는 시작 시각 순이다.
- 일정 목록 보기: 날짜별 구획의 `GridList`.
- 편집: 일정을 열면 행 편집 폼 Dialog (ADR-289 — 적용 범위는 Phase 0 에서 확인).
- 만들기: 새 일정 폼 (같은 행 편집 폼의 새 행 모드) 은 컴포넌트가 연다. 진입점 셋 — 머리의 「일정 만들기」 Button (기간 = 보이는 기간의 첫 날 · 하루 시작 시각부터 칸 하나, 일 보기는 그 날), 빈 자리 누르기 (누른 칸), 끌어 만들기 (끈 범위). 폼 안의 날짜 · 시간 필드로 기간을 고친다. When 「빈 자리 선택」 은 빈 자리 누르기 · 끌어 만들기에 같이 실행된다 (작성자가 다른 동작을 더할 수 있다 — 폼을 여는 데 규칙이 필요하지 않다). `isReadOnly` 면 Button 이 없고 빈 자리가 반응하지 않는다.
- 실행 상태: 보기 종류 · 기준 날짜 (이름 붙인 상태 둘). When 「일정 변경」 · 「빈 자리 선택」 · 「기간 변경」. Do 「보기 바꾸기」 · 「날짜로 이동」 · 「오늘」.

#### 5.4.1 보이는 기간의 조회

- **겹침 계약** — 창 `[ws, we)` 에 드는 일정 = `시작 < we` 그리고 `실제 끝 > ws` (§5.1 의 실제 끝). 한 날짜 필드의 `between` 은 쓰지 않는다 — 11-23 ~ 11-30 창에서 11-21 ~ 12-02 일정은 시작도 끝도 창 밖이라 빠지고, 양 끝 포함이라 11-30 에 시작하는 일정이 든다.
- **조회 조건 (일 단위 상위집합)** — 실행 상태가 보기의 `where` 에 「그리고」 로 붙인다 (표 상태의 번역과 같은 자리). 날짜 비교가 일 단위이고 (`S/collections/view/comparison.ts:441-455`) 값의 날은 저장된 글자의 날이다 (`viewDay` — 시간대 변환 없음, 오프셋은 저장 때 보존된다). 저장 값의 오프셋은 −12:00 ~ +14:00 이고 보는 시간대도 그 범위라, 같은 순간의 글자의 날과 보는 날은 **이틀** 까지 다르다 (26 시간). 예: 표시 `Pacific/Kiritimati` (+14:00) 의 11-23 00:15 = 저장 `2026-11-21T22:15:00-12:00` — 글자의 날 11-21. 그래서 받는 날의 범위는 `[ws 의 날 − 2, we 의 날 + 2]` (양 끝 포함) 이다. 서버가 그 날 값을 어느 시간대의 날로 읽든 같은 범위 안이다. 날짜 종류의 비교는 `before` · `after` (끝 제외) 와 `between` (양 끝 포함) 뿐이므로:
  - 끝 역할이 있는 구성: `시작 before (we 의 날 + 3)` 그리고 ( `끝 after (ws 의 날 − 3)` 또는 ( `끝 notExists` 그리고 `시작 after (ws 의 날 − 3 − 기본 길이의 날 수)` ) ).
  - 끝 역할이 없는 구성 (Timeline · 시작만 쓰는 일정): `시작 between [ws 의 날 − 2 − 기본 길이의 날 수, we 의 날 + 2]`.
  - 여유 (이틀) 는 상수 하나이고 조건을 만드는 함수와 G3 의 정답표가 같이 읽는다.
- **정밀 거르기** — 받은 행에 겹침 계약을 정확한 시각 (컴포넌트 시간대의 순간) 으로 다시 적용한 뒤 기하 모듈에 넘긴다. 상위집합의 여분 (이틀 여유 · 창 끝 날의 일정) 이 여기서 빠진다.
- **서버 요청** — 창 조회는 쪽 단위가 아니다: 조건으로 줄인 결과의 모든 쪽을 상한 (`VIEW_LOCAL_LOAD_CAP` 10,000) 까지 이어 받는다.

| 범위의 행                      | 보내는 조건                                                            | 누락 없는 근거                                                       |
| ------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 로컬 · 전량 로드               | 없음 (로컬에서 상위집합 → 정밀 거르기)                                 | 전량                                                                 |
| 원격 · `body`                  | 상위집합 조건 전부 (「또는」 묶음 포함)                                | 조건이 계약의 상위집합                                               |
| 원격 · `suffix` (끝 없음 구성) | `시작` 의 `gte` · `lte` (접미사 표에 둘 다 있을 때 — 없으면 전량 로드) | 「그리고」 뿐이라 실린다                                             |
| 원격 · `suffix` (끝 있음 구성) | 보내지 않는다 — 상한 안에서 전량 로드                                  | 「또는」 을 못 실어 (`OR_GROUP`) 끝이 빈 행이 빠지므로 줄이지 않는다 |
| 원격 · 형식 선언 없음          | 보내지 않는다 — 상한 안에서 전량 로드                                  | 전량                                                                 |

- 상한을 넘으면 일정표는 일정을 그리지 않고 사유를 알린다 (지금의 `refuseView` 와 같은 길 — `S/catalog/runtime/catalogPreviewSession.ts:2070-2110`). 일부만 그리지 않는다.
- Gantt 는 Table 의 행 조회 그대로다 (창으로 행을 줄이지 않는다 — 보이는 기간은 막대를 그리는 범위일 뿐).

### 5.5 Gantt — Table 의 시간축 열 (Phase 6 ~ 7)

- Column 의 새 종류 「시간축」 — 한 Table 에 하나. 그 열의 설정: 역할 (시작 · 끝 · 진행률 · 선행) · scale · 시작 기간 · 확대 · 주말 음영 · 오늘 선.
- 열의 머리글 = 날짜 눈금 (두 단). 열의 칸 = 그 행의 막대 Button (이름 = 「작업 이름, 시작 ~ 끝, 진행률」). 묶음 행의 칸 = 요약 막대.
- 열은 가로로 넓고 Table 의 가로 스크롤을 탄다. 작업 열은 앞에 고정한다 (기존 열 고정).
- 의존선은 열 영역 위의 장식 층이다 (§4.2-1). 보이는 행 창 안의 두 끝이 모두 있을 때만 그리고, 한쪽이 창 밖이면 창 가장자리까지 그린다.
- 편집: 막대를 열면 행 편집 폼, 표의 시작 · 끝 열이 「Editable」 이면 칸에서 고친다. 포인터로는 막대를 끌어 옮기고 양 끝과 진행률 손잡이를 끈다.
- 팔레트 「Gantt」 (결정 5 가 「Table 의 구성」 일 때): Table 을 작업 열 + 시작 + 끝 + 시간축 열 구성으로 놓는다.
- 실행 상태: scale · 보이는 기간 · 확대 — 표 상태의 열 조각 옆에 둔다 (「Remember state」 가 기억).

### 5.6 쓰기 · 끌기

- 끌기 중에는 요소의 style 만 바꾼다. 놓을 때 쓰기 한 번 (시작 · 끝 또는 진행률) — 편집 기록 한 건.
- **전부 아니면 전무** — 기간 쓰기는 세션 쓰기의 새 방식으로 한다 (`updateMany` 의 옵션): 놓는 시점에 그 쓰기 안에서 대상 key 와 모든 필드를 판정하고 (`itemFields` 의 판정 그대로 — 없는 행 · key 필드 · schema 에 없는 필드 · 계산 필드 · 읽지 못한 값) 거절이 하나라도 있으면 아무것도 쓰지 않고 `ok: false` 와 사유를 돌려준다. 편집 기록 0. 옵션 없는 `updateMany` 의 부분 쓰기 (붙여넣기 · 채우기) 는 그대로다 (`S/catalog/runtime/catalogPreviewSession.ts:1541-1588`).
- 편집 Dialog 의 저장도 같은 쓰기를 쓴다 — 시작만 저장되고 끝이 거절되는 일이 없다.
- When 「일정 변경」 과 성공 알림은 `ok: true` 뒤에만 실행한다. 거절이면 요소가 원래 자리로 돌아가고 사유를 `announce` 와 화면 알림으로 낸다.
- 값은 단위 (결정 8) 에 맞춘다. 시작이 끝보다 늦어지는 길이 조절은 한 단위에서 멈춘다.
- 읽기 전용 (`isReadOnly` · 편집할 수 없는 필드 · 계산 필드) 이면 끌기가 시작되지 않는다. 끌기를 시작한 뒤에 상태가 바뀐 경우 (필드가 지워짐 · 읽기 전용으로 바뀜 · 행이 지워짐) 는 위의 판정이 놓는 시점에 막는다.
- 취소: 끌기 중 Escape · `pointercancel` (§4.2-2) — 원래 자리 · 쓰기 0 · When 0.
- 놓은 뒤 「이름, 새 시작 ~ 새 끝」 을 `announce` 로 알린다.

### 5.7 Canvas

- Timeline: 항목의 배치 · 표식 · 선.
- EventCalendar: 시작 보기 · 기준 날짜 (비면 달력 모델의 기준 날짜) 에서 표본 행의 일정을 기하 모듈로 그린다.
- Gantt: Table 그리기에 시간축 열의 눈금 · 막대 · 요약 · 의존선을 더한다.
- 보기 전환 · 끌기 · 열린 Dialog 는 그리지 않는다.

## 6. Phase

| Phase | 내용                                                                                                                                                 | Gate |
| :---: | ---------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
|   0   | 코드 사실 재대조 · v3 확인 · ADR-289 적용 범위 · 시제품 4 · 번들 · 속도 기준선                                                                       |  G0  |
|   1   | 날짜 축 역할 표 · 기하 모듈 둘 · 시간대 (결정 7) · import 게이트                                                                                     |  G1  |
|   2   | Timeline — 등록 · 정적 · 행 반복 · 상태 (결정 1) · contract                                                                                          |  G2  |
|   3   | EventCalendar — 등록 · 머리 · 월 보기 · 일정 목록 보기 · 보이는 기간 조회 (겹침 계약 · 상위집합 · 정밀 거르기) · 반복 (결정 4)                       |  G3  |
|   4   | EventCalendar — 주 · 일 보기 (· 결정 2 의 보기) · 일정 Button · 편집 Dialog · 「일정 만들기」 와 새 일정 폼 · 일정 목록 같이 보기 (결정 3)           |  G4  |
|   5   | EventCalendar — 포인터 끌기 (옮기기 · 길이 · 만들기 · Escape 취소) · 전부 아니면 전무 쓰기 · When · Do · 이름 붙인 상태 · 규칙 문서의 승인 가리킴 줄 |  G5  |
|   6   | Gantt — 시간축 열 (눈금 · 막대 · 요약 · 마일스톤 · 오늘 선 · 주말 음영) · Canvas · 팔레트 (결정 5)                                                   |  G6  |
|   7   | Gantt — 의존선 (결정 6) · 진행률 · 막대 끌기 · 확대 · 실행 상태 기억                                                                                 |  G7  |
|   8   | 속도 측정 · 번들 · D1 목록 전문을 규칙 문서로 · 종결 live · 문서 (CHANGELOG)                                                                         |  G8  |

컴포넌트 단위로 닫는다 — Phase 2 끝에 Timeline, Phase 5 끝에 Event Calendar, Phase 7 끝에 Gantt 가 각각 쓸 수 있는 상태다.

## 7. Phase 0 시제품

| ID  | 확인할 것                                                                                                                                 | go 기준                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | 월 칸 안의 일정 글자 — RAC `CalendarCell` 자식으로 넣었을 때 칸의 낭독 이름에 실리는지, 날짜 키 이동이 그대로인지                         | 접근성 트리에서 칸 이름에 일정 글자 · 키 이동 무변경                                                                                                                                                 |
| P2  | 주 보기 겹침 — 한 주 200 건 (같은 시각 20 건 겹침) 의 기하 계산 시간과 Button 200 개의 첫 표시 · 주 넘기기 frame                          | 계산이 한 프레임 안 · 넘기기 p95 ≤ 16.7 ms (1x)                                                                                                                                                      |
| P3  | Table 시간축 열 — 5,000 행 · 넓은 열 하나 · 칸 안 Button, 세로 스크롤 frame 과 가로 스크롤, 열 고정과의 겹침, 칸 안 Button 으로의 키 이동 | 세로 스크롤이 시간축 열 없는 Table 기준선 안 · 키로 막대에 닿음                                                                                                                                      |
| P4  | 끌기 — `useMove` 포인터 handler 만 붙인 Button 의 옮기기 · 양 끝 길이 조절, 스크롤 영역 가장자리 · iframe 위에서 놓기 (pointer capture)   | Chrome · WebKit 에서 끌기가 끊기지 않고 Button 의 press 와 구분됨 · 끌기 중 Escape 가 document listener 에 닿고 그 뒤의 놓기가 무시됨 (열린 Dialog · Popover 가 Escape 를 먼저 가져가지 않는지 포함) |

## 8. 파일 추정 (Phase 0 에서 확정)

| 자리                    | 파일                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 기하 (rendering, lazy)  | 새 `R/schedule/timeGrid.ts` · `R/schedule/dateAxis.ts` · Canvas primitive (`R/renderers/skiaPrimitives.ts`)                                                                                                                                                                                                                                     |
| 역할 · 데이터 (shared)  | 새 `S/collections/dateAxisRoles.ts` · `S/collections/resolveCollectionItems.ts` · 보이는 기간 조회 (`S/catalog/runtime/` — 상위집합 조건 · 정밀 거르기) · `S/catalog/runtime/catalogPreviewSession.ts` (전부 아니면 전무 쓰기)                                                                                                                  |
| 등록 (shared)           | 새 `bindings/Timeline.binding.ts` · `TimelineItem.binding.ts` · `EventCalendar.binding.ts` · `Column.binding.ts` (시간축) · `componentCatalog.ts` · `generated/componentRulesTable.ts` · `document/generated/reusableOriginLibrary.ts` · `document/types.ts` · `document/d2Provenance.ts` · `domain/componentTraits.ts`                         |
| 실행 (shared, lazy)     | 새 `runtime/timeline.components.tsx` · `runtime/eventCalendar.components.tsx` · `runtime/scheduleDrag.components.tsx` · `runtime/scheduleEditDialog.components.tsx` (Phase 0 — ADR-289 행 폼은 빌더 패널 전용이라 실행 화면에서 쓸 수 없다) · `runtime/tableTimelineColumn.components.tsx` · `runtime/tableTracks.ts` · `runtime/tableState.ts` |
| 상태 연동 (shared)      | 새 `interactions/concepts/schedule.ts` · `componentInteractionSpecs.ts`                                                                                                                                                                                                                                                                         |
| Canvas · 패널 (builder) | `catalogRuntime/canvasBinding.ts` · `paletteItems.ts` · 역할 편집기 · i18n                                                                                                                                                                                                                                                                      |
| 규칙                    | `.claude/rules/ssot-hierarchy.md` §1 D1 (Accepted 때 한 줄 · Phase 8 에 전문)                                                                                                                                                                                                                                                                   |

추정 shared 26 ~ 34 · rendering 4 ~ 6 · builder 8 ~ 12 파일 + 테스트.

## 9. Phase 결과

### Phase 0 (G0) — 2026-11-28 닫힘

HEAD `90b35a386` (ADR-322 종결 · 326 Proposed 위, worktree `autorun/adr-323`). 시제품 = `apps/builder/scripts/adr323Prototypes.mjs` (설치된 RAC 1.22.1 · react-aria 3.53.1 위의 작은 월 보기 · 주 보기 · Table 시간축 열 · 끌기 — 제품 코드 아님) + 하니스 `adr323-phase0-prototypes.mjs` (production lib build, headed Chrome · Playwright WebKit, 보이는 탭). 결과 원본은 로컬 `/private/tmp/adr323-p0/run3` · `run6` (커밋하지 않음).

**코드 사실 재대조 (F1 ~ F11)** — 설계에 닿는 차이 0, 줄 이동과 수치만:

- F1 RAC 1.22.1 `CalendarGrid` = `table` · `CalendarCell` = `td` (`role=gridcell`) 안 `div` (`role=button`) — 설치본 `react-aria-components/dist/private/Calendar.mjs:214` · `:279` · `:345`, role 은 `useCalendarCell.mjs` `:251` · `:264`. 칸 button 의 `aria-label` = 날짜 이름 (`:264-271`, P1 의 원인).
- F2 `CalendarGrid.binding.ts:40` · `calendarModel.ts:144` 그대로. F3 `computeChartScene.ts:318` · `model.ts:200` · `roles.ts:110-113` 그대로 · Chart 의 interaction spec 0.
- F4 `resolveCollectionItems.ts:266-274` (역할 키 `value` · `children` · `parentId`) 그대로 · `expandedKeys` `tableState.ts:54` → `:58`.
- F5 날짜 비교: `order` 가 시각만 있는 값 (`HH:MM` · 년 없는 객체) 은 시각으로, 날이 있는 값은 `viewDay` 로 비교한다 (`comparison.ts:439-456` — ADR-292 수리 `00b90f6cc` 가 시각 비교를 더함). 날짜 · 일시 값은 그대로 일 단위라 §5.4.1 의 상위집합 조회는 그대로다. `between` `:638-646` 그대로.
- F6 `updateMany` `:1534` → `:1794`, 부분 쓰기 `:1801-1845` (거절은 세고 나머지를 씀 · `ok: true`) 내용 그대로. `itemFields` `:1383`. 상한 거절 `refuseView` `:2070-2110` → `:2590-2690`. `VIEW_LOCAL_LOAD_CAP` = 10,000 (`collections/view/serialize.ts:53`).
- F7 `fieldMap` 역할 — `FIELD_ROLE_KEYS` 셋 + `disabled` · `unavailable` · `unavailableEnd` (`dataBinding.ts:450` · `:481`) 그대로, 날짜 축 역할 없음.
- F8 끌기 When 은 `concepts/collectionDragDrop.ts` 뿐 (concept 30 개 중) 그대로. F9 `useMove.mjs` — pointer listener `:196-198`, 화살표 키 handler `:207-230` 그대로.
- F10 ADR-289 행 폼 = **빌더 데이터 패널 전용** (`apps/builder/src/builder/panels/datatable/grid/RowForm.tsx` · `rowFormValues.ts` · `fieldDefault.ts` — 빌더 문서의 표를 고친다). 실행 화면 (Preview · Publish) 의 편집 Dialog 는 새로 만든다 (RAC `Dialog` > `Form` > 날짜 · 시간 필드, 쓰기는 세션 — Decision 4 · 7 그대로). 행 폼에서 가져오는 것은 어법뿐이다 — 필드 타입별 입력 · 필수 열 먼저. §8 에 파일 하나를 더했다.
- F11 contract **87** (79 에서 320 ~ 322 · 324 · 325 가 올림) · 번들 아래.

**v3**: `@adobe/react-spectrum` 3.47.7 (npm 최신 — `npm pack` 으로 받아 `dist` 검색) 에 Timeline · Gantt · EventCalendar · Scheduler 0 건 (같은 검색으로 `Calendar` · `RangeCalendar` export 는 잡힘 — 검색 유효), `@react-spectrum/timeline` · `gantt` · `eventcalendar` 는 npm 404. D2 정본 순서 4 (composition 확장) 확정.

| 시제품                                     | 결과                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 판정                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| P1 월 칸 안 일정 글자                      | 칸 (11-10, 일정 4 건 — 둘 + 「+2」) 의 이름 = 「2026년 11월 10일 화요일」 — 일정 글자 없음 (Chrome · WebKit, `aria-describedby` 없음). 원인은 RAC 가 칸 button 에 날짜 `aria-label` 을 붙이는 것 (F1) 이고 `CalendarCell` 은 aria prop 을 받지 않는다. 날짜 키 이동 (← → ↑ ↓ · PageUp/Down · Home/End 9 단계) 은 자식 없는 대조군과 같은 순서                                                                                                                                                                                                                                                                                                        | 칸 이름 = no-go → 방식을 바꿨다 (§5.4 월 보기 — 이름은 날짜만, 일정은 날짜 고르기 → 목록) · 키 이동 = go            |
| P2 주 보기 200 건 (20 건 겹침, Chrome)     | 겹침 기하 (`layoutWeek` — 덩어리마다 빈 첫 칸) 중앙 0.1 · 최대 0.2 ms (4x 0.8) · 겹침 20 건 = 칸 20 · Button 200 첫 표시 26.9 ms (4x 51.2). 넘기기 60 회 × 3: **작업 (클릭 → React commit → layout) p50 8.6 · p95 9.4 ms**, frame p95 18.2 = 빈 프레임 대조군 18.1 (이 기기의 rAF 간격 바닥 — 일 없는 프레임도 p95 18), LoAF 0. CPU 4x: 작업 p50 37.4 · p95 44.8 ms · frame p95 48 · LoAF 6 (최대 65). 측정 주의: 앞선 20 회 × 3 실행에서 1x 작업 p95 17.2 가 한 번 나왔다 (표본 20 의 p95 = 최대)                                                                                                                                                   | go (1x). 4x 는 넘기기 한 번에 2 ~ 3 프레임 — Phase 4 에서 일정 Button 의 key 재사용 · 보이는 시간대만 그리기를 본다 |
| P3 Table 시간축 열 5,000 행 (교대 3 쌍)    | 열 = 작업 (고정) · 시작 · 끝 · 담당 · 시간축 3,000 px (칸 안 RAC Button 막대 + 진행률 장식 `aria-hidden`). 세로 스크롤 frame p95 — 시간축 열 18.0 · 대조군 (같은 Table, 시간축 열 없음) 18.6 ms (4x 18.5 · 18.4), 가로 18.0 (4x 18.4), LoAF 0. 가로 1,500 px 스크롤 뒤 고정 열 자리 그대로 (TableLayout `isStickyColumn`, ADR-315 선례). 키: 담당 칸 → → = 막대 Button focus (RAC 칸의 child focus) · Enter = press · ↓ = 다음 행 막대 (Chrome · WebKit)                                                                                                                                                                                             | go                                                                                                                  |
| P4 끌기 · pointer capture · Escape (둘 다) | `useMove` 포인터 handler 만 붙인 RAC Button: 누르기 = press 1 · 쓰기 0 · 옮기기 +60 px = 15 분 단위 120 → 180 · 끝 길이 조절 +30 px · press 와 구분 (끌면 press 0) · focus 된 일정의 ↓ = 움직이지 않음. 끌기 중 Escape → 원래 자리 · 쓰기 0 · listener 0. iframe 위에서 놓기 — capture 있음 = 끌기 끝 · 놓은 뒤 움직임 무시, 대조군 (capture 없음) = 끌기가 끝나지 않음 (listener 남음). **발견 둘**: pointerdown 에서 바로 잡은 capture 는 RAC `usePress` 가 풀어 대조군과 같았다 (첫 실행) → 처리 뒤에 잡아 통과. Modal Dialog 안 끌기 중 Escape — listener (document capture 단계) 가 먼저 받지만 전파를 두면 Dialog 도 닫힘 → 막으면 Dialog 유지 | go — §4.2-2 의 세부 (a) · (b) · (c)                                                                                 |

**기준선**: initial gzip Builder **1,668,315** B · Preview 172,335 B (HEAD `90b35a386`, 배포와 같은 빌드 → `adr209-bundle-closure.mjs`). HEAD 가 이미 앞 상한 1,668,000 을 315 B 넘고 있었다 (ADR-322 종결 뒤 커밋들 — 배포 workflow 의 상한 단계가 막는 상태). 사용자 승인 (2026-11-27, 값 = Phase 0 의 HEAD 절대 실측 + 결정 9 몫) 대로 Builder 상한 = 1,668,315 + 5,000 = 1,673,315 이었으나 ADR-326 이 같은 기준선에서 몫 +3,685 (1,672,000) 를 먼저 올려, 두 몫을 합친 **1,677,000** 으로 정했다 (사용자 「권장대로」 2026-11-28 · `adr201-bundle-gate.mjs` · `deploy.yml` · CLAUDE.md · ADR-201 재승인 절 같은 값, 만료 2026-12-25 그대로). 323 의 Phase 는 1,668,315 와의 차이로 본다 (몫 Builder +5,000 · Preview +3,000). perf ratchet (`pnpm gate:perf-ratchet`): 이 worktree 에 하니스 로그인 세션 (`apps/builder/scripts/.auth-session.json`, gitignore 보호 파일) 이 없어 측정 실패 — 사본을 만들지 않았다. 323 의 속도 기준선은 위 P2 · P3 의 대조군 arm 이고 HC5 는 G8 에서 잰다.

**Phase 1 에 넘기는 것**: 기하 모듈 (`R/schedule/timeGrid.ts`) 의 겹침 칸 나누기는 시제품 `layoutDay` 의 방식 (시작 순 · 덩어리마다 빈 첫 칸 · 칸 수 = 폭) 을 정답표로 고정한다. contract 는 Phase 2 착수 때 `LIBRARY_CONTRACT_VERSION` 을 다시 본다 (지금 87).

### Phase 1 (G1) — 2026-11-28 닫힘

HEAD `a83fca226` 위 (worktree `autorun/adr-323`). 사용자 결정 7 = 「둘 다」 (컴포넌트 `timeZone`, 비면 브라우저).

**만든 것** (제품 코드 — 아직 어디서도 import 하지 않는다):

| 파일                                                               | 내용                                                                                                                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `S/collections/dateAxisRoles.ts`                                   | 역할 표 한 곳 (R6) — `start` · `end` · `allDay` · `title` · `color` · `resource` · `progress` · `predecessors`, 컴포넌트별 역할 · 필드 종류 · `fieldMap` id → 행 key. 의존 0 |
| `S/collections/scheduleSpan.ts`                                    | 시간대 (`resolveScheduleTimeZone`) · 값 읽기 · 「실제 끝」 (`readScheduleSpan`) · 겹침 계약 (`scheduleSpanOverlaps`)                                                         |
| `R/schedule/timeGrid.ts`                                           | 주 · 일 열 (겹침 칸 · 자정 자르기 · 보이는 시간 밖) · 종일 띠 · 월 칸 (`layoutScheduleDayBands` — 줄 배정 · 「+N」)                                                          |
| `R/schedule/dateAxis.ts`                                           | scale 다섯 · 두 단 눈금 · 주말 음영 · 막대 · 마일스톤 · 요약 (자식 범위) · 진행률 · 의존선 (끝 → 시작, 어긋남)                                                               |
| `S/catalog/runtime/__tests__/adr323ScheduleImports.static.test.ts` | G1 import 게이트 — shared · rendering · builder · publish 원본에서 기하 둘의 값 import 0 (허용 목록 `LAZY_READERS` 는 지금 비어 있다 — Phase 2 부터 lazy 모듈을 넣는다)      |

**내린 판단** (고른 것과 이유):

- **두 시계** — 시간대는 shared 의 읽기 한 곳에서만 다룬다. 값마다 instant (겹침 · 쓰기) 와 wall (그 시간대의 날짜 · 시각을 UTC 처럼 적은 ms — `instant + offset`) 을 같이 내고, 기하는 wall 만 받는다. 지역 자정이 하루의 배수라 기하는 UTC 산술로 날 · 시 · 달을 놓고 시간대를 모른다. 버린 접근: rendering 에 `@internationalized/date` 를 넣어 기하가 시간대를 받기 — rendering 의 시간 모듈은 외부 의존 0 원칙 (`chart/timeIntervals.ts` 머리말) 이고, rendering 은 shared 를 읽을 수 없다 (의존 방향).
- **일광 절약 전환일 = 시계 자리** — 열에서 일정은 wall 분으로 놓인다 (Google · FullCalendar 와 같다). 봄의 없는 시각 (02:00 ~ 03:00) 은 빈 칸으로 남고 01:30 ~ 03:30 일정은 실제 1 시간이지만 2 시간 높이다. 가을의 겹친 시각은 같은 자리에 겹친다 (한 시간짜리 01:30 → 01:30 = 최소 높이). 없는 지역 시각을 적은 값은 `compatible` (늦은 쪽 — 02:30 → 03:30) 로 읽는다. 날만 있는 값의 그 날은 25 시간 (가을) 이고, 자정이 없는 날 (America/Santiago 2026-09-06) 은 01:00 에 시작한다.
- **열 vs 띠** — 종일이거나 24 시간 이상인 일정은 종일 띠로 (`scheduleGridBanded`, Google 방식), 24 시간 미만이 자정을 넘으면 날마다 잘라 열에 둔다 (`continuesBefore` · `continuesAfter`). 보이는 시간 밖에 통째로 있는 조각은 그리지 않고 `hidden` (위 · 아래) 으로 돌려준다 — 조용히 버리지 않는다.
- **겹침 칸** — 시제품 `layoutDay` 그대로 (시작 순 · 같으면 긴 것 먼저 · key) 를 정답표로 고정. 판정은 그려지는 높이 (`minEventMinutes`, 기본 15) 로 한다 — 길이 0 · 5 분 일정이 겹쳐 보이는데 다른 칸이 되는 일이 없다.
- **월 칸의 「+N」** — 한 날의 일정이 `maxLines` 를 넘으면 그 날은 `maxLines − 1` 줄 + 「+N」. 여러 날 띠는 줄 번호를 지키며 숨는 날에서 끊기고 다음 날에 이어진다 (`continuesBefore`).
- **실제 끝** — 끝 값, 없으면 시각 값은 시작 + 기본 길이 · 날만 있는 값은 하루. 날만 있는 끝은 exclusive (HC8). 종일 역할이 켜진 시각 값은 날로 넓힌다 (끝이 날 중간이면 그 날 끝까지). 끝이 시작 날과 같은 종일 값은 하루 (Gantt 는 `keepZeroLength` 로 마일스톤). **끝이 시작보다 앞서면 거절** (`reversed`) — 그리지 않고 호출자가 센다 (Phase 3 의 상위집합 조회가 「끝 after」 로 그 행을 뺄 수 있어, 기본 길이로 살리면 조회와 그리기가 갈린다).
- **겹침 계약** — `start < 창 끝` 그리고 `end > 창 시작`, 길이 0 은 그 순간이 창 안일 때 (Decision 8). 조회의 여유 상수 (이틀) 와 조건 만들기는 그것을 쓰는 Phase 3 에서 같이 둔다.
- **날짜 축** — scale 의 한 칸은 늘 `unitWidth` px (31 일 달과 28 일 달이 같은 폭 — Gantt 머리글 칸) 이고 칸 안은 길이의 비율이다. 큰 단 = day · week → 달, month · quarter → 년, year → 없음. 창은 칸 단위로 넓힌다. 창 밖 x 는 첫 · 끝 칸의 비율로 이어서 낸다 (의존선 · 자른 막대의 진행률).
- **요약 막대** — 자식 (손자 포함) 의 범위, 자식에 기간이 하나도 없으면 자기 값. 진행률은 0 (가중 평균은 정하지 않았다 — Phase 7 에 닿으면 본다).
- **의존선** — 선행의 끝 → 후행의 시작 (결정 6 권고 형식을 입력으로 받는다 — 결정 6 은 Phase 7 에서 확정). 여유가 있으면 꺾은선 4 점, 없으면 행 경계로 돌아가는 6 점. 어긋남 = 후행 시작 < 선행 끝 (시각 비교 — px 아님). 행 목록에 없는 key 는 건너뛴다.

**검사**:

- 정답표 (손으로 쓴 분 · px · 순간 — 모듈 출력으로 채점하지 않음): rendering `schedule/__tests__/timeGrid.test.ts` 8 · `dateAxis.test.ts` 6, shared `collections/__tests__/scheduleSpan.test.ts` 14 (날짜변경선 둘 = G3 의 경계 값 · 뉴욕 봄 · 가을 전환일 → 시간 격자 · Santiago 없는 자정) · `dateAxisRoles.test.ts` 3, 게이트 3.
- 원복 RED 6 / 6 (`/tmp/adr323-p1/red.sh` — 바이트 복원 `cmp` 확인): 첫 화면 barrel 에 `export * from "./schedule/timeGrid"` → 게이트 · 겹침 칸 `<=` → `<` · 「+N」 한도 제거 · 칸 안 비율 → 일 단위 선형 · 날만 있는 끝 exclusive 제거 · wall 에서 offset 제거.
- 회귀: `pnpm type-check` 6 / 6 · rendering 1,829 · shared 3,077 전량 통과. `pnpm codex:preflight` — guard · format · typecheck · registration · agent-catalog 통과, **rule-size 실패는 HEAD 그대로** (`canvas-rendering.md` 55,244 > 55,100 · `panel-structure.md` 39,913 > 39,624 — 이 Phase 가 건드리지 않은 파일).
- 번들: 새 모듈을 아무도 import 하지 않는다 (게이트) — initial Δ 0.
- live (chrome-autorun, dev `5174`): Builder 첫 화면 리소스에 schedule 모듈 요청 0 · 콘솔 오류 0. 같은 페이지에서 모듈을 동적 import 해 실제 Chrome (Intl · ICU) 으로 실행 — 브라우저 시간대 `Asia/Seoul` · 컴포넌트 `America/New_York` 그대로 · 모르는 이름 → 브라우저 · 뉴욕 봄 전환일 01:30 ~ 03:30 = 06:30Z ~ 07:30Z 의 열 자리 top 90 · height 120 · Kiritimati 경계 값 wall 11-23 00:05 · Santiago 04:00Z · 날짜 축 day scale 폭 150 · 달 경계 90 / 60 · 주말 0 ~ 60 — 정답표와 같다.

#### Phase 1 판독 수리 — 2026-11-28

codex 판독 (`review-phase-1.json`) HIGH 7 — 7 건 모두 재현되는 결함이라 **fixed**. 기하 입력에 선택 필드 `startInstant` · `endInstant` (값의 순간, 둘 다 주거나 둘 다 생략) 를 더했다 — 자리는 wall, **순서 · 길이는 순간**. rendering 은 여전히 시간대를 모른다 (`readScheduleSpan` 의 `start` · `end` 를 그대로 넘긴다).

| #   | 지적                                                               | 처리 · root cause                                                                                                                                                             |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 종일 역할에서 끝 < 시작이 정상 일정으로 읽힘                       | fixed — 날로 넓힌 뒤에 순서를 봤다. 넓히기 전에 순간으로 비교 (`scheduleSpan.ts`)                                                                                             |
| 2   | 날만 있는 Gantt 작업의 끝 없음 = 마일스톤 불가                     | fixed — 끝 없음은 늘 하루였다. `keepZeroLength` 면 끝 없음도 길이 0 (§5.1 「Gantt 는 마일스톤」)                                                                              |
| 3   | Gantt 순서를 wall 로 판정 — 가을 겹친 시각에 막대 소실 · 거짓 위반 | fixed — 막대 유효 · 마일스톤 · 의존선 위반을 순간으로. wall 끝이 시작보다 앞서면 자리는 시작에 붙인다 (폭 0 작업 — 시간 격자가 같은 경우를 최소 높이로 그리는 것과 같은 결정) |
| 4   | 24 시간 기준을 wall 차이로 — 봄 전환 밤의 23 시간이 띠로           | fixed — `scheduleGridBanded` 가 순간이 있으면 실제 길이로 (없으면 wall)                                                                                                       |
| 5   | 월 칸 「+N」 — 앞 날의 줄 번호를 그대로 한도와 비교                | fixed — 줄 번호가 그 날 한도를 넘는 날은 한도 안의 빈 줄로 옮긴다 (앞 날의 줄이 비면 그 줄). 띠가 한 행 안에서 줄을 바꿀 수 있다 — 빈 줄 옆 「+N」 보다 낫다고 판단           |
| 6   | 주 · 일 DOM 순서를 보정된 top 으로                                 | fixed — 조각의 실제 wall 시작 (`from`, 출력에서는 뺀다) → 칸 번호 순                                                                                                          |
| 7   | 월 축이 창 밖 끝점을 마지막 달 길이로 환산                         | fixed — `dateAxisX` 가 창의 `units` 대신 scale 의 실제 칸 수 (`unitsBetween`) + 칸 안 비율 — x 가 창 끝에 의존하지 않는다                                                     |

검사: 회귀 테스트 9 (rendering `timeGrid.test.ts` 3 · `dateAxis.test.ts` 2, shared `scheduleSpan.test.ts` 4 — 정답은 하드코딩한 값). 원복 RED 8 / 8 (`/tmp/adr323-fix/red.py` — 3 은 막대 · 위반 둘로, 바이트 복원 `shasum` 확인) + 5 번의 좁은 변이 (한도 0) RED 1. `pnpm type-check` 6 / 6 · rendering 1,834 · shared 3,081 전량 통과. live (chrome-autorun, dev `5174`, 브라우저 `Asia/Seoul`): 모듈을 동적 import 해 실제 Chrome (Intl · ICU) 으로 지적 7 의 재현 입력을 실행 — `reversed` · milestone 0 / 0 · 작업 105 / 0 + 위반 false · 23 시간 → 띠 0 · 조각 720 / 720 둘 · 목 · 금 C 줄 0 · more [0,0,2,0,0,0,0] · Z-early 먼저 · 진행률 310 / 310, 콘솔 오류 0.

#### Phase 1 수리 검증 판독 — 2026-11-28 (메인 세션 수리)

codex 수리 검증 (`review-verify-1.json`) HIGH 3 — 셋 다 서머타임 경계에서 재현되는 결함이라 **fixed**. 자동 실행이 판독 1 + 수리 검증 1 상한에 닿아 멈췄고, 사용자 답 「1번으로」 (메인 세션이 직접 수리) 로 이어 받았다.

| #   | 지적                                                                          | 처리 · root cause                                                                                                                                                |
| --- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 자정이 두 번 오는 날 (America/Havana 11-01) 첫 자정 ~ 둘째 자정 작업이 사라짐 | fixed — 창 밖 판정 `x2 <= 0` 이 실제 길이가 있고 wall 폭이 0 인 창 시작의 막대를 버렸다. 창 밖 = `x2 < 0` 또는 「`x2 = 0` 이면서 창 앞에서 시작」 (끝 exclusive) |
| 2   | 가을 전환 날 자식 순서만 바꿔도 요약 막대 폭이 바뀜 (5 ↔ 40 px)               | fixed — 요약 범위를 걷는 중에 끝을 시작까지 당긴 값이 다음 자식의 비교에 남았다. 당기기를 걷기가 끝난 뒤 한 번으로 (`dateAxis.ts`)                               |
| 3   | 주 · 일 DOM 순서를 현지 시각으로 — 가을 전환 날 늦게 시작한 일정이 먼저 Tab   | fixed — 두 조각 모두 순간이 있으면 시작 순간으로 정렬, 앞 날에서 넘어온 조각은 그 날의 시작이라 맨 앞 (`timeGrid.ts`)                                            |

검사: 회귀 테스트 3 (rendering `dateAxis.test.ts` 2 · `timeGrid.test.ts` 1 — 정답은 판독 재현의 값을 하드코딩). 원복 RED 3 / 3 (수리 하나씩 되돌림 · 바이트 복원 확인). `pnpm type-check` 통과 · rendering 1,837 · shared ADR-323 테스트 21 · G3 ratchet 실패 105 = 기준선. live: 두 기하 모듈은 아직 소비자가 없다 (Phase 2 부터 연결) — 브라우저로 exercise 할 화면이 없어 생략.

### Phase 2 (G2) — 2026-11-28 닫힘

HEAD `7dee8374c` 위 (worktree `autorun/adr-323`). 사용자 결정 1 = 「항목마다 상태」 (2026-11-28). contract 87 → **88**.

**만든 것**:

| 파일                                     | 내용                                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `S/catalog/bindings/Timeline.binding.ts` | `Timeline` (`orientation` · `position` · `size` · `dataBinding`) · `TimelineItem` (`id` · `label` · `date` · `description` · `status` · `size`) — D2 는 composition 확장 (`d2Provenance.ts` 의 composition 타입)                                                                           |
| `S/catalog/rule/timeline.ts`             | rule 둘 · 크기 S · M · L (표식 8 · 12 · 16, 간격 8 · 12 · 12, 끝 여백 12 · 16 · 20, 날짜 · 설명 글자 11 · 12 · 14) · 여백 · 표식 · 선의 자리 (anchor) · 상태 색 — 두 consumer 가 같이 읽는 함수                                                                                            |
| `S/catalog/runtime/timeline.ts`          | 파생 값 (`_timeline*`) · 배치 (가로 줄 · 항목 몫 · 번갈아 절반 폭) · DOM inline · 표식 · 선의 DOM 값 · `time` 값                                                                                                                                                                           |
| `S/catalog/document/timelineOrigins.ts`  | 원본 `component-timelineitem` (제목 `{label}` · 날짜 `{date}` · 설명 `{description}` — 날짜 · 설명은 비면 없음) · 팔레트 `component-timeline` (항목 셋 = 상태 셋)                                                                                                                          |
| 등록                                     | `bindings/index.ts` · `componentRulesTable.ts` · `componentCatalog.ts` (collections · 팔레트 원본 · 중첩 원본) · `reusableOriginLibrary.ts` · `collectionItems.ts` (owner Timeline · repeat) · `componentTraits.ts` · `sizePropagation.ts` · 생성 CSS 둘                                   |
| 연결                                     | `presence.ts` (파생 · 의존 · 날짜 Text 의 `_timeDateTime` · 글자 색) · `boxModel.ts` (여백) · `compositionRoot.ts` (배치 · 글자 색) · `domBinding.runtime.ts` (inline · `time` · 글자 색) · `delegatedDom.runtime.ts` (`ol` · `li` · `span` 둘) · builder `ruleShapes.ts` (표식 · 선 도형) |
| 행 반복                                  | `dataBinding.ts` (바인딩의 날짜 축 역할 값을 행마다 `dateAxis` 로) · `resolver.ts` `keyRowItem` (TimelineItem — 역할이 날짜 · 제목 · 상태를 준다) · `collection.types.ts` (fieldMap 에 역할 8) · 패널 `CollectionBinding.tsx` (Date · Title · Status 칸)                                   |

**내린 판단** (고른 것과 이유):

- **표식 · 연결선은 노드가 아니다** — StepList 의 방식 (항목이 자기 여백에 그림). DOM 은 `li` 안 `span` 둘 (글자 없음 · `pointer-events: none`), Canvas 는 `ruleShapes.ts` 도형. 둘 다 `rule/timeline.ts` 의 anchor 하나를 읽는다. role · `aria-*` 를 쓰지 않는다 (D1 예외 0 — 배선 테스트가 DOM 에 role · aria 0 을 확인).
- **배치 prop 이름 = `position`** (MUI Timeline) — `placement` 는 Popover · ContextualHelp · TooltipTrigger 의 Overlay 구획 키라 구획 일관성 게이트 (`propSectionConsistency`) 가 막았다. 값 `end` (선 뒤 — 기본) · `start` (선 앞, 글자 끝 맞춤) · `alternate`.
- **번갈아는 세로만** — 세로 `alternate` 는 항목이 목록 폭의 절반 (`width: 50%` · 번갈아 `align-self`) 이고 표식 · 선이 상자 가장자리 (= 목록 가운데) 에 걸친다. **가로 `alternate` 는 `end` 로 그린다** — 가로는 항목 높이가 내용마다 달라 위 · 아래로 번갈아 둘 때 선의 높이를 맞출 수 없다 (grid 1fr 행 · 반높이 모두 내용 높이에 묶인다). G2 실패 시 대안 「번갈아 배치를 빼고 보고」 를 가로에만 적용 — 사용자 보고 항목.
- **`start` 배치의 글자 맞춤** — 항목 `align-items: flex-end` 로 끝에 붙인다. 여러 줄로 감기는 제목의 줄 안 맞춤 (`text-align`) 은 넣지 않았다 — Canvas 의 글자 맞춤은 조상의 작성 visual 만 상속하고 파생 값 통로가 없다. 짧은 제목은 끝에 붙고, 감긴 긴 제목은 줄마다 앞에서 시작한다.
- **글자 값** — 제목은 문서 글자를 그대로 받는다 (굵기 없음 — `text-font.md`: S2 owner 값이 없는 글자 값은 만들지 않는다). 날짜 · 설명만 한 단계 작은 크기 (Step 설명과 같은 11 · 12 · 14) 와 subdued 색. 날짜 · 설명의 행간은 항목의 상대 행간 (18 / 14) 을 따른다 — 12 px 날짜 줄 = 15.43.
- **날짜 글자 = 저장된 값 그대로** — Table 칸이 날짜를 보이는 방식 (`classifyTableCellDisplay` — 원래 글자) 과 같다. ISO 값이면 `time` 요소 + `datetime` (날짜와 시각 사이 공백은 `T`). 지역 형식으로 바꾸는 표시 (`locale` · `timeZone`) 는 이 Phase 에 넣지 않았다 — Timeline 은 보기 · 시간대 계산이 없고 (정렬 = 데이터 보기의 순서), EventCalendar 의 머리 · 목록 형식이 정해지는 Phase 3 에서 같은 formatter 를 공유하는 쪽이 낫다. live 에서 가로 · 좁은 항목에 긴 ISO 시각 (`2026-08-13T10:52:51.942Z`) 이 옆 항목과 겹치는 것을 봤다 — 글자 요소가 끊을 곳이 없다. Phase 3 형식 작업에서 같이 본다.
- **행 반복** — 바인딩의 `fieldMap` 날짜 축 역할 (`start` · `title` · `color`) 을 `catalogBoundRows` 가 행마다 원값으로 싣고 (`CatalogBoundRow.dateAxis` — 역할이 없으면 싣지 않아 다른 목록은 그대로), resolver `keyRowItem` 이 TimelineItem 의 `id` · `label` · `date` · `status` 로 옮긴다. 역할이 있으면 template 의 표본 날짜 · 상태를 이긴다. 제목 역할이 없으면 작성자의 `{field}` 글자, 그것도 없으면 행의 label 휴리스틱. 상태 값은 대소문자 · 앞뒤 공백을 보지 않고, 세 값 밖은 완료.
- **글자 사이 2 px** — 처음에 항목 파생 layout 의 `gap` 으로 두었더니 Canvas 가 그 값을 읽지 않아 parity 가 모든 fixture 에서 2 px 어긋났다 (Text · 항목 · 선 높이). rule `containerStyles.gap` 으로 옮겨 두 consumer 가 같이 읽는다.
- **lazy 모듈** — Timeline 은 기하 모듈 (`schedule/timeGrid` · `dateAxis`) 을 쓰지 않는다 (상호작용 · 시간 계산 없음). import 게이트의 `LAZY_READERS` 는 그대로 비어 있다 — 첫 소비자는 Phase 3 의 EventCalendar.

**검사**:

- G2 parity (`apps/builder/tests/adr248-g3/adr323TimelineParity.browser.test.ts` — 실제 Chrome, 20 fixture: 방향 둘 × 배치 셋 · 크기 S · L · 항목 2 · 6 · 긴 제목 · 설명 섞임 · 목록에 작성한 상자 값 · 증분 셋 (배치 · 방향 + 크기 · 항목 상태)): **20 / 20**, rect 359 개 최대 차이 0.062 px, 글자 크기 · 굵기 · 색 · 태그 · 표식 칠 · 테두리 · 선 칠 같음, 증분 장면 = 새 bind. Chrome 단독 손 정답 (`EXPECTED`, 6 fixture — 항목 · 표식 · 선 rect) 0.5 px 안.
- 배선 (`adr323TimelineWiring.test.tsx` 6 — 팔레트 · 원본 셋 · Canvas 도형 · DOM `ol > li` · `time` · role · aria 0 · 편집 · undo · 연결한 행 반복) · 정답표 (`adr323Timeline.test.ts` 7 — 기하 손 px · 상태 · `time` 값 · 행의 역할 값).
- 원복 RED 7 / 7 (`.agent/runs/adr323-p2/red.py` + 바이트 복원 `sha256` 확인): `keyRowItem` 분기 · 행의 역할 값 · DOM inline 배치 · `time` 요소 · 상태 대소문자 · 세로 `start` 여백 → 단위 RED, Canvas 도형 호출 제거 → 단위는 GREEN (함수를 직접 부른다) 이고 parity 20 / 20 RED.
- 인벤토리 게이트 갱신 (등재만): 컬렉션 표 · componentTraits · 생성 CSS 인벤토리 (149 · 131) · rule 리터럴 분류 (`TimelineItem.iconSize`) · palette oracle · census 206 · presentWhen 목록 · Code 보기 items host 제외 (Timeline 은 RAC 컬렉션이 아니다).
- 번들 (`pnpm turbo run build --filter=@composition/builder` → `adr209-bundle-closure.mjs`, 배포와 같은 빌드): Builder initial gzip **1,671,818 B** (상한 1,677,000 — 여유 5,182) · Preview 172,337 B. Phase 0 기준선 (1,668,315 · `90b35a386`) 대비 +3,503 / +2 — 그 사이 다른 커밋 (ADR-326 Phase 0 · text 측정 수리 등) 이 포함된 상한값이라 이 Phase 의 몫은 그 이하 (결정 9 몫 +5,000 · +3,000 안). HEAD 단독 before 빌드는 작업 트리를 되돌리는 방식이 막혀 재지 못했다.
- 회귀: `pnpm type-check` 통과 · shared 3,089 · rendering 1,838 (생성 CSS 수 게이트 141 → 143 등재) · builder unit 10,194 통과 · G3 ratchet 실행 569 · 실패 105 = 기준선 · 새 실패 0. preflight — guard · typecheck · registration · css-boundary · chart-contract · agent-catalog · skills gate 통과, format 은 이 Phase 파일 중 HEAD 에서 이미 서식이 어긋난 둘 (`ko-KR.ts` · `compositionRoot.ts` — 이 Phase 의 hunk 는 서식 맞음) 이 걸리고, rule-size 는 Phase 1 과 같은 HEAD 그대로 파일 둘.
- HEAD 그대로의 실패: `labelKeyCatalog.static.test.ts` 의 command 키 수 72 ≠ 71 (이 Phase 의 i18n 변경을 되돌려도 같다).
- live (chrome-autorun, dev `5174`, 새 프로젝트): 팔레트 「timeline」 → Canvas 에 항목 셋 (한국어 제목 · 높이 51.43 · 51.43 · 34 = 정답표 · 회색 · accent · 고리 표식) · Publish (Preview 버튼) DOM 같은 높이 · 표식 자리 · `time` · role 0 · Design 패널 Placement → Alternate (항목 960 폭 번갈아) · Orientation → Horizontal (Canvas 640 × 3 · Publish 400 × 3 — 선 = 항목 폭 − 20) · Data 패널 Preset 「Audit Logs」 표 → Timeline Data source 연결 → 역할 칸 Date = timestamp · Title = action → 행 20 개마다 항목 (Canvas · Publish 둘 다, 마지막만 선 없음, 날짜 = `time`). 콘솔 오류 0.

#### Phase 2 판독 수리 (2026-11-28 — codex 판독 HIGH 9)

| 지적                                                          | 처리     | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1 날짜 축 역할을 template 값 (`row.values`) 에서 읽음        | 수리     | `row.values` 는 역할 이름 (`label` · `description` · `icon` · `value`) 을 원본 필드 위에 덮는다 — `value` 라는 상태 필드가 항목 key 로 바뀌었다. 행을 만드는 다섯 자리가 `rowTemplateValues` 로 values 옆에 원본 item 을 두고 (`WeakMap`), `withDateAxisValues` 가 원본 필드를 읽는다 (`dataBinding.ts`)                                                                                                                                                  |
| F2 날짜 역할이 없으면 template 의 표본 날짜가 모든 행에       | 수리     | resolver `keyRowItem` — 날짜 역할이 없으면 template 의 글자 날짜를 비우고, 작성자의 `{field}` 날짜는 행으로 푼다                                                                                                                                                                                                                                                                                                                                          |
| F3 Preview 에서 100 행까지만                                  | 수리     | Timeline 은 `ol` 이라 RAC load-more 항목 (목록 끝 sentinel) 이 없다 — 세션 `readsWholeRows` 에 Timeline 을 넣어 불러온 행 전부를 그린다 (Cascader 와 같은 길). 원격 cursor 쪽 나누기 (다음 쪽 요청) 는 여전히 끝 표시가 없어 첫 쪽만 — **남은 것**: Timeline 의 「더 보기」 모양을 정하는 일 (S2 · RAC 에 Timeline 없음), Phase 3 EventCalendar 의 보이는 기간 조회 때 같이 본다                                                                          |
| F4 항목을 다 지운 Timeline 에 연결하면 행 template 이 안 생김 | 수리     | `rowTemplateInsert` 가 「항목이 자기 자식인 컬렉션」 을 빈 상태 컬렉션 표로만 판정했다 — 컬렉션 표에서 list 부품 없이 반복하는 owner (Timeline · SelectBoxGroup · Breadcrumbs · FilterBar 포함) 도 같은 길로 (`dataBindingCommand.ts`)                                                                                                                                                                                                                    |
| F5 `display: none` 항목이 번갈아 · 마지막 선에 셈             | 수리     | `timelineItemsOf` 가 `catalogParticipatesInLayout` (숨김 + `display none`) 로 거른다. 증분 의존 목록은 전부 (`every`) — 다시 보이게 되는 항목도 다시 계산                                                                                                                                                                                                                                                                                                 |
| F6 Canvas 에서 파생 여백이 작성한 `padding` 을 이김           | 수리     | DOM 은 작성 inline style 이 파생 style 뒤라 shorthand 가 네 방향을 덮는다. `catalogBoxModel` 의 Step · TimelineItem 파생 여백은 그 방향에 작성값 (side · 축 · shorthand) 이 있으면 물러나고, `styleOf` 가 그 record 에 작성 visual 을 넘긴다. Step (ADR-321) 도 같은 길이라 같이 고쳐진다                                                                                                                                                                 |
| F7 상태가 색 · `data-status` 로만                             | 수리     | 항목 끝에 react-aria `VisuallyHidden` 상태 글자 (완료 · 진행 중 · 예정 / Completed …) — StepList 의 상태 글자와 같은 방식, role · aria 0 그대로 (`runtime/timeline.components.tsx`). record 가 아니라 Canvas 에는 없다                                                                                                                                                                                                                                    |
| F8 Date 칸이 글자 필드도 받음                                 | 수리     | 패널이 날짜 축 역할의 필드 종류를 역할 표 (`dateAxisRoleAccepts`) 에서 읽는다 — Date = date 필드만 (Preset 「Audit Logs」 의 `timestamp` 는 date 라 그대로 연결된다)                                                                                                                                                                                                                                                                                      |
| F9 Timeline 배치 · 여백 계산이 첫 화면 번들에                 | rejected | HC6 의 「기하 계산」 은 §5.2 의 기하 모듈 둘 (`schedule/timeGrid` · `dateAxis` — Timeline 은 쓰지 않는다, Phase 2 판단 기록) 이고 「실행 코드」 는 상호작용 runtime 이다 (결정 9 「등록 · rule · 역할 표 — 기하와 실행은 lazy」). Timeline 의 파생 값은 rule 의 자리 값을 Canvas 레이아웃 입력이 동기로 읽는 것으로, StepList (ADR-321 `catalogStepDerived`, `presence.ts`) 와 같은 층이다. 측정 Δ 는 결정 9 몫 안 (Phase 2 기록 — 이번 수리의 Δ 는 아래) |

- 회귀 테스트 (원복 RED 8 / 8 — `.agent/runs/adr323-p2r/red.py` · 바이트 복원 `sha256` 확인): F1 `adr323Timeline.test.ts` · F2 · F4 · F5 · F6 · F7 `adr323TimelineWiring.test.tsx` · F3 `preview/catalog/__tests__/adr323TimelinePreviewRows.test.tsx` (세션 101 행) · F8 `CollectionBinding.test.tsx` (schema 에 date 필드 추가 — 날짜 컴포넌트 칸의 기대 목록도 그 필드를 포함).
- 회귀: `pnpm type-check` 통과 · shared 전체 통과 · builder unit 10,186 통과 (전체 동시 실행의 시간 초과 7 파일 15 건은 단독 재실행에서 모두 통과) · G3 ratchet 실행 569 · 실패 105 = 기준선 · 새 실패 0. 번들 Builder initial gzip **1,672,107 B** (Phase 2 1,671,818 대비 +289 — 상태 글자 component, 상한 1,677,000 안).
- live (chrome-autorun, dev `5174`, 새 프로젝트, 명령으로 넣음): 101 행 표 (`value` = 상태 필드) → Timeline A (날짜 역할 없음) · B (항목 셋을 지운 뒤 연결, 날짜 역할) · C (정적, 번갈아, 셋째 `display none`, 첫째 `padding 40`). Canvas — A 상태 = `value` 필드 (completed · current · upcoming) · 날짜 Text 없음, B 지운 뒤 0 → 연결 뒤 행마다 (Builder 표본 100), C 보이는 둘 `end · start` · 둘째가 마지막 · 첫째 여백 40 네 방향. Publish — A · B `li` 101 (마지막 「Event 101」), A `time` 0, 상태 글자 (사이트 언어 ko: 완료 · 진행 중 · 예정), C 보이는 둘 · 둘째 선 없음 · 첫째 `padding 40px`, role · aria 0, 콘솔 오류 0. 넣은 노드 · 표는 `removeTargets` · `removeCollection` 으로 지움.

#### Phase 2 수리 검증 판독 — 2026-11-28 (메인 세션 수리)

codex 수리 검증 (`review-verify-2.json`) HIGH 4 — 자동 실행이 판독 1 + 수리 검증 1 상한에 닿아, 사용자 답 「1」 (메인 세션이 직접 수리) 로 이어 받았다. 수리 3 · rejected 1 (일부 rejected 1 포함).

| #   | 지적                                                                       | 처리 · root cause                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `keysUnique` endpoint 에서 `parentId` 가 있는 받은 행이 Timeline 에서 빠짐 | fixed — F3 수리가 `readsWholeRows` (창 없음) 에 Timeline 을 넣었는데 같은 판정이 Cascader 의 단계별 읽기 (`keysUnique` — 첫 응답 = 맨 위 단계) 도 켰다. 단계 읽기를 `readsLevelRows` (Cascader · CascaderItem 만) 로 나눴다 (`catalogPreviewSession.ts`)                                                                                                                                                                                                                                   |
| 2   | 원격 다음 cursor 페이지를 읽지 않음 (첫 페이지만)                          | fixed — Timeline 은 `ol` 이라 RAC 의 load-more sentinel 이 없다. 그린 Timeline 이 읽는 collection 은 모든 페이지를 불러온다 — 보기 로컬 실행 · Table 전체 읽기와 같은 `loadsWhole` → `loadAll` (상한 `VIEW_LOCAL_LOAD_CAP` 1만 행, 넘으면 알림과 함께 거절 — 조용한 첫 페이지 아님). DOM sentinel 을 새로 두지 않은 것은 D1 (Timeline 은 예외 없음 — 목록 항목 수를 바꾸는 요소 · aria 를 더하지 않는다) 때문                                                                              |
| 3   | 반복 항목에 직접 쓴 Date 가 날짜 역할 없을 때 사라짐                       | rejected — 반복 항목의 리터럴 내용은 표본이라는 기존 행 template 규칙 (`resolver.ts` `withoutSampleContent` · `dropLiteralContent`, 2026-10-14 · ADR-310) 과 같은 동작이다. 같은 자리에 쓴 리터럴 `label` 도 행 값에 밀려 보이지 않는다. 행마다 날짜를 보이려면 Date 역할 또는 `{field}` 를 쓴다. 날짜만 다르게 두면 한 반복 항목 안에서 표본 판정이 prop 마다 갈린다                                                                                                                      |
| 4   | 상태 글자 렌더러 · 배치 계산이 첫 화면 번들에 (HC6)                        | 일부 fixed — breakdown §8 이 lazy 로 정한 `runtime/timeline.components.tsx` 를 DOM runtime 이 정적으로 import 했다 → `lazy` + `Suspense` (fallback 없음 — 글자는 보이지 않는 낭독용). 게이트: `adr323ScheduleImports.static.test.ts` 「run-time modules」 (세 컴포넌트의 `*.components` 정적 import 0). Canvas 파생 값 (`presence.ts` · `runtime/timeline.ts` 의 자리 · 여백) 은 rejected 그대로 — 레이아웃 입력이 동기로 읽는 rule 층이고 StepList (ADR-321 `catalogStepDerived`) 와 같다 |

검사: 회귀 테스트 3 (builder `adr323TimelineRemote.test.tsx` 2 · shared 정적 게이트 1) + 기존 DOM 테스트가 lazy 글자를 기다리게 (`vi.waitFor`). 원복 RED 3 / 3 (세션 수리 둘은 하나씩 되돌림 · 바이트 복원 확인, 게이트는 수리 전 파일에서 실패). 세 번째 판독은 돌리지 않았다 — 닫힘은 실행자 판정 (`review-loop-closure.md` §1).

### Phase 3 (G3) — 진행 중 (2026-11-28 ~)

HEAD `51ecc053d` 위 (worktree `autorun/adr-323`). 사용자 결정 4 = 「행 하나 = 한 건」 (2026-11-28 확정 — 반복 규칙을 해석하지 않는다). Phase 가 커서 단위로 나눠 커밋한다 — 단위마다 type-check · 관련 테스트 통과 상태.

**단위 1 — 보이는 기간 조회 (`11a7abfe4`)**: `S/catalog/runtime/scheduleWindowQuery.ts` — 아직 소비자 없음.

- `scheduleWindowConditions(fields, { from, until }, 기본 길이 분)` — §5.4.1 의 일 단위 상위집합을 보기 조건 묶음 (`schedule-window`) 으로. 창은 컴포넌트 시간대의 wall 날 (`until` 제외) 로 받는다 — 조건 만들기에 시간대 계산이 없다 (날짜 글자만). 여유 상수 `SCHEDULE_QUERY_MARGIN_DAYS` = 2 하나를 조건과 정답표가 읽는다. 기본 길이의 날 수 = `max(1, ceil(분 / 1440))` (종일 값의 끝 없음 = 하루).
- `scheduleWindowRequest(service, 끝 역할 있음)` — §5.4.1 표: 로컬 `here` · `body` `send` · `suffix` + 끝 `loadWhole` (「또는」 을 못 실음) · `suffix` 시작만 = `gte` · `lte` 접미사가 둘 다 있으면 `send` · 형식 없음 · `none` `loadWhole`.
- `scheduleRowsInWindow(rows, 값 읽기, 창, 옵션)` — 정밀 거르기 (`readScheduleSpan` → `scheduleSpanOverlaps`), 거절 사유를 센다 (그리지 않음).
- 버린 접근: 조건 만들기가 창을 순간으로 받기 — 조건은 날짜 글자라 순간 → 날 변환이 조건 쪽에 필요 없고, 순간은 정밀 거르기만 쓴다 (`scheduleWindowInstants`).
- 검사 (`catalog/runtime/__tests__/adr323ScheduleWindow.test.ts` 13): 조건 모양 (손으로 쓴 값) · 요청 판정 7 · G3 정답표 — Seoul 창 11-23 ~ 11-30 의 경계 행 15 (가로지르는 11-21 ~ 12-02 포함 · 11-30 시작 둘 제외 · 끝 없는 23:50 포함 · 자정에 끝남 제외 · 날만 있는 끝 exclusive 제외 · UTC 글자의 날이 하루 앞 포함 · 뒤집힘 · 시작 없음은 거절 수) · `Pacific/Kiritimati` 표시 + 저장 −12:00 의 11-23 00:05 ~ 00:15 포함 (그 앞 23:55 제외) · `Etc/GMT+12` 표시 + 저장 +14:00 의 창 마지막 날 23:45 포함 (다음 날 00:05 제외), 셋 다 로컬 = body (조건 전부 실림 · 경고 0) = suffix (`OR_GROUP` → 전량 → 정밀). 시작만 구성의 suffix 는 `start_gte` · `start_lte` 로 실려 글자 날 서버와 결과가 같다. 상위집합 sweep — 표시 시간대 5 × 저장 오프셋 10 (−12:00 ~ +14:00, +05:45 포함) × 20 분 간격 13 일 × (50 분 · 끝 없음) + 날만 있는 값: 정밀이 남긴 것을 상위집합이 하나도 빠뜨리지 않음. 원복 RED 5 / 5 (여유 1 · 끝 없는 시작의 기본 길이 빼기 · 「끝 after」 가지 빼기 · 정밀 = 시작만 · suffix + 끝을 send).

**단위 2 — 월 · 일정 목록 모델 (`0d14d6057`)**: `S/catalog/runtime/eventCalendar.ts` — 아직 소비자 없음. 순수 함수라 Canvas (작성 시작 값) 와 DOM (실행 기준 날짜) 이 같이 읽는다.

- 기준 날짜 = `defaultDate` (ISO 날), 비면 컴포넌트 시간대의 오늘 (`now` 주입 — R8). 「이전 · 다음」 = 앞뒤 달의 1 일 (1-31 → 2-01 — 달 끝 날짜를 끌고 가지 않는다), 「오늘」 = 오늘.
- 월 보기 = 기준 달을 덮는 온 주 (`getWeeksInMonth` · `startOfWeek` — RAC `CalendarGrid` 의 행), 칸마다 날짜 (그레고리력 ISO · 달력 체계의 일 · wall ms · 달 밖 · 오늘). 날짜 고르기용 Calendar 는 달 밖 칸을 숨기지만 일정표는 그 칸의 일정도 그린다 (흐리게) — Google · ReUI 와 같다. 창 = 첫 칸 ~ 끝 칸 다음 날. 요일 이름 `short`. 제목 = RAC `CalendarHeading` 글자 (`catalogCalendarHeading` 재사용 — 달력 체계의 해).
- 일정 목록 창 = 기준 달 (1 일 ~ 다음 달 1 일). 날짜별 일정 (`catalogEventCalendarDayEvents`) = 그 날을 덮는 일정 (여러 날 일정은 날마다 · 길이 0 은 그 순간의 날) — 종일 먼저 · 시작 순간 · 긴 것 먼저 · 받은 순서. 일정 목록 구획과 고른 날의 목록이 같이 쓴다.
- 보기 key: `agenda` 밖은 월 (주 · 일 = Phase 4).
- 검사 (`catalog/runtime/__tests__/adr323EventCalendarModel.test.ts` 9 — 2026-11 손 달력: 11-01 일요일): en-US 5 주 11-01 ~ 12-05 · 월요일 시작 6 주 10-26 ~ 12-06 · ko-KR 제목 · 요일 · buddhist 해 2569 · Etc/GMT+12 의 오늘 11-27 · 날짜별 순서 (전날 밤에 시작한 일정보다 종일 먼저). 원복 RED 5 / 5 (주 수 6 고정 · 오늘을 UTC 로 · 이전 / 다음이 날짜 유지 · 종일 먼저 빼기 · 창 끝을 마지막 칸으로).

**이 세션을 여기서 닫은 이유 (2026-11-28)**: 다음 단위 (노드 등록 + contract 90 + 그리기) 는 한 커밋으로 서야 한다 — contract 를 올리면 test fixture 40 여 곳이 같이 바뀌고, 등록만 하고 그리지 않는 type 은 문서에서 빈 상자가 된다. 남은 컨텍스트로 그 단위를 끝까지 닫지 못하면 type-check 가 통과하지 않는 중간 상태가 남아, 끝난 두 단위까지 커밋하고 넘긴다.

**다음 단위의 설계 (통상 구현 판단 — 다음 세션이 이대로 진행)**:

- **노드 트리** — `EventCalendar > frame (머리 — 가로 줄) [Button slot=previous (Icon) · Button slot=next (Icon) · Button slot=today ("Today") · Heading slot=title · ToggleButtonGroup slot=view > ToggleButton id=month · id=agenda] + EventCalendarView + EventCalendarEvent*`. 주 · 일 ToggleButton 은 Phase 4 에서 더한다.
  - `EventCalendarEvent` = 「일정 template (반복)」 — 자식 없는 자료 노드 (`id` · `label` · `start` · `end` · `allDay` · `color`). 연결하면 행마다 반복되고 날짜 축 역할 (`start` · `end` · `allDay` · `title` · `color`) 이 값을 준다 (Timeline 의 `keyRowItem` 길 그대로 — collectionItems owner EventCalendar). 상자로 그려지지 않는다 (Canvas `catalogHiddenAtRest` · DOM 요소 없음) — View 가 그것을 읽어 그린다.
  - `EventCalendarView` = 본문. 파생 값 하나 (`_eventCalendarView` — 보기 · 기준 날짜 · 보이는 칸 · 일정 목록) 를 Canvas primitive 와 DOM 이 같이 읽는다 (Calendar 의 `_calendarGrid` 방식). 월 칸의 줄 배정 · 「+N」 은 `layoutScheduleDayBands` (lazy — Canvas 는 Chart family 의 `ensureChartFamily` · `chartFamilyLoaded` 처럼 로드 뒤 seed, DOM 은 lazy chunk `runtime/eventCalendar.components.tsx` 안). 로드 전 Canvas 는 칸만 그린다.
  - 머리 노드는 기존 type 그대로다 — 모양은 그 type 의 rule. DOM 은 EventCalendar 렌더러가 자식을 RAC `Provider` 로 감싼다: `ButtonContext` slot `previous` · `next` · `today` 의 `onPress` (RAC 가 handler 를 이어 붙인다), `HeadingContext` 의 기간 제목, `ToggleButtonGroupContext` slot `view` 의 `onSelectionChange`. Canvas 의 제목은 Heading 파생 `children` (CalendarHeading 방식).
  - **보기 종류의 정본 = 머리 ToggleButtonGroup 의 선택** (ADR-308 — 그룹이 선택을 저장한다). 시작 보기 = 그 그룹의 작성 선택, 실행 중 보기 = 그 그룹의 실행 선택. 그룹이 지워지면 월 보기. EventCalendar 에 따로 `defaultView` prop 을 두지 않는다 (두 정본 금지).
  - prop (EventCalendar): `dataBinding` · `defaultDate` (비면 오늘 — Canvas 는 달력 모델의 기준 날짜 주입, R8) · `timeZone` · `locale` · `firstDayOfWeek` · `calendarSystem` (`dateLocaleProps.ts` 그대로) · `maxEventLines` (월 칸의 최대 줄 수, 기본 3) · `size`. `isReadOnly` · 하루 시작 / 끝 · 칸 · 끌기 단위는 쓰는 Phase (4 · 5) 에서 더한다. D2 = composition 확장 (`d2Provenance.ts`).
- **월 보기 DOM** — RAC `Calendar` (보이는 달 = 기준 날짜의 달, `focusedValue` controlled) > `CalendarGrid` > `CalendarCell` 안에 날짜 숫자 + 일정 줄 (보이기만 — §5.4 P1 결과: 칸 이름은 RAC 의 날짜). 날짜를 고르면 그 날의 일정 `Popover > Dialog > GridList` (§4.1 표). 
- **일정 목록 보기 DOM** — 날짜별 구획의 RAC `GridList` (`GridListSection` · `GridListHeader`), 보이는 기간 = 기준 날짜의 달.
- **조회 연결** — 세션: 그려진 EventCalendar 가 읽는 collection 은 먼저 `loadsWhole` (Timeline 의 `timelinesRead` 와 같은 길 · 상한 넘으면 `refuseView`) 로 두고 DOM 이 정밀 거르기를 한다 — G3 의 「로컬 = body = suffix」 결과가 같다. `body` · `suffix` 시작만의 `send` (요청을 줄이는 것) 는 그 뒤 단위에서 `stateRowQuery` 옆에 붙인다 (실행 상태 = 보이는 창, Table 상태의 번역과 같은 자리).
- **팔레트 항목은 마지막 단위에** — 등록 · 그리기가 다 선 뒤에 넣는다 (중간 커밋이 쓸 수 없는 컴포넌트를 팔레트에 내지 않게).
- **날짜 글자 지역 형식** — EventCalendar 의 기간 제목 · 일정 목록 날짜 머리가 쓰는 formatter (`DateFormatter` — `calendarModel.ts` 의 locale 해석) 를 Timeline 날짜 글자와 공유할지는 일정 목록 단위에서 정한다 (Phase 2 기록 — 긴 ISO 시각이 가로 Timeline 에서 겹침).
