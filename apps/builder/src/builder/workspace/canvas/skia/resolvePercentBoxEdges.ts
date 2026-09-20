/**
 * Skia 렌더 입력의 `%` padding / margin 을 px 로 — containing block (부모 content) 폭 기준.
 *
 * 레이아웃은 엔진이 `%` 를 containing block 폭으로 푼다 (applyCommonEngineStyle 이 문자열 그대로
 * 통과). 그런데 Skia 의 shape 합성 (`buildCatalogShapes` 의 text x/y · `buildImageNodeData` 의
 * padding 등) 은 스타일을 px 로만 읽어 (`parsePxValue` / `parseCSSSize` — 기준 폭 없음) `"10%"` 가
 * 10px 로 떨어졌다 — 상자 (layout) 는 39 인데 글리프가 11 에 그려진다 (사용자 live 2026-09-20,
 * Text `padding: 10%`). 여기서 layout map 의 부모 상자로 한 번 풀어 넘긴다 — shape 합성기는 그대로다.
 *
 * containing block 폭 = 부모 layout 폭 − 부모 padding/border (부모의 `%` padding 은 그 부모의
 * containing block 으로 재귀 — CSS-BOX-4 §3.1 과 같은 사슬). 부모가 없으면 (root) 자기 layout 폭.
 */
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import { parseBorder, parsePadding } from "../layout/engines/utils";

type StyleRecord = Record<string, unknown>;

interface ElementLike {
  id: string;
  parent_id?: string | null;
  props?: Record<string, unknown> | null;
}

const EDGE_KEYS = [
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
] as const;

const isPercent = (v: unknown): v is string =>
  typeof v === "string" && v.trim().endsWith("%");

const hasPercentEdge = (style: StyleRecord | undefined): boolean =>
  !!style &&
  EDGE_KEYS.some((key) => {
    const v = style[key];
    return (
      isPercent(v) ||
      (typeof v === "string" && v.includes("%") && v.includes(" "))
    );
  });

/** 요소가 놓인 containing block 의 content 폭 (부모 사슬을 따라 `%` padding 도 푼다). */
export function resolveContainingBlockWidth(
  element: ElementLike,
  elementsMap: Map<string, ElementLike>,
  layoutMap: Map<string, ComputedLayout> | null,
  depth = 0,
): number | undefined {
  const parentId = element.parent_id ?? undefined;
  const parent = parentId ? elementsMap.get(parentId) : undefined;
  const parentLayout = parentId ? layoutMap?.get(parentId) : undefined;
  if (!parent || !parentLayout) {
    return layoutMap?.get(element.id)?.width;
  }
  const parentStyle = (parent.props?.style ?? {}) as StyleRecord;
  // 부모의 `%` padding 은 부모의 containing block 기준 (사슬은 문서 깊이만큼 — 상한 64).
  const parentBase =
    depth < 64 && hasPercentEdge(parentStyle)
      ? resolveContainingBlockWidth(parent, elementsMap, layoutMap, depth + 1)
      : undefined;
  const pad = parsePadding(parentStyle, parentBase ?? parentLayout.width);
  const border = parseBorder(parentStyle);
  return Math.max(
    0,
    parentLayout.width - pad.left - pad.right - border.left - border.right,
  );
}

/**
 * style 의 `%` padding / margin 을 px 숫자 longhand 로 바꾼 사본 — `%` 가 없으면 같은 참조.
 * shorthand 에 `%` 가 섞여 있으면 네 longhand 로 펼치고 shorthand 는 지운다 (px 토큰도 함께).
 */
export function resolvePercentBoxEdgesStyle(
  style: StyleRecord | undefined,
  containingWidth: number | undefined,
): StyleRecord | undefined {
  if (!style || containingWidth === undefined || !hasPercentEdge(style))
    return style;
  const next: StyleRecord = { ...style };
  for (const prop of ["padding", "margin"] as const) {
    const shorthand = style[prop];
    const longhands = [
      `${prop}Top`,
      `${prop}Right`,
      `${prop}Bottom`,
      `${prop}Left`,
    ] as const;
    const shorthandHasPercent =
      typeof shorthand === "string" && shorthand.includes("%");
    const anyPercent =
      shorthandHasPercent || longhands.some((k) => isPercent(style[k]));
    if (!anyPercent) continue;
    // parsePadding/parseMargin 과 같은 우선순위 (longhand > shorthand) 로 네 변을 px 로.
    const resolved =
      prop === "padding"
        ? parsePadding(style, containingWidth)
        : parseMarginPreservingAuto(style, containingWidth);
    for (const [i, key] of longhands.entries()) {
      const raw = style[key];
      const side = (["top", "right", "bottom", "left"] as const)[i];
      // auto (margin) 와 px/숫자 longhand 는 그대로 — `%` 인 변과 shorthand 에서 오는 변만 px 로.
      if (raw === undefined || isPercent(raw)) {
        const value = resolved[side];
        if (value !== undefined) next[key] = value;
      }
    }
    if (shorthandHasPercent) delete next[prop];
  }
  return next;
}

/** margin: `auto` 변은 "auto" 문자열로 — shorthand 를 지워도 longhand 가 auto 를 보존한다. */
function parseMarginPreservingAuto(
  style: StyleRecord,
  containingWidth: number,
): Record<"top" | "right" | "bottom" | "left", number | string | undefined> {
  const numeric = parsePadding(
    {
      padding: style.margin,
      paddingTop: style.marginTop,
      paddingRight: style.marginRight,
      paddingBottom: style.marginBottom,
      paddingLeft: style.marginLeft,
    },
    containingWidth,
  );
  const tokens =
    typeof style.margin === "string" ? style.margin.trim().split(/\s+/) : [];
  const shorthandSide = (i: number): string | undefined => {
    if (tokens.length === 0) return undefined;
    const map =
      tokens.length === 1
        ? [0, 0, 0, 0]
        : tokens.length === 2
          ? [0, 1, 0, 1]
          : tokens.length === 3
            ? [0, 1, 2, 1]
            : [0, 1, 2, 3];
    return tokens[map[i]];
  };
  const sides = ["top", "right", "bottom", "left"] as const;
  const keys = ["marginTop", "marginRight", "marginBottom", "marginLeft"];
  const out = {} as Record<(typeof sides)[number], number | string | undefined>;
  sides.forEach((side, i) => {
    const raw = style[keys[i]] ?? shorthandSide(i);
    out[side] =
      typeof raw === "string" && raw.trim().toLowerCase() === "auto"
        ? "auto"
        : numeric[side];
  });
  return out;
}

/** 렌더 입력 요소의 `%` padding / margin 을 px 로 푼 사본 — 없으면 같은 참조. */
export function resolvePercentBoxEdgesForRender<T extends ElementLike>(
  element: T,
  elementsMap: Map<string, ElementLike>,
  layoutMap: Map<string, ComputedLayout> | null,
): T {
  const style = element.props?.style as StyleRecord | undefined;
  if (!hasPercentEdge(style)) return element;
  const containingWidth = resolveContainingBlockWidth(
    element,
    elementsMap,
    layoutMap,
  );
  const next = resolvePercentBoxEdgesStyle(style, containingWidth);
  if (next === style) return element;
  return { ...element, props: { ...element.props, style: next } };
}
