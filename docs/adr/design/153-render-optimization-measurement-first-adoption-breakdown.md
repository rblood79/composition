# ADR-153 구현 상세 — 유사 빌더 렌더링 최적화 도입 (측정 보강 우선 + Picture 캐시 단계 도입)

> 본문: [153-render-optimization-measurement-first-adoption.md](../153-render-optimization-measurement-first-adoption.md)
> 상태: Proposed — **Phase 실행은 사용자 승인 후 시작 (착수 금지, 2026-07-16)**

---

## 0. 분석 원천 + 2026-07-16 실측 정정

### 0-1. 원천 문서

- [PENCIL_ECOSYSTEM_ANALYSIS.md](../../explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md) (2026-05-27) — Pencil.app / openpencil / open-pencil 3개 유사 빌더 정체·스택·차용 후보
- [PENCIL_RENDERING_OPTIMIZATION.md](../../explanation/research/PENCIL_RENDERING_OPTIMIZATION.md) (2026-05-28) — 렌더링 파이프라인·캐시 계층·측정 인프라 심층 비교 + 처방 후보 7건

### 0-2. 실측 정정 — 문서 처방 7건의 현행 코드 대조 (2026-07-16)

리서치 문서 작성(5월 말) 이후 ADR-916(자체 Rust 엔진, 7-06 Implemented) 등으로 코드가 진화하여, 문서의 격차 표 상당수가 stale 이다. 본 ADR 착수 전 실측 재판정:

| 문서 처방 후보                      | 문서 판정 (5/28)         | 2026-07-16 실측                                                                                                                                                              | 재판정               |
| ----------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| ② RBush spatial index               | "linear 순회, 즉시 도입" | **이미 해소** — Rust WASM `SpatialIndex` (cell 256) 가 hit-test/뷰포트 컬링/라쏘 소비 중 (`wasm-bindings/spatialIndex.ts`, `HoverManager.ts`, `useViewportCulling.ts`)       | **기각 (stale)**     |
| ④ RenderLayer 분리 (scene/overlays) | "❌ 단일 layer"          | **이미 해소** — `SkiaRenderer` 가 contentNode/overlayNode/screenOverlayNode 3-node 분리 + idle/present/camera-only/content/full 프레임 분류 (`SkiaRenderer.ts:30-137`)       | **기각 (stale)**     |
| ⑥ sceneBacking (T2) + stale-zoom    | "❌ 없음, 가장 큰 영역"  | **대부분 해소** — contentSurface 오프스크린 캐시 + 512px 패딩 + camera-only blit + Mitchell cubic 리샘플 + cleanup render (`SkiaRenderer.ts:38-51,60-78`)                    | 잔여만 Phase 4 로    |
| ① profiler 인프라                   | "longtask gate 뿐"       | **부분 해소** — `gpuProfilerCore.ts` 15개 MetricTracker + `cacheMetrics.ts` hit/miss 레지스트리 + `GPUDebugOverlay.tsx` HUD. **GPU 시간/draw-call/miss 사유/export 는 부재** | **Phase 1**          |
| ⑦ Paint pool 감사                   | "ad-hoc 잔존 가능"       | **격차 확정** — 풀 심볼 0건, `Paint()` 생성 75건 산재 (skia/ 디렉토리 전수). hot path 파일은 소수 (renderCommands 2 / nodeRendererShapes 5) — 분류 감사 필요                 | **Phase 2**          |
| ③⑤ node/scene Picture 캐시 (T1/T3)  | "❌ 없음"                | **격차 확정** — `PictureRecorder`/`drawPicture` 사용 0건. command stream 캐시는 단일 global all-or-nothing (`renderCommands.ts:212-269`) → 요소 1개 편집 = 전체 재기록       | **Phase 3**          |
| ⑥' incremental build budget (6ms)   | "❌"                     | **격차 확정** — content 재빌드는 동기 일괄. 프레임 분할 cursor 없음                                                                                                          | **Phase 4 (조건부)** |

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

### Phase 1 — 측정 보강 (open-pencil profiler 패턴 차용)

| 항목                  | 내용                                                                                                                                                                                                            | 대상 파일                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1-a miss 사유 분류    | `CacheMetrics.recordMiss(reason?)` 확장 + command stream/contentSurface invalidate 사유 분류 (open-pencil `scenePictureMissReason` 7분류 등가: version 불일치 종류별/페이지 전환/리사이즈/강제 invalidate)      | `cacheMetrics.ts`, `renderCommands.ts` (`getCachedCommandStream` 키 비교부), `SkiaRenderer.ts` (프레임 분류 사유) |
| 1-b draw-call counter | `executeRenderCommands` 명령 수 + 노드 렌더러 draw 호출 카운트 → `wasmTrackers` 신규 지표                                                                                                                       | `renderCommands.ts`, `nodeRenderers.ts`, `gpuProfilerCore.ts`                                                     |
| 1-c GPU 시간          | WebGL2 `EXT_disjoint_timer_query_webgl2` non-blocking poll. **선행 spike**: CanvasKit GPU surface 에서 gl context 핸들 접근 가능성 확인 (`createSurface.ts`) — 불가 시 본 항목만 축소 종결 (CPU-side 측정 유지) | `createSurface.ts`, 신규 `gpuTimer.ts`, `gpuProfilerCore.ts`                                                      |
| 1-d speedscope export | 기존 MetricTracker 샘플 + phase 시각을 speedscope JSON 으로 직렬화, HUD 에 export 버튼 (외부 의존 0 — 포맷 직렬화만)                                                                                            | 신규 `speedscopeExport.ts`, `GPUDebugOverlay.tsx`                                                                 |

- 체크리스트:
  - [ ] production 빌드 산출물에 계측 코드 미포함 (번들 diff 0) — G1
  - [ ] 계측 자체 오버헤드 < 0.5ms/frame (dev 모드 프레임 타임 전후 비교) — G1
  - [ ] Chrome MCP 로 HUD 에 draw-call/GPU time/miss 사유 표시 실동작 확인 (live behavior 게이트) — G1

### Phase 2 — Paint/자원 lifecycle 감사 + 풀링

- `Paint()` 75건 전수 grep → 3분류: (a) frame-hot (매 프레임 생성) / (b) event-hot (상호작용 시 생성) / (c) cold (init 1회 — 조치 불요)
- (a)/(b) 를 singleton paint 모듈로 풀링 (open-pencil `paints.ts` 35+ singleton 패턴) — `setColor`/`setAlphaf` reuse, 명시적 `.delete()` 단일 경로
- 기존 캐시들 (`imageCache.ts` / `gpuTextureCache.ts` / paragraph 측정 LRU / 신설 paint 풀) 의 해제 경로를 단일 destroy 심볼로 정합 (open-pencil `lifecycle.ts` 9-캐시 통합 해제 패턴, 기존 `disposable.ts` 확장)
- 체크리스트:
  - [ ] frame-hot 분류 paint 의 per-frame 생성 0건 (grep + dev 카운터)
  - [ ] destroy 경로 단일화 — 페이지 전환/캔버스 재생성 반복 시 WASM heap 증가 없음 실측

### Phase 3 — node/subtree Picture 캐시 (open-pencil T3 + textPicture 등가)

- 신규 `nodePictureCache.ts`: 노드(우선순위: 텍스트 노드 → 컨테이너 서브트리)별 `Picture` 를 record/보관, content 재빌드 시 미변경 노드는 `drawPicture` 재사용
- **적용 경로 한정 (리뷰 r1 L1)**: 서브트리 분해 대상은 command stream 경로 (`buildViaCommandStream`) **한정**. `buildViaTree` (skiaFramePipeline.ts:327) 는 sharedLayoutMap 부재 시 fallback (`publishLayoutMap(null)` — fullTreeLayout.ts:161,170 로 런타임 도달 가능) 으로 잔존하나 이중 구현 회피를 위해 분해 미적용 — 텍스트 노드 Picture 는 `nodeRendererText.ts` 공유 지점이라 양 경로에 동일 적용
- invalidate 키: **ADR-136 sceneVersion signature 를 SSOT 로 재사용** + 노드별 (props signature + **크기(size)**) — 신규 전역 버전 카운터 도입 금지. **위치(translation)는 키에서 제외 (리뷰 r1 M1)**: record 는 노드-로컬 좌표로 수행하고 이동은 draw 시 `canvas.translate` 로 적용 — 드래그/이동만으로는 re-record 하지 않는다
- **volatile 면제 (리뷰 r1 M1)**: transitionManager/animationEngine tick 승격 구간 (`SkiaRenderer.ts:485-507`) 의 활성 애니메이션 노드 + 드래그 중 노드는 캐시 대상에서 제외하고 direct draw — record+replay 가 direct draw 보다 비싼 churn 회귀 차단 (open-pencil `hasVolatileOverlay` cache skip 패턴 차용)
- WASM lifecycle 규율: Picture 객체 명시 `.delete()` + LRU 상한 + 페이지 전환 `clearAll()` + `cacheMetrics` 등록 (Phase 1 의 miss 사유 분류 즉시 활용). canvas-rendering.md §3 "WASM Paragraph 객체 캐싱 금지" 는 Paragraph 한정 규칙 — Picture 는 별개 객체이나 동일한 명시-해제 규율을 적용한다
- **캐시 간 해제 순서 (리뷰 r1 M2)**: `imageCache.ts` LRU 퇴거 (`image.delete()`, MAX 100 — imageCache.ts:48,230-248) 가 보관 Picture 의 참조 Image 를 먼저 해제하면 replay 시 해제된 WASM 객체 접근 (use-after-free). nodePictureCache 는 **image key → 참조 Picture 역참조 인덱스**를 유지하고 image 퇴거 시 해당 Picture 를 동시 invalidate 한다 (해제 순서: Picture → Image). `gpuTextureCache` 등 다른 자원 캐시도 동일 원칙 적용
- 대상 파일: 신규 `nodePictureCache.ts`, `renderCommands.ts` (command 실행을 노드 단위 record 로 분해), `nodeRendererText.ts`, `skiaFramePipeline.ts`, `imageCache.ts` (퇴거 훅), `skia/StoreRenderBridge.ts` (invalidate 연동)
- 체크리스트:
  - [ ] `/cross-check` 시각 대칭 PASS (편집 전/후 + 캐시 hit/miss 양 경로) — G2
  - [ ] 요소 1개 편집 시나리오에서 재기록 노드 수가 변경 노드 + 조상 한정임을 dev 카운터로 실측 — G2
  - [ ] 드래그/애니메이션 구간 프레임 타임 Phase 0 baseline 대비 비회귀 + 이동 중 re-record 0건 (volatile 면제 + 위치-불변 키 검증) — G2
  - [ ] image 퇴거 → 참조 Picture 동시 invalidate 실측 (stale image 렌더/crash 0) — G3
  - [ ] WASM heap 증가 상한 준수 + 페이지 전환 반복 leak 0 — G3
  - [ ] Chrome MCP 실빌더에서 텍스트 편집/이동/undo 시 stale 렌더 0 exercise (live behavior 게이트) — G2

### Phase 4 (조건부) — incremental content build budget

- **진입 게이트 G4**: Phase 0/1 실측에서 `contentRenderTime` p95 > 8ms (Phase 3 반영 후 기준) 일 때만 진입. 미달 시 본 phase 는 도입하지 않고 종결 — 복잡도 추가 회피
- 내용: content 재빌드를 6ms cursor 로 프레임 분할 (open-pencil `stepSceneBackingBuild` 패턴), 진행 중에는 기존 `contentSnapshot` blit 유지 (camera-only blit 메커니즘 재사용 — stale 잠시 → crisp 복원 UX)
- 대상 파일: `SkiaRenderer.ts` (build cursor 상태), `skiaFramePipeline.ts`
- 체크리스트:
  - [ ] 대형 페이지 편집 중 프레임 타임 spike p95 < 16.7ms 실측
  - [ ] cursor 진행 중 입력 이벤트(팬/줌/선택) 응답 유지 exercise

---

## 2. 파일 변경표 (예상 전수)

| Phase | 신규                                                          | 수정                                                                                                                                                                      |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `canvas/skia/gpuTimer.ts`, `canvas/utils/speedscopeExport.ts` | `cacheMetrics.ts`, `renderCommands.ts`, `SkiaRenderer.ts`, `nodeRenderers.ts`, `gpuProfilerCore.ts`, `createSurface.ts`, `GPUDebugOverlay.tsx`, `stores/canvasMetrics.ts` |
| 2     | `canvas/skia/paints.ts` (풀)                                  | `Paint()` 사용처 hot 분류분 (감사 결과 확정), `disposable.ts`                                                                                                             |
| 3     | `canvas/skia/nodePictureCache.ts`                             | `renderCommands.ts`, `nodeRendererText.ts`, `skiaFramePipeline.ts`, `imageCache.ts` (퇴거 훅), `skia/StoreRenderBridge.ts` 연동부                                         |
| 4     | —                                                             | `SkiaRenderer.ts`, `skiaFramePipeline.ts`                                                                                                                                 |

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
