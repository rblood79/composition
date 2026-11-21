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

### Phase 4 (2026-11-21 — G4 통과, 미해결 1 건은 사용자 결정으로 Phase 7)

**착수 조사 — 열이 지나던 길 (실측)**: resolver 는 데이터에 연결한 Table 에서만 표 상태를 읽었다 (`resolver.ts` 의 `boundTableState` — 연결하지 않은 Table 은 상태를 전혀 읽지 않음). 세션의 열 목록 (`tableColumns`) 은 해석된 record 의 머리글이라 그리지 않는 열을 알 수 없었고, 열 조각이 바뀌어도 다시 해석하는 길이 없었다. 폭 조절의 끝을 받는 자리 (`onResize` · `onResizeEnd`) 와 가상 layout 의 고정 열 훅 (`isStickyColumn`) 은 없다. Column ↔ Cell 대응은 「자리 순서」 뿐이다 (resolver 에 대응 함수 없음 — 작성 명령 쪽 `tableColumnGrid` 는 draft 기반).

**증분 1 — 열 숨김 · 순서 투영 (끝, `df1528d82`)**:

- **투영 한 곳** — `resolution/tableColumns.ts` `catalogProjectTableColumns`: resolver 가 Table 을 해석한 뒤 (연결 여부와 무관) 머리글의 Column 과 모든 Row 의 Cell 을 같은 순서 [선택 열 · 앞 고정 · 가운데 (`columnOrder` — 적힌 열 먼저, 나머지는 작성 순서) · 뒤 고정] 로 다시 세우고 숨긴 열을 뺀다. 행은 그 전에 모든 작성 열로 읽는다 — 숨긴 열도 검색 · 정렬 · 필터된다 (§4.4). RAC 불변식: 걸친 Cell (`colSpan`) 이 덮는 열은 한 덩어리로 숨고 · 옮겨지고 · 고정된다 · 행의 칸 수가 머리글과 맞지 않는 Table 은 그대로 둔다 · row header 열이 전부 숨으면 마지막 하나가 남는다. 창 이동의 유지 행 (자리표시자) 은 건드리지 않는다.
- **접힌 층**: 해석된 Column · Cell · Row 는 instance 와 template root 가 한 record 다 (root 의 `collapseLayers` — Row instance 는 [빈 root, 자기 Cell …] 을 자식으로 갖는다). 투영은 그 규칙대로 읽고, 순서를 바꾼 자식은 가장 바깥 층에 다시 둔다 (구현 중 실측 — 안쪽 층만 읽으면 칸이 0 개로 보여 투영이 조용히 꺼졌다).
- **record 에 적는 것 둘** — Table record `_tableColumns` (작성된 데이터 열 전부의 JSON 글자: key · 자리 · row header · 작성 기본값 · 정렬 · 검색 옵션 — 같은 열이면 같은 글자라 record 비교가 그대로) 과 Column record `_columnPlace` (작성 자리 — 이름 없는 열의 기본 key `column3` 이 그려진 자리와 무관). 열 key 자체는 적지 않는다: 적었더니 key 편집 (`catalogColumnKeyRenameCommands`) 이 낡은 key 를 읽어 이름 변경이 안 됐다 (회귀 2 건으로 잡음). 세션은 그려진 열을 자리로 맞대 그 record 의 지금 값을 읽고, 그리지 않는 열만 목록의 값을 쓴다.
- **작성 기본값** — Column 「Hidden by default」 (`defaultHidden`, composition 확장 — `default*` 라 유도 Do 없음). 상태에 그 조각이 없으면 기본값, 있으면 그 목록이 전체다 (빈 목록 = 전부 보임 — 작성 기본값과 같은 목록은 조각 없음으로 접는다, `tableState.ts`).
- **Canvas 와 Preview 의 차이 하나**: Preview · Publish (표 상태 source 가 있는 root) 는 숨긴 열을 record 에서 뺀다 (RAC collection = 보이는 열). Builder 의 Canvas 는 숨긴 열을 record 로 남기고 `_columnHidden` 으로 표시한다 — 그리지 않고 (`catalogHiddenAtRest`) 트랙에도 없지만 (`catalogTableRowTracks`), 작성자가 Layers 에서 그 Column 을 골라 스위치를 끌 수 있다. live 에서 찾은 것: 빼 버리면 Layers 의 그 줄이 아무것도 고르지 못했다.
- **증분 해석과의 경계** (live 에서 찾은 것): 연결하지 않은 Table 은 Column 편집이 Column record 만 다시 해석해 Table 의 투영이 다시 돌지 않았다 (스위치를 켜도 Canvas 에 열이 남음). Column 의 투영 prop (`defaultHidden` · `defaultPinned` · `isRowHeader`) 편집과 숨긴 record 의 편집은 구조 경로로 보낸다 (`compositionRoot.touchesTableRows`).
- **세션**: `setTableState` 가 열 조각 (숨김 · 순서 · 고정) 변경 뒤 `root.reprojectColumns` 를 부른다 — 마지막으로 읽은 행을 그대로 쓰고 행 source 를 부르지 않는다 (HC4, 호출 수 0 을 테스트가 막음). `tableColumnsNow` (지금 숨긴 · 고정한 열). 기억한 열 조각은 복원 때 바로 투영한다 (Publish 는 복원 뒤 다시 해석하는 일이 없다).
- **검사**: `resolution/__tests__/tableColumns.test.ts` 12 (따로 적은 나무 — 숨김 · 순서 · 고정 순서 · 작성 기본값 · row header · colSpan 덩어리 · 어긋난 행 · 유지 행 · 접힌 층 · Builder 의 숨김 표시) · `adr315Columns.test.tsx` 8 (세션 + DOM — 숨김 · 순서 · 행 source 0 · 숨긴 열 검색 · 정렬 · 가상 · 작성자 key 편집 뒤 목록 · Canvas 기본값 · 연결 안 한 Table · Table 자신의 값 편집) · `adr315RememberState.test.tsx` +1. 회귀 새 실패 0 (shared 2,703 · builder 9,394 통과). 변이 RED 는 아직.
- **live (2026-11-20, dev 서버 · Chrome MCP · 새 프로젝트)**: 놓은 Table (연결 없음) 의 Type Column 을 Layers 에서 골라 「Hidden by default」 누름 → Canvas 머리글 Name · Status (트랙 다시 나뉨) · Layers 에서 숨긴 Column 다시 고름 (Design 패널에 그 Column) → 끔 → Type 돌아옴 → 켬 → 사라짐 · Publish 새 탭 머리글 `[Name, Status]` · 행 `[Item 1, Active]` · 콘솔 오류 0.
- **아직 안 한 것** (→ 아래 「증분 1 의 남은 것」 에서 끝): Layers 에 숨긴 Column 표시 · 가상 표에서 열 변경 때 빈 행 key (칸 span 서명) 가 바뀌어 전부 다시 mount 되는 비용 측정 (HC4).

**증분 2 — 열 고정 (끝, `df1528d82`)**:

- **표시**: 투영이 고정 열의 Column · Cell record 에 쪽 (`_pinned` — `start` · `end`) · 그 쪽 끝에서의 자리 (`_pinnedAt`) · 쪽의 경계 (`_pinnedEdge` — 앞 고정의 마지막 열, 뒤 고정의 첫 열) 를 적는다. 앞 고정이 있으면 선택 열도 앞 고정에 든다 (선택 열이 고정 열 앞에서 밀려나지 않게). DOM 은 `data-pinned` · `data-pinned-at` 과 inline `--table-pin-at: var(--table-pin-<쪽>-<자리>, 0px)` 을 낸다.
- **폭 재기**: 고정 열 앞에 선 고정 열들의 폭을 표에 `--table-pin-start-<n>` · `--table-pin-end-<n>` 으로 적는다 — 고정된 Column 안의 `CatalogTablePinMeasure` 가 자기 머리글을 ResizeObserver 로 보고 표 전체의 값을 다시 쓴다 (트랙이 `minmax(75px, 1fr)` 같은 CSS 라 px 는 그려진 뒤에야 안다). 처음 둔 표 수준 hook 은 지웠다 — 고정 열이 없는 표는 아무것도 재지 않는다.
- **가상 표** (S1 의 넷 + live 에서 찾은 셋): `CatalogTableLayout` 의 `isStickyColumn` · 머리글 · body `allowOverflow` · 끝 고정 칸을 만들도록 `requestedRect` 넓히기는 S1 그대로다. 끝 고정은 S1 의 「flex 행 + `::before` 채움」 이 제품에서 맞지 않았다 — 제품의 Row 는 Column 트랙의 grid 다. 그래서 끝 고정 감싸개를 그 grid 의 끝 트랙에 세운다 (`grid-column: -2 / -1`, 자리마다 한 칸씩 앞으로). live 에서 찾은 것:
  1. 가상 표의 머리글 행은 `tr` 이 아니라 grid 가 아니었다 — 고정 열이 있는 표의 머리글 행을 Column 트랙의 grid 로 둔다 (끝 고정이 설 트랙이 생기고, 상자가 트랙 폭이 된다).
  2. sticky 상자는 부모 상자 안에서만 붙는다 — 행 상자가 스크롤 영역 폭이라 그 밖의 칸은 행과 같이 떠났다. 고정 열이 있는 표의 행 · 머리글 행은 `min-width: min-content`.
  3. RAC 는 머리글 칸을 앞 열이 위에 오게 쌓는다 (`zIndex` 가 열마다 준다) — 끝 고정 머리글이 앞 열 아래에 그려졌다. 고정 감싸개는 맨 위.
     그리고 RAC 감싸개 (`role=presentation`) 가 표 바탕을 물려받게 했다 — 바탕 없는 고정 칸 뒤로 지나가는 칸의 글자가 비쳤다.
- **비가상 표**: CSS sticky (`inset-inline-start` · `-end: var(--table-pin-at)`) + 위 2 (행 폭).
- **경계선 = rule (D3)**: Column · Cell rule 의 `pinned-edge` 블록 (`start` = 끝에 1px · `end` = 시작에 1px, 색은 S2 `showDivider` 의 `--border` — composition 확장: S2 TableView 에는 열 고정이 없다). 조건은 파생 variant prop `pinnedEdge` (`presence.ts` 가 투영 표시에서 — `derivedVariantProps.ts`) 라 Canvas 와 DOM 이 같은 rest 값 (`catalogDerivedRestVisual`) 을 읽는다. Column · Cell 은 생성 시트가 없어 DOM 은 inline 으로 싣는다. live 에서 찾은 것 둘: 머리글 칸은 Table 의 part rule 이 옆 폭 0 을 주어 (아래 선만) 경계선이 덮였다 — 경계 폭이 그 part 값 위에 선다. 그리고 한쪽 폭만 있는 inline 테두리는 나머지 변이 CSS 기본 `medium` 으로 그려졌다 (고정 칸이 3px 틀에 갇힘) — 상자 폭 없이 한쪽 폭만 쓴 칸은 나머지 변을 0 으로 낸다 (Cell `showDivider` 도 같은 길).
- **작성 기본값** — Column 「Pinned」 (`defaultPinned`: none · start · end, composition 확장). 상태 조각이 작성 기본값과 같으면 조각 없음으로 접는다 (기억하는 것은 읽는 사람이 바꾼 것만).
- **검사**: `tableColumns.test.ts` (고정 순서 · 자리 · 경계 · 선택 열) · `adr315Columns.test.tsx` (DOM 표시 · inset · 폭 변수 · 경계선 · 나머지 변 0 · Canvas 파생값 · 작성 기본값 접기). 변이 RED 16/16 (증분 1 은 14/14). 회귀 새 실패 0 (shared 2,703 · builder 9,395 통과 — 기존 실패 7 · 12 그대로). 번들 (Phase 3 대비, 증분 1 + 2): Builder 초기 JS gzip +3,799 B · Preview JS −1 B · Preview CSS +271 B.
- **live (2026-11-20)**: production 빌드 + Playwright (`--check-pin`, 2,000 행 · 열 여섯 400px · Dept 앞 고정 · Date 뒤 고정 · 가로 700 스크롤) — 가상 · 비가상 × Chrome · WebKit 네 조합 모두 머리글 · 칸의 Dept 왼쪽 끝 · Date 오른쪽 끝 유지, 고정하지 않은 열은 밀려 남, 경계선 1px 은 고정 쪽 끝 열에만. dev 서버 Builder (Chrome MCP): Status Column 의 「Pinned」 를 Start 로 → Canvas 머리글 [Status · Name] 과 Status 끝 경계선, Preview 탭에서 Status 머리글 · 칸이 sticky + 오른쪽 1px · Name 은 0 · 콘솔 오류 0.

**증분 3 — 폭을 상태로 (끝, `df1528d82`)**:

- **쓰기**: 크기 조절 Table 의 RAC `ResizableTableContainer` `onResizeEnd` (px 로 놓인 열만 — 끈 열 뒤의 `fr` · `%` 열은 지킬 폭이 아니다) → 세션 `resizeTableColumns` 가 RAC key 를 Column key 로 바꿔 `columnWidths` 에 더한다. 열 조각이라 행을 읽지 않고 (HC4) 다시 해석하지도 않는다. 「Remember state」 Table 은 다른 열 조각처럼 브라우저에 남는다.
- **읽기**: 크기 조절 Column 의 `defaultWidth` = 상태의 폭이 있으면 그것, 없으면 문서 폭 (`tableColumnWidths` — RAC key 로). RAC 의 폭 상태는 처음 받은 폭을 지키므로, 끌기 밖에서 바뀐 폭 (규칙 · 기억 복원 · 초기화) 은 세션이 Table record 에 runtime prop `_widthsRevision` 을 올려 Table 을 다시 만든다. 끌기가 남긴 폭은 RAC 것이 이미 같아 다시 만들지 않는다 (스크롤 · focus 를 잃지 않게 — 테스트가 echo 수로 막음).
- **검사**: `adr315RememberState.test.tsx` +1 (끝난 폭 → 상태 · 기억 · RAC key 대응 · echo 0 → 다음 세션의 트랙 260px → 초기화 echo 1). 변이 RED 6/6. 회귀 새 실패 0 (shared 2,703 · builder 9,396 통과).
- **live (2026-11-20, production 빌드 + Playwright `--check-resize`)**: Name 열 「Allow resizing」 + Table 「Remember state」 → Publish 에서 머리글을 hover 해 손잡이를 120px 끌기 → 150 → 270px · 브라우저에 `{"columnWidths":{"name":270}}` → 새로고침 뒤 270px. 가상 · 비가상 × Chrome · WebKit 네 조합 PASS.
- **본 것 (기존, 이 증분 밖)**: S2 손잡이 (12px, 열 끝에 걸침) 의 뒤쪽 절반은 다음 열 머리글 아래에 있어 잡히지 않는다 (`elementFromPoint` 가 다음 머리글) — 손잡이 앞쪽 절반만 끌린다. ADR-257 Phase 4 의 손잡이 쌓임 문제로, 열 메뉴의 「크기 조절」 (증분 4) 과 같이 본다.

**증분 4 착수 조사 — 열 메뉴가 서는 조건 (실측, 코드 변경 전)**: 지금 메뉴는 크기 조절 Column 에만 있다 (S2 `isMenu` = `allowsResizing || menuItems` 중 앞쪽만). 그 모양이 `allowsResizing` prop 하나에 세 곳에서 묶여 있다 — Column rule 의 `allows-resizing` variant (옆 여백 0 · 감싸개 16), Table 의 part rule (`manualBoxRules` — `childProps: { allowsResizing: true }` 의 끝 선), `presence.ts` `catalogColumnMenuContent` (내용 감싸개를 메뉴 Button 으로). 숨김 · 고정 · 이동 항목을 크기 조절하지 않는 열에도 내려면 이 셋이 「메뉴가 있는 열」 이라는 한 조건을 읽어야 하는데, part rule 은 resolver 가 열 투영 전에 적용하고 그 조건은 Table 의 스위치 (자식 Column 의 prop 이 아님) 에 달려 있다. 그래서 증분 4 는 (4a) 「메뉴가 있는 열」 조건을 한 곳 (Table 스위치 → Column record 파생, part rule · variant · DOM 이 같이 읽음) 으로 세우고 Canvas 모양까지 S2 `isMenu` 로 맞추기 → (4b) 메뉴 항목 (정렬 · 정렬에 추가 · 숨기기 · 고정 · 이동 · 크기 조절 — 세션 한 곳이 항목과 동작을 낸다) → (4c) 필터 항목 · `tableFacet` → (4d) 열 선택 메뉴 · 유도 Do 순서로 한다. 항목 목록과 조각 쓰기는 HC5 에 따라 열 메뉴를 쓰는 표에서만 읽는 lazy chunk 다.

**증분 4a — 「메뉴가 있는 열」 조건 한 곳 (끝, 미커밋)**:

- **조건**: `catalogColumnHasMenu` (`resolution/tableColumns.ts`) — Column 의 크기 조절 · 숨기기 · 고정 허용, 또는 Table 의 「Reorder columns」. 정렬만 허용한 열은 메뉴가 없다 (누르면 정렬 — S2 도 정렬 열을 `ColumnWithMenu` 로 만들지 않는다). 메뉴가 있는 열은 정렬도 메뉴에서 한다. 선택 checkbox 열은 늘 없다.
- **한 값**: resolver 가 Column 을 해석할 때 (`applyColumnMenu`, `overflowMode` 처럼 머리글 너머 Table 을 읽음) S2 이름 그대로 `isMenu` 를 props 에 적는다 — rule 의 `is-menu` 블록 (옆 여백 0 · 감싸개 16, 전에는 `allows-resizing`), Table part rule 의 끝 선 (`childProps: { isMenu: true }`), ⋮ 아이콘 · 메뉴 Button (`presence.ts` · DOM) 이 모두 이 값을 읽는다. 파생 variant (`pinnedEdge` 의 길) 로 두지 않은 이유: 감싸개의 여백은 자식 part rule 이고 끝 선은 Table 의 part rule 이라 resolver 단계의 prop 이어야 둘 다 닿는다.
- **새 prop** (composition 확장, 기본 꺼짐 — `d2Provenance.ts`): Column 「Allow hiding」 (`allowsHiding` — TanStack `enableHiding`) · 「Allow pinning」 (`allowsPinning` — `enablePinning`), Table 「Reorder columns」 (`allowsColumnReordering`). `isMenu` 는 resolver 의 것 (`editorHidden` — 패널 · 유도 Do 없음).
- **live 에서 찾은 것**: Table 스위치를 바꿀 때 그 Column 들만 다시 해석하면 (처음 둔 재큐) 열 투영이 빠져 「Hidden by default」 Column 이 Canvas 에 다시 보였다 — 증분 1 의 「Column 편집은 구조 경로」 와 같은 기제. 스위치 편집도 구조 경로 (`touchesTableRows`) 로 보낸다 (회귀 테스트가 옛 재큐로 RED).
- **검사**: `s2TableViewStructure.test.tsx` +2 (Canvas — 숨기기 · 고정 · Table 스위치마다 같은 모양, 정렬만은 없음, 선택 열 제외 · 스위치 켜고 끄고 숨긴 열 자신의 허용 값을 바꿔도 숨김 유지) · `adr257TableOperations.test.tsx` +1 (DOM — 크기 조절 없는 메뉴 열: 손잡이 · 크기 조절 항목 없음, 여백 0 · 끝 선 1, Table 스위치). 변이 RED 12/12 + 재큐 원복 RED 1.

**증분 4b — 메뉴 항목 (끝, 미커밋)**:

- **한 곳**: `runtime/tableColumnMenu.ts` — 항목 (`catalogColumnMenuItems`) 과 각 항목이 쓰는 조각 (`catalogColumnMenuPatch`) 을 같은 입력 (열의 허용 값 · Table 의 shape · 상태) 에서 낸다. 세션이 감싸고 (`tableColumnMenu` · `runTableColumnMenu` — 쓰기는 `setTableState` 하나), DOM 은 열릴 때 항목을 읽어 그리고 누른 id 만 넘긴다 (크기 조절만 RAC 의 `startResize`). 세션 밖 (Builder DOM) 은 S2 의 정렬 · 크기 조절 두 항목 그대로.
- **항목** (허용하지 않은 조작은 없음, 지금 할 수 없는 것은 꺼짐): 오름차순 · 내림차순 (그 열 하나로) · 정렬에 추가 (여러 열 정렬을 받는 Table 에서 정렬이 있고 이 열은 없을 때, 최대 수 아래 — 열의 첫 방향으로 끝에) · 열 숨기기 (마지막 row header 면 꺼짐) · 앞에 고정 · 뒤에 고정 · 고정 해제 (지금 쪽에 따라) · 왼쪽 · 오른쪽으로 이동 (자기 묶음 안 — 고정 쪽이면 그 쪽 목록, 아니면 `columnOrder`; 숨긴 열은 자리만 지키고 넘을 이웃이 아니다, 이웃이 없으면 꺼짐) · 열 크기 조정. 고정은 가운데 쪽에 붙는다 (앞 쪽의 끝 · 뒤 쪽의 처음). 문구: S2 intl 에 있는 셋은 그대로, 나머지는 composition 문구 (en · ko · ja · zh), 이동은 화면 방향 (RTL 이면 좌우를 바꿔 부름).
- **바뀐 동작 하나**: 세션이 있는 메뉴의 정렬은 RAC `sort(direction)` 가 아니라 상태의 정렬을 그 방향으로 정한다 — 전에는 Phase 2 의 누름 순환 (`pressTableSort`) 을 지나 「내림차순」 을 처음 눌러도 오름차순이 됐다.
- **한계 (기록)**: colSpan 이 덮는 열 묶음은 투영에서 한 덩어리지만 메뉴 이동은 그 묶음을 모른다 (shape 에 묶음이 없다) — 묶음의 한 열을 옮기면 묶음의 자리는 묶음 안 열 중 가장 앞 순서를 따른다. RTL 이동 문구는 테스트가 없다.
- **검사**: `tableColumnMenu.test.ts` 5 (허용 · 정렬에 추가와 최대 수 · 숨긴 이웃 · 고정 쪽 이동 · 작성 기본값) · `adr315Columns.test.tsx` +1 (실제 DOM 메뉴 — 항목 목록 · 꺼짐 · 오른쪽 이동 뒤 머리글 · 칸 · 앞에 고정 · 고정 해제 · 내림차순 aria-sort · 숨기기, 콘솔 오류 0). 변이 RED 12/12.
- **live (2026-11-20, dev 서버 · Chrome MCP · 「adr315-p4-check」)**: Table 「Reorder columns」 → Canvas 두 열에 ⋮ · 끝 선 · 「Hidden by default」 Type 유지 (새로고침 뒤). Name 에 정렬 · 숨기기 · 고정 · 크기 조절 허용 → Publish 의 Name 메뉴 8 항목 (숨기기 꺼짐 = 마지막 row header, 이동 꺼짐 = 이웃 없음) · Status (앞 고정 하나) 메뉴 = 이동 둘 다 꺼짐 → Name 앞에 고정 → 「왼쪽으로」 → 머리글 [Name · Status] → 고정 해제 → [Status · Name] → 내림차순 → Name `aria-sort=descending` · 콘솔 오류 0. ledger 기록은 하지 않았다 (현재 run 이 다른 ADR 의 것) — 증거 화면은 ADR-315 run 폴더 `artifacts/phase4-menu-*.jpg`.

**증분 4c — 열 메뉴 「필터」 · 후보 값 소비 (끝, 미커밋)**:

- **허용**: Column 「Allow filtering」 (`allowsFiltering` — TanStack `enableColumnFilter`, composition 확장, 기본 꺼짐). `catalogColumnHasMenu` 에 더해 이 열도 메뉴 Button 이 된다. §6 표의 Table 「Column filters in menu」 는 두지 않았다 — 숨기기 · 고정처럼 열마다 허용하면 표 수준 스위치는 같은 일을 두 번 적는다 (사후 보고).
- **항목** (`tableColumnMenu.ts`): 정렬 항목 뒤에 「필터…」 (`filter` — 그 열이 지금 쓸 수 있는 비교가 없으면 꺼짐: 데이터에 연결하지 않은 표 · 필드가 아닌 열) 와 「필터 지우기」 (`clear-filter` — 그 열에 필터가 있을 때만, 그 열의 것만 뺀다). 쓸 수 있는 비교 = 필드 종류의 비교 (`VIEW_COMPARISONS_BY_KIND`) 중 행 요청이 담는 것 (`shape.filters` — 세션이 `columnMenuInput` 에서 `filterOps` 로).
- **대화상자 쓰기 한 곳**: `catalogColumnFilterPatch` — 그 열의 필터를 제자리에서 바꾸거나 (열마다 하나 — 순서 유지), 값이 비어 건너뛰는 조건 (`viewConditionSkips`) 이면 뺀다. 내지 않은 비교는 쓰지 않는다. 세션 `tableColumnFilter` (필드 종류 · 비교 · 지금 필터 · 후보 값 `tableFacet`) · `setTableColumnFilter` → `setTableState` 하나.
- **대화상자** (`tableColumnFilter.components.tsx` — 처음 열 때 불러오는 lazy chunk, HC5): 「필터…」 를 누르면 메뉴가 닫힌 뒤 메뉴 Button 자리에 Popover > RAC Dialog. 조건 Select (생성 시트의 picker 모양 — `data-variant=secondary` · `data-picker`), 값 (필드 종류의 input — 숫자 · 날짜, 「사이」 는 시작 · 끝 (빈 끝은 열림), 「최근 기간」 은 단위), 후보 값 ListBox (「같음」 · 「같지 않음」 은 하나를 골라 값을 채우고, 「그 중 하나」 · 「하나라도 포함」 · 「전부 포함」 은 여럿을 고른다 — 값 순서로 정렬, 빈 값은 끝, 20 개 넘으면 값 검색, 200 개까지 보이고 나머지는 「N 개 더」, 불러온 행 기준이면 그 표시). 항목의 이름과 행 수는 RAC `slot=label` · `description` (이름이 「Dept 3412」 로 붙어 읽히지 않게 — live 하니스를 쓰다 찾음). 입력 → 조건 변환은 `tableColumnFilterDraft.ts` (숫자로 읽히지 않는 글자 · 빈 값 = 건너뛰는 조건 → 쓰기가 필터를 뺀다). 시작 비교: 글자 「포함」 · 목록 「하나라도 포함」 · 그 밖 「같음」 (그 열이 내지 않으면 첫 비교). 문구 en · ko · ja · zh.
- **live 에서 찾은 결함 (Phase 3 의 것)**: 원격 collection 표의 후보 값 개수가 전부 0 이었다. endpoint 가 채우는 collection 의 묶음 보기는 `loaded.complete` 가 없으면 집계를 「데이터의 일부」 로 표시해 개수가 `"13+"` 글자가 되고 (`dataBinding.ts` `partialAggregates`), `tableFacet` 이 그 글자를 `Number(…) || 0` 으로 읽었다. Phase 3 의 `--check-facet` 은 후보 값의 집합만 봐서 지나쳤다. 수정: 후보 값은 정의상 불러온 행의 것이므로 `tableFacet` 이 `partial` 을 먼저 정해 `loaded: { complete: !partial }` 로 넘기고, 개수는 정수 부분을 읽는다. 회귀 `adr315FacetItems.test.tsx` +1 (원복 RED).
- **검사**: `tableColumnMenu.test.ts` +3 · `tableColumnFilterDraft.test.ts` 2 · `adr315Columns.test.tsx` +2 (실제 DOM — 메뉴 → 대화상자 → 「포함」 적용 · 숫자 열 후보 값 (자기 필터 제외 · 개수) 을 골라 적용 · 다시 열면 지금 필터 · 「필터 지우기」 · 연결 안 한 표는 꺼짐) · `adr315FacetItems.test.tsx` +1. 변이 RED 15/15 (항목 없음 · 꺼짐 없음 · 지우기 무동작 · 제자리 아님 · 빈 값 유지 · 비교 검사 없음 · 세션이 필드를 안 봄 · 후보 값 없음 · `isMenu` 조건 누락 · 메뉴가 대화상자를 안 엶 · 숫자 변환 없음 · 시작 비교 · 후보 선택이 값을 안 채움 · 지금 필터 무시 · runtime 통로 누락) + 후보 값 개수 원복 RED 1. 회귀 새 실패 0 (shared 2,713 · builder 9,402 통과 — 기존 실패 7 · 12 그대로). type-check PASS. 번들 Δ 는 Phase 4 검증에서 한 번에 잰다 (대화상자는 별도 chunk `tableColumnFilter.components-*.js` 로 빠짐을 확인).
- **live (2026-11-20, production 빌드 + Playwright `--check-filter --column-origin`, 2,000 행 원격 collection, en-US)**: Publish 에서 Dept 메뉴 [정렬 둘 · 「Filter…」] → 시작 비교 「Contains」 → `dept 1` 적용 455 행 → Amount 「At least」 5000 적용 236 행 → Dept 다시 열기 (값 `dept 1` 그대로 · 메뉴에 「Clear filter」) → 「Equals」 후보 12 개의 행 수 = Amount 조건만 건 행의 부서별 수 → 「Dept 3」 적용 77 행 → 「Clear filter」 1,015 행. 모든 수가 행 생성기로 따로 센 값과 일치 — 가상 · 「더 보기」 (창 100 행) × Chrome · WebKit 네 조합 PASS. dev 서버 Builder (Chrome MCP, 「adr315-p4-check」): Status Column 의 「Allow filtering」 칩 → 문서 `allowsFiltering: true` · Canvas record `isMenu: true`, override Reset 으로 되돌림, 콘솔 오류 0. (하니스 기본 열 정의 — 감싸개 없는 Column — 는 메뉴 Button 자리가 없어 `--column-origin` 으로 돌렸다.)
- **본 것 (이 증분 밖)**: 패널에서 칩을 켜면 Overrides 목록이 한 줄 늘어 Behavior 구획 칩이 아래로 밀린다 — 같은 자리를 다시 누르면 다른 칩이 눌린다 (live 중 「Allow hiding」 이 잘못 켜져 Reset 으로 되돌렸다).

**증분 4d — 열 선택 메뉴 · 열 Do (끝, `383aedaeb`)**:

- **연결 = 문서 필드 `columnsOf` (contract 75)**: Pagination 의 `pagesOf` 와 같은 방식 — 열 선택 메뉴는 팔레트 「Menu」 (MenuTrigger 원본) 의 instance 이고 그 노드가 Table 을 가리킨다 (끊기면 연결 없음). 이 Phase 의 entry 형 변경이라 번호를 올렸다 (R5) — 74 로 저장한 프로젝트는 열리지 않는다 (live 확인 때 「adr315-p4-check」 가 그렇게 열리지 않음). `setColumnChooser` (`commands/rowDisplay.ts`) 가 연결과 함께 Menu 의 첫 항목을 행 템플릿 (`repeat`) 으로 두고 나머지 표본 항목을 지운다.
- **행 출처**: resolver 의 다섯째 행 출처 `chooserRows` — 가장 가까운 `columnsOf` 조상의 Table 열 (`rows.tableColumns` — Column key · 머리글 글자). Table record 의 열 목록 (`_tableColumns`) 이 머리글 글자 (`label` = Column `children`) 를 싣는다. Builder 는 행이 없다 (메뉴가 닫혀 Canvas 는 템플릿 하나 — 표본). compositionRoot 의 행 감싸개가 `pages` 만 넘기고 새 출처를 버리던 것을 찾아 같이 넘긴다 (구현 중 실측 — 항목이 「Menu Item 1」 하나로 남았다).
- **선택 = 보이는 열 (규칙 없음)**: 메뉴의 `onSelectionChange` 는 세션이 직접 받는다 (`chooseTableColumns` — 빠진 열이 `hiddenColumns`, Pagination 의 「Rows per page」 처럼 연결이 곧 동작). 세션은 메뉴에 지금 보이는 열을 `selectedKeys` 로, 숨길 수 없는 열 (보이는 row header 가 하나뿐일 때 그것) 을 `disabledKeys` 로 알린다 (`echoColumnChoosers` — 바뀐 것만). Table 의 열이 바뀌면 (추가 · 이름 · 처음 그림) 메뉴를 다시 해석한다 (`syncColumnChoosers` — 열 목록 서명 비교). 메뉴 record 는 `recordsOfSource` 로 찾는다 (record 전체를 걷지 않는다 — ADR-307 게이트 등재).
- **열 Do (개념 `concepts/tableColumns.ts`)**: RAC 에 없는 표 상태라 composition 확장 개념 셋 — Table 「Show column」 · 「Hide column」 · 「Set shown columns」 (`visibleColumns`, 키 목록 · 쉼표 글자), Column 「Pin column to start · end」 · 「Unpin column」 (`pinned`), 「Set column filter」 · 「Clear column filter」 (`filterValue` — 지금 필터의 비교, 없으면 대화상자의 시작 비교로 값을 읽는다). 셋 다 Do 전용 prop (`editorHidden`) 이고 쓰기 · 현재 값 읽기는 record override 가 아니라 세션 (`CatalogPreviewInteractions` 의 `tableColumnState` — 열 메뉴가 바꾼 값과 갈리지 않게). 작성자의 Do 는 열의 「Allow …」 (보는 사람의 메뉴 허용) 를 따르지 않는다. 마지막 row header 는 상태 규칙 (`catalogTableStateWith`) 이 지킨다 — 세션에 같은 검사를 두었다가 변이가 잡히지 않아 (규칙이 이미 막음) 지웠다.
- **패널**: Table 의 Behavior 구획 「Column visibility menu」 스위치 (`CatalogTableColumnsSwitch` · `catalogRuntime/tableColumnChooser.ts`) — 켜면 표 앞에 「Columns」 메뉴 (multiple 선택) 를 한 step 으로 넣고, 끄면 그 Table 에 연결된 메뉴를 지운다. 연결하지 않은 Table 에도 나온다 — live 에서 찾은 것: 처음에는 「Search」 처럼 데이터 연결 Table 의 구획 (`withFilterSections` 의 연결 검사 뒤) 에 넣어 연결 없는 Table 에 스위치가 없었다.
- **사후 보고 (scope)**: §6 의 이름 「Column visibility menu」 를 그대로 썼고, 열 숨김 허용은 Column 마다의 「Allow hiding」 (4a) 이 아니라 메뉴가 곧 허용이다 — 메뉴는 모든 데이터 열을 나열한다 (TanStack 의 열 선택 목록과 같음). 「정렬에 추가」 Do · 열 순서 Do 는 두지 않았다 (값 하나로 쓰는 Do 축에 맞지 않음 — 순서는 메뉴 · 끌기).
- **검사**: `adr315ColumnChooser.test.tsx` 4 (열 선택 — 목록 · 체크 · 숨김 · 다시 보임 · row header 잠김 · 행 source 0 / Table 따라가기 — 열 이름 변경이 메뉴에 / 열 Do — 보이기 · 숨기기 · 쉼표 목록 · row header 유지 · 뒤 고정 · 해제 · 필터 · 지우기 / 패널 스위치 — 연결 안 한 Table · 표 바로 앞 · 「Columns」 · 끄면 제거). 게이트 갱신 (의도): 등록표 guard 목록 +8 (`deriveRegistry`), Do 등록 type 68 → 69 (`capabilityLabelKeys`), 도달 행렬에 이 테스트 (`capabilityBindingReach`), by-id 읽기 세션 3 → 5 (`stagedLoadReaders`), 필드 목록 스냅샷 (`fieldCoverage` +1). 변이 RED 15/15 (행 출처 없음 · 감싸개가 출처를 버림 · 선택 미전달 · 선택 무시 · 메뉴에 안 알림 · 잠김 없음 · 다시 해석 안 함 · Do 미전달 · 고정 · 필터가 보는 사람 허용을 봄 · 쉼표 목록 · 표본 항목 남김 · 「Columns」 없음 · multiple 아님 · 머리글 글자 없음). 회귀 새 실패 0 (shared 2,714 통과 · 실패 7 = 착수 전 목록, 셋은 HEAD worktree 에서 같은 실패 확인 · builder 단독 재실행 실패 12 = 착수 전 목록 — 전체 실행에서 시간 초과로 빠진 16 파일은 단독 실행 통과). 처음 회귀에서 이 증분의 실패 4 를 찾아 고쳤다 — 위 게이트 넷 (ADR-287 조회 수 게이트: 모든 `selectedKeys` 쓰기가 record 를 찾던 것을 「메뉴로 알린 record 만」 · 「열 prop 이 있는 patch 만」 으로). type-check PASS.
- **live (2026-11-20, dev 서버 · Chrome MCP · 새 프로젝트 「adr315-p4d-check」)**: Table 을 놓고 Behavior 「Column visibility menu」 켬 → Canvas 표 위 「Columns」 버튼 · Table 이 그 아래로 → Publish 새 탭: 「Columns」 → [Name ✓ (꺼짐) · Type ✓ · Status ✓] → Type 누름 → 머리글 [Name · Status] · 메뉴 그대로 열림 · Type 해제 → 다시 누름 → [Name · Type · Status] → Name 누름 → 그대로 → Builder 에서 스위치 끔 → 「Columns」 사라짐 · 콘솔 오류 0.

**증분 5 — 머리글 끌기 (끝, `705fb5f55` — 사용자 결정 3 의 「끌기」)**:

- **자리**: Table 「Reorder columns」 를 켠 표의 데이터 Column (`isMenu` — 선택 열은 해당 없음) 의 머리글 안 우리 손잡이 (`span.catalog-column-drag-handle` — 시작 쪽 padding 위 14px, 평소 투명 · 머리글 hover · 손잡이 focus · 끌기 중에 보임 — 키보드 focus 를 받도록 `display: none` 이 아니다). RAC Column 의 DOM 은 그대로다 (D1). 열 순서 허용을 Table 에서 읽어 다른 이유로 메뉴가 있는 열 (「Allow hiding」 …) 에는 손잡이가 없다.
- **끌기 · 놓기 = react-aria `useDrag` · `useDrop`** (S5 그대로). 놓을 자리는 끌기 중에만 생긴다 — 같은 표의 다른 머리글을 덮는 `div.catalog-column-drop`, 끌고 있는 열을 받을 수 있는 곳만 (세션에 한 번 묻는다). 놓는 쪽 선은 끌린 열이 뒤에서 오면 시작 쪽, 앞에서 오면 끝 쪽. 끌기 상태 (어느 표의 어느 열) 는 모듈 하나가 들고 `onDragStart` · `onDragEnd` 에서 바뀐다. react-aria 의 키보드 끌기는 끌기 중에 등록되는 놓을 자리도 받는다 (`registerDropTarget` → `updateValidDropTargets` — 설치본 `DragManager.mjs` 확인).
- **쓰기 = 열 메뉴의 이동과 같은 조각**: `catalogColumnDropPatch` (`tableColumnMenu.ts` — `moveList` 를 같이 쓴다) — `from` 이 `to` 의 자리를 갖고 사이 열이 한 칸씩 밀린다. 고정 열은 그 쪽 목록 안에서만 (다른 목록의 열은 목록에 없어 놓을 자리가 생기지 않는다). 세션 `dropTableColumn(table, from, to, apply)` 이 묻기 · 쓰기 하나 — `setTableState` 한 번, 행 source 0.
- **번들**: 손잡이 · 놓을 자리는 lazy chunk (`tableColumnDrag.components` — react-aria dnd hook). HEAD 대비 Builder 초기 JS gzip +384 B · Preview +1 B (CSS +141 B).
- **WebKit 첫 클릭 (S5 의 기록 정정)**: WebKit 은 **포인터 (native) 끌기 직후** 첫 누름에 `pointerdown` 을 보내지 않을 때가 있다 (mousedown 은 온다 — react-aria `usePress` 가 누름을 시작하지 못해 그 클릭 하나가 정렬 · 메뉴를 하지 않는다, 두 번째부터 정상). S5 는 「키보드로 놓은 직후」 라 적었으나 같은 실행 앞의 포인터 끌기 때문이었다 — 포인터 끌기 직후 클릭을 먼저 하면 그 클릭이 먹히고, 키보드 끌기 뒤 클릭은 정상이다 (capture 기록으로 확인). 간헐적 (WebKit 실행 6 회 중 4 회). 우리 코드 밖이라 (S5 의 react-aria 만 쓴 시제품에서도 같다) 알려진 한계로 둔다.
- **검사**: `tableColumnMenu.test.ts` +3 (뒤 · 앞에 놓기 · 상태의 순서에서 시작 / 허용 없음 · 자기 자신 · 고정 쪽 넘기 · 같은 쪽 안 / 숨긴 열의 자리) · `adr315ColumnDrag.test.tsx` 3 (손잡이 — 데이터 열마다 이름 붙은 손잡이 · 스위치 없으면 다른 이유의 메뉴가 있어도 없음 / 손잡이 누름은 정렬하지 않음 / 키보드 끌기 — 놓을 자리 2 · Tab · Enter → `columnOrder` · 행 source 0 · 문서 그대로 · 놓은 뒤 놓을 자리 0). 게이트 갱신 (의도): `adr297ManualStateRatchet` Table.css 1 → 2 (손잡이 focus 표시 — rule class 가 아닌 런타임 요소). 변이 RED 9/9 (놓는 자리 · 허용 검사 · `from` 이 목록 밖 · 세션 미적용 · 스위치 검사 · 그리지 않음 · 끌기 끝 미정리 · 놓기 미적용 · Space 전파). GREEN 이던 넷: 고정 쪽 검사 · 자기 머리글 제외 는 다른 검사가 이미 막는 중복이라 지웠고, 손잡이의 pointer · click 전파 차단 둘은 jsdom 에서 native drag 시작을 볼 수 없어 live 로 확인했다 (S5 — RAC Column 의 press 가 mousedown 기본 동작을 막으면 native drag 가 시작되지 않는다). 회귀 새 실패 0 (shared 7 · builder 12 는 착수 전 목록 그대로 — builder 는 단독 실행으로 대조).
- **live (2026-11-20, production 빌드 + Playwright `--check-drag`)**: Table 「Reorder columns」 → Publish: 손잡이 6 · hover 때 보임 → Name 손잡이를 포인터로 Amount 머리글에 → [Dept · City · Amount · Name · Qty · Date] · 놓을 자리 0 → Date 손잡이 focus · Enter (끌기 시작 · 놓을 자리 5) · Tab (「여기로 열 이동: Dept」) · Enter → [Date · Dept · City · Amount · Name · Qty] → 정렬 없음 → Qty 머리글 클릭 → 오름차순. 가상 · 「더 보기」 × Chrome · WebKit 네 조합 PASS · 콘솔 오류 0.

**증분 6 — Phase 2 · 3 에서 넘어온 것 (끝, `705fb5f55`)**:

- **넘어온 목록의 정리**: Phase 2 의 「정렬에 추가」 메뉴 항목 · Phase 3 의 열 필터 조작 자리 (열 메뉴 「필터」 · 열 필터 Do · `tableFacet` 의 소비처) 는 증분 4b · 4c · 4d 에서 끝났다. 「정렬에 추가」 Do 는 4d 에서 두지 않기로 했다 (값 하나로 쓰는 Do 축에 맞지 않음). 두 「스위치 막기」 는 Phase 2 · 3 이 사유 한 줄 (`CatalogTableSortNotice`) 로 이미 끝냈다. 남은 하나가 「작성된 기본 정렬을 머리글에 표시 (Canvas 순번 포함)」 — 이 증분이다.
- **작성된 정렬**: 연결한 Table 의 보기가 행을 남기는 정렬 — 정렬이 있는 마지막 보기의 리터럴 정렬 (뒤 보기가 묶으면 없음, 변수 정렬은 ADR-284 Decision 5 의 것), 필드는 그 key (= 그 필드를 보이는 Column 의 key). 열이 보이지 못하는 항목 (참조 경로 · 없는 필드 · Column 이 없는 필드) 에서 목록이 끝난다 — 행은 그 항목으로 먼저 정렬돼 있어 뒤 항목만 표시하면 틀린 표시다. resolver 가 Table record 에 `_authoredSort` (JSON 글자 — `tableColumns.ts` `catalogViewAuthoredSort`) 로 싣는다. 행을 읽지 않은 Table (원격 collection 의 Builder) 에도 싣는다 — 정렬은 문서의 것이다.
- **보이는 정렬 = 상태의 정렬, 없으면 작성된 정렬** (§4.2 — 상태의 정렬이 작성된 정렬 자리를 대신한다):
  - Preview · Publish DOM: RAC 의 `sortDescriptor` · 순번 목록이 runtime 값이 없으면 작성된 정렬 (`presence.ts` `catalogTableAuthoredSortShown` — RAC key 로, 숨긴 열 제외).
  - 세션 `tableSortNow`: 머리글 누름 · 열 메뉴가 거기서 시작한다 — 작성된 오름차순 열을 누르면 내림차순, Shift 는 작성된 목록 끝에 더한다, 「Allow unsorted」 의 마지막 누름은 상태 정렬을 비워 작성된 정렬로 돌아간다 (작성된 정렬이 있는 표에 「정렬 없음」 은 없다 — 행은 늘 그 순서다).
  - Canvas (HC9 — 작성 층): 정렬된 Column 의 내용 감싸개 record 에 파생 값 `_sortMark` (방향 · 순번), 엔진에 그 앞 part (`::part:sort` — 폭 = 화살표 16 + 순번이면 2 + 자릿수 × 7.2, 높이 16, 끝 여백 8 — `catalogSortMarkWidth`), `canvasBinding` 이 그 자리에 화살표 (lucide `arrow-up` · `arrow-down`, 머리글 색) 와 순번 (12px · tabular · 상자 시작에서) 을 그린다. live 에서 찾은 것: 가운데 정렬 `nowrap` 글자 자식은 Canvas 에서 띠보다 ~9px 오른쪽에 그려졌다 (위치 · padding 과 무관) — 순번 칸 폭이 숫자 advance 라 시작 정렬로 DOM 과 같은 자리. 표시가 오가거나 바뀌면 다시 묶는다 (작성자의 정렬 편집 — 드물다).
  - S2 처럼 화살표는 정렬 허용 열 (`allowsSorting`) 에만 (S2 `ColumnContents` — `allowsSorting &&`).
- **DOM 표시 하나로**: 순번이 있으면 화살표와 순번이 한 상자 (`span.sort-mark` — inline-flex, 높이 16, 끝 8) 이고 순번은 고정 px (글자 12 · 자릿수 × 7.2 폭, 시작 정렬) — Canvas 가 같은 상자를 측정 없이 놓는다. 전에는 화살표 · 순번이 따로 flex 항목이라 감싸개의 gap 이 둘 사이에 들어가고 순번 폭이 글자 측정 (0.75em) 이었다. 머리글 글자 크기를 따르지 않는 이유 (live 에서 찾은 것): Canvas 의 내용 감싸개 record 는 frame 기본 글자 16 을 들지만 DOM 감싸개는 Column 의 14 를 물려받아, em 기반이면 두 쪽 상자 폭이 0.9px 갈렸다 — 화살표가 S2 대로 고정 16px 이듯 순번도 고정 값 (S2 에 없는 composition 표시).
- **구현 중 찾은 것 (증분 1 부터의 결함)**: 정렬된 열을 숨기면 (열 메뉴 · 열 선택 · Do) 남은 정렬 열의 화살표 · 순번이 사라졌다 — 세션이 정렬을 RAC 에 다시 알리는 것이 정렬이 바뀔 때뿐이라, RAC 는 숨은 열을 첫 정렬로 들고 있었다. 숨김이 바뀌면 다시 알린다 (`setTableState`). 상태 정렬 · 작성된 정렬 둘 다 회귀 테스트.
- **검사**: `tableColumns.test.ts` +3 (마지막으로 정렬하는 보기 · 두 id 형 / 정렬 없음 · 뒤 보기의 묶기 · 변수 정렬 / 보이지 못하는 항목에서 끝) · `adr315AuthoredSort.test.tsx` 10 (두 열 작성 정렬 — record · 행 순서 · `aria-sort` 첫 열 · 순번 · 한 상자 · 고정 px / 누름이 작성 방향에서 시작 · 상태 정렬 · 「Allow unsorted」 로 작성 정렬로 / Shift 가 작성 목록에 더함 · 열 메뉴 「정렬에 추가」 / Canvas record — 감싸개의 `_sortMark` · part 폭 · 이름 앞 · 보기 정렬 변경 · 정렬 허용 끄기 / 숨긴 열 (상태) · 다시 보임 / 상태 정렬의 숨긴 열 / 첫 항목이 Column 없는 필드 / Canvas 「Hidden by default」 / 한 열 / Canvas 묶기 — 화살표 · 순번 그림, 다른 Column 삭제 뒤에도 남음, 화살표 색 = 이름 글자 색, 감싸개 색 편집에 다시 칠함, 정렬 열 삭제 · 보기 정렬 변경은 다시 묶기). 변이 RED 23/23 (마지막 보기 · 뒤 묶기 · 모르는 필드에서 계속 · 숨긴 열에서 끝 · Canvas 숨긴 record · DOM `sortDescriptor` · DOM 순번 목록 · 세션이 상태만 · 메뉴가 상태만 · 숨김 때 다시 알림 · Column 없는 필드에서 계속 · 파생 값 · part · 폭의 순번 · 한 열의 순번 · DOM 순번 폭 · resolver · Canvas: 영역 재구성의 표시 유지 · 영역 재구성의 다시 묶기 · 값 변경의 다시 묶기 · 묶기 등록 · 다시 칠할 때 표시 · 이름 글자 색). GREEN 이던 셋 (Table · Column 변경의 파생 의존 · 세션 알림의 작성 정렬) 은 다른 길이 이미 막는 중복이라 지웠다 — Table 의 보기 변경은 그 영역 전체를 다시 해석하고, DOM 이 작성된 정렬로 대신한다. 회귀 새 실패 0 (shared 7 · builder 12 — 착수 전 목록 그대로, builder 의 `phase3Presence` 는 Phase 2 기록의 「Tabs presence」). type-check PASS.
- **live 에서 찾은 것 셋** (production 빌드 + Playwright `--check-authored-sort`): (1) 하니스 setup 의 보기 정렬 쓰기는 Canvas 묶기의 영역 재구성 길을 지나 표시 노드를 버렸다 (영역의 자식 목록을 record 자식으로만 다시 만든다) — 영역 재구성도 표시를 지키고 (`synthetic`), 표시가 바뀌면 다시 묶는다. (2) Canvas 의 내용 감싸개 record 는 frame 기본 글자 16 을 들지만 DOM 감싸개는 Column 의 14 를 물려받아 em 기반 순번 상자가 0.9px 갈렸다 → 고정 px. (3) Canvas 화살표 색이 검정 (감싸개 · 물려받은 색 없음 — DOM 은 생성 시트의 색) 이었다 → 이름 글자의 색 (DOM 화살표 `currentColor` 와 같은 값, live 비교 `rgb(41, 41, 41)` 일치).
- **live (2026-11-20, production 빌드 · Playwright `--check-authored-sort --column-origin`, 200 행 원격 collection, 보기 정렬 Dept ↑ · Amount ↓)**: Builder — Dept · Amount 감싸개 record 의 `_sortMark` (`ascending:1` · `descending:2`) · 표시 part 폭 25.2 (16 + 2 + 7.2) · 이름이 그 뒤 8, Canvas 화면에 「↑ 1 Dept」 · 「↓ 2 Amount」 (스크린샷 확인). Publish — `aria-sort` Dept ↑, 화살표 · 순번 Dept 1 ↑ · Amount 2 ↓, 표시 상자 폭 25.195 (Chrome) · 25.188 (WebKit), 화살표 색 = 이름 글자 색, 첫 8 행 = 하니스 행 생성기로 따로 계산한 「Dept 번호 ↑, 그 안 Amount ↓」 → Amount 머리글 클릭 → `aria-sort` Amount ↑ · 순번 없음 · 첫 8 행 = 작성 순서 위의 Amount ↑ 안정 정렬. 콘솔 오류 0. Chrome · WebKit × 가상 · 「더 보기」 네 조합 PASS. Chrome · 가상 8 회 중 1 회는 Amount 클릭 뒤 내림차순 (두 번 누른 결과와 같음) — 바로 뒤 3 회 재실행은 PASS, 원인 미확인 (Phase 4 검증의 live 에서 다시 본다).
- **알려진 한계**: 내용 감싸개가 없는 Column (`sortsInline` — 옛 하니스 열 정의처럼 글자가 Column 바로 아래) 은 Canvas 에 표시를 그리지 않는다 (Preview 는 그린다). 지금 palette 의 Column 원본은 감싸개가 있다.

**증분 1 의 남은 것 (끝, 미커밋)**:

- **Layers 의 숨긴 Column**: Builder 가 남겨 두는 숨긴 열의 record (`_columnHidden` — Column 과 그 Cell) 는 Layers 에서 줄을 그대로 두고, 흐린 아이콘 · 이름 + 눈 감은 표시 (`EyeOff`, 이름 「Hidden column」) 를 단다. 판정은 workspace 한 곳 (`columnHidden` — 지금 root 의 record), 줄 객체의 `columnHidden`, 그리고 Layers 가 step 마다 다시 읽는 판정 목록 (`columnGated` — 「Hidden by default」 는 줄 목록을 바꾸지 않으므로 EmptyState 의 `collectionGated` 와 같은 길).
- **검사**: `adr315LayersHiddenColumn.test.ts` 1 (스위치 켬 → 그 step 만으로 Column · Cell 줄에 표시, 줄은 남음 → 끔 → 표시 없음). 변이 RED 3/3 (step 판정 목록 · 줄 비교 · workspace 판정). catalogRuntime · navigator 테스트의 실패 4 파일 (8) 은 이 변경을 되돌린 HEAD 판에서도 같은 8 이다.
- **live (2026-11-21, dev 서버 · Chrome MCP · 「adr315-p4d-check」)**: Layers 에서 Gender Column 을 골라 「Hidden by default」 켬 → Canvas 머리글에서 Gender 빠짐 · 그 줄이 흐려지고 눈 감은 표시 (다른 줄을 골라도 남음) → 다시 골라 끔 → Gender 돌아옴 · 표시 없음.
- **가상 표의 열 변경 비용 (HC4)** — 측정 하니스 `--profile-columns` (production 빌드, 원격 collection 10,000 행 · 가상 · 열 6, `--column-origin`): 모든 열 「Allow hiding」 · 「Allow pinning」, Table 「Reorder columns」 · 「Column visibility menu」. Publish 에서 Dept 「앞에 고정」 · 「고정 해제」, Name 「오른쪽으로」 · 「왼쪽으로」, 열 선택 메뉴의 Qty 끔 · 켬 — 항목 누름 → 머리글이 바뀐 다음 frame. 기준선 = 같은 페이지의 정렬 (Amount · Name 의 열 메뉴 「오름차순 · 내림차순」 — 메뉴가 있는 열은 머리글 누름이 메뉴를 연다, S2 `isMenu`) 의 항목 누름 → 첫 행이 바뀐 다음 frame. CPU 1x · 4x 각 3 회 중앙값.
  - **찾은 결함**: 정렬된 표에서 열 숨김 · 보이기가 4x 2,093 / 2,855 ms (정렬 706 ~ 726 ms — 기준선의 3 배). 1x (83 / 91 ms) 와 정렬 없는 4x (402 ms) 는 기준선 안이었다 (4x 회차는 1x 회차의 정렬 뒤에 돈다). CPU profile: 2,104 ms 중 React `getHostSibling` 1,435 ms (self 1,300) — 가상 표의 빈 행 10,000 개의 React key 에 칸 span 서명이 들어 있어, 열 수가 바뀌면 그대로인 묶음 (fragment) 안에서 행마다 key 가 바뀌고 React 가 행을 하나씩 다시 놓으며 뒤따르는 놓을 행을 매번 건너 걸었다 (메모리 `reference-react-keyed-reorder-gethostsibling-quadratic` 과 같은 기제).
  - **수리** (`domBinding.runtime.ts`): 빈 행은 칸이 없어 RAC 가 낡은 칸 번호를 들 일이 없다 — key 를 행 key 만으로 (`windowRowKey` — 칸 span 이 표의 행 모양과 다른 record 행만 span 을 key 에 더한다, 창이 지날 때 빈 행 ↔ record 의 key 가 같은 것은 그대로). 표의 행 모양이 바뀌면 묶음의 key (`catalogWindowRowChunkKey` — 이름 + 모양) 가 바뀌어 묶음째 다시 mount — 묶음마다 한 번 놓인다 (정렬 수리와 같은 길). 검사 `windowRowKeys.test.ts` 2 (빈 행 key 는 모양과 무관 · 묶음 key 는 모양을 따름), 변이 RED 2/2, 가상 표 · ADR-315 · ADR-257 Preview 테스트 14 파일 75 통과.
  - **수리 뒤 (10,000 행)**: 1x — 고정 · 해제 · 이동 66 ~ 84 ms · 숨김 · 보이기 75 / 77 ms · 정렬 210 ~ 221 ms. 4x — 고정 · 해제 · 이동 224 ~ 252 ms · 숨김 · 보이기 572 / 587 ms · 정렬 696 ~ 718 ms. 열 변경이 모두 정렬 기준선 아래 (HC4). 1,000 행: 1x 75 ~ 84 vs 정렬 75 ~ 77 ms (같은 부류), 4x 220 ~ 302 vs 345 ~ 354 ms.
  - 하니스에서 본 것 (결함 아님): Builder Canvas 의 첫 머리글 「Name」 은 데이터 연결 표시 칩 (「Grid」) 이 덮는다 — record 글자는 그대로.

**Phase 4 검증 (2026-11-21)**:

- **회귀**: shared 실패 7 · 통과 2,722, builder 실패 12 (7 파일) · 통과 9,421 — 실패는 착수 전 목록 그대로 (catalogRuntime 의 4 파일 8 건은 이 Phase 의 변경을 되돌린 판에서도 같다, `actionIcons.static` 은 `CatalogLayerIcon.tsx` 의 기존 import). type-check PASS.
- **변이 RED**: 증분별 합 128 (1: 14 + 3 · 2: 16 · 3: 6 · 4a: 12 · 4b: 12 · 4c: 15 + 1 · 4d: 15 · 5: 9 · 6: 23 · HC4 수리: 2) — 전부 RED.
- **번들** (`vite build` + closure, Phase 3 커밋 `9e44cb76d` 의 worktree 빌드 대비): Builder initial JS gzip 1,592,408 → 1,600,425 B (**+8,017** — 사용자 결정 6 의 +8,000 을 17 B 넘음, 보고) · Preview 171,810 → 171,814 B (+4). 열 메뉴 · 필터 대화상자 · 끌기는 쓰는 표에서만 읽는 lazy chunk 다 (HC5). ADR-201 절대 상한 (Builder 1,435,351) 은 Phase 3 기준선부터 넘는다 — 이 ADR 의 판정은 결정 6 의 Δ.
- **HC4 A/B** (production 하니스 빌드, 10,000 행 · 가상 · 열 6, Phase 3 빌드 `dist-p3base` 대 Phase 4 빌드, headed Chrome):
  - 전체 하니스 5 쌍 (base 먼저 3 · Phase 4 먼저 2): 로드 1.01 · 힙 1.00 · 스크롤 p95 1x 1.01 · 4x 1.01 (중앙값) · 정렬 클릭 1x 1.05 / 1.00 · **4x 1.18 / 1.11** — 순서를 바꿔도 같다.
  - 정렬만 (ABBA 6 쌍, 스크롤 없음): 1x 1.02 / 1.01 · 4x 0.99 / 1.02. 스크롤 1 회 뒤 정렬 (세 빌드 — Phase 3 · HEAD `705fb5f55` · HEAD + 열 변경 수리 — 순환 3 회): 4x 세 빌드 같음 (631 ~ 711 / 634 ~ 663 / 635 ~ 640 ms) — 수리가 원인이 아니다.
  - 그래서 느려지는 것은 긴 순서 (스크롤 6 회 + 1x 정렬 12 회 + 4x 스크롤 3 회) 뒤의 정렬뿐이다 — 창 이동 · 정렬이 쌓는 무언가로 보인다 (CPU profile: 그 정렬의 React commit +79 ms · passive effect unmount +49 ms). 원인을 찾지 않았다 — **사용자 결정 (2026-11-21) 으로 Phase 7 A/B 가 같은 순서로 다시 잰다**.
  - 하니스 추가: `--profile-columns` (열 변경 · 메뉴 정렬 기준선) · `--sort-only [scrolled]` · `--profile-sort [scrolled] --profile-rate 4` · `--profile-chooser [sorted]`.
- **live**: 증분마다 한 것으로 닫는다 (위 증분 기록 — 고정 Chrome · WebKit × 가상 · 비가상, 폭 기억, 필터, 끌기, 작성 정렬, 열 선택 메뉴, Layers 숨김 표시). 마지막 재확인 묶음과 Canvas 기본값 `/cross-check` (G4 조건) 은 사용자 결정으로 Phase 7.
- **Gate G4**: 열 숨김 · 순서 · 고정 · 폭 기억 Preview · Publish 동작 (live) · 검색 중 열 숨김의 요청 · 결과 무변경 · 행 source 0 (`adr315Columns.test.tsx`) · RAC 불변식 throw 0 (`tableColumns.test.ts` 의 row header · colSpan · 어긋난 행) · 가로 스크롤 중 고정 (가상 · 비가상 × Chrome · WebKit, 증분 2) — 통과. Canvas 기본값 `/cross-check` 은 Phase 7.
- **남은 한계 (기록)**: colSpan 이 덮는 열의 메뉴 이동은 묶음을 따르지 않는다 · RTL 의 이동 라벨 테스트 없음 · 크기 조절 손잡이의 뒤쪽 절반이 다음 열 머리글 아래 (기존) · 패널 칩을 켜면 Overrides 줄이 늘어 Behavior 칩이 밀린다 (이 ADR 밖).

### Phase 5 (진행 중 — 2026-11-21 착수)

**사용자 결정 4 확정 (2026-11-21, 착수 때)**: 「전부 더함」 — median · unique · uniqueCount · extent · first · last 를 표 안 묶음 · 합계 행 · 보기 (파생 보기) 집계에 같이 더한다. 집계 어휘는 한 벌이다.

**착수 조사 (Explore + 직접 확인)**: 표 상태의 `grouping` · `expandedKeys` 는 형만 있고 읽는 곳이 0 이었다 (resolver 의 `stated` · `recordRowSlices` · 번역 · DOM 모두). 중첩 Row 는 어디에도 없었고 선례는 Tree 의 `nestTreeRows` (`CatalogBoundRow.children`). 행 source 는 표시 창 · 쪽을 자르기 전에 정렬 · 거르기를 한다 (`boundRowsOf`) — 묶음 · 집계도 여기서 해야 묶음 전체를 보고 쪽 · 창이 최상위 행으로 센다 (§4.5 · §5.4). Builder (Canvas) 의 행 source 는 slices 를 받지 않는다 (`catalogBuilderBoundRows`).

**증분 5a — 집계 6 종**:

- 평가기 `viewAggregateOf` (`collections/view/evaluate.ts`) 하나가 보기 집계와 표 묶음 행을 같이 계산한다. median = 수의 중앙값 (짝수면 가운데 둘의 평균), unique = 정확히 같은 값 (`groupKeyOf` — 묶기와 같은 동등성, `"A"` · `"a"` 는 둘) 의 처음 본 순서 목록, uniqueCount = 그 수, extent = `[최소, 최대]` (`cellCompare`), first · last = 묶음 첫 · 끝 행의 칸 그대로 (빈 값 포함 — TanStack 과 같다). 결과 schema: median · uniqueCount 수, unique · extent 목록 (`array`), first · last 는 필드 형.
- 서버 (`body` 형식): 6 종은 ADR-291 의 body 계약 뒤에 더한 것이라 endpoint 가 「Median · unique · extent · first · last aggregates」 (`querySerialization.extendedAggregates`) 를 켰을 때만 보낸다. 안 켰으면 묶기를 보내지 않고 (`AGGREGATE` 경고 — 집계마다) 전체 행을 불러와 여기서 묶는다 (`load: "all"` — suffix 의 `GROUP` 과 같은 길). 서버가 모르는 집계를 받아 무시하는 것을 막는다.
- 문서 검증 (`VIEW_AGGREGATE_FNS`) · Code 보기 생성과 역변환 (식 6 개 — 왕복 테스트) · 부분 데이터 표시 (uniqueCount 는 `N+`, first · 목록은 그대로) · Data 패널의 형식 스위치.
- 검사: `adr315Aggregates.test.ts` 7 (손계산) · `adr296Vocabulary` 왕복 6 · 변이 RED 7/7.

**증분 5b-1 — 표 안 묶음 행 (로컬 실행 · Preview · Publish)**:

- **데이터 층** — `runtime/tableGroupRows.ts` `catalogGroupBoundRows`: 행 source (`boundRowsOf`) 가 거르기 · 정렬 뒤 남은 행 **전부**를 묶음 트리로 만든 뒤 표시 창 · 쪽으로 자른다 (최상위 = 묶음 행으로 센다 — TanStack `paginateExpandedRows: false`). 묶음 행 = `{ key: group:[값 경로], values: { 묶은 열: 값, 열마다 집계 }, children, group: { column, count, depth, expanded } }`. 값은 정확히 같을 때만 한 묶음 (`"A"` · `"a"` · `null` · `""` 는 넷). 여러 단계는 열 순서대로 중첩. **접힌 묶음은 행을 읽어 내지 않고 칸 없는 자리 자식 하나** (`…/collapsed`) 를 둔다 — react-aria 는 자식 Row 가 collection 에 있어야 `aria-expanded` · ← → 를 준다 (Phase 0 S2), 그래서 접힌 묶음 하나는 record 하나다. 펼침 (`expandedKeys`) 이 바뀌면 세션이 행을 다시 읽는다 (`setTableState` — 묶인 표만).
- **번역** — `tableRowSlices.ts`: `catalogTableGrouping` (상태의 `grouping`, 없으면 Column 「Grouped」 — `defaultGrouped`, 열 순서) · 집계는 Column 「Group aggregate」 (`aggregate`) · 묶은 열의 정렬 항목이 정렬 목록 앞에 선다 (§4.4 — 묶음 순서가 그 정렬을 따른다). 상태의 `grouping` 은 작성값과 같으면 조각이 아니고, 작성값이 있을 때의 빈 목록은 「묶지 않음」 이다 (Phase 4 의 숨김과 같은 규칙).
- **resolver** — `nestTableRows`: 행의 자식 행 (묶음의 · 데이터 행의 `children`) 마다 같은 Row 템플릿을 그 Row 의 Cell 뒤에 다시 놓는다 (RAC 중첩 `<Row>`, Tree 의 `nestTreeRows` 와 같은 자리 셋 + 소유 자식 경로). 묶음 행의 묶은 칸은 「값 (개수)」, 집계 없는 칸은 비어 있다. 묶음 행에는 아직 행 창을 쓰지 않는다 (5b-2). 작성 「Grouped」 만 있고 상태가 없는 Preview 표는 header 를 읽은 뒤 묶어서 한 번 더 읽는다 (그 밖의 표는 비용 0 — header Column 검사뿐).
- **열 투영** — 묶은 열이 고정하지 않은 열 중 맨 앞 (TanStack `groupedColumnMode: 'reorder'`), 바깥 묶은 열에 `_treeColumn` (record 의 모든 층 — 바깥 층에만 쓰면 사라진다, 구현 중 실측). 투영은 중첩 Row 의 칸도 따른다.
- **DOM** — Table 에 RAC `treeColumn` · 제어 `expandedKeys` (`_expandedKeys`) · `onExpandedChange` → 세션 `expandTableRows`. Cell 은 `CatalogTableCell` — treeColumn 칸에 단계 들여쓰기와 RAC `Button slot="chevron"` (이름 「Expand」 · 「Collapse」 는 RAC 의 것), 그 밖의 Cell 은 그대로. 모양은 `Table.css` (16 / 단계, `1lh` 정사각 — S2 TableView).
- **중첩 Row 의 Table 찾기** (구현 중 실측 — RAC 예외): `catalogTrackTableOf` 가 Row → TableBody 만 봐서 중첩 Row 의 선택 checkbox 칸이 숨지 않았다 (칸 4 · 열 3 → RAC `cell.column` undefined). 부모 Row 를 건너 올라가게 고쳤다 (`catalogTableSelectionParts` 도).
- **최종 사용자 조작** — Column 「Allow grouping」 (`allowsGrouping` — 열 메뉴가 생긴다): 「Group by column」 · 「Ungroup」 (`tableColumnMenu.ts` — 데이터 필드가 없는 열은 꺼짐). 작성 기본값 Column 「Grouped」. 셋 다 composition 확장 (`d2Provenance.ts`).
- **검사**: `tableGroupRows.test.ts` 9 (묶음 · 동등성 · 자리 자식 · 두 단계 · 「all」 · count · 조각 번역 · 상태 규칙 · 메뉴) · `adr315GroupRows.test.tsx` 2 (Preview: 묶기 → 묶음 행 「B (2)」 · 합계 · 접힘 `aria-expanded=false` · chevron → 자식 행 `aria-level` 2 · 묶기 해제 · 작성 「Grouped」 · 묶은 열 정렬이 묶음 순서) · 변이 RED 13/13 (+ 반올림 2) · 회귀 새 실패 0 (shared 실패 7 · builder 12 = 착수 전 목록; 처음 돌린 builder 의 새 실패 4 — D2 출처 · 수동 상태 CSS ratchet (펼침 버튼 focus, 사유 추가) · 「body」 문자열 비교 술어 · 라벨 「Aggregate」 중복 (「Group aggregate」 로) — 고쳤다).
- **번들** (Phase 4 끝 대비): Builder initial 1,600,425 → 1,602,519 B (+2,094) · Preview 171,814 → 171,810 B (−4). 사용자 결정 6 의 범위 안.
- **live (production · headed Chrome · 1,000 행 원격 collection · 「더 보기」 · `--column-origin`, 하니스 `--check-group`)**: Dept 「Allow grouping」 · Amount 「Group aggregate」 Sum. Publish 에서 Dept 메뉴 [정렬 둘 · 「Group by column」] → `treegrid`, 머리글 첫 열 Dept, 묶음 12 = 행 생성기로 따로 센 12, 묶음마다 「Dept N (개수)」 · Amount 합계가 따로 센 값과 같음 → 첫 묶음 펼침: 자식 101 행 (= 「Dept 9 (101)」) 모두 Dept 9 · `aria-level` 2 → 「Ungroup」 → 100 행. **여기서 찾은 결함 1**: 합계가 `453013.2899999999` 로 보였다 (소수의 이진 합 잡음) → `viewAggregateOf` 가 합은 입력의 가장 긴 소수 자릿수로 반올림 (원복 RED 2 — `adr315Aggregates.test.ts` 「no float noise」). 다시 잰 live 는 `453013.29`. (평균 · 중앙값을 「두 자리 더해 반올림」 한 처음 수정은 5b-2 회귀에서 ADR-291 G5 를 깨 고쳤다 — 아래 5b-2.)
- **하지 않은 것 (다음 증분)**: 5b-2 가상 표 (행 창) 위 묶음 · 5b-3 Canvas 의 작성 「Grouped」 (둘 다 아래에서 끝) · 서버 묶음 조회 · 자식 조회 (5g).

**증분 5b-2 — 가상 표 (행 창) 위 묶음 행 (§5.4 「행 창과 펼침」)**:

- **resolver** — 묶인 가상 표는 행 창을 「펼친 묶음이 보이는 순서」 (묶음, 열린 묶음이면 그 행들 — TanStack expanded row model) 위에서 자른다 (`catalogShownGroupRows` → `windowedGroupRows` → 기존 `windowedRows`). record 는 평평하다 — 창 안의 행마다 record 하나 (묶음 record 에 행을 읽어 넣지 않는다), 접힌 묶음의 자리 자식은 보이는 행이 아니라 빠진다. 창의 key 목록에 행마다 깊이 (`CatalogRowWindowKeys.depths`) 와 닫힌 묶음 (`closed`) 을 싣는다. 행이 창 하나에 다 들어가면 (또는 창이 없으면) 5b-1 그대로 중첩 record. 창 이동 (`moveRowWindow` 의 「자리 · key 가 같은 행은 record 유지」) · 단계 나눠 읽기는 평평한 번호 그대로라 바뀌지 않았다.
- **DOM** — `CatalogWindowRows` 가 깊이가 있으면 `CatalogWindowRowNest` 로 그린다: 형제 행마다 RAC Row (record 또는 빈 Row — 같은 key) 안에 그 행의 행들을 칸 뒤에 넣고 (`nestedRows` → `catalogWindowRowElement` · `catalogWindowRowPending`), 닫힌 묶음에는 빈 자식 Row 하나 (RAC 는 마지막 자식이 칸이 아닌 행을 펼칠 수 있는 행으로 본다 — `useTableRow.mjs:62`). 형제가 64 를 넘으면 chunk (열린 묶음 안에서도 — Phase 0 S2), chunk memo 는 그 범위의 창 record id 로 비교한다. Virtualizer 전 (chunk 로드 전) 에는 창 안의 행과 그 행이 든 묶음만 그린다.
- **찾은 결함 1 (live)**: 가상 표에서 펼친 묶음의 펼침 표시가 돌지 않았다 — `Table.css` 의 `Row[data-expanded] > .react-aria-Cell` 자식 결합자가 Virtualizer 의 칸 감싸개 (`presentation` div) 를 넘지 못했다. 자손 결합자로 (RAC 는 중첩 행도 DOM 에서 형제로 그리므로 다른 행의 칸에 닿지 않는다). 하니스가 `getComputedStyle(svg).rotate` = `90deg` 를 두 표시 방식에서 본다.
- **검사**: `adr315GroupWindow.test.tsx` 4 (창 = 펼친 순서 · 깊이 · 닫힌 묶음 · 평평한 record · 창 이동이 남는 행 유지 · 접어서 다 들어가면 중첩으로 · DOM `aria-level` 순서 · 창 밖 빈 Row 45 · 64 넘는 묶음의 chunk · 창 이동 뒤 DOM · 창 안 닫힌 묶음 `aria-expanded=false`) · 변이 RED 11/11 (창 없음 · 자식 유지 · 닫힌 묶음 없음 · 깊이 0 · DOM 평평 · 빈 자식 Row 없음 (처음 GREEN — 창 밖 빈 Row 는 칸이 없어 RAC 가 늘 펼칠 수 있는 행으로 봐서, 창 안 닫힌 묶음으로 단언을 옮겨 RED) · chunk memo 낡음 · subtree 끝 평평 · 창 행만 그림 · record 가 중첩 행을 버림 · 창에 깊이 없음) · 회귀 새 실패 0 (shared 2,739 통과 · 실패 7 = 착수 전 목록 · builder 9,432 통과 · 실패 13 중 12 는 착수 전 목록, 1 은 아래 회귀 — 고친 뒤 통과) · type-check PASS.
- **찾은 회귀 1 (5b-1 의 반올림 수정)**: 전체 회귀에서 `adr291G5` (로컬 평가기 = mock 서버, body 형식) 가 새로 실패했다 — 평균을 「입력 소수 자릿수 + 2」 로 자른 탓에 400 / 15 가 26.67 이 되어 서버 값 26.666666666666668 과 갈렸다 (잡음 제거가 아니라 값 바꾸기). 합은 그대로 입력 자릿수로 (정확), 평균 · 중앙값은 그 합 (두 칸) 을 한 번 나눈 뒤 마지막 몇 ulp 의 잡음만 15 자리 소수로 맞춘다 (`withoutFloatNoise` — 4 ulp 안일 때만: 0.6 / 3 → 0.2, 400 / 15 는 그대로). 테스트에 두 칸 중앙값 (0.1 · 0.2 → 0.15) · 순환 소수 평균 (400 / 15) 을 더했고 변이 RED 4/4 (잡음 맞춤 없음 · 평균 두 자리 · 합 그대로 · 중앙값 두 칸 그대로).
- **번들** (5b-1 대비): Builder initial +275 · Preview 0 B. Phase 5 누계 (Phase 4 끝 대비): Builder +2,369 · Preview −4 B — 결정 6 범위 안. (처음 잰 +13,522 는 측정 dist 가 `perf:build-dist` (`--sourcemap` — chunk 마다 주석 한 줄) 였기 때문 — 일반 `vite build` 로 다시 쟀다. 5b-1 의 +2,094 는 반올림 수정 전 빌드였다.)
- **live (production · headed Chrome · 1,000 행 · 「가상 스크롤」 · `--column-origin`, 하니스 `--check-group` 가상 경로 추가)**: Dept 「Group by column」 → `treegrid` · 묶음 12 의 개수 · 합계가 따로 센 값과 같음 → 「Dept 9 (101)」 펼침 → 표를 위에서 끝까지 스크롤하며 key 로 모은 자식 101 행 모두 Dept 9 · `aria-level` 2, **보이는 빈 행 0** (스크롤 10 번 · 매번 250 ms 뒤), DOM 행 최대 18, 펼침 표시 90° → 「Ungroup」. 같은 하니스 「더 보기」 표 PASS (회전 포함).

**증분 5b-3 — Canvas 의 작성 「Grouped」 (대칭 consumer — D3)**:

- **행** — Builder 행 source 가 묶음 조각을 받는다 (`catalogBuilderBoundRows(…, slices)` · `CatalogBuilderCore` 의 `rows`). resolver 의 「작성 Grouped 다시 읽기」 가 표 상태 없는 Canvas 에서도 돈다 — Canvas 는 표 상태가 없으니 작성 기본값 (모두 접힘) 그대로다. 접힌 묶음의 자리 자식은 Canvas 에 두지 않는다 (`CatalogRowGroups.closedChild: false` — RAC 가 없어 펼칠 것이 없고, 자식 Row 는 묶음 행 안 grid 에 그려진다). 묶은 열이 첫 열로 오는 투영 · 집계 · 「값 (개수)」 는 Preview 와 같은 경로다.
- **펼침 표시** — resolver 가 Canvas 의 최상위 묶음 행 묶은 칸에 `_treeCell` (`closed` · `open`) 을 단다 (`runtime/tableTreeCell.ts` — Cell 은 원본 instance 라 원본 루트로 넘기는 키 · accepts 밖 통과 둘을 같이 열었다, 구현 중 실측: 처음엔 표시가 record 에 닿지 않았다). 상자 모델이 칸 시작에 버튼 자리 (`1lh` + 간격 4 — `catalogTreeCellGlyph`, 칸 글자 14 / 18 → 22) 를 더하고 (`catalogBoxModel` — 엔진 · 글자 inset 이 같이 읽는다), Skia 가 그 자리에 lucide chevron-right (`1em`, 칸 글자색, 세로 가운데) 를 그린다 (`ruleShapes.ts` `treeCellChevronShapes`). DOM 은 RAC 의 Cell render prop 그대로 (표시를 받지 않는다 — Preview 에는 `_treeCell` 을 쓰지 않는다).
- **검사**: `adr315CanvasGroups.test.ts` 1 (Canvas record: 묶음 2 행 「B (2)」 · 「A (3)」 + 합계 · 중첩 Row 0 · 묶은 칸만 표시 · 왼쪽 여백 16 + 18 + 4 · chevron x 25 · y 칸 가운데 · 글자 14) · `tableGroupRows.test.ts` +1 (`closedChild: false`) · 변이 RED 10/10 (Builder 가 조각을 버림 · 다시 읽기를 Preview 만 · 자리 자식 유지 · `closedChild` 무시 · 표시 없음 · 표시가 원본 루트에 안 닿음 · 버튼 자리 없음 · 간격 없음 · chevron 없음 · chevron 이 칸 끝에서) · 회귀 새 실패 0 (shared 2,740 통과 · 실패 7 · builder 9,434 통과 · 실패 12 — 둘 다 착수 전 목록) · type-check PASS.
- **번들** (5b-2 대비): Builder +453 · Preview −1 B. Phase 5 누계: Builder +2,822 · Preview −5 B.
- **live (production · headed Chrome · 1,000 행, 하니스 `--check-authored-group` 새 모드 — 같은 행을 mock 으로도 실어 Builder Canvas 가 그린다)**: Dept 「Grouped」 · Amount 「Group aggregate」 Sum 작성 → Builder Canvas record: 머리글 [dept · name · city · amount · qty · date], 묶음 행 12 · 중첩 0 · 첫 셋 「Dept 9 (101)」 · 「Dept 0 (96)」 · 「Dept 8 (82)」 (묶은 칸만 `closed`) · 합계 453013.29 · 514612.6 · 399445.89 → Publish 첫 화면: `treegrid` · 머리글 Dept 첫 열 · 묶음 12 모두 접힘 · 개수 · 합계가 따로 센 값과 같음 (12/12). 두 화면 (`builder.png` 76 % · `check-authored-group.png`) 을 나란히 봤다 — 펼침 표시 자리 · 글자 시작 · 행 높이 (43) · 순서가 같다. 시각 대칭 하니스 (`/cross-check`) 는 사용자 결정으로 Phase 7.
- **하지 않은 것**: Canvas 에서 묶음을 펼쳐 보는 작성 상태 (Builder 는 늘 접힘 — Preview 의 상태) · 여러 단계 묶음의 안쪽 묶음 행 표시 (Canvas 는 최상위만 — 모두 접혀 있어 안쪽이 그려지지 않는다).

**증분 5c — 합계 행 (§5.4 「바닥 합계 행은 TableFooter 의 Row」)**:

- **타입** — RAC `TableFooter` 를 catalog 부품 타입으로 (`TableFooter.binding.ts` — 사용자 prop 0 · rule 은 TableBody 와 같은 상자 · DOM `INTERNAL_RENDERERS.tablefooter` · Layers 아이콘 · `TABLE_PART_TYPES`). 생성 CSS 는 바뀌지 않는다 (Table 가족은 `Table.css` 하나).
- **자리 = Table 원본의 빈 「Totals」 slot** (`lib:template:component-table__3` — 기본 내용 없음). 처음엔 Table 의 소유 자식으로 넣으려 했으나 원본 template 을 가진 instance 는 소유 자식을 template 자식 옆에 그리지 않는다 (TableBody 가 「Rows」 slot 인 것과 같은 방식으로). 기존 표는 빈 footer 라 열 정렬 검사에 걸리지 않는다. 스위치가 slot 을 Row 하나로 채운다 (`setTableTotalsRow` — 데이터 열의 칸은 `{열 key}`, 선택 열은 빈 칸, 숨긴 열의 칸은 그대로 숨김).
- **열 명령** — 열 추가 · 삭제 · 숨김 · 이동 · 정렬 검사가 body 와 footer 의 행을 같이 맞춘다 (`tableRowGroupsOf` — 한 곳, `tableBodyOf` 셋을 대체). footer 행의 새 칸도 `{열 key}` (`templateCell`).
- **값** — 조각 `totals` (Column 마다 — 「Group · totals aggregate」 가 없으면 빈 칸) 를 행 source 가 거르기 · 검색 · 정렬 뒤 **모든 행** 위에서 계산한다 (`catalogRowTotals` — 평가기 `viewAggregateOf`, 묶음 행과 같은 집계) — 「더 보기」 · 쪽 · 창 앞이다. `CatalogBoundRows.totals` 가 보이는 행 목록 (창 · 표본 · 고정 높이 잘림 · 정렬) 에도 붙고, resolver 가 footer slot 의 Row 에 `{ key: "totals" }` 행으로 넘긴다. 합계 행이 있는 표는 상태가 없어도 조각을 실어 다시 읽는다 (작성 「Grouped」 와 같은 길 — Canvas 도).
- **선택 열** — 합계 행은 선택되지 않으니 선택 Checkbox 가 없다. 그 칸을 선택 칸으로 알아보는 판정은 「선택 Column 과 같은 자리」 (`catalogTableSelectionColumn`) — 처음엔 선택 열이 숨는 표에서 칸 4 · 열 3 으로 RAC 가 예외를 냈다 (구현 중 실측).
- **패널** — 연결된 Table 의 Behavior 「Totals row」 스위치 (`CatalogTableTotalsSwitch` · `catalogRuntime/tableTotals.ts`). Column 「Group aggregate」 의 표시 문구를 「Group · totals aggregate」 · 「묶음 · 합계 집계」 로 (번역 키는 그대로).
- **검사**: `adr315TotalsRow.test.tsx` 1 (Preview: 스위치 → `tfoot` 행 [5 · — · 11] · 검색 「ra」 뒤 [2 · — · 5] · 열 추가 뒤 칸 정렬과 그 열의 집계 · 표 상태로 열 숨김 뒤 칸이 열을 따름 · 끄면 없음 · RAC 칸 수 오류 0) · `adr315CanvasGroups.test.ts` +1 (Canvas footer 행 [선택 · 5 · — · 2.75] · body 5 행) · 변이 RED 10/10 (조각 없음 · 검색 무시 · footer 행에 합계 안 넘김 · 다시 읽기 없음 · 보이는 행이 합계를 잃음 · 선택 칸 자리 판정 없음 · 열 명령이 footer 건너뜀 · 새 칸이 `{key}` 안 읽음 · 트랙이 footer 건너뜀 · 열 투영이 footer 건너뜀 — 마지막은 처음 GREEN, 표 상태로 열을 숨기는 반례를 더해 RED) · 회귀 새 실패 0 (처음 돌린 실패 3 은 새 타입 하나에 따른 등록 목록 게이트 — `componentCatalog` primitive 목록 · `phase3G3Census` 타입 수 182 → 183 · `adr301Expansion` Table 사용 코드에 빈 `TableFooter` — 의도대로 갱신; 나머지 shared 7 · builder 12 는 착수 전 목록) · type-check PASS.
- **번들** (5b-3 대비): Builder +1,024 · Preview 0 B. Phase 5 누계 (Phase 4 끝 대비): Builder +3,846 · Preview −5 B.
- **live (production · headed Chrome · 1,000 행, 하니스 `--check-totals` 새 모드 — 같은 행을 mock 으로도 실어 Builder Canvas 가 그린다)**: Name 「Count」 · Amount 「Sum」 · Qty 「Mean」 작성 + 「Totals row」 → Builder Canvas footer 행 record = [1000 · — · — · 4930124.66 · 247.844 · —] (행 생성기로 따로 센 값) → Publish: 가상 표는 끝까지 스크롤하면 footer 행이 표 안에 같은 값으로 (RAC Virtualizer 의 세 번째 rowgroup), 「더 보기」 표는 끝까지 불러온 뒤 `tfoot` 의 같은 값 — 보이는 행이 100 일 때도 합계는 1,000 행의 것. 둘 다 PASS. footer 는 sticky 가 아니다 (끝에 선다 — RAC 그대로, 아래 고정은 5f).
- **하지 않은 것**: 서버가 쪽을 나누는 표의 합계 (서버 집계 조회 — 5g) · 컴포넌트 안의 Table (안쪽 instance 의 slot 채움 경로) 의 합계 · 묶음과 합계를 같이 쓸 때 합계 행의 펼침 표시 자리 (묶은 열 칸은 비어 있다).

**증분 5d — 계층 데이터 (§5.4 「계층 데이터」)**:

- **작성** — 새 prop 없이 연결의 열 역할 둘 (Tree 의 것 — `fieldMap.parentId` 「Parent ID field」 · `fieldMap.children` 「Children field」) 을 Table 연결에도 연다 (`CollectionBinding.tsx`). §6 표의 「Child rows (계층 필드)」 가 이것이다.
- **데이터 층** — `dataBinding.ts` `treeBoundRows`: 조각 `tree` (`CatalogRowTree` — 펼친 행 key) 가 있으면 원본 전체를 한 평평한 목록으로 색인하고 (`catalogRowTreeIndex` — 부모 필드는 원본 그대로 + `parentRowsToTree`, 자식 배열은 깊이 우선으로 펼침; 행 key 는 목록 자리로 중복 표시 — 정렬 · 검색 · 펼침과 무관하게 같다), 그 목록 위에서 기존 정렬 (`sortedRowOrder`) · 검색 · 필터 (`keptRowOrder`) 를 한 번 돌린다 — 새 비교 없음. 남는 행 = 맞은 행 + 그 조상 (TanStack `filterFromLeafRows`), 단계마다 형제끼리 정렬 순서, 접힌 행은 자리 자식 하나 (5b-1 의 묶음과 같은 `…/collapsed` · Canvas 는 `closedChild: false`), 쪽 · 창 · 「더 보기」 는 최상위 행 (`paginateExpandedRows: false`), 합계는 남은 모든 단계의 행. 묶인 표는 행의 자식 행을 내지 않는다 (묶음이 행을 담는다).
- **resolver** — 행 source 가 `nested` (부모 · 자식 역할이 있는 연결) 를 표시하면 Table 은 표 상태가 있든 없든 나무 조각으로 한 번 더 읽는다 (작성 「Grouped」 · 합계 행과 같은 길 — 그 밖의 표는 비용 0). 행의 `tree` (단계 · 펼침 · 자식 유무) 를 5b-2 의 행 창 (`catalogShownGroupRows` — 닫힌 행 = 자식 있는 접힌 행) · `_expandedKeys` · Canvas 펼침 표시가 묶음 행과 같이 읽는다. 펼침 칸 (RAC `treeColumn`) 은 작성 순서의 첫 데이터 열 중 숨지 않은 것 (`catalogProjectTableColumns` `nested` — key 라서 열을 옮기면 같이 간다, S2 `treeColumn` 과 같다). 세션은 `_expandedKeys` 를 가진 표의 펼침이 바뀌면 행을 다시 읽는다.
- **구현 중 실측 2**: (1) 표 상태가 있는 표의 첫 읽기는 나무 조각 없이 최상위만 걸러 0 행이 될 수 있다 — 다시 읽기 조건이 「행 1 개 이상」 을 요구해 자식 배열 표의 검색이 빈 표가 됐다 (조건 제거, 변이 m15). (2) 다시 읽기를 Table 로 한정하지 않아 바운드 Tree 가 접힌 자리 자식을 받았다 (`treeData.test.tsx` 4 실패 — 회귀에서 찾음, 변이 m13).
- **검사**: `adr315TreeRows.test.tsx` 3 (부모 필드 · 자식 배열 각각: 최상위 접힘 · treegrid · 펼침 버튼 2 → r 펼침 `aria-level` 2 · 정렬 오름 · 내림이 단계마다 · 검색 「gim」 이 손자까지의 길만 · 합계 15 = 모든 단계; 쪽 크기 1 에서 펼친 행의 자식이 그 쪽에 · 쪽 수 2) · `adr315GroupWindow.test.tsx` +1 (가상 표 250 행 · 최상위 5: 창 = 펼친 순서 103 키 · 깊이 · 닫힌 행 · 평평한 record · DOM `aria-level`) · `adr315CanvasGroups.test.ts` +1 (Canvas 최상위 3 행 접힘 · 자식 있는 행만 첫 칸 표시 · 왼쪽 여백 16 + 18 + 4) · 변이 RED 16/16 (나무 조각 없음 · 조상 길 없음 · 형제 정렬 없음 · 자리 자식 없음 · 합계 최상위만 · 펼침 칸 없음 · `_expandedKeys` 없음 · 펼침 다시 읽기 없음 · 창의 닫힌 행 없음 · 창 평평 · Canvas 표시 없음 · Canvas 자식 Row · Tree 도 다시 읽음 · 자식 배열 색인 없음 · 다시 읽기가 행을 요구 · 쪽 무시) · 회귀 새 실패 0 (shared 2,741 통과 · 실패 7 · builder 실패 12 — 둘 다 착수 전 목록; 처음 builder 실행은 두 실행이 겹쳐 시간 초과 17 이 섞였고 그 7 파일은 혼자 돌려 99/99) · type-check PASS.
- **번들** (5c 대비): Builder +904 · Preview 0 B. Phase 5 누계 (Phase 4 끝 대비): Builder +4,750 · Preview −5 B.
- **live (production · headed Chrome · 1,000 행 원격 collection · 행마다 `parent` — 최상위 100 · r100 ~ r499 는 r(i % 100) 아래 · 나머지는 r(100 + i % 400) 아래, 하니스 `--check-tree` 새 모드 — 같은 행을 mock 으로도 실어 Builder Canvas 가 그린다)**: Builder Canvas record = 표본 17 행 모두 최상위 · 중첩 0 · 첫 칸만 `closed` → Publish `treegrid` · 첫 화면 모두 단계 1 · 접힘 · r0 ~ r3 순서 → r0 펼침: 바로 아래 단계 2 행 = [r100 · r200 · r300 · r400] (행 생성기로 따로 센 r0 의 자식) → Name 머리글 정렬: 최상위가 이름 순 (앱의 정렬 비교 — 숫자는 값으로) · r0 의 자식도 이름 순 [r200 · r300 · r400 · r100]. 가상 · 「더 보기」 둘 다 PASS (가상 표는 정렬 뒤 r0 이 화면 밖으로 가 자식 순서는 「더 보기」 에서 봤다), 페이지 오류 0. 두 화면 (`builder.png` · `check-tree-open.png`) 의 펼침 표시 자리 · 순서가 같다.
- **하지 않은 것**: 서버가 쪽을 나누는 표의 계층 (§4.3.1 의 전량 로드 — 5g) · Preview 의 Do 편집 (append · move …) 의 부모 지정은 여전히 Tree 연결에서만 (세션의 역할 조회 — data-interaction §6) · 표 상태가 있는 계층 표는 키 입력마다 행을 두 번 읽는다 (첫 읽기가 계층인지 모른다 — 묶음 · 합계와 같은 길).

**증분 5e — 상세 행 (§5.4 「상세 행」)**:

- **작성** — 연결된 Table 의 Behavior 「Detail row」 스위치 (`CatalogTableDetailSwitch` · `catalogRuntime/tableDetail.ts` · 명령 `setTableDetailRow`): Row 템플릿 (본문의 반복 Row) 의 칸 뒤에 Row 하나 (칸 하나 — 시작 글자는 첫 데이터 열의 `{key}`) 를 넣는다. 내용은 그 칸에 자유롭게 (Layers 에서). 끄면 지운다. Row 안 Row 는 RAC 의 중첩 `<Row>` 라 계약 `componentTraits` Row 의 받는 항목에 Row 를 더했다 (`assertNestable` 이 읽는다 — D1 그대로).
- **열 명령** — 열 추가 · 삭제 · 이동 · 교체 · 정렬 검사 · 템플릿 칸 채우기가 Row 의 칸만 센다 (`rowCells` — Row 자식은 칸이 아니다) · 칸 목록을 다시 쓸 때 상세 Row 는 칸 뒤에 남는다 (`rowDetailIds`).
- **resolver** — 문서에서 상세 Row 를 가진 표를 알아본다 (`tableHasDetailRow` — 「Rows」 slot 의 반복 Row 가 Row 를 품음). 데이터 행 (자식 행이 없는 행 — 묶음 · 계층의 잎 포함) 마다 `catalogDetailRows` 가 펼칠 수 있는 행으로 만들고 (`tree` — 5d 의 기구 그대로: `_expandedKeys` · 행 창 · Canvas 표시), 펼친 행은 상세 자식 (`detail` — 그 행의 값) 하나, 접힌 행은 자리 자식 하나 (Canvas 는 없음). 반복 자리 (`nestTableRows`) 가 상세 자식이면 Row 템플릿의 상세 Row 를 꺼내 (`rowDetailOf`) 행 key 를 모든 층에 쓰고 (`…/detail`), 그 밖의 행은 상세 Row 를 뺀다 (`withoutRowDetail`). Row 원본 instance 의 첫 자식은 같은 record 의 층이라 건너뛴다 — 처음엔 층까지 빼서 모든 행이 사라졌다 (구현 중 실측 1).
- **칸 폭** — 상세 칸은 그려지는 열 전부를 덮는다: 열 투영이 `colSpan` = 보이는 열 수 (숨긴 열 · 체크박스 선택이 아닌 표의 선택 열 제외) 를 준다 (`catalogProjectTableColumns` `detail` — 열을 옮기지 않은 표도). DOM `aria-colspan` · 트랙이 같이 읽는다.
- **모양** — 상세 Row 는 본문 행의 규칙 (구분선) 을 받는다: resolver 의 part rule 주인 판정이 Row 안 Row 를 그 바깥 Row 의 자리 (TableBody 아래) 로 본다 (RAC 가 중첩 행을 본문의 행으로 그리는 것과 같다). 처음엔 상세 행에 구분선이 없었다 (live 화면에서 찾음 — 템플릿 Row 의 구분선은 Table 의 「TableBody 를 지나 Row」 part rule 이었다; 템플릿 모양을 복사하는 첫 수정은 변이로 쓸모없음을 확인하고 지웠다).
- **증분 갱신** — 본문 (TableBody) 안 구조 변경의 갱신 영역을 Table 로 올린다 (`compositionRoot` — 행이 Table record 의 `treeColumn` · 펼친 행 · 열 투영을 정한다). 처음엔 연결 뒤 스위치를 켜면 Table 이 다시 해석되지 않아 treegrid 가 되지 않았다 (구현 중 실측 2).
- **Canvas** — 묶음 · 계층의 자식 행처럼 상세 행을 그리지 않는다 (모든 행 접힘 + 첫 데이터 칸 펼침 표시). Canvas 는 중첩 행을 바깥 행 상자 안 grid 로 그려 DOM 의 「다음 줄 행」 과 모양이 갈린다 — 상세 Row 는 Layers 에서 고르고 Preview 에서 본다.
- **검사**: `adr315DetailRow.test.tsx` 2 (스위치 → 모두 접힘 treegrid → Chan 펼침: `p2/detail` 단계 2 · 칸 하나 「Chan」 · `aria-colspan` 3 · 구분선이 본문 행과 같음 → 열 숨김 뒤 span 2 → 열 추가: 칸이 상세 앞 · span 3 → 열 삭제: span 2 · 상세 남음 → 끄면 펼칠 행 없음 · RAC 칸 수 오류 0; 가상 표 250 행: 창 = 펼친 순서 252 키 · 깊이 · 닫힌 행) · `adr315CanvasGroups.test.ts` +1 (Canvas 5 행 모두 `closed` · 중첩 0) · `componentTraits.test.ts` 계약 갱신 · 변이 RED 18/18 (상세 없음 · 늘 접힘 · 꺼내지 않음 · 빼지 않음 · 층까지 뺌 · 층에서 꺼냄 · span 없음 · 숨긴 열까지 셈 · 투영할 때만 span · Table 영역 안 올림 · 열 격자가 상세를 칸으로 셈 · Canvas 자식 행 · Canvas 표시 없음 · 계약에 Row 없음 · treeColumn 없음 · 상세 key 없음 · 열 추가가 상세를 잃음 · 상세 Row 의 규칙 주인이 Row — 처음 GREEN 셋 (층 안쪽 찾기 · 열 삭제 · 계약) 은 쓰이지 않는 분기를 지우고 열 삭제 반례 · `assertNestable` 을 더해 RED) · 회귀 새 실패 0 (shared 2,741 통과 · 실패 7 · builder 9,444 통과 · 실패 12 — 착수 전 목록) · type-check PASS.
- **번들** (5d 대비): Builder +1,026 · Preview +2 B. Phase 5 누계 (Phase 4 끝 대비): Builder +5,776 · Preview −3 B.
- **live (production · headed Chrome · 1,000 행 원격 collection, 하니스 `--check-detail` 새 모드 — 같은 행을 mock 으로도 실어 Builder Canvas 가 그린다)**: 「Detail row」 → Builder Canvas record = 표본 17 행 모두 첫 칸 `closed` · 중첩 0 → Publish `treegrid` · 모두 접힘 → r0 펼침: 바로 아래 `r0/detail` 단계 2 · 칸 하나 = r0 의 Name (행 생성기로 따로 읽은 값) · `aria-colspan` 6 (열 6) · 칸이 행 폭 전체 · 그다음 행 r1. 가상 · 「더 보기」 둘 다 PASS, 페이지 오류 0. 화면 (`check-detail-open.png`) 에서 상세 행 아래 구분선 확인.
- **하지 않은 것**: 선택 가능한 표에서 상세 행도 RAC 의 행이라 선택 대상이 된다 (S2 에 상세 행이 없어 막는 RAC 표면이 없다 — 막으려면 행 `isDisabled` 인데 흐린 모양이 따라온다). 접힌 행도 resolver 가 상세 Row 를 해석한 뒤 버린다 (record 는 만들지 않는다 — resolver CPU 만). 서버가 쪽을 나누는 표는 그대로 동작한다 (상세는 받은 행의 값만 읽는다).

(다음 Phase 의 기록은 여기에 이어 적는다)
