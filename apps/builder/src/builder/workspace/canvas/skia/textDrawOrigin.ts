/**
 * ADR-027 D2 — 편집 진입 시점에 Skia 가 첫 글리프를 그린 element-local 자리.
 *
 * x 는 paragraph 상자 원점 (`recordTextDrawOrigin`, 마지막 프레임) + 첫 줄의 `left`
 * (center / right 정렬은 paragraph 안에서 일어나므로 상자 left 로는 비교가 안 된다 —
 * 폭이 다른 두 상자의 left 를 맞추면 center 가 어긋난다). y 는 첫 line box top.
 * 노드가 paragraph 를 보유하지 않으면 상자 원점만 (left 0 으로) 돌려준다.
 */
import { getSkiaNode } from "./useSkiaNode";
import { getTextDrawOrigin } from "./nodeRendererState";
import { peekRetainedParagraph } from "./retainedParagraph";
import type { SkiaNodeData } from "./nodeRendererTypes";

export interface TextGlyphOrigin {
  x: number;
  y: number;
  /** 첫 줄 baseline (paragraph top 기준). paragraph 가 없으면 undefined. */
  baseline?: number;
  /**
   * D3 — Skia 가 paragraph 를 layout 한 폭이 노드 `maxWidth` 보다 넓은 만큼 (px, ≥ 0). Canvas 2D
   * 줄바꿈 힌트 경로가 `max(maxWidth, ceil(c2dWidth) + 1)` 로 layout 하므로 fit-content 라벨은
   * 상자보다 1px 넓은 폭에서 한 줄이다 — 오버레이가 상자 폭 그대로 wrap 하면 마지막 단어가
   * 다음 줄로 떨어진다 (Link "Learn more 자세히" 112.56 in 112, cv feature 적용 뒤).
   */
  wrapWidthExtra: number;
}

function findTextNode(node: SkiaNodeData | undefined): SkiaNodeData | null {
  if (!node) return null;
  if (node.text) return node;
  for (const child of node.children ?? []) {
    const found = findTextNode(child);
    if (found) return found;
  }
  return null;
}

/**
 * The text node under an element with its offset inside the element. The element's root node
 * carries its own `x` · `y` (the layout rect, parent-relative — `canvasBinding` `box(node, rect)`),
 * which is not an offset inside the element; only descendant nodes' `x` · `y` are (drawn inside the
 * element's translate, `emitInternalChildDraw`). **Why (2026-10-20)**: adding the root's `x` · `y`
 * put a moved Button's edit field at twice its position (user: absolute x/y · parent padding).
 */
function findTextNodeOffset(
  node: SkiaNodeData | undefined,
): { node: SkiaNodeData; x: number; y: number } | null {
  if (!node) return null;
  if (node.text) return { node, x: 0, y: 0 };
  const visit = (
    parent: SkiaNodeData,
    x: number,
    y: number,
  ): { node: SkiaNodeData; x: number; y: number } | null => {
    for (const child of parent.children ?? []) {
      const cx = x + child.x;
      const cy = y + child.y;
      if (child.text) return { node: child, x: cx, y: cy };
      const found = visit(child, cx, cy);
      if (found) return found;
    }
    return null;
  };
  return visit(node, 0, 0);
}

export function resolveTextGlyphOrigin(
  elementId: string,
): TextGlyphOrigin | null {
  const origin = getTextDrawOrigin(elementId);
  if (!origin) return null;
  const textNode = findTextNode(getSkiaNode(elementId) ?? undefined);
  const paragraph = textNode ? peekRetainedParagraph(textNode) : undefined;
  const firstLine = paragraph?.getLineMetrics()[0];
  const wrapWidthExtra =
    paragraph && textNode?.text
      ? Math.max(0, paragraph.getMaxWidth() - textNode.text.maxWidth)
      : 0;
  return {
    x: origin.x + (firstLine?.left ?? 0),
    y: origin.y,
    baseline: firstLine?.baseline,
    wrapWidthExtra,
  };
}

/** D3 진단 — 보유 paragraph 의 줄 metrics (element-local 은 아님, paragraph 상자 기준). */
export interface TextLineMetric {
  left: number;
  width: number;
  height: number;
  baseline: number;
  ascent: number;
  descent: number;
}

export function resolveTextLineMetrics(
  elementId: string,
): TextLineMetric[] | null {
  const textNode = findTextNode(getSkiaNode(elementId) ?? undefined);
  const paragraph = textNode ? peekRetainedParagraph(textNode) : undefined;
  if (!paragraph) return null;
  return paragraph.getLineMetrics().map((m) => ({
    left: m.left,
    width: m.width,
    height: m.height,
    baseline: m.baseline,
    ascent: m.ascent,
    descent: m.descent,
  }));
}

/**
 * 진단 — text 자식의 상자 (width · height · padding · whiteSpace · maxWidth · font) 와 마지막
 * 프레임의 draw 원점. 단일행 글리프 중앙 배치 (`computeDrawY`) 의 입력을 페이지 밖에서 읽는다.
 */
export function resolveTextNodeDebug(elementId: string): Record<
  string,
  unknown
> | null {
  const textNode = findTextNode(getSkiaNode(elementId) ?? undefined);
  if (!textNode?.text) return null;
  const t = textNode.text;
  return {
    width: textNode.width,
    height: textNode.height,
    content: t.content,
    whiteSpace: t.whiteSpace,
    maxWidth: t.maxWidth,
    paddingTop: t.paddingTop,
    paddingBottom: t.paddingBottom,
    paddingLeft: t.paddingLeft,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
    fontFamilies: t.fontFamilies,
    verticalAlign: t.verticalAlign,
    lineHeight: t.lineHeight,
    origin: getTextDrawOrigin(elementId) ?? null,
    lines: resolveTextLineMetrics(elementId),
  };
}


/**
 * 2026-10-20 — 인라인 편집 상자가 놓일 자리: Skia 가 요소의 글자를 그리는 content 상자 (element-local
 * scene px) 와 그 글꼴. Button 처럼 글자가 padding 안 한 줄에 놓이는 요소는 상자 전체가 아니라 그 줄
 * 자리에서 편집한다 (사용자 보고 — "버튼 영역 전체에서 된다"). `specShapeConverter` 가 중앙 배치를
 * `paddingTop` · `paddingBottom` 으로 굳히므로 (text block 높이 = 상자 − 둘) 마지막 프레임 상태 없이
 * 기하만으로 같은 자리다. 글자 노드가 없으면 undefined — 호출자가 요소 상자를 쓴다.
 */
export interface TextEditBox {
  x: number;
  y: number;
  width: number;
  height: number;
  align?: "left" | "center" | "right";
  fontSize: number;
  fontWeight?: number;
  fontFamilies: readonly string[];
  /** px — 없으면 글꼴 기본 (`normal`). */
  lineHeight?: number;
  whiteSpace?: string;
  /** The drawn text's color as CSS (a Button's white label — the record's own `color` is the box's). */
  color?: string;
}

function cssColorOf(color: Float32Array | undefined): string | undefined {
  if (!color || color.length < 3) return undefined;
  const channel = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255);
  const alpha = color.length > 3 ? Math.min(1, Math.max(0, color[3]!)) : 1;
  return `rgba(${channel(color[0]!)}, ${channel(color[1]!)}, ${channel(color[2]!)}, ${alpha})`;
}

export function resolveTextEditBox(elementId: string): TextEditBox | undefined {
  const found = findTextNodeOffset(getSkiaNode(elementId) ?? undefined);
  const node = found?.node;
  const text = node?.text;
  if (!found || !node || !text) return undefined;
  const paragraph = peekRetainedParagraph(node);
  // D3 — pre-wrap 은 Skia 가 상자보다 최대 1px 넓게 layout 한다: 같은 자리에서 줄을 바꾸도록 그만큼.
  const wrapWidthExtra =
    paragraph && text.whiteSpace === "pre-wrap"
      ? Math.max(0, paragraph.getMaxWidth() - text.maxWidth)
      : 0;
  const explicitBottom =
    typeof text.paddingBottom === "number" && text.paddingBottom >= 0;
  const paddingBottom = explicitBottom ? text.paddingBottom! : 0;
  // The text block's height: the paragraph Skia holds (drawn once), else the line height (the
  // field's own line box is the same height — a Button's label while it is being typed).
  const textHeight = paragraph
    ? paragraph.getHeight()
    : (text.lineHeight ?? Math.round(text.fontSize * 1.2));
  // The same vertical placement as `nodeRendererText` `computeDrawY`: middle / bottom centre the
  // text block in the whole box; an explicit bottom padding centres it in the content box; else the
  // text starts at the top padding.
  const contentHeight = Math.max(
    1,
    node.height - text.paddingTop - paddingBottom,
  );
  const vertical =
    text.verticalAlign === "middle"
      ? { y: (node.height - textHeight) / 2, height: textHeight }
      : text.verticalAlign === "bottom"
        ? { y: node.height - textHeight, height: textHeight }
        : explicitBottom &&
            (!text.verticalAlign || text.verticalAlign === "baseline")
          ? {
              y:
                text.paddingTop +
                Math.max(0, (contentHeight - textHeight) / 2),
              height: Math.min(contentHeight, textHeight),
            }
          : { y: text.paddingTop, height: contentHeight };
  return {
    x: found.x + text.paddingLeft,
    y: found.y + vertical.y,
    width: Math.max(1, text.maxWidth + wrapWidthExtra),
    height: Math.max(1, vertical.height),
    align: typeof text.align === "string" ? text.align : undefined,
    fontSize: text.fontSize,
    fontWeight: text.fontWeight,
    fontFamilies: text.fontFamilies,
    lineHeight: text.lineHeight,
    whiteSpace: text.whiteSpace,
    color: cssColorOf(text.presentationColor ?? text.color),
  };
}
