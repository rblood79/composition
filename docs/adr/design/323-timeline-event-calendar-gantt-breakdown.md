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
| Gantt 의 작업 표                      | `Table` (계층 행)                              | 행 이동 · 펼침 · 정렬 · 칸 편집                       |
| Gantt 의 막대                         | 시간축 칸 안의 `Button`                        | Enter 로 편집 열기                                    |
| 알림                                  | react-aria `announce`                          | 끌기 · 편집 결과                                      |

### 4.2 닫힌 D1 예외 (사용자 답 2026-11-26)

1. **장식 층의 숨김 속성** — 눈금선 · 현재 시각 선 · 의존선 · 주말 음영을 담는 요소에 `aria-hidden="true"`. 그 층에는 글자와 누르는 요소를 두지 않는다.
2. **포인터 끌기** — 일정 Button · 막대 Button 과 그 양 끝의 잡는 영역, 진행률 손잡이, 시간 격자 · 시간축의 빈 자리에서: `useMove` 의 포인터 handler 와 pointerdown 의 pointer capture. 키 handler 는 붙이지 않는다 (`useMove` 의 키 handler 는 화살표를 삼키므로 쓰지 않는다 — ADR-318 과 같다). 끌기 중 Escape 는 취소다.
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
- 날만 있는 값 (정밀도 `date`) 은 종일로 읽는다.

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
- 보이는 기간의 행만 읽는다 — 보기의 날짜 조건 (`between`) 을 실행 상태에서 붙인다 (서버 요청도 같은 조건).
- 월 보기: 칸 안에 날짜 숫자와 일정 글자. 여러 날 일정은 줄 번호를 맞춘 띠 조각으로 칸마다 그린다. 날짜를 고르면 그 날의 일정 목록이 Popover 로 열린다.
- 주 · 일 보기: 날 열 `Group` 안에 일정 `Button` 이 기하의 rect 에 놓인다. DOM 순서는 시작 시각 순이다.
- 일정 목록 보기: 날짜별 구획의 `GridList`.
- 편집: 일정을 열면 행 편집 폼 Dialog (ADR-289 — 적용 범위는 Phase 0 에서 확인). 빈 자리 누르기 · 끌어 만들기는 When 「빈 자리 선택」 을 내고 작성자의 규칙이 폼을 연다.
- 실행 상태: 보기 종류 · 기준 날짜 (이름 붙인 상태 둘). When 「일정 변경」 · 「빈 자리 선택」 · 「기간 변경」. Do 「보기 바꾸기」 · 「날짜로 이동」 · 「오늘」.

### 5.5 Gantt — Table 의 시간축 열 (Phase 6 ~ 7)

- Column 의 새 종류 「시간축」 — 한 Table 에 하나. 그 열의 설정: 역할 (시작 · 끝 · 진행률 · 선행) · scale · 시작 기간 · 확대 · 주말 음영 · 오늘 선.
- 열의 머리글 = 날짜 눈금 (두 단). 열의 칸 = 그 행의 막대 Button (이름 = 「작업 이름, 시작 ~ 끝, 진행률」). 묶음 행의 칸 = 요약 막대.
- 열은 가로로 넓고 Table 의 가로 스크롤을 탄다. 작업 열은 앞에 고정한다 (기존 열 고정).
- 의존선은 열 영역 위의 장식 층이다 (§4.2-1). 보이는 행 창 안의 두 끝이 모두 있을 때만 그리고, 한쪽이 창 밖이면 창 가장자리까지 그린다.
- 편집: 막대를 열면 행 편집 폼, 표의 시작 · 끝 열이 「Editable」 이면 칸에서 고친다. 포인터로는 막대를 끌어 옮기고 양 끝과 진행률 손잡이를 끈다.
- 팔레트 「Gantt」 (결정 5 가 「Table 의 구성」 일 때): Table 을 작업 열 + 시작 + 끝 + 시간축 열 구성으로 놓는다.
- 실행 상태: scale · 보이는 기간 · 확대 — 표 상태의 열 조각 옆에 둔다 (「Remember state」 가 기억).

### 5.6 쓰기 · 끌기

- 끌기 중에는 요소의 style 만 바꾼다. 놓을 때 `updateMany` 한 번 (시작 · 끝 또는 진행률) — 편집 기록 한 건.
- 값은 단위 (결정 8) 에 맞춘다. 시작이 끝보다 늦어지는 길이 조절은 한 단위에서 멈춘다.
- 읽기 전용 (`isReadOnly` · 편집할 수 없는 필드 · 계산 필드) 이면 끌기가 시작되지 않는다.
- 놓은 뒤 「이름, 새 시작 ~ 새 끝」 을 `announce` 로 알린다.

### 5.7 Canvas

- Timeline: 항목의 배치 · 표식 · 선.
- EventCalendar: 시작 보기 · 기준 날짜 (비면 달력 모델의 기준 날짜) 에서 표본 행의 일정을 기하 모듈로 그린다.
- Gantt: Table 그리기에 시간축 열의 눈금 · 막대 · 요약 · 의존선을 더한다.
- 보기 전환 · 끌기 · 열린 Dialog 는 그리지 않는다.

## 6. Phase

| Phase | 내용                                                                                                           | Gate |
| :---: | -------------------------------------------------------------------------------------------------------------- | :--: |
|   0   | 코드 사실 재대조 · v3 확인 · ADR-289 적용 범위 · 시제품 4 · 번들 · 속도 기준선                                 |  G0  |
|   1   | 날짜 축 역할 표 · 기하 모듈 둘 · 시간대 (결정 7) · import 게이트                                               |  G1  |
|   2   | Timeline — 등록 · 정적 · 행 반복 · 상태 (결정 1) · contract                                                    |  G2  |
|   3   | EventCalendar — 등록 · 머리 · 월 보기 · 일정 목록 보기 · 보이는 기간 조회 · 반복 (결정 4)                      |  G3  |
|   4   | EventCalendar — 주 · 일 보기 (· 결정 2 의 보기) · 일정 Button · 편집 Dialog · 일정 목록 같이 보기 (결정 3)     |  G4  |
|   5   | EventCalendar — 포인터 끌기 (옮기기 · 길이 · 만들기) · When · Do · 이름 붙인 상태 · 규칙 문서의 승인 가리킴 줄 |  G5  |
|   6   | Gantt — 시간축 열 (눈금 · 막대 · 요약 · 마일스톤 · 오늘 선 · 주말 음영) · Canvas · 팔레트 (결정 5)             |  G6  |
|   7   | Gantt — 의존선 (결정 6) · 진행률 · 막대 끌기 · 확대 · 실행 상태 기억                                           |  G7  |
|   8   | 속도 측정 · 번들 · D1 목록 전문을 규칙 문서로 · 종결 live · 문서 (CHANGELOG)                                   |  G8  |

컴포넌트 단위로 닫는다 — Phase 2 끝에 Timeline, Phase 5 끝에 Event Calendar, Phase 7 끝에 Gantt 가 각각 쓸 수 있는 상태다.

## 7. Phase 0 시제품

| ID  | 확인할 것                                                                                                                                 | go 기준                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| P1  | 월 칸 안의 일정 글자 — RAC `CalendarCell` 자식으로 넣었을 때 칸의 낭독 이름에 실리는지, 날짜 키 이동이 그대로인지                         | 접근성 트리에서 칸 이름에 일정 글자 · 키 이동 무변경              |
| P2  | 주 보기 겹침 — 한 주 200 건 (같은 시각 20 건 겹침) 의 기하 계산 시간과 Button 200 개의 첫 표시 · 주 넘기기 frame                          | 계산이 한 프레임 안 · 넘기기 p95 ≤ 16.7 ms (1x)                   |
| P3  | Table 시간축 열 — 5,000 행 · 넓은 열 하나 · 칸 안 Button, 세로 스크롤 frame 과 가로 스크롤, 열 고정과의 겹침, 칸 안 Button 으로의 키 이동 | 세로 스크롤이 시간축 열 없는 Table 기준선 안 · 키로 막대에 닿음   |
| P4  | 끌기 — `useMove` 포인터 handler 만 붙인 Button 의 옮기기 · 양 끝 길이 조절, 스크롤 영역 가장자리 · iframe 위에서 놓기 (pointer capture)   | Chrome · WebKit 에서 끌기가 끊기지 않고 Button 의 press 와 구분됨 |

## 8. 파일 추정 (Phase 0 에서 확정)

| 자리                    | 파일                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 기하 (rendering, lazy)  | 새 `R/schedule/timeGrid.ts` · `R/schedule/dateAxis.ts` · Canvas primitive (`R/renderers/skiaPrimitives.ts`)                                                                                                                                                                                                             |
| 역할 · 데이터 (shared)  | 새 `S/collections/dateAxisRoles.ts` · `S/collections/resolveCollectionItems.ts` · 보이는 기간 조회 (`S/catalog/runtime/`)                                                                                                                                                                                               |
| 등록 (shared)           | 새 `bindings/Timeline.binding.ts` · `TimelineItem.binding.ts` · `EventCalendar.binding.ts` · `Column.binding.ts` (시간축) · `componentCatalog.ts` · `generated/componentRulesTable.ts` · `document/generated/reusableOriginLibrary.ts` · `document/types.ts` · `document/d2Provenance.ts` · `domain/componentTraits.ts` |
| 실행 (shared, lazy)     | 새 `runtime/timeline.components.tsx` · `runtime/eventCalendar.components.tsx` · `runtime/scheduleDrag.components.tsx` · `runtime/tableTimelineColumn.components.tsx` · `runtime/tableTracks.ts` · `runtime/tableState.ts`                                                                                               |
| 상태 연동 (shared)      | 새 `interactions/concepts/schedule.ts` · `componentInteractionSpecs.ts`                                                                                                                                                                                                                                                 |
| Canvas · 패널 (builder) | `catalogRuntime/canvasBinding.ts` · `paletteItems.ts` · 역할 편집기 · i18n                                                                                                                                                                                                                                              |
| 규칙                    | `.claude/rules/ssot-hierarchy.md` §1 D1 (Accepted 때 한 줄 · Phase 8 에 전문)                                                                                                                                                                                                                                           |

추정 shared 26 ~ 34 · rendering 4 ~ 6 · builder 8 ~ 12 파일 + 테스트.

## 9. Phase 결과

(Phase 가 닫힐 때마다 기록)
