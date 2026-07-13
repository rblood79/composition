# ADR-080 Breakdown — Layout engine containerStyles Spec direct read-through

> ADR: [080-layout-engine-spec-direct-read-through.md](../completed/080-layout-engine-spec-direct-read-through.md)

본 문서는 Phase 별 구현 상세를 담는다. ADR 본문은 Context/Alternatives/Decision/Gates 의 의사결정 축만 보유.

---

## Phase 0 — 착수 전 감사 (G0)

### 0.1 containerTag 분기 전체 enumeration

아래 grep 으로 `applyImplicitStyles` 내 모든 `containerTag ===` 분기를 열거하고, Spec.containerStyles 와 중복 여부를 교차 확인한다.

```bash
grep -n 'containerTag ===' \
  apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts
```

현재 확인된 분기 목록 (2026-04-20 기준 코드 실측):

| 분기 위치 (라인) | containerTag          | 하드코딩 스타일 속성                                   | Spec.containerStyles 보유                                                                   | 중복 여부                                       |
| ---------------- | --------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 462              | `"menu"`              | 없음 (filteredChildren 제거만)                         | MenuSpec — 보유                                                                             | 스타일 주입 없음 → 해당 없음                    |
| 668              | `"listbox"`           | display/flexDirection/gap/padding                      | ListBoxSpec — 보유                                                                          | **완전 중복** (본 ADR 대상)                     |
| 680              | `"gridlist"`          | display/flexDirection/gap (또는 grid 속성)             | 미보유                                                                                      | 해당 없음                                       |
| 707              | `"gridlistitem"`      | display/flexDirection/gap/paddingTop/Bottom/Left/Right | 미보유 (ListBoxItemSpec 에 containerStyles 있으나 gridlistitem 이 아님)                     | 해당 없음                                       |
| 726              | `"listboxitem"`       | display/flexDirection/gap/paddingTop/Bottom/Left/Right | ListBoxItemSpec — display/flexDirection/alignItems/justifyContent 보유, padding 은 sizes.md | 부분 중복 (padding 체계 불일치 — 별도 ADR 대상) |
| 741              | `"togglebuttongroup"` | display/flexDirection/alignItems                       | ToggleButtonGroupSpec — containerStyles 보유                                                | 부분 중복 — scope 밖                            |
| 752              | `"toolbar"`           | display/flexDirection 파생                             | ToolbarSpec — containerStyles 보유                                                          | 부분 중복 — scope 밖                            |

**G0 판정**: P1 착수 조건 충족 — `"listbox"` 가 유일한 완전 중복 대상으로 확정.

### 0.2 resolveToken 수치 검증

`packages/specs/src/renderers/utils/__tests__/tokenResolver.test.ts` 에서 이미 검증됨:

```
{spacing.xs}  → 4
{spacing.2xs} → 2
```

현재 하드코딩 값(`?? 4`, `?? 2`) 과 수치 동일. **시각 회귀 구조적 불가 확인.**

---

## Phase 1 — `resolveContainerStylesFallback` 추출 + listbox 분기 전환 (G1)

### 1.1 함수 설계

**파일**: `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`

**위치**: 기존 내부 상수 블록(`//─── 내부 상수 ───`) 직후, `applyImplicitStyles` 함수 앞.

```ts
import { resolveToken } from "@composition/specs";
import { TAG_SPEC_MAP } from "../../skia/specRegistry"; // 또는 직접 Spec import

/**
 * Spec.containerStyles 를 layout fallback 으로 변환한다.
 *
 * TokenRef 필드(gap/padding 등)는 resolveToken() 으로 숫자 변환.
 * 문자열/리터럴 필드(display/flexDirection)는 그대로 반환.
 * parentStyle 에 이미 값이 존재하는 경우 override 하지 않는다 (`?? 패턴`).
 *
 * @param tag         - element.tag (소문자 정규화 전)
 * @param parentStyle - containerEl 의 현재 style (사용자 저장값)
 * @returns 주입할 fallback 속성 객체 (빈 객체 가능)
 */
function resolveContainerStylesFallback(
  tag: string,
  parentStyle: Record<string, unknown>,
): Record<string, unknown> {
  // TAG_SPEC_MAP 조회 또는 직접 import 방식 중 선택
  // 직접 import 방식 (P1 에서는 listbox 만 대상이므로 간단한 switch 가능)
  const spec = TAG_SPEC_MAP[tag];
  const cs = spec?.containerStyles;
  if (!cs) return {};

  const result: Record<string, unknown> = {};

  // display / flexDirection — 리터럴 문자열
  if (cs.display !== undefined && parentStyle.display === undefined) {
    result.display = cs.display;
  }
  if (
    cs.flexDirection !== undefined &&
    parentStyle.flexDirection === undefined
  ) {
    result.flexDirection = cs.flexDirection;
  }

  // gap / padding — TokenRef 또는 숫자/문자열
  if (cs.gap !== undefined && parentStyle.gap === undefined) {
    const resolved = resolveToken(cs.gap as TokenRef);
    result.gap = typeof resolved === "number" ? resolved : cs.gap;
  }
  if (cs.padding !== undefined && parentStyle.padding === undefined) {
    const resolved = resolveToken(cs.padding as TokenRef);
    result.padding = typeof resolved === "number" ? resolved : cs.padding;
  }

  return result;
}
```

### 1.2 listbox 분기 전환

**Before** (`implicitStyles.ts:668-676`):

```ts
if (containerTag === "listbox") {
  effectiveParent = withParentStyle(containerEl, {
    ...parentStyle,
    display: parentStyle.display ?? "flex",
    flexDirection: parentStyle.flexDirection ?? "column",
    gap: parentStyle.gap ?? 2,
    padding: parentStyle.padding ?? 4,
  });
}
```

**After**:

```ts
if (containerTag === "listbox") {
  const specFallback = resolveContainerStylesFallback(
    containerTag,
    parentStyle,
  );
  if (Object.keys(specFallback).length > 0) {
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      ...specFallback,
    });
  }
}
```

### 1.3 TAG_SPEC_MAP 조회 경로 확인

`resolveContainerStylesFallback` 은 Spec 을 조회할 때 2가지 방법 중 선택:

**방법 1 (권장)**: `TAG_SPEC_MAP` 직접 참조

```ts
// implicitStyles.ts 에 이미 Spec 직접 import 다수 존재 (InlineAlertSpec, BreadcrumbsSpec 등)
// TAG_SPEC_MAP 이 있으면 tag → spec O(1) 조회 가능
import { TAG_SPEC_MAP } from "../../skia/specRegistry";
const spec = TAG_SPEC_MAP[tag.toLowerCase()];
```

**방법 2 (대안)**: listbox 만 대상이므로 직접 import

```ts
import { ListBoxSpec } from "@composition/specs";
// resolveContainerStylesFallback 내부에서 switch(tag) { case "listbox": return ListBoxSpec.containerStyles; }
```

P1 에서는 방법 2 가 더 단순하지만, 향후 범위 확대 시 방법 1 이 자동 확장됨. 착수 시점에 `TAG_SPEC_MAP` 가용성 확인 후 결정.

### 1.4 import 변경

`implicitStyles.ts` 상단:

```ts
// 추가
import { resolveToken } from "@composition/specs";
// 또는 TAG_SPEC_MAP 경로 import
```

`@composition/specs` 는 이미 `InlineAlertSpec`, `BreadcrumbsSpec` 등으로 import 되어 있으므로 번들 영향 없음.

---

## Phase 2 — drift test 교체 (G2)

### 2.1 현재 drift test 분석

**파일**: `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles-listbox.test.ts`

3개 test 모두 `ListBoxSpec.containerStyles` 의 값이 implicitStyles 하드코딩 fallback 과 일치하는지 확인:

- `display === "flex"` + `flexDirection === "column"` — Spec SSOT 검증
- `padding === "{spacing.xs}"` — TokenRef 선언 확인
- `gap === "{spacing.2xs}"` — TokenRef 선언 확인

### 2.2 교체 전략

P1 에서 `resolveContainerStylesFallback` 이 Spec 을 직접 읽으므로 drift test 의 목적(하드코딩 ↔ Spec 정합 보장)이 구조적으로 소멸한다. 따라서:

**전략 A (권장)**: drift test 파일 삭제 + resolver 단위 test 추가

`implicitStyles-listbox.test.ts` 삭제.

`resolveContainerStylesFallback` 에 대한 새 test 파일 추가:

```
apps/builder/src/builder/workspace/canvas/layout/engines/resolveContainerStylesFallback.test.ts
```

```ts
import { describe, expect, it } from "vitest";
// resolveContainerStylesFallback 을 export 또는 별도 모듈로 추출해야 test 가능
// 만약 private 유지 시: applyImplicitStyles 통합 test 로 대체

describe("resolveContainerStylesFallback — listbox", () => {
  it("빈 parentStyle 에서 Spec 값 반환", () => {
    const result = resolveContainerStylesFallback("listbox", {});
    expect(result.display).toBe("flex");
    expect(result.flexDirection).toBe("column");
    expect(result.gap).toBe(2); // {spacing.2xs} resolved
    expect(result.padding).toBe(4); // {spacing.xs} resolved
  });

  it("parentStyle 에 존재하는 속성은 override 하지 않음", () => {
    const result = resolveContainerStylesFallback("listbox", {
      display: "block",
      gap: 8,
    });
    expect(result.display).toBeUndefined(); // parentStyle 값 우선
    expect(result.gap).toBeUndefined(); // parentStyle 값 우선
    expect(result.flexDirection).toBe("column"); // 미설정 → Spec fallback
    expect(result.padding).toBe(4); // 미설정 → Spec fallback
  });

  it("containerStyles 미보유 tag 는 빈 객체 반환", () => {
    const result = resolveContainerStylesFallback("button", {});
    expect(Object.keys(result)).toHaveLength(0);
  });
});
```

**전략 B (보수적)**: drift test 를 resolver test 와 병존 유지

P1 이후에도 `implicitStyles-listbox.test.ts` 를 보존하여 이중 보호. 단, 3 test 모두 P1 이후에도 Spec 을 읽으므로 실질적 의미는 감소. 추후 정리 가능.

**권장은 전략 A**. P1 구현 완료 확인 후 삭제 진행.

---

## Phase 3 — 시각 회귀 검증 (G3)

### 3.1 `/cross-check` 실행

ListBox 컴포넌트에 대해 CSS ↔ Skia 시각 비교:

- 기본 ListBox (selectionMode="single", variant="default")
- items 3개 이상 포함, padding/gap 표시 가능한 크기
- Builder Skia 렌더와 Preview CSS 렌더 스크린샷 대조

체크 항목:

- [ ] 상단 padding 4px 확인
- [ ] items 간 gap 2px 확인
- [ ] flexDirection column (수직 배치) 확인

### 3.2 `/sweep` 컬렉션 family

영향 범위 확인을 위해 아래 컴포넌트 family 순차 확인:

- ListBox (직접 대상)
- Menu (containerStyles 보유이나 layout 미적용 — 스타일 주입 없음 분기)
- Select / ComboBox (ListBox 를 내부에 Popover 로 보유 — 간접 영향)

### 3.3 type-check + vitest

```bash
pnpm type-check          # 3/3 PASS 필수
pnpm vitest run          # 회귀 0 필수
```

---

## 구현 시 주의사항

### TAG_SPEC_MAP 가용성

`implicitStyles.ts` 가 `TAG_SPEC_MAP` 을 import 할 수 있는지 순환 의존성 확인 필요.

```bash
grep -r "import.*TAG_SPEC_MAP" apps/builder/src/ | head -5
```

순환이 감지되면 방법 2 (직접 ListBoxSpec import) 로 fallback.

### resolveToken 의 TokenRef 타입 처리

`cs.gap` 이 `TokenRef | string` 인 경우 `resolveToken` 이 문자열을 처리하지 못할 수 있음. 방어 코드:

```ts
import type { TokenRef } from "@composition/specs";

const raw = cs.gap;
if (typeof raw === "string" && raw.startsWith("{")) {
  const resolved = resolveToken(raw as TokenRef);
  result.gap = typeof resolved === "number" ? resolved : raw;
} else if (raw !== undefined) {
  result.gap = raw;
}
```

### parentStyle 의 `undefined` vs 미존재 키

`parentStyle.gap === undefined` 체크는 key 가 없거나 값이 undefined 인 경우 모두 포섭. `null` 은 포섭하지 않으나, implicitStyles 코드 관습상 null 은 존재하지 않으므로 문제 없음.

---

## 파일 변경 목록

| 파일                                                                                              | 변경 종류                                                        | Phase |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----- |
| `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`                      | 수정 — `resolveContainerStylesFallback` 추가 + listbox 분기 전환 | P1    |
| `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles-listbox.test.ts`         | 삭제 (전략 A) 또는 유지 (전략 B)                                 | P2    |
| `apps/builder/src/builder/workspace/canvas/layout/engines/resolveContainerStylesFallback.test.ts` | 신설 (전략 A)                                                    | P2    |

**Generator 변경 없음** — `CSSGenerator.ts` 는 이미 `containerStyles` 를 CSS 로 emit 하므로 수정 불필요.

**Spec 변경 없음** — `ListBoxSpec.containerStyles` 는 ADR-078/079 에서 이미 완비됨.

---

## 롤백 계획

P1 이 예상치 못한 시각 회귀를 발생시키는 경우:

1. `resolveContainerStylesFallback` 을 제거하고 원래 하드코딩 분기 복원 (`git revert`)
2. `implicitStyles-listbox.test.ts` drift test 는 P1 착수 전 상태이므로 자동 복원
3. 롤백 사유를 ADR-080 에 Addendum 으로 기록

롤백 위험이 낮은 이유: resolved 수치가 현재 하드코딩 값과 동일하므로 실질적 시각 변화 없음. 단, `resolveToken` 의 예외 처리 누락이나 import 경로 오류가 런타임 오류를 유발할 가능성은 G1 unit test 로 사전 차단.
