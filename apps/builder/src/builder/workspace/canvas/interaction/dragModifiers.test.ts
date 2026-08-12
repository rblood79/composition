import { afterEach, describe, expect, it } from "vitest";
import {
  applyAxisLock,
  applyAxisLockToDelta,
  armDragAltClone,
  isDragAltCloneArmed,
} from "./dragModifiers";

describe("applyAxisLock (ADR-178 Phase 3 — Shift 축 고정)", () => {
  it("locks to horizontal when |dx| >= |dy|", () => {
    expect(applyAxisLock({ x: 100, y: 100 }, { x: 180, y: 130 })).toEqual({
      x: 180,
      y: 100,
    });
  });

  it("locks to vertical when |dy| > |dx|", () => {
    expect(applyAxisLock({ x: 100, y: 100 }, { x: 120, y: 190 })).toEqual({
      x: 100,
      y: 190,
    });
  });

  it("treats equal magnitudes as horizontal (>= 규칙)", () => {
    expect(applyAxisLock({ x: 0, y: 0 }, { x: -50, y: 50 })).toEqual({
      x: -50,
      y: 0,
    });
  });

  it("delta form mirrors the same rule", () => {
    expect(applyAxisLockToDelta(80, 30)).toEqual({ x: 80, y: 0 });
    expect(applyAxisLockToDelta(20, -90)).toEqual({ x: 0, y: -90 });
  });
});

describe("drag alt-clone arm flag", () => {
  afterEach(() => {
    armDragAltClone(false);
  });

  it("arms and disarms", () => {
    expect(isDragAltCloneArmed()).toBe(false);
    armDragAltClone(true);
    expect(isDragAltCloneArmed()).toBe(true);
    armDragAltClone(false);
    expect(isDragAltCloneArmed()).toBe(false);
  });
});
