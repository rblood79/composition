import {
  DropZone as AriaDropZone,
  DropZoneProps as AriaDropZoneProps,
} from "react-aria-components/DropZone";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import type { ComponentSize } from "../types";

export interface DropZoneProps extends AriaDropZoneProps {
  /**
   * Size variant
   * @default 'M'
   */
  size?: ComponentSize;
  /**
   * The catalog's `label` · `description` — the zone's S2 IllustratedMessage child shows them
   * (template binding); the zone itself draws no words (S2 마이그레이션 2026-11-18).
   */
  label?: string;
  description?: string;
  /**
   * S2 — the zone already holds a file: while a drag is over it, the replace banner shows
   * (the `[data-drop-target] .dropzone-replace` sheet rule).
   */
  isFilled?: boolean;
  /**
   * S2 — the replace banner's message (default "Drop file to replace", S2 strings).
   */
  replaceMessage?: string;
}

/**
 * DropZone Component
 *
 * Features:
 * - Drag and drop file handling
 * - Visual feedback on drag over (data-drop-target from RAC)
 * - Accessible keyboard interaction
 * - Its content is its children (S2: an IllustratedMessage)
 *
 * @example
 * <DropZone onDrop={handleDrop}>
 *   <IllustratedMessage>…</IllustratedMessage>
 * </DropZone>
 */
export function DropZone({
  size,
  // (Not RAC props — kept off the element.)
  label: _label,
  description: _description,
  isFilled,
  replaceMessage,
  children,
  ...props
}: DropZoneProps) {
  const dropZoneClassName = composeRenderProps(
    props.className,
    (className, renderProps) => {
      const classes = ["react-aria-DropZone"];
      if (className) classes.push(className);
      if (renderProps.isDropTarget) classes.push("is-drop-target");
      if (renderProps.isFocusVisible) classes.push("is-focus-visible");
      return classes.join(" ");
    },
  );

  // S2: the replace banner of a filled zone — in the DOM whenever `isFilled`; the sheet shows it
  // only while a drag is over the zone (`[data-drop-target] .dropzone-replace`).
  const replace = isFilled ? (
    <div className="dropzone-replace" aria-hidden>
      {replaceMessage || "Drop file to replace"}
    </div>
  ) : null;
  return (
    // (The catalog passes the size as `data-size` — `toRacProps` — a direct `size` wins; M by default.)
    <AriaDropZone
      {...props}
      className={dropZoneClassName}
      data-size={
        size ?? (props as { "data-size"?: ComponentSize })["data-size"] ?? "M"
      }
    >
      {composeRenderProps(children, (content) => (
        <>
          {content}
          {replace}
        </>
      ))}
    </AriaDropZone>
  );
}
