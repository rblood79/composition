---
description: 참조 이미지/screenshot 와 대상 selector 를 입력받아 vision-based 수렴 루프로 visual tuning 자동화 (default budget=30)
argument-hint: [ref-path-or-url] [target-selector] [budget?]
---

`match-target` skill 을 호출하여 $ARGUMENTS 입력으로 vision-based visual tuning 루프를 실행한다.

절차:

1. `match-target` skill 실행 (Skill 도구) — Phase 0 사전 조건 통과 확인
2. baseline similarity ≥ threshold 면 즉시 종료
3. 미수렴 시 budget 내 PROPOSE→APPLY→CAPTURE→SCORE 루프
4. 수렴/비수렴 결과 보고 후 type-check + `cross-check` skill 로 회귀 확인 (수렴 시)
5. 사용자 승인 후 commit (자동 commit 금지)

입력 누락 시 사용자에게 부족 항목 (참조 / target selector) 질문 후 진행. budget 은 미제공 시 default 30.
