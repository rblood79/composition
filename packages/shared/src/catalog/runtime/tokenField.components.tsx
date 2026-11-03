import {
  createElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { TokenField, TokenInput } from "react-aria-components/TokenField";
import {
  TokenFieldValue,
  type TokenFieldSegment,
} from "react-stately/useTokenFieldState";
import { catalogTokenSegments } from "../document/tokenFieldValue";

class CatalogTokenFieldValue extends TokenFieldValue {
  createFieldValue(segments: TokenFieldSegment[]): this {
    return new CatalogTokenFieldValue(segments) as this;
  }

  tokenize(text: string): TokenFieldSegment[] {
    return catalogTokenSegments(text);
  }
}

/** RAC가 contenteditable·선택·IME를 소유하며 문서 경계에서는 문자열만 전달한다. */
export function CatalogTokenField({
  value,
  onChange,
  children,
  ...props
}: {
  value: string;
  onChange?: (value: string) => void;
  children: ReactNode;
  [key: string]: unknown;
}) {
  const [state, setState] = useState(() => ({
    authored: value,
    field: new CatalogTokenFieldValue(
      catalogTokenSegments(value),
    ) as TokenFieldValue,
  }));
  // 외부 값 교체는 적용하되, 입력의 문자열 echo는 RAC의 선택 위치를 보존한다.
  let field = state.field;
  if (value !== state.authored) {
    field =
      field.toString() === value
        ? field
        : new CatalogTokenFieldValue(catalogTokenSegments(value));
    setState({ authored: value, field });
  }
  return createElement(TokenField, {
    ...props,
    value: field,
    onChange: (next: TokenFieldValue) => {
      setState({ authored: value, field: next });
      onChange?.(next.toString());
    },
    children,
  });
}

export function CatalogTokenInput({
  renderToken,
  ...props
}: {
  renderToken: (text: string) => ReactElement;
  [key: string]: unknown;
}) {
  return createElement(TokenInput, {
    ...props,
    children: (segment) => renderToken(segment.text),
  });
}
