import { createFillTreeResolver, type FillTreeNode } from "./fillSizingTree";
/**
 * ADR-154 Phase 3 — 반응형 override → @media CSS 출력 (SSOT)
 *
 * Preview / Publish (generateStaticHtml) 두 DOM consumer 가 공유하는 **단일**
 * @media 생성 진입점. Builder(Skia) 의 `resolveResponsiveLayoutNode` 와 **동일 helper**
 * (`getResponsiveValueWithCascade`) 로 breakpoint 별 값을 pre-resolve 하여 3경로
 * (Skia/Preview/Publish) resolve 발산을 차단한다 (R2).
 *
 * ## R6 (inline specificity) 해소 — `!important` @media
 *
 * Preview/Publish 는 요소 스타일을 inline (`style={props.style}`) 으로 적용한다.
 * 일반 stylesheet 규칙은 inline (normal-author, 최대 특이도) 을 이기지 못하지만,
 * **stylesheet `!important` 선언(important-author 버킷)은 non-important inline
 * (normal-author 버킷)을 origin/importance 단계에서 이긴다** (특이도 비교 이전).
 * 따라서 base(desktop) 는 inline 그대로 두고(BC 0), tablet/mobile override 만
 * `@media { [data-element-id] { prop: value !important } }` 로 emit 하면 된다 —
 * inline strip / base 승격 불필요.
 *
 * ## cascade
 *
 * `BREAKPOINTS` 는 상호배타 범위(desktop ≥1280 / tablet 768–1279 / mobile ≤767)라
 * mobile @media 는 tablet 규칙을 자연 상속하지 못한다. 그래서 각 breakpoint 값을
 * `getResponsiveValueWithCascade` 로 **미리 resolve** (mobile 은 tablet→desktop fallback)
 * 하여 그 breakpoint 의 @media 에 직접 넣는다 — CSS 결과 == layout resolve 결과.
 */

import type { CanonicalNode } from "../types/composition-document.types";
import {
  BREAKPOINTS,
  generateMediaQueryString,
  getResponsiveValueWithCascade,
  isResponsiveEligibleStyleProp,
  type BreakpointName,
  type ElementResponsiveConfig,
  type ResponsiveValue,
} from "../types/responsive.types";

/** override emit 대상 breakpoint (desktop = base, @media 미emit) */
const OVERRIDE_BREAKPOINTS: readonly BreakpointName[] = ["tablet", "mobile"];

/**
 * React 가 px 를 붙이지 않는 unitless 숫자 CSS 프로퍼티.
 * stylesheet 문자열은 React auto-unit 을 못 받으므로 직접 판정한다
 * (base inline(React)과 @media(문자열)의 단위 일관성 보장).
 */
const UNITLESS_PROPS: ReadonlySet<string> = new Set([
  "order",
  "fontWeight",
  "lineHeight",
  "opacity",
  "zIndex",
  "flex",
  "flexGrow",
  "flexShrink",
  "gridColumn",
  "gridRow",
  // ADR-168 R7 — grid line 은 length 가 아니라 line 번호다. px 가 붙으면 선언 자체가
  // 무효화되어 DOM 은 auto-placement 로 흐르고 Skia 는 numeric line 으로 정상 배치 →
  // 배포 산출물에서 DOM↔Skia 발산. shorthand 만 등재돼 있던 것이 결함
  // (`overflow` ↔ `overflowX/Y` 와 동형 — ADR-156 R6).
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
]);

/** camelCase style prop → CSS property name (`flexDirection` → `flex-direction`). */
export function camelToKebab(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * 스타일 값 → CSS 문자열. 숫자는 length 프로퍼티면 px 부착, unitless 면 그대로.
 * null/빈문자/NaN 은 null 반환(규칙 미emit).
 */
function formatCssValue(prop: string, value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return null;
    return UNITLESS_PROPS.has(prop) ? String(value) : `${value}px`;
  }
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

/** data-element-id selector escape (canonical id 는 영숫자/_/-/:: 로 안전하나 방어) */
function escapeAttrValue(id: string): string {
  return id.replace(/["\\]/g, "\\$&");
}

/**
 * 단일 요소의 responsive override → @media CSS 규칙 문자열.
 * override(tablet/mobile 에서 base 와 다른 값 또는 visibility:false)가 없으면 null.
 *
 * @param baseStyle desktop = base 값 (`props.style`) — cascade fallback + 중복 emit 억제용
 */
export function buildResponsiveElementCss(
  elementId: string,
  baseStyle: Record<string, unknown> | undefined,
  responsive: ElementResponsiveConfig | undefined,
  fillCss?: string,
): string | null {
  if (!responsive) return fillCss || null;
  const { styles, visibility } = responsive;
  if (!styles && !visibility) return fillCss || null;

  const base = baseStyle ?? {};
  const selector = `[data-element-id="${escapeAttrValue(elementId)}"]`;
  const parts: string[] = [];

  for (const bp of OVERRIDE_BREAKPOINTS) {
    const decls: string[] = [];

    if (styles) {
      const styleRecord = styles as Record<string, ResponsiveValue<unknown>>;
      for (const key of Object.keys(styleRecord)) {
        // ADR-154 개정 1 (R8): eligible(Layout·Transform) 이 아닌 stale override 는
        // @media 로 emit 하지 않는다 — 전역 속성은 base inline 이 전 breakpoint 담당.
        if (!isResponsiveEligibleStyleProp(key)) continue;
        const respValue = styleRecord[key];
        if (respValue == null) continue;
        const baseValue = base[key];
        const resolved = getResponsiveValueWithCascade(
          respValue,
          bp,
          baseValue,
        );
        // base 와 같으면 desktop inline 이 이미 담당 — @media 불필요
        if (resolved === baseValue) continue;
        const css = formatCssValue(key, resolved);
        if (css != null) decls.push(`${camelToKebab(key)}:${css} !important`);
      }
    }

    // visibility override: false → display:none. styles 뒤에 push(같은 selector·
    // source order 로 display 를 최종 override) — resolveResponsiveLayoutNode 정합.
    if (visibility) {
      const visible = getResponsiveValueWithCascade(
        visibility as ResponsiveValue<boolean>,
        bp,
        true,
      );
      if (visible === false) decls.push(`display:none !important`);
    }

    if (decls.length > 0) {
      const mq = generateMediaQueryString(BREAKPOINTS[bp]);
      parts.push(`${mq}{${selector}{${decls.join(";")}}}`);
    }
  }

  if (fillCss) parts.push(fillCss);
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * canonical 노드 트리를 순회하며 모든 요소의 responsive @media CSS 를 수집.
 * Preview `<style>` 주입 / Publish `generateStaticHtml` `<style>` 블록 공용.
 */
export function collectResponsiveCss(nodes: readonly CanonicalNode[]): string {
  const flat: FillTreeNode[] = [];
  const walk = (
    list: readonly CanonicalNode[],
    parent: string | null,
  ): void => {
    for (const node of list) {
      flat.push({ ...node, parent_id: parent });
      if (node.children) walk(node.children, node.id);
    }
  };
  walk(nodes, null);
  return collectResponsiveCssFromElements(flat);
}

const FILL_CSS_DEFAULTS: Record<string, string | number> = {
  width: "auto",
  height: "auto",
  flexGrow: 0,
  flexShrink: 1,
  flexBasis: "auto",
  minWidth: "auto",
  minHeight: "auto",
  alignSelf: "auto",
  justifySelf: "auto",
};

/** 부모만 tier에서 바뀌어도 자식의 derived CSS를 다시 낸다. */
function buildFillCss(
  node: FillTreeNode,
  resolve: ReturnType<typeof createFillTreeResolver>,
): string {
  if (!node.sizing && !node.responsive?.sizing) return "";
  const tiers = ["desktop", "tablet", "mobile"] as const;
  const resolved = Object.fromEntries(
    tiers.map((tier) => [tier, resolve(node, tier)]),
  ) as Record<BreakpointName, ReturnType<typeof resolve>>;
  const keys = new Set(
    tiers.flatMap((tier) => Object.keys(resolved[tier].projection)),
  );
  const selector = `[data-element-id="${escapeAttrValue(node.id)}"]`;
  const parts: string[] = [];
  for (const tier of tiers) {
    const { projection, style } = resolved[tier];
    const declarations: string[] = [];
    for (const key of keys) {
      if (tier === "desktop" && projection[key] === undefined) continue;
      const value = projection[key] ?? style[key] ?? FILL_CSS_DEFAULTS[key];
      const css = formatCssValue(key, value);
      if (css != null)
        declarations.push(`${camelToKebab(key)}:${css} !important`);
    }
    if (!declarations.length) continue;
    const rule = `${selector}{${declarations.join(";")}}`;
    parts.push(
      tier === "desktop"
        ? rule
        : `${generateMediaQueryString(BREAKPOINTS[tier])}{${rule}}`,
    );
  }
  return parts.join("\n");
}

export function collectResponsiveCssFromElements(
  elements: ReadonlyArray<FillTreeNode & { deleted?: boolean }>,
): string {
  const nodes = new Map(
    elements.filter((el) => !el.deleted).map((el) => [el.id, el]),
  );
  const resolve = createFillTreeResolver(nodes);
  const parts: string[] = [];
  for (const el of nodes.values()) {
    const style = el.props?.style as Record<string, unknown> | undefined;
    const css = buildResponsiveElementCss(
      el.id,
      style,
      el.responsive,
      buildFillCss(el, resolve),
    );
    if (css) parts.push(css);
  }
  return parts.join("\n");
}
