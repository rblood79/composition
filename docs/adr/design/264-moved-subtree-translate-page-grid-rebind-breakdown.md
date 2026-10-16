# ADR-264 design breakdown — 이동만 한 서브트리의 patch 축소 · 줌 page grid 재바인드 제거

> 본문: [../264-moved-subtree-translate-page-grid-rebind.md](../264-moved-subtree-translate-page-grid-rebind.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 와 `.agent/runs/` 는 로컬 전용이라 실측 결론은 여기 §기록에 둔다.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: 기존 ADR 의 분리가 아니다. ADR-189 (subtree splice · damage) 와 ADR-263 (patch 검증 한 번 · damage 재연결 · viewport 실행) 이 base 이고, 이 ADR 은 그 스트림에 「옮기기」 갱신 한 종류를 더하는 응용이다. ADR-263 의 G5 미달 두 자리를 사용자 결정 2 로 측정 기록 종결한 뒤 사용자 원문 (「남은 두 꼬리 … 먼저」) 으로 새로 연 것이라 fork 가 아니다.
2. **schema**: 문서 · 저장 schema 변경 0. `RenderCommandStream` 의 명령 종류 · 맵도 늘지 않는다 — 기존 `ELEMENT_BEGIN` 의 x · y 와 기존 맵의 값만 갱신한다. `CatalogCanvasUpdate` 에 옮긴 root 목록이 붙는다 (하니스 · 테스트용).
3. **선행 전제 reverse 검증**: ADR-189 의 「명령은 부모 기준 좌표 · 맵은 절대 좌표 · damage = 이전 ∪ 이후 hit bounds · hit bounds 밖 paint 는 full」 을 그대로 쓴다. ADR-263 Phase 3 의 `unsafePaint` 전 · 후 규칙과 Phase 5 의 「남는 요소 picture 유지」 도 그대로다 — 의존 방향 반전 없음. `setAutoColumns` 의 주석 (「page frame 이 옮겨지고 내용은 레이아웃을 유지」) 이 줌 경로의 전제이고, Phase 0 이 rect 비교로 확인한다.
4. **판독**: 사용자가 요청할 때 `/review-adr 264`. 판독은 phase 당 1 + 수리 검증 1.

## 1. Phase 0 — 두 꼬리의 카운트 (G0)

목적: 「자리만 옮긴 서브트리」 가 patch 비용의 얼마인지, 줌 재바인드가 몇 번인지, 옮기기의 최소 비용 (자손 수 · 인덱스 upsert) 이 얼마인지를 카운트로 고정한다. 가설로 대상 코드를 정하지 않는다.

- **편집 분해** (`canvasBinding.ts` `update()` — dev 카운터, `renderCounters.ts` 에 필드 추가):
  - `patchRegionCommands`: patch root 서브트리 span 길이 합 (지금 = patch 교체 명령 수와 같다).
  - `patchMovedOnlyCommands` · `patchMovedOnlyNodes`: region 안 형제 중 「rect 의 x · y 만 바뀌고 width · height 불변 · 엔진 입력 (`boundLayoutInputs`) 불변 · 자손 rect 비교 0 변화」 인 서브트리의 span 길이 · 노드 수 합. 분류만 세고 동작은 바꾸지 않는다.
  - `patchSeedCommands`: seed 자신의 서브트리 span 길이 (옮기기 뒤 남을 patch 의 크기).
  - 시나리오: 중첩 5k 편집 (`--classes edit`) · 중첩 600 (결정성 2 회) · 평평 5k 편집 (region 이 3 명령인 이유 — 비교 대조군).
- **줌 분해** (`canvasScene.ts` `rebind` 사유별 카운트 `rebindPageGrid` · `rebindOther`, `CatalogCanvas.tsx` `syncAutoColumns` 호출 중 `setAutoColumns` true 수):
  - 평평 5k 줌 (`--classes zoom`) 의 content 프레임 수 대비 `page-grid` 재바인드 수. 재바인드 1회의 bind 비용 (dev 라벨 `bindInColorMode` 시간은 방향만).
  - page frame rect 전 · 후 비교: `setAutoColumns` 가 true 인 모든 경우에 width · height 가 불변인가 (R4) — 하니스에서 before/after `pageFrameRects()` 를 기록.
  - 중첩 5k 줌에 재바인드가 없는 이유 (page 1 개 · `columns` 고정?) 를 fixture 에서 확인해 §기록에.
- **옮기기 최소 비용**: `patchMovedOnlyNodes` 가 곧 좌표 산술 횟수 · SpatialIndex upsert 횟수의 하한이다. 평평 5k 줌에서는 page root 자손 수 = 5,000 (page 당). Phase 1 뒤 실제 카운트 `translateCalls` · `translateNodes` · `translateIndexUpserts` 를 같은 자리에 둔다.
- **결정성 · ratchet**: 같은 옵션 2 회 같은 값 (등급 A). `perf-ratchet-gate.mjs --add-keys <seed>=<a>,<b> --keys render.patchMovedOnly*,render.rebindPageGrid --accept-recorder` 로 A 등록 (recorder 해시가 바뀐다). 등록한 키를 인위 회귀시킨 보고로 `decide` = `block` 확인.
- 측정 조건 기록: dev 5173 · headless Chromium · `--fixed-inputs` · fixture 종류 (`nested-flex` / 기본) · seed 수.

### Phase 0 결과

(실행 시 기록)

## 2. Phase 1 — 옮기기 기계 `translateSubtree` (G1)

- 위치: `apps/builder/src/builder/workspace/canvas/skia/subtreeTranslate.ts` (새 파일 — `subtreeCommandPatch.ts` 의 `collectCompleteSubtreeIds` · `createCommandReader` 를 재사용).
- 입력: `stream` · `rootId` · `dx` · `dy` (부모 기준 Δ — 절대 Δ 와 같다, 조상이 움직이지 않았으므로) · `revision`.
- 하는 일 (순서):
  1. **제외 판정** → `{ applied: false, reason }`: `subtreeBuildContextByElement` 없음 (`subtree-context`) · 서브트리 안 `damageUnsafeElementIds` (`unsafe-paint`) · `topLayerElementIds` (`top-layer`) · `isFixed` / sticky 가 있는 요소 (`fixed-or-sticky`) · drag offset 활성 (`getDragSiblingOffsetRevision` — `drag-offset`) · root 의 span 이 piece-table 에서 연속이 아님 (`span-not-contiguous`) · 넓이 0 상자 (이미 unsafe 로 잡힌다).
  2. root 의 `ELEMENT_BEGIN` x · y 를 +Δ (명령 객체 하나 교체 — 버퍼 splice 없이 그 index 에 쓰기 — `createSegmentedCommandBuffer` 의 쓰기 경로 확인).
  3. **clip 을 바깥에서 다시 전파하는 위에서 아래로 한 번 순회** (review r1 H1 · M3): root 의 span 을 `createCommandReader` 로 읽으며 `ELEMENT_BEGIN` · `CHILDREN_BEGIN` · `CHILDREN_END` 로 clip 스택을 든다. 스택의 바닥은 root 의 **불변 바깥 clip** (`subtreeBuildContextByElement.get(root).clipRect` — root 자신의 build context 는 부모 문맥이라 **건드리지 않는다**: `parentAbsX/Y` · `clipRect` 그대로). 요소마다 — `boundsMap` = 이전 bounds +Δ · `clipContextByElement` = 스택 top (복제) · `hitBoundsMap` = 새 bounds ∩ 스택 top (`intersectBoxes` 단일 수식, canvas-interaction.md §8.5 — 빈 교차는 미등재). **root 의 자손** 에만 `subtreeBuildContextByElement` 를 `{ parentAbsX/Y: 이전 값 +Δ, clipRect: 스택 top }` 으로 다시 쓴다. clipping 요소의 `CHILDREN_BEGIN` 에서는 저장돼 있던 교차 결과를 옮기지 않고 **그 요소의 원래 clip 치수로 다시 교차한다** — `childClipRect` 와 같은 식 (`renderCommands.ts` 1681: `(absX + inset, absY + inset, clipWidth − 2·inset, clipHeight − 2·inset)` ∩ 스택 top, `CHILDREN_BEGIN` 이 `width` · `height` · `clipBorderInset` 을 들고 있다) 을 push, `CHILDREN_END` 에서 pop. `EMPTY_CLIP` ↔ 부분 가시 전환이 이 재교차에서 자연히 처리된다 (바깥 clip 에 잘렸던 안쪽 clip 이 이동으로 드러나는 경우 — 리뷰 반례 높이 10 → 30). scroll offset: 자손 bounds 는 이미 scroll 을 뺀 절대값이라 +Δ 로 보존되고, clip 원점은 scroll 미반영 (기존 계약).
  4. SpatialIndex upsert (hit bounds 가 있는 요소만 — `spatial_index.rs` 가 넓이 0 을 빼는 규칙 그대로) · 없어진 hit bounds 는 remove.
  5. damage = **서브트리 모든 요소** 의 이전 ∪ 이후 hit bounds 합집합 (review r1 H2 — `overflow: visible` 자식은 root 상자 밖에 있을 수 있고 unsafe 집합은 그것을 보지 않는다; 지금 `subtreeCommandPatch.ts` 의 `getSubtreeDamageBounds` 와 같은 규칙, 3 의 순회에서 같이 모은다). hit bounds 밖 paint 는 1 의 unsafe 제외가 막는다.
  6. 결과: `{ applied: true, damageBounds, nodes, indexUpserts }` · 카운터 `translateCalls` · `translateNodes` · `translateIndexUpserts`.
- node picture: 건드리지 않는다 (키가 node data · w · h — 위치와 무관, ADR-263 Phase 5).
- `selfSpans` · `subtreeSpans` · `childrenSpans`: 명령 수가 안 바뀌므로 그대로.
- 스크롤 범위 (ADR-263 Phase 4): 호출자 (`canvasBinding.ts`) 가 옮긴 root 를 `changedRects` 에 두므로 기존 `catalogSubtreeScrollExtent` 전 · 후 갱신이 그대로 돈다 — 서브트리 읽기 1 회 (카운트 `scrollSubtreeVisits`).
- **G1 테스트** (`subtreeTranslate.test.ts`): 무작위 트리 (≥ 1,000 — 깊이 1 ~ 6 · 중첩 overflow clip · scroll offset · 숨김 · 넓이 0 · 글자 넘침) 에서 `translateSubtree` 뒤의 명령 열 · 다섯 맵 · SpatialIndex 등록 (mock, `viewportExecution.test.ts` 의 대역) 이 같은 layout 으로 `buildRenderCommandStream` 한 결과와 같다. 제외 조건 7 종 반례 각각 `applied: false`. `executeRenderCommands` 의 이벤트 열이 재구축과 같다. **리뷰 r1 반례 3 건을 이름 붙인 케이스로**: (H1) 옮긴 뒤 **같은 root 를 편집** → `buildSubtreeCommandStream` 이 저장된 context 로 만든 bounds.y 가 전체 재구축과 같다 (30, 50 이 아님) · (H2) `overflow: visible` root (높이 30, y 10 → 30) 안 local y 60 자식 — damage 가 y 10..110 을 덮는다 · (M3) 바깥 clip y 0..100 · 안 clipping root y 90..120 을 −20 옮김 → 자식 clip 높이 10 → 30, hit 높이 20. 원복 RED: 3 단계를 「저장된 교차 결과 +Δ」 · 「root context 도 +Δ」 · 「root-only damage」 로 각각 되돌리면 그 케이스가 RED.

## 3. Phase 2 — 편집 경로: 자리만 옮긴 형제를 region 에서 뺀다 (G2)

- `canvasBinding.ts` `geometryRegion`: 형제 비교에서 rect 가 바뀐 형제를 둘로 가른다 —
  - **옮기기 후보**: `width` · `height` 불변 · `boundLayoutInputs.get(id) === root.getAppliedLayoutInput(id)` · 자손 rect 비교 (`descend` 의 비교를 후보에도 — 변화 0) · `sizeChanged` 아님. region root 를 올리지 않고 `translated` 목록에 `{ id, dx, dy }`.
  - 그 외 (크기 변경 · 엔진 입력 변경 · 자손 변화): 지금처럼 `regionRoot = parentId`.
  - 부모 rect 가 바뀌면 (`parentChanged`) 지금처럼 부모가 root — 옮기기 안 함 (부모 재기록이 형제를 덮는다).
- patch 뒤 옮기기: seed region 의 `applyCommitSubtreeCommandPatch` 가 끝난 다음 `translated` 를 `translateSubtree` 로 — `applied: false` 면 그 형제를 patch root 로 추가 (지금 동작으로 후퇴, 사유 카운트 `translateFallbacks`). damage 합집합에 옮기기 damage 포함. `CatalogCanvasUpdate` 에 `translated: string[]`.
- 자손 비교 비용: 후보의 자손 rect 비교는 `root.getGeometry` 조회 (`geometryQueries` 카운트) — 중첩 5k 에서 region 노드 수만큼이다. Phase 0 의 `patchMovedOnlyNodes` 가 상한. 비교 없이 「엔진 입력 불변 + 크기 불변 ⇒ 자손 불변」 으로 줄일 수 있는지는 엔진 계약 (`block.rs` · `flex.rs` 의 지역 rect) 을 §기록에 적고 테스트 반례가 없을 때만.
- **G2**: 중첩 5k 편집 1회 `patchWrites` 11,925 → seed 서브트리 크기 수준 (ratchet A 하향 — 목표 1/5 이하) · `translateCalls` > 0 · 옮긴 형제 picture miss 0 · 원복 RED (분류를 끄면 `block`) · live: `adr264-subtree-translate-live.mjs` — 중첩 문서에서 위 형제 높이 편집 → 아래 형제 픽셀 0 차 (전체 재바인드 대조, dev 전역 `__composition_RENDER_PATH_DEBUG__.setTranslateOff`) · 옮긴 형제 클릭 → 선택 상자 일치 · hover 아웃라인 일치.

## 4. Phase 3 — 줌 · page grid 편집 경로: page root 옮기기 (G3)

- `compositionRoot.ts` `setAutoColumns`: 반환을 boolean 에서 `{ moved: Array<{ id, dx, dy }>, resized: boolean } | null` 로 (호출자 1 곳 — `workspace.ts` 경유). width · height 가 바뀐 page 가 있으면 `resized: true`.
- `canvasScene.ts`: `refresh()` 대신 `movePageRoots(moved)` — `binding.translateRoots(moved)` 가 root 마다 `translateSubtree` (`pageShell` 이 있으면 shell 의 자식으로 — shell 자체는 재등록). 하나라도 `applied: false` 거나 `resized` 거나 root 집합이 바뀌면 `rebind("page-grid")`. 반환 `{ kind: "patched", update }` (damage 없음 → full 무효화 — viewport 실행이라 싸다).
- `CatalogCanvas.tsx`: `syncAutoColumns` 와 `syncScene` 의 page grid 편집 분기 (767 ~ 774) 가 같은 `movePageRoots` 를 쓴다. `publishHeaders()` 는 그대로 (page frame rect 가 바뀌므로 헤더 재배치).
- page frame 의 배경은 page body record 의 명령 (root 서브트리 안) 이고, 프레임 타이틀은 overlay (`skia/selectionRenderer.ts` `renderPageTitle` — `boundsMap` · page frame rect 를 읽는다) 라 스트림 밖이다. 옮긴 뒤 overlay 가 새 `boundsMap` 을 읽는지 G3 live 로 확인.
- **G3**: 평평 5k 줌 `rebindPageGrid` 0 (A 상한 0) · `translateCalls` = 열 수 변경 횟수 × page 수 · 픽셀 0 차 (줌 0.5 · 1 · 2 — 열 수가 바뀌는 구간을 하니스가 고른다) · page header 위치 = 재바인드 때와 같음 · page grid 편집 (gap · columns 값) 도 재바인드 0 · 원복 RED.

## 5. 종결 (G4)

- production 짝 측정 (`.cache/perf-ratchet/wt` 를 수정 전 commit 으로 `prepareWorktree`, `perf:build-dist` · `--serve-dist` · 교대 2 쌍): 중첩 5k 편집 · 줌, 평평 5k 줌 · 편집 · drag. 불리 케이스: clip 경계를 지나는 형제 이동 (scroll 상자 안 항목 편집) · 1만 노드 평평 줌.
- live exercise: 실제 builder (dev 서버 + 저장된 인증 세션 `/dashboard`) 에서 편집 · 줌 · page grid 편집 · 옮긴 요소 선택 · hover · 스크롤 → 잔상 0 · 선택 상자 일치. `/cross-check` (Canvas = Preview).
- ratchet `--update` 를 수정과 같은 커밋에. 문서: ADR 본문 Status · Live Exercise, README, CHANGELOG (성능 회귀 수정 트리거).
- 4단계 입력: 종결 뒤 남은 프로필 상위 (그리기 명령 시간 · 경계 호출 비율 · SpatialIndex upsert 비용) 을 §기록에.
- 후보 (범위 밖, 기록만): drag 의 형제 비킴 · 놓기 (ADR-263 Phase 0 — drag 프레임마다 patch) 를 옮기기로.

## 파일 변경표

| Phase | 파일                                                                                                        | 변경                                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 0     | `workspace/canvas/skia/renderCounters.ts`                                                                   | 필드 추가 (`patchRegionCommands` · `patchMovedOnly*` · `patchSeedCommands` · `rebindPageGrid` · `translate*`) |
| 0     | `catalogRuntime/canvasBinding.ts` · `canvasScene.ts`                                                        | 분류 · 사유 카운트 (동작 무변경)                                                                              |
| 0     | `apps/builder/scripts/perf-baseline.mjs` · `perf/ratchet.json`                                              | `counts.render` 새 키 · `--add-keys` A 등록 (`--accept-recorder`)                                             |
| 1     | `workspace/canvas/skia/subtreeTranslate.ts` (+ `.test.ts`)                                                  | 옮기기 기계 · 동치 테스트                                                                                     |
| 2     | `catalogRuntime/canvasBinding.ts`                                                                           | `geometryRegion` 분류 · patch 뒤 옮기기 · `CatalogCanvasUpdate.translated`                                    |
| 2     | `apps/builder/scripts/adr264-subtree-translate-live.mjs` · `renderCounters.ts` (`renderDebug.translateOff`) | live oracle                                                                                                   |
| 3     | `packages/shared/src/catalog/runtime/compositionRoot.ts` · `catalogRuntime/workspace.ts`                    | `setAutoColumns` 반환 확장                                                                                    |
| 3     | `catalogRuntime/canvasScene.ts` · `canvasBinding.ts` · `workspace/canvas/catalog/CatalogCanvas.tsx`         | `movePageRoots` · `translateRoots`                                                                            |
| 4     | ADR 본문 · README · CHANGELOG · `perf/ratchet.json`                                                         | 종결                                                                                                          |

## 기록

(실행 시 기록)
