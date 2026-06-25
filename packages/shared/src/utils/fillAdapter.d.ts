import type { CSSProperties } from "react";
interface FillAdaptableElement {
    fills?: unknown[];
    props?: Record<string, unknown> & {
        style?: CSSProperties;
    };
}
export declare function fillsToCssBackgroundStyle(fills: unknown[] | null | undefined): Pick<CSSProperties, "backgroundColor" | "backgroundImage" | "backgroundSize">;
export declare function adaptStyleWithFills(style: CSSProperties | undefined, fills: unknown[] | null | undefined): CSSProperties | undefined;
export declare function adaptElementFillStyle<T extends FillAdaptableElement>(element: T): T;
export {};
//# sourceMappingURL=fillAdapter.d.ts.map