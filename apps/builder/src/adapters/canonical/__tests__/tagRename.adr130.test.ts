/**
 * ADR-130 Phase 7 — isLegacyGroupForFrameMigration guard.
 *
 * Gate G7:
 *  - legacy "Group" + customId "group_N" → migrated to frame
 *  - ARIA Group (customId 없음 또는 다른 prefix) → 보존
 */
import { describe, expect, it } from "vitest";
import { isLegacyGroupForFrameMigration } from "../tagRename";

describe("ADR-130 isLegacyGroupForFrameMigration", () => {
  it("matches Group + customId='group_N'", () => {
    expect(isLegacyGroupForFrameMigration("Group", "group_1")).toBe(true);
    expect(isLegacyGroupForFrameMigration("Group", "group_42")).toBe(true);
  });

  it("preserves RAC ARIA Group (no customId)", () => {
    expect(isLegacyGroupForFrameMigration("Group", undefined)).toBe(false);
    expect(isLegacyGroupForFrameMigration("Group", "")).toBe(false);
  });

  it("preserves Group with non-`group_` customId prefix", () => {
    expect(isLegacyGroupForFrameMigration("Group", "section_1")).toBe(false);
    expect(isLegacyGroupForFrameMigration("Group", "my-group")).toBe(false);
  });

  it("does not flag non-Group elements", () => {
    expect(isLegacyGroupForFrameMigration("Section", "group_1")).toBe(false);
    expect(isLegacyGroupForFrameMigration("frame", "group_1")).toBe(false);
    expect(isLegacyGroupForFrameMigration("Button", "group_1")).toBe(false);
  });
});
