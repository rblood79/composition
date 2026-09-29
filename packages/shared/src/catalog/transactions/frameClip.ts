import type { CatalogOperation } from "./transaction";
import type { NodeId } from "../document/types";
import { CatalogValidationError } from "../document/validation";

/** Public authoring input normalization; graph stores overflow only. */
export function frameClipInputToOperation(
  id: NodeId,
  input: {
    clip?: boolean;
    overflow?: "visible" | "hidden" | "clip" | "auto" | "scroll";
  },
): CatalogOperation {
  const normalized =
    input.clip === undefined
      ? input.overflow
      : input.clip
        ? "hidden"
        : "visible";
  if (!normalized)
    throw new CatalogValidationError("FRAME_OVERFLOW_REQUIRED", id);
  if (input.overflow !== undefined && input.overflow !== normalized)
    throw new CatalogValidationError("FRAME_CLIP_OVERFLOW_CONFLICT", id);
  return {
    kind: "patchNodeVisual",
    id,
    key: "overflow",
    write: { kind: "set", value: normalized },
  };
}

/** Matches the old search surface without persisting a second clip field. */
export function isResolvedFrameClipped(overflow: string | undefined): boolean {
  return (
    overflow === "hidden" ||
    overflow === "clip" ||
    overflow === "auto" ||
    overflow === "scroll"
  );
}
