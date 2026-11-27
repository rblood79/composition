#!/usr/bin/env bash
# ADR 자동 실행 — `pnpm agent:autorun -- <NNN> [--worktree --port N] [--max-phases N] [--no-codex] [--dry-run]`
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
#   4. origin/main 이 앞서 있으면 rebase → gate 다시 → git push origin HEAD:main (통과한 커밋만)
#   5. 세션이 쓴 .agent/autorun/status.json 이 continue 면 다음 Phase, done · blocked 면 끝
#
# 두 방식:
#   기본        이 checkout 의 main 에서 실행. 시작 조건: main · working tree clean · origin/main 과 같은
#               커밋 · dev 서버 ($BUILDER_URL, 기본 5173) 응답. 이 checkout 을 혼자 쓴다고 가정한다.
#   --worktree  .claude/worktrees/autorun-adrNNN (로컬 브랜치 autorun/adr-NNN — 원격에 올리지 않는다) 에서
#               실행. .worktreeinclude 파일 복사 · task-state (goal = 이 ADR) · pnpm install 뒤 그 worktree 의
#               dev 서버를 --port 로 직접 띄운다. ADR 마다 포트를 달리 주면 병렬로 돌릴 수 있다 — 통합은
#               git-workflow.md §3 그대로 main 직접 (rebase 뒤 HEAD:main push, PR · 원격 브랜치 없음).
# live exercise 는 세션마다 따로 띄우는 headless · 격리 프로필 chrome-devtools MCP (chrome-autorun) 로 한다 —
# 플러그인 기본 서버는 프로필을 같이 써서 병렬 세션이 부딪친다.
# 기록: <checkout>/.agent/autorun/<시각>-adrNNN/ (세션 JSON · gate 로그 · 판독 JSON · summary.md, gitignore)
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
  echo "  --worktree  ADR 전용 worktree 에서 실행 (병렬용) · --port N  dev 서버 포트 (worktree 는 필수, 스크립트가 띄운다)"
  echo "  --max-phases N  세션 수 상한 (기본 20) · --no-codex  판독 생략 · --dry-run  조건 확인 + 프롬프트 출력만"
}

if [ "${1:-}" = "--" ]; then shift; fi
ADR=""; MAX_PHASES=20; CODEX=1; DRY_RUN=0; WORKTREE=0; PORT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --max-phases) MAX_PHASES="${2:?--max-phases 값 필요}"; shift 2 ;;
    --no-codex) CODEX=0; shift ;;
    --worktree) WORKTREE=1; shift ;;
    --port) PORT="${2:?--port 값 필요}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    [0-9]*) ADR="$1"; shift ;;
    *) echo "[autorun] 알 수 없는 인자: $1" >&2; usage >&2; exit 1 ;;
  esac
done
[ -n "$ADR" ] || { usage >&2; exit 1; }
if [ "$WORKTREE" = 1 ] && [ -z "$PORT" ]; then echo "[autorun] --worktree 는 --port 가 필요하다 (ADR 마다 다른 포트)" >&2; exit 1; fi
[ -z "$PORT" ] || BUILDER_URL="http://localhost:$PORT"
export BUILDER_URL   # 세션 · gate 하니스 (apps/builder/scripts) 가 같은 서버를 본다

WORK_BRANCH=main
WT_PATH="$ROOT_DIR/.claude/worktrees/autorun-adr$ADR"
if [ "$WORKTREE" = 1 ]; then WORK_BRANCH="autorun/adr-$ADR"; fi
DEV_PID=""; DEV_LISTENERS=""; HELD_LOCKS=""

die() { echo "[autorun] $*" >&2; exit 1; }

# 병렬 worktree 실행은 같은 .git 의 refs/remotes/origin/main 을 갱신한다 — 동시에 부딪치면 잠금 실패가 난다
git_fetch() {
  local t
  for t in 1 2 3 4 5; do
    git fetch -q origin main 2>/dev/null && return 0
    sleep "$t"
  done
  git fetch -q origin main
}

resolve_adr_files() {  # 현재 checkout 기준
  ADR_FILE=$(ls docs/adr/"$ADR"-*.md 2>/dev/null | head -1 || true)
  BREAKDOWN_FILE=$(ls docs/adr/design/"$ADR"-*breakdown*.md 2>/dev/null | head -1 || true)
}
resolve_adr_files

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
  echo "[autorun] 기록: $(pwd)/$RUN_DIR"
  if [ "$WORKTREE" = 1 ] && [ "$1" = done ]; then
    # 안내 명령은 그대로 붙여 넣어도 안전하게 경로를 shell 인용한다 (공백 · 특수문자)
    echo "[autorun] worktree 정리 (확인 뒤): git worktree remove -- $(printf '%q' "$WT_PATH") && git branch -d -- $(printf '%q' "$WORK_BRANCH")"
  fi
  exit "$code"
}

# ---------- 시작 조건 ----------
preflight() {
  local miss=""
  for c in claude jq git pnpm curl; do command -v "$c" >/dev/null 2>&1 || miss="$miss $c"; done
  [ "$CODEX" = 1 ] && { command -v codex >/dev/null 2>&1 || miss="$miss codex"; }
  [ -z "$miss" ] || { echo "[autorun] 명령 없음:$miss" >&2; return 1; }
  # 세션의 push 차단은 pushurl 하나를 더하는 방식이다 — pushurl 은 여러 값이라 기존 값이 있으면 그쪽으로도 push 된다
  # 내용이 아니라 항목 존재로 본다 — 빈 값 (`pushurl =`) 도 목록을 바꿔 push 대상이 origin url 로 돌아간다
  ! git config --get-all remote.origin.pushurl >/dev/null 2>&1 \
    || { echo "[autorun] remote.origin.pushurl 이 설정돼 있다 — 세션의 push 를 막을 수 없어 시작하지 않는다 (git config --unset-all remote.origin.pushurl)" >&2; return 1; }
  git_fetch || { echo "[autorun] git fetch 실패 — 원격 상태를 모르면 시작하지 않는다" >&2; return 1; }
  if [ "$WORKTREE" = 1 ]; then
    # worktree 는 origin/main 에서 만든다 — main checkout 의 상태와 무관
    git ls-tree --name-only origin/main docs/adr/ | grep -q "^docs/adr/$ADR-" \
      || { echo "[autorun] origin/main 에 열린 ADR 없음: docs/adr/$ADR-*.md" >&2; return 1; }
    ! curl -s -o /dev/null --max-time 3 "$BUILDER_URL" \
      || { echo "[autorun] 포트 $PORT 가 이미 쓰이고 있다 — worktree 의 dev 서버는 스크립트가 띄운다" >&2; return 1; }
    return 0
  fi
  [ -n "$ADR_FILE" ] || { echo "[autorun] 열린 ADR 없음: docs/adr/$ADR-*.md (completed 는 대상 아님)" >&2; return 1; }
  [ "$(git symbolic-ref --short HEAD 2>/dev/null)" = main ] || { echo "[autorun] main 이 아니다" >&2; return 1; }
  [ -z "$(git status --porcelain)" ] || { echo "[autorun] working tree 가 깨끗하지 않다 — 커밋하거나 치운 뒤 실행" >&2; git status --short >&2; return 1; }
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "[autorun] HEAD ≠ origin/main — pull 또는 push 먼저" >&2; return 1; }
  curl -sf -o /dev/null --max-time 5 "$BUILDER_URL" || { echo "[autorun] dev 서버 응답 없음: $BUILDER_URL — pnpm dev 먼저" >&2; return 1; }
}

# ---------- worktree ----------
setup_worktree() {
  local ahead e guard stop
  if [ -d "$WT_PATH" ]; then
    echo "[autorun] worktree 재사용: $WT_PATH"
    [ "$(git -C "$WT_PATH" symbolic-ref --short HEAD 2>/dev/null)" = "$WORK_BRANCH" ] || die "worktree 가 $WORK_BRANCH 에 있지 않다: $WT_PATH"
    [ -z "$(git -C "$WT_PATH" status --porcelain)" ] || die "worktree 에 미커밋 변경이 있다 — 확인 뒤 실행: $WT_PATH"
  else
    if git show-ref --verify -q "refs/heads/$WORK_BRANCH"; then
      git worktree add -q "$WT_PATH" "$WORK_BRANCH" || die "worktree 생성 실패"
    else
      git worktree add -q --no-track -b "$WORK_BRANCH" "$WT_PATH" origin/main || die "worktree 생성 실패"
    fi
    echo "[autorun] worktree 생성: $WT_PATH ($WORK_BRANCH)"
  fi
  # 지난 실행이 남긴 push 안 된 커밋은 gate · 판독을 다 통과했는지 모른다 — 사람이 본다
  ahead=$(git -C "$WT_PATH" rev-list --count origin/main..HEAD)
  [ "$ahead" = 0 ] || die "$WORK_BRANCH 에 push 안 된 커밋 $ahead 개 — 지난 실행이 멈춘 자리다. 확인 뒤 push 하거나 정리하고 다시 실행"
  git -C "$WT_PATH" merge -q --ff-only origin/main || die "worktree 를 origin/main 으로 올리지 못했다"

  # .worktreeinclude 의 gitignore 파일 (env · 라이선스 · 개인 지시 · 엔진 wasm)
  while IFS= read -r e; do
    case "$e" in ''|'#'*|/*|*..*) continue ;; esac
    e="${e%/}"
    [ -e "$ROOT_DIR/$e" ] || continue
    mkdir -p "$WT_PATH/$(dirname "$e")"
    rm -rf "${WT_PATH:?}/$e"
    cp -R "$ROOT_DIR/$e" "$WT_PATH/$e"
  done < <(cat "$ROOT_DIR/.worktreeinclude" 2>/dev/null || true)

  # task-state — goal = 이 ADR (사용자가 `--worktree NNN` 으로 지정). 있으면 (재실행) 그대로 둔다
  if [ ! -f "$WT_PATH/.agent/task-state.json" ]; then
    guard=$(jq -r '.guard // ""' "$ROOT_DIR/.agent/task-state.json" 2>/dev/null || true)
    stop=$(jq -r '.stop // ""' "$ROOT_DIR/.agent/task-state.json" 2>/dev/null || true)
    mkdir -p "$WT_PATH/.agent"
    jq -n --arg goal "ADR-$ADR 자동 실행 (adr-autorun --worktree, 사용자 실행 $(date +%F))" \
      --arg guard "${guard:-자기 파일만 커밋 (pathspec) · live 확인 전 완료 보고 금지 · 마이그레이션 코드 0}" \
      --arg stop "${stop:-type-check 실패 커밋 금지 · 원본 파일 삭제 · scope 변경은 사용자 확인}" \
      '{goal: $goal, phase: "시작 전", next: [], guard: $guard, stop: $stop, updatedAt: (now | todate)}' \
      >"$WT_PATH/.agent/task-state.json"
  fi

  echo "[autorun] pnpm install (worktree)"
  mkdir -p "$WT_PATH/.agent/autorun"
  (cd "$WT_PATH" && pnpm install --frozen-lockfile) >"$WT_PATH/.agent/autorun/install.log" 2>&1 \
    || die "pnpm install 실패 — $WT_PATH/.agent/autorun/install.log"
  cd "$WT_PATH"
}

is_descendant() {  # $1 pid 가 $2 pid 이거나 그 자손인가
  local p="$1"
  while [ -n "$p" ] && [ "$p" -gt 1 ]; do
    [ "$p" = "$2" ] && return 0
    p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
  done
  return 1
}

# 준비 판정 = 포트의 listener 가 전부 이 실행이 띄운 프로세스의 자손이고 응답한다.
# HTTP 응답만 보면 그새 다른 서버가 포트를 잡았을 때 그 서버를 검증 대상으로 삼는다
start_dev_server() {
  log "dev 서버 시작 (worktree): $BUILDER_URL"
  pnpm -F @composition/builder exec vite --port "$PORT" --strictPort >"$RUN_DIR/dev-server.log" 2>&1 &
  DEV_PID=$!
  local t=0 l listeners
  while :; do
    kill -0 "$DEV_PID" 2>/dev/null || { DEV_PID=""; finish blocked "dev 서버가 시작하지 못했다 — $RUN_DIR/dev-server.log"; }
    listeners=$(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | sort -u || true)
    if [ -n "$listeners" ]; then
      for l in $listeners; do
        is_descendant "$l" "$DEV_PID" || finish blocked "포트 $PORT 를 이 실행이 띄우지 않은 프로세스 (pid $l) 가 잡았다"
      done
      if curl -sf -o /dev/null --max-time 2 "$BUILDER_URL"; then
        DEV_LISTENERS="$listeners"
        return 0
      fi
    fi
    t=$((t + 2))
    [ "$t" -lt 180 ] || finish blocked "dev 서버가 180초 안에 응답하지 않았다 — $RUN_DIR/dev-server.log"
    sleep 2
  done
}

# ---------- 실행 잠금 ----------
# 같은 ADR 을 두 번 돌리면 두 실행이 한 브랜치를 나눠 써서, 한쪽이 gate 를 통과시킨 뒤 다른 쪽 커밋까지 push 한다.
# 잠금 = 공용 .git 안 디렉터리 (mkdir 은 원자적) + 주인 pid. 남은 잠금을 자동으로 넘겨받지 않는다 —
# 두 실행이 동시에 「주인 없음」 을 보면 둘 다 지우고 다시 만들어 둘 다 쥔다. 정상 종료 · Ctrl-C 는 EXIT trap 이
# 풀므로, 남는 것은 kill -9 · 크래시뿐이다 — 그때는 사람이 지운다
acquire_lock() {  # $1 = 이름
  local dir other
  dir="$(git rev-parse --path-format=absolute --git-common-dir)/autorun-$1.lock"
  if ! mkdir "$dir" 2>/dev/null; then
    sleep 1   # 막 만든 쪽이 pid 를 쓰는 중일 수 있다
    other=$(cat "$dir/pid" 2>/dev/null || true)
    if [ -z "$other" ] || kill -0 "$other" 2>/dev/null; then
      die "$1 실행이 이미 돌고 있다 (pid ${other:-?}) — 잠금 $dir"
    fi
    die "$1 잠금이 남아 있다 (주인 pid $other 는 끝났다) — 다른 실행이 없는지 확인한 뒤 지우고 다시: rm -rf -- $(printf '%q' "$dir")"
  fi
  echo $$ >"$dir/pid"
  HELD_LOCKS="$HELD_LOCKS $dir"
}

cleanup() {  # 이 실행이 띄운 dev 서버와 잡은 잠금만 정리한다
  local l d
  if [ -n "$DEV_PID" ]; then
    for l in $DEV_LISTENERS; do is_descendant "$l" "$DEV_PID" && kill "$l" 2>/dev/null; done
    kill "$DEV_PID" 2>/dev/null || true
  fi
  for d in $HELD_LOCKS; do
    [ "$(cat "$d/pid" 2>/dev/null)" = "$$" ] && rm -rf "$d"
  done
  return 0
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
    --mcp-config "$MCP_CONFIG" \
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

  [ "$(git symbolic-ref --short HEAD 2>/dev/null)" = "$WORK_BRANCH" ] || finish blocked "세션이 $WORK_BRANCH 를 떠났다 ($label)"
  local dirty; dirty=$(git status --porcelain)
  [ -z "$dirty" ] || finish blocked "미커밋 변경이 남았다 ($label): $(printf '%s' "$dirty" | head -5 | tr '\n' ' ')"
  # gate · 판독 전에 이번 실행의 새 커밋이 origin/main 에 올라가 있으면 안 된다 (세션의 push).
  # origin/main 이 다른 실행의 push 로 움직이는 것은 정상이다 (병렬 worktree) — push 단계에서 rebase 한다
  git_fetch || finish blocked "git fetch 실패 ($label)"
  [ "$(git rev-list --count origin/main..HEAD)" = "$(git rev-list --count "$PUSHED_HEAD"..HEAD)" ] \
    || finish blocked "이번 실행의 커밋이 gate · 판독 전에 origin/main 에 올라갔다 ($label)"
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

# publish <i> — origin/main 이 앞서 있으면 rebase 하고 합친 결과로 gate 를 다시 돈 뒤 push.
# fetch 와 push 사이에 다른 실행이 먼저 push 하면 (병렬 worktree) 거절된다 — 그때는 fetch 부터 다시 (3회)
publish() {
  local try=1
  while :; do
    git_fetch || finish blocked "push 전 git fetch 실패"
    if ! git merge-base --is-ancestor origin/main HEAD; then
      log "origin/main 이 앞서 있다 — rebase ($try)"
      if ! git rebase -q origin/main >>"$LOG" 2>&1; then
        git rebase --abort >>"$LOG" 2>&1 || true
        finish blocked "origin/main 과 rebase 충돌 — 커밋은 $WORK_BRANCH 에 남아 있다 (push 안 함)"
      fi
      gates "$(git rev-parse origin/main)" "rebase-$1-$try" \
        || finish blocked "rebase 뒤 gate 실패: $GATE_FAIL — $RUN_DIR/gates-rebase-$1-$try.log (push 안 함)"
    fi
    log "push origin HEAD:main ($try)"
    if git push origin HEAD:main >>"$LOG" 2>&1; then
      PUSHED_HEAD=$(git rev-parse HEAD)
      return 0
    fi
    # 다시 하는 것은 「origin 이 그새 앞섰다」 일 때만 — 권한 · 네트워크 실패는 멈춘다
    git_fetch || finish blocked "push 실패 뒤 git fetch 실패 — $LOG"
    # push 는 원격에 들어갔고 로컬 추적 ref 갱신만 잠금에 졌으면 성공이다
    if [ "$(git rev-parse origin/main)" = "$(git rev-parse HEAD)" ]; then
      PUSHED_HEAD=$(git rev-parse HEAD)
      return 0
    fi
    if git merge-base --is-ancestor origin/main HEAD || [ "$try" -ge 3 ]; then
      finish blocked "push 실패 — $LOG"
    fi
    try=$((try + 1))
  done
}

count_findings() {  # $1 = JSON · $2 = severity 정규식
  jq --arg re "$2" '[.findings[] | select(.severity | test($re))] | length' "$1"
}

# ---------- 실행 ----------
preflight || exit 1

if [ "$DRY_RUN" = 1 ]; then
  if [ "$WORKTREE" = 1 ]; then
    echo "[autorun] 시작 조건 통과 — worktree: $WT_PATH ($WORK_BRANCH, $([ -d "$WT_PATH" ] && echo 재사용 || echo 새로 만듦)) · dev 서버를 $BUILDER_URL 로 띄운다"
  else
    echo "[autorun] 시작 조건 통과 — ADR: $ADR_FILE${BREAKDOWN_FILE:+ · breakdown: $BREAKDOWN_FILE}"
  fi
  echo "[autorun] codex 판독: $([ "$CODEX" = 1 ] && echo on || echo off) · max-phases: $MAX_PHASES · dev: $BUILDER_URL"
  echo "--- phase 프롬프트 ---"; phase_prompt; echo
  echo "--- 수리 프롬프트 (예) ---"; repair_prompt "$RUN_DIR/review-phase-1.json"
  exit 0
fi

# 잠금은 worktree 준비 전에 잡고 끝날 때까지 쥔다 (EXIT trap 이 푼다)
trap cleanup EXIT
acquire_lock "adr$ADR"
if [ "$WORKTREE" = 0 ]; then acquire_lock "main-checkout"; fi

if [ "$WORKTREE" = 1 ]; then
  setup_worktree
  resolve_adr_files
  [ -n "$ADR_FILE" ] || die "worktree 에 열린 ADR 없음: docs/adr/$ADR-*.md"
fi

mkdir -p "$RUN_DIR"
PUSHED_HEAD=$(git rev-parse origin/main)
trap 'finish blocked "중단됨 (signal)"' INT TERM

# 세션마다 따로 띄우는 chrome-devtools MCP — headless · 격리 프로필 (병렬 실행이 프로필을 같이 쓰지 않게)
MCP_CONFIG="$RUN_DIR/mcp.json"
printf '%s\n' '{"mcpServers":{"chrome-autorun":{"command":"npx","args":["-y","chrome-devtools-mcp@1.11.0","--headless","--isolated"]}}}' >"$MCP_CONFIG"

if [ "$WORKTREE" = 1 ]; then start_dev_server; fi

printf '# ADR-%s autorun %s\n\n- ADR: %s\n- checkout: %s (%s) · dev: %s\n- 시작 커밋: %s\n' \
  "$ADR" "$(date '+%Y-%m-%d %H:%M')" "$ADR_FILE" "$(pwd)" "$WORK_BRANCH" "$BUILDER_URL" "$(git rev-parse --short HEAD)" >"$SUMMARY"
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

  publish "$i"

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
