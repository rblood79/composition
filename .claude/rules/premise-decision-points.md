# 전제·관점 의문 처리 — 결정 지점 한정 (CRITICAL)

> 정본. CLAUDE.md 는 4개 결정 지점 요약만 두고 호출 규약 · 종결 계약 · 재개 조건 · 깊은 사고 의무 전문은 이 파일이 보유한다 (2026-09-02 CLAUDE.md 에서 이관, 내용 무변경). frontmatter `paths` 없음 = 상시 로드.

**전제·관점 의문 처리 — 결정 지점 한정 (CRITICAL)**:

**AskUserQuestion 의무 — 이 4개 결정 지점에서만**:

1. ADR fork / 분리 / 통합 결정
2. ADR 간 의존 방향 반전 (base ↔ 응용 재분류)
3. SSOT 경계 재판정 (D1/D2/D3 소속 변경)
4. 사용자가 승인한 scope 자체의 변경 (방향 전환 / 대폭 확장·축소)

호출 규약: 의문문 형식 (statement 금지) + 차단 카테고리 메모리 (no-derived-adr-mid-execution / execute-adr-surface-minimization / consolidation-burden / pr-vs-direct-push / settings-precedence) 의 차단 사유 1줄 인용. 사용자 응답 전 새 ADR 작성 / fork / sub-group 분할 금지.

**질문 금지 — 자율 진행 대상**: 리뷰 승인된 ADR 의 phase 실행 중 통상 구현 판단 (파일 범위 / 테스트 구성 / 순서) · 추정 vs 실측 gap (본 ADR Phase 0 inventory 보강으로 흡수 — adr-writing.md M3) · 이미 확정된 전제의 재질문.

**전제 확정 종결 계약 (terminal state — CRITICAL)**: 다음 중 하나가 성립하면 해당 ADR 의 전제·관점은 **확정**이며, scope 무변경인 한 구현 전 과정 (execute-adr 포함) 에서 재질문·재검토 금지:

1. `docs/adr/reviews/{NNN}.md` (Layer 0) 최신 round 가 이슈 0건, 또는 모든 이슈 outcome 이 종결 상태 (`fixed`/`deferred`/`rejected` — `pending` 0건) 이고 CRITICAL/HIGH 는 전부 `fixed`. "전부 fixed" 단독 기준 금지 (LOW deferred/rejected 로 종결된 실질 승인 ADR 을 미확정으로 잘못 판정 — 메모리 `feedback-premise-terminal-state-review-approval`)
2. ADR 본문/design breakdown 의 fork checkpoint 4 질문 lock-in + 사용자 confirm 기록

확정은 세션 경계로 소멸하지 않는다 — 기록이 confirm 의 지속 형태다. 재개 조건 3개뿐: (a) 사용자 재제기, (b) scope 자체 변경, (c) 의존 방향 반전의 코드 증거 발견. 이때만 위 4개 결정 지점 절차로 복귀한다.

**결정 지점의 사고는 깊은 사고로 (CRITICAL)**: 4개 결정 지점에서는 표면 답변 (plan→execute→done) 을 피하고 깊은 사고 모드로 진입한다. tool 호출로 outsource 금지 — codex review / cross-check 는 본문 정합 layer 일 뿐 전제·관점 layer 아님. 절차 컴플라이언스 (Risk 표 / Gate 매핑 / type-check PASS / codex review PASS) 통과가 사용자 confirm 을 대체하지 못한다.
