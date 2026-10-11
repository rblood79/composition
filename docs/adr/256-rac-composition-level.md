# ADR-256: RAC 수준의 조립 — 노드 트리를 RAC 부품 그대로 그리고, 넣는 자리를 레퍼런스에서 가져온다

## Status

Accepted — 2026-10-07 (사용자 「승인」 — G0 인벤토리 보고 뒤. G0 뒤 판독 1회는 이 승인으로 갈음)

Proposed — 2026-10-07

사용자 요청: `/create-adr` (2026-10-07). 방향은 같은 날 대화에서 사용자가 정했다.

- 「components tab 내에 각컴퍼넌트별로 slot 에 등록할수있는 항목 이 현재는 지정되어있는데 이것이 RAC ,RSC 개념에 맞는것인지? … pen.dev처럼 자유도가 높게 되어있는 것도아니고 RAC ,RSC 처럼 정확한 개념 대로 정해진 것도 아니고 컴퍼넌트별로 모두 체크 해야한다」
- 「https://react-aria.adobe.com 레퍼런스 기준으로」 · 「RSC는 https://react-spectrum.adobe.com 기준으로 봐야한다」
- 「RAC 수준이 되지 않는다면 빌더를 하는 의미가 없다」 — 이 ADR 의 목표 문장이다.

**사용자 확인 (2026-10-07)** — 세 항목 모두 답을 받았다.

1. 저장 포맷: 「거부해도 된다」 — template 구조가 바뀌는 병합마다 `LIBRARY_CONTRACT_VERSION` 을 올리고 옛 개발용 프로젝트를 거부한다 (변환 0, 보존 대상 프로젝트 0).
2. 상태별 표시: 「showWhen 필드로」 — 노드 필드 `showWhen` 을 문서 스키마에 추가한다 (Decision 7).
3. 레퍼런스 밖 컴포넌트: 「지금 구조 유지」 — Nav · Pagination · FileUpload · Chart 는 이 ADR 범위 밖이고 노드 트리 그리기 경로만 공통으로 쓴다 (Decision 1).

> **2026-10-07 리뷰 round 1 반영** ([reviews/256.md](reviews/256.md) — HIGH 3 · MEDIUM 4, 사용자가 붙여 넣은 판독을 실행자가 코드로 확인): ① 완료 조건을 DOM 구조 비교로 (Decision 11 · G5) ② 이름 붙은 slot 지정 계약 (Decision 4) ③ `showWhen` 의 판정 의미 (Decision 7) ④ render props 값 전달 (새 Decision 12) ⑤ 반복 부품 template (새 Decision 13) ⑥ 필수 부품 = 존재 + context 관계 (Decision 5) ⑦ 예제 세트 확정 계약 · family 연결 · R7 (G0 · breakdown §4). 7건 모두 fixed, pending 0.

> **2026-10-07 리뷰 round 2 반영** ([reviews/256.md](reviews/256.md) — Codex, HIGH 2 · MEDIUM 1, 실행자가 설치 RAC 1.21.0 소스로 확인): ① 상태 주체를 「키마다 그 키를 주는 가장 가까운 부품」 으로 (Button 에 `isExpanded` 없음 · Group 은 자기 상태를 가짐) + `from` (Decision 7) ② slot 제공자 표를 RAC 소스에서 생성 · 실측 표로 정정 (Tag 는 Text slot 없음 · field 는 `description` · `errorMessage` 만) · 맞지 않는 slot 은 `slot={null}` 로 그림 (Decision 4) ③ 값의 비어 있음은 `showWhen` 이 아니라 「빈 바인딩 값 = 노드 없음」 규칙 (Decision 7). 3건 fixed, pending 0.

> **2026-10-07 round 3 수리**: HIGH 2 · MEDIUM 1을 반영했다. Decision 4는 기본 slot/일반 context/명시 null/잘못된 이름을 구분한다. Decision 7은 값 바인딩과 제한된 `presentWhen`을 분리하고 FieldError fallback을 유지하며, 중첩된 동일 type의 주체는 저장 주소로 지정한다. 앞선 round 2 요약의 일괄 null·빈 바인딩 생략 규칙은 이 수리로 대체한다. [round 3 반영 기록](reviews/256.md)에 근거를 남긴다.

> **2026-10-07 G0 인벤토리 고정** ([evidence](evidence/256-g0-inventory.md) · [예제 원문](evidence/256-g0-examples.md) · [RAC 실행 결과](evidence/256-g0-rac-inventory.json)): 설치 RAC 1.21.0 을 jsdom 에 실제로 마운트해 slot 제공자 · render props · 필수 짝 · children 종류를 뽑았다 (`apps/builder/scripts/adr256-g0-rac-inventory.mjs`, 2회 동일). evidence 폴더는 로컬 전용이라 결론은 [breakdown §2-5](design/256-rac-composition-level-breakdown.md) 에 둔다. 본문 정정 — F7 (TabPanels 는 자유 내용) · F11 · Decision 4 (제공자 행 추가) · Decision 5 (collection 항목은 context 관계 · Table 열 수) · Decision 7 (조건 키 4개 추가) · Decision 8. breakdown §1 의 RadioItems 판정 (레퍼런스에 `div.radio-items` 가 있다 → 유지) · §4 예제 3개를 레퍼런스에 있는 코드로.

> **2026-10-08 Phase 1 완료** (G1 · G4, [breakdown §5](design/256-rac-composition-level-breakdown.md)): 판정 하나 (children 종류) · 넣기 목록 · 원본 루트 slot · 이름 붙은 자리 4 경로 (RAC Text) · 필수 짝. live 16/16.

남은 것: Phase 1 판독 1회 · Phase 2 ~ 11.

> **2026-10-09 Phase 9 범위 보강 (사용자 지시)**: 「포함시켜」 — Calendar · RangeCalendar 의 Month and year pickers 를 추가한다. 「visibleDuration과 day,week,month 셀렉트 조합 으로 Calendar 보기를 변경한다」 — 월 전용 `maxVisibleMonths` 계약을 일 · 주 · 월 표시 기간으로 확장한다 (Decision 8 · 14, [breakdown §3-1](design/256-rac-composition-level-breakdown.md#3-1-phase-9-추가-계약-2026-10-09-사용자-지시)). 계획 반영이며 구현·Gate 통과 기록은 아니다.

> **2026-10-09 Round 22 m1 설계 수리** (사용자 「리뷰 결과 대로 설계 보완해」): `visibleDuration` 객체 저장에 필요한 전용 duration 값 타입 · Inspector kind · accepts/default 생성 · 문서/graph/library 검증을 Decision 14 와 breakdown §3-1 의 선행 작업으로 추가했다. 원자적 편집과 잘못된 입력 거부, undo/redo · 저장 후 로드를 완료 기준에 명시했다. [Round 23 수리 확인](reviews/256.md#round-23--2026-10-09-reviewer-codex) 에서 설계 누락을 종결하며, 제품 구현 · live · G2 · G4 는 미수행이다.

> **2026-10-09 Round 24 설계 수리** (사용자 「리뷰 결과대로 설계 보완해, firstDayOfWeek · weeksInMonth 도 포함」 — [reviews/256.md](reviews/256.md) Round 24 MEDIUM 3): ① DatePicker · DateRangePicker 안 Calendar 의 prop 소유를 RAC calendar context 와 같게 — `firstDayOfWeek` · `pageBehavior` 는 picker, `visibleDuration` · `weeksInMonth` 는 안 Calendar 노드, picker 의 `maxVisibleMonths` 삭제 ② 여러 달 표시 = 새 `CalendarMonth` 한 달 블록 (header + grid) 반복 template — 레퍼런스 starter 구조 ③ Preview 실행 중 보기 전환은 범위 밖 — 레퍼런스의 수량 + Days/Weeks/Months Select 는 문서 페이지의 prop 편집기이고 Builder 의 대응은 Properties ④ Display options 조작 패널의 `firstDayOfWeek` · `weeksInMonth` 추가 (Decision 14 · [breakdown §3-1](design/256-rac-composition-level-breakdown.md#3-1-phase-9-추가-계약-2026-10-09-사용자-지시)). 설계 수리이며 구현·Gate 통과 기록은 아니다.

> **2026-10-11 Phase 9 구현** (`/execute-adr ADR-256 Phase 9 Calendar`, [breakdown §5](design/256-rac-composition-level-breakdown.md)): 9a 문서 값 `calendarDuration` + Display options (`visibleDuration` 수량 · Days/Weeks/Months · `weeksInMonth`, picker 의 `maxVisibleMonths` 삭제 — 로드 시 전환) · 9b Calendar · RangeCalendar 노드 트리 = 레퍼런스 starter (`frame > CalendarMonth` 반복 > header (Button[previous] · CalendarHeading · Button[next]) + CalendarGrid > CalendarCell) · 9c CalendarMonthPicker · CalendarYearPicker · 9d 요일 칸 · DateSegment 반복 template (Decision 13 — 명시 제한 없이 구현). contract 37. G2 (starter 구조 비교) · G3 Calendar 계열 PASS · G4 ratchet A 0 · live 12/12. 판독 1 + 수리 검증 1 (MEDIUM 2 수리, HIGH 0) → 닫힘.

> **2026-10-11 Phase 10 구현** (`/execute-adr ADR-256 Phase 10`, [breakdown §5](design/256-rac-composition-level-breakdown.md)): 사용자 결정 2건 (같은 날) — ① Card 는 「S2 그대로」: `title` · `description` prop 삭제, 글자는 `Content` 안 `Text[slot=title]` · `Text[slot=description]` 노드 (Card 가 S2 `TextContext` slot 을 준다) ② CardContent · CardFooter → 범용 S2 `Content` · `Footer` (Card · InlineAlert 공용 — 배치는 부모 rule), CardHeader 삭제. 10a Card · InlineAlert (`Heading + Content > Description`) S2 구조 · 10b CardView = RAC GridList (Card = GridListItem, 선택은 RAC) · ButtonGroup · AvatarGroup 제한 행 삭제 (자유 내용, 자기 중첩 금지). Decision 9 의 Card `Content` 자유 내용 (F3) 이 열렸다. contract 38. G2 `adr256CardS2.test.tsx` 11 · G3 Card · InlineAlert · CardView PASS · G4 ratchet A 0 · live 9/9 · 6/6. 판독 1 (MEDIUM 1 수리) + 수리 검증 1 (HIGH 0) → 닫힘. 제한 표 남은 행 (ColorSwatchPicker · TableView · Pagination · Toast · ColorPicker) 은 Phase 11.

> **2026-10-12 Phase 11 구현 — G5 판정 대기** (`143910811` · `e95de6862` · `0289b3190`, [breakdown §5](design/256-rac-composition-level-breakdown.md)): 미전환 family 제한 표 (`UNCONVERTED_FAMILY_LIMITS`) 의 마지막 5행을 지우고 표를 삭제했다 — ColorSwatchPicker · TableView 는 RAC collection, Pagination · Toast · ColorPicker 는 자유 내용 (Toast 안 Toast 는 막음). 예제 15개를 Builder UI 로 조립 · 재열기 · 구조 비교 · Canvas = Preview 로 실행해 결함 13건을 찾아 모두 고쳤다 (사용자 결정 1건 — 결함 7 「A — 값 고정」: `{key}` 바인딩 template 위치에 자식을 넣으면 Detach 처럼 그 순간의 값으로 고정). contract 39. 결과 — 통과: 예제 1 · 3 · 4 · 8 · 12 · 15 (예제 6 은 스크립트가 일부러 넣은 글자만 다름). **통과하지 못한 예제 (G5 「실패 시 대안」 — 사용자 판정 대기)**: ① trigger 를 감싸는 div (예제 2 · 9 — ADR-255 의 DialogTrigger · MenuTrigger 요소) ② SearchField 의 `Group` (예제 5 — 레퍼런스는 Group 없음) ③ Checkbox 아이콘 요소 (예제 7 · 11) ④ Image 의 `div` (예제 10 · 13) ⑤ Card 의 S2 기준값 (예제 13) ⑥ ProgressBar indeterminate 의 Canvas 채움 고정 (예제 14 — 구조는 통과). 판정 뒤 Implemented 와 `### Live Exercise` 를 적는다.

> **2026-10-12 Phase 11 — G5 남은 차이 레퍼런스대로** (사용자 「레퍼런스에 맞게 고쳐」, contract 40): ① DialogTrigger · MenuTrigger · TooltipTrigger 는 RAC 처럼 요소가 없다 (Canvas `display: contents`) ② SearchField 는 control Group 없이 레퍼런스 grid (`0px 1fr auto`) ③ Checkbox 표시 상자는 늘 `svg` (선택 전엔 sheet 가 숨김) ④⑤ S2 기준값 = `@react-spectrum/s2` 1.8.0 실물 마운트 (테스트 전용 devDependency — Card `aria-disabled` 제거 · CardPreview `div[slot=preview] > div` · Footer `footer` · Image = 상자 안 `img`) ⑥ ProgressBar indeterminate 채움은 트랙 전체 상자에 고정, 칠만 움직인다. 실제 Builder 재실행: 예제 1 · 2 · 3 · 4 · 5 · 7 · 8 · 9 · 12 · 14 · 15 구조 통과 + Canvas = Preview, 6 은 스크립트 확인용 글자만. 정해진 차이로 접으면 통과: 10 (우리 Image = S2 Image 상자 · RAC 예제는 맨 `img`) · 11 (Column 글자 span — 10-09 결정) · 13 (S2 Button 의 글자 span — 우리는 RAC Button). 판정 대기 2건은 같은 날 사용자 「둘 다 레퍼런스대로 고쳐」로 닫았다 — 아래 블록.

> **2026-10-12 Phase 11 — 판정 2건 레퍼런스대로** (사용자 「둘 다 레퍼런스대로 고쳐」): ⑦ 정렬 가능 열 (`allowsSorting`) 의 정렬 표시는 레퍼런스의 `span.sort-indicator` 다 — 이름 Group 바로 뒤에 늘 있고 정렬 전에는 `visibility: hidden` (자리는 남음), 오름차순이면 위 chevron · 그 밖엔 아래 chevron (16px · 좌우 2px). 정렬 가능 열은 레퍼런스 `.column-header` 처럼 가로 줄이고 이름 Group 이 나머지 폭을 쓴다 (Column rule `allows-sorting` 블록). Canvas 는 정렬 상태가 없어 그리지 않고 그 자리만 이름 옆에 비운다 (`catalogColumnSortNameGroup` — Breadcrumb 구분자와 같은 방식). ADR-257 Phase 4 의 S2 방식 (정렬됐을 때만 글자 앞에) 을 대체한다. ⑧ Image 는 S2 Card 의 CardPreview 안에서만 S2 Image (상자 안 `img`) 이고, 그 밖에서는 RAC 예제처럼 맨 `img` 하나가 상자다. contract 무변경 (40). 실제 Builder 재실행: 예제 10 은 접기 없이 구조 통과 + Canvas = Preview · 예제 11 정렬 가능 열은 글자 span (10-09 결정) 만 접으면 통과 + Canvas 어긋남 0 · Preview 에서 Price 를 누르면 표시가 열 끝에서 보이고 방향대로 바뀐다 · 예제 13 은 S2 Button 글자 span 만.
