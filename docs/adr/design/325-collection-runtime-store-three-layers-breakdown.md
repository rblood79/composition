# ADR-325 상세 설계 · Collection 실행 저장소 — 행 · 조회 결과 · 미저장 변경

[ADR 본문](../325-collection-runtime-store-three-layers.md) · 응용: [ADR-324](../324-collection-manual-batch-save.md)

작성 기준은 2026-11-26, HEAD `62ae56e6c` 위의 작업 트리다 (Publish 조회 수정 포함 — 줄 번호는 그 상태). 아래 형 · 규칙 · Phase 는 구현할 계약이고, 측정값은 G0 에서 잰다. 2026-11-27 에 리뷰 round 1 (HIGH 6 — [기록](../reviews/325.md)) 을 반영했다: 보낸 변경의 스냅샷과 행 단위 판정, 행 값의 순번, 키 없는 원격 행의 격리, 요청 키 · 목록 · 완전성.

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
/** 요청 하나의 정체 — 실제로 fetch 하는 주소 · method · 본문. 요청을 만들 때 한 번 계산한다. */
type RequestKey = string;
/** 이어 붙는 페이지들의 정체 — Collection id + cursor 없는 첫 요청의 RequestKey. */
type ListKey = string;

interface CollectionStore {
  /** 서버가 확인한 행 (작성 행 · Builder 가 보낸 행 포함). 편집은 여기 쓰지 않는다. */
  readonly rows: Map<RowKey, StoredRow>;
  /** 요청 하나의 결과. */
  readonly results: Map<RequestKey, QueryResult>;
  /** 결과들을 어느 목록에 이어 붙이는가, 그 목록을 끝까지 모았는가. */
  readonly lists: Map<ListKey, QueryList>;
  /** 저장되지 않은 변경 — 사용자의 지금 의도. */
  readonly changes: Map<RowKey, RowChange>;
  /** 보냈고 판정이 끝나지 않은 변경의 스냅샷. */
  readonly sends: Map<string, SendTicket>;
  /** 자리 편집 (넣은 자리 · 옮기기) — 순서를 가진 조회 결과에만 적용한다. */
  readonly order: readonly OrderEdit[];
}

interface StoredRow {
  /** `null` = 삭제가 확정된 자리 (흔적). 더 이른 순번의 응답이 그 행을 다시 넣지 못하게 남긴다. */
  row: Row | null;
  /** 이 값을 쓴 요청 · 저장 판정의 순번 (세션에서 하나씩 오르는 수). 더 이른 순번의 응답은 이 행을 바꾸지 못한다. */
  at: number;
  /** 필드마다 마지막으로 확정한 편집 번호 — 더 작은 편집 번호의 확정은 그 필드를 쓰지 못한다. */
  confirmed?: Record<string, number>;
}

type QueryResult =
  | {
      kind: "rows";
      keys: RowKey[];
      cursor?: string;
      total?: number;
      state: CatalogLoadingState;
      /** 이 결과를 채운 요청이 출발한 순번 — 더 이른 요청의 응답은 키 목록을 바꾸지 못한다. */
      at: number;
      /** 키 목록이 통째로 바뀔 때마다 오른다 — 키 없는 행의 정체에 쓴다. */
      generation: number;
      /** 키 목록, 또는 그 키의 행 값이 바뀔 때마다 오른다 — `visibleRows` 의 기억 키. */
      revision: number;
    }
  | {
      kind: "value";
      value: Row;
      state: CatalogLoadingState;
      at: number;
      revision: number;
    };

interface QueryList {
  /** 받은 순서의 결과 — 「더 보기」 는 이어 읽고, 쪽 목록은 읽는 곳이 고른 한 장을 읽는다. */
  pages: RequestKey[];
  /** 조건 · 쪽 범위를 싣지 않은 조회인가 (전체 범위의 후보). */
  whole: boolean;
  /** 끝까지 모았는가 — 아래 「완전성」 으로만 true 가 된다. */
  complete: boolean;
  /** 이 목록을 읽는 곳 (바인딩 노드 · 쪽 목록 · Table 의 묶음 · 고정 행 · 합계). 0 이면 지운다. */
  readers: Set<string>;
}

type RowChange =
  | {
      kind: "update";
      /** 처음 고칠 때 행 저장소에 있던 행 — 재조회가 그 행을 바꿔도 그대로다. */
      baseRow: Row;
      fields: Record<string, FieldChange>;
    }
  | { kind: "insert"; row: Row; seq: number }
  /** `baseRow` 없음 = 보낸 넣기의 판정을 기다리는 지우기. */
  | { kind: "remove"; baseRow?: Row; seq: number }
  /**
   * 서버에 만들어졌지만 key 를 모르는 행의 뒤 편집 — `sent` 는 서버가 받은 값, `row` 는 지금 값.
   * 서버 행과 연결하거나 사용자가 버릴 때까지 남는다 (보낼 수 없다).
   */
  | { kind: "unlinked"; sent: Row; row: Row; removed?: true; seq: number };

/** 필드마다: 처음 고칠 때의 값 · 지금 값 · 마지막 편집 번호 · 그 뒤 서버가 준 다른 값. */
interface FieldChange {
  base: unknown;
  value: unknown;
  seq: number;
  server?: unknown;
}

/** 보낸 순간의 변경 — 판정이 끝날 때까지 뒤 편집과 따로 든다. */
interface SendTicket {
  id: string;
  collectionId: string;
  entries: SentEntry[];
}
type SentEntry =
  | {
      key: RowKey;
      kind: "update";
      baseRow: Row;
      fields: Record<string, { value: unknown; seq: number }>;
    }
  | { key: RowKey; kind: "insert"; row: Row; seq: number }
  | { key: RowKey; kind: "remove"; baseRow: Row; seq: number };

/** 행 하나의 판정. `unknown` 은 티켓에 남는다. */
type SendOutcome =
  /** `serverKey: null` = 서버가 만든 key 를 모른다 — 넣기는 닫고, 뒤 편집이 있으면 `unlinked` 로 남긴다. */
  | { key: RowKey; result: "confirmed"; row?: Row; serverKey?: RowKey | null }
  | { key: RowKey; result: "rejected" }
  | { key: RowKey; result: "unknown" };
```

읽기는 함수 하나 — `visibleRows(store, listKey, page?)` 가 목록 (또는 그 한 장) 의 키를 행으로 바꾸고 변경을 덧씌운다. 변경이 없는 행은 저장소의 행 객체 그대로다 (계산 필드 셀 캐시가 행 객체로 기억하므로 객체를 새로 만들지 않는다). 결과는 읽은 조회 결과들의 `revision` 과 변경의 revision 으로 기억한다 — 다른 조회의 응답이 같은 행을 바꾸면 그 key 를 든 모든 결과의 `revision` 이 오르므로 (아래 「조회가 올 때」) 기억이 낡지 않는다.

## 규칙

**합치기** (TanStack DB 의 트랜잭션 안 규칙과 같다)

| 앞 변경 | 뒤 편집                 | 결과                                                                |
| ------- | ----------------------- | ------------------------------------------------------------------- |
| 없음    | 고침                    | 고침 — 그 필드의 지금 값을 `base` 로, 지금 행을 `baseRow` 로 적는다 |
| 고침    | 같은 필드 고침          | 고침 — `base` 는 처음 것, `value` · `seq` 만 바뀜                   |
| 고침    | `base` 와 같은 값으로   | 그 필드가 빠진다. 남은 필드가 없으면 변경도 없다                    |
| 넣기    | 고침                    | 넣기 — 넣은 행의 값이 바뀐다                                        |
| 넣기    | 지우기                  | 변경 없음                                                           |
| 고침    | 지우기                  | 지우기 (`baseRow` 는 고침의 것)                                     |
| 지우기  | (그 key 로) 넣기 · 고침 | 거절 — 지금 `update` 가 없는 항목을 거절하는 대로                   |

값의 같음은 schema 의 타입으로 판정한다 (`null` · 빈 문자열 · `0` · `false` 를 서로 같다고 보지 않는다 — 지금 `itemFields` 가 읽는 값 그대로).

**보낸 변경이 판정을 기다리는 동안** — 그 key · 필드가 열린 `SendTicket` 에 있으면 위 표의 두 「사라짐」 을 미룬다. 보낸 값을 서버가 받았는지 모르는 채 변경을 지우면, 서버가 그 값을 확정했을 때 사용자의 뒤 편집을 보낼 근거가 없어진다.

| 보낸 것 (판정 전) | 뒤 편집               | 결과                                                            |
| ----------------- | --------------------- | --------------------------------------------------------------- |
| 고침              | `base` 와 같은 값으로 | 필드가 남는다 (`value` = `base`) — 판정 때 다시 계산한다        |
| 넣기              | 지우기                | 지우기로 남는다 (`baseRow` 없음) — 행은 안 보이고 넣기는 티켓에 |
| 고침              | 지우기                | 지우기 (위 표와 같다)                                           |

**보내기** — `beginSend(collectionId, keys?)` 가 그 순간의 변경을 `SendTicket` 으로 찍는다 (행 · 필드마다 보낸 값과 편집 번호, `baseRow`). 편집은 계속된다.

**판정** — `settleSend(ticketId, outcomes)` 가 행마다 판정을 받는다. 한 번의 붙여넣기가 여러 행에 같은 편집 번호를 주므로 ([`updateMany`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L1587)) 확정의 단위는 편집 번호가 아니라 **행 key + 필드 + 보낸 편집 번호** 다. 일부 행만 판정해도 된다 — 모든 행이 `confirmed` · `rejected` 가 되면 티켓이 닫힌다.

| 보낸 것  | 판정        | 그 뒤 편집이 없다                                                                                               | 그 뒤 편집이 있다                                                                                        |
| -------- | ----------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 고침     | `confirmed` | 필드가 빠지고 행 저장소의 값 = 확인한 값                                                                        | `base` = 확인한 값. `value` 가 그 값과 같으면 빠지고, 다르면 남는다 (`3 → 5` 보낸 뒤 `3` → 고침 `5 → 3`) |
| 고침     | `rejected`  | 변경이 그대로 남는다                                                                                            | `base` 는 그대로. `value` 가 `base` 와 같으면 빠진다 (`3 → 5` 보낸 뒤 `3` → 변경 없음)                   |
| 넣기     | `confirmed` | 변경이 빠지고 행이 서버 key (없으면 보낸 key) 로 들어간다                                                       | 뒤 고침 = 그 key 의 고침 (`base` = 확인한 값). 뒤 지우기 = 그 key 의 지우기 (`baseRow` = 확인한 행)      |
| 넣기     | `rejected`  | 넣기가 남는다                                                                                                   | 뒤 지우기면 변경 없음                                                                                    |
| 지우기   | `confirmed` | 변경이 빠지고 그 key 를 든 결과의 키 목록에서 빠진다. 행 저장소에는 삭제 흔적 (`row: null` · 새 순번) 이 남는다 | —                                                                                                        |
| 지우기   | `rejected`  | 지우기가 남는다                                                                                                 | —                                                                                                        |
| 무엇이든 | `unknown`   | 티켓에 남는다 — 위 「판정을 기다리는 동안」 이 이어진다                                                         | 같다                                                                                                     |

확인한 값은 서버가 돌려준 행이 있으면 그 값, 없으면 보낸 값이다. 확정한 행은 그 순간의 새 순번을 `at` 으로 받는다 — 판정보다 먼저 출발한 조회의 응답이 확인한 값을 옛 값으로 되돌리지 못한다. `confirmed` 는 `baseRow` 를 확인한 행으로 바꾼다.

**확정의 순서** — 판정이 보낸 순서대로 오지 않는다. 같은 칸을 `5` (편집 번호 1) · `8` (편집 번호 2) 로 두 번 즉시 저장하면 성공 응답이 2 → 1 순으로 올 수 있다 ([규칙마다 따로 끝나는 요청](../../../packages/shared/src/interactions/bindings.ts#L146)). 그래서 행 저장소가 필드마다 마지막으로 확정한 편집 번호를 든다 (`confirmed`). 고침의 `confirmed` 판정은 보낸 편집 번호가 그 수보다 클 때만 그 필드의 값 · `base` 를 쓴다 — 작으면 값을 쓰지 않고 티켓의 그 필드만 닫는다 (`at` 도 그대로). 위 예에서 편집 번호 2 가 먼저 확정되면 행은 `8` 이고, 늦게 온 편집 번호 1 의 확정은 `5` 를 쓰지 못한다. 순서가 1 → 2 면 위 판정 표 그대로다 (1 확정 → `base` 5 · `value` 8 남음 → 2 확정 → 빠짐). 「늦게 보낸 편집이 서버에서도 나중에 반영됐다」 는 가정이고, 어긋나면 다음 조회가 바로잡는다 (아래 조회 순번의 가정과 같다).

**key 를 모르는 넣기** — 넣기의 `serverKey: null` (서버가 행을 만들었지만 key 를 알 수 없다 — 324) 은 넣기를 닫는다 (다시 보내지 않는다). 그 행의 뒤 편집이 없으면 임시 행도 빠진다. 뒤 편집 (고친 칸 · 지우기) 이 있으면 변경을 `unlinked` 로 바꿔 남긴다 — 사용자 입력을 버리지 않는다. `unlinked` 는 미저장 건수에 들고 보낼 수 없다 (서버 식별자가 없다). 끝나는 길은 둘이다.

- `linkUnlinked(collectionId, key, serverKey)` — 서버 행과 잇는다: `row` 와 `sent` 가 다른 필드는 그 서버 key 의 고침 (`base` = 서버 행의 값) 이 되고, `removed` 는 그 key 의 지우기 (`baseRow` = 서버 행) 가 된다.
- `discardChanges` — 사용자가 버린다.

잇는 것은 사용자의 선택이다 — 저장소도 세션도 스스로 `linkUnlinked` 를 부르지 않는다 (324, 사용자 결정 2026-11-27).

지금의 즉시 저장 (`markEditsSaved`) 은 이 두 함수가 된다 — 규칙이 `callEndpoint` 를 보낼 때 그 편집 번호의 (key · 필드) 를 `beginSend` 하고, 요청 하나가 그 편집 전부를 실으므로 응답이 오면 전부 `confirmed` (실패면 전부 `rejected`) 로 판정한다. [지금의 판정](../../../packages/shared/src/interactions/bindings.ts#L133) · [`markEditsSaved`](../../../packages/shared/src/catalog/runtime/catalogPreviewSession.ts#L1359)

**기준 바꾸기** — `rebaseChange(collectionId, key, row)`: 그 행의 `baseRow` 를 주어진 서버 행으로, 필드의 `base` 를 그 행의 값으로 바꾸고 `server` 를 지운다. `value` 가 새 `base` 와 같아진 필드는 빠진다. 사용자가 충돌에서 「내 값으로 다시 저장」 을 골랐을 때만 부른다 (324) — 재조회는 `baseRow` 를 바꾸지 않는다.

**버리기** — `discardChanges(collectionId, keys?)`: 변경 (`unlinked` 포함) 과 자리 편집만 지운다. 행 저장소 · 조회 결과는 그대로다. 열린 티켓에 든 행은 판정이 올 때까지 티켓에 남고, 판정은 뒤 편집이 없는 것으로 계산한다.

**조회가 올 때** — 키 목록과 행 값을 따로 판정한다. 요청은 출발할 때 순번을 받는다.

1. 키 목록 · cursor · 전체 수: 응답은 자기 요청의 결과만 바꾼다. 그 결과의 `at` 보다 이른 순번의 응답은 버린다. 응답의 행 중 이 요청보다 늦은 순번의 삭제 흔적이 있는 key 는 목록에 넣지 않는다.
2. 행 값: 응답의 행마다, 행 저장소의 `at` 이 이 요청의 순번보다 작을 때만 값을 바꾼다. 같거나 크면 (더 늦게 출발한 다른 조회나 저장 판정이 이미 썼다) 값은 두고 key 만 목록에 넣는다. 삭제 흔적도 같은 규칙이다 — 삭제 확정보다 먼저 출발한 목록 응답은 그 행을 되살리지 못하고, 확정 뒤에 출발한 요청이 그 key 를 주면 (서버에 다시 생겼다) 행이 돌아온다.
3. 행 값이 바뀌면 그 key 를 든 모든 조회 결과의 `revision` 을 올린다 (key → 결과 index). 같은 행을 읽는 다른 보기가 다시 계산된다.
4. 변경은 그대로다. 고침의 필드에 대해, 행 값이 실제로 바뀌었고 새 값이 `base` 와도 `value` 와도 다르면 `server` 에 적는다 (다른 사람이 바꿨다는 사실 — 화면 처리는 324). 새 값이 `value` 와 같아졌고 그 필드가 열린 티켓에 없으면 그 필드는 빠진다.

순번은 「늦게 출발한 요청이 더 새 값을 읽었다」 는 가정이다. 서버가 두 요청을 어느 순서로 읽었는지는 클라이언트가 알 수 없다 — 가정이 어긋나면 더 새 값을 한 번 버릴 수 있고 다음 조회가 바로잡는다. 이른 요청의 값이 늦은 요청의 값을 덮는 일은 없다. 버전 필드의 값은 뜻을 읽지 않는 글자라 (324) 순서 판정에 쓰지 않는다.

**자리** — 넣기 · 옮기기는 「어느 key 의 앞 · 뒤 · 처음 · 끝 · 어느 부모 아래」 로 적는다. 순서를 가진 조회 결과 (작성 행 · 서버 정렬이 없는 기본 조회 · 여기서 도는 보기의 입력) 에 적용하고, 기준 key 가 그 결과에 없으면 끝에 둔다. 서버가 정렬 · 거른 조회 결과에서는 자리 편집을 적용하지 않는다 — 고친 행은 제자리, 넣은 행은 그 보기의 조건을 평가기로 판정해 맞으면 끝에 (사용자 결정 3).

**키** — 저장소의 키는 Collection 의 key 필드 → `id` · `key` · `value` 의 값이다. 이 키의 행은 Collection 안의 모든 조회 결과가 같이 쓴다. 바인딩의 값 필드는 컴포넌트가 RAC 에 주는 항목 key 이고, 세션이 그 key ↔ 저장소 키를 바꿔 준다.

key 필드의 값이 없는 행은 둘로 갈린다.

- 작성 행 (원격 조회가 없는 Collection): Collection 안의 위치 (`row-N`) 가 키다. 목록이 하나이고 실행 중 바뀌지 않으므로 지금처럼 동작한다.
- 원격 조회의 행: 그 조회 결과 안에서만 뜻이 있는 키 (`RequestKey` + `generation` + 응답 안의 위치) 를 받는다. 조건이 다른 두 목록의 첫 행은 요청이 다르므로 서로 다른 행이다 — 값도 변경도 섞이지 않는다. 그 결과의 키 목록이 통째로 바뀌면 (`generation` 이 오른다) 그 키의 행과 변경을 함께 지운다 (사용자 결정 1). 뒤에 붙는 다음 페이지는 다른 요청이라 앞 페이지의 키를 건드리지 않는다.

`isServerKey(collectionId, key)` 는 앞의 것 (key 필드의 값) 에만 true 다. 위치로 만든 키는 저장소 밖에서 서버의 행 식별자로 쓰지 않는다 — 324 가 원격 고침 · 지우기를 이 함수로 가른다.

**요청 키** — 요청을 만드는 함수 하나가 fetch 할 주소 · method · 본문과 `RequestKey` 를 같이 돌려준다 ([`buildEndpointRequest`](../../../packages/shared/src/collections/executeCollectionEndpoint.ts#L114) 를 넓힌다). 주소 모양의 cursor 를 그대로 따라가는 다음 페이지는 그 주소가 키에 들어간다 — 지금은 fetch 대상만 바뀌고 「같은 요청」 판정 글자 ([`resolvedEndpointUrl`](../../../packages/shared/src/collections/executeCollectionEndpoint.ts#L90)) 는 첫 페이지와 같다 ([대상 주소](../../../packages/shared/src/collections/executeCollectionEndpoint.ts#L146)). fetch 와 키가 한 값에서 나오고, 세션의 「같은 요청」 판정 (`loadedUrls`) 도 이 키를 쓴다.

**목록** — `ListKey` 는 Collection id + cursor 없는 첫 요청의 `RequestKey` 다. 다음 페이지 요청은 자기 `RequestKey` 로 결과를 갖고 그 목록의 `pages` 뒤에 붙는다. 「더 보기」 는 `pages` 를 이어 읽고, 쪽 목록은 읽는 곳이 고른 한 장을 읽는다. 묶음 · 고정 행 · 합계 요청도 같은 규칙이다 (한 장짜리 목록).

**완전성** — 목록의 `complete` 은 아래가 모두 맞을 때만 true 다. 「cursor 가 없다」 는 조건 하나로 판정하지 않는다 — 번호로 넘기는 연결은 cursor 없이 한 장 (예: 250 행 중 20 행) 만 준다.

1. `whole` 이다 — 요청에 조건 (거르기 · 검색) 도 쪽 범위도 싣지 않았다. 정렬은 행의 집합을 바꾸지 않으므로 있어도 된다.
2. 끝이 확인됐다 — 응답이 전체 수를 줬으면 모은 행 수가 그 수 이상일 때만. 전체 수가 없으면 다음 페이지를 알려 주는 선언 (`cursorPath` · 번호 페이지의 `pageSize`) 이 있는 연결에서 마지막 응답에 다음이 없을 때만.

전체 수도 페이지 선언도 없는 응답은 끝을 확인할 근거가 없다 — `complete` 이 아니다. 서버가 기본 크기 (예: 20 행) 로 잘라 주면서 전체 수와 다음 표시를 모두 생략하는 경우를 응답 하나로는 가릴 수 없다 ([전체 수 · 다음을 읽는 자리](../../../packages/shared/src/collections/executeCollectionEndpoint.ts#L156)). 이런 연결은 보기마다 서버에 묻고, 324 의 「행이 없다」 근거로도 쓰지 않는다. 원격 조회가 없는 Collection (작성 행 · Builder 가 보낸 행) 은 원본이 여기 있으므로 `complete` 이다.

판정할 수 없으면 false 다.

**요청** — 서버가 받는 보기는 보기마다 목록을 갖는다. 그 Collection 에 `complete` 인 목록이 있으면 다른 보기는 요청 없이 평가기로 답한다. 없으면 서버에 요청한다. 동시 요청은 지금 묶음 조회의 상한 (6) 을 같이 쓴다. 늦은 응답은 위 「조회가 올 때」 의 순번 둘 (결과의 키 목록 · 행 값) 로 가른다.

**수명** — 읽는 곳이 0 인 목록과 그 결과는 지운다. 어느 조회 결과에도 없고 변경도 열린 티켓도 없는 행은 지운다. 변경이나 티켓이 붙은 행은 남긴다. 삭제 흔적은 그 순번보다 먼저 출발한 요청이 모두 끝나면 (응답 · 실패 · 취소) 지운다 — 세션이 진행 중인 요청의 가장 이른 순번을 안다.

## 바뀌는 동작

| 동작                                 | 지금                                         | 이 ADR 뒤                                                                                   |
| ------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 고친 뒤 다음 페이지                  | 값은 남고 「저장 안 됨」 표시가 사라짐       | 값 · 표시 모두 남음                                                                         |
| 고친 뒤 검색 · 정렬 (서버)           | 편집이 사라짐                                | 남음 — 고친 행이 결과에 있으면 고친 값으로 보임                                             |
| 규칙의 「다시 불러오기」             | 편집이 사라짐                                | 남음, 버리기는 취소 동작 (사용자 결정 2)                                                    |
| 주기 조회 (Publish)                  | 저장 안 된 편집이 있으면 그 주기를 건너뜀    | 건너뛰지 않음 — 조회하고 변경은 남음                                                        |
| 조건이 다른 두 컴포넌트              | 보기를 싣지 않거나 전체를 불러옴 (1 만 상한) | 각자 요청                                                                                   |
| 쪽 목록 · 묶음 · 고정 행에서 고친 행 | 자리마다 다름                                | 어디서나 같은 값                                                                            |
| Builder 가 새 행을 보냄 (Preview)    | 편집 기록 유지                               | 같음                                                                                        |
| 키 없는 원격 Collection              | 편집됨, 조회하면 사라짐                      | 같음 + Data 패널 안내 (사용자 결정 1). 변경은 그 조회 결과의 것 — 다른 목록에 보이지 않는다 |
| 응답 전에 다시 고친 칸 (즉시 저장)   | 마지막 편집 번호가 더 크면 표시가 남음       | 같음 + 원래 값으로 되돌린 칸도 판정까지 남는다                                              |

## 구현 순서와 검증

| 단계                                 | 작업과 출구 조건                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 · 기준선 (G0)                | 위 표의 자리 · 읽는 곳을 grep 으로 다시 세어 고정한다. 「바뀌는 동작」 을 단언하는 기존 테스트와 규칙 문서 줄 ([data-interaction.md](../../../.claude/rules/data-interaction.md) §6 `reload` · 「쪽 단위」) 을 목록으로 적는다. 재현 테스트 셋 (다음 페이지 뒤 표시 · 두 보기 · 키 어긋남) 과 HEAD 의 ratchet 카운트 · 10 만 행 정렬 · 편집 시간을 기록한다.                                      |
| Phase 1 · 행 저장소 · 조회 결과 (G1) | `collectionStore.ts` 와 그 단위 테스트. Collection 응답 · Builder 행을 옮기고, 이어서 쪽 단위 · 고정 행 · 묶음 · 합계를 옮긴다. 편집은 아직 옛 기록을 보이는 행 위에 다시 적용한다 (동작 무변경). 읽는 곳을 `visibleRows` 로 모으고 정적 검사를 둔다.                                                                                                                                             |
| Phase 2 · 미저장 변경 (G2)           | 편집 진입 여섯이 변경 층에 쓰고, 편집 표시 · 저장 표시 · `Cells change` 의 편집 번호가 그 층에서 나온다. 조회가 변경을 지우지 않는다. `beginSend` · `settleSend` (필드별 확정 편집 번호 · 삭제 흔적 · `unlinked`) · `rebaseChange` · `linkUnlinked` · 취소 함수 — 즉시 저장의 `markEditsSaved` 를 앞의 둘로 바꾼다. 키 없는 원격 행의 조회 결과별 키. Publish 주기 조회의 건너뛰기 규칙을 지운다. |
| Phase 3 · 여러 조회 (G3)             | 요청 키를 만드는 함수 하나 · 목록 · 완전성, 보기마다 목록, `complete` 인 목록이 있으면 로컬 답, 동시 요청 상한, 순번 둘 (결과의 키 목록 · 행 값) 과 key → 결과 index. `MULTI_VIEW` 의 전체 불러오기 분기를 지운다 (서버가 못 받는 보기의 로컬 실행은 남는다). 서버 목록 안 자리 규칙 (사용자 결정 3).                                                                                             |
| Phase 4 · 속도 · 수명 (G4)           | 덧씌운 결과 기억, 읽는 곳 없는 결과 · 행 정리, ratchet · 10 만 행 A/B · 번들.                                                                                                                                                                                                                                                                                                                     |
| Phase 5 · 실제 경로 · 문서 (G5)      | Builder → Publish live (Chrome · WebKit). 규칙 문서 · skill reference · CHANGELOG. ADR-324 (2026-11-26 이 층 위의 결정으로 개정됨) 의 G0 전제를 닫는다.                                                                                                                                                                                                                                           |

| 독립 검증 사례                                                            | 관찰할 결과                                                                                                                                         |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 쪽에서 세 칸 고침 → 다음 페이지 → 정렬 → 다시 불러오기                  | 세 칸의 값 · 표시가 남는다. 고친 행이 결과에 없을 때도 「저장 안 됨 3」 은 3 이다.                                                                  |
| `3 → 5 → 8`, `3 → 8 → 3`, 넣고 지움                                       | 변경 1 · 0 · 0. `base` 는 3.                                                                                                                        |
| 보낸 뒤 응답 전에 같은 칸을 다시 고침 → 저장 확인                         | 그 칸만 변경으로 남고 `base` 는 보낸 값.                                                                                                            |
| 두 행 붙여넣기 (편집 번호 하나) 를 보내 A 확정 · B 거절                   | A 의 표시가 사라지고 행 저장소에 보낸 값. B 는 값 · 표시가 남는다 — 미저장 1.                                                                       |
| `3 → 5` 를 보낸 뒤 응답 전에 `3` 으로                                     | 판정 전: 필드가 남는다. 확정: 고침 1 (`base` 5 · `value` 3). 거절: 변경 0. `unknown`: 그대로.                                                       |
| 넣기를 보낸 뒤 응답 전에 그 행을 지움                                     | 확정 (서버 key `K`): `K` 의 지우기 1 · 행은 안 보인다. 거절: 변경 0.                                                                                |
| 같은 칸을 `5` · `8` 로 두 번 즉시 저장, 성공 응답이 `8` → `5` 순으로 도착 | 행 저장소 · 화면 모두 `8`, 미저장 0. 순서가 `5` → `8` 이어도 같다.                                                                                  |
| 지우기 확정 뒤, 확정보다 먼저 출발한 목록 응답이 그 행을 들고 도착        | 그 행이 어느 목록에도 다시 나타나지 않는다. 확정 뒤에 출발한 요청이 그 key 를 주면 나타난다. 먼저 출발한 요청이 모두 끝나면 흔적이 지워진다.        |
| 넣기 (이름 A) 를 보낸 뒤 이름을 B 로 → 서버가 key 없이 확정               | 넣기는 닫히고 (다시 보내는 요청 0) `unlinked` 1 — B 가 미저장으로 남는다. 서버 행과 이으면 그 key 의 고침 (`A → B`). 버리기 전에는 사라지지 않는다. |
| 저장 확정 뒤, 확정보다 먼저 출발한 조회가 옛 값으로 도착                  | 행 저장소는 확정한 값. 그 조회의 키 목록은 자기 결과에 들어간다.                                                                                    |
| 조건이 다른 Table 과 Chart 가 같은 Collection                             | 요청 2 (fetch 대역에서 셈), 전체 불러오기 0. 전체 조회가 끝까지 와 있으면 추가 요청 0.                                                              |
| 쪽 목록의 2 쪽에서 고친 행이 다른 Table 에도 있음                         | 두 곳이 같은 값.                                                                                                                                    |
| 편집 중 주기 조회 · Builder 새 행 · 늦게 온 이전 응답                     | 변경이 남고, 늦은 응답은 자기 조회 결과만 바꾼다.                                                                                                   |
| 두 조회가 같은 key 를 다른 값으로 — 먼저 출발한 쪽이 늦게 도착            | 두 보기 모두 늦게 출발한 요청의 값. 도착 순서를 바꿔도 같다. 값이 바뀐 행을 읽는 다른 보기가 다시 계산된다.                                         |
| `/orders` → 주소 cursor `/orders?next=k2`                                 | fetch 2 건 · 요청 키 2 개 · 양쪽 행이 한 목록에 이어진다. 같은 다음 요청을 다시 보내지 않는다.                                                      |
| 페이지 선언 없는 `/orders` 가 20 행만 주고 전체 수 · 다음 표시를 생략     | `complete` false — 조건이 다른 보기가 서버에 요청해 첫 응답에 없던 `id=250` 을 받는다.                                                              |
| 번호 페이지 250 행 중 20 행 (전체 수 있음 · 없음)                         | `complete` false — 2 쪽 뒤의 행을 찾는 다른 보기가 서버에 요청한다 (요청 수 1). 모은 수 = 전체 수면 true · 추가 요청 0.                             |
| 키 없는 Collection 에서 넣기 · 지우기 뒤 고침                             | 작성 행: 고친 값이 같은 항목에 남는다. 원격: 다시 조회하면 그 변경이 사라진다 (사용자 결정 1).                                                      |
| 키 없는 원격 목록 둘 (조건이 다름) 을 같이 열고 한쪽 첫 행 고침           | 다른 쪽 첫 행은 값 · 표시 그대로. 한쪽을 다시 조회하면 그쪽 변경만 사라진다.                                                                        |
| 10 만 행 로컬 묶기 표에서 한 칸 고침                                      | HEAD 대비 시간이 노이즈 폭 안, 다시 만든 행 객체 수 = 바뀐 행 수.                                                                                   |

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

| 이 ADR (325)                                                                                | ADR-324                                                                                                        |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 변경을 어떻게 들고 합치는가, 조회와 어떻게 공존하는가                                       | 변경을 언제 보내는가 (즉시 · 사용자가 누를 때)                                                                 |
| `base` · `server` 값을 적어 둔다                                                            | 충돌을 어떻게 보이고 풀게 하는가                                                                               |
| `beginSend` · `settleSend` · `rebaseChange` · `discardChanges` 함수 — 행 단위 판정을 받는다 | 어느 응답을 `confirmed` · `rejected` · `unknown` 으로 읽는가, 저장 · 취소 Do 와 그 패널, 저장 막대 · 닫기 경고 |
| `baseRow` (처음 고칠 때의 행) · `isServerKey` · 목록의 `complete`                           | 버전 필드를 `baseRow` 에서 읽어 보내기, 서버 식별자 없는 행의 원격 쓰기 막기, 응답 유실 뒤 「행 없음」 의 판정 |
| 문서 스키마 무변경                                                                          | Collection 의 쓰기 연결 설정 · 연결이 선언하는 능력 · 요청 본문                                                |
| 세션 메모리 안의 변경                                                                       | 새로고침 · 탭 닫기 뒤 보존 여부                                                                                |
