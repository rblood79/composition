# ADR-265: 편집 · 선택 전환의 문서 층 비용 — 문서 크기에 비례하는 자리를 변경 크기 비례로 (Canvas 성능 계획 3단계)

## Status

Implemented — 2026-10-16 (측정 기록 종결 — 사용자 결정 2 「측정 기록으로 둔다」 · 결정 3 「측정 기록으로 종결」)

- 승격 근거: 사용자 `/execute-adr 265` (2026-10-16) + [reviews/265.md](../reviews/265.md) Round 2 pending 0 · HIGH 0 (전제 확정).

> **Phase 0 종결 (2026-10-16) — go.** 문서 층 카운터 `counts.doc.*` 35 개 (shared `catalog/docCounters.ts` · dev 전역 `__composition_DOC_COUNTERS__`) 를 하니스에 싣고 같은 옵션 2 회 같은 값 (등급 A). 새 부류 `select-spread` (Canvas 클릭 경로 · 앞 · 중간 · 끝 균등) · 불리 옵션 `--edit-target body`. 기울기 (600 → 5k): **편집 하니스 시나리오 (HC2 대상, 카드 폭) 는 문서 층 카운트 전부 상수** — 규모와 함께 느는 호출은 Canvas binding (`subtreeTranslate` · overflow clip · rect diff, 이 ADR 범위 밖). **body 편집** 은 비례 — 서브트리 확장 18,060 → 150,060 · page 행 read 비교 직렬화 2.7 → 23 MB. **선택** 은 비례 — 형제 비교 118,175 → 976,175 (overlay 가 페인트마다 위치 조회) · 새 후보 C12 `pageFrameRects` member 탐색 93k → 775k · C11 자동 HTML id 탐색 13.6k → 112.6k · C7 dry-run 안 children filter 70k → 580k · Layers RAC `getKey` 18.6k → 155k. C3 · C4 · C5 · C9 · C10 은 하니스 편집에서 0 회 (빈도 0 — 레버에서 뺌). 죽은 `GraphMetrics` 필드: `transactionEntriesTraversed` 배선 (leaf 1 · 5k 형제 삽입 2 — 테스트 7 곳 실측화), `transactionEntryTableClones` 는 셀 지점이 없어 삭제. ratchet: 600 · 600:nested-flex 에 `doc.*` A 등록 · 600 에 `select-spread` (recorder 변경 승인). seed 60 등록은 HEAD 의 `session.getSnapshot` A 초과 (다른 세션의 미푸시 grid 커밋 — HEAD worktree 게이트로 확인) 가 풀린 뒤. 인위 회귀 `block` (exit 1) 확인. 사용자 결정 1 의 조건 (모든 후보 기울기 0) 은 body 편집 때문에 불성립 — 다만 HC2 시나리오는 이 층 밖이라 종결에서 사용자 결정 3 으로 간다. 상세: [breakdown §1 Phase 0 결과](../design/265-document-layer-edit-select-cost-breakdown.md).

> **Phase 1 종결 (2026-10-16) — 편집 레버 4.** L1 C1: post-commit 걸음은 시드가 같고 색인이 그대로면 건너뛴다 (Builder runtime · Preview receiver) · 큐 포인터. L2 `graph.replace`: owned children 이 같은 entry 의 owner edge 를 열거하지 않는다. L3 `ownedRecord`: 이전 record 와 공유하는 freeze 된 필드를 다시 복제하지 않는다. L4 C2: 행 목록 read 는 부모의 행 관련 필드 (kind · definitionId · children · descendantOverrides) 에만 의존. body 편집 5k 15 회: edge 열거 150,030 → 30 · children 복제 75,000 → 0 · 행 재계산 15 → 0 · 비교 직렬화 23 MB → 0 · 서브트리 걸음 150,060 → 75,030 (서브트리 확장 자체는 유지 — 자손 resolve 가 조상 값을 읽는다). G1 동치 1,200 step (invalidated ids = 수정 전 공식 · 색인 = 새로 만든 graph · 행 목록 = 새 read model) + commit 공유 단위 테스트 · 변이 4 RED. ratchet 하향 10 · 새 A 2 · 수정 전 보고 block. HC2 시나리오 (카드 폭) 의 문서 층 몫은 원래 상수라 이 Phase 로 HC2 가 움직이지 않는다 (Phase 0). 상세: [breakdown §2 Phase 1 결과](../design/265-document-layer-edit-select-cost-breakdown.md).

> **Phase 2 레버 완료 (2026-10-16) — 사용자 결정 2 대기.** C8 행 목록마다 identity 색인 (필요한 만큼만 앞에서부터 — 앞쪽 선택은 앞부분만 읽는 ADR-246 계약 유지) · C12 `pageFrameRects` 가 root source 의 record 에서 top 을 찾음 · C11 자동 HTML id 의 첫 빈 번호를 revision · stem 마다 한 번 · C7 z-order 네 항목을 계획 하나로 판정 (index 를 읽는 RAC Table Column 은 항목마다 — `reorderReadsIndex`) · Layers `getKey` 상수 · 펼친 행 Set 고정. 평평 5k 선택 30 회: 형제 비교 976,175 → 5,001 · 앱 호출 3.45M → 1.22M. G1 확장 (C8 · C7 무작위 대조) · 변이 4 RED · ratchet 하향 4 · 새 A 1. **production 짝** (HEAD `275ce8a10` ↔ + 이 ADR, 5k): body 편집 p99 40.0 · 39.3 → 24.8 · 27.5 ms · drop 6.5 → 1.0 · 3.1 % · 카드 편집 (HC2) 23 ~ 27 ms 그대로 · select (HC3) 30 ~ 33 → 31 ~ 32 ms · drop ~6 % 그대로. 선택의 남은 상위는 RAC (`aria-runtime`) · React DOM · 메뉴 dry-run — 선택 때 다시 그려지는 Layers 행마다 RAC 내부가 형제 전체를 돈다 (dev 호출 `CollectionBuilder.getItem` 2.18M / 30 회). 상세: [breakdown §3 Phase 2 결과](../design/265-document-layer-edit-select-cost-breakdown.md).

> **종결 (2026-10-16) — 측정 기록.** 사용자 결정 2 「측정 기록으로 둔다」 (대안 C 를 넣지 않음 — 선택 즉시 패널이 같은 프레임에 갱신, HC5 유지) · 결정 3 「측정 기록으로 종결」. G2 production 짝 (HEAD `275ce8a10` ↔ + 이 ADR 최종 diff, 5k, 교대): body 편집 p99 35.5 · 32.6 → 21.8 · 24.2 ms · drop 5.5 · 4.1 → 0 · 1.1 % (불리 케이스 — 개선) · 평평 select p99 ~29 ms 그대로 · drop 7.0 · 5.9 → 3.7 · 4.3 % · 평평 편집 · 줌 (17.5 ms) · drag (20.5 ms) · 600 select 유지 · 중첩 카드 편집 (HC2) · 중첩 select 방향 없음 (노이즈 폭 — 중첩 select 는 첫 5 쌍이 수정 후 +2 ms 였으나 같은 묶음 · 순서 교대 6 쌍에서 수정 후가 약간 낮음, 같은 수정 전 빌드가 taskMs 416 → 460 으로 흔들린 묶음). HC2 · HC3 미달: HC2 의 꼬리는 Canvas binding (옮겨진 상자 수만큼 도는 `subtreeTranslate` · overflow clip · rect diff), HC3 의 꼬리는 Layers 행 렌더의 RAC 내부 (행마다 형제 전체) · React DOM · 메뉴 Group dry-run. live 11/11 (아래). ratchet: seed 60 의 `doc.*` 등록은 HEAD 의 `session.getSnapshot` A 초과 (다른 세션의 미푸시 grid 커밋) 가 풀린 뒤로 남긴다. 4단계 입력 · 다음 자리: [breakdown §4](../design/265-document-layer-edit-select-cost-breakdown.md).

- 사용자 요청: `/create-adr 3단계 — 편집 · 선택 전환의 문서 층 비용 (graph.replace/commit · readModel.onStep · compositionRoot.deliver 를 문서 크기 비례에서 변경 크기 비례로)` (2026-10-16)
- 방향을 정한 사용자 원문: 「다음은 남은 중첩 편집 비용(문서 · 트랜잭션 층)과 3단계 선택 전환을 묶을 새 ADR 을 `/create-adr` 로 시작하는 일인가?」 → 「adr 245는 미뤄졌다」 (2026-10-16) — ADR-264 가 Canvas 밖으로 넘긴 편집 꼬리와 Canvas 성능 계획의 3단계 (선택 전환) 를 한 ADR 로 묶는다. 둘 다 같은 층 (문서 · 트랜잭션 · read model · 전달 · Layers 구독) 을 지나기 때문이다.
- 이미 정해진 것: 측정이 설계보다 먼저 (ADR-263 · 264 와 같은 규율 — 카운트 RED → 수정 → ratchet 하향, measurement-validity §5). 편집 닫는 조건은 2단계의 HC2 그대로 (중첩 5k 편집 p99 ≤ 20 ms · drop < 1 %, production 레인). Rust 이관 판정은 4단계 (이 ADR 종결 뒤 — ADR-921 은 되살리지 않는다). ADR-245 는 사용자가 미뤘다 (이 ADR 이 착수 순서 1 위).
- 리뷰: [reviews/265.md](../reviews/265.md) Round 1 (codex, 2026-10-16) HIGH 0 · MEDIUM 2 — M1 C7 특성 키 메모가 Group 의 부모 identity 조건을 합침 (같은 Frame 의 Text 쌍 허용 ↔ 다른 Frame 거절, 실제 메뉴 경로 재현) · M2 하니스 `select` 가 규모 무관 처음 30 개만 골라 형제 선형 `find` 를 기울기 0 으로 오분류 (앞 465 / 465 ↔ 뒤 17,565 / 149,565). → r1 반영: 특성 키 메모 제거 (`canOperate` 선별 또는 명령별 의존 키) · `select-spread` 부류 · 기울기 해석 범위 (대안 A · G0 · G1 · breakdown §1 · §3). Round 2 (codex, 2026-10-16) 수리 검증 통과 — M1 의존 키가 A+B / A+C 를 구분 · M2 `select-spread` 비교 수 600 → 9,065 · 5,000 → 75,065 (2 회 같은 값, 선형 비용이 드러남) · 신규 HIGH/MEDIUM 0 · pending 0 → **전제 확정** (premise-decision-points 종결 계약). 구현 · 실제 Builder/Preview · production 수치는 UNVERIFIED (execute 의 몫).

Related: [ADR-264 이동만 한 서브트리의 patch 축소](264-moved-subtree-translate-page-grid-rebind.md) (직전 단계 — 남은 편집 비용의 출처) · [ADR-263 그리기 명령 패치·실행 비용](263-render-command-patch-execute-cost.md) (2단계 · 닫는 조건의 출처) · [ADR-248 통합 catalog 문서](248-unified-catalog-document.md) (이 층의 원 결정 — graph · transaction · composition root · read model) · [ADR-246 카운트 ratchet](246-deterministic-count-ratchet-and-begin-frame-harness.md) (집행 수단 · G2 가 선택 경로의 첫 하향 `findNodeByIdInSubtree` 62,910 → 0) · [ADR-243 상호작용 응답성](243-interaction-responsiveness-long-task-yield.md) (long task 귀속 — 패널 React 커밋이 입력 task 의 92 ~ 94 %)

## Context

### 문제 — 두 꼬리가 같은 층에 있다

**편집** (ADR-264 G4, 2026-10-16, production 짝 `bf7d7ff84` ↔ + ADR-264, 교대 5 쌍): 중첩 5k 편집 p99 19.6 · 27.3 · 24.1 · 25.2 · 26.1 ms · drop 0 · 1.6 · 1.0 · 2.1 · 1.6 % — HC2 (≤ 20 · < 1) 미달. Canvas patch 교체는 178,875 → 1,155 명령으로 줄었고 (`executeCommandRange` · patch 계열이 프로필 상위에서 사라짐), 남은 비용의 상위는 Canvas 밖이다 — dev 프로필 (중첩 5k 편집, idle 57 %): `graph.replace` 6.5 % · `graph.commit` 4.4 % · `readModel.onStep` 3.3 % · `compositionRoot.deliver` 3.3 % · `applyCatalogTransaction` 3.1 % · `workspace.touchesTheme` 2 %. production 프로필 (ADR-263 전 `pnw5000` edit) 의 Canvas 밖 상위는 `graph.getDefinition` 1.2 % · `validateTokenFields` · `compositionRoot` 계열 0.3 ~ 0.6 % 다 (`.agent/runs/2026-10-15-canvas-rust-baseline/prod/`).

**선택 전환** (3단계 — 0단계 production 측정 2026-10-15, `--serve-dist` headless Chromium):

| 시나리오 (prod)            | cb gap p95 / p99 (ms) | drop  | 상위 self-time (idle 제외)                                                                                                          |
| -------------------------- | --------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 평평 5k select (`pw5000`)  | 27.5 / 32.4           | 6.4 % | `aria-runtime` (RAC — Builder 패널) 1.7 · 1.7 · 1.0 % · React DOM `client` 1.4 % · `viewportActions` 0.7 % · `commands` chunk 0.7 % |
| 중첩 5k select (`pnw5000`) | 20.7 / 23.6           | 0.5 % | React DOM 1.4 · 0.7 % · `graph.getEntry` 0.7 % · RAC 0.7 % × 4 · `resolver` 0.4 % × 2                                               |
| 평평 600 select (`pw600`)  | 18.8 / 21.6           | 0 %   | 전부 ≤ 0.7 %                                                                                                                        |

같은 조작의 dev 수치 (drop 9 ~ 15 %) 는 React DEV 부담이 섞여 인용하지 않는다 (ADR-263 HC2 규칙). 선택 전환은 Canvas 그리기 명령이 아니다 — `render.*` 카운트는 select 부류에서 전부 0 이다 (`apps/builder/perf/ratchet.json` seed 60 · 600). 비용은 store 선택 → `CatalogSession.select` → `workspace.selectRecords` → read model → Layers 트리 · Design 패널 · 액션 바 (React) 로 이어지는 **문서 층과 그 구독자** 에 있다.

### 코드 사실 — 이 층은 대부분 이미 변경 크기 비례다. 문서 크기에 비례하는 자리는 분기 몇 개다

제목의 전제 (「문서 크기 비례」) 를 코드로 대조한 결과다 (2026-10-16 소스 실측, 요청한 이름 중 `graph.replace` 는 `commit` · `revertCommit` 만 부르는 private 메서드이고 `structure.ts` 는 `packages/shared/src/catalog/commands/structure.ts` 뿐이다 — `useCanonicalNode` · `useEditContract` · `LayersSection` 은 없는 이름이다).

**이미 변경 비례인 자리** (고치지 않는다):

1. `CatalogGraph.commit` → private `replace` (`packages/shared/src/catalog/document/graph.ts` 465 · 522): 노드 table 은 가변 `Map` 하나 (308) 이고 복제하지 않는다 — staged 항목만 `set` / `delete`, 색인 edge 는 old / new 차이만 (526 ~ 551). `revertCommit` (506) 도 같다. 전체 복제 getter (`indexes` 447 · `dirtyIds` 395 · `history` 392) 는 테스트만 쓴다.
2. `applyCatalogTransaction` (`packages/shared/src/catalog/transactions/transaction.ts` 644): staged 항목마다 `validateCatalogEntry` · `validateEntryReferences` (667 ~ 678), 구조 변경이면 `validateStructuralDelta` (graph 606 — 「never with the graph」). 전체 검증 `validateView` (graph 808) 는 생성자에서만 (362).
3. runtime `step` (`packages/shared/src/catalog/runtime/controller.ts` 533 ~ 596): 저장 대기열은 changed entry 마다 `JSON.stringify` (571 ~ 574 — entry 크기 비례), `notify` 는 `invalidatedIds` 의 구독만 (598 ~ 603), step listener 는 전부 호출 (587 ~ 589).
4. `CatalogReadModel.onStep` (`apps/builder/src/builder/catalogRuntime/readModel.ts` 446): 역색인 `byDep` · `byRow` 로 변경 id 에 걸린 read 만 재계산 (453 ~ 465).
5. `CatalogCompositionRoot.deliver` (`packages/shared/src/catalog/runtime/compositionRoot.ts` 4813): 구독자에게 전체 트리가 아니라 apply 가 만든 notices (바뀐 record 의 `{id, record}`) 만 — record 마다 그 id 의 canvas · dom 리스너 (4817 ~ 4833). 값만 바꾼 편집의 `plan` 은 `planInstances` (3758) — instance 마다 조상 사슬만 허용하는 pruned resolve, owned 경로에서는 그 경로의 자식 하나 (3830 ~ 3831).
6. `workspace.touchesTheme` (`apps/builder/src/builder/catalogRuntime/workspace.ts` 87 ~ 101): 판정은 변경 id 의 접두사 검사뿐. `afterStep` (212) 이 매 편집 부른다 (227).
7. 선택: `CatalogSession.select` · `reconcile` (`session.ts` 141 ~ 249) 은 O(선택 수), Layers 의 `autoExpanded` · `selectedChain` (`CatalogLayersSection.tsx` 99 ~ 110 · 274 ~ 284) 은 O(깊이).

**문서 (또는 보이는 것 전체) 크기에 비례하는 것이 확실한 자리** — 이 ADR 의 후보 (Phase 0 이 각각의 몫을 잰다):

| #   | 자리                                                                                                                                                                                                                                                                                                                                 | 언제 도는가                                                    | 비례 대상                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------- |
| C1  | `graph.collectAffectedIds` (graph.ts 1316 ~ 1348, 호출 controller.ts 542 · 557): 변경 id 의 **소유 서브트리 전체** (`expandChildren`) + 조상 사슬 + instance · token · collection 의존자를 BFS — `queue.shift()` (1320) 라 큐가 크면 O(n²)                                                                                           | 매 step                                                        | 변경 노드의 서브트리 + 의존 instance   |
| C2  | `readModel.onStep` 의 `byIndex` read (`instancesOf` · `referrersOf` — 예: `components` read 418): **어떤 step 이든 무조건** 재계산 (469) · 값 비교가 `JSON.stringify` (93 ~ 94) 라 행 목록 크기 비례                                                                                                                                 | 매 step                                                        | 정의 수 · 행 목록 크기                 |
| C3  | `compositionRoot.plan` 의 full-root 경로 (4560 ~ 4578 · 4701 ~ 4714): page · project entry 가 바뀌었거나 Components view 면 모든 root 를 `flatten` (`traversedWholeInputGraph`), `apply` 의 `keep(rootMembers)` (4759 · 1968 ~ 1977) 가 page member Set 을 통째로 복사 (undoLog 있을 때)                                             | page · project entry 변경 (page 추가 · 설정 · Components view) | 문서 전체                              |
| C4  | `stateReaders()` (1779 ~ 1791, 호출 4586 ~ 4594) · `overrideDependents()` (3662 ~ 3693): `this.records` 전체를 훑는다                                                                                                                                                                                                                | stateVariable · definitionOverride 변경                        | record 수                              |
| C5  | `workspace.afterStep`: project entry 가 바뀌면 `applyTheme()` → `catalogThemeState(graph)` (token 수 비례 · `JSON.stringify` key) · key 가 다르면 `rebuildThemed` → `replaceRoot` (191 ~ 210, `engine.clear()` 후 새 root — O(문서)); Components view 면 매 step `JSON.stringify(catalogProjectComponents(graph))` (233 ~ 236)       | project entry 변경 · 테마 변경 · Components view               | token 수 · 문서 전체                   |
| C6  | Layers: `CatalogLayerTreeStore.setExpanded` → **`rebuild()` 전체** (`layerTree.ts` 249 ~ 257 · 271 ~ 420 — 보이는 행마다 `nameOf` · `typeNameOf` · `slotOf` · `roleOf` · `boundRows` · `syncSubscriptions`); step listener (212 ~ 237) 는 매 편집 `visibleNodes` 의 이름 · slot 재판정 + `valueGated.some` (보이는 template 행 전체) | 선택이 펼친 집합을 바꿀 때 (매 선택 전환) · 매 편집            | 보이는 (펼친) 행 수 — 다 펼치면 페이지 |
| C7  | 선택마다 명령 dry-run: 액션 바 모델 (`actionBar.ts` 83 ~ 96) → `catalogCanvasMenuItems` → 항목마다 `command(host.graph)` 를 실제로 계획해 허용 여부 판정 (`canvasMenu.ts` 141 ~ 149). seed 60 select 30 회에 `commands/structure.ts#(anonymous)` 7,080 · `compositionRoot.ts#(anonymous)` 9,610 · `graph.getEntry` 5,977 (ratchet A) | 매 선택 전환                                                   | 명령마다 다름 — **불명** (Phase 0)     |
| C8  | `workspace.selectRecords` → `findPositionOfRecord` (625 ~ 647): 깊이마다 `childRows` 에서 형제를 선형 `find`                                                                                                                                                                                                                         | 매 선택 전환                                                   | 깊이 × 형제 수 (평평 5k = 5,000 형제)  |
| C9  | `useCatalogEditContract` (`react.runtime.ts` 136 ~ 187): step 마다 의존 id 수만큼 `invalidatedIds.includes` (배열, 150 ~ 157)                                                                                                                                                                                                        | 매 step                                                        | deps × invalidated                     |
| C10 | `validateDefinitionCycles` (graph.ts 800 ~ 805): 정의가 바뀌면 project 의 `definitionIds` 전부                                                                                                                                                                                                                                       | 정의 변경                                                      | 정의 수                                |

세 가지 상수 비용도 후보에 둔다 — 비례 대상이 아니라 매 편집의 고정 몫이라 측정 뒤 레버가 될 수 있다: `forward = structuredClone(request.ops)` (transaction.ts 685) · 저장 대기열의 entry `JSON.stringify` (controller.ts 571 — entry 크기) · readModel 의 `JSON.stringify` 값 비교 (C2 와 같은 줄).

**카운터 사실**: 이 층의 결정적 카운터는 없다. `ratchet.json` 은 `v8.fn.*` (상위 20 함수 — 목록에 없으면 0 이 아니라 「상위 밖」, A 등록 불가 `perf-ratchet-gate.mjs` 164 ~ 169 · 401 ~ 402) 로만 간접 관측하고, seed 600 run 은 `--call-counts` 가 없어 v8 키가 없다. 코드 안 `GraphMetrics` (graph.ts 41 ~ 47) 의 `transactionEntriesTraversed` · `transactionEntryTableClones` 는 **어디서도 증가하지 않는다** (341 · 344 · 1364 · 1367 초기화만) — 이를 0 으로 단언하는 테스트 4 개 (`g1.test.ts` 295 · `phase3DeltaScale.test.ts` 131 · `transactionImpact.test.ts` 291 · `nodeAuthoring.test.ts` 341) 는 아무것도 검증하지 못한다. `CatalogRootMetrics` (compositionRoot.ts 1978 ~ 1990: `resolverVisits` · `layoutInputVisits` · `traversedWholeInputGraph` · `canvasInputUpdates` · `domInputUpdates`) 와 `readModel.stats` (110) 는 있으나 하니스에 실리지 않는다. `adr248-followup-ratchet.json` 의 `geometryIds` 는 seed 600 → 5,000 에서 610 → 5,010 — **문서 크기에 비례하는 값을 그대로 상한으로 둔 것** 이라 회귀를 막지 못한다.

### 전제 점검 — 추정 vs 실측

제목의 전제는 ADR-264 가 넘긴 dev 프로필 상위 함수 이름에서 왔다. 코드 대조는 그 함수들의 **본체** 가 변경 비례임을 보인다. 그렇다면 프로필의 6.5 % 는 (a) 호출마다의 상수 비용 (복제 · 직렬화 · 검증) 이 편집 1 회에 쌓인 것이거나, (b) 위 표의 분기 (C1 서브트리 확장 · C2 매 step 재계산 · C6 Layers · C7 dry-run) 가 그 함수 안에서 불린 것이거나, (c) dev 빌드 부담이다. 어느 쪽인지는 **문서 크기 두 점 (600 · 5k) 의 편집 1 회 카운트 기울기** 로 갈린다 — 기울기가 0 이면 「문서 크기 비례」 전제가 틀린 것이고 레버는 상수 비용 쪽이다. 이 판정이 Phase 0 의 go/no-go 다 (ADR-264 Phase 0 의 교훈 — breakdown 초안의 가정이 카운트로는 0.5 % 였다). 추정 vs 실측 gap 은 Phase 0 inventory 로 흡수한다 (adr-writing M3) — 사용자 결정은 그 결과를 받는 자리에만 둔다.

### 3-domain 판정

D3 시각 스타일의 두 consumer 가 **공유하는 문서 층** (catalog graph · transaction · composition root — Builder Canvas 와 Preview DOM 이 같은 notices 를 받는다) 과 Builder 전용 구독자 (read model · Layers · 액션 바) 의 실행 경로다. D1 · D2 · catalog 정의 · 문서 · 저장 형식 · 레이아웃 결과 · notices 의 내용은 바꾸지 않는다 — 바뀌는 것은 같은 결과를 내는 데 훑는 양뿐이다. Preview 대칭은 「DOM 리스너가 받는 record 가 같다」 로 유지한다. Generator / catalog 확장 없음.

### Hard constraints

- **HC1 결과 동일**: 편집 뒤 canonical 문서 · history · 저장 대기열 내용 · read model 값 · Layers 행 · 액션 바 허용 집합 · Canvas · DOM 리스너가 받는 record 집합이 수정 전과 같다 (동치 테스트 — 무작위 편집 ≥ 1,000).
- **HC2 편집 닫는 조건 (production 레인, ADR-263 승계)**: 중첩 5k 편집 p99 ≤ 20 ms · drop < 1 %. 평평 5k 편집 · 줌 · drag 유지.
- **HC3 선택 닫는 조건 (production 레인, 3단계)**: 평평 5k select p99 ≤ 20 ms · drop < 1 % (지금 32.4 · 6.4 %). 중첩 5k select ≤ 20 · 600 유지. dev 수치는 인용하지 않는다.
- **HC4 카운트 먼저**: 문서 층 전용 카운터가 하니스 `counts` 에 실리고 (등급 A), 수정 전 값이 RED 로 고정되며, 수정과 같은 커밋에서 ratchet 상한이 내려간다 (ADR-246 · `--add-keys`). 원복 RED 는 ratchet `block`.
- **HC5 사용자 가시 동작 무변경** (대안 C 를 사용자 결정 2 로 고르지 않는 한): 선택 즉시 패널 · Layers · 액션 바가 같은 프레임에 갱신된다.

### Soft constraints

- Canvas 그리기 경로 (ADR-263 · 264 의 파일) 는 건드리지 않는다 — 그쪽 카운트는 유지 (ratchet 이 지킨다).
- 다른 세션의 grid 열 · 행 작업 (`canvasGesture.ts` · `gridTrack*` · `CatalogCanvas.tsx` WIP) 과 파일이 겹치지 않는다 — 이 ADR 의 파일은 `catalog/document` · `catalog/transactions` · `catalog/runtime/compositionRoot.ts` · `catalogRuntime/{readModel,layerTree,workspace,session,actionBar,canvasMenu,react.runtime}.ts` 와 하니스다.
- 4단계 Rust 판정 입력: 종결 뒤 남은 프로필을 §기록에 (경계 호출 · 직렬화 비율).

## Alternatives Considered

### 대안 A: 측정 먼저 — 문서 층 카운터를 등록하고, 문서 크기에 기울기가 있는 자리만 변경 크기 비례로 고친다

- 설명: Phase 0 에서 위 표 C1 ~ C10 과 상수 비용 3 개를 세는 카운터 (`GraphMetrics` 의 죽은 필드 배선 · `CatalogRootMetrics` · `readModel.stats` · Layers rebuild 행 수 · dry-run 명령 수 · `selectRecords` 형제 비교 수) 를 하니스 `counts.doc` 에 싣고 600 · 5k (평평 · 중첩) 편집 1 회 · 선택 1 회의 값을 등급 A 로 잰다. 기울기가 있는 자리를 몫 순서로 고친다 — 후보 레버: C1 큐를 인덱스 포인터로 (`shift` 제거) · 서브트리 확장을 「자손 입력이 바뀔 수 있는 변경」 으로 좁힘, C2 `byIndex` read 를 정의 · 참조 변경 때만, C6 Layers `rebuild` 를 펼침이 바뀐 행의 부분 rebuild 로 · step listener 의 `valueGated` 판정을 변경 id 가 닿는 행만, C7 dry-run 을 명령마다 싼 `canOperate` 술어 (ADR-236 의 판정 모듈 — 거절 사유 보존) 로 먼저 거르거나, 메모를 쓰면 명령별로 선언한 의존 (선택 id 집합 · 각 선택의 `NodeParent` identity · 명령 인자) 을 키로 (특성 키 — 타입 · 부모 타입 · 선택 수 — 는 쓰지 않는다: Group 은 부모 identity 동일을 보므로 같은 Frame 의 Text 쌍과 다른 Frame 의 Text 쌍을 합친다, 리뷰 r1 M1), C8 형제 위치를 `childRows` 의 id → index 맵으로, C3 · C5 의 page · project entry 변경을 「레이아웃 · 테마에 닿는 필드」 로 좁힘. 기울기가 0 인 자리는 고치지 않고, 상수 비용 (복제 · 직렬화) 은 몫이 상위면 레버로 (예: `structuredClone(ops)` 를 ops 가 불변일 때 생략, readModel 비교를 구조 비교로).
- 근거: ADR-246 G2 (`findNodeByIdInSubtree` 62,910 → 0 — 선택 경로의 첫 하향이 바로 이 층의 선형 탐색이었다) · ADR-264 Phase 0 (가설 대신 분해 카운트). 외부: Chrome DevTools 의 「self-time 상위 = 호출자가 아니라 피호출자」 함정 — 프로필 이름이 가리키는 함수 본체가 아니라 그 안의 분기를 세야 한다.
- 위험: 기술 **L** (각 레버가 독립 · 작다 — 동치 테스트가 계약) / 성능 **M** (기울기 0 이면 HC2 · HC3 를 이 층에서 못 닫는다 — 사용자 결정 1) / 유지보수 **L** (카운터가 남아 회귀를 막는다) / 마이그레이션 **L** (저장 형식 · notices 무변경).

### 대안 B: 문서 층을 구조 공유 불변 트리 (persistent data structure) 로 재설계해 변경 비례를 구조로 보장

- 설명: graph table · 색인 · composition root 의 records 를 HAMT / 경로 복사 트리로 바꿔 commit · plan · deliver 가 구조적으로 O(변경 × log N) 이 되게 한다.
- 근거: Figma 의 multiplayer 문서 모델 · Immer / Immutable.js.
- 위험: 기술 **H** (graph 는 이미 가변 Map 하나로 O(변경) — 재설계가 줄이는 비용이 없다; 소비자 수십 곳) / 성능 **M** (읽기마다 log N) / 유지보수 **H** / 마이그레이션 **H** (ADR-248 runtime 전면).

### 대안 C: 선택 전환의 패널 갱신 (Layers · Design · 액션 바) 을 다음 프레임 또는 idle 로 미룬다

- 설명: 선택 즉시는 Canvas overlay 만, React 패널은 `scheduler.postTask` / rAF 뒤에 갱신.
- 근거: production 선택 프로필의 상위가 RAC · React DOM (패널) 이다 (위 표). ADR-243 이 입력 task 의 92 ~ 94 % 를 React 동기 커밋으로 귀속했다.
- 위험: 기술 **L** / 성능 **L** (프레임 예산을 두 task 로 나눌 뿐 총량은 같다) / 유지보수 **L** / 마이그레이션 **L** — 그러나 **사용자 가시 동작이 바뀐다** (패널이 한 프레임 늦게 따라온다) 하고 편집 꼬리에는 닿지 않는다. ADR-243 은 「다음 paint 에 불필요한 작업 1 ~ 3 %」 로 분할을 skip 했다 — 같은 결론이 선택에도 적용될 가능성이 크다. 단독 기각 · 사용자 결정 2 의 보조 수단으로만.

### 대안 D: Rust/wasm 으로 문서 층을 옮긴다

- ADR-263 · 264 대안 D · E 와 같다 — 4단계 판정의 몫. production 프로필에서 엔진 wasm 은 상위에 없고 (`wasm-function[9]` 0.6 %), 이 층의 비용은 JS 설계 (분기 · 복제 · 직렬화) 라 이관하면 원인이 가려진다.

### Risk Threshold Check

| 대안 | HIGH+                                | 판정                                         |
| ---- | ------------------------------------ | -------------------------------------------- |
| A    | 없음                                 | 채택 후보                                    |
| B    | 기술 H · 유지보수 H · 마이그레이션 H | 기각                                         |
| C    | 없음 — 그러나 HC5 위반 · 편집 무관   | 단독 기각 · 사용자 결정 2 의 보조 수단으로만 |
| D    | (4단계)                              | 이 ADR 범위 밖                               |

루프 불필요 — A 에 HIGH 없음.

## Decision

**대안 A 를 채택한다.** Phase 0 이 문서 층 카운터를 등록하고 600 · 5k 두 점의 기울기 표로 「문서 크기에 비례하는 자리」 를 확정한 뒤 (go/no-go), 몫 순서로 레버를 적용한다 — 편집 (C1 · C2 · C9 · 상수 비용) 과 선택 (C6 · C7 · C8) 을 Phase 로 나누고, C3 · C4 · C5 · C10 은 기울기와 발생 빈도 (page · project · 정의 · 테마 변경은 편집 조작 15 회 중 몇 회인가) 로 포함 여부를 정한다.

- 위험 수용 근거: A 의 잔존 위험은 「기울기가 0 이라 이 층에서 HC2 · HC3 를 못 닫는다」 하나다. 그때도 Phase 0 의 카운터 · 기울기 표 · 죽은 metric 수리는 남고 (측정 기록 종결 — ADR-243 · 263 · 264 와 같은 정상 종결), 다음 자리 (패널 React 커밋 · GC) 가 수치로 가려진다.
- B 기각: graph 가 이미 O(변경) 이라 구조 재설계가 줄이는 비용이 없다 — 비용은 분기와 상수에 있다.
- C 기각 (단독): 사용자 가시 지연을 들여오면서 총량은 같고 편집에 닿지 않는다. 선택 Phase 뒤에도 HC3 미달이고 남은 비용이 패널 React 커밋이면 사용자 결정 2.
- D 보류: 4단계.

> 구현 상세: [265-document-layer-edit-select-cost-breakdown.md](../design/265-document-layer-edit-select-cost-breakdown.md)

### 사용자 결정 3건 (execute-adr 가 해당 Phase 에서 묻는다)

1. **Phase 0 no-go — 편집 1 회 카운트의 600 → 5k 기울기가 모든 후보에서 0 이면**: 「문서 크기 비례」 전제가 틀린 것이다. 상수 비용 (복제 · 직렬화 · dry-run) 레버로 Phase 를 바꿔 계속하는가, 아니면 측정 기록으로 종결 (남은 비용을 4단계 입력으로) 하는가.
2. **선택 Phase 뒤 HC3 미달이고 남은 비용이 패널 React 커밋이면**: 대안 C (패널 갱신을 다음 프레임으로 — 사용자 가시 동작 변경) 를 보조로 넣는가, 측정 기록으로 두는가.
3. **종결에서 HC2 · HC3 미달이면**: 측정 기록으로 종결 (ADR-263 · 264 결정 2 와 같은 형태) vs 남은 비용 자리를 보고 Phase 추가.

## Risks

| ID  | 위험                                                                                                                                                                                                                                   | 심각도 | 대응                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 레버가 결과를 바꾼다 — `collectAffectedIds` 를 좁혀 무효화해야 할 구독 · read 가 빠짐 (C1), `byIndex` read 를 미뤄 Components 목록 · 참조자가 낡음 (C2), Layers 부분 rebuild 가 행을 빠뜨림 (C6), dry-run 메모가 허용 집합을 틀림 (C7) |  HIGH  | G1 동치 — 무작위 편집 ≥ 1,000 (값 · 구조 · 정의 · page · 테마 · 상태 변수) 에서 canonical · history · 저장 대기열 · read model 값 · Layers 행 · 메뉴 허용 집합 · 리스너 record 집합이 수정 전 구현과 같다 · 레버마다 원복 RED |
| R2  | 전제 오류 — 기울기 0 (문서 크기 비례가 아님) 이라 HC2 · HC3 를 이 층에서 못 닫는다                                                                                                                                                     |  MED   | Phase 0 go/no-go · 사용자 결정 1                                                                                                                                                                                              |
| R3  | 측정 — dev 프로필 % 를 production 비용으로 읽음 · 유리 케이스만 (measurement-validity Q1 ~ Q3)                                                                                                                                         |  MED   | 카운트는 dev (등급 A) · wall-clock 은 production 짝 교대 2 쌍만 · 불리 케이스 = 다 펼친 Layers · body 편집 (서브트리 확장 최대) · Components view 열림                                                                        |
| R4  | 카운터가 비결정적 (React 커밋 횟수 · GC 시점에 흔들림)                                                                                                                                                                                 |  MED   | 카운터는 문서 층 함수 안의 순수 카운트만 (훑은 id · 비교 · 재계산 수) — React 측정값은 ratchet B 그대로                                                                                                                       |
| R5  | 죽은 `GraphMetrics` 필드를 배선하면 그것을 0 으로 단언하던 테스트 4 개가 깨진다                                                                                                                                                        |  LOW   | Phase 0 에서 기대값을 실측으로 바꾼다 (테스트가 처음으로 무언가를 검증하게 된다)                                                                                                                                              |
| R6  | 다른 세션 WIP 와의 파일 충돌 (`workspace.ts` 는 grid 작업도 닿는다)                                                                                                                                                                    |  LOW   | `workspace.ts` 변경은 `afterStep` · `findPositionOfRecord` 범위만 · 커밋은 pathspec                                                                                                                                           |

## Gates

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 실패 시 대안                       |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| G0   | Phase 0    | 문서 층 카운터 (`counts.doc.*`) 가 하니스에 실리고 같은 옵션 2 회 같은 값 (등급 A) · 기울기 표 — 편집 1 회 · 선택 1 회의 각 카운트를 600 · 5k (평평 · 중첩) 에서 — 와 발생 빈도 표 (편집 15 회 중 page · project · 정의 · 테마 변경 수) · 죽은 `GraphMetrics` 필드 배선 + 테스트 기대값 실측화 · `--add-keys` A 등록 · 인위 회귀 `block` · 측정 조건 기록. 선택은 **규모와 함께 움직이는 결정적 선택열** (`select-spread` — 앞 · 중간 · 끝 균등; 지금 `select` 부류는 규모 무관 처음 30 개라 형제 선형 `find` 가 465 / 465 로 기울기 0 으로 보인다 — 리뷰 r1 M2) 로 재고, 기울기 0 은 잰 입력 범위 안의 결과로만 해석 · go/no-go: 기울기 > 0 인 후보 ≥ 1 | 사용자 결정 1                      |
| G1   | 레버 Phase | 동치 (HC1): 무작위 편집 · 선택 ≥ 1,000 에서 수정 전 구현 (복사본 oracle) 과 canonical · history · 저장 대기열 · read model 값 · Layers 행 · 액션 바 허용 집합 · canvas · dom 리스너 record 집합이 같다 · 레버마다 원복 RED (ratchet `block`) · 해당 카운트의 5k 값이 600 값과 같은 자릿수 (문서 크기 비례 해소) 또는 상수 비용 ≥ 50 % 감소                                                                                                                                                                                                                                                                                                               | 레버를 좁힌다 (적용 조건을 줄인다) |
| G2   | 종결       | HC2 · HC3: production 짝 (수정 전 commit ↔ 수정, 교대 2 쌍 · 편집은 5 쌍) — 중첩 5k 편집 p99 ≤ 20 · drop < 1 %, 평평 5k select p99 ≤ 20 · drop < 1 %, 평평 5k 편집 · 줌 · drag · 중첩 5k select · 600 유지 · 불리 케이스 (다 펼친 Layers · body 편집 · Components view) 포함 · live exercise (실제 builder 에서 편집 · 선택 전환 · Layers 펼침 · 액션 바 · undo · 테마 변경 · page 추가 · Preview 가 같은 record 를 받음) + ratchet `--update` · 4단계 입력을 §기록에                                                                                                                                                                                    | 사용자 결정 3                      |

### Live Exercise

2026-10-16 · headed 아님 (headless Chromium, Playwright) · dev 5173 · 저장된 인증 세션으로 새 프로젝트 · `apps/builder/scripts/adr265-document-layer-live.mjs` — **11/11 PASS · 콘솔 · 페이지 오류 0**. 문서: body > [목록 frame (Text 300) · 중첩 frame (A > B > Text) · Button], Layers · Design 패널 열림.

- L1 body 배경 편집 → composition root 의 DOM 리스너 (`subscribeDom`) 가 새 배경 record 를 받음 · Layers 행 그대로 · 문서 층 카운터: 행 목록 재계산 0 · children 복제 0 · edge 열거 2 · 무효화 걸음 1 회 · undo · redo 도 리스너에 닿음 (`#fde68a` → 원래 → `#fde68a`).
- L2 Canvas 클릭 경로 (`selectRecords`) 로 목록의 288 번째 Text 선택 → 세션 선택 = 그 노드 · 형제 색인은 선택 1 회 · overlay 페인트 여러 번에 걸쳐 290 행만 읽음. L2b 화면 안 행 (3 번째 Text) 선택 → Layers 의 선택 행 `data-key` = 그 record.
- L3 z-order 단축키 — `[` 맨 뒤로 (index 287 → 0) · undo (287) · `]` 맨 앞으로 (299) · undo. 메뉴의 z-order 판정 (계획 하나로 네 항목) 을 지난 실제 명령.
- L4 중첩 frame 안 깊은 Text 선택 → Layers 가 조상 (A · B) 을 펼쳐 선택 행을 보임.
- L5 page 추가 → `pageFrameRects` 가 두 page 의 사각형 (C12).

관찰 (결함 아님 — 이번 변경 전과 같음): Layers 는 선택 행으로 스크롤하지 않고 (`focusedKey` 를 넘기지 않음), 가상화로 화면 밖 행은 DOM 에 없다. Layers 파일만 HEAD 로 돌려 같은 시나리오로 대조함.

## Consequences

### Positive

- 편집 · 선택 비용이 문서 크기가 아니라 바뀐 것 · 보이는 것의 크기에 비례한다 — 5k 문서에서 한 노드를 편집하거나 고를 때 서브트리 · 정의 목록 · 펼친 행 전체 · 명령 전부를 다시 훑지 않는다.
- 문서 층에 처음으로 결정적 카운터가 생겨 (`counts.doc`) 이 층의 회귀를 pre-push 가 막는다 — 지금은 `v8.fn` 상위 20 으로만 보인다. 죽은 `GraphMetrics` 필드와 그것을 0 으로 단언하던 테스트가 실제 값을 검증하게 된다.
- 4단계 Rust 판정 입력이 깨끗해진다 — JS 분기 · 복제 비용이 빠진 뒤의 프로필.

### Negative

- 카운터가 문서 층 함수 안에 들어간다 (dev 전용 분기) — ADR-263 `renderCounters.ts` 와 같은 형태라 production 코드 경로는 카운터 증가 하나뿐이지만, 함수마다 한 줄씩 늘어난다.
- 레버가 「언제 전부 훑어야 하는가」 조건을 명시하게 되므로 (C1 의 변경 종류 · C2 의 정의 · 참조 변경 · C6 의 펼침 차이), 새 명령 · 새 read 종류를 더할 때 그 조건을 같이 고쳐야 한다 — 동치 테스트가 계약.
- 하니스 recorder 해시가 바뀐다 (`counts.doc` 필드 — `--accept-recorder`).
