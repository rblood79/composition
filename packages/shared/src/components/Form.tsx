import { Form as RACForm, FormProps } from "react-aria-components";
import { FocusScope } from "@react-aria/focus";
import "./styles/generated/Form.css";

export interface ExtendedFormProps extends FormProps {
  /**
   * 자동 포커스
   * 폼이 렌더링될 때 첫 번째 필드로 자동 이동
   * @default false
   */
  autoFocus?: boolean;
  /**
   * 포커스 복원
   * 폼 제출 후 포커스 복원 여부
   * @default false
   */
  restoreFocus?: boolean;
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "center" | "end";
  necessityIndicator?: "icon" | "label";
}

/**
 * Form Component with Focus Management
 *
 * Features:
 * - Auto-focus first field on render
 * - Focus restoration after form submission
 * - Keyboard navigation (Tab, Shift+Tab)
 * - Proper form validation flow
 *
 * @example
 * <Form autoFocus>
 *   <TextField label="Name" />
 *   <TextField label="Email" />
 *   <Button type="submit">Submit</Button>
 * </Form>
 */
export function Form({
  autoFocus = false,
  restoreFocus = false,
  labelPosition,
  labelAlign,
  necessityIndicator,
  children,
  ...props
}: ExtendedFormProps) {
  return (
    <RACForm
      {...props}
      className="react-aria-Form"
      data-label-position={labelPosition}
      data-label-align={labelAlign}
      data-necessity-indicator={necessityIndicator}
    >
      <FocusScope autoFocus={autoFocus} restoreFocus={restoreFocus}>
        {children}
      </FocusScope>
    </RACForm>
  );
}
