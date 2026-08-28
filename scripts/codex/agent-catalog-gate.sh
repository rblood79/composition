#!/usr/bin/env bash
# Agent catalog drift gate — `pnpm run codex:agent-catalog`
#
# 정본(.claude/) ↔ Codex 미러(.agents/) ↔ 등록 표면(INDEX×2 / CLAUDE.md 라우팅표 /
# SessionStart roster×3 / prompt router×2 / Claude settings + Codex hooks.json /
# package.json codex:*)
# 의 집합 일치를 검사한다. Claude Code 와 Codex 양쪽에서 같은 명령으로 실행.
#
# Why (2026-08-27 paperthin·polysona 분석 병합 순서 ①):
#   composition 은 hook 집행력은 앞서지만 자기 카탈로그 무결성 검증이 0 이었다 —
#   `.agents/skills` 11 vs INDEX 8, 승인 삭제된 orphan 스킬이 sweep 커밋으로 재유입
#   (7dcbce1d6 → b9f75b40a), roster 에 제거된 플러그인 이름 잔존, README 가 없는
#   command 파일 참조. 물리적 단일화가 불가능한 사본은 "복제하되 게이트가 drift 를
#   차단" 으로 명문화한다 (paperthin check-catalog-sync 의 재구현, 복사 아님).
#
# 판정: ✗ FAIL (exit 1) / ⚠ WARN (exit 0, 정책 위반이지만 다음 단계에서 FAIL 승격 예정)
#       / · INFO. codex:preflight 마지막 단계로 포함 (2026-08-28 — ①~⑤ 동안 실행 6회+ FAIL 0 으로 안정화 확인).
#
# macOS bash 3.2 호환 — declare -A / mapfile 사용 금지.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FAIL=0
WARN=0
SELF="scripts/codex/agent-catalog-gate.sh"

section() { printf '\n== %s ==\n' "$*"; }
ok()      { printf '  ✓ %s\n' "$*"; }
info()    { printf '  · %s\n' "$*"; }
warn()    { printf '  ⚠ %s\n' "$*"; WARN=$((WARN + 1)); }
fail()    { printf '  ✗ %s\n' "$*"; FAIL=$((FAIL + 1)); }

# ---------- helpers ----------

# 줄 목록 정렬·중복 제거 (빈 줄 제거)
norm() { printf '%s\n' "$1" | sed '/^[[:space:]]*$/d' | sort -u; }
# A - B
set_minus() { comm -23 <(norm "$1") <(norm "$2"); }
# 집합 A == B 인지 보고. $1 라벨, $2 A 이름, $3 A, $4 B 이름, $5 B
report_set_eq() {
  local label="$1" a_name="$2" a="$3" b_name="$4" b="$5"
  local only_a only_b
  only_a=$(set_minus "$a" "$b")
  only_b=$(set_minus "$b" "$a")
  if [ -z "$only_a" ] && [ -z "$only_b" ]; then
    ok "$label — 집합 일치 ($(norm "$a" | wc -l | tr -d ' '))"
    return 0
  fi
  [ -n "$only_a" ] && fail "$label — $a_name 에만 있음: $(printf '%s' "$only_a" | tr '\n' ' ')"
  [ -n "$only_b" ] && fail "$label — $b_name 에만 있음: $(printf '%s' "$only_b" | tr '\n' ' ')"
  return 0
}

# frontmatter 본문 (--- 사이). 없으면 빈 출력
fm() { awk 'NR==1{ if ($0 != "---") exit; next } /^---[[:space:]]*$/{ exit } { print }' "$1"; }
# frontmatter 스칼라 값
fm_value() {
  fm "$1" | awk -v k="$2" '
    index($0, k ":") == 1 { v = substr($0, length(k) + 2); sub(/^[[:space:]]+/, "", v); gsub(/^"|"$/, "", v); print v; exit }'
}
# frontmatter 리스트 값 (key:\n  - a\n  - b)
fm_list() {
  fm "$1" | awk -v k="$2" '
    index($0, k ":") == 1 { p = 1; next }
    p && /^[[:space:]]+-[[:space:]]/ { sub(/^[[:space:]]+-[[:space:]]*/, ""); gsub(/"/, ""); print; next }
    p && /^[^[:space:]]/ { p = 0 }'
}

# 실경로 (symlink 해석). macOS 는 /bin/realpath 존재하나 cd -P 로 통일
real_dir() { realpath "$1" 2>/dev/null; }
real_file() { realpath "$1" 2>/dev/null; }

# glob → ERE (rules `paths:` 검사용). `**/` → (.*/)? , `**` → .* , `*` → [^/]*
glob_to_regex() {
  printf '%s' "$1" | sed \
    -e 's/[.]/\\./g' \
    -e 's#\*\*/#__DSS__#g' \
    -e 's/\*\*/__DS__/g' \
    -e 's#\*#[^/]*#g' \
    -e 's#__DSS__#(.*/)?#g' \
    -e 's/__DS__/.*/g'
}

# markdown 섹션 본문 ("## <title>" 부터 다음 "## " 직전까지)
md_section() { awk -v t="$2" 'index($0, "## " t) == 1 { p = 1; next } /^## / { p = 0 } p' "$1"; }
# heredoc 안 roster 블록도 같은 규칙 (session-start.sh)
sh_section() { md_section "$1" "$2"; }

# 표 행의 n번째 열 (구분선·헤더 제외)
table_col() { awk -F'|' -v c="$2" 'index($0, "|") == 1 && $0 !~ /^\|[[:space:]]*-/ && NR > 0 { v = $(c + 1); gsub(/^[[:space:]]+|[[:space:]]+$/, "", v); print v }' <<<"$1" | tail -n +2; }

kebab_tokens() { grep -oE '[a-z][a-z0-9]*(-[a-z0-9]+)+' <<<"$1" || true; }

# ---------- 정본 집합 ----------

SKILLS=$(find .claude/skills -mindepth 1 -maxdepth 1 \( -type d -o -type l \) -exec basename {} \; | sort)
AGENT_SKILLS=$(find .agents/skills -mindepth 1 -maxdepth 1 \( -type d -o -type l \) -exec basename {} \; | sort)
AGENTS=$(find .claude/agents -maxdepth 1 -name '*.md' -exec basename {} .md \; | sort)
COMMANDS=$(find .claude/commands -maxdepth 1 -name '*.md' -exec basename {} .md \; | sort)
RULES=$(find .claude/rules -maxdepth 1 -name '*.md' -exec basename {} \; | sort)
AGENT_RULES=$(find .agents/rules -maxdepth 1 -name '*.md' -exec basename {} \; | sort)
BUILTIN_AGENTS=$'Explore\ngeneral-purpose\nPlan\nclaude-code-guide'
PKG_SCRIPTS=$(node -e 'const p=require("./package.json");console.log(Object.keys(p.scripts||{}).join("\n"))')
TRACKED=$(git ls-files)

printf 'agent-catalog-gate — root %s\n' "$ROOT_DIR"
info "skills $(norm "$SKILLS" | wc -l | tr -d ' ') / agents $(norm "$AGENTS" | wc -l | tr -d ' ') / commands $(norm "$COMMANDS" | wc -l | tr -d ' ') / rules $(norm "$RULES" | wc -l | tr -d ' ')"

# ---------- 1. skill frontmatter ----------
section "1. skill frontmatter (.claude/skills/*/SKILL.md)"
while IFS= read -r s; do
  [ -z "$s" ] && continue
  f=".claude/skills/$s/SKILL.md"
  if [ ! -f "$f" ]; then fail "$s — SKILL.md 없음"; continue; fi
  name=$(fm_value "$f" name)
  desc=$(fm_value "$f" description)
  if [ -z "$name" ]; then fail "$s — frontmatter name 없음"
  elif [ "$name" != "$s" ]; then fail "$s — name '$name' ≠ 디렉터리명"
  elif [ -z "$desc" ]; then fail "$s — description 비어 있음"
  else ok "$s"; fi
done <<<"$SKILLS"

# ---------- 2. .claude ↔ .agents 미러 (skills) ----------
section "2. skill 미러 — .claude/skills ↔ .agents/skills (실경로 동일·orphan)"
ALL_SKILL_NAMES=$(norm "$SKILLS
$AGENT_SKILLS")
while IFS= read -r s; do
  [ -z "$s" ] && continue
  c=".claude/skills/$s"; a=".agents/skills/$s"
  if [ ! -e "$c" ] && [ -e "$a" ]; then
    fail "$s — .agents/skills 에만 존재 (orphan). 정본 .claude/skills 에 없음 → Codex 전용이면 AGENTS.md 에 명시, 잔재면 삭제 (사용자 승인 필요; 이전 승인 삭제 이력 확인: git log -- $a)"
    continue
  fi
  if [ -e "$c" ] && [ ! -e "$a" ]; then
    fail "$s — .agents/skills 미러 없음 (ln -s ../../.claude/skills/$s .agents/skills/$s)"
    continue
  fi
  rc=$(real_dir "$c" || true); ra=$(real_dir "$a" || true)
  if [ -z "$rc" ] || [ -z "$ra" ]; then fail "$s — 링크 대상 해석 실패 (dangling symlink)"; continue; fi
  if [ "$rc" != "$ra" ]; then fail "$s — 양쪽이 서로 다른 실체 (divergent copy): $rc ≠ $ra"; continue; fi
  if [ -L "$c" ] && [ ! -L "$a" ]; then
    warn "$s — 정본 방향 역전: 실체가 .agents/skills 에 있고 .claude/skills 가 링크 (AGENTS.md:16 '정본은 .claude/' 와 불일치; 실체 이동은 별도 승인)"
  else
    ok "$s"
  fi
done <<<"$ALL_SKILL_NAMES"

# ---------- 3. rules 미러 + paths glob ----------
section "3. rules — .agents/rules 미러 + frontmatter paths 가 실제 파일에 매칭"
while IFS= read -r r; do
  [ -z "$r" ] && continue
  c=".claude/rules/$r"; a=".agents/rules/$r"
  if [ ! -e "$a" ]; then fail "$r — .agents/rules 미러 없음"
  else
    rc=$(real_file "$c"); ra=$(real_file "$a")
    [ "$rc" != "$ra" ] && fail "$r — 미러가 다른 실체를 가리킴"
  fi
  if [ -z "$(fm "$c")" ]; then
    info "$r — frontmatter 없음 (상시 로드 규칙)"
    continue
  fi
  paths=$(fm_list "$c" paths)
  if [ -z "$paths" ]; then fail "$r — frontmatter 에 paths 없음 (어느 파일에도 자동 로드되지 않음)"; continue; fi
  bad=""; alive=0
  while IFS= read -r g; do
    [ -z "$g" ] && continue
    re="^($(glob_to_regex "$g"))$"
    if grep -qE "$re" <<<"$TRACKED"; then alive=$((alive + 1)); else bad="$bad $g"; fi
  done <<<"$paths"
  if [ "$alive" -eq 0 ]; then fail "$r — paths 전부 tracked 파일 0건 매칭 (어느 파일에도 자동 로드되지 않음):$bad"
  elif [ -n "$bad" ]; then warn "$r — 죽은 glob (tracked 파일 0건):$bad"
  else ok "$r"; fi
done <<<"$RULES"
CODEX_ONLY_RULES=$(while IFS= read -r r; do [ -n "$r" ] && [ ! -L ".agents/rules/$r" ] && echo "$r"; done <<<"$AGENT_RULES" || true)
[ -n "$CODEX_ONLY_RULES" ] && info "Codex 전용 실파일: $(printf '%s' "$CODEX_ONLY_RULES" | tr '\n' ' ')"

# ---------- 4. agents frontmatter ----------
section "4. agents — name=파일명, skills: 참조가 실존"
while IFS= read -r ag; do
  [ -z "$ag" ] && continue
  f=".claude/agents/$ag.md"
  name=$(fm_value "$f" name)
  if [ "$name" != "$ag" ]; then fail "$ag — name '$name' ≠ 파일명"; continue; fi
  missing=$(set_minus "$(fm_list "$f" skills)" "$SKILLS")
  if [ -n "$missing" ]; then fail "$ag — skills: 에 없는 skill 참조: $(printf '%s' "$missing" | tr '\n' ' ')"; else ok "$ag"; fi
done <<<"$AGENTS"

# ---------- 5. INDEX ×2 ----------
section "5. INDEX — .claude/skills/INDEX.md · .agents/skills/INDEX.md"
CLAUDE_INDEX=$(grep -oE '\[[a-z0-9-]+\]\([a-z0-9-]+/SKILL\.md\)' .claude/skills/INDEX.md | sed -E 's/^\[([a-z0-9-]+)\].*/\1/' || true)
report_set_eq ".claude/skills/INDEX.md" "INDEX" "$CLAUDE_INDEX" ".claude/skills" "$SKILLS"
CODEX_INDEX=$(grep -oE '\(([a-z0-9-]+)/SKILL\.md\)' .agents/skills/INDEX.md | sed -E 's/^\(([a-z0-9-]+).*/\1/' || true)
report_set_eq ".agents/skills/INDEX.md" "INDEX" "$CODEX_INDEX" ".claude/skills" "$SKILLS"

# ---------- 6. CLAUDE.md 라우팅표 ----------
section "6. CLAUDE.md — Agent 라우팅 매트릭스 · Slash Commands"
MATRIX=$(md_section CLAUDE.md "Agent 라우팅 매트릭스")
# 1차 agent 열 + 2차 검증 열 ("reviewer → evaluator") 모두 등록으로 인정
MATRIX_AGENTS=$( { table_col "$MATRIX" 2; table_col "$MATRIX" 3; } | tr '→,' '\n\n' | sed -E 's/ *\(.*//; s/^[[:space:]]+//; /[[:space:]]skill[[:space:]]*$/d' | grep -oE '^[A-Za-z][A-Za-z-]*' | sort -u || true)
KNOWN_AGENTS="$AGENTS
$BUILTIN_AGENTS"
unknown=$(set_minus "$MATRIX_AGENTS" "$KNOWN_AGENTS")
[ -n "$unknown" ] && fail "라우팅표 1차 agent 에 실존하지 않는 이름: $(printf '%s' "$unknown" | tr '\n' ' ')"
unreg=$(set_minus "$AGENTS" "$MATRIX_AGENTS")
if [ -n "$unreg" ]; then fail "라우팅표에 등록되지 않은 agent: $(printf '%s' "$unreg" | tr '\n' ' ')"; else ok "라우팅표 agent 열 — .claude/agents 전원 등록"; fi
MATRIX_SKILL_TOKENS=$(table_col "$MATRIX" 4 | grep -oE '[a-z][a-z0-9]*(-[a-z0-9]+)+(\.md)?' | grep -v '\.md$' || true)
KNOWN_SKILLISH="$SKILLS
$COMMANDS"
unknown=$(set_minus "$MATRIX_SKILL_TOKENS" "$KNOWN_SKILLISH")
if [ -n "$unknown" ]; then fail "라우팅표 skill 열에 실존하지 않는 이름: $(printf '%s' "$unknown" | tr '\n' ' ')"; else ok "라우팅표 skill 열 — 참조 전부 실존"; fi

SLASH_SECTION=$(md_section CLAUDE.md "Slash Commands")
CLAUDE_SLASH=$(grep -oE '`/[a-z][a-z0-9-]*`' <<<"$SLASH_SECTION" | tr -d '`/' | sort -u || true)
unknown=$(set_minus "$CLAUDE_SLASH" "$KNOWN_SKILLISH")
[ -n "$unknown" ] && fail "§Slash Commands 에 command/skill 실체가 없는 항목: $(printf '%s' "$unknown" | tr '\n' ' ')"
unreg=$(set_minus "$COMMANDS" "$CLAUDE_SLASH")
if [ -n "$unreg" ]; then fail "§Slash Commands 에 없는 .claude/commands: $(printf '%s' "$unreg" | tr '\n' ' ')"; else ok "§Slash Commands — .claude/commands 전원 등록"; fi

# ---------- 7. SessionStart roster ×3 ----------
section "7. SessionStart roster — Claude live · Codex live · Codex manual"
SS=".claude/hooks/session-start.sh"
ROSTER_SKILLS=$(sh_section "$SS" "핵심 Skills" | grep -oE '`[a-z][a-z0-9-]+\\?`' | tr -d '`\\' | sort -u || true)
report_set_eq "roster §핵심 Skills" "roster" "$ROSTER_SKILLS" ".claude/skills" "$SKILLS"
ROSTER_AGENTS=$( { table_col "$(sh_section "$SS" "Agents")" 2; table_col "$(sh_section "$SS" "Agents")" 3; } | tr '→' '\n' | sed -E 's/ *\(.*//; s/^[[:space:]]+//; /[[:space:]]skill[[:space:]]*$/d' | grep -oE '^[a-z][a-z-]*' | sort -u || true)
unknown=$(set_minus "$ROSTER_AGENTS" "$KNOWN_AGENTS")
[ -n "$unknown" ] && fail "roster §Agents 에 실존하지 않는 agent: $(printf '%s' "$unknown" | tr '\n' ' ')"
unreg=$(set_minus "$AGENTS" "$ROSTER_AGENTS")
if [ -n "$unreg" ]; then fail "roster §Agents 에 없는 agent: $(printf '%s' "$unreg" | tr '\n' ' ')"; else ok "roster §Agents — 전원 등록"; fi
ROSTER_SLASH=$(sh_section "$SS" "Slash Commands" | grep -oE '`/[a-z][a-z0-9-]*\\?`' | tr -d '`\\/' | sort -u || true)
report_set_eq "roster §Slash ↔ CLAUDE.md §Slash" "roster" "$ROSTER_SLASH" "CLAUDE.md" "$CLAUDE_SLASH"

CSS="scripts/codex/session-start.sh"
while IFS= read -r p; do
  [ -z "$p" ] && continue
  if [ -e "$p" ]; then ok "codex roster 경로 $p"; else fail "codex roster 가 없는 경로 참조: $p"; fi
done <<<"$(grep -oE '^[[:space:]]+"[^"]+"[[:space:]]*\\?$' "$CSS" | tr -d '" \\' || true)"

XSS=".codex/hooks/session-start.sh"
CODEX_ROSTER_SKILLS=$(sh_section "$XSS" "핵심 Skills" | grep -oE '`[a-z][a-z0-9-]+\\?`' | tr -d '`\\' | sort -u || true)
report_set_eq "Codex live roster §핵심 Skills" "Codex roster" "$CODEX_ROSTER_SKILLS" ".claude/skills" "$SKILLS"

# ---------- 8. prompt router ×2 — skill 커버리지 대칭 ----------
section "8. prompt router — .claude/hooks/route-prompt.sh ↔ scripts/codex/route-prompt.sh (skill 커버리지 대칭)"
CR=".claude/hooks/route-prompt.sh"; XR="scripts/codex/route-prompt.sh"
CR_REFS=$(grep -oE '\\`/?[a-z][a-z0-9-]+\\`' "$CR" | tr -d '`\\/' | sort -u || true)
XR_REFS=$(grep 'add_hint' "$XR" | grep -oE '[a-z][a-z0-9]*(-[a-z0-9]+)+' | sort -u || true)
CR_SKILLS=$(comm -12 <(norm "$CR_REFS") <(norm "$SKILLS"))
XR_SKILLS=$(comm -12 <(norm "$XR_REFS") <(norm "$SKILLS"))
report_set_eq "router skill 커버리지 (claude ↔ codex)" "claude router" "$CR_SKILLS" "codex router" "$XR_SKILLS"
CR_AGENTS=$(comm -12 <(norm "$CR_REFS") <(norm "$KNOWN_AGENTS"))
unreg=$(set_minus "$AGENTS" "$CR_AGENTS")
[ -n "$unreg" ] && info "claude router 가 힌트하지 않는 agent: $(printf '%s' "$unreg" | tr '\n' ' ')"
info "라우팅되지 않는 skill (양쪽 공통): $(set_minus "$SKILLS" "$CR_SKILLS" | tr '\n' ' ')"

# ---------- 9. hooks — host별 등록 ↔ 파일, self-test, package.json codex:* ----------
section "9. hooks — Claude settings + Codex hooks.json 등록·실행권한·self-test"
HOOK_CMDS=$(node -e '
const s = require("./.claude/settings.json").hooks || {};
const out = [];
for (const ev of Object.keys(s)) for (const m of s[ev]) for (const h of (m.hooks || [])) if (h.command) out.push(h.command);
console.log(out.join("\n"));')
while IFS= read -r cmd; do
  [ -z "$cmd" ] && continue
  p="${cmd//\$CLAUDE_PROJECT_DIR/$ROOT_DIR}"
  p="${p%% *}"
  if [ ! -f "$p" ]; then fail "settings.json hook 파일 없음: $cmd"
  elif [ ! -x "$p" ]; then fail "settings.json hook 실행권한 없음: $cmd"
  else ok "hook $(basename "$p")"; fi
done <<<"$HOOK_CMDS"

CODEX_HOOK_AUDIT=$(node scripts/codex/hook-config-audit.mjs "$ROOT_DIR")
if grep -q '^ERROR' <<<"$CODEX_HOOK_AUDIT"; then
  while IFS=$'\t' read -r kind detail; do [ "$kind" = ERROR ] && fail "Codex hooks.json — $detail"; done <<<"$CODEX_HOOK_AUDIT"
else
  ok "Codex hooks.json — event·type·경로·실행권한 ($(awk -F'\t' '$1 == "COUNT" {print $2}' <<<"$CODEX_HOOK_AUDIT") handlers)"
fi

HOOK_SELFTEST_SCRIPT=$(node -e 'console.log(require("./package.json").scripts["hooks:selftest"] || "")')
if grep -q 'claude:hooks:selftest' <<<"$HOOK_SELFTEST_SCRIPT" && grep -q 'codex:hooks:selftest' <<<"$HOOK_SELFTEST_SCRIPT"; then
  ok "hooks:selftest — Claude + Codex host self-test 집계"
else
  fail "hooks:selftest — claude:hooks:selftest와 codex:hooks:selftest를 모두 실행해야 함"
fi

REF_CORPUS=$(cat .claude/settings.json .codex/hooks.json CLAUDE.md AGENTS.md .agents/README.md package.json .claude/hooks/*.sh .codex/hooks/*.sh 2>/dev/null; [ -f CLAUDE.local.md ] && cat CLAUDE.local.md)
for h in .claude/hooks/*.sh; do
  b=$(basename "$h")
  case "$b" in *.test.sh) continue ;; esac
  # 자기 자신 외 참조 1건 이상
  refs=$(grep -c "$b" <<<"$REF_CORPUS" || true)
  self_refs=$(grep -c "$b" "$h" || true)
  if [ "$((refs - self_refs))" -le 0 ]; then fail "orphan hook — 어디서도 참조되지 않음: $h"; fi
done
while IFS= read -r sc; do
  [ -z "$sc" ] && continue
  case "$sc" in codex:*|hooks:*|agent:*) ;; *) continue ;; esac
  cmd=$(node -e 'console.log(require("./package.json").scripts[process.argv[1]])' "$sc")
  for tok in $cmd; do
    case "$tok" in scripts/*|.claude/*) [ -f "$tok" ] || fail "package.json $sc — 파일 없음: $tok" ;; esac
  done
done <<<"$PKG_SCRIPTS"
# 문서가 언급하는 pnpm run codex:* 가 package.json 에 실존
DOC_PNPM=$(grep -ohE 'pnpm (run )?(codex|hooks|agent):[a-z-]+(:[a-z-]+)*' AGENTS.md .agents/README.md scripts/codex/*.sh .claude/hooks/*.sh 2>/dev/null | sed -E 's/pnpm (run )?//' | sort -u || true)
unknown=$(set_minus "$DOC_PNPM" "$PKG_SCRIPTS")
if [ -n "$unknown" ]; then fail "문서/스크립트가 언급하는 pnpm 스크립트가 package.json 에 없음: $(printf '%s' "$unknown" | tr '\n' ' ')"; else ok "pnpm codex:*/hooks:* 언급 전부 실존"; fi

# ---------- 10. 문서의 경로 참조 실존 (.agents/README.md · AGENTS.md) ----------
section "10. 경로 참조 — AGENTS.md · .agents/README.md 의 .claude/ .agents/ scripts/ 경로 실존"
while IFS= read -r p; do
  [ -z "$p" ] && continue
  case "$p" in */) continue ;; esac
  case "$p" in *\**) continue ;; esac
  if [ ! -e "$p" ]; then fail "없는 경로 참조: $p"; fi
done <<<"$(grep -ohE '`(\.claude|\.agents|scripts)/[^` ]+`' AGENTS.md .agents/README.md | tr -d '`' | sort -u || true)"
ok "경로 참조 검사 완료"

# ---------- 11. 제거된 플러그인 이름 잔존 (superpowers, 2026-07-31 비활성화) ----------
section "11. stale 참조 — 제거된 외부 플러그인 skill 이름"
STALE_NAMES='brainstorming|systematic-debugging|verification-before-completion|writing-plans|executing-plans|dispatching-parallel-agents|subagent-driven-development|test-driven-development|requesting-code-review|using-git-worktrees|superpowers:'
STALE_HITS=$( { find .claude .agents .codex/hooks scripts/codex -maxdepth 3 \( -name '*.md' -o -name '*.sh' -o -name '*.json' \) -not -name '*selftest*' -not -path '*/references/*' -not -path '*/stats/*' -not -path '*/agent-memory/*'; echo CLAUDE.md; echo AGENTS.md; } \
  | grep -v "^$SELF$" | xargs grep -lE "$STALE_NAMES" 2>/dev/null || true)
if [ -n "$STALE_HITS" ]; then
  while IFS= read -r f; do [ -n "$f" ] && fail "제거된 플러그인 skill 이름 잔존: $f ($(grep -oE "$STALE_NAMES" "$f" | sort -u | tr '\n' ' '))"; done <<<"$STALE_HITS"
else
  ok "잔존 없음"
fi

# ---------- 12. invocation 정책 — frontmatter ↔ INDEX×2 ↔ Claude/Codex live roster ----------
section "12. invocation 정책 — disable-model-invocation ↔ INDEX×2 ↔ Claude/Codex live roster"
while IFS= read -r s; do
  [ -z "$s" ] && continue
  dmi=$(fm_value ".claude/skills/$s/SKILL.md" disable-model-invocation)
  c_row=$(grep -F "[$s]($s/SKILL.md)" .claude/skills/INDEX.md || true)
  x_row=$(grep -F "($s/SKILL.md)" .agents/skills/INDEX.md || true)
  r_line=$(sh_section "$SS" "핵심 Skills" | grep -E "\`$s\\\\?\`" || true)
  live_line=$(sh_section "$XSS" "핵심 Skills" | tr -d '\\' | grep -F "\`$s\`" || true)
  c_has=0; x_has=0; r_has=0; live_has=0
  grep -q "사용자 전용" <<<"$c_row" && c_has=1
  grep -q "user-only" <<<"$x_row" && x_has=1
  grep -q "사용자 전용" <<<"$r_line" && r_has=1
  grep -q "user-only" <<<"$live_line" && live_has=1
  if [ "$dmi" = "true" ]; then
    [ "$c_has" = 1 ] && [ "$x_has" = 1 ] && [ "$r_has" = 1 ] && [ "$live_has" = 1 ] && ok "$s — 사용자 전용 (4표면 일치)" || fail "$s — disable-model-invocation:true 인데 표기 누락: claude INDEX=$c_has codex INDEX=$x_has claude roster=$r_has codex roster=$live_has"
  else
    [ "$c_has" = 0 ] && [ "$x_has" = 0 ] && [ "$r_has" = 0 ] && [ "$live_has" = 0 ] && ok "$s — 모델·사용자" || fail "$s — frontmatter 는 모델 호출 허용인데 사용자 전용 표기: claude INDEX=$c_has codex INDEX=$x_has claude roster=$r_has codex roster=$live_has"
  fi
done <<<"$SKILLS"

# ---------- 13. tracked symlink dangling ----------
section "13. tracked symlink — 대상 실존"
DANGLING=0
while IFS= read -r p; do
  [ -z "$p" ] && continue
  if [ ! -e "$p" ]; then fail "dangling symlink (tracked): $p -> $(readlink "$p")"; DANGLING=1; fi
done <<<"$(git ls-files -s | awk '$1 == "120000" { print $4 }')"
[ "$DANGLING" = 0 ] && ok "tracked symlink $(git ls-files -s | awk '$1 == "120000"' | wc -l | tr -d ' ')개 전부 해석됨"

# ---------- summary ----------
printf '\n== 결과 == FAIL %d · WARN %d\n' "$FAIL" "$WARN"
LEDGER="$ROOT_DIR/scripts/agent/run-ledger.sh"
if [ -x "$LEDGER" ]; then
  AGENT_EVIDENCE_SOURCE=agent-catalog-gate.sh bash "$LEDGER" evidence catalog-gate "$([ "$FAIL" -gt 0 ] && echo fail || echo pass)" --detail "FAIL $FAIL WARN $WARN" --cmd "pnpm codex:agent-catalog" >/dev/null 2>&1 || true
fi
if [ "$FAIL" -gt 0 ]; then
  echo "[codex:agent-catalog] drift 감지 — 위 ✗ 항목을 정본(.claude/) 기준으로 정렬하세요."
  exit 1
fi
echo "[codex:agent-catalog] 통과"
