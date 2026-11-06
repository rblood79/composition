/** S2 1.8.2 font-faces.css의 기본 sans. DOM과 Canvas가 같은 face를 읽는다. */
import { SPECTRUM_LOCALE_FONT_CSS } from "./spectrumLocaleFonts";
export const SPECTRUM_SANS_FAMILY = "adobe-clean-spectrum-vf";
export const SPECTRUM_SANS_STACK =
  "adobe-clean-spectrum-vf, adobe-clean-variable, adobe-clean, ui-sans-serif, system-ui, sans-serif";
export const SPECTRUM_SANS_FONT = {
  family: SPECTRUM_SANS_FAMILY,
  browserUrl:
    "https://use.typekit.net/af/ca4cba/0000000000000000775c55a1/31/l?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=n1&v=3",
  url: "https://use.typekit.net/af/ca4cba/0000000000000000775c55a1/31/a?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=n1&v=3",
} as const;

export const SPECTRUM_SERIF_FAMILY = "adobe-clean-spectrum-srf-vf";
export const SPECTRUM_CODE_FAMILY = "source-code-pro";
export const SPECTRUM_SERIF_STACK =
  'adobe-clean-spectrum-srf-vf, adobe-clean-serif, "Source Serif", Georgia, serif';
export const SPECTRUM_CODE_STACK =
  'source-code-pro, "Source Code Pro", Monaco, monospace';

export interface SpectrumFontFace {
  family: string;
  style: string;
  weight: string;
  keyWeight: string;
  browserUrl: string;
  url: string;
}

export const SPECTRUM_FONT_FACES: readonly SpectrumFontFace[] = [
  {
    ...SPECTRUM_SANS_FONT,
    style: "normal",
    weight: "100 900",
    keyWeight: "400",
  },
  {
    family: "adobe-clean-spectrum-srf-vf",
    style: "normal",
    weight: "100 1000",
    keyWeight: "400",
    browserUrl:
      "https://use.typekit.net/af/4a1d0d/0000000000000000775c55a4/31/l?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=n1&v=3",
    url: "https://use.typekit.net/af/4a1d0d/0000000000000000775c55a4/31/a?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=n1&v=3",
  },
  {
    family: "adobe-clean-spectrum-vf",
    style: "italic",
    weight: "100 900",
    keyWeight: "400",
    browserUrl:
      "https://use.typekit.net/af/8a3244/0000000000000000775c55a2/31/l?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=i1&v=3",
    url: "https://use.typekit.net/af/8a3244/0000000000000000775c55a2/31/a?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=i1&v=3",
  },
  {
    family: "adobe-clean-spectrum-srf-vf",
    style: "italic",
    weight: "100 1000",
    keyWeight: "400",
    browserUrl:
      "https://use.typekit.net/af/45f67c/0000000000000000775c55a3/31/l?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=i1&v=3",
    url: "https://use.typekit.net/af/45f67c/0000000000000000775c55a3/31/a?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=i1&v=3",
  },
  {
    family: "source-code-pro",
    style: "normal",
    weight: "700",
    keyWeight: "700",
    browserUrl:
      "https://use.typekit.net/af/88da4d/00000000000000007758ce1a/31/l?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=n7&v=3",
    url: "https://use.typekit.net/af/88da4d/00000000000000007758ce1a/31/a?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=n7&v=3",
  },
  {
    family: "source-code-pro",
    style: "normal",
    weight: "400",
    keyWeight: "400",
    browserUrl:
      "https://use.typekit.net/af/80f457/00000000000000007758ce1d/31/l?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=n4&v=3",
    url: "https://use.typekit.net/af/80f457/00000000000000007758ce1d/31/a?primer=f592e0a4b9356877842506ce344308576437e4f677d7c9b78ca2162e6cad991a&fvd=n4&v=3",
  },
];

export const SPECTRUM_SANS_FONT_CSS = `
:root { --catalog-default-font-family: ${SPECTRUM_SANS_STACK}; }
${SPECTRUM_LOCALE_FONT_CSS}
${SPECTRUM_FONT_FACES.map(
  (face) => `@font-face {
  font-family: "${face.family}";
  src: url("${face.browserUrl}") format("woff2");
  font-style: ${face.style};
  font-weight: ${face.weight};
  font-display: auto;
}`,
).join("\n")}`;

/** S2가 제공하는 face 중 현재 글꼴 요청에 필요한 것만 고른다. */
export function spectrumFontFacesFor(
  familyList: string,
  weight = 400,
  style = "normal",
): readonly SpectrumFontFace[] {
  const families = familyList
    .split(",")
    .map((f) => f.trim().replace(/^["']|["']$/g, ""));
  return SPECTRUM_FONT_FACES.filter(
    (face) =>
      families.includes(face.family) &&
      face.style === (style === "oblique" ? "italic" : style) &&
      (face.family !== SPECTRUM_CODE_FAMILY ||
        face.keyWeight === (weight > 500 ? "700" : "400")),
  );
}

/** CSS normal=100%。Adobe face의 fvar 기본 wdth=62.5를 그대로 쓰면 Canvas만 좁아진다. */
export function spectrumFontVariations(
  families: readonly string[],
  weight: number,
  width = 100,
): { axis: string; value: number }[] {
  return [
    { axis: "wght", value: weight },
    ...(families.includes(SPECTRUM_SANS_FAMILY)
      ? [{ axis: "wdth", value: width }]
      : []),
  ];
}
