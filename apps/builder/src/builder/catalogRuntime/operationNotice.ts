/**
 * Why a structural edit did nothing — the old `notifyOperationRejected` / `notifyIfRelocated`
 * toasts (`domain/canOperate.ts` · `canvasActions.ts`) over the catalog commands' refusals. A
 * shortcut, a menu or a palette insert whose command is refused tells the user the reason instead
 * of staying silent; an insert that landed in another ancestor says where (with undo).
 */
import { CatalogValidationError } from "../../../../../packages/shared/src/catalog/document/validation";
import {
  resolveNestingViolation,
  type NestingViolation,
} from "../../../../../packages/shared/src/catalog/nesting/nestingRules";
import { useToastStore } from "../stores/toast";
import {
  notifyNestingRejected,
  showNestingRelocatedToast,
} from "../workspace/canvas/interaction/nestingToast";

const REASON_KEY: Record<string, string> = {
  GROUP_PARENTS_DIFFER: "operation.groupParentsDiffer",
  UNGROUP_INSTANCE: "operation.ungroupInstance",
  TEMPLATE_ROOT_FIXED: "operation.templateAnchorLocked",
  REPLACEMENT_NOT_MOVABLE: "operation.templateAnchorLocked",
};

/**
 * The nesting violation behind a refusal (`fail("NESTING_NOT_ALLOWED", "Parent>Child")`),
 * re-resolved so the notice can tell a leaf parent from an owner rule.
 */
function nestingViolationOf(
  error: CatalogValidationError,
): NestingViolation | undefined {
  const at = error.message.split(":").at(-1)?.trim() ?? "";
  const [parentType, childType] = at.split(">");
  if (!parentType || !childType) return undefined;
  return (
    resolveNestingViolation({
      parentType,
      childType,
      ancestorTypes: [parentType],
    }) ?? {
      layer: "rac-composition",
      parentType,
      childType,
      reason: error.message,
    }
  );
}

/** Tell the user why a refused structural edit did nothing. */
export function notifyOperationRefused(error: unknown): void {
  if (error instanceof CatalogValidationError) {
    if (error.code === "NESTING_NOT_ALLOWED") {
      const violation = nestingViolationOf(error);
      if (violation) return notifyNestingRejected(violation);
    }
    const key = REASON_KEY[error.code];
    if (key) {
      useToastStore.getState().showToast("info", key, { messageKey: key });
      return;
    }
  }
  useToastStore.getState().showToast("info", "operation.notAllowed", {
    messageKey: "operation.notAllowed",
  });
}

/** The selection is page bodies only: the old `operation.bodyLocked` notice. */
export function notifyBodyLocked(): void {
  useToastStore.getState().showToast("info", "operation.bodyLocked", {
    messageKey: "operation.bodyLocked",
  });
}

/**
 * An insert that could not go where the user aimed went to the nearest ancestor that takes it:
 * say so, with undo (the insert is one step).
 */
export function notifyInsertRelocated(
  refusal: unknown,
  targetType: string,
  onUndo: () => void,
): void {
  const violation =
    refusal instanceof CatalogValidationError &&
    refusal.code === "NESTING_NOT_ALLOWED"
      ? nestingViolationOf(refusal)
      : undefined;
  if (violation) showNestingRelocatedToast(violation, targetType, onUndo);
}
