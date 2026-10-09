import {
  DropZone as AriaDropZone,
  DropZoneProps as AriaDropZoneProps,
} from "react-aria-components/DropZone";
import { Text } from "react-aria-components/Text";
import { composeRenderProps } from "react-aria-components/composeRenderProps";

import { Upload } from "lucide-react";
import type { ComponentSize } from "../types";

export interface DropZoneProps extends AriaDropZoneProps {
  /**
   * Size variant
   * @default 'M'
   */
  size?: ComponentSize;
  /**
   * Label text displayed in the drop zone
   */
  label?: string;
  /**
   * Description text
   */
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
 * - Custom content support
 *
 * @example
 * <DropZone onDrop={handleDrop}>
 *   <Text slot="label">Drop files here</Text>
 * </DropZone>
 */
export function DropZone({
  size = "M",
  label,
  description,
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
    <AriaDropZone {...props} className={dropZoneClassName} data-size={size}>
      {children ? (
        <>
          {children}
          {replace}
        </>
      ) : (
        <>
          {/* The DropZone column's own flex items (catalog delegation: icon `--icon-size`,
              label · description fonts) — the Canvas lays out and paints the same three. */}
          <Upload className="dropzone-icon" aria-hidden />
          {label && <Text slot="label">{label}</Text>}
          {description && <Text slot="description">{description}</Text>}
          {replace}
        </>
      )}
    </AriaDropZone>
  );
}
