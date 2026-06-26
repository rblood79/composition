import { memo, useCallback } from "react";
import { PropertySection } from "../../components";
import { PropertyIconPicker } from "../../components/property/PropertyIconPicker";
import { PropertyInput } from "../../components/property/PropertyInput";
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
 * Button 자식 목록에서 첫 비삭제 Text element 를 찾는다. icon Button 의 label 은 RSP 공식대로
 *   `<Text>` 자식 element 로 표현(`<Button><Icon/><Text>label</Text></Button>`). 프로퍼티
 *   Text 입력이 이 `<Text>` 자식을 편집하고, Icon 제거 시 이 자식 → string children 복구.
 */
export function findFirstTextChild<
  T extends { id: string; type: string; deleted?: boolean },
>(children: ReadonlyArray<T>): T | undefined {
  return children.find((child) => child.type === "Text" && !child.deleted);
}

/**
 * Button 자식으로 추가할 leaf element(Icon/Text)를 생성한다. handleAddElement 대신 직접
 *   생성하는 이유: handleAddElement 는 생성 직후 setSelectedElement 로 Button 선택을 풀어
 *   셀렉트가 사라진다. id 를 미리 만들어 selection 변경 없이 생성.
 */
function buildButtonChild(
  type: "Icon" | "Text",
  parentId: string,
  pageId: string,
  pageElements: Element[],
  propsOverride: Record<string, unknown>,
): Element {
  return withFrameElementMirrorId(
    {
      id: crypto.randomUUID(),
      type,
      customId: generateCustomId(type, pageElements),
      props: { ...getDefaultProps(type), ...propsOverride },
      page_id: pageId,
      parent_id: parentId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Element,
    null,
  );
}

/**
 * Button/ToggleButton 선택 시 Content 영역에 "Icon" 셀렉트(기본 None)를 노출한다.
 *   셀렉트 표시값 = Button 자식 중 첫 Icon element 의 iconName(없으면 None).
 *
 * RSP 공식 모델 (Button "With Icon and Label"): icon Button 은 label 을 `<Text>` 자식
 *   element 로 감싼다 — `<Button><Icon/><Text>label</Text></Button>`. plain Button 은
 *   string children(`<Button>Save</Button>`). 따라서:
 *   - None → 아이콘: Icon 자식 생성 + Button string children(label)을 `<Text>` 자식
 *     element 로 이관(Button.children 비움). 자식 순서 = Icon 먼저, Text 나중(RSP 순서).
 *   - 아이콘 → 다른 아이콘: 기존 자식 Icon 의 iconName 만 수정.
 *   - 아이콘 → None(clear): Icon 자식 삭제 + `<Text>` 자식의 텍스트를 Button string children
 *     으로 복구(Text element 삭제). plain Button=string 모델 회복.
 *   icon Button 일 때 노출되는 "Text" 입력은 `<Text>` 자식 element 의 children 을 편집한다
 *   (PropertiesPanel 이 GenericFieldRenderer 의 children "Text" 필드를 제외 → 중복 방지).
 *   다중 mutation 은 순차 await — 같은 tick 연속 호출 시 canonical sync stale snapshot
 *   race 로 일부 갱신 누락(state-management.md canonical sync 순서 race).
 *   ADR-142 정합: Button.binding 무수정, iconName prop 복원 0.
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
  const existingText = findFirstTextChild(children);
  const currentIconName =
    (existingIcon?.props as { iconName?: string } | undefined)?.iconName ??
    undefined;

  const buttonChildrenText =
    typeof (element?.props as { children?: unknown } | undefined)?.children ===
    "string"
      ? ((element!.props as { children?: string }).children as string)
      : undefined;

  const textChildValue =
    typeof (existingText?.props as { children?: unknown } | undefined)
      ?.children === "string"
      ? ((existingText!.props as { children?: string }).children as string)
      : "";

  const handleSelectIcon = useCallback(
    async (iconName: string) => {
      if (!iconName) return;

      // 아이콘 → 다른 아이콘: 기존 자식 Icon 의 iconName 만 수정.
      if (existingIcon) {
        await updateElementProps(existingIcon.id, { iconName });
        return;
      }

      // None → 아이콘: Icon 자식 생성 + (label 이 string children 으로 있으면) Text 자식
      //   element 로 이관. RSP 공식 `<Button><Icon/><Text>label</Text></Button>`.
      const doc = getActiveCanonicalDocument();
      if (!doc || !currentPageId) return;

      const pageElements: Element[] = [];
      visitCanonicalDocumentElements(doc, (el) => {
        pageElements.push(el);
      });

      // 자식 순서 = Icon 먼저, Text 나중(canonical children 추가 순서 = 렌더 순서, RSP 순서).
      const iconElement = buildButtonChild(
        "Icon",
        elementId,
        currentPageId,
        pageElements,
        { iconName }, // getDefaultProps("Icon") 의 random iconName override
      );
      addElement(iconElement);

      // string children(label) → Text 자식 element 이관. 이미 Text 자식이 있으면 중복
      //   생성하지 않는다(외부 경로로 만들어진 경우 보존).
      if (buttonChildrenText !== undefined && !existingText) {
        const textElement = buildButtonChild(
          "Text",
          elementId,
          currentPageId,
          [...pageElements, iconElement], // Icon 까지 포함해 customId 충돌 회피
          { children: buttonChildrenText },
        );
        addElement(textElement);
        // Button 의 string children 을 비운다(`<Text>` 자식이 label 을 보유).
        await updateElementProps(elementId, { children: "" });
      }
    },
    [
      existingIcon,
      existingText,
      buttonChildrenText,
      updateElementProps,
      currentPageId,
      elementId,
      addElement,
    ],
  );

  const handleClearIcon = useCallback(async () => {
    if (!existingIcon) return;

    // Icon 제거 → plain Button(string children) 모델 회복. `<Text>` 자식 element 가 있으면
    //   그 텍스트를 Button string children 으로 되돌리고 Text element 삭제.
    //   label 복구를 먼저 확정한 뒤 삭제(순차 await — canonical sync race 회피).
    if (existingText) {
      await updateElementProps(elementId, { children: textChildValue });
      await removeElement(existingText.id);
    }
    await removeElement(existingIcon.id);
  }, [
    existingIcon,
    existingText,
    textChildValue,
    removeElement,
    updateElementProps,
    elementId,
  ]);

  // icon Button 의 "Text" 입력: `<Text>` 자식 element 의 children 을 편집.
  const handleTextChange = useCallback(
    (value: string) => {
      if (!existingText) return;
      void updateElementProps(existingText.id, { children: value });
    },
    [existingText, updateElementProps],
  );

  if (!element || !BUTTON_CHILD_HOST_TAGS.has(element.type)) return null;

  return (
    <PropertySection title="Content" id="button-icon">
      <PropertyIconPicker
        label="Icon"
        value={currentIconName}
        onChange={handleSelectIcon}
        onClear={handleClearIcon}
      />
      {existingText ? (
        <PropertyInput
          label="Text"
          value={textChildValue}
          onChange={handleTextChange}
        />
      ) : null}
    </PropertySection>
  );
});
