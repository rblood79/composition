# Composition

Builder는 `apps/builder`, publish runtime은 `apps/publish`, 시각 정본은
`packages/shared/src/catalog`와 theme/tokens, 잔존 spec은 `packages/specs`,
Rust 레이아웃 엔진은 `packages/engine`, 대용량 업로드 전송 엔진 (`@composition/upload`, ADR-201)
은 `packages/upload-engine`에 있습니다.

## 작업 계약

- 구현·수정은 요청 범위의 구현, 실행 확인, 발견한 회귀 수리까지 이어갑니다.
  이미 승인된 단계와 로컬 검증은 매번 다시 승인받지 않습니다.
- 분석·리뷰만 요청되면 조사와 판정까지 수행합니다. 수정 요청이 함께 있으면
  해당 범위의 문제도 해결합니다. 위임은 사용자가 명시한 경우에만 합니다.
- 다른 작업자의 dirty 파일은 보존합니다. 변경 범위를 분리할 수 있으면
  dirty worktree에서도 진행하고, 무관한 파일을 포맷·stash·되돌리지 않습니다.
- `.agent/task-state.json`은 로컬 공용 인수인계입니다. 관련 작업의 시작·단계 전환·
  검증 완료 때 갱신하되 `goal`, `guard`, `stop`은 사용자 승인 없이 바꾸지 않습니다.
  다른 작업의 상태를 현재 사용자 요청보다 우선하지 않습니다. 커밋하지 않습니다.
- 메모리 영속 저장은 사용자 요청 시에만 합니다.

## 프로젝트 고유 계약

- `CompositionDocument`와 canonical mutation/selector가 runtime SSOT입니다.
  기존 Zustand action·factory를 재사용하며 derived mirror를 쓰기 원본으로 삼지 않습니다.
- DOM·접근성은 React Aria, Props는 Spectrum 참조와 custom 계약,
  시각은 catalog + theme/tokens가 담당합니다. Canvas와 Preview는 대등한 소비자입니다.
- Builder와 Preview iframe은 격리합니다. 동기화는 origin을 검증하는
  기존 `postMessage` 경로를 사용합니다.
- TypeScript + React 19, 함수 컴포넌트·named export·2칸 들여쓰기가 기본입니다.
  Zustand 그룹 selector와 `useShallow`는 로컬 ESLint 금지 패턴입니다.
- Builder chrome 스타일은 `apps/builder/src/builder/styles`의 ITCSS/Tailwind 4
  레이어와 token을 사용합니다. 캔버스 스타일의 scope를 좁힙니다.
- 상태 무결성 문제는 생성 → store → canonical document → DB → refresh hydration →
  UI 소비 경로에서 원인을 찾습니다. 해당 회귀 조건을 인접 테스트로 고정합니다.

## 필요한 지침과 검증

Skill/rule 정본은 `.claude/`, `.agents/skills`와 `.agents/rules`는 심링크입니다.
현재 작업에 필요한 문서만 엽니다. Codex가 Claude의 glob 규칙을 자동 로드한다고
가정하지 않습니다.

- 상태·레이아웃·렌더링 계약: `composition-patterns`의 해당 도메인 링크.
- 새 컴포넌트·S2 전환: `component-design`. Canvas/Preview 시각 변경: `cross-check`.
- ADR 작성·검토: 해당 skill과 대상 ADR. 실행은 사용자가 지정한 범위를 따릅니다.
- Harness 운영·인수인계: `.agents/README.md`.

Node/Turbo/pnpm 명령은 repo root에서 `pnpm` 스크립트로 실행합니다.
`scripts/codex/env.sh`는 mise가 있으면 활성화합니다.

- 변경 모듈의 인접 Vitest와, TS 변경 시 `pnpm run codex:typecheck`를 사용합니다.
- UI·상태 동기화·Canvas/Preview 동작이 바뀌면 실제 브라우저로 해당 흐름을
  확인합니다. 서버·탭은 현재 환경에서 찾고, 확인하지 못한 범위와 이유를 보고합니다.
- 완료 전 기본 게이트는 `pnpm run codex:preflight`입니다. 전체 dirty 파일을
  자동 포맷하므로 동시 변경이 있으면 `.agents/README.md`의 범위별 검증을 사용합니다.
  영향 없는 검사나 이미 통과한 검사는 새 근거 없이 반복하지 않습니다.

## Git·문서·보호 파일

- commit/push 요청이 있으면 명시한 파일·hunk만 stage하고 `type: summary`로 커밋한 뒤
  `git push origin main`으로 진행합니다. branch·PR은 명시 요청이 있을 때만 사용합니다.
  상세: `.agents/rules/git-workflow.md`.
- 사용자 가시 변경·public API/spec 변경·성능 회귀 수리·ADR Implemented 승격·
  다단계 Phase 완결·3개 이상 파일의 아키텍처 변경은 `docs/CHANGELOG.md`에 반영합니다.
  상세: `.agents/rules/changelog.md`.
- `.env*`, credentials, 라이선스 개인키·토큰(`public/license`,
  scripts/.auth-session.json)은 승인 없이 수정하지 않습니다.
- `dist/`와 생성물은 직접 편집하지 않고 필요한 source 변경에 맞는 생성 명령을 사용합니다.
