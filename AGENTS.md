# Repository Guidelines

composition 협업을 위한 Codex 실행 계약입니다. 이 파일은 항상 읽히는
최소 지침만 둡니다. 세부 규칙은 필요한 경우에만 `.agents/`에서 선택해
읽으세요.

## 응답 언어

- 코드 블록을 제외한 모든 답변은 한국어로 작성합니다.
- 결과와 핵심 근거를 먼저 설명하고, 변경 이유·검증·남은 한계를 짧게 연결합니다.
  표와 목록은 비교나 순서가 있을 때 사용하고, 반복적인 요약·과도한 강조는 피합니다.

## 실행과 완료

- 구현·수정 요청은 실행 지시로 해석하고, 요청 범위의 구현과 검증까지 진행합니다.
  이미 승인된 작업의 단계 전환마다 다시 승인을 요구하지 않습니다.
- 일반적인 구현 선택은 현재 코드와 사용자 의도에 근거해 결정하고 중요한 가정만
  짧게 알립니다. 결과를 크게 바꿀 누락 정보나 새로운 권한이 필요할 때 질문합니다.
  답변과 무관하게 진행할 수 있는 조사·준비 작업은 먼저 완료합니다.
- 분석·리뷰 요청은 조사와 판정까지입니다. 수정 요청이 함께 있으면 발견한 문제의
  범위 내 수정도 완료합니다. Git·외부 게시·보호 파일은 아래의 명시적 경계를 따릅니다.
- 작업 중 추가 메시지는 기존 목표에 반영합니다. 상태 질문에 답한 뒤 작업을
  이어가며, 명시적 취소나 목표 교체가 있을 때만 기존 작업을 중단합니다.
- 서브에이전트는 사용자가 위임·병렬 작업을 명시한 경우에만 사용합니다.
  위임 시 파일 소유권·완료 기준을 지정하고 다른 작업자의 변경을 보존합니다.
- 같은 실패가 반복되면 근거를 추가로 수집하고 접근을 바꿉니다. 새 권한이나
  필수 정보 없이는 진행할 수 없을 때 시도·실패 원인·필요한 입력을 보고합니다.

## 컨텍스트 사용 원칙

- 우선순위: `AGENTS.md` → `.agents/README.md` → 필요한 skill/rule 파일.
  이는 읽기 순서입니다. 명시적인 사용자 요청과 기존 승인은 skill의 일반 지침보다
  우선하며, 시스템·개발자 지침과 실제 도구 권한 경계는 유지합니다.
- `.agents/README.md`는 harness·라우팅이 필요할 때 열고, 일반 코드 수정은
  관련 skill/rule만 좁게 엽니다.
- skill/rule 정본은 `.claude/` 입니다 (2026-08-18 단일화). `.agents/skills/*`
  와 `.agents/rules/*` 는 정본으로의 심링크 미러이므로 어느 경로로 읽어도
  같은 내용입니다. Codex 전용 파일은 `.agents/rules/goal-lifecycle.md` 와
  `.agents/README.md` 등 실파일만 해당합니다.
- `dist/`, 생성물, 사용자 변경 파일은 요청 없이 수정하지 않습니다.
- 독립적인 검색·읽기는 묶어서 실행하고, 읽은 내용을 이유 없이 다시 읽지 않습니다.
  오래된 이력은 현재 코드·작업 상태·실측 결과와 구분합니다.
- skill 때문에 승인 요청·중단·미완료가 발생하면 실제 읽은 `SKILL.md` 경로와
  해당 문구를 인용하고, 명시적 요구인지 자신의 해석인지 설명합니다.
- 메모리 영속 저장은 사용자가 요청했을 때만 수행합니다. Claude 전용 자동 메모리
  절차를 Codex 메모리 쓰기 권한으로 해석하지 않습니다.

## 공용 작업 상태

- Codex와 Claude는 `.agent/task-state.json`을 현재 작업의 공용 상태로 사용합니다.
- 세션 시작과 사용자 프롬프트마다 주입되는 상태를 먼저 읽고, 작업 시작·단계 전환·검증 완료·차단 발생 시 JSON을 갱신합니다.
- `goal`, `guard`, `stop`은 사용자 승인 없이 바꾸지 않습니다. 상태 파일은 로컬 전용이며 커밋하지 않습니다.

## 프로젝트 구조

- `apps/builder`: 핵심 Builder UI, 패널, 인스펙터, 캔버스 브리지.
- `apps/publish`: publish/runtime 경로.
- `packages/specs`: component spec, CSS generation, spec SSOT.
- `packages/shared`: 공용 컴포넌트, CSS, renderer 계약.
- `packages/composition-engine`: Rust 레이아웃 엔진 (wasm-pack 산출물은 gitignored — `pnpm wasm:build:engine`).
- `docs/`: ADR, 설계, 운영 문서. `docs/CHANGELOG.md`는 사용자-가시 변경의
  SSOT입니다.
- `scripts/codex`: Codex harness와 품질 게이트.

## Codex Harness

Node/Turbo/pnpm 작업은 repo root에서 `pnpm` 스크립트로 실행합니다.
`scripts/codex/env.sh`는 `mise`가 있으면 `mise hook-env`를 활성화합니다.

- 세션 점검: `pnpm run codex:session-start`
- 라우팅 힌트: `pnpm run codex:route -- "<요청>"`
- 인수인계 스냅샷: `pnpm run codex:snapshot`
- 보호 파일 점검: `pnpm run codex:guard`
- 변경 파일 포맷: `pnpm run codex:format`
- TS 변경 시 type-check: `pnpm run codex:typecheck`
- 완료 전 기본 게이트: `pnpm run codex:preflight`
- 단일 진입점: `pnpm run codex:harness -- help`

Claude식 프로젝트 훅(`SessionStart`, `UserPromptSubmit`, `PreCompact`)과
Codex harness를 혼동하지 않습니다. 공용 상태 주입은 전역 Codex/Claude 훅으로
연결되어 있지만, 프로젝트 품질 게이트와 상태 갱신은 여전히 위 harness와
작업 흐름에 따라 명시적으로 실행합니다.

## 구현 규칙

- TypeScript + React 19 함수 컴포넌트, 2칸 들여쓰기, named export를
  기본으로 합니다.
- 비-trivial 작업은 구현 전에 해석, 가정, 성공 기준을 짧게 드러냅니다.
  모호한 요구를 조용히 확정하지 말고, 단순 작업은 이 절차를 가볍게 적용합니다.
- 모든 변경 라인은 사용자 요청, 실패 재현, 또는 검증 실패 해결과 직접 연결되어야
  합니다. 무관한 dead code, 포맷, 주석, 인접 리팩토링은 요청이 없으면 보고만 하고
  수정하지 않습니다.
- 추상화, 옵션, 방어 코드는 현재 요구·재현된 실패·기존 프로젝트 패턴이 실제로
  요구할 때만 추가합니다.
- 버그 수정은 임시 방어·표시 보정·캐시 리셋으로 덮지 않고 근본 원인과
  SSOT 경로를 우선 해결합니다. 생성 → store → canonical document → DB 저장
  → refresh hydration → UI 소비 경로를 추적하고, 재발 조건은 테스트로
  고정합니다.
- Builder 상태는 기존 Zustand 모듈과 factory/helper 패턴을 재사용합니다.
  로컬 ESLint 규칙이 금지하는 그룹 selector와 `useShallow` 패턴을 피합니다.
- `apps/builder/src/preview` iframe runtime은 Builder와 격리하고, 동기화는 검증된
  `postMessage` 경로로만 수행합니다.
- 렌더링 변경은 Spec/CSS/Canvas/Preview 소비자를 함께 확인합니다.
  필요 시 `cross-check` skill을 사용합니다.
- 스타일은 `apps/builder/src/builder/styles`의 ITCSS/Tailwind 4 레이어와 token 우선
  정책을 따릅니다. 캔버스 런타임 스타일은 scope를 좁힙니다.
- 서비스/API 계층의 기존 구조화 오류 처리 패턴을 유지하고 콘솔 로그를
  최소화합니다.

## Skill / Rule 선택

- 코드 패턴·상태·렌더링 판단: `.agents/skills/composition-patterns/SKILL.md`
- 새 컴포넌트 설계/구현: `.agents/skills/component-design/SKILL.md`
- 렌더링 경로 정합성: `.agents/skills/cross-check/SKILL.md`
- 웹 UI 구현/리뷰 기준: `.agents/rules/web-interface-guidelines.md`
  (명시적 UI 감사에서는 전역 `web-design-guidelines` skill로 최신 제작사 규칙 확인)
- ADR 생성/리뷰: `.agents/skills/create-adr/SKILL.md`,
  `.agents/skills/review-adr/SKILL.md`
- 병렬 검증: 사용자가 병렬/서브에이전트를 명시한 경우에만
  `.agents/skills/parallel-verify/SKILL.md`
- Macro rule index: `.agents/rules/`

## 테스트와 검증

- 변경 모듈 옆의 Vitest를 우선 추가/수정합니다.
- 테스트 범위는 바뀐 동작과 위험에 맞춥니다. 문구·설정 등 영향이 작은 변경에
  구현을 그대로 반복하는 테스트를 추가하지 않습니다. 필요한 게이트가 통과하면
  새 변경·실패·미해결 우려가 있을 때만 검증을 확대하거나 반복합니다.
- Builder 패널, 상태 동기화, Canvas/Preview 경로 변경은 store 동작과 UI
  계약을 함께 검증합니다.
- 사용자 플로우 또는 시각 동작이 바뀌면 Playwright/브라우저 검증을
  사용하고, 생략 시 이유와 재현 경로를 남깁니다.
- 완료 전에는 가능한 범위에서 `pnpm run codex:preflight`를 실행합니다.
  dirty worktree의 무관한 사용자 변경은 포맷/수정하지 않습니다.

## Git / Changelog

- 커밋 메시지는 `type: summary` 형식을 사용합니다.
- 반복 fix/revert 가시화(claude/codex 공통): `fix(scope)`/`revert(scope)` 커밋은
  `.claude/hooks/fix-visibility.sh`가 git log로 집계해 scope별 횟수·회귀 테스트
  동반 여부를 표시합니다(판정·차단 없이 표시만). 선택적으로 커밋 본문에
  `Error-Category: <design-miss|human-error|multi-event|env-tooling>` trailer를
  넣으면 분류별 집계가 가능합니다. trailer가 없어도 scope 기반으로 동작합니다.
- 사용자가 commit/push를 요청하면 기본 흐름은 `git commit` 후
  `git push origin main`입니다.
- branch 분기, web PR, `gh pr create`는 사용자가 명시적으로 요청한 경우에만
  수행합니다. 자세한 규칙은 `.agents/rules/git-workflow.md`를 따릅니다.
- `docs/CHANGELOG.md`는 사용자-가시 변경의 SSOT입니다. ADR Implemented 승격,
  사용자-가시 버그 수정, public API/spec 변경, 3개 이상 파일의 아키텍처
  변경, 성능 회귀 수정, 다단계 Phase 완결은 같은 커밋 또는 바로 다음 커밋에
  반영합니다. 자세한 규칙은 `.agents/rules/changelog.md`를 따릅니다.

## 보안

- 비밀 값은 `.env.local`에만 둡니다. `.env*`, credentials, Supabase 설정 등
  보호 파일은 사용자 승인 없이 수정하지 않습니다.
- Supabase schema/API 기대치를 바꾸기 전 `docs/supabase-schema.md`와
  `supabase/`를 확인하고 마이그레이션 범위를 명확히 합니다.
