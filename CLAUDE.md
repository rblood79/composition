# composition - Claude Code Context

composition는 **노코드 웹 빌더** 애플리케이션입니다 (pnpm monorepo).

- `packages/react-aria-starter` 는 RAC starter upstream 스냅샷 — **read-only 참조 baseline** (편집 금지)

> **⚠️ 필수**: 코드 작업 시작 전 반드시 `.claude/skills/composition-patterns/SKILL.md`를 읽으세요.

## 명령 · 환경

```bash
pnpm install                                        # postinstall: canvaskit wasm 복사 + specs 빌드
pnpm wasm:build:engine                              # Rust 엔진 → wasm (산출물 gitignored, Rust+wasm-pack 필요 — fresh clone·엔진 변경 후 필수)
pnpm dev                                            # builder dev 서버 (5173) · 포트 충돌 시 pnpm dev:kill
pnpm type-check                                     # Stop hook 이 같은 명령 실행
pnpm -F @composition/builder exec vitest run <path> # 단일 테스트 (실패 count 는 per-package 만 정확)
pnpm -F @composition/builder test:parity            # browser vitest · visual smoke 는 pnpm gate:visual-parity
pnpm codex:preflight                                # guard + format + typecheck + registration gate
pnpm perf:baseline -- --lane leak|frame             # 누수·프레임 기준선 하니스 (Playwright+CDP, docs/explanation/research/BUILDER_PERF_BASELINE_2026-09.md)
```

env: `apps/builder/.env.example` → `.env`. `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 필수. `VITE_USE_WEBGL_CANVAS=false` 면 iframe Preview 폴백.

**구조**: `apps/builder` (Skia 빌더) · `apps/publish` (런타임) · `packages/shared` (catalog·공용) · `packages/specs` (잔존 spec 3개·CSS 생성) · `packages/composition-engine` (Rust 레이아웃) · `packages/config`

**핵심 진입점**: `apps/builder/src/main.tsx` (빌더) · `apps/builder/src/builder/workspace/canvas/skia/` (Skia 렌더) · `apps/builder/src/builder/stores/` (Zustand) · `packages/shared/src/catalog/generated/componentRulesTable.ts` (D3 SSOT 생성물) · `apps/publish/src/main.tsx` (런타임)

**테스트 배치**: unit 은 모듈 옆 `*.test.ts` / `__tests__/` (`vitest.config.ts`) · 엔진 parity 는 `apps/builder/tests/parity/` (browser, `vitest.browser.config.ts`) · 시각 parity 는 `scripts/visual-parity-gate.mjs` (smoke/full). 실패 count 는 `pnpm -F <pkg> test` 로만 정확 (turbo 합산 금지).

## SSOT 체인 정본 — 3-Domain 분할 (CRITICAL)

**D1 DOM/접근성** (Adobe RAC 절대 권위) / **D2 Props/API** (RSP 참조 + custom — 타입만) / **D3 시각 스타일** (catalog `COMPONENT_RULES_TABLE` + theme/tokens SSOT — 잔존 spec 3개 Frame/Group/Slot 예외). Builder(Skia) 와 Preview/Publish(DOM+CSS) 는 D3 의 **대등 symmetric consumer** — 대칭 = 시각 결과의 동일성.

정본 규칙 (상시 로드): [.claude/rules/ssot-hierarchy.md](.claude/rules/ssot-hierarchy.md). 공식 결정: [ADR-063](docs/adr/completed/063-ssot-chain-charter.md) (charter), [ADR-142](docs/adr/completed/142-starter-spec-component-system-cutover.md) (D3 SSOT 재정의).

## 성능 기준

|           Canvas/Skia cadence           | 초기 로드 | 번들 (초기) |
| :-------------------------------------: | :-------: | :---------: |
| native refresh target, 60Hz floor (p95) |   < 3초   |   < 500KB   |

`60fps` 는 60Hz 환경의 호환성 최소선이며 성능 목표 상한이 아니다. 판정은 display refresh cadence 와 frame time p50/p95/p99 우선, FPS 는 파생 지표.

## 공용 작업 상태

- Codex 와 Claude 는 `.agent/task-state.json` 을 같은 작업 상태 파일로 읽습니다.
- 세션 시작과 프롬프트에 표시되는 상태를 작업 계약으로 사용하고, 작업 시작·단계 전환·검증 완료·차단 발생 때 JSON 을 갱신합니다.
- `goal`, `guard`, `stop` 은 사용자 승인 없이 바꾸지 않습니다. 상태 파일은 로컬 전용이며 커밋하지 않습니다.

## 작업 워크플로

- **복잡한 작업** (렌더링, drag-and-drop, 대규모 리팩토링): built-in `Plan` agent 로 접근 방식 탐색 후 선택 — 전제·관점 의문은 아래 §전제·관점 의문 처리 의 4개 결정 지점에서만 질문
- **버그 수정**: `/fix` (`debugger` agent → `/cross-check`) — 증상 수정 금지, root cause 확정 후 수정. 도메인 병인은 `.claude/rules/` 의 실측 "Why" 기록이 정본
- **구현**: TDD (RED-GREEN-REFACTOR) 기본 — 메인 세션이 직접 (구현·테스트를 서브에이전트에 위임하면 컨텍스트만 잃는다)
- **렌더링 수정 후**: `/cross-check` 최종 검증
- **ADR 생성**: 사용자가 `/create-adr` 직접 입력 — create-adr / execute-adr / match-target 은 모델 자동 호출 비활성 (사용자 전용)
- **다단계 계획**: ADR design breakdown (`docs/adr/design/*-breakdown.md`) 이 정본 — 별도 계획 문서 계층 신설 금지
- **완료 직전 검증**: 아래 §완료 기준 자가 적용 + `/review` (reviewer 격리 fork) · 사용자-가시 변경은 `/evaluate` (런타임 4축 채점, 격리 fork)
- **단순 작업** (한 줄 수정, 설정 변경): 위 절차 스킵 가능
- CRITICAL/HIGH 이슈: 즉시 수정, 스킵 금지
- **판독 루프 종결**: phase 당 판독 1 + 수리 검증 1, HIGH 0 이면 실행자가 닫힘 선언 · production 재현 없는 커버리지 지적은 LOW deferred · 동작 변경 0 커밋은 축소 절차 — 정본 `.claude/rules/review-loop-closure.md` (상시 로드)

### 완료 기준 — test/type-check PASS 단독으로 ADR·task 종결 금지 (CRITICAL)

unit-test / type-check / codex:preflight 는 "코드가 자기 자신과 정합한가" 만 확인한다 — live behavior 는 검증하지 않는다. ADR Implemented 승격 또는 task "완료" 선언 전:

- 사용자-가시 동작 (registration / resolved-tree wiring / schema / 렌더) 을 **실제 builder 에서** Chrome MCP 또는 사용자 confirm 으로 1회 exercise.
- 완료 보고에 **무엇을 실제로 exercise 했는지** 명시 (test 개수만 나열 금지).
- Implemented 승격 시 ADR 본문 `### Live Exercise` 절 (대안: `docs/adr/evidence/NNN-*live*.md` 또는 run ledger `live-exercise pass`) 필수 — `adr-status-sync-check.sh` 가 없으면 block. 실행 근거는 `pnpm agent:run` ledger (`.agent/runs/`, local-only).
- Why: ADR-144 (2026-05-22) — test 9/50 PASS + type-check 0 으로 승격 → live 에서 registration "changed nothing" → 34 commit revert. 상세: 메모리 `feedback-adr-closure-5-step`.

### 대규모 작업 phase 분할 — 단일 거대 출력 금지

다수 파일 일괄 수정 / 전체 리팩토링 / 장문 문서 일괄 생성은 **phase 단위로 분할**하고 각 phase 종료 시 commit 가능 상태를 유지한다 — 응답 1개 = phase 1개, tool call 도 파일·단계 단위. tool call 이 직렬화 실패로 반환되면 같은 호출 재시도 금지 — 더 작은 단위로 쪼갠다. (Why: 세션 손실 주범 = tool-call 직렬화 실패 + output token limit — 메모리 `reference-insights-session-loss-diagnosis`)

### 마크다운 표 편집 — 다중 Edit 대신 블록 단위 Write

정렬된 표·정렬 의존 텍스트는 Edit 부분 수정 대신 표 블록 전체 (필요 시 파일 전체) 를 Write 로 교체한다 — old_string 정렬 mismatch 반복 실패 방지. 수동 정렬 작업 금지: Prettier PostToolUse hook 이 되돌린다. 내용만 쓰고 정렬은 포맷터에 위임.

## 상태 변경 파이프라인

`Memory → Index → History (즉시) → DB → Preview (백그라운드)` — 순서 필수 보존. 요소 순서는 canonical `children[]` 배열이 SSOT (ADR-118), `order_num` 은 export mirror 파생. 상세: `.claude/rules/state-management.md`

## CHANGELOG 관리 (CRITICAL)

`docs/CHANGELOG.md` 는 사용자-가시 변경의 SSOT — 같은 커밋 또는 바로 다음 커밋에 반영. **트리거**: ADR Implemented 승격 / 사용자-가시 버그 수정 / 신규 컴포넌트·prop·public API / 3+ 파일 아키텍처 변경·Breaking·성능 회귀 수정 / Phase 다단계 작업 완결. **면제**: typo / 주석 / 내부 리팩터 / 테스트만 / stats / hook 튜닝.

**Drift 감시**: 첫 커밋 작업 전 최근 엔트리 날짜 확인 — **14일 또는 100 커밋 초과** 시 catch-up 블록 먼저 (ADR/주제별 bundle, 개별 커밋 나열 금지). 포맷·절차·체크리스트: `.claude/rules/changelog.md` (편집 시 자동 로드)

## 자동 품질 게이트 (Hooks)

정의: `.claude/settings.json` `hooks` + `.claude/hooks/*.sh`. **block 하는 것 2가지** — Stop 시 `.ts/.tsx` 변경이 있으면 `pnpm type-check` 실패를 block · ADR Implemented 승격 시 README/CHANGELOG 갱신과 `### Live Exercise` 절 부재를 block (escape hatch 있음).

검증 도구: `pnpm codex:agent-catalog` (카탈로그 drift 게이트) · `pnpm hooks:selftest` · `pnpm agent:run` (run ledger).

## 참조 체계

| 용도             | 경로                                                                           | 설명                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 코드 패턴/규칙   | [SKILL.md](.claude/skills/composition-patterns/SKILL.md)                       | 전체 규칙 인덱스 (CRITICAL/HIGH/MEDIUM)                                                                       |
| 도메인 규칙      | [.claude/rules/](.claude/rules/)                                               | Glob-scoped — 해당 파일 작업 시 자동 로드                                                                     |
| Agent 가이드     | [.claude/agents/](.claude/agents/)                                             | reviewer, debugger — 얇은 persona (도구 제한·모델·격리만). 절차·체크리스트는 skills (review / fix / evaluate) |
| ADR 현황         | [docs/adr/README.md](docs/adr/README.md)                                       | 전체 ADR 현황 대시보드                                                                                        |
| ADR 규칙         | [.claude/rules/adr-writing.md](.claude/rules/adr-writing.md)                   | Risk-First 템플릿, 위험 평가, 금지 패턴, 반복 패턴 선차단 (`docs/adr/**` 자동 로드)                           |
| 측정·검증 무결성 | [.claude/rules/measurement-validity.md](.claude/rules/measurement-validity.md) | Gate 수치 leakage 8-패턴 + 착수 전 5-질문 + 실패 record (`docs/adr/**`·performance 자동 로드)                 |
| 판독 루프 종결   | [.claude/rules/review-loop-closure.md](.claude/rules/review-loop-closure.md)   | 라운드 상한 · 커버리지 지적 판정 (가설 1 + 반증 1) · 변경 종류별 절차 · 판독 프롬프트 필수 문구 (상시 로드)   |
| CHANGELOG 규칙   | [.claude/rules/changelog.md](.claude/rules/changelog.md)                       | 트리거·Drift 감시·catch-up·Keep a Changelog 포맷 (`docs/CHANGELOG*` 자동 로드)                                |
| CHANGELOG 본문   | [docs/CHANGELOG.md](docs/CHANGELOG.md)                                         | 현재 엔트리 — 연도별 아카이브 (`CHANGELOG-YYYY-archived.md`) 로 이관                                          |

## 마이그레이션/리네임/삭제 작업 원칙 (CRITICAL)

- **원본 파일 삭제는 명시적 승인 필요**: "ok", "좋아", "진행해" 같은 일반적 동의는 삭제 승인이 아님. 삭제 전 "원본 파일 `X` 를 삭제해도 되나요?" 로 별도 확인
- 마이그레이션 중 원본은 사용자가 검증 완료를 명시할 때까지 유지
- 대규모 이동/리네임: 새 경로 생성 → 검증 → (승인 후) 원본 삭제 — 3단계 분리

## Git Push 정책 (CRITICAL — 로컬 작업 환경 절대 정책)

**web PR 자체 금지. 예외 없음.** default = `git add` → `git commit` → `git push origin main`. 분기·PR·차단 시 대응·worktree 통합 절차는 상시 로드되는 `.claude/rules/git-workflow.md` 가 정본.

## 렌더링 버그 수정 원칙

CSS/Skia 두 타겟 × 5 레이어 (spec/factory/CSS renderer/Skia renderer/editor) 를 함께 확인하고 `/cross-check` 로 검증한다 — 원칙 전문·금지 패턴: `.claude/rules/canvas-rendering.md` §0 (편집 시 자동 로드)

## 병렬 워크플로

- 대규모 리팩토링: `isolation: "worktree"` 격리 에이전트. 독립 작업 2+ 개: Agent tool 병렬 호출 (단일 응답에 복수 agent)
- 생성-평가 분리: 구현은 메인 세션, 검증은 `/review` (정적) · `/evaluate` (런타임) 격리 fork
- worktree 통합은 main 직접 merge (PR 경유 금지) — 절차: `.claude/rules/git-workflow.md` §3
- `/loop`: 렌더링 파리티 반복 검증에 적합

---

**마지막 지침**: 항상 **Plan 먼저 → Execute → Verify (`/cross-check` + `type-check`)**. 불확실한 부분이 아래 4개 결정 지점에 해당하면 질문을 먼저 한다. 그 외의 불확실성은 가정 대신 코드·문서 실측으로 해소한 뒤 자율 진행 + 사후 보고한다.

**응답·문서 어휘 규칙**: 정본은 `~/.claude/CLAUDE.md` (글로벌 — 3단계 선택 순서 + 금지/대체 표, 모든 프로젝트 적용). 커밋 메시지는 `.claude/hooks/protect-commit-vocabulary.sh` 가 검사. 항목별 사유·지적 이력: 메모리 `feedback-vocabulary-hanja-coinage-history`.

---

**전제·관점 의문 처리 — 결정 지점 한정 (CRITICAL)**: AskUserQuestion 은 아래 4개 결정 지점에서만 — (1) ADR fork / 분리 / 통합 · (2) ADR 간 의존 방향 반전 · (3) SSOT 경계 재판정 (D1/D2/D3 소속 변경) · (4) 사용자가 승인한 scope 자체의 변경. 그 외 (승인된 ADR phase 의 통상 구현 판단 · 추정 vs 실측 gap · 이미 확정된 전제) 는 질문 금지. 리뷰 종결 기록 (`docs/adr/reviews/{NNN}.md`) 또는 fork checkpoint confirm 이 있으면 전제는 세션을 넘어 확정. 호출 규약 · 종결 계약 · 재개 조건 · 깊은 사고 의무 전문: `.claude/rules/premise-decision-points.md` (상시 로드)
