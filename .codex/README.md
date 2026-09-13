# Codex 프로젝트 설정

전역 `~/.codex/config.toml`의 모델·reasoning을 상속합니다.
2026-09-13 기준 전역 기본값은 `gpt-6-astra` / `medium`이며,
현재 계정의 `codex debug models`에서 모델 제공과 기본 effort를 확인했습니다.
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

중복 skill roster, 키워드 router, fix 횟수 주입, 전체 dirty typecheck는 자동 등록하지 않습니다.
기존 미등록 adapter는 수동 호환 용도입니다. 실제 build·typecheck·live 검증과 evidence는
요청 범위에 맞게 수행합니다. 명령은 `.agents/README.md`를 참조합니다.
플러그인 cache는 직접 편집하지 않습니다. 연결 정보와 설치본은 유지하며, 중복되거나 기본 코딩 작업과 무관한 Cowork 업무
workflow는 전역에서 비활성화합니다. 문서 도구는 Composition에서만 제외합니다.

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

근거: [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).
