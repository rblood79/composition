# Codex 프로젝트 설정

전역 `~/.codex/config.toml`의 모델·reasoning을 상속합니다. 전역 기본값은 바뀔 수
있으므로 이 문서에 모델명을 고정하지 않습니다. 모델·reasoning은 전역 설정에서,
새 CLI 세션에 들어가는 지침과 skill 목록은 `codex debug prompt-input "환경 확인"`으로
확인합니다.
프로젝트의 `on-request`, `danger-full-access`, `web_search = "live"`는 유지합니다.
컨텍스트 크기나 compaction 임계값을 임의로 강제하지 않습니다.

## 지침과 스킬

루트 `AGENTS.md`는 프로젝트 고유 계약과 검증 진입점만 둡니다.
공용 skill 정본은 `.claude/skills`, Codex의 `.agents/skills`는 심링크입니다.
짧은 description과 SKILL.md에서 관련 도메인·API reference를 선택합니다.
역할 설정은 `.codex/agents`에서 부모의 모델·reasoning을 상속합니다.

## 자동화

프로젝트 `hooks.json`은 2개 handler만 등록합니다:

- `PreToolUse`: 보호 파일 검사.
- `PostToolUse`: 변경한 일반 파일의 로컬 Prettier 포맷. 심링크와 자동 다운로드는 제외.

실행 검증 명령과 범위별 gate는 `.agents/README.md`를 참조합니다.
플러그인 cache는 직접 편집하지 않습니다. 연결 정보와 설치본은 유지합니다.
Composition에서 문서 도구와 범용 data·engineering·Claude API·Claude MD 스킬은
프로젝트 설정으로 제외합니다. 디자인·제품 기획 스킬은 필요할 때 사용할 수 있게
유지합니다. 전역 플러그인 설정은 변경하지 않습니다.

## 확인

```sh
pnpm run codex:hooks:selftest
pnpm exec node --test .codex/tests/hooks.test.mjs
pnpm run codex:agent-catalog
codex debug prompt-input "환경 확인"
codex doctor --summary --no-color
```

`prompt-input`은 새 CLI 프로세스의 입력이며, 현재 대화·desktop thread의 기존 주입 내용이나
명시적 모델 override가 소급 교체됐다는 뜻은 아닙니다. 변경은 새 세션에서 사용합니다.
hook self-test는 설정과 스크립트 계약을 검사합니다. 실제 활성화는 새 CLI 세션에서
`/hooks`로 해당 hook의 trust 상태를 확인합니다.

근거: [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra),
[Codex Hooks](https://learn.chatgpt.com/docs/hooks).
