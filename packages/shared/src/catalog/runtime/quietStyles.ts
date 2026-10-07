import type { ComponentRule } from "../../types/catalog-style.types";
import type { StateName } from "../document/types";

/** Read the part rule's root selectors, the same declarations emitted to its DOM sheet. */
export function catalogQuietStyles(
  rule: Readonly<ComponentRule>,
  props: Readonly<Record<string, unknown>>,
  state?: StateName,
): Readonly<Record<string, string>> | undefined {
  if (props.isQuiet !== true) return undefined;
  const selectors = rule.structure?.composition?.rootSelectors as
    Record<string, { styles?: Record<string, string> }> | undefined;
  if (!selectors?.["&[data-quiet]"]) return undefined;
  const active: Readonly<Record<string, boolean>> = {
    "data-quiet": true,
    "data-hovered": state === "hover" || state === "selectedHover",
    "data-focused": state === "focusVisible" || props.isFocused === true,
    "data-focus-within":
      state === "focusVisible" || props.isFocusWithin === true,
    "data-disabled":
      state === "disabled" ||
      props.isDisabled === true ||
      props._fieldDisabled === true,
    "data-invalid": props.isInvalid === true || props._fieldInvalid === true,
  };
  const result: Record<string, string> = {};
  for (const [selector, entry] of Object.entries(selectors)) {
    if (!selector.startsWith("&[data-quiet]")) continue;
    let matches = true;
    const rest = selector
      .slice(1)
      .replace(
        /:not\(\[([\w-]+)\]\)|\[([\w-]+)\]/g,
        (_, excluded: string, included: string) => {
          if ((excluded && active[excluded]) || (included && !active[included]))
            matches = false;
          return "";
        },
      );
    if (rest) throw new Error(`CATALOG_QUIET_SELECTOR_UNSUPPORTED:${selector}`);
    if (matches) Object.assign(result, entry.styles);
  }
  return result;
}
