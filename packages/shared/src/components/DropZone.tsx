import {
  DropZone as AriaDropZone,
  DropZoneProps as AriaDropZoneProps,
  Text,
  composeRenderProps,
} from "react-aria-components";

import { Upload } from "lucide-react";
import type { ComponentSize } from "../types";
import {
  toDropZoneRacProps,
  type DropZoneCanonicalProps,
} from "../catalog/outputs/toRacProps";

import "./styles/generated/DropZone.css";

export interface DropZoneProps extends AriaDropZoneProps {
  /**
   * Size variant
   * @default 'md'
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
  isDropTarget?: boolean;
  "data-canonical-id"?: string;
  "data-element-id"?: string;
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
  children,
  label: _label,
  description: _description,
  size: _size,
  isDropTarget: _isDropTarget,
  isDisabled: _isDisabled,
  ...props
}: DropZoneProps) {
  const { label, description, isDisabled, isDropTarget, size } =
    toDropZoneRacProps({
      ...props,
      label: _label,
      description: _description,
      size: _size,
      isDropTarget: _isDropTarget,
      isDisabled: _isDisabled,
    } as DropZoneCanonicalProps);
  const dropZoneClassName = composeRenderProps(
    props.className,
    (className, renderProps) => {
      const classes = ["react-aria-DropZone"];
      if (className) classes.push(className);
      if (isDropTarget || renderProps.isDropTarget) {
        classes.push("is-drop-target");
      }
      if (renderProps.isFocusVisible) classes.push("is-focus-visible");
      return classes.join(" ");
    },
  );

  return (
    <AriaDropZone
      {...props}
      className={dropZoneClassName}
      isDisabled={isDisabled}
      data-size={size}
      data-drop-target={isDropTarget || undefined}
    >
      {children || (
        <div className="dropzone-content">
          <Upload className="dropzone-icon" />
          {label && <Text slot="label">{label}</Text>}
          {description && <Text slot="description">{description}</Text>}
        </div>
      )}
    </AriaDropZone>
  );
}
