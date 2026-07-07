---
description: 완료 직전 품질 검증 — reviewer agent + verification-before-completion
---

현재 작업을 완료 선언 전 품질 검증한다.

절차:

1. `superpowers:verification-before-completion` skill — evidence before assertions
2. `reviewer` agent 위임 — 9개 체크리스트 (스타일/TS/Canvas/보안/상태/성능/레이아웃/검증/ADR)
3. `pnpm type-check` 실행 결과 첨부
4. 렌더링 변경 포함 시 `/cross-check`
5. 렌더/wiring/schema 변경 포함 시 실동작 1회 exercise (Chrome MCP 또는 사용자 confirm) — CLAUDE.md §완료 기준
6. CRITICAL/HIGH 이슈는 즉시 수정 (스킵 금지)
7. 통과 조건 충족 시에만 "완료" 선언
