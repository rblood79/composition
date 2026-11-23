import { catalogNotificationBadgeDigits } from "@composition/rendering";

/**
 * Container variant props no binding accepts (2026-10-28): the resolver derives them from a node's
 * place (`catalogDerivedProps`), so a definition's conditional rule keyed on one turns on through
 * the derived props (`catalogDerivedConditionalVisual` · `catalogDerivedRestVisual`), never an
 * authored value. The definition validator accepts these condition keys without `accepts`.
 *
 * - `fieldButton`: a field's own Button — its size (S2 Button is a pill; a field button keeps its
 *   size's corner — `presence.ts` `catalogFieldButtonSize`).
 * - `pinnedEdge`: a pinned Table column's Column · Cell at the edge of its side — the line between
 *   the pinned columns and the rest (ADR-315 Phase 4).
 */
export const CATALOG_DERIVED_VARIANT_PROPS: ReadonlySet<string> = new Set([
  "fieldButton",
  "isEmpty",
  // (2026-11-14) a notification Badge's digits — `single` · `double` (`catalogNotificationBadgeDigits`).
  "notification",
  // (ADR-315 Phase 4) a pinned Column · Cell at its side's edge — `start` · `end` (`presence.ts`,
  //   from the column projection's `_pinnedEdge`).
  "pinnedEdge",
  // (ADR-315 Phase 6) a merged Table's body Row (`cells` — its line is its Cells') and each Cell's
  //   line (`bottom`; none under a merged cell) — `presence.ts`, from the column projection's
  //   `_cellLines` · `_cellLine`.
  "cellLines",
  "mergeLine",
  // (S2 체크리스트 §9.3) a Row in its Table's footer (the totals row) and its Cells — `true`
  //   (`presence.ts`, `catalogTableFooterPart`): S2 `TableFooter`'s row look.
  "inFooter",
]);

/** 저장하지 않는 RAC 상태를 part rule 조건과 증분 invalidation에서 동일하게 읽는다. */
export function catalogPartConditionProps<
  T extends Readonly<Record<string, unknown>>,
>(
  type: string,
  props: T,
): T & { isEmpty?: boolean; notification?: "single" | "double" } {
  if (type === "SearchField")
    return {
      ...props,
      isEmpty: String(props.value ?? props.defaultValue ?? "") === "",
    };
  // (2026-11-14) S2 NotificationBadge: one digit a square, more a pill — the DOM's
  //   `data-notification` (`Badge.tsx`), the same function.
  if (type === "Badge") {
    const notification = catalogNotificationBadgeDigits(props.value);
    return notification ? { ...props, notification } : props;
  }
  return props;
}
