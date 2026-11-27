import {
  createContext,
  createElement,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { useField } from "react-aria";
import { useMenuTrigger } from "react-aria/useMenu";
import { useOverlayTrigger } from "react-aria/useOverlayTrigger";
import { ButtonContext } from "react-aria-components/Button";
import {
  DialogContext,
  OverlayTriggerStateContext,
} from "react-aria-components/Dialog";
import { FieldErrorContext } from "react-aria-components/FieldError";
import { LabelContext } from "react-aria-components/Label";
import {
  MenuContext,
  RootMenuTriggerStateContext,
} from "react-aria-components/Menu";
import { PopoverContext } from "react-aria-components/Popover";
import { TextContext } from "react-aria-components/Text";
import { useMenuTriggerState } from "react-stately/useMenuTriggerState";
import {
  CASCADER_DEFAULT_SEPARATOR,
  cascaderValueMatch,
  cascaderValueText,
  type CascaderTable,
} from "./cascader";

/**
 * ADR-322 — a Cascader's field (breakdown §3 · §4.5). No RAC picker owns its parts (Select's part
 * origins — Label · Button(SelectValue + Icon) · Description · FieldError), so the field gives them
 * the contexts RAC would: the ids from react-aria `useField` reach the Label (`LabelContext`), the
 * help and error text (`TextContext` slots · `FieldErrorContext`); the open Button takes RAC
 * `MenuTrigger`'s trigger (react-aria `useMenuTrigger` + `useMenuTriggerState` — its props through
 * `ButtonContext`, as RAC Select passes its trigger's: the label row's help button keeps its own
 * press, `slot={null}`). The open content (`columns` — Phase 2) takes `MenuTrigger`'s contexts and
 * loads with the first open (`cascaderMenu.components.tsx`). The field writes no role, `aria-*`
 * attribute or key handler of its own (HC2 — those are RAC's · react-aria's).
 */

const CatalogCascaderMenu = lazy(() => import("./cascaderMenu.components"));
// (Phase 3 — the `tree` · `drill` modes: RAC `Popover` > `Dialog` > `Tree` · `GridList`, their own chunk.)
const CatalogCascaderTree = lazy(() =>
  import("./cascaderPanel.components").then((m) => ({
    default: m.CatalogCascaderTree,
  })),
);
const CatalogCascaderDrill = lazy(() =>
  import("./cascaderPanel.components").then((m) => ({
    default: m.CatalogCascaderDrill,
  })),
);

/** The open content's way (사용자 결정 1 — `columns` by default). */
export type CascaderMode = "columns" | "tree" | "drill";

/** What every open content takes (`cascaderMenu` · `cascaderPanel`). */
export interface CascaderContentProps {
  readonly table: CascaderTable;
  /** The picked keys (one, or several while `multiple`). */
  readonly keys: readonly string[];
  readonly multiple: boolean;
  readonly label: string;
  /** An item is picked (single: the value; multiple: toggled). */
  readonly onPick: (key: string) => void;
  /** A search field above the levels (Phase 5 — breakdown §4.4) and the results' path separator. */
  readonly searchable: boolean;
  readonly separator: string;
}

const REFUSED_WHY: Readonly<Record<string, string>> = {
  duplicate: "여러 항목이 가진 key",
  missing: "없는 key",
  branch: "가지 항목 (끝 항목이 값)",
};

/** What the field gives its value text: its id (the Button's name — value, then label) and text. */
const CascaderValueContext = createContext<
  | {
      readonly id: string;
      readonly text: string | undefined;
      readonly placeholder: string;
    }
  | undefined
>(undefined);

export interface CatalogCascaderFieldProps {
  readonly label: string;
  readonly placeholder: string;
  readonly description: string;
  readonly errorMessage: string;
  readonly isDisabled?: boolean;
  readonly isRequired?: boolean;
  readonly isInvalid?: boolean;
  /** The hierarchy (`runtime/cascader.ts` — static items now). */
  readonly table: CascaderTable;
  readonly mode: CascaderMode;
  /** The field's display props (`displayMode` · `separator`). */
  readonly display: Readonly<Record<string, unknown>>;
  /**
   * The value's keys (one, or a list while `multiple` — 사용자 결정 3) and its write (a key ·
   * `null`, or the key list) — a running Preview's runtime value; without `onChange` the field keeps
   * its own (a static render), starting at `keys`.
   */
  readonly keys: readonly string[];
  readonly multiple?: boolean;
  /** A search field in the open content (`isSearchable`). */
  readonly searchable?: boolean;
  readonly onChange?: (value: string | null | string[]) => void;
  /** The text of two or more keys (S2 Picker's count — F6). */
  readonly countText?: (count: number) => string;
  /** The open state — controlled in a running Preview (RAC `MenuTrigger`'s `isOpen`). */
  readonly isOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly root: Record<string, unknown> & { ref?: Ref<HTMLDivElement> };
  readonly children?: ReactNode;
}

export function CatalogCascaderField({
  label,
  placeholder,
  description,
  errorMessage,
  isDisabled,
  isRequired,
  isInvalid,
  table,
  mode,
  display,
  keys,
  multiple = false,
  searchable = false,
  onChange,
  countText,
  isOpen,
  onOpenChange,
  root,
  children,
}: CatalogCascaderFieldProps) {
  const valueId = useId();
  const [own, setOwn] = useState<readonly string[]>(keys);
  const current = onChange ? keys : own;
  const write = (next: readonly string[]) => {
    if (!onChange) return void setOwn(next);
    onChange(multiple ? [...next] : (next[0] ?? null));
  };
  // (ADR-322 Phase 4 — a value no single pickable item carries is refused, never matched to the
  //  first: the field shows the key as stored and says why — Decision 4.)
  const refusal = current
    .map((key) => cascaderValueMatch(table, key))
    .find((match) => match.kind !== "item");
  const refusedKey = refusal && "key" in refusal ? refusal.key : "";
  const refusedKind = refusal?.kind ?? "";
  useEffect(() => {
    if (refusedKind)
      console.warn(
        `[Cascader] 값 거절 — ${REFUSED_WHY[refusedKind] ?? refusedKind}: ${refusedKey}`,
      );
  }, [refusedKind, refusedKey]);
  const { labelProps, fieldProps, descriptionProps, errorMessageProps } =
    useField({
      label: label || undefined,
      description: description || undefined,
      errorMessage: isInvalid && errorMessage ? errorMessage : undefined,
      isInvalid,
      validationBehavior: "aria",
    });
  const state = useMenuTriggerState({ isOpen, onOpenChange });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger(
    { type: "menu", isDisabled },
    state,
    triggerRef,
  );
  // (RAC `DialogTrigger`'s: the `tree` · `drill` content is a Dialog named by its trigger.)
  const dialogTriggerId = useId();
  const { triggerProps: dialogTriggerProps, overlayProps } = useOverlayTrigger(
    { type: "dialog" },
    state,
    triggerRef,
  );
  const menuMode = mode === "columns";
  const triggerProps = menuMode
    ? menuTriggerProps
    : { ...dialogTriggerProps, id: dialogTriggerId };
  const labelledBy = fieldProps["aria-labelledby"];
  const text =
    current.length > 1 && countText
      ? countText(current.length)
      : cascaderValueText(table, display, current);
  const field = createElement(
    "div",
    {
      ...root,
      "data-disabled": isDisabled ? "true" : undefined,
      "data-invalid": isInvalid ? "true" : undefined,
      "data-required": isRequired ? "true" : undefined,
      "data-open": state.isOpen ? "true" : undefined,
    },
    children,
  );
  const content: CascaderContentProps = {
    table,
    keys: current,
    multiple,
    searchable,
    separator:
      typeof display.separator === "string"
        ? display.separator
        : CASCADER_DEFAULT_SEPARATOR,
    label: label || placeholder,
    // (Single: the key, the menu closes — RAC's. Multiple: the key toggles, the menu stays.)
    onPick: (key: string) =>
      write(
        !multiple
          ? [key]
          : current.includes(key)
            ? current.filter((own) => own !== key)
            : [...current, key],
      ),
  };
  const menu = state.isOpen
    ? createElement(
        Suspense,
        { fallback: null },
        createElement(
          mode === "tree"
            ? CatalogCascaderTree
            : mode === "drill"
              ? CatalogCascaderDrill
              : CatalogCascaderMenu,
          content,
        ),
      )
    : null;
  return createElement(
    LabelContext.Provider,
    { value: { ...labelProps, elementType: "span" } },
    createElement(
      TextContext.Provider,
      {
        value: {
          slots: {
            description: descriptionProps,
            errorMessage: errorMessageProps,
          },
        },
      },
      createElement(
        FieldErrorContext.Provider,
        {
          value: {
            isInvalid: isInvalid === true,
            validationErrors: [],
            validationDetails: {} as ValidityState,
          },
        },
        createElement(
          ButtonContext.Provider,
          {
            value: {
              ...triggerProps,
              ref: triggerRef,
              isPressed: state.isOpen,
              isDisabled,
              // (No visible label: the placeholder names it — Select's binding does the same.)
              ...(labelledBy
                ? { "aria-labelledby": `${valueId} ${labelledBy}` }
                : { "aria-label": placeholder || "Choose an option" }),
              "aria-describedby": fieldProps["aria-describedby"],
            },
          },
          createElement(
            CascaderValueContext.Provider,
            { value: { id: valueId, text, placeholder } },
            field,
            // RAC `MenuTrigger`'s contexts (`columns`) · `DialogTrigger`'s (`tree` · `drill`) — the open
            //  content's Popover · Menu · Dialog take them.
            createElement(
              MenuContext.Provider,
              { value: menuMode ? { ...menuProps, ref: scrollRef } : null },
              createElement(
                DialogContext.Provider,
                {
                  value: menuMode
                    ? null
                    : { ...overlayProps, "aria-labelledby": dialogTriggerId },
                },
                createElement(
                  OverlayTriggerStateContext.Provider,
                  { value: state },
                  createElement(
                    RootMenuTriggerStateContext.Provider,
                    { value: state },
                    createElement(
                      PopoverContext.Provider,
                      {
                        value: menuMode
                          ? {
                              trigger: "MenuTrigger",
                              triggerRef,
                              scrollRef,
                              placement: "bottom start",
                              "aria-labelledby": menuProps["aria-labelledby"],
                            }
                          : {
                              trigger: "DialogTrigger",
                              triggerRef,
                              placement: "bottom start",
                              id: overlayProps.id,
                              "aria-labelledby": dialogTriggerId,
                            },
                      },
                      menu,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/**
 * The value text in a Cascader's open Button (RAC `SelectValue`'s element and class — the field's
 * rule styles it as Select's): the value's path (the field's — its running value), else the record's
 * text (the start value's path · the placeholder — `data-placeholder`).
 */
export function CatalogCascaderValue({
  text,
  placeholder,
  style,
  catalogId,
  children,
}: {
  readonly text: string;
  readonly placeholder: boolean;
  readonly style: Record<string, unknown>;
  readonly catalogId: string;
  readonly children?: ReactNode;
}) {
  const field = useContext(CascaderValueContext);
  const own = field ? field.text : placeholder ? undefined : text;
  const shown = own ?? (field ? field.placeholder : text);
  return createElement(
    "span",
    {
      id: field?.id,
      className: "react-aria-SelectValue",
      "data-catalog-id": catalogId,
      "data-placeholder": own === undefined ? "true" : undefined,
      style,
    },
    shown,
    children,
  );
}
