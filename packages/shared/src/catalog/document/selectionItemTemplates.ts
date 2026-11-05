import type { LibraryTemplateNode } from "./types";

/** S2 Menu/Picker/ComboBox: selection and icon share the label row; description is below it. */
export function selectionItemTemplates(
  templates: readonly LibraryTemplateNode[],
): readonly LibraryTemplateNode[] {
  const list = "lib:template:component-listbox-item-default";
  const menu = "lib:template:component-menu-item-default";
  const itemLayout = {
    display: "grid" as const,
    gridTemplateColumns: "auto auto minmax(0, 1fr) auto auto",
    alignItems: "center" as const,
    rowGap: "2px",
    columnGap: "0px",
  };
  const partLayout = (column: string, row = "1") => ({
    position: "static" as const,
    gridColumnStart: column,
    gridRowStart: row,
    gridRowEnd: "auto",
    alignSelf: "center" as const,
  });
  const parts = templates.filter((node) =>
    [list + "__selection", list + "__check"].includes(node.id),
  );
  const layoutOf = (id: string) => {
    if (id.endsWith("__selection") || id.endsWith("__check"))
      return { ...partLayout("1"), marginRight: "4px" };
    if (id.endsWith("__icon"))
      return { ...partLayout("2"), marginTop: "0px", marginRight: "4px" };
    if (id.endsWith("__label")) return partLayout("3");
    if (id.endsWith("__description")) return partLayout("3", "2");
    if (id.endsWith("__shortcut")) return partLayout("4");
    if (id.endsWith("__chevron")) return partLayout("5");
    return undefined;
  };
  return [
    ...templates,
    ...parts.map((node) => ({
      ...node,
      id: node.id.replace(list, menu) as LibraryTemplateNode["id"],
    })),
  ].map((node) => {
    if (node.id === menu)
      return {
        ...node,
        children: [
          menu + "__selection",
          menu + "__check",
          ...node.children,
        ] as LibraryTemplateNode["children"],
        layout: itemLayout,
      };
    if (/component-(select|combobox)__item-\d+$/.test(node.id))
      return {
        ...node,
        layout: itemLayout,
        visual: {},
        descendantPatches: [
          ...(node.descendantPatches ?? []).map((patch) => ({
            ...patch,
            layout: layoutOf(patch.templatePath.at(-1)!),
          })),
          ...["__selection", "__check"]
            .filter(
              (suffix) =>
                !node.descendantPatches?.some(
                  (patch) => patch.templatePath.at(-1) === list + suffix,
                ),
            )
            .map((suffix) => ({
              templatePath: [
                list,
                list + suffix,
              ] as LibraryTemplateNode["id"][],
              layout: layoutOf(list + suffix),
            })),
        ],
      };
    // Standalone ListBox keeps its original part layout. Picker instances carry
    // the shared grid placements as descendant patches.
    if (node.id === list + "__check") {
      const { showWhen: _showWhen, ...rest } = node;
      return rest;
    }
    if (node.id.startsWith(menu + "__")) {
      const { showWhen, ...rest } = node;
      return {
        ...rest,
        ...(node.id.endsWith("__check") ? {} : { showWhen }),
        layout: { ...node.layout, ...layoutOf(node.id) },
      };
    }
    return node;
  });
}
