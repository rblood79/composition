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
| 11  | row-aggregation                 | 상태 없음 · `aggregationFn` 11 종                                                                                                          | 5 종 (`types.ts` `ViewAggregateFn`)                                                 | 묶음 행 · 바닥 합계 행 (`TableFooter`) 의 집계 칸 · 종류는 사용자 결정 4               | 묶기    |   5   |
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
- Phase 1 에서 key 기본값을 한 함수로 합친다 — 지금 `resolveTableColumnKey` 는 `col${index}`, 명령은 `column${index+1}` (`commands/collections.ts:893`).

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
- **열 메뉴**: S2 `ColumnWithMenu` 자리 (`domBinding.runtime.ts:5390`) 에 항목을 더한다 — 정렬 · 정렬에 추가 · 필터 · 숨기기 · 앞 / 뒤에 고정 · 고정 해제 · 왼쪽 / 오른쪽으로 · 크기 조절. 허용하지 않은 조작의 항목은 내지 않는다.
- **열 선택 메뉴**: Table 「열 숨김 허용」 을 켜면 표 위에 연결된 메뉴 (열 이름 checkbox 목록) 가 들어간다.
- **끌기** (사용자 결정 3): 머리글 안의 우리 손잡이 요소에 react-aria `useDrag` · `useDrop`. RAC Column 의 DOM 은 그대로. Phase 0 시제품 S5.
- **폭**: RAC 폭 상태 (`TableColumnResizeStateContext`) 의 끝난 폭을 `columnWidths` 로 올린다 (기억 대상).

### 5.4 행 (Phase 5)

- **펼침 행** — RAC 의 중첩 Row · `treeColumn` · `expandedKeys` (controlled). 세 용도가 같은 기구다:
  - 묶음 행: `grouping` 이 있으면 묶음마다 부모 Row (묶은 값 + 개수 + 집계 칸), 자식 = 그 묶음의 원본 행. 원본 행의 출처는 실행 자리에 따라 다르다 (§4.3.2 — 로컬은 행 번호, 서버는 자식 조회).
  - 계층 데이터: collection 의 부모 필드 (또는 자식 배열 필드) 를 표가 선언하면 행이 부모 · 자식이 된다. 부모 필드 방식은 원본 전체를 색인해야 해서 서버 실행 표에서는 전량 로드 규칙을 따른다 (§4.3.1). 행마다 자식을 조회하는 방식은 택하지 않는다 — 자식 유무를 미리 알 수 없어 모든 행에 펼침 표시가 붙는다.
  - 상세 행: 템플릿 Row 아래에 작성한 「상세」 Row (칸 하나, 열 전체 `colSpan`) 를 자식으로 낸다.
- **행 창과 펼침**: 창은 「보이는 평평한 순서」 위에서 계산한다 — 데이터 층이 펼친 상태로 평탄화한 행 번호 + 깊이 배열을 내고 (TanStack expanded row model 의 뜻), 창 안의 것만 중첩 Row 로 만든다. `catalogWindowRowChunks` 가 평평한 행을 가정하므로 (`domBinding.runtime.ts`) chunk 경계가 부모 · 자식을 가르는 경우가 Phase 0 시제품 S2 의 대상이다.
- **쪽과 펼침**: 쪽은 최상위 행으로 센다 (`paginateExpandedRows: false` 의 뜻) — 펼쳐도 쪽이 넘어가지 않는다.
- **집계**: 지금 5 종 + 사용자 결정 4. 바닥 합계 행은 `TableFooter` 의 Row 로 낸다 (선택 불가). 로컬 실행에서 묶음 행의 집계는 읽을 때 계산하고 하위 묶음 결과를 합친다 (count · sum · min · max 는 합칠 수 있고 mean · median 은 원본에서). 서버 실행에서는 단계마다 서버가 낸 값이다 (§4.3.2).
- **행 고정**: 데이터 층이 [위 고정 · 나머지 · 아래 고정] 으로 가른다. 위 고정은 머리글 아래 sticky, 아래 고정은 바닥 sticky. 가상 표에서의 방법 (layout 의 sticky 행 정보 · 별도 body 불가) 이 Phase 0 시제품 S3 다. 조작은 행 메뉴 · Do. 서버 실행 표에서는 고정 행이 지금 쪽에 없을 수 있어 조회가 둘이다 — 고정 조회 (표의 `where` + 요청 항목 `keys.only` — `keepPinnedRows` 를 켜면 표의 `where` 없이) 가 고정 행의 출처이고, 본문 조회에는 `keys.except` 를 실어 쪽 크기를 지킨다. key 는 필터 조건 (`oneOf` · `notEquals`) 으로 적지 않는다 — 대소문자만 다른 key 가 같이 잡힌다 (§4.3.3). endpoint 가 「key 로 행 조회」 를 선언하지 않았으면 행 고정을 받지 않는다 (§4.3.1).

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

### 5.7 Worker (Phase 7, 조건부)

- 조건: G0 · G3 의 10 만 행 측정에서 검색 입력 → 반영 p95 가 화면 스레드 계산 (이어 치기 포함) 으로 100 ms (1x) 를 넘는다.
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
|   1   | 표 상태 모델 · 세션 한 곳 (`tableSorts` · 폭 상태 이전) · 변수 · Do 노출 · 기억 층 (사용자 결정 1) · Column key 기본값 통합 · 조각 사이 규칙 · 번역 함수의 틀 · 실행 자리 판정 (§4.3.1) — 화면 동작은 그대로                                                                  |                 —                  |  G1  |
|   2   | 정렬: 여러 열 · 타입별 비교 · 옵션 · `ViewSort` 목록 · 서버 직렬화 (`sort` 배열 · `suffix` 「여러 정렬」 설정 · 담지 못하면 거절) · 순번 표시 (rule · Canvas)                                                                                                                 |            contract +1             |  G2  |
|   3   | 검색 · 열 필터 · 후보 값 · 이어 치기 · 유사 검색 (사용자 결정 2) · 필터 컨트롤 항목 source                                                                                                                                                                                    | (Phase 2 와 묶을 수 있으면 묶는다) |  G3  |
|   4   | 열: 투영 · 숨김 · 순서 · 고정 · 폭 기억 · 열 메뉴 · 열 선택 메뉴 · 끌기 (사용자 결정 3)                                                                                                                                                                                       |            contract +1             |  G4  |
|   5   | 행: 묶음 행 (로컬 행 번호 · 서버 묶음 조회 + 자식 조회) · 집계 (사용자 결정 4) · 합계 행 · 계층 · 상세 행 · 행 고정                                                                                                                                                           |            contract +1             |  G5  |
|   6   | 칸: 시각 병합 · 칸 범위 선택 · 복사 (사용자 결정 5) · D1 예외를 규칙 문서에                                                                                                                                                                                                   | (Phase 5 와 묶을 수 있으면 묶는다) |  G6  |
|   7   | Worker 조건 판정 · (조건 충족 시) 구현 · 로컬 상한 (사용자 결정 7) · 번들 · 규칙 문서 (`data-interaction.md` · `catalog-subparts.md`) · CHANGELOG · 종결 live                                                                                                                 |                 —                  |  G7  |

- 각 Phase 끝은 커밋 가능한 상태다. Phase 0 의 no-go 는 해당 Phase 의 범위를 줄이고 본문 「하지 않는 것」 에 사유를 더한다.
- 추정 규모: shared 40 ~ 55 · builder 25 ~ 35 파일 + 테스트. 실측과 1.5 배 넘게 벌어지면 Phase 0 인벤토리를 보강하고 사후 보고한다 (새 ADR 사유가 아니다).

## 9. 기록

- 2026-11-20 리뷰 round 1 (codex, [reviews/315.md](../reviews/315.md)) 반영 — H1: §4.3.1 · §5.1 (서버 실행 표는 요청이 담는 조각만 실행, 정렬을 줄여 보내지 않는다). H2: §4.3 · §4.4 (검색 대상은 가시성과 무관, 열 조각은 번역의 입력이 아니다). H3: §4.3.2 · §5.4 (묶음 조회 + 자식 조회, 담지 못하면 전량 로드). L4: 본문 Gates 집행 줄.
- 2026-11-20 리뷰 round 2 (codex — 수리 검증) 반영 — h4: §4.3.3 신설 (묶음의 행 · key 의 행은 필터 조건이 아니라 요청 항목 `groupOf` · `keys` — endpoint 선언 필요, 어긋나면 표시), §4.3.1 판정 · §4.3.2 · §5.4 · §5.2 후보 값 · §7.2 fixture.

(Phase 실행 기록은 여기에 이어 적는다)
