/** S2 1.8.2 Fonts.tsx + spectrum-theme.ts의 locale별 기본 서체. */
const CJK = {
  ja: {
    family: "adobe-clean-han-japanese",
    kit: "pyb4hbv",
    stack:
      "adobe-clean-han-japanese, 'Hiragino Kaku Gothic ProN', 'ヒラギノ角ゴ ProN W3', Osaka, YuGothic, 'Yu Gothic', 'メイリオ', Meiryo, 'ＭＳ Ｐゴシック', 'MS PGothic', sans-serif",
  },
  ko: {
    family: "adobe-clean-han-korean",
    kit: "pux4zom",
    stack:
      "adobe-clean-han-korean, source-han-korean, 'Malgun Gothic', 'Apple Gothic', sans-serif",
  },
  zh: {
    family: "adobe-clean-han-traditional",
    kit: "twr1oiz",
    stack:
      "adobe-clean-han-traditional, source-han-traditional, 'MingLiu', 'Heiti TC Light', sans-serif",
  },
  "zh-Hant": {
    family: "adobe-clean-han-traditional",
    kit: "twr1oiz",
    stack:
      "adobe-clean-han-traditional, source-han-traditional, 'MingLiu', 'Microsoft JhengHei UI', 'Microsoft JhengHei', 'Heiti TC Light', sans-serif",
  },
  "zh-HK": {
    family: "adobe-clean-han-hong-kong",
    kit: "wrf0dsa",
    stack:
      "adobe-clean-han-hong-kong, source-han-hong-kong, 'MingLiu', 'Microsoft JhengHei UI', 'Microsoft JhengHei', 'Heiti TC Light', sans-serif",
  },
  "zh-Hans": {
    family: "adobe-clean-han-simplified-c",
    kit: "qwy0qqd",
    stack:
      "adobe-clean-han-simplified-c, source-han-simplified-c, 'SimSun', 'Heiti SC Light', sans-serif",
  },
} as const;

export function spectrumLocaleFont(locale: string | undefined) {
  if (!locale) return undefined;
  try {
    const value = new Intl.Locale(locale);
    const tag = value.baseName;
    if (value.language === "ja" || value.language === "ko")
      return CJK[value.language];
    if (value.language !== "zh") return undefined;
    if (value.region === "HK") return CJK["zh-HK"];
    if (
      value.script === "Hans" ||
      value.region === "CN" ||
      value.region === "SG"
    )
      return CJK["zh-Hans"];
    if (tag.toLowerCase().startsWith("zh-hant")) return CJK["zh-Hant"];
    return CJK.zh;
  } catch {
    return undefined;
  }
}

export const SPECTRUM_LOCALE_FONT_CSS = (
  [
    ["ja", CJK.ja],
    ["ko", CJK.ko],
    ["zh", CJK.zh],
    ["zh-Hant", CJK["zh-Hant"]],
    ["zh-HK", CJK["zh-HK"]],
    ["zh-Hans, zh-CN, zh-SG", CJK["zh-Hans"]],
  ] as const
)
  .map(
    ([lang, font]) =>
      `:root:lang(${lang}) { --catalog-default-font-family: ${font.stack}; }`,
  )
  .join("\n");
