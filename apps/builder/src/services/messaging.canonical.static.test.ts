import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("legacy messaging facade canonical contract", () => {
  it("does not expose full element snapshot update helpers", async () => {
    const legacyMessage = ["UPDATE", "ELEMENTS"].join("_");
    const serviceSource = await readFile(
      resolve(__dirname, "messaging.ts"),
      "utf-8",
    );
    const transportSource = await readFile(
      resolve(__dirname, "../utils/dom/iframeMessenger.ts"),
      "utf-8",
    );

    expect(serviceSource).not.toContain("updateElements(elements");
    expect(transportSource).not.toContain("updateElements(elements");
    expect(serviceSource).not.toContain(`sendMessage('${legacyMessage}'`);
    expect(transportSource).not.toContain(`sendMessage('${legacyMessage}'`);
  });
});
