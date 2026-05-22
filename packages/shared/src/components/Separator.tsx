/**
 * Separator Component
 *
 * A visual divider for separating content sections
 * Based on React Aria Components Separator
 */

import { Separator as AriaSeparator, SeparatorProps as AriaSeparatorProps } from 'react-aria-components';
import type { SeparatorVariant, ComponentSizeSubset } from '../types';
import './styles/Separator.css';

export interface SeparatorProps extends AriaSeparatorProps {
  /**
   * The orientation of the separator
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';

  /**
   * Visual variant
   * @default 'default'
   */
  variant?: SeparatorVariant;

  /**
   * Size/thickness of the separator
   * @default 'md'
   */
  size?: ComponentSizeSubset;
}

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성 사용
 */
export function Separator(props: SeparatorProps) {
  const { orientation = 'horizontal', variant = 'default', size = 'md', className, ...restProps } = props;

  return (
    <AriaSeparator
      {...restProps}
      orientation={orientation}
      className={className ? `react-aria-Separator ${className}` : 'react-aria-Separator'}
      data-variant={variant}
      data-size={size}
    />
  );
}
