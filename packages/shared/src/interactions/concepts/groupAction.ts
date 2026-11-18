import type { InteractionConcept } from "./types";

/**
 * 2026-11-18 — S2 `TagGroup` group action (installed `@react-spectrum/s2` 1.8.2 `TagGroup.tsx`
 * `ActionGroup`): `groupActionLabel` names an action button after the tags and `onGroupAction` is
 * its press. RAC's TagGroup has no such button — S2 builds it with an `ActionButton` — so the names
 * are S2's, mirrored here (`packages/shared` does not depend on S2; the D2 gate
 * `d2S2Alignment.static.test.ts` checks the binding against the installed types).
 */
export interface S2TagGroupActionProps {
  groupActionLabel?: string;
  onGroupAction?: () => void;
}

export const groupAction = {
  id: "groupAction",
  racDoc: "S2 TagGroup.md — groupActionLabel · onGroupAction",
  racType: "S2 TagGroupProps",
  events: ["onGroupAction"],
  conditions: [],
} as const satisfies InteractionConcept;
