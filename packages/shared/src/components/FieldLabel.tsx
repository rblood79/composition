import {
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import { LabelContext, useSlottedContext } from "react-aria-components";
import { FieldLabelScope } from "./ContextualHelp";

export type FieldLabelProps = HTMLAttributes<HTMLDivElement>;

/**
 * ADR-259 Phase 3 — a field's label row (S2 `FieldLabel`'s `div`, `Field.tsx:96-117` — no role):
 * the field's Label and its ContextualHelp. React passes the field's RAC contexts through it (the
 * Label keeps the field's label id); the help in it joins that label's name (`FieldLabelScope`).
 * Outside a RAC field (S2 LabeledValue — S2 체크리스트 §9.1, 2026-11-24) a row holding a help gives
 * its Label an id of its own, as S2's `fallbackLabelPropsId` does — no help, no id.
 */
export function FieldLabel({ className, children, ...props }: FieldLabelProps) {
  const raw = useContext(LabelContext);
  const fieldLabel = useSlottedContext(LabelContext) as { id?: string } | null;
  const fallbackId = useId();
  const [helps, setHelps] = useState(0);
  const register = useCallback(() => {
    setHelps((count) => count + 1);
    return () => setHelps((count) => count - 1);
  }, []);
  const own = helps > 0 && !fieldLabel?.id;
  // (The Label's element id — an author's HTML id beats the context one — names the help.)
  const row = useRef<HTMLDivElement>(null);
  const [labelId, setLabelId] = useState<string>();
  useLayoutEffect(() => {
    setLabelId(
      own
        ? row.current?.querySelector(":scope > .react-aria-Label")?.id ||
            undefined
        : undefined,
    );
  });
  const scope = useMemo(() => ({ register, labelId }), [register, labelId]);
  const label = own ? { ...(raw ?? {}), id: fallbackId } : raw;
  return (
    <div
      {...props}
      ref={row}
      className={["react-aria-FieldLabel", className].filter(Boolean).join(" ")}
    >
      <LabelContext.Provider value={label as typeof raw}>
        <FieldLabelScope.Provider value={scope}>
          {children}
        </FieldLabelScope.Provider>
      </LabelContext.Provider>
    </div>
  );
}
