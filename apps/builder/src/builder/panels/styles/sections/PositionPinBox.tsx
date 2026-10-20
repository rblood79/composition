/**
 * ADR-275 Decision 3 — the Position section's pin box (Figma constraints widget): four side pins
 * and a centre crosshair per axis. A pressed side pins the box to that side of its parent; both
 * sides of an axis stretch it; a crosshair centres it on that axis. The section turns a press into
 * the axis' next constraint (an axis is never empty — `catalogNextAxisConstraint`).
 */
import { memo } from "react";
import { ToggleButton } from "react-aria-components";
import type { CatalogAxisConstraint } from "../../../catalogRuntime/positionConstraint";
import { useSemanticLabel } from "../../../../i18n";

export type PinTarget =
  "left" | "right" | "top" | "bottom" | "centerX" | "centerY";

const PINS: ReadonlyArray<{
  target: PinTarget;
  label: string;
  axis: "x" | "y";
  pressed: (c: CatalogAxisConstraint) => boolean;
}> = [
  {
    target: "top",
    label: "Pin top",
    axis: "y",
    pressed: (c) => c === "start" || c === "both",
  },
  {
    target: "right",
    label: "Pin right",
    axis: "x",
    pressed: (c) => c === "end" || c === "both",
  },
  {
    target: "bottom",
    label: "Pin bottom",
    axis: "y",
    pressed: (c) => c === "end" || c === "both",
  },
  {
    target: "left",
    label: "Pin left",
    axis: "x",
    pressed: (c) => c === "start" || c === "both",
  },
  {
    target: "centerX",
    label: "Center horizontally",
    axis: "x",
    pressed: (c) => c === "center",
  },
  {
    target: "centerY",
    label: "Center vertically",
    axis: "y",
    pressed: (c) => c === "center",
  },
];

export const PositionPinBox = memo(function PositionPinBox({
  constraint,
  isDisabled,
  onPress,
}: {
  constraint: { x: CatalogAxisConstraint; y: CatalogAxisConstraint };
  isDisabled?: boolean;
  onPress: (target: PinTarget) => void;
}) {
  const localize = useSemanticLabel();
  return (
    <div
      className="position-pin-box"
      role="group"
      aria-label={localize("Constraints")}
      data-disabled={isDisabled || undefined}
    >
      <span className="position-pin-box__item" aria-hidden="true" />
      {PINS.map((pin) => (
        <ToggleButton
          key={pin.target}
          className="position-pin"
          data-target={pin.target}
          aria-label={localize(pin.label)}
          isDisabled={isDisabled}
          isSelected={pin.pressed(constraint[pin.axis])}
          onChange={() => onPress(pin.target)}
        >
          <span className="position-pin__line" aria-hidden="true" />
        </ToggleButton>
      ))}
    </div>
  );
});
