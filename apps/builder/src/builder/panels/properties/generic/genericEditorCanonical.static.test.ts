import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("generic property editors canonical read contract", () => {
  it("uses canonical element maps before legacy store fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "GenericPropertyEditor.tsx"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalPropertyElementsMap");
    expect(source).toContain("const element = elementsMap.get(elementId)");
    expect(source).toContain(
      "const parent = elementsMap.get(element.parent_id)",
    );
    expect(source).not.toContain("useStore.getState().elementsMap");
    expect(source).not.toContain("state.elementsMap.get(elementId)");
  });

  it("uses canonical property children before legacy children fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "ChildItemManager.tsx"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalPropertyChildren(elementId)");
    expect(source).toContain("useCanonicalPropertyElements()");
    expect(source).toContain(
      "generateCustomId(childTag, canonicalPropertyElements)",
    );
    expect(source).not.toContain("state.childrenMap.get(elementId)");
    expect(source).not.toContain(["types", "core", "store.types"].join("/"));
    expect(source).not.toContain(["useStore.getState()", "elements"].join("."));
  });

  it("uses canonical property element for generic items arrays", async () => {
    const source = await readFile(
      resolve(__dirname, "ItemsManager.tsx"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalPropertyElement(elementId)");
    expect(source).not.toContain("state.elementsMap.get(elementId)");
  });

  it("uses ADR-142 PropContract fields before legacy spec sections when a primitive binding exists", async () => {
    const source = await readFile(
      resolve(__dirname, "GenericPropertyEditor.tsx"),
      "utf-8",
    );

    expect(source).toContain("componentType?: string");
    expect(source).toContain("catalogContracts?: PropContractMap");
    expect(source).toContain("const editorType = componentType ?? spec?.name");
    expect(source).toContain("getPrimitiveBinding");
    expect(source).toContain("getPrimitiveBinding(editorType)");
    expect(source).toContain("buildInspectorFieldSections");
    expect(source).toContain("CatalogField");
    expect(source).toContain("primitiveBinding?.props.accepts");
    expect(source).toContain(
      "primitiveBinding?.props.accepts ?? catalogContracts",
    );
    expect(source).toContain("dataBinding");
    expect(source).toContain("onDataBindingUpdate");
    expect(source).toContain("!useCatalogSections && spec");
  });

  it("renders catalog binding contracts through x-composition dataBinding controls", async () => {
    const source = await readFile(
      resolve(__dirname, "CatalogField.tsx"),
      "utf-8",
    );

    expect(source).toContain("PropertyDataBinding");
    expect(source).toContain('case "binding"');
    expect(source).toContain("onDataBindingUpdate?.(value ?? undefined)");
    expect(source).toContain("[field.key]: undefined");
    expect(source).not.toContain('case "icon":\n    case "binding"');
  });
});
