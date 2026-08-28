#!/usr/bin/env bash
# work runner — `pnpm agent:work -- start|status|verify|resume|close`
#
# run ledger (scripts/agent/run-ledger.sh) 위의 얇은 실행 표면. 핵심은 `verify`:
# 변경 파일 scope 를 읽어 필요한 검증만 고르고, 결과를 terminal 이 아니라 evidence ledger 에
# 남긴다. 완료 보고 (`close`) 는 ledger 에서 생성되며 fail / 미해결 block 이 있으면 거부한다.
#
#   work start --understood-as "..." [run-ledger start 옵션]   run 시작 + scope 요약
#   work status                                                 run + scope + verify 계획
#   work verify [--dry-run] [--skip-exec] [--full] [--no-live] [--files a,b] [--base <ref>]
#   work resume <run-id>                                        current 를 지정 run 으로 (닫힌 run 재개 포함)
#   work close ["<result>"] [--force]                           readiness 검사 → report → close
#
# verify 선택 규칙 (Codex P2 — 2026-08-27 paperthin·polysona 분석 병합 순서, 보류 항목 착수 08-28):
#   1. guard            항상 (scripts/codex/protect-files.sh)
#   2. vitest (focused) 변경 package 의 `vitest related` + 변경된 test 파일 직접 실행
#   3. typecheck        변경 package 단위 (builder 는 baseline wrapper) — root turbo 전체 아님
#   4. registration     apps/builder TS 변경 시 ADR-139 contract (scripts/codex/registration-gate.sh)
#   5. cargo test       packages/composition-engine/src 변경 시
#   6. preflight        --full 일 때만 (root type-check 를 한 번 더 도는 비용)
#   7. cross-check      render 경로 변경 → ledger 에 `cross-check pass` 없으면 block (skill 은 CLI 로 못 돌린다)
#   8. live-exercise    사용자-가시 / wiring / schema 경로 변경 → `live-exercise pass` 없으면 block
#      (CLAUDE.md §완료 기준 — test/type-check PASS 단독 종결 금지. ADR-144: 34 commit revert)
#
# exit: 0 = 통과 · 1 = fail 있음 · 2 = 사용 오류 · 3 = 사람이 해야 할 block 남음 (cross-check / live)
# macOS bash 3.2 호환. `.agent/task-state.json` 의 goal/guard/stop 은 읽지도 바꾸지도 않는다.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LEDGER="$ROOT_DIR/scripts/agent/run-ledger.sh"
RUNS_DIR="${AGENT_RUNS_DIR:-$ROOT_DIR/.agent/runs}"
CURRENT_FILE="$RUNS_DIR/current"
cd "$ROOT_DIR"

if [ "${1:-}" = "--" ]; then shift; fi
CMD="${1:-help}"; [ "$#" -gt 0 ] && shift

# ---------- helpers ----------
need_jq() { command -v jq >/dev/null 2>&1 || { echo "[agent:work] jq 필요" >&2; exit 2; }; }
current_id() { [ -f "$CURRENT_FILE" ] && cat "$CURRENT_FILE" || true; }
run_dir() { local id; id=$(current_id); if [ -n "$id" ]; then printf '%s/%s' "$RUNS_DIR" "$id"; fi; return 0; }
require_run() {
  local d; d=$(run_dir)
  if [ -z "$d" ] || [ ! -f "$d/run.json" ]; then
    echo "[agent:work] 진행 중인 run 없음 — 먼저 'work start --understood-as \"...\"' (또는 'work resume <id>')" >&2; exit 2
  fi
  printf '%s' "$d"
}
ledger() { AGENT_RUNS_DIR="$RUNS_DIR" AGENT_EVIDENCE_SOURCE=work.sh bash "$LEDGER" "$@"; }
evidence() { ledger evidence "$@" >/dev/null 2>&1 || true; }
has_pass() {  # has_pass <kind> — 현재 run 에 kind=… status=pass 기록이 있는가
  local d; d=$(run_dir); [ -n "$d" ] && [ -s "$d/evidence.jsonl" ] && grep -q "\"kind\":\"$1\",\"status\":\"pass\"" "$d/evidence.jsonl"
}

# 변경 파일 = working tree (unstaged + staged + untracked) ∪ run 시작 이후 commit 된 파일
changed_files() {
  local base="${1:-}"
  {
    git diff --name-only --diff-filter=ACMR 2>/dev/null || true
    git diff --name-only --cached --diff-filter=ACMR 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
    if [ -n "$base" ] && git rev-parse -q --verify "$base" >/dev/null 2>&1; then
      git diff --name-only --diff-filter=ACMR "$base"..HEAD 2>/dev/null || true
    fi
  } | sed '/^$/d' | sort -u
}

# scope 분류 (ERE) — CLAUDE.md §완료 기준 (registration / resolved-tree wiring / schema / 렌더) 을 경로로 옮긴 것
RE_TS='\.(ts|tsx)$'
RE_TEST='\.(test|spec)\.(ts|tsx)$'
RE_RENDER='^(apps/builder/src/builder/workspace/canvas/|packages/specs/src/|packages/shared/src/catalog/|apps/builder/src/preview/|packages/composition-engine/src/)|\.css$'
RE_LIVE='^(apps/builder/src/builder/(factories|panels|components|stores|hooks)/|apps/builder/src/adapters/canonical/|packages/shared/src/schemas/)'
RE_ENGINE='^packages/composition-engine/src/'
RE_DOCS='^(docs/|\.claude/|\.agents/|\.agent/|scripts/|AGENTS\.md$|CLAUDE\.md$|README\.md$)|\.md$'

pkg_of() {  # pkg_of <path> → builder|publish|shared|specs|engine|other
  case "$1" in
    apps/builder/*) echo builder ;;
    apps/publish/*) echo publish ;;
    packages/shared/*) echo shared ;;
    packages/specs/*) echo specs ;;
    packages/composition-engine/*) echo engine ;;
    *) echo other ;;
  esac
}
pkg_filter() { case "$1" in builder) echo @composition/builder ;; publish) echo @composition/publish ;; shared) echo @composition/shared ;; specs) echo @composition/specs ;; esac; }
pkg_dir() { case "$1" in builder) echo apps/builder ;; publish) echo apps/publish ;; shared) echo packages/shared ;; specs) echo packages/specs ;; engine) echo packages/composition-engine ;; esac; }
pkg_has_vitest() { case "$1" in builder|shared|specs) return 0 ;; *) return 1 ;; esac; }
pkg_has_typecheck() { case "$1" in builder|publish|shared) return 0 ;; *) return 1 ;; esac; }

# ---------- scope 계산 → 전역 ----------
FILES=""; TS_FILES=""; RENDER_HIT=""; LIVE_HIT=""; ENGINE_HIT=""; PKGS=""; DOCS_ONLY=0
compute_scope() {  # compute_scope <files-newline-list>
  FILES="$1"
  TS_FILES=$(printf '%s\n' "$FILES" | grep -E "$RE_TS" || true)
  RENDER_HIT=$(printf '%s\n' "$FILES" | grep -E "$RE_RENDER" || true)
  LIVE_HIT=$(printf '%s\n' "$FILES" | grep -E "$RE_LIVE|$RE_RENDER" || true)
  ENGINE_HIT=$(printf '%s\n' "$FILES" | grep -E "$RE_ENGINE" || true)
  PKGS=$(printf '%s\n' "$TS_FILES" | sed '/^$/d' | while IFS= read -r f; do pkg_of "$f"; done | sort -u | grep -v '^other$' || true)
  DOCS_ONLY=1
  if [ -n "$FILES" ] && printf '%s\n' "$FILES" | grep -vE "$RE_DOCS" | grep -q .; then DOCS_ONLY=0; fi
  [ -z "$FILES" ] && DOCS_ONLY=0
  return 0
}
print_scope() {
  local n; n=$(printf '%s\n' "$FILES" | sed '/^$/d' | wc -l | tr -d ' ')
  echo "scope: 변경 파일 ${n}개 · TS $(printf '%s\n' "$TS_FILES" | sed '/^$/d' | wc -l | tr -d ' ') · package [$(printf '%s' "$PKGS" | tr '\n' ' ' | sed 's/ $//')]"
  [ "$DOCS_ONLY" = 1 ] && echo "       docs/scripts 만 변경 — 코드 검증 없음"
  [ -n "$RENDER_HIT" ] && echo "       render 경로 → cross-check 필요 ($(printf '%s\n' "$RENDER_HIT" | sed '/^$/d' | wc -l | tr -d ' ')개)"
  [ -n "$LIVE_HIT" ] && echo "       사용자-가시/wiring/schema 경로 → live exercise 필요 ($(printf '%s\n' "$LIVE_HIT" | sed '/^$/d' | wc -l | tr -d ' ')개)"
  return 0
}

# ---------- verify ----------
PASS_N=0; FAIL_N=0; SKIP_N=0; BLOCK_N=0
row() {  # row <step> <status> <detail>
  case "$2" in pass) PASS_N=$((PASS_N+1)) ;; fail) FAIL_N=$((FAIL_N+1)) ;; skip) SKIP_N=$((SKIP_N+1)) ;; block) BLOCK_N=$((BLOCK_N+1)) ;; esac
  printf '  %-14s %-6s %s\n' "$1" "$2" "$3"
}
# run_step <kind> <target> <cmd...> — 실행 + ledger 기록. DRY/SKIP_EXEC 존중.
run_step() {
  local kind="$1" target="$2"; shift 2
  if [ "$DRY" = 1 ]; then row "$kind" plan "$* ${target:+($target)}"; return 0; fi
  if [ "$SKIP_EXEC" = 1 ]; then evidence "$kind" skip --target "$target" --skip-reason "--skip-exec" --cmd "$*"; row "$kind" skip "--skip-exec ${target:+($target)}"; return 0; fi
  local rc=0
  echo "  → $* ${target:+($target)}"
  "$@" >"$STEP_LOG" 2>&1 || rc=$?
  if [ "$rc" -eq 0 ]; then
    evidence "$kind" pass --target "$target" --cmd "$*"
    row "$kind" pass "${target:-ok}"
  else
    evidence "$kind" fail --target "$target" --cmd "$*" --exit "$rc"
    row "$kind" fail "exit $rc ${target:+($target)} — 로그: $STEP_LOG"
    tail -30 "$STEP_LOG" | sed 's/^/      /'
    STEP_LOG=$(mktemp)
  fi
}
skip_step() { local kind="$1" reason="$2"; if [ "$DRY" = 1 ]; then row "$kind" skip "$reason"; else evidence "$kind" skip --skip-reason "$reason"; row "$kind" skip "$reason"; fi; }
# 사람 단계: ledger 에 pass 가 있으면 통과, 없으면 block 기록
human_step() {  # human_step <kind> <needed:0|1> <how>
  local kind="$1" needed="$2" how="$3"
  if [ "$needed" = 0 ]; then skip_step "$kind" "해당 경로 변경 없음"; return 0; fi
  if [ "$NO_LIVE" = 1 ]; then skip_step "$kind" "--no-live"; return 0; fi
  if [ "$DRY" = 1 ]; then row "$kind" plan "필요 — $how"; return 0; fi
  if has_pass "$kind"; then row "$kind" pass "ledger 에 pass 기록 있음"; return 0; fi
  evidence "$kind" block --detail "$how"
  row "$kind" block "$how"
}

do_verify() {
  DRY=0; SKIP_EXEC=0; FULL=0; NO_LIVE=0; OVERRIDE=""; BASE=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --dry-run) DRY=1; shift ;;
      --skip-exec) SKIP_EXEC=1; shift ;;
      --full) FULL=1; shift ;;
      --no-live) NO_LIVE=1; shift ;;
      --files) OVERRIDE="$2"; shift 2 ;;
      --base) BASE="$2"; shift 2 ;;
      *) echo "[agent:work] verify: 알 수 없는 옵션 $1" >&2; exit 2 ;;
    esac
  done
  local d=""
  if [ "$DRY" = 0 ]; then need_jq; d=$(require_run); fi
  if [ -z "$BASE" ] && [ -n "$d" ]; then BASE=$(jq -r '.headAtStart // ""' "$d/run.json" 2>/dev/null || true); [ "$BASE" = "unknown" ] && BASE=""; fi
  if [ -n "$OVERRIDE" ]; then compute_scope "$(printf '%s' "$OVERRIDE" | tr ',' '\n')"; else compute_scope "$(changed_files "$BASE")"; fi
  STEP_LOG=$(mktemp)

  echo "[agent:work] verify$( [ "$DRY" = 1 ] && printf ' (dry-run)' )$( [ "$SKIP_EXEC" = 1 ] && printf ' (skip-exec)' )"
  print_scope
  echo

  # 1. guard
  if [ -n "$OVERRIDE" ]; then skip_step guard "--files override (git scope 아님)"; else run_step guard "" bash scripts/codex/protect-files.sh; fi

  # 2. vitest focused / 3. typecheck per package
  if [ -z "$TS_FILES" ]; then
    skip_step vitest "TS 변경 없음"; skip_step typecheck "TS 변경 없음"
  else
    for p in $PKGS; do
      local dir rel tests
      dir=$(pkg_dir "$p")
      if pkg_has_vitest "$p"; then
        rel=$(printf '%s\n' "$TS_FILES" | grep "^$dir/" | sed "s|^$dir/||" | tr '\n' ' ' | sed 's/ $//' || true)
        tests=$(printf '%s\n' "$TS_FILES" | grep "^$dir/" | grep -E "$RE_TEST" | sed "s|^$dir/||" | tr '\n' ' ' | sed 's/ $//' || true)
        # shellcheck disable=SC2086
        run_step vitest "$p" pnpm -F "$(pkg_filter "$p")" exec vitest related --run --passWithNoTests $rel
        # shellcheck disable=SC2086
        [ -n "$tests" ] && run_step vitest "$p:test-files" pnpm -F "$(pkg_filter "$p")" exec vitest run $tests
      fi
      if pkg_has_typecheck "$p"; then
        run_step typecheck "$p" pnpm -F "$(pkg_filter "$p")" type-check
      else
        skip_step typecheck "$p: type-check 스크립트 없음"
      fi
    done
  fi

  # 4. registration (ADR-139) — builder TS 변경 시
  if printf '%s\n' "$PKGS" | grep -qx builder; then
    if [ -n "$OVERRIDE" ]; then run_step registration "ADR-139" pnpm run test:registration-contract   # gate 는 git scope 만 보므로 override 땐 contract 직접
    else run_step registration "ADR-139" bash scripts/codex/registration-gate.sh; fi
  else
    skip_step registration "builder TS 변경 없음"
  fi

  # 5. cargo test — engine src 변경 시
  if [ -n "$ENGINE_HIT" ]; then
    if command -v cargo >/dev/null 2>&1; then
      run_step cargo-test "composition-engine" cargo test --manifest-path packages/composition-engine/Cargo.toml --quiet
    else
      skip_step cargo-test "cargo 없음"
    fi
  else
    skip_step cargo-test "engine 변경 없음"
  fi

  # 6. preflight — --full
  if [ "$FULL" = 1 ]; then run_step preflight "" pnpm run codex:preflight; else skip_step preflight "--full 아님 (package 단위 typecheck 로 대체)"; fi

  # 7. cross-check / 8. live exercise — 사람 단계
  human_step cross-check "$( [ -n "$RENDER_HIT" ] && echo 1 || echo 0 )" "/cross-check 실행 후 'pnpm agent:run -- evidence cross-check pass --detail \"<컴포넌트·결과>\"'"
  human_step live-exercise "$( [ -n "$LIVE_HIT" ] && echo 1 || echo 0 )" "실제 builder 에서 exercise 후 'pnpm agent:run -- evidence live-exercise pass --detail \"<무엇을>\"' (CLAUDE.md §완료 기준)"

  echo
  echo "== verify == pass $PASS_N · fail $FAIL_N · skip $SKIP_N · block $BLOCK_N"
  if [ "$DRY" = 1 ]; then return 0; fi
  if [ "$FAIL_N" -gt 0 ]; then echo "[agent:work] fail — 수정 후 다시 verify"; return 1; fi
  if [ "$BLOCK_N" -gt 0 ]; then echo "[agent:work] 사람 단계 남음 (cross-check / live-exercise) — 기록 후 다시 verify 또는 close"; return 3; fi
  echo "[agent:work] 통과"
  return 0
}

# ---------- readiness (close 용) ----------
readiness() {  # exit 0 = 닫아도 됨. stdout 에 사유 나열
  local d="$1" bad=0 kinds k last
  [ -s "$d/evidence.jsonl" ] || { echo "  - evidence 0건 — verify 를 한 번도 안 돌렸다"; return 1; }
  kinds=$(jq -r '.kind' "$d/evidence.jsonl" | sort -u)
  for k in $kinds; do
    last=$(jq -r "select(.kind == \"$k\") | .status" "$d/evidence.jsonl" | tail -1)
    case "$last" in
      fail) echo "  - $k: 마지막 기록이 fail"; bad=1 ;;
      block) echo "  - $k: block 미해결 (pass 기록 필요)"; bad=1 ;;
    esac
  done
  return $bad
}

case "$CMD" in
  start)
    need_jq
    ledger start "$@"
    compute_scope "$(changed_files)"; print_scope
    ;;

  status)
    need_jq
    ledger status
    D=$(run_dir); BASE=""
    [ -n "$D" ] && [ -f "$D/run.json" ] && BASE=$(jq -r '.headAtStart // ""' "$D/run.json"); [ "$BASE" = "unknown" ] && BASE=""
    compute_scope "$(changed_files "$BASE")"; print_scope
    echo "verify 계획:"; DRY=1 SKIP_EXEC=0 FULL=0 NO_LIVE=0 OVERRIDE="" ; do_verify --dry-run ${BASE:+--base "$BASE"} | sed -n '/^  /p'
    ;;

  verify)
    do_verify "$@"
    ;;

  resume)
    need_jq
    ID="${1:-}"; [ -z "$ID" ] && { echo "[agent:work] resume <run-id>  (목록: pnpm agent:run -- list)" >&2; exit 2; }
    [ -f "$RUNS_DIR/$ID/run.json" ] || { echo "[agent:work] run 없음: $ID" >&2; exit 2; }
    tmp=$(mktemp); jq '.endedAt = null | .phase.status = "resumed"' "$RUNS_DIR/$ID/run.json" > "$tmp" && mv "$tmp" "$RUNS_DIR/$ID/run.json"
    printf '%s' "$ID" > "$CURRENT_FILE"
    evidence resume info --detail "work resume"
    echo "[agent:work] resumed $ID"
    ledger status
    ;;

  close)
    need_jq; D=$(require_run)
    RESULT=""; FORCE=0
    while [ "$#" -gt 0 ]; do case "$1" in --force) FORCE=1; shift ;; *) RESULT="$1"; shift ;; esac; done
    REASONS=$(readiness "$D" || true)
    if [ -n "$REASONS" ]; then
      echo "[agent:work] close 거부 — 종결 근거 부족:"; echo "$REASONS"
      if [ "$FORCE" = 1 ]; then
        evidence close-override info --detail "--force: $(printf '%s' "$REASONS" | tr '\n' ';')"
        echo "[agent:work] --force 로 진행 (ledger 에 close-override 기록)"
      else
        echo "  → 해결 후 다시 close, 또는 --force (ledger 에 남는다)"; exit 3
      fi
    fi
    ledger report
    echo
    ledger close "$RESULT"
    ;;

  help|-h|--help)
    cat <<'EOF'
agent work runner (run ledger 위의 실행 표면):

  pnpm agent:work -- start --understood-as "<요청 1줄 재진술>" [--adr NNN] [--live "<시나리오>"] ...
  pnpm agent:work -- status                      run + 변경 scope + verify 계획
  pnpm agent:work -- verify [--dry-run] [--full] [--no-live] [--files a,b] [--base <ref>]
        scope 로 고른 검증만 실행: guard · vitest(related) · package typecheck · registration · cargo · [preflight]
        render 경로 → cross-check, 사용자-가시/wiring/schema 경로 → live-exercise 는 ledger pass 없으면 block
  pnpm agent:work -- resume <run-id>             닫힌/다른 run 을 current 로
  pnpm agent:work -- close ["<result>"] [--force] fail·block 남으면 거부 (exit 3) → report → close

exit 0 통과 · 1 fail · 2 사용 오류 · 3 사람 단계 남음
EOF
    ;;
  *)
    echo "[agent:work] 알 수 없는 명령: $CMD (help 참조)" >&2; exit 2 ;;
esac
