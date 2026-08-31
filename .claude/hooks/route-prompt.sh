#!/usr/bin/env bash
# UserPromptSubmit hook — 프롬프트에서 의도 3종만 감지해 한 줄 힌트를 additionalContext 로 주입
#
# 2026-08-31 축소 (실측 495 프롬프트/50 세션): 구 14 분기가 42% 프롬프트에 평균 897B 를 실었고
# 대부분이 CLAUDE.md·path rule·skill description 과 중복이거나 오탐이었다 —
#   "PR" 이 preview/props 의 pr 에 매칭(완료 143회), "test" 가 latest 에, "이동"·"반대"·"상태" 가 일상어에,
#   skill 본문이 user 메시지로 주입될 때 8~9 분기 동시 발화, "6. … 진행해" 가 ADR phase 실행으로.
# 남긴 것 = 상시 context 가 못 주는 시점 신호 3개 (ADR 사용자 전용 진입점 / 렌더링 cross-check / 정정→메모리).
# 분기 추가 전 확인: CLAUDE.md 나 rules/ 가 이미 말하는가? 정규식이 영어 부분 문자열에 걸리는가?

set -euo pipefail

payload=$(cat)
if command -v jq >/dev/null 2>&1; then
  prompt=$(printf '%s' "$payload" | jq -r '.prompt // empty' 2>/dev/null || echo "")
else
  prompt=$(printf '%s' "$payload" | sed -n 's/.*"prompt":"\([^"]*\)".*/\1/p')
fi
[ -z "$prompt" ] && exit 0

# skill 본문 / 붙여넣은 문서는 사용자 의도가 아니다 — 분석 제외
case "$prompt" in
  "Base directory for this skill"*|*"<command-name>"*) exit 0 ;;
esac
[ "${#prompt}" -gt 4000 ] && exit 0

hints=""

# ADR — 사용자 전용 진입점 (execute-adr / create-adr 는 모델 자동 호출 비활성). 번호 또는 명시 키워드 요구 — "N. … 진행해" 오탐 차단
if printf '%s' "$prompt" | grep -qiE "ADR-?[0-9]{2,3}.{0,20}(실행|진행|Phase)|execute-adr"; then
  hints="${hints}
- ADR phase 실행 → \`execute-adr\` 는 사용자 전용: \`/execute-adr NNN\` 직접 입력을 안내하고 대기 (자율 phase 실행 금지)"
elif printf '%s' "$prompt" | grep -qiE "ADR.{0,30}(리뷰|검토|review)"; then
  hints="${hints}
- ADR 리뷰 → \`review-adr\` skill"
elif printf '%s' "$prompt" | grep -qiE "ADR.{0,20}(생성|작성|만들|초안)|new ADR|/new-adr"; then
  hints="${hints}
- ADR 생성 → \`create-adr\` 는 사용자 전용: \`/new-adr <제목>\` 직접 입력을 안내하고 대기"
fi

# 렌더링 — 수정 후 cross-check 는 CLAUDE.md 에도 있지만 착수 시점에 한 줄로 상기
if printf '%s' "$prompt" | grep -qiE "렌더링|Skia|CanvasKit|cross[- ]?check|정합성 ?(검증|체크)"; then
  hints="${hints}
- 렌더링 변경 → 수정 후 \`/cross-check\` 필수 (CSS/Skia 2 타겟 × 5 레이어) · 원인 추적은 \`debugger\` agent"
fi

# 사용자 정정 — 전제·관점 / SSOT / 정책 / 의존 방향 류면 same-session 메모리 기록 (단발 오타 정정은 제외)
if printf '%s' "$prompt" | grep -qiE "아니야|아니라|그게 아니|틀렸|정정하자면|잘못 ?(이해|읽|봤|알)|misunderstood|that'?s wrong|not what I"; then
  hints="${hints}
- 정정 감지 → 전제·관점/SSOT/정책/의존 방향 류면 \`memory/feedback-*.md\` 신규·갱신 + MEMORY.md 한 줄 (\"다음에 기억\" 약속만으로 끝내지 않는다); 단발 오타 정정은 skip"
fi

if [ -n "$hints" ]; then
  cat <<EOF
<workflow-hints>
${hints#
}
</workflow-hints>
EOF
fi

exit 0
