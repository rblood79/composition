import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("AddPageDialog page/frame mirror adapter boundary", () => {
  it("uses frameMirror helpers instead of direct legacy field helpers", async () => {
    const source = await readFile(
      resolve(__dirname, "AddPageDialog.tsx"),
      "utf-8",
    );

    expect(source).not.toContain("legacyElementFields");
    expect(source).toContain('from "../../../adapters/canonical/frameMirror"');
    expect(source).toContain("getNullablePageFrameBindingId");
    expect(source).toContain("withPageFrameBinding");
  });

  it("does not pass page order_num through URL helper payloads", async () => {
    const source = await readFile(
      resolve(__dirname, "AddPageDialog.tsx"),
      "utf-8",
    );

    expect(source).not.toContain("order_num");
  });
});
