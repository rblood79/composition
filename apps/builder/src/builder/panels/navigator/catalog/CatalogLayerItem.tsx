import { memo } from "react";
import { TOGGLE_INDICATOR_OWNERS } from "@composition/shared";
import { Button } from "react-aria-components/Button";
import { Box, ChevronRight, GripVertical, Settings2 } from "lucide-react";
import type { CatalogLayerNode } from "../../../catalogRuntime/layerTree";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { ICON_EDIT_PROPS } from "../tree/helpers";
import { IndentGuides } from "../tree/LayerTree/IndentGuides";

const DeleteIcon = ACTION_ICONS.delete;

/**
 * ADR-248 Phase 4e-4: one Layers row (same markup and classes as the old row): indent guides,
 * expand chevron, name, drag handle and delete. The page body row is neither draggable nor
 * deletable; a library template row (inside an instance) is not draggable.
 */
export const CatalogLayerItem = memo(function CatalogLayerItem({
  node,
  isSelected,
  isExpanded,
  isFocusVisible,
  activeGuides,
  onDelete,
  onContextMenu,
}: {
  node: CatalogLayerNode;
  isSelected: boolean;
  isExpanded: boolean;
  isFocusVisible: boolean;
  activeGuides: readonly boolean[];
  onDelete: (node: CatalogLayerNode) => void;
  /** Right click: the Canvas element menu over this row (the old Layers row's `layer-item`). */
  onContextMenu?: (node: CatalogLayerNode, event: React.MouseEvent) => void;
}) {
  const { depth, hasChildren, name, body } = node;
  // A data row (a bound collection's projection) is neither draggable nor deletable.
  const fixed =
    body || node.projection === true || node.position.target.kind !== "node";
  return (
    <div
      className={`elementItem ${isSelected ? "active" : ""} ${
        isFocusVisible ? "focused" : ""
      }`}
      onContextMenu={(event) => onContextMenu?.(node, event)}
    >
      <IndentGuides depth={depth} activeGuides={activeGuides} />
      <div className="elementItemIcon">
        {hasChildren ? (
          <Button
            slot="chevron"
            className="layer-expand-button"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${name}`}
          >
            <ChevronRight
              color={ICON_EDIT_PROPS.color}
              strokeWidth={ICON_EDIT_PROPS.stroke}
              size={ICON_EDIT_PROPS.size}
              data-chevron="true"
            />
          </Button>
        ) : (
          <Box
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
            style={{ padding: "2px" }}
          />
        )}
      </div>
      <div className="elementItemLabel">
        {node.role && (
          <span
            className={`editing-semantics-dot editing-semantics-dot--${node.role}`}
            aria-label={node.role === "origin" ? "Origin" : "Instance"}
            title={node.role === "origin" ? "Origin" : "Instance"}
          />
        )}
        <span className="elementItemLabelText">{name}</span>
        {node.slot && (
          <span
            className="layer-slot-role"
            title={`Slot: ${node.slot}`}
            aria-label={`Slot ${node.slot}`}
          >
            {node.slot}
          </span>
        )}
      </div>
      <div className="elementItemActions">
        <Button
          slot="drag"
          className={`iconButton layer-drag-handle${
            fixed ? " layer-drag-handle--hidden" : ""
          }`}
          aria-label={`Drag ${name}`}
          aria-hidden={fixed}
          isDisabled={fixed}
        >
          <GripVertical
            color={ICON_EDIT_PROPS.color}
            strokeWidth={ICON_EDIT_PROPS.stroke}
            size={ICON_EDIT_PROPS.size}
          />
        </Button>
        {body && (
          <Button className="iconButton" aria-label="Settings">
            <Settings2
              color={ICON_EDIT_PROPS.color}
              strokeWidth={ICON_EDIT_PROPS.stroke}
              size={ICON_EDIT_PROPS.size}
            />
          </Button>
        )}
        {/* A toggle's indicator is the RAC toggle's own element — not removable (`removeTargets`). */}
        {!body &&
          !node.projection &&
          !TOGGLE_INDICATOR_OWNERS[node.typeName] && (
            <Button
              className="iconButton"
              aria-label={`Delete ${node.typeName}`}
              onPress={() => onDelete(node)}
            >
              <DeleteIcon
                color={ICON_EDIT_PROPS.color}
                strokeWidth={ICON_EDIT_PROPS.stroke}
                size={ICON_EDIT_PROPS.size}
              />
            </Button>
          )}
      </div>
    </div>
  );
});
