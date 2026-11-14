import { catalogNotificationBadgeDigits } from "@composition/rendering";

/**
 * Container variant props no binding accepts (2026-10-28): the resolver derives them from a node's
 * place (`catalogDerivedProps`), so a definition's conditional rule keyed on one turns on through
 * the derived props (`catalogDerivedConditionalVisual` · `catalogDerivedRestVisual`), never an
 * authored value. The definition validator accepts these condition keys without `accepts`.
 *
 * - `fieldButton`: a field's own Button — its size (S2 Button is a pill; a field button keeps its
 *   size's corner — `presence.ts` `catalogFieldButtonSize`).
 */
export const CATALOG_DERIVED_VARIANT_PROPS: ReadonlySet<string> = new Set([
  "fieldButton",
  "isEmpty",
  // (2026-11-14) a notification Badge's digits — `single` · `double` (`catalogNotificationBadgeDigits`).
  "notification",
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
