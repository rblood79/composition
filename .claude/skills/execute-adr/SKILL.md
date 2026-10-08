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
- Proposed의 승격은 승인 기록으로 판단합니다 — 사용자의 `/execute-adr NNN` 호출과
  `docs/adr/reviews/NNN.md` 최신 round (pending 0 · CRITICAL/HIGH 전부 fixed) 가 있으면
  되묻지 않고 Accepted 로 올리고 Status 에 근거를 적습니다. 본문의 「사용자 결정 N건」 중
  이번 Phase 가 닿는 항목만 묻습니다. 리뷰의 기술적 PASS만으로 사용자의 예산·스키마·정책
  승인까지 추정하지 않습니다.
- breakdown에 실행 범위·완료 기준이 없으면 승인된 ADR에서 구체화합니다.
  중요한 설계 결정이 새로 필요할 때만 해당 결정에 대해 질문합니다.
- 기존 승인에 포함된 HIGH phase도 재승인 없이 실행합니다. 범위 밖의 스키마·migration·
  breaking change나 새로운 위험은 구체적인 영향과 선택안을 준비한 뒤 사용자에게 알립니다.
- scope 1.5배 이상 · sub-group 3개 이상 · sliver 커밋 5개 이상은 질문 없이 진행하되
  커밋 메시지와 breakdown 기록에 사후 보고합니다 ([ADR 작성 규칙](../../rules/adr-writing.md)).
- dirty worktree는 다른 변경을 보존하며 진행합니다. 자동 stash·reset·branch 전환은 하지 않습니다.
- `.agent/task-state.json` 을 작업 시작 · 단계 전환 · 검증 완료 · 차단 때 갱신합니다.
  끝난 작업의 키는 archive 파일로 옮깁니다.

## 구현과 검증

Phase의 변경 범위와 성공 기준을 짧게 알리고 필요한 도메인 지침만 읽습니다.
회귀 조건은 인접 테스트로 고정하고 실제 phase gate를 실행합니다.
TS 변경은 typecheck, catalog rule 의 CSS 반영 값 변경은 `pnpm generate:css` (palette 입력도
바뀌면 `pnpm build:specs`), 렌더링 변경은 `cross-check`, 사용자-가시 흐름은 `evaluate`,
성능 경로는 `pnpm gate:perf-ratchet`, 심볼 삭제·개명 뒤는 `pnpm docs:stale-symbols` 로 확인합니다.
registration·resolved-tree wiring·schema 변경은 unit PASS뿐 아니라 실제 Builder 경로를
exercise합니다. 검증 실패는 승인 범위에서 원인을 해결하고 영향받은 검사만 재실행합니다.

판독은 phase 당 1회 + 수리 검증 1회가 상한입니다. 수리 검증에서 HIGH 0 이면 실행자가 닫힘을
선언하고, production 재현이 없는 커버리지 지적은 LOW deferred 로 둡니다
([판독 루프 종결](../../rules/review-loop-closure.md)).

다단계 근거는 `pnpm run agent:run`의 run/evidence에 남깁니다. `docs/adr/evidence/` 와
`.agent/runs/` 는 gitignore 된 로컬 전용이므로, live 결과의 결론은 ADR 본문 `### Live Exercise`
절과 breakdown 에 둡니다. 실행·closure 명령은 `.agents/README.md`, 상태 전이는
[ADR 작성 규칙](../../rules/adr-writing.md)을 참조합니다.

Phase 가 닫히면 네 곳을 갱신합니다 — ADR 본문 Status 의 Phase 인용 블록, breakdown §기록,
`docs/adr/README.md` (현황 공지 · 열려 있는 것 항목 · 권장 착수 순서 표), `docs/CHANGELOG.md`
(Phase 단위 엔트리). 그 뒤 다음 승인된 Phase로 갑니다.
전체 종결 시 Implemented 로 올리고 본문을 `git mv` 로 `docs/adr/completed/` 에 옮긴 뒤 README
완료 표 · 열림/합계 수 · 링크를 맞춥니다. Phase 0 go/no-go 의 no-go 로 Deprecated 하거나
측정 기록으로 종결하는 것도 정상 종결입니다.

commit/push는 사용자 요청이 있을 때만 [Git 계약](../../rules/git-workflow.md)에 따라 수행합니다.
보고에는 실제 완료된 범위, 검사 결과 (실제로 exercise 한 것), 남은 결정이나 차단 이유를 구분합니다.
