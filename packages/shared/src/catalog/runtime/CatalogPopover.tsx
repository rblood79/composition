import { useContext, useLayoutEffect, useState } from "react";
import { OverlayTriggerStateContext } from "react-aria-components/Dialog";
import { PopoverContext } from "react-aria-components/Popover";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import { useSlottedContext } from "react-aria-components/slots";
import { Popover, type PopoverProps } from "../../components/Popover";
import { catalogPickerOverlayPadding } from "./overlayLayout";
import { LISTBOX_PICKER_TYPES } from "./pickerSelection";

/** RAC owns positioning; the catalog shares its picker collision budget with Canvas. */
export function CatalogPopover(props: PopoverProps) {
  const context = useSlottedContext(PopoverContext, props.slot);
  const state = useContext(OverlayTriggerStateContext);
  const trigger = props.trigger ?? context?.trigger;
  const triggerRef = props.triggerRef ?? context?.triggerRef;
  const picker = !!trigger && LISTBOX_PICKER_TYPES.has(trigger);
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

  if (!picker) return <Popover {...props} />;
  return (
    <Popover
      {...props}
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
