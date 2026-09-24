import React from "react";
import {
  Tree,
  TreeItem,
  TagGroup,
  Tag,
  ToggleButtonGroup,
  ToggleButton,
  MenuButton,
  MenuItem,
  Toolbar,
} from "../components/list";
// chip leading icon glyph (2026-08-21) — 고정 14px, 수동 TagGroup.css `.tag-leading-icon` 소비.
import { resolveSelectionBehavior } from "../components/selectionStyle";
import {
  resolveBindingSelectionMode,
  resolveBindingSelectionStyle,
} from "../catalog/bindings";
import {
  MenuSection as AriaMenuSection,
  type MenuItemRenderProps,
} from "react-aria-components/Menu";
import { Header as AriaMenuHeader } from "react-aria-components/Header";
import { Separator as AriaMenuSeparator } from "react-aria-components/Separator";
import { DataField } from "../components/Field";
import type {
  PreviewElement,
  RenderContext,
  ColumnMapping,
  DataBinding,
} from "../types";
import type {
  StoredMenuItem,
  StoredMenuEntry,
  RuntimeMenuItem,
  StoredTagItem,
} from "@composition/specs";
import {
  resolveTextSourceText,
  isMenuSectionEntry,
  isMenuSeparatorEntry,
} from "@composition/specs";
import { getSelectedChildIds } from "./selection";
import { getElementDataBinding } from "../utils/compositionExtensionFields";
// ADR-148 Phase 4 — MenuItem slot 구성 소비 (origin slot 자식의 존재 gating / 스타일 overlay).
import {
  getSlotRole,
  resolveSlotComposition,
  resolveSectionItemKey,
  resolveStaticItemKey,
  resolveTreeItemKey,
  type TreeItemKeyNode,
} from "../catalog/slotRoles";
import type { TreeItemRenderProps } from "react-aria-components/Tree";
import { renderMenuItemSlotParts } from "../components/Menu";

/**
 * Stored → Runtime 변환.
 *
 * ADR-158 Phase 4 후속 (2026-08-17): `onActionId → onAction` 파생은 제거 —
 * event-id 채널이 실행 경로 없는 dead seam 이었다 (`resolveActionId` 상시
 * undefined). 항목 링크는 `href` 가 정식 경로.
 */
function toRuntimeMenuItem(item: StoredMenuItem): RuntimeMenuItem {
  return {
    ...item,
    children: item.children?.map((c) => toRuntimeMenuItem(c)),
  };
}

/**
 * Collection 관련 컴포넌트 렌더러
 * - Tree, TreeItem
 * - TagGroup, Tag
 * - ToggleButtonGroup, ToggleButton
 * - Menu, Toolbar
 */

/** srcdoc iframe에서 origin이 'null'이 되므로 '*' fallback */
function getTargetOrigin(): string {
  const origin = window.location.origin;
  if (!origin || origin === "null") return "*";
  return origin;
}

/**
 * Tree 렌더링
 */
import { invokeCustomEventHandler } from "./utils/customEventHandler";
export const renderTree = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  const treeItemChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "TreeItem");

  // ADR-239 Phase 1 — 항목 RAC key = `resolveTreeItemKey` (부모 TreeItem 이 instance 면 부모 key 접두 — Canvas 선택 ·
  //   펼침 판정과 같은 함수). instance 판정 = 해석 노드의 `_resolvedFrom`.
  const parentItemOf = new Map<string, PreviewElement>();
  const isTreeItemInstance = (item: PreviewElement) =>
    typeof item._resolvedFrom === "string" && item._resolvedFrom !== "";
  const treeItemKey = (item: PreviewElement) =>
    resolveTreeItemKey(
      item as unknown as TreeItemKeyNode & PreviewElement,
      (node) => parentItemOf.get(node.id),
      isTreeItemInstance,
    );

  const renderTreeItemsRecursively = (
    items: PreviewElement[],
  ): React.ReactNode => {
    return items.map((item) => {
      const itemChildren = context.childrenByParent.get(item.id) ?? [];
      const childTreeItems = itemChildren.filter(
        (child) => child.type === "TreeItem",
      );
      const otherChildren = itemChildren.filter(
        (child) => child.type !== "TreeItem",
      );
      for (const child of childTreeItems) parentItemOf.set(child.id, item);

      // ADR-923 r15m1 — 텍스트 원천은 타입별 계약 (TreeItem 은 기본 군 `children`; factory 가 쓰는
      //   키). 종전 `title || label || value || children` 은 production writer 가 없는 키를 Preview
      //   만 읽어 Skia (`children`) 와 갈렸다.
      //   r18m1 — 기본 글자 없음 (Skia 는 계약 결과가 "" 면 text 를 안 그린다).
      //   ADR-239 — 역할 자식 (Label Text) 이 있으면 행 글자는 그 자식이 그린다 (TreeItem 은 title 을 비운다).
      const displayTitle =
        otherChildren.length > 0
          ? ""
          : resolveTextSourceText("TreeItem", item.props);
      const labelChild = otherChildren.find((child) => child.type === "Text");
      const labelText = labelChild
        ? resolveTextSourceText("Text", labelChild.props)
        : displayTitle;

      const hasChildren = childTreeItems.length > 0;
      const itemProps = item.props as Record<string, unknown>;

      return (
        <TreeItem
          key={item.id}
          data-element-id={item.id}
          id={treeItemKey(item)}
          title={displayTitle}
          textValue={labelText}
          hasChildren={hasChildren}
          showInfoButton={false}
          isDisabled={itemProps.isDisabled === true}
          // ADR-239 — 상태 변형 층 (unselected · 상호작용 · disabled) 을 RAC render props 로 겹친다 (MenuItem 선례).
          style={
            item.stateStyle
              ? (renderProps: TreeItemRenderProps) =>
                  item.stateStyle!(
                    renderProps as unknown as Record<string, unknown>,
                    item.props.style as React.CSSProperties | undefined,
                  ) as React.CSSProperties
              : item.props.style
          }
          className={item.props.className}
          children={otherChildren.map((child) => context.renderElement(child))}
          childItems={
            hasChildren ? renderTreeItemsRecursively(childTreeItems) : undefined
          }
        />
      );
    });
  };

  return (
    <Tree
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      dataBinding={getElementDataBinding(element) as DataBinding | undefined}
      style={element.props.style}
      className={element.props.className}
      aria-label={String(
        element.props["aria-label"] || element.props.label || "Tree",
      )}
      selectionMode={
        (element.props.selectionMode as "none" | "single" | "multiple") ??
        resolveBindingSelectionMode("Tree", "single")
      }
      disallowEmptySelection={Boolean(element.props.disallowEmptySelection)}
      // selectionStyle(RSP, 패널 표면) → selectionBehavior(RAC) — shared helper 단일 소스.
      //   fallback 이 `"replace"` 인 것은 Tree 가 오래 이 값으로 렌더돼 체크박스 없는 상태가
      //   실질 기본이었기 때문 — 무지정 문서의 시각을 보존한다(GridList 는 "toggle").
      selectionBehavior={resolveSelectionBehavior({
        selectionStyle:
          element.props.selectionStyle ?? resolveBindingSelectionStyle("Tree"),
        selectionBehavior: element.props.selectionBehavior,
        fallback: "replace",
      })}
      expandedKeys={
        Array.isArray(element.props.expandedKeys)
          ? (element.props.expandedKeys as unknown as string[])
          : []
      }
      defaultExpandedKeys={
        Array.isArray(element.props.defaultExpandedKeys)
          ? (element.props.defaultExpandedKeys as unknown as string[])
          : []
      }
      selectedKeys={
        Array.isArray(element.props.selectedKeys)
          ? (element.props.selectedKeys as unknown as string[])
          : []
      }
      defaultSelectedKeys={
        Array.isArray(element.props.defaultSelectedKeys)
          ? (element.props.defaultSelectedKeys as unknown as string[])
          : []
      }
      onSelectionChange={(selectedKeys) => {
        const updatedProps = {
          ...element.props,
          selectedKeys: Array.from(selectedKeys),
        };
        updateElementProps(element.id, updatedProps);
        // ADR-158 규칙 · ADR-214 암묵 상태 미러
        invokeCustomEventHandler(
          context,
          element,
          "onSelectionChange",
          selectedKeys,
        );
      }}
      onExpandedChange={(expandedKeys) => {
        const updatedProps = {
          ...element.props,
          expandedKeys: Array.from(expandedKeys),
        };
        updateElementProps(element.id, updatedProps);
        invokeCustomEventHandler(
          context,
          element,
          "onExpandedChange",
          expandedKeys,
        );
      }}
    >
      {renderTreeItemsRecursively(treeItemChildren)}
    </Tree>
  );
};

/**
 * TreeItem 렌더링 (독립적으로 렌더링될 때)
 */
export const renderTreeItem = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const ownChildren = context.childrenByParent.get(element.id) ?? [];
  const childTreeItems = ownChildren.filter(
    (child) => child.type === "TreeItem",
  );
  const otherChildren = ownChildren.filter(
    (child) => child.type !== "TreeItem",
  );

  // ADR-923 r15m1 — 타입별 계약 (TreeItem `children`) — 위 renderTree 의 재귀 경로와 동일.
  //   r18m1 — 기본 글자 없음 (Skia 는 계약 결과가 "" 면 text 를 안 그린다).
  const displayTitle = resolveTextSourceText("TreeItem", element.props);

  const hasChildren = childTreeItems.length > 0;

  return (
    <TreeItem
      key={element.id}
      // ADR-239 Phase 1 (F6) — 재귀 경로와 같은 key 원천 (`props.id` → 노드 id). 종전 `customId` 는 재귀 경로
      //   (노드 id) 와 규칙이 달랐다.
      id={resolveStaticItemKey(
        element.props as Record<string, unknown> | undefined,
        element.id,
      )}
      data-element-id={element.id}
      title={displayTitle}
      hasChildren={hasChildren}
      showInfoButton={true}
      children={otherChildren.map((child) => context.renderElement(child))}
      childItems={
        hasChildren
          ? childTreeItems.map((childItem) => context.renderElement(childItem))
          : undefined
      }
    />
  );
};

/**
 * TagGroup 렌더링
 */
export const renderTagGroup = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { elements, childrenByParent, updateElementProps, setElements } =
    context;

  // Tag 자식 검색: TagGroup 직접 자식 또는 TagList 중간 레이어 하위 모두 지원
  const tagListChild = childrenByParent
    .get(element.id)
    ?.find((child) => child.type === "TagList");
  const tagParentId = tagListChild ? tagListChild.id : element.id;
  const tagChildren =
    childrenByParent
      .get(tagParentId)
      ?.filter((child) => child.type === "Tag") ?? [];

  // ColumnMapping 추출
  const columnMapping = (element.props as { columnMapping?: ColumnMapping })
    .columnMapping;

  // PropertyDataBinding 형식 감지 (source: 'dataTable' 또는 'apiEndpoint', name: 'xxx')
  const dataBinding = getElementDataBinding(element);
  const isPropertyBinding =
    dataBinding &&
    typeof dataBinding === "object" &&
    "source" in (dataBinding as object) &&
    "name" in (dataBinding as object) &&
    !("type" in (dataBinding as object));

  // Tag 템플릿에 Field children이 있는지 미리 확인
  const tagTemplate = tagChildren.length > 0 ? tagChildren[0] : null;
  const fieldChildrenInTemplate = tagTemplate
    ? (childrenByParent
        .get(tagTemplate.id)
        ?.filter((c) => c.type === "Field") ?? [])
    : [];
  const hasFieldChildren = fieldChildrenInTemplate.length > 0;

  // columnMapping이 있거나, (PropertyDataBinding + Field children) 있으면 Field 렌더링 모드 사용
  const hasValidTemplate =
    (columnMapping || (isPropertyBinding && hasFieldChildren)) &&
    tagChildren.length > 0;

  // ADR-097 P2: items[] SSOT canonical path
  //   Select/ComboBox/ListBox(ADR-073/076) 와 동일 패턴. migration 이후 Tag element tree 는
  //   제거되고 element.props.items 로 이전됨 — Path 2 가 기본 경로.
  const storedTagItems = (element.props as { items?: StoredTagItem[] }).items;
  const hasItemsArray =
    Array.isArray(storedTagItems) && storedTagItems.length > 0;

  // ADR-097 혼합 감지 — 부모 단위 원자성 위배 (ADR-076 선례 동일). Path 1 우선.
  if (hasValidTemplate && hasItemsArray) {
    console.warn(
      `[ADR-097] TagGroup ${element.id}: columnMapping/dataBinding 템플릿과 props.items 가 동시 존재. ` +
        `부모 단위 원자성 위배 — Path 1 템플릿 우선, items 무시. ` +
        `applyCollectionItemsMigration 재실행 또는 수동 분리 필요.`,
    );
  }

  // 제거된 항목 ID 추적 (columnMapping 모드에서 동적 데이터 항목 제거용)
  const removedItemIds = Array.isArray(element.props.removedItemIds)
    ? (element.props.removedItemIds as unknown as string[])
    : [];

  // ADR-234 Phase 3 — 작성자가 채운 목록 = TagList 의 Tag instance 자식. canonical 경로는 CanonicalNodeRenderer
  //   재귀 (RAC Tag + 상태 층 render props), legacy 경로는 여기서 RAC Tag 를 합성한다.
  const staticTagItems =
    !hasValidTemplate &&
    !hasItemsArray &&
    !dataBinding &&
    tagChildren.length > 0
      ? tagChildren.map((tag) => {
          const tagKids = childrenByParent.get(tag.id) ?? [];
          const text = tagKids
            .filter((kid) => kid.type === "Text")
            .map((kid) => String(kid.props.children ?? ""))
            .join(" ");
          const key = resolveStaticItemKey(
            tag.props as Record<string, unknown> | undefined,
            tag.id,
          );
          return {
            text,
            node: context.renderCollectionItem ? (
              context.renderCollectionItem(tag, tag.id)
            ) : (
              <Tag
                key={tag.id}
                id={key}
                textValue={text}
                data-element-id={tag.id}
                isDisabled={Boolean(tag.props.isDisabled)}
                style={tag.props.style}
              >
                {tagKids.map((kid) => context.renderElement(kid, kid.id))}
              </Tag>
            ),
          };
        })
      : null;

  const renderChildren = staticTagItems
    ? null
    : hasValidTemplate
      ? (item: Record<string, unknown>) => {
          const tagTemplate = tagChildren[0];
          const fieldChildren =
            context.childrenByParent
              .get(tagTemplate.id)
              ?.filter((child) => child.type === "Field") ?? [];

          return (
            <Tag
              key={String(item.id)}
              data-element-id={tagTemplate.id}
              isDisabled={Boolean(tagTemplate.props.isDisabled)}
              style={tagTemplate.props.style}
              className={tagTemplate.props.className}
            >
              {fieldChildren.length > 0
                ? fieldChildren.map((field) => {
                    // fieldKey 또는 key 속성 모두 지원 (fieldKey 우선)
                    const fieldKey =
                      (field.props as { fieldKey?: string; key?: string })
                        .fieldKey || (field.props as { key?: string }).key;
                    const fieldValue = fieldKey ? item[fieldKey] : undefined;

                    return (
                      <DataField
                        key={field.id}
                        fieldKey={fieldKey || ""}
                        label={(field.props as { label?: string }).label}
                        type={
                          (field.props as { type?: string }).type as
                            | "string"
                            | "number"
                            | "boolean"
                            | "date"
                            | "image"
                            | "url"
                            | "email"
                        }
                        value={fieldValue}
                        visible={
                          (field.props as { visible?: boolean }).visible !==
                          false
                        }
                        style={field.props.style}
                        className={field.props.className}
                      />
                    );
                  })
                : String(tagTemplate.props.children || "")}
            </Tag>
          );
        }
      : hasItemsArray
        ? // ADR-097 P2: items[] SSOT canonical. Select/ComboBox/ListBox Path 2 와 대칭.
          //   ADR-229 Phase 1 (2026-09-21): chip JSX 를 여기서 만들지 않고 `items` prop 으로 넘긴다 —
          //   TagGroup 의 rows 경로 (RAC items + render function) 가 chip 을 그린다. chip 렌더러가 한
          //   곳이어야 item template (root style base/selected · leading slot 존재 gating · slot 크기) 을
          //   selected 상태별로 적용할 수 있고, maxRows 미러도 실제 chip 과 같은 leading 을 측정한다.
          null
        : // Path 3 (legacy, P6 소멸 예정): Tag element tree fallback
          tagChildren.map((type) => (
            <Tag
              key={type.id}
              data-element-id={type.id}
              isDisabled={Boolean(type.props.isDisabled)}
              style={type.props.style}
              className={type.props.className}
            >
              {String(type.props.children || "")}
            </Tag>
          ));

  return (
    <TagGroup
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      className={element.props.className}
      style={element.props.style as React.CSSProperties | undefined}
      variant={String(element.props.variant || "default")}
      label={String(element.props.label || "")}
      description={String(element.props.description || "")}
      errorMessage={String(element.props.errorMessage || "")}
      allowsRemoving={Boolean(element.props.allowsRemoving)}
      selectionMode={
        (element.props.selectionMode as "none" | "single" | "multiple") ??
        resolveBindingSelectionMode("TagGroup", "none")
      }
      selectionBehavior={
        (element.props.selectionBehavior as "toggle" | "replace") || "toggle"
      }
      selectedKeys={
        Array.isArray(element.props.selectedKeys)
          ? (element.props.selectedKeys as unknown as string[])
          : []
      }
      isDisabled={Boolean(element.props.isDisabled)}
      disallowEmptySelection={Boolean(element.props.disallowEmptySelection)}
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      labelPosition={(element.props.labelPosition as "top" | "side") || "top"}
      maxRows={
        typeof element.props.maxRows === "number"
          ? element.props.maxRows
          : undefined
      }
      dataBinding={getElementDataBinding(element) as DataBinding | undefined}
      // ADR-097 P2 items SSOT — TagGroup rows 경로가 chip 을 그린다 (ADR-229: chip 렌더러 단일화).
      items={hasValidTemplate ? undefined : (storedTagItems as never)}
      // ADR-229 Phase 1 — chip item template (provider 가 문서에서 해석해 renderContext 로 주입).
      itemTemplate={context.tagTemplate ?? undefined}
      staticItems={staticTagItems ?? undefined}
      columnMapping={columnMapping}
      removedItemIds={removedItemIds}
      onSelectionChange={async (selectedKeys) => {
        const updatedProps = {
          ...element.props,
          selectedKeys: Array.from(selectedKeys),
        };
        updateElementProps(element.id, updatedProps);
        // ADR-158 규칙 · ADR-214 암묵 상태 미러
        invokeCustomEventHandler(
          context,
          element,
          "onSelectionChange",
          selectedKeys,
        );

        window.parent.postMessage(
          {
            type: "UPDATE_ELEMENT_PROPS",
            elementId: element.id,
            props: {
              selectedKeys: Array.from(selectedKeys),
            },
            merge: true,
          },
          getTargetOrigin(),
        );
      }}
      onRemove={async (keys) => {
        console.log("Removing tags:", Array.from(keys));

        const keysToRemove = Array.from(keys).map(String);

        // ColumnMapping 모드: 동적 데이터 항목 제거 (removedItemIds에 추가)
        if (hasValidTemplate) {
          const currentRemovedIds = Array.isArray(element.props.removedItemIds)
            ? (element.props.removedItemIds as unknown as string[])
            : [];

          const updatedRemovedIds = [...currentRemovedIds, ...keysToRemove];

          const currentSelectedKeys = Array.isArray(element.props.selectedKeys)
            ? (element.props.selectedKeys as unknown as string[])
            : [];
          const updatedSelectedKeys = currentSelectedKeys.filter(
            (key) => !keysToRemove.includes(String(key)),
          );

          const updatedProps = {
            ...element.props,
            removedItemIds: updatedRemovedIds,
            selectedKeys: updatedSelectedKeys,
          };

          updateElementProps(element.id, updatedProps);

          window.parent.postMessage(
            {
              type: "UPDATE_ELEMENT_PROPS",
              elementId: element.id,
              props: {
                removedItemIds: updatedRemovedIds,
                selectedKeys: updatedSelectedKeys,
              },
              merge: true,
            },
            getTargetOrigin(),
          );

          return;
        }

        // ADR-097 P2: items[] SSOT 모드 — props.items 에서 해당 id 제거
        if (hasItemsArray) {
          const updatedItems = (storedTagItems ?? []).filter(
            (item) => !keysToRemove.includes(String(item.id)),
          );

          const currentSelectedKeys = Array.isArray(element.props.selectedKeys)
            ? (element.props.selectedKeys as unknown as string[])
            : [];
          const updatedSelectedKeys = currentSelectedKeys.filter(
            (key) => !keysToRemove.includes(String(key)),
          );

          const updatedProps = {
            ...element.props,
            items: updatedItems,
            selectedKeys: updatedSelectedKeys,
          };

          updateElementProps(element.id, updatedProps);

          window.parent.postMessage(
            {
              type: "UPDATE_ELEMENT_PROPS",
              elementId: element.id,
              props: {
                items: updatedItems,
                selectedKeys: updatedSelectedKeys,
              },
              merge: true,
            },
            getTargetOrigin(),
          );

          return;
        }

        // Path 3 (legacy, P6 소멸): Element 삭제
        const deletedTagIds: string[] = [];

        for (const key of keysToRemove) {
          let tagId = key;
          if (typeof key === "string" && key.startsWith("react-aria-")) {
            const index = parseInt(key.replace("react-aria-", "")) - 1;
            const tagToRemove = tagChildren[index];
            if (tagToRemove) {
              tagId = tagToRemove.id;
            }
          }

          deletedTagIds.push(String(tagId));
        }

        const currentElements = elements;
        const updatedElements = currentElements.filter(
          (el) => !deletedTagIds.includes(el.id),
        );

        const currentSelectedKeys = Array.isArray(element.props.selectedKeys)
          ? (element.props.selectedKeys as unknown as string[])
          : [];
        const updatedSelectedKeys = currentSelectedKeys.filter(
          (key) => !keysToRemove.includes(String(key)),
        );

        const updatedProps = {
          ...element.props,
          selectedKeys: updatedSelectedKeys,
        };

        setElements(updatedElements);
        updateElementProps(element.id, updatedProps);
      }}
    >
      {renderChildren}
    </TagGroup>
  );
};

/**
 * Tag 렌더링 (독립적으로 렌더링될 때)
 * - Static children 또는 Field children 지원
 */
export const renderTag = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  // Field 자식 요소 찾기
  const fieldChildren = (context.childrenByParent.get(element.id) ?? []).filter(
    (child) => child.type === "Field",
  );

  // Field children이 있으면 DataField 렌더링 (단, 데이터는 없으므로 라벨만 표시)
  if (fieldChildren.length > 0) {
    return (
      <Tag
        key={element.id}
        id={element.customId}
        data-element-id={element.id}
        isDisabled={Boolean(element.props.isDisabled)}
        style={element.props.style}
        className={element.props.className}
        textValue={String(
          element.props.textValue || element.props.children || "",
        )}
      >
        {fieldChildren.map((field) => {
          const fieldKey =
            (field.props as { fieldKey?: string; key?: string }).fieldKey ||
            (field.props as { key?: string }).key;
          return (
            <DataField
              key={field.id}
              fieldKey={fieldKey || ""}
              label={(field.props as { label?: string }).label}
              type={
                (field.props as { type?: string }).type as
                  | "string"
                  | "number"
                  | "boolean"
                  | "date"
                  | "image"
                  | "url"
                  | "email"
              }
              value={`{${fieldKey}}`} // 템플릿 모드에서 fieldKey 표시
              showLabel={
                (field.props as { showLabel?: boolean }).showLabel !== false
              }
              visible={(field.props as { visible?: boolean }).visible !== false}
              style={field.props.style}
              className={field.props.className}
            />
          );
        })}
      </Tag>
    );
  }

  // Field children이 없으면 기존 static 렌더링
  return (
    <Tag
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      isDisabled={Boolean(element.props.isDisabled)}
      style={element.props.style}
      className={element.props.className}
      textValue={String(element.props.children || "")}
    >
      {String(element.props.children || "")}
    </Tag>
  );
};

/**
 * ToggleButtonGroup 렌더링
 */
export const renderToggleButtonGroup = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { batchUpdateElementProps } = context;

  const orientation = element.props.orientation as "horizontal" | "vertical";
  const indicator = Boolean(element.props.indicator);

  const toggleButtonChildren = (
    context.childrenByParent.get(element.id) ?? []
  ).filter((child) => child.type === "ToggleButton");

  const selectedKeys = new Set<string>(
    getSelectedChildIds(toggleButtonChildren),
  );
  // key 시그니처용 안정 정렬 문자열 (Set 순서 비결정성 회피).
  const selectedKeysSignature = Array.from(selectedKeys).sort().join(",");

  return (
    <ToggleButtonGroup
      // defaultSelectedKeys(uncontrolled) 는 mount 시점 selection 만 읽는다. 패널에서 자식
      //   ToggleButton 의 isSelected 토글 시 selectedKeysSignature 가 바뀌어 key 가 달라지고
      //   group 이 re-mount → 새 defaultSelectedKeys 를 다시 읽게 한다 (CheckboxGroup 동형).
      //   Skia 는 자식 buildCatalogShapes 가 props.isSelected 를 직접 읽어 즉시 반영하므로,
      //   key 없으면 Skia↔CSS preview drift.
      key={`${element.id}:${selectedKeysSignature}`}
      data-custom-id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      orientation={orientation}
      selectionMode={element.props.selectionMode as "single" | "multiple"}
      disallowEmptySelection={Boolean(element.props.disallowEmptySelection)}
      indicator={indicator}
      isEmphasized={Boolean(element.props.isEmphasized)}
      isQuiet={Boolean(element.props.isQuiet)}
      // staticColor (2026-08-21): 그룹→자식 상속 채널. 그룹 자신의 시각은 그대로고
      //   ToggleButtonGroupStaticColorContext 로 자식 ToggleButton 에 내려간다.
      staticColor={
        (element.props.staticColor as "auto" | "white" | "black" | undefined) ||
        "auto"
      }
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      // density (2026-08-21): Spectrum ActionGroup 규칙 — compact 는 버튼이 연결되고
      //   regular 는 분리된다. 기본값은 catalog `defaultDensity` 와 같은 regular 이며,
      //   미지정 시에도 `data-density` 를 내보내야 generated CSS 의 gate 가 걸린다
      //   (Tabs 렌더러 동형).
      density={
        (element.props.density as "compact" | "regular" | undefined) ||
        "regular"
      }
      // uncontrolled (defaultSelectedKeys) — RadioGroup defaultValue 동형.
      //   preview 는 canonicalDocument(node)를 렌더하는데 onSelectionChange→batchUpdateElementProps
      //   는 legacy runtimeStore.elements 만 갱신하여 canonical node 에 미반영 → controlled
      //   (selectedKeys) 면 RAC 표시가 store 와 동기 안 돼 클릭이 화면에 안 보인다(ADR-116/122
      //   canonical 전환 잔존 결함). uncontrolled 면 RAC 자체 state 가 표시를 담당하고 store 는
      //   영속화만 — RadioGroup/CheckboxGroup/Switch/Checkbox 동형(2026-06-22).
      defaultSelectedKeys={selectedKeys}
      onSelectionChange={(keys) => {
        const nextKeys = new Set(Array.from(keys).map((k) => String(k)));
        const batch: Array<{ id: string; props: Record<string, unknown> }> = [];
        toggleButtonChildren.forEach((child) => {
          const shouldBeSelected = nextKeys.has(child.id);
          if (Boolean(child.props.isSelected) !== shouldBeSelected) {
            batch.push({
              id: child.id,
              props: { ...child.props, isSelected: shouldBeSelected },
            });
          }
        });
        if (batch.length > 0) batchUpdateElementProps(batch);
      }}
    >
      {toggleButtonChildren.map((toggleButton) =>
        context.renderElement(toggleButton),
      )}
    </ToggleButtonGroup>
  );
};

/**
 * ToggleButton 렌더링
 */
export const renderToggleButton = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { elementsById, updateElementProps } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  const isInGroup = element.parent_id
    ? elementsById.get(element.parent_id)?.type === "ToggleButtonGroup"
    : false;

  // selection 은 uncontrolled — RadioGroup(자식 Radio)/Checkbox 동형(2026-06-22).
  //   preview 가 canonicalDocument(node)를 렌더하는데 onPress→updateElementProps 는 legacy
  //   runtimeStore.elements 만 갱신하여 canonical node 에 미반영 → controlled(isSelected)면 RAC
  //   표시가 store 와 동기 안 돼 클릭이 화면에 안 보인다(ADR-116/122 canonical 전환 잔존 결함).
  //   - group 안: group 의 defaultSelectedKeys + RAC groupState(props.id 매칭)가 selection 전담.
  //     자식엔 isSelected/defaultSelected/onPress 미부여(RadioGroup 자식 Radio 와 동일 — group
  //     onSelectionChange 가 일괄 영속화). id 는 group selection key 매칭에 필수라 유지.
  //   - 단독: defaultSelected(uncontrolled, Checkbox 동형) + onPress 에서 store 영속화.
  return (
    <ToggleButton
      // 단독 ToggleButton 은 defaultSelected(uncontrolled) 라 mount 시점 isSelected 만 읽는다.
      //   패널에서 isSelected 토글 시 key 가 바뀌어 re-mount → 새 defaultSelected 를 다시 읽게 한다
      //   (Checkbox/RadioGroup 동형). Skia 는 buildCatalogShapes 가 props.isSelected 를 매 rebuild
      //   직접 읽어 즉시 반영하므로, key 없으면 Skia↔CSS preview drift. group 안에선 group 의
      //   defaultSelectedKeys 가 selection 전담(자식 isSelected 무관) → key 에 selection 미포함.
      key={
        isInGroup
          ? element.id
          : `${element.id}:${Boolean(element.props.isSelected)}`
      }
      id={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      {...(isInGroup
        ? {}
        : { defaultSelected: Boolean(element.props.isSelected) })}
      isDisabled={Boolean(element.props.isDisabled)}
      autoFocus={Boolean(element.props.autoFocus)}
      isEmphasized={Boolean(element.props.isEmphasized)}
      // isQuiet / staticColor 전달 (2026-08-21 결손 수리): 둘 다 D2 표면·CSS·catalog 는
      //   갖췄으나 본 delegating renderer 가 prop 을 떨어뜨려 **DOM 경로에서만 dead** 였다
      //   (Skia 는 canonical props 를 직접 읽어 정상 → CSS↔Skia 비대칭). quiet 은 generated
      //   ToggleButton.css `[data-quiet]`, static 은 수동 ToggleButton.css 가 소비.
      isQuiet={Boolean(element.props.isQuiet)}
      staticColor={
        (element.props.staticColor as "auto" | "white" | "black" | undefined) ||
        "auto"
      }
      size={(element.props.size as "sm" | "md" | "lg") || "md"}
      // ADR-234 — 상태 변형 층 (RAC render props). 미주입이면 종전 style 그대로.
      style={
        element.stateStyle
          ? (renderProps: object) =>
              element.stateStyle!(
                renderProps as Record<string, unknown>,
                element.props.style as React.CSSProperties | undefined,
              )
          : element.props.style
      }
      className={element.props.className}
      onPress={
        isInGroup
          ? undefined
          : () => {
              updateElementProps(element.id, {
                ...element.props,
                isSelected: !element.props.isSelected,
              });
            }
      }
      // ADR-158 규칙 · ADR-214 암묵 상태 미러 (RAC ToggleButton onChange(isSelected))
      onChange={(isSelected) =>
        invokeCustomEventHandler(context, element, "onChange", isSelected)
      }
    >
      {typeof element.props.children === "string"
        ? element.props.children
        : null}
      {children.map((child) => context.renderElement(child, child.id))}
    </ToggleButton>
  );
};

/**
 * Menu 렌더링
 * items SSOT 경로: element.props.items (StoredMenuItem[]) → RuntimeMenuItem[] 변환 후 MenuButton에 전달
 * dataBinding 경로: useCollectionData 결과 사용 (기존 유지)
 */
export const renderMenu = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;

  const entries = (element.props.items ?? []) as StoredMenuEntry[];

  // ADR-099 Addendum 099-f Part 2: section/separator 분기 감지
  // section 또는 separator entry 가 하나라도 있으면 children 경로 사용
  const hasStructuredEntries = entries.some(
    (e) => isMenuSectionEntry(e) || isMenuSeparatorEntry(e),
  );

  // ADR-148 Phase 4 — MenuItem slot 구성: renderListBox/renderGridList 동형 fallback
  //   (provider 주입 → legacy 전체-트리 origin 리터럴 조회). Menu 는 items 데이터 기반이라
  //   template child 축 없음. null = legacy 문서 → 기존 동작(BC).
  const menuItemSlotComposition =
    context.menuItemTemplateSlotComposition !== undefined
      ? context.menuItemTemplateSlotComposition
      : resolveSlotComposition(
          context.childrenByParent.get("component-menu-item-default"),
        );

  // React 19: `key` 는 props spread 로 전달 불가 — JSX 에서 직접 명시.
  const commonProps = {
    id: element.customId,
    "data-element-id": element.id,
    // ADR-923 r15m1 — 텍스트 원천은 타입별 계약 (Menu 는 `label → children`; factory 가 둘 다 쓴다).
    //   r18m1 — 기본 글자 없음 (Skia 는 계약 결과가 "" 면 trigger text 를 안 그린다).
    label: resolveTextSourceText("Menu", element.props),
    // ADR-923 r20m2 — D1 접근성 이름은 보이는 글자와 다른 경로. factory 가 쓰는 `"aria-label": "Menu"`
    //   와 열린 writer 의 aria-labelledby 를 MenuButton (trigger Button) 에 전달한다.
    "aria-label":
      typeof element.props["aria-label"] === "string"
        ? element.props["aria-label"]
        : undefined,
    "aria-labelledby":
      typeof element.props["aria-labelledby"] === "string"
        ? element.props["aria-labelledby"]
        : undefined,
    variant: (element.props.variant as string) || "primary",
    size: (element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || "md",
    style: element.props.style,
    className: element.props.className,
    dataBinding: getElementDataBinding(element) as DataBinding | undefined,
    selectionMode: (
      element.props as { selectionMode?: "none" | "single" | "multiple" }
    ).selectionMode,
    selectedKeys: (element.props as { selectedKeys?: string[] }).selectedKeys,
    onSelectionChange: (keys: string[]) => {
      updateElementProps(element.id, {
        ...element.props,
        selectedKeys: keys,
      });
    },
    // ADR-148 Phase 4: MenuButton 내부 item emit 이 slot 구성을 소비 (양 경로 공통).
    slotComposition: menuItemSlotComposition,
  } as const;

  if (hasStructuredEntries) {
    // section/separator 포함 — children 경로 (MenuButton static children fallback)
    // RAC D1: MenuSection / Header / Separator 공식 API 사용
    const renderMenuLeaf = (item: StoredMenuItem): React.ReactNode => (
      <MenuItem
        key={item.id}
        id={item.id}
        textValue={item.textValue ?? item.label}
        isDisabled={Boolean(item.isDisabled)}
        // RAC MenuItem 은 `href` 키가 존재하기만 하면(undefined 값이어도) link 모드로
        // 진입해 DOM 에 `href=""` 를 렌더 → React 경고("empty string passed to href").
        // 따라서 href 가 있을 때만 prop 을 전개(conditional spread)해 키 자체를 제거한다.
        {...(item.href ? { href: item.href } : {})}
      >
        {renderMenuItemSlotParts(item, menuItemSlotComposition)}
      </MenuItem>
    );

    const menuChildren = entries.map((entry) => {
      if (isMenuSectionEntry(entry)) {
        return (
          <AriaMenuSection
            key={entry.id}
            aria-label={entry.ariaLabel ?? entry.header}
            selectionMode={entry.selectionMode}
            selectedKeys={
              entry.selectedKeys ? new Set(entry.selectedKeys) : undefined
            }
            defaultSelectedKeys={
              entry.defaultSelectedKeys
                ? new Set(entry.defaultSelectedKeys)
                : undefined
            }
          >
            <AriaMenuHeader>{entry.header}</AriaMenuHeader>
            {entry.items.map(renderMenuLeaf)}
          </AriaMenuSection>
        );
      }
      if (isMenuSeparatorEntry(entry)) {
        return <AriaMenuSeparator key={entry.id} />;
      }
      // default: StoredMenuItem
      return renderMenuLeaf(entry as StoredMenuItem);
    });

    return (
      <MenuButton key={element.id} {...commonProps}>
        {menuChildren}
      </MenuButton>
    );
  }

  // ADR-234 Phase 3f — 정적 항목 (Menu 자식 = MenuItem instance): 항목의 slot 자식 (Icon · Label · Shortcut ·
  //   Description) 에서 행을 조립해 이관 전 items 행과 같은 DOM (`renderMenuItemSlotParts`) 을 낸다. 항목은
  //   popover 안이라 Canvas 는 그리지 않는다 (트리거만). 숨긴 slot (`enabled: false`) 은 resolver 가 뺐다.
  // ADR-238 Phase 2 — 정적 자식 = MenuItem instance · MenuSection (Header + MenuItem) · Separator (RAC 그대로).
  const staticChildren =
    entries.length === 0
      ? (context.childrenByParent.get(element.id) ?? []).filter(
          (child) =>
            child.type === "MenuItem" ||
            child.type === "MenuSection" ||
            child.type === "Separator",
        )
      : [];
  if (
    staticChildren.some(
      (child) => child.type === "MenuItem" || child.type === "MenuSection",
    )
  ) {
    const renderStaticMenuItem = (
      item: PreviewElement,
      section: PreviewElement | null,
    ) => {
      const parts = context.childrenByParent.get(item.id) ?? [];
      const part = (role: string) =>
        parts.find((child) => getSlotRole(child) === role);
      const textOf = (role: string): string | undefined => {
        const node = part(role);
        return node ? resolveTextSourceText(node.type, node.props) : undefined;
      };
      const iconName = part("icon")?.props.iconName;
      const label = textOf("label") ?? "";
      const itemProps = item.props as Record<string, unknown>;
      return (
        <MenuItem
          key={item.id}
          id={resolveSectionItemKey(
            itemProps,
            item.id,
            section
              ? {
                  id: section.id,
                  props: section.props as Record<string, unknown>,
                  ref: section._resolvedFrom,
                }
              : null,
          )}
          data-element-id={item.id}
          textValue={label}
          isDisabled={Boolean(itemProps.isDisabled)}
          // ADR-237 Phase 2 — MenuItem 상태 변형 층 (hover · pressed · focus-visible · disabled) 을 RAC render
          //   props 로 겹친다 (항목 기본 style 은 종전처럼 넘기지 않는다 — 층 키만).
          {...(item.stateStyle
            ? {
                style: (renderProps: MenuItemRenderProps) =>
                  item.stateStyle!(
                    renderProps as unknown as Record<string, unknown>,
                    undefined,
                  ) as React.CSSProperties,
              }
            : {})}
          {...(typeof itemProps.href === "string" && itemProps.href
            ? { href: itemProps.href }
            : {})}
        >
          {renderMenuItemSlotParts(
            {
              label,
              icon: typeof iconName === "string" ? iconName : undefined,
              shortcut: textOf("shortcut"),
              description: textOf("description"),
            },
            resolveSlotComposition(parts),
          )}
        </MenuItem>
      );
    };
    const menuChildren = staticChildren.map((child) => {
      if (child.type === "Separator") {
        return <AriaMenuSeparator key={child.id} />;
      }
      if (child.type === "MenuSection") {
        const sectionKids = context.childrenByParent.get(child.id) ?? [];
        const header = sectionKids.find((kid) => kid.type === "Header");
        const sectionProps = child.props as Record<string, unknown>;
        return (
          <AriaMenuSection
            key={child.id}
            aria-label={
              typeof sectionProps["aria-label"] === "string"
                ? (sectionProps["aria-label"] as string)
                : undefined
            }
            // F6 — per-section 선택 (RAC MenuSection 공식 prop) 은 section 노드 props 그대로.
            {...(sectionProps.selectionMode !== undefined
              ? {
                  selectionMode: sectionProps.selectionMode as
                    "none" | "single" | "multiple",
                }
              : {})}
            {...(Array.isArray(sectionProps.selectedKeys)
              ? { selectedKeys: sectionProps.selectedKeys as string[] }
              : {})}
            {...(Array.isArray(sectionProps.defaultSelectedKeys)
              ? {
                  defaultSelectedKeys:
                    sectionProps.defaultSelectedKeys as string[],
                }
              : {})}
          >
            {header ? (
              <AriaMenuHeader>
                {resolveTextSourceText(header.type, header.props) ?? ""}
              </AriaMenuHeader>
            ) : null}
            {sectionKids
              .filter((kid) => kid.type === "MenuItem")
              .map((kid) => renderStaticMenuItem(kid, child))}
          </AriaMenuSection>
        );
      }
      return renderStaticMenuItem(child, null);
    });
    return (
      <MenuButton key={element.id} {...commonProps}>
        {menuChildren}
      </MenuButton>
    );
  }

  // items-only 경로 (기존 동작 유지 — BC 0%)
  const runtime = (entries as StoredMenuItem[]).map((it) =>
    toRuntimeMenuItem(it),
  );

  return <MenuButton key={element.id} {...commonProps} items={runtime} />;
};

/**
 * MenuItem 렌더링
 */
export const renderMenuItem = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <MenuItem
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      textValue={String(
        element.props.textValue || element.props.children || "",
      )}
      isDisabled={Boolean(element.props.isDisabled)}
    >
      {typeof element.props.children === "string"
        ? element.props.children
        : null}
      {children.map((child) => renderElement(child, child.id))}
    </MenuItem>
  );
};

/**
 * Toolbar 렌더링
 */
export const renderToolbar = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { renderElement } = context;

  const children = context.childrenByParent.get(element.id) ?? [];

  return (
    <Toolbar
      key={element.id}
      data-custom-id={element.customId}
      data-element-id={element.id}
      orientation={
        (element.props.orientation as "horizontal" | "vertical") || "horizontal"
      }
      style={element.props.style}
      className={element.props.className}
      aria-label={String(element.props["aria-label"] || "Toolbar")}
    >
      {children.map((child) => renderElement(child, child.id))}
    </Toolbar>
  );
};
