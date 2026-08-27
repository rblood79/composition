# ADR-167 Design Breakdown: on-demand 프레임 루프 — idle 시 rAF 체인 완전 정지

> **⚠️ ADR-167 은 Deprecated (2026-07-26, G0 실측 기각)** — 본 breakdown 은 **미실행**이다. 기각 근거는 [ADR-167 §G0 실측 결과](../completed/167-on-demand-frame-loop.md) 참조.
>
> **다만 §3 (Wake 소스 인벤토리) 은 실측 확정본으로 재개 시 그대로 유효**하다 — 프레임 내/외 분류 (16/9), 상류 2 경로 (`StoreRenderBridge.resync` / `invalidationPacket` effect), 카메라 축 단일 지점 완결. 프레임 루프를 건드리는 향후 작업은 여기서 출발할 것.

> 본 문서는 [ADR-167](../completed/167-on-demand-frame-loop.md) 의 구현 상세. 결정 근거/대안/위험은 ADR 본문 참조.

## 1. 전제 lock-in

- 완전 신규 주제 ADR (fork/분리 아님 — adr-writing §Fork 게이트 비대상).
- scope: **SkiaCanvas rAF 루프의 재예약 조건**과 그 wake 배선. `SkiaRenderer` 의 5종 frame 분류 / dual surface 캐시 (Phase 6) 는 **변경하지 않는다** — 분류는 "프레임이 돌 때 무엇을 할지", 본 ADR 은 "프레임을 돌릴지" 만 담당.
- 출처: Pen v1.2.1 실측 분석 §6-1-b / §6-2 차용 후보 ① ([PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md](../../explanation/research/PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md)).

## 2. 현행 구조 (2026-07-26 실코드)

- `SkiaCanvas.tsx` `renderFrameCore`: 프레임 진입 즉시 **무조건** `rafId = requestAnimationFrame(renderFrame)` 재예약 — `running` 동안 체인 유지.
- idle 프레임에도 프레임당 JS 실행: camera 뮤터블 ref 읽기, `getRegistryVersion()`, invalidation packet 확인, 미니맵 가시성 판정 등 (renderFrameCore 전반부) → `SkiaRenderer.classifyFrame` 이 idle 판정 시 GPU 작업 0 으로 스킵.
- Pen v1.2.1: `framesRequested` 카운터가 0 이면 rAF 체인 종료 (`activeRenderLoop=false`), 상태 변경 지점이 `requestFrame()` 으로 재가동.

## 3. Wake 소스 인벤토리 (리뷰 round 1 실측 확정 — 2026-07-26)

> **초판 정정**: 초판은 "무효화 신호 대부분이 허브 2개를 경유하므로 허브 후킹 2곳이 1차 배선" 이라 서술했다. 실측 결과 **`recordInvalidation` 은 절반 이상이 프레임 *내부* 폴링 감지기**이므로 후킹 대상이 아니다. 아래가 확정본.

### 3-1. 판정 기준 — 프레임 내 호출은 wake 가 될 수 없다

`recordInvalidation` 호출 25곳의 위치 분류 (`SkiaCanvas.tsx` `renderFrameCore` = **line 449-750**):

| 위치            | 개수 | 지점                                                                             | wake 자격                                                   |
| --------------- | :--: | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **프레임 내부** |  16  | `SkiaCanvas.tsx:484,491,519,527,539,553,558,566,573,583,591,598,605,611,629,639` | ❌ **없음** — 프레임이 돌아야 실행되므로 정지 상태에서 순환 |
| 프레임 외부     |  9   | `useSkiaNode.ts:67,83` / `SkiaCanvas.tsx:276,436,773,800,811,843,863`            | ✅ 유효 (허브 후킹 1곳으로 일괄 커버)                       |

프레임 내부 16곳은 signature/version 을 ref 와 비교해 차이를 발견한 **결과**를 기록한다 (예: `packet.selection.selectionSignature !== lastSelectionSignatureRef.current` → `:519`). 정지 상태에서는 비교 자체가 실행되지 않는다.

### 3-2. 확정 인벤토리

| 분류                    | 소스                                                                                                                                                               | 현행 메커니즘                                                                                                                                                                                                                                             | wake 배선 방식                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 허브 (카메라)           | 카메라 pan/zoom/프로그램적 이동                                                                                                                                    | `ViewportController.notifyUpdateListeners()` (`:276-284`) 가 `viewportState` 쓰기 + listener 동작을 **같은 함수에서** 수행. 호출자 3곳 (`:149` updatePan / `:214` zoomAtPoint / `:235` setPosition). `panToPage` → `viewportActions.ts:119` → setPosition | `addUpdateListener` 구독 1곳 → `requestFrame()` — **카메라 축 100% 커버**  |
| 허브 (프레임 외 record) | 위 3-1 의 프레임 외부 9곳 (registry clear / notifyLayoutChange / rendererInput / theme / contextRestored / pageSwitch / imageLoaded / containerResize / dprChange) | `recordInvalidation(...)`                                                                                                                                                                                                                                 | 허브 내부에서 `requestFrame()` 1곳                                         |
| **상류 ①**              | **콘텐츠 편집 (주경로)**                                                                                                                                           | `StoreRenderBridge` 자체 store 구독 → `resync` (`StoreRenderBridge.ts:187-196`) → `registerSkiaNode`/`unregisterSkiaNode` → `registryVersion++` (`useSkiaNode.ts:40,46`). **`recordInvalidation` 호출 없음**                                              | `resync` 말미에 `requestFrame()` (또는 register/unregister 에 wake 콜백)   |
| **상류 ②**              | **선택 / editingContext / AI 상태**                                                                                                                                | `invalidationPacket` useMemo (`SkiaCanvas.tsx:173`, store 구독 파생) → `useEffect [invalidationPacket]` (`:279-281`) 가 **ref 만 갱신**                                                                                                                   | 해당 useEffect 에 `requestFrame()`                                         |
| 내부 타이머             | `SkiaRenderer.cleanupTimer` (200ms → `needsCleanupRender`)                                                                                                         | `setTimeout` (`SkiaRenderer.ts:232-238`) — 콜백은 프레임 밖에서 실행되나 소비할 프레임이 없음                                                                                                                                                             | 타이머 콜백에서 wake 콜백 호출 (renderer 가 requestFrame 주입받음)         |
| 내부 타이머             | minimap fade (1500ms, `SkiaCanvas.tsx:488-492`)                                                                                                                    | 프레임 안에서 예약되나 콜백은 프레임 밖 → `recordInvalidation("overlay","minimapHide")`                                                                                                                                                                   | 허브 (프레임 외 record) 로 커버                                            |
| 진행형                  | `transitionManager` / `animationEngine` `isActive()`                                                                                                               | 연속 rAF 무임승차 (`SkiaRenderer.ts:485-487`)                                                                                                                                                                                                             | active 동안 프레임 말미 자체 재예약                                        |
| **진행형**              | **AI flash / generating 이펙트**                                                                                                                                   | 프레임 안에서 `performance.now()` 대비 progress 계산 (`SkiaCanvas.tsx:535-558`). transition/animation 소속 아님                                                                                                                                           | 재예약 조건에 `generatingNodes.size + flashAnimations.size > 0` 추가 (R3a) |
| 환경                    | resize / DPR 변경                                                                                                                                                  | `recordInvalidation("content","containerResize")` / `("resource","dprChange")` (프레임 외)                                                                                                                                                                | 허브 (프레임 외 record) 로 커버                                            |
| 환경                    | `visibilitychange` (hidden 탭 복귀)                                                                                                                                | 브라우저 rAF pause 의존 — 현행 무배선                                                                                                                                                                                                                     | visible 복귀 시 `requestFrame()` 신규                                      |

### 3-3. Phase 0 freeze 잔여 확인 항목

- `visibleContentVersion` / `visiblePagePositionVersion` / `allPageFrameVersion` 의 상류 갱신 지점이 위 상류 ①·② 밖에 있는지 grep (현재는 `sceneInvalidationPacket` (`BuilderCanvas.tsx:797`) 파생으로 상류 ② 와 같은 계열로 추정 — 확증 필요).
- `packet.dragActive` 는 `SkiaCanvas.tsx:155` 에서 `false` 하드코딩이라 `:571` 분기가 **현재 dead**. 드래그 wake 는 상류 ① (StoreRenderBridge) 경로에 의존하는지 확인 — dead 분기를 살릴지는 본 ADR scope 밖 (발견 사실만 기록).
- `layoutVersion` 계열은 `notifyLayoutChange` (`useSkiaNode.ts:82-83`) 가 record 동반 → 허브 커버 확인됨.

## 4. Phase 계획

### Phase 0 — 실측 + 인벤토리 freeze (코드 변경 없음)

- idle 1초당 `renderFrameCore` 누적 JS 시간 실측 (dev profiler / Performance 패널). 기존 dev metric (`idleFrameRatio`/`presentFramesPerSec`) 병기 기록.
- §3 인벤토리 grep freeze.
- 산출물: 본 문서 §3 확정 + ADR 본문 Context 에 실측 수치 기입. **G0 판정**: idle wake 비용이 측정 불가 수준 (프레임당 <0.05ms 급) 이면 사용자에게 계속/중단 판정 요청 (결정 지점 ④ scope 변경에 해당).

### Phase 1 — framesRequested 도입 + 허브·상류 배선

- `SkiaCanvas.tsx`: `framesRequested` 카운터 + `requestFrame()` (idle 종료 상태면 rAF 재가동). 재예약 조건 `framesRequested > 0` 으로 전환. 롤백 플래그: `CONTINUOUS_RAF_FALLBACK` 상수 1개 — true 시 현행 연속 모드 (1줄 복귀).
- 배선 4곳 (§3-2 확정 인벤토리 순):
  1. 카메라 허브 — `ViewportController.addUpdateListener` 구독 (신규 구독자, 기존 API)
  2. `recordInvalidation` 허브 후킹 — **프레임 외부 9곳만 유효**하다는 전제를 코드 주석에 명시 (프레임 내 16곳은 후킹이 무의미)
  3. **상류 ①** `StoreRenderBridge.resync` 말미 wake (콘텐츠 편집 주경로)
  4. **상류 ②** `SkiaCanvas.tsx:279` `useEffect [invalidationPacket]` wake (선택/편집/AI)
- **G1a 정적 가드 작성**: `recordInvalidation` 호출을 프레임 내/외로 분류해 개수를 단언 (현행 16/9). 프레임 내 호출이 늘어나면 FAIL — "허브 후킹으로 커버됨" 오판 재발 차단.
- ~~`overlayVersionRef` 증가 3곳 병기 배선~~ — 초판 오기. 실제 15곳이며 **전부 프레임 내부**라 배선 대상 아님 (§3-1).

### Phase 2 — 타이머/진행형 배선

- `SkiaRenderer` cleanupTimer 만료 → wake 콜백 (renderer 가 SkiaCanvas 의 requestFrame 을 주입받음).
- 진행형 재예약 조건 (프레임 말미): `transitionManager.isActive() || animationEngine.isActive() || aiState.generatingNodes.size + aiState.flashAnimations.size > 0` — **AI 이펙트 항 필수** (R3a, §3-2).
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
| 7   | 카메라 정지 + 선택 hover (overlay 만 변경)         | present 프레임 동작                         |
| 8   | **AI 이펙트 (generating 회전 / flash 페이드)**     | **재생 중 매 프레임, 종료 후 정지** (R3a)   |
| 9   | 완전 유휴 10s                                      | rAF wake 0 (하트비트 1Hz 만), 콘솔 경고 0건 |

## 6. 파일 변경 인벤토리 (추정 — Phase 0 재확정)

| 파일                                | 변경                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `skia/SkiaCanvas.tsx`               | framesRequested/requestFrame + 재예약 조건 전환 + `useEffect [invalidationPacket]` (`:279`) wake (상류 ②) + AI 진행형 재예약 조건 |
| `skia/StoreRenderBridge.ts`         | **`resync` 말미 wake (상류 ① — 콘텐츠 편집 주경로)**                                                                              |
| `skia/renderInvalidation.ts`        | 허브 wake 후킹 (콜백 등록 API) — 프레임 외부 9곳에만 유효함을 주석 명시                                                           |
| `skia/SkiaRenderer.ts`              | cleanupTimer wake 콜백 주입                                                                                                       |
| `viewport/ViewportController.ts`    | (변경 없음 — 기존 addUpdateListener 구독만 추가)                                                                                  |
| `.claude/rules/canvas-rendering.md` | wake 등재 의무 규칙                                                                                                               |
| unit / static guard                 | requestFrame 카운터 · 하트비트 승격 · **G1a 프레임 내/외 분류 정적 가드 (16/9)**                                                  |

## 7. 롤백

`CONTINUOUS_RAF_FALLBACK = true` 1줄로 현행 연속 rAF 복귀 (Phase 1 도입). 저장 포맷/스키마 무관 — BC 위험 없음.
