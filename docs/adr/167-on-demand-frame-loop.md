# ADR-167: on-demand 프레임 루프 — idle 시 rAF 체인 완전 정지

## Status

Proposed — 2026-07-26

## Context

builder 캔버스의 rAF 루프 (`apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx` `renderFrameCore`) 는 마운트 동안 **매 프레임 무조건 다음 rAF 를 재예약**한다. `SkiaRenderer.classifyFrame` 5종 분류 (idle/present/camera-only/content/full) 로 idle 프레임의 GPU 작업은 0 이지만, **idle 에도 초당 60회 JS wake** (camera ref 읽기 / `getRegistryVersion()` / invalidation packet 확인 / 미니맵 가시성 판정) 가 상수 발생한다 — 배터리·CPU 유휴 비용과 백그라운드 전력 소비의 원인.

Pen v1.2.1 실측 ([PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md](../explanation/research/PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md) §3-1/§6-1-b) 은 `framesRequested` 카운터로 idle 시 rAF 체인 자체를 종료 (`activeRenderLoop=false`) 하고 상태 변경 지점이 `requestFrame()` 으로 재가동한다. Figma 도 "변경 시에만 렌더" on-demand 모델을 공개적으로 채택한 선례.

composition 의 전환 비용이 낮은 구조적 근거 (2026-07-26 실코드 확인):

1. 무효화 신호 대부분이 이미 **허브 2개**를 경유 — `recordInvalidation` (`skia/renderInvalidation.ts`, ADR-035 의 7-reason 허브) + `ViewportController.addUpdateListener` (camera 이벤트). wake 배선 = 허브 후킹 2곳 + 잔여 개별 지점.
2. version 카운터 규율 (`registryVersion`/`overlayVersion`/`themeVersion` 등) 이 이미 지불된 비용 — **version bump 지점 = requestFrame 지점** 등식.

**인접 ADR 직교성**: [ADR-153](153-render-optimization-measurement-first-adoption.md) (Picture 캐시 + GPU 측정 보강, Proposed) 은 **content 프레임 내부 비용** 축이고, 본 ADR 은 **프레임 실행 여부** 축 — scope 비중첩. 둘 다 측정 우선 게이트 (본 ADR G0 ↔ 153 Phase 1) 라는 방법론만 공유한다.

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
2. 배선 비용이 구조적으로 낮음 — 허브 2개 (`recordInvalidation` / `ViewportController.addUpdateListener`) 후킹이 대부분을 커버하고, version bump 규율은 이미 지불된 비용.
3. 롤백이 자명 — `CONTINUOUS_RAF_FALLBACK` 플래그 1줄로 현행 복귀 (breakdown §7).

기각 사유:

- **대안 A 기각**: idle 60 wake/s 를 영구 수용 — 전환 목적 자체 (Hard Constraint 3) 미달. 단 Phase 0 실측에서 idle wake 비용이 측정 불가 수준으로 나오면 A 잔류가 정답일 수 있어 G0 로 재판정 게이트를 둔다.
- **대안 B 기각**: wake 누락의 결과가 영구 stale 화면 (기술 HIGH). 본 프로젝트는 hidden 탭 stale overlay 실증 이력이 있어, 안전망 없는 전환은 동종 회귀를 재생산할 개연성이 높다.

> 구현 상세: [167-on-demand-frame-loop-breakdown.md](design/167-on-demand-frame-loop-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                               | 심각도 | 대응                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------- |
| R1  | wake 소스 누락 → stale (하트비트로 최대 1s 지연 강등). 의심 경로: `overlayVersionRef.current++` 3곳 (SkiaCanvas.tsx) / `SkiaRenderer.cleanupTimer` 만료 / 허브 미경유 version bump |  MED   | Phase 0 인벤토리 grep freeze (breakdown §3) + G1 시나리오 8종 + dev 하트비트 경고                                          |
| R2  | 신규 무효화 소스 추가 시 wake 등재 누락 (지속 보수 의무)                                                                                                                           |  MED   | `.claude/rules/canvas-rendering.md` 에 등재 의무 규칙 추가 (Phase 4) — 5-심볼 체인과 동급. dev 하트비트 계측이 상시 감지기 |
| R3  | transition/animation/프로그램적 카메라 애니메이션 (`panToPage`) 이 정지 상태에서 tick 을 못 받음                                                                                   |  MED   | active 동안 프레임 말미 자체 재예약 (Phase 2) + G2. 카메라 애니메이션은 허브 B (updateListener) 로 커버                    |
| R4  | 하트비트 폴백이 wake 누락 버그를 은폐                                                                                                                                              |  LOW   | dev 모드 console.warn + `heartbeatWakeCount` 계측 (Phase 3) — G4 로 0건 확인                                               |
| R5  | 재가동 경로 오버헤드로 제스처 첫 프레임 지연                                                                                                                                       |  LOW   | `requestFrame()` 은 카운터 증가 + 조건부 rAF 1회 — 측정 후 G2 60fps 로 확인                                                |

## Gates

| Gate | 시점         | 통과 조건                                                               | 실패 시 대안                                                              |
| ---- | ------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| G0   | Phase 0 종료 | idle wake 비용이 측정 가능한 수준 (프레임당 JS 시간 실측치 기입)        | 대안 A 잔류로 ADR 기각 (사용자 판정 — scope 변경 결정 지점)               |
| G1   | Phase 4      | breakdown §5 live 시나리오 8종 전수 PASS (stale 0건)                    | 누락 소스 배선 보강 후 재실측; 2회 실패 시 `CONTINUOUS_RAF_FALLBACK` 복귀 |
| G2   | Phase 4      | 팬/줌 제스처 + transition 재생 중 60fps 유지                            | 재가동 경로 최적화 또는 플래그 복귀                                       |
| G3   | Phase 4      | 완전 유휴 10s 간 rAF wake 0 (하트비트 1Hz 제외) — Performance 패널 실측 | 잔존 재예약 경로 추적 제거                                                |
| G4   | Phase 4      | 시나리오 전수 실행 동안 dev 하트비트 경고 0건                           | 경고 발생 소스 개별 배선 후 재실행                                        |

## Consequences

### Positive

- idle 시 rAF wake 60/s → 0/s (하트비트 ≤1/s) — 배터리/CPU 유휴 비용 제거, 백그라운드 탭 전력 개선.
- 무효화 → 렌더 파이프라인이 명시적 wake 계약으로 문서화됨 (`renderInvalidation.ts` 허브의 역할 강화).
- 요소 회전/추가 오버레이 등 향후 기능도 동일 wake 규율로 수렴.

### Negative

- 신규 무효화 소스 추가 시 wake 등재라는 지속 보수 의무 추가 (`canvas-rendering.md` 규칙 + dev 계측으로 관리).
- 하트비트 (1Hz setInterval) 라는 소량의 상시 백그라운드 작업 잔존.
- wake 누락 버그 클래스가 이론상 신설됨 — 연속 rAF 가 공짜로 제공하던 자기 치유 (매 프레임 재평가) 소멸. 하트비트 + dev 경고가 대체.
