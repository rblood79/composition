# Codex 작업 인수인계

현재 작업은 로컬 `.agent/task-state.json`에서 확인합니다. 다른 작업의 상태를
현재 요청보다 우선하지 않으며 `goal`, `guard`, `stop`은 승인 없이 바꾸지 않습니다.

완료 근거는 변경한 코드·테스트, 해당 ADR/CHANGELOG, 필요할 때 기록한
`.agent/runs/` evidence에서 확인합니다. 이전 작업의 긴 타임라인은
[`.claude/progress.md`](../.claude/progress.md)와 각 ADR 문서에서 필요한 항목만 읽습니다.
이 파일에 있던 이전 완료 기록은 [ADR-186](../docs/adr/design/186-phase-5-production-cutover.md),
[ADR-137](../docs/adr/completed/137-selection-consumer-contract.md),
[ADR-108](../docs/adr/completed/108-container-runtime-derived-styles.md)에서 확인합니다.

이 파일에는 시점이 지난 완료 목록을 다시 쌓지 않습니다.
