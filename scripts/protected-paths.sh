#!/usr/bin/env bash
# 보호 파일 목록 — 세 스크립트가 같이 읽는 한 곳.
#   .claude/hooks/protect-files.sh   (Claude PreToolUse)
#   .codex/hooks/protect-files.sh    (Codex PreToolUse)
#   scripts/codex/protect-files.sh   (codex:preflight 1단계 guard)
#
# 판정은 경로 전체가 아니라 파일 이름 (basename) 으로 한다. 경로 부분 문자열로 찾으면
# 소스 파일이 걸린다 — `secret` 이 `secretVault.ts` (ADR-212) 를, 정규식 `.env` 가
# `vite-env.d.ts` 를 막았다 (2026-11-25 실측, Claude 사본은 2026-07-17 에 -F 로 고쳤지만
# 나머지 두 사본에 반영되지 않았다).
#
# 보호하지 않는 것: `.claude/settings*.json` · hooks · rules · CLAUDE.md · AGENTS.md —
# 2026-05-31 사용자 결정 (3a8082ea9, 「쉽게 고치려고」), 2026-11-25 preflight 도 이 결정에 맞춤.
# `.env.example` 은 비밀값이 없는 템플릿이라 보호하지 않는다.
#
# macOS bash 3.2 호환.

# protected_path_reason <path> → 보호 대상이면 사유를 출력하고 0, 아니면 1.
protected_path_reason() {
  local name
  name=$(basename -- "$1" | tr '[:upper:]' '[:lower:]')
  # 라이선스 토큰 · live 하니스 로그인 세션 — 둘 다 gitignore 라 덮어쓰면 git 으로 되돌릴 수 없다
  # (AGENTS.md §Git·문서·보호 파일, 2026-11-25 추가). 하니스 (`license-auth-live.mjs` 등) 는
  # node 로 쓰므로 Edit/Write hook 에 걸리지 않고, preflight 는 ignore 파일을 보지 않는다.
  # `license` 는 흔한 이름이라 basename 이 아니라 경로 끝으로 본다.
  case "$1" in
    apps/builder/public/license | */apps/builder/public/license)
      printf '라이선스 토큰 (%s)\n' "$1"; return 0 ;;
  esac
  case "$name" in
    .auth-session*.json) printf 'live 하니스 로그인 세션 (%s)\n' "$name"; return 0 ;;
    .env.example) return 1 ;;
    .env | .env.*) printf '환경 변수 파일 (%s)\n' "$name"; return 0 ;;
    *credentials*) printf '인증 정보 파일 (%s)\n' "$name"; return 0 ;;
    secret | secrets | secret.* | secrets.* | .secret | .secrets | .secret.* | .secrets.*)
      printf '비밀값 파일 (%s)\n' "$name"; return 0 ;;
  esac
  return 1
}
