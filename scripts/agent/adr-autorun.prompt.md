# 자동 실행 모드 (adr-autorun)

이 세션은 `scripts/agent/adr-autorun.sh` 가 시작했다. 답할 사람이 없다. 아래 규칙이 `execute-adr` skill · `.claude/loop.md` 의 「사용자에게 묻는다」 · 「커밋은 요청 시에만」 보다 앞선다.

## 범위

- 이번 세션은 사용자 메시지가 지정한 일 **하나만** 한다 — ADR 의 다음 미완료 Phase 하나, 또는 판독 지적 수리.
- `.agent/task-state.json` 의 `goal` 이 이 ADR 이 아니면 아무것도 고치지 말고 blocked 로 끝낸다 (`goal` 은 사용자만 바꾼다).

## 결정 지점 — 묻지 말고 멈춘다

AskUserQuestion 은 쓸 수 없다. 아래에 닿으면 작업을 멈추고 blocked 로 기록한다. 확정되지 않은 결정을 추정으로 채우지 않는다.

- `.claude/rules/premise-decision-points.md` 의 4개 결정 지점
- execute-adr 의 「이번 Phase 가 닿는 사용자 결정」 중 ADR 본문 · breakdown · `docs/adr/reviews/` 에 답이 없는 것
- 승인 범위 밖의 스키마 · breaking change · 새 위험 · scope 변경
- 새 ADR 파일 작성

통상 구현 판단 (파일 범위 · 테스트 구성 · 순서 · 추정 vs 실측 gap) 은 멈춤 사유가 아니다 — 진행하고 기록한다.

## 다음 세션을 위한 기록

다음 세션은 이 대화를 모른다 — breakdown · task-state · git 만 읽는다.

- Phase 안에서 내린 판단 (고른 대안과 이유 · 측정 값 · 버린 접근) 은 그때그때 breakdown §기록 에 적는다.
- Phase 가 이 세션에 다 안 들어갈 것 같으면 (컨텍스트 절반 이상 사용) 끝난 단위까지 커밋하고 breakdown §기록 · task-state `next` 를 갱신한 뒤 `continue` 로 끝낸다.
- 컨텍스트 절약: 테스트 · 빌드 출력은 파일로 받고 `tail` · `grep` 으로 본다. 넓은 조사는 Explore 서브에이전트에 맡긴다.

## 검증 · 커밋

- live exercise 는 chrome-devtools-mcp 로 한다 (dev 서버 `$BUILDER_URL` 실행 중 — 사용자 메시지에 적혀 있다). Claude in Chrome 은 쓰지 않는다. live 확인을 못 하면 Phase 를 닫지 말고 blocked.
- 커밋은 자기 파일만 pathspec 으로 (`git add -- <paths>` · `git commit -- <paths>`). `git add -A` · `-u` · `.` · `commit -a` 금지.
- **push 하지 않는다** — 스크립트가 gate · codex 판독을 통과시킨 뒤 push 한다.
- 끝날 때 working tree 에 미커밋 변경을 남기지 않는다 (gitignore 파일 제외). 남으면 스크립트가 blocked 로 본다.

## 마지막 행동 — 상태 파일

세션의 마지막 도구 호출로 `.agent/autorun/status.json` 을 Write 로 쓴다. 이 파일이 없거나 형식이 틀리면 스크립트는 blocked 로 본다.

```json
{
  "status": "continue",
  "phase": "Phase 2",
  "summary": "이번 세션에서 한 일 한 줄",
  "reason": "",
  "question": ""
}
```

- `continue` — 남은 Phase (또는 이어 갈 단위) 가 있다
- `done` — ADR 전체 종결 (Implemented 승격 · Phase 0 no-go 종결 포함)
- `blocked` — 사람이 필요하다. `reason` 에 멈춘 이유, `question` 에 사용자에게 물을 것과 선택안을 적는다
