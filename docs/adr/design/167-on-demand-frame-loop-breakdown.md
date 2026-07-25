# ADR-167 Design Breakdown: on-demand 프레임 루프 — idle 시 rAF 체인 완전 정지

> 본 문서는 [ADR-167](../167-on-demand-frame-loop.md) 의 구현 상세. 결정 근거/대안/위험은 ADR 본문 참조.

## 1. 전제 lock-in

- 완전 신규 주제 ADR (fork/분리 아님 — adr-writing §Fork 게이트 비대상).
- scope: **SkiaCanvas rAF 루프의 재예약 조건**과 그 wake 배선. `SkiaRenderer` 의 5종 frame 분류 / dual surface 캐시 (Phase 6) 는 **변경하지 않는다** — 분류는 "프레임이 돌 때 무엇을 할지", 본 ADR 은 "프레임을 돌릴지" 만 담당.
- 출처: Pen v1.2.1 실측 분석 §6-1-b / §6-2 차용 후보 ① ([PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md](../../explanation/research/PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md)).

## 2. 현행 구조 (2026-07-26 실코드)

- `SkiaCanvas.tsx` `renderFrameCore`: 프레임 진입 즉시 **무조건** `rafId = requestAnimationFrame(renderFrame)` 재예약 — `running` 동안 체인 유지.
- idle 프레임에도 프레임당 JS 실행: camera 뮤터블 ref 읽기, `getRegistryVersion()`, invalidation packet 확인, 미니맵 가시성 판정 등 (renderFrameCore 전반부) → `SkiaRenderer.classifyFrame` 이 idle 판정 시 GPU 작업 0 으로 스킵.
- Pen v1.2.1: `framesRequested` 카운터가 0 이면 rAF 체인 종료 (`activeRenderLoop=false`), 상태 변경 지점이 `requestFrame()` 으로 재가동.

## 3. Wake 소스 인벤토리 (초기 — Phase 0 에서 grep freeze)

무효화 신호의 대부분은 이미 두 허브를 경유한다. wake 배선은 허브 후킹이 1차, 허브 미경유 지점 개별 배선이 2차.

| 분류        | 소스                                                                                       | 현행 메커니즘                                        | wake 배선 방식                         |
| ----------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------- |
| 허브 A      | `recordInvalidation` (7 reasons — content/layout/viewport/overlay/theme/resource/workflow) | `skia/renderInvalidation.ts` (ADR-035)               | 허브 내부에서 `requestFrame()` 1곳     |
| 허브 B      | camera pan/zoom                                                                            | `ViewportController.addUpdateListener` (이벤트 존재) | listener 구독 → `requestFrame()`       |
| version     | `registryVersion` bump (`useSkiaNode` 등록/`notifyLayoutChange`)                           | `recordInvalidation("content", ...)` 동반            | 허브 A 로 커버 — 미동반 bump grep 확증 |
| version     | `overlayVersionRef.current++` (SkiaCanvas 3곳)                                             | 직접 증가                                            | 증가 지점에 `requestFrame()` 병기      |
| 내부 타이머 | `SkiaRenderer.cleanupTimer` (200ms 후 `needsCleanupRender`)                                | setTimeout — **정지 상태면 만료가 무효** (미소비)    | 타이머 콜백에서 wake 콜백 호출         |
| 진행형      | `transitionManager` / `animationEngine` `isActive()`                                       | 연속 rAF 에 무임승차                                 | active 동안 프레임 말미 자체 재예약    |
| 진행형      | `panToPage` 등 프로그램적 카메라 애니메이션                                                | 자체 rAF → ViewportController 갱신                   | 허브 B 로 커버                         |
| 환경        | resize / DPR 변경                                                                          | `renderer.resize` + `contentDirty`                   | resize 핸들러에 `requestFrame()`       |
| 환경        | `visibilitychange` (hidden 탭 복귀)                                                        | 브라우저 rAF pause 의존                              | visible 복귀 시 `requestFrame()`       |
| 환경        | theme 전환                                                                                 | `setupThemeWatcher` → `invalidateContent()` + record | 허브 A 로 커버                         |

**Phase 0 freeze 절차**: `registryVersion|overlayVersion|themeVersion|visibleContentVersion|visiblePagePositionVersion|allPageFrameVersion` bump 지점 + `recordInvalidation(` 호출 지점 전수 grep → 위 표를 확정본으로 갱신. 허브 미경유 bump 발견 시 개별 배선 행 추가.

## 4. Phase 계획

### Phase 0 — 실측 + 인벤토리 freeze (코드 변경 없음)

- idle 1초당 `renderFrameCore` 누적 JS 시간 실측 (dev profiler / Performance 패널). 기존 dev metric (`idleFrameRatio`/`presentFramesPerSec`) 병기 기록.
- §3 인벤토리 grep freeze.
- 산출물: 본 문서 §3 확정 + ADR 본문 Context 에 실측 수치 기입. **G0 판정**: idle wake 비용이 측정 불가 수준 (프레임당 <0.05ms 급) 이면 사용자에게 계속/중단 판정 요청 (결정 지점 ④ scope 변경에 해당).

### Phase 1 — framesRequested 도입 + 허브 배선

- `SkiaCanvas.tsx`: `framesRequested` 카운터 + `requestFrame()` (idle 종료 상태면 rAF 재가동). 재예약 조건 `framesRequested > 0` 으로 전환. 롤백 플래그: `CONTINUOUS_RAF_FALLBACK` 상수 1개 — true 시 현행 연속 모드 (1줄 복귀).
- 허브 A (`recordInvalidation`) 내부 + 허브 B (camera listener) 구독 배선.
- `overlayVersionRef` 증가 3곳 병기 배선.

### Phase 2 — 타이머/진행형 배선

- `SkiaRenderer` cleanupTimer 만료 → wake 콜백 (renderer 가 SkiaCanvas 의 requestFrame 을 주입받음).
- transition/animation active 동안 프레임 말미 재예약 (`applyAnimationOverrides` 반환값 활용).
- resize / visibilitychange 배선.

### Phase 3 — 하트비트 폴백 + dev 경고

- 정지 상태에서 1Hz `setInterval` 하트비트: version/camera 비교 후 변경 감지 시 `requestFrame()`.
- **dev 모드**: 하트비트가 non-idle 프레임을 승격시키면 `console.warn("[frame-loop] wake 누락 소스 감지")` + 계측 카운터 (`heartbeatWakeCount`) — 은폐 방지 (R4).
- prod: 경고 없이 안전망만.

### Phase 4 — live 검증 + 규칙 등재

- §5 시나리오 전수 live 실측 (Chrome MCP) + idle 시 rAF wake 0 확인 (Performance 패널).
- `.claude/rules/canvas-rendering.md` 에 "신규 무효화 소스 추가 시 wake 등재 의무" 규칙 추가 (layoutVersion 5-심볼 체인과 동급 보수 의무).
- CHANGELOG + ADR Implemented 승격.

## 5. Live 검증 시나리오 (G1 통과 조건)

| #   | 시나리오                                           | 기대                                        |
| --- | -------------------------------------------------- | ------------------------------------------- |
| 1   | 요소 prop/style 편집                               | 다음 프레임 반영 (stale 0)                  |
| 2   | 팬/줌 제스처 (wheel/drag) + `panToPage` 애니메이션 | 60fps 유지, 종료 후 정지                    |
| 3   | 테마 light↔dark 전환                               | 즉시 재렌더                                 |
| 4   | hidden 탭 30s+ 후 복귀                             | 최신 상태 렌더 (stale overlay 재발 금지)    |
| 5   | transition/animation 재생                          | 재생 중 매 프레임, 종료 후 정지             |
| 6   | 드래그 이동/리사이즈, 텍스트 편집 진입·타이핑      | 실시간 반영                                 |
| 7   | 카메라 정지 + 선택 hover (overlay 만 변경)         | present 프레임 발화                         |
| 8   | 완전 유휴 10s                                      | rAF wake 0 (하트비트 1Hz 만), 콘솔 경고 0건 |

## 6. 파일 변경 인벤토리 (추정 — Phase 0 재확정)

| 파일                                | 변경                                            |
| ----------------------------------- | ----------------------------------------------- |
| `skia/SkiaCanvas.tsx`               | framesRequested/requestFrame + 재예약 조건 전환 |
| `skia/renderInvalidation.ts`        | 허브 wake 후킹 (콜백 등록 API)                  |
| `skia/SkiaRenderer.ts`              | cleanupTimer wake 콜백 주입                     |
| `viewport/ViewportController.ts`    | (변경 없음 — 기존 addUpdateListener 구독)       |
| `skia/transitionManager.ts` 등      | active 재예약 (SkiaCanvas 측 처리로 흡수 가능)  |
| `.claude/rules/canvas-rendering.md` | wake 등재 의무 규칙                             |
| `apps/builder/tests/**` 또는 unit   | requestFrame 카운터/하트비트 승격 unit 테스트   |

## 7. 롤백

`CONTINUOUS_RAF_FALLBACK = true` 1줄로 현행 연속 rAF 복귀 (Phase 1 도입). 저장 포맷/스키마 무관 — BC 위험 없음.
