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
import { useCascaderForm } from "./cascaderForm.components";
import { Provider } from "react-aria-components";
import { useField } from "react-aria";
import { useMenuTrigger } from "react-aria/useMenu";
import { useOverlayTrigger } from "react-aria/useOverlayTrigger";
import { ButtonContext } from "react-aria-components/Button";
import { FieldErrorContext } from "react-aria-components/FieldError";
import { LabelContext } from "react-aria-components/Label";
import { TextContext } from "react-aria-components/Text";
import { useMenuTriggerState } from "react-stately/useMenuTriggerState";
import {
  cascaderValueRefusal,
  cascaderValueText,
  type CascaderTable,
} from "./cascader";
import type { CatalogCascaderLevels } from "./cascaderLevels";

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
const CatalogCascaderPanel = lazy(() => import("./cascaderPanel.components"));

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
  /** The search results' path separator (the search field is always there — 2026-11-28 사용자 결정). */
  readonly separator: string;
  /** ADR-322 Phase 6 — levels loaded one by one (a branch opened asks its level). */
  readonly levels?: CatalogCascaderLevels;
}

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
  /**
   * Phase 6 (breakdown §3.1 — the closed D1 exception): the form value's `name` · `form`, and the
   * start keys a form reset goes back to.
   */
  readonly name?: string;
  readonly form?: string;
  readonly startKeys?: readonly string[];
  /** ADR-322 Phase 6 (사용자 결정 4) — levels loaded one by one (the session's). */
  readonly levels?: CatalogCascaderLevels;
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
  readonly onChange?: (value: string | null | string[]) => void;
  /** The text of two or more keys (S2 Picker's count — F6). */
  readonly countText?: (count: number) => string;
  /** The open state — controlled in a running Preview (RAC `MenuTrigger`'s `isOpen`). */
  readonly isOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly root: Record<string, unknown> & { ref?: Ref<HTMLDivElement> };
  readonly children?: ReactNode;
}

export function CatalogCascaderField(props: CatalogCascaderFieldProps) {
  const {
    label,
    placeholder,
    description,
    errorMessage,
    isDisabled,
    isRequired,
    levels,
    table,
    mode,
    display,
    keys,
    multiple = false,
    onChange,
    countText,
    root,
    children,
  } = props;
  const valueId = useId();
  const [own, setOwn] = useState<readonly string[]>(keys);
  const current = onChange ? keys : own;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const change = (next: readonly string[]) => {
    if (!onChange) setOwn(next);
    else onChange(multiple ? [...next] : (next[0] ?? null));
  };
  const { shown, inputs, write } = useCascaderForm(
    props,
    current,
    change,
    triggerRef,
  );
  // (ADR-322 Phase 4 — a value no single pickable item carries is refused, never matched to the
  //  first: the field shows the key as stored and says why — Decision 4.)
  const refusal = cascaderValueRefusal(table, current);
  useEffect(() => {
    if (refusal) console.warn(`[Cascader] 값 거절 — ${refusal}`);
  }, [refusal]);
  const correction = levels?.correctSelection(current, table);
  useEffect(() => {
    if (correction) {
      console.warn(correction.warning);
      write(correction.kept);
    }
    // One write per conflicting selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correction?.warning]);
  const { labelProps, fieldProps, descriptionProps, errorMessageProps } =
    useField({
      label: label || undefined,
      description: description || undefined,
      errorMessage: shown.isInvalid
        ? errorMessage || shown.validationErrors.join(" ") || undefined
        : undefined,
      isInvalid: shown.isInvalid,
      validationBehavior: "aria",
    });
  const state = useMenuTriggerState(props);
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
      "data-invalid": shown.isInvalid ? "true" : undefined,
      "data-required": isRequired ? "true" : undefined,
      "data-open": state.isOpen ? "true" : undefined,
    },
    children,
    inputs,
  );
  const OpenContent = menuMode ? CatalogCascaderMenu : CatalogCascaderPanel;
  return (
    <Provider
      values={[
        [LabelContext, { ...labelProps, elementType: "span" }],
        [
          TextContext,
          {
            slots: {
              description: descriptionProps,
              errorMessage: errorMessageProps,
            },
          },
        ],
        [FieldErrorContext, shown],
        [
          ButtonContext,
          {
            ...triggerProps,
            ref: triggerRef,
            isPressed: state.isOpen,
            isDisabled,
            ...(labelledBy
              ? { "aria-labelledby": `${valueId} ${labelledBy}` }
              : { "aria-label": placeholder || "Choose an option" }),
            "aria-describedby": fieldProps["aria-describedby"],
          },
        ],
        [CascaderValueContext, { id: valueId, text, placeholder }],
      ]}
    >
      {field}
      {state.isOpen && (
        <Suspense fallback={null}>
          <OpenContent
            state={state}
            triggerRef={triggerRef}
            menuProps={menuProps}
            overlayProps={overlayProps}
            dialogTriggerId={dialogTriggerId}
            mode={mode}
            table={table}
            keys={current}
            multiple={multiple}
            separator={display.separator}
            label={label || placeholder}
            levels={levels}
            write={write}
          />
        </Suspense>
      )}
    </Provider>
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
