import { componentTypeSet } from "@composition/shared";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { catalogTypeDefinitionId } from "../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogReader,
  NodeEntry,
  NodeId,
  WriteValue,
} from "../../../../../packages/shared/src/catalog/document/types";

const HOST_TYPES: ReadonlySet<string> = componentTypeSet("buttonChildHost");

/** A Button / ToggleButton's Icon and Text children (RSP "With Icon and Label"). */
export interface CatalogButtonChildren {
  iconId?: NodeId;
  iconName?: string;
  textId?: NodeId;
  text?: string;
}

function ownedNode(reader: CatalogReader, id: string): NodeEntry | undefined {
  const entry = reader.getEntry(id);
  return entry?.kind === "node" ? entry : undefined;
}
function typeOf(reader: CatalogReader, node: NodeEntry): string {
  return definitionTypeName(reader, node.definitionId).toLowerCase();
}
function ownValue(node: NodeEntry, key: string): unknown {
  const write = node.props[key];
  return write?.kind === "set" ? write.value : undefined;
}

/** The node's Icon / Text children when it hosts them (an owned Button or ToggleButton). */
export function catalogButtonChildren(
  reader: CatalogReader,
  nodeId: NodeId,
): CatalogButtonChildren | undefined {
  const node = ownedNode(reader, nodeId);
  if (!node) return undefined;
  const type = definitionTypeName(reader, node.definitionId);
  if (
    ![...HOST_TYPES].some((host) => host.toLowerCase() === type.toLowerCase())
  )
    return undefined;
  const state: CatalogButtonChildren = {};
  for (const childId of node.children) {
    const child = ownedNode(reader, childId);
    if (!child) continue;
    const childType = typeOf(reader, child);
    if (childType === "icon" && !state.iconId) {
      state.iconId = child.id;
      const name = ownValue(child, "iconName");
      if (typeof name === "string") state.iconName = name;
    } else if (childType === "text" && !state.textId) {
      state.textId = child.id;
      const text = ownValue(child, "children");
      state.text = typeof text === "string" ? text : "";
    }
  }
  return state;
}

const set = (value: string): WriteValue<string> => ({ kind: "set", value });

/**
 * ADR-248 Phase 4e-4: the Button child commands — each one history step.
 * - an icon on a plain Button: an Icon child first, and the Button's own label moves into a Text
 *   child after it (`<Button><Icon/><Text>label</Text></Button>`); both take the Button's size.
 * - another icon: the Icon child's `iconName` only.
 * - clearing the icon: the Text child's label goes back to the Button, both children go.
 * - the label of an icon Button: the Text child's `children`.
 */
export const catalogButtonChildCommands = {
  setIcon:
    (nodeId: NodeId, iconName: string, newId: NewId): CatalogCommand =>
    (reader) => {
      const state = catalogButtonChildren(reader, nodeId);
      if (!state) throw new Error(`BUTTON_CHILD_HOST_REQUIRED:${nodeId}`);
      if (state.iconId)
        return setFields({
          targets: [{ kind: "node", id: state.iconId }],
          props: { iconName: set(iconName) },
          label: "Button icon",
        })(reader);
      const button = ownedNode(reader, nodeId)!;
      const size = ownValue(button, "size");
      const sized: Record<string, WriteValue<string>> = typeof size === "string"
        ? { size: set(size) }
        : {};
      const label = ownValue(button, "children");
      const icon: NodeEntry = {
        kind: "node",
        id: newId("node") as NodeId,
        definitionId: catalogTypeDefinitionId("Icon"),
        children: [],
        props: { iconName: set(iconName), ...sized },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      };
      const text: NodeEntry | undefined =
        typeof label === "string" && !state.textId
          ? {
              ...icon,
              id: newId("node") as NodeId,
              definitionId: catalogTypeDefinitionId("Text"),
              props: { children: set(label), ...sized },
            }
          : undefined;
      const insert = insertNodes({
        parent: { kind: "node", id: nodeId },
        index: 0,
        entries: text ? [icon, text] : [icon],
        rootIds: text ? [icon.id, text.id] : [icon.id],
        newId,
      })(reader);
      // The label patch comes after the insert's write of the Button (a key-level patch).
      const moveLabel = text
        ? setFields({
            targets: [{ kind: "node", id: nodeId }],
            props: { children: { kind: "remove" } },
          })(reader).ops
        : [];
      return { label: "Button icon", ops: [...insert.ops, ...moveLabel] };
    },
  clearIcon:
    (nodeId: NodeId): CatalogCommand =>
    (reader) => {
      const state = catalogButtonChildren(reader, nodeId);
      if (!state?.iconId) throw new Error(`BUTTON_ICON_REQUIRED:${nodeId}`);
      const remove = removeTargets({
        targets: [
          { kind: "node", id: state.iconId },
          ...(state.textId
            ? [{ kind: "node" as const, id: state.textId }]
            : []),
        ],
      })(reader);
      const restoreLabel = state.textId
        ? setFields({
            targets: [{ kind: "node", id: nodeId }],
            props: { children: set(state.text ?? "") },
          })(reader).ops
        : [];
      return {
        label: "Remove button icon",
        ops: [...remove.ops, ...restoreLabel],
      };
    },
  setText: (textId: NodeId, value: string): CatalogCommand =>
    setFields({
      targets: [{ kind: "node", id: textId }],
      props: { children: set(value) },
      label: "Button label",
    }),
};
