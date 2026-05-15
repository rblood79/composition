# composition — Codex Progress

Codex 세션 인수인계가 필요할 때만 보는 짧은 진행 index입니다.
일반 작업 시작 시 legacy progress 전체를 기본으로 읽지 않습니다.

## 사용 규칙

- 현재 작업의 이어받기 맥락이 필요할 때만 확인합니다.
- 상세 타임라인은 legacy [`.claude/progress.md`](../.claude/progress.md)에
  남아 있으며, 필요한 경우에만 좁게 엽니다.
- 완료 상태의 정본은 코드, 테스트, ADR/CHANGELOG입니다. 이 파일은 보조
  힌트입니다.

## Codex 운영 메모

- 2026-05-15: ADR-137 Implemented. Page 선택 직후 Properties > Frame 변경이
  stale deferred `selectedElement.page_id` / stale `pageId` closure 때문에 다른
  page에 적용되던 경로를 Selection Consumer Contract로 차단했다.
  page-bound mutation은 `readImmediateSelectionSnapshot()` +
  `apply*FromSelection(snapshot, ...)` 또는 명시 context의
  `apply*Explicit({ pageId, contextReason, ... })`로 분류한다. 문서:
  `docs/adr/completed/137-selection-consumer-contract.md`, breakdown:
  `docs/adr/design/137-selection-consumer-contract-breakdown.md`. 검증:
  targeted Vitest 5 files / 19 tests, `pnpm run codex:preflight`, browser quick
  check errors 0 / warnings 4.
- 2026-05-15: goal tool lifecycle guard 추가. developer objective/resume 문구와
  실제 goal runtime state는 분리될 수 있으므로 완료 처리 전
  `.agents/rules/goal-lifecycle.md`에 따라 `get_goal`을 정본으로 확인한다.
  `get_goal`이 `null`이면 `update_goal(status="complete")`를 호출하지 않는다.
- 2026-04-23: ADR-108 r5.5 P0-P5 구현 완료. `TagGroup`/`TextArea` containerVariants 추가, `TagGroup.css` mirror 주석, TextArea generated CSS, `resolveLabelFlexDir`/`applySideLabelChildStyles` 제거. 검증: specs build, codex:preflight, targeted builder/specs Vitest, 변경 파일 ESLint PASS. P6 orientation(`ToggleButtonGroup`/`Toolbar`)은 follow-up ADR scope.
