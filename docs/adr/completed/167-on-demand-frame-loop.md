# ADR-167: on-demand 프레임 루프 — idle 시 rAF 체인 완전 정지

> **Status: Deprecated — 2026-07-26** (G0 게이트 실측 기각 — 후속 ADR 없음)
>
> **사유**: 설계 자체의 결함이 아니라 **G0 (idle wake 비용 측정 가능성) 게이트가 실측으로 불통과**했다. 유휴 비용이 **코어 1개의 0.67%** (6.7ms/s) 로, wake 누락 버그 클래스를 새로 도입하는 대가에 미치지 못한다. 상세는 아래 §G0 실측 결과. 리뷰 round 1 ([reviews/167.md](../reviews/167.md)) 은 "승인 가능" 이었으나, 그 리뷰는 배선 전제의 정합성을 본 것이고 **효과 크기는 G0 의 소관**이었다 — 순서대로 게이트가 작동한 사례.
>
> **보존 가치 (재개 시 출발점)**: ① wake 소스 인벤토리 실측 확정본 (design breakdown §3 — 프레임 내/외 분류 16/9, 상류 2 경로) ② R1a/G1a 가 포착한 오판 패턴 ("`recordInvalidation` 호출 = 허브 경유" 는 거짓 — 절반 이상이 프레임 내부 폴링) ③ 카메라 축은 `notifyUpdateListeners` 단일 지점으로 완결됨을 확증.
>
> **재개 조건**: (a) 저사양 기기 실측에서 유휴 비용이 코어 3% 이상으로 확인. ~~(b) `performanceMonitor` 무게이트 rAF 루프 해소~~ → **2026-07-26 충족** (D1 완료 — prod 잔존 상시 루프는 `renderFrame` 뿐이라 "wake 0" 은 이제 본 ADR 설계만으로 달성 가능). 단 기각의 주축은 (a) 효과 크기이므로 (b) 충족만으로는 재개 사유가 되지 않는다.
>
> **파생 후속 작업 2건** (본 ADR 없이 개별 처리 — 아래 §파생 작업):
>
> 1. `performanceMonitor.startFPSMeasurement` 의 상시 rAF 루프 제거 — **완료 2026-07-26** (DEV 게이트 대신 버스트 측정)
> 2. 렌더링 CPU 최적화의 질량은 유휴가 아니라 **상호작용 프레임** — [ADR-153](../153-render-optimization-measurement-first-adoption.md) 우선순위 근거로 본 실측 인용

## Status

Deprecated — 2026-07-26 (G0 실측 기각). 이력: Proposed 2026-07-26 → 리뷰 round 1 (이슈 5건 중 4 fixed / 1 deferred, "승인 가능") → G0 실측 불통과 → Deprecated

## G0 실측 결과 (2026-07-26, 기각 근거)

live builder (dev 빌드, 120Hz 디스플레이, DevTools 도킹 상태) 에서 rAF 콜백을 출처별로 귀속 계측. 페이지 내 자체 기록기로 92초간 213 유휴 샘플 수집 (계측자 개입이 결과를 왜곡하지 않도록 수집 중 무개입).

| 구간                | rAF 호출  | `renderFrame` 초당 누적 | 코어 1개 점유 |
| ------------------- | :-------: | :---------------------: | :-----------: |
| **유휴** (213 샘플) | 110~120Hz |   **6.7ms/s** (0~29)    |   **0.67%**   |
| 팬/줌 상호작용 (21) | 62~120Hz  |    최대 **884ms/s**     |    **88%**    |

**판정 근거 3가지**:

1. **효과 크기 미달** — 유휴 0.67% 는 wake 누락 버그 클래스 (R1/R1a) 도입 대가에 미치지 못한다. CPU 4배 감속 환경으로 선형 환산해도 약 2.7% (감속 실측은 DevTools throttle 이 끝까지 적용되지 않아 미확보 — 대신 순간 6배 지연 샘플에서 **fps 120.2 유지**가 관측되어 rAF cadence 는 CPU 속도와 무관하게 유지됨 = 선형 환산 근거).
2. **HC3 (idle wake 0/s) 이 본 ADR 단독으로 달성 불가** — `performanceMonitor.startFPSMeasurement` 의 rAF 루프가 prod 에서 게이트 없이 상시 가동 (`useAutoRecovery.ts:101` `enabled: true` 기본, `BuilderCore.tsx:378` 미전달). SkiaCanvas 루프만 멈춰도 초당 120회 wake 가 잔존하므로, on-demand 렌더링의 전력 이득 본질 (CPU 깊은 절전 진입) 이 성립하지 않는다. — **기각 시점 상태. 이 근거는 D1 완료 (2026-07-26) 로 소멸했다** (§파생 작업). 기각을 지탱하는 것은 근거 1·3.
3. **비용 질량의 위치가 다르다** — 상호작용 884ms/s vs 유휴 6.7ms/s = **약 130배**. 본 ADR 은 "프레임을 돌릴지" (6.7 쪽), ADR-153 은 "프레임 내부 비용" (884 쪽) 을 다룬다.

**초판 Context 수치 정정**: 초판이 근거로 든 "idle 초당 60회 wake" 는 ① 이 기기가 120Hz 라 실제 120회이고 ② 단발 측정치 21ms/s 는 `performance.now()` 0.1ms 양자화 + 계측 루프 자체의 잔킹이 섞여 **3배 과대**였다 (확정치 6.7ms/s). 또 초판 Consequences 의 "백그라운드 탭 전력 개선" 은 **근거 없음** — 브라우저가 hidden 탭 rAF 를 이미 완전히 중단한다 (메모리 `reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay` 가 그 동작의 실측 기록).

## 파생 작업 (본 ADR 기각과 무관하게 유효)

| #   | 작업                                                                                 | 근거                                 | 규모  | 상태                       |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------ | ----- | -------------------------- |
| D1  | `performanceMonitor.startFPSMeasurement` rAF 루프에 DEV 게이트 (또는 on-demand 전환) | prod 상시 120회/s wake — 무조건 손실 | 수 줄 | **완료 2026-07-26** (아래) |
| D2  | ADR-153 우선순위 근거에 본 실측 (상호작용 884ms/s = 코어 88%) 인용                   | 렌더 CPU 개선의 질량 위치 확증       | 문서  | 미착수                     |

**D1 처리 결과 (2026-07-26)**: DEV 게이트가 아니라 **수집 직전 60 프레임 버스트** (`sampleFPSBurst`) 로 전환했다. 게이트는 prod 에서 `fps` 를 상수 60 (`calculateFPS()` 의 빈 버퍼 fallback) 으로 고정시켜 `healthScore` 의 FPS 축(최대 -20점)과 FPS 경고를 죽이는데, 버스트는 측정 창(60 프레임)을 그대로 두고 duty cycle 만 30초 간격 기준 약 1.7% 로 줄인다. hidden 탭 등으로 버스트가 끝나지 못하면 1초 시한 후 접고 `collect()` 는 진행 (메모리 축 감시 유실 방지), 앞선 버스트 진행 중 tick 도 수집만 그대로 실행.

live 실측 — rAF 자기재예약 루프 **3개 → 2개** (`renderFrame` 120.3/s + gpuProfiler `anon` 121.5/s 만 잔존, 구 `measureFrame` 소멸), 버스트 `step` 은 46.4초 창에서 총 60회 (= 1 burst). 별도 인스턴스 end-to-end: 실측 프레임 델타 `avg 8.35ms` → `collect()` 실행 + `fps` 산출 + `stopAutoCollect` 후 rAF/timer 누수 0. 정적 가드 `performanceMonitor.static.test.ts` 가 상시 루프 부활 (`startFPSMeasurement` 심볼 / `requestAnimationFrame` 3회 이상 등장) 을 차단한다.

---

> 아래 본문은 **기각 시점 원문 보존** (설계 이력 — 대안 비교 / 리뷰 round 1 정정 내용 포함).

## Context

builder 캔버스의 rAF 루프 (`apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx` `renderFrameCore`) 는 마운트 동안 **매 프레임 무조건 다음 rAF 를 재예약**한다. `SkiaRenderer.classifyFrame` 5종 분류 (idle/present/camera-only/content/full) 로 idle 프레임의 GPU 작업은 0 이지만, **idle 에도 초당 60회 JS wake** (camera ref 읽기 / `getRegistryVersion()` / invalidation packet 확인 / 미니맵 가시성 판정) 가 상수 발생한다 — 배터리·CPU 유휴 비용과 백그라운드 전력 소비의 원인.

Pen v1.2.1 실측 ([PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md](../../explanation/research/PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md) §3-1/§6-1-b) 은 `framesRequested` 카운터로 idle 시 rAF 체인 자체를 종료 (`activeRenderLoop=false`) 하고 상태 변경 지점이 `requestFrame()` 으로 재가동한다. Figma 도 "변경 시에만 렌더" on-demand 모델을 공개적으로 채택한 선례.

composition 의 wake 배선 구조 (2026-07-26 실코드 확인 — **리뷰 round 1 에서 초판 서술을 정정**):

1. **카메라 축은 단일 허브로 완결** — `viewportState` (프레임이 읽는 뮤터블 카메라) 쓰기가 `ViewportController.notifyUpdateListeners()` **안에서만** 일어나고 (`viewport/ViewportController.ts:276-284`) 같은 함수가 listener 를 발화한다. 호출자 3곳 (`updatePan:149` / `zoomAtPoint:214` / `setPosition:235`) 이 wheel·drag·프로그램적 이동 (`panToPage` → `viewportActions.ts:119`) 전부를 덮으므로, `addUpdateListener` 구독 1곳이 카메라 wake 를 100% 커버한다. (현재 구독자 0건 — 정의만 존재하는 API)
2. **콘텐츠·오버레이 축은 허브가 아니라 폴링이다** — `recordInvalidation` (`skia/renderInvalidation.ts:85`) 호출 25곳 중 **16곳이 `renderFrameCore` 내부** (`SkiaCanvas.tsx:449-750`) 의 **변경 감지기**다. 프레임이 signature/version 을 ref 와 비교해 차이를 발견한 *결과*로 기록하는 것이라, 루프가 멈춘 상태에서는 실행 자체가 안 된다 — **`recordInvalidation` 후킹은 이 16곳에 대해 순환 (wake 불가)**. 프레임 밖 9곳 (`useSkiaNode.ts:67,83` / `SkiaCanvas.tsx:276,436,773,800,811,843,863`) 만 유효 wake 지점.
3. 따라서 **wake 는 폴링이 감지하던 상류 mutation 지점에 새로 심어야 한다** — 주요 2 경로가 현재 무기록: ① 콘텐츠 편집은 `StoreRenderBridge` 자체 구독 → `resync` → `registerSkiaNode` (`useSkiaNode.ts:40,46`) 로 `registryVersion` 만 올리고 `recordInvalidation` 을 호출하지 않는다 ② 선택/편집 컨텍스트·AI 는 `invalidationPacket` useMemo (`SkiaCanvas.tsx:173`) → `useEffect [invalidationPacket]` (`:279-281`) 가 ref 만 갱신한다. 이 두 지점이 Phase 1 의 실제 1차 배선 대상 (breakdown §3 갱신).

**인접 ADR 직교성**: [ADR-153](../153-render-optimization-measurement-first-adoption.md) (Picture 캐시 + GPU 측정 보강, Proposed) 은 **content 프레임 내부 비용** 축이고, 본 ADR 은 **프레임 실행 여부** 축 — scope 비중첩. 둘 다 측정 우선 게이트 (본 ADR G0 ↔ 153 Phase 1) 라는 방법론만 공유한다.

**SSOT 3-domain 판정**: 비대상 — builder 렌더링 인프라 (프레임 스케줄링). 시각 결과 불변이 hard constraint 이므로 D3 대칭에 영향 없음.

**Hard Constraints**:

1. **시각 결과 불변**: 모든 기존 무효화 소스에서 변경 → 다음 프레임 (≤16.7ms) 내 반영. stale 화면 0건 (breakdown §5 시나리오 8종 전수 PASS).
2. **제스처/애니메이션 60fps 유지** (성능 기준표) — 재가동 오버헤드가 제스처 시작 프레임을 놓치지 않아야.
3. **idle 시 rAF wake 0/s** (안전망 하트비트 ≤1/s 제외) — 전환의 존재 이유이자 측정 가능한 목표치.
4. hidden 탭 복귀 시 최신 상태 렌더 — 기존 rAF pause stale overlay 이슈 (메모리 `reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay`) 재발 금지.

**Soft Constraints**:

- `SkiaRenderer` frame 분류/dual surface 캐시는 검증 완료 자산 (Pen 본체와 파라미터 일치 실측) — 변경 없이 보존.
- 신규 무효화 소스 추가 시 wake 등재라는 지속 보수 의무가 추가됨 — 기존 layoutVersion 5-심볼 체인과 동급 규율로 문서화 가능해야.

## Alternatives Considered

### 대안 A: 현행 유지 (연속 rAF + idle 분류)

- 설명: 변경 없음. idle 프레임은 분류로 스킵하되 rAF 체인은 유지.
- 근거: 현행 구조 — wake 누락 버그 클래스가 원천적으로 없음.
- 위험:
  - 기술: L — 변경 없음
  - 성능: M — idle 60 wake/s 상수 지출 (배터리/CPU). Hard Constraint 3 미달
  - 유지보수: L — 현행
  - 마이그레이션: L — 해당 없음

### 대안 B: Pen 형 완전 정지 (안전망 없음)

- 설명: `framesRequested` 카운터 + 전 무효화 소스 `requestFrame()` 배선. idle 시 rAF 체인 종료. 폴백 없음.
- 근거: Pen v1.2.1 본체 프로덕션 실측 구조 그대로.
- 위험:
  - 기술: **H** — wake 소스 1곳이라도 누락 시 **영구 stale 화면** (사용자 조작 전까지 미갱신). 인벤토리 전수성을 grep 으로만 보증
  - 성능: L — idle wake 0
  - 유지보수: M — 신규 무효화 소스마다 wake 등재 의무 (누락 시 재발)
  - 마이그레이션: L — 저장 포맷 무관, 롤백 플래그 1줄

### 대안 C: 완전 정지 + 1Hz 하트비트 폴백 + dev 경고 (선택)

- 설명: B 와 동일하되, 정지 상태에서 1Hz 하트비트가 version/camera 를 비교해 변경 감지 시 wake. **dev 모드에서 하트비트발 wake 발생 시 console.warn + 계측** — wake 누락을 "영구 stale" 에서 "최대 1s 지연 + dev 가시 신호" 로 강등.
- 근거: Pen 구조 + 프로젝트 자체 회귀 이력 (hidden 탭 stale overlay) 반영. 폴백이 버그를 은폐하는 알려진 함정은 dev 경고로 상쇄.
- 위험:
  - 기술: M — 누락 결과가 1s 지연으로 강등 + dev 에서 발견 가능
  - 성능: L — idle wake ≤1/s (60→1, 98% 감소)
  - 유지보수: M — wake 등재 의무는 B 와 동일하나, 누락 시 하트비트 계측이 감지기 역할
  - 마이그레이션: L — B 와 동일 (롤백 플래그 1줄)

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  M   |    L     |      L       |     0      |
| B    |  H   |  L   |    M     |      L       |     1      |
| C    |  M   |  L   |    M     |      L       |     0      |

루프 판정: B 의 기술 HIGH 를 회피하는 대안 C 를 추가함 (1회 루프 완료). C 는 HIGH 0 — 추가 루프 불요.

## Decision

**대안 C: 완전 정지 + 1Hz 하트비트 폴백 + dev 경고**를 선택한다.

선택 근거:

1. Hard Constraint 3 (idle wake 0/s) 을 충족하면서, B 의 유일 HIGH (wake 누락 = 영구 stale) 를 하트비트로 "최대 1s 지연 + dev 가시 신호" 로 강등 — 잔존 위험이 MED 로 수용 가능.
2. 배선 대상이 **열거 가능**하고 규모가 작음 — 카메라 축은 허브 1곳 (`addUpdateListener`) 으로 완결, 나머지는 프레임 밖 `recordInvalidation` 9곳 + 상류 mutation 2 경로 (`StoreRenderBridge.resync` / `invalidationPacket` effect) + 진행형 3종. **단 "허브 후킹만으로 대부분 커버" 는 아니다** (Context 2·3 — 리뷰 정정): 프레임 안 감지기 16곳은 후킹 대상이 아니라 상류 배선으로 대체되어야 하며, 이것이 Phase 1 의 실질 작업량이다.
3. 롤백이 자명 — `CONTINUOUS_RAF_FALLBACK` 플래그 1줄로 현행 복귀 (breakdown §7).

기각 사유:

- **대안 A 기각**: idle 60 wake/s 를 영구 수용 — 전환 목적 자체 (Hard Constraint 3) 미달. 단 Phase 0 실측에서 idle wake 비용이 측정 불가 수준으로 나오면 A 잔류가 정답일 수 있어 G0 로 재판정 게이트를 둔다.
- **대안 B 기각**: wake 누락의 결과가 영구 stale 화면 (기술 HIGH). 본 프로젝트는 hidden 탭 stale overlay 실증 이력이 있어, 안전망 없는 전환은 동종 회귀를 재생산할 개연성이 높다.

> 구현 상세: [167-on-demand-frame-loop-breakdown.md](../design/167-on-demand-frame-loop-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                           | 심각도 | 대응                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | wake 소스 누락 → stale (하트비트로 최대 1s 지연 강등). 확정 경로 (리뷰 round 1): **① `StoreRenderBridge.resync` → `registryVersion` bump 무기록** (콘텐츠 편집 주경로) **② `invalidationPacket` useEffect (`SkiaCanvas.tsx:279`) 무기록** (선택/편집/AI) ③ 프레임 안 `overlayVersionRef.current++` **15곳** (초판 "3곳" 오기) 은 폴링 결과라 후킹 대상 아님 ④ `SkiaRenderer.cleanupTimer` 만료 |  MED   | Phase 0 인벤토리 grep freeze (breakdown §3) + G1 시나리오 8종 + dev 하트비트 경고 + **G1a 상류 배선 정적 가드**                         |
| R1a | 프레임 안 감지기 16곳 (`SkiaCanvas.tsx:449-750`) 을 "허브 A 후킹으로 커버됨" 으로 오판 → 순환 배선 (wake 0) 인데 커버된 것으로 보고. **초판 Context 가 실제로 이 오판을 담고 있었다**                                                                                                                                                                                                          |  MED   | Phase 1 완료 시 `recordInvalidation` 호출 지점을 프레임 내/외로 분류한 정적 가드 (G1a) — 프레임 내 호출을 wake 근거로 계상 금지         |
| R2  | 신규 무효화 소스 추가 시 wake 등재 누락 (지속 보수 의무)                                                                                                                                                                                                                                                                                                                                       |  MED   | `.claude/rules/canvas-rendering.md` 에 등재 의무 규칙 추가 (Phase 4) — 5-심볼 체인과 동급. dev 하트비트 계측이 상시 감지기              |
| R3  | transition/animation/프로그램적 카메라 애니메이션 (`panToPage`) 이 정지 상태에서 tick 을 못 받음                                                                                                                                                                                                                                                                                               |  MED   | active 동안 프레임 말미 자체 재예약 (Phase 2) + G2. 카메라 애니메이션은 허브 B (updateListener) 로 커버                                 |
| R3a | **AI 시각 이펙트가 자체 시간축 진행형** — flash 는 프레임 안에서 `performance.now()` 대비 `progress` 를 계산하고 (`SkiaCanvas.tsx:535-558`) generating 은 매 프레임 회전. `transitionManager`/`animationEngine` 소속이 아니라 R3 대응에 안 걸린다 → 정지 상태에서 이펙트가 첫 프레임에 굳음                                                                                                    |  MED   | Phase 2 진행형 재예약 조건에 `aiState.generatingNodes.size + flashAnimations.size > 0` 추가 + breakdown §5 시나리오에 AI 이펙트 항 추가 |
| R4  | 하트비트 폴백이 wake 누락 버그를 은폐                                                                                                                                                                                                                                                                                                                                                          |  LOW   | dev 모드 console.warn + `heartbeatWakeCount` 계측 (Phase 3) — G4 로 0건 확인                                                            |
| R5  | 재가동 경로 오버헤드로 제스처 첫 프레임 지연                                                                                                                                                                                                                                                                                                                                                   |  LOW   | `requestFrame()` 은 카운터 증가 + 조건부 rAF 1회 — 측정 후 G2 60fps 로 확인                                                             |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                           | 실패 시 대안                                                              |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| G0   | Phase 0 종료 | idle wake 비용이 측정 가능한 수준 (프레임당 JS 시간 실측치 기입)                                                                                                                                                    | 대안 A 잔류로 ADR 기각 (사용자 판정 — scope 변경 결정 지점)               |
| G1   | Phase 4      | breakdown §5 live 시나리오 **9종** 전수 PASS (stale 0건 — AI 이펙트 항 포함)                                                                                                                                        | 누락 소스 배선 보강 후 재실측; 2회 실패 시 `CONTINUOUS_RAF_FALLBACK` 복귀 |
| G1a  | Phase 1 종료 | `recordInvalidation` 호출 지점의 프레임 내/외 분류 정적 가드 통과 — 프레임 내 호출 (현행 16곳) 이 wake 배선 근거로 계상되지 않음 + 상류 2 경로 (`StoreRenderBridge.resync` / `invalidationPacket` effect) 배선 확증 | 배선 재설계 (허브 후킹 전제 폐기) 후 Phase 1 재수행                       |
| G2   | Phase 4      | 팬/줌 제스처 + transition 재생 중 60fps 유지                                                                                                                                                                        | 재가동 경로 최적화 또는 플래그 복귀                                       |
| G3   | Phase 4      | 완전 유휴 10s 간 rAF wake 0 (하트비트 1Hz 제외) — Performance 패널 실측                                                                                                                                             | 잔존 재예약 경로 추적 제거                                                |
| G4   | Phase 4      | 시나리오 전수 실행 동안 dev 하트비트 경고 0건                                                                                                                                                                       | 경고 발생 소스 개별 배선 후 재실행                                        |

## Consequences

### Positive

- idle 시 rAF wake 60/s → 0/s (하트비트 ≤1/s) — 배터리/CPU 유휴 비용 제거, 백그라운드 탭 전력 개선.
- 무효화 → 렌더 파이프라인이 명시적 wake 계약으로 문서화됨 (`renderInvalidation.ts` 허브의 역할 강화).
- 요소 회전/추가 오버레이 등 향후 기능도 동일 wake 규율로 수렴.

### Negative

- 신규 무효화 소스 추가 시 wake 등재라는 지속 보수 의무 추가 (`canvas-rendering.md` 규칙 + dev 계측으로 관리).
- 하트비트 (1Hz setInterval) 라는 소량의 상시 백그라운드 작업 잔존.
- wake 누락 버그 클래스가 이론상 신설됨 — 연속 rAF 가 공짜로 제공하던 자기 치유 (매 프레임 재평가) 소멸. 하트비트 + dev 경고가 대체.
