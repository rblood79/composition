# Codex 프로젝트 설정

2026-09-05에 GPT-6 Astra 공식 가이드와 Codex CLI 0.153.4로 점검했습니다.
실행 계약은 루트 `AGENTS.md`, 상세 프로젝트 규칙은 `.claude/` 정본을 참조합니다.

## 모델과 설정

- 기본 모델은 `gpt-6-astra`, reasoning은 `medium`입니다. 현재 계정의 갱신된
  `codex debug models` 카탈로그에서 사용 가능과 기본 effort를 확인했습니다.
- 복잡한 분석에서 필요하면 세션에서 reasoning을 높입니다. 모든 역할에 높은
  effort를 고정하지 않으며, 역할 파일은 부모의 모델과 reasoning을 상속합니다.
- 공식 문서의 최신 내용을 조사할 수 있도록 `web_search = "live"`를 사용합니다.
- 기존 `on-request` 승인과 `danger-full-access` 권한 정책을 유지했습니다.
  이 모드에서 사용되지 않는 `sandbox_workspace_write.network_access`는 제거했습니다.
- context window·compaction 임계값·출력 토큰 수를 임의로 강제하지 않습니다.
  API의 `async` 같은 요청 필드를 Codex 설정 키로 추가하지 않습니다.
- 전역 `~/.codex/config.toml`과 hook 신뢰 상태는 이 작업에서 변경하지 않았습니다.
  새 세션 기본값이며, 실행 중인 세션의 명시적 모델 선택은 별도입니다.

## 지침과 역할

`AGENTS.md`에 자율 진행·추가 메시지 반영·질문 경계·간결한 설명·검증 범위를
정의했습니다. 역할 8개의 식별자는 유지하고, persona·중복 코드 사실·매번 합의하는
Sprint Contract·무조건적인 반복 빌드·자동 메모리 저장 지시를 정리했습니다.
역할별 절차는 해당 skill을 참조합니다. 서브에이전트는 사용자 명시 위임 시에만 씁니다.

## Hook 점검

`hooks.json` 한 곳에서 프로젝트 hook을 등록합니다. 같은 hook을 TOML에 중복 등록하지
않습니다. 현재 5개 이벤트, 8개 handler를 유지합니다.

| 대상                                                                                                 | 처리                                                                        |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `session-start.sh`                                                                                   | 백틱의 셸 명령 실행 오류 수정, 현재 역할·승인·메모리 경계 반영              |
| `auto-format.sh`                                                                                     | 심링크 미러 제외, 로컬 Prettier만 사용하여 hook의 자동 패키지 다운로드 방지 |
| `protect-files.sh`, `codex-hook-utils.sh`                                                            | 기존 보호 판정·patch 경로 추출 유지                                         |
| `route-prompt.sh`, `spec-rebuild-flag.sh`, `type-check-gate.sh`                                      | 기존 라우팅·build debounce·실패 차단·evidence 계약 유지                     |
| `precompact-snapshot.sh`, `statusline.sh`, `subagent-stop.sh`, `weekly-report.sh`, `update-index.sh` | 미등록 legacy 진입점; 아래 설명 참조                                        |

`Edit|Write` matcher는 공식 Codex hook 문서에서 `apply_patch`의 별칭으로 지원합니다.
hook은 보조 장치이며 모든 파일 쓰기를 강제 통제하는 보안 경계는 아닙니다.

미등록 legacy 진입점은 자동 활성화하지 않습니다. snapshot은 `pnpm run codex:snapshot`,
현행 evidence 조회는 `pnpm run agent:dashboard`, 상태 표시는 Codex의 내장 status line을
사용합니다. Claude transcript 형식을 가정한 사용량 집계와 INDEX 자동 갱신은 중단했습니다.
과거 `.codex/stats/` 기록은 보존하며 GPT-6 설정이나 현재 사용량의 근거로 사용하지 않습니다.

## 검증

```sh
pnpm exec node --test .codex/tests/hooks.test.mjs
pnpm run codex:hooks:selftest
pnpm run codex:agent-catalog
codex doctor --summary --no-color
```

설정 로드와 hook self-test는 새 세션의 hook 신뢰 승인·실행 확인을 대체하지 않습니다.
다음 세션에서 `/hooks`로 활성 상태를 확인합니다. 동시 작업의 dirty 파일이 있으면
전체 preflight의 자동 포맷 대신 `codex:format -- <내 파일들>`과 필요한 읽기 게이트를 실행합니다.

이번 점검: TOML 9개 파싱, hook self-test 17개, 추가 회귀 테스트 3개,
agent-catalog(FAIL 0 / WARN 0), 보호 파일·셸 문법·범위별 포맷·diff 검사를 통과했습니다.
Doctor는 설정 로드 성공·0 fail이며 기존 rollout 스캔 경고가 남았습니다.
동시 Builder 변경을 보존하기 위해 전체 preflight는 실행하지 않았습니다.
제품 코드 변경이 없어 제품 type-check와 브라우저 검증은 이번 범위에서 제외했습니다.

## 공식 근거

- [GPT-6 Astra prompting best practices](https://developers.openai.com/api/docs/guides/latest-model#prompting-best-practices)
- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Custom agents와 모델 상속](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents)
- [Hook matcher와 tool coverage](https://learn.chatgpt.com/docs/hooks#tool-coverage)
