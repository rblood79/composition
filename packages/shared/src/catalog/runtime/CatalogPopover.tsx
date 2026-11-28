import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { OverlayTriggerStateContext } from "react-aria-components/Dialog";
import { PopoverContext } from "react-aria-components/Popover";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import { useSlottedContext } from "react-aria-components/slots";
import { Popover, type PopoverProps } from "../../components/Popover";
import { catalogPickerOverlayPadding } from "./overlayLayout";
import { PICKER_POPOVER_TYPES } from "./pickerSelection";

/**
 * ADR-326 §4.3 — an owner that builds the open content around its Popover node's children (a
 * Cascader: its search scope — RAC `Autocomplete` — over the search field and list box nodes). It
 * reaches only the Popover its own `PopoverContext` names (`trigger`), and none below it.
 */
export interface CatalogPopoverContent {
  readonly trigger: string;
  readonly wrap: (children: ReactNode) => ReactNode;
}

export const CatalogPopoverContentContext =
  createContext<CatalogPopoverContent | null>(null);

/** RAC owns positioning; the catalog shares its picker collision budget with Canvas. */
export function CatalogPopover(props: PopoverProps) {
  const context = useSlottedContext(PopoverContext, props.slot);
  const state = useContext(OverlayTriggerStateContext);
  const trigger = props.trigger ?? context?.trigger;
  const triggerRef = props.triggerRef ?? context?.triggerRef;
  const picker = !!trigger && PICKER_POPOVER_TYPES.has(trigger);
  const content = useContext(CatalogPopoverContentContext);
  const owned = content && content.trigger === trigger ? content : null;
  // A closed picker renders nothing (RAC) — it measures when it opens. An uncontrolled Popover's
  // state is its own, so it counts as open.
  const open =
    props.isOpen ?? (props.defaultOpen == null && state ? state.isOpen : true);
  const requested = props.containerPadding ?? 12;
  const [budget, setBudget] = useState<{ padding: number; width: number }>();

  useLayoutEffect(() => {
    const element = triggerRef?.current;
    if (!picker || !open || !element) return;
    const viewport = element.ownerDocument.documentElement;
    const update = () => {
      const width = viewport.clientWidth;
      const triggerBox = element.getBoundingClientRect();
      const padding = catalogPickerOverlayPadding(
        requested,
        triggerBox.width,
        width,
        triggerBox.left,
      );
      setBudget((prior) =>
        prior?.padding === padding && prior.width === width
          ? prior
          : { padding, width },
      );
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(element);
    observer?.observe(viewport);
    return () => observer?.disconnect();
  }, [picker, open, requested, triggerRef]);

  // (ADR-326 Phase 0 P1 — an owned Popover keeps RAC `Overlay`'s focus restore only: the shared
  //  Popover's own restore after an outside press left focus on `body`, not the open Button.)
  const own = owned
    ? {
        restoreFocus: false,
        children: (
          <CatalogPopoverContentContext.Provider value={null}>
            {owned.wrap(props.children as ReactNode)}
          </CatalogPopoverContentContext.Provider>
        ),
      }
    : {};
  if (!picker) return <Popover {...props} {...own} />;
  return (
    <Popover
      {...props}
      {...own}
      containerPadding={budget?.padding ?? requested}
      style={composeRenderProps(props.style, (style) => ({
        ...style,
        "--catalog-overlay-available-width": budget
          ? `${Math.max(0, budget.width - budget.padding * 2)}px`
          : `max(0px, calc(100vw - ${requested * 2}px))`,
      }))}
    />
  );
}
