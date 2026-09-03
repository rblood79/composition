import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as sharedPublic from "../../index";
import * as publicUtils from "../index";

describe("test-only collection migration public surface", () => {
  it("does not re-export migration helpers from the shared utils barrel", async () => {
    const source = await readFile(resolve(__dirname, "../index.ts"), "utf-8");

    expect(source).not.toContain('export * from "./migrateCollectionItems"');
    expect(source).not.toContain('from "./migrateSelectComboBoxItems"');
    expect("applyCollectionItemsMigration" in publicUtils).toBe(false);
    expect("applyCollectionItemsMigration" in sharedPublic).toBe(false);
    expect("applySelectComboBoxMigration" in publicUtils).toBe(false);
    expect("applySelectComboBoxMigration" in sharedPublic).toBe(false);
  });
});
