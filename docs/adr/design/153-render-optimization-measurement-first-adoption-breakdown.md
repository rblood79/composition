# ADR-153 구현 상세 — 유사 빌더 렌더링 최적화 도입 (측정 보강 우선 + Picture 캐시 단계 도입)

> 본문: [153-render-optimization-measurement-first-adoption.md](../153-render-optimization-measurement-first-adoption.md)
> 상태: Accepted — 착수 승인 2026-07-27 (`/execute-adr 153` 사용자 호출), Phase 1 부터 진행

---

## 0. 분석 원천 + 2026-07-16 실측 정정

### 0-1. 원천 문서

- [PENCIL_ECOSYSTEM_ANALYSIS.md](../../explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md) (2026-05-27) — Pencil.app / openpencil / open-pencil 3개 유사 빌더 정체·스택·차용 후보
- [PENCIL_RENDERING_OPTIMIZATION.md](../../explanation/research/PENCIL_RENDERING_OPTIMIZATION.md) (2026-05-28) — 렌더링 파이프라인·캐시 계층·측정 인프라 심층 비교 + 처방 후보 7건

### 0-2. 실측 정정 — 문서 처방 7건의 현행 코드 대조 (2026-07-16)

리서치 문서 작성(5월 말) 이후 ADR-916(자체 Rust 엔진, 7-06 Implemented) 등으로 코드가 진화하여, 문서의 격차 표 상당수가 stale 이다. 본 ADR 착수 전 실측 재판정:

| 문서 처방 후보                      | 문서 판정 (5/28)         | 2026-07-16 실측                                                                                                                                                                 | 재판정               |
| ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| ② RBush spatial index               | "linear 순회, 즉시 도입" | **이미 해소** — Rust WASM `SpatialIndex` (cell 256) 가 hit-test/뷰포트 컬링/라쏘 소비 중 (`wasm-bindings/spatialIndex.ts`, `HoverManager.ts`, `useViewportCulling.ts`)          | **기각 (stale)**     |
| ④ RenderLayer 분리 (scene/overlays) | "❌ 단일 layer"          | **이미 해소** — `SkiaRenderer` 가 contentNode/overlayNode/screenOverlayNode 3-node 분리 + idle/present/camera-only/content/full 프레임 분류 (`SkiaRenderer.ts:30-137`)          | **기각 (stale)**     |
| ⑥ sceneBacking (T2) + stale-zoom    | "❌ 없음, 가장 큰 영역"  | **대부분 해소** — contentSurface 오프스크린 캐시 + 512px 패딩 + camera-only blit + Mitchell cubic 리샘플 + cleanup render (`SkiaRenderer.ts:38-51,60-78`)                       | 잔여만 Phase 4 로    |
| ① profiler 인프라                   | "longtask gate 뿐"       | **부분 해소** — `gpuProfilerCore.ts` 15개 MetricTracker + `cacheMetrics.ts` hit/miss 레지스트리 + `GPUDebugOverlay.tsx` HUD. **GPU 시간/draw-call/miss 사유/export 는 부재**    | **Phase 1**          |
| ⑦ Paint pool 감사                   | "ad-hoc 잔존 가능"       | **격차 확정** — 풀 심볼 0건, `Paint()` 생성 77건 산재 (2026-07-27 재계수, skia/ 디렉토리 전수). hot path 파일은 소수 (renderCommands 2 / nodeRendererShapes 5) — 분류 감사 필요 | **Phase 2**          |
| ③⑤ node/scene Picture 캐시 (T1/T3)  | "❌ 없음"                | **격차 확정** — `PictureRecorder`/`drawPicture` 사용 0건. command stream 캐시는 단일 global all-or-nothing (`renderCommands.ts:270-318`) → 요소 1개 편집 = 전체 재기록          | **Phase 3**          |
| ⑥' incremental build budget (6ms)   | "❌"                     | **격차 확정** — content 재빌드는 동기 일괄. 프레임 분할 cursor 없음                                                                                                             | **Phase 4 (조건부)** |

### 0-3. 렌더링 외 차용 후보 처분 (ecosystem 문서 §8)

| 후보                                          | 처분                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Pencil.app AI dual embed (Codex + Claude SDK) | **본 ADR 범위 밖** — ADR-134 (Proposed) 의 reference 로 이미 등재                   |
| openpencil RefNode/reusable/slot schema       | **조치 불요** — ADR-116/122/130/142 로 이미 정합 (문서 §6 이 검증 완료로 판정)      |
| Pencil.app helper process 분리 (Worker 격리)  | **범위 밖** — 향후 별도 ADR 제안 영역 (web Worker 대안, 영향 범위가 본 ADR 과 직교) |
| open-pencil P2P 협업 / Kiwi override          | **범위 밖** — composition scope 외 (기존 결론 유지)                                 |
| Pencil.app native koffi Skia                  | **기각** — web browser 환경 불가 (WASM 필수)                                        |
| openpencil Paper.js boolean ops fallback      | **기각** — fallback 회피 원칙 (메모리 `feedback-no-fallback-thinking`)              |

---

## 1. Phase 구성

> 공통 규율: 각 phase 종료 시 commit 가능한 상태 유지 (CLAUDE.md §대규모 작업 phase 분할). 모든 phase 는 dev-only 계측 코드를 `process.env.NODE_ENV === "development"` 게이트로 격리 — production 초기 번들 증가 0 유지.

### Phase 0 — 인벤토리 freeze + 계측 baseline 확보

- §0-2 실측 표를 착수 시점에 재검증 (그 사이 코드 진화 가능) 후 본 문서에 갱신 커밋
- 현행 baseline 실측 기록: 대형 페이지 기준 `contentRenderTime` / `blitTime` / `skiaTreeBuildTime` p50·p95 (기존 gpuProfilerCore 지표로 측정 가능) — Phase 4 진입 게이트(G4)의 판정 근거
- 산출물: 본 문서 §0-2 갱신 + baseline 수치 표
- **2026-07-27 선행 baseline (ADR 본문 Context 분해 실측 — Phase 0 재실측 시 대조 기준)**. 측정 방법: ADR-069 `observe` 라벨 + SkiaRenderer 임시 flush/record 분해 라벨, 15s × 125Hz 합성 입력, 페이지 내 자체 기록기 (함정 3건은 ADR 본문 G1 주의 블록):

| 경로                        | 소규모 (모바일 2페이지, 63% 줌)                          | desktop 1920 밀집 (60% 줌)                                                       |
| --------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 팬 camera-only (frame 전체) | 1.04ms — JS 0.07 / 기록 ~0.53 / flush.main 0.33          | 0.92ms — JS 0.13 / 기록 ~0.46 / flush.main 0.18                                  |
| 줌 content (활성 frame 당)  | record 2.05 / flush+snapshot 2.91 (max 117.9) / JS ~0.09 | record 1.73 (전 콘텐츠 가시 p95 3.6) / flush+snapshot 1.49 (max 60.9) / JS ~0.13 |

### Phase 1 — 측정 보강 (open-pencil profiler 패턴 차용) — **Implemented 2026-07-27**

> 1-a~1-e 전 항목 반영. G1 통과 기록은 아래 체크리스트 각주 참조. GPU timer (1-c) 는
> live 실측에서 `EXT_disjoint_timer_query_webgl2` 지원 확인 — 축소 종결 불필요 (HUD GPU 1.7~2.0ms 표시).
> 계측 모듈 (cacheMetrics 확장 / drawStats / gpuTimer / speedscopeExport / HUD 확장) 은
> production 번들에서 전부 tree-shake 확인 — 잔여 diff 는 `classifyFrame` 사유 문자열
> (분류 로직 자체는 core 상주, 기록만 dev 게이트) 뿐.

| 항목                  | 내용                                                                                                                                                                                                            | 대상 파일                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1-a miss 사유 분류    | `CacheMetrics.recordMiss(reason?)` 확장 + command stream/contentSurface invalidate 사유 분류 (open-pencil `scenePictureMissReason` 7분류 등가: version 불일치 종류별/페이지 전환/리사이즈/강제 invalidate)      | `cacheMetrics.ts`, `renderCommands.ts` (`getCachedCommandStream` 키 비교부), `SkiaRenderer.ts` (프레임 분류 사유) |
| 1-b draw-call counter | `executeRenderCommands` 명령 수 + 노드 렌더러 draw 호출 카운트 → `wasmTrackers` 신규 지표                                                                                                                       | `renderCommands.ts`, `nodeRenderers.ts`, `gpuProfilerCore.ts`                                                     |
| 1-c GPU 시간          | WebGL2 `EXT_disjoint_timer_query_webgl2` non-blocking poll. **선행 spike**: CanvasKit GPU surface 에서 gl context 핸들 접근 가능성 확인 (`createSurface.ts`) — 불가 시 본 항목만 축소 종결 (CPU-side 측정 유지) | `createSurface.ts`, 신규 `gpuTimer.ts`, `gpuProfilerCore.ts`                                                      |
| 1-d speedscope export | 기존 MetricTracker 샘플 + phase 시각을 speedscope JSON 으로 직렬화, HUD 에 export 버튼 (외부 의존 0 — 포맷 직렬화만)                                                                                            | 신규 `speedscopeExport.ts`, `GPUDebugOverlay.tsx`                                                                 |

| 1-e record/flush 분해 라벨 상설화 | 2026-07-27 임시 계측 라벨 3종 (`render.skia.record.content` / `render.skia.flush.content` / `render.skia.flush.main`) 을 dev-only 상설 라벨로 도입 — G2 의 "flush.content 누적 감소" 판정과 Phase 0 baseline 재실측의 공급 지표 (미도입 시 G2 가 참조하는 지표를 어느 phase 도 제공하지 않음) | `SkiaRenderer.ts`, `builder/utils/perfMarks.ts` (PERF_LABEL 상수) |

- 체크리스트:
  - [x] production 빌드 산출물에 계측 코드 미포함 (번들 diff 0) — G1 ✅ 2026-07-27: `vite build` 산출물 grep — `missReasons`/`Export trace`/`speedscope`/`__composition_CACHE_METRICS__` 0건 (`EXT_disjoint_timer_query_webgl2` 1건은 CanvasKit 자체 코드로 판명)
  - [x] 계측 자체 오버헤드 < 0.5ms/frame (다수 프레임 누적 판정) — G1 ✅ 2026-07-27: 줌 오실레이션 구동 중 `render.frame` mean 0.23ms (n=1000) — 계측 포함 전체 프레임 비용이 이미 기준 미만
  - [x] Chrome MCP 로 HUD 에 draw-call/GPU time/miss 사유 표시 실동작 확인 (live behavior 게이트) — G1 ✅ 2026-07-27: HUD `GPU 2.02ms` / `Cmds 6 / Draws 2` / `commandStream miss: forced 279, registry 6` / `contentSurface miss: invalidate 281, registry 6` 표시 + 분해 라벨 3종 142 표본 + speedscope 직렬화 stack-valid/단조 검증 (다운로드 낙하만 CDP 자동화 세션의 Chrome 다운로드 억제로 미확인 — 앱 결함 아님, 수동 세션에서 클릭 시 정상 경로)

### Phase 2 — Paint/자원 lifecycle 감사 + 풀링 — **Implemented 2026-07-27**

> 감사 결과 77건 (재계수 — disposable.ts 1건은 주석 예시) 3분류: (a) frame-hot
> per-draw = node 렌더러 + renderCommands + effects + overlay 렌더러 / (b)
> event-hot = dropIndicator·slotMarker·aiEffects·workflow 계열 (뷰/상호작용
> 활성 시에만) / (c) cold = `LRUTextureCache` (인스턴스 0건 휴면 — 조치 불요).
> **(a)/(b) 전량 (77건) 을 free-list 풀로 전환** — purpose-named singleton 대신
> 명시 acquire/release 를 택한 이유: workflowRenderer 가 4~9개 paint 를 함수
> 스코프에서 동시 보유 + 루프 재사용하는 형태라 ring 재활용과 충돌한다.
> scope 사이트는 `acquireScopedPaint(scope, ck)` shim 으로 `SkiaDisposable`
> 계약 유지. 재발 방지: `paintPool.static.test.ts` 가 skia/ 소스의 직접
> `new ck.Paint()` 0건을 정적 강제.

- `Paint()` 전수 grep (2026-07-27 기준 77건, 착수 시 재계수) → 3분류: (a) frame-hot (매 프레임 생성) / (b) event-hot (상호작용 시 생성) / (c) cold (init 1회 — 조치 불요)
- (a)/(b) 를 singleton paint 모듈로 풀링 (open-pencil `paints.ts` 35+ singleton 패턴) — `setColor`/`setAlphaf` reuse, 명시적 `.delete()` 단일 경로
- 기존 캐시들 (`imageCache.ts` / `gpuTextureCache.ts` / paragraph 측정 LRU / 신설 paint 풀) 의 해제 경로를 단일 destroy 심볼로 정합 (open-pencil `lifecycle.ts` 9-캐시 통합 해제 패턴, 기존 `disposable.ts` 확장)
- 체크리스트:
  - [x] frame-hot 분류 paint 의 per-frame 생성 0건 (grep + dev 카운터) ✅ 2026-07-27: 정적 — `paintPool.static.test.ts` 가 skia/ 직접 생성 0건 강제. live — 줌 오실레이션 150틱 후 paintPool hits 9,742 / 생성(grow) 2 / 풀 크기 2 (종전엔 9,742회 전부 WASM malloc+free)
  - [x] destroy 경로 단일화 — 페이지 전환/캔버스 재생성 반복 시 WASM heap 증가 없음 실측 ✅ 2026-07-27: `registerSkiaCacheDestroy`/`destroyAllSkiaCaches` (disposable.ts) 에 paintPool + imageCache 등록, SkiaCanvas unmount 한정 발화. live — dashboard 이탈(unmount) 후 재진입 시 grow 2→4 (파괴→재구축 증명) + size 2 재안정 + 미반환 경고 0 + 시각 무결. `clearImageCache` 는 종전 호출자 0건이던 휴면 함수를 실배선

### Phase 3 — node/subtree Picture 캐시 (open-pencil T3 + textPicture 등가)

- 신규 `nodePictureCache.ts`: 노드(우선순위: 텍스트 노드 → 컨테이너 서브트리)별 `Picture` 를 record/보관, content 재빌드 시 미변경 노드는 `drawPicture` 재사용
- **적용 경로 한정 (리뷰 r1 L1)**: 서브트리 분해 대상은 command stream 경로 (`buildViaCommandStream`) **한정**. `buildViaTree` (skiaFramePipeline.ts:337) 는 sharedLayoutMap 부재 시 fallback (`publishLayoutMap(null, …)` — engines/fullTreeLayout.ts:245,254 로 런타임 도달 가능) 으로 잔존하나 이중 구현 회피를 위해 분해 미적용 — 텍스트 노드 Picture 는 `nodeRendererText.ts` 공유 지점이라 양 경로에 동일 적용
- invalidate 키: **ADR-136 sceneVersion signature 를 SSOT 로 재사용** + 노드별 (props signature + **크기(size)**) — 신규 전역 버전 카운터 도입 금지. **위치(translation)는 키에서 제외 (리뷰 r1 M1)**: record 는 노드-로컬 좌표로 수행하고 이동은 draw 시 `canvas.translate` 로 적용 — 드래그/이동만으로는 re-record 하지 않는다
- **volatile 면제 (리뷰 r1 M1)**: transitionManager/animationEngine tick 승격 구간 (`SkiaRenderer.ts:483-535`) 의 활성 애니메이션 노드 + 드래그 중 노드는 캐시 대상에서 제외하고 direct draw — record+replay 가 direct draw 보다 비싼 churn 회귀 차단 (open-pencil `hasVolatileOverlay` cache skip 패턴 차용)
- WASM lifecycle 규율: Picture 객체 명시 `.delete()` + LRU 상한 + 페이지 전환 `clearAll()` + `cacheMetrics` 등록 (Phase 1 의 miss 사유 분류 즉시 활용). canvas-rendering.md §3 "WASM Paragraph 객체 캐싱 금지" 는 Paragraph 한정 규칙 — Picture 는 별개 객체이나 동일한 명시-해제 규율을 적용한다
- **캐시 간 해제 순서 (리뷰 r1 M2)**: `imageCache.ts` LRU 퇴거 (`image.delete()`, MAX 100 — imageCache.ts:48,230-248) 가 보관 Picture 의 참조 Image 를 먼저 해제하면 replay 시 해제된 WASM 객체 접근 (use-after-free). nodePictureCache 는 **image key → 참조 Picture 역참조 인덱스**를 유지하고 image 퇴거 시 해당 Picture 를 동시 invalidate 한다 (해제 순서: Picture → Image). `gpuTextureCache` 등 다른 자원 캐시도 동일 원칙 적용
- **스냅샷 정책 (격차 5, 2026-07-27 분해 실측 — R7)**: 현행 `renderContent` 는 활성 프레임마다 `contentSurface.flush()` + `makeImageSnapshot()` 을 수행 — 다음 프레임 clear 시 거대 content surface 의 copy-on-write 복사 유발 가능 구조 (flush+snapshot 이 content 프레임의 ~반, max 117.9ms 스파이크). 두 옵션을 Phase 3 설계 시 실측 비교 후 택일:
  - (a) **모션 중 content 승격 강등** — "재렌더는 하되 스냅샷만 생략" 은 불가능하다 (`present()` 는 `contentSnapshot` blit 만으로 화면을 만들므로 — `SkiaRenderer.ts:360-364` — 스냅샷 없는 재렌더는 화면에 도달하지 않는다). 따라서 (a) 의 실체는 모션 중 zoomTooLarge/outOfCoverage 로 인한 content 승격 자체를 camera-only 로 강등하고, cleanup(200ms) 재렌더에서만 재래스터+스냅샷하는 형태다. 위험: 모션 중 품질 저하 (리샘플 blur / 커버리지 이탈 빈 영역) 가 cleanup 까지 지속
  - (b) **content surface ping-pong** — surface 2장을 교대로 사용해 "그리는 표면 ≠ 스냅샷 표면" 을 보장, CoW 복사 제거. 위험: WASM/GPU 메모리 1장분 추가 (G3 heap 상한에 포함)
- **캐시 키 2차 확장 — reusable master 공유 (1차 invalidation 캐시 G2/G3 통과 후에만)**: `master id + override signature` 를 Picture 캐시 키로 쓰면 오버라이드 없는 동일 master 인스턴스 N 개가 기록 1회 + 재생 N 회가 된다 (canonicalRefResolution 이 인스턴스마다 master 서브트리를 전개하므로 현행은 인스턴스마다 전량 재기록). 실사용에서 인스턴스별 override (items fork / 텍스트 차이) 가 흔해 공유율이 제한될 수 있으므로 **선행 조건: Phase 1 miss 사유 분류에 "master 공유 가능이었으나 override 로 미공유" 카운트를 넣어 이득 실측 후 도입 판정**
- 대상 파일: 신규 `nodePictureCache.ts`, `renderCommands.ts` (command 실행을 노드 단위 record 로 분해), `nodeRendererText.ts`, `skiaFramePipeline.ts`, `imageCache.ts` (퇴거 훅), `skia/StoreRenderBridge.ts` (invalidate 연동), `SkiaRenderer.ts` (스냅샷 정책)
- 체크리스트:
  - [ ] `/cross-check` 시각 대칭 PASS (편집 전/후 + 캐시 hit/miss 양 경로) — G2
  - [ ] 요소 1개 편집 시나리오에서 재기록 노드 수가 변경 노드 + 조상 한정임을 dev 카운터로 실측 — G2
  - [ ] 드래그/애니메이션 구간 프레임 타임 Phase 0 baseline 대비 비회귀 + 이동 중 re-record 0건 (volatile 면제 + 위치-불변 키 검증) — G2
  - [ ] image 퇴거 → 참조 Picture 동시 invalidate 실측 (stale image 렌더/crash 0) — G3
  - [ ] WASM heap 증가 상한 준수 + 페이지 전환 반복 leak 0 — G3
  - [ ] Chrome MCP 실빌더에서 텍스트 편집/이동/undo 시 stale 렌더 0 exercise (live behavior 게이트) — G2
  - [ ] 스냅샷 정책 적용 시 flush.content (flush+makeImageSnapshot) 누적 감소 + 모션 종료 프레임 시각 무결성 실측 — G2 (R7)

### Phase 4 (조건부) — incremental content build budget

- **진입 게이트 G4**: Phase 0/1 실측에서 `contentRenderTime` p95 > 8ms (Phase 3 반영 후 기준) 일 때만 진입. 미달 시 본 phase 는 도입하지 않고 종결 — 복잡도 추가 회피
- 내용: content 재빌드를 6ms cursor 로 프레임 분할 (open-pencil `stepSceneBackingBuild` 패턴), 진행 중에는 기존 `contentSnapshot` blit 유지 (camera-only blit 메커니즘 재사용 — stale 잠시 → crisp 복원 UX)
- 대상 파일: `SkiaRenderer.ts` (build cursor 상태), `skiaFramePipeline.ts`
- 체크리스트:
  - [ ] 대형 페이지 편집 중 프레임 타임 spike p95 < 16.7ms 실측
  - [ ] cursor 진행 중 입력 이벤트(팬/줌/선택) 응답 유지 exercise

---

## 2. 파일 변경표 (예상 전수)

| Phase | 신규                                                          | 수정                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `canvas/skia/gpuTimer.ts`, `canvas/utils/speedscopeExport.ts` | `cacheMetrics.ts`, `renderCommands.ts`, `SkiaRenderer.ts`, `nodeRenderers.ts`, `gpuProfilerCore.ts`, `createSurface.ts`, `GPUDebugOverlay.tsx`, `stores/canvasMetrics.ts`, `builder/utils/perfMarks.ts` (1-e, prefix 예외) |
| 2     | `canvas/skia/paints.ts` (풀)                                  | `Paint()` 사용처 hot 분류분 (감사 결과 확정), `disposable.ts`                                                                                                                                                              |
| 3     | `canvas/skia/nodePictureCache.ts`                             | `renderCommands.ts`, `nodeRendererText.ts`, `skiaFramePipeline.ts`, `imageCache.ts` (퇴거 훅), `skia/StoreRenderBridge.ts` 연동부                                                                                          |
| 4     | —                                                             | `SkiaRenderer.ts`, `skiaFramePipeline.ts`                                                                                                                                                                                  |

> 경로 prefix: `apps/builder/src/builder/workspace/canvas/`

---

## 3. 검증 매트릭스

| 검증                   | 수단                                                                    | 대응 Gate |
| ---------------------- | ----------------------------------------------------------------------- | --------- |
| production 번들 무증가 | `pnpm build` 산출물 diff                                                | G1        |
| 시각 대칭 (D3)         | `/cross-check` + Chrome MCP 스크린샷                                    | G2        |
| WASM 메모리            | dev HUD heap 지표 + 페이지 전환 반복 시나리오                           | G3        |
| Phase 4 진입 판정      | Phase 0 baseline vs Phase 3 후 p95 실측                                 | G4        |
| live behavior          | Chrome MCP 실빌더 exercise (완료 기준 — test/type-check 단독 종결 금지) | 전 phase  |
