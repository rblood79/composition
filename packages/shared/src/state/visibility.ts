import type { VariableDef, VariableOwner } from "./variable.types";
import type { RuntimeScope } from "./runtimeState";
/** catalog graph가 해석한 상태 정의와 소유자. */
export interface VisibleVariable {
  def: VariableDef;
  owner: VariableOwner;
  /**
   * ADR-294 — a derived variable (a component's input variable — the instance's value): `read`
   * returns this, never a stored value; a write is refused (`input-read-only`).
   */
  derive?: (scope: RuntimeScope) => unknown;
}
