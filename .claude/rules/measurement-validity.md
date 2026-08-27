---
description: 측정·검증 무결성 — 게이트 통과 수치가 외부 ground-truth 에서 왔는지 (leakage 8-패턴 + 착수 전 5-질문 + 실패 record)
paths:
  - "docs/adr/**"
  - "**/performance/**"
  - "**/*perf*"
---

# 측정·검증 무결성 (measurement validity)

> **정본**: ADR 의 Gate 수치 · 성능 baseline · dual-run/golden 통과 · 감사 분류 · "참조 0건" 판정처럼 **숫자나 PASS 가 결정을 만드는 모든 자리**에 적용. 질문은 하나다 — **외부 ground-truth 가 독립적으로 들어왔는가, 아니면 설계자·측정자·채점자가 서로를 확인해 준 숫자인가.** (paperthin `mandela` 의 composition 재구현 — 8 패턴은 그대로, 사례와 처방은 이 저장소 실측으로 치환.)
>
> **Why**: ADR-172·173 은 G1~G5 전부 통과 후 Implemented 승격 → **같은 날 전량 revert** (유리한 경우만 측정). ADR-174 Phase 0 은 합성 문서의 중복 계수 21.2× 로 소유 모델을 뒤집었다 (픽스처가 만든 숫자). ADR-144 는 test/type-check PASS 로 승격 → live 미동작 → 34 commit revert. 셋 다 게이트를 **통과하는 형태**였다 — 게이트가 아니라 측정 설계가 새고 있었다.

## 1. 측정 착수 전 5-질문 (Gate 표에 명시 의무)

| #   | 질문                                                                                                                                                                                                                                                                  | 답이 "아니오/모름" 이면                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | **측정 대상의 출처** — 사람이 만든 문서인가, 부하용 생성/복제 합성물인가?                                                                                                                                                                                             | 합성물은 **규모 전용** (요소 수·draw 수·프레임 비용). 분포 지표(중복도·다양성) 인용 금지, 분포는 보수적 극단(중복도 1) 으로 설계     |
| Q2  | **불리한 경우를 쟀는가** — 캐시에 불리한 조작 (가시 집합 변경 스크롤 · 편집 · breakpoint 전환) 을 명시 측정했는가?                                                                                                                                                    | 유리 케이스 수치는 상한이 아니라 하한. 불리 케이스 1개 이상 없이는 게이트 통과 금지                                                  |
| Q3  | **대조군** — 같은 조건에서 변경 전 arm 이 있는가? "횟수 감소" 가 아니라 **프레임 총비용** 을 A/B 했는가?                                                                                                                                                              | 파생 재계산 횟수 같은 대리 지표는 총비용을 대신하지 못한다                                                                           |
| Q4  | **소비 경로** — 존재하는 인프라·flag·prop 이 실제로 **가동** 경로에 배선돼 있는가 (import → caller → factory/주입 → flag 실배선)?                                                                                                                                     | 3-grep 전 "기구현 활성화 / Quick Win" 분류 금지. emit 만 있고 받는 규칙이 없는 형태·uncontrolled 로 받는 형태는 grep 이 구별 못 한다 |
| Q5  | **oracle 독립성** — 통과 판정의 기준값이 시스템 자신 (golden 재생성·dual-run 의 다른 자기) 인가, 외부 (실 브라우저 `getBoundingClientRect`·손계산·사용자 동작) 인가? 그리고 fixture 가 계약이 갈리는 **입력 차원** (padding/border/percent/min-max) 을 실제로 쓰는가? | diff 0 은 "그 입력에 대해 같다" 만 증명. 안 쓰는 차원은 unproven — 별도 fixture 후 재검증                                            |

Gate 통과 조건에 **측정 대상 대표성 · 불리 케이스 · 대조군 · 측정 조건 (기기/DPR/visibilityState/힙 상태)** 을 명시 항목으로 넣는다. 수치 산출만 조건으로 두면 어떤 문서·어떤 탭 상태에서 재도 통과한다.

## 2. leakage 8-패턴 → composition 실측 사례 → 독립 ground-truth 처방

| #   | 패턴 (mandela)         | 이 저장소에서 실제로 난 형태                                                                                                                                                                   | 처방                                                                                            | 정본 메모리                                                                                                               |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Recall, not reason     | hook 이름·주석 ("debounce 100ms") 을 구현 대신 인용 — 실제는 `useDeferredValue` (비결정적). `grep` 참조 0건을 "dead" 로 암기 — ADR/매트릭스가 **알면서 유지** 중이던 코드                      | 구현 body 를 직접 read. 삭제 전 `docs/adr/**`·`*_MATRIX.md` 를 심볼명으로 grep                  | feedback-analysis-precision-patterns · feedback-grep-zero-refs-is-not-dead-code                                           |
| 2   | Wrong null hypothesis  | dual-run fixture 전부 padding=0/border=0 → box-sizing 계약이 갈릴 수 없는 입력으로 diff 0 통과                                                                                                 | fixture 가 안 쓰는 입력 차원을 grep 으로 나열, 0 차원은 unproven                                | feedback-dual-run-diff-zero-blind-to-uncovered-input-dimension                                                            |
| 3   | Shared hallucination   | `golden.rs` 가 엔진 출력으로 재생성된 순환 oracle — 엔진과 golden 이 서로 확인                                                                                                                 | 실 Chrome `getBoundingClientRect` 차등 oracle (ADR-156)                                         | project-engine-css-parity-differential-oracle                                                                             |
| 4   | Tautology              | 부하용 복제 문서에서 잰 중복 계수로 소유 모델 결정 — 픽스처가 그린 버킷을 픽스처로 채점                                                                                                        | Q1: 출처 확인, 합성물은 규모 전용                                                               | feedback-synthetic-fixture-distribution-is-not-evidence                                                                   |
| 5   | Verifier = designer    | 감사 보고서의 "선언만 결손" 분류를 감사자 논리로 재확인 — 착수 시 6건 중 3건 뒤집힘 (CSS 셀렉터 미매칭·uncontrolled·이름만 같은 prop). ADR 부분 개정의 "유지" 섹션을 재측정 없이 최신으로 읽음 | 소비 지점 ①emit ②매칭 규칙 ③controlled 순서 재확인. 개정 ADR 의 유지 섹션 코드 인용 전부 재grep | feedback-audit-finding-may-not-survive-consumption-path-check · feedback-partial-adr-revision-must-remeasure-all-sections |
| 6   | Shared-pool bias       | 팬 프레임 + 가시 집합 불변 (캐시 최유리) 만 측정 → G1~G5 통과 → 실사용 회귀로 전량 revert                                                                                                      | Q2·Q3: 불리 케이스 + 총비용 A/B                                                                 | feedback-perf-gate-favorable-case-only-measurement                                                                        |
| 7   | Frame injection        | 축 매핑 "직교" 가설에 맞는 설명만 검증 — 틀린 쪽에도 그럴듯한 근거가 붙는 대칭 선택                                                                                                            | "반대쪽이면 사용자에게 무엇이 이상해지나" 를 한 문장으로 쓰고 **동작** 으로 반증                | feedback-symmetric-mapping-plausible-both-ways                                                                            |
| 8   | Demand characteristics | 측정 조건이 결과를 만든다 — hidden 탭 rAF 정지로 배선 결함처럼 보임, `HEAPU8.byteLength` 고수위선 delta 0, allocator ~100 MB grow 앨리어싱                                                     | 측정 조건 기록 (visibilityState · 처녀 힙 · 60+ 대량 기울기) — 조건 없는 수치는 인용 금지       | feedback-paragraph-fontvariations-per-collection-instancing · reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay     |

**자기 감사 (보고 직전)**: 이 판정에서 나는 #4 (내가 그린 버킷을 내가 채점) · #5 (검증자 = 설계자) · #3 (설계 문서의 주장과 내 판정이 서로 확인) 에 해당하지 않는가? 읽는 사람이 인용된 증거만으로 같은 결론에 도달할 수 있는가?

## 3. 실패 record (반복·고영향 실패만 — Codex P3)

같은 failure class 가 **2회 이상** 재발했거나 revert 규모가 크면 (≥ 10 commit) prose 메모리가 아니라 아래 7 필드로 기록하고, 가능하면 정본을 regression test / gate 로 승격한다. 메모리 `feedback-*.md` 본문에 이 필드를 heading 으로 두고, `pnpm agent:run -- evidence <kind> fail --gate-added <test/gate>` 로 ledger 에 남긴다.

| 필드                | 내용                                                |
| ------------------- | --------------------------------------------------- |
| failure signature   | 증상 1줄 (사용자 가시 결과)                         |
| affected scope      | 커밋 scope / 컴포넌트 / 경로                        |
| root cause          | 원인 (측정 설계 결함이면 위 표의 패턴 번호)         |
| reproducing fixture | 재현 입력 (문서·조작·조건)                          |
| gate or test added  | 재발 차단 게이트/테스트 경로 (없으면 "없음 — 이유") |
| fixed commit        | 수정 커밋                                           |
| recurrence count    | 누적 재발 횟수 (2 이상이면 이 표가 의무)            |

## 4. review-adr 연계

- Phase 3-H (`hate`) 의 공격 축 중 "측정 leakage" 는 §2 표로 판정한다 — Gate 수치의 oracle 이 §2 패턴에 해당하면 그 Gate 는 **통과 불가능하거나 vacuous** 하다 (root 후보).
- Gate 표에 §1 의 명시 항목이 없으면 `evidence-missing` (MEDIUM) 이슈.
- 이 규칙은 원칙만 둔다. 각 함정의 실측 경위·수치는 정본 메모리 파일이 담는다 (사실은 참조, 여기엔 패턴만 — `.agents/README.md` 작성 규약).
