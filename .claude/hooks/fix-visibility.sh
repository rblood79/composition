#!/usr/bin/env bash
# Fix Visibility — 반복 fix/revert 가시화 (판정 없는 표시)
#
# 설계: ~/.claude/plans/eventual-humming-charm.md (plan v5)
# 원칙: hook 은 측정·표시만. 판정·임계·리셋·차단 없음. 해석은 사람.
#   - Stop        : 방금 commit 이 fix/revert 면 1줄 사실 표시
#   - SessionStart: 최근 30일 scope 별 fix/revert 집계 + 회귀 테스트 동반 횟수
#
# git log 가 단일 SSOT — 별도 저장소·DB 없음. claude/codex 양 CLI 공유.
set -uo pipefail

INPUT=$(cat 2>/dev/null || true)
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

WINDOW="30 days ago"

# 이벤트 구분 (claude hook stdin payload 의 hook_event_name)
EVENT=$(printf '%s' "$INPUT" \
  | grep -oE '"hook_event_name"[[:space:]]*:[[:space:]]*"[^"]+"' \
  | head -1 | sed -E 's/.*"([^"]+)"$/\1/' || true)

# scope 별 집계 — BSD awk 호환 (정규식 캡처 그룹 미사용)
# 입력: git log --pretty=format:"@@@<hash>\t<subject>" --name-only
# 출력: "<count>\t<test동반count>\t<scope>" (scope 별 1줄)
AGG_AWK='
function flush() {
  if (scope != "") { count[scope]++; if (has_test) tc[scope]++ }
}
/^@@@/ {
  flush()
  rest = substr($0, 4); tab = index(rest, "\t"); subj = substr(rest, tab + 1)
  has_test = 0; scope = ""
  p1 = index(subj, "("); p2 = index(subj, ")")
  if (p1 > 1 && p2 > p1) {
    pre = substr(subj, 1, p1 - 1)
    if (pre == "fix" || pre == "revert") scope = substr(subj, p1 + 1, p2 - p1 - 1)
  }
  next
}
{ if ($0 ~ /\.test\.(ts|tsx)$/) has_test = 1 }
END { flush(); for (s in count) printf "%d\t%d\t%s\n", count[s], tc[s] + 0, s }
'

aggregate() {
  git log --no-merges --since="$WINDOW" \
    --pretty=format:"@@@%H%x09%s" --name-only 2>/dev/null \
    | awk "$AGG_AWK" 2>/dev/null | sort -rn || true
}

case "$EVENT" in
  SessionStart)
    AGG=$(aggregate)
    [ -z "$AGG" ] && exit 0
    # 2회 이상 scope 만 (1회 fix 는 정상 — 노이즈 제거), 상위 10
    HOT=$(printf '%s\n' "$AGG" | awk -F'\t' '$1 >= 2' | head -10)
    [ -z "$HOT" ] && exit 0
    echo "📊 최근 30일 fix/revert 집계 (scope 별 2회+, 횟수순)"
    printf '%s\n' "$HOT" | while IFS=$'\t' read -r cnt tcnt scope; do
      printf '   %-18s %s fix · 회귀테스트 동반 %s\n' "$scope" "$cnt" "$tcnt"
    done
    echo "   → 회귀테스트 동반이 낮은 scope 는 다음 fix 시 테스트 동반 검토 (Beyoncé Rule)"
    exit 0
    ;;
  Stop | "")
    # 빠른 경로: 마지막 commit 이 fix/revert 아니면 즉시 종료
    LAST=$(git log -1 --no-merges --pretty=format:"%s" 2>/dev/null || true)
    case "$LAST" in
      fix\(*\)* | revert\(*\)*) ;;
      *) exit 0 ;;
    esac
    SCOPE=$(printf '%s' "$LAST" | sed -E 's/^(fix|revert)\(([^)]+)\).*/\2/' || true)
    [ -z "$SCOPE" ] && exit 0
    KIND=$(printf '%s' "$LAST" | sed -E 's/^(fix|revert)\(.*/\1/' || true)
    # 방금 commit 의 회귀 테스트 동반 여부
    LAST_FILES=$(git show --name-only --format= HEAD 2>/dev/null || true)
    if printf '%s' "$LAST_FILES" | grep -qE '\.test\.(ts|tsx)$'; then
      TEST_NOTE="회귀 테스트 동반 ✓"
    else
      TEST_NOTE="회귀 테스트 미동반"
    fi
    # 이 scope 의 최근 30일 집계 (사실 표시 — 판정어 없음)
    SUMMARY=$(aggregate | awk -F'\t' -v s="$SCOPE" '$3 == s {print $1"|"$2}' | head -1)
    if [ -n "$SUMMARY" ]; then
      CNT=${SUMMARY%%|*}
      TCNT=${SUMMARY##*|}
      echo "${KIND}(${SCOPE}) — ${TEST_NOTE} · 이 scope 최근 30일 ${CNT}회 (회귀테스트 동반 ${TCNT}회)"
    else
      echo "${KIND}(${SCOPE}) — ${TEST_NOTE}"
    fi
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
