import { useLayoutEffect, useState } from "react";
import { PopoverContext } from "react-aria-components/Popover";
import { useSlottedContext } from "react-aria-components/slots";
import { Popover, type PopoverProps } from "../../components/Popover";
import { catalogPickerOverlayPadding } from "./overlayLayout";

/** RAC owns positioning; the catalog shares its picker collision budget with Canvas. */
export function CatalogPopover(props: PopoverProps) {
  const context = useSlottedContext(PopoverContext, props.slot);
  const trigger = props.trigger ?? context?.trigger;
  const triggerRef = props.triggerRef ?? context?.triggerRef;
  const picker = trigger === "Select" || trigger === "ComboBox";
  const requested = props.containerPadding ?? 12;
  const [budget, setBudget] = useState<{ padding: number; width: number }>();

  useLayoutEffect(() => {
    const element = triggerRef?.current;
    if (!picker || !element) return;
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
  }, [picker, requested, triggerRef]);

  return (
    <Popover
      {...props}
      containerPadding={
        picker ? (budget?.padding ?? requested) : props.containerPadding
      }
      style={
        picker
          ? (values) => ({
              ...(typeof props.style === "function"
                ? props.style(values)
                : props.style),
              "--catalog-overlay-available-width": budget
                ? `${Math.max(0, budget.width - budget.padding * 2)}px`
                : `max(0px, calc(100vw - ${requested * 2}px))`,
            })
          : props.style
      }
    />
  );
}
