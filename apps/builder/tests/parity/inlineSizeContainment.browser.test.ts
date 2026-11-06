import { beforeAll, expect, it } from "vitest";
import { EngineLayout } from "@/builder/workspace/canvas/wasm-bindings/engine";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { catalogInlineSizeContainment } from "../../../../packages/shared/src/catalog/runtime/inlineSizeContainment";

beforeAll(async () => initEngineWasm());

for (const mode of ["block", "stretch", "hug", "longtext", "side"] as const) {
  it(`inline-size containment keeps the parent sizing contract: ${mode}`, () => {
    const host = document.createElement("div");
    host.style.cssText =
      "position:absolute;width:800px;font:14px/18px sans-serif;";
    const field = document.createElement("div");
    const value = document.createElement("div");
    const side = mode === "side";
    const hug = mode === "hug" || mode === "longtext" || side;
    const text =
      mode === "longtext" ? "A long value that wraps. ".repeat(20) : "Value";
    const parentStyle: Record<string, unknown> = {
      display: mode === "block" ? "block" : "flex",
      width: "800px",
      ...(mode === "stretch"
        ? { flexDirection: "column" }
        : { alignItems: "flex-start" }),
    };
    Object.assign(host.style, parentStyle);
    const fieldStyle: Record<string, unknown> = {
      display: "grid",
      gridTemplateColumns: side ? ["auto", "1fr"] : ["1fr"],
      ...(side ? { columnGap: "12px" } : {}),
    };
    field.style.cssText = `display:grid;grid-template-columns:${side ? "auto 1fr" : "1fr"};column-gap:${side ? 12 : 0}px;`;
    if (side) {
      const label = document.createElement("div");
      label.style.width = "40px";
      label.textContent = "Label";
      field.append(label);
    }
    const layout = { contain: "inline-size", containIntrinsicWidth: "208px" };
    Object.assign(value.style, layout);
    value.textContent = text;
    field.append(value);
    host.append(field);
    document.body.append(host);
    try {
      const used = value.getBoundingClientRect();
      const engine = new EngineLayout();
      const leaf = {
        style: {
          display: "block",
          contentHeight: used.height,
          ...catalogInlineSizeContainment(layout),
        },
        children: [],
      };
      const nodes = side
        ? [
            { style: { width: "40px", height: "18px" }, children: [] },
            leaf,
            { style: fieldStyle, children: [0, 1] },
            { style: parentStyle, children: [2] },
          ]
        : [
            leaf,
            { style: fieldStyle, children: [0] },
            { style: parentStyle, children: [1] },
          ];
      const handles = engine.buildTreeBatch(JSON.stringify(nodes));
      engine.computeLayout(handles.at(-1)!, 800, -1);
      const result = engine.getLayoutsBatch(handles);
      const valueBox = result.get(handles[side ? 1 : 0])!;
      const fieldBox = result.get(handles[side ? 2 : 1])!;
      expect(used.width).toBe(hug ? 208 : 800);
      expect(Math.abs(valueBox.width - used.width)).toBeLessThan(0.5);
      expect(
        Math.abs(fieldBox.width - field.getBoundingClientRect().width),
      ).toBeLessThan(0.5);
      expect(Math.abs(valueBox.height - used.height)).toBeLessThan(0.5);
      if (mode === "longtext") expect(used.height).toBeGreaterThan(18);
    } finally {
      host.remove();
    }
  });
}
