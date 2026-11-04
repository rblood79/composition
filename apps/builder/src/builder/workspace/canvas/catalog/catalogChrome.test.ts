import { describe, expect, it } from "vitest";
import { catalogSlotBand, SLOT_BAND_MAX } from "./catalogChrome";

describe("catalogSlotBand", () => {
  it("keeps a slot's own height and never exceeds SLOT_BAND_MAX scene px for an empty one", () => {
    expect(catalogSlotBand(30, 0.25)).toBe(30);
    expect(catalogSlotBand(0, 0.25)).toBe(SLOT_BAND_MAX);
    expect(catalogSlotBand(0, 2)).toBe(SLOT_BAND_MAX / 2);
  });
});
