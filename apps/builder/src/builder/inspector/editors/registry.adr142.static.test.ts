import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("ADR-142 primitive editor registry cutover", () => {
  it("routes catalog primitives to GenericPropertyEditor before legacy specRegistry lookup", async () => {
    const source = await readFile(resolve(__dirname, "registry.ts"), "utf-8");

    expect(source).toContain("getPrimitiveBinding");
    expect(source).toContain(
      "const primitiveBinding = getPrimitiveBinding(type)",
    );
    expect(source).toContain("componentType: primitiveBinding.tag");

    const primitiveIndex = source.indexOf(
      "const primitiveBinding = getPrimitiveBinding(type)",
    );
    const specIndex = source.indexOf(
      "const propertySpec = getPropertyEditorSpec(type)",
    );

    expect(primitiveIndex).toBeGreaterThan(-1);
    expect(specIndex).toBeGreaterThan(-1);
    expect(primitiveIndex).toBeLessThan(specIndex);
  });
});
