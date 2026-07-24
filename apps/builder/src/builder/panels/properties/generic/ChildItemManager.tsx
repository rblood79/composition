import { memo, useMemo, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ChildrenManagerField } from "@composition/specs";
import { useStore } from "../../../stores";
import { ElementUtils } from "../../../../utils/element/elementUtils";
import { generateCustomId } from "../../../utils/idGeneration";
import {
  useCanonicalPropertyChildren,
  useCanonicalPropertyElements,
} from "../hooks/useCanonicalPropertyRead";

import "../editors/styles/propertyEditors.css";
interface ChildItemManagerProps {
  elementId: string;
  field: ChildrenManagerField;
}

interface ChildItemPayload {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id: string;
  page_id: string;
  customId: string;
  created_at: string;
  updated_at: string;
}

export const ChildItemManager = memo(function ChildItemManager({
  elementId,
  field,
}: ChildItemManagerProps) {
  const childTag = field.childTag;
  const labelProp = field.labelProp ?? "children";

  const rawChildren = useCanonicalPropertyChildren(elementId);
  const canonicalPropertyElements = useCanonicalPropertyElements();
  const currentPageId = useStore((state) => state.currentPageId);
  const addElement = useStore((state) => state.addElement);
  const setSelectedElements = useStore((state) => state.setSelectedElements);
  const removeElements = useStore((state) => state.removeElements);

  const filteredChildren = useMemo(
    () => rawChildren.filter((child) => child.type === childTag),
    [rawChildren, childTag],
  );

  const handleAdd = useCallback(() => {
    const newElement: ChildItemPayload = {
      id: ElementUtils.generateId(),
      page_id: currentPageId || "1",
      type: childTag,
      props: {
        children: `${childTag} ${filteredChildren.length + 1}`,
        ...field.defaultChildProps,
        style: {},
        className: "",
      },
      parent_id: elementId,
      customId: generateCustomId(childTag, canonicalPropertyElements),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    void addElement(newElement);
  }, [
    elementId,
    childTag,
    field.defaultChildProps,
    filteredChildren.length,
    currentPageId,
    canonicalPropertyElements,
    addElement,
  ]);

  const handleSelect = useCallback(
    (childId: string) => {
      setSelectedElements([childId]);
    },
    [setSelectedElements],
  );

  const handleDelete = useCallback(
    (childId: string) => {
      void removeElements([childId]);
    },
    [removeElements],
  );

  return (
    <div className="children-manager">
      <div className="editor-overview">
        <p className="editor-overview-text">Total: {filteredChildren.length}</p>
      </div>

      {filteredChildren.length > 0 && (
        <div className="tabs-list">
          {filteredChildren.map((child, index) => (
            <div key={child.id} className="editor-list-item">
              <span className="editor-item-title">
                {String(
                  (child.props as Record<string, unknown>)[labelProp] ||
                    `${childTag} ${index + 1}`,
                )}
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  className="editor-item-action"
                  onClick={() => handleSelect(child.id)}
                >
                  Edit
                </button>
                <button
                  className="editor-item-action"
                  onClick={() => handleDelete(child.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="editor-actions">
        <button className="control-button control-button--add" onClick={handleAdd}>
          <Plus size={14} />
          Add {childTag}
        </button>
      </div>
    </div>
  );
});
