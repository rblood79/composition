import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { openAdr296 } from "../../../preview/catalog/__tests__/support/adr296Harness";
import {
  catalogEditContract,
  catalogPropertiesPatchCommand,
} from "../editContract";
import { renderCatalogDom } from "../domBinding";

describe("ActionButton origin Property contract", () => {
  it.each([false, true])(
    "edits bound label/icon, reset and Undo (grouped=%s)",
    async (grouped) => {
      const h = await openAdr296();
      h.add(grouped ? "ActionButtonGroup" : "ActionButton");
      const root = h.workspace.root;
      const button = [...root.domInputs.values()].find(
        (n) => root.typeOf(n) === "ActionButton",
      )!;
      const target = h.workspace.positionOfRecord(button.id)!.target;
      const contract = () =>
        catalogEditContract(h.graph(), h.workspace.readModel, target);
      const content = contract().fields.filter(
        (f) => f.section === "content" && !f.editorHidden,
      );
      expect(content.map((f) => [f.key, f.kind])).toEqual([
        ["label", "string"],
        ["icon", "icon"],
      ]);
      const initialLabel = grouped ? "Copy" : "Action";
      const initialIcon = grouped ? "copy" : undefined;
      expect(content[0]!.currentValue).toBe(initialLabel);
      expect(content[1]!.currentValue).toBe(initialIcon);
      const patch = (values: Record<string, string | undefined>) => {
        const fields = contract().fields;
        const command = catalogPropertiesPatchCommand(
          h.graph(),
          [target],
          values,
          (key) => fields.find((f) => f.key === key)?.currentValue,
          new Set(),
        );
        expect(command).toBeDefined();
        h.run(command!);
      };
      const parts = () =>
        root.domInputs
          .get(button.id)!
          .children.map((id) => root.domInputs.get(id)!);
      const text = () => parts().find((n) => root.typeOf(n) === "Text")!;
      const icon = () => parts().find((n) => root.typeOf(n) === "Icon")!;
      const host = document.createElement("div");
      document.body.append(host);
      const reactRoot = createRoot(host);
      try {
        patch({ label: "Save action", icon: "star" });
        expect(text().props.children).toBe("Save action");
        expect(icon().props.iconName).toBe("star");
        expect(root.domInputs.get(button.id)!.props.children).toBeUndefined();
        await act(async () =>
          reactRoot.render(renderCatalogDom(root, button.id)),
        );
        expect(host.querySelector("button")!.textContent).toBe("Save action");
        patch({ label: undefined, icon: undefined });
        expect(text().props.children).toBe("Action");
        expect(icon().props.iconName).toBe("{icon}");
        h.workspace.undo();
        expect(text().props.children).toBe("Save action");
        expect(icon().props.iconName).toBe("star");
        h.workspace.undo();
        expect(text().props.children).toBe(initialLabel);
        patch({ label: "", icon: "star" });
        expect(text().hidden).toBe(true);
        expect(
          root.domInputs.get(button.id)!.derivedProps?._actionIconOnly,
        ).toBe(true);
      } finally {
        await act(async () => reactRoot.unmount());
        host.remove();
        h.workspace.dispose();
      }
    },
  );
});
