import { describe, it, expect } from "vitest";
import { normalizeRuntimeReusableComponents } from "../compositeRacFixtureContracts";

interface MasterLike {
  id: string;
  type: string;
  reusable?: boolean;
}

describe("normalizeRuntimeReusableComponents — ADR-144 Wave D fixture/runtime parity", () => {
  it("returns [] when reusableComponents undefined", () => {
    expect(normalizeRuntimeReusableComponents<MasterLike>({})).toEqual([]);
  });

  it("returns array directly when reusableComponents is array", () => {
    const master: MasterLike = {
      id: "cmp_1",
      type: "ListBox",
      reusable: true,
    };
    expect(
      normalizeRuntimeReusableComponents<MasterLike>({
        reusableComponents: [master],
      }),
    ).toEqual([master]);
  });

  it("returns Object.values when reusableComponents is record (fixture compat)", () => {
    const master: MasterLike = {
      id: "cmp_1",
      type: "ListBox",
      reusable: true,
    };
    expect(
      normalizeRuntimeReusableComponents<MasterLike>({
        reusableComponents: { cmp_1: master },
      }),
    ).toEqual([master]);
  });

  it("preserves empty array when reusableComponents is []", () => {
    expect(
      normalizeRuntimeReusableComponents<MasterLike>({
        reusableComponents: [],
      }),
    ).toEqual([]);
  });
});
