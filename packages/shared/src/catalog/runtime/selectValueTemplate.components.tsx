import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * S2 체크리스트 §9.3 (S2 Picker `renderValue`) — the running selection RAC's SelectValue passes (its
 * `state`'s keys) to the copies of its value shape: a copy shows while its row is selected.
 * `null` = outside a SelectValue's render (a static render — every copy shows).
 */
export const CatalogSelectValueKeys = createContext<ReadonlySet<string> | null>(
  null,
);

/** A copy of a SelectValue's repeated node: drawn while its row (`rowKey`) is selected. */
export function CatalogSelectValueRowGate({
  rowKey,
  element,
}: {
  rowKey: string;
  element: ReactElement;
}): ReactElement | null {
  const keys = useContext(CatalogSelectValueKeys);
  return !keys || keys.has(rowKey) ? element : null;
}

/**
 * The value shape a SelectValue shows (S2 `renderValue`'s element): its nodes under the selected
 * keys. S2 warns of interactive children (a value inside the trigger button — `Picker.tsx:583-604`).
 */
export function CatalogSelectValueShape({
  keys,
  children,
}: {
  keys: ReadonlySet<string>;
  children?: ReactNode;
}): ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const interactive = ref.current?.querySelector(
      'a[href], button, input, select, textarea, [tabindex], [role="button"], [role="link"], [role="checkbox"], [role="switch"]',
    );
    if (interactive)
      console.warn(
        "Picker's value should not have interactive children for accessibility.",
      );
  });
  return (
    <CatalogSelectValueKeys.Provider value={keys}>
      <span ref={ref} style={{ display: "contents" }}>
        {children}
      </span>
    </CatalogSelectValueKeys.Provider>
  );
}
