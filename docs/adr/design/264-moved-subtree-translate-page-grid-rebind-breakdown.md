# ADR-264 design breakdown — 이동만 한 서브트리의 patch 축소 · 줌 page grid 재바인드 제거

> 본문: [../264-moved-subtree-translate-page-grid-rebind.md](../completed/264-moved-subtree-translate-page-grid-rebind.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 와 `.agent/runs/` 는 로컬 전용이라 실측 결론은 여기 §기록에 둔다.

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

측정 조건: dev 5173 · headless Chromium · `--lane frame --fixed-inputs` · 편집 15 회 (`edit` — seedIds[1] 의 폭 160 ~ 176) · 줌 = 하니스 `zoom` 부류. fixture: 중첩 = `--fixture-kind nested-flex` (root flex column > section row wrap 10 카드 > card 20 노드), 평평 = 기본 `mixed`. 같은 옵션 2 회 같은 값 (등급 A — 중첩 600 · 평평 600).

**편집 — patch 교체 명령 (`patchWrites`) 의 분해** (다섯 몫의 합 = `patchWrites`):

| 시나리오      | patchWrites |  seed | 경로 자기 명령 | 자리만 옮김 (노드) | 그중 부모 크기도 바뀜 | rect 그대로인 형제 | 자손 rect 가 바뀐 후보 |
| ------------- | ----------: | ----: | -------------: | -----------------: | --------------------: | -----------------: | ---------------------: |
| 중첩 5k 편집  |     178,875 | 1,155 |            276 |   172,266 (44,736) |               171,342 |              5,178 |                      0 |
| 중첩 600      |      25,623 | 1,155 |            276 |     19,014 (4,938) |                18,090 |              5,178 |                      0 |
| 평평 600 · 5k |          45 |    45 |              0 |                  0 |                     0 |                  0 |                      0 |

- 중첩 5k 의 교체 명령 96.3 % 가 자리만 옮긴 서브트리이고, **그 99.5 % 는 부모 상자의 크기도 바뀐 자리** 다 — 카드 폭 → 카드 높이 → section (row wrap) 높이 → root (column) 높이가 연쇄로 바뀌고, 그 경로의 뒤 형제 (같은 section 의 뒤 카드 · 뒤 section) 가 옮겨진다. 부모가 그대로인 층의 옮김은 924 (0.5 %) 뿐이다.
- **설계 보강 (추정 vs 실측 gap — adr-writing M3, Phase 0 inventory 로 흡수)**: §3 초안의 「부모 rect 가 바뀌면 지금처럼 부모가 root — 옮기기 안 함」 으로는 G2 가 닫히지 않는다 (0.5 % 만 덜어 낸다). 대안 A 안에서 두 가지를 넓힌다 —
  1. **경로 노드의 자기 patch**: region root 에서 위 → 아래로 내려가며, 크기가 바뀐 조상 (경로 노드) 은 서브트리가 아니라 **자기 명령** (`ELEMENT_BEGIN` ~ `CHILDREN_BEGIN`, `CHILDREN_END` · `ELEMENT_END`) 만 다시 기록한다. 자기 명령 수가 그대로일 때만 제자리 쓰기 (span 이동 없음), 수가 바뀌면 그 노드에서 지금의 서브트리 patch 로 후퇴 (`pathSelfFallbacks`). 경로 노드의 자식 중 seed 는 서브트리 patch, 자리만 옮긴 것은 옮기기, rect 그대로인 것은 둔다.
  2. **옮기기의 root 문맥 = 부모가 넘기는 문맥**: `translateSubtree` 는 root 의 build context 를 인자로 받는다 — 부모가 그대로면 저장된 문맥 그대로 (리뷰 r1 H1 의 「root 문맥 보존」 은 이 경우), 부모가 크기 · 위치를 바꿨으면 부모 자기 patch 가 계산한 새 `parentAbsX/Y` · 자식 clip. 부모가 clip 하고 크기가 바뀐 경우 rect 그대로인 자식도 Δ = 0 · 새 바깥 clip 으로 같은 기계를 돈다 (hit bounds 재교차). 명령 Δ (지역 x · y — root 의 `ELEMENT_BEGIN`) 와 맵 Δ (절대 — 부모 이동 포함) 를 나눈다.
  - 잔존 patch 추정: seed + 경로 = 중첩 5k 편집 1회 ~95 명령 (지금 11,925), 옮기기 ~2,982 노드 (좌표 · clip 재교차 · SpatialIndex upsert).
- R3 (분류 오판): 「x · y 만 다름 · 크기 · 엔진 입력 · 부품 입력 불변」 후보의 자손 rect 를 엔진에서 다시 읽어 비교한 결과 바뀐 것 0 (중첩 600 · 5k). Phase 2 는 같은 비교를 dev 카운트로 남기고, 동작 판정은 엔진 계약 (지역 rect = 자기 크기 · 입력 · 자손 입력의 함수) 에 기댄다.

**줌 — page grid 재바인드**:

| 시나리오    | content 프레임 | `page-grid` 재바인드 | 크기가 바뀐 재바인드 (R4) | 위치가 바뀐 page root |
| ----------- | -------------: | -------------------: | ------------------------: | --------------------: |
| 평평 600 줌 |             43 |                   14 |                         0 |                    14 |
| 평평 5k 줌  |             43 |                   14 |                         0 |                    14 |
| 중첩 5k 줌  |             49 |                    0 |                         0 |                     0 |

- 평평 줌: 열 수가 바뀔 때마다 재바인드 (14 / 43 프레임), 매번 page 2 개 중 하나만 자리를 옮기고 크기는 그대로 — R4 전제 (자동 열 수 변경 = page root 평행이동) 가 측정으로 성립. 옮기기 최소 비용 = 재바인드 1 회당 page 하나의 자손 수 (평평 5k = 5,000).
- 중첩 5k 줌에는 page grid 재바인드가 없다 (열 수가 그 줌 구간에서 바뀌지 않음 — 카운트로 확인, 원인은 측정하지 않았다).
- **Phase 3 배선 단순화**: page root 이동은 scene 이 바인딩의 page root rect 와 엔진 rect 를 비교해 판정한다 — `setAutoColumns` 의 반환 확장 · shared 변경 없이. (실행 때 정정: `refresh()` 는 drag 시작 · 끝도 쓰고 있어 새 메서드 `pageGridChanged()` 를 두고 `CatalogCanvas.tsx` 의 page grid 두 자리만 그것으로 바꿨다 — Phase 3 기록.)

**카운트 · ratchet** (`renderCounters.ts`): `patchSeedCommands` · `patchPathCommands` · `patchMovedOnlyCommands` · `patchMovedOnlyNodes` · `patchMovedUnderResizedCommands` · `patchUnchangedCommands` · `patchMovedDescendantChanged` (`canvasBinding.ts` `countPatchRegions` — 교체 명령을 한 번 훑어 요소별 서브트리 길이를 센다; span 맵 읽기는 cursor 해석 호출을 늘려 seed 60 drag 의 `commandCursorIndex` A 상한을 넘겼다) · `rebindPageGrid` · `rebindOther` · `pageGridResized` · `pageGridMovedRoots` (`canvasScene.ts` rebind). `patchRegionCommands` 는 `patchWrites` 와 같아 따로 두지 않았다. 게이트: `perf-ratchet-gate.mjs` 에 fixture 를 run 키 · 하니스 인자에 싣는 `runKeyOf` (`600:nested-flex`) 와 `--add-run` 을 더했다 — 중첩 문서의 비용을 pre-push 게이트가 잰다.

## 2. Phase 1 — 옮기기 기계 `translateSubtree` (G1)

- 위치: `apps/builder/src/builder/workspace/canvas/skia/subtreeTranslate.ts` (새 파일 — `subtreeCommandPatch.ts` 의 `collectCompleteSubtreeIds` · `createCommandReader` 를 재사용).
- 입력: `stream` · `rootId` · 명령 Δ (`dx` · `dy` — 지역 rect 의 변화, root 의 `ELEMENT_BEGIN` 에) · **root 문맥** (`SubtreeBuildContext` — 부모가 그대로면 저장된 것, 부모 자기 patch 뒤면 부모가 계산한 새 `parentAbsX/Y` · 자식 clip. Phase 0 보강) · `revision`. 맵 Δ (절대) = 새 문맥의 `parentAbs` + 새 지역 위치 − 이전 bounds 원점 — 부모가 움직였으면 명령 Δ 와 다르다. 명령 Δ = 0 · 맵 Δ = 0 · clip 동일이면 할 일이 없다 (호출자가 부르지 않는다).
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
  - ~~부모 rect 가 바뀌면 (`parentChanged`) 지금처럼 부모가 root — 옮기기 안 함~~ → **Phase 0 보강**: 부모가 바뀐 층이 옮김의 99.5 % 라 region 을 위 → 아래로 내려가며 처리한다 — 경로 노드 (크기가 바뀐 조상) 는 **자기 명령만** 다시 기록 (`ELEMENT_BEGIN` ~ `CHILDREN_BEGIN` · `CHILDREN_END` · `ELEMENT_END` — `visitElement` 의 자기 부분을 자식 방문 없이, 명령 수가 같을 때만 제자리 쓰기; 다르면 그 노드에서 서브트리 patch 로 후퇴, `pathSelfFallbacks`), 그 자식 중 seed 는 서브트리 patch · 자리만 옮긴 것은 옮기기 (부모가 넘긴 문맥) · rect 그대로인 것은 부모가 clip 하며 크기가 바뀌었거나 부모가 움직였을 때만 Δ 명령 0 으로 옮기기 (맵 · clip 재교차), 아니면 둔다. 경로 노드의 자기 맵 (bounds · hit · clip · build context) 도 같은 자리에서.
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

- 2026-10-16 **G4 종결 — 사용자 결정 2 「측정 기록으로 종결」** — production 짝: `.cache/perf-ratchet/wt` 를 `prepareWorktree(bf7d7ff84)` (HEAD — 다른 세션 커밋 2 개 포함) 로 맞춘 뒤 `perf:build-dist` before, 이 ADR 런타임 diff 6 파일 (`CatalogCanvas.tsx` 는 이 ADR hunk 3 개만 — 다른 세션 WIP 제외) 을 `git apply` 해 after, 빌드 뒤 되돌림. 조건: `--serve-dist` · headless Chromium · `--fixed-inputs --profile`. callback gap p99 (ms) / drop (%) · taskMs:

  | 시나리오            | before                                                     | after                                                        | HC2                                    |
  | ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------- |
  | 평평 5k 줌          | 20.8 · 33.9 / 0 · 3.3 · taskMs 790 · 1,132                 | 17.3 · 17.8 / 0 · 0 · taskMs 570 · 703                       | 충족 (≤ 20)                            |
  | 평평 1만 줌 (불리)  | 49.5 / 3.9                                                 | 17.7 / 0                                                     | 충족                                   |
  | 중첩 5k 줌          | 17.6 · 17.6 / 0                                            | 17.6 · 17.7 / 0                                              | 유지                                   |
  | 평평 5k drag        | 19.2 · 21.2 / 0.5 · 0.8                                    | 20.7 · 20.5 / 0.5 · 0.5                                      | 유지 (같은 폭)                         |
  | 중첩 5k drag        | 20.3 · 21.0 / 0.2 · 1.2 · taskMs 2,131 · 2,116             | 20.3 · 21.1 / 0 · 0.3 · taskMs 1,393 · 1,486                 | (기준 없음)                            |
  | 중첩 5k 편집 (5 쌍) | 17.7 · 22.3 · 27.7 · 26.3 · 26.7 / 0 · 0 · 2.1 · 2.6 · 3.2 | 19.6 · 27.3 · 24.1 · 25.2 · 26.1 / 0 · 1.6 · 1.0 · 2.1 · 1.6 | 미달 (≤ 20 · < 1)                      |
  | 평평 5k 편집        | 21.9 · 33.3 / 0 · 6.6                                      | 31.3 · 30.8 / 2.1 · 3.6                                      | (기준 없음 — 이 ADR 경로 무관, 노이즈) |

  편집 p99 는 ~190 프레임 중 상위 2 프레임이라 같은 arm 안에서도 17.7 ~ 27.7 로 흔들린다 (방향만). 남은 비용 (dev 프로필, 중첩 5k 편집 after — idle 57 %): `graph.replace` 6.5 % · `graph.commit` 4.4 % · `readModel.onStep` 3.3 % · `compositionRoot.deliver` 3.3 % · `applyCatalogTransaction` 3.1 % · `workspace.touchesTheme` 2 % — 문서 · 트랜잭션 층 (편집당 문서 크기에 비례 — 메모리 `project-mutation-cost-scales-with-document-size`) 이고 Canvas 렌더 경로 (이 ADR) 밖이다. production 프로필에서 before 의 상위 1 개 (6.5 %) 가 사라지고 idle 74.9 → 80.7 %. **4단계 (Rust 판정) 입력**: 그리기 명령 · patch 는 더 이상 상위에 없다 — 옮기기의 SpatialIndex upsert 는 중첩 5k 편집 1 회 ~139 (page frame clip 밖은 hit 이 없어 upsert 0), 경계 호출 비율은 상위 목록에 나타나지 않는다 → trigger 「그리기 명령 > 8 ms/frame」 미충족 그대로. 다음 편집 꼬리는 문서 층 (3단계 선택 전환과 같은 구독 · read model 자리 — 새 ADR 의 몫). cross-check · live 는 본문 Live Exercise. drag: 중첩 5k drag 189 프레임도 이미 `placeRegion` 을 탄다 (dev — patch 교체 14,553 · 옮기기 2,304 회 · 후퇴 0); drag visual offset · 형제 비킴 offset 이 걸려 있는 동안은 옮기기가 거절되어 서브트리 patch 로 간다 (`checkTranslate`).

- 2026-10-16 **Phase 3 닫힘 (G3)** — `canvasBinding.ts` `movePageRoots` (엔진의 page root rect 와 바인딩의 rect 비교 — 크기가 같고 위치만 다르면 그 root 를 `translateSubtree` 로 옮기고 `layoutMap` · Skia data 를 갱신, 대기 중 record delta · 크기 변화 · 옮길 수 없는 root 하나라도 있으면 null) · `canvasScene.ts` `pageGridChanged()` (root 집합 · 순서가 그대로일 때만, null 이면 지금처럼 `rebind("page-grid")`; 결과 `{ kind: "placed" }`) · `CatalogCanvas.tsx` 의 page grid 두 자리 (`syncAutoColumns` · page grid 편집) 를 `pageGridChanged()` 로. 계획과 다른 점: `setAutoColumns` 반환은 그대로 두고 scene 이 rect 를 비교한다 (호출자 · shared 변경 0); `refresh()` 는 drag 시작 · 끝 (top layer 재구성 — 재바인드가 맞다) 이 같이 쓰고 있어 남겼다 — 그래서 `rebindPageGrid` 카운트에는 drag 의 두 번이 들어간다 (seed 60 drag A 2). 검증 핸들: `cat.canvas.streamBoxes` · `rebind` (scene `rebuild()` — oracle) · `hitAt`. unit (`phase4eCanvasScene`): page 3 개 · 자동 열 1 → 3 → 2 마다 `placed` 이고 명령 · bounds · hit · clip 맵 = 새로 묶은 scene; 원복 RED (`layoutMap` 갱신 빠짐) → FAIL. 「크기 바뀐 frame 도 옮김」 변이는 GREEN — 열 수 변경은 frame 크기를 바꾸지 않아 (Phase 0 `pageGridResized` 0) production 재현이 없는 커버리지 지적이라 LOW deferred. 측정 (dev, 2 회 같은 값): 평평 600 줌 `rebindPageGrid` 14 → 0 · picture miss 1,036 → 14 · `execVisited` 7,262 → 6,240 · `scrollRangeVisits` 8,400 → 0 (옮기기 14 회 — 옮겨지는 것은 빈 둘째 page); 평평 5k 줌 같은 모양. ratchet: seed 600 `zoom` 부류는 이번 작업에서 처음 등록한 (미커밋) 것이라 옮기기가 들어간 코드로 다시 등록했다 (`--add-class`). 원복 RED (`pageGridChanged` 가 늘 재바인드, 2 회): `rebindPageGrid` 0 → 14 · picture miss 14 → 1,036 · `paragraph.misses` 0 → 504 · `scrollRangeVisits` 0 → 8,400 외 → `block`. 관찰: 600 `zoom` 의 `domMutations.attributes` 는 원복 코드에서도 2,811 (Phase 0 · 2 의 2,352 에서 바뀐 것은 dev 트리에 있는 다른 세션의 미커밋 작업 — 이 ADR 무관); 깨끗한 HEAD 에서는 낮게 재져 게이트가 막지 않는다. live 13/13 (줌 0.12 · 0.3 · 0.6 · 0.18 · 1 에서 재바인드 0 · 픽셀 · 맵 · SpatialIndex 후보 0 차 · page header 위치 (DOM, 같은 캡처) 동일, page grid gap 편집도 같은 길) — 처음 실행의 픽셀 차 (줌 케이스 5 · 9,972 px) 는 카메라 이동 뒤 잠깐 보이는 viewport scrollbar (DOM) 를 찍은 것이라 사라진 뒤 찍도록 하니스를 고쳤다.
- 2026-10-16 **Phase 2 닫힘 (G2)** — `subtreeTranslate.ts` `placeRegion`: region root 에서 위 → 아래로 계획을 다 세운 뒤 쓴다 — seed (record · 자식 목록 변경) 는 저장 문맥이 그대로일 때 서브트리 patch, 경로 노드 (자기나 자손의 rect 가 바뀜) 는 `renderCommands.ts` `buildSelfCommandStream` (자식 방문 없이 자기 명령 + 자식에게 넘길 문맥 — `visitElement` 의 `selfOnlyChildContexts`) 으로 자기 명령만 제자리 쓰기 (명령 수가 같을 때), 자리만 옮긴 것 · 문맥이 바뀐 것 (부모가 움직였거나 clip 이 바뀜) 은 `translateSubtree`, 나머지는 그대로. 계획이 안 서는 노드는 문맥이 그대로인 가장 가까운 조상에서 서브트리 patch — 최악이 지금의 region splice. 적용 때 span 위치를 다시 읽는다 (앞 형제의 splice 가 길이를 바꿀 수 있다). `canvasBinding.ts`: `patchSubtree` 를 떼어 내고 region 마다 `placeRegion`; scrollbar 만 바뀐 스크롤 owner (`scrollRepaint`) 는 seed 가 아니라 경로 노드 — **처음 배선에서 이것이 seed 라 page body 전체를 다시 기록했다** (중첩 600 교체 21,441 → 고친 뒤 1,155). `CatalogCanvasUpdate.translated` · dev `renderDebug.translateOff` (`__composition_RENDER_PATH_DEBUG__.setTranslateOff`). 카운트: `translate*` · `pathSelfPatches` · `pathSelfWrites` · 후퇴 사유 `placeFallback{SeedContext,Translate,Shape,Child}` (지금 전부 0). Phase 0 분해 카운트는 다시 기록된 노드만 분해한다 (옮긴 서브트리는 쓴 것이 없다). unit: `placeRegion` 무작위 1,000 건 (seed 크기 변화가 조상 경로로 번지고 경로 형제 절반이 옮겨짐 — 명령 · span · 맵 · SpatialIndex = 처음부터 기록, 대부분 seed 하나만 다시 기록) · `phase3BindingDelta` 기대값에 `translated: []`. 측정 (dev, 등급 A): 중첩 600 편집 `patchWrites` 25,623 → 1,155 · `patchScanCommands` 51,246 → 2,310 (옮기기 138 회 · 5,280 노드 · 경로 자기 patch 60 회 276 명령); 중첩 5k 편집 178,875 → 1,155 · 357,750 → 2,310 (옮기기 336 회 · 45,078 노드 · SpatialIndex upsert 2,079 — page frame clip 밖은 hit 없음), drag 189 프레임도 같은 길 (`patchWrites` 14,553). node picture miss 는 전후 같다 (cold 181 · data 0 — 옮긴 서브트리의 picture 유지). ratchet: `--update` 7 하향 + 새 키 9 A 등록 (60 · 600 · `600:nested-flex`). 원복 RED (옮기기 끔, 2 회): `600:nested-flex` `patchWrites` 1,155 → 25,623 · `patchScanCommands` 2,310 → 51,246 외 5 키 → `block`. live (`adr264-subtree-translate-live.mjs`, dev 5173 · headless Chrome) 6/6 — 카드 높이 · 카드 폭 (줄바꿈) · clip 상자 안 띠 (clip 경계를 넘음) · 스크롤 상자 항목 (scrollbar 변화) · 맨 위 상자 · undo × 5 에서 같은 상태를 다시 묶은 것과 픽셀 0 차 · bounds / hit 맵 0 차 · 모든 hit 중심의 SpatialIndex 후보 0 차; live RED (clip 재교차 → 「저장된 교차 +Δ」): 3 · 4 가 hit 맵 차로 FAIL (픽셀은 같다 — picking 만 어긋나는 결함을 잡는다), 복원 cmp. 관찰: seed 600 `zoom` 의 `domMutations.attributes` 가 3 회 중 1 회 2,352 → 2,356 (Phase 0 에 A 로 등록된 값, Phase 2 가 닿지 않는 DOM 카운트 — 게이트는 A 초과 시 재실행하고 값이 갈리면 「측정 불가」).
- 2026-10-16 **Phase 1 닫힘 (G1)** — `skia/subtreeTranslate.ts` `translateSubtree` (root `ELEMENT_BEGIN` 한 칸을 `writeCommandAt` 으로 제자리 교체 — piece-table segment 를 나누지 않는다, cursor span map 해석 비용이 segment 수에 비례하므로; 맵은 root 의 절대 Δ 로 옮기고 clip · hit 은 root 문맥의 clip 에서 `childClipRectOf` · `hitBoundsOf` 로 다시 교차 — 두 함수는 `visitElement` 의 식을 빼낸 것이라 full build 와 한 식; 자손 build context 는 `parentAbs` +Δ · clip 다시; root 문맥 = 인자). 쓰기 전 검사 (`checkTranslate`): 문맥 · span 없음 · top layer (fixed 포함 — build 가 top layer 집합에 넣는다) · sticky · drag offset · 형제 비킴. 계획과 다른 점: hit bounds 밖 paint (`damageUnsafeElementIds` · 넘친 글자) 는 거절하지 않고 옮긴 뒤 `unsafePaint` 로 알린다 — patch 와 같은 규칙 (그 프레임은 full, viewport 실행이라 싸다); SpatialIndex 는 넓이 0 이면 remove (Rust `upsert` 규칙). unit `subtreeTranslate.test.ts`: 무작위 트리 1,200 건 (깊이 1 ~ 6 · clip · border inset · scroll offset · 숨김 · 넓이 0) 옮긴 뒤 명령 · span 3 종 · 맵 4 종 · SpatialIndex 대역이 처음부터 기록한 것과 같고 damage 가 서브트리 전 요소의 이전 · 이후 hit 을 덮음 · 부모가 움직이고 크기가 바뀐 문맥 400 건 · 리뷰 반례 H1 (옮긴 뒤 같은 root 재기록 y 30) · H2 (damage y 10 .. 110) · M3 (clip 10 → 30 · hit 20) · 거절 5 종 (쓰기 0 확인). 원복 RED (변이 3, 백업 · trap · cmp): 「저장된 교차 +Δ」 → 무작위 · 부모 문맥 · M3 FAIL, 「root 문맥도 +Δ」 → 무작위 · 부모 문맥 · H1 · M3 FAIL, 「root-only damage」 → 무작위 · H2 FAIL. 인접 skia · binding 50 파일 260 통과.
- 2026-10-16 **Phase 0 닫힘 (G0)** — 결과는 §1 Phase 0 결과. ratchet 등록 (dev 5173 · 각 2 회 같은 값): `--add-keys 60 · 600` 새 키 11 A · `--add-class 600` `zoom` (`rebindPageGrid` 14 · `pageGridMovedRoots` 14 · `pageGridResized` 0) · `--add-run 600:nested-flex` `edit` (`patchWrites` 25,623 · `patchMovedOnlyCommands` 19,014 · `patchMovedUnderResizedCommands` 18,090 · `patchSeedCommands` 1,155 · `patchPathCommands` 276 · `patchUnchangedCommands` 5,178). recorder 해시 불변 (카운터 필드만 늘었다). G0 원복 RED: 실제 보고의 `patchMovedOnlyCommands` 19,014 → 19,015 · `rebindPageGrid` 14 → 15 를 판정 → `block`; 그대로는 `pass`. 게이트 unit `perf-ratchet-gate.test.mjs` 19/19 (`--add-run` — fixture 가 run 키 · 하니스 인자에 실림 · 기존 run 무변경 · 회귀 `block` · 중복 · 키 불일치 · 보고 1 개 거부). pre-push 게이트는 run 이 하나 · 부류가 하나 늘어 그만큼 길어진다. 설계 보강 (경로 노드 자기 patch · 부모 문맥 옮기기 · Phase 3 의 scene 안 판정) 은 추정 vs 실측 gap 의 Phase 0 흡수 (adr-writing M3) — 대안 A · 닫는 조건 · 사용자 결정은 그대로라 결정 지점 아님. CHANGELOG 는 사용자-가시 변경이 없어 종결 때 한 번에.
