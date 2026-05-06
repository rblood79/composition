# composition - Claude Code Context

composition는 **노코드 웹 빌더** 애플리케이션입니다 (pnpm monorepo).

> **⚠️ 필수**: 코드 작업 시작 전 반드시 `.claude/skills/composition-patterns/SKILL.md`를 읽으세요.

## Quick Start

```bash
pnpm dev          # 개발 서버
pnpm build        # 빌드
pnpm type-check   # 타입 체크
pnpm storybook    # Storybook
```

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
│ ├── config/ # 공유 설정 (ESLint, TypeScript)
│ ├── layout-flow/ # Taffy WASM 레이아웃 엔진
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

composition은 3개 독립 domain으로 구성된다. 모든 코드/문서 작업은 이 분할을 준수:

| Domain | 권위 | 내용 | Spec 관여 |
| --- | --- | --- | --- |
| **D1. DOM/접근성** | Adobe RAC (절대) | HTML 구조/ARIA/키보드/포커스 | ❌ 금지 |
| **D2. Props/API** | RSP 참조 + custom | 사용자 편의 props | ✅ 타입만 |
| **D3. 시각 스타일** | Spec (SSOT) | 색상/크기/폰트/레이아웃/형태 | ✅ 100% |

**원칙**:
- **Builder(Skia)와 Preview/Publish(DOM+CSS)는 D3의 대등 symmetric consumer**. 한쪽이 기준 아님
- 대칭 = **시각 결과의 동일성** (구현 방법 자유)
- RAC 선택 이유 = 스타일 자유도 (unstyled primitive) — 디자인은 D3에서 composition이 결정
- RSP props는 RAC + custom 구현으로 달성 가능한 범위에서 선별 채택

**정본 규칙**: [.claude/rules/ssot-hierarchy.md](.claude/rules/ssot-hierarchy.md) (3-domain 정의/용어 사전/경계 판정/집행 메커니즘)
**공식 결정 기록**: [ADR-063](docs/adr/063-ssot-chain-charter.md)

## 핵심 아키텍처

| 영역      | 기술                                                    | 비고                                                     |
| --------- | ------------------------------------------------------- | -------------------------------------------------------- |
| UI        | React 19, React-Aria Components                         | Builder ↔ Preview iframe 격리, postMessage 통신          |
| State     | Zustand 슬라이스 + Jotai (스타일 패널) + TanStack Query | elementsMap(O(1)), childrenMap, pageIndex                |
| Styling   | Tailwind CSS v4, tailwind-variants (`tv()`)             | 인라인 Tailwind 금지                                     |
| Rendering | **CanvasKit/Skia WASM** (렌더링) + PixiJS 8 (이벤트)    | Dual Renderer — Skia=화면, PixiJS=EventBoundary(alpha=0) |
| Layout    | Taffy WASM (Flex/Grid/Block)                            | 단일 엔진, DirectContainer 직접 배치                     |
| AI        | Groq SDK (llama-3.3-70b-versatile)                      | Tool Calling + Agent Loop                                |
| Backend   | Supabase (Auth, Database, RLS)                          |                                                          |
| Build     | Vite, TypeScript 5, pnpm                                | monorepo                                                 |

### 성능 기준

| Canvas FPS | 초기 로드 | 번들 (초기) |
| :--------: | :-------: | :---------: |
|   60fps    |   < 3초   |   < 500KB   |

## Superpowers 워크플로

- **복잡한 작업** (렌더링, drag-and-drop, 대규모 리팩토링): Brainstorming 스킬로 접근 방식 탐색 후 선택
- **버그 수정**: Systematic Debugging 4단계 root-cause 스킬
- **구현**: TDD (RED-GREEN-REFACTOR) 사이클 기본
- **렌더링 수정 후**: `/cross-check` 스킬 최종 검증
- **ADR 생성**: "ADR 생성" 자연어 → `/new-adr` 스킬 (번호 자동 할당 + Risk-First 템플릿)
- **단순 작업** (한 줄 수정, 설정 변경): 스킬 스킵 가능
- CRITICAL/HIGH 이슈: 즉시 수정, 스킵 금지

## Agent 라우팅 매트릭스

| 요청 유형          | 1차 agent    | 2차 검증                | 관련 skill                             |
| ------------------ | ------------ | ----------------------- | -------------------------------------- |
| 새 기능/컴포넌트   | implementer  | reviewer → evaluator    | brainstorming → component-design       |
| 버그 재현/수정     | debugger     | reviewer                | systematic-debugging → cross-check     |
| 아키텍처 설계/ADR  | architect    | reviewer                | create-adr / review-adr                |
| 대규모 리팩토링    | refactorer   | reviewer                | using-git-worktrees                    |
| UI 실동작 검증     | evaluator    | —                       | cross-check                            |
| 테스트 작성        | tester       | —                       | test-driven-development                |
| 문서 작성          | documenter   | —                       | —                                      |
| 코드베이스 탐색    | Explore      | —                       | —                                      |

## Slash Commands (표준 워크플로)

| Command         | 동작                                                      |
| --------------- | --------------------------------------------------------- |
| `/cross-check`  | CSS↔Skia 정합성 검증                                      |
| `/new-adr`      | ADR 생성 (번호 자동 + Risk-First)                         |
| `/impl`         | brainstorm → plan → implement → review → evaluate         |
| `/fix`          | systematic-debugging → debugger → cross-check             |
| `/review`       | verification-before-completion → reviewer agent           |
| `/sweep`        | parallel-verify (패밀리 일괄)                             |

자세한 skill 목록과 사용 빈도: [skills/INDEX.md](.claude/skills/INDEX.md)

## CRITICAL 규칙 (10개) → `.claude/rules/` 자동 로드

위반 시 즉시 수정. 파일 편집 시 glob-scoped rule이 자동 주입됩니다.
전체 목록 및 상세: [SKILL.md](.claude/skills/composition-patterns/SKILL.md)

## 상태 변경 파이프라인

`Memory → Index → History (즉시) → DB → Preview → Rebalance (백그라운드)` — 순서 필수 보존. 상세: `.claude/rules/state-management.md`

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
| **SessionStart**      | 세션 시작 시     | agent/skill 로스터 주입 + 일별 통계 스냅샷(백그라운드)             |
| **UserPromptSubmit**  | 프롬프트 전송 시 | 9개 키워드 카테고리 감지 → 관련 skill/agent 힌트 주입               |
| **Stop**              | 작업 완료 시     | `.ts/.tsx` 변경 있으면 `pnpm type-check` — 실패 시 JSON decision:block |
| **SubagentStop**      | 서브에이전트 종료 | `agent_type/agent_id`를 `stats/agents.jsonl` 기록 (2.1.x payload)  |
| **PreToolUse**        | Edit/Write 전    | 보호 파일 편집 차단 (JSON permissionDecision:deny)                 |
| **PostToolUse**       | Edit/Write 후    | Prettier 자동 포맷                                                 |
| **PreCompact**        | 컨텍스트 압축 시 | 핵심 규칙 재주입                                                   |

### 사용 통계 자동화

| 스크립트                        | 호출 시점                 | 역할                                                          |
| ------------------------------- | ------------------------- | ------------------------------------------------------------- |
| `daily-stats-snapshot.sh`       | SessionStart (백그라운드) | 하루 1회 누적 스냅샷 → `stats/daily-log.jsonl`                |
| `update-index.sh`               | weekly-report.sh 종료 시  | `skills/INDEX.md` 하단 사용 빈도 블록 자동 갱신               |
| `weekly-report.sh [days]`       | 수동 실행                 | 주간 리포트 + INDEX.md 갱신                                    |

로그 파일:
- `stats/agents.jsonl` — SubagentStop 2.1.x 스키마 (`agent_type/agent_id/session_id`)
- `stats/agents.legacy.jsonl` — 구 스키마 183건 (참고용 보존)
- `stats/daily-log.jsonl` — 일별 누적 (`date/sessions/turns/skills/agents`)

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
| 렌더링 아키텍처 결정 | [ADR-100](docs/adr/100-unified-skia-rendering-engine.md)                                                 | Unified Skia Engine — PixiJS 제거, 대안/결정/Gate                                     |
| 렌더링 구현 상세     | [ADR-100 breakdown](docs/adr/design/100-unified-skia-engine-breakdown.md)                                    | SceneGraph, Rust Layout, CSS3 렌더링 Phase 상세                                       |
| 컴포넌트 스펙        | [COMPONENT_SPEC.md](docs/COMPONENT_SPEC.md)                                                              | Spec 단일 소스 아키텍처                                                               |
| CSS 상세             | [CSS_ARCHITECTURE.md](docs/reference/components/CSS_ARCHITECTURE.md)                                     | ITCSS + tv() 스타일링 상세                                                            |
| CSS 자동 생성        | [docs/adr/completed/036-spec-first-single-source.md](docs/adr/completed/036-spec-first-single-source.md) | Spec → CSS 자동 생성, Archetype, CompositionSpec                                      |
| Spec↔CSS 경계        | [SPEC_CSS_BOUNDARY.md](docs/reference/components/SPEC_CSS_BOUNDARY.md)                                   | Leaf(Spec CSS) vs Container(수동 CSS) 분류표, 결정 흐름도                             |

## 마이그레이션/리네임/삭제 작업 원칙 (CRITICAL)

- **원본 파일 삭제는 명시적 승인 필요**: 사용자의 "ok", "좋아", "진행해" 같은 **일반적 동의는 삭제 승인이 아님**. 삭제 전 반드시 "원본 파일 `X`를 삭제해도 되나요?"로 별도 확인
- 마이그레이션 중: 원본은 사용자가 검증 완료를 명시할 때까지 유지
- 대규모 파일 이동/리네임: 새 경로 생성 → 검증 → (사용자 승인 후) 원본 삭제 — 3단계 분리

## Git Push 정책 (CRITICAL — 로컬 작업 환경 절대 정책)

> **2026-04-27 강화**. 사용자 자동화 흐름 차단 방지가 본질 — 자세한 배경/위반 이력은 `.claude/rules/git-workflow.md` 참조.

**web PR 자체 금지. 예외 없음.**

- ✅ **default 흐름**: `git add -A` → `git commit` → `git push origin main`
- ❌ `gh pr create` / web UI PR — 절대 금지
- ❌ `git checkout -b feature/...` 분기 후 push — 사용자 명시 요청 시에만
- ❌ `git push -u origin <branch>` — 사용자 명시 요청 시에만
- ❌ PR URL 출력 (`https://github.com/.../pull/new/...`) — 금지
- ❌ "안전 차원에서 PR" / "CRITICAL 이라 PR" / "worktree 라 PR 자연" — 모두 **틀림**

**worktree 작업도 PR 불필요**: branch 분기 + commit 까지가 격리 가치, main 통합은 일반 `git merge` + `git push origin main` 으로 충분.

**main push 차단 시**: 자동 branch 우회 절대 금지. 사용자에게 직접 실행 요청 (`! git push origin main`) 또는 권한 부여 안내.

상세 정책 / 위반 이력 / worktree 통합 절차: `.claude/rules/git-workflow.md`

## 렌더링 버그 수정 원칙

2개 렌더링 타겟(CSS/Skia) × 5개 레이어(spec/factory/CSS renderer/Skia renderer/editor). — PixiJS 제거 완료 (ADR-100 Phase 8-9)

- **모든 경로 검증**: 한 경로만 수정하고 다른 경로 누락 금지 → `/cross-check` 스킬로 검증
- **전체 경로 추적**: factory → spec → renderer → editor 하류 파손 확인
- **배치 스윕**: 동일 패턴 이슈 → codebase grep → 한 번에 수정
- **과잉 변경 금지**: 요청 범위만 수정
- 상세: `.claude/rules/canvas-rendering.md` (파일 편집 시 자동 로드)

## 병렬 워크플로 (Boris 패턴)

- 대규모 리팩토링: `isolation: "worktree"`로 격리된 에이전트 실행
- 독립 작업 2+ 개: `/dispatch` 스킬로 병렬 에이전트 실행
- reviewer + implementer 분리: 구현 에이전트 완료 후 reviewer 에이전트로 검증
- **worktree 통합은 main 직접 merge** (PR 경유 금지): `git merge <worktree-branch>` → `git push origin main` → `git worktree remove`. 상세: `.claude/rules/git-workflow.md`
- `/loop` 활용: 렌더링 파리티 반복 검증에 적합

---

**마지막 지침**:
항상 **Plan 먼저 → Execute → Verify (`/cross-check` + `type-check`)** 순서를 지킨다.
불확실한 부분은 질문을 먼저 하고, 가정하지 않는다.

**framing 의문은 raise 의무 (CRITICAL)**: ADR base/응용 분류, 의존 방향, SSOT 경계, baseline framing 자동 승계 같은 본질 framing 에 의문이 들면 사용자 마찰을 만들어도 무조건 raise 한다. push-back 회피 (sycophancy default) 시 본질 손실 (예: ADR-111/112 24+ commits 우회) 이 마찰 비용보다 압도적으로 크다. 절차 컴플라이언스 (Risk 표 / Gate 매핑 / type-check PASS) 통과해도 framing 위반은 잡히지 않는다.

**본질 사고 작업은 extended thinking 명시 진입 (CRITICAL)**: ADR fork / 분리 / 의존 방향 결정 / SSOT 경계 판정 / 대안 base/응용 분류 같은 framing 사고 작업은 표면 답변 (plan→execute→done 사이클) 회피하고 깊은 사고 모드로 진입한다. tool 호출로 outsource 금지 — codex review / cross-check skill 은 본문 정합 layer 일 뿐 framing layer 아님. token 효율 학습 압력 우회는 vendor 자체 가이드 정렬 방향.
```
