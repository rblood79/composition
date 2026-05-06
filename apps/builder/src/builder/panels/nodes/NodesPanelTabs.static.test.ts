import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("NodesPanelTabs visible naming", () => {
  it("uses plural tab labels for page and frame management surfaces", async () => {
    const source = await readFile(
      resolve(__dirname, "NodesPanelTabs.tsx"),
      "utf-8",
    );

    expect(source).toContain('label: "Pages"');
    expect(source).toContain('label: "Frames"');
    expect(source).not.toContain('label: "Page"');
    expect(source).not.toContain('label: "Frame"');
  });
});
