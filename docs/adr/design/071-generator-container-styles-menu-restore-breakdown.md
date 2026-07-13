# ADR-071 구현 상세 — Generator containerStyles 인프라 + Menu 정방향 복원

> **관련 ADR**: [071-generator-container-styles-menu-restore.md](../completed/071-generator-container-styles-menu-restore.md)
> **SSOT 맥락**: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) D3(시각) — Menu Spec의 "variants=Skia trigger / containerStyles=CSS popover" 이원성을 구조 수용.

## 목표

ADR-070 Addendum 1에서 명시 수용된 Menu container 수동 CSS debt(ADR-036/059/063 역행)를 3개의 증분 Phase로 해체:

1. **P1** — tokenResolver `{color.raised}` 매핑 + `SpacingTokens."2xs": 2` primitive 등록 (token 인프라 한 묶음).
2. **P2** — `ComponentSpec.containerStyles` 타입 신설(`width` 포함) + `CSSGenerator.generateBaseStyles` S3 semantic 분기.
3. **P3** — Menu.spec 정방향 복원(`containerStyles.width: "100%"` 포함) + 수동 Menu.css 해체 + import 경로 원복.

각 Phase는 독립 커밋. P2는 optional 필드라서 색상 미정의 spec에 대해 no-op (backwards compatible).

## 영향 범위

| 영역                  | 파일                                                       | 변경                                                                                                                                          |
| --------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Types**             | `packages/specs/src/types/spec.types.ts`                   | `ContainerStylesSchema` 인터페이스 신설 + `ComponentSpec.containerStyles?: ContainerStylesSchema` 필드 추가                                   |
| **Generator**         | `packages/specs/src/renderers/CSSGenerator.ts`             | `generateBaseStyles` 분기: `spec.containerStyles` 존재 시 defaultVariant 색상 주입 skip + variants 블록 skip. `emitContainerStyles` 헬퍼 신설 |
| **TokenResolver**     | `packages/specs/src/renderers/utils/tokenResolver.ts`      | `COLOR_TOKEN_TO_CSS`에 `"raised": "var(--bg-raised)"` 추가                                                                                    |
| **Spacing primitive** | `packages/specs/src/primitives/spacing.ts`                 | `spacing` 객체에 `"2xs": 2` 추가 (기존 `--spacing-2xs: 0.125rem = 2px` 정합). `{spacing.2xs}` resolveToken 유효화                             |
| **Spacing 타입**      | `packages/specs/src/types/token.types.ts`                  | `SpacingTokens` 인터페이스에 `"2xs": number` 추가                                                                                             |
| **Menu Spec**         | `packages/specs/src/components/Menu.spec.ts`               | `skipCSSGeneration: true` 제거 + `containerStyles` 블록 신설 + `skipVariantCss` 플래그 제거(implicit)                                         |
| **Manual CSS 해체**   | `packages/shared/src/components/styles/Menu.css`           | **파일 삭제**                                                                                                                                 |
| **Manual CSS 해체**   | `packages/shared/src/components/Menu.tsx`                  | `import "./styles/Menu.css"` → `import "./styles/generated/Menu.css"`                                                                         |
| **Manual CSS 해체**   | `packages/shared/src/components/styles/index.css`          | Menu.css 경로 원복                                                                                                                            |
| **재생성**            | `packages/shared/src/components/styles/generated/Menu.css` | `pnpm build:specs`로 재생성 (삭제 상태에서 생성)                                                                                              |
| **문서**              | `.claude/rules/css-tokens.md`                              | Surface Elevation 블록에 `{color.raised}` 주석 + TokenRef 표에 신규 행 (ADR 승인 전 선행 완료)                                                |

## Phase P1 — Token 인프라 (TokenRef 매핑 + Spacing primitive)

### 1-1. `{color.raised}` 매핑 추가

`packages/specs/src/renderers/utils/tokenResolver.ts`:

```ts
const COLOR_TOKEN_TO_CSS: Record<string, string> = {
  // ... 기존
  // --- Surface / Layer ---
  base: "var(--bg)",
  raised: "var(--bg-raised)", // ← ADR-071 신설
  "layer-1": "var(--bg-overlay)",
  "layer-2": "var(--bg-inset)",
  elevated: "var(--color-white)",
  disabled: "var(--color-neutral-200)",
  // ... 기존
};
```

### 1-2. `SpacingTokens."2xs"` primitive 등록

`packages/specs/src/types/token.types.ts` (`SpacingTokens` 인터페이스):

```ts
export interface SpacingTokens {
  "2xs": number; // 2 (0.125rem) — ADR-071 신설. --spacing-2xs 와 정합
  xs: number; // 4
  sm: number; // 8
  md: number; // 16
  lg: number; // 24
  xl: number; // 32
  "2xl": number; // 48
}
```

`packages/specs/src/primitives/spacing.ts`:

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

### 검증

- `pnpm type-check` 3/3 통과
- `pnpm build:specs` 기존 `generated/` 집합(Menu 미포함 91 파일) diff 0 (아직 사용처 없음)
- `{spacing.2xs}` `resolveToken` 호출 시 `2` 반환, `tokenToCSSVar` 호출 시 `"var(--spacing-2xs)"` 반환, console.warn 0건

### Commit

`feat(tokens): add {color.raised} TokenRef + {spacing.2xs} primitive (ADR-071 P1)`

---

## Phase P2 — Generator containerStyles 인프라

### 2-1. 타입 정의

`packages/specs/src/types/spec.types.ts`:

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
  width?: string; // 예: "100%" (archetype base 미커버)
  maxHeight?: string;
  overflow?: "auto" | "scroll" | "visible" | "hidden";
  outline?: string;
}

export interface ComponentSpec<Props = Record<string, unknown>> {
  // ... 기존 필드
  /**
   * 컨테이너 시각 스타일 (ADR-071 — non-composite spec용).
   * 설정 시 `defaultVariant` 색상 주입과 `variants` CSS 블록 생성 skip.
   * `spec.composition.containerStyles`(legacy, `Record<string,string>`) 와 별개 필드.
   */
  containerStyles?: ContainerStylesSchema;
}
```

### 2-2. Generator 분기

`packages/specs/src/renderers/CSSGenerator.ts`:

`generateBaseStyles` 에 `spec.containerStyles` 분기 추가:

```ts
function generateBaseStyles<Props>(spec: ComponentSpec<Props>): string[] {
  // ... 기존 archetype base styles 로직

  const lines = [...baseStyles];

  // ADR-071 S3: containerStyles 있으면 defaultVariant 색상 주입 skip
  if (spec.containerStyles) {
    lines.push("");
    lines.push("  /* Container styles (ADR-071) */");
    lines.push(...emitContainerStyles(spec.containerStyles));
  } else if (defaultVariant && !spec.composition) {
    // 기존 defaultVariant 색상 주입 로직 유지
    // ...
  }

  // ... 기존 default size 로직

  return lines;
}

function emitContainerStyles(c: ContainerStylesSchema): string[] {
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

변경점: variants 블록 생성 조건에 `!spec.containerStyles` 추가 (implicit skipVariantCss).

```ts
// 기존: if (!spec.composition && spec.variants != null && !spec.skipVariantCss)
// 변경: if (!spec.composition && !spec.containerStyles && spec.variants != null && !spec.skipVariantCss)
```

### 2-3. 검증

- `pnpm type-check` 3/3 통과
- `pnpm build:specs` 기존 `generated/` 집합(Menu 미포함 91 파일) diff 0 (optional 필드는 미정의 spec에 no-op)
- `pnpm -F @composition/specs test -- CSSGenerator` 스위트 전체 통과 (per-spec snapshot 매트릭스 + `animationRewrite`/`sizeSelectors`/`rootSelectors` 3 파일)

### Commit

`feat(specs): add ComponentSpec.containerStyles S3 axis (ADR-071 P2)`

---

## Phase P3 — Menu 정방향 복원

### 3-1. Menu.spec 변경

`packages/specs/src/components/Menu.spec.ts`:

```ts
export const MenuSpec: ComponentSpec<MenuProps> = {
  name: "Menu",
  archetype: "collection",
  element: "div",
  // skipCSSGeneration: true 제거       ← P3 핵심 변경 1
  // skipVariantCss 라인 제거 (implicit via containerStyles)

  defaultVariant: "primary", // Skia trigger 팔레트 유지 (Button 정합)
  defaultSize: "md",

  // ADR-071: popover container 시각 SSOT ← P3 핵심 변경 2
  containerStyles: {
    background: "{color.raised}",
    text: "{color.neutral}",
    border: "{color.border}",
    borderWidth: 1,
    borderRadius: "{radius.md}", // = var(--radius-md) = var(--border-radius) (shared-tokens.css:472)
    padding: "{spacing.xs}",
    gap: "{spacing.2xs}", // P1에서 primitive 등록
    width: "100%", // archetype "collection" base 미커버 — P2 schema 추가분
    maxHeight: "300px",
    overflow: "auto",
    outline: "none",
  },

  overlay: {
    /* 기존 */
  },
  variants: {
    /* 기존 — Skia trigger 전용 */
  },
  sizes: {
    /* 기존 — Skia trigger 치수 */
  },
  states: {
    /* 기존 */
  },
  properties: {
    /* 기존 */
  },
  render: { shapes, react, pixi }, // 기존
};
```

`[data-empty]` / `[data-focus-visible]` 처리:

- `[data-focus-visible]` — `states.focusVisible.focusRing = "{focus.ring.default}"`로 이미 정의되어 있어 generator가 자동 emit.
- `[data-empty]` — **본 ADR scope 외**. 향후 목록형(Menu/ListBox/Select) 공통 CSS 규칙에서 처리 (별도 수단).

### 3-2. 수동 CSS 해체

```bash
rm packages/shared/src/components/styles/Menu.css
```

`packages/shared/src/components/Menu.tsx` (1줄 교체):

```diff
- import "./styles/Menu.css";
+ import "./styles/generated/Menu.css";
```

`packages/shared/src/components/styles/index.css` (경로 1줄 원복):

```diff
- @import "./Menu.css";
+ @import "./generated/Menu.css";
```

### 3-3. 재생성 & 검증

```bash
pnpm build:specs       # generated/Menu.css 재생성
pnpm type-check        # 3/3 통과
```

git diff 예상:

- `generated/Menu.css` **신규 추가** (ADR-070 Addendum 1 직전 상태의 정합 복원 but containerStyles 기반 자동 생성)
- `styles/Menu.css` **삭제**
- 기존 `generated/` 집합 (Menu 미포함 91 파일) diff 0

### Commit

`feat(menu): restore Spec-first CSS generation via containerStyles (ADR-071 P3)`

---

## Gate 기준

| Gate   | 시점            | 통과 조건                                                                                                                                                                                                                                                                                                                                   | 실패 시 대안                                                                                                        |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **G1** | P1 + P2 완료 후 | `pnpm build:specs` 후 기존 `generated/` 집합(Menu 미포함 91 파일) diff 0 (optional 필드 no-op) + `pnpm -F @composition/specs test -- CSSGenerator` 스위트 전체 통과 (per-spec snapshot 매트릭스 + `animationRewrite/sizeSelectors/rootSelectors` 3 파일) + `pnpm type-check` 3/3. `{spacing.2xs}` resolveToken 반환값 `2`, console.warn 0건 | `emitContainerStyles` 의 TokenRef 판정 로직 보강 (startsWith `{` 외 경계 검사) / primitive 등록 누락 확인           |
| **G2** | P3 완료 후      | `generated/Menu.css` 신규 추가 (manual `Menu.css` 규칙과 등가 — **width: 100%** + background/color/border/padding/gap/max-height/overflow/outline + data-focus-visible) + 기존 집합 diff 0                                                                                                                                                  | ContainerStylesSchema 에 누락 필드 추가 (예: display/flex-direction) 또는 archetype `"collection"` base 스타일 확인 |
| **G3** | P3 완료 후      | Chrome MCP light/dark 토글: Menu popover container 시각 정합 (`var(--bg-raised)` 배경, `var(--fg)` 텍스트, MenuItem hover 자연 대비) — ADR-070 Addendum 1 이전 시각과 동등                                                                                                                                                                  | 토큰 재조정 (예: borderRadius TokenRef → CSS 값)                                                                    |
| **G4** | P3 완료 후      | Skia Menu trigger 시각 불변 (`variants.primary` 기반 팔레트 유지) — ADR-070 Addendum 1 이전 Skia 스냅샷과 동등                                                                                                                                                                                                                              | render.shapes의 variants 참조 경로 재확인 (`MenuSpec.variants![props.variant ?? defaultVariant!]`)                  |

잔존 HIGH 위험 없음 — ADR-070 Addendum 1 debt 해체만 수행 (추가형 구조 + optional 필드).

---

## 금지 사항 (SSOT 보존)

- ❌ Menu.spec.variants 변경 (Skia trigger 팔레트 불변 — Button 동형 유지)
- ❌ `[color.bg-raised]` / `{color.bg-*}` prefix 도입 — 기존 `{neutral-subtle}`(`--bg-muted`) 와 충돌
- ❌ `ComponentSpec.containerStyles` 필드를 Composite spec에서 사용 — `spec.composition.containerStyles`(legacy) 경로 우선
- ❌ `emitContainerStyles`에서 자유 CSS 속성명 허용 (D3 정본 — schema 내 명시 필드만)
- ❌ ListBox/Popover spec 수정 (scope α — 각각 후속 ADR-C/ADR-B 영역)

## 후속 추적

- **ADR-B** (Select/ComboBox items SSOT): 동일 containerStyles 인프라 활용 가능. ADR-071 완료 후 진입 가능.
- **ADR-C** (ListBox skipCSSGeneration 해체): ListBox.css의 `[data-orientation]` / `--lb-*` 표현 한계 실측 후 진입. 본 ADR의 containerStyles 기반 스키마로 충분한지 검증 필요.
