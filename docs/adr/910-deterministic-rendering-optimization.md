# ADR-910: 결정적 렌더링 최적화 — OpenPencil-D / Pencil Desktop 차용 캐싱 layer

## Status

Proposed — 2026-05-21

## Context

composition 의 Skia 렌더 cost layer 에 다음 격차 존재. reference: [docs/explanation/research/RENDERING_COMPARISON.md](../explanation/research/RENDERING_COMPARISON.md) v2 §3/§5/§7/§8.

| 영역                                    | composition 현재                                                        | reference                                                      |
| --------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| Picture cache                           | 미적용                                                                  | OpenPencil-D 적극 (subtree + node) / Pencil Desktop 소극 (1회) |
| Retained backing                        | 미적용                                                                  | OpenPencil-D 3x oversample + 6ms idle budget                   |
| `requestRender` / `requestRepaint` 분리 | 미적용 (registry/layout/sceneVersion 3 카운터 분류만, 처리 차등화 없음) | OpenPencil-D `create.ts:78`                                    |
| Paint object pool                       | 미적용 (매 draw `new ck.Paint()` + Disposable dispose)                  | OpenPencil-D `paints.ts:13-111` 11 fixed                       |
| WebGL ContextLost recovery              | 미확인 / 없음 추정                                                      | Pencil Desktop `ContextLost` 7회 grep                          |
| GrDirectContext 명시 관리               | composition Skia 내부 의존, 명시 X                                      | Pencil Desktop 명시 (`GrDirectContext` 1회 grep)               |

**SSOT domain 매핑** (`ssot-hierarchy.md` 참조): 본 ADR 은 **D3 (시각 스타일) consumer 의 cost layer 정착**. canonical document / D1 (DOM/RAC) / D2 (Props/RSP) 침범 없음 — D3 내부 정리.

**ADR 분리 결정 시 관점 점검 4 질문 본문 확정** (`adr-writing.md` 정합):

1. **base/응용 분류**: 본 ADR = **결정적 (deterministic) 최적화 baseline**. ADR-911 (Anthropic 류 확률적 최적화) 의 prerequisite. baseline 60fps 안정화 없이 ML 기반 최적화 ROI 의미 없음
2. **schema 직교성**: 본 ADR 의 cache invalidation 정책 ↔ ADR-911 의 ML 모델 학습 = 직교. 단 ADR-911 의 scaling law evidence (#4) 가 본 ADR 의 효과 측정 evidence 에 활용 가능 — 그러나 본 ADR 의 measurement 자체는 ADR-911 적용과 무관하게 진행
3. **baseline 관점 reverse 검증**: ADR-910 base → ADR-911 응용. reverse 아님. composition 의 결정적 최적화 영역 자체가 OpenPencil-D / Pencil Desktop reference 로부터 도출 (사용자 mutation 우세 시나리오 정합)
4. **codex review 미루지 말 것**: 본 ADR 작성 시 4 질문 본문 확정 (본 섹션)

**Hard constraints**:

- 60fps 유지 — CLAUDE.md §성능 기준 base requirement
- 엔터프라이즈 대상 수천 노드 — `feedback-composition-enterprise-target`
- **fallback 사고 회피** — `feedback-no-fallback-thinking`. WebGL ContextLost recovery 는 primary 경로 정상화 (GPU 자원 복구), fallback 아님

**Soft constraints**:

- 메모리 SLA 미정 — Picture cache / retained backing 메모리 비용 (~100-300MB) policy 필요
- Picture invalidation 정책 작성 비용 (manual rule)

## Alternatives Considered

### 대안 A: 본 ADR (OpenPencil-D + Pencil Desktop 차용 6 패턴 묶음)

- 설명: Picture cache + retained backing + `requestRender`/`requestRepaint` 분리 + Paint pool + ContextLost recovery + GrDirectContext audit. Phase 점진 추가
- 위험: 기술(M) / 성능(L) / 유지보수(M) / 마이그레이션(L)

### 대안 B: Picture cache 만 추가 (4-way §11 옵션 A 단독)

- 설명: 가장 ROI 큰 1개만. 다른 5 영역은 별도 ADR
- 위험: 기술(L) / 성능(L — 부분 효과만) / 유지보수(L) / 마이그레이션(L)

### 대안 C: Skia 자체 fork + custom binding (Pencil 9.5MB wasm 패턴)

- 설명: CanvasKit fork → composition 전용 Skia binding 작성. DLSS-style hardware-near 통합
- 위험: 기술(C) / 성능(L) / 유지보수(C) / 마이그레이션(H)

### Risk Threshold Check

| 대안 | HIGH+ 위험                               |
| ---- | ---------------------------------------- |
| A    | 잔존 HIGH 위험 없음 (M 4개)              |
| B    | 잔존 HIGH 위험 없음 (효과 부분만)        |
| C    | 기술 CRITICAL + 유지보수 CRITICAL — 기각 |

대안 C 기각 (CRITICAL 1개 이상). 대안 A vs B 비교: 묶음 추가 시 invalidation 정책 일관성 + measurement 한 번에 + 4-way §11 우선순위 (A→C→B→E) 정합. 대안 A 채택.

## Decision

**대안 A 채택** — OpenPencil-D + Pencil Desktop 차용 6 패턴 묶음 추가. Phase 점진 진행.

기각 사유:

- 대안 B (Picture cache 만): pan/zoom 시나리오 cover 부족 (retained backing 부재 → 70-90% 효과 미흡). 옵션 A 효과 단독 30-50% 만 cover
- 대안 C (Skia fork): 유지보수 CRITICAL. composition 의 RAC/Spec D3 대칭 의무와 충돌 — fork 시 Skia 외부 변경 따라가기 비용 압도

위험 수용 근거 (대안 A 의 R1-R5):

- R1 (invalidation 과보수): Phase 1 의 G2 gate (hit rate ≥ 60%) 로 차단
- R2 (메모리 SLA): Phase 0 prerequisite 로 memory budget policy 명시 후 진입
- R3 (Paint variety 부족): Phase 3 measurement 후 size 조정 가능
- R4 (ContextLost recovery frame skip): primary 경로 정상화 — 빈 화면 회피 관점 충돌 없음
- R5 (회귀 risk): Phase 분리 추가 + cross-check skill 검증

> 구현 상세: [910-deterministic-rendering-optimization-breakdown.md](design/910-deterministic-rendering-optimization-breakdown.md) (Phase 0-5 + Picture invalidation 정책 + measurement infra) — 후속 작성 예정

## Risks

| ID  | 위험                                                                   | 심각도 | 대응                                                            |
| --- | ---------------------------------------------------------------------- | :----: | --------------------------------------------------------------- |
| R1  | Picture invalidation 정책 과보수 → cache hit rate 0%                   |  MED   | Phase 0 baseline measurement + Phase 1 G2 gate (hit rate ≥ 60%) |
| R2  | Retained backing 메모리 비용 (~70-300MB) → 엔터프라이즈 SLA 위반       |  MED   | Phase 0 prerequisite — memory budget policy 명시                |
| R3  | Paint pool 11 가 composition paint variety 부족 (gradient/shadow 패턴) |  MED   | Phase 3 pool size measurement 후 확장 (15-20 후보)              |
| R4  | WebGL ContextLost recovery 가 GPU state 재구성 도중 frame skip         |  MED   | Phase 4 recovery 경로 측정 + 1 frame 안 정상 재진입 G5 gate     |
| R5  | 6 패턴 묶음 추가 시 회귀 risk 큼 (효과 측정 분리 어려움)               |  MED   | Phase 점진 추가 + cross-check skill 검증 + 각 Phase 별 G gate   |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점          | 통과 조건                                                                                   | 실패 시 대안                                        |
| ---- | ------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| G0   | Phase 0 종료  | composition baseline frame time / Paint allocate cost / 노드 한계 measurement 완료          | Phase 진입 차단. ADR-911 #4 (scaling law) 우선 도입 |
| G1   | Phase 0 종료  | Memory budget policy 명시 (Picture cache 한도 / retained backing 한도 / 압박 시 evict)      | budget 미정 시 Phase 1/2 진입 차단                  |
| G2   | Phase 1 종료  | Picture cache hit rate ≥ 60% (Inspector 편집 + pan/zoom 시나리오 측정)                      | invalidation 정책 재설계                            |
| G3   | Phase 2 종료  | Retained backing pan/zoom frame time **70%+ 감소** 측정                                     | invalidation 빈도 조정 / backing size 축소          |
| G4   | Phase 3 종료  | Paint pool 11 size 가 99 percentile 사용량 cover                                            | size 확장 (15-20)                                   |
| G5   | Phase 4 종료  | WebGL ContextLost recovery 후 1 frame 안 정상 재진입 (빈 화면 0초)                          | GPU state 재초기화 layer 강화                       |
| G6   | Final closure | cross-check skill 통과 (CSS↔Skia 시각 대칭) + parallel-verify skill 통과 (composite family) | Spec 정합 회귀 fix                                  |

## Consequences

### Positive

- pan/zoom 시나리오 **70~90% frame time 감소** (RENDERING_COMPARISON.md §11 옵션 B)
- selection/hover 시나리오 **40~60% frame time 감소** (옵션 A)
- mutation/drag 시나리오 **20~40% frame time 감소** (옵션 A)
- 엔터프라이즈 대상 노드 scalability: ~500 → **~2,500 노드** 60fps (5x)
- GC stability ↑ (Paint pool 11) — frame jitter 감소
- WebGL context loss 시 user 가시 빈 화면 제거 (primary 경로 정상화)
- composition 의 render-side cost layer 가 implicit → explicit policy 전환 (`feedback-anthropic-lever-essence-verification` 정합)

### Negative

- 메모리 사용량 **+100~300MB** (Picture cache + retained backing) — 엔터프라이즈 SLA policy 신규
- Picture invalidation 정책 manual rule — composition 의 props 변경 패턴 (style/layout/children) 별 invalidation 표 작성 비용
- composition core `skia/` 영역 6 영역 동시 변경 — 회귀 risk 큼 (Phase 점진 추가 필수)
- composition 의 변경 affected 파일 추정 ~20-30 (skia renderer + RAF loop + Paint allocate sites + WebGL surface creator + Disposable scope)

---

## Related

- [RENDERING_COMPARISON.md](../explanation/research/RENDERING_COMPARISON.md) — 4-way 분석 (§3/§5/§7/§8/§11)
- [PENCIL_DESKTOP_ANALYSIS.md](../explanation/research/PENCIL_DESKTOP_ANALYSIS.md) — Pencil Desktop 디컴파일 (ContextLost / GrDirectContext / PictureRecorder)
- [OPEN_PENCIL_FIGMA_FORK_ANALYSIS.md](../explanation/research/OPEN_PENCIL_FIGMA_FORK_ANALYSIS.md) — OpenPencil-D (Paint pool / Picture cache / retained backing)
- [ADR-100](completed/900-unified-skia-rendering-engine.md) — Unified Skia Engine (PixiJS 제거, composition Skia 단일 노선)
- [ADR-911](911-anthropic-probabilistic-rendering.md) — 본 ADR 의 응용 (Anthropic 류 확률적 최적화)
- 메모리 `feedback-composition-enterprise-target` — 엔터프라이즈 대상 관점
- 메모리 `feedback-no-fallback-thinking` — fallback 사고 회피 (ContextLost recovery 는 primary 경로 정상화)
- 메모리 `feedback-performance-completeness` — 60fps 는 최저선
