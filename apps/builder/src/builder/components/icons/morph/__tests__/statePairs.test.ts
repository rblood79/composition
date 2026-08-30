/**
 * ADR-197 Phase 2 — 레지스트리 무결성 (G2).
 *
 * lucide 데이터가 재생성되면서 이름이 바뀌면 여기서 즉시 깨진다 (R6).
 */

import { describe, expect, it } from "vitest";
import { buildPlan } from "../core/plan";
import { resampleIcon } from "../core/resample";
import type { IconNode } from "../core/types";
import { resolveIconInput } from "../iconNodes";
import { ICON_STATE_PAIRS } from "../statePairs";

const entries = Object.entries(ICON_STATE_PAIRS);

describe("ICON_STATE_PAIRS", () => {
  it.each(entries)(
    "%s — 양끝이 lucide 레지스트리에 있다",
    (_pair, [off, on]) => {
      expect(resolveIconInput(off)).not.toBeNull();
      expect(resolveIconInput(on)).not.toBeNull();
    },
  );

  it.each(entries)(
    "%s — off ≠ on (형태가 실제로 다르다)",
    (_pair, [off, on]) => {
      expect(off).not.toBe(on);
    },
  );

  it.each(entries)("%s — plan 이 유한하다 (θ/σ NaN 0)", (_pair, [off, on]) => {
    const src = resampleIcon(resolveIconInput(off) as IconNode, 64);
    const dst = resampleIcon(resolveIconInput(on) as IconNode, 64);
    const plan = buildPlan(src, dst);
    expect(plan.items.length).toBeGreaterThan(0);
    for (const item of plan.items) {
      expect(Number.isFinite(item.theta)).toBe(true);
      expect(Number.isFinite(item.lnSigma)).toBe(true);
      expect(Number.isFinite(item.res)).toBe(true);
    }
  });
});
