import {
  createContext,
  type Context,
  type ForwardedRef,
  type RefObject,
} from "react";
import { useContextProps } from "react-aria-components";
import type { ContextValue, SlotProps } from "react-aria-components";
import { CATALOG_LOCAL_SLOT_CONTEXTS } from "../catalog/racSlotContract";

/** S2-only controllers consumed by the catalog's own elements. */
export type CatalogLocalSlotProps = SlotProps & Record<string, unknown>;
export const CATALOG_COMPONENT_SLOT_CONTEXTS = Object.fromEntries(
  CATALOG_LOCAL_SLOT_CONTEXTS.map((type) => [
    type,
    createContext<ContextValue<CatalogLocalSlotProps, HTMLElement>>(null),
  ]),
) as Readonly<
  Record<
    (typeof CATALOG_LOCAL_SLOT_CONTEXTS)[number],
    Context<ContextValue<CatalogLocalSlotProps, HTMLElement>>
  >
>;

/** Read a local controller's context before applying its catalog defaults. */
export function useCatalogSlotProps<P extends SlotProps, E extends Element>(
  type: (typeof CATALOG_LOCAL_SLOT_CONTEXTS)[number],
  props: P,
  ref: ForwardedRef<E> | undefined,
): [P, RefObject<E | null>] {
  return useContextProps(
    props,
    ref,
    CATALOG_COMPONENT_SLOT_CONTEXTS[type] as unknown as Context<
      ContextValue<P, E>
    >,
  );
}
