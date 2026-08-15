---
name: cross-check
description: CSS↔Skia↔DOM/WASM 입력 경로 정합성 검증. 변경된 컴포넌트의 모든 렌더링 경로를 교차 검증합니다.
TRIGGER when: user mentions "정합성 체크", "정합성 검증", "렌더링 체크", "cross check", "CSS WebGL 비교", "렌더링 경로 확인", "Preview Canvas 비교", "CSS↔WebGL", or asks to verify rendering parity across paths.
user_invocable: true
---

## Codex Harness Integration

- rendering parity 관련 이슈가 있으면 이 스킬을 우선 사용한다.
- CRITICAL 이슈 수정 후 `pnpm run build:specs`와 `pnpm run codex:typecheck`
  필요 여부를 확인한다.

# Cross-Check: 렌더링 경로 정합성 검증

변경된 컴포넌트의 CSS(Preview), Skia Canvas, DOM/WASM 입력 경로가 일관되게 동작하는지 검증합니다.

## Phase 1: 변경 대상 식별

`git diff --name-only`로 변경된 파일에서 영향받는 컴포넌트를 식별합니다.

변경 파일 → 컴포넌트 매핑:

- `*.spec.ts` → 해당 컴포넌트
- `*.css` → 해당 컴포넌트
- `skia/*.ts(x)` → Skia node/command 경로에 등록된 모든 변경 컴포넌트
- `fullTreeLayout.ts` / `utils.ts` → 영향받는 모든 컴포넌트
- `implicitStyles.ts` → 해당 컨테이너 컴포넌트
- `*Renderers.tsx` → 해당 Preview 렌더러 컴포넌트

## Phase 2: 컴포넌트별 5-레이어 교차 검증

각 컴포넌트에 대해 아래 테이블을 작성합니다:

| 레이어               | 파일                                                    | 검증 항목                                       | 상태 |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------- | ---- |
| **Spec**             | `packages/specs/src/components/{Name}.spec.ts`          | variants, sizes, render.shapes(), properties    |
| **Factory**          | `apps/builder/src/builder/factories/definitions/*.ts`   | 기본 props, style, 자식 구조                    |
| **CSS Renderer**     | `packages/shared/src/components/styles/{Name}.css`      | data-variant/data-size 선택자, 토큰             |
| **Skia Renderer**    | `canvas/skia/*.ts(x)` + `specTextStyle.ts` + `utils.ts` | node data, command stream, text/layout contract |
| **Preview Renderer** | `packages/shared/src/renderers/*.tsx`                   | variant/size props 전달, data-\* 속성           |

## Phase 3: 정합성 검증 항목

각 컴포넌트에 대해 아래를 확인합니다:

### 3.1 Variant 정합성

- [ ] Spec `defaultVariant`와 React 컴포넌트 기본값 일치
- [ ] Spec `variants` 키와 CSS `[data-variant="..."]` 선택자 일치
- [ ] Preview 렌더러가 `variant` prop을 컴포넌트에 전달

### 3.2 Size 정합성

- [ ] Spec `defaultSize`와 React 컴포넌트 기본값 일치
- [ ] Size casing 일관성 (sm/md/lg, S/M/L 혼용 금지)
- [ ] Spec sizes의 fontSize/paddingX/paddingY/lineHeight/borderWidth가 CSS와 일치
- [ ] Preview 렌더러가 `size` prop을 컴포넌트에 전달

### 3.3 WebGL 레이아웃 정합성

- [ ] `INLINE_BLOCK_TAGS` 또는 `BUTTON_LIKE_TAGS` 등록 여부 (fit-content 필요 시)
- [ ] `TEXT_BEARING_SPECS` 등록 여부 (텍스트 폭 측정 필요 시)
- [ ] `DEFAULT_SIZE_BY_TAG` 등록 여부
- [ ] `calculateContentWidth`의 `isFormElement` 경로 포함 여부
- [ ] `calculateContentHeight`의 `isButtonLike` 경로 포함 여부

### 3.4 토큰 정합성

- [ ] Spec TokenRef와 CSS 변수 매핑 일치 (css-tokens.md 참조)
- [ ] 금지된 M3 토큰 사용 없음
- [ ] `--bg-inset` / `{color.layer-2}` 필드 배경 통일 (해당 시)

### 3.5 상태 정합성

- [ ] disabled 상태: opacity 0.38, pointerEvents: none (Spec ↔ CSS)
- [ ] focusVisible: outline 2px solid var(--focus-ring) (CSS) / var(--accent) (Spec)

## Phase 4: 결과 보고

검증 결과를 테이블로 보고합니다:

| 컴포넌트 | 레이어 | 이슈                      | 심각도   | 수정 여부 |
| -------- | ------ | ------------------------- | -------- | --------- |
| Menu     | WebGL  | TEXT_BEARING_SPECS 미등록 | CRITICAL | 수정 완료 |

발견된 이슈는 즉시 수정합니다. 수정 후 `pnpm run build:specs`와
`pnpm run codex:typecheck` 또는 targeted test로 검증합니다.

## Phase 5: 시각 파리티 검증 (선택 — dev 서버 실행 시)

개발 서버(`localhost:5173`)와 Storybook(`localhost:6006`) 중 실행 중인 것이 있으면, 사용 가능한 브라우저/컴퓨터 사용 도구로 Preview(CSS)와 Canvas(Skia) 렌더링을 시각적으로 비교합니다.

### 5.1 Preview(CSS) 스크린샷 캡처

- 브라우저/컴퓨터 사용 도구 또는 Playwright MCP가 있으면 새 탭을 열고 `http://localhost:5173` 또는 `http://localhost:6006` 로 이동
- 변경된 컴포넌트가 보이는 화면까지 진입 후 스크린샷을 캡처

### 5.2 Canvas(Skia) 스크린샷 캡처

동일 탭에서 Canvas 영역을 스크린샷으로 캡처합니다. Canvas와 Preview를 나란히 비교할 수 있는 뷰가 있으면 한 번에 캡처합니다.

### 5.3 시각 비교

두 스크린샷을 비교하여 아래 항목을 확인합니다:

- 크기·여백 불일치 (padding, height, gap 차이)
- 색상·폰트 불일치 (토큰 매핑 오류, dark mode 차이)
- 정렬 차이 (flex/grid 배치 불일치)
- 상태 렌더링 차이 (hover, disabled, focus 시각 차이)

불일치 발견 시 Phase 4 결과 테이블에 추가하고 즉시 수정합니다.

### 생략 조건

아래에 해당하면 Phase 5를 건너뜁니다:

- 개발 서버 또는 Storybook이 실행 중이지 않음
- 시각적 변화가 없는 수정 (로직·타입·스토어 변경만 포함)
- CI 환경 (브라우저 없음)
- 사용자가 명시적으로 생략을 요청한 경우

## Evals

### Positive (발동해야 하는 경우)

- "Button spec 수정했는데 CSS도 맞는지 확인해줘" → ✅ 렌더링 경로 교차 검증
- "이 컴포넌트 Canvas랑 Preview가 다르게 보여" → ✅ 불일치 감지 → 5-레이어 검증
- "Spec 변경 후 정합성 체크해줘" → ✅ 직접 트리거
- "렌더링 경로 확인해봐" → ✅ 직접 트리거

### Negative (발동하면 안 되는 경우)

- "TextField placeholder 텍스트만 변경" → ❌ 시각 렌더링 미변경
- "ESLint 규칙 추가" → ❌ 렌더링 무관
- "Store 로직만 수정했어" → ❌ 렌더링 경로 미관여 (시각적 변화 없으면 불필요)
- "단위 테스트 작성해줘" → ❌ 테스트 작업 → tester 에이전트
