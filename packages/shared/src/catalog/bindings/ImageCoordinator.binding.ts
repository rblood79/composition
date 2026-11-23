/**
 * ImageCoordinator — S2 `ImageCoordinator` (`@react-spectrum/s2` 1.8.2 `ImageCoordinator.tsx`, S2 체크리스트
 * 부록 D.2 — 사용자 결정 2026-11-24 「S2 레퍼런스 대로」): the Images inside it are revealed together once all
 * of them have loaded, or after `timeout`. Like S2 Skeleton it renders no element of its own — a context
 * around its content (`imageCoordinator.components.tsx`).
 *
 * D1: no element — the DOM gives only the children (`domBinding.runtime.ts` `imagecoordinator`); the Canvas
 *     lays it out as `display: contents` (its rule) and, empty, shows the edit-only drop spot a Skeleton does.
 * D2: S2 `ImageCoordinatorProps` — `timeout` (default 5000) · `group`. S2's group is a React context made by
 *     `createImageGroup()`; a document has no code objects, so the group here is a name — the Image's
 *     `group` of the same name joins it (no name = S2's default group).
 * D3: none — when the pictures show is a load-time behavior of the DOM (the Canvas draws each picture as
 *     soon as it has it, as for a lone Image).
 */

import type { PrimitiveBinding } from "../types";

export const imageCoordinatorBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "imagecoordinator",
  },
  props: {
    accepts: {
      timeout: {
        kind: "number",
        label: "Timeout",
        section: "state",
        default: 5000,
        min: 0,
      },
      group: {
        kind: "string",
        label: "Image group",
        section: "content",
        default: "",
      },
    },
    toRacProps: "default",
  },
};
