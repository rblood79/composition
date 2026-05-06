# Repository Guidelines

composition 협업을 위한 Codex 실행 계약입니다. 이 파일은 항상 읽히는
최소 지침만 둡니다. 세부 규칙은 필요한 경우에만 `.agents/`에서 선택해
읽으세요.

## 응답 언어

- 코드 블록을 제외한 모든 답변은 한국어로 작성합니다.

## 컨텍스트 사용 원칙

- 우선순위: `AGENTS.md` → `.agents/README.md` → 필요한 skill/rule 파일.
- `.agents/README.md`는 harness·라우팅이 필요할 때 열고, 일반 코드 수정은
  관련 skill/rule만 좁게 엽니다.
- `.claude/`는 legacy reference입니다. Codex 지시는 `AGENTS.md`와
  `.agents/*`를 우선하며, legacy 상세가 꼭 필요할 때만 링크된 파일을
  확인합니다.
- `dist/`, 생성물, 사용자 변경 파일은 요청 없이 수정하지 않습니다.

## 프로젝트 구조

- `apps/builder`: 핵심 Builder UI, 패널, 인스펙터, 캔버스 브리지.
- `apps/publish`: publish/runtime 경로.
- `packages/specs`: component spec, CSS generation, spec SSOT.
- `packages/shared`: 공용 컴포넌트, CSS, renderer 계약.
- `packages/composition-layout`: layout/wasm 계층.
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

Claude식 자동 `SessionStart`, `UserPromptSubmit`, `PreCompact`, `statusline`이
Codex에서 자동 실행된다고 가정하지 않습니다. 필요한 자동화는 위 harness로
명시적으로 실행합니다.

## 구현 규칙

- TypeScript + React 19 함수 컴포넌트, 2칸 들여쓰기, named export를
  기본으로 합니다.
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
- ADR 생성/리뷰: `.agents/skills/create-adr/SKILL.md`,
  `.agents/skills/review-adr/SKILL.md`
- 병렬 검증: 사용자가 병렬/서브에이전트를 명시한 경우에만
  `.agents/skills/parallel-verify/SKILL.md`
- Macro rule index: `.agents/rules/`

## 테스트와 검증

- 변경 모듈 옆의 Vitest를 우선 추가/수정합니다.
- Builder 패널, 상태 동기화, Canvas/Preview 경로 변경은 store 동작과 UI
  계약을 함께 검증합니다.
- 사용자 플로우 또는 시각 동작이 바뀌면 Playwright/브라우저 검증을
  사용하고, 생략 시 이유와 재현 경로를 남깁니다.
- 완료 전에는 가능한 범위에서 `pnpm run codex:preflight`를 실행합니다.
  dirty worktree의 무관한 사용자 변경은 포맷/수정하지 않습니다.

## Git / Changelog

- 커밋 메시지는 `type: summary` 형식을 사용합니다.
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
