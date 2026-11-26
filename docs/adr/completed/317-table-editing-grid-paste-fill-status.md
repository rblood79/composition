# ADR-317: Table 편집 격자 — 붙여넣기 · 채우기 손잡이 · 편집 상태 표시 · 줄무늬 행 (ADR-315 칸 범위 선택의 D1 예외를 넓힘)

## Status

Implemented — 2026-11-26 (G6 · 사용자 답 「같은 표 기준으로 통과」 + P5 VoiceOver 청취 사용자 「확인했다」 — 붙여넣기 · 지우기 · 잘라내기 · 채우기 결과 알림을 focus 이동 없이 읽음). Accepted — 2026-11-26 (사용자 `/execute-adr 317` + [reviews/317.md](../reviews/317.md) round 2 pending 0 · HIGH 0). Proposed 2026-11-25.

> **Phase 6 종결 (2026-11-26 — G6, 사용자 답 「같은 표 기준으로 통과」 · P5 VoiceOver 청취 통과 → Implemented)**: HC5 · 번들 · D1 정적 검사 · `/cross-check` · 종결 live. **끈 표 (끈 arm ↔ 켠 arm 교대 3 쌍, production · 10,000 행)**: 로드 · 힙 · 정렬 클릭 · 스크롤 p95 중앙값 비율 0.91 ~ 1.09 (≤ 1.10), Phase 0 빌드 ↔ 지금 교대 3 쌍도 기본 표 · Editable 표 모두 0.95 ~ 1.08 (4x 스크롤 p95 는 50 Hz frame 한 칸 차이라 frame 당 작업 1.04 로 봄) — 회귀 없음. **1,000 칸 붙여넣기**: 정답 행 · 알림 「1000 cells」 일치, 1x 240 ~ 275 · 4x 930 ~ 1,219 ms — F9 (「Editable」 열 없는 표의 정렬 1x 161 ~ 169 · 4x 617 ~ 648) 보다 높고, 붙여넣기가 할 수 있는 표 (Editable 열) 의 정렬 클릭과 같은 페이지에서 짝으로 재면 3 / 3 이하 (1x 240 ~ 251 ↔ 285 ~ 296 · 4x 935 ~ 986 ↔ 1,013 ~ 1,105 ms). 비용은 행 다시 읽기 (flatten — 정렬과 같은 크기) 와 React 그리기. **사용자 답: 기준값 = 같은 표의 정렬 클릭.** 번들 Phase 0 대비 Builder +1,689 · Preview +61 B (사용자 결정 7 안). D1 예외 목록 ↔ `tableCellSelection.ts` 의 이벤트 · 키 · ARIA 정적 검사 (`adr317D1Exception.static.test.ts`, 변이 RED 5/5). `/cross-check` Chrome · WebKit 4/4 (줄무늬 · 병합 묶음 칠 Canvas = Publish = 정답). 종결 live 재확인 (Phase 2 ~ 5 하니스, Chrome · WebKit) 통과 — 잘라내기 live 를 더했다 (Phase 2 에서 단위 테스트까지였던 것). 측정 환경: 창이 50 Hz 모니터에 떠 「120 Hz」 조건을 못 지켜 판정은 같은 시점 교대 · 짝 측정으로만 했다. 상세: [breakdown §9 Phase 6](../design/317-table-editing-grid-paste-fill-status-breakdown.md).

> **Phase 5 종결 (2026-11-26 — G5)**: 줄무늬 행. Table 「Striped rows」 (`isStriped` — composition 확장, 기본 꺼짐 · 모양 구획) 는 보이는 순서의 둘째 데이터 행마다 `{color.table-stripe}` (새 토큰 — tone 50) 를 칠한다. 짝 · 홀은 resolver 가 정렬 · 거르기 · 묶기 뒤 · 창이 자르기 전의 행에서 한 번 센다 (`catalogStripedRows` — 묶음마다 다시 · 트리 하위 행 이어서 · 상세 행은 그 행의 것 · 고정 행 제외, 연결 없는 Table 은 작성 순서) → Row 파생 값 하나를 Canvas (Row rule 파생 `striped` 블록) 와 DOM (`data-striped` → Table rule 블록, 행 상태 블록 앞 — hover · 선택 · 편집 표시 · 칸 선택이 이긴다, inline 금지) 이 읽는다. **G5 의 병합 칸 질문**: 「병합 칸이 없는 표에만」 대안을 쓰지 않고, 병합 묶음 (눈에 한 칸) 의 칸이 묶음 첫 행의 줄무늬를 따른다 (Cell `stripe` `on` · `off`). contract 그대로 (78). Canvas 수리 1: variant `alpha: 0` 인 rule (Cell) 이 record 의 바탕까지 투명하게 그리던 것 (`resolveCatalogPaint`). 검사: 새 테스트 12 (단위 5 · DOM 4 · Canvas 3) · 변이 RED 16/16 · 회귀 새 실패 0 (깨끗한 worktree) · 번들 Builder +259 · Preview +60 B (Phase 4 대비) · live Chrome · WebKit 8/8 (Design 패널 스위치 → Canvas 표본 · 병합 칸 → Publish 짝 · 홀 · 계산된 바탕 · 선택 칠 · 가상 스크롤 500 행) — live 가 병합 표의 inline 줄무늬 (선택 칠을 덮음) 를 잡아 고쳤다. 상세 [breakdown §9](../design/317-table-editing-grid-paste-fill-status-breakdown.md).

> **Phase 4 종결 (2026-11-26 — G4)**: 편집 상태 표시 · 저장 When. Table 「Edit marks」 (`showEditMarks` — composition 확장, 기본 꺼짐) 를 켠 표는 세션 편집 기록에서 저장되지 않은 행을 표시한다 — Row `data-edit-status` (`new` · `dirty`) · 고친 칸 `data-edited` · 첫 데이터 칸 앞 가장자리 선과 그 칸 안 낭독 글자 (색만으로 알리지 않음). 표시는 replay 가 편집이 만든 항목 객체에 붙이고 (WeakMap 표 — replay 의 사본마다 옮김) 지금의 key 로 읽는다 — 위치 key collection 에서 넣기 · 지우기 뒤에도 같은 항목에 남는다. **사용자 결정 1 확정 「Table When 하나」**: When 「Cells change」 (`onCellsChange` — 인자 `keys` · `items` · `cells`, 붙여넣기 · 채우기 · 지우기 한 번에 한 번) — 새 trigger 라 **contract 77 → 78**. **사용자 결정 6 확정 「칸까지 · 저장 성공 때도 지움」**: `callEndpoint` 가 있는 규칙이 성공하면 그 규칙이 보낸 편집 (이벤트가 실은 편집 번호 + 그 규칙의 Do 가 저장 전에 만든 편집) 을 저장된 것으로 적고, 칸은 마지막으로 쓴 편집이 저장됐을 때만 표시가 사라진다 — 보낸 뒤 다시 고친 칸은 남고 실패는 아무것도 지우지 않는다. EditableCell 저장도 같은 길 (Form submit 이벤트에 그 편집 번호). 검사: 새 테스트 9 (편집 표시 4 · 저장 표시 3 · 트리 사본 2) · 변이 RED 11/11 · 회귀 새 실패 0 (남은 실패는 작업 트리의 ADR-318 WIP 와 부하 중 시간 초과 — 깨끗한 worktree · 단독 실행에서 통과) · 번들 Builder +1,238 · Preview +2 B (Phase 3 대비, ADR-318 WIP 제외) · live Chrome · WebKit 7/7 (Builder Design 패널 → 규칙 → Publish: 표시 · 요청 본문 · 성공 뒤 보낸 칸만 지움 · 다시 고친 칸 남음 · 실패 남음). 상세 [breakdown §9](../design/317-table-editing-grid-paste-fill-status-breakdown.md).
>
> **Phase 3 종결 (2026-11-26 — G3)**: 채우기 손잡이. Table 「Fill handle」 (`allowsFilling` — composition 확장, 「Cell selection」 이 켜져야 보임) 을 켠 표는 마지막 범위의 오른쪽 아래 칸에 손잡이 요소 하나 (`span[data-fill-handle][aria-hidden]` — 칸 선택 lazy chunk 가 그 칸에 붙이고 떼며, 모양은 Table rule 의 `rootSelectors` — 생성 CSS) 를 둔다. 손잡이 끌기는 범위 끌기와 따로 (`pointerdown` 에서 갈라 범위가 그대로), 먼저 범위를 벗어난 축 (행 · 열) 으로만, 그려진 행의 상자로 판정하고 표 가장자리에서 자동 스크롤한다 — 놓으면 범위의 값을 그 방향으로 되풀이해 묶음 쓰기 한 번 (`catalogFillPlan` — 위 · 왼쪽은 무늬가 거꾸로 이어진다). **사용자 결정 2 확정 「Ctrl / Cmd + D 만」** (범위의 첫 행을 아래로, 한 행이면 위 행을 그 행에) · **결정 5 확정 「값 복사만」**. 채우는 값은 데이터 층의 값 그대로라 (`tableCellValues`) 다른 타입 열로는 쓰지 않고 센다. ADR-315 범위 끌기도 `elementFromPoint` 가 칸을 못 찾을 때 (RAC 스크롤 중) 행 상자 판정으로 넘어간다. 패널 칩 규칙의 「Fill」 접두 판정을 `fill*` key 로 좁혔다 (「Fill handle」 이 Fill 묶음의 「Handle」 로 보이던 것). 검사: 새 테스트 6 (계획 2 · 표 3 · 칩 1) · 변이 RED 6/6 · 회귀 새 실패 0 · 번들 Builder +185 · Preview −2 B (Phase 0 대비) · live Chrome · WebKit (Builder Design 패널 칩 → Publish: 손잡이를 표 아래 밖으로 끌어 자동 스크롤 → p55 · p99 까지 Name 1 / 1 · Name 2 / 2 되풀이 · type 그대로 · 「칸 194개 채움 · 97개 건너뜀」, Ctrl / Cmd + D · page error 0).
>
> **Phase 2 종결 (2026-11-26 — G2, VoiceOver 청취 사용자 「확인했다」)**: 붙여넣기 · 잘라내기 · 지우기. Table 「Paste」 (`allowsPasting` — composition 확장, 「Cell selection」 이 켜져야 보임) 를 켠 표는 브라우저 `paste` 의 `text/plain` 을 마지막 범위의 왼쪽 위부터 보이는 행 · 그려진 열 순서로 놓고 (값 하나면 범위 전체), 표 끝을 넘는 줄 · 열은 버리고 센다 (**사용자 결정 4 확정 「버리고 알림」**). Delete · Backspace 는 범위를, Ctrl / Cmd + X 는 복사 뒤 마지막 범위를 비운다 (**사용자 결정 3 확정 「넣는다」**). 쓰기는 모두 Phase 1 의 `editTableCells` 한 번이고 결과는 표 옆 `role="status"` 한 줄 (「칸 4개에 붙여넣음 · 2개 건너뜀」 — 화면 낭독 전용, 문구는 칸 선택 lazy chunk 안 4 개 언어). 클립보드 글자는 shared `collections/intake/tabText.ts` (Excel 따옴표 칸 · 칸 안 줄바꿈 · `""` — Builder `pasteRows.ts` 와 따옴표 없는 줄은 같은 칸). 표 안에 focus 가 있으면 `beforecopy` · `beforecut` · `beforepaste` 를 막아 Safari 편집 메뉴를 켠다. D1 예외 목록은 `.claude/rules/ssot-hierarchy.md` 에 옮겼다 (손잡이는 Phase 3). 검사: 새 테스트 13 (파서 5 · 표 8) · 변이 RED 7/7 · 회귀 새 실패 0 · 번들 Builder +26 · Preview −1 B (Phase 0 대비) · live Chrome · WebKit (Builder Design 패널 → Publish: 복사 → 붙여넣기 · Excel 형식 (Chrome) · Delete · Ctrl / Cmd + A 뒤 한 값 1,000 행 — 화면 반영 Chrome 164 ~ 219 · WebKit 196 ms, dev 빌드 · 1x). 남은 것: P5 — 알림 영역을 VoiceOver 가 읽는지 사용자 청취. 10,000 행 production 시간은 Phase 6 (HC5).
>
> **Phase 1 종결 (2026-11-26 — G1)**: 묶음 쓰기. 세션 `updateMany` 가 여러 행 · 여러 필드를 편집 기록 한 건 (`updateMany` — replay 는 key → patch 한 번 훑기) · 행 다시 읽기 1 번으로 쓰고, 표 controller `editTableCells` 가 「Editable」 열의 데이터 행 칸만 골라 넘긴다 (편집 불가 열 · 묶음 · 합계 · 상세 행은 사유별 수). 값마다 `update` 와 같은 판정 하나 (`itemFields` — 열 타입으로 읽지 못한 값 · 다른 타입 값 · 계산 필드 · key 필드 · schema 밖 필드는 쓰지 않고 센다). **사용자 결정 8 확정 「맞춘다」**: `update` (EditableCell · 규칙 Do update) 도 읽지 못한 값을 `null` 로 쓰지 않고 원래 값을 남기며 사유를 돌려준다 (모든 필드가 그러면 실패 — 뒤 Do 가 돌지 않는다). `append` · `insert` 의 변환은 그대로다. 검사: 새 테스트 6 (정답 값은 손으로 적음) · 변이 RED 6/6 · 회귀 새 실패 0 · 번들 Builder +1 · Preview −2 B · live (Builder → Publish: 숫자 열 EditableCell 에 「abc」 저장 → 2 유지 + 경고 · 「7」 → 7 · 빈 값 → 빈 칸).
>
> **Phase 0 종결 (2026-11-26 — G0)**: 코드 사실 F1 ~ F8 재대조 차이 0 (코드 무변경 — 착수 HEAD `e8c51fa2a` 는 `56e769429` 위 문서 커밋. `presence.ts` 줄 번호만 5979 → 5970). 시제품 (`apps/builder/scripts/adr317-phase0-prototypes.mjs` — 설치된 RAC 1.22.1 + 제품의 `attachCatalogCellSelection`, Chrome · Playwright WebKit): **P1 go** (gridcell focus 에서 Ctrl / Cmd + V 의 `paste` 가 표에 오고 우리 복사 → 붙여넣기 값이 정답과 같음, `beforepaste` 유 · 무 둘 다) · **P2 go** (가상 2,000 행에서 손잡이 끌기 · 자동 스크롤로 창 밖 151 행까지 · 손잡이 요소가 해제돼도 이어짐 · 범위 끌기와 갈림) · **P4 go** (데이터 층 순서의 짝 · 홀이 스크롤 · 정렬 뒤에도 화면 순서와 같음). P3 (1,000 칸 시간) 은 묶음 쓰기 위에서만 잴 수 있어 Phase 2 live 로 · P5 (알림 낭독) 는 Phase 2 live 에서 사용자와. 시제품이 설계에 더한 것: (1) RAC `ScrollView` 는 스크롤 중 · 끝난 뒤 300 ms 까지 내용에 `pointer-events: none` 을 건다 (`react-aria/dist/private/virtualizer/ScrollView.mjs:267`) — 끌기 판정은 `elementFromPoint` 가 아니라 그려진 행의 상자로, (2) 손잡이의 `pointerdown` 은 범위 끌기 (표의 capture listener) 보다 먼저 잡는다 (document capture), (3) 가상 표의 칸은 `presentation` 감싸개 안이라 줄무늬 칠은 행의 직계 자식이 아니라 칸을 겨눈다, (4) react-aria `useClipboard` 처럼 `beforecopy` · `beforecut` · `beforepaste` 를 막아 Safari 편집 메뉴를 켠다 (Playwright WebKit 은 메뉴 판정을 지나지 않아 확인 못 함). D2: S2 1.8.2 · design-data · v3 어디에도 붙여넣기 · 채우기 · 행 상태 · 줄무늬 prop 이 없다 → composition 확장 (`d2Provenance.ts`, 이름은 그 Phase 에서). design-data Table 지침은 「Don't use zebra stripes」 — **사용자 답 「composition 확장으로 유지」** (Phase 5 그대로, 기본 꺼짐). **ADR-315 G6 통과 (사용자 답 2026-11-26)** — Phase 2 착수 조건 충족. 기준선 (착수 HEAD): 번들 Builder initial JS gzip 1,634,043 · Preview 172,215 B (일반 `vite build` + closure) · 10,000 행 (production · headed Chrome) 로드 401 ms · 힙 157 MB · 정렬 클릭 1x 161 ~ 169 · 4x 617 ~ 648 ms · 스크롤 p95 1x 25 · 4x 118 ms.

- 사용자 요청 (2026-11-25): 「https://reui.io/components/data-grid 도 분석해줘」 → 대조 보고 (ReUI 에만 있는 것: 붙여넣기 · 채우기 손잡이 · 행 상태 표시 · 줄무늬 행, 「붙여넣기와 채우기 손잡이는 ADR-315 의 D1 예외 목록을 넓혀야 한다」) → 「ADR-315의 D1 예외 목록을 넓히고 ADR로진행」. `/create-adr` skill 은 모델이 호출할 수 없어 같은 작성 규칙 ([adr-writing.md](../../../.claude/rules/adr-writing.md)) 을 직접 적용했다.
- 사용자가 이미 답한 것: **D1 예외를 넓힌다** (결정 지점 3 — SSOT 경계). 넓히는 범위는 [breakdown §4](../design/317-table-editing-grid-paste-fill-status-breakdown.md) 의 목록으로 닫고, 그 목록의 선택 항목은 아래 사용자 결정 2 · 3 이다.
- 리뷰: [reviews/317.md](../reviews/317.md) — round 1 (HIGH 1 · MEDIUM 2 · LOW 4) → 문서 수리 → round 2 수리 검증 HIGH 0 · pending 0 (LOW 4 deferred). 수리로 사용자 결정 8 이 생겼다.

## Context

### 도메인

- **D1 (DOM · 접근성)**: 화면은 설치된 `react-aria-components` 1.22.1 의 Table 그대로다. ADR-315 가 둔 예외 (칸 범위 선택 — `aria-selected` · `aria-multiselectable` · 범위 키 · 복사) 를 이 ADR 이 **붙여넣기 · 채우기** 로 넓힌다 (사용자 답). 넓힌 범위도 속성 · 키 · 포인터 목록으로 닫는다.
- **D2 (Props)**: 설치된 S2 `TableView` 1.8.2 에는 붙여넣기 · 채우기 · 행 상태 · 줄무늬가 없다 (`TableView.tsx` — 편집은 `EditableCell` 의 `renderEditing` · `isSaving` · `onSubmit` · `onCancel` 뿐, `:1586-1594`). 새 prop 은 design-data · v3 를 확인한 뒤 (Phase 0) 없으면 composition 확장으로 `d2Provenance.ts` 에 적는다.
- **D3 (시각)**: 줄무늬 행 · 편집 상태의 칠 · 채우기 손잡이의 모양은 catalog rule 이 정본이다. 줄무늬는 작성 값이라 Canvas 와 DOM 이 같이 그리고, 편집 상태 · 손잡이는 실행 중 상태라 Preview · Publish 에만 있다 (ADR-315 HC9 의 설계된 비대칭).
- 행 쓰기 · 값 변환은 D1 ~ D3 밖의 데이터 층이다 (ADR-284 · 287 · 313).

### 문제

고객은 대량 데이터를 조회하고 고친다. ADR-315 로 Table 은 TanStack Table v9 의 기능 17 개를 갖췄고 S2 `EditableCell` 로 칸 하나를 고칠 수 있다. 그런데 여러 칸을 한 번에 고치는 길이 없다 — 범위를 골라 복사는 되지만 붙여넣을 수 없고, 같은 값을 아래로 채울 수 없고, 고친 행이 어느 것인지 화면에 보이지 않는다. ReUI Data Grid (TanStack Table v9 위의 shadcn 래퍼) 와 대조한 결과 ([breakdown §2](../design/317-table-editing-grid-paste-fill-status-breakdown.md)):

- **우리에게 없는 것 4** (이 ADR 의 범위): 붙여넣기, 채우기 손잡이, 행 · 칸의 편집 상태 표시, 줄무늬 행.
- **이미 있는 것**: ReUI 예제 34 개 가운데 나머지 표 기능 (정렬 · 필터 · 열 조작 · 행 선택 · 펼침 · 고정 · 합계 · 가상화 · 칸 범위 선택 · 복사 · 칸 편집 · 행 끌기).
- **하지 않기로 이미 정한 것**: 여러 줄 머리글 (ADR-315 Decision 10 — RAC `Column` 은 leaf).

TanStack Table v9 의 기능 17 개에는 편집 · 붙여넣기 · 채우기가 없다 (ADR-315 breakdown §2). ReUI 가 자기 층에서 만든 것이고, 가져올 것은 코드가 아니라 동작의 뜻이다.

### 코드 사실 (2026-11-25 실측, HEAD `56e769429`)

- **F1 칸 범위 선택은 lazy 모듈 하나다.** `runtime/tableCellSelection.ts` (275 줄) 의 `attachCatalogCellSelection` 이 표 요소에 listener 를 붙인다 — `pointerdown` · `pointermove` · `keydown` (capture) · `focusin` · `copy` (`:219-247`). 범위는 (행 key, 열 key) 두 점이고, 복사는 그려진 칸이 아니라 데이터 층의 값을 읽는다 (`CatalogCellSelectionSource.text`). `paste` listener 는 없다.
- **F2 행 쓰기는 세션 한 곳이다.** `CatalogPreviewSession` 이 collection 마다 편집 기록 `itemEdits: Map<string, CatalogItemEdit[]>` 를 갖고 (`catalogPreviewSession.ts:560` — `append` · `insert` · `update` · `remove` · `move`, `:163`), 바운드 컴포넌트는 원본 행에 그 기록을 다시 적용한 결과를 읽는다 (`itemSources`, `:1062`). 규칙의 Do `update` 와 `EditableCell` 의 저장이 같은 `update` (`:1271`) 를 부른다.
- **F3 칸 편집의 저장 길.** `EditableCell` 의 submit → `catalogEditableCellProps` 의 `onSave` (`domBinding.runtime.ts:937-952`) → `CatalogTableController.editTableRow` (`catalogTableController.ts:800`) → 세션 `update`. 서버 저장은 그 Form 의 When `onSubmit` 에 작성자가 건 `callEndpoint` Do 다 (사용자 결정 2026-11-23 「세션 update · 저장은 callEndpoint」).
- **F4 값 변환은 한 곳이다.** 세션은 쓰는 값을 schema 필드로 거르고 ADR-313 의 진입 변환 `normalizeRows` 를 지난다 (`itemFields`, `catalogPreviewSession.ts:1135-1148` · `collections/intake/normalizeRows.ts:192` — 열 타입으로 읽히지 않는 글자는 `unread` · `precision` 으로 세고 `null` 이 되며 (`:164-178`), 글자가 아닌 값의 타입 차이는 `typeMismatch` 로 세고 값은 그대로다 (`:184`). `itemFields` 는 report 를 읽지 않아 `update` 는 그 `null` 을 쓴다). key 필드는 `update` 가 쓰지 않는다 (`:1292`).
- **F5 편집 한 건마다 행을 다시 읽는다.** `edit` 는 기록을 더할 때마다 `currentRoot.refreshRows()` 를 부른다 (`catalogPreviewSession.ts:1149-1171` → `compositionRoot.ts:3053`). 칸 100 개를 `update` 100 번으로 쓰면 행 다시 읽기가 100 번이다.
- **F6 편집 기록은 다시 불러오면 사라진다.** `showLoaded` 가 collection 의 불러온 행을 바꾸면서 `itemEdits` 를 지운다 (`:1824-1830`). 「고쳤지만 저장하지 않은 행」 을 따로 적는 자리는 없다 — 편집 기록이 그 정보다.
- **F7 편집 가능한 열은 작성 값이다.** Column 「Editable」 스위치가 켜진 열의 칸만 편집 Form 을 갖는다 (`commands/collections.ts:2045` `tableColumnEditable` · `presence.ts:5979` `catalogEditableCell`).
- **F8 클립보드.** 복사는 브라우저 `copy` 이벤트에 탭 구분 글자를 싣는다 (F1). 설치된 react-aria 에는 `useClipboard` (`onPaste(items: DropItem[])`) 가 있고 (`react-aria/dist/types/src/dnd/useClipboard.d.ts`), 우리 복사는 이 훅을 쓰지 않는다.
- **F9 기준선.** ADR-315 Phase 0 · 7 의 하니스 (`apps/builder/scripts/datagrid-table-vs-tanstack-live.mjs`) — 10,000 행 정렬 클릭 1x 154 ~ 169 ms · 4x 556 ~ 589 ms, 번들 Builder initial JS gzip 1,610,063 B (ADR-315 Phase 7 뒤 값 — Phase 0 에서 다시 잰다).

### 선행 결정

| ADR · 결정                                                                                         | 이 ADR 이 따르는 것                                                                          | 이 ADR 이 바꾸는 것                                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [315](315-table-data-grid-state-model.md)                                                          | 칸 범위 선택 모듈 · 범위 = (행 key, 열 key) · 행 선택과 한 표에서 같이 켜지 않음 · HC1 ~ HC9 | D1 예외 목록에 붙여넣기 · 채우기를 더한다 (사용자 답) |
| S2 체크리스트 §9.3 6-6 (2026-11-23)                                                                | 칸 편집 = S2 `EditableCell` (popover Form) · 세션 `update` · 서버 저장은 `callEndpoint`      | 없음 — 여러 칸 쓰기가 같은 길을 쓴다                  |
| [313](313-external-data-intake-standard.md)                                                        | 값 변환은 진입 변환 한 곳 (`normalizeRows`)                                                  | 없음                                                  |
| [284](284-data-view-filter-sort-group-query.md) · [287](287-interactions-do-from-reference-api.md) | 목록 편집은 `useListData` 의 뜻 · 실행 중 값은 문서에 쓰지 않음                              | 없음                                                  |
| [297](297-rule-state-condition-tree-single-priority.md)                                            | 상태 칠은 rule 의 조건 트리 하나 · 우선순위는 키 순서                                        | 줄무늬 · 편집 상태 가지를 그 트리에 더한다            |
| [212](212-data-panel-editor-redesign.md)                                                           | 외부 격자 라이브러리 기각 (접근성 모델 둘 · 번들)                                            | 없음                                                  |

fork 4 질문 (새 범위지만 선행 관계를 고정한다):

1. base / 응용 — ADR-315 (표 상태 · 칸 범위 선택) 가 base 이고 이 ADR 은 그 위의 응용이다. ADR-315 의 G6 (VoiceOver 청취) 이 끝나지 않았다 — 이 ADR 의 붙여넣기 · 채우기는 G6 통과 뒤에만 착수한다 (G0).
2. schema 직교성 — 여러 칸 쓰기는 세션 편집 기록의 specialization 이다 (새 저장 자리 없음). 줄무늬는 표 상태와 직교한 작성 값이다.
3. 선행 전제 — 「행 쓰기는 세션 한 곳」 (F2) · 「칸 편집은 S2 EditableCell」 (6-6) 을 그대로 둔다. 뒤집는 것은 위 표의 「바꾸는 것」 하나다.
4. 전제 검증은 이 문서의 사용자 답과 사용자 결정 목록에서 끝낸다.

### 레퍼런스 (2026-11-25)

- **ReUI Data Grid** (`reui.io/components/data-grid` · 문서 페이지): TanStack Table v9 + TanStack Virtual + dnd-kit. `tableLayout` 의 `cellSelection` · `cellFillHandle` · `cellEditMode` · `stripped`, `DataGrid` 의 `onCellsChange` · `onCellEditRequest` · `getRowStatus` (`new` · `dirty` · `deleted`) · `getCellStatus` (`dirty` · `invalid`). 일반 `<table>` 위에 직접 만든 키 · 포인터 처리다.
- **S2 TableView 1.8.2**: `EditableCell` 만 (F3).
- **react-aria 설치본**: `useClipboard` (F8).

### Hard constraints

- **HC1 RAC DOM 그대로.** ADR-315 HC1 과 같다. 넓힌 예외는 [breakdown §4](../design/317-table-editing-grid-paste-fill-status-breakdown.md) 의 속성 · 키 · 포인터 · 요소 목록이 전부다. 칸 안에 입력 요소를 직접 넣는 편집기는 만들지 않는다 — 한 칸 편집은 S2 `EditableCell` 이다.
- **HC2 쓰기 길 하나.** 붙여넣기 · 채우기 · 지우기는 세션의 행 편집 (F2) 으로만 쓴다. 두 번째 행 저장 자리 · 두 번째 값 변환을 두지 않는다 — 읽히는 값은 `EditableCell` 로 쓴 결과와 붙여넣은 결과가 같다 (F4). 열 타입으로 읽히지 않는 글자는 다르다: `normalizeRows` 가 그 칸을 `null` 로 돌려주고 (`unread` · `precision`) 지금 `update` 는 그 `null` 을 쓰지만, 묶음 쓰기는 그 칸을 쓰지 않고 센다 (breakdown §5.1 — 두 길을 맞출지는 사용자 결정 8).
- **HC3 편집 가능한 칸만.** 쓰는 대상은 「Editable」 열 (F7) 의 데이터 행 칸이다. key 필드 · 계산 필드 · 묶음 행 · 합계 행 · 상세 행 · 작성한 고정 Row 는 쓰지 않는다. 쓰지 못한 칸은 버리지 않고 센다 (알림에 수).
- **HC4 행 창.** 대상 칸은 데이터 층에서 (행 key, 열 key) 로 정한다 — 그려진 칸에 의존하지 않는다 (ADR-315 HC3). 서버가 쪽을 나눠 주는 표는 불러온 행만 대상이다.
- **HC5 속도.** 한 번의 붙여넣기 · 채우기는 행 다시 읽기 1 번이다 (F5 — 카운트 게이트). 10,000 행 표에서 1,000 칸 붙여넣기 → 화면 반영이 정렬 클릭 기준선 (F9) 이하 (1x · 4x). 기능을 끈 표는 ADR-315 하니스의 정렬 클릭 · 로드 · 힙 · 스크롤 p95 비율 ≤ 1.10 (끈 arm 과 켠 arm 교대 3 쌍).
- **HC6 번들.** ADR-201 상한 (Builder ≤ 1,650,000 · Preview ≤ 327,000 B gzip, 만료 2026-12-25). 붙여넣기 · 채우기는 칸 선택 lazy chunk 안에 둔다 — 쓰지 않는 표의 initial Δ 는 스위치 · rule 값뿐이다. Δ 수용 범위는 사용자 결정 7.
- **HC7 문서 변환 코드 없음.** entry 형이 바뀌면 `LIBRARY_CONTRACT_VERSION` (지금 77) 을 한 번 올리고 번호는 착수 때 origin/main 과 대조한다.
- **HC8 클립보드 권한 창 없음.** 붙여넣기는 브라우저 `paste` 이벤트의 `clipboardData` 만 읽는다. `navigator.clipboard.read*` (권한 창) 를 쓰지 않는다.
- **HC9 Canvas.** 줄무늬는 Canvas 와 DOM 이 같은 결과를 낸다. 편집 상태 · 채우기 손잡이 · 붙여넣기는 Preview · Publish 에만 있다.

### Soft constraints

- 사용자는 비개발자다 — 「붙여넣기 허용」 수준의 스위치로 켠다.
- 확인 브라우저는 Chrome + WebKit, 사용자 Chrome 은 CPU 4x.
- 개발 단계다 (마이그레이션 코드 없음).

## Alternatives Considered

### 대안 A: 칸 안 편집기 (스프레드시트 방식 — ReUI 를 그대로)

- 설명: 칸을 두 번 누르거나 글자를 치면 칸이 입력 요소가 되고, 붙여넣기 · 채우기 · 편집 상태를 그 편집기 층이 맡는다. `EditableCell` 의 popover Form 은 쓰지 않는다.
- 근거: ReUI `cellEditMode` · `onCellEditRequest`.
- 위험: 기술 **HIGH** (RAC Cell 안에 focus 를 받는 입력을 넣으면 grid 의 키 이동과 겹친다 — 칸마다 편집 모드 전환을 직접 만들어야 한다) / 성능 MEDIUM / 유지보수 **HIGH** (S2 `EditableCell` 과 편집 길이 둘 · D2 정본에서 벗어남) / 마이그레이션 MEDIUM (6-6 의 Column 「Editable」 문서 모양을 버린다).

### 대안 B: 편집하는 표만 외부 격자 라이브러리

- 설명: 편집 격자가 필요한 표는 AG Grid · Handsontable 류로 그린다.
- 근거: 붙여넣기 · 채우기 · 행 상태가 이미 있다.
- 위험: 기술 MEDIUM / 성능 **HIGH** (번들 — ADR-212 가 Builder 패널 격자에서 같은 이유로 기각) / 유지보수 **HIGH** (접근성 모델 둘 · catalog rule 과 다른 스타일 체계 · Canvas 가 그릴 수 없음) / 마이그레이션 **HIGH** (Table 문서 노드와 다른 모양).

### 대안 C: 칸 범위 선택 모듈을 넓히고 세션 쓰기 한 길로 (채택)

- 설명: ADR-315 의 칸 선택 lazy 모듈에 `paste` · 채우기 손잡이를 더한다. 쓰기는 세션의 행 편집을 묶어 한 번에 (행 다시 읽기 1 번), 값 변환은 `normalizeRows`, 편집 상태는 세션 편집 기록에서 읽는다. 줄무늬는 Row rule 의 조건 가지다. 한 칸 편집은 `EditableCell` 그대로.
- 근거: F1 ~ F7 — 필요한 자리가 이미 한 곳씩 있다.
- 위험: 기술 MEDIUM (가상 표에서 손잡이 끌기 · 자동 스크롤, `paste` 이벤트가 focus 된 gridcell 에 오는지 — Phase 0 시제품) / 성능 MEDIUM (F5 — 묶음 쓰기로 닫는다) / 유지보수 LOW (새 저장 자리 0) / 마이그레이션 LOW (더하기만).

### 대안 D: 기본 기능 없이 규칙으로만 (When 붙여넣기 → Do update)

- 설명: Table 에 「붙여넣음」 When 만 주고 무엇을 쓸지는 작성자가 Do 로 잇는다. 채우기 · 상태 표시는 만들지 않는다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 MEDIUM (칸 대응 · 변환을 작성자마다 다르게 만든다) / 마이그레이션 LOW. 사용자 범위 (채우기 · 상태 표시) 를 채우지 못한다.

### Risk Threshold Check

| 대안 | HIGH 이상                      | 판정               |
| ---- | ------------------------------ | ------------------ |
| A    | 기술 · 유지보수                | 기각               |
| B    | 성능 · 유지보수 · 마이그레이션 | 기각               |
| C    | 없음 (MEDIUM 2)                | 채택 — 루프 불필요 |
| D    | 없음                           | 범위 미달로 기각   |

## Decision

**대안 C 를 채택한다.** 칸 범위 선택 위에 붙여넣기 · 채우기를 더하고, 쓰기 · 변환 · 상태는 이미 있는 한 곳을 읽는다.

1. **D1 예외 확장** — 「Cell selection」 을 켠 Table 의 body 칸에서 Ctrl / Cmd + V (브라우저 `paste`) 와 채우기 손잡이 끌기를 직접 다룬다. 결과는 표 옆의 알림 영역 하나가 읽어 준다 (쓴 칸 수 · 건너뛴 칸 수). 목록 전문과 그대로 두는 것은 [breakdown §4](../design/317-table-editing-grid-paste-fill-status-breakdown.md) — 구현이 그 목록을 넘으면 규칙 위반이고, 구현 Phase 가 끝날 때 `.claude/rules/ssot-hierarchy.md` §1 D1 의 Table 예외에 같은 목록을 적는다.
2. **묶음 쓰기** — 세션에 여러 행 · 여러 필드를 한 번에 쓰는 편집을 더한다. 편집 기록 한 건 · 행 다시 읽기 1 번이고 (HC5), 칸마다 `update` 와 같은 거르기 · 변환을 지난다 (HC2). 열 타입으로 읽히지 않는 값 (`normalizeRows` 의 행별 `unread` · `precision` · `typeMismatch`) · 쓸 수 없는 칸은 쓰지 않고 센다 — 원래 값이 남는다.
3. **붙여넣기** — 클립보드의 `text/plain` (탭 · 줄 구분 — 우리 복사 · Excel · Sheets 와 같은 형식) 을 마지막 범위의 왼쪽 위 칸부터, 지금 보이는 행 순서 · 그려진 열 순서로 놓는다 (복사가 읽는 순서와 같다 — F1). 값이 하나면 범위 전체에 쓴다. 표 끝을 넘는 줄 · 열은 사용자 결정 4.
4. **채우기 손잡이** — 마지막 범위의 오른쪽 아래 모서리에 우리가 그리는 요소. 끌어 넓힌 칸에 원래 범위의 값을 되풀이해 쓴다 (값 복사). 키보드 길은 사용자 결정 2, 연속값은 사용자 결정 5.
5. **편집 상태 표시** — 세션 편집 기록 (F2) 에서 행의 「새 행」 · 「고친 행」 과 고친 칸을 읽어 Row · Cell 의 파생 상태로 싣는다. 상태는 편집을 다시 적용하는 중에 항목에 붙이고 적용 뒤의 key 로 읽는다 — 기록의 key 글자로 세우지 않는다 (위치 key 인 collection 에서 행이 밀린다). 칠은 Row · Cell rule 의 조건 가지 (ADR-297), 색만으로 알리지 않는다 (표시 요소 + 글자). 표시가 사라지는 때 · 범위는 사용자 결정 6.
6. **서버 저장** — 여러 칸을 쓴 뒤 서버로 보내는 길은 사용자 결정 1 이다 (권고: Table 의 When 하나).
7. **줄무늬 행** — Table 의 작성 값 하나. 짝 · 홀은 CSS `:nth-child` 가 아니라 데이터 층의 보이는 순서로 정해 Row 의 파생 값으로 싣는다 (가상 표 · 묶음 행 · 고정 행에서 DOM 순서와 보이는 순서가 다르다). Canvas 와 DOM 이 같은 값을 읽는다.
8. **작성 화면** — Table 의 「Cell selection」 아래에 「Paste」 · 「Fill handle」 · 「Edit marks」, 모양 쪽에 「Striped rows」 스위치 (ADR-315 Decision 9 의 방식). 「Paste」 · 「Fill handle」 은 「Cell selection」 이 켜져 있고 「Editable」 열이 하나 이상일 때만 켤 수 있다.
9. **하지 않는 것**
   - 칸 안 편집기 (대안 A) · 외부 격자 라이브러리 (대안 B).
   - 칸 우클릭 메뉴 — 메뉴에서 붙여넣기를 실행하려면 `paste` 이벤트 없이 클립보드를 읽어야 하고 그것은 권한 창이다 (HC8). 복사 · 붙여넣기 · 지우기는 키로 닿는다.
   - 불러오는 중의 skeleton 행 — S2 TableView 는 진행 원이다 (D2 정본, ADR-314 의 Skeleton 은 표 밖 래퍼).
   - 여러 줄 머리글 (ADR-315 Decision 10 유지) · 바닥줄 여러 개 (편집과 무관 — 이 ADR 범위 밖).
   - Canvas 에서 붙여넣기 · 채우기 · 편집 상태를 흉내 내지 않는다 (HC9).
   - 문서 변환 코드 (HC7).

기각 사유:

- **A** — RAC grid 의 키 이동과 칸 안 입력이 겹쳐 편집 모드 전환을 직접 만들어야 하고, S2 `EditableCell` 과 편집 길이 둘이 된다. 6-6 의 문서 모양도 버린다.
- **B** — 번들 · 접근성 모델 둘 · Canvas 가 그릴 수 없음. ADR-212 의 기각 사유가 그대로 선다.
- **D** — 채우기 · 상태 표시가 없고, 칸 대응과 변환을 작성자가 규칙으로 다시 만들어야 한다 (사용자는 비개발자다).

> 구현 상세: [317-table-editing-grid-paste-fill-status-breakdown.md](../design/317-table-editing-grid-paste-fill-status-breakdown.md)

### 사용자 결정 (8 건 — 그 Phase 에 닿을 때 묻는다)

|  #  | 항목                                                                                                                                               | 권고                                                                                                                                                                    | 닿는 Phase |
| :-: | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------: |
|  1  | 여러 칸을 쓴 뒤 서버 저장의 길 — Table 의 새 When 「Cells change」 하나 (바뀐 행 목록) / 칸마다 그 열 Form 의 `onSubmit` 규칙 / 세션에만           | Table 의 When 하나 — 작성자가 `callEndpoint` 를 한 번 잇는다 (RAC 에 없는 이름이라 composition 확장)                                                                    |     4      |
|  2  | 채우기의 키보드 길 — Ctrl / Cmd + D (아래로) 만 / Ctrl / Cmd + R (오른쪽) 도 / 없음                                                                | Ctrl / Cmd + D 만 (Ctrl / Cmd + R 은 브라우저 새로고침이라 막지 않는다 — 오른쪽은 붙여넣기로)                                                                           |     3      |
|  3  | 범위 지우기 (Delete · Backspace) 와 잘라내기 (Ctrl / Cmd + X) 를 넣을지                                                                            | 넣는다 — 「Editable」 열의 칸만 비운다                                                                                                                                  |     2      |
|  4  | 붙여넣는 줄이 표 끝을 넘을 때 — 버리고 알림 / 새 행을 만든다                                                                                       | 버리고 알림 (새 행은 Do `append` 의 일)                                                                                                                                 |     2      |
|  5  | 채우기의 연속값 추론 (1 · 2 · 3 → 4 · 5, 날짜 하루씩)                                                                                              | 하지 않는다 — 값 복사만                                                                                                                                                 |     3      |
|  6  | 편집 상태 표시의 범위 — 행만 / 고친 칸까지, 그리고 표시가 사라지는 때 — 다시 불러올 때만 (F6) / 저장 Do 가 성공했을 때도                           | 칸까지 · 저장 Do 성공 때도 지운다 — 그 저장이 보낸 칸 가운데 보낸 뒤 다시 고치지 않은 칸만 (breakdown §5.4). 지운 행을 취소선으로 남기지는 않는다 (`remove` 의 뜻 유지) |     4      |
|  8  | 읽히지 않는 글자의 처리를 `update` (`EditableCell` · Do `update`) 에도 맞출지 — 지금 `update` 는 칸을 `null` 로 비운다, 묶음 쓰기는 쓰지 않고 센다 | 맞춘다 — `update` 도 같은 판정으로 그 필드를 쓰지 않고 사유를 돌려준다 (값 손실을 막는다). 맞추지 않으면 두 길의 차이를 문서에 적는다                                   |     1      |
|  7  | 번들 Δ 수용 범위                                                                                                                                   | lazy chunk 로 initial Δ ≤ Builder +3,000 · Preview +1,500 B gzip, 넘으면 보고                                                                                           |  각 Phase  |

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                       | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | base 가 닫히지 않았다 — ADR-315 G6 (VoiceOver 청취) 이 실패하면 그 대안이 「칸 선택을 빼고 병합만」 이라 `tableCellSelection.ts` (`attachCatalogCellSelection`) · `domBinding.runtime.ts` `catalogTableCellOrder` · Table 「Cell selection」 스위치가 사라지고 이 ADR 의 붙여넣기 · 채우기가 설 자리가 없다                                                                                                                                |  HIGH  | G0 — ADR-315 G6 통과를 Phase 2 착수 조건으로 둔다. 실패하면 이 ADR 은 줄무늬 · 편집 상태 표시만 남기고 사용자에게 보고 (결정 지점 4)                                                                                                                                                                                                               |
| R2  | 붙여넣은 값이 다른 쓰기와 어긋난다 — 변환 (`catalogPreviewSession.ts:1135` `itemFields` → `normalizeRows.ts:192`), key 필드 보호 (`:1292`), 편집 가능 판정 (`commands/collections.ts:2045` `tableColumnEditable`) 중 하나를 묶음 쓰기가 건너뛰면 `EditableCell` (`catalogTableController.ts:800`) 과 다른 값이 들어간다. 읽히지 않는 글자는 `readCell` 이 `null` 로 돌려주어 (`normalizeRows.ts:164-178`) 그대로 쓰면 칸이 조용히 비워진다 |  HIGH  | G1 · G2 — 같은 fixture 를 `EditableCell` 저장과 붙여넣기로 써서 행 값 일치. 정답은 따로 적은 값 (시스템 출력으로 채점하지 않는다). 묶음 쓰기는 `update` 의 거르기 함수를 그대로 부르고, 행별 report (`unread` · `precision` · `typeMismatch`) 에 센 칸은 쓰지 않는다 (breakdown §5.1 · 사용자 결정 8)                                              |
| R3  | 속도가 뒤로 간다 — 편집마다 행 다시 읽기 (`catalogPreviewSession.ts:1149` `edit` → `compositionRoot.ts:3053` `refreshRows`), 범위 표시가 스크롤마다 행 key 를 다시 센다 (`tableCellSelection.ts:55-60` 의 기록 — 10,000 행 스크롤 9,562 ms 가운데 1,569 ms), 상태 표시가 행마다 편집 기록을 훑는다                                                                                                                                         |  HIGH  | G1 (행 다시 읽기 카운트 1) · G5 (HC5 교대 측정). 상태는 편집 기록이 바뀔 때 한 번 key → 상태 Map 으로 만든다                                                                                                                                                                                                                                       |
| R4  | 넓힌 D1 예외가 RAC 와 겹친다 — `keydown` capture (`tableCellSelection.ts:245`) 가 RAC grid 의 키 처리 앞에 있고, `EditableCell` 의 popover 가 열린 동안 (`editableCell.components.tsx` `isOpen`) 의 `paste` 는 Form 입력의 것이어야 하며, 채우기 끌기는 범위 끌기 (`pointerdown` capture `:242`) 와 같은 포인터를 쓴다                                                                                                                     |  HIGH  | G2 · G3 — 키보드만으로 전 경로 · popover 열린 동안 표가 `paste` 를 잡지 않음 · VoiceOver 가 결과 알림을 읽음. 실패하면 그 기능만 뺀다 (Gates 의 대안)                                                                                                                                                                                              |
| R5  | 클립보드 글자의 형식 — Excel 의 따옴표 · 칸 안 줄바꿈 · `1,234` · 로케일 날짜                                                                                                                                                                                                                                                                                                                                                              | MEDIUM | 칸 나누기 규칙은 Builder 의 붙여넣기 파서 (`apps/builder/src/builder/panels/datatable/utils/pasteRows.ts` — 탭 · 따옴표) 와 맞춘다 — runtime 은 builder 를 import 할 수 없어 shared 에 탭 구분 파서를 두고 두 파서를 같은 fixture 로 검사한다. 값 변환은 `normalizeRows(…, "text")` 그대로. fixture 에 Excel · Sheets 에서 복사한 실제 글자를 둔다 |
| R6  | 서버가 쪽을 나눠 주는 표 — 불러오지 않은 행은 대상이 아니고 다시 불러오면 편집 기록이 사라진다 (F6)                                                                                                                                                                                                                                                                                                                                        | MEDIUM | 대상은 불러온 행으로 한정하고 건너뛴 수를 알린다. 저장 전 다시 불러오기는 지금 `EditableCell` 과 같은 동작이다 — 문서에 적는다                                                                                                                                                                                                                     |
| R7  | 줄무늬 · 선택 · hover · 병합 칸 · 편집 상태 칠의 우선순위                                                                                                                                                                                                                                                                                                                                                                                  | MEDIUM | 조건 트리 한 곳의 키 순서로 정하고 (ADR-297) Canvas · DOM 대조는 `/cross-check`                                                                                                                                                                                                                                                                    |
| R8  | 편집 상태를 색으로만 알린다                                                                                                                                                                                                                                                                                                                                                                                                                |  LOW   | 표시 요소와 화면 낭독기용 글자를 같이 둔다 (breakdown §5.4)                                                                                                                                                                                                                                                                                        |

## Gates

측정 조건 (HC5 · G1 · G5 공통, [measurement-validity.md](../../../.claude/rules/measurement-validity.md)): 대상은 ADR-315 의 부하용 생성 문서 (규모 전용), 불리한 경우 = 값이 모두 다른 글자 열 · 원격 collection · CPU 4x · 정렬과 묶음이 걸린 가상 표, 대조군 = 같은 문서에서 기능을 끈 arm 과 교대 3 쌍, 조건 = production 빌드 · headed Chrome 120 Hz · 1x 와 4x, 기준값 = 실제 브라우저의 시간과 따로 적은 정답 행 값.

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                                                      | 실패 시 대안                                              |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| G0   | Phase 0 끝 | ADR-315 G6 통과 확인 · 코드 사실 F1 ~ F9 재대조 차이 0 · 시제품 5 (`paste` 이벤트 · 가상 표 손잡이 끌기와 자동 스크롤 · 묶음 쓰기 1,000 칸 시간 · 줄무늬 짝 · 홀 · 결과 알림 낭독) 의 go / no-go · D2 이름 확인 · 기준선                                                                                                                                       | no-go 기능은 그 Phase 에서 빼고 사용자에게 보고           |
| G1   | Phase 1 끝 | 읽히는 값은 묶음 쓰기가 `EditableCell` 저장과 같은 행 값 · 읽히지 않는 글자 (숫자 열의 `abc` · 머리글 줄 `Price` · 가로 채우기의 다른 타입 값) 는 원래 값 유지 + 「읽기 실패」 수 (사용자 결정 8 이 「맞춘다」 면 `update` 도 같은 결과) · 행 다시 읽기 카운트 1 · 쓸 수 없는 칸 (key · 계산 필드 · 편집 불가 열) 0 건 쓰기 · 원복 RED                         | 쓰기를 `update` 반복 + 다시 읽기 한 번으로 감싼다         |
| G2   | Phase 2 끝 | 붙여넣기가 따로 적은 정답과 일치 (정렬 · 필터 · 숨긴 열 · 가상 표 창 밖 · 묶음 행 섞임) · popover 열린 동안 표가 `paste` 를 잡지 않음 · 키보드 전 경로 · VoiceOver 가 결과를 읽음 · Chrome · WebKit live                                                                                                                                                       | 붙여넣기를 빼고 채우기 · 상태 · 줄무늬만                  |
| G3   | Phase 3 끝 | 채우기가 정답과 일치 (아래 · 오른쪽 · 위 · 왼쪽, 가상 표 자동 스크롤) · 범위 끌기와 겹치지 않음 · 사용자 결정 2 의 키 · live                                                                                                                                                                                                                                   | 손잡이를 빼고 키보드 채우기만, 그것도 안 되면 채우기 제외 |
| G4   | Phase 4 끝 | 편집 상태 (새 행 · 고친 행 · 고친 칸) 가 편집 기록과 일치 — id 필드 없는 collection 에서 고친 뒤 `insert` · `remove` · `move` 를 해도 표시가 같은 항목에 남음 · 사용자 결정 6 의 시점에 사라짐 — 저장 요청 중에 다시 고친 칸 · 보내지 않은 칸은 성공 뒤에도 남고 실패하면 아무것도 지우지 않음 · 사용자 결정 1 의 저장 길이 바뀐 행 전부를 한 번에 보냄 · live | 저장 길을 세션에만 (결정 1 의 셋째 안)                    |
| G5   | Phase 5 끝 | 줄무늬가 Canvas = DOM (`/cross-check` — 가상 표 · 묶음 · 고정 행 · 병합 칸) · 칠 우선순위가 조건 트리 순서와 일치                                                                                                                                                                                                                                              | 줄무늬를 병합 칸이 없는 표에만                            |
| G6   | Phase 6 끝 | HC5 교대 측정 전부 통과 · 번들 (사용자 결정 7) · 규칙 문서의 D1 예외 목록과 구현의 속성 · 키 목록 일치 (정적 검사) · 종결 live · 사용자 확인                                                                                                                                                                                                                   | 넘는 항목을 수리하거나 그 기능을 lazy 로 더 민다          |

집행: 각 Gate 의 테스트는 unit · browser project 에 두고 Phase 끝에 실행자가 `pnpm -F @composition/shared test` · `pnpm -F @composition/builder test` (browser 는 `test:parity`) 로 돌려 결과를 breakdown §9 에 적는다. 카운트 게이트 (행 다시 읽기 수) 는 `pnpm gate:perf-ratchet` 수동 실행이다.

### Live Exercise

2026-11-26 · 수단: Playwright (headed Chrome · WebKit, 5173 dev) + 사용자 청취 (VoiceOver) · page error 0 (채우기 하니스 첫 실행의 builder `CATALOG_WORKSPACE_REQUIRED` 1 건은 다시 2 회 재현 안 됨 — LOW).

- **Phase 2 ~ 5 하니스 재확인 (Chrome · WebKit)**: Builder Design 패널에서 Name · Status 「Editable」 · Table 「Cell selection」 · 「Paste」 · 「Fill handle」 · 「Edit marks」 · 「Striped rows」 를 켜고 Publish 에서 — 복사 → 붙여넣기 (정답 칸 · type 그대로 · 알림) · Excel 형식 (Chrome) · Delete · 잘라내기 (비움 · 알림 · 잘라낸 값 붙여넣기) · Ctrl / Cmd + A 뒤 한 값 1,000 행 · 손잡이 끌기 자동 스크롤 50 행 · Ctrl / Cmd + D · 편집 표시와 「Cells change」 저장 성공 · 실패 · 줄무늬 행 (`aria-rowindex` 짝수 · 계산된 바탕 · 선택 칠 · 병합 칸 · 500 행 스크롤). 붙여넣기 8/8 · 7/7 · 채우기 5/5 · 편집 표시 7/7 · 줄무늬 8/8.
- **`/cross-check` (Chrome · WebKit 각 4/4)**: 줄무늬 · 병합 묶음 표를 Builder Canvas 와 Publish 에서 찍어 행마다 Name · Type 칸 한 점 — 두 화면 = 손으로 적은 정답 (`255` · `248`).
- **P5 청취 (사용자, 2026-11-26)**: `adr317-p2-paste-live.mjs --hold` 가 연 Publish (Users 1,000 행 · 위 스위치) 에서 VoiceOver 로 붙여넣기 · 지우기 · 잘라내기 · 채우기 — 결과 알림 (`role="status"`) 을 focus 가 칸에 머문 채 읽음 → 「확인했다」.
- **HC5 (production · 10,000 행)**: 끈 arm ↔ 켠 arm 교대 3 쌍 ≤ 1.10 · Phase 0 빌드 ↔ 지금 회귀 없음 · 1,000 칸 붙여넣기 ≤ 같은 표 정렬 클릭 (짝 3/3) — [breakdown §9 Phase 6](../design/317-table-editing-grid-paste-fill-status-breakdown.md).

## Consequences

### Positive

- 여러 칸을 한 번에 고칠 수 있다 — Excel · Sheets 에서 복사한 값을 표에 붙여넣고, 같은 값을 끌어 채운다.
- 고친 행 · 새 행이 화면에 보이고, 서버 저장을 규칙 한 번으로 잇는다.
- 새 저장 자리가 없다 — 붙여넣기 · 채우기 · `EditableCell` · 규칙의 Do `update` 가 세션 편집 한 곳을 지난다.
- 줄무늬 행이 Canvas 와 Publish 에서 같은 결과로 나온다.

### Negative

- D1 예외가 넓어진다 — 붙여넣기 · 채우기의 키 · 포인터 · 알림 영역을 RAC 가 아니라 우리가 유지한다 (RAC 가 칸 범위 편집을 내면 이 예외를 지우고 RAC 것을 쓴다).
- 칸 선택 lazy chunk 가 커진다 (사용자 결정 7).
- 서버가 쪽을 나눠 주는 표에서는 불러온 행에만 쓸 수 있고, 저장 전 다시 불러오면 편집이 사라진다 (R6).
- Canvas 는 편집 상태 · 손잡이를 그리지 않는다 — 작성자는 Preview 에서 확인한다.
