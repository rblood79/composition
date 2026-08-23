import type { SkiaNodeData } from "./nodeRendererTypes";

/**
 * Retained paragraph identity. Presentation text metrics are deliberately part
 * of this key: mutating a fixed Text target must rebuild only its paragraph,
 * while its rect and hit-test slot remain owned by the existing scene stream.
 */
export function getTextParagraphCacheKey(node: SkiaNodeData): string {
  if (!node.text) return "";
  const whiteSpace = node.text.whiteSpace ?? "normal";
  let processedText = node.text.content;
  if (whiteSpace === "normal" || whiteSpace === "pre-line") {
    processedText = processedText.replace(/[ \t]+/g, " ");
  }
  const layoutMaxWidth =
    whiteSpace === "nowrap" || whiteSpace === "pre"
      ? 100000
      : node.text.maxWidth;
  const wordBreak = node.text.wordBreak ?? "normal";
  const overflowWrap = node.text.overflowWrap ?? "normal";
  const color = node.text.color;
  const colorKey = `${color[0].toFixed(3)},${color[1].toFixed(3)},${color[2].toFixed(3)},${color[3].toFixed(3)}`;
  const heightMultiplier = node.text.lineHeight
    ? node.text.lineHeight / node.text.fontSize
    : 0;
  const textIndent = node.text.textIndent ?? 0;
  const isEllipsis =
    node.text.textOverflow === "ellipsis" &&
    whiteSpace === "nowrap" &&
    !!node.text.clipText;
  const dc = node.text.decorationColor;
  const decorationColorKey = dc
    ? `${dc[0].toFixed(3)},${dc[1].toFixed(3)},${dc[2].toFixed(3)},${dc[3].toFixed(3)}`
    : "";
  return [
    processedText,
    layoutMaxWidth,
    node.text.fontFamilies.join("|"),
    node.text.fontSize,
    node.text.fontWeight ?? 400,
    node.text.fontStyle ?? 0,
    node.text.fontVariant ?? "normal",
    node.text.fontStretch ?? "normal",
    node.text.letterSpacing ?? 0,
    node.text.wordSpacing ?? 0,
    heightMultiplier,
    typeof node.text.align === "string" ? node.text.align : "enum",
    node.text.decoration ?? 0,
    node.text.decorationStyle ?? "solid",
    decorationColorKey,
    colorKey,
    whiteSpace,
    wordBreak,
    overflowWrap,
    isEllipsis ? node.text.maxWidth : "0",
    textIndent,
  ].join("\u0000");
}
