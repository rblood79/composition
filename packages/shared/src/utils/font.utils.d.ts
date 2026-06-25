export interface CustomFontAsset {
    id: string;
    family: string;
    source: string;
    format?: "woff2" | "woff" | "truetype" | "opentype" | "embedded-opentype" | "svg";
}
export declare const CUSTOM_FONT_STORAGE_KEY = "composition.custom-fonts";
export declare function inferFontFormatFromName(fileName: string): CustomFontAsset["format"];
export declare function stripExtension(fileName: string): string;
export declare function buildCustomFontFaceCss(fonts: CustomFontAsset[]): string;
//# sourceMappingURL=font.utils.d.ts.map