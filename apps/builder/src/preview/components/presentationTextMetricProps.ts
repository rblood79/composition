import type { EditorMutationDescriptor } from "../../builder/presentation/editorPresentationTypes";
import {
  isFixedTextMetricStyle,
  parsePresentationFontSize,
  parsePresentationFontWeight,
} from "../../builder/presentation/editorPresentationTextMetricValue";

export function resolvePresentationTextMetricProps(
  base: Record<string, unknown>,
  mutations: readonly EditorMutationDescriptor[] | undefined,
  nodeType: string,
  hasChildren = false,
): Record<string, unknown> {
  if (nodeType !== "Text" || hasChildren) return base;
  const baseStyle = base.style;
  if (!baseStyle || typeof baseStyle !== "object") return base;
  const style = baseStyle as Record<string, unknown>;
  if (!isFixedTextMetricStyle(style)) return base;

  let nextStyle = style;
  for (const mutation of mutations ?? []) {
    if (mutation.type !== "style.patch") continue;
    const patch = mutation.patch;
    const keys = Object.keys(patch);
    if (keys.length !== 1) continue;
    if (keys[0] === "fontSize") {
      const fontSize = parsePresentationFontSize(patch.fontSize);
      if (fontSize === null) continue;
      nextStyle = { ...nextStyle, fontSize: `${fontSize}px` };
      continue;
    }
    if (keys[0] === "fontWeight") {
      if (parsePresentationFontWeight(style.fontWeight) === null) continue;
      const fontWeight = parsePresentationFontWeight(patch.fontWeight);
      if (fontWeight === null) continue;
      nextStyle = { ...nextStyle, fontWeight };
    }
  }
  if (nextStyle === style) return base;
  return { ...base, style: nextStyle };
}
