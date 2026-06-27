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
import {
  buttonIconPx,
  buttonTextMetrics,
} from "../../utils/propagationRegistry";
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
export function buildButtonChild(
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

  // 부모 Button 의 현재 size — `<Text>` 자식 생성 시 상속 주입. Button size 변경 시 자식 Text
  //   size 동기화는 propagationRegistry buttonPropagationRules(size → Text)가 담당하지만, 전파는
  //   *변경* 시점에만 작동 → 생성 직후 초기값은 여기서 직접 주입(부모-자식 글자 크기 일관).
  const buttonSize = (element?.props as { size?: unknown } | undefined)?.size;

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
      //   Icon 은 buttonPropagationRules(size → Icon) 와 동일 3채널 주입:
      //   - size: 부모 Button size → data-size(DOM) 의미 정합(기본 md 고정 방지).
      //   - style.fontSize/height: buttonIconPx(부모 size) — 버튼 디자인 px(사용자 지정
      //     xs14/sm16/md18/lg24/xl28) 강제. Icon catalog size 별 px(16/18/24/36/48)와 다르므로
      //     data-size 만으론 정확 px 불가 → inline override. height 는 Icon.css [data-size] 의
      //     height(24px 등) 고정 차단용. buttonIconPx 가 전파 transform 과 단일 소스.
      const iconPx = buttonIconPx(buttonSize);
      const iconElement = buildButtonChild(
        "Icon",
        elementId,
        currentPageId,
        pageElements,
        // getDefaultProps("Icon") 의 random iconName override + 부모 size/px.
        typeof buttonSize === "string"
          ? {
              iconName,
              size: buttonSize,
              style: { fontSize: iconPx, height: iconPx },
            }
          : { iconName, style: { fontSize: iconPx, height: iconPx } },
      );
      addElement(iconElement);

      // string children(label) → Text 자식 element 이관. 이미 Text 자식이 있으면 중복
      //   생성하지 않는다(외부 경로로 만들어진 경우 보존).
      if (buttonChildrenText !== undefined && !existingText) {
        // label <Text> 의 시각 척도(fontSize/lineHeight)는 Button 텍스트 척도(md=text-sm 14/20)를
        //   inline 으로 받는다 — Text 컴포넌트 독립 타이포 척도(text-base 16/24)가 아니라 Button
        //   척도. label 은 버튼 텍스트라 height 가 leaf Button 과 동일해야 함(사용자 결정 2026-06-27:
        //   icon 유무 무관 md=30px). buttonTextMetrics 가 전파 transform 과 단일 소스. lineHeight 는
        //   "Npx" 문자열(parseLineHeight 배율 오해석 방지).
        //   size prop 은 부모 size 로 주입한다(2026-06-28 사용자 결정) — Icon 자식(size:buttonSize)과
        //   데이터 일관(형제 size 불일치 제거). 시각은 inline fontSize/lineHeight 가 specificity 로
        //   Text.css [data-size] 보다 우선이라 버튼 척도 유지(size prop 추가가 시각 안 바꿈).
        const tm = buttonTextMetrics(buttonSize);
        const textElement = buildButtonChild(
          "Text",
          elementId,
          currentPageId,
          [...pageElements, iconElement], // Icon 까지 포함해 customId 충돌 회피
          typeof buttonSize === "string"
            ? {
                children: buttonChildrenText,
                size: buttonSize,
                style: { fontSize: tm.fontSize, lineHeight: tm.lineHeight },
              }
            : {
                children: buttonChildrenText,
                style: { fontSize: tm.fontSize, lineHeight: tm.lineHeight },
              },
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
      buttonSize,
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
