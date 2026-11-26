# ADR-323: Timeline · Event Calendar · Gantt — 날짜 축 컴포넌트 셋 (조작 정본은 RAC 목록 · 표, 시간 격자 · 막대는 공용 기하의 그림, 닫힌 D1 예외)

## Status

Proposed — 2026-11-26

- 사용자 요청: `/create-adr` (2026-11-26). 방향을 정한 원문 (같은 날): 「https://reui.io/components 분석후 우리 컴퍼넌트와 비교하고 reui가 더 편리한 부분과 차용할 부분들 비교 분석해줘」 → 비교 보고 뒤 `/create-adr`.
- 사용자가 이미 답한 것 (2026-11-26):
  1. 범위 = 차용 후보 네 묶음 전부, 문서 단위 = 「묶음마다 ADR 하나」 (결정 지점 1 의 확정). 이 문서는 「Timeline · Event Calendar · Gantt」 묶음이다. 다른 묶음: [320](320-filter-bar-runtime-condition-builder.md) · [321](321-steplist-rating-components.md) · [322](322-cascader-hierarchical-picker.md).
  2. D1 처리 = 「목록 · 표가 조작 정본」 — 키보드 · 낭독 조작은 RAC 부품 (Calendar 월 격자 · 일정 목록 · Table 계층 행 · 편집 Dialog) 으로 하고, 시간 격자 · 막대 · 의존선은 그림이며, 막대 끌기는 포인터 보조 조작이다. **결정 지점 3 (SSOT 경계 — 사용자 컴포넌트의 D1 예외 추가) 의 확정이다.** 예외의 범위는 [breakdown §4](design/323-timeline-event-calendar-gantt-breakdown.md) 의 목록으로 닫는다. 기각된 선택지: 「막대 · 일정까지 직접 접근성 구현」 · 「제3자 라이브러리 도입」.
- 분리 점검 (4 질문) 은 [ADR-320 Status](320-filter-bar-runtime-condition-builder.md) 에 적었다. 이 ADR 은 기존 ADR 을 나누거나 합치지 않는다. Gantt 는 [ADR-315](completed/315-table-data-grid-state-model.md) (Table) 위의 응용이고 방향은 그대로다.
- 리뷰 전. 착수는 사용자 `/execute-adr 323`.

## Context

### 도메인

- **D1 (DOM · 접근성)**: 설치된 `react-aria-components` 1.22.1 에 Timeline · 일정표 · Gantt 가 없다. 조작은 있는 RAC 부품이 맡는다 — 월 격자는 `Calendar`, 일정 하나는 `Button`, 일정 목록은 `GridList`, 편집은 `Dialog`, Gantt 의 작업 표는 `Table`. RAC 가 주지 않는 것 (장식 층의 숨김 속성 · 포인터 끌기 · 확대) 만 닫힌 목록의 D1 예외다 (사용자 답 2).
- **D2 (Props)**: S2 1.8.2 · design-data 에 셋 다 없다 (design-data 검색: timeline → scroll-zoom-bar 1 건, gantt 0 건, calendar 류는 날짜 고르기뿐). 정본 순서의 4 번 — composition 확장으로 `d2Provenance.ts` 에 적는다. 날짜 · 지역 prop 은 기존 Calendar 의 이름 (`locale` · `firstDayOfWeek` · `calendarSystem`) 을 그대로 쓴다.
- **D3 (시각)**: 표식 · 일정 상자 · 막대 · 눈금의 모양은 catalog rule 이 정본이다. 시간 격자와 막대의 위치는 **공용 기하 모듈 하나**가 계산하고 Canvas 와 DOM 이 같은 결과를 그린다 (Chart 의 `computeChartScene` 방식).
- 데이터 계산 (보이는 기간의 행 고르기 · 날짜 비교) 은 D1 ~ D3 밖의 데이터 층이다 (ADR-284 · 315).

### 문제

고객의 업무 화면에는 날짜 축 위에 놓이는 데이터가 많다 — 처리 이력, 예약 · 근태 · 일정, 프로젝트 공정. 지금 이것을 보여 줄 길은 Table 과 Chart 뿐이라, 이력을 시간순 띠로, 일정을 달력으로, 공정을 막대로 보여 주지 못한다. ReUI 는 Timeline (정적 표시) · Event Calendar (월 · 주 · 일 · agenda · 끌어 옮기기) · Gantt (막대 · 의존선 · 묶음) 를 준다. 다만 ReUI 의 Gantt 에는 grid · treegrid role 이 없고 막대를 키로 옮기는 길도 확인되지 않으며, 세 컴포넌트 모두 가상화가 없다.

### 코드 사실 (2026-11-26 실측, HEAD `0ea8c33d8`)

- **F1** RAC `CalendarGrid` 는 `table[role=grid]`, `CalendarCell` 은 `td[role=gridcell]` 안의 `div[role=button]` 이고 임의 자식을 받는다 (`.claude/skills/react-aria/references/components/Calendar.md:985`). 자식은 그 button 안에 놓인다 — 칸 안에 또 다른 누를 수 있는 요소를 둘 수 없다.
- **F2** 저장소의 CalendarCell 은 반복 template 이고 Canvas 는 달력을 계산으로 그린다 — `skiaPrimitive: "calendar_month_grid"` (`packages/shared/src/catalog/bindings/CalendarGrid.binding.ts:40`) 가 달력 모델 (`catalog/runtime/calendarModel.ts` — `timeZone` 옵션 `:144`) 을 읽는다.
- **F3** 공용 기하의 선례는 Chart 다 — `computeChartScene` (`packages/rendering/src/chart/computeChartScene.ts:318`) 과 `resolveChartModel` (`chart/model.ts:200`) 을 Canvas 와 DOM 이 같이 읽는다. Chart 에는 쓰기 · 행 계층 · 조작이 없다 (`interactions/componentInteractionSpecs.ts` 에 Chart 0 건), 역할 `startField` · `endField` 는 number 다 (`chart/roles.ts:110-113`).
- **F4** 계층 행은 Table 에 있다 — `fieldMap.children` · `parentId` (`collections/resolveCollectionItems.ts:268-273`), 펼침은 표 상태 `expandedKeys` (`catalog/runtime/tableState.ts:54`), 행 가상 스크롤 · 열 고정 · 칸 편집도 Table 의 것이다 (ADR-315 · 317).
- **F5** 날짜 필드는 `date` 하나이고 정밀도 (`date` · `dateTime`) 를 가진다 (`schemas/dataChange.ts:30`, `:77`). 보기 비교에 `between` · `before` · `after` 가 있다.
- **F6** 실행 중 쓰기는 세션의 `updateMany` 한 길이다 — 여러 행 · 여러 필드를 편집 기록 한 건으로 (`catalog/runtime/catalogPreviewSession.ts:1534`). 서버 반영은 `callEndpoint` Do 다.
- **F7** 지금 `fieldMap` 이 읽는 역할은 `value` · `children` · `parentId` · `disabled` · `unavailable` · `unavailableEnd` 다. 시작 · 끝 · 진행률 같은 날짜 축 역할은 없다.
- **F8** 끌기 When 은 RAC `useDragAndDrop` 을 가진 목록 (ListBox · GridList · Tree · Table) 에만 있다 (`interactions/concepts/collectionDragDrop.ts`). 날짜 축 위치를 인자로 내는 When 은 없다.
- **F9** 포인터 끌기를 react-aria `useMove` 로 다루고 pointer capture 를 쓰는 선례가 있다 — Resizable 손잡이 (ADR-318, `catalog/runtime/resizable.components.tsx`).
- **F10** 행 편집 폼의 선례가 있다 ([ADR-289](completed/289-data-grid-row-form-column-editor-selection-actions.md)).
- **F11** `LIBRARY_CONTRACT_VERSION` 79, initial 번들 여유 Builder 약 10,600 B (상한 만료 2026-12-25, 커밋당 Δ 상한 4,096 · 3,584 B — Phase 0 재측정).

### 레퍼런스

- **ReUI** (registry 소스 읽음): Timeline 은 role 없는 `div` 이고 상호작용이 없다. Event Calendar 는 보기 6 (month · week · day · days · agenda · resource), 일정 형식 (`start` · `end` exclusive · `allDay` · 반복 rule), 끌어 옮기기 · 길이 조절 · 끌어 만들기, 월 보기만 `role="grid"`. Gantt 는 scale 5 (day ~ year) · 의존 (finish-to-start 만, 그리기 전용) · 진행률 · 묶음 · baseline, 막대는 `button`.
- **대표 라이브러리**: FullCalendar · react-big-calendar · Schedule-X (일정), frappe-gantt · SVAR · dhtmlxGantt · Bryntum (공정), MUI · Ant Design Timeline. 의존 형식은 선행 id 배열 (ReUI · frappe) 과 link 행 4 종 (dhtmlx · SVAR) 두 부류다.
- **접근성 관행**: APG 에 시간 격자 · Gantt 패턴이 없다. Google Calendar 는 화면 낭독기에 일정 목록 보기를 권하고, dhtmlxGantt 는 작업 표를 treegrid 로 두고 막대를 그림 (`role="img"`) 으로 두며 날짜는 대화상자에서 고친다.
- 대조 표 전문은 [breakdown §2](design/323-timeline-event-calendar-gantt-breakdown.md).

### Hard constraints

- **HC1** 새 런타임 의존성 0 — 날짜 계산은 이미 쓰는 `@internationalized/date` 로 한다.
- **HC2** D1 예외는 breakdown §4 의 목록으로 닫힌다 (사용자 답 2) — 장식 층의 숨김 속성, 일정 상자 · 막대의 포인터 끌기와 빈 자리 끌어 만들기, Gantt 의 확대. 구현이 쓰는 role · `aria-*` · 키 handler 가 그 목록과 RAC 가 내는 것을 넘으면 안 된다 (정적 검사).
- **HC3** 키보드만으로 모든 편집 — 일정 · 작업의 날짜 바꾸기 · 만들기 · 지우기를 Dialog 와 표의 칸에서 한다. 포인터 끌기에만 있는 편집이 없다.
- **HC4** 대칭: 같은 데이터와 작성 값에서 Canvas 와 Preview 첫 화면의 일정 상자 · 막대 · 표식 rect 가 ±1 px 로 같다. 두 consumer 가 같은 기하 모듈을 읽고, 기준값은 실제 Chrome 의 `getBoundingClientRect` 다.
- **HC5** 성능 (CPU 1x, 4x 병기): 일정 1,000 건 문서의 주 보기에서 보기 전환과 주 넘기기가 frame p95 ≤ 16.7 ms 로 이어지고, Gantt 5,000 행의 세로 스크롤이 같은 문서의 Table 가상 스크롤 기준선 안이며, 끌기 중 frame p95 ≤ 16.7 ms 다.
- **HC6** 번들: 세 컴포넌트의 기하 계산과 실행 코드는 쓰는 문서에서만 읽는 lazy chunk 다. initial Δ 는 사용자 결정 9 안.
- **HC7** 쓰기는 세션 편집 기록 한 길이다 (F6). 컴포넌트가 문서나 data store 를 직접 바꾸지 않는다.
- **HC8** 날짜 값은 기존 `date` 필드 형식 그대로다 — 새 필드 타입을 만들지 않는다. 끝 시각은 exclusive 로 읽는다.
- **HC9** 문서 변환 코드 0 — contract 는 더하기만.

### Soft constraints

- RAC · S2 가 일정표나 Gantt 를 내면 그 컴포넌트로 바꾸고 예외를 지운다.
- RTL 은 대상이 아니다. 날짜 컴포넌트의 `locale` · 달력 체계 선택은 기존 그대로 따른다.
- 사용자는 비개발자다 — 「시작 필드 · 끝 필드」 를 고르면 그려진다.

## Alternatives Considered

### 대안 A: 제3자 라이브러리 도입 (FullCalendar · SVAR Gantt · ReUI 소스)

- 위험: 기술 MEDIUM / 성능 MEDIUM (번들 — F11 의 여유 약 10 KB) / 유지보수 **HIGH** (DOM · 접근성이 RAC 밖이고 Canvas 가 같은 모양을 그릴 수 없다 — Builder 와 Preview 가 달라진다) / 마이그레이션 LOW. 사용자 답 2 에서 기각.

### 대안 B: 일정 · 막대 하나하나에 직접 접근성 구현

- 설명: 시간 격자와 타임라인의 요소가 focus 를 받고 화살표로 옮기고 길이를 조절한다. role · `aria-*` · 키를 직접 적는다.
- 위험: 기술 **HIGH** (APG 에 패턴이 없어 기준을 우리가 만든다) / 성능 MEDIUM / 유지보수 **HIGH** (D1 예외 목록이 크다) / 마이그레이션 LOW. 사용자 답 2 에서 기각.

### 대안 C: 조작 정본은 RAC 목록 · 표, 시간 격자 · 막대는 공용 기하의 그림 (채택)

- 설명: 조작과 낭독은 RAC 부품이 맡는다. 시간 격자의 일정과 Gantt 의 막대는 공용 기하 모듈이 낸 자리에 그리고, 누를 수 있는 일정 · 막대는 RAC `Button` 이다. 포인터 끌기는 같은 편집의 빠른 길이다.
- 근거: F1 · F2 (월 격자 = RAC Calendar · Canvas 계산 그리기) · F3 (공용 기하 선례) · F4 (Table 이 계층 · 가상 스크롤 · 편집을 이미 가진다) · F6 · F9.
- 위험: 기술 MEDIUM (기하 모듈 둘 — 시간 격자 · 날짜 축 막대) / 성능 MEDIUM (HC5) / 유지보수 MEDIUM (닫힌 예외를 유지) / 마이그레이션 LOW.

### 대안 D: Chart 의 종류로 넣기 (Gantt · 일정 = chartType)

- 설명: Chart 의 종류 표에 gantt · schedule 을 더한다.
- 근거: scene · 시간 축 · lazy family 가 이미 있다.
- 위험: 기술 **HIGH** (Chart 에는 쓰기 · 행 계층 · 조작 · 날짜 역할이 없다 — F3. 전부 Chart 에 새로 들여야 한다) / 성능 MEDIUM / 유지보수 **HIGH** (Chart 의 「집계해 보여 주는 그림」 과 「행 하나를 고치는 표면」 이 한 컴포넌트에 섞인다) / 마이그레이션 LOW.

### Risk Threshold Check

| 대안 | HIGH 이상       | 판정               |
| ---- | --------------- | ------------------ |
| A    | 유지보수        | 기각 (사용자 답 2) |
| B    | 기술 · 유지보수 | 기각 (사용자 답 2) |
| C    | 없음 (MEDIUM 3) | 채택 — 루프 불필요 |
| D    | 기술 · 유지보수 | 기각               |

## Decision

**대안 C 를 채택한다.**

1. **공용** — 날짜 축 역할을 `fieldMap` 에 더한다: 시작 · 끝 · 종일 · 진행률 · 선행 · 색 (컴포넌트마다 쓰는 것만). 날짜 값은 `date` 필드 그대로이고 끝은 exclusive 다 (HC8). 위치 계산은 공용 기하 모듈 둘 — 시간 격자 (겹치는 일정의 칸 나누기 · 여러 날 띠의 줄 배정) 와 날짜 축 막대 (눈금 · 막대 · 요약 · 의존선).
2. **Timeline** — `Timeline` > `TimelineItem` (자식 노드 또는 연결된 행마다 반복). 항목은 표식 · 연결선 · 날짜 · 제목 · 자유 내용이다. 순서 목록 구조이고 상호작용이 없다 — RAC 부품도 D1 예외도 쓰지 않는다. `orientation` 과 배치 (한쪽 · 번갈아) 를 고른다. 항목의 상태 표시는 사용자 결정 1.
3. **Event Calendar 의 보기** — 월 · 주 · 일 · 일정 목록 넷을 모두 넣고 실행 중에 바꾼다. N 일 보기와 자원별 보기는 사용자 결정 2.
4. **Event Calendar 의 조작**
   - 월 보기는 RAC `Calendar` 다. 날짜 칸 안에 그 날의 일정 글자 (최대 몇 줄 + 「+N」) 를 그리고, 날짜를 고르면 그 날의 일정 목록이 열린다 — 칸 안의 일정은 누르는 요소가 아니다 (F1).
   - 주 · 일 보기의 일정은 기하 모듈이 낸 자리에 놓인 RAC `Button` 이다. 누르면 편집 Dialog 가 열리고 Tab 으로 시간 순서대로 닿는다. 시간 격자 옆에 일정 목록을 같이 둘지는 사용자 결정 3.
   - 일정 목록 보기는 RAC `GridList` 다.
   - 편집은 Dialog 안의 날짜 · 시간 필드다 (행 편집 폼 — F10). 포인터로는 일정을 끌어 옮기고 양 끝을 끌어 길이를 바꾸고 빈 자리를 끌어 새 일정의 기간을 정한다.
5. **Gantt** — 새 표 엔진을 만들지 않는다. Table 에 「시간축 열」 을 더한다 — 그 열의 칸이 행의 막대를 그리고, 열의 머리글이 날짜 눈금이며, 의존선은 열 위의 장식 층이다. 계층 · 펼침 · 가상 스크롤 · 열 고정 · 정렬 · 칸 편집은 Table 의 것 그대로다 (F4). 막대는 칸 안의 RAC `Button` (누르면 편집) 이고 날짜는 표의 날짜 칸에서도 고친다. 팔레트의 「Gantt」 를 전용 type 으로 둘지 Table 의 구성으로 둘지는 사용자 결정 5.
6. **Gantt 의 범위** — scale 다섯 (일 · 주 · 월 · 분기 · 년) 과 확대, 마일스톤 (시작 = 끝), 묶음 행의 요약 막대, 진행률, 오늘 선, 주말 음영. 의존은 사용자 결정 6. 의존은 그리기만 한다 — 선행이 밀려도 후행을 자동으로 옮기지 않고, 어긋난 의존은 다른 선 모양으로 보여 준다.
7. **쓰기** — 끌기와 편집 Dialog 는 `updateMany` 로 시작 · 끝 (· 진행률) 을 쓴다 (HC7). When 「일정 변경」 · 「빈 자리 선택」 (인자: key · 시작 · 끝) 을 내고, 서버 반영은 작성자의 `callEndpoint` Do 다.
8. **실행 상태** — Event Calendar 의 보기 종류와 기준 날짜, Gantt 의 scale · 보이는 기간은 실행 상태이고 이름 붙인 상태로 읽을 수 있다. 문서에는 시작 값만 저장한다.
9. **D1 예외 (닫힌 목록)** — (1) 장식 층 (눈금선 · 현재 시각 선 · 의존선 · 주말 음영) 요소의 숨김 속성, (2) 일정 상자 · 막대 요소의 포인터 끌기 (옮기기 · 양 끝 길이 조절 · 진행률) 와 빈 자리 끌어 만들기 — `useMove` 의 포인터 handler 와 pointer capture 뿐이고 키 handler 를 붙이지 않는다, (3) Gantt 시간축의 Ctrl / Cmd + wheel 확대. 끌기 결과는 react-aria `announce` 로 알린다. 목록 전문과 그대로 두는 것은 breakdown §4. 규칙 파일 (`.claude/rules/ssot-hierarchy.md` §1 D1) 에는 Accepted 승격 때 승인을 가리키는 한 줄을 넣고 구현이 끝날 때 목록 전문을 옮긴다 (ADR-318 과 같은 방식).
10. **Canvas** — 작성 값과 표본 행으로 정지 모양을 그린다 (시작 보기 · 기준 날짜 · scale). 보기 전환 · 끌기 · 편집은 Preview · Publish 에만 있다.
11. **하지 않는 것**
    - 제3자 라이브러리 (대안 A) · 일정과 막대의 직접 접근성 구현 (대안 B) · Chart 종류로 넣기 (대안 D).
    - 자동 일정 (선행이 밀리면 후행을 옮김) · critical path · baseline · 자원 배정 · 작업 분할.
    - 반복 규칙의 해석 — 사용자 결정 4 의 권고 밖.
    - 내보내기 (PDF · MS Project) · 인쇄 전용 배치.
    - 문서 변환 코드 (HC9).

위험 수용 근거: C 의 남는 위험은 기하 모듈 둘과 Table 시간축 열이다. 기하는 입력 (기간 · 일정 목록 · 눈금) 과 출력 (rect 목록) 이 숫자인 순수 함수라 정답표로 고정할 수 있고, Canvas 와 DOM 이 같은 출력을 읽으므로 대칭이 구조로 선다. 조작과 낭독은 RAC 부품이라 새 접근성 기준을 만들지 않는다.

기각 사유:

- **A** — 사용자 답 2. Canvas 가 같은 모양을 그릴 수 없어 Builder 와 Preview 가 달라진다.
- **B** — 사용자 답 2. APG 에 기준이 없고 예외 목록이 크다.
- **D** — Chart 에 쓰기 · 계층 · 조작을 전부 새로 들여야 하고, 집계 그림과 행 편집 표면이 섞인다.

> 구현 상세: [323-timeline-event-calendar-gantt-breakdown.md](design/323-timeline-event-calendar-gantt-breakdown.md)

### 사용자 결정 (9 건 — 그 Phase 에 닿을 때 묻는다)

|  #  | 항목                                                                                                                 | 권고                                                                                                                                       | 닿는 Phase |
| :-: | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | :--------: |
|  1  | Timeline 항목의 상태 표시 — 항목마다 상태 (완료 · 진행 중 · 예정 — 필드에서 읽음) / 「여기까지 완료」 값 하나 / 없음 | 항목마다 상태 — 이력 데이터의 필드 하나로 표식 색이 정해진다. 「여기까지」 값은 StepList (ADR-321) 의 쓰임이다                             |     2      |
|  2  | Event Calendar 의 추가 보기 — N 일 보기 · 자원별 보기 (회의실 · 담당자마다 열)                                       | 둘 다 넣는다 — 예약 화면은 자원별 보기가 기본 모양이다. 자원 = 역할 필드 하나 (또는 참조 필드)                                             |     4      |
|  3  | 주 · 일 보기의 일정 목록 — 격자 옆에 같이 보인다 (끌 수 있음) / 일정 목록 보기에서만                                 | 같이 보이는 스위치 (기본 꺼짐) — 일정 Button 이 Tab 으로 닿으므로 키보드 조작은 격자에서도 된다. 낭독기 사용자는 일정 목록 보기를 쓴다     |     4      |
|  4  | 반복 일정 — 행 하나 = 일정 한 건 (반복은 데이터가 펼쳐서 준다) / 반복 규칙 (RRULE) 을 컴포넌트가 펼침                | 행 하나 = 일정 한 건 — 업무 시스템은 반복을 서버가 펼쳐 주는 경우가 많고, 규칙 해석은 편집 (이 건만 · 이후 전부) 까지 형식이 따로 필요하다 |     3      |
|  5  | Gantt 의 형태 — Table 의 구성 (시간축 열 + 팔레트 「Gantt」 가 그 구성으로 놓음) / 전용 type `Gantt`                 | Table 의 구성 — 정렬 · 필터 · 묶음 · 편집 · 필터 바 (ADR-320) 가 그대로 따라온다. 새 type 은 같은 기구를 두 번 등록하게 한다               |     6      |
|  6  | 의존의 형식 — 선행 key 목록 필드 (끝 → 시작 한 종류) / 종류 넷 (FS · SS · FF · SF) 과 지연                           | 선행 key 목록 (끝 → 시작) — `array` 필드 하나로 서고 ReUI · frappe 와 같다. 종류 넷은 link 표가 따로 필요하다                              |     7      |
|  7  | 시간대 — 보는 사람의 브라우저 시간대 / 컴포넌트의 `timeZone` (IANA) / 둘 다                                          | 둘 다 (기본 = 브라우저) — 지점이 여러 시간대에 있는 예약 화면은 고정 시간대가 필요하다                                                     |     1      |
|  8  | 끌기의 단위 — 일정은 15 분 · Gantt 는 scale 의 한 칸 / 컴포넌트 prop 으로                                            | prop 으로 (기본 15 분 · 한 칸) — 30 분 · 1 시간 단위 예약이 흔하다                                                                         |     5      |
|  9  | 번들 Δ 수용 범위                                                                                                     | initial Δ ≤ Builder +5,000 · Preview +3,000 B gzip (세 컴포넌트의 등록 · rule · 역할 표 — 기하와 실행은 lazy). 넘으면 보고                 |  각 Phase  |

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                          | 심각도 | 대응                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Canvas 와 DOM 의 일정 · 막대 자리가 어긋난다 — 기하 모듈을 한쪽만 읽거나 (선례의 두 자리: `packages/rendering/src/renderers/skiaPrimitives.ts` 의 `calendar_month_grid` · `chart_scene`), 날짜 → px 변환이 시간대 · 정밀도 (`schemas/dataChange.ts:77`) · 끝 exclusive 에서 갈린다                                                                                                            |  HIGH  | G1 — 기하 정답표 (자정 · 주 시작 · 월말 · 일광 절약 전환일 · 날만 있는 값과 시각이 있는 값) · G3 · G4 · G6 의 Canvas rect = Chrome rect ±1 px                                      |
| R2  | Table 시간축 열이 Table 의 기존 기구를 깬다 — 열 트랙과 폭 (`catalog/runtime/tableTracks.ts`), 가로 스크롤과 열 고정, 가상 스크롤 창, 칸 안 Button 의 focus 이동 (`catalog/runtime/tableOperationsDom.components.tsx`), Canvas 의 Table 그리기                                                                                                                                                |  HIGH  | G0 시제품 P3 (시간축 열 · 5,000 행) · G6 — ADR-315 · 317 의 Table 테스트 전량 통과 · 시간축 열이 없는 Table 의 동작 무변경 · 원복 RED                                              |
| R3  | D1 예외가 목록을 넘는다 — 새 `catalog/runtime/eventCalendar.components.tsx` · `tableTimelineColumn.components.tsx` 가 목록 밖 속성 · 키를 쓰거나, 끌기가 중첩된 스크롤 · iframe 위에서 이어진다 (선례 `catalog/runtime/resizable.components.tsx` 의 pointer capture)                                                                                                                          |  HIGH  | G5 · G7 — 구현의 role · `aria-*` · 키 = breakdown §4 (정적 검사 — 선례 `adr318D1List.static.test.ts`) · 포인터 끌기 없이 같은 편집이 되는 키보드 경로 · G8 VoiceOver 청취 (사용자) |
| R4  | 느리다 — 주 보기의 겹침 계산이 일정 수의 제곱으로 늘거나, 시간축 열의 칸이 보이지 않는 기간까지 그리거나, 끌기 중 매 프레임 세션 쓰기 (`catalog/runtime/catalogPreviewSession.ts:1534` `updateMany`) 가 보기 전체를 다시 그린다 (ADR-318 HC5 에서 잰 경로). 닿는 자리: 새 기하 모듈 둘 · `catalog/runtime/tableTracks.ts` (시간축 열의 폭) · `catalog/runtime/calendarModel.ts` (보이는 기간) |  HIGH  | G0 시제품 P2 · P3 · G8 — HC5 측정. 보이는 기간만 계산하고, 끌기 중에는 요소 style 만 바꾸고 쓰기는 놓을 때 한 번                                                                   |
| R5  | 범위가 넓어 한 ADR 이 오래 열린다 (컴포넌트 셋 · Phase 9)                                                                                                                                                                                                                                                                                                                                     | MEDIUM | 컴포넌트 단위로 닫는다 (Timeline → Event Calendar → Gantt) — 앞 컴포넌트가 닫히면 그것만으로 쓸 수 있다. 나누자는 요청은 결정 지점 1                                               |
| R6  | 날짜 축 역할이 `fieldMap` 의 닫히지 않은 키에 더해진다 — 역할 이름이 컴포넌트마다 갈린다                                                                                                                                                                                                                                                                                                      | MEDIUM | Phase 1 에서 역할 표 한 곳을 두고 세 컴포넌트가 그 표에서 읽는다                                                                                                                   |
| R7  | initial 번들 (F11) — 세 컴포넌트의 등록 몫                                                                                                                                                                                                                                                                                                                                                    | MEDIUM | G0 기준선 · Phase 마다 Δ (사용자 결정 9). 상한 만료 (2026-12-25) 전에 재승인 여부를 보고                                                                                           |
| R8  | Canvas 의 「오늘」 이 날마다 달라 시각 비교가 흔들린다                                                                                                                                                                                                                                                                                                                                        |  LOW   | 달력 모델의 기준 날짜 주입 (F2) 을 그대로 쓴다                                                                                                                                     |

HIGH 가 넷이다. Phase 를 다른 ADR 로 나눌 수 있는지 물었고 나누지 않는다 — 사용자가 이 묶음을 ADR 하나로 정했고 (Status), 넷 중 셋 (R1 · R3 · R4) 은 세 컴포넌트가 같이 쓰는 기하 · 예외 목록 · 끌기에서 나온다. 대신 컴포넌트 단위로 닫는다 (R5).

## Gates

측정 조건 ([measurement-validity.md](../../.claude/rules/measurement-validity.md)): 속도 측정의 문서는 부하용 생성 문서 (규모 전용) 다. 불리한 경우 = 한 주에 일정 200 건이 겹치는 주 보기 · 4 단 계층 5,000 행에 의존 2,000 개인 Gantt · 가장 잘게 확대한 scale. 대조군 = 같은 문서의 시간축 열 없는 Table 가상 스크롤과 교대 3 쌍, 끌기는 「매 프레임 쓰기」 arm 과 「놓을 때 쓰기」 arm 의 교대 3 쌍. 조건 = production 빌드 · headed Chrome · 보이는 탭 · CPU 1x 와 4x. 기하의 기준값은 따로 적은 정답표 (하드코딩한 rect) 이고 Canvas 출력으로 채점하지 않는다. 배치 대조의 기준값은 실제 Chrome 의 rect 다.

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                  | 실패 시 대안                                                          |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| G0   | Phase 0 끝 | 코드 사실 F1 ~ F11 재대조 차이 0 · v3 확인 · ADR-289 행 폼의 적용 범위 · 시제품 4 (월 칸 안 일정 글자의 낭독 · 주 보기 200 건 겹침 · Table 시간축 열 5,000 행 · 끌기와 pointer capture) 의 go / no-go · 번들과 속도 기준선 | no-go 항목은 방식을 바꾸거나 빼고 사용자에게 보고 (D1 은 결정 지점 3) |
| G1   | Phase 1 끝 | 날짜 축 역할 표 · 기하 모듈 둘이 정답표와 일치 (경계 날짜 포함) · 시간대 (결정 7) · 첫 화면 모듈이 기하 모듈을 값으로 import 하지 않음 (정적 검사)                                                                         | 어긋나는 경계를 정답표와 함께 사용자에게 보고                         |
| G2   | Phase 2 끝 | Timeline 등록 게이트 (`pnpm codex:preflight` 의 registration · `d2S2Alignment.static.test.ts`) · contract · 방향 둘 × 배치 셋의 Canvas rect = Chrome rect ±1 px · 연결된 행마다 반복 · 원복 RED                            | 번갈아 배치를 빼고 보고                                               |
| G3   | Phase 3 끝 | Event Calendar 월 보기 · 일정 목록 보기 — 날짜 키 이동이 RAC 그대로 · 날짜를 고르면 그 날의 목록 · 여러 날 띠의 줄 배정이 정답표와 일치 · Canvas = Chrome                                                                  | 여러 날 띠를 날마다의 조각 글자로                                     |
| G4   | Phase 4 끝 | 주 · 일 보기 (· 결정 2 의 보기) — 일정 Button 이 시간 순서로 Tab 에 닿음 · 편집 Dialog 로 날짜를 바꾸면 자리가 정답표대로 · 겹침 배치 · 종일 행 · 현재 시각 선 · Canvas = Chrome                                           | 자원별 보기를 빼고 보고                                               |
| G5   | Phase 5 끝 | 끌어 옮기기 · 길이 조절 · 끌어 만들기가 단위 (결정 8) 대로 쓰고 When 2 가 실행 · 편집 기록 한 건 · 구현의 속성 · 키 = breakdown §4 (정적 검사) · Chrome 과 WebKit live                                                     | 끌어 만들기를 빼고 빈 자리 누르기만                                   |
| G6   | Phase 6 끝 | Gantt 시간축 열 — scale 다섯의 눈금 · 막대 · 요약 · 마일스톤 · 오늘 선의 Canvas rect = Chrome rect ±1 px · Table 테스트 (ADR-315 · 317) 전량 통과 · 시간축 열 없는 Table 무변경                                            | 분기 · 년 scale 을 빼고 보고                                          |
| G7   | Phase 7 끝 | 의존선 (결정 6) · 어긋난 의존 표시 · 진행률 · 막대 끌기 · 확대가 정답표와 일치 · 날짜 칸 편집 = 막대 자리 · 속성 · 키 = breakdown §4                                                                                       | 의존선을 직선으로 줄인다                                              |
| G8   | Phase 8 끝 | HC5 측정 · 번들 (결정 9) · 규칙 문서의 D1 목록 = 구현 · `/evaluate` 종결 live (이력 · 예약 · 공정 화면 하나씩) · VoiceOver 청취와 사용자 확인                                                                              | 넘는 항목을 수리하거나 쓰기를 놓을 때 한 번으로                       |

집행: 각 Gate 의 테스트는 unit · browser project 에 두고 Phase 끝에 실행자가 `pnpm -F @composition/shared test` · `pnpm -F @composition/builder test` (browser 는 `test:parity`) 와 `pnpm codex:preflight` 로 돌려 결과를 breakdown §9 에 적는다. 번들은 `adr201-bundle-gate.mjs` 와 배포 workflow (`push: main`) 의 상한 단계가 막는다.

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 이력 · 일정 · 공정을 날짜 축 위에 보여 주는 화면을 만든다 — 지금은 표와 차트뿐이다.
- 조작과 낭독이 RAC 부품이고, 포인터 끌기에만 있는 편집이 없다.
- Canvas 와 Preview 가 같은 기하 계산을 읽어 일정과 막대의 자리가 같다.
- Gantt 가 Table 위에 서므로 정렬 · 필터 · 묶음 · 편집 · 가상 스크롤이 그대로 따라온다.

### Negative

- 사용자 컴포넌트의 D1 예외가 하나 더 는다 (장식 층 · 포인터 끌기 · 확대).
- 월 보기의 칸 안 일정은 직접 누를 수 없다 — 날짜를 고른 뒤 목록에서 연다.
- 공정 관리 도구의 기능 (자동 일정 · critical path · baseline · 자원) 과 반복 규칙 해석은 없다.
- 범위가 넓다 — Phase 9 · 사용자 결정 9 건이고 contract 와 initial 번들이 오른다.
- Canvas 는 보기 전환과 끌기를 보여 주지 않는다.
