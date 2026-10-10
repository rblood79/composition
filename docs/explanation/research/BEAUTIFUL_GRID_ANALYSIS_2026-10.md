# BeautifulGrid 분석 2026-10 — 아키텍처 · 기능 · 접근성 · composition 적용 판정

> **작성일**: 2026-10-10
> **대상**: [axisj/beautiful-grid](https://github.com/axisj/beautiful-grid) — npm `beautiful-grid` v1.0.19 (commit `71e870b`, 2026-09-27) · 문서 [bgrid.axisj.com](https://bgrid.axisj.com)
> **방법**: 원본 저장소 shallow clone 직접 대조 (`beautiful-grid/` 라이브러리 소스 102 파일 · 19,995 행) + npm registry · GitHub 페이지 실측 + deep-research 워크플로 (검색 5 각도 · 교차 검증) — §7 · §10 이 워크플로 결과다.
> **범위**: 질문은 「composition 에 쓸 수 있는가」 다. §8 이 세 용도 — (a) 빌더 데이터 패널 편집 격자 · (b) 사용자 앱 런타임 Table (publish) · (c) 기능 설계 참조 — 로 나눠 판정한다. 결정 문서 (ADR) 가 아니라 판단 재료다.

---

## 0. 요약

- **정체**: AXISJ (한국) 가 2026-08-26 rc 로 공개한 React 19 전용 DOM 데이터 그리드. 한 달 사이 patch 20 번 (1.0.0 → 1.0.19). Apache-2.0 + 별도 상표 정책. 전신은 같은 회사의 `react-frame-datagrid` (스타일시트에 `rfdg-` 접두 셀렉터가 남아 있다).
- **구조**: 그리드 인스턴스마다 zustand v4 store 하나 · `<div role="grid">` 안에 head · body · summary 가 **각각 별도 `<table>`** · frozen 영역은 별도 컴포넌트. 행 가상화는 누적 offset 이진 탐색, 열 가상화도 있다. 100만 행은 물리 스크롤 높이를 1,000,000 px 로 상한 두고 논리 스크롤을 재배치하는 창 (window) 기법이다.
- **"zero-runtime CSS"** 는 빌드타임 CSS-in-JS 가 아니라 **정적 `style.css` 1 장 (72.8 KB · `--bgrid-*` 변수 141 개)** 과 클래스명을 뜻한다. 배치는 inline style (54 곳) 이다.
- **접근성은 컨테이너 role 뿐**: `role=grid|treegrid` 는 바깥 div 에만 있고, 안쪽은 native `<table>/<tr>/<td>` 에 `row` · `gridcell` · `columnheader` role 도, `aria-rowcount` · `aria-colcount` · `aria-rowindex` · `aria-selected` 도 **0 건**이다. 키보드는 Arrow 4 방향 · Enter · F2 · Tab · Esc · Home · End · PageUp/Down 을 직접 구현한다. UI 문자열 (필터 "(전체 선택)" · aria-label "DataGrid 검색") 은 **한국어 하드코딩** 이고 locale prop 이 없다.
- **판정**: (a) 데이터 패널 격자 **대체 불가** — composition 은 ADR-212 Phase 2 (2026-09-12) 로 RAC `Table` + `Virtualizer` 격자를 이미 갖췄고 axe critical 0 · 단일 tab stop 을 달성했다. beautiful-grid 로 바꾸면 D1 (RAC 권위) 과 a11y 가 후퇴한다. (b) 런타임 Table **부적합** — Canvas (Skia) 와 대칭이 성립하지 않고, React 19.2 고정 · zustand v4 중복 · 한국어 하드코딩이 publish 번들에 들어간다. (c) 기능 참조는 **유효** — 범위 선택 overlay · Excel 호환 clipboard · 헤더 toolbox 필터 (text/number/values) · master-detail 높이 메트릭 · 「AI context 토큰」 측정 스크립트는 composition 데이터 패널 후속 ADR 과 AI 문서 전략의 비교 기준이 된다.

---

## 1. 저장소 사실 (실측)

| 항목            | 값                                                                                                                                                                                      | 근거                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 라이브러리 소스 | `beautiful-grid/` 102 파일 · 19,995 행. `Table.tsx` 3,841 · `store/createAppStore.tsx` 1,895 · `types.ts` 1,453                                                                         | clone `wc`                                  |
| 저장소 나머지   | `src/` · `examples/` · `components/` 는 Vite 데모, `site/` 는 Astro 문서 사이트 (ko 기본 · `en/` 병행)                                                                                  | `AGENTS.md` · `docs/component-structure.md` |
| 런타임 의존     | `zustand ^4.5.7` · `sortablejs ^1.15.3`. peer `react ^19.2.0` · `react-dom ^19.2.0`. engines `node 24.x`                                                                                | `package.json`                              |
| 배포 형태       | CJS + ESM + types, `./editors` 서브패스, `./style.css`. unpacked 1.83 MB                                                                                                                | `package.json` exports · npm registry       |
| 번들 (gzip)     | 초기 73.6 KiB (JS 64.3 + CSS 9.2) · 전 기능 95.2 KiB · 자체 예산 100 KiB. README 배지는 62.6 KiB 로 다르다 (측정 범위 차이로 보임)                                                      | `site/src/data/bundleMetrics.ts` · README   |
| 릴리스          | npm 20 버전 — `1.0.0-rc.1` 2026-08-26 → `1.0.19` 2026-09-26. 평균 1.5 일에 한 번                                                                                                        | registry `time`                             |
| 커뮤니티        | GitHub 96 star · 17 fork · open issue 1 · 142 commit. 최근 35 commit 의 저자 thomasJang 30 · ysyang1973 6 · SQLGate 6 · claude 1                                                        | GitHub 페이지 (API 는 403)                  |
| 라이선스        | Apache-2.0. `NOTICE` "Copyright 2022-2026 AXISJ". `TRADEMARK.md` — 이름 · 로고를 제품명 · 패키지명 · 도메인에 쓰려면 서면 허가                                                          | `LICENSE` · `NOTICE` · `TRADEMARK.md`       |
| 테스트          | vitest 단위 + Playwright e2e, 파일 70 · `it/test` 550 건. CI `tests.yml` · `publish-npm.yml`. `verify:library` = lint + test + CSS 검사 + README props 검사 + CJS/ESM/types 소비자 검사 | `test/` · `e2e/` · `.github/workflows`      |
| 개발 방식       | `GATES.*.md` 가 게이트 ledger (`unlazy` 스킬 · `ego-browser` 검증) — 에이전트 주도 개발 흔적. `AGENTS.md` 가 구조 정본                                                                  | 루트 파일                                   |

---

## 2. 아키텍처 · 렌더링

### 2-1. 흐름

```txt
BGridProps<T> → BGrid (props 정규화 · computedColumns · initialStoreState)
  → AppStoreProvider (zustand createStore, 인스턴스당 1)
    → Table (3,841 행 — 이벤트 · 포커스 · 선택 · 편집 · clipboard 조정자)
      → TableHeadFrozen + TableHead · TableSummaryFrozen + TableSummary
      → TableBodyFrozen + TableBody · TableFooter → Pagination
```

- 모든 내부 컴포넌트가 `useAppStore(selector)` 로 store 를 읽는다. prop 변화는 `Table.tsx` 의 `useEffect` 가 setter (`setData` · `setColumns`) 로 store 에 넣는다 — **props → store 복사 모델**이라 data 배열이 크면 두 벌이 산다.
- 열의 `left` offset 은 진입점 (`BGrid.tsx`) 에서 한 번 계산하고 `frozenColumnIndex` 앞 열은 `left: -1` 센티널로 frozen 컴포넌트에 보낸다.
- `width` · `height` 는 **필수 px 숫자**다 (README "required for virtualization"). 부모 크기를 따라가지 않으므로 소비자가 ResizeObserver 로 넣어야 한다.

### 2-2. DOM

- 바깥 `<div role="grid">` (tree 켜면 `treegrid`, `Table.tsx:2937`) 안에 head · body · summary 가 **각각 `<table>`** 이고 (`TableHead.tsx:164` · `TableBody.tsx:441` · `TableSummary.tsx:94`), frozen 영역은 또 다른 컴포넌트다. 한 논리 행이 frozen `<table>` 과 main `<table>` 로 나뉜다.
- 컴포넌트에서 쓴 요소: `<div>` 91 · `<td>` 17 · `<tr>` 8 · `<tbody>` 7 · `<table>` 5 · `<col>` 5. 셀은 native `<td>` 다.
- 스크롤바는 자체 그리기 (`scrollbar/` — `modern` · `classic` · `native` 3 변형).

### 2-3. 스타일 — "zero-runtime CSS" 의 실체

- 빌드타임 CSS-in-JS (Linaria · vanilla-extract · Panda) 를 쓰지 않는다. 라이브러리 안에 그 흔적이 0 이다. 정적 `beautiful-grid/style.css` 한 장 (72,791 B) 을 `dist/style.css` 로 복사하고 (`build:library:style`), 소비자가 import 한다.
- 테마는 `--bgrid-*` CSS 변수 141 개 (`--bgrid-body-bg` · `--bgrid-active-cell-ring-color` · `--bgrid-cell-selected-overlay-opacity` …). 변수를 덮어쓰는 것이 유일한 테마 경로이고, `variant` prop 은 `default | vertical-bordered` 두 값이다.
- 배치 (열 폭 · `left` · paddingTop · overlay 위치) 는 inline `style={}` 54 곳이 맡는다. 즉 "zero-runtime" 은 **스타일 계산을 런타임에 안 한다** 는 뜻이지 inline style 이 없다는 뜻이 아니다.

---

## 3. 가상 스크롤

- **행**: `utils/rowHeightMetrics.ts` 가 `getRowHeight(row, index)` 와 master-detail 펼침 높이로 `heights` · `offsets` (`Float64Array`) 를 만든다. `getRowHeight` 가 없고 펼침도 없으면 `variable: false` 로 고정 높이 산술만 쓴다. 가변이면 `getVisibleScrollableRowRange` 가 offsets 를 이진 탐색한다 (README: 스크롤 중에 `getRowHeight` 를 다시 부르지 않는다).
- **열**: `TableBody.tsx` 의 `getVisibleColumnRange` 가 `left` · `width` 로 이진 탐색해 보이는 열만 그린다 — 열 가상화도 있다.
- **100만 행**: `utils/virtualScrollWindow.ts` — 물리 스크롤 높이를 `BGRID_MAX_PHYSICAL_SCROLL_HEIGHT = 1_000_000` px 로 상한 두고, 논리 scrollTop 을 `base + physicalScrollTop` 으로 환산한다. 창이 끝에 가까워지면 `rebaseVirtualScrollWindow` 가 base 를 옮긴다. 브라우저 요소 높이 상한 (약 1,677 만 px) 과 스크롤 정밀도 문제를 피하는 기법이다. 성능 수치는 §7.
- **frozen row**: `frozenRowCount` 만큼 위에 고정, 범위 계산에서 뺀다.

---

## 4. 기능 집합 · API 형태

README 「Key Features」 16 절과 `BGridProps` 를 대조한 결과다. **전부 선언적 prop** 이고, imperative 는 export ref (`exportRef.test.tsx` — CSV · Excel · data) 정도다.

| 기능                  | prop                                                                                                                                                            | 형태                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 데이터 · 키           | `data: BGridDataItem<T>[]` (`{ values: T, status?, checked? }`) · `rowKey`                                                                                      | 행을 wrapper 로 감싼다. 소비자가 변환해야 한다                                                                                          |
| 컬럼                  | `columns: BGridColumn<T>[]` — `key: string \| string[]` (dot-path 배열) · `width` (기본 100) · `itemRender` · editor                                            | TanStack `ColumnDef` 와 다른 자체 형상                                                                                                  |
| 정렬 · 필터           | `dataControl { mode: 'client' \| 'manual', sortParams, filterParams }` · 구 `sort`                                                                              | 헤더 toolbox 팝오버 — 필터 종류 text · number · values (distinct 체크 목록). manual 이면 서버가 한다                                    |
| 다단 헤더             | `columnGroups: BGridColumnGroupNode[]`                                                                                                                          | 트리 선언                                                                                                                               |
| 편집                  | `editable` · `editTrigger: 'click' \| 'dblclick'` · column `editor` (text · checkbox 내장, plugin — antd · mantine · mui · shadcn 패키지 별도) · `onChangeData` | 커밋은 `BGridCellCommitController` 로 셀 단위. 트랜잭션 테스트 (`cellEditTransaction.test.ts`) 있음                                     |
| 셀 포커스 · 탐색      | `cellNavigationOptions`                                                                                                                                         | active cell + Arrow · Home/End · PageUp/Down 반복                                                                                       |
| 범위 선택 · clipboard | `cellSelectionOptions`                                                                                                                                          | drag 범위 → `CellSelectionOverlayLayer` (DOM overlay) · copy/paste 는 column `clipboard` 훅으로 직렬화 · 파싱 (Excel · Sheets 호환 TSV) |
| 검색 · 컨텍스트 메뉴  | `searchOptions` (⌘F) · `contextMenuOptions` (우클릭 · Shift+F10)                                                                                                |                                                                                                                                         |
| 고정                  | `frozenColumnIndex` · `frozenRowCount`                                                                                                                          |                                                                                                                                         |
| 행 재정렬             | `reorder` · `reorderingInfo` · `showLineNumber`                                                                                                                 | sortablejs + 키보드                                                                                                                     |
| 요약 · 병합 · pivot   | `summary { columns \| rows }` · `cellMergeOptions.columnsMap` (세로 병합) · `pivot`                                                                             |                                                                                                                                         |
| tree · master-detail  | `tree` (flat parent-key) · `masterDetail` (행 아래 서브그리드 · 높이 콜백)                                                                                      |                                                                                                                                         |
| 페이지 · 더 불러오기  | `page` · `enableLoadMore` · `onLoadMore`                                                                                                                        |                                                                                                                                         |
| 열 가시성             | `columnVisibility` (1.0.6 부터)                                                                                                                                 |                                                                                                                                         |
| 메시지                | `msg.emptyList` 하나                                                                                                                                            | **그 밖의 UI 문자열은 바꿀 수 없다** (§5)                                                                                               |

---

## 5. 접근성 · 키보드

| 관찰                | 값                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 컨테이너 role       | `grid` / `treegrid` (바깥 div 1 곳)                                                                                                                                                      |
| 행 · 셀 · 헤더 role | **없음** — native `<tr>` · `<td>` · `<th>` 뿐. `gridcell` · `columnheader` · `rowheader` 검색 0                                                                                          |
| 그리드 ARIA 상태    | `aria-rowcount` · `aria-colcount` · `aria-rowindex` · `aria-colindex` · `aria-selected` **0 건**                                                                                         |
| 있는 ARIA           | `aria-label` 20 · `aria-hidden` 15 · `aria-disabled` 8 · tree 행의 `aria-level` · `aria-posinset` · `aria-setsize` · `aria-expanded` · 검색 `aria-live` · toolbox `aria-haspopup=dialog` |
| 키보드              | Arrow 4 방향 · Enter · F2 · Tab · Esc · Home · End · PageUp · PageDown — `Table.tsx` 와 `CellNavigationDomSync.tsx` 가 직접 구현. `tabIndex` · `.focus()` 10 곳                          |
| 공식 접근성 문서    | README 에 절 없음. `ariaLabel` 옵션 (checkbox 헤더 · editor icon) 만 언급                                                                                                                |
| UI 문자열           | 라이브러리 소스에 한국어 리터럴 78 곳 — "(전체 선택)" · "(빈 값)" · "DataGrid 검색" · "DataGrid 셀 메뉴" · "`${column.label} 편집`" · "`… 컬럼 메뉴`" (aria-label). locale prop 없음     |

**읽는 법**: `<div role="grid">` 아래에 native `<table>` 이 오면 접근성 트리에서 `grid` 의 자식으로 `table` (implicit role) 이 오고 그 아래 `row` · `cell` 이 온다 — WAI-ARIA grid 패턴이 요구하는 `grid > row > gridcell` 구조가 아니다. 스크린리더가 셀 좌표 · 선택 상태를 읽을 근거 (`aria-rowindex` · `aria-selected`) 도 없다. 키보드 조작 자체는 되지만 **보조기술 호환은 검증되지 않은 상태**로 보는 것이 맞다. 워크플로 §7 에서 외부 평가가 있는지 본다.

---

## 6. 유지보수 · 라이선스 · 생태계

- **속도와 집중**: 한 달에 patch 20 — 활발하지만 한 사람 (thomasJang, 최근 35 commit 중 30) 이 거의 전부다. 에이전트 주도 개발 (`GATES.*.md` · `AGENTS.md` · `claude` 저자 commit) 이라 코드 양이 빠르게 는다 (`Table.tsx` 3,841 행). 설계 문서 (`docs/*.md` — cell-selection · component-structure · 작업 지시서) 는 내부용이고 영문이다.
- **API 안정성**: 1.0.x 안에서 `sort` → `dataControl` 로 대체 (README "superseded"), `columnVisibility` 1.0.6 추가 등 **minor 없이 기능이 patch 에 들어온다**. `publicApiMetrics.ts` 가 deprecated prop 수를 세고 있어 변화를 의식은 한다.
- **플랫폼 고정**: React 19.2 이상 · Node 24 · zustand 4. composition 은 react `^19.2.8` · zustand `^5.0.15` (`pnpm-workspace.yaml` catalog) — React 는 맞고 zustand 는 **v4 · v5 두 벌**이 번들에 들어간다.
- **라이선스**: Apache-2.0 은 문제없다. 상표 정책은 "BeautifulGrid 를 쓴다" 고 말하는 것은 허용, 이름을 제품 · 패키지 · 도메인에 쓰는 것은 불허 — composition 에는 영향 없다.
- **에코시스템**: 편집기 플러그인 패키지 4 종 (`@beautifuljs/grid-antd` · `-mantine` · `-mui` · shadcn 예제). RAC 용은 없다.
- **문서 전략 — composition 과 겹치는 관심사**: `scripts/measure-ai-context.mjs` 가 문서 사이트의 HTML 응답 (514,607 토큰) 과 Markdown 대체 응답 (8,389 토큰) 을 `o200k_base` 로 재서 "AI 에이전트가 문서를 읽을 때 98% 절약" 을 사이트에 게시한다 (`site/src/pages/llms.txt.ts`). 라이브러리 자체 기능은 아니지만, composition 의 AI 어시스턴트 catalog 주입 예산 (ADR-134 Phase 5 — 전체 6,454 tok · Tier 1 + 선택 주입 1,389 tok) 과 같은 문제를 다룬 사례다.

---

## 7. 경쟁 비교 (워크플로 검증 결과)

_(deep-research 워크플로 결과로 채운다 — AG Grid · TanStack Table · Glide Data Grid · MUI DataGrid · Handsontable 대비 렌더링 · 접근성 · 번들 · 가격.)_

---

## 8. composition 대조

### 8-1. (a) 빌더 데이터 패널 편집 격자 — 대체 불가

composition 의 격자는 2026-09 리서치 ([DATA_PANEL_REDESIGN_RESEARCH_2026-09](DATA_PANEL_REDESIGN_RESEARCH_2026-09.md)) 가 제안한 모양 그대로 **이미 구현돼 있다** — [ADR-212](../../adr/212-data-panel-editor-redesign.md) Implemented 2026-09-12, `apps/builder/src/builder/panels/datatable/grid/DataGrid.tsx` (1,516 행).

| 축                 | composition `DataGrid.tsx`                                                                                                                         | beautiful-grid                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| DOM · ARIA (D1)    | RAC `Table` (`role=grid`, `aria-rowcount/colcount` RAC 자동) + `Virtualizer` · `TableLayout`, `keyboardNavigationBehavior="tab"` 로 **tab stop 1** | 바깥 div `role=grid` 만, 내부 native table, 그리드 ARIA 상태 0 (§5) |
| a11y 검증          | Phase 7 — 전 표면 axe critical 0, 키보드 시나리오 live 12/12                                                                                       | 공식 검증 없음                                                      |
| 셀 편집            | Enter / F2 / 타이핑 → inline `<input>` 또는 Popover (JSON · 날짜 · 긴 값, `resolveCellEditorKind`), 키 라우팅 한 표 (`gridKeys.ts`)                | dblclick/click → text · checkbox · plugin editor                    |
| 쓰기 경로          | 전부 `applyDataChange` (`set_cell` · `insert_rows` · `remove_rows` · `add_field`) → History (⌘Z, ADR-152 data 스택)                                | `onChangeData` 콜백 — undo 는 소비자 몫                             |
| 붙여넣기           | `planGridPaste` → 넘치는 열은 ConfirmDialog "새 필드로 추가?" · 파싱 실패 셀 `data-invalid`                                                        | Excel/Sheets 호환 TSV 파싱, column `clipboard` 훅                   |
| 새 필드            | 헤더 끝 `+` 슬롯 → inline 입력 (Airtable 어법)                                                                                                     | 없음 (스키마 편집 개념 없음)                                        |
| 범위 선택 · 복사   | **없음** (`copy` 0 · `range` 1)                                                                                                                    | drag 범위 overlay + copy                                            |
| 정렬 · 필터 · 고정 | **없음** (`sort` 0 · frozen 0)                                                                                                                     | toolbox 정렬 · 필터 3 종 · frozen 열/행                             |
| 가상화             | RAC `Virtualizer` 고정 행높이                                                                                                                      | 가변 행높이 + 열 가상화 + 100만 행 창                               |

대체하면 잃는 것: RAC D1 권위 · axe 검증 결과 · `DataChange` 단일 쓰기 경로와의 결합 (beautiful-grid 는 자기 store 에 data 를 복사하므로 composition store 와 두 벌이 된다) · 단일 tab stop. 얻는 것은 범위 선택 · 복사 · 정렬 · 필터 · 고정인데, 이들은 RAC `Table` 위에서 추가 구현이 가능한 기능이지 격자를 바꿔야 얻는 기능이 아니다. **판정: 대체 아님. 격자 후속 ADR 의 기능 참조 (c) 로만 쓴다.**

### 8-2. (b) 사용자 앱 런타임 Table (publish) — 부적합

- **대칭 불가**: D3 원칙은 Builder (Skia) 와 Preview/Publish (DOM) 가 같은 catalog rule 에서 같은 시각 결과를 내는 것이다 (`.claude/rules/ssot-hierarchy.md`). beautiful-grid 의 시각은 `style.css` + `--bgrid-*` 변수 + inline style 이 정본이라 catalog rule 에서 파생되지 않고, Canvas 가 toolbox · 선택 overlay · 자체 스크롤바를 Skia 로 재현해야 한다. 「Skia 전용 시각 표현 금지」 의 역방향 — **DOM 전용 시각**이 생긴다.
- **D1**: RAC 가 DOM/접근성 절대 권위다. beautiful-grid 는 RAC 와 무관한 자체 DOM · 자체 키보드 모델이다. 단, composition 의 현재 런타임 `packages/shared/src/components/Table.tsx` 도 `@tanstack/react-table` + `@tanstack/react-virtual` 위에 `role="grid"` · `aria-rowcount` 를 **손으로 적는** 구조 (`Table.tsx:1340-1342`) 라 — catalog binding 주석 "RAC Table + …" 과 다르다 — D1 을 이미 엄격히 지키고 있지는 않다. 이 격차는 별도 조사 대상이고, beautiful-grid 도입의 근거는 되지 않는다.
- **런타임 비용**: publish 초기 번들에 73.6 KiB gzip + zustand v4 사본 + 한국어 하드코딩 문자열 (locale 불가) 이 들어간다. `width` · `height` px 필수라 레이아웃 엔진 (`grid.rs`) 결과를 매 프레임 prop 으로 넣어야 한다.
- **판정: 채택 사유 없음.** composition 런타임 Table 이 필요로 하는 것 (catalog rule 파생 시각 · 레이아웃 엔진 폭 · dataBinding) 과 beautiful-grid 가 주는 것 (자체 테마 · px 고정 · 자체 데이터 wrapper) 이 반대 방향이다.

### 8-3. (c) 기능 설계 참조 — 유효

ADR-212 가 후속으로 넘긴 것과 이번 대조에서 드러난 격자 공백 (범위 선택 · 복사 · 정렬 · 필터 · 고정) 을 설계할 때 참조할 구현:

1. **범위 선택 overlay** — `components/selection/CellSelectionOverlayLayer.tsx` (88 행): 선택 사각형을 셀 DOM 이 아니라 **별도 overlay layer** 로 그려 가상화 · frozen 경계를 넘는 범위를 한 요소로 표현한다. RAC `Table` 의 selection 과 분리된 「셀 범위」 모델을 추가할 때 같은 분리가 필요하다.
2. **clipboard 직렬화 훅** — column 단위 `clipboard { toText, parse }` (`BGridCellClipboardTextParams` · `BGridCellClipboardParseParams`): 타입별 직렬화를 컬럼 정의에 둔다. composition 은 `pasteGrid.ts` 가 격자 단위로 파싱하므로, 필드 타입 (`fieldTypes.ts`) 별 훅으로 옮기면 날짜 · JSON 열의 붙여넣기 정확도가 오른다.
3. **헤더 toolbox 필터 3 종** — text · number · `values` (distinct 체크 목록). `values` 모드는 데이터 패널의 「값 분포 보기」 요구와 같다.
4. **master-detail 높이 메트릭** — `rowHeightMetrics.ts` 의 `heights` / `offsets` 분리 (행 높이와 펼침 높이를 따로 두고 offsets 로 합산). composition 격자가 가변 행높이 (JSON 셀 펼침) 를 지원하게 될 때의 자료구조 참조.
5. **AI context 측정** — `measure-ai-context.mjs`: 문서를 Markdown 대체 응답으로 제공하고 토큰 절약을 게이트 (`test:ai-context-metrics`) 로 건다. composition 의 `llms.txt` · AI catalog 주입 예산 측정에 같은 방식 (tiktoken 측정 + 게이트) 을 쓸 수 있다.

---

## 9. 종합

- beautiful-grid 는 **「React 19 · DOM · 선언적 prop · 자체 테마 변수」 로 완결된 업무용 그리드**다. 기능 폭 (pivot · master-detail · 100만 행 창 · Excel clipboard) 은 같은 체급의 오픈소스 중 넓은 편이고, 테스트 · 번들 예산 · 문서 사이트까지 갖췄다.
- composition 과는 **권위 체계가 반대**다. composition 은 DOM/접근성을 RAC 에, 시각을 catalog rule 에 위임하고 두 렌더러 (Skia · DOM) 가 그것을 소비한다. beautiful-grid 는 셋을 전부 자기가 갖는다. 그래서 데이터 패널 (a) 과 런타임 (b) 어느 쪽에도 **들어갈 자리가 없고**, 들어가면 D1 · D3 가 함께 후퇴한다.
- 남는 가치는 (c) 다 — 범위 선택 · clipboard · 필터 toolbox · 가변 행높이의 **구현 참조**, 그리고 문서를 AI 가 읽는 비용을 측정하는 **방법 참조**.
- 접근성 평가는 보수적으로 잡아야 한다 — role 은 컨테이너에만 있고 그리드 ARIA 상태가 0 이라, 「키보드가 된다」 와 「보조기술이 읽는다」 는 다른 명제다.

---

## 10. 워크플로 검증 결과 (확인 · 탈락)

_(deep-research 워크플로 결과로 채운다.)_
