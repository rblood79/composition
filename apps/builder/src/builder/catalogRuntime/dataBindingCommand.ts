import { setWholeField } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  DataBindingRef,
  EditTarget,
} from "../../../../../packages/shared/src/catalog/document/types";

/**
 * ADR-248 Phase 4e-4e: the binding write (`dataBinding` holds the reference conversions the
 * Preview also reads; the command module stays out of the Preview's boot set — G5 bundle gate).
 */

/** Set (or with `undefined` clear) the targets' binding — one step. */
export const catalogBindingCommand = (
  targets: readonly EditTarget[],
  binding: DataBindingRef | undefined,
): CatalogCommand =>
  setWholeField({
    targets,
    field: "binding",
    value: binding,
    label: binding ? "Bind data" : "Unbind data",
  });
