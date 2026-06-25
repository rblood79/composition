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
 * Normalize legacy Card variant values to S2 naming
 * Handles backward compatibility for existing project data
 */
export function normalizeCardVariant(variant) {
    const LEGACY_MAP = {
        default: "primary",
        filled: "primary",
        outlined: "secondary",
        elevated: "tertiary",
    };
    return LEGACY_MAP[variant ?? ""] ?? variant ?? "primary";
}
// ============================================================================
// Type Guards
// ============================================================================
/**
 * Type guard to check if a size is a valid ComponentSize
 */
export function isComponentSize(value) {
    return (typeof value === "string" && ["xs", "sm", "md", "lg", "xl"].includes(value));
}
//# sourceMappingURL=componentVariants.types.js.map