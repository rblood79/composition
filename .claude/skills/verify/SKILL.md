---
name: verify
description: 커밋 직전 변경이 실제 builder 에서 동작하는지 1회 확인할 때 사용. type-check 통과 뒤 영향 영역을 브라우저에서 exercise 하고 PASS/FAIL 을 보고. 문서·테스트만 바뀐 커밋은 건너뜀.
argument-hint: [검증 범위 — 생략 시 staged + dirty 변경]
---

# 커밋 전 동작 확인

프로젝트 skill `verify` 는 Claude Code 번들 `/verify` 를 대체합니다 (2.1.286+: 프로젝트에 `verify` 가 있으면
커밋 직전 자동으로 실행 안내 — docs · tests 만 바뀐 커밋 제외). 번들 `/verify` 의 launch 추론
(README · package.json) 은 이 monorepo 에서 신뢰할 수 없어 절차를 여기 고정합니다.

목적은 CLAUDE.md §완료 기준과 같습니다 — test · type-check 는 코드가 자기 자신과 정합한지만 보고
live behavior 는 보지 않습니다. 이 skill 은 **변경이 닿는 사용자-가시 동작을 실제 builder 에서 1회 exercise** 합니다.
Stop hook 의 `type-check-gate.sh` 는 그대로 결정적 차단이고, 이 skill 은 그 위의 live 층입니다.

## 1. 범위

```bash
git diff --cached --name-only; git diff --name-only
```

- 다른 세션의 변경 (자기가 편집하지 않은 파일) 은 범위에서 뺍니다 — `.claude/rules/git-workflow.md` 의 pathspec 커밋 규칙.
- 아래만 바뀌었으면 live 생략, 2 단계까지 하고 끝냅니다: `docs/**` · `*.test.ts(x)` · `__tests__/**` · `tests/**` ·
  `.claude/**` · `.agents/**` · `.codex/**` · `scripts/**` · 주석 · 포맷.
- 나머지 (`apps/**` · `packages/**` 소스, catalog · theme · 생성 CSS) 는 3 단계 live 대상입니다.

## 2. 정적 확인

```bash
pnpm type-check                                     # Stop hook 과 같은 명령 — 이 턴에 이미 PASS 면 재실행 불요
pnpm -F @composition/builder exec vitest run <변경 모듈 옆 테스트>   # 변경 범위의 테스트만
```

실패하면 여기서 FAIL 보고하고 커밋하지 않습니다 (중단 기준: type-check 실패 커밋 금지).

## 3. live exercise (1회)

- **서버**: 5173 에 dev 서버가 없으면 `pnpm dev` 로 띄웁니다 (충돌 시 `pnpm dev:kill`, 병렬 worktree 는 `DEV_PORTS="5174"`).
  catalog · theme 값이 바뀌었으면 먼저 `pnpm generate:css` (생성 CSS 는 build-time 주입).
- **진입**: 저장된 인증 세션으로 `/dashboard` 직행. `/signin` 코드 입력은 하지 않습니다.
- **분기**:
  - 렌더 · catalog · 스타일 패널 변경 → [cross-check](../cross-check/SKILL.md) — 영향 컴포넌트마다 Canvas ↔ Preview 를 같은 상태에서 비교 (family 는 컴포넌트마다 반복).
  - 사용자 흐름 · 상태 · 패널 · 저장 변경 → [evaluate](../evaluate/SKILL.md) — 요소는 팔레트 클릭 · Properties 편집으로 심고, 저장 변경은 새로고침 hydration 까지.
  - 둘 다 닿으면 둘 다. 각 skill 의 관찰 규칙 (foreground RAF · 스크린샷 · Compare Mode 함정) 을 그대로 따릅니다.
- **Chrome MCP 를 쓸 수 없으면** headed Playwright 하니스 (`apps/builder/scripts/<주제>-live.mjs`, `BUILDER_URL`) 또는 사용자 confirm 으로 대체하고, 어느 수단이었는지 적습니다. 둘 다 불가능하면 미검증 범위를 명시하고 커밋 여부를 사용자에게 넘깁니다.

## 4. 보고와 커밋

`### Live Exercise` 절에 그대로 옮길 수 있는 형태로 적습니다 — 날짜 · 시나리오 · 결과 (PASS/FAIL 수) · 수단
(Chrome MCP / Playwright / 사용자 confirm) · 콘솔 오류 수. "무엇을 실제로 exercise 했는지" 를 씁니다 (test 개수 나열 금지).

- FAIL 이 있으면 커밋하지 않고 `/fix` 로 root cause 부터 — 증상 수정 금지.
- PASS 면 커밋으로 진행합니다. ADR Implemented 승격 커밋이면 이 보고가 ADR 본문 `### Live Exercise` 절의 내용이 됩니다
  (`adr-status-sync-check.sh` 가 절 부재를 block).
