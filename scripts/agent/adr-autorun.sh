#!/usr/bin/env bash
# ADR 자동 실행 — `pnpm agent:autorun -- <NNN> [--max-phases N] [--no-codex] [--dry-run]`
#
# Phase 하나 = 새 Claude 세션 하나 (`claude -p`). 컨텍스트가 매번 비어서 시작하고, 세션 사이의
# 넘겨주기는 breakdown §기록 · task-state · git 이 맡는다. 한 Phase 의 흐름:
#
#   1. claude -p "/execute-adr NNN" — 다음 미완료 Phase 하나 구현 · 검증 · 커밋 (push 금지)
#      규칙: adr-autorun.prompt.md (결정 지점이면 묻지 않고 blocked 로 멈춘다)
#   2. gate — type-check · 바뀐 package 의 vitest --changed · engine 이면 cargo test ·
#      render 경로면 G3 ratchet. 하나라도 실패하면 멈춘다 (오류가 다음 Phase 로 쌓이지 않게)
#   3. codex 판독 1회 (read-only, review-schema.json). CRITICAL/HIGH/MEDIUM 이 있으면
#      수리 세션 1회 → gate → 수리 검증 판독 1회. 그래도 CRITICAL/HIGH 면 멈춘다
#      (.claude/rules/review-loop-closure.md — phase 당 판독 1 + 수리 검증 1)
#   4. git push origin main — gate · 판독을 통과한 커밋만
#   5. 세션이 쓴 .agent/autorun/status.json 이 continue 면 다음 Phase, done · blocked 면 끝
#
# 시작 조건: main · working tree clean · origin/main 과 같은 커밋 · dev 서버 ($BUILDER_URL) 응답.
# 이 checkout 을 혼자 쓴다고 가정한다 — 병렬 세션이 같은 checkout 을 고치면 쓰지 않는다.
# 기록: .agent/autorun/<시각>-adrNNN/ (세션 JSON · gate 로그 · 판독 JSON · summary.md, gitignore)
#
# exit: 0 = done · 1 = 사용 오류 / 시작 조건 실패 · 3 = blocked (사람이 필요) · 4 = max-phases 도달
# macOS bash 3.2 호환.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
source "$ROOT_DIR/scripts/codex/validation-scope.sh"

PROMPT_FILE="scripts/agent/adr-autorun.prompt.md"
SCHEMA_FILE="scripts/agent/adr-autorun.review-schema.json"
STATE_DIR=".agent/autorun"
STATUS_FILE="$STATE_DIR/status.json"
BUILDER_URL="${BUILDER_URL:-http://localhost:5173}"
UNIT_PACKAGES="apps/builder apps/publish packages/rendering packages/sample-data packages/shared packages/upload-engine"

usage() {
  sed -n 2,2p "$0" | sed 's/^# //'
  echo "  --max-phases N  세션 수 상한 (기본 20) · --no-codex  판독 생략 · --dry-run  조건 확인 + 프롬프트 출력만"
  echo "  env BUILDER_URL (기본 http://localhost:5173)"
}

if [ "${1:-}" = "--" ]; then shift; fi
ADR=""; MAX_PHASES=20; CODEX=1; DRY_RUN=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --max-phases) MAX_PHASES="${2:?--max-phases 값 필요}"; shift 2 ;;
    --no-codex) CODEX=0; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    [0-9]*) ADR="$1"; shift ;;
    *) echo "[autorun] 알 수 없는 인자: $1" >&2; usage >&2; exit 1 ;;
  esac
done
[ -n "$ADR" ] || { usage >&2; exit 1; }

ADR_FILE=$(ls docs/adr/"$ADR"-*.md 2>/dev/null | head -1 || true)
BREAKDOWN_FILE=$(ls docs/adr/design/"$ADR"-*breakdown*.md 2>/dev/null | head -1 || true)

RUN_DIR="$STATE_DIR/$(date +%Y%m%d-%H%M%S)-adr$ADR"   # 시작 조건 통과 뒤 만든다
LOG="$RUN_DIR/autorun.log"
SUMMARY="$RUN_DIR/summary.md"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }

notify() {  # $1 = 제목 꼬리 · $2 = 본문
  local body; body=$(printf '%s' "$2" | tr -d '"\\' | cut -c1-200)
  osascript -e "display notification \"$body\" with title \"ADR-$ADR autorun: $1\"" >/dev/null 2>&1 || true
}

finish() {  # $1 = done|blocked|stopped · $2 = 메시지
  local code=3
  case "$1" in done) code=0 ;; stopped) code=4 ;; esac
  log "== $1: $2"
  printf '\n## 결과: %s\n\n%s\n' "$1" "$2" >>"$SUMMARY"
  notify "$1" "$2"
  echo "[autorun] 기록: $RUN_DIR"
  exit "$code"
}

# ---------- 시작 조건 ----------
preflight() {
  local miss=""
  for c in claude jq git pnpm curl; do command -v "$c" >/dev/null 2>&1 || miss="$miss $c"; done
  [ "$CODEX" = 1 ] && { command -v codex >/dev/null 2>&1 || miss="$miss codex"; }
  [ -z "$miss" ] || { echo "[autorun] 명령 없음:$miss" >&2; return 1; }
  [ -n "$ADR_FILE" ] || { echo "[autorun] 열린 ADR 없음: docs/adr/$ADR-*.md (completed 는 대상 아님)" >&2; return 1; }
  [ "$(git symbolic-ref --short HEAD 2>/dev/null)" = main ] || { echo "[autorun] main 이 아니다" >&2; return 1; }
  [ -z "$(git status --porcelain)" ] || { echo "[autorun] working tree 가 깨끗하지 않다 — 커밋하거나 치운 뒤 실행" >&2; git status --short >&2; return 1; }
  # 세션의 push 차단은 pushurl 하나를 더하는 방식이다 — pushurl 은 여러 값이라 기존 값이 있으면 그쪽으로도 push 된다
  # 내용이 아니라 항목 존재로 본다 — 빈 값 (`pushurl =`) 도 목록을 바꿔 push 대상이 origin url 로 돌아간다
  ! git config --get-all remote.origin.pushurl >/dev/null 2>&1 \
    || { echo "[autorun] remote.origin.pushurl 이 설정돼 있다 — 세션의 push 를 막을 수 없어 시작하지 않는다 (git config --unset-all remote.origin.pushurl)" >&2; return 1; }
  git fetch -q origin main || { echo "[autorun] git fetch 실패 — 원격 상태를 모르면 시작하지 않는다" >&2; return 1; }
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "[autorun] HEAD ≠ origin/main — pull 또는 push 먼저" >&2; return 1; }
  curl -sf -o /dev/null --max-time 5 "$BUILDER_URL" || { echo "[autorun] dev 서버 응답 없음: $BUILDER_URL — pnpm dev 먼저" >&2; return 1; }
}

# ---------- Claude 세션 ----------
phase_prompt() {
  printf '/execute-adr %s\n\n자동 실행 (adr-autorun) — 다음 미완료 Phase 하나만 구현 · 검증하고 커밋한다 (push 금지). dev 서버: %s. 끝나면 %s 를 쓴다.' \
    "$ADR" "$BUILDER_URL" "$STATUS_FILE"
}

repair_prompt() {  # $1 = 판독 JSON
  printf '%s\n' "자동 실행 (adr-autorun) — ADR-$ADR 판독 지적 수리. 지적 목록: $1 (JSON, codex 판독)." \
    "" \
    "- CRITICAL/HIGH: root cause 를 고치고, 수정을 되돌리면 실패하는 회귀 테스트를 같이 둔다." \
    "- MEDIUM: production 재현 시나리오가 있으면 수리, 없으면 breakdown §기록 에 LOW deferred 로 적는다." \
    "- 판독이 틀렸으면 근거 (파일:라인 · 실행 출력) 와 함께 breakdown §기록 에 rejected 로 적는다." \
    "- 지적마다 처리 (수리 · deferred · rejected) 를 남기고 커밋한다 — 커밋이 없으면 스크립트가 멈춘다 (push 금지). dev 서버: $BUILDER_URL. 끝나면 $STATUS_FILE 를 쓴다 (수리를 마쳤으면 status = continue)."
}

# claude_session <label> <prompt> — 성공이면 STATUS · STATUS_SUMMARY · STATUS_REASON 설정, 실패면 finish
claude_session() {
  local label="$1" prompt="$2" out="$RUN_DIR/claude-$1.json"
  rm -f "$STATUS_FILE"
  log "claude 세션 시작: $label"
  # 세션 동안 origin 의 push 주소를 없는 주소로 바꾼다 — 원격 쓰기는 gate · 판독 뒤 스크립트의 push 에만 있다.
  # (git push 도구 차단은 명령 글자만 보고, 세션 뒤 origin/main 확인은 사후 감지라 이것이 실제 차단이다)
  local n="${GIT_CONFIG_COUNT:-0}"
  env "GIT_CONFIG_COUNT=$((n + 1))" \
    "GIT_CONFIG_KEY_$n=remote.origin.pushurl" \
    "GIT_CONFIG_VALUE_$n=autorun-push-disabled://gate-and-review-first" \
    claude -p "$prompt" \
    --permission-mode auto \
    --output-format json \
    --append-system-prompt-file "$PROMPT_FILE" \
    --disallowedTools AskUserQuestion "Bash(git push *)" \
    --name "autorun ADR-$ADR $label" \
    >"$out" 2>"$out.stderr" || true

  jq -e '.type == "result"' "$out" >/dev/null 2>&1 \
    || finish blocked "claude 출력 해석 실패 ($label) — $out.stderr"
  if [ "$(jq -r '.is_error' "$out")" = true ]; then
    local msg; msg=$(jq -r '.result // .subtype' "$out" | head -c 300)
    if printf '%s' "$msg" | grep -qiE 'limit|429|overloaded|quota'; then
      finish blocked "사용량 한도 · 과부하 ($label): $msg"
    fi
    finish blocked "claude 세션 오류 ($label): $msg"
  fi

  jq -e '.status | test("^(continue|done|blocked)$")' "$STATUS_FILE" >/dev/null 2>&1 \
    || finish blocked "status.json 없음 또는 형식 오류 ($label) — 세션 결과: $(jq -r '.result' "$out" | head -c 200)"
  cp "$STATUS_FILE" "$RUN_DIR/status-$label.json"
  STATUS=$(jq -r '.status' "$STATUS_FILE")
  STATUS_SUMMARY=$(jq -r '.summary // ""' "$STATUS_FILE")
  STATUS_REASON=$(jq -r '[.reason, .question] | map(select(. != null and . != "")) | join(" / ")' "$STATUS_FILE")
  log "claude 세션 끝: $label → $STATUS · $STATUS_SUMMARY"

  [ "$(git symbolic-ref --short HEAD 2>/dev/null)" = main ] || finish blocked "세션이 main 을 떠났다 ($label)"
  local dirty; dirty=$(git status --porcelain)
  [ -z "$dirty" ] || finish blocked "미커밋 변경이 남았다 ($label): $(printf '%s' "$dirty" | head -5 | tr '\n' ' ')"
  # gate · 판독 전에 main 에 올라간 커밋이 없어야 한다 (세션의 push 또는 다른 곳의 push)
  git fetch -q origin main || finish blocked "git fetch 실패 ($label)"
  [ "$(git rev-parse origin/main)" = "$PUSHED_HEAD" ] \
    || finish blocked "세션 중 origin/main 이 움직였다 ($label) — gate · 판독 전 push 여부 확인 필요"
}

# ---------- gate ----------
# gates <base> <label> — 실패면 GATE_FAIL 에 이름을 두고 1
gates() {
  local base="$1" glog="$RUN_DIR/gates-$2.log" flist="$RUN_DIR/files-$2.txt"
  # 목록은 파일로 둔다 — `printf | grep -q` 는 grep 이 먼저 끝나면 printf 가 SIGPIPE (141) 로 죽고
  # pipefail 이 그것을 「일치 없음」 으로 바꿔 큰 변경에서 gate 를 건너뛴다
  # 목록을 못 만들면 「바뀐 것 없음」 이 아니라 실패다 (gates 는 `||` 안에서 불려 errexit 가 꺼진다)
  git diff --name-only "$base"..HEAD >"$flist" || { GATE_FAIL="변경 목록 (git diff)"; return 1; }
  [ -s "$flist" ] || return 0
  GATE_FAIL=""

  log "gate: type-check"
  pnpm type-check >>"$glog" 2>&1 || { GATE_FAIL="type-check"; return 1; }

  local pkg extra
  for pkg in $UNIT_PACKAGES; do
    extra=""
    if [ "$pkg" = apps/builder ]; then
      extra="--project unit"
      # builder unit 은 shared · rendering · sample-data 소스를 import 한다
      grep -qE '^(apps/builder|packages/(shared|rendering|sample-data))/' "$flist" || continue
    else
      grep -q "^$pkg/" "$flist" || continue
    fi
    log "gate: vitest $pkg (--changed $base)"
    # shellcheck disable=SC2086
    pnpm -C "$pkg" exec vitest run $extra --changed "$base" --passWithNoTests >>"$glog" 2>&1 \
      || { GATE_FAIL="vitest $pkg"; return 1; }
  done

  if grep -qE "$RE_ENGINE" "$flist"; then
    log "gate: cargo test + wasm 빌드"
    (cd packages/engine && cargo test -q) >>"$glog" 2>&1 || { GATE_FAIL="cargo test"; return 1; }
    pnpm wasm:build:engine >>"$glog" 2>&1 || { GATE_FAIL="wasm:build:engine"; return 1; }
  fi

  if grep -qE "$RE_RENDER" "$flist"; then
    log "gate: G3 ratchet"
    pnpm gate:g3-ratchet >>"$glog" 2>&1 || { GATE_FAIL="g3-ratchet"; return 1; }
  fi
  return 0
}

# ---------- codex 판독 ----------
# codex_review <base> <label> [앞 판독 JSON] — 결과 JSON 경로를 REVIEW_OUT 에
codex_review() {
  local base="$1" label="$2" prev="${3:-}"
  REVIEW_OUT="$RUN_DIR/review-$label.json"
  local prompt
  prompt="ADR-$ADR 자동 실행 판독. 범위 = git diff $base..HEAD ($(git rev-list --count "$base"..HEAD) 커밋).
ADR 본문: $ADR_FILE${BREAKDOWN_FILE:+ · breakdown: $BREAKDOWN_FILE}.
이 범위가 ADR 의 해당 Phase 를 맞게 구현했는지, 회귀 · 계약 위반 (AGENTS.md · .claude/rules/) 이 있는지 본다.

merge 를 막을 문제만 나열한다. 각 문제에 파일·라인, 왜 틀렸는지, 실패를 보이는 방법 (입력·상태 → 잘못된 결과) 을 적는다. production 재현 시나리오가 없는 커버리지 지적은 LOW deferred 로 분류하고 라운드 재개 사유로 삼지 않는다. phase · 후속 항목의 닫힘 판정은 실행자가 한다.

severity: CRITICAL/HIGH = production 에서 깨지는 시나리오가 확인된 결함 · MEDIUM = 재현이 불확실한 결함 · LOW = 커버리지 · 문서. 문제가 없으면 findings 는 빈 배열."
  if [ -n "$prev" ]; then
    prompt="$prompt

수리 검증 판독이다. 앞 판독 지적 (아래 JSON) 이 고쳐졌는지 (또는 breakdown §기록 의 deferred · rejected 근거가 맞는지) 와 수리가 만든 새 결함만 본다.
$(cat "$prev")"
  fi
  log "codex 판독: $label"
  codex exec -s read-only --output-schema "$SCHEMA_FILE" -o "$REVIEW_OUT" "$prompt" \
    >"$RUN_DIR/review-$label.log" 2>&1 \
    || finish blocked "codex 판독 실패 ($label) — $RUN_DIR/review-$label.log"
  jq -e '.findings | type == "array"' "$REVIEW_OUT" >/dev/null 2>&1 \
    || finish blocked "codex 판독 결과 형식 오류 ($label) — $REVIEW_OUT"
}

count_findings() {  # $1 = JSON · $2 = severity 정규식
  jq --arg re "$2" '[.findings[] | select(.severity | test($re))] | length' "$1"
}

# ---------- 실행 ----------
preflight || exit 1

if [ "$DRY_RUN" = 1 ]; then
  echo "[autorun] 시작 조건 통과 — ADR: $ADR_FILE${BREAKDOWN_FILE:+ · breakdown: $BREAKDOWN_FILE}"
  echo "[autorun] codex 판독: $([ "$CODEX" = 1 ] && echo on || echo off) · max-phases: $MAX_PHASES · dev: $BUILDER_URL"
  echo "--- phase 프롬프트 ---"; phase_prompt; echo
  echo "--- 수리 프롬프트 (예) ---"; repair_prompt "$RUN_DIR/review-phase-1.json"
  exit 0
fi

mkdir -p "$RUN_DIR"
PUSHED_HEAD=$(git rev-parse origin/main)
trap 'finish blocked "중단됨 (signal)"' INT TERM

printf '# ADR-%s autorun %s\n\n- ADR: %s\n- 시작 커밋: %s\n' \
  "$ADR" "$(date '+%Y-%m-%d %H:%M')" "$ADR_FILE" "$(git rev-parse --short HEAD)" >"$SUMMARY"
log "시작 — ADR-$ADR · codex=$CODEX · max-phases=$MAX_PHASES"

i=1
while [ "$i" -le "$MAX_PHASES" ]; do
  BEFORE=$(git rev-parse HEAD)
  claude_session "phase-$i" "$(phase_prompt)"
  PHASE_STATUS="$STATUS"; PHASE_SUMMARY="$STATUS_SUMMARY"; PHASE_REASON="$STATUS_REASON"

  if [ "$(git rev-parse HEAD)" = "$BEFORE" ]; then
    case "$PHASE_STATUS" in
      done) finish done "ADR-$ADR 종결 (새 커밋 없음): $PHASE_SUMMARY" ;;
      blocked) finish blocked "$PHASE_REASON" ;;
      *) finish blocked "커밋 없이 continue — 진행 없음: $PHASE_SUMMARY" ;;
    esac
  fi

  gates "$BEFORE" "phase-$i" || finish blocked "gate 실패: $GATE_FAIL — $RUN_DIR/gates-phase-$i.log"

  REVIEW_NOTE="판독 생략"
  if [ "$CODEX" = 1 ]; then
    codex_review "$BEFORE" "phase-$i"
    FIRST_REVIEW="$REVIEW_OUT"
    HIGH=$(count_findings "$FIRST_REVIEW" '^(CRITICAL|HIGH)$')
    FIXABLE=$(count_findings "$FIRST_REVIEW" '^(CRITICAL|HIGH|MEDIUM)$')
    REVIEW_NOTE="판독: CRITICAL/HIGH $HIGH · MEDIUM $((FIXABLE - HIGH)) · LOW $(count_findings "$FIRST_REVIEW" '^LOW$')"
    log "$REVIEW_NOTE"

    if [ "$FIXABLE" -gt 0 ]; then
      REPAIR_BASE=$(git rev-parse HEAD)
      claude_session "repair-$i" "$(repair_prompt "$FIRST_REVIEW")"
      if [ "$STATUS" = blocked ]; then finish blocked "수리 세션 blocked: $STATUS_REASON"; fi
      # 수리 프롬프트는 지적마다 수리 · deferred · rejected 를 커밋으로 남기게 한다 — 커밋이 없으면 처리 근거가 없다
      if [ "$(git rev-parse HEAD)" = "$REPAIR_BASE" ]; then
        finish blocked "판독 지적 $FIXABLE 건에 수리 · 기록 커밋 없음 — $FIRST_REVIEW"
      else
        gates "$REPAIR_BASE" "repair-$i" || finish blocked "수리 뒤 gate 실패: $GATE_FAIL — $RUN_DIR/gates-repair-$i.log"
        codex_review "$BEFORE" "verify-$i" "$FIRST_REVIEW"
        HIGH_AFTER=$(count_findings "$REVIEW_OUT" '^(CRITICAL|HIGH)$')
        REVIEW_NOTE="$REVIEW_NOTE → 수리 검증 CRITICAL/HIGH $HIGH_AFTER"
        log "$REVIEW_NOTE"
        if [ "$HIGH_AFTER" -gt 0 ]; then finish blocked "수리 검증에서 CRITICAL/HIGH $HIGH_AFTER 건 남음 — $REVIEW_OUT (커밋은 push 하지 않았다)"; fi
      fi
    fi
  fi

  log "push origin main"
  git push origin main >>"$LOG" 2>&1 || finish blocked "push 실패 — $LOG"
  PUSHED_HEAD=$(git rev-parse HEAD)

  {
    printf '\n## 세션 %s — %s\n\n- %s\n- %s\n- 커밋:\n' "$i" "$PHASE_STATUS" "$PHASE_SUMMARY" "$REVIEW_NOTE"
    git log --format='  - %h %s' "$BEFORE"..HEAD
  } >>"$SUMMARY"

  case "$PHASE_STATUS" in
    done) finish done "ADR-$ADR 종결: $PHASE_SUMMARY" ;;
    blocked) finish blocked "$PHASE_REASON (그 전까지의 커밋은 gate · 판독 통과 후 push)" ;;
  esac
  i=$((i + 1))
done

finish stopped "max-phases $MAX_PHASES 도달 — 남은 Phase 는 다시 실행"
