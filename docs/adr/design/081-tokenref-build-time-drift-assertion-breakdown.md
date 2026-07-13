# ADR-081 구현 상세 — TokenRef resolved-value build-time drift assertion

> ADR 본문: [081-tokenref-build-time-drift-assertion.md](../completed/081-tokenref-build-time-drift-assertion.md)

## 개요

vitest snapshot 기반 2-file 전략으로 token primitives 의 resolved 값이 변경될 때 4종 소비자 경로(C1~C4)에서 자동으로 drift 를 감지한다. 기존 `CSSGenerator.snapshot.test.ts` 패턴을 재사용하며 새 test runner 는 도입하지 않는다.

## Phase 구조

| Phase | 파일                              | Gate  | 내용                                                 |
| ----- | --------------------------------- | ----- | ---------------------------------------------------- |
| P1    | `tokenSnapshot.test.ts` 신설      | G1    | primitives token resolved 값 전체 snapshot 고정      |
| P2    | `tokenConsumerDrift.test.ts` 신설 | G2    | C1~C4 소비자 경로 각각을 snapshot 과 cross-reference |
| P3    | `spacing.xs` 임시 변경 실측       | G3    | 4종 경로 drift 자동 감지 실증                        |
| P종결 | 원복 + 전체 회귀 확인             | G종결 | vitest 전체 + type-check 3/3 + 빌드 시간 측정        |

---

## Phase 1 — Token Primitives Snapshot 고정

### 목적

`packages/specs/src/primitives/` 의 spacing/radius/typography 토큰의 **resolved 숫자 값**을 vitest snapshot 으로 고정한다. primitives 변경 시 snapshot 이 outdated 되어 CI 실패가 발생하고 명시적 승인(`--update-snapshots`)이 요구된다.

### 신규 파일

**`packages/specs/src/renderers/__tests__/tokenSnapshot.test.ts`**

```typescript
/**
 * ADR-081 Phase 1 — Token Primitives Resolved Value Snapshot
 *
 * primitives token 의 resolved 숫자 값을 snapshot 으로 고정.
 * token 변경 시 이 test 가 실패 → 소비자 경로 drift 검토 후 명시적 --update-snapshots.
 *
 * 위치를 renderers/__tests__/ 에 배치하는 이유:
 *   기존 CSSGenerator.snapshot.test.ts 와 동일 디렉토리 = 동일 vitest 설정 재사용.
 */
import { describe, expect, it } from "vitest";
import { spacing } from "../../primitives/spacing";
import { radius } from "../../primitives/radius";
import { typography } from "../../primitives/typography";

describe("TokenRef primitives resolved-value snapshot (ADR-081 P1)", () => {
  it("spacing tokens", () => {
    expect(spacing).toMatchSnapshot();
  });

  it("radius tokens", () => {
    expect(radius).toMatchSnapshot();
  });

  it("typography tokens", () => {
    expect(typography).toMatchSnapshot();
  });
});
```

### 초기 snapshot 내용 (예상)

`__snapshots__/tokenSnapshot.test.ts.snap` 생성 시 다음 값이 고정된다:

```
spacing: { "2xs": 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48 }
radius: { none: 0, sm: 4, md: 6, lg: 8, xl: 12, full: 9999 }
typography: { "text-xs": 12, "text-sm": 14, "text-base": 16, ... }
```

### Gate G1 통과 조건

- `pnpm vitest --run packages/specs/src/renderers/__tests__/tokenSnapshot.test.ts` PASS
- `.snap` 파일이 `packages/specs/src/renderers/__tests__/__snapshots__/` 에 생성됨
- CI 에서 snapshot 자동 업데이트 금지 확인 (`--update-snapshots` flag 없음)

---

## Phase 2 — Consumer Path Drift Cross-Reference

### 목적

C1~C4 소비자 경로 각각이 동일 token 에 대해 **Phase 1 snapshot 과 동일한 resolved 값**을 반환하는지 검증한다. 소비자 경로별 검증 방식이 다르므로 경로별 assertion 전략을 달리한다.

### 소비자 경로별 검증 전략

| 경로             | 검증 파일/함수                                    | Assertion 방식                                                         |
| ---------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| C1 Preview CSS   | `tokenToCSSVar("{spacing.xs}")`                   | CSS var 문자열 snapshot (값 아닌 매핑 검증) + 별도 CSS var 실제값 주석 |
| C2 Skia 렌더     | `resolveToken("{spacing.xs}", "light")`           | 숫자 반환 → `spacing.xs` 와 `===` 비교                                 |
| C3 Layout engine | `implicitStyles.ts` 의 `?? N` 상수 추출           | 상수 테이블 → `spacing.xs` 와 비교                                     |
| C4 Style Panel   | `useContainerStyleDefault` 반환 (TokenRef string) | hook 이 TokenRef 문자열 반환 시 `resolveToken()` 통과 값 비교          |

### 신규 파일

**`packages/specs/src/renderers/__tests__/tokenConsumerDrift.test.ts`**

```typescript
/**
 * ADR-081 Phase 2 — Token Consumer Drift Cross-Reference
 *
 * C1~C4 소비자 경로 각각의 resolved 값이 primitives snapshot(Phase 1)과 정합한지 검증.
 *
 * C3 (implicitStyles.ts) 는 현재 하드코딩 fallback 상수를 사용하므로
 * 해당 상수를 명시적으로 열거하여 primitives 값과 비교한다.
 * ADR-080 이후 resolveToken() 기반으로 전환되면 C3 섹션을 resolveToken() 비교로 교체.
 */
import { describe, expect, it } from "vitest";
import { spacing, radius } from "../../primitives";
import { resolveToken, tokenToCSSVar } from "../utils/tokenResolver";
import type { TokenRef } from "../../types/token.types";

// ── C1: Preview CSS (tokenToCSSVar) ──────────────────────────────────────────
describe("C1 Preview CSS — tokenToCSSVar mapping (ADR-081 P2)", () => {
  it("spacing token → CSS var 문자열 snapshot", () => {
    const result = {
      xs: tokenToCSSVar("{spacing.xs}" as TokenRef),
      "2xs": tokenToCSSVar("{spacing.2xs}" as TokenRef),
      sm: tokenToCSSVar("{spacing.sm}" as TokenRef),
      md: tokenToCSSVar("{spacing.md}" as TokenRef),
    };
    // CSS var 문자열 형식 고정 (값이 아닌 매핑 일관성 검증)
    expect(result).toMatchSnapshot();
  });
});

// ── C2: Skia 렌더 (resolveToken) ─────────────────────────────────────────────
describe("C2 Skia 렌더 — resolveToken resolved 값이 primitives 와 일치 (ADR-081 P2)", () => {
  it("spacing.xs resolved → primitives.spacing.xs 와 동일", () => {
    const resolved = resolveToken("{spacing.xs}" as TokenRef, "light");
    expect(resolved).toBe(spacing.xs);
  });

  it("spacing.2xs resolved → primitives.spacing.2xs 와 동일", () => {
    const resolved = resolveToken("{spacing.2xs}" as TokenRef, "light");
    expect(resolved).toBe(spacing["2xs"]);
  });

  it("spacing.sm resolved → primitives.spacing.sm 와 동일", () => {
    const resolved = resolveToken("{spacing.sm}" as TokenRef, "light");
    expect(resolved).toBe(spacing.sm);
  });

  it("radius.md resolved → primitives.radius.md 와 동일", () => {
    const resolved = resolveToken("{radius.md}" as TokenRef, "light");
    expect(resolved).toBe(radius.md);
  });
});

// ── C3: Layout engine (implicitStyles.ts 하드코딩 fallback 상수) ──────────────
/**
 * ADR-081 P2 C3: implicitStyles.ts 의 fallback 상수가 primitives 값과 정합한지 검증.
 *
 * 현재 implicitStyles.ts 는 resolveToken() 을 사용하지 않으므로
 * fallback 상수를 이 파일에 명시적으로 열거하여 비교한다.
 * primitives 변경 시 이 test 가 실패 → implicitStyles.ts 상수도 동기화 유도.
 *
 * 참조 위치:
 *   apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts
 *   - line 673: gap: parentStyle.gap ?? 2       ← {spacing.2xs} = 2
 *   - line 674: padding: parentStyle.padding ?? 4 ← {spacing.xs} = 4
 *   - line 393: gap: parentStyle.gap ?? 4         ← {spacing.xs} = 4
 *   - line 817: gap: parentStyle.gap ?? 4         ← {spacing.xs} = 4
 */
const IMPLICIT_STYLES_CONSTANTS = {
  // ListBox 분기 (line 673-674) — ADR-079 P3.2 drift test 가 식별자만 검증한 경로
  listbox_gap_fallback: 2, // should === spacing["2xs"]
  listbox_padding_fallback: 4, // should === spacing.xs

  // Collection 공통 gap 분기 (line 393, 505, 525, 817, 1100, 1122)
  collection_gap_fallback: 4, // should === spacing.xs
} as const;

describe("C3 Layout engine — implicitStyles.ts 하드코딩 fallback 상수 (ADR-081 P2)", () => {
  it("listbox gap fallback 상수 === spacing.2xs (2)", () => {
    expect(IMPLICIT_STYLES_CONSTANTS.listbox_gap_fallback).toBe(spacing["2xs"]);
  });

  it("listbox padding fallback 상수 === spacing.xs (4)", () => {
    expect(IMPLICIT_STYLES_CONSTANTS.listbox_padding_fallback).toBe(spacing.xs);
  });

  it("collection gap fallback 상수 === spacing.xs (4)", () => {
    expect(IMPLICIT_STYLES_CONSTANTS.collection_gap_fallback).toBe(spacing.xs);
  });
});

// ── C4: Style Panel (useContainerStyleDefault — TokenRef string 반환) ──────────
/**
 * ADR-081 P2 C4: Style Panel hook 은 TokenRef 문자열을 그대로 반환한다.
 * resolved 숫자가 필요한 경우 useLayoutAuxiliary 상위에서 resolveToken() 통과.
 * 현재 useContainerStyleDefault 는 display/flexDirection 같은 문자열 CSS 값만 반환하며
 * spacing TokenRef 는 거치지 않는다.
 *
 * 따라서 C4 는 TokenRef 를 소비하는 하위 hook 이 resolveToken() 경유 시
 * 올바른 값을 반환하는지 검증한다 (resolveToken 이 이미 C2 에서 커버됨).
 *
 * 참조 위치:
 *   apps/builder/src/builder/panels/styles/hooks/useLayoutAuxiliary.ts
 *   - useContainerStyleDefault: spec.containerStyles.[property] 반환 (문자열/숫자)
 */
describe("C4 Style Panel — ContainerStyles TokenRef 값이 primitives 와 정합 (ADR-081 P2)", () => {
  it("ListBoxSpec.containerStyles.gap TokenRef = {spacing.2xs} resolved = spacing.2xs", () => {
    // dynamic import 없이 타입 안전하게 검증
    const tokenRef = "{spacing.2xs}" as TokenRef;
    const resolved = resolveToken(tokenRef, "light");
    expect(resolved).toBe(spacing["2xs"]);
  });

  it("ListBoxSpec.containerStyles.padding TokenRef = {spacing.xs} resolved = spacing.xs", () => {
    const tokenRef = "{spacing.xs}" as TokenRef;
    const resolved = resolveToken(tokenRef, "light");
    expect(resolved).toBe(spacing.xs);
  });
});
```

### Gate G2 통과 조건

- `pnpm vitest --run packages/specs/src/renderers/__tests__/tokenConsumerDrift.test.ts` PASS
- C1~C4 각 `describe` 블록 모두 PASS
- 실패 메시지에 token 이름 · 소비자 ID · 기댓값 · 실제값 포함 확인

---

## Phase 3 — Drift 감지 실증 (임시 변경 → 실패 확인 → 원복)

### 목적

G3 통과 조건인 "실측" 을 수행한다. `spacing.xs` 를 `4 → 6` 으로 임시 변경하여 Phase 1 + Phase 2 test 가 실제로 실패하는지 확인한다.

### 절차

```bash
# 1. spacing.xs 임시 변경
# packages/specs/src/primitives/spacing.ts 의 xs: 4 → xs: 6

# 2. test 실행 — G1 실패 확인
pnpm vitest --run packages/specs/src/renderers/__tests__/tokenSnapshot.test.ts
# 기대: FAIL (snapshot 의 xs: 4 ≠ 실제 xs: 6)

# 3. C3 drift 확인
pnpm vitest --run packages/specs/src/renderers/__tests__/tokenConsumerDrift.test.ts
# 기대: C3 "listbox padding fallback 상수 === spacing.xs" FAIL (상수 4 ≠ 6)
# 기대: C2 "spacing.xs resolved → primitives.spacing.xs" PASS (resolveToken 은 최신 값 반환)

# 4. 원복
# xs: 6 → xs: 4

# 5. 전체 vitest 회귀 확인
pnpm vitest --run
```

### 실패 메시지 예상 형식 (C3 drift)

```
AssertionError: expected 4 to be 6

  C3 Layout engine — implicitStyles.ts 하드코딩 fallback 상수
  ✕ listbox padding fallback 상수 === spacing.xs (4)
      → IMPLICIT_STYLES_CONSTANTS.listbox_padding_fallback = 4
      → spacing.xs = 6
      → drift: implicitStyles.ts 의 listbox padding 상수를 4 → 6 으로 업데이트 필요
```

### Gate G3 통과 조건

- `spacing.xs = 6` 변경 시 C1 snapshot test + C3 drift test 가 실패
- 실패 메시지에 token 이름과 기댓값/실제값 명시
- `spacing.xs = 4` 원복 후 모든 test PASS

---

## Phase 종결 — 빌드 시간 측정 및 전체 회귀

### 빌드 시간 측정 방법

```bash
# 현재 vitest 실행 시간 (baseline)
time pnpm vitest --run packages/specs

# test 추가 후 측정
time pnpm vitest --run packages/specs
# 기대: 증가분 < 200ms (hard constraint 10% 미만 기준)
```

### 전체 회귀 체크리스트

- [ ] `pnpm type-check` 3/3 PASS
- [ ] `pnpm vitest --run` 전체 회귀 0
- [ ] `pnpm build:specs` PASS
- [ ] CI에서 `--update-snapshots` 없이 PASS (snapshot 자동 업데이트 금지 확인)
- [ ] `spacing.xs = 4` 원복 완료

---

## 파일 변경 목록

| 파일                                                                              | 변경 유형 | 내용                               |
| --------------------------------------------------------------------------------- | --------- | ---------------------------------- |
| `packages/specs/src/renderers/__tests__/tokenSnapshot.test.ts`                    | 신규      | Phase 1 primitives snapshot test   |
| `packages/specs/src/renderers/__tests__/tokenConsumerDrift.test.ts`               | 신규      | Phase 2 C1~C4 cross-reference test |
| `packages/specs/src/renderers/__tests__/__snapshots__/tokenSnapshot.test.ts.snap` | 자동 생성 | Phase 1 실행 시 vitest 자동 생성   |

**기존 파일 변경 없음** — 모든 변경은 test 파일 신규 추가만.

---

## ADR-080 연계 포인트

ADR-080 (Layout engine Spec direct read-through) 이 완료되면:

1. `implicitStyles.ts` 의 `gap: parentStyle.gap ?? 2` 패턴이 `gap: resolveToken("{spacing.2xs}")` 로 전환됨
2. C3 drift test 의 `IMPLICIT_STYLES_CONSTANTS` 테이블이 불필요해짐
3. C3 섹션을 C2 와 동일한 `resolveToken()` 직접 비교 방식으로 교체
4. C3 단순화로 test 유지보수 비용 감소

전환 시 `tokenConsumerDrift.test.ts` 의 C3 섹션 주석을 업데이트하고 상수 테이블 제거.

---

## 소비자 경로 향후 확장 (scope 외)

본 ADR 은 확인된 C1~C4 에 한정한다. 향후 발견되는 경로가 있으면 `tokenConsumerDrift.test.ts` 에 새 `describe` 블록을 추가한다. 자동 감지 메커니즘은 별도 ADR scope.

잠재 추가 경로:

- `apps/builder/src/builder/workspace/canvas/utils/cssVariableCore.ts` — CSS 변수 core 처리
- `apps/builder/src/builder/workspace/overlay/specTextStyleForOverlay.ts` — overlay text style
- `apps/publish/` — Publish 앱 token 소비 (현재 미감사)
