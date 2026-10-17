# ADR-269 design breakdown — 그리기 명령의 transform · clip · scroll 문맥을 property node 로 분리

> 본문: [ADR-269](../completed/269-render-command-property-node-separation.md). 이 문서가 Phase · 파일 · 카운트 · 체크리스트의 정본이다. 실측 결론은 §기록 에 쌓는다 (`docs/adr/evidence/` 는 gitignore).

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: base 는 ADR-189 (부모 기준 좌표 명령 · subtree splice) 와 ADR-264 (`translateSubtree` — 명령은 그대로, 맵만 Δ). 이 ADR 은 그 스트림 모델 위에 **문맥 소유자 (노드 테이블)** 를 두는 확장이다 — 새 문서 스키마 · 저장 형식 없음.
2. **schema 직교**: 문서 (`CatalogGraph`) · 저장 · Preview 와 직교. 바뀌는 것은 Canvas 메모리 안 `RenderCommandStream` 과 그 갱신 경로만.
3. **선행 ADR 전제 reverse 검증**: ADR-264 대안 B (지연 절대 맵) 의 기각 사유를 그대로 승계하지 않고 다시 보았다 — 소비자 20+ · SpatialIndex 절대값 upsert 는 2026-10-17 코드에서도 같다 (`subtreeTranslate.ts:234 ~ :246` upsert · `catalogOverlay.ts` · `catalogChrome.ts` · `CatalogCanvas.tsx` 가 `hitBoundsMap` 소비). 그래서 절대 맵은 **유지 + 테이블에서 파생 갱신** 이다 (본문 §이 ADR 이 다루지 않는 것).
4. **판독에 전제 검증을 미루지 않음**: 위 1 ~ 3 은 본문 Context 코드 사실 1 ~ 5 로 lock-in. 리뷰는 사용자 요청 시 phase 당 1 + 수리 검증 1.

## 1. 설계 — 노드 테이블과 명령의 관계

```
RenderCommandStream
  commands[]                       ← 그리기 명령 (노드-로컬, 바뀌지 않음)
  nodes: PropertyNodeTable         ← 새 정본 (문맥)
    transform[id] = { x, y, matrix? }          — 부모 기준 (ADR-189 와 같은 좌표계)
    clip[id]      = { clipChildren, width, height, borderInset }
    scroll[id]    = { scrollLeft, scrollTop }
    children[id]  = [childId…]                  — 서브트리 요소 색인 (검사 · damage 용)
  boundsMap · hitBoundsMap · SpatialIndex       ← 절대 맵: 테이블에서 파생 (유지)
```

- `ELEMENT_BEGIN { elementId, transformNodeId, width, height, visible, … }` — `x · y` 는 Phase 3 에서 제거 (그 전에는 테이블과 같은 값을 들고, 실행기는 테이블을 읽는다).
- `CHILDREN_BEGIN { clipNodeId, scrollNodeId }` — `clipChildren · width · height · clipBorderInset · scrollOffset` 은 Phase 1 (scroll) · Phase 2 (clip) 에서 제거.
- `CHILDREN_END { ownerId }` — `hasScrollOffset` · `hasClip` · `scrollbar` · `scrollbarNode` (지금 `renderCommands.ts:1849 ~ :1859` 에 기록 시점 값으로 구워짐) 도 BEGIN 과 **같은 Phase 에서** 제거한다 (r1 H1). BEGIN 만 테이블을 읽으면 0 ↔ 150 스크롤 · visible ↔ clip 전환에서 END 가 옛 값으로 restore 해 save/restore 가 ±1 어긋나고, scrollbar thumb 은 기록 시점 위치에 남는다.
  - **열린 프레임 스택**: 실행기는 `CHILDREN_BEGIN` 에서 실제로 연 것을 `childrenFrameStack.push({ clip: boolean, scroll: { dx, dy } | null })` 로 남기고 `CHILDREN_END` 는 그것만 pop 해 닫는다 (scroll restore + `translateStack` 복원 → scrollbar → clip restore, 지금 순서 그대로). END 는 테이블도 기록 값도 읽지 않으므로 한 실행 안에서 BEGIN · END 가 다른 상태를 볼 수 없다. 지금의 `scrollDeltaStack` 은 이 스택에 흡수.
  - 짝 불변식: 범위 실행 (`executeCommandRange` 의 subtree span · 컬링 skip) 은 짝이 맞는 span 단위라는 기존 전제 위에서만 성립 — dev 빌드는 실행 끝에 스택이 비지 않거나 빈 스택에서 pop 하면 throw (G1 변이가 이 assert 로 RED).
  - **scrollbar 는 테이블에서 파생**: `nodes.scroll[owner] = { scrollLeft, scrollTop, maxScrollLeft, maxScrollTop }` 를 END 가 읽어 `catalogScrollbar(width, height, range, offset)` (`canvasOverflow.ts:276`) 로 thumb 을 실행 시점에 계산해 그린다. scrollbar 는 self span (`ELEMENT_BEGIN` 직후 ~ `CHILDREN_BEGIN` 직전, `:1732`) 밖이라 picture 캐시 키에 들어가지 않는다 (HC6 불변). 재등록 변경 판정 키 (`canvasBinding.ts:1464` `scrollbars` JSON) 는 thumb 위치를 빼고 range · 크기만 — 스크롤 뒤 무관한 편집이 scrollbar 차이로 소유자를 재기록하지 않게.
- `SubtreeBuildContext` — `parentAbsX/Y · clipRect · scrollContextKey` 를 **값** 대신 `parentId` 한 개로 (부모의 테이블 항목에서 모두 파생). `zOrderKey` · `topLayerSubtree` 는 그대로 (문맥이 아니라 순서 · 층).
- 실행기 (`executeRenderCommands`): `ELEMENT_BEGIN` 에서 `nodes.transform[id]` 로 `translateStack` 갱신, `CHILDREN_BEGIN` 에서 `nodes.clip[owner]` · `nodes.scroll[owner]` 로 `canvas.clipRect` · `canvas.translate(-scroll)`. 드래그 offset · page delta 는 지금처럼 실행 시점 가산 (R3).
- damage: 테이블 갱신의 damage = 바뀐 노드 서브트리 요소들의 이전 ∪ 이후 hit bounds (`children[id]` 색인으로 — 명령 스캔 0).
- 옮기기 (`translateSubtree`): `checkTranslate` 가 `children[root]` 색인으로 top layer · fixed/sticky · unsafe 판정 (`translateCheckCommands` → 0). `applyTranslate` 는 `nodes.transform[root]` 갱신 + 자손 절대 맵 Δ (지금의 루프 — 비용 유지).
- 스크롤 (`scrollBy`): `nodes.scroll[owner]` 갱신 → 자손 절대 맵 Δ (옮기기와 같은 기계, dx · dy = −Δscroll) → damage = owner 의 clip rect ∩ 조상 clip. 소유자 **서브트리 재기록 0**. 스크롤 범위 (`catalogScrollRange`) 는 지금처럼 (ADR-263 Phase 4 의 extent 캐시) — 이 ADR 범위 밖. 맵 Δ 의 적용 시점은 아래 변경 발행 계약을 따른다.
- **property 변경 발행 계약 (r1 H2)**: 지금 `CatalogCanvasScene.sync()` (`canvasScene.ts:138 ~ :145`) 는 `rebound · patchRoots` 가 비면 `unchanged` 를 돌려주고, `CatalogCanvas.tsx:799 ~ :804` 는 그때 `invalidateContent` · `overlayVersion` · `cellsVersion` 을 건너뛴다. 휠 경로 (`:914 ~ :918`) 의 `scheduler.invalidate` 만으로는 content surface 가 dirty 가 되지 않는다 (`SkiaRenderer.ts:361`). 그래서 명령 쓰기 0 인 변경도 sync 를 통과해 화면 무효화까지 가야 한다:
  - binding 이 `pendingProperty: { owners: Set<id>, damage: BoundingBox | "full" | undefined }` 를 가진다. `scrollBy` 는 테이블 · 맵을 즉시 바꾸고 (히트 · overlay 가 같은 상태를 읽도록 — 맵만 앞서는 구간이 없게 아래 1 회 소비와 같은 프레임 안에서 그린다) owner 를 넣고 damage 를 합집합 (어느 하나가 `"full"` 이면 `"full"` — unsafe 자식 · clip 밖 그림자).
  - `binding.update()` 가 pending 을 **1 회 소비**하고 비운다. 결과 `CatalogCanvasUpdate` (`canvasBinding.ts:1272 ~`) 에 `propertyChanged: readonly string[]` 를 더하고, damage 는 문서 patch damage 와 합집합 — 어느 쪽이든 full (damage 없음) 이면 full 우선. 같은 프레임의 여러 wheel 은 합산돼 한 번에 나간다.
  - `sync()` 변경 판정: `rebound.length || patchRoots.length || propertyChanged.length` → `patched`. `catalogSyncDamage` 는 지금처럼 `update.damage` 를 읽으므로 CatalogCanvas 의 분기는 그대로 content (부분) · overlay · cells 를 무효화한다.
  - 문서 dirty 와 동시: 같은 owner 가 patch root 아래면 patch 가 테이블에서 새 오프셋을 읽어 기록하고 (재기록이 정본), pending 은 같은 update 에서 비운다. 맵 Δ 를 patch 가 다시 쓴 서브트리에 이중 적용하지 않는다 (patch 대상 자손은 Δ 생략 — 동치 테스트 반례).
  - `rebind-required` · rebind: pending 을 버리고 full 로 그린다. 오프셋은 지금처럼 scene 의 `scrollOffsets` (`canvasScene.ts:69`, 재바인드 보존) 에서 다시 테이블로 — 보존 경로 유지.
- patch (`applyCommitSubtreeCommandPatch`): `clip-context-changed` · `scroll-context-changed` 거부 제거 — root 의 부모 테이블 항목이 바뀌었으면 patch 뒤 테이블 갱신으로 흡수.

## 2. Phase 0 — 카운트 · 기준선 · go/no-go (G0)

### 새 카운터 (`renderCounters.ts`, dev 전용 · 동작 무변경)

| 카운터                                                          | 세는 것                                                                                                                                                                                                                | 지금 (예상 자리)                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `scrollRecordCommands`                                          | 요소 스크롤 1회가 다시 기록한 명령 수 (소유자 서브트리 patch 의 `patchWrites` 중 스크롤 사유)                                                                                                                          | `canvasBinding.ts` `scrollBy` → dirty → `patchSubtree` |
| `scrollRecordCalls`                                             | 스크롤이 patch 를 부른 횟수                                                                                                                                                                                            | 같은 자리                                              |
| `rebindSpliceRejectedClipContext` · `…ScrollContext` · `…Other` | `splice-rejected:<reason>` 재바인드를 사유별로                                                                                                                                                                         | `canvasBinding.ts:2395` (지금은 `rebindOther` 에 묻힘) |
| `translateMapWrites`                                            | 옮기기가 쓴 맵 항목 수 (bounds · clipContext · buildContext · hit — 요소당 4 ~ 5)                                                                                                                                      | `subtreeTranslate.ts` `applyTranslate` 루프            |
| `propertyNodeReads`                                             | 실행기 · damage · 검사가 테이블을 읽은 횟수 (Phase 1 부터 — HC4 비용 이동 감시)                                                                                                                                        | 신설                                                   |
| 기존                                                            | `translateCalls` · `translateNodes` · `translateIndexUpserts` · `translateCheckCommands` · `scrollRangeVisits` · `scrollSubtreeVisits` · `patchWrites` · `rebindPageGrid` · `rebindOther` · `executeCommandRange` 계열 | ratchet 에 이미 A 등록                                 |

### 하니스

- 기존 run `600:nested-flex` (편집) · `60:app-pages` (zoom · edit · pan · page-switch) 에 새 키 A 등록 (`perf-ratchet-gate.mjs --add-keys`).
- **사용자 결정 2** — 새 부류 `scroll` (요소 스크롤): `app-pages` 안 overflow:auto 상자 1 개 + 합성 5k 행 ListBox (`--edit-target` 과 같은 방식으로 대상 지정) 에 휠 Δ 를 고정 순서로. recorder 변경이라 승인 뒤. 승인 전에는 `drag` 부류의 `scrollRangeVisits` 와 수동 프로브로 기준선만.
- production 짝 기준선: ADR-266 종결 수치 인용 (`app-pages` 줌 headless p99 24 ~ 27 · 편집 18 ~ 25) · ADR-265 종결 (중첩 5k 편집 24 ~ 26). HEAD 가 바뀐 범위만 다시 잰다 (같은 묶음 · 쌍 안 교대).

### go/no-go

- **go**: 이 ADR 이 닿는 카운트 (스크롤 재기록 · 사유별 재바인드 · 검사 스캔 · 맵 쓰기) 가 0 이 아니고, 그 자리가 ADR-266 종결 프로필의 남은 상위 (옮기기 검사 3.9 % · damage 1.4 %) 와 맞는다.
- **no-go**: 스크롤 재기록 · 문맥 거부 재바인드가 하니스 · 사용자 프로젝트에서 0 에 가깝고 검사 스캔은 ADR-266 4-1 뒤 더 줄 자리가 없다 → 측정 기록으로 Rejected (정본 §5-1 O1 에 결과 기록).

### 체크리스트

- [x] 카운터 추가 · `--fixed-inputs` 2 회 같은 값 확인 (등급 A)
- [x] ratchet 등록 (`600:nested-flex` · `60:app-pages` · 승인 시 `scroll` 부류) · 인위 회귀 `block`
- [ ] 사용자 프로젝트 (22 페이지) 에서 요소 스크롤 1회당 `scrollRecordCommands` · `splice-rejected` 사유 분포 프로브 (dev 전역) — 사용자 브라우저의 프로젝트가 필요해 G4 live 로 넘김
- [x] go/no-go 를 §기록 에

## 3. Phase 1 — scroll 노드 + 옮기기 검사 색인화 (G1 · G2)

| 변경                                                                                                                                                                                                                 | 파일                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PropertyNodeTable` (`scroll` · `children` 색인) 를 `RenderCommandStream` 에 추가 · 기록 (`visitElement` · `buildSelfCommandStream`) 이 채움                                                                         | `skia/renderCommands.ts` (타입 `:809 ~`, 기록 `:1655 ~ :1860`)                                                                                                           |
| `CHILDREN_BEGIN.scrollOffset` 제거 · 실행기가 `nodes.scroll[owner]` 읽음 (`canvas.translate` · `translateStack` 보정 · `scrollDeltaStack`)                                                                           | `skia/renderCommands.ts` `:1781` · `:2893 ~ :2925`                                                                                                                       |
| `CHILDREN_END` 의 `hasScrollOffset` · `scrollbar` · `scrollbarNode` 제거 → 실행기 `childrenFrameStack` pop (scroll) · scrollbar 는 `nodes.scroll[owner]` 의 offset · range 로 실행 시점 파생 · dev 짝 assert (r1 H1) | `skia/renderCommands.ts` `:1849 ~ :1859` · `:2919 ~ :2940` · `catalogRuntime/canvasOverflow.ts` `catalogScrollbar` · `skia/nodeRendererShapes.ts` `renderScrollbar` 입력 |
| 재등록 변경 판정 `scrollbars` 키에서 thumb 위치 제외 (range · 크기만)                                                                                                                                                | `catalogRuntime/canvasBinding.ts` `:1462 ~ :1472`                                                                                                                        |
| `scrollBy` → 테이블 갱신 + 자손 절대 맵 Δ + damage (소유자 clip rect) — dirty seed 로 보내지 않음 · `pendingProperty` 에 owner · damage 누적                                                                         | `catalogRuntime/canvasBinding.ts` `:2443 ~ :2465` · `skia/subtreeTranslate.ts` (Δ 기계 재사용 `applyScroll`)                                                             |
| `update()` 가 pending 1 회 소비 → `CatalogCanvasUpdate.propertyChanged` · damage 합집합 (full 우선) · patch 와 겹치는 owner 의 Δ 생략 (r1 H2)                                                                        | `catalogRuntime/canvasBinding.ts` `:1272 ~ :1298` · `:2295 ~ :2430`                                                                                                      |
| `sync()` 변경 판정에 `propertyChanged` 추가 → `patched` (CatalogCanvas 의 무효화 분기는 무변경 — 판정 입력만)                                                                                                        | `catalogRuntime/canvasScene.ts` `:138 ~ :145`                                                                                                                            |
| `scroll-context-changed` 거부 제거 (`scrollContextKey` 는 테이블 파생)                                                                                                                                               | `skia/subtreeCommandPatch.ts` `:350 ~ :360`                                                                                                                              |
| `checkTranslate` 가 `children[root]` 색인으로 판정 — 명령 스캔 0                                                                                                                                                     | `skia/subtreeTranslate.ts` `:100 ~ :150`                                                                                                                                 |
| `SubtreeBuildContext.scrollContextKey` 제거 → `parentId`                                                                                                                                                             | `skia/renderCommands.ts` `:797 ~ :807` · 저장 · 비교 (`sameBuildContext`)                                                                                                |
| dev 전역 `__composition_RENDER_PATH_DEBUG__.setPropertyNodesOff` (live 대조 — 옛 경로 = 소유자 재기록)                                                                                                               | `skia/renderCommands.ts` debug 전역                                                                                                                                      |
| 가상화 소유자 (ADR-150 ListBox · GridList · Table window) — 행 집합 변경은 문서 dirty 로 따로 (R5) · 없으면 `unsafe` 분류로 기존 재기록                                                                              | `catalogRuntime/canvasBinding.ts` `scrollStateOf` · `dataBinding.ts`                                                                                                     |
| ADR-267 sticky clamp 가 `nodes.scroll[container]` 를 읽음 (R4 — 267 Phase 1 이 먼저면 그 입력을 교체, 뒤면 267 이 테이블을 읽음)                                                                                     | `skia/renderCommands.ts` `:1647 ~ :1705`                                                                                                                                 |

- **동치 테스트 (G1)**: `subtreeTranslate.test.ts` · `subtreeCommandPatch.test.ts` 옆에 `propertyNodes.test.ts` — 무작위 트리 1,200 (overflow auto · clip · 중첩 scroll) 에서 「스크롤 n 회 뒤 테이블 경로 == 같은 오프셋으로 처음부터 기록」 (명령 byte · boundsMap · hitBoundsMap · clipContext · SpatialIndex 후보) · 반례: 스크롤된 조상 아래 편집 patch · 스크롤 + 옮김 · drag offset 중 스크롤 · 5k 행 가상화 소유자 (창 밖 → 안 행).
  - **r1 H1 반례** (기록 후 상태만 바꾸고 명령 · 등록은 유지): offset 0 → 150 · 150 → 0 · 중첩 scroll 안쪽만 변경 · 스크롤 소유자 뒤의 형제 그리기 (restore 불균형이면 형제가 clip · translate 를 상속) — 판정은 실행 뒤 `save − restore` 0 · 형제 픽셀 · scrollbar thumb (높이 100 · 내용 300 · offset 150 → thumbY 가 cold rebuild 와 같은 50).
  - **r1 H2 반례** (실제 `CatalogCanvasScene.prototype.sync` 경유): property-only 변경 → `patched` + damage · CatalogCanvas 의 `invalidateContent(damage)` 1 회 · `overlayVersion` +1 · 한 프레임 wheel 3 회 → update 1 회에 합산 · 다음 sync 는 `unchanged` (재소비 0) · 같은 프레임 문서 편집 + 스크롤 (damage 합집합 · patch 서브트리 Δ 이중 적용 0) · full 우선 · 스크롤 뒤 rebind 의 오프셋 보존.
- **원복 변이 RED**: 테이블 갱신 생략 (맵 stale) · damage 를 owner 상자로만 (unsafe 자식 누락) · 색인 없이 스캔 · END 가 옛 기록 값으로 닫음 (짝 assert) · scrollbar 를 기록 시점 값으로 · sync 판정에서 `propertyChanged` 제외 (content 무효화 0 → 픽셀 stale) — 각각 테스트 FAIL + ratchet `block`.
- **카운트 (G2)**: `scrollRecordCommands` → 0 · `translateCheckCommands` → 0 · `rebindSpliceRejectedScrollContext` → 0 · HC4: `propertyNodeReads` 기준선 기록, hover · marquee · pan · select 부류 변동 0, `executeCommandRange` 변동 0.
- **live**: `adr269-property-nodes-live.mjs` (ADR-264 live 를 복제) — 사용자 프로젝트 overflow:auto 상자 휠 스크롤 → 테이블 off 와 0 px · 맵 · `hitAt` 동일 · 스크롤 뒤 자식 클릭 선택 상자 일치 · hover 아웃라인 일치.

## 4. Phase 2 — clip 노드 (G1 · G2)

| 변경                                                                                                                                     | 파일                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `nodes.clip[id]` — `CHILDREN_BEGIN` 의 `clipChildren · width · height · clipBorderInset` 제거, 실행기가 테이블 읽음                      | `skia/renderCommands.ts` `:1775 ~ :1783` · `:2881 ~ :2891`                                                         |
| `CHILDREN_END.hasClip` · `clipChildren` 제거 — clip restore 는 `childrenFrameStack` 의 `clip` 플래그로 (r1 H1, Phase 1 의 스택을 그대로) | `skia/renderCommands.ts` `:1849 ~ :1851` · `:2936 ~ :2938`                                                         |
| clip 노드 변경 (overflow 전환 · `clipBorderInset`) 이 명령 쓰기 0 으로 끝나면 Phase 1 의 `pendingProperty` 로 발행 (r1 H2)               | `catalogRuntime/canvasBinding.ts` · `canvasScene.ts`                                                               |
| `clipContextByElement` 를 테이블 파생 (조상 clip 교차는 `childClipRectOf` 그대로 — 저장 대신 계산 또는 캐시)                             | `skia/renderCommands.ts` `:903 ~ :930` · `:1606`                                                                   |
| `clip-context-changed` 거부 제거 — 조상 overflow 전환은 clip 노드 갱신 + 자손 hit bounds 재교차 + damage                                 | `skia/subtreeCommandPatch.ts` `:340 ~ :348` · `canvasBinding.ts` `geometryRegion` 의 「문맥이 바뀐 서브트리」 분기 |
| `SubtreeBuildContext.clipRect` 제거                                                                                                      | `skia/renderCommands.ts` `:800`                                                                                    |

- 동치 테스트 반례: overflow visible ↔ clip ↔ auto 전환 (기록 후 clip 상태만 바꾼 스트림 — `save − restore` 0 · 뒤 형제 픽셀 · r1 H1) · `clipBorderInset` 변경 · 조상 크기 변경으로 clip 이 줄어 hit bounds 가 비는 자식 (EMPTY_CLIP) · 옮긴 서브트리가 clip 을 가로지름 (ADR-264 r1 M3).
- 카운트: `rebindSpliceRejectedClipContext` → 0 · `translateMapWrites` 변동 (clipContext 쓰기가 빠지면 줄어야 — 늘면 설계 되돌림).

## 5. Phase 3 — transform 노드 (사용자 결정 1 뒤에만)

| 변경                                                                                                                               | 파일                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `ELEMENT_BEGIN.x · y` 제거 → `nodes.transform[id]` · 실행기 `translateStack` 이 테이블 읽음 · `cmd.transform` (matrix) 도 테이블로 | `skia/renderCommands.ts` `:1711` · `:2573 ~ :2690` |
| `applyTranslate` 의 `writeCommandAt` 제거 (명령 쓰기 0) · `SubtreeBuildContext.parentAbsX/Y` 제거                                  | `skia/subtreeTranslate.ts` `:195 ~ :199`           |
| `buildSelfCommandStream` 의 「명령 수가 같을 때 제자리 쓰기」 조건에서 좌표가 빠짐 (크기 · clip 만)                                | `skia/renderCommands.ts` `:1409 ~`                 |

- 진입 조건 (사용자 결정 1): Phase 1 · 2 뒤 옮김의 명령 쓰기 (root 1 줄) · 검사 (0) 에 남은 카운트가 없으면 이득은 구조 정합뿐 — 권고 종결.
- 카운트: 옮김의 `commandWrites` → 0 · HC4 `executeCommandRange` 변동 0.

## 6. 종결 (G3 · G4)

- production 짝 (같은 묶음 · 쌍 안 교대, 2 쌍 이상): 중첩 5k 편집 · `app-pages` 줌 · 편집 · (부류 있으면) 요소 스크롤 — p99 · drop · long task **회귀 0**. 참고 목표 ADR-263 HC2 — 미달이면 사용자 결정 3.
- live (G4): 사용자 프로젝트 — 요소 스크롤 (overflow:auto · 5k 행 ListBox) · 줌 · 카드 폭 편집 → undo · overflow 전환 · 옮긴 형제 클릭 · hover · drag · Compare Mode. 테이블 off oracle 과 0 px · 맵 · hit 동일. 콘솔 오류 0.
- 문서: 본문 `### Live Exercise` · README · CHANGELOG (Implemented 트리거) · 정본 `CHROMIUM_CANVAS_PARITY_2026-10.md` §0-4 · §3 property trees 행 (격차 → 동형) · §5-1 (결과) · 메모리 `project-adr269-*`.
- 4단계 입력: 남은 프로필 (절대 맵 갱신 · picture 재생 · page header) 을 §기록 에 — Rust 근거 재판정은 `CANVAS_RUST_DECISION_2026-10.md` §1.

## 파일 변경표 (추정 — Phase 0 에서 실측으로 고친다)

| 파일                                                          | Phase     | 변경                                                                                                                  |
| ------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `skia/renderCounters.ts`                                      | 0         | 카운터 6                                                                                                              |
| `skia/renderCommands.ts`                                      | 1 · 2 · 3 | 테이블 타입 · 기록 · 실행기 · `SubtreeBuildContext` · debug 전역                                                      |
| `skia/subtreeTranslate.ts`                                    | 1 · 3     | 검사 색인화 · Δ 기계 공유 (`applyScroll`) · 명령 쓰기 제거                                                            |
| `skia/subtreeCommandPatch.ts`                                 | 1 · 2     | 거부 사유 2 제거                                                                                                      |
| `catalogRuntime/canvasBinding.ts`                             | 0 · 1 · 2 | 사유별 재바인드 카운트 · `scrollBy` 경로 · 문맥 변경 분기 · `pendingProperty` · `propertyChanged` · scrollbar 판정 키 |
| `catalogRuntime/canvasScene.ts`                               | 1         | `sync()` 변경 판정에 `propertyChanged`                                                                                |
| `catalogRuntime/canvasOverflow.ts`                            | 1         | `catalogScrollbar` 를 실행 시점 파생에 쓰도록 입력 정리                                                               |
| `skia/propertyNodes.test.ts` (새)                             | 1 ~ 3     | 동치 · 반례 · 변이                                                                                                    |
| `apps/builder/scripts/perf-baseline.mjs`                      | 0         | `scroll` 부류 (사용자 결정 2)                                                                                         |
| `apps/builder/perf/ratchet.json`                              | 0 ~ 3     | 새 키 A · 하향                                                                                                        |
| `apps/builder/scripts/adr269-property-nodes-live.mjs` (새)    | 1 ~ 4     | live oracle                                                                                                           |
| `docs/explanation/research/CHROMIUM_CANVAS_PARITY_2026-10.md` | 종결      | §0-4 · §3 · §5-1                                                                                                      |

추정 12 파일 (Phase 3 포함 · r1 보완으로 +2). 1.5 배 초과는 Phase 0 inventory 보강으로 흡수 (adr-writing M3).

## 기록

- 2026-10-17 **Proposed** — 사용자 `/create-adr … -- ADR-269로 생성`. Context 의 카운트는 ratchet A 값 (`60:app-pages` 줌 `translateNodes` 222,268 · `translateCheckCommands` 917,005 · `600:nested-flex` 편집 `translateNodes` 5,280 · `scrollSubtreeVisits` 9,780) 과 ADR-264 · 265 · 266 종결 기록을 인용. 정본 §5-1 의 「옮김은 서브트리 명령을 다시 쓴다」 를 코드 (`applyTranslate` 는 root `ELEMENT_BEGIN` 1 줄 + 맵) 로 정정 — 같은 커밋에서 정본 §5-1 갱신.
- 2026-10-17 **r1 설계 보완** (`docs/adr/reviews/269.md` Round 1 HIGH 2) — H1: `CHILDREN_END` 의 구운 상태 (`hasScrollOffset` · `hasClip` · `scrollbar` · `scrollbarNode`) 를 BEGIN 과 같은 Phase 에서 제거하고 실행기의 열린 프레임 스택으로 닫음 · scrollbar 는 테이블의 offset · range 에서 실행 시점 파생 · dev 짝 assert · 반례 (0 ↔ 150 · clip 전환 · 뒤 형제 · thumbY 50) 를 G1 에. H2: `pendingProperty` → `update()` 1 회 소비 → `CatalogCanvasUpdate.propertyChanged` · damage 합집합 (full 우선) → `sync()` 가 `patched` 로 판정해 CatalogCanvas 의 content · overlay · cells 무효화를 그대로 탄다 · 문서 dirty 동시 · rebind 보존 반례를 G1 에. 수리 검증 (Round 2) 대기.
- 2026-10-17 **Accepted** — 사용자 `/execute-adr 269` + 리뷰 Round 2 pending 0. 사용자 결정 2 = **`scroll` 부류 신설 승인**.
- 2026-10-17 **Phase 0 (G0) — go**. 카운터 (`renderCounters.ts`): `scrollRecordCommands` · `scrollRecordCalls` (스크롤된 상자를 덮는 patch root 의 쓰기) · `rebindSpliceRejected{ClipContext,ScrollContext,Other}` (`canvasScene.ts` rebind 사유) · `translateMapWrites` (`applyTranslate` 맵 쓰기 + root 명령). `propertyNodeReads` 는 Phase 1 에서 생기는 비용이라 Phase 0 상한에 넣지 않았다. 하니스: fixture `scroll-boxes` (overflow:auto frame 720×360 > 카드 30 · ListBox 240×300 > 항목 300 — `perf-baseline.mjs`) + 부류 `scroll` (스크롤 상자를 차례로 선택하고 캔버스 위 실제 휠 ±40 · 20 번마다 방향 · 휠마다 1 rAF, 고정 188 회) · dev 핸들 `__COMPOSITION_CATALOG__.canvas.scrollable`. 2 회 실행 render 카운트 전부 같음 (다른 3 키는 원래 B 인 React · CDP). ratchet: `600:nested-flex` · `60:app-pages` 에 새 키 6 A 등록, 인위 회귀 (+1) 2 건 A 초과로 차단 확인.
  - 측정 (Phase 0 = 고치기 전): **`600:scroll-boxes` 휠 188 회 → `scrollRecordCommands` 575,844 (1 회 3,063) · `patchScanCommands` 1,151,688 · `pictureColdInvalidated` 94** (스크롤마다 ListBox 소유자 picture 가 node data 의 scrollbar · scrollOffset 때문에 무효) · `translateCheckCommands` `60:app-pages` 줌 917,005 · 편집 9,231 · `600:nested-flex` 20,310 (ADR-266 종결 값과 같음 — 재현) · `translateMapWrites` 890,049 (줌) · 21,258 (중첩 편집) · **`rebindSpliceRejected*` 전 run 0**.
  - 판정: 스크롤 재기록 · 검사 스캔은 크다 → **go** (Phase 1). 문맥 거부 재바인드는 하니스에서 0 — patch 는 늘 region root 의 저장 문맥으로 기록해 root 의 clip · scroll 문맥이 바뀌지 않는다 (조상의 overflow 전환은 그 조상이 region 이 된다). Phase 2 (clip 노드) 의 카운트 이득은 `translateMapWrites` 의 clipContext 몫뿐일 수 있다 — Phase 1 뒤 사용자 확인 (scope).
- 2026-10-17 **Phase 1 (G1 · G2) — scroll 노드 + 옮기기 검사 색인화**. 변경:
  - 테이블 `skia/propertyNodes.ts` (`scrollNodeOf` · `setScrollNode` · `scrollOffsetOf` — Skia 노드 registry 와 같은 키 · `clearSkiaRegistry` 가 같이 비움). `ScrollNode = { scrollTop, scrollLeft, bar? }` — `bar` 는 binding 이 offset · range 로 `catalogScrollbar` 한 값 (skia 층이 catalogRuntime 을 import 하지 않게 계산은 binding, 그리기는 실행기).
  - 명령: `CHILDREN_BEGIN { ownerId, clipChildren, width, height, clipBorderInset? }` (scrollOffset 제거) · `CHILDREN_END { ownerId }` (hasScrollOffset · scrollbar · scrollbarNode **와 clipChildren · hasClip** 제거 — 열린 프레임 스택이 clip 도 들고 있어 Phase 2 몫을 앞당김). node data (`SkiaNodeData`) 의 `scrollOffset` · `scrollbar` 와 생산자 없던 `buildBoxNodeData` 의 `scrollState` · `buildScrollNodeFields` 삭제 (production 은 binding 하나 — 두 정본 금지).
  - 기록: `visitElement` 가 자식 abs 좌표 · sticky offset 을 테이블에서 읽는다 (R4 — ADR-267 sticky clamp 입력이 scroll 노드 하나). scroll 문맥 키는 **구조만** (`|scroll:${id}` — 위치를 빼 스크롤마다 자손 저장 문맥이 낡지 않음) — `SubtreeBuildContext.scrollContextKey` 는 `|self:fixed` 판정에 쓰여 `parentId` 로 바꾸지 않고 남겼다 (계획과 다름).
  - 색인 `stream.childElementIds` (기록 · patch 병합 · 자기 patch 는 구조 불변이라 유지). `checkTranslate` 가 색인으로 pre-order walk — 명령 스캔 0.
  - 실행기: `childrenFrameStack` (BEGIN 이 연 clip · scroll 만 END 가 닫음) · scrollbar 는 END 가 테이블 `bar` 로 · 짝 assert 는 production 밖 전부 (`NODE_ENV !== "production"` — 시험에서도 RED).
  - binding: `withScrollbar` 가 node data 대신 테이블에 쓴다 · 재등록 판정 키 `scrollbars` = 범위 JSON (thumb 제외) · `scrollBy` → `placeScroll` = 테이블 갱신 + `applyScrollDelta` (자식마다 `checkTranslate` → `applyTranslate(keepCommand)` — 맵 Δ 기계 공유, 비용은 `scrollDelta*` 로 따로 셈) · sticky 를 담은 자식은 저장 문맥만 새 위치로 고치고 다음 update 에서 seed 로 다시 기록 (`scrollSeeds`) · drag offset · top layer 면 null → 옛 길 (소유자 dirty). `pendingProperty { owners, damage, full }` → `update()` 가 1 회 소비 → `CatalogCanvasUpdate.propertyChanged` · damage 합집합 (unsafe 면 full 우선) → `CatalogCanvasScene.sync()` 가 `propertyChanged` 도 변경으로 판정. 맵 Δ 는 휠 시점에 바로 적용 (같은 프레임 patch 는 테이블 · 옮겨진 저장 문맥에서 처음부터 기록 — 이중 적용 없음). commit lane 의 `scroll-context-changed` 거부 삭제 (presentation lane 은 구조 키 비교로 남김 — 시험 전용).
  - dev 스위치 `__composition_RENDER_PATH_DEBUG__.setPropertyNodesOff` (옛 길 — 소유자 서브트리 재기록).
  - R5 (가상화 행) 해당 없음: Canvas 에 행 창이 없다 — 바운드 행은 전부 record 이고 (`catalogBoundRows`), 높이 무제한 소유자만 `rowSample` 뒤를 숨긴다 (`rowSample.ts`). 스크롤로 행 집합이 바뀌지 않는다.
- Phase 1 검증:
  - G1 동치: `subtreeTranslate.test.ts` 무작위 트리 1,200 (상자 하나를 세 번 스크롤 → 명령 byte 불변 · span · bounds · hit · clipContext · buildContext · SpatialIndex 가 같은 위치로 처음부터 기록한 것과 같음 · damage 가 old ∪ new hit 포함) · 스크롤 + 옮김 300 · drag offset 중 null · 색인 walk = 기록 요소 전부 (300). `renderCommands.test.ts` r1 H1 반례 4 (0 → 150 · 150 → 0 — `save − restore` 0 · 형제 깊이 같음 / 중첩 안쪽만 / thumbY 50 = 테이블 / 짝 어긋남 throw 2). `phase4eCanvasOverflowBinding.test.ts` r1 H2 반례 7 (실제 `CatalogCanvasScene.sync` — property-only `patched` · damage = 소유자 hit · 명령 불변 · 재소비 0 / wheel 3 회 합산 + rebuild 동치 / 같은 프레임 편집 + 스크롤 rebuild 동치 / transform 자식 full 우선 / off 스위치와 같은 맵 / 무관한 편집이 소유자 재기록 안 함 / sticky ListBox — 섹션만 재기록 + rebuild 동치).
  - 원복 변이 RED 6/7: 테이블 미갱신 4 FAIL · sync 가 `propertyChanged` 무시 3 · unsafe 를 full 로 안 올림 1 · END 가 clip frame 무시 3 · Δ 생략 (맵 stale) 6 · bar 를 옛 위치로 1. GREEN 1 = END 가 프레임 대신 테이블을 읽는 변이 — 한 실행 안에서 테이블이 바뀌지 않아 BEGIN · END 가 같은 값을 본다 (결함 아님). r1 H1 의 「END 가 기록 값으로 닫음」 은 필드 삭제로 타입상 표현 불가.
  - builder 전체 unit 5,985 (실패 0 — 업데이트 모양 기대값 2 건에 `propertyChanged: []` 추가) · type-check 통과.
  - G2 카운트 (Phase 1 = 고친 뒤, `--fixed-inputs` 2 회 같은 값): **`600:scroll-boxes` 휠 188 회 `scrollRecordCommands` 575,844 → 0 · `patchWrites` 575,844 → 0 · `patchScanCommands` 1,151,688 → 0 · picture miss 94 → 0** (hit 6,109 → 6,203 — 같은 조회 수) · `execVisited` 21,160 → 21,066. 남는 비용 (O(1) 아님): `scrollDeltaNodes` 143,820 · `scrollDeltaMapWrites` 575,280 · `propertyNodeReads` 144,196. **`translateCheckCommands` → 0** (`60:app-pages` 줌 917,005 · 편집 9,231 · `600:nested-flex` 20,310 · `60:sticky-lists` 5,700 · `600` 줌 42) — 대신 색인 walk `propertyNodeReads` 223,086 (줌) · 5,295 (중첩). `translateMapWrites` 그대로 (890,049 · 21,258). HC4: 기존 A 키 증가 0 (hover · drag · pan · select · page-switch 포함) — 새 키 `propertyNodeReads` 는 pan 4 · drag 180 (명령 필드 읽기를 대체한 테이블 조회). `600:scroll-boxes` run 은 이 변경에서 처음 등록하는 run 이라 Phase 1 값 2 회로 등록했다 — Phase 0 값 (위) 으로 판정하면 A 초과로 막힌다 (원복 RED).
  - live (`adr269-property-nodes-live.mjs`, headless Chrome · dev 5173): 스크롤 상자 (안에 clip 상자 · 중첩 스크롤 상자) · sticky 머리 ListBox · 뒤 형제 — 실제 휠마다 화면 · bounds · hit · 모든 hit 중심의 `hitAt` 후보를 `rebind()` oracle 과 비교 **8/8 PASS (0 px · 맵 0 차)**: 휠 ×3 · 끝까지 (clamp) · 중첩 안쪽만 · sticky ListBox (섹션 6 재기록 · 180 명령) · 스크롤된 상자 안 편집 · undo · 위로 · 스크롤 뒤 보이는 항목 클릭 → 그 항목 선택. 재기록 명령: 새 길 0 · 0 · 0 · 180 / 대조군 (`PROPERTY_NODES_OFF=1`, 8/8) 189 · 63 · 40 · 190. picture 무효화 0 (대조군 3 · 1 · 2 · 2). 콘솔 오류 0.
  - ratchet 확정: `600:scroll-boxes` run (Phase 1 값 2 회 — render · caches 키 전부 같음) · 새 키 A (`propertyNodeReads` · `scrollDelta*` 6 — 전 run, Phase 0 키 6 — `60` · `600` · `60:sticky-lists` 에도) · `--update` 하향 7 (`translateCheckCommands` 5 → 0 등). 원복 RED: Phase 0 (고치기 전) 결과로 판정하면 **A 초과 13** (`scrollRecordCommands` 0 → 575,844 · `patchScanCommands` 0 → 1,151,688 · `translateCheckCommands` 0 → 917,005 · picture miss 0 → 94 …) 으로 막힌다. `codex:preflight` FAIL 0 · `docs:stale-symbols` 0.
  - 실제 파일: 제품 12 (`propertyNodes.ts` 새 · `renderCommands.ts` · `renderCounters.ts` · `subtreeTranslate.ts` · `subtreeCommandPatch.ts` · `useSkiaNode.ts` · `nodeRendererShapes.ts` · `nodeRendererTypes.ts` · `buildBoxNodeData.ts` · `canvasBinding.ts` · `canvasScene.ts` · `CatalogCanvas.tsx` dev 핸들) · 시험 6 · 하니스 · live 2 · ratchet · 규칙 2. 계획 12 대비 1.5 배 안 (`canvasOverflow.ts` 는 바꾸지 않음 — 스크롤바 계산은 binding 이 그대로 부른다).
- 2026-10-17 **Phase 2 생략 · Phase 3 미진입 (사용자 확인 · 결정 1)** — Phase 2: clip 문맥 거부 재바인드가 Phase 0 전 run 0 이라 닫는 카운트가 이미 충족, 남는 이득은 옮기기 맵 쓰기의 clipContext 몫뿐 → 「측정 기록으로 생략」 (END 의 clip 필드는 Phase 1 에서 이미 지움). Phase 3: 옮김의 명령 쓰기는 root 1 줄 (`app-pages` 줌 977 회) · 검사 스캔 0 → 결정 1 「측정 기록으로 종결」.
- 2026-10-17 **G3 production 짝** (기준 = `.cache/perf-ratchet/wt` 를 HEAD `cb0558f04` 로 맞춘 worktree 의 `perf:build-dist` → `/private/tmp/adr269-base-dist` · 수정 = 작업 트리 빌드 (dirty 27 = 이 ADR) · `--serve-dist` headless 60Hz 1440×900 DPR 1 · `--fixed-inputs` · 교대 2 쌍 (기준 → 수정 → 수정 → 기준) · 페이지 오류 0 / 12): main thread taskMs — 요소 스크롤 5k (`scroll-boxes`) **3,385 · 3,360 → 1,942 · 1,976** · `app-pages` 줌 1,456 · 1,474 → 1,438 · 1,497 · 편집 324 · 310 → 313 · 290 · 중첩 5k 편집 387 · 388 → 399 · 398 (+3 %, 편집당 ≈ 0.8 ms — 원인 미확정, 수정 중 `checkTranslate` 노드 조회 1 회 · 자식 색인 배열 1 개로 줄였으나 측정은 그 뒤 값). 화면 표시 간격 (RAF timestamp) p99 전부 16.8 · 25 ms 초과 기준 0 ~ 3 / 수정 0 ~ 1 · long task 0 → **회귀 0**. 하니스 콜백 gap 기준 p99 23 ~ 27 (기준 arm 과 같은 폭) — ADR-263 HC2 참고 목표 (≤ 20 · < 1 %) 미달 → 사용자 결정 3 = **측정 기록으로 종결**. 스크롤 콜백 drop 2.7 → 12.9 % 는 휠 1 회 → rAF 왕복 드라이버 박자 (표시 간격 초과는 1 → 0) — 하니스가 「실제 presentation 과 다르다」 고 적은 지표. 첫 짝은 기준 빌드에 dev 핸들 `canvas.scrollable` 이 없어 scroll 기준 arm 이 멈췄다 → 하니스가 핸들 없으면 검사를 건너뛰게 고쳐 다시 쟀다.
- 2026-10-17 **G4 live** — 사용자 프로젝트 「123」 (22 페이지 · record 5,116 · 스크롤 상자 27 — 대부분 page body), 사용자 Chrome (Chrome MCP, visible): 「Contact」 body 휠 3 칸 → 재기록 0 · 맵 Δ 155 · 5,116 요소 bounds · hit · `hitAt` 후보 = `rebind()` (키별 0 차) · 옛 길 휠 1 회 재기록 574 (결과 키별 0 차 — 전체 JSON 비교는 patch 가 Map 삽입 순서를 바꿔 달랐다) · 스크롤된 페이지 안 편집 · undo 0 차 · 콘솔 오류 0. 「adr267 sticky」 프로젝트의 첫 휠은 Settings 패널 위에 떨어져 스크롤이 없었다 (카운터 0 — 결과에서 뺌).
- 2026-10-17 **Implemented** — 남은 비용 자리 (4단계 입력): 스크롤 · 옮김의 자손 맵 Δ (`scrollDeltaNodes` · `translateMapWrites` 890,049 — 요소당 3 ~ 4 쓰기 + SpatialIndex upsert) · 중첩 편집 taskMs +3 % · page header 배치 · picture 재생 (ADR-266 그대로). Rust 근거 재판정 없음 — 위 비용은 JS 맵 갱신이다.
- 2026-10-17 **Compare Mode 확인** (사용자 지시) — 「123」 Contact · Compare Mode + 현재 페이지만 · 사용자 Chrome: Canvas body 휠 → 200 · Preview 같은 200 → 같은 id 요소 121 개 이동량 차이 0 · 위치 차이 세로 0 / 가로 ≤ 0.04 px · 끝 276 = 276 · 콘솔 오류 0.
