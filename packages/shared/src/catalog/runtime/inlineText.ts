/** CSS white-space phase I, before line-edge trimming by the inline layout engine. */
export function inlineTextContent(
  raw: string,
  whiteSpace: string | undefined,
): string {
  if (whiteSpace === "pre" || whiteSpace === "pre-wrap") return raw;
  if (whiteSpace === "pre-line")
    return raw.replace(/\r\n|\r/g, "\n").replace(/[ \t]+/g, " ");
  return raw
    .replace(/[ \t]*(?:\r\n|\r|\n)+[ \t]*/g, " ")
    .replace(/[ \t]+/g, " ");
}
