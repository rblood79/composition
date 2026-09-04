import { Type } from "lucide-react";
import { memo, useCallback } from "react";
import type { CanonicalNode } from "@composition/shared";
import { PropertyIconPicker } from "../../components/property/PropertyIconPicker";
import { PropertyInput } from "../../components/property/PropertyInput";
import { readImmediateSelectionSnapshot, useStore } from "../../stores";
import { historyManager } from "../../stores/history";
import {
  getChildren,
  getNodeMap,
} from "../../stores/canonical/canonicalTraversalHelpers";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import {
  useCanonicalPropertyElement,
  useCanonicalPropertyChildren,
} from "./hooks/useCanonicalPropertyRead";
import { collectCanonicalCustomIdCandidates } from "../../../adapters/canonical/legacyMetadata";
import {
  requestOriginImpactApprovalIfNeeded,
  type OriginImpactApproval,
} from "../../stores/utils/elementUpdate";
import {
  buttonIconPx,
  buttonTextMetrics,
} from "../../utils/propagationRegistry";
import {
  BUTTON_CHILD_HOST_TAGS,
  buildButtonChild,
  findFirstIconChild,
  findFirstTextChild,
  type AddElementInput,
  type CustomIdElements,
} from "./buttonChildSectionUtils";

type ApprovedButtonChildMutation = {
  approval: OriginImpactApproval;
  documentVersion: number;
  elementId: string;
  pageId: string;
  projectId: string;
};

type ButtonChildMutationContext = ApprovedButtonChildMutation & {
  node: CanonicalNode;
};

function isPendingOriginImpactApproval(
  result: OriginImpactApproval | Promise<OriginImpactApproval | null>,
): result is Promise<OriginImpactApproval | null> {
  return (
    typeof (result as Promise<OriginImpactApproval | null>).then === "function"
  );
}

async function prepareButtonChildMutation(
  elementId: string,
): Promise<ApprovedButtonChildMutation | null> {
  const selection = readImmediateSelectionSnapshot();
  const canonical = useCanonicalDocumentStore.getState();
  if (
    selection.selectedElementId !== elementId ||
    !selection.currentPageId ||
    !canonical.currentProjectId ||
    !canonical.documents.has(canonical.currentProjectId)
  ) {
    return null;
  }

  const node = getNodeMap().get(elementId);
  if (!node) return null;

  const approvalResult = requestOriginImpactApprovalIfNeeded(node);
  const approval = isPendingOriginImpactApproval(approvalResult)
    ? await approvalResult
    : approvalResult;
  if (!approval) return null;

  return {
    approval,
    documentVersion: canonical.documentVersion,
    elementId,
    pageId: selection.currentPageId,
    projectId: canonical.currentProjectId,
  };
}

function resolveApprovedButtonChildMutation(
  approved: ApprovedButtonChildMutation,
): ButtonChildMutationContext | null {
  // await가 끝난 handler stack에서 즉시 검증한다. 이 함수 반환부터 transaction
  // commit까지 다시 await하지 않으므로 selection/document mutation이 끼어들 수 없다.
  const latestSelection = readImmediateSelectionSnapshot();
  const latestCanonical = useCanonicalDocumentStore.getState();
  if (
    latestSelection.selectedElementId !== approved.elementId ||
    latestSelection.currentPageId !== approved.pageId ||
    latestCanonical.currentProjectId !== approved.projectId ||
    latestCanonical.documentVersion !== approved.documentVersion
  ) {
    return null;
  }

  const latestNode = getNodeMap().get(approved.elementId);
  if (!latestNode) return null;
  return {
    ...approved,
    node: latestNode,
  };
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
 *   다중 mutation(생성 2 + props 비우기 / 복구 1 + 삭제 2)은 **동기 history 트랜잭션
 *   창**으로 감싼다 — 사용자에겐 셀렉트 1회 조작이라 되돌리기도 1회여야 한다. 창 안에서는
 *   await 하지 않고(양보 시 무관한 mutation 병합) promise 를 창 밖에서 기다린다. 연속
 *   호출의 canonical 정합은 세 action 이 모두 canonical 1차 → set 순서라 보장된다
 *   (state-management.md HC #2).
 *   ADR-142 정합: Button.binding 무수정, iconName prop 복원 0.
 */
/**
 * 섹션 wrapper 없이 **필드만** 반환한다 — `GenericFieldRenderer` 의 catalog "Content"
 * 그룹 안으로 주입되기 때문(`contentExtras`). 자체 `PropertySection title="Content"` 을
 * 두면 catalog Content 와 같은 제목 섹션이 2개 뜬다 (2026-08-29 사용자 지적).
 */
export const ButtonChildFields = memo(function ButtonChildFields({
  elementId,
}: {
  elementId: string;
}) {
  const element = useCanonicalPropertyElement(elementId);
  const children = useCanonicalPropertyChildren(elementId);
  const addElement = useStore((state) => state.addElement);
  const updateElementProps = useStore((state) => state.updateElementProps);
  const removeElement = useStore((state) => state.removeElement);

  const existingIcon = findFirstIconChild(children);
  const existingText = findFirstTextChild(children);
  const currentIconName =
    (existingIcon?.props as { iconName?: string } | undefined)?.iconName ??
    undefined;

  const textChildValue =
    typeof (existingText?.props as { children?: unknown } | undefined)
      ?.children === "string"
      ? ((existingText!.props as { children?: string }).children as string)
      : "";

  const handleSelectIcon = useCallback(
    async (iconName: string) => {
      if (!iconName) return;

      // origin impact 승인을 모든 mutation 전에 끝내고, dialog 대기 뒤 최신
      // selection/page/document가 동일할 때만 fresh canonical node로 진행한다.
      const approved = await prepareButtonChildMutation(elementId);
      const context = approved
        ? resolveApprovedButtonChildMutation(approved)
        : null;
      if (!context) return;
      const currentChildren = getChildren(context.node);
      const currentExistingIcon = findFirstIconChild(currentChildren);
      const currentExistingText = findFirstTextChild(currentChildren);

      // 아이콘 → 다른 아이콘: 기존 자식 Icon 의 iconName 만 수정 (write 1개 —
      //   되돌리기 단위가 이미 1개라 트랜잭션 불요).
      if (currentExistingIcon) {
        return updateElementProps(currentExistingIcon.id, { iconName });
      }

      // None → 아이콘: Icon 자식 생성 + (label 이 string children 으로 있으면) Text 자식
      //   element 로 이관. RSP 공식 `<Button><Icon/><Text>label</Text></Button>`.
      const pageElements: CustomIdElements = collectCanonicalCustomIdCandidates(
        getNodeMap().values(),
      );

      const buttonChildrenText =
        typeof context.node.props?.children === "string"
          ? context.node.props.children
          : undefined;
      // 부모 Button 의 latest size — dialog 대기 중 stale closure를 쓰지 않는다.
      const buttonSize = context.node.props?.size;

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
        context.pageId,
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

      // string children(label) → Text 자식 element 이관. 이미 Text 자식이 있으면 중복
      //   생성하지 않는다(외부 경로로 만들어진 경우 보존).
      let textElement: AddElementInput | null = null;
      if (buttonChildrenText !== undefined && !currentExistingText) {
        // label <Text> 의 시각 척도(fontSize/lineHeight)는 Button 텍스트 척도(md=text-sm 14/20)를
        //   inline 으로 받는다 — Text 컴포넌트 독립 타이포 척도(text-base 16/24)가 아니라 Button
        //   척도. label 은 버튼 텍스트라 height 가 leaf Button 과 동일해야 함(사용자 결정 2026-06-27:
        //   icon 유무 무관 md=30px). buttonTextMetrics 가 전파 transform 과 단일 소스. lineHeight 는
        //   "Npx" 문자열(parseLineHeight 배율 오해석 방지).
        //   size prop 은 부모 size 로 주입한다(2026-06-28 사용자 결정) — Icon 자식(size:buttonSize)과
        //   데이터 일관(형제 size 불일치 제거). 시각은 inline fontSize/lineHeight 가 specificity 로
        //   Text.css [data-size] 보다 우선이라 버튼 척도 유지(size prop 추가가 시각 안 바꿈).
        const tm = buttonTextMetrics(buttonSize);
        textElement = buildButtonChild(
          "Text",
          elementId,
          context.pageId,
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
      }

      // history 트랜잭션 창 (동기 블록 — 안에서 await 금지). Icon 생성 + label 이관 +
      //   Button children 비우기는 사용자에겐 셀렉트 1회 선택이므로 되돌리기도 1회여야
      //   한다. 창 안에서 양보하면 그 틈의 무관한 mutation 이 같은 엔트리로 병합되므로
      //   (history.ts beginTransaction 주석) store action 을 await 하지 않고 promise 만
      //   모아 창 밖에서 기다린다 — 각 action 은 history 기록·메모리 반영까지 동기로
      //   도달한다 (mutationHistorySyncContract.test.ts).
      const pendingWrites = historyManager.runInTransaction(
        { type: "batch", elementId },
        (): Promise<unknown>[] => {
          const writes: Promise<unknown>[] = [addElement(iconElement)];
          if (textElement) {
            writes.push(addElement(textElement));
            // Button 의 string children 을 비운다(`<Text>` 자식이 label 을 보유).
            writes.push(
              updateElementProps(
                elementId,
                { children: "" },
                { originImpactApproval: context.approval },
              ),
            );
          }
          return writes;
        },
      );
      await Promise.all(pendingWrites);
    },
    [updateElementProps, elementId, addElement],
  );

  const handleClearIcon = useCallback(async () => {
    const approved = await prepareButtonChildMutation(elementId);
    const context = approved
      ? resolveApprovedButtonChildMutation(approved)
      : null;
    if (!context) return;
    const currentChildren = getChildren(context.node);
    const currentExistingIcon = findFirstIconChild(currentChildren);
    const currentExistingText = findFirstTextChild(currentChildren);
    if (!currentExistingIcon) return;
    const currentTextValue =
      typeof currentExistingText?.props?.children === "string"
        ? currentExistingText.props.children
        : "";

    // Icon 제거 → plain Button(string children) 모델 회복. `<Text>` 자식 element 가 있으면
    //   그 텍스트를 Button string children 으로 되돌리고 Text element 삭제.
    //
    // 순서: label 복구를 먼저 확정한 뒤 삭제. 동기 창 안의 연속 호출이므로 각 write 의
    //   canonical 갱신이 다음 write 가 읽기 전에 끝난다 (세 action 모두 canonical 1차 →
    //   set 순서 — state-management.md HC #2). 창 안에서 await 하면 그 틈의 무관한
    //   mutation 이 같은 되돌리기 엔트리로 병합되므로 promise 는 창 밖에서 기다린다.
    const pendingWrites = historyManager.runInTransaction(
      { type: "batch", elementId },
      (): Promise<unknown>[] => {
        const writes: Promise<unknown>[] = [];
        if (currentExistingText) {
          writes.push(
            updateElementProps(
              elementId,
              { children: currentTextValue },
              { originImpactApproval: context.approval },
            ),
          );
          writes.push(removeElement(currentExistingText.id));
        }
        writes.push(removeElement(currentExistingIcon.id));
        return writes;
      },
    );
    await Promise.all(pendingWrites);
  }, [elementId, removeElement, updateElementProps]);

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
    <>
      <PropertyIconPicker
        label="Icon"
        value={currentIconName}
        onChange={handleSelectIcon}
        onClear={handleClearIcon}
      />
      {existingText ? (
        <PropertyInput
          icon={Type}
          label="Text"
          value={textChildValue}
          onChange={handleTextChange}
        />
      ) : null}
    </>
  );
});
