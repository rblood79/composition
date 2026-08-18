import { describe, expect, it } from "vitest";
import { formatBytes } from "./useMemoryStats";

describe("formatBytes", () => {
  it("formats empty and sub-byte chart ticks without an undefined unit", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(0.5)).toBe("0.5 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });

  it("keeps large values within the supported unit range", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 ** 4)).toBe("1 TB");
  });
});
