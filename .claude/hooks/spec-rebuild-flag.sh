#!/bin/bash
# PostToolUse Hook: spec / catalog rule table 소스 편집 감지 시 rebuild flag 생성
# - packages/specs/src/** 또는 packages/specs/scripts/** 변경 → .claude/.spec-rebuild-pending touch
# - packages/shared/src/catalog/** 변경 (componentRulesTable.ts 등 rule 정본) → .claude/.css-regen-pending touch
# 실제 build:specs / generate:css 실행은 type-check-gate.sh (Stop hook) 에서 수행 — 다중 편집 debounce
#
# Why (spec): build:specs ~3.3s. 매 Edit 마다 즉시 실행하면 다중 spec 편집 시 누적 대기 폭증.
#   flag 파일 + Stop hook 통합으로 작업 종료 시 1회만 실행.
# Why (catalog — ADR-913 R6 closure 2026-06-22): rule table(packages/shared/) 편집 시
#   Skia(Builder, resolveComponentRule 런타임 직독)는 즉시 갱신되나 generated CSS(Preview/Publish,
#   git-tracked 빌드 산출물)는 stale → Builder↔Preview 시각 발산. generate:css 가 어느 hook/CI/
#   pre-commit 에도 배선 안 돼 작업자 규율에만 의존하던 사각지대를 본 flag + Stop hook generate:css
#   재실행으로 봉합. 입력 체인: generate-css.ts → getComponentRulesTable()
#   (shared/src/catalog/resolvers/resolveComponentRule.ts) → COMPONENT_RULES_TABLE
#   (shared/src/catalog/generated/componentRulesTable.ts) → styles/generated/*.css.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  */packages/specs/src/*|*/packages/specs/scripts/*)
    FLAG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/.spec-rebuild-pending"
    touch "$FLAG_FILE" 2>/dev/null || true
    ;;
esac

# ADR-913 R6: catalog rule table / resolver 편집 → generated CSS 재생성 필요.
# generated CSS 산출물 자체(styles/generated/*.css)는 generate:css 출력이므로 제외 (무한 루프 방지).
case "$FILE_PATH" in
  */packages/shared/src/components/styles/generated/*)
    : # generate:css 산출물 — 트리거 제외
    ;;
  */packages/shared/src/catalog/*)
    CSS_FLAG="${CLAUDE_PROJECT_DIR:-.}/.claude/.css-regen-pending"
    touch "$CSS_FLAG" 2>/dev/null || true
    ;;
esac

exit 0
