/**
 * Component Variant & Size Type Definitions
 *
 * Shared type definitions for Spectrum 2 (S2) component variants and sizes
 * to ensure consistency across the component library.
 *
 * @since 2025-01-02
 * @updated 2026-03-05 — S2 체계로 전환 (M3 타입 제거)
 */
/**
 * Full size scale for components
 * Used by: Button, and potentially other interactive components
 */
export type ComponentSize = "xs" | "sm" | "md" | "lg" | "xl";
/**
 * Subset of sizes (3 options)
 * Used by: Separator, and components with limited size variations
 */
export type ComponentSizeSubset = "sm" | "md" | "lg";
/**
 * Density-based sizing for layouts
 * Used by: Tables, Lists, and layout components
 */
export type DensitySize = "compact" | "comfortable" | "relaxed" | "spacious";
/**
 * Button visual variants (S2)
 * Used by: Button component
 *
 * - accent: 주요 call-to-action (S2 highlight-background 토큰)
 * - primary: 기본 액션 (S2 neutral 토큰)
 * - secondary: 보조 액션 (S2 neutral-subtle 토큰)
 * - negative: 파괴적 액션 (S2 negative 토큰)
 */
export type ButtonVariant = "accent" | "primary" | "secondary" | "negative" | "premium" | "genai" | "ghost";
/**
 * Button fill style (S2)
 * Used by: Button component
 *
 * - fill: 채워진 배경
 * - outline: 테두리만 표시
 */
export type ButtonFillStyle = "fill" | "outline";
/**
 * Badge visual variants (S2)
 * Used by: Badge component
 *
 * Semantic: accent, informative, neutral, positive, notice, negative
 * Named color: gray, red, orange, yellow, green, blue, purple, indigo, cyan, pink, turquoise, fuchsia, magenta
 */
export type BadgeVariant = "accent" | "informative" | "neutral" | "positive" | "notice" | "negative" | "gray" | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "indigo" | "cyan" | "pink" | "turquoise" | "fuchsia" | "magenta";
/**
 * Badge fill style (S2)
 * Used by: Badge component
 *
 * - bold: 진한 채움
 * - subtle: 연한 채움
 * - outline: 테두리만
 */
export type BadgeFillStyle = "bold" | "subtle" | "outline";
/**
 * Link visual variants (S2)
 * Used by: Link component
 *
 * - primary: 기본 링크 색상
 * - secondary: 보조 링크 색상
 */
export type LinkVariant = "primary" | "secondary";
/**
 * Meter visual variants (S2)
 * Used by: Meter component
 *
 * - informative: 정보 상태 (기본)
 * - positive: 성공/좋은 상태
 * - notice: 주의 상태
 * - negative: 오류/위험 상태
 */
export type MeterVariant = "informative" | "positive" | "warning" | "critical";
/**
 * Static color for components that need fixed colors regardless of theme (S2)
 * Used by: Button, Link, and other components with staticColor prop
 *
 * - auto: 테마에 따라 자동 결정
 * - black: 항상 검정
 * - white: 항상 흰색
 */
export type StaticColor = "auto" | "black" | "white";
/**
 * Tabs density (S2)
 * Used by: Tabs component
 *
 * - compact: 좁은 간격
 * - regular: 기본 간격
 */
export type TabsDensity = "compact" | "regular";
/**
 * Card visual variants (S2)
 * Used by: Card component
 *
 * - primary: 기본 카드 (배경 + 미니멀 border)
 * - secondary: 테두리 강조 카드
 * - tertiary: 흰색 배경 + 그림자로 높이감 표현
 * - quiet: 투명 배경
 */
export type CardVariant = "primary" | "secondary" | "tertiary" | "quiet";
/**
 * Normalize legacy Card variant values to S2 naming
 * Handles backward compatibility for existing project data
 */
export declare function normalizeCardVariant(variant?: string): CardVariant;
/**
 * Separator visual variants
 * Used by: Separator component (composition 고유)
 */
export type SeparatorVariant = "default" | "solid" | "dashed" | "dotted";
/**
 * Table Header visual variants
 * Used by: TableHeader component (composition 고유)
 */
export type TableHeaderVariant = "default" | "primary" | "secondary";
/**
 * Table Body visual variants
 * Used by: TableBody component (composition 고유)
 */
export type TableBodyVariant = "default" | "striped";
/**
 * Props for components with size support
 */
export interface ComponentSizeProps {
    size?: ComponentSize;
}
/**
 * Props interface for components with variant and size
 * Generic interface that can be extended by components
 */
export interface VariantSizeProps<V = string, S = ComponentSize> {
    /**
     * Visual variant of the component
     * @default "default"
     */
    variant?: V;
    /**
     * Size of the component
     * @default "sm"
     */
    size?: S;
}
/**
 * Type guard to check if a size is a valid ComponentSize
 */
export declare function isComponentSize(value: unknown): value is ComponentSize;
/**
 * Generic component variant union (S2)
 * Used by: CommonComponentProps — covers all S2 component variant sets
 */
export type ComponentVariant = ButtonVariant | BadgeVariant | MeterVariant | LinkVariant | CardVariant;
//# sourceMappingURL=componentVariants.types.d.ts.map