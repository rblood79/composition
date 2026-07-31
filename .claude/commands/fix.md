---
description: 버그 수정 파이프라인 — root-cause 추적 → debugger → cross-check
argument-hint: [버그 설명]
---

"$ARGUMENTS" 버그를 root-cause까지 추적하여 수정한다.

파이프라인:

1. root-cause 4단계 — 재현 (일관된 트리거 확보) → 가설 (해당 코드 경로 실측 인용) → 검증 (가설이 증상을 설명하는지 확인) → 수정. **수정 전에 원인 확정 필수**. 도메인 병인은 `.claude/rules/` 의 실측 "Why" 기록부터 조회 — 같은 증상이 이미 진단돼 있는 경우가 많다
2. 복잡한 경우 `debugger` agent 위임
3. 렌더링 관련이면 수정 후 `/cross-check` 필수
4. 동일 패턴 이슈 → codebase grep → 한 번에 일괄 sweep
5. `pnpm type-check` 통과 확인
6. 사용자-가시 버그면 실제 builder 실동작 1회 exercise (Chrome MCP 또는 사용자 confirm) + 무엇을 exercise 했는지 보고 명시 — CLAUDE.md §완료 기준
7. 완료 시 CHANGELOG 반영 판정 — 사용자-가시 버그 수정이면 docs/CHANGELOG.md Bug Fixes 반영 (rules/changelog.md 트리거 #2)

금지:

- 증상만 덮는 workaround
- eslint-disable / @ts-ignore 신규 추가
- 근본 원인 미확인 상태로 "고쳤다" 선언
