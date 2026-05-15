# Debugger Memory

Codex용 debugger 메모 엔트리포인트입니다.

- 정본 메모: [legacy `.claude/agent-memory/debugger/MEMORY.md`](../../../.claude/agent-memory/debugger/MEMORY.md)
- 용도: 재발 버그 패턴과 디버깅 포인트를 빠르게 찾기 위한 진입점

## Codex-local Notes

- 2026-05-15: ADR-137 Page Frame stale-mismatch root cause. Properties 패널의
  deferred `SelectedElement`는 display-only로 취급한다. Page-bound mutation에서
  `element.page_id` 또는 prop `pageId` closure를 commit source로 쓰면 Page A -> B
  전환 직후 wrong page write가 재발한다. selection 경로는
  `readImmediateSelectionSnapshot()` + `apply*FromSelection(snapshot, ...)`,
  projection/editing context는 `apply*Explicit({ pageId, contextReason, ... })`
  로만 분류한다.
