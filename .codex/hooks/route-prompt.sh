#!/usr/bin/env bash
# UserPromptSubmit hook — 프롬프트 분류 후 관련 skill/agent 힌트를 system-reminder로 주입
# Claude Code 레퍼런스: https://docs.claude.com/en/docs/claude-code/hooks
#
# stdin으로 JSON을 받고, stdout으로 출력한 텍스트가 additionalContext로 주입된다.

set -euo pipefail

# JSON payload 읽기 (claude code가 stdin으로 전달)
payload=$(cat)

# prompt 추출 (jq 없을 수도 있으니 fallback)
if command -v jq >/dev/null 2>&1; then
  prompt=$(echo "$payload" | jq -r '.prompt // empty' 2>/dev/null || echo "")
else
  prompt=$(echo "$payload" | sed -n 's/.*"prompt":"\([^"]*\)".*/\1/p')
fi

[ -z "$prompt" ] && exit 0

hints=""

# 렌더링 / Canvas / Skia / CSS 정합성
if echo "$prompt" | grep -qiE "렌더링|Skia|Canvas|WebGL|정합성|cross[- ]?check|CSS.*(WebGL|Canvas|Skia)"; then
  hints="${hints}
- 렌더링 작업 감지 → \`/cross-check\` skill 필수 실행
- 디버깅 필요 시 \`debugger\` agent 위임 (Read/Grep/Bash 허용)
- 2개 렌더링 타겟 × 5개 레이어 모두 검증 (spec/factory/CSS renderer/Skia renderer/editor)"
fi

# ADR 실행 / phase 진행 (먼저 매칭 — 더 구체적)
# 키워드: ADR-NNN + 실행/진행/land/Phase 류 결합
if echo "$prompt" | grep -qiE "ADR[- ]?[0-9]+.{0,30}(실행|진행|land|next)|execute[- ]?adr|Phase[- ]?[0-9α-ωA-Z\-]*.{0,15}(실행|진행|land|next)|다음 ?Phase|미[- ]?land|phase ?(자동|진행|실행|land)|adr ?phase ?(실행|진행)|P[- ]?[0-9α-ωA-Z]+.{0,15}(실행|land|진행)"; then
  hints="${hints}
- ADR phase 실행 감지 → \`execute-adr\` skill (또는 \`/execute-adr {NNN}\`)
  - Phase 0 사전 조건 6 항목 통과 필수 (design breakdown 존재 / Status / git clean / main / type-check baseline / dist 신선도 / framing 4 질문)
  - HIGH+ phase 는 mode=auto 라도 무조건 사용자 surface
  - main 직접 push (rules/git-workflow.md 절대 정책 — PR 금지)
  - max_phases=3 default (HIGH 비용 누적 차단)"
# ADR 작성 / 리뷰 (실행 키워드 미매칭 시)
elif echo "$prompt" | grep -qiE "ADR|아키텍처 결정|설계 문서|architecture decision"; then
  hints="${hints}
- ADR 작업 감지:
  - 생성 → \`create-adr\` skill (번호 자동 할당 + Risk-First 템플릿)
  - 리뷰 → \`review-adr\` skill
  - 실행/phase land → \`execute-adr\` skill
  - rules/adr-writing.md 자동 로드 (docs/adr/** 글롭)"
fi

# 새 컴포넌트 / S2 전환
if echo "$prompt" | grep -qiE "새 컴포넌트|컴포넌트 (구현|만들|추가|설계)|new component|implement component|S2 전환"; then
  hints="${hints}
- 새 컴포넌트 워크플로:
  1. \`superpowers:brainstorming\` — 요구사항/설계 탐색
  2. \`component-design\` skill — React Aria/Spectrum 문서 참조
  3. \`superpowers:writing-plans\` — 다단계 계획
  4. \`implementer\` agent → \`reviewer\` agent → \`evaluator\` agent"
fi

# 버그 / 에러
if echo "$prompt" | grep -qiE "버그|bug|에러|error|실패|fail|crash|broken|안 ?(됨|되|나와)|망가"; then
  hints="${hints}
- 버그 수정 워크플로:
  1. \`superpowers:systematic-debugging\` skill (4단계 root-cause)
  2. \`debugger\` agent 위임 고려
  3. 수정 후 \`/cross-check\` (렌더링 관련인 경우)
  - ❌ 금지: 증상만 덮는 workaround, eslint-disable"
fi

# 리팩토링
if echo "$prompt" | grep -qiE "리팩토링|refactor|재구조|이동|migration|마이그레이션"; then
  hints="${hints}
- 리팩토링 워크플로:
  - 대규모 → \`refactorer\` agent + \`superpowers:using-git-worktrees\` (격리)
  - 2+ 독립 작업 → \`superpowers:dispatching-parallel-agents\`
  - 완료 후 \`reviewer\` agent 검증"
fi

# 테스트
if echo "$prompt" | grep -qiE "테스트|test|E2E|storybook|playwright|vitest"; then
  hints="${hints}
- 테스트 작업 → \`tester\` agent (Vitest/RTL/Storybook/Playwright)
- 구현 중 → \`superpowers:test-driven-development\` (RED-GREEN-REFACTOR)"
fi

# 레이아웃 / Taffy
if echo "$prompt" | grep -qiE "레이아웃|layout|Taffy|flex|grid|align|정렬"; then
  hints="${hints}
- 레이아웃 작업 → rules/layout-engine.md 자동 로드 (packages/layout-flow/**)
- layoutVersion 3-심볼 체인: LAYOUT_PROP_KEYS (캐시) + NON_LAYOUT_PROPS_UPDATE (블랙리스트) + INHERITED_LAYOUT_PROPS_UPDATE (상속) 동시 점검"
fi

# 상태관리 / Zustand
if echo "$prompt" | grep -qiE "상태|store|zustand|slice|elementsMap|childrenMap"; then
  hints="${hints}
- 상태관리 작업 → rules/state-management.md 자동 로드
- 파이프라인 순서 필수: Memory → Index → History → DB → Preview → Rebalance"
fi

# 병렬 검증
if echo "$prompt" | grep -qiE "전체 검증|일괄|패밀리|컴포넌트 전체|parallel|sweep"; then
  hints="${hints}
- 패밀리 단위 일괄 → \`parallel-verify\` skill
- 반복 검증 루틴 → \`/loop\` 활용"
fi

# 사용자 정정 / framing 재지정 — auto-memory 적재 권고
if echo "$prompt" | grep -qiE "아니야|아니라|그게 아니|잘못|틀렸|틀렸어|정정|다시 봐|다시 보니|본질은|그런 게 아니|반대|거꾸로|^아니|correct(ion)?|actually|wrong|misunderstood|reverse"; then
  hints="${hints}
- 사용자 정정 감지 → 정정 내용이 framing / process / SSOT / 정책 / 의존 방향 류면 **same-session memory 적재 권고**:
  1. 정정 내용 요약 (1-2 문장 + Why + How to apply)
  2. \`~/.claude/projects/-Users-admin-work-composition/memory/feedback-*.md\` 신규 또는 기존 갱신
  3. \`MEMORY.md\` 인덱스에 한 줄 추가
  - 단발성 사실 정정 (typo / 변수명 / 숫자 오타) 이면 skip
  - 회피 패턴: \"다음에 기억하겠음\" 약속만 (메모리 미적재) — 다음 세션에서 동일 정정 재발 위험
  - 우선 적재 카테고리: SSOT 경계, ADR 의존 방향, framing raise 의무, git/PR 정책, 재발 패턴"
fi

# 완료 / 머지 — git working tree에 변경 있을 때만 의미 있음 (단순 질문 false-positive 차단)
if echo "$prompt" | grep -qiE "완료|끝났|마무리|머지|merge|PR|커밋|commit"; then
  if ! git -C "${CLAUDE_PROJECT_DIR:-.}" diff --quiet HEAD 2>/dev/null \
     || [ -n "$(git -C "${CLAUDE_PROJECT_DIR:-.}" ls-files --others --exclude-standard 2>/dev/null)" ]; then
    hints="${hints}
- 완료 직전 체크:
  - \`superpowers:verification-before-completion\` (evidence before assertions)
  - \`superpowers:requesting-code-review\` 또는 \`reviewer\` agent
  - pnpm type-check 통과 확인"
  fi
fi

# 힌트가 있으면 출력
if [ -n "$hints" ]; then
  cat <<EOF
<workflow-hints>
프롬프트 분석 기반 권장 워크플로 (route-prompt.sh):
$hints

위 힌트는 자동 분석 결과입니다. 필요 시 무시 가능하나, 권장 skill/agent는 ROI가 검증된 루트입니다.
</workflow-hints>
EOF
fi

exit 0
