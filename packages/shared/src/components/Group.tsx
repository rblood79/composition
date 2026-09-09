/**
 * Group - Element grouping container
 *
 * Phase 4: Grouping & Organization - Group Selection
 * Based on React Aria Group component for accessible grouping
 *
 * @see https://react-spectrum.adobe.com/react-aria/Group.html
 */

import { ReactNode } from "react";
import {
  Group as AriaGroup,
  type GroupProps as AriaGroupProps,
} from "react-aria-components/Group";
import { composeRenderProps } from "react-aria-components/composeRenderProps";

export interface GroupProps extends Omit<
  AriaGroupProps,
  "className" | "style"
> {
  /** Group content (children elements) */
  children?: ReactNode;
  /** CSS class name */
  className?: string;
  /** Group label (optional, for builder display) */
  label?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Disable all child controls */
  isDisabled?: boolean;
  /** Mark group as invalid */
  isInvalid?: boolean;
  /** Mark group as read-only */
  isReadOnly?: boolean;
  /** Accessible label */
  "aria-label"?: string;
  /** ID of element that labels this group */
  "aria-labelledby"?: string;
  /** ARIA role (group, region, or presentation) */
  role?: "group" | "region" | "presentation";
}

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-disabled, data-invalid, data-readonly 속성 사용
 */

/**
 * Group component
 *
 * A set of related UI controls with support for interactive states.
 * Commonly used to visually unite adjoined elements.
 *
 * @example
 * ```tsx
 * <Group label="Header Elements" aria-label="Navigation">
 *   <Button>Login</Button>
 *   <Button>Signup</Button>
 * </Group>
 * ```
 *
 * @example
 * ```tsx
 * <TextField>
 *   <Label>Email</Label>
 *   <Group>
 *     <Input />
 *     <Button aria-label="Add email">
 *       <Plus size={16} />
 *     </Button>
 *   </Group>
 * </TextField>
 * ```
 */
export function Group({
  children,
  className,
  label,
  style,
  isDisabled,
  isInvalid,
  isReadOnly,
  role = "group",
  ...props
}: GroupProps) {
  return (
    <AriaGroup
      {...props}
      role={role}
      isDisabled={isDisabled}
      className={composeRenderProps(className, (cls) => {
        return cls ? `react-aria-Group ${cls}` : "react-aria-Group";
      })}
      style={style}
      data-group-label={label}
      data-disabled={isDisabled || undefined}
      data-invalid={isInvalid || undefined}
      data-readonly={isReadOnly || undefined}
    >
      {children}
    </AriaGroup>
  );
}
