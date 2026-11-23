import type { PropContract } from "../types";

/**
 * S2 `validate` (S2 체크리스트 부록 D.3 2단계, 2026-11-23 — 사용자 결정: 함수가 아니라 조건 규칙): a
 * field's validation rules — each a data view condition on its value (and the same Form's named
 * fields) that must hold, with the message shown when it does not (`validationRules.ts`). The 15
 * field types S2 1.8.2 gives `validate`.
 */
export const VALIDATE_PROP: PropContract = {
  kind: "validation-rules",
  label: "Validation rules",
  section: "validation",
};
