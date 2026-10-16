# ADR-266 design breakdown — 실사용 문서 줌 · 편집의 그리기 캐시 thrash

> 본문: [../266-draw-cache-thrash-real-document-zoom-edit.md](../266-draw-cache-thrash-real-document-zoom-edit.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 와 `.agent/runs/` 는 로컬 전용이라 실측 결론은 여기 §기록에 둔다.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: 기존 ADR 의 분리가 아니다. ADR-153 (노드 picture 캐시) · ADR-174 (paragraph 노드 소유) · ADR-263 (viewport 실행) · ADR-264 (page root 옮기기) 가 base 이고, 이 ADR 은 그 네 기계가 실사용 형태 문서에서 서로 캐시를 버리게 되는 정책 (후퇴 조건 · 재등록 · 상한) 을 고치는 응용이다. Canvas 성능 계획 4단계의 trigger 1 성립 → 「새 ADR」 은 계획에 적혀 있던 다음 단계이고, 사용자가 `/create-adr` 로 열었다 — fork 가 아니다.
2. **schema**: 문서 · 저장 schema 변경 0. `RenderCommandStream` 의 명령 종류 · 맵도 늘지 않는다. 하니스 `counts.render` · `caches` 에 사유별 필드가 늘고, `perf/ratchet.json` 에 run `app-pages` 가 는다.
3. **선행 전제 reverse 검증**: ADR-264 의 「page grid 가 바뀌어도 page 내용은 레이아웃을 유지한다 → 옮긴다」 는 `pageGridResized` 0 으로 이 문서에서도 성립한다. 후퇴한 것은 옮기기의 **전제 조건** (대기 delta 없음 · 모든 root 가 옮길 수 있음) 이지 결정이 아니다. ADR-174 의 「paragraph 수명 = 노드 수명」 도 그대로 — 바뀌는 것은 「같은 내용의 새 노드 객체」 를 다른 노드로 볼 것인가다 (인계). ADR-153 R2 (해제 순서 · 명시 delete) 는 그대로. 의존 방향 반전 없음.
4. **판독**: 사용자가 요청할 때 `/review-adr 266`. 판독은 phase 당 1 + 수리 검증 1.

## 1. Phase 0 — 사유별 카운터 · 몫 표 (G0, go/no-go)

목적: cold miss 28,791 을 「재바인드가 버림 / 퇴거가 버림 / 첫 기록」 으로, `viewportFallbacks` 21 을 다섯 조건으로, `rebindPageGrid` 15 를 `movePageRoots` 의 null 사유로 가른다. 가설로 레버를 정하지 않는다.

- **카운터** (dev 전용 분기, `renderCounters.ts` 필드 추가 + `cacheMetrics` 사유):
  - 옮기기 후퇴: `pageGridMoveNullDirty` (대기 delta) · `pageGridMoveNullResized` · `pageGridMoveNullTranslate` + `checkTranslate` reason 별 (`subtree-context` · `top-layer` · `drag-offset` · `missing-span` · `invalid-span` · `fixed-or-sticky`) — `canvasBinding.ts` `movePageRoots` 의 return null 자리마다.
  - 재바인드가 버린 것 — **실제 해제 지점에서 센다** (리뷰 r1 H1): 재바인드는 `scene.rebind` → `binding.dispose()` → 모든 등록 id 에 `unregisterSkiaNode` (`canvasBinding.ts` 2448 ~ 2450) → paragraph 해제 · registry 삭제 · picture 무효화 (`useSkiaNode.ts` 56 ~ 63) 가 **먼저** 돌고 그 뒤 새 `bind()` 가 `registerSkiaNode` 를 부른다 — 교체 분기 (`oldData`) 에는 재바인드가 닿지 않는다. 그래서 `canvasScene.rebind` 가 해제 구간을 사유 (`page-grid` · `page-roots` · `image-loaded` · `root` · `verify` · drag) 와 함께 열고 (`beginRebindRelease(reason)` / `end`), 그 구간 안의 `unregisterSkiaNode` 가 버린 picture entry 수 · paragraph 슬롯 수를 `rebindReleasedPictures` · `rebindReleasedParagraphs` (사유별) 에 더한다. `rebindSameContent` (옛 · 새 데이터가 bake 필드 동치인 수 — 인계 가능량의 상한) 는 Phase 0 에서는 해제 직전 데이터를 사유 구간 동안 dev 전용 맵에 붙들었다가 새 등록과 비교해 센다 (동작 무변경 — 비교만).
  - picture: `cacheMetrics("nodePicture")` 의 `evictions` 를 하니스 `caches` 출력에 싣고, miss 사유 `cold` 를 `cold-evicted` (퇴거된 적 있는 id) · `cold-released` (재바인드 해제 구간에서 해제된 id) · `cold-first` 로 나눈다 (dev 전용 id 집합).
  - paragraph: miss 사유 `released` (슬롯 없음 — 소유자 교체) · `key` (키 다름) · `fontMgr` · `first`.
  - viewport: `viewportFallbackNoIndex` · `UnsafePaint` · `DragOffset` · `HalfRule` · `NoSequence` · `LinearOnly` — `executeViewportRenderCommands` 의 `fallback()` 호출마다 사유 인자.
  - 기록 크기: `touchedElementsPerContent` (content **full** 기록 1 회가 picture 로 지나간 고유 요소 수 = hit + record — working set, 상한 1,024 대비) · `recordedElementsPerContent` (그중 새로 record 한 수 — 비용 계측, working set 이 아니다; 리뷰 r1 M2) · `recordedTextPerContent`. damage 부분 기록은 따로 (`touchedElementsPerDamage`) 센다.
- **시나리오** (dev 5173 · headless · `--fixed-inputs` · `--fixture-kind app-pages`, 각 2 회 같은 값): `zoom` · `edit` · `pan` · `page-switch`. 불리 케이스 — 하니스 옵션: `--zoom-fit-all` (22 페이지가 전부 화면에 걸리는 줌아웃에서 줌) · `--edit-target` 을 글자 많은 Docs 페이지의 문단으로 · 줌 중 편집 (`zoom` 뒤 바로 `edit`). 합성 `mixed` 5k · `nested-flex` 5k 는 대조군 (재바인드 0 · 후퇴 0 이 그대로인지).
- **몫 표**: cold miss 를 세 사유로, `viewportFallbacks` 를 여섯 사유로, `rebindPageGrid` 를 null 사유로 — `app-pages` 줌 · 편집 · 불리 2.
- **ratchet**: `perf-ratchet-gate.mjs --add-run <seed>:app-pages=<a.json>,<b.json>` (fixture 가 run 키에 실린다 — ADR-264 Phase 0 의 `600:nested-flex` 와 같은 길) · 새 키는 `--add-keys ... --keys render.pageGridMove*,render.rebindReleased*,render.viewportFallback*,render.recorded* --accept-recorder`. 등록한 키를 인위 회귀시킨 보고로 `decide` = `block` 확인. seed 는 `app-pages` 생성기의 PRNG seed 7 고정 — run 키의 `<seed>` 자리는 하니스가 fixture 종류에 맞는 값 (요소 수 25 · pages 22) 으로 적는다.
- **go/no-go**: 재바인드 몫 또는 퇴거 몫이 cold 의 50 % 이상이면 go → Phase 1 (몫 큰 쪽부터). 둘 다 작고 「첫 기록」 이 대부분이면 (줌마다 새 요소가 화면에 들어오는 정당한 cold) 사용자 결정 2.

## 2. Phase 1 — 재바인드 후퇴 · 캐시 인계 (L1 · L2, G1)

- **L1 `movePageRoots` 후퇴 좁히기** (`canvasBinding.ts` 1858 ~ 1896 · `canvasScene.ts` 165 ~ 174):
  - null 사유가 `dirty.size` 면: 대기 delta 를 먼저 `update()` 로 적용한 뒤 옮기기 (순서 — delta 가 page root 의 크기를 바꾸면 그때는 재바인드가 맞다; 적용 뒤 다시 크기 비교).
  - 사유가 `checkTranslate` reason 이면: 그 root 만 다시 묶고 (root 단위 rebind — `bind()` 가 root 하나를 다시 묶을 수 있게 분리) 나머지 root 는 옮기기. 「하나라도 안 되면 전부」 → 「안 되는 것만」. `top-layer` 는 drag 중이라 재바인드가 맞다 (ADR-264 의 drag 두 번은 유지).
  - unit: `phase4eCanvasScene` 에 「root 하나가 sticky 자손을 가져 옮길 수 없을 때 다른 root 는 옮겨지고 그 root 만 다시 묶인다 · 명령 · bounds · hit · clip 맵 = 새로 묶은 scene」 · 「대기 delta 가 있을 때 적용 뒤 옮기기 = 재바인드 결과」. 원복 RED.
- **L2 재바인드 인계 — 두 단계 교체** (`canvasScene.ts` `rebind` 190 ~ 202 · `canvasBinding.ts` `dispose` 2448 ~ 2450 · `useSkiaNode.ts` · `nodePictureCache.ts` · `retainedParagraph.ts`; 리뷰 r1 H1 — 지금 순서 「전부 unregister → 새 bind」 에서는 교체 분기가 재바인드에 닿지 않는다):
  - `binding.retire()` 를 둔다 — 구독만 끊고 registry 의 노드 데이터는 **남긴 채** 등록 id 집합을 돌려준다 (`RetiredBinding`). `scene.rebind` 는 `dispose()` 대신 `retire()` → 새 `bind()` → `retired.releaseRemaining(registeredNow)` 순서로 간다: 새 bind 의 `registerSkiaNode(id, next)` 는 registry 에 옛 데이터 (`oldData`) 를 보게 되고, 옛 · 새 데이터가 **명령에 bake 되는 필드 전부** 동치 (비교 함수 하나 `sameDrawData(old, next)` — 테스트가 필드 목록을 고정; picture 키의 `width` · `height` 는 명령에서 와 `getCachedNodePicture` 가 따로 비교한다) 이면 picture entry 의 `dataRef` 를 새 객체로 갱신하고 (Picture 는 그대로), paragraph 슬롯을 새 노드로 옮긴다 (`moveParagraphSlot(old, next)` — 키 · fontMgr 그대로). 아니면 지금처럼 해제. `releaseRemaining` 은 새 bind 가 다시 등록하지 않은 id (사라진 노드) 만 `unregisterSkiaNode` 한다.
  - 실패 경로: `bind()` 가 던지면 `retired.releaseAll()` 로 전부 해제 — 지금의 `dispose()` 와 같은 결과. `canvasScene.replaceRoot` (breakpoint — 다른 root) · `imageLoaded` (이미지 cache hit 으로 데이터가 바뀜) · `verify` (oracle — 인계 금지, 늘 해제) 는 사유별로 인계 허용 여부를 정한다: `page-grid` · `page-roots` 는 인계, `image-loaded` · `root` 는 비교가 거르고 (내용이 바뀐 노드만 해제), `verify` 와 drag (`top-layer` 재구성) 는 해제. 폰트 세대 (`ensureNodePictureFontGeneration`) · 이미지 퇴거 역참조 (`invalidateNodePicturesByImage`) 는 그대로 — 인계는 그 위에서만 동작한다.
  - owner-drawn part (`ownerDrawnPartNodeData`) · volatile 노드 · 텍스트 편집 중 노드는 인계 제외.
  - ADR-174 금지 (전역 LRU · 상한) 에 닿지 않는다 — 슬롯은 여전히 노드 하나가 소유하고 수명은 그 노드. 옛 노드 객체는 `releaseRemaining` 뒤 참조가 끊긴다 (슬롯이 옮겨졌으므로 해제할 paragraph 가 없다).
  - unit: (a) `registerSkiaNode` 단위 — 「같은 내용 재등록 → entry 유지 · dataRef 갱신 · 슬롯 이동 · 해제 0」 · 「한 필드 다름 → 해제」 · 「owner-drawn part → 해제」; (b) **실제 경로** — 실제 `CatalogWorkspace` + 엔진으로 Text 를 넣고 `CatalogCanvasScene` 에 묶은 뒤 paragraph · picture 를 붙이고 문서 변경 없이 `scene.rebuild()` 가 아니라 `pageGridChanged()` 의 재바인드 경로 (`translateOff` 로 강제) 와 `imageLoaded()` 를 지나 — 인계 사유에서는 picture · paragraph 가 살아 있고 delete 0, `verify` · 내용 변경에서는 해제 (리뷰 r1 의 반례가 RED 테스트가 된다 — CanvasKit 자원만 delete spy 대역). 원복 RED.
- **G1**: 픽셀 oracle live (`apps/builder/scripts/adr266-draw-cache-live.mjs`, headed Playwright — ADR-264 `adr264-subtree-translate-live.mjs` 의 비교 틀 재사용): 같은 상태를 새 경로 ↔ `renderDebug.translateOff` + 캐시 off 로 그려 0 px 차 — 줌 0.12 · 0.3 · 0.6 · 1 · 2 (열 수가 바뀌는 구간을 하니스가 고른다) · 테마 전환 · 폰트 로딩 완료 (`ensureNodePictureFontGeneration`) · 이미지 로딩 (`imageLoaded` 재바인드) · owner-drawn part 편집 (ToggleButton Icon 색) · undo. 카운트: `app-pages` 줌 `rebindPageGrid` 15 → 0 (drag 제외) · `rebindReleased*` → 0 · cold-released → 0 · ratchet `--update`.

## 3. Phase 2 — picture 상한 정책 · 퇴거 비용 (L3, G1 + HC5)

- Phase 0 의 `touchedElementsPerContent` 가 1,024 를 넘고 (`app-pages` ~1,370) 퇴거 몫이 남아 있으면 진입. 사용자 결정 1 을 먼저 묻는다.
- **상한 = working set** (리뷰 r1 M2 — 새 record 수를 기준으로 하면 warm 프레임에서 record 0 → 상한 1,024 로 축소 → 346 퇴거 → 다음 순차 기록 전부 miss 로 thrash 가 재발한다): `MAX_NODE_PICTURES` 를 「직전 content **full** 기록이 picture 로 지나간 고유 요소 수 (hit + record = `touchedElementsPerContent`) × 1.25, 하한 1,024, 상한 = 사용자 결정 1 의 힙 상한에서 역산」 으로. 산출은 full 기록 끝 (`executeRenderCommands` 의 content full 호출 단위) 에서 한 번 — damage 부분 기록 · drag subtree 기록은 working set 을 **줄이지 않는다** (늘리지도 않는다). 축소는 full 기록 N 회 (예: 3) 연속으로 working set 이 지금 상한의 60 % 아래일 때만 (히스테리시스). 계약 테스트: 같은 visible set 을 연속 full 기록하면 warm 이 유지된다 (hit = 전부 · record 0 · 상한 불변) · 1,370 → 1,370 → 1,370 에서 퇴거 0 · 리뷰의 반례 (`hit 1370 / record 0 / cap 1024` → 다음 `hit 0`) 가 RED.
- **퇴거**: 상한 초과 때 1,024 entry 선형 스캔 (`evictLeastRecentlyUsed` — production 편집 프로필 1 위) 대신 `lastUsed` 순서를 유지하는 구조 (Map 의 삽입 순서 재삽입은 hit 마다 구조 변경이라 피했다 — 주석 48 ~ 51; 대신 세대 버킷 또는 퇴거를 기록 끝에 묶어 한 번에) — 퇴거 1 회당 비용이 entry 수에 비례하지 않게.
- **HC5 측정**: dev 전역 `__composition_NODE_PICTURE_CACHE_DEBUG__.size` 와 CanvasKit `HEAPU8.byteLength` 고수위 (처녀 힙에서 시작 — measurement-validity #8) · `app-pages` 22 페이지 줌아웃 → 전 페이지 팬 3 회 → 줌인 · 사용자 Chrome (throttle 4x) headed 에서 힙 평탄 · 콘솔 오류 0. ADR-174 되돌림 사례의 수치 (힙 2,147 MB abort · OFF 1,090 MB 평탄) 를 비교 기준으로 적는다.
- unit: 상한 산출 · 퇴거 순서 · 해제 순서 (Picture → Image, `imageCache` 역참조) 테스트. 원복 RED.

## 4. Phase 3 — paragraph 재생성 · viewport 후퇴 (L4, G1)

- **paragraph**: Phase 1 L2 뒤에도 `paragraph.misses` 가 남으면 사유로 가른다 — `key` 면 키의 어느 축이 줌 · 재바인드로 흔들리는지 (예: `maxWidth` 가 layout 재계산으로 소수점만 달라짐) 를 찾아 그 축의 정규화를 고친다 (ADR-174 의 키 설계 안에서 — 전역 캐시 · 상한 재도입 금지). Canvas 2D 줄바꿈 hint 측정 (`canvas2dSegmentCache`) 은 paragraph 가 살아 있으면 돌지 않는다.
- **viewport 후퇴**: 사유별로 —
  - `HalfRule` (후보 × 2 > 요소 수 — 22 페이지 줌아웃): 규칙을 「후보 서브트리 명령 수 vs 전체 명령 수」 로 바꾸거나, 선형 경로의 컬링 점프가 이미 싼지 (`execCulledJumped` 292,040 vs `execVisited` 145,697) 실측해 규칙을 유지하되 §기록에 적는다. 기준은 record 시간이 아니라 방문 수 카운트.
  - `UnsafePaint` (`damageUnsafeElementIds`): unsafe 요소가 어떤 것인지 (sticky nav · 바깥 그림자 카드 · 넓이 0 상자) 를 세고, unsafe 요소를 sequence 에 늘 싣는 쪽 (page root 처럼) 으로 바꿀 수 있는지 — ADR-263 R1 (hit bounds 밖 paint) 의 보수 선택을 유지하면서.
  - `NoIndex` · `DragOffset` · `NoSequence` 는 그대로 (각각 전제가 맞다).
- **G1**: 픽셀 oracle (`renderDebug.linearOnly` ↔ viewport) 0 px 차 · `viewportFallbacks` 21 → 사유 해소분만큼 하향 · ratchet.

## 5. 종결 (G2)

- production 짝 측정 (`.cache/perf-ratchet/wt` 를 수정 전 commit 으로 `prepareWorktree`, `perf:build-dist` · `--serve-dist` · 교대 2 쌍 · 줌은 headless 60Hz + headed 120Hz): `app-pages` 줌 · 편집 · 불리 2 · 합성 평평 5k · 1만 줌 · 편집 · 중첩 5k 줌 · 편집 · drag.
- dev `record.content` p95 ≤ 8 ms (trigger 1 해제 기준) 를 §기록에.
- live exercise: 사용자 프로젝트의 같은 문서 (`/builder/9168f5be-…`, 사용자 Chrome throttle 4x) 에서 줌 (휠 · 핀치 · fit) · 편집 · 테마 전환 · 페이지 전환 · undo → 잔상 0 · Compare Mode Canvas = Preview · 콘솔 오류 0. Chrome MCP 또는 사용자 confirm.
- ratchet `--update` 를 수정과 같은 커밋에. 문서: ADR 본문 Status · Live Exercise, README, CHANGELOG (성능 회귀 수정 트리거 — 줌 끊김은 사용자 가시).
- 4단계 입력: 종결 뒤 남은 프로필 상위 (JS ↔ wasm 경계 비율 · 엔진 비중 · 남은 record 시간) 과 trigger 1 재판정을 §기록과 `CANVAS_RUST_DECISION_2026-10.md` §1 에.

## 파일 변경표

| Phase | 파일                                                                                                              | 변경                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0     | `workspace/canvas/skia/renderCounters.ts` · `cacheMetrics.ts`                                                     | 사유별 필드 (`pageGridMove*` · `rebindReleased*` · `viewportFallback*` · `recorded*`) · miss 사유 분화 |
| 0 | `catalogRuntime/canvasBinding.ts` · `canvasScene.ts` (해제 구간 사유) · `skia/useSkiaNode.ts` (`unregisterSkiaNode` 해제 카운트) · `skia/renderCommands.ts` · `skia/nodePictureCache.ts` | 사유 카운트 (동작 무변경) |
| 0     | `apps/builder/scripts/perf-baseline.mjs` · `perf/ratchet.json`                                                    | `caches.evictions` 출력 · 불리 옵션 (`--zoom-fit-all`) · `--add-run app-pages` · `--add-keys`          |
| 1     | `catalogRuntime/canvasBinding.ts` · `canvasScene.ts` (+ `phase4eCanvasScene` 테스트)                              | 대기 delta 적용 뒤 옮기기 · root 단위 재바인드                                                         |
| 1 | `catalogRuntime/canvasBinding.ts` (`retire` · `releaseRemaining`) · `canvasScene.ts` (`rebind` 두 단계 · 사유별 인계 허용) · `skia/useSkiaNode.ts` · `nodePictureCache.ts` · `retainedParagraph.ts` (+ 테스트 — 실제 scene 경로 포함) | 재바인드 인계 transaction · `sameDrawData` · picture `dataRef` 갱신 · paragraph 슬롯 이동 |
| 1     | `apps/builder/scripts/adr266-draw-cache-live.mjs`                                                                 | 픽셀 oracle live                                                                                       |
| 2     | `skia/nodePictureCache.ts` (+ 테스트)                                                                             | 동적 상한 · 퇴거 구조 · 힙 측정 핸들                                                                   |
| 3     | `skia/textParagraphKey.ts` · `renderCommands.ts` `executeViewportRenderCommands` (+ `viewportExecution.test.ts`)  | 키 정규화 · 후퇴 규칙                                                                                  |
| 4     | ADR 본문 · README · CHANGELOG · `perf/ratchet.json` · `CANVAS_RUST_DECISION_2026-10.md` §1                        | 종결 · trigger 1 재판정                                                                                |

`CatalogCanvas.tsx` · `canvasGesture.ts` 는 건드리지 않는다 (다른 세션의 Canvas drag & drop 작업).

## 기록

- 2026-10-17 **Proposed** — 입력: [CANVAS_RUST_DECISION_2026-10.md](../../explanation/research/CANVAS_RUST_DECISION_2026-10.md) §4 (`app-pages` 줌 production p95 213 ms · dev record p95 193 ms · picture cold 28,791 · paragraph hit 0 · viewport 후퇴 21/21) + 이 ADR 작성 때 다시 읽은 카운트 (`rebindPageGrid` 15 / 21 · `pageGridMovedRoots` 292 · `pageGridResized` 0 · `translateCalls` 0 · contentSurface miss `invalidate` 15 · `zoom-refresh` 3 · `coverage-refresh` 3) — 연구 문서의 가설 (상한 → 퇴거) 앞에 재바인드 (옮기기 후퇴) 가 있다. 두 몫은 Phase 0 이 가른다.
- 2026-10-17 **리뷰 Round 1 반영 (r1)** — [reviews/266.md](../reviews/266.md) HIGH 1 · MEDIUM 1. H1: 재바인드는 `dispose()` 가 모든 노드를 먼저 `unregisterSkiaNode` 해 picture · paragraph 를 해제한 뒤 새 bind 가 돌아, 「등록 교체 분기에서 인계」 (초안 L2) 와 그 자리의 Phase 0 계측은 재바인드에 닿지 않았다 (리뷰 반례: 실제 workspace · 엔진 · scene 으로 `scene.rebuild()` 뒤 picture 1 · paragraph 1 이 실제 delete). → Phase 0 계측을 실제 해제 지점 (`unregisterSkiaNode`, 사유 구간) 으로, L2 를 두 단계 교체 (`retire` → `bind` → `releaseRemaining`, 사유별 인계 허용, 실패 경로 전량 해제) 로 바꾸고 실제 scene 경로 테스트 (리뷰 반례 = RED) 를 계획에 넣었다. M2: L3 의 상한 기준이 새 record 수라 warm 프레임 (record 0) 에서 상한이 1,024 로 줄어 thrash 가 재발한다 (리뷰 모델 프로브: `hit 1370 / record 0 / cap 1024` → 다음 `hit 0 / record 1370`). → 기준을 hit + record 의 working set (`touchedElementsPerContent`, full 기록만) 으로, damage 기록은 축소 금지, 축소는 히스테리시스, 계약 테스트 「같은 visible set 연속 기록 = warm 유지」. 본문 §코드 사실 C2 · R1 · 사용자 결정 1 문구 갱신.
