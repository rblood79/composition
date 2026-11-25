import {
  createContext,
  createElement,
  useContext,
  useId,
  useLayoutEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Token,
  TokenField,
  TokenInput,
} from "react-aria-components/TokenField";
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

/**
 * S2 체크리스트 §4.1 TokenField Phase 4 — the necessity · error state a screen reader needs, which RAC
 * TokenField does not carry (`AriaTokenFieldProps` has no `isRequired` · validation, its TokenInput
 * passes on no `aria-*` prop). D1 exception (사용자 결정 2026-11-23, `ssot-hierarchy.md` §1): the
 * TokenInput (`role="textbox"`) gets `aria-required` · `aria-invalid` by ref, and the error text is
 * named by RAC's own `aria-describedby` (`useField` joins it to the description's).
 */
interface CatalogTokenFieldA11y {
  readonly isRequired: boolean;
  readonly isInvalid: boolean;
  /** The FieldError element's id (`CatalogTokenFieldError`). */
  readonly errorId: string;
}
const TokenFieldA11yContext = createContext<CatalogTokenFieldA11y | null>(null);

/** RAC가 contenteditable·선택·IME를 소유하며 문서 경계에서는 문자열만 전달한다. */
export function CatalogTokenField({
  value,
  onChange,
  children,
  isRequired = false,
  isInvalid = false,
  hasErrorMessage = false,
  ...props
}: {
  value: string;
  onChange?: (value: string) => void;
  children: ReactNode;
  isRequired?: boolean;
  isInvalid?: boolean;
  /** The field shows its FieldError (invalid, with an `errorMessage`). */
  hasErrorMessage?: boolean;
  [key: string]: unknown;
}) {
  const errorId = useId();
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
  const own =
    typeof props["aria-describedby"] === "string"
      ? props["aria-describedby"]
      : undefined;
  const describedBy =
    isInvalid && hasErrorMessage
      ? [own, errorId].filter(Boolean).join(" ")
      : own;
  return createElement(
    TokenFieldA11yContext.Provider,
    { value: { isRequired, isInvalid, errorId } },
    createElement(TokenField, {
      ...props,
      ...(describedBy ? { "aria-describedby": describedBy } : {}),
      value: field,
      onChange: (next: TokenFieldValue) => {
        setState({ authored: value, field: next });
        onChange?.(next.toString());
      },
      children,
    }),
  );
}

/**
 * A TokenField's FieldError (RAC TokenField has no FieldError context): its text, at the id RAC's
 * `aria-describedby` names — while the field is invalid, as RAC's FieldError.
 */
export function CatalogTokenFieldError(props: {
  children?: ReactNode;
  [key: string]: unknown;
}) {
  const a11y = useContext(TokenFieldA11yContext);
  // (as RAC's FieldError: only while the field is invalid — and only with a message)
  if (!a11y?.isInvalid || !props.children) return null;
  return createElement("span", {
    ...props,
    className: "react-aria-FieldError",
    ...(a11y ? { id: a11y.errorId } : {}),
  });
}

export function CatalogTokenInput({
  renderToken,
  ...props
}: {
  renderToken: (text: string) => ReactElement;
  [key: string]: unknown;
}) {
  const a11y = useContext(TokenFieldA11yContext);
  const [input, setInput] = useState<HTMLDivElement | null>(null);
  // (D1 exception — the field's necessity · error on the textbox; RAC writes neither, so nothing
  //  of RAC's is overwritten. Removed when off, as a RAC state attribute is.)
  useLayoutEffect(() => {
    if (!input) return;
    const write = (name: string, on: boolean | undefined) =>
      on ? input.setAttribute(name, "true") : input.removeAttribute(name);
    write("aria-required", a11y?.isRequired);
    write("aria-invalid", a11y?.isInvalid);
  }, [input, a11y?.isRequired, a11y?.isInvalid]);
  return createElement(TokenInput, {
    ...props,
    ref: setInput,
    children: (segment) => renderToken(segment.text),
  });
}

/** RAC's Token (a TokenInput segment's chip — the rule's paint tree by `data-variant`). */
export { Token as CatalogToken };
