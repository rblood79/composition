import type { VariableDef, VariableOwner } from "./variable.types";
/** catalog graph가 해석한 상태 정의와 소유자. */
export interface VisibleVariable {
  def: VariableDef;
  owner: VariableOwner;
}
