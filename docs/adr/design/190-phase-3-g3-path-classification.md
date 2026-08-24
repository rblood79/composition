# ADR-190 Phase 3 / G3 — 잔여 경로 분류와 대량 mutation 판정

> 본문: [../completed/190-commit-descriptor-emitter-expansion.md](../completed/190-commit-descriptor-emitter-expansion.md) ·
> Phase 0: [190-phase-0-emitter-inventory.md](190-phase-0-emitter-inventory.md) ·
> Phase 1: [190-phase-1-g1-style-emitter.md](190-phase-1-g1-style-emitter.md) ·
> Phase 2: [190-phase-2-g2-structure-emitter.md](190-phase-2-g2-structure-emitter.md)

## 판정

**G3 통과 — Phase 3 완료 (2026-08-24)**

잔여 canonical mutation 경로를 전수 분류했고, R4 (대량 mutation 에서 sparse 역전)
는 **임계 상수를 도입하지 않는 것**으로 판정했다. 측정 결과 역전이 일어나기
전에 이미 소비자가 fail-closed 하기 때문이다.

## 1. R4 판정 — 임계는 필요 없다. 경계는 dirty root 개수 1이다

임계값을 찍기 전에 실제 역전 지점을 쟀다 (2,000-node 문서,
`adr190-bulk-threshold-probe.mjs`). sparse 경로와 full rebuild 경로를 같은 batch
크기에서 번갈아 측정했다.

| batch 크기 | sparse p95 | full p95 | patch 성공 | 판정                      |
| ---------: | ---------: | -------: | ---------: | ------------------------- |
|      **1** |  **1.2ms** |   22.6ms |        4/4 | **18.8배**                |
|          2 |     32.6ms |   32.3ms |    **0/4** | 이득 없음 (전량 fallback) |
|         25 |     31.3ms |   30.3ms |        0/4 | 이득 없음                 |
|        400 |     31.4ms |   29.3ms |        0/4 | 이득 없음                 |

경계는 batch 크기가 아니라 **dirty root 개수**다. style patch 의 dirty root 는
대상 요소 자신이므로 N개 요소 편집은 N개 dirty root 가 되고,
`StoreRenderBridge.applyPendingCommitPatch` 가 한 commit 에 dirty root 가 둘
이상이면 splice 를 포기하고 있었다. 즉 **2개부터 이미 full rebuild** 였고, 역전이
일어날 만큼 큰 batch 는 애초에 sparse 경로를 타지 않았다.

따라서 "임계 초과 시 full rebuild 로 조기 판정" 하는 로직은 도달 불가 코드였다.
대신 **무익한 시도 자체를 막았다** — 다중 항목은 emit 하지 않는 가드. 적용 전후:

| batch 크기 | 가드 전 queue/fallback | 가드 후 queue/fallback |
| ---------: | ---------------------: | ---------------------: |
|          2 |                  4 / 4 |              **0 / 0** |
|         25 |                  4 / 4 |              **0 / 0** |
|        400 |                  4 / 4 |              **0 / 0** |

가드 전에는 "plan 계산 + 첫 splice 시도 + 폐기" 비용이 매 commit 에 실렸다
(2~6% 손해). 가드 후에는 그 비용이 사라지고 결과는 종전과 같았다.

### 2026-08-24 정정 — 다중 root 포기는 설계가 아니라 결함이었다

위 판정의 전제 ("patcher 가 다중 dirty root 를 지원하지 않는다") 가 틀렸다.
ADR-189 는 다중 root 를 **설계에 넣고 코드도 그렇게 썼다** —
`dirtyRootIds: readonly string[]`, `plans: readonly CommitPatchPlan[]`,
조상-자손 중복 제거(`collapseDescendantRoots`), 중첩 루프까지 전부 복수 전제다.

실제 원인은 revision 부기였다. `applyPendingCommitPatch` 가 commit 하나에
`patchRevision` **하나**를 계산해 모든 root 에 그대로 넘겼는데, 첫 root 가
성공하면 `subtreeCommandPatch.ts:656` 이 그 값을 `presentationRevisionByRootKey`
에 기록한다. 같은 rootKey(=`page:{id}`, 즉 같은 페이지)를 쓰는 둘째 root 는
`:483` 의 `revision <= currentRootRevision` 에 걸려 `stale-revision` 으로 자기
자신을 stale 판정했다 — commit 전체가 full rebuild 로 떨어진 이유.

발현 조건이 ADR-190 이전에는 없었다. 유일한 생산자였던 presentation lane 은
`queueCommitPatch([descriptor], revision)` 로 항상 원소 1개 배열만 보냈고,
자기 쪽 patch 는 `plan.roots.length !== 1` 로 fail-closed 하면서 patch 마다
revision 을 `+1` 한다 (`skiaEditorPresentationLayoutBridge.ts:393,465`). 즉 두
설계가 만나는 지점의 결함이고, 다중 root commit 을 만들 주체가 없어 도달 불가
상태로 남아 있었다.

수정: splice 하나가 곧 publication 하나이므로 루프 안에서 revision 을 전진시킨다
(presentation lane 과 같은 규약). 생산자 가드 `entries.length !== 1` 은 제거했다.
2,000-node 문서 재실측:

| batch 크기 | sparse p95 | full p95 | patch 성공 |       판정 |
| ---------: | ---------: | -------: | ---------: | ---------: |
|          1 |      1.6ms |   35.0ms |        4/4 |     21.9배 |
|          2 |      1.0ms |   32.8ms |    **4/4** | **32.8배** |
|          5 |      0.8ms |   31.5ms |        4/4 |     39.4배 |
|         25 |      1.5ms |   31.4ms |        4/4 |     20.9배 |
|        100 |      2.3ms |   30.5ms |        4/4 |     13.3배 |
|        400 |      3.1ms |   30.7ms |        4/4 |      9.9배 |
|      1,000 |      8.2ms |   33.5ms |        4/4 |      4.1배 |
|      2,000 |     25.1ms |   31.5ms |        4/4 |     1.25배 |

**R4 는 임계 불요로 재확인된다 — 이번엔 도달 가능한 상태에서.** 문서의 모든
요소를 한 번에 바꿔도(2,000/2,000) sparse 가 여전히 빠르다. 이득은 단조 감소하되
역전하지 않으므로 임계 상수를 둘 근거가 없다.

픽셀 검증 (`adr190-multiroot-pixel-oracle.mjs`): 한 commit 이 4개 root 를 splice
(`subtreeBuild 4` / `patchSuccess 1` / `fallback 0` / `fullBuild 0`) 한 결과와
reload full rebuild 결과의 차이는 `1440 × 852` 에서 **0 픽셀**.

## 2. 경로 전수 분류

Phase 0 inventory 의 action 을 실제 배선 결과로 재분류했다.

### sparse lane 진입 (emit)

| 경로                               | 축        | 비고                                                      |
| ---------------------------------- | --------- | --------------------------------------------------------- |
| `updateElementProps`               | style     | 패널 / 캔버스 텍스트 / **AI tool** / preview ingress 포함 |
| `batchUpdateElementProps`          | style     | 항목 수 무관 (§1 정정 — 다중 root 지원)                   |
| `addElement`                       | structure | AI tool `createElement` 포함                              |
| `addComplexElement`                | structure | 부모+자식을 한 배열로 전달                                |
| `removeElement` / `removeElements` | structure | AI tool `deleteElement` 포함. autoDetach 동반 시 제외     |
| `reorderElementWithinParent`       | structure | 키보드 화살표 / 컨텍스트 메뉴                             |
| `moveElementToSiblingEdge`         | structure | `[` `]` / ⌘[ ⌘] / 컨텍스트 메뉴                           |

### 의도적 full rebuild (emit 하지 않음)

| 경로                                                                                         | 사유                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateElement`                                                                              | canonical sync 가 `set` 콜백 **안**에 있어 emit 계약 지점(canonical 뒤·set 앞)이 없다. `parent_id`/`page_id`/`responsive` 등 구조 필드도 실려 style.patch 로 서술 불가 |
| `undo` / `redo` / `goToHistoryIndex`                                                         | `setElementsCanonicalPrimary` 로 문서를 통째 교체 (`historyActions.ts:105`) — 요소 단위 mutation 이 아니다                                                             |
| 캔버스 드래그의 reparent (`moveElementToCanonicalTarget`)                                    | 출발지·도착지 양쪽 dirty (`useDragBridge.ts:910,969`). 같은 드래그의 좌표 갱신은 `batchUpdateElementProps` 경유라 §1 규칙을 따른다                                     |
| `moveElementToContainer`                                                                     | reparent. 남은 호출자는 레이어 트리 1곳                                                                                                                                |
| `createInstance` / `detachInstance` / `toggleComponentOrigin` / `resetInstanceOverrideField` | `applyElementSnapshotBatch` 로 N+1 요소를 한 번에 교체 — 다중 root (§1 경계 밖). `createInstance` 는 호출자 0건                                                        |
| `batchUpdateElements`                                                                        | 호출자 0건 (dead action)                                                                                                                                               |
| page-level (`appendPageShell` / `removePageLocal` / `updatePagePosition*`)                   | element subtree 범위 밖                                                                                                                                                |

**AI tool 은 별도 배선이 필요 없었다** — `createElement`/`updateElement`/
`deleteElement` 세 tool 이 각각 `addElement`/`updateElementProps`/`removeElement`
를 호출하므로 Phase 1·2 배선으로 자동 커버된다 (Phase 0 §A).

## 3. 거부 계측 추가

descriptor 거부는 정상 동작(fail-closed)이지만 **조용히** 늘어나면 성능이 서서히
옛 경로로 되돌아간다. 특히 effect registry 에 등재하지 않은 style 키를 새로
도입하면 그 요소는 영구히 lane 밖에 남는데, 화면에는 아무 증상이 없다.

`rejectedStyle` / `rejectedStructure` 카운터를 축별로 세어 진단 표면
(`__composition_STORE_COMMIT_SINK_DEBUG__`, `?adr189Metrics=1` 게이트) 에
노출한다.

## 4. 검증

재현:

```bash
node apps/builder/scripts/adr190-bulk-threshold-probe.mjs
node apps/builder/scripts/adr190-generic-commit-probe.mjs --repeats 8
node apps/builder/scripts/adr190-structure-probe.mjs
node apps/builder/scripts/adr190-pixel-oracle.mjs
node apps/builder/scripts/adr190-multiroot-pixel-oracle.mjs
```

- `pnpm type-check`: PASS (신규 위반 0)
- Builder Vitest `presentation` + `stores` + `skia`: **1,018 passed** / 4 skipped.
  실패 1건은 `buildSpecNodeData.test.ts` 의 mesh gradient 로 clean `main` 에서도
  재현되는 기존 실패 (Phase 1 에서 stash 후 확인)
- 신규 테스트 6건 (배치 계약)
- **G1 회귀 없음**: N=50/500/5,000 queue·patchSuccess 8/8, full build 0,
  N=5,000 `render.frame` p95 3.1ms
- **G2 회귀 없음**: deep add/remove p95 1.8ms / 1.1ms, 렌더 정합성 12/12
- **pixel oracle**: `1440 × 852` differing pixels 0, max/mean delta 0
- console error 0 (전 probe)

## 5. 잔존

| 항목                                                  | 성격                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| commit patcher 의 다중 dirty root                     | **2026-08-24 해소** (§1 정정 — revision 부기 결함 수정)                |
| `updateElement` 의 canonical sync 위치                | `set` 콜백 밖으로 빼면 emit 계약 지점이 생긴다 — 별도 리팩터링         |
| instance snapshot batch (`applyElementSnapshotBatch`) | 다중 root 가 열렸으므로 재검토 가능 — `applyElementSnapshotBatch` 배선 |
| 다중 선택 드래그의 UI 제스처 검증                     | 브라우저 자동화로 드래그 세션을 시작하지 못했다 (수동 1회 확인 남음)   |
