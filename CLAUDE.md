# composition - Claude Code Context

composition는 **노코드 웹 빌더** 애플리케이션입니다 (pnpm monorepo).

> **⚠️ 필수**: 코드 작업 시작 전 반드시 `.claude/skills/composition-patterns/SKILL.md`를 읽으세요.

## 프로젝트 구조

composition/
├── apps/
│ ├── builder/ # 메인 빌더 앱 (에디터 + Canvas + Store)
│ │ └── src/
│ │ ├── builder/ # Builder UI (패널, 캔버스, 스토어)
│ │ ├── preview/ # Preview (iframe 내부)
│ │ └── services/ # Supabase, AI 서비스
│ └── publish/ # 프로젝트 배포 앱
├── packages/
│ ├── composition-engine/ # 자체 Rust WASM 레이아웃 엔진 (ADR-916)
│ ├── config/ # 공유 설정 (ESLint, TypeScript)
│ ├── react-aria-starter/ # RAC starter upstream 스냅샷 (read-only 참조 baseline)
│ ├── shared/ # 공유 유틸리티
│ └── specs/ # 컴포넌트 스펙 (Skia 렌더링용)
├── docs/
│ ├── adr/ # ADR (Risk-First 템플릿)
│ └── reference/ # 기술 문서
└── .claude/
├── hooks/ # 자동 품질 게이트 (type-check, protect, format)
├── rules/ # Glob-scoped 컨텍스트 규칙 (파일 패턴별 자동 로드)
├── agents/ # Agent 가이드 (architect, implementer, reviewer, evaluator 등)
└── skills/ # Code Patterns & Rules (SKILL.md)

```

## SSOT 체인 정본 — 3-Domain 분할 (CRITICAL)

composition 은 3개 독립 domain 으로 구성된다: **D1 DOM/접근성** (Adobe RAC 절대 권위 — SSOT 관여 금지) / **D2 Props/API** (RSP 참조 + custom — 타입만) / **D3 시각 스타일** (catalog `COMPONENT_RULES_TABLE` + theme/tokens SSOT — 잔존 spec 3개 Frame/Group/Slot 예외, ADR-142 로 spec 파일에서 전환됨, ADR-036 은 Superseded).

**원칙**: Builder(Skia)와 Preview/Publish(DOM+CSS)는 D3 의 **대등 symmetric consumer** — 한쪽이 기준 아님, 대칭 = 시각 결과의 동일성 (구현 방법 자유). RAC 선택 이유 = unstyled primitive 의 스타일 자유도.

**정본 규칙**: [.claude/rules/ssot-hierarchy.md](.claude/rules/ssot-hierarchy.md) (상시 로드 — 3-domain 정의/용어 사전/경계 판정/집행 메커니즘). 공식 결정: [ADR-063](docs/adr/completed/063-ssot-chain-charter.md) (charter), [ADR-142](docs/adr/completed/142-starter-spec-component-system-cutover.md) (D3 SSOT 재정의).

## 핵심 아키텍처

| 영역      | 기술                                                    | 비고                                                     |
| --------- | ------------------------------------------------------- | -------------------------------------------------------- |
| UI        | React 19, React-Aria Components                         | Builder ↔ Preview iframe 격리, postMessage 통신          |
| State     | Zustand 슬라이스 + TanStack Query                       | elementsMap(O(1)), childrenMap, pageIndex — Jotai 제거 완료 |
| Styling   | Tailwind CSS v4, tailwind-variants (`tv()`)             | 인라인 Tailwind 금지                                     |
| Rendering | **CanvasKit/Skia WASM**                                 | 단일 렌더러 — 화면+이벤트 통합 (ADR-900)                 |
| Layout    | 자체 Rust WASM 엔진 (packages/composition-engine, ADR-916) | Flex/Grid/Block 단일 엔진, DirectContainer 직접 배치  |
| AI        | Groq SDK (llama-3.3-70b-versatile)                      | Tool Calling + Agent Loop                                |
| Backend   | Supabase (Auth, Database, RLS)                          |                                                          |
| Build     | Vite, TypeScript 5, pnpm                                | monorepo                                                 |

### 성능 기준

| Canvas/Skia cadence                     | 초기 로드 | 번들 (초기) |
| :-------------------------------------: | :-------: | :---------: |
| native refresh target, 60Hz floor (p95) |   < 3초   |   < 500KB   |

`60fps`는 60Hz 환경의 호환성 최소선이며 성능 목표 상한이 아니다. 성능
판정은 측정 가능한 display refresh cadence와 frame time p50/p95/p99를
우선하고, FPS는 파생 지표로 기록한다.

## 공용 작업 상태

- Codex와 Claude는 `.agent/task-state.json`을 같은 작업 상태 파일로 읽습니다.
- 세션 시작과 프롬프트에 표시되는 상태를 작업 계약으로 사용하고, 작업 시작·단계 전환·검증 완료·차단 발생 때 JSON을 갱신합니다.
- `goal`, `guard`, `stop`은 사용자 승인 없이 바꾸지 않습니다. 상태 파일은 로컬 전용이며 커밋하지 않습니다.

## 작업 워크플로

- **복잡한 작업** (렌더링, drag-and-drop, 대규모 리팩토링): `architect` agent 로 접근 방식 탐색 후 선택 — 전제·관점 의문은 아래 §전제·관점 의문 처리 의 4개 결정 지점에서만 질문
- **버그 수정**: `/fix` (`debugger` agent → `/cross-check`) — 증상 수정 금지, root cause 확정 후 수정. 도메인 병인은 일반 규율이 아니라 `.claude/rules/` 의 실측 "Why" 기록이 정본
- **구현**: TDD (RED-GREEN-REFACTOR) 기본 — `tester` agent
- **렌더링 수정 후**: `/cross-check` 최종 검증
- **ADR 생성**: "ADR 생성" 자연어 → `/new-adr` (번호 자동 할당 + Risk-First 템플릿)
- **다단계 계획**: ADR design breakdown (`docs/adr/design/*-breakdown.md`) 이 정본 — 별도 계획 문서 계층 신설 금지
- **완료 직전 검증**: 아래 §완료 기준 (live behavior 게이트) 자가 적용 + `reviewer` agent
- **단순 작업** (한 줄 수정, 설정 변경): 위 절차 스킵 가능
- CRITICAL/HIGH 이슈: 즉시 수정, 스킵 금지

### 완료 기준 — test/type-check PASS 단독으로 ADR·task 종결 금지 (CRITICAL)

unit-test / type-check / codex:preflight 통과는 **"코드가 자기 자신과 정합한가"** 만 확인한다 — **live behavior (실제 builder 동작) 는 검증하지 않는다.** ADR Implemented 승격 또는 task "완료" 선언 전에 다음을 만족하지 않으면 종결 금지:

- 사용자-가시 동작 (registration / resolved-tree wiring / schema / 렌더) 이 **실제 builder 에서 작동하는지** Chrome MCP 또는 사용자 confirm 으로 1회 exercise.
- commit 검증 블록 / 완료 보고에 **무엇을 실제로 exercise 했는지** 명시 (test 개수만 나열 금지).
- **Why (ADR-144 사례, 2026-05-22)**: Wave C 가 `9 test / 50 cases PASS + type-check 0 violation + codex:preflight 통과` 로 Implemented 승격됐으나, live builder 에서 composite registration 이 "changed nothing" → closure rollback → 34 commit revert. test 검증 블록에 live behavior 항목이 0개였던 것이 근본 원인. 자동 종결은 `execute-adr` skill Phase 3 (live behavior 게이트) 경유 — 수동 종결 시 동일 게이트 자가 적용.

### 대규모 작업 phase 분할 — 단일 거대 출력 금지 (2026-07-11)

대규모 작업 (다수 파일 일괄 수정 / 전체 리팩토링 / 장문 문서 일괄 생성) 은 **phase 단위로 분할 실행**하고, 각 phase 종료 시점에 commit 가능한 상태를 유지한다:

- 하나의 응답 / 하나의 tool call 에 전체 작업을 몰아넣지 않는다 — phase 당 응답 1개, tool call 도 파일·단계 단위로 분할.
- 각 phase 완료 → 검증 → commit 후 다음 phase 진행 (CLAUDE.local.md "30분마다 WIP 커밋 분할" 원칙과 동일 방향).
- **Why (/insights 30일 진단, 2026-07-11)**: 세션 손실 주범이 tool-call 직렬화 실패 (파라미터 empty strip) + output token limit 초과 — reasoning 문제 아님 (buggy_code 20 세션 vs 잘못 이해 3 세션). 거대 단일 출력일수록 실패 확률이 높고, 실패 시 세션 전체가 손실된다. phase 분할은 손실 범위를 해당 phase 로 국한하는 유일한 사용자-측 레버. 상세: 메모리 `reference-insights-session-loss-diagnosis`.
- tool call 이 직렬화 실패로 반환되면 **같은 호출 그대로 재시도 금지** — 더 작은 단위로 쪼개서 재시도.

### 마크다운 표 편집 — 다중 Edit 대신 블록 단위 Write (2026-07-11)

정렬된 마크다운 표·정렬 의존 텍스트를 수정할 때는 여러 Edit 호출로 부분 수정하지 않는다 — 표 블록 전체 (필요 시 파일 전체) 를 Write 로 교체한다:

- **Why (/insights 30일 진단, 2026-07-11)**: Edit 의 old_string 이 공백/표 정렬 mismatch 로 반복 실패 → Python 줄 치환 우회 같은 rework 가 문서 세션 다수에서 관측됨. 표는 셀 폭 정렬 문자가 많아 Edit 정확 일치 실패 확률이 구조적으로 높다.
- **포맷터가 되돌릴 수동 정렬 작업 금지**: Prettier PostToolUse hook 이 표 정렬을 재포맷하므로, 손으로 표 압축·칸 맞춤을 다듬는 작업은 hook 이 즉시 되돌린다. 내용만 쓰고 정렬은 포맷터에 위임.

## Agent 라우팅 매트릭스

| 요청 유형         | 1차 agent   | 2차 검증             | 관련 skill / 규칙                             |
| ----------------- | ----------- | -------------------- | --------------------------------------------- |
| 새 기능/컴포넌트  | implementer | reviewer → evaluator | component-design                              |
| 버그 재현/수정    | debugger    | reviewer             | `/fix` → cross-check                          |
| 아키텍처 설계/ADR | architect   | reviewer             | create-adr / review-adr                       |
| 대규모 리팩토링   | refactorer  | reviewer             | `.claude/rules/git-workflow.md` (worktree 절차) |
| UI 실동작 검증    | evaluator   | —                    | cross-check                                   |
| 테스트 작성       | tester      | —                    | TDD (RED-GREEN-REFACTOR)                      |
| 문서 작성         | documenter  | —                    | —                                             |
| 코드베이스 탐색   | Explore     | —                    | —                                             |

## Slash Commands (표준 워크플로)

| Command          | 동작                                                      |
| ---------------- | --------------------------------------------------------- |
| `/cross-check`   | CSS↔Skia 정합성 검증                                      |
| `/new-adr`       | ADR 생성 (번호 자동 + Risk-First)                         |
| `/impl`          | brainstorm → plan → implement → review → evaluate         |
| `/fix`           | root-cause 4단계 → debugger → cross-check                 |
| `/review`        | 실행 근거 확인 → reviewer agent                           |
| `/sweep`         | parallel-verify (패밀리 일괄)                             |
| `/execute-adr`   | ADR 미완료 phase 자율 실행 (type-check + cross-check + main 직접 push) |
| `/match-target`  | 참조 이미지 vision-based 수렴 루프 (visual tuning)        |

자세한 skill 목록과 사용 빈도: [skills/INDEX.md](.claude/skills/INDEX.md)

## CRITICAL 규칙 (10개) → `.claude/rules/` 자동 로드

위반 시 즉시 수정. 파일 편집 시 glob-scoped rule이 자동 주입됩니다.
전체 목록 및 상세: [SKILL.md](.claude/skills/composition-patterns/SKILL.md)

## 상태 변경 파이프라인

`Memory → Index → History (즉시) → DB → Preview (백그라운드)` — 순서 필수 보존. 요소 순서는 canonical `children[]` 배열이 SSOT (ADR-118), `order_num` 은 export mirror 파생. 상세: `.claude/rules/state-management.md`

## CHANGELOG 관리 (CRITICAL)

`docs/CHANGELOG.md` 는 **트리거 기반 자동 갱신 대상**. 단순 구현 메모 아님 — 사용자-가시 변경의 SSOT.

**필수 반영 트리거** (같은 커밋 또는 바로 다음 커밋):

1. ADR `Accepted → Implemented` 승격
2. 사용자-가시 버그 수정 (UI/렌더/입력/저장)
3. 신규 컴포넌트/prop/public API
4. 3+ 파일 아키텍처 변경, Breaking Change, 성능 회귀 수정
5. Phase 다단계 작업 완결

**Drift 감시**: 세션 시작 후 첫 커밋 작업 전 — 최근 CHANGELOG 엔트리 날짜 확인. **14일 초과 또는 100 커밋 초과 drift** 발견 시 일반 엔트리 추가 전에 **catch-up 블록** 먼저 작성 제안. 개별 커밋 나열 금지 — ADR/주제별 bundle.

**면제**: typo / 주석 / 내부 리팩터 / 테스트만 / stats / hook 설정 튜닝.

전체 포맷 / Catch-up 절차 / 금지 패턴 / 체크리스트: `.claude/rules/changelog.md` (docs/CHANGELOG.md 편집 시 자동 로드)

## 자동 품질 게이트 (Hooks)

| Hook                  | 시점             | 동작                                                               |
| --------------------- | ---------------- | ------------------------------------------------------------------ |
| **SessionStart**      | 세션 시작 시     | agent/skill 로스터 주입 + 일별 통계 + fix/revert 집계 표시(백그라운드) |
| **UserPromptSubmit**  | 프롬프트 전송 시 | 9개 키워드 카테고리 감지 → 관련 skill/agent 힌트 주입               |
| **Stop**              | 작업 완료 시     | `.ts/.tsx` 변경 시 `pnpm type-check` (실패 시 block) + fix/revert commit 가시화 |
| **PreToolUse**        | Edit/Write 전    | 보호 파일 편집 차단 (JSON permissionDecision:deny)                 |
| **PostToolUse**       | Edit/Write 후    | Prettier 자동 포맷                                                 |
| **PreCompact**        | 컨텍스트 압축 시 | 핵심 규칙 재주입                                                   |

### 사용 통계 자동화

`daily-stats-snapshot.sh` (SessionStart 백그라운드, 일 1회 → `stats/daily-log.jsonl`) 만 자동. `skills/INDEX.md` 의 usage-stats 블록은 `weekly-report.sh` / `update-index.sh` **수동 실행** 시에만 갱신 — 블록 헤더의 "갱신: YYYY-MM-DD" 가 오래됐으면 `.claude/hooks/update-index.sh 30` 직접 실행. 집계는 현존 세션 transcript grep 기반이라 단조 누적 아님. 스키마/활용 상세: `CLAUDE.local.md` §사용 통계

## 참조 체계

| 용도                 | 경로                                                                                                     | 설명                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 코드 패턴/규칙       | [SKILL.md](.claude/skills/composition-patterns/SKILL.md)                                                 | 전체 규칙 인덱스 (CRITICAL/HIGH/MEDIUM)                                               |
| 도메인 규칙          | [.claude/rules/](.claude/rules/)                                                                         | Glob-scoped — 해당 파일 작업 시 자동 로드                                             |
| Agent 가이드         | [.claude/agents/](.claude/agents/)                                                                       | architect, implementer, evaluator, reviewer, debugger, documenter, refactorer, tester |
| ADR 현황             | [docs/adr/README.md](docs/adr/README.md)                                                                 | 전체 ADR 현황 대시보드                                                                |
| ADR 규칙             | [.claude/rules/adr-writing.md](.claude/rules/adr-writing.md)                                             | Risk-First 템플릿, 위험 평가, 금지 패턴, 반복 패턴 선차단 체크리스트 (`docs/adr/**` 자동 로드) |
| CHANGELOG 규칙       | [.claude/rules/changelog.md](.claude/rules/changelog.md)                                                 | 트리거 기반 자동 갱신, Drift 감시, 14일/100 커밋 catch-up, Keep a Changelog 포맷 (`docs/CHANGELOG*` 자동 로드) |
| CHANGELOG 본문       | [docs/CHANGELOG.md](docs/CHANGELOG.md)                                                                   | 현재 엔트리 — 연도별 아카이브 (`CHANGELOG-YYYY-archived.md`) 로 이관                  |
| ADR 리뷰 저장소      | [docs/adr/reviews/](docs/adr/reviews/)                                                                   | Layer 0 Observation — `review-adr` Phase 4.5 자동 영속화, 9-taxonomy 구조화 (`writer.mjs`/`validate.mjs`) |
| 렌더링 아키텍처 결정 | [ADR-900](docs/adr/completed/900-unified-skia-rendering-engine.md)                                       | Unified Skia Engine — PixiJS 제거, 대안/결정/Gate                                     |
| 렌더링 구현 상세     | [ADR-900 breakdown](docs/adr/design/900-unified-skia-engine-breakdown.md)                                    | SceneGraph, Rust Layout, CSS3 렌더링 Phase 상세                                       |
| 컴포넌트 스펙        | [COMPONENT_SPEC.md](docs/COMPONENT_SPEC.md)                                                              | Spec 단일 소스 아키텍처                                                               |
| CSS 상세             | [CSS_ARCHITECTURE.md](docs/features/completed/CSS_ARCHITECTURE.md)                                       | ITCSS + tv() 스타일링 상세                                                            |
| CSS 자동 생성        | [docs/adr/completed/036-spec-first-single-source.md](docs/adr/completed/036-spec-first-single-source.md) | Spec → CSS 자동 생성, Archetype, CompositionSpec                                      |
| Spec↔CSS 경계        | [SPEC_CSS_BOUNDARY.md](docs/reference/components/SPEC_CSS_BOUNDARY.md)                                   | Leaf(Spec CSS) vs Container(수동 CSS) 분류표, 결정 흐름도                             |

## 마이그레이션/리네임/삭제 작업 원칙 (CRITICAL)

- **원본 파일 삭제는 명시적 승인 필요**: 사용자의 "ok", "좋아", "진행해" 같은 **일반적 동의는 삭제 승인이 아님**. 삭제 전 반드시 "원본 파일 `X`를 삭제해도 되나요?"로 별도 확인
- 마이그레이션 중: 원본은 사용자가 검증 완료를 명시할 때까지 유지
- 대규모 파일 이동/리네임: 새 경로 생성 → 검증 → (사용자 승인 후) 원본 삭제 — 3단계 분리

## Git Push 정책 (CRITICAL — 로컬 작업 환경 절대 정책)

**web PR 자체 금지. 예외 없음.** default 흐름 = `git add -A` → `git commit` → `git push origin main`. `gh pr create` / branch 분기 push / PR URL 출력은 **사용자 명시 요청 시에만**. "안전 차원에서 PR" / "CRITICAL 이라 PR" / "worktree 라 PR 자연" — 전부 틀림. worktree 통합도 일반 `git merge` + main push 로 충분. main push 차단 시 자동 branch 우회 절대 금지 — 사용자에게 직접 실행 요청 (`! git push origin main`).

상세 정책 / 위반 이력 (8회+) / worktree 통합 절차 정본: `.claude/rules/git-workflow.md` (상시 로드)

## 렌더링 버그 수정 원칙

2개 렌더링 타겟(CSS/Skia) × 5개 레이어(spec/factory/CSS renderer/Skia renderer/editor). — PixiJS 제거 완료 (ADR-900 Phase 8-9)

- **모든 경로 검증**: 한 경로만 수정하고 다른 경로 누락 금지 → `/cross-check` 스킬로 검증
- **전체 경로 추적**: factory → spec → renderer → editor 하류 파손 확인
- **배치 스윕**: 동일 패턴 이슈 → codebase grep → 한 번에 수정
- **과잉 변경 금지**: 요청 범위만 수정
- 상세: `.claude/rules/canvas-rendering.md` (파일 편집 시 자동 로드)

## 병렬 워크플로 (Boris 패턴)

- 대규모 리팩토링: `isolation: "worktree"`로 격리된 에이전트 실행
- 독립 작업 2+ 개: Agent tool 병렬 호출로 동시 실행 (단일 응답에 복수 agent)
- reviewer + implementer 분리: 구현 에이전트 완료 후 reviewer 에이전트로 검증
- **worktree 통합은 main 직접 merge** (PR 경유 금지): `git merge <worktree-branch>` → `git push origin main` → `git worktree remove`. 상세: `.claude/rules/git-workflow.md`
- `/loop` 활용: 렌더링 파리티 반복 검증에 적합

---

**마지막 지침**:
항상 **Plan 먼저 → Execute → Verify (`/cross-check` + `type-check`)** 순서를 지킨다.
불확실한 부분이 아래 "전제·관점 의문 처리" 의 4개 결정 지점에 해당하면 질문을 먼저 한다. 그 외의 불확실성은 가정 대신 코드·문서 실측으로 해소한 뒤 자율 진행 + 사후 보고한다 (2026-07-11 한정 — 무조건부 "질문 먼저" 는 종결 계약과 충돌).

**응답·문서 어휘 규칙 — 의회적·영어 은어 표현 회피 (CRITICAL)**:

모든 한국어 응답·새 문서·커밋 메시지에서 아래 표현을 대체어로 교체한다. **이 규칙 자체가 금지 어휘 source 가 되지 않도록** 규칙 본문도 대체어를 사용한다 (모델은 system prompt 어휘를 모방하므로, 규칙에 금지어가 다수 등장하면 응답에서 그대로 재현됨 — 메모리 1개로는 source 오염을 못 이긴다는 것이 2026-05-31 실측 결론).

**선택 순서 (3단계 — 표보다 상위 원칙)**:

1. 뜻이 맞는 **자연스러운 한국어**가 있으면 그것을 쓴다 (실행 / 동작 / 발생 / 호출 / 반영 / 저장).
2. 딱 맞는 한국어가 없는 기술 용어면 **영어 원어를 그대로** 쓴다 — `fire` / `trigger` / `emit` / `dispatch` / `throttle`. 한영 혼용이라도 뜻이 정확히 전달되므로 3번보다 낫다.
3. **한자 발음만 빌린 직역 조어는 금지** — 발화 / 발효 / 적재 / 오독 같은 형태. 한국어 사전 뜻과 어긋나 1·2번보다 항상 나쁘다.

아래 표의 항목은 전부 1번이 존재하는 경우라 1번을 쓴다 — "framing / land" 도 1번이 있으므로 영어 원어 사용이 허용되지 않는다. 2번은 1번이 실제로 없을 때만 열린다.

| ❌ 금지 (축약/의회적/영어 은어) | ✅ 대체 (자연스러운 한국어) |
| --- | --- |
| "별 ADR / 별 작업 / 별 세션 / 별 영역" | "별도 ADR / 별도 작업 / 다른 세션 / 별도 영역" |
| "발의 / ADR 발의 / 신 ADR 발의" | "작성 / 제안 / 추가 / 새 ADR 작성" |
| "framing / framing 검증 / framing 의문" | "관점 / 전제 / 문제 정의" (문맥별) — "관점 검증 / 전제 검증 / 관점 의문" |
| "framing checkpoint / baseline framing" | "관점 점검 / 전제 점검" — "선행 ADR 의 전제 / 기준 관점" |
| "reframing" | "재정의 / 관점 재설정" |
| "land / land 하다 / 한 커밋에 land" | "반영 / 적용 / 추가 / 커밋 / 확정 / 완료 / 도입" (문맥별) |
| "plan-only land" | "설계 문서만 추가 (구현은 이후 단계)" |
| "발효 / catalog 발효 / X 발효 가능 / 발효 후보 / 발효 패턴" | "전환 / 적용 / 도입 / 이관 완료" (문맥별) — "catalog 전환 / 전환 가능 / 전환 후보 / 전환 패턴" |
| "적재 / 메모리에 적재 / 메모리 적재" | "저장 / 기록 / 추가 — 메모리에 저장 / 메모리에 기록" |
| "오독 / stale 오독 / 블록 오독" | "잘못 읽음 / 잘못 이해 / 잘못 읽었다" (문맥별) |
| "발안 / ADR 발안" | "제안 / 안 작성" |
| "발화 / 게이트 발화 / 트리거 발화 / 단축키 발화 / 이벤트 발화 / 사용자 발화" | "실행 / 동작 / 호출 / 발생 / 입력" (문맥별) — "게이트가 동작 / 트리거 실행 / 단축키가 동작 / 이벤트 발생 / 사용자 입력·메시지". 한국어가 어색해지는 자리는 원어 `fire` / `trigger` 를 그대로 |

**Why**: "별" 단독은 부정 어감("별 일 없다"), "발의/발안"은 의회/법안 어감으로 기술 문서에 과잉, "framing/land"는 한영 혼용으로 가독성 저하, **"발효(發效)"는 법령·조약이 효력을 발생시킨다는 어감이라 catalog/spec 전환 같은 코드 작업에 과잉·부정합** (반복 지적에도 표 미등록 탓에 차단 안 되던 항목 — 2026-06-11 추가), **"적재(積載)"는 화물을 싣는다는 뜻이라 메모리에 정보를 저장하는 맥락에 부정합, "오독(誤讀)"은 딱딱한 한자어로 "잘못 읽음"이 자연스러움** (2026-06-20 사용자 지적 — "문맥에 맞지 않는 뜻에만 의존한 한자어 사용하지마"). **"발화"는 한국어로 불이 붙는다(發火) 또는 언어학의 말하기(發話) 두 뜻뿐이라, hook·게이트·단축키·이벤트가 "실행된다"는 의미가 아예 없다 — 영어 fire/trigger 의 직역이고 한자 발음만 한국어인 조어** (2026-08-27 사용자 지적 — "한국어에 '발화' 는 한문식 발음기호만 한국어다"). **대체 방향은 "한국어냐 영어냐"가 아니라 "뜻이 맞느냐"다 — 한국어가 어색해지면 원어가 정답이고, 한자 조어는 어느 쪽도 아니다** (2026-08-27 사용자 지적 — "자연스러운 한국어로 나오게 하던가, 그것이 어렵다면 원어인 fire/trigger 를 사용하는 것이 더 문맥상 맞다"). 예외는 3가지 — 외부 고유명사(AISI `reframing` 등) 영문 병기, 이 표 안의 인용, 위 선택 순서 2번에 해당하는 원어 기술 용어. 그 외 표의 금지 어휘는 본문 사용 금지. 발견 시 즉시 교체 (별도 reminder 없음). 본 규칙은 composition 외 다른 프로젝트에도 동일 적용.

---

**전제·관점 의문 처리 — 결정 지점 한정 (CRITICAL, 2026-07-11 재조정)**:

> 구 버전 (Opus 4.8 literal instruction following 보정) 은 질문 의무 범위가 넓어 리뷰 승인된 ADR 구현 중에도 질문·재검토 루프가 반복됐다 (reviews/912=16 round, 913=11 round 실측). 현행 모델 (Fable 5) 은 자율 운영이 기본값이므로, 질문 의무를 아래 4개 결정 지점으로 한정하고 전제 확정의 종결 상태를 정의한다. AISI sycophancy research 의 관점 재설정 질문 패턴은 결정 지점 안에서 유지.

**AskUserQuestion 의무 — 이 4개 결정 지점에서만**:

1. ADR fork / 분리 / 통합 결정
2. ADR 간 의존 방향 반전 (base ↔ 응용 재분류)
3. SSOT 경계 재판정 (D1/D2/D3 소속 변경)
4. 사용자가 승인한 scope 자체의 변경 (방향 전환 / 대폭 확장·축소)

호출 규약 (유지): 의문문 형식 (statement 금지) + 차단 카테고리 메모리 (no-derived-adr-mid-execution / execute-adr-surface-minimization / consolidation-burden / pr-vs-direct-push / settings-precedence) 의 차단 사유 1줄 인용. 사용자 응답 받기 전 새 ADR 작성 / fork / sub-group 분할 절대 금지.

**질문 금지 — 자율 진행 대상**:

- 리뷰 승인된 ADR 의 phase 실행 중 통상적 구현 판단 (파일 범위 / 테스트 구성 / 작업 순서)
- 추정 vs 실측 gap — adr-writing.md M3 원칙대로 본 ADR 안 Phase 0 inventory 보강으로 흡수 (절차 결함이지 전제 재검토 trigger 아님)
- 이미 확정된 전제의 재질문 (아래 종결 계약)

**전제 확정 종결 계약 (terminal state — CRITICAL)**: 다음 중 하나가 성립하면 해당 ADR 의 전제·관점은 **확정**이며, scope 무변경인 한 구현 전 과정 (execute-adr 포함) 에서 재질문·재검토 금지:

1. `docs/adr/reviews/{NNN}.md` (Layer 0) 최신 round 가 이슈 0건, 또는 모든 이슈 outcome 이 종결 상태 (`fixed`/`deferred`/`rejected` — `pending` 0건) 이고 CRITICAL/HIGH 는 전부 `fixed` (승인 가능 결론). **"전부 fixed" 단독 기준 금지** — writer outcome 스키마 4종 (fixed|deferred|rejected|pending) 과 불일치해, LOW 이슈가 `deferred`/`rejected` 로 종결된 실질 승인 ADR (ADR-146 round 6 실측) 을 미확정으로 잘못 판정한다 (2026-07-11 정정)
2. ADR 본문/design breakdown 의 fork checkpoint 4 질문 lock-in + 사용자 confirm 기록

확정은 세션 경계로 소멸하지 않는다 — 기록이 confirm 의 지속 형태다. 재개 조건은 3개뿐: (a) 사용자 재제기, (b) scope 자체 변경, (c) 의존 방향 반전의 코드 증거 발견. 이때만 위 4개 결정 지점 절차로 복귀한다.

**본질 사고 작업은 깊은 사고(adaptive thinking) 명시 진입 (CRITICAL)**: 위 4개 결정 지점의 사고 작업은 표면 답변 (plan→execute→done 사이클) 회피하고 깊은 사고 모드로 진입한다 (effort=xhigh 가 reasoning 깊이 보장; adaptive 라 단순 턴엔 발동 안 함). tool 호출로 outsource 금지 — codex review / cross-check skill 은 본문 정합 layer 일 뿐 전제·관점 layer 아님. 결정 지점에서는 절차 컴플라이언스 (Risk 표 / Gate 매핑 / type-check PASS / codex review PASS) 통과가 사용자 confirm 을 대체하지 못한다.
```
