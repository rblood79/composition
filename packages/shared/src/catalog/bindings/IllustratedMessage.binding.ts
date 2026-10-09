import type { PrimitiveBinding } from "../types";

/**
 * IllustratedMessage — the S2 empty-state container (`@react-spectrum/s2/src/IllustratedMessage.tsx`):
 * `IllustratedMessage > Illustration + Heading + Content (+ ButtonGroup)`.
 *
 * 2026-10-09 (사용자 「IllustratedMessage 제목 · 설명 노드 전환」 → 「레퍼런스에 맞게」 → 「(a) 로
 * 진행해, orientation 도 같이 넣어」): the picture, the heading and the content are child nodes — an
 * `Illustration` and instances of the Heading · Description origins (the origin's `{title}` ·
 * `{description}`, `component-illustratedmessage`). The old props `heading` · `description` and the
 * Canvas escape / Preview component that drew them are gone.
 *
 * **DOM**: `ruleDom`'s fallback `div.react-aria-IllustratedMessage` (+ `data-size` ·
 *   `data-orientation`) — the generated sheet places the parts (`orientation` blocks).
 * **Canvas**: the rule's box; the parts are laid out by the same rule (`rulePartRules.ts` container
 *   variants — `orientation`). The size reaches the parts (`CATALOG_SIZE_PROPAGATION` · `_STEP`).
 *
 * D1: S2 — a plain `div` (no role). D2: S2 `size` (S · M · L) · `orientation` (vertical · horizontal).
 * D3: rule `COMPONENT_RULES_TABLE.IllustratedMessage`.
 */
export const illustratedMessageBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "illustratedmessage",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "vertical",
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ],
      },
    },
    toRacProps: "default",
  },
};
