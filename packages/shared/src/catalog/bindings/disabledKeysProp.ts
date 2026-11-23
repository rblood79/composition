import type { PropContract } from "../types";

/**
 * S2 · RAC `disabledKeys` — the items a collection names take no press · selection and the disabled
 * paint. Stored by the group as its items' keys (ADR-308's shape — the Design panel offers its items
 * as a check list); a bound collection adds the rows its disabled field marks (`fieldMap.disabled`
 * — the resolver merges them). Menu · TagGroup · SideNav · Tabs (2026-11-18), ListBox · GridList ·
 * Table · Tree · CardView · Select · ComboBox (S2 체크리스트 부록 D.3 2단계, 2026-11-23).
 */
export const DISABLED_KEYS_PROP: PropContract = {
  kind: "selection-keys",
  label: "Disabled keys",
  section: "state",
};
