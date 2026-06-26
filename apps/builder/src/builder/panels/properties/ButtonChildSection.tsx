import { memo, useCallback } from "react";
import { PropertySection } from "../../components";
import { PropertyIconPicker } from "../../components/property/PropertyIconPicker";
import { useStore } from "../../stores";
import { getActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { visitCanonicalDocumentElements } from "../../stores/canonical/canonicalElementsView";
import {
  useCanonicalPropertyElement,
  useCanonicalPropertyChildren,
} from "./hooks/useCanonicalPropertyRead";
import { getDefaultProps } from "../../../types/builder/unified.types";
import { generateCustomId } from "../../utils/idGeneration";
import { withFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";
import type { Element } from "../../../types/builder/unified.types";

/**
 * Icon 셀렉트 host 태그 (leaf 버튼만). ToggleButtonGroup 은 자식이 ToggleButton
 *   (leaf 버튼)이라 Icon 자식 직접 대상 아님 → 제외. ADR-142: Button=RAC leaf,
 *   아이콘은 자식 element(RSP composite) — binding iconName 복원 0.
 */
export const BUTTON_CHILD_HOST_TAGS: ReadonlySet<string> = new Set([
  "Button",
  "ToggleButton",
]);

/**
 * Button 자식 목록에서 첫 비삭제 Icon element 를 찾는다. 셀렉트 표시값(현재 iconName)
 *   + none/생성/수정 분기 판정의 단일 소스. 자식 없으면 undefined → 셀렉트 "None".
 */
export function findFirstIconChild<
  T extends { id: string; type: string; deleted?: boolean },
>(children: ReadonlyArray<T>): T | undefined {
  return children.find((child) => child.type === "Icon" && !child.deleted);
}

/**
 * Button/ToggleButton 선택 시 Content 영역에 "Icon" 셀렉트(기본 None)를 노출한다.
 *   셀렉트 표시값 = Button 자식 중 첫 Icon element 의 iconName(없으면 None).
 *   - None → 아이콘: 자식 Icon element 생성(미리 만든 id + addElement 직접 호출,
 *     selection 변경 없음) + 선택 iconName 으로 override.
 *   - 아이콘 → 다른 아이콘: 기존 자식 Icon 의 iconName 만 updateElementProps.
 *   - 아이콘 → None(clear): 자식 Icon element removeElement.
 *   ADR-142 정합: Button.binding 무수정, iconName prop 복원 0. DOM=<Button><Icon/>text</Button>.
 */
export const ButtonChildSection = memo(function ButtonChildSection({
  elementId,
}: {
  elementId: string;
}) {
  const element = useCanonicalPropertyElement(elementId);
  const children = useCanonicalPropertyChildren(elementId);
  const addElement = useStore((state) => state.addElement);
  const updateElementProps = useStore((state) => state.updateElementProps);
  const removeElement = useStore((state) => state.removeElement);
  const currentPageId = useStore((state) => state.currentPageId);

  const existingIcon = findFirstIconChild(children);
  const currentIconName =
    (existingIcon?.props as { iconName?: string } | undefined)?.iconName ??
    undefined;

  const handleSelectIcon = useCallback(
    (iconName: string) => {
      if (!iconName) return;

      // 아이콘 → 다른 아이콘: 기존 자식 Icon 의 iconName 만 수정.
      if (existingIcon) {
        void updateElementProps(existingIcon.id, { iconName });
        return;
      }

      // None → 아이콘: 자식 Icon element 생성. handleAddElement 대신 직접 addElement —
      //   handleAddElement 는 생성 직후 setSelectedElement 로 Button 선택을 풀어
      //   셀렉트가 사라진다. id 를 미리 만들어 selection 변경 없이 생성.
      const doc = getActiveCanonicalDocument();
      if (!doc || !currentPageId) return;

      const pageElements: Element[] = [];
      visitCanonicalDocumentElements(doc, (el) => {
        pageElements.push(el);
      });

      const iconElement: Element = withFrameElementMirrorId(
        {
          id: crypto.randomUUID(),
          type: "Icon",
          customId: generateCustomId("Icon", pageElements),
          // getDefaultProps("Icon") 의 random iconName 을 사용자 선택값으로 override.
          props: { ...getDefaultProps("Icon"), iconName },
          page_id: currentPageId,
          parent_id: elementId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Element,
        null,
      );

      addElement(iconElement);
    },
    [existingIcon, updateElementProps, currentPageId, elementId, addElement],
  );

  const handleClearIcon = useCallback(() => {
    if (!existingIcon) return;
    void removeElement(existingIcon.id);
  }, [existingIcon, removeElement]);

  if (!element || !BUTTON_CHILD_HOST_TAGS.has(element.type)) return null;

  return (
    <PropertySection title="Content" id="button-icon">
      <PropertyIconPicker
        label="Icon"
        value={currentIconName}
        onChange={handleSelectIcon}
        onClear={handleClearIcon}
      />
    </PropertySection>
  );
});
