---
name: execute-adr
description: 사용자가 지정한 ADR의 미완료 Phase를 의존 순서대로 구현·검증할 때 사용.
user-invocable: true
disable-model-invocation: true
---

# ADR 실행

대상 ADR, 해당 breakdown, 현재 코드·Git 상태·gate 근거로 다음 미완료 Phase를 정합니다.
사용자가 지정한 범위의 구현·검증·문서 갱신까지 이어갑니다. 임의 Phase 수로 중단하지 않습니다.

## 착수와 결정 경계

- Accepted/In Progress와 선행 gate 충족을 확인합니다. 이미 종결된 Phase는 반복하지 않습니다.
- Proposed의 승격은 실제 승인 기록으로 판단합니다. 리뷰의 기술적 PASS만으로
  사용자의 예산·스키마·정책 승인까지 추정하지 않습니다.
- breakdown에 실행 범위·완료 기준이 없으면 승인된 ADR에서 구체화합니다.
  중요한 설계 결정이 새로 필요할 때만 해당 결정에 대해 질문합니다.
- 기존 승인에 포함된 HIGH phase도 재승인 없이 실행합니다. 범위 밖의 스키마·migration·
  breaking change나 새로운 위험은 구체적인 영향과 선택안을 준비한 뒤 사용자에게 알립니다.
- dirty worktree는 다른 변경을 보존하며 진행합니다. 자동 stash·reset·branch 전환은 하지 않습니다.

## 구현과 검증

Phase의 변경 범위와 성공 기준을 짧게 알리고 필요한 도메인 지침만 읽습니다.
회귀 조건은 인접 테스트로 고정하고 실제 phase gate를 실행합니다.
TS 변경은 typecheck, spec 변경은 build:specs, 렌더링 변경은 `cross-check`로 확인합니다.
registration·resolved-tree wiring·schema 변경은 unit PASS뿐 아니라 실제 Builder 경로를
exercise합니다. 검증 실패는 승인 범위에서 원인을 해결하고 영향받은 검사만 재실행합니다.

다단계 근거는 `pnpm run agent:run`의 run/evidence에 남깁니다. 실행·closure 명령은
`.agents/README.md`, 상태 전이는 [ADR 작성 규칙](../../rules/adr-writing.md)을 참조합니다.
모든 gate가 충족되면 Phase 기록과 관련 README·CHANGELOG를 갱신하고 다음 승인된 Phase로 갑니다.
전체 종결 시 Implemented 상태·archive 경로·링크도 함께 맞춥니다.

commit/push는 사용자 요청이 있을 때만 [Git 계약](../../rules/git-workflow.md)에 따라 수행합니다.
보고에는 실제 완료된 범위, 검사 결과, 남은 결정이나 차단 이유를 구분합니다.
