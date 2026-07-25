# ADR-153: 유사 빌더 렌더링 최적화 도입 — 측정 보강 우선 + Picture 캐시 단계 도입

## Status

Proposed — 2026-07-16

> **착수 금지 (사용자 지시)**: 본 ADR 은 분석·결정 기록까지만 생성. Phase 실행은 사용자 승인 후 시작.

## Context

유사 빌더 3종 (Pencil.app / openpencil / open-pencil) 심층 분석 문서 2건 — [PENCIL_ECOSYSTEM_ANALYSIS.md](../explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md) (2026-05-27), [PENCIL_RENDERING_OPTIMIZATION.md](../explanation/research/PENCIL_RENDERING_OPTIMIZATION.md) (2026-05-28) — 이 open-pencil 의 production-grade 렌더링 패턴 (3-tier retained backing / phase profiler / paint pool / RBush) 을 composition 의 격차로 판정하고 처방 후보 7건을 제시했다.

**2026-07-16 코드 실측 재판정**: 문서 작성(5월 말) 이후 코드가 진화하여 (ADR-916 자체 Rust 엔진 등) 처방 후보의 절반은 이미 해소됐다 — RBush 는 Rust WASM `SpatialIndex` (`wasm-bindings/spatialIndex.ts`) 로, RenderLayer 분리와 T2 backing 은 `SkiaRenderer.ts` 의 dual-surface + 프레임 분류 (idle/present/camera-only/content/full) + camera-only blit 으로 이미 존재한다. **잔존 실제 격차는 4건**:

1. **Picture(display list) 캐시 0건** — `PictureRecorder`/`drawPicture` 사용 전무. command stream 캐시는 단일 global all-or-nothing (`renderCommands.ts:212-269`) 이라 요소 1개 편집이 전체 stream 재빌드 + `contentSurface` 전체 재페인트를 유발
2. **incremental build budget 부재** — content 재빌드가 동기 일괄 실행, 대형 페이지에서 프레임 spike 가능
3. **측정 격차** — `gpuProfilerCore.ts` 15개 CPU-side 트래커는 있으나 GPU 시간 (`EXT_disjoint_timer_query_webgl2`) / draw-call 카운트 / 캐시 miss **사유** 분류 / 프로파일 export(speedscope) 부재. rAF 기반 FPS 는 모니터 주사율 반영 (gpuProfilerCore.ts:91 주석 자인) 이라 실제 렌더 비용을 대변하지 못함
4. **Paint 풀·통합 lifecycle 부재** — 풀 심볼 0건, `Paint()` 생성 75건 산재 (hot/cold 미분류)

**2026-07-26 비용 분포 실측 (본 ADR 의 우선순위 근거)**: live builder 에서 rAF 콜백을 출처별로 귀속 계측한 결과, `renderFrame` 의 초당 누적 실행 시간은 **유휴 6.7ms/s (코어 1개의 0.67%, 213 샘플) vs 팬/줌 상호작용 최대 884ms/s (88%, 21 샘플)** — 약 **132배** 차이다. 즉 렌더 CPU 개선의 질량은 "프레임을 **돌릴지**" (유휴 축) 가 아니라 "프레임 **내부 비용**" (상호작용 축) 에 있고, 본 ADR 의 처방 (Picture 캐시 / Paint 풀 / incremental budget) 이 정확히 그 축이다. 유휴 축을 다룬 [ADR-167](completed/167-on-demand-frame-loop.md) (on-demand 프레임 루프) 은 같은 실측으로 G0 기각됐다 — 본 ADR 의 상대 우선순위는 그 판정의 반대편 근거다. 상세 실측 기록: ADR-167 §G0 실측 결과.

이 실측은 위 격차 3(측정 격차) 의 진단도 뒷받침한다 — 순간 6배 지연 샘플에서도 rAF cadence 는 **fps 120.2 를 유지**해, FPS 지표가 실제 렌더 비용과 무관하게 움직인다는 것이 관측됐다 (`gpuProfilerCore.ts:91` 주석의 자인과 일치).

**Phase 0 인벤토리 선행 실측 2건 (2026-07-26, R5 대응 — 착수 시 재확인 대상)**:

- **Picture API 실현 가능성 확보** — live 페이지의 CanvasKit 싱글턴 (`window.__composition_CANVASKIT_INSTANCE__`, `__composition_CANVASKIT_PROMISE__` 와 동일 객체) 에 `PictureRecorder` / `MakePicture` / `_MakePicture` / `Canvas.prototype.drawPicture` 가 **모두 존재**한다. Phase 3 의 "CanvasKit 빌드에 Picture API 가 없을 위험" spike 는 불필요.
- **유휴 프레임 draw 호출 0건** — `Canvas.prototype` 의 `draw*`/`save*`/`clip*` 전량을 감싸 240 + 192 프레임 관측, 누적 0건. 인터셉터 유효성은 같은 인스턴스의 scratch surface 에서 2/2 가로챔으로 별도 증명 (양성 대조 없이 "0건" 을 결론으로 쓰지 않기 위함). 즉 프레임 분류가 이미 그리기 단계를 건너뛰고 있어, **개선 여지는 전부 content/camera 프레임 안**에 있다. Phase 1 draw-call 카운터의 baseline 은 0 (유휴) 에서 출발한다.

리서치 문서 §5-1 의 본질 통찰은 유지된다: **무엇이 느린지 모르면 캐시 설계 자체가 추측이다** — 측정 보강이 캐시 도입의 선결 단계.

**3-Domain 판정**: 본 ADR 은 D1/D2/D3 SSOT 경계를 변경하지 않는다. D3 consumer(Skia 렌더러) 내부의 렌더링 인프라 최적화이며, **시각 결과 불변** (Builder↔Preview 대칭 유지) 이 hard constraint 다. Spec/Generator 확장 아님 — Generator emit 능력 선언 해당 없음.

**Hard Constraints**:

1. Canvas 60fps / 초기 로드 < 3초 / 초기 번들 < 500KB (CLAUDE.md 성능 기준) — 계측 코드는 dev-only 게이트로 production 번들 증가 0
2. 시각 결과 불변 — 캐시 hit/miss 양 경로 모두 `/cross-check` 시각 대칭 PASS
3. invalidate 키는 ADR-136 `sceneVersion` signature 를 SSOT 로 재사용 — 신규 전역 버전 카운터 도입 금지
4. WASM 객체 명시-해제 규율 — canvas-rendering.md §3 의 Paragraph 캐싱 금지와 동일 규율을 Picture 객체에 적용 (명시 `.delete()` + LRU 상한 + 페이지 전환 clear)
5. BC 0% — runtime 내부 최적화로 canonical schema/props/공개 API 무변경, 기존 프로젝트 재직렬화 0건

**Soft Constraints**:

- 리서치 문서의 stale 전제 재유입 방지 — 착수 시점 Phase 0 인벤토리 재실측 의무
- ADR-150 (collection 가상화 스크롤 60fps) / ADR-117 (CanvasKit 업그레이드) 과 직교 — 본 ADR 은 프레임 파이프라인 캐싱·측정 계층만 다룸

## Alternatives Considered

### 대안 A: open-pencil 3-tier 일괄 이식 (T1 scenePicture + T2 sceneBacking + T3 subtree + profiler 전부)

- 설명: 리서치 문서 §1 의 open-pencil 구조 (`retained-backing.ts` 428 LOC + `pipeline.ts` 347 LOC + `profiler/` 723 LOC) 를 통째로 이식
- 근거: open-pencil v0.12.2 실제 소스 분석 — 유일한 production-grade 다층 캐시 reference
- 위험:
  - 기술: **H** — T2 가 기존 `contentSurface` dual-surface 캐시와 역할 중복 → 이중 캐시 계층의 invalidate 경합. 기존 프레임 분류 5종과 open-pencil 의 RenderLayer 계약이 충돌
  - 성능: M — bitmap backing + Picture 병행 보관으로 WASM 메모리 2중 부담
  - 유지보수: **H** — 기존 자산 (`SkiaRenderer` 767 LOC) 위에 외부 구조 1,500 LOC 유입, 두 세계관 공존
  - 마이그레이션: M — 단계 rollback 불가 (일괄 교체)

### 대안 B: 측정 보강 우선 + evidence 기반 단계 도입 (채택)

- 설명: Phase 1 측정 보강 (miss 사유 분류 / draw-call / GPU 시간 / speedscope export) → Phase 2 Paint·lifecycle 감사·풀링 → Phase 3 node/subtree Picture 캐시 (T3 등가, 기존 contentSurface 를 대체하지 않고 그 위 보완) → Phase 4 incremental build budget (Phase 1 실측 evidence 게이트 통과 시에만 조건부 진입)
- 근거: 리서치 문서 §5-1 (측정이 선결) + open-pencil `scenePictureMissReason`/`phase-timer`/`paints.ts` 개별 패턴 + Skia Picture 캐싱은 Chrome/Flutter 계열의 업계 표준 display-list 패턴. 기존 자산 (dual-surface, SpatialIndex, gpuProfilerCore) 을 전부 보존·확장
- 위험:
  - 기술: M — Picture invalidate 키 설계가 ADR-136 signature 와 정확히 연동돼야 함 (누락 시 stale 렌더). GPU timer 는 CanvasKit surface 의 gl context 접근 가능성 spike 필요 (불가 시 해당 항목만 축소)
  - 성능: L — dev-only 계측 + Picture 캐시는 LRU 상한. 각 phase 독립 실측 게이트
  - 유지보수: M — 신규 캐시 1계층 + 계측 모듈 추가 (전량 기존 구조의 확장 지점에 배치)
  - 마이그레이션: L — phase 별 독립 커밋·rollback 가능, BC 0

### 대안 C: 최소 점 도입 (측정 보강 + Paint 감사만, Picture 캐시 미도입)

- 설명: Phase 1/2 만 수행하고 캐시 구조는 현행 유지
- 근거: 위험 최소화 우선 관점
- 위험:
  - 기술: L / 성능: L / 유지보수: L / 마이그레이션: L
  - 단, 목표 미달 — 요소 1개 편집 = 전체 재기록 구조가 그대로 남아 enterprise 빌더 target (메모리 `feedback-composition-enterprise-target`: retained 캐시 = 차용 후보/Must) 의 본질 격차 미해소

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  H   |  M   |    H     |      M       |     2      |
| B    |  M   |  L   |    M     |      L       |     0      |
| C    |  L   |  L   |    L     |      L       |     0      |

루프 판정: HIGH 0 대안 (B, C) 존재 — 추가 대안 루프 불필요. CRITICAL 없음.

## Decision

**대안 B: 측정 보강 우선 + evidence 기반 단계 도입**을 선택한다.

선택 근거:

1. HIGH 0 이면서 유일하게 본질 격차 (content 변경 전량 재기록 + 측정 부재) 를 해소하는 대안. Phase 4 를 실측 evidence 게이트 (G4) 뒤에 두어 "필요 없으면 도입하지 않는" 종결 경로를 내장 — 복잡도 위험을 구조적으로 상한
2. 기존 자산 보존 — dual-surface/SpatialIndex/gpuProfilerCore 를 대체가 아닌 확장 지점으로 사용, 두 세계관 공존 문제 회피
3. 잔존 위험 (invalidate 키 누락, WASM 누수) 은 Gates G2/G3 의 cross-check + heap 실측으로 관리 가능한 수준

기각 사유:

- **대안 A 기각**: T2/RenderLayer 가 기존 contentSurface·프레임 분류와 역할 중복 — 이미 보유한 것을 외부 구조로 다시 들여와 이중 캐시 invalidate 경합 + 유지보수 HIGH. 리서치 문서의 stale 격차 표를 그대로 믿은 처방이 됨
- **대안 C 기각**: 위험은 최소지만 enterprise target 의 본질 격차 (편집 응답성) 미해소. 단, C 의 내용물 (Phase 1/2) 은 B 의 선행 phase 로 전부 포함됨
- **부수 기각 (문서 처방 중)**: RBush 도입 — Rust `SpatialIndex` 로 이미 해소 (stale). Pencil.app native koffi Skia — web 환경 불가. Paper.js fallback — fallback 회피 원칙 위반. P2P 협업/Kiwi override — scope 밖. AI dual embed — ADR-134 영역. Worker process 분리 — 본 ADR 과 직교, 향후 별도 ADR 제안 영역

> 구현 상세: [153-render-optimization-measurement-first-adoption-breakdown.md](design/153-render-optimization-measurement-first-adoption-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                       |  심각도  | 대응                                                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Picture 캐시 invalidate 키 누락 → stale 시각 회귀. 코드 경로: `renderCommands.ts:212-269` 단일 캐시 키, `SkiaRenderer.ts:127` invalidateContent all-or-nothing, ADR-136 `buildSceneStructureSnapshot()` signature 입력 목록                                                                                                                                                | **HIGH** | invalidate 키를 sceneVersion signature SSOT 로 강제 + Phase 1 miss 사유 분류를 선행 도입해 miss/stale 을 1급 신호화 + G2 (cross-check + 편집 시나리오 exercise)                                                                                       |
| R2  | Picture/Paint WASM 객체 누수 + **캐시 간 해제 순서 의존** — 명시 해제 실패 시 장기 세션 메모리 증가. `imageCache.ts` LRU 퇴거 (`image.delete()`, MAX 100 — imageCache.ts:230-248) 가 보관 Picture 의 참조 Image 를 먼저 해제하면 replay 시 해제된 WASM 객체 접근 (use-after-free). 코드 경로: `disposable.ts`, `imageCache.ts`, `gpuTextureCache.ts` (기존 해제 경로 분산) | **HIGH** | 단일 destroy 심볼 통합 (open-pencil lifecycle 패턴) + LRU 상한 + 페이지 전환 clear + image 퇴거 시 참조 Picture 동시 invalidate (역참조 인덱스, 해제 순서 Picture → Image) + G3 (heap 반복 실측 + stale image 렌더/crash 0)                           |
| R3  | dev 계측 코드의 production 유입 (번들/성능 저하)                                                                                                                                                                                                                                                                                                                           |   MED    | NODE_ENV 게이트 + G1 번들 diff 0 검증                                                                                                                                                                                                                 |
| R4  | Phase 4 가 evidence 없이 진입해 복잡도만 증가                                                                                                                                                                                                                                                                                                                              |   MED    | G4 진입 게이트 — p95 실측 미달 시 미도입 종결 (도입하지 않음이 정상 종결 경로)                                                                                                                                                                        |
| R5  | 리서치 문서 stale 전제 재유입 (이미 존재하는 인프라 재구현)                                                                                                                                                                                                                                                                                                                |   MED    | 착수 시점 Phase 0 인벤토리 재실측 freeze 의무 (design §0-2 갱신 커밋)                                                                                                                                                                                 |
| R6  | 애니메이션/드래그 중 이동 노드의 Picture 캐시 churn — transition/animation tick 승격 구간 (`SkiaRenderer.ts:485-507`) 에서 매 프레임 re-record+delete 발생 시 record+replay 가 direct draw 보다 비싸 오히려 회귀                                                                                                                                                           |   MED    | volatile 면제 — 활성 애니메이션/드래그 노드는 캐시 제외 후 direct draw (open-pencil `hasVolatileOverlay` skip 패턴) + 위치-불변 record (노드-로컬 좌표 record, 이동은 draw 시 변환 적용 — 이동만으로 re-record 없음) + G2 애니메이션 구간 비회귀 실측 |

## Gates

| Gate | 시점              | 통과 조건                                                                                                                                                                                                                                     | 실패 시 대안                                                                |
| ---- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| G1   | Phase 1 종료      | production 번들 diff 0 + 계측 오버헤드 < 0.5ms/frame + Chrome MCP 로 HUD 신규 지표 (draw-call/GPU time/miss 사유) 실동작 확인                                                                                                                 | 오버헤드 초과 항목 개별 비활성화 (지표별 독립 토글)                         |
| G2   | Phase 3 종료      | `/cross-check` 시각 대칭 PASS (캐시 hit/miss 양 경로) + 요소 1개 편집 시 재기록 범위가 변경 노드+조상 한정 실측 + 편집/undo stale 렌더 0 + 드래그/애니메이션 구간 프레임 타임 Phase 0 baseline 비회귀 (volatile 면제 + 위치-불변 키 검증, R6) | invalidate 키 보강 후 재검증. 2회 실패 시 Picture 캐시 rollback (독립 커밋) |
| G3   | Phase 3 종료      | WASM heap 증가 상한 준수 + 페이지 전환 반복 leak 0 + image 퇴거 시 참조 Picture 동시 invalidate 실측 (stale image 렌더/crash 0, R2)                                                                                                           | LRU 상한 축소 → 재실측. 해소 불가 시 캐시 대상 축소 (텍스트 노드 한정)      |
| G4   | Phase 4 진입 판정 | Phase 3 반영 후 `contentRenderTime` p95 > 8ms 실측일 때만 진입                                                                                                                                                                                | 미달 시 Phase 4 미도입 종결 (실패 아님 — 의도된 종결 경로)                  |

> **G1 계측 방법 주의 (2026-07-26 실측 교훈)**: `performance.now()` 는 0.1ms 로 양자화된다. 0.05ms 급 콜백을 프레임 단위 단발 diff 로 재면 최대 3배 과대 계상된다 (ADR-167 초판이 유휴 비용을 21ms/s 로 보고 → 다수 샘플 누적으로 확정치 6.7ms/s). G1 의 "오버헤드 < 0.5ms/frame" 은 양자화 하한과 5배 차이뿐이므로 **다수 프레임 구간을 누적한 뒤 나누어** 판정한다 — 단발 프레임 diff 판정 금지. 또한 계측용 동기 루프를 메인 스레드에서 돌리면 그 자체가 잔킹을 만들어 측정 대상을 오염시킨다 (같은 세션 실측). 유효했던 방식은 **페이지 내 자체 기록기를 심고 수집 중 무개입**.

## Consequences

### Positive

- 캐시/렌더 병목이 추측이 아닌 실측 (miss 사유 7분류 + draw-call + GPU 시간 + speedscope flamechart) 으로 판정 가능 — 이후 모든 렌더 성능 ADR 의 근거 인프라
- 요소 편집 응답성: content 변경 시 전량 재기록 → 변경 노드 한정 재기록 (`renderCommands.ts` 경로), 대형 페이지 편집 프레임 spike 완화
- Paint/캐시 자원의 해제 경로 단일화 — 장기 세션 WASM 메모리 안정성
- 리서치 문서 2건의 stale 격차 표가 본 ADR Context 실측으로 정정 기록됨 — 동일 문서 기반 중복 제안 차단

### Negative

- Skia 렌더 경로에 캐시 1계층 추가 — `renderCommands.ts`/`skiaFramePipeline.ts` 의 코드 복잡도 증가, 신규 기여자의 invalidate 규약 학습 비용
- dev 모드 계측 코드 유지 부담 (HUD/export 포함 ~수백 LOC 추정)
- Phase 3 이후 렌더 버그 조사 시 "캐시 stale 인가 로직 버그인가" 판별 단계가 추가됨 (Phase 1 의 miss 사유 분류가 이 비용을 상쇄하는 설계)
