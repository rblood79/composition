# ADR-273: Canvas 메모리 예산 — overscan 을 device px 로 · GrContext resource cache 명시 · 자원별 예산 표 (Pen.dev 비교 도입 4/4)

## Status

Implemented — 2026-10-18 (G0 ~ G5 통과 — G5 = 사용자 확인 「G5 확인했다 문제 없음, Implemented 진행해」, 아래 `### Live Exercise`). 이전: Accepted — 2026-10-18 (사용자 「ADR-273 Phase 2 진행해」 — [reviews/273.md](../reviews/273.md) r1 pending 0 · CRITICAL/HIGH 0. 진행 순서는 사용자 결정 3 의 답: 270 Phase 0 ~ 2 → **이 ADR Phase 2** → 270 Phase 3a 이후 → 이 ADR 나머지)

> **G5 통과 · Implemented (2026-10-18)**: 사용자가 DPR 2 화면의 자기 프로젝트에서 빠른 팬 · 줌 · 이미지 페이지를 확인 — 끊김 · 가장자리 빈 영역 증가 없음 (「G5 확인했다 문제 없음」). 상세 `### Live Exercise`.

> **G4 통과 2026-10-18** (production 짝 · 교대 2 쌍 · 28 run 오류 0) — 기준 `2a78ca7ad` ↔ HEAD `83ed0be8f`: DPR 1 · 2 의 `app-pages` 팬 · 빠른 팬 · 2560 × 1440 빠른 팬 · 줌 · 편집 · 중첩 5k 편집에서 표시 간격 p99 · long task 회귀 0. DPR 2 headed 팬 (Playwright · 실제 GPU 120Hz · CPU 4× — 사용자 Chrome 은 dev 서버라 production 짝 불가) p99 9.3 ms 양쪽 같음. 대가는 빠른 팬 taskMs +3 ~ 10 % (재기록 증가) 뿐. 상세: breakdown §7 G4. 다음: G5 (사용자 판정).

> **Phase 3 종결 2026-10-18** (G2) — 자원별 상한을 `canvasMemoryBudget.ts` 한 곳으로 모았다 (값 불변 — picture 바이트 64 MiB · 미리 기록 4,096 · 이미지 100 개 · 128 MiB 를 여백 · GPU 캐시 한도 옆에). 캐시 모듈은 표에서 import 하고 기존 export 는 다시 낸다. 보유량 표 `readMemoryHoldings()` (`canvasMemoryHoldings.ts` — 캐시 모듈을 import 하므로 순환을 피해 나눔) 가 surface · GPU 캐시 · picture · 이미지 · paragraph 행을 상한과 나란히 돌려준다 → dev 전역 `__composition_MEMORY_BUDGET__` · 하니스 부류마다 `memory` (게이지 — ratchet 키 아님). 자원을 가로지르는 퇴거는 없다 (ADR-174). unit 6 · 원복 RED 2/2 · ADR-266 상한 unit 재통과. 상세: breakdown §7 Phase 3.

> **Phase 0 · 1 종결 2026-10-18** (사용자 「273 나머지 착수 시작해」 · G0 · G1 · G2 · G3) — Phase 0: 인벤토리 표 · dev 카운터 (여백 이탈 재기록 · 팬 이동 분포 · surface 바이트) · 하니스 `--dpr` · `--viewport` · `--pan-speed`. 여백 이탈은 화면이 비는 것이 아니라 그 프레임의 재기록이라 여백 값은 메모리 ↔ 재기록 빈도의 교환 (이탈 1 회 기록 p95 ≤ 2 ms · p99 불변). 사용자 Chrome headed 팬은 미측정 (사용자 지시 「headless 데이터로 결정 1 진행해」). Phase 1: 여백 = `min(512 CSS × dpr, 768)` (사용자 결정 1) — DPR 1 무변화 · DPR 2 surface 합 164.5 → 132.2 MiB (1440 × 900) · 325.8 → 280.5 MiB (2560 × 1440) · 보통 팬 재기록 4 → 9. ratchet `60:app-pages@dpr2` (원복 RED 차단) · unit 원복 RED 2/2 · live 11/12 + 정해진 차이 1 (DPR 2 줌 0.3 의 글자 한 줄 1 device px — 비정수 배율에서 content 원점 반올림, 옛 코드의 팬 위치 변화와 같은 부류). 상세: breakdown §7 Phase 0 · Phase 1.

> **Phase 2 종결 2026-10-18** (G1 · G2 통과 · G3 ratchet) — 화면 GL context · GrDirectContext 를 `createSurface.ts` `CanvasSurfaceOwner` 가 소유한다. resize 는 산 context 를 재사용하고 (옛 코드는 resize · 복원마다 핸들 + GrDirectContext 를 하나씩 쌓았다), 소실은 abandon · 복원은 옛 핸들을 먼저 지운 뒤 새로 만든다 (R5). 한도 384 MiB (사용자 결정 2 — 실측 기본 256 MiB · DPR 2 고수위 251 MiB). live 12/12 (DPR 1 · 2 — 옛 경로 ↔ 소유 context 0 px · 소실 → 복원 backend GPU · GL context 1). 원복 RED 5/5. 상세: breakdown §7 Phase 2.

Proposed — 2026-10-17 (리뷰 [reviews/273.md](../reviews/273.md) Round 1 — claude, MEDIUM 2 · LOW 1 → 같은 날 반영: Skia 기본 한도를 Phase 0 이 실측 — 사용자 결정 2 의 기준값 · HC4 90 % 규칙은 여유 규칙 (M1) · GrContext 핸들 수명 — 지금은 resize · 복원마다 새 context, Phase 2 는 산 context 만 재사용 · 소실 때 폐기 · 옛 핸들 삭제 (M2, R5 → HIGH) · breakdown 인용 (L3). 수리 검증 round 는 사용자 요청 시)

- 사용자 요청: `/create-adr 남은 확정 3건 (축소 개요 LOD · 작업 범위 제한 · 메모리 예산)` (2026-10-17) — Pen.dev 1.2.18 ↔ HEAD `94c9a0d52` 비교 분석의 확정 4 건 중 **넷째**. 첫째 [ADR-270](270-image-load-path-partial-update-off-thread-decode.md) · 둘째 [ADR-271](271-zoomed-out-lod-skip-small-elements-text-line-boxes.md) · 셋째 [ADR-272](../272-bounded-spatial-query-and-warmup-work-range.md).
- 방향을 정한 사용자 원문: 「pen.dev의 패턴은 … 코드에서부터 근거로 도입하는것이 맞지않나」 · 「반드시 측정이필요한 곳과 아닌곳이 있지않나」. 등급: 「overscan 은 device px 로 센다」 · 「GPU 캐시 한도를 코드가 명시한다」 · 「자원별 예산을 한 곳에」 는 구조 (**A**), 여백 상한 · 캐시 한도 바이트 · 자원별 값은 **B** (게이트가 정한다). 팬 방향 · 속도에 따른 비대칭 여백은 C (측정 뒤).
- 사용자가 이미 답한 것: 측정은 게이트. ADR-266 사용자 결정 1 (picture 상한 = working set 동적 · 바이트 64 MB) 은 유지 — 이 ADR 은 그 값을 **예산 표의 한 행**으로 옮길 뿐 바꾸지 않는다.
- 리뷰는 사용자가 요청할 때 `/review-adr 273` → `reviews/273.md`.

## Context

**Domain**: D3 — Builder (Skia) consumer 의 자원 수명 · 크기 정책. 시각 결과 불변 (HC1). D1 · D2 무관.

### 코드 사실 (HEAD `94c9a0d52`)

| #   | 사실                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 경로                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | content surface 여백은 **512 CSS px** 이고 device px 로는 `× dpr`. surface 크기 = main + 여백 × 2 (device). ping-pong 정책으로 **2 장** (대기 surface lazy). 산술 (RGBA 8888 · MSAA · snapshot 제외): 1440 × 900 CSS · DPR 2 → 한 장 4,928 × 3,848 px ≈ **72.3 MiB**, 두 장 **144.7 MiB**. Pen 의 512 **device** px 여백은 같은 규격에서 ≈ 42.1 MiB (한 장)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `SkiaRenderer.ts:184` (CSS 512) · `:186 · :304` (`contentPaddingDevicePx = round(css × dpr)`) · `:1386` · `:575 ~ 580` (`createContentSizedSurface` = main + device 여백 × 2) · `:173 ~ 174` · `:593 ~ 597` |
| F2  | ping-pong 은 측정으로 확정된 정책 (single 대비 tail 13 ~ 18 배) — 장 수를 줄이는 것은 이 ADR 의 레버가 아니다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `SkiaRenderer.ts:163 ~ 170`                                                                                                                                                                                 |
| F3  | GPU surface 는 `MakeWebGLCanvasSurface(canvas)` 로 만든다 — CanvasKit 이 **내부에서** GL context · `GrDirectContext` 를 만들고 핸들을 돌려주지 않는다. `setResourceCacheLimitBytes` 호출 0 → Skia 내부 기본값 (코드에 적혀 있지 않다). 한도를 명시하려면 `GetWebGLContext` → `MakeWebGLContext` → `MakeOnScreenGLSurface` 로 **우리가 context 를 소유**해야 한다 (`MakeGrContext` 는 0.42.0 에서 `@deprecated` — `MakeWebGLContext` 가 정본, `MakeWebGLCanvasSurface` 내부도 이것을 쓴다 — `canvaskit.js` 의 `MakeWebGLCanvasSurface` 가 `GetWebGLContext` → `MakeWebGLContext` → `MakeOnScreenGLSurface` 순). 지금은 `resize` (`SkiaRenderer.ts:1385 ~ 1394`) 와 복원 경로 (`CatalogCanvas.tsx:1553` → `resize`) 가 호출마다 `createGPUSurface` 를 다시 불러 GL 핸들 · GrDirectContext 가 **새로** 생기고 옛 것은 삭제되지 않는다 (r1 M2) | `createSurface.ts:29 · 33` · `canvaskit-wasm/types/index.d.ts:247 · 253 (deprecated) · 261 · 274 · 688 ~ 692` (`getResourceCacheLimitBytes` · `setResourceCacheLimitBytes`)                                 |
| F4  | 자원별 상한은 **제각각 다른 자리**에 있다 — picture: 개수 동적 (working set × 1.25, 하한 1,024) + 바이트 64 MiB (`MAX_NODE_PICTURE_BYTES`) · 미리 기록 4,096 · 이미지: 100 개 + **soft** 128 MiB (`IMAGE_CACHE_BYTE_BUDGET` — 참조 중이면 넘는다) · paragraph: 상한 없음 (수명 = 노드, ADR-174) · surface: 없음 · 전체 합: 없음. picture 바이트가 작아도 그 picture 가 참조하는 이미지 · 폰트 비용은 별개다                                                                                                                                                                                                                                                                                                                                                                                                                                | `nodePictureCache.ts:86 · 92 · 486 ~ 523` · `imageCache.ts:98 ~ 100` · `retainedParagraph.ts` (상한 없음)                                                                                                   |
| F5  | 측정 손잡이: JS 힙 (`Runtime.getHeapUsage` — 하니스) · CanvasKit `HEAPU8.byteLength` 는 **예약 고수위**라 보유량이 아니다 (measurement-validity #8 · ADR-266 HC5) · picture 바이트 (`__composition_NODE_PICTURE_CACHE_DEBUG__.bytes`) · 이미지 추정 바이트 (`getImageCacheMemory`). **GPU 메모리는 직접 못 읽는다** — surface 바이트는 규격에서 계산, GrContext 사용량은 context 를 소유해야 `getResourceCacheUsageBytes`                                                                                                                                                                                                                                                                                                                                                                                                                  | `perf-baseline.mjs:1441 ~ 1467` · ADR-266 breakdown §3 HC5 · `imageCache.ts:103`                                                                                                                            |
| F6  | DPR 은 renderer 가 `this.dpr` 로 들고 리사이즈 때 반영 — 여백만 CSS 기준이라 DPR 2 에서 Pen 의 2 배 여백 (device 1,024 px) 을 쓴다. 팬 한 프레임이 지나는 거리 (수십 device px) 에 비해 과하다는 것이 분석의 지적이고, 적정값은 **팬 속도 분포** (B) 가 정한다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `SkiaRenderer.ts:304 · 1386` · `:697 · 860` (`padCss = contentPaddingDevicePx / dpr` 파생) · `:698 ~ 705`                                                                                                   |
| F7  | ADR-270 Phase 3a 가 texture-backed 이미지를 넣으면 GrContext resource cache 가 이미지 텍스처의 집이 된다 — 한도가 명시돼 있지 않으면 ADR-270 의 B 예산 (이미지 128 MiB) 과 GPU 캐시가 **따로 논다**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ADR-270 F8 · R4 · R8                                                                                                                                                                                        |
| F8  | Pen 1.2.18: 512 device px 여백 · 콘텐츠 surface 1 장 · GrContext resource-cache 한도 명시 · 자산 수요 관리 (ADR-270 C 등급)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 비교 기록 (local-only) — 수치는 참고                                                                                                                                                                        |

### 이 ADR 이 다루지 않는 것

- ping-pong → single (F2 로 기각된 정책) · content 를 저해상도로 그리기 (ADR-271 대안 D 기각).
- 전역 LRU 로 자원 종류를 가로질러 퇴거 (ADR-174 금지 — paragraph 는 노드가 소유).
- 팬 방향 · 속도 비대칭 여백 — C 등급. Phase 0 의 팬 속도 분포 뒤 별도.
- 이미지 자산 수요 관리 (base/detail) — ADR-270 의 C 등급 후속.

### Hard constraints

- **HC1 픽셀 동일**: 여백 · context 소유 방식이 바뀌어도 content · 팬 중 합성 결과가 지금과 0 px 차 (여백 안에서는 같은 픽셀, 여백 밖은 지금도 재렌더). context 를 우리가 만들 때 color space · premul · MSAA · stencil 설정이 `MakeWebGLCanvasSurface` 기본과 같다 (G1).
- **HC2 카운트 먼저**: Phase 0 이 (a) surface 바이트 (규격 산식 · 장 수) (b) 팬 중 **content 재렌더 수** (`contentRedraws` — 여백을 벗어난 횟수) (c) 자원별 보유 바이트 (picture · image · paragraph 수 · surface) (d) GrContext 사용 바이트 (context 소유 뒤) 를 등급 A 로 고정. 여백을 줄이면 (b) 가 늘 수 있다 — 상한은 **B 산식** (팬 속도 p95 × 프레임 시간 × 여유 2) 이고 Phase 0 이 분포를 잰다.
- **HC3 wall-clock 방향만**: production 짝에서 `app-pages` 팬 · 줌 · 편집 · 중첩 5k 편집 회귀 0, DPR 2 headed (사용자 Chrome) 팬 표시 간격 p99 회귀 0.
- **HC4 비용 이동 금지**: 여백 축소가 팬 중 content 재렌더를 Phase 0 의 B 상한 넘게 늘리지 않는다. GrContext 한도가 ADR-270 의 이미지 텍스처 · 폰트 atlas 를 thrash 하지 않는다 (`getResourceCacheUsageBytes` 가 한도의 90 % 를 넘는 프레임 수 = 0, 이미지 fixture) — 이것은 **여유 규칙** (working set < 0.9 × 한도) 이지 thrash 검출기가 아니다: Skia 는 예산을 넘을 때만 퇴거하므로 한도 아래 사용량은 정상 상태이고, 한도에 닿아 있으면 퇴거 · 재업로드가 있을 수 있다는 뜻이다 (r1 M1).
- **HC5 D3 대칭 · 문서 형식 변경 0**. Skia 전용 시각 효과 0.
- **HC6 기존 결정 유지**: ADR-266 결정 1 (picture 동적 상한 · 64 MiB) · ADR-174 (paragraph 수명) · ADR-153 R2 (해제 순서) · ADR-270 R8 (context 소실 → 이미지 캐시 clear + 복원 재바인드) — 예산 표는 이 값들을 **참조**하지 바꾸지 않는다.

### Soft constraints

- 측정 5-질문: Q1 `app-pages` 합성 · 규모 전용, 팬 속도 분포는 하니스의 합성 입력이라 **사용자 Chrome headed 팬 1 회**를 함께 기록 (Q1 보강). Q2 불리 = DPR 2 · 큰 viewport (2560 × 1440) · 빠른 팬 (여백 이탈) · 이미지 fixture (GPU 캐시). Q3 HEAD worktree. Q4 한도 setter 가 실제 context 에 걸렸는지 (`getResourceCacheLimitBytes` 읽어 확인). Q5 oracle = 픽셀 (다른 경로 = 옛 `MakeWebGLCanvasSurface`) + 규격 산식 손계산.
- 수치 주장: 「메모리 N MiB 절감」 은 **규격 산식**으로만 적는다 — GPU 실사용량은 못 읽는다 (F5).

## Alternatives Considered

### 대안 A: 단계적 — 인벤토리 · 카운트 → device px 여백 상한 → context 소유 + 한도 명시 → 자원별 예산 표 한 곳 (채택)

- 설명: Phase 0 이 자원별 (surface · picture · 미리 기록 · image · paragraph · GrContext) 현재 상한 · 보유량 · 측정 손잡이를 한 표로 만들고 (F4 · F5) 팬 속도 분포 · 여백 이탈 수 · surface 바이트를 잰다. Phase 1 — 여백을 `min(512 CSS × dpr, PAD_DEVICE_MAX)` (B, 제안 768 device) 로 — DPR 1 은 변화 0, DPR 2 에서 1,024 → 768 device (한 장 72.3 → 56.2 MiB 산식 — (2880 + 1536) × (1800 + 1536) × 4 B). Phase 2 — `createSurface.ts` 가 `GetWebGLContext` + `MakeWebGLContext` + `MakeOnScreenGLSurface` 로 context 를 소유하고 `setResourceCacheLimitBytes(B)` (제안: 이미지 예산 128 MiB + 폰트 · 중간 surface 여유 = 256 MiB — Phase 0 의 `getResourceCacheUsageBytes` 가 정한다) · context 소실 처리 (ADR-270 R8) 와 같은 핸들. Phase 3 — `canvasMemoryBudget.ts` 한 곳에 자원별 상한을 모으고 (기존 상수는 거기서 import) 하니스 `caches` · dev 전역에 **보유량 표**를 낸다 — 전역 LRU 는 두지 않는다 (HC6).
- 위험: 기술 **L** (CanvasKit 공개 API · 상수 이동) / 성능 **M** (여백 축소 → 팬 재렌더 ↑ 가능 — HC2 B 상한) / 유지보수 **L** (예산이 한 곳으로 모여 줄어든다) / 마이그레이션 **L** (플래그 · 상수 복귀).

### 대안 B: 전역 메모리 예산 하나 + 자원 가로질러 퇴거

- 위험: 기술 M / 성능 M / 유지보수 **H** (자원별 수명 계약 — ADR-174 paragraph · ADR-153 R2 해제 순서 — 와 충돌) / 마이그레이션 M.
- 기각: ADR-174 가 전역 LRU 를 금지한 이유 (노드 소유 · 해제 순서) 가 그대로. 예산은 **표**로 모으되 집행은 자원별.

### 대안 C: 여백을 0 으로 하고 팬마다 content 재렌더 (surface 1 장 크기 = viewport)

- 위험: 기술 L / 성능 **H** (팬 프레임마다 full record — ADR-263 이전으로 후퇴) / 유지보수 L / 마이그레이션 L.
- 기각: 여백은 팬 합성의 전제다. 줄이되 없애지 않는다.

### 대안 D: 지금 그대로 두고 CanvasKit 기본값에 맡김

- 위험: 기술 L / 성능 **M** (DPR 2 에서 Pen 의 1.7 배 surface · GPU 한도 미명시가 ADR-270 텍스처와 따로 놈 — F7) / 유지보수 **M** (상한이 다섯 자리에 흩어져 있다 — F4) / 마이그레이션 L.
- 기각: F7 — ADR-270 이 GPU 캐시를 쓰기 시작하면 한도를 모르는 채로 둘 수 없다.

### Risk Threshold Check

| 대안 | HIGH+      | 판정                     |
| ---- | ---------- | ------------------------ |
| A    | 없음       | 채택                     |
| B    | 유지보수 H | 기각 — ADR-174 금지      |
| C    | 성능 H     | 기각 — 팬 합성 전제 파괴 |
| D    | 없음 (M 2) | 기각 — ADR-270 과의 F7   |

루프 불필요.

## Decision

**대안 A.** 위험 수용 근거: Phase 1 은 상수 산식 하나 (DPR 1 무변화), Phase 2 는 surface 생성 함수 한 곳 (픽셀 oracle 로 기본 설정 동일 확인), Phase 3 은 상수 이동 + 보고. 여백 축소의 유일한 실질 위험 (팬 재렌더 증가) 은 Phase 0 의 팬 속도 분포로 B 상한을 정해 HC2 가 막는다.

기각 사유 요약: B 는 ADR-174 금지, C 는 팬 합성 전제 파괴, D 는 ADR-270 과의 F7.

**사용자 결정 N 건**:

1. **여백 상한 값** — `PAD_DEVICE_MAX` (제안 768 device px) 또는 「DPR 과 무관하게 512 device」 (Pen 값). Phase 0 의 팬 속도 p95 · 여백 이탈 수를 보고 정한다.
   - **답 (사용자 2026-10-18)**: 「768 device px (Recommended)」 — 후보 768 · 512 · 지금 유지를 Phase 0 headless 표 (DPR 2 surface 합 · 이탈 재기록 수 · 재기록 비용) 로 비교한 뒤. 상수 `CONTENT_PAD_DEVICE_MAX` (`canvasMemoryBudget.ts`).
2. **GrContext 한도 값** — 제안 256 MiB (이미지 예산 128 + 여유). Phase 0 의 `getResourceCacheUsageBytes` 고수위 (이미지 fixture) 와 **Skia 기본 한도 실측값** (Phase 0 이 scratch context 로 `getResourceCacheLimitBytes()` 를 읽는다 — Skia 소스의 `GrResourceCache` 기본은 96 MiB 로 알려져 있으나 이 빌드 (0.42.0) 에서는 미확인, r1 M1) 을 보고 정한다. 기본보다 **올리는** 결정이면 R3 의 방향은 thrash 가 아니라 보유 증가 쪽이다.
   - **답 (사용자 2026-10-18)**: 「384 MiB」. 실측 (Phase 2 가 소유한 context 의 setter 전 값 · 이미지 fixture 줌 0.3 ~ 2): **기본 한도 256 MiB** (96 MiB 아님) · 사용 고수위 DPR 1 111 MiB · DPR 2 251 MiB → 기본에서는 DPR 2 가 90 % 를 11 프레임 넘는다 (HC4 미달), 384 에서는 0. 올린 128 MiB 는 ADR-270 Phase 3a 의 텍스처 이미지 몫 — R3 은 보유 증가 쪽. 또 canvaskit 0.42.0 의 JS 래퍼 `getResourceCacheLimitBytes` · `…UsageBytes` 는 값을 `return` 하지 않아 늘 `undefined` 다 (F5 의 손잡이) — 원 메서드 `_get…Bytes` 로 읽는다.
3. **ADR-270 과의 순서** — Phase 2 (context 소유) 를 ADR-270 Phase 3a 보다 먼저 두어 texture-backed 이미지가 처음부터 명시 한도 아래 들어가게 할지 (추천), 아니면 독립 진행할지.
   - **답 (사용자 2026-10-17)**: 추천 순서 확정 — 「추천대로 하면 실제 진행은 270 Phase 0~2 → 273 Phase 2 → 270 Phase 3a 이후 → 273 나머지 → 271 → 272 가 된다. 270 Phase 3a 가 GPU texture 를 쓰기 때문에, 그 앞에서 GrContext 수명과 한도를 먼저 정리 가될수있게」. 진행 순서 = **270 Phase 0 ~ 2 → 273 Phase 2 → 270 Phase 3a 이후 → 273 나머지 → 271 → 272**. ADR-270 Phase 3a 의 선행 조건이 이 ADR 의 Phase 2 (GrContext 소유 · 수명 · 명시 한도) 완료다 (270 breakdown §4 착수 조건).

> 구현 상세: [273-canvas-memory-budget-overscan-device-px-resource-cache-breakdown.md](../design/273-canvas-memory-budget-overscan-device-px-resource-cache-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                              | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 여백 축소로 빠른 팬에서 content 재렌더 (full record) 가 늘어 팬 프레임이 끊김 — DPR 2 사용자 Chrome 에서만 보인다 (headless DPR 1 은 무변화)                                                                                                                      |  HIGH  | HC2 (b) `contentRedraws` B 상한 (팬 속도 p95 산식) · G3 ratchet · G4 **DPR 2 headed** 팬 짝 · 사용자 결정 1                                                                                                                                                                                                                                                                        |
| R2  | 우리가 만든 context 의 기본 설정 (color space · premul · MSAA · stencil · `preserveDrawingBuffer`) 이 `MakeWebGLCanvasSurface` 와 달라 픽셀 · 알파 차                                                                                                             |  HIGH  | G1 픽셀 oracle (옛 경로 ↔ 새 경로 0 px, 반투명 · 그라데이션 · 글자) + `imageInfo()` 동일 unit. 다르면 `MakeOnScreenGLSurface` 인자로 맞춘다                                                                                                                                                                                                                                        |
| R3  | GrContext 한도가 Skia 기본보다 **낮게** 정해져 폰트 atlas · ADR-270 텍스처가 thrash (프레임마다 재업로드) — 기본보다 높이면 보유 증가 쪽 (r1 M1)                                                                                                                  |  MED   | Phase 0 이 기본 한도를 실측해 결정 2 의 기준값으로 · HC4 여유 규칙 (사용량 90 % 초과 프레임 0, 이미지 fixture)                                                                                                                                                                                                                                                                     |
| R4  | 예산 표로 상수를 옮기며 ADR-266 동적 상한 · 미리 기록 하한의 산식이 끊김                                                                                                                                                                                          |  MED   | 상수 이동은 import 경로만 (값 · 산식 불변) — ADR-266 계약 unit 재실행 (HC6)                                                                                                                                                                                                                                                                                                        |
| R5  | context 소실 뒤 `resize` (복원 경로 `CatalogCanvas.tsx:1553` 이 부른다) 가 abandoned 된 GrContext 를 재사용 → `MakeOnScreenGLSurface` 가 null → SW 폴백으로 **조용히** 전환 (r1 M2) · 소실 · 복원이 두 ADR (270 R8 · 이 ADR Phase 2) 에서 따로 처리돼 순서가 꼬임 |  HIGH  | 핸들 소유자 (`createSurface.ts` 한 곳) 가 abandoned 상태를 들고 `resize` 는 산 context 만 재사용 · 소실 때 `releaseResourcesAndAbandonContext()` → `delete()` → `ck.deleteContext(handle)` (d.ts:355) → 복원 때 새 context + 한도 재설정 — G2 unit 「복원 뒤 backend GPU · GrContext 1 개 · 옛 핸들 삭제」. ADR-270 의 소실 · 복원 콜백이 이 핸들을 쓴다 (사용자 결정 3 추천 순서) |

## Gates

| Gate | 시점        | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                           | 실패 시 대안                                                             |
| ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| G0   | Phase 0 끝  | 인벤토리 표 (자원 · 상한 자리 · 보유량 손잡이 · 측정 조건) 가 breakdown §기록에 · 하니스 `caches` 에 surface 바이트 (산식) · `contentRedraws` · 자원별 바이트 · (Phase 2 뒤) GrContext 사용량 — `--fixed-inputs` 2 회 같은 값 · 팬 속도 분포 (하니스 + 사용자 headed 1 회) · **Skia 기본 한도** (scratch context 의 `getResourceCacheLimitBytes()`) · 현재 GrContext 생성 수 (resize · 복원마다 +1) | 손잡이가 없는 자원은 「측정 불가 — 산식」 으로 표에 명시 (숨기지 않는다) |
| G1   | Phase 1 · 2 | **HC1** live (headed, DPR 1 · 2): 새 여백 · 새 context ↔ 옛 경로 content · 팬 합성 스크린샷 0 px (반투명 · 그라데이션 · 글자 · 이미지 배치) · `imageInfo()` · `getResourceCacheLimitBytes()` 가 설정값                                                                                                                                                                                              | R2 차이는 인자 조정 뒤 재시도 · 못 맞추면 Phase 2 보류 (여백만)          |
| G2   | Phase 1 ~ 3 | unit: 여백 산식 (DPR 1 → 512 · DPR 2 → min(1,024, MAX)) · 예산 표 값 = 옛 상수 (R4) · ADR-266 상한 unit 재통과 · 소실 → 복원 뒤 한도 재설정 · backend GPU · GrContext 1 개 · 옛 핸들 삭제 (`deleteContext` 1 회) (R5). **원복 RED**: 산식을 CSS 로 되돌리면 DPR 2 unit RED · 한도 setter 를 빼면 `getResourceCacheLimitBytes` unit RED · abandoned 검사를 빼면 「복원 뒤 backend GPU」 RED          | GREEN 반증은 테스트 수정                                                 |
| G3   | Phase 1 · 2 | **HC2 · HC4** ratchet 같은 커밋: surface 바이트 (DPR 2 산식) ↓ · `contentRedraws` (팬) ≤ B 상한 · GrContext 90 % 초과 프레임 0 · hover · 편집 이내. 원복 RED = block                                                                                                                                                                                                                                | 재렌더 초과면 상한 값 상향 (사용자 결정 1) — 0 으로 돌리지 않는다        |
| G4   | 종결 전     | **HC3** production 짝: `app-pages` 팬 · 줌 · 편집 · 중첩 5k 편집 회귀 0 + **DPR 2 headed 팬** (사용자 Chrome, throttle 기록) 표시 간격 p99 회귀 0                                                                                                                                                                                                                                                   | 회귀면 여백 값 복귀 (플래그) → 결정 1                                    |
| G5   | Implemented | live (사용자 confirm, DPR 2): 사용자 프로젝트 빠른 팬 · 줌 · 이미지 페이지 — 끊김 · 가장자리 미렌더 (여백 이탈 시 잠깐 비는 영역) 가 지금보다 늘지 않았다는 판정                                                                                                                                                                                                                                    | 늘었다면 결정 1 재조정                                                   |

### Live Exercise

2026-10-18 — G5 통과:

- **사용자 confirm (G5)**: 사용자가 자기 Chrome (DPR 2) 에서 자기 프로젝트를 빠르게 팬 · 줌 인 · 아웃 · 이미지가 많은 페이지 진입 — 끊김 · 여백 이탈 때 가장자리가 잠깐 비는 영역이 전보다 늘지 않았다고 판정 (「G5 확인했다 문제 없음, Implemented 진행해」).
- **headed DPR 2 팬 (G4, Playwright `--headed` · 실제 GPU 120Hz · CPU 4×)**: production 기준 `2a78ca7ad` ↔ HEAD `83ed0be8f` 교대 2 쌍 — 보통 · 빠른 팬 표시 간격 p99 9.3 ms 양쪽 같음 · 25 ms 초과 0 · long task 0 · 오류 0.
- **dev builder (Phase 1 · 3, headless Chrome)**: `adr273-memory-live.mjs` 새 ↔ 옛 여백 스크린샷 11/12 0 px + 정해진 차이 1 (DPR 2 줌 0.3 글자 한 줄 1 device px — 비정수 배율의 원점 반올림) · 여백 안 팬 합성 · 여백 밖 팬 뒤 0 px. 보유량 표 `__composition_MEMORY_BUDGET__.holdings()` DPR 1 · 2 · 이미지 22 장 장면에서 surface 바이트 = 규격 산식 · 이미지 행 = 이미지 캐시 통계. 콘솔 오류 0.
- **Phase 2 (같은 날, Chrome headless)**: 옛 `MakeWebGLCanvasSurface` ↔ 소유 context 0 px (DPR 1 · 2) · `WEBGL_lose_context` 소실 → 복원 뒤 backend GPU · GL context 1.

## Consequences

### Positive

- DPR 2 에서 content surface 두 장의 산술 크기가 줄고 (144.7 → 112.4 MiB, 제안값 768 기준 산식), 여백 단위가 Pen 과 같은 device px 가 된다.
- GPU resource cache 한도가 코드에 명시되고 읽을 수 있다 — ADR-270 의 텍스처 이미지가 들어올 자리가 생긴다.
- 자원별 상한이 한 표 · 한 파일에 모이고 하니스가 보유량을 낸다 (F4 · F5 해소).

### Negative

- 여백이 줄면 빠른 팬에서 content 재렌더가 늘 수 있다 — B 상한과 DPR 2 headed 짝이 지킨다 (R1).
- surface 생성이 CanvasKit 편의 함수에서 세 호출로 바뀐다 — 기본 설정을 우리가 책임진다 (R2).
- GPU 실사용량은 여전히 직접 못 읽는다 — 산식 · GrContext 사용량으로만 말한다.
