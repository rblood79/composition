# ADR-265 design breakdown — 편집 · 선택 전환의 문서 층 비용

> 본문: [../completed/265-document-layer-edit-select-cost.md](../completed/265-document-layer-edit-select-cost.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 와 `.agent/runs/` 는 로컬 전용이라 실측 결론은 여기 §기록에 둔다.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: 기존 ADR 의 분리가 아니다. ADR-248 (catalog graph · transaction · composition root · read model) 이 base 이고, 이 ADR 은 그 층의 실행 비용을 변경 크기 비례로 맞추는 응용이다. ADR-264 가 사용자 결정 2 로 측정 기록 종결하며 Canvas 밖으로 넘긴 편집 꼬리와, Canvas 성능 계획 3단계 (선택 전환) 를 사용자 확인 (「다음은 … 묶을 새 ADR … 인가?」 → 진행) 으로 한 ADR 에 묶었다 — fork 가 아니다.
2. **schema**: 문서 · 저장 schema 변경 0. notices (`{id, record}`) · read model 의 값 · Layers 행의 내용도 그대로다. 하니스 `counts` 에 `doc.*` 필드가 는다.
3. **선행 전제 reverse 검증**: ADR-248 의 「graph 는 가변 Map 하나 · commit 은 staged 만 · plan 은 pruned resolve · deliver 는 notices 만」 을 코드로 확인했다 (본문 §코드 사실 1 ~ 7). 이 ADR 은 그 설계를 뒤집지 않고, 그 설계 밖의 분기 (서브트리 확장 · byIndex 재계산 · full-root · Layers rebuild · dry-run · 선형 find) 만 다룬다 — 의존 방향 반전 없음.
4. **판독**: 사용자가 요청할 때 `/review-adr 265`. 판독은 phase 당 1 + 수리 검증 1.

## 1. Phase 0 — 문서 층 카운터 · 기울기 표 (G0, go/no-go)

목적: 「문서 크기에 비례하는 자리」 를 가설이 아니라 두 점 기울기로 확정한다. 카운터는 문서 층 함수 안의 순수 카운트 (훑은 id · 비교 · 재계산 수) 만 — React 커밋 · GC 에 흔들리는 값은 넣지 않는다.

- **카운터** (dev 전용 분기, ADR-263 `renderCounters.ts` 와 같은 형태 — `apps/builder/src/builder/catalogRuntime/docCounters.ts` 신설, shared 쪽은 `CatalogRootMetrics` · `GraphMetrics` 를 쓰고 builder 가 읽어 하니스 `counts.doc` 에 싣는다):
  - graph: `affectedIdsVisited` (`collectAffectedIds` 가 큐에서 꺼낸 수) · `affectedIdsSubtree` (그중 `expandChildren` 으로 들어간 자손) · `affectedIdsResult` (결과 집합 크기) · 죽은 `transactionEntriesTraversed` · `transactionEntryTableClones` 를 **배선** (실제 훑은 entry · 복제 수 — 0 이면 0 으로 실측) · `definitionCycleChecks`.
  - transaction: `stagedEntries` · `validatedEntries` · `opsCloneBytes` (`structuredClone(ops)` 의 직렬 길이 — 상수 비용 몫) · `persistStringifyBytes` (controller 571 의 entry JSON 길이 합).
  - composition root: `resolverVisits` · `layoutInputVisits` · `traversedWholeInputGraph` · `rootMembersCopied` (keep 의 Set 복사 크기) · `stateReadersScanned` · `overrideDependentsScanned` · `deliverCanvas` · `deliverDom`.
  - read model: `staleReads` · `staleByIndex` · `recomputedReads` · `compareStringifyBytes` (`same` 의 JSON 길이) · `childRowsCompute`.
  - workspace · Layers · 선택: `themeStateComputed` · `rootReplaced` · `componentsKeyStringified` · `layersRebuilds` · `layersRowsBuilt` · `layersGatedChecked` · `layersRenameChecked` · `selectSiblingCompares` (`findPositionOfRecord` 의 `find` 비교 수) · `menuDryRuns` (`canvasMenu.ts` `allowed` 호출 수) · `editContractIncludes` (`react.runtime.ts` 150 ~ 157 의 `includes` 호출 수).
- **시나리오** (dev 5173 · headless · `--fixed-inputs`, 각 2 회 같은 값): 편집 (`edit` — 15 회 폭 변경) · 선택을 seed 600 · 5,000 × 평평 (`mixed`) · 중첩 (`nested-flex`) 에서. **선택열은 문서 규모와 함께 움직여야 한다** (리뷰 r1 M2): 지금 `select` 부류는 `ids[i++ % ids.length]` 라 600 · 5,000 어디서나 **처음 30 개** 만 고른다 (`perf-baseline.mjs` 2132 ~ 2136) — 형제 선형 `find` (C8) 의 비교 수가 앞 30 개 선택은 465 / 465 로 같고 뒤 30 개 선택은 17,565 / 149,565 (리뷰 실측, `findPositionOfRecord` 를 행 600 / 5,000 으로 격리) 라, 그 드라이버로 재면 C8 이 기울기 0 으로 잘못 제외된다. 새 부류 `select-spread` 를 둔다 — 결정적 인덱스 열 `[0, ⌊N/2⌋, N−1, 1, ⌊N/2⌋+1, N−2, …]` 로 앞 · 중간 · 끝을 같은 비율로 방문 (30 회), 같은 옵션 2 회 같은 값. 기존 `select` 부류는 보존 (ratchet 60 · 600 의 A 키 유지). 기울기 0 은 **잰 입력 범위 안의 결과** 로만 해석한다 — 선택은 `select-spread` 의 값을 기울기 표에 쓴다. 불리 케이스: Layers 를 다 펼친 상태의 선택 · body 편집 (서브트리 확장 최대) · Components view 를 연 상태의 편집 — 하니스에 옵션으로 추가 (`--layers-expanded` · `--edit-target body` · `--components-view`).
- **기울기 표**: 카운트마다 (5k 값 − 600 값) / (5,000 − 600) 과 600 값 — 기울기 > 0 이면 문서 크기 비례, 0 이면 상수. 발생 빈도 표: 편집 15 회 중 page · project entry 변경 · 정의 변경 · 테마 변경이 몇 회인가 (C3 · C4 · C5 · C10 의 포함 여부).
- **ratchet**: `perf-ratchet-gate.mjs --add-keys 60 · 600 · 600:nested-flex --keys doc.* --accept-recorder` 로 A 등록 (recorder 해시가 바뀐다) · 새 부류는 `--add-class 60 · 600 select-spread`. 등록한 키를 인위 회귀시킨 보고로 `decide` = `block` 확인. 5k 는 ratchet 밖 (측정 기록만).
- **테스트 기대값 실측화**: `g1.test.ts` 295 · `phase3DeltaScale.test.ts` 131 · `transactionImpact.test.ts` 291 · `nodeAuthoring.test.ts` 341 의 「0」 단언을 배선 뒤 실측값 (또는 상한) 으로 바꾼다.
- **go/no-go**: 기울기 > 0 인 후보가 하나 이상이면 go → Phase 1 · 2 를 몫 순서로. 전부 0 이면 사용자 결정 1.

### Phase 0 결과

측정 조건 (2026-10-16): dev 5173 (`pnpm dev`, 이 ADR 의 작업 트리) · headless Chromium · `--lane frame --fixed-inputs` · 패널 navigator · design 열림 (하니스 기본, Layers 는 page 행 펼침) · 편집 15 회 (평평은 원래 값 복귀까지 16 step) · 선택 30 회. 같은 옵션 2 회가 모든 `doc.*` 에서 같은 값 (등급 A — 600 평평 edit · select · select-spread 확인). 카운터는 `packages/shared/src/catalog/docCounters.ts` (shared — graph · transaction · root 가 shared 라서) + dev 전역 `__composition_DOC_COUNTERS__` (`catalogRuntime/docCounters.ts`), 하니스 `counts.doc`.

**편집 — 하니스 시나리오 (HC2 의 대상: seed 노드 폭)**: 문서 층 카운트가 600 과 5k 에서 **전부 같다** (기울기 0).

| 카운트 (15 ~ 16 편집 합)  | 평평 600 | 평평 5k | 중첩 600 | 중첩 5k |
| ------------------------- | -------: | ------: | -------: | ------: |
| `affectedVisited` (C1)    |      144 |     144 |      720 |     720 |
| `stepInvalidated`         |       48 |      48 |      360 |     360 |
| `rootResolverVisits`      |       32 |      32 |       60 |      60 |
| `persistStringifyBytes`   |    6,384 |   6,384 |    8,055 |   8,055 |
| `opsCloneBytes` (상수 몫) |    7,216 |   7,216 |    1,650 |   1,650 |
| `readCompareBytes` (C2)   |       32 |      32 |        0 |       0 |

중첩 5k 편집에서 규모와 함께 느는 호출은 문서 층이 아니라 **Canvas binding** 이다 (`--call-counts`, 600 → 5k): `renderCommands` 익명 59,229 → 366,129 · `compositionRoot.canvasInputs` getter 32,360 → 220,856 · `catalogOverflowClips` 15,895 → 109,945 · `canvasBinding.overflowOf` 14,291 → 107,549 · `childrenOf` 13,410 → 106,272 · `subtreeTranslate` `union` 10,833 → 90,627 · `cloneClip` 10,680 → 90,276 · `graph.getEntry` 9,810 → 76,140. 카드 폭이 바뀌면 그 아래 상자가 전부 옮겨지고, 옮김 · overflow clip · rect diff 가 그 수만큼 돈다 — ADR-263 · 264 의 파일 (§Soft constraints 밖). ADR-264 가 넘긴 「문서 · 트랜잭션 층」 은 dev 프로필 함수 이름에서 온 추정이었고, 카운트는 그 층이 이 편집에서 상수임을 보인다.

**편집 — 불리 케이스 (`--edit-target body`, page body 배경 15 회)**: 문서 크기에 비례한다.

| 카운트                  |  평평 600 |    평평 5k | 중첩 600 | 중첩 5k | 기울기 (평평, /요소) |
| ----------------------- | --------: | ---------: | -------: | ------: | -------------------: |
| `affectedVisited` (C1)  |    18,060 |    150,060 |   18,180 | 150,840 |                 30.0 |
| `affectedSubtree` (C1)  |    18,000 |    150,000 |   18,120 | 150,780 |                 30.0 |
| `stepInvalidated`       |     9,030 |     75,030 |    9,090 |  75,420 |                 15.0 |
| `readCompareBytes` (C2) | 2,718,765 | 23,016,765 |    4,680 |   4,680 |                4,613 |
| `persistStringifyBytes` |   262,710 |  2,236,710 |    3,810 |   3,810 |                  449 |

- C1: body 의 소유 서브트리 전체를 step 마다 두 번 (pre · post) 훑는다 — 편집 1 회에 5k 문서 10,000 방문. `stepInvalidated` 는 그 결과라 `notify` · `resolved.delete` 도 5,000 회.
- C2 는 가설 (`byIndex` read) 이 아니었다 — `readStaleByIndex` 는 0 (Components read 구독 없음). 비용은 body 에 걸린 **page 행 목록 read** 의 값 비교 `same` = 5,000 행 배열 `JSON.stringify` 두 번 (편집 1 회 1.5 MB).
- `persistStringifyBytes` 는 body entry 자신의 JSON (children id 5,000 개) — 변경 entry 의 크기라 「변경 크기 비례」 다. 레버 대상이 아니다.

**선택 (`select-spread`, Canvas 클릭 경로 30 회)**: 문서 크기에 비례한다.

| 카운트 · 호출                                      |  평평 600 |    평평 5k | 중첩 600 |    중첩 5k |
| -------------------------------------------------- | --------: | ---------: | -------: | ---------: |
| `selectSiblingCompares` (C8)                       |   118,175 |    976,175 |    2,546 |      5,580 |
| `layersRebuilds` · `layersRowsBuilt` (C6)          |     0 · 0 |      0 · 0 | 26 · 377 | 31 · 1,112 |
| `menuDryRuns` (C7, 명령 수 — 상수)                 |       176 |        176 |      191 |        198 |
| v8 `pageFrameRects` member 탐색 (**C12**, 새 후보) |    93,310 |    775,310 |        — |          — |
| v8 `structure.ts` children filter (C7 dry-run 안)  |    69,600 |    580,000 |        — |          — |
| v8 `structure.ts` Group `roots.includes` × 3 (C7)  |    45,035 |    375,035 |        — |          — |
| v8 `catalogHtmlIdTaken` (**C11**, 새 후보)         |    13,620 |    112,620 |        — |          — |
| v8 Layers `getKey` (RAC 컬렉션)                    |    18,631 |    155,031 |        — |          — |
| v8 의존성 (RAC · React) 호출 합                    | 7,410,282 | 20,778,385 |        — |          — |

- C8 은 선택 1 회에 위치 조회가 ~13 번이다 — `selectRecords` 1 + overlay 가 페인트마다 `roleOf → itemOfRecord → positionOfRecord` (`CatalogCanvas.tsx` 498). 리뷰 r2 의 `findPositionOfRecord` 단독 값 (9,065 / 75,065) 의 13.0 배 = 같은 기울기.
- **C12** `pageFrameRects` (`compositionRoot.ts` 3338): page 마다 root member Set 전체를 `find` 로 훑어 body record 를 찾는다 — 선택 1 회에 5 번 (5k × 5).
- **C11** Attributes 패널 `automaticHtmlId` (`CatalogAttributesSection.tsx` 56): `useSyncExternalStore` getSnapshot 이 `catalogUniqueHtmlId` 로 `text_1, text_2 …` 를 빈 번호까지 차례로 본다 — 같은 base 의 id 가 N 개면 O(N).
- C7 은 dry-run **수** 는 상수이고, 각 dry-run 안의 부모 children 복사 · filter 가 형제 수에 비례한다 (`structure.ts` 523 · 1079 ~ 1089).
- 중첩 C6: 선택이 펼친 집합을 바꿀 때마다 Layers `rebuild()` 전체 (5k 에서 rebuild 31 회 · 행 1,112).
- 기존 `select` (store 경로 · 처음 30 개) 는 600 · 5k 모두 `selectSiblingCompares` 5,880 — 리뷰 r1 M2 의 지적대로 기울기 0 으로 보인다.

**발생 빈도 (C3 · C4 · C5 · C10)**: 하니스 편집 15 회 중 page · project · 정의 · 테마 변경 0 회 — `rootWholeGraphSteps` · `stateReadersScanned` · `overrideDependentsScanned` · `themeStateComputed` · `definitionCycleChecks` · `componentsKeyBytes` 모두 0. 레버 Phase 에서 뺀다 (드문 조작의 몫). C9 (`editContractIncludes`) 도 0 — 하니스 편집 대상이 선택돼 있지 않다. 선택 + 편집 (`multi-select-edit`) 에서만 돈다.

**GraphMetrics 배선 (R5)**: `transactionEntriesTraversed` = stage 의 owner 탐색 + commit 의 교체 루프가 돈 entry 수 (leaf 편집 1 · 5k 형제 구조 삽입 2 — 테스트 7 곳이 0 대신 실측값을 단언). `transactionEntryTableClones` 는 transaction 경로에 table 복사 지점이 없어 셀 것이 없다 — 필드를 지웠다 (전체 export 감시는 이미 `exportDocument` stub 이 한다: `phase2` · `phase3DeltaScale`).

**go/no-go: go** — 기울기 > 0 후보: 편집 C1 · C2 (body · 큰 컨테이너 편집), 선택 C8 · C12 · C7 · C11 · C6. 사용자 결정 1 의 조건 (편집 카운트가 **모든 후보에서** 기울기 0) 은 body 편집 때문에 성립하지 않는다. 다만 **HC2 의 시나리오 (카드 폭 편집) 는 문서 층 카운트가 상수** 라 Phase 1 레버로는 HC2 가 움직이지 않는다 — HC2 미달은 종결의 사용자 결정 3 으로 간다 (Canvas binding 은 이 ADR 범위 밖, 4단계 입력에 같이 기록).

Phase 순서 (몫 순): Phase 1 (편집) = C1 · C2. Phase 2 (선택) = C8 · C12 · C7 · C11 · C6. 상수 비용 (`structuredClone(ops)` 편집 1 회 ~110 B) 은 몫이 작아 레버에서 뺀다.

## 2. Phase 1 — 편집 경로 레버 (G1)

Phase 0 의 몫 순서로 적용한다. 후보와 각 레버의 동치 조건:

| 후보    | 레버                                                                                                                                                                                                                                                                                 | 동치 조건 (G1)                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| C1      | `collectAffectedIds`: 큐를 인덱스 포인터로 (`shift` 제거, O(n)). 서브트리 확장을 「자손 입력이 바뀔 수 있는 변경」 (구조 · 레이아웃 · 상속 축 — ADR-248 의 `catalogDerivedProps` · `CATALOG_SIZE_PROPAGATION` 축이 닿는 필드) 으로 좁힌다 — 값만 바뀐 leaf 편집은 자손을 넣지 않는다 | 무효화 집합 ⊇ 수정 전 집합 중 실제로 값이 바뀐 구독 · read 의 id (구독자가 받는 알림 · read model 값 · Preview record 동일) |
| C2      | `readModel` `byIndex` read 를 정의 · 참조 (instancesOf · referrersOf 의 입력) 가 바뀐 step 에서만 재계산. `same` 의 `JSON.stringify` 를 행 목록용 구조 비교 (id · 필드 순서 고정) 로                                                                                                 | 모든 read 의 값이 매 step 수정 전과 같다 (무작위 편집 ≥ 1,000 · Components 목록 · 참조자 포함)                              |
| C9      | `useCatalogEditContract`: `invalidatedIds` 를 Set 으로 (controller 가 Set 을 같이 넘기거나 listener 가 한 번 만든다)                                                                                                                                                                 | 계약 재계산 시점이 같다                                                                                                     |
| 상수    | `forward = structuredClone(request.ops)`: ops 가 호출자에서 재사용되지 않음을 타입으로 보장할 수 있으면 생략 (history 가 같은 참조를 들어도 되는지 확인) · 저장 대기열 `JSON.stringify(entry)` 는 유지 (entry 크기 비례 — 변경 비례)                                                 | history · undo · 저장 결과 바이트 동일                                                                                      |
| C3 · C5 | page · project entry 변경 중 레이아웃 · 테마에 닿지 않는 필드 (이름 · 설명 · 선택 · 메타) 는 full-root `flatten` · `applyTheme` 를 건너뛴다 — 필드 집합을 명시                                                                                                                       | page frame rect · root member · 테마 key 가 같다 (RED: 레이아웃 필드를 건너뛰면 FAIL)                                       |

- 원복 RED: 레버마다 변이 1 (백업 + trap 복원 + cmp) → 동치 테스트 FAIL 과 ratchet `block`.
- 하향: 수정과 같은 커밋에서 `--update`.

### Phase 1 결과 (2026-10-16)

Phase 0 의 카운트가 가리킨 레버는 표 초안과 달랐다. C9 · 상수 비용 · C3 · C5 는 빈도 0 이거나 몫이 작아 (ops 복제 편집 1 회 ~110 B) 빼고, body 편집에서 드러난 commit 안의 비용 두 가지 (L2 · L3) 를 더했다.

| 레버 | 자리                                                                      | 변경                                                                                                                                                                                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1   | C1 `controller.step` · `preview/receiver.ts` · `graph.collectAffectedIds` | 걸음은 graph 색인만 읽는다 — 시드가 같고 commit 이 색인을 안 바꿨으면 (edge 변경 0 · definitionOverride 없음 — `overrideTarget` 은 edge 가 아니다) post 걸음이 pre 와 같으므로 건너뛴다. 큐는 `shift()` 대신 읽기 포인터. 서브트리 확장 자체는 둔다 — 자손의 resolve 가 조상 값을 읽는다 (상속 글자 · size 전파 · 파생 prop) |
| L2   | `graph.replace`                                                           | owned children 이 old · new 에서 같은 entry 는 owner edge 를 열거하지 않는다 (양쪽에 같이 들어가 상쇄되던 것 — body 5,000 개 × 2)                                                                                                                                                                                            |
| L3   | `graph.commit` 의 `ownedRecord`                                           | staged record 가 이전 committed record 와 같은 (freeze 된) 하위 객체를 들고 있으면 복제하지 않고 그대로 둔다 — 스타일 편집이 body 의 children 배열을 매번 `structuredClone` 했다. L2 · L4 의 identity 판정이 이 공유에 기대 O(1) 이 된다                                                                                     |
| L4   | C2 `readModel` 행 목록 read                                               | 부모 (page · 소유 노드) 를 entry 전체가 아니라 행 계산이 읽는 필드 (node: kind · `definitionId` · `children` · `descendantOverrides`, page: `children`) 로만 의존 — identity 비교. 부모의 스타일 · 글자 편집은 행 목록을 다시 만들지도 직렬화 비교하지도 않는다                                                              |

카운트 (body 편집 15 회, 평평 5k): `replaceEdges` 150,030 → **30** (600 과 같음) · `commitChildrenCloned` 75,000 → **0** · `readRecomputed` 15 → **0** · `readCompareBytes` 23,016,765 → **0** · `affectedVisited` 150,060 → 75,030 (절반 — 여전히 비례) · `stepInvalidated` 75,030 (그대로 — 같은 집합). 저장 대기열 JSON (`persistStringifyBytes` 2,236,710) 은 바뀐 entry 자신이라 그대로. ratchet (하니스 편집 — seed 노드): 600 edit `affectedVisited` 144 → 48 · `readStale` 17 → 1 · `readRecomputed` 16 → 0 · 중첩 `affectedVisited` 720 → 360 등 하향 10, 새 A 2 (`replaceEdges` · `commitChildrenCloned`). 수정 전 보고 (Phase 0 등록 때 잰 것) 를 새 상한으로 판정하면 block (exit 1) — 원복 RED.

G1 동치 (`adr265DocLayerEquivalence.test.ts`): 무작위 1,200 step (스타일 · 글자 · 이름 · 삽입 · 이동 · 삭제 · template 부품 스타일 · 숨김 · undo · redo) 마다 ① `invalidatedIds` = 수정 전 공식 `[...new Set([...pre, ...post])]` (pre 는 step 의 첫 걸음을 가로채고 post 는 새로 걷는다) ② graph 색인 = `exportDocument()` 로 새로 만든 graph 의 색인 · 바뀐 record 가 깊게 freeze ③ 모든 행 목록 (page 부터 잎까지) = 같은 runtime 위 새 read model 의 값. step > 1,000 · post 생략 > 200 · 생략 안 함 > 100 을 같이 단언 (레버를 실제로 지났는지). L3 의 내용 동일성은 `adr265CommitSharing.test.ts` (commit 결과 = staged JSON · 공유 필드 identity · 바뀐 필드 복제 · 호출자 객체 불변). 변이 4 (post 늘 생략 · owner edge 늘 생략 · 바뀐 필드도 공유 · 부모 의존 늘 신선) 모두 RED, 원본 cmp 복원.

곁가지: `phase4eLayers` 의 「편집한 leaf 자신의 (빈) 행 목록은 다시 읽는다 (+1)」 단언을 +0 으로 (L4 의 의도). `phase3FrameClipPair` 의 제품 파일 grep 이 모듈 옆 테스트 (`subtreeTranslate.test.ts`, ADR-264 `02f6cec67`) 를 제품 reader 로 세던 기존 실패를 `*.test.ts(x)` 제외로 고침.

## 3. Phase 2 — 선택 경로 레버 (G1)

| 후보 | 레버                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 동치 조건 (G1)                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C6   | `CatalogLayerTreeStore.setExpanded`: 펼침 차집합 (새로 펼친 · 접은 key) 의 행만 build / 제거 — `rebuild()` 전체 대신 부분. step listener 의 `renamed` · `valueGated` 판정을 `changedIds` 가 닿는 행 (`visibleNodes` 역색인 · gated 행의 position 조상) 만                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 행 목록 (순서 · 이름 · slot · role · bound rows · 구독) 이 전체 rebuild 와 같다 (무작위 펼침 · 선택 · 편집 ≥ 1,000)                                            |
| C7   | 액션 바 · 메뉴 dry-run — **특성 키 메모는 쓰지 않는다** (리뷰 r1 M1: Group 은 부모 **타입** 이 아니라 `NodeParent` identity 가 같은지 본다 — `commands/structure.ts` 1686 `GROUP_PARENTS_DIFFER`. 같은 Frame 의 Text A+B 는 허용, 다른 Frame 의 Text A+C 는 거절인데 타입 · 부모 타입 · 선택 수 · graph revision 이 같다 — 특성 키는 둘을 합친다). 레버는 둘 중 하나, Phase 0 의 `menuDryRuns` 몫과 명령별 비용으로 정한다: (a) 명령마다 ADR-236 `canOperate` 술어로 먼저 거르고 통과한 것만 실제 계획 — 술어가 거절하는 경우의 **거절 사유** 가 지금 `noteRefusal` 에 오르는 것과 같아야 한다; (b) 메모를 쓰면 키는 **명령별로 선언한 의존** — 선택 id 집합 (정렬) · 각 선택의 `NodeParent` identity · 명령 인자 — 이고 graph step 과 선택 변경 양쪽에서 무효 (즉 같은 선택 집합의 재계산만 막는다 — 패널 재렌더 · 메뉴 재열림) | 허용 집합 · 거절 사유가 수정 전과 같다 (무작위 선택 ≥ 1,000 — 같은 부모 / 다른 부모의 같은 타입 쌍 (r1 M1 반례 A+B · A+C) 을 반드시 포함 · `noteRefusal` 포함) |
| C8   | `findPositionOfRecord`: `childRows` 에 id → index 맵을 같이 캐시 (read model 의 행 계산 때 한 번)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | position 동일                                                                                                                                                  |

- 패널 React 커밋 (RAC · React DOM) 은 이 Phase 의 레버가 아니다 — 카운트가 아닌 측정값이라 production 짝에서 방향만 본다. 선택 Phase 뒤 HC3 미달이고 상위가 패널이면 사용자 결정 2.

### Phase 2 결과 (2026-10-16)

| 레버 | 자리                                                                     | 변경                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C8   | `workspace.positionOfRecord` · `selectRecords`                           | 행 목록마다 identity → 행 색인을 WeakMap 에 두고, 조회가 필요한 만큼만 앞에서부터 채운다 (첫 같은 identity = `find` 와 같은 답). read model 은 행 목록을 바꿀 때 새 배열을 만들고 기존 배열을 고치지 않는다. 앞쪽 몇 개를 고르면 앞부분만 읽는다 (ADR-246 G2 의 `phase4eWorkspace` 「row prefix」 계약 유지 — 처음엔 전체 색인으로 짜서 그 테스트가 잡았다)                                                                                                 |
| C12  | `compositionRoot.pageFrameRects`                                         | page 마다 root member 전체를 훑지 않고 root source 의 record 에서 top record 를 찾는다 (`pageRootRecords` 와 같은 방법)                                                                                                                                                                                                                                                                                                                                     |
| C11  | Attributes 패널 자동 HTML id (`catalogAutomaticHtmlId`, `attributes.ts`) | 첫 빈 번호를 graph revision · stem 마다 한 번만 센다. 자기 자신이 홀로 쓰는 번호가 그보다 작으면 그것 — `catalogUniqueHtmlId` 의 탐색과 같은 답 (무작위 id 표 5,000 개로 대조). 명령 쪽 (`catalogUniqueHtmlId`) 은 그대로                                                                                                                                                                                                                                   |
| C7   | 메뉴 · 액션 바 z-order (`canvasMenu.ts`)                                 | 같은 형제 안 재배치는 index 와 무관하게 거절되거나 허용된다 (`moveNodes` 의 검사 — 자기 안 · 중첩 · 필수 부품 · 상태 owner · Table 정렬 — 가 index 를 읽지 않는다) → 계획 하나로 네 항목을 판정하고 거절 사유는 항목마다 같은 것을 남긴다. index 를 읽는 경우 (RAC Table 의 Column — 셀을 index 로 옮김) 는 명령 모듈의 `reorderReadsIndex` 가 가리고 항목마다 계획한다. Group · Duplicate 의 dry-run 은 그대로 (거절 조건을 복제하는 술어는 r1 M1 의 위험) |
| C6′  | Layers (`CatalogLayersSection.tsx`)                                      | `getKey` · `getTextValue` 를 모듈 상수로 (렌더마다 새 함수라 `TreeBase` 의 `nodeMap` 이 5,000 행을 다시 훑었다 — Layers `getKey` 155,031 → 상위 밖). 펼친 행 Set 은 내용이 같으면 같은 객체 (`expandedList` 문자열 memo)                                                                                                                                                                                                                                    |

카운트 (평평 5k `select-spread` 30 회, dev): 형제 비교 976,175 → 5,001 · `pageFrameRects` member 탐색 775,310 → 상위 밖 · 자동 id 탐색 112,620 → 5,002 (revision 당 한 번) · Layers `getKey` 155,031 → 상위 밖 · 앱 호출 합 3.45M → 1.22M. ratchet (600): select `selectSiblingCompares` 5,880 → 31 · select-spread 118,175 → 570 · `menuDryRuns` 178 → 90 · 새 A `htmlIdProbes`. Phase 1 시점 보고를 새 상한으로 판정하면 block.

남은 것 (선택 5k, dev 호출 수): RAC 의 `CollectionBuilder.getItem` 2.18M · `Tree` 익명 1.09M · `useGridListItem` 775k — 선택 때 다시 그려지는 Layers 행마다 RAC 내부가 형제 전체를 돈다 (D1, RAC 소유 — 이 ADR 의 레버가 아님). 펼친 행 Set 을 고정해도 그대로였다. 앱 쪽은 메뉴 dry-run 의 Group 계획 (375k) 과 z-order 계획 1 개 (145k) 가 남는다.

G1 (`adr265DocLayerEquivalence.test.ts` 확장): C8 — 무작위 1,200 step 마다 모든 행의 `positionOfRecord` = 선형 탐색이 찾는 행. C7 — 무작위 선택 1,000 회 (단일 · 같은 부모 · 다른 부모 다중, page body 섞임) 마다 메뉴의 z-order 항목 · 거절 사유 = 네 위치를 각각 `moveNodes` 로 계획한 결과. C11 — `adr265AutomaticHtmlId.test.ts`. C12 — 기존 page frame 테스트 4 파일. 변이 4 (C8 첫 행 반환 · C12 다른 record · C11 자기 번호 무시 · C7 늘 거절) 모두 RED, 원본 cmp 복원.

**production 짝** (2026-10-16, `--serve-dist` headless Chromium · `--fixed-inputs --profile` · `.cache/perf-ratchet/wt` 의 HEAD `275ce8a10` 빌드 ↔ 같은 HEAD + 이 ADR 의 diff (C7 z-order 전) · 다른 일 없는 상태에서 교대):

| 시나리오 (5k)                     | 수정 전 p99 · drop           | 수정 후 p99 · drop           | taskMs 중앙값 |
| --------------------------------- | ---------------------------- | ---------------------------- | ------------- |
| body 편집 (평평, 불리 케이스) × 2 | 40.0 · 39.3 ms / 6.5 · 6.5 % | 24.8 · 27.5 ms / 1.0 · 3.1 % | 621 → 509     |
| 카드 폭 편집 (중첩, HC2) × 5      | 22.8 ~ 27.3 ms / 0.5 ~ 1.6 % | 23.9 ~ 27.3 ms / 1.0 ~ 2.6 % | 391 → 393     |
| select (평평, HC3) × 2            | 30.4 · 33.3 ms / 5.9 · 5.9 % | 31.1 · 31.6 ms / 4.8 · 6.4 % | 665 → 643     |
| select-spread (평평) × 2          | 31.8 · 31.5 ms / 7.0 · 6.4 % | 28.3 · 31.0 ms / 4.8 · 7.5 % | 639 → 614     |

body 편집은 p99 · drop 이 같이 내려갔다. HC2 · HC3 는 그대로다 — 선택 1 회에서 덜어 낸 것은 1 ms 안쪽 (taskMs 차 / 30). 선택의 production 프로필 상위 (idle 80 ~ 84 %) 는 `commands` chunk (메뉴 dry-run) 2 ~ 2.5 % · RAC `aria-runtime` (`getItem` · `kc` · `bx`) 3 ~ 4 % · React DOM `client` 2 ~ 3 % — 패널 (RAC · React) 커밋이 중심이다 → 사용자 결정 2.

## 4. 종결 (G2)

- production 짝: `.cache/perf-ratchet/wt` 를 수정 전 commit 으로 → `perf:build-dist` before, 이 ADR diff 를 `git apply` → after, 교대 2 쌍 (편집은 5 쌍 — p99 가 상위 2 프레임이라 흔들린다, ADR-264 G4 기록). 조건: `--serve-dist` · headless Chromium · `--fixed-inputs --profile`.
- 불리 케이스: Layers 다 펼친 선택 · body 편집 · Components view 편집 · 1만 노드 문서.
- live exercise: 실제 builder 에서 편집 · 선택 전환 · Layers 펼침 · 액션 바 · undo · 테마 변경 · page 추가 · Compare Mode 에서 Preview 가 같은 record 를 받음 (DOM 리스너) — Playwright 하니스 `apps/builder/scripts/adr265-document-layer-live.mjs` (dev 전역에 `counts.doc` 스냅샷 핸들).
- 4단계 입력: 종결 뒤 남은 프로필 (경계 호출 · 직렬화 비율) 을 §기록에.

### 종결 결과 (2026-10-16 — 측정 기록, 사용자 결정 2 · 3)

- 사용자 결정 2 「측정 기록으로 둔다」 — 대안 C (패널 갱신 다음 프레임) 를 넣지 않는다. 사용자 결정 3 「측정 기록으로 종결」.
- G2 production 짝 (`.cache/perf-ratchet/wt` HEAD `275ce8a10` 빌드 ↔ 같은 HEAD + 이 ADR 최종 diff — 다른 세션 WIP 4 파일 제외 · `--serve-dist` headless · `--fixed-inputs --profile` · 교대 2 쌍, 중첩 select 는 5 + 6 쌍):

| 시나리오 (5k)          | 수정 전 p99 / drop                 | 수정 후 p99 / drop         | taskMs 중앙값 | 판정                      |
| ---------------------- | ---------------------------------- | -------------------------- | ------------- | ------------------------- |
| body 편집 (평평, 불리) | 35.5 · 32.6 ms / 5.5 · 4.1 %       | 21.8 · 24.2 ms / 0 · 1.1 % | 533 → 394     | 개선                      |
| 평평 select (HC3)      | 30.2 · 29.0 / 7.0 · 5.9            | 29.0 · 29.4 / 3.7 · 4.3    | 582 → 551     | drop 만 내려감 · HC3 미달 |
| 평평 select-spread     | 28.8 · 29.8 / 4.9 · 5.9            | 28.4 · 28.6 / 5.4 · 4.3    | 571 → 514     | 방향 없음                 |
| 평평 편집              | 30.3 · 30.7 / 2.6 · 3.1            | 30.5 · 25.5 / 2.6 · 1.5    | 303 → 291     | 유지                      |
| 평평 줌                | 17.7 · 17.6 / 0 · 0                | 17.5 · 17.7 / 0 · 0        | 575 → 530     | 유지 (≤ 20)               |
| 평평 drag              | 20.4 · 20.0 / 0.5 · 0.5            | 20.6 · 20.6 / 0.5 · 0.5    | 1169 → 1145   | 유지                      |
| 중첩 카드 편집 (HC2)   | 22.2 · 22.4 / 1.1 · 0.5            | 23.1 · 27.4 / 0 · 1.6      | 313 → 287     | 방향 없음 · HC2 미달      |
| 중첩 select            | 6 쌍 중앙 25.1 / 상위 10 평균 23.8 | 6 쌍 중앙 24.6 / 22.95     | 445 → 433     | 방향 없음 (아래)          |
| 600 select             | 25.5 · 25.7 / 1.6 · 1.6            | 23.0 · 25.2 / 0 · 1.6      | 423 → 410     | 유지                      |

- 중첩 select 의 첫 5 쌍은 수정 후가 5 / 5 높았다 (+2 ms). 같은 수정 전 빌드가 다음 묶음에서 taskMs 416 → 460 으로 흔들려, 같은 묶음 · 쌍 안 순서 교대로 6 쌍을 다시 쟀다 — 수정 후가 약간 낮다 (p99 중앙 24.6 ↔ 25.1 · 상위 10 gap 평균 22.95 ↔ 23.81). dev 호출 수로도 수정 후가 적다 (앱 338k → 278k · 의존성 6.214M 같음 — wt 의 HEAD dev 서버 5176 ↔ 5173). Layers 변경을 뺀 빌드도 수정 전과 구분되지 않았다. 「방향 없음 (노이즈 폭)」 으로 둔다.
- HC2 미달의 자리: Canvas binding — 옮겨진 상자 수만큼 도는 `subtreeTranslate` (`union` · `cloneClip`) · `catalogOverflowClips` · `canvasBinding` rect diff (`sameRect` · `collect` · `childrenOf`) · `renderCommands` (Phase 0 `--call-counts`, 중첩 편집 600 → 5k 에서 6 ~ 8 배). 이 ADR 의 파일 범위 밖 (ADR-263 · 264 의 파일).
- HC3 미달의 자리: Layers 행이 다시 그려질 때마다 RAC 내부가 형제 전체를 돈다 (dev 의존성 호출 `CollectionBuilder.getItem` 2.18M · `Tree` 1.09M · `useGridListItem` 775k / 30 선택 — RAC 소유, D1) · React DOM 커밋 · 메뉴 Group dry-run (부모 children 재구성, 선택 1 회 12.5k 호출). production 선택 프로필 상위: `commands` chunk 2 ~ 2.5 % · RAC `aria-runtime` 3 ~ 4 % · React DOM `client` 2 ~ 3 % (idle 80 ~ 84 %).
- live: `adr265-document-layer-live.mjs` 11/11 (본문 `### Live Exercise`).
- ratchet: seed 600 · 600:nested-flex 에 `doc.*` A (Phase 0) + 하향 (Phase 1 10 · Phase 2 4) + 새 A 3 (`replaceEdges` · `commitChildrenCloned` · `htmlIdProbes`) · 600 에 `select-spread` 부류. seed 60 은 grid 커밋의 `session.getSnapshot` 올리기 (`e09acd666`) 뒤에 등록했다 — `doc.*` A · `select-spread` 부류 · 하향 10. 등록하며 찾은 회귀: 행 목록 계산이 부모 entry 를 `getEntry` 로 한 번 더 읽어 (C2 `parentFields`) seed 60 page-switch `getEntry` 가 705 → 707 (A 초과, 커밋별 실측 `c6df78b86` 705 · `929f4c8a1` 707). 계산 중 기록 reader 가 이미 읽은 entry 를 다시 쓰게 고쳐 704 (행 `rowFields` 의 재조회도 같이 빠짐) — 수정 전 보고는 704 상한에 block.

### 4단계 (Rust 판정) 입력 · 다음 자리

- 문서 층 (graph · transaction · runtime step · read model) 은 편집 · 선택 모두에서 이제 변경 크기 비례다 — 남은 비례는 큰 컨테이너 편집의 서브트리 무효화 1 회 (자손 resolve 가 조상 값을 읽어 좁히지 않음) 와 저장 대기열의 바뀐 entry JSON (그 entry 의 크기) 뿐. 엔진 wasm 은 어느 프로필 상위에도 없다 — Rust 이관으로 줄어들 JS 비용이 이 층에 남아 있지 않다.
- 편집 꼬리 (HC2) = Canvas binding 의 옮김 · overflow · rect diff (옮겨진 상자 수 비례). 레이아웃 결과로 옮겨진 상자가 문서 크기만큼이면 (카드 폭 → 아래 section 전체) 그 수만큼은 피할 수 없고, 상수 (상자당 Map · clip 복제 · bounds 교차) 가 몫이다.
- 선택 꼬리 (HC3) = 패널 React · RAC 커밋. 레버 후보는 RAC 소유 (행마다 형제 순회) 라 이 저장소에서 고칠 자리가 아니거나, 사용자 가시 동작을 바꾼다 (대안 C — 사용자 결정 2 로 기각).

## 파일 변경표

| 파일                                                                                                                                                                             | 변경                                                                                                               | Phase     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------- |
| `apps/builder/src/builder/catalogRuntime/docCounters.ts` (새)                                                                                                                    | 문서 층 카운터 · dev 전역 스냅샷                                                                                   | 0         |
| `packages/shared/src/catalog/document/graph.ts`                                                                                                                                  | `GraphMetrics` 죽은 필드 배선 · `collectAffectedIds` 큐 · 확장 조건                                                | 0 · 1     |
| `packages/shared/src/catalog/transactions/transaction.ts`                                                                                                                        | ops 복제 · 검증 카운트                                                                                             | 0 · 1     |
| `packages/shared/src/catalog/runtime/compositionRoot.ts`                                                                                                                         | `CatalogRootMetrics` 확장 (rootMembers · stateReaders · overrideDependents · deliver) · C3 필드 집합               | 0 · 1     |
| `packages/shared/src/catalog/runtime/controller.ts`                                                                                                                              | `invalidatedIds` Set 동반 · persist 길이 카운트                                                                    | 0 · 1     |
| `apps/builder/src/builder/catalogRuntime/readModel.ts`                                                                                                                           | `byIndex` 재계산 조건 · 구조 비교 · stats 확장                                                                     | 0 · 1     |
| `apps/builder/src/builder/catalogRuntime/workspace.ts`                                                                                                                           | `afterStep` 의 테마 · Components key 조건 · `findPositionOfRecord` 인덱스 (범위 한정 — 다른 세션 WIP 와 겹침 주의) | 0 · 1 · 2 |
| `apps/builder/src/builder/catalogRuntime/layerTree.ts`                                                                                                                           | 부분 rebuild · step listener 범위                                                                                  | 2         |
| `apps/builder/src/builder/catalogRuntime/{actionBar,canvasMenu}.ts`                                                                                                              | dry-run 메모 / 술어 선별                                                                                           | 2         |
| `apps/builder/src/builder/catalogRuntime/react.runtime.ts`                                                                                                                       | `includes` → Set                                                                                                   | 1         |
| `apps/builder/scripts/perf-baseline.mjs` · `perf-ratchet-gate.mjs`                                                                                                               | `counts.doc` · `select-spread` 부류 · 불리 케이스 옵션 3 · 키 등록                                                 | 0         |
| `apps/builder/perf/ratchet.json`                                                                                                                                                 | `doc.*` A 등록 · 하향                                                                                              | 0 ~ 2     |
| 테스트: `g1` · `phase3DeltaScale` · `transactionImpact` · `nodeAuthoring` (기대값 실측화) · `phase4cReadModel` · `phase4eLayers*` · 새 동치 테스트 `docLayerEquivalence.test.ts` | G0 · G1                                                                                                            | 0 ~ 2     |
| `apps/builder/scripts/adr265-document-layer-live.mjs` (새)                                                                                                                       | live oracle                                                                                                        | 종결      |

## 기록

- 2026-10-16 **Proposed** — 코드 대조 (본문 §코드 사실) 로 제목의 전제 「문서 크기 비례」 가 이 층의 본체 (commit · transaction · step · onStep · deliver) 에는 성립하지 않고 분기 10 개 (C1 ~ C10) 와 상수 비용 3 개에 성립할 수 있음을 확인. 측정 사실: ADR-264 G4 편집 미달 수치 · 0단계 production select (`pw5000` 32.4 ms / 6.4 %, `pnw5000` 23.6 / 0.5 %, `pw600` 21.6 / 0) · ratchet seed 60 select 의 문서 층 호출 수 (`compositionRoot.ts#(anonymous)` 9,610 · `commands/structure.ts#(anonymous)` 7,080 · `graph.getEntry` 5,977 · `workspace.ts#(anonymous)` 5,880 · `readModel.read` 1,710 · `CatalogLayersSection.getKey` 1,891 — 30 회 선택) · seed 60 edit 의 문서 층 키는 B 등급뿐 (`graph.getEntry` 1,636 · `compositionRoot.ts#(anonymous)` 4,960 + 4,712 — 15 회 편집). 문서 층 전용 카운터 없음 · `GraphMetrics` 죽은 필드 2 · `adr248-followup-ratchet.json` `geometryIds` 는 N 비례값을 상한으로 둠. 다른 세션의 grid 작업 (`workspace.ts` 포함) 이 dirty 라 파일 범위를 §Soft constraints 에 적었다.
- 2026-10-16 **리뷰 Round 1 (codex) 반영** — MEDIUM 2 · HIGH 0 ([reviews/265.md](../reviews/265.md)), 둘 다 production 재현이 있어 수리. **M1** C7 의 특성 키 메모 (타입 · 부모 타입 · 선택 수) 는 Group 의 허용 조건 (`NodeParent` identity 동일, `structure.ts` 1686) 을 잃는다 — 같은 Frame 의 Text A+B 허용 ↔ 다른 Frame 의 A+C 거절이 같은 키 · 같은 revision 이라 캐시가 거절될 Group 을 보이거나 가능한 Group 을 숨긴다 (리뷰가 실제 `selectRecords` · `catalogCanvasMenuItems("action-bar")` 로 확인). → 특성 키 메모 제거, 레버 = `canOperate` 술어 선별 (거절 사유 보존) 또는 명령별 의존 (선택 id 집합 · 부모 identity · 인자) 키 메모 (선택 변경에도 무효), G1 동치에 A+B · A+C 반례 필수 (§3 C7 · 본문 대안 A · G1). **M2** 하니스 `select` 드라이버가 규모와 무관하게 처음 30 개만 고른다 → C8 (형제 선형 `find`) 의 비교 수가 앞 30 개는 465 / 465 (600 / 5k) 로 기울기 0, 뒤 30 개는 17,565 / 149,565 — 지금 드라이버로 기울기 표를 만들면 실제 선형 탐색을 상수로 오분류해 후보에서 뺀다. → 새 부류 `select-spread` (앞 · 중간 · 끝 균등 결정적 인덱스 열), 기존 `select` 보존, 기울기 0 은 잰 입력 범위 안의 결과로만 해석 (§1 시나리오 · 본문 G0 · R3). 리뷰 파일 포맷 검사 FAIL 은 writer 출력 문제 — `prettier --write` 는 「unchanged」 라 다른 검사기의 몫, 손대지 않았다.
- 2026-10-16 **리뷰 Round 2 (codex) 수리 검증 통과 — 전제 확정** — M1 · M2 closed (fixed), 신규 HIGH/MEDIUM 0, pending 0. 리뷰 실측: 수정된 의존 키 (선택 id 집합 · 부모 identity · 인자) 가 A+B / A+C 를 구분 · `select-spread` 의 형제 비교 수 600 → **9,065** · 5,000 → **75,065** (2 회 같은 값) — 지금 `select` 의 465 / 465 와 달리 C8 의 선형 비용이 기울기 표에 드러난다 (Phase 0 의 기대값 — 실행 때 하니스 값으로 대조). 미검증: 구현 · 실제 Builder/Preview · production p99/drop (G0 ~ G2 의 몫).
- 2026-10-16 **Accepted · Phase 0 종결 (go)** — §1 Phase 0 결과. 카운터 35 · `select-spread` · `--edit-target body` · `GraphMetrics` 배선 · ratchet 등록 (600 · 600:nested-flex). HC2 시나리오의 문서 층 몫은 상수 (꼬리 = Canvas binding) — 사용자 결정 1 의 조건 (모든 후보 기울기 0) 은 body 편집 때문에 불성립.
- 2026-10-16 **Phase 1 종결** — §2 Phase 1 결과. 레버 4 (L1 ~ L4) · G1 동치 1,200 step · 변이 4 RED · ratchet 하향 10 · 새 A 2. 사후 보고 (adr-writing — scope): 표 초안의 C9 · 상수 · C3 · C5 를 빼고 commit 안의 두 비용 (L2 · L3) 을 더했다 — Phase 0 카운트가 가리킨 자리.
- 2026-10-16 **Phase 2 레버 완료** — §3 Phase 2 결과. C8 · C12 · C11 · C7 (z-order) · Layers 고정 · 변이 4 RED · ratchet 하향 4 · 새 A 1. 새 후보 C11 · C12 와 Layers `getKey` 는 Phase 0 의 `--call-counts` 위치 (`at`) 로 찾았다. 처음 C8 을 전체 색인으로 짜 ADR-246 G2 의 「row prefix」 테스트가 잡아 점진 채움으로 바꿨다.
- 2026-10-16 **Implemented (측정 기록 종결)** — 사용자 결정 2 「측정 기록으로 둔다」 · 결정 3 「측정 기록으로 종결」. §4 종결 결과 · 4단계 입력. 곁가지 수리: `phase3FrameClipPair` 의 제품 파일 grep 이 모듈 옆 테스트를 제품 reader 로 세던 기존 실패 (ADR-264 `02f6cec67` 이 남김).
- 2026-10-16 **후속 — seed 60 ratchet 등록 · 회귀 1 수리** — `e09acd666` 의 `session.getSnapshot` 올리기 뒤 seed 60 에 `doc.*` A · `select-spread` · 하향 10. 등록 측정이 L4 (`parentFields`) 의 `getEntry` 재조회로 page-switch 705 → 707 A 초과를 보여 행 목록 계산이 기록 reader 의 조회 결과를 다시 쓰게 고쳤다 (704). seed 60 B 경고 6 (`controller.current` 등) 은 `c6df78b86` 에서도 같은 값 — 이 ADR 과 무관, 그대로 둔다.
