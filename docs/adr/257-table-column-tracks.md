# ADR-257: Table 열 배치 — Column 이 열 트랙을 정하고 모든 행이 같은 트랙을 쓴다 (+ 표·목록 S2 prop)

## Status

Proposed — 2026-10-10

- 사용자 요청: `/create-adr 표·목록 묶음 (Table 배치 ADR 선행)` (2026-10-10)
- 방향을 정한 경위: S2 prop 조사 ([S2_PROP_ALIGNMENT_2026-10.md](../explanation/research/S2_PROP_ALIGNMENT_2026-10.md) §6.1 「나에서 옮김」) 에서 Column `width` 류 · `allowsSorting` · Cell `colSpan` 은 「셋 다 Table 배치 방식 (table 레이아웃 · 데이터 정렬) 부터 바꿔야 해서 다의 「표 · 목록」 과 함께 다룬다」 로 판정했고, 2026-10-10 B · C · D 전환 완료 보고의 잔여 「표·목록 묶음 — Table 배치 방식 선행 (ADR)」 을 사용자가 이 요청으로 열었다.
- 리뷰: round 1 (Codex, 2026-10-10 — [reviews/257.md](reviews/257.md)) HIGH 3 · MEDIUM 4 · LOW 1 deferred → **같은 날 수리** (사용자 「수정해」). 채택안을 flex 파생 (옛 대안 A) 에서 「행마다 같은 명시 트랙의 grid」 (대안 C2) 로 바꿨다 — flex 는 칸 padding 을 basis 밖에 더해 fr 비율 · colSpan 합을 지키지 못한다 (Chrome 실측 300px · padding 8 · 1fr:2fr = 105.33 · 194.67, colSpan 흉내 194.67 · 105.33 — 엔진도 같은 값), grid 는 같은 입력에서 100 · 200 · span 200 이다. 그 밖의 수리: 바운드 Table 기본 150px · TableView 긴 글자 최소 폭을 기존 모양 범위에 포함 (h3), 열 크기 조절은 트랙 목록 교체 (m1), `ColumnSize` · `ColumnStaticSize` 분리 (m2), `align` · `showDivider` 는 S2 대로 Cell 자기 값 (m4). 수리 검증 round 2 (Codex) — round 1 7건 전부 fixed, 수리가 만든 새 이슈 2건 (G6 실패 대안이 flex 로 되돌아가 h1 · h2 를 되살림 · `%` min/max 를 트랙 변환이 버림) 을 같은 날 문서 수리 (G6 대안 교체 · `%` 하한 보존 · 섞인 단위 clamp 를 결정 3 에 · G1 에 RAC 기대값 oracle).
- 레퍼런스 대조 (2026-10-10, 사용자 「adr257설계안이 rac,rsc 레퍼런스 를 반영하게 설계 되었는지 체크해」 → 「모두반영해」): S2 1.8.0 원본 `src/TableView.tsx` · 설치 RAC 1.21.0 · react-stately 3.50.0 과 맞춰 6건 반영 — RAC 기본 최소 폭 75px (사용자 결정 1 에 추가 · G1 oracle 조건), S2 TableView 는 늘 가상화 · px 계산이라 C2 의 근거에서 S2 인용 삭제, Cell `isSticky` (S2 `@private`) 범위 제외, 선택 checkbox 열 트랙 (S2 고정 40 · 52px — 사용자 결정 1), 크기 조절 모드에서 RAC 가 table 에 `width: min-content` 를 주므로 감싼 동안 내내 px 트랙 (G4 에 드래그 전 검사), 숫자 문자열 폭 거부는 composition 제한으로 표기 · Badge `overflowMode` 기본 wrap.
- 사용자가 이미 답한 확인 항목: D2 정본 = S2 1.8.0 고정 (2026-10-09 「S2 1.8.0 고정 우선」) · Preview 의 조작 결과는 Preview 실행 상태이고 문서에 쓰지 않는다 (ADR-250, 펼침 — 같은 원칙을 정렬 · 열 크기 조절에 적용할지는 아래 사용자 결정 4 · 5) · 저장 문서 전환은 로드 시 1회 전환 (2026-10-10 「마이그레이션은 로드 시 1회 전환으로」 — S2 강조 축 전환의 방식).

## Context

### 도메인

- **D2 (Props/API)** — S2 1.8.0 의 `Column` (`width` · `defaultWidth` — `ColumnSize`, `minWidth` · `maxWidth` — `ColumnStaticSize`, `allowsSorting` · `allowsResizing` · `align`), `Cell` (`colSpan` · `align` · `showDivider`), `TableView` (`selectionStyle` · `overflowMode`), `ListView`/GridList · Badge (`overflowMode`) 를 binding accepts 로 들인다. 이름 · 값 · 기본값은 S2 그대로다 — S2 Cell 은 자기 `align` (기본 start) · `showDivider` (기본 false) 만 읽고 Column 에서 물려받지 않는다 (S2 1.8.0 `src/TableView.tsx:780` Column `align = 'start'` · `:1404` Cell `showDivider = false` · `:1431` `align || 'start'`). 값 타입은 react-stately 정의 그대로 `` ColumnStaticSize = number | `${number}` | `${number}%` ``, `` ColumnSize = ColumnStaticSize | `${number}fr` `` (`react-stately/dist/types/src/table/Column.d.ts:3-11` — 숫자 문자열 `"120"` 도 허용한다). `overflowMode` 기본값은 TableView · ListView truncate, Badge **wrap** (`Badge.tsx:210`). 들이지 않는 것: Cell `isSticky` 는 S2 에서 `@private` (`TableView.tsx:1394-1395`) 이고 RAC 에 공개 sticky API 가 없다 — S2 는 자기가 넣는 선택 · 끌기 열에만 쓰고 배치는 열 단위로 판정한다 (`S2TableLayout.isStickyColumn`, `:339-341`). S2 Column `showDivider` 는 타입에만 있고 S2 가 그리지 않는다 (`:759-760` — 그리는 쪽은 Cell).
- **D3 (시각 스타일)** — 열 폭 · 정렬 · 구분선 · 줄바꿈은 두 consumer (Canvas 엔진 · DOM) 가 같은 값을 읽어야 하는 배치 값이다. 이 ADR 의 중심.
- **D1 (DOM/접근성)** — 변경 없음. RAC `Table > TableHeader > Column`, `TableBody > Row > Cell` 그대로 (ADR-256 Phase 5i). grid 는 행 요소 (`tr`) 의 CSS 배치일 뿐 RAC 가 주는 요소 · role 을 바꾸지 않는다. 열 크기 조절은 RAC `ResizableTableContainer` · `ColumnResizer` 를 그대로 쓴다.

### 현재 배치 (실측 2026-10-10)

1. **정적 행 — 열마다 폭을 정하는 곳이 없다.** Column 과 Cell 은 각자 `flex: 1` 이다 — rule `Column.containerStyles.flex` (`componentRulesTable.ts:11269`), `Cell.containerStyles.flex` (`:11314`), TableHeader · Row 는 `display: flex; flex-direction: row` (`:11118` · `:11170`). DOM 도 같다 — 노드 Table 의 부품은 catalog 상자를 inline 으로 싣고 (`Table.css:46-79`), 수동 sheet 가 `:last-child { flex: 1 }` (`Table.css:202-218`), TableView 는 `TABLEVIEW_CHILD_STYLE` (`tableViewChildStyle.ts:64` — Cell `flex: 1` · `min-width` 없음). 열이 맞는 것은 모든 칸이 같은 몫이라서일 뿐이다. Column 하나에 폭을 주면 머리글 칸만 바뀌어 열이 어긋난다 — 두 consumer 가 똑같이 어긋나 대칭 판정은 통과한다.
2. **바운드 행 — 열 폭은 이미 Column 이 정한다, 단 px 고정.** resolver 가 바운드 Table 의 행을 다시 투영하며 (`resolver.ts:1060-1080`) 칸마다 `fixed()` 상자를 주고 (`:1172`), 그 폭은 Column 의 숫자 `width` · `minWidth` · `maxWidth` 로 `clamp(width ?? 150, minWidth ?? 20, maxWidth)` (`resolveCollectionItems.ts:656` `resolveTableColumnEffectiveWidth` — 옛 TanStack 값) 다. Preview 도 같은 `catalogBoundRows` 를 읽는다 (`catalogPreviewSession.ts:368`). 즉 폭을 안 적은 바운드 열은 지금 150px 이다.
3. Column → Cell 의 관계를 잇는 코드는 선택 checkbox 판정 (`presence.ts:405` `catalogTableOfColumn` · `:419` `catalogTableRows`) 과 위 바운드 투영뿐이다. Table → Column · Cell 로 값을 내리는 선례는 density (`resolver.ts:761-770` `CATALOG_DENSITY_PROPAGATION_OWNER`) 다.
4. **RAC 의 열 폭은 「표 폭을 재서 나누기」 다.** RAC 1.21.0 은 `ResizableTableContainer` 안에서만 `width` · `minWidth` · `maxWidth` 를 적용하고 (밖이면 경고 — `react-aria-components/dist/private/Table.mjs:703-705`), 컨테이너 폭을 ResizeObserver 로 재 (`:261-300`) react-stately `TableColumnLayout` 이 정수 px 를 정한 뒤 Column 에 `width` 를 주고 (`:735-738`) Table 에 `table-layout: fixed; width: min-content` 를 준다 (`:498-505`). 계산 (`calculateColumnSizes`, `react-stately/dist/types/src/table/TableUtils.d.ts:15-43`) 은 **열 폭 자체** 에 flex 알고리즘을 적용한다 — 칸 padding 은 그 폭 안이다. CSS flex 로 칸을 직접 늘리면 padding 이 basis 밖에 더해져 결과가 다르다 (아래 5). 폭을 안 적은 열은 기본 폭 `1fr` · **기본 최소 폭 75px** 이다 (`react-stately/dist/private/table/TableColumnLayout.mjs:19-20` — `getDefaultWidth ?? '1fr'` · `getDefaultMinWidth ?? 75`, S2 는 이 값을 덮지 않는다). 그래서 폭 300 에 `1fr` 열 5개면 RAC 는 75 × 5 (가로 넘침) 다. `ResizableTableContainer` 안의 비가상화 Table 에는 inline `table-layout: fixed; width: min-content` 가 붙어 (`Table.mjs:498-505`) composition 의 `.react-aria-Table { width: 100% }` (`Table.css:14`) 를 덮고, Column (`th`) 에는 inline `width: <px>` 가 붙는다 (`:735-738`).
   **S2 TableView 는 늘 이 계산을 쓴다** — `ResizableTableContainer` + `Virtualizer(S2TableLayout)` 로만 그리고 (`TableView.tsx:529-580`) 칸은 TableLayout 이 px 열 폭으로 놓는다. 비가상화 경로는 없다. 즉 S2 의 방식은 아래 대안 B 이고, C2 는 그 px 결과를 정수 반올림 차이 안에서 1-pass 로 내는 composition 의 방식이다.
   **선택 checkbox 열**: S2 는 이 열을 스스로 넣고 고정 폭 · 최소 폭 40px (scale medium) · 52px (large) · sticky 로 둔다 (`TableView.tsx:1238-1246`, 끌기 열은 16 · 20px — `:1220-1228`). RAC 레퍼런스는 작성자가 쓰는 `Column` (`Checkbox slot="selection"`) 이라 폭이 없고, composition 도 이 구조다 (ADR-256 Phase 5i-2). 지금은 이 열도 `flex: 1` 이라 데이터 열만큼 넓다.
5. **실측 (Chrome · 엔진 같은 값, 2026-10-10)** — 폭 300 · 칸 `padding: 0 8px` · `box-sizing: border-box`:

   | 배치                                       | 결과            | RAC/S2 의미 |
   | ------------------------------------------ | --------------- | ----------- |
   | flex `1 1 0` · `2 2 0`                     | 105.33 · 194.67 | 100 · 200   |
   | flex 1 · 1 · 1                             | 100 · 100 · 100 | 같음        |
   | 앞 두 칸을 한 칸 flex `2 2 0` 로 (colSpan) | 194.67 · 105.33 | 200 · 100   |
   | grid `minmax(0,1fr) minmax(0,2fr)`         | 100 · 200       | 같음        |
   | grid `repeat(3, minmax(0,1fr))` + `span 2` | 200 · 100       | 같음        |

6. **엔진 grid**: px · fr · % · auto · `minmax()` · `repeat()` · `span` 을 지원하고 (`packages/engine/src/grid.rs:1-30`, 규칙 `layout-engine.md` §19 minmax · §21 fr freeze-restart · §25 span), subgrid · 명시 트랙의 `min-content`/`max-content` · `fit-content()` 는 없다 (`grid.rs:27`). 엔진 입력의 grid 트랙은 `styleOf` 의 `containerTracks` (`compositionRoot.ts:1025` · `:1094`) 한 곳에서 배열로 직렬화된다. 규칙 `layout-engine.md` §「재확인 필요」 — 옛 경로는 기존 grid 컨테이너의 트랙을 증분으로 바꾸면 한 줄로 무너지던 증상 (2026-06-16) 을 full rebuild 로 피했고 catalog 경로에는 그 가드가 없다. 엔진 `update_style` (`tree.rs:805`) 은 style 교체 + dirty 전파뿐이다.
7. 정렬은 RAC 가 상태 (`sortDescriptor` · `data-sort-direction`) 만 주고 행 순서는 앱 몫이다. 바운드 행은 위 2 의 투영이 만든다.
8. 글자 넘침: DOM 칸은 `white-space: nowrap; text-overflow: ellipsis` (`Table.css:209-211`), Canvas 는 paragraph 가 상자 폭에서 말줄임을 그린다 (`canvasBinding.ts:464-484`) — `overflowMode` (wrap · truncate) 의 두 값을 실을 채널은 양쪽에 있다.

### 제약

- **Hard**: 기존 문서의 모양 — 폭을 안 적은 정적 열은 지금과 같은 값 (`minmax(0, 1fr)` 가 지금의 `flex: 1` 과 같은지는 칸마다 padding 이 같을 때 성립 — 실측 5 의 1 · 1 · 1 행), 바운드 열은 지금의 150px · clamp 결과. 바뀌는 집단 (TableView 의 긴 무공백 글자 칸 — 지금은 자동 최소 크기로 열이 넓어진다) 은 G0 이 세고 사용자 결정 2 가 정한다. 열 정렬 오차 = 같은 열의 머리글 칸과 모든 Cell 의 x · 폭 차이 ≤ 0.5 px (두 consumer 각각, 그리고 서로). pre-push perf ratchet (ADR-246). initial 번들 상한 (ADR-201 재승인 — Builder ≤ 1,421,000 / Preview ≤ 623,000 B).
- **Hard**: Skia 전용 시각 효과 금지 (D3 대칭). 정지 상태 (스크롤 0 · 조작 전) 에서 두 consumer 결과가 같다.
- **Soft**: 표 크기는 보통 수십 행 × 10 열 이하다. 큰 바운드 표는 ADR-150 의 행 window 로 그린다.

### 생성기 질문 (반복 패턴 #2)

트랙 목록은 rule 의 정적 값이 아니라 **문서 값 (Column 들의 prop) 에서 Table 마다 만드는 값**이라 `generate-css.ts` 가 selector 로 낼 수 없다. 두 consumer 모두 resolver 가 행 record (TableHeader · Row) 에 실은 파생 `gridTemplateColumns` 를 읽는다 — Canvas 는 `styleOf` → `containerTracks`, DOM 은 Row (`tr`) 의 inline style · 머리글은 TableHeader (`thead`) 의 CSS 변수를 `Table.css` 의 `thead > tr` 선택자가 읽는다 (RAC 가 만드는 머리글 `tr` 은 노드가 아니다). 생성 CSS 의 변화는 `align` · `showDivider` · `overflowMode` 같은 boolean · enum 축의 rootSelector 뿐이다.

## Alternatives Considered

### 대안 A: flex 파생 — Column 의 폭 규칙을 같은 열의 Cell 에 flex 값으로 내린다

- 설명: Column 의 `ColumnSize` 를 flex 값 (px = `0 0 Npx`, fr = `N N 0`, % = `0 0 N%`) 으로 바꿔 같은 열 Cell 에 파생, colSpan 은 걸친 열의 basis · grow 합. 행은 지금의 flex 그대로.
- 위험: 기술 **HIGH** (실측 5 — flex 는 칸 padding 을 basis 밖에 더해 fr 비율 (105.33 · 194.67) 과 colSpan 합 (194.67 · 105.33) 이 RAC/S2 의미와 어긋난다. 엔진 = Chrome 이라 두 consumer 는 같이 어긋나고 대칭 Gate 는 통과한다 — 틀린 값의 대칭) / 성능 LOW / 유지보수 MEDIUM (padding 을 보정하는 basis 산식이 칸 style 과 결합) / 마이그레이션 LOW.

### 대안 B: 공유 px 계산 — 표 폭을 재서 react-stately 로 열 px 를 정하고 두 consumer 에 준다

- 설명: RAC 와 똑같이 표의 content 폭을 먼저 알고 `calculateColumnSizes` 로 정수 px 를 구해 행에 준다. DOM 은 `ResizableTableContainer` 가 이미 하는 일이고, Canvas 는 표 폭을 안 뒤 열 폭을 다시 넣는 2-pass 다.
- 근거: RAC 결과와 px 단위로 같다 (fr + `maxWidth` · % + min/max 조합까지).
- 위험: 기술 **HIGH** (Canvas 레이아웃이 「표 폭 → 열 폭 → 다시 배치」 되먹임이 된다 — 옛 2-pass 는 2026-10-05 옛 파이프라인과 함께 삭제됐고 (`layout-engine.md` §옛 TS 레이아웃 파이프라인), `rewrap` 은 폭 재보정 확장 금지다 (같은 문서 §TS 잔존 계약). 계산 본체는 `react-stately/private/...` 경로라 공개 API 가 아니다) / 성능 **MEDIUM** (표 폭이 바뀔 때마다 2회 배치) / 유지보수 **MEDIUM** / 마이그레이션 LOW.

### 대안 C1: CSS Grid + 행 풀기 — Table 이 grid, TableHeader · TableBody · Row 는 `display: contents`

- 설명: Table 하나를 grid 로 두고 행들을 `display: contents` 로 풀어 Cell 이 grid 칸이 된다.
- 위험: 기술 **HIGH** (Row 상자가 사라진다 — Row 의 hover · pressed · 선택 배경 (`Table.css:158-199`) 과 Canvas 의 Row 선택 · 이동 대상이 없어진다) / 성능 LOW / 유지보수 **HIGH** (행 배경을 칸마다 다시 칠하는 우회) / 마이그레이션 MEDIUM.

### 대안 C2: 행마다 같은 명시 트랙의 grid — TableHeader 와 모든 Row 가 각자 grid, 트랙 목록은 Table 이 하나

- 설명: resolver 가 Table 마다 Column 들의 폭 규칙에서 트랙 목록 하나를 만든다 — `width`/`defaultWidth` 가 px 면 `Npx` (px min/max 는 상수라 미리 clamp), `Nfr` 이면 `minmax(<minWidth — px 든 `N%` 든 그대로, 없으면 0>, Nfr)`, `N%` 면 `N%` (`%` min/max 도 상수라 미리 clamp), 없으면 기본 (정적 `1fr`, 바운드 — 사용자 결정 1). `minWidth` 를 안 적은 fr 열의 하한은 사용자 결정 1 이 정한다 (RAC/S2 기본 75px = `minmax(75px, Nfr)` · 지금 모양 = `minmax(0, Nfr)`). 선택 checkbox 열의 트랙도 사용자 결정 1 (S2 = 고정 40px). 그 목록을 TableHeader (머리글 행) 와 모든 Row 에 `display: grid; grid-template-columns` 로 준다. 행이 각자 grid 라 Row 상자 · 배경 · 선택이 그대로 남고, subgrid · `display: contents` 가 필요 없다. 모든 행의 폭이 같으니 트랙도 같다. colSpan = `grid-column: span k`. 열 크기 조절을 켠 Table (Preview 가 `ResizableTableContainer` 로 감싼 동안 내내) 은 RAC 의 열 폭 상태 (px) 가 트랙 목록을 대신한다.
- 근거: 실측 5 — grid 트랙은 칸 padding 과 무관하게 fr 비율 · span 합을 지킨다 (100 · 200 · span 200). 엔진 grid 가 쓰는 기능 (px · fr · % · minmax · span) 을 이미 지원하고 Chrome 대조 기록이 있다 (`layout-css-parity-ledger` §19 · §21 · §25). S2 는 이 방식이 아니다 (Context 4 — 늘 가상화 · px 계산). C2 의 근거는 실측이고, S2/RAC 와의 대응은 G1 이 RAC `calculateColumnSizes` 기대값으로 판정한다.
- 위험: 기술 **MEDIUM** (① 표현하지 못하는 조합 — `Nfr` + `maxWidth` 는 CSS grid 의 fr 트랙에 상한이 없고, 단위가 섞인 clamp (px 폭 + `%` min/max · `%` 폭 + px min/max) 는 `max()`/`min()` 함수가 엔진에 없다: 사용자 결정 3. ② 기존 grid 컨테이너의 트랙을 증분으로 바꾸는 경로가 catalog 에서 아직 검증되지 않았다 (Context 6 — 행 N 개의 트랙이 열 하나의 편집으로 같이 바뀐다): G1 의 「새로고침 없이」 조건) / 성능 **MEDIUM** (행마다 grid solve — 행 수 × 열 수, flex 와 같은 차수이나 상수가 다르다: G6) / 유지보수 LOW (트랙 목록 생성 한 곳, 두 consumer 는 그 값을 싣기만) / 마이그레이션 **MEDIUM** (TableView 긴 무공백 글자 칸의 열 폭이 바뀐다 — `minmax(0, …)` 는 자동 최소 크기를 끈다; 바운드 기본 폭 처리 — 사용자 결정 1 · 2).

### 대안 D: 진짜 table 레이아웃 — DOM 은 `table-layout: fixed`, 엔진에 table 알고리즘 추가

- 설명: DOM 은 RAC 의 native table 경로로 돌아가고, Rust 엔진에 CSS table 레이아웃 (CSS 2.1 §17 fixed) 을 새로 구현한다.
- 위험: 기술 **CRITICAL** (엔진에 새 레이아웃 모드 — border-collapse · 열 그룹 · rowspan 까지 계약이 열린다) / 성능 MEDIUM / 유지보수 **HIGH** / 마이그레이션 MEDIUM.

### Risk Threshold Check

| 대안 | HIGH+ 위험                                                                 | 판정                                                    |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| A    | 기술 HIGH (padding 이 fr 비율 · colSpan 합을 깨뜨림)                       | 기각 — 실측 반례                                        |
| B    | 기술 HIGH (2-pass 되먹임 · 비공개 API)                                     | 기각 — 지운 2-pass 를 되살린다                          |
| C1   | 기술 HIGH · 유지보수 HIGH (Row 상자 소실)                                  | 기각                                                    |
| C2   | 없음 (MEDIUM: 표현 못 하는 조합 · 증분 트랙 · 행 grid 비용 · TableView 폭) | 채택 후보 — MEDIUM 은 G1 · G5 · G6 와 사용자 결정 1 ~ 3 |
| D    | 기술 CRITICAL                                                              | 기각                                                    |

round 1 에서 「모든 대안 HIGH 이상이 아님」 판정이 A 의 숨은 HIGH 로 무너졌다 — 루프 1회를 돌아 C2 를 추가했고, C2 는 HIGH 이 없다.

## Decision

**대안 C2 를 채택한다.** 열의 폭 규칙은 Column 이 갖고 (S2 `width` · `defaultWidth` · `minWidth` · `maxWidth`), resolver 가 Table 마다 트랙 목록 하나를 만들어 머리글 행과 모든 Row 에 같은 grid 트랙으로 준다. Table · TableView · 바운드 행이 같은 목록을 읽는다.

1. **트랙 목록**: 정적 · 바운드 행의 지금 두 규칙 (각자 `flex: 1` · `resolveTableColumnEffectiveWidth` 의 150px) 을 이 하나로 바꾼다. 칸은 grid 칸이고 폭은 트랙이 정한다 — Cell 자신의 폭 style 은 열 안에서 효과가 없다 (사용자 결정 2). 열 index = Row 안 앞 Cell 들의 colSpan 누적.
2. **값 타입 (S2)**: `width` · `defaultWidth` 는 `ColumnSize` (숫자 px · `"Nfr"` · `"N%"`), `minWidth` · `maxWidth` 는 `ColumnStaticSize` (숫자 px · `"N%"` — fr 거부). 문서에 숫자 문자열 (`"120"`) 을 두지 않는다 — 검증기가 거부하고 로드 시 1회 전환이 숫자로 바꾼다. S2/RAC 타입은 숫자 문자열을 허용하므로 (Context D2) 이것은 같은 값을 한 표기로만 저장하는 **composition 제한** 이다 (binding 머리말에 적는다 — 뜻은 같고 표기만 좁힌다). RAC 로 넘기는 값도 같은 타입이다.
3. **colSpan**: Cell `colSpan` → `grid-column: span k` (RAC 에도 `colSpan` 전달 — `aria-colspan`). 행의 칸 수 판정 (ADR-256 「열 수 = 칸 수」) 은 colSpan 합으로 바꾼다.
4. **칸 값은 S2 대로 Cell 자기 것**: Cell `align` (start · center · end, 기본 start) · `showDivider` (기본 false). Column `align` 은 머리글 칸 자신의 정렬이다. Column 값을 같은 열 Cell 이 물려받지 않는다 (round 1 m4). Cell `isSticky` 는 들이지 않는다 — S2 `@private` 이고 RAC 공개 API 가 없다 (Context D2). 고정 열이 필요해지면 열 단위 composition 확장으로 별도 작업에서 다룬다.
5. **표 단위 값**: Table · TableView `selectionStyle` (checkbox · highlight — RAC `selectionBehavior` toggle · replace 와 짝, highlight 면 선택 checkbox 노드를 그리지 않고 그 열의 트랙도 뺀다), Table · GridList · Badge `overflowMode` (truncate · wrap — 칸 · 항목 글자의 `white-space` · `text-overflow`; 기본값은 S2 대로 Table · TableView · GridList truncate, Badge wrap).
6. **Preview 조작** (정렬 · 열 크기 조절) 은 마지막 Phase 다. 정렬 상태와 표시 (`data-sort-direction` · 정렬 표시 Icon) 는 두 consumer 가 같이 읽고, 행 재배열은 Preview 실행 상태 (Canvas 는 문서 순서) — 범위는 사용자 결정 4. 열 크기 조절은 Preview 만 `ResizableTableContainer` 로 감싸고, **감싼 동안 내내** (드래그 중만이 아니라 첫 렌더부터) 머리글 행 · Row 의 트랙 목록을 RAC 의 열 폭 상태 (공개 export `TableColumnResizeStateContext`, `Table.mjs:1434`) 의 px 목록으로 바꾼다. RAC 가 감싼 table 에 `width: min-content` 를 주므로 (Context 4) fr 트랙이 남으면 min-content 계산에서 fr 몫이 0 이 되어 (CSS Grid §12.7 — min-content 제약에서 flex fraction 0) 열이 접힌다. 칸은 트랙을 따르므로 Cell 마다 폭을 덮지 않는다 (round 1 m1). 넣을지는 사용자 결정 5. 대안 B 의 비공개 경로는 쓰지 않는다.

**위험 수용 근거**: C2 의 잔존 위험은 넷이고 전부 정지 상태에서 잴 수 있거나 사용자 결정이 범위를 정한다 — ① 표현 못 하는 조합은 사용자 결정 3 이 처리를 정하고 G1 fixture 가 그 조합을 쓴다, ② 증분 트랙 변경은 G1 이 「새로고침 없이」 를 조건으로 잡고 실패하면 엔진 `update_style` 의 grid 캐시부터 고친다 (`layout-engine.md` 의 지침 — TS rebuild 가드는 엔진이 막혔을 때만), ③ 행 grid 비용은 G6, ④ 기존 모양이 바뀌는 집단은 G0 이 세고 사용자 결정 1 · 2 와 로드 시 1회 전환이 정한다. RAC 와의 차이는 정수 반올림 (열당 < 1 px) 이고, 열 크기 조절 중에는 RAC 의 px 를 그대로 쓴다.

**기각 사유**: A — 칸 padding 이 fr 비율 · colSpan 합을 깨뜨린다 (실측 5). 두 consumer 가 같이 틀려 대칭 Gate 로는 잡히지 않는다. B — 지운 2-pass 배치 되먹임과 비공개 API 의존을 다시 들인다. C2 가 같은 결과를 1-pass 로 낸다 (표현 못 하는 조합만 예외 — 사용자 결정 3 에서 B 를 그 조합에 한정해 다시 볼 수 있다). C1 — Row 상자를 잃어 행 배경 · 선택 · Canvas 의 Row 편집 대상이 깨진다. D — 엔진에 새 레이아웃 모드를 들이는 비용이 열 정렬에 비해 과하다.

> 구현 상세: [257-table-column-tracks-breakdown.md](design/257-table-column-tracks-breakdown.md)

### 사용자 결정 7건 (execute-adr 가 해당 Phase 에 닿을 때 묻는다)

1. **폭을 안 적은 열의 기본값** — 정적 `1fr` (지금 값) · 바운드 150px (지금 값) 을 그대로 둘지, S2 처럼 둘 다 `1fr` 로 맞출지. 맞춘다면 로드 시 1회 전환이 기존 바운드 열에 `width: 150` 을 적어 모양을 지킨다 (권장 — 새 표만 S2 기본). 함께 정할 것 둘: (i) `minWidth` 를 안 적은 열의 **기본 최소 폭** — RAC/S2 의 75px (`minmax(75px, Nfr)` — 좁은 표에서 열이 75 아래로 줄지 않고 가로로 넘친다, 지금 모양과 다름) 로 할지, 지금처럼 0 으로 둘지 (S2 와 다르다고 binding 머리말에 적는다). 75 로 하면 G0 이 표 폭 < 75 × 열 수 인 표를 세고 로드 시 1회 전환이 기존 열에 `minWidth: 0` 을 적을지도 정한다. (ii) **선택 checkbox 열** (`Checkbox[slot=selection]` 이 든 Column) 의 트랙 — S2 대로 고정 40px (size 별 값은 rule) 로 할지 · 지금처럼 일반 열 (`1fr`) 로 둘지, 고정이면 palette template 의 `width` 로 줄지 · resolver 파생으로 줄지. (Phase 1 착수 전)
2. **Column · Cell 의 Styles 폭** — 표 안 Column 의 Styles 폭 편집을 `width` prop 으로 보낼지 · 숨길지, 기존 문서에 작성된 Column Styles 폭을 로드 시 1회 `width` 로 옮기고 Cell Styles 폭을 지울지. TableView 긴 무공백 글자 칸의 열 폭 변화 (G0 이 센 수) 를 받아들일지. (Phase 1 착수 전)
3. **트랙으로 표현 못 하는 조합** — `Nfr` + `maxWidth` (px · `%`) · px 폭 + `%` `minWidth`/`maxWidth` · `%` 폭 + px `minWidth`/`maxWidth` (표현되는 것: px 폭 + px min/max · `%` 폭 + `%` min/max — 상수 clamp, `Nfr` + `minWidth` px · `%` — `minmax(min, Nfr)`): (a) 그 값은 저장하되 적용하지 않고 Design 패널에 안내, (b) 검증기가 거부, (c) 그 조합이 있는 Table 만 대안 B (표 폭 측정) 로. (Phase 1 착수 전)
4. **정렬 범위** — `allowsSorting` 의 행 재배열을 바운드 Table 만 할지, 정적 행 (작성한 Row 노드) 도 칸 글자로 할지. 두 경우 모두 Preview 실행 상태 · 문서 쓰기 0 · Canvas 는 문서 순서로 둘지. (Phase 4 착수 전)
5. **열 크기 조절 (`allowsResizing`)** — 넣을지, 넣으면 Preview 에서 끝난 폭을 문서에 쓸지 (ADR-250 원칙대로 쓰지 않음이 기본). (Phase 4 착수 전)
6. **`selectionStyle` · `overflowMode` 의 시각 값과 기본값** — S2 값 (TableView 기본 checkbox · truncate, Badge wrap) 을 그대로 쓸지, highlight 선택 배경 색을 무엇으로 할지. (Phase 3 착수 전)
7. **Column `align` 을 같은 열 Cell 기본값으로 줄지** — S2 는 주지 않는다 (Decision 4). 준다면 composition 확장 (D2 정본 순서 4번) 으로 binding 머리말에 적는다. 기본은 S2 대로. (Phase 3 착수 전)

## Risks

| ID  | 위험                                                                                                                                                                            | 심각도 | 대응                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 열 하나의 폭 편집이 행 N 개의 grid 트랙을 증분으로 바꿀 때 엔진이 트랙 · 배치 캐시를 무효화하지 못해 행이 무너진다 (2026-06 증상)                                               |  HIGH  | G1 — 폭 편집 직후 새로고침 없이 · undo/redo · 열 추가 · 삭제 · 순서 변경 뒤 열 정렬. 실패 시 엔진 `update_style` grid 캐시 수리 (TS rebuild 가드 금지) |
| R2  | 기존 문서의 모양이 바뀐다 — TableView 긴 무공백 글자 칸 · 바운드 기본 150px · 작성된 Column/Cell Styles 폭 · (결정 1 이 S2 를 고르면) 기본 최소 폭 75px · 선택 checkbox 열 40px |  HIGH  | G0 영향 수 · 사용자 결정 1 · 2 · 로드 시 1회 전환 · G5 (전환 전후 같은 문서 대조)                                                                      |
| R3  | 트랙으로 표현 못 하는 조합 (`Nfr` + `maxWidth` · 단위가 섞인 clamp) 이 S2/RAC 와 다르게 보인다 — 두 consumer 가 같이 틀리면 대칭 비교로는 안 잡힌다                             |  MED   | 사용자 결정 3 · G1 이 RAC `calculateColumnSizes` 기대값을 독립 oracle 로 (그 조합 · `%` 하한 포함)                                                     |
| R4  | 열 크기 조절 중 트랙 목록 교체가 머리글 행 · Row 에 같이 닿지 않는다 · 감싼 직후 (드래그 전) fr 트랙이 RAC 의 `width: min-content` 아래서 접힌다                                |  HIGH  | G4 — 감싼 직후 폭 (감싸기 전과 ≤ 1 px) · 드래그 전후 실제 폭 변화 (RAC 상태 px 와 일치) + 같은 열 정렬. 실패 시 Phase 4b 제외                          |
| R5  | 행마다 grid solve 가 바운드 큰 표 (ADR-150 window) 의 스크롤 · 편집 비용을 올린다                                                                                               |  MED   | 트랙 목록은 Table 당 한 번 · pre-push ratchet · G6 (편집 → commit → layout → present 총비용)                                                           |
| R6  | 머리글 행이 DOM 에서 노드가 아닌 RAC `tr` 이라 inline 트랙을 실을 수 없다                                                                                                       |  MED   | TableHeader (`thead`) 의 CSS 변수 + `Table.css` `thead > tr` 선택자 · G1 이 머리글 칸을 같이 잰다                                                      |

## Gates

측정 조건 (모든 Gate 공통): headed Chrome · Compare Mode · DPR 2 · visibilityState visible · 저장된 인증 세션. fixture 는 사람이 만든 표 (팔레트 Table · TableView + 손으로 넣은 열 · 행 · 바운드 collection) 이고 합성 표는 G6 규모 측정에만 쓴다. 기하 oracle 은 DOM `getBoundingClientRect` (Chrome) — 엔진 layout map 은 그와 대조되는 쪽이다.

| Gate | 시점             | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 실패 시 대안                                                                                                                                                                             |
| ---- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0          | 인벤토리 고정 — (a) Column · Cell 에 Styles 폭이 작성된 노드 수, (b) 폭을 안 적은 바운드 열 수, (c) TableView 에서 긴 무공백 글자로 열이 넓어진 칸 수 (seed · library · 로컬 프로젝트 · 예제 fixture), (d) 열 index 판정이 닿을 경로 (정적 Row · 바운드 투영 · TableView · 선택 checkbox 열), (e) Table · TableView G3 하니스 기준선                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 집계 경로 보강 후 재측정                                                                                                                                                                 |
| G1   | Phase 1          | 열 정렬 — px · fr · % · `minWidth` · 사용자 결정 3 의 조합 · 칸 padding 다른 열 · 긴 글자 칸 · 선택 checkbox 열을 섞은 fixture, Table · TableView · 바운드 각각: 같은 열의 머리글 칸과 모든 Cell 의 x · 폭 차이 ≤ 0.5 px, 각 열 폭이 **RAC `calculateColumnSizes` 의 기대값** (같은 표 폭 · 같은 Column prop 을 설치 RAC 계산에 넣은 값 — 우리 트랙 함수와 독립한 oracle, 정수 반올림 ≤ 1 px. 기본 최소 폭은 RAC 기본 75 를 그대로 두고, 사용자 결정 1 (i) 이 0 을 고른 경우에만 oracle 에 `getDefaultMinWidth: () => 0` 을 주고 그 사실을 기록한다 — 표 폭 < 75 × 열 수 인 fixture 를 반드시 포함) 과 맞는다 (Canvas · DOM 각각, 그리고 서로) — `%` 하한 (`1fr` + `minWidth: "75%"` → 225 · 75) · px 폭 + `%` 하한 같은 입력 포함, 사용자 결정 3 의 조합은 그 결정의 처리대로. **새로고침 없이** 폭 편집 · undo/redo · 열 추가 · 삭제 · 순서 변경 직후에도 같은 조건 (R1). 대조군: 같은 fixture 를 전환 전 빌드에서 재면 폭을 준 열이 어긋난다 (원복 RED) | 엔진 grid 캐시 수리 · 표현 범위를 사용자 결정 3 로 좁힘                                                                                                                                  |
| G2   | Phase 2          | colSpan — 2 · 3 열 걸친 Cell 이 걸친 열들의 시작 · 끝과 ≤ 0.5 px (padding 있는 칸 · `minWidth` 열을 걸친 경우 포함) · 행의 칸 수 판정이 colSpan 합 · 열 추가 · 삭제의 칸 동기화                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | span 규칙 수리                                                                                                                                                                           |
| G3   | Phase 3          | `align` · `showDivider` · `selectionStyle` · `overflowMode` 각 값에서 Canvas ↔ Preview 픽셀 (ADR-248 G3 하니스 pixelmatch 0.1 ≤ 0.001) · S2 기본값 (Cell `align` start · `showDivider` false) 이 Column 값과 무관함을 unit 으로 (사용자 결정 7 이 확장을 고르면 그 계약)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 해당 축만 다음 Phase 로 미룸                                                                                                                                                             |
| G4   | Phase 4          | (사용자 결정 4 · 5 에 따라) Preview 정렬 클릭 → 행 재배열 · `aria-sort` · Canvas 는 문서 순서 · 문서 revision 불변. 열 크기 조절: `ResizableTableContainer` 로 감싼 직후 (드래그 전) 열 폭이 감싸기 전과 ≤ 1 px (fr 트랙 접힘 차단) · 드래그 전후 머리글 칸 · Cell 의 실제 폭이 RAC 열 폭 상태의 px 와 ≤ 0.5 px 이고 드래그 전과 다르다 (무동작 통과 차단) · 같은 열 정렬 · 문서 revision 불변                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 열 크기 조절은 제외하고 정렬만                                                                                                                                                           |
| G5   | 각 Phase 커밋 전 | 기존 문서 — G0 이 센 문서 (a ~ c) 를 전환 전후로 열어 사용자 결정 1 · 2 의 처리대로 보인다 · 저장 후 다시 열어도 같다 · 바운드 열 150px 유지 (결정 1 을 그렇게 정했다면)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 전환 표 수리                                                                                                                                                                             |
| G6   | 각 push          | pre-push perf ratchet (ADR-246) 통과 · 바운드 Table (실제 투영 행 수를 기록) 스크롤 · 칸 편집 · 열 폭 편집의 편집 → commit → layout → present 총비용이 전환 전 대비 노이즈 폭 안 (before/after 교대 3쌍, 같은 조건) · initial 번들 상한 안                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 트랙 목록 캐시 (Table 당) · 같은 트랙 · 같은 행 폭이면 열 위치를 행마다 다시 풀지 않는 엔진 grid 캐시 — 바꾼 경로에 G1 · G2 재적용 (flex 로 되돌리기 금지 — 기각한 A 의 오차가 돌아온다) |

HIGH 위험 R1 → G1, R2 → G0 · G5, R4 → G4 가 대응한다.

### Live Exercise

(Implemented 승격 시 기재 — 실제 builder 에서 exercise 한 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분)

## Consequences

### Positive

- 표의 열이 열답게 맞는다 — 열 하나의 폭을 바꾸면 그 열 전체가 같이 바뀐다 (지금은 머리글 칸만). 칸 padding 과 무관하게 fr 비율 · colSpan 이 S2/RAC 의미대로다.
- 정적 · 바운드 · TableView 의 열 폭 규칙이 하나로 모인다 (지금은 정적 `flex: 1` · 바운드 150px 고정 · TableView 인라인 `flex: 1` 세 갈래).
- S2 의 열 · 칸 prop (`width` · `defaultWidth` · `minWidth` · `maxWidth` · `colSpan` · `align` · `showDivider` + 표 단위 `selectionStyle` · `overflowMode`) 이 같은 이름 · 값 · 기본값으로 들어온다.
- Row 상자 · 배경 · 선택은 그대로다 (행이 각자 grid).

### Negative

- 행마다 grid 컨테이너가 되어 엔진 grid 경로가 표의 행 수만큼 돈다 (G6 로 관리).
- `Nfr` + `maxWidth` · 단위가 섞인 clamp (px 폭 + `%` min/max · `%` 폭 + px min/max) 는 트랙으로 정확히 표현하지 못한다 (사용자 결정 3).
- RAC 와 열 폭이 정수 반올림만큼 (열당 < 1 px) 다르다 (열 크기 조절을 켜지 않은 정지 상태).
- Column · Cell 의 Styles 폭이 열 규칙과 겹친다 — 사용자 결정 2 의 처리에 따라 편집 · 기존 문서 전환이 생긴다.
- 정렬 · 열 크기 조절 결과는 Preview 에서만 보인다 (Canvas 는 문서 순서 · 문서 폭).
