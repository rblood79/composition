---
name: verify
description: 커밋 직전 변경이 실제 builder 에서 동작하는지 1회 확인할 때 사용. type-check 통과 뒤 영향 영역을 브라우저에서 exercise 하고 PASS/FAIL 을 보고. 문서·테스트만 바뀐 커밋은 건너뜀.
argument-hint: [검증 범위 — 생략 시 staged + dirty 변경]
---

# 커밋 전 동작 확인

프로젝트 skill `verify` 는 Claude Code 번들 `/verify` 를 대체합니다 (프로젝트에 `verify` 가 있으면
커밋 직전 자동으로 실행 안내 — docs · tests 만 바뀐 커밋 제외). 번들 `/verify` 의 launch 추론
(README · package.json) 은 이 monorepo 에서 신뢰할 수 없어 절차를 여기 고정합니다.

목적은 CLAUDE.md §완료 기준과 같습니다 — test · type-check 는 코드가 자기 자신과 정합한지만 보고
live behavior 는 보지 않습니다. 이 skill 은 **변경이 닿는 사용자-가시 동작을 실제 builder 에서 1회 exercise** 합니다.
Stop hook 의 `type-check-gate.sh` 는 응답이 끝난 뒤 type-check 를 돌려 실패하면 모델을 다시 부릅니다 — 응답을 막지는 않고,
추적 중인 `.ts` · `.tsx` 변경만 봅니다 (새로 만든 미추적 파일뿐이면 돌지 않습니다). 이 skill 은 그 위의 live 층입니다.

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

- **서버**: 5173 에 dev 서버가 없으면 `pnpm dev` 로 띄웁니다 (포트는 `vite.config.ts` 가 5173 · `strictPort` 로 고정 — 충돌 시 `pnpm dev:kill`. `DEV_PORTS` 는 `dev:kill` 이 끌 포트만 정합니다). 병렬 worktree 는 `pnpm -F @composition/builder exec vite --port 5174` 로 띄우고 하니스에 `BUILDER_URL=http://localhost:5174` 를 줍니다 — 업로드 live 는 참조 서버 CORS 가 5173 이라 5173 에서만.
  catalog · theme 값이 바뀌었으면 먼저 `pnpm generate:css` (생성 CSS 는 build-time 주입).
- **진입**: 저장된 인증 세션으로 `/dashboard` 직행. `/signin` 코드 입력은 하지 않습니다.
- **분기**:
  - 렌더 · catalog · 스타일 패널 변경 → [cross-check](../cross-check/SKILL.md) — 영향 컴포넌트마다 Canvas ↔ Preview 를 같은 상태에서 비교 (family 는 컴포넌트마다 반복).
  - 사용자 흐름 · 상태 · 패널 · 저장 변경 → [evaluate](../evaluate/SKILL.md) — 요소는 팔레트 클릭 · Properties 편집으로 심고, 저장 변경은 새로고침 hydration 까지.
  - 둘 다 닿으면 둘 다. 각 skill 의 관찰 규칙 (foreground RAF · 스크린샷 · Compare Mode 함정) 을 그대로 따릅니다.
- 브라우저 선택과 연결 실패 시 대체 수단은 [evaluate의 브라우저 도구](../evaluate/SKILL.md#브라우저-도구)에서 현재 실행 환경의 규칙을 따릅니다.
  같은 조건을 headed Playwright 하니스로 재현하거나 사용자가 직접 확인할 수 있습니다. 관찰할 수 없는 항목은 BLOCKED로 기록합니다.

### 판정 — PASS · FAIL · BLOCKED

세 판정의 정의는 [evaluate](../evaluate/SKILL.md) §보고 와 같습니다. 여기서 더하는 것:

- **PASS**: 관찰한 것 (스크린샷 · console 덤프 · 상태 JSON · 하니스 출력) 을 파일로 남깁니다.
- **BLOCKED**: FAIL 로 적으면 없는 결함을 고치게 되고, PASS 로 적으면 미검증이 완료로 남습니다.
  막힌 이유와 풀 방법 (foreground 로 전환 · 스크린샷으로 대체 · 사용자 확인) 을 적고, 풀 수 있으면 풀어서 다시 관찰합니다.

## 4. 보고와 커밋

`### Live Exercise` 절에 그대로 옮길 수 있는 형태로 적습니다 — 날짜 · 시나리오 · 결과 (PASS/FAIL/BLOCKED 수) · 수단
(실제 브라우저 도구 또는 사용자 확인) · 콘솔 오류 수(관찰 불가 시 미확인). "무엇을 실제로 exercise 했는지" 를 씁니다 (test 개수 나열 금지).

- FAIL 이 있으면 커밋하지 않고 `/fix` 로 root cause 부터 — 증상 수정 금지.
- BLOCKED 가 남으면 PASS 로 세지 않습니다. 미검증 범위를 적고 커밋 여부를 사용자에게 넘깁니다.
- run 이 열려 있으면 ledger 에도 같은 판정을 남깁니다. 순서는 셋입니다:
  1. 관찰한 것을 run 폴더 `artifacts/` 에 파일로 저장합니다 (`.agent/runs/<현재 run>/artifacts/` — 스크린샷 ·
     console 덤프 · 상태 JSON · 하니스 출력 중 아무거나). devtools 스크린샷은 `filePath` 에 `artifacts/` 경로를
     바로 줍니다. Claude in Chrome 스크린샷은 `save_to_disk: true` 로 찍고 ([evaluate](../evaluate/SKILL.md) §브라우저 도구)
     돌아온 임시 경로의 파일을 `artifacts/` 로 복사합니다 — `scale` 을 주면 저장 파일도 그만큼 작아지니 증거용은 `scale` 없이 찍습니다.
  2. Claude Code에서는 그 파일을 Read로 엽니다. `track-evidence-read.sh`가 읽은 사실을 run에 남깁니다.
  3. `pnpm agent:run -- evidence live-exercise pass --detail "<무엇을>" --artifact artifacts/<파일>`.

  artifact 가 없거나 · `artifacts/` 밖이거나 · Claude Code에서 Read 하지 않았거나 Read 뒤 바뀌었거나 · 이미 다른 pass 에 쓴
  파일이면 기록이 거부됩니다. 관찰하지 못했으면 `evidence live-exercise block --detail "<막힌 이유>"`.

- PASS 면 커밋으로 진행합니다. ADR Implemented 승격 커밋이면 이 보고가 ADR 본문 `### Live Exercise` 절의 내용이 됩니다
  (`adr-status-sync-check.sh` 는 작업 트리에 남은 미커밋 승격의 절 부재만 block 합니다 — 승격과 커밋을 한 턴에 하면
  검사가 돌지 않으니 커밋 전에 절을 직접 확인합니다).
