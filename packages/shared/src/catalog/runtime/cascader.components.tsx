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
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { useCascaderForm } from "./cascaderForm.components";
import { Provider } from "react-aria-components";
import {
  Dialog,
  DialogContext,
  OverlayTriggerStateContext,
} from "react-aria-components/Dialog";
import {
  MenuContext,
  RootMenuTriggerStateContext,
} from "react-aria-components/Menu";
import { PopoverContext } from "react-aria-components/Popover";
import { useField } from "react-aria";
import { useMenuTrigger } from "react-aria/useMenu";
import { useOverlayTrigger } from "react-aria/useOverlayTrigger";
import { ButtonContext } from "react-aria-components/Button";
import { FieldErrorContext } from "react-aria-components/FieldError";
import { LabelContext } from "react-aria-components/Label";
import { TextContext } from "react-aria-components/Text";
import { useMenuTriggerState } from "react-stately/useMenuTriggerState";
import {
  CASCADER_DEFAULT_SEPARATOR,
  cascaderTrail,
  cascaderValueRefusal,
  cascaderValueText,
  type CascaderTable,
} from "./cascader";
import type { CatalogCascaderLevels } from "./cascaderLevels";
import { CatalogPopoverContentContext } from "./CatalogPopover";
import type { CascaderListBodyProps } from "./cascaderMenu.components";

/**
 * ADR-322 — a Cascader's field (breakdown §3 · §4.5). No RAC picker owns its parts (Select's part
 * origins — Label · Button(SelectValue + Icon) · Description · FieldError), so the field gives them
 * the contexts RAC would: the ids from react-aria `useField` reach the Label (`LabelContext`), the
 * help and error text (`TextContext` slots · `FieldErrorContext`); the open Button takes RAC
 * `MenuTrigger`'s trigger (react-aria `useMenuTrigger` + `useMenuTriggerState` — its props through
 * `ButtonContext`, as RAC Select passes its trigger's: the label row's help button keeps its own
 * press, `slot={null}`). The open content is the field's nodes (ADR-326): the field gives
 * `MenuTrigger`'s (`columns`) · `DialogTrigger`'s (`tree` · `drill`) contexts always and the Popover
 * node opens with them; its search scope and list box body load with the first open
 * (`cascaderMenu.components.tsx`). The field writes no role, `aria-*`
 * attribute or key handler of its own (HC2 — those are RAC's · react-aria's).
 */

// (ADR-326 — the Popover node's search scope, loaded with the first open.)
const CascaderOpenScope = lazy(() =>
  import("./cascaderMenu.components").then((module) => ({
    default: module.CascaderOpenScope,
  })),
);

/**
 * ADR-326 §4.3 — what the field gives its open content's list box node (`cascaderlist`): the table,
 * the picked keys and a pick, its levels and words, its mode.
 */
export interface CascaderOpenValue {
  readonly mode: CascaderMode;
  readonly table: CascaderTable;
  readonly keys: readonly string[];
  readonly multiple: boolean;
  readonly label: string;
  readonly onPick: (key: string) => void;
  readonly separator: string;
  readonly levels?: CatalogCascaderLevels;
}

const CascaderOpenContext = createContext<CascaderOpenValue | null>(null);

/**
 * ADR-326 Phase 3 — a `tree` · `drill` field's view while open (its search scope's state — the lazy
 * chunk gives it through the Provider the field hands it; it outlives a search): `drill` — the level
 * shown, whether the user moved since the open (the list then takes focus), a move, and the level's
 * trail (§4.4 — `cascaderTrail`); `tree` — the expanded branches.
 */
export interface CascaderViewValue {
  readonly level: string | null;
  readonly moved: boolean;
  readonly enter: (level: string | null) => void;
  readonly trail: ReturnType<typeof cascaderTrail>;
  readonly expanded: ReadonlySet<string>;
  readonly setExpanded: (expanded: ReadonlySet<string>) => void;
  /** Keeps a collection of its own (the trail's folder Menu) off the search's RAC `Autocomplete`. */
  readonly isolate: (node: ReactNode) => ReactElement;
}
export const CascaderViewContext = createContext<CascaderViewValue | null>(
  null,
);

/**
 * ADR-326 §4.4 — a trail's crumb texts by crumb record id (given around the whole Breadcrumbs: RAC
 * draws a collection's items outside the wrappers around them — `BreadcrumbsRun`).
 */
export const CascaderCrumbTextContext = createContext<
  ReadonlyMap<string, string> | undefined
>(undefined);

/** A trail crumb's label: the position's path text while its field is open, else the record's. */
export function CatalogCascaderCrumbText({
  crumb,
  fallback,
}: {
  readonly crumb: string;
  readonly fallback: ReactNode;
}) {
  return useContext(CascaderCrumbTextContext)?.get(crumb) ?? fallback;
}

/**
 * ADR-326 Phase 5 (판독 1 #1) — a `drill` level's own row (「<branch> 전체」) is its branch's record:
 * its label Text reads the level name here (given around the row's parts). Without it the record's
 * own label — the same record is its upper level's row.
 */
export const CascaderOwnLabelContext = createContext<string | undefined>(
  undefined,
);

/** An item label's words: the own row's level name, else the record's label. */
export function CatalogCascaderOwnLabel({
  fallback,
}: {
  readonly fallback: ReactNode;
}) {
  return useContext(CascaderOwnLabelContext) ?? fallback;
}

/** One shown row as the catalog renderer drew its item record (`cascaderitem`). */
export interface CascaderRowInput {
  /** The row element's props — the node's own and what the DOM pass added (state marks …). */
  readonly props: Record<string, unknown>;
  /** The record's parts in the document's order; `chevron` names those a leaf does not draw. */
  readonly parts: readonly ReactNode[];
  readonly chevron: readonly ReactNode[];
  /**
   * The RAC item's `children` function over its parts: the item's render props as their state frame
   * (the check mark's `isSelected` — `catalogStateChildren`).
   */
  readonly frame: <V extends object>(
    children: readonly ReactNode[],
  ) => (values: V) => ReactElement;
}
/** The open list's RAC item for one row (the lazy body gives it around each row it shows). */
export type CascaderRowDraw = (row: CascaderRowInput) => ReactElement;
const CascaderRowContext = createContext<CascaderRowDraw | null>(null);

/** ADR-326 — a `CascaderItem` node's DOM: the RAC item the open list makes of it (none while closed). */
export function CatalogCascaderRow({
  parts,
  chevron,
  frame,
  ...props
}: Record<string, unknown> & Omit<CascaderRowInput, "props">) {
  const draw = useContext(CascaderRowContext);
  return draw ? draw({ props, parts, chevron, frame }) : null;
}

// (The list box body is the same chunk as the search scope. It takes the field's values as props
//  — a lazy chunk importing a value of this first-screen module makes rollup split this module and
//  its imports into chunks of their own: the first screen grew by 4 KB, Phase 2 A/B.)
const CascaderListBody = lazy(() =>
  import("./cascaderMenu.components").then((module) => ({
    default: module.CascaderListBody,
  })),
);

/**
 * ADR-326 Phase 2 — the `CascaderList` node's DOM while its `columns` field is open (the catalog
 * renderer's — `delegatedDom.runtime.ts` `cascaderlist`): the field's open values, then the lazy body.
 */
export function CatalogCascaderListHost(
  props: Omit<CascaderListBodyProps, "open" | "Row" | "view">,
) {
  const open = useContext(CascaderOpenContext);
  const view = useContext(CascaderViewContext);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <CascaderListBody
        {...props}
        open={open}
        view={view}
        Row={CascaderRowContext.Provider}
      />
    </Suspense>
  );
}

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const onPick = (key: string) => {
    if (!multiple) write([key]);
    else if (current.includes(key))
      write(current.filter((selected) => selected !== key));
    else write([...current, key]);
  };
  const open: CascaderOpenValue = {
    mode,
    table,
    keys: current,
    multiple,
    label: label || placeholder,
    onPick,
    separator:
      typeof display.separator === "string"
        ? display.separator
        : CASCADER_DEFAULT_SEPARATOR,
    levels,
  };
  // (ADR-326 — the contexts RAC `MenuTrigger` (`columns`) · `DialogTrigger` (`tree` · `drill`) give
  //  their Popover and its content, given always — the Popover node opens with them, `trigger:
  //  "Cascader"`; its children take the search scope (and a Dialog's) · the open values.)
  const opened = (
    <Provider
      values={[
        [MenuContext, menuMode ? { ...menuProps, ref: scrollRef } : null],
        [
          DialogContext,
          menuMode
            ? null
            : { ...overlayProps, "aria-labelledby": dialogTriggerId },
        ],
        [OverlayTriggerStateContext, state],
        [RootMenuTriggerStateContext, state],
        [
          PopoverContext,
          {
            trigger: "Cascader",
            triggerRef,
            placement: "bottom start",
            ...(menuMode
              ? {
                  scrollRef,
                  "aria-labelledby": menuProps["aria-labelledby"],
                }
              : { id: overlayProps.id, "aria-labelledby": dialogTriggerId }),
          },
        ],
      ]}
    >
      <CatalogPopoverContentContext.Provider
        value={{
          trigger: "Cascader",
          // (`tree` · `drill`: RAC `Dialog` (the `DialogTrigger` contexts) — no box of its own. It is
          //  here, not in the lazy chunk: the Popover looks for a dialog inside as it mounts, and is
          //  one itself without — the first open suspends the chunk.)
          wrap: (content: ReactNode) => {
            const scope = (
              <Suspense fallback={null}>
                <CascaderOpenScope
                  open={open}
                  View={CascaderViewContext.Provider}
                >
                  {content}
                </CascaderOpenScope>
              </Suspense>
            );
            return menuMode ? scope : <Dialog>{scope}</Dialog>;
          },
        }}
      >
        <CascaderOpenContext.Provider value={open}>
          {field}
        </CascaderOpenContext.Provider>
      </CatalogPopoverContentContext.Provider>
    </Provider>
  );
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
      {opened}
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
