# Codex Goal 상태

Goal은 사용자가 명시한 `/goal` 또는 상위 지침이 명시적으로 시작한 작업의
런타임 상태입니다. 일반 요청을 임의로 Goal로 만들지 않습니다.

Goal 작업을 이어받거나 완료하려면 먼저 `get_goal`로 현재 상태와 objective를
확인합니다. 대화의 요약이나 `.agent/task-state.json`은 활성 Goal의 증거가 아닙니다.

완료 처리 순서:

1. 실제 산출물과 검증 결과가 objective를 충족하는지 확인합니다.
2. `get_goal`의 활성 objective가 그 작업과 일치할 때만
   `update_goal(status="complete")`를 호출합니다.
3. Goal이 없거나 objective가 다르면 완료 상태를 바꾸지 않고 차이를 보고합니다.

중단·compaction 뒤 명시적 Goal을 재개할 때도 현재 Goal과 산출물을 다시 대조합니다.

근거: [Using Goals in Codex](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex).
