import type { SkiaNodeData } from "./nodeRendererTypes";
import { collapseTextWhiteSpace } from "../utils/textWhiteSpace";

/** A fitting line keeps its full glyphs, even when SkParagraph rounds its layout width down. */
export function textNeedsEllipsis(node: Pick<SkiaNodeData, "text">): boolean {
  const text = node.text;
  return (
    !!text &&
    text.textOverflow === "ellipsis" &&
    text.whiteSpace === "nowrap" &&
    !!text.clipText &&
    (text.intrinsicWidth === undefined ||
      Math.fround(text.intrinsicWidth) > Math.fround(text.maxWidth))
  );
}

/**
 * Retained paragraph identity. Presentation text metrics are deliberately part
 * of this key: mutating a fixed Text target must rebuild only its paragraph,
 * while its rect and hit-test slot remain owned by the existing scene stream.
 */
export function getTextParagraphCacheKey(
  node: SkiaNodeData,
  /** 호출부가 이미 접은 텍스트 — renderText 는 같은 content 를 두 번 접지 않는다 */
  processedText: string = collapseTextWhiteSpace(
    node.text?.content ?? "",
    node.text?.whiteSpace ?? "normal",
  ),
): string {
  if (!node.text) return "";
  const whiteSpace = node.text.whiteSpace ?? "normal";
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
  const isEllipsis = textNeedsEllipsis(node);
  const dc = node.text.decorationColor;
  const decorationColorKey = dc
    ? `${dc[0].toFixed(3)},${dc[1].toFixed(3)},${dc[2].toFixed(3)},${dc[3].toFixed(3)}`
    : "";
  return [
    processedText,
    layoutMaxWidth,
    node.text.fontFamilies.join("|"),
    node.text.locale ?? "",
    node.text.fontSize,
    node.text.fontWeight ?? 400,
    node.text.fontStyle ?? 0,
    node.text.fontVariant ?? "normal",
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
    // ADR-299 — a range-formatted text's runs and its ancestor decoration (absent: "").
    node.text.runs ? runsKey(node.text) : "",
  ].join("\u0000");
}

const colorKey = (color: Float32Array | undefined) =>
  color
    ? `${color[0]!.toFixed(3)},${color[1]!.toFixed(3)},${color[2]!.toFixed(3)},${color[3]!.toFixed(3)}`
    : "";

function runsKey(text: NonNullable<SkiaNodeData["text"]>): string {
  const runs = (text.runs ?? [])
    .map(
      (run) =>
        `${run.start}-${run.end}:${run.fontWeight ?? ""}:${run.fontStyle ?? ""}:${run.fontSize ?? ""}:${colorKey(run.color)}:${run.decoration ?? ""}`,
    )
    .join(";");
  const ancestor = text.ancestorDecoration;
  return ancestor
    ? `${runs}|${ancestor.decoration}:${colorKey(ancestor.color)}:${ancestor.fontSize ?? ""}`
    : runs;
}
