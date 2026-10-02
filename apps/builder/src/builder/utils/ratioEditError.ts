/** Why a size · position edit that keeps a ratio or tier geometry was refused (Styles panel). */
export type RatioEditError =
  | "selection-changed"
  | "target-missing"
  | "geometry-missing"
  | "tier-geometry-missing"
  | "document-changed";
