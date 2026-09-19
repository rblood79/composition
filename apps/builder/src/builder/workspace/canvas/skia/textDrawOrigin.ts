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
  return { x: origin.x + (firstLine?.left ?? 0), y: origin.y };
}
