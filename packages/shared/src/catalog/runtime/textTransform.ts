/** CSS `text-transform` applied to a string (the Canvas and the layout text input read the same rule). */
export function applyTextTransform(
  text: string,
  transform: string | undefined,
): string {
  if (!transform || transform === "none") return text;

  switch (transform.toLowerCase()) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return text;
  }
}
