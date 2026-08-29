import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("NodesPanelTabs contract", () => {
  it("uses plural localized labels and React Aria tab primitives", async () => {
    const source = await readFile(
      resolve(__dirname, "NodesPanelTabs.tsx"),
      "utf-8",
    );

    expect(source).toContain('label: t("nodes.pages")');
    expect(source).toContain('label: t("nodes.frames")');
    expect(source).toContain("<TabList");
    expect(source).toContain("<Tab key={id} id={id}");
    expect(source).not.toContain('role="tab"');
    expect(source).not.toContain("aria-selected");
    expect(source).not.toContain("<button");
  });
});
