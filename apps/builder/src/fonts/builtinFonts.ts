import { SPECTRUM_SANS_FONT_CSS } from "@composition/rendering";

const BUILTIN_FONT_STYLE_ID = "composition-builtin-fonts";

export function resolveFontUrl(path: string): string {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}

function buildBuiltinFontCss(): string {
  const pretendardUrl = resolveFontUrl("fonts/PretendardVariable.woff2");
  const interUrl = resolveFontUrl("fonts/InterVariable.woff2");

  return `
    ${SPECTRUM_SANS_FONT_CSS}
    @font-face {
      font-family: "Pretendard";
      src: url("${pretendardUrl}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }

    @font-face {
      font-family: "Inter";
      src: url("${interUrl}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }

    @font-face {
      font-family: "Inter Variable";
      src: url("${interUrl}") format("woff2");
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
    }
  `;
}

export function injectBuiltinFontStyle(targetDoc: Document = document): void {
  const existing = targetDoc.getElementById(BUILTIN_FONT_STYLE_ID);
  const css = buildBuiltinFontCss();

  if (existing) {
    existing.textContent = css;
    return;
  }

  const styleEl = targetDoc.createElement("style");
  styleEl.id = BUILTIN_FONT_STYLE_ID;
  styleEl.textContent = css;
  targetDoc.head.appendChild(styleEl);
}
