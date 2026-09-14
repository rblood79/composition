/**
 * useDocumentColors — 색 피커 「Document」 팔레트 (panel-ui 05 #1, 2026-09-15)
 *
 * 이 문서에서 쓰인 색을 자동 수집한다 — 저장소가 따로 없고 (이름 있는 팔레트 없음) 읽을 때
 * 만든다. 소스는 fills 와 같은 정본: canonical 문서가 있으면 node fills payload + node
 * props.style, 없으면 (legacy) store elements. 색 키는 backgroundColor · color · borderColor
 * + color fill. 정규화는 hex8, 빈도 순, 상한 12 (6열 두 행).
 */
import { useMemo } from "react";
import { useStore } from "../../../stores";
import { getActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";
import { getNodeMap } from "../../../stores/canonical/canonicalTraversalHelpers";
import { readCanonicalNodeFillPayload } from "../../../../adapters/canonical/canonicalFillPayload";
import { FillType, type FillItem } from "../../../../types/builder/fill.types";
import { normalizeToHex8 } from "../utils/colorUtils";

const COLOR_STYLE_KEYS = ["backgroundColor", "color", "borderColor"] as const;
export const DOCUMENT_COLORS_MAX = 12;

type StyleLike = Record<string, unknown> | undefined | null;

function pushStyleColors(style: StyleLike, count: Map<string, number>): void {
  if (!style) return;
  for (const key of COLOR_STYLE_KEYS) {
    const raw = style[key];
    if (typeof raw !== "string" || raw.trim() === "") continue;
    if (
      raw.startsWith("var(") ||
      /^(inherit|initial|unset|transparent|currentcolor)$/i.test(raw)
    )
      continue;
    const hex = normalizeToHex8(raw, "");
    if (!hex) continue;
    count.set(hex, (count.get(hex) ?? 0) + 1);
  }
}

function pushFillColors(
  fills: readonly FillItem[] | undefined | null,
  count: Map<string, number>,
): void {
  if (!fills) return;
  for (const fill of fills) {
    if (fill.type !== FillType.Color || !fill.color) continue;
    const hex = normalizeToHex8(fill.color, "");
    if (!hex) continue;
    count.set(hex, (count.get(hex) ?? 0) + 1);
  }
}

/** 순수 수집기 — 테스트 · 훅 공용 */
export function collectDocumentColors(
  sources: Iterable<{ style?: StyleLike; fills?: readonly FillItem[] | null }>,
  max = DOCUMENT_COLORS_MAX,
): string[] {
  const count = new Map<string, number>();
  for (const source of sources) {
    pushStyleColors(source.style, count);
    pushFillColors(source.fills, count);
  }
  return Array.from(count.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([hex]) => hex);
}

export function useDocumentColors(): string[] {
  // 편집마다 배열 참조가 바뀐다 — 피커가 열려 있을 때만 mount 되는 컴포넌트라 비용은 열림 동안뿐
  const elements = useStore((state) => state.elements);
  return useMemo(() => {
    const doc = getActiveCanonicalDocument();
    if (doc) {
      const nodes = Array.from(getNodeMap().values());
      return collectDocumentColors(
        nodes.map((node) => ({
          style: (node.props as { style?: StyleLike } | undefined)?.style,
          fills: readCanonicalNodeFillPayload(node) as FillItem[] | undefined,
        })),
      );
    }
    return collectDocumentColors(
      elements.map((element) => ({
        style: element.props?.style as StyleLike,
        fills: element.fills,
      })),
    );
  }, [elements]);
}
