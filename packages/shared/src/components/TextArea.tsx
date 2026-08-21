/**
 * TextArea — 여러 줄 입력 필드 (2026-08-21 신설).
 *
 * **왜 wrapper 인가**: canonical `TextArea` 는 이전까지 catalog generic 경로로 렌더돼
 * `RAC.TextField` 를 그대로 그렸고, 그 안의 입력 자식은 factory 가 만든 canonical `Input`
 * 이라 DOM 이 **한 줄 `<input>`** 이었다 — 이름이 TextArea 인데 여러 줄이 아니었고 `rows`
 * 도 시각에 반영되지 않았다. RAC 에는 TextArea **컨테이너** primitive 가 없고
 * `<TextField>` 안에 `<TextArea>` control 을 넣는 것이 D1 계약이므로, TextField 와 같은
 * self-compose wrapper 로 처리한다 (`renderFacetDeclaration` 의 `delegating-rac` 선례).
 *
 * **컨테이너 클래스는 `react-aria-TextField` 그대로 둔다** — D1(RAC) 권위이고, 생성 CSS 도
 * 그 이름으로 나온다. `.react-aria-TextArea` 는 RAC 에서 **안쪽 `<textarea>`** 의 클래스라
 * 컨테이너에 재사용하면 안 된다 (`generate-css.ts` 의 binding 파생 게이트 참조).
 *
 * data-* 는 wrapper 가 직접 emit 한다 — delegating 경로는 `toRacProps` 투영기를 타지 않으므로
 * size/labelPosition/quiet 가 여기서 빠지면 theme CSS 가 통째로 안 걸린다.
 */

import {
  FieldError,
  Label,
  Text,
  TextArea as AriaTextArea,
  TextField as AriaTextField,
  TextFieldProps as AriaTextFieldProps,
  ValidationResult,
  composeRenderProps,
} from "react-aria-components";
import type { ComponentSize } from "../types";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";
import { Skeleton } from "./Skeleton";

import "./styles/generated/TextField.css";

export interface TextAreaProps extends AriaTextFieldProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  /** 표시 줄 수 — `<textarea rows>` 로 그대로 전달된다. */
  rows?: number;
  size?: ComponentSize;
  necessityIndicator?: NecessityIndicator;
  isLoading?: boolean;
  labelPosition?: "top" | "side";
  /**
   * side 라벨 컬럼 안에서의 라벨 텍스트 정렬 (RSP `labelAlign`). Form 조상이 지정하면
   * 상속하고, 자신이 지정하면 그것이 우선 (renderer 의 nearest-wins).
   * @default 'start'
   */
  labelAlign?: "start" | "center" | "end";
  isQuiet?: boolean;
}

export function TextArea({
  label,
  description,
  errorMessage,
  placeholder = "Enter text...",
  value,
  onChange,
  isRequired,
  isDisabled,
  isReadOnly,
  rows = 3,
  size = "md",
  necessityIndicator,
  isLoading,
  labelPosition = "top",
  labelAlign,
  isQuiet,
  ...props
}: TextAreaProps) {
  if (isLoading) {
    return (
      <Skeleton
        componentVariant="input"
        size={size}
        className={props.className as string}
        aria-label="Loading text area..."
      />
    );
  }

  return (
    <AriaTextField
      {...props}
      className={composeRenderProps(props.className, (className) =>
        className
          ? `react-aria-TextField ${className}`
          : "react-aria-TextField",
      )}
      data-size={size}
      data-label-position={labelPosition}
      data-label-align={labelAlign}
      data-quiet={isQuiet ? "true" : undefined}
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
    >
      {label && (
        <Label>
          {label}
          {renderNecessityIndicator(necessityIndicator, isRequired)}
        </Label>
      )}
      <AriaTextArea rows={rows} placeholder={placeholder} />
      {description && <Text slot="description">{description}</Text>}
      <FieldError>{errorMessage}</FieldError>
    </AriaTextField>
  );
}
