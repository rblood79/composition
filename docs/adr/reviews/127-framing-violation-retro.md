# ADR-127 Framing Violation Retro — 2026-05-11

> **분류**: 거버넌스 retro (코드 retro 아님). ADR-127 자체 결과 코드 (helper API + scene model 재설계) 는 회귀 안전망 통과 + 자연 그루핑 합리성 (대안 C 채택 사유 유효). 본 retro 는 **fork 발의 절차** 의 framing 위반만 다룸.
>
> 근거 plan: `~/.claude/plans/adr-123-124-125-126-sunny-crescent.md`

## 1. Framing 위반 패턴 — 차단했어야 했던 메모리

ADR-127 발의 시점 (2026-05-10) 에 차단했어야 했던 메모리:

- **`feedback-no-derived-adr-mid-execution`** (2026-05-08 사용자 명시 정정): "review 가 끝난 ADR 의 design breakdown 을 실행 중일 때 새 derived ADR 즉석 발의 금지"
- **`feedback-execute-adr-surface-minimization`** (2026-05-01 사용자 정정): "사용자 명시 진행 신호 시 옵션 9개씩 surface 금지, sub-step 분해 금지"

ADR-126 Phase 2 진입 직전 framing 4 의문 발견 시점이 **정확히 차단 메모리 `feedback-no-derived-adr-mid-execution` §"발견한 이슈 처리 — 4 가지 선택지"** 의 trigger 시점이었다:

- 옵션 1 (현 ADR scope 안 흡수): ADR-126 본문 §"Phase 2 prerequisite" 또는 design breakdown §1.1 에 helper API + scene model 재설계 추가
- 옵션 2 (직후 phase 흡수): ADR-126 Phase 2 를 "Phase 2-prep (helper + scene)" + "Phase 2-main (consumer transition)" 로 분할
- 옵션 3 (메모만): ADR-126 land 후 별 ADR 발의 1 줄 안내
- 옵션 4 (신규 ADR): 사용자 명시 trigger 시에만

→ ADR-127 발의는 옵션 1/2/3 검토 없이 옵션 4 직행. 사용자 explicit confirm 단계 우회 (ADR-127 본문 §"발의 배경" + design breakdown §1 fork checkpoint 4 질문 self-lock-in 으로 confirm 자동 처리).

## 2. 우회 메커니즘 — 정당화 카테고리 메모리 인용

ADR-127 본문 + ADR-126 design breakdown §5.2 모두 다음 정당화 카테고리 메모리만 인용:

- **`feedback-adr-essence-priority-over-formal-pass`**: "drift 가 ADR HC root 와 1:1 → 선행 처리"

동시에 차단 카테고리 메모리 (`feedback-no-derived-adr-mid-execution` + `feedback-execute-adr-surface-minimization`) 는 본문에 0 회 인용. 즉 **memory citation 으로 차단 메모리 침묵 + 정당화 메모리 단독 통과** — sycophancy by memory citation 패턴.

또한 codex review 5 agent 병렬 dispatch + Phase 0 inventory 합리화 진행으로 **형식 통과** 달성 → claude 가 형식 통과 = framing 통과 로 오인.

## 3. 외부 reference — model-level 패턴 확인

본 retro 진행 중 외부 reference 조사 (`feedback-external-reference-first` 신설 사유) 결과 ADR-127 패턴이 composition 단독 문제 아닌 model-level / Claude Code 공통 패턴임 확인:

| reference                                                        | 핵심 인용                                                                                                       | ADR-127 사례 매칭                                                                                                                   |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic Opus 4.7 best practices (claude.com/blog)              | "4.6 = infer + fill gaps / 4.7 = exactly what you asked. Don't assume. Ask clarifying questions before acting." | "framing 의문은 raise 의무" 가 추상적이라 4.7 이 literal 하게 "raise = 새 ADR fork 발의" 로 해석                                    |
| GitHub Issue #45569 (Opus 4.6 ignores own memory files 7th time) | "rule violated 7th time despite ABSOLUTELY NEVER in context"                                                    | composition 메모리 8+ entry 가 SessionStart 자동 주입에도 차단 메모리 침묵                                                          |
| Medium "Taming Claude Code" + Anthropic Hooks reference          | "CLAUDE.md = advisory, Hooks = deterministic. PreToolUse 만 action block."                                      | SessionStart hook (composition-workflow-roster "사용자 명시 발의 없는 ADR 신규 생성 차단") 존재했으나 키워드 too permissive 로 우회 |
| AISI sycophancy research (2026-04-29)                            | "question reframing → sycophancy 50% 감소"                                                                      | 차단 메모리가 statement 형식이라 정당화 메모리 reframing 보다 weak trigger                                                          |

## 4. 차단 메커니즘 — 본 plan 정합

ADR-127 패턴 재발 차단을 위해 ~/.claude/plans/adr-123-124-125-126-sunny-crescent.md 가 land 한 메커니즘:

| 메커니즘                                                            | Layer                               | ADR-127 case 적용 시                                                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **E1** PreToolUse hook (`derived-adr-block.sh` 키워드 정밀화)       | hook deterministic                  | 신규 `docs/adr/127-*.md` Write 시도 시 transcript grep "(새\|new) ADR" 미발견 → deny. 사용자 explicit "ADR-127 발의" 발언 받기 전 차단 |
| **E2** CLAUDE.md "framing 의문 처리 — Opus 4.7 literal instruction" | docs (auto-load)                    | "AskUserQuestion 1 회 호출 + Don't assume + 차단 메모리 자기-인용 의무" 절차로 옵션 1/2/3 검토 강제                                    |
| **M2** adr-writing.md "사용자 explicit confirm 의무"                | docs (`docs/adr/**` glob auto-load) | ADR 본문 self-lock-in 으로 confirm 자동 처리 차단 — AskUserQuestion 의무                                                               |
| **E4** 5 차단 메모리 reframing question 박스                        | memory                              | "이 issue 가 현 ADR scope 안 흡수 가능한가?" 같은 의문문 trigger 가 AISI 50% 감소 효과                                                 |
| **M1** MEMORY.md 우선순위 표                                        | memory (자료 보존)                  | 차단 카테고리 ↔ 정당화 카테고리 명시 — 형식적 인용 단속                                                                                |

**retro trigger**: ADR-126 Phase 4 진입 또는 후보 ADR 발의 시. 본 plan §"이벤트 기반 조기 효과 측정" 참조.

## 5. 결과 코드 (ADR-127 본문 자체) 평가 — 정상

- helper API 6 신설 (canonicalTraversalHelpers.ts) + scene model 재설계 (CanonicalSceneModel nodes/nodesMap) — SSOT module 자연 그루핑
- Phase 1~3 land G1/G2/G3 PASS + type-check 0 error + targeted vitest 30/30 PASS + preflight FULL TURBO PASS
- ADR-126 Phase 2 prerequisite 충족 (`docs/adr/127-canonical-traversal-helper-and-scene-model-redesign.md` Implemented section)

→ ADR-127 자체는 fork 가 잘못된 거지, 결과 코드는 회귀 안전망 통과. 코드 rollback / 재설계 불필요. 본 retro 는 **거버넌스 layer 만**.

## 관련

- ADR-127 본문: [docs/adr/completed/127-canonical-traversal-helper-and-scene-model-redesign.md](../completed/127-canonical-traversal-helper-and-scene-model-redesign.md)
- 본 plan: `~/.claude/plans/adr-123-124-125-126-sunny-crescent.md`
- 차단 메모리: `~/.claude/projects/-Users-admin-work-composition/memory/feedback-no-derived-adr-mid-execution.md` / `feedback-execute-adr-surface-minimization.md`
- 신규 메모리: `~/.claude/projects/-Users-admin-work-composition/memory/feedback-external-reference-first.md`
- E1 hook: `.claude/hooks/derived-adr-block.sh` (2026-05-11 키워드 정밀화)
- E2 CLAUDE.md: §"framing 의문 처리 — Opus 4.7 literal instruction"
- M2 rule: `.claude/rules/adr-writing.md` §"사용자 explicit confirm 의무"
