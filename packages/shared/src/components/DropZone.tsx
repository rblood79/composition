import {
  DropZone as AriaDropZone,
  DropZoneProps as AriaDropZoneProps,
  Text,
  composeRenderProps
} from 'react-aria-components';

import { Upload } from 'lucide-react';
import type { ComponentSize } from '../types';

import './styles/generated/DropZone.css';

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
  size = 'md',
  label,
  description,
  children,
  ...props
}: DropZoneProps) {
  const dropZoneClassName = composeRenderProps(
    props.className,
    (className, renderProps) => {
      const classes = ['react-aria-DropZone'];
      if (className) classes.push(className);
      if (renderProps.isDropTarget) classes.push('is-drop-target');
      if (renderProps.isFocusVisible) classes.push('is-focus-visible');
      return classes.join(' ');
    }
  );

  return (
    <AriaDropZone
      {...props}
      className={dropZoneClassName}
      data-size={size}
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
