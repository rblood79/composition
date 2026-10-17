# ADR-273 design breakdown — Canvas 메모리 예산 (device px 여백 · GrContext 한도 · 자원별 예산 표)

> 본문: [../273-canvas-memory-budget-overscan-device-px-resource-cache.md](../273-canvas-memory-budget-overscan-device-px-resource-cache.md). 이 문서가 Phase · 파일 · 검증의 정본이다. 실측 결론은 §기록에. 코드 인용은 HEAD `94c9a0d52`.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: 기존 ADR 분리가 아니다. ADR-153 (picture · 이미지 해제 순서) · ADR-174 (paragraph 소유 · 전역 LRU 금지) · ADR-263 (content 여백 · 팬 합성) · ADR-266 결정 1 (picture 동적 상한) · ADR-270 (texture-backed 이미지 · context 소실) 이 base 이고, 이 ADR 은 그 상한들을 **한 표로 모으고 두 값 (여백 단위 · GPU 캐시 한도) 을 명시**하는 응용이다. Pen.dev 비교 확정 4 건의 넷째. 파일 겹침: `createSurface.ts` (ADR-270 R8 의 소실 · 복원 핸들 — 사용자 결정 3 으로 순서 정함) · `imageCache.ts` 상수 (값 불변, import 경로만).
2. **schema**: 문서 · 저장 schema 변경 0. `canvasMemoryBudget.ts` (상수 모음) · `createSurface.ts` 반환에 `grContext` 핸들 · 하니스 `caches.memory.*`.
3. **선행 전제 reverse 검증**: ADR-263 「여백 512 로 팬은 합성만」 은 유지 — 단위만 device 로 (DPR 1 무변화). ADR-266 「상한 = working set × 1.25 · 64 MiB」 는 값 · 산식 불변 (R4 unit). ADR-174 「전역 LRU 금지」 는 대안 B 기각으로 지킨다. ADR-270 R8 의 소실 · 복원은 이 ADR 의 context 핸들을 **쓴다** (방향: 273 Phase 2 → 270 Phase 3a, 사용자 결정 3 추천).
4. **판독**: 사용자가 요청할 때 `/review-adr 273`. phase 당 1 + 수리 검증 1.

## 1. Phase 0 — 인벤토리 · 카운트 (G0)

- **인벤토리 표** (§기록에 — 자원 · 상한 자리 · 값 · 보유량 손잡이 · 측정 조건):
  | 자원                    | 상한 (지금)                                             | 자리                                                        | 보유량 손잡이                                                                                                |
  | ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
  | content surface × 2     | 없음 (규격 = main + 512 CSS × dpr × 2)                  | `SkiaRenderer.ts:184 · 575 ~ 580`                           | 산식 (`imageInfo` × bpp)                                                                                     |
  | main surface · snapshot | 없음                                                    | `SkiaRenderer.ts`                                           | 산식                                                                                                         |
  | picture                 | working set × 1.25 (≥ 1,024) · 64 MiB                   | `nodePictureCache.ts:86 · 486 ~ 523`                        | `__composition_NODE_PICTURE_CACHE_DEBUG__.bytes`                                                             |
  | 미리 기록               | 4,096                                                   | `nodePictureCache.ts:92`                                    | 같은 핸들                                                                                                    |
  | image                   | 100 개 · soft 128 MiB                                   | `imageCache.ts:98 ~ 100`                                    | `getImageCacheMemory`                                                                                        |
  | paragraph               | 없음 (수명 = 노드)                                      | `retainedParagraph.ts`                                      | 개수 (`getCacheMetrics("paragraph")`)                                                                        |
  | GrContext               | 미명시 (Skia 기본 — Phase 0 이 scratch context 로 실측) | `createSurface.ts:29` (호출마다 새 context — resize · 복원) | Phase 0: scratch context 의 `getResourceCacheLimitBytes` · 생성 수 / Phase 2 뒤 `getResourceCacheUsageBytes` |
  | wasm 힙                 | —                                                       | —                                                           | `HEAPU8.byteLength` (예약 고수위 — 보유량 아님)                                                              |
- **카운터 · 하니스** (`renderCounters.ts` · `SkiaRenderer.ts:328` 통계 · `perf-baseline.mjs` `caches`): `memory.surfaceBytes` (산식) · `memory.surfaceCount` · `render.contentRedraws` (팬 중 content full · 여백 이탈 사유 `pan-out-of-pad`) · `memory.pictureBytes` · `imageBytes` · `paragraphCount` · (Phase 2 뒤) `memory.grCacheUsage` · `grCacheLimit`. 팬 속도 분포: 하니스 `pan` 부류의 프레임당 이동 device px 히스토그램 + **사용자 Chrome headed 팬 1 회** (`adr273-memory-live.mjs` 가 기록, Q1 보강).
- **Skia 기본 한도 실측** (r1 M1): 하니스가 숨은 canvas 에 `GetWebGLContext` → `MakeWebGLContext` → `getResourceCacheLimitBytes()` 를 읽고 `delete()` · `ck.deleteContext` 로 지운다 — 사용자 결정 2 의 기준값 (Skia 소스 `GrResourceCache` 기본 96 MiB 로 알려져 있으나 이 빌드에서 미확인). 같은 자리에서 현재 `createGPUSurface` 호출 수 (초기 1 + resize · 복원마다 +1 = 만들어진 GrContext 수) 를 센다 (r1 M2 — 지금은 삭제 없음).
- **시나리오**: `app-pages` `pan` (기본 · 빠른 팬 `--pan-speed fast`) · `zoom` · `edit`, DPR 1 (headless) + DPR 2 (`--dpr 2` headless 에뮬레이션 + headed 1 회), 이미지 fixture (`app-pages-images`, ADR-270 Phase 0 산출 — 없으면 Phase 2 의 GrContext 사용량은 폰트 atlas 만으로 기록).
- **ratchet**: `--add-keys … --keys memory.surfaceBytes,render.contentRedraws,memory.pictureBytes` (바이트는 `--fixed-inputs` 에서 결정적 — 산식 · 추정값).
- **go/no-go**: 여백 이탈 수가 팬 부류에서 0 이고 팬 속도 p95 × 2 프레임이 512 device 아래면 Phase 1 go (여백을 줄여도 이탈 0). 아니면 사용자 결정 1 값을 올린다. 5-질문 답을 §기록에.

## 2. Phase 1 — 여백을 device px 로 (G1 · G2 · G3)

- 변경은 **대입 한 곳**이다 — `contentPaddingDevicePx` 는 이미 있는 필드 (`SkiaRenderer.ts:186`) 이고 `:304` 에서 `Math.round(css × dpr)` 로 정해지며 `:1386` 의 리사이즈가 같은 식을 쓴다; `padCss = contentPaddingDevicePx / dpr` 파생 (`:697` · `:860`) 과 world 범위 · damage 변환 · `padScene` 은 이미 device 값에서 나온다. 두 대입을 `Math.round(Math.min(contentPaddingCssPx × dpr, PAD_DEVICE_MAX))` 로 바꾼다 (한 helper). `PAD_DEVICE_MAX` 는 `canvasMemoryBudget.ts` (Phase 3 에서 옮기되 Phase 1 에서 먼저 만든다). ADR-272 의 `spatialCellsVisited` 기준값이 이 값에 걸려 있다 — 이 커밋이 272 run 을 사유와 함께 재측정 (272 F3).
- **unit (G2)**: DPR 1 → 512 · DPR 2 → min(1,024, MAX) · 리사이즈 · DPR 변경 (`refit`) 뒤 재계산 · 팬 합성 좌표 (`sceneDamage` → device) 불변. 원복 RED: CSS 로 되돌리면 DPR 2 unit RED.
- **live (G1)**: `adr273-memory-live.mjs` — DPR 1 · 2 에서 새 여백 ↔ 옛 여백 content · 팬 합성 스크린샷 0 px (여백 안 팬) · 여백 이탈 팬에서 재렌더 뒤 0 px.
- **ratchet (G3)**: `memory.surfaceBytes` (DPR 2 run) ↓ · `render.contentRedraws` (pan · fast) ≤ B 상한 (Phase 0 산식) · hover · 편집 이내.

## 3. Phase 2 — context 소유 · 한도 명시 (G1 · G2 · G3)

- `createSurface.ts:29`: `MakeWebGLCanvasSurface(canvas)` → `const gl = ck.GetWebGLContext(canvas, attrs)` · `const gr = ck.MakeWebGLContext(gl)` (`MakeGrContext` 는 deprecated — d.ts:253 · 261) · `gr.setResourceCacheLimitBytes(GR_CACHE_LIMIT)` · `ck.MakeOnScreenGLSurface(gr, w, h, colorSpace)` — `attrs` · `colorSpace` 는 CanvasKit 의 `MakeWebGLCanvasSurface` 구현이 쓰는 기본 (`canvaskit.js` 의 해당 함수 본문에서 옮겨 적고 주석에 출처) 과 같게 (R2). 반환 `{ surface, grContext, backend }`. SW 폴백은 그대로 (`grContext` null).
- **리사이즈** (`SkiaRenderer.ts:1380 ~ 1399` `resize`): surface 재생성 때 같은 `grContext` 재사용 — **산 context 일 때만** (context 를 다시 만들지 않는다 — 텍스처 · atlas 유지). 지금은 호출마다 `createGPUSurface` → `MakeWebGLCanvasSurface` 가 새 GL 핸들 · GrDirectContext 를 만들고 옛 것을 지우지 않는다 (r1 M2). **소실 · 복원** (ADR-270 R8 · `CatalogCanvas.tsx:1544 ~ 1557` — 복원 콜백이 `renderer.resize(canvas)` 를 부른다): 소실 → `grContext.releaseResourcesAndAbandonContext()` → `grContext.delete()` → `ck.deleteContext(handle)` (d.ts:355) · 소유자에 abandoned 표시 → 복원의 `resize` 가 abandoned 를 보고 새 `GetWebGLContext` + `MakeWebGLContext` + 한도 재설정 → ADR-270 의 이미지 재바인드. abandoned context 를 재사용하면 `MakeOnScreenGLSurface` 가 null 을 돌려줘 SW 폴백으로 조용히 넘어간다 (R5 HIGH). 핸들 소유자는 `createSurface.ts` 한 곳.
- `GR_CACHE_LIMIT` 는 사용자 결정 2 (제안 256 MiB) — `canvasMemoryBudget.ts`.
- **unit (G2)**: `getResourceCacheLimitBytes() === GR_CACHE_LIMIT` · `imageInfo()` 가 옛 경로와 동일 (colorType · alphaType · colorSpace) · 복원 뒤 한도 재설정 · 복원 뒤 backend GPU · GrContext 1 개 · 옛 핸들 삭제 (`deleteContext` 1 회) · resize 3 회 뒤 GrContext 1 개. 원복 RED: setter 제거 → 한도 unit RED · abandoned 검사 제거 → 「복원 뒤 backend GPU」 RED.
- **live (G1)**: 옛 경로 (`MakeWebGLCanvasSurface`, 플래그 `legacySurface`) ↔ 새 경로 content 스크린샷 0 px — 반투명 · 그라데이션 (oklch alpha 함정) · 글자 · 이미지.
- **ratchet (G3)**: `memory.grCacheUsage` 90 % 초과 프레임 0 (여유 규칙 — 이미지 fixture · 줌 · 편집).

## 4. Phase 3 — 자원별 예산 표 한 곳 (G2)

- `apps/builder/src/builder/workspace/canvas/skia/canvasMemoryBudget.ts`: `PAD_DEVICE_MAX` · `GR_CACHE_LIMIT` · `MAX_NODE_PICTURE_BYTES` · `MAX_WARM_NODE_PICTURES` · `IMAGE_CACHE_BYTE_BUDGET` · `MAX_CACHE_SIZE` (이미지 개수) 를 **값 불변**으로 모으고 (기존 모듈은 re-export 또는 import), `readMemoryHoldings()` 가 보유량 표를 돌려준다 → `SkiaRenderer.ts:328` 통계 · dev 전역 `__composition_MEMORY_BUDGET__` · 하니스 `caches.memory`. 전역 LRU · 자원 가로지르는 퇴거는 두지 않는다 (ADR-174).
- **unit**: 표 값 = 옛 상수 (R4 — 스냅샷 unit) · ADR-266 상한 산식 unit 재통과 · `readMemoryHoldings` 의 키 집합.

## 5. 종결 (G4 · G5)

- G4 production 짝 — `app-pages` 팬 (기본 · fast) · 줌 · 편집 · 중첩 5k 편집 회귀 0 + **DPR 2 headed 팬** (사용자 Chrome · throttle 기록). G5 사용자 판정 (끊김 · 가장자리 빈 영역). 문서: Status · README · CHANGELOG (사용자-가시: 고해상도 화면의 메모리 · 팬) · 메모리 (여백 · 한도 값 결정).

## 6. 파일 (예상)

| 영역     | 파일                                                                                        | 변경                                                               |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| renderer | `skia/SkiaRenderer.ts`                                                                      | device px 여백 · `grContext` 재사용 · 통계                         |
| surface  | `skia/createSurface.ts`                                                                     | context 소유 · 한도 · 소실 · 복원 핸들 · 폴백                      |
| 예산     | `skia/canvasMemoryBudget.ts` (신규) · `nodePictureCache.ts` · `imageCache.ts`               | 상수 이동 (값 불변) · 보유량 표                                    |
| Canvas   | `canvas/catalog/CatalogCanvas.tsx`                                                          | 소실 · 복원 콜백이 핸들 사용 (ADR-270 R8 과 같은 자리)             |
| 카운터   | `skia/renderCounters.ts`                                                                    | `contentRedraws` (사유) · `memory.*`                               |
| 하니스   | `scripts/perf-baseline.mjs` · `scripts/adr273-memory-live.mjs` (신규) · `perf/ratchet.json` | `--dpr` · `--pan-speed` · `caches.memory` · oracle · keys          |
| 테스트   | `skia/__tests__/`                                                                           | 여백 산식 · 한도 · `imageInfo` 동일 · 상수 스냅샷 · ADR-266 재통과 |

## 7. 기록

(Phase 0 인벤토리 표 · 팬 속도 분포 · 카운트 · 5-질문 · go/no-go · 사용자 결정 1 ~ 3 답)
