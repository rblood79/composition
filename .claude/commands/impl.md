---
description: 새 기능 구현 파이프라인 — brainstorm → plan → implement → review → evaluate
argument-hint: [기능 설명]
---

"$ARGUMENTS" 기능을 표준 워크플로로 구현한다.

파이프라인:

1. 요구사항/대안 탐색 — 대안 2개 이상 비교 후 선택. 아키텍처 판단이 섞이면 `architect` agent 위임. 전제·관점 의문은 CLAUDE.md §전제·관점 의문 처리 의 4개 결정 지점에서만 질문
2. 새 컴포넌트라면 `component-design` skill — React Aria/Spectrum 문서 참조
3. 다단계 작업이면 ADR design breakdown (`docs/adr/design/*-breakdown.md`) 으로 phase 분할 — 별도 계획 문서 계층 신설 금지
4. `implementer` agent 위임 — 실제 구현
5. `reviewer` agent 위임 — 품질 감리
6. UI 포함 시 `evaluator` agent — Chrome MCP로 실제 동작 검증
7. 렌더링 변경 있으면 `/cross-check` 실행
8. 완료 전 CLAUDE.md §완료 기준 자가 적용 — 검증 명령을 **실제로 실행한 출력**을 근거로 제시 (test/type-check PASS 단독 종결 금지, live behavior 1회 exercise)
9. 완료 시 CHANGELOG 반영 판정 — 신규 컴포넌트/prop/public API 면 docs/CHANGELOG.md Features 반영 (rules/changelog.md 트리거 #3)

각 단계 통과 후 다음 단계로 진행. 단순 수정은 3~4만 수행 가능.
