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

  return (
    <AriaDropZone {...props} className={dropZoneClassName} data-size={size}>
      {children || (
        <>
          {/* The DropZone column's own flex items (catalog delegation: icon `--icon-size`,
              label · description fonts) — the Canvas lays out and paints the same three. */}
          <Upload className="dropzone-icon" aria-hidden />
          {label && <Text slot="label">{label}</Text>}
          {description && <Text slot="description">{description}</Text>}
        </>
      )}
    </AriaDropZone>
  );
}
