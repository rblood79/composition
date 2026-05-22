import { memo, useCallback, useMemo } from "react";
import { SquarePlus, Trash2 } from "lucide-react";
import { useStore } from "../../../stores";
import {
  useCanonicalPropertyChildrenMap,
  useCanonicalPropertyElementsMap,
} from "../hooks/useCanonicalPropertyRead";
import { ElementUtils } from "../../../../utils/element/elementUtils";
import { iconProps } from "../../../../utils/ui/uiConstants";
import type { Element } from "../../../../types/core/store.types";
import type { PanelNode } from "../../panelNode";

/**
 * ADR-144 Phase 7 Wave C — mode 2 (resolved-tree composite) 의 slot 추가/삭제 UI.
 *
 * 4 family PropertyEditor (Select / ComboBox / ListBox / Menu) 가 공유한다.
 * `detectInspectorInputMode` 가 `"resolved-tree"` 를 반환한 instance / origin 의
 * containerOrigin 자식 ref 리스트를 시각화하고, Add / Remove 동작을 canonical
 * children[] mutation 으로 위임한다 (Memory→Index→History→DB→Preview→Rebalance
 * 순서는 `addElement` / `removeElement` 액션 내부 contract 가 보존).
 *
 * 책임:
 *   - elementId 가 reusable origin (master) 이면 그 자체를 containerOrigin 으로 사용
 *   - elementId 가 ref instance 이면 `masterId` 로 containerOrigin 조회
 *   - containerOrigin.slot[0] 의 itemOrigin + itemOrigin 첫 Text 자식을 label master 로 사용
 *   - Add: itemOrigin 의 새 ref instance 를 containerOrigin 의 자식으로 추가, descendants
 *     에 default label text 주입
 *   - Remove: 클릭한 ref instance 만 삭제
 *
 * 비-책임 (의도적):
 *   - 시각 prop 편집 — 호출 측 PropertyEditor 가 GenericPropertyEditor 를 동시 표시
 *   - dataBinding picker — mode 1 분기 책임
 *   - legacy `props.items[]` 편집 — mode 3 ItemsManager 책임
 */
export interface ResolvedTreeSlotEditorProps {
  elementId: string;
}

type RefItem = {
  refId: string;
  label: string;
};

function getLabelTextFromDescendants(
  ref: PanelNode,
  itemLabelId: string,
): string | null {
  const descendants = (ref as { descendants?: Record<string, unknown> })
    .descendants;
  if (!descendants) return null;
  const entry = descendants[itemLabelId] as
    | { text?: unknown }
    | null
    | undefined;
  if (!entry || typeof entry.text !== "string") return null;
  return entry.text;
}

const ResolvedTreeSlotEditor = memo(function ResolvedTreeSlotEditor({
  elementId,
}: ResolvedTreeSlotEditorProps) {
  const addElement = useStore((state) => state.addElement);
  const removeElement = useStore((state) => state.removeElement);
  const elementsMap = useCanonicalPropertyElementsMap();
  const childrenMap = useCanonicalPropertyChildrenMap();

  const composite = useMemo(() => {
    const element = elementsMap.get(elementId);
    if (!element) return null;

    const containerOriginId =
      element.componentRole === "master"
        ? element.id
        : (element as { masterId?: string }).masterId;
    if (!containerOriginId) return null;

    const containerOrigin = elementsMap.get(containerOriginId);
    if (!containerOrigin) return null;

    const slot = (containerOrigin as { slot?: string[] }).slot;
    if (!Array.isArray(slot) || slot.length === 0) return null;

    const itemOriginId = slot[0];
    const itemOrigin = elementsMap.get(itemOriginId);
    if (!itemOrigin) return null;

    const itemOriginChildren = childrenMap.get(itemOriginId) ?? [];
    const itemLabel =
      itemOriginChildren.find((c) => c.type === "Text") ??
      itemOriginChildren[0];

    const refChildren = childrenMap.get(containerOriginId) ?? [];
    const refs: RefItem[] = [];
    for (const child of refChildren) {
      if (child.componentRole !== "instance") continue;
      const labelText = itemLabel
        ? (getLabelTextFromDescendants(child, itemLabel.id) ??
          (itemLabel.props as { text?: unknown })?.text)
        : null;
      refs.push({
        refId: child.id,
        label: typeof labelText === "string" ? labelText : "Item",
      });
    }

    return {
      containerOrigin,
      itemOriginId,
      itemOriginType: itemOrigin.type,
      itemLabelId: itemLabel?.id ?? null,
      refs,
    };
  }, [childrenMap, elementId, elementsMap]);

  const onAdd = useCallback(async () => {
    if (!composite) return;
    const { containerOrigin, itemOriginId, itemOriginType, itemLabelId, refs } =
      composite;
    const newRefId = ElementUtils.generateId();
    const nextIndex = refs.length + 1;
    const defaultText = `Item ${nextIndex}`;
    const descendants =
      itemLabelId !== null
        ? { [itemLabelId]: { text: defaultText } }
        : undefined;

    const payload = {
      id: newRefId,
      page_id: null,
      type: itemOriginType,
      props: {},
      parent_id: containerOrigin.id,
      ref: itemOriginId,
      componentRole: "instance",
      masterId: itemOriginId,
      ...(descendants ? { descendants } : {}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Element;

    try {
      await addElement(payload);
    } catch (err) {
      console.error("[ResolvedTreeSlotEditor] addElement failed", err);
    }
  }, [addElement, composite]);

  const onRemove = useCallback(
    async (refId: string) => {
      try {
        await removeElement(refId);
      } catch (err) {
        console.error("[ResolvedTreeSlotEditor] removeElement failed", err);
      }
    },
    [removeElement],
  );

  if (!composite) return null;

  return (
    <div className="properties-aria" data-resolved-tree-slot-editor="true">
      <legend className="fieldset-legend">Slot items</legend>

      <div className="tab-overview">
        <p className="tab-overview-text">
          Total items: {composite.refs.length}
        </p>
        <p className="section-overview-help">
          💡 Items are stored as canonical `descendants` overrides on each ref
          instance.
        </p>
      </div>

      {composite.refs.length > 0 && (
        <div className="react-aria-ListBox">
          {composite.refs.map((ref) => (
            <div key={ref.refId} className="react-aria-ListBoxItem">
              <span className="tab-title">{ref.label}</span>
              <button
                className="tab-edit-button"
                type="button"
                aria-label={`Remove ${ref.label}`}
                onClick={() => onRemove(ref.refId)}
              >
                <Trash2
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                  size={iconProps.size}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="tab-actions">
        <button type="button" className="control-button add" onClick={onAdd}>
          <SquarePlus
            color={iconProps.color}
            strokeWidth={iconProps.strokeWidth}
            size={iconProps.size}
          />
          Add item
        </button>
      </div>
    </div>
  );
});

export default ResolvedTreeSlotEditor;
