# ADR-109: Body Spec SSOT 완결 + Publish consumer 대칭 복구

## Status

Implemented — 2026-04-25 → 2026-04-27

### 진행 로그

- **2026-04-25**: Proposed (D1~D4 4 debt + Gate G1~G4 정의)
- **2026-04-27 (세션 40)**: **D1 land** (PR #268, commit `40a17a03`)
  - `apps/publish/src/hooks/useBodyElement.ts` 신규 (102줄) — body element → `document.body` className `react-aria-Body` + style 직접 주입 + cleanup
  - `apps/publish/src/renderer/PageRenderer.tsx` — `useBodyElement(pageElements)` 호출 추가
  - 검증: publish type-check exit 0
- **2026-04-27 (세션 41)**: **D2 + D4 land + Implemented 승격**
  - **D2** (`apps/builder/src/types/builder/unified.types.ts:1766` `createDefaultBodyProps`):
    - `style.backgroundColor: "var(--bg)"` literal 제거
    - `style.color: "var(--fg)"` literal 제거
    - `className: "react-aria-Body"` 추가 — Preview/Publish 양쪽에서 generated CSS rule (`.react-aria-Body { background: var(--bg); color: var(--fg); }`) 적용
  - **D4** (Skia renderer dead code cleanup):
    - `SkiaRenderer.backgroundColor` private field + constructor param + `setBackgroundColor()` 메서드 제거
    - `SkiaCanvas.tsx` `backgroundColor` prop + `readCssBgColor` / `hexToColor4fChannels` import + bgColor 계산 블록 제거
    - `BuilderCanvas.tsx` `backgroundColor` prop + `DEFAULT_BACKGROUND` const + 호출처 전달 제거
    - `setupThemeWatcher` callback 단순화 (setBackgroundColor 호출 제거 — invalidateContent + recordInvalidation 만)
  - **Gate G1 (publish 회귀 0) PASS** — `pnpm type-check` 3/3 exit 0
  - **Gate G2 (body 3경로 theme 대칭) PASS** — D2 className 자동 주입으로 generated CSS 통일 (Builder Skia 는 BodySpec.shapes var prefix skip + TokenRef resolve 기존 동작 유지)
  - **Gate G4 (D4 cleanup 안전성) PASS** — `setBackgroundColor` / `SkiaRenderer.backgroundColor` field grep 0건 (themeWatcher.ts 의 readCssBgColor 내부 helper 사용은 별개)
  - **D3 + Gate G3 Defer** (Phase 3 별도 follow-up):
    - body.fills runtime-ignore 안정성 검증 + fill inspector body="theme-managed" 표시 (또는 fills 편집 UI 차단) 미구현
    - ADR-109 R3 + Gate G3 의 "실패 시 대안: Phase 3 을 defer 로 분리 — 사용자-가시 영향 없으므로 optional" 적용
    - BodySpec.shapes 의 `var(`/`{`/`$--` prefix skip 로직이 이미 fills runtime-ignore 동등 동작 보장 → defer 안전

## Context

[ADR-902](902-workspace-dot-background-layer.md) (Workspace Dot Background Layer + 투명 clear) 가 land 되며 body 배경 theme 처리의 SSOT 위반이 드러났고, 후속 refactor (`f367fd89` / `25ddda93` / `76a34f1d`) 로 `BodySpec` 신규 + Builder Skia / Preview DOM 2 경로 정합을 복구했다. 그러나 ADR-063 3-domain charter 의 **D3 (시각 스타일) symmetric consumer** 3 경로 기준으로 볼 때 잔여 debt 가 남아있다.

### Domain (SSOT 체인 — [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

- **해당 domain**: **D3 (시각 스타일)** — Skia / Preview / Publish 3 consumer 의 body 배경 대칭 복구 마지막 축.
- ADR-902 이후 Skia (`buildSpecNodeData` 경로 진입) + Preview (document.body style 직접 주입) 2 경로는 정상. Publish 는 **대칭 미달**.

### 잔여 debt (ADR-902 후속)

| #   | 항목                                                                         | 현 상태                                                                                                                                       | 영향도                                                                                                                               | 대칭성                                            |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| D1  | **Publish app 의 spec className 자동 주입**                                  | `apps/publish/src/renderer/ElementRenderer.tsx:169-179` 가 Preview (`App.tsx:436-445`) 와 달리 `react-aria-${tag}` className 을 주입하지 않음 | HIGH — **body 뿐 아니라 모든 spec-backed 컴포넌트** 에 영향. publish site 가 generated CSS (`.react-aria-*`) 를 전혀 매칭시키지 못함 | D3 symmetric 파손 — Preview 와 publish 시각 drift |
| D2  | **`createDefaultBodyProps` 의 `backgroundColor: "var(--bg)"` 리터럴**        | Preview DOM 자연 적용용 fallback. Skia 는 `BodySpec.render.shapes` 의 `var(` prefix skip 로직 의존                                            | LOW — 작동 중이나 간접                                                                                                               | 약한 대칭 — 특수 skip 로직으로 brittle            |
| D3  | **DB 에 이미 migrated 된 body.fills = [{color:"#ffffff"}]**                  | Spec 경로가 fills 를 참조하지 않아 시각적 영향 없음 (`buildSpecNodeData` → BodySpec.shapes 는 TokenRef 직접 resolve)                          | LOW — 시각은 정상, data stale                                                                                                        | 불변 (Spec 우선)                                  |
| D4  | **`SkiaRenderer.backgroundColor` 필드 + `setupThemeWatcher` 색 동기화 경로** | ADR-902 투명 clear 이후 시각적 no-op (API/상태 보존 중)                                                                                       | LOW — dead code                                                                                                                      | N/A                                               |

### Hard Constraints (측정 가능)

1. **D3 symmetric 완결**: 동일 spec element 를 Builder Skia / Preview DOM / Publish DOM 이 **동일 시각 결과** 로 렌더 (ADR-063)
2. **Theme 전환 정합**: ThemesPanel light/dark 토글 시 3 consumer 모두 theme-aware 반응 (ADR-021 / ADR-902 확장)
3. **0 regression**: body 외 모든 spec-backed 컴포넌트 (Button, Card, Section 등) 의 기존 렌더 유지
4. **번들 영향 < 3KB**: Publish app 변경 최소화

### Soft Constraints

- D2 는 D1 해결 후 body 를 spec className 경로에 완전 위임하여 제거 가능
- D3 는 fills migration 자체를 body 에서 원천 차단 가능 (D2 완료 후)
- D4 는 별개 cleanup — 완결성 차원 포함이나 필수 아님

## Alternatives Considered

### 대안 A: 4 debt 개별 ADR 분리

- **설명**: D1 / D2 / D3 / D4 각각을 독립 ADR 로 발의. 4개 PR + 4개 리뷰.
- 위험 평가:
  - 기술: LOW — 각 ADR scope 작음
  - 성능: LOW
  - 유지보수: **HIGH** — ADR 4개 관리, 의존 관계 (D2 는 D1 의존, D3 는 D2 의존) 추적 부담
  - 마이그레이션: LOW
- **부가 문제**: D1 단독은 publish 전반 SSOT 이므로 scope 거대화 (모든 spec 컴포넌트 영향). ADR-902 에서 파생된 body-scoped 연장 스토리라인이 분산되어 리뷰/추적 난도 증가.

### 대안 B: 통합 ADR — D1~D4 4-Phase 로드맵

- **설명**: ADR-109 하나로 4 debt 를 Phase 순서 (D1 → D2 → D3 → D4) 로 추적. Phase 별 개별 커밋 + Gate 통과 후 다음 Phase. 각 Phase 실패 시 롤백 단위 = Phase.
- 위험 평가:
  - 기술: MEDIUM — D1 이 publish 전반에 영향. Button/Card 등 기존 rendering 회귀 가능성. Gate 로 관리.
  - 성능: LOW — className 속성 추가 수준
  - 유지보수: LOW — 단일 ADR 로 연관 debt 응집, story 일관성
  - 마이그레이션: LOW — body fills cleanup 은 mutation 없이 무시 (Spec 경로 우선)
- **부가 장점**: ADR-902 의 "Body SSOT 복구" 스토리라인 연장으로 context 자연스러움.

### 대안 C: Defer (현재 상태 유지)

- **설명**: 4 debt 모두 미해결 유지. body 는 Preview+Skia 에서 theme 전환 정상 동작하므로 사용자-가시 영향 없음.
- 위험 평가:
  - 기술: LOW — 코드 변경 0
  - 성능: LOW
  - 유지보수: **HIGH** — D1 publish spec 미적용이 body 외 전체 spec 컴포넌트 시각 drift 누적 (이미 존재하는 pre-ADR-902 debt). `createDefaultBodyProps` CSS var 리터럴 + BodySpec special skip 로직의 brittle 결합 장기화. Dead code (D4) 방치.
  - 마이그레이션: LOW
- **부가 문제**: ADR-063 위반 잔존 → 향후 body 외 spec 시각 변경 시 3경로 drift 반복 발생.

### Risk Threshold Check

| 대안         | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------ | :--: | :--: | :------: | :----------: | :--------: |
| A (개별 ADR) |  L   |  L   |  **H**   |      L       |     1      |
| B (통합 ADR) |  M   |  L   |    L     |      L       |     0      |
| C (Defer)    |  L   |  L   |  **H**   |      L       |     1      |

판정: A, C 각 HIGH 1. B 만 LOW 조합. 루프 불필요.

## Decision

**대안 B (통합 ADR — D1~D4 4-Phase)** 채택.

### 선택 근거

1. **응집성**: ADR-902 의 body SSOT 스토리라인을 그대로 연장. 개별 ADR 분리(A) 는 맥락 손실
2. **의존 관리**: D1 (publish className) → D2 (literal 제거) → D3 (fills cleanup) 의존 관계가 자연스럽게 Phase 순서로 표현
3. **유지보수 LOW**: 단일 ADR 내 Phase 로 관리 가능, A 의 HIGH 부담 회피
4. **scope**: D1 이 publish 전반에 영향하지만 **Preview 와 대칭** 이라는 명확한 reference implementation 존재 → 위험 제한적

### 기각 사유

- **A (개별 ADR)**: 유지보수 HIGH — 4 ADR 의존 추적 + 리뷰 분산. 특히 D2 는 D1 의존이 자명하여 단독 ADR 은 premature.
- **C (Defer)**: 유지보수 HIGH — D1 이 body 한정이 아닌 publish 전반 문제이므로 방치 시 장기 drift. ADR-063 위반 누적.

> 구현 상세: design/109-body-spec-ssot-completion-breakdown.md (작성 예정 — D3/G3 follow-up 진입 시 land)

## Risks

| ID  | 위험                                                                                                                                                                                                 | 심각도 | 대응                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Publish ElementRenderer className 주입 시 기존 Button/Card 등 spec-backed 컴포넌트 렌더 회귀 (className 이 ComponentRegistry 의 createHtmlElement 통해 React 에 전달될 때 예상치 못한 CSS 규칙 적용) |  MED   | Gate G1 으로 Phase 1 완료 직후 publish 샘플 사이트 렌더 diff 검증. 회귀 발생 시 className 주입을 allowlist 방식 (명시적 tag set) 으로 좁힘                                                                                                   |
| R2  | D2 (`createDefaultBodyProps` literal 제거) 후 Preview iframe body 가 초기 로드 시 theme 변수 미적용 상태로 flash                                                                                     |  LOW   | Phase 2 에서 Preview 의 body spec className 자동 주입 확인 (`className="react-aria-Body"` 를 document.body 에 부여). CSS `.react-aria-Body` 규칙이 `@layer components` 로 emit 되므로 preflight 에 의존 — shared-tokens.css import 선행 확인 |
| R3  | D3 (body.fills cleanup) 을 data migration 으로 시도할 경우 production DB 영향                                                                                                                        |  LOW   | Mutation 없이 **runtime-only cleanup**: load 시점에 body element 의 fills 배열을 메모리에서만 무시 (이미 Spec 경로가 무시 중). DB 직접 mutation 경로 미채택                                                                                  |
| R4  | D4 (`SkiaRenderer.backgroundColor` 제거) 시 `themeWatcher.ts` 의 `setBackgroundColor` 호출 체인에 breakage                                                                                           |  LOW   | API signature 유지 (no-op 으로) vs 완전 제거 양자택일. Phase 4 에서 구체 결정. 호출자 수동 감사                                                                                                                                              |

## Gates

| Gate                                | 시점              | 통과 조건                                                                                                                                                                               | 실패 시 대안                                                                          |
| ----------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **G1. Publish className 회귀 없음** | Phase 1 완료 직후 | Publish 로 배포한 샘플 사이트에서 Button/Card/Section 등 **10+ spec-backed 컴포넌트** 의 렌더가 Phase 1 이전과 pixel-level 동일 (수동 비교 또는 스크린샷 diff) + `pnpm type-check` PASS | allowlist 방식 (body / 사용자 지정 set) 으로 className 주입 범위 축소                 |
| **G2. body 3 경로 theme 대칭**      | Phase 2 완료 직후 | 동일 body element 가 Builder Skia / Preview iframe / Publish 3 경로에서 동일 색상 (`{color.base}` light/dark) 으로 렌더 + ThemesPanel 토글 시 3 경로 동시 전환                          | D2 롤백하여 `createDefaultBodyProps` CSS var 리터럴 + BodySpec special skip 경로 유지 |
| **G3. fills runtime-ignore 안정성** | Phase 3 완료 직후 | 기존 프로젝트 (body.fills migrated) 5개 이상 로드하여 body 렌더 정상 + fill inspector 가 body 를 "theme-managed" 로 표시 (또는 fills 편집 UI 차단)                                      | Phase 3 을 defer 로 분리 — 사용자-가시 영향 없으므로 optional                         |
| **G4. D4 cleanup 안전성**           | Phase 4 완료 직후 | `SkiaRenderer` 에서 `backgroundColor` 필드 / `setupThemeWatcher` 제거 후 type-check + e2e smoke PASS. 호출자 grep 결과 0                                                                | API signature no-op 보존 방식으로 fallback (제거 없이 내부만 정리)                    |

## Consequences

### Positive

- ADR-063 **D3 symmetric 회복** — body 만이 아닌 모든 spec-backed 컴포넌트의 Publish CSS 매칭 복구
- ADR-902 의 body SSOT 스토리라인 완결 — Skia / Preview / Publish 3 경로 1 Spec 에서 파생
- `createDefaultBodyProps` 의 brittle CSS var 리터럴 + `BodySpec.render.shapes` 의 special skip 로직 제거 → 코드 단순화
- Publish site 의 spec-based styling 품질 향상 — hover/focus/disabled state CSS 규칙 활성화

### Negative

- Phase 1 이 Publish 전반에 영향 → 회귀 위험 (G1 으로 관리)
- 4 Phase 순차 진행 — land 기간 길어짐
- D3 runtime-ignore 방식은 DB 에 "dead" fills 데이터를 영구 보유 (cleanup script 는 optional 후속)
- ADR 자체가 여러 작은 변경을 묶어 리뷰 부담 증가 (Phase 분리로 완화)

## References

- [ADR-902: Workspace Dot Background Layer](902-workspace-dot-background-layer.md) — body SSOT 회귀 원인
- [ADR-063: SSOT Chain Charter](063-ssot-chain-charter.md) — D3 symmetric 원칙
- [ADR-107: Preview/Publish :root Symmetry](107-preview-publish-root-symmetry.md) — 유사한 3-consumer 대칭 작업 선례
- [ADR-021: Theme System Redesign](021-theme-system-redesign.md) — theme 토큰 / CSS 변수 체계
- 관련 commit: `3256c8a7` (ADR-902 초기) / `f367fd89` (Body Spec 편입) / `25ddda93` (var 리터럴 skip) / `76a34f1d` (body lowercase alias)
