import {
    Radio as AriaRadio,
    RadioProps as AriaRadioProps,
    composeRenderProps
} from 'react-aria-components';
import { useFocusRing } from '@react-aria/focus';
import { mergeProps } from '@react-aria/utils';

import './styles/Radio.css';

export interface RadioProps extends AriaRadioProps {
    children?: React.ReactNode;
}

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-focus-visible 속성 사용
 */
export function Radio({
    children,
    ...props
}: RadioProps) {
    const { focusProps, isFocusVisible } = useFocusRing();

    return (
        <AriaRadio
            {...mergeProps(props, focusProps)}
            data-focus-visible={isFocusVisible || undefined}
            className={composeRenderProps(
                props.className,
                (className) => className ? `react-aria-Radio ${className}` : 'react-aria-Radio'
            )}
        >
            {children}
        </AriaRadio>
    );
} 