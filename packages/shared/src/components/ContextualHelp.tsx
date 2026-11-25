import { useId } from "@react-aria/utils";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { DialogTrigger as RACDialogTrigger } from "react-aria-components/Dialog";
import { HeadingContext } from "react-aria-components/Heading";
import { LabelContext } from "react-aria-components/Label";
import { PopoverContext } from "react-aria-components/Popover";
import {
  DEFAULT_SLOT,
  Provider,
  useSlottedContext,
} from "react-aria-components/slots";
import { useCatalogLocalized } from "../catalog/runtime/localizedStrings";
import type { ComponentSize } from "../types";
import { ActionButton } from "./ActionButton";

/**
 * ADR-259 Phase 3 — inside a field's label row (`FieldLabel`): the help's name joins the field's
 * label (S2 `FieldLabel` → `ContextualHelpContext`).
 */
/** A label row around the help: it gives its Label an id when no field does (`FieldLabel`). */
export interface FieldLabelScopeValue {
  /** The help is there — the row names its Label (S2 `FieldLabel` `fallbackLabelPropsId`). */
  register: () => () => void;
  /** Its Label's element id, when no field gives one. */
  labelId?: string;
}
export const FieldLabelScope = createContext<FieldLabelScopeValue | false>(
  false,
);

/** What the help gives its trigger Button (S2 `ContextualHelp` → its ActionButton). */
interface ContextualHelpTriggerValue {
  id: string;
  "aria-label": string;
  "aria-labelledby"?: string;
}

const ContextualHelpTriggerContext =
  createContext<ContextualHelpTriggerValue | null>(null);

/**
 * S2 1.8.0 `contextualhelp.help` · `contextualhelp.info` (`@react-spectrum/s2` intl) — the button's
 * name per variant, in the languages the Builder ships; others take English.
 */
const HELP_STRINGS: Readonly<Record<string, { help: string; info: string }>> = {
  en: { help: "Help", info: "Information" },
  ko: { help: "도움말", info: "정보" },
  ja: { help: "ヘルプ", info: "情報" },
  zh: { help: "帮助", info: "信息" },
};

export interface ContextualHelpProps {
  variant?: "help" | "info";
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  /** Its Popover holds a `slot="title"` Heading: the Popover is named by it (S2). */
  titled?: boolean;
  children?: ReactNode;
}

/**
 * ADR-259 Phase 3 — S2 `ContextualHelp` (`ContextualHelp.tsx:195-216`) over its node tree: RAC
 * `DialogTrigger` (no element) around the trigger Button and the Popover. It gives
 * - the trigger its name: `aria-label` = the variant's string; in a field's label row
 *   `aria-labelledby` = the field's label id + its own id (S2 `Field.tsx:175-184`). The Button is
 *   detached from any Button context (`slot={null}` — a ComboBox's picker, a NumberField's steppers);
 * - the Popover its name: its `slot="title"` Heading's id (S2 `ContextualHelpPopover`) — without a
 *   title RAC names it by the trigger.
 */
export function ContextualHelp({
  variant = "help",
  isOpen,
  defaultOpen = false,
  onOpenChange,
  titled = false,
  children,
}: ContextualHelpProps) {
  // The document's open value shows; pressing and dismissing do not write the document (ADR-250).
  const [open, setOpen] = useState(isOpen ?? defaultOpen);
  const [previousOpen, setPreviousOpen] = useState(isOpen);
  if (previousOpen !== isOpen) {
    setPreviousOpen(isOpen);
    if (isOpen !== undefined) setOpen(isOpen);
  }
  const strings = useCatalogLocalized(HELP_STRINGS);
  const id = useId();
  const titleId = useId();
  const inLabel = useContext(FieldLabelScope);
  useEffect(() => (inLabel ? inLabel.register() : undefined), [inLabel]);
  const label = useSlottedContext(LabelContext) as { id?: string } | null;
  const trigger: ContextualHelpTriggerValue = {
    id,
    "aria-label": variant === "info" ? strings.info : strings.help,
    ...(inLabel && (inLabel.labelId ?? label?.id)
      ? { "aria-labelledby": `${inLabel.labelId ?? label?.id} ${id}` }
      : {}),
  };
  return (
    <RACDialogTrigger
      isOpen={open}
      onOpenChange={(value) => {
        setOpen(value);
        onOpenChange?.(value);
      }}
    >
      <ContextualHelpTriggerContext.Provider value={trigger}>
        <ContextualHelpOverlay titleId={titled ? titleId : undefined}>
          {children}
        </ContextualHelpOverlay>
      </ContextualHelpTriggerContext.Provider>
    </RACDialogTrigger>
  );
}

/** The help's Popover named by its title Heading (the title slot carries the id). */
function ContextualHelpOverlay({
  titleId,
  children,
}: {
  titleId: string | undefined;
  children?: ReactNode;
}) {
  const popover = useContext(PopoverContext);
  if (!titleId) return <>{children}</>;
  return (
    <Provider
      values={[
        [
          PopoverContext,
          {
            ...(popover as object),
            "aria-labelledby": titleId,
          },
        ],
        [
          HeadingContext,
          { slots: { [DEFAULT_SLOT]: {}, title: { id: titleId } } },
        ],
      ]}
    >
      {children}
    </Provider>
  );
}

export interface ContextualHelpButtonProps {
  size?: ComponentSize;
  isQuiet?: boolean;
  style?: CSSProperties;
  isDisabled?: boolean;
  autoFocus?: boolean;
  children?: ReactNode;
  "data-catalog-id"?: string;
  "data-icon-only"?: boolean;
}

/**
 * The help's trigger ActionButton node (S2 `ContextualHelp.tsx:198-209`): the ActionButton,
 * detached from any Button context (`slot={null}`), named by its ContextualHelp. Its quiet
 * icon-only square is the ActionButton sheet's (`data-quiet` · `data-size`).
 */
export function ContextualHelpButton({
  children,
  ...props
}: ContextualHelpButtonProps) {
  const trigger = useContext(ContextualHelpTriggerContext);
  return (
    <ActionButton
      {...props}
      {...(trigger ?? {})}
      slot={null}
      data-contextual-help=""
    >
      {children}
    </ActionButton>
  );
}
