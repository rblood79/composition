// @vitest-environment node
import { describe, expect, it } from "vitest";
import { compileRequest } from "./compile";
import { validateProgram, type CommandManifest } from "./manifest";
const manifest: CommandManifest = {
  components: [
    {
      type: "Button",
      label: "Button",
      placeable: true,
      creationMode: "leaf",
      props: [],
    },
  ],
  commands: [],
};
const context = {
  parentId: "body",
  selectedId: null,
  nodes: [{ id: "body", type: "body" }],
};
describe("ADR-202 host-neutral core", () => {
  it("DOM/Electron/provider mock 없이 compile과 validation이 동작한다", () => {
    expect(typeof window).toBe("undefined");
    const result = compileRequest("버튼 생성해", manifest, context);
    expect(result.route).toBe("direct");
    if (result.route === "direct")
      expect(validateProgram(result.program, manifest, context).ok).toBe(true);
  });
});
