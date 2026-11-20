# ADR-315 breakdown — Table 을 data grid 로

> 본문: [315-table-data-grid-state-model.md](../315-table-data-grid-state-model.md). 코드 인용은 main `23b1c802b` (2026-11-20) 기준이고, 새 이름은 전부 제안이다.

## 1. 전제

- 범위 = TanStack Table v9.3.1 의 기능 17 개 + Worker row model (사용자 2026-11-20 「tankstack이 지원하는 기능 모두」).
- 사용자 답 2 건 (본문 Status): 칸 범위 선택은 D1 예외를 두고 마지막 단계 · Worker 는 측정 뒤 조건부.
- 선행 관계 4 질문은 본문 Context 「선행 결정」 에 고정했다 — ADR-284 · 310 이 base, 이 ADR 이 응용.
- TanStack 코드는 runtime 에 넣지 않는다. 가져오는 것은 상태 형 · 단계 순서 · 옵션의 뜻이다.

## 2. 기능 표 (TanStack 17 + Worker)

상태 형과 옵션은 `packages/table-core/src/features/<기능>/*.types.ts` 에서 읽었다. 「지금」 열은 2026-11-20 코드 실측이고 G0 에서 다시 대조한다.

|  #  | TanStack 기능                   | TanStack 상태 형 · 주요 옵션                                                                                                               | 지금                                                                                | 목표 (이 ADR)                                                                          | 조각    | Phase |
| :-: | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------- | :---: |
|  1  | row-sorting                     | `{id, desc}[]` · `enableMultiSort` · `maxMultiSortColCount` · `sortDescFirst` · `sortUndefined` · `enableSortingRemoval` · `manualSorting` | 한 열 · 타입을 읽지 않는 비교 (`tableSort.ts:65`) · 실행 상태 `tableSorts`          | 여러 열 (Shift 클릭 추가 · 순번 표시) · 타입별 비교 · 빈 값 위치 · 첫 방향 · 정렬 해제 | 정렬    |   2   |
|  2  | global-filtering                | `globalFilter: any` · `getColumnCanGlobalFilter` · `globalFilterFn`                                                                        | 조건 하나가 필드 여러 개를 읽음 (`ViewCondition.fields`) — 「이 표의 열 전부」 없음 | 검색어 하나를 검색 가능한 열 전부에 · 열마다 검색 제외 · 유사 검색 (사용자 결정 2)     | 검색    |   3   |
|  3  | column-filtering                | `{id, value}[]` · `filterFn` 18 종 · `filterFromLeafRows` · `manualFiltering`                                                              | 보기 조건 (그리고 / 또는 중첩 · 연산자 21 — `comparison.ts:38`) · 값은 페이지 변수  | 그대로 + 열 메뉴에서 그 열의 조건을 실행 중 추가 · 해제                                | 열 필터 |   3   |
|  4  | column-faceting                 | 상태 없음 · `getFacetedRowModel` · `getFacetedUniqueValues` · `getFacetedMinMaxValues`                                                     | 작성 때 고유 값 20 개 (`viewAuthoring.ts:158`) · 실행 중 없음                       | 열마다 「자기 필터만 뺀 결과」 의 고유 값 · 개수 · 최소 · 최대 → 필터 컨트롤 항목      | (파생)  |   3   |
|  5  | column-visibility               | `Record<id, boolean>` · `enableHiding`                                                                                                     | 작성 때만 (`NodeEntry.enabled` — `structure.ts:503` `tableHidingTargets`)           | 작성자 기본 숨김 + 최종 사용자 켜고 끄기 (열 선택 메뉴)                                | 열 숨김 |   4   |
|  6  | column-ordering                 | `string[]`                                                                                                                                 | 작성 때만 (`structure.ts` `tableColumnOrder`)                                       | 최종 사용자 순서 변경 (열 메뉴 · 끌기는 사용자 결정 3)                                 | 열 순서 |   4   |
|  7  | column-pinning                  | `{start: string[], end: string[]}` · `enablePinning`                                                                                       | 없음 (머리글만 sticky)                                                              | 열을 앞 · 뒤에 고정 (작성자 기본 + 최종 사용자)                                        | 열 고정 |   4   |
|  8  | column-sizing                   | `Record<id, number>` · `size` · `minSize` · `maxSize`                                                                                      | 있음 (Column `width` · `minWidth` · `maxWidth` — ADR-257)                           | 그대로. 실행 중 폭을 표 상태로 올림 (기억 대상)                                        | 열 폭   |   4   |
|  9  | column-resizing                 | 끄는 중 상태 · `columnResizeMode`                                                                                                          | 있음 (RAC `ColumnResizer`)                                                          | 그대로                                                                                 | 열 폭   |   4   |
| 10  | column-grouping                 | `string[]` · `groupedColumnMode` · `manualGrouping`                                                                                        | 파생 보기의 `groupBy` — 결과가 새 표                                                | 표 안 묶음 행 (펼침) · 묶은 열의 자리 (`reorder` · `remove` 의 뜻)                     | 묶기    |   5   |
| 11  | row-aggregation                 | 상태 없음 · `aggregationFn` 11 종                                                                                                          | 값 집계 5 종 (count · sum · mean · min · max) + `applied` (`types.ts:843`)          | 묶음 행 · 바닥 합계 행 (`TableFooter`) 의 집계 칸 · 종류는 사용자 결정 4               | 묶기    |   5   |
| 12  | row-expanding                   | `true \| Record<id, boolean>` · `getRowCanExpand` · `paginateExpandedRows`                                                                 | 없음                                                                                | RAC 펼침 행 — 묶음 · 계층 데이터 · 상세 행                                             | 펼침    |   5   |
| 13  | row-pinning                     | `{top: string[], bottom: string[]}` · `keepPinnedRows`                                                                                     | 없음                                                                                | 데이터 행을 위 · 아래 고정                                                             | 행 고정 |   5   |
| 14  | row-pagination                  | `{pageIndex, pageSize}` · `autoResetPageIndex` · `manualPagination`                                                                        | 있음 (`rowDisplay` · Pagination — ADR-310 · contract 73)                            | 그대로. 다른 조각이 바뀌면 첫 쪽 (조각 사이 규칙 §4.4)                                 | 쪽      |   1   |
| 15  | row-selection                   | `Record<id, true>` · `enableRowRangeSelection`                                                                                             | 있음 (RAC — Shift 범위 포함)                                                        | 그대로. 표 상태로 읽기                                                                 | 행 선택 |   1   |
| 16  | cell-spanning                   | 상태 없음 · `spanColumns` · `spanRows`                                                                                                     | `colSpan` 만 (`Cell.binding.ts:77`)                                                 | `spanRows` 의 뜻 = 시각 병합 (열마다 켬)                                               | (파생)  |   6   |
| 17  | cell-selection                  | `CellSelectionRange[]` (`anchor*` · `focus*` · `operation`) · `enableCellSelectionDrag` · `enableMultiCellRangeSelection`                  | 없음                                                                                | 범위 선택 · 여러 범위 · 복사 (D1 예외)                                                 | 칸 선택 |   6   |
| 18  | worker row model (experimental) | 필터 · 묶기 · 정렬을 worker 에서, 행 번호 배열 반환                                                                                        | 없음 (`VIEW_LOCAL_LOAD_CAP` 10,000)                                                 | 조건부                                                                                 | —       |   7   |

TanStack 의 서버 처리 (`manual*`) 는 기능이 아니라 옵션이다. 우리는 조각의 번역을 `serializeViewQueries` 로 보내는 것으로 같은 뜻을 갖는다 (§4.3).

TanStack core 에 있고 17 에 없는 것:

- **머리글 묶음** (중첩 열 · 여러 줄 머리글) — 하지 않는다. RAC `Column` 은 leaf 다 (`Table.mjs:685`).
- **바닥글** — RAC `TableFooter` 로 합계 행을 낸다 (11 번에 포함).
- **계산 열** (`accessorFn`) — 계산 필드 (ADR-291) 가 맡는다.
- **유사 검색 등급** (`match-sorter-utils`) — 2 번에 포함.

## 3. RAC · S2 설치본이 주는 것

`react-aria-components` 1.22.1 · `react-stately` 3.51.0 · `@react-spectrum/s2` 1.8.2. 경로는 `node_modules/.pnpm/…/node_modules/` 아래.

| 능력         | RAC                                                                                    | S2 TableView                           | 근거                                                                           |
| ------------ | -------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| 정렬         | 한 열 (`sortDescriptor` · `onSortChange` · Column `allowsSorting`)                     | 같음 + 열 메뉴                         | `@react-types/shared` `collections.d.ts:90-102`                                |
| 폭 조절      | `ResizableTableContainer` · `ColumnResizer`                                            | Column `allowsResizing`                | `Table.d.ts`                                                                   |
| 열 순서 변경 | 없음 (끌어 놓기는 행만)                                                                | 없음                                   | `Table.mjs` drop delegate                                                      |
| 열 고정      | 공개 prop 없음 · `TableLayout.isStickyColumn` `protected` 훅                           | 내부 전용 (`Cell isSticky` `@private`) | `TableLayout.d.ts:66` · `TableLayout.mjs:78,220,232` · `TableView.tsx:339-340` |
| 열 숨김      | Column 을 빼는 것 — `isRowHeader` 열 1 개 이상 · 칸 수 = 열 수                         | 같음                                   | `Table.mjs:117,145`                                                            |
| 행 선택      | `selectionMode` · `selectionBehavior` · Shift 범위                                     | `selectionStyle`                       | `Table.d.ts`                                                                   |
| 칸 선택      | 없음 (칸 focus 는 있음 — `keyboardNavigationBehavior`)                                 | 없음                                   | `Table.d.ts`                                                                   |
| 칸 병합      | Cell `colSpan` 만 · `rowSpan` 없음 · 머리글 묶음 없음                                  | 같음                                   | `Table.d.ts:501`                                                               |
| 펼침 행      | `treeColumn` · `expandedKeys` · `onExpandedChange` · 중첩 Row · `hasChildItems` (안정) | 같음                                   | `useTableState.d.ts:27,56,60` · `Table.d.ts:356,405`                           |
| 고정 행      | 없음 (머리글만 sticky · `TableFooter` 는 sticky 아님)                                  | 머리글만                               | `TableLayout.mjs:126`                                                          |
| 더 불러오기  | `TableLoadMoreItem`                                                                    | `loadingState` · `onLoadMore`          | `Table.d.ts`                                                                   |
| 열 메뉴      | 없음 (render prop `sort()` · `startResize()` 로 조립)                                  | Column `menuItems`                     | `TableView.tsx:772`                                                            |
| 가상화       | `Virtualizer` + `TableLayout` — 가로 열 가상화 포함, sticky · row header 칸은 늘 유지  | 늘 가상                                | `TableLayout.mjs:78`                                                           |
| 표시 층 필터 | `UNSTABLE_useFilteredTableState` (Autocomplete context)                                | —                                      | `useTableState.d.ts:94`                                                        |

`UNSTABLE_useFilteredTableState` 는 쓰지 않는다 — 불안정 표시이고, 창 밖 행은 collection 에 없어 표시 층 필터가 전체 행을 보지 못한다 (HC3).

## 4. 표 상태 모델

### 4.1 형 (제안)

```ts
/** A Table instance's grid state — closed shape, every slice optional (absent = the authored default). */
interface CatalogTableState {
  // data slices — translated into the view query (§4.3)
  sort?: readonly { column: string; direction: "ascending" | "descending" }[];
  search?: string;
  columnFilters?: readonly { column: string; condition: ViewCondition }[];
  grouping?: readonly string[];
  // column slices — applied at the resolver's column projection (§4.5)
  hiddenColumns?: readonly string[];
  columnOrder?: readonly string[];
  pinnedColumns?: { start: readonly string[]; end: readonly string[] };
  columnWidths?: Readonly<Record<string, number>>;
  // row slices
  expandedKeys?: "all" | readonly string[];
  pinnedRows?: { top: readonly string[]; bottom: readonly string[] };
  selectedKeys?: "all" | readonly string[];
  page?: number;
  // cell slice
  cellRanges?: readonly {
    anchor: { row: string; column: string };
    focus: { row: string; column: string };
  }[];
}
```

- 열은 Column key (`resolveTableColumnKey` 의 결과) 로, 행은 항목 key (`catalogItemKey` — ADR-308 · 313) 로 적는다. 없는 key 는 읽을 때 버린다 (R6).
- 이름은 RAC · S2 것을 우선한다: `sortDescriptor` 의 모양 (`column` · `direction`), `selectedKeys`, `expandedKeys`. TanStack 의 `{start, end}` · `{top, bottom}` 은 논리 방향이라 그대로 쓴다.
- Phase 1 에서 key 기본값을 한 함수로 합친다 — 지금 `resolveTableColumnKey` 는 `col${index}`, 명령은 `column${index+1}` (`commands/collections.ts:906`).

### 4.2 세 층

| 층   | 자리                                                                                                             | 내용                                             | 저장          |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------- |
| 작성 | 문서 — Table · Column 의 prop (§6) 과 보기 (`ViewQuery`)                                                         | 조각의 기본값 · 「최종 사용자가 바꿀 수 있는가」 | 문서          |
| 실행 | 세션 — 표 instance 마다 `CatalogTableState` 하나 (지금의 `tableSorts` Map 자리 — `catalogPreviewSession.ts:565`) | 최종 사용자가 바꾼 값                            | 저장하지 않음 |
| 기억 | 브라우저 저장소 (사용자 결정 1)                                                                                  | 실행 층의 열 조각 · 정렬                         | 그 브라우저   |

- 읽는 값 = 실행 층에 있으면 그것, 없으면 작성 층의 기본값.
- Canvas 는 작성 층만 읽는다 (HC9). Builder 의 Preview 도 기억 층을 쓰지 않는다 (Publish 만 — 디자인 확인이 이전 조작에 물들지 않게).
- 표 상태는 변수로 읽히고 (ADR-294 의 컴포넌트 변수), Do 로 바뀐다 (ADR-287 — `sort` · `search` · `toggleColumn` · `pinColumn` · `expand` …). 정렬 변수가 있는 보기는 지금처럼 변수가 소유한다 (ADR-284 Decision 5).

### 4.3 데이터 조각 → 보기 번역

| 조각            | 번역                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `search`        | 조건 1 개 — `fields` = 「Searchable」 인 열의 필드 (보이는지와 무관 — §4.4), `op` 「포함」, 감도는 표 설정 |
| `columnFilters` | 조건 항목 그대로                                                                                           |
| 합치기          | `{ op: "and", items: [작성된 where, search, ...columnFilters] }`                                           |
| `sort`          | `ViewSort` 목록 (지금은 하나 — `types.ts:856` 형을 넓힌다)                                                 |
| `grouping`      | `groupBy` + 집계. 표 안 묶음은 묶음 행과 그 묶음의 원본 행을 둘 다 쓴다 — 원본 행의 출처는 §4.3.2          |

- 번역은 한 함수다 (제안 `tableStateQuery(state, table, authored)`), 로컬 평가와 서버 직렬화가 같은 결과를 받는다 (HC2).
  - **Phase 2 구현 (2026-11-20)**: `runtime/tableStateQuery.ts` — `catalogTableStateRowSorts` → `catalogRowSortsView` → `catalogTableStateQueries`, 판정은 `catalogTableSliceServable`. 정렬 비교는 `collections/view/sortOrder.ts` `viewSortOrder` 하나 (제안 이름 `fieldCompare` 자리).
- 번역이 읽는 것은 데이터 조각뿐이다. 열 조각 (숨김 · 순서 · 고정 · 폭) 은 번역 함수의 입력 형에 없다 — 열을 바꿔도 조건 · 요청 · 결과가 그대로다 (HC4 의 행 source 호출 0 이 성립하는 이유).
- 계산 필드를 읽는 조각은 ADR-291 의 판정을 그대로 지난다 — 보기 전체가 로컬.
- 정렬 비교 (제안 `fieldCompare(field)`): 필드 타입으로 날짜 · 숫자 · 불리언 · 글자를 가르고 빈 값은 방향과 무관하게 뒤 (`sortUndefined: 'last'` 의 뜻, 열마다 바꿀 수 있음). 값은 비교 전에 한 번 키로 바꾼다 — TanStack 처럼 비교마다 소문자 변환하지 않는다 (본문 F12). 지금의 순서 캐시 (`sortedRowOrder`, `dataBinding.ts:473`) 의 키를 정렬 목록 전체로 넓힌다.

#### 4.3.1 실행 자리 — 로컬 · 서버

표의 데이터 조각이 도는 자리는 둘 중 하나다. 판정은 지금 세션의 것 그대로다 (`query.served` — `dataBinding.ts:225`).

- **로컬 실행**: 원본 행이 전부 있다 — 로컬 collection, 한 번에 다 주는 endpoint, 또는 전량 로드 (`load: "all"`, 상한 `VIEW_LOCAL_LOAD_CAP` 10,000 — ADR-291 사용자 결정 3, `serialize.ts:49`). 조각은 전부 평가기에서 돈다.
- **서버 실행**: endpoint 가 쪽 · cursor 로 나눠 주고 보기가 요청에 실린다. 세션은 받은 행을 다시 거르거나 정렬하지 않는다.

서버 실행 표의 규칙은 하나다: **요청이 조각 전체를 담을 때만 그 조각을 실행한다. 일부만 보내고 나머지를 받은 쪽에서 메우지 않는다.** 쪽을 자르는 것은 서버라서 덜 보낸 정렬 · 조건은 받은 쪽에서 복구할 수 없다 (리뷰 round 1 H1 — 쪽 크기 2, `team` 오름 + `score` 내림에서 첫 정렬만 보내면 `[s1, s2]` 를 받고, 정답 `[s3, s2]` 의 s3 는 응답에 없다).

| 조각           | `body` 형식                                                                                              | `suffix` 형식                                                      | 담지 못할 때                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 검색           | `where` 에 합침                                                                                          | endpoint 가 검색 파라미터 이름을 설정했을 때                       | 조각을 받지 않는다                                                                                       |
| 열 필터        | `where` 에 합침                                                                                          | suffix 표에 있는 연산자 · 「그리고」 만                            | 그 조건을 받지 않는다                                                                                    |
| 정렬 여러 열   | `sort` 배열                                                                                              | endpoint 가 「여러 정렬」 (쉼표 목록) 을 설정했을 때, 아니면 한 열 | 둘째 정렬을 받지 않는다 — 상태는 한 열 그대로                                                            |
| 묶기 · 합계 행 | endpoint 가 「묶음의 행 조회」 를 선언했을 때 묶음 조회 + 자식 조회 (§4.3.2). 펼침을 끈 표는 묶음 조회만 | 담지 못한다                                                        | 전량 로드 → 로컬 실행. 상한을 넘으면 거절 (행 없음 + 안내 — 지금의 `GROUP` 규칙, `serialize.ts:431-434`) |
| 계층 데이터    | —                                                                                                        | —                                                                  | 전량 로드 → 로컬 실행 (원본 전체를 부모 key 로 색인해야 한다). 상한을 넘으면 거절                        |
| 행 고정        | endpoint 가 「key 로 행 조회」 를 선언했을 때 고정 조회 (§5.4)                                           | endpoint 가 key 파라미터 이름을 설정했을 때                        | 조각을 받지 않는다                                                                                       |
| 후보 값        | endpoint 가 주면 그 값                                                                                   | 같음                                                               | 불러온 행에서 내고 「불러온 N 행 기준」 표시 (§5.2)                                                      |

- 「받지 않는다」 = 상태에 들어가지 않는다. 조작 자리 (Shift 클릭 · 열 메뉴 항목 · 검색 칸) 가 나오지 않거나 한 열 정렬로 동작하고, Do 는 report 로 거절하며 (조용한 no-op 금지 — data-interaction §6), 작성 화면은 그 스위치를 사유와 함께 막는다 (§6). 기억 층에서 읽은 값도 같은 검사를 지난다.
- 판정은 둘 다 맞아야 한다: 번역 결과를 `serializeViewQueries` 에 넣어 표 상태가 더한 조각에서 경고가 없고, 그 조각이 쓰는 요청 종류 (여러 정렬 · 검색 파라미터 · 묶음의 행 조회 · key 로 행 조회) 를 endpoint 가 선언했다. 경고 검사만으로는 모자란다 — 모양은 실리지만 뜻이 다른 요청이 있다 (§4.3.3). 판정 함수 하나를 세션 · 패널 · Do 가 같이 읽는다 (제안 `tableSliceServable(table, slice)`).
- 작성된 보기의 기존 규칙은 그대로다 — 건너뛴 조건을 `unsent` 로 보고하는 것 (ADR-284 Phase 2), 계산 필드 보기의 로컬 전환 (`COMPUTED`). 이 절은 표 상태가 더하는 조각의 규칙이다.
- 전량 로드로 내리는 것은 작성자가 켠 묶기 · 계층뿐이다. 최종 사용자의 한 번 조작 (정렬 추가 · 검색) 이 10,000 행 로드를 일으키지 않는다.

#### 4.3.2 표 안 묶음의 행 출처

묶음 행 (묶은 값 · 개수 · 집계) 과 그 아래 원본 행은 출처가 다르다. 집계 결과에는 원본 행의 key · 값이 없어서 (`evaluate.ts:537` 의 결과 행은 묶은 필드와 집계 필드뿐 — ADR-291 Decision 5), 집계 응답만으로는 펼칠 수 없다 (리뷰 round 1 H3 — `[a1(A,10), a2(A,20)]` 와 `[b1(A,5), b2(A,25)]` 가 같은 `{team: A, count: 2, total: 30}` 을 낸다).

- **로컬 실행**: 평가기가 묶음마다 원본 행 번호 목록을 같이 낸다. 지금도 묶음별 `rows` 를 갖고 있다가 결과를 만들 때 버린다 (`evaluate.ts:525-537`). 펼침 = 그 행 번호.
- **서버 실행 (`body`)**: 요청 종류가 둘이고 응답 모드는 요청마다 하나다 — 집계와 원시 행을 한 응답에 섞지 않는다 (ADR-291 Decision 5 유지).
  - **묶음 조회**: 지금의 `body.group` 요청 (`serialize.ts:388`). 묶음 행의 출처이고 `count` 집계를 늘 포함한다 (자식 수 · 펼침 표시 여부). 쪽은 묶음 행으로 센다.
  - **자식 조회**: 펼친 묶음마다 원시 행 요청 하나. `where` · 정렬은 표의 것, 쪽은 endpoint 의 쪽 크기이고, 어느 묶음인지는 `where` 의 조건이 아니라 요청의 `groupOf` 항목으로 싣는다 (§4.3.3). 원시 행 요청에 항목 하나가 더해진 것이고, 서버가 구현해야 하는 새 계약이다. 조회 단위는 (표, 묶음 key 경로) 이고 ADR-310 Phase 7 의 조회 단위 기구 (`pageUnits`) 를 쓴다 — 응답이 collection 의 불러온 항목이나 다른 묶음의 행을 바꾸지 않는다. 묶음 안에 행이 더 있으면 그 묶음 끝의 sentinel 이 다음 쪽을 부른다.
  - **여러 단계 묶기**: 펼친 묶음의 자식이 다음 단계 묶음이면 자식 조회가 묶음 조회다 (`by` = 다음 필드, 위 단계 묶음은 `groupOf`). 단계를 로컬에서 접어 합치지 않으므로 mean · median 도 서버 값 그대로다.
  - **합계 행**: `by` 없는 묶음 조회 하나.
  - 「모두 펼침」 은 보이는 묶음만 조회한다 (창 · 쪽 안).
  - 데이터 조각이 바뀌면 묶음 조회 · 자식 조회를 전부 버리고 묶음 조회부터 다시 한다. 펼침 상태 (`expandedKeys`) 는 남고, 다시 보이는 펼친 묶음이 자식 조회를 부른다.
- **서버 실행 (묶음을 담지 못하는 형식 · 「묶음의 행 조회」 를 선언하지 않은 endpoint)**: §4.3.1 표대로 전량 로드 뒤 로컬 실행.
- 작성자가 「묶음 펼침」 을 끄면 자식 조회가 없다 — 묶음 행은 펼침 표시 없는 합계 행이다.

#### 4.3.3 식별 요청 — 묶음의 행 · key 의 행

「이 묶음에 든 행」 과 「이 key 의 행」 은 값 비교가 아니라 식별이다. 필터 조건으로 적으면 다른 행이 섞인다 (리뷰 round 2 h4):

- 묶음 나누기는 값이 정확히 같을 때만 한 묶음이다 (`groupKeyOf` — `evaluate.ts:465`, JSON 값 일치). `"A"` 와 `"a"`, `null` 과 `""` 는 다른 묶음이다.
- 필터 비교는 그렇지 않다. 글자 `equals` · `oneOf` 는 기본 감도 `base` 의 collator 라 `"A"` 와 `"a"` 가 같고 (`comparison.ts:414,434`), `notExists` 는 `null` 과 `""` 를 같이 잡는다 (`comparison.ts:82`). 감도를 바꿔도 빈 값 쪽은 남는다.
- 그래서 `equals "A"` 자식 조회는 `A` · `a` 두 묶음의 행을 다 받고, `oneOf ["A"]` 고정 조회는 key `a` 의 행까지 고정한다.

식별은 `where` 밖의 요청 항목으로 싣는다. 필터 어휘 (ADR-284) 는 바꾸지 않는다.

| 요청 항목 (`body`, 제안)                       | 뜻                                                     | 쓰는 곳                    |
| ---------------------------------------------- | ------------------------------------------------------ | -------------------------- |
| `groupOf: { by: string[], values: unknown[] }` | `by` 로 묶었을 때 `values` 묶음에 드는 행만            | 자식 조회 · 하위 묶음 조회 |
| `keys: { field, only: unknown[] }`             | key 필드 값이 목록 중 하나와 정확히 같은 행만          | 고정 조회                  |
| `keys: { field, except: unknown[] }`           | key 필드 값이 목록의 어느 것과도 정확히 같지 않은 행만 | 고정 행을 뺀 본문 조회     |

- **값은 받은 그대로 돌려보낸다.** `groupOf.values` 는 묶음 조회가 낸 묶음 값 (JSON 값 — `null` 과 `""` 를 구별해 싣는다), `keys` 는 고정할 때 그 행의 key 필드 원래 값이다 (글자로 바꾼 항목 key 가 아니다 — 숫자 5 와 글자 `"5"` 가 갈린다). 필드의 값 표현 선언 (ADR-313 `outgoingFieldValue`) 은 그대로 지난다.
- **동등성은 서버의 묶기를 따른다.** 서버 계약은 「`groupOf` 의 판정 = 그 서버가 같은 `by` 로 묶을 때의 판정」 이다. 묶기를 서버가 했으므로 (예: 빈 글자를 `NULL` 로 다루는 DB 는 묶음도 하나로 낸다) 우리가 동등성을 따로 정하지 않는다. `keys` 는 정확 일치다 — 항목 key 는 식별자다.
- **선언해야 쓴다.** 모르는 항목을 무시하는 서버는 모든 행을 돌려준다. endpoint 설정에 「묶음의 행 조회」 · 「key 로 행 조회」 지원을 선언한 endpoint 에만 보낸다 (§4.3.1 판정). `suffix` 형식은 key 파라미터 이름 (포함 · 제외) 을 설정했을 때 `keys` 만 쓸 수 있다.
- **어긋나면 드러낸다.** 자식 조회의 `total` 이 그 묶음 행의 `count` 와 다르면 묶음 조회를 한 번 다시 하고, 그래도 다르면 그 묶음에 「서버 응답이 묶음과 맞지 않음」 을 표시한다 (조용한 통과 금지). 고정 조회가 고정 key 수보다 많은 행을 주면 같다.
- **로컬 실행에는 이 항목이 없다.** 묶음의 행은 평가기가 낸 행 번호이고 고정 행은 항목 key 로 찾은 행 번호다 — 묶기와 같은 함수에서 나오므로 어긋날 수 없다.

### 4.4 조각 사이 규칙 (한 곳)

- 검색 · 열 필터 · 정렬 · 묶기가 바뀌면 `page` 는 1 (지금 정렬이 하는 것 — `sortTable`).
- 검색 대상은 열의 「Searchable」 로만 정한다 — 숨긴 열도 검색된다. TanStack 과 같다: `column_getCanGlobalFilter` 는 `enableGlobalFilter` 와 값 타입만 읽고 가시성을 읽지 않는다 (`globalFilteringFeature.utils.ts:20-31` · `globalFilteringFeature.ts:30`). 가시성에 묶으면 열 숨김이 조건을 바꿔 서버 재조회가 필요해진다 (리뷰 round 1 H2 — 검색어 `needle`, 쪽 크기 2 의 `[r1, r2]` 에서 `note` 열을 숨기면 정답은 `[r3]` 인데 받은 두 행으로는 만들 수 없다).
- 숨긴 열에 걸린 열 필터 · 정렬도 그대로 남는다. 열 선택 메뉴가 그 열에 필터 · 정렬 표시를 낸다 — 보이지 않는 조건으로 행이 빠진 것을 사용자가 알 수 있게.
- 묶은 열의 정렬이 정렬 목록 앞에 선다.
- 고정 열은 순서의 앞 · 뒤 묶음이고 `columnOrder` 는 가운데 묶음 안의 순서다 (TanStack `getIndex('start' | 'center' | 'end')` 의 뜻).
- 필터로 빠진 행의 선택 · 펼침 · 고정은 값을 지우지 않고 보이지 않을 뿐이다. 「전체 선택」 의 범위는 지금 조건의 결과다 (ADR-284 Decision 3 의 `'all'` 규칙).
- 고정 행은 필터와 무관하게 남길지 (`keepPinnedRows`) — 기본은 남기지 않는다.

### 4.5 적용 자리

| 조각                               | 자리                                                                                                        | 다시 계산하는 것                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 데이터 (검색 · 필터 · 정렬 · 묶기) | 데이터 층 — `catalogBoundRows` 의 보기 실행 · 행 번호 정렬 (`dataBinding.ts:180,473`) → 창으로 자르기       | 행 번호 배열 · 창 안 record                                                                         |
| 열 (숨김 · 순서 · 고정 · 폭)       | resolver 의 열 투영 — 머리글 Column · 템플릿 Row 의 Cell · 트랙 목록 (`tableTracks.ts`) 을 같은 열 목록으로 | 열 목록 · 트랙 · 창 안 record 의 칸. 행 source 호출 0 (HC4) — 열 조각은 번역의 입력이 아니다 (§4.3) |
| 행 (펼침 · 고정)                   | 데이터 층에서 행 번호 묶음을 가른 뒤 창 계산                                                                | 행 번호 배열                                                                                        |
| 칸 (병합)                          | 창 안 record 를 만들 때 이웃 행의 값 비교                                                                   | 창 안 record                                                                                        |
| 칸 (선택)                          | DOM 층 — 문서 · resolver 를 지나지 않는다                                                                   | 칸의 속성 · 칠                                                                                      |

행 창의 chunk key (`windowRowChunkNames`) 는 행 key 에서만 나온다 — 열 조각이 바뀌어도 chunk 가 다시 mount 되지 않아야 한다 (G1 카운트).

## 5. 기능별 설계

### 5.1 정렬 (Phase 2)

- Shift (또는 열 메뉴 「정렬에 추가」) 로 열을 더한다. RAC 에는 첫 정렬만 `sortDescriptor` 로 넘기고 나머지 열은 우리 표시 (순번 + 방향) 다. `aria-sort` 는 첫 열에만 붙는다 (APG — 한 번에 한 머리글).
- Shift 판정: RAC `onSortChange` 는 열만 준다 (`domBinding.runtime.ts:3519-3530`). 표 컨테이너의 pointerdown · keydown capture 에서 수정 키를 기억했다가 `onSortChange` 에서 읽는다 — DOM 을 바꾸지 않는다. Phase 0 시제품 S4.
  - **S4 결과 (go)**: RAC 는 Shift + 클릭 · Shift + Enter 에도 `onSortChange` 를 부른다. RAC 가 아는 것은 첫 정렬 열뿐이라 둘째 이후 열은 누를 때마다 `ascending` 을 준다 — 방향 뒤집기는 우리 상태가 한다. 순번 표시가 바뀌려면 `TableHeader` 의 `dependencies` 에 정렬 목록이 있어야 한다 (RAC 는 항목 렌더를 캐시한다).
- 옵션 (Table · Column prop, §6): 여러 열 정렬 허용 · 최대 열 수 · 첫 방향 · 빈 값 위치 · 정렬 해제 허용.
- 서버 실행 표: 요청이 정렬 목록 전체를 담을 때만 여러 열 정렬이다 (§4.3.1). 담지 못하면 Shift 클릭 · 「정렬에 추가」 가 없고 클릭은 한 열 정렬로 바꾼다 — 첫 정렬만 보내고 여러 열 정렬 표시를 남기는 상태는 없다.
- 작성한 Row (바운드 아님) 의 정렬은 지금처럼 칸의 글자로 한다 (ADR-257 사용자 결정 4).

### 5.2 검색 · 열 필터 · 후보 값 (Phase 3)

- **검색**: Table 「검색」 스위치를 켜면 SearchField 가 표 위에 연결된 채 들어간다 (지금 「검색 · 필터」 구획의 방식). 값은 표 상태 `search` 다. 검색 대상은 「Searchable」 인 열이고 열을 숨겨도 바뀌지 않는다 (§4.4).
- **이어 치기**: 검색어가 이전 검색어를 포함하면 이전 결과 행 번호에서만 다시 거른다 (TanStack 에 없는 것 — 본문 F12).
- **유사 검색** (사용자 결정 2): 일치 등급 (같음 · 앞 일치 · 낱말 앞 일치 · 포함 · 약어 · 흩어진 일치) 을 거를 때 저장하고, 정렬이 없으면 등급 순으로 낸다. 한글은 `Intl.Collator` 가 자모로 읽는다 — 빠른 길은 collator 에서 probe 하고 무작위 대조로 검증한다 (메모리 `reference-intl-collator-search-hangul-letters`, 2026-11-20 「포함」 작업과 같은 절차).
- **열 필터**: 열 메뉴 「필터」 가 그 열 타입의 연산자 (`VIEW_COMPARISONS_BY_KIND`) 로 조건 하나를 만든다. 작성자가 둔 필터 컨트롤 (페이지 변수) 과는 「그리고」 로 합친다.
- **후보 값**: `facetOf(table, column)` — 그 열의 `columnFilters` 항목만 뺀 번역으로 평가한 결과에서 고유 값 → 개수 Map 과 최소 · 최대. 고유 값은 그 후보를 고르면 걸리는 조건의 비교로 접는다 (글자는 표의 감도 — 기본 `base` 에서 `"A"` 와 `"a"` 는 한 후보, 빈 값은 「비어 있음」 한 후보) — 후보의 개수와 그 후보로 거른 행 수가 같아야 한다. 캐시 키는 (행 배열, 그 열을 뺀 조건). 항목 source 의 새 종류로 바인딩에 연결한다 (Select · CheckboxGroup · TagGroup 의 항목, Slider · RangeSlider 의 범위). 서버 표는 endpoint 가 후보 값을 주지 않으면 불러온 행에서만 내고 「불러온 N 행 기준」 을 표시한다 (ADR-284 Decision 3 의 미확인 규칙).

### 5.3 열 (Phase 4)

- **투영**: 열 목록 = 작성된 Column 중 (`enabled` 이고 숨기지 않은 것) 을 [고정 앞 · 가운데 (`columnOrder`) · 고정 뒤] 로. 템플릿 Row 의 Cell 과 작성한 Row 의 Cell 도 같은 순서로 낸다 — 지금 작성 때의 이동이 쓰는 대응 (`tableColumnOrder` · `tableHidingTargets`) 을 읽기 전용으로 쓴다.
- **불변식**: row header 열은 숨기지 못한다 (마지막 하나). colSpan 이 덮는 열들은 숨김 · 이동 · 고정에서 한 덩어리다 (ADR-257 본문 :21 의 거부 규칙을 실행 중에도).
- **고정**: 가상 표는 `CatalogTableLayout` 이 `isStickyColumn` 을 덮어 고정 열을 알린다 (`catalogVirtualizer.components.tsx:132`). 비가상 표는 칸에 CSS `position: sticky` + `inset-inline-start` / `end` (누적 폭은 트랙 목록에서). 경계선 · 그림자는 rule (D3). Canvas 는 ADR-267 의 sticky 로 기본 고정을 그린다. Phase 0 시제품 S1.
  - **S1 결과 (go — 가상 · 비가상, Chrome · WebKit)**: 비가상은 CSS sticky 만으로 된다. 가상 표는 넷이 필요하다 (RAC 는 sticky 를 칸을 감싸는 `role=presentation` 요소에 주고 `left` · `top` 만 낸다 — `VirtualizerItem.mjs:54-66`):
    1. `isStickyColumn` 덮기. 칸 node 의 열은 `collection.columns[node.colIndex ?? node.index]` 다.
    2. 머리글 · body 의 layoutInfo 에 `allowOverflow` (`buildTableHeader` · `buildRowGroup` 덮기). RAC 는 둘을 `overflow: hidden` 으로 그려, 그 안의 sticky 가 표의 스크롤 영역이 아니라 그 상자에 붙는다.
    3. 끝 고정은 감싸개에 CSS `right` (`:has(> [data-…])` 선택자) 를 주고, 행을 flex 로 둔 뒤 `::before` 채움을 가운데에 넣는다. sticky 는 제자리에서만 당겨지므로 제자리가 행의 끝이어야 하는데, margin 으로 밀면 margin 상자만큼만 움직여 붙지 않는다 (실측).
    4. 끝 고정 열의 칸은 가로로 보이는 영역 밖이면 RAC 가 만들지 않는다 (`buildRow` 가 `requestedRect.maxX` 에서 멈춘다). 행을 만드는 동안 `requestedRect` (`protected`) 의 폭을 넓힌다 — 그리는 칸은 여전히 보이는 칸 + 고정 칸이다 (열 30 중 행의 칸 10 ~ 14).
- **열 메뉴**: S2 `ColumnWithMenu` 자리 (`domBinding.runtime.ts:5390`) 에 항목을 더한다 — 정렬 · 정렬에 추가 · 필터 · 숨기기 · 앞 / 뒤에 고정 · 고정 해제 · 왼쪽 / 오른쪽으로 · 크기 조절. 허용하지 않은 조작의 항목은 내지 않는다.
- **열 선택 메뉴**: Table 「열 숨김 허용」 을 켜면 표 위에 연결된 메뉴 (열 이름 checkbox 목록) 가 들어간다.
- **끌기** (사용자 결정 3): 머리글 안의 우리 손잡이 요소에 react-aria `useDrag` · `useDrop`. RAC Column 의 DOM 은 그대로. Phase 0 시제품 S5.
  - **S5 결과 (go — 열 메뉴 항목 · 끌기 둘 다)**: 포인터 끌기와 키보드 끌기 (손잡이에서 Enter → Tab → Enter, react-aria 의 것) 가 Chrome · WebKit 에서 된다. 손잡이는 pointerdown · mousedown · click 을 Column 으로 올리지 않는다 — RAC Column 의 press 가 mousedown 의 기본 동작을 막아 native drag 가 시작되지 않는다. 끌기는 정렬을 일으키지 않는다. WebKit 은 키보드로 놓은 직후 첫 포인터 클릭 하나가 먹지 않는다 (Phase 4 에서 다시 본다).
  - 열 목록이 바뀌는 commit 에서 머리글과 모든 행의 칸이 같이 바뀌어야 한다. 어긋나면 RAC 가 `Cell count must match column count` 를 던진다 (시제품에서 재현 — 본문 F7 의 불변식).
- **폭**: RAC 폭 상태 (`TableColumnResizeStateContext`) 의 끝난 폭을 `columnWidths` 로 올린다 (기억 대상).

### 5.4 행 (Phase 5)

- **펼침 행** — RAC 의 중첩 Row · `treeColumn` · `expandedKeys` (controlled). 세 용도가 같은 기구다:
  - 묶음 행: `grouping` 이 있으면 묶음마다 부모 Row (묶은 값 + 개수 + 집계 칸), 자식 = 그 묶음의 원본 행. 원본 행의 출처는 실행 자리에 따라 다르다 (§4.3.2 — 로컬은 행 번호, 서버는 자식 조회).
  - 계층 데이터: collection 의 부모 필드 (또는 자식 배열 필드) 를 표가 선언하면 행이 부모 · 자식이 된다. 부모 필드 방식은 원본 전체를 색인해야 해서 서버 실행 표에서는 전량 로드 규칙을 따른다 (§4.3.1). 행마다 자식을 조회하는 방식은 택하지 않는다 — 자식 유무를 미리 알 수 없어 모든 행에 펼침 표시가 붙는다.
  - 상세 행: 템플릿 Row 아래에 작성한 「상세」 Row (칸 하나, 열 전체 `colSpan`) 를 자식으로 낸다.
- **행 창과 펼침**: 창은 「보이는 평평한 순서」 위에서 계산한다 — 데이터 층이 펼친 상태로 평탄화한 행 번호 + 깊이 배열을 내고 (TanStack expanded row model 의 뜻), 창 안의 것만 중첩 Row 로 만든다. `catalogWindowRowChunks` 가 평평한 행을 가정하므로 (`domBinding.runtime.ts`) chunk 경계가 부모 · 자식을 가르는 경우가 Phase 0 시제품 S2 의 대상이다.
  - **S2 결과 (go)**: 중첩 Row + 창 밖 행은 칸 없는 Row + 64 행 chunk (묶음의 자식도 부모 Row 안에서 chunk) 로 1,000 묶음 × 10 · 5 × 2,000 · 100 × 100 에서 스크롤 높이 · 순서 · 단계 (`aria-level`) 가 손계산과 같다 — 빈 행 0, DOM 행 19, 모두 펼침 110 ~ 143 ms. RAC 는 중첩 Row 를 body 아래 평평한 DOM 행으로 그린다 (`role=treegrid` · `aria-level` · `aria-posinset` · `aria-setsize`).
  - **접힌 묶음도 자식 Row 가 collection 에 있어야 한다.** react-aria `useTableRow` 는 그 행의 마지막 자식이 칸이 아닐 때만 `aria-expanded` 를 붙이고 → 키로 펼친다 (`useTableRow.mjs:62,88`). RAC Row 의 `hasChildItems` 만 주면 접힌 행에 `aria-expanded` 가 없고 키보드로 펼칠 수 없다 (실측). 로컬 실행은 자식 Row 를 늘 두고 (칸 없는 Row — 지금의 창 밖 행과 같은 비용), 서버 실행은 접힌 묶음에 칸 없는 자식 Row 하나를 둔다 (펼치면 자식 조회).
  - 칸 없는 Row 는 layout 이 행 높이를 줘야 한다 (`CatalogTableLayout.buildRow` 가 지금 하는 것) — 없으면 높이 0 인 행이 전부 「보이는 행」 이 되어 가상화가 풀린다 (시제품에서 재현: DOM 행 10,962).
- **쪽과 펼침**: 쪽은 최상위 행으로 센다 (`paginateExpandedRows: false` 의 뜻) — 펼쳐도 쪽이 넘어가지 않는다.
- **집계**: 지금 5 종 + 사용자 결정 4. 바닥 합계 행은 `TableFooter` 의 Row 로 낸다 (선택 불가). 로컬 실행에서 묶음 행의 집계는 읽을 때 계산하고 하위 묶음 결과를 합친다 (count · sum · min · max 는 합칠 수 있고 mean · median 은 원본에서). 서버 실행에서는 단계마다 서버가 낸 값이다 (§4.3.2).
- **행 고정**: 데이터 층이 [위 고정 · 나머지 · 아래 고정] 으로 가른다. 위 고정은 머리글 아래 sticky, 아래 고정은 바닥 sticky. 가상 표에서의 방법 (layout 의 sticky 행 정보 · 별도 body 불가) 이 Phase 0 시제품 S3 다 — **S3 결과 (go, 가상 · 비가상)**: 고정 행은 보이는 영역 밖이어도 layout 이 만들고 (`buildRowGroup` 뒤에 `buildChild` 로 더한다) `getVisibleLayoutInfos` 가 그 행과 칸을 늘 돌려준다. 행 layoutInfo 에 `isSticky` + body `allowOverflow`, 아래 고정은 CSS `bottom` + body 를 flex column 으로 두고 `::before` 채움 (S1 의 끝 고정과 같은 이유). DOM 순서는 [위 고정 · 나머지 · 아래 고정] 그대로이고 DOM 행 수는 16 이다 (2,000 행). 조작은 행 메뉴 · Do. 서버 실행 표에서는 고정 행이 지금 쪽에 없을 수 있어 조회가 둘이다 — 고정 조회 (표의 `where` + 요청 항목 `keys.only` — `keepPinnedRows` 를 켜면 표의 `where` 없이) 가 고정 행의 출처이고, 본문 조회에는 `keys.except` 를 실어 쪽 크기를 지킨다. key 는 필터 조건 (`oneOf` · `notEquals`) 으로 적지 않는다 — 대소문자만 다른 key 가 같이 잡힌다 (§4.3.3). endpoint 가 「key 로 행 조회」 를 선언하지 않았으면 행 고정을 받지 않는다 (§4.3.1).

### 5.5 칸 병합 (Phase 6)

- Column 「같은 값 합치기」 를 켠 열에서, 보이는 순서로 이어지는 같은 값의 칸을 한 칸처럼 그린다: 첫 칸만 값을 보이고 이어지는 칸은 값과 위 경계선을 그리지 않는다. DOM 은 행마다 Cell 그대로 (값은 `textValue` · 화면 낭독기에 남는다).
- 정렬 · 필터가 바뀌면 병합도 바뀐다 (보이는 순서 기준 — TanStack `spanRows` 와 같음).
- 가상 표: 병합의 첫 행이 창 밖이면 창 안 첫 행이 값을 보인다 (스크롤해도 값이 보이게).
- 실제 `rowSpan` 은 하지 않는다 (본문 Decision 10).

### 5.6 칸 범위 선택 — D1 예외의 범위 (Phase 6)

사용자 답 (2026-11-20) 으로 허용된 예외는 아래로 닫는다. 구현이 이 목록을 넘으면 규칙 위반이다. 종결 때 `.claude/rules/ssot-hierarchy.md` §1 D1 에 같은 목록을 적는다.

- **대상**: 사용자 컴포넌트 Table 의 body 칸. 머리글 · 다른 컴포넌트는 아니다.
- **직접 다루는 것**:
  - 칸 요소의 `aria-selected`, grid 의 `aria-multiselectable` (APG grid 패턴).
  - 키: Shift + 화살표 (범위 확장) · Ctrl / Cmd + A (전체) · Ctrl / Cmd + C (복사 — 탭 구분 글자) · Esc (해제).
  - 포인터: 끌어 범위 · Shift 클릭 확장 · Ctrl / Cmd 클릭 범위 추가.
- **그대로 두는 것**: 칸 focus 이동 (RAC `keyboardNavigationBehavior`) · 행 · 칸의 DOM · 정렬 · 폭 조절.
- **행 선택과의 관계**: 한 표에서 하나만 (사용자 결정 5) — `aria-selected` 와 Shift 의 뜻이 겹친다.
- **가상 표**: 범위는 (행 key, 열 key) 쌍 둘로 적고 창 밖 칸은 계산으로만 안다. 복사는 데이터 층에서 범위의 값을 읽는다.
- **시제품 S6** (Phase 0): 속성을 붙이는 방법 (RAC Cell 은 임의 ARIA prop 을 걸러낼 수 있다 — 칸 요소 ref 로 붙이는지, 칸 안 우리 요소가 맡는지), VoiceOver 가 선택 변화를 읽는지, RAC 의 Shift + 화살표 처리와 겹치지 않는지. 셋 중 하나라도 풀리지 않으면 no-go.
- **S6 결과 (조건부 go — VoiceOver 청취는 G6)**:
  - 속성은 RAC 의 공개 `render` prop 으로 붙는다 — Cell `render` 가 `aria-selected` 를, Table `render` 가 `aria-multiselectable` 을 더한다 (ref · 감싸는 요소 없이).
  - Chrome 접근성 트리에 선택 칸이 `selected`, grid 가 `multiselectable` 로 나온다 (CDP `Accessibility.getFullAXTree`).
  - `selectionMode: none` 인 표에서 RAC 의 Shift + 화살표는 칸 focus 만 옮긴다 — 겹치지 않는다. focus 가 옮겨 간 칸으로 범위를 늘린다.
  - 가상 표: 창 밖까지의 범위 (r2 → r1500) 에서 그려진 칸의 `aria-selected` 가 범위와 일치하고 복사는 1,499 줄이다.
  - VoiceOver 가 선택 변화를 읽는지는 자동으로 확인할 수단이 없다 — G6 에서 사용자와 듣는다. 거기서 실패하면 본문 G6 의 대안 (칸 선택을 빼고 병합만) 이다.

### 5.7 Worker (Phase 7, 조건부)

- 조건: G0 · G3 의 10 만 행 측정에서 검색 입력 → 반영 p95 가 화면 스레드 **계산** (이어 치기 포함) 때문에 HC4 의 검색 입력 상한을 넘는다 (상한은 2026-11-20 사용자 결정으로 100 ms 에서 정렬 클릭 기준선으로). Phase 3 실측: 10,000 행에서 입력 지연을 정하는 것은 계산 (키당 3 ~ 6 ms) 이 아니라 RAC collection 재구성이다 — Worker 가 줄이는 몫은 계산뿐이므로 판정은 계산 시간으로 한다.
- 구현하면: 표마다 Worker 하나 · 행은 한 번 보내고 (구조 복제), 조각이 바뀔 때 번역된 보기만 보낸다. 답은 행 번호 `Uint32Array` (transfer) 다. 평가기는 같은 모듈 (`collections/view`) 을 Worker 에서 import — 두 번째 구현이 아니다 (HC2). 계산 필드 · 참조 필드는 Worker 에서도 같은 캐시 규칙.
- Builder Canvas 에는 싣지 않는다 (ADR-291 확인 항목 2).
- 로컬 조회 상한은 사용자 결정 7.

## 6. 작성 화면 (제안)

Property 탭 Collection 구획 아래 「Grid」 묶음 — 기능 단위로 접힌다. 이름은 영어 라벨 (번역 키) 이다.

| 묶음    | Table                                                                     | Column                                                                                                 |
| ------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Sorting | Multi-column sort · Max sort columns · Allow unsorted                     | Allow Sorting (있음) · First direction · Empty values                                                  |
| Search  | Search (켜면 SearchField 삽입) · Match (Contains · Fuzzy)                 | Searchable                                                                                             |
| Filter  | Column filters in menu                                                    | Filterable                                                                                             |
| Columns | Column visibility menu · Reorder columns · Remember state (사용자 결정 1) | Hidden by default · Allow hiding · Pinned (None · Start · End) · Allow pinning · Allow Resizing (있음) |
| Rows    | Group by · Totals row · Child rows (계층 필드) · Detail row · Row pinning | Aggregate (묶음 · 합계 행의 이 열 값)                                                                  |
| Cells   | Cell selection                                                            | Merge repeated values                                                                                  |

- **Phase 2 의 prop 이름 (2026-11-20)**: Table `allowsMultiSort` · `maxSortColumns` · `allowsUnsorted`, Column `sortFirstDirection` (`ascending` · `descending`) · `sortEmptyValues` (`last` · `first`). endpoint 조회 형식 `multiSort` (「여러 정렬 받기」).
- 새 prop 은 전부 composition 확장이다 (`d2Provenance.ts` — 출처 `composition`, S2 가 선언한 `treeColumn` · `expandedKeys` 는 S2). D2 게이트 (`d2S2Alignment.static.test.ts`) 가 대조한다.
- 기본값은 전부 꺼짐 — 지금의 Table 과 같은 화면이다.
- 서버 실행 표에서 endpoint 형식이 담지 못하는 조각의 스위치는 막고 사유를 적는다 (「이 endpoint 는 여러 정렬을 받지 않습니다」 — §4.3.1). 묶기 · 계층은 막지 않고 「전체 행을 불러와 계산 (최대 10,000 행)」 을 알린다.
- 개발자용 속성을 패널에 내지 않는다 (메모리 `project-panel-props-no-developer-attributes`).

## 7. 검증

### 7.1 측정 설계 (`.claude/rules/measurement-validity.md` §1)

| 질문           | 답                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1 출처        | 부하용 생성 collection (`datagrid-table-vs-tanstack-live.mjs`) — 규모 전용. 값 분포를 근거로 쓰지 않고, 분포에 민감한 기능 (후보 값 · 병합 · 묶기) 은 「값이 모두 다름」 과 「값 종류 5」 두 극단으로 잰다 |
| Q2 불리한 경우 | 값이 모두 다른 글자 열 정렬 · 열 30 개 가로 스크롤 중 고정 · 펼친 묶음 1,000 개 · 검색어 한 글자 (결과가 거의 전부) · 원격 collection · CPU 4x                                                             |
| Q3 대조군      | 같은 문서에서 조각 기능을 끈 arm 과 켠 arm 교대 3 쌍, 총 시간 (클릭 → 화면 반영) 비교. 호출 수는 방향 확인용                                                                                               |
| Q4 소비 경로   | 조각마다 「패널 스위치 → 문서 prop → resolver · 세션 → RAC prop · DOM」 을 live 로 한 번 지난다                                                                                                            |
| Q5 기준값      | 행 순서 · 후보 값 · 집계는 손계산 fixture, 위치는 실제 브라우저 `getBoundingClientRect`, 접근성은 VoiceOver 청취                                                                                           |

성능 작업은 카운트를 먼저 RED 로 둔다 (같은 규칙 §5): 열 조각 변경의 행 source 호출 수 · chunk mount 수 · 검색 입력당 비교 수.

### 7.2 검사 목록

- 번역: 표 상태 → `ViewQuery` → 로컬 결과 · 서버 요청이 손계산 정답과 같다 (정렬 여러 열 · 검색 + 열 필터 + 작성 조건 · 묶기).
- 서버 실행 반례 셋 (리뷰 round 1 — 손계산 fixture):
  - 쪽 크기 2 · 두 열 정렬: 여러 정렬을 담는 형식은 요청에 두 정렬이 다 있고, 담지 못하는 형식은 둘째 정렬이 상태에 들어가지 않는다.
  - 검색 중 열 숨김: 번역 · 요청 · 결과 · 쪽이 그대로이고 행 source 호출 0.
  - 묶음 펼침: 같은 집계를 내는 두 원본에서 자식 행이 각각 자기 원본의 행이다 (로컬은 행 번호, 서버는 자식 조회의 `groupOf`).
- 식별 반례 셋 (리뷰 round 2 — 로컬과, 묶기와 같은 동등성으로 `groupOf` 를 판정하는 mock 서버 둘 다):
  - `team` 이 `"A"` · `"a"` 인 두 행: 묶음 둘, 각 묶음의 자식은 자기 행 하나 (자식 수 = 묶음 `count`).
  - `team` 이 `null` · `""` 인 두 행: 묶음 둘, 자식이 섞이지 않는다.
  - key `"A"` · `"a"` 에서 `A` 만 고정: 고정 `[A]`, 본문 `[a]`.
- 후보 값: 후보마다 개수 = 그 후보를 골랐을 때의 행 수 (대소문자만 다른 값 · 빈 값 포함 fixture).
- 조각 사이 규칙 §4.4 의 줄마다 테스트 하나.
- RAC 불변식: 숨김 · 순서 · 고정의 모든 조합에서 throw 0 (row header 마지막 열 · colSpan 덩어리).
- 행 창: 10,000 행 가상 표에서 각 조각 변경 뒤 blank 0 · 스크롤 높이 손계산 일치.
- Canvas: 작성 기본값 (기본 숨김 · 고정 · 정렬 · 묶음 · 병합) `/cross-check`.
- 수정 버그의 원복 RED 는 타입별 실제 diff 행으로 적는다.

## 8. Phase

| Phase | 내용                                                                                                                                                                                                                                                                          |           entry 형 변경            | Gate |
| :---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------: | :--: |
|   0   | 기능 표 「지금」 열 재대조 · 시제품 S1 (고정 열 — 가상 · 비가상 · Chrome · WebKit) · S2 (행 창 위 펼침 행) · S3 (고정 행) · S4 (Shift 판정) · S5 (열 메뉴 항목 · 머리글 끌기) · S6 (칸 범위 선택) · 기준선 (속도 · 힙 · 번들) · 10 만 행 화면 스레드 측정 · 기능별 go / no-go |                 —                  |  G0  |
|   1   | 표 상태 모델 · 세션 한 곳 (`tableSorts` 이전 — 쓰기 · 읽기 하나) · 기억 층 (사용자 결정 1) · Column key 기본값 통합 · 조각 사이 규칙 · 열 역할 판정 (선택 열 · row header) — 화면 동작은 그대로 (새 스위치 「Remember state」 하나)                                           |                 —                  |  G1  |
|   2   | 정렬: 번역 함수 · 실행 자리 판정 (§4.3.1 — 정렬 조각부터) · 여러 열 · 타입별 비교 · 옵션 · `ViewSort` 목록 · 서버 직렬화 (`sort` 배열 · `suffix` 「여러 정렬」 설정 · 담지 못하면 거절) · 순번 표시 (rule · Canvas)                                                           |            contract +1             |  G2  |
|   3   | 검색 · 열 필터 (조각의 prop · 유도 Do · 변수 노출) · 후보 값 · 이어 치기 · 유사 검색 (사용자 결정 2) · 필터 컨트롤 항목 source                                                                                                                                                | (Phase 2 와 묶을 수 있으면 묶는다) |  G3  |
|   4   | 열: 투영 · 숨김 · 순서 · 고정 · 폭을 상태로 (RAC 폭 조절 끝 → `columnWidths`) · 폭 기억 · 조각의 prop · 유도 Do · 열 메뉴 · 열 선택 메뉴 · 끌기 (사용자 결정 3)                                                                                                               |            contract +1             |  G4  |
|   5   | 행: 묶음 행 (로컬 행 번호 · 서버 묶음 조회 + 자식 조회) · 집계 (사용자 결정 4) · 합계 행 · 계층 · 상세 행 · 행 고정                                                                                                                                                           |            contract +1             |  G5  |
|   6   | 칸: 시각 병합 · 칸 범위 선택 · 복사 (사용자 결정 5) · D1 예외를 규칙 문서에                                                                                                                                                                                                   | (Phase 5 와 묶을 수 있으면 묶는다) |  G6  |
|   7   | Worker 조건 판정 · (조건 충족 시) 구현 · 로컬 상한 (사용자 결정 7) · 번들 · 규칙 문서 (`data-interaction.md` · `catalog-subparts.md`) · CHANGELOG · 종결 live                                                                                                                 |                 —                  |  G7  |

- Phase 3 실행 때 뒤로 옮긴 것 (2026-11-20, 범위는 그대로 — §9 Phase 3 「하지 않은 것」): 열 필터의 조작 자리 (열 메뉴 「필터」 · Do · `tableFacet` 의 소비처) 는 열 메뉴와 같이 Phase 4 로. G3 의 검색 입력 속도 (p95 136 ~ 152 ms — 원인은 계산이 아니라 RAC collection 재구성) 는 사용자 결정으로 기준을 정렬 클릭 기준선에 맞춰 닫았다 (Phase 7 로 넘기지 않는다).
- Phase 2 실행 때 뒤로 옮긴 것 (2026-11-20, 범위는 그대로 — §9 Phase 2 「하지 않은 것」): 작성된 기본 정렬의 머리글 표시 (Canvas 순번 포함) 와 「정렬에 추가」 Do · 메뉴 항목은 열 투영 · 열 메뉴와 같이 Phase 4 로.
- Phase 1 실행 때 순서를 조정했다 (2026-11-20, 범위는 그대로): 조각의 변수 · Do 노출은 그 조각의 Table prop 이 생기는 Phase 로 (유도 Do 층이 binding `accepts` 에서 만든다 — prop 없이 다리만 두면 닿는 곳이 없다), 폭을 상태로 올리는 것은 열 투영과 같이 Phase 4 로, 번역 함수와 실행 자리 판정은 첫 소비처인 Phase 2 (여러 열 정렬) 로 옮겼다.
- 각 Phase 끝은 커밋 가능한 상태다. Phase 0 의 no-go 는 해당 Phase 의 범위를 줄이고 본문 「하지 않는 것」 에 사유를 더한다.
- 추정 규모: shared 40 ~ 55 · builder 25 ~ 35 파일 + 테스트. 실측과 1.5 배 넘게 벌어지면 Phase 0 인벤토리를 보강하고 사후 보고한다 (새 ADR 사유가 아니다).

## 9. 기록

- 2026-11-20 리뷰 round 1 (codex, [reviews/315.md](../reviews/315.md)) 반영 — H1: §4.3.1 · §5.1 (서버 실행 표는 요청이 담는 조각만 실행, 정렬을 줄여 보내지 않는다). H2: §4.3 · §4.4 (검색 대상은 가시성과 무관, 열 조각은 번역의 입력이 아니다). H3: §4.3.2 · §5.4 (묶음 조회 + 자식 조회, 담지 못하면 전량 로드). L4: 본문 Gates 집행 줄.
- 2026-11-20 리뷰 round 2 (codex — 수리 검증) 반영 — h4: §4.3.3 신설 (묶음의 행 · key 의 행은 필터 조건이 아니라 요청 항목 `groupOf` · `keys` — endpoint 선언 필요, 어긋나면 표시), §4.3.1 판정 · §4.3.2 · §5.4 · §5.2 후보 값 · §7.2 fixture.

### Phase 0 (2026-11-20 — G0 통과)

착수 HEAD `0bbf051db` (코드는 `23b1c802b` 와 같다 — 그 사이 커밋은 문서뿐). 원 수치는 `.agent/runs/2026-11-20-adr315-phase0/` (로컬).

**기능 표 재대조** — §2 의 「지금」 열 18 행을 코드와 다시 맞췄다. 차이 2 건을 고쳤다: 집계는 값 5 종에 `applied` (적용 조건 수) 가 더 있다 (`types.ts:843`) · 명령의 기본 열 key 줄은 `commands/collections.ts:906`. 나머지 인용 (정렬 비교 `tableSort.ts:65` · 실행 상태 `catalogPreviewSession.ts:565` · 후보 값 상한 `viewAuthoring.ts:158` · 숨김 대상 `structure.ts:503` · 로컬 상한 `serialize.ts:49` · 정렬 순서 캐시 `dataBinding.ts:473` · 열 key `resolveCollectionItems.ts:697` · contract 73) 은 그대로다. Worker · 열 고정 · 행 펼침 (Table) · 행 고정 · `rowSpan` 의 코드는 없다 (`treeColumn` · `expandedKeys` 는 Tree · Accordion 의 것).

**시제품** — `apps/builder/scripts/adr315Prototypes.mjs` (설치된 RAC 1.22.1 을 그대로 묶은 여덟 표) 를 `adr315-phase0-prototypes.mjs` 가 headed Chrome 157 · Playwright WebKit 27.2 에서 판정한다. 판정값은 브라우저의 좌표 (`getBoundingClientRect` · `elementFromPoint`) · DOM 속성 · 접근성 트리다.

| 시제품                                                   | 판정 (Chrome · WebKit) | 결과      | 설계에 더한 것                                                                                          |
| -------------------------------------------------------- | ---------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| S1 고정 열 — 가상 (열 30 · 2,000 행)                     | 8 · 8                  | go        | §5.3 의 넷 (`isStickyColumn` · `allowOverflow` · 끝 고정의 `:has` + flex 채움 · `requestedRect` 넓히기) |
| S1 고정 열 — 비가상                                      | 7 · 7                  | go        | CSS sticky 만                                                                                           |
| S2 행 창 위 펼침 행 (1,000 × 10 · 5 × 2,000 · 100 × 100) | 15 · 15                | go        | 접힌 묶음의 자식 Row (§5.4) · 칸 없는 Row 의 행 높이                                                    |
| S3 고정 행 — 가상 (2,000 행, 위 2 · 아래 1)              | 7 · 7                  | go        | layout 이 고정 행을 늘 만든다 · 아래 고정의 flex 채움 (§5.4)                                            |
| S3 고정 행 — 비가상                                      | 6 · 6                  | go        | CSS sticky 만                                                                                           |
| S4 Shift 판정                                            | 10 · 10                | go        | 둘째 이후 열의 방향은 우리 상태가 뒤집는다 (§5.1)                                                       |
| S5 열 메뉴 항목 · 머리글 끌기                            | 10 · 10                | go        | 손잡이의 이벤트를 Column 으로 올리지 않는다 · WebKit 의 첫 클릭 (§5.3)                                  |
| S6 칸 범위 선택                                          | 15 · 14                | 조건부 go | `render` prop 으로 속성 · VoiceOver 는 G6 (§5.6)                                                        |

- 고정 열 · 고정 행의 판정은 가로 0 · 1000 · 끝, 세로 0 · 가운데 · 끝에서 고정 칸의 화면 좌표가 표의 가장자리와 1 px 안에서 같은지와, 그 자리의 hit test 가 고정 칸을 돌려주는지다.
- 시제품을 고치며 본 RAC 의 동작 (제품 구현 때 그대로 만난다):
  - RAC 는 스크롤 중 표 내용의 pointer event 를 끈다 — 스크롤 직후의 클릭 · hit test 는 닿지 않는다 (자동 확인은 0.6 초 기다린다).
  - `TableHeader` · `TableBody` · `Row` 의 항목 렌더는 캐시된다. 표 상태가 바꾸는 것 (고정 · 정렬 표시 · 선택 · 열 목록) 은 `dependencies` 에 있어야 다시 그려진다.
  - react-aria `useDrag` 는 요소 정중앙의 pointerdown 을 화면 낭독기의 가상 끌기로 본다 (자동 확인은 정중앙을 피해 누른다).
- **한계**: 시제품은 순수 RAC 표다. 제품의 resolver · `CatalogTableLayout` · 행 창 (`catalogWindowRowChunks`) · 트랙 폭 (`catalogTableTrackWidths`) 과의 결합은 보지 않았다 — Phase 4 (열) · Phase 5 (행) 의 구현과 Gate 가 그 몫이다. S6 의 VoiceOver 청취는 하지 않았다.

**기준선** (`datagrid-table-vs-tanstack-live.mjs --rows 10000` — production 빌드 · headed Chrome 120 Hz · 열 6 · 원격 collection, 교대 3 회의 범위):

| 지표                                        | CPU 1x       | CPU 4x       |
| ------------------------------------------- | ------------ | ------------ |
| 로드 (Preview 클릭 → 첫 데이터 행)          | 389 ms       | —            |
| JS 힙                                       | 155 MB       | —            |
| 정렬 클릭 → 화면 (숫자 열 · 글자 열 중앙값) | 169 · 154 ms | 589 · 556 ms |
| 스크롤 frame 간격 p95                       | 16.7 ~ 25 ms | 108 ~ 109 ms |
| DOM 행 · 요소                               | 17 · 342     | —            |

같은 문서의 순수 RAC 표는 정렬 379 ~ 384 ms (4x 1.53 ~ 1.55 s) · 스크롤 p95 8.8 ~ 9.7 ms (4x 17.7 ~ 34 ms) 다 — 스크롤은 우리가 느리다 (본문 F11 과 같은 값, HC4 의 비교 대상은 이 표가 아니라 「기능을 끈 arm」 이다).

**번들 기준선** (`vite build` + `adr209-bundle-closure.mjs` — ADR-313 과 같은 방식, 판정은 이 값과의 Δ): Builder initial JS gzip **1,586,066 B** · Preview **171,811 B**.

**10 만 행 화면 스레드 계산** (`adr315-phase0-mainthread.mjs` — 제품의 `runViewQueries` · `catalogTableSortOrder` 를 묶어 headed Chrome 의 main thread 에서, 7 회의 p95. 계산만이다 — 화면 반영은 들어 있지 않다):

| 계산                                           | 10,000 행 1x | 10,000 행 4x | 100,000 행 1x | 100,000 행 4x |
| ---------------------------------------------- | -----------: | -----------: | ------------: | ------------: |
| 검색 「Person 12」 · 글자 열 4                 |          5.1 |         17.8 |          42.3 |           167 |
| 검색 「e」 (한 글자 — 결과가 전부) · 글자 열 4 |          1.4 |          5.2 |          12.5 |            51 |
| 검색 「1」 · 열 7 전부                         |          3.7 |         10.9 |          26.7 |           104 |
| 검색 「김민」 (한글) · 글자 열 4               |          6.0 |         21.5 |          55.9 |           216 |
| 검색 (없는 글자) · 글자 열 4                   |          4.5 |         17.2 |          43.9 |           171 |
| 정렬 — 글자 열 (값이 모두 다름)                |         17.6 |         71.8 |           254 |         1,012 |
| 정렬 — 한글 글자 열                            |         11.4 |         43.2 |           165 |           643 |
| 정렬 — 숫자 열                                 |          2.2 |          8.3 |          27.7 |           110 |
| 검색 「e」 뒤 그 결과를 글자 열로 다시 정렬    |         18.5 |         76.0 |           269 |         1,080 |
| 묶기 (dept) + 개수 · 합계                      |          1.5 |          4.7 |          12.7 |            56 |

(ms.) 읽는 법:

- 검색 계산은 10 만 행 1x 에서 12 ~ 56 ms 다 — HC4 의 상한 (입력 → 반영 100 ms) 안에 화면 반영 몫이 남는다.
- 넘는 것은 정렬이다. 검색 글자마다 결과를 다시 정렬하면 269 ms 다. 정렬 순서 (`sortedRowOrder` 의 행 번호 배열) 를 한 번 만들어 두고 그 순서대로 거르면 검색 입력의 비용은 검색 계산뿐이다 — Phase 3 은 이 방식으로 한다 (§5.2 「이어 치기」 와 함께).
- 그러면 Worker 가 필요한 자리는 「10 만 행의 글자 열 정렬 클릭 한 번」 (254 ms · 4x 1.0 s) 과 4x 의 검색이다. 본문 Decision 8 의 조건은 1x 의 검색 입력이므로 지금 읽기로는 넘지 않는다 — 판정은 G3 의 실제 입력 측정과 G7 에서 한다.
- 지금의 Table 은 10 만 행을 열지 않는다 (로컬 상한 10,000 — 사용자 결정 7).

**Gate G0**: 기능 표 차이 0 (정정 뒤) · 시제품 6 의 go / no-go 기록 · 기준선 (속도 · 힙 · 번들) · 10 만 행 측정 — 통과. no-go 0 이라 Phase 범위는 그대로다.

**이 Phase 가 닿은 사용자 결정**: 없음. (Phase 1 착수 때 결정 1 확정 — 「표마다 켜는 스위치」, 기본 꺼짐.) 결정 3 (열 순서의 끌기) 의 전제 「끌기는 Phase 0 시제품 통과 시」 는 충족됐다 — Phase 4 에서 묻는다.

### Phase 1 (2026-11-20 — G1 통과)

**착수 조사 — 지금의 상태 자리 (실측)**:

| 조각         | 자리                                                                                                                | 읽는 곳                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 정렬         | Table record 의 runtime 값 `sortDescriptor` (`CatalogPreviewInteractions` — RAC 가 읽는다) + 세션 `tableSorts` 사본 | DOM · resolver (`tableRowSort`)            |
| 선택         | Table record 의 runtime 값 `selectedKeys` (`catalogControlledProps`)                                                | DOM · dispatcher (`catalogRuntimeStateOf`) |
| 폭           | RAC `ResizableTableContainer` 내부 상태                                                                             | RAC                                        |
| 쪽 · 표시 창 | 세션 `pageUnits` · `displayWindows` (목록 노드마다)                                                                 | `catalogBoundRows`                         |
| 필터         | 페이지 변수 (보기 조건이 읽는다)                                                                                    | 보기 평가기                                |

**증분 1 (완료)** — 화면 동작은 그대로다.

- `runtime/tableState.ts`: 닫힌 형 `CatalogTableState`, 조각 사이 규칙 `catalogTableStateWith` (없는 열 버리기 · 빈 조각 지우기 · 데이터 조각이 바뀌면 첫 쪽 · 한 열 정렬 · 정렬 최대 열 수 · 마지막 row header 열은 숨기지 않음 · 고정은 한쪽만), 바깥 값 읽기 `catalogTableStateRead`, 기억 대상 `catalogTableStateRemembered` (열 조각 + 정렬).
- 세션: `tableSorts` → `tableStates`. 쓰기는 `setTableState(tableId, patch)` 하나이고 데이터 조각이 바뀔 때만 행을 다시 읽는다. RAC 의 정렬 (`sortTable`) 은 RAC key 를 Column key 로 바꿔 같은 쓰기로 간다. 읽기는 `tableState(tableId)`.
- resolver · composition root: `tableSort` reader → `tableState` reader. 정렬은 `sort[0]` 를 Column key 로 읽는다 (Phase 2 에서 목록 전체).
- `runtime/tableColumnRoles.ts`: 열의 역할 (선택 열 · row header) 판정 하나를 DOM (`columnIsRowHeader`) 과 세션이 같이 쓴다.
- `catalogDefaultColumnKey`: 이름 없는 열의 기본 key 를 한 함수로 (`column<자리>` — 읽는 쪽 `col<index>` 를 명령 쪽과 맞췄다. 본문 F5 · R6).

**설계에 더한 것**:

- 상태가 이름 붙이는 열은 데이터 열뿐이다. 선택 checkbox 열은 정렬 · 숨김 · 순서 · 고정의 대상이 아니다 (S2 처럼 늘 맨 앞).
- row header 는 작성자가 정하지 않으면 첫 데이터 열이다 (DOM 의 규칙) — 「숨기지 못하는 열」 이 그 열이다.
- RAC 가 읽는 `sortDescriptor` runtime 값은 RAC 쪽 표시로 남는다. 상태의 정본은 세션이고, RAC key ↔ Column key 는 세션 가장자리에서 바꾼다. RAC 밖에서 쓴 정렬 (기억 층) 은 그 runtime 값도 같이 맞춘다 (기억 층 구현 때).

**검사**: `tableState.test.ts` 13 · `adr315TableState.test.tsx` (Column key 로 저장 · 없는 열 · 열 조각 쓰기의 행 source 호출 0 · 데이터 조각 쓰기는 다시 읽음). 변이 RED 2/2 — 열 조각에도 행을 다시 읽게 하면 `boundRows` 호출 0 → 2, RAC key 를 저장하게 하면 상태가 `{}`.

**증분 2 (완료) — 기억 층 (사용자 결정 1 「표마다 켜는 스위치」)**:

- Table prop `rememberState` (boolean · 기본 꺼짐 · Property 탭 Behavior 구획의 「Remember state」 · 출처 `composition` — `d2Provenance.ts`).
- 세션 옵션 `tableStateStorage`: Publish 만 브라우저 `localStorage` 를 준다 (`apps/publish/src/catalogSession.ts`). Builder 의 Preview 는 주지 않는다 — 저장도 복원도 없다.
- 저장: `setTableState` 가 스위치를 켠 표의 `catalogTableStateRemembered` (열 조각 + 정렬) 를 `composition:table-state:v1:<project>` 에 표 record id 별로 적는다. 남는 조각이 없으면 지운다.
- 복원: root 를 만들거나 페이지를 채운 뒤 화면이 읽기 전에 (`changed` — `restoreDue`), 그려진 표 중 스위치가 켜진 것을 한 번씩 본다. 저장된 값은 쓰기와 같은 규칙을 지난다 (없는 열 · 상태가 아닌 값은 버린다). 정렬이 있으면 그 표의 행을 다시 읽고, RAC 의 `sortDescriptor` runtime 값을 맞춘다 (`attachRuntimeProps` — view 의 rule runtime 이 붙기 전이면 붙을 때).
- 저장소 읽기 · 쓰기 (JSON) 는 `tableState.ts` 에 있다 — 세션 파일은 행 진입 경로라 `JSON.parse` 를 두지 않는다 (ADR-313 정적 게이트).

**검사 (증분 2)**: `adr315RememberState.test.tsx` 3 — 저장 → 다른 세션에서 복원 (행 순서 · 상태 · 머리글 `aria-sort`) · 스위치 꺼진 표와 저장소 없는 세션은 저장 · 복원 없음 · 없는 열과 상태가 아닌 값은 버림. 변이 RED 4/4 (꺼진 표도 복원 · RAC 에 안 알림 · 꺼진 표도 저장 · 저장 값을 규칙 없이 사용). 정적 게이트 등록 2 (`stagedLoadReaders` 의 record 순회 분류 · ADR-313 의 진입 파일 파싱 금지 — 파싱을 `tableState.ts` 로 옮김).

**live (2026-11-20, production 빌드 · headed Chrome 157 · CPU 1x · `datagrid-table-vs-tanstack-live.mjs --check-remember on|off`, 300 행)**:

| 경우 | Builder 패널                                                  | Publish — 머리글 「Name」 클릭                              | 새로고침 뒤                                         |
| ---- | ------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| on   | Behavior 구획의 「Remember state」 를 누름 → 문서 prop `true` | 오름차순 (`Person 1` · `Person 4` …) · 브라우저에 1 건 저장 | 오름차순 그대로 · 같은 행 · `aria-sort="ascending"` |
| off  | 스위치는 보이고 누르지 않음                                   | 오름차순 · 저장 0 건                                        | 작성 순서 (`Person 970` …) · `aria-sort="none"`     |

콘솔 오류 0. 사용자 Chrome 의 CPU 4x 에서는 보지 않았다 (동작 확인이라 속도와 무관).

**회귀**: shared 2,616 통과 · builder 9,361 통과 — 실패 7 · 12 건은 착수 전 (HEAD) 에도 같은 실패다 (내 변경을 patch 로 되돌려 같은 파일을 돌려 확인: archetype · borderWidth ratchet, Tabs presence, actionIcons 등 — 표와 무관).

**속도 (HC4)** — 조각을 끄고 켜는 스위치가 아직 없어 변경 전 (HEAD `0bbf051db` 빌드) 과 변경 후 빌드를 교대 3 쌍으로 쟀다 (`datagrid-table-vs-tanstack-live.mjs --rows 10000`, production · headed Chrome · 원격 collection · 열 6, 각 값은 3 회):

| 지표                                       | 변경 전                 | 변경 후                 |   중앙값 비율 |
| ------------------------------------------ | ----------------------- | ----------------------- | ------------: |
| 로드 (ms)                                  | 397 · 390 · 400         | 403 · 399 · 395         |         1.005 |
| 힙 (MB)                                    | 153 · 153 · 153         | 153 · 153 · 153         |         1.000 |
| 정렬 클릭 1x — 숫자 열 (ms)                | 172 · 181 · 179         | 176 · 158 · 177         |         0.984 |
| 정렬 클릭 1x — 글자 열 (ms)                | 188 · 184 · 186         | 185 · 166 · 190         |         0.997 |
| 스크롤 p95 1x (ms)                         | 20.8 · 20.1 · 22        | 20.2 · 20.1 · 22        |         0.971 |
| 정렬 클릭 4x — 숫자 열 (ms)                | 595 · 607 · 611         | 610 · 566 · 620         |         1.004 |
| 정렬 클릭 4x — 글자 열 (ms)                | 607 · 599 · 616         | 619 · 555 · 604         |         0.995 |
| 스크롤 p95 4x (ms)                         | 81.6 · 98.3 · 81.7      | 98.9 · 81.8 · 81.9      |         1.002 |
| 스크롤 main thread 일 / frame 1x · 4x (ms) | 7.9 ~ 8.3 · 27.9 ~ 28.5 | 8.2 ~ 8.5 · 27.9 ~ 29.2 | 1.006 · 0.999 |

- 전부 ≤ 1.10. 콘솔 오류 0 · 탭은 보이는 상태였다.
- 이 측정 동안 화면 주사율이 50 Hz 였다 (frame 간격 p50 20 ms — Phase 0 기준선은 120 Hz, p50 8.4 ms). 두 arm 이 같은 조건이라 비율은 유효하지만, 절대값을 Phase 0 기준선 표와 비교하지 않는다.
- 열 조각 변경의 행 source 호출 0 은 unit 테스트의 호출 수로 확인했다 (위 「검사」). `gate:perf-ratchet` 의 카운트 seed 는 두지 않았다 — 열 조각의 소비처 (열 투영) 가 생기는 Phase 4 에서 Preview 의 열 숨김 조작으로 seed 를 잡는다.

**번들** (`vite build` + closure, Phase 0 기준선 대비): Builder initial 1,586,066 → 1,586,063 B (−3) · Preview 171,811 → 171,811 B (0). 세션과 표 상태 모듈은 lazy chunk 다. 사용자 결정 6 의 범위 안.

**Gate G1**: 표 상태 한 곳 (쓰기 · 읽기 하나, 정렬 조각 이전) · 기존 동작 회귀 새 실패 0 · HC4 비율 ≤ 1.10 · 열 조각 변경의 행 source 호출 0 — 통과.

- 「한 곳」 의 범위: 세션이 소유하는 실행 상태는 표 상태 하나다. 행 선택은 RAC 의 controlled 값 (Table record 의 runtime 값 `selectedKeys` — ADR-280 의 두 번째 소유자 금지) 이 소유자로 남고 표 상태는 그 조각을 읽는 쪽이 된다. 쪽 (`pageUnits`) 과 폭은 그 조각의 소비처가 생기는 Phase (쪽 — Phase 2 의 「데이터 조각이 바뀌면 첫 쪽」 을 상태 규칙으로, 폭 — Phase 4) 에서 옮긴다.

**이 Phase 가 닿은 사용자 결정**: 1 (확정 — 「표마다 켜는 스위치」). 6 (번들) 은 범위 안이라 묻지 않았다.

### Phase 2 (2026-11-20 — G2 통과)

**착수 조사 — 지금 정렬이 지나던 길 (실측)**: 정렬 구현이 둘이었다 — 보기의 정렬 (`evaluate.ts` 가 행을 복사해 정렬) 과 표 머리글 정렬 (`tableSort.ts` `catalogTableSortOrder` — 행 번호 정렬 · 순서 캐시). 비교는 둘 다 「숫자끼리는 값, 나머지는 글자」 하나였고 (필드 타입을 읽지 않음), 빈 값은 빈 글자로 읽혀 오름차순에서 맨 앞이었다. 서버로 가는 길도 둘이다 — endpoint 자신의 `{{ sortDescriptor }}` 템플릿 (한 열) 과 보기 직렬화 (`serializeViewQueries` 의 `sort` 한 항목).

**구현**:

- **정렬은 한 구현** — `collections/view/sortOrder.ts` `viewSortOrder(count, keys)`: 항목마다 값을 한 번 순위로 바꾸고 (숫자 · 시각 · 불리언 0/1 · 글자는 collator 로 한 번 줄 세운 자리) 그 뒤 비교는 숫자끼리다. 열의 순위는 행 배열마다 보관해 방향을 뒤집거나 둘째 항목으로 쓸 때 값을 다시 읽지 않는다 (본문 F12 — TanStack 은 비교마다 소문자 변환). 보기의 정렬 (`evaluate.ts` `viewRowsOrder`) · 표 머리글 정렬 (`dataBinding.ts` `sortedRowOrder` — 순서 캐시의 키가 정렬 목록 전체) · 작성한 Row 정렬 (`tableSort.ts` `catalogTableSortedRows`) · 행 source 가 정렬하지 않을 때의 resolver 대체 길이 모두 이 함수를 부른다. 옛 `catalogTableSortCompare` · `catalogTableSorted` · `catalogTableSortOrder` 는 삭제.
- **타입별 비교 · 빈 값**: 필드 타입 (`viewFieldKind`) 으로 숫자 · 날짜 · 불리언 · 글자를 가른다. 타입이 없는 값은 전부 숫자면 숫자, 아니면 글자. 빈 값 (`undefined` · `null` · 빈 글자 · 그 타입이 읽지 못하는 값) 은 방향과 무관하게 뒤이고 항목이 「앞」 이라고 하면 앞이다.
- **문서 형 — contract 74**: `ViewQuery.sort` 가 한 항목에서 목록으로 (`readonly ViewSort[]` — 빈 목록은 검증이 거절), 리터럴 항목에 `empty: "first" | "last"`. 소비처: `viewQuery.ts` · `viewRefs.ts` · `validation.ts` · `serialize.ts` · resolver `viewSortsByVariable` · Code 보기 생성 · 역편집 · 보기 작성 (`viewAuthoring.ts`) · 필터 구획.
- **번역 하나** — `runtime/tableStateQuery.ts`: 표 상태의 정렬 (Column key) → 행이 읽는 정렬 (`catalogTableStateRowSorts` — 열의 필드 · 방향 · 그 열의 빈 값 위치) → 보기의 `ViewSort` 목록 (`catalogRowSortsView`) → 바인딩의 보기 사슬에 얹기 (`catalogTableStateQueries` — 연결된 보기의 정렬 자리에. 보기가 없는 바인딩은 정렬만 하는 보기 하나). 입력 형에 열 조각이 없다 (HC4).
- **실행 자리 판정** — `catalogTableSliceServable(service, "sort")`: 원본 행이 전부 여기 있으면 `whole`, endpoint 가 자신의 `{{ sortDescriptor }}` 를 읽으면 `one` (`sortTemplate`), `suffix` 형식인데 「여러 정렬 받기」 를 켜지 않았으면 `one` (`suffixSingle`), `body` 형식 · 「여러 정렬 받기」 를 켠 `suffix` 는 `whole`. 세션 (머리글 누름 · 값으로 쓰기 · 브라우저 기억 복원 — `tableShape` 하나) 과 패널 안내가 같은 함수를 읽는다.
- **서버 직렬화**: `body.sort` 는 한 항목이면 지금까지의 객체, 여러 항목이면 목록. `suffix` 는 endpoint 설정 `multiSort` (조회 형식 편집기의 「여러 정렬 받기 (쉼표 목록)」 스위치) 가 켜져 있으면 `_sort=a,b&_order=asc,desc`, 아니면 첫 항목만 보내고 `MULTI_SORT` 경고 (작성한 보기의 정렬 목록 — 표 상태는 그 형식에서 둘째 정렬을 갖지 못한다). mock 조회 서버 (`scripts/mock-query-server.mjs` — 독립 oracle) 도 목록을 읽는다.
- **세션**: 머리글 누름 = `pressTableSort(tableId, RAC key, add)` — 그 열의 순환 (첫 방향 → 반대 → 「정렬 해제 허용」 이면 정렬 없음, 아니면 첫 방향) 을 세션이 계산한다 (RAC 는 첫 정렬만 알아 둘째 이후 열에 늘 오름차순을 준다 — S4). Shift 를 누른 누름은 여러 열 정렬을 받는 표에서 그 열을 목록 안에서 돌리고 (없던 열은 끝에), Shift 없는 누름은 그 열 하나만 남긴다. 정렬이 바뀌면 RAC 의 `sortDescriptor` (첫 항목) 와 `_sortEntries` (목록 — 순번 표시용) 를 돌려준다. 값으로 쓰는 정렬 (rule 의 `sortDescriptor` Do) 은 지금처럼 한 열이다.
- **요청에 싣기**: 세션이 collection 의 보기를 고를 때 (`uniqueView`) 그 표 record 의 정렬을 번역해 연결된 보기에 얹는다 — 보기가 없는 바인딩도 정렬된 동안은 보기가 있는 것이다. 서버가 그 조회에 답한 행은 그 순서이므로 다시 정렬하지 않는다 (`query.served.sorted` → 행 source 가 정렬을 건너뛰고 `sorted` 표시). 필드가 아닌 key (역할 값 · schema 에 없는 key) 의 정렬은 번역되지 않아 받은 행에서만 돈다.
- **DOM**: Shift 는 문서의 capture listener 가 기억한다 (`CatalogTable` `useShiftMemory` — 감싸는 요소 없음, RAC 의 DOM · 처리기 무변경, HC1). 여러 열로 정렬된 표의 정렬 열은 화살표 뒤에 순번 (`span.sort-order`) 을 그린다 — `aria-sort` 는 RAC 가 첫 정렬 머리글에만 준다 (APG). Column 은 자기 Table record 의 runtime 값을 구독해 다시 그린다. rule 의 `onSortChange` 는 그대로 실행된다.
- **작성 화면**: Table 「Multi-column sort」 · 「Max sort columns」 (여러 열 정렬을 켰을 때) · 「Allow unsorted」, Column 「First direction」 · 「Empty values」 (정렬 허용 열). 전부 composition 확장 (`d2Provenance.ts`), 기본은 꺼짐 — 지금의 표와 같다. 여러 정렬을 받지 못하는 endpoint 의 표에서 「Multi-column sort」 를 켜면 Behavior 구획에 사유 한 줄이 나온다 (`CatalogTableSortNotice` — 세션과 같은 판정).

**설계에 더한 것 · 정한 것**:

- 표 상태의 정렬은 작성된 보기의 정렬 자리를 **대신한다** (실행 층 값이 있으면 그것 — §4.2). 로컬에서는 작성된 순서 위에 안정 정렬이라 같은 값끼리는 작성 순서가 남고, 서버에는 상태의 목록만 간다.
- 로컬 실행은 번역된 보기를 평가기에 통째로 다시 돌리지 않고 같은 순서 함수로 행 번호를 낸다 (HC3) — 평가기가 결과 행을 복사하면 key 필드가 없는 collection 의 행 key 가 정렬마다 바뀐다 (선택이 다른 행을 가리킨다). 번역 결과를 평가기에 넣은 순서와 같은지는 fixture 로 확인한다 (`tableStateQuery.test.ts` — 같은 번역의 로컬 행 · 요청).
- 서버가 쪽을 나누는데 보기를 요청에 싣지 않는 길 둘은 그대로 두었다 (이 Phase 의 범위 밖 — 지금 동작): 조회 형식이 없는 cursor endpoint (받은 행 안에서 정렬 · 보기 실행) 와 원격 「쪽」 표시의 쪽 단위 요청 (`loadPageUnit` — 보기를 싣지 않는다). 둘 다 정렬은 받은 행 안에서 돈다.

**검사**:

- `sortOrder.test.ts` 11 (숫자 · 소수 · 음수 · 날짜 · 불리언 · 글자 · 빈 값 위치 · 타입 없는 값 · 읽지 못하는 값 · 두 항목 · 순위 보관 — 값 읽기 횟수).
- `tableStateQuery.test.ts` 12 — 리뷰 round 1 H1 fixture (쪽 크기 2 · `team` 오름 + `score` 내림: 전체를 보내면 `[s3, s2]`, 첫 정렬만이면 `[s1, s2]`): 번역 결과 손계산 일치, 같은 번역의 로컬 순서 `[s3, s2, s1, s4]` 와 `body` 요청의 `sort` 목록 · 그 요청으로 mock 서버가 자른 쪽 = 로컬의 앞 2 행, `suffix` + `multiSort` 는 쉼표 목록, `suffix` 한 정렬은 판정 `one` → 상태가 둘째 정렬을 갖지 않음 · 작성 보기는 `MULTI_SORT` 경고, 날짜 · 숫자 · 빈 값 (열의 「앞」).
- `tableSortedRows.test.ts` 2 (작성 Row 의 여러 열 정렬 — 칸 글자 · 빈 값 위치).
- `adr315MultiSort.test.tsx` 5 (Preview 세션 + DOM): Shift 로 추가 · 제자리 방향 전환 · 행 순서 손계산 · `aria-sort` 는 첫 정렬만 · 순번 표시, 여러 열을 켜지 않은 표는 한 정렬, 최대 열 수, 열의 순환 (첫 방향 내림 · 빈 값 앞 · 정렬 해제), 실제 머리글 클릭의 Shift 읽기.
- `adr315MultiSortModes.test.tsx` 4: 250 행에서 두 열 정렬 뒤 「더 보기」 (100 번째 `p52` · 200 번째 `p101`) · 쪽 (2 쪽 `p210` ~ `p172`, 정렬이 바뀌면 1 쪽) · 가상 (전체 key 순서), 서버 3 (쪽 크기 2 — `suffix` + `multiSort` 요청 `?_sort=type,status&_order=asc,desc&_page=1&_limit=2` · 행 `[s3, s2]`, `suffix` 한 정렬은 요청에 쉼표가 한 번도 없음 · 값으로 쓴 두 정렬도 하나만, `body` 는 목록).
- 변이 RED 16/16 (`p2-red.sh` — 변이마다 원본 복원 · `cmp` 확인): 둘째 항목 무시 · 빈 값이 방향을 따름 · 숫자를 글자로 · 날짜를 글자로 · `suffix` 가 조용히 줄여 보냄 · `suffix` 가 늘 목록을 보냄 · 평가기가 첫 정렬만 · 판정이 늘 `whole` · 빈 값 위치 누락 · 세션이 판정을 안 읽음 · 요청에 표 정렬이 없음 · 누름이 방향을 안 돌림 · Shift 를 안 읽음 · resolver 가 첫 정렬만 · 순번을 안 그림 · rule 의 `onSortChange` 누락. 처음에 잡히지 않은 2 건 (숫자를 글자로 · 세션이 판정을 안 읽음) 은 테스트를 보강한 뒤 RED (소수 · 음수 fixture, 값으로 쓴 두 정렬).

**live (2026-11-20, production 빌드 · headed Chrome · CPU 1x · `datagrid-table-vs-tanstack-live.mjs --check-multisort`, 10,000 행 · 원격 collection · 가상 스크롤)**:

| 단계                                               | 결과                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder — Behavior 구획 「Multi-column sort」 누름 | 문서 prop `allowsMultiSort: true`                                                                                                                 |
| Publish — 「Dept」 머리글 클릭                     | `aria-sort` Dept 오름 · 순번 표시 없음 · 첫 8 행 = 따로 계산한 「Dept 번호 오름」 순서                                                            |
| Shift + 「Amount」 두 번 (오름 → 내림)             | `aria-sort` 는 Dept 만 · 순번 `Dept 1 ↑` · `Amount 2 ↓` · 첫 8 행 = 따로 계산한 「Dept 오름, 그 안에서 Amount 내림」 (`Person 23790 · 9964.31` …) |
| Shift 없이 「Name」 클릭                           | 정렬은 Name 하나 · 순번 표시 없음                                                                                                                 |

기대 순서는 하니스의 행 생성기에서 따로 계산한 것이다 (제품 코드와 무관). 콘솔 오류 0. 2 회 실행 2 회 통과. 사용자 Chrome 의 CPU 4x 에서는 보지 않았다 (동작 확인).

**회귀**: shared 2,641 통과 · builder 9,371 통과 — 실패 7 · 12 건은 Phase 1 종결 때와 같은 목록이다 (착수 전 HEAD 에도 같은 실패 — archetype · borderWidth ratchet, Tabs presence, actionIcons 등, 표와 무관). 새 실패 0. 의도해서 기대값을 바꾼 기존 테스트: `reference.test.ts` (빈 값이 오름차순에서 뒤로 — 「앞」 항목의 경우를 같이 둠), 보기의 `sort` 를 목록으로 적는 fixture 15 파일, contract 73 → 74 fixture 32 파일. 첫 전체 실행에서 새로 실패한 7 건은 전부 고쳤다 — fixture 의 `sort` 한 항목 5, ADR-152 정적 게이트 (schema 필드를 `resolveField` 로), rule 의 `onSortChange` 가 실행되지 않던 것 (`CatalogTable` 이 rule 의 처리기를 덮었다 — `interactionWhenReach.test.tsx` 가 잡음).

**속도** — Phase 1 빌드와 Phase 2 빌드를 교대 3 쌍으로 쟀다 (`datagrid-table-vs-tanstack-live.mjs --rows 10000`, production · headed Chrome · 원격 collection · 열 6 · 가상 스크롤, 각 값은 3 회, 탭은 보이는 상태 · 콘솔 오류 0 · 화면 주사율 50 Hz — frame 간격 p50 20 ms):

| 지표                                  | Phase 1 빌드          | Phase 2 빌드          | 중앙값 비율 |
| ------------------------------------- | --------------------- | --------------------- | ----------: |
| 로드 (ms)                             | 398 · 389 · 394       | 393 · 408 · 406       |       1.030 |
| 힙 (MB)                               | 154 · 153 · 153       | 153 · 154 · 153       |       1.000 |
| 정렬 클릭 1x — 숫자 열 (ms)           | 165.3 · 162.3 · 150.9 | 177.5 · 160.2 · 161.6 |       0.996 |
| 정렬 클릭 1x — 글자 열 (ms)           | 173.4 · 171.2 · 166.3 | 185.4 · 162 · 169.1   |       0.988 |
| 스크롤 p95 1x (ms)                    | 21.2 · 21.9 · 20.1    | 20.1 · 20.2 · 20.1    |       0.948 |
| 스크롤 main thread 일 / frame 1x (ms) | 8.14 · 8.19 · 8.3     | 8.28 · 8.32 · 8.11    |       1.011 |
| 정렬 클릭 4x — 숫자 열 (ms)           | 546.3 · 583.3 · 493.2 | 623.9 · 512.2 · 502.1 |       0.938 |
| 정렬 클릭 4x — 글자 열 (ms)           | 570.2 · 533.5 · 514.9 | 603.5 · 530.2 · 525.3 |       0.994 |
| 스크롤 p95 4x (ms)                    | 99.3 · 81.8 · 81.8    | 81.8 · 80.8 · 81      |       0.990 |
| 스크롤 main thread 일 / frame 4x (ms) | 29.32 · 28.64 · 28.58 | 28.09 · 28.67 · 28.87 |       1.001 |

- 전부 ≤ 1.10. 이 표는 한 열 정렬 (지금까지 있던 조작) 의 회귀 확인이다 — 정렬 구현을 바꿨는데 느려지지 않았다. 차이는 실행 간 흔들림 폭 안이라 빨라졌다고 적지 않는다.
- **이 측정이 잡은 것**: 첫 3 쌍에서 힙이 154 → 163 MB (비율 1.065, 3 회 모두) 였다. heap profile 로 좁히니 순번 표시용으로 넣은 구독 (`useWatchedChildren`) 이 Column 뿐 아니라 모든 record 의 컴포넌트에 store 구독을 하나씩 더했다. TableBody 가 쓰던 구독 하나를 Column 도 같이 쓰게 바꿔 153 MB 로 돌아왔고, 위 표는 고친 빌드로 다시 잰 것이다.
- 여러 열 정렬 자체의 계산 시간 (화면 스레드, `adr315-phase0-mainthread.mjs` — 순위 보관 없이 매번 값을 읽는 경우): 10,000 행 두 열 (글자 + 숫자) 7.3 ms (1x) · 28.3 ms (4x), 100,000 행 78.4 ms (1x) · 330.6 ms (4x). 한 열 글자 정렬 100,000 행은 264.5 ms (1x) 로 Phase 0 의 246 ~ 254 ms 보다 약간 길다 (순위를 만드는 단계가 하나 더 있다) — 대신 제품에서는 열의 순위가 남아 방향 전환과 둘째 정렬이 숫자 비교만 한다 (값 읽기 0 회 — `sortOrder.test.ts`). Worker 판정 (Phase 7) 의 입력으로 남긴다.

**번들** (`vite build` + closure, Phase 0 기준선 대비): Builder initial JS gzip 1,586,066 → 1,587,798 B (+1,732 — 설정 5 개의 binding · 번역 문구 · 패널 안내 · endpoint 스위치) · Preview 171,811 → 171,811 B (0 — 세션 · 정렬 모듈은 lazy chunk). 사용자 결정 6 의 범위 (Builder +8,000 · Preview +6,000) 안.

**Gate G2**: 여러 열 정렬이 손계산 순서와 일치 (로컬 · 서버 요청 · 「더 보기」 · 「쪽」 · 가상) · 여러 정렬을 담지 못하는 형식에서 둘째 정렬이 상태에 들어가지 않음 · 날짜 · 숫자 · 빈 값 fixture · 원복 RED · live — 통과.

**달라진 동작 (사용자에게 보이는 것)**:

- 빈 값이 있는 열을 오름차순으로 정렬하면 빈 값이 맨 앞이 아니라 맨 뒤다 (내림차순은 그대로 뒤). 열의 「Empty values」 를 First 로 두면 양쪽 모두 앞.
- 날짜 필드는 시각으로, 숫자 필드의 숫자 글자 (`"10"`) 는 숫자로 비교한다.
- contract 74 — 이전 계약 (73) 으로 저장한 프로젝트는 열리지 않는다 (마이그레이션 없음).

**이 Phase 에서 하지 않은 것 (범위 안 — 사후 보고)**:

- **Canvas 의 순번 표시**: Canvas 는 작성 층만 그리는데 (HC9), 정렬의 작성 층은 연결된 보기의 정렬이고 지금 머리글은 그것을 표시하지 않는다 (Preview 도 변수 정렬만 표시). 「작성된 기본 정렬을 머리글에 표시」 는 Canvas · Preview 를 같이 바꾸는 일이라 열 투영이 머리글을 다시 짜는 Phase 4 에서 한다. 순번 표시의 모양 값은 화살표 (`CatalogSortIndicator`) 와 같은 자리의 inline 값이다 (S2 `sortIcon` 과 같은 방식 — rule 이 아니다).
- **스위치 막기**: 여러 정렬을 받지 못하는 endpoint 의 표에서 「Multi-column sort」 칩을 비활성으로 두지 않고 사유 한 줄을 낸다 (칩 묶음에 비활성 사유 자리가 없다). 실행은 안전하다 — 상태가 둘째 정렬을 갖지 않는다.
- **「정렬에 추가」 Do · 메뉴 항목**: 열 메뉴가 들어오는 Phase 4 에서. 지금 rule 로 쓰는 정렬 (`sortDescriptor`) 은 한 열이다.
- **Code 보기**: 정렬 목록의 첫 항목만 코드로 나오고, 역편집은 둘째 이후 항목을 그대로 둔다. 작성 화면이 여러 항목 정렬을 만들지 않는다 (표 상태의 여러 열 정렬은 실행 상태 — 문서에 없다).

**이 Phase 가 닿은 사용자 결정**: 없음 (6 번들은 범위 안).

### Phase 3 (2026-11-20 — G3 통과: 검색 입력 속도 기준은 사용자 결정으로 정렬 클릭 기준선)

**구현**:

- **검색 조각** — Table `searchText` (작성값 = 시작 검색어, 실행 중 값은 표 상태 `search`) · `searchMatch` (`contains` · `fuzzy`), Column `allowsSearching` (기본 켜짐 — 숨긴 열도 검색된다, §4.4). 전부 composition 확장 (`d2Provenance.ts`). 패널의 「Search」 스위치 (`CatalogTableSearchSwitch`) 가 표 앞에 SearchField 를 넣고 규칙 하나 (`onChange` → 유도 Do `setSearchText`, 대상 = 그 Table) 를 단다 — 변수 · 보기 조건을 만들지 않는다. 끄면 규칙과 그 SearchField 를 지운다. 세션은 `searchTable` → `setTableState({ search })`.
- **거르기는 보기의 비교 그대로, 행 번호 위에서** — `collections/view/rowFilter.ts` `viewRowsPassing`: 검색 (검색 대상 필드 중 하나라도 맞으면 통과) 과 열 필터를 `viewCompare` 로 판정해 통과 표시 배열을 낸다 (두 번째 비교 구현 없음 — HC2). 행 source (`dataBinding.ts` `keptRowOrder`) 가 정렬된 행 번호를 그 표시로 거른 뒤 창 · 쪽으로 자른다 (HC3) — 검색어가 바뀌어도 다시 정렬하지 않는다. 행을 복사하지 않아 key 필드가 없는 collection 의 행 key 가 검색마다 바뀌지 않는다.
- **이어 치기** — 검색어가 앞 검색어를 포함하면, 앞 검색에서 「확실히 빠진」 행은 다시 비교하지 않는다. 「확실히」 는 좁다: 칸과 두 검색어가 모두 평범한 글자이고 collator 가 그 글자를 한 가지로 접을 때만 (`viewPlainContainsMiss`). 한글 · 두 글자를 하나로 읽는 collator 는 매번 비교한다 — 검색 collator 가 거기서 단조가 아니다 (`간ㅏ` 는 `가나` 인데 `간` 을 포함하지 않는다).
- **유사 검색 (사용자 결정 2 — 표마다 선택, 기본 「포함」)** — `collections/view/fuzzy.ts`: 등급 6 (같음 · 앞 일치 · 낱말 앞 일치 · 포함 · 낱말 첫 글자 · 흩어진 일치). 0 ~ 3 은 비교 표의 것이고 4 · 5 는 글자를 단위로 읽는다 (한글 음절은 자모로 — 치는 중인 음절과 초성이 맞는다). 표에 정렬이 없으면 등급 순, 있으면 그 정렬. 서버가 답하는 표에서는 서버의 「포함」 이다 (요청은 등급을 싣지 않는다 — 패널이 알린다).
- **열 필터 조각** — 상태 형 `{ column, condition: { op, value, sensitivity, unit } }` (열마다 하나 — 같은 열을 다시 쓰면 그 자리에서 바뀐다), 번역은 조건 항목 `table-filter:<열 key>`, 작성된 조건과 「그리고」. 쓰기는 `session.setTableState({ columnFilters })`.
- **번역 · 실행 자리** — `tableStateQuery.ts` `catalogRowSlicesView` (검색 = 조건 하나 `table-search`, 필드는 검색 대상 열 전부) · `catalogTableSliceServable(service, "search" | { filter: op })`: 원본 행이 전부 여기 있거나 `body` 형식이면 받고, `suffix` 형식은 endpoint 조회 형식의 새 칸 「표 검색어」 (`searchParam`) 가 있어야 검색을 받으며 열 필터는 접미사 표에 그 연산자가 있을 때만 받는다. 받지 못하는 조각은 상태에 들어가지 않는다 (`tableShape` — 세션 · 패널이 같은 판정). 원격 표의 검색어 입력은 300 ms 뒤에 요청한다 (가장 새 글자가 이긴다).
- **후보 값 (Decision 4)** — 보기의 새 선택 필드 `facet: true` (묶는 보기에만): 그 보기가 읽는 사슬에서 자기 묶음 필드의 조건을 빼고 (`withoutOwnConditions`), 비교가 같다고 보는 값을 한 묶음으로 접는다 (`viewEqualityKeys` — 기본 감도에서 `A` · `a` 는 하나, 빈 값은 전부 하나). 후보의 개수 = 그 후보를 골랐을 때의 행 수. 표 쪽은 `session.tableFacet(tableId, columnKey)` (값 · 개수 · 최소 · 최대 · 「불러온 행 기준」 표시 `partial` · `loaded`). 후보 값 보기는 요청에 실리지 않는다 (`catalogCountlessViews` 가 사슬 끝에서 뗀다).
- **필터 컨트롤 항목 source** — 「검색 · 필터」 구획에서 새로 넣는 고르기 컨트롤 (Select · RadioGroup · CheckboxGroup · TagGroup …) 의 항목은 작성 때의 표본 20 개가 아니라 그 필드의 후보 값 보기에 연결된다 (`viewAuthoring.ts` `liveItems` — 「전체」 는 고정 항목, 나머지는 반복 항목).
- **문서 형** — 더하기만 하는 필드 둘: 보기 `facet` · endpoint 조회 형식 `searchParam`. contract 는 74 그대로 (74 문서가 그대로 열린다 — 번호는 Phase 4 의 entry 형 변경과 함께 올린다, R5).

**검색 입력 지연 — 이 Phase 가 찾은 것과 고친 것**:

첫 live 측정에서 검색 글자 입력 → 화면 반영 p95 가 152 ~ 168 ms 였다 (10,000 행 1x). CPU profile (`--check-search --profile-search`) 로 가르니 필터 계산은 키당 6 ms 이고, 나머지는 **결과가 같아도** 치르는 비용이었다: 세션이 창 60 행을 전부 다시 해석 (키당 50 ms) 하고 RAC 가 보이는 행을 다시 렌더 (36 ms). 「Person」 을 치는 여섯 글자는 결과가 같은 10,000 행인데 매번 그 값을 냈다.

- **자리 같은 행은 유지** — `compositionRoot.reorderRows`: 표 상태의 데이터 조각 변경은 어떤 행이 어떤 순서로 보이는지만 바꾸고 행의 내용은 바꾸지 않는다. 창 이동 (`moveRowWindow`) 과 같은 방식으로 자리 · key 가 같은 행의 record 를 유지하되, 행은 다시 읽는다 (창 이동은 읽은 행을 재사용한다 — 그대로 쓰면 검색 결과가 바뀌지 않는다, 구현 중 테스트가 잡음).
- **같은 행 목록 = 같은 collection** — `heldRowWindow`: 행을 읽을 때마다 key 목록이 새 배열이라 RAC 가 다른 collection 으로 보고 보이는 행을 전부 다시 그렸다. 주인 · 시작 · 내용이 같으면 record 가 들고 있던 목록을 그대로 쓴다 → 결과가 같은 검색은 TableBody record 가 바뀌지 않는다.
- **보이는 행 먼저** — `session.stageRowWindows`: 가상 표는 창 60 행 중 보이는 것이 14 행쯤이다. 데이터 조각이 바뀌면 보이는 행 (양쪽 2 행 여유) 만 먼저 해석하고, 나머지 창은 그 frame 이 그려진 뒤에 채운다 (먼저 그린 행의 record 는 유지). paint 전에 다음 글자가 오면 그 frame 을 기다리고, 그 사이 스크롤로 보이는 행이 벗어나면 단계를 끝내고 창 전체를 옮긴다.
- **G0 의 추정이 본 것**: Phase 0 은 「정렬 순서를 유지한 채 거르면 검색 입력은 100 ms 안」 이라고 적었지만 그 측정은 계산 시간만이었다. 화면 반영까지의 시간은 계산이 아니라 행 record · RAC collection 이 정한다.

검색 입력 (이 Phase 의 첫 구현 빌드 · 위 수정 뒤 빌드 교대 3 쌍 — `datagrid-table-vs-tanstack-live.mjs --rows 10000 --check-search`, production · headed Chrome · 원격 collection · 열 6 · 가상 스크롤 · 화면 주사율 50 Hz, Event Timing 의 입력 → 다음 paint, 질의 5 「Person 12」 · 「e」 · 「dept 3」 · 「2026-0」 · 「zzz」 = 25 글자):

| 지표                                | 수정 전         | 수정 뒤         | 중앙값 비율 |
| ----------------------------------- | --------------- | --------------- | ----------: |
| 결과가 같은 글자 1x — 중앙값 (ms)   | 120 · 128 · 128 | 72 · 80 · 80    |        0.63 |
| 결과가 바뀌는 글자 1x — 중앙값 (ms) | 152 · 144 · 160 | 144 · 136 · 136 |        0.90 |
| p95 1x (ms)                         | 168 · 168 · 168 | 144 · 152 · 136 |        0.86 |
| 결과가 같은 글자 4x — 중앙값 (ms)   | 264 · 272 · 264 | 144 · 128 · 136 |        0.52 |
| 결과가 바뀌는 글자 4x — 중앙값 (ms) | 328 · 336 · 336 | 336 · 288 · 296 |        0.88 |
| p95 4x (ms)                         | 376 · 376 · 360 | 376 · 336 · 320 |        0.89 |

- 결과가 바뀌는 글자 = 그 글자로 행 집합이 바뀐 것 (25 글자 중 5 — 「Person 12」 의 `1` · `2`, 「dept 3」 의 `3`, 「2026-0」 의 `0`, 「zzz」 의 첫 `z`: 하니스 행의 값이 이름 「Person N」 · 부서 「Dept N」 · 날짜 「2026-…」 이라 그 앞 글자들은 모든 행에 있다), 나머지 20 글자는 행 집합이 같다. 아무 행도 없는 표에서의 한 글자 (「zzz」 의 둘째 · 셋째) 가 48 ~ 64 ms 다 — 이 환경의 바닥 (50 Hz 화면의 frame 대기 포함).
- **처음의 속도 조건 (p95 ≤ 100 ms, 1x) 은 넘는다 — 136 ~ 152 ms.** 결과가 같은 글자는 그 안 (72 ~ 96 ms) 이고, p95 를 정하는 것은 결과가 바뀌는 글자다. 사용자 결정 (2026-11-20) 으로 바꾼 조건 「정렬 클릭 기준선」 (G0: 1x 154 ~ 169 · 4x 556 ~ 589 ms) 에는 1x · 4x (320 ~ 376 ms) 둘 다 든다.
- **남은 비용의 정체** (수정 뒤 빌드의 profile, 매 글자 결과가 바뀌는 질의 「12345」 — 168 · 128 · 88 · 80 · 48 ms): 키당 CPU 78 ms 중 React 57 ms (render 34 · commit 23) · 세션 21 ms (그중 필터 3 ms). React 의 일은 RAC collection 을 다시 짜는 것이다 — 가상 표는 모든 행을 key 만 가진 RAC Row 로 collection 에 두는데 (ADR-310 행 창), 행 집합이 바뀌면 64 행 묶음이 전부 바뀌어 빈 Row 수천 개가 unmount · mount 된다. collection 의 행 수를 따라간다 (10,000 행에서 처음 좁히는 글자 168 ms, 좁혀진 뒤의 글자 88 · 80 ms, 0 행 표 48 ms) — 정렬 클릭 (기준선 155 ~ 170 ms) 과 같은 부류다.
- **「보이는 행 먼저」 만의 효과** (그 수정만 끈 빌드와 최종 빌드 교대 3 쌍, 같은 질의): 결과가 바뀌는 글자 중앙값 1x 152 · 144 · 152 → 120 · 128 · 136 ms (0.84), 4x 360 · 408 · 368 → 248 · 296 · 280 ms (0.76), p95 1x 176 · 192 · 176 → 144 · 152 · 152 ms. 결과가 같은 글자는 차이 없음 (72 ~ 80 ms — 그쪽은 행 유지 · 목록 재사용의 몫). 정렬 클릭에는 효과가 없다 (아래 HC4 표).
- **Gate 의 「실패 시 대안」 에 대해**: 대안은 「이전 결과에서 좁히기 (했다) · 그래도 넘으면 Phase 7 로」 였다. 그런데 Phase 7 의 Worker 는 계산을 옮기는 것이고 계산은 키당 3 ~ 6 ms 라, Worker 로는 이 지연이 줄지 않는다. 줄이려면 collection 에 두는 행 수 자체 (행 창의 설계 — ADR-310) 를 다뤄야 한다. 그래서 대안을 그대로 따르지 않고 사용자에게 물었다 (아래 「사용자 결정」).

**검사**:

- `collections/view/__tests__/rowFilter.test.ts` 18 — 검색 (여러 필드 · 대소문자 접기 · 빈 검색어 · 한글을 collator 처럼), 열 필터 (타입별 비교 · 「그리고」 · 빈 값 건너뛰기 · `exists`), 유사 등급과 순위, 이어 치기: 무작위 글자 (seed 고정 — 평범한 글자 · 한글 · 섞인 글자 · 악센트 × 로케일 en · ko · tr · fr) 에서 「이어 친 결과 = 처음부터 비교한 결과」 불일치 0, 확실히 빠진 행을 다시 비교하지 않음 (비교 횟수).
- `collections/view/__tests__/facet.test.ts` 8 — 접기 (`A` · `a` · 빈 값) · 후보의 개수 = 그 후보로 거른 행 수 · 자기 조건 제외 · 여러 필드 조건 / 「또는」 묶음 / 표 검색은 유지 · 목록 필드 · `facet` 없는 묶음은 그대로.
- `runtime/__tests__/tableStateSearch.test.ts` 17 — 번역 (검색 = 검색 대상 열의 조건 하나 · 작성 조건과 「그리고」 · 열 조각을 읽지 않음), 같은 번역의 로컬 행 (따로 적은 정답 · 평가기 결과와 일치) 과 요청 (`body` 조건 · `suffix` 검색 파라미터 · 파라미터 없는 `suffix` 는 상태가 검색을 갖지 않음), 실행 자리 판정, 열마다 필터 하나 · 받지 못하는 연산자 제외, 첫 쪽으로, 후보 값 보기는 요청 밖, 유사 검색의 순서.
- `adr315Search.test.tsx` 9 (Preview 세션 + DOM) — 패널 스위치가 넣은 SearchField 로 검색 · 끄면 사라짐, 검색 대상이 아닌 열 제외, 정렬된 행을 거름 · 쪽 · 가상, 작성 검색어로 시작 · 유사, 열 필터 + 검색, 리뷰 round 1 H2 (서버가 쪽을 나누는 표: 검색 파라미터가 있으면 요청에 · 없으면 상태가 검색을 갖지 않음 · 열 필터는 그 연산자의 파라미터로 · `body` 는 조건).
- `adr315FacetItems.test.tsx` 3 — 고르기 컨트롤의 항목이 데이터의 후보 값 (자기 선택으로 줄지 않음 · 다른 컨트롤의 선택으로 좁아짐), 표 열의 후보 값.
- `adr315SearchWindow.test.tsx` 2 — 결과가 같은 검색은 행 record · TableBody record 가 그대로, 자리가 바뀐 행만 새로, 보이는 행 먼저 → paint 뒤 나머지, paint 전에 친 다음 글자, 단계 중 스크롤.
- `runtime/__tests__/tableStateQueryImports.static.test.ts` 6 — 표 상태 모듈이 요청 직렬화 · 행 변환기를 값으로 import 하지 않는다 (아래 번들).
- 변이 RED 31/31 (변이마다 원본 복원 · `cmp` 확인): 검색 23 (첫 필드만 · 유사 등급 누락 · 창 뒤에 거름 · 개수가 결과가 아님 · 검색 대상이 아닌 열을 읽음 · 조건이 보기에 없음 · 검색 파라미터 무시 · 판정이 늘 받음 · 세션이 판정을 안 읽음 · 규칙 Do 미연결 · 입력 지연 없음 · 후보 값이 자기 조건을 유지 · 접지 않음 · 후보 값 보기가 요청에 · 항목이 고정 · 작성 검색어 무시 · 열 필터 중복 · 받지 못하는 연산자 보유 · resolver 가 검색을 버림 …), 입력 지연 수정 7 (행을 전부 다시 해석 · 옛 행을 읽음 · key 목록을 매번 새로 · 단계 없음 · 나머지 창을 채우지 않음 · 단계가 스크롤을 무시 · 세션이 유지 경로를 쓰지 않음), 번들 게이트 1. 처음에 잡히지 않은 2 건 (확실히 빠진 칸의 판정 · 이어 치기의 앞 검색어 조건) 은 악센트 글자 · 무작위 대조를 더한 뒤 RED.

**live (2026-11-20, production 빌드 · headed Chrome · `--check-search` · `--check-search fuzzy` · `--check-facet`, 10,000 행 · 원격 collection · 가상 스크롤)**:

| 단계                                                                                                       | 결과                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder — Collection 구획 「Search」 누름                                                                  | 표 앞에 SearchField · 규칙 하나 (`onChange` → Table 의 `setSearchText`)                                                                                                                                                                |
| Publish — 검색 칸에 질의 5 를 한 글자씩                                                                    | 보이는 첫 8 행과 행 수 (`aria-rowcount`) 가 하니스의 행 생성기로 따로 계산한 값과 일치 — 258 · 10,000 · 857 · 7,468 · 0 행, CPU 1x · 4x 둘 다                                                                                          |
| 검색 칸 비움                                                                                               | 처음의 행으로 돌아옴                                                                                                                                                                                                                   |
| 패널 「Search match」 = Fuzzy                                                                              | 문서 prop `searchMatch: "fuzzy"` · 「prsn 12」 1,239 행 · 「dpt 3」 857 행 (「dept 3」 의 「포함」 결과와 같은 수) — 유사 검색은 동작 확인이고 정답 대조는 unit 이 한다                                                                |
| Builder — 「검색 · 필터」 구획 「Add search」 → 필드 `city` · 컨트롤 RadioGroup → Create (`--check-facet`) | 새 RadioGroup 이 `facet` 보기 (`groupBy: city`) 에 연결 · Publish 항목 51 (「All」 + 도시 50 종 — 집합이 따로 계산한 것과 같음, 옛 표본 상한 20 초과) · 「City 7」 을 고르면 표 10,000 → 193 행 (따로 센 값과 일치) · 항목은 51 그대로 |

콘솔 오류 0. 사용자 Chrome 의 CPU 4x 에서는 보지 않았다 (하니스의 4x 는 CDP throttle).

**회귀**: shared 2,691 통과 · builder 9,385 통과 — 실패 7 · 12 건은 Phase 2 종결 때와 같은 목록 (목록 대조 `diff` 0). 새 실패 0.

**속도 (HC4)** — Phase 2 빌드와 Phase 3 빌드를 교대 3 쌍으로 쟀다 (검색을 켜지 않은 같은 문서, `--rows 10000`, 조건은 Phase 2 표와 같음):

| 지표                                  | Phase 2 빌드          | Phase 3 빌드          | 중앙값 비율 |
| ------------------------------------- | --------------------- | --------------------- | ----------: |
| 로드 (ms)                             | 400 · 404 · 386       | 418 · 404 · 393       |       1.010 |
| 힙 (MB)                               | 153 · 153 · 153       | 153 · 153 · 154       |       1.000 |
| 정렬 클릭 1x — 숫자 열 (ms)           | 176.9 · 179.3 · 161.6 | 179.9 · 188.8 · 173.4 |       1.017 |
| 정렬 클릭 1x — 글자 열 (ms)           | 185.9 · 187.1 · 168.6 | 183.6 · 196.3 · 181.5 |       0.988 |
| 스크롤 p95 1x (ms)                    | 21.9 · 21.9 · 21.9    | 20.1 · 20.1 · 20.1    |       0.918 |
| 스크롤 main thread 일 / frame 1x (ms) | 8.16 · 8.32 · 8.27    | 8.16 · 8.17 · 8.24    |       0.988 |
| 정렬 클릭 4x — 숫자 열 (ms)           | 597.2 · 601.9 · 583.6 | 621.1 · 627 · 642     |       1.050 |
| 정렬 클릭 4x — 글자 열 (ms)           | 618 · 610.4 · 532.6   | 592.7 · 647.1 · 576.4 |       0.971 |
| 스크롤 p95 4x (ms)                    | 81.8 · 81.8 · 81.6    | 80.8 · 81.7 · 81.7    |       0.999 |
| 스크롤 main thread 일 / frame 4x (ms) | 27.6 · 27.87 · 28.08  | 28.4 · 27.57 · 27.91  |       1.001 |

- 전부 ≤ 1.10. 정렬 클릭은 빨라지지 않았다 — 정렬은 모든 행의 자리가 바뀌어 유지할 행이 없고, 비용은 collection 재구성이다 (위와 같은 부류). 「보이는 행 먼저」 는 나머지 창을 paint 뒤에 한 번 더 해석하므로 클릭당 main thread 일의 합은 4x 숫자 열에서 1.078 이다 (화면 반영 시간은 1.05).

**번들** (`vite build` + closure, Phase 2 대비): Builder initial JS gzip 1,587,798 → 1,592,410 B (+4,612) · Preview 171,811 → 171,810 B (−1). 사용자 결정 6 의 범위 (Builder +8,000 · Preview +6,000) 안.

- **이 측정이 잡은 것**: 처음 잰 값은 Builder +10,589 B 였다 (범위 초과). `tableStateQuery.ts` 가 접미사 표 · 검색 조건 id 를 요청 직렬화 모듈 (`view/serialize.ts`) 에서 값으로 import 해, 패널이 첫 화면에서 읽는 그 모듈을 따라 직렬화기와 행 변환기 (`normalizeRows` · `outgoing` · `parseJsonLossless` — ADR-313 이 첫 화면 밖에 두는 것) 6,082 B 가 초기 번들로 들어왔다. 접미사 표를 의존 없는 모듈 (`view/querySuffixes.ts`) 로 떼고 정적 게이트를 두었다.

**Gate G3**: 전체 검색 · 열 필터 · 후보 값 (자기 필터 제외) 이 따로 적은 정답과 일치 · 한글 자모 · 로케일 무작위 대조 0 불일치 · live · 검색 입력 p95 ≤ 정렬 클릭 기준선 (136 ~ 152 ms ≤ 154 ~ 169 ms, 4x 320 ~ 376 ≤ 556 ~ 589 ms) — 통과. 처음의 기준 100 ms 는 넘었고 (결과가 같은 글자 72 ~ 96 ms · 결과가 바뀌는 글자 136 ~ 144 ms), 사용자가 기준을 바꿨다 (아래).

**달라진 동작 (사용자에게 보이는 것)**:

- Table 에 「Search」 스위치 (Collection 구획) · 「Search text」 · 「Search match」 (Behavior 구획), Column 에 「Searchable」. 기본은 전부 지금의 표와 같다.
- 「검색 · 필터」 구획에서 새로 넣는 고르기 컨트롤의 항목이 데이터의 모든 값이다 (전에는 넣는 순간의 표본 20 개가 고정 항목으로).
- endpoint 조회 형식 (`suffix`) 에 「표 검색어」 칸.
- 가상 스크롤 표의 정렬 · 검색 직후 한 frame 동안 보이는 행 밖의 행은 빈 행이다 (다음 frame 에 채워진다 — 스크롤 중 창 이동과 같은 모양).

**이 Phase 에서 하지 않은 것 (범위 안 — 사후 보고)**:

- **열 필터의 조작 자리**: 열 메뉴 「필터」 (§5.2) 와 열 필터를 쓰는 Do 는 열 메뉴가 들어오는 Phase 4 에서. 지금 열 필터는 상태 · 번역 · 실행 · 서버 판정까지이고 쓰는 길은 `session.setTableState` 다. `session.tableFacet` 의 소비처도 그 메뉴다.
- **스위치 막기**: 검색을 받지 못하는 endpoint 의 표에서 「Search」 스위치를 비활성으로 두지 않고 사유 한 줄을 낸다 (Phase 2 의 「Multi-column sort」 와 같은 방식 — 상태가 검색을 갖지 않아 실행은 안전하다).
- **이미 넣은 고르기 컨트롤**: 후보 값 연결은 새로 넣는 컨트롤부터다. 전에 넣은 컨트롤의 고정 항목은 그대로 둔다 (문서 변환 없음 — HC6).
- **표 상태의 변수 노출**: 검색어는 Table 의 `searchText` 로 읽고 쓴다 (유도 Do). 표 상태 전체를 변수로 읽는 것 (§4.2) 은 조각이 다 들어온 뒤 (Phase 4 ~ 6) 에 한 번에.
- **「더 보기」 · 「쪽」 표의 입력 지연**: 측정과 수정은 가상 스크롤 표다. 「더 보기」 표는 창 100 행이 전부 record 라 자리 같은 행 유지만 받는다 (보이는 행 먼저는 가상 표의 것).

**이 Phase 가 닿은 사용자 결정**: 2 (유사 검색 — 「표마다 선택, 기본 포함」 으로 확정) · 6 (번들 — 범위 안) · G3 속도 기준 (아래).

**사용자 결정 (2026-11-20, 종결 때 질문)**: G3 의 검색 입력 속도 — 결과가 바뀌는 글자의 136 ~ 152 ms 는 RAC collection 재구성 비용이고 Worker (Phase 7) 로는 줄지 않는다. 선택지 셋 — (가) 기준을 정렬 클릭 기준선으로 맞춘다 (HC4 가 열 조작에 쓰는 상한), (나) collection 에 두는 행 수를 줄이는 설계를 Phase 7 에 더한다 (행 창 — ADR-310 의 설계를 건드린다), (다) 지금대로 Phase 7 에서 측정만 다시 한다 — 가운데 사용자가 **(가)** 를 골랐다. 본문 HC4 · G3 의 문구를 그에 맞췄다.

(다음 Phase 의 기록은 여기에 이어 적는다)
