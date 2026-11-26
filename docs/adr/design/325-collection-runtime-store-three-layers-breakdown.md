# ADR-325 상세 설계 · Collection 실행 저장소 — 행 · 조회 결과 · 미저장 변경

[ADR 본문](../325-collection-runtime-store-three-layers.md) · 응용: [ADR-324](../324-collection-manual-batch-save.md)

작성 기준은 2026-11-26, HEAD `62ae56e6c` 위의 작업 트리다 (Publish 조회 수정 포함 — 줄 번호는 그 상태). 아래 형 · 규칙 · Phase 는 구현할 계약이고, 측정값은 G0 에서 잰다.

## 지금 구조 — 행을 든 자리와 읽는 곳

| 자리               | 무엇을 드는가                                                     | 키                               | 코드                                                                                           |
| ------------------ | ----------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Builder 가 보낸 행 | `CATALOG_DATA` 의 API 행 (Preview 만)                             | Collection id                    | [`runtimeRows`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L662)    |
| Collection 응답    | 세션이 부른 마지막 조회의 행 배열 (다음 페이지는 뒤에 붙임)       | Collection id                    | [`reloadedItems`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L694)  |
| 쪽 단위            | 쪽 목록 하나의 지금 쪽 행 · cursor 목록 · 전체 수                 | Collection id + 목록 노드        | [`pageUnits`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L735)      |
| 고정 행 응답       | Table 의 고정한 행 (key 로 따로 조회)                             | Table 노드 + 고정 목록           | [`pinAnswers`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L2583)    |
| 펼친 묶음 응답     | Table 의 펼친 묶음마다의 원시 행                                  | Table 노드 + 묶음 경로 + 조회 키 | [`groupAnswers`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L2593)  |
| 합계 응답          | Table 의 합계 행 (행이 아니라 집계 값)                            | Table 노드 + 조회 키             | [`totalsAnswers`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L2605) |
| 편집 기록          | `append` · `insert` · `update` · `updateMany` · `remove` · `move` | Collection id (순서 있는 목록)   | [`itemEdits`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L681)      |
| 저장된 편집        | 저장이 확인된 편집 번호                                           | 편집 번호                        | [`savedEdits`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L689)     |

읽는 곳 — [행 source](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L1196) (`itemSources` — 편집 기록을 바탕 행에 다시 적용) → [바운드 행](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L2375) → [`catalogBoundRows`](../../../packages/shared/src/catalog/runtime/dataBinding.ts#L202), 규칙의 항목 읽기 (`collectionItems` · `itemsByKeys` — [`Cells change` 는 고친 행 전체를 싣는다](../../../packages/shared/src/catalog/runtime/catalogTableController.ts#L904)), [편집 표시](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L1377), [저장 표시](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L1358). 고정 행 · 묶음 · 합계 응답은 표 controller 가 따로 읽는다.

확인한 사실

- 편집 기록의 다시 적용은 바탕 목록의 자리와 key 로 한다 ([`replayItemEdits`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L422)). 바탕이 바뀌면 위치 key (`row-N`) 와 자리 편집은 다른 행을 가리킨다.
- [`showLoaded`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L2128) 가 행을 바꾸며 편집 기록과 저장 표시를 지운다. [다음 페이지](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L2201) 는 편집이 적용된 보이는 행을 읽어 새 바탕으로 넘긴다.
- Builder 가 새 행을 보내면 Collection 응답만 버리고 편집 기록은 남는다 — 같은 세션 안에서 「조회가 편집을 지우는가」 가 길마다 다르다.
- 서로 다른 보기는 [`MULTI_VIEW`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L2000) — 요청에 싣지 않거나, instance 입력이 다른 보기면 전체를 상한까지 불러온다.
- 항목 key 는 바인딩 값 필드 → Collection key 필드 → `id` · `key` · `value` → 위치 ([`getItemKey`](../../../packages/shared/src/collections/resolveCollectionItems.ts#L340)), 세션의 편집은 Tree 바인딩의 값 필드 또는 Collection key 필드 ([`treeFieldKeyOf`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L1619)) 로 찾는다. Tree 가 아닌 목록에서 값 필드와 key 필드가 다르면 둘이 어긋날 수 있다 — G0 에서 재현 여부를 확인한다 (코드에서 추론, 미실행).

## 세 층의 형

저장소는 세션에서 떼어 낸 모듈 하나다 (`runtime/collectionStore.ts` — 세션 · DOM · graph 를 모른다, 단위 테스트 대상). 세션은 조회 · 편집 진입을 이 모듈의 함수로 바꾼다.

```ts
type RowKey = string;
type Row = Readonly<Record<string, unknown>>;

interface CollectionStore {
  /** 서버가 확인한 행 (작성 행 · Builder 가 보낸 행 포함). 편집은 여기 쓰지 않는다. */
  readonly rows: Map<RowKey, Row>;
  /** 요청 하나의 결과 — 풀린 주소와 본문이 키다. */
  readonly results: Map<QueryKey, QueryResult>;
  /** 저장되지 않은 변경. */
  readonly changes: Map<RowKey, RowChange>;
  /** 자리 편집 (넣은 자리 · 옮기기) — 순서를 가진 조회 결과에만 적용한다. */
  readonly order: readonly OrderEdit[];
}

type QueryResult =
  | {
      kind: "rows";
      keys: RowKey[];
      cursor?: string;
      total?: number;
      state: CatalogLoadingState;
      /** 이 결과를 읽는 곳 (바인딩 노드 · 쪽 목록 · Table 의 묶음 · 고정 행). 0 이면 지운다. */
      readers: Set<string>;
    }
  | {
      kind: "value";
      value: Row;
      state: CatalogLoadingState;
      readers: Set<string>;
    };

type RowChange =
  | {
      kind: "update";
      /** 필드마다: 처음 고칠 때의 값 · 지금 값 · 마지막 편집 번호 · 그 뒤 서버가 준 다른 값. */
      fields: Record<
        string,
        { base: unknown; value: unknown; seq: number; server?: unknown }
      >;
    }
  | { kind: "insert"; row: Row; seq: number }
  | { kind: "remove"; seq: number };
```

읽기는 함수 하나 — `visibleRows(store, queryKey)` 가 조회 결과의 키 목록을 행으로 바꾸고 변경을 덧씌운다. 변경이 없는 행은 저장소의 행 객체 그대로다 (계산 필드 셀 캐시가 행 객체로 기억하므로 객체를 새로 만들지 않는다). 결과는 조회 결과 · 변경의 revision 으로 기억한다.

## 규칙

**합치기** (TanStack DB 의 트랜잭션 안 규칙과 같다)

| 앞 변경 | 뒤 편집                 | 결과                                              |
| ------- | ----------------------- | ------------------------------------------------- |
| 없음    | 고침                    | 고침 — 그 필드의 지금 값을 `base` 로 적는다       |
| 고침    | 같은 필드 고침          | 고침 — `base` 는 처음 것, `value` · `seq` 만 바뀜 |
| 고침    | `base` 와 같은 값으로   | 그 필드가 빠진다. 남은 필드가 없으면 변경도 없다  |
| 넣기    | 고침                    | 넣기 — 넣은 행의 값이 바뀐다                      |
| 넣기    | 지우기                  | 변경 없음                                         |
| 고침    | 지우기                  | 지우기                                            |
| 지우기  | (그 key 로) 넣기 · 고침 | 거절 — 지금 `update` 가 없는 항목을 거절하는 대로 |

값의 같음은 schema 의 타입으로 판정한다 (`null` · 빈 문자열 · `0` · `false` 를 서로 같다고 보지 않는다 — 지금 `itemFields` 가 읽는 값 그대로).

**조회가 올 때** — 응답의 행을 행 저장소에 넣고 조회 결과의 키 목록을 바꾼다. 변경은 그대로다. 고침의 필드에 대해 새 서버 값이 `base` 와도 `value` 와도 다르면 `server` 에 적는다 (다른 사람이 바꿨다는 사실 — 화면 처리는 324). 서버 값이 `value` 와 같아졌으면 그 필드는 빠진다.

**저장 확인** — `confirmChanges(seqs, serverRows?)`: 그 편집 번호까지의 필드를 행 저장소에 옮긴다 (서버가 돌려준 행이 있으면 그 값). 보낸 뒤 다시 고친 필드 (`seq` 가 더 큼) 는 남고 그 `base` 는 방금 확인한 값이 된다. 지금의 `markEditsSaved` 가 이 함수가 된다.

**버리기** — `discardChanges(collectionId, keys?)`: 변경과 자리 편집만 지운다. 행 저장소 · 조회 결과는 그대로다.

**자리** — 넣기 · 옮기기는 「어느 key 의 앞 · 뒤 · 처음 · 끝 · 어느 부모 아래」 로 적는다. 순서를 가진 조회 결과 (작성 행 · 서버 정렬이 없는 기본 조회 · 여기서 도는 보기의 입력) 에 적용하고, 기준 key 가 그 결과에 없으면 끝에 둔다. 서버가 정렬 · 거른 조회 결과에서는 자리 편집을 적용하지 않는다 — 고친 행은 제자리, 넣은 행은 그 보기의 조건을 평가기로 판정해 맞으면 끝에 (사용자 결정 3).

**키** — 저장소의 키는 Collection 의 key 필드 → `id` · `key` · `value` 다. 바인딩의 값 필드는 컴포넌트가 RAC 에 주는 항목 key 이고, 세션이 그 key ↔ 저장소 키를 바꿔 준다. 키가 없는 Collection 은 조회 결과 안의 위치 (`row-N`) 가 키다 — 작성 행은 실행 중 바뀌지 않으므로 지금처럼 동작하고, 원격은 조회 결과가 바뀌면 그 변경을 버린다 (사용자 결정 1).

**조회 키** — Collection id + 풀린 주소 + 본문 (지금 `loadedUrls` 가 「같은 요청」 을 판정하는 글자). 쪽 · 묶음 · 고정 행 요청도 같은 규칙이다.

**요청** — 서버가 받는 보기는 보기마다 조회 결과를 갖는다. 그 Collection 의 조건 없는 전체 조회 결과가 끝까지 불러와져 있으면 (cursor 없음) 다른 보기는 요청 없이 평가기로 답한다. 동시 요청은 지금 묶음 조회의 상한 (6) 을 같이 쓴다. 늦은 응답은 조회 결과마다의 순번으로 버린다.

**수명** — 읽는 곳이 0 인 조회 결과는 지운다. 어느 조회 결과에도 없고 변경도 없는 행은 지운다. 변경이 붙은 행은 남긴다.

## 바뀌는 동작

| 동작                                 | 지금                                         | 이 ADR 뒤                                       |
| ------------------------------------ | -------------------------------------------- | ----------------------------------------------- |
| 고친 뒤 다음 페이지                  | 값은 남고 「저장 안 됨」 표시가 사라짐       | 값 · 표시 모두 남음                             |
| 고친 뒤 검색 · 정렬 (서버)           | 편집이 사라짐                                | 남음 — 고친 행이 결과에 있으면 고친 값으로 보임 |
| 규칙의 「다시 불러오기」             | 편집이 사라짐                                | 남음, 버리기는 취소 동작 (사용자 결정 2)        |
| 주기 조회 (Publish)                  | 저장 안 된 편집이 있으면 그 주기를 건너뜀    | 건너뛰지 않음 — 조회하고 변경은 남음            |
| 조건이 다른 두 컴포넌트              | 보기를 싣지 않거나 전체를 불러옴 (1 만 상한) | 각자 요청                                       |
| 쪽 목록 · 묶음 · 고정 행에서 고친 행 | 자리마다 다름                                | 어디서나 같은 값                                |
| Builder 가 새 행을 보냄 (Preview)    | 편집 기록 유지                               | 같음                                            |
| 키 없는 원격 Collection              | 편집됨, 조회하면 사라짐                      | 같음 + Data 패널 안내 (사용자 결정 1)           |

## 구현 순서와 검증

| 단계                                 | 작업과 출구 조건                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 0 · 기준선 (G0)                | 위 표의 자리 · 읽는 곳을 grep 으로 다시 세어 고정한다. 「바뀌는 동작」 을 단언하는 기존 테스트와 규칙 문서 줄 ([data-interaction.md](../../../.claude/rules/data-interaction.md) §6 `reload` · 「쪽 단위」) 을 목록으로 적는다. 재현 테스트 셋 (다음 페이지 뒤 표시 · 두 보기 · 키 어긋남) 과 HEAD 의 ratchet 카운트 · 10 만 행 정렬 · 편집 시간을 기록한다. |
| Phase 1 · 행 저장소 · 조회 결과 (G1) | `collectionStore.ts` 와 그 단위 테스트. Collection 응답 · Builder 행을 옮기고, 이어서 쪽 단위 · 고정 행 · 묶음 · 합계를 옮긴다. 편집은 아직 옛 기록을 보이는 행 위에 다시 적용한다 (동작 무변경). 읽는 곳을 `visibleRows` 로 모으고 정적 검사를 둔다.                                                                                                        |
| Phase 2 · 미저장 변경 (G2)           | 편집 진입 여섯이 변경 층에 쓰고, 편집 표시 · 저장 표시 · `Cells change` 의 편집 번호가 그 층에서 나온다. 조회가 변경을 지우지 않는다. 취소 함수. Publish 주기 조회의 건너뛰기 규칙을 지운다.                                                                                                                                                                 |
| Phase 3 · 여러 조회 (G3)             | 보기마다 조회 결과, 전체가 있으면 로컬 답, 동시 요청 상한, 조회 결과별 순번. `MULTI_VIEW` 의 전체 불러오기 분기를 지운다 (서버가 못 받는 보기의 로컬 실행은 남는다). 서버 목록 안 자리 규칙 (사용자 결정 3).                                                                                                                                                 |
| Phase 4 · 속도 · 수명 (G4)           | 덧씌운 결과 기억, 읽는 곳 없는 결과 · 행 정리, ratchet · 10 만 행 A/B · 번들.                                                                                                                                                                                                                                                                                |
| Phase 5 · 실제 경로 · 문서 (G5)      | Builder → Publish live (Chrome · WebKit). 규칙 문서 · skill reference · CHANGELOG. ADR-324 (2026-11-26 이 층 위의 결정으로 개정됨) 의 G0 전제를 닫는다.                                                                                                                                                                                                      |

| 독립 검증 사례                                           | 관찰할 결과                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1 쪽에서 세 칸 고침 → 다음 페이지 → 정렬 → 다시 불러오기 | 세 칸의 값 · 표시가 남는다. 고친 행이 결과에 없을 때도 「저장 안 됨 3」 은 3 이다.             |
| `3 → 5 → 8`, `3 → 8 → 3`, 넣고 지움                      | 변경 1 · 0 · 0. `base` 는 3.                                                                   |
| 보낸 뒤 응답 전에 같은 칸을 다시 고침 → 저장 확인        | 그 칸만 변경으로 남고 `base` 는 보낸 값.                                                       |
| 조건이 다른 Table 과 Chart 가 같은 Collection            | 요청 2 (fetch 대역에서 셈), 전체 불러오기 0. 전체 조회가 끝까지 와 있으면 추가 요청 0.         |
| 쪽 목록의 2 쪽에서 고친 행이 다른 Table 에도 있음        | 두 곳이 같은 값.                                                                               |
| 편집 중 주기 조회 · Builder 새 행 · 늦게 온 이전 응답    | 변경이 남고, 늦은 응답은 자기 조회 결과만 바꾼다.                                              |
| 키 없는 Collection 에서 넣기 · 지우기 뒤 고침            | 작성 행: 고친 값이 같은 항목에 남는다. 원격: 다시 조회하면 그 변경이 사라진다 (사용자 결정 1). |
| 10 만 행 로컬 묶기 표에서 한 칸 고침                     | HEAD 대비 시간이 노이즈 폭 안, 다시 만든 행 객체 수 = 바뀐 행 수.                              |

정답 값은 테스트에 손으로 적는다. 요청 수는 `fetch` 대역에서 센다. 속도는 같은 문서를 HEAD 와 교대 3 쌍으로 잰다 (방향만 — 카운트가 판정).

## 외부 조사 요약

2026-11-26 조사 (공식 문서를 요약 도구로 읽음 — 문서에 문장을 인용하려면 원문 대조가 필요하다).

| 대상                           | 가져온 것                                                                                                               | 출처                                                                                                                                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack DB                    | 동기화 값과 낙관적 상태를 따로 든다 · 수동 커밋 트랜잭션 · 변경마다 `original` · `changes` · 합치기 규칙                | [개요](https://tanstack.com/db/latest/docs/overview) · [변경](https://tanstack.com/db/latest/docs/guides/mutations)                                                                                                                                     |
| TanStack DB (주의)             | 대기 중인 트랜잭션 사이에는 행 통째 스냅샷이 이긴다 (필드별로 합치지 않음) · 변경이 있어도 Collection 이 정리될 수 있다 | 같은 문서 — 그래서 필드 단위 `base` 와 「변경이 붙은 행은 남긴다」 를 둔다                                                                                                                                                                              |
| Relay · Replicache             | 저장소가 바뀌면 낙관적 변경을 걷고 새 값을 넣은 뒤 다시 적용한다                                                        | [Relay](https://relay.dev/docs/guided-tour/updating-data/graphql-mutations/) · [Replicache](https://doc.replicache.dev/concepts/how-it-works)                                                                                                           |
| Apollo                         | 타입 + id 로 정규화한 표 · 낙관적 객체는 정본을 덮지 않는 별도 사본                                                     | [캐시](https://www.apollographql.com/docs/react/caching/overview) · [낙관적 UI](https://www.apollographql.com/docs/react/performance/optimistic-ui)                                                                                                     |
| TanStack Query · RTK Query     | 조회 키 → 응답 사본. 낙관적 쓰기가 재조회에 덮이고, 겹친 변경의 되돌리기가 경합한다 (대안 C 의 기각 근거)               | [낙관적 갱신](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) · [RTK 수동 갱신](https://redux.js.org/toolkit/rtk-query/usage/manual-cache-updates)                                                                    |
| DevExtreme · MUI X · Ext JS    | 미저장 변경은 행 캐시 밖의 key 목록 (`{type, key, data}` · 행 id 로 든 두 표 · 바뀐 필드만 쓰기)                        | [DevExtreme](https://js.devexpress.com/jQuery/Demos/WidgetsGallery/Demo/DataGrid/EditStateManagement/) · [MUI X](https://mui.com/x/react-data-grid/recipes-editing/) · [Ext JS](https://docs.sencha.com/extjs/7.8.0/modern/Ext.data.writer.Writer.html) |
| AG Grid · MUI X 서버 데이터    | 묶음은 묶음 키를 실은 요청으로 하나씩 · 다시 불러와도 행 id 로 상태를 지킨다                                            | [AG Grid 묶기](https://www.ag-grid.com/javascript-data-grid/server-side-model-grouping/) · [새로 고침](https://www.ag-grid.com/javascript-data-grid/server-side-model-updating-refresh/)                                                                |
| Retool · Appsmith · Power Apps | 변경은 기본키 + 바뀐 열 · 여러 행 편집은 기본키가 전제 · 서버로 못 보내는 조회를 그 자리에 경고한다                     | [Retool](https://docs.retool.com/apps/guides/data/table/columns) · [Appsmith](https://docs.appsmith.com/reference/widgets/table/inline-editing) · [Power Apps 위임](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview) |

찾지 못한 것 — 서버 데이터에서 「재조회 뒤에도 미저장 편집 유지」 를 기본 기능으로 문서화한 그리드. 이 부분은 동기화 라이브러리의 구조를 옮긴 것이다.

## ADR-324 와의 경계

| 이 ADR (325)                                          | ADR-324                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| 변경을 어떻게 들고 합치는가, 조회와 어떻게 공존하는가 | 변경을 언제 보내는가 (즉시 · 사용자가 누를 때)                  |
| `base` · `server` 값을 적어 둔다                      | 충돌을 어떻게 보이고 풀게 하는가                                |
| `confirmChanges` · `discardChanges` 함수              | 저장 · 취소 Do 와 그 패널, 저장 막대 · 닫기 경고                |
| 문서 스키마 무변경                                    | Collection 의 쓰기 연결 설정 · 연결이 선언하는 능력 · 요청 본문 |
| 세션 메모리 안의 변경                                 | 새로고침 · 탭 닫기 뒤 보존 여부                                 |
