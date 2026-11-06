/** Glyph font matching uses the text language, including on a detached measurement canvas. */
export function applyCanvasTextLocale(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  locale: string | undefined,
): void {
  if ("lang" in context)
    (context as typeof context & { lang: string }).lang = locale ?? "inherit";
  if (context.canvas && "lang" in context.canvas)
    context.canvas.lang = locale ?? "";
}
