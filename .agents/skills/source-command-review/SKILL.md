---
name: "source-command-review"
description: "완료 직전 품질 검증 — reviewer agent + 실행 근거 확인"
---

# source-command-review

Use this skill when the user asks to run the migrated source command `review`.

## Command Template

현재 작업을 완료 선언 전 품질 검증한다.

절차:

1. 근거 우선 — "통과했다 / 고쳤다" 주장 전에 해당 검증 명령을 **실제로 실행**하고 그 출력을 확인. 실행하지 않은 것을 통과로 서술 금지 (AGENTS.md §완료 기준)
2. `reviewer` agent 위임 — 9개 체크리스트 (스타일/TS/Canvas/보안/상태/성능/레이아웃/검증/ADR)
3. `pnpm type-check` 실행 결과 첨부
4. 렌더링 변경 포함 시 `/cross-check`
5. 렌더/wiring/schema 변경 포함 시 실동작 1회 exercise (Chrome MCP 또는 사용자 confirm) — AGENTS.md §완료 기준
6. CRITICAL/HIGH 이슈는 즉시 수정 (스킵 금지)
7. 통과 조건 충족 시에만 "완료" 선언
