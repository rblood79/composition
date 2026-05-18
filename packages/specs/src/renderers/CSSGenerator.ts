/**
 * CSS Generator
 *
 * ComponentSpec에서 CSS 파일 내용 생성
 *
 * ADR-036 Phase 2-pre: Archetype별 base styles 분기
 * ADR-036 Phase 2a: Level 1 확장 (lineHeight, fontWeight, borderWidth 등)
 *
 * @packageDocumentation
 */

import type {
  ComponentSpec,
  ArchetypeId,
  VariantSpec,
  SizeSpec,
  ContainerStylesSchema,
} from "../types";
import type { ShadowTokenRef, TokenRef } from "../types/token.types";
import { tokenToCSSVar, resolveFocusRingToken } from "./utils/tokenResolver";
import { deriveAutoDelegationVariables } from "../runtime/deriveAutoDelegationVariables";
// ADR-908 Phase 3-A + 3-B: Fill token dual-read seam — VariantSpec + IndicatorModeSpec
import { resolveFillTokens, resolveIndicatorFill } from "../utils/fillTokens";

// ─── ADR-059 B5: cssEmitMode helper ─────────────────────────────────────────

type ColorKind = "background" | "text" | "border";

function emitColorLine(
  kind: ColorKind,
  tokenRef: string,
  mode: "direct" | "button-base",
  indent: string = "  ",
): string {
  const DIRECT_PROPS: Record<ColorKind, string> = {
    background: "background",
    text: "color",
    border: "border-color",
  };
  const BUTTON_BASE_PROPS: Record<ColorKind, string> = {
    background: "--button-color",
    text: "--button-text",
    border: "--button-border",
  };
  const prop =
    mode === "button-base" ? BUTTON_BASE_PROPS[kind] : DIRECT_PROPS[kind];
  return `${indent}${prop}: ${tokenRef};`;
}

// ─── Archetype별 base styles ────────────────────────────────────────────────

const ARCHETYPE_BASE_STYLES: Record<ArchetypeId, string[]> = {
  simple: [
    `    display: inline-flex;`,
    `    align-items: center;`,
    `    box-sizing: border-box;`,
  ],
  text: [
    `    display: block;`,
    `    width: 100%;`,
    `    box-sizing: border-box;`,
  ],
  button: [
    `    display: inline-flex;`,
    `    align-items: center;`,
    `    justify-content: center;`,
    `    width: fit-content;`,
    `    box-sizing: border-box;`,
    `    cursor: pointer;`,
    `    user-select: none;`,
    `    transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;`,
    `    font-family: var(--font-sans);`,
  ],
  "input-base": [
    `    display: flex;`,
    `    align-items: center;`,
    `    box-sizing: border-box;`,
    `    font-family: var(--font-sans);`,
  ],
  "toggle-indicator": [
    `    display: inline-flex;`,
    `    align-items: center;`,
    `    cursor: pointer;`,
    `    box-sizing: border-box;`,
    `    user-select: none;`,
  ],
  progress: [
    `    display: grid;`,
    `    grid-template-areas: "label value" "track track";`,
    `    grid-template-columns: 1fr auto;`,
    `    box-sizing: border-box;`,
    ``,
    `    .react-aria-Label { grid-area: label; }`,
    `    [slot="value"] { grid-area: value; }`,
    `    .bar { grid-area: track; }`,
  ],
  slider: [`    display: grid;`, `    box-sizing: border-box;`],
  "tabs-indicator": [
    `    display: flex;`,
    `    position: relative;`,
    `    box-sizing: border-box;`,
  ],
  collection: [
    `    display: flex;`,
    `    flex-direction: column;`,
    `    box-sizing: border-box;`,
  ],
  overlay: [`    position: fixed;`, `    box-sizing: border-box;`],
  calendar: [`    display: grid;`, `    box-sizing: border-box;`],
  alert: [
    `    display: flex;`,
    `    flex-direction: column;`,
    `    align-items: flex-start;`,
    `    box-sizing: border-box;`,
    `    width: 100%;`,
    `    font-family: var(--font-sans);`,
  ],
};

// archetype 미지정 시 기본 base styles
const DEFAULT_BASE_STYLES = [
  `    display: inline-flex;`,
  `    align-items: center;`,
  `    justify-content: center;`,
  `    box-sizing: border-box;`,
  `    cursor: pointer;`,
  `    user-select: none;`,
  `    transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;`,
  `    font-family: var(--font-sans);`,
];

/**
 * ADR-141: composition 이 컨테이너 box (layout / composition.containerStyles /
 * containerVariants) 를 소유하는 "layout-composite" spec 인지 판정.
 *
 * true → variant CSS 블록 / sizes 의 height·padding emit 을 skip (자식 또는
 * containerVariants 가 색상·치수 관리).
 * false → staticSelectors / rootSelectors / animations 전용 composition
 * (예: Disclosure chevron, Link underline, DropZone drop-target) — layout-composite
 * 가 아니므로 variant 블록과 sizes height/padding 을 정상 emit.
 */
function compositionOwnsContainerBox<Props>(
  spec: ComponentSpec<Props>,
): boolean {
  return (
    !!spec.composition &&
    (!!spec.composition.layout ||
      !!spec.composition.containerStyles ||
      !!spec.composition.containerVariants)
  );
}

// ─── Main Generator ─────────────────────────────────────────────────────────

/**
 * ComponentSpec에서 CSS 파일 내용 생성
 */
export function generateCSS<Props>(
  spec: ComponentSpec<Props>,
  /**
   * ADR-078 Phase 2: 자식 inline emit 시 true.
   * - 파일 헤더, `@layer components {`/`}`, animation at-rules 를 생략 — 부모가 담당.
   * - `skipCSSGeneration: true` 자식도 embed 는 허용 (독립 파일 emit 만 차단).
   */
  _embedMode = false,
): string | null {
  // Container/Composite 컴포넌트: 수동 CSS가 구조 담당, Spec은 Skia용.
  // embedMode 에서는 skipCSSGeneration 우회 — 독립 파일 emit 이 아닌 부모 내부 inline emit 은 허용.
  if (spec.skipCSSGeneration && !_embedMode) return null;

  const archetype = spec.archetype;

  const lines: string[] = [];

  // ADR-078 Phase 2: 파일 헤더 + @layer 오픈 — embed 모드에서는 부모가 이미 emit 했으므로 생략
  if (!_embedMode) {
    // 파일 헤더
    lines.push(
      `/* ============================================================`,
    );
    lines.push(
      ` * AUTO-GENERATED from ${spec.name}Spec — DO NOT EDIT MANUALLY`,
    );
    lines.push(` * Source: packages/specs/src/components/${spec.name}.spec.ts`);
    lines.push(` * Archetype: ${archetype ?? "default"}`);
    lines.push(
      ` * ============================================================ */`,
    );
    lines.push("");
    lines.push("@layer components {");
    lines.push("");
  }

  // 기본 스타일
  lines.push(`.react-aria-${spec.name} {`);
  lines.push(...generateBaseStyles(spec));
  lines.push("}");
  lines.push("");

  // Variant 스타일 — 다음 경우 skip:
  // - Composite 컨테이너 — composition 이 layout/containerStyles/containerVariants 소유 (자식이 색상 관리)
  // - containerStyles 에 color 필드(background/text/border) 선언 (ADR-071 Menu 패턴 — 단일 variant 색상 SSOT)
  // - variants 없는 Spec (ADR-062 Field 계열)
  // - skipVariantCss:true (escape hatch, 현재 사용처 0)
  // ADR-083 Phase 1: Layout primitive only containerStyles(display/flex/width 등)는
  //   variants 색상을 여전히 emit — InlineAlert 5-variant 케이스 지원.
  const variantMode = spec.cssEmitMode ?? "direct";
  const containerHasColors = !!(
    spec.containerStyles?.background ||
    spec.containerStyles?.text ||
    spec.containerStyles?.border
  );
  if (
    !compositionOwnsContainerBox(spec) &&
    !containerHasColors &&
    spec.variants != null &&
    !spec.skipVariantCss
  )
    for (const [variantName, variantSpec] of Object.entries(spec.variants)) {
      // ADR-908 Phase 3-A: legacy background 필드 대신 fill token dual-read seam 소비
      const fill = resolveFillTokens(variantSpec);
      lines.push(`.react-aria-${spec.name}[data-variant="${variantName}"] {`);
      lines.push(...generateVariantStyles(variantSpec, variantMode));
      lines.push("");

      // hover/pressed — button-base 모드에서는 .button-base utility가 color-mix로 자동 파생
      if (variantMode !== "button-base") {
        // hover 상태
        lines.push("  &[data-hovered] {");
        if (fill.default.hover) {
          lines.push(`    background: ${tokenToCSSVar(fill.default.hover)};`);
        }
        if (variantSpec.textHover) {
          lines.push(`    color: ${tokenToCSSVar(variantSpec.textHover)};`);
        }
        if (variantSpec.borderHover) {
          lines.push(
            `    border-color: ${tokenToCSSVar(variantSpec.borderHover)};`,
          );
        }
        lines.push("  }");
        lines.push("");

        // pressed 상태
        lines.push("  &[data-pressed] {");
        if (fill.default.pressed) {
          lines.push(`    background: ${tokenToCSSVar(fill.default.pressed)};`);
        }
        lines.push("  }");
      }

      // ─── ADR-059 B5: selected 상태 ───
      if (fill.default.selected) {
        lines.push("");
        lines.push("  &[data-selected] {");
        lines.push(
          emitColorLine(
            "background",
            tokenToCSSVar(fill.default.selected),
            variantMode,
            "    ",
          ),
        );
        if (variantSpec.selectedText) {
          lines.push(
            emitColorLine(
              "text",
              tokenToCSSVar(variantSpec.selectedText),
              variantMode,
              "    ",
            ),
          );
        }
        if (variantSpec.selectedBorder) {
          lines.push(
            emitColorLine(
              "border",
              tokenToCSSVar(variantSpec.selectedBorder),
              variantMode,
              "    ",
            ),
          );
        }
        // selected × hover/pressed — button-base에서는 스킵
        if (variantMode !== "button-base") {
          if (fill.default.selectedHover) {
            lines.push("");
            lines.push("    &[data-hovered] {");
            lines.push(
              `      background: ${tokenToCSSVar(fill.default.selectedHover)};`,
            );
            lines.push("    }");
          }
          if (fill.default.selectedPressed) {
            lines.push("");
            lines.push("    &[data-pressed] {");
            lines.push(
              `      background: ${tokenToCSSVar(fill.default.selectedPressed)};`,
            );
            lines.push("    }");
          }
        }
        lines.push("  }");
      }

      // ─── ADR-059 B5: emphasized × selected 조합 ───
      if (fill.default.emphasizedSelected) {
        lines.push("");
        lines.push("  &[data-emphasized][data-selected] {");
        lines.push(
          emitColorLine(
            "background",
            tokenToCSSVar(fill.default.emphasizedSelected),
            variantMode,
            "    ",
          ),
        );
        if (variantSpec.emphasizedSelectedText) {
          lines.push(
            emitColorLine(
              "text",
              tokenToCSSVar(variantSpec.emphasizedSelectedText),
              variantMode,
              "    ",
            ),
          );
        }
        if (variantSpec.emphasizedSelectedBorder) {
          lines.push(
            emitColorLine(
              "border",
              tokenToCSSVar(variantSpec.emphasizedSelectedBorder),
              variantMode,
              "    ",
            ),
          );
        }
        lines.push("  }");
      }

      lines.push("}");
      lines.push("");

      // ─── Phase 2b: fillStyle outline 변형 ───
      if (fill.outline?.base || variantSpec.outlineBorder) {
        lines.push(
          `.react-aria-${spec.name}[data-variant="${variantName}"][data-fill-style="outline"] {`,
        );
        lines.push(
          emitColorLine(
            "background",
            tokenToCSSVar(
              fill.outline?.base ?? ("{color.transparent}" as TokenRef),
            ),
            variantMode,
          ),
        );
        if (variantSpec.outlineText) {
          lines.push(
            emitColorLine(
              "text",
              tokenToCSSVar(variantSpec.outlineText),
              variantMode,
            ),
          );
        }
        if (variantSpec.outlineBorder) {
          lines.push(
            emitColorLine(
              "border",
              tokenToCSSVar(variantSpec.outlineBorder),
              variantMode,
            ),
          );
        }
        lines.push("}");
        lines.push("");
      }

      // ─── Phase 2b: fillStyle subtle 변형 ───
      if (fill.subtle?.base) {
        lines.push(
          `.react-aria-${spec.name}[data-variant="${variantName}"][data-fill-style="subtle"] {`,
        );
        lines.push(
          emitColorLine(
            "background",
            tokenToCSSVar(fill.subtle.base),
            variantMode,
          ),
        );
        if (variantSpec.subtleText) {
          lines.push(
            emitColorLine(
              "text",
              tokenToCSSVar(variantSpec.subtleText),
              variantMode,
            ),
          );
        }
        if (variantMode === "direct") {
          lines.push("  border: none;");
        }
        lines.push("}");
        lines.push("");
      }
    }

  // icon-only 지원 (archetype: button에만)
  if (spec.archetype === "button") {
    lines.push(`.react-aria-${spec.name}[data-icon-only] {`);
    lines.push("  padding: 0;");
    lines.push("  aspect-ratio: 1;");
    lines.push("}");
    lines.push("");
  }

  // Size 스타일
  // ADR-141: composition 이 컨테이너 box 를 소유할 때만 sizes 경로 height/padding skip.
  const ownsContainerBox = compositionOwnsContainerBox(spec);
  const hasContainerStylesOuter = !!spec.containerStyles;
  // progress archetype: sizes.height는 bar track 높이이며 컨테이너 height가 아님
  const skipHeight = ownsContainerBox || spec.archetype === "progress";
  // ADR-071: containerStyles 에 padding/borderRadius/gap/border 정의 시 sizes 경로 skip (이중 emit 방지)
  const skipPaddingOuter =
    ownsContainerBox ||
    (hasContainerStylesOuter && spec.containerStyles?.padding != null);
  const skipBorderRadiusOuter =
    hasContainerStylesOuter && spec.containerStyles?.borderRadius != null;
  const skipGapOuter =
    hasContainerStylesOuter && spec.containerStyles?.gap != null;
  const skipBorderWidthOuter =
    hasContainerStylesOuter && spec.containerStyles?.border != null;
  for (const [sizeName, sizeSpec] of Object.entries(spec.sizes)) {
    lines.push(`.react-aria-${spec.name}[data-size="${sizeName}"] {`);
    lines.push(
      ...generateSizeStyles(sizeSpec, {
        skipHeight,
        skipPadding: skipPaddingOuter,
        skipBorderRadius: skipBorderRadiusOuter,
        skipGap: skipGapOuter,
        skipBorderWidth: skipBorderWidthOuter,
      }),
    );
    lines.push("}");
    lines.push("");
  }

  // Child element font styles (headingFontSize/Weight, descFontSize/Weight)
  lines.push(...generateChildFontStyles(spec));

  // 상태 스타일
  lines.push(...generateStateStyles(spec));

  // ─── Phase 3a: Tier 2 Composite CSS (CompositionSpec) ───
  if (spec.composition) {
    lines.push("");
    lines.push(`/* ── Tier 2: Composite Delegation ── */`);
    lines.push("");
    lines.push(...generateCompositionCSS(spec));
  }

  // ─── ADR-059 B5: Indicator Mode ───
  if (spec.indicatorMode) {
    lines.push("");
    lines.push(`/* ── Indicator Mode ── */`);
    lines.push(...generateIndicatorModeCSS(spec));
  }

  // ─── Phase 3b: @media 공통 패턴 ───
  lines.push("");
  lines.push(...generateMediaQueries(spec));

  // ─── Phase 4-infra2: Static selectors (@layer 내부, size selector 앞) ───
  const staticRules = generateStaticSelectorRules(spec);
  if (staticRules.length > 0) {
    lines.push("");
    lines.push(...staticRules);
  }

  // ─── Phase 4-infra2 0-D.9: Size selectors (@layer 내부) ───
  const sizeSelectorRules = generateSizeSelectorRules(spec);
  if (sizeSelectorRules.length > 0) {
    lines.push("");
    lines.push(...sizeSelectorRules);
  }

  // ─── Phase 4.5a 0-D.10: Root selectors (@layer 내부) ───
  const rootSelectorRules = generateRootSelectorRules(spec);
  if (rootSelectorRules.length > 0) {
    lines.push("");
    lines.push(...rootSelectorRules);
  }

  // ADR-078 Phase 2: 자식 embed 모드 — @layer close / atRules 는 부모가 처리
  if (_embedMode) {
    return lines.join("\n");
  }

  // ADR-078 Phase 2: 자식 Spec inline emit — 부모 @layer 블록 내부에 append.
  //   ListBox/ListBoxItem 같은 "자식 selector 를 부모 CSS 파일에 흡수" 케이스.
  if (spec.childSpecs && spec.childSpecs.length > 0) {
    for (const child of spec.childSpecs) {
      const childInner = generateCSS(child, /* _embedMode */ true);
      if (!childInner) continue;
      lines.push("");
      lines.push(`/* ─── Child Spec: ${child.name} (ADR-078) ─── */`);
      lines.push("");
      lines.push(childInner);
    }
  }

  lines.push("");
  lines.push("} /* @layer components */");

  // ─── Phase 4-infra: Animation at-rules (@layer 바깥) ───
  // ADR-078 Phase 2: 자식 Spec 의 animation at-rules 도 부모와 함께 @layer 바깥에 emit
  const atRules = generateAnimationAtRules(spec);
  if (spec.childSpecs && spec.childSpecs.length > 0) {
    for (const child of spec.childSpecs) {
      atRules.push(...generateAnimationAtRules(child));
    }
  }
  if (atRules.length > 0) {
    lines.push("");
    lines.push(...atRules);
  }

  return lines.join("\n");
}

// ─── Base Styles (Archetype 분기) ───────────────────────────────────────────

// Composite layout → CSS display 매핑
const COMPOSITION_LAYOUT_STYLES: Record<string, string[]> = {
  "flex-column": [
    `    display: flex;`,
    `    flex-direction: column;`,
    `    align-items: flex-start;`,
    `    box-sizing: border-box;`,
  ],
  "flex-row": [
    `    display: flex;`,
    `    flex-direction: row;`,
    `    align-items: center;`,
    `    box-sizing: border-box;`,
  ],
  "inline-flex": [
    `    display: inline-flex;`,
    `    align-items: center;`,
    `    box-sizing: border-box;`,
  ],
  grid: [`    display: grid;`, `    box-sizing: border-box;`],
};

function generateBaseStyles<Props>(spec: ComponentSpec<Props>): string[] {
  const archetype = spec.archetype;

  // Composite는 composition.layout에서 base styles 파생
  // ADR-059 v2 Pre-Phase 0-D.5: layout 생략 시 archetype base fallback
  let baseStyles: string[];
  if (spec.composition) {
    if (spec.composition.layout) {
      baseStyles = [...COMPOSITION_LAYOUT_STYLES[spec.composition.layout]];
    } else {
      baseStyles = archetype
        ? [...(ARCHETYPE_BASE_STYLES[archetype] ?? DEFAULT_BASE_STYLES)]
        : [...DEFAULT_BASE_STYLES];
    }
    // ADR-059 v2 Pre-Phase 0-D.3: containerStyles 병합
    if (spec.composition.containerStyles) {
      for (const [prop, value] of Object.entries(
        spec.composition.containerStyles,
      )) {
        baseStyles.push(`    ${prop}: ${value};`);
      }
    }
  } else {
    baseStyles = archetype
      ? (ARCHETYPE_BASE_STYLES[archetype] ?? DEFAULT_BASE_STYLES)
      : DEFAULT_BASE_STYLES;
  }

  const defaultVariant =
    spec.variants != null && spec.defaultVariant != null
      ? spec.variants[spec.defaultVariant]
      : undefined;
  const defaultSize = spec.sizes[spec.defaultSize];

  const lines = [`  /* Base styles — archetype: ${archetype ?? "default"} */`];
  lines.push(...baseStyles);

  // ADR-071 S3 + ADR-083 Phase 1: containerStyles 에 color 필드(background/text/border)
  //   선언 시 defaultVariant 색상 주입 skip (ADR-071 Menu 패턴). Layout primitive only
  //   containerStyles (display/flex/width 등) 는 defaultVariant 색상 emit 보장.
  const baseContainerHasColors = !!(
    spec.containerStyles?.background ||
    spec.containerStyles?.text ||
    spec.containerStyles?.border
  );
  if (spec.containerStyles) {
    lines.push("");
    lines.push("  /* Container styles (ADR-071 + ADR-083 Phase 1) */");
    lines.push(...emitContainerStyles(spec.containerStyles));
  }
  if (
    !baseContainerHasColors &&
    defaultVariant &&
    !compositionOwnsContainerBox(spec)
  ) {
    // default variant 색상 — Composite 컨테이너는 자식이 관리하므로 skip
    const mode = spec.cssEmitMode ?? "direct";
    // ADR-908 Phase 4-a: defaultVariant alias 도 fill token seam 경유
    const defaultFill = resolveFillTokens(defaultVariant);
    lines.push("");
    lines.push("  /* Default variant */");
    lines.push(
      emitColorLine(
        "background",
        tokenToCSSVar(defaultFill.default.base),
        mode,
      ),
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

  // default size 속성 (있으면)
  if (defaultSize) {
    // ADR-141: composition 이 컨테이너 box 를 소유할 때만 skip (위 per-size 블록과 동일 기준).
    const ownsContainerBox = compositionOwnsContainerBox(spec);
    const hasContainerStyles = !!spec.containerStyles;
    const skipDefaultHeight = ownsContainerBox || spec.archetype === "progress";
    // ADR-071: containerStyles 에 padding/borderRadius/gap/border 정의 시 sizes 경로 skip (이중 emit 방지)
    const skipPadding =
      ownsContainerBox ||
      (hasContainerStyles && spec.containerStyles?.padding != null);
    const skipBorderRadius =
      hasContainerStyles && spec.containerStyles?.borderRadius != null;
    const skipGap = hasContainerStyles && spec.containerStyles?.gap != null;
    const skipBorderWidth =
      hasContainerStyles && spec.containerStyles?.border != null;
    lines.push("");
    lines.push("  /* Default size */");
    lines.push(
      ...generateSizeStyles(defaultSize, {
        skipHeight: skipDefaultHeight,
        skipPadding,
        skipBorderRadius,
        skipGap,
        skipBorderWidth,
      }),
    );
  }

  return lines;
}

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

  // ADR-078: layout primitive override — archetype base 의 display/flex-direction 을 override.
  //   containerStyles 이 우선이어야 Spec SSOT 관점에서 display/direction 선언이 명시적.
  if (c.display) lines.push(`  display: ${c.display};`);
  if (c.flexDirection) lines.push(`  flex-direction: ${c.flexDirection};`);
  // ADR-084: flex-wrap override — Breadcrumbs 등 수평 레이아웃의 줄바꿈 제어.
  if (c.flexWrap) lines.push(`  flex-wrap: ${c.flexWrap};`);
  // ADR-079: align-items / justify-content override — archetype base 의 교차축/주축 정렬 override.
  if (c.alignItems) lines.push(`  align-items: ${c.alignItems};`);
  if (c.justifyContent) lines.push(`  justify-content: ${c.justifyContent};`);
  // ADR-085: grid-template override — `display: grid` 동반 시 트랙/영역 정의.
  //   Meter/ProgressBar 등이 legacy composition.containerStyles 에 수동 emit 하던 값을
  //   정식 containerStyles 로 이관해 CSS/Skia/Taffy 3경로 SSOT 확보.
  if (c.gridTemplateAreas)
    lines.push(`  grid-template-areas: ${c.gridTemplateAreas};`);
  if (c.gridTemplateColumns)
    lines.push(`  grid-template-columns: ${c.gridTemplateColumns};`);
  if (c.gridTemplateRows)
    lines.push(`  grid-template-rows: ${c.gridTemplateRows};`);
  // ADR-089: position — 자식 absolute 배치 기준 형성. SliderTrack position:relative 리프팅.
  if (c.position) lines.push(`  position: ${c.position};`);

  return lines;
}

// ─── Variant Styles ─────────────────────────────────────────────────────────

function generateVariantStyles(
  variant: VariantSpec,
  mode: "direct" | "button-base" = "direct",
): string[] {
  // ADR-908 Phase 3-A: fill token dual-read seam — default.base / alpha 소비
  const fill = resolveFillTokens(variant);
  const lines = [
    emitColorLine("background", tokenToCSSVar(fill.default.base), mode),
    emitColorLine("text", tokenToCSSVar(variant.text), mode),
  ];

  if (variant.border) {
    lines.push(emitColorLine("border", tokenToCSSVar(variant.border), mode));
  }

  if (fill.alpha !== undefined && fill.alpha < 1) {
    // backgroundAlpha < 1 → 투명 처리 (button-base도 동일하게 transparent)
    lines.push(
      mode === "button-base"
        ? "  --button-color: transparent;"
        : "  background: transparent;",
    );
  }

  return lines;
}

// ─── Size Styles (Level 1 확장) ─────────────────────────────────────────────

function generateSizeStyles(
  size: SizeSpec,
  options?: {
    skipHeight?: boolean;
    skipPadding?: boolean;
    skipBorderRadius?: boolean;
    skipGap?: boolean;
    skipBorderWidth?: boolean;
  },
): string[] {
  const lines: string[] = [];

  // height — Composite 컨테이너는 자식이 높이를 결정하므로 skip
  if (!options?.skipHeight) {
    const heightValue =
      typeof size.height === "number" && size.height > 0
        ? `${size.height}px`
        : "auto";
    lines.push(`  height: ${heightValue};`);
  }

  // padding — Composite 컨테이너는 자식이 패딩을 관리하므로 skip
  if (options?.skipPadding) {
    // padding 출력 건너뜀 — 아래 padding 블록 대신 여기서 조기 분기
  } else if (
    size.paddingLeft !== undefined ||
    size.paddingRight !== undefined
  ) {
    // padding (비대칭 지원)
    const pl = size.paddingLeft ?? size.paddingX;
    const pr = size.paddingRight ?? size.paddingX;
    lines.push(
      `  padding: ${size.paddingY}px ${pr}px ${size.paddingY}px ${pl}px;`,
    );
  } else {
    lines.push(`  padding: ${size.paddingY}px ${size.paddingX}px;`);
  }

  // font-size
  lines.push(`  font-size: ${tokenToCSSVar(size.fontSize)};`);

  // border-radius — ADR-071: containerStyles.borderRadius 존재 시 skip (이중 emit 방지)
  if (!options?.skipBorderRadius) {
    const radiusValue = tokenToCSSVar(size.borderRadius);
    lines.push(`  border-radius: ${radiusValue === "0" ? "0" : radiusValue};`);
  }

  // ─── Phase 2a Level 1 확장 필드 ───

  // line-height
  if (size.lineHeight !== undefined) {
    if (typeof size.lineHeight === "number") {
      lines.push(`  line-height: ${size.lineHeight}px;`);
    } else {
      lines.push(`  line-height: ${tokenToCSSVar(size.lineHeight)};`);
    }
  }

  // font-weight
  if (size.fontWeight !== undefined) {
    lines.push(`  font-weight: ${size.fontWeight};`);
  }

  // letter-spacing
  if (size.letterSpacing !== undefined) {
    lines.push(`  letter-spacing: ${size.letterSpacing}px;`);
  }

  // border-width — ADR-071: containerStyles.border 존재 시 skip (border shorthand 이중 emit 방지)
  if (size.borderWidth !== undefined && !options?.skipBorderWidth) {
    lines.push(`  border-width: ${size.borderWidth}px;`);
  }

  // min-width / min-height
  if (size.minWidth !== undefined) {
    lines.push(`  min-width: ${size.minWidth}px;`);
  }
  if (size.minHeight !== undefined) {
    lines.push(`  min-height: ${size.minHeight}px;`);
  }

  // gap — ADR-071: containerStyles.gap 존재 시 skip (이중 emit 방지)
  if (size.gap && !options?.skipGap) {
    lines.push(`  gap: ${size.gap}px;`);
  }

  // column-gap — ADR-088: `gap` shorthand 뒤에 emit 하여 column 축만 override.
  //   row-gap 과 column-gap 이 다른 값을 가져야 하는 경우 (예: Slider — row 4 / column 16~20).
  if (size.columnGap != null) {
    lines.push(`  column-gap: ${size.columnGap}px;`);
  }

  // icon-size (CSS 변수로 출력)
  if (size.iconSize !== undefined) {
    lines.push(`  --icon-size: ${size.iconSize}px;`);
  }

  // icon-gap (CSS 변수로 출력)
  if (size.iconGap !== undefined) {
    lines.push(`  --icon-gap: ${size.iconGap}px;`);
  }

  return lines;
}

// ─── Child Font Styles (heading/description) ─────────────────────────────────

/**
 * spec sizes에 headingFontSize/descFontSize 등이 있으면
 * .alert-heading / .react-aria-Description 자식 CSS를 자동 생성
 */
function generateChildFontStyles<Props>(spec: ComponentSpec<Props>): string[] {
  const lines: string[] = [];
  const defaultSize =
    spec.sizes[spec.defaultSize] ?? Object.values(spec.sizes)[0];
  if (!defaultSize) return lines;

  const ds = defaultSize as unknown as Record<string, unknown>;
  const hasHeading = ds.headingFontSize != null || ds.headingFontWeight != null;
  const hasDesc = ds.descFontSize != null || ds.descFontWeight != null;
  if (!hasHeading && !hasDesc) return lines;

  const cls = `.react-aria-${spec.name}`;

  // Heading — base
  if (hasHeading) {
    lines.push(`/* Heading */`);
    lines.push(`${cls} .alert-heading {`);
    lines.push(`  margin: 0;`);
    if (ds.headingFontSize != null) {
      lines.push(
        `  font-size: ${typeof ds.headingFontSize === "number" ? `${ds.headingFontSize}px` : tokenToCSSVar(ds.headingFontSize as TokenRef)};`,
      );
    }
    if (ds.headingFontWeight != null)
      lines.push(`  font-weight: ${ds.headingFontWeight};`);
    lines.push(`  line-height: 1.4;`);
    lines.push(`}`);
    lines.push(``);
  }

  // Description — base
  if (hasDesc) {
    lines.push(`/* Description */`);
    lines.push(`${cls} .react-aria-Description {`);
    lines.push(`  margin: 0;`);
    lines.push(`  width: 100%;`);
    if (ds.descFontSize != null)
      lines.push(`  font-size: ${ds.descFontSize}px;`);
    if (ds.descFontWeight != null)
      lines.push(`  font-weight: ${ds.descFontWeight};`);
    lines.push(`  line-height: 1.5;`);
    lines.push(`}`);
    lines.push(``);
  }

  // Size별 heading/description 오버라이드
  for (const [sizeName, sizeSpec] of Object.entries(spec.sizes)) {
    const ss = sizeSpec as unknown as Record<string, unknown>;

    if (
      hasHeading &&
      (ss.headingFontSize != null || ss.headingFontWeight != null)
    ) {
      const sizeLines: string[] = [];
      if (ss.headingFontSize != null) {
        sizeLines.push(
          `  font-size: ${typeof ss.headingFontSize === "number" ? `${ss.headingFontSize}px` : tokenToCSSVar(ss.headingFontSize as TokenRef)};`,
        );
      }
      if (ss.headingFontWeight != null)
        sizeLines.push(`  font-weight: ${ss.headingFontWeight};`);
      if (sizeLines.length > 0) {
        lines.push(`${cls}[data-size="${sizeName}"] .alert-heading {`);
        lines.push(...sizeLines);
        lines.push(`}`);
        lines.push(``);
      }
    }

    if (hasDesc && (ss.descFontSize != null || ss.descFontWeight != null)) {
      const sizeLines: string[] = [];
      if (ss.descFontSize != null)
        sizeLines.push(`  font-size: ${ss.descFontSize}px;`);
      if (ss.descFontWeight != null)
        sizeLines.push(`  font-weight: ${ss.descFontWeight};`);
      if (sizeLines.length > 0) {
        lines.push(`${cls}[data-size="${sizeName}"] .react-aria-Description {`);
        lines.push(...sizeLines);
        lines.push(`}`);
        lines.push(``);
      }
    }
  }

  return lines;
}

// ─── State Styles ───────────────────────────────────────────────────────────

/**
 * boxShadow 값 해석 (토큰 또는 CSS 문자열)
 */
function resolveBoxShadow(
  value: string | ShadowTokenRef | undefined,
): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("{shadow.")) {
    const name = value.slice(8, -1);
    return `var(--shadow-${name})`;
  }
  return value;
}

function generateStateStyles<Props>(spec: ComponentSpec<Props>): string[] {
  const lines: string[] = [];
  const states = spec.states;

  // hover
  if (states?.hover) {
    lines.push(`.react-aria-${spec.name}[data-hovered] {`);
    // ADR-070: hover 상태 색상 emit (optional)
    if (states.hover.background) {
      lines.push(`  background: ${tokenToCSSVar(states.hover.background)};`);
    }
    if (states.hover.text) {
      lines.push(`  color: ${tokenToCSSVar(states.hover.text)};`);
    }
    if (states.hover.border) {
      lines.push(`  border-color: ${tokenToCSSVar(states.hover.border)};`);
    }
    if (states.hover.boxShadow) {
      lines.push(`  box-shadow: ${resolveBoxShadow(states.hover.boxShadow)};`);
    }
    if (states.hover.transform) {
      lines.push(`  transform: ${states.hover.transform};`);
    }
    if (states.hover.scale !== undefined) {
      lines.push(`  transform: scale(${states.hover.scale});`);
    }
    if (states.hover.opacity !== undefined) {
      lines.push(`  opacity: ${states.hover.opacity};`);
    }
    lines.push("}");
    lines.push("");
  }

  // focused
  if (states?.focused) {
    lines.push(`.react-aria-${spec.name}[data-focused] {`);
    if (states.focused.boxShadow) {
      lines.push(
        `  box-shadow: ${resolveBoxShadow(states.focused.boxShadow)};`,
      );
    }
    if (states.focused.transform) {
      lines.push(`  transform: ${states.focused.transform};`);
    }
    lines.push("}");
    lines.push("");
  }

  // focusVisible (ADR-061: focusRing TokenRef 기반. 미설정 시 default ring)
  lines.push(`.react-aria-${spec.name}[data-focus-visible] {`);
  {
    const ringRef = states?.focusVisible?.focusRing ?? "{focus.ring.default}";
    const resolved = resolveFocusRingToken(ringRef);
    lines.push(`  outline: ${resolved.outline};`);
    lines.push(`  outline-offset: ${resolved.outlineOffset};`);
    if (states?.focusVisible?.boxShadow) {
      lines.push(
        `  box-shadow: ${resolveBoxShadow(states.focusVisible.boxShadow)};`,
      );
    }
  }
  lines.push("}");
  lines.push("");

  // pressed
  if (states?.pressed) {
    lines.push(`.react-aria-${spec.name}[data-pressed] {`);
    if (states.pressed.boxShadow) {
      lines.push(
        `  box-shadow: ${resolveBoxShadow(states.pressed.boxShadow)};`,
      );
    }
    if (states.pressed.transform) {
      lines.push(`  transform: ${states.pressed.transform};`);
    }
    if (states.pressed.scale !== undefined) {
      lines.push(`  transform: scale(${states.pressed.scale});`);
    }
    lines.push("}");
    lines.push("");
  }

  // disabled
  lines.push(`.react-aria-${spec.name}[data-disabled] {`);
  if (states?.disabled) {
    lines.push(`  opacity: ${states.disabled.opacity ?? 0.38};`);
    lines.push(`  cursor: ${states.disabled.cursor ?? "not-allowed"};`);
    lines.push(`  pointer-events: ${states.disabled.pointerEvents ?? "none"};`);
    // ADR-070: disabled 상태 색상 emit (optional)
    if (states.disabled.background) {
      lines.push(`  background: ${tokenToCSSVar(states.disabled.background)};`);
    }
    if (states.disabled.text) {
      lines.push(`  color: ${tokenToCSSVar(states.disabled.text)};`);
    }
    if (states.disabled.border) {
      lines.push(`  border-color: ${tokenToCSSVar(states.disabled.border)};`);
    }
  } else {
    lines.push("  opacity: 0.38;");
    lines.push("  cursor: not-allowed;");
    lines.push("  pointer-events: none;");
  }
  lines.push("}");

  return lines;
}

// ─── Phase 3a: Tier 2 Composite CSS Generation ─────────────────────────────

function generateCompositionCSS<Props>(spec: ComponentSpec<Props>): string[] {
  const comp = spec.composition;
  if (!comp) return [];

  const sel = `.react-aria-${spec.name}`;
  const lines: string[] = [];

  // delegation: size별 자식 변수 override
  for (const delegation of comp.delegation) {
    const { childSelector } = delegation;

    // ADR-059 v2 0-C: "auto" 선언 시 spec.sizes 에서 파생
    const variables =
      delegation.variables === "auto"
        ? deriveAutoDelegationVariables(spec, delegation)
        : (delegation.variables ?? {});

    for (const [sizeName, vars] of Object.entries(variables)) {
      const entries = Object.entries(vars);
      if (entries.length === 0) continue;

      lines.push(`${sel}[data-size="${sizeName}"] ${childSelector} {`);
      for (const [varName, value] of entries) {
        lines.push(`  ${varName}: ${value};`);
      }
      lines.push("}");
      lines.push("");
    }

    // ADR-059 v2 Pre-Phase 0-D.1: Bridge 변수 (size 비분기)
    // ※ states 보다 먼저 emit — 동일 specificity 에서 state 가 cascade 로 override 하도록
    if (delegation.bridges) {
      const bridgeEntries = Object.entries(delegation.bridges);
      if (bridgeEntries.length > 0) {
        lines.push(`${sel} ${childSelector} {`);
        for (const [varName, value] of bridgeEntries) {
          lines.push(`  ${varName}: ${value};`);
        }
        lines.push("}");
        lines.push("");
      }
    }

    // ADR-059 v2 Pre-Phase 0-D.4: 자식 상태 selector
    if (delegation.states) {
      for (const [stateSel, rawStyles] of Object.entries(delegation.states)) {
        if (Object.keys(rawStyles).length === 0) continue;
        const styles = rewriteAnimationNames(rawStyles, spec);
        lines.push(`${sel} ${childSelector}:where(${stateSel}) {`);
        for (const [prop, value] of Object.entries(styles)) {
          lines.push(`  ${prop}: ${value};`);
        }
        lines.push("}");
        lines.push("");
      }
    }
  }

  // ADR-059 v2 Pre-Phase 0-D.6: externalStyles (portal 등 root 외부 selector)
  if (comp.externalStyles) {
    for (const ext of comp.externalStyles) {
      if (ext.styles && Object.keys(ext.styles).length > 0) {
        const extStyles = rewriteAnimationNames(ext.styles, spec);
        lines.push(`${ext.selector} {`);
        for (const [prop, value] of Object.entries(extStyles)) {
          lines.push(`  ${prop}: ${value};`);
        }
        lines.push("}");
        lines.push("");
      }
      if (ext.nested) {
        for (const n of ext.nested) {
          if (Object.keys(n.styles).length === 0) continue;
          const nestedExtStyles = rewriteAnimationNames(n.styles, spec);
          lines.push(`${ext.selector} ${n.selector} {`);
          for (const [prop, value] of Object.entries(nestedExtStyles)) {
            lines.push(`  ${prop}: ${value};`);
          }
          lines.push("}");
          lines.push("");
        }
      }
    }
  }

  // ADR-059 v2 Pre-Phase 0-D.3: containerVariants
  if (comp.containerVariants) {
    for (const [dataAttr, valueMap] of Object.entries(comp.containerVariants)) {
      for (const [attrValue, variant] of Object.entries(valueMap)) {
        const variantSel = `${sel}[data-${dataAttr}="${attrValue}"]`;

        if (variant.styles && Object.keys(variant.styles).length > 0) {
          const variantStyles = rewriteAnimationNames(variant.styles, spec);
          lines.push(`${variantSel} {`);
          for (const [prop, value] of Object.entries(variantStyles)) {
            lines.push(`  ${prop}: ${value};`);
          }
          lines.push("}");
          lines.push("");
        }

        if (variant.nested) {
          for (const nested of variant.nested) {
            if (Object.keys(nested.styles).length === 0) continue;
            // `&` prefix → compound (동일 요소 결합, 공백 없음)
            // 예: `&:has(...) .child` → `{variantSel}:has(...) .child`
            const combined = nested.selector.startsWith("&")
              ? `${variantSel}${nested.selector.slice(1)}`
              : `${variantSel} ${nested.selector}`;
            const nestedStyles = rewriteAnimationNames(nested.styles, spec);
            lines.push(`${combined} {`);
            for (const [prop, value] of Object.entries(nestedStyles)) {
              lines.push(`  ${prop}: ${value};`);
            }
            lines.push("}");
            lines.push("");
          }
        }
      }
    }
  }

  return lines;
}

// ─── ADR-059 B5: Indicator Mode CSS ─────────────────────────────────────────

function generateIndicatorModeCSS<Props>(spec: ComponentSpec<Props>): string[] {
  const im = spec.indicatorMode;
  if (!im) return [];
  const base = `.react-aria-${spec.name}[data-indicator="true"]`;
  const shadow = im.boxShadow
    ? (resolveBoxShadow(im.boxShadow as string | ShadowTokenRef) ??
      "var(--shadow-sm)")
    : "var(--shadow-sm)";
  const transition = im.transitionMs ?? 200;
  const lines: string[] = [];

  // Group: bg-muted 배경 (via .button-base)
  lines.push(`${base} {`);
  lines.push(`  --button-color: var(--bg-muted);`);
  lines.push("}");
  lines.push("");

  // SelectionIndicator — pill의 위치/크기만 담당.
  // 색상(--button-color/--button-text/--button-border)은 parent ToggleButton의 variant CSS에서 상속:
  //   [data-variant="default"][data-selected]        → --button-color: var(--fg)    (dark pill)
  //   [data-variant="default"][data-emphasized][data-selected] → --button-color: var(--accent) (accent pill)
  // 이것이 standalone selected ToggleButton과 동일한 시각을 보장.
  lines.push(
    `${base} .react-aria-ToggleButton .react-aria-SelectionIndicator {`,
  );
  lines.push(`  position: absolute;`);
  lines.push(`  inset: 0;`);
  lines.push(`  z-index: -1;`);
  lines.push(`  border-radius: var(--btn-border-radius);`);
  lines.push(`  box-shadow: ${shadow};`);
  lines.push(`  pointer-events: none;`);
  // SelectionIndicator는 data-selected가 하드코딩되어 있으므로 parent ToggleButton 선택 상태로 visibility 제어
  lines.push(`  opacity: 0;`);
  lines.push(
    `  transition: opacity ${transition}ms cubic-bezier(0.16, 1, 0.3, 1), translate ${transition}ms cubic-bezier(0.16, 1, 0.3, 1), width ${transition}ms cubic-bezier(0.16, 1, 0.3, 1), height ${transition}ms cubic-bezier(0.16, 1, 0.3, 1);`,
  );
  lines.push("}");
  lines.push("");

  // Parent ToggleButton[data-selected]일 때만 SelectionIndicator 표시
  lines.push(
    `${base} .react-aria-ToggleButton[data-selected] .react-aria-SelectionIndicator {`,
  );
  lines.push(`  opacity: 1;`);
  lines.push("}");
  lines.push("");

  // ToggleButton 컨테이너 — 투명, 색상은 parent variant CSS의 --button-text 상속
  lines.push(`${base} .react-aria-ToggleButton {`);
  lines.push(`  position: relative;`);
  lines.push(`  z-index: 0;`);
  lines.push(`  background: transparent;`);
  lines.push(`  border-color: transparent;`);
  lines.push(`  border-width: 0;`);
  lines.push(`  color: var(--button-text);`);
  lines.push("}");
  lines.push("");

  // ADR-908 Phase 3-B: IndicatorModeSpec fill dual-read seam
  const imFill = resolveIndicatorFill(im);
  if (imFill.pressed) {
    lines.push(
      `${base} .react-aria-ToggleButton[data-pressed]:not([data-selected]) {`,
    );
    lines.push(`  background: ${tokenToCSSVar(imFill.pressed)};`);
    lines.push("}");
    lines.push("");
  }

  lines.push(`@media (prefers-reduced-motion: reduce) {`);
  lines.push(
    `  ${base} .react-aria-ToggleButton .react-aria-SelectionIndicator {`,
  );
  lines.push(`    transition: none;`);
  lines.push(`  }`);
  lines.push("}");
  lines.push("");

  return lines;
}

// ─── Phase 3b: @media 공통 패턴 ─────────────────────────────────────────────

function generateMediaQueries<Props>(spec: ComponentSpec<Props>): string[] {
  const sel = `.react-aria-${spec.name}`;
  const lines: string[] = [];

  // forced-colors (접근성)
  lines.push("@media (forced-colors: active) {");
  lines.push(`  ${sel} {`);
  lines.push("    forced-color-adjust: auto;");
  lines.push("  }");
  lines.push("}");
  lines.push("");

  // prefers-reduced-motion (transition 있는 컴포넌트만)
  const hasTransition =
    spec.archetype === "button" ||
    spec.archetype === "toggle-indicator" ||
    spec.archetype === "overlay" ||
    spec.archetype === "progress";

  if (hasTransition) {
    lines.push("@media (prefers-reduced-motion: reduce) {");
    lines.push(`  ${sel} {`);
    lines.push("    transition-duration: 0s !important;");
    lines.push("  }");
    lines.push("}");
  }

  return lines;
}

// ─── Phase 4.5a 0-D.10: Selector Validation ───────────────────────────────────

const FORBIDDEN_SELECTOR_CHARS = /[{};@]/;

function validateRootSelectorKey(key: string, specName: string): void {
  if (!key.startsWith("&")) {
    throw new Error(
      `[CSSGenerator] ${specName}: rootSelectors key must start with "&". Got: ${JSON.stringify(key)}`,
    );
  }
  if (FORBIDDEN_SELECTOR_CHARS.test(key)) {
    throw new Error(
      `[CSSGenerator] ${specName}: rootSelectors key contains forbidden chars ({};@). Got: ${JSON.stringify(key)}`,
    );
  }
}

function validateNestedSelectorKey(
  key: string,
  specName: string,
  context: string,
): void {
  if (FORBIDDEN_SELECTOR_CHARS.test(key)) {
    throw new Error(
      `[CSSGenerator] ${specName}: ${context} selector contains forbidden chars ({};@). Got: ${JSON.stringify(key)}`,
    );
  }
}

// ─── Phase 4-infra2: Animation Name Rewrite ────────────────────────────────

/**
 * style 값 내부 animation/animation-name 을 `{specName}-{animName}` 으로 rewrite.
 * spec.composition.animations 에 선언된 이름만 치환. 외부 이름은 보존.
 *
 * - `animation-name: foo` → `animation-name: ProgressBar-foo`
 * - `animation: foo 1.5s ease` → `animation: ProgressBar-foo 1.5s ease`
 * - `animation: other 1s` (animations 미선언) → 그대로
 */
function rewriteAnimationNames<Props>(
  styles: Record<string, string>,
  spec: ComponentSpec<Props>,
): Record<string, string> {
  const animations = spec.composition?.animations;
  if (!animations) return styles;
  const declaredNames = new Set(Object.keys(animations));
  if (declaredNames.size === 0) return styles;

  const prefix = (name: string): string =>
    declaredNames.has(name) ? `${spec.name}-${name}` : name;

  const result: Record<string, string> = {};
  for (const [prop, value] of Object.entries(styles)) {
    if (prop === "animation-name") {
      result[prop] = prefix(value.trim());
    } else if (prop === "animation") {
      const trimmed = value.trim();
      const firstSpace = trimmed.indexOf(" ");
      if (firstSpace === -1) {
        result[prop] = prefix(trimmed);
      } else {
        const firstToken = trimmed.slice(0, firstSpace);
        const rest = trimmed.slice(firstSpace);
        result[prop] = `${prefix(firstToken)}${rest}`;
      }
    } else {
      result[prop] = value;
    }
  }
  return result;
}

// ─── Phase 4-infra2: Static Selectors ───────────────────────────────────────

/**
 * `composition.staticSelectors` → root 하위 고정 자식 selector rules emit.
 * variant 와 무관한 slot (`.bar`, `.fill` 등). Skia consumer 무시.
 * `@layer components` 내부에 emit. 미선언 시 빈 배열 → 출력 변화 0.
 */
function generateStaticSelectorRules<Props>(
  spec: ComponentSpec<Props>,
): string[] {
  const staticSelectors = spec.composition?.staticSelectors;
  if (!staticSelectors) return [];

  const lines: string[] = [];
  const rootSel = `.react-aria-${spec.name}`;

  for (const [selector, rawStyles] of Object.entries(staticSelectors)) {
    validateNestedSelectorKey(selector, spec.name, "staticSelectors");
    const styles = rewriteAnimationNames(rawStyles, spec);
    lines.push(`  ${rootSel} ${selector} {`);
    for (const [prop, value] of Object.entries(styles)) {
      lines.push(`    ${prop}: ${value};`);
    }
    lines.push(`  }`);
    lines.push("");
  }

  return lines;
}

// ─── Phase 4-infra2 0-D.9: Size Selectors ──────────────────────────────────

/**
 * `composition.sizeSelectors` → per-size child selector rules emit.
 * `@layer components` 내부에 emit. 미선언 시 빈 배열 반환 → 출력 변화 0.
 */
function generateSizeSelectorRules<Props>(
  spec: ComponentSpec<Props>,
): string[] {
  const sizeSelectors = spec.composition?.sizeSelectors;
  if (!sizeSelectors) return [];

  const lines: string[] = [];
  const rootSel = `.react-aria-${spec.name}`;

  for (const [sizeKey, selectors] of Object.entries(sizeSelectors)) {
    for (const [selector, rawStyles] of Object.entries(selectors)) {
      const styles = rewriteAnimationNames(rawStyles, spec);
      const fullSel = `${rootSel}[data-size="${sizeKey}"] ${selector}`;
      lines.push(`  ${fullSel} {`);
      for (const [prop, value] of Object.entries(styles)) {
        lines.push(`    ${prop}: ${value};`);
      }
      lines.push(`  }`);
      lines.push("");
    }
  }

  return lines;
}

// ─── Phase 4.5a 0-D.10: Root Selectors ─────────────────────────────────────

/**
 * `composition.rootSelectors` → root pseudo selector rules emit.
 * raw selector 의 `&` 를 `.react-aria-{Name}` 으로 치환.
 * `@layer components` 내부. 미선언 시 빈 배열 → 출력 변화 0.
 */
function generateRootSelectorRules<Props>(
  spec: ComponentSpec<Props>,
): string[] {
  const rootSelectors = spec.composition?.rootSelectors;
  if (!rootSelectors) return [];

  const lines: string[] = [];
  const rootSel = `.react-aria-${spec.name}`;

  for (const [key, entry] of Object.entries(rootSelectors)) {
    validateRootSelectorKey(key, spec.name);
    const fullSel = rootSel + key.slice(1); // strip leading `&`

    const styles = entry.styles
      ? rewriteAnimationNames(entry.styles, spec)
      : null;

    if (styles && Object.keys(styles).length > 0) {
      lines.push(`  ${fullSel} {`);
      for (const [prop, value] of Object.entries(styles)) {
        lines.push(`    ${prop}: ${value};`);
      }
      lines.push(`  }`);
      lines.push("");
    }

    if (entry.nested) {
      for (const [nestedKey, rawNestedStyles] of Object.entries(entry.nested)) {
        validateNestedSelectorKey(nestedKey, spec.name, "rootSelectors.nested");
        const nestedStyles = rewriteAnimationNames(rawNestedStyles, spec);
        lines.push(`  ${fullSel} ${nestedKey} {`);
        for (const [prop, value] of Object.entries(nestedStyles)) {
          lines.push(`    ${prop}: ${value};`);
        }
        lines.push(`  }`);
        lines.push("");
      }
    }
  }

  return lines;
}

// ─── Phase 4-infra 0-D.7/0-D.8: Animation At-Rules ──────────────────────────

/**
 * `composition.animations` → `@keyframes` + `@media (prefers-reduced-motion)` emit.
 * @layer components **바깥**에 배치하여 cascade 영향 없음.
 * animations 미선언 시 빈 배열 반환 → 기존 출력 변화 0.
 */
function generateAnimationAtRules<Props>(spec: ComponentSpec<Props>): string[] {
  const animations = spec.composition?.animations;
  if (!animations) return [];

  const lines: string[] = [];
  const rootSel = `.react-aria-${spec.name}`;

  for (const [animName, animDef] of Object.entries(animations)) {
    const keyframeName = `${spec.name}-${animName}`;
    lines.push(`@keyframes ${keyframeName} {`);
    for (const [stop, props] of Object.entries(animDef.keyframes)) {
      lines.push(`  ${stop} {`);
      for (const [prop, value] of Object.entries(
        props as Record<string, string>,
      )) {
        lines.push(`    ${prop}: ${value};`);
      }
      lines.push(`  }`);
    }
    lines.push(`}`);
    lines.push("");
  }

  const reducedBlocks: string[] = [];
  for (const animDef of Object.values(animations)) {
    if (!animDef.reducedMotion) continue;
    for (const [prop, value] of Object.entries(animDef.reducedMotion)) {
      reducedBlocks.push(`    ${prop}: ${value};`);
    }
  }
  if (reducedBlocks.length > 0) {
    lines.push(`@media (prefers-reduced-motion: reduce) {`);
    lines.push(`  ${rootSel} {`);
    lines.push(...reducedBlocks);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push("");
  }

  return lines;
}

// ─── Batch Generator ────────────────────────────────────────────────────────

/**
 * 모든 스펙에서 CSS 파일 생성
 */
export async function generateAllCSS(
  specs: ComponentSpec<unknown>[],
  outputDir: string,
): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");

  for (const spec of specs) {
    const css = generateCSS(spec);
    if (css === null) {
      console.log(`  ⏭ Skipped: ${spec.name} (skipCSSGeneration)`);
      continue;
    }
    const filePath = path.join(outputDir, `${spec.name}.css`);
    await fs.writeFile(filePath, css, "utf-8");
    console.log(`Generated: ${filePath}`);
  }
}
