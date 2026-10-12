import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import type { ComponentRule } from "../../types/catalog-style.types";
import type { StateName } from "../document/types";

/**
 * The quiet paint of a quiet field's box part, the same declarations its DOM sheet applies:
 * the part rule's root selectors (`&[data-quiet]` — an Input / DateInput instance), else, for a
 * box the field's own rule styles (`_quietOwner` — a Select's trigger Button), that rule's `quiet.true.nested` blocks for the box (`.react-aria-Select[data-quiet="true"]
 * .react-aria-Button`). Undefined when the part is not quiet.
 */
export function catalogQuietStyles(
  rule: Readonly<ComponentRule> | undefined,
  props: Readonly<Record<string, unknown>>,
  state?: StateName,
): Readonly<Record<string, string>> | undefined {
  if (props.isQuiet !== true) return undefined;
  const active: Readonly<Record<string, boolean>> = {
    "data-quiet": true,
    "data-hovered": state === "hover" || state === "selectedHover",
    "data-pressed": state === "pressed",
    "data-focus-visible": state === "focusVisible",
    "data-focused": state === "focusVisible" || props.isFocused === true,
    "data-focus-within":
      state === "focusVisible" || props.isFocusWithin === true,
    "data-disabled":
      state === "disabled" ||
      props.isDisabled === true ||
      props._fieldDisabled === true,
    "data-invalid": props.isInvalid === true || props._fieldInvalid === true,
  };
  // `[x]` / `:not([x], …)` / `:is([x], …)` conditions after `prefix`, all of them true now
  // (`:not` — none of its list; `:is` — one of it: the box's focus is `data-focused` or, for a
  // prefix box, `data-focus-within` — ADR-259).
  const list = (inner: string) =>
    inner.split(",").map((item) => /^\s*\[([\w-]+)\]\s*$/.exec(item)?.[1]);
  const matches = (selector: string, prefix: string) => {
    let ok = true;
    let unsupported = false;
    const rest = selector
      .slice(prefix.length)
      .replace(
        /:(not|is)\(([^)]*)\)|\[([\w-]+)\]/g,
        (_, pseudo: string, inner: string, included: string) => {
          if (included) {
            if (!active[included]) ok = false;
            return "";
          }
          const names = list(inner);
          if (names.some((name) => !name)) unsupported = true;
          const any = names.some((name) => name && active[name]);
          if (pseudo === "not" ? any : !any) ok = false;
          return "";
        },
      );
    if (unsupported)
      throw new Error(`CATALOG_QUIET_SELECTOR_UNSUPPORTED:${selector}`);
    if (rest) throw new Error(`CATALOG_QUIET_SELECTOR_UNSUPPORTED:${selector}`);
    return ok;
  };
  const result: Record<string, string> = {};
  const selectors = rule?.structure?.composition?.rootSelectors as
    Record<string, { styles?: Record<string, string> }> | undefined;
  if (selectors?.["&[data-quiet]"]) {
    for (const [selector, entry] of Object.entries(selectors))
      if (selector.startsWith("&[data-quiet]") && matches(selector, "&"))
        Object.assign(result, entry.styles);
    return result;
  }
  const owner =
    typeof props._quietOwner === "string" ? props._quietOwner : undefined;
  const box = owner ? QUIET_OWNER_BOX_TOKENS[owner] : undefined;
  if (!owner || !box) return undefined;
  const nested = (
    (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[owner]?.structure
      ?.composition as
      | {
          containerVariants?: {
            quiet?: {
              true?: {
                nested?: Array<{
                  selector: string;
                  styles: Record<string, string>;
                }>;
              };
            };
          };
        }
      | undefined
  )?.containerVariants?.quiet?.true?.nested;
  if (!nested?.length) return undefined;
  for (const entry of nested)
    if (entry.selector.startsWith(box) && matches(entry.selector, box))
      Object.assign(result, entry.styles);
  return result;
}

/** The DOM token of the box a field's own rule styles when quiet (`ownerStyledQuietBox`). */
const QUIET_OWNER_BOX_TOKENS: Readonly<Record<string, string>> = {
  Select: ".react-aria-Button",
};

/**
 * The border color an invalid field's box takes outside quiet (the box rule's `&[data-invalid]`
 * root selector — `--negative`): its own `isInvalid`, or its field's (`_fieldInvalid`). Undefined
 * when the box is valid, quiet (`catalogQuietStyles` has its own invalid underline) or its rule
 * declares none.
 */
export function catalogInvalidBorderColor(
  rule: Readonly<ComponentRule> | undefined,
  props: Readonly<Record<string, unknown>>,
): string | undefined {
  if (props.isQuiet === true) return undefined;
  if (props.isInvalid !== true && props._fieldInvalid !== true) return undefined;
  const selectors = rule?.structure?.composition?.rootSelectors as
    Record<string, { styles?: Record<string, string> }> | undefined;
  return selectors?.["&[data-invalid]"]?.styles?.["border-color"];
}
