---
description: ADR 번호 + (옵션) phase 를 입력받아 미완료 phase 를 자율 실행. type-check + cross-check + main 직접 push. fork checkpoint / HIGH 위험은 사용자 surface.
argument-hint: [ADR 번호] [phase?] [mode?]
---

`execute-adr` skill 을 호출하여 $ARGUMENTS 입력으로 ADR 의 미완료 phase 를 자율 실행한다.

절차:

1. `execute-adr` skill 실행 (Skill 도구) — skill Phase 0 사전 조건 전체 통과 확인
2. 미완료 phase 식별 → mode=confirm-each-phase 면 사용자 surface (HIGH+ 는 무조건 surface)
3. 사용자 confirm 후 PLAN → RED → GREEN → REFACTOR → INTEGRATE 사이클
4. Phase 3 검증 게이트 (type-check / vitest / cross-check / Gate 조건 / live behavior 실동작 1회 exercise) 모두 PASS 후 commit — 정본: skill Phase 3 + CLAUDE.md §완료 기준
5. main 직접 push (PR 금지) → ADR 본문 진행 로그 update
6. 모든 phase 완료 시 closure 5단계 적용 (Status / 로그 / README / archive / CHANGELOG)

입력 누락:

- ADR 번호 미제공 → 사용자에게 ADR 번호 요청
- phase 미제공 → 다음 미완료 phase 자동 선택 (Phase 1 단계)
- mode 미제공 → default `confirm-each-phase` (HIGH+ 는 강제 surface)

종료 조건: max_phases (default 3) 도달 / fork checkpoint 4 질문 미통과 / 검증 실패 / 사용자 중단.
