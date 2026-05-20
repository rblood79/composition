# ADR-911: Anthropic 류 확률적 렌더링 최적화 — ML 기반 3 패턴 (#4 + #2 + #3)

## Status

Proposed — 2026-05-21

## Context

composition 의 렌더 cost layer 격차는 두 범주:

1. **결정적 (deterministic) cost** — Picture cache 부재 / Paint pool 부재 / retained backing 부재 → [ADR-910](910-deterministic-rendering-optimization.md) baseline 안정화로 처리
2. **확률적 (probabilistic) ceiling** — frame budget allocation 균일 / 다음 frame 예측 없음 / 측정 evidence 없음 → ADR-910 적용 후 잔존

본 ADR 은 #2 영역을 처리. Anthropic 류 사고 패턴 (학습 기반 / 확률적 / attention / scaling law) 을 렌더링에 적용. reference: [RENDERING_COMPARISON.md](../explanation/research/RENDERING_COMPARISON.md) v2 §6 "Anthropic core 개발자 관점 — composition 재설계 의심".

**7 패턴 후보** (RENDERING_COMPARISON.md §6 추출):

1. **Predictive frame pre-rendering** — LLM speculative decoding 차용. small MLP 가 다음 frame viewport matrix 예측 → idle worker 에서 speculative pre-render
2. **Foveated rendering** — attention 의 시각화. focus 영역 (선택 노드 + hover) full fidelity / 주변 low LOD
3. **Probabilistic frame skip** — DLSS/FSR ML upscaling 사고. 노드별 변경 확률 P(change | features) 예측 → 확률 낮은 노드 skip + 이전 frame 재사용
4. **Scaling law evidence layer** — Anthropic 정량 사고 본질. frame time ≈ α·N^β·M^(−γ) power-law fit 으로 자원 ↔ 효과 정량 모델
5. **Neural texture / vector compression** — auto-encoder 로 노드 group 을 latent vector 압축
6. **RL caching policy** — multi-armed bandit 으로 Picture cache 정책 학습
7. **Diffusion-style progressive rendering** — coarse → fine 단계적 정제

본 ADR 은 **#4 + #2 + #3 만 채택** (이유: Decision 섹션).

**SSOT domain 매핑**: D3 (시각 스타일) consumer cost layer. ML 모델은 도구 — D1/D2/canonical 침범 없음.

**ADR 분리 결정 시 관점 점검 4 질문 본문 확정** (`adr-writing.md` 정합):

1. **base/응용 분류**: 본 ADR = **응용** (ADR-910 결정적 baseline 위에 확률적 ceiling 돌파). ADR-910 가 base. 사용자 mutation 우세 시나리오에서 결정적 캐싱 안정화 없이 ML 도입 시 검증 baseline 자체가 변동 — measurement gap
2. **schema 직교성**: ADR-910 의 결정적 cache 정책 ↔ 본 ADR 의 ML 모델 학습 = 직교. 단 본 ADR 의 #4 (scaling law) 가 ADR-910 효과 측정 evidence 에 활용 가능 — supersede 가능성. 본 ADR 의 #4 이 먼저 적용되면 ADR-910 의 Phase 0 measurement 일부 흡수
3. **baseline 관점 reverse 검증**: ADR-910 base → ADR-911 응용. reverse 아님. composition 의 사용자 mutation 우세 환경 → 결정적 캐싱 (사용자 직접 조작) 우선, ML (확률적 예측) 응용
4. **codex review 미루지 말 것**: 본 ADR 작성 시 4 질문 본문 확정 (본 섹션)

**Hard constraints**:

- ML 모델 client-side 추론 (서버 호출 금지) — privacy + latency
- ML 모델 크기 < 10MB 합산 (CLAUDE.md §성능 기준 번들 < 500KB 위반 회피 위해 lazy load)
- 60fps 절대 위반 시 ML 즉시 disable — **fallback 아닌 disable** (primary 경로 = ADR-910 결정적 캐싱 회복, `feedback-no-fallback-thinking` 정합)
- ML 정확도 < 90% 시 자동 disable

**Soft constraints**:

- 학습 데이터 = composition 사용자 mutation transcript (privacy opt-in)
- MLOps 인프라 신규 (composition 외 영역 워크플로)

## Alternatives Considered

### 대안 A: 7 패턴 묶음 (#1 + #2 + #3 + #4 + #5 + #6 + #7)

- 설명: 7 패턴 모두 단일 ADR 에서 추가. ML 인프라 + 학습 데이터 수집 + 정확도 monitoring + 7 패턴 모델 학습/배포 동시
- 위험: 기술(H) / 성능(M) / 유지보수(H) / 마이그레이션(M)

### 대안 B: 본 ADR (#4 + #2 + #3 만)

- 설명: 즉시 ROI 높은 3 패턴만. #1/#5/#6/#7 은 별도 ADR 후속
- 위험: 기술(M) / 성능(M) / 유지보수(M) / 마이그레이션(L)

### 대안 C: ADR 작성 보류 + 외부 reference 연구 단계 유지

- 설명: ADR-910 적용 후 ML 사고 본격 검토. 본 ADR 은 작성 안 함 (RENDERING_COMPARISON.md §6 만 reference 로 보존)
- 위험: 기술(L) / 성능(M — ceiling 돌파 없음) / 유지보수(L) / 마이그레이션(L)

### 대안 D: #4 (scaling law) 만 단독 추가

- 설명: 가장 즉시 적용 가능 + ML 학습 없이 가능. measurement infra 만 신규
- 위험: 기술(L) / 성능(L — 단일 효과) / 유지보수(L) / 마이그레이션(L)

### Risk Threshold Check

| 대안 | HIGH+ 위험                                                                             |
| ---- | -------------------------------------------------------------------------------------- |
| A    | 기술 HIGH + 유지보수 HIGH — ML 인프라 신규 + 7 패턴 동시 = scope 폭증. 단일 ADR 부적합 |
| B    | 잔존 HIGH 위험 없음                                                                    |
| C    | 잔존 HIGH 위험 없음 (단, ceiling 돌파 안 함)                                           |
| D    | 잔존 HIGH 위험 없음 (단, foveated + probabilistic skip 효과 미포함)                    |

대안 A 가 HIGH 2개 — 1차 루프. 위험 회피 대안 추가 필요 → 대안 B/D 가 이미 회피. 대안 A 기각.

대안 B vs C vs D 비교: #4 (scaling law) 가 ADR-910 의 measurement gap 정면 해결 — 즉시 적용 가치. #2/#3 도 ROI 명확. 대안 C 보류 시 ADR-910 measurement gap 남음. 대안 D (#4 만) 는 #2/#3 효과 미포함 — 보수적. **대안 B 채택**.

## Decision

**대안 B 채택** — 3 패턴 (#4 + #2 + #3) 만 추가.

기각 사유:

- 대안 A (7 패턴 묶음): scope 폭증. ML 인프라 신규 + 7 패턴 동시 = 단일 ADR 부적합. R1/R2 HIGH 위험 회피 불가
- 대안 C (ADR 보류): ADR-910 적용 후에도 ceiling 돌파 필요. #4 가 ADR-910 measurement gap 정면 해결 가치 — 보류 비추
- 대안 D (#4 만): #2/#3 ROI 명확하나 미포함. 단일 패턴 ADR 보다 3 패턴 묶음 efficiency 우위

**#4/#2/#3 채택 사유**:

- **#4 (scaling law)**: ML 모델 학습 없이 measurement infra + power-law fit. 즉시 적용 가능. ADR-910 의 measurement gap 흡수
- **#2 (foveated rendering)**: single-user 빌더 환경 자연 정합. focus = 선택 노드 + 마우스 hover. composition 의 빌더 특성 적합
- **#3 (probabilistic frame skip)**: small classifier MLP (~수 KB) 만 신규. DLSS/FSR 게임 업계 표준 패턴 — 검증된 사고

**#1/#5/#6/#7 보류 사유**:

- **#1 (predictive pre-rendering)**: ADR-910 retained backing 효과와 겹침 (둘 다 speculative pre-render). ADR-910 적용 후 ROI 검증 → 별도 ADR
- **#5 (neural compression)**: 연구 단계 영역. 구현 비용 압도 — composition 빌더 ROI 의문
- **#6 (RL caching policy)**: ADR-910 의 manual invalidation 정책 적용 후 retrofit 가치. 학습 데이터 수집 prerequisite
- **#7 (diffusion progressive)**: Skia LOD switching layer 신규 필요. 비용 큼 — composition core skia 영역 대규모 변경

> 구현 상세: [911-anthropic-probabilistic-rendering-breakdown.md](design/911-anthropic-probabilistic-rendering-breakdown.md) (Phase 0-3 + ML 모델 학습 infra + 정확도 monitoring + privacy opt-in) — 후속 작성 예정

## Risks

| ID  | 위험                                                                                      | 심각도 | 대응                                                                                                         |
| --- | ----------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------ |
| R1  | #3 probabilistic skip ML 정확도 < 90% → 시각 결함 (변경 노드 skip)                        |  MED   | Phase 2 정확도 monitoring + 90% 미만 자동 disable (ADR-910 결정적 캐싱 회복, fallback 아님)                  |
| R2  | #2 foveated rendering LOD switching 이 cross-check skill 통과 실패 (CSS↔Skia 시각 비대칭) |  MED   | Phase 1 cross-check 강화 (focus 영역 한정 비교) + LOD 단계 단순화                                            |
| R3  | #4 scaling law evidence false signal — composition mutation 패턴이 power-law 부적합       |  MED   | Phase 0 goodness-of-fit ≥ 0.85 + 미부합 시 #4 추가 안 함 (단순 % 추정 유지는 fallback 아님 — 모델 무효 처리) |
| R4  | ML 모델 client-side 번들 < 10MB 합산 위반                                                 |  LOW   | lazy load + WebWorker offload + 모델 quantization (int8 / int4)                                              |
| R5  | 학습 데이터 privacy — composition 사용자 mutation transcript 수집 동의 누락               |  MED   | opt-in gate + 동의 없으면 fixed heuristic (ADR-910 결정적 캐싱 유지) — privacy default ON                    |
| R6  | ML 모델 학습 워크플로 (MLOps) 신규 — composition 외 영역 인프라 비용                      |  MED   | Phase 0 워크플로 정의 + 학습 cycle 명시 (분기별 1회 재학습 가정)                                             |
| R7  | ADR-910 land 전 #4 단독 적용 시 baseline 안정화 안 되어 scaling law fit 신뢰도 약함       |  MED   | ADR-910 Phase 0 완료 후 본 ADR Phase 0 진입 — 순서 의존성 명시                                               |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점          | 통과 조건                                                                                            | 실패 시 대안                                                           |
| ---- | ------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| G0   | Phase 0 (#4)  | composition mutation transcript 1주 수집 + power-law fit goodness ≥ 0.85                             | fit 미부합 시 #4 후속 보류, 단순 % 추정 유지 (단 모델 자체 추가 안 함) |
| G1   | Phase 0 (#4)  | ADR-910 Phase 0 baseline measurement 완료 (선행 조건)                                                | ADR-910 Phase 0 완료 대기                                              |
| G2   | Phase 1 (#2)  | foveated LOD switching frame time 40%+ 감소 + cross-check skill 통과 (focus 영역 한정 비교)          | LOD 단계 단순화 (3-tier → 2-tier)                                      |
| G3   | Phase 2 (#3)  | probabilistic skip 정확도 ≥ 90% (변경 노드 skip 0건) + frame time 30%+ 감소                          | 정확도 미달 시 disable, ADR-910 결정적 캐싱 회복                       |
| G4   | Final closure | cross-check + parallel-verify 통과 + 60fps 절대 보장 (ML disable path 검증) + privacy opt-in UI 작동 | ML 영역 revert + 결정적 캐싱 유지                                      |

## Consequences

### Positive

- 노드 scalability ceiling 돌파: ADR-910 의 5x 위에 추가 2-3x → **~5,000~7,500 노드 60fps** 도달
- **#4 scaling law evidence layer** 가 composition 전반의 measurement gap 정면 해결 (`feedback-anthropic-lever-essence-verification` 정합) — % 추정 시대 종료
- **#2 foveated rendering** 으로 viewport 안 차등 fidelity — 인간 시각 시스템 정합 (게임 업계 표준 사고)
- **#3 probabilistic frame skip** 으로 frame budget 동적 할당 — Anthropic attention 사고의 렌더 적용
- composition 의 **architecture-level 차별점** — 일반 빌더 (Webflow / Framer) 의 결정적 캐싱 대비 ML 기반 확률적 최적화 = 엔터프라이즈 product 차별성 surface

### Negative

- ML 모델 client-side 추론 인프라 신규 (ONNX runtime / TF.js / custom WASM — 선택)
- 학습 데이터 수집 = privacy gate 신규 (opt-in UI / 동의 관리 / 데이터 retention 정책)
- 정확도 monitoring + 자동 disable layer 신규
- ML 모델 학습 워크플로 (MLOps) 일부 도입 — composition 외 영역
- 번들 크기 +10MB (lazy load 로 초기 < 500KB 유지)
- ADR-910 land 의존성 — 본 ADR Phase 0 가 ADR-910 Phase 0 후 진입

---

## Related

- [ADR-910](910-deterministic-rendering-optimization.md) — 본 ADR 의 base (결정적 baseline). 본 ADR 적용 전 ADR-910 Phase 0 완료 필수
- [RENDERING_COMPARISON.md §6](../explanation/research/RENDERING_COMPARISON.md) — Anthropic core 개발자 관점 (7 패턴 추출 원천)
- [ADR-134](134-ai-assistant-llm-unification-plan.md) — AI Assistant LLM 통합 (Proposed). 본 ADR 의 학습 데이터 수집 인프라 일부 공유 가능
- [ADR-100](completed/900-unified-skia-rendering-engine.md) — Unified Skia Engine
- 메모리 `feedback-composition-enterprise-target` — 엔터프라이즈 대상 관점 (ML 기반 차별성 정당화)
- 메모리 `feedback-no-fallback-thinking` — ML disable 시 ADR-910 결정적 캐싱 회복 = primary 경로, fallback 아님
- 메모리 `feedback-anthropic-lever-essence-verification` — #4 scaling law 의 measurement gap 해결 정합
- 메모리 `feedback-performance-completeness` — 60fps 는 최저선
