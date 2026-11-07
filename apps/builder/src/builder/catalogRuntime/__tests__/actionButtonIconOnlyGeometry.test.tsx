import { expect, it } from "vitest";
import { openAdr280Preview } from "../../../preview/catalog/__tests__/support/adr280Harness";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogBoxModel } from "../../../../../../packages/shared/src/catalog/runtime/boxModel";

it("ActionBar clear keeps the icon-only CSS aspect ratio in the engine box", async () => {
  const h = await openAdr280Preview(["ActionBar"]);
  try {
    const root = h.workspace.root;
    const clear = [...root.canvasInputs.values()].find(
      (n) => root.typeOf(n) === "ActionButton" && n.props.slot === "clear",
    )!;
    expect(clear.derivedProps?._actionIconOnly).toBe(true);
    const bounds = root.getGeometry([clear.id]).get(clear.id)!;
    expect(bounds.width).toBeCloseTo(bounds.height, 2);
    expect(bounds.height).toBe(32);
    expect(catalogBoxModel(clear)).toHaveProperty("aspectRatio", 1);
  } finally {
    h.view.unmount();
    h.workspace.dispose();
  }
});

it.each(["XS", "S", "M", "L", "XL"])(
  "standalone icon-only ActionButton follows its %s control height",
  async (size) => {
    const h = await openAdr280Preview(["ActionButton"]);
    try {
      h.declare(h.ids[0]!, { label: "", icon: "x", size });
      const root = h.workspace.root;
      const button = [...root.canvasInputs.values()].find(
        (n) => root.typeOf(n) === "ActionButton",
      )!;
      const bounds = root.getGeometry([button.id]).get(button.id)!;
      expect(bounds.width).toBeCloseTo(bounds.height, 2);
      expect(bounds.height).toBe(
        Number(button.sizing.minHeight ?? button.visual.minHeight),
      );
    } finally {
      h.view.unmount();
      h.workspace.dispose();
    }
  },
);

it("icon-only keeps authored dimensions/padding and restores the catalog box on Undo", async () => {
  const h = await openAdr280Preview(["ActionButton"]);
  try {
    const id = h.ids[0]!;
    h.declare(id, { label: "", icon: "x" });
    const root = h.workspace.root;
    const button = [...root.canvasInputs.values()].find(
      (n) => root.typeOf(n) === "ActionButton",
    )!;
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        sizing: {
          width: { kind: "set", value: 64 },
          height: { kind: "set", value: 48 },
        },
        visual: {
          paddingX: { kind: "set", value: 4 },
          paddingLeft: { kind: "set", value: 7 },
        },
        label: "Edit icon-only dimensions",
      }),
    );
    h.flush();
    const bounds = root.getGeometry([button.id]).get(button.id)!;
    expect([bounds.width, bounds.height]).toEqual([64, 48]);
    expect(root.getLayoutInput(button.id)).toMatchObject({
      paddingLeft: "7px",
      paddingRight: "4px",
      paddingTop: "0px",
    });
    expect(h.element(id)!.style.paddingLeft).toBe("7px");
    expect(h.element(id)!.style.paddingRight).toBe("4px");
    h.workspace.undo();
    const restored = root.getGeometry([button.id]).get(button.id)!;
    expect([restored.width, restored.height]).toEqual([32, 32]);
    h.declare(id, { label: "Action" });
    expect(
      root.canvasInputs.get(button.id)!.derivedProps?._actionIconOnly,
    ).toBe(false);
    expect(root.getLayoutInput(button.id)?.aspectRatio).toBeUndefined();
    expect(root.getLayoutInput(button.id)?.paddingLeft).not.toBe("0px");
  } finally {
    h.view.unmount();
    h.workspace.dispose();
  }
});
