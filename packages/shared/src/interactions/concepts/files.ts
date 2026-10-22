import type { DropZoneProps, FileTriggerProps } from "react-aria-components";
import type { InteractionConcept } from "./types";

/**
 * ADR-201 Phase 3 — the file inputs' When axis (FileTrigger.md · DropZone.md). `onDrop` is
 * inherited by `DropZoneProps` from `DropOptions`. Custom completion events are not RAC's and are
 * not derived (ADR-201 R2).
 */
export const FILE_TRIGGER_EVENTS = [
  "onSelect",
] as const satisfies readonly (keyof FileTriggerProps)[];
export const DROP_ZONE_EVENTS = [
  "onDrop",
] as const satisfies readonly (keyof DropZoneProps)[];

export const fileSelect = {
  id: "fileSelect",
  racDoc: "FileTrigger.md — onSelect",
  racType: "FileTriggerProps",
  events: FILE_TRIGGER_EVENTS,
  args: { onSelect: ["files"] },
  conditions: [],
} as const satisfies InteractionConcept;

export const dragDrop = {
  id: "dragDrop",
  racDoc: "DropZone.md — onDrop",
  racType: "DropZoneProps",
  events: DROP_ZONE_EVENTS,
  conditions: ["isDisabled"],
} as const satisfies InteractionConcept;
