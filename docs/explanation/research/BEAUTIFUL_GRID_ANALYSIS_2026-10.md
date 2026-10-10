# BeautifulGrid 분석 2026-10 — 아키텍처 · 기능 · 접근성 · composition 적용 판정

> **작성일**: 2026-10-10
> **대상**: [axisj/beautiful-grid](https://github.com/axisj/beautiful-grid) — npm `beautiful-grid` v1.0.19 (commit `71e870b`, 2026-09-27) · 문서 [bgrid.axisj.com](https://bgrid.axisj.com)
> **방법**: ① 원본 저장소 shallow clone 직접 대조 (`beautiful-grid/` 라이브러리 소스 102 파일 · 19,995 행) + npm registry · GitHub 페이지 실측. ② deep-research 워크플로 (검색 5 각도 · 출처 20 · 주장 85 추출 · 25 교차 검증 · 3 표 중 2 반박이면 탈락 — 확인 23 · 탈락 2 · 에이전트 102). ③ 경쟁 비교는 워크플로 검증 통과 claim 이 0 이라 직접 검색 5 건으로 보강 (§7, 신뢰도 표기). §10 이 워크플로 검증 결과다.
> **범위**: 질문은 「composition 에 쓸 수 있는가」 다. §8 이 세 용도 — (a) 빌더 데이터 패널 편집 격자 · (b) 사용자 앱 런타임 Table (publish) · (c) 기능 설계 참조 — 로 나눠 판정한다. 결정 문서 (ADR) 가 아니라 판단 재료다.

---

## 0. 요약

- **정체**: AXISJ (한국) 가 2026-08-26 rc 로 공개한 React 19 전용 DOM 데이터 그리드. 한 달 사이 patch 20 번 (1.0.0 → 1.0.19). Apache-2.0 + 별도 상표 정책. 전신은 같은 회사의 `react-frame-datagrid` (스타일시트와 role 값에 `rfdg-` 접두가 남아 있다).
- **구조**: 그리드 인스턴스마다 zustand v4 store 하나 · `<div role="grid">` 안에 head · body · summary 가 **각각 별도 `<table>`** · frozen 영역은 별도 컴포넌트 쌍 (CSS sticky 가 아니라 DOM 트리 2 벌). 행 가상화는 누적 offset 이진 탐색, 열 가상화도 있다. 100만 행은 물리 스크롤 높이를 1,000,000 px 로 상한 두고 논리 스크롤을 재기준화하는 창 (window) 기법이다.
- **"zero-runtime CSS"** 는 빌드타임 CSS-in-JS 가 아니라 **정적 `style.css` 1 장 (72.8 KB · `.bgrid-*` 클래스 188 · `--bgrid-*` 변수 141)** 과 클래스명을 뜻한다. 배치는 inline style (54 곳) 이다. 「CSS-in-JS 런타임 0」 이지 「런타임 CSS 0」 이 아니다.
- **접근성은 컨테이너 role 뿐**: `role=grid|treegrid` 는 바깥 div 에만 있고, 안쪽은 native `<table>/<tr>/<td>` 에 `row` · `gridcell` · `columnheader` role 도, `aria-rowcount` · `aria-colcount` · `aria-rowindex` · `aria-selected` 도 **0 건**이다. 포커스는 루트 `tabIndex=0` 하나가 숨은 gateway input 으로 넘기는 방식이라 셀 단위 roving tabindex 가 아니다. 키보드는 Arrow 4 방향 · Enter · F2 · Tab · Esc · Home · End · PageUp/Down · Space · ⌘C/A/F 를 직접 구현한다. UI 문자열 (필터 "(전체 선택)" · aria-label "DataGrid 검색") 은 **한국어 하드코딩** 이고 locale prop 이 없다.
- **판정**: (a) 데이터 패널 격자 **대체 불가** — composition 은 ADR-212 Phase 2 (2026-09-12) 로 RAC `Table` + `Virtualizer` 격자를 이미 갖췄고 axe critical 0 · 단일 tab stop 을 달성했다. beautiful-grid 로 바꾸면 D1 (RAC 권위) 과 a11y 가 후퇴한다. (b) 런타임 Table **부적합** — Canvas (Skia) 와 대칭이 성립하지 않고, React 19.2 고정 · zustand v4 중복 · 한국어 하드코딩이 publish 번들에 들어간다. ADR-257 (2026-10-10) 이 정한 「Column 이 트랙을 정하고 모든 행이 같은 grid 트랙을 쓴다」 와도 반대 방향 (px 폭 · 자체 레이아웃) 이다. (c) 기능 참조는 **유효** — 범위 선택 overlay · TSV clipboard 계약 (한계값 · 오류 enum · 붙여넣기 행 생성) · `dataControl` query 계약 · 행 dirty 상태 · 헤더 toolbox 필터 · master-detail 높이 메트릭 · 「AI context 토큰」 측정 스크립트는 데이터 패널 후속 ADR 과 AI 문서 전략의 비교 기준이 된다.

---

## 1. 저장소 사실 (실측)

| 항목            | 값                                                                                                                                                                                      | 근거                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 라이브러리 소스 | `beautiful-grid/` 102 파일 · 19,995 행. `Table.tsx` 3,841 · `store/createAppStore.tsx` 1,895 · `types.ts` 1,453                                                                         | clone `wc`                                  |
| 저장소 나머지   | `src/` · `examples/` · `components/` 는 Vite 데모, `site/` 는 Astro 문서 사이트 (ko 기본 · `en/` 병행)                                                                                  | `AGENTS.md` · `docs/component-structure.md` |
| 런타임 의존     | `zustand ^4.5.7` · `sortablejs ^1.15.3` (열 드래그 전용). peer `react ^19.2.0` · `react-dom ^19.2.0` — rc.1 부터 21 버전 전부 같은 선언. engines `node 24.x`                            | `package.json` · registry                   |
| 배포 형태       | CJS + ESM + types, `./editors` 서브패스, `./style.css`. tarball 296,786 B · unpacked 1.83 MB                                                                                            | `package.json` exports · npm registry       |
| 번들 (gzip)     | 자체 측정 초기 73.6 KiB (JS 64.3 + CSS 9.2) · 전 기능 95.2 KiB · 자체 예산 100 KiB. README 배지는 62.6 KiB 로 다르다 (측정 범위 차이로 보임 — 워크플로에서도 미확정)                    | `site/src/data/bundleMetrics.ts` · README   |
| 릴리스          | npm 20 버전 — `1.0.0-rc.1` 2026-08-26 → `1.0.19` 2026-09-26. 평균 1.5 일에 한 번. `next` 태그는 아직 rc.1                                                                               | registry `time`                             |
| 커뮤니티        | GitHub 96 star · 17 fork · open issue 1 · 142 commit. 최근 35 commit 의 저자 thomasJang 30 · ysyang1973 6 · SQLGate 6 · claude 1                                                        | GitHub 페이지 (API 는 403)                  |
| 라이선스        | Apache-2.0. `NOTICE` "Copyright 2022-2026 AXISJ". `TRADEMARK.md` — 이름 · 로고를 제품명 · 패키지명 · 도메인에 쓰려면 서면 허가. 사이트 SSOT `productFacts.ts` 가 `commercialUse:true`   | `LICENSE` · `NOTICE` · `TRADEMARK.md`       |
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

- 모든 내부 컴포넌트 (11 개) 가 `useAppStore(selector)` + `useShallow` 로 store 를 읽는다. prop 변화는 `Table.tsx` 의 `useEffect` 약 31 개가 setter (`setData` · `setColumns`) 로 store 에 넣는다 — **props → store 복사 모델**이라 data 배열이 크면 두 벌이 산다. 일부 prop (`frozenColumnIndex` · `cellMergeOptions` · `reorder` 등) 은 렌더 중 props 에서 직접도 읽는다.
- 열의 `left` offset 은 진입점 (`BGrid.tsx`) 에서 한 번 계산하고 `frozenColumnIndex` 앞 열은 `left: -1` 센티널로 frozen 컴포넌트에 보낸다.
- `width` · `height` 는 **필수 px 숫자**다 (README "required for virtualization"). 부모 크기를 따라가지 않으므로 소비자가 ResizeObserver 로 넣어야 한다.

### 2-2. DOM

- 바깥 `<div role="grid">` (tree 켜면 `treegrid`, `Table.tsx:2937`) 안에 head · body · summary 가 **각각 `<table>`** 이고 (`TableHead.tsx:164` · `TableBody.tsx:441` · `TableSummary.tsx:94`), frozen 영역은 또 다른 컴포넌트다. `docs/component-structure.md` 가 직접 말한다 — "Frozen columns are rendered in paired components instead of being implemented through CSS sticky cells" · "update frozen and non-frozen components together". 한 논리 행이 frozen `<table>` 과 main `<table>` 로 나뉜다.
- 컴포넌트에서 쓴 요소: `<div>` 91 · `<td>` 17 · `<tr>` 8 · `<tbody>` 7 · `<table>` 5 · `<col>` 5. 셀은 native `<td>` 다. `<canvas>` · `getContext` (2D/WebGL) 0.
- 스크롤바는 자체 그리기 (`scrollbar/` — `modern` · `classic` · `native` 3 변형). popover · editor 는 portal 루트 (`.bgrid-floating-portal-root` · `.bgrid-editor-portal-root`) 에 그린다.

### 2-3. 스타일 — "zero-runtime CSS" 의 실체

- 빌드타임 CSS-in-JS (Linaria · vanilla-extract · Panda · StyleX) 를 쓰지 않는다. 라이브러리 안에 그 흔적이 0 이다. 정적 `beautiful-grid/style.css` 한 장 (72,791 B) 을 `ncp` 로 `dist/style.css` 에 byte-identical 복사하고 (`build:library:style`), 소비자가 import 한다. `scripts/check-library-css.mjs` 가 dist CSS 에 `@tailwind` · `--tw-` 가 섞이면 실패시킨다 (Tailwind 는 데모 사이트 전용). dist JS 에 `insertRule` · `adoptedStyleSheets` · `document.head` 주입 0.
- 테마는 `--bgrid-*` CSS 변수 141 개 (`--bgrid-body-bg` · `--bgrid-active-cell-ring-color` · `--bgrid-cell-selected-overlay-opacity` …). 변수 scope 는 README 의 `[role='grid']` 보다 넓은 `:is([role='grid'],[role='treegrid']), .bgrid-floating-portal-root, .bgrid-editor-portal-root, .bgrid-toolbox-popover` — portal 루트에도 변수를 실어야 popover · editor 가 테마를 받는다. `variant` prop 은 `default | vertical-bordered` 두 값이다.
- 배치 (열 폭 · `left` · paddingTop · overlay 위치 · 가상 스크롤 transform) 는 inline `style={}` 54 곳과 `TableHead` 의 `<style>` 태그 1 개 (헤더 tr 높이 `100/rowLength%`) 가 맡는다. 즉 "zero-runtime" 은 **스타일 계산을 런타임에 안 한다** 는 뜻이지 inline style 이 없다는 뜻이 아니다.

---

## 3. 가상 스크롤

- **행**: `utils/rowHeightMetrics.ts` 가 `getRowHeight(row, index)` 와 master-detail 펼침 높이로 `heights` · `offsets` (`Float64Array`, n+1) 를 만든다. `getRowHeight` 가 없고 펼침도 없으면 `variable: false` 로 고정 높이 산술만 쓴다 (기본 `itemHeight 15 + itemPadding 7 × 2 = 29 px`). 가변이면 `getVisibleScrollableRowRange` 가 offsets 를 이진 탐색한다 (README: 스크롤 중에 `getRowHeight` 를 다시 부르지 않는다). 콜백이 non-finite · ≤ 0 · throw 면 고정값 폴백. **DOM 측정 자동 높이는 의도적 미지원** — "DOM measurement would make large virtualized datasets less predictable".
- **overscan**: 통상 `max(8, 뷰포트 행 수)` 앞뒤 + 8 행 단위 window 배치, reorder 활성 시만 overscan 1 · window 1.
- **열**: `TableBody.tsx` 의 `getVisibleColumnRange` 가 `left` · `width` 로 이진 탐색해 보이는 열만 그리고 건너뛴 열은 filler `<td colSpan>` 으로 채운다 — 열 가상화도 있다. frozen 열은 범위 밖 (별도 컴포넌트).
- **100만 행**: `utils/virtualScrollWindow.ts` — 물리 스크롤 높이를 `BGRID_MAX_PHYSICAL_SCROLL_HEIGHT = 1_000_000` px 로 상한 두고, 논리 scrollTop 을 `base + physicalScrollTop` 으로 환산한다. 창의 25% / 75% guard 를 넘으면 `rebaseVirtualScrollWindow` 가 base 를 옮긴다. 브라우저 요소 높이 상한 (약 1,677 만 px) 과 스크롤 정밀도 문제를 피하는 기법이다. **성능 수치 (fps · 프레임 시간) 는 벤더 자체 벤치마크 (`GATES.performance-content.md`, v1.0.10 대비 "69.0%" 개선 헤드라인) 외에 독립 측정이 없다.**
- **frozen row**: `frozenRowCount` 만큼 위에 고정, 범위 계산에서 뺀다.

---

## 4. 기능 집합 · API 형태

README 「Key Features」 16 절과 `BGridProps` 를 대조한 결과다. **거의 전부 선언적 prop** 이고, imperative 는 `BGridRef<T>` 4 메서드 — `scrollToRow` · `getExportData` · `exportCsv` · `exportExcel` — 뿐이다 (`types.ts:904`, README 미문서).

| 기능                  | prop                                                                                                                                                                                                                  | 형태                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 데이터 · 키           | `data: BGridDataItem<T>[]` (`{ values: T, status?: 'new' \| 'edit' \| 'remove', checked? }`) · `rowKey`                                                                                                               | 행을 wrapper 로 감싼다. `status` 가 dirty tracking 이다. 소비자가 변환해야 한다                                                           |
| 컬럼                  | `columns: BGridColumn<T>[]` — `key: string \| string[]` (dot-path 배열) · `width` (기본 100) · `itemRender` · `editor` · `getClipboardText`                                                                           | TanStack `ColumnDef` 와 개념은 닮았으나 자체 형상                                                                                         |
| 정렬 · 필터           | `dataControl { mode: 'client' \| 'manual', multiSort, query: { sortParams, filterParams }, onChange(query, { type, columnId, action }) }` · 구 `sort`                                                                 | 헤더 toolbox 팝오버 — 필터 종류 text · number · values (distinct 체크 목록). manual 은 그리드가 query 만 내보내고 서버 결과를 다시 받는다 |
| 다단 헤더             | `columnGroups: BGridColumnGroupNode[]` (legacy `columnsGroup`)                                                                                                                                                        | 트리 선언                                                                                                                                 |
| 편집                  | `editable` · `editTrigger: 'click' \| 'dblclick'` · column `editor` (text · checkbox 내장, `beautiful-grid/editors` 의 `createSelectEditorPlugin` · `createDateEditorPlugin` · `defineEditorPlugin`) · `onChangeData` | 커밋은 `BGridCellCommitController` 로 셀 단위. 플러그인 패키지 antd · mantine · mui · shadcn 예제                                         |
| 셀 포커스 · 탐색      | `cellNavigationOptions`                                                                                                                                                                                               | active cell + Arrow · Home/End · PageUp/Down 반복                                                                                         |
| 범위 선택 · clipboard | `cellSelectionOptions` (기본 활성)                                                                                                                                                                                    | §4-1                                                                                                                                      |
| 검색 · 컨텍스트 메뉴  | `searchOptions` (⌘F) · `contextMenuOptions` (우클릭 · Shift+F10)                                                                                                                                                      |                                                                                                                                           |
| 고정                  | `frozenColumnIndex` · `frozenRowCount`                                                                                                                                                                                |                                                                                                                                           |
| 행 재정렬             | `reorder` · `reorderingInfo` · `showLineNumber`                                                                                                                                                                       | sortablejs + 키보드                                                                                                                       |
| 요약 · 병합 · pivot   | `summary { columns \| rows }` · `cellMergeOptions.columnsMap` (세로 병합) · `pivot`                                                                                                                                   |                                                                                                                                           |
| tree · master-detail  | `tree` (flat parent-key) · `masterDetail` (행 아래 서브그리드 · 높이 콜백)                                                                                                                                            |                                                                                                                                           |
| 페이지 · 더 불러오기  | `page` · `enableLoadMore` · `onLoadMore`                                                                                                                                                                              |                                                                                                                                           |
| 열 가시성             | `columnVisibility` (1.0.6 부터)                                                                                                                                                                                       |                                                                                                                                           |
| 메시지                | `msg.emptyList` 하나                                                                                                                                                                                                  | **그 밖의 UI 문자열은 바꿀 수 없다** (§5)                                                                                                 |

### 4-1. 범위 선택 · clipboard 계약 (워크플로 확인 15-0)

- **선택**: drag 는 교체, Shift 는 anchor 확장, Ctrl/⌘ 는 범위 추가 (다중 범위), ⌘A 전체. 렌더는 셀 border 가 아니라 `pointer-events: none` overlay div (`CellSelectionOverlayLayer.tsx`) 로, 한 범위가 frozen 경계를 넘도록 최대 4 fragment (top-left · top-main · body-left · body-main) 로 쪼갠다. drag 중 rAF auto-scroll 이 가상화 밖 행·열까지 선택을 넓힌다. 선택 상태 (`cellSelectionRange(s)` · `cellSelecting`, 절대 index) 는 store 에 있고 DOM 은 `CellNavigationDomSync` 가 미러만 한다.
- **복사 (⌘C)**: 열 `\t` · 행 `\r` (README 는 CRLF 라 하나 실제는 `rows.join('\r')`) 의 **`text/plain` 전용** TSV. `text/html` 직렬화 0 — Excel · Sheets 호환은 TSV 관례에 의존하고 서식 (병합 · 숫자 서식) 은 잃는다. 값은 `column.getClipboardText` → plugin `getClipboardText` → 셀 값 순. 기본 한계 100,000 셀 / 8 MiB 초과 시 `onCopyError(reason: maxClipboardCells | maxClipboardTextLength | clipboardWriteFailed)`.
- **붙여넣기 (⌘V)**: `editable` 일 때만, active cell 이 좌상단. `\r | \n | \r\n` 행 · `\t` 열 파싱. `text/plain` 없는 clipboard 는 `unsupportedClipboardData` 거부. `editable !== true` 열과 `remove` 상태 행은 건너뛴다. 단일 셀 fill · N×M 타일링. 변경 셀마다 `onChangeData`, 행 상태 edit/new 마킹, `createRowOnPaste` 로 부족한 꼬리 행 생성 (항상 `new`). 오류는 `onPasteError`.

---

## 5. 접근성 · 키보드

| 관찰                | 값                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 컨테이너 role       | `grid` / `treegrid` (바깥 div 1 곳)                                                                                                                                                                                          |
| 행 · 셀 · 헤더 role | **없음** — native `<tr>` · `<td>` · `<th>` 뿐. `gridcell` · `columnheader` · `rowheader` 검색 0                                                                                                                              |
| 그리드 ARIA 상태    | `aria-rowcount` · `aria-colcount` · `aria-rowindex` · `aria-colindex` · `aria-selected` · `aria-multiselectable` **0 건** — 가상화로 잘린 행 수를 보조기술에 알릴 길이 없다                                                  |
| 있는 ARIA           | `aria-label` 20 · `aria-hidden` 15 · `aria-disabled` 8 · tree 행의 `aria-level` · `aria-posinset` · `aria-setsize` · `aria-expanded` · 검색 `aria-live` · toolbox `aria-haspopup=dialog` · RowSelector `role=checkbox/radio` |
| 비표준 role 값      | `rfdg-scroll-container` · `rfdg-body` · `paging` · `source` 등 — ARIA 에 없는 값이 `role` 속성에 실린다 (전신 `react-frame-datagrid` 의 잔재)                                                                                |
| 포커스 모델         | 루트 `tabIndex=0` 하나가 `onFocus` 에서 숨은 `[data-bgrid-text-editor-gateway]` input 으로 포커스를 넘기는 gateway 방식. 셀 단위 roving tabindex 아님. `tabIndex` · `.focus()` 10 곳                                         |
| 키보드              | Arrow 4 방향 · Enter · F2 · Tab · Esc · Home · End · PageUp · PageDown · Space · ⌘C/A/F · ContextMenu · Shift+F10 — `Table.tsx` 와 `CellNavigationDomSync.tsx` 가 직접 구현                                                  |
| 공식 접근성 문서    | README 에 절 없음. `ariaLabel` 옵션 (checkbox 헤더 · editor icon) 만 언급. 사이트 `productFacts.ts` 의 "DOM Rendering Benefits: Accessibility" 는 자기 서술                                                                  |
| UI 문자열           | 라이브러리 소스에 한국어 리터럴 78 곳 — "(전체 선택)" · "(빈 값)" · "DataGrid 검색" · "DataGrid 셀 메뉴" · "`${column.label} 편집`" · "`… 컬럼 메뉴`" (aria-label). locale prop 없음                                         |

**읽는 법**: `<div role="grid">` 아래에 native `<table>` 이 오면 접근성 트리에서 `grid` 의 자식으로 `table` (implicit role) 이 오고 그 아래 `row` · `cell` 이 온다 — WAI-ARIA grid 패턴이 요구하는 `grid > row > gridcell` 구조가 아니다. 스크린리더가 셀 좌표 · 선택 상태를 읽을 근거 (`aria-rowindex` · `aria-selected`) 도 없다. 키보드 조작 자체는 되지만 **보조기술 호환은 검증되지 않은 상태**로 보는 것이 맞다 (이 평가는 코드 인벤토리이지 NVDA · VoiceOver 실측이 아니다).

---

## 6. 유지보수 · 라이선스 · 생태계

- **속도와 집중**: 한 달에 patch 20 — 활발하지만 한 사람 (thomasJang, 최근 35 commit 중 30) 이 거의 전부다. 에이전트 주도 개발 (`GATES.*.md` · `AGENTS.md` · `claude` 저자 commit) 이라 코드 양이 빠르게 는다 (`Table.tsx` 3,841 행). 설계 문서 (`docs/*.md` — cell-selection · component-structure · 작업 지시서) 는 내부용이고 영문이다. 공개 이력은 약 6 주다.
- **API 안정성**: 1.0.x 안에서 `sort` → `dataControl` 로 대체 (README "superseded"), `columnsGroup` → `columnGroups`, `columnVisibility` 1.0.6 추가 등 **minor 없이 기능이 patch 에 들어온다**. `publicApiMetrics.ts` 가 deprecated prop 수를 세고 있어 변화를 의식은 한다. breaking change 이력 · SSR 동작 · 테스트 커버리지 비율은 워크플로에서도 검증 통과 claim 이 없어 미확정.
- **플랫폼 고정**: React 19.2 이상 · Node 24 · zustand 4. composition 은 react `^19.2.8` · zustand `^5.0.15` (`pnpm-workspace.yaml` catalog) — React 는 맞고 zustand 는 **v4 · v5 두 벌**이 번들에 들어간다.
- **라이선스**: Apache-2.0 은 문제없다. 상표 정책은 "BeautifulGrid 를 쓴다" 고 말하는 것은 허용, 이름을 제품 · 패키지 · 도메인에 쓰는 것은 불허 — composition 에는 영향 없다.
- **에코시스템**: 편집기 플러그인 패키지 4 종 (`@beautifuljs/grid-antd` · `-mantine` · `-mui` · shadcn 예제). RAC 용은 없다. 벤더가 스스로 적은 한계: Excel formula engine 없음 · designer/ribbon 없음.
- **문서 전략 — composition 과 겹치는 관심사**: `scripts/measure-ai-context.mjs` 가 문서 사이트의 HTML 응답 (514,607 토큰) 과 Markdown 대체 응답 (8,389 토큰) 을 `o200k_base` 로 재서 "AI 에이전트가 문서를 읽을 때 98% 절약" 을 사이트에 게시한다 (`site/src/pages/llms.txt.ts`). 라이브러리 자체 기능은 아니지만, composition 의 AI 어시스턴트 catalog 주입 예산 (ADR-134 Phase 5 — 전체 6,454 tok · Tier 1 + 선택 주입 1,389 tok) 과 같은 문제를 다룬 사례다.

---

## 7. 경쟁 비교 (직접 검색 5 건 — 신뢰도 중간, 가격은 벤더 페이지 재확인 필요)

워크플로의 각도 5 는 검증 통과 claim 이 0 이었다 (§10). 아래는 2026-10-10 직접 검색으로 모은 벤더 · 2차 출처이고, 접근성 열은 **벤더 자기 서술 또는 코드 인벤토리** 수준이다. 독립 스크린리더 실측은 어느 제품도 찾지 못했다.

| 제품                         | 렌더링                   | 라이선스 · 가격                                                                                                                                                       | 접근성 (출처 수준)                                                                                                                                                                                                                                          | 번들 (2차 출처, 측정 방식 불명)   |
| ---------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **beautiful-grid**           | DOM, table 3 벌          | Apache-2.0                                                                                                                                                            | 컨테이너 role 만, 그리드 ARIA 상태 0, 문서 없음 (§5 — 코드 실측)                                                                                                                                                                                            | 자체 측정 73.6 KiB gzip 초기 (§1) |
| **AG Grid**                  | DOM                      | Community MIT (production 가능) / Enterprise $999 · 개발자 · 년 (벤더) — 3자 (Vendr) 는 $995~1,295 계약별 변동                                                        | 벤더 비교표가 ARIA 지원 · 키보드 탐색을 **Community** 기능으로 둔다 (유료 게이트 아님). `aria-rowindex` 출력 여부는 이번 검색에서 미확인                                                                                                                    | 2차 출처 "~200 KB" (근거 불명)    |
| **TanStack Table + Virtual** | headless (DOM 은 소비자) | MIT                                                                                                                                                                   | **소비자 책임** — 마크업 · ARIA · 키보드 전부 직접. composition shared `Table.tsx` 가 이 조합 위에 role 을 손으로 적는다 (§8-2)                                                                                                                             | 2차 출처 "~15 KB"                 |
| **Glide Data Grid**          | **canvas**               | MIT                                                                                                                                                                   | FAQ 가 "스크린리더 지원은 한다, 주 개발자 중 접근성 사용자가 없어 결함이 있을 것" 이라 적는다. canvas 는 DOM 밖이라 ARIA · fallback 을 따로 얹어야 한다 (저자 글: 결국 HTML 판을 하나 더 만들게 된다)                                                       | —                                 |
| **MUI X Data Grid**          | DOM                      | Community MIT (기본 편집 · 페이지 · 단일 정렬/필터) / Pro (다중 필터 · 고정 · 재정렬 · tree · 가상화) / Premium (행 그룹 집계 · Excel). 3자 가격 $180 · $588 — 미확인 | 이번 검색에서 접근성 근거 없음                                                                                                                                                                                                                              | —                                 |
| **Handsontable**             | DOM                      | 비상업 라이선스 v3.0 (2026-01-22 — 교육 · 연구 · 평가, 상업 조직은 90 일 평가) / 상업 유료 키                                                                         | **VPAT 2026-03 (v1.1): WCAG 2.2 A · AA 적합 주장** (감사는 2.1 기준 + 2.2 추가 항목 내부 평가). 두 키보드 모드 (spreadsheet Tab / data grid Arrow 단일 tab stop). 전체 스크린리더 지원엔 `renderAllRows` 권장 — **가상화와 a11y 가 상충**한다고 벤더가 명시 | —                                 |

**「DOM 가상화 + 정적 CSS」 조합의 위치**:

- canvas (Glide) 대비: DOM 이라 CSS 변수 테마 · 브라우저 네이티브 (찾기 · 선택 · 확대) · 접근성 **가능성** 이 열려 있다. 다만 beautiful-grid 는 그 가능성을 role · aria 로 실현하지 않았다 — Handsontable 이 VPAT 까지 간 것과 대비된다.
- headless (TanStack) 대비: 렌더까지 소유한 완제품이라 가져다 쓰기는 빠르지만 DOM 을 바꿀 수 없다. composition 처럼 DOM 권위가 따로 있는 (RAC) 소비자에게는 headless 가 맞고 완제품은 맞지 않는다.
- 상용 (AG Grid · MUI Pro · Handsontable) 대비: 기능 폭 (pivot · master-detail · 100만 행 · Excel clipboard) 이 무료로 열려 있는 점이 차별점이다. 대신 6 주 이력 · 단일 유지자 · React 19.2 고정 · a11y 미검증을 안고 간다.
- Handsontable 의 "`renderAllRows` 권장" 은 **가상화 그리드 공통의 a11y 딜레마**를 벤더가 문서화한 사례다. beautiful-grid 는 `aria-rowcount` 조차 없어 이 딜레마를 아직 마주하지 않은 상태다. composition `DataGrid.tsx` 는 RAC `Virtualizer` 가 `aria-rowcount` 를 자동으로 내므로 같은 딜레마를 RAC 가 처리한다.

출처: [AG Grid community-vs-enterprise](https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise.md) · [AG Grid community edition](https://www.ag-grid.com/community-edition/) · [Vendr AG Grid](https://www.vendr.com/marketplace/ag-grid) · [Bryntum 2026 비교](https://bryntum.com/blog/the-best-javascript-data-grids-in-2026) · [Glide Data Grid FAQ](https://docs.grid.glideapps.com/faq) · [Glide 저자 글](https://itnext.io/i-wrote-an-html-canvas-data-grid-so-you-dont-have-to-d945aa4780b4) · [a11y & Interactive Canvases (GitNation)](https://gitnation.com/contents/a11y-and-interactive-canvases) · [MUI pricing](https://mui.com/pricing/) · [MUI X licensing](https://v5.mui.com/x/introduction/licensing/) · [Handsontable 비상업 라이선스 v3.0](https://handsontable.com/static/licenses/non-commercial/v5/handsontable-non-commercial-license.pdf) · [Handsontable VPAT](https://handsontable.com/docs/vue-data-grid/accessibility-conformance-report/) · [Handsontable accessibility](https://handsontable.com/docs/accessibility/) · [pkgpulse TanStack vs AG Grid 2026](https://www.pkgpulse.com/guides/tanstack-table-vs-ag-grid-vs-react-data-grid-2026) · [wpdatatables 번들 비교](https://wpdatatables.com/javascript-table-library)

---

## 8. composition 대조

### 8-1. (a) 빌더 데이터 패널 편집 격자 — 대체 불가

composition 의 격자는 2026-09 리서치 ([DATA_PANEL_REDESIGN_RESEARCH_2026-09](DATA_PANEL_REDESIGN_RESEARCH_2026-09.md)) 가 제안한 모양 그대로 **이미 구현돼 있다** — [ADR-212](../../adr/212-data-panel-editor-redesign.md) Implemented 2026-09-12, `apps/builder/src/builder/panels/datatable/grid/DataGrid.tsx` (1,516 행).

| 축                 | composition `DataGrid.tsx`                                                                                                                         | beautiful-grid                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| DOM · ARIA (D1)    | RAC `Table` (`role=grid`, `aria-rowcount/colcount` RAC 자동) + `Virtualizer` · `TableLayout`, `keyboardNavigationBehavior="tab"` 로 **tab stop 1** | 바깥 div `role=grid` 만, 내부 native table, 그리드 ARIA 상태 0, gateway 포커스 (§5) |
| a11y 검증          | Phase 7 — 전 표면 axe critical 0, 키보드 시나리오 live 12/12                                                                                       | 공식 검증 없음                                                                      |
| 셀 편집            | Enter / F2 / 타이핑 → inline `<input>` 또는 Popover (JSON · 날짜 · 긴 값, `resolveCellEditorKind`), 키 라우팅 한 표 (`gridKeys.ts`)                | dblclick/click → text · checkbox · plugin editor                                    |
| 쓰기 경로          | 전부 `applyDataChange` (`set_cell` · `insert_rows` · `remove_rows` · `add_field`) → History (⌘Z, ADR-152 data 스택)                                | `onChangeData` 콜백 + 행 `status` dirty 마킹 — undo 는 소비자 몫                    |
| 붙여넣기           | `planGridPaste` → 넘치는 열은 ConfirmDialog "새 필드로 추가?" · 파싱 실패 셀 `data-invalid`                                                        | `text/plain` TSV 만, 한계값 · 오류 enum · `createRowOnPaste` (§4-1)                 |
| 새 필드            | 헤더 끝 `+` 슬롯 → inline 입력 (Airtable 어법)                                                                                                     | 없음 (스키마 편집 개념 없음)                                                        |
| 범위 선택 · 복사   | **없음** (`copy` 0 · `range` 1)                                                                                                                    | drag 범위 overlay + 복사                                                            |
| 정렬 · 필터 · 고정 | **없음** (`sort` 0 · frozen 0)                                                                                                                     | toolbox 정렬 · 필터 3 종 · frozen 열/행                                             |
| 가상화             | RAC `Virtualizer` 고정 행높이                                                                                                                      | 가변 행높이 (콜백) + 열 가상화 + 100만 행 창                                        |

대체하면 잃는 것: RAC D1 권위 · axe 검증 결과 · `DataChange` 단일 쓰기 경로와의 결합 (beautiful-grid 는 자기 store 에 data 를 복사하므로 composition store 와 두 벌이 된다) · 단일 tab stop. 얻는 것은 범위 선택 · 복사 · 정렬 · 필터 · 고정인데, 이들은 RAC `Table` 위에서 추가 구현이 가능한 기능이지 격자를 바꿔야 얻는 기능이 아니다. 패널 리사이즈마다 px `width` · `height` 를 넣어야 하는 비용도 붙는다. **판정: 대체 아님. 격자 후속 ADR 의 기능 참조 (c) 로만 쓴다.**

### 8-2. (b) 사용자 앱 런타임 Table (publish) — 부적합

- **대칭 불가**: D3 원칙은 Builder (Skia) 와 Preview/Publish (DOM) 가 같은 catalog rule 에서 같은 시각 결과를 내는 것이다 (`.claude/rules/ssot-hierarchy.md`). beautiful-grid 의 시각은 `style.css` + `--bgrid-*` 변수 + inline style 이 정본이라 catalog rule 에서 파생되지 않고 (ADR-059 금지 패턴 「수동 CSS 가 SSOT 파생 아님」), Canvas 가 toolbox · 선택 overlay · portal popover · 자체 스크롤바 · frozen 2-tree 를 Skia 로 재현해야 한다. 「Skia 전용 시각 표현 금지」 의 역방향 — **DOM 전용 시각**이 생긴다. `--bgrid-*` 141 개를 theme token 에 매핑하는 어댑터는 가능하지만 그것은 색만 맞추지 기하 · 상호작용을 맞추지 못한다.
- **D1**: RAC 가 DOM/접근성 절대 권위다. beautiful-grid 는 RAC 와 무관한 자체 DOM · 자체 키보드 모델이다 (§5). 단, composition 의 현재 런타임 `packages/shared/src/components/Table.tsx` 도 `@tanstack/react-table` + `@tanstack/react-virtual` 위에 `role="grid"` · `aria-rowcount` 를 **손으로 적는** 구조 (`Table.tsx:1340-1342`) 라 — catalog binding 주석 "RAC Table + …" 과 다르다 — D1 을 이미 엄격히 지키고 있지는 않다. 이 격차는 별도 조사 대상이고, beautiful-grid 도입의 근거는 되지 않는다. 런타임 Table 을 걷어내는 결정은 결정 지점 (3) SSOT 경계 재판정이라 사용자 승인 사안이다.
- **ADR-257 과 반대 방향**: [ADR-257](../../adr/257-table-column-tracks.md) (Proposed 2026-10-10) 은 Column 이 열 트랙 (`ColumnSize` — px · fr · %) 을 정하고 머리글 행과 모든 Row 가 같은 grid 트랙을 쓰며, 열 크기 조절은 Preview 만 RAC `ResizableTableContainer` 로 감싸는 설계다. beautiful-grid 는 px 폭 + 자체 `left` 누적 + 자체 ColResizer 라 트랙 모델이 없고 RAC 의 열 폭 상태와도 잇닿지 않는다.
- **런타임 비용**: publish 초기 번들에 73.6 KiB gzip + zustand v4 사본 + 한국어 하드코딩 문자열 (locale 불가) 이 들어간다. `width` · `height` px 필수라 레이아웃 엔진 (`grid.rs`) 결과를 매 프레임 prop 으로 넣어야 한다.
- **판정: 채택 사유 없음.** composition 런타임 Table 이 필요로 하는 것 (catalog rule 파생 시각 · 레이아웃 엔진 폭 · dataBinding · RAC 트랙) 과 beautiful-grid 가 주는 것 (자체 테마 · px 고정 · 자체 데이터 wrapper) 이 반대 방향이다.

### 8-3. (c) 기능 설계 참조 — 유효

ADR-212 가 후속으로 넘긴 것과 이번 대조에서 드러난 격자 공백 (범위 선택 · 복사 · 정렬 · 필터 · 고정) 을 설계할 때 참조할 구현:

1. **범위 선택 overlay** — `components/selection/CellSelectionOverlayLayer.tsx` (88 행) + `utils/cellSelectionGeometry.ts`: 선택 사각형을 셀 DOM 이 아니라 **별도 overlay layer** 로 그려 가상화 · frozen 경계를 넘는 범위를 최대 4 fragment 로 표현한다. RAC `Table` 의 selection 과 분리된 「셀 범위」 모델을 추가할 때 같은 분리가 필요하고, 같은 기하를 Canvas (Skia) 에서도 그릴 수 있다.
2. **clipboard 계약** — `text/plain` TSV + 한계값 (100,000 셀 / 8 MiB) + 오류 reason enum + `createRowOnPaste`. composition `pasteGrid.ts` 는 격자 단위 파싱이므로, 필드 타입 (`fieldTypes.ts`) 별 직렬화 훅 (`getClipboardText` 에 해당) 을 두면 날짜 · JSON 열의 정확도가 오른다. 열린 질문: `text/html` 표도 받을지 (Excel 서식 보존) — beautiful-grid 는 받지 않는다.
3. **`dataControl` query 계약** — `mode: client | manual` + `query { sortParams, filterParams }` + `onChange(query, { type, columnId, action })`. 데이터 패널이 API 소스 (ADR-212 Phase 4) 에 정렬 · 필터를 위임할 때의 형상 참조.
4. **행 dirty 상태** — `BGridDataItem.status: new | edit | remove`. composition 은 `DataChange` + History 가 이 역할을 하므로 도입 대상은 아니고, 「붙여넣기로 생긴 행은 항상 new」 같은 규칙만 참조.
5. **헤더 toolbox 필터 3 종** — text · number · `values` (distinct 체크 목록). `values` 모드는 데이터 패널의 「값 분포 보기」 요구와 같다.
6. **master-detail 높이 메트릭** — `rowHeightMetrics.ts` 의 `heights` / `offsets` 분리 (행 높이와 펼침 높이를 따로 두고 offsets 로 합산) 와 「측정 없는 콜백 높이 + 이진 탐색」. composition 격자가 가변 행높이 (JSON 셀 펼침) 를 지원하게 될 때의 자료구조 참조이고, DOM 과 무관한 알고리즘이라 Canvas Table 가상화에도 이식 가능하다. 단 현재 shared `Table.tsx` 가 측정 기반 가변 높이를 쓰는지 먼저 실측해야 한다.
7. **AI context 측정** — `measure-ai-context.mjs`: 문서를 Markdown 대체 응답으로 제공하고 토큰 절약을 게이트 (`test:ai-context-metrics`) 로 건다. composition 의 `llms.txt` · AI catalog 주입 예산 측정에 같은 방식 (tiktoken 측정 + 게이트) 을 쓸 수 있다.

---

## 9. 종합

- beautiful-grid 는 **「React 19 · DOM · 선언적 prop · 자체 테마 변수」 로 완결된 업무용 그리드**다. 기능 폭 (pivot · master-detail · 100만 행 창 · Excel clipboard) 은 같은 체급의 무료 오픈소스 중 넓은 편이고, 테스트 · 번들 예산 · 문서 사이트까지 갖췄다.
- composition 과는 **권위 체계가 반대**다. composition 은 DOM/접근성을 RAC 에, 시각을 catalog rule 에, 열 폭을 레이아웃 엔진 트랙 (ADR-257) 에 위임하고 두 렌더러 (Skia · DOM) 가 그것을 소비한다. beautiful-grid 는 셋을 전부 자기가 갖는다. 그래서 데이터 패널 (a) 과 런타임 (b) 어느 쪽에도 **들어갈 자리가 없고**, 들어가면 D1 · D3 가 함께 후퇴한다.
- 남는 가치는 (c) 다 — 범위 선택 · clipboard · `dataControl` · 필터 toolbox · 가변 행높이의 **구현 참조**, 그리고 문서를 AI 가 읽는 비용을 측정하는 **방법 참조**.
- 접근성 평가는 보수적으로 잡아야 한다 — role 은 컨테이너에만 있고 그리드 ARIA 상태가 0 이라, 「키보드가 된다」 와 「보조기술이 읽는다」 는 다른 명제다. 경쟁 제품 중 VPAT 까지 낸 것은 Handsontable 뿐이고, 그 벤더도 가상화와 스크린리더가 상충한다고 적었다.

---

## 10. 워크플로 검증 결과 (확인 · 탈락)

deep-research 워크플로 (2026-10-10, 에이전트 102 · 출처 20 · 주장 85 추출 · 상위 25 교차 검증 · 3 표 중 2 반박이면 탈락): **확인 23 · 탈락 2 · 미검증 0.** 확인된 주장은 §1~§6 · §8 에 녹였다 (1차 출처: GitHub 소스 · npm tarball 1.0.19 · `docs/component-structure.md` · `docs/cell-selection.md` · `site/src/data/productFacts.ts`).

**확인 (3-0 또는 2-1)**: DOM 렌더 (canvas 0) · frozen 2-tree · 정적 `style.css` 복사 배포 · CSS-in-JS 0 · 변수 scope 에 portal 루트 포함 · `width`/`height` px 필수 · 고정/콜백 행높이 + `Float64Array` 이진 탐색 · DOM 측정 의도적 미지원 · 1,000,000 px 창 재기준화 · 열 가상화 + filler `<td>` · zustand v4 인스턴스별 store · sortablejs 열 드래그 전용 · React 19.2 peer 21 버전 동일 · `BGridRef` 4 메서드 · `dataControl` client/manual · `text/plain` 전용 TSV (`\t` · `\r`) · 한계값 · 오류 enum · `createRowOnPaste` · overlay 4 fragment 선택 · 컨테이너 role 만 있고 그리드 ARIA 상태 0 · gateway 포커스 · Apache-2.0 · 1.0.0-rc.1 2026-08-26 · 1.0.19 2026-09-26.

**탈락 (인용 금지)**:

1. 「세로 가상화는 고정 행높이 (`trHeight = itemHeight + itemPadding×2 + 1`) 의 정수 나눗셈만 쓰고 가변 높이는 지원하지 않는다」 — 0-3. 고정 높이는 fast path 일 뿐이다 (§3).
2. 「React 19.2+ · **Node 22+** · 62.6 KiB minzipped · NOTICE/TRADEMARK · 1.x」 를 묶은 주장 — 1-2. 묶음 안의 Node 버전 · 번들 수치가 틀리거나 미확정이다. 본 문서는 `package.json` 실측 (engines `node 24.x`) 과 자체 측정 73.6 KiB 를 쓰고 62.6 KiB 는 불일치로 표기한다 (§1).

**2-1 로 통과했으나 표현을 정정한 것**: 「고정 높이가 100만 행의 근거」 (README 가 직접 말하지는 않는다 — 창 기법과 함께 두 장치로 서술) · overscan 수치 wording · 「mount 뒤 props 를 직접 읽지 않는다」 (과장 — 일부 prop 은 직접 읽는다).

**워크플로가 다루지 못한 것** (caveats): 각도 5 경쟁 비교 전부 (§7 로 보강) · star/fork/commit 추세 · breaking change 이력 · SSR · 테스트 커버리지 비율 · 한/영 문서 품질 · 스크린리더 실측 · bundlephobia 수치.

**열린 질문** (워크플로 제안 + 본 문서 판정):

- composition React 버전 — catalog `^19.2.8` 이라 peer 는 만족한다 (본 문서가 답함, §6).
- shared `Table.tsx` 가 측정 기반 가변 높이를 쓰는지, 쓴다면 Canvas 는 어떻게 같은 높이를 얻는지 — 미실측 (§8-3 6).
- 데이터 패널 붙여넣기에서 `text/html` 표를 받을지 — 후속 ADR 결정 사항 (§8-3 2).
