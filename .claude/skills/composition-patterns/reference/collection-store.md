# Collection 실행 저장소 — 행 · 조회 결과 · 미저장 변경 (ADR-325)

> 정본 결정: [ADR-325](../../../../docs/adr/completed/325-collection-runtime-store-three-layers.md) · 상세 설계 [breakdown](../../../../docs/adr/design/325-collection-runtime-store-three-layers-breakdown.md). 규칙 요약은 [data-interaction.md](../../../rules/data-interaction.md) §6 「실행 저장소 세 층」. Preview · Publish 세션 (`catalogPreviewSession.ts`) 의 행 · 편집 · 조회를 고치기 전에 읽는다.

## 1. 세 층

`packages/shared/src/catalog/runtime/collectionStore.ts` — 세션 · DOM · graph 를 모르는 모듈 (단위 테스트 `__tests__/collectionStore.test.ts`, 값은 손으로 적음).

| 층        | 무엇                                                                                                    | 쓰는 곳                                                      |
| --------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 행        | key → 서버 · Builder · 작성자가 준 행 (`StoredRow` — 값 · 그 값을 쓴 순번 `at` · 필드별 확정 편집 번호) | `accept` (응답) · `settle` (저장 판정)                       |
| 조회 결과 | 요청 하나 (`RequestKey`) 의 키 목록 · cursor · total, 목록 (`ListKey`) 은 이어 붙는 페이지들            | `accept` · `startList` · `appendPage` · `dropList`           |
| 변경      | 행 key → 고침 (필드별 처음 값 · 지금 값 · 편집 번호) · 넣기 · 지우기 · `unlinked`, 자리 편집 목록       | `update` · `insert` · `remove` · `move` · `discard` · `link` |

보이는 행 = `overlayRows(store, store.listRows(list), shape)` — 세션의 `shownRows` 한 곳 (정적 게이트 `adr325OneRead.static.test.ts`). 변경이 없으면 응답 배열 그대로 (계산 필드 셀 캐시가 행 객체로 기억한다).

## 2. 세션의 목록

| 목록                        | key                               | 언제                                                                                        |
| --------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| 작성 행 · Builder API 행    | `authored` · `builder`            | 자기 조회가 없을 때 (`sourceList` — Builder 가 같은 글자를 다시 보내면 새 응답이 아니다)    |
| collection 자기 조회        | `main ␀ <첫 요청 key>`            | `reload` 가 시작, `loadMore` 가 잇는다 (`mainLists`)                                        |
| 쪽 목록                     | `unit ␀ <목록 노드> ␀ <요청 key>` | `loadPageUnit` (`CatalogPageUnit.list`)                                                     |
| 고정 행 · 펼친 묶음 끝 단계 | `answer ␀ pins … · group …`       | `syncPinnedRows` · `syncGroupRows` (묶음의 중간 단계 · 합계 행은 행이 아니라 값으로 든다)   |
| 보기마다                    | `view ␀ <보기 key>`               | `syncViewLists` — 조건이 여럿 (보기 없는 바인딩 포함) 이고 전체가 여기 없을 때 (Decision 6) |

`itemSources(loaded?, served?)` 가 목록을 골라 `CollectionDataSource` 로 바꾼다 — `catalogBoundRows` 는 그것만 읽는다.

## 3. key

- 저장소 key = collection key 필드 → `id` · `key` · `value` (`dataKeyOf`). 바인딩 `fieldMap.value` 는 컴포넌트의 항목 key 일 뿐 — 세션의 `shownIndex` 가 목록의 key ↔ 저장소 key 를 바꿔 준다 (R2 — G0 재현: 값 필드로 key 를 주는 목록의 편집이 「항목 없음」 이었다).
- key 없는 행: 작성 행은 `row-N` (collection 안 자리), 원격 행은 `<요청 key> ␂ <세대> ␂ <자리>` — 그 응답 안에서만 뜻이 있다. 같은 요청을 다시 받으면 (세대 +1) 그 행과 변경이 함께 지워진다 (사용자 결정 1). Data 패널이 key 필드 없는 API 표에 알린다 (`DataTableEditor` `editorNoKey`).
- 다른 목록에만 있는 행 (쪽 목록 2 쪽 · 고정 행) 도 key 로 고친다 (`knownRow`).

## 4. 조회가 올 때 · 저장 판정

- 요청은 출발 순번 (`startRequest`) 을 받는다. 결과의 키 목록은 더 이른 요청의 응답이 바꾸지 못하고, 행 값은 그 행을 마지막으로 쓴 순번보다 늦게 출발한 요청 · 저장 판정만 바꾼다. 확정한 지우기는 흔적 (`row: null`) 을 남기고, 먼저 출발한 요청이 모두 끝나면 지운다 (`endRequest` → `sweepTraces`).
- 저장: 규칙이 `callEndpoint` 를 보내면 `DispatchDeps.beginSave(seqs)` 가 그 편집 번호의 변경을 `SendTicket` 으로 찍고, 응답이 오면 전부 확정 (실패면 전부 거절). 판정 표 · 확정 순서 (`5` · `8` 이 뒤집혀 와도 `8`) 는 breakdown 「판정」.
- 서버가 받은 보기의 목록 (`served`): 고친 행은 다시 조회할 때까지 제자리, 넣은 행은 그 보기의 조건 (`catalogRowMatchesQuery` — 평가기 하나) 에 맞을 때만 끝에, 옮기기는 적용하지 않는다 (사용자 결정 3). 여기서 거르는 목록 (로컬) 은 보이는 행 위에서 다시 계산한다.

## 5. 완전성 · 보기마다 요청

- 「끝까지 모았다」 (`answerComplete`): 전체 수가 있으면 모은 수 ≥ 전체 수. 없으면 다음 페이지를 알려 주는 선언 (`responseMapping.cursorPath` · suffix 형식의 `pageSize`) 이 있고 마지막 응답에 다음이 없을 때만. `{{ cursor }}` 를 읽기만 하는 endpoint 는 선언이 아니다 — 서버가 기본 크기로 잘라 줄 수 있다.
- `wholeComplete`: collection 자기 조회가 보기 없이 (`viewlessLoads`) 끝까지 모였을 때만 — 그때 보기들은 요청 없이 여기서 돈다. 자기 조회가 진행 중이면 보기 요청을 미룬다 (그 조회가 끝나며 다시 판정).
- 보기마다 요청은 동시 6 (`viewRequests`), 같은 요청 key 는 다시 보내지 않는다 (`reload` — 규칙 · 주기 조회 — 는 보기 목록도 다시 받는다), 보기의 「더 보기」 는 그 보기의 다음 페이지 (`loadMoreView`).
- 보기 없는 바인딩도 조건 하나다 (`bindingViews` 의 `plain`): 보기 있는 목록 하나와 보기 없는 목록이 같이 있으면 자기 조회는 거르지 않고, 보기 목록이 따로 요청한다. **Why (2026-11-27 G5 live)**: 보기 없는 바인딩을 세지 않아 보기 하나가 「유일한 보기」 로 자기 조회에 실렸고, 보기 없는 Table 이 그 보기 (female) 의 행만 보였다 (HEAD 부터의 결함). 다시 불러오기는 같은 요청 key 의 보기 목록을 건너뛰어 서버의 새 값이 보기 목록에 오지 않았다.
- 요청 key 는 fetch 하는 값에서 한 번 만든다 (`endpointRequestKey` — 주소 cursor 를 그대로 따라간 다음 페이지는 그 주소). 「같은 요청」 판정 (`loadedUrls`) 도 이 key.

## 6. 수명

`sweepStores` (`loadRouted` 마다): 없어진 collection 의 저장소, 없어진 쪽 목록 · Table 의 목록을 지운다. 목록이 지워지면 다른 목록에 없고 변경 · 보낸 변경이 없는 행도 지운다 (`dropResult`).

## 7. Why (규칙 문서에서 옮김)

- **serializer 를 `collections` barrel 로 내보내지 않는다 (ADR-284)**: barrel 로 내보내자 Preview initial 이 +3,685 B — 세션은 lazy chunk 인데 serializer 가 initial 공용 chunk 로 옮겨갔다.
- **입력 변수의 occurrence 값과 서버 응답 (ADR-294 수리, 2026-10-31)**: 중첩 role override 가 저장돼도 `admin` 으로 표시됐고, 기본값 `male` / instance `female` 에서 `/users?gender=male` 요청과 남성 행이 표시됐다 — 두 통합 반례와 경로별 원복 RED 로 확인했다. ADR-325 뒤로는 instance 마다 다른 보기가 각자 요청한다 (전체 불러오기 없음).
- **2026-11-26 주기 조회 건너뛰기 (지움)**: Publish 주기 조회가 편집 기록을 지워, 저장 안 된 편집이 있으면 그 주기를 건너뛰었다. 저장소는 조회가 변경을 지우지 않으므로 이 규칙이 없어졌다.
