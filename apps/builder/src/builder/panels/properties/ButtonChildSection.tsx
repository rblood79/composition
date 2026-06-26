import { memo, useCallback } from "react";
import { Plus } from "lucide-react";
import { PropertySection, ActionIconButton } from "../../components";
import { useStore } from "../../stores";
import { useElementCreator } from "@/builder/hooks";
import { getActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { visitCanonicalDocumentElements } from "../../stores/canonical/canonicalElementsView";
import { useCanonicalPropertyElement } from "./hooks/useCanonicalPropertyRead";
import { iconProps } from "../../../utils/ui/uiConstants";
import type { Element } from "../../../types/builder/unified.types";

/**
 * Add Icon 대상 host 태그 (leaf 버튼만). ToggleButtonGroup 은 자식이 ToggleButton
 *   (leaf 버튼)이라 Icon 자식 직접 대상 아님 → 제외. ADR-142: Button=RAC leaf,
 *   아이콘은 자식 element(RSP composite) — binding iconName 복원 0.
 */
export const BUTTON_CHILD_HOST_TAGS: ReadonlySet<string> = new Set([
  "Button",
  "ToggleButton",
]);

/**
 * Button/ToggleButton 선택 시 "Add Icon" 진입점. 클릭 → Icon 자식 element 생성
 *   (resolveCreationParentId 가 선택 Button 을 부모로 parenting). 생성된 Icon 의
 *   iconName/색/크기 편집은 기존 Icon.binding content section 패턴(SelectIcon 동형).
 */
export const ButtonChildSection = memo(function ButtonChildSection({
  elementId,
}: {
  elementId: string;
}) {
  const element = useCanonicalPropertyElement(elementId);
  const addElement = useStore((state) => state.addElement);
  const currentPageId = useStore((state) => state.currentPageId);
  const selectedElementId = useStore((state) => state.selectedElementId);
  const { handleAddElement } = useElementCreator();

  const handleAddIcon = useCallback(async () => {
    const doc = getActiveCanonicalDocument();
    if (!doc || !currentPageId) return;

    const pageElements: Element[] = [];
    visitCanonicalDocumentElements(doc, (el) => {
      pageElements.push(el);
    });
    const filtered = pageElements.filter(
      (el) => !el.deleted && el.page_id === currentPageId,
    );

    await handleAddElement(
      "Icon",
      currentPageId,
      selectedElementId,
      filtered,
      addElement,
      null,
      doc,
    );
  }, [currentPageId, selectedElementId, addElement, handleAddElement]);

  if (!element || !BUTTON_CHILD_HOST_TAGS.has(element.type)) return null;

  return (
    <PropertySection title="Children" id="button-child">
      <ActionIconButton
        onPress={handleAddIcon}
        aria-label="Add Icon"
        tooltip="아이콘 자식 추가"
      >
        <Plus
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
      </ActionIconButton>
    </PropertySection>
  );
});
