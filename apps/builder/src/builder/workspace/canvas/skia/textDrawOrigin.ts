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
