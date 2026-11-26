import { describe, expect, it } from "vitest";
import { executionModeOf, executionPolicyOfChoice } from "../executionPolicy";

/**
 * 사용자 결정 2026-11-26 — a collection with no execution policy loads when the app opens (`auto`);
 * 「Manual」 is a stored choice (the app waits for a rule's reload), not the absence of one.
 * Before: no policy = manual, and the panel's 「Manual」 removed the policy.
 */
describe("execution policy", () => {
  it("no policy reads as auto; a stored mode reads as itself", () => {
    expect(executionModeOf(undefined)).toBe("auto");
    expect(executionModeOf({ mode: "auto" })).toBe("auto");
    expect(executionModeOf({ mode: "manual" })).toBe("manual");
    expect(executionModeOf({ mode: "interval", intervalSec: 5 })).toBe(
      "interval",
    );
  });

  it("every panel choice is stored — manual too", () => {
    expect(executionPolicyOfChoice("manual")).toEqual({ mode: "manual" });
    expect(executionPolicyOfChoice("auto")).toEqual({ mode: "auto" });
    expect(executionPolicyOfChoice("interval")).toEqual({
      mode: "interval",
      intervalSec: 30,
    });
    expect(executionPolicyOfChoice("interval", 5)).toEqual({
      mode: "interval",
      intervalSec: 5,
    });
  });
});
