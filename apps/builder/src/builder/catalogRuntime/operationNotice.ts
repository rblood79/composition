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
import { CatalogOriginEditError } from "./originView";
import {
  notifyNestingRejected,
  showNestingRelocatedToast,
} from "../workspace/canvas/interaction/nestingToast";

const REASON_KEY: Record<string, string> = {
  UNGROUP_INSTANCE: "operation.ungroupInstance",
  // An origin's own root (Local page · Layout page · an unlocked Library ◆ — ADR-282).
  TEMPLATE_ROOT_FIXED: "operation.originRootFixed",
  REPLACEMENT_NOT_MOVABLE: "operation.templateAnchorLocked",
  // ADR-256 Decision 5: a part RAC needs for its owner (a Select's trigger Button …).
  REQUIRED_PART_NOT_REMOVABLE: "operation.requiredPartKept",
  // ADR-256 Phase 5i-3: a Table row keeps one cell per column (RAC).
  TABLE_CELLS_NOT_ALIGNED: "operation.tableCellsAligned",
  // ADR-288: a variable's new name is taken where it is visible, or would capture a `{{ name }}`.
  VARIABLE_NAME_CONFLICT: "operation.variableNameConflict",
  VARIABLE_NAME_SHADOWS: "operation.variableNameShadows",
  // ADR-310 Phase 1: an item's key (`id` · a group Radio's `value`) is one per collection.
  ITEM_KEY_TAKEN: "operation.itemKeyTaken",
  // ADR-324: 「모아서 저장」 and the rules · connections it cannot have.
  IMMEDIATE_SAVE_RULE: "operation.immediateSaveRule",
  SAVE_NOT_ENABLED: "operation.saveNotEnabled",
  SAVE_KEY_FIELD_REQUIRED: "operation.saveKeyFieldRequired",
  SAVE_BATCH_IF_MATCH: "operation.saveBatchIfMatch",
  SAVE_ENDPOINT_METHOD: "operation.saveEndpointMethod",
  // (Rows' sending with every connection 「None」 · a version field the schema lost.)
  SAVE_CONNECTION_REQUIRED: "operation.saveConnectionRequired",
  SAVE_VERSION_FIELD_MISSING: "operation.saveVersionFieldMissing",
  // ADR-320: a filter bar's lists (a paste · an AI edit can name them).
  FILTER_TARGETS_HOST: "operation.filterTargetsHost",
  FILTER_TARGET_SELF: "operation.filterTargetSelf",
  FILTER_TARGET_TAKEN: "operation.filterTargetTaken",
  FILTER_TARGET_COLLECTION: "operation.filterTargetCollection",
};

/**
 * A refused command with a known reason (a rule the edit met — not a failure): tell why and
 * return true; anything else returns false for the caller's own report.
 */
export function notifyKnownRefusal(error: unknown): boolean {
  if (!(error instanceof CatalogValidationError)) return false;
  const key = REASON_KEY[error.code];
  if (!key) return false;
  useToastStore.getState().showToast("info", key, { messageKey: key });
  return true;
}

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

const ORIGIN_EDIT_KEY: Record<CatalogOriginEditError["code"], string> = {
  ORIGIN_ROOT_ONLY: "operation.originRootOnly",
  // ADR-282: the Library page's lock is on.
  LIBRARY_LOCKED: "operation.libraryLocked",
};

/**
 * An edit the Components page refuses (a locked Library, a sample's structure) is the user's
 * action meeting a rule, not a failure: tell why and return true; other errors return false.
 */
export function notifyEditRefusal(error: unknown): boolean {
  if (!(error instanceof CatalogOriginEditError)) return false;
  const key = ORIGIN_EDIT_KEY[error.code];
  useToastStore.getState().showToast("info", key, { messageKey: key });
  return true;
}

/** Tell the user why a refused structural edit did nothing. */
export function notifyOperationRefused(error: unknown): void {
  if (notifyEditRefusal(error)) return;
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

/** ADR-306 — a Chart family's chunk did not load, so the new chart was not inserted. */
export function notifyChartFamilyLoadFailed(error: unknown): void {
  if (process.env.NODE_ENV === "development") console.warn(error);
  useToastStore.getState().showToast("error", "chart.familyLoadFailed", {
    messageKey: "chart.familyLoadFailed",
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
