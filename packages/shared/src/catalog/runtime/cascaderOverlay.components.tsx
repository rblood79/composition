import { useRef, type ComponentType, type RefObject } from "react";
import type { useMenuTrigger } from "react-aria/useMenu";
import type { useOverlayTrigger } from "react-aria/useOverlayTrigger";
import type { useMenuTriggerState } from "react-stately/useMenuTriggerState";
import {
  DialogContext,
  OverlayTriggerStateContext,
} from "react-aria-components/Dialog";
import {
  MenuContext,
  RootMenuTriggerStateContext,
} from "react-aria-components/Menu";
import { PopoverContext } from "react-aria-components/Popover";
import { CASCADER_DEFAULT_SEPARATOR } from "./cascader";
import type { CascaderContentProps, CascaderMode } from "./cascader.components";

export interface OverlayProps extends Omit<
  CascaderContentProps,
  "separator" | "onPick"
> {
  readonly separator: unknown;
  readonly write: (keys: readonly string[]) => void;
  readonly state: ReturnType<typeof useMenuTriggerState>;
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
  readonly mode: CascaderMode;
  readonly menuProps: ReturnType<typeof useMenuTrigger>["menuProps"];
  readonly overlayProps: ReturnType<typeof useOverlayTrigger>["overlayProps"];
  readonly dialogTriggerId: string;
}

/** Only mounted while open. Keep the RAC overlay providers in each mode's lazy import graph. */
export function withCascaderOverlay(
  Content: ComponentType<CascaderContentProps & { mode: CascaderMode }>,
) {
  return function CascaderOverlay({
    state,
    triggerRef,
    mode,
    menuProps,
    overlayProps,
    dialogTriggerId,
    write,
    separator,
    ...content
  }: OverlayProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const menuMode = mode === "columns";
    const { keys, multiple } = content;
    const onPick = (key: string) => {
      if (!multiple) write([key]);
      else if (keys.includes(key))
        write(keys.filter((selected) => selected !== key));
      else write([...keys, key]);
    };
    return (
      <MenuContext.Provider
        value={menuMode ? { ...menuProps, ref: scrollRef } : null}
      >
        <DialogContext.Provider
          value={
            menuMode
              ? null
              : { ...overlayProps, "aria-labelledby": dialogTriggerId }
          }
        >
          <OverlayTriggerStateContext.Provider value={state}>
            <RootMenuTriggerStateContext.Provider value={state}>
              <PopoverContext.Provider
                value={
                  menuMode
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
                        id: overlayProps.id,
                        placement: "bottom start",
                        "aria-labelledby": dialogTriggerId,
                      }
                }
              >
                <Content
                  {...content}
                  mode={mode}
                  separator={
                    typeof separator === "string"
                      ? separator
                      : CASCADER_DEFAULT_SEPARATOR
                  }
                  onPick={onPick}
                />
              </PopoverContext.Provider>
            </RootMenuTriggerStateContext.Provider>
          </OverlayTriggerStateContext.Provider>
        </DialogContext.Provider>
      </MenuContext.Provider>
    );
  };
}
