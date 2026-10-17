# ADR-269: 그리기 명령의 transform · clip · scroll 문맥을 property node 로 분리 — 이동 · 스크롤에서 명령 재기록 0 (Canvas 성능 계획 5단계)

## Status

Implemented — 2026-10-17 (Phase 0 · 1. Phase 2 는 사용자 확인으로 생략 — 측정 기록, Phase 3 은 사용자 결정 1 「측정 기록으로 종결」, 종결은 사용자 결정 3 「측정 기록으로 종결」)

- Accepted — 2026-10-17 (사용자 `/execute-adr 269` + [reviews/269.md](../reviews/269.md) Round 2 pending 0 · HIGH 전부 fixed). 사용자 결정 2 = **`scroll` 부류 신설 승인** (2026-10-17).

> **종결 (2026-10-17):** G3 production 짝 (기준 = HEAD `cb0558f04` worktree 빌드 ↔ 수정 = 작업 트리 빌드, `--serve-dist` headless 60Hz · DPR 1 · `--fixed-inputs`, 교대 2 쌍, 페이지 오류 0 / 12): **요소 스크롤 5k main thread 3,385 · 3,360 → 1,942 · 1,976 ms** · `app-pages` 줌 1,456 · 1,474 → 1,438 · 1,497 · 편집 324 · 310 → 313 · 290 · 중첩 5k 편집 387 · 388 → 399 · 398 (+3 %, 원인 미확정). 화면 표시 간격 (RAF timestamp) p99 은 전부 16.8 (25 ms 초과 0 ~ 1 회 — 기준과 같거나 적음) · long task 0 — **회귀 0**. 하니스 콜백 p99 23 ~ 27 · drop 은 기준과 같은 폭이고 (스크롤 drop 2.7 → 12.9 % 는 콜백 박자 — 표시 간격 초과는 1 → 0), ADR-263 HC2 참고 목표 미달 → 사용자 결정 3 = 측정 기록으로 종결. Phase 2 (clip 노드) 는 Phase 0 에서 clip 문맥 거부 재바인드가 전 run 0 이라 사용자 확인으로 생략, Phase 3 (transform 노드) 은 옮김 명령 쓰기가 root 1 줄 (줌 977 회) 뿐이라 결정 1 로 미진입. G4 live 는 아래.

- 사용자 요청: `/create-adr 그리기 명령에서 transform · clip · scroll 문맥을 property node 로 분리 (O1) — ELEMENT_BEGIN 이 (x,y) 대신 transformNodeId · 레이아웃 이동 = 노드 테이블 갱신 · ADR-264/265 종결 카운트가 Context · O(1) 주장 금지 (Canvas 성능 계획 5단계) -- ADR-269로 생성` (2026-10-17)
- 방향을 정한 사용자 원문: 「CHROMIUM_CANVAS_PARITY_2026-10.md 이 항목들은 설계문서로 다시 작성해야하나」 → 「전체 작성해야하는 ADR은 몇개가 되지」 → 「확정3개 create-adr 제목 모두 정해줘」 (2026-10-17). Chromium 대조 정본 [CHROMIUM_CANVAS_PARITY_2026-10.md](../../explanation/research/CHROMIUM_CANVAS_PARITY_2026-10.md) 가 ADR 이 필요하다고 적은 확정 3 건 (X8 = [ADR-267](267-sticky-fixed-position-canvas-engine.md) · F4 = [ADR-268](268-flex-row-definite-content-size-suggestion.md) · **O1**) 의 셋째. 번호 269 는 사용자 지정.
- 이미 정해진 것 (요청 원문 · 정본 §5-1): **O(1) 주장 금지** — 명령 재기록이 줄어도 절대 맵 · 누적 transform · draw/hit/overlay 동기화 · SpatialIndex upsert 비용은 남는다. 전체 동작의 비용으로 평가하고 비용이 pick · 다음 프레임으로 옮겨 가지 않았는지 본다. **측정이 설계보다 먼저** (ADR-263 ~ 266 과 같은 규율 — 카운트 RED → 수정 → ratchet 하향을 같은 커밋에, measurement-validity §5). Context 의 측정은 ADR-264 · 265 · 266 종결 카운트를 인용하고 조건이 같은 범위는 다시 재지 않는다. wall-clock 은 production 짝만 인용한다. Rust 이관은 대안으로 두되 trigger 2 · 3 미충족 (ADR-266 종결 · [CANVAS_RUST_DECISION_2026-10.md](../../explanation/research/CANVAS_RUST_DECISION_2026-10.md) §1 재판정) 이라 고르지 않는다. 기존 성능 기록의 nested edit · zoom 재바인드 · React/RAC selection 비용은 별도 원인으로 유지한다 — property node 가 모든 꼬리를 해결한다고 가정하지 않는다.
- 리뷰: [reviews/269.md](../reviews/269.md) Round 1 HIGH 2 → Round 2 설계 수리 검증.

> **Phase 0 · 1 (2026-10-17):** Phase 0 **go** — 새 부류 `scroll` (fixture `scroll-boxes`, 사용자 결정 2) 에서 휠 188 회가 명령 575,844 개를 다시 기록 (1 회 3,063) · `patchScanCommands` 1,151,688 · 소유자 picture 무효 94, `translateCheckCommands` 917,005 (`app-pages` 줌) 재현, 문맥 거부 재바인드는 전 run 0. Phase 1 — scroll 위치를 property node 테이블 (`skia/propertyNodes.ts`) 로 옮기고 명령 · node data 에서 지움, 실행기는 열린 프레임 스택으로 닫고 scrollbar 는 테이블에서, 스크롤 = 테이블 갱신 + 자손 맵 Δ (`applyScrollDelta`) + `propertyChanged` 발행 (r1 H2), 옮기기 검사는 자식 색인 walk. 결과: **스크롤 재기록 575,844 → 0 · `patchScanCommands` → 0 · picture miss 94 → 0 · `translateCheckCommands` → 0 (5 run)**, 남는 비용은 맵 Δ (`scrollDeltaNodes` 143,820 · 맵 쓰기 575,280 — O(1) 아님) 와 색인 walk (`propertyNodeReads`). 기존 A 키 증가 0 (HC4). G1: 무작위 1,200 스크롤 동치 · r1 H1 4 · H2 7 반례 · 원복 RED 6/7 (GREEN 1 은 결함 아님) · unit 5,985 실패 0. live 8/8 (0 px · 맵 · `hitAt` = rebind, 대조군 off 8/8). 상세: [breakdown §기록](../design/269-render-command-property-node-separation-breakdown.md#기록).

> **Round 2 수리 검증 (codex, 2026-10-17):** H1·H2 설계 closed, 신규 HIGH/MEDIUM 0 · pending 0 — 설계 승인 가능. 종료 프레임·scrollbar 파생 및 property 변경 발행 계약을 현행 소비 경로와 대조하고 수리 모델·조건식 프로브 13/13 PASS. 제품 구현·Builder/Preview 픽셀·production 성능·ratchet 집행은 UNVERIFIED. [리뷰 기록](../reviews/269.md#round-2). Proposed 유지.

Related: [ADR-263 그리기 명령 패치·실행 비용](263-render-command-patch-execute-cost.md) (명령 스트림 · damage · 컬링의 현재 모양 — 대안 B · C · D 의 기각은 이 ADR 과 다른 축) · [ADR-264 이동만 한 서브트리의 patch 축소](264-moved-subtree-translate-page-grid-rebind.md) (`translateSubtree` — 이 ADR 이 그 남은 상수 비용을 받는다 · 대안 B 「지연 절대 맵」 의 기각 사유는 여기서도 유효) · [ADR-265 문서 층 비용](265-document-layer-edit-select-cost.md) (HC2 꼬리 = Canvas binding 옮김 상수 비용이라는 카운트) · [ADR-266 그리기 캐시 thrash](266-draw-cache-thrash-real-document-zoom-edit.md) (종결 뒤 남은 프로필 — 옮기기 검사 3.9 % · 명령 실행 2.8 % · page header 3.6 %) · [ADR-189 커밋 레인 record 증분화](189-commit-lane-incremental-record.md) (명령이 부모 기준 좌표인 이유 · subtree splice · damage 의 원 결정) · [ADR-153 측정 우선 렌더 최적화](153-render-optimization-measurement-first-adoption.md) (노드 picture 캐시 — 위치가 키에 없다) · [ADR-267 sticky · fixed](267-sticky-fixed-position-canvas-engine.md) (렌더가 scroll container 오프셋으로 clamp — 이 ADR 의 scroll 노드가 그 입력 하나가 된다) · [ADR-246 카운트 ratchet](246-deterministic-count-ratchet-and-begin-frame-harness.md) (집행 수단) · [Chromium 대조 정본](../../explanation/research/CHROMIUM_CANVAS_PARITY_2026-10.md) §3 property trees 행 · §5 · §5-1 O1

## Context

### 문제 — 종결 세 번 뒤에도 남은 Canvas 꼬리는 「문맥이 명령에 구워져 있다」 는 한 자리에서 나온다

ADR-263 → 264 → 265 → 266 이 그리기 명령 실행 · patch 영역 · 문서 층 · 캐시 thrash 를 차례로 닫았다. 남은 것 (production 짝, 2026-10-16 ~ 17):

| 시나리오 (prod)                         | 종결 수치                                                    | 닫는 조건         | 남은 비용의 자리 (카운트 · 프로필)                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 중첩 5k 편집 (`pnw5000`, ADR-264 · 265) | p99 24 ~ 26 ms · drop 1.0 ~ 2.1 %                            | ≤ 20 · < 1 % 미달 | Canvas binding 의 옮김 상수 비용 — 옮겨진 상자마다 `subtreeTranslate` 맵 갱신 · overflow clip 복제 · rect diff (ADR-265 Phase 0: 600 → 5k 에서 6 ~ 8 배) |
| `app-pages` 줌 (ADR-266, headless)      | p99 24 ~ 27 · drop 1.1 ~ 1.7 % (headed 는 충족, long task 0) | ≤ 20 · < 1 % 미달 | `checkTranslate` 3.9 % · `executeCommandRange` 2.8 % · page header 배치 3.6 % · `buildDamageRenderCommandSequence` 1.4 % (idle 67.7 %)                   |
| `app-pages` 편집 (ADR-266)              | p99 18 ~ 25 (기준 arm 21 ~ 23 — 회차 폭이 커 판정 불가)      | ≤ 20 · < 1 %      | 같은 자리 (옮기기 · damage)                                                                                                                              |

ADR-266 은 「한 자리가 지배하지 않는다」 고 종결했다. 이 ADR 은 그 여러 작은 자리 가운데 **같은 원인을 가진 것들** 을 묶는다 — 명령 스트림이 transform (위치) · clip · scroll 문맥을 명령 안에 들고 있어서, 문맥만 바뀌는 동작 (옮김 · 스크롤 · clip 변경) 이 명령 · 맵 · 검사를 건드린다.

### 코드 사실 — 무엇이 어디에 구워져 있고, 그래서 어떤 동작이 무엇을 다시 쓰는가

1. **위치는 `ELEMENT_BEGIN` 에, 스크롤은 `CHILDREN_BEGIN` 에, clip 은 둘 다에.** 기록 (`apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`): `ELEMENT_BEGIN` 은 부모 기준 `x · y` (`:1711`, ADR-189), `CHILDREN_BEGIN` 은 `clipChildren · width · height · clipBorderInset · scrollOffset` (`:1781`). 자식의 절대 좌표 맵은 부모의 scroll 을 뺀 값으로 쓴다 (`absX - scrollX` `:1808 · :1822`). 실행 (`executeRenderCommands` `:2573 ~`) 은 `translateStack` 에 `parent + cmd.x` 를 쌓고 `CHILDREN_BEGIN` 에서 `canvas.translate(-scroll)` 과 스택 보정을 한다 (`:2893 ~ :2914`). 노드 picture 는 **노드-로컬** 로 기록되고 위치는 키에 없다 (`nodePictureCache.ts:17`) — 그리기 자체는 이미 문맥과 분리돼 있다.
2. **옮김은 명령을 다시 쓰지 않는다 — 맵을 다시 쓴다.** `subtreeTranslate.ts` `applyTranslate` (`:183 ~ :275`) 는 root 의 `ELEMENT_BEGIN` 한 줄만 고치고 (자손 명령은 byte 그대로), 서브트리의 **모든 요소** 에 대해 `boundsMap` · `clipContextByElement` · `subtreeBuildContextByElement` · `hitBoundsMap` 을 갱신하고 SpatialIndex 를 upsert 한다 — 요소당 객체 4 ~ 5 개 생성 + clip 재교차. 그 앞의 `checkTranslate` (`:100 ~ :150`) 는 서브트리 **명령 전부** 를 훑어 top layer · fixed/sticky · unsafe 를 판정한다 (`translateCheckCommands`). 정본 §5-1 의 「옮김은 서브트리 명령을 다시 쓴다」 는 이 점에서 부정확하다 — 이 ADR 이 정정한다 (§0-4 갱신).
   - 카운트 (ratchet A, dev `--fixed-inputs` 2 회 같은 값): `60:app-pages` 줌 `translateCalls` 977 · `translateNodes` **222,268** · `translateIndexUpserts` 86,317 · `translateCheckCommands` **917,005** (ADR-266 4-1 뒤) · 편집 `translateNodes` 2,514 · `translateCheckCommands` 9,231. `600:nested-flex` 편집 `translateCalls` 138 · `translateNodes` 5,280 · `translateIndexUpserts` 2,079 · `translateCheckCommands` 20,310.
3. **스크롤은 소유자 서브트리를 다시 기록한다.** 요소 스크롤 (`CatalogCanvas.tsx:914` → `scene.scrollBy` → `canvasBinding.ts` `scrollBy` `:2443 ~ :2465`) 은 오프셋을 `offsets` 에 쓰고 소유자를 `dirty` 에 넣는다. 다음 update 는 그 노드 데이터 (`scrollOffset`) 가 바뀐 seed 로 보고 **소유자 서브트리를 통째로** `buildSubtreeCommandStream` → `applyCommitSubtreeCommandPatch` 로 바꾼다 — 자식 수에 비례하는 명령 · 맵 재생성이 스크롤 프레임마다 일어난다. 스크롤 범위도 자손 extent 를 다시 모은다 (`canvasOverflow.ts:50` `catalogScrollRange` — `scrollRangeVisits` `600:nested-flex` 편집 3,624 · `scrollSubtreeVisits` 9,780, `60:app-pages` 편집 1,896 · 4,884). 하니스에 **요소 스크롤 부류가 없다** (`perf-baseline.mjs` 의 부류는 `layers-scroll` 만) — 이 비용은 아직 ratchet 에 잡히지 않는다.
4. **문맥이 바뀐 patch 는 거부되어 scene 전체 재바인드로 간다.** `subtreeCommandPatch.ts` 는 root 의 clip 문맥 (`:340 ~ :348` `clip-context-changed`) · scroll 문맥 키 (`:350 ~ :360` `scroll-context-changed`) 가 다르면 거부하고, `canvasBinding.ts:2395` 는 거부를 `rebind("splice-rejected:…")` 로 돌린다 — 조상의 overflow 가 clip 으로 바뀌거나 스크롤된 조상 아래에서 편집하면 문서 전체를 다시 묶는다. `SubtreeBuildContext` (`renderCommands.ts:797 ~ :807`) 가 `parentAbsX/Y · clipRect · zOrderKey · scrollContextKey` 를 **값으로** 들고 있어서 문맥 변경 = 저장된 값 전부 무효다.
5. **Chromium 은 이 넷을 property tree 로 뺀다.** `cc` 의 transform · clip · effect · scroll 노드 트리 (`how_cc_works.md` §property trees) 와 Blink `PaintChunk` 의 `PropertyTreeState` 참조 (`paint_chunk.h:35-39`, 고정 SHA `33688427bc1a316cecb28d5651ad25208ba9ab53`) — 스크롤 · 이동 · clip 변경은 노드 값 갱신이고 그리기 목록은 손대지 않는다. composition 은 §3 대응표에서 display list · item 캐시 · raster invalidation · interest rect · bbox 컬링이 동형이고 **property tree 하나가 격차** 다 (정본 §3 행 「property trees」 · §5-1 O1).

### 이 ADR 이 다루지 않는 것

- 절대 좌표 맵 (`boundsMap` · `hitBoundsMap`) 자체를 없애거나 지연 계산으로 바꾸는 것 — ADR-264 대안 B 의 기각 사유 (overlay · picking · 측정 · 하니스 소비자 20+ · SpatialIndex 는 어차피 절대값 upsert) 가 그대로다. 이 ADR 의 노드 테이블은 **명령 · 검사 · patch 거부** 쪽의 문맥 소유자이고, 절대 맵은 테이블에서 **파생 갱신** 된다 (옮김의 맵 갱신 비용은 남는다 — O(1) 주장 금지).
- React · RAC Layers 행 렌더 (ADR-265 HC3 꼬리) · page header DOM 배치 (ADR-266 프로필 3.6 %) · picture 재생 수 (ADR-266 대안 B 의 묶음 picture) — 다른 원인.
- 그리기 결과 · D3 대칭: 바뀌는 것은 Canvas 내부 자료구조와 갱신 경로다. 픽셀 · 히트 · 맵은 전체 재구축과 같아야 한다 (G1). D1 · D2 무관.

### Hard constraints

- **HC1 픽셀 · 맵 동일**: 테이블 경로의 결과 (픽셀 · `boundsMap` · `hitBoundsMap` · SpatialIndex 후보 · overlay 위치) 가 같은 상태의 전체 재구축 (`rebind` + 캐시 끔 + 선형) 과 0 차 — 기존 live oracle (`adr263-render-path-live.mjs` · `adr264-subtree-translate-live.mjs`, dev 전역 `__composition_RENDER_PATH_DEBUG__`) 에 테이블 경로 off 스위치를 더해 같은 방식으로.
- **HC2 카운트 먼저**: Phase 0 이 이 ADR 이 닿는 비용의 카운트를 등급 A 로 고정하고 (아래 §Phase 0), 수정과 같은 커밋에서 ratchet 상한이 내려간다 (ADR-246 · `--add-keys`). 원복 RED 는 ratchet `block` 으로.
- **HC3 wall-clock 은 방향만**: production 짝 (같은 묶음 · 쌍 안 순서 교대, ADR-265 교훈) 에서 중첩 5k 편집 · `app-pages` 줌 · 편집 · 요소 스크롤이 **회귀하지 않는다**. ADR-263 HC2 (≤ 20 ms · < 1 %) 는 참고 목표이고 이 ADR 의 종결 조건이 아니다 — 미달이면 사용자 결정 3.
- **HC4 비용 이동 금지**: pick (`hitAt`) · hover overlay · 다음 프레임의 카운트 (`counts.render.*` 의 hover · marquee · pan 부류) 가 늘지 않는다 — 테이블 갱신이 읽기 쪽으로 비용을 옮기면 Phase 0 기준선과의 차로 드러난다.
- **HC5 Skia 전용 시각 효과 0** (D3 대칭) · 문서 · 저장 형식 변경 0 (Canvas 내부 자료구조만).
- **HC6 WASM 힙 · picture 캐시 불변**: 노드 테이블은 JS 측 — picture 키 (node data + size) · paragraph 소유 (ADR-174) 에 손대지 않는다.

### Soft constraints

- ADR-267 (sticky) 과 같은 파일 (`renderCommands.ts` 기록 · 실행기의 sticky/fixed 분기 `:1647 ~ :1705`) 을 만진다 — 267 Phase 1 뒤에 착수하거나, 267 의 「렌더가 scroll container 오프셋으로 clamp」 를 이 ADR 의 scroll 노드에서 읽게 한다 (한 소스). 순서는 README 착수 순서표.
- 드래그 경로 (`dragSubtreeCache` · `getDragVisualOffset` · `getSiblingOffset` · page position delta — 실행기 `:2581 ~ :2607`) 는 좌표를 실행 시점에 더한다. 테이블 좌표와 **이중 적용** 이 되지 않도록 드래그 offset 은 테이블 밖 (지금처럼 실행 시점) 에 둔다.
- 하니스 · live oracle 은 ADR-263 ~ 266 의 것을 잇는다 (`perf-baseline.mjs` `counts.render` · `renderCounters.ts`). 새 부류 (요소 스크롤) 는 recorder 변경이라 사용자 승인 (ADR-265 선례).

## Alternatives Considered

외부 사례: Chromium cc property trees (transform · clip · effect · scroll 노드를 draw 목록에서 분리, layer 는 노드 id 참조 — 스크롤은 compositor 가 노드 오프셋만 갱신) · Blink `PaintChunk` + `PropertyTreeState` (chunk 가 노드를 참조, `PaintPropertyTreeBuilder` 가 레이아웃 뒤 트리를 갱신) · Flutter `Layer` 트리 (`TransformLayer` · `ClipRectLayer` · `OffsetLayer` 가 picture 를 자식으로, 이동은 layer 속성 변경) · Skia `SkPicture` 는 좌표를 담지 않고 재생 시 `canvas.translate` (이 저장소의 노드 picture 가 이미 이 모양).

### 대안 A — property node 테이블 (transform · clip · scroll) 을 단계적으로, 카운트가 가리키는 축부터

- 설명: 스트림 옆에 **노드 테이블** 을 둔다 — 요소마다 `transform` (부모 기준 x · y · 선택적 matrix) · `clip` (clipChildren · rect · borderInset) · `scroll` (offset) 노드. `ELEMENT_BEGIN` 은 `x · y` 대신 `transformNodeId`, `CHILDREN_BEGIN` 은 `clipNodeId · scrollNodeId` 를 들고, 실행기 · patcher · damage · `checkTranslate` · 옮기기가 **테이블을 읽는다**. 레이아웃 이동 = transform 노드 갱신 + 절대 맵 파생 갱신 (지금의 `applyTranslate` 맵 루프와 같은 비용 — 명령 쓰기 0 · 검사 스캔 0) + damage = 이전 ∪ 이후 bounds. 스크롤 = scroll 노드 오프셋 갱신 + 자손 절대 맵 Δ (옮기기와 같은 기계) + damage = 소유자 clip rect — **소유자 서브트리 재기록 0**. 조상 clip 변경 = clip 노드 갱신 + 자손 hit bounds 재교차 — `clip-context-changed` · `scroll-context-changed` 거부와 그 재바인드가 사라진다 (`SubtreeBuildContext` 가 값 대신 노드 id 를 든다). `checkTranslate` 는 명령을 훑지 않고 서브트리 요소 색인 (테이블의 자식 목록) 으로 top layer · fixed/sticky · unsafe 를 판정한다. **단계**: Phase 0 카운트 → Phase 1 scroll 노드 (가장 작은 변경 · 가장 분명한 재기록 제거) + 옮기기 검사의 색인화 → Phase 2 clip 노드 (거부 사유 2 소멸) → Phase 3 transform 노드 (`ELEMENT_BEGIN` 좌표 분리 — Phase 0 카운트가 옮김의 명령 쓰기 · 검사 비용이 꼬리에 있음을 보일 때만, 사용자 결정 1). 각 Phase 는 flag 없이 되돌릴 수 있는 국소 변경 + dev 전역 off 스위치 (live 대조용).
- 근거: Chromium · Flutter 가 같은 분리를 한다. 이 저장소의 노드 picture 가 이미 노드-로컬 + 재생 시 translate 라 그리기 쪽은 분리돼 있고, 남은 것은 명령 · 맵 · 검사 쪽이다.
- 위험: 기술 **M** (실행기 · patcher · damage · 옮기기 · 검사가 같은 테이블을 읽어야 한다 — 하나가 옛 값을 읽으면 stale pixel · 어긋난 hit; 동치 테스트 + live oracle 로 막는다) / 성능 **L ~ M** (테이블 조회가 실행 경로의 명령마다 한 번 더 — Phase 0 에 `executeCommandRange` 기준선, 늘면 Phase 3 보류) / 유지보수 **M** (문맥의 정본이 명령 → 테이블로 옮겨 가는 동안 두 곳을 읽는 코드가 공존 — Phase 마다 한 축을 끝내고 옛 필드를 지운다) / 마이그레이션 **L** (문서 · 저장 무변경, 메모리 안 구조만).

### 대안 B — scroll 노드만 (CHILDREN_BEGIN 의 scrollOffset 을 테이블로) · transform · clip 은 그대로

- 설명: 대안 A 의 Phase 1 만. 스크롤 재기록과 `scroll-context-changed` 거부를 없앤다.
- 근거: 측정된 꼬리 (옮기기 검사 · 맵 갱신) 에는 닿지 않지만 변경이 가장 작고 효과가 분명하다 (스크롤 프레임마다 소유자 서브트리 재기록 → 0).
- 위험: 기술 **L** / 성능 **L** / 유지보수 **L** / 마이그레이션 **L** — 다만 옮김 · clip 변경의 비용은 그대로라 ADR-264 · 265 · 266 이 넘긴 꼬리를 받지 못한다. 단독이면 「5단계」 가 아니라 스크롤 수리 한 커밋이다.

### 대안 C — 테이블 없이 상수 비용만: 옮기기 검사의 색인화 · 맵 갱신 batch · 스크롤 소유자 자기 명령만 재기록

- 설명: `checkTranslate` 가 서브트리 요소 색인 (`subtreeSpans` 와 함께 유지) 으로 판정 → `translateCheckCommands` 0. `applyTranslate` 의 요소당 객체 생성을 줄인다 (clip 복제 공유 · 맵 갱신을 한 패스로). 스크롤은 `buildSelfCommandStream` (ADR-264 경로 노드와 같은 기계) 으로 소유자 자기 명령만 다시 쓰고 자식은 옮기기로 Δ.
- 근거: 측정된 자리 (검사 3.9 % · 맵 갱신) 를 가장 적은 변경으로 건드린다. ADR-266 Phase 4-1 (검사 한 번) 의 연장.
- 위험: 기술 **L** / 성능 **L** / 유지보수 **M** (문맥이 여전히 명령 · 저장 문맥 값에 구워져 있어 `clip-context-changed` · `scroll-context-changed` 재바인드는 그대로 — 거부 조건을 늘릴 때마다 특수 경로가 늘어난다) / 마이그레이션 **L**. 복잡도 등급은 안 바뀐다 (요소당 상수만 줄인다) — ADR-264 대안 D 의 기각 사유와 같은 모양.

### 대안 D — 절대 좌표 맵의 지연 계산 (부모 기준 저장 · 읽을 때 조상 합산)

- 설명: ADR-264 대안 B. 옮김 · 스크롤이 root 한 줄 수정이 된다.
- 위험: 기술 **H** · 유지보수 **H** — ADR-264 기각 사유 그대로 (소비자 20+ · SpatialIndex 는 절대값 upsert 라 O(자손) 이 남는다 · 좌표계 두 벌). 재검토해도 바뀐 사실이 없다.

### 대안 E — 명령 스트림 · 맵 · 테이블 소유를 Rust/wasm 으로

- 설명: ADR-263 대안 D · ADR-264 대안 E · 4단계 판정의 몫.
- 위험: 기술 **H** · 유지보수 **H** · 마이그레이션 **H**. ADR-266 종결의 재판정 — JS ↔ wasm 경계 · 엔진 · CanvasKit wasm 은 프로필 상위에 없다 (각 1 % 내외), trigger 2 · 3 미충족 → **Rust 이관 ADR 을 열 근거 없음**. 고르지 않는다.

### Risk Threshold Check

| 대안 | HIGH+                          | 판정                                             |
| ---- | ------------------------------ | ------------------------------------------------ |
| A    | 없음 (기술 · 유지보수 M)       | 채택 후보 — 단계적 · Phase 3 은 카운트 게이트    |
| B    | 없음                           | A 의 Phase 1 로 흡수 (단독이면 꼬리를 받지 못함) |
| C    | 없음 — 복잡도 등급 불변        | A 의 Phase 1 에 검사 색인화만 흡수 · 나머지 기각 |
| D    | 기술 H · 유지보수 H            | 기각 (ADR-264 와 같은 사유)                      |
| E    | 기술 · 유지보수 · 마이그레이션 | 범위 밖 (4단계 재판정 — 근거 없음)               |

루프 불필요 — A 에 HIGH 없음. A 의 MEDIUM 둘은 같은 한 가지 (「테이블이 정본인가」) 로 모이고 G1 동치 테스트가 그것을 집행한다.

## Decision

**대안 A 를 단계적으로 채택한다** — Phase 0 카운트 → Phase 1 scroll 노드 + 옮기기 검사 색인화 → Phase 2 clip 노드 → Phase 3 transform 노드 (사용자 결정 1). 각 Phase 가 끝날 때 그 축의 문맥은 **테이블만** 이 정본이고 명령 · `SubtreeBuildContext` 의 같은 필드는 지운다 (두 정본 공존 금지).

- 위험 수용 근거: A 의 잔존 위험은 「테이블 · 명령 · 맵이 어긋나는 경우」 하나로 모이고, 그것은 동치 테스트 (무작위 트리 · 스크롤 · clip 변경 · 옮김 뒤 테이블 경로 == 전체 재구축) 와 live 픽셀 · 맵 · hit oracle 로 결정적으로 잡힌다. 각 Phase 는 off 스위치로 지금 동작으로 돌아간다. O(1) 을 주장하지 않는다 — Phase 0 기준선 대비 카운트 (재기록 명령 · 검사 스캔 · 재바인드) 가 0 이 되는 것이 닫는 조건이고 wall-clock 은 회귀 금지만이다.
- B 기각 (단독): 스크롤 수리 한 커밋이지 ADR-264 · 265 · 266 이 넘긴 꼬리를 받는 결정이 아니다 — Phase 1 로 흡수.
- C 기각 (대부분): 문맥을 명령에 둔 채 상수를 줄이면 거부 조건 · 특수 경로가 쌓인다. 검사 색인화만 Phase 1 에 흡수 — 테이블의 자식 목록이 그 색인이다.
- D 기각: ADR-264 와 같은 사유, 바뀐 사실 없음.
- E 범위 밖: 4단계 재판정이 근거 없음으로 끝났다.

> 구현 상세: [269-render-command-property-node-separation-breakdown.md](../design/269-render-command-property-node-separation-breakdown.md)

### 사용자 결정 3건

execute-adr 가 해당 항목에 닿을 때 묻는다 — 지금 질문하지 않는다.

1. **Phase 3 (transform 노드 — `ELEMENT_BEGIN` 좌표 분리) 진입**: Phase 0 · 1 · 2 뒤 카운트에서 옮김의 명령 쓰기 (root `ELEMENT_BEGIN` 1 줄 — 이미 작다) 와 검사 스캔 (Phase 1 로 0) 이 남지 않으면 Phase 3 의 이득은 「문맥이 한 자리에 있다」 는 구조 정합뿐이다. 진입 / 측정 기록으로 종결 (Phase 2 까지가 이 ADR) 가운데 고른다. 권고: 카운트에 이득이 없으면 **종결**.
2. **요소 스크롤 하니스 부류 신설** (`perf-baseline.mjs` recorder 변경 — ADR-265 선례상 승인 사항): `app-pages` 안 overflow:auto 상자 · 합성 5k 행 ListBox 의 휠 스크롤을 부류 `scroll` 로 등록하고 ratchet 에 싣는다. 승인 / 기존 `drag` 부류의 `scrollRangeVisits` 만으로 간다.
3. **종결에서 HC3 참고 목표 (ADR-263 HC2 ≤ 20 ms · < 1 %) 미달이면**: ADR-263 ~ 266 과 같은 형태 — 측정 기록으로 종결 (남은 비용 자리를 기록) / 남은 자리를 보고 Phase 추가. 권고: 카운트 조건 (재기록 0 · 스캔 0 · 재바인드 0) 이 충족됐으면 **측정 기록으로 종결**.

## Risks

| ID  | 위험                                                                                                                                                        | 심각도 | 대응                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 테이블 · 명령 · 절대 맵 · SpatialIndex 가 어긋난다 (실행기 · patcher · damage · 옮기기 · 검사 중 하나가 옛 값을 읽음) → stale pixel · 어긋난 hit · overlay  | **H**  | G1 동치 테스트 (무작위 1,200 + 스크롤 · clip · 옮김 반례) · live oracle (테이블 경로 off ↔ on 픽셀 · 맵 · `hitAt` 0 차) · Phase 마다 옛 필드 삭제 (두 정본 공존 금지)                                                  |
| R2  | 비용이 읽기 쪽으로 옮겨 간다 — 실행기의 테이블 조회 · pick · hover overlay 가 느려짐 (HC4)                                                                  | **M**  | Phase 0 에 `executeCommandRange` · hover · marquee · pan 부류 카운트 기준선, Phase 마다 비교 — 늘면 그 Phase 보류                                                                                                      |
| R3  | 드래그 offset (`getDragVisualOffset` · `getSiblingOffset` · page delta) 과 테이블 좌표의 이중 적용                                                          | **M**  | 드래그 offset 은 테이블 밖 (실행 시점 가산) 유지 — 드래그 중 live (ADR-264 live 의 drag 시나리오) + 동치 테스트에 drag offset 케이스                                                                                   |
| R4  | ADR-267 sticky clamp 가 읽는 scroll 오프셋과 이 ADR 의 scroll 노드가 두 소스가 된다                                                                         | **M**  | 267 Phase 1 뒤 착수하고 clamp 입력을 scroll 노드로 — 또는 267 이 뒤라면 267 이 scroll 노드를 읽는다 (README 착수 순서)                                                                                                 |
| R5  | 스크롤 소유자 재기록을 없애면 자식 **내용** 이 스크롤로 바뀌는 경우 (가상화 행 창 — ADR-150 ListBox · GridList · Table 의 window · spacer) 가 갱신되지 않음 | **M**  | 가상화 소유자는 행 집합 변경을 문서 dirty 로 따로 받는다 (`catalogBoundRows` 경로) — Phase 1 동치 테스트에 5k 행 ListBox 스크롤 (창 밖 → 안 행이 그려지는가) 포함, 아니면 그 소유자는 기존 재기록 경로 (`unsafe` 분류) |
| R6  | 문서 stale — 정본 §3 · §5-1 · ADR-263/264 본문의 「문맥 변경 = patch 거부」 서술이 Phase 2 뒤 틀린다                                                        |   L    | Phase 종결 커밋에 정본 §0-4 · §5-1 갱신 (이미 §5-1 의 「옮김이 명령을 다시 쓴다」 는 이 ADR Context 가 정정)                                                                                                           |

## Gates

| Gate | 시점            | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                | 실패 시 대안                                                                |
| ---- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| G0   | Phase 0 종결    | 새 카운터 (스크롤 1회 재기록 명령 · 사유별 `splice-rejected` 재바인드 · 옮기기 맵 쓰기 수 · 테이블 조회 수) 가 dev `--fixed-inputs` 2 회 같은 값 (등급 A) · `600:nested-flex` · `60:app-pages` (+ 사용자 결정 2 의 `scroll` 부류) 에 등록 · 인위 회귀 `block` · **go/no-go**: 이 ADR 이 닿는 비용의 카운트 합이 ADR-266 종결 프로필의 남은 자리와 맞는다 (옮기기 검사 · damage · 재기록) | no-go (닿는 비용이 다른 곳) → 측정 기록으로 Rejected · 꼬리는 다음 ADR 입력 |
| G1   | Phase 1 · 2 · 3 | 동치 테스트: 테이블 경로 결과 == 같은 상태의 전체 재구축 (픽셀 · `boundsMap` · `hitBoundsMap` · SpatialIndex 후보 · overlay rect) — 무작위 1,200 + 반례 (스크롤 · clip 전환 · 옮김 · drag offset · 가상화 행) · 원복 변이 RED (경로를 끄면 ratchet `block`) · live oracle 0 px (`__composition_RENDER_PATH_DEBUG__` 테이블 off 대조)                                                     | 해당 Phase 보류 · 옛 경로 유지 (off 스위치)                                 |
| G2   | 각 Phase        | 카운트: Phase 1 — 스크롤 1회 재기록 명령 0 · `translateCheckCommands` 0 · `scroll-context-changed` 재바인드 0 / Phase 2 — `clip-context-changed` 재바인드 0 / Phase 3 — 옮김의 명령 쓰기 0. 같은 커밋에서 ratchet 하향. **HC4**: hover · marquee · pan · select 부류 카운트 · `executeCommandRange` 기준선 대비 증가 0                                                                   | 증가하면 그 Phase 의 설계를 되돌리고 사유 기록                              |
| G3   | 종결            | production 짝 (같은 묶음 · 교대): 중첩 5k 편집 · `app-pages` 줌 · 편집 · (부류 있으면) 요소 스크롤이 **회귀 0** (p99 · drop · long task). 참고 목표 ADR-263 HC2 — 미달이면 사용자 결정 3                                                                                                                                                                                                 | 사용자 결정 3                                                               |
| G4   | Implemented     | `### Live Exercise` — 사용자 프로젝트 (22 페이지) 에서 요소 스크롤 (overflow:auto 상자 · 5k 행 ListBox) · 줌 · 카드 폭 편집 → undo · overflow 전환 (visible ↔ clip) · 옮긴 형제 클릭 · hover · drag — 테이블 off oracle 과 0 px · 맵 · hit 동일 (Chrome MCP) · 콘솔 오류 0                                                                                                               | 미달 항목 수리 뒤 재실행                                                    |

### Live Exercise

2026-10-17 — 두 갈래.

1. **사용자 프로젝트 「123」 (22 페이지 · record 5,116 · 스크롤 상자 27 — 대부분 page body overflow auto), 사용자 Chrome (Chrome MCP · visible · DPR 2 · dev 5173)**: 「Contact」 page body (1920×1080) 를 선택하고 실제 휠 3 칸 → 다시 기록한 명령 **0** · 자손 맵 Δ 155 · picture 무효화 0, 5,116 요소 전부의 bounds · hit · hit 중심 `hitAt` 후보가 `rebind()` oracle 과 **0 차**. 같은 조작을 옛 길 (`setPropertyNodesOff(true)`) 로 하면 휠 1 회에 **574** 개 재기록 · picture 무효 1 (결과는 키별 0 차). 스크롤된 페이지 안 frame padding 편집 → 0 차 (patch 6 명령) · undo → 0 차. 콘솔 오류 0. 문서는 undo 로 원래대로.
2. **`adr269-property-nodes-live.mjs`** (headless Chrome · dev 5173 · 새 프로젝트): 스크롤 상자 (안에 clip 상자 · 중첩 스크롤 상자) · sticky 머리 ListBox · 뒤 형제 — 실제 휠마다 화면 픽셀 · bounds · hit · `hitAt` 을 `rebind()` 와 비교 **8/8 PASS (0 px)**: 휠 ×3 · 끝까지 · 중첩 안쪽만 · sticky (섹션 6 재기록) · 스크롤된 상자 안 편집 · undo · 위로 · 스크롤 뒤 보이는 항목 클릭 → 그 항목 선택. 옛 길 대조군 8/8 (재기록 189 · 63 · 40 · 190).

3. **Compare Mode (사용자 지시 「compare mode에서 확인해」, 2026-10-17)** — 「123」 Contact 페이지 · Compare Mode + 현재 페이지만, 사용자 Chrome: Canvas 쪽에서 body 를 실제 휠 2 칸 → Canvas 스크롤 200 (자손 155 개 전부 정확히 200 이동 · 재기록 0 · 맵 Δ 155) → Preview 문서를 같은 200 으로 스크롤해 `data-catalog-id` 가 같은 요소 **121 개** 대조: 이동량 차이 0 · 스크롤 뒤 위치 차이 세로 0 · 가로 최대 0.04 px. 끝까지 휠 → Canvas 범위 끝 276 = Preview `scrollTop` 끝 276, 그 위치에서도 121 개 세로 0 · 가로 0.04 px. 콘솔 오류 0. 확인 뒤 Skia Only 로 되돌렸다.

## Consequences

### Positive

- 스크롤 프레임이 소유자 서브트리를 다시 기록하지 않는다 — 자식 수와 무관한 오프셋 갱신 + 맵 Δ (맵 Δ 는 자손 수 비례로 남는다).
- 조상 clip · scroll 문맥 변경이 scene 전체 재바인드 (`splice-rejected`) 로 가지 않는다 — ADR-264 가 넘긴 「문맥이 바뀐 서브트리는 재기록」 분기가 테이블 갱신이 된다.
- 옮기기 검사가 서브트리 명령을 훑지 않는다 (`translateCheckCommands` 917,005 → 0 — `app-pages` 줌).
- ADR-267 sticky 의 scroll container 오프셋 입력이 한 자리 (scroll 노드) 에 있다.
- Chromium 대조 정본 §3 의 유일한 구조 격차 (property trees) 가 닫힌다 — 나머지 행은 동형.

### Negative

- 실행기 · patcher · damage · 옮기기 · 검사가 테이블을 읽는 조회가 한 겹 더 — Phase 0 기준선 대비 `executeCommandRange` 가 늘면 Phase 3 을 보류한다 (R2 · G2 HC4).
- 전환 중 두 정본 (명령 안 필드 · 테이블) 이 공존하는 Phase 가 있다 — 각 Phase 종결 커밋이 옛 필드를 지운다.
- 절대 맵 갱신 (요소당 객체 생성 · clip 재교차 · SpatialIndex upsert) 은 그대로 남는다 — 중첩 5k 편집 꼬리가 이 ADR 로 다 닫히지 않을 수 있다 (사용자 결정 3 · O(1) 주장 금지).
- 가상화 소유자 (ADR-150) 의 스크롤은 행 집합 변경이 따로 와야 한다 (R5) — 그 경로가 없으면 그 소유자는 기존 재기록을 유지한다.
