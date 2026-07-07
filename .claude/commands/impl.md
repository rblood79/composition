---
description: 새 기능 구현 파이프라인 — brainstorm → plan → implement → review → evaluate
argument-hint: [기능 설명]
---

"$ARGUMENTS" 기능을 표준 워크플로로 구현한다.

파이프라인:

1. `superpowers:brainstorming` skill — 요구사항/설계/대안 탐색
2. 새 컴포넌트라면 `component-design` skill — React Aria/Spectrum 문서 참조
3. `superpowers:writing-plans` skill — 다단계 계획 작성
4. `implementer` agent 위임 — 실제 구현
5. `reviewer` agent 위임 — 품질 감리
6. UI 포함 시 `evaluator` agent — Chrome MCP로 실제 동작 검증
7. 렌더링 변경 있으면 `/cross-check` 실행
8. 완료 전 `superpowers:verification-before-completion`
9. 완료 시 CHANGELOG 반영 판정 — 신규 컴포넌트/prop/public API 면 docs/CHANGELOG.md Features 반영 (rules/changelog.md 트리거 #3)

각 단계 통과 후 다음 단계로 진행. 단순 수정은 3~4만 수행 가능.
