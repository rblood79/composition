import type { HTMLAttributes } from "react";
import { FieldLabelScope } from "./ContextualHelp";

export type FieldLabelProps = HTMLAttributes<HTMLDivElement>;

/**
 * ADR-259 Phase 3 — a field's label row (S2 `FieldLabel`'s `div`, `Field.tsx:96-117` — no role):
 * the field's Label and its ContextualHelp. React passes the field's RAC contexts through it (the
 * Label keeps the field's label id); the help in it joins that label's name (`FieldLabelScope`).
 */
export function FieldLabel({ className, children, ...props }: FieldLabelProps) {
  return (
    <div
      {...props}
      className={["react-aria-FieldLabel", className].filter(Boolean).join(" ")}
    >
      <FieldLabelScope.Provider value={true}>
        {children}
      </FieldLabelScope.Provider>
    </div>
  );
}
