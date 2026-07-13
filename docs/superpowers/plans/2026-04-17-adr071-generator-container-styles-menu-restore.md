# ADR-071 Generator `containerStyles` 인프라 + Menu 정방향 복원 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADR-070 Addendum 1 Menu 수동 CSS debt 청산 — `ComponentSpec.containerStyles` 스키마 인프라 신설, `{color.raised}` / `{spacing.2xs}` 토큰 등록, Menu.spec 정방향 복원으로 Generator SSOT 회복.

**Architecture:** 3 Phase 독립 커밋. P1(token 인프라) → P2(schema+generator) → P3(Menu 복원+수동 CSS 해체). 각 Phase는 optional 필드/추가형 변경으로 기존 generated 집합 diff 0 보장.

**Tech Stack:** TypeScript 5, Vitest (snapshot), pnpm workspace, ComponentSpec DSL, CSSGenerator (`@composition/specs`).

**ADR:** [docs/adr/071-generator-container-styles-menu-restore.md](../../adr/completed/071-generator-container-styles-menu-restore.md)
**Breakdown:** [docs/adr/design/071-generator-container-styles-menu-restore-breakdown.md](../../adr/design/071-generator-container-styles-menu-restore-breakdown.md)

---

## File Structure

| 경로                                                                                      | 상태   | 책임                                                                                          |
| ----------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `packages/specs/src/renderers/utils/tokenResolver.ts`                                     | Modify | `COLOR_TOKEN_TO_CSS` 에 `"raised"` 매핑 추가 (P1)                                             |
| `packages/specs/src/types/token.types.ts`                                                 | Modify | `SpacingTokens` 에 `"2xs": number` 필드 추가 (P1)                                             |
| `packages/specs/src/primitives/spacing.ts`                                                | Modify | `spacing` 객체에 `"2xs": 2` 값 추가 (P1)                                                      |
| `packages/specs/src/renderers/utils/__tests__/tokenResolver.test.ts`                      | Create | TokenRef/spacing 매핑 단위 테스트 (P1)                                                        |
| `packages/specs/src/types/spec.types.ts`                                                  | Modify | `ContainerStylesSchema` interface 신설 + `ComponentSpec.containerStyles?` 필드 (P2)           |
| `packages/specs/src/renderers/CSSGenerator.ts`                                            | Modify | `emitContainerStyles` 헬퍼 신설 + `generateBaseStyles` S3 분기 + variants 블록 skip 조건 (P2) |
| `packages/specs/src/renderers/__tests__/CSSGenerator.containerStyles.test.ts`             | Create | `containerStyles` 분기 단위 테스트 (P2)                                                       |
| `packages/specs/src/components/Menu.spec.ts`                                              | Modify | `skipCSSGeneration: true` 제거 + `containerStyles` 블록 정의 (P3)                             |
| `packages/specs/src/renderers/__tests__/__snapshots__/CSSGenerator.snapshot.test.ts.snap` | Modify | Menu 신규 snapshot 추가 (P3, `pnpm test -u`)                                                  |
| `packages/shared/src/components/styles/Menu.css`                                          | Delete | 수동 CSS 해체 (P3)                                                                            |
| `packages/shared/src/components/Menu.tsx`                                                 | Modify | import 경로 `./styles/Menu.css` → `./styles/generated/Menu.css` (P3)                          |
| `packages/shared/src/components/styles/index.css`                                         | Modify | `@import "./Menu.css"` → `@import "./generated/Menu.css"` (P3)                                |
| `packages/shared/src/components/styles/generated/Menu.css`                                | Auto   | `pnpm build:specs` 재생성 (P3)                                                                |

---

## Phase P1 — Token 인프라

### Task P1.1: `{color.raised}` TokenRef 매핑 + tokenResolver 단위 테스트 신설

**Files:**

- Create: `packages/specs/src/renderers/utils/__tests__/tokenResolver.test.ts`
- Modify: `packages/specs/src/renderers/utils/tokenResolver.ts`

- [ ] **Step 1: 테스트 파일 생성 (failing)**

Create `packages/specs/src/renderers/utils/__tests__/tokenResolver.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tokenToCSSVar, resolveToken } from "../tokenResolver";

describe("tokenResolver — surface elevation", () => {
  it("{color.raised} maps to var(--bg-raised)", () => {
    expect(tokenToCSSVar("{color.raised}")).toBe("var(--bg-raised)");
  });

  it("{color.base} maps to var(--bg) (baseline)", () => {
    expect(tokenToCSSVar("{color.base}")).toBe("var(--bg)");
  });

  it("{color.layer-1} maps to var(--bg-overlay) (baseline)", () => {
    expect(tokenToCSSVar("{color.layer-1}")).toBe("var(--bg-overlay)");
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pnpm -F @composition/specs test -- tokenResolver`
Expected: FAIL on `{color.raised}` case — 현재 매핑 없어서 fallback `var(--raised)` 반환.

- [ ] **Step 3: `COLOR_TOKEN_TO_CSS` 에 매핑 추가**

Edit `packages/specs/src/renderers/utils/tokenResolver.ts`, `COLOR_TOKEN_TO_CSS` 객체의 `// --- Surface / Layer ---` 섹션:

```ts
  // --- Surface / Layer ---
  base: "var(--bg)",
  raised: "var(--bg-raised)",        // ← ADR-071 신설
  "layer-1": "var(--bg-overlay)",
  "layer-2": "var(--bg-inset)",
  elevated: "var(--color-white)",
  disabled: "var(--color-neutral-200)",
```

- [ ] **Step 4: 테스트 재실행 → 통과 확인**

Run: `pnpm -F @composition/specs test -- tokenResolver`
Expected: PASS 3 tests.

- [ ] **Step 5: 기존 snapshot 회귀 확증**

Run: `pnpm -F @composition/specs test -- CSSGenerator.snapshot`
Expected: PASS all 91 spec snapshots, diff 0 (`{color.raised}` 아직 사용처 없음).

- [ ] **Step 6: Commit**

```bash
git add packages/specs/src/renderers/utils/tokenResolver.ts \
        packages/specs/src/renderers/utils/__tests__/tokenResolver.test.ts
git commit -m "feat(tokens): add {color.raised} TokenRef for popover container (ADR-071 P1.1)"
```

---

### Task P1.2: `SpacingTokens."2xs"` primitive 등록

**Files:**

- Modify: `packages/specs/src/types/token.types.ts`
- Modify: `packages/specs/src/primitives/spacing.ts`
- Modify: `packages/specs/src/renderers/utils/__tests__/tokenResolver.test.ts`

- [ ] **Step 1: 테스트 case 추가 (failing)**

Edit `packages/specs/src/renderers/utils/__tests__/tokenResolver.test.ts` — 파일 끝에 describe 블록 추가:

```ts
describe("tokenResolver — spacing 2xs primitive", () => {
  it("{spacing.2xs} resolves to 2 (px)", () => {
    expect(resolveToken("{spacing.2xs}")).toBe(2);
  });

  it("{spacing.2xs} maps to var(--spacing-2xs)", () => {
    expect(tokenToCSSVar("{spacing.2xs}")).toBe("var(--spacing-2xs)");
  });

  it("{spacing.xs} still resolves to 4 (baseline unaffected)", () => {
    expect(resolveToken("{spacing.xs}")).toBe(4);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pnpm -F @composition/specs test -- tokenResolver`
Expected: FAIL on `{spacing.2xs}` — `spacing["2xs"]` undefined + `console.warn` 출력.

- [ ] **Step 3: `SpacingTokens` 타입 확장**

Edit `packages/specs/src/types/token.types.ts:146` (`SpacingTokens` interface):

```ts
export interface SpacingTokens {
  "2xs": number; // 2 (0.125rem) — ADR-071
  xs: number; // 4
  sm: number; // 8
  md: number; // 16
  lg: number; // 24
  xl: number; // 32
  "2xl": number; // 48
}
```

- [ ] **Step 4: `spacing` primitive 값 추가**

Edit `packages/specs/src/primitives/spacing.ts:14`:

```ts
export const spacing: SpacingTokens = {
  "2xs": 2, // ← ADR-071 신설. --spacing-2xs: 0.125rem = 2px 정합
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
};
```

- [ ] **Step 5: 테스트 재실행 → 통과 확인**

Run: `pnpm -F @composition/specs test -- tokenResolver`
Expected: PASS 6 tests (3 surface + 3 spacing).

- [ ] **Step 6: type-check 통과 확증**

Run: `pnpm type-check`
Expected: PASS 3 tasks (SpacingTokens 사용처가 primitive 이외 없는지 tsc 확증).

- [ ] **Step 7: 기존 snapshot 무회귀 확증**

Run: `pnpm -F @composition/specs test -- CSSGenerator.snapshot`
Expected: PASS 91 snapshots, diff 0 (`{spacing.2xs}` 사용처 아직 없음).

- [ ] **Step 8: Commit**

```bash
git add packages/specs/src/types/token.types.ts \
        packages/specs/src/primitives/spacing.ts \
        packages/specs/src/renderers/utils/__tests__/tokenResolver.test.ts
git commit -m "feat(tokens): register {spacing.2xs} primitive (ADR-071 P1.2)"
```

---

## Phase P2 — Generator containerStyles 인프라

### Task P2.1: `ContainerStylesSchema` 타입 + `emitContainerStyles` 헬퍼 + 단위 테스트

**Files:**

- Modify: `packages/specs/src/types/spec.types.ts`
- Modify: `packages/specs/src/renderers/CSSGenerator.ts` (헬퍼 신설, generateBaseStyles 분기는 P2.2)
- Create: `packages/specs/src/renderers/__tests__/CSSGenerator.containerStyles.test.ts`

- [ ] **Step 1: `ContainerStylesSchema` 타입 정의 + `ComponentSpec.containerStyles?` 필드**

Edit `packages/specs/src/types/spec.types.ts` — `ComponentSpec<Props>` interface 직전 (또는 내부 인접 위치):

```ts
/**
 * Container Styles Schema (ADR-071)
 *
 * non-composite Spec이 CSS 컨테이너 시각을 직접 소유하기 위한 스키마.
 * `variants`(Skia trigger 전용) 와 독립 축으로 작동 (S3 semantic):
 * - `containerStyles` 존재 시 `defaultVariant` 색상 주입 skip + variants 블록 skip
 * - 색상은 TokenRef 필수 (D3 정본 — dark mode 자동 반전 보장)
 * - 구조 속성은 TokenRef 우선, CSS 값 보조
 */
export interface ContainerStylesSchema {
  // 색상 — TokenRef 필수
  background?: TokenRef;
  text?: TokenRef; // → CSS `color`
  border?: TokenRef; // → CSS `border-color`
  borderWidth?: number; // → CSS `border-width` (px)

  // 구조 — TokenRef 우선, CSS 값 보조
  borderRadius?: TokenRef | string;
  padding?: TokenRef | string;
  gap?: TokenRef | string;

  // 컨테이너 제약 — CSS 값 (SSOT 대상 아님)
  width?: string;
  maxHeight?: string;
  overflow?: "auto" | "scroll" | "visible" | "hidden";
  outline?: string;
}
```

`ComponentSpec<Props>` interface 내부 (기존 `composition?` 필드 근처):

```ts
  /**
   * 컨테이너 시각 스타일 (ADR-071 — non-composite spec용).
   * 설정 시 `defaultVariant` 색상 주입과 `variants` CSS 블록 생성 skip.
   * `spec.composition.containerStyles`(legacy, `Record<string,string>`) 와 별개 필드.
   */
  containerStyles?: ContainerStylesSchema;
```

- [ ] **Step 2: 테스트 파일 생성 (failing)**

Create `packages/specs/src/renderers/__tests__/CSSGenerator.containerStyles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { ContainerStylesSchema } from "../../types/spec.types";

// 내부 헬퍼를 테스트하기 위해 re-export 필요 — Step 3 에서 구현
import { emitContainerStyles } from "../CSSGenerator";

describe("emitContainerStyles — ADR-071", () => {
  it("emits TokenRef colors via tokenToCSSVar", () => {
    const c: ContainerStylesSchema = {
      background: "{color.raised}",
      text: "{color.neutral}",
      border: "{color.border}",
      borderWidth: 1,
    };
    const lines = emitContainerStyles(c);
    expect(lines).toContain("  background: var(--bg-raised);");
    expect(lines).toContain("  color: var(--fg);");
    expect(lines).toContain("  border: 1px solid var(--border);");
  });

  it("emits TokenRef structure props", () => {
    const c: ContainerStylesSchema = {
      borderRadius: "{radius.md}",
      padding: "{spacing.xs}",
      gap: "{spacing.2xs}",
    };
    const lines = emitContainerStyles(c);
    expect(lines).toContain("  border-radius: var(--radius-md);");
    expect(lines).toContain("  padding: var(--spacing-xs);");
    expect(lines).toContain("  gap: var(--spacing-2xs);");
  });

  it("emits raw CSS values for string props", () => {
    const c: ContainerStylesSchema = {
      width: "100%",
      maxHeight: "300px",
      overflow: "auto",
      outline: "none",
    };
    const lines = emitContainerStyles(c);
    expect(lines).toContain("  width: 100%;");
    expect(lines).toContain("  max-height: 300px;");
    expect(lines).toContain("  overflow: auto;");
    expect(lines).toContain("  outline: none;");
  });

  it("emits empty array when no fields set", () => {
    expect(emitContainerStyles({})).toEqual([]);
  });

  it("defaults borderWidth to 1 when border set without width", () => {
    const lines = emitContainerStyles({ border: "{color.border}" });
    expect(lines).toContain("  border: 1px solid var(--border);");
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인 (import 오류)**

Run: `pnpm -F @composition/specs test -- CSSGenerator.containerStyles`
Expected: FAIL — `emitContainerStyles is not exported from CSSGenerator`.

- [ ] **Step 4: `emitContainerStyles` 헬퍼 구현 + export**

Edit `packages/specs/src/renderers/CSSGenerator.ts` — `generateVariantStyles` 직전 또는 파일 하단 적절한 위치 추가:

```ts
// ─── ADR-071: containerStyles emit 헬퍼 ─────────────────────────────────────

/**
 * `ContainerStylesSchema` 를 CSS line 배열로 변환.
 * TokenRef(`{...}`) 는 tokenToCSSVar 경유, CSS 값은 그대로 emit.
 * border 는 borderWidth(기본 1) + color 조합.
 */
export function emitContainerStyles(c: ContainerStylesSchema): string[] {
  const lines: string[] = [];

  if (c.background) lines.push(`  background: ${tokenToCSSVar(c.background)};`);
  if (c.text) lines.push(`  color: ${tokenToCSSVar(c.text)};`);
  if (c.border) {
    const bw = c.borderWidth ?? 1;
    lines.push(`  border: ${bw}px solid ${tokenToCSSVar(c.border)};`);
  }
  if (c.borderRadius != null) {
    const v =
      typeof c.borderRadius === "string" && c.borderRadius.startsWith("{")
        ? tokenToCSSVar(c.borderRadius as TokenRef)
        : c.borderRadius;
    lines.push(`  border-radius: ${v};`);
  }
  if (c.padding != null) {
    const v =
      typeof c.padding === "string" && c.padding.startsWith("{")
        ? tokenToCSSVar(c.padding as TokenRef)
        : c.padding;
    lines.push(`  padding: ${v};`);
  }
  if (c.gap != null) {
    const v =
      typeof c.gap === "string" && c.gap.startsWith("{")
        ? tokenToCSSVar(c.gap as TokenRef)
        : c.gap;
    lines.push(`  gap: ${v};`);
  }
  if (c.width) lines.push(`  width: ${c.width};`);
  if (c.maxHeight) lines.push(`  max-height: ${c.maxHeight};`);
  if (c.overflow) lines.push(`  overflow: ${c.overflow};`);
  if (c.outline) lines.push(`  outline: ${c.outline};`);

  return lines;
}
```

`CSSGenerator.ts` 상단 import 구역에 `ContainerStylesSchema` 추가:

```ts
import type {
  ComponentSpec,
  ArchetypeId,
  VariantSpec,
  SizeSpec,
  ContainerStylesSchema, // ← 추가
} from "../types";
```

(또는 `spec.types` 에서 직접 import. 기존 `../types` re-export 경로 따름.)

`packages/specs/src/types/index.ts` 에 `ContainerStylesSchema` re-export 확인 — 없으면 추가:

```ts
export type { ContainerStylesSchema } from "./spec.types";
```

- [ ] **Step 5: 테스트 재실행 → 통과 확인**

Run: `pnpm -F @composition/specs test -- CSSGenerator.containerStyles`
Expected: PASS 5 tests.

- [ ] **Step 6: type-check + 기존 snapshot 무회귀**

Run: `pnpm type-check && pnpm -F @composition/specs test -- CSSGenerator.snapshot`
Expected: PASS 3 tasks + 91 snapshots diff 0 (헬퍼 추가만, 사용처 없음).

- [ ] **Step 7: Commit**

```bash
git add packages/specs/src/types/spec.types.ts \
        packages/specs/src/types/index.ts \
        packages/specs/src/renderers/CSSGenerator.ts \
        packages/specs/src/renderers/__tests__/CSSGenerator.containerStyles.test.ts
git commit -m "feat(specs): add ContainerStylesSchema + emitContainerStyles helper (ADR-071 P2.1)"
```

---

### Task P2.2: `generateBaseStyles` S3 분기 + variants 블록 skip 조건

**Files:**

- Modify: `packages/specs/src/renderers/CSSGenerator.ts`
- Modify: `packages/specs/src/renderers/__tests__/CSSGenerator.containerStyles.test.ts`

- [ ] **Step 1: 통합 테스트 case 추가 (failing)**

Edit `packages/specs/src/renderers/__tests__/CSSGenerator.containerStyles.test.ts` — 파일 끝에 추가:

```ts
import { generateCSS } from "../CSSGenerator";
import type { ComponentSpec } from "../../types/spec.types";

describe("generateCSS — containerStyles S3 semantic (ADR-071)", () => {
  const baseSpec: ComponentSpec<{ variant?: string }> = {
    name: "FakePopover",
    archetype: "collection",
    element: "div",
    defaultVariant: "primary",
    defaultSize: "md",
    variants: {
      primary: {
        background: "{color.neutral}",
        backgroundHover: "{color.neutral-hover}",
        backgroundPressed: "{color.neutral-pressed}",
        text: "{color.base}",
        border: "{color.neutral}",
      },
    },
    sizes: {
      md: {
        height: 0,
        paddingX: 12,
        paddingY: 4,
        fontSize: 14,
        borderRadius: 6,
        borderWidth: 1,
        gap: 4,
      },
    },
    states: {},
    render: {
      shapes: () => [],
      react: () => ({}),
      pixi: () => ({}),
    },
  };

  it("emits containerStyles in base instead of defaultVariant colors", () => {
    const spec: ComponentSpec<{ variant?: string }> = {
      ...baseSpec,
      containerStyles: {
        background: "{color.raised}",
        text: "{color.neutral}",
      },
    };
    const css = generateCSS(spec);
    expect(css).toContain("background: var(--bg-raised);");
    expect(css).toContain("color: var(--fg);");
    // defaultVariant.background (`{color.neutral}` = `var(--fg)`) 가 `background:` 로
    // 주입되어 있으면 안 됨 — 위 `var(--fg)` 는 text 쪽이고, background 는 raised.
    expect(css).not.toMatch(/background:\s*var\(--fg\);/);
  });

  it("skips [data-variant=...] blocks when containerStyles present", () => {
    const spec: ComponentSpec<{ variant?: string }> = {
      ...baseSpec,
      containerStyles: { background: "{color.raised}" },
    };
    const css = generateCSS(spec);
    expect(css).not.toContain('[data-variant="primary"]');
  });

  it("keeps defaultVariant injection + variants block when containerStyles absent (baseline)", () => {
    const css = generateCSS(baseSpec);
    // defaultVariant: "primary" → {color.neutral} = var(--fg)
    expect(css).toContain("background: var(--fg);");
    expect(css).toContain('[data-variant="primary"]');
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pnpm -F @composition/specs test -- CSSGenerator.containerStyles`
Expected: FAIL on first 2 tests — `generateBaseStyles` 가 아직 `containerStyles` 분기 없음, variants 블록도 skip 안 됨.

- [ ] **Step 3: `generateBaseStyles` 분기 수정**

Edit `packages/specs/src/renderers/CSSGenerator.ts` — `generateBaseStyles` 내 defaultVariant 색상 주입 영역 (현재 `line 485~523`):

```ts
const defaultVariant =
  spec.variants != null && spec.defaultVariant != null
    ? spec.variants[spec.defaultVariant]
    : undefined;
const defaultSize = spec.sizes[spec.defaultSize];

const lines = [`  /* Base styles — archetype: ${archetype ?? "default"} */`];
lines.push(...baseStyles);

// ADR-071 S3: containerStyles 있으면 defaultVariant 색상 주입 skip
if (spec.containerStyles) {
  lines.push("");
  lines.push("  /* Container styles (ADR-071) */");
  lines.push(...emitContainerStyles(spec.containerStyles));
} else if (defaultVariant && !spec.composition) {
  // 기존 defaultVariant 색상 주입 로직 (line 495~523 그대로)
  const mode = spec.cssEmitMode ?? "direct";
  lines.push("");
  lines.push("  /* Default variant */");
  lines.push(
    emitColorLine("background", tokenToCSSVar(defaultVariant.background), mode),
  );
  lines.push(emitColorLine("text", tokenToCSSVar(defaultVariant.text), mode));
  if (defaultVariant.border) {
    const bw = defaultSize?.borderWidth ?? 1;
    if (mode === "button-base") {
      lines.push(
        emitColorLine("border", tokenToCSSVar(defaultVariant.border), mode),
      );
    } else {
      lines.push(
        `  border: ${bw}px solid ${tokenToCSSVar(defaultVariant.border)};`,
      );
    }
  } else {
    if (mode === "direct") {
      lines.push("  border: none;");
    }
  }
}

// default size 속성 — 기존 로직 그대로
// ...
```

- [ ] **Step 4: variants 블록 skip 조건 수정**

Edit `packages/specs/src/renderers/CSSGenerator.ts:163`:

```ts
// Variant 스타일 — Composite, containerStyles(ADR-071), variants 없는 Spec,
// 또는 skipVariantCss:true 일 때 skip
const variantMode = spec.cssEmitMode ?? "direct";
if (
  !spec.composition &&
  !spec.containerStyles && // ← ADR-071 추가
  spec.variants != null &&
  !spec.skipVariantCss
)
  for (const [variantName, variantSpec] of Object.entries(spec.variants)) {
    // ... 기존 로직
  }
```

- [ ] **Step 5: 테스트 재실행 → 통과 확인**

Run: `pnpm -F @composition/specs test -- CSSGenerator.containerStyles`
Expected: PASS 8 tests (5 emit + 3 generateCSS).

- [ ] **Step 6: 기존 91 snapshot 무회귀 확증**

Run: `pnpm -F @composition/specs test -- CSSGenerator.snapshot`
Expected: PASS 91 snapshots, diff 0. 기존 spec 중 `containerStyles` 설정 0건 → 기존 동작 불변.

- [ ] **Step 7: `pnpm -F @composition/specs test -- CSSGenerator` 스위트 전체 통과**

Run: `pnpm -F @composition/specs test -- CSSGenerator`
Expected: PASS 91 snapshots + 8 containerStyles + animationRewrite + sizeSelectors + rootSelectors 전체.

- [ ] **Step 8: type-check**

Run: `pnpm type-check`
Expected: PASS 3 tasks.

- [ ] **Step 9: Commit**

```bash
git add packages/specs/src/renderers/CSSGenerator.ts \
        packages/specs/src/renderers/__tests__/CSSGenerator.containerStyles.test.ts
git commit -m "feat(specs): add ComponentSpec.containerStyles S3 axis in generateBaseStyles (ADR-071 P2.2)"
```

---

## Phase P3 — Menu 정방향 복원

### Task P3.1: Menu.spec 에 `containerStyles` 블록 정의 + `skipCSSGeneration` 제거

**Files:**

- Modify: `packages/specs/src/components/Menu.spec.ts`
- Modify (자동): `packages/specs/src/renderers/__tests__/__snapshots__/CSSGenerator.snapshot.test.ts.snap` (Menu 신규 snapshot 추가)

- [ ] **Step 1: 현재 Menu.spec 상태 확인**

Run: `head -80 packages/specs/src/components/Menu.spec.ts | tail -30`
Expected: line 72 `skipCSSGeneration: true`, line 74 `defaultVariant: "primary"`, line 87 `variants:` 존재.

- [ ] **Step 2: Menu.spec 수정 — `skipCSSGeneration` 제거 + `containerStyles` 추가**

Edit `packages/specs/src/components/Menu.spec.ts` — MenuSpec 객체 내부:

```ts
export const MenuSpec: ComponentSpec<MenuProps> = {
  name: "Menu",
  description: "React Aria 기반 드롭다운 메뉴 컴포넌트",
  archetype: "collection",
  element: "div",
  // ADR-071 P3: skipCSSGeneration 제거 — containerStyles 로 popover container 시각 직접 소유
  // ADR-070 Addendum 1 debt 해체

  defaultVariant: "primary", // Skia trigger 팔레트 유지 (Button 동형)
  defaultSize: "md",

  // ADR-071: popover container 시각 SSOT
  // `variants` 는 Skia trigger 전용 (render.shapes), CSS 경로는 이 블록만 사용
  containerStyles: {
    background: "{color.raised}",
    text: "{color.neutral}",
    border: "{color.border}",
    borderWidth: 1,
    borderRadius: "{radius.md}", // = var(--radius-md) = var(--border-radius) (shared-tokens.css:472)
    padding: "{spacing.xs}",
    gap: "{spacing.2xs}",
    width: "100%",
    maxHeight: "300px",
    overflow: "auto",
    outline: "none",
  },

  overlay: {
    /* 기존 그대로 */
  },
  variants: {
    /* 기존 그대로 — Skia trigger 전용 */
  },
  sizes: {
    /* 기존 그대로 */
  },
  states: {
    /* 기존 그대로 */
  },
  properties: {
    /* 기존 그대로 */
  },
  render: {
    /* 기존 그대로 */
  },
};
```

(주석 삭제/추가 후 `skipCSSGeneration: true,` 줄을 완전히 제거. 다른 필드는 변경하지 않음.)

- [ ] **Step 3: type-check 통과 확증**

Run: `pnpm type-check`
Expected: PASS 3 tasks.

- [ ] **Step 4: snapshot 실행 → 신규 Menu snapshot 생성 필요 확인**

Run: `pnpm -F @composition/specs test -- CSSGenerator.snapshot`
Expected: FAIL on `Menu` — snapshot 파일에 Menu entry 없음 (기존에 skipCSSGeneration 으로 제외됨).

- [ ] **Step 5: snapshot 업데이트 (Menu 신규 entry 생성)**

Run: `pnpm -F @composition/specs test -- CSSGenerator.snapshot -u`
Expected: PASS — `__snapshots__/CSSGenerator.snapshot.test.ts.snap` 파일에 `Menu` entry 신규 추가됨.

- [ ] **Step 6: 생성된 Menu snapshot 내용 검증**

Run: `git diff packages/specs/src/renderers/__tests__/__snapshots__/CSSGenerator.snapshot.test.ts.snap | grep -A 30 "^\+.*Menu"`

Expected: 새 entry에 아래 CSS 포함 확인:

- `background: var(--bg-raised);`
- `color: var(--fg);`
- `border: 1px solid var(--border);`
- `border-radius: var(--radius-md);`
- `padding: var(--spacing-xs);`
- `gap: var(--spacing-2xs);`
- `width: 100%;`
- `max-height: 300px;`
- `overflow: auto;`
- `outline: none;`
- `[data-focus-visible]` outline rule (states.focusVisible 경유)
- `[data-variant=...]` 블록 **없음** (containerStyles 있으면 skip)

다른 91개 snapshot 변경 0 확증:
Run: `git diff --stat packages/specs/src/renderers/__tests__/__snapshots__/`
Expected: 1 file changed, insertions only (Menu entry 추가분).

- [ ] **Step 7: Commit**

```bash
git add packages/specs/src/components/Menu.spec.ts \
        packages/specs/src/renderers/__tests__/__snapshots__/CSSGenerator.snapshot.test.ts.snap
git commit -m "feat(menu): define containerStyles + remove skipCSSGeneration (ADR-071 P3.1)"
```

---

### Task P3.2: 수동 CSS 해체 + import 경로 원복 + generated/Menu.css 재생성

**Files:**

- Delete: `packages/shared/src/components/styles/Menu.css`
- Modify: `packages/shared/src/components/Menu.tsx`
- Modify: `packages/shared/src/components/styles/index.css`
- Create (자동): `packages/shared/src/components/styles/generated/Menu.css`

- [ ] **Step 1: 수동 Menu.css 삭제**

Run: `rm packages/shared/src/components/styles/Menu.css`

- [ ] **Step 2: Menu.tsx import 경로 원복**

Edit `packages/shared/src/components/Menu.tsx:22`:

```diff
-import "./styles/Menu.css";
+import "./styles/generated/Menu.css";
```

- [ ] **Step 3: index.css import 경로 원복**

Edit `packages/shared/src/components/styles/index.css:137` (또는 실제 라인 재확인):

```diff
-@import "./Menu.css"; /* 수동 CSS — popover container 색상을 ListBox와 동일하게 (Menu.spec.skipCSSGeneration:true) */
+@import "./generated/Menu.css";
```

- [ ] **Step 4: `pnpm build:specs` 실행 → generated/Menu.css 재생성**

Run: `pnpm build:specs`
Expected: 로그에 `Generated: Menu.css` (또는 등가) 포함, `packages/shared/src/components/styles/generated/Menu.css` 파일 생성됨.

- [ ] **Step 5: 생성된 generated/Menu.css 내용 검증**

Run: `cat packages/shared/src/components/styles/generated/Menu.css`

Expected: 아래 규칙 포함:

```css
@layer components {
  .react-aria-Menu {
    /* Base styles — archetype: collection */
    display: flex;
    flex-direction: column;
    box-sizing: border-box;

    /* Container styles (ADR-071) */
    background: var(--bg-raised);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-xs);
    gap: var(--spacing-2xs);
    width: 100%;
    max-height: 300px;
    overflow: auto;
    outline: none;

    /* Default size */
    /* ... sizes.md 속성 */
  }

  .react-aria-Menu[data-focus-visible] {
    outline: var(--focus-ring-width) solid var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }
}
```

`[data-variant="..."]` 블록 **없음** 확증 (containerStyles skip 조건 발동).

- [ ] **Step 6: 기존 91 CSS diff 0 확증**

Run: `git status packages/shared/src/components/styles/generated/ && git diff --stat packages/shared/src/components/styles/generated/`

Expected:

- `styles/generated/Menu.css` → **new file** (신규 추가)
- 다른 91 파일 변경 0 (git diff 0 bytes)

- [ ] **Step 7: type-check**

Run: `pnpm type-check`
Expected: PASS 3 tasks.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/components/Menu.tsx \
        packages/shared/src/components/styles/index.css \
        packages/shared/src/components/styles/generated/Menu.css
git rm packages/shared/src/components/styles/Menu.css
git commit -m "feat(menu): dismantle manual Menu.css, restore Spec-first CSS generation (ADR-071 P3.2)"
```

---

### Task P3.3: Gate 검증 (G1~G4)

**Files:** No code changes — verification only.

- [ ] **Step 1: Gate G1 — 테스트 전체 통과 + primitive 유효**

Run: `pnpm -F @composition/specs test -- CSSGenerator`
Expected: PASS all (91 snapshots + 8 containerStyles + animationRewrite + sizeSelectors + rootSelectors).

Run: `pnpm -F @composition/specs test -- tokenResolver`
Expected: PASS 6 tests. `{spacing.2xs}` resolveToken → `2`, console.warn 0건.

Run: `pnpm type-check`
Expected: PASS 3 tasks.

- [ ] **Step 2: Gate G2 — generated 집합 diff 검증**

Run: `git diff --stat packages/shared/src/components/styles/generated/`
Expected: `Menu.css` 신규 1건 추가, 기존 91 파일 변경 0 bytes.

Run: `cat packages/shared/src/components/styles/generated/Menu.css | grep -E "width:|background:|border:|padding:|gap:|max-height:|overflow:|outline:"`
Expected: 10 줄 (width/background/color/border/border-radius/padding/gap/width 중복 제외/max-height/overflow/outline) — 위 P3.2 Step 5 목록 일치.

- [ ] **Step 3: Gate G3 — Chrome MCP 시각 정합 (light/dark)**

Run: `pnpm dev` (builder) 실행 후 Chrome MCP로:

1. Menu element 추가 (또는 기존 페이지 로드).
2. Preview 탭 이동.
3. light mode 스크린샷 — Menu popover 배경 `#ffffff` 근사 (`--bg-raised` light) + 텍스트 진한 회색.
4. ThemeStudio 또는 html class 변경으로 dark mode 전환.
5. dark mode 스크린샷 — Menu popover 배경 진한 회색 (`--bg-raised` dark zinc-850) + 텍스트 밝은 회색.
6. ADR-070 Addendum 1 이전 수동 CSS 시각과 육안 동등성 확인.

Expected: light/dark 모두 반전 없이 팔레트 정합.

- [ ] **Step 4: Gate G4 — Skia trigger 시각 불변**

Chrome MCP 상에서:

1. Builder 탭으로 이동.
2. Canvas 위 Menu trigger 버튼 클릭/hover.
3. ADR-070 Addendum 1 이전 상태와 시각 동등성 확인 — `variants.primary` 기반 검정 배경 + 앱 배경 텍스트 (Button primary 동형).

Expected: Skia render.shapes 변경 없음 → trigger 시각 불변.

- [ ] **Step 5: 최종 Residual Risk 확증**

Run: `git status` — 변경 파일 목록 검토:

- `packages/specs/src/types/token.types.ts` (P1.2)
- `packages/specs/src/primitives/spacing.ts` (P1.2)
- `packages/specs/src/renderers/utils/tokenResolver.ts` (P1.1)
- `packages/specs/src/renderers/utils/__tests__/tokenResolver.test.ts` (P1.1/P1.2 신규)
- `packages/specs/src/types/spec.types.ts` (P2.1)
- `packages/specs/src/types/index.ts` (P2.1 re-export)
- `packages/specs/src/renderers/CSSGenerator.ts` (P2.1 헬퍼 + P2.2 분기)
- `packages/specs/src/renderers/__tests__/CSSGenerator.containerStyles.test.ts` (P2.1/P2.2 신규)
- `packages/specs/src/renderers/__tests__/__snapshots__/CSSGenerator.snapshot.test.ts.snap` (P3.1 Menu entry)
- `packages/specs/src/components/Menu.spec.ts` (P3.1)
- `packages/shared/src/components/Menu.tsx` (P3.2)
- `packages/shared/src/components/styles/index.css` (P3.2)
- `packages/shared/src/components/styles/generated/Menu.css` (P3.2 auto)
- `packages/shared/src/components/styles/Menu.css` (P3.2 삭제)

Expected: 위 13 파일 (수정 12 + 삭제 1). ListBox/Popover 수정 0 (scope α 준수).

- [ ] **Step 6: 종합 검증 완료 로그**

```bash
echo "=== ADR-071 Gate 검증 완료 ==="
echo "G1: tokenResolver 6 + CSSGenerator 스위트 전체 PASS"
echo "G2: generated/ 91 diff 0 + Menu.css 신규 추가"
echo "G3: Chrome MCP light/dark 시각 정합"
echo "G4: Skia trigger 시각 불변"
echo "Residual: ListBox/Popover 후속 ADR 로드맵 유지"
```

(이 단계는 commit 대상 아님 — 3 Phase commit(P1.1/P1.2/P2.1/P2.2/P3.1/P3.2 총 6 commit)은 이미 완료 상태. P3.3 은 최종 검증 로그용.)

---

## Self-Review

1. **Spec coverage**:
   - ADR Hard Constraints 6건 → P3.3 Gate 검증 Step 1~5 로 모두 체크
   - ADR Alternatives B 설명의 핵심 (`containerStyles` + `{color.raised}` + `{spacing.2xs}` + width 필드) → P1.1/P1.2/P2.1/P3.1 로 모두 커버
   - ADR Gate G1~G4 → P3.3 Step 1~4 로 1:1 매핑
   - ADR Residual Risks 5건 → scope 외(`[data-empty]`/legacy 전수/Popover/ListBox)는 의식적 수용, primitive/width 영향은 P3.3 Step 2/5 로 확증

2. **Placeholder scan**: "TODO"/"TBD" 0건. 모든 step에 파일 경로/명령어/예상 출력 명시.

3. **Type consistency**:
   - `ContainerStylesSchema` 필드명 (background/text/border/borderWidth/borderRadius/padding/gap/width/maxHeight/overflow/outline) 이 P2.1 타입 정의/P2.1 테스트/P2.1 헬퍼/P3.1 Menu.spec 에서 동일 사용
   - `emitContainerStyles` 함수명 P2.1 export + P2.1 테스트 import + P2.2 `generateBaseStyles` 내 호출 일치
   - `tokenToCSSVar`/`resolveToken` 기존 함수 재사용 — 경로 `packages/specs/src/renderers/utils/tokenResolver.ts`

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-adr071-generator-container-styles-menu-restore.md`. Two execution options:

1. **Subagent-Driven (recommended)** — 각 Task 별 fresh subagent 디스패치, Task 완료 후 main session 에서 review, TDD 사이클 엄수.

2. **Inline Execution** — 현재 세션에서 executing-plans skill 로 batch 실행, Phase 단위 checkpoint.

**Which approach?**
