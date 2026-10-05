import { memo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { NumberField } from "react-aria-components/NumberField";
import { Input } from "react-aria-components/Input";
import {
  resolveSpacingHandleRect,
  type SpacingBand,
} from "../interaction/spacingGeometry";
import {
  getCanvasFramePresentationSnapshot,
  subscribeCanvasFramePresentation,
} from "../canvasFramePresentation";
import type { CameraState } from "../skia/types";
import { useSemanticLabel } from "../../../../i18n";
import "../overlay/spacing/SpacingInlineInput.css";

interface CatalogSpacingInputProps {
  readonly band: SpacingBand;
  readonly startValue: number;
  /** A changed value (Enter, or blur with a new value); the caller commits it and closes. */
  readonly onCommit: (value: number) => void;
  /** Escape, or blur with the value unchanged. */
  readonly onCancel: () => void;
}

/** Accessible name — e.g. "Top padding", "Horizontal gap" (ADR-222 breakdown §4.1). */
function accessibleName(
  band: SpacingBand,
  localize: (key: string) => string,
): string {
  if (band.kind === "gap")
    return `${localize(band.axis === "x" ? "Horizontal" : "Vertical")} gap`;
  const side = band.side ?? "top";
  return `${localize(side.charAt(0).toUpperCase() + side.slice(1))} padding`;
}

/**
 * ADR-248 Phase 4e: the inline number input a click on a spacing handle opens (the old Canvas's
 * `SpacingInlineInput`, without its presentation session) — RAC NumberField at the handle, kept
 * there through pan and zoom by the frame camera channel. Arrow keys step the value; Enter or a
 * blur with a new value commits; Escape or an unchanged blur cancels.
 */
export const CatalogSpacingInput = memo(function CatalogSpacingInput({
  band,
  startValue,
  onCommit,
  onCancel,
}: CatalogSpacingInputProps) {
  const localize = useSemanticLabel();
  const closedRef = useRef(false);
  /** The value RAC committed last (typed text on Enter / blur, or an arrow / wheel step). */
  const valueRef = useRef(startValue);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const write = (camera: CameraState) => {
      const el = rootRef.current;
      if (!el) return;
      const handle = resolveSpacingHandleRect(band, camera.zoom, true);
      el.style.left = `${(handle.x + handle.width / 2) * camera.zoom + camera.panX}px`;
      el.style.top = `${(handle.y + handle.height / 2) * camera.zoom + camera.panY}px`;
    };
    const first = getCanvasFramePresentationSnapshot()?.cameraState;
    if (first) write(first);
    return subscribeCanvasFramePresentation(write);
  }, [band]);

  const commit = useCallback(
    (next: number) => {
      if (closedRef.current) return;
      closedRef.current = true;
      if (Number.isFinite(next) && next >= 0 && next !== startValue)
        onCommit(next);
      else onCancel();
    },
    [onCancel, onCommit, startValue],
  );
  const cancel = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div
      ref={rootRef}
      className="spacing-inline-input"
      data-kind={band.kind}
      // The Canvas press handlers must not read a press in the input as an element click.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <NumberField
        aria-label={accessibleName(band, localize)}
        defaultValue={startValue}
        minValue={0}
        step={1}
        formatOptions={{ maximumFractionDigits: 2 }}
        // RAC NumberField calls onChange on commit (Enter / blur) and on each arrow / wheel step:
        // the value is kept, and Enter or a blur closes the input with it.
        onChange={(next) => {
          if (!Number.isNaN(next)) valueRef.current = next;
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancel();
          }
          if (event.key === "Enter") {
            if (event.nativeEvent.isComposing) event.preventDefault();
            // After RAC's own Enter commit (it parses the typed text into onChange).
            else queueMicrotask(() => commit(valueRef.current));
          }
        }}
      >
        <Input
          ref={inputRef}
          className="spacing-inline-input__field"
          inputMode="decimal"
          onBlur={() => {
            // After RAC's blur commit; a blur with the value unchanged cancels.
            if (closedRef.current) return;
            queueMicrotask(() => commit(valueRef.current));
          }}
        />
      </NumberField>
      <span className="spacing-inline-input__unit" aria-hidden="true">
        px
      </span>
    </div>
  );
});
