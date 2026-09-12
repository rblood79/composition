# ADR-062 구현 상세 — Field 컴포넌트 Spec 정리 (RSP 참조 기반)

본 문서는 ADR-062의 구현 상세만 담는다. 결정의 근거/대안/위험은 ADR 본문 참조.

## 조사 매트릭스 (2026-04-13 실측)

| 컴포넌트        | RSP variant | 현재 Spec variant                                     | RSP isQuiet | 현재 Spec isQuiet |
| --------------- | :---------: | ----------------------------------------------------- | :---------: | :---------------: |
| TextField       |     ❌      | `default/accent/neutral/purple/negative/positive` (6) |     ✅      |        ✅         |
| TextArea        |     ❌      | `default/accent/negative` (3)                         |     ✅      |        ❌         |
| NumberField     |     ❌      | `default/accent/negative` (3)                         |     ✅      |        ✅         |
| SearchField     |     ❌      | `default/accent` (2)                                  |     ✅      |        ❌         |
| ColorField      |     ❌      | `default/accent/neutral/error/filled` (5)             |     ✅      |        ❌         |
| DateField       |     ❌      | `default/accent/negative` (3)                         |     ✅      |        ❌         |
| TimeField       |     ❌      | `default/accent/negative` (3)                         |     ✅      |        ❌         |
| DatePicker      |     ❌      | `default/accent` (2)                                  |     ✅      |        ✅         |
| DateRangePicker |     ❌      | `default/accent` (2)                                  |     ✅      |        ✅         |
| ComboBox        |     ❌      | `default/accent/negative` (3)                         |     ✅      |        ❌         |
| Select          |     ❌      | `default/accent/negative` (3)                         |     ✅      |        ✅         |

**총 variant 값 8종**: `default / accent / neutral / purple / negative / positive / error / filled`
**isQuiet 누락 6개**: TextArea / SearchField / ColorField / DateField / TimeField / ComboBox

## Variant 값별 처리 정책

마이그레이션 변환 없음. 단순 제거 후 **Spec 레벨 strip**(TypeScript prop 타입 제거 → spread 시 자연 무시).

| 기존 variant 값 | 처리                                | 사용자 대응 경로                                                  |
| --------------- | ----------------------------------- | ----------------------------------------------------------------- |
| `default`       | 제거 (의미 동일)                    | —                                                                 |
| `accent`        | 제거                                | 전역 `--tint` 설정 or element-level `style` CSS override          |
| `neutral`       | 제거 (default와 동일)               | —                                                                 |
| `purple`        | 제거                                | 전역 `--tint: var(--purple)` or element-level CSS override        |
| `negative`      | 제거                                | `isInvalid={true}` 수동 교체 (시각 회귀 감수)                     |
| `positive`      | 제거                                | 정책 미정 (디자인 확정 시 후속 ADR)                               |
| `error`         | 제거 (ColorField `negative` 동의어) | `isInvalid={true}` 수동 교체                                      |
| `filled`        | 제거 (ColorField 전용)              | 정성적 관찰 (사용자 피드백) → 필요 시 후속 ADR로 `fillStyle` 승격 |

## Phase 구조

### Phase 0 — 사용처 사전 확인 (완료)

1. `apps/` 디렉토리에서 11개 컴포넌트별 `variant="..."` prop 호출 grep — **완료 2026-04-13: 0건**
2. `spec.variants` / `spec.defaultVariant` / `props.variant` 전수 grep — **완료 2026-04-13: 58건 (11파일)**
   - Skia 렌더러 3 / 훅 1 / Spec 렌더러 3 / Shared 렌더러 2 / UI 1 / Validator 2 = **11파일**
   - `unified.types.ts` variant 타입 선언 15건

Cloud DB 조사는 수행하지 않음 — 프로젝트 데이터가 IndexedDB 분산 저장이라 중앙 집계 불가, 또한 마이그레이션 기능 미도입으로 사전 count 활용처 없음.

ColorField `filled` 처리: telemetry 미도입 확정 (인프라 부재). 단순 제거 + 정성적 관찰. 실행 계획은 ADR 본문 Negative Consequences 참조 (수집 주체=개발자, 기간=머지 후 6주, threshold=filled 요청 1건 이상).

### Phase 1 — Spec 정리 (컴포넌트 단위, 3그룹)

- **1a**: TextField (variant 6개 제거, isQuiet 유지)
- **1b**: NumberField / DatePicker / DateRangePicker / Select (variant 제거, isQuiet 이미 있음)
- **1c**: TextArea / SearchField / ColorField / DateField / TimeField / ComboBox (variant 제거 + isQuiet 신규 추가)

각 컴포넌트별 작업 (동일 커밋에 포함 — 중간 상태 런타임 오류 방지):

1. `XxxSpec.ts` — `variant` prop 타입 삭제, `variants` 객체 삭제, `defaultVariant` 삭제, `isQuiet` prop 신설(필요 시)
2. **런타임 소비자 11파일** 해당 컴포넌트 variant lookup 경로 제거 or 기본 색상 토큰 직접 참조:
   - `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`
   - `apps/builder/src/builder/workspace/canvas/utils/specTextStyle.ts`
   - `apps/builder/src/builder/workspace/overlay/specTextStyleForOverlay.ts`
   - `apps/builder/src/builder/workspace/canvas/hooks/useSpecRenderer.ts`
   - `packages/specs/src/renderers/ReactRenderer.ts`
   - `packages/specs/src/renderers/PixiRenderer.ts`
   - `packages/specs/src/renderers/CSSGenerator.ts`
   - `packages/shared/src/renderers/FormRenderers.tsx`
   - `packages/shared/src/renderers/LayoutRenderers.tsx`
   - `apps/builder/src/builder/panels/properties/generic/SpecField.tsx`
   - `apps/builder/src/types/builder/unified.types.ts` (해당 컴포넌트 variant 타입 블록)
3. `packages/specs/scripts/validate-specs.ts` — `variants` 부재를 허용하도록 규칙 완화 (Field 계열 한정 or 전역)
4. `packages/specs/scripts/validate-tokens.ts` — `variants` 부재 시 스킵 로직
5. `pnpm build:specs` — generated CSS 검증 (0 byte diff on non-target 컴포넌트)
6. `Xxx.css` — variant 블록 전부 삭제, `[data-quiet]` 블록 신설, `isInvalid` 경로 통합
7. `pnpm type-check` 통과 확인 (G1)

### Phase 2 — CSS consumer 정리

- variant 기반 `--field-accent` 등 로컬 변수 삭제
- `data-invalid` 중심의 상태 기반 CSS 재편
- `[data-quiet]` 셀렉터의 공통 utility 검토 (중복 패턴이면 `@layer utilities`로 승격)

### Phase 3 — Skia 대칭 확인

- 각 컴포넌트 `render.shapes()`에서 `variant` 인자 의존 경로 정리
- 색상은 `isInvalid` 상태 인자로 대체
- `parallel-verify` skill로 11/11 컴포넌트 일괄 대칭 회귀 (기본 경로)
  - fallback: `/cross-check` 11회 순차 실행
- Gate G2 통과 기준: 11/11 대칭 + 실패 시 실패 컴포넌트 격리 + Skia shapes 재작업

### Phase 4 — 접근성·테스트·검증

- 기존 Storybook 스토리에서 `variant="..."` 사용분을 isInvalid/isQuiet 기반으로 마이그레이션 or 삭제
- Storybook 스크린샷 diff 리뷰 (의도적 시각 변경만 승인, 회귀 없음 확인) — G3
- Unit/integration 테스트 중 variant 의존 테스트 isInvalid 기반으로 전환
- ADR-036 재승격 (Field 컴포넌트 variant 개념 제거로 Spec 단일화 강화)
- React Aria 규칙 문서 업데이트 (`react-aria-skill.md`)
- ADR-059 본문/README의 "Blocked by ADR-062" 표시 제거 (단 ADR-059는 여전히 size/state/composition 블로커로 Proposed 유지)

## 파일 변경 규모 (예상) — 핵심 코드 34파일 + Storybook/테스트 ~20파일 = 총 ~54파일

| 레이어                                             | 파일 수 | 변경 규모  |
| -------------------------------------------------- | ------- | ---------- |
| packages/specs (Spec 타입+variants+defaultVariant) | 11      | MEDIUM     |
| packages/shared/css                                | 11      | HIGH       |
| Skia 런타임 (buildSpecNodeData/specTextStyle×2)    | 3       | MEDIUM     |
| 공용 훅 (useSpecRenderer)                          | 1       | LOW        |
| Spec 렌더러 (React/Pixi/CSSGenerator)              | 3       | HIGH       |
| Shared 렌더러 (Form/LayoutRenderers)               | 2       | MEDIUM     |
| Properties UI (SpecField)                          | 1       | LOW        |
| Validator (validate-specs/validate-tokens)         | 2       | MEDIUM     |
| Builder 타입 (unified.types.ts 15건)               | 1       | LOW        |
| Storybook 스토리 + 테스트                          | ~20     | MEDIUM     |
| 마이그레이션 스크립트                              | 0       | — (미도입) |
| **총계**                                           | **~54** | —          |

## Gate별 통과 조건

| Gate                 | 시점                | 통과 조건                                                                                | 실패 시 대안                         |
| -------------------- | ------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------ |
| G1: Spec+소비자 정리 | Phase 1 각 컴포넌트 | type-check 통과, build:specs 0 byte diff (외부 컴포넌트), validator 통과(규칙 완화 포함) | 해당 컴포넌트 revert, 다음 단위 진행 |
| G2: 대칭 회귀        | Phase 3 완료        | 11/11 컴포넌트 `parallel-verify` 대칭 통과                                               | 실패 컴포넌트 Skia 재작업            |
| G3: 접근성·테스트    | Phase 4 완료        | Storybook 스크린샷 diff 리뷰 승인 + unit/integration 테스트 pass                         | 회귀 시나리오별 보강                 |

## 롤백 전략

- 각 Phase 별 독립 커밋. Phase N 실패 시 N-1로 revert.
- 컴포넌트 단위 커밋으로 부분 롤백 가능.
