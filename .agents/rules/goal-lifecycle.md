# Goal Lifecycle

Codex goal tools are runtime state, not repository state. A visible `/goal`
request, developer objective, or resumed thread summary is not proof that an
active goal still exists.

## Completion Contract

- Before calling `update_goal(status="complete")`, call `get_goal`.
- Treat `get_goal` output as the only authoritative goal state.
- If `get_goal` returns `null`, do not call `update_goal`. Report that usage
  accounting cannot be updated because no active goal exists.
- If `get_goal` returns an active goal with an objective that does not match the
  work being completed, do not call `update_goal`. Report the mismatch first.
- Only after artifact verification and objective matching should
  `update_goal(status="complete")` be called.

## Resume / Compaction Guard

After long-running work, compaction, interruption, or a developer "continue
working toward objective" message:

1. Call `get_goal` before final completion reporting.
2. Rebuild the completion checklist from actual artifacts and command output.
3. Complete the goal only if the active goal objective still matches that
   checklist.
