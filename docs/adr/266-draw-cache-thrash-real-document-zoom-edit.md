# ADR-266: 실사용 문서 줌 · 편집의 그리기 캐시 thrash — page grid 재바인드 후퇴 · picture 상한 · paragraph 재생성 · viewport 후퇴 (Canvas 성능 계획 4단계 — trigger 1 성립 뒤 첫 ADR)

## Status

Proposed — 2026-10-17

- 사용자 요청: `/create-adr 실사용 문서 줌 · 편집의 그리기 캐시 thrash` (2026-10-17)
- 방향을 정한 사용자 원문: 「없다 모두 삭제해서 원하는 만큼의 page와 element를 만들어라」 (2026-10-17 — 07-30 실문서가 없어 사용자 프로젝트에 사이트 · 앱 모양의 22 페이지 문서를 만들고 같은 생성기를 하니스 fixture `app-pages` 로 넣었다) → 그 문서의 줌에서 Canvas 성능 계획 4단계 trigger 1 (그리기 명령 실행 > 8 ms/frame) 이 성립해 계획대로 새 ADR 로 이어진다 ([CANVAS_RUST_DECISION_2026-10.md](../explanation/research/CANVAS_RUST_DECISION_2026-10.md) §1 · §4). ADR-921 은 되살리지 않는다 (사용자 결정 2026-10-07).
- 이미 정해진 것: 측정이 설계보다 먼저 (ADR-263 · 264 · 265 와 같은 규율 — 카운트 RED → 수정 → ratchet 하향을 같은 커밋에, measurement-validity §5). wall-clock 은 production 짝만 인용한다. 측정 문서는 `app-pages` (22 페이지 · 노드 3,317 · record 5,116 — 07-30 실문서 5,069 요소 · 23 페이지와 같은 급) 이고, 사람이 만든 문서가 아니라 그 모양을 흉내 낸 생성물이다 (measurement-validity Q1 — 규모 · 형태 전용, 분포 지표로 인용하지 않는다). Rust 이관은 대안으로 두되, 측정이 가리키는 비용은 Rust 경계 · 엔진이 아니라 JS 그리기 층의 캐시 · 재바인드다 (trigger 2 · 3 미충족).
- 리뷰: [reviews/266.md](reviews/266.md) Round 1 (codex, 2026-10-17 — 기록의 ts 는 UTC 10-16) HIGH 1 · MEDIUM 1 — H1 재바인드는 `dispose()` 가 모든 노드를 먼저 `unregisterSkiaNode` 해 picture · paragraph 를 해제한 뒤 새 bind 가 돌아, 초안의 「등록 교체 분기에서 인계 · 계측」 은 재바인드에 닿지 않는다 (실제 workspace · 엔진 · scene 반례: `scene.rebuild()` 뒤 picture 1 · paragraph 1 실제 delete) · M2 L3 의 동적 상한이 새 record 수 기준이라 warm 프레임 (record 0) 에서 상한이 1,024 로 줄어 thrash 재발 (모델 프로브: `hit 1370 / record 0 / cap 1024` → 다음 `hit 0`). → **r1 반영**: Phase 0 계측을 실제 해제 지점 (`unregisterSkiaNode`, 사유 구간) 으로 · L2 를 두 단계 교체 (`retire` → `bind` → `releaseRemaining`, 사유별 인계 허용, 실패 경로 전량 해제, 실제 scene 경로 테스트 = 리뷰 반례 RED) 로 · L3 기준을 hit + record 의 working set (full 기록만 · damage 축소 금지 · 히스테리시스 · 「같은 visible set 연속 기록 = warm 유지」 계약) 으로 (§코드 사실 C2 · 대안 A · R1 · R2 · 사용자 결정 1 · breakdown §1 ~ §3 · §기록). 구현 · 실제 Builder 픽셀 · production 수치는 UNVERIFIED (execute 의 몫). Round 2 수리 검증 결과는 아래 인용 블록에 기록.

> **Round 2 수리 검증 (codex, 2026-10-17):** H1·M2 설계 closed, 신규 HIGH/MEDIUM 0 · pending 0 — 설계 승인 가능. 실제 binding에서 옛 자원의 도달성 및 working set 정책 모델 확인 (기존 반례 2 + 수리 검증 3, 5/5 PASS). 제품 구현·Builder 픽셀·production 성능·메모리는 UNVERIFIED. [리뷰 기록](reviews/266.md#round-2). Proposed 유지.

Related: [ADR-263 그리기 명령 패치·실행 비용](completed/263-render-command-patch-execute-cost.md) (viewport 공간 질의 경로와 그 후퇴 조건의 출처) · [ADR-264 이동만 한 서브트리의 patch 축소 · 줌 page grid 재바인드 제거](completed/264-moved-subtree-translate-page-grid-rebind.md) (page root 옮기기 — 이 ADR 이 그 후퇴를 다룬다) · [ADR-153 측정 우선 렌더 최적화](completed/153-render-optimization-measurement-first-adoption.md) (노드 picture 캐시 · `MAX_NODE_PICTURES` 상한 · R2 WASM 메모리) · [ADR-174 paragraph retained 수명](completed/174-paragraph-retained-lifetime.md) (paragraph 는 노드 소유 · 상한 재도입 금지 · WASM 힙 2,147 MB abort 사례) · [ADR-246 카운트 ratchet](completed/246-deterministic-count-ratchet-and-begin-frame-harness.md) (집행 수단) · [Canvas Rust 판정 측정 (4단계)](../explanation/research/CANVAS_RUST_DECISION_2026-10.md) (이 ADR 의 입력)

## Context

### 문제 — 실사용 형태 문서에서 줌이 무너지고, 편집도 예산 밖이다

합성 1만 노드 문서 (평평 `mixed` · 중첩 `nested-flex`) 에서는 production headed 줌 gap p95 9.3 ms · drop 0 으로 trigger 가 모두 미충족이었다 (연구 문서 §2). 같은 하니스에 실사용 형태 문서 `app-pages` 를 넣자 (2026-10-17, 부류당 3 초 · visibility `visible` · 콘솔 · 페이지 오류 0):

| 부류                                                | dev (60Hz) gap p95 / p99 · drop             | production headless (60Hz) | production headed (120Hz)         |
| --------------------------------------------------- | ------------------------------------------- | -------------------------- | --------------------------------- |
| zoom                                                | 205 / 243 ms · 25 %                         | 213 / 246 · 23.5 %         | 221 / 245 · 26.4 % (long task 17) |
| edit                                                | 17.4 / 20.5 · 0                             | 37.5 / 40.4 · 8.7 %        | 54 / 62.4 · 5.4 % (long task 15)  |
| pan · drag · select · hover · marquee · page-switch | 예산 안 (select 는 ADR-265 HC3 꼬리 그대로) | 예산 안                    | 예산 안                           |

dev 줌의 그리기 기록 시간 `render.skia.record.content` 는 p50 46.6 · p95 193 ms (21 회) — trigger 1 의 기준 8 ms 를 24 배 넘는다. 합성 격자는 그리는 요소 · 글자 종류가 적어 이 비용을 가렸다 (measurement-validity #6 — 유리한 경우만 측정).

### 코드 사실 — 네 자리가 한 줄로 이어진다

dev 카운트 (줌 64 프레임 · content 기록 21 회 · `.agent/runs/2026-10-16-rust-decision/dev-app2/`) 와 소스 (2026-10-17 실측):

| #   | 자리                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 카운트                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **page grid 옮기기의 후퇴 → 재바인드**: 줌으로 자동 열 수가 바뀌면 `syncAutoColumns` → `scene.pageGridChanged()` (`catalogRuntime/canvasScene.ts` 165 ~ 174) 가 `binding.movePageRoots()` (`canvasBinding.ts` 1858 ~ 1896) 를 부르고, 그것이 null 이면 `rebind("page-grid")` — binding 을 버리고 다시 묶는다 (`bindInColorMode`, production 줌 프로필 1.8 %). null 이 되는 조건: 대기 중 record delta (`dirty.size`) · page root 의 크기 변화 · 옮길 수 없는 root (`canTranslateSubtree` — `subtreeTranslate.ts` `checkTranslate`: `subtree-context` · `top-layer` · `drag-offset` · `missing-span` · `invalid-span` · `fixed-or-sticky`) | `rebindPageGrid` **15** / 기록 21 · `pageGridMovedRoots` 292 · `pageGridResized` 0 · `translateCalls` 0 — 크기는 그대로인데 옮기기가 한 번도 안 됐다 |
| C2  | **재바인드는 picture · paragraph 를 전부 버린다**: `scene.rebind` (`canvasScene.ts` 190 ~ 202) 는 `binding.dispose()` 로 **먼저** 모든 등록 id 를 `unregisterSkiaNode` (`canvasBinding.ts` 2448 ~ 2450 → `skia/useSkiaNode.ts` 56 ~ 63: `releaseParagraphsIn` · registry 삭제 · `invalidateNodePicture`) 하고, 그 뒤 새 `bind()` 가 `registerSkiaNode` 로 새 객체를 등록한다 — 내용이 같아도 옛 데이터는 이미 없어 비교할 자리가 없다 (교체 분기 `oldData` 는 재바인드에 닿지 않는다 — 리뷰 r1 H1)                                                                                                                                        | picture miss 28,791 **전부 `cold`** (`data` · `size` 0) · paragraph hit **0** · miss 21,312                                                          |
| C3  | **picture 캐시 상한 1,024 < 한 번 기록하는 요소 수**: `nodePictureCache.ts` 65 `MAX_NODE_PICTURES = 1024`, 173 `storeNodePicture` 가 상한 초과마다 `evictLeastRecentlyUsed` (375 ~ 389 — 1,024 entry 선형 스캔, 주석 「상한 도달은 드물어」). 기록당 ~1,370 개를 순서대로 넣으면 LRU 는 늘 직전 기록분을 밀어내 다음 기록이 다시 전부 cold 다 (순차 스캔 thrash). 재바인드가 없던 6 회 기록에서도 hit 이 344 뿐인 이유                                                                                                                                                                                                                    | hit 344 / miss 28,791 · production **편집** 프로필 1 위 `evictLeastRecentlyUsed` 3 ~ 7.7 %                                                           |
| C4  | **paragraph 재생성이 Canvas 2D 측정을 다시 한다**: `nodeRendererText.ts` 435 ~ 455 — retained (`retainedParagraph.ts` — 소유자 = 레지스트리 원본 노드, 키 `textParagraphKey.ts` 는 zoom 과 무관) 가 없으면 miss → paragraph 생성 + 줄바꿈 hint 측정 (`canvas2dSegmentCache.getOrMeasureWidth`, ADR-051). production 줌 프로필 1 위 8 % · `measureLine` 1.2 % · `renderText` · `runTextStyle` · CanvasKit                                                                                                                                                                                                                                  | `render.text.paragraph.build` · `layout` 라벨 1,000 (상한)                                                                                           |
| C5  | **viewport 공간 질의 경로의 후퇴**: `renderCommands.ts` 2301 ~ 2345 `executeViewportRenderCommands` 가 false 를 돌려 선형 실행 (컬링 점프) 으로 간 조건 — SpatialIndex 없음 · `damageUnsafeElementIds` 비어 있지 않음 (1589 top layer · `hasSparseDamageUnsafePaint` 1883 ~ 1907: transform · fixed · sticky · 바깥 그림자 · outline · 글자 그림자 · 두꺼운 선, 1746 넓이 0 상자의 paint) · drag offset · **후보 × 2 > 요소 수** (2327) · sequence 불가. 어느 것인지 카운터가 가르지 않는다                                                                                                                                               | `viewportFallbacks` **21** / 21 · `viewportSequences` 0 · `execVisited` 145,697 · `execCulledJumped` 292,040 · `scrollRangeVisits` 75,825            |

편집도 같은 캐시를 탄다 — `app-pages` 편집 (카드 폭 15 회) 의 dev 카운트는 `patchWrites` 3,414 · `translateNodes` 1,686 · `viewportFallbacks` 15 / 15 · `contentDamageFallbacks` 6 (damage 6 회 전부 full 로) 이고, production 프로필 1 위가 picture 퇴거다.

**카운터 사실**: 네 자리 모두 결정적 카운터가 있지만 **사유를 가르지 않는다** — `rebindPageGrid` 는 `movePageRoots` 가 왜 null 이었는지 (dirty · 크기 · `checkTranslate` reason), `nodePicture` 미스는 `cold` 가 퇴거 때문인지 재바인드 때문인지 (`recordEviction` 은 dev 메트릭에 있으나 하니스 `caches` 출력에 없다), `paragraph` 미스는 소유자 교체인지 키 변경인지, `viewportFallbacks` 는 다섯 조건 중 무엇인지 말하지 않는다. `app-pages` 는 ratchet 에 run 으로 등록돼 있지 않다 (`--add-run` 대상).

### 전제 점검 — 가설 둘이 겹친다

연구 문서 §4 의 가설은 「picture 상한 → 퇴거 → paragraph 재생성」 (C3 → C4) 이었다. 카운트를 다시 읽으면 C1 → C2 가 그보다 앞선다 — 기록 21 회 중 15 회가 재바인드 직후라 상한과 무관하게 전부 cold 다. 그러나 재바인드가 없던 6 회에서도 hit 이 344 뿐이라 C3 도 성립한다. 두 몫을 가르지 않으면 한쪽만 고치고 「개선 없음」 으로 오판한다 (ADR-264 Phase 0 교훈 — 가설 대신 분해 카운트). Phase 0 이 사유별 카운터로 가른다.

ADR-264 G3 는 「평평 5k 줌 `rebindPageGrid` 0」 을 통과했다 — 합성 문서에서는 옮기기 전제 (대기 delta 없음 · 크기 불변 · 옮길 수 있는 root) 가 늘 성립했고, 실사용 형태 문서에서는 15 / 21 이 후퇴했다. 이는 ADR-264 의 **결정** 을 뒤집는 것이 아니라 그 전제 조건이 합성 fixture 에서만 확인됐다는 사실이다 (measurement-validity Q1 · #4 — 추정 vs 실측 gap 은 이 ADR Phase 0 inventory 로 흡수, adr-writing M3).

### 3-domain 판정

D3 시각 스타일의 consumer 중 **Builder Skia 의 실행 경로** (재바인드 · picture · paragraph · viewport 실행) 만 바뀐다. 화면 픽셀 · catalog 정의 · 문서 · 저장 형식 · 레이아웃 결과 · Preview DOM 은 바뀌지 않는다 — 대칭은 「같은 상태의 선형 full 실행 = 새 경로」 픽셀 0 차 (ADR-263 · 264 의 live oracle) 로 유지한다. D1 · D2 · Generator 무관.

### Hard constraints

- **HC1 픽셀 동일**: 새 경로 (옮기기 · picture 유지 · paragraph 유지 · viewport sequence) 는 같은 상태의 선형 full 실행 · 재바인드 · 캐시 off 와 0 px 차 (dev 스위치 `renderDebug.linearOnly` · `translateOff` · `__composition_NODE_PICTURE_CACHE__ = false` — ADR-263 · 264 · 153 의 oracle 재사용). stale picture · paragraph 0 (편집 · undo · 테마 · 폰트 로딩 · 이미지 로딩 뒤).
- **HC2 줌 닫는 조건 (production 레인, `app-pages`)**: headless 60Hz 줌 gap p99 ≤ 20 ms · drop < 1 % (지금 246 · 23.5 %) · headed 120Hz long task 0 · drop < 2 % · dev `record.content` p95 ≤ 8 ms (trigger 1 해제 기준).
- **HC3 편집 닫는 조건 (production 레인, `app-pages`)**: 편집 gap p99 ≤ 20 ms · drop < 1 % (지금 40.4 · 8.7 %). 합성 5k · 1만의 줌 · 편집 · drag · select 는 유지 (ratchet 이 지킨다).
- **HC4 카운트 먼저**: 사유별 카운터가 하니스 `counts` 에 실리고 (등급 A), `app-pages` 가 ratchet run 으로 등록되며, 수정과 같은 커밋에서 상한이 내려간다. 원복 RED 는 ratchet `block`.
- **HC5 메모리**: picture · paragraph 보유량을 늘리는 레버는 CanvasKit WASM 힙 · GPU 메모리 측정을 동반한다 — ADR-174 Phase 2 되돌림 (22 페이지 실문서에서 힙 2,147 MB 상한 → `RuntimeError: Aborted()` · 텍스트 소실) 이 전례다. 상한 변경은 「한 번 그리는 요소 수」 같은 실측 기준에 묶고, 사용자 Chrome (CPU throttle 4x) 에서 힙 평탄을 확인한다.

### Soft constraints

- 다른 세션의 Canvas drag & drop 작업 (`canvasGesture.ts` · `CatalogCanvas.tsx` · drag 관련 WIP) 과 파일이 겹치지 않는다 — 이 ADR 의 파일은 `catalogRuntime/{canvasScene,canvasBinding}.ts` (옮기기 · 재바인드 분기) · `skia/{nodePictureCache,useSkiaNode,retainedParagraph,nodeRendererText,renderCommands,renderCounters,subtreeTranslate}.ts` · 하니스 · `perf/ratchet.json` 이다. `CatalogCanvas.tsx` 는 건드리지 않는다 (필요하면 `canvasScene.ts` 안에서 해결).
- ADR-174 의 금지 (렌더 측 paragraph 에 전역 content-키 LRU · 상한 재도입) 와 ADR-153 R2 (Picture → Image 해제 순서 · 명시 delete) 를 지킨다.
- 4단계 입력: 종결 뒤 남은 프로필 (Rust 경계 비율 · 엔진 비중) 을 §기록에 — trigger 1 재판정의 근거.

## Alternatives Considered

### 대안 A: 측정 먼저 — 사유별 카운터를 등록하고, 네 자리를 몫 순서로 고친다 (재바인드 후퇴 → 캐시 인계 → 상한 정책 → viewport 후퇴)

- 설명: Phase 0 에서 사유별 카운터 (`movePageRoots` null 사유 · picture 퇴거 수 · 재바인드로 버린 picture · paragraph 수 · paragraph 미스 사유 · viewport 후퇴 사유 5) 를 `renderCounters` · `cacheMetrics` 에 더해 하니스 `counts.render` · `caches` 에 싣고, `app-pages` 를 ratchet run 으로 등록한다 (등급 A · 2 회 같은 값). 레버 후보 — L1 옮기기 후퇴 조건: null 사유가 `dirty.size` 면 대기 delta 를 먼저 적용 (`update()`) 하고 옮기기, `checkTranslate` 사유 (sticky · top layer · unsafe paint) 면 그 root 만 다시 묶고 나머지는 옮기기 (지금은 하나라도 안 되면 전부 재바인드). L2 재바인드 · 재등록 때 내용이 같은 노드의 picture · paragraph 인계: `registerSkiaNode` 교체에서 새 데이터가 옛 데이터와 같은 내용 (명령에 bake 되는 필드) 이면 paragraph 슬롯을 옮기고 picture 의 `dataRef` 를 갱신한다 — 비교 키는 picture 키 (`dataRef` · width · height) 와 paragraph 키 (`getTextParagraphCacheKey`) 그대로. L3 picture 상한 정책: 상한을 「직전 full 기록의 working set (hit + record 고유 요소 수 — 새 record 수가 아니다: record 수를 쓰면 warm 프레임에서 상한이 줄어 thrash 가 재발한다, 리뷰 r1 M2) × 여유」 로 따르되 (ADR-174 대안 A 의 「동적 상한」 과 같은 형태 — 다만 picture 는 paragraph 와 달리 노드 소유가 아니라 전역 캐시라 상한이 필요하다), HC5 힙 측정으로 상한의 상한을 둔다; 퇴거는 선형 스캔 대신 `lastUsed` 순서 자료구조. L4 viewport 후퇴: 사유가 「후보 × 2 > 요소 수」 (22 페이지 줌아웃은 화면에 전부 걸린다) 면 그 규칙을 「후보 서브트리 명령 수 vs 전체」 로 다시 재거나 선형 경로의 컬링 점프 비용과 실측 비교, 사유가 `damageUnsafeElementIds` 면 unsafe 요소만 sequence 밖으로 (page root 처럼 늘 싣기).
- 근거: ADR-264 Phase 0 (가설 대신 분해 카운트 — 초안 가정이 0.5 % 였다) · ADR-153 Phase 1 (miss 사유 7 분류가 캐시 조사의 근거 인프라) · ADR-174 (상한 → 퇴거 → 재생성이 텍스트 소실 · 성능의 병인, 수명 = 노드 수명). 외부: Chromium cc 의 picture layer 는 레이어 수명 동안 recording 을 유지하고 invalidation rect 로만 재기록한다 — 캐시 상한이 아니라 소유 수명이 기준.
- 위험: 기술 **L** (각 레버 독립 · 작다 — 픽셀 oracle 이 계약) / 성능 **M** (L3 가 메모리를 늘린다 — HC5) / 유지보수 **L** (사유별 카운터가 남아 회귀를 막는다) / 마이그레이션 **L** (문서 · 저장 무변경).

### 대안 B: 타일 래스터 캐시 (Chromium · Figma 식) — 줌 중 재기록 자체를 없앤다

- 설명: content 를 scene 좌표 타일로 래스터해 두고 줌은 타일 리샘플 + 가시 타일만 재래스터.
- 근거: ADR-263 대안 C 와 같다 — Figma 의 타일, Chromium cc 의 타일링.
- 위험: 기술 **H** (타일 수명 · DPR · 줌 단계별 재래스터 · 메모리 — 새 층) / 성능 **M** (타일 메모리 = 화면 × 여유 × DPR², 줌 끝에 선명도 복구 재래스터) / 유지보수 **H** / 마이그레이션 **L**. ADR-263 이 같은 이유로 기각했고, 지금 비용은 타일이 없어서가 아니라 있는 캐시를 버려서 생긴다.

### 대안 C: 줌 중 content 승격 강등 — 모션 중에는 스냅샷을 스케일만 하고 settle 뒤 1 회 재기록

- 설명: `SkiaRenderer` 의 스냅샷 정책 (`zoom-refresh` · `coverage-refresh`) 을 모션 중에는 끄고 cleanup 때만 재기록 (ADR-153 R7 (a)).
- 근거: ADR-153 breakdown §Phase 3 (모션 중 품질 저하 vs ping-pong 의 trade-off).
- 위험: 기술 **L** / 성능 **M** (비용을 없애지 않고 줌 끝으로 미룬다 — 200 ms long task 1 회가 남는다, 모션 중 리샘플 blur · 커버리지 빈 영역) / 유지보수 **L** / 마이그레이션 **L**. **사용자 가시 동작이 바뀐다** (줌 중 흐림). 단독 기각 · 사용자 결정 2 의 보조 수단으로만.

### 대안 D: 그리기 명령 실행 · picture 기록을 Rust/wasm 으로 이관 (trigger 1 성립의 형식적 대안)

- 설명: `executeCommandRange` · record 를 Rust 로.
- 근거: Canvas 성능 계획 4단계 — trigger 1 (> 8 ms/frame) 성립.
- 위험: 기술 **H** / 성능 **M** / 유지보수 **H** / 마이그레이션 **H**. 결정적으로 **비용의 자리가 아니다** — 측정이 가리키는 것은 재바인드가 캐시를 버리는 정책 (C1 · C2), 전역 상한 (C3), CanvasKit paragraph 생성 (이미 wasm) 과 Canvas 2D 측정 (브라우저) (C4), 후퇴 조건 (C5) 이다. 명령 실행을 옮겨도 cold miss 마다 다시 기록하는 양은 같다. trigger 2 (경계 비용 1.6 %) · 3 (기능 요구) 미충족. 기각 — 종결 뒤 남은 프로필로 trigger 1 을 다시 판정한다 (§Soft constraints).

### Risk Threshold Check

| 대안 | HIGH+                                 | 판정                                         |
| ---- | ------------------------------------- | -------------------------------------------- |
| A    | 없음 (성능 M — HC5 로 관리)           | 채택 후보                                    |
| B    | 기술 H · 유지보수 H                   | 기각                                         |
| C    | 없음 — 그러나 사용자 가시 · 비용 이연 | 단독 기각 · 사용자 결정 2 의 보조 수단으로만 |
| D    | 기술 H · 유지보수 H · 마이그레이션 H  | 기각 (비용의 자리가 아님)                    |

루프 불필요 — A 에 HIGH 없음.

## Decision

**대안 A 를 채택한다.** Phase 0 이 사유별 카운터로 네 자리의 몫 (재바인드가 버린 수 · 퇴거가 버린 수 · viewport 후퇴 사유 · paragraph 미스 사유) 을 확정한 뒤 (go/no-go), 몫 순서로 레버를 적용한다 — 재바인드 후퇴 (L1) 와 캐시 인계 (L2) 를 먼저 (상한과 무관하게 15 / 21 을 없앤다), 상한 정책 (L3) 은 HC5 힙 측정과 함께, viewport 후퇴 (L4) 는 사유에 따라.

- 위험 수용 근거: A 의 잔존 위험은 「L3 가 메모리를 늘린다」 (HC5 · G1 힙 측정) 와 「인계한 picture · paragraph 가 stale」 (HC1 · G1 픽셀 oracle) 둘이고, 둘 다 기존 oracle · 측정 수단이 있다. 레버마다 원복 RED 가 ratchet `block` 으로 남는다.
- B 기각: 비용은 타일이 없어서가 아니라 있는 캐시를 버려서 생긴다 — 새 층을 들이기 전에 버리는 정책을 고친다.
- C 기각 (단독): 비용을 줌 끝으로 미룰 뿐이고 모션 중 흐림이 사용자에게 보인다. 줌 Phase 뒤에도 HC2 미달이고 남은 비용이 기록 자체 (cold 1 회의 정당한 비용) 면 사용자 결정 2.
- D 기각: 비용의 자리가 JS 캐시 정책 · 재바인드 · 브라우저 글자 측정이라 이관이 비용을 옮기지 못한다. trigger 1 재판정은 종결 뒤 프로필로.

> 구현 상세: [266-draw-cache-thrash-real-document-zoom-edit-breakdown.md](design/266-draw-cache-thrash-real-document-zoom-edit-breakdown.md)

### 사용자 결정 3건 (execute-adr 가 해당 Phase 에서 묻는다)

1. **L3 picture 상한 — Phase 0 뒤 상한을 올려야 HC2 가 닫히면**: 상한을 「직전 full 기록의 working set (hit + record 고유 요소 수) 기준 동적 · 히스테리시스」 로 하고 힙 상한 (예: WASM 힙 +N MB · GPU 메모리) 을 얼마로 두는가, 아니면 상한을 그대로 두고 L1 · L2 (재바인드 · 인계) 만으로 닫히는 범위에서 멈추는가.
2. **줌 Phase 뒤 HC2 미달이고 남은 비용이 cold 기록 1 회의 정당한 비용이면**: 대안 C (모션 중 강등 — 줌 중 흐림, 사용자 가시) 를 보조로 넣는가, 측정 기록으로 두는가.
3. **종결에서 HC2 · HC3 미달이면**: 측정 기록으로 종결 (ADR-263 · 264 · 265 와 같은 형태) vs 남은 비용 자리를 보고 Phase 추가 vs trigger 1 재판정 결과에 따라 Rust 이관 ADR 을 새로 연다.

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                            |  심각도  | 대응                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 인계한 picture · paragraph 가 stale — 재바인드가 내용을 바꾼 노드 (테마 · 폰트 로딩 · 이미지 로딩 · owner 가 칠하는 part) 에서 옛 그림이 남는다. 코드 경로: `useSkiaNode.ts` `registerSkiaNode` (37 ~ 52) · `nodePictureCache.ts` `getCachedNodePicture` (121 ~ 141, identity 키) · `retainedParagraph.ts` `resolveRetainedParagraph` (121 ~ 132) · `canvasBinding.ts` `bindInColorMode` (1354) | **HIGH** | 인계는 재바인드의 **두 단계 교체** (`retire` → `bind` → `releaseRemaining` — 지금의 「전부 unregister → bind」 순서에서는 교체 분기가 재바인드에 닿지 않는다, 리뷰 r1 H1) 안에서만 · 조건 = 명령에 bake 되는 필드 전부의 동치 (picture) · `getTextParagraphCacheKey` 동치 + 같은 fontMgr (paragraph) · 사유별 허용 (`verify` · drag 는 해제, `image-loaded` · `root` 는 비교가 거른다) · owner-drawn part 는 인계 제외 · 실패 경로는 전량 해제 · 실제 scene 경로 테스트 (리뷰 반례 = RED) · G1 픽셀 oracle (재바인드 vs 인계 0 px 차 — 테마 · 폰트 · 이미지 · part 시나리오 포함) · 원복 RED |
| R2  | 메모리 — picture 보유량이 늘어 WASM 힙 · GPU 메모리가 는다 (ADR-174 Phase 2 되돌림: 22 페이지 실문서 힙 2,147 MB abort · 텍스트 소실). 코드 경로: `nodePictureCache.ts` `MAX_NODE_PICTURES` (65) · `evictLeastRecentlyUsed` (375) · `imageCache.ts` 퇴거 역참조 (해제 순서 Picture → Image)                                                                                                     | **HIGH** | HC5 — 상한은 「직전 full 기록의 working set」 실측에 묶고 (damage 기록은 축소 금지 · 히스테리시스) 힙 상한을 둔다 · G1 힙 측정 (dev `HEAPU8` 고수위 · 처녀 힙 · 줌아웃 전 페이지 팬 반복 · 사용자 Chrome throttle 4x headed) · 사용자 결정 1 · 해제 순서 · 명시 delete 는 ADR-153 R2 그대로                                                                                                                                                                                                                                                                                                  |
| R3  | 전제 — 두 가설 (재바인드 vs 상한) 의 몫을 가르지 못해 한쪽만 고치고 「개선 없음」 으로 오판                                                                                                                                                                                                                                                                                                     |   MED    | Phase 0 사유별 카운터 · go/no-go 는 몫 표로                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R4  | 측정 — `app-pages` 는 사람 문서가 아니다 (Q1) · 유리 케이스 (한 페이지 안 줌) 만 잰다 · dev % 를 production 으로 읽음                                                                                                                                                                                                                                                                           |   MED    | 불리 케이스 명시: 22 페이지 전부 걸리는 줌아웃 · 글자 많은 Docs 페이지 줌 · 줌 중 편집 · 다 펼친 Layers · 사용자 Chrome throttle 4x headed · 카운트는 dev (등급 A) · wall-clock 은 production 짝 교대 2 쌍 · 사용자 프로젝트의 같은 문서 (`/builder/9168f5be-…`) 에서 live 1 회 (실제 사용자 환경)                                                                                                                                                                                                                                                                                           |
| R5  | ADR-264 와의 계약 — 옮기기 후퇴 조건을 좁히면 ADR-264 R 의 반례 (root 문맥 · top layer · unsafe paint) 가 다시 열린다                                                                                                                                                                                                                                                                           |   MED    | `checkTranslate` 사유는 유지하고 「하나라도 안 되면 전부 재바인드」 만 「그 root 만 재바인드」 로 — ADR-264 unit (`phase4eCanvasScene` · `subtreeTranslate.test.ts`) 전량 유지 · 원복 RED                                                                                                                                                                                                                                                                                                                                                                                                    |
| R6  | 다른 세션 WIP 와의 파일 충돌 (`CatalogCanvas.tsx` · drag 경로)                                                                                                                                                                                                                                                                                                                                  |   LOW    | `CatalogCanvas.tsx` 무변경 · 커밋은 pathspec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## Gates

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 실패 시 대안                                       |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| G0   | Phase 0    | 사유별 카운터가 하니스에 실리고 같은 옵션 2 회 같은 값 (등급 A): `movePageRoots` null 사유 (dirty · resized · `checkTranslate` reason 별) · 재바인드가 버린 picture · paragraph 수 · 퇴거 수 · paragraph 미스 사유 (소유자 교체 · 키 변경 · cold) · viewport 후퇴 사유 5 · 기록당 그린 요소 수 (상한 대비). 몫 표 — `app-pages` 줌 · 편집 · 불리 케이스 (전 페이지 줌아웃 · Docs 줌) 에서 cold miss 를 재바인드 / 퇴거 / 첫 기록으로 분해. `app-pages` ratchet run 등록 (`--add-run`) · 인위 회귀 `block` · 측정 조건 기록. go/no-go: 재바인드 또는 퇴거 몫 ≥ 50 % | 몫이 둘 다 작으면 (첫 기록이 대부분) 사용자 결정 2 |
| G1   | 레버 Phase | HC1 픽셀 oracle: 같은 상태를 (a) 새 경로 (b) 재바인드 · 캐시 off · 선형 full 로 그려 0 px 차 — 줌 0.12 · 0.3 · 0.6 · 1 · 2 · 테마 전환 · 폰트 로딩 완료 · 이미지 로딩 완료 · owner-drawn part 편집 · undo 뒤 · 레버마다 원복 RED (ratchet `block`) · 해당 카운트 하향 (재바인드 0 · 퇴거 0 또는 ≤ 상한 여유 · 후퇴 사유 해소) · HC5: L3 가 들어가면 힙 고수위 측정 (처녀 힙 · 22 페이지 줌아웃 · 전 페이지 팬 반복 3 회) 이 상한 안                                                                                                                                | 레버를 좁힌다 (인계 조건을 줄인다)                 |
| G2   | 종결       | HC2 · HC3: production 짝 (수정 전 commit ↔ 수정, 교대 2 쌍 · 줌은 headless + headed) — `app-pages` 줌 p99 ≤ 20 · drop < 1 % (headed long task 0) · 편집 p99 ≤ 20 · drop < 1 % · 합성 5k · 1만 유지 · 불리 케이스 포함 · dev `record.content` p95 ≤ 8 ms · live exercise (사용자 프로젝트의 같은 문서에서 줌 · 편집 · 테마 · 페이지 전환 · undo — 잔상 0 · Compare Mode Canvas = Preview) + ratchet `--update` · 4단계 입력 (남은 프로필 · trigger 1 재판정) 을 §기록에                                                                                             | 사용자 결정 3                                      |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 실사용 형태 문서의 줌 · 편집에서 한 번 그린 picture · paragraph 를 다시 쓴다 — 줌으로 열 수가 바뀌어도 page root 만 옮기고 (ADR-264 의 의도대로), 재바인드가 필요한 경우에도 내용이 같은 노드의 캐시를 버리지 않는다.
- 그리기 캐시의 사유별 카운터가 생겨 「cold 가 왜 cold 인가」 를 pre-push 가 지킨다. `app-pages` 가 ratchet run 이 되어 합성 격자가 가리던 비용이 게이트에 들어온다.
- 4단계 trigger 1 의 재판정 입력이 깨끗해진다 — 캐시 정책 비용이 빠진 뒤의 프로필.

### Negative

- 카운터 · 인계 조건이 그리기 층 함수 안에 들어간다 (dev 전용 분기 + 인계 비교 1 회) — 새 bake 필드 · 새 텍스트 축을 더할 때 인계 조건을 같이 고쳐야 한다 (픽셀 oracle 이 계약).
- picture 상한을 올리면 (사용자 결정 1) 메모리가 는다 — 힙 상한과 측정이 늘 따라붙는다.
- 하니스 recorder 해시 · ratchet run 이 하나 늘어 pre-push 게이트가 그만큼 길어진다.
