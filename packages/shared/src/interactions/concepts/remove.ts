import type { TagGroupProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/** RAC TagGroup.md "Removing tags": `onRemove(keys)`. */
const NAMES = ["onRemove"] as const satisfies readonly (keyof TagGroupProps)[];

export const remove = {
  id: "remove",
  racDoc: "TagGroup.md — Removing tags",
  racType: "TagGroupProps",
  events: NAMES,
  args: { onRemove: ["keys"] },
  conditions: ["disabledKeys"],
} as const satisfies InteractionConcept;
